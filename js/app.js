// ═══════════════════════════════════════════════════════════════════════════
// ScoutMetric — App JS
// ═══════════════════════════════════════════════════════════════════════════

const API = 'http://localhost:5000/api';
const $ = id => document.getElementById(id);

// ── Helpers ────────────────────────────────────────────────────────────────
const avatarGrad = name => {
  const p = ['#2563EB,#1D4ED8','#DC2626,#991B1B','#059669,#065F46','#D97706,#92400E','#7C3AED,#4C1D95','#0891B2,#164E63','#BE185D,#831843'];
  let h = 0; for (let i=0; i<(name||'').length; i++) h=(h*31+name.charCodeAt(i))&0xffffffff;
  const [a,b]=p[Math.abs(h)%p.length].split(',');
  return `linear-gradient(135deg,${a},${b})`;
};
const initials = n => (n||'?').split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
const fmtDate = d => {
  if(!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}); } catch{return d;}
};
const fmtDateShort = d => d ? String(d).slice(0,7) : '—';

const POS = {
  'Attack':     { bg:'rgba(239,68,68,0.12)',   color:'#F87171', label:'НАП' },
  'Midfield':   { bg:'rgba(245,158,11,0.12)',  color:'#FCD34D', label:'ПЗ'  },
  'Defender':   { bg:'rgba(6,182,212,0.12)',   color:'#22D3EE', label:'ЗАЩ' },
  'Goalkeeper': { bg:'rgba(139,92,246,0.12)',  color:'#A78BFA', label:'ВР'  },
};

const posTag = (pos, sub) => {
  const p = POS[pos] || { bg:'rgba(122,140,173,0.12)', color:'#7A8CAD', label:pos||'—' };
  const lbl = (sub && sub!=='—') ? sub : (p.label||pos||'—');
  return `<span class="pos-tag" style="background:${p.bg};color:${p.color}">${lbl}</span>`;
};
const fmtMoney = v => v ? `<span class="val-green">${v}</span>` : `<span class="val-muted">—</span>`;
const ageColor = a => {
  if(!a) return '—';
  const c = a<=21?'#10B981':a<=27?'#C8D4EE':a<=32?'#F59E0B':'#EF4444';
  return `<span style="color:${c};font-weight:600;font-family:'JetBrains Mono',monospace">${a}</span>`;
};
const contractBadge = d => {
  if(!d) return `<span class="val-muted">—</span>`;
  const days = (new Date(d)-new Date())/86400000;
  const s = fmtDateShort(d);
  if(days<180) return `<span class="contract-danger">${s}</span>`;
  if(days<365) return `<span class="contract-warn">${s}</span>`;
  return `<span class="contract-ok">${s}</span>`;
};

