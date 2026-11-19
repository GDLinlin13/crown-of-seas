"use strict";
/* =====================================================================
   CHESS TD — BATTLE
   8x8 chess board, enemies walk a fixed path to your base.
   Shop deals random towers from your 35-tower deck. The FIRST tower you
   place locks that crew for the run; after that only that crew can be
   placed and the shop deals only that crew.
   ===================================================================== */
const N = 8, TS = 80, OX = 40, OY = 40, CW = N*TS + OX*2, CH = N*TS + OY*2;
const PATHS = [
  [[-1,1],[5,1],[5,4],[2,4],[2,6],[7,6]],
  [[-1,6],[2,6],[2,1],[5,1],[5,5],[7,5]],
  [[3,-1],[3,2],[1,2],[1,5],[6,5],[6,2],[7,2]],
  [[-1,0],[6,0],[6,3],[1,3],[1,6],[7,6]],
  [[-1,4],[1,4],[1,1],[4,1],[4,6],[7,6]],
  [[-1,2],[2,2],[2,6],[5,6],[5,1],[7,1]],
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
    while(true){ if(c0>=0 && c0<N && r0>=0 && r0<N) tiles.add(c0+','+r0); if(c0 === c1 && r0 === r1) break; c0 += dc; r0 += dr; } }
  return {segs, len, tiles, start:raw[0], end:raw[raw.length-1]};
}
function posAt(d){ for(const s of R.path.segs) if(d <= s.s + s.l){ const k = (d - s.s)/s.l; return {x:s.a.x + (s.b.x-s.a.x)*k, y:s.a.y + (s.b.y-s.a.y)*k}; } return {x:R.path.end.x, y:R.path.end.y}; }

