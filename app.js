/* 隨身讀書館：首頁（倒數/進度/鼓勵）、試卷（模考引擎）、單字卡、筆記速查 */
const $app = document.getElementById("app");
const EXAM_DATE = "2026-08-30";
const LS_SESS = "examweb.sessions.v1";
const LS_VOCAB = "hub.vocab.v1";
const LS_DAILY = "hub.daily.v1";

/* ================= 分頁 ================= */
const tabbar = document.getElementById("tabbar");
tabbar.addEventListener("click", e => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});
function switchTab(name) {
  clearInterval(timerId);
  tabbar.querySelectorAll("button").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name));
  ({ home: showHomeTab, drill: showDrillTab, exam: showExamTab, vocab: showVocabTab, notes: showNotesTab }[name])();
}

/* ================= 首頁 ================= */
const QUOTES = [
  "今天讓一個混亂的觀念變清楚，就是勝利。",
  "你不需要一次讀完，只需要今天的 1.5 小時。",
  "錯題是禮物——考前錯，就是考場上的對。",
  "數字會背叛記憶，但速查表不會。多看一眼。",
  "穩穩的，每天前進一點，8/30 的你會感謝現在的你。",
  "公車上的十分鐘，也是別人沒有的十分鐘。",
  "與其焦慮還有多少沒讀，不如把眼前這一題弄懂。",
  "考試考的是熟練，不是天分。你正在變熟練。",
  "累的時候休息，不是放棄。回來再繼續就好。",
  "已經走到這裡了，剩下的路比走過的短。"
];
const SCHEDULE = [
  { date: "2026-07-31", label: "民法全真卷", subject: "民法" },
  { date: "2026-08-07", label: "郵政法規全真卷", subject: "郵政法規" },
  { date: "2026-08-14", label: "英文全真卷", subject: "英文" },
  { date: "2026-08-21", label: "國文全真卷", subject: "國文" },
  { date: "2026-08-26", label: "二輪模擬（8/26–28）" },
  { date: "2026-08-30", label: "🎯 郵政升等考" }
];
const DEFAULT_PLAN = [
  "刷題或補未訂正題（30 分）",
  "訂正 3～5 題（40 分）",
  "挑出今天最重要的 1 個觀念（15 分）",
  "標記明天要回看的題（5 分）"
];
const LS_PLAN = "hub.plan.v1";
let planEditing = false;

function getPlan() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PLAN));
    if (Array.isArray(p) && p.length) return p;
  } catch {}
  return DEFAULT_PLAN.slice();
}
function savePlan(p) { localStorage.setItem(LS_PLAN, JSON.stringify(p)); }

function todayKey() { return new Date().toISOString().slice(0, 10); }
function daysLeft() {
  const ms = new Date(EXAM_DATE + "T00:00:00") - new Date(todayKey() + "T00:00:00");
  return Math.round(ms / 86400000);
}
function dailyState() {
  try { return JSON.parse(localStorage.getItem(LS_DAILY)) || {}; } catch { return {}; }
}
function toggleDaily(i) {
  const all = dailyState();
  const day = all[todayKey()] || [];
  day[i] = !day[i];
  all[todayKey()] = day;
  localStorage.setItem(LS_DAILY, JSON.stringify(all));
  showHomeTab();
}
function addPlanItem() {
  const el = document.getElementById("new-plan");
  const t = el.value.trim();
  if (!t) return;
  const p = getPlan();
  p.push(t);
  savePlan(p);
  showHomeTab();
}
function removePlanItem(i) {
  const p = getPlan();
  p.splice(i, 1);
  savePlan(p.length ? p : DEFAULT_PLAN.slice());
  showHomeTab();
}
function togglePlanEdit() { planEditing = !planEditing; showHomeTab(); }

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return "🌙 夜深了，看一點就去睡";
  if (h < 11) return "☀️ 早安，新的一天";
  if (h < 14) return "🍱 午安，休息片刻";
  if (h < 18) return "🌤 午後時光";
  return "🌆 晚上好，今天辛苦了";
}

async function showHomeTab() {
  let sp = {};
  try {
    const r = await fetch("data/progress.json", { cache: "no-store" });
    if (r.ok) sp = await r.json();
  } catch {}
  const d = daysLeft();
  const quote = QUOTES[(d + 7) % QUOTES.length];
  const plan = getPlan();
  const local = dailyState()[todayKey()] || [];
  const server = sp[todayKey()] || [];
  const done = plan.map((_, i) => !!(local[i] || server[i]));
  const doneCount = done.filter(Boolean).length;
  const upcoming = SCHEDULE.filter(x => x.date >= todayKey()).slice(0, 3);

  // 快速入口素材：進行中／未開始的卷
  let quick = "";
  try {
    if (!exams.length) {
      const r = await fetch("exams/index.json", { cache: "no-store" });
      exams = await r.json();
    }
    const all = loadSessions();
    const going = exams.find(e => all[e.id] && !all[e.id].finished);
    const fresh = exams.find(e => !all[e.id]);
    quick = `
      ${going ? `<button onclick="switchTab('exam');setTimeout(()=>openExam('${going.id}'),300)">▶ 繼續：${going.title}</button>` : ""}
      ${fresh ? `<button class="${going ? "ghost" : ""}" onclick="switchTab('exam');setTimeout(()=>openExam('${fresh.id}'),300)">📝 ${fresh.title}</button>` : ""}
      <button class="ghost" onclick="switchTab('vocab');setTimeout(()=>startVocabRound(),300)">🔤 來一輪單字</button>`;
  } catch {}

  $app.innerHTML = `
    <p class="greet">${greeting()}</p>
    <div class="card countdown-card warm">
      <div class="muted">距離 8/30 郵政升等考</div>
      <div class="score-big">${d} <span style="font-size:1.1rem">天</span></div>
      <div class="quote">「${quote}」</div>
    </div>
    <div class="card">
      <div class="btn-row" style="margin-top:0">${quick}</div>
    </div>
    <div class="h2-row">
      <h2>今日進度 <span class="muted" style="font-weight:400">${doneCount}/${plan.length}</span></h2>
      <button class="small ghost" onclick="togglePlanEdit()">${planEditing ? "完成" : "編輯"}</button>
    </div>
    <div class="card">
      ${plan.map((t, i) => `
        <label class="check-row">
          ${planEditing
            ? `<button class="small ghost del-btn" onclick="removePlanItem(${i})">✕</button>`
            : `<input type="checkbox" ${done[i] ? "checked" : ""} onchange="toggleDaily(${i})">`}
          <span class="${done[i] && !planEditing ? "done-text" : ""}">${t}</span>
        </label>`).join("")}
      ${planEditing ? `
        <div class="btn-row" style="margin-top:10px">
          <input id="new-plan" class="plan-input" placeholder="新增今日待辦，例如：背 20 個單字">
          <button class="small" onclick="addPlanItem()" style="flex:0 0 auto">新增</button>
        </div>` : ""}
      ${!planEditing && doneCount === plan.length ? `<div class="notice warm-notice" style="margin:10px 0 0">今日達標，好好休息 🌿 你真的很棒</div>` : ""}
    </div>
    <h2>近期日程</h2>
    <div class="card">
      ${upcoming.map(x => {
        const dd = Math.round((new Date(x.date) - new Date(todayKey())) / 86400000);
        return `<div class="sched-row"><span>${x.date.slice(5).replace("-", "/")}　${x.label}</span><span class="muted">${dd === 0 ? "今天" : dd + " 天後"}</span></div>`;
      }).join("")}
    </div>`;
}

