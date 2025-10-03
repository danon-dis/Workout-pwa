// app.js — version robuste avec logs et garde-fous

console.log('[PWA] app.js chargé ✅');

// Helpers DOM
function $(sel){ return document.querySelector(sel); }
function show(el){ if (el) el.classList.remove('hidden'); }
function hide(el){ if (el) el.classList.add('hidden'); }

// Vérif des éléments critiques
const el = {
  sessionControls: $('#session-controls'),
  sessionDate: $('#sessionDate'),
  restSec: $('#restSec'),
  startSession: $('#startSession'),
  viewHistory: $('#viewHistory'),
  warmupSec: $('#warmup'),
  warmupList: $('#warmupList'),
  timerLabel: $('#timerLabel'),
  startTimer: $('#startTimer'),
  stopTimer: $('#stopTimer'),
  doneWarmup: $('#doneWarmup'),
  circuitsPanel: $('#circuits'),
  circuitContainer: $('#circuitContainer'),
  nextBtn: $('#next'),
  savePartial: $('#savePartial'),
  historyPanel: $('#history'),
  historyList: $('#historyList'),
  closeHistory: $('#closeHistory'),
  donePanel: $('#done'),
  goHome: $('#goHome'),
};

Object.entries(el).forEach(([k, v])=>{
  if (!v) console.warn(`[PWA] Élément manquant dans le DOM: ${k}`);
});

function loadSessions(){
  try { return JSON.parse(localStorage.getItem('workout_sessions')||'[]'); }
  catch(e){ console.error('[PWA] loadSessions', e); return []; }
}
function saveSessions(arr){
  try { localStorage.setItem('workout_sessions', JSON.stringify(arr)); }
  catch(e){ console.error('[PWA] saveSessions', e); }
}

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
    {desc:'Dead hang - hold max sec (chrono)', type:'timed', duration:0, note:'Mesure ton max en secondes'}
  ],
  circuits: [
    {name:'Circuit A (x3) - force + cardio', rounds:3, exercises:[
      {desc:'Tractions 5x (ou pyramide)', reps:5, key:'pullups'},
      {desc:'Dips 10x', reps:10, key:'dips'},
      {desc:'Squats 10x', reps:10, key:'squats'},
      {desc:'Burpees 10x (fin de circuit)', reps:10, key:'burpees'}
    ]},
    {name:'Circuit B (x2)', rounds:2, exercises:[
      {desc:'Traction biceps 5x', reps:5, key:'biceps_pull'},
      {desc:'Pompes 15x', reps:15, key:'pushups'},
      {desc:'Fentes 10x / jambe', reps:10, perLeg:true, key:'lunges'}
    ]},
    {name:'Circuit C (x2) - élastique & épaules', rounds:2, exercises:[
      {desc:'Tire élastique x10', reps:10, key:'band_pull'},
      {desc:'Pousse élastique x10', reps:10, key:'band_push'},
      {desc:'Tire blocage dos x10', reps:10, key:'band_row_hold'},
      {desc:'Pompes épaules (pike/decline) x10', reps:10, key:'shoulder_push'}
    ]},
    {name:'Abdos (x4)', rounds:4, exercises:[
      {desc:'L-sit apprentissage (progression)', type:'timed', duration:0, note:'tuck → one leg → full', key:'lsit'},
      {desc:'Roue abdos 10', reps:10, key:'ab_wheel'},
      {desc:'Dos au sol jambes levées x15', reps:15, key:'leg_raise_back'},
      {desc:'Superman x15', reps:15, key:'superman'},
      {desc:'Planche 1 min', type:'timed', duration:60, key:'plank'}
    ]}
  ],
  cooldown: [{desc:'Étirements & relaxation 5–10 min', type:'timed', duration:300}]
};

// État runtime
let timerInterval = null;
let timerRemaining = 0;
let currentSession = null;
let currentCircuitIndex = 0;
let currentRound = 1;

