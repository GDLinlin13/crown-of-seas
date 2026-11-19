"use strict";
/* =====================================================================
   TREASURES: every 5 waves the run pauses and you choose 1 of 3.
   Tiers unlock by wave; treasures stack and last the whole run.
   ===================================================================== */
const TR_TIERS = {
  C:{name:'Common',        col:'#cfd8e6', wave:5},
  U:{name:'Uncommon',      col:'#3ddc84', wave:10},
  R:{name:'Rare',          col:'#4aa3ff', wave:15},
  E:{name:'Epic',          col:'#b65cff', wave:20},
  L:{name:'Ancient Relic', col:'#ffcf3d', wave:25},
};
// chance of each tier per card, by the wave the choice happens on
const TR_WEIGHTS = {5:{C:1}, 10:{C:.7, U:.3}, 15:{C:.5, U:.3, R:.2}, 20:{C:.4, U:.25, R:.2, E:.15}, 25:{C:.3, U:.25, R:.2, E:.15, L:.1}};
function newTreasureState(){
  return {dmg:0, aspd:0, income:0, slots:0, life:0, charge:0, skillStun:0, crystal:{}, crewAll:0, goldMul:1,
    burn:false, frost:false, gale:false, stunHit:0, cannon:false, champion:false, eternal:0};
}
const SEA_RELICS = [['burn','Ember','enemies you hit burn for 25% extra over 2s'], ['frost','Frost','hits slow enemies 25%'], ['gale','Gale','hits have a 20% chance to knock enemies back']];
const TREASURES = [
  // COMMON (wave 5+)
  {id:'gold100', tier:'C', icon:'💰', name:'Treasure Chest',     desc:'+100 Gold now',                         apply:() => { R.gold += 100; }},
  {id:'life',    tier:'C', icon:'♥',  name:'Lifeline',           desc:'+1 base HP (max and current)',           apply:() => { R.tr.life++; }},
  {id:'dmg10',   tier:'C', icon:'⚔',  name:'Whetstone',          desc:'All towers +10% Damage this run',        apply:() => { R.tr.dmg += 0.10; }},
  {id:'inc5',    tier:'C', icon:'🪙', name:'Trade Route',        desc:'+5 Gold income per wave',                apply:() => { R.tr.income += 5; }},
  // UNCOMMON (wave 10+)
  {id:'slot',    tier:'U', icon:'▦',  name:'Extra Deck Space',   desc:'+1 max tower slot',                      apply:() => { R.tr.slots++; }},
  {id:'swift',   tier:'U', icon:'⚡', name:'Swift Hands',        desc:'All towers +10% Attack Speed',           apply:() => { R.tr.aspd += 0.10; }},
  {id:'focus',   tier:'U', icon:'✪',  name:'Battle Focus',       desc:'Skills charge 25% faster',               apply:() => { R.tr.charge += 0.25; }},
  {id:'crystal', tier:'U', icon:'◆',  name:'Synergy Crystal',    desc:'+1 to your biggest crew\'s synergy count', apply:() => {
      const top = allSynergy()[0]; const cid = top ? top.crew : R.crews[0]; R.tr.crystal[cid] = (R.tr.crystal[cid] || 0) + 1; return `for ${CREW[cid].name}`; }},
  // RARE (wave 15+)
  {id:'relic',   tier:'R', icon:'❂',  name:'Sea Relic',          desc:'Random: Ember (burn), Frost (slow) or Gale (knockback)', apply:() => {
      const left = SEA_RELICS.filter(([k]) => !R.tr[k]), pick = (left.length ? left : SEA_RELICS)[Math.floor(Math.random()*(left.length || 3))]; R.tr[pick[0]] = true; return `${pick[1]}: ${pick[2]}`; }},
  {id:'drum',    tier:'R', icon:'🥁', name:'Thunder Drum',       desc:'Skill stuns last 2s longer',             apply:() => { R.tr.skillStun += 2; }},
  {id:'inc10',   tier:'R', icon:'🪙', name:'Merchant Fleet',     desc:'+10 Gold income per wave',               apply:() => { R.tr.income += 10; }},
  {id:'dmg25',   tier:'R', icon:'⚔',  name:'Master Forge',       desc:'All towers +25% Damage this run',        apply:() => { R.tr.dmg += 0.25; }},
  // EPIC (wave 20+)
  {id:'champ',   tier:'E', icon:'♚',  name:'Champion\'s Call',   desc:'A 3★ copy of your strongest crew\'s captain fights with you next wave', apply:() => { R.tr.champion = true; }},
  {id:'fortify', tier:'E', icon:'⛨',  name:'Fortify',            desc:'Restore your base to full HP',           apply:() => { computeMods(); R.base = R.baseMax; }},
  {id:'cannon',  tier:'E', icon:'💣', name:'Cannon Barrage',     desc:'A cannon strike hits 3 enemies every 10s', apply:() => { R.tr.cannon = true; }},
  {id:'roar',    tier:'E', icon:'♛',  name:'Sovereign\'s Roar',  desc:'10% chance to stun on hit',              apply:() => { R.tr.stunHit += 0.10; }},
  // ANCIENT RELIC / LEGENDARY (wave 25+)
  {id:'power',   tier:'L', icon:'☀',  name:'Relic of Power',     desc:'All towers +50% Damage this run',        apply:() => { R.tr.dmg += 0.50; }},
  {id:'crewall', tier:'L', icon:'✦',  name:'Relic of the Crew',  desc:'+1 to ALL active synergies (4 counts as 5)', apply:() => { R.tr.crewAll++; }},
  {id:'wealth',  tier:'L', icon:'👑', name:'Relic of Wealth',    desc:'Double gold income for the rest of the run', apply:() => { R.tr.goldMul *= 2; }},
  {id:'eternal', tier:'L', icon:'∞',  name:'Relic of Eternity',  desc:'Skills charge 3x faster next wave',      apply:() => { R.tr.eternal = 1; }},
];
const TR = Object.fromEntries(TREASURES.map(t => [t.id, t]));
function rollTier(wave){ const w = TR_WEIGHTS[Math.min(25, Math.floor(wave/5)*5)] || TR_WEIGHTS[5]; let x = Math.random(); for(const k in w){ if(x < w[k]) return k; x -= w[k]; } return 'C'; }
function rollTreasures(){
  const out = [];
  while(out.length < 3){
    const tier = rollTier(R.wave), pool = TREASURES.filter(t => t.tier === tier && !out.includes(t.id) && !(t.id === 'relic' && SEA_RELICS.every(([k]) => R.tr[k])));
    if(pool.length) out.push(pool[Math.floor(Math.random()*pool.length)].id);
  }
  return out;
}
function offerTreasure(){ R.choosing = true; R.offer = rollTreasures(); R.offerRerolls = gmod('treasureReroll'); showTreasure(); }
function pickTreasure(id){
  const T = TR[id], note = T.apply();
  R.treasures.push({id, note}); R.choosing = false; R.offer = null;
  computeMods(); uiDirty();
  banner(T.name.toUpperCase(), TR_TIERS[T.tier].col);
  return note;
}
// called by the engine
function treasureWaveStart(){
  if(R.tr.champion){ R.tr.champion = false;
    const top = allSynergy()[0], cid = top ? top.crew : R.crews[0], cap = CREW[cid].captain;
    let spot = null; for(let r=0;r<N && !spot;r++) for(let c=0;c<N;c++) if(canPlaceTile(c, r) && !towerAt(c, r)){ spot = {c, r}; break; }
    if(spot){ const t = makeTower({id:cap, star:3}, spot.c, spot.r); t.temp = true; R.towers.push(t); fxBurst(t.x, t.y, '#ffcf3d', 30); banner(`${HEROES[cap].name.toUpperCase()} JOINS!`, '#ffcf3d'); }
  }
}
function treasureWaveEnd(){
  if(R.tr.eternal > 0) R.tr.eternal--;
  const before = R.towers.length; R.towers = R.towers.filter(t => !t.temp); if(R.towers.length !== before && R.sel && R.sel.temp) R.sel = null;
}
function treasureTick(dt){
  if(!R.tr.cannon) return;
  R.cannonT -= dt; if(R.cannonT > 0) return; R.cannonT = 10;
  const tg = R.enemies.filter(e => e.alive).sort((a, b) => b.dist - a.dist).slice(0, 3), dmg = waveHp(R.wave)*0.9*(1 + gmod('cannon'));
  for(const e of tg){ damage(e, dmg, null, {noProc:true, crit:true}); R.fx.push({ring:true, x:e.x, y:e.y, r:46, t:0.45, col:'#ff9a3a'}); fxBurst(e.x, e.y, '#ff9a3a', 14); }
  if(tg.length){ R.shake = 0.35; R.texts.push({x:CW/2, y:60, text:'CANNON BARRAGE!', col:'#ff9a3a', t:1, size:26}); }
}
function drawCannon(g){ /* cannon strikes are drawn as fx rings */ }
