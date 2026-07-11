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
  ({ home: showHomeTab, exam: showExamTab, vocab: showVocabTab, notes: showNotesTab }[name])();
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
  { date: "2026-07-31", label: "民法全真卷" },
  { date: "2026-08-07", label: "郵政法規全真卷" },
  { date: "2026-08-14", label: "英文全真卷" },
  { date: "2026-08-21", label: "國文全真卷" },
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
      <button class="ghost" onclick="switchTab('vocab');setTimeout(()=>startVocab(false),300)">🔤 來一輪單字</button>`;
  } catch {}

  // 成績趨勢：伺服器批改檔優先，其次本機完卷紀錄
  let trend = [];
  try {
    const all = loadSessions();
    for (const e of exams) {
      let row = null;
      try {
        const r = await fetch(`reviews/${e.id}.json`, { cache: "no-store" });
        if (r.ok) {
          const rv = await r.json();
          row = { title: e.title, date: rv.gradedAt, score: rv.total, max: rv.totalMax, pass: rv.pass, full: true };
        }
      } catch {}
      if (!row && all[e.id] && all[e.id].finished) {
        const sSess = all[e.id];
        const essayMax = 0;
        row = { title: e.title, date: new Date(sSess.submitted).toISOString().slice(5, 10),
                score: sSess.mcScore, max: null, pass: null, full: false };
      }
      if (row) trend.push(row);
    }
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
    ${trend.length ? `
    <h2>成績趨勢</h2>
    <div class="card">
      ${trend.map(t => {
        const pct = t.max ? Math.round(t.score / t.max * 100) : null;
        return `<div class="trend-row">
          <div class="trend-head"><span>${t.title}</span><span class="muted">${t.date}</span></div>
          <div class="trend-bar-bg"><div class="trend-bar" style="width:${pct !== null ? pct : 50}%"></div></div>
          <div class="muted" style="font-size:0.8rem">${t.max ? `${t.score} / ${t.max} 分${t.pass ? "．✅ 過及格線" : ""}` : `選擇題 ${t.score} 分（申論待批改）`}</div>
        </div>`;
      }).join("")}
    </div>` : ""}
    <h2>近期日程</h2>
    <div class="card">
      ${upcoming.map(x => {
        const dd = Math.round((new Date(x.date) - new Date(todayKey())) / 86400000);
        return `<div class="sched-row"><span>${x.date.slice(5).replace("-", "/")}　${x.label}</span><span class="muted">${dd === 0 ? "今天" : dd + " 天後"}</span></div>`;
      }).join("")}
    </div>`;
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
  $app.innerHTML = `
    <h1>試卷</h1>
    <p class="muted">作答中不顯示對錯，交卷後才解析；紀錄可匯出回家批改</p>
    ${exams.map(e => {
      const s = all[e.id];
      const status = !s ? "" : s.finished
        ? `<span class="tag ok">已完卷 ${s.scoreText || ""}</span>`
        : `<span class="tag pend">進行中</span>`;
      return `<div class="card tappable" onclick="openExam('${e.id}')">
        <strong>${e.title}</strong> ${status}
        <div class="muted">${e.subject}．限時 ${e.minutes} 分鐘．${e.summary}</div>
      </div>`;
    }).join("")}`;
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
      <button class="small ghost" onclick="pauseExam()">⏸ 暫停</button>
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
  sess.scoreText = `選擇 ${got}/${fullScore() - essayFull}`;
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

/* ================= 單字卡 ================= */
let vocab = null, vq = [], vIdx = 0, flipped = false;
function vocabLevels() {
  try { return JSON.parse(localStorage.getItem(LS_VOCAB)) || {}; } catch { return {}; }
}
async function showVocabTab() {
  if (!vocab) vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json();
  const lv = vocabLevels();
  const learned = vocab.filter(v => (lv[v.w] || 0) >= 3).length;
  const seen = vocab.filter(v => lv[v.w] !== undefined).length;
  $app.innerHTML = `
    <h1>單字卡</h1>
    <p class="muted">郵政／金融常考字彙 ${vocab.length} 字．已熟 ${learned}．碰過 ${seen}</p>
    <div class="card">
      <p>點卡片翻面看中文與例句；「還不熟」的字會更常出現，按三次「認得」就算熟了。</p>
      <div class="btn-row">
        <button onclick="startVocab(false)">開始背單字</button>
        <button class="ghost" onclick="startVocab(true)">只練不熟的</button>
      </div>
    </div>`;
}
function startVocab(onlyWeak) {
  const lv = vocabLevels();
  let pool = vocab.filter(v => (lv[v.w] || 0) < 3);
  if (onlyWeak) {
    const weak = pool.filter(v => lv[v.w] !== undefined);
    if (weak.length) pool = weak;
  }
  if (!pool.length) { toast("全部背熟了！🎉"); return; }
  // 洗牌，等級低的排前面
  vq = pool.map(v => ({ v, r: Math.random() + (lv[v.w] || 0) * 0.8 }))
           .sort((a, b) => a.r - b.r).map(x => x.v).slice(0, 20);
  vIdx = 0; flipped = false;
  showCard();
}
function showCard() {
  if (vIdx >= vq.length) {
    $app.innerHTML = `<div class="card" style="text-align:center">
      <h2>這輪 ${vq.length} 個字完成！</h2>
      <div class="btn-row">
        <button onclick="startVocab(false)">再來一輪</button>
        <button class="ghost" onclick="showVocabTab()">返回</button>
      </div></div>`;
    return;
  }
  const v = vq[vIdx];
  const lv = vocabLevels()[v.w] || 0;
  $app.innerHTML = `
    <div class="exam-top">
      <button class="small ghost" onclick="showVocabTab()">結束</button>
      <span class="muted">${vIdx + 1}/${vq.length}</span>
      <span class="muted">熟悉度 ${"●".repeat(lv)}${"○".repeat(3 - lv)}</span>
    </div>
    <div class="flashcard ${flipped ? "flip" : ""}" onclick="flipCard()">
      ${flipped
        ? `<div class="fc-word" style="font-size:1.3rem">${v.w} <span class="muted">${v.pos}</span></div>
           <div class="fc-zh">${v.zh}</div>
           <div class="fc-ex">${v.ex}</div>`
        : `<div class="fc-word">${v.w}</div><div class="muted">點一下翻面</div>`}
    </div>
    <div class="btn-row">
      <button class="ghost" onclick="rateWord(false)">還不熟</button>
      <button onclick="rateWord(true)">認得 👍</button>
    </div>`;
}
function flipCard() { flipped = !flipped; showCard(); }
function rateWord(know) {
  const all = vocabLevels();
  const w = vq[vIdx].w;
  all[w] = know ? Math.min(3, (all[w] || 0) + 1) : 0;
  localStorage.setItem(LS_VOCAB, JSON.stringify(all));
  if (!know) vq.push(vq[vIdx]); // 不熟的排到這輪尾巴再出現
  vIdx++; flipped = false;
  showCard();
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
