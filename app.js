/* JurisRévise — logique des jeux */
"use strict";

/* ---------- utilitaires ---------- */
const $ = (sel) => document.querySelector(sel);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function annee(dateISO) { return dateISO.slice(0, 4); }
function dateFr(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const mois = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${d} ${mois[m - 1]} ${y}`;
}

function normaliserNom(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/* ---------- progression (localStorage) ---------- */
const store = {
  key: "jurisrevise-v1",
  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
    catch { return {}; }
  },
  save(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  record(matiere, mode, score, total) {
    const d = this.load();
    const k = `${matiere}:${mode}`;
    if (!d[k]) d[k] = { sessions: 0, meilleur: 0, dernier: 0, totalQ: 0, totalOk: 0 };
    d[k].sessions += 1;
    d[k].dernier = score;
    d[k].meilleur = Math.max(d[k].meilleur, score);
    d[k].totalQ += total;
    d[k].totalOk += score;
    this.save(d);
    return d[k];
  },
  get(matiere, mode) { return this.load()[`${matiere}:${mode}`] || null; },
};

/* ---------- état global ---------- */
const state = {
  matiere: null,
  mode: null,
  session: null, // { questions: [...], index, score }
};

const SESSION_SIZE = 8;

function arretsMatiere(m) { return ARRETS.filter((a) => a.matiere === m); }

/* ---------- navigation écrans ---------- */
const screens = ["home", "modes", "game", "end"];
function show(name) {
  screens.forEach((s) => $("#screen-" + s).classList.toggle("hidden", s !== name));
  $("#btn-home").classList.toggle("hidden", name === "home");
  $("#score-chip").classList.toggle("hidden", name === "home");
  window.scrollTo({ top: 0 });
}

function updateScoreChip() {
  if (state.session) {
    $("#score-chip").textContent = `Score : ${state.session.score}/${state.session.questions.length}`;
  }
}

function renderHome() {
  $("#count-admin").textContent = `${arretsMatiere("admin").length} arrêts à réviser`;
  $("#count-obligations").textContent = `${arretsMatiere("obligations").length} arrêts à réviser`;
  const d = store.load();
  const lignes = [];
  for (const m of ["admin", "obligations"]) {
    const stats = MODES.map((mo) => store.get(m, mo.id)).filter(Boolean);
    if (stats.length) {
      const totalQ = stats.reduce((s, x) => s + x.totalQ, 0);
      const totalOk = stats.reduce((s, x) => s + x.totalOk, 0);
      lignes.push(`<strong>${MATIERES[m].label}</strong> : ${stats.length} mode(s) joué(s), précision globale ${(100 * totalOk / totalQ).toFixed(0)} %`);
    }
  }
  $("#stats-box").innerHTML = lignes.length
    ? "📊 Ta progression :<br>" + lignes.join("<br>")
    : "Aucune session enregistrée pour le moment — lance-toi !";
  show("home");
}

function renderModes() {
  $("#modes-title").textContent = MATIERES[state.matiere].label;
  const list = $("#modes-list");
  list.innerHTML = "";
  MODES.forEach((mo) => {
    const st = store.get(state.matiere, mo.id);
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<span class="card-title">${mo.label}</span>
      <span class="desc">${mo.desc}</span>
      <span class="card-count">${st ? `Dernière session : ${st.dernier}/${SESSION_SIZE} · Meilleur : ${st.meilleur}/${SESSION_SIZE}` : "Jamais joué"}</span>`;
    btn.addEventListener("click", () => startSession(mo.id));
    list.appendChild(btn);
  });
  show("modes");
}

/* ---------- gestion de session ---------- */
function startSession(mode) {
  state.mode = mode;
  const pool = arretsMatiere(state.matiere);
  state.session = { questions: pick(pool, SESSION_SIZE), index: 0, score: 0 };
  $("#game-mode-label").textContent = `${MATIERES[state.matiere].label} · ${MODES.find((m) => m.id === mode).label}`;
  show("game");
  renderQuestion();
}

function questionCourante() { return state.session.questions[state.session.index]; }

function setProgress() {
  const s = state.session;
  $("#game-progress").textContent = `Question ${s.index + 1}/${s.questions.length}`;
  updateScoreChip();
}

