'use strict';
// Szóláskaland – játéklogika

const $ = s => document.querySelector(s);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pick = a => a[Math.random() * a.length | 0];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

const ITEMS = RAW.map((r, i) => {
  const m = r[1].match(/\{(.+?)\}/);
  return { id: i, cat: r[0], t: r[1], ans: m[1], full: r[1].replace(/[{}]/g, ''), mean: r[2], ex: r[3] || '' };
});

// Szintek: 0 = még nem látta, 1–5 = tanulási lépcsők, 6 = mester
const LV_ICON = ['🔒', '🥚', '🐣', '🐥', '🐥', '🦅', '⭐'];
const KIND_PTS = { fill: 10, meaning: 12, reverse: 14, order: 18, spell: 20 };
const RANKS = [
  [0, 'Szólás-csemete', '🌱'], [150, 'Közmondás-kölyök', '🐣'], [400, 'Szófogadó szarka', '🐦'],
  [800, 'Bagoly-tanonc', '🦉'], [1400, 'Szólásvadász', '🏹'], [2200, 'Közmondás-kapitány', '⚓'],
  [3200, 'Nyelvművész', '🎨'], [4500, 'Szólás-királynő', '👑'], [6500, 'Közmondás-legenda', '🏆']
];
const PRAISE = ['Szuper!', 'Telitalálat!', 'Ügyes vagy!', 'Pontosan!', 'Nagyszerű!', 'Bravó!', 'Így kell ezt!', 'Hibátlan!'];
const OOPS = ['Majdnem!', 'Semmi baj!', 'Nem egészen...', 'Hoppá!'];

// ---------- Mentés ----------
const KEY = 'szolaskaland_v1';
function blank() { return { name: '', xp: 0, round: 0, items: {}, best: 0, best3: 0, streak: 0, lastDay: '', sound: true }; }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.items) return Object.assign(blank(), s); } catch (e) {} return blank(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = load();
function P(id) { return S.items[id] || (S.items[id] = { l: 0, r: 0, w: 0, last: -99 }); }
const lvl = id => (S.items[id] ? S.items[id].l : 0);

function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function bumpDay() {
  const t = dayStr(new Date());
  if (S.lastDay === t) return;
  S.streak = S.lastDay === dayStr(new Date(Date.now() - 864e5)) ? S.streak + 1 : 1;
  S.lastDay = t;
}
function liveStreak() {
  return (S.lastDay === dayStr(new Date()) || S.lastDay === dayStr(new Date(Date.now() - 864e5))) ? S.streak : 0;
}
function rankOf(xp) { let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++; return i; }

// ---------- Hang és felolvasás ----------
let AC;
function tone(freqs, dur = .12, type = 'sine', gap = .1, vol = .15) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + i * gap;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
      g.gain.exponentialRampToValueAtTime(.001, t + dur + .15);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .2);
    });
  } catch (e) {}
}
const SND = {
  ok: () => tone([660, 880], .12), bad: () => tone([300, 220], .18, 'triangle', .15, .12),
  tap: () => tone([520], .05, 'sine', 0, .06), win: () => tone([523, 659, 784, 1047], .15, 'sine', .12),
  star: () => tone([880, 1175], .1, 'sine', .08)
};
let HUV = null;
function initVoice() { try { HUV = speechSynthesis.getVoices().find(v => /^hu/i.test(v.lang)) || null; } catch (e) {} }
if ('speechSynthesis' in window) { initVoice(); speechSynthesis.onvoiceschanged = initVoice; }
function speak(t) {
  if (!HUV) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.voice = HUV; u.lang = HUV.lang; u.rate = .9; speechSynthesis.speak(u);
}
function speakBtn(text) { return HUV ? `<button class="iconbtn" data-say="${esc(text)}" title="Felolvasás">🔊</button>` : ''; }
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say); });

// ---------- Konfetti ----------
const cv = $('#confetti'), cx = cv.getContext('2d');
let parts = [], anim = false;
function confetti(n = 60, x = innerWidth / 2, y = innerHeight / 2) {
  if (!anim) { cv.width = innerWidth; cv.height = innerHeight; }
  const cols = ['#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#06b6d4', '#ef4444'];
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * 360, s: 7 + Math.random() * 8, c: cols[i % 6], life: 80 + Math.random() * 50 });
  if (!anim) { anim = true; requestAnimationFrame(tick); }
}
function tick() {
  cx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => p.life-- > 0);
  for (const p of parts) {
    p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += 8;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r * Math.PI / 180); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore();
  }
  if (parts.length) requestAnimationFrame(tick); else { anim = false; cx.clearRect(0, 0, cv.width, cv.height); }
}
function floatPts(n, el) {
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const d = document.createElement('div'); d.className = 'floatpts'; d.textContent = '+' + n;
  d.style.left = (r.left + r.width / 2 - 30) + 'px'; d.style.top = (r.top - 10) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}

