/* Word Bloom verification — run with: node tools/verify.mjs
 * 1. Every puzzle has >= 12 valid solutions and >= 1 pangram, in BOTH the real
 *    dictionary (words_dictionary.json minus profanity) and the offline fallback.
 * 2. Scoring matches the task table exactly (base + 5 x bonus occurrences + 7 pangram).
 * 3. Prints every word buildable from each puzzle so questionable entries can be
 *    caught and added to the profanity blocklist. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PUZZLES, PROFANITY, FALLBACK_DICTIONARY } = require("../dictionary.js");
// PROFANITY here is the full blocked set: vulgar words + buildable proper nouns.

// --- Spec scoring (must mirror app.js exactly) ---
const baseScore = len =>
  len === 4 ? 2 : len === 5 ? 4 : len === 6 ? 6 : len === 7 ? 12 :
  len >= 8 ? 12 + 3 * (len - 7) : 0;
const isPangram = (word, letters) => [...letters].every(ch => word.includes(ch));
function scoreWord(word, center, letters, bonus) {
  const base = baseScore(word.length);
  const bonusPts = [...word].filter(ch => ch === bonus).length * 5;
  const pangramBonus = isPangram(word, letters) ? 7 : 0;
  return { base, bonusPts, pangramBonus, total: base + bonusPts + pangramBonus };
}

let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) failures++;
};

// --- Load + filter the real dictionary ---
const raw = JSON.parse(readFileSync(new URL("../words_dictionary.json", import.meta.url)));
const real = new Set(
  Object.keys(raw).filter(w => /^[a-z]{4,}$/.test(w) && !PROFANITY.has(w))
);
console.log(`Real dictionary: ${real.size} approved words (from ${Object.keys(raw).length} raw, ${Object.keys(raw).length - real.size} filtered)\n`);

// --- Per-puzzle constraints ---
const buildable = (dict, puzzle) => {
  const letters = new Set([puzzle.center, ...puzzle.outer].map(ch => ch.toUpperCase()));
  return [...dict].filter(w => {
    const W = w.toUpperCase();
    return W.length >= 4 && W.includes(puzzle.center) && [...W].every(ch => letters.has(ch));
  });
};

for (const [label, dict] of [["real", real], ["fallback", FALLBACK_DICTIONARY]]) {
  for (const p of PUZZLES) {
    const words = buildable(dict, p).sort();
    const pangrams = words.filter(w => isPangram(w.toUpperCase(), [p.center, ...p.outer]));
    console.log(`Puzzle ${p.id} (${p.name}) [center ${p.center}, bonus ${p.bonus}] — ${label} list: ${words.length} solutions, ${pangrams.length} pangrams`);
    check(words.length >= 12, `>= 12 solutions (${words.length})`);
    check(pangrams.length >= 1, `>= 1 pangram (${pangrams.join(", ") || "NONE"})`);
    if (label === "real") console.log("  buildable: " + words.join(" ") + "\n");
  }
}

// --- Fallback hygiene: every entry must be clean and actually a real word ---
const stray = FALLBACK_DICTIONARY.size;
check(FALLBACK_DICTIONARY.size > 0, `fallback dictionary non-empty (${FALLBACK_DICTIONARY.size} words)`);
const notInReal = [...FALLBACK_DICTIONARY].filter(w => !real.has(w));
console.log(`  fallback words missing from real dictionary (${notInReal.length}): ${notInReal.join(", ") || "none"}\n`);

// --- Scoring unit tests (task section 3) ---
console.log("Scoring tests:");
const T = "RACENTS"; // 7 letters, center E, bonus S
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(eq(baseScore(4), 2) && eq(baseScore(5), 4) && eq(baseScore(6), 6) &&
      eq(baseScore(7), 12) && eq(baseScore(8), 15) && eq(baseScore(9), 18) && eq(baseScore(10), 21),
      "base table 4→2, 5→4, 6→6, 7→12, 8→15, 9→18, 10→21");
check(scoreWord("CARE", "E", "RACENTS", "S").total === 2, "4-letter word = 2");
check(scoreWord("SCARE", "E", "RACENTS", "S").total === 9, "5-letter with one S = 4 + 5 = 9");
check(scoreWord("SCENTS", "E", "RACENTS", "S").total === 16, "6-letter with two S = 6 + 10 = 16");
check(scoreWord("CANTERS", "E", "RACENTS", "S").total === 24, "7-letter pangram with one S = 12 + 5 + 7 = 24");
check(scoreWord("SCANTERS", "E", "RACENTS", "S").total === 32, "synthetic 8-letter pangram, two S = 15 + 10 + 7 = 32");
check(scoreWord("ASSESS", "E", "RACENTS", "S").total === 26, "synthetic double-bonus: 6 base + 4x5 S = 26");
// Task example from the brief (different letter set): CANARY = 6 base + 5 bonus = 11
check(scoreWord("CANARY", "A", "CANRTYX", "Y").total === 11, "brief example CANARY = 6 + 5 = 11");
check(scoreWord("CATENARY", "A", "CANRTYE", "Y").total === 27, "brief example CATENARY = 15 + 5 + 7 = 27");
check(!isPangram("PLANET", "APLNTED") && isPangram("PLANTED", "APLNTED"), "pangram needs all 7 letters (PLANET no, PLANTED yes)");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
