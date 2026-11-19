"use strict";
/* =====================================================================
   CHESS TD — APP: save, Collection, Pre-Match Setup, Quests, battle UI,
   results. Everything saves to localStorage.
   ===================================================================== */
const $ = s => document.querySelector(s);
const fmt = n => Math.floor(n).toLocaleString();
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2000); }
function modal(html){ $('#overlay').innerHTML = `<div class="modal">${html}</div>`; $('#overlay').classList.remove('hidden'); }
function closeModal(){ $('#overlay').classList.add('hidden'); }
$('#overlay').addEventListener('click', e => { if(e.target.id === 'overlay' && !R) closeModal(); });

/* ---------- save ---------- */
const SAVE_KEY = 'chessTD_v1';
const STARTER_CREWS = ['DW','CS','TV','RB','IG'];   // you start owning 3 heroes from each of these, so 5/12 crews are active
const QUESTS = [
  {id:'w10',  txt:'Clear wave 10 in a run',             goal:10,  stat:'best',  reward:{gems:20}},
  {id:'w20',  txt:'Clear wave 20 in a run',             goal:20,  stat:'best',  reward:{gems:40}},
  {id:'win',  txt:'Win a run (survive all 30 waves)',   goal:1,   stat:'wins',  reward:{gems:60}},
  {id:'k500', txt:'Defeat 500 enemies',                 goal:500, stat:'kills', reward:{coins:300}},
  {id:'k2000',txt:'Defeat 2,000 enemies',               goal:2000,stat:'kills', reward:{gems:100}},
  {id:'t3',   txt:'Reach a Tier 3 crew synergy (6/6)',  goal:1,   stat:'tier3', reward:{gems:60}},
  {id:'star3',txt:'Merge a 3-star tower',               goal:1,   stat:'star3', reward:{gems:30}},
  {id:'runs5',txt:'Play 5 runs',                        goal:5,   stat:'runs',  reward:{coins:600}},
];
const starterRoster = () => STARTER_CREWS.flatMap(cid => CREW[cid].ids.slice().sort((a, b) => RARITY[HEROES[a].rar].ord - RARITY[HEROES[b].rar].ord || b - a).slice(0, 3));
function newSave(){ return {name:'', coins:3000, gems:300, shards:0, pity:0, owned:[], deck:{crews:[], picks:{}}, claimed:[], stats:{best:0, wins:0, kills:0, tier3:0, star3:0, runs:0}}; }
function loadSave(){
  try{ const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(s && s.stats){ const m = Object.assign(newSave(), s); m.stats = Object.assign(newSave().stats, s.stats);
      if(!Array.isArray(s.owned)) m.owned = starterRoster();
      if(!s.name) m.name = '';   // saves from before the gacha: crew unlocks become a starter roster
      delete m.unlocked; delete m.tokens; return m; } }catch(e){}
  return newSave();
}
let S = loadSave();
const owned = id => S.owned.includes(id);
const ownedIn = cid => CREW[cid].ids.filter(owned);
const activeCrews = () => CREWS.filter(c => c.ids.some(owned)).map(c => c.id);
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} updateTop(); }
function updateTop(){ $('#tb-name').textContent = S.name || 'Captain'; $('#tb-coins').textContent = fmt(S.coins); $('#tb-gems').textContent = fmt(S.gems); $('#tb-shards').textContent = fmt(S.shards);
  $('#tb-sub').textContent = `${activeCrews().length}/12 crews active · best wave ${S.stats.best}`; }

/* ---------- navigation ---------- */
let current = 'home', hist = [];
const NAVMAP = {crew:'collection'};
const RENDER = {};
function go(name, push = true){
  if(push && current !== name) hist.push(current);
  current = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === (NAVMAP[name] || name)));
  RENDER[name] && RENDER[name](); $('#main').scrollTop = 0;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]'); if(t){ hist = []; go(t.dataset.tab, false); return; }
  const b = e.target.closest('[data-go]'); if(b){ go(b.dataset.go); return; }
  if(e.target.closest('[data-back]')) go(hist.pop() || 'home', false);
});
const backbar = title => `<div class="row" style="margin:4px 0 8px"><button class="btn ghost sm" data-back aria-label="Back">‹</button><div class="h1" style="margin:0">${title}</div></div>`;

/* ---------- shared bits ---------- */
const rarCol = H => RARITY[H.rar].col;
function heroCard(id, extra = '', attrs = '', o = {}){
  const H = HEROES[id], own = owned(id) || o.battle, border = o.slot || (own ? rarCol(H) : '#33405e');
  return `<button class="hc ${own ? '' : 'unowned'} ${o.slot ? 'slotc' : ''} ${extra}" style="--rc:${border};--rar:${rarCol(H)}" data-hero="${id}" ${attrs}><img src="${cardArt(id, own)}" alt="">${own ? `<span class="cost">${H.cost}</span>` : ''}${own && H.captain ? '<span class="cap">CAPT</span>' : ''}${o.stars ? `<span class="starrow">${'★'.repeat(o.stars)}</span>` : ''}<div class="nm otl">${H.name}</div></button>`;
}
const crewIcon = c => cardArt(c.captain, true);   // crew icon = its captain's portrait
function heroModal(id){
  const H = HEROES[id], C = CREW[H.crew], Rr = RARITY[H.rar];
  if(!owned(id)){
    modal(`<div class="row" style="align-items:flex-start;gap:12px"><div style="width:110px;flex-shrink:0">${heroCard(id)}</div>
      <div><div class="h1" style="font-size:30px;margin:0">${H.name}</div><div class="muted" style="font-weight:800">${C.name} · <span style="color:${Rr.col}">${Rr.name}</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:6px">Summon to unlock this hero, or buy them in the Shard Shop for ${SHARD_PRICE} Shards.</div></div></div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" id="mclose">Close</button><button class="btn" data-tab="summon" id="mgo">Summon</button></div>`);
    $('#mclose').onclick = closeModal; $('#mgo').addEventListener('click', closeModal); return;
  }
  modal(`<div class="row" style="align-items:flex-start;gap:12px"><div style="width:110px;flex-shrink:0">${heroCard(id)}</div>
      <div style="min-width:0"><div class="h1" style="font-size:28px;margin:0">${H.name}</div>
      <div class="row" style="flex-wrap:wrap;gap:5px;margin-top:4px"><span class="pill" style="color:${Rr.col}">${Rr.name}</span><span class="pill" style="color:${C.col}">${C.name}</span><span class="pill" style="color:#cfd8e6">${ROLES[H.role].label}</span>${H.captain ? '<span class="pill" style="color:var(--gold)">Captain</span>' : ''}</div></div></div>
    <div class="statgrid"><div><small>Cost</small><b>${H.cost}G</b></div><div><small>Damage</small><b>${H.dmg}</b></div><div><small>Range</small><b>${H.range}</b></div><div><small>Atk speed</small><b>${H.aspd}/s</b></div></div>
    <div class="card" style="padding:9px;margin-bottom:6px"><b>${H.captain ? 'Captain Skill' : 'Active Skill'}</b> <span class="muted" style="font-size:12px">(fires when the energy ring fills)</span><div class="muted" style="font-size:12.5px;margin-top:2px">${heroDesc(H)}</div></div>
    <div class="card" style="padding:9px"><b>Passive</b><div class="muted" style="font-size:12.5px;margin-top:2px">${H.passive.txt}</div></div>
    <div class="note">Stars: 3 copies merge into 2★ (×1.8 damage), three 2★ into 3★ (×3.2). Upgrades add +20% damage per level (max +4).</div>
    <button class="btn ghost wide" style="margin-top:10px" id="mclose">Close</button>`);
  $('#mclose').onclick = closeModal;
}