function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className=`toast toast-${type}`;
  t.innerHTML=`<span>${{success:'✓',error:'✕',info:'i'}[type]||'i'}</span>${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800);
}

// ── Storage ────────────────────────────────────────────────────────────────
const WL = {
  get:()=>JSON.parse(localStorage.getItem('sm_wl')||'[]'),
  add(id,name,pos,club,val){
    const w=this.get();
    if(!w.find(p=>p.id===id)){
      w.push({id,name,pos,club,val,added:new Date().toISOString()});
      localStorage.setItem('sm_wl',JSON.stringify(w));
      updateSidebarStats();
    }
  },
  has:id=>WL.get().some(p=>p.id===id),
};

// NOTES: key = sm_note_{playerId}  (pure number suffix, no scout prefix)
const NOTES={
  _key:id=>'sm_note_'+id,
  get:id=>JSON.parse(localStorage.getItem('sm_note_'+id)||'null'),
  save(id,data){
    localStorage.setItem('sm_note_'+id,JSON.stringify({...data,updated:new Date().toISOString()}));
    updateSidebarStats();
  },
  // Only return notes whose key suffix is purely numeric (player IDs)
  all(){
    return Object.keys(localStorage)
      .filter(k=>k.startsWith('sm_note_') && /^sm_note_\d+$/.test(k))
      .map(k=>JSON.parse(localStorage.getItem(k)))
      .filter(Boolean);
  }
};

// Scout profile stored separately
const SCOUT_PROFILE={
  get(){
    return JSON.parse(localStorage.getItem('sm_scout_profile')||JSON.stringify({
      name:'Сәбит Абзал', role:'Старший скаут', club:'ФК Астана',
      country:'Казахстан', region:'Центр. Азия', license:'UEFA Pro',
      email:'sabyt@fcastana.kz', phone:'+7 777 123 45 67',
      dob:'1990-03-15', exp:'8', spec:'Полузащитники, Нападающие',
      ageRange:'до 25 лет', budget:'€500K — €10M', bio:'Профессиональный скаут с опытом работы в Центральной Азии и Европе. Специализация: молодые таланты, полузащитники до 25 лет.'
    }));
  },
  save(data){ localStorage.setItem('sm_scout_profile',JSON.stringify(data)); }
};

function updateSidebarStats(){
  const wl=WL.get(), notes=NOTES.all(), recs=notes.filter(n=>n.status==='recommend');
  $('wlCount').textContent=wl.length;
  $('notesCount').textContent=notes.length;
  $('recCount').textContent=recs.length;
  const b=$('watchlistBadge');
  if(b){b.textContent=wl.length;b.style.display=wl.length?'':'none';}
}

window.addToWatchlist=(id,name,pos,club,val)=>{
  WL.add(id,name,pos,club,val);
  toast(`${name} добавлен в наблюдение`,'success');
};

// ── Navigation ─────────────────────────────────────────────────────────────
const PAGE_LABELS={dashboard:'Дашборд',players:'Игроки',clubs:'Клубы',games:'Матчи',transfers:'Трансферы',ai:'AI Анализ',reports:'Отчеты',watchlist:'Наблюдение'};

function navigate(page){
  document.querySelectorAll('.nav-item[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  $('pageTitle').textContent=PAGE_LABELS[page]||page;
  const c=$('content'); c.innerHTML=''; void c.offsetWidth; c.className='content-fade';
  const mod={dashboard:DashboardModule,players:PlayersModule,clubs:ClubsModule,games:GamesModule,transfers:TransfersModule,ai:AIModule,reports:ReportsModule,watchlist:WatchlistModule};
  mod[page]?.load();
}

document.querySelectorAll('.nav-item[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
const DashboardModule=(() => {
  async function load(){
    $('content').innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка...</div>`;
    const [stats,top]=await Promise.all([
      fetch(`${API}/stats`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API}/players?per_page=8&sort_by=market_value_in_eur&sort_dir=desc`).then(r=>r.json()).catch(()=>({players:[]}))
    ]);
    render(stats, top.players||[]);
  }

  function render(stats, top){
    const wl=WL.get(), notes=NOTES.all(), recs=notes.filter(n=>n.status==='recommend');
    const today=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
    $('content').innerHTML=`
      <div class="dashboard-welcome">
        <div>
          <div class="dw-title">Добро пожаловать, Абзал</div>
          <div class="dw-sub">Сегодня <strong>${today}</strong></div>
        </div>
        <div class="dw-actions">
          <button class="btn btn-outline btn-sm" onclick="navigate('players')">Найти игрока</button>
          <button class="btn btn-primary btn-sm" onclick="navigate('watchlist')">Наблюдение (${wl.length})</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi('Игроков в базе', (stats.totalPlayers||0).toLocaleString(), '#3B82F6','rgba(37,99,235,0.12)', iconUsers())}
        ${kpi('Клубов', (stats.totalClubs||0).toLocaleString(), '#10B981','rgba(16,185,129,0.12)', iconClubs())}
        ${kpi('В наблюдении', wl.length, '#F59E0B','rgba(245,158,11,0.12)', iconEye())}
        ${kpi('Рекомендации', recs.length, '#8B5CF6','rgba(139,92,246,0.12)', iconStar())}
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><div class="card-title-dot"></div>Топ игроки по стоимости</div>
            <button class="card-action" onclick="navigate('players')">Все игроки</button>
          </div>
          <div>
            ${top.length
              ? top.map((p,i)=>`
                <div class="top-player-item" onclick="PlayersModule.openProfile(${p.player_id})">
                  <div class="tpi-rank ${['gold','silver','bronze'][i]||''}">${i+1}</div>
                  <div class="tpi-av" style="background:${avatarGrad(p.name)}">
                    ${p.image_url?`<img src="${p.image_url}" alt="" onerror="this.remove()">`:''}
                    <span>${initials(p.name)}</span>
                  </div>
                  <div class="tpi-info">
                    <div class="tpi-name">${p.name||'—'}</div>
                    <div class="tpi-sub">${p.club_name||'—'} · ${p.nationality||p.country_of_birth||'—'}</div>
                  </div>
                  ${posTag(p.position_group, p.sub_position)}
                  <div class="tpi-val">${p.market_value_fmt||'—'}</div>
                </div>`).join('')
              : `<div class="loader-wrap"><div class="spinner"></div></div>`}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card">
            <div class="card-header">
              <div class="card-title"><div class="card-title-dot" style="background:#F59E0B"></div>Ваши действия</div>
            </div>
            ${activityFeed(wl,notes)}
          </div>
          <div class="card">
            <div class="card-header">
              <div class="card-title"><div class="card-title-dot" style="background:#8B5CF6"></div>По позициям</div>
            </div>
            <div class="pos-bars">
              ${[['Нападающие','#EF4444',22543],['Полузащита','#F59E0B',35210],['Защитники','#06B6D4',28341],['Вратари','#8B5CF6',8892]].map(([l,c,n])=>{
                const total=94000; const pct=Math.round(n/total*100);
                return `<div class="pos-bar-item">
                  <div class="pos-bar-header"><span class="pos-bar-label">${l}</span><span class="pos-bar-count">${n.toLocaleString()}</span></div>
                  <div class="pos-bar-track"><div class="pos-bar-fill" style="width:${pct}%;background:${c}"></div></div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function activityFeed(wl,notes){
    if(!wl.length&&!notes.length) return `<div class="empty-state" style="padding:24px"><div class="empty-state-title">Нет активности</div><div class="empty-state-sub">Начните добавлять игроков в наблюдение</div></div>`;
    const items=[
      ...wl.slice(-4).reverse().map(p=>({label:`<strong>${p.name}</strong> добавлен в наблюдение`,time:p.added,color:'rgba(37,99,235,0.12)',dot:'#3B82F6'})),
      ...notes.slice(-3).reverse().map(n=>({label:`Заметка · ${n.status==='recommend'?'Рекомендован':n.status==='declined'?'Отклонён':'Наблюдение'}`,time:n.updated,color:n.status==='recommend'?'rgba(16,185,129,0.12)':n.status==='declined'?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',dot:n.status==='recommend'?'#10B981':n.status==='declined'?'#EF4444':'#F59E0B'}))
    ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,6);
    return `<div class="activity-feed">${items.map(it=>`
      <div class="activity-item">
        <div class="activity-icon" style="background:${it.color}"><div style="width:8px;height:8px;border-radius:50%;background:${it.dot}"></div></div>
        <div class="activity-body">
          <div class="activity-text">${it.label}</div>
          <div class="activity-time">${fmtDate(it.time)}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  const kpi=(label,value,color,bg,icon)=>`
    <div class="kpi-card" style="--kpi-color:${color};--kpi-bg:${bg}">
      <div class="kpi-top"><div class="kpi-icon">${icon}</div></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;

  const iconUsers=()=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>`;
  const iconClubs=()=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  const iconEye=()=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconStar=()=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  return { load };
})();

// ══════════════════════════════════════════════════════════════════════════
// PLAYERS MODULE
// ══════════════════════════════════════════════════════════════════════════
// ── Scout metrics (global — used by PlayersModule, WatchlistModule, miniRadarSVG) ──
const SCOUT_METRICS=[
  {key:'passing',      label:'Пас'},
  {key:'physical',     label:'Физика'},
  {key:'technique',    label:'Техника'},
  {key:'finishing',    label:'Завершение'},
  {key:'speed',        label:'Скорость'},
  {key:'dribbling',    label:'Дриблинг'},
  {key:'positioning',  label:'Позиционирование'},
  {key:'shot',         label:'Удар'},
  {key:'vision',       label:'Видение поля'},
  {key:'workrate',     label:'Работа без мяча'},
  {key:'aggression',   label:'Агрессия'},
  {key:'stamina',      label:'Выносливость'},
];

// ── Global radar SVG renderer ──────────────────────────────────────────────
function renderScoutRadarSVG(pid, vals, color){
  const W=260,H=260,cx=130,cy=130,R=88,N=vals.length;
  const ang=i=>(Math.PI*2/N)*i-Math.PI/2;
  const hex=vals.map((_,i)=>[cx+R*Math.cos(ang(i)),cy+R*Math.sin(ang(i))]);
  const dat=vals.map((m,i)=>{const r=(m.val/100)*R;return[cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];});
  const rings=[.25,.5,.75,1].map(t=>hex.map(([x,y])=>`${cx+(x-cx)*t},${cy+(y-cy)*t}`).join(' '));
  const glines=hex.map(([x,y])=>`M${cx},${cy}L${x},${y}`).join(' ');
  const dpath=dat.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
  const uid='sr'+pid+(Math.random()*1e6|0);
  const lbls=vals.map((m,i)=>{
    const lpad=32;
    const lx=cx+(R+lpad)*Math.cos(ang(i)), ly=cy+(R+lpad)*Math.sin(ang(i));
    const ta=lx<cx-6?'end':lx>cx+6?'start':'middle';
    const vx=cx+(R+lpad+14)*Math.cos(ang(i)), vy=cy+(R+lpad+14)*Math.sin(ang(i));
    return [
      `<text x="${lx}" y="${ly+2}" text-anchor="${ta}" dominant-baseline="middle" font-size="9" fill="#5A6A8A" font-family="Space Grotesk,sans-serif" font-weight="600" letter-spacing=".03em">${m.label}</text>`,
      `<text x="${vx}" y="${vy+2}" text-anchor="${ta}" dominant-baseline="middle" font-size="9" font-weight="700" fill="${color}" font-family="JetBrains Mono,monospace" id="srLblVal_${pid}_${m.key}">${m.val}</text>`
    ].join('');
  });
  return `<svg id="srSvg_${pid}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
    <defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.08"/>
    </linearGradient></defs>
    ${rings.map((pts,ri)=>`<polygon points="${pts}" fill="${ri===3?color+'08':'none'}" stroke="#1C2235" stroke-width="${ri===3?1.4:0.6}"/>`).join('')}
    <path d="${glines}" fill="none" stroke="#1C2235" stroke-width="0.6"/>
    <path id="srPath_${pid}" d="${dpath}" fill="url(#${uid})" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
    ${dat.map(([x,y],i)=>`<circle id="srDot_${pid}_${i}" cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="${color}44" stroke-width="3"/>`).join('')}
    ${lbls.join('')}
  </svg>`;
}

// ── Global radar path updater ──────────────────────────────────────────────
function updateRadarPath(pid, saved){
  const vals=SCOUT_METRICS.map(m=>({...m,val:saved[m.key]??50}));
  const cx=130,cy=130,R=88,N=vals.length;
  const ang=i=>(Math.PI*2/N)*i-Math.PI/2;
  const dat=vals.map((m,i)=>{const r=(m.val/100)*R;return[cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];});
  const dpath=dat.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
  const path=$(`srPath_${pid}`); if(path) path.setAttribute('d',dpath);
  dat.forEach(([x,y],i)=>{const d=$(`srDot_${pid}_${i}`);if(d){d.setAttribute('cx',x);d.setAttribute('cy',y);}});
}

const PlayersModule=(() => {
  let S={
    filters:{name:'',position:'',age_min:'',age_max:'',value_min:'',value_max:'',foot:'',country:'',league:'',club:'',height_min:'',height_max:'',free_agents:false,goals_min:'',assists_min:'',appearances_min:'',sort_by:'market_value_in_eur',sort_dir:'desc'},
    page:1,per_page:50,total:0,pages:1,players:[],collapsed:false
  };

  async function fetchPlayers(){
    const el=$('tBody'); if(el) el.innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка игроков...</div>`;
    const p=new URLSearchParams();
    p.set('page',S.page); p.set('per_page',S.per_page);
    Object.entries(S.filters).forEach(([k,v])=>{if(v!==''&&v!==false)p.set(k,v);});
    try{
      const data=await fetch(`${API}/players?${p}`).then(r=>r.json());
      S.players=data.players||[]; S.total=data.total||0; S.pages=data.pages||1;
      renderRows(); renderInfo(); renderPag(); renderTags();
    }catch(e){
      if(el) el.innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка подключения к серверу</div><div class="empty-state-sub">python app.py</div></div>`;
    }
  }

  function load(){
    $('content').innerHTML=buildLayout();
    fetchPlayers();
  }

  function buildLayout(){
    const f=S.filters;
    return `
    <div class="players-module">
      <div class="filter-panel">
        <div class="filter-header">
          <div class="filter-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Фильтры
            <span class="filter-badge" id="fBadge" style="display:none">0</span>
          </div>
          <div class="filter-actions">
            <button class="btn btn-ghost" style="font-size:12px" onclick="PlayersModule.reset()">Сбросить</button>
            <button class="btn btn-ghost" style="font-size:12px" onclick="PlayersModule.toggleCollapse()">
              <span id="fToggleTxt">${S.collapsed?'Раскрыть':'Свернуть'}</span>
            </button>
          </div>
        </div>
        <div id="filterBody" style="${S.collapsed?'display:none':''}">
          <div class="filter-body">
            <div class="filter-grid">

              <div class="filter-field filter-field-wide">
                <label class="filter-label">Поиск по имени</label>
                <div class="filter-input-wrap">
                  <svg class="filter-input-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input class="filter-input filter-input-search" id="f_name" type="text" placeholder="Имя игрока..."
                    value="${f.name}" oninput="PlayersModule.sf('name',this.value)"
                    onkeydown="if(event.key==='Enter')PlayersModule.apply()">
                </div>
              </div>

              <div class="filter-field filter-field-wide">
                <label class="filter-label">Позиция</label>
                <div class="pos-buttons" id="posBtns">
                  ${[['','Все','#7A8CAD','rgba(122,140,173,0.08)'],['Attack','Нападение','#F87171','rgba(239,68,68,0.12)'],['Midfield','Полузащита','#FCD34D','rgba(245,158,11,0.12)'],['Defender','Защита','#22D3EE','rgba(6,182,212,0.12)'],['Goalkeeper','Вратарь','#A78BFA','rgba(139,92,246,0.12)']].map(([v,l,c,bg])=>
                    `<button class="pos-btn${f.position===v?' active':''}" style="${f.position===v&&v?`background:${bg};color:${c};border-color:${c}44`:''}"
                      onclick="PlayersModule.setPos('${v}','${c}','${bg}')">${l}</button>`).join('')}
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Возраст</label>
                <div class="range-row">
                  <input class="filter-input range" id="f_amin" type="number" placeholder="от" min="13" max="50"
                    value="${f.age_min}" oninput="PlayersModule.sf('age_min',this.value)">
                  <span class="range-sep">—</span>
                  <input class="filter-input range" id="f_amax" type="number" placeholder="до" min="13" max="50"
                    value="${f.age_max}" oninput="PlayersModule.sf('age_max',this.value)">
                </div>
                <div class="preset-chips">
                  ${[['U-21','13','21'],['21-26','21','26'],['27-32','27','32'],['32+','32','']].map(([l,a,b])=>
                    `<span class="preset-chip" onclick="PlayersModule.agePreset('${a}','${b}')">${l}</span>`).join('')}
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Стоимость (EUR)</label>
                <div class="range-row">
                  <input class="filter-input range" id="f_vmin" type="number" placeholder="от"
                    value="${f.value_min}" oninput="PlayersModule.sf('value_min',this.value)">
                  <span class="range-sep">—</span>
                  <input class="filter-input range" id="f_vmax" type="number" placeholder="до"
                    value="${f.value_max}" oninput="PlayersModule.sf('value_max',this.value)">
                </div>
                <div class="preset-chips">
                  ${[['<1M','','1000000'],['1-10M','1000000','10000000'],['10-50M','10000000','50000000'],['50M+','50000000','']].map(([l,a,b])=>
                    `<span class="preset-chip" onclick="PlayersModule.valPreset('${a}','${b}')">${l}</span>`).join('')}
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Гражданство</label>
                <input class="filter-input" type="text" placeholder="Germany, France, Brazil..."
                  value="${f.country}" oninput="PlayersModule.sf('country',this.value)"
                  onkeydown="if(event.key==='Enter')PlayersModule.apply()">
              </div>

              <div class="filter-field">
                <label class="filter-label">Лига</label>
                <input class="filter-input" type="text" placeholder="Premier League, La Liga..."
                  value="${f.league}" oninput="PlayersModule.sf('league',this.value)"
                  onkeydown="if(event.key==='Enter')PlayersModule.apply()">
              </div>

              <div class="filter-field">
                <label class="filter-label">Клуб</label>
                <input class="filter-input" type="text" placeholder="Название клуба..."
                  value="${f.club}" oninput="PlayersModule.sf('club',this.value)"
                  onkeydown="if(event.key==='Enter')PlayersModule.apply()">
              </div>

              <div class="filter-field">
                <label class="filter-label">Рабочая нога</label>
                <div class="pos-buttons">
                  ${[['','Любая'],['right','Правая'],['left','Левая'],['both','Обе']].map(([v,l])=>
                    `<button class="pos-btn${f.foot===v?' active':''}"
                      onclick="PlayersModule.sf('foot','${v}');PlayersModule.apply()">${l}</button>`).join('')}
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Рост (см)</label>
                <div class="range-row">
                  <input class="filter-input range" type="number" placeholder="от" min="150" max="225"
                    value="${f.height_min}" oninput="PlayersModule.sf('height_min',this.value)">
                  <span class="range-sep">—</span>
                  <input class="filter-input range" type="number" placeholder="до" min="150" max="225"
                    value="${f.height_max}" oninput="PlayersModule.sf('height_max',this.value)">
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Минимальная статистика</label>
                <div style="display:flex;flex-direction:column;gap:5px">
                  ${[['Голов','goals_min'],['Передач','assists_min'],['Матчей','appearances_min']].map(([l,k])=>`
                    <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-muted)">
                      <span style="width:60px;flex-shrink:0">${l}</span>
                      <input class="filter-input" style="padding:5px 8px;font-size:11px" type="number" placeholder="0" min="0"
                        value="${f[k]}" oninput="PlayersModule.sf('${k}',this.value)">
                    </div>`).join('')}
                </div>
              </div>

              <div class="filter-field">
                <label class="filter-label">Доступность</label>
                <label class="toggle-row">
                  <input type="checkbox" ${f.free_agents?'checked':''} onchange="PlayersModule.sf('free_agents',this.checked)">
                  <span class="toggle-track"></span>
                  <span>Только свободные агенты</span>
                </label>
              </div>

            </div>
            <div class="filter-footer">
              <div class="active-filters" id="activeTags"></div>
              <button class="btn btn-primary btn-sm" onclick="PlayersModule.apply()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Найти
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="table-toolbar">
        <div class="table-info" id="tableInfo"><div class="spinner" style="width:14px;height:14px"></div></div>
        <div class="table-controls">
          <span style="font-size:11px;color:var(--text-muted)">Сортировка</span>
          <select class="sort-select" id="sortSel" onchange="PlayersModule.onSort(this.value)">
            <option value="market_value_in_eur"${S.filters.sort_by==='market_value_in_eur'?' selected':''}>По стоимости</option>
            <option value="age"${S.filters.sort_by==='age'?' selected':''}>По возрасту</option>
            <option value="name"${S.filters.sort_by==='name'?' selected':''}>По имени</option>
            <option value="height_in_cm"${S.filters.sort_by==='height_in_cm'?' selected':''}>По росту</option>
          </select>
          <button class="dir-btn" id="dirBtn" onclick="PlayersModule.toggleDir()">${dirIcon()}</button>
          <select class="perpage-select" onchange="PlayersModule.onPerPage(+this.value)">
            ${[25,50,100].map(n=>`<option value="${n}"${S.per_page===n?' selected':''}>${n}/стр</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <div class="t-head">
          <div></div><div>Игрок</div><div>Позиция</div><div>Клуб / Лига</div><div>Возраст</div>
          <div class="t-hide-lg">Гражданство</div><div class="t-hide-lg">Рост</div>
          <div class="t-hide-lg">Нога</div><div>Стоимость</div><div>Контракт</div><div></div>
        </div>
        <div id="tBody"></div>
      </div>
      <div class="pagination" id="paginator"></div>
    </div>

    <div class="prof-overlay" id="profOverlay" onclick="PlayersModule.closeProfile(event)">
      <div class="prof-modal" id="profModal"><div class="loader-wrap"><div class="spinner"></div></div></div>
    </div>`;
  }

  function dirIcon(){
    return S.filters.sort_dir==='desc'
      ?`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`
      :`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
  }

  function renderRows(){
    const el=$('tBody'); if(!el) return;
    if(!S.players.length){
      el.innerHTML=`<div class="empty-state"><div class="empty-state-title">Игроки не найдены</div><div class="empty-state-sub">Попробуйте изменить фильтры</div></div>`;
      return;
    }
    el.innerHTML=S.players.map((pl,i)=>{
      const note=NOTES.get(pl.player_id);
      const nd=note?.status?`<span class="note-dot nd-${note.status}"></span>`:'';
      const inWL=WL.has(pl.player_id);
      const footMap={'right':'П','left':'Л','both':'ОБ'};
      const footLbl=footMap[pl.foot]||pl.foot||'—';
      const footBadge=pl.foot&&pl.foot!=='—'
        ?`<span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:var(--bg-hover);color:var(--text-muted)">${footLbl}</span>`
        :`<span class="val-muted">—</span>`;
      return `
      <div class="t-row" style="animation-delay:${i*0.018}s" onclick="PlayersModule.openProfile(${pl.player_id})">
        <div class="t-cell" onclick="event.stopPropagation()">
          <div class="row-cb ${inWL?'on':''}" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="t-cell t-cell-player">
          <div class="t-avatar" style="background:${avatarGrad(pl.name)}">
            ${pl.image_url?`<img src="${pl.image_url}" alt="" onerror="this.remove()">`:''}
            <span>${initials(pl.name)}</span>
          </div>
          <div class="t-pinfo">
            <div class="t-pname">${pl.name||'—'}${nd}</div>
            <div class="t-psub">${pl.sub_position&&pl.sub_position!=='—'?pl.sub_position:''}</div>
          </div>
        </div>
        <div class="t-cell">${posTag(pl.position_group,pl.sub_position)}</div>
        <div class="t-cell" style="flex-direction:column;align-items:flex-start;gap:1px">
          <div class="t-club-name">${pl.club_name||'—'}</div>
          <div class="t-league">${pl.league&&pl.league!=='—'?pl.league:''}</div>
        </div>
        <div class="t-cell">${ageColor(pl.age)}</div>
        <div class="t-cell t-hide-lg" style="font-size:12px;color:var(--text-muted)">${pl.nationality||pl.country_of_birth||'—'}</div>
        <div class="t-cell t-hide-lg" style="font-size:12px;color:var(--text-tertiary)">${pl.height_in_cm&&String(pl.height_in_cm)!=='0'?pl.height_in_cm+' см':'<span class="val-muted">—</span>'}</div>
        <div class="t-cell t-hide-lg">${footBadge}</div>
        <div class="t-cell">${fmtMoney(pl.market_value_fmt)}</div>
        <div class="t-cell">${contractBadge(pl.contract_expiry)}</div>
        <div class="t-cell" onclick="event.stopPropagation()">
          <button class="row-action${inWL?' on':''}" onclick="addToWatchlist(${pl.player_id},'${(pl.name||'').replace(/'/g,"\\'")}','${pl.position_group||''}','${(pl.club_name||'').replace(/'/g,"\\'")}','${pl.market_value_fmt||''}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="${inWL?'currentColor':'none'}" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  function renderInfo(){
    const el=$('tableInfo'); if(!el) return;
    const s=(S.page-1)*S.per_page+1, e=Math.min(S.page*S.per_page,S.total);
    el.innerHTML=`<strong>${S.total.toLocaleString()}</strong> игроков &nbsp;·&nbsp; ${s}–${e}`;
  }

  function renderPag(){
    const el=$('paginator'); if(!el) return;
    if(S.pages<=1){el.innerHTML='';return;}
    const p=S.page,t=S.pages;
    let pgs=[...new Set([1,t,p-2,p-1,p,p+1,p+2].filter(x=>x>=1&&x<=t))].sort((a,b)=>a-b);
    let h=`<button class="pg-btn"${p<=1?' disabled':''} onclick="PlayersModule.goPage(${p-1})">‹</button>`;
    let prev=0;
    for(const pg of pgs){if(pg-prev>1)h+=`<span class="pg-dots">…</span>`;h+=`<button class="pg-btn${pg===p?' active':''}" onclick="PlayersModule.goPage(${pg})">${pg}</button>`;prev=pg;}
    h+=`<button class="pg-btn"${p>=t?' disabled':''} onclick="PlayersModule.goPage(${p+1})">›</button>`;
    el.innerHTML=h;
  }

  function renderTags(){
    const el=$('activeTags'); if(!el) return;
    const f=S.filters;
    const tags=[];
    if(f.name) tags.push([`Имя: ${f.name}`,'name','']);
    if(f.position) tags.push([f.position,'position','']);
    if(f.age_min||f.age_max) tags.push([`Возраст: ${f.age_min||'*'}–${f.age_max||'*'}`,'age_range','']);
    if(f.value_min||f.value_max) tags.push(['Стоимость','value_range','']);
    if(f.country) tags.push([f.country,'country','']);
    if(f.league) tags.push([f.league,'league','']);
    if(f.club) tags.push([f.club,'club','']);
    if(f.foot) tags.push([f.foot,'foot','']);
    if(f.goals_min) tags.push([`Голов ≥${f.goals_min}`,'goals_min','']);
    if(f.assists_min) tags.push([`Передач ≥${f.assists_min}`,'assists_min','']);
    if(f.appearances_min) tags.push([`Матчей ≥${f.appearances_min}`,'appearances_min','']);
    if(f.free_agents) tags.push(['Свободные агенты','free_agents',false]);
    const badge=$('fBadge');
    if(badge){badge.textContent=tags.length;badge.style.display=tags.length?'':'none';}
    el.innerHTML=tags.map(([l,k,d])=>`
      <span class="active-tag">${l}
        <button onclick="PlayersModule.clearTag('${k}',${JSON.stringify(d)})">×</button>
      </span>`).join('');
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  async function openProfile(pid){
    const ov=$('profOverlay'),mo=$('profModal');
    ov.classList.add('open');
    document.body.style.overflow='hidden';
    mo.innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка профиля...</div>`;
    try{
      const p=await fetch(`${API}/players/${pid}`).then(r=>r.json());
      if(p.error) throw new Error(p.error);
      mo.innerHTML=buildProfile(p);
    }catch(e){
      mo.innerHTML=`<div class="loader-wrap" style="color:var(--danger)">Ошибка загрузки профиля</div>`;
    }
  }

  function closeProfile(e){if(e&&e.target.id!=='profOverlay')return;$('profOverlay')?.classList.remove('open');document.body.style.overflow='';}

  function buildProfile(p){
    const s=p.stats||{};
    const posC=POS[p.position_group]||{color:'#7A8CAD',bg:'rgba(122,140,173,0.12)'};
    const note=NOTES.get(p.player_id)||{};
    const inWL=WL.has(p.player_id);
    const posGrads={'Attack':'rgba(239,68,68,0.1)','Midfield':'rgba(245,158,11,0.08)','Defender':'rgba(6,182,212,0.08)','Goalkeeper':'rgba(139,92,246,0.08)'};
    const heroBg=posGrads[p.position_group]||'rgba(37,99,235,0.08)';
    const days=p.contract_expiry?(new Date(p.contract_expiry)-new Date())/86400000:null;
    const nsColor={recommend:'#10B981',watching:'#F59E0B',declined:'#EF4444'};
    const nsLabel={recommend:'Рекомендован',watching:'Наблюдение',declined:'Отклонён'};
    const footMap={right:'Правая',left:'Левая',both:'Обе'};

    return `
    <button class="prof-close" onclick="PlayersModule.closeProfile({target:{id:'profOverlay'}})">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="prof-hero" style="background:linear-gradient(135deg,${heroBg},transparent 65%)">
      <div class="prof-hero-inner">
        <div class="prof-av-section">
          <div class="prof-avatar" style="background:${avatarGrad(p.name)}">
            ${p.image_url?`<img src="${p.image_url}" alt="" onerror="this.remove()">`:''}
            <span>${initials(p.name)}</span>
          </div>
          <div class="prof-pos-badge" style="background:${posC.bg};color:${posC.color}">
            ${p.sub_position&&p.sub_position!=='—'?p.sub_position:p.position_group||'—'}
          </div>
        </div>

        <div class="prof-info">
          <div class="prof-name">
            ${p.name||'—'}
            ${note.status?`<span style="background:${nsColor[note.status]}18;color:${nsColor[note.status]};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700">${nsLabel[note.status]}</span>`:''}
            ${note.score?`<span style="background:rgba(245,158,11,0.12);color:#F59E0B;padding:3px 10px;border-radius:99px;font-size:11px;font-family:'JetBrains Mono',monospace;font-weight:700">${note.score}/10</span>`:''}
          </div>
          <div class="prof-meta">
            ${p.club_name?`<div class="prof-meta-chip">${p.club_name}</div>`:''}
            ${p.league&&p.league!=='—'?`<div class="prof-meta-chip">${p.league}</div>`:''}
            ${(p.nationality||p.country_of_birth)?`<div class="prof-meta-chip">${p.nationality||p.country_of_birth}</div>`:''}
            ${p.age?`<div class="prof-meta-chip">${p.age} лет</div>`:''}
            ${p.height_in_cm&&String(p.height_in_cm)!=='0'?`<div class="prof-meta-chip">${p.height_in_cm} см</div>`:''}
            ${p.foot&&p.foot!=='—'?`<div class="prof-meta-chip">${footMap[p.foot]||p.foot} нога</div>`:''}
            ${p.market_value_fmt?`<div class="prof-meta-chip chip-value">${p.market_value_fmt}</div>`:''}
            ${p.contract_expiry?`<div class="prof-meta-chip${days&&days<365?' chip-warning':''}">до ${fmtDateShort(p.contract_expiry)}</div>`:''}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="prof-wl-btn" onclick="addToWatchlist(${p.player_id},'${(p.name||'').replace(/'/g,"\\'")}')">
            ${inWL?'В наблюдении':'+ В наблюдение'}
          </button>
          <button class="prof-wl-btn" style="background:rgba(139,92,246,0.12);border-color:rgba(139,92,246,0.3);color:#A78BFA;font-size:11px"
            onclick="openAIAnalysis(${p.player_id})">
            AI Анализ
          </button>
        </div>
      </div>
    </div>

    <div class="prof-stats-bar">
      ${[['Матчи',s.appearances||0],['Голы',s.goals||0],['Передачи',s.assists||0],['Г/матч',s.goals_per_game?s.goals_per_game.toFixed(2):0],['П/матч',s.assists_per_game?s.assists_per_game.toFixed(2):0],['Мин/матч',s.minutes_per_game?Math.round(s.minutes_per_game):0],['Жёлтые',s.yellow_cards||0],['Красные',s.red_cards||0]].map(([l,v])=>`
        <div class="psb-item"><div class="psb-value">${v}</div><div class="psb-label">${l}</div></div>`).join('')}
    </div>

    <div class="prof-body">
      <div class="prof-col">
        <div class="prof-section">
          <div class="prof-sec-title" style="justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px"><div class="sec-title-dot" style="background:${posC.color}"></div>Оценка скаута</div>
            <button class="sn-save-btn" style="padding:4px 10px;font-size:10px" onclick="PlayersModule.saveScoutRadar(${p.player_id})">Сохранить</button>
          </div>
          <div class="scout-radar-editor" id="scoutRadar_${p.player_id}">
            ${buildScoutRadarEditor(p.player_id, posC.color)}
          </div>
        </div>
        <div class="prof-section" style="flex:1">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#10B981"></div>История стоимости</div>
          <div class="value-chart">${buildValueChart(p.value_history||[],posC.color)}</div>
        </div>
      </div>

      <div class="prof-col">
        <div class="prof-section">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#3B82F6"></div>Последние матчи</div>
          ${(p.recent_matches||[]).length
            ? p.recent_matches.map(m=>`
              <div class="prof-match-item">
                <div>
                  <div class="pmatch-name">${m.match||'—'}</div>
                  <div class="pmatch-date">${m.date?fmtDateShort(m.date):''}</div>
                </div>
                <div class="pmatch-stats">
                  ${m.goals>0?`<span class="pmatch-stat pms-goal">${m.goals} гол</span>`:''}
                  ${m.assists>0?`<span class="pmatch-stat pms-assist">${m.assists} пас</span>`:''}
                  ${m.yellow_cards>0?`<span class="pmatch-stat" style="color:var(--warning)">ЖК</span>`:''}
                  ${m.red_cards>0?`<span class="pmatch-stat" style="color:var(--danger)">КК</span>`:''}
                  <span class="pmatch-stat pms-mins">${m.minutes_played||0}'</span>
                </div>
              </div>`).join('')
            :`<div class="empty-state" style="padding:18px"><div style="font-size:12px;color:var(--text-muted)">Нет данных о матчах</div></div>`}
        </div>
        <div class="prof-section" style="flex:1">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#F59E0B"></div>Трансферная история</div>
          ${(p.transfers||[]).length
            ? p.transfers.map(t=>`
              <div class="prof-transfer-item">
                <div class="ptr-clubs">${t.from}<span class="ptr-arrow"> → </span>${t.to}</div>
                <div class="ptr-meta">
                  <div class="ptr-fee">${t.fee||'Бесплатно'}</div>
                  <div class="ptr-season">${t.season||t.date||''}</div>
                </div>
              </div>`).join('')
            :`<div class="empty-state" style="padding:18px"><div style="font-size:12px;color:var(--text-muted)">Нет данных о трансферах</div></div>`}
        </div>
      </div>

      <div class="prof-col">
        <div class="prof-section">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#8B5CF6"></div>Данные игрока</div>
          <table class="prof-info-table">
            ${[
              ['Дата рождения', fmtDate(p.date_of_birth)],
              ['Гражданство', p.nationality||p.country_of_citizenship||'—'],
              ['Страна рождения', p.country_of_birth||'—'],
              ['Рост', p.height_in_cm&&String(p.height_in_cm)!=='0'?p.height_in_cm+' см':'—'],
              ['Рабочая нога', footMap[p.foot]||p.foot||'—'],
              ['Контракт до', p.contract_expiry?fmtDateShort(p.contract_expiry):'—'],
              ['Агент', p.agent||'—'],
            ].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
          </table>
        </div>

        <div class="prof-section" style="flex:1">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#EC4899"></div>Заметка скаута</div>
          <div class="scout-note-panel" id="snPanel_${p.player_id}">
            <div class="sn-status-row">
              ${[['recommend','Рекомендую','#10B981'],['watching','Наблюдаю','#F59E0B'],['declined','Отклонён','#EF4444']].map(([v,l,c])=>`
                <button class="sn-status-btn${note.status===v?' active':''}"
                  style="${note.status===v?`background:${c}18;color:${c};border-color:${c}44`:''}"
                  onclick="PlayersModule.setStatus(${p.player_id},'${v}','${c}')">${l}</button>`).join('')}
            </div>
            <div class="sn-score-row">
              <span class="sn-score-label">Оценка</span>
              <div class="sn-scores" id="snScores_${p.player_id}">
                ${[1,2,3,4,5,6,7,8,9,10].map(n=>`
                  <button class="sn-score-btn${(note.score||0)>=n?' active':''}"
                    onclick="PlayersModule.setScore(${p.player_id},${n})">${n}</button>`).join('')}
              </div>
            </div>
            <textarea class="sn-textarea" id="snText_${p.player_id}" rows="5"
              placeholder="Техника, тактика, физика, ментальность, потенциал...">${note.comment||''}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="sn-save-btn" style="flex:1" onclick="PlayersModule.saveNote(${p.player_id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Сохранить
              </button>
              <button class="sn-save-btn" style="flex:1;background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.3);color:#10B981"
                onclick="PlayersModule.sendToReports(${p.player_id},'${(p.name||'').replace(/'/g,"\\'")}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                В отчёт
              </button>
            </div>
            ${note.updated?`<div class="sn-updated">Обновлено: ${note.updated.slice(0,10)}${note.inReport?` · <span style="color:#10B981">В отчёте</span>`:''}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Scout Radar (manual) ──────────────────────────────────────────────────

  function buildScoutRadarEditor(pid, color){
    const saved=JSON.parse(localStorage.getItem('sm_radar_'+pid)||'{}');
    const vals=SCOUT_METRICS.map(m=>({...m,val:saved[m.key]??50}));
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
      <div>${renderScoutRadarSVG(pid, vals, color)}</div>
      <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px 20px">
        ${vals.map(m=>`
        <div class="sr-slider-row">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.05em">${m.label.toUpperCase()}</span>
            <span id="srVal_${pid}_${m.key}" style="font-size:10px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace">${m.val}</span>
          </div>
          <input type="range" class="sr-slider" min="0" max="100" value="${m.val}"
            style="--sc:${color}"
            oninput="PlayersModule.updateRadarSlider(${pid},'${m.key}',+this.value,'${color}')">
        </div>`).join('')}
      </div>
    </div>`;
  }


  function updateRadarSlider(pid, key, val, color){
    const lbl=$(`srVal_${pid}_${key}`); if(lbl) lbl.textContent=val;
    const lblV=$(`srLblVal_${pid}_${key}`); if(lblV) lblV.textContent=val;
    const saved=JSON.parse(localStorage.getItem('sm_radar_'+pid)||'{}');
    saved[key]=val;
    localStorage.setItem('sm_radar_'+pid,JSON.stringify(saved));
    updateRadarPath(pid, saved);
  }

  function saveScoutRadar(pid){
    toast('Характеристики сохранены','success');
    updateSidebarStats();renderSbpHeatmap();
  }

  function buildRadar(s,pos,color){
    let metrics;
    if(pos==='Goalkeeper') metrics=[['Матчи',Math.min(100,(s.appearances||0)/50*100)],['Надёжность',Math.max(0,100-(s.yellow_cards||0)*10)],['Активность',Math.min(100,(s.minutes_per_game||0)/90*100)],['Опыт',Math.min(100,(s.appearances||0)/200*100)],['Дисциплина',Math.max(0,100-(s.yellow_cards||0)*8)],['Стабильность',Math.min(100,(s.appearances||0)>10?75:(s.appearances||0)*8)]];
    else if(pos==='Defender') metrics=[['Матчи',Math.min(100,(s.appearances||0)/50*100)],['Голы',Math.min(100,(s.goals||0)/10*100)],['Передачи',Math.min(100,(s.assists||0)/5*100)],['Дисциплина',Math.max(0,100-(s.yellow_cards||0)*8)],['Активность',Math.min(100,(s.minutes_per_game||0)/90*100)],['Опыт',Math.min(100,(s.appearances||0)/200*100)]];
    else if(pos==='Midfield') metrics=[['Матчи',Math.min(100,(s.appearances||0)/50*100)],['Голы',Math.min(100,(s.goals||0)/20*100)],['Передачи',Math.min(100,(s.assists||0)/15*100)],['Г/матч',Math.min(100,(s.goals_per_game||0)*200)],['П/матч',Math.min(100,(s.assists_per_game||0)*200)],['Активность',Math.min(100,(s.minutes_per_game||0)/90*100)]];
    else metrics=[['Матчи',Math.min(100,(s.appearances||0)/50*100)],['Голы',Math.min(100,(s.goals||0)/50*100)],['Передачи',Math.min(100,(s.assists||0)/20*100)],['Г/матч',Math.min(100,(s.goals_per_game||0)*150)],['П/матч',Math.min(100,(s.assists_per_game||0)*200)],['Активность',Math.min(100,(s.minutes_per_game||0)/90*100)]];
    const cx=115,cy=115,R=80,N=6;
    const ang=i=>(Math.PI*2/N)*i-Math.PI/2;
    const hex=metrics.map((_,i)=>[cx+R*Math.cos(ang(i)),cy+R*Math.sin(ang(i))]);
    const dat=metrics.map(([,v],i)=>{const r=(v/100)*R;return[cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];});
    const rings=[.25,.5,.75,1].map(t=>hex.map(([x,y])=>`${cx+(x-cx)*t},${cy+(y-cy)*t}`).join(' '));
    const glines=hex.map(([x,y])=>`M${cx},${cy}L${x},${y}`).join(' ');
    const dpath=dat.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
    const uid='r'+Date.now();
    const lbls=metrics.map(([l,v],i)=>{
      const lx=cx+(R+24)*Math.cos(ang(i)),ly=cy+(R+24)*Math.sin(ang(i));
      const ta=lx<cx-4?'end':lx>cx+4?'start':'middle';
      return `<text x="${lx}" y="${ly-2}" text-anchor="${ta}" font-size="9" fill="#4E5E7A" font-family="Space Grotesk,sans-serif" font-weight="600" letter-spacing=".04em">${l.toUpperCase()}</text>
              <text x="${lx}" y="${ly+10}" text-anchor="${ta}" font-size="10.5" fill="${color}" font-family="JetBrains Mono,monospace" font-weight="700">${Math.round(v)}</text>`;
    });
    return `<svg width="230" height="230" viewBox="0 0 230 230" style="display:block;margin:0 auto">
      <defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.4"/><stop offset="100%" stop-color="${color}" stop-opacity="0.1"/></linearGradient></defs>
      ${rings.map((pts,ri)=>`<polygon points="${pts}" fill="none" stroke="#1C2235" stroke-width="${ri===3?1.5:0.8}"/>`).join('')}
      <path d="${glines}" fill="none" stroke="#1C2235" stroke-width="0.8"/>
      <path d="${dpath}" fill="url(#${uid})" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
      ${dat.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`).join('')}
      ${lbls.join('')}
    </svg>`;
  }

  function buildValueChart(hist,color){
    if(!hist||hist.length<2) return `<div style="padding:14px;font-size:11px;color:var(--text-muted);text-align:center">Нет данных об истории стоимости</div>`;
    const vals=hist.map(h=>h.value||0),maxV=Math.max(...vals),minV=Math.min(...vals);
    const W=240,H=68,pad=6;
    const pts=hist.map((h,i)=>{
      const x=pad+(i/(hist.length-1))*(W-pad*2);
      const y=H-pad-(maxV===minV?H/2:(h.value-minV)/(maxV-minV)*(H-pad*2));
      return[x,y];
    });
    const line=pts.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ');
    const area=`M${pts[0][0]},${pts[0][1]} ${pts.slice(1).map(([x,y])=>`L${x},${y}`).join(' ')} L${W-pad},${H} L${pad},${H} Z`;
    const uid='vc'+Date.now();
    const fmt=v=>v>=1e6?`€${(v/1e6).toFixed(1)}M`:v>=1e3?`€${(v/1e3).toFixed(0)}K`:`€${v}`;
    return `<div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
        <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#${uid})"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px">
        <span>${fmtDateShort(hist[0]?.date)}</span>
        <span style="color:var(--success);font-family:'JetBrains Mono',monospace;font-weight:700">${fmt(hist[hist.length-1]?.value||0)}</span>
        <span>${fmtDateShort(hist[hist.length-1]?.date)}</span>
      </div>
    </div>`;
  }

  function setStatus(pid,status,color){
    const panel=$(`snPanel_${pid}`);if(!panel)return;
    panel.querySelectorAll('.sn-status-btn').forEach(b=>{
      const v=b.getAttribute('onclick').match(/'([^']*)'/)?.[1];
      const on=v===status;
      b.classList.toggle('active',on);
      b.style.cssText=on?`background:${color}18;color:${color};border-color:${color}44`:'';
    });
    const note=NOTES.get(pid)||{};note.status=status;note.player_id=pid;NOTES.save(pid,note);
  }
  function setScore(pid,score){
    const c=$(`snScores_${pid}`);if(!c)return;
    c.querySelectorAll('.sn-score-btn').forEach((b,i)=>b.classList.toggle('active',i<score));
    const note=NOTES.get(pid)||{};note.score=score;note.player_id=pid;NOTES.save(pid,note);
  }
  function saveNote(pid){
    const ta=$(`snText_${pid}`);if(!ta)return;
    const note=NOTES.get(pid)||{};note.comment=ta.value;note.player_id=pid;NOTES.save(pid,note);
    toast('Заметка сохранена','success');updateSidebarStats();renderSbpHeatmap();
  }

  function sf(k,v){S.filters[k]=v;}
  function setPos(v,c,bg){
    S.filters.position=v;
    document.querySelectorAll('#posBtns .pos-btn').forEach(b=>{
      const bv=b.getAttribute('onclick').match(/'([^']*)'/)?.[1]||'';
      const on=bv===v;b.classList.toggle('active',on);
      b.style.cssText=(on&&v)?`background:${bg};color:${c};border-color:${c}44`:'';
    });
    apply();
  }
  function agePreset(a,b){S.filters.age_min=a;S.filters.age_max=b;const fa=$('f_amin'),fb=$('f_amax');if(fa)fa.value=a;if(fb)fb.value=b;}
  function valPreset(a,b){S.filters.value_min=a;S.filters.value_max=b;const fa=$('f_vmin'),fb=$('f_vmax');if(fa)fa.value=a;if(fb)fb.value=b;}
  function apply(){S.page=1;fetchPlayers();}
  function reset(){S.filters={name:'',position:'',age_min:'',age_max:'',value_min:'',value_max:'',foot:'',country:'',league:'',club:'',height_min:'',height_max:'',free_agents:false,goals_min:'',assists_min:'',appearances_min:'',sort_by:'market_value_in_eur',sort_dir:'desc'};S.page=1;load();}
  function clearTag(k,d){if(k==='age_range'){S.filters.age_min='';S.filters.age_max='';}else if(k==='value_range'){S.filters.value_min='';S.filters.value_max='';}else S.filters[k]=d;apply();}
  function onSort(v){S.filters.sort_by=v;S.page=1;fetchPlayers();}
  function toggleDir(){S.filters.sort_dir=S.filters.sort_dir==='desc'?'asc':'desc';const b=$('dirBtn');if(b)b.innerHTML=dirIcon();S.page=1;fetchPlayers();}
  function onPerPage(n){S.per_page=n;S.page=1;fetchPlayers();}
  function goPage(n){if(n<1||n>S.pages)return;S.page=n;fetchPlayers();document.querySelector('.players-module')?.scrollIntoView({behavior:'smooth'});}
  function toggleCollapse(){S.collapsed=!S.collapsed;const b=$('filterBody'),t=$('fToggleTxt');if(b)b.style.display=S.collapsed?'none':'';if(t)t.textContent=S.collapsed?'Раскрыть':'Свернуть';}

  function sendToReports(pid, name){
    const ta=$(`snText_${pid}`);
    const note=NOTES.get(pid)||{};
    if(ta) note.comment=ta.value;
    note.player_id=pid;
    note.inReport=true;
    note.reportedAt=new Date().toISOString();
    NOTES.save(pid,note);
    toast(`${name} добавлен в отчёт`,'success');
    updateSidebarStats();renderSbpHeatmap();
  }

  return{load,openProfile,closeProfile,sf,setPos,agePreset,valPreset,apply,reset,clearTag,onSort,toggleDir,onPerPage,goPage,toggleCollapse,setStatus,setScore,saveNote,sendToReports,updateRadarSlider,saveScoutRadar};
})();
window.PlayersModule=PlayersModule;

// ══════════════════════════════════════════════════════════════════════════
// CLUBS MODULE
// ══════════════════════════════════════════════════════════════════════════
const ClubsModule=(() => {
  let S={page:1,per_page:50,total:0,pages:1};
  async function load(){$('content').innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка клубов...</div>`;await fetch_();}
  async function fetch_(){
    try{
      const data=await fetch(`${API}/clubs?page=${S.page}&per_page=${S.per_page}`).then(r=>r.json());
      S.total=data.total||0;S.pages=Math.ceil(S.total/S.per_page);render(data.clubs||[]);
    }catch(e){$('content').innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка подключения</div></div>`;}
  }
  function render(clubs){
    $('content').innerHTML=`
    <div class="players-module">
      <div class="table-toolbar">
        <div class="table-info"><strong>${S.total.toLocaleString()}</strong> клубов</div>
        <div class="table-controls">
          <select class="perpage-select" onchange="ClubsModule.onPerPage(+this.value)">
            ${[25,50,100].map(n=>`<option value="${n}"${S.per_page===n?' selected':''}>${n}/стр</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:2.5fr 2fr 70px 80px 80px 1.5fr 100px">
          <div>Клуб</div><div>Лига</div><div>Игроков</div><div>Ср. возраст</div><div>Легионеры</div><div>Стадион</div><div>Вместимость</div>
        </div>
        <div>${clubs.map((c,i)=>`
          <div class="t-row" style="grid-template-columns:2.5fr 2fr 70px 80px 80px 1.5fr 100px;animation-delay:${i*0.018}s;cursor:pointer" onclick='openClubDetail(${JSON.stringify(c).replace(/'/g,"&apos;")})'>
            <div class="t-cell t-cell-player">
              <div class="t-avatar" style="background:${avatarGrad(c.name)};border-radius:8px"><span style="font-size:9px">${initials(c.name)}</span></div>
              <div class="t-pinfo"><div class="t-pname">${c.name||'—'}</div></div>
            </div>
            <div class="t-cell" style="font-size:12px;color:var(--text-tertiary)">${c.competition_name||'—'}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:12px">${c.squad_size||'—'}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:12px">${c.avg_age||'—'}</div>
            <div class="t-cell" style="font-size:12px;color:var(--text-muted)">${c.foreigners_number??'—'}</div>
            <div class="t-cell" style="font-size:11px;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.stadium||'—'}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:12px">${c.capacity?Number(c.capacity).toLocaleString():'—'}</div>
          </div>`).join('')}</div>
      </div>
      <div class="pagination">${buildPag(S.page,S.pages,'ClubsModule')}</div>
    </div>`;
  }
  function onPerPage(n){S.per_page=n;S.page=1;fetch_();}
  function goPage(n){if(n<1||n>S.pages)return;S.page=n;fetch_();}
  return{load,onPerPage,goPage};
})();

// ══════════════════════════════════════════════════════════════════════════
// GAMES MODULE
// ══════════════════════════════════════════════════════════════════════════
const GamesModule=(() => {
  let S={page:1,per_page:50,total:0,pages:1};
  async function load(){$('content').innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка матчей...</div>`;await fetch_();}
  async function fetch_(){
    try{
      const data=await fetch(`${API}/games?page=${S.page}&per_page=${S.per_page}`).then(r=>r.json());
      S.total=data.total||0;S.pages=Math.ceil(S.total/S.per_page);render(data.games||[]);
    }catch(e){$('content').innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка подключения</div></div>`;}
  }
  function render(games){
    $('content').innerHTML=`
    <div class="players-module">
      <div class="table-toolbar">
        <div class="table-info"><strong>${S.total.toLocaleString()}</strong> матчей</div>
        <div class="table-controls">
          <select class="perpage-select" onchange="GamesModule.onPerPage(+this.value)">
            ${[25,50,100].map(n=>`<option value="${n}"${S.per_page===n?' selected':''}>${n}/стр</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:2fr 90px 2fr 1.5fr 90px 80px">
          <div>Хозяева</div><div style="text-align:center">Счёт</div><div>Гости</div><div>Турнир</div><div>Дата</div><div>Сезон</div>
        </div>
        <div>${games.map((g,i)=>`
          <div class="t-row" style="grid-template-columns:2fr 90px 2fr 1.5fr 90px 80px;animation-delay:${i*0.018}s;cursor:pointer" onclick='openGameDetail(${JSON.stringify(g).replace(/'/g,"&apos;")})'>
            <div class="t-cell" style="font-weight:600;font-size:13px;color:var(--text-primary)">${g.home_club_name||'—'}</div>
            <div class="t-cell" style="justify-content:center">
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;color:var(--text-primary);background:var(--bg-hover);padding:3px 10px;border-radius:6px">${g.home_club_goals??'?'} : ${g.away_club_goals??'?'}</span>
            </div>
            <div class="t-cell" style="font-weight:500;font-size:13px">${g.away_club_name||'—'}</div>
            <div class="t-cell" style="font-size:11px;color:var(--text-muted)">${g.competition_name||'—'}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary)">${fmtDateShort(g.date)}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${g.season||'—'}</div>
          </div>`).join('')}</div>
      </div>
      <div class="pagination">${buildPag(S.page,S.pages,'GamesModule')}</div>
    </div>`;
  }
  function onPerPage(n){S.per_page=n;S.page=1;fetch_();}
  function goPage(n){if(n<1||n>S.pages)return;S.page=n;fetch_();}
  return{load,onPerPage,goPage};
})();

// ══════════════════════════════════════════════════════════════════════════
// TRANSFERS MODULE
// ══════════════════════════════════════════════════════════════════════════
const TransfersModule=(() => {
  let S={page:1,per_page:50,total:0,pages:1};
  async function load(){$('content').innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка трансферов...</div>`;await fetch_();}
  async function fetch_(){
    try{
      const data=await fetch(`${API}/transfers?page=${S.page}&per_page=${S.per_page}`).then(r=>r.json());
      S.total=data.total||0;S.pages=Math.ceil(S.total/S.per_page);render(data.transfers||[]);
    }catch(e){$('content').innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка подключения</div></div>`;}
  }
  function render(transfers){
    $('content').innerHTML=`
    <div class="players-module">
      <div class="table-toolbar">
        <div class="table-info"><strong>${S.total.toLocaleString()}</strong> трансферов</div>
        <div class="table-controls">
          <select class="perpage-select" onchange="TransfersModule.onPerPage(+this.value)">
            ${[25,50,100].map(n=>`<option value="${n}"${S.per_page===n?' selected':''}>${n}/стр</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:2fr 1.5fr 1.5fr 1.2fr 90px 80px">
          <div>Игрок</div><div>Откуда</div><div>Куда</div><div>Сумма</div><div>Дата</div><div>Сезон</div>
        </div>
        <div>${transfers.map((t,i)=>`
          <div class="t-row" style="grid-template-columns:2fr 1.5fr 1.5fr 1.2fr 90px 80px;animation-delay:${i*0.018}s;cursor:pointer" onclick='openTransferDetail(${JSON.stringify(t).replace(/'/g,"&apos;")})'>
            <div class="t-cell t-cell-player">
              <div class="t-avatar" style="background:${avatarGrad(t.player_name)}"><span>${initials(t.player_name)}</span></div>
              <div class="t-pinfo"><div class="t-pname">${t.player_name||'—'}</div></div>
            </div>
            <div class="t-cell" style="font-size:12px;color:var(--text-tertiary)">${t.from_club||'—'}</div>
            <div class="t-cell" style="font-size:12px;color:var(--text-primary);font-weight:500">${t.to_club||'—'}</div>
            <div class="t-cell">${t.fee_fmt?`<span class="val-green">${t.fee_fmt}</span>`:`<span class="val-muted">Своб.</span>`}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${fmtDateShort(t.date)}</div>
            <div class="t-cell" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${t.season||'—'}</div>
          </div>`).join('')}</div>
      </div>
      <div class="pagination">${buildPag(S.page,S.pages,'TransfersModule')}</div>
    </div>`;
  }
  function onPerPage(n){S.per_page=n;S.page=1;fetch_();}
  function goPage(n){if(n<1||n>S.pages)return;S.page=n;fetch_();}
  return{load,onPerPage,goPage};
})();

// ══════════════════════════════════════════════════════════════════════════
// AI MODULE
// ══════════════════════════════════════════════════════════════════════════
const AIModule=(() => {
  let activeTab='match';
  const chatHistory = [];
  const interviewState = {
    sessionId: '',
    session: null,
  };
  const QUICK_QUESTIONS = [
    'Топ-10 нападающих до 25 лет',
    'Найди игроков из Казахстана',
    'Статистика базы данных',
    'Лучшие центральные защитники',
    'Свободные агенты — нападающие',
  ];
  function _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _mdToHtml(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-hover);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
      .replace(/^#{1,3}\s+(.+)$/gm, '<div style="font-weight:700;color:var(--text-primary);margin:8px 0 4px">$1</div>')
      .replace(/^[-•]\s+(.+)$/gm, '<div style="padding-left:12px;margin:2px 0">• $1</div>')
      .replace(/\n{2,}/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }
  function quickAsk(text) {
    const inp = $('aiChatInput');
    if (inp) { inp.value = text; }
    sendChat();
  }

  function load(){
    $('content').innerHTML=`
    <div class="ai-header">
      <div class="ai-header-title">
        <div class="ai-pulse"></div>
        AI Анализ
      </div>
      <div style="font-size:12px;color:var(--text-muted)">Прогнозы и анализ на основе реальных данных</div>
    </div>
    <div class="report-tabs" style="margin-bottom:24px">
      ${[['match','Предикт матча'],['player','Анализ игрока'],['assistant','Ассистент'],['interview','Адаптивное интервью']].map(([id,label])=>
        `<button class="report-tab${activeTab===id?' active':''}" onclick="AIModule.tab('${id}')">${label}</button>`).join('')}
    </div>
    <div id="aiBody"></div>`;
    renderTab();
  }

  function tab(t){ activeTab=t; load(); }

  function renderTab(){
    if(activeTab==='match')   renderMatch();
    else if(activeTab==='player') renderPlayer();
    else if(activeTab==='assistant') renderAssistant();
    else renderInterview();
  }

  // ── MATCH PREDICT ─────────────────────────────────────────────────────────
  async function renderMatch(){
    $('aiBody').innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Загрузка матчей...</div>`;
    const matches=await fetch(`${API}/ai/upcoming_matches`).then(r=>r.json()).catch(()=>[]);
    if(!matches.length){ $('aiBody').innerHTML=`<div class="empty-state"><div class="empty-state-title">Нет данных о матчах</div></div>`; return; }

    $('aiBody').innerHTML=`
    <div class="ai-section-title">Выберите матч для прогноза</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-bottom:28px" id="matchGrid">
      ${matches.map(m=>`
      <div class="ai-match-card" onclick="AIModule.predictMatch(${m.home_club_id},${m.away_club_id},'${(m.home_club_name||'').replace(/'/g,"\\'")}','${(m.away_club_name||'').replace(/'/g,"\\'")}')">
        <div style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.08em;margin-bottom:8px">${m.competition} · ${m.date} · ${m.season}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="flex:1;text-align:right;font-size:13px;font-weight:700;color:var(--text-primary)">${m.home_club_name}</div>
          <div style="padding:4px 10px;background:var(--bg-hover);border-radius:6px;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:12px;color:var(--text-muted)">vs</div>
          <div style="flex:1;font-size:13px;font-weight:700;color:var(--text-primary)">${m.away_club_name}</div>
        </div>
      </div>`).join('')}
    </div>
    <div id="matchResult"></div>`;
  }

  async function predictMatch(homeId, awayId, homeName, awayName){
    const res=$('matchResult'); if(!res) return;
    res.innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Анализирую ${homeName} vs ${awayName}...</div>`;
    res.scrollIntoView({behavior:'smooth'});
    try{
      const data=await fetch(`${API}/ai/predict_match`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({home_club_id:homeId,away_club_id:awayId})
      }).then(r=>r.json());

      const pr=data.probabilities||{};
      const hs=data.home_stats||{};
      const as_=data.away_stats||{};
      const h2h=data.head_to_head||[];

      res.innerHTML=`
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-title-dot" style="background:#8B5CF6"></div>Прогноз матча</div>
          <span style="font-size:10px;color:var(--text-muted)">Точность: ${data.confidence}</span>
        </div>

        <!-- Score prediction -->
        <div style="text-align:center;padding:32px 20px 24px">
          <div style="font-size:12px;color:var(--text-muted);letter-spacing:.08em;margin-bottom:16px">ПРЕДСКАЗАННЫЙ СЧЁТ</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:20px">
            <div style="flex:1;text-align:right">
              <div class="t-avatar" style="background:${avatarGrad(homeName)};border-radius:10px;width:48px;height:48px;margin:0 0 8px auto"><span>${initials(homeName)}</span></div>
              <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${homeName}</div>
              <div style="font-size:11px;color:var(--text-muted)">Хозяева</div>
            </div>
            <div style="text-align:center;flex-shrink:0">
              <div style="font-size:56px;font-weight:900;font-family:'JetBrains Mono',monospace;color:var(--text-primary);line-height:1;letter-spacing:-4px">${data.predicted_score}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:6px">Ожидаемые голы</div>
              <div style="font-size:12px;color:var(--accent-bright);font-family:'JetBrains Mono',monospace;font-weight:700">${data.predicted_home_goals} — ${data.predicted_away_goals}</div>
            </div>
            <div style="flex:1">
              <div class="t-avatar" style="background:${avatarGrad(awayName)};border-radius:10px;width:48px;height:48px;margin:0 auto 8px"><span>${initials(awayName)}</span></div>
              <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${awayName}</div>
              <div style="font-size:11px;color:var(--text-muted)">Гости</div>
            </div>
          </div>
        </div>

        <!-- Probabilities bar -->
        <div style="padding:0 20px 24px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:10px">ВЕРОЯТНОСТЬ ИСХОДА</div>
          <div style="display:flex;border-radius:8px;overflow:hidden;height:28px">
            <div style="width:${pr.home_win}%;background:#10B981;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;min-width:36px">${pr.home_win}%</div>
            <div style="width:${pr.draw}%;background:#F59E0B;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;min-width:36px">${pr.draw}%</div>
            <div style="width:${pr.away_win}%;background:#EF4444;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;min-width:36px">${pr.away_win}%</div>
          </div>
          <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:var(--text-muted)">
            <span><span style="color:#10B981">●</span> Победа хозяев</span>
            <span><span style="color:#F59E0B">●</span> Ничья</span>
            <span><span style="color:#EF4444">●</span> Победа гостей</span>
          </div>
        </div>

        <!-- Stats comparison -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:0 20px 24px">
          ${[['Победы (посл. 20)',hs.wins,as_.wins,'#10B981'],['Ср. голов забито',hs.goals_scored,as_.goals_scored,'#3B82F6'],['Ср. голов пропущено',hs.goals_conceded,as_.goals_conceded,'#EF4444']].map(([label,hv,av,c])=>`
          <div style="grid-column:span 2">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;display:flex;justify-content:space-between">
              <span style="font-weight:600">${hv}</span><span>${label}</span><span style="font-weight:600">${av}</span>
            </div>
            <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px">
              <div style="flex:${hv||0.1};background:${c};border-radius:3px 0 0 3px"></div>
              <div style="flex:${av||0.1};background:${c}66;border-radius:0 3px 3px 0"></div>
            </div>
          </div>`).join('')}
        </div>

        <!-- H2H -->
        ${h2h.length?`
        <div style="padding:0 20px 24px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:10px">ЛИЧНЫЕ ВСТРЕЧИ</div>
          ${h2h.map(g=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-dim);font-size:12px">
            <span style="color:var(--text-muted)">${g.date}</span>
            <span style="color:var(--text-primary)">${g.home}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent-bright)">${g.score}</span>
            <span style="color:var(--text-primary)">${g.away}</span>
          </div>`).join('')}
        </div>`:''}
      </div>`;
    }catch(e){
      res.innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка анализа</div><div class="empty-state-sub">Убедитесь что сервер запущен</div></div>`;
    }
  }

  // ── PLAYER ANALYSIS ───────────────────────────────────────────────────────
  function renderPlayer(){
    $('aiBody').innerHTML=`
    <div class="ai-section-title">Введите ID или имя игрока для анализа</div>
    <div style="display:flex;gap:10px;margin-bottom:24px">
      <div class="filter-input-wrap" style="flex:1">
        <svg class="filter-input-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="filter-input filter-input-search" id="aiPlayerSearch" type="text" placeholder="Имя игрока или ID..."
          onkeydown="if(event.key==='Enter')AIModule.searchPlayer()">
      </div>
      <button class="btn btn-primary" onclick="AIModule.searchPlayer()">Анализировать</button>
    </div>
    <div id="aiPlayerResult"></div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:12px">
      Подсказка: нажмите «Анализ AI» в профиле любого игрока для быстрого анализа
    </div>`;
  }

  async function searchPlayer(){
    const q=($('aiPlayerSearch')?.value||'').trim(); if(!q) return;
    const res=$('aiPlayerResult'); if(!res) return;
    res.innerHTML=`<div class="loader-wrap"><div class="spinner"></div>Поиск...</div>`;

    // Try as ID first, then search by name
    let pid=parseInt(q);
    if(isNaN(pid)){
      // Search by name via players API
      const found=await fetch(`${API}/players?name=${encodeURIComponent(q)}&per_page=1`).then(r=>r.json()).catch(()=>({players:[]}));
      if(!found.players?.length){ res.innerHTML=`<div class="empty-state"><div class="empty-state-title">Игрок не найден</div></div>`; return; }
      pid=found.players[0].player_id;
    }
    analyzePlayer(pid);
  }

  async function analyzePlayer(pid){
    const res=$('aiPlayerResult'); if(!res) return;
    res.innerHTML=`<div class="loader-wrap"><div class="spinner"></div>AI анализирует игрока...</div>`;
    try{
      const [data, prof]=await Promise.all([
        fetch(`${API}/ai/analyze_player/${pid}`).then(r=>r.json()),
        fetch(`${API}/players/${pid}`).then(r=>r.json()).catch(()=>({}))
      ]);
      if(data.error){ res.innerHTML=`<div class="empty-state"><div class="empty-state-title">${data.error}</div></div>`; return; }

      const s=prof.stats||{};
      const potColor=data.potential_score>=80?'#10B981':data.potential_score>=60?'#F59E0B':'#EF4444';
      const trendIcon=data.value_trend==='растёт'?'↑':data.value_trend==='падает'?'↓':'→';
      const trendColor=data.value_trend==='растёт'?'#10B981':data.value_trend==='падает'?'#EF4444':'#7A8CAD';

      res.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- Left: Main analysis -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title"><div class="card-title-dot" style="background:#8B5CF6"></div>Общая оценка</div></div>
            <div style="padding:20px">
              <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
                <div class="t-avatar" style="background:${avatarGrad(data.name)};width:52px;height:52px;border-radius:12px">
                  ${prof.image_url?`<img src="${prof.image_url}" alt="" onerror="this.remove()" style="width:100%;height:100%;border-radius:12px;object-fit:cover">`:''}
                  <span>${initials(data.name)}</span>
                </div>
                <div>
                  <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${data.name}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${data.position} · ${data.age} лет · ${data.peak_age_range} пик</div>
                </div>
              </div>

              <!-- Potential bar -->
              <div style="margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em">ПОТЕНЦИАЛ</span>
                  <span style="font-size:14px;font-weight:800;color:${potColor};font-family:'JetBrains Mono',monospace">${data.potential_score}/100</span>
                </div>
                <div style="height:8px;background:var(--bg-hover);border-radius:4px;overflow:hidden">
                  <div style="width:${data.potential_score}%;height:100%;background:linear-gradient(90deg,${potColor}88,${potColor});border-radius:4px;transition:width .6s"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${data.potential_stage}</div>
              </div>

              <!-- Buy recommendation -->
              <div style="background:${data.buy_color}12;border:1px solid ${data.buy_color}30;border-radius:10px;padding:14px">
                <div style="font-size:11px;font-weight:800;color:${data.buy_color};letter-spacing:.06em;margin-bottom:6px">${data.buy_recommendation}</div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">${data.buy_reason}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title"><div class="card-title-dot" style="background:#10B981"></div>Стоимость и тренд</div></div>
            <div style="padding:16px 20px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div>
                  <div style="font-size:11px;color:var(--text-muted)">Текущая</div>
                  <div style="font-size:20px;font-weight:800;color:#10B981;font-family:'JetBrains Mono',monospace">${data.market_value_fmt||'—'}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:11px;color:var(--text-muted)">Исторический макс</div>
                  <div style="font-size:16px;font-weight:700;color:var(--text-primary);font-family:'JetBrains Mono',monospace">${data.highest_value_fmt||'—'}</div>
                </div>
                <div style="font-size:28px;font-weight:800;color:${trendColor}">${trendIcon} ${Math.abs(data.value_trend_pct)}%</div>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border-radius:8px">
                <div style="text-align:center">
                  <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${s.appearances||0}</div>
                  <div style="font-size:9px;color:var(--text-muted)">МАТЧИ</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${s.goals||0}</div>
                  <div style="font-size:9px;color:var(--text-muted)">ГОЛЫ</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${s.assists||0}</div>
                  <div style="font-size:9px;color:var(--text-muted)">ПЕРЕДАЧИ</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:20px;font-weight:700;color:${data.importance_score>=70?'#10B981':data.importance_score>=45?'#F59E0B':'#EF4444'}">${data.importance_score}%</div>
                  <div style="font-size:9px;color:var(--text-muted)">ВАЖНОСТЬ</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Club fit + importance -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-header"><div class="card-title"><div class="card-title-dot" style="background:#F59E0B"></div>Важность для клуба</div></div>
            <div style="padding:20px">
              <div style="text-align:center;margin-bottom:16px">
                ${buildGauge(data.importance_score, data.club_importance)}
              </div>
              <div style="font-size:12px;color:var(--text-muted);text-align:center">${data.club_importance}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title"><div class="card-title-dot" style="background:#3B82F6"></div>Подходящие клубы</div></div>
            <div style="padding:0 0 8px">
              ${data.suitable_clubs?.length
                ? data.suitable_clubs.map((c,i)=>`
                <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border-dim)">
                  <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);width:18px">${i+1}</span>
                  <div class="t-avatar" style="background:${avatarGrad(c.name)};border-radius:7px;width:32px;height:32px"><span style="font-size:9px">${initials(c.name)}</span></div>
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${c.name}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${c.league}</div>
                  </div>
                </div>`).join('')
                : `<div style="padding:24px;text-align:center;font-size:12px;color:var(--text-muted)">Нет данных по клубам</div>`}
            </div>
          </div>
        </div>
      </div>`;
    }catch(e){
      res.innerHTML=`<div class="empty-state"><div class="empty-state-title">Ошибка анализа</div><div class="empty-state-sub">Убедитесь что сервер запущен</div></div>`;
    }
  }

  function buildGauge(score, label){
    const r=54, cx=70, cy=70;
    const circumference=Math.PI*r; // half circle
    const offset=circumference*(1-score/100);
    const color=score>=70?'#10B981':score>=45?'#F59E0B':'#EF4444';
    return `<svg width="140" height="80" viewBox="0 0 140 80">
      <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none" stroke="#1C2235" stroke-width="10" stroke-linecap="round"/>
      <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset .8s"/>
      <text x="70" y="62" text-anchor="middle" font-size="22" font-weight="800" fill="${color}" font-family="JetBrains Mono,monospace">${score}</text>
      <text x="70" y="76" text-anchor="middle" font-size="9" fill="#5A6A8A" font-family="Space Grotesk,sans-serif">${label}</text>
    </svg>`;
  }

  // ── ASSISTANT ─────────────────────────────────────────────────────────────
  function renderAssistant() {
    $('aiBody').innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 260px);min-height:480px">

      <div class="ai-chat" id="aiChat">
        <div class="ai-msg ai-msg-bot">
          <div class="ai-msg-av">AI</div>
          <div class="ai-msg-bubble">
            <strong>ScoutMetric AI</strong> — твой скаутский ассистент 🤖<br><br>
            Я подключён к реальной базе данных и могу:<br>
            • Найти и проанализировать любого игрока<br>
            • Сравнить двух игроков по всем метрикам<br>
            • Показать топы по позиции, возрасту, стране<br>
            • Найти информацию о клубах и трансферах<br><br>
            Задай любой вопрос или выбери быстрый запрос ниже 👇
          </div>
        </div>
      </div>

      <div style="padding:8px 0 10px;display:flex;gap:6px;flex-wrap:wrap" id="quickBtns">
        ${QUICK_QUESTIONS.map(q =>
          `<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px;border:1px solid var(--border-color);border-radius:8px"
            onclick="AIModule.quickAsk('${q.replace(/'/g,"\\'")}')">
            ${q}
          </button>`
        ).join('')}
      </div>

      <div class="ai-input-row" style="gap:8px">
        <input class="ai-input" id="aiChatInput" type="text"
          placeholder="Напишите вопрос... (например: Найди нападающих до 23 лет)"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AIModule.sendChat();}">
        <button class="btn btn-primary" id="aiSendBtn" onclick="AIModule.sendChat()" style="flex-shrink:0;padding:0 16px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>`;
  }

  async function sendChat() {
    const inp = $('aiChatInput');
    const btn = $('aiSendBtn');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    inp.disabled = true;
    if (btn) btn.disabled = true;

    const chat = $('aiChat');
    const qb = $('quickBtns');
    if (qb) qb.style.display = 'none';

    chat.innerHTML += `<div class="ai-msg ai-msg-user"><div class="ai-msg-bubble">${_escHtml(msg)}</div></div>`;

    const thinkId = 'think_' + Date.now();
    chat.innerHTML += `
      <div class="ai-msg ai-msg-bot" id="${thinkId}">
        <div class="ai-msg-av">AI</div>
        <div class="ai-msg-bubble">
          <div class="ai-thinking"><span></span><span></span><span></span></div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:6px" id="${thinkId}_status">Анализирую запрос...</div>
        </div>
      </div>`;
    chat.scrollTop = chat.scrollHeight;

    chatHistory.push({ role: 'user', content: msg });

    try {
      const resp = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory.slice(-10) })
      });

      const data = await resp.json();
      const thinkEl = $(thinkId);

      if (data.error) {
        if (thinkEl) thinkEl.querySelector('.ai-msg-bubble').innerHTML =
          `<span style="color:#EF4444">⚠️ ${_escHtml(data.error)}</span>`;
        inp.disabled = false;
        if (btn) btn.disabled = false;
        chat.scrollTop = chat.scrollHeight;
        return;
      }

      const reply = data.reply || '';
      chatHistory.push({ role: 'assistant', content: reply });

      let toolBadges = '';
      if (data.tool_calls?.length) {
        const icons = { search_players: '🔍', get_player_detail: '👤', get_top_players: '🏆', get_club_info: '🏟️', compare_players: '⚖️', get_transfer_stats: '💸', get_database_stats: '📊' };
        toolBadges = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
          ${[...new Set(data.tool_calls.map(t => t.tool))].map(t =>
            `<span style="font-size:9px;background:rgba(37,99,235,0.1);color:#60A5FA;padding:2px 7px;border-radius:99px;border:1px solid rgba(37,99,235,0.2)">${icons[t] || '🔧'} ${t.replace(/_/g,' ')}</span>`
          ).join('')}
        </div>`;
      }

      if (thinkEl) thinkEl.querySelector('.ai-msg-bubble').innerHTML = toolBadges + _mdToHtml(reply);

    } catch (e) {
      const thinkEl = $(thinkId);
      if (thinkEl) thinkEl.querySelector('.ai-msg-bubble').innerHTML =
        `<span style="color:#EF4444">⚠️ Сервер недоступен. Убедитесь что app.py запущен.</span>`;
    }

    inp.disabled = false;
    if (btn) btn.disabled = false;
    inp.focus();
    chat.scrollTop = chat.scrollHeight;
  }

  // ── ADAPTIVE INTERVIEW ───────────────────────────────────────────────────
  function renderInterview(){
    const current = interviewState.session;
    const status = current?.status || 'not_started';
    const q = current?.question || current?.next_question;
    const summary = current?.summary;
    const metrics = current?.metrics || {};

    $('aiBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:18px">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-title-dot" style="background:#06B6D4"></div>Панель скаута</div>
        </div>
        <div style="padding:18px">
          <div style="display:grid;gap:10px">
            <div>
              <label style="font-size:11px;color:var(--text-muted)">ID игрока (необязательно)</label>
              <input id="intPlayerId" class="filter-input" type="number" placeholder="например 3544">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted)">Имя игрока</label>
              <input id="intPlayerName" class="filter-input" type="text" placeholder="например Арсен Нургалиев">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted)">Канал уведомления</label>
              <select id="intChannel" class="perpage-select" onchange="AIModule.onInterviewChannelChange(this.value)">
                <option value="site">На сайте</option>
                <option value="telegram">Telegram (шаблон)</option>
              </select>
            </div>
            <div id="tgWrap" style="display:none">
              <label style="font-size:11px;color:var(--text-muted)">Telegram username</label>
              <input id="intTelegram" class="filter-input" type="text" placeholder="@player_username">
              <label style="font-size:11px;color:var(--text-muted);margin-top:8px;display:block">Telegram chat_id</label>
              <input id="intTelegramChatId" class="filter-input" type="text" placeholder="например 123456789">
            </div>
            <button class="btn btn-primary" onclick="AIModule.createInterviewInvite()">Отправить интервью</button>
          </div>
          <div id="inviteResult" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-title-dot" style="background:#10B981"></div>Панель игрока</div>
        </div>
        <div style="padding:18px">
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <input id="intSessionId" class="filter-input" type="text" placeholder="Введите код интервью" value="${interviewState.sessionId || ''}">
            <button class="btn btn-outline" onclick="AIModule.loadInterviewSession()">Открыть</button>
          </div>

          ${status==='not_started' ? `<div style="font-size:12px;color:var(--text-muted)">Введите код интервью, чтобы начать опрос.</div>` : ''}

          ${(status==='in_progress' || status==='invited') && q ? `
            <div style="padding:12px;border:1px solid var(--border-dim);border-radius:10px;background:var(--bg-secondary)">
              <div style="font-size:10px;color:var(--text-muted);letter-spacing:.06em;margin-bottom:6px">ВОПРОС</div>
              <div style="font-size:13px;color:var(--text-primary);line-height:1.6">${_escHtml(q.text || '')}</div>
              <textarea id="intAnswer" class="form-input" style="margin-top:10px;min-height:96px;resize:vertical" placeholder="Ваш ответ..."></textarea>
              <button class="btn btn-primary" style="margin-top:10px" onclick="AIModule.submitInterviewAnswer()">Отправить ответ</button>
            </div>
          ` : ''}

          ${status==='completed' && summary ? `
            <div style="padding:12px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.24)">
              <div style="font-size:11px;font-weight:700;color:#10B981">Психологическое состояние: ${_escHtml(summary.state || '—')}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Общий балл: <strong>${summary.overall_score || 0}</strong> · Риск: <strong>${_escHtml(summary.risk_level || '—')}</strong></div>
              <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">Рекомендации:</div>
              <ul style="margin:6px 0 0 16px;padding:0;color:var(--text-secondary);font-size:12px;line-height:1.6">
                ${(summary.recommendations || []).map(x=>`<li>${_escHtml(x)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${Object.keys(metrics).length ? `
            <div style="margin-top:12px;display:grid;gap:8px">
              ${Object.entries(metrics).map(([k,v])=>`
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:4px">
                    <span>${k.replace(/_/g,' ')}</span><span>${v}</span>
                  </div>
                  <div style="height:6px;border-radius:6px;background:var(--bg-hover);overflow:hidden">
                    <div style="height:100%;width:${v}%;background:linear-gradient(90deg,#06B6D4,#10B981)"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;

    const sidInput = $('intSessionId');
    if (sidInput) {
      sidInput.onkeydown = e => {
        if (e.key === 'Enter') AIModule.loadInterviewSession();
      };
    }
  }

  function onInterviewChannelChange(value){
    const tg = $('tgWrap');
    if (tg) tg.style.display = value === 'telegram' ? '' : 'none';
  }

  async function createInterviewInvite(){
    const playerIdRaw = ($('intPlayerId')?.value || '').trim();
    const playerName = ($('intPlayerName')?.value || '').trim();
    const channel = ($('intChannel')?.value || 'site').trim();
    const telegram = ($('intTelegram')?.value || '').trim();
    const telegramChatId = ($('intTelegramChatId')?.value || '').trim();
    const out = $('inviteResult');
    if (!out) return;

    if (!playerIdRaw && !playerName) {
      out.innerHTML = `<span style="color:#EF4444;font-size:12px">Укажите ID или имя игрока.</span>`;
      return;
    }

    out.innerHTML = `<div class="loader-wrap" style="padding:8px 0"><div class="spinner"></div>Создаю приглашение...</div>`;
    try {
      const resp = await fetch(`${API}/ai/interview/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scout_id: (CURRENT_USER.get()?.id || 'scout'),
          player_id: playerIdRaw ? Number(playerIdRaw) : null,
          player_name: playerName || null,
          channel,
          telegram_username: telegram || null,
          telegram_chat_id: telegramChatId || null,
        }),
      });
      const data = await resp.json();
      if (data.error) {
        out.innerHTML = `<span style="color:#EF4444;font-size:12px">${_escHtml(data.error)}</span>`;
        return;
      }

      interviewState.sessionId = data.interview_id;
      out.innerHTML = `
        <div style="padding:10px;border:1px solid rgba(16,185,129,.25);border-radius:10px;background:rgba(16,185,129,.08)">
          <div style="font-size:11px;color:#10B981;font-weight:700">Инвайт создан</div>
          <div style="margin-top:4px;font-size:12px;color:var(--text-primary)">Код: <strong>${_escHtml(data.interview_id)}</strong></div>
          <div style="margin-top:6px;font-size:11px;color:var(--text-muted)">${_escHtml(data.invite_message || '')}</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="AIModule.copyInterviewCode('${data.interview_id}')">Копировать код</button>
            <button class="btn btn-primary btn-sm" onclick="AIModule.useInterviewCode('${data.interview_id}')">Открыть как игрок</button>
          </div>
        </div>`;
    } catch (e) {
      out.innerHTML = `<span style="color:#EF4444;font-size:12px">Сервер недоступен.</span>`;
    }
  }

  function copyInterviewCode(code){
    navigator.clipboard?.writeText(String(code));
    toast('Код интервью скопирован', 'success');
  }

  function useInterviewCode(code){
    const inp = $('intSessionId');
    if (inp) inp.value = code;
    interviewState.sessionId = code;
    loadInterviewSession();
  }

  async function loadInterviewSession(){
    const code = (($('intSessionId')?.value || '').trim() || interviewState.sessionId || '').trim();
    if (!code) return;
    interviewState.sessionId = code;

    try {
      const data = await fetch(`${API}/ai/interview/${encodeURIComponent(code)}`).then(r => r.json());
      if (data.error) {
        toast(data.error, 'error');
        return;
      }
      interviewState.session = data;
      renderInterview();
    } catch (e) {
      toast('Не удалось загрузить интервью', 'error');
    }
  }

  async function submitInterviewAnswer(){
    const code = interviewState.sessionId || (($('intSessionId')?.value || '').trim());
    const answer = (($('intAnswer')?.value || '').trim());
    if (!code || !answer) return;

    try {
      const data = await fetch(`${API}/ai/interview/${encodeURIComponent(code)}/answer`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ answer }),
      }).then(r => r.json());

      if (data.error) {
        toast(data.error, 'error');
        return;
      }

      interviewState.session = {
        interview_id: code,
        status: data.status,
        next_question: data.next_question,
        metrics: data.metrics,
        summary: data.summary,
      };
      renderInterview();
    } catch (e) {
      toast('Ошибка отправки ответа', 'error');
    }
  }

  return{
    load,tab,predictMatch,searchPlayer,analyzePlayer,sendChat,quickAsk,
    renderInterview,onInterviewChannelChange,createInterviewInvite,loadInterviewSession,
    submitInterviewAnswer,copyInterviewCode,useInterviewCode,
  };
})();

