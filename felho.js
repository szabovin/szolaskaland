'use strict';
// Szóláskaland – felhős mentés és családi megosztás (Firebase).
// A játék továbbra is a böngészőbe ment (localStorage); ha egy szülő belép, a játékosok a családhoz
// kerülnek a felhőbe, és minden eszközön (minden családtagnál) ugyanaz a haladás látszik.
// Firestore szerkezet: families/{családId} = { members: [e-mailek] }, families/{id}/players/{játékosId} = { name, g, xp, json, upd, by }
// A biztonsági szabályok (Firebase konzol → Firestore → Rules) a README-ben vannak.

const FB_CONFIG = {
  apiKey: 'AIzaSyCOPDeLOSBu6HS-1XjJyw7x1EeWsRAudP8',
  authDomain: 'szolaskaland.firebaseapp.com',
  projectId: 'szolaskaland',
  storageBucket: 'szolaskaland.firebasestorage.app',
  messagingSenderId: '728119141050',
  appId: '1:728119141050:web:b72d4f3a72a3725c851883'
};
const FB_VER = '10.14.1';
const EMAIL_KEY = 'szolaskaland_login_email';

window.Cloud = (() => {
  const online = /^https?:$/.test(location.protocol);
  // állapot: off (helyi fájlként fut) | loading | out (nincs belépve) | nofamily | in | error
  let state = online ? 'loading' : 'off', errMsg = '', note = '';
  let auth = null, db = null, user = null, fam = null, unsubF = null, unsubP = null, firstSnap = true;
  const queue = new Set(); let timer = null, syncing = false;

  const email = () => (user && user.email ? user.email.toLowerCase() : '');
  const famRef = () => db.collection('families').doc(fam.id);
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const H = s => esc(String(s));

  // ---------- Indulás ----------
  async function init() {
    if (!online) return paint();
    try {
      for (const m of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}-compat.js`);
      firebase.initializeApp(FB_CONFIG);
      auth = firebase.auth(); auth.languageCode = 'hu';
      db = firebase.firestore();
      // Fejlesztéshez: helyi Firebase-emulátor (csak localhoston, ?emu=1 esetén)
      if (location.hostname === 'localhost' && /[?&]emu=1/.test(location.search)) { auth.useEmulator('http://localhost:9099'); db.useEmulator('localhost', 8080); }
      await finishEmailLink();
      auth.onAuthStateChanged(u => { user = u; if (u) connect(); else { detach(); state = 'out'; paint(); } });
    } catch (e) { fail(e); }
  }
  function fail(e) { console.error(e); state = 'error'; errMsg = hunError(e); paint(); }

  // E-mailes link: a levélben kapott linkre kattintva ide tér vissza az oldal
  async function finishEmailLink() {
    if (!auth.isSignInWithEmailLink(location.href)) return;
    let em = null;
    try { em = localStorage.getItem(EMAIL_KEY); } catch (e) {}
    if (!em) em = prompt('A belépés befejezéséhez add meg újra az e-mail-címedet:');
    const link = location.href;
    history.replaceState(null, '', location.pathname);   // a kódot eltüntetjük a címsorból
    if (!em) return;
    try { await auth.signInWithEmailLink(em.trim(), link); }
    catch (e) { note = '❌ ' + hunError(e); }
    try { localStorage.removeItem(EMAIL_KEY); } catch (e) {}
  }

  // ---------- Család ----------
  async function connect() {
    state = 'loading'; paint();
    try {
      const q = await db.collection('families').where('members', 'array-contains', email()).limit(1).get();
      if (q.empty) { state = 'nofamily'; paint(); return; }
      attach(q.docs[0].id, q.docs[0].data());
    } catch (e) { fail(e); }
  }
  function attach(id, data) {
    detach();
    fam = { id, members: data.members || [] };
    state = 'in'; firstSnap = true; paint();
    unsubF = famRef().onSnapshot(d => {
      const m = d.exists ? (d.data().members || []) : [];
      if (!m.includes(email())) { detach(); state = 'nofamily'; paint(); return; }
      fam.members = m; paint();
    }, fail);
    unsubP = famRef().collection('players').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') dropLocal(ch.doc.id);
        else if (!ch.doc.metadata.hasPendingWrites) mergeIn(ch.doc.id, ch.doc.data());
      });
      if (firstSnap) { firstSnap = false; profiles().forEach(p => { if (!p.s.pid) queue.add(p.k); }); flushSoon(); }
      refresh();
    }, fail);
  }
  function detach() { if (unsubF) unsubF(); if (unsubP) unsubP(); unsubF = unsubP = null; fam = null; }

  async function createFamily() {
    try {
      const ref = await db.collection('families').add({ members: [email()], by: email(), created: firebase.firestore.FieldValue.serverTimestamp() });
      attach(ref.id, { members: [email()] });
    } catch (e) { fail(e); }
  }
  async function addMember(em) {
    em = em.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { note = '❌ Ez nem tűnik e-mail-címnek.'; return paint(); }
    try { await famRef().update({ members: firebase.firestore.FieldValue.arrayUnion(em) }); note = `✅ ${em} hozzáadva. Ha belép ezzel a címmel, látni fogja a családot.`; }
    catch (e) { note = '❌ ' + hunError(e); }
    paint();
  }
  async function removeMember(em) {
    if (!confirm(em === email() ? 'Biztosan kilépsz a családból? Az ezen az eszközön lévő adatok megmaradnak.' : `Eltávolítod ${em} címet a családból?`)) return;
    try { await famRef().update({ members: firebase.firestore.FieldValue.arrayRemove(em) }); }
    catch (e) { note = '❌ ' + hunError(e); paint(); }
  }

  // ---------- Szinkron ----------
  // Két mentés összefésülése: szólásonként azt tartjuk meg, amelyikben több válasz van (az a frissebb tudás)
  function dayNum(d) { if (!d) return 0; const [y, m, n] = d.split('-').map(Number); return new Date(y, m - 1, n).getTime(); }
  function mergeState(loc, rem) {
    if (!loc) return Object.assign(blank(), rem);
    const newer = (rem.upd || 0) > (loc.upd || 0) ? rem : loc;
    const m = Object.assign(blank(), newer);
    ['xp', 'round', 'best', 'best3'].forEach(f => { m[f] = Math.max(loc[f] || 0, rem[f] || 0); });
    const sd = dayNum(loc.lastDay) >= dayNum(rem.lastDay) ? loc : rem; m.streak = sd.streak; m.lastDay = sd.lastDay;
    m.sound = loc.sound;   // a hang eszközönkénti beállítás
    const items = {}, ids = [...new Set(Object.keys(loc.items || {}).concat(Object.keys(rem.items || {})))].sort((a, b) => a - b);
    ids.forEach(id => {
      const a = (loc.items || {})[id], b = (rem.items || {})[id];
      if (!a || !b) { items[id] = a || b; return; }
      const sa = a.r + a.w + (a.v || 0), sb = b.r + b.w + (b.v || 0);
      items[id] = sa !== sb ? (sa > sb ? a : b) : a.last !== b.last ? (a.last > b.last ? a : b) : (a.l >= b.l ? a : b);
    });
    m.items = items; m.upd = Math.max(loc.upd || 0, rem.upd || 0);
    return m;
  }
  const core = s => JSON.stringify(Object.assign({}, s, { pid: 0, upd: 0, sound: 0 }));

  function mergeIn(pid, data) {
    let rem; try { rem = JSON.parse(data.json); } catch (e) { return; }
    let k = U.keys.find(k => { const s = loadKey(k); return s && s.pid === pid; });
    if (!k) k = U.keys.find(k => { const s = loadKey(k); return s && !s.pid && s.name && nameKey(s.name) === nameKey(rem.name || ''); });
    if (!k) { k = 'szolaskaland_u' + pid; U.keys.push(k); saveUsers(); }
    const loc = k === KEY ? S : loadKey(k);
    const m = mergeState(loc, rem); m.pid = pid;
    if (k === KEY) { Object.keys(S).forEach(f => delete S[f]); Object.assign(S, m); }
    try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) {}
    if (core(m) !== core(rem)) { queue.add(k); flushSoon(); }   // nálunk újabb is volt benne → visszaküldjük
  }
  function dropLocal(pid) {
    const k = U.keys.find(k => { const s = loadKey(k); return s && s.pid === pid; });
    if (!k) return;
    try { localStorage.removeItem(k); } catch (e) {}
    U.keys = U.keys.filter(x => x !== k);
    if (k === KEY) { U.active = KEY = null; S = blank(); }
    saveUsers();
  }

  function flushSoon(ms = 1500) { clearTimeout(timer); timer = setTimeout(flush, ms); }
  async function flush() {
    if (state !== 'in' || !queue.size) return;
    const keys = [...queue]; queue.clear(); syncing = true; paint();
    try {
      for (const k of keys) {
        const s = k === KEY ? S : loadKey(k);
        if (!s || !s.name || !U.keys.includes(k)) continue;
        const col = famRef().collection('players');
        if (!s.pid) { s.pid = col.doc().id; try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) {} }
        await col.doc(s.pid).set({ name: s.name, g: s.g || '', xp: s.xp || 0, upd: s.upd || Date.now(), by: email(), json: JSON.stringify(Object.assign({}, s, { pid: undefined })) });
      }
      errMsg = '';
    } catch (e) { keys.forEach(k => queue.add(k)); console.error(e); errMsg = hunError(e); flushSoon(15000); }
    syncing = false; paint();
  }
  // Ha bezárják/elrejtik a lapot, azonnal küldjük, ami még vár
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  // Más eszköz módosított valamit → a látható képernyő frissítése (játék közben nem zavarunk)
  function refresh() {
    const on = id => document.getElementById(id).classList.contains('on');
    if (on('s-home')) home();
    else if (on('s-parent')) { if (S.name) showParent(); else showProfiles(); }
    else if (on('s-name') && !$('#nameinput').value) {   // ha már gépel, nem zavarjuk
      const open = $('#clouddet').open; showProfiles(); $('#clouddet').open = open;
    }
  }

  // ---------- Belépés ----------
  async function google() {
    note = '';
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') { note = '❌ ' + hunError(e); paint(); } }
  }
  async function sendLink(em) {
    em = em.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { note = '❌ Ez nem tűnik e-mail-címnek.'; return paint(); }
    try {
      await auth.sendSignInLinkToEmail(em, { url: location.origin + location.pathname, handleCodeInApp: true });
      try { localStorage.setItem(EMAIL_KEY, em); } catch (e) {}
      note = `📧 Elküldtem a belépő linket ide: ${em}. Nyisd meg a levelet ezen az eszközön, és kattints a linkre. (Ha nem jön, nézd meg a spam mappát is.)`;
    } catch (e) { note = '❌ ' + hunError(e); }
    paint();
  }
  async function logout() {
    if (!confirm('Kijelentkezel? Az ezen az eszközön lévő játékosok és haladásuk megmaradnak, csak nem szinkronizálódnak tovább.')) return;
    await flush(); await auth.signOut();
  }

  function hunError(e) {
    const c = (e && e.code) || '';
    if (c.includes('permission-denied')) return 'Nincs jogosultság (ellenőrizd a Firestore szabályokat).';
    if (c.includes('unavailable') || c.includes('network')) return 'Nincs internetkapcsolat – később újrapróbálom.';
    if (c.includes('invalid-action-code') || c.includes('expired-action-code')) return 'A belépő link lejárt vagy már felhasználták. Kérj újat!';
    if (c.includes('invalid-email')) return 'Hibás e-mail-cím.';
    if (c.includes('unauthorized-domain')) return 'Ez a webcím nincs engedélyezve a Firebase-ben (Authentication → Settings → Authorized domains).';
    if (c.includes('operation-not-allowed')) return 'Ez a belépési mód nincs bekapcsolva a Firebase-ben (Authentication → Sign-in method).';
    if (c.includes('popup-blocked')) return 'A böngésző letiltotta a felugró ablakot. Engedélyezd, vagy lépj be e-mailes linkkel.';
    if (c.includes('not-found') || /firestore/i.test(e && e.message || '') && /not (been used|exist)/i.test(e.message)) return 'Az adatbázis még nincs létrehozva a Firebase-ben (Firestore Database).';
    return (e && e.message) || 'Ismeretlen hiba.';
  }

  // ---------- Megjelenítés ----------
  function paint() {
    const btn = $('#cloud-btn');
    btn.style.display = state === 'off' ? 'none' : '';
    btn.textContent = state === 'in' ? '☁️ Szinkronizálva' : state === 'loading' ? '☁️ …' : state === 'nofamily' ? '☁️ Család beállítása' : state === 'error' ? '☁️ Hiba' : '☁️ Belépés';
    const n = note ? `<p>${H(note)}</p>` : '';
    let h = '<h3>☁️ Felhős mentés és család</h3>';
    if (state === 'off') {
      h += `<div class="muted">A belépés és a több eszközös mentés az online változatban működik:<br><b>https://szabovin.github.io/szolaskaland/</b><br>Itt (helyi fájlként) a haladás csak ezen a gépen van elmentve.</div>`;
    } else if (state === 'loading') {
      h += `<div class="muted">Kapcsolódás…</div>`;
    } else if (state === 'error') {
      h += `<div class="err">Nem sikerült kapcsolódni: ${H(errMsg)}</div><div class="crow"><button class="secondary" data-c="retry">🔄 Újrapróbálom</button>${user ? '<button class="secondary" data-c="logout">Kijelentkezés</button>' : ''}</div>`;
    } else if (state === 'out') {
      h += `<div class="muted">Lépj be (szülőként), és a játékosok haladása minden eszközön meglesz – a másik szülő is láthatja a saját telefonján.</div>
        <div class="crow"><button class="gbtn2" data-c="google">🇬 Belépés Google-fiókkal</button></div>
        <div class="crow"><input class="c-email" type="email" placeholder="vagy e-mail-cím a belépő linkhez" autocomplete="email"><button class="secondary" data-c="link">📧 Link küldése</button></div>${n}`;
    } else if (state === 'nofamily') {
      const loc = profiles().map(p => p.s.name).join(', ');
      h += `<div>Belépve: <b>${H(email())}</b></div>
        <p>Ez a cím még nem tartozik családhoz.</p>
        <div class="muted">• Ha a másik szülő <b>már létrehozta</b> a családot: kérd meg, hogy itt, a Szülői sarokban adja hozzá a címedet, utána nyomd meg az „Újra ellenőrzöm” gombot.<br>
        • Ha te vagy az első: hozd létre a családot${loc ? ` – az ezen az eszközön lévő játékosok (<b>${H(loc)}</b>) felkerülnek a felhőbe` : ''}.</div>
        <div class="crow"><button class="primary" style="font-size:18px;padding:12px 18px" data-c="create">👨‍👩‍👧 Család létrehozása</button><button class="secondary" data-c="retry">🔄 Újra ellenőrzöm</button><button class="secondary" data-c="logout">Kijelentkezés</button></div>${n}`;
    } else {
      h += `<div>Belépve: <b>${H(email())}</b> · ${syncing ? 'mentés…' : errMsg ? `<span class="err">${H(errMsg)}</span>` : '<span class="ok">minden szinkronban ✓</span>'}</div>
        <div style="margin-top:10px"><b>A család tagjai</b> <span class="muted">(ők látják és folytathatják a játékosok haladását)</span></div>
        <div class="members">${fam.members.map(m => `<span>👤 ${H(m)}<button data-rm="${H(m)}" title="Eltávolítás">✖</button></span>`).join('')}</div>
        <div class="crow"><input class="c-member" type="email" placeholder="Másik szülő e-mail-címe"><button class="secondary" data-c="add">➕ Hozzáadás</button></div>${n}
        <div class="crow"><button class="secondary" data-c="logout">Kijelentkezés</button></div>`;
    }
    document.querySelectorAll('.cloudpanel').forEach(el => { el.innerHTML = h; });
    const sum = $('#cloudsum');
    if (sum) sum.textContent = state === 'in' ? `☁️ Családi mentés bekapcsolva (${email()})` : '👨‍👩‍👧 Szülőknek: belépés a családi mentéshez';
    const det = $('#clouddet'); if (det) det.style.display = state === 'off' ? 'none' : '';
  }

  // A panel két helyen is megjelenik (Szülői sarok, játékosválasztó) – mindig a saját panelje mezőjét olvassuk
  document.addEventListener('click', e => {
    const panel = e.target.closest('.cloudpanel'); if (!panel) return;
    const rm = e.target.closest('[data-rm]'); if (rm) return removeMember(rm.dataset.rm);
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = b.dataset.c, inp = sel => panel.querySelector(sel).value;
    if (c === 'google') google();
    else if (c === 'link') sendLink(inp('.c-email'));
    else if (c === 'logout') logout();
    else if (c === 'create') createFamily();
    else if (c === 'add') addMember(inp('.c-member'));
    else if (c === 'retry') { note = ''; if (user) connect(); else init(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.closest('.cloudpanel')) return;
    if (e.target.classList.contains('c-email')) sendLink(e.target.value);
    if (e.target.classList.contains('c-member')) addMember(e.target.value);
  });
  $('#cloud-btn').onclick = () => { if (S.name) { showParent(); $('#s-parent .cloudpanel').scrollIntoView({ behavior: 'smooth' }); } else showProfiles(); };

  setTimeout(init, 0);
  return {
    paint,
    saved(k) { if (state === 'in') { queue.add(k); flushSoon(); } },
    removed(s) { if (state === 'in' && s.pid) famRef().collection('players').doc(s.pid).delete().catch(e => console.error(e)); }
  };
})();