function initDate(){
  if (el.sessionDate) {
    el.sessionDate.value = new Date().toISOString().slice(0,10);
  }
}
function buildWarmupUI(){
  if (!el.warmupList) return;
  el.warmupList.innerHTML='';
  defaultProgram.warmup.forEach((w)=>{
    const li = document.createElement('li');
    li.textContent = w.desc + (w.type==='timed' && w.duration>0 ? ` — ${w.duration}s` : (w.note?` — ${w.note}`:''));
    el.warmupList.appendChild(li);
  });
}
function saveToLocal(session, finished=false){
  const arr = loadSessions();
  const idx = arr.findIndex(s=>s.startedAt===session.startedAt);
  if(idx>=0) arr[idx]=session; else arr.push(session);
  saveSessions(arr);
  if (finished) console.log('[PWA] Séance enregistrée ✅');
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
  if (!el.warmupList) return;
  const list = el.warmupList.children;
  for(let i=0;i<list.length;i++){
    const completed = currentSession.warmup[i].completed;
    list[i].style.fontWeight = completed ? 'normal' : '600';
    list[i].style.opacity = completed ? '0.6' : '1';
  }
}
function runTimer(){
  clearInterval(timerInterval);
  if (!el.timerLabel) return;
  el.timerLabel.textContent = `Temps: ${timerRemaining}s`;
  timerInterval = setInterval(()=>{
    timerRemaining--;
    el.timerLabel.textContent = `Temps: ${timerRemaining}s`;
    if(timerRemaining<=0){
      clearInterval(timerInterval);
      timerInterval = null;
      markWarmupTimedDone();
      el.timerLabel.textContent = 'Terminé';
    }
  },1000);
}
function runStopwatch(warmupIndex){
  clearInterval(timerInterval);
  let sec=0;
  if (!el.timerLabel) return;
  el.timerLabel.textContent = `Stopwatch: ${sec}s`;
  timerInterval = setInterval(()=>{
    sec++;
    el.timerLabel.textContent = `Stopwatch: ${sec}s`;
  },1000);
  if (el.startTimer) el.startTimer.style.display='none';
  const saveBtn = document.createElement('button');
  saveBtn.textContent='Enregistrer valeur';
  saveBtn.id='saveValueBtn';
  el.stopTimer?.insertAdjacentElement('afterend', saveBtn);
  saveBtn.addEventListener('click', ()=>{
    clearInterval(timerInterval);
    timerInterval=null;
    const recorded = confirm('Enregistrer le temps actuel comme "max" ?');
    if(recorded){
      currentSession.warmup[warmupIndex].recordedValue =
        parseInt(el.timerLabel.textContent.replace(/\D/g,''))||0;
      currentSession.warmup[warmupIndex].completed = true;
      saveToLocal(currentSession);
      saveBtn.remove();
      if (el.startTimer) el.startTimer.style.display='inline-block';
      renderWarmup();
    }
  });
}