/* ---------- HOME ---------- */
RENDER.home = () => {
  const ready = setupReady();
  $('#s-home').innerHTML = `
    <div class="scene"><div class="bg" role="img" aria-label="Crown of Seas key art"></div>
      <div class="scenebtns"><button class="btn" data-tab="setup">Play · ${ready ? 'Quick Start' : 'Set Up'}</button><button class="btn blue" data-tab="collection">Collection</button></div></div>
    <div class="row between" style="margin-top:8px"><div><div class="otl" style="font-size:26px;line-height:1">CHESS TD</div><div class="muted" style="font-size:12px;font-weight:800">Tower defense on a chess board · 12 crews · 30 waves</div></div></div>
    <div class="tiles">
      <button class="mode" data-tab="setup"><b>New Run</b><small>Up to 5 crews · 7 towers each</small></button>
      <button class="mode" data-tab="collection"><b>Collection</b><small>${S.owned.length}/139 heroes · ${activeCrews().length}/12 crews</small></button>
      <button class="mode" data-tab="summon"><b>Grand Summon</b><small>1x 300 coins · 10x guarantees Epic</small></button>
      <button class="mode" data-tab="quests"><b>Quests</b><small>${QUESTS.filter(q => questDone(q) && !S.claimed.includes(q.id)).length} rewards ready</small></button>
      <button class="mode" id="howto"><b>How to Play</b><small>Mix crews · Synergy 2/4/6</small></button>
    </div>
    <div class="card" style="margin-top:10px"><div class="row between"><b>Best wave</b><b class="otl" style="font-size:22px">${S.stats.best}/30</b></div>
      <div class="muted" style="font-size:12px">${S.stats.wins} wins · ${S.stats.runs} runs · ${fmt(S.stats.kills)} enemies defeated</div></div>`;
  $('#av').src = cardArt(CREW.DW.captain);
  $('#howto').onclick = () => modal(`<div class="h1">How to Play</div><div class="muted" style="line-height:1.55;font-size:13px">
    <b style="color:var(--ink)">Heroes:</b> summon heroes (or buy them with Shards). A crew is active once you own 1 of its heroes.<br><b style="color:var(--ink)">Before a run:</b> pick 5 active crews and up to 7 owned towers from each. That's your 35-tower deck.<br>
    <b style="color:var(--ink)">Shop:</b> 5 random towers from your deck. Tap to buy (cost = gold). Reroll for 2 gold. Interest: +1 gold per 10 saved after each wave (max 5).<br>
    <b style="color:var(--ink)">Mixing crews:</b> any tower can go on the board. Each crew's synergy only counts that crew's towers, so focusing one crew gives the biggest buff.<br>
    <b style="color:var(--ink)">Synergy 2/4/6:</b> different towers of your crew on the board. every crew has its own 2/4/6 bonuses (see each crew in Collection).<br>
    <b style="color:var(--ink)">Treasures:</b> after waves 5, 10, 15, 20 and 25 the game pauses: choose 1 of 3. Rarer tiers unlock later (Ancient Relics from wave 25).<br><b style="color:var(--ink)">Merge:</b> 3 of the same tower = 2★, three 2★ = 3★. Upgrade a placed tower with gold, sell it for a refund.<br>
    <b style="color:var(--ink)">Win:</b> survive 30 waves. A boss comes every 10 waves. Lose when base HP hits 0.</div>
    <button class="btn wide" style="margin-top:10px" onclick="closeModal()">Got it</button>`);
};

/* ---------- COLLECTION ---------- */
RENDER.collection = () => {
  $('#s-collection').innerHTML = `<div class="row between"><div class="h1">Collection</div><button class="btn sm" data-tab="summon">Summon</button></div>
    <div class="muted" style="margin-bottom:8px;font-weight:800">${S.owned.length}/139 heroes owned · ${activeCrews().length}/12 crews active. A crew is active for battle once you own 1 of its heroes.</div>
    <div class="crewgrid">${CREWS.map(c => { const n = ownedIn(c.id).length, act = n > 0;
      return `<button class="crewtile ${act ? '' : 'inactive'}" style="--cc:${c.col}" data-crew="${c.id}"><img src="${crewIcon(c)}" alt="${HEROES[c.captain].name}"><div style="min-width:0"><b>${c.name}</b>
        <small>${n}/${c.ids.length} Owned${act ? '' : ' · not active'}</small><div class="bar" style="margin-top:3px"><i style="width:${n/c.ids.length*100}%;background:${c.col}"></i></div></div></button>`; }).join('')}</div>`;
  $('#s-collection').querySelectorAll('[data-crew]').forEach(b => b.onclick = () => { crewView = b.dataset.crew; go('crew'); });
};
let crewView = 'DW';
RENDER.crew = () => {
  const c = CREW[crewView], n = ownedIn(c.id).length;
  $('#s-crew').innerHTML = `${backbar(c.name)}
    <div class="card" style="border-color:${c.col};margin-bottom:10px"><div class="row between"><b style="color:${c.col}">${n}/${c.ids.length} Owned</b><span class="muted" style="font-weight:800">${n ? 'Active for battle' : 'Own 1 hero to activate'}</span></div>
      <div class="muted" style="font-size:12px;margin-top:4px;line-height:1.55">Captain: ${HEROES[c.captain].name}<br>${SYN_N.map((k, i) => `<b style="color:var(--ink)">${k}:</b> ${synDesc(c.id, i+1)}`).join('<br>')}</div></div>
    <div class="hgrid">${c.ids.map(id => heroCard(id)).join('')}</div>`;
  $('#s-crew').querySelectorAll('[data-hero]').forEach(b => b.onclick = () => heroModal(+b.dataset.hero));
};

