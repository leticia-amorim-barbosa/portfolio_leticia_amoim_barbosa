const state = {
  user: null,
  students: [],
  workouts: [],
  selectedWorkoutId: null,
  selectedChatPeerId: null,
  lastMessageSignature: '',
  chatTimer: null
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('');
const fmtDateTime = (v) => v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v.replace(' ','T')+'Z')) : '';
const fmtDate = (v) => v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(v+'T12:00:00')) : '';
const todayLabel = () => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date());

async function api(url, options={}) {
  const cfg = {...options, headers:{...(options.headers||{})}};
  if (cfg.body && typeof cfg.body !== 'string') {
    cfg.headers['Content-Type']='application/json';
    cfg.body=JSON.stringify(cfg.body);
  }
  const res = await fetch(url, cfg);
  let data={};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data.error || 'Não foi possível concluir a operação.');
    err.status = res.status;
    if (res.status === 401 && state.user) {
      state.user = null;
      showView('login');
    }
    throw err;
  }
  return data;
}

function showView(v) {
  document.querySelectorAll('.view').forEach(el => { el.classList.remove('active'); el.style.display='none'; });
  const target = $('view-'+v);
  if (target) { target.classList.add('active'); target.style.display='block'; }
  const shell = $('app-shell');
  if (shell) { shell.classList.remove('active'); shell.style.display='none'; }
  const wa = $('wa-float');
  if (wa) wa.style.display = v === 'landing' ? 'flex' : 'none';
  if (v === 'login') refreshSetupStatus();
}

async function refreshSetupStatus() {
  try {
    const data = await api('/api/setup/status');
    const notice = $('admin-setup-notice');
    if (notice) notice.classList.toggle('hidden', !data.needsAdmin);
  } catch {}
}

async function configurePublicContact() {
  try {
    const data = await api('/api/public/config');
    const links=[...document.querySelectorAll('[data-wa-link]')];
    const phone=data.whatsappPhone ? String(data.whatsappPhone).replace(/\D/g,'') : '';
    links.forEach(link=>{
      if(phone){
        link.href='https://wa.me/'+phone;
        link.target='_blank';
        link.rel='noopener';
        link.onclick=null;
      }else{
        link.href='#';
        link.removeAttribute('target');
        link.onclick=(e)=>{e.preventDefault();showToast('WhatsApp ainda não configurado no perfil do Chico.');};
      }
    });
    const wa=$('wa-float');
    if(wa && $('view-landing')?.classList.contains('active')) wa.style.display='flex';
  } catch {}
}
async function loadPublicStats(){
  try{
    const d=await api('/api/public/stats');
    if($('public-students')) $('public-students').textContent=d.studentCount;
    if($('public-active-workouts')) $('public-active-workouts').textContent=d.activeWorkouts;
    if($('public-completed-workouts')) $('public-completed-workouts').textContent=d.completedWorkouts;
  }catch{}
}

function setBusy(buttonId, busy, textBusy='Salvando...') {
  const b=$(buttonId); if(!b) return;
  if (busy) { b.dataset.oldText=b.textContent; b.textContent=textBusy; b.disabled=true; }
  else { b.textContent=b.dataset.oldText || b.textContent; b.disabled=false; }
}

async function login() {
  $('login-error').textContent='';
  setBusy('login-submit',true,'Entrando...');
  try {
    const data = await api('/api/login',{method:'POST',body:{email:$('login-email').value,password:$('login-password').value}});
    enterApp(data.user);
  } catch(e) { $('login-error').textContent=e.message; }
  finally { setBusy('login-submit',false); }
}

async function register() {
  $('register-error').textContent='';
  setBusy('register-submit',true,'Criando...');
  try {
    const data = await api('/api/register',{method:'POST',body:{
      firstName:$('reg-first').value,lastName:$('reg-last').value,email:$('reg-email').value,
      password:$('reg-password').value,phone:$('reg-phone').value
    }});
    enterApp(data.user);
    showToast('Conta criada e salva com sucesso.');
  } catch(e) { $('register-error').textContent=e.message; }
  finally { setBusy('register-submit',false); }
}

