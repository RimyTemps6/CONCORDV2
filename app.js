import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithCredential,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,addDoc,updateDoc,deleteDoc,arrayUnion,arrayRemove,collection,query,where,orderBy,onSnapshot,getDocs,writeBatch,serverTimestamp,limitToLast,deleteField} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 13, 0) % 360;
const hm = ts => ts ? ts.toDate().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) : "";
const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newId = () => Array.from({length: 8}, () => CH[Math.floor(Math.random() * CH.length)]).join("");
const COLORS = ["#5ba8ff", "#7cc0ff", "#a78bfa", "#f78fb3", "#ffb86b", "#5fd3b6", "#4a6fa5", "#2f4f93"];
let me = null, cur = null, unsubs = [], unsubMsgs = null, scanner = null;
const S = {tab: "chats", chats: [], st: [], q: ""};
const err = t => $("#err").textContent = t || "";

/* ---------- App Android (o site roda dentro do app; "AndroidApp" é a ponte) ---------- */
const NATIVE = window.AndroidApp || null;
window.onGoogleToken = async t => {
  try { await signInWithCredential(auth, GoogleAuthProvider.credential(t)); }
  catch (x) { err("Erro: " + (x.code || x.message)); }
};
window.onGoogleError = m => err(/cancel/i.test(m) ? "" : "Não foi possível entrar com Google: " + m);
window.onFcmToken = t => { if (me && t) setDoc(doc(db, "fcmTokens", me.uid), {token: t, at: serverTimestamp()}).catch(() => {}); };
window.refreshFcm = () => { if (NATIVE && me) NATIVE.requestToken(); };
// Vindos das notificações do app: atender uma ligação / abrir uma conversa
let answering = null;
window.answerCall = () => {
  const id = window.pendingAnswer; if (!id || !me) return;
  window.pendingAnswer = null; answerById(id);
};
window.openPendingChat = () => {
  const id = window.pendingChat; if (!id || !me) return;
  const c = S.chats.find(x => x.id === id); if (!c) return;
  window.pendingChat = null; S.tab = "chats"; openChat(c);
};
async function logout() {
  try { if (NATIVE && me) await deleteDoc(doc(db, "fcmTokens", me.uid)); } catch {}
  try { NATIVE?.signedOut?.(); } catch {}
  signOut(auth);
}

/* ---------- Ícones (SVG, sem emojis) ---------- */
const IC = {
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  status: '<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  video: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  videooff: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><path d="M3 3l18 18"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0M12 17v5"/>',
  micoff: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0M12 17v5M3 3l18 18"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7h-4M14 21v-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  clip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
$$("[data-i]").forEach(e => e.innerHTML = ic(e.dataset.i));

/* ---------- Avatares e perfis em cache ---------- */
const P = {};
const av = (n, u, sq) => {
  const p = u && P[u]?.photo, c = sq ? " sq" : "";
  return p ? `<div class="av${c}"><img src="${p}" alt="" referrerpolicy="no-referrer"></div>`
    : `<div class="av${c}" style="background:linear-gradient(135deg,hsl(${hue(n)},75%,72%),hsl(${(hue(n) + 40) % 360},70%,60%))">${esc(String(n || "?").trim().slice(0, 2).toUpperCase() || "?")}</div>`;
};
async function ensureP(uids) {
  const miss = [...new Set(uids)].filter(u => u && !P[u]); if (!miss.length) return;
  miss.forEach(u => P[u] = {});
  await Promise.all(miss.map(async u => { try { const s = await getDoc(doc(db, "users", u)); if (s.exists()) P[u] = s.data(); } catch {} }));
  renderList();
}

/* ---------- Tema ---------- */
try { document.documentElement.dataset.theme = localStorage.getItem("th") || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"); } catch {}
const isDark = () => document.documentElement.dataset.theme === "dark";
function theme() {
  const n = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = n;
  try { localStorage.setItem("th", n); } catch {}
}
$("#bTheme0").onclick = theme;

/* ---------- Login e cadastro ---------- */
onAuthStateChanged(auth, u => { u ? enter(u) : leave(); });

async function enter(u) {
  if (me?.uid === u.uid) return;
  const s = await getDoc(doc(db, "users", u.uid));
  if (!s.exists()) return showSetup(u);          // primeiro acesso: completar cadastro
  me = {uid: u.uid, ...s.data()}; P[me.uid] = me;
  $("#auth").hidden = $("#setup").hidden = true; $("#app").hidden = false;
  unsubs = [
    onSnapshot(query(collection(db, "chats"), where("members", "array-contains", me.uid)), s => {
      const had = cur && S.chats.some(x => x.id === cur.id);
      S.chats = s.docs.map(d => ({id: d.id, ...d.data()}));
      if (cur) {
        const f = S.chats.find(x => x.id === cur.id);
        if (f) { const mudou = f.members.length !== cur.members.length || f.name !== cur.name || f.owner !== cur.owner || f.photo !== cur.photo; cur = f; if (mudou) head(); }
        else if (had) closeChat();
      }
      renderList(); window.openPendingChat();
    }),
    onSnapshot(query(collection(db, "statuses"), where("viewers", "array-contains", me.uid)), s => {
      const lim = Date.now() - 864e5;
      S.st = s.docs.map(d => ({id: d.id, ...d.data()})).filter(x => !x.at || x.at.toMillis() > lim); renderList();
    }),
    onSnapshot(query(collection(db, "calls"), where("callee", "==", me.uid), where("status", "==", "ringing")),
      s => s.docChanges().forEach(c => c.type === "added" && incoming({id: c.doc.id, ...c.doc.data()})))
  ];
  renderList();
  if (NATIVE) { NATIVE.requestToken(); NATIVE.loggedIn?.(); }   // o app liga a conexão em segundo plano
  window.answerCall(); window.openPendingChat(); cleanupStatuses();
}
function leave() {
  hang(); unsubs.forEach(f => f()); unsubs = []; unsubMsgs && unsubMsgs();
  me = cur = null; S.chats = []; S.st = []; $("#app").hidden = $("#setup").hidden = true; $("#auth").hidden = false;
}

/* ---------- Navegação e lista ---------- */
$$("#nav [data-t]").forEach(b => b.onclick = () => { S.tab = b.dataset.t; renderList(); });
$("#bAdd").onclick = () => S.tab === "status" ? postStatus() : chooser();
$("#q").oninput = e => { S.q = e.target.value; renderList(); };
const title = c => c.type === "group" ? c.name : c.names[c.members.find(m => m !== me.uid)];
const other = c => c.type === "group" ? null : c.members.find(m => m !== me.uid);
const recent = () => [...S.chats].sort((a, b) => (b.updatedAt?.seconds || 9e9) - (a.updatedAt?.seconds || 9e9));

function renderList() {
  if (!me) return;
  $$("#nav [data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === S.tab));
  $("#ttl").textContent = {chats: "Conversas", status: "Status", me: "Perfil"}[S.tab];
  $("#bAdd").hidden = S.tab === "me"; $("#qwrap").hidden = S.tab !== "chats";
  ({chats: pgChats, status: pgStatus, me: pgMe}[S.tab])($("#page"));
}
function pgChats(pg) {
  const all = recent(), q = S.q.trim().toLowerCase(), rows = all.filter(c => title(c).toLowerCase().includes(q));
  pg.innerHTML = '<div class="sec">GRUPOS</div><div class="tiles" id="tiles"></div><div class="sec">RECENTES</div><div class="card" id="rows"></div>';
  all.filter(c => c.type === "group").forEach(c => {
    const t = document.createElement("button"); t.className = "tile";
    t.innerHTML = chatAv(c, 1) + `<small>${esc(c.name)}</small>`; t.onclick = () => openChat(c); $("#tiles").append(t);
  });
  const n = document.createElement("button"); n.className = "tile";
  n.innerHTML = `<div class="av sq plus">${ic("plus")}</div><small>Criar</small>`; n.onclick = newGroup; $("#tiles").append(n);
  if (!rows.length) $("#rows").innerHTML = '<p class="empty">Nenhuma conversa ainda. Toque em + para adicionar alguém.</p>';
  ensureP(rows.map(other));
  rows.forEach(c => {
    const b = document.createElement("button"); b.className = "ci" + (cur?.id === c.id ? " on" : "");
    b.innerHTML = chatAv(c) + `<div class="mid"><b>${esc(title(c))}</b><small>${esc(c.last || "Diga olá")}</small></div><time>${hm(c.updatedAt)}</time>`;
    b.onclick = () => openChat(c); $("#rows").append(b);
  });
}
function chooser() {
  modal('<h3>Adicionar</h3><button class="fbtn" id="c1">Adicionar pessoa (QR ou ID)</button><button class="fbtn" id="c2">Criar grupo</button>');
  $("#c1").onclick = addPersonModal; $("#c2").onclick = newGroup;
}

/* ---------- Mídia: fotos, áudio, arquivos e vídeos ficam em pedaços no próprio Firestore (sem Storage, sem custo) ---------- */
const CHUNK = 600000, MAXFILE = 2500000;
const rid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36));
async function saveMedia(kind, ref, dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1), n = Math.max(1, Math.ceil(b64.length / CHUNK)), mid = rid();
  for (let i = 0; i < n; i++) await setDoc(doc(db, "media", `${mid}_${i}`), {kind, ref, owner: me.uid, d: b64.slice(i * CHUNK, (i + 1) * CHUNK)});
  return {mid, n};
}
const dropMedia = (mid, n) => mid ? Promise.all(Array.from({length: n || 0}, (_, i) => deleteDoc(doc(db, "media", `${mid}_${i}`)).catch(() => {}))) : Promise.resolve();
const mcache = new Map();
function loadMedia(mid, n, mime) {
  if (!mcache.has(mid)) mcache.set(mid, (async () => {
    const parts = await Promise.all(Array.from({length: n}, (_, i) => getDoc(doc(db, "media", `${mid}_${i}`))));
    if (parts.some(p => !p.exists())) throw new Error("falta pedaço");
    const blob = await (await fetch(`data:${mime};base64,` + parts.map(p => p.data().d).join(""))).blob();
    return URL.createObjectURL(blob);
  })().catch(e => { mcache.delete(mid); throw e; }));
  return mcache.get(mid);
}
const fmtSize = b => b < 1024 ? b + " B" : b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";
const fmtDur = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
function thumbOf(im) {
  const k = 32 / Math.max(im.width, im.height), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.5);
}
async function prepImage(file) {
  const src = await readFile(file), im = await loadImg(src);
  if (file.type === "image/gif" && file.size <= 560000) return {url: src, w: im.width, h: im.height, thumb: thumbOf(im), mime: "image/gif"};
  let max = 1280, q = 0.74, url, c;
  for (let t = 0; t < 5; t++) {
    const k = Math.min(1, max / Math.max(im.width, im.height));
    c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); url = c.toDataURL("image/jpeg", q);
    if (url.length < 560000) break;
    max *= 0.8; q = Math.max(0.45, q - 0.08);
  }
  return {url, w: c.width, h: c.height, thumb: thumbOf(im), mime: "image/jpeg"};
}
// Vídeo de status: regrava em 480p / ~450 kbps, no máximo 20 s (leva o tempo do vídeo)
async function prepVideo(file) {
  if (!window.MediaRecorder) throw new Error("Este aparelho não consegue preparar vídeo.");
  const v = document.createElement("video"), src = URL.createObjectURL(file);
  v.src = src; v.playsInline = true; v.preload = "auto";
  await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error("Não consegui ler esse vídeo.")); });
  const dur = Math.min(isFinite(v.duration) ? v.duration : 20, 20);
  const k = Math.min(1, 480 / Math.min(v.videoWidth, v.videoHeight)), w = Math.round(v.videoWidth * k / 2) * 2, h = Math.round(v.videoHeight * k / 2) * 2;
  const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
  const out = c.captureStream(24);
  let ac = null;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const dest = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(dest);
    dest.stream.getAudioTracks().forEach(t => out.addTrack(t));
  } catch {}
  const mime = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
  const mr = new MediaRecorder(out, {mimeType: mime, videoBitsPerSecond: 450000, audioBitsPerSecond: 40000}), parts = [];
  mr.ondataavailable = e => e.data.size && parts.push(e.data);
  let raf = 0; const draw = () => { ctx.drawImage(v, 0, 0, w, h); raf = requestAnimationFrame(draw); };
  await new Promise((ok, no) => {
    const stop = () => { if (mr.state !== "inactive") mr.stop(); };
    mr.onstop = ok; v.onended = stop; setTimeout(stop, dur * 1000 + 400);
    mr.start(); v.play().then(draw).catch(() => { stop(); no(new Error("Não consegui tocar esse vídeo.")); });
  });
  cancelAnimationFrame(raf); v.pause(); URL.revokeObjectURL(src); ac && ac.close().catch(() => {});
  const blob = new Blob(parts, {type: "video/webm"});
  if (blob.size > MAXFILE) throw new Error("Vídeo grande demais. Escolha um mais curto.");
  return {blob, url: await readFile(blob), mime: "video/webm"};
}
async function saveBlob(url, mime, name) {
  if (NATIVE?.saveFile) {
    const blob = await (await fetch(url)).blob(), d = await readFile(blob);
    NATIVE.saveFile(name, mime, d.slice(d.indexOf(",") + 1));
  } else { const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); }
}
let toastT;
function toast(t, ms = 2600) {
  let e = $("#toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; document.body.append(e); }
  e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, ms);
}