/* ---------- SUMMON (gacha) ---------- */
const PULL = {1:{coins:300, gems:30}, 10:{coins:2700, gems:270}};
const RATES = [['L', 0.03], ['E', 0.12], ['R', 0.25], ['C', 0.60]];
const PITY = 90, DUP_SHARDS = 20, SHARD_PRICE = 100;
let shardFilter = 'all';
RENDER.summon = () => {
  const can = (n, cur) => S[cur] >= PULL[n][cur];
  const pool = HEROES.filter(h => !owned(h.id) && (shardFilter === 'all' || h.crew === shardFilter));
  $('#s-summon').innerHTML = `<div class="h1">Summon</div>
    <div class="gbanner"><div class="gbg"></div><div class="gtxt"><div class="otl" style="font-size:34px;line-height:1">GRAND SUMMON</div>
      <div style="font-weight:800;font-size:12px">All 139 heroes · 12 crews</div>
      <div class="rates">Common 60% · Rare 25% · Epic 12% · Legendary 3%</div>
      <div class="pitybox"><b>Legendary guaranteed in ${PITY - S.pity} pulls</b><div class="bar"><i style="width:${S.pity/PITY*100}%"></i></div><small>Guaranteed Epic or better in every 10x</small></div></div></div>
    <div class="pullgrid">
      <button class="btn blue" data-pull="1:coins" ${can(1,'coins') ? '' : 'disabled'}>1x · 300 <i class="ic coin">C</i></button>
      <button class="btn blue" data-pull="1:gems" ${can(1,'gems') ? '' : 'disabled'}>1x · 30 <i class="ic gem"></i></button>
      <button class="btn glow" data-pull="10:coins" ${can(10,'coins') ? '' : 'disabled'}>10x · 2700 <i class="ic coin">C</i></button>
      <button class="btn glow" data-pull="10:gems" ${can(10,'gems') ? '' : 'disabled'}>10x · 270 <i class="ic gem"></i></button></div>
    <div class="note">Duplicates turn into ${DUP_SHARDS} Shards. Earn coins and gems from runs and quests.</div>
    <div class="card" style="margin-top:12px"><div class="row between"><div class="h2" style="margin:0">Shard Shop</div><span class="cur"><i class="ic shard"></i>${fmt(S.shards)}</span></div>
      <div class="muted" style="font-size:12px;margin:2px 0 8px">Buy any hero you don't own for ${SHARD_PRICE} Shards.</div>
      <div class="crewtabs"><button class="${shardFilter === 'all' ? 'on' : ''}" style="--cc:#9db0d6" data-sf="all">All</button>${CREWS.map(c => `<button class="${shardFilter === c.id ? 'on' : ''}" style="--cc:${c.col}" data-sf="${c.id}">${c.name.split(' ')[0]}</button>`).join('')}</div>
      ${pool.length ? `<div class="hgrid">${pool.map(h => `<div class="shopitem">${heroCard(h.id)}<div class="sn">${h.name}</div><button class="btn sm" data-shard="${h.id}" ${S.shards < SHARD_PRICE ? 'disabled' : ''}>${SHARD_PRICE} <i class="ic shard"></i></button></div>`).join('')}</div>`
        : '<div class="muted">You own every hero here.</div>'}</div>`;
  const el = $('#s-summon');
  el.querySelectorAll('[data-pull]').forEach(b => b.onclick = () => { const [n, cur] = b.dataset.pull.split(':'); summon(+n, cur); });
  el.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { shardFilter = b.dataset.sf; RENDER.summon(); });
  el.querySelectorAll('.shopitem [data-hero]').forEach(b => b.onclick = () => heroModal(+b.dataset.hero));
  el.querySelectorAll('[data-shard]').forEach(b => b.onclick = () => { const id = +b.dataset.shard;
    if(S.shards < SHARD_PRICE || owned(id)) return; S.shards -= SHARD_PRICE; S.owned.push(id); persist(); playPulls([{id, isNew:true}]); });
};
function rollRarity(){
  S.pity++; if(S.pity >= PITY) return 'L';
  let r = Math.random(); for(const [rar, p] of RATES){ if(r < p) return rar; r -= p; } return 'C';
}
function summon(n, cur){
  const cost = PULL[n][cur]; if(S[cur] < cost) return toast(`Not enough ${cur}`);
  S[cur] -= cost;
  const rars = Array.from({length:n}, rollRarity);
  if(n === 10 && !rars.some(r => r === 'E' || r === 'L')) rars[rars.length - 1] = 'E';   // guaranteed Epic in 10x
  const res = rars.map(rar => {
    if(rar === 'L') S.pity = 0;
    const pool = HEROES.filter(h => h.rar === rar), H = pool[Math.floor(Math.random()*pool.length)];
    if(owned(H.id)){ S.shards += DUP_SHARDS; return {id:H.id, isNew:false}; }
    S.owned.push(H.id); return {id:H.id, isNew:true};
  });
  persist(); playPulls(res, n, cur);
}
// card-flip reveal: 1 card for 1x, 10 cards for 10x
function playPulls(res, n, cur){
  const fx = document.createElement('div'); fx.id = 'pullfx';
  const best = res.reduce((m, r) => Math.max(m, RARITY[HEROES[r.id].rar].ord), 0);
  fx.innerHTML = `<div class="rays r${best}"></div><div class="otl" style="font-size:34px;position:relative">${res.length === 1 && n == null ? 'Hero Unlocked!' : 'Summon Results'}</div>
    <div class="pgrid ${res.length === 1 ? 'one' : ''}">${res.map((r, i) => { const H = HEROES[r.id];
      return `<div class="pcard rar${H.rar} ${r.isNew ? 'isnew' : ''}" style="--d:${0.25 + i*0.18}s"><div class="pin">
        <div class="pback"><span>♛</span></div>
        <div class="pfront">${heroCard(r.id)}${r.isNew ? '<span class="newtag">NEW!</span>' : `<span class="duptag">+${DUP_SHARDS} Shards</span>`}</div></div></div>`; }).join('')}</div>
    <div class="row" style="justify-content:center;position:relative"><button class="btn ghost" id="pdone">Done</button>${n ? `<button class="btn" id="pagain" ${S[cur] < PULL[n][cur] ? 'disabled' : ''}>Summon ${n}x again</button>` : ''}</div>`;
  $('#app').appendChild(fx);
  requestAnimationFrame(() => fx.classList.add('go'));
  const close = () => { fx.remove(); RENDER[current] && RENDER[current](); };
  fx.querySelector('#pdone').onclick = close;
  const ag = fx.querySelector('#pagain'); if(ag) ag.onclick = () => { fx.remove(); summon(n, cur); };
  fx.addEventListener('click', e => { if(!e.target.closest('button')) fx.classList.add('skip'); });
}

