"use strict";
/* =====================================================================
   CHESS TD — BATTLE
   8x8 chess board, enemies walk a fixed path to your base.
   Shop deals random towers from your 35-tower deck. The FIRST tower you
   place locks that crew for the run; after that only that crew can be
   placed and the shop deals only that crew.
   ===================================================================== */
const N = 8, NR = 6, TS = 80, OX = 40, OY = 40, CW = N*TS + OX*2, CH = NR*TS + OY*2;   // board: 8 columns x 6 rows
const PATHS = [   // 5 short winding roads, entrance on the left, castle on the right
  [[-1,1],[1,1],[1,4],[3,4],[3,1],[5,1],[5,4],[8,4]],          // Double U
  [[-1,4],[2,4],[2,1],[5,1],[5,4],[8,4]],                      // Crown Arch
  [[-1,4],[1,4],[1,1],[3,1],[3,3],[5,3],[5,1],[7,1],[7,4],[8,4]], // Comb Reef
  [[-1,1],[4,1],[4,3],[1,3],[1,5],[8,5]],                      // Hairpin
  [[-1,0],[1,0],[1,2],[3,2],[3,4],[6,4],[6,1],[8,1]],          // Stairway
];
const WAVES = 30, BASE_HP = 20, START_GOLD = 8, REROLL = 2, BENCH = 6;
const STAR_MUL = [0, 1, 1.8, 3.2], SHOP_W = {C:1, R:0.75, E:0.5, L:0.3};
const ENEMY = {
  walker: {hp:1.0, spd:0.95, leak:1},
  runner: {hp:0.6, spd:1.7,  leak:1},
  brute:  {hp:2.6, spd:0.65, leak:2},
  armored:{hp:1.5, spd:0.85, leak:1, armor:0.35},
};
// how many towers fit on the board: 6 at the start, +1 every 4 waves, max 12
const towerCap = () => Math.min(14, 6 + Math.floor(R.wave/4) + (R ? R.tr.slots : 0));
// colours for the (up to) 5 crews in a run, in the order picked: red, orange-yellow, green, blue, purple
const SLOT_COLS = ['#ff4d5a', '#ffb020', '#3ddc84', '#3d9bff', '#b65cff'];
const slotCol = cid => { const i = R ? R.crews.indexOf(cid) : -1; return i >= 0 ? SLOT_COLS[i] : '#9aa4b8'; };
const tileX = c => OX + (c + 0.5)*TS, tileY = r => OY + (r + 0.5)*TS;
let R = null, bRAF = 0, bLast = 0, boardBg = null;

/* ---------- path ---------- */
function buildPath(pts0){
  const raw = pts0.map(([c, r]) => ({x:tileX(c), y:tileY(r)}));
  // round every corner with a curve so the road (and the enemies) turn smoothly
  const pts = [raw[0]];
  for(let i=1;i<raw.length-1;i++){
    const p = raw[i], a = raw[i-1], b = raw[i+1], la = Math.hypot(p.x-a.x, p.y-a.y), lb = Math.hypot(b.x-p.x, b.y-p.y), rad = Math.min(TS*0.6, la/2, lb/2);
    const p1 = {x:p.x + (a.x-p.x)/la*rad, y:p.y + (a.y-p.y)/la*rad}, p2 = {x:p.x + (b.x-p.x)/lb*rad, y:p.y + (b.y-p.y)/lb*rad};
    for(let k=0;k<=8;k++){ const t = k/8, u = 1 - t; pts.push({x:u*u*p1.x + 2*u*t*p.x + t*t*p2.x, y:u*u*p1.y + 2*u*t*p.y + t*t*p2.y}); }
  }
  pts.push(raw[raw.length-1]);
  const segs = []; let len = 0;
  for(let i=0;i<pts.length-1;i++){ const a = pts[i], b = pts[i+1], l = Math.hypot(b.x-a.x, b.y-a.y); if(l < 0.01) continue; segs.push({a, b, l, s:len}); len += l; }
  const tiles = new Set();
  for(let i=0;i<pts0.length-1;i++){ let [c0, r0] = pts0[i]; const [c1, r1] = pts0[i+1]; const dc = Math.sign(c1-c0), dr = Math.sign(r1-r0);
    while(true){ if(c0>=0 && c0<N && r0>=0 && r0<NR) tiles.add(c0+','+r0); if(c0 === c1 && r0 === r1) break; c0 += dc; r0 += dr; } }
  return {segs, len, tiles, start:raw[0], end:raw[raw.length-1]};
}
function posAt(d){ for(const s of R.path.segs) if(d <= s.s + s.l){ const k = (d - s.s)/s.l; return {x:s.a.x + (s.b.x-s.a.x)*k, y:s.a.y + (s.b.y-s.a.y)*k}; } return {x:R.path.end.x, y:R.path.end.y}; }

/* ---------- modes: Quest stages (30 waves each, harder every stage) and PvP (last one standing) ---------- */
const STAGE_N = 20, SEAS = ['Coral Shallows', 'Storm Reach', 'Ironclad Strait', 'Crown Waters'];
const MAP_NAMES = ['Double U', 'Crown Arch', 'Comb Reef', 'Hairpin', 'Stairway'];
function stageInfo(st, hard){
  const hpMul = (0.2 + 0.065*(st - 1))*(hard ? 1.5 : 1);   // stage 1 = 0.20, stage 20 = 1.44 (classic was 1.0)
  return {waves:WAVES, hpMul, spdMul:hard ? 1.08 : 1, base:hard ? 15 : BASE_HP, map:(st - 1) % PATHS.length,
    sea:SEAS[Math.floor((st - 1)/5)], coins:150 + 30*st, gems:15 + 3*st};
}
const RIVAL_NAMES = ['Redfin', 'Saltjaw', 'Marrow', 'Gale Vask', 'Okra Bell', 'Tidecutter', 'Brindle', 'Ash Corsa', 'Nettle', 'Quill', 'Harrow', 'Juniper Vane', 'Corvid', 'Sable Pike'];
function makeRivals(){
  const names = RIVAL_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 7);
  // each rival starts leaking somewhere between wave 5 and wave 26, so they drop out one by one (last one around wave 33)
  return names.map((name, i) => ({name, hp:BASE_HP, soft:5 + i*3 + Math.random()*3, out:0}));
}
function pvpTick(){
  const w = R.wave;
  for(const rv of R.rivals){ if(rv.out) continue;
    if(w > rv.soft){ const d = Math.round(Math.random()*(1 + (w - rv.soft)*0.7) + (w % 10 === 0 ? 3 : 0)); rv.hp = Math.max(0, rv.hp - d); }
    if(rv.hp <= 0){ rv.out = w; const left = R.rivals.filter(x => !x.out).length + 1; banner(`${rv.name.toUpperCase()} ELIMINATED · ${left} LEFT`, '#ff9f43'); } }
  uiDirty();
  if(R.rivals.every(x => x.out)){ endRun(true); return true; }
  return false;
}
const pvpPlace = () => R.rivals.filter(x => !x.out).length + 1;

/* ---------- run setup ---------- */
function newRun(deck, mode = {kind:'stage', stage:1, hard:false}){
  const pvp = mode.kind === 'pvp', si = pvp ? null : stageInfo(mode.stage, mode.hard);
  const path = buildPath(PATHS[pvp ? Math.floor(Math.random()*PATHS.length) : si.map]);
  const base = pvp ? BASE_HP : si.base;
  R = {mode, waves:pvp ? Infinity : si.waves, hpMul:pvp ? 0.75 : si.hpMul, spdMul:pvp ? 1 : si.spdMul, rivals:pvp ? makeRivals() : null,
    deck:deck.slice(), crews:[...new Set(deck.map(id => HEROES[id].crew))], lock:null, path, gold:START_GOLD, base, baseMax:base,
    wave:0, waveOn:false, nextIn:0, spawnQ:[], spawnT:0, towers:[], bench:Array(BENCH).fill(null), shop:[], enemies:[], projs:[], fx:[], texts:[],
    speed:1, paused:false, autoPlace:false, sel:null, benchSel:null, kills:0, leaks:0, shieldLeft:0, dealt:{}, time:0, over:false, best3:false, merged3:false, maxTier:0,
    tr:newTreasureState(), treasures:[], trRerollFree:1, choosing:false, freeRerolls:0, revived:false, cannonT:10, M:null};
  rollShop(true);
  boardBg = renderBoard();
}
const shopPool = () => R.deck;
function rollShop(free){
  if(!free){ if(R.freeRerolls > 0) R.freeRerolls--; else { if(R.gold < REROLL) return toast('Not enough gold'); R.gold -= REROLL; } }
  const pool = shopPool(), tot = pool.reduce((a, id) => a + SHOP_W[HEROES[id].rar], 0);
  R.shop = Array.from({length:5}, () => { let x = Math.random()*tot; for(const id of pool){ x -= SHOP_W[HEROES[id].rar]; if(x <= 0) return id; } return pool[0]; });
  uiDirty();
}