async function setupAdmin() {
  $('setup-error').textContent='';
  setBusy('setup-submit',true,'Configurando...');
  try {
    const data = await api('/api/setup/admin',{method:'POST',body:{
      name:$('setup-name').value,email:$('setup-email').value,phone:$('setup-phone').value,password:$('setup-password').value
    }});
    enterApp(data.user);
    configurePublicContact();
    showToast('Administrador criado. Essa tela não aparecerá novamente.');
  } catch(e) { $('setup-error').textContent=e.message; }
  finally { setBusy('setup-submit',false); }
}

async function logout() {
  try { await api('/api/logout',{method:'POST'}); } catch {}
  state.user=null; state.students=[]; state.workouts=[]; state.selectedChatPeerId=null;
  if (state.chatTimer) clearInterval(state.chatTimer);
  showView('landing');
}

function enterApp(user) {
  state.user=user;
  document.querySelectorAll('.view').forEach(el=>{el.classList.remove('active');el.style.display='none';});
  const shell=$('app-shell'); shell.style.display='flex'; shell.classList.add('active');
  $('wa-float').style.display='none';

  const isStudent=user.role==='student';

$('nav-aluno').classList.toggle('hidden',!isStudent);
$('nav-professor').classList.toggle('hidden',isStudent);

$('bottom-nav-aluno').classList.toggle('hidden',!isStudent);
$('bottom-nav-prof').classList.toggle('hidden',isStudent);

// deixa o CSS decidir se aparece no desktop ou mobile
$('bottom-nav-aluno').style.removeProperty('display');
$('bottom-nav-prof').style.removeProperty('display');

  $('sidebar-name').textContent=user.name;
  $('sidebar-role').textContent=isStudent?'Aluno':'Administrador';
  $('sidebar-avatar').textContent=initials(user.name);
  if (isStudent) {
    $('dash-name').textContent=user.name.split(' ')[0];
    showPage('dashboard-aluno','nav-aluno');
  } else {
    showPage('dashboard-prof','nav-professor');
  }
  hydrateProfile();
}

function showPageDirect(pageId) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const p=$('page-'+pageId); if(p) p.classList.add('active');
}

function showPage(pageId, navId) {
  showPageDirect(pageId);
  const nav=$(navId);
  if(nav){
    nav.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    nav.querySelectorAll('.nav-item').forEach(i=>{
      if ((i.getAttribute('onclick')||'').includes("'"+pageId+"'")) i.classList.add('active');
    });
  }
  const titles={
    'dashboard-aluno':'Dashboard','meu-treino':'Meu Treino','calendario-aluno':'Calendário','historico':'Histórico',
    'evolucao-aluno':'Evolução','mensagens':'Mensagens','perfil-aluno':'Perfil','dashboard-prof':'Painel',
    'alunos':'Alunos','montar-treino':'Montar Treino','agenda':'Agenda','evolucao-prof':'Evolução','config-prof':'Configurações'
  };
  setTopbarTitle(titles[pageId]||pageId);
  closeSidebar();
  window.scrollTo(0,0);
  onPageOpen(pageId).catch(e=>showToast(e.message));
}

async function onPageOpen(pageId) {
  if(!state.user) return;
  if(pageId==='dashboard-aluno') return loadStudentDashboard();
  if(pageId==='meu-treino') return loadWorkouts();
  if(pageId==='historico') return loadHistory();
  if(pageId==='evolucao-aluno') return loadMeasurements();
  if(pageId==='calendario-aluno') return loadCalendar();
  if(pageId==='mensagens') return loadChatContacts();
  if(pageId==='perfil-aluno' || pageId==='config-prof') return hydrateProfile();
  if(pageId==='dashboard-prof') return loadAdminDashboard();
  if(pageId==='alunos') return loadStudents();
  if(pageId==='montar-treino') return prepareWorkoutBuilder();
  if(pageId==='evolucao-prof') return prepareAdminMeasurements();
  if(pageId==='agenda') return loadAgenda();
}
function setTopbarTitle(t){ if($('topbar-title')) $('topbar-title').textContent=t; }
function toggleSidebar(){ $('sidebar')?.classList.toggle('open'); $('sidebar-overlay')?.classList.toggle('show'); }
function closeSidebar(){ $('sidebar')?.classList.remove('open'); $('sidebar-overlay')?.classList.remove('show'); }
function setBottomActive(el){ el.closest('.bottom-nav')?.querySelectorAll('.bottom-nav-item').forEach(i=>i.classList.remove('active'));el.classList.add('active'); }

