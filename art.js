"use strict";
/* =====================================================================
   ART: the player's hero pictures (image assets) + original chess-piece
   icons for heroes that don't have a picture yet.
   Add a picture: save assets/heroes/<name>.webp and add a line to HERO_ART.
   crop = [x, y, w, h] as fractions of the image, kept at 3:4.
   ===================================================================== */
const DPR = Math.min(2, window.devicePixelRatio || 1);
const HOME_BG = 'assets/home.webp';
const HERO_ART = {
  Ryozen:  {src:HOME_BG, crop:[0.335, 0.18, 0.33, 0.66]},
  Serina:  {src:HOME_BG, crop:[0.10, 0.27, 0.28, 0.56]},
  Kaizel:  {src:HOME_BG, crop:[0.615, 0.11, 0.28, 0.56]},
  Lucien:  {src:'assets/heroes/lucien.webp',   crop:[0.08, 0.06, 0.84, 0.56]},
  Evelisse:{src:'assets/heroes/evelisse.webp', crop:[0.06, 0.04, 0.88, 0.78]},
  Bravox:  {src:'assets/heroes/bravox.webp',   crop:[0.06, 0.03, 0.88, 0.78]},
  Noctis:  {src:'assets/heroes/nocturne.webp', crop:[0.08, 0.05, 0.84, 0.56]},
  Flint:   {src:'assets/heroes/flint.webp',    crop:[0.05, 0.05, 0.84, 0.56]},
  Kaidoh:  {src:'assets/heroes/kaidoh.webp',   crop:[0.06, 0.03, 0.88, 0.78]},
  Mordek:  {src:'assets/heroes/mordek.webp',   crop:[0.12, 0.03, 0.80, 0.71]},
  Helvion: {src:'assets/heroes/helvion.webp',  crop:[0.06, 0.03, 0.88, 0.78]},
  Sylvar:  {src:'assets/heroes/sylvar.webp',   crop:[0.08, 0.05, 0.84, 0.56]},
  Zestian: {src:'assets/heroes/zestian.webp',  crop:[0.12, 0.05, 0.80, 0.71]},
  Fenrik:  {src:'assets/heroes/fenrik.webp',   crop:[0.06, 0.05, 0.88, 0.78]},
  Aria:    {src:'assets/heroes/aria.webp',     crop:[0.06, 0.03, 0.88, 0.78]},
  Thalgrim:{src:'assets/heroes/thalgrim.webp', crop:[0.08, 0.11, 0.84, 0.75]},
  Aurelion:{src:'assets/heroes/aurelion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Durnak:  {src:'assets/heroes/durnak.webp', crop:[0.08, 0.09, 0.84, 0.75]},
  Florent: {src:'assets/heroes/florent.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kael:    {src:'assets/heroes/kael.webp', crop:[0.08, 0.03, 0.84, 0.75]},
  Rowan:   {src:'assets/heroes/rowan.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Shion:   {src:'assets/heroes/shion.webp', crop:[0.06, 0.07, 0.88, 0.59]},
  Elric:   {src:'assets/heroes/elric.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Bramwell:{src:'assets/heroes/bramwell.webp', crop:[0.08, 0.03, 0.84, 0.75]},
  Ravok:   {src:'assets/heroes/ravok.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Nerion:  {src:'assets/heroes/nerion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Baldric: {src:'assets/heroes/baldric.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Corvax:  {src:'assets/heroes/corvax.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kendric: {src:'assets/heroes/kendric.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Volgrim: {src:'assets/heroes/volgrim.webp', crop:[0.08, 0.03, 0.84, 0.75]},
  Azuron:  {src:'assets/heroes/azuron.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Morvath: {src:'assets/heroes/morvath.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kagehiro:{src:'assets/heroes/kagehiro.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Brakkor: {src:'assets/heroes/brakkor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Veylor:  {src:'assets/heroes/veylor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Malachar:{src:'assets/heroes/malachar.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Lucivar: {src:'assets/heroes/lucivar.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Glacien: {src:'assets/heroes/glacien.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Nyxara:  {src:'assets/heroes/nyxara.webp', crop:[0.08, 0.03, 0.84, 0.75]},
  Grommoth:{src:'assets/heroes/grommoth.webp', crop:[0.04, 0.05, 0.92, 0.61]},
  Vaskor:  {src:'assets/heroes/vaskor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Dreadmoor:{src:'assets/heroes/dreadmoor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ashenhoof:{src:'assets/heroes/ashenhoof.webp', crop:[0.10, 0.03, 0.80, 0.71]},
  Zephyros:{src:'assets/heroes/zephyros.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Caelum:  {src:'assets/heroes/caelum.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Kohana:  {src:'assets/heroes/kohana.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Virelia: {src:'assets/heroes/virelia.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ursakar: {src:'assets/heroes/ursakar.webp', crop:[0.04, 0.09, 0.92, 0.61]},
  Mordain: {src:'assets/heroes/mordain.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Bellara: {src:'assets/heroes/bellara.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Corvian: {src:'assets/heroes/corvian.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Tinkeron:{src:'assets/heroes/tinkeron.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Voltaris:{src:'assets/heroes/voltaris.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Belladrax:{src:'assets/heroes/belladrax.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Draziel: {src:'assets/heroes/draziel.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Velmira: {src:'assets/heroes/velmira.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kravik:  {src:'assets/heroes/kravik.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Saldorin:{src:'assets/heroes/saldorin.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Djavon:  {src:'assets/heroes/djavon.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ignar:   {src:'assets/heroes/ignar.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Calista: {src:'assets/heroes/calista.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Miralys: {src:'assets/heroes/miralys.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Gravorn: {src:'assets/heroes/gravorn.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Ordelis: {src:'assets/heroes/ordelis.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Gavelle: {src:'assets/heroes/gavelle.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Pyrrhon: {src:'assets/heroes/pyrrhon.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Luxaris: {src:'assets/heroes/luxaris.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Gravion: {src:'assets/heroes/gravion.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Verdantis:{src:'assets/heroes/verdantis.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Aldrion: {src:'assets/heroes/aldrion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Solvaris:{src:'assets/heroes/solvaris.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ashford: {src:'assets/heroes/ashford.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Elowen:  {src:'assets/heroes/elowen.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Cyrion:  {src:'assets/heroes/cyrion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Helvar:  {src:'assets/heroes/helvar.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Seraphine:{src:'assets/heroes/seraphine.webp', crop:[0.10, 0.03, 0.80, 0.71]},
  Elaris:  {src:'assets/heroes/elaris.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Aurex:   {src:'assets/heroes/aurex.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Raelion: {src:'assets/heroes/raelion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Takehiro:{src:'assets/heroes/takehiro.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Jinxar:  {src:'assets/heroes/jinxar.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Florentis:{src:'assets/heroes/florentis.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Garridan:{src:'assets/heroes/garridan.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Fenwald: {src:'assets/heroes/fenwald.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Mauros:  {src:'assets/heroes/mauros.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Solbern: {src:'assets/heroes/solbern.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Tokara:  {src:'assets/heroes/tokara.webp', crop:[0.06, 0.04, 0.88, 0.59]},
  Sperion: {src:'assets/heroes/sperion.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Norzeth: {src:'assets/heroes/norzeth.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Zayden:  {src:'assets/heroes/zayden.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Fennik:  {src:'assets/heroes/fennik.webp', crop:[0.04, 0.04, 0.92, 0.61]},
  Riven:   {src:'assets/heroes/riven.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Pippin:  {src:'assets/heroes/pippin.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Garruk:  {src:'assets/heroes/garruk.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ikaris:  {src:'assets/heroes/ikaris.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Unaris:  {src:'assets/heroes/unaris.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Clionis: {src:'assets/heroes/clionis.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Hakarus: {src:'assets/heroes/hakarus.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Vaelthorn:{src:'assets/heroes/vaelthorn.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Sahrak:  {src:'assets/heroes/sahrak.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ferrix:  {src:'assets/heroes/ferrix.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Cindrel: {src:'assets/heroes/cindrel.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Valessa: {src:'assets/heroes/valessa.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kaviro:  {src:'assets/heroes/kaviro.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Mordji:  {src:'assets/heroes/mordji.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Ragnar:  {src:'assets/heroes/ragnar.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Galdor:  {src:'assets/heroes/galdor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Chunari: {src:'assets/heroes/chunari.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Draeven: {src:'assets/heroes/draeven.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Mucorin: {src:'assets/heroes/mucorin.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Diamor:  {src:'assets/heroes/diamor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Pyrak:   {src:'assets/heroes/pyrak.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Vargus:  {src:'assets/heroes/vargus.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Sugara:  {src:'assets/heroes/sugara.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Valleria:{src:'assets/heroes/valleria.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Bovrik:  {src:'assets/heroes/bovrik.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Glavion: {src:'assets/heroes/glavion.webp', crop:[0.06, 0.07, 0.88, 0.59]},
  Laozen:  {src:'assets/heroes/laozen.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Rosario: {src:'assets/heroes/rosario.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Joralis: {src:'assets/heroes/joralis.webp', crop:[0.08, 0.08, 0.84, 0.75]},
  Varkhan: {src:'assets/heroes/varkhan.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Dravik:  {src:'assets/heroes/dravik.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Vexara:  {src:'assets/heroes/vexara.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Gorran:  {src:'assets/heroes/gorran.webp', crop:[0.08, 0.10, 0.84, 0.75]},
  Yukara:  {src:'assets/heroes/yukara.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Zayla:   {src:'assets/heroes/zayla.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Raxen:   {src:'assets/heroes/raxen.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Torvak:  {src:'assets/heroes/torvak.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Velkara: {src:'assets/heroes/velkara.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Kairox:  {src:'assets/heroes/kairox.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Sonarik: {src:'assets/heroes/sonarik.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Divinor: {src:'assets/heroes/divinor.webp', crop:[0.08, 0.04, 0.84, 0.75]},
  Momoji:  {src:'assets/heroes/momoji.webp',   crop:[0.10, 0.03, 0.80, 0.80]},
  Raizen:  {src:'assets/heroes/raizen.webp',   crop:[0.08, 0.04, 0.84, 0.56]},
  Valcrest:{src:'assets/heroes/valcrest.webp', crop:[0.08, 0.04, 0.84, 0.56]},
  Hawkeye: {src:'assets/heroes/deadeye.webp',  crop:[0.08, 0.05, 0.84, 0.56]},
  Bronn:   {src:'assets/heroes/bronn.webp',    crop:[0.08, 0.05, 0.84, 0.56]},
  Zevran:  {src:'assets/heroes/zevran.webp',   crop:[0.06, 0.05, 0.84, 0.56]},
  Grendel: {src:'assets/heroes/grendel.webp',  crop:[0.08, 0.08, 0.84, 0.56]},
  // assets/heroes/marinos.webp is kept for later: no hero of that name in the current roster
};
const IMG = {};
function loadArt(){
  const srcs = new Set([HOME_BG, ...Object.values(HERO_ART).map(a => a.src)]);
  return Promise.race([
    Promise.all([...srcs].map(src => new Promise(res => { const im = new Image(); im.onload = () => { IMG[src] = im; res(); }; im.onerror = () => res(); im.src = src; }))),
    new Promise(res => setTimeout(res, 4000)),
  ]);
}
const artOf = H => { const a = HERO_ART[H.name]; return a && IMG[a.src] ? a : null; };
const hasArt = H => !!artOf(H);
function hexA(hex, a){ const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }
function shade(hex, k){ const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v*(1+k) : v + (255-v)*k)));
  return '#' + [f(n>>16), f((n>>8)&255), f(n&255)].map(v => v.toString(16).padStart(2,'0')).join(''); }

// draw the hero's picture covering (x,y,w,h); `focus` shifts the crop toward the face (0 = whole crop, 1 = top third)
function paintArt(g, H, x, y, w, h, focus = 0){
  const a = artOf(H); if(!a) return false; const im = IMG[a.src];
  let [sx, sy, sw, sh] = [a.crop[0]*im.width, a.crop[1]*im.height, a.crop[2]*im.width, a.crop[3]*im.height];
  if(focus){ const k = 1 - 0.45*focus; sx += sw*(1-k)/2; sw *= k; sh *= k; }
  const s = Math.max(w/sw, h/sh), cw = w/s, ch = h/s; sx += (sw - cw)/2;
  g.drawImage(im, sx, sy, cw, ch, x, y, w, h);
  return true;
}

/* ---------- original chess-piece icons (100x100 box) ---------- */
const PIECE_PATHS = {
  pawn:  'M50 12a14 14 0 1 1 0 28a14 14 0 1 1 0-28zM37 43h26l-4 7c6 8 9 18 10 28H31c1-10 4-20 10-28zM22 80h56l4 12H18z',
  knight:'M30 80c0-12 6-20 14-26l-14 4c-7 2-11-5-6-9l19-19c2-9 9-15 19-16l4-7 4 9c11 7 15 20 13 36-2 12-5 20-5 28zM20 80h60l4 12H16z',
  bishop:'M50 6a7 7 0 1 1 0 14a7 7 0 1 1 0-14zM50 20c15 10 19 23 15 35l-4 5H39l-4-5c-4-12 0-25 15-35zM37 62h26l4 18H33zM20 80h60l4 12H16z',
  rook:  'M27 12h11v9h6v-9h12v9h6v-9h11v22l-8 6 4 40H31l4-40-8-6zM20 80h60l4 12H16z',
  queen: 'M16 28l12 36h44l12-36-17 15-7-25-10 21-10-21-7 25zM29 66h42l4 14H25zM20 80h60l4 12H16zM16 22a6 6 0 1 1 0.1 0zM84 22a6 6 0 1 1 0.1 0zM50 10a6 6 0 1 1 0.1 0z',
  king:  'M46 4h8v9h9v8h-9v9h-8v-9h-9v-8h9zM29 34h42l-6 30H35zM27 66h46l4 14H23zM20 80h60l4 12H16z',
};
const PIECE_P2D = Object.fromEntries(Object.entries(PIECE_PATHS).map(([k, d]) => [k, new Path2D(d)]));
const pieceOf = H => H.captain ? 'king' : H.rar === 'L' ? 'queen' : H.rar === 'E' ? 'rook' : H.rar === 'R' ? (H.role === 'striker' || H.role === 'guardian' ? 'knight' : 'bishop') : 'pawn';
function drawPiece(g, H, cx, cy, size){
  const col = CREW[H.crew].col, p = PIECE_P2D[pieceOf(H)];
  g.save(); g.translate(cx - size/2, cy - size/2); g.scale(size/100, size/100);
  const gr = g.createLinearGradient(0, 0, 100, 100); gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.45));
  g.fillStyle = gr; g.fill(p); g.lineWidth = 4; g.strokeStyle = 'rgba(10,8,20,.9)'; g.lineJoin = 'round'; g.stroke(p);
  g.save(); g.clip(p); g.globalAlpha = 0.35; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 38, 100); g.restore();
  g.restore();
}
// hero bust silhouette (used until a hero has a picture; never a chess piece for heroes)
const BUST = new Path2D('M50 14c11 0 19 9 19 21 0 9-4 16-10 20 14 4 26 13 30 29l2 10H9l2-10c4-16 16-25 30-29-6-4-10-11-10-20 0-12 8-21 19-21z');
function drawBust(g, cx, cy, size, fill, rim){
  g.save(); g.translate(cx - size/2, cy - size/2); g.scale(size/100, size/100);
  g.fillStyle = fill; g.fill(BUST);
  if(rim){ g.lineWidth = 3; g.strokeStyle = rim; g.stroke(BUST); }
  g.restore();
}
function cardBg(g, col, w, h){
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, shade(col, -0.35)); bg.addColorStop(1, '#0a1226'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const gl = g.createRadialGradient(w/2, h*0.45, 4, w/2, h*0.45, w*0.6); gl.addColorStop(0, hexA(col, 0.45)); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h);
}
// 3:4 card picture (data URL). owned=false gives the black "???" silhouette card.
const CARD = {};
function cardArt(id, owned = true){
  const key = id + (owned ? '' : 'x'); if(CARD[key]) return CARD[key];
  const H = HEROES[id], c = document.createElement('canvas'); c.width = 150; c.height = 200; const g = c.getContext('2d'), col = CREW[H.crew].col;
  // no picture (or not owned yet): black silhouette with a single "?"
  const painted = paintArt(g, H, 0, 0, 150, 200);
  if(painted && !owned){ g.fillStyle = 'rgba(4,8,20,.62)'; g.fillRect(0, 0, 150, 200); }   // not unlocked yet: same portrait, darker
  if(!painted){
    const bg = g.createLinearGradient(0, 0, 0, 200); bg.addColorStop(0, '#16233d'); bg.addColorStop(1, '#070b18'); g.fillStyle = bg; g.fillRect(0, 0, 150, 200);
    const gl = g.createRadialGradient(75, 90, 4, 75, 90, 80); gl.addColorStop(0, hexA(col, owned ? 0.3 : 0.15)); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, 150, 200);
    drawBust(g, 75, 106, 132, '#020308', hexA(col, owned ? 0.7 : 0.4));
    
  }
  const vg = g.createLinearGradient(0, 120, 0, 200); vg.addColorStop(0, 'rgba(5,10,28,0)'); vg.addColorStop(1, 'rgba(5,10,28,.9)'); g.fillStyle = vg; g.fillRect(0, 0, 150, 200);
  return CARD[key] = c.toDataURL('image/jpeg', 0.88);
}
// round board token: portrait in a crew ring, or a crew-coloured bust
const TOKEN = {};
function token(id, ring){
  const key = id + (ring || ''); if(TOKEN[key]) return TOKEN[key];
  const H = HEROES[id], S = 96, c = document.createElement('canvas'); c.width = c.height = S*DPR; const g = c.getContext('2d'); g.scale(DPR, DPR);
  const col = CREW[H.crew].col, r = S/2 - 5;
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; g.fillStyle = '#0a1226'; g.beginPath(); g.arc(S/2, S/2, r, 0, 7); g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(S/2, S/2, r - 3, 0, 7); g.clip();
  if(!paintArt(g, H, S/2 - r, S/2 - r, r*2, r*2, 1)){ g.fillStyle = '#0a1020'; g.fillRect(0, 0, S, S); drawBust(g, S/2, S/2 + 8, r*1.9, '#020308', hexA(col, 0.8)); }
  g.restore();
  g.lineWidth = ring ? 7 : 5; g.strokeStyle = ring || col; g.beginPath(); g.arc(S/2, S/2, r - 2.5, 0, 7); g.stroke();
  g.lineWidth = 2; g.strokeStyle = RARITY[H.rar].col; g.beginPath(); g.arc(S/2, S/2, r + 1.5, 0, 7); g.stroke();
  return TOKEN[key] = c;
}
const ENEMY_COL = {walker:'#3a3f52', runner:'#2e5a6a', brute:'#5a3a3a', armored:'#55606f', boss:'#2a1530'};
function drawEnemy(g, e, t){
  const s = e.boss ? 1.6 : e.type === 'brute' ? 1.2 : e.type === 'runner' ? 0.85 : 1, bob = Math.sin(t*10 + e.seed)*2;
  g.save(); g.translate(e.x, e.y + bob);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 16*s, 16*s, 5*s, 0, 0, 7); g.fill();
  const col = e.stun > 0 ? '#ffe48a' : e.slowT > 0 ? '#7fe7ff' : ENEMY_COL[e.boss ? 'boss' : e.type];
  // a dark "enemy" chess piece
  g.save(); g.translate(-18*s, -24*s); g.scale(0.36*s, 0.4*s);
  const p = PIECE_P2D[e.boss ? 'king' : e.type === 'brute' ? 'rook' : e.type === 'armored' ? 'bishop' : 'pawn'];
  g.fillStyle = col; g.fill(p); g.lineWidth = 6; g.strokeStyle = e.boss ? '#ff4d6d' : '#120c18'; g.stroke(p);
  g.restore();
  if(e.hit > 0){ g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(0, -4*s, 14*s, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  if(e.burn > 0){ g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(10*s, -18*s, 3, 0, 7); g.fill(); }
  if(e.poison > 0){ g.fillStyle = '#7be36b'; g.beginPath(); g.arc(-10*s, -18*s, 3, 0, 7); g.fill(); }
  const w = e.boss ? 56 : 30, f = Math.max(0, e.hp/e.maxHp);
  g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(-w/2 - 1, -32*s - 1, w + 2, 6); g.fillStyle = e.boss ? '#ff4d6d' : f > 0.5 ? '#7be36b' : '#ffb020'; g.fillRect(-w/2, -32*s, w*f, 4);
  g.restore();
}
