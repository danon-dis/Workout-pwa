// App logic for the workout PWA
// Data model: session object saved to localStorage under 'workout_sessions' (array)
// We'll build the session from the user's program with the recommended tweaks included.

const defaultProgram = {
  warmup: [
    {desc:'Tête 30s gauche droite 30s demi-cercle', type:'timed', duration:90},
    {desc:'Épaules rotation arrière 20s', type:'timed', duration:20},
    {desc:'Épaules rotation avant 20s', type:'timed', duration:20},
    {desc:'Grand rond 15 arrière', type:'reps', reps:15},
    {desc:'Grand rond 15 avant', type:'reps', reps:15},
    {desc:'Élastique devant/derrière rotation 10 fois lentement', type:'reps', reps:10},
    {desc:'Rotations poignets', type:'reps', reps:10},
    {desc:'Rotation coude', type:'reps', reps:10},
    {desc:'Rotations buste 15x', type:'reps', reps:15},
    {desc:'Déroule colonne vertébrale 5x', type:'reps', reps:5},
    {desc:'Poignets sol tous les sens', type:'reps', reps:10},
    {desc:'Dead hang - hold max sec (chrono)', type:'timed', duration:0, note:'Mesure ton maximum en secondes'}
  ],
  circuits: [
    {name:'Circuit A (x3) - force + cardio', rounds:3, exercises:[
      {desc:'Tractions 5x (ou progression pyramidale recommandée)', reps:5, key:'pullups'},
      {desc:'Dips 10x', reps:10, key:'dips'},
      {desc:'Squats 10x', reps:10, key:'squats'},
      {desc:'Burpees 10x (gardés en fin de circuit pour limiter la fatigue précoce)', reps:10, key:'burpees'}
    ]},
    {name:'Circuit B (x2)', rounds:2, exercises:[
      {desc:'Traction biceps 5x', reps:5, key:'biceps_pull'},
      {desc:'Pompes 15x', reps:15, key:'pushups'},
      {desc:'Fentes 10x par jambe', reps:10, perLeg:true, key:'lunges'}
    ]},
    {name:'Circuit C (x2) - élastique & épaules', rounds:2, exercises:[
      {desc:'Tire élastique x10', reps:10, key:'band_pull'},
      {desc:'Pousse élastique x10', reps:10, key:'band_push'},
      {desc:'Tire blocage dos (hold / contraction) x10', reps:10, key:'band_row_hold'},
      {desc:'Pompes épaules (pike/decline) x10', reps:10, key:'shoulder_push'}
    ]},
    {name:'Abdos (x4)', rounds:4, exercises:[
      {desc:'L-sit apprentissage (temps / progression)', type:'timed', duration:0, note:'Travaille la progression: tuck -> one leg -> full L-sit', key:'lsit'},
      {desc:'Roue abdos 10', reps:10, key:'ab_wheel'},
      {desc:'Couché dos jambes levées (contrôle) x15', reps:15, key:'leg_raise_back'},
      {desc:'Couché ventre jambes et bras levés (superman) x15', reps:15, key:'superman'},
      {desc:'Planche 1 min', type:'timed', duration:60, key:'plank'}
    ]}
  ],
  cooldown: [
    {desc:'Étirements et relaxation - 5 à 10 min', type:'timed', duration:300}
  ],
  notes: [
    'Repos recommandé entre circuits: 60-90 secondes (modifiable).',
    'Si objectif force: augmenter repos. Si objectif cardio: réduire repos.',
    'Programme mixte force/endurance + mobilité - bien équilibré.'
  ]
};

// --- Utilities ---
function $(sel){return document.querySelector(sel)}
function show(el){el.classList.remove('hidden')}
function hide(el){el.classList.add('hidden')}
function saveSessions(arr){localStorage.setItem('workout_sessions', JSON.stringify(arr))}
function loadSessions(){try{return JSON.parse(localStorage.getItem('workout_sessions')||'[]')}catch(e){return []}}

// --- UI Elements ---
const sessionDate = $('#sessionDate');
const restSec = $('#restSec');
const startSession = $('#startSession');
const warmupSec = $('#warmup');
const warmupList = $('#warmupList');
const timerLabel = $('#timerLabel');
const startTimer = $('#startTimer');
const stopTimer = $('#stopTimer');
const doneWarmup = $('#doneWarmup');
const circuitsPanel = $('#circuits');
const circuitContainer = $('#circuitContainer');
const nextBtn = $('#next');
const savePartial = $('#savePartial');
const historyPanel = $('#history');
const historyList = $('#historyList');
const viewHistory = $('#viewHistory');
const closeHistory = $('#closeHistory');
const donePanel = $('#done');
const goHome = $('#goHome');

// Timer state
let timerInterval = null;
let timerRemaining = 0;

// Session runtime state
let currentSession = null;
let currentCircuitIndex = 0;
let currentRound = 1;
let currentExerciseIndex = 0;

function initDate(){
  const today = new Date().toISOString().slice(0,10);
  sessionDate.value = today;
}
initDate();