function renderCircuit(){
  if (!el.circuitContainer) return;
  el.circuitContainer.innerHTML='';
  const circuit = currentSession.circuits[currentCircuitIndex];
  const hdr = document.createElement('h3');
  hdr.textContent = `${circuit.name} — Round ${currentRound}/${circuit.rounds}`;
  el.circuitContainer.appendChild(hdr);

  circuit.exercises.forEach((ex, exIdx)=>{
    const div = document.createElement('div');
    div.className='exercise';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${ex.desc}</strong><div style="font-size:.9rem;color:#666">${ex.reps?ex.reps+' reps':''}${ex.perLeg?' • par jambe':''}${ex.note? ' • '+ex.note:''}</div>`;
    const right = document.createElement('div');
    const ok = document.createElement('button'); ok.textContent='✅'; ok.className='statusBtn statusOk';
    const fail = document.createElement('button'); fail.textContent='❌'; fail.className='statusBtn statusFail';
    const note = document.createElement('input'); note.placeholder='Note (optionnel)'; note.style.marginLeft='8px';
    ok.addEventListener('click', ()=>{
      recordExercise(circuit, exIdx, true, note.value);
      ok.disabled=true; fail.disabled=false;
    });
    fail.addEventListener('click', ()=>{
      recordExercise(circuit, exIdx, false, note.value);
      ok.disabled=false; fail.disabled=true;
    });
    right.appendChild(ok); right.appendChild(fail); right.appendChild(note);
    div.appendChild(left); div.appendChild(right);
    el.circuitContainer.appendChild(div);
  });

  const restNote = document.createElement('div');
  restNote.style.marginTop='8px';
  restNote.innerHTML = `<em>Repos recommandé après chaque round: ${currentSession.restSec}s</em>`;
  el.circuitContainer.appendChild(restNote);
}

function recordExercise(circuit, exIdx, ok, note){
  const ex = circuit.exercises[exIdx];
  if (!ex.entries) ex.entries = [];
  ex.entries.push({ok:!!ok,note:note||'',ts:new Date().toISOString()});
  saveToLocal(currentSession);
}

function startSessionFlow(){
  if (!el.sessionDate || !el.restSec) {
    alert("Erreur: éléments de saisie manquants dans la page.");
    console.error('[PWA] Champs date/repos introuvables');
    return;
  }
  currentSession = {
    date: el.sessionDate.value || new Date().toISOString().slice(0,10),
    restSec: Number(el.restSec.value) || 75,
    warmup: defaultProgram.warmup.map(w=>({...w, status:null, completed:false, recordedValue:null})),
    circuits: defaultProgram.circuits.map(c=>({...c, roundsCompleted:0, exercises:c.exercises.map(e=>({...e, entries:[]}))})),
    cooldown: defaultProgram.cooldown.map(c=>({...c, status:null})),
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  // UI
  hide(el.sessionControls);
  show(el.warmupSec);
  console.log('[PWA] Séance démarrée → affichage échauffement');
  buildWarmupUI();
  renderWarmup();
}

// --- INIT ---
(function init(){
  initDate();
  buildWarmupUI();

  // Bouton Démarrer
  if (el.startSession) {
    el.startSession.addEventListener('click', ()=>{
      try { startSessionFlow(); }
      catch(e){ console.error('[PWA] startSession error', e); alert('Erreur au démarrage de séance (voir console).'); }
    });
  } else {
    console.error('[PWA] Bouton startSession introuvable — vérifie l’ID dans index.html');
  }

  // Warmup timer
  el.startTimer?.addEventListener('click', ()=>{
    const idx = getFirstIncompleteWarmup();
    if(idx===-1){ alert('Échauffement déjà complété.'); return; }
    const w = currentSession.warmup[idx];
    if(w.type==='timed' && w.duration>0){ timerRemaining = w.duration; runTimer(); }
    else { timerRemaining = 0; runStopwatch(idx); }
  });
  el.stopTimer?.addEventListener('click', ()=>{ clearInterval(timerInterval); timerInterval=null; if (el.timerLabel) el.timerLabel.textContent=''; });
  el.doneWarmup?.addEventListener('click', ()=>{
    hide(el.warmupSec);
    show(el.circuitsPanel);
    currentCircuitIndex = 0;
    currentRound = 1;
    renderCircuit();
  });

  el.nextBtn?.addEventListener('click', ()=>{
    const circuit = currentSession.circuits[currentCircuitIndex];
    if(currentRound < circuit.rounds) currentRound++; else { currentCircuitIndex++; currentRound = 1; }
    if(currentCircuitIndex >= currentSession.circuits.length){
      hide(el.circuitsPanel);
      show(el.donePanel);
      currentSession.finishedAt = new Date().toISOString();
      saveToLocal(currentSession, true);
    } else {
      alert(`Repos: ${currentSession.restSec} secondes.`);
      renderCircuit();
    }
  });

  el.savePartial?.addEventListener('click', ()=>{ saveToLocal(currentSession); alert('Séance sauvegardée.'); });

  el.viewHistory?.addEventListener('click', ()=>{
    hide(el.sessionControls);
    show(el.historyPanel);
    const arr = loadSessions();
    el.historyList.innerHTML = '';
    if(arr.length===0){ el.historyList.textContent='Pas encore de séances enregistrées.'; return; }
    arr.slice().reverse().forEach(s=>{
      const div = document.createElement('div'); div.className='historyItem';
      const dt = new Date(s.startedAt).toLocaleString();
      div.innerHTML = `<strong>${s.date}</strong> <span class="tag">${dt}</span>`;
      const openBtn = document.createElement('button'); openBtn.textContent='Ouvrir'; openBtn.style.marginLeft='8px';
      openBtn.addEventListener('click', ()=>{
        let txt = `Séance ${s.date}\nCommencée: ${s.startedAt}\n`;
        s.circuits.forEach((c)=>{ txt += `\n${c.name} (rounds: ${c.rounds})\n`; c.exercises.forEach(e=>{ txt += ` - ${e.desc}: ${e.entries?.length||0} entrées\n`; }); });
        alert(txt);
      });
      div.appendChild(openBtn);
      el.historyList.appendChild(div);
    });
  });

  el.closeHistory?.addEventListener('click', ()=>{ hide(el.historyPanel); show(el.sessionControls); });
  el.goHome?.addEventListener('click', ()=>{ hide(el.donePanel); show(el.sessionControls); });

  console.log('[PWA] init terminé ✅');
})();