// ---------- Képernyők ----------
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); scrollTo(0, 0); }
function modal(html) { $('#modalcard').innerHTML = html; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
document.querySelectorAll('.back').forEach(b => b.onclick = home);

function home() {
  stopTimer();
  if (!S.name) { show('s-name'); setTimeout(() => $('#nameinput').focus(), 50); return; }
  const ri = rankOf(S.xp), r = RANKS[ri], nx = RANKS[ri + 1];
  $('#hello').textContent = `Szia, ${S.name}! ` + pick(['Kalandra fel!', 'Jó, hogy itt vagy!', 'Ma mit tanulunk?', 'Bori már várt rád!']);
  $('#h-streak').textContent = liveStreak() + ' nap';
  $('#h-xp').textContent = S.xp;
  $('#h-best').textContent = S.best + ' / ' + S.best3;
  $('#h-rank').textContent = r[2] + ' ' + r[1];
  $('#h-rankbar').style.width = nx ? ((S.xp - r[0]) / (nx[0] - r[0]) * 100) + '%' : '100%';
  $('#h-ranknext').textContent = nx ? `Még ${nx[0] - S.xp} pont, és ${nx[2]} ${nx[1]} leszel!` : 'Elérted a legmagasabb rangot!';
  const m = ITEMS.filter(it => lvl(it.id) >= 6).length, l = ITEMS.filter(it => lvl(it.id) >= 1 && lvl(it.id) < 6).length;
  $('#h-mbar').style.width = (m / ITEMS.length * 100) + '%';
  $('#h-mtext').textContent = `${m} / ${ITEMS.length} mester`;
  $('#h-ltext').textContent = `${l} tanulás alatt`;
  $('#sound-toggle').textContent = S.sound ? '🔔 Hang: be' : '🔕 Hang: ki';
  show('s-home');
}

$('#namego').onclick = () => {
  const n = $('#nameinput').value.trim();
  if (!n) { $('#nameinput').classList.add('shake'); setTimeout(() => $('#nameinput').classList.remove('shake'), 400); return; }
  S.name = n; save(); home();
};
$('#nameinput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#namego').click(); });
$('#sound-toggle').onclick = () => { S.sound = !S.sound; save(); home(); };
$('#go-adv').onclick = () => startRound(null);
$('#go-flash').onclick = () => {
  modal(`<div style="font-size:60px">⚡</div><h2>Milyen hosszú legyen?</h2>
    <div class="row"><button class="primary" id="m-f1">1 perc<br><small>rekord: ${S.best}</small></button><button class="primary" id="m-f3">3 perc<br><small>rekord: ${S.best3}</small></button></div>`);
  $('#m-f1').onclick = () => { closeModal(); startFlash(60); };
  $('#m-f3').onclick = () => { closeModal(); startFlash(180); };
};
$('#go-topics').onclick = showTopics;
$('#go-album').onclick = showAlbum;
$('#go-parent').onclick = showParent;
$('#r-home').onclick = home;
$('#q-home').onclick = () => {
  modal(`<div style="font-size:60px">🦉</div><h2>Biztosan kilépsz?</h2>
    <p style="font-size:19px">Az eddig gyűjtött pontjaid megmaradnak.</p>
    <div class="row"><button class="secondary" data-close>Maradok</button><button class="primary" id="m-quit">Kilépek</button></div>`);
  $('#m-quit').onclick = () => { G.abort = true; closeModal(); hideSheet(); home(); };
};

// ---------- Kör összeállítása ----------
let G = null;

