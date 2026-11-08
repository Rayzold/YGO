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
