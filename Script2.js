/******** CONFIG ********/
const TOTAL = 60;
const DIAGRAM_COUNT = 20;
const MCQ_COUNT = 40;

const DIAGRAM_JSON = 'mulesoft_dev1_2000_diagram_exam_questions.json';
const MCQ_JSON = 'mulesoft_dev1_2000_objective_mapped_questions.json';

/******** STATE ********/
let DIAGRAM_POOL = [];
let MCQ_POOL = [];
let questions = [];
let answers = [];
let review = new Set();
let revealed = new Set();
let current = 0;
let submitted = false;

/******** DOM ********/
const qIndexEl = document.getElementById('qIndex');
const questionTextEl = document.getElementById('questionText');
const diagramEl = document.getElementById('diagram');
const optionsEl = document.getElementById('options');
const paletteEl = document.getElementById('palette');
const resultEl = document.getElementById('result');

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

/******** JSON INTEGRITY CHECK ********/
function validateQuestions(arr,type){
  const ids=new Set();
  arr.forEach((q,idx)=>{
    if(q.id==null) console.warn(type,'missing id at index',idx);
    if(ids.has(q.id)) console.error(type,'duplicate id',q.id);
    ids.add(q.id);

    if(!q.question || !Array.isArray(q.options) || q.options.length<2)
      console.error(type,'invalid structure at id',q.id);

    if(typeof q.answer!=='number' || q.answer<0 || q.answer>=q.options.length)
      console.error(type,'invalid answer index at id',q.id);

    if(!q.explanation)
      console.warn(type,'missing explanation at id',q.id);

    if(q.diagram && (!q.diagram.content))
      console.error(type,'diagram missing content at id',q.id);
  });
}

/******** LOAD DATA ********/
async function loadData(){
  const [d,m] = await Promise.all([
    fetch(DIAGRAM_JSON).then(r=>r.json()),
    fetch(MCQ_JSON).then(r=>r.json())
  ]);

  DIAGRAM_POOL = d;
  MCQ_POOL = m;

  validateQuestions(DIAGRAM_POOL,'DIAGRAM');
  validateQuestions(MCQ_POOL,'MCQ');

  initExam();
}

/******** INIT ********/
function initExam(){
  questions = [
    ...pickRandom(DIAGRAM_POOL,DIAGRAM_COUNT),
    ...pickRandom(MCQ_POOL,MCQ_COUNT)
  ];
  shuffle(questions);
  buildPalette();
  render();
  updatePalette();
}

/******** RENDER ********/
function render(){
  const q=questions[current];
  qIndexEl.textContent=current+1;
  questionTextEl.textContent=q.question;

  diagramEl.innerHTML='';
  if(q.diagram && q.diagram.type==='mermaid'){
    const pre=document.createElement('pre');
    pre.className='mermaid';
    pre.textContent=q.diagram.content;
    diagramEl.appendChild(pre);
    mermaid.init(undefined,pre);
  }

  optionsEl.innerHTML='';
  q.options.forEach((opt,i)=>{
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
    optionsEl.innerHTML+=`<div class="explanation"><b>Explanation:</b> ${q.explanation}</div>`;
  }
}

/******** PALETTE ********/
function buildPalette(){
  paletteEl.innerHTML='';
  questions.forEach((_,i)=>{
    const b=document.createElement('button');
    b.textContent=i+1;
    b.onclick=()=>{current=i;render();updatePalette()};
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

/******** EVENTS ********/
nextBtn.onclick=()=>{
  if(current<TOTAL-1){
    current++;
    render();
    updatePalette();
  } else submitExam();
};

reviewBtn.onclick=()=>{
  review.has(current)?review.delete(current):review.add(current);
  updatePalette();
};

revealBtn.onclick=()=>{
  revealed.add(current);
  render();
};

/******** SUBMIT ********/
function submitExam(){
  submitted=true;
  exam.classList.add('hidden');
  resultEl.classList.remove('hidden');

  const score=answers.reduce((s,a,i)=>s+(a===questions[i].answer),0);

  let html=`<h2>${score/TOTAL>=0.7?'PASS':'FAIL'}</h2><p>${score}/${TOTAL}</p>`;
  questions.forEach((q,i)=>{
    html+=`<div class="explanation"><b>Q${i+1}:</b> ${q.question}`;
    q.options.forEach((o,j)=>{
      if(j===q.answer) html+=`<div class="correct">✔ ${o}</div>`;
      else if(j===answers[i]) html+=`<div class="wrong">✖ ${o}</div>`;
      else html+=`<div>${o}</div>`;
    });
    html+=`<p>${q.explanation}</p></div>`;
  });

  resultEl.innerHTML=html;
}

/******** TIMER ********/
let time=120*60;
setInterval(()=>{
  if(time<=0&&!submitted) submitExam();
  time--;
  timer.textContent=
    `${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`;
  if(time===300) alert('⚠️ 5 minutes remaining!');
},1000);

/******** START ********/
loadData();