/* ---------- Chat em tempo real ---------- */
const chatAv = (c, sq) => c.type === "group"
  ? (c.photo ? `<div class="av${sq ? " sq" : ""}"><img src="${c.photo}" alt=""></div>` : av(c.name, null, sq))
  : av(title(c), other(c), sq);
function head() {
  const c = cur, g = c.type === "group";
  const sub = g ? c.members.map(m => c.names?.[m]).filter(Boolean).join(", ") : "Toque para ver o perfil";
  $("#chHead").innerHTML = chatAv(c) + `<div class="grow"><b>${esc(title(c))}</b><small>${esc(sub)}</small></div>`;
  $("#chHead").onclick = () => g ? groupInfo() : openProfile(other(c));
  $("#bCall").hidden = $("#bVid").hidden = g; $("#bMem").hidden = !(g && c.owner === me.uid);
}
function closeChat() {
  unsubMsgs && unsubMsgs(); unsubMsgs = null; cur = null; hideBoxes();
  $("#app").classList.remove("inchat");
  $("#chHead").innerHTML = "<b>Concord</b>"; $("#chHead").onclick = null;
  $("#bCall").hidden = $("#bVid").hidden = $("#bMem").hidden = true;
  $("#msgs").innerHTML = '<p class="empty">Escolha uma conversa para começar.</p>';
  renderList();
}
let msgLimit = 60, draftMentions = {};
function openChat(c) {
  cur = c; msgLimit = 60; draftMentions = {}; hideBoxes(); $("#txt").value = ""; syncComposer();
  ensureP([other(c)]); head();
  $("#app").classList.add("inchat"); renderList();
  bindMessages();
}

// Texto com @menções em destaque
const fmt = m => {
  let h = esc(m.text);
  Object.values(m.mn || {}).forEach(n => { h = h.split("@" + esc(n)).join(`<b class="at">@${esc(n)}</b>`); });
  return h;
};
const lazyObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { lazyObs.unobserve(e.target); e.target._load && e.target._load(); } }), {rootMargin: "300px"});
let playing = null;