/* ---------- PRE-MATCH SETUP ---------- */
let setupStep = 1, setupTab = null;
const defaultPicks = cid => ownedIn(cid).sort((a, b) => RARITY[HEROES[b].rar].ord - RARITY[HEROES[a].rar].ord || a - b).slice(0, 7);
// every crew brings exactly min(7, owned) towers: all of them while you own 7 or fewer, your choice of 7 after that
const crewNeed = cid => Math.min(7, ownedIn(cid).length);
const crewPicks = cid => (S.deck.picks[cid] || []).filter(id => HEROES[id].crew === cid && owned(id));
function syncPicks(cid){ const own = ownedIn(cid); if(own.length <= 7) S.deck.picks[cid] = own.slice(); else S.deck.picks[cid] = crewPicks(cid).slice(0, 7); return S.deck.picks[cid]; }
// crews in a run: exactly min(5, active crews). With 5 or fewer active, all of them are used.
const crewsNeed = () => Math.min(5, activeCrews().length);
const setupReady = () => crewsNeed() > 0 && S.deck.crews.length === crewsNeed() && S.deck.crews.every(c => crewPicks(c).length === crewNeed(c) && crewNeed(c) > 0);
RENDER.setup = () => {
  const act = activeCrews();
  S.deck.crews = S.deck.crews.filter(c => act.includes(c));
  if(act.length <= 5) S.deck.crews = act.slice();
  const cneed = Math.min(5, act.length);
  const el = $('#s-setup'), crews = S.deck.crews;
  const steps = `<div class="steps"><span class="${setupStep === 1 ? 'on' : ''}">1 · Crews (${crews.length}/${cneed})</span><span class="${setupStep === 2 ? 'on' : ''}">2 · Set each crew (max 7)</span></div>`;
  if(setupStep === 1){
    el.innerHTML = `<div class="h1">Pre-Match Setup</div>${steps}
      <div class="pickmsg" style="margin-bottom:8px">${act.length > 5 ? `Choose 5 of ${act.length} active crews for this run` : act.length === 0 ? 'You have no heroes yet — summon some first!' : act.length < 5 ? `${act.length}/5 crews active — summon heroes from more crews to unlock them` : 'All 5 active crews go to battle'}</div>
      <div class="crewgrid">${CREWS.map(c => { const n = ownedIn(c.id).length, i = crews.indexOf(c.id);
        return `<button class="crewtile ${n ? '' : 'inactive'} ${i >= 0 ? 'sel' : ''}" style="--cc:${c.col}" data-pick="${c.id}">${i >= 0 ? `<span class="num" style="background:${SLOT_COLS[i]}">${i+1}</span>` : ''}<img src="${crewIcon(c)}" alt=""><div><b>${c.name}</b><small>${n ? `${n} owned` : 'Not active · summon a hero'}</small></div></button>`; }).join('')}</div>
      ${cneed ? `<button class="btn wide" style="margin-top:12px" id="next1" ${crews.length === cneed ? '' : 'disabled'}>Next: pick towers</button>` : '<button class="btn wide glow" style="margin-top:12px" data-tab="summon">Go to Summon</button>'}`;
    el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const id = b.dataset.pick;
      if(!act.includes(id)) return toast('Own at least 1 hero from this crew first. Try Summon!');
      if(act.length <= 5) return toast('You must use all active crews. Unlock more crews to choose.');
      const i = crews.indexOf(id); if(i >= 0) crews.splice(i, 1); else if(crews.length >= 5) return toast('5 crews max. Tap one to remove it.'); else crews.push(id);
      persist(); RENDER.setup(); });
    if($('#next1')) $('#next1').onclick = () => { crews.forEach(c => { if(ownedIn(c).length <= 7 || !crewPicks(c).length) S.deck.picks[c] = defaultPicks(c); else syncPicks(c); }); setupStep = 2; setupTab = crews[0]; persist(); RENDER.setup(); };
  } else {
    if(!crews.includes(setupTab)) setupTab = crews[0];
    crews.forEach(x => { if(ownedIn(x).length <= 7) syncPicks(x); });
    const c = CREW[setupTab], picks = S.deck.picks[c.id] = crewPicks(c.id), need = crewNeed(c.id);
    const own = ownedIn(c.id), total = crews.reduce((a, x) => a + (S.deck.picks[x] || []).filter(owned).length, 0);
    el.innerHTML = `${backbar('Pick Towers')}${steps}
      <div class="crewtabs">${crews.map(x => `<button class="${x === setupTab ? 'on' : ''}" style="--cc:${CREW[x].col}" data-tabc="${x}">${crewPicks(x).length === crewNeed(x) ? '✓ ' : ''}${CREW[x].name.split(' ')[0]} ${crewPicks(x).length}/${crewNeed(x)}</button>`).join('')}</div>
      <div class="row between"><b style="color:${c.col}">${c.name}</b><span class="muted" style="font-weight:800">${picks.length}/${need} in battle · ${own.length} unlocked</span></div>
      <div class="pickmsg">${own.length > 7 ? `Choose 7 of ${own.length} to appear in battle` : own.length < 6 ? `Crew ${own.length}/6 — Unlock ${6 - own.length} more for full synergy` : `All ${own.length} unlocked heroes go to battle${own.length < 7 ? '' : ''}`}</div>
      <div class="muted" style="font-size:12px;margin:2px 0 8px">${own.length > 7 ? 'Tap to pick or drop.' : 'Every unlocked hero is in your crew. Unlock more to choose.'} Long-press (or right-click) for stats.</div>
      <div class="hgrid">${own.map(id => heroCard(id, picks.includes(id) ? '' : 'off').replace('</button>', picks.includes(id) ? '<i class="chk"></i></button>' : '</button>')).join('')}</div>
      <button class="btn red wide" style="margin-top:12px;font-size:24px" id="go" ${setupReady() ? '' : 'disabled'}>${setupReady() ? `Start Run · ${total} towers` : `Pick ${need - picks.length > 0 ? need - picks.length + ' more for ' + c.name.split(' ')[0] : 'all crews'}`}</button>
      <div class="note">${total < 35 ? `Full deck is 35 (5 crews × 7). You have ${total}: summon more heroes to grow it.` : 'Full 35-tower deck.'} The shop deals random towers from your whole deck.</div>`;
    el.querySelector('[data-back]').onclick = e => { e.stopPropagation(); setupStep = 1; RENDER.setup(); };
    el.querySelectorAll('[data-tabc]').forEach(b => b.onclick = () => { setupTab = b.dataset.tabc; RENDER.setup(); });
    el.querySelectorAll('.hgrid [data-hero]').forEach(b => {
      let lp; b.onpointerdown = () => { lp = setTimeout(() => { lp = 'done'; heroModal(+b.dataset.hero); }, 500); };
      b.onpointerup = b.onpointerleave = () => { if(lp !== 'done') clearTimeout(lp); };
      b.oncontextmenu = e => { e.preventDefault(); heroModal(+b.dataset.hero); };
      b.onclick = () => { if(lp === 'done'){ lp = null; return; } const id = +b.dataset.hero, i = picks.indexOf(id);
        if(own.length <= 7) return toast('You must use all unlocked heroes. Unlock more to choose.');
        if(i >= 0) picks.splice(i, 1); else if(picks.length >= 7) return toast('7 towers per crew. Drop one first.'); else picks.push(id);
        persist(); RENDER.setup(); }; });
    $('#go').onclick = () => startRun();
  }
};