/* ================= 成績趨勢折線圖 ================= */
let trendSelected = null;
function selectTrendDay(i) { trendSelected = i; showExamTab(); }
function viewExamFromTrend(id) { openExam(id); }
function trendChart(days) {
  const W = 330, H = 132, PL = 26, PR = 14, PT = 16, PB = 22;
  const n = days.length;
  const x = i => n === 1 ? PL + (W - PL - PR) / 2 : PL + (W - PL - PR) * i / (n - 1);
  const y = v => PT + (H - PT - PB) * (100 - v) / 100;
  const pts = days.map((d, i) => ({ cx: x(i), cy: y(d.avg === null ? 0 : d.avg), i, d }));
  const sel = trendSelected !== null && trendSelected < n ? trendSelected : n - 1;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
    <line x1="${PL}" y1="${y(60)}" x2="${W - PR}" y2="${y(60)}" stroke="var(--warn)" stroke-dasharray="4 4" stroke-width="1"/>
    <text x="${PL - 4}" y="${y(60) + 3}" font-size="9" fill="var(--warn)" text-anchor="end">60</text>
    ${n > 1 ? `<polyline points="${pts.map(p => p.cx + "," + p.cy).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2"/>` : ""}
    ${pts.map(p => `
      <text x="${p.cx}" y="${p.cy - 10}" font-size="10" fill="var(--accent)" text-anchor="middle" font-weight="700">${p.d.avg === null ? "" : p.d.avg}</text>
      <circle cx="${p.cx}" cy="${p.cy}" r="${p.i === sel ? 5.5 : 4}" fill="${p.i === sel ? "var(--accent)" : "var(--card)"}" stroke="var(--accent)" stroke-width="2"/>
      <circle cx="${p.cx}" cy="${p.cy}" r="13" fill="transparent" style="cursor:pointer" onclick="selectTrendDay(${p.i})"/>
      <text x="${p.cx}" y="${H - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">${p.d.date.slice(5).replace("-", "/")}</text>`).join("")}
  </svg>`;
}

/* ================= 每日刷題 ================= */
const LS_DRILL_SEEN = "hub.drill.seen.v1";
const LS_DRILL_CFG = "hub.drill.cfg.v1";
const LS_DRILL_WRONG = "hub.drill.wrong.v1";
const LS_DRILL_DAILY = "hub.drill.daily.v1";
let poolIndex = null, poolCache = {}, drillQ = [], drillIdx = 0, drillPicked = null, drillRight = 0, drillWrongRound = [];

function drillSeen() { try { return JSON.parse(localStorage.getItem(LS_DRILL_SEEN)) || {}; } catch { return {}; } }
function drillCfg() {
  try { const c = JSON.parse(localStorage.getItem(LS_DRILL_CFG)); if (c && c.subjects) return c; } catch {}
  return { subjects: ["民法", "郵政法規", "英文", "國文"], per: 5 };
}
function drillWrongAll() { try { return JSON.parse(localStorage.getItem(LS_DRILL_WRONG)) || []; } catch { return []; } }
function drillDaily() { try { return JSON.parse(localStorage.getItem(LS_DRILL_DAILY)) || {}; } catch { return {}; } }

async function showDrillTab() {
  if (!poolIndex) poolIndex = await (await fetch("pools/index.json", { cache: "no-store" })).json();
  const cfg = drillCfg();
  const todayN = drillDaily()[todayKey()] || 0;
  const wrongN = drillWrongAll().length;
  $app.innerHTML = `
    <h1>每日刷題</h1>
    <p class="muted">逐題即時對答．每輪從勾選的科目隨機抽題．今日已刷 ${todayN} 題</p>
    <div class="card">
      <div class="muted" style="font-weight:700;margin-bottom:4px">選擇科目</div>
      ${poolIndex.map(p => `
        <label class="check-row">
          <input type="checkbox" data-subj="${p.subject}" ${cfg.subjects.includes(p.subject) ? "checked" : ""}>
          <span>${p.subject}</span>
        </label>`).join("")}
      <div class="muted" style="font-weight:700;margin:12px 0 4px">每科題數</div>
      <div class="btn-row" style="margin-top:4px">
        ${[3, 5, 10].map(nn => `<button class="${cfg.per === nn ? "" : "ghost"} small" onclick="setDrillPer(${nn})">${nn} 題</button>`).join("")}
      </div>
      <div class="btn-row">
        <button onclick="startDrill()">開始刷題</button>
      </div>
    </div>
    ${wrongN ? `<div class="card">
      <strong>錯題本</strong> <span class="muted">${wrongN} 題</span>
      <div class="btn-row">
        <button class="ghost" onclick="startDrillWrong()">只刷錯題</button>
        <button class="ghost" onclick="exportDrillWrong()">匯出給 Claude</button>
      </div>
    </div>` : ""}`;
}
function setDrillPer(n) {
  const cfg = readDrillForm();
  cfg.per = n;
  localStorage.setItem(LS_DRILL_CFG, JSON.stringify(cfg));
  showDrillTab();
}
function readDrillForm() {
  const cfg = drillCfg();
  const boxes = [...document.querySelectorAll("input[data-subj]")];
  if (boxes.length) cfg.subjects = boxes.filter(b => b.checked).map(b => b.dataset.subj);
  return cfg;
}
async function loadPool(subject) {
  if (poolCache[subject]) return poolCache[subject];
  const meta = poolIndex.find(p => p.subject === subject);
  const pool = await (await fetch(`pools/${meta.file}`, { cache: "no-store" })).json();
  pool.questions.forEach(q => q.subject = subject);
  poolCache[subject] = pool;
  return pool;
}
async function startDrill() {
  const cfg = readDrillForm();
  if (!cfg.subjects.length) { toast("至少勾一科"); return; }
  localStorage.setItem(LS_DRILL_CFG, JSON.stringify(cfg));
  const seen = drillSeen();
  const picked = [];
  for (const subj of cfg.subjects) {
    const pool = await loadPool(subj);
    const sorted = pool.questions
      .map(q => ({ q, k: (seen[q.id] || 0) + Math.random() * 0.9 }))
      .sort((a, b) => a.k - b.k)
      .map(x => x.q);
    picked.push(sorted.slice(0, cfg.per));
  }
  // 各科輪流交錯
  drillQ = [];
  const maxLen = Math.max(...picked.map(a => a.length));
  for (let i = 0; i < maxLen; i++) for (const arr of picked) if (arr[i]) drillQ.push(arr[i]);
  beginDrillRun();
}
async function startDrillWrong() {
  if (!poolIndex) poolIndex = await (await fetch("pools/index.json", { cache: "no-store" })).json();
  const ids = new Set(drillWrongAll().map(w => w.id));
  drillQ = [];
  for (const p of poolIndex) {
    const pool = await loadPool(p.subject);
    pool.questions.forEach(q => { if (ids.has(q.id)) drillQ.push(q); });
  }
  if (!drillQ.length) { toast("錯題本是空的"); return; }
  drillQ.sort(() => Math.random() - 0.5);
  beginDrillRun();
}
function beginDrillRun() {
  drillIdx = 0; drillPicked = null; drillRight = 0; drillWrongRound = [];
  showDrillQ();
}
function showDrillQ() {
  if (drillIdx >= drillQ.length) return showDrillDone();
  const q = drillQ[drillIdx];
  const answered = drillPicked !== null;
  $app.innerHTML = `
    <div class="exam-top">
      <button class="small ghost" onclick="showDrillTab()">結束</button>
      <span class="muted">${drillIdx + 1}/${drillQ.length}．${q.subject}</span>
      <button class="small ghost" onclick="openLookup()">🔍</button>
      <span class="muted">✔ ${drillRight}</span>
    </div>
    <div class="q-num">${q.point}</div>
    <div class="q-stem">${q.stem}</div>
    ${q.options.map((opt, i) => {
      const label = "ABCD"[i];
      let cls = "opt";
      if (answered) {
        if (label === q.answer) cls += " correct";
        else if (label === drillPicked) cls += " wrong";
      }
      return `<button class="${cls}" ${answered ? "disabled" : ""} onclick="pickDrill('${label}')" style="${answered ? "opacity:1" : ""}">（${label}）${opt}</button>`;
    }).join("")}
    ${answered ? `<div class="explain">${q.explain}</div>
    <div class="btn-row"><button onclick="nextDrill()">${drillIdx === drillQ.length - 1 ? "看本輪結果" : "下一題"}</button></div>` : ""}`;
}
function pickDrill(label) {
  if (drillPicked !== null) return;
  const q = drillQ[drillIdx];
  drillPicked = label;
  const seen = drillSeen();
  seen[q.id] = (seen[q.id] || 0) + 1;
  localStorage.setItem(LS_DRILL_SEEN, JSON.stringify(seen));
  const daily = drillDaily();
  daily[todayKey()] = (daily[todayKey()] || 0) + 1;
  localStorage.setItem(LS_DRILL_DAILY, JSON.stringify(daily));
  const wrongs = drillWrongAll();
  if (label === q.answer) {
    drillRight++;
    const idx = wrongs.findIndex(w => w.id === q.id);
    if (idx >= 0) { wrongs.splice(idx, 1); localStorage.setItem(LS_DRILL_WRONG, JSON.stringify(wrongs)); }
  } else {
    drillWrongRound.push(q);
    if (!wrongs.find(w => w.id === q.id)) {
      wrongs.push({ id: q.id, subject: q.subject, point: q.point, stem: q.stem, user: label, answer: q.answer, date: todayKey() });
      localStorage.setItem(LS_DRILL_WRONG, JSON.stringify(wrongs.slice(-200)));
    }
  }
  showDrillQ();
}
function nextDrill() { drillIdx++; drillPicked = null; showDrillQ(); }
function showDrillDone() {
  const total = drillQ.length;
  $app.innerHTML = `
    <div class="card" style="text-align:center;margin-top:30px">
      <h2 style="background:none">本輪完成！</h2>
      <div class="score-big">${drillRight}<span class="muted" style="font-size:1rem"> / ${total} 題</span></div>
      ${drillWrongRound.length ? `<p class="muted">錯的 ${drillWrongRound.length} 題已進錯題本，之後會更常出現</p>` : `<p class="muted">全對！超強 🎉</p>`}
      <div class="btn-row">
        <button onclick="startDrill()">再來一輪</button>
        <button class="ghost" onclick="showDrillTab()">回設定</button>
      </div>
    </div>`;
}
function exportDrillWrong() {
  const out = { type: "刷題錯題", exported: todayKey(), wrong: drillWrongAll() };
  const text = "【刷題錯題匯出，請依複習流程處理】\n" + JSON.stringify(out, null, 1);
  navigator.clipboard.writeText(text)
    .then(() => toast("已複製，貼給 Claude 即可"))
    .catch(() => {
      $app.insertAdjacentHTML("beforeend",
        `<div class="card"><p class="muted">自動複製失敗，請長按全選複製：</p><textarea readonly>${escapeHtml(text)}</textarea></div>`);
    });
}

/* ================= 試卷（模考引擎） ================= */
let exams = [], exam = null, sess = null, cur = 0, timerId = null, warned = false;

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(LS_SESS)) || {}; } catch { return {}; }
}
function saveSession() {
  const all = loadSessions();
  all[sess.examId] = sess;
  localStorage.setItem(LS_SESS, JSON.stringify(all));
}
async function showExamTab() {
  const res = await fetch("exams/index.json", { cache: "no-store" });
  exams = await res.json();
  const all = loadSessions();
  const today = todayKey();

  const cardOf = e => {
    const st = all[e.id];
    const status = !st ? "" : st.finished
      ? `<span class="tag ok">已完卷 ${st.scoreText || ""}</span>`
      : `<span class="tag pend">進行中</span>`;
    return `<div class="card tappable" onclick="openExam('${e.id}')">
      <strong>${e.title}</strong> ${status}
      <div class="muted">${e.subject}．限時 ${e.minutes} 分鐘．${e.summary}</div>
    </div>`;
  };

  // 考程表：全真卷依日期解鎖
  const schedRows = SCHEDULE.filter(x => x.subject).map(x => {
    const exam = exams.find(e => e.type === "full" && e.subject === x.subject);
    const dd = Math.round((new Date(x.date) - new Date(today)) / 86400000);
    if (dd > 0) {
      return `<div class="card locked">
        <strong>🔒 ${x.label}</strong>
        <div class="muted">${x.date.slice(5).replace("-", "/")} 開考．還有 ${dd} 天</div>
      </div>`;
    }
    if (exam) return cardOf(exam);
    return `<div class="card locked">
      <strong>📝 ${x.label}</strong>
      <div class="muted">${dd === 0 ? "今天開考" : "已到考程"}．考卷生成中，跟 Claude 說一聲「出卷」</div>
    </div>`;
  }).join("");

  const practice = exams.filter(e => e.type !== "full");

  // 成績趨勢資料（批改檔優先，其次本機完卷）
  let trendDays = [];
  try {
    const rows = [];
    for (const e of exams) {
      let row = null;
      try {
        const r = await fetch(`reviews/${e.id}.json`, { cache: "no-store" });
        if (r.ok) {
          const rv = await r.json();
          row = { id: e.id, title: e.title, subject: e.subject, date: rv.gradedAt,
                  text: `${rv.total} / ${rv.totalMax} 分${rv.pass ? "．✅" : ""}`,
                  pct: Math.round(rv.total / rv.totalMax * 100) };
        }
      } catch {}
      if (!row && all[e.id] && all[e.id].finished) {
        const ss = all[e.id];
        row = { id: e.id, title: e.title, subject: e.subject,
                date: new Date(ss.submitted).toISOString().slice(0, 10),
                text: ss.mcMax ? `選擇題 ${ss.mcScore} / ${ss.mcMax} 分` : `選擇題 ${ss.mcScore} 分（待批改）`,
                pct: ss.mcMax ? Math.round(ss.mcScore / ss.mcMax * 100) : null };
      }
      if (row) rows.push(row);
    }
    const byDay = {};
    rows.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
    trendDays = Object.keys(byDay).sort().map(dte => {
      const list = byDay[dte];
      const pcts = list.filter(x => x.pct !== null).map(x => x.pct);
      return { date: dte, avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, list };
    });
  } catch {}

  $app.innerHTML = `
    <h1>試卷</h1>
    <p class="muted">全真卷照考程解鎖；練習卷隨時可考．作答中不顯示對錯</p>
    <h2>考程表</h2>
    ${schedRows}
    <h2>練習卷</h2>
    ${practice.map(cardOf).join("")}
    ${trendDays.length ? `
    <h2>成績趨勢</h2>
    <div class="card">
      <div class="muted" style="font-size:0.78rem">每日全科平均（%）．虛線＝及格線 60．點圓點看當日各科</div>
      ${trendChart(trendDays)}
      ${(() => {
        const di = trendSelected !== null && trendSelected < trendDays.length ? trendSelected : trendDays.length - 1;
        const day = trendDays[di];
        return `<div class="trend-detail">
          <div class="muted" style="font-weight:700;margin-bottom:2px">${day.date}${day.avg !== null ? `．平均 ${day.avg}%` : ""}</div>
          ${day.list.map(r => `<div class="trend-subj" onclick="viewExamFromTrend('${r.id}')">
            <span>${r.subject}．${r.title}</span><span class="muted">${r.text} ›</span>
          </div>`).join("")}
        </div>`;
      })()}
    </div>` : ""}`;
}

async function openExam(id) {
  const meta = exams.find(e => e.id === id);
  const res = await fetch(`exams/${meta.file}`, { cache: "no-store" });
  exam = await res.json();
  exam.id = id;
  const existing = loadSessions()[id];
  if (existing && existing.finished) { sess = existing; return showResult(); }
  if (existing) {
    sess = existing;
    migrateSess();
    cur = sess.answers.findIndex(a => a === null);
    if (cur < 0) cur = 0;
    if (sess.pausedAt) return showPauseScreen();
    return showQuestion();
  }
  $app.innerHTML = `
    <h1>${exam.title}</h1>
    <div class="card">
      <p><strong>${exam.subject}</strong>．限時 ${exam.minutes} 分鐘</p>
      <p class="muted">${exam.sections.map(s => `${s.name} ${s.count} 題 × ${s.points} 分`).join("．")}（滿分 ${fullScore()} 分）</p>
      <div class="notice">按下開始即計時。作答中不顯示對錯、可跳題；剩 10 分鐘會提醒一次。</div>
      <div class="btn-row">
        <button onclick="startExam()">開始作答</button>
        <button class="ghost" onclick="showExamTab()">返回</button>
      </div>
    </div>`;
}
function fullScore() { return exam.sections.reduce((t, s) => t + s.count * s.points, 0); }
function startExam() {
  sess = { examId: exam.id, started: Date.now(), answers: exam.questions.map(() => null),
           flags: exam.questions.map(() => false), pausedTotal: 0, pausedAt: null, finished: false };
  cur = 0; warned = false;
  saveSession();
  showQuestion();
}
function migrateSess() { // 舊紀錄補欄位
  if (!sess.flags) sess.flags = exam.questions.map(() => false);
  if (sess.pausedTotal === undefined) sess.pausedTotal = 0;
  if (sess.pausedAt === undefined) sess.pausedAt = null;
}
function remainSec() {
  const now = sess.pausedAt || Date.now();
  return exam.minutes * 60 - Math.floor((now - sess.started - sess.pausedTotal) / 1000);
}
function fmt(sec) {
  const m = Math.floor(Math.abs(sec) / 60), s = Math.abs(sec) % 60;
  return `${sec < 0 ? "-" : ""}${m}:${String(s).padStart(2, "0")}`;
}
function tick() {
  const el = document.getElementById("timer");
  if (!el) return;
  const r = remainSec();
  el.textContent = fmt(r);
  if (r <= 600) el.classList.add("warn");
  if (r <= 600 && !warned) { warned = true; toast("剩 10 分鐘"); }
}
function showQuestion() {
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
  const q = exam.questions[cur];
  const answered = sess.answers.filter(a => a !== null && a !== "").length;
  $app.innerHTML = `
    <div class="exam-top">
      <button class="small ghost" onclick="showGridView()">一覽</button>
      <span class="muted">${answered}/${exam.questions.length}</span>
      <button class="small ghost" onclick="openLookup()">🔍</button>
      <button class="small ghost" onclick="pauseExam()">⏸</button>
      <span class="timer" id="timer"></span>
    </div>
    <div class="q-num">第 ${cur + 1} 題／${q.section}${q.essay ? `（${q.points} 分）` : ""}
      <button class="small flag-btn ${sess.flags[cur] ? "flagged" : ""}" onclick="toggleFlag()">🚩${sess.flags[cur] ? " 已標疑問" : " 有疑問"}</button>
    </div>
    <div class="q-stem">${q.stem}</div>
    ${q.essay ? essayBox(q) : q.options.map((opt, i) => {
      const label = "ABCD"[i];
      return `<button class="opt ${sess.answers[cur] === label ? "picked" : ""}" onclick="pick('${label}')">（${label}）${opt}</button>`;
    }).join("")}
    <div class="btn-row">
      <button class="ghost" onclick="nav(-1)" ${cur === 0 ? "disabled" : ""}>上一題</button>
      ${cur === exam.questions.length - 1
        ? `<button onclick="confirmSubmit()">交卷</button>`
        : `<button onclick="nav(1)">下一題</button>`}
    </div>`;
  tick();
}
function essayBox(q) {
  const val = sess.answers[cur] || "";
  return `<p class="muted">申論題：車上可先打大綱，回家再補全文；交卷後匯出由 AI 批改。</p>
    <textarea id="essay" placeholder="輸入你的答案或大綱…">${escapeHtml(val)}</textarea>
    <div class="btn-row"><button class="small ghost" onclick="saveEssay()">暫存</button></div>`;
}
function saveEssay() {
  sess.answers[cur] = document.getElementById("essay").value;
  saveSession();
  toast("已暫存");
  showQuestion();
}
function pick(label) {
  sess.answers[cur] = label;
  saveSession();
  if (cur < exam.questions.length - 1) {
    showQuestion();
    setTimeout(() => nav(1), 200);
  } else {
    showQuestion();
  }
}
function toggleFlag() {
  stashEssay();
  sess.flags[cur] = !sess.flags[cur];
  saveSession();
  showQuestion();
}
function pauseExam() {
  stashEssay();
  sess.pausedAt = Date.now();
  saveSession();
  showPauseScreen();
}
function showPauseScreen() {
  clearInterval(timerId);
  $app.innerHTML = `
    <div class="card" style="text-align:center;margin-top:40px">
      <h2>⏸ 已暫停</h2>
      <p class="muted">計時已停止，剩餘 ${fmt(remainSec())}。<br>休息一下，回來再繼續。</p>
      <div class="btn-row">
        <button onclick="resumeExam()">繼續作答</button>
      </div>
    </div>`;
}
function resumeExam() {
  sess.pausedTotal += Date.now() - sess.pausedAt;
  sess.pausedAt = null;
  saveSession();
  showQuestion();
}
function stashEssay() {
  const q = exam.questions[cur];
  if (q && q.essay) {
    const el = document.getElementById("essay");
    if (el) { sess.answers[cur] = el.value; saveSession(); }
  }
}
function nav(d) {
  stashEssay();
  cur = Math.max(0, Math.min(exam.questions.length - 1, cur + d));
  showQuestion();
}
function showGridView() {
  stashEssay();
  $app.innerHTML = `
    <div class="exam-top">
      <strong>題目一覽</strong>
      <span class="timer" id="timer"></span>
    </div>
    <div class="q-grid">
      ${exam.questions.map((qq, i) => `
        <button class="q-dot ${sess.answers[i] !== null && sess.answers[i] !== "" ? "answered" : ""} ${i === cur ? "current" : ""}"
          onclick="cur=${i};showQuestion()">${sess.flags[i] ? "🚩" : ""}${i + 1}</button>`).join("")}
    </div>
    <p class="muted">綠底＝已作答，🚩＝標了疑問。點題號跳題。</p>
    <div class="btn-row">
      <button class="ghost" onclick="showQuestion()">回到題目</button>
      <button onclick="confirmSubmit()">交卷</button>
    </div>`;
  tick();
}
function confirmSubmit() {
  stashEssay();
  const blank = sess.answers.filter(a => a === null || a === "").length;
  const over = remainSec() < 0;
  $app.innerHTML = `
    <div class="card">
      <h2>確定交卷？</h2>
      <p>${blank > 0 ? `還有 <strong>${blank}</strong> 題未作答。` : "全部題目皆已作答。"}${over ? "（已超過時限）" : ""}</p>
      <div class="btn-row">
        <button class="ghost" onclick="showQuestion()">再檢查</button>
        <button onclick="grade()">交卷</button>
      </div>
    </div>`;
}
function grade() {
  clearInterval(timerId);
  if (sess.pausedAt) { sess.pausedTotal += Date.now() - sess.pausedAt; sess.pausedAt = null; }
  sess.finished = true;
  sess.submitted = Date.now();
  sess.usedMinutes = Math.round((sess.submitted - sess.started - sess.pausedTotal) / 60000);
  let got = 0, mcTotal = 0, mcRight = 0, essayFull = 0;
  exam.questions.forEach((q, i) => {
    if (q.essay) { essayFull += q.points; return; }
    mcTotal++;
    if (sess.answers[i] === q.answer) { got += q.points; mcRight++; }
  });
  sess.mcMax = fullScore() - essayFull;
  sess.scoreText = `選擇 ${got}/${sess.mcMax}`;
  sess.mcRight = mcRight; sess.mcTotal = mcTotal; sess.mcScore = got;
  saveSession();
  showResult();
}
async function showResult() {
  clearInterval(timerId);
  let review = null;
  try {
    const r = await fetch(`reviews/${exam.id}.json`, { cache: "no-store" });
    if (r.ok) review = await r.json();
  } catch {}
  exam.review = review;
  const essayQs = exam.questions.filter(q => q.essay);
  const essayFull = essayQs.reduce((t, q) => t + q.points, 0);
  const usedMin = sess.usedMinutes !== undefined ? sess.usedMinutes : Math.round((sess.submitted - sess.started) / 60000);
  const flagged = (sess.flags || []).filter(Boolean).length;
  $app.innerHTML = `
    <h1>${exam.title}．成績</h1>
    <div class="card">
      ${exam.review ? `<div class="score-big">${exam.review.total}<span class="muted" style="font-size:1rem"> / ${exam.review.totalMax} 全卷（${exam.review.pass ? "✅ 過及格線" : "未達及格線"}）</span></div>
      <p class="muted">選擇 ${sess.mcScore} 分＋申論 ${exam.review.essays.reduce((t,e)=>t+e.score,0)} 分${exam.review.note ? "．" + exam.review.note : ""}．批改日 ${exam.review.gradedAt}</p>` : `<div class="score-big">${sess.mcScore}<span class="muted" style="font-size:1rem"> / ${fullScore() - essayFull} 選擇題得分</span></div>`}
      <p>選擇題答對 ${sess.mcRight}/${sess.mcTotal} 題．作答 ${usedMin} 分鐘${flagged ? `．🚩 疑問 ${flagged} 題` : ""}</p>
      ${essayFull && !exam.review ? `<p class="muted">申論 ${essayQs.length} 題（${essayFull} 分）待 AI 批改——按下方「匯出作答紀錄」貼給 Claude。</p>` : ""}
      <div class="btn-row">
        <button onclick="exportResult()">匯出作答紀錄</button>
        <button class="ghost" onclick="showExamTab()">回試卷列表</button>
      </div>
    </div>
    <h2>逐題解析</h2>
    ${exam.questions.map((q, i) => resultRow(q, i)).join("")}`;
}
function resultRow(q, i) {
  const user = sess.answers[i];
  if (q.essay) {
    const rv = exam.review && exam.review.essays.find(e => e.n === i + 1);
    return `<div class="result-q">
      <div class="q-num">第 ${i + 1} 題．申論 ${rv ? `<span class="tag ok">${rv.score}/${rv.max} 分</span>` : '<span class="tag pend">待批改</span>'}${(sess.flags||[])[i] ? ' <span class="tag pend">🚩 疑問</span>' : ''}</div>
      <div class="q-stem">${q.stem}</div>
      <div class="explain">你的作答：\n${user ? escapeHtml(user) : "（未作答）"}</div>
      ${rv ? `<div class="explain" style="border-left-color:var(--warn)">批改評語：\n${escapeHtml(rv.comment)}</div>` : ""}
    </div>`;
  }
  const right = user === q.answer;
  return `<div class="result-q">
    <div class="q-num">第 ${i + 1} 題．${q.point || q.section}
      <span class="tag ${right ? "ok" : "bad"}">${right ? "答對" : user ? `答錯（你選 ${user}）` : "未作答"}</span>${(sess.flags||[])[i] ? ' <span class="tag pend">🚩 疑問</span>' : ''}</div>
    <div class="q-stem">${q.stem}</div>
    ${q.options.map((opt, j) => {
      const label = "ABCD"[j];
      let cls = "opt";
      if (label === q.answer) cls += " correct";
      else if (label === user) cls += " wrong";
      return `<div class="${cls}">（${label}）${opt}</div>`;
    }).join("")}
    <div class="explain">${q.explain}</div>
  </div>`;
}
function exportResult() {
  const out = {
    exam: exam.title, subject: exam.subject,
    date: new Date(sess.submitted).toISOString().slice(0, 10),
    usedMinutes: sess.usedMinutes !== undefined ? sess.usedMinutes : Math.round((sess.submitted - sess.started) / 60000),
    flagged: exam.questions.map((q, i) => (sess.flags || [])[i] ? { n: i + 1, point: q.point || q.section, stem: q.stem } : null).filter(Boolean),
    mcScore: sess.mcScore, mcRight: `${sess.mcRight}/${sess.mcTotal}`,
    wrong: exam.questions.map((q, i) => (!q.essay && sess.answers[i] !== q.answer)
      ? { n: i + 1, point: q.point, user: sess.answers[i] || "未作答", answer: q.answer, stem: q.stem } : null).filter(Boolean),
    essays: exam.questions.map((q, i) => q.essay ? { n: i + 1, stem: q.stem, answer: sess.answers[i] || "" } : null).filter(Boolean),
  };
  const text = "【模考作答紀錄，請依模擬考流程批改申論並將錯題入庫】\n" + JSON.stringify(out, null, 1);
  navigator.clipboard.writeText(text)
    .then(() => toast("已複製，回家貼給 Claude 即可"))
    .catch(() => {
      $app.insertAdjacentHTML("beforeend",
        `<div class="card"><p class="muted">自動複製失敗，請長按全選複製：</p><textarea readonly>${escapeHtml(text)}</textarea></div>`);
    });
}

/* ================= 單字：三關學習法 ================= */
// 第 0 關未學 → 關1 認識（卡片＋發音）→ 關2 例句挖空 → 關3 中翻英 → 熟
const LS_VOCAB2 = "hub.vocab.v2";
let vocab = null, vTasks = [], vTIdx = 0, vAnswered = null, vRight = 0;

function vStages() { try { return JSON.parse(localStorage.getItem(LS_VOCAB2)) || {}; } catch { return {}; } }
function setStage(w, st) {
  const all = vStages();
  all[w] = st;
  localStorage.setItem(LS_VOCAB2, JSON.stringify(all));
}
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch {}
}
let grammar = null, gOpen = {};
async function showVocabTab() {
  if (!vocab) vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json();
  if (!grammar) { try { grammar = await (await fetch("data/grammar.json", { cache: "no-store" })).json(); } catch { grammar = []; } }
  const st = vStages();
  const mastered = vocab.filter(v => st[v.w] === 3).length;
  const learning = vocab.filter(v => (st[v.w] || 0) === 1 || (st[v.w] || 0) === 2).length;
  $app.innerHTML = `
    <h1>單字辭典</h1>
    <p class="muted">共 ${vocab.length} 字．已熟 ${mastered}．闖關中 ${learning}．每天考單字請從首頁「來一輪單字」進入</p>
    <div class="card">
      <input class="plan-input" id="vocab-search" placeholder="🔍 搜尋單字或中文…" oninput="renderVocabList()" style="width:100%;margin-bottom:8px">
      <div id="vocab-list"></div>
    </div>
    <h2>文法重點</h2>
    ${grammar.map((g, gi) => `
    <div class="card">
      <div class="note-group" onclick="gOpen[${gi}]=!gOpen[${gi}];showVocabTab()">
        <strong>${g.group}</strong>
        <span class="muted">${g.items.length} 則 ${gOpen[gi] ? "▾" : "▸"}</span>
      </div>
      ${gOpen[gi] ? g.items.map(it => `
        <div class="note-item">
          <div class="note-point">${it.topic}</div>
          <div class="note-value" style="font-size:0.92rem">${it.rule}</div>
          <div class="explain" style="margin-top:6px">${it.examples.join("\n")}</div>
          <div class="muted" style="font-size:0.8rem;margin-top:4px">💡 ${it.trap}</div>
        </div>`).join("") : ""}
    </div>`).join("")}`;
  renderVocabList();
}
let vOpen = null;
function renderVocabList() {
  const box = document.getElementById("vocab-list");
  if (!box || !vocab) return;
  const kw = (document.getElementById("vocab-search")?.value || "").trim().toLowerCase();
  const st = vStages();
  const list = vocab.filter(v => !kw || v.w.toLowerCase().includes(kw) || v.zh.includes(kw));
  box.innerHTML = list.length ? list.map(v => {
    const stage = st[v.w] || 0;
    const dots = "●".repeat(stage) + "○".repeat(3 - stage);
    const open = vOpen === v.w;
    return `<div class="vlist-row" onclick="vOpen=vOpen==='${v.w.replace(/'/g, "\\'")}'?null:'${v.w.replace(/'/g, "\\'")}';renderVocabList()">
      <div class="vlist-head">
        <span><strong>${v.w}</strong> <span class="muted">${v.pos}</span>　${v.zh}</span>
        <span class="muted" style="font-size:0.75rem">${dots}</span>
      </div>
      ${open ? `<div class="muted" style="font-style:italic;margin-top:4px">${v.ex}</div>
        <div class="btn-row" style="margin-top:8px">
          <button class="small ghost" onclick="event.stopPropagation();speak('${v.w.replace(/'/g, "\\'")}')">🔊 發音</button>
          <button class="small ghost" onclick="event.stopPropagation();speak(${JSON.stringify(v.ex).replace(/"/g, "&quot;")})">🔊 例句</button>
        </div>` : ""}
    </div>`;
  }).join("") : `<p class="muted">找不到「${kw}」。<a href="https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${encodeURIComponent(kw)}" target="_blank" rel="noopener">到劍橋詞典查 ›</a></p>`;
}
function blankWord(ex, w) {
  const pre = w.slice(0, Math.min(w.length, 5)).toLowerCase();
  return ex.split(/(\s+)/).map(tok => {
    const clean = tok.replace(/[^A-Za-z]/g, "").toLowerCase();
    if (clean && (clean === w.toLowerCase() || clean.startsWith(pre))) {
      return tok.replace(/[A-Za-z]+/, "＿＿＿＿");
    }
    return tok;
  }).join("");
}
function distractors(word, n) {
  const others = vocab.filter(v => v.w !== word.w);
  const same = others.filter(v => v.pos === word.pos);
  const pool = (same.length >= n ? same : others).slice();
  pool.sort(() => Math.random() - 0.5);
  return pool.slice(0, n);
}
async function startVocabRound() {
  if (!vocab) vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json();
  const st = vStages();
  const quiz = vocab.filter(v => (st[v.w] || 0) === 1 || (st[v.w] || 0) === 2)
                    .sort(() => Math.random() - 0.5);
  const fresh = vocab.filter(v => (st[v.w] || 0) === 0)
                     .sort(() => Math.random() - 0.5);
  vTasks = [];
  quiz.slice(0, 6).forEach(v => vTasks.push({ v, type: (st[v.w] === 1 ? "cloze" : "zh2en") }));
  fresh.slice(0, Math.max(4, 10 - vTasks.length)).forEach(v => vTasks.push({ v, type: "learn" }));
  vTasks = vTasks.slice(0, 10);
  if (!vTasks.length) { toast("全部單字都熟了！🎉"); return; }
  vTIdx = 0; vAnswered = null; vRight = 0;
  showVocabTask();
}
function showVocabTask() {
  if (vTIdx >= vTasks.length) return showVocabDone();
  const t = vTasks[vTIdx];
  const head = `
    <div class="exam-top">
      <button class="small ghost" onclick="showVocabTab()">結束</button>
      <span class="muted">${vTIdx + 1}/${vTasks.length}</span>
      <span class="muted">${t.type === "learn" ? "🌱 認識新字" : t.type === "cloze" ? "✏️ 第二關：挖空" : "🎯 第三關：中翻英"}</span>
    </div>`;
  if (t.type === "learn") {
    $app.innerHTML = head + `
      <div class="flashcard">
        <div class="fc-word">${t.v.w} <button class="small ghost speak-btn" onclick="event.stopPropagation();speak('${t.v.w}')">🔊</button></div>
        <div class="muted">${t.v.pos}</div>
        <div class="fc-zh">${t.v.zh}</div>
        <div class="fc-ex">${t.v.ex} <button class="small ghost speak-btn" onclick="event.stopPropagation();speak(${JSON.stringify(t.v.ex).replace(/"/g, "&quot;")})">🔊</button></div>
      </div>
      <div class="btn-row">
        <button onclick="learnDone(1)">認識了，進第二關</button>
        <button class="ghost" onclick="learnDone(2)">早就會，直接第三關</button>
      </div>`;
    return;
  }
  const opts = t.opts || (t.opts = [t.v, ...distractors(t.v, 3)].sort(() => Math.random() - 0.5));
  const answered = vAnswered !== null;
  const stem = t.type === "cloze"
    ? `<div class="q-stem">${blankWord(t.v.ex, t.v.w)}</div><p class="muted">（${t.v.pos}${t.v.zh ? "．" + t.v.zh : ""}）</p>`
    : `<div class="q-stem" style="font-size:1.2rem;font-weight:700">${t.v.zh}<span class="muted" style="font-size:0.85rem">（${t.v.pos}）</span></div>`;
  $app.innerHTML = head + stem + opts.map(o => {
    let cls = "opt";
    if (answered) {
      if (o.w === t.v.w) cls += " correct";
      else if (o.w === vAnswered) cls += " wrong";
    }
    return `<button class="${cls}" ${answered ? "disabled" : ""} style="${answered ? "opacity:1" : ""}"
      onclick="pickVocab('${o.w}')">${o.w}</button>`;
  }).join("") + (answered ? `
    <div class="explain">${t.v.w}（${t.v.pos}）${t.v.zh}\n${t.v.ex}</div>
    <div class="btn-row">
      <button class="small ghost" onclick="speak('${t.v.w}')">🔊 唸一次</button>
      <button onclick="nextVocab()">${vTIdx === vTasks.length - 1 ? "看結果" : "下一題"}</button>
    </div>` : "");
}
function learnDone(stage) {
  setStage(vTasks[vTIdx].v.w, stage);
  vRight++;
  vTIdx++; vAnswered = null;
  showVocabTask();
}
function pickVocab(w) {
  if (vAnswered !== null) return;
  const t = vTasks[vTIdx];
  vAnswered = w;
  const cur = vStages()[t.v.w] || 0;
  if (w === t.v.w) {
    vRight++;
    setStage(t.v.w, t.type === "cloze" ? 2 : 3);
    speak(t.v.w);
  } else {
    setStage(t.v.w, t.type === "cloze" ? 0 : 1); // 答錯退回上一關
  }
  showVocabTask();
}
function nextVocab() { vTIdx++; vAnswered = null; showVocabTask(); }
function showVocabDone() {
  const st = vStages();
  const mastered = vocab.filter(v => st[v.w] === 3).length;
  $app.innerHTML = `
    <div class="card" style="text-align:center;margin-top:30px">
      <h2 style="background:none">本輪完成！</h2>
      <div class="score-big">${vRight}<span class="muted" style="font-size:1rem"> / ${vTasks.length}</span></div>
      <p class="muted">已熟單字累計 ${mastered} / ${vocab.length}．答錯的字退了一關，下輪會再出現</p>
      <div class="btn-row">
        <button onclick="startVocabRound()">再來一輪</button>
        <button class="ghost" onclick="showVocabTab()">回單字頁</button>
      </div>
    </div>`;
}

/* ================= 筆記速查 ================= */
let notes = null, notesWarnOnly = false, openGroups = {};
async function showNotesTab() {
  if (!notes) notes = await (await fetch("data/notes.json", { cache: "no-store" })).json();
  $app.innerHTML = `
    <h1>筆記速查</h1>
    <p class="muted">數字、期間、金額速查表（來源：本機速記筆記）</p>
    <div class="btn-row" style="margin-bottom:12px">
      <button class="small ${notesWarnOnly ? "" : "ghost"}" onclick="notesWarnOnly=!notesWarnOnly;showNotesTab()">
        ${notesWarnOnly ? "顯示全部" : "只看 ⚠ 曾錯考點"}</button>
    </div>
    ${notes.map((g, gi) => {
      const items = notesWarnOnly ? g.items.filter(x => x.warn) : g.items;
      if (!items.length) return "";
      const open = openGroups[gi] !== false;
      return `<div class="card">
        <div class="note-group" onclick="openGroups[${gi}]=${!open};showNotesTab()">
          <strong>${g.group}</strong>
          <span class="muted">${items.length} 條 ${open ? "▾" : "▸"}</span>
        </div>
        ${open ? items.map(x => `
          <div class="note-item ${x.warn ? "warn-item" : ""}">
            <div class="note-point">${x.warn ? "⚠ " : ""}${x.point}</div>
            <div class="note-value">${x.value}</div>
            ${x.note ? `<div class="muted" style="font-size:0.8rem">${x.note}</div>` : ""}
          </div>`).join("") : ""}
      </div>`;
    }).join("")}`;
}

/* ================= 查單字浮層 ================= */
async function openLookup() {
  if (!vocab) { try { vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json(); } catch {} }
  const sel = (window.getSelection ? String(window.getSelection()) : "").trim().slice(0, 30);
  document.querySelectorAll(".lookup-overlay").forEach(x => x.remove());
  const div = document.createElement("div");
  div.className = "lookup-overlay";
  div.innerHTML = `
    <div class="lookup-box card">
      <div class="h2-row" style="margin:0 0 8px">
        <strong>查單字</strong>
        <button class="small ghost" onclick="this.closest('.lookup-overlay').remove()">關閉</button>
      </div>
      <input class="plan-input" id="lookup-input" placeholder="輸入英文或中文…" value="${sel.replace(/"/g, "&quot;")}" oninput="renderLookup()" style="width:100%">
      <div id="lookup-result" style="margin-top:8px"></div>
    </div>`;
  document.body.appendChild(div);
  renderLookup();
  document.getElementById("lookup-input").focus();
}
function renderLookup() {
  const box = document.getElementById("lookup-result");
  if (!box) return;
  const kw = (document.getElementById("lookup-input")?.value || "").trim().toLowerCase();
  if (!kw) { box.innerHTML = `<p class="muted">選取題目中的單字再按 🔍，會自動帶入。</p>`; return; }
  const hits = (vocab || []).filter(v => v.w.toLowerCase().includes(kw) || v.zh.includes(kw)).slice(0, 5);
  box.innerHTML = (hits.length ? hits.map(v => `
    <div class="vlist-row">
      <div><strong>${v.w}</strong> <span class="muted">${v.pos}</span>　${v.zh}
        <button class="small ghost" style="padding:1px 8px" onclick="speak('${v.w.replace(/'/g, "\\'")}')">🔊</button></div>
      <div class="muted" style="font-style:italic">${v.ex}</div>
    </div>`).join("") : `<p class="muted">單字庫沒有這個字。</p>`)
    + `<p style="margin-top:6px"><a href="https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${encodeURIComponent(kw)}" target="_blank" rel="noopener">在劍橋詞典查「${kw}」 ›</a></p>`;
}

/* ================= 工具 ================= */
function toast(msg) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
showHomeTab();
