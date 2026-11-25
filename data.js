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
// ---- HERO KITS: every hero's role, rarity and active skill, matched to who they are ----
// format  Name: 'role/skill-type/rarity/Skill Name'
const KITS = {
  // Crimson Sovereignty
  Raizen:'striker/cap/L/Sovereign Edict', Valcrest:'sniper/snipe/L/Steady Barrel', Hawkeye:'sniper/execute/E/Never-Miss Shot', Aria:'mage/lull/E/Dream Song', Bronn:'support/mend/E/Hearty Feast',
  Zevran:'striker/flurry/R/Rogue Rush', Fenrik:'support/mend/R/Field Surgery', Zestian:'mage/venom/R/Serpent Fang', Grendel:'guardian/quake/C/Tavern Haymaker', Mordek:'mage/chain/C/Spark Hammer',
  Helvion:'support/rally/C/Riot Anthem', Sylvar:'guardian/gale/C/Wild Shove',
  // Titanic Vanguard
  Thalgrim:'guardian/cap/L/Worldsplitter Quake', Aurelion:'support/mend/L/Phoenix Mend', Kael:'mage/inferno/L/Fire Fist', Durnak:'guardian/mark/E/Diamond Crush', Florent:'striker/sweep/E/Petal Swords',
  Shion:'sniper/barrage/E/Twin Pistols', Rowan:"striker/flurry/R/Cook's Cleaver", Nerion:'striker/execute/R/Shark Bite', Kendric:'guardian/quake/R/Iron Stomp', Azuron:'striker/flurry/R/Swift Saber',
  Corvax:'sniper/blast/R/Bazooka Volley', Bramwell:"support/rally/C/Brother's Cheer", Ravok:'striker/sweep/C/Mace Storm', Baldric:'striker/flurry/C/Bandit Fang', Volgrim:'guardian/gale/C/Stampede Charge',
  Elric:'support/rally/C/Fleet Banner',
  // Abyssal Reign
  Morvath:'mage/cap/L/Abyssal Eclipse', Glacien:'mage/frost/L/Ice Age', Kagehiro:'striker/execute/E/Unseen Blade', Veylor:'sniper/snipe/E/Warp Shot', Malachar:'mage/venom/E/Plague Apple',
  Brakkor:'guardian/quake/R/Champion Slam', Lucivar:'support/web/R/Hypnotic Waltz', Nyxara:'striker/mark/R/Nine-Tail Ruse', Vaskor:'mage/inferno/R/Firewater Blast', Grommoth:'guardian/quake/C/Colossus Step',
  Dreadmoor:'guardian/web/C/Grasping Isle', Ashenhoof:'striker/gale/C/Trample',
  // Dawnwalkers
  Ryozen:'striker/cap/L/Dawnbreak Charge', Kaizel:'striker/sweep/L/Three-Blade Tempest', Lucien:'striker/inferno/E/Blazing Heel', Kaidoh:'guardian/gale/E/Tidal Palm', Evelisse:'mage/grip/E/Hundred-Hand Clutch',
  Serina:'mage/chain/R/Storm Tempo Bolt', Bravox:'sniper/blast/R/Radical Cannon', Noctis:'striker/frost/R/Requiem Chill', Flint:'sniper/barrage/C/Fire-Bird Pellets', Momoji:'support/mend/C/Healing Rumble',
  // Liberation Order
  Zephyros:'mage/cap/L/Freedom Gale', Caelum:'mage/inferno/L/Dragon Flame Claw', Ursakar:'guardian/gale/E/Paw Repel', Virelia:'support/mend/E/Hormone Surge', Kohana:'striker/gale/E/Karate Palm',
  Bellara:'support/rally/R/Rally Banner', Voltaris:'striker/chain/R/Thunder Shears', Corvian:'mage/barrage/R/Crow Swarm', Mordain:'guardian/quake/C/Earth Heave', Tinkeron:'sniper/frost/C/Cryo Rifle',
  // Savage Dominion
  Varkhan:'mage/cap/L/Primal Roar', Dravik:'mage/inferno/L/Pteranodon Blaze', Yukara:'striker/frost/L/Frost Club', Vexara:'sniper/venom/E/Plague Rounds', Gorran:'guardian/quake/E/Mammoth Stomp',
  Raxen:'striker/mark/R/Spino Bite', Velkara:'support/web/R/Spider Web', Sonarik:'striker/sweep/R/Twin Axe Rend', Zayla:'striker/flurry/R/Headbutt Rush', Torvak:'guardian/gale/C/Horn Charge',
  Kairox:'striker/execute/C/Tiger Fang', Divinor:'mage/blast/C/Primal Meteor',
  // Royal Banquet
  Belladrax:'mage/cap/L/Grand Feast', Draziel:'striker/flurry/L/Mochi Barrage', Velmira:'striker/execute/E/Juice Wring', Kravik:'guardian/quake/E/Biscuit Wall', Saldorin:'support/web/E/Candy Trap',
  Djavon:'mage/blast/R/Genie Smash', Ignar:'mage/inferno/R/Oven Heat', Calista:'support/mark/R/Memory Snip', Miralys:'mage/chain/R/Mirror Bounce', Gravorn:'guardian/gale/C/Sugar Avalanche',
  Ordelis:'support/plunder/C/Tea Party Tax', Gavelle:'support/web/C/Butter Slick',
  // Imperial Guard
  Pyrrhon:'mage/cap/L/Imperial Judgment', Luxaris:'sniper/barrage/L/Light-Speed Volley', Aldrion:'striker/flurry/L/Iron Fist Barrage', Gravion:'mage/blast/E/Fallen Star', Verdantis:'mage/venom/E/Thorn Bloom',
  Solvaris:'guardian/quake/E/Golden Shockwave', Ashford:'support/web/R/Smoke Snare', Cyrion:"striker/gale/R/Cadet's Impact", Elowen:'striker/sweep/C/Precision Edge', Helvar:'striker/flurry/C/Twin Kukri',
  Seraphine:'support/rally/C/Marine Order', Elaris:'sniper/snipe/C/Battleship Cannon',
  // First Voyage
  Aurex:'striker/cap/L/First Horizon', Raelion:"striker/sweep/L/Dark King's Edge", Takehiro:'striker/mark/E/Twin Blade Ruin', Jinxar:'mage/barrage/E/Scatter Cannon', Garridan:'striker/sweep/R/Axe Whirlwind',
  Norzeth:'support/mend/R/Lighthouse Remedy', Tokara:'striker/execute/R/Final Edge', Sperion:'sniper/chain/R/Ricochet Shot', Florentis:"support/plunder/C/Captain's Share", Fenwald:'sniper/snipe/C/Long Horizon Shot',
  Mauros:'guardian/quake/C/Anchor Drop', Solbern:'mage/frost/C/North Wind',
  // Phantom Medics
  Zayden:'mage/cap/L/Phantom Remedy', Garruk:'guardian/quake/E/Hull Breaker', Fennik:'striker/flurry/E/Mink Kick Rush', Pippin:'support/rally/R/Crew Chant', Riven:'striker/mark/R/Saw Fang',
  Hakarus:'sniper/frost/R/Polar Mark', Ikaris:'sniper/snipe/C/Harpoon Shot', Unaris:'mage/venom/C/Spine Spores', Clionis:'support/mend/C/Steady Hands',
  // Black Market Alliance
  Vaelthorn:'striker/cap/L/Black Blade Horizon', Sahrak:'mage/venom/L/Desert Drain', Ferrix:'striker/sweep/E/Steel Body Slash', Valessa:'mage/blast/E/Ten-Ton Drop', Galdor:'support/grip/R/Candle Lock',
  Kaviro:'striker/flurry/R/Acrobat Blades', Cindrel:"sniper/barrage/R/Smuggler's Volley", Mordji:"striker/mark/C/Tamer's Whip", Ragnar:'guardian/quake/C/Hammer Ruin', Chunari:'support/plunder/C/Black Market Cut',
  // Velvet Tyranny
  Draeven:'mage/cap/L/Velvet Decree', Diamor:'striker/sweep/E/Flutter Blade', Vargus:'striker/flurry/E/Iron Bamboo Rush', Sugara:'support/execute/E/Toy Touch', Rosario:'support/lull/E/Calm Silence',
  Pyrak:'guardian/quake/R/Stone Titan', Valleria:'sniper/mark/R/Glare Reveal', Mucorin:'support/web/R/Slime Snare', Glavion:'mage/blast/R/Burst Rupture', Bovrik:'guardian/gale/C/Spinning Gust',
  Laozen:"striker/flurry/C/Elder's Fist", Joralis:'mage/grip/C/Twisted Canvas',
};
// what each skill type does (numbers are % of the tower's damage)
const SKILLS = {
  flurry: 'rapid 5-hit combo on the closest enemy (120% each)',
  snipe:  'one shot at 450% on the toughest enemy in range',
  blast:  'explosion: 250% to every enemy within 1.5 tiles of the target (AOE)',
  quake:  'stuns every enemy in range for 1.5s and deals 150% (AOE)',
  rally:  'towers within 1.6 tiles attack 40% faster for 5s',
  sweep:  'slashes every enemy in range for 200% (AOE)',
  inferno:'fire burst: 180% to enemies within 1.3 tiles of the target, then burns them for 3s (AOE)',
  frost:  'freezing wave: 120% to every enemy in range and slows them 50% for 3s (AOE)',
  chain:  'lightning that jumps between up to 5 enemies for 220% each',
  venom:  'poison cloud within 1.3 tiles of the target: 100% now, then 1.2% max HP per second for 5s (stacks 3x)',
  mend:   'heals the base 1 HP and hits the target for 150%',
  plunder:'steals 2 gold (+1 per star) and hits the target for 250%',
  gale:   'blasts every enemy in range 1.5 tiles back along the path for 130% (AOE)',
  web:    'traps every enemy in range: 60% slower for 4s, 80% damage (AOE)',
  execute:'finishes the weakest enemy in range if below 25% HP, otherwise 400%',
  barrage:'fires 6 shots at random enemies in range (120% each)',
  mark:   'every enemy in range takes +30% damage from all towers for 5s, plus 120% now (AOE)',
  grip:   'holds every enemy within 1.4 tiles of the target in place for 2s, 120% damage (AOE)',
  lull:   'puts every enemy within 1.4x range to sleep for 2.5s (AOE)',
};
// captains: hit every enemy on the board, plus a signature extra
const CAPTAIN = {
  CS:{mul:3,   extra:'stun',  txt:'and knocks them all out for 1.5s'},
  TV:{mul:3,   extra:'quake', txt:'stuns them 1s and throws them 1 tile back'},
  AR:{mul:2.5, extra:'pull',  txt:'drags them 2 tiles back into the dark and heals the base 1 HP'},
  DW:{mul:3,   extra:'smash', txt:'and lands a giant 800% punch on the toughest enemy'},
  LO:{mul:2.5, extra:'gale',  txt:'and blows them all 2.5 tiles back'},
  SD:{mul:3.5, extra:'burn',  txt:'and sets them all on fire for 4s'},
  RB:{mul:2.5, extra:'soul',  txt:'and takes the life of any non-boss below 25% HP'},
  IG:{mul:3,   extra:'melt',  txt:'then burns them and makes them take +30% damage for 5s'},
  FV:{mul:3,   extra:'gold',  txt:'and earns 1 gold for every 3 enemies hit'},
  PM:{mul:2.5, extra:'heal',  txt:'and heals the base 2 HP'},
  BM:{mul:4,   extra:'none',  txt:'(the strongest single slash in the game)'},
  VT:{mul:2.5, extra:'slow',  txt:'and binds them all 60% slower for 5s'},
};
// rarer = lower summon rate, higher price, stronger: mul = damage, spd = attack speed, rng = extra tiles of range
const RARITY = {
  C:{name:'Common',    col:'#a3abb8', cost:1, mul:1.0, spd:0,   rng:0,   ord:0, rate:.60, price:50,   dup:10},
  R:{name:'Rare',      col:'#3d9bff', cost:2, mul:1.5, spd:.03, rng:0,   ord:1, rate:.26, price:100,  dup:20},
  E:{name:'Epic',      col:'#b65cff', cost:3, mul:2.2, spd:.06, rng:.1,  ord:2, rate:.10, price:250,  dup:50},
  L:{name:'Legendary', col:'#FFD700', cost:4, mul:3.2, spd:.10, rng:.2,  ord:3, rate:.03, price:600,  dup:120},
  M:{name:'Mythic',    col:'#ff4d6d', cost:5, mul:4.2, spd:.14, rng:.3,  ord:4, rate:.01, price:1200, dup:250},   // the 12 captains
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
    const k = KITS[name]; if(!k) throw new Error('no kit for ' + name);
    const [role, kit, rar0, skill] = k.split('/'), rar = i === 0 ? 'M' : rar0;
    const R = ROLES[role], M = RARITY[rar].mul;
    const hero = {id:HEROES.length, name, crew:c.id, captain:i === 0, rar, role, kit,
      cost:RARITY[rar].cost, dmg:Math.round(R.dmg*M), range:+(R.range + RARITY[rar].rng).toFixed(1), aspd:+(R.aspd*(1 + RARITY[rar].spd)*(1 + ((h >>> 9) % 5 - 2)*0.02)).toFixed(2),
      skill, passive:PASSIVES[(h >>> 13) % PASSIVES.length]};
    HEROES.push(hero);
  });
  c.ids = HEROES.filter(h => h.crew === c.id).map(h => h.id);
  c.captain = c.ids[0];
}
const skillTxt = H => H.captain ? `hits every enemy on the board for ${CAPTAIN[H.crew].mul*100}% ${CAPTAIN[H.crew].txt}` : SKILLS[H.kit];
const heroDesc = H => `${H.skill} — ${skillTxt(H)}.`;