function buildRound(cat) {
  const R = S.round, SIZE = 10;
  const pool = ITEMS.filter(it => !cat || it.cat === cat);
  const learning = pool.filter(it => lvl(it.id) >= 1 && lvl(it.id) < 6)
    .sort((a, b) => P(a.id).last - P(b.id).last || lvl(a.id) - lvl(b.id));
  const fresh = pool.filter(it => lvl(it.id) === 0);
  const review = shuffle(pool.filter(it => lvl(it.id) >= 6 && R - P(it.id).last >= 3)).sort((a, b) => P(a.id).last - P(b.id).last);
  // Új szólás csak akkor jön, ha nincs túl sok "félkész" – így nem terheljük túl
  let nNew = cat ? (learning.length < 6 ? 4 : learning.length < 10 ? 2 : 1)
                 : (learning.length < 10 ? 3 : learning.length < 20 ? 2 : learning.length < 30 ? 1 : 0);
  nNew = Math.min(nNew, fresh.length);
  const news = fresh.slice(0, nNew);
  const nRev = Math.min(review.length, 2);
  const qs = learning.slice(0, Math.max(0, SIZE - nNew - nRev)).concat(review.slice(0, nRev));
  const extra = shuffle(pool.filter(it => !qs.includes(it) && !news.includes(it) && lvl(it.id) >= 1));
  while (qs.length + news.length < SIZE && extra.length) qs.push(extra.pop());
  const more = fresh.slice(nNew);
  while (qs.length + news.length < SIZE && news.length < 5 && more.length) news.push(more.shift());

  const q = shuffle(qs).map(it => ({ it }));
  // Az új szólást előbb bemutatjuk, a kérdés pár lépéssel később jön (térközös ismétlés)
  news.forEach((it, i) => {
    const k = Math.min(i * 3, q.length);
    q.splice(k, 0, { it, intro: true });
    q.splice(Math.min(k + 2, q.length), 0, { it });
  });
  return q;
}

function newGame(mode, cat) {
  return { mode, cat, queue: [], pos: 0, score: 0, combo: 0, maxCombo: 0, firstTotal: 0, firstOk: 0, ups: {}, rank0: rankOf(S.xp), q: null, locked: false };
}

function startRound(cat) {
  G = newGame(cat ? 'topic' : 'adv', cat);
  G.queue = buildRound(cat);
  $('#q-timer').style.display = 'none';
  $('#r-again').onclick = () => startRound(cat);
  updateTop();
  show('s-quiz');
  nextQ();
}

function updateTop() {
  $('#q-score').textContent = G.score;
  const c = $('#q-combo');
  c.textContent = G.combo >= 3 ? `🔥 x${G.combo >= 6 ? 3 : 2}` : (G.combo ? '🔥' + G.combo : '');
  if (G.mode === 'flash') { $('#q-prog').style.width = Math.max(0, (G.end - Date.now()) / (G.secs * 10)) + '%'; return; }
  const qs = G.queue.filter(q => !q.intro).length;
  const done = G.queue.slice(0, G.pos).filter(q => !q.intro).length - (G.q && !G.q.intro && !G.answered ? 1 : 0);
  $('#q-prog').style.width = (qs ? done / qs * 100 : 0) + '%';
}

function nextQ() {
  hideSheet();
  if (G.mode === 'flash') return flashNext();
  if (G.pos >= G.queue.length) return endRound();
  G.q = G.queue[G.pos++]; G.answered = false; G.locked = false;
  updateTop();
  if (G.q.intro) renderIntro(G.q.it); else renderQ(G.q);
}

function kindFor(q) {
  if (q.retry) return 'fill';
  const l = lvl(q.it.id);
  if (l <= 1) return 'fill';
  if (l === 2) return 'meaning';
  if (l === 3) return 'reverse';
  if (l === 4) return 'order';
  if (l === 5) return 'spell';
  return pick(['order', 'spell', 'meaning', 'reverse']);
}

// ---------- Kérdések megjelenítése ----------
function tagHTML(it) { const c = CATS[it.cat]; return `<span class="tag" style="background:${c.c}">${c.e} ${c.n}</span>`; }
function gapHTML(it) { return esc(it.t).replace(/\{(.+?)\}/, '<span class="gap" id="gap">&nbsp;</span>'); }
function fillGap(it) { const g = $('#gap'); if (g) { g.textContent = it.ans; g.classList.add('filled'); } }

function renderIntro(it) {
  const p = P(it.id);
  if (p.l === 0) { p.l = 1; p.last = S.round; save(); }
  $('#q-body').innerHTML = `<div class="card intro">
    ${tagHTML(it)}
    <div class="new" style="margin-top:14px">✨ ÚJ SZÓLÁS! ✨</div>
    <div class="saying">${esc(it.full)}</div>
    <div class="meaning">💡 Jelentése: <b>${esc(it.mean)}</b></div>
    ${it.ex ? `<div class="explain">🔎 <b>Miért mondjuk így?</b> ${esc(it.ex)}</div>` : ''}
    <div class="hint" style="margin-bottom:18px">Olvasd el kétszer hangosan, és képzeld el! Pár kérdés múlva rákérdezek. 😉</div>
    <div class="row">${speakBtn(it.full + '. ' + it.mean + ' ' + it.ex)}<button class="primary" id="intro-ok">Megjegyeztem! ➜</button></div>
  </div>`;
  $('#intro-ok').onclick = () => { SND.tap(); nextQ(); };
}