// ─── AI quick analyze button in player profile ────────────────────────────
window.openAIAnalysis=(pid)=>{
  navigate('ai');
  setTimeout(()=>{AIModule.tab('player');setTimeout(()=>AIModule.analyzePlayer(pid),100);},100);
};

// ══════════════════════════════════════════════════════════════════════════
// CURRENT USER / ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════
const CURRENT_USER={
  get(){
    return JSON.parse(localStorage.getItem('sm_current_user')||JSON.stringify(
      {id:'sabyt',name:'Сәбит Абзал',role:'Старший скаут',club:'ФК Астана',avatar:'АС',color:'#2563EB'}
    ));
  },
  set(data){ localStorage.setItem('sm_current_user',JSON.stringify(data)); },
};

// ══════════════════════════════════════════════════════════════════════════
// SCOUT TEAM DATA
// ══════════════════════════════════════════════════════════════════════════
const SCOUT_TEAM=[
  {id:'sabyt',  name:'Сәбит Абзал',   role:'Старший скаут',    club:'ФК Астана',    region:'Центр. Азия', license:'UEFA Pro',  avatar:'АС', color:'#2563EB'},
  {id:'aibek',  name:'Айбек Омаров',  role:'Скаут',            club:'ФК Астана',    region:'Европа',      license:'UEFA B',    avatar:'АО', color:'#10B981'},
  {id:'daniil', name:'Даниил Ким',    role:'Скаут-аналитик',   club:'ФК Астана',    region:'Россия, СНГ', license:'UEFA A',    avatar:'ДК', color:'#F59E0B'},
  {id:'alina',  name:'Алина Жунусова',role:'Скаут молодёжи',   club:'ФК Астана',    region:'Казахстан',   license:'UEFA B',    avatar:'АЖ', color:'#8B5CF6'},
];

