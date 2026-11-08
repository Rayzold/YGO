"""Rule-based mechanic tagger for Yu-Gi-Oh! cards.

Tags describe what a card DOES (providers, e.g. ``mill``, ``search``) and WHEN it
does something (hooks, e.g. ``trig_sent_to_gy``). The suggestion engine in the
web app pairs providers with hooks to propose combo pieces.

Rules are regexes over the official English card text (PSCT), which is formulaic
enough for this to work well. Accuracy is checked in tests/test_tagger.py.
"""
import re

# ---------------------------------------------------------------------------
# Tag rules. Each rule is (tag, regex). Text is lower-cased and whitespace-
# normalised before matching. Patterns stop at ";" or "." so an effect clause
# does not bleed into the next one.
# ---------------------------------------------------------------------------
C = r"[^.;:]*?"         # lazy "same clause" filler (stops at . ; :)
RULES = [
    # --- What the card DOES (providers) -----------------------------------
    ("search", rf"\badd\b{C}from (?:your )?(?:hand or )?deck{C}to (?:your )?hand"
               rf"|\btake\b{C}from your deck{C}add it to your hand"
               rf"|\badd\b{C}from your deck or gy to your hand"
               rf"|excavate{C}add{C}to your hand"),
    ("mill", rf"\bsend\b{C}from (?:your )?(?:hand or |extra )?deck{C}to (?:the|your) gy"
             rf"|send the top (?:\d+ )?cards? of your deck to the gy"
             rf"|\btake\b{C}from your deck{C}send it to the gy"),
    ("discard", r"\bdiscard\b(?! this card)"),
    ("self_discard", r"discard this card|send this card from your hand to the gy"),
    ("ss_from_deck", rf"special summons?\b{C}from (?:your )?(?:hand(?:,| or) )?deck"),
    ("ss_from_hand", rf"special summons?\b{C}from your hand"),
    ("ss_from_gy", rf"special summons?\b{C}from (?:your |either player's |your opponent's )?(?:hand or )?gy"
                   rf"|in (?:your|either|either player's|your opponent's) gy{C};{C}special summon (?:it|that|them)"),
    ("ss_from_banished", rf"special summon{C}(?:of your )?banished"
                         rf"|banished{C};{C}special summon (?:it|that)"),
    ("ss_self", r"special summon this card"),
    ("gy_to_hand", rf"\badd\b{C}from (?:your )?gy to (?:your )?hand"
                   rf"|in your gy{C};{C}add (?:it|that|them|those)(?: targets?)? to your hand"),
    ("draw", r"\bdraws? (?:\d+|one|two|a|the same number of) cards?\b|\bdraw 1\b"),
    ("fusion", r"fusion summon"),
    ("ritual", r"ritual summon"),
    ("negate", r"\bnegat(?:e|es|ed)\b"),
    ("destroy", r"\bdestroy\b(?! this card)"),
    ("banish_removal", rf"\bbanish\b(?! this card){C}(?:your opponent|opponent controls|on the field|opponent's gy|in their gy)"
                       rf"|(?:opponent's gy|opponent controls|on the field){C};{C}banish (?:it|that|them)"
                       rf"|opponent banish"),
    ("bounce", rf"\breturn\b(?! (?:this card|it) to the hand){C}to the hand"
               rf"|(?:opponent controls|on the field){C};{C}return (?:it|that|them|those){C}to the hand|\bshuffle\b{C}(?:opponent|on the field){C}into the deck"),
    ("summon_lock", rf"you cannot (?:normal or )?(?:special )?summon{C}except"),
    # --- WHEN the card does something (hooks / consumers) ----------------
    ("trig_sent_to_gy", r"(?:if|when) this (?:face-up )?card(?: [a-z' -]+?)? is (?:sent|discarded)(?: [a-z ,']+?)? to (?:the|your) gy"
                        r"|if this card in your possession is sent to (?:your )?gy"
                        r"|when this card is sent to the gy"),
    ("trig_sent_from_hand_deck", r"if this card is sent from (?:your )?(?:the )?(?:hand|deck)(?: or (?:the )?(?:hand|deck|field))? to the gy"
                                 r"|if this card is discarded"),
    ("trig_summoned", r"(?:if|when) this card is (?:(?:normal|special|flip|tribute|fusion|synchro|xyz|link|ritual)(?: or (?:normal|special|flip))? )?summoned"),
    ("trig_banished", r"if this card is banished"),
    ("trig_destroyed", r"(?:if|when) this (?:face-up )?card(?: [a-z' -]+?)? is destroyed"),
    ("trig_material", r"if this card is (?:sent to the gy |banished )?as (?:a )?(?:fusion|synchro|xyz|link|ritual)?(?: )?material"
                      r"|if this card is (?:used|detached) as"),
    ("gy_effect", r"banish this card from (?:your |the )?(?:hand or )?gy"
                  r"|(?:if|while) this card is in (?:your |the )?gy"
                  r"|special summon this card from your gy"),
]
RULES = [(t, re.compile(p)) for t, p in RULES]

HAND_TRAP_COST = re.compile(
    r"discard this card|send this card from your hand to the gy|banish this card from your hand"
    r"|reveal this card in your hand|special summon this card from your hand"
)
QUICK = re.compile(r"\(quick effect\)|during (?:either player's|your opponent's) turn|when your opponent")
ACT_FROM_HAND = re.compile(r"activate this card from your hand")
OPT = re.compile(r"you can only (?:use|activate|special summon)[^.]*?once per turn")
QUOTED = re.compile(r'"([^"]+)"')


def norm(s: str) -> str:
    s = (s or "").lower().replace("’", "'")
    s = re.sub(r"\bgraveyards?\b", "gy", s)
    return re.sub(r"\s+", " ", s)


# "Special Summon 1 X ..., but negate its effects" is a drawback, not an interruption.
SELF_NEGATE = re.compile(r"(?:but|with|and) (?:negate (?:its|their) effects|(?:its|their) effects negated)")


def tag_card(card: dict) -> list:
    text = norm(card.get("text", {}).get("en"))
    pend = norm((card.get("pendulum_effect") or {}).get("en"))
    full = f"{text} {pend}".strip()
    full = re.sub(r'"[^"]*"', '"x"', full)  # names like "F.A." must not break clause splitting
    tags = {t for t, rx in RULES if rx.search(full)}
    if "negate" in tags and not re.search(r"\bnegat(?:e|es|ed)\b", SELF_NEGATE.sub("", full)):
        tags.discard("negate")

    is_monster = card.get("card_type") == "Monster"
    if is_monster and QUICK.search(text) and HAND_TRAP_COST.search(text):
        tags.add("hand_trap")
    if ACT_FROM_HAND.search(text):
        tags.add("hand_trap")
    if "trig_sent_from_hand_deck" in tags:
        tags.add("trig_sent_to_gy")
    if OPT.search(text):
        tags.add("hard_opt")
    return sorted(tags)