function renderQ(q) {
  const kind = q.kind = kindFor(q), it = q.it;
  if (kind === 'fill') return renderFill(it);
  if (kind === 'meaning') return renderMeaning(it);
  if (kind === 'reverse') return renderReverse(it);
  if (kind === 'order') return renderOrder(it);
  return renderSpell(it);
}

function fillOptions(it) {
  const low = it.ans.toLowerCase();
  const own = [...new Set(ITEMS.filter(x => x.cat === it.cat).map(x => x.ans.toLowerCase()).concat(CATS[it.cat].extra || []))].filter(w => w !== low);
  let d = shuffle(own).slice(0, 3);
  if (d.length < 3) d = d.concat(shuffle([...new Set(ITEMS.map(x => x.ans.toLowerCase()))].filter(w => w !== low && !d.includes(w))).slice(0, 3 - d.length));
  return shuffle([low, ...d]);
}
function otherItems(it, n) {
  const same = shuffle(ITEMS.filter(x => x.cat === it.cat && x.id !== it.id && x.mean !== it.mean));
  const other = shuffle(ITEMS.filter(x => x.cat !== it.cat));
  return same.slice(0, Math.min(2, n)).concat(other).slice(0, n);
}

function choiceButtons(opts, correct, cls) {
  return `<div class="opts ${cls}">` + opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('') + '</div>';
}
function wireChoices(opts, correctIdx, onDone) {
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (G.locked) return; G.locked = true;
    const i = +b.dataset.i, ok = i === correctIdx;
    document.querySelectorAll('.opt').forEach((x, j) => { if (j === correctIdx) x.classList.add('ok'); else if (j === i) x.classList.add('bad'); else x.classList.add('dim'); });
    if (onDone) onDone(ok);
    setTimeout(() => answer(ok ? 'ok' : 'bad', b), ok ? 250 : 500);
  });
}

function renderFill(it) {
  const opts = fillOptions(it);
  $('#q-body').innerHTML = `<div class="card">${tagHTML(it)}
    <div class="qtitle">Melyik szó hiányzik?</div>
    <div class="saying">${gapHTML(it)}</div>
    <div class="hint">💡 <b>Jelentése:</b> ${esc(it.mean)}</div>
    ${choiceButtons(opts, 0, 'g2')}</div>`;
  wireChoices(opts, opts.indexOf(it.ans.toLowerCase()), () => fillGap(it));
}

function renderMeaning(it) {
  const opts = shuffle([it, ...otherItems(it, 3)]);
  $('#q-body').innerHTML = `<div class="card">${tagHTML(it)}
    <div class="qtitle">Mit jelent ez a szólás?</div>
    <div class="row" style="justify-content:flex-start;flex-wrap:nowrap"><div class="saying" style="flex:1;min-width:0">${esc(it.full)}</div>${speakBtn(it.full)}</div>
    ${choiceButtons(opts.map(o => o.mean), 0, 'long')}</div>`;
  wireChoices(opts, opts.indexOf(it));
}

function renderReverse(it) {
  const opts = shuffle([it, ...otherItems(it, 3)]);
  $('#q-body').innerHTML = `<div class="card">${tagHTML(it)}
    <div class="qtitle">Melyik szólás jelenti ezt?</div>
    <div class="saying" style="font-size:30px">„${esc(it.mean)}”</div>
    ${choiceButtons(opts.map(o => o.full), 0, 'long')}</div>`;
  wireChoices(opts, opts.indexOf(it));
}