/* ---------- synergy ---------- */
// each crew counts its own different towers on the board (+ Synergy Crystal / Relic of the Crew bonuses) -> 2 / 4 / 6
const TOWER_KEYS = new Set(['dmg','aspd','crit','critMul','range','pierce','charge','lastStand','lifesteal','slowAura','pull','stunHit','skillStun']);
function synCount(crew){
  const n = new Set(R.towers.filter(t => HEROES[t.id].crew === crew && !t.temp).map(t => t.id)).size;
  return n ? n + (R.tr.crystal[crew] || 0) + R.tr.crewAll : 0;
}
function synergy(crew){ const count = synCount(crew); return {crew, count, tier:SYN_N.filter(n => count >= n).length}; }
function allSynergy(){ return CREWS.map(c => synergy(c.id)).filter(s => s.count > 0).sort((a, b) => b.tier - a.tier || b.count - a.count); }
// recompute every crew buff into R.M: {all:{}, crew:{CS:{}..}, g:{}} (g = base / economy effects)
function computeMods(){
  const M = {all:{}, crew:{}, g:{}};
  for(const s of allSynergy()){ if(!s.tier) continue;
    const d = SYN[s.crew], eff = d.t[s.tier - 1];
    for(const k in eff){ const tgt = !TOWER_KEYS.has(k) ? M.g : d.scope === 'all' ? M.all : (M.crew[s.crew] = M.crew[s.crew] || {});
      tgt[k] = k === 'critMul' ? Math.max(tgt[k] || 0, eff[k]) : (tgt[k] || 0) + eff[k]; } }
  R.M = M;
  const max = Math.round(BASE_HP*(1 + (M.g.baseHp || 0))) + R.tr.life;
  if(max > R.baseMax) R.base += max - R.baseMax; R.baseMax = max; R.base = Math.min(R.base, R.baseMax);
  return M;
}
const gmod = k => (R.M && R.M.g[k]) || 0;
const tmod = (t, k) => { if(!R.M) return 0; const c = R.M.crew[HEROES[t.id].crew] || {}; return k === 'critMul' ? Math.max(R.M.all[k] || 0, c[k] || 0) : (R.M.all[k] || 0) + (c[k] || 0); };

/* ---------- placing / merging ---------- */
const copies = (id, star) => R.towers.filter(t => t.id === id && t.star === star).length + R.bench.filter(b => b && b.id === id && b.star === star).length;
const towerAt = (c, r) => R.towers.find(t => t.c === c && t.r === r);
function canPlaceTile(c, r){ return c >= 0 && c < N && r >= 0 && r < NR && !R.path.tiles.has(c+','+r); }
function buy(i){
  const id = R.shop[i]; if(id == null || R.over) return;
  const H = HEROES[id]; if(R.gold < H.cost) return toast('Not enough gold');
  let slot = R.bench.indexOf(null);
  if(slot < 0){ if(copies(id, 1) < 2) return toast('Bench full: place or sell a tower'); R.bench.push(null); slot = BENCH; }
  R.gold -= H.cost; R.shop[i] = null; R.bench[slot] = {id, star:1, lvl:1, spent:0};
  mergeAll();
  if(R.autoPlace){ const k = R.bench.findIndex(b => b && b.id === id); if(k >= 0) autoPlaceFrom(k); }
  uiDirty();
}
function lockCheck(id){
  const crew = HEROES[id].crew;
  if(R.lock && R.lock !== crew){ toast(`Crew Locked: ${CREW[R.lock].name}. Only its towers can go on this board.`); return false; }
  return true;
}
function placeFromBench(k, c, r){
  const it = R.bench[k]; if(!it) return false;
  if(!canPlaceTile(c, r)){ toast('Towers go on open squares, not the path'); return false; }
  const occ = towerAt(c, r);
  if(!occ && R.towers.length >= towerCap()){ toast(`Board full: ${towerCap()} towers max right now (+1 every 4 waves). Merge or sell to make room.`); return false; }
  if(occ){ R.bench[k] = {id:occ.id, star:occ.star, lvl:occ.lvl, spent:occ.spent}; R.towers.splice(R.towers.indexOf(occ), 1); } else R.bench[k] = null;
  R.towers.push(makeTower(it, c, r));
  fxBurst(tileX(c), tileY(r), CREW[HEROES[it.id].crew].col, 16);
  mergeAll(); uiDirty(); return true;
}
function autoPlaceFrom(k){
  const it = R.bench[k]; if(!it || R.towers.length >= towerCap()) return;
  let best = null, bs = -1;
  for(let r=0;r<NR;r++) for(let c=0;c<N;c++){ if(!canPlaceTile(c, r) || towerAt(c, r)) continue;
    let s = 0; for(const t of R.path.tiles){ const [pc, pr] = t.split(',').map(Number); const d = Math.max(Math.abs(pc-c), Math.abs(pr-r)); if(d <= 2) s += d === 1 ? 2 : 1; }
    if(s > bs){ bs = s; best = {c, r}; } }
  if(best) placeFromBench(k, best.c, best.r);
}
function makeTower(it, c, r){ return {id:it.id, star:it.star, lvl:it.lvl || 1, spent:it.spent || 0, c, r, x:tileX(c), y:tileY(r), cd:0.4, energy:0, swing:0, attacks:0, rallyT:0, opened:false, face:1}; }
function mergeAll(){
  let changed = true;
  while(changed){ changed = false;
    for(const star of [1, 2]){
      const groups = {};
      R.towers.forEach(t => { if(t.star === star) (groups[t.id] = groups[t.id] || []).push({board:true, ref:t}); });
      R.bench.forEach((b, i) => { if(b && b.star === star) (groups[b.id] = groups[b.id] || []).push({board:false, i, ref:b}); });
      for(const id in groups){ const g3 = groups[id]; if(g3.length < 3) continue;
        g3.sort((a, b) => b.board - a.board); const [keep, ...rest] = g3.slice(0, 3);
        keep.ref.star = star + 1; keep.ref.lvl = Math.max(...g3.slice(0,3).map(x => x.ref.lvl || 1)); keep.ref.spent = g3.slice(0,3).reduce((a, x) => a + (x.ref.spent || 0), 0);
        for(const x of rest){ if(x.board) R.towers.splice(R.towers.indexOf(x.ref), 1); else R.bench[x.i] = null; }
        toast(`${HEROES[+id].name} merged to ${'★'.repeat(star + 1)}!`); if(star + 1 === 3) R.merged3 = true;
        if(keep.board) fxBurst(keep.ref.x, keep.ref.y, '#ffcf3d', 30);
        changed = true; break; }
      if(changed) break; } }
  if(R.bench.length > BENCH){ const extra = R.bench.splice(BENCH); for(const e of extra) if(e){ const k = R.bench.indexOf(null); if(k >= 0) R.bench[k] = e; } }
  computeMods(); for(const s of allSynergy()) if(s.tier > R.maxTier) R.maxTier = s.tier;
}
const sellValue = t => t.temp ? 0 : HEROES[t.id].cost*[0,1,3,9][t.star] + Math.floor((t.spent || 0)/2);
function sellTower(t){ R.gold += sellValue(t); R.towers.splice(R.towers.indexOf(t), 1); R.sel = null; computeMods(); toast(`Sold for ${sellValue(t)} gold`); uiDirty(); }
function sellBench(k){ const b = R.bench[k]; if(!b) return; R.gold += sellValue(b); R.bench[k] = null; R.benchSel = null; uiDirty(); }
const upgradeCost = t => HEROES[t.id].cost*2*t.lvl + 2;
function upgradeTower(t){ if(t.lvl >= 5) return toast('Max upgrade level'); const c = upgradeCost(t); if(R.gold < c) return toast('Not enough gold'); R.gold -= c; t.spent += c; t.lvl++; fxBurst(t.x, t.y, '#7fe7ff', 16); uiDirty(); }

