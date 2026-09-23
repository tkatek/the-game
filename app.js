/* Blossom Game Logic - respects Task.pdf rules 2 & 3 */
const PUZZLES = [
  {
    id:1,
    center:"E",
    outer:["R","A","C","T","N","S"], // 6 outer
    bonus:"S", // yellow outline
    name:"SCANTER puzzle"
  },
  {
    id:2,
    center:"A",
    outer:["P","L","N","T","E","D"],
    bonus:"T",
    name:"PLANTED puzzle"
  },
  {
    id:3,
    center:"T",
    outer:["R","A","C","E","N","S"], // same set as puzzle1 but rotated center for variety
    bonus:"R",
    name:"CANTERS puzzle"
  }
];

// Elements
const elFlower = document.getElementById("flower");
const elCurrent = document.getElementById("current-word");
const elFeedback = document.getElementById("feedback");
const elProgress = document.getElementById("progress");
const elScore = document.getElementById("score");
const elList = document.getElementById("word-list");
const elListEmpty = document.getElementById("word-list-empty");
const elOverlay = document.getElementById("finish-overlay");
const elFinishScore = document.getElementById("finish-score");
const elFinishDetail = document.getElementById("finish-detail");
const dlg = document.getElementById("instructions");

let puzzleIndex = 0;
let puzzle = PUZZLES[puzzleIndex];
let outerOrder = [...puzzle.outer]; // shuffled order
let currentWord = "";
let submitted = new Set();
let totalScore = 0;
let accepted = []; // {word, score, pangram, bonusCount}

function allLetters(){
  return [puzzle.center, ...puzzle.outer].map(l=>l.toUpperCase());
}
function allowedSet(){
  return new Set(allLetters());
}
function isPangram(word){
  const set = allowedSet();
  const w = new Set(word.toUpperCase().split(""));
  for(const ch of set){ if(!w.has(ch)) return false; }
  return true;
}
function baseScore(len){
  if(len===4) return 2;
  if(len===5) return 4;
  if(len===6) return 6;
  if(len===7) return 12;
  if(len>=8) return 12 + 3*(len-7);
  return 0;
}
function scoreWord(word){
  const base = baseScore(word.length);
  const bonusCount = [...word.toUpperCase()].filter(ch=> ch===puzzle.bonus).length;
  const bonusPts = bonusCount * 5;
  const pangramBonus = isPangram(word) ? 7 : 0;
  return { base, bonusCount, bonusPts, pangramBonus, total: base + bonusPts + pangramBonus };
}

// Flower rendering - 6 petals around center
function renderFlower(){
  elFlower.innerHTML = "";
  // center
  const centerBtn = document.createElement("button");
  centerBtn.className = "petal center";
  centerBtn.textContent = puzzle.center;
  centerBtn.dataset.letter = puzzle.center;
  centerBtn.setAttribute("aria-label","Center letter "+puzzle.center);
  centerBtn.addEventListener("click", ()=> appendLetter(puzzle.center));
  elFlower.appendChild(centerBtn);

  // outer petals positioned in circle
  const radius = 96; // px distance from center
  // adapt radius for small screens via CSS variable? keep JS radius and scale with CSS clamp - use % but JS fixed is ok
  // compute positions using angle
  outerOrder.forEach((letter, idx)=>{
    const angleDeg = -90 + idx * 60; // start top
    const angleRad = angleDeg * Math.PI/180;
    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;
    const btn = document.createElement("button");
    btn.className = "petal" + (letter===puzzle.bonus ? " bonus" : "");
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.style.left = `calc(50% + ${x}px - 41px)`;
    btn.style.top  = `calc(50% + ${y}px - 41px)`;
    // responsive adjustment: on wider flower radius bigger via media query - keep JS dynamic? use CSS transform: we set via left/top calc
    btn.setAttribute("aria-label", (letter===puzzle.bonus ? "Bonus " : "") + "Letter "+letter);
    btn.addEventListener("click", ()=> appendLetter(letter));
    elFlower.appendChild(btn);
  });
  // responsive radius tweak for desktop - if viewport >=681 use larger radius
  if(window.innerWidth >= 681){
    // reposition with larger radius 112
    const r2 = 112;
    [...elFlower.querySelectorAll(".petal:not(.center)")].forEach((btn,i)=>{
      const angleDeg = -90 + i * 60;
      const angleRad = angleDeg * Math.PI/180;
      const x = Math.cos(angleRad)*r2;
      const y = Math.sin(angleRad)*r2;
      btn.style.left = `calc(50% + ${x}px - 41px)`;
      btn.style.top  = `calc(50% + ${y}px - 41px)`;
    });
  }
}