function emptyState(icon,title,text,button='') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${button}</div>`;
}

async function loadStudentDashboard() {
  $('dash-date').textContent=todayLabel();
  $('dash-name').textContent=state.user.name.split(' ')[0];
  const data=await api('/api/dashboard');
  const wrap=$('student-dashboard-content');
  const workout=data.workouts?.[0];
  let workoutBlock='';
  if(workout){
    const totalSets=workout.exercises.reduce((a,e)=>a+e.sets,0);
    workoutBlock=`<div class="workout-hero-card">
      <div class="workout-hero-top"><div><div class="workout-kicker">Treino disponível</div><div class="workout-real-title">${esc(workout.title)}</div></div><div class="workout-code-big">${esc(workout.code||'•')}</div></div>
      <div class="workout-real-meta"><span>${workout.exercises.length} exercícios</span><span>${totalSets} séries</span>${workout.estimatedMinutes?`<span>${workout.estimatedMinutes} min</span>`:''}${workout.dayOfWeek?`<span>${esc(workout.dayOfWeek)}</span>`:''}</div>
      <div class="workout-actions"><button class="btn btn-primary" onclick="openWorkout(${workout.id})">${workout.activeSession?'Continuar treino':'Abrir treino'} →</button></div>
    </div>`;
  } else {
    workoutBlock=emptyState('🏋️','Nenhum treino atribuído','Quando o Chico criar seu primeiro treino, ele aparecerá aqui.');
  }
  const msg=data.lastMessage?`<div class="card"><p class="page-greeting">Última mensagem</p><strong style="color:var(--white)">${esc(data.lastMessage.sender_name)}</strong><p style="color:var(--text);margin-top:8px;line-height:1.55">${esc(data.lastMessage.body)}</p><p class="gray small" style="margin-top:8px">${fmtDateTime(data.lastMessage.created_at)}</p></div>`:'';
  wrap.innerHTML=`<div class="dashboard-real-grid">
    <div class="dashboard-real-stat"><div class="value">${data.workouts.length}</div><div class="label">Treinos ativos</div></div>
    <div class="dashboard-real-stat"><div class="value">${data.completedCount}</div><div class="label">Treinos concluídos</div></div>
    <div class="dashboard-real-stat"><div class="value">${data.lastMessage?'1':'0'}</div><div class="label">Última mensagem</div></div>
  </div>${workoutBlock}${msg}`;
}

async function openWorkout(id){
  state.selectedWorkoutId=Number(id);
  showPage('meu-treino','nav-aluno');
}

async function loadWorkouts(){
  const data=await api('/api/workouts');
  state.workouts=data.workouts||[];
  const select=$('workout-select');
  if(!state.workouts.length){
    select.innerHTML='<option>Nenhum treino</option>'; select.disabled=true;
    $('workout-content').innerHTML=emptyState('🏋️','Seu treino ainda não chegou','O Chico precisa atribuir um treino à sua conta. Assim que ele salvar, esta tela atualiza com os exercícios reais.');
    return;
  }
  select.disabled=false;
  if(!state.selectedWorkoutId || !state.workouts.some(w=>w.id===state.selectedWorkoutId)) state.selectedWorkoutId=state.workouts[0].id;
  select.innerHTML=state.workouts.map(w=>`<option value="${w.id}" ${w.id===state.selectedWorkoutId?'selected':''}>${esc(w.code?`${w.code} · ${w.title}`:w.title)}</option>`).join('');
  renderWorkout();
}
function selectWorkout(id){ state.selectedWorkoutId=Number(id); renderWorkout(); }
function selectedWorkout(){ return state.workouts.find(w=>w.id===state.selectedWorkoutId); }

function renderWorkout(){
  const w=selectedWorkout(); if(!w) return;
  const progressMap=new Set((w.activeSession?.progress||[]).filter(p=>p.completed).map(p=>`${p.exerciseId}:${p.setNumber}`));
  const totalSets=w.exercises.reduce((a,e)=>a+e.sets,0), done=progressMap.size;
  const pct=totalSets?Math.round(done/totalSets*100):0;
  const exHtml=w.exercises.map((e,i)=>{
    const doneCount=Array.from({length:e.sets},(_,n)=>progressMap.has(`${e.id}:${n+1}`)).filter(Boolean).length;
    return `<article class="real-exercise ${doneCount===e.sets?'is-complete':''}" id="exercise-${e.id}">
      <div class="real-exercise-head" onclick="toggleRealExercise(${e.id})">
        <div class="real-exercise-index">${String(i+1).padStart(2,'0')}</div>
        <div><div class="real-exercise-name">${esc(e.name)}</div><div class="real-exercise-specs">${e.sets} séries · ${esc(e.reps||'repetições livres')}${e.restSeconds!=null?` · ${e.restSeconds}s descanso`:''}</div></div>
        <div class="real-exercise-chevron">⌄</div>
      </div>
      <div class="real-exercise-body">
        ${e.instructions?`<p class="exercise-instruction">Orientação: ${esc(e.instructions)}</p>`:''}
        <div class="real-sets">${Array.from({length:e.sets},(_,n)=>{
          const setNo=n+1, isDone=progressMap.has(`${e.id}:${setNo}`);
          return `<button type="button" class="real-set ${isDone?'done':''}" onclick="toggleSet(${e.id},${setNo},this)"><strong>Série ${setNo}</strong><span>${esc(e.load||'Carga livre')} · ${esc(e.reps||'reps livres')}</span></button>`;
        }).join('')}</div>
      </div>
    </article>`;
  }).join('');
  $('workout-content').innerHTML=`<div class="workout-hero-card">
    <div class="workout-hero-top"><div><div class="workout-kicker">${esc(w.goal||'Treino personalizado')}</div><div class="workout-real-title">${esc(w.title)}</div></div><div class="workout-code-big">${esc(w.code||'•')}</div></div>
    <div class="workout-real-meta"><span>${w.exercises.length} exercícios</span><span>${totalSets} séries</span>${w.estimatedMinutes?`<span>${w.estimatedMinutes} min</span>`:''}${w.dayOfWeek?`<span>${esc(w.dayOfWeek)}</span>`:''}</div>
    ${w.notes?`<div class="workout-notes">${esc(w.notes)}</div>`:''}
    <div class="workout-progress-wrap"><div class="workout-progress-line"><span>Progresso</span><strong id="workout-progress-text">${done}/${totalSets} séries · ${pct}%</strong></div><div class="progress-bar"><div class="progress-fill" id="workout-progress-bar" style="width:${pct}%"></div></div></div>
    <div class="workout-actions">
      ${w.activeSession?`<button class="btn btn-outline" disabled>Treino em andamento</button><button class="btn btn-primary" onclick="completeTreino()">Concluir treino</button>`:`<button class="btn btn-primary" onclick="startWorkout()">Iniciar treino</button>`}
    </div>
  </div><div class="real-exercise-list">${exHtml}</div>`;
}
function toggleRealExercise(id){ $('exercise-'+id)?.classList.toggle('open'); }
async function startWorkout(){
  const w=selectedWorkout(); if(!w) return;
  const data=await api(`/api/workouts/${w.id}/start`,{method:'POST'});
  w.activeSession={id:data.session.id,startedAt:data.session.startedAt,progress:[]};
  renderWorkout(); showToast('Treino iniciado. Agora marque cada série concluída.');
}
async function toggleSet(exerciseId,setNumber,button){
  const w=selectedWorkout();
  if(!w?.activeSession){ showToast('Inicie o treino antes de marcar as séries.'); return; }
  const done=!button.classList.contains('done');
  button.disabled=true;
  try{
    await api(`/api/workout-sessions/${w.activeSession.id}/sets`,{method:'POST',body:{exerciseId,setNumber,done}});
    const list=w.activeSession.progress;
    const idx=list.findIndex(p=>p.exerciseId===exerciseId && p.setNumber===setNumber);
    if(idx>=0) list[idx].completed=done; else list.push({exerciseId,setNumber,completed:done});
    button.classList.toggle('done',done);
    const ex=w.exercises.find(e=>e.id===exerciseId);
    const exDone=Array.from({length:ex.sets},(_,n)=>list.some(p=>p.exerciseId===exerciseId&&p.setNumber===n+1&&p.completed)).filter(Boolean).length;
    $('exercise-'+exerciseId)?.classList.toggle('is-complete',exDone===ex.sets);
    refreshWorkoutProgressOnly();
  }catch(e){showToast(e.message);}
  finally{button.disabled=false;}
}
function refreshWorkoutProgressOnly(){
  const w=selectedWorkout(); if(!w) return;
  const total=w.exercises.reduce((a,e)=>a+e.sets,0);
  const done=(w.activeSession?.progress||[]).filter(p=>p.completed).length;
  const pct=total?Math.round(done/total*100):0;
  if($('workout-progress-text')) $('workout-progress-text').textContent=`${done}/${total} séries · ${pct}%`;
  if($('workout-progress-bar')) $('workout-progress-bar').style.width=pct+'%';
}
async function completeTreino(){
  const w=selectedWorkout(); if(!w?.activeSession) return;
  try{
    await api(`/api/workout-sessions/${w.activeSession.id}/complete`,{method:'POST'});
    showToast('Treino concluído e salvo no histórico.');
    w.activeSession=null;
    await loadWorkouts();
  }catch(e){showToast(e.message);}
}

async function loadHistory(){
  const data=await api('/api/history');
  $('history-list').innerHTML=data.history.length?data.history.map(h=>`<div class="history-real-row">
    <div class="history-real-check">✓</div><div><div class="history-real-title">${esc(h.title)}</div><div class="history-real-meta">${fmtDateTime(h.completedAt)} · ${h.exerciseCount} exercícios · ${h.setCount} séries</div></div><div class="workout-badge">${esc(h.code||'•')}</div>
  </div>`).join(''):emptyState('📋','Histórico vazio','Os treinos concluídos de verdade aparecerão aqui.');
}

async function loadCalendar(){
  const data=await api('/api/workouts');
  const w=data.workouts||[];
  if(!w.length){ $('calendar-real').innerHTML=emptyState('📅','Sem agenda de treino','Ainda não há treinos atribuídos à sua conta.'); return; }
  const days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo','Sem dia fixo'];
  const groups={}; days.forEach(d=>groups[d]=[]);
  w.forEach(x=>(groups[x.dayOfWeek||'Sem dia fixo'] ||= []).push(x));
  $('calendar-real').innerHTML=days.filter(d=>groups[d].length).map(d=>`<div class="agenda-day"><div class="agenda-day-title">${d}</div>${groups[d].map(x=>`<div class="agenda-item"><div><strong>${esc(x.title)}</strong><div><span>${x.exercises.length} exercícios${x.goal?` · ${esc(x.goal)}`:''}</span></div></div><div class="workout-badge">${esc(x.code||'•')}</div></div>`).join('')}</div>`).join('');
}

async function saveMeasurement(){
  await api('/api/measurements',{method:'POST',body:{
    measuredAt:$('measure-date').value,weight:$('measure-weight').value,bodyFat:$('measure-fat').value,
    waist:$('measure-waist').value,chest:$('measure-chest').value,hip:$('measure-hip').value,note:$('measure-note').value
  }});
  $('measurement-form').reset(); $('measure-date').value=new Date().toISOString().slice(0,10);
  showToast('Medidas salvas.'); loadMeasurements();
}
function measurementHtml(list){
  if(!list.length) return emptyState('📈','Sem medições','Registre a primeira medição para começar a construir sua evolução.');
  return list.map(m=>`<div class="card measurement-entry"><div class="measurement-entry-head"><strong>${fmtDate(m.measuredAt)}</strong><span>${esc(m.note||'')}</span></div><div class="measurement-grid">
    ${m.weight!=null?`<div class="measurement-tile"><div class="label">Peso</div><div class="value">${m.weight} kg</div></div>`:''}
    ${m.bodyFat!=null?`<div class="measurement-tile"><div class="label">Gordura</div><div class="value">${m.bodyFat}%</div></div>`:''}
    ${m.waist!=null?`<div class="measurement-tile"><div class="label">Cintura</div><div class="value">${m.waist} cm</div></div>`:''}
    ${m.chest!=null?`<div class="measurement-tile"><div class="label">Peito</div><div class="value">${m.chest} cm</div></div>`:''}
    ${m.hip!=null?`<div class="measurement-tile"><div class="label">Quadril</div><div class="value">${m.hip} cm</div></div>`:''}
  </div></div>`).join('');
}
async function loadMeasurements(){
  if($('measure-date') && !$('measure-date').value) $('measure-date').value=new Date().toISOString().slice(0,10);
  const data=await api('/api/measurements'); $('measurements-list').innerHTML=measurementHtml(data.measurements);
}

function hydrateProfile(){
  const u=state.user;if(!u)return;
  if(u.role==='student'){
    if($('profile-avatar')) $('profile-avatar').textContent=initials(u.name);
    if($('profile-name')) $('profile-name').textContent=u.name;
    if($('profile-email')) $('profile-email').textContent=u.email;
    if($('profile-input-name')) $('profile-input-name').value=u.name;
    if($('profile-input-phone')) $('profile-input-phone').value=u.phone||'';
    if($('profile-objective')) $('profile-objective').value=u.objective||'';
    if($('profile-level')) $('profile-level').value=u.level||'';
  }else{
    if($('admin-profile-avatar')) $('admin-profile-avatar').textContent=initials(u.name);
    if($('admin-profile-name')) $('admin-profile-name').textContent=u.name;
    if($('admin-profile-email')) $('admin-profile-email').textContent=u.email;
    if($('admin-input-name')) $('admin-input-name').value=u.name;
    if($('admin-input-phone')) $('admin-input-phone').value=u.phone||'';
  }
}
async function saveProfile(){
  const data=await api('/api/me',{method:'PUT',body:{name:$('profile-input-name').value,phone:$('profile-input-phone').value,objective:$('profile-objective').value,level:$('profile-level').value}});
  state.user=data.user; enterSidebarUser(); hydrateProfile(); showToast('Perfil atualizado.');
}
async function saveAdminProfile(){
  const data=await api('/api/me',{method:'PUT',body:{name:$('admin-input-name').value,phone:$('admin-input-phone').value,objective:state.user.objective||'',level:state.user.level||''}});
  state.user=data.user; enterSidebarUser(); hydrateProfile(); configurePublicContact(); showToast('Perfil atualizado.');
}
function enterSidebarUser(){ $('sidebar-name').textContent=state.user.name;$('sidebar-role').textContent=state.user.role==='student'?'Aluno':'Administrador';$('sidebar-avatar').textContent=initials(state.user.name); }

async function loadAdminDashboard(){
  $('prof-date').textContent=todayLabel();
  const d=await api('/api/dashboard');
  $('prof-dashboard-content').innerHTML=`<div class="dashboard-real-grid">
    <div class="dashboard-real-stat"><div class="value">${d.studentCount}</div><div class="label">Alunos cadastrados</div></div>
    <div class="dashboard-real-stat"><div class="value">${d.workoutCount}</div><div class="label">Treinos ativos</div></div>
    <div class="dashboard-real-stat"><div class="value">${d.unreadMessages}</div><div class="label">Mensagens não lidas</div></div>
  </div>
  <div class="card"><div class="row section-head mb-12"><h3 class="condensed">Alunos recentes</h3><span class="see-all" onclick="showPage('alunos','nav-professor')">Ver todos</span></div>
    ${d.recentStudents.length?`<div class="stacks">${d.recentStudents.map(s=>studentRowHtml(s)).join('')}</div>`:emptyState('👥','Nenhum aluno ainda','Assim que alguém criar uma conta, aparecerá aqui.')}</div>`;
}
function studentRowHtml(s){
  return `<div class="student-card"><div class="student-avatar">${esc(initials(s.name))}</div><div><div class="student-name">${esc(s.name)}</div><div class="student-meta">${esc(s.email)}${s.objective?` · ${esc(s.objective)}`:''}</div></div>${s.workoutCount!=null?`<div class="student-status"><div class="badge badge-yellow">${s.workoutCount} treino${s.workoutCount===1?'':'s'}</div></div>`:''}</div>`;
}
async function loadStudents(){
  const d=await api('/api/students');state.students=d.students||[];renderStudents($('student-search')?.value||'');
}
function renderStudents(query=''){
  const q=query.trim().toLowerCase();
  const list=state.students.filter(s=>!q||`${s.name} ${s.email}`.toLowerCase().includes(q));
  $('students-list').innerHTML=list.length?list.map(studentRowHtml).join(''):emptyState('👥','Nenhum aluno encontrado',q?'Tente outro termo de busca.':'As contas criadas pelos alunos aparecerão aqui.');
}

async function prepareWorkoutBuilder(){
  if(!state.students.length) await loadStudents();
  const select=$('builder-student');
  select.innerHTML=state.students.length?`<option value="">Selecione</option>${state.students.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.email)}</option>`).join('')}`:'<option value="">Nenhum aluno cadastrado</option>';
  select.disabled=!state.students.length;
  if(!$('builder-exercises').children.length) addExerciseRow();
}
function addExerciseRow(data={}){
  const wrap=$('builder-exercises'), index=wrap.children.length+1;
  const row=document.createElement('div');row.className='builder-row';
  row.innerHTML=`<div class="builder-row-top"><div class="builder-index">${index}</div><strong style="color:var(--white)">Exercício</strong><button class="builder-remove" type="button" onclick="removeExerciseRow(this)" title="Remover">×</button></div>
    <div class="form-group"><label class="form-label">Nome</label><input class="form-input ex-name" value="${esc(data.name||'')}" required></div>
    <div class="input-row">
      <div class="form-group"><label class="form-label">Séries</label><input class="form-input ex-sets" type="number" min="1" max="20" value="${esc(data.sets||3)}" required></div>
      <div class="form-group"><label class="form-label">Reps</label><input class="form-input ex-reps" value="${esc(data.reps||'')}"></div>
      <div class="form-group"><label class="form-label">Carga</label><input class="form-input ex-load" value="${esc(data.load||'')}"></div>
      <div class="form-group"><label class="form-label">Descanso (s)</label><input class="form-input ex-rest" type="number" min="0" max="900" value="${esc(data.restSeconds??'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">Orientação técnica</label><textarea class="form-input textarea-real ex-instructions" rows="2">${esc(data.instructions||'')}</textarea></div>`;
  wrap.appendChild(row); renumberExercises();
}
function removeExerciseRow(btn){ btn.closest('.builder-row').remove();renumberExercises(); }
function renumberExercises(){ [...$('builder-exercises').children].forEach((r,i)=>r.querySelector('.builder-index').textContent=i+1); }
async function saveWorkout(){
  const rows=[...$('builder-exercises').querySelectorAll('.builder-row')];
  const exercises=rows.map(r=>({name:r.querySelector('.ex-name').value,sets:r.querySelector('.ex-sets').value,reps:r.querySelector('.ex-reps').value,load:r.querySelector('.ex-load').value,restSeconds:r.querySelector('.ex-rest').value,instructions:r.querySelector('.ex-instructions').value}));
  setBusy('save-workout-btn',true,'Salvando...');
  try{
    await api('/api/workouts',{method:'POST',body:{
      studentId:$('builder-student').value,title:$('builder-title').value,code:$('builder-code').value,dayOfWeek:$('builder-day').value,
      estimatedMinutes:$('builder-minutes').value,goal:$('builder-goal').value,notes:$('builder-notes').value,exercises
    }});
    $('workout-builder-form').reset();$('builder-exercises').innerHTML='';addExerciseRow();await prepareWorkoutBuilder();
    showToast('Treino salvo no aluno.');
  }catch(e){showToast(e.message);}
  finally{setBusy('save-workout-btn',false);}
}