/* ---------- tower stats ---------- */
function towerStats(t){
  const H = HEROES[t.id], R0 = ROLES[H.role], P = H.passive.id, m = k => tmod(t, k);
  let dmg = H.dmg*STAR_MUL[t.star]*(1 + 0.2*(t.lvl - 1))*(1 + m('dmg') + R.tr.dmg);
  if(m('lastStand') && R.base < R.baseMax*0.3) dmg *= 1 + m('lastStand');
  const aspd = H.aspd*(1 + m('aspd') + R.tr.aspd + (P === 'quick' ? 0.15 : 0) + (t.rallyT > 0 ? 0.4 : 0))*(1 + 0.05*(t.lvl - 1));
  const range = (H.range + 0.15*(t.star - 1) + (P === 'eagle' ? 0.4 : 0))*(1 + m('range'));
  const crit = 0.05 + (P === 'keen' ? 0.12 : 0) + m('crit');
  return {dmg, aspd, range, crit, critMul:m('critMul') || 2, splash:R0.splash || 0, slow:(R0.slow || 0) + (P === 'chill' ? 0.15 : 0),
    pierce:m('pierce'), charge:m('charge') + R.tr.charge, lifesteal:m('lifesteal'), slowAura:m('slowAura'), pull:m('pull'), stunHit:m('stunHit'), skillStun:m('skillStun') + R.tr.skillStun};
}

/* ---------- waves ---------- */
let HP_GROW = 1.16;   // enemy toughness per wave
const waveHp = w => 40*Math.pow(HP_GROW, w - 1);
function startWave(){
  if(R.waveOn || R.over || R.wave >= R.waves) return;
  R.wave++; R.waveOn = true; R.towers.forEach(t => t.opened = false); computeMods();
  if(gmod('waveGold')) R.gold += gmod('waveGold');
  R.freeRerolls = gmod('freeReroll');
  treasureWaveStart();
  const w = R.wave, list = [], n = Math.round(6 + w*0.8);
  const pool = ['walker']; if(w >= 3) pool.push('runner'); if(w >= 6) pool.push('brute'); if(w >= 9) pool.push('armored');
  for(let i=0;i<n;i++) list.push({type:pool[Math.floor(Math.random()*pool.length)], gap: 0.7 - Math.min(0.3, w*0.01)});
  if(w % 10 === 0) list.push({type:'boss', gap:1.5});
  R.spawnQ = list; R.spawnT = 0.3;
  banner(w % 10 === 0 ? `WAVE ${w} · BOSS` : `WAVE ${w}`, w % 10 === 0 ? '#ff4d6d' : '#ffe48a');
  uiDirty();
}
function spawn(it){
  const w = R.wave, boss = it.type === 'boss', E = ENEMY[boss ? 'brute' : it.type];
  const hp = waveHp(w)*(boss ? 22 + w*0.6 : E.hp)*R.hpMul;
  R.enemies.push({type:it.type, boss, hp, maxHp:hp, spd:(boss ? 0.5 : E.spd)*(1 + 0.012*Math.min(w, 40))*R.spdMul, leak: boss ? 6 : E.leak, armor:E.armor || 0,
    dist:0, x:R.path.start.x, y:R.path.start.y, slowT:0, slowF:0, stun:0, burn:0, burnDps:0, poison:0, poisonStacks:0, hit:0, seed:Math.random()*9, alive:true});
}
function waveCleared(){
  R.waveOn = false; computeMods();
  const interest = Math.min(5, Math.floor(R.gold/10));
  const bonus = Math.round((3 + interest + gmod('income') + R.tr.income)*(1 + gmod('goldPct'))*R.tr.goldMul); R.gold += bonus;
  if(gmod('healWave')) R.base = Math.min(R.baseMax, R.base + gmod('healWave'));
  treasureWaveEnd();
  banner(`WAVE ${R.wave} CLEAR  +${bonus} GOLD${interest ? ` (${interest} interest)` : ''}`, '#7be36b');
  if(R.wave >= R.waves) return endRun(true);
  if(R.rivals && pvpTick()) return;
  rollShop(true); R.nextIn = 6;
  if(R.wave % 5 === 0 && R.wave < R.waves) offerTreasure();   // every 5 waves: pause and choose 1 of 3
  uiDirty();
}