function bubble(id, m, g, chatId) {
  const mine = m.from === me.uid, p = document.createElement("div");
  p.className = "m" + (mine ? " me" : "") + (m.mentions?.includes(me.uid) ? " ment" : "");
  p.dataset.id = id;
  const who = g && !mine ? `<span class="who" style="color:hsl(${hue(m.name)},60%,45%)">${esc(m.name || "")}</span>` : "", t = `<time>${hm(m.at)}</time>`;

  if (m.type === "image") {
    p.innerHTML = who + `<div class="img" style="aspect-ratio:${m.w || 4}/${m.h || 3};background-image:url(${m.thumb || ""})"></div>` + t;
    const box = p.querySelector(".img");
    box._load = () => loadMedia(m.mid, m.n, m.mime).then(u => { box.innerHTML = `<img src="${u}" alt="">`; }).catch(() => {});
    lazyObs.observe(box); box.onclick = () => openViewer(m);
  } else if (m.type === "audio") {
    p.innerHTML = who + `<div class="aud"><button type="button" class="play">${ic("play")}</button><div class="bar"><i></i></div><small class="dur">${fmtDur(m.dur || 0)}</small></div>` + t;
    const btn = p.querySelector(".play"), bar = p.querySelector(".bar i"), dur = p.querySelector(".dur"); let a = null;
    btn.onclick = async () => {
      if (!a) {
        btn.disabled = true;
        try { a = new Audio(await loadMedia(m.mid, m.n, m.mime)); } catch { btn.disabled = false; dur.textContent = "erro"; return; }
        btn.disabled = false;
        const total = () => isFinite(a.duration) && a.duration > 0 ? a.duration : (m.dur || 1);
        a.ontimeupdate = () => { bar.style.width = Math.min(100, a.currentTime / total() * 100) + "%"; dur.textContent = fmtDur(a.currentTime); };
        a.onended = () => { btn.innerHTML = ic("play"); bar.style.width = "0"; dur.textContent = fmtDur(m.dur || 0); playing = null; };
        a.onpause = () => { btn.innerHTML = ic("play"); };
        a.onplay = () => { btn.innerHTML = ic("pause"); };
      }
      if (a.paused) { if (playing && playing !== a) playing.pause(); playing = a; a.play().catch(() => {}); } else a.pause();
    };
  } else if (m.type === "file") {
    p.innerHTML = who + `<button type="button" class="fil">${ic("file")}<span>${esc(m.fname || "arquivo")}<br><small>${fmtSize(m.size || 0)} · toque para salvar</small></span></button>` + t;
    p.querySelector(".fil").onclick = async () => {
      try { toast("Baixando…"); saveBlob(await loadMedia(m.mid, m.n, m.mime), m.mime, m.fname || "arquivo"); }
      catch { toast("Não foi possível baixar o arquivo."); }
    };
  } else if (m.type === "poll") {
    const votes = m.votes || {}, counts = m.opts.map((_, i) => Object.values(votes).filter(v => v === i).length), total = Object.keys(votes).length, mineV = votes[me.uid];
    p.innerHTML = who + `<div class="poll"><b>📊 ${esc(m.q)}</b>` + m.opts.map((o, i) => `<button type="button" class="op${mineV === i ? " on" : ""}" data-o="${i}"><i style="width:${total ? counts[i] / total * 100 : 0}%"></i><span>${esc(o)}</span><span>${counts[i]}</span></button>`).join("") + `<small>${total} ${total === 1 ? "voto" : "votos"} · toque para votar</small></div>` + t;
    p.querySelectorAll(".op").forEach(b => b.onclick = () => {
      const i = +b.dataset.o;
      updateDoc(doc(db, "chats", chatId, "messages", id), {["votes." + me.uid]: mineV === i ? deleteField() : i}).catch(() => toast("Não foi possível votar. Publique as novas regras."));
    });
  } else {
    p.innerHTML = who + `<span class="tx">${fmt(m)}</span>` + t;
  }
  return p;
}
async function openViewer(m) {
  const vw = $("#vw"); vw.hidden = false; vw.innerHTML = '<p style="color:#fff">Carregando…</p>';
  vw.onclick = e => { if (e.target.id !== "vs") vw.hidden = true; };
  try {
    const u = await loadMedia(m.mid, m.n, m.mime), ext = (m.mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    vw.innerHTML = `<img src="${u}" alt=""><div class="bt"><button id="vs">Salvar</button><button id="vx">Fechar</button></div>`;
    $("#vs").onclick = () => saveBlob(u, m.mime, "concord-" + Date.now() + "." + ext);
  } catch { vw.innerHTML = '<p style="color:#fff">Não foi possível carregar a foto.</p>'; }
}

function bindMessages() {
  unsubMsgs && unsubMsgs();
  const c = cur, g = c.type === "group", box = $("#msgs"), els = new Map(); let first = true;
  box.innerHTML = '<p class="empty" id="mhead">Carregando…</p>';
  unsubMsgs = onSnapshot(query(collection(db, "chats", c.id, "messages"), orderBy("at"), limitToLast(msgLimit)), s => {
    const near = first || box.scrollHeight - box.scrollTop - box.clientHeight < 140;
    s.docChanges().forEach(ch => {
      const id = ch.doc.id, m = ch.doc.data();
      if (ch.type === "removed") { els.get(id)?.remove(); els.delete(id); return; }
      if (ch.type === "modified" && els.has(id)) {
        const old = els.get(id);
        if (m.type === "poll") { const n = bubble(id, m, g, c.id); old.replaceWith(n); els.set(id, n); }
        else { const tm = old.querySelector("time"); if (tm) tm.textContent = hm(m.at); }
        if (ch.oldIndex !== ch.newIndex) box.insertBefore(els.get(id), box.children[ch.newIndex + 1] || null);
        return;
      }
      const el = bubble(id, m, g, c.id); els.set(id, el);
      box.insertBefore(el, box.children[ch.newIndex + 1] || null);
    });
    const h = $("#mhead");
    h.innerHTML = s.size >= msgLimit ? '<button class="lnk" id="mmore">Ver mensagens anteriores</button>' : (s.empty ? "Nenhuma mensagem ainda. Diga olá." : "");
    h.hidden = !h.innerHTML;
    if (s.size >= msgLimit) $("#mmore").onclick = () => { msgLimit += 60; bindMessages(); };
    if (near) box.scrollTop = box.scrollHeight;
    first = false;
  });
}

async function sendMsg(chat, data, preview) {
  if (!chat) return;
  const b = writeBatch(db);
  b.set(doc(collection(db, "chats", chat.id, "messages")), {from: me.uid, name: me.name, at: serverTimestamp(), ...data});
  b.update(doc(db, "chats", chat.id), {last: ((chat.type === "group" ? me.name + ": " : "") + preview).slice(0, 200), lastFrom: me.uid, lastMentions: data.mentions || [], updatedAt: serverTimestamp()});
  await b.commit();
}
$("#fSend").onsubmit = async e => {
  e.preventDefault();
  const t = $("#txt").value.trim(), chat = cur; if (!t || !chat) return;
  const mn = {}; for (const u in draftMentions) if (t.includes("@" + draftMentions[u])) mn[u] = draftMentions[u];
  $("#txt").value = ""; draftMentions = {}; syncComposer(); hideBoxes();
  const extra = Object.keys(mn).length ? {mentions: Object.keys(mn), mn} : {};
  try { await sendMsg(chat, {type: "text", text: t, ...extra}, t); } catch { toast("Não foi possível enviar."); }
};

/* ---------- Compositor: emojis, @menções, anexos, áudio, enquete ---------- */
const hideBoxes = () => { $("#emojiBox").hidden = true; $("#mentionBox").hidden = true; };
function syncComposer() {
  const has = $("#txt").value.trim().length > 0;
  $("#bSend").hidden = !has; $("#bMic").hidden = has;
}
function insertAtCaret(str) {
  const t = $("#txt"), on = document.activeElement === t, a = on ? t.selectionStart : t.value.length, b = on ? t.selectionEnd : t.value.length;
  t.setRangeText(str, a, b, "end"); syncComposer();
}
$("#txt").addEventListener("input", () => { syncComposer(); mentionCheck(); });

const EMOJI = {
  "😀": "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🫡 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(" "),
  "👍": "👍 👎 👌 🤌 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💪 🙌 👏 🫶 👐 🤲 🫵 💅".split(" "),
  "❤️": "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 😻 💋 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 🎉 🎊 🎈".split(" "),
  "🐶": "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦉 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🦈 🌸 🌹 🌻 🌈 ☀️ 🌙 ⚡ ❄️ 🌊".split(" "),
  "🍕": "🍎 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🌽 🥕 🍞 🧀 🍔 🍟 🍕 🌭 🌮 🍣 🍜 🍝 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍺 🍷 🥤".split(" "),
  "⚽": "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎮 🎧 🎤 🎬 🎨 🎯 🎲 🚗 ✈️ 🚀 🏠 🌍 📱 💻 📷 🔔 🎁 💡 📌 📎 ✅ ❌ ⚠️ ❓ ❗ 💬 👀 🧠 🦾".split(" ")
};
function buildEmoji() {
  const box = $("#emojiBox"), keys = Object.keys(EMOJI);
  box.innerHTML = '<div class="tabs2"></div><div class="eg"></div>';
  const show = k => {
    $$("#emojiBox .tabs2 button").forEach(b => b.classList.toggle("on", b.textContent === k));
    const g = $("#emojiBox .eg"); g.innerHTML = "";
    EMOJI[k].forEach(e => { const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.onclick = () => insertAtCaret(e); g.append(b); });
    g.scrollTop = 0;
  };
  keys.forEach(k => { const b = document.createElement("button"); b.type = "button"; b.textContent = k; b.onclick = () => show(k); $("#emojiBox .tabs2").append(b); });
  show(keys[0]);
}
$("#bEmoji").onclick = () => {
  const b = $("#emojiBox");
  if (b.hidden) { if (!b.innerHTML) buildEmoji(); b.hidden = false; $("#mentionBox").hidden = true; } else b.hidden = true;
};

function mentionCheck() {
  const box = $("#mentionBox"), t = $("#txt");
  const m = cur && t.value.slice(0, t.selectionStart).match(/(?:^|\s)@([^\s@]{0,20})$/);
  if (!m) { box.hidden = true; return; }
  const q = m[1].toLowerCase();
  const list = cur.members.filter(u => u !== me.uid).map(u => ({uid: u, name: cur.names?.[u] || P[u]?.name || "?"}))
    .filter(x => x.name.toLowerCase().includes(q)).slice(0, 6);
  if (!list.length) { box.hidden = true; return; }
  box.innerHTML = "";
  list.forEach(x => {
    const b = document.createElement("button"); b.type = "button"; b.innerHTML = av(x.name, x.uid) + `<span>${esc(x.name)}</span>`;
    b.onmousedown = e => e.preventDefault(); b.onclick = () => pickMention(x, m[1]); box.append(b);
  });
  box.hidden = false; $("#emojiBox").hidden = true;
}
function pickMention(x, q) {
  const t = $("#txt"), end = t.selectionStart, start = end - q.length - 1;
  t.setRangeText("@" + x.name + " ", start, end, "end"); draftMentions[x.uid] = x.name;
  $("#mentionBox").hidden = true; syncComposer(); t.focus();
}

const pickFile = (accept, fn) => {
  const i = document.createElement("input"); i.type = "file"; i.accept = accept;
  i.onchange = () => { const f = i.files[0]; if (f) { closeModal(); fn(f); } }; i.click();
};
$("#bClip").onclick = () => {
  if (!cur) return;
  modal('<h3>Anexar</h3><button class="fbtn" id="a1">Foto</button><button class="fbtn" id="a2">Arquivo</button><button class="fbtn" id="a3">Enquete</button>');
  $("#a1").onclick = () => pickFile("image/*", sendPhoto);
  $("#a2").onclick = () => pickFile("*/*", sendFile);
  $("#a3").onclick = newPoll;
};
async function sendPhoto(f) {
  const chat = cur; if (!chat) return;
  try {
    toast("Enviando foto…", 60000);
    const im = await prepImage(f), {mid, n} = await saveMedia("chat", chat.id, im.url);
    await sendMsg(chat, {type: "image", mid, n, mime: im.mime, w: im.w, h: im.h, thumb: im.thumb}, "📷 Foto"); toast("Foto enviada");
  } catch { toast("Não foi possível enviar a foto. Publique as novas regras no Firebase."); }
}
async function sendFile(f) {
  const chat = cur; if (!chat) return;
  if (f.size > MAXFILE) return toast("Arquivo grande demais. O máximo é " + fmtSize(MAXFILE) + " (limite do plano grátis).");
  try {
    toast("Enviando arquivo…", 60000);
    const mime = f.type || "application/octet-stream", {mid, n} = await saveMedia("chat", chat.id, await readFile(f));
    await sendMsg(chat, {type: "file", mid, n, mime, fname: f.name, size: f.size}, "📎 " + f.name); toast("Arquivo enviado");
  } catch { toast("Não foi possível enviar o arquivo. Publique as novas regras no Firebase."); }
}
function newPoll() {
  const chat = cur;
  modal('<h3>Nova enquete</h3><input id="pq" maxlength="100" placeholder="Pergunta"><div id="pops"></div><button class="fbtn" id="padd">+ Adicionar opção</button><button class="btn" id="pgo">Enviar enquete</button><p id="addErr"></p>');
  const add = () => { if ($$("#pops input").length >= 6) return; const i = document.createElement("input"); i.maxLength = 40; i.placeholder = "Opção " + ($$("#pops input").length + 1); $("#pops").append(i); };
  add(); add(); $("#padd").onclick = add;
  $("#pgo").onclick = async () => {
    const q = $("#pq").value.trim(), opts = $$("#pops input").map(i => i.value.trim()).filter(Boolean);
    if (!q) return $("#addErr").textContent = "Escreva a pergunta.";
    if (opts.length < 2) return $("#addErr").textContent = "Coloque pelo menos 2 opções.";
    try { await sendMsg(chat, {type: "poll", q, opts, votes: {}}, "📊 Enquete: " + q); await closeModal(); }
    catch { $("#addErr").textContent = "Não foi possível enviar. Publique as novas regras no Firebase."; }
  };
}

// Áudio: toque no microfone para gravar, toque em enviar (✓) ou cancelar (✕)
let rec = null;
async function recStart() {
  if (!cur || rec) return;
  if (pc) return toast("Termine a ligação para gravar áudio.");
  if (!window.MediaRecorder) return toast("Este aparelho não grava áudio.");
  let st; try { st = await navigator.mediaDevices.getUserMedia({audio: true}); } catch { return toast("Permita o microfone para gravar áudio."); }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t));
  const mr = new MediaRecorder(st, mime ? {mimeType: mime, audioBitsPerSecond: 24000} : {audioBitsPerSecond: 24000}), parts = [];
  mr.ondataavailable = e => e.data.size && parts.push(e.data);
  rec = {mr, st, parts, t0: Date.now(), chat: cur, mime: (mr.mimeType || mime || "audio/webm").split(";")[0]};
  rec.timer = setInterval(() => { const s = (Date.now() - rec.t0) / 1000; $("#recT").textContent = fmtDur(s); if (s >= 120) recStop(true); }, 250);
  mr.start(500); $("#recT").textContent = "0:00"; $("#recBar").hidden = false; $("#fSend").hidden = true; hideBoxes();
}
function recStop(send) {
  const r = rec; if (!r) return; rec = null; clearInterval(r.timer);
  $("#recBar").hidden = true; $("#fSend").hidden = false;
  r.mr.onstop = async () => {
    r.st.getTracks().forEach(t => t.stop());
    const dur = (Date.now() - r.t0) / 1000;
    if (!send || dur < 0.7) return;
    try {
      toast("Enviando áudio…", 60000);
      const blob = new Blob(r.parts, {type: r.mime});
      if (blob.size > MAXFILE) return toast("Áudio grande demais.");
      const {mid, n} = await saveMedia("chat", r.chat.id, await readFile(blob));
      await sendMsg(r.chat, {type: "audio", mid, n, mime: r.mime, dur: Math.round(dur)}, "🎤 Áudio " + fmtDur(dur)); toast("Áudio enviado");
    } catch { toast("Não foi possível enviar o áudio. Publique as novas regras no Firebase."); }
  };
  try { r.mr.stop(); } catch {}
}
$("#bMic").onclick = recStart; $("#recOk").onclick = () => recStop(true); $("#recX").onclick = () => recStop(false);

