import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,addDoc,updateDoc,deleteDoc,arrayUnion,collection,query,where,orderBy,onSnapshot,getDocs,writeBatch,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 13, 0) % 360;
const hm = ts => ts ? ts.toDate().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) : "";
const MAIL = "@conecta.app";   // mantido para as contas já criadas continuarem funcionando
const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newId = () => Array.from({length: 8}, () => CH[Math.floor(Math.random() * CH.length)]).join("");
const COLORS = ["#5ba8ff", "#7cc0ff", "#a78bfa", "#f78fb3", "#ffb86b", "#5fd3b6", "#4a6fa5", "#2f4f93"];
let me = null, cur = null, unsubs = [], unsubMsgs = null, busy = false, scanner = null;
const S = {tab: "chats", chats: [], st: [], q: ""};
const err = t => $("#err").textContent = t || "";

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
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
$$("[data-i]").forEach(e => e.innerHTML = ic(e.dataset.i));

/* ---------- Avatares e perfis em cache ---------- */
const P = {};
const av = (n, u, sq) => {
  const p = u && P[u]?.photo, c = sq ? " sq" : "";
  return p ? `<div class="av${c}"><img src="${p}" alt=""></div>`
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
function tab(entrar) {
  $("#fIn").hidden = !entrar; $("#fUp").hidden = entrar;
  $("#tabIn").classList.toggle("on", entrar); $("#tabUp").classList.toggle("on", !entrar); err();
}
$("#tabIn").onclick = () => tab(true);
$("#tabUp").onclick = () => tab(false);
$("#fUp").onsubmit = async e => {
  e.preventDefault(); err(); busy = true;
  const name = $("#upName").value.trim(), token = $("#upToken").value.trim(), pw = $("#upPw").value;
  try {
    let cred, id;
    for (let i = 0; i < 5 && !cred; i++) {
      id = newId();
      try { cred = await createUserWithEmailAndPassword(auth, id.toLowerCase() + MAIL, pw); }
      catch (x) { if (x.code !== "auth/email-already-in-use") throw x; }
    }
    try { await setDoc(doc(db, "users", cred.user.uid), {name, publicId: id, token, createdAt: serverTimestamp()}); }
    catch (x) { await cred.user.delete(); throw {code: x.code === "permission-denied" ? "token" : (x.code || x.message)}; }
    await enter(cred.user);
  } catch (x) {
    err(x.code === "token" ? "Token inválido, ou as regras do Firestore ainda não foram publicadas."
      : x.code === "auth/weak-password" ? "A senha precisa ter 6 ou mais caracteres."
      : x.code === "auth/operation-not-allowed" ? "Ative o login por E-mail/senha no Firebase (Authentication)."
      : x.code === "auth/unauthorized-domain" ? "Adicione este domínio em Authentication > Configurações > Domínios autorizados."
      : "Erro: " + (x.code || x.message));
  }
  busy = false;
};
$("#fIn").onsubmit = async e => {
  e.preventDefault(); err();
  try { await signInWithEmailAndPassword(auth, $("#inId").value.trim().toLowerCase() + MAIL, $("#inPw").value); }
  catch { err("ID ou senha incorretos."); }
};
onAuthStateChanged(auth, u => { if (busy) return; u ? enter(u) : leave(); });

async function enter(u) {
  const s = await getDoc(doc(db, "users", u.uid));
  if (!s.exists()) { await signOut(auth); return err("Conta sem perfil."); }
  me = {uid: u.uid, ...s.data()}; P[me.uid] = me;
  $("#auth").hidden = true; $("#app").hidden = false;
  unsubs = [
    onSnapshot(query(collection(db, "chats"), where("members", "array-contains", me.uid)), s => { S.chats = s.docs.map(d => ({id: d.id, ...d.data()})); renderList(); }),
    onSnapshot(query(collection(db, "statuses"), where("viewers", "array-contains", me.uid)), s => {
      const lim = Date.now() - 864e5;
      S.st = s.docs.map(d => ({id: d.id, ...d.data()})).filter(x => !x.at || x.at.toMillis() > lim); renderList();
    }),
    onSnapshot(query(collection(db, "calls"), where("callee", "==", me.uid), where("status", "==", "ringing")),
      s => s.docChanges().forEach(c => c.type === "added" && incoming({id: c.doc.id, ...c.doc.data()})))
  ];
  renderList();
}
function leave() {
  hang(); unsubs.forEach(f => f()); unsubs = []; unsubMsgs && unsubMsgs();
  me = cur = null; S.chats = []; S.st = []; $("#app").hidden = true; $("#auth").hidden = false;
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
    t.innerHTML = av(c.name, null, 1) + `<small>${esc(c.name)}</small>`; t.onclick = () => openChat(c); $("#tiles").append(t);
  });
  const n = document.createElement("button"); n.className = "tile";
  n.innerHTML = `<div class="av sq plus">${ic("plus")}</div><small>Criar</small>`; n.onclick = newGroup; $("#tiles").append(n);
  if (!rows.length) $("#rows").innerHTML = '<p class="empty">Nenhuma conversa ainda. Toque em + para adicionar alguém.</p>';
  ensureP(rows.map(other));
  rows.forEach(c => {
    const b = document.createElement("button"); b.className = "ci" + (cur?.id === c.id ? " on" : "");
    b.innerHTML = av(title(c), other(c)) + `<div class="mid"><b>${esc(title(c))}</b><small>${esc(c.last || "Diga olá")}</small></div><time>${hm(c.updatedAt)}</time>`;
    b.onclick = () => openChat(c); $("#rows").append(b);
  });
}
function chooser() {
  modal('<h3>Adicionar</h3><button class="fbtn" id="c1">Adicionar pessoa (QR ou ID)</button><button class="fbtn" id="c2">Criar grupo</button>');
  $("#c1").onclick = addPersonModal; $("#c2").onclick = newGroup;
}