function appendLetter(ch){
  if(accepted.length>=12) return;
  currentWord += ch.toUpperCase();
  updateCurrentDisplay();
  setFeedback("", false);
}
function updateCurrentDisplay(){
  elCurrent.textContent = currentWord;
}
function setFeedback(msg, isSuccess=false){
  elFeedback.textContent = msg;
  elFeedback.className = "feedback" + (isSuccess? " success":"");
  if(msg){
    clearTimeout(setFeedback._t);
    setFeedback._t = setTimeout(()=>{ elFeedback.textContent=""; elFeedback.className="feedback"; }, 2200);
  }
}
function updateInfo(){
  elProgress.textContent = `${accepted.length}/12 words`;
  elScore.textContent = `Score: ${totalScore}`;
  // word list
  elList.innerHTML="";
  accepted.forEach(({word,score,pangram})=>{
    const li=document.createElement("li");
    if(pangram) li.classList.add("pangram");
    li.innerHTML = `<span>${word}</span><span class="pts">${score}${pangram? ' ★':''}</span>`;
    elList.appendChild(li);
  });
  elListEmpty.style.display = accepted.length? "none":"block";
}

function validate(word){
  const w = word.toUpperCase();
  const lower = word.toLowerCase();
  if(w.length < 4) return "Too short";
  if(!w.includes(puzzle.center)) return "Include the center letter";
  const allowed = allowedSet();
  for(const ch of w){ if(!allowed.has(ch)) return "Use only the 7 given letters"; }
  if(submitted.has(lower)) return "Already submitted";
  if(!DICTIONARY.has(lower)) return "Word not found";
  return null;
}

function submit(){
  if(!currentWord) { setFeedback("Too short"); return; }
  const err = validate(currentWord);
  if(err){
    setFeedback(err, false);
    // shake animation? simple
    elCurrent.animate([{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(0)"}],{duration:220});
    return;
  }
  const sc = scoreWord(currentWord);
  const lower = currentWord.toLowerCase();
  submitted.add(lower);
  accepted.push({word: currentWord, score: sc.total, pangram: isPangram(currentWord), bonusCount: sc.bonusCount});
  totalScore += sc.total;
  let msg = `+${sc.total} points`;
  if(sc.pangramBonus) msg += " (pangram +7)";
  if(sc.bonusCount) msg += ` (bonus ×${sc.bonusCount})`;
  setFeedback(msg, true);
  currentWord="";
  updateCurrentDisplay();
  updateInfo();
  if(accepted.length>=12){
    finishGame();
  }
}
function finishGame(){
  elFinishScore.textContent = `You scored ${totalScore} points`;
  elFinishDetail.textContent = `Found 12/12 words • ${accepted.filter(a=>a.pangram).length} pangram(s)`;
  elOverlay.hidden=false;
}
function resetGame(nextPuzzle=true){
  if(nextPuzzle){
    puzzleIndex = (puzzleIndex+1)% PUZZLES.length;
    puzzle = PUZZLES[puzzleIndex];
    outerOrder = [...puzzle.outer];
  }
  currentWord="";
  submitted.clear();
  accepted=[];
  totalScore=0;
  elOverlay.hidden=true;
  updateCurrentDisplay();
  updateInfo();
  setFeedback("");
  renderFlower();
}
function shuffleOuter(){
  // Fisher-Yates only outer
  for(let i=outerOrder.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [outerOrder[i], outerOrder[j]]=[outerOrder[j], outerOrder[i]];
  }
  renderFlower();
}
function deleteLast(){
  currentWord = currentWord.slice(0,-1);
  updateCurrentDisplay();
}
function clearWord(){
  currentWord="";
  updateCurrentDisplay();
}

// Events
document.getElementById("btn-submit").addEventListener("click", submit);
document.getElementById("btn-delete").addEventListener("click", deleteLast);
document.getElementById("btn-clear").addEventListener("click", clearWord);
document.getElementById("btn-shuffle").addEventListener("click", shuffleOuter);
document.getElementById("btn-play-again").addEventListener("click", ()=> resetGame(true));
document.getElementById("btn-instructions").addEventListener("click", ()=> dlg.showModal());
dlg.addEventListener("click", (e)=>{ if(e.target===dlg) dlg.close(); });

// Keyboard support
document.addEventListener("keydown", (e)=>{
  if(elOverlay.hidden===false) return;
  if(e.key==="Enter"){ e.preventDefault(); submit(); }
  else if(e.key==="Backspace"){ e.preventDefault(); deleteLast(); }
  else if(e.key==="Escape"){ clearWord(); }
  else if(/^[a-zA-Z]$/.test(e.key)){
    const ch = e.key.toUpperCase();
    if(allowedSet().has(ch)){
      e.preventDefault();
      appendLetter(ch);
    }
  }
});

// Handle resize for flower radius
window.addEventListener("resize", renderFlower);

// Init
renderFlower();
updateInfo();
updateCurrentDisplay();

// Expose for testing
window.__blossom = { validate, scoreWord, isPangram, get puzzle(){return puzzle}, get outerOrder(){return outerOrder}, DICTIONARY, PUZZLES };