/* ---------- QUESTS ---------- */
const questDone = q => (S.stats[q.stat] || 0) >= q.goal;
const rewardTxt = r => r.gems ? `${r.gems} gems` : r.coins ? `${r.coins} coins` : 'Free crew unlock token';
RENDER.quests = () => {
  $('#s-quests').innerHTML = `<div class="h1">Quests</div><div class="muted" style="margin-bottom:8px;font-weight:800">Earn gems, coins and crew-unlock tokens.</div>
    ${QUESTS.map(q => { const v = Math.min(q.goal, S.stats[q.stat] || 0), done = v >= q.goal, cl = S.claimed.includes(q.id);
      return `<div class="card quest" style="${cl ? 'opacity:.5' : ''}"><div><b>${q.txt}</b><div class="muted" style="font-size:12px">${rewardTxt(q.reward)} · ${fmt(v)}/${fmt(q.goal)}</div><div class="bar"><i style="width:${v/q.goal*100}%"></i></div></div>
        ${cl ? '<b style="color:var(--good)">✓</b>' : `<button class="btn sm" data-q="${q.id}" ${done ? '' : 'disabled'}>Claim</button>`}</div>`; }).join('')}`;
  $('#s-quests').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = QUESTS.find(x => x.id === b.dataset.q);
    if(q.reward.gems) S.gems += q.reward.gems; if(q.reward.coins) S.coins += q.reward.coins; if(q.reward.token) S.tokens++;
    S.claimed.push(q.id); persist(); toast(`Claimed: ${rewardTxt(q.reward)}`); RENDER.quests(); });
};

/* =====================================================================
   BATTLE UI
   ===================================================================== */
const bcv = $('#bcv'); bcv.width = CW*DPR; bcv.height = CH*DPR;
const bctx = bcv.getContext('2d');
let dirty = true; const uiDirty = () => { dirty = true; };
function startRun(){
  const deck = S.deck.crews.flatMap(c => S.deck.picks[c]);
  if(!setupReady()) return toast('Pick 5 active crews with at least 1 tower each');
  newRun(deck); $('#battle').classList.remove('hidden'); $('#sheet').classList.add('hidden');
  dirty = true; bLast = performance.now(); cancelAnimationFrame(bRAF); bRAF = requestAnimationFrame(loop);
}
function fit(){ const f = $('#bfield'), w = f.clientWidth, h = f.clientHeight; if(!w || !h) return; const k = Math.min(w/CW, h/CH), W = Math.floor(CW*k), H = Math.floor(CH*k);
  if(bcv._w !== W || bcv._h !== H){ bcv._w = W; bcv._h = H; bcv.style.width = W + 'px'; bcv.style.height = H + 'px'; } }