// Szórend-kirakó: a teljes szólást kell összerakni szavakból
function renderOrder(it) {
  const words = it.full.split(/\s+/);
  let tiles = words.map((w, i) => ({ w, i }));
  if (words.length > 1) { do { tiles = shuffle(tiles); } while (tiles.every((t, k) => t.w === words[k])); }
  let placed = [], mistakes = 0;
  $('#q-body').innerHTML = `<div class="card">${tagHTML(it)}
    <div class="qtitle">Rakd ki a szólást a szavakból! 🧱</div>
    <div class="hint">💡 <b>Jelentése:</b> ${esc(it.mean)}</div>
    <div class="slotrow" id="slots"></div>
    <div class="tiles" id="pool">${tiles.map((t, k) => `<button class="tile" data-k="${k}">${esc(t.w)}</button>`).join('')}</div></div>`;
  const pool = $('#pool'), slots = $('#slots');
  function draw() {
    slots.innerHTML = placed.map((k, j) => `<button class="tile placed" data-j="${j}">${esc(tiles[k].w)}</button>`).join('');
    pool.querySelectorAll('.tile').forEach(b => { b.classList.toggle('used', placed.includes(+b.dataset.k)); b.classList.remove('hl'); });
    if (mistakes >= 2 && placed.length < words.length) {
      const nx = [...pool.querySelectorAll('.tile:not(.used)')].find(b => tiles[+b.dataset.k].w === words[placed.length]);
      if (nx) nx.classList.add('hl');
    }
  }
  pool.onclick = e => {
    const b = e.target.closest('.tile'); if (!b || G.locked || b.classList.contains('used')) return;
    SND.tap(); placed.push(+b.dataset.k); draw();
    if (placed.length === words.length) check();
  };
  slots.onclick = e => {
    const b = e.target.closest('.tile'); if (!b || G.locked) return;
    placed.splice(+b.dataset.j); SND.tap(); draw();
  };
  function check() {
    const wrongAt = placed.findIndex((k, j) => tiles[k].w !== words[j]);
    if (wrongAt < 0) { G.locked = true; return answer(mistakes === 0 ? 'ok' : mistakes <= 2 ? 'part' : 'bad', slots); }
    mistakes++; G.locked = true; SND.bad();
    slots.querySelectorAll('.tile').forEach((b, j) => { if (j >= wrongAt) b.classList.add('wrong'); });
    slots.classList.add('shake');
    setTimeout(() => { slots.classList.remove('shake'); placed = placed.slice(0, wrongAt); G.locked = false; draw(); }, 900);
  }
  draw();
}

// Betűkirakó: a hiányzó szót kell betűnként kirakni (helyesírás)
function renderSpell(it) {
  const word = [...it.ans.toLocaleUpperCase('hu')];
  const pool = 'AÁEÉIÍOÓÖŐUÚÜŰKLMNRSTZ'.split('').filter(c => !word.includes(c));
  const decoys = shuffle(pool).slice(0, word.length > 8 ? 2 : 3);
  const tiles = shuffle(word.concat(decoys));
  let idx = 0, mistakes = 0;
  $('#q-body').innerHTML = `<div class="card">${tagHTML(it)}
    <div class="qtitle">Írd be a hiányzó szót betűnként! ✍️</div>
    <div class="saying">${gapHTML(it)}</div>
    <div class="hint">💡 <b>Jelentése:</b> ${esc(it.mean)}</div>
    <div class="letters" id="slots">${word.map((_, i) => `<div class="lslot${i === 0 ? ' cur' : ''}"></div>`).join('')}</div>
    <div class="tiles" id="pool">${tiles.map((c, k) => `<button class="tile" data-k="${k}">${c}</button>`).join('')}</div></div>`;
  const slots = $('#slots').children, poolEl = $('#pool');
  function hint() {
    poolEl.querySelectorAll('.tile').forEach(b => b.classList.remove('hl'));
    if (mistakes >= 2) { const b = [...poolEl.querySelectorAll('.tile:not(.used)')].find(b => tiles[+b.dataset.k] === word[idx]); if (b) b.classList.add('hl'); }
  }
  poolEl.onclick = e => {
    const b = e.target.closest('.tile'); if (!b || G.locked || b.classList.contains('used')) return;
    if (tiles[+b.dataset.k] === word[idx]) {
      SND.tap(); b.classList.add('used');
      slots[idx].textContent = word[idx]; slots[idx].classList.add('f'); slots[idx].classList.remove('cur');
      idx++;
      $('#gap').textContent = word.slice(0, idx).join('');
      if (idx === word.length) { G.locked = true; fillGap(it); return answer(mistakes === 0 ? 'ok' : mistakes <= 2 ? 'part' : 'bad', $('#slots')); }
      slots[idx].classList.add('cur');
    } else {
      mistakes++; SND.bad(); b.classList.add('wrong', 'shake');
      setTimeout(() => b.classList.remove('wrong', 'shake'), 450);
    }
    hint();
  };
}

