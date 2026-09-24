/* Word Bloom shared data: puzzles, profanity blocklist, and an offline fallback word list.
 * Browser: exposes window.WB_DATA. Node (tools/verify.mjs): module.exports.
 * Primary validation uses words_dictionary.json (370k approved English words);
 * the fallback list below only loads if that file cannot be fetched.
 * Every fallback entry is a real, kid-appropriate common word — no proper nouns,
 * no hyphenated forms, no obscure junk. Each puzzle has 12+ solutions and a pangram
 * in BOTH lists (verified by tools/verify.mjs). */
const PUZZLES = [
  { id: 1, center: "E", outer: ["R", "A", "C", "T", "N", "S"], bonus: "S", name: "Nectar" },
  { id: 2, center: "A", outer: ["P", "L", "N", "T", "E", "D"], bonus: "T", name: "Planted" },
  { id: 3, center: "T", outer: ["R", "A", "C", "E", "N", "S"], bonus: "R", name: "Canters" }
];

/* Blocked in addition to whatever the word list contains. The raw dwyl list is
 * a Scrabble-style corpus and includes, in lowercase, both vulgar words and
 * proper nouns buildable from the puzzle letters (e.g. ARSE, ANAL, TENNESSEE,
 * ATLANTA, SATAN). The task forbids foul language and proper nouns, so
 * submissions are checked against this set too. Found by tools/verify.mjs. */
const BLOCKED_WORDS = [
  // profanity / vulgar or clinical terms unsuitable for a kids' activity
  "anal", "anals", "anus", "anuses", "arse", "arsed", "arses", "arsing", "arsehole",
  "ass", "asses", "assed", "assing", "asshole", "assholes", "bastard", "bastards",
  "bitch", "bitches", "bitched", "boob", "boobs", "clit", "clits", "cock", "cocks",
  "crap", "craps", "crapped", "cum", "cums", "cunt", "cunts", "cunting", "damn",
  "damned", "damnit", "dick", "dicks", "dildo", "dildos", "fag", "fags", "faggot",
  "faggots", "fart", "farts", "farted", "fucked", "fucker", "fuckers", "fuck",
  "fucks", "goddamn", "goddamned", "hoe", "hoes", "jackass", "jizz", "jizzed",
  "knob", "knobs", "milf", "nigga", "niggas", "nigger", "niggers", "nipple",
  "nipples", "orgasm", "orgasms", "penis", "penises", "piss", "pissed", "pisses",
  "porn", "porno", "pornos", "prick", "pricks", "pube", "pubes", "puss",
  "pussies", "pussy", "rape", "raped", "raper", "rapes", "rapist", "scrotum",
  "semen", "sex", "sexy", "shag", "shags", "shat", "shit", "shits", "shite",
  "shited", "shitty", "slut", "sluts", "smut", "smutty", "spunk", "testes",
  "testis", "tit", "tits", "tittie", "titties", "titty", "turd", "turds", "twat",
  "twats", "vag", "vagina", "vaginas", "wank", "wanks", "wanked", "whore",
  "whores", "wanker",
  // proper nouns buildable from the puzzle letters (task: no proper nouns)
  "adela", "aenean", "aeneas", "alan", "alden", "ananda", "annette", "antares",
  "ares", "astarte", "astraea", "atlanta", "atlantad", "atlantean", "caesar",
  "cesar", "cesare", "crete", "cretan", "dana", "danaan", "dane", "dante",
  "dantean", "eastre", "edda", "edna", "ellen", "ernest", "ernst", "etna",
  "etnean", "lapland", "leda", "lena", "lenaean", "lenape", "nepal", "saanen",
  "santa", "satan", "saracen", "saracens", "santee", "seneca", "serena",
  "terence", "teresa", "terrance", "terrence", "tennessee", "tennessean",
  "tennesseans"
];

/* Offline fallback — real common words only, grouped by the letter sets they serve.
 * Set A serves puzzles 1 & 3 (letters A C E N R S T); set B serves puzzle 2 (A D E L N P T). */
const FALLBACK_WORDS = [
  // Set A — center E (puzzle 1) or T (puzzle 3); pangrams: NECTARS, CANTERS, RECANTS
  "care", "race", "acre", "scare", "scares", "react", "reacts", "trace", "traces",
  "cater", "caters", "crate", "crates", "crest", "crests", "rate", "rates",
  "stare", "stares", "tears", "tares", "aster", "cares", "races", "canter",
  "canters", "caster", "casters", "recant", "recants", "scarce", "rents", "scent",
  "scents", "resent", "rental", "rentals", "trance", "trances", "nectar",
  "nectars", "eater", "eaters", "seater", "seaters", "steers", "street",
  "streets", "tenser", "stern", "sterns", "terse", "ester", "eastern", "astern",
  "starer", "raster", "rasters", "carets", "centra", "secret", "recess",
  "caterers", "earns", "nears", "saner", "senate", "sneer", "sneers", "erase",
  "tenses", "teases", "teaser", "teasers", "caress", "caresses", "enact",
  "enacts", "cranes", "crescent", "secant", "secants", "terrace", "terraces",
  "seer", "seers", "sate", "sates", "teas",
  "seat", "seats", "neat", "near", "nears", "earn", "earns", "east", "sent",
  "nets", "tens", "arcs", "rant", "rants", "tear", "ears", "eras", "ants",
  // Set B — center A (puzzle 2); pangram: PLANTED
  "plant", "plants", "plate", "plates", "plated", "planted", "planet", "planets",
  "planed", "plans", "pane", "panes", "paled", "panted", "pleat", "pleats",
  "laden", "land", "lands", "tale", "tales", "teal", "deal", "deals", "lead",
  "leads", "leapt", "petal", "petals", "petaled", "palate", "palates", "elate",
  "elated", "taped", "dental", "tenant", "andante", "plead", "pleads",
  "pleaded", "tanned", "data", "paten", "panel", "panels", "penal", "pedal",
  "pedals", "pedaled", "paddle", "paddled", "paddles", "addle", "addled",
  "addles", "leant", "leaned", "platen", "pennant", "patted", "platted",
  "pedant", "pendant", "tepal", "delta", "dealt", "leaden", "palatal",
  "ante", "antes", "pant", "pants", "pale", "pales", "leap", "leaps", "plea",
  "pleas", "lapel", "nape", "napes", "apple", "appal", "appalled"
];

const PROFANITY = new Set(BLOCKED_WORDS);
const FALLBACK_DICTIONARY = new Set(
  FALLBACK_WORDS.filter(w => /^[a-z]{4,}$/.test(w) && !PROFANITY.has(w))
);

const WB_DATA = { PUZZLES, PROFANITY, FALLBACK_DICTIONARY };
if (typeof window !== "undefined") window.WB_DATA = WB_DATA;
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PUZZLES, PROFANITY, FALLBACK_DICTIONARY, FALLBACK_WORDS };
}