function renderUI(){
  // treasure pill
  const nextTr = (Math.floor(R.wave/5) + 1)*5, wl = nextTr - R.wave;
  $('#lockbar').className = ''; $('#lockbar').innerHTML = nextTr < WAVES ? `🎁 Next Treasure in ${wl} Wave${wl === 1 ? '' : 's'}` : `🎁 ${R.treasures.length} Treasures collected`;
  $('#trstack').innerHTML = R.treasures.map(x => { const T = TR[x.id]; return `<span class="trico" style="--tc:${TR_TIERS[T.tier].col}" title="${T.name}: ${x.note || T.desc}">${T.icon}</span>`; }).join('');
  // synergy: one row of small pills, tap to expand
  const syn = allSynergy(), runCrews = R.crews.map(synergy);
  $('#synbar').innerHTML = runCrews.map(s => { const c = CREW[s.crew], lead = s.tier ? Object.entries(SYN[s.crew].t[s.tier-1])[0] : null;
      return `<button class="synpill ${s.tier ? 'on' : ''}" style="--cc:${slotCol(s.crew)}" data-syn><i></i>${c.name.split(' ')[0]} ${s.count}/6${lead ? ` <em>🔥 ${EFFECT_TXT[lead[0]](lead[1]).replace(/ Damage$/, ' DMG')}</em>` : ''}</button>`; }).join('');
  $('#synbar').querySelectorAll('[data-syn]').forEach(b => b.onclick = () => { R.synOpen = !R.synOpen; uiDirty(); });
  const sf = $('#synfull'); sf.classList.toggle('hidden', !R.synOpen);
  if(R.synOpen) sf.innerHTML = (runCrews.length ? runCrews.map(s => { const c = CREW[s.crew], next = SYN_N.find(n => s.count < n);
      return `<div><div class="row between"><b style="color:${slotCol(s.crew)}">${c.name} ${s.count}/6</b><span class="dots">${SYN_N.map(n => `<b class="${s.count >= n ? 'lit' : ''}">${n}</b>`).join('')}</span></div>
        <div class="muted">${s.tier ? synDesc(s.crew, s.tier) : 'No buff yet'}${next ? ` · need ${next - s.count} more for ${next}: ${synDesc(s.crew, SYN_N.indexOf(next) + 1).replace(/^[^:]+: /, '')}` : ' · MAX'}</div></div>`; }).join('') : '<div class="muted">No crews on the board yet.</div>') + '<div class="muted" style="text-align:center">Tap a pill to close</div>';
  // shop: identical cards stack with an x2 badge
  const groups = []; R.shop.forEach((id, i) => { if(id == null) return; const gp = groups.find(x => x.id === id); if(gp) gp.n++; else groups.push({id, i, n:1}); });
  $('#shop').innerHTML = groups.map(gp => heroCard(gp.id, `${R.gold < HEROES[gp.id].cost ? 'poor' : ''} ${copies(gp.id, 1) >= 2 ? 'merge' : ''}`, `data-buy="${gp.i}"`, {battle:true, slot:slotCol(HEROES[gp.id].crew), stars:1}).replace('</button>', gp.n > 1 ? `<span class="stackx">x${gp.n}</span></button>` : '</button>')).join('')
    + Array.from({length:5 - groups.length}, () => '<div class="hc sold"></div>').join('');
  $('#shop').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
  // bench: same hero + same star stack too (drag takes one)
  const bg = []; R.bench.slice(0, BENCH).forEach((b, i) => { if(!b) return; const gp = bg.find(x => x.id === b.id && x.star === b.star); if(gp) gp.n++; else bg.push({id:b.id, star:b.star, i, n:1}); });
  $('#bench').innerHTML = bg.map(gp => heroCard(gp.id, `${R.benchSel === gp.i ? 'sel' : ''}`, `data-bench="${gp.i}"`, {battle:true, slot:slotCol(HEROES[gp.id].crew), stars:gp.star}).replace('</button>', gp.n > 1 ? `<span class="stackx">x${gp.n}</span></button>` : '</button>')).join('')
    + Array.from({length:BENCH - bg.length}, () => '<div class="slot"></div>').join('');
  $('#bench').querySelectorAll('[data-bench]').forEach(el => el.addEventListener('pointerdown', e => benchDown(e, +el.dataset.bench)));
  $('#b-auto').classList.toggle('on', R.autoPlace); $('#b-auto').setAttribute('aria-checked', R.autoPlace);
  $('#b-reroll').disabled = R.gold < REROLL;
  // selected bench card: offer sell
  const sh = $('#sheet');
  if(R.sel){ const t = R.sel, H = HEROES[t.id], st = towerStats(t);
    sh.innerHTML = `<div class="row" style="gap:10px"><img src="${cardArt(t.id)}" alt="" style="width:54px;height:72px;object-fit:cover;border-radius:9px;border:2px solid ${rarCol(H)}">
      <div style="flex:1;min-width:0"><div class="row between"><b class="otl" style="font-size:20px">${H.name} <span class="stars">${'★'.repeat(t.star)}</span>${t.lvl > 1 ? ` <span style="color:#7fe7ff;font-size:14px">+${t.lvl-1}</span>` : ''}</b><button class="bx" id="sx" aria-label="Close">✕</button></div>
      <div class="muted" style="font-size:11.5px">${Math.round(st.dmg)} dmg · ${st.range.toFixed(1)} range · ${st.aspd.toFixed(2)}/s · ${pct(st.crit)} crit · dealt ${fmt(R.dealt[t.id] || 0)}</div>
      <div class="muted" style="font-size:11.5px"><b style="color:var(--ink)">${H.skill}:</b> ${H.captain ? 'hits every enemy for 300%' : ROLES[H.role].sdesc} · <b style="color:var(--ink)">Passive:</b> ${H.passive.txt}</div></div></div>
      <div class="row" style="margin-top:8px"><button class="btn sm" id="sup" ${t.lvl >= 5 || R.gold < upgradeCost(t) ? 'disabled' : ''}>${t.lvl >= 5 ? 'Max level' : `Upgrade · ${upgradeCost(t)}G`}</button><button class="btn red sm" id="ssell">Sell · +${sellValue(t)}G</button><span class="muted" style="font-size:11px">Drag it to move</span></div>`;
    sh.classList.remove('hidden');
    $('#sx').onclick = () => { R.sel = null; uiDirty(); }; $('#sup').onclick = () => upgradeTower(t); $('#ssell').onclick = () => sellTower(t);
  } else if(R.benchSel != null && R.bench[R.benchSel]){ const b = R.bench[R.benchSel], H = HEROES[b.id];
    sh.innerHTML = `<div class="row between"><b>${H.name} ${'★'.repeat(b.star)} <span class="muted" style="font-size:12px">· ${CREW[H.crew].name}</span></b><button class="bx" id="sx">✕</button></div>
      <div class="muted" style="font-size:12px;margin:4px 0 8px">${'Tap a square on the board to place it.'}</div>
      <div class="row"><button class="btn red sm" id="bsell">Sell · +${sellValue(b)}G</button><button class="btn ghost sm" id="binfo">Stats</button></div>`;
    sh.classList.remove('hidden');
    $('#sx').onclick = () => { R.benchSel = null; uiDirty(); }; $('#bsell').onclick = () => sellBench(R.benchSel); $('#binfo').onclick = () => heroModal(b.id);
  } else sh.classList.add('hidden');
}
function hud(){
  $('#b-wave').textContent = `Wave ${Math.max(1, R.wave)}/${WAVES}`; $('#b-left').textContent = R.waveOn ? `${R.enemies.length + R.spawnQ.length} enemies left` : R.wave ? 'Wave clear' : 'Get ready'; $('#b-gems').textContent = S.gems;
  $('#b-hp').style.width = (R.base/R.baseMax*100) + '%'; $('#b-hpn').textContent = R.base;
  const cp = $('#b-cap'), ct = `${R.towers.length}/${towerCap()} towers`; if(cp.textContent !== ct) cp.textContent = ct;
  const gEl = $('#b-gold'); if(gEl.textContent !== String(R.gold)){ gEl.textContent = R.gold; dirty = true; }
  const nb = $('#b-next');
  if(R.waveOn){ nb.disabled = true; nb.textContent = `Wave ${R.wave} · ${R.enemies.length + R.spawnQ.length} left`; }
  else { nb.disabled = !R.towers.length || R.over; nb.textContent = R.wave === 0 ? 'Start Wave 1' : `Next Wave ${R.nextIn > 0 ? Math.ceil(R.nextIn) + 's' : ''}`; }
}
function loop(now){
  if(!R) return;
  const dt = Math.min(0.05, (now - bLast)/1000); bLast = now;
  if(!R.paused && !R.over) for(let i=0;i<R.speed && R && !R.over;i++) update(dt);
  if(!R) return;
  fit(); draw(); hud(); if(dirty){ dirty = false; renderUI(); }
  bRAF = requestAnimationFrame(loop);
}
/* input: tap/drag bench cards onto squares, tap towers to inspect, drag towers to move */
function fieldPoint(e){ const r = bcv.getBoundingClientRect(); return {x:(e.clientX - r.left)/r.width*CW, y:(e.clientY - r.top)/r.height*CH, inside:e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom}; }
const tileOf = p => ({c:Math.floor((p.x - OX)/TS), r:Math.floor((p.y - OY)/TS)});
function startDrag(e, d){
  e.preventDefault(); Object.assign(drag, {active:false, sx:e.clientX, sy:e.clientY, hover:null}, d);
  const gh = $('#ghost'); gh.querySelector('img').src = cardArt(drag.id);
  const move = ev => {
    if(!drag.active && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 8){ drag.active = true; gh.classList.remove('hidden'); R.sel = null; uiDirty(); }
    if(!drag.active) return; const ar = $('#app').getBoundingClientRect(); gh.style.left = (ev.clientX - ar.left) + 'px'; gh.style.top = (ev.clientY - ar.top) + 'px';
    const p = fieldPoint(ev); drag.hover = p.inside ? tileOf(p) : null;
  };
  const up = ev => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    gh.classList.add('hidden');
    if(R && drag.active){ const p = fieldPoint(ev);
      if(p.inside){ const {c, r} = tileOf(p);
        if(drag.src === 'bench') placeFromBench(drag.i, c, r);
        else if(canPlaceTile(c, r)){ const t = drag.ref, o = towerAt(c, r); if(o && o !== t){ o.c = t.c; o.r = t.r; o.x = tileX(o.c); o.y = tileY(o.r); } t.c = c; t.r = r; t.x = tileX(c); t.y = tileY(r); }
        else toast('Towers go on open squares, not the path'); }
      R.benchSel = null; }
    else if(R && !drag.active){ if(drag.src === 'bench'){ R.benchSel = R.benchSel === drag.i ? null : drag.i; R.sel = null; } else { R.sel = drag.ref; R.benchSel = null; } }
    drag.active = false; drag.ref = null; drag.hover = null; uiDirty();
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}
function benchDown(e, i){ if(!R || R.over || !R.bench[i]) return; startDrag(e, {src:'bench', i, id:R.bench[i].id}); }
bcv.addEventListener('pointerdown', e => {
  if(!R || R.over) return;
  const p = fieldPoint(e), {c, r} = tileOf(p), t = towerAt(c, r);
  if(t) return startDrag(e, {src:'board', ref:t, id:t.id});
  if(R.benchSel != null){ if(placeFromBench(R.benchSel, c, r)) R.benchSel = null; uiDirty(); return; }
  if(R.sel){ R.sel = null; uiDirty(); }
});
$('#b-reroll').onclick = () => { if(R) rollShop(false); };
$('#b-auto').onclick = () => { if(!R) return; R.autoPlace = !R.autoPlace; if(R.autoPlace) R.bench.forEach((b, k) => { if(b) autoPlaceFrom(k); }); uiDirty(); };
$('#b-next').onclick = () => { if(R && !R.waveOn){ R.nextIn = 0; startWave(); } };
$('#b-speed').onclick = () => { if(!R) return; R.speed = R.speed === 1 ? 2 : 1; $('#b-speed').textContent = 'x' + R.speed; $('#b-speed').classList.toggle('on', R.speed === 2); };
$('#b-pause').onclick = () => {
  if(!R || R.over || R.choosing) return; R.paused = true;
  modal(`<div class="h1">Paused</div><div class="muted">Wave ${R.wave}/30 · base ${R.base}/${R.baseMax}</div>
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn red" id="pq">Quit run</button><button class="btn" id="pr">Resume</button></div>
    <div class="note">Quitting ends the run and pays rewards for the waves you cleared.</div>`);
  $('#pr').onclick = () => { closeModal(); R.paused = false; bLast = performance.now(); };
  $('#pq').onclick = () => { closeModal(); R.paused = false; endRun(false, true); };
};
document.addEventListener('visibilitychange', () => { if(document.hidden && R && !R.over && !R.paused && !R.choosing) $('#b-pause').click(); });
window.addEventListener('resize', () => { bcv._w = 0; });