async function loadAgenda(){
  const d=await api('/api/admin/workouts');
  const days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo','Sem dia fixo'];const groups={};days.forEach(x=>groups[x]=[]);
  d.workouts.forEach(w=>(groups[w.dayOfWeek||'Sem dia fixo'] ||= []).push(w));
  $('agenda-list').innerHTML=d.workouts.length?days.filter(x=>groups[x].length).map(day=>`<div class="agenda-day"><div class="agenda-day-title">${day}</div>${groups[day].map(w=>`<div class="agenda-item"><div><strong>${esc(w.studentName)}</strong><div><span>${esc(w.title)} · ${w.exercises.length} exercícios</span></div></div><div class="workout-badge">${esc(w.code||'•')}</div></div>`).join('')}</div>`).join(''):emptyState('📅','Agenda vazia','Os treinos atribuídos aos alunos aparecerão aqui.');
}

async function prepareAdminMeasurements(){
  if(!state.students.length) await loadStudents();
  const s=$('prof-measure-student');
  s.innerHTML=state.students.length?`<option value="">Selecione um aluno</option>${state.students.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}`:'<option>Nenhum aluno cadastrado</option>';
  $('prof-measurements-list').innerHTML=emptyState('📈','Selecione um aluno','As medições salvas daquele aluno aparecerão aqui.');
}
async function loadAdminMeasurements(){
  const id=$('prof-measure-student').value;if(!id)return;
  const d=await api('/api/measurements?userId='+encodeURIComponent(id));
  $('prof-measurements-list').innerHTML=measurementHtml(d.measurements);
}

