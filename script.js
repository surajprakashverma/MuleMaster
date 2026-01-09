
/******** CONFIG ********/
const TOTAL = 60;
const CODE_JSON = 'code.json';
const NOCODE_JSON = 'nocode.json';

/******** STATE ********/
let CODE_POOL = [];
let NOCODE_POOL = [];
let questions = [];
let answers = [];
let review = new Set();
let revealed = new Set();
let current = 0;
let submitted = false;

/******** DOM ********/
const qIndexEl = document.getElementById('qIndex');
const questionTextEl = document.getElementById('questionText');
const codeBlock = document.getElementById('codeBlock');
const diagramEl = document.getElementById('diagram');
const optionsEl = document.getElementById('options');
const paletteEl = document.getElementById('palette');
const resultEl = document.getElementById('result');
const exam = document.getElementById('exam');
const nextBtn = document.getElementById('nextBtn');
const reviewBtn = document.getElementById('reviewBtn');
const revealBtn = document.getElementById('revealBtn');
const timer = document.getElementById('timer');
const welcomeOverlay = document.getElementById('welcomeOverlay');
const startCountEl = document.getElementById('startCount');
const startNowBtn = document.getElementById('startNow');
const reviewPanel = document.getElementById('reviewPanel');
const paletteWrap = document.querySelector('.palette');