function buildWarmupUI(){
  warmupList.innerHTML='';
  defaultProgram.warmup.forEach((w, idx)=>{
    const li = document.createElement('li');
    li.textContent = w.desc + (w.type==='timed' && w.duration>0 ? ` — ${w.duration}s` : (w.note?` — ${w.note}`:''));
    warmupList.appendChild(li);
  });
}
buildWarmupUI();

startSession.addEventListener('click', ()=>{
  // Create session object
  currentSession = {
    date: sessionDate.value || new Date().toISOString().slice(0,10),
    restSec: Number(restSec.value) || 75,
    warmup: defaultProgram.warmup.map(w=>({...w, status:null, completed:false, recordedValue:null})),
    circuits: defaultProgram.circuits.map(c=>({...c, roundsCompleted:0, exercises:c.exercises.map(e=>({...e, entries:[]}))})),
    cooldown: defaultProgram.cooldown.map(c=>({...c, status:null})),
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  // Reset runtime pointers
  currentCircuitIndex = 0;
  currentRound = 1;
  currentExerciseIndex = 0;
  // Show warmup
  hide($('#session-controls'));
  show(warmupSec);
  renderWarmup();
});

// Timer controls
startTimer.addEventListener('click', ()=>{
  // If current highlighted warmup timed item has duration 0 (like max dead hang), allow manual counting
  const selIndex = getFirstIncompleteWarmup();
  if(selIndex===-1) return alert('Tout l\\'échauffement est déjà complété.');
  const w = currentSession.warmup[selIndex];
  if(w.type==='timed' && w.duration>0){
    timerRemaining = w.duration;
    runTimer();
  } else {
    // manual timer mode: ask for seconds, or start a stopwatch counting up
    timerRemaining = 0;
    runStopwatch(selIndex);
    return;
  }
});

stopTimer.addEventListener('click', ()=>{
  clearInterval(timerInterval);
  timerInterval = null;
  timerLabel.textContent='';
});

function runTimer(){
  clearInterval(timerInterval);
  timerLabel.textContent = `Temps: ${timerRemaining}s`;
  timerInterval = setInterval(()=>{
    timerRemaining--;
    timerLabel.textContent = `Temps: ${timerRemaining}s`;
    if(timerRemaining<=0){
      clearInterval(timerInterval);
      timerInterval = null;
      markWarmupTimedDone();
      timerLabel.textContent = 'Terminé';
    }
  },1000);
}

// simple stopwatch (counts up) for max hangs
function runStopwatch(warmupIndex){
  clearInterval(timerInterval);
  let sec=0;
  timerLabel.textContent = `Stopwatch: ${sec}s`;
  timerInterval = setInterval(()=>{
    sec++;
    timerLabel.textContent = `Stopwatch: ${sec}s`;
  },1000);
  // replace start button with save recorded value
  startTimer.style.display='none';
  const saveBtn = document.createElement('button');
  saveBtn.textContent='Enregistrer valeur';
  saveBtn.id='saveValueBtn';
  stopTimer.insertAdjacentElement('afterend', saveBtn);
  saveBtn.addEventListener('click', ()=>{
    clearInterval(timerInterval);
    timerInterval=null;
    const recorded = confirm('Enregistrer le temps actuel comme \"max\" ? Cliquez OK pour enregistrer.');
    if(recorded){
      currentSession.warmup[warmupIndex].recordedValue = parseInt(timerLabel.textContent.replace(/\\D/g,''))||0;
      currentSession.warmup[warmupIndex].completed = true;
      saveToLocal(currentSession);
      saveBtn.remove();
      startTimer.style.display='inline-block';
      markWarmupUI();
    } else {
      // do nothing
    }
  });
}

function getFirstIncompleteWarmup(){
  for(let i=0;i<currentSession.warmup.length;i++){
    if(!currentSession.warmup[i].completed) return i;
  }
  return -1;
}

function markWarmupTimedDone(){
  const idx = getFirstIncompleteWarmup();
  if(idx===-1) return;
  currentSession.warmup[idx].completed = true;
  saveToLocal(currentSession);
  renderWarmup();
}

function renderWarmup(){
  // highlight first incomplete
  const list = warmupList.children;
  for(let i=0;i<list.length;i++){
    list[i].style.fontWeight = currentSession.warmup[i].completed ? 'normal' : '600';
    list[i].style.opacity = currentSession.warmup[i].completed ? '0.6' : '1';
  }
}

doneWarmup.addEventListener('click', ()=>{
  // mark any remaining as completed=false left as is; proceed to circuits
  hide(warmupSec);
  show(circuitsPanel);
  renderCircuit();
});

function renderCircuit(){
  circuitContainer.innerHTML='';
  const circuit = currentSession.circuits[currentCircuitIndex];
  const hdr = document.createElement('h3');
  hdr.textContent = `${circuit.name} — Round ${currentRound}/${circuit.rounds}`;
  circuitContainer.appendChild(hdr);

  circuit.exercises.forEach((ex, exIdx)=>{
    const div = document.createElement('div');
    div.className='exercise';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${ex.desc}</strong><div style="font-size:.9rem;color:#666">${ex.reps?ex.reps+' reps':''}${ex.perLeg?' • par jambe':''}${ex.note? ' • '+ex.note:''}</div>`;
    const right = document.createElement('div');
    const ok = document.createElement('button');
    ok.textContent='✅';
    ok.className='statusBtn statusOk';
    const fail = document.createElement('button');
    fail.textContent='❌';
    fail.className='statusBtn statusFail';
    const note = document.createElement('input');
    note.placeholder='Note (optionnel)';
    note.style.marginLeft='8px';
    // load last recorded status if any
    const lastEntry = ex.entries && ex.entries[ex.entries.length-1];
    if(lastEntry){
      // no visual persistence per-exercise here across rounds for simplicity
    }
    ok.addEventListener('click', ()=>{
      recordExercise(circuit, exIdx, true, note.value);
      ok.disabled=true; fail.disabled=false;
    });
    fail.addEventListener('click', ()=>{
      recordExercise(circuit, exIdx, false, note.value);
      ok.disabled=false; fail.disabled=true;
    });
    right.appendChild(ok);
    right.appendChild(fail);
    right.appendChild(note);
    div.appendChild(left); div.appendChild(right);
    circuitContainer.appendChild(div);
  });

  // show rest recommendation
  const restNote = document.createElement('div');
  restNote.style.marginTop='8px';
  restNote.innerHTML = `<em>Repos recommandé après chaque round: ${currentSession.restSec}s (modifiable)</em>`;
  circuitContainer.appendChild(restNote);
}

function recordExercise(circuit, exIdx, ok, note){
  const ex = circuit.exercises[exIdx];
  const entry = {ok:!!ok,note:note||'',ts:new Date().toISOString()};
  ex.entries.push(entry);
  saveToLocal(currentSession);
}

nextBtn.addEventListener('click', ()=>{
  // Advance exercise/round/circuit logic: here we treat whole circuit as unit; user presses next to indicate round complete
  const circuit = currentSession.circuits[currentCircuitIndex];
  if(currentRound < circuit.rounds){
    currentRound++;
  } else {
    // finish this circuit and move to next
    currentCircuitIndex++;
    currentRound = 1;
  }
  if(currentCircuitIndex >= currentSession.circuits.length){
    // move to cooldown
    hide(circuitsPanel);
    show(donePanel);
    currentSession.finishedAt = new Date().toISOString();
    saveToLocal(currentSession, true);
    renderHistory();
  } else {
    // rest timer before next circuit
    alert(`Repos: ${currentSession.restSec} secondes. Appuie OK pour lancer le prochain circuit.`);
    renderCircuit();
  }
});

savePartial.addEventListener('click', ()=>{
  saveToLocal(currentSession);
  alert('Séance sauvegardée (partielle).');
});

function saveToLocal(session, finished=false){
  const arr = loadSessions();
  // if session exists (same startedAt) replace, else push
  const idx = arr.findIndex(s=>s.startedAt===session.startedAt);
  if(idx>=0) arr[idx]=session;
  else arr.push(session);
  saveSessions(arr);
  if(finished) alert('Séance complète enregistrée ✅');
}

viewHistory.addEventListener('click', ()=>{
  hide($('#session-controls'));
  show(historyPanel);
  renderHistory();
});

closeHistory.addEventListener('click', ()=>{
  hide(historyPanel);
  show($('#session-controls'));
});

function renderHistory(){
  const arr = loadSessions();
  historyList.innerHTML='';
  if(arr.length===0) historyList.textContent='Pas encore de séances enregistrées.';
  arr.slice().reverse().forEach(s=>{
    const div = document.createElement('div');
    div.className='historyItem';
    const dt = new Date(s.startedAt).toLocaleString();
    div.innerHTML = `<strong>${s.date}</strong> <span class="tag">${dt}</span><div style="font-size:.9rem;color:#555;margin-top:6px">Circuits: ${s.circuits.length} • Warmup complet: ${s.warmup.every(w=>w.completed)?'oui':'non'}</div>`;
    const openBtn = document.createElement('button');
    openBtn.textContent='Ouvrir';
    openBtn.style.marginLeft='8px';
    openBtn.addEventListener('click', ()=>{ showSessionDetail(s) });
    div.appendChild(openBtn);
    historyList.appendChild(div);
  });
}

function showSessionDetail(s){
  // simple popup display
  let txt = `Séance ${s.date}\nCommencée: ${s.startedAt}\n`;
  s.circuits.forEach((c,i)=>{
    txt += `\n${c.name} (rounds: ${c.rounds})\n`;
    c.exercises.forEach(e=>{
      txt += ` - ${e.desc}: entries ${e.entries.length}\n`;
      e.entries.forEach(en=> txt += `   * ${en.ok? 'OK':'FAIL'} @ ${en.ts} ${en.note? '- '+en.note:''}\n`);
    });
  });
  alert(txt);
}

// go back to start
goHome.addEventListener('click', ()=>{
  hide(donePanel);
  show($('#session-controls'));
});

// On load, show install button if available
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $('#installBtn');
  btn.style.display='inline-block';
  btn.addEventListener('click', async ()=>{
    btn.style.display='none';
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

// Initial render helpers
function markWarmupUI(){
  renderWarmup();
}
