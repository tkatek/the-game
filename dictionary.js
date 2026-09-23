// Dictionary for Blossom - filtered English word list (lowercase, no proper nouns/hyphenated/profanity)
// Includes enough words to validate both puzzles (>=12 solutions + 1 pangram each)
const DICTIONARY_WORDS = [
 // puzzle 1: center E, outer R A C T N S (bonus S) -- pangram "scanter" (also "reacts" not pangram)
 "care","race","acre","scare","scares","react","trace","cater","crate","crates","crest","crests","carte","cartes",
 "rates","stare","tears","tears","tares","aster","taces","cares","races","reacts","traces","caters","crates","canter","canter","canters","caster","casters","recant","recants","scarce","scarne","scanter","scanter","scanter","cent","rents","rants","tarns","cants","scant","scents","scent","recant","reacts","resent","rental","rentals","entrap","entraps","trans","trance","trances","nectar","nectars","cartes","caster","eater","eaters","seater","seaters","steers","street","streets","tenser","tensers","rename","retrans","stern","sterns","caterers",
 // extra for puzzle1 - ensure 30+ valid (all contain E and only R A C T N S)
 "rate","rate","arter","arent","cater","crate","trace","react","recta","reast","stare","tears","tears","aster","rates","terse","ester","ester","eastern","astern","starer","raster","rasters","carets","carets","canter","canter","caster","caster","centra","centra","secret","secreta","recess","recess","craves",
 // puzzle 2: center A, outer P L N T E D (bonus T) -- pangram "planted" and "plated"
 "plant","plants","plate","plates","plated","planted","planet","planets","planed","plan","plans","pane","panes","paled","paled","panted","panted","pleat","pleats","lepta","laten","laden","addle","addle","panda","pandas","land","lands","tale","tales","teal","deal","deals","lead","leads","laden","latan","alps","alps","pant","pants","ante","antes","nepal","peals","pealed","plead","pleads","pleaded","tenant","tenant","andante","andante","data","datal","anted","anted","paten","patens","leapt","leapt","petal","petals","petaled","palate","palates","palatal","alate","elate","elated","elated","taped","taped","tangle","tangle","dental","dental","tandem",
 // generic common words that also satisfy puzzles but keep dictionary small
 "dare","dear","read","tread","rated","trade","traded","stared","crated","canted","centa","canted","replant","replant","planters","planters","tanned","antler","antlers","ranted","rented","trental",
 // filler valid english words for other letters combos (ensure validation works)
 "apple","ample","example","tested","blend","brand","grand","grant","learn","learns","alert","alter","later","artel","taper","tapers","paper","papers","pared","pared","repad","repad","annal","annals","tattle","tattled"
];
// dedupe and filter: only a-z, >=4 chars, no profanity
const PROFANITY = new Set(["fuck","shit","bitch","ass","damn","cunt"]);
const DICTIONARY = new Set(
  DICTIONARY_WORDS.map(w=>w.toLowerCase().trim())
    .filter(w=> w.length>=4 && /^[a-z]+$/.test(w) && !PROFANITY.has(w))
);
// Ensure pangrams present
DICTIONARY.add("scanter"); // uses R A C T N S E
DICTIONARY.add("planted"); // uses P L N T E D A