/******** UTILS ********/
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}
function pickRandom(arr,n){
  return arr.slice().sort(()=>Math.random()-0.5).slice(0,n);
}
function setPaletteVisible(show){
  if(!paletteWrap) return;
  paletteWrap.classList.toggle('hidden', !show);
}
function decodeHtml(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

/******** NORMALIZE QUESTIONS ********/
function normalizeQuestion(q) {
  // Convert options object to array, preserving order A/B/C/D
  if (q.options && !Array.isArray(q.options)) {
    const keys = Object.keys(q.options).sort(); // ["A", "B", "C", "D"]
    q.optionsArray = keys.map(k => q.options[k]);
    q.answer = keys.indexOf(q.correctAnswer);
  } else if (Array.isArray(q.options)) {
    q.optionsArray = q.options;
    if (typeof q.correctAnswer === 'string') {
      const idx = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(q.correctAnswer);
      q.answer = idx >= 0 ? idx : 0;
    } else {
      q.answer = q.correctAnswer;
    }
  }
  return q;
}

/******** JSON INTEGRITY CHECK ********/
function validateQuestions(arr,type){
  const ids=new Set();
  arr.forEach((q,idx)=>{
    if(q.id==null) console.warn(type,'missing id at index',idx);
    if(ids.has(q.id)) console.error(type,'duplicate id',q.id);
    ids.add(q.id);

    if(!q.question || !Array.isArray(q.optionsArray) || q.optionsArray.length<2)
      console.error(type,'invalid structure at id',q.id);

    if(typeof q.answer!=='number' || q.answer<0 || q.answer>=q.optionsArray.length)
      console.error(type,'invalid answer index at id',q.id);

    if(!q.explanation)
      console.warn(type,'missing explanation at id',q.id);

    if(q.diagram && (!q.diagram.content))
      console.error(type,'diagram missing content at id',q.id);
  });
}

/******** LOAD DATA ********/
async function loadData(){
  const [c, n] = await Promise.all([
    fetch(CODE_JSON).then(r=>r.json()),
    fetch(NOCODE_JSON).then(r=>r.json())
  ]);
  CODE_POOL = c.map(normalizeQuestion);
  NOCODE_POOL = n.map(normalizeQuestion);
  validateQuestions(CODE_POOL, 'CODE');
  validateQuestions(NOCODE_POOL, 'NOCODE');
  initExam();
}

/******** INIT ********/
function initExam(){
  const half = Math.floor(TOTAL/2);
  const codeQs = pickRandom(CODE_POOL, Math.min(half, CODE_POOL.length));
  const nocodeQs = pickRandom(NOCODE_POOL, Math.min(TOTAL-half, NOCODE_POOL.length));
  questions = [...codeQs, ...nocodeQs];
  shuffle(questions);

  answers = new Array(questions.length).fill(null);
  review = new Set();
  revealed = new Set();
  current = 0;
  submitted = false;

  buildPalette();
  render();
  updatePalette();
  startTimer();
  setPaletteVisible(true);
  updateNextLabel();
}

/******** RENDER ********/
function render(){
  if(!questions || questions.length===0) return;
  const q=questions[current];
  qIndexEl.textContent = `${current+1}`;
  questionTextEl.textContent = q.question || '';

  // Show code block if present
  if (codeBlock) {
    if (q.code) {
      // Use textContent to avoid HTML injection and always show code as text
      const pre = document.createElement('pre');
      pre.className = 'code-block';
      pre.textContent = decodeHtml(q.code);
      codeBlock.innerHTML = '';
      codeBlock.appendChild(pre);
    } else {
      codeBlock.innerHTML = '';
    }
  }

  diagramEl.innerHTML='';
  if(q.diagram && q.diagram.type==='mermaid'){
    const pre=document.createElement('pre');
    pre.className='mermaid';
    pre.textContent=q.diagram.content;
    diagramEl.appendChild(pre);
    if(window.mermaid) mermaid.init(undefined,pre);
  }

  optionsEl.innerHTML='';
  (q.optionsArray||[]).forEach((opt,i)=>{
    const b=document.createElement('button');
    b.textContent=opt;

    if(answers[current]===i) b.classList.add('selected');
    if(revealed.has(current)||submitted){
      if(i===q.answer) b.classList.add('correct');
      else if(i===answers[current]) b.classList.add('wrong');
    }

    b.onclick=()=>{
      if(submitted||revealed.has(current)) return;
      answers[current]=i;
      render();
      updatePalette();
    };
    optionsEl.appendChild(b);
  });

  if(revealed.has(current)||submitted){
    optionsEl.insertAdjacentHTML('beforeend',`<div class="explanation"><b>Explanation:</b> ${
      typeof q.explanation === 'object' ? (q.explanation.correct || '') : (q.explanation || '')
    }</div>`);
  }

  updateNextLabel();
}

/******** PALETTE ********/
function buildPalette(){
  paletteEl.innerHTML='';
  questions.forEach((_,i)=>{
    const b=document.createElement('button');
    b.textContent=i+1;
    b.onclick=()=>{ current=i; render(); updatePalette(); updateNextLabel(); };
    paletteEl.appendChild(b);
  });
}
function updatePalette(){
  [...paletteEl.children].forEach((b,i)=>{
    b.className='';
    if(i===current) b.classList.add('current');
    if(answers[i]!=null) b.classList.add('answered');
    if(review.has(i)) b.classList.add('review');
  });
}
function updateNextLabel(){
  if(!nextBtn) return;
  if(current === questions.length - 1){
    nextBtn.textContent = 'Submit';
  } else {
    nextBtn.textContent = 'Next';
  }
}

/******** EVENTS ********/
nextBtn.onclick=()=>{
  if(current<questions.length-1){
    current++;
    render();
    updatePalette();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    openFormModal();
  }
};
reviewBtn.onclick=()=>{
  review.has(current)?review.delete(current):review.add(current);
  updatePalette();
};
revealBtn.onclick=()=>{
  revealed.add(current);
  render();
};

/******** SUBMIT (IN-PAGE RESULTS) ********/
function submitExam() {
  submitted = true;
  stopTimer();

  const total = questions.length || 1;
  const score = questions.reduce((s, q, i) => s + ((answers[i] === q.answer) ? 1 : 0), 0);
  const elapsedSec = Math.max(0, EXAM_DURATION_SECONDS - (typeof time !== 'undefined' ? time : 0));
  const pct = Math.round((score / total) * 100);
  const answeredCount = answers.filter(a => a != null).length;
  const unansweredCount = total - answeredCount;

  if (resultEl) {
    resultEl.innerHTML = `
      <h2 style="margin-top:0">Your Result</h2>
      <div style="display:flex; gap:20px; flex-wrap:wrap;">
        <div>
          <div style="font-size:2rem; font-weight:700; color:#9fe7ff">${score}/${total}</div>
          <div>Correct</div>
        </div>
        <div>
          <div style="font-size:2rem; font-weight:700; color:#9fe7ff">${pct}%</div>
          <div>Score</div>
        </div>
        <div>
          <div style="font-size:2rem; font-weight:700; color:#9fe7ff">
            ${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2,'0')}
          </div>
          <div>Time taken</div>
        </div>
        <div>
          <div style="font-size:2rem; font-weight:700; color:#9fe7ff">${answeredCount}</div>
          <div>Answered</div>
        </div>
        <div>
          <div style="font-size:2rem; font-weight:700; color:#9fe7ff">${unansweredCount}</div>
          <div>Unanswered</div>
        </div>
      </div>
      <div class="result-actions">
        <button id="reviewAnswersBtn" class="btn-blue">Review Answers</button>
        <button id="retakeBtn" class="btn-green">Retake Test</button>
      </div>
    `;
    if (exam) exam.classList.add('hidden');
    resultEl.classList.remove('hidden');
    setPaletteVisible(false);
    if (reviewPanel) {
      reviewPanel.classList.add('hidden');
      reviewPanel.setAttribute('aria-hidden','true');
    }
    const reviewAnswersBtn = document.getElementById('reviewAnswersBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    if (reviewAnswersBtn) reviewAnswersBtn.onclick = () => { openReviewPanel(); };
    if (retakeBtn) retakeBtn.onclick = () => { retakeTest(); };
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  render();
  updatePalette();
}

/******** REVIEW PANEL ********/
function openReviewPanel(){
  if(!reviewPanel) return;
  setPaletteVisible(false);
  resultEl.classList.add('hidden');
  reviewPanel.classList.remove('hidden');
  reviewPanel.setAttribute('aria-hidden','false');
  reviewPanel.innerHTML = `<div class="review-controls">
    <div><strong>Review Answers</strong> — click a question to open it in the exam view</div>
    <div style="display:flex;gap:8px;">
      <button id="backResultsBtn" class="small">Back to Results</button>
      <button id="backExamBtn" class="small">Back to Exam</button>
    </div>
  </div>
  <div class="review-list" id="reviewList"></div>`;
  const reviewList = document.getElementById('reviewList');
  questions.forEach((q,i)=>{
    const user = answers[i];
    const card = document.createElement('div');
    card.className = 'review-q';
    card.innerHTML = `<h4>Q${i+1}. ${q.question||''}</h4>
      <div class="opts">${(q.optionsArray||[]).map((opt,j)=>{
        const classes = [
          j===q.answer ? 'opt correct' : 'opt',
          j===user ? 'chosen' : ''
        ].join(' ');
        let marker = '';
        if(j===q.answer) marker = ' ✔';
        if(j===user && j!==q.answer) marker += ' ✖';
        return `<div class="${classes}" data-q="${i}" data-opt="${j}">${opt}${marker}</div>`;
      }).join('')}</div>
      <div class="explain"><b>Explanation:</b> ${typeof q.explanation === 'object' ? (q.explanation.correct || '') : (q.explanation || 'No explanation provided.')}</div>`;
    card.onclick = (e)=>{
      reviewPanel.classList.add('hidden');
      reviewPanel.setAttribute('aria-hidden','true');
      if(resultEl) resultEl.classList.add('hidden');
      if(exam) exam.classList.remove('hidden');
      current = i;
      submitted = true;
      setPaletteVisible(true);
      render();
      updatePalette();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    reviewList.appendChild(card);
  });
  const backResultsBtn = document.getElementById('backResultsBtn');
  const backExamBtn = document.getElementById('backExamBtn');
  if(backResultsBtn) backResultsBtn.onclick = ()=>{
    reviewPanel.classList.add('hidden');
    reviewPanel.setAttribute('aria-hidden','true');
    resultEl.classList.remove('hidden');
    setPaletteVisible(false);
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if(backExamBtn) backExamBtn.onclick = ()=>{
    reviewPanel.classList.add('hidden');
    reviewPanel.setAttribute('aria-hidden','true');
    if(exam) exam.classList.remove('hidden');
    submitted = true;
    setPaletteVisible(true);
    render();
    updatePalette();
  };
}

/******** RETAKE ********/
function retakeTest(){
  time = EXAM_DURATION_SECONDS;
  submitted=false;
  answers = [];
  review = new Set();
  revealed = new Set();
  current = 0;
  if (resultEl) resultEl.classList.add('hidden');
  if (reviewPanel) reviewPanel.classList.add('hidden');
  if (exam) exam.classList.remove('hidden');
  setPaletteVisible(true);
  initExam();
  window.scrollTo({top:0,behavior:'smooth'});
}

/******** TIMER (managed) ********/
const EXAM_DURATION_SECONDS = 120 * 60;
let time = EXAM_DURATION_SECONDS;
let timerIntervalId = null;
function startTimer(){
  if(timerIntervalId) return;
  timerIntervalId = setInterval(()=>{
    if(time<=0 && !submitted) submitExam();
    time--;
    if(timer) timer.textContent =
      `${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`;
    if(time===300) alert('⚠️ 5 minutes remaining!');
  },1000);
}
function stopTimer(){
  if(timerIntervalId){
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

/******** WELCOME ********/
function showWelcome(){
  if(!welcomeOverlay) { loadData(); return; }
  welcomeOverlay.classList.remove('hidden');
  welcomeOverlay.setAttribute('aria-hidden','false');
  let sec=5;
  startCountEl.textContent = sec;
  const id = setInterval(()=>{
    sec--;
    startCountEl.textContent = sec;
    if(sec<=0){
      clearInterval(id);
      welcomeOverlay.classList.add('hidden');
      welcomeOverlay.setAttribute('aria-hidden','true');
      loadData();
    }
  },1000);
  if(startNowBtn) startNowBtn.onclick = ()=>{
    clearInterval(id);
    welcomeOverlay.classList.add('hidden');
    welcomeOverlay.setAttribute('aria-hidden','true');
    loadData();
  };
}

/******** START ********/
showWelcome();

/* feedback form URL used by modal / open-in-new-tab link */
const FEEDBACK_FORM_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAO__TP7OglUM0FHTkdJRjc0NkExOVZWQ1lXWDVLQkhRNC4u';

const formModal = document.getElementById('formModal');
const formIframe = document.getElementById('formIframe');
const formOpenNew = document.getElementById('formOpenNew');
const formContinue = document.getElementById('formContinue');
const formClose = document.getElementById('formClose');
const formConfirmed = document.getElementById('formConfirmed');

function openFormModal(){
  if(!formModal){
    window.open(FEEDBACK_FORM_URL, '_blank', 'noopener');
    return;
  }
  if(formContinue) formContinue.disabled = true;
  if(formConfirmed) formConfirmed.checked = false;
  formIframe.src = FEEDBACK_FORM_URL;
  if(formOpenNew) formOpenNew.href = FEEDBACK_FORM_URL;
  formModal.removeAttribute('inert');
  formModal.classList.remove('hidden');
  formModal.setAttribute('aria-hidden','false');
  setTimeout(()=>{
    if(formConfirmed && typeof formConfirmed.focus === 'function') formConfirmed.focus();
    else if(formOpenNew && typeof formOpenNew.focus === 'function') formOpenNew.focus();
    else formModal.focus?.();
  },50);
  if(formConfirmed){
    formConfirmed.onchange = ()=>{
      if(formContinue) formContinue.disabled = !formConfirmed.checked;
    };
  }
}
function closeFormModal(){
  if(!formModal) return;
  const active = document.activeElement;
  if(formModal.contains(active)){
    const safe = (typeof nextBtn !== 'undefined' && nextBtn) || (typeof startNowBtn !== 'undefined' && startNowBtn) || null;
    if(safe && typeof safe.focus === 'function'){
      safe.focus();
    } else {
      document.body.setAttribute('tabindex','-1');
      document.body.focus();
      setTimeout(()=> document.body.removeAttribute('tabindex'), 50);
    }
  }
  formModal.classList.add('hidden');
  formModal.setAttribute('aria-hidden','true');
  formModal.setAttribute('inert','');
  formIframe.src = 'about:blank';
}
if(formOpenNew) formOpenNew.onclick = ()=>{ };
if(formClose) formClose.onclick = ()=>{ closeFormModal(); };
if(formContinue) formContinue.onclick = ()=>{
  if(formConfirmed && !formConfirmed.checked) return;
  closeFormModal();
  submitExam();
};
