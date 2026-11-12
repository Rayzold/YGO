"""Build the static card data used by the web app (TCG only).

Sources (both open, refreshed daily upstream):
  * YAML Yugi aggregate card list   https://github.com/DawnbrandBots/yaml-yugi
  * TCG Forbidden & Limited List    https://github.com/DawnbrandBots/yaml-yugi-limit-regulation
    (sourced from Konami's European site, so dates match the EU/Greece list)

Outputs (in --out, default public/data) — TCG cards for the web app:
  cards.json  compact card records with mechanic tags and banlist status
  texts.json  {id: English card text}, loaded separately by the app

With --full DIR, also the complete OCG + TCG card database (published to the
repo's `data` branch and loaded into Supabase by public.refresh_card_data()):
  cards.json   one flat record per card (all languages' names, text, tags, TCG/OCG legality and limits)
  prints.json  one row per English (TCG) / Japanese (OCG) print and rarity
  meta.json    build time, banlist dates, counts

Usage:
  python3 pipeline/build_data.py                          # download sources
  python3 pipeline/build_data.py --cards local.json --banlist local.vector.json
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tagger import QUOTED, tag_card  # noqa: E402

CARDS_URL = "https://dawnbrandbots.github.io/yaml-yugi/cards.json"
BANLIST_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/tcg/current.vector.json"
UPCOMING_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/tcg/upcoming.vector.json"
OCG_BANLIST_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/ocg/current.vector.json"
OCG_UPCOMING_URL = "https://dawnbrandbots.github.io/yaml-yugi-limit-regulation/ocg/upcoming.vector.json"
PRINT_REGIONS = ("en", "ja")  # TCG and OCG prints; other regions are reprints of these
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


def card_id(card):
    """The card password (what .ydk files use). Brand-new cards may not have one
    yet: they get the negative Konami ID so they still have a stable key."""
    if card.get("password"):
        return card["password"]
    if card.get("konami_id"):
        return -card["konami_id"]
    return None


RUBY = re.compile(r"<rt>.*?</rt>|</?ruby>")


def plain(s):
    """Drop Japanese furigana markup: <ruby>灰<rt>は</rt></ruby> -> 灰."""
    return RUBY.sub("", s) if isinstance(s, str) else s


def stat(v):
    """ATK/DEF: int, or None for '?' and missing."""
    return v if isinstance(v, int) else None


def build(cards, current, upcoming):
    cur, nxt = regulation(current), regulation(upcoming)
    out, texts = [], {}
    for c in cards:
        cid = card_id(c)
        if not is_tcg(c) or cid is None:
            continue
        kid = c.get("konami_id")
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


def build_full(cards, tcg, tcg_next, ocg, ocg_next):
    """Complete OCG + TCG database for Supabase (see module docstring)."""
    reg = {k: regulation(v) for k, v in
           (("tcg", tcg), ("tcg_next", tcg_next), ("ocg", ocg), ("ocg_next", ocg_next))}

    def limit(kind, card, legal):
        if not legal:
            return None
        if kind.endswith("_next") and (tcg_next if kind == "tcg_next" else ocg_next) is None:
            return None
        return reg[kind].get(card.get("konami_id"), UNLIMITED)

    out, prints = [], []
    for c in cards:
        cid = card_id(c)
        name = (c.get("name") or {}).get("en") or plain((c.get("name") or {}).get("ja"))
        if cid is None or not name:
            continue
        sets = c.get("sets") or {}
        in_tcg, in_ocg = bool(sets.get("en")), bool(sets.get("ja"))
        line = c.get("monster_type_line") or None
        text_en = (c.get("text") or {}).get("en")
        rec = {
            "id": cid,
            "konami_id": c.get("konami_id"),
            "password": c.get("password"),
            "name": name,
            "names": {k: plain(v) for k, v in (c.get("name") or {}).items() if k != "en" and v},
            "card_type": c["card_type"],
            "frame": line,
            "property": c.get("property"),
            "attribute": c.get("attribute"),
            "level": c.get("level"),
            "rank": c.get("rank"),
            "link_rating": len(c["link_arrows"]) if c.get("link_arrows") else None,
            "link_arrows": c.get("link_arrows"),
            "atk": stat(c.get("atk")),
            "def": stat(c.get("def")),
            "scale": c.get("pendulum_scale"),
            "series": c.get("series") or [],
            "mentions": sorted(set(QUOTED.findall(text_en or "")) - {name}),
            "materials": c.get("materials"),
            "text": text_en,
            "pendulum_text": (c.get("pendulum_effect") or {}).get("en"),
            "tags": tag_card(c) if text_en else [],
            "extra_deck": bool(line) and any(f in line for f in EXTRA_FRAMES),
            "tcg": in_tcg,
            "ocg": in_ocg,
            "tcg_limit": limit("tcg", c, in_tcg),
            "tcg_next_limit": limit("tcg_next", c, in_tcg),
            "ocg_limit": limit("ocg", c, in_ocg),
            "ocg_next_limit": limit("ocg_next", c, in_ocg),
            "md_rarity": c.get("master_duel_rarity"),
            "fake_password": bool(c.get("fake_password")),
        }
        out.append(rec)
        for region in PRINT_REGIONS:
            for p in sets.get(region) or []:
                for rarity in p.get("rarities") or [None]:
                    prints.append({
                        "card_id": cid,
                        "region": region,
                        "set_number": p.get("set_number"),
                        "set_name": p.get("set_name"),
                        "rarity": rarity,
                    })
    out.sort(key=lambda r: r["id"])
    meta = {
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tcg_banlist": (tcg or {}).get("date"),
        "tcg_upcoming": (tcg_next or {}).get("date"),
        "ocg_banlist": (ocg or {}).get("date"),
        "ocg_upcoming": (ocg_next or {}).get("date"),
        "cards": len(out),
        "tcg_cards": sum(1 for r in out if r["tcg"]),
        "ocg_cards": sum(1 for r in out if r["ocg"]),
        "prints": len(prints),
    }
    return out, prints, meta


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cards", default=CARDS_URL)
    ap.add_argument("--banlist", default=BANLIST_URL)
    ap.add_argument("--upcoming", default=UPCOMING_URL)
    ap.add_argument("--ocg-banlist", default=OCG_BANLIST_URL)
    ap.add_argument("--ocg-upcoming", default=OCG_UPCOMING_URL)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "data"))
    ap.add_argument("--full", metavar="DIR", help="also write the complete OCG+TCG database to DIR")
    a = ap.parse_args(argv)

    cards = load(a.cards)
    tcg, tcg_next = load(a.banlist), load(a.upcoming, optional=True)
    data, texts = build(cards, tcg, tcg_next)
    os.makedirs(a.out, exist_ok=True)
    write_json(os.path.join(a.out, "cards.json"), data)
    write_json(os.path.join(a.out, "texts.json"), texts)
    m = data["meta"]
    print(f"{m['count']} TCG cards, banlist {m['banlist']}, upcoming {m['upcoming']} -> {os.path.abspath(a.out)}")

    if a.full:
        full, prints, meta = build_full(cards, tcg, tcg_next, load(a.ocg_banlist), load(a.ocg_upcoming, optional=True))
        os.makedirs(a.full, exist_ok=True)
        write_json(os.path.join(a.full, "cards.json"), full)
        write_json(os.path.join(a.full, "prints.json"), prints)
        with open(os.path.join(a.full, "meta.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        print(f"full database: {meta['cards']} cards ({meta['tcg_cards']} TCG, {meta['ocg_cards']} OCG), "
              f"{meta['prints']} prints -> {os.path.abspath(a.full)}")


if __name__ == "__main__":
    main()