async function loadChatContacts(){
  const d=await api('/api/messages/contacts');state.chatContacts=d.contacts||[];
  const wrap=$('chat-contacts-list');
  wrap.innerHTML=state.chatContacts.length?state.chatContacts.map(c=>`<div class="chat-contact ${c.id===state.selectedChatPeerId?'active':''}" data-peer="${c.id}" onclick="selectChatPeer(${c.id})"><div class="chat-contact-avatar">${esc(initials(c.name))}</div><div style="min-width:0"><div class="chat-contact-name">${esc(c.name)}</div><div class="chat-contact-mail">${esc(c.email)}</div></div>${c.unread?`<div class="chat-unread">${c.unread}</div>`:''}</div>`).join(''):emptyState('💬','Nenhuma conversa disponível',state.user.role==='student'?'O chat será liberado assim que a conta do Chico estiver configurada.':'Os alunos cadastrados aparecerão aqui.');
  if(!state.selectedChatPeerId && state.chatContacts.length) state.selectedChatPeerId=state.chatContacts[0].id;
  if(state.selectedChatPeerId && state.chatContacts.some(c=>c.id===state.selectedChatPeerId)) await loadMessages();
  else renderNoChat();
  if(state.chatTimer) clearInterval(state.chatTimer);
  state.chatTimer=setInterval(async()=>{
    if($('page-mensagens')?.classList.contains('active') && state.selectedChatPeerId){
      try{await loadMessages(true);}catch{}
    }
  },2500);
}
function renderNoChat(){
  $('chat-peer-name').textContent='Selecione uma conversa';$('chat-peer-status').textContent='Mensagens ficam salvas no sistema';
  $('msg-list').innerHTML='<div class="chat-no-contact">Escolha um contato para começar.</div>';
  $('msg-input').disabled=true;
}
async function selectChatPeer(id){
  state.selectedChatPeerId=Number(id);state.lastMessageSignature='';
  document.querySelectorAll('.chat-contact').forEach(x=>x.classList.toggle('active',Number(x.dataset.peer)===state.selectedChatPeerId));
  await loadMessages();
}
async function loadMessages(silent=false){
  if(!state.selectedChatPeerId)return;
  const d=await api('/api/messages/'+state.selectedChatPeerId);
  $('chat-peer-name').textContent=d.peer.name;$('chat-peer-status').textContent='Conversa salva no banco';$('msg-input').disabled=false;
  const sig=d.messages.map(m=>m.id).join(',');
  if(sig===state.lastMessageSignature && silent)return;
  state.lastMessageSignature=sig;
  const list=$('msg-list');
  list.innerHTML=d.messages.length?d.messages.map(m=>{
    const sent=m.senderId===state.user.id;
    return `<div class="msg-wrap ${sent?'sent':'recv'}"><div class="msg-bubble ${sent?'sent':'recv'}">${esc(m.body)}</div><div class="msg-time">${fmtDateTime(m.createdAt)}</div></div>`;
  }).join(''):'<div class="chat-no-contact">Nenhuma mensagem ainda. Escreva a primeira.</div>';
  list.scrollTop=list.scrollHeight;
  const c=state.chatContacts.find(x=>x.id===state.selectedChatPeerId);if(c)c.unread=0;
  document.querySelector(`.chat-contact[data-peer="${state.selectedChatPeerId}"] .chat-unread`)?.remove();
}
async function sendMsg(){
  const input=$('msg-input'), body=input.value.trim();if(!body||!state.selectedChatPeerId)return;
  input.disabled=true;
  try{await api('/api/messages/'+state.selectedChatPeerId,{method:'POST',body:{body}});input.value='';state.lastMessageSignature='';await loadMessages();}
  catch(e){showToast(e.message);}
  finally{input.disabled=false;input.focus();}
}

function showToast(msg){
  const t=$('toast'); if(!t)return; t.textContent=msg;t.classList.add('show');clearTimeout(showToast._timer);showToast._timer=setTimeout(()=>t.classList.remove('show'),2800);
}

async function bootstrap(){
  document.querySelectorAll('.view').forEach(v=>{v.style.display='none';v.classList.remove('active');});
  $('app-shell').style.display='none';
  showView('landing');
  configurePublicContact();
  loadPublicStats();
  refreshSetupStatus();
  try{
    const d=await api('/api/me');
    if(d.user) enterApp(d.user);
  }catch{}
}
document.addEventListener('DOMContentLoaded',bootstrap);