/* ---------- combat ---------- */
function damage(e, amt, t, opts = {}){
  if(!e.alive) return;
  const H = t ? HEROES[t.id] : null;
  if(H && H.passive.id === 'giant' && e.boss) amt *= 1.3;
  if(e.markT > 0) amt *= 1 + e.markF;
  const st = t && t.st, a = amt*(1 - e.armor*(1 - (st ? st.pierce : 0)));
  e.hp -= a; e.hit = 0.08;
  if(t){ R.dealt[t.id] = (R.dealt[t.id] || 0) + a; }
  if(opts.crit || Math.random() < 0.3) R.texts.push({x:e.x + (Math.random()-0.5)*14, y:e.y - 34, text:Math.round(a), col:opts.crit ? '#ffcf3d' : '#fff', t:0.6, size:opts.crit ? 24 : 16});
  if(t && !opts.noProc && e.alive){
    if(st && st.stunHit && Math.random() < st.stunHit) e.stun = Math.max(e.stun, 1);
    if(st && st.pull && Math.random() < st.pull){ e.dist = Math.max(0, e.dist - 2*TS); R.texts.push({x:e.x, y:e.y - 30, text:'PULLED', col:'#b0305f', t:0.6, size:14}); }
    if(R.tr.burn){ e.burn = 2; e.burnDps = Math.max(e.burnDps, a*0.25); }
    if(R.tr.frost){ e.slowT = 1.2; e.slowF = Math.max(e.slowF, 0.25); }
    if(R.tr.gale && Math.random() < 0.2) e.dist = Math.max(0, e.dist - 10);
    if(R.tr.stunHit && Math.random() < R.tr.stunHit) e.stun = Math.max(e.stun, 0.6); }
  if(e.hp <= 0) kill(e, t);
}
function kill(e, t){
  e.alive = false; R.kills++; let g = e.boss ? 15 : 1;
  const kg = gmod('killGold'); if(kg){ g += Math.floor(g*kg) + (Math.random() < (g*kg) % 1 ? 1 : 0); }
  if(t && t.st && t.st.lifesteal && Math.random() < t.st.lifesteal) R.base = Math.min(R.baseMax, R.base + 1);
  if(t && HEROES[t.id].passive.id === 'greed'){ t.kills = (t.kills || 0) + 1; if(t.kills % 8 === 0) g++; }
  R.gold += Math.round(g*R.tr.goldMul); fxBurst(e.x, e.y, e.boss ? '#ffcf3d' : '#ff8a6a', e.boss ? 40 : 8);
  if(e.boss) R.shake = 0.6;
}
function castSkill(t, st){
  const H = HEROES[t.id], col = CREW[H.crew].col, alive = R.enemies.filter(e => e.alive);
  const inRange = alive.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= st.range*TS);
  const near = (c, r) => alive.filter(o => o.alive && Math.hypot(o.x - c.x, o.y - c.y) <= r*TS);
  const ring = (x, y, r, c = col) => R.fx.push({ring:true, x, y, r, t:0.4, col:c});
  const stun = (e, s) => { e.stun = Math.max(e.stun, s); };
  const slow = (e, f, s) => { e.slowT = Math.max(e.slowT, s); e.slowF = Math.max(e.slowF, e.boss ? f/2 : f); };
  const burn = (e, dps, s) => { e.burn = Math.max(e.burn, s); e.burnDps = Math.max(e.burnDps, dps); };
  const mark = (e, f, s) => { e.markT = Math.max(e.markT || 0, s); e.markF = Math.max(e.markF || 0, f); };
  const push = (e, tiles) => { e.dist = Math.max(0, e.dist - (e.boss ? tiles/3 : tiles)*TS); const p = posAt(e.dist); e.x = p.x; e.y = p.y; };
  R.texts.push({x:t.x, y:t.y - 50, text:H.skill.toUpperCase() + '!', col, t:1.1, size:H.captain ? 24 : 18});
  if(H.captain){
    const C = CAPTAIN[H.crew]; let hit = 0;
    for(const e of alive){ damage(e, st.dmg*C.mul, t); hit++; if(!e.alive) continue;
      if(C.extra === 'stun') stun(e, 1.5 + st.skillStun);
      else if(C.extra === 'quake'){ stun(e, 1 + st.skillStun); push(e, 1); }
      else if(C.extra === 'pull') push(e, 2);
      else if(C.extra === 'gale') push(e, 2.5);
      else if(C.extra === 'burn') burn(e, st.dmg*0.6, 4);
      else if(C.extra === 'soul'){ if(!e.boss && e.hp < e.maxHp*0.25) damage(e, e.hp + 1, t, {noProc:true}); }
      else if(C.extra === 'melt'){ burn(e, st.dmg*0.4, 3); mark(e, 0.3, 5); }
      else if(C.extra === 'slow') slow(e, 0.6, 5); }
    if(C.extra === 'smash'){ const e = R.enemies.filter(e => e.alive).sort((a, b) => b.hp - a.hp)[0]; if(e){ damage(e, st.dmg*8, t, {crit:true}); fxBurst(e.x, e.y, col, 24); } }
    if(C.extra === 'pull') R.base = Math.min(R.baseMax, R.base + 1);
    if(C.extra === 'heal') R.base = Math.min(R.baseMax, R.base + 2);
    if(C.extra === 'gold' && hit) R.gold += Math.floor(hit/3);
    R.flash = 0.35; R.flashCol = col; R.shake = 0.3; return;
  }
  const k = H.kit, selfOnly = k === 'rally' || k === 'mend';
  if(!inRange.length && !selfOnly){ t.energy = 7; return; }
  const front = inRange.slice().sort((a, b) => b.dist - a.dist)[0];
  if(k === 'flurry'){ const e = inRange.sort((a, b) => Math.hypot(a.x-t.x, a.y-t.y) - Math.hypot(b.x-t.x, b.y-t.y))[0]; for(let i=0;i<5;i++) damage(e, st.dmg*1.2, t, {noProc:i > 0}); fxSlash(e.x, e.y, col); }
  else if(k === 'snipe'){ const e = inRange.sort((a, b) => b.hp - a.hp)[0]; damage(e, st.dmg*4.5, t, {crit:true}); R.fx.push({beam:true, x:t.x, y:t.y-20, tx:e.x, ty:e.y, t:0.25, col}); }
  else if(k === 'blast'){ for(const o of near(front, 1.5)) damage(o, st.dmg*2.5, t); ring(front.x, front.y, 1.5*TS); fxBurst(front.x, front.y, col, 14); }
  else if(k === 'quake'){ for(const e of inRange){ stun(e, 1.5 + st.skillStun); damage(e, st.dmg*1.5, t); } ring(t.x, t.y, st.range*TS, '#ffe48a'); }
  else if(k === 'rally'){ for(const o of R.towers) if(Math.hypot(o.x - t.x, o.y - t.y) <= 1.6*TS) o.rallyT = 5; ring(t.x, t.y, 1.6*TS, '#7be36b'); }
  else if(k === 'sweep'){ for(const e of inRange){ damage(e, st.dmg*2, t); fxSlash(e.x, e.y, col); } ring(t.x, t.y, st.range*TS); }
  else if(k === 'inferno'){ for(const o of near(front, 1.3)){ damage(o, st.dmg*1.8, t); burn(o, st.dmg*0.5, 3); } ring(front.x, front.y, 1.3*TS, '#ff7a2e'); fxBurst(front.x, front.y, '#ff7a2e', 16); }
  else if(k === 'frost'){ for(const e of inRange){ damage(e, st.dmg*1.2, t); slow(e, 0.5, 3); } ring(t.x, t.y, st.range*TS, '#8fe3ff'); }
  else if(k === 'chain'){ let cur = front; const hit = new Set();
    for(let i=0;i<5 && cur;i++){ hit.add(cur); damage(cur, st.dmg*2.2, t, {noProc:i > 0}); const nx = alive.filter(o => o.alive && !hit.has(o) && Math.hypot(o.x - cur.x, o.y - cur.y) <= 1.5*TS).sort((a, b) => Math.hypot(a.x-cur.x, a.y-cur.y) - Math.hypot(b.x-cur.x, b.y-cur.y))[0];
      R.fx.push({beam:true, x:i ? cur.x : t.x, y:i ? cur.y : t.y - 20, tx:(nx || cur).x, ty:(nx || cur).y, t:0.25, col:'#bfe8ff'}); cur = nx; } }
  else if(k === 'venom'){ for(const o of near(front, 1.3)){ damage(o, st.dmg, t); o.poison = 5; o.poisonPct = o.boss ? 0.004 : 0.012; o.poisonStacks = Math.min(3, (o.poisonStacks || 0) + 1); } ring(front.x, front.y, 1.3*TS, '#9be86b'); }
  else if(k === 'mend'){ R.base = Math.min(R.baseMax, R.base + 1); if(front) damage(front, st.dmg*1.5, t); ring(t.x, t.y, 0.8*TS, '#7be36b'); }
  else if(k === 'plunder'){ R.gold += 2 + (t.star - 1); damage(front, st.dmg*2.5, t); R.texts.push({x:t.x, y:t.y - 30, text:`+${2 + t.star - 1}g`, col:'#ffd76a', t:0.8, size:16}); }
  else if(k === 'gale'){ for(const e of inRange){ damage(e, st.dmg*1.3, t); push(e, 1.5); } ring(t.x, t.y, st.range*TS, '#cfe9ff'); }
  else if(k === 'web'){ for(const e of inRange){ damage(e, st.dmg*0.8, t); slow(e, 0.6, 4); } ring(t.x, t.y, st.range*TS, '#e0d6ff'); }
  else if(k === 'execute'){ const e = inRange.sort((a, b) => a.hp/a.maxHp - b.hp/b.maxHp)[0];
    if(!e.boss && e.hp < e.maxHp*0.25){ damage(e, e.hp + 1, t, {crit:true}); R.texts.push({x:e.x, y:e.y - 40, text:'FINISHED', col:'#ff4d6d', t:0.8, size:16}); } else damage(e, st.dmg*4, t, {crit:true}); fxSlash(e.x, e.y, col); }
  else if(k === 'barrage'){ for(let i=0;i<6;i++){ const e = inRange[Math.floor(Math.random()*inRange.length)]; R.projs.push({x:t.x, y:t.y - 16, tgt:e, dmg:st.dmg*1.2, crit:false, hits:1, splash:0, slow:0, col, t, sp:500 + i*60}); } }
  else if(k === 'mark'){ for(const e of inRange){ damage(e, st.dmg*1.2, t); mark(e, 0.3, 5); } ring(t.x, t.y, st.range*TS, '#ff6a8a'); }
  else if(k === 'grip'){ for(const o of near(front, 1.4)){ stun(o, 2 + st.skillStun); damage(o, st.dmg*1.2, t); } ring(front.x, front.y, 1.4*TS, '#c99bff'); }
  else if(k === 'lull'){ for(const e of near(t, st.range*1.4)){ stun(e, 2.5 + st.skillStun); damage(e, st.dmg*0.5, t, {noProc:true}); } ring(t.x, t.y, st.range*1.4*TS, '#ffb3e6'); }
}
function update(dt){
  R.time += dt; if(R.shake > 0) R.shake -= dt; if(R.flash > 0) R.flash -= dt;
  for(const f of R.fx){ f.t -= dt; if(f.vx != null){ f.x += f.vx*dt; f.y += f.vy*dt; f.vy += 300*dt; } } R.fx = R.fx.filter(f => f.t > 0);
  for(const t of R.texts){ t.t -= dt; if(!t.banner) t.y -= 36*dt; } R.texts = R.texts.filter(t => t.t > 0);
  if(R.choosing) return;
  if(!R.waveOn){ if(R.nextIn > 0 && R.wave > 0){ R.nextIn -= dt; if(R.nextIn <= 0 && R.towers.length) startWave(); } return; }
  treasureTick(dt);
  if(R.spawnQ.length){ R.spawnT -= dt; if(R.spawnT <= 0){ const it = R.spawnQ.shift(); spawn(it); R.spawnT = it.gap; } }
  // enemies
  for(const e of R.enemies){ if(!e.alive) continue;
    if(e.hit > 0) e.hit -= dt; if(e.markT > 0) e.markT -= dt;
    if(e.burn > 0){ e.burn -= dt; damage(e, e.burnDps*dt, null, {noProc:true}); }
    if(e.poison > 0){ e.poison -= dt; damage(e, e.maxHp*e.poisonPct*e.poisonStacks*dt, null, {noProc:true}); } else e.poisonStacks = 0;
    if(!e.alive) continue;
    if(e.stun > 0){ e.stun -= dt; continue; }
    let sp = e.spd; if(e.slowT > 0){ e.slowT -= dt; sp *= 1 - e.slowF; } else e.slowF = 0;
    for(const t of R.towers) if(t.st && t.st.slowAura && Math.hypot(e.x - t.x, e.y - t.y) <= t.st.range*TS){ sp *= 1 - t.st.slowAura; break; }
    e.dist += sp*TS*dt; const p = posAt(e.dist); e.x = p.x; e.y = p.y;
    if(e.dist >= R.path.len){ e.alive = false;
      if(gmod('dodge') && Math.random() < gmod('dodge')){ R.texts.push({x:R.path.end.x, y:R.path.end.y - 40, text:'DODGED', col:'#7fe7ff', t:0.8, size:18}); continue; }
      R.base -= e.leak; R.leaks++; R.shake = 0.3; R.texts.push({x:R.path.end.x, y:R.path.end.y - 40, text:`-${e.leak}`, col:'#ff4d6d', t:0.9, size:24});
      if(R.base <= 0 && gmod('revive') && !R.revived){ R.revived = true; R.base = R.baseMax; banner('AUTO REVIVE!', '#7be36b'); R.flash = 0.4; R.flashCol = '#7be36b'; }
      if(R.base <= 0){ R.base = 0; return endRun(false); } } }
  // towers
  for(const t of R.towers){
    if(t.swing > 0) t.swing -= dt*4; if(t.rallyT > 0) t.rallyT -= dt;
    const st = t.st = towerStats(t), H = HEROES[t.id];
    t.cd -= dt; if(t.cd > 0) continue;
    let tgt = null; for(const e of R.enemies){ if(!e.alive) continue; if(Math.hypot(e.x - t.x, e.y - t.y) > st.range*TS) continue; if(!tgt || e.dist > tgt.dist) tgt = e; }
    if(!tgt) continue;
    t.cd = 1/st.aspd; t.swing = 1; t.attacks++; t.face = tgt.x < t.x ? -1 : 1;
    let dmg = st.dmg; const crit = Math.random() < st.crit; if(crit) dmg *= st.critMul;
    if(H.passive.id === 'opener' && !t.opened){ dmg *= 3; t.opened = true; }
    const hits = 1;
    if(H.role === 'striker' || H.role === 'guardian'){ for(let i=0;i<hits;i++) damage(tgt, dmg, t, {crit}); if(st.slow){ tgt.slowT = 1; tgt.slowF = Math.max(tgt.slowF, st.slow); } fxSlash(tgt.x, tgt.y, CREW[H.crew].col); }
    else R.projs.push({x:t.x, y:t.y - 16, tgt, dmg, crit, hits, splash:st.splash*TS, slow:st.slow, col:CREW[H.crew].col, t, sp:H.role === 'sniper' ? 1000 : 560});
    t.energy += (H.captain ? 1.3 : 1)*(1 + st.charge)*(R.tr.eternal > 0 ? 3 : 1);
    if(t.energy >= 8){ t.energy = 0; castSkill(t, st); }
  }
  // projectiles
  for(const p of R.projs){
    const tx = p.tgt.x, ty = p.tgt.y - 6, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), step = p.sp*dt;
    if(!p.tgt.alive && d > 20){ p.done = true; continue; }
    if(d <= step + 6){ p.done = true;
      if(p.splash){ for(const e of R.enemies) if(e.alive && Math.hypot(e.x - tx, e.y - ty) <= p.splash) for(let i=0;i<p.hits;i++) damage(e, p.dmg, p.t, {crit:p.crit}); R.fx.push({ring:true, x:tx, y:ty, r:p.splash, t:0.25, col:p.col}); }
      else for(let i=0;i<p.hits;i++) damage(p.tgt, p.dmg, p.t, {crit:p.crit});
      if(p.slow && p.tgt.alive){ p.tgt.slowT = 1; p.tgt.slowF = Math.max(p.tgt.slowF, p.slow); }
    } else { p.x += dx/d*step; p.y += dy/d*step; } }
  R.projs = R.projs.filter(p => !p.done);
  R.enemies = R.enemies.filter(e => e.alive);
  if(R.over) return;
  if(!R.spawnQ.length && !R.enemies.length) waveCleared();
}
function fxBurst(x, y, col, n){ for(let i=0;i<n;i++){ const a = Math.random()*6.28, s = 60 + Math.random()*160; R.fx.push({x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 40, t:0.45 + Math.random()*0.35, col, r:2 + Math.random()*2.5}); } }
function fxSlash(x, y, col){ R.fx.push({slash:true, x, y, t:0.18, col, a:Math.random()*3}); }
function banner(text, col){ R.texts.push({x:CW/2, y:CH*0.45, text, col, t:1.6, size:text.length > 22 ? 34 : 50, banner:true}); }