function feedback(ok, texte, portee) {
  const f = $("#feedback");
  f.className = "feedback " + (ok ? "good" : "bad");
  f.innerHTML = (ok ? "✅ " : "❌ ") + escapeHtml(texte) +
    (portee ? `<span class="portee">💡 ${escapeHtml(portee)}</span>` : "");
  f.classList.remove("hidden");
}

function nextOrEnd() {
  const s = state.session;
  $("#btn-next").classList.add("hidden");
  $("#feedback").classList.add("hidden");
  if (s.index + 1 >= s.questions.length) { endSession(); return; }
  s.index++;
  renderQuestion();
}

function endSession() {
  const s = state.session;
  store.record(state.matiere, state.mode, s.score, s.questions.length);
  const pct = Math.round((100 * s.score) / s.questions.length);
  const msg = pct === 100 ? "Sans faute, bravo ! 🏆"
    : pct >= 75 ? "Très bien, continue comme ça ! 💪"
    : pct >= 50 ? "Pas mal, encore un petit effort. 📚"
    : "C'est en révisant qu'on progresse — retente ta chance ! 🔁";
  $("#end-stats").innerHTML =
    `<div class="big-score">${s.score} / ${s.questions.length}</div>
     <div>${pct} % de réussite — ${msg}</div>
     <div style="color:var(--muted);margin-top:8px">${MATIERES[state.matiere].label} · ${MODES.find((m) => m.id === state.mode).label}</div>`;
  show("end");
}

/* ---------- rendu des jeux ---------- */
function renderQuestion() {
  setProgress();
  $("#feedback").classList.add("hidden");
  $("#btn-next").classList.add("hidden");
  const area = $("#game-area");
  area.innerHTML = "";
  ({ qcm: renderQCM, flash: renderFlash, "vrai-faux": renderVraiFaux,
     dates: renderDates, match: renderMatch, trous: renderTrous })[state.mode](area, questionCourante());
}

/* 1. QCM : quel arrêt correspond à ce principe ? */
function renderQCM(area, a) {
  const distracteurs = pick(ARRETS.filter((x) => x.id !== a.id), 3);
  const options = shuffle([a, ...distracteurs]);
  area.innerHTML = `<div class="question"><span class="jurid">${escapeHtml(a.juridiction)} · ${annee(a.date)}</span>
    ${escapeHtml(a.principe)}</div>
    <div class="choices"></div>`;
  const box = area.querySelector(".choices");
  options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.textContent = `${opt.nom} (${annee(opt.date)})`;
    b.addEventListener("click", () => {
      const ok = opt.id === a.id;
      box.querySelectorAll(".choice").forEach((c) => {
        c.disabled = true;
        if (c.textContent.startsWith(a.nom)) c.classList.add("correct");
      });
      if (!ok) b.classList.add("wrong");
      if (ok) state.session.score++;
      feedback(ok, ok ? "C'est bien cet arrêt !" : `Non — c'était ${a.nom} (${dateFr(a.date)}).`, a.portee);
      $("#btn-next").classList.remove("hidden");
      updateScoreChip();
    });
    box.appendChild(b);
  });
}

/* 2. Flashcards : principe → retourner pour voir l'arrêt */
function renderFlash(area, a) {
  area.innerHTML = `
    <div class="flashcard" id="flashcard">
      <div class="flash-inner">
        <div class="flash-face front">
          <span class="hint">Principe — clique pour révéler l'arrêt</span>
          <span>${escapeHtml(a.principe)}</span>
          <span class="hint">${escapeHtml(a.juridiction)}</span>
        </div>
        <div class="flash-face back">
          <span class="hint">Arrêt</span>
          <span class="big">${escapeHtml(a.nom)}</span>
          <span class="date">${escapeHtml(a.juridiction)} · ${dateFr(a.date)}</span>
          <span class="hint">${escapeHtml(a.portee)}</span>
        </div>
      </div>
    </div>
    <p style="text-align:center;color:var(--muted);margin-top:14px">As-tu retenu cet arrêt ?</p>
    <div class="row" style="justify-content:center;margin-top:10px">
      <button class="btn primary" id="flash-ok">✅ Je savais</button>
      <button class="btn" id="flash-ko">❌ Je ne savais pas</button>
    </div>`;
  $("#flashcard").addEventListener("click", () => $("#flashcard").classList.toggle("flipped"));
  $("#flash-ok").addEventListener("click", () => {
    state.session.score++;
    feedback(true, "Bien retenu !", a.portee);
    $("#btn-next").classList.remove("hidden"); updateScoreChip();
  });
  $("#flash-ko").addEventListener("click", () => {
    feedback(false, "À revoir : " + a.nom + " (" + dateFr(a.date) + ").", a.portee);
    $("#btn-next").classList.remove("hidden");
  });
}