$("#bBack").onclick = () => $("#app").classList.remove("inchat");
$("#bCall").onclick = () => startCall(other(cur), title(cur), false);
$("#bVid").onclick = () => startCall(other(cur), title(cur), true);

/* ---------- Janelas ---------- */
const modal = h => { $("#box").innerHTML = h + '<button class="lnk" id="mx">Fechar</button>'; $("#modal").hidden = false; $("#mx").onclick = closeModal; };
async function closeModal() {
  if (scanner) { try { await scanner.stop(); } catch {} scanner = null; }
  $("#modal").hidden = true;
}
$("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
const cleanId = t => String(t).replace(/^(CONCORD|CONECTA):/i, "").trim().toUpperCase();
const findUsers = async ids => {
  const clean = [...new Set(ids.map(cleanId).filter(Boolean))].slice(0, 30);
  if (!clean.length) return [];
  return (await getDocs(query(collection(db, "users"), where("publicId", "in", clean)))).docs;
};

/* ---------- QR code ---------- */
function showQr() {
  modal('<h3>Meu QR</h3><canvas id="qr"></canvas><p>ID: <b>' + me.publicId + '</b></p><small>A outra pessoa lê este código em Adicionar pessoa.</small>');
  try { QRCode.toCanvas($("#qr"), "CONCORD:" + me.publicId, {width: 240, margin: 3, color: {dark: "#1f3358", light: "#ffffff"}}); }
  catch { $("#qr").replaceWith("Não foi possível gerar o QR. Use o ID acima."); }
}
let scanned = false;
function addPersonModal() {
  scanned = false;
  modal('<h3>Adicionar pessoa</h3><div id="reader"></div><small id="camMsg">Aponte a câmera para o QR de outra pessoa</small><label class="fbtn">Ler QR de uma foto<input type="file" id="qrf" accept="image/*" hidden></label><input id="addId" placeholder="Ou digite o ID" maxlength="8"><button class="btn" id="go">Adicionar</button><p id="addErr"></p>');
  $("#go").onclick = () => addPerson($("#addId").value);
  const got = t => { if (!scanned) { scanned = true; addPerson(t).finally(() => setTimeout(() => scanned = false, 2500)); } };
  if (typeof Html5Qrcode === "undefined") { $("#camMsg").textContent = "O leitor de QR não carregou. Digite o ID abaixo."; return; }
  scanner = new Html5Qrcode("reader");
  scanner.start({facingMode: "environment"}, {fps: 10, qrbox: {width: 220, height: 220}}, got, () => {})
    .catch(() => { $("#camMsg").textContent = "Não consegui abrir a câmera. Permita o acesso no navegador, ou use a foto do QR ou o ID."; });
  $("#qrf").onchange = async e => {
    try { try { await scanner.stop(); } catch {} got(await scanner.scanFile(e.target.files[0], false)); }
    catch { $("#addErr").textContent = "Não achei um QR nessa foto."; }
  };
}
async function addPerson(raw) {
  const msg = t => { const e = $("#addErr"); if (e) e.textContent = t; };
  const [o] = await findUsers([raw]);
  if (!o) return msg("ID não encontrado.");
  if (o.id === me.uid) return msg("Esse é o seu próprio ID.");
  const cid = [me.uid, o.id].sort().join("_"), names = {[me.uid]: me.name, [o.id]: o.data().name};
  await setDoc(doc(db, "chats", cid), {members: [me.uid, o.id], names}, {merge: true});
  await closeModal(); S.tab = "chats"; openChat({id: cid, members: [me.uid, o.id], names});
}

/* ---------- Grupos ---------- */
const contacts = () => S.chats.filter(c => c.type !== "group").map(c => ({uid: other(c), name: c.names?.[other(c)] || "?"})).filter(x => x.uid);
const pickList = (list, vazio) => list.length
  ? '<div class="pl">' + list.map(x => `<label>${av(x.name, x.uid)}<span class="nm">${esc(x.name)}</span><input type="checkbox" value="${x.uid}"></label>`).join("") + "</div>"
  : `<p class="mut">${vazio}</p>`;
const picked = () => $$(".pl input:checked").map(i => i.value);

async function newGroup() {
  const list = contacts(); await ensureP(list.map(x => x.uid));
  modal('<h3>Novo grupo</h3><input id="gn" maxlength="30" placeholder="Nome do grupo"><small>Escolha quem entra no grupo</small>'
    + pickList(list, "Você ainda não tem contatos. Adicione pessoas pelo QR ou ID e depois volte aqui.")
    + '<button class="btn" id="go">Criar grupo</button><p id="addErr"></p>');
  $("#go").onclick = async () => {
    const name = $("#gn").value.trim(); if (!name) return $("#addErr").textContent = "Dê um nome ao grupo.";
    const ids = picked().slice(0, 49), members = [me.uid, ...ids], names = {[me.uid]: me.name};
    list.forEach(x => { if (ids.includes(x.uid)) names[x.uid] = x.name; });
    const ref = doc(collection(db, "chats")), data = {type: "group", name, owner: me.uid, members, names, last: "", updatedAt: serverTimestamp()};
    try { await setDoc(ref, data); } catch { return $("#addErr").textContent = "Não foi possível criar o grupo."; }
    await closeModal(); S.tab = "chats"; openChat({id: ref.id, ...data});
  };
}
async function addMembers() {
  const c = cur; if (!c || c.owner !== me.uid) return;
  const list = contacts().filter(x => !c.members.includes(x.uid)); await ensureP(list.map(x => x.uid));
  modal('<h3>Adicionar ao grupo</h3>' + pickList(list, "Todos os seus contatos já estão no grupo.")
    + (list.length ? '<button class="btn" id="go">Adicionar</button>' : "") + '<p id="addErr"></p>');
  if (!list.length) return;
  $("#go").onclick = async () => {
    const ids = picked(); if (!ids.length) return $("#addErr").textContent = "Escolha pelo menos uma pessoa.";
    if (c.members.length + ids.length > 50) return $("#addErr").textContent = "O grupo aceita até 50 pessoas.";
    const upd = {members: arrayUnion(...ids)}; list.forEach(x => { if (ids.includes(x.uid)) upd["names." + x.uid] = x.name; });
    try { await updateDoc(doc(db, "chats", c.id), upd); } catch { return $("#addErr").textContent = "Não foi possível adicionar. Publique as novas regras no Firebase."; }
    await closeModal();
  };
}
$("#bMem").onclick = addMembers;

function sure(text, yes, fn) {
  modal(`<h3>Tem certeza?</h3><p>${esc(text)}</p><div class="row2"><button class="btn" id="sno">Cancelar</button><button class="btn dng" id="syes">${esc(yes)}</button></div><p id="addErr"></p>`);
  $("#sno").onclick = closeModal;
  $("#syes").onclick = async () => {
    $("#syes").disabled = true;
    try { await fn(); await closeModal(); }
    catch { $("#addErr").textContent = "Não foi possível. Publique as novas regras no Firebase."; $("#syes").disabled = false; }
  };
}
function groupInfo() {
  const c = cur; if (!c || c.type !== "group") return;
  const own = c.owner === me.uid; ensureP(c.members);
  const rows = c.members.map(m => `<div class="pr">${av(c.names?.[m], m)}<span class="nm">${esc(c.names?.[m] || "?")}${m === me.uid ? " (você)" : ""}</span>${m === c.owner ? '<span class="tag">dono</span>' : ""}</div>`).join("");
  modal(`<div class="gph">${chatAv(c, 1)}</div><h3>${esc(c.name)}</h3><small>${c.members.length} ${c.members.length === 1 ? "pessoa" : "pessoas"}</small><div class="pl">${rows}</div>`
    + (own ? `<button class="fbtn" id="gedit">${ic("edit")} Editar nome e foto</button><button class="fbtn" id="gadd">Adicionar pessoas</button>` : "")
    + '<button class="fbtn dng" id="glv">Sair do grupo</button>'
    + (own ? '<button class="fbtn dng" id="gdl">Apagar grupo</button>' : ""));
  if (own) {
    $("#gedit").onclick = editGroup;
    $("#gadd").onclick = addMembers;
    $("#gdl").onclick = () => sure(`O grupo "${c.name}" será apagado para todos, com as mensagens.`, "Apagar grupo", () => deleteGroup(c));
  }
  $("#glv").onclick = () => sure(`Você vai sair do grupo "${c.name}".`, "Sair", () => leaveGroup(c));
}
function editGroup() {
  const c = cur; if (!c || c.owner !== me.uid) return;
  let photo = null, clear = false;
  modal(`<h3>Editar grupo</h3><div class="gph" id="gph">${chatAv(c, 1)}</div><label class="fbtn">Trocar foto do grupo<input type="file" id="gfp" accept="image/*" hidden></label>${c.photo ? '<button class="fbtn dng" id="gfx">Remover foto</button>' : ""}<input id="gnm" value="${esc(c.name)}" maxlength="30" placeholder="Nome do grupo"><button class="btn" id="gsv">Salvar</button><p id="addErr"></p>`);
  $("#gfp").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    photo = await shrink(f, 160, 160); clear = false; $("#gph").innerHTML = `<div class="av sq"><img src="${photo}" alt=""></div>`;
  };
  if ($("#gfx")) $("#gfx").onclick = () => { photo = null; clear = true; $("#gph").innerHTML = av(c.name, null, 1); };
  $("#gsv").onclick = async () => {
    const name = $("#gnm").value.trim(); if (!name) return $("#addErr").textContent = "Dê um nome ao grupo.";
    const upd = {name}; if (photo) upd.photo = photo; else if (clear) upd.photo = deleteField();
    try { await updateDoc(doc(db, "chats", c.id), upd); } catch { return $("#addErr").textContent = "Não foi possível salvar. Publique as novas regras no Firebase."; }
    await closeModal();
  };
}
async function leaveGroup(c) {
  if (c.members.length <= 1) return deleteGroup(c);
  const ref = doc(db, "chats", c.id);
  if (c.owner === me.uid) await updateDoc(ref, {members: arrayRemove(me.uid), owner: c.members.find(m => m !== me.uid)});   // passa o grupo para outra pessoa
  else await updateDoc(ref, {members: arrayRemove(me.uid)});
  closeChat();
}
async function deleteGroup(c) {
  const msgs = (await getDocs(collection(db, "chats", c.id, "messages"))).docs;
  await Promise.all(msgs.map(d => d.data().mid ? dropMedia(d.data().mid, d.data().n) : null));
  for (let i = 0; i < msgs.length; i += 15) {            // lotes pequenos por causa do limite das regras
    const b = writeBatch(db); msgs.slice(i, i + 15).forEach(d => b.delete(d.ref)); await b.commit();
  }
  await deleteDoc(doc(db, "chats", c.id));
  closeChat();
}

