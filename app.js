// Trainer PWA — step-by-step + timers + editable history
document.addEventListener('DOMContentLoaded',()=>{

  const $ = (s)=>document.querySelector(s);

  function ex(key,name,desc,cfg){ return { key,name,desc,cfg }; }

  // --- Programme propre ---
  const PROGRAM = [
    { type:'block', name:'Échauffement', rounds:1, items:[
      ex('neck_lr','Mobilité nuque : gauche/droite','Lent et contrôlé. 30s gauche + 30s droite.',{mode:'time',seconds:60}),
      ex('neck_half','Nuque : demi-cercles','Évite l’hyperextension. Respire.',{mode:'time',seconds:30}),
      ex('shoulders_back','Épaules : cercles arrière','Amplitude complète, épaules basses.',{mode:'time',seconds:20}),
      ex('shoulders_fwd','Épaules : cercles avant','Contrôle, pas de douleur.',{mode:'time',seconds:20}),
      ex('arms_back','Bras : grands cercles arrière','15 répétitions.',{mode:'reps',reps:15}),
      ex('arms_fwd','Bras : grands cercles avant','15 répétitions.',{mode:'reps',reps:15}),
      ex('band_disloc','Élastique : dislocates','Avant ↔ arrière, 10 répétitions lentes.',{mode:'reps',reps:10}),
      ex('wrists','Poignets : rotations','Tous sens. 10 répétitions.',{mode:'reps',reps:10}),
      ex('elbows','Coudes : rotations','10 répétitions.',{mode:'reps',reps:10}),
      ex('torso_rot','Buste : rotations','15 rotations contrôlées.',{mode:'reps',reps:15}),
      ex('spine_roll','Colonne : enroulés','Du haut vers le bas. 5 répétitions.',{mode:'reps',reps:5}),
      ex('wrist_floor','Poignets au sol','Toutes directions (appuis).',{mode:'time',seconds:30}),
      ex('dead_hang','Dead hang','Suspension barre — max temps.',{mode:'stopwatch'}),
    ]},

    { type:'block', name:'Circuit A — Force + Cardio', rounds:3, rest:60, items:[
      ex('pullups','Tractions pronation','5 reps. Option pyramide si à l’aise.',{mode:'reps',reps:5}),
      ex('dips','Dips','10 reps',{mode:'reps',reps:10}),
      ex('squats','Squats au poids de corps','10 reps',{mode:'reps',reps:10}),
      ex('burpees','Burpees','10 reps (fin de circuit)',{mode:'reps',reps:10}),
    ]},

    { type:'block', name:'Circuit B', rounds:2, rest:60, items:[
      ex('chinups','Tractions supination (biceps)','5 reps',{mode:'reps',reps:5}),
      ex('pushups','Pompes','15 reps',{mode:'reps',reps:15}),
      ex('lunges','Fentes','10 reps par jambe',{mode:'reps',reps:20}),
    ]},

    { type:'block', name:'Circuit C — Élastique & épaules', rounds:2, rest:60, items:[
      ex('band_row','Tirage élastique','10 reps',{mode:'reps',reps:10}),
      ex('band_press','Poussée élastique','10 reps',{mode:'reps',reps:10}),
      ex('band_hold','Tirage isométrique dos','Serrage 2–3s/rep, 10 reps',{mode:'reps',reps:10}),
      ex('pike_push','Pompes épaules (pike/decline)','10 reps',{mode:'reps',reps:10}),
    ]},

    { type:'block', name:'Abdos', rounds:4, rest:45, items:[
      ex('lsit','L-sit — apprentissage','Tuck → one-leg → full. Tiens le plus longtemps.',{mode:'stopwatch'}),
      ex('ab_wheel','Roue abdos','10 reps',{mode:'reps',reps:10}),
      ex('leg_raise','Relevés de jambes allongé','15 reps (dos plaqué)',{mode:'reps',reps:15}),
      ex('superman','Superman','15 reps',{mode:'reps',reps:15}),
      ex('plank','Planche','1 min',{mode:'time',seconds:60}),
    ]},

    { type:'block', name:'Retour au calme', rounds:1, items:[
      ex('stretch','Étirements / respiration','5–10 min',{mode:'time',seconds:300}),
    ]},
  ];

  // --- Panneaux & éléments
  const panels = {
    home: $('#home'),
    player: $('#player'),
    history: $('#history'),
    settings: $('#settings'),
    done: $('#done'),
  };
  const outline = $('#outline');
  const crumbs = $('#crumbs'), imageArea = $('#imageArea'),
        exoName = $('#exoName'), exoDesc = $('#exoDesc');
  const tDisp = $('#timerDisplay'), tStart = $('#timerStart'),
        tPause = $('#timerPause'), tReset = $('#timerReset');
  const markOk = $('#markOk'), markFail = $('#markFail'), skipBtn = $('#skip');
  const prevBtn = $('#prevBtn'), nextBtn = $('#nextBtn');

  const STORAGE_KEY='trainer_sessions';

  function show(id){ Object.values(panels).forEach(p=>p.classList.add('hidden')); panels[id].classList.remove('hidden'); }
  function fmt(t){ const m=Math.floor(t/60), s=t%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

  // --- Rendu du plan
  function renderOutline(){
    outline.innerHTML='';
    PROGRAM.forEach(b=>{
      const d=document.createElement('div');
      d.className='block';
      const rounds = b.rounds>1 ? `<span class="inline">(x${b.rounds})</span>` : '';
      d.innerHTML = `<div class="title">${b.name} ${rounds}</div><div class="inline">${b.items.map(i=>i.name).join(' • ')}</div>`;
      outline.appendChild(d);
    });
  }
  renderOutline();

  // --- Storage
  function loadSessions(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch(e){return[]} }
  function saveSessions(a){ localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); }

  // --- Accueil
  $('#dateInput').value = new Date().toISOString().slice(0,10);
  $('#startBtn').addEventListener('click', ()=>{
    state = { date: $('#dateInput').value, rest: parseInt($('#restInput').value||'75',10),
      iBlock:0, iRound:1, iItem:0, startedAt: new Date().toISOString(), log:[] };
    persist(); startPlayer();
  });
  $('#resumeBtn').addEventListener('click', ()=>{
    const arr = loadSessions(); const last=arr[arr.length-1];
    if(!last || last.finishedAt){ alert('Aucune séance en cours.'); return; }
    state = last.runtime; startPlayer();
  });
  $('#historyBtn').addEventListener('click', ()=>{ renderHistory(); show('history'); });
  $('#closeHistory').addEventListener('click', ()=> show('home'));
  $('#settingsBtn').addEventListener('click', ()=> show('settings'));
  $('#closeSettings').addEventListener('click', ()=> show('home'));

  // --- Son
  let soundOn=false; $('#soundToggle').addEventListener('change', e=> soundOn=e.target.checked);
  function beep(){ if(!soundOn) return; try{ new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAaW5mbyBiaXQ=').play(); }catch(e){} }

  // --- Player
  let state=null;
  let timer={mode:'stopped',sec:0,handle:null};

  function startPlayer(){ show('player'); drawCurrent(); }
  function updateTimer(){ tDisp.textContent = fmt(timer.sec); }
  function runTimer(down){ stopTimer(); timer.mode = down?'down':'up'; timer.handle = setInterval(()=>{ if(timer.mode==='up'){ timer.sec++; } else { timer.sec--; if(timer.sec<=0){ timer.sec=0; stopTimer(); beep(); } } updateTimer(); },1000); }
  function stopTimer(){ clearInterval(timer.handle); timer.handle=null; timer.mode='stopped'; }

  // --- Icônes simples (SVG inline)
  const ICON = (label)=>`
    <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#6ea8fe"/><stop offset="1" stop-color="#7bc9ff"/></linearGradient></defs>
      <rect x="6" y="6" rx="14" ry="14" width="188" height="128" fill="#0b1234" stroke="#2f3b77"/>
      <g stroke="url(#g)" stroke-width="5" stroke-linecap="round" fill="none">
        <circle cx="100" cy="45" r="14"/><path d="M100 59 L100 95"/><path d="M100 70 L65 85"/><path d="M100 70 L135 85"/><path d="M100 95 L80 120"/><path d="M100 95 L120 120"/>
      </g>
      <text x="100" y="130" text-anchor="middle" font-size="12" fill="#c9d6ff">${label}</text>
    </svg>`;
  const ICONS = new Proxy({}, { get:(_,k)=>ICON(k) });

  function drawCurrent(){
    const b = PROGRAM[state.iBlock];
    const it = b.items[state.iItem];
    crumbs.textContent = `${b.name} • Round ${state.iRound}/${b.rounds||1}`;
    exoName.textContent = it.name;
    exoDesc.textContent = it.desc + (b.rest?` • Repos: ${b.rest}s`:'');

    stopTimer();
    timer.sec = it.cfg.mode==='time'?(it.cfg.seconds||30):0;
    updateTimer();

    imageArea.innerHTML = ICONS[it.key] || ICON('Exercice');
  }

  tStart.addEventListener('click', ()=>{ const b=PROGRAM[state.iBlock], it=b.items[state.iItem]; runTimer(it.cfg.mode==='time'); });
  tPause.addEventListener('click', ()=> stopTimer());
  tReset.addEventListener('click', ()=>{ const it=PROGRAM[state.iBlock].items[state.iItem]; stopTimer(); timer.sec = it.cfg.mode==='time'?(it.cfg.seconds||30):0; updateTimer(); });

  function logEntry(status){
    const b=PROGRAM[state.iBlock], it=b.items[state.iItem];
    state.log.push({ t:new Date().toISOString(), block:b.name, round:state.iRound, key:it.key, name:it.name, status,
      timer:(it.cfg.mode==='time'?'countdown':it.cfg.mode==='stopwatch'?'stopwatch':'reps'), value: timer.sec });
    persist();
  }
  markOk.addEventListener('click', ()=>{ logEntry('ok'); next(); });
  markFail.addEventListener('click', ()=>{ logEntry('fail'); next(); });
  skipBtn.addEventListener('click', ()=>{ logEntry('skip'); next(); });

  prevBtn.addEventListener('click', ()=> back());
  nextBtn.addEventListener('click', ()=> next());

  function next(){
    const b=PROGRAM[state.iBlock];
    if(state.iItem < b.items.length-1){ state.iItem++; }
    else {
      if((b.rounds||1) > state.iRound){ state.iRound++; state.iItem=0; restBreak(b.rest||60); return; }
      else {
        if(state.iBlock < PROGRAM.length-1){ state.iBlock++; state.iRound=1; state.iItem=0; }
        else { finish(); return; }
      }
    }
    persist(); drawCurrent();
  }
  function back(){
    if(state.iItem>0){ state.iItem--; }
    else if(state.iBlock>0){ state.iBlock--; const p=PROGRAM[state.iBlock]; state.iRound=p.rounds||1; state.iItem=p.items.length-1; }
    persist(); drawCurrent();
  }

  function restBreak(sec){
    stopTimer(); timer.sec = sec; updateTimer(); runTimer(true);
    alert('Repos '+sec+'s. Appuie OK pour continuer.'); drawCurrent();
  }

  function finish(){
    stopTimer();
    const arr = loadSessions();
    arr.push({ date: state.date, startedAt: state.startedAt, finishedAt: new Date().toISOString(), log: state.log, runtime: state });
    saveSessions(arr);
    show('done');
  }

  function persist(){
    const arr = loadSessions();
    const idx = arr.findIndex(s=>s.startedAt===state?.startedAt);
    const payload = { date: state.date, startedAt: state.startedAt, finishedAt: null, log: state.log, runtime: state };
    if(idx>=0) arr[idx]=payload; else arr.push(payload);
    saveSessions(arr);
  }

  // --- Historique (édition / suppression)
  function renderHistory(){
    const list = $('#historyList'); list.innerHTML='';
    const arr = loadSessions();
    if(arr.length===0){ list.textContent='Pas encore de séances.'; return; }

    arr.slice().reverse().forEach((s,revIdx)=>{
      const realIdx = arr.length-1-revIdx; // index réel dans storage
      const wrap = document.createElement('div');
      wrap.className='historyItem';

      const head = document.createElement('div');
      head.innerHTML = `<strong>${s.date}</strong> <span class="tag">${new Date(s.startedAt).toLocaleString()}</span>
        <div class="inline">${s.finishedAt?'terminée ✅':'en cours ⏳'}</div>`;

      const actions = document.createElement('div');
      actions.className = 'row gap';
      const toggleBtn = document.createElement('button'); toggleBtn.className='secondary big'; toggleBtn.textContent='Gérer';
      const delSessBtn = document.createElement('button'); delSessBtn.className='fail big'; delSessBtn.textContent='Supprimer séance';

      actions.appendChild(toggleBtn); actions.appendChild(delSessBtn);

      const entries = document.createElement('div');
      entries.style.marginTop='8px'; entries.style.display='none';

      toggleBtn.onclick = ()=>{
        entries.style.display = entries.style.display==='none' ? 'block' : 'none';
        if(entries.dataset.filled!=='1'){
          renderEntries(entries, s, realIdx);
          entries.dataset.filled='1';
        }
      };

      delSessBtn.onclick = ()=>{
        if(!confirm('Supprimer toute la séance ?')) return;
        const all = loadSessions();
        all.splice(realIdx,1);
        saveSessions(all);
        renderHistory();
      };

      wrap.appendChild(head);
      wrap.appendChild(actions);
      wrap.appendChild(entries);
      list.appendChild(wrap);
    });
  }

  function renderEntries(container, session, sessionIndex){
    container.innerHTML='';
    if(!session.log || session.log.length===0){
      container.innerHTML = '<div class="inline">Aucune entrée.</div>';
      return;
    }
    session.log.forEach((entry, entryIndex)=>{
      const row = document.createElement('div');
      row.className='entryRow';

      const left = document.createElement('div');
      left.innerHTML = `<strong>${entry.name}</strong> <span class="tag">${entry.block} • R${entry.round}</span>
        <div class="inline">${new Date(entry.t).toLocaleString()} • ${entry.timer} • valeur: ${entry.value}</div>`;

      const right = document.createElement('div');
      right.className='entryControls';

      // Select status
      const sel = document.createElement('select');
      sel.className='select';
      ['ok','fail','skip'].forEach(v=>{
        const o=document.createElement('option'); o.value=v; o.textContent=v.toUpperCase();
        if(entry.status===v) o.selected=true;
        sel.appendChild(o);
      });

      const saveBtn = document.createElement('button'); saveBtn.className='primary'; saveBtn.textContent='Enregistrer';
      const delBtn = document.createElement('button'); delBtn.className='fail'; delBtn.textContent='Suppr. entrée';

      saveBtn.onclick = ()=>{
        const all = loadSessions();
        all[sessionIndex].log[entryIndex].status = sel.value;
        saveSessions(all);
        // feedback
        saveBtn.textContent='Enregistré ✓'; setTimeout(()=>saveBtn.textContent='Enregistrer', 1200);
      };

      delBtn.onclick = ()=>{
        if(!confirm('Supprimer cette entrée ?')) return;
        const all = loadSessions();
        all[sessionIndex].log.splice(entryIndex,1);
        saveSessions(all);
        renderEntries(container, all[sessionIndex], sessionIndex);
      };

      right.appendChild(sel);
      right.appendChild(saveBtn);
      right.appendChild(delBtn);

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  }

  // --- Install PWA
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; $('#installBtn').style.display='inline-block'; });
  $('#installBtn').addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#installBtn').style.display='none'; });

  // --- Navigation
  $('#historyBtn').addEventListener('click', ()=>{ renderHistory(); show('history'); });
  $('#closeHistory').addEventListener('click', ()=> show('home'));
  $('#settingsBtn').addEventListener('click', ()=> show('settings'));
  $('#closeSettings').addEventListener('click', ()=> show('home'));
  $('#goHome').addEventListener('click', ()=> show('home'));
});