function getScoutNotes(scoutId){
  // Each scout has their own namespace: sm_note_{scoutId}_{playerId}
  const prefix=`sm_note_${scoutId}_`;
  return Object.keys(localStorage)
    .filter(k=>k.startsWith(prefix))
    .map(k=>JSON.parse(localStorage.getItem(k)))
    .filter(Boolean);
}
function getScoutNote(scoutId,pid){
  return JSON.parse(localStorage.getItem(`sm_note_${scoutId}_${pid}`)||'null');
}
function saveScoutNote(scoutId,pid,data){
  localStorage.setItem(`sm_note_${scoutId}_${pid}`,JSON.stringify({...data,updated:new Date().toISOString()}));
  renderSbpHeatmap();
}

// ══════════════════════════════════════════════════════════════════════════
// REPORTS MODULE
// ══════════════════════════════════════════════════════════════════════════
const ReportsModule=(() => {
  let activeTab='team'; // 'team' | 'report' | 'watchlist-detail'

  function load(tab){
    activeTab=tab||'team';
    renderTabs();
  }

  function renderTabs(){
    const tabs=[
      {id:'team',   label:'Группа скаутов'},
      {id:'report', label:'Сводный отчёт'},
    ];
    $('content').innerHTML=`
      <div class="report-tabs">
        ${tabs.map(t=>`<button class="report-tab${activeTab===t.id?' active':''}" onclick="ReportsModule.switchTab('${t.id}')">${t.label}</button>`).join('')}
      </div>
      <div id="reportBody"></div>`;
    renderBody();
  }

  function renderBody(){
    if(activeTab==='team') renderTeam();
    else renderReport();
  }

  function renderTeam(){
    const myId=CURRENT_USER.get().id;
    $('reportBody').innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div style="font-size:11px;color:var(--text-muted)">Нажмите на скаута для просмотра профиля</div>
        <button class="btn btn-primary btn-sm" onclick="ReportsModule.addMember()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить участника
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px">
        ${SCOUT_TEAM.map(s=>{
          const notes=getScoutNotes(s.id);
          const recs=notes.filter(n=>n.status==='recommend');
          const wl=JSON.parse(localStorage.getItem(`sm_wl_${s.id}`)||'[]');
          const isMe=s.id===myId;
          return`
          <div class="scout-team-card${isMe?' stc-me':''}" onclick="ReportsModule.openScoutCard('${s.id}')">
            <div class="stc-header">
              <div class="stc-avatar" style="background:linear-gradient(135deg,${s.color},${s.color}99)">${s.avatar}</div>
              <div class="stc-info">
                <div class="stc-name">${s.name}${isMe?'<span class="stc-you">Вы</span>':''}</div>
                <div class="stc-role">${s.role}</div>
              </div>
              ${isMe?`<div class="stc-edit-btn" onclick="event.stopPropagation();ReportsModule.editProfile()" title="Изменить профиль">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>`:''}
            </div>
            <div class="stc-meta">
              <span>${s.region}</span>
              <span style="color:var(--border-bright)">·</span>
              <span style="color:var(--accent-bright)">${s.license}</span>
            </div>
            <div class="stc-stats">
              <div class="stc-stat"><div class="stc-stat-v" style="color:${s.color}">${notes.length}</div><div class="stc-stat-l">Заметок</div></div>
              <div class="stc-stat"><div class="stc-stat-v" style="color:#10B981">${recs.length}</div><div class="stc-stat-l">Рекоменд.</div></div>
              <div class="stc-stat"><div class="stc-stat-v" style="color:#F59E0B">${wl.length}</div><div class="stc-stat-l">В листе</div></div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function openScoutCard(sid){
    const s=SCOUT_TEAM.find(x=>x.id===sid); if(!s) return;
    const notes=getScoutNotes(sid);
    const recs=notes.filter(n=>n.status==='recommend');
    const watching=notes.filter(n=>n.status==='watching');
    const wl=WL.get(); // shared watchlist
    const actMap=buildActivityMap();

    // Mini heatmap last 28 days
    const today=new Date();
    const miniDays=[];
    for(let i=27;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);miniDays.push({key:d.toISOString().slice(0,10),count:actMap[d.toISOString().slice(0,10)]||0});}
    const maxA=Math.max(1,...miniDays.map(d=>d.count));
    const cCell=c=>{if(!c)return'#0E1420';const p=c/maxA;return p<0.33?s.color+'55':p<0.66?s.color+'99':s.color;};
    const miniWeeks=[];for(let i=0;i<miniDays.length;i+=7)miniWeeks.push(miniDays.slice(i,i+7));

    openDetailModal(`
      <button class="prof-close" onclick="closeDetailModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="prof-hero" style="background:linear-gradient(135deg,${s.color}18,transparent 65%)">
        <div class="prof-hero-inner">
          <div class="prof-av-section">
            <div class="prof-avatar" style="background:linear-gradient(135deg,${s.color},${s.color}88);font-size:22px;font-weight:800">${s.avatar}</div>
            <div style="margin-top:6px"><span style="background:${s.color}20;color:${s.color};padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700">${s.license}</span></div>
          </div>
          <div class="prof-info">
            <div class="prof-name">${s.name}</div>
            <div class="prof-meta">
              <div class="prof-meta-chip">${s.role}</div>
              <div class="prof-meta-chip">${s.club}</div>
              <div class="prof-meta-chip">${s.region}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="prof-stats-bar" style="grid-template-columns:repeat(4,1fr)">
        ${[['Заметок',notes.length],['Рекоменд.',recs.length],['Наблюдение',watching.length],['В листе',wl.length]].map(([l,v])=>`
          <div class="psb-item"><div class="psb-value">${v}</div><div class="psb-label">${l}</div></div>`).join('')}
      </div>
      <div style="padding:20px 28px 28px">
        <div class="prof-sec-title" style="margin-bottom:10px"><div class="sec-title-dot" style="background:${s.color}"></div>Активность (28 дней)</div>
        <div style="display:flex;gap:3px;margin-bottom:20px">
          ${miniWeeks.map(wk=>`<div style="display:flex;flex-direction:column;gap:3px">${wk.map(d=>`<div style="width:11px;height:11px;border-radius:2px;background:${cCell(d.count)}" title="${d.key}"></div>`).join('')}</div>`).join('')}
        </div>
        ${notes.length?`
        <div class="prof-sec-title" style="margin-bottom:10px"><div class="sec-title-dot" style="background:#10B981"></div>Последние заметки (${notes.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${notes.slice(-6).reverse().map(n=>{
            const pw=wl.find(p=>p.id===n.player_id);
            const c={recommend:'#10B981',watching:'#F59E0B',declined:'#EF4444'}[n.status]||'#7A8CAD';
            const l={recommend:'Рекомендован',watching:'Наблюдение',declined:'Отклонён'}[n.status]||'—';
            return`<div class="top-player-item" style="cursor:pointer" onclick="closeDetailModal();navigate('players');setTimeout(()=>PlayersModule.openProfile(${n.player_id}),150)">
              <div class="tpi-av" style="background:${avatarGrad(pw?.name||'?')}"><span>${initials(pw?.name||'?')}</span></div>
              <div class="tpi-info"><div class="tpi-name">${pw?.name||'ID: '+n.player_id}</div><div class="tpi-sub">${pw?.club||'—'}</div></div>
              <span style="background:${c}18;color:${c};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${l}</span>
              ${n.score?`<span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#F59E0B">${n.score}/10</span>`:''}
            </div>`;}).join('')}
        </div>`:`<div class="empty-state" style="padding:32px"><div class="empty-state-title">Нет заметок</div></div>`}
      </div>`);
  }

  function editProfile(){
    const p=SCOUT_PROFILE.get();
    openDetailModal(`
      <button class="prof-close" onclick="closeDetailModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="padding:28px">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:6px">Редактировать профиль</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px">Изменения сохраняются локально</div>

        <div style="font-size:10px;font-weight:700;color:var(--accent-bright);letter-spacing:.08em;margin-bottom:12px">ЛИЧНЫЕ ДАННЫЕ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          ${[
            ['Полное имя','ep_name','text',p.name],
            ['Дата рождения','ep_dob','date',p.dob],
            ['Email','ep_email','email',p.email],
            ['Телефон','ep_phone','tel',p.phone],
            ['Страна','ep_country','text',p.country],
            ['Опыт (лет)','ep_exp','number',p.exp],
          ].map(([l,id,t,v])=>`
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.04em;display:block;margin-bottom:5px">${l.toUpperCase()}</label>
              <input type="${t}" id="${id}" class="filter-input" style="width:100%;padding:9px 12px" value="${v||''}">
            </div>`).join('')}
        </div>

        <div style="font-size:10px;font-weight:700;color:var(--accent-bright);letter-spacing:.08em;margin-bottom:12px">ПРОФЕССИОНАЛЬНЫЕ ДАННЫЕ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          ${[
            ['Должность','ep_role','text',p.role],
            ['Клуб / Организация','ep_club','text',p.club],
            ['Регион скаутинга','ep_region','text',p.region],
            ['Лицензия UEFA','ep_license','text',p.license],
            ['Специализация (позиции)','ep_spec','text',p.spec],
            ['Возраст игроков','ep_ageRange','text',p.ageRange],
          ].map(([l,id,t,v])=>`
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.04em;display:block;margin-bottom:5px">${l.toUpperCase()}</label>
              <input type="${t}" id="${id}" class="filter-input" style="width:100%;padding:9px 12px" value="${v||''}">
            </div>`).join('')}
        </div>

        <div style="margin-bottom:20px">
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.04em;display:block;margin-bottom:5px">О СЕБЕ</label>
          <textarea id="ep_bio" class="sn-textarea" rows="3" style="width:100%">${p.bio||''}</textarea>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-outline" style="flex:1" onclick="closeDetailModal()">Отмена</button>
          <button class="btn btn-primary" style="flex:2" onclick="ReportsModule.saveProfile()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Сохранить изменения
          </button>
        </div>
      </div>`);
  }

  function saveProfile(){
    const get=id=>$(id)?.value||'';
    const data={
      name:get('ep_name'), dob:get('ep_dob'), email:get('ep_email'),
      phone:get('ep_phone'), country:get('ep_country'), exp:get('ep_exp'),
      role:get('ep_role'), club:get('ep_club'), region:get('ep_region'),
      license:get('ep_license'), spec:get('ep_spec'), ageRange:get('ep_ageRange'),
      bio:get('ep_bio'),
    };
    SCOUT_PROFILE.save(data);
    // Update sidebar bottom panel
    const panel=$('scoutBottomPanel');
    if(panel){
      const n=panel.querySelector('.sbp-name'); if(n&&data.name) n.textContent=data.name;
      const r=panel.querySelector('.sbp-role'); if(r) r.textContent=`${data.role||'Скаут'} · ${data.club||''}`;
    }
    // Update SCOUT_TEAM[0] live
    if(data.name) SCOUT_TEAM[0].name=data.name;
    if(data.role) SCOUT_TEAM[0].role=data.role;
    if(data.club) SCOUT_TEAM[0].club=data.club;
    if(data.region) SCOUT_TEAM[0].region=data.region;
    if(data.license) SCOUT_TEAM[0].license=data.license;
    closeDetailModal();
    toast('Профиль обновлён','success');
  }

  function renderReport(){
    const wl=WL.get(), allNotes=NOTES.all();
    const inReport=allNotes.filter(n=>n.inReport);
    const recs=allNotes.filter(n=>n.status==='recommend');
    const watching=allNotes.filter(n=>n.status==='watching');
    const declined=allNotes.filter(n=>n.status==='declined');

    $('reportBody').innerHTML=`
      <div class="kpi-grid" style="margin-bottom:28px">
        ${[['В наблюдении',wl.length,'#3B82F6'],['Рекомендовано',recs.length,'#10B981'],['В отчёте',inReport.length,'#EC4899'],['Отклонено',declined.length,'#EF4444']].map(([l,v,c])=>`
          <div class="kpi-card" style="--kpi-color:${c}"><div class="kpi-value" style="font-size:36px">${v}</div><div class="kpi-label">${l}</div></div>`).join('')}
      </div>

      ${inReport.length?`
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title"><div class="card-title-dot" style="background:#EC4899"></div>Отправлены в отчёт (${inReport.length})</div>
          <button class="card-action" onclick="ReportsModule.clearReport()">Очистить</button>
        </div>
        <div>${inReport.map(n=>{
          const w=wl.find(p=>p.id===n.player_id);
          const radar=JSON.parse(localStorage.getItem('sm_radar_'+n.player_id)||'null');
          const statusC={recommend:'#10B981',watching:'#F59E0B',declined:'#EF4444'}[n.status]||'#7A8CAD';
          const statusL={recommend:'Рекомендован',watching:'Наблюдение',declined:'Отклонён'}[n.status]||'—';
          return`
          <div class="report-player-row" onclick="navigate('players');setTimeout(()=>PlayersModule.openProfile(${n.player_id}),150)">
            <div class="tpi-av" style="background:${avatarGrad(w?.name||'?')}"><span>${initials(w?.name||'?')}</span></div>
            <div class="tpi-info" style="flex:1">
              <div class="tpi-name">${w?.name||'ID: '+n.player_id}</div>
              <div class="tpi-sub">${w?.club||'—'} · ${w?.pos||'—'}${n.reportedAt?' · Отправлен '+n.reportedAt.slice(0,10):''}</div>
            </div>
            ${n.status?`<span style="background:${statusC}18;color:${statusC};padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap">${statusL}</span>`:''}
            ${n.score?`<div style="display:flex;align-items:center;gap:3px">
              ${[...Array(10)].map((_,i)=>`<div style="width:12px;height:4px;border-radius:2px;background:${i<n.score?'#F59E0B':'var(--bg-hover)'}"></div>`).join('')}
              <span style="font-size:11px;font-weight:700;color:#F59E0B;font-family:'JetBrains Mono',monospace;margin-left:3px">${n.score}/10</span>
            </div>`:''}
            ${radar?`<div style="flex-shrink:0">${miniRadarSVG(radar,statusC)}</div>`:''}
            ${n.comment?`<div style="font-size:11px;color:var(--text-muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.comment}</div>`:''}
          </div>`;
        }).join('')}</div>
      </div>`:'<div class="card" style="margin-bottom:20px"><div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted)">Откройте профиль игрока → Заметка скаута → нажмите «В отчёт»</div></div>'}

      ${recs.length?`
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title"><div class="card-title-dot" style="background:#10B981"></div>Рекомендованные (${recs.length})</div></div>
        <div>${recs.map(n=>{
          const w=wl.find(p=>p.id===n.player_id);
          const radar=JSON.parse(localStorage.getItem('sm_radar_'+n.player_id)||'null');
          return`
          <div class="report-player-row" onclick="navigate('players');setTimeout(()=>PlayersModule.openProfile(${n.player_id}),150)">
            <div class="tpi-av" style="background:${avatarGrad(w?.name||'?')}"><span>${initials(w?.name||'?')}</span></div>
            <div class="tpi-info" style="flex:1">
              <div class="tpi-name">${w?.name||'ID: '+n.player_id}</div>
              <div class="tpi-sub">${w?.club||'—'}</div>
            </div>
            ${n.score?`<div style="display:flex;align-items:center;gap:3px">
              ${[...Array(10)].map((_,i)=>`<div style="width:12px;height:4px;border-radius:2px;background:${i<n.score?'#F59E0B':'var(--bg-hover)'}"></div>`).join('')}
              <span style="font-size:11px;font-weight:700;color:#F59E0B;font-family:'JetBrains Mono',monospace;margin-left:3px">${n.score}/10</span>
            </div>`:''}
            ${radar?`<div style="flex-shrink:0">${miniRadarSVG(radar,'#10B981')}</div>`:''}
            ${n.comment?`<div style="font-size:11px;color:var(--text-muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.comment}</div>`:''}
          </div>`;
        }).join('')}</div>
      </div>`:''}

      <div class="card">
        <div class="card-header"><div class="card-title"><div class="card-title-dot"></div>Все заметки (${allNotes.length})</div></div>
        <div>${allNotes.length?allNotes.map(n=>{
          const w=wl.find(p=>p.id===n.player_id);
          const c={recommend:'#10B981',watching:'#F59E0B',declined:'#EF4444'}[n.status]||'#7A8CAD';
          const l={recommend:'Рекомендован',watching:'Наблюдение',declined:'Отклонён'}[n.status]||'—';
          const radar=JSON.parse(localStorage.getItem('sm_radar_'+n.player_id)||'null');
          return`
          <div class="top-player-item" style="cursor:pointer" onclick="navigate('players');setTimeout(()=>PlayersModule.openProfile(${n.player_id}),150)">
            <div class="tpi-av" style="background:${avatarGrad(w?.name||'?')}"><span>${initials(w?.name||'?')}</span></div>
            <div class="tpi-info"><div class="tpi-name">${w?.name||'ID: '+n.player_id}</div><div class="tpi-sub">${n.updated?.slice(0,10)||''}</div></div>
            ${radar?`<div style="flex-shrink:0">${miniRadarSVG(radar,c)}</div>`:''}
            <span style="background:${c}18;color:${c};padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap">${l}</span>
            ${n.score?`<span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#F59E0B">${n.score}/10</span>`:''}
            ${n.inReport?`<span style="background:rgba(236,72,153,0.12);color:#EC4899;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700">В отчёте</span>`:''}
          </div>`;
        }).join(''):`<div class="empty-state" style="padding:40px"><div class="empty-state-title">Нет заметок</div><div class="empty-state-sub">Открывайте профили игроков и добавляйте заметки</div></div>`}
        </div>
      </div>`;
  }

  function clearReport(){
    NOTES.all().forEach(n=>{if(n.inReport){delete n.inReport;delete n.reportedAt;NOTES.save(n.player_id,n);}});
    renderReport();toast('Отчёт очищен','info');
  }

  function addMember(){
    const colors=['#2563EB','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899'];
    openDetailModal(`
      <button class="prof-close" onclick="closeDetailModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="padding:28px">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:6px">Добавить участника</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px">Новый скаут получит доступ к платформе</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          ${[['Полное имя*','am_name','text','Иван Иванов'],['Email*','am_email','email','scout@club.kz'],['Должность','am_role','text','Скаут'],['Регион','am_region','text','Европа'],['Лицензия UEFA','am_license','text','UEFA B'],['Клуб','am_club','text','ФК Астана']].map(([l,id,t,ph])=>`
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.04em;display:block;margin-bottom:5px">${l.toUpperCase()}</label>
              <input type="${t}" id="${id}" class="filter-input" style="width:100%;padding:9px 12px" placeholder="${ph}">
            </div>`).join('')}
        </div>

        <div style="margin-bottom:20px">
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.04em;display:block;margin-bottom:8px">ЦВЕТ ПРОФИЛЯ</label>
          <div style="display:flex;gap:8px" id="colorPicker">
            ${colors.map((c,i)=>`<div onclick="ReportsModule.pickColor('${c}')" id="cp_${c.slice(1)}"
              style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${i===0?'#fff':'transparent'};transition:transform .15s"
              onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`).join('')}
          </div>
        </div>

        <div style="background:var(--bg-secondary);border:1px solid var(--border-dim);border-radius:10px;padding:14px;margin-bottom:20px">
          <div style="font-size:10px;font-weight:700;color:var(--accent-bright);letter-spacing:.06em;margin-bottom:8px">УЧЁТНЫЕ ДАННЫЕ ДЛЯ ВХОДА</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:10px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">ЛОГИН</label>
              <input type="text" id="am_login" class="filter-input" style="width:100%;padding:8px 12px" placeholder="login123">
            </div>
            <div>
              <label style="font-size:10px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">ПАРОЛЬ</label>
              <input type="password" id="am_pass" class="filter-input" style="width:100%;padding:8px 12px" placeholder="••••••">
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-outline" style="flex:1" onclick="closeDetailModal()">Отмена</button>
          <button class="btn btn-primary" style="flex:2" onclick="ReportsModule.confirmAddMember()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Добавить в группу
          </button>
        </div>
      </div>`);
    ReportsModule._pickedColor=colors[0];
  }

  function pickColor(c){
    ReportsModule._pickedColor=c;
    document.querySelectorAll('#colorPicker > div').forEach(el=>{
      el.style.border=el.id==='cp_'+c.slice(1)?'2px solid #fff':'2px solid transparent';
    });
  }

  function confirmAddMember(){
    const name=$('am_name')?.value?.trim();
    const email=$('am_email')?.value?.trim();
    const login=$('am_login')?.value?.trim();
    const pass=$('am_pass')?.value?.trim();
    if(!name||!email){toast('Заполните имя и email','error');return;}
    if(!login||!pass){toast('Укажите логин и пароль','error');return;}

    const color=ReportsModule._pickedColor||'#2563EB';
    const id='scout_'+Date.now();
    const av=name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
    const newMember={
      id, name, role:$('am_role')?.value||'Скаут',
      club:$('am_club')?.value||'ФК Астана',
      region:$('am_region')?.value||'—',
      license:$('am_license')?.value||'—',
      avatar:av, color
    };
    // Save to team
    SCOUT_TEAM.push(newMember);
    // Save accounts list
    const accounts=JSON.parse(localStorage.getItem('sm_accounts')||'[]');
    accounts.push({id,login,pass,name,role:newMember.role,club:newMember.club,color,avatar:av});
    localStorage.setItem('sm_accounts',JSON.stringify(accounts));

    closeDetailModal();
    toast(`${name} добавлен в группу`,'success');
    renderTeam();
  }

  function switchTab(t){activeTab=t;renderTabs();}
  return{load,switchTab,openScoutCard,editProfile,saveProfile,addMember,pickColor,confirmAddMember,_pickedColor:null};
})();

// Mini radar SVG for report cards
function miniRadarSVG(radarData, color){
  const metrics=SCOUT_METRICS;
  const cx=32,cy=32,R=22,N=metrics.length;
  const ang=i=>(Math.PI*2/N)*i-Math.PI/2;
  const dat=metrics.map((m,i)=>{const r=((radarData[m.key]??50)/100)*R;return[cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];});
  const hex=metrics.map((_,i)=>[cx+R*Math.cos(ang(i)),cy+R*Math.sin(ang(i))]);
  const outline=hex.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
  const dpath=dat.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
  const uid='mr'+(Math.random()*1e6|0);
  return `<svg width="64" height="64" viewBox="0 0 64 64" title="Оценки скаута">
    <defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.5"/><stop offset="100%" stop-color="${color}" stop-opacity="0.1"/></linearGradient></defs>
    <path d="${outline}" fill="none" stroke="#1C2235" stroke-width="0.8"/>
    <path d="${dpath}" fill="url(#${uid})" stroke="${color}" stroke-width="1.2"/>
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════
// WATCHLIST MODULE
// ══════════════════════════════════════════════════════════════════════════
const WatchlistModule=(() => {
  function load(){
    const wl=WL.get();
    $('content').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:22px;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em">Список наблюдения</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${wl.length} игрок${wl.length===1?'':'ов'} · нажмите на карточку чтобы изменить оценки</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="navigate('players')">Найти игрока</button>
    </div>
    ${wl.length
      ?`<div class="wl-grid" id="wlGrid">${wl.map(p=>card(p)).join('')}</div>`
      :`<div class="empty-state" style="padding:80px">
          <div class="empty-state-title">Список пуст</div>
          <div class="empty-state-sub">Добавляйте игроков из раздела Игроки</div>
          <button class="btn btn-primary" style="margin-top:20px" onclick="navigate('players')">Перейти к игрокам</button>
        </div>`}`;
  }

  function card(p, expanded=false){
    const note=NOTES.get(p.id)||{};
    const radar=JSON.parse(localStorage.getItem('sm_radar_'+p.id)||'null');
    const sc={recommend:'var(--success)',watching:'var(--warning)',declined:'var(--danger)'};
    const sl={recommend:'Рекомендован',watching:'Наблюдение',declined:'Отклонён'};
    const sb={recommend:'var(--success-dim)',watching:'var(--warning-dim)',declined:'var(--danger-dim)'};
    const posC=POS[p.pos]||{color:'#7A8CAD'};

    return`<div class="wl-card${expanded?' wl-card-expanded':''}" id="wlcard_${p.id}">
      <!-- Header row: always visible -->
      <div class="wl-card-top" onclick="WatchlistModule.toggleExpand(${p.id})" style="cursor:pointer">
        <div class="wl-avatar" style="background:${avatarGrad(p.name)}"><span>${initials(p.name)}</span></div>
        <div class="wl-info">
          <div class="wl-name">${p.name||'—'}</div>
          <div class="wl-sub">${p.club||'—'} · ${p.pos||'—'}</div>
        </div>
        ${note.status?`<div class="wl-status-badge" style="background:${sb[note.status]||'var(--bg-hover)'};color:${sc[note.status]||'var(--text-muted)'}">${sl[note.status]}</div>`:''}
        <div style="flex-shrink:0;color:var(--text-muted);transition:transform .2s;${expanded?'transform:rotate(180deg)':''}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <!-- Score bar -->
      ${note.score?`<div style="display:flex;align-items:center;gap:4px;padding:0 2px">
        ${[...Array(10)].map((_,i)=>`<div style="height:3px;flex:1;border-radius:2px;background:${i<note.score?'#F59E0B':'var(--bg-hover)'}"></div>`).join('')}
        <span style="font-size:10px;font-weight:700;color:#F59E0B;font-family:'JetBrains Mono',monospace;margin-left:4px">${note.score}/10</span>
      </div>`:''}

      <!-- Mini radar preview if has data -->
      ${radar&&!expanded?`<div style="display:flex;align-items:center;gap:10px;margin-top:4px">
        ${miniRadarSVG(radar,posC.color)}
        ${note.comment?`<div style="font-size:11px;color:var(--text-muted);line-height:1.5;flex:1">${note.comment.slice(0,60)}${note.comment.length>60?'…':''}</div>`:''}
      </div>`:''}

      ${!radar&&note.comment&&!expanded?`<div style="font-size:11px;color:var(--text-muted);line-height:1.5;border-top:1px solid var(--border-dim);padding-top:8px">${note.comment.slice(0,80)}${note.comment.length>80?'…':''}</div>`:''}

      <!-- Expanded editing panel -->
      ${expanded?`
      <div class="wl-expanded-body">
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-sm" style="font-size:11px;padding:5px 10px" onclick="WatchlistModule.openFull(${p.id})">Открыть профиль</button>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:5px 10px;color:var(--danger)" onclick="WatchlistModule.removeFromWL(${p.id},'${(p.name||'').replace(/'/g,"\\'")}')">Удалить</button>
        </div>

        <!-- Status -->
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:6px">СТАТУС</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${[['recommend','Рекомендую','#10B981'],['watching','Наблюдаю','#F59E0B'],['declined','Отклонён','#EF4444']].map(([v,l,c])=>`
              <button class="sn-status-btn${note.status===v?' active':''}"
                style="${note.status===v?`background:${c}18;color:${c};border-color:${c}44`:''}"
                onclick="WatchlistModule.setStatus(${p.id},'${v}','${c}')">${l}</button>`).join('')}
          </div>
        </div>

        <!-- Score -->
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:6px">ОЦЕНКА</div>
          <div style="display:flex;gap:4px" id="wlScores_${p.id}">
            ${[1,2,3,4,5,6,7,8,9,10].map(n=>`
              <button class="sn-score-btn${(note.score||0)>=n?' active':''}"
                onclick="WatchlistModule.setScore(${p.id},${n})">${n}</button>`).join('')}
          </div>
        </div>

        <!-- Radar -->
        <div style="margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:8px">ХАРАКТЕРИСТИКИ СКАУТА</div>
          <div id="wlRadar_${p.id}">${buildWlRadar(p.id, posC.color)}</div>
        </div>

        <!-- Comment -->
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;margin-bottom:6px">ЗАМЕТКА</div>
          <textarea class="sn-textarea" id="wlText_${p.id}" rows="3" style="width:100%"
            placeholder="Техника, тактика, физика...">${note.comment||''}</textarea>
        </div>
        <button class="sn-save-btn" style="margin-top:10px;width:100%" onclick="WatchlistModule.save(${p.id})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
          Сохранить изменения
        </button>
      </div>`:''}

      <div style="font-size:10px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-top:6px">Добавлен ${fmtDate(p.added)}</div>
    </div>`;
  }

  function buildWlRadar(pid, color){
    const saved=JSON.parse(localStorage.getItem('sm_radar_'+pid)||'{}');
    const vals=SCOUT_METRICS.map(m=>({...m,val:saved[m.key]??50}));
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      <div>${renderScoutRadarSVG(pid+'wl', vals, color)}</div>
      <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
        ${vals.map(m=>`
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span style="font-size:9px;font-weight:700;color:var(--text-muted);letter-spacing:.04em">${m.label}</span>
            <span id="wlVal_${pid}_${m.key}" style="font-size:9px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace">${m.val}</span>
          </div>
          <input type="range" class="sr-slider" min="0" max="100" value="${m.val}" style="--sc:${color}"
            oninput="WatchlistModule.updateSlider(${pid},'${m.key}',+this.value,'${color}')">
        </div>`).join('')}
      </div>
    </div>`;
  }

  const _expanded=new Set();

  function toggleExpand(pid){
    const grid=$('wlGrid'); if(!grid) return;
    const wl=WL.get(); const p=wl.find(x=>x.id===pid); if(!p) return;
    if(_expanded.has(pid)){_expanded.delete(pid);}else{_expanded.add(pid);}
    // Re-render just this card
    const el=$(`wlcard_${pid}`); if(!el) return;
    const isExp=_expanded.has(pid);
    const tmp=document.createElement('div');
    tmp.innerHTML=card(p, isExp);
    el.replaceWith(tmp.firstElementChild);
  }

  function setStatus(pid,status,color){
    const note=NOTES.get(pid)||{};note.status=status;note.player_id=pid;NOTES.save(pid,note);
    const panel=document.querySelector(`#wlcard_${pid} .sn-status-btn.active`);
    document.querySelectorAll(`#wlcard_${pid} .sn-status-btn`).forEach(b=>{
      const v=b.getAttribute('onclick').match(/'([^']*)'/)?.[1];
      const on=v===status; b.classList.toggle('active',on);
      b.style.cssText=on?`background:${color}18;color:${color};border-color:${color}44`:'';
    });
  }

  function setScore(pid,score){
    const c=$(`wlScores_${pid}`); if(!c) return;
    c.querySelectorAll('.sn-score-btn').forEach((b,i)=>b.classList.toggle('active',i<score));
    const note=NOTES.get(pid)||{};note.score=score;note.player_id=pid;NOTES.save(pid,note);
  }

  function updateSlider(pid,key,val,color){
    const lbl=$(`wlVal_${pid}_${key}`); if(lbl) lbl.textContent=val;
    const saved=JSON.parse(localStorage.getItem('sm_radar_'+pid)||'{}');
    saved[key]=val; localStorage.setItem('sm_radar_'+pid,JSON.stringify(saved));
    const vals=SCOUT_METRICS.map(m=>({...m,val:saved[m.key]??50}));
    const cx=130,cy=130,R=88,N=vals.length;
    const ang=i=>(Math.PI*2/N)*i-Math.PI/2;
    const dat=vals.map((m,i)=>{const r=(m.val/100)*R;return[cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];});
    const dpath=dat.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ')+'Z';
    const path=$(`srPath_${pid}wl`); if(path) path.setAttribute('d',dpath);
    dat.forEach(([x,y],i)=>{const d=$(`srDot_${pid}wl_${i}`);if(d){d.setAttribute('cx',x);d.setAttribute('cy',y);}});
  }

  function save(pid){
    const ta=$(`wlText_${pid}`); if(!ta) return;
    const note=NOTES.get(pid)||{};note.comment=ta.value;note.player_id=pid;NOTES.save(pid,note);
    toast('Изменения сохранены','success'); renderSbpHeatmap();
  }

  function openFull(pid){closeDetailModal();navigate('players');setTimeout(()=>PlayersModule.openProfile(pid),150);}

  function removeFromWL(pid,name){
    const wl=WL.get().filter(p=>p.id!==pid);
    localStorage.setItem('sm_wl',JSON.stringify(wl));
    updateSidebarStats();load();toast(`${name} удалён из наблюдения`,'info');
  }

  return{load,toggleExpand,setStatus,setScore,updateSlider,save,openFull,removeFromWL};
})();

// ── Shared pagination ──────────────────────────────────────────────────────
function buildPag(page,pages,mod){
  if(pages<=1)return'';
  const p=page,t=pages;
  let pgs=[...new Set([1,t,p-2,p-1,p,p+1,p+2].filter(x=>x>=1&&x<=t))].sort((a,b)=>a-b);
  let h=`<button class="pg-btn"${p<=1?' disabled':''} onclick="${mod}.goPage(${p-1})">‹</button>`;
  let prev=0;
  for(const pg of pgs){if(pg-prev>1)h+=`<span class="pg-dots">…</span>`;h+=`<button class="pg-btn${pg===p?' active':''}" onclick="${mod}.goPage(${pg})">${pg}</button>`;prev=pg;}
  h+=`<button class="pg-btn"${p>=t?' disabled':''} onclick="${mod}.goPage(${p+1})">›</button>`;
  return h;
}

// ══════════════════════════════════════════════════════════════════════════
// DETAIL MODAL (clubs / games / transfers)
// ══════════════════════════════════════════════════════════════════════════
function openDetailModal(html){
  let ov=$('detailOverlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='detailOverlay';
    ov.className='prof-overlay';
    ov.innerHTML=`<div class="prof-modal detail-modal" id="detailModal" style="max-width:680px"></div>`;
    ov.addEventListener('click',e=>{if(e.target===ov)closeDetailModal();});
    document.body.appendChild(ov);
  }
  $('detailModal').innerHTML=html;
  ov.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeDetailModal(){
  $('detailOverlay')?.classList.remove('open');
  document.body.style.overflow='';
}

// ── Club detail ─────────────────────────────────────────────────────────────
function openClubDetail(clubData){
  const c=clubData;
  openDetailModal(`
    <button class="prof-close" onclick="closeDetailModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="prof-hero" style="background:linear-gradient(135deg,rgba(16,185,129,0.08),transparent 65%)">
      <div class="prof-hero-inner">
        <div class="prof-av-section">
          <div class="prof-avatar" style="background:${avatarGrad(c.name)};border-radius:12px;font-size:20px">
            <span>${initials(c.name)}</span>
          </div>
        </div>
        <div class="prof-info">
          <div class="prof-name">${c.name||'—'}</div>
          <div class="prof-meta">
            ${c.competition_name?`<div class="prof-meta-chip">${c.competition_name}</div>`:''}
            ${c.squad_size?`<div class="prof-meta-chip">${c.squad_size} игроков</div>`:''}
            ${c.avg_age?`<div class="prof-meta-chip">Ср. возраст ${c.avg_age}</div>`:''}
          </div>
        </div>
      </div>
    </div>
    <div class="prof-stats-bar" style="grid-template-columns:repeat(4,1fr)">
      ${[['Игроков',c.squad_size||'—'],['Ср. возраст',c.avg_age||'—'],['Легионеры',c.foreigners_number??'—'],['Вместимость',c.capacity?Number(c.capacity).toLocaleString():'—']].map(([l,v])=>`
        <div class="psb-item"><div class="psb-value">${v}</div><div class="psb-label">${l}</div></div>`).join('')}
    </div>
    <div style="padding:24px 28px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="prof-section">
        <div class="prof-sec-title"><div class="sec-title-dot" style="background:#10B981"></div>Информация о клубе</div>
        <table class="prof-info-table">
          ${[
            ['Стадион', c.stadium||'—'],
            ['Вместимость', c.capacity?Number(c.capacity).toLocaleString():'—'],
            ['Состав', c.squad_size?c.squad_size+' игроков':'—'],
            ['Ср. возраст', c.avg_age||'—'],
            ['Легионеры', c.foreigners_number!=null?c.foreigners_number+` (${c.foreigners_percentage??''}%)`:'—'],
            ['Лига', c.competition_name||'—'],
          ].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
        </table>
      </div>
      <div class="prof-section">
        <div class="prof-sec-title"><div class="sec-title-dot" style="background:#3B82F6"></div>Трансферный баланс</div>
        <div style="display:flex;align-items:center;justify-content:center;padding:24px 0">
          <div style="text-align:center">
            <div style="font-size:22px;font-weight:700;color:${c.net_transfer_record&&c.net_transfer_record.startsWith('+')?'#10B981':'#EF4444'};font-family:'JetBrains Mono',monospace">${c.net_transfer_record||'—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Чистый баланс</div>
          </div>
        </div>
        <div class="prof-sec-title" style="margin-top:8px"><div class="sec-title-dot" style="background:#8B5CF6"></div>Тренер</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);padding:8px 0">${c.coach_name||'Не указан'}</div>
      </div>
    </div>`);
}

// ── Game detail ─────────────────────────────────────────────────────────────
function openGameDetail(g){
  const homeWin=g.home_club_goals>g.away_club_goals, awayWin=g.away_club_goals>g.home_club_goals;
  openDetailModal(`
    <button class="prof-close" onclick="closeDetailModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div style="padding:32px 28px 0">
      <div style="font-size:11px;color:var(--text-muted);text-align:center;font-weight:600;letter-spacing:.08em;margin-bottom:20px">${g.competition_name||'—'} · ${g.season||'—'} · ${g.round||''}</div>
      <div style="display:grid;grid-template-columns:1fr 120px 1fr;align-items:center;gap:16px;text-align:center">
        <div>
          <div class="prof-avatar" style="background:${avatarGrad(g.home_club_name)};margin:0 auto 10px;border-radius:10px;font-size:18px"><span>${initials(g.home_club_name)}</span></div>
          <div style="font-size:16px;font-weight:700;color:${homeWin?'#10B981':'var(--text-primary)'}">${g.home_club_name||'—'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Хозяева</div>
        </div>
        <div>
          <div style="font-size:40px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text-primary);letter-spacing:-2px">${g.home_club_goals??'?'}<span style="color:var(--text-muted);font-size:28px;margin:0 4px">:</span>${g.away_club_goals??'?'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${fmtDateShort(g.date)}</div>
        </div>
        <div>
          <div class="prof-avatar" style="background:${avatarGrad(g.away_club_name)};margin:0 auto 10px;border-radius:10px;font-size:18px"><span>${initials(g.away_club_name)}</span></div>
          <div style="font-size:16px;font-weight:700;color:${awayWin?'#10B981':'var(--text-primary)'}">${g.away_club_name||'—'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Гости</div>
        </div>
      </div>
    </div>
    <div class="prof-stats-bar" style="margin-top:24px;grid-template-columns:repeat(4,1fr)">
      ${[['Посещаемость',g.attendance?Number(g.attendance).toLocaleString():'—'],['Стадион',g.stadium||'—'],['Судья',g.referee||'—'],['Расстановка',g.home_formation||'—']].map(([l,v])=>`
        <div class="psb-item"><div class="psb-value" style="font-size:13px">${v}</div><div class="psb-label">${l}</div></div>`).join('')}
    </div>
    <div style="padding:20px 28px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="prof-section">
        <div class="prof-sec-title"><div class="sec-title-dot" style="background:#3B82F6"></div>Хозяева</div>
        <table class="prof-info-table">
          ${[['Тренер',g.home_manager||'—'],['Расстановка',g.home_formation||'—'],['Позиция',g.home_club_position!=null?g.home_club_position+'-е место':'—']].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
        </table>
      </div>
      <div class="prof-section">
        <div class="prof-sec-title"><div class="sec-title-dot" style="background:#F59E0B"></div>Гости</div>
        <table class="prof-info-table">
          ${[['Тренер',g.away_manager||'—'],['Расстановка',g.away_formation||'—'],['Позиция',g.away_club_position!=null?g.away_club_position+'-е место':'—']].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
        </table>
      </div>
    </div>`);
}

// ── Transfer detail ─────────────────────────────────────────────────────────
function openTransferDetail(t){
  const fee=t.fee&&t.fee!=='—'&&t.fee!=='Своб.'?t.fee:'Свободный трансфер';
  const isFree=!t.fee_fmt||Number(t.fee||0)===0;
  openDetailModal(`
    <button class="prof-close" onclick="closeDetailModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div style="padding:32px 28px 0">
      <div style="font-size:11px;color:var(--text-muted);text-align:center;font-weight:600;letter-spacing:.08em;margin-bottom:20px">ТРАНСФЕР · ${t.season||''} · ${fmtDateShort(t.date)}</div>
      <div style="display:flex;align-items:center;gap:20px;justify-content:center;flex-wrap:wrap">
        <div class="prof-avatar" style="background:${avatarGrad(t.player_name)};flex-shrink:0"><span>${initials(t.player_name)}</span></div>
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--text-primary)">${t.player_name||'—'}</div>
          <div style="margin-top:12px;display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap">
            <div style="text-align:center">
              <div class="t-avatar" style="background:${avatarGrad(t.from_club)};border-radius:8px;width:40px;height:40px;margin:0 auto"><span style="font-size:9px">${initials(t.from_club)}</span></div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${t.from_club||'—'}</div>
            </div>
            <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><line x1="0" y1="7" x2="22" y2="7" stroke="#2563EB" stroke-width="2"/><polyline points="16,1 22,7 16,13" stroke="#2563EB" stroke-width="2" fill="none"/></svg>
            <div style="text-align:center">
              <div class="t-avatar" style="background:${avatarGrad(t.to_club)};border-radius:8px;width:40px;height:40px;margin:0 auto"><span style="font-size:9px">${initials(t.to_club)}</span></div>
              <div style="font-size:12px;color:var(--text-primary);font-weight:600;margin-top:4px">${t.to_club||'—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="prof-stats-bar" style="margin-top:24px;grid-template-columns:repeat(3,1fr)">
      <div class="psb-item">
        <div class="psb-value" style="${!isFree?'color:#10B981':'color:var(--text-muted)'}">${t.fee_fmt||'Бесплатно'}</div>
        <div class="psb-label">Сумма</div>
      </div>
      <div class="psb-item"><div class="psb-value">${t.season||'—'}</div><div class="psb-label">Сезон</div></div>
      <div class="psb-item"><div class="psb-value">${fmtDateShort(t.date)}</div><div class="psb-label">Дата</div></div>
    </div>
    <div style="padding:20px 28px">
      <div class="prof-section">
        <div class="prof-sec-title"><div class="sec-title-dot" style="background:#2563EB"></div>Детали трансфера</div>
        <table class="prof-info-table">
          ${[['Игрок',t.player_name||'—'],['Из клуба',t.from_club||'—'],['В клуб',t.to_club||'—'],['Сумма',isFree?'Свободный трансфер':t.fee_fmt],['Сезон',t.season||'—'],['Дата',fmtDate(t.date)]].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
        </table>
      </div>
    </div>`);
}

// ══════════════════════════════════════════════════════════════════════════
// SCOUT PROFILE MODAL
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// SCOUT PROFILE MODAL
// ══════════════════════════════════════════════════════════════════════════

// Build activity map: counts notes saved + radar saved per day
function buildActivityMap(){
  const map={};
  const track=(dateStr)=>{
    if(!dateStr) return;
    const d=String(dateStr).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(d)) map[d]=(map[d]||0)+1;
  };
  Object.keys(localStorage).forEach(k=>{
    // Only count real player notes (numeric suffix)
    if(/^sm_note_\d+$/.test(k)){
      try{ const v=JSON.parse(localStorage.getItem(k)); track(v?.updated); }catch{}
    }
    if(k.startsWith('sm_radar_')){
      track(new Date().toISOString().slice(0,10));
    }
    if(k==='sm_wl'){
      try{
        const wl=JSON.parse(localStorage.getItem(k)||'[]');
        wl.forEach(p=>track(p.added));
      }catch{}
    }
  });
  return map;
}

function renderSbpHeatmap(){
  const el=$('sbpHeatmap'); if(!el) return;
  const map=buildActivityMap();
  const today=new Date();
  // Show last 28 days as 4 rows x 7 cols per week = 4 weeks
  const days=[];
  for(let i=27;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);
    days.push({key:d.toISOString().slice(0,10),count:map[d.toISOString().slice(0,10)]||0});
  }
  const maxAct=Math.max(1,...days.map(d=>d.count));
  const cellColor=c=>{
    if(!c) return '#0E1420';
    const p=c/maxAct;
    if(p<0.33) return '#1E3A5F';
    if(p<0.66) return '#2563EB';
    return '#60A5FA';
  };
  // Group into weeks of 7
  const weeks=[];
  for(let i=0;i<days.length;i+=7) weeks.push(days.slice(i,i+7));
  el.innerHTML=weeks.map(wk=>`
    <div class="sbp-heatmap-col">
      ${wk.map(d=>`<div class="sbp-cell" style="background:${cellColor(d.count)}" title="${d.key}: ${d.count}"></div>`).join('')}
    </div>`).join('');
}