/* ---------- run setup ---------- */
function newRun(deck){
  const path = buildPath(PATHS[Math.floor(Math.random()*PATHS.length)]);
  R = {deck:deck.slice(), crews:[...new Set(deck.map(id => HEROES[id].crew))], lock:null, path, gold:START_GOLD, base:BASE_HP, baseMax:BASE_HP,
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
function canPlaceTile(c, r){ return c >= 0 && c < N && r >= 0 && r < N && !R.path.tiles.has(c+','+r); }
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
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){ if(!canPlaceTile(c, r) || towerAt(c, r)) continue;
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
  if(R.waveOn || R.over || R.wave >= WAVES) return;
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
  const hp = waveHp(w)*(boss ? 22 + w*0.6 : E.hp);
  R.enemies.push({type:it.type, boss, hp, maxHp:hp, spd:(boss ? 0.5 : E.spd)*(1 + 0.012*w), leak: boss ? 6 : E.leak, armor:E.armor || 0,
    dist:0, x:R.path.start.x, y:R.path.start.y, slowT:0, slowF:0, stun:0, burn:0, burnDps:0, poison:0, poisonStacks:0, hit:0, seed:Math.random()*9, alive:true});
}
function waveCleared(){
  R.waveOn = false; computeMods();
  const interest = Math.min(5, Math.floor(R.gold/10));
  const bonus = Math.round((3 + interest + gmod('income') + R.tr.income)*(1 + gmod('goldPct'))*R.tr.goldMul); R.gold += bonus;
  if(gmod('healWave')) R.base = Math.min(R.baseMax, R.base + gmod('healWave'));
  treasureWaveEnd();
  banner(`WAVE ${R.wave} CLEAR  +${bonus} GOLD${interest ? ` (${interest} interest)` : ''}`, '#7be36b');
  if(R.wave >= WAVES) return endRun(true);
  rollShop(true); R.nextIn = 6;
  if(R.wave % 5 === 0 && R.wave < WAVES) offerTreasure();   // every 5 waves: pause and choose 1 of 3
  uiDirty();
}

/* ---------- combat ---------- */
function damage(e, amt, t, opts = {}){
  if(!e.alive) return;
  const H = t ? HEROES[t.id] : null;
  if(H && H.passive.id === 'giant' && e.boss) amt *= 1.3;
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
  const H = HEROES[t.id], inRange = R.enemies.filter(e => e.alive && Math.hypot(e.x - t.x, e.y - t.y) <= st.range*TS);
  R.texts.push({x:t.x, y:t.y - 50, text:H.skill.toUpperCase() + '!', col:CREW[H.crew].col, t:1.1, size:H.captain ? 24 : 18});
  if(H.captain){ for(const e of R.enemies.filter(e => e.alive)) damage(e, st.dmg*3, t); R.flash = 0.35; R.flashCol = CREW[H.crew].col; R.shake = 0.3; return; }
  if(!inRange.length && H.role !== 'support') { t.energy = 7; return; }
  if(H.role === 'striker'){ const e = inRange.sort((a, b) => Math.hypot(a.x-t.x, a.y-t.y) - Math.hypot(b.x-t.x, b.y-t.y))[0]; for(let i=0;i<5;i++) damage(e, st.dmg*1.2, t, {noProc:i > 0}); fxSlash(e.x, e.y, CREW[H.crew].col); }
  else if(H.role === 'sniper'){ const e = inRange.sort((a, b) => b.hp - a.hp)[0]; damage(e, st.dmg*4.5, t, {crit:true}); R.fx.push({beam:true, x:t.x, y:t.y-20, tx:e.x, ty:e.y, t:0.25, col:CREW[H.crew].col}); }
  else if(H.role === 'mage'){ const e = inRange.sort((a, b) => b.dist - a.dist)[0]; for(const o of R.enemies) if(o.alive && Math.hypot(o.x - e.x, o.y - e.y) <= 1.5*TS) damage(o, st.dmg*2.5, t); R.fx.push({ring:true, x:e.x, y:e.y, r:1.5*TS, t:0.4, col:CREW[H.crew].col}); }
  else if(H.role === 'guardian'){ for(const e of inRange){ e.stun = Math.max(e.stun, 1.5 + st.skillStun); damage(e, st.dmg*1.5, t); } R.fx.push({ring:true, x:t.x, y:t.y, r:st.range*TS, t:0.4, col:'#ffe48a'}); }
  else { for(const o of R.towers) if(Math.hypot(o.x - t.x, o.y - t.y) <= 1.6*TS) o.rallyT = 5; R.fx.push({ring:true, x:t.x, y:t.y, r:1.6*TS, t:0.4, col:'#7be36b'}); }
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
    if(e.hit > 0) e.hit -= dt;
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
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(6, 4, 22, 6, 0, 0, 7); g.fill();
  g.strokeStyle = '#7a5530'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean*10, -24, lean*16, -46); g.stroke();
  g.strokeStyle = '#5c3d1e'; g.lineWidth = 1.5; for(let k=0;k<5;k++){ const t = k/5; g.beginPath(); g.moveTo(lean*16*t*t - 3, -46*t); g.lineTo(lean*16*t*t + 3, -46*t - 2); g.stroke(); }
  const tx = lean*16, ty = -46;
  for(let k=0;k<6;k++){ const a = -Math.PI/2 + (k - 2.5)*0.55; g.fillStyle = k % 2 ? '#2f8a3a' : '#3fa548';
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a)*22, ty + Math.sin(a)*22 - 8, tx + Math.cos(a)*34, ty + Math.sin(a)*34 + 10);
    g.quadraticCurveTo(tx + Math.cos(a)*18, ty + Math.sin(a)*18 + 4, tx, ty); g.fill(); }
  g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(tx - 3, ty + 4, 3.5, 0, 7); g.arc(tx + 4, ty + 5, 3.5, 0, 7); g.fill();
  g.restore();
}
function drawRock(g, x, y, s){
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 6, 18, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#6f7a86'; g.beginPath(); g.moveTo(-16, 6); g.lineTo(-12, -8); g.lineTo(-2, -14); g.lineTo(10, -10); g.lineTo(16, 4); g.closePath(); g.fill();
  g.fillStyle = '#8d98a4'; g.beginPath(); g.moveTo(-12, -8); g.lineTo(-2, -14); g.lineTo(2, -4); g.lineTo(-8, 0); g.closePath(); g.fill();
  g.restore();
}
function renderBoard(){
  const c = document.createElement('canvas'); c.width = CW*DPR; c.height = CH*DPR; const g = c.getContext('2d'); g.scale(DPR, DPR);
  // deep ocean
  const sea = g.createRadialGradient(CW/2, CH/2, CW*0.2, CW/2, CH/2, CW*0.75); sea.addColorStop(0, '#12385e'); sea.addColorStop(1, '#0A1A2F');
  g.fillStyle = sea; g.fillRect(0, 0, CW, CH);
  // island: beach ring then grass, with a soft wobbly shoreline
  const isl = (pad) => { g.beginPath(); const x0 = OX - pad, y0 = OY - pad, w = N*TS + pad*2, h = N*TS + pad*2, r = 46 + pad*0.4; g.roundRect(x0, y0, w, h, r); };
  g.save(); g.shadowColor = 'rgba(120,220,255,.35)'; g.shadowBlur = 24; isl(26); g.fillStyle = 'rgba(160,230,240,.25)'; g.fill(); g.restore();
  isl(18); g.fillStyle = '#e8d29a'; g.fill();
  isl(8); const grass = g.createLinearGradient(0, OY, 0, OY + N*TS); grass.addColorStop(0, '#4fae54'); grass.addColorStop(1, '#3a8f45'); g.fillStyle = grass; g.fill();
  g.save(); isl(8); g.clip();
  for(let i=0;i<180;i++){ const x = OX - 8 + rnd(i)*(N*TS + 16), y = OY - 8 + rnd(i + 999)*(N*TS + 16); g.fillStyle = i % 3 ? 'rgba(20,70,25,.18)' : 'rgba(170,230,120,.16)'; g.beginPath(); g.ellipse(x, y, 10 + rnd(i*3)*22, 6 + rnd(i*5)*12, rnd(i*7)*3, 0, 7); g.fill(); }
  for(let i=0;i<260;i++){ const x = OX + rnd(i + 50)*N*TS, y = OY + rnd(i + 70)*N*TS; g.strokeStyle = 'rgba(30,90,30,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y - 5); g.stroke(); }
  g.restore();
  // curved sand-and-stone road
  g.lineCap = 'round'; g.lineJoin = 'round';
  roadPath(g); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 66; g.stroke();
  roadPath(g); g.strokeStyle = '#b89463'; g.lineWidth = 60; g.stroke();
  roadPath(g); g.strokeStyle = '#d9bd86'; g.lineWidth = 50; g.stroke();
  g.save(); roadPath(g); g.lineWidth = 50; g.strokeStyle = '#000'; g.globalCompositeOperation = 'source-over';
  for(let d = 6, i = 0; d < R.path.len; d += 13, i++){ const p = posAt(d), ox = (rnd(i)*2 - 1)*17, oy = (rnd(i + 3)*2 - 1)*17;
    g.fillStyle = i % 2 ? 'rgba(140,110,70,.45)' : 'rgba(255,240,200,.35)'; g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 5 + rnd(i*9)*4, 3.5 + rnd(i*4)*3, rnd(i)*3, 0, 7); g.fill(); }
  g.restore();
  // gold dotted enemy path
  for(let d = 10; d < R.path.len; d += 20){ const p = posAt(d); g.fillStyle = 'rgba(255,215,0,.35)'; g.beginPath(); g.arc(p.x, p.y, 6, 0, 7); g.fill(); g.fillStyle = '#FFD700'; g.beginPath(); g.arc(p.x, p.y, 3.2, 0, 7); g.fill(); }
  // palms and rocks around the shore (not on buildable squares)
  const shore = [[OX - 4, OY + 40, 1, 1], [OX + N*TS + 4, OY + 120, 0.9, -1], [OX + 160, OY + N*TS + 6, 0.85, 1], [OX + N*TS - 60, OY - 2, 0.8, -1], [OX + 10, OY + N*TS - 30, 0.9, 1], [OX + N*TS + 2, OY + N*TS - 140, 0.8, -1]];
  for(const [x, y, s, l] of shore) drawPalm(g, x, y, s, l);
  for(const [x, y, s] of [[OX + 330, OY - 10, 0.9], [OX - 12, OY + 300, 0.8], [OX + N*TS + 12, OY + 380, 0.9], [OX + 470, OY + N*TS + 10, 0.8]]) drawRock(g, x, y, s);
  return c;
}
function drawWaves(g){
  g.save(); g.strokeStyle = 'rgba(180,230,255,.22)'; g.lineWidth = 2;
  for(let i=0;i<22;i++){ const x = rnd(i + 400)*CW, y = rnd(i + 500)*CH, ph = R.time*1.6 + i;
    const inside = x > OX - 30 && x < OX + N*TS + 30 && y > OY - 30 && y < OY + N*TS + 30; if(inside) continue;
    g.globalAlpha = 0.4 + 0.4*Math.sin(ph); g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x, y - 5 - 2*Math.sin(ph), x + 12, y); g.stroke(); }
  g.restore();
}
function drawShipAt(g, x, y, t){
  g.save(); g.translate(x, y + Math.sin(t*2)*2.5);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 18, 34, 7, 0, 0, 7); g.fill();
  g.fillStyle = '#4a1d18'; g.beginPath(); g.moveTo(-34, 2); g.lineTo(34, 2); g.lineTo(24, 18); g.lineTo(-26, 18); g.closePath(); g.fill();
  g.fillStyle = '#8b2a22'; g.fillRect(-32, -2, 64, 6);
  g.fillStyle = '#3a2414'; g.fillRect(-2, -46, 4, 48);
  g.fillStyle = '#c0302a'; g.beginPath(); g.moveTo(2, -44); g.quadraticCurveTo(26, -28, 2, -8); g.closePath(); g.fill();
  g.fillStyle = '#e04a3a'; g.beginPath(); g.moveTo(-2, -40); g.quadraticCurveTo(-20, -26, -2, -12); g.closePath(); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.moveTo(2, -46); g.lineTo(16, -42); g.lineTo(2, -38); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(8, -42, 1.6, 0, 7); g.fill();
  g.restore();
}
function drawCastle(g, x, y, hit){
  g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 4, x, y, 70); gl.addColorStop(0, hit ? 'rgba(255,60,80,.55)' : 'rgba(255,215,0,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(x - 70, y - 70, 140, 140); g.restore();
  g.save(); g.translate(x, y + 6);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 14, 34, 8, 0, 0, 7); g.fill();
  const gold = g.createLinearGradient(-30, -40, 30, 14); gold.addColorStop(0, '#fff3a8'); gold.addColorStop(0.5, '#FFD700'); gold.addColorStop(1, '#b8860b');
  g.fillStyle = gold; g.strokeStyle = '#5a3d00'; g.lineWidth = 2;
  const tower = (tx, w, h) => { g.beginPath(); g.rect(tx - w/2, 12 - h, w, h); for(let k=0;k<3;k++) g.rect(tx - w/2 + k*(w/3), 12 - h - 6, w/3 - 2, 6); g.fill(); g.stroke(); };
  tower(-20, 16, 36); tower(20, 16, 36); tower(0, 24, 48);
  g.fillStyle = '#5a3d00'; g.beginPath(); g.roundRect(-5, -4, 10, 16, [5, 5, 0, 0]); g.fill();
  g.fillStyle = '#e8304a'; g.beginPath(); g.moveTo(0, -42); g.lineTo(0, -58); g.lineTo(13, -53); g.lineTo(0, -48); g.fill();
  g.restore();
}
function drawBase(g){
  drawWaves(g);
  const s = R.path.start, sx = Math.max(30, Math.min(CW - 30, s.x)), sy = Math.max(30, Math.min(CH - 20, s.y));
  drawShipAt(g, sx, sy, R.time);
  drawCastle(g, R.path.end.x, R.path.end.y, R.shake > 0);
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
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(canPlaceTile(c, r) && !towerAt(c, r)){ g.strokeStyle = 'rgba(255,215,0,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(tileX(c), tileY(r), 26, 0, 7); g.stroke(); }
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
