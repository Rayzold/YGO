"""Tagger accuracy checks.

GOLD lists tags each card MUST get (checked against the real card text).
FORBIDDEN_TAGS lists tags a card must NOT get (false positives found in review).
Run with:  python3 -m pytest pipeline/tests
Full-data checks run only when YGO_CARDS points at a YAML Yugi cards.json.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from tagger import tag_card  # noqa: E402


def card(text, card_type="Monster"):
    return {"card_type": card_type, "text": {"en": text}}


# --- unit cases on literal card text (no data download needed) -------------
CASES = [
    ("Target 1 monster in either GY; Special Summon it.", "Spell", {"ss_from_gy"}),
    ("Send 1 monster from your Deck to the GY.", "Spell", {"mill"}),
    ("Both players discard as many cards as possible from their hands, then each player draws "
     "the same number of cards they discarded.", "Spell", {"discard", "draw"}),
    ('During either player\'s turn: You can send this card from your hand to the Graveyard; this turn, '
     'each time your opponent Special Summons a monster(s), immediately draw 1 card.', "Monster",
     {"hand_trap", "draw", "self_discard"}),
    ('If this face-up card on the field is destroyed by a card effect: You can add 1 "F.A." card from '
     'your Deck to your hand, except "F.A. City Grand Prix".', "Spell", {"search", "trig_destroyed"}),
    ("If this card is in your GY: You can send the top card of your Deck to the GY, and if you do, "
     "Special Summon this card.", "Monster", {"gy_effect", "mill", "ss_self"}),
]

NOT_EXPECTED = [
    # "but negate its effects" on your own summon is a drawback, not an interruption
    ("When this card is Normal Summoned: You can Special Summon 1 Level 3 Fiend monster from your hand "
     "or Deck, but negate its effects.", {"negate"}),
    # banishing itself is a cost, not removal
    ("You can banish this card from the GY, then target 1 card on the field; destroy it.", {"banish_removal"}),
    # returning itself to the hand is not bounce
    ("Once per turn, during the End Phase, if this card was Normal Summoned this turn: Return it to the hand.",
     {"bounce"}),
]


@pytest.mark.parametrize("text,ctype,expected", CASES)
def test_expected_tags(text, ctype, expected):
    assert expected <= set(tag_card(card(text, ctype)))


@pytest.mark.parametrize("text,unexpected", NOT_EXPECTED)
def test_no_false_positive(text, unexpected):
    assert not (unexpected & set(tag_card(card(text))))


# --- gold set on the full card list ---------------------------------------
GOLD = {
    "Foolish Burial": {"mill"},
    "Monster Reborn": {"ss_from_gy"},
    "Pot of Greed": {"draw"},
    "Graceful Charity": {"draw", "discard"},
    "Ash Blossom & Joyous Spring": {"hand_trap", "negate"},
    "Effect Veiler": {"hand_trap", "negate"},
    "Infinite Impermanence": {"hand_trap", "negate"},
    "Called by the Grave": {"banish_removal", "negate"},
    "Raigeki": {"destroy"},
    "Solemn Judgment": {"negate", "destroy"},
    "Polymerization": {"fusion"},
    "Branded Fusion": {"fusion", "summon_lock"},
    "Sangan": {"trig_sent_to_gy", "search"},
    "Mezuki": {"gy_effect", "ss_from_gy"},
    "Tour Guide From the Underworld": {"ss_from_deck", "trig_summoned"},
    "Charge of the Light Brigade": {"mill", "search"},
    "Evenly Matched": {"banish_removal", "hand_trap"},
    "Snake-Eye Ash": {"search", "trig_summoned"},
    "Pot of Prosperity": {"search"},
    "Elemental HERO Stratos": {"search", "trig_summoned", "destroy"},
    "Mathmech Circular": {"mill", "ss_self", "search"},
    "Thunder Dragon": {"search", "self_discard"},
    "Firewall Defenser": {"trig_material", "ss_from_deck", "summon_lock", "gy_effect"},
}

CARDS_PATH = os.environ.get("YGO_CARDS")


@pytest.mark.skipif(not CARDS_PATH, reason="set YGO_CARDS=/path/to/yaml-yugi/cards.json")
def test_gold_set_on_real_data():
    with open(CARDS_PATH, encoding="utf-8") as f:
        by = {c["name"]["en"]: c for c in json.load(f) if c.get("name", {}).get("en")}
    misses = {}
    for name, gold in GOLD.items():
        got = set(tag_card(by[name]))
        if gold - got:
            misses[name] = sorted(gold - got)
    assert not misses, misses