/* 3. Vrai ou Faux : ce principe est-il celui de cet arrêt ? */
function renderVraiFaux(area, a) {
  const vrai = Math.random() < 0.5;
  const autre = pick(ARRETS.filter((x) => x.id !== a.id), 1)[0];
  const principeAffiche = vrai ? a.principe : autre.principe;
  const bonneReponse = vrai ? a.nom : autre.nom;
  area.innerHTML = `<div class="question"><span class="jurid">Arrêt : ${escapeHtml(a.nom)} · ${escapeHtml(a.juridiction)} · ${annee(a.date)}</span>
    « ${escapeHtml(principeAffiche)} »<br><br>Ce principe correspond-il bien à cet arrêt ?</div>
    <div class="row">
      <button class="btn primary" id="vf-vrai">Vrai</button>
      <button class="btn primary" id="vf-faux">Faux</button>
    </div>`;
  const answer = (ditVrai) => {
    const ok = ditVrai === vrai;
    if (ok) state.session.score++;
    feedback(ok,
      ok ? (vrai ? "Exact, c'est bien le principe de cet arrêt." : "Exact, ce principe appartient à un autre arrêt.")
         : (vrai ? "Faux : ce principe était bien celui de cet arrêt." : `Faux : ce principe est celui de ${autre.nom}.`),
      bonneReponse.portee);
    $("#btn-next").classList.remove("hidden");
    updateScoreChip();
  };
  $("#vf-vrai").addEventListener("click", () => answer(true));
  $("#vf-faux").addEventListener("click", () => answer(false));
}

/* 4. Chronologie : remettre 5 arrêts dans l'ordre */
function renderDates(area) {
  const s = state.session;
  const items = pick(arretsMatiere(state.matiere), 5);
  const ordre = shuffle(items);
  area.innerHTML = `<div class="question">Remets ces arrêts dans l'ordre chronologique (du plus ancien au plus récent) :</div>
    <div class="timeline-list"></div>
    <div class="row" style="margin-top:16px"><button class="btn primary" id="tl-check">Vérifier</button></div>`;
  const list = area.querySelector(".timeline-list");
  ordre.forEach((a) => {
    const div = document.createElement("div");
    div.className = "tl-item";
    div.dataset.id = a.id;
    div.innerHTML = `<span class="tl-name">${escapeHtml(a.nom)}</span>
      <select><option value="">rang…</option>${[1,2,3,4,5].map((n) => `<option value="${n}">${n}ᵉ</option>`).join("")}</select>`;
    list.appendChild(div);
  });
  $("#tl-check").addEventListener("click", () => {
    let ok = true;
    const dejaPris = new Set();
    list.querySelectorAll(".tl-item").forEach((div) => {
      const sel = div.querySelector("select");
      sel.disabled = true;
      const rang = Number(sel.value);
      const attendu = items.findIndex((x) => x.id === div.dataset.id) + 1;
      const valide = rang === attendu && !dejaPris.has(rang);
      if (!valide) ok = false; else dejaPris.add(rang);
      div.classList.add(valide ? "correct" : "wrong");
    });
    if (ok) s.score++;
    const attenduTxt = items.map((x, i) => `${i + 1}. ${x.nom} (${annee(x.date)})`).join(" — ");
    feedback(ok, ok ? "Ordre parfait !" : "Pas tout à fait. Ordre attendu : " + attenduTxt, null);
    $("#btn-next").classList.remove("hidden");
    updateScoreChip();
  });
}