/* ---------- Status (24 horas) ---------- */
function pgStatus(pg) {
  const by = {}; S.st.forEach(x => (by[x.uid] = by[x.uid] || []).push(x));
  for (const u in by) by[u].sort((a, b) => (a.at?.seconds || 9e9) - (b.at?.seconds || 9e9));
  pg.innerHTML = '<div class="sec">MEU STATUS</div><div class="card" id="r1"></div><div class="sec">RECENTES</div><div class="card" id="r2"></div>';
  const row = (box, name, label, sub, list, uid) => {
    const b = document.createElement("button"); b.className = "ci";
    b.innerHTML = `<div class="ring ${list ? "on" : ""}">${av(name, uid)}</div><div class="mid"><b>${esc(label)}</b><small>${esc(sub)}</small></div>`;
    b.onclick = () => list ? viewStatus(list, 0) : postStatus(); $(box).append(b);
  };
  const mine = by[me.uid];
  row("#r1", me.name, "Meu status", mine ? mine.length + " nas últimas 24 h" : "Toque para postar", mine, me.uid);
  const others = Object.keys(by).filter(u => u !== me.uid); ensureP(others);
  if (!others.length) $("#r2").innerHTML = '<p class="empty">Nenhum status dos seus contatos agora.</p>';
  others.forEach(u => { const l = by[u]; row("#r2", l[0].name, l[0].name, hm(l[l.length - 1].at) || "agora", l, u); });
}
function viewStatus(list, i) {
  const x = list[i], sv = $("#sv");
  if (!x) { sv.hidden = true; sv.innerHTML = ""; return; }
  sv.hidden = false; sv.style.background = x.type === "image" || x.type === "video" ? "#000" : x.color;
  const body = x.type === "image" || x.type === "video"
    ? `<div class="svm" id="svm"></div>${x.text ? `<p class="cap">${esc(x.text)}</p>` : ""}` : `<p>${esc(x.text)}</p>`;
  sv.innerHTML = `<div class="svb">${list.map((_, k) => `<i class="${k <= i ? "f" : ""}"></i>`).join("")}</div>
    <div class="svh">${av(x.name, x.uid)}<div class="grow"><b>${esc(x.name)}</b><small style="color:#fffc">${hm(x.at)}</small></div>${x.uid === me.uid ? '<button id="svd">Apagar</button>' : ""}<button id="svx">Fechar</button></div>${body}`;
  if (x.mid) {
    const box = $("#svm"); box.innerHTML = x.thumb ? `<img src="${x.thumb}" style="filter:blur(6px)" alt="">` : "Carregando…";
    loadMedia(x.mid, x.n, x.mime).then(u => {
      if ($("#svm") !== box) return;
      box.innerHTML = x.type === "video" ? `<video src="${u}" autoplay playsinline loop></video>` : `<img src="${u}" alt="">`;
    }).catch(() => { if ($("#svm") === box) box.textContent = "Não foi possível carregar."; });
  }
  sv.onclick = e => {
    if (e.target.id === "svx") { sv.hidden = true; sv.innerHTML = ""; }
    else if (e.target.id === "svd") { dropStatus(x); sv.hidden = true; sv.innerHTML = ""; }
    else if (e.target.tagName !== "VIDEO" || true) viewStatus(list, i + 1);
  };
}
const dropStatus = x => { deleteDoc(doc(db, "statuses", x.id)).catch(() => {}); dropMedia(x.mid, x.n); };
function postStatus() {
  let col = COLORS[0], file = null;
  modal(`<h3>Novo status</h3><div id="spv"></div><textarea id="stx" maxlength="140" placeholder="O que você está pensando?"></textarea><label class="fbtn">Adicionar foto ou vídeo<input type="file" id="sfile" accept="image/*,video/*" hidden></label><div class="sw">${COLORS.map((c, i) => `<i data-c="${c}" class="${i ? "" : "on"}" style="background:${c}"></i>`).join("")}</div><button class="btn" id="spub">Publicar</button><p id="addErr"></p>`);
  $$(".sw i").forEach(i => i.onclick = () => { col = i.dataset.c; $$(".sw i").forEach(k => k.classList.toggle("on", k === i)); });
  $("#sfile").onchange = e => {
    file = e.target.files[0]; if (!file) return;
    const u = URL.createObjectURL(file);
    $("#spv").innerHTML = file.type.startsWith("video") ? `<video src="${u}" muted playsinline controls></video>` : `<img src="${u}" alt="">`;
    $("#stx").placeholder = "Legenda (opcional)";
  };
  $("#spub").onclick = async () => {
    const text = $("#stx").value.trim(), er = t => $("#addErr").textContent = t;
    if (!text && !file) return er("Escreva algo ou escolha uma foto ou vídeo.");
    const btn = $("#spub"); btn.disabled = true;
    const viewers = [...new Set([me.uid, ...S.chats.filter(c => c.type !== "group").map(other)])];
    try {
      const data = {uid: me.uid, name: me.name, text, color: col, at: serverTimestamp(), viewers, type: "text"};
      if (file) {
        let kind = "image", url, mime, thumb = "";
        if (file.type.startsWith("video")) { btn.textContent = "Preparando vídeo…"; const v = await prepVideo(file); url = v.url; mime = v.mime; kind = "video"; }
        else { btn.textContent = "Enviando…"; const im = await prepImage(file); url = im.url; mime = im.mime; thumb = im.thumb; }
        const {mid, n} = await saveMedia("status", "status", url);
        Object.assign(data, {type: kind, mid, n, mime, thumb});
      }
      await setDoc(doc(collection(db, "statuses")), data);
    } catch (x) { btn.disabled = false; btn.textContent = "Publicar"; return er(x?.message?.startsWith("Vídeo") || x?.message?.startsWith("Não consegui") || x?.message?.startsWith("Este aparelho") ? x.message : "Não foi possível publicar. Publique as novas regras no Firebase."); }
    await closeModal(); S.tab = "status"; renderList();
  };
}
// apaga meus status com mais de 24 h (e as mídias deles)
async function cleanupStatuses() {
  try {
    const s = await getDocs(query(collection(db, "statuses"), where("uid", "==", me.uid)));
    s.docs.forEach(d => { const x = d.data(); if (x.at && x.at.toMillis() < Date.now() - 864e5) dropStatus({id: d.id, ...x}); });
  } catch {}
}