/* ---------- treasure choice ---------- */
const TR_REROLL_GEMS = 30;
function showTreasure(){
  const offer = R.offer, hasRelic = offer.some(id => TR[id].tier === 'L');
  const free = R.trRerollFree + R.offerRerolls;
  modal(`<div class="otl" style="font-size:24px;text-align:center;line-height:1.1">WAVE ${R.wave} COMPLETE<br><span style="color:var(--gold)">CHOOSE TREASURE</span></div>
    <div class="muted" style="text-align:center;font-size:12px;margin:2px 0 10px">Pick 1 of 3 to continue. Treasures stack for the whole run.</div>
    <div class="trgrid">${offer.map(id => { const T = TR[id], tier = TR_TIERS[T.tier];
      return `<button class="trcard t${T.tier}" style="--tc:${tier.col}" data-tr="${id}"><span class="trtier">${tier.name}</span><span class="tricon">${T.icon}</span><b>${T.name}</b><small>${T.desc}</small></button>`; }).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost sm" id="trre" ${free || S.gems >= TR_REROLL_GEMS ? '' : 'disabled'}>Reroll · ${free ? 'FREE' : `${TR_REROLL_GEMS} <i class="ic gem"></i>`}</button></div>`);
  if(hasRelic) relicFlash();
  document.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { const id = b.dataset.tr, T = TR[id], note = pickTreasure(id); closeModal(); toast(`${T.name}${note ? ' — ' + note : ''}`); });
  $('#trre').onclick = () => {
    if(R.offerRerolls > 0) R.offerRerolls--; else if(R.trRerollFree > 0) R.trRerollFree--;
    else { if(S.gems < TR_REROLL_GEMS) return toast('Not enough gems'); S.gems -= TR_REROLL_GEMS; persist(); }
    R.offer = rollTreasures(); showTreasure();
  };
}
function relicFlash(){
  const f = document.createElement('div'); f.id = 'relicfx'; f.innerHTML = '<div class="otl">ANCIENT RELIC FOUND!</div>';
  $('#app').appendChild(f); setTimeout(() => f.remove(), 1800);
}