// ---------- Válasz kiértékelése ----------
function answer(res, el) {
  if (G.abort) return;
  if (G.mode === 'flash') return flashAnswer(res, el);
  const q = G.q, it = q.it, p = P(it.id), first = !q.retry, before = p.l;
  G.answered = true;
  if (first) G.firstTotal++;
  if (res === 'ok') {
    G.combo++;
    if (first) { G.firstOk++; p.r++; if (p.l < 6) p.l++; }
  } else if (res === 'part') {
    G.combo = 0; if (first) G.firstOk += .5;
  } else {
    G.combo = 0; p.w++;
    if (first) {
      p.l = p.l >= 6 ? 4 : Math.max(1, p.l - 1);
      G.queue.splice(Math.min(G.pos + 3, G.queue.length), 0, { it, retry: true });
    }
  }
  p.last = S.round;
  G.ups[it.id] = [G.ups[it.id] ? G.ups[it.id][0] : before, p.l];
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  let pts = 0;
  if (res !== 'bad') {
    pts = q.retry ? 5 : KIND_PTS[q.kind];
    if (res === 'part') pts = Math.round(pts / 2);
    pts *= G.combo >= 6 ? 3 : G.combo >= 3 ? 2 : 1;
  }
  G.score += pts; S.xp += pts;
  save(); updateTop();
  if (G.combo === 3 || G.combo === 6) { const c = $('#q-combo'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  if (res === 'ok') {
    SND.ok(); floatPts(pts, el);
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    confetti(p.l === 6 && before < 6 ? 120 : 35, r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top : innerHeight / 2);
  } else if (res === 'part') { SND.star(); floatPts(pts, el); }
  else SND.bad();
  showSheet(res, it, p.l === 6 && before < 6);
}

function showSheet(res, it, mastered) {
  const sh = $('#sheet');
  sh.className = 'sheet on ' + res;
  $('#sh-face').textContent = res === 'ok' ? (mastered ? '🏆' : pick(['🦉', '🥳', '🤩', '😄'])) : res === 'part' ? '🙂' : '🤗';
  $('#sh-head').textContent = res === 'ok' ? (mastered ? 'Ezt már mesterien tudod! ⭐' : pick(PRAISE))
    : res === 'part' ? 'Megvan, kis segítséggel! 👍' : pick(OOPS) + ' Nézd meg jól, hamarosan újra jön:';
  $('#sh-full').innerHTML = esc(it.t).replace(/\{(.+?)\}/, '<mark>$1</mark>');
  $('#sh-mean').textContent = '💡 Jelentése: ' + it.mean;
  $('#sh-ex').textContent = it.ex ? '🔎 Miért mondjuk így? ' + it.ex : '';
  $('#sh-speak').style.display = HUV ? '' : 'none';
  $('#sh-speak').dataset.say = it.full + '. ' + it.mean + ' ' + it.ex;
  setTimeout(() => $('#sh-next').focus(), 50);
}
function hideSheet() { $('#sheet').className = 'sheet'; }
$('#sh-next').onclick = () => { SND.tap(); nextQ(); };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#sheet').classList.contains('on')) { e.preventDefault(); nextQ(); } });

// ---------- Villámkör ----------
let timerId = null;
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
function startFlash(secs = 60) {
  G = newGame('flash'); G.secs = secs;
  let pool = ITEMS.filter(it => lvl(it.id) >= 1);
  if (pool.length < 8) pool = pool.concat(ITEMS.filter(it => lvl(it.id) === 0).slice(0, 8 - pool.length));
  G.pool = pool; G.end = Date.now() + secs * 1000;
  $('#q-timer').style.display = '';
  $('#r-again').onclick = () => startFlash(secs);
  show('s-quiz');
  stopTimer();
  timerId = setInterval(() => {
    const left = Math.ceil((G.end - Date.now()) / 1000);
    $('#q-timer').textContent = fmtLeft(Math.max(0, left));
    updateTop();
    if (left <= 0) { stopTimer(); if (!G.locked) endRound(); else G.timeUp = true; }
  }, 200);
  $('#q-timer').textContent = fmtLeft(secs);
  flashNext();
}
function fmtLeft(t) { return t >= 60 ? Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') : t + 's'; }
function flashNext() {
  if (G.abort) return;
  if (G.timeUp || Date.now() >= G.end) return endRound();
  let it; do { it = pick(G.pool); } while (G.pool.length > 1 && G.q && it === G.q.it);
  const r = Math.random();
  G.q = { it, kind: G.secs > 60 ? (r < .45 ? 'fill' : r < .8 ? 'meaning' : 'reverse') : (r < .55 ? 'fill' : 'meaning') }; G.locked = false;
  updateTop();
  if (G.q.kind === 'fill') renderFill(it); else if (G.q.kind === 'reverse') renderReverse(it); else renderMeaning(it);
}
function flashAnswer(res, el) {
  const p = P(G.q.it.id);
  G.firstTotal++;
  if (res === 'ok') {
    G.firstOk++; G.combo++; p.r++;
    const pts = 10 * (G.combo >= 6 ? 3 : G.combo >= 3 ? 2 : 1);
    G.score += pts; S.xp += pts; SND.ok(); floatPts(pts, el);
  } else { G.combo = 0; p.w++; if (p.l >= 6) p.l = 5; SND.bad(); }
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  save(); updateTop();
  setTimeout(flashNext, res === 'ok' ? 450 : 1600);
}

// ---------- Kör vége ----------
function endRound() {
  stopTimer(); hideSheet();
  S.round++; bumpDay();
  const flash = G.mode === 'flash';
  let newBest = false;
  const bk = flash && G.secs > 60 ? 'best3' : 'best';
  if (flash && G.score > S[bk]) { S[bk] = G.score; newBest = true; }
  save();
  const acc = G.firstTotal ? G.firstOk / G.firstTotal : 0;
  const k = flash ? G.secs / 60 : 1;
  const stars = flash ? (G.score >= 200 * k ? 3 : G.score >= 100 * k ? 2 : 1) : (acc >= .9 ? 3 : acc >= .7 ? 2 : 1);
  $('#r-title').textContent = (flash && newBest ? 'Új rekord! ' : '') + (stars === 3 ? `Fantasztikus, ${S.name}! 🎉` : stars === 2 ? `Szép munka, ${S.name}!` : `Jó úton jársz, ${S.name}!`);
  $('#r-owl').textContent = stars === 3 ? '🏆' : stars === 2 ? '🦉' : '💪';
  $('#r-pts').textContent = G.score;
  $('#r-acc').textContent = Math.round(acc * 100) + '%';
  $('#r-combo').textContent = G.maxCombo;
  const ups = Object.entries(G.ups).filter(([, [a, b]]) => b > a).sort((x, y) => y[1][1] - x[1][1]);
  $('#r-ups').innerHTML = ups.length ? '<div style="font-size:20px;font-weight:800;text-align:center">Ezek szintet léptek:</div>' + ups.slice(0, 6).map(([id, [, b]]) =>
    `<div class="li"><span style="font-size:30px">${LV_ICON[b]}</span><span>${esc(ITEMS[id].full)}${b === 6 ? ' <b style="color:#b45309">– MESTER! ⭐</b>' : ''}</span></div>`).join('')
    : (flash ? `<div style="text-align:center;font-size:19px">Rekordod (${G.secs / 60} perc): ${S[bk]} pont</div>` : '');
  show('s-result');
  const sp = $('#r-stars').children;
  [...sp].forEach(s => s.classList.remove('on'));
  for (let i = 0; i < stars; i++) setTimeout(() => { sp[i].classList.add('on'); SND.star(); }, 400 + i * 450);
  setTimeout(() => { if (stars === 3) { SND.win(); confetti(160, innerWidth / 2, innerHeight / 3); } }, 400 + stars * 450);
  const r1 = rankOf(S.xp);
  if (r1 > G.rank0) setTimeout(() => {
    SND.win(); confetti(200, innerWidth / 2, innerHeight / 2);
    modal(`<div style="font-size:90px">${RANKS[r1][2]}</div><h2>Új rang!</h2><p style="font-size:24px">Mostantól te vagy:<br><b>${RANKS[r1][1]}</b></p><button class="primary" data-close>Hurrá! 🎉</button>`);
  }, 1900);
}

// ---------- Témák ----------
function catStats(cat) {
  const its = ITEMS.filter(it => it.cat === cat);
  return { n: its.length, m: its.filter(it => lvl(it.id) >= 6).length, l: its.filter(it => lvl(it.id) >= 1 && lvl(it.id) < 6).length, sum: its.reduce((a, it) => a + lvl(it.id), 0) };
}
function showTopics() {
  $('#topiclist').innerHTML = Object.entries(CATS).map(([k, c]) => {
    const s = catStats(k);
    return `<button class="topic" data-cat="${k}"><div class="e">${c.e}</div><div class="n">${c.n}</div>
      <div class="bar"><i style="width:${s.sum / (s.n * 6) * 100}%;background:${c.c}"></i></div>
      <div class="c">⭐ ${s.m} / ${s.n} mester${s.l ? ` · ${s.l} tanulás alatt` : ''}</div></button>`;
  }).join('');
  $('#topiclist').onclick = e => { const b = e.target.closest('.topic'); if (b) startRound(b.dataset.cat); };
  show('s-topics');
}

// ---------- Album ----------
function showAlbum() {
  $('#albumlist').innerHTML = Object.entries(CATS).map(([k, c]) => {
    const s = catStats(k);
    return `<div class="albumcat"><span>${c.e}</span>${c.n} <span style="font-size:16px;color:var(--soft)">⭐ ${s.m}/${s.n}</span></div><div class="chips">` +
      ITEMS.filter(it => it.cat === k).map(it => { const l = lvl(it.id); return `<button class="chip l${l}" data-id="${it.id}"><span class="lv">${LV_ICON[l]}</span>${esc(it.full)}</button>`; }).join('') + '</div>';
  }).join('');
  $('#albumlist').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const it = ITEMS[+b.dataset.id], l = lvl(it.id);
    modal(`${tagHTML(it)}<div class="saying" style="margin:18px 0">${esc(it.full)}</div>
      <div class="meaning" style="font-size:22px;background:#fef9c3;border-radius:18px;padding:14px">💡 ${esc(it.mean)}</div>
      ${it.ex ? `<div class="explain">🔎 <b>Miért mondjuk így?</b> ${esc(it.ex)}</div>` : ''}
      <p style="font-size:18px;color:var(--soft)">${LV_ICON[l]} ${l === 0 ? 'Még nem tanultad' : l >= 6 ? 'Mester szint!' : `${l}. szint az 5-ből`}</p>
      <div class="row">${speakBtn(it.full + '. ' + it.mean + ' ' + it.ex)}<button class="primary" data-close>Bezár</button></div>`);
  };
  show('s-album');
}

// ---------- Szülői sarok ----------
function showParent() {
  const rows = Object.entries(CATS).map(([k, c]) => { const s = catStats(k); return `<tr><td>${c.e} ${c.n}</td><td>${s.m} / ${s.n}</td><td>${s.l}</td><td>${s.n - s.m - s.l}</td></tr>`; }).join('');
  const hard = ITEMS.filter(it => S.items[it.id] && S.items[it.id].w > 0).sort((a, b) => S.items[b.id].w - S.items[a.id].w).slice(0, 12);
  $('#parentstats').innerHTML = `<div class="ptext">Lejátszott körök: <b>${S.round}</b> · Összes pont: <b>${S.xp}</b> · Napi sorozat: <b>${liveStreak()} nap</b></div>
    <table class="ptable"><tr><th>Téma</th><th>⭐ Mester</th><th>Tanulás alatt</th><th>Még nem látta</th></tr>${rows}</table>
    <h3 style="font-size:22px;margin:20px 0 8px">Legtöbbször elrontott szólások</h3>
    ${hard.length ? '<table class="ptable"><tr><th>Szólás</th><th>Hibák</th><th>Jó válasz</th><th>Szint</th></tr>' + hard.map(it => { const p = S.items[it.id]; return `<tr><td>${esc(it.full)}<br><small style="color:var(--soft)">${esc(it.mean)}</small></td><td>${p.w}</td><td>${p.r}</td><td>${LV_ICON[p.l]}</td></tr>`; }).join('') + '</table>'
      : '<div class="ptext">Még nincs hiba – vagy még nem játszott. 🙂</div>'}`;
  show('s-parent');
}
$('#p-reset').onclick = () => {
  modal(`<div style="font-size:60px">⚠️</div><h2>Biztosan törlöd a haladást?</h2><p style="font-size:18px">Minden pont, szint és sorozat elvész.</p>
    <div class="row"><button class="secondary" data-close>Mégse</button><button class="primary" id="m-reset" style="background:#dc2626;box-shadow:0 6px 0 #991b1b">Törlés</button></div>`);
  $('#m-reset').onclick = () => { const n = S.name; S = blank(); S.name = n; save(); closeModal(); showParent(); };
};
$('#p-rename').onclick = () => {
  modal(`<h2>Új név</h2><input id="m-name" maxlength="16" value="${esc(S.name)}" style="font:inherit;font-size:26px;padding:12px;border-radius:16px;border:3px solid var(--line);width:100%;text-align:center;margin-bottom:16px">
    <div class="row"><button class="secondary" data-close>Mégse</button><button class="primary" id="m-saveName">Mentés</button></div>`);
  $('#m-saveName').onclick = () => { const v = $('#m-name').value.trim(); if (v) { S.name = v; save(); } closeModal(); };
};

home();