/* ---------- Perfil: foto, banner (inclui GIF animado) e recado ---------- */
const B = {};
const readFile = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
async function shrink(file, w, h) {
  const img = new Image(); img.src = await readFile(file); await img.decode();
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
  c.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.8);
}
async function loadBanner(u) {
  if (!(u in B)) { try { const s = await getDoc(doc(db, "banners", u)); B[u] = s.exists() ? s.data().data : ""; } catch { B[u] = ""; } }
  return B[u];
}
const banCss = (b, n) => b ? `background-image:url(${b})` : `background:linear-gradient(135deg,hsl(${hue(n)},75%,75%),hsl(${(hue(n) + 50) % 360},70%,65%))`;
async function pgMe(pg) {
  const ban = await loadBanner(me.uid); if (S.tab !== "me") return;
  pg.innerHTML = `<div class="hero" style="${banCss(ban, me.name)}"></div>
    <div class="who2">${av(me.name, me.uid)}<h2>${esc(me.name)}${me.admin ? ' <span class="tag">admin</span>' : ""}</h2><p class="mut">${esc(me.bio || "Olá! Estou usando o Concord.")}</p><small>ID: ${me.publicId}</small></div>
    <div class="grid3"><button data-a="edit">${ic("user")}<span>Editar perfil</span></button><button data-a="qr">${ic("qr")}<span>Meu QR</span></button><button data-a="theme">${ic(isDark() ? "sun" : "moon")}<span>Tema</span></button></div>
    <div class="card"><button class="row3" data-a="addp">${ic("plus")}<span>Adicionar pessoa</span></button><button class="row3" data-a="newg">${ic("users")}<span>Novo grupo</span></button><button class="row3" data-a="out">${ic("out")}<span>Sair</span></button></div>`;
  const A = {edit: () => openProfile(me.uid), qr: showQr, theme: () => { theme(); renderList(); }, addp: addPersonModal, newg: newGroup, out: logout};
  pg.querySelectorAll("[data-a]").forEach(b => b.onclick = A[b.dataset.a]);
}
async function openProfile(u) {
  if (!P[u]?.name) { try { const s = await getDoc(doc(db, "users", u)); if (s.exists()) P[u] = s.data(); } catch {} }
  const p = P[u] || {}, ban = await loadBanner(u); let newPhoto = null, newBanner = null;
  const top = `<div class="pbn" id="pbn" style="${banCss(ban, p.name)}"></div><div class="pav" id="pav">${av(p.name, u)}</div>`;
  if (u !== me.uid) {
    const dm = S.chats.some(c => c.type !== "group" && c.members.includes(u));
    modal(top + `<h3>${esc(p.name || "")}</h3><small>${esc(p.bio || "")}</small>` + (dm ? '<div class="row2"><button class="btn" id="pc">Ligar</button><button class="btn" id="pv">Vídeo</button></div>' : ""));
    if (dm) { $("#pc").onclick = () => { closeModal(); startCall(u, p.name, false); }; $("#pv").onclick = () => { closeModal(); startCall(u, p.name, true); }; }
    return;
  }
  modal(top + `<label class="fbtn">Trocar foto de perfil<input type="file" id="fp" accept="image/*" hidden></label><label class="fbtn">Trocar banner (foto ou GIF animado)<input type="file" id="fb" accept="image/*" hidden></label><input id="pn" value="${esc(me.name)}" maxlength="20" placeholder="Nome"><input id="pb" value="${esc(me.bio || "")}" maxlength="60" placeholder="Recado (bio)"><button class="btn" id="psave">Salvar perfil</button><p id="addErr"></p>`);
  $("#fp").onchange = async e => { if (e.target.files[0]) { newPhoto = await shrink(e.target.files[0], 160, 160); $("#pav").innerHTML = `<div class="av"><img src="${newPhoto}" alt=""></div>`; } };
  $("#fb").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type === "image/gif" && f.size > 650000) return $("#addErr").textContent = "GIF muito grande. Use até 650 KB.";
    newBanner = f.type === "image/gif" ? await readFile(f) : await shrink(f, 720, 240);
    $("#pbn").style.cssText = `background-image:url(${newBanner})`;
  };
  $("#psave").onclick = async () => {
    const name = $("#pn").value.trim() || me.name, upd = {name, bio: $("#pb").value.trim()}; if (newPhoto) upd.photo = newPhoto;
    try {
      await updateDoc(doc(db, "users", me.uid), upd);
      if (newBanner) { await setDoc(doc(db, "banners", me.uid), {data: newBanner}); B[me.uid] = newBanner; }
    } catch { return $("#addErr").textContent = "Não foi possível salvar. Publique as novas regras no Firebase."; }
    if (name !== me.name) S.chats.forEach(c => updateDoc(doc(db, "chats", c.id), {["names." + me.uid]: name}).catch(() => {}));
    Object.assign(me, upd); P[me.uid] = me; await closeModal(); renderList();
  };
}