function openScoutProfile(){
  const sp=SCOUT_PROFILE.get();
  const avi=(sp.name||'АС').split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
  const actMap=buildActivityMap();
  const wl=WL.get(), notes=NOTES.all(), recs=notes.filter(n=>n.status==='recommend');
  const activeDays=Object.keys(actMap).length;
  const totalActions=Object.values(actMap).reduce((a,b)=>a+b,0);

  // Full year heatmap
  const today=new Date();
  const days=[];
  for(let i=364;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    days.push({key,count:actMap[key]||0,dow:d.getDay()});
  }
  const firstDow=days[0].dow;
  const padded=[...Array(firstDow).fill(null),...days];
  const maxAct=Math.max(1,...days.map(d=>d.count));
  const weeks=[];
  for(let i=0;i<padded.length;i+=7) weeks.push(padded.slice(i,i+7));
  const cellColor=count=>{
    if(!count)return'#0D1117';const p=count/maxAct;
    if(p<0.25)return'#0D3068';if(p<0.5)return'#1A5AC4';if(p<0.75)return'#2563EB';return'#60A5FA';
  };
  const monthLabels=[];let lastMonth=-1;
  weeks.forEach((wk,wi)=>{const fd=wk.find(d=>d!==null);if(fd){const m=new Date(fd.key).getMonth();if(m!==lastMonth){monthLabels.push({wi,label:['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][m]});lastMonth=m;}}});

  openDetailModal(`
    <button class="prof-close" onclick="closeDetailModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="prof-hero" style="background:linear-gradient(135deg,rgba(37,99,235,0.1),transparent 65%)">
      <div class="prof-hero-inner">
        <div class="prof-av-section">
          <div class="prof-avatar" style="background:linear-gradient(135deg,#2563EB,#1D4ED8);font-size:22px;font-weight:800">${avi}</div>
          <div style="margin-top:6px"><span style="background:rgba(37,99,235,0.15);color:#60A5FA;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700">${sp.license||'UEFA'}</span></div>
        </div>
        <div class="prof-info">
          <div class="prof-name" style="font-size:22px">${sp.name}</div>
          <div class="prof-meta">
            <div class="prof-meta-chip">${sp.role}</div>
            <div class="prof-meta-chip">${sp.club}</div>
            <div class="prof-meta-chip">${sp.country}</div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.6">${sp.bio||''}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="flex-shrink:0;align-self:flex-start"
          onclick="closeDetailModal();navigate('reports');setTimeout(()=>ReportsModule.editProfile(),200)">Редактировать</button>
      </div>
    </div>
    <div class="prof-stats-bar" style="grid-template-columns:repeat(5,1fr)">
      ${[['В наблюдении',wl.length],['Рекоменд.',recs.length],['Заметок',notes.length],['Актив. дней',activeDays],['Действий',totalActions]].map(([l,v])=>`
        <div class="psb-item"><div class="psb-value">${v}</div><div class="psb-label">${l}</div></div>`).join('')}
    </div>
    <div style="padding:20px 28px 28px">
      <div class="prof-sec-title" style="margin-bottom:12px"><div class="sec-title-dot" style="background:#2563EB"></div>Активность за год
        <span style="font-size:10px;color:var(--text-muted);margin-left:8px">${totalActions} действий · ${activeDays} дней</span>
      </div>
      <div style="overflow-x:auto;padding-bottom:6px">
        <div style="min-width:min-content">
          <div style="display:flex;gap:3px;margin-bottom:4px">
            ${weeks.map((wk,wi)=>{const ml=monthLabels.find(m=>m.wi===wi);return`<div style="width:11px;font-size:8px;color:var(--text-muted);overflow:visible;white-space:nowrap">${ml?ml.label:''}</div>`;}).join('')}
          </div>
          <div style="display:inline-flex;gap:3px">
            ${weeks.map(wk=>`<div style="display:flex;flex-direction:column;gap:3px">
              ${wk.map(d=>d===null?`<div style="width:11px;height:11px"></div>`
                :`<div title="${d.key}${d.count?' · '+d.count:''}" style="width:11px;height:11px;border-radius:2px;background:${cellColor(d.count)};transition:transform .1s" onmouseover="this.style.transform='scale(1.4)'" onmouseout="this.style.transform=''"></div>`).join('')}
            </div>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:10px;color:var(--text-muted)">
            <span>Меньше</span>${['#0D1117','#0D3068','#1A5AC4','#2563EB','#60A5FA'].map(c=>`<div style="width:11px;height:11px;border-radius:2px;background:${c}"></div>`).join('')}<span>Больше</span>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">
        <div class="prof-section">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#10B981"></div>Личные данные</div>
          <table class="prof-info-table">
            ${[['Имя',sp.name],['Дата рождения',sp.dob?new Date(sp.dob).toLocaleDateString('ru-RU'):'—'],['Email',sp.email||'—'],['Телефон',sp.phone||'—'],['Страна',sp.country||'—'],['Опыт',sp.exp?sp.exp+' лет':'—']].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
          </table>
        </div>
        <div class="prof-section">
          <div class="prof-sec-title"><div class="sec-title-dot" style="background:#8B5CF6"></div>Специализация</div>
          <table class="prof-info-table">
            ${[['Должность',sp.role||'—'],['Клуб',sp.club||'—'],['Регион',sp.region||'—'],['Лицензия',sp.license||'—'],['Позиции',sp.spec||'—'],['Возраст',sp.ageRange||'—']].map(([k,v])=>`<tr><td class="pit-key">${k}</td><td class="pit-val">${v}</td></tr>`).join('')}
          </table>
        </div>
      </div>
    </div>`);
}


// ══════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════
const auth={
  showLogin(){ $('loginModal').classList.add('active'); $('loginEmail').focus(); },
  showRegister(){ $('registerModal').classList.add('active'); $('regName').focus(); },
  hideModal(id){ $(id).classList.remove('active'); auth._clearErrors(); },
  switchToRegister(){ auth.hideModal('loginModal'); auth.showRegister(); },
  switchToLogin(){ auth.hideModal('registerModal'); auth.showLogin(); },
  _clearErrors(){
    const le=$('loginError'), re=$('regError');
    if(le){le.style.display='none';le.textContent='';}
    if(re){re.style.display='none';re.textContent='';}
  },
  _showErr(id,msg){ const el=$(id); if(el){el.textContent=msg;el.style.display='block';} },
  togglePass(inputId, btn){
    const inp=$(inputId); if(!inp) return;
    inp.type=inp.type==='password'?'text':'password';
    btn.style.color=inp.type==='text'?'var(--accent-bright)':'var(--text-muted)';
  },
  regStep2(){
    const name=($('regName')?.value||'').trim();
    const email=($('regEmail')?.value||'').trim();
    const pass=($('regPassword')?.value||'').trim();
    if(!name){ auth._showErr('regError','Введите полное имя'); return; }
    if(!email||!email.includes('@')){ auth._showErr('regError','Введите корректный email'); return; }
    if(pass.length<6){ auth._showErr('regError','Пароль минимум 6 символов'); return; }
    $('regStep1').style.display='none';
    $('regStep2').style.display='block';
    auth._clearErrors();
  },
  backToStep1(){
    $('regStep2').style.display='none';
    $('regStep1').style.display='block';
    auth._clearErrors();
  },

  async login(){
    const email=($('loginEmail')?.value||'').trim();
    const pass=($('loginPassword')?.value||'').trim();
    if(!email||!pass){ auth._showErr('loginError','Введите email и пароль'); return; }
    const btn=$('loginBtn'), txt=$('loginBtnText');
    if(btn) btn.disabled=true;
    if(txt) txt.textContent='Вход...';
    try{
      const res=await fetch(`${API}/scouts/login`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password:pass})
      });
      const data=await res.json();
      if(!res.ok){ auth._showErr('loginError', data.error||'Ошибка входа'); return; }
      auth._onLogin(data);
      auth.hideModal('loginModal');
      toast(`Добро пожаловать, ${data.name}!`,'success');
    }catch(e){
      auth._showErr('loginError','Сервер недоступен. Проверьте что app.py запущен.');
    }finally{
      if(btn) btn.disabled=false;
      if(txt) txt.textContent='Войти';
    }
  },

  async register(){
    const name=($('regName')?.value||'').trim();
    const email=($('regEmail')?.value||'').trim();
    const pass=($('regPassword')?.value||'').trim();
    if(!name||!email||!pass){ auth._showErr('regError','Заполните обязательные поля'); return; }
    const btn=$('regBtn'), txt=$('regBtnText');
    if(btn) btn.disabled=true;
    if(txt) txt.textContent='Создание...';
    try{
      const res=await fetch(`${API}/scouts/register`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name, email, password:pass,
          role:    $('regRole')?.value||'Скаут',
          club:    $('regClub')?.value||'',
          country: $('regCountry')?.value||'',
          region:  $('regRegion')?.value||'',
          license: $('regLicense')?.value||'',
          phone:   $('regPhone')?.value||'',
          dob:     $('regDob')?.value||'',
          exp:     $('regExp')?.value||'',
          spec:    $('regSpec')?.value||'',
          bio:     $('regBio')?.value||'',
        })
      });
      const data=await res.json();
      if(!res.ok){ auth._showErr('regError', data.error||'Ошибка регистрации'); return; }
      auth._onLogin(data);
      // Add to SCOUT_TEAM live
      if(!SCOUT_TEAM.find(s=>s.id===data.id)){
        SCOUT_TEAM.push({id:data.id,name:data.name,role:data.role,club:data.club,region:data.region,license:data.license,avatar:data.avatar,color:data.color});
      }
      auth.hideModal('registerModal');
      toast(`Аккаунт создан! Добро пожаловать, ${data.name}!`,'success');
    }catch(e){
      auth._showErr('regError','Сервер недоступен. Проверьте что app.py запущен.');
    }finally{
      if(btn) btn.disabled=false;
      if(txt) txt.textContent='Создать аккаунт';
    }
  },

  _onLogin(scout){
    // Save current user
    CURRENT_USER.set({id:scout.id,name:scout.name,role:scout.role,club:scout.club,avatar:scout.avatar,color:scout.color});
    SCOUT_PROFILE.save(scout);
    // Update SCOUT_TEAM[0] if it's the main user
    if(SCOUT_TEAM[0].id==='sabyt'||SCOUT_TEAM.find(s=>s.id===scout.id)){
      const idx=SCOUT_TEAM.findIndex(s=>s.id===scout.id);
      if(idx>=0){ SCOUT_TEAM[idx]={...SCOUT_TEAM[idx],...scout}; }
    }
    // Update sidebar bottom panel
    const panel=$('scoutBottomPanel');
    if(panel){
      const n=panel.querySelector('.sbp-name'); if(n) n.textContent=scout.name;
      const r=panel.querySelector('.sbp-role'); if(r) r.textContent=`${scout.role||'Скаут'} · ${scout.club||''}`;
      const av=panel.querySelector('.sbp-avatar'); if(av) av.textContent=scout.avatar||initials(scout.name);
    }
    // Update top bar
    auth._updateTopBar(scout);
    updateSidebarStats();
    // Load team from API
    auth._loadTeam();
  },

  _updateTopBar(scout){
    const btns=$('authButtons'), menu=$('userMenu');
    if(btns) btns.style.display='none';
    if(menu){
      menu.style.display='flex';
      menu.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:6px 12px">
            <div style="width:26px;height:26px;border-radius:7px;background:${scout.color||'var(--accent-gradient)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">${scout.avatar||'?'}</div>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${scout.name}</div>
              <div style="font-size:10px;color:var(--text-muted)">${scout.role||'Скаут'}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;color:var(--text-muted)" onclick="auth.logout()">Выйти</button>
        </div>`;
    }
  },

  logout(){
    CURRENT_USER.set({id:'sabyt',name:'Сәбит Абзал',role:'Старший скаут',club:'ФК Астана',avatar:'АС',color:'#2563EB'});
    const btns=$('authButtons'), menu=$('userMenu');
    if(btns) btns.style.display='';
    if(menu){ menu.style.display='none'; menu.innerHTML=''; }
    toast('Вы вышли из аккаунта','info');
  },

  async _loadTeam(){
    try{
      const scouts=await fetch(`${API}/scouts`).then(r=>r.json());
      // Merge server scouts into SCOUT_TEAM
      scouts.forEach(s=>{
        const idx=SCOUT_TEAM.findIndex(x=>x.id===s.id);
        if(idx>=0) SCOUT_TEAM[idx]={...SCOUT_TEAM[idx],...s};
        else SCOUT_TEAM.push(s);
      });
    }catch(e){ /* server may not be running */ }
  },

  // Load team on init
  async init(){
    auth._loadTeam();
    // Check if already logged in
    const u=CURRENT_USER.get();
    if(u&&u.id&&u.id!=='sabyt'){
      auth._updateTopBar(u);
    }
  }
};

// ── Global Search ──────────────────────────────────────────────────────────
$('globalSearchInput')?.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const q=e.target.value.trim();
    if(q){navigate('players');setTimeout(()=>{PlayersModule.sf('name',q);const fn=$('f_name');if(fn)fn.value=q;PlayersModule.apply();},150);}
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
// Load saved profile into SCOUT_TEAM[0] on startup
(()=>{
  const p=SCOUT_PROFILE.get();
  if(p.name) SCOUT_TEAM[0].name=p.name;
  if(p.role) SCOUT_TEAM[0].role=p.role;
  if(p.club) SCOUT_TEAM[0].club=p.club;
  if(p.region) SCOUT_TEAM[0].region=p.region;
  if(p.license) SCOUT_TEAM[0].license=p.license;
  // Update sidebar panel text
  const panel=$('scoutBottomPanel');
  if(panel){
    const n=panel.querySelector('.sbp-name'); if(n&&p.name) n.textContent=p.name;
    const r=panel.querySelector('.sbp-role'); if(r) r.textContent=`${p.role||'Скаут'} · ${p.club||''}`;
  }
})();
updateSidebarStats();
renderSbpHeatmap();
auth.init();
navigate('dashboard');