/* ---------- drawing ---------- */
const rnd = i => { const x = Math.sin(i*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
function roadPath(g){ g.beginPath(); R.path.segs.forEach((s, i) => { if(!i) g.moveTo(s.a.x, s.a.y); g.lineTo(s.b.x, s.b.y); }); }
function drawPalm(g, x, y, s, lean){
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(8, 4, 26, 7, 0, 0, 7); g.fill();
  g.strokeStyle = '#7a5530'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean*10, -28, lean*18, -54); g.stroke();
  g.strokeStyle = '#5c3d1e'; g.lineWidth = 1.6; for(let k=0;k<6;k++){ const t = k/6; g.beginPath(); g.moveTo(lean*18*t*t - 4, -54*t); g.lineTo(lean*18*t*t + 4, -54*t - 2); g.stroke(); }
  const tx = lean*18, ty = -54;
  for(let k=0;k<7;k++){ const a = -Math.PI/2 + (k - 3)*0.52; g.fillStyle = k % 2 ? '#2f8a3a' : '#43a84c';
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a)*26, ty + Math.sin(a)*26 - 9, tx + Math.cos(a)*40, ty + Math.sin(a)*40 + 12);
    g.quadraticCurveTo(tx + Math.cos(a)*20, ty + Math.sin(a)*20 + 5, tx, ty); g.fill(); }
  g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(tx - 3, ty + 5, 4, 0, 7); g.arc(tx + 4, ty + 6, 4, 0, 7); g.fill();
  g.restore();
}
function drawRock(g, x, y, s, moss){
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(2, 8, 22, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#5f6872'; g.beginPath(); g.moveTo(-20, 8); g.lineTo(-15, -9); g.lineTo(-3, -17); g.lineTo(12, -12); g.lineTo(20, 6); g.closePath(); g.fill();
  g.fillStyle = '#87929d'; g.beginPath(); g.moveTo(-15, -9); g.lineTo(-3, -17); g.lineTo(3, -5); g.lineTo(-10, 0); g.closePath(); g.fill();
  if(moss){ g.fillStyle = '#4c9a3c'; g.beginPath(); g.ellipse(-4, -13, 9, 4, -0.3, 0, 7); g.fill(); }
  g.restore();
}
function drawLog(g, x, y, s, a){
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 7, 34, 6, 0, 0, 7); g.fill();
  const w = g.createLinearGradient(0, -8, 0, 8); w.addColorStop(0, '#8a6038'); w.addColorStop(1, '#4e3219'); g.fillStyle = w; g.beginPath(); g.roundRect(-32, -7, 64, 14, 7); g.fill();
  g.fillStyle = '#b48a58'; g.beginPath(); g.ellipse(32, 0, 4, 7, 0, 0, 7); g.fill(); g.strokeStyle = '#6b4a2a'; g.lineWidth = 1; g.beginPath(); g.ellipse(32, 0, 2, 4, 0, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(40,20,5,.5)'; for(let k=-24;k<26;k+=12){ g.beginPath(); g.moveTo(k, -6); g.lineTo(k + 6, 6); g.stroke(); }
  g.restore();
}
function drawFern(g, x, y, s){
  g.save(); g.translate(x, y); g.scale(s, s);
  for(let k=0;k<7;k++){ const a = -Math.PI/2 + (k - 3)*0.38; g.strokeStyle = k % 2 ? '#2e7d32' : '#46a548'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a)*10, Math.sin(a)*14, Math.cos(a)*20, Math.sin(a)*20 + 6); g.stroke(); }
  g.restore();
}
// ---------- realistic textures (value noise, cached) ----------
const TEX = {};
function vnoise(size, octaves, seed){
  const out = new Float32Array(size*size);
  let amp = 1, tot = 0;
  for(let o=0;o<octaves;o++){
    const cell = Math.max(2, size >> (o + 2)), n = Math.ceil(size/cell) + 1, grid = new Float32Array(n*n);
    for(let i=0;i<n*n;i++) grid[i] = rnd(seed + o*977 + i*1.37);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const gx = x/cell, gy = y/cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const sx = fx*fx*(3 - 2*fx), sy = fy*fy*(3 - 2*fy);
      const a = grid[y0*n + x0], b = grid[y0*n + x0 + 1], c = grid[(y0 + 1)*n + x0], d = grid[(y0 + 1)*n + x0 + 1];
      out[y*size + x] += amp*((a + (b - a)*sx) + ((c + (d - c)*sx) - (a + (b - a)*sx))*sy);
    }
    tot += amp; amp *= 0.55;
  }
  for(let i=0;i<out.length;i++) out[i] /= tot;
  return out;
}
// colour ramp texture: noise value → blend between dark and light colours, plus fine grain
function texture(key, size, octaves, seed, dark, light, grain){
  if(TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), im = g.createImageData(size, size), nz = vnoise(size, octaves, seed);
  for(let i=0;i<size*size;i++){
    const t = Math.min(1, Math.max(0, (nz[i] - 0.25)*2)), j = (rnd(seed*3 + i*0.73) - 0.5)*grain;
    im.data[i*4]     = dark[0] + (light[0] - dark[0])*t + j;
    im.data[i*4 + 1] = dark[1] + (light[1] - dark[1])*t + j;
    im.data[i*4 + 2] = dark[2] + (light[2] - dark[2])*t + j;
    im.data[i*4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return TEX[key] = c;
}
const TEX_STONE = () => texture('stone', 256, 6, 11, [104, 108, 110], [178, 180, 176], 26);
const TEX_DIRT  = () => texture('dirt', 256, 6, 23, [104, 78, 52], [168, 136, 98], 30);
const TEX_GRASS = () => texture('grass', 256, 6, 37, [38, 72, 30], [92, 132, 56], 34);

// one weathered stone block per build tile: textured top, bevelled edges, front face, soft shadow
function drawSlab(g, c, r){
  const x = OX + c*TS + 4, y = OY + r*TS + 2, w = TS - 8, top = TS - 19, side = 12, seed = c*31 + r*7 + 5;
  const tint = (rnd(seed) - 0.5)*0.16;
  // soft contact shadow
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10; g.shadowOffsetY = 6; g.fillStyle = 'rgba(0,0,0,.4)';
  g.beginPath(); g.roundRect(x, y + 4, w, top + side - 2, 5); g.fill(); g.restore();
  // front face (textured, darker)
  g.save(); g.beginPath(); g.roundRect(x, y + top - 6, w, side + 6, [0, 0, 5, 5]); g.clip();
  g.drawImage(TEX_STONE(), (seed*13) % 120, (seed*7) % 120, 120, 40, x, y + top - 6, w, side + 6);
  const fg = g.createLinearGradient(0, y + top - 6, 0, y + top + side); fg.addColorStop(0, 'rgba(20,22,24,.45)'); fg.addColorStop(1, 'rgba(10,12,14,.75)');
  g.fillStyle = fg; g.fillRect(x, y + top - 6, w, side + 6); g.restore();
  // top face (textured, lit from the upper left)
  g.save(); g.beginPath(); g.roundRect(x, y, w, top, 5); g.clip();
  g.drawImage(TEX_STONE(), (seed*29) % 160, (seed*17) % 160, 96, 96, x, y, w, top);
  g.fillStyle = tint > 0 ? `rgba(120,110,90,${tint})` : `rgba(70,90,110,${-tint})`; g.fillRect(x, y, w, top);
  const lg = g.createLinearGradient(x, y, x + w, y + top); lg.addColorStop(0, 'rgba(255,250,235,.22)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = lg; g.fillRect(x, y, w, top);
  // cracks: thin dark line with a light lip
  const s1 = rnd(seed + 1), s2 = rnd(seed + 2), s3 = rnd(seed + 3);
  if(s1 > 0.3){ const pts = [[x + w*s1, y], [x + w*(0.3 + s2*0.4), y + top*0.4], [x + w*(0.2 + s3*0.6), y + top*0.7], [x + w*s2, y + top]];
    for(const [col, off] of [['rgba(255,255,255,.18)', 1], ['rgba(25,25,25,.55)', 0]]){ g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off)); g.stroke(); } }
  // moss and lichen in the low corner
  if(s3 > 0.55){ for(let k=0;k<14;k++){ const mx = x + w*(s2*0.6 + rnd(seed + k)*0.35), my = y + top - 2 - rnd(seed + k*3)*10;
    g.fillStyle = `rgba(${70 + rnd(k + seed)*30},${110 + rnd(k*2 + seed)*40},50,.45)`; g.beginPath(); g.arc(mx, my, 1.5 + rnd(seed + k*5)*3, 0, 7); g.fill(); } }
  g.restore();
  // bevel: bright top-left rim, dark bottom-right rim
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,245,.28)'; g.beginPath(); g.moveTo(x + 4, y + top - 4); g.lineTo(x + 1.5, y + 5); g.quadraticCurveTo(x + 1.5, y + 1.5, x + 5, y + 1.5); g.lineTo(x + w - 5, y + 1.5); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(x + w - 1.5, y + 5); g.lineTo(x + w - 1.5, y + top - 1); g.stroke();
  // small chip on one corner
  if(s2 > 0.6){ g.fillStyle = 'rgba(40,42,44,.7)'; g.beginPath(); g.moveTo(x + w - 10, y); g.lineTo(x + w, y); g.lineTo(x + w, y + 8); g.closePath(); g.fill(); }
}
function renderBoard(){
  const c = document.createElement('canvas'); c.width = CW*DPR; c.height = CH*DPR; const g = c.getContext('2d'); g.scale(DPR, DPR);
  const rows = typeof NR !== 'undefined' ? NR : N;
  // grass ground (tiled noise texture + large-scale light variation)
  g.fillStyle = g.createPattern(TEX_GRASS(), 'repeat'); g.fillRect(0, 0, CW, CH);
  for(let i=0;i<40;i++){ const x = rnd(i)*CW, y = rnd(i + 5)*CH, rr = 40 + rnd(i*3)*90; const rg = g.createRadialGradient(x, y, 0, x, y, rr);
    rg.addColorStop(0, i % 2 ? 'rgba(130,150,60,.18)' : 'rgba(10,30,10,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr*2, rr*2); }
  for(let i=0;i<1400;i++){ const x = rnd(i + 50)*CW, y = rnd(i + 70)*CH, h = 3 + rnd(i*7)*5;
    g.strokeStyle = i % 3 ? 'rgba(20,45,15,.45)' : 'rgba(150,175,90,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd(i)*2 - 1)*2, y - h); g.stroke(); }
  // sea and wet sand along the top
  const sea = g.createLinearGradient(0, 0, 0, OY - 12); sea.addColorStop(0, '#3d7f97'); sea.addColorStop(1, '#2a6378'); g.fillStyle = sea; g.fillRect(0, 0, CW, OY - 12);
  for(let i=0;i<60;i++){ g.strokeStyle = 'rgba(220,240,245,.25)'; g.lineWidth = 1; const x = rnd(i)*CW, y = rnd(i + 3)*(OY - 16); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + rnd(i*2)*14, y); g.stroke(); }
  g.save(); g.beginPath(); g.moveTo(0, OY - 14); for(let x=0;x<=CW;x+=20) g.quadraticCurveTo(x + 10, OY - 19 + rnd(x)*6, x + 20, OY - 14); g.lineTo(CW, OY - 2); g.lineTo(0, OY - 2); g.clip();
  g.drawImage(TEX_DIRT(), 0, 0, 256, 40, 0, OY - 24, CW, 24); g.fillStyle = 'rgba(230,205,150,.55)'; g.fillRect(0, OY - 24, CW, 24); g.restore();
  // road: soft worn grass edge, then textured dirt clipped to the road shape
  g.lineCap = 'round'; g.lineJoin = 'round';
  roadPath(g); g.strokeStyle = 'rgba(25,35,15,.45)'; g.lineWidth = TS - 8; g.stroke();
  roadPath(g); g.strokeStyle = 'rgba(110,105,60,.55)'; g.lineWidth = TS - 16; g.stroke();
  const m = document.createElement('canvas'); m.width = CW; m.height = CH; const mg = m.getContext('2d');
  mg.lineCap = 'round'; mg.lineJoin = 'round'; roadPath(mg); mg.strokeStyle = '#000'; mg.lineWidth = TS - 24; mg.stroke();
  mg.globalCompositeOperation = 'source-in'; mg.fillStyle = mg.createPattern(TEX_DIRT(), 'repeat'); mg.fillRect(0, 0, CW, CH);
  mg.globalCompositeOperation = 'source-atop';
  for(let d = 4, i = 0; d < R.path.len; d += 5, i++){ const p = posAt(d), ox = (rnd(i)*2 - 1)*22, oy = (rnd(i + 3)*2 - 1)*22;   // pebbles
    mg.fillStyle = i % 4 ? 'rgba(60,42,25,.35)' : 'rgba(205,185,150,.5)'; mg.beginPath(); mg.ellipse(p.x + ox, p.y + oy, 1.2 + rnd(i*9)*2.2, 1 + rnd(i*4)*1.6, rnd(i)*3, 0, 7); mg.fill(); }
  mg.lineWidth = 2; mg.strokeStyle = 'rgba(60,40,22,.25)'; for(const off of [-10, 10]){ mg.setLineDash([18, 10]); mg.beginPath(); R.path.segs.forEach((s, i) => { const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, l = Math.hypot(dx, dy) || 1, nx = -dy/l*off, ny = dx/l*off; if(!i) mg.moveTo(s.a.x + nx, s.a.y + ny); mg.lineTo(s.b.x + nx, s.b.y + ny); }); mg.stroke(); } // cart ruts
  mg.setLineDash([]);
  g.drawImage(m, 0, 0, CW, CH);
  // grass tufts creeping onto the road edges
  for(let d = 3, i = 0; d < R.path.len; d += 4, i++){ const p = posAt(d), side = i % 2 ? 1 : -1, a = rnd(i)*6.28, rr = TS*0.33 + rnd(i*3)*6;
    const x = p.x + Math.cos(a)*rr, y = p.y + Math.sin(a)*rr; g.strokeStyle = 'rgba(70,105,40,.7)'; g.lineWidth = 1;
    for(let k=0;k<4;k++){ g.beginPath(); g.moveTo(x + k*1.5, y); g.lineTo(x + k*1.5 + side*(rnd(i + k)*3), y - 3 - rnd(i*2 + k)*4); g.stroke(); } }
  // faint marker dots for the enemy route
  for(let d = 10; d < R.path.len; d += 26){ const p = posAt(d); g.fillStyle = 'rgba(255,225,140,.35)'; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); }
  // stone blocks on every square a tower can stand on
  for(let r=0;r<rows;r++) for(let col=0;col<N;col++) if(!R.path.tiles.has(col+','+r)) drawSlab(g, col, r);
  // vignette for depth
  const vg = g.createRadialGradient(CW/2, CH/2, Math.min(CW, CH)*0.35, CW/2, CH/2, Math.max(CW, CH)*0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
  // jungle around the edges
  for(let i=0;i<22;i++){ const side = i % 4, t = rnd(i + 40); let x, y;
    if(side === 0){ x = 6 + rnd(i)*24; y = OY + t*rows*TS; } else if(side === 1){ x = CW - 6 - rnd(i)*24; y = OY + t*rows*TS; } else if(side === 2){ x = OX + t*N*TS; y = CH - 8 - rnd(i)*20; } else { x = OX + t*N*TS; y = OY - 4; }
    drawFern(g, x, y, 0.8 + rnd(i + 3)*0.5); }
  for(const [x, y, s, a] of [[OX + 140, CH - 10, 0.9, 0.2], [OX + N*TS - 120, CH - 14, 0.8, -0.3]]) drawLog(g, x, y, s, a);
  for(const [x, y, s, m2] of [[OX + 330, OY - 8, 0.9, 1], [CW - 12, OY + rows*TS*0.45, 1, 0], [OX + 470, CH - 8, 0.9, 1]]) drawRock(g, x, y, s, m2);
  for(const [x, y, s, l] of [[14, OY + rows*TS*0.2, 1.05, 1], [CW - 14, OY + rows*TS*0.25, 1, -1], [OX + 230, CH + 4, 0.9, 1], [16, CH - 40, 1, 1], [OX + 560, OY - 2, 0.85, -1]]) drawPalm(g, x, y, s, l);
  return c;
}
// wrecked pirate ship at the enemy spawn
function drawShipAt(g, x, y, t){
  g.save(); g.translate(x, y + Math.sin(t*1.5)*1.5);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 26, 52, 10, 0, 0, 7); g.fill();
  const hull = g.createLinearGradient(0, -6, 0, 26); hull.addColorStop(0, '#7a5534'); hull.addColorStop(1, '#3e2814');
  g.fillStyle = hull; g.beginPath(); g.moveTo(-50, -4); g.lineTo(46, -4); g.lineTo(34, 24); g.lineTo(-40, 24); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(25,14,5,.6)'; g.lineWidth = 1.2; for(let k=0;k<4;k++){ g.beginPath(); g.moveTo(-48 + k*2, 2 + k*6); g.lineTo(44 - k*3, 2 + k*6); g.stroke(); }
  g.fillStyle = '#2a1a0c'; g.beginPath(); g.moveTo(10, 8); g.lineTo(22, 6); g.lineTo(18, 18); g.lineTo(8, 16); g.fill();            // hole in the hull
  g.fillStyle = '#a07040'; g.fillRect(-50, -8, 96, 5);
  g.strokeStyle = '#4a3018'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, -6); g.lineTo(-18, -78); g.stroke();                                                                  // main mast
  g.beginPath(); g.moveTo(24, -6); g.lineTo(30, -46); g.stroke();                                                                    // broken mast
  g.fillStyle = '#c9b48a'; g.beginPath(); g.moveTo(-17, -72); g.lineTo(18, -66); g.lineTo(12, -40); g.lineTo(20, -30); g.lineTo(-16, -26); g.closePath(); g.fill();   // tattered sail
  g.fillStyle = 'rgba(80,60,30,.35)'; g.beginPath(); g.moveTo(2, -60); g.lineTo(10, -52); g.lineTo(4, -48); g.fill();
  g.fillStyle = '#c9b48a'; g.beginPath(); g.moveTo(28, -42); g.lineTo(44, -36); g.lineTo(38, -22); g.lineTo(27, -20); g.closePath(); g.fill();
  g.fillStyle = '#141414'; g.beginPath(); g.moveTo(-18, -78); g.lineTo(-38 + Math.sin(t*4)*2, -74); g.lineTo(-18, -66); g.fill();   // flag
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-26, -72, 2.2, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-30, -69); g.lineTo(-22, -75); g.moveTo(-30, -75); g.lineTo(-22, -69); g.stroke();
  g.restore();
}
// gold sandcastle with treasure chests and coins = your base
function drawCastle(g, x, y, hit){
  g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 4, x, y, 80); gl.addColorStop(0, hit ? 'rgba(255,60,80,.55)' : 'rgba(255,215,0,.4)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(x - 80, y - 80, 160, 160); g.restore();
  g.save(); g.translate(x, y + 10);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 18, 46, 10, 0, 0, 7); g.fill();
  const gold = g.createLinearGradient(-30, -60, 30, 18); gold.addColorStop(0, '#fff2a0'); gold.addColorStop(.5, '#e9b830'); gold.addColorStop(1, '#a8740b');
  const tower = (tx, w, h) => { g.fillStyle = gold; g.beginPath(); g.rect(tx - w/2, 14 - h, w, h); g.fill();
    for(let k=0;k<3;k++){ g.beginPath(); g.rect(tx - w/2 + k*(w/3), 14 - h - 7, w/3 - 2, 7); g.fill(); }
    g.strokeStyle = 'rgba(90,60,0,.5)'; g.lineWidth = 1; for(let yy = 14 - h + 8; yy < 14; yy += 8){ g.beginPath(); g.moveTo(tx - w/2, yy); g.lineTo(tx + w/2, yy); g.stroke(); } };
  tower(-26, 18, 38); tower(26, 18, 38); tower(0, 28, 56);
  g.fillStyle = '#5a3d00'; g.beginPath(); g.roundRect(-6, -4, 12, 18, [6, 6, 0, 0]); g.fill();
  g.fillStyle = '#e8304a'; g.beginPath(); g.moveTo(0, -48); g.lineTo(0, -66); g.lineTo(14, -61); g.lineTo(0, -56); g.fill(); g.strokeStyle = '#5a3d00'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -42); g.lineTo(0, -66); g.stroke();
  const chest = (cx, cy, s) => { g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = '#7a4a1e'; g.beginPath(); g.roundRect(-9, -6, 18, 11, 2); g.fill(); g.fillStyle = '#9a6228'; g.beginPath(); g.roundRect(-9, -11, 18, 6, [4, 4, 0, 0]); g.fill();
    g.fillStyle = '#ffd34d'; g.fillRect(-9, -6, 18, 1.5); g.fillRect(-1.5, -9, 3, 8); g.fillStyle = '#ffe98a'; g.beginPath(); g.arc(-4, -12, 2, 0, 7); g.arc(1, -13, 2, 0, 7); g.arc(5, -12, 2, 0, 7); g.fill(); g.restore(); };
  chest(-38, 18, 1.1); chest(36, 20, 1); chest(-20, 24, 0.9);
  g.fillStyle = '#ffd34d'; for(let k=0;k<9;k++){ g.beginPath(); g.ellipse(-8 + k*3, 24 + (k%3), 3, 1.6, 0, 0, 7); g.fill(); }
  g.restore();
}
function drawBase(g){
  const s = R.path.start, sx = Math.max(48, Math.min(CW - 48, s.x)), sy = Math.max(70, Math.min(CH - 30, s.y));
  drawShipAt(g, sx, sy, R.time);
  drawCastle(g, Math.max(52, Math.min(CW - 52, R.path.end.x)), Math.max(70, Math.min(CH - 30, R.path.end.y)), R.shake > 0);
}
let drag = {active:false};
function draw(){
  const g = bctx; g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.save(); if(R.shake > 0) g.translate((Math.random()-0.5)*12*R.shake, (Math.random()-0.5)*12*R.shake);
  g.drawImage(boardBg, 0, 0, CW, CH);
  drawBase(g);
  // placement hints
  const placing = drag.active || R.benchSel != null;
  if(placing){ const id = drag.active ? drag.id : R.bench[R.benchSel] && R.bench[R.benchSel].id, ok = id != null;
    for(let r=0;r<NR;r++) for(let c=0;c<N;c++) if(canPlaceTile(c, r) && !towerAt(c, r)){ g.strokeStyle = 'rgba(255,215,0,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(tileX(c), tileY(r), 26, 0, 7); g.stroke(); }
    if(drag.hover && ok){ const {c, r} = drag.hover; if(canPlaceTile(c, r)){ g.fillStyle = 'rgba(123,227,107,.35)'; g.beginPath(); g.arc(tileX(c), tileY(r), 32, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([8,6]); g.lineWidth = 2; g.beginPath(); g.arc(tileX(c), tileY(r), HEROES[id].range*TS, 0, 7); g.stroke(); g.setLineDash([]); } } }
  if(R.sel){ const st = towerStats(R.sel); g.strokeStyle = 'rgba(255,228,138,.9)'; g.lineWidth = 2.5; g.setLineDash([8,6]); g.beginPath(); g.arc(R.sel.x, R.sel.y, st.range*TS, 0, 7); g.stroke(); g.setLineDash([]); }
  // captain aura
  drawCannon(g);
  // towers
  for(const t of R.towers){ if(drag.active && drag.ref === t) continue;
    const H = HEROES[t.id], k = 1 + (t.swing > 0 ? t.swing*0.06 : 0), sz = 66*k*(1 + 0.06*(t.star - 1));
    { const gl = g.createRadialGradient(t.x, t.y + 8, 4, t.x, t.y + 8, 44); gl.addColorStop(0, hexA(slotCol(H.crew), 0.55)); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.beginPath(); g.ellipse(t.x, t.y + 10, 44, 26, 0, 0, 7); g.fill(); }
    if(t.rallyT > 0){ g.fillStyle = 'rgba(123,227,107,.25)'; g.beginPath(); g.arc(t.x, t.y, 38, 0, 7); g.fill(); }
    g.drawImage(token(t.id, slotCol(HEROES[t.id].crew)), t.x - sz/2, t.y - sz/2, sz, sz);
    { const sw = 13*t.star + 8; g.fillStyle = 'rgba(5,10,28,.85)'; g.beginPath(); g.roundRect(t.x - sw/2, t.y + 27, sw, 15, 7); g.fill();
      g.font = '900 13px Nunito'; g.textAlign = 'center'; g.fillStyle = '#FFD700'; g.fillText('★'.repeat(t.star), t.x, t.y + 39); }
    if(t.lvl > 1){ g.fillStyle = '#0a1226'; g.beginPath(); g.arc(t.x + 26, t.y + 24, 9, 0, 7); g.fill(); g.fillStyle = '#7fe7ff'; g.font = '900 11px Nunito'; g.textAlign = 'center'; g.fillText('+' + (t.lvl - 1), t.x + 26, t.y + 28); }
    const f = Math.min(1, t.energy/8); g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(t.x, t.y, 36, 0, 7); g.stroke();
    g.strokeStyle = f > 0.85 ? '#ffe48a' : '#4ad8ff'; g.beginPath(); g.arc(t.x, t.y, 36, -Math.PI/2, -Math.PI/2 + f*Math.PI*2); g.stroke(); }
  for(const e of R.enemies) drawEnemy(g, e, R.time);
  g.save(); g.globalCompositeOperation = 'lighter';
  for(const p of R.projs){ const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14); gl.addColorStop(0, hexA(p.col, 0.9)); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(p.x - 14, p.y - 14, 28, 28); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 3.5, 0, 7); g.fill(); }
  g.restore();
  for(const f of R.fx){
    if(f.ring){ g.strokeStyle = hexA(f.col, Math.min(1, f.t*3)); g.lineWidth = 4; g.beginPath(); g.arc(f.x, f.y, f.r*(1.2 - f.t), 0, 7); g.stroke(); }
    else if(f.slash){ g.save(); g.translate(f.x, f.y); g.rotate(f.a); g.strokeStyle = hexA(f.col, Math.min(1, f.t*5)); g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 22, -1.2, 0.6); g.stroke(); g.restore(); }
    else if(f.beam){ g.strokeStyle = hexA(f.col, f.t*4); g.lineWidth = 4; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.tx, f.ty); g.stroke(); }
    else { g.globalAlpha = Math.min(1, f.t*2); g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill(); g.globalAlpha = 1; } }
  if(R.flash > 0){ g.fillStyle = hexA(R.flashCol || '#ffffff', Math.min(0.5, R.flash)); g.fillRect(0, 0, CW, CH); }
  g.restore();
  for(const t of R.texts){ g.globalAlpha = Math.min(1, t.t*2.5); g.font = `${t.size}px Bangers, Impact, sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = Math.max(4, t.size/5); g.strokeStyle = '#000'; g.strokeText(t.text, t.x, t.y); g.fillStyle = t.col; g.fillText(t.text, t.x, t.y); g.globalAlpha = 1; }
  if(!R.towers.length && !R.over){ g.font = '28px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#000'; const msg = 'Buy a tower, then tap or drag it onto the island'; g.strokeText(msg, CW/2, CH - 12); g.fillStyle = '#fff'; g.fillText(msg, CW/2, CH - 12); }
}
