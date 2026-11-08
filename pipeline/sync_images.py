"""Re-host card images in Supabase Storage (public bucket "card-images").

YGOPRODeck asks API users not to hotlink images: download each one once and host
it yourself, at a gentle rate. This script does exactly that, incrementally:
it lists what the bucket already has and only fetches the missing images.

Environment:
  SUPABASE_URL                 https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    service-role key (GitHub secret, never in the app)
  IMAGE_SOURCE   default https://images.ygoprodeck.com/images/cards_small
  BUCKET         default card-images
  MAX_DOWNLOADS  default 1500 per run (the nightly job finishes the rest over a few days)
  RATE           default 4 requests/second

Usage: python3 pipeline/sync_images.py [public/data/cards.json]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

UA = "ygo-deck-builder-image-sync"


def env(name, default=None):
    v = os.environ.get(name, default)
    if v is None or v == "":
        sys.exit(f"missing env var {name}")
    return v


class Storage:
    def __init__(self, url, key, bucket):
        self.base = url.rstrip("/") + "/storage/v1"
        self.key = key
        self.bucket = bucket

    def _req(self, method, path, body=None, headers=None):
        h = {"Authorization": f"Bearer {self.key}", "apikey": self.key, "User-Agent": UA}
        h.update(headers or {})
        data = body
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw and r.headers.get("Content-Type", "").startswith("application/json") else raw

    def ensure_bucket(self):
        try:
            self._req("GET", f"/bucket/{self.bucket}")
        except urllib.error.HTTPError as e:
            if e.code not in (400, 404):
                raise
            self._req("POST", "/bucket", {"id": self.bucket, "name": self.bucket, "public": True})
            print(f"created public bucket {self.bucket}")

    def existing(self):
        names, offset = set(), 0
        while True:
            page = self._req("POST", f"/object/list/{self.bucket}",
                             {"prefix": "", "limit": 1000, "offset": offset,
                              "sortBy": {"column": "name", "order": "asc"}})
            names.update(o["name"] for o in page)
            if len(page) < 1000:
                return names
            offset += 1000

    def upload(self, name, data):
        self._req("POST", f"/object/{self.bucket}/{name}", data, {
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
            "Cache-Control": "max-age=31536000",
        })


def main(cards_path):
    storage = Storage(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), env("BUCKET", "card-images"))
    source = env("IMAGE_SOURCE", "https://images.ygoprodeck.com/images/cards_small").rstrip("/")
    budget = int(env("MAX_DOWNLOADS", "1500"))
    delay = 1 / float(env("RATE", "4"))

    with open(cards_path, encoding="utf-8") as f:
        ids = sorted(c["id"] for c in json.load(f)["cards"] if not c.get("noImage"))

    storage.ensure_bucket()
    have = storage.existing()
    todo = [i for i in ids if f"{i}.jpg" not in have]
    print(f"{len(ids)} cards, {len(have)} images already hosted, {len(todo)} missing; fetching up to {budget}")

    uploaded, not_found, failed = 0, [], []
    for cid in todo[:budget]:
        try:
            req = urllib.request.Request(f"{source}/{cid}.jpg", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            storage.upload(f"{cid}.jpg", data)
            uploaded += 1
        except urllib.error.HTTPError as e:
            (not_found if e.code == 404 else failed).append(cid)
            if e.code in (401, 403) and "storage" in str(e.url or ""):
                sys.exit(f"storage auth failed ({e.code}); check SUPABASE_SERVICE_ROLE_KEY")
        except Exception as e:  # network hiccup: retry next run
            print(f"  {cid}: {e}")
            failed.append(cid)
        time.sleep(delay)

    left = max(0, len(todo) - budget)
    print(f"uploaded {uploaded}, not found at source {len(not_found)}, failed {len(failed)}, left for next run {left}")
    if not_found:
        print("not found:", ", ".join(map(str, not_found[:50])))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "public", "data", "cards.json"))