/* ---------- Chat em tempo real ---------- */
function openChat(c) {
  cur = c; unsubMsgs && unsubMsgs();
  const g = c.type === "group";
  ensureP([other(c)]);
  $("#chHead").innerHTML = av(title(c), other(c)) + `<div class="grow"><b>${esc(title(c))}</b><small>${g ? esc(Object.values(c.names).join(", ")) : "Toque para ver o perfil"}</small></div>`;
  $("#chHead").onclick = () => g || openProfile(other(c));
  $("#bCall").hidden = $("#bVid").hidden = g; $("#bMem").hidden = !(g && c.owner === me.uid);
  $("#app").classList.add("inchat"); renderList();
  unsubMsgs = onSnapshot(query(collection(db, "chats", c.id, "messages"), orderBy("at")), s => {
    const box = $("#msgs"); box.innerHTML = "";
    if (s.empty) box.innerHTML = '<p class="empty">Nenhuma mensagem ainda. Diga olá.</p>';
    s.docs.forEach(d => {
      const m = d.data(), mine = m.from === me.uid, p = document.createElement("div");
      p.className = "m" + (mine ? " me" : "");
      p.innerHTML = (g && !mine ? `<span class="who" style="color:hsl(${hue(m.name)},60%,45%)">${esc(m.name || "")}</span>` : "") + `<span>${esc(m.text)}</span><time>${hm(m.at)}</time>`;
      box.append(p);
    });
    box.scrollTop = box.scrollHeight;
  });
}
$("#fSend").onsubmit = async e => {
  e.preventDefault();
  const t = $("#txt").value.trim(); if (!t || !cur) return;
  $("#txt").value = "";
  const b = writeBatch(db);
  b.set(doc(collection(db, "chats", cur.id, "messages")), {from: me.uid, name: me.name, text: t, at: serverTimestamp()});
  b.update(doc(db, "chats", cur.id), {last: (cur.type === "group" ? me.name + ": " : "") + t, updatedAt: serverTimestamp()});
  await b.commit();
};
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
function newGroup() {
  modal('<h3>Novo grupo</h3><input id="gn" maxlength="30" placeholder="Nome do grupo"><textarea id="gm" placeholder="IDs das pessoas, separados por vírgula (opcional)"></textarea><button class="btn" id="go">Criar grupo</button><p id="addErr"></p>');
  $("#go").onclick = async () => {
    const name = $("#gn").value.trim(); if (!name) return $("#addErr").textContent = "Dê um nome ao grupo.";
    const found = await findUsers($("#gm").value.split(/[,\s]+/));
    const members = [me.uid, ...found.map(d => d.id).filter(i => i !== me.uid)], names = {[me.uid]: me.name};
    found.forEach(d => names[d.id] = d.data().name);
    const ref = doc(collection(db, "chats")), data = {type: "group", name, owner: me.uid, members, names, last: "", updatedAt: serverTimestamp()};
    await setDoc(ref, data); await closeModal(); S.tab = "chats"; openChat({id: ref.id, ...data});
  };
}
$("#bMem").onclick = () => {
  modal('<h3>Adicionar ao grupo</h3><input id="addId" placeholder="ID da pessoa" maxlength="8"><button class="btn" id="go">Adicionar</button><p id="addErr"></p>');
  $("#go").onclick = async () => {
    const [o] = await findUsers([$("#addId").value]); if (!o) return $("#addErr").textContent = "ID não encontrado.";
    if (cur.members.includes(o.id)) return $("#addErr").textContent = "Essa pessoa já está no grupo.";
    await updateDoc(doc(db, "chats", cur.id), {members: arrayUnion(o.id), ["names." + o.id]: o.data().name});
    cur.members.push(o.id); cur.names[o.id] = o.data().name; await closeModal(); openChat(cur);
  };
};

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
  if (!x) { sv.hidden = true; return; }
  sv.hidden = false; sv.style.background = x.color;
  sv.innerHTML = `<div class="svb">${list.map((_, k) => `<i class="${k <= i ? "f" : ""}"></i>`).join("")}</div>
    <div class="svh">${av(x.name, x.uid)}<div class="grow"><b>${esc(x.name)}</b><small style="color:#fffc">${hm(x.at)}</small></div>${x.uid === me.uid ? '<button id="svd">Apagar</button>' : ""}<button id="svx">Fechar</button></div><p>${esc(x.text)}</p>`;
  sv.onclick = e => {
    if (e.target.id === "svx") sv.hidden = true;
    else if (e.target.id === "svd") { deleteDoc(doc(db, "statuses", x.id)); sv.hidden = true; }
    else viewStatus(list, i + 1);
  };
}
function postStatus() {
  let col = COLORS[0];
  modal(`<h3>Novo status</h3><textarea id="stx" maxlength="140" placeholder="O que você está pensando?"></textarea><div class="sw">${COLORS.map((c, i) => `<i data-c="${c}" class="${i ? "" : "on"}" style="background:${c}"></i>`).join("")}</div><button class="btn" id="spub">Publicar</button>`);
  $$(".sw i").forEach(i => i.onclick = () => { col = i.dataset.c; $$(".sw i").forEach(k => k.classList.toggle("on", k === i)); });
  $("#spub").onclick = async () => {
    const text = $("#stx").value.trim(); if (!text) return;
    const viewers = [...new Set([me.uid, ...S.chats.filter(c => c.type !== "group").map(other)])];
    await setDoc(doc(collection(db, "statuses")), {uid: me.uid, name: me.name, text, color: col, at: serverTimestamp(), viewers});
    await closeModal(); S.tab = "status"; renderList();
  };
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
  const A = {edit: () => openProfile(me.uid), qr: showQr, theme: () => { theme(); renderList(); }, addp: addPersonModal, newg: newGroup, out: () => signOut(auth)};
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
let pc = null, stream = null, share = null, vs = null, callRef = null, callUnsubs = [], callTimer = null;
async function hang(status = "ended") {
  callUnsubs.forEach(f => f()); callUnsubs = []; clearTimeout(callTimer);
  if (callRef) { updateDoc(callRef, {status}).catch(() => {}); callRef = null; }
  [stream, share].forEach(s => s && s.getTracks().forEach(t => t.stop()));
  pc && pc.close(); pc = stream = share = vs = null;
  $("#cv").hidden = true; $("#inc").hidden = true;
}
function showCall(name, u, video, st) {
  const cv = $("#cv"); cv.hidden = false; cv.className = "";
  cv.innerHTML = `<video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted hidden></video>
    <div class="who3">${av(name, u)}<h2>${esc(name)}</h2><small id="cst">${st}</small></div>
    <div class="ctl"><button id="cm" title="Microfone">${ic("mic")}</button>${video ? `<button id="cc" title="Câmera">${ic("video")}</button>` : ""}${navigator.mediaDevices?.getDisplayMedia ? `<button id="cs" title="Compartilhar tela">${ic("screen")}</button>` : ""}<button id="ce" class="end" title="Desligar">${ic("phone")}</button></div>`;
  if (video) { $("#lv").srcObject = stream; $("#lv").hidden = false; }
  $("#ce").onclick = () => hang();
  $("#cm").onclick = e => { const t = stream.getAudioTracks()[0]; t.enabled = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? "mic" : "micoff"); };
  if ($("#cc")) $("#cc").onclick = e => { const t = stream.getVideoTracks()[0]; t.enabled = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? "video" : "videooff"); };
  if ($("#cs")) $("#cs").onclick = toggleShare;
}
async function toggleShare() {
  if (share) return stopShare();
  try { share = await navigator.mediaDevices.getDisplayMedia({video: true}); } catch { return; }
  const tr = share.getVideoTracks()[0]; await vs.replaceTrack(tr); tr.onended = stopShare;
  $("#lv").srcObject = share; $("#lv").hidden = false; $("#cs").classList.add("on");
}
function stopShare() {
  if (!share) return;
  share.getTracks().forEach(t => t.stop()); share = null;
  const cam = stream?.getVideoTracks()[0] || null; vs && vs.replaceTrack(cam);
  if (cam) $("#lv").srcObject = stream; else $("#lv").hidden = true;
  $("#cs")?.classList.remove("on");
}
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
  if (pc || (d.at && Date.now() - d.at.toMillis() > 60000)) return;
  const box = $("#inc"); box.hidden = false; navigator.vibrate?.([300, 150, 300]);
  box.innerHTML = `${av(d.callerName, d.caller)}<h2>${esc(d.callerName)}</h2><small>${d.video ? "Chamada de vídeo" : "Ligação de voz"}</small><div class="ctl"><button class="no" id="ir" title="Recusar">${ic("phone")}</button><button class="yes" id="ia" title="Atender">${ic("phone")}</button></div>`;
  $("#ir svg").style.transform = "rotate(135deg)";
  const un = onSnapshot(doc(db, "calls", d.id), s => { if (s.data()?.status !== "ringing") { box.hidden = true; un(); } });
  $("#ir").onclick = () => updateDoc(doc(db, "calls", d.id), {status: "declined"});
  $("#ia").onclick = () => { box.hidden = true; un(); answer(d); };
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