/* ---------- results ---------- */
function endRun(win, quit){
  if(R.over) return; R.over = true;
  const cleared = win ? WAVES : Math.max(0, R.wave - (R.waveOn ? 1 : 0));
  const coins = 20*cleared + (win ? 300 : 0), gems = win ? 15 : Math.floor(cleared/10)*3;
  S.coins += coins; S.gems += gems;
  S.stats.runs++; S.stats.kills += R.kills; S.stats.best = Math.max(S.stats.best, cleared); if(win) S.stats.wins++;
  if(R.maxTier >= 3) S.stats.tier3 = 1; if(R.merged3) S.stats.star3 = 1;
  persist();
  const top = Object.entries(R.dealt).sort((a, b) => b[1] - a[1]).slice(0, 6), max = top.length ? top[0][1] : 1;
  modal(`<div class="h1 otl" style="font-size:38px;color:${win ? 'var(--gold)' : 'var(--crimson)'}">${win ? 'Victory!' : quit ? 'Run ended' : 'Base fallen'}</div>
    <div class="muted" style="font-weight:800">Waves cleared ${cleared}/30 · ${fmt(R.kills)} enemies · best synergy tier ${R.maxTier}</div>
    <div class="row" style="justify-content:center;gap:10px;margin:10px 0"><span class="cur"><i class="ic coin">C</i>+${fmt(coins)}</span>${gems ? `<span class="cur"><i class="ic gem"></i>+${gems}</span>` : ''}</div>
    ${R.treasures.length ? `<div class="muted" style="font-size:12px;margin-bottom:8px">Treasures: ${R.treasures.map(x => TR[x.id].icon + ' ' + TR[x.id].name).join(' · ')}</div>` : ''}
    <div class="card" style="padding:10px"><b>Damage dealt</b>${top.length ? top.map(([id, v]) => `<div class="dmgrow"><img src="${cardArt(+id)}" alt=""><div><div>${HEROES[id].name}</div><div class="bar"><i style="width:${v/max*100}%"></i></div></div><span>${fmt(v)}</span></div>`).join('') : '<div class="muted">No damage dealt</div>'}</div>
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" id="rhome">Home</button><button class="btn red" id="ragain">Play again</button></div>`);
  const exit = () => { closeModal(); $('#battle').classList.add('hidden'); cancelAnimationFrame(bRAF); R = null; };
  $('#rhome').onclick = () => { exit(); go('home', false); };
  $('#ragain').onclick = () => { exit(); startRun(); };
}

/* ---------- captain name, settings, restart ---------- */
function askName(first){
  modal(`<div class="h1" style="text-align:center">${first ? 'Welcome, Captain!' : 'Captain name'}</div>
    ${first ? '<div class="muted" style="text-align:center;margin-bottom:10px">Choose your captain name. You start with <b style="color:var(--gold)">3,000 coins</b> and <b style="color:#7fd0ff">300 gems</b>: enough for one 10x summon with each.</div>' : ''}
    <input id="nm" maxlength="16" autocomplete="off" placeholder="Captain name" value="${(S.name || '').replace(/"/g, '&quot;')}" style="width:100%;font:900 18px var(--body);padding:10px 12px;border-radius:12px;border:1px solid rgba(255,215,0,.6);background:#0a1628;color:#fff">
    <button class="btn wide" id="nmok" style="margin-top:10px">${first ? 'Set sail' : 'Save'}</button>`);
  const inp = $('#nm'); setTimeout(() => inp.focus(), 50);
  const ok = () => { const v = inp.value.trim(); if(!v) return toast('Enter a name'); S.name = v.slice(0, 16); persist(); closeModal();
    if(first){ toast(`Welcome aboard, ${S.name}! Summon your first heroes.`); go('summon', false); } };
  $('#nmok').onclick = ok; inp.onkeydown = e => { if(e.key === 'Enter') ok(); };
}
$('#av').closest('.who').style.cursor = 'pointer';
$('#av').closest('.who').onclick = () => {
  if(R) return;
  modal(`<div class="h1">Captain</div><div class="muted" style="margin-bottom:10px">${S.name} · ${S.owned.length}/139 heroes · best wave ${S.stats.best}</div>
    <button class="btn wide" id="rename">Change name</button>
    <button class="btn red wide" id="restart" style="margin-top:8px">Restart from scratch</button>
    <button class="btn ghost wide" id="sclose" style="margin-top:8px">Close</button>`);
  $('#rename').onclick = () => askName(false);
  $('#sclose').onclick = closeModal;
  $('#restart').onclick = () => {
    modal(`<div class="h1" style="color:var(--crimson)">Restart?</div><div class="muted">This deletes all your heroes, coins, gems, shards and quest progress on this device. It can't be undone.</div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn ghost" id="rno">Cancel</button><button class="btn red" id="ryes">Delete & restart</button></div>`);
    $('#rno').onclick = closeModal;
    $('#ryes').onclick = () => { S = newSave(); persist(); closeModal(); go('home', false); askName(true); };
  };
};

/* ---------- boot ---------- */
updateTop();
loadArt().then(() => { go('home', false); if(!S.name) askName(true); });