/* 5. Associer : arrêt ↔ année (ou juridiction) */
function renderMatch(area) {
  const s = state.session;
  const items = pick(arretsMatiere(state.matiere), 5);
  const useJurid = Math.random() < 0.5;
  const valeurs = shuffle(items.map((a) => useJurid ? a.juridiction : annee(a.date)));
  let selected = null;
  let found = 0;
  area.innerHTML = `<div class="question">Associe chaque arrêt à sa ${useJurid ? "juridiction" : "année"} :</div>
    <div class="match-grid">
      <div class="match-col" id="col-gauche"></div>
      <div class="match-col" id="col-droite"></div>
    </div>`;
  const g = $("#col-gauche"), d = $("#col-droite");
  items.forEach((a) => {
    const el = document.createElement("div");
    el.className = "match-item";
    el.dataset.id = a.id;
    el.textContent = a.nom;
    g.appendChild(el);
  });
  valeurs.forEach((v, i) => {
    const el = document.createElement("div");
    el.className = "match-item";
    el.dataset.val = v;
    el.textContent = v;
    d.appendChild(el);
  });
  function onClick(el, isLeft) {
    if (el.classList.contains("matched")) return;
    if (isLeft) {
      g.querySelectorAll(".match-item").forEach((x) => x.classList.remove("selected"));
      el.classList.add("selected");
      selected = { id: el.dataset.id, el };
    } else {
      if (!selected) return;
      const a = items.find((x) => x.id === selected.id);
      const attendu = useJurid ? a.juridiction : annee(a.date);
      if (el.dataset.val === attendu) {
        el.classList.add("matched");
        selected.el.classList.add("matched");
        found++;
        selected = null;
        if (found === items.length) {
          s.score++;
          feedback(true, "Toutes les associations sont correctes !", null);
          $("#btn-next").classList.remove("hidden");
          updateScoreChip();
        }
      } else {
        el.classList.add("shake");
        setTimeout(() => el.classList.remove("shake"), 350);
      }
    }
  }
  g.querySelectorAll(".match-item").forEach((el) => el.addEventListener("click", () => onClick(el, true)));
  d.querySelectorAll(".match-item").forEach((el) => el.addEventListener("click", () => onClick(el, false)));
}

/* 6. Arrêt mystère : deviner le nom à partir d'indices */
function renderTrous(area, a) {
  area.innerHTML = `<div class="question">🔍 Arrêt mystère</div>
    <div class="mystery">
      <div class="clues">
        Juridiction : <strong>${escapeHtml(a.juridiction)}</strong><br>
        Date : <strong>${dateFr(a.date)}</strong><br>
        Principe : <em>${escapeHtml(a.principe)}</em>
      </div>
      <input type="text" id="mystery-input" placeholder="Nom de l'arrêt…" autocomplete="off">
      <div class="row" style="justify-content:center;margin-top:14px">
        <button class="btn primary" id="mystery-check">Valider</button>
      </div>
    </div>`;
  const input = $("#mystery-input");
  const check = () => {
    const rep = normaliserNom(input.value);
    const attendu = normaliserNom(a.nom);
    const ok = rep.length > 0 && (rep === attendu || attendu.includes(rep) || rep.includes(attendu));
    if (ok) state.session.score++;
    input.disabled = true;
    feedback(ok, ok ? `Bravo, c'était bien ${a.nom} !` : `C'était ${a.nom} (${dateFr(a.date)}).`, a.portee);
    $("#btn-next").classList.remove("hidden");
    updateScoreChip();
  };
  $("#mystery-check").addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  input.focus();
}

/* ---------- événements généraux ---------- */
document.querySelectorAll(".card[data-matiere]").forEach((btn) => {
  btn.addEventListener("click", () => { state.matiere = btn.dataset.matiere; renderModes(); });
});
$("#btn-home").addEventListener("click", renderHome);
$("#btn-quit").addEventListener("click", renderModes);
$("#btn-next").addEventListener("click", nextOrEnd);
$("#btn-retry").addEventListener("click", () => startSession(state.mode));
$("#btn-back-modes").addEventListener("click", renderModes);
$("#btn-back-home").addEventListener("click", renderHome);

renderHome();