/* ---------- Ligações privadas (WebRTC) com compartilhamento de tela ---------- */
const ICE = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]};
let nativeShare = false, nsCanvas = null, nsCtx = null, nsBusy = false;
let pc = null, stream = null, share = null, vs = null, callRef = null, callUnsubs = [], callTimer = null;
async function hang(status = "ended") {
  callUnsubs.forEach(f => f()); callUnsubs = []; clearTimeout(callTimer);
  if (callRef) { updateDoc(callRef, {status}).catch(() => {}); callRef = null; }
  if (nativeShare) { nativeShare = false; try { NATIVE.stopScreenShare(); } catch {} }
  try { NATIVE?.callEnded?.(); } catch {}
  [stream, share].forEach(s => s && s.getTracks().forEach(t => t.stop()));
  pc && pc.close(); pc = stream = share = vs = null;
  $("#cv").hidden = true; $("#inc").hidden = true;
}
function showCall(name, u, video, st) {
  const cv = $("#cv"); cv.hidden = false; cv.className = "";
  try { NATIVE?.callStarted?.(); } catch {}
  cv.innerHTML = `<video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted hidden></video>
    <div class="who3">${av(name, u)}<h2>${esc(name)}</h2><small id="cst">${st}</small></div>
    <div class="ctl"><button id="cm" title="Microfone">${ic("mic")}</button>${video ? `<button id="cc" title="Câmera">${ic("video")}</button>` : ""}${navigator.mediaDevices?.getDisplayMedia || NATIVE?.startScreenShare ? `<button id="cs" title="Compartilhar tela">${ic("screen")}</button>` : ""}<button id="ce" class="end" title="Desligar">${ic("phone")}</button></div>`;
  if (video) { $("#lv").srcObject = stream; $("#lv").hidden = false; }
  $("#ce").onclick = () => hang();
  $("#cm").onclick = e => { const t = stream.getAudioTracks()[0]; t.enabled = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? "mic" : "micoff"); };
  if ($("#cc")) $("#cc").onclick = e => { const t = stream.getVideoTracks()[0]; t.enabled = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? "video" : "videooff"); };
  if ($("#cs")) $("#cs").onclick = toggleShare;
}
async function toggleShare() {
  if (share) return stopShare();
  if (!navigator.mediaDevices?.getDisplayMedia && NATIVE?.startScreenShare) {
    // celular (app): o Android captura a tela e manda quadros; aqui viram um vídeo para a ligação
    nsCanvas = document.createElement("canvas"); nsCanvas.width = 360; nsCanvas.height = 640; nsCtx = nsCanvas.getContext("2d");
    nsCtx.fillStyle = "#000"; nsCtx.fillRect(0, 0, 360, 640);
    share = nsCanvas.captureStream(8); nativeShare = true;
    const tr = share.getVideoTracks()[0]; await vs.replaceTrack(tr);
    $("#cs").classList.add("on"); NATIVE.startScreenShare();
    return;
  }
  try { share = await navigator.mediaDevices.getDisplayMedia({video: true}); } catch { return; }
  const tr = share.getVideoTracks()[0]; await vs.replaceTrack(tr); tr.onended = stopShare;
  $("#lv").srcObject = share; $("#lv").hidden = false; $("#cs").classList.add("on");
}
function stopShare() {
  if (!share) return;
  if (nativeShare) { nativeShare = false; try { NATIVE.stopScreenShare(); } catch {} }
  share.getTracks().forEach(t => t.stop()); share = null;
  const cam = stream?.getVideoTracks()[0] || null; vs && vs.replaceTrack(cam);
  if (cam) $("#lv").srcObject = stream; else $("#lv").hidden = true;
  $("#cs")?.classList.remove("on");
}
window.onScreenFrame = b64 => {
  if (nsBusy || !nsCanvas) return; nsBusy = true;
  const im = new Image();
  im.onload = () => { if (nsCanvas.width !== im.width) { nsCanvas.width = im.width; nsCanvas.height = im.height; } nsCtx.drawImage(im, 0, 0); nsBusy = false; };
  im.onerror = () => { nsBusy = false; };
  im.src = "data:image/jpeg;base64," + b64;
};
window.onScreenStopped = () => { nativeShare = false; stopShare(); };      // o usuário parou pela notificação do Android
window.onScreenError = m => { nativeShare = false; stopShare(); toast("Não foi possível compartilhar a tela" + (m ? ": " + m : ".")); };
function wire() {
  pc = new RTCPeerConnection(ICE);
  const rs = new MediaStream();
  pc.ontrack = e => {
    rs.addTrack(e.track); $("#rv").srcObject = rs; $("#cst").textContent = "Em chamada";
    if (e.track.kind === "video") { const f = () => $("#cv").classList.toggle("vid", !e.track.muted); e.track.onunmute = f; e.track.onmute = f; f(); }
  };
  pc.onconnectionstatechange = () => { if (pc?.connectionState === "failed") hang(); };
}
const media = async video => { try { return await navigator.mediaDevices.getUserMedia({audio: true, video}); } catch { alert("Não consegui acessar o microfone/câmera. Permita o acesso no navegador."); return null; } };
const onAdded = (ref, side) => onSnapshot(collection(ref, side), s => s.docChanges().forEach(c => c.type === "added" && pc?.addIceCandidate(new RTCIceCandidate(c.doc.data()))));

