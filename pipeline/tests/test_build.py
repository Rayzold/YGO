import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from build_data import build  # noqa: E402

CARDS = [
    {  # TCG main deck monster, Limited now, Semi-Limited on the upcoming list
        "konami_id": 1, "password": 111, "card_type": "Monster", "name": {"en": "Alpha"},
        "text": {"en": 'If this card is Normal Summoned: You can add 1 "Beta" from your Deck to your hand.'},
        "sets": {"en": [{"set_number": "AAA-EN001"}]}, "monster_type_line": "Warrior / Effect",
        "attribute": "LIGHT", "level": 4, "atk": 1800, "def": 1000, "series": ["Alpha"],
    },
    {  # Link monster, unlimited
        "konami_id": 2, "password": 222, "card_type": "Monster", "name": {"en": "Beta Link"},
        "text": {"en": "2 Effect Monsters\nNegate the activation."},
        "sets": {"en": [{"set_number": "AAA-EN002"}]}, "monster_type_line": "Cyberse / Link / Effect",
        "link_arrows": ["⬅", "➡"], "materials": "2 Effect Monsters", "atk": 2300,
    },
    {  # OCG-only card: must be dropped
        "konami_id": 3, "password": 333, "card_type": "Spell", "name": {"en": "OCG Only"},
        "text": {"en": "Draw 1 card."}, "sets": {"ja": [{"set_number": "X"}]},
    },
]


def test_build_filters_tcg_and_applies_banlists():
    data, texts = build(CARDS, {"date": "2026-10-19", "regulation": {"1": 1}},
                        {"date": "2027-01-01", "regulation": {"1": 2}})
    by = {c["name"]: c for c in data["cards"]}
    assert set(by) == {"Alpha", "Beta Link"}
    assert by["Alpha"]["limit"] == 1 and by["Alpha"]["next"] == 2
    assert by["Beta Link"]["limit"] == 3 and "next" not in by["Beta Link"]
    assert by["Beta Link"]["extra"] is True and by["Beta Link"]["link"] == 2
    assert "search" in by["Alpha"]["tags"] and "trig_summoned" in by["Alpha"]["tags"]
    assert by["Alpha"]["mentions"] == ["Beta"]
    assert data["meta"] == {**data["meta"], "banlist": "2026-10-19", "upcoming": "2027-01-01", "count": 2}
    assert texts[111].startswith("If this card")


def test_no_upcoming_list():
    data, _ = build(CARDS, {"date": "2026-10-19", "regulation": {"1": 1}}, None)
    assert data["meta"]["upcoming"] is None
    assert all("next" not in c for c in data["cards"])


def test_full_export_keeps_ocg_and_flattens_prints():
    from build_data import build_full
    cards = CARDS + [
        {  # brand-new card without a password yet
            "konami_id": 9, "card_type": "Monster", "name": {"en": "New Card", "ja": "<ruby>灰<rt>は</rt></ruby>"},
            "text": {"en": "Effect."}, "atk": "?", "def": 0,
            "sets": {"en": [{"set_number": "NEW-EN001", "set_name": "New", "rarities": ["Common", "Secret Rare"]}],
                     "de": [{"set_number": "NEW-DE001", "rarities": ["Common"]}]},
        },
        {"card_type": "Spell", "name": {"en": "No Ids"}, "text": {"en": "x"}, "sets": {"en": [{}]}},  # dropped
    ]
    full, prints, meta = build_full(cards, {"date": "2026-10-19", "regulation": {"1": 1}}, None,
                                    {"date": "2026-10-01", "regulation": {"3": 0}}, None)
    by = {c["name"]: c for c in full}
    assert set(by) == {"Alpha", "Beta Link", "OCG Only", "New Card"}
    assert by["OCG Only"]["tcg"] is False and by["OCG Only"]["ocg"] is True
    assert by["OCG Only"]["ocg_limit"] == 0 and by["OCG Only"]["tcg_limit"] is None
    assert by["Alpha"]["tcg_limit"] == 1 and by["Alpha"]["tcg_next_limit"] is None and by["Alpha"]["ocg_limit"] is None
    assert by["New Card"]["id"] == -9 and by["New Card"]["password"] is None
    assert by["New Card"]["names"] == {"ja": "灰"}
    assert by["New Card"]["atk"] is None and by["New Card"]["def"] == 0
    assert by["Beta Link"]["extra_deck"] is True and by["Beta Link"]["link_rating"] == 2
    new_prints = [p for p in prints if p["card_id"] == -9]
    assert [(p["region"], p["rarity"]) for p in new_prints] == [("en", "Common"), ("en", "Secret Rare")]  # no "de"
    assert meta["cards"] == 4 and meta["tcg_cards"] == 3 and meta["ocg_cards"] == 1 and meta["ocg_banlist"] == "2026-10-01"
