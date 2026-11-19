"use strict";
/* =====================================================================
   CHESS TD — DATA: 12 crews, 139 heroes (exact names from the design doc)
   Captain = first hero of each crew.
   ===================================================================== */
const CREWS = [
  {id:'CS', name:'Crimson Sovereignty', col:'#e8304a', special:'crit',     heroes:'Raizen, Valcrest, Bronn, Hawkeye, Zevran, Grendel, Mordek, Helvion, Sylvar, Zestian, Fenrik, Aria'},
  {id:'TV', name:'Titanic Vanguard',    col:'#3fa9ff', special:'shield',   heroes:'Thalgrim, Aurelion, Durnak, Florent, Kael, Rowan, Shion, Elric, Bramwell, Ravok, Nerion, Baldric, Corvax, Kendric, Volgrim, Azuron'},
  {id:'AR', name:'Abyssal Reign',       col:'#8a5cff', special:'lifesteal',heroes:'Morvath, Kagehiro, Brakkor, Veylor, Malachar, Lucivar, Glacien, Nyxara, Grommoth, Vaskor, Dreadmoor, Ashenhoof'},
  {id:'DW', name:'Dawnwalkers',         col:'#ff9a2e', special:'combo',    heroes:'Ryozen, Kaizel, Serina, Lucien, Kaidoh, Noctis, Momoji, Flint, Evelisse, Bravox'},
  {id:'LO', name:'Liberation Order',    col:'#2fd1b5', special:'heal',     heroes:'Zephyros, Caelum, Kohana, Virelia, Ursakar, Mordain, Bellara, Corvian, Tinkeron, Voltaris'},
  {id:'SD', name:'Savage Dominion',     col:'#c2711f', special:'rage',     heroes:'Varkhan, Dravik, Vexara, Gorran, Yukara, Zayla, Raxen, Torvak, Velkara, Kairox, Sonarik, Divinor'},
  {id:'RB', name:'Royal Banquet',       col:'#ff6fb5', special:'burn',     heroes:'Belladrax, Draziel, Velmira, Kravik, Saldorin, Djavon, Ignar, Calista, Miralys, Gravorn, Ordelis, Gavelle'},
  {id:'IG', name:'Imperial Guard',      col:'#e9eef7', special:'stun',     heroes:'Pyrrhon, Luxaris, Gravion, Verdantis, Aldrion, Solvaris, Ashford, Elowen, Cyrion, Helvar, Seraphine, Elaris'},
  {id:'FV', name:'First Voyage',        col:'#f5c542', special:'gold',     heroes:'Aurex, Raelion, Takehiro, Jinxar, Florentis, Garridan, Fenwald, Mauros, Solbern, Tokara, Sperion, Norzeth'},
  {id:'PM', name:'Phantom Medics',      col:'#7be36b', special:'regen',    heroes:'Zayden, Fennik, Riven, Pippin, Garruk, Ikaris, Unaris, Clionis, Hakarus'},
  {id:'BM', name:'Black Market Alliance',col:'#5a6a7a',special:'poison',   heroes:'Vaelthorn, Sahrak, Ferrix, Cindrel, Valessa, Kaviro, Mordji, Ragnar, Galdor, Chunari'},
  {id:'VT', name:'Velvet Tyranny',      col:'#b0305f', special:'slow',     heroes:'Draeven, Mucorin, Diamor, Pyrak, Vargus, Sugara, Valleria, Bovrik, Glavion, Laozen, Rosario, Joralis'},
];
const CREW = Object.fromEntries(CREWS.map(c => [c.id, c]));
// CREW SYNERGY: count different towers of a crew on the board -> 2 / 4 / 6.
// scope 'crew' = buff only that crew's towers, 'all' = buff every tower. Towers have no HP, so HP/heal/revive buffs go to the base.
const SYN = {
  DW:{scope:'crew', t:[{dmg:.15}, {dmg:.25, aspd:.10}, {dmg:.40, aspd:.20, dodge:.15}]},
  CS:{scope:'all',  t:[{dmg:.10, skillStun:.5}, {dmg:.20, skillStun:1}, {dmg:.35, skillStun:1, stunHit:.15}]},
  TV:{scope:'crew', t:[{baseHp:.20}, {baseHp:.40, dmg:.10}, {baseHp:.70, dmg:.20, lastStand:.30}]},
  AR:{scope:'crew', t:[{dmg:.10, lifesteal:.05}, {dmg:.20, lifesteal:.10}, {dmg:.35, lifesteal:.15, slowAura:.20}]},
  LO:{scope:'all',  t:[{aspd:.10}, {aspd:.20, charge:.10}, {aspd:.30, charge:.25, dmg:.10}]},
  SD:{scope:'crew', t:[{dmg:.15}, {dmg:.30, crit:.15}, {dmg:.50, crit:.25, critMul:3}]},
  RB:{scope:'all',  t:[{baseHp:.10, income:5}, {baseHp:.20, income:10}, {baseHp:.30, income:15, healWave:5}]},
  IG:{scope:'crew', t:[{dmg:.10, range:.10}, {dmg:.20, range:.15}, {dmg:.35, range:.20, cannon:.5}]},
  FV:{scope:'all',  t:[{dmg:.10, goldPct:.05}, {dmg:.20, goldPct:.10}, {dmg:.35, goldPct:.20, waveGold:50}]},
  PM:{scope:'all',  t:[{healWave:1}, {healWave:2, charge:.10}, {healWave:3, charge:.10, revive:1}]},
  BM:{scope:'all',  t:[{killGold:.10}, {killGold:.20, freeReroll:1}, {killGold:.35, freeReroll:1, treasureReroll:1}]},
  VT:{scope:'crew', t:[{pierce:.10}, {pierce:.20, dmg:.15}, {pierce:.30, dmg:.30, pull:.10}]},
};
const SYN_N = [2, 4, 6];
const pct = v => Math.round(v*100) + '%';
const EFFECT_TXT = {
  dmg:v => `+${pct(v)} Damage`, aspd:v => `+${pct(v)} Attack Speed`, crit:v => `+${pct(v)} Crit`, critMul:v => `Crits deal ${v*100}%`,
  range:v => `+${pct(v)} Range`, pierce:v => `ignore ${pct(v)} enemy armor`, charge:v => `skills charge ${pct(v)} faster`,
  dodge:v => `${pct(v)} chance to dodge a leak`, skillStun:v => `skill stuns +${v}s`, stunHit:v => `${pct(v)} chance to stun 1s on hit`,
  baseHp:v => `+${pct(v)} base HP`, lastStand:v => `+${pct(v)} damage when base is below 30%`, lifesteal:v => `${pct(v)} of kills heal the base 1 HP`,
  slowAura:v => `enemies ${pct(v)} slower in range`, income:v => `+${v} gold per wave`, healWave:v => `heal base ${v} HP per wave`,
  cannon:v => `Cannon Barrage +${pct(v)} damage`, goldPct:v => `+${pct(v)} wave gold`, waveGold:v => `+${v} gold at the start of each wave`,
  revive:() => 'once per run: survive a fatal leak at full HP', killGold:v => `+${pct(v)} gold from kills`,
  freeReroll:() => '1 free shop reroll per wave', treasureReroll:() => '+1 free reroll per Treasure Choice', pull:v => `${pct(v)} chance to pull enemies back 2 tiles`,
};
const synDesc = (cid, tier) => { const d = SYN[cid]; return (d.scope === 'all' ? 'All towers: ' : `${CREW[cid].name.split(' ')[0]} towers: `) + Object.entries(d.t[tier-1]).map(([k, v]) => EFFECT_TXT[k](v)).join(', '); };
const CAPTAIN_SKILLS = {
  CS:'Sovereign Edict', TV:'Titan Bulwark', AR:'Abyssal Eclipse', DW:'Dawnbreak Charge', LO:'Freedom Gale', SD:'Primal Roar',
  RB:'Grand Feast', IG:'Imperial Judgment', FV:'First Horizon', PM:'Phantom Remedy', BM:'Black Ledger', VT:'Velvet Decree',
};
const RARITY = {
  C:{name:'Common',    col:'#a3abb8', cost:1, mul:1.00, ord:0},
  R:{name:'Rare',      col:'#3d9bff', cost:2, mul:1.35, ord:1},
  E:{name:'Epic',      col:'#b65cff', cost:3, mul:1.80, ord:2},
  L:{name:'Legendary', col:'#FFD700', cost:4, mul:2.40, ord:3},
};
// roles decide the chess piece, base stats and the active skill type
const ROLES = {
  striker: {label:'Striker',  dmg:14, range:1.6, aspd:1.25, skill:'Flurry',   sdesc:'5 rapid strikes at 120% damage on the closest enemy'},
  sniper:  {label:'Sniper',   dmg:26, range:3.4, aspd:0.55, skill:'Headshot', sdesc:'one shot at 450% damage on the toughest enemy in range'},
  mage:    {label:'Mage',     dmg:12, range:2.4, aspd:0.70, skill:'Meteor',   sdesc:'250% damage to every enemy within 1.5 tiles of the target', splash:0.8},
  guardian:{label:'Guardian', dmg:10, range:1.5, aspd:0.90, skill:'Quake',    sdesc:'stuns every enemy in range for 1.5s and deals 150% damage', slow:0.15},
  support: {label:'Support',  dmg:7,  range:2.0, aspd:0.80, skill:'Rally',    sdesc:'towers within 1.5 tiles attack 40% faster for 5s'},
};
const ROLE_KEYS = Object.keys(ROLES);
const PASSIVES = [
  {id:'keen',   txt:'+12% crit chance'},
  {id:'giant',  txt:'+30% damage to bosses'},
  {id:'eagle',  txt:'+0.4 tile range'},
  {id:'chill',  txt:'hits slow enemies 15%'},
  {id:'greed',  txt:'+1 gold on every 8th kill'},
  {id:'opener', txt:'first attack each wave deals triple damage'},
  {id:'quick',  txt:'+15% attack speed'},
];
const SKILL_WORDS = {CS:'Crimson', TV:'Titan', AR:'Abyss', DW:'Dawn', LO:'Liberty', SD:'Savage', RB:'Banquet', IG:'Imperial', FV:'Voyager', PM:'Phantom', BM:'Smuggler', VT:'Velvet'};