async function startCall(u, name, video) {
  if (pc || !u) return;
  stream = await media(video); if (!stream) return;
  showCall(name, u, video, "Chamando..."); wire();
  stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
  const vt = pc.addTransceiver("video", {direction: "sendrecv"}); vs = vt.sender;
  if (stream.getVideoTracks()[0]) await vs.replaceTrack(stream.getVideoTracks()[0]);
  callRef = doc(collection(db, "calls"));
  pc.onicecandidate = e => e.candidate && addDoc(collection(callRef, "callerCandidates"), e.candidate.toJSON());
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  await setDoc(callRef, {caller: me.uid, callerName: me.name, callee: u, video, status: "ringing", at: serverTimestamp(), offer: {type: offer.type, sdp: offer.sdp}});
  callUnsubs.push(onSnapshot(callRef, async s => {
    const d = s.data(); if (!d || !pc) return;
    if (d.answer && !pc.currentRemoteDescription) await pc.setRemoteDescription(d.answer);
    if (d.status === "declined") { $("#cst").textContent = "Chamada recusada"; callUnsubs.forEach(f => f()); callUnsubs = []; setTimeout(hang, 1500); }
    if (d.status === "ended") hang("ended");
  }));
  callUnsubs.push(onAdded(callRef, "calleeCandidates"));
  callTimer = setTimeout(() => { if ($("#cst")?.textContent === "Chamando...") hang(); }, 45000);
}
function incoming(d) {
  if (pc || answering === d.id || (d.at && Date.now() - d.at.toMillis() > 60000)) return;
  const box = $("#inc"); box.hidden = false; navigator.vibrate?.([300, 150, 300]);
  box.innerHTML = `${av(d.callerName, d.caller)}<h2>${esc(d.callerName)}</h2><small>${d.video ? "Chamada de vídeo" : "Ligação de voz"}</small><div class="ctl"><button class="no" id="ir" title="Recusar">${ic("phone")}</button><button class="yes" id="ia" title="Atender">${ic("phone")}</button></div>`;
  $("#ir svg").style.transform = "rotate(135deg)";
  const un = onSnapshot(doc(db, "calls", d.id), s => { if (s.data()?.status !== "ringing") { box.hidden = true; un(); } });
  $("#ir").onclick = () => updateDoc(doc(db, "calls", d.id), {status: "declined"});
  $("#ia").onclick = () => { box.hidden = true; un(); answer(d); };
}
async function answerById(id) {
  try {
    const d = (await getDoc(doc(db, "calls", id))).data();
    if (!d || d.status !== "ringing" || d.callee !== me.uid) return;
    answering = id; await answer({id, ...d});
  } catch {}
  answering = null;
}
async function answer(d) {
  stream = await media(d.video);
  if (!stream) return updateDoc(doc(db, "calls", d.id), {status: "declined"});
  showCall(d.callerName, d.caller, d.video, "Conectando..."); wire();
  callRef = doc(db, "calls", d.id);
  pc.onicecandidate = e => e.candidate && addDoc(collection(callRef, "calleeCandidates"), e.candidate.toJSON());
  await pc.setRemoteDescription(d.offer);
  stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
  const vt = pc.getTransceivers().find(t => t.receiver.track.kind === "video");
  if (vt) { vt.direction = "sendrecv"; vs = vt.sender; const v = stream.getVideoTracks()[0]; if (v) await vs.replaceTrack(v); }
  const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
  await updateDoc(callRef, {answer: {type: ans.type, sdp: ans.sdp}, status: "active"});
  callUnsubs.push(onAdded(callRef, "callerCandidates"));
  callUnsubs.push(onSnapshot(callRef, s => { if (s.data()?.status === "ended") hang("ended"); }));
}

/* ---------- Entrar com Google e primeiro acesso ---------- */
$("#bGoogle").onclick = async () => {
  err();
  if (NATIVE) return NATIVE.googleSignIn();   // no app, o login com Google é nativo
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (x) {
    err(x.code === "auth/popup-blocked" ? "O navegador bloqueou a janela do Google. Libere pop-ups para este site."
      : x.code === "auth/unauthorized-domain" ? "Adicione este domínio em Authentication > Configurações > Domínios autorizados."
      : x.code === "auth/operation-not-allowed" ? "Ative o provedor Google em Authentication > Método de login."
      : ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(x.code) ? ""
      : "Erro: " + (x.code || x.message));
  }
};
let setupUser = null;
function showSetup(u) {
  setupUser = u; $("#auth").hidden = true; $("#app").hidden = true; $("#setup").hidden = false;
  $("#stName").value = u.displayName || ""; $("#stErr").textContent = "";
}
$("#stCancel").onclick = () => signOut(auth);
$("#fSetup").onsubmit = async e => {
  e.preventDefault();
  const u = setupUser, er = t => $("#stErr").textContent = t;
  const name = $("#stName").value.trim();
  if (!name) return er("Digite seu nome.");
  try {
    let id = null;
    for (let i = 0; !id && i < 6; i++) {
      const t = newId();
      if ((await getDocs(query(collection(db, "users"), where("publicId", "==", t)))).empty) id = t;
    }
    const data = {name, publicId: id, createdAt: serverTimestamp()};
    if (u.photoURL) data.photo = u.photoURL;
    await setDoc(doc(db, "users", u.uid), data);
  } catch (x) {
    return er(x.code === "permission-denied" ? "Sem permissão. Publique as novas regras do Firestore." : "Erro: " + (x.code || x.message));
  }
  await enter(u);
};
