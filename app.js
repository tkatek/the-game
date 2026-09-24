/* Word Bloom — game logic for the wb-* markup in index.html.
 * Rules and scoring follow the task spec exactly (verified by tools/verify.mjs):
 * valid word = 4+ letters, contains the center letter, only the 7 flower letters
 * (repeats allowed), in the approved list, not already submitted.
 * Points: 4→2, 5→4, 6→6, 7→12, 8+→12+3 per letter beyond 7, +5 per occurrence
 * of the bonus letter, +7 for a pangram. 12 accepted words finish the game. */
(() => {
  'use strict';

  const { PUZZLES, PROFANITY, FALLBACK_DICTIONARY } = window.WB_DATA;
  const MAX_WORD = 24;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $('#activity');
  const el = {
    flower: $('#flower'),
    flowerStage: $('.wb-flower-stage'),
    input: $('#current-word'),
    form: $('#word-form'),
    feedback: $('#feedback'),
    feedbackIcon: $('.wb-feedback-icon'),
    feedbackTitle: $('#feedback-title'),
    feedbackDetail: $('#feedback-detail'),
    submit: $('#btn-submit'),
    delete: $('#btn-delete'),
    clear: $('#btn-clear'),
    shuffle: $('#btn-shuffle'),
    results: $('#btn-results'),
    score: $('#score'),
    progressTrack: $('.wb-progress-track'),
    progressFill: $('#progress-fill'),
    wordList: $('#word-list'),
    wordListEmpty: $('#word-list-empty'),
    wordbank: $('.wb-wordbank'),
    usedLetters: $('#used-letters'),
    dictionaryNote: $('#dictionary-note'),
    saveStatus: $('#save-status'),
    confetti: $('.wb-confetti'),
    dlgHelp: $('#instructions'),
    helpBtn: $('.wb-help-row .wb-help'),
    dlgFinish: $('#finish-dialog'),
    finishScore: $('#finish-score'),
    finishPangrams: $('#finish-pangrams'),
    finishBonus: $('#finish-bonus'),
    finishBest: $('#finish-best'),
    playAgain: $('#btn-play-again')
  };

  /* ---------- Icons ---------- */
  const svg = inner =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    sparkle: svg('<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>'),
    bulb: svg('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.75.55 1.1 1.35 1.2 2.2h4.8c.1-.85.45-1.65 1.2-2.2A6 6 0 0 0 12 3z"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.2c-.8.45-1.2 1-1.2 1.9"/><path d="M12 16.6h.01"/>'),
    'arrow-right': svg('<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>'),
    backspace: svg('<path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>'),
    trash: svg('<path d="M4 7h16"/><path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6.5 7l.7 11.6A1.5 1.5 0 0 0 8.7 20h6.6a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v5M14 11v5"/>'),
    trophy: svg('<path d="M7 4h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 5H4.5A2.5 2.5 0 0 0 7 8M17 5h2.5A2.5 2.5 0 0 1 17 8"/><path d="M12 13.5V16M8.5 20h7M9.5 16h5a1 1 0 0 1 1 1v3h-7v-3a1 1 0 0 1 1-1z"/>'),
    close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
    refresh: svg('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.3h-4.3"/>'),
    moon: svg('<path d="M20 13.6A8 8 0 1 1 10.4 4 6.4 6.4 0 0 0 20 13.6z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
    'sound-on': svg('<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z"/><path d="M15.3 9a4.2 4.2 0 0 1 0 6M18 6.6a8 8 0 0 1 0 10.8"/>'),
    'sound-off': svg('<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>')
  };
  const setIcon = (span, name) => { if (span) span.innerHTML = ICONS[name] || ''; };
  const iconSpan = (btn) => $('span[data-icon]', btn);
  $$('[data-icon]').forEach(span => setIcon(span, span.dataset.icon));

  /* ---------- State ---------- */
  let puzzleIndex = 0;
  let puzzle = PUZZLES[puzzleIndex];
  /* The bonus letter starts as the puzzle's default and can change on shuffle —
   * the center letter never does. */
  let bonusLetter = puzzle.bonus;
  let allowed = new Set();
  let outerOrder = [];
  let outerButtons = [];
  let currentWord = '';
  const submitted = new Set();
  const accepted = []; // { word, points, pangram, bonusPts }
  let totalScore = 0;
  let bonusPointsTotal = 0;
  let dictionary = null;
  let ready = false;
  let finished = false;
  let feedbackTimer = 0;

  /* ---------- Scoring & validation (spec-exact, mirrors tools/verify.mjs) ---------- */
  const baseScore = len =>
    len === 4 ? 2 : len === 5 ? 4 : len === 6 ? 6 : len === 7 ? 12 :
    len >= 8 ? 12 + 3 * (len - 7) : 0;
  const isPangram = word => {
    const W = word.toUpperCase();
    return [puzzle.center, ...puzzle.outer].every(ch => W.includes(ch));
  };
  const scoreWord = word => {
    const W = word.toUpperCase();
    const base = baseScore(W.length);
    const bonusPts = [...W].filter(ch => ch === bonusLetter).length * 5;
    const pangramBonus = isPangram(W) ? 7 : 0;
    return { base, bonusPts, pangramBonus, total: base + bonusPts + pangramBonus };
  };
  function validate(word) {
    const W = word.toUpperCase();
    if (W.length < 4) return 'Too short';
    if (!W.includes(puzzle.center)) return 'Include the center letter';
    for (const ch of W) if (!allowed.has(ch)) return 'Use only the 7 given letters';
    if (submitted.has(W)) return 'Already submitted';
    if (!dictionary.has(word.toLowerCase())) return 'Word not found';
    return null;
  }

  /* ---------- Sound (tiny WebAudio blips, off by default) ---------- */
  let audioCtx = null;
  let soundOn = false;
  const tone = (freq, at, dur, type = 'sine', vol = 0.11) => {
    const t = audioCtx.currentTime + at;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  };
  const play = name => {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (name === 'tap') tone(560, 0, 0.07);
      else if (name === 'error') tone(150, 0, 0.16, 'square', 0.06);
      else if (name === 'success') { tone(523, 0, 0.12); tone(784, 0.09, 0.16); }
      else if (name === 'pangram') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.15));
      else if (name === 'finish') [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle'));
    } catch (_) { /* audio unavailable — stay silent */ }
  };

  /* ---------- Flower ---------- */
  const petalPos = i => {
    const a = (-90 + i * 60) * Math.PI / 180;
    return { x: 50 + 26.5 * Math.cos(a), y: 50 + 26.5 * Math.sin(a), r: i * 60 };
  };
  const placeButton = (btn, i) => {
    const { x, y, r } = petalPos(i);
    btn.style.setProperty('--x', x.toFixed(2) + '%');
    btn.style.setProperty('--y', y.toFixed(2) + '%');
    btn.style.setProperty('--r', r + 'deg');
  };
  function renderFlower() {
    el.flower.innerHTML = '';
    outerButtons = [];
    const center = document.createElement('button');
    center.type = 'button';
    center.className = 'wb-petal is-center';
    center.dataset.letter = puzzle.center;
    center.setAttribute('aria-label', 'Center letter ' + puzzle.center);
    center.innerHTML = `<span class="wb-petal-face"><span class="wb-petal-letter">${puzzle.center}</span></span>`;
    center.addEventListener('click', () => appendLetter(puzzle.center));
    el.flower.appendChild(center);

    outerOrder.forEach((letter, i) => {
      const isBonus = letter === bonusLetter;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wb-petal' + (isBonus ? ' is-bonus' : '');
      btn.dataset.letter = letter;
      btn.setAttribute('aria-label', (isBonus ? 'Bonus letter ' : 'Letter ') + letter);
      btn.innerHTML =
        `<span class="wb-petal-face"><span class="wb-petal-letter">${letter}</span></span>` +
        (isBonus ? '<span class="wb-bonus-star" aria-hidden="true">★</span>' : '');
      btn.addEventListener('click', () => appendLetter(letter));
      placeButton(btn, i);
      el.flower.appendChild(btn);
      outerButtons.push(btn);
    });
  }
  /* Keep every bonus-letter surface in sync: the gold petal, the stat pill and
   * the used-letter chips all follow the runtime bonus letter. */
  function updateBonusUI() {
    $('[data-bind="bonus"]').textContent = bonusLetter;
    outerButtons.forEach(b => b.classList.toggle('is-bonus', b.dataset.letter === bonusLetter));
    [...el.usedLetters.children].forEach(chip => chip.classList.toggle('bonus', chip.dataset.letter === bonusLetter));
  }
  function shuffleOuter() {
    if (!outerButtons.length) return;
    // Permute the six petal POSITIONS (Fisher-Yates); each letter keeps its
    // button and glides to a new spot. The letter set and center letter never
    // change — and the bonus letter moves to a different outer letter.
    const n = outerButtons.length;
    const perm = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (perm.every((v, i) => v === i)) perm.unshift(perm.pop()); // always move something
    const others = outerOrder.filter(l => l !== bonusLetter);
    bonusLetter = others[Math.floor(Math.random() * others.length)] || bonusLetter;
    updateBonusUI();
    outerButtons.forEach((btn, i) => {
      btn.style.transitionDelay = (i * 45) + 'ms'; // staggered wave
      placeButton(btn, perm[i]);
    });
    outerOrder = [];
    outerButtons.forEach((btn, i) => { outerOrder[perm[i]] = btn.dataset.letter; });
    clearTimeout(shuffleOuter._t);
    shuffleOuter._t = setTimeout(() => {
      outerButtons.forEach(btn => { btn.style.transitionDelay = ''; });
    }, 620 + n * 45);
    el.shuffle.classList.add('is-shuffling');
    setTimeout(() => el.shuffle.classList.remove('is-shuffling'), 600);
    play('tap');
  }

  /* ---------- Entry ---------- */
  const setWord = word => {
    currentWord = word;
    el.input.value = word;
    updateEntryUI();
    if (el.feedback.dataset.kind === 'error') neutralFeedback();
  };
  function appendLetter(ch) {
    if (finished || currentWord.length >= MAX_WORD) return;
    setWord(currentWord + ch.toUpperCase());
    play('tap');
  }
  const deleteLast = () => { if (currentWord) setWord(currentWord.slice(0, -1)); };
  const clearWord = () => { if (currentWord) setWord(''); };

  function updateEntryUI() {
    const n = currentWord.length;
    $('[data-bind="letter-count"]').textContent = n + (n === 1 ? ' letter' : ' letters');
    el.submit.disabled = finished || n === 0;
    el.delete.disabled = el.clear.disabled = finished || n === 0;
    // used-letter chips: center first, then the outer letters in stable order
    const used = new Set(currentWord);
    [...el.usedLetters.children].forEach(chip => {
      chip.classList.toggle('used', used.has(chip.dataset.letter));
    });
  }
  function buildUsedLetters() {
    el.usedLetters.innerHTML = '';
    [puzzle.center, ...[...puzzle.outer].sort()].forEach(letter => {
      const chip = document.createElement('span');
      chip.className = 'wb-used-letter';
      chip.dataset.letter = letter;
      chip.textContent = letter;
      if (letter === bonusLetter) chip.classList.add('bonus');
      el.usedLetters.appendChild(chip);
    });
  }

  /* ---------- Feedback ---------- */
  function setFeedback(kind, title, detail) {
    clearTimeout(feedbackTimer);
    el.feedback.dataset.kind = kind;
    el.feedbackTitle.textContent = title;
    el.feedbackDetail.textContent = detail;
    setIcon(el.feedbackIcon, kind === 'error' ? 'close' : kind === 'neutral' ? 'bulb' : 'trophy');
  }
  function neutralFeedback() {
    if (accepted.length === 0) setFeedback('neutral', 'Ready when you are.', 'Tap the petals or type a word.');
    else setFeedback('neutral', 'Keep going!', `${accepted.length} of 12 words · ${totalScore} points.`);
  }
  const flashFeedback = (kind, title, detail, ms = 3500) => {
    setFeedback(kind, title, detail);
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(neutralFeedback, ms);
  };

  /* ---------- Stats & word list ---------- */
  function updateStats(pop = false) {
    el.score.textContent = totalScore;
    $$('[data-bind="count"]').forEach(n => n.textContent = accepted.length);
    el.progressFill.style.width = (accepted.length / 12 * 100) + '%';
    el.progressTrack.setAttribute('aria-valuenow', accepted.length);
    // on phones the Accepted words card stays hidden until the first find
    el.wordbank.classList.toggle('has-words', accepted.length > 0);
    if (pop && !reducedMotion) {
      el.score.classList.remove('wb-score-pop');
      void el.score.offsetWidth; // restart the animation
      el.score.classList.add('wb-score-pop');
    }
    el.wordListEmpty.style.display = accepted.length ? 'none' : 'block';
  }
  function renderWordList(latest = -1) {
    el.wordList.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const entry = accepted[i];
      const li = document.createElement('li');
      if (!entry) {
        li.className = 'wb-word-row is-placeholder';
        li.innerHTML = `<span class="wb-word-number">${i + 1}</span><span class="wb-word-placeholder"></span>`;
      } else {
        li.className = 'wb-word-row' + (entry.pangram ? ' is-pangram' : '') + (i === latest ? ' is-new' : '');
        li.innerHTML =
          `<span class="wb-word-number">${i + 1}</span>` +
          `<span class="wb-word-name">${entry.word}</span>` +
          (entry.pangram ? '<span class="wb-word-star" title="Pangram" aria-hidden="true">★</span>' : '') +
          `<span class="wb-word-points">+${entry.points}</span>`;
      }
      el.wordList.appendChild(li);
    }
  }

  /* ---------- Submit ---------- */
  function submit() {
    if (finished || !currentWord) return;
    if (!ready) { flashFeedback('neutral', 'One moment…', 'The word list is still loading.'); return; }
    const W = currentWord.toUpperCase();
    const error = validate(W);
    if (error) {
      play('error');
      setFeedback('error', error,
        error === 'Too short' ? 'Words need at least 4 letters.' :
        error === 'Include the center letter' ? `Every word needs the center letter ${puzzle.center}.` :
        error === 'Already submitted' ? 'You already found this one.' :
        error === 'Word not found' ? "It's not in the approved word list." :
        'Only the letters on the flower can be used.');
      el.input.setAttribute('aria-invalid', 'true');
      if (!reducedMotion) {
        const wrap = $('.wb-input-wrap');
        wrap.classList.remove('wb-shake');
        void wrap.offsetWidth;
        wrap.classList.add('wb-shake');
      }
      return;
    }
    el.input.removeAttribute('aria-invalid');

    const sc = scoreWord(W);
    submitted.add(W);
    accepted.push({ word: W, points: sc.total, pangram: isPangram(W), bonusPts: sc.bonusPts });
    totalScore += sc.total;
    bonusPointsTotal += sc.bonusPts;

    const detailParts = [`${sc.base} base`];
    if (sc.bonusPts) detailParts.push(`+${sc.bonusPts} bonus letter`);
    if (sc.pangramBonus) detailParts.push('+7 pangram');
    if (sc.pangramBonus) {
      play('pangram');
      confetti(18);
      setFeedback('pangram', `${W} — pangram!`, detailParts.join(' · '));
    } else {
      play('success');
      flashFeedback('success', `${W} — ${sc.total} points`, detailParts.join(' · '));
    }
    wordPopup(W, sc);

    setWord('');
    updateStats(true);
    renderWordList(accepted.length - 1);
    if (accepted.length >= 12) finishGame();
  }

  /* ---------- Correct-word popup ---------- */
  const STAR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 1.6l3 6.3 6.9.9-5.1 4.8 1.3 6.8-6.1-3.3-6.1 3.3 1.3-6.8L2.1 8.8l6.9-.9z" fill="#ffd365" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M12 1.6l3 6.3 6.9.9-5.1 4.8 1.3 6.8-6.1-3.3-6.1 3.3 1.3-6.8L2.1 8.8l6.9-.9z" fill="#ffd365" stroke="#c98d1b" stroke-width="1" stroke-linejoin="round"/></svg>';
  function hypeFor(word) {
    if (word.length >= 8) return 'SPECTACULAR!';
    if (word.length >= 7) return 'SUPERB!';
    if (word.length >= 6) return 'AMAZING!';
    if (word.length >= 5) return 'LOVELY!';
    return 'GREAT!';
  }
  function wordPopup(word, sc) {
    if (reducedMotion) return;
    el.flowerStage.querySelectorAll('.wb-reward').forEach(p => p.remove());
    const pop = document.createElement('div');
    pop.className = 'wb-reward' + (sc.pangramBonus ? ' is-pangram' : '');
    pop.innerHTML =
      '<div class="wb-reward-rays" aria-hidden="true"></div>' +
      '<div class="wb-reward-card">' +
        `<div class="wb-reward-star" aria-hidden="true">${STAR_SVG}</div>` +
        `<div class="wb-reward-hype">${sc.pangramBonus ? 'PANGRAM!' : hypeFor(word)}</div>` +
        `<div class="wb-reward-word">${word}</div>` +
        `<div class="wb-reward-pts">${STAR_SVG}<b>+${sc.total}</b></div>` +
      '</div>';
    el.flowerStage.appendChild(pop);
    setTimeout(() => pop.remove(), 2050);
  }

  /* ---------- Finish ---------- */
  function finishGame() {
    finished = true;
    play('finish');
    el.input.disabled = true;
    el.shuffle.disabled = true;
    el.results.hidden = false;
    setFeedback('pangram', 'Twelve words — garden complete!', `Final score ${totalScore} points.`);
    const best = accepted.reduce((a, b) => (b.points > a.points ? b : a), accepted[0]);
    el.finishScore.textContent = totalScore;
    el.finishPangrams.textContent = accepted.filter(a => a.pangram).length;
    el.finishBonus.textContent = '+' + bonusPointsTotal;
    el.finishBest.textContent = `Best find: ${best.word} · ${best.points} points${best.pangram ? ' (pangram ★)' : ''}`;
    confetti(30);
    setTimeout(() => { if (finished) confetti(20); }, 700);
    setTimeout(() => { if (finished) el.dlgFinish.showModal(); }, 800);
  }
  function nextPuzzle() {
    puzzleIndex = (puzzleIndex + 1) % PUZZLES.length;
    puzzle = PUZZLES[puzzleIndex];
    allowed = new Set([puzzle.center, ...puzzle.outer]);
    outerOrder = shuffledOuter();
    currentWord = '';
    submitted.clear();
    accepted.length = 0;
    totalScore = 0;
    bonusPointsTotal = 0;
    finished = false;
    el.dlgFinish.close();
    el.results.hidden = true;
    el.input.disabled = !ready;
    el.input.value = '';
    el.input.removeAttribute('aria-invalid');
    el.shuffle.disabled = !ready;
    $('[data-bind="center"]').textContent = puzzle.center;
    bonusLetter = puzzle.bonus;
    $('[data-bind="bonus"]').textContent = bonusLetter;
    buildUsedLetters();
    renderFlower();
    updateEntryUI();
    updateStats();
    renderWordList();
    neutralFeedback();
    el.input.focus();
  }
  const shuffledOuter = () => {
    const arr = [...puzzle.outer];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* ---------- Pixel-accurate pointer routing ----------
   * Petals have pointer-events:none, so raw clicks can never land on the wrong
   * one. The flower itself resolves which petal TEXTURE is under the pointer
   * (alpha test against the petal image, rotation-aware) and routes taps and
   * the hover highlight there. What you see is what you click. */
  const AMAP = 128;
  let alphaData = null;
  const alphaImg = new Image();
  alphaImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = AMAP;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(alphaImg, 0, 0, AMAP, AMAP);
    try { alphaData = ctx.getImageData(0, 0, AMAP, AMAP).data; } catch (_) { alphaData = null; }
  };
  alphaImg.src = 'assets/petal-purple.webp';

  let hotBtn = null;
  let suppressClick = false;
  function setHot(btn) {
    if (hotBtn === btn) return;
    if (hotBtn) hotBtn.classList.remove('is-hot');
    hotBtn = btn;
    if (hotBtn) hotBtn.classList.add('is-hot');
  }
  function petalUnderPointer(x, y) {
    if (!alphaData) return null;
    let best = null, bestA = 0;
    // the center disc is painted above the petals: a point inside it is its
    const disc = el.flower.querySelector('.wb-petal.is-center');
    if (disc) {
      const r = disc.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) / (r.width / 2);
      if (d <= 0.98) { best = disc; bestA = 9999; }
    }
    for (const btn of outerButtons) {
      const r = btn.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
      const ang = -(parseFloat(btn.style.getPropertyValue('--r')) || 0) * Math.PI / 180;
      const lx = dx * Math.cos(ang) - dy * Math.sin(ang);   // point in the
      const ly = dx * Math.sin(ang) + dy * Math.cos(ang);   // unrotated button
      if (Math.abs(lx) > btn.offsetWidth / 2 || Math.abs(ly) > btn.offsetHeight / 2) continue;
      const u = Math.min(AMAP - 1, Math.max(0, Math.floor((lx / btn.offsetWidth + 0.5) * AMAP)));
      const v = Math.min(AMAP - 1, Math.max(0, Math.floor((ly / btn.offsetHeight + 0.5) * AMAP)));
      const a = alphaData[(v * AMAP + u) * 4 + 3] * (btn.classList.contains('is-bonus') ? 1.03 : 1);
      if (a > bestA) { bestA = a; best = btn; }
    }
    return best;
  }
  el.flower.addEventListener('pointermove', e => {
    if (finished) { setHot(null); return; }
    setHot(petalUnderPointer(e.clientX, e.clientY));
  });
  el.flower.addEventListener('pointerleave', () => setHot(null));
  el.flower.addEventListener('pointerdown', e => {
    if (finished) return;
    suppressClick = true;                      // the native click would land on
    setTimeout(() => { suppressClick = false; }, 80); // the wrong (top) petal
    const btn = petalUnderPointer(e.clientX, e.clientY);
    setHot(btn);
    if (btn) {
      btn.classList.add('is-pressed');
      setTimeout(() => btn.classList.remove('is-pressed'), 150);
      appendLetter(btn.dataset.letter);
    }
  });
  el.flower.addEventListener('click', e => {
    if (suppressClick) { e.stopImmediatePropagation(); suppressClick = false; }
  }, true);

  /* ---------- Confetti ---------- */
  const CONFETTI_COLORS = ['#a571f3', '#ffd365', '#7d46e0', '#8fd7a8', '#ff9db0', '#f4a7c3'];
  function confetti(n) {
    if (reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const piece = document.createElement('i');
      piece.className = 'wb-confetti-piece';
      piece.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      piece.style.setProperty('--color', CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]);
      piece.style.setProperty('--duration', (1.5 + Math.random() * 1.1).toFixed(2) + 's');
      piece.style.setProperty('--delay', (Math.random() * 0.3).toFixed(2) + 's');
      piece.style.setProperty('--drift', (Math.random() * 180 - 90).toFixed(0) + 'px');
      piece.style.setProperty('--spin', (300 + Math.random() * 420).toFixed(0) + 'deg');
      piece.addEventListener('animationend', () => piece.remove());
      el.confetti.appendChild(piece);
    }
  }

  /* ---------- Theme ---------- */
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } }
  };
  let dark = false;
  function applyTheme() {
    document.body.dataset.theme = dark ? 'dark' : 'light';
    app.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#101624' : '#f2f6fc';
  }
  /* The theme always follows the player's device — no manual override. */
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    dark = e.matches; applyTheme();
  });

  /* ---------- Events ---------- */
  el.form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  el.delete.addEventListener('click', deleteLast);
  el.clear.addEventListener('click', clearWord);
  el.shuffle.addEventListener('click', shuffleOuter);
  el.playAgain.addEventListener('click', nextPuzzle);
  el.results.addEventListener('click', () => el.dlgFinish.showModal());
  $('[data-action="help"]').addEventListener('click', () => el.dlgHelp.showModal());
  [el.dlgHelp, el.dlgFinish].forEach(dlg => {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    $$('[data-close]', dlg).forEach(btn => btn.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('close', () => { if (document.activeElement === document.body) el.input.focus(); });
  });
  /* closing the help dialog returns focus to the ? button that opened it */
  el.dlgHelp.addEventListener('close', () => { if (el.helpBtn) el.helpBtn.focus(); });

  el.input.addEventListener('input', () => {
    // keep only allowed letters, uppercase, capped length
    let out = '';
    for (const ch of el.input.value.toUpperCase()) {
      if (allowed.has(ch) && out.length < MAX_WORD) out += ch;
    }
    setWord(out);
  });
  document.addEventListener('keydown', e => {
    if (el.dlgHelp.open || el.dlgFinish.open) return;
    if (e.target === el.input || e.target.closest('button, a, [role]')) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Backspace') { e.preventDefault(); deleteLast(); }
    else if (/^[a-zA-Z]$/.test(e.key)) {
      const ch = e.key.toUpperCase();
      if (allowed.has(ch)) { e.preventDefault(); appendLetter(ch); }
    }
  });

  /* Subtle 3D tilt on pointer, matching the --wb-tilt hooks in the CSS. */
  if (!reducedMotion && matchMedia('(pointer: fine)').matches) {
    el.flowerStage.addEventListener('pointermove', e => {
      const r = el.flowerStage.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      el.flower.style.setProperty('--wb-tilt-x', (dy * -6).toFixed(2) + 'deg');
      el.flower.style.setProperty('--wb-tilt-y', (dx * 6).toFixed(2) + 'deg');
    });
    el.flowerStage.addEventListener('pointerleave', () => {
      el.flower.style.setProperty('--wb-tilt-x', '0deg');
      el.flower.style.setProperty('--wb-tilt-y', '0deg');
    });
  }

  /* ---------- Dictionary & boot ---------- */
  /* ---------- Dictionary upgrade (instant play -> full list) ----------
   * Re-runnable and idempotent: the watchdog below calls it again if the
   * first attempt hung (recreated webviews can hang early subresource fetches). */
  var dictUpgraded = false;
  function upgradeDictionary() {
    if (dictUpgraded) return Promise.resolve();
    var timeout = new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('dictionary fetch timeout')); }, 8000); });
    var fetchP = fetch(app.dataset.dictionary + String(Date.now())).then(function(res){
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
    return Promise.race([fetchP, timeout]).then(function(json) {
      var set = new Set();
      for (var w of Object.keys(json)) {
        if (w.length >= 4 && !PROFANITY.has(w) && /^[a-z]+$/.test(w)) set.add(w);
      }
      if (set.size < 10000) throw new Error('word list looks wrong');
      dictUpgraded = true;
      dictionary = set;
      el.dictionaryNote.textContent =
        'Words are checked against ' + set.size.toLocaleString('en-US') + ' approved English words. No proper nouns, hyphens, or rude words count.';
    });
  }
  async function boot() {
    if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('wb-embedded');
    /* the theme always follows the player's device (applied pre-paint by the
     * inline script in index.html) */
    dark = matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme();

    allowed = new Set([puzzle.center, ...puzzle.outer]);
    outerOrder = shuffledOuter();
    $('[data-bind="center"]').textContent = puzzle.center;
    $('[data-bind="bonus"]').textContent = puzzle.bonus;
    buildUsedLetters();
    renderFlower();
    updateEntryUI();
    updateStats();
    renderWordList();

    /* Playable instantly: start on the built-in list, then silently upgrade to
     * the full dictionary. On phones the 6.8MB list can take a while — the
     * bloom must never look ready but ignore taps. */
    dictionary = FALLBACK_DICTIONARY;
    ready = true;
    app.setAttribute('aria-busy', 'false');
    el.input.disabled = false;
    el.shuffle.disabled = false;
    updateEntryUI();
    el.dictionaryNote.textContent =
      'Playing with the built-in starter word list — loading the full dictionary…';
    el.saveStatus.textContent = 'Your progress stays on this device.';
    setFeedback('neutral', 'Ready when you are.', 'Tap the petals or type a word.');
    upgradeDictionary(0);
    /* watchdog: if the upgrade is still pending, run it again (idempotent) */
    setTimeout(function check() {
      if (!dictUpgraded) upgradeDictionary(0);
      setTimeout(check, 5000);
    }, 5000);
  }
  boot();

  /* Test hooks (used by browser-based checks) */
  window.__blossom = {
    validate, scoreWord, isPangram, submit, shuffleOuter, nextPuzzle,
    get puzzle() { return puzzle; },
    get outerOrder() { return [...outerOrder]; },
    get bonusLetter() { return bonusLetter; },
    get currentWord() { return currentWord; },
    get accepted() { return [...accepted]; },
    get totalScore() { return totalScore; },
    get finished() { return finished; },
    get dictionarySize() { return dictionary ? dictionary.size : 0; }
  };
})();