function hash(s){ let h = 2166136261; for(const ch of s){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const HEROES = [];
for(const c of CREWS){
  c.list = c.heroes.split(',').map(s => s.trim());
  c.list.forEach((name, i) => {
    const h = hash(name + c.id);
    // captain is Legendary; the rest spread Legendary→Common down the list with a little variety
    const t = i === 0 ? 0 : (i + (h % 3) - 1) / c.list.length;
    const rar = i === 0 ? 'L' : t < 0.2 ? 'L' : t < 0.42 ? 'E' : t < 0.7 ? 'R' : 'C';
    const role = i === 0 ? (['striker','mage','sniper'][h % 3]) : ROLE_KEYS[(h >>> 4) % ROLE_KEYS.length];
    const R = ROLES[role], M = RARITY[rar].mul;
    const hero = {id:HEROES.length, name, crew:c.id, captain:i === 0, rar, role,
      cost:RARITY[rar].cost, dmg:Math.round(R.dmg*M), range:R.range, aspd:+(R.aspd*(1 + ((h >>> 9) % 5 - 2)*0.04)).toFixed(2),
      skill: i === 0 ? CAPTAIN_SKILLS[c.id] : `${SKILL_WORDS[c.id]} ${R.skill}`, skillType:role,
      passive:PASSIVES[(h >>> 13) % PASSIVES.length]};
    HEROES.push(hero);
  });
  c.ids = HEROES.filter(h => h.crew === c.id).map(h => h.id);
  c.captain = c.ids[0];
}
const heroDesc = H => H.captain
  ? `${H.skill} — strikes every enemy on the board for 300% damage (your crew's on-hit effects apply).`
  : `${H.skill} — ${ROLES[H.role].sdesc}.`;
