"""Build the static card data used by the web app (TCG only).

Sources (both open, refreshed daily upstream):
  * YAML Yugi aggregate card list   https://github.com/DawnbrandBots/yaml-yugi
  * TCG Forbidden & Limited List    https://github.com/DawnbrandBots/yaml-yugi-limit-regulation
    (sourced from Konami's European site, so dates match the EU/Greece list)

Outputs (in --out, default public/data):
  cards.json  compact card records with mechanic tags and banlist status
  texts.json  {id: English card text}, loaded separately by the app

Usage:
  python3 pipeline/build_data.py                          # download sources
  python3 pipeline/build_data.py --cards local.json --banlist local.vector.json
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tagger import QUOTED, tag_card  # noqa: E402

CARDS_URL = "https://dawnbrandbots.github.io/yaml-yugi/cards.json"
BANLIST_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/tcg/current.vector.json"
UPCOMING_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/tcg/upcoming.vector.json"
EXTRA_FRAMES = ("Fusion", "Synchro", "Xyz", "Link")
UNLIMITED = 3


def load(src, optional=False):
    """Load JSON from a URL or a local path. Returns None for a missing optional URL."""
    if src.startswith(("http://", "https://")):
        req = urllib.request.Request(src, headers={"User-Agent": "ygo-deck-builder-data-pipeline"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if optional and e.code == 404:
                return None
            raise
    if optional and not os.path.exists(src):
        return None
    with open(src, encoding="utf-8") as f:
        return json.load(f)


def regulation(vector):
    """Konami ID -> 0 Forbidden / 1 Limited / 2 Semi-Limited."""
    return {int(k): v for k, v in (vector or {}).get("regulation", {}).items()}


def is_tcg(card):
    return bool(card.get("sets", {}).get("en")) and bool(card.get("name", {}).get("en"))


def build(cards, current, upcoming):
    cur, nxt = regulation(current), regulation(upcoming)
    out, texts = [], {}
    for c in cards:
        if not is_tcg(c):
            continue
        kid, cid = c["konami_id"], c["password"]
        line = c.get("monster_type_line") or ""
        limit = cur.get(kid, UNLIMITED)
        rec = {
            "id": cid,
            "name": c["name"]["en"],
            "type": c["card_type"],
            "line": line,
            "prop": c.get("property"),
            "attr": c.get("attribute"),
            "lvl": c.get("level") or c.get("rank"),
            "link": len(c["link_arrows"]) if c.get("link_arrows") else None,
            "atk": c.get("atk"),
            "def": c.get("def"),
            "scale": c.get("pendulum_scale"),
            "series": c.get("series") or [],
            "mentions": sorted(set(QUOTED.findall(c["text"].get("en") or "")) - {c["name"]["en"]}),
            "materials": c.get("materials"),
            "limit": limit,
            "extra": any(f in line for f in EXTRA_FRAMES),
            "tags": tag_card(c),
        }
        if upcoming is not None and nxt.get(kid, UNLIMITED) != limit:
            rec["next"] = nxt.get(kid, UNLIMITED)
        if c.get("fake_password"):
            rec["noImage"] = True
        # drop empty optional fields to keep the payload small
        rec = {k: v for k, v in rec.items() if v not in (None, [], "")}
        out.append(rec)
        text = c["text"].get("en") or ""
        pend = (c.get("pendulum_effect") or {}).get("en")
        texts[cid] = f"[Pendulum Effect] {pend}\n\n{text}" if pend else text
    out.sort(key=lambda r: r["name"])
    meta = {
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "format": "tcg",
        "banlist": (current or {}).get("date"),
        "upcoming": (upcoming or {}).get("date"),
        "count": len(out),
    }
    return {"meta": meta, "cards": out}, texts


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cards", default=CARDS_URL)
    ap.add_argument("--banlist", default=BANLIST_URL)
    ap.add_argument("--upcoming", default=UPCOMING_URL)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    a = ap.parse_args(argv)

    data, texts = build(load(a.cards), load(a.banlist), load(a.upcoming, optional=True))
    os.makedirs(a.out, exist_ok=True)
    for name, obj in (("cards.json", data), ("texts.json", texts)):
        with open(os.path.join(a.out, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    m = data["meta"]
    print(f"{m['count']} TCG cards, banlist {m['banlist']}, upcoming {m['upcoming']} -> {os.path.abspath(a.out)}")


if __name__ == "__main__":
    main()
