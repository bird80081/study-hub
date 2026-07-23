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
let currentTab = "home";
function switchTab(name) {
  clearInterval(timerId);
  currentTab = name;
  tabbar.querySelectorAll("button").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name));
  ({ home: showHomeTab, drill: showDrillTab, exam: showExamTab, vocab: showVocabTab, notes: showNotesTab }[name])();
}
// 舊畫面兩大來源：斷網時拿到快取、背景分頁被原樣還原。兩種情況都自動重抓（作答中不打擾）
function refreshIfIdle() {
  const busy = (typeof sess !== "undefined" && sess && !sess.finished) || (typeof drillQ !== "undefined" && drillQ.length && drillIdx < drillQ.length && document.body.innerText.includes("結束"));
  if (busy) return;
  if (["home", "exam", "notes"].includes(currentTab)) switchTab(currentTab);
}
window.addEventListener("online", refreshIfIdle);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshIfIdle();
});
// iOS Safari 從背景還原是 bfcache 快照（JS 不重跑），只有 pageshow persisted 會觸發
window.addEventListener("pageshow", e => { if (e.persisted) refreshIfIdle(); });

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
  { date: "2026-07-31", label: "全科模擬 第 1 場（109 真卷）", round: 1 },
  { date: "2026-08-07", label: "全科模擬 第 2 場（仿真卷 A）", round: 2 },
  { date: "2026-08-14", label: "全科模擬 第 3 場（仿真卷 B）", round: 3 },
  { date: "2026-08-21", label: "全科模擬 第 4 場（仿真卷 C）", round: 4 },
  { date: "2026-08-23", label: "全科模擬 第 5 場（仿真卷 D）", round: 5 },
  { date: "2026-08-26", label: "全科模擬 第 6 場（仿真卷 E）", round: 6 },
  { date: "2026-08-28", label: "全科模擬 第 7 場（112 真卷・考前校準）", round: 7 },
  { date: "2026-08-30", label: "🎯 郵政升等考" }
];
const SUBJECTS = ["民法", "郵政法規", "英文", "國文"];
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

function dayKeyOf(ts) {  // 本地日期（舊版用 UTC，台灣早上 8 點前會誤判成昨天）
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayKey() { return dayKeyOf(Date.now()); }
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
function removePlanItemByText(t) {
  const p = getPlan();
  const i = p.indexOf(t);
  if (i >= 0) p.splice(i, 1);
  savePlan(p.length ? p : DEFAULT_PLAN.slice());
  showHomeTab();
}
let planBackup = null;
function togglePlanEdit() {
  if (!planEditing) planBackup = JSON.stringify(getPlan());
  planEditing = !planEditing;
  showHomeTab();
}
function cancelPlanEdit() {
  if (planBackup) localStorage.setItem(LS_PLAN, planBackup);
  planEditing = false;
  showHomeTab();
}

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
  const se = sp[todayKey()];
  const dailyItems = Array.isArray(sp.daily) ? sp.daily : [];
  let dateItems = [], serverDone = [];
  if (Array.isArray(se)) serverDone = se;
  else if (se && typeof se === "object") { dateItems = se.items || []; serverDone = se.done || []; }
  const localPlan = getPlan();
  const custom = localPlan.filter(x => !DEFAULT_PLAN.includes(x));
  const nDaily = dailyItems.length;
  const serverItems = dailyItems.concat(dateItems);
  const plan = serverItems.length ? serverItems.concat(custom) : localPlan;
  const nServer = serverItems.length;
  const local = dailyState()[todayKey()] || [];
  const done = plan.map((_, i) => !!(local[i] || (i >= nDaily && serverDone[i - nDaily])));
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
    ${(() => {
      const d = essayDraft();
      return `<div class="card">
        <strong>✍️ 作文短段</strong> <span class="muted">${d.text ? `草稿 ${d.text.length} 字` : "通勤空檔寫一段，回家不用扛"}</span>
        <div class="btn-row">
          <button class="ghost" onclick="showEssayPad()">${d.text ? "繼續寫" : "開始寫"}</button>
          ${d.text ? `<button onclick="exportEssayDraft()">匯出批改</button>` : ""}
        </div>
      </div>`;
    })()}
    <div class="h2-row">
      <h2>今日進度 <span class="muted" style="font-weight:400">${doneCount}/${plan.length}</span></h2>
      <span><button class="small ghost" onclick="showHomeTab()" title="重新抓最新進度">⟳ ${new Date().toTimeString().slice(0,5)}</button> ${planEditing ? `<button class="small ghost" onclick="cancelPlanEdit()">↩ 返回</button> ` : ""}<button class="small ghost" onclick="togglePlanEdit()">${planEditing ? "完成" : "編輯"}</button></span>
    </div>
    <div class="card">
      ${plan.map((t, i) => `
        ${nDaily && dateItems.length && !planEditing ? (i === 0 ? '<div class="muted" style="font-size:0.75rem;margin:2px 0">🔁 每日固定</div>' : (i === nDaily ? '<div class="muted" style="font-size:0.75rem;margin:8px 0 2px">📌 今日重點</div>' : "")) : ""}
        <label class="check-row">
          ${planEditing
            ? (i < nServer
                ? `<span class="muted" style="flex:0 0 auto">📖</span>`
                : `<button class="small ghost del-btn" onclick="removePlanItemByText(${JSON.stringify(t).replace(/"/g, "&quot;")})">✕</button>`)
            : `<input type="checkbox" ${done[i] ? "checked" : ""} onchange="toggleDaily(${i})">`}
          <span class="${done[i] && !planEditing ? "done-text" : ""}">${t}</span>
        </label>`).join("")}
      ${planEditing ? `
        <div class="btn-row" style="margin-top:10px">
          <input id="new-plan" class="plan-input" placeholder="新增今日待辦，例如：背 20 個單字">
          <button class="small" onclick="addPlanItem()" style="flex:0 0 auto">新增</button>
        </div>` : ""}
      ${!planEditing && doneCount === plan.length ? `<div class="notice warm-notice" style="margin:10px 0 0">今日達標，好好休息 🌿 你真的很棒</div>` : ""}
      ${!planEditing ? `<div class="btn-row" style="margin-top:10px"><button class="small ghost" onclick="exportDayRecord()">📤 匯出今日讀書紀錄</button></div>` : ""}
    </div>
    <h2>近期日程</h2>
    <div class="card">
      ${upcoming.map(x => {
        const dd = Math.round((new Date(x.date) - new Date(todayKey())) / 86400000);
        return `<div class="sched-row"><span>${x.date.slice(5).replace("-", "/")}　${x.label}</span><span class="muted">${dd === 0 ? "今天" : dd + " 天後"}</span></div>`;
      }).join("")}
    </div>`;
}

// 匯出今日讀書紀錄：打包當天活動（刷題、模考、單字熟練度）
// 貼給 Claude（Mac 或手機雲端 session 皆可）併入 data/records.json
// 今日進度待辦不匯出——那本來就是 Mac 端排進 progress.json 的，回流多餘
function exportDayRecord() {
  const textP = buildDayRecordText();
  // iOS Safari 要求剪貼簿寫入緊貼使用者手勢；先 fetch 再 writeText 會被拒。
  // 用 ClipboardItem 包 Promise 可在手勢當下先「預約」寫入，等資料好了才填內容。
  const ok = () => { markExported(true); toast("已複製，貼給 Claude 寫入讀書紀錄"); };
  const fail = () => textP.then(t => $app.insertAdjacentHTML("beforeend",
    `<div class="card"><p class="muted">自動複製失敗，請長按全選複製：</p><textarea readonly>${escapeHtml(t)}</textarea>
     <button class="small" onclick="markExported()">複製好了，標記已匯出</button></div>`));
  if (navigator.clipboard && window.ClipboardItem) {
    const item = new ClipboardItem({ "text/plain": textP.then(t => new Blob([t], { type: "text/plain" })) });
    navigator.clipboard.write([item]).then(ok).catch(fail);
  } else {
    textP.then(t => navigator.clipboard.writeText(t).then(ok).catch(fail));
  }
}
async function buildDayRecordText() {
  const day = todayKey();
  const strip = ({ exported, ...w }) => w;
  const all = drillWrongAll();
  const wrongToday = all.filter(w => w.date === day).map(strip);
  // 補件：前幾天漏匯出的錯題。今天的已在 drill.wrong，這裡只收跨日殘留，
  // 免得同一份匯出裡出現兩次一樣的題目。
  const pending = all.filter(w => !w.exported && w.date !== day).map(strip);
  const attempts = loadAttempts().filter(a => a.date === day)
    .map(a => ({ title: a.title, subject: a.subject, mcScore: a.mcScore, mcMax: a.mcMax, mcRight: a.mcRight, mcTotal: a.mcTotal }));
  const dist = { 0: 0, 1: 0, 2: 0, 3: 0 };
  Object.values(vStages()).forEach(s => { if (dist[s] !== undefined) dist[s]++; });
  const vd = vocabDaily()[day] || { done: 0, right: 0 };
  const out = { type: "讀書紀錄", date: day,
    drill: { count: drillDaily()[day] || 0, wrong: wrongToday },
    exams: attempts,
    vocab: { done: vd.done, right: vd.right },
    vocabStages: dist };
  if (pending.length) out.pendingWrong = pending;
  return "【讀書紀錄匯出，請併入 data/records.json】\n" + JSON.stringify(out, null, 1);
}

/* ================= 作文短段（通勤快寫） ================= */
const LS_ESSAY_DRAFT = "hub.essay.draft.v1";
function essayDraft() { try { return JSON.parse(localStorage.getItem(LS_ESSAY_DRAFT)) || {}; } catch { return {}; } }
function saveEssayDraft() {
  const title = document.getElementById("essay-title")?.value ?? "";
  const text = document.getElementById("essay-text")?.value ?? "";
  localStorage.setItem(LS_ESSAY_DRAFT, JSON.stringify({ title, text, updated: Date.now() }));
  const c = document.getElementById("essay-count");
  if (c) c.textContent = `${text.length} 字`;
}
function showEssayPad() {
  const d = essayDraft();
  $app.innerHTML = `
    <h1>作文短段</h1>
    <p class="muted">邊寫邊自動存草稿，寫完「匯出批改」貼給 Claude</p>
    <div class="card">
      <input id="essay-title" class="plan-input" placeholder="題目，例如：為什麼紀律能建立公共信任" value="${escapeHtml(d.title || "")}" oninput="saveEssayDraft()" style="width:100%">
      <textarea id="essay-text" rows="10" placeholder="開始寫…" oninput="saveEssayDraft()" style="width:100%;margin-top:8px">${escapeHtml(d.text || "")}</textarea>
      <div class="muted" style="text-align:right;font-size:0.8rem"><span id="essay-count">${(d.text || "").length} 字</span></div>
      <div class="btn-row">
        <button onclick="exportEssayDraft()">匯出批改</button>
        <button class="ghost" onclick="clearEssayDraft()">清除草稿</button>
        <button class="ghost" onclick="showHomeTab()">返回首頁</button>
      </div>
    </div>`;
}
function exportEssayDraft() {
  const d = essayDraft();
  if (!d.text) { toast("還沒有內容"); return; }
  const text = `【作文短段匯出，請批改】\n日期：${todayKey()}\n題目：${d.title || "（未填）"}\n字數：${d.text.length}\n---\n${d.text}`;
  navigator.clipboard.writeText(text)
    .then(() => toast("已複製，貼給 Claude 批改"))
    .catch(() => $app.insertAdjacentHTML("beforeend",
      `<div class="card"><p class="muted">自動複製失敗，請長按全選複製：</p><textarea readonly>${escapeHtml(text)}</textarea></div>`));
}
function clearEssayDraft() {
  if (!confirm("確定清除草稿？")) return;
  localStorage.removeItem(LS_ESSAY_DRAFT);
  showEssayPad();
  toast("已清除");
}

/* ================= 成績趨勢折線圖 ================= */
let trendSelected = null, histOpen = {};
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
const LS_DRILL_STATE = "hub.drill.state.v1";
function drillState() { try { return JSON.parse(localStorage.getItem(LS_DRILL_STATE)); } catch { return null; } }
function saveDrillState() {
  if (!drillQ.length || drillIdx >= drillQ.length) return clearDrillState();
  localStorage.setItem(LS_DRILL_STATE, JSON.stringify({
    q: drillQ, idx: drillIdx, picked: drillPicked, right: drillRight, hist: drillHist,
    wrongRound: drillWrongRound.map(w => w.id), savedAt: Date.now() }));
}
function clearDrillState() { localStorage.removeItem(LS_DRILL_STATE); }
function resumeDrill() {
  const st = drillState();
  if (!st) return showDrillTab();
  drillQ = st.q; drillIdx = st.idx; drillPicked = st.picked; drillRight = st.right;
  drillHist = st.hist || [];
  drillWrongRound = drillQ.filter(q => (st.wrongRound || []).includes(q.id));
  showDrillQ();
}
let poolIndex = null, poolCache = {}, drillQ = [], drillIdx = 0, drillPicked = null, drillRight = 0, drillWrongRound = [], drillHist = [];

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
  const wrongAll = drillWrongAll();
  const wrongN = wrongAll.length;
  const newN = wrongAll.filter(w => !w.exported).length;
  $app.innerHTML = `
    <h1>每日刷題</h1>
    <p class="muted">逐題即時對答．每輪從勾選的科目隨機抽題．今日已刷 ${todayN} 題</p>
    ${(() => {
      const st = drillState();
      if (!st || st.idx >= st.q.length) return "";
      return `<div class="card tappable" onclick="resumeDrill()" style="border-color:var(--accent)">
        <strong>▶ 繼續上輪</strong> <span class="muted">刷到第 ${st.idx + 1}/${st.q.length} 題</span>
        <div class="muted" style="font-size:0.8rem">上次暫停：${new Date(st.savedAt).toLocaleString("zh-TW", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}．點此接續</div>
      </div>`;
    })()}
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
    <div class="card">
      <div class="muted" style="font-weight:700;margin-bottom:4px">題庫進度</div>
      <div id="pool-progress" class="muted" style="font-size:0.85rem">計算中…</div>
      <div class="muted" style="font-size:0.75rem;margin-top:6px">「已看 X/Y」到齊代表該科刷完一輪、之後就會開始重複；2遍+ 是已看過兩次以上的題數</div>
    </div>
    ${wrongN ? `<div class="card">
      <strong>錯題本</strong> <span class="muted">${wrongN} 題${newN ? `．${newN} 題未匯出` : "．已全部匯出"}</span>
      <div class="muted" style="font-size:0.8rem;margin-top:2px">${(() => {
        const bySubj = {};
        wrongAll.forEach(w => { bySubj[w.subject] = (bySubj[w.subject] || 0) + 1; });
        return Object.entries(bySubj).map(([s, n]) => `${s} ${n}`).join("．");
      })()}</div>
      <div class="btn-row">
        <button class="ghost" onclick="startDrillWrong()">只刷錯題（依勾選科目）</button>
        <button class="ghost" onclick="exportDrillWrong()">單獨匯出錯題${newN ? `（${newN}）` : ""}</button>
      </div>
      <div class="muted" style="font-size:0.78rem;margin-top:6px">首頁「匯出今日讀書紀錄」已含當日錯題，平常不必再按這顆．已匯出的仍留在錯題本供「只刷錯題」複習${wrongN > newN ? `．<a href="#" onclick="event.preventDefault();exportDrillWrong(true)">重匯全部 ${wrongN} 題 ›</a>` : ""}</div>
    </div>` : ""}`;
  renderPoolProgress();
}
async function renderPoolProgress() {
  const box = document.getElementById("pool-progress");
  if (!box) return;
  const seen = drillSeen();
  const rows = [];
  for (const p of poolIndex) {
    const pool = await loadPool(p.subject);
    const total = pool.questions.length;
    let done = 0, twice = 0;
    pool.questions.forEach(q => {
      const s = seen[q.id] || 0;
      if (s >= 1) done++;
      if (s >= 2) twice++;
    });
    const cycled = done === total;
    rows.push(`<div style="display:flex;justify-content:space-between;padding:3px 0">
      <span>${p.subject}${cycled ? ' <span class="tag pend" style="font-size:0.62rem">已一輪</span>' : ""}</span>
      <span class="muted" style="font-size:0.8rem">已看 ${done}/${total}．2遍+ ${twice}</span></div>`);
  }
  box.innerHTML = rows.join("");
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
  drillQ = drillQ.map(shuffleOptions);
  beginDrillRun();
}
// 選項洗牌：防止第二遍靠「記得答案位置」作答。
// 不洗的兩種題：選項含「以上皆…」類；解析文字引用了選項代號（洗了代號會對不上）
function shuffleOptions(q) {
  if (q.options.some(o => /以上|皆非|皆是|皆正確|上述/.test(o))) return q;
  if (/(選項\s*[ABCD])|(^|[^A-Za-z])[ABCD]([^A-Za-z]|$)/.test(q.explain || "")) return q;
  const idx = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  return { ...q,
    options: idx.map(i => q.options[i]),
    answer: "ABCD"[idx.indexOf("ABCD".indexOf(q.answer))] };
}
async function startDrillWrong() {
  if (!poolIndex) poolIndex = await (await fetch("pools/index.json", { cache: "no-store" })).json();
  const cfg = readDrillForm();
  if (!cfg.subjects.length) { toast("至少勾一科"); return; }
  localStorage.setItem(LS_DRILL_CFG, JSON.stringify(cfg));
  const ids = new Set(drillWrongAll().map(w => w.id));
  drillQ = [];
  for (const p of poolIndex.filter(p => cfg.subjects.includes(p.subject))) {
    const pool = await loadPool(p.subject);
    pool.questions.forEach(q => { if (ids.has(q.id)) drillQ.push(q); });
  }
  if (!drillQ.length) { toast(ids.size ? "勾選的科目沒有錯題" : "錯題本是空的"); return; }
  drillQ.sort(() => Math.random() - 0.5);
  beginDrillRun();
}
function beginDrillRun() {
  clearDrillState();
  drillIdx = 0; drillPicked = null; drillRight = 0; drillWrongRound = []; drillHist = [];
  showDrillQ();
}
function lawBlock(q) {
  if (!q.law || !q.law.length) return "";
  return `<div class="law-block"><div class="law-title">📖 條文</div>` +
    q.law.map(l => `<div class="law-item"><span class="law-art">${l.art}</span>${l.text}</div>`).join("") +
    `</div>`;
}
function showDrillQ() {
  if (drillIdx >= drillQ.length) return showDrillDone();
  const q = drillQ[drillIdx];
  const answered = drillPicked !== null;
  $app.innerHTML = `
    <div class="exam-top">
      <button class="small ghost" onclick="pauseDrill()">暫停</button>
      ${drillIdx > 0 ? `<button class="small ghost" onclick="prevDrill()">← 上一題</button>` : ""}
      <span class="muted">${drillIdx + 1}/${drillQ.length}．${q.subject}</span>
      <button class="small ghost" onclick="openLookup()">🔍</button>
      <span class="muted">✔ ${drillRight}</span>
    </div>
    ${answered ? `<div class="q-num">${q.point}</div>` : ""}
    <div class="q-stem">${linkifyEnglish(q.stem)}</div>
    ${q.options.map((opt, i) => {
      const label = "ABCD"[i];
      let cls = "opt";
      if (answered) {
        if (label === q.answer) cls += " correct";
        else if (label === drillPicked) cls += " wrong";
      }
      return `<button class="${cls}" ${answered ? "disabled" : ""} onclick="pickDrill('${label}')" style="${answered ? "opacity:1" : ""}">（${label}）${answered ? linkifyEnglish(opt) : opt}</button>`;
    }).join("")}
    ${answered ? `<div class="explain">${q.explain}</div>${lawBlock(q)}
    <div class="btn-row"><button onclick="nextDrill()">${drillIdx === drillQ.length - 1 ? "看本輪結果" : "下一題"}</button></div>` : ""}`;
}
function pickDrill(label) {
  if (drillPicked !== null) return;
  const q = drillQ[drillIdx];
  drillPicked = label;
  drillHist[drillIdx] = label;
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
    const ex = wrongs.find(w => w.id === q.id);
    if (ex) {
      ex.exported = false;   // 又錯 → 重新列入待匯出（觸發 Notion「又錯」提醒）
      // user 與 answer 必須同輪更新：選項每輪重新洗牌，字母空間不同，只更新一邊會對不上
      ex.user = label; ex.answer = q.answer; ex.date = todayKey();
    } else {
      wrongs.push({ id: q.id, subject: q.subject, point: q.point, stem: q.stem, user: label, answer: q.answer, date: todayKey(), exported: false });
    }
    localStorage.setItem(LS_DRILL_WRONG, JSON.stringify(wrongs.slice(-200)));
  }
  saveDrillState();
  showDrillQ();
}
function nextDrill() { drillIdx++; drillPicked = drillHist[drillIdx] ?? null; saveDrillState(); showDrillQ(); }
function prevDrill() { if (drillIdx > 0) { drillIdx--; drillPicked = drillHist[drillIdx] ?? null; showDrillQ(); } }
function pauseDrill() { saveDrillState(); showDrillTab(); }
function showDrillDone() {
  clearDrillState();
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
function exportDrillWrong(all) {
  const wrongs = drillWrongAll();
  const pick = all ? wrongs : wrongs.filter(w => !w.exported);
  if (!pick.length) {
    toast(all ? "錯題本是空的" : "沒有新錯題（都匯出過了）");
    return;
  }
  const out = { type: "刷題錯題", exported: todayKey(),
    wrong: pick.map(({ exported, ...w }) => w) };   // 匯出不帶內部 exported 旗標
  const text = "【刷題錯題匯出，請依複習流程處理】\n" + JSON.stringify(out, null, 1);
  const done = () => {
    pick.forEach(w => { w.exported = true; });       // 標記已匯出，下次不再出現
    localStorage.setItem(LS_DRILL_WRONG, JSON.stringify(wrongs));
    showDrillTab();
  };
  navigator.clipboard.writeText(text)
    .then(() => { toast(`已複製 ${pick.length} 題，貼給 Claude 即可`); done(); })
    .catch(() => {
      $app.insertAdjacentHTML("beforeend",
        `<div class="card"><p class="muted">自動複製失敗，請長按全選複製：</p><textarea readonly>${escapeHtml(text)}</textarea>
         <button class="small" onclick="markExported()">複製好了，標記已匯出</button></div>`);
    });
}
// quiet：由「匯出讀書紀錄」呼叫時用——那邊自己會 toast，也不該把畫面切到刷題頁
function markExported(quiet) {
  const wrongs = drillWrongAll();
  wrongs.forEach(w => { if (!w.exported) w.exported = true; });
  localStorage.setItem(LS_DRILL_WRONG, JSON.stringify(wrongs));
  if (quiet === true) return;
  toast("已標記"); showDrillTab();
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

  // 考程表：每回＝四科全真模擬，日期到才解鎖
  const schedRows = SCHEDULE.filter(x => x.round).map(x => {
    const dd = Math.round((new Date(x.date) - new Date(today)) / 86400000);
    if (dd > 0) {
      return `<div class="card locked">
        <strong>🔒 ${x.label}</strong>
        <div class="muted">${x.date.slice(5).replace("-", "/")} 開考．還有 ${dd} 天．民法／郵政法規／英文／國文四卷</div>
      </div>`;
    }
    const inner = SUBJECTS.map(subj => {
      const exam = exams.find(e => e.type === "full" && e.round === x.round && e.subject === subj);
      if (exam) {
        const st = all[exam.id];
        const status = !st ? "" : st.finished
          ? `<span class="tag ok">已完卷 ${st.scoreText || ""}</span>`
          : `<span class="tag pend">進行中</span>`;
        return `<div class="trend-subj" onclick="openExam('${exam.id}')">
          <span>${subj}卷 ${status}</span><span class="muted">限時 ${exam.minutes} 分 ›</span>
        </div>`;
      }
      return `<div class="trend-subj" style="cursor:default;opacity:0.6">
        <span>${subj}卷</span><span class="muted">生成中——跟 Claude 說「出第${x.round}回${subj}卷」</span>
      </div>`;
    }).join("");
    return `<div class="card">
      <strong>📝 ${x.label}</strong> <span class="muted">${x.date.slice(5).replace("-", "/")}${dd === 0 ? "．今天開考" : ""}</span>
      <div style="margin-top:6px">${inner}</div>
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
    ${(() => {
      const at = loadAttempts();
      if (!at.length) return `<h2>練習紀錄</h2>
        <div class="card"><p class="muted" style="margin:0">還沒有紀錄——從現在起每次交卷都會自動記一筆（日期、成績、錯題），存在這支手機上。</p></div>`;
      const byDate = {};
      at.forEach(x => (byDate[x.date] = byDate[x.date] || []).push(x));
      const dates = Object.keys(byDate).sort().reverse();
      return `<h2>練習紀錄</h2>` + dates.map(d => {
        const rows = byDate[d];
        const open = histOpen[d] === true;
        const nW = rows.reduce((t, x) => t + x.wrongs.length, 0);
        return `<div class="card">
          <div class="note-group" onclick="histOpen['${d}']=${!open};showExamTab()">
            <strong>📅 ${d.slice(5).replace("-", "/")}</strong>
            <span class="muted">${rows.length} 次練習．錯 ${nW} 題 ${open ? "▾" : "▸"}</span>
          </div>
          ${open ? rows.map(x => `
            <div class="note-item">
              <div class="note-point">${x.title} <span class="tag ${x.mcRight === x.mcTotal ? "ok" : "pend"}">選擇 ${x.mcScore}/${x.mcMax}．對 ${x.mcRight}/${x.mcTotal}</span></div>
              ${x.wrongs.length ? `<div class="muted" style="font-size:0.8rem">✗ ${x.wrongs.map(w => `第${w.n}題 ${w.point}（你選 ${w.user}，答案 ${w.answer}）`).join("；")}</div>` : `<div class="muted" style="font-size:0.8rem">全對 🎉</div>`}
            </div>`).join("") : ""}
        </div>`;
      }).join("");
    })()}
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
  // 本機沒有作答紀錄，但雲端可能有批改成績（在其他裝置考的）
  let rv = null;
  try {
    const r = await fetch(`reviews/${id}.json`, { cache: "no-store" });
    if (r.ok) rv = await r.json();
  } catch {}
  $app.innerHTML = `
    <h1>${exam.title}</h1>
    ${rv ? `<div class="card">
      <div class="note-point">📋 這份卷已批改（${rv.gradedAt}）</div>
      <div class="score-big" style="font-size:1.6rem">${rv.total} <span class="muted" style="font-size:0.9rem">/ ${rv.totalMax}${rv.pass ? "．✅ 過及格線" : ""}</span></div>
      ${rv.note ? `<p class="muted" style="font-size:0.8rem">${rv.note}</p>` : ""}
      <p class="muted" style="font-size:0.8rem">當時的逐題作答存在原本作答的裝置上；在這裡按「開始作答」可重新練習，不影響已批改成績。</p>
    </div>` : ""}
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
    ${passageBox(q)}
    <div class="q-stem">${linkifyEnglish(q.stem)}</div>
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
function passageBox(q) {
  if (!q.passage) return "";
  return `<details class="q-passage" open><summary>題組文章</summary><div>${linkifyEnglish(q.passage).replace(/\n/g, "<br>")}</div></details>`;
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
  recordAttempt();
  showResult();
}
const LS_ATTEMPTS = "hub.exam.attempts.v1";
function loadAttempts() { try { return JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || []; } catch { return []; } }
function recordAttempt() {
  const wrongs = exam.questions.map((q, i) => (!q.essay && sess.answers[i] !== q.answer)
    ? { n: i + 1, point: q.point || q.section, user: sess.answers[i] || "未答", answer: q.answer } : null).filter(Boolean);
  const list = loadAttempts();
  // date 記作答開始日而非批改日：隔日才批改的卷不該算成批改當天的讀書量
  list.push({ id: exam.id, title: exam.title, subject: exam.subject, date: dayKeyOf(sess.started || Date.now()),
              mcScore: sess.mcScore, mcMax: sess.mcMax, mcRight: sess.mcRight, mcTotal: sess.mcTotal, wrongs });
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(list));
}
function retakeExam(id) {
  const all = loadSessions();
  delete all[id];
  localStorage.setItem(LS_SESS, JSON.stringify(all));
  openExam(id);
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
        <button class="ghost" onclick="retakeExam('${exam.id}')">🔄 再練一次</button>
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
      ${passageBox(q)}
      <div class="q-stem">${q.stem}</div>
      <div class="explain">你的作答：\n${user ? escapeHtml(user) : "（未作答）"}</div>
      ${rv ? `<div class="explain" style="border-left-color:var(--warn)">批改評語：\n${escapeHtml(rv.comment)}</div>` : ""}
    </div>`;
  }
  const right = user === q.answer;
  return `<div class="result-q">
    <div class="q-num">第 ${i + 1} 題．${q.point || q.section}
      <span class="tag ${right ? "ok" : "bad"}">${right ? "答對" : user ? `答錯（你選 ${user}）` : "未作答"}</span>${(sess.flags||[])[i] ? ' <span class="tag pend">🚩 疑問</span>' : ''}</div>
    ${passageBox(q)}
    <div class="q-stem">${linkifyEnglish(q.stem)}</div>
    ${q.options.map((opt, j) => {
      const label = "ABCD"[j];
      let cls = "opt";
      if (label === q.answer) cls += " correct";
      else if (label === user) cls += " wrong";
      return `<div class="${cls}">（${label}）${linkifyEnglish(opt)}</div>`;
    }).join("")}
    <div class="explain">${q.explain}</div>${lawBlock(q)}
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
const LS_VOCAB_DAILY = "hub.vocab.daily.v1";
let vocab = null, vTasks = [], vTIdx = 0, vAnswered = null, vRight = 0;

function vStages() { try { return JSON.parse(localStorage.getItem(LS_VOCAB2)) || {}; } catch { return {}; } }
// 當日實際作答字數／答對數。stage 分佈是快照（字滿級後就不再變動），
// 看不出「今天到底做了幾個」，所以另記流水計數。
function vocabDaily() { try { return JSON.parse(localStorage.getItem(LS_VOCAB_DAILY)) || {}; } catch { return {}; } }
function bumpVocabDaily(right) {
  const all = vocabDaily();
  const d = all[todayKey()] || { done: 0, right: 0 };
  d.done++;
  if (right) d.right++;
  all[todayKey()] = d;
  localStorage.setItem(LS_VOCAB_DAILY, JSON.stringify(all));
}
function setStage(w, st) {
  const all = vStages();
  all[w] = st;
  localStorage.setItem(LS_VOCAB2, JSON.stringify(all));
}
function slugOf(w) { return w.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
let bestV = null;
function ttsSpeak(text) {
  try {
    speechSynthesis.cancel();
    if (!bestV) {
      const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.startsWith("en"));
      bestV = vs.find(v => /Google US English/i.test(v.name))
           || vs.find(v => /Samantha|Ava|Allison|Karen|Daniel/i.test(v.name))
           || vs.find(v => v.lang === "en-US") || vs[0] || null;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    if (bestV) u.voice = bestV;
    speechSynthesis.speak(u);
  } catch {}
}
function speak(text) {
  // 優先播預先生成的高品質音檔（單字或例句），沒有才用裝置語音
  const av = (vocab ? (typeof allVocab === "function" ? allVocab() : vocab) : []);
  const hitW = av.find(v => v.w === text);
  const hitE = !hitW && av.find(v => v.ex === text);
  const slug = hitW ? slugOf(hitW.w) : (hitE ? slugOf(hitE.w) + "_ex" : null);
  if (slug) {
    const a = new Audio("audio/" + slug + ".m4a");
    a.onerror = () => ttsSpeak(text);
    a.play().catch(() => ttsSpeak(text));
    return;
  }
  ttsSpeak(text);
}
let grammar = null, gOpen = {};
const LS_VOCAB_CUSTOM = "hub.vocab.custom.v1";
function customVocab() { try { return JSON.parse(localStorage.getItem(LS_VOCAB_CUSTOM)) || []; } catch { return []; } }
function allVocab() {
  const base = vocab || [];
  const have = new Set(base.map(v => v.w.toLowerCase()));
  return base.concat(customVocab().filter(v => !have.has(v.w.toLowerCase())));
}
function addCustomWord(w, zh, ex) {
  const list = customVocab();
  if (!list.find(x => x.w.toLowerCase() === w.toLowerCase())) {
    list.push({ w, pos: "－", zh, ex: ex || "", custom: true });
    localStorage.setItem(LS_VOCAB_CUSTOM, JSON.stringify(list));
  }
}
function removeCustomWord(w) {
  const list = customVocab();
  const kept = list.filter(x => x.w.toLowerCase() !== w.toLowerCase());
  if (kept.length === list.length) {
    toast("此字已併入正式辭典，請叫 Claude 從 vocab.json 移除");
    return;
  }
  localStorage.setItem(LS_VOCAB_CUSTOM, JSON.stringify(kept));
  const st = vStages();
  if (st[w] != null) { delete st[w]; localStorage.setItem(LS_VOCAB2, JSON.stringify(st)); }
  toast(`已移除自訂單字「${w}」`);
  renderVocabList();
}
// 字形防呆：candidate 是否與辭典既有字互為時態/單複數變化
function inflForms(x) {
  x = x.toLowerCase();
  const out = new Set([x]);
  const bases = [x, x.endsWith("e") ? x.slice(0, -1) : x, x.endsWith("y") ? x.slice(0, -1) : x];
  bases.forEach(b => ["s", "es", "ed", "ing", "d"].forEach(suf => out.add(b + suf)));
  if (x.endsWith("y")) { out.add(x.slice(0, -1) + "ies"); out.add(x.slice(0, -1) + "ied"); }
  const stripped = x.replace(/(ing|ied|ies|ed|es|s)$/, "");
  if (stripped.length >= 3) ["", "e", "s", "es", "ed", "ing", "d", "y"].forEach(suf => out.add(stripped + suf));
  return out;
}
function relatedExistingWord(w) {
  const wl = w.toLowerCase();
  const set = new Set(allVocab().map(v => v.w.toLowerCase()));
  for (const f of inflForms(wl)) if (f !== wl && set.has(f)) return f;
  for (const e of set) if (e !== wl && Math.abs(e.length - wl.length) <= 3 && inflForms(e).has(wl)) return e;
  return null;
}
function pruneCustomWords() {
  const have = new Set((vocab || []).map(v => v.w.toLowerCase()));
  const list = customVocab();
  const kept = list.filter(v => !have.has(v.w.toLowerCase()));
  if (kept.length !== list.length) {
    localStorage.setItem(LS_VOCAB_CUSTOM, JSON.stringify(kept));
    toast(`${list.length - kept.length} 個自訂單字已轉入正式辭典，自動清除本機記錄`);
  }
}
function exportCustomWords() {
  const list = customVocab();
  const text = "【自訂單字匯出，請補完詞性與例句後併入 vocab.json】\n" + JSON.stringify(list, null, 1);
  navigator.clipboard.writeText(text).then(() => toast("已複製，貼給 Claude 轉正式辭典")).catch(() => {});
}
async function showVocabTab() {
  if (!vocab) vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json();
  pruneCustomWords();
  if (!grammar) { try { grammar = await (await fetch("data/grammar.json", { cache: "no-store" })).json(); } catch { grammar = []; } }
  const st = vStages();
  const av = allVocab();
  const mastered = av.filter(v => st[v.w] === 3).length;
  const learning = av.filter(v => (st[v.w] || 0) === 1 || (st[v.w] || 0) === 2).length;
  const nCustom = customVocab().length;
  $app.innerHTML = `
    <h1>單字辭典</h1>
    <p class="muted">共 ${av.length} 字${nCustom ? `（含自訂 ${nCustom}）` : ""}．已熟 ${mastered}．闖關中 ${learning}．每日單字：翻卡瀏覽 15 字 → 提交測驗，從首頁「來一輪單字」進入</p>
    ${nCustom ? `<div class="btn-row" style="margin:0 0 10px"><button class="small ghost" onclick="exportCustomWords()">📤 匯出自訂單字給 Claude 轉正式辭典</button></div>` : ""}
    ${(mastered === av.length) ? `<div class="notice">🎉 全部單字都熟了！跟 Claude 說「補新單字」，馬上加一批進來。</div>` : ""}
    <div class="card">
      <div style="display:flex;gap:8px;align-items:center">
        <input class="plan-input" id="vocab-search" placeholder="🔍 搜尋單字或中文…" oninput="renderVocabList()" style="flex:1">
        <button class="small ghost" onclick="vListShow=!vListShow;renderVocabList()" id="vlist-toggle" style="flex:0 0 auto">${vListShow ? "收合 ▴" : "全部 ▾"}</button>
      </div>
      <div id="vocab-list" style="margin-top:8px"></div>
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
let vOpen = null, vListShow = false;
function renderVocabList() {
  const box = document.getElementById("vocab-list");
  if (!box || !vocab) return;
  const kw = (document.getElementById("vocab-search")?.value || "").trim().toLowerCase();
  const tg = document.getElementById("vlist-toggle");
  if (tg) tg.textContent = vListShow ? "收合 ▴" : "全部 ▾";
  if (!kw && !vListShow) { box.innerHTML = `<p class="muted" style="margin:0">輸入關鍵字搜尋，或點「全部」展開單字總表。</p>`; return; }
  const st = vStages();
  const list = allVocab().filter(v => !kw || v.w.toLowerCase().includes(kw) || v.zh.includes(kw));
  box.innerHTML = list.length ? list.map(v => {
    const stage = st[v.w] || 0;
    const dots = "●".repeat(stage) + "○".repeat(3 - stage);
    const open = vOpen === v.w;
    return `<div class="vlist-row" onclick="vOpen=vOpen==='${v.w.replace(/'/g, "\\'")}'?null:'${v.w.replace(/'/g, "\\'")}';renderVocabList()">
      <div class="vlist-head">
        <span><strong>${v.w}</strong> <span class="muted">${v.pos}</span>　${v.zh}${v.custom ? ' <span class="tag pend" style="font-size:0.65rem">✎ 自訂</span>' : ""}</span>
        <span class="muted" style="font-size:0.75rem">${dots}</span>
      </div>
      ${open ? `<div class="muted" style="font-style:italic;margin-top:4px">${v.ex}</div>
        <div class="btn-row" style="margin-top:8px">
          <button class="small ghost" onclick="event.stopPropagation();speak('${v.w.replace(/'/g, "\\'")}')">🔊 發音</button>
          <button class="small ghost" onclick="event.stopPropagation();speak(${JSON.stringify(v.ex).replace(/"/g, "&quot;")})">🔊 例句</button>
          ${v.custom ? `<button class="small ghost del-btn" onclick="event.stopPropagation();removeCustomWord(${JSON.stringify(v.w).replace(/"/g, "&quot;")})">✕ 移除</button>` : ""}
        </div>` : ""}
    </div>`;
  }).join("") : `<p class="muted">找不到「${kw}」。<a href="https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${encodeURIComponent(kw)}" target="_blank" rel="noopener">到劍橋詞典查 ›</a></p>`
    + (/^[a-z][a-z '-]*$/.test(kw) ? `<div style="margin-top:6px">
        <input class="plan-input" id="vlist-add-zh" placeholder="查到意思後，輸入中文解釋…" style="width:100%">
        <div class="btn-row" style="margin-top:8px"><button class="small" onclick="saveCustomWordFromList('${kw.replace(/'/g, "\\'")}')">➕ 加入我的單字</button></div>
      </div>` : "");
}
function saveCustomWordFromList(w) {
  const zh = (document.getElementById("vlist-add-zh")?.value || "").trim();
  if (!zh) { toast("先填中文解釋"); return; }
  const rel = relatedExistingWord(w);
  if (rel && !confirm(`辭典已有「${rel}」，「${w}」看起來是它的時態／單複數變化。\n建議加原形就好，確定還要加「${w}」嗎？`)) return;
  addCustomWord(w, zh, "");
  toast(`「${w}」已加入辭典，會進三關輪替`);
  renderVocabList();
}
function blankWord(ex, w) {
  // 1) 整組比對（含片語），大小寫不拘、允許中間空白變化
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp("\\b" + esc + "\\b", "i");
  if (re.test(ex)) return ex.replace(re, "＿＿＿＿");
  // 2) 單字字形變化（deliver → delivered）：長字首比對
  const pre = w.slice(0, Math.min(w.length, 5)).toLowerCase();
  let hit = false;
  const out = ex.split(/(\s+)/).map(tok => {
    const clean = tok.replace(/[^A-Za-z]/g, "").toLowerCase();
    if (!hit && clean && (clean === w.toLowerCase() || clean.startsWith(pre))) {
      hit = true;
      return tok.replace(/[A-Za-z]+/, "＿＿＿＿");
    }
    return tok;
  }).join("");
  return hit ? out : null; // 挖不掉回傳 null，讓呼叫端改考中翻英
}
function distractors(word, n) {
  const others = allVocab().filter(v => v.w !== word.w);
  const same = others.filter(v => v.pos === word.pos);
  const pool = (same.length >= n ? same : others).slice();
  pool.sort(() => Math.random() - 0.5);
  return pool.slice(0, n);
}
/* 每日單字：階段一快速翻卡瀏覽（正面純英文）→ 提交 → 階段二測驗同批單字 */
let vWords = [], vPhase = "browse", vFlip = false, vSeenMax = 0;

async function startVocabRound() {
  if (!vocab) vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json();
  const av = allVocab();
  const st = vStages();
  const due = av.filter(v => (st[v.w] || 0) === 1 || (st[v.w] || 0) === 2).sort(() => Math.random() - 0.5);
  const fresh = av.filter(v => (st[v.w] || 0) === 0).sort(() => Math.random() - 0.5);
  vWords = due.slice(0, 8).concat(fresh).slice(0, 15);
  if (!vWords.length) { toast("全部單字都熟了！🎉"); return; }
  vPhase = "browse"; vTIdx = 0; vFlip = false; vAnswered = null; vRight = 0; vSeenMax = 0;
  showVocabBrowse();
}

function showVocabBrowse() {
  const v = vWords[vTIdx];
  vSeenMax = Math.max(vSeenMax, vTIdx);
  const seenAll = vSeenMax >= vWords.length - 1;
  $app.innerHTML = `
    <div class="exam-top">
      <button class="small ghost" onclick="showVocabTab()">結束</button>
      <span class="muted">瀏覽 ${vTIdx + 1}/${vWords.length}</span>
      <span class="muted">點卡片翻面</span>
    </div>
    <div class="flashcard ${vFlip ? "flip" : ""}" onclick="vFlip=!vFlip;showVocabBrowse()">
      ${vFlip
        ? `<div class="fc-word" style="font-size:1.3rem">${v.w} <span class="muted">${v.pos}</span></div>
           <div class="fc-zh">${v.zh}</div>
           ${v.ex ? `<div class="fc-ex">${v.ex}</div>` : ""}
           <button class="small ghost speak-btn" onclick="event.stopPropagation();speak(${JSON.stringify(v.ex || v.w).replace(/"/g, "&quot;")})">🔊 例句</button>`
        : `<div class="fc-word">${v.w}</div>
           <button class="small ghost speak-btn" onclick="event.stopPropagation();speak('${v.w.replace(/'/g, "\\'")}')">🔊</button>
           <div class="muted">想一下意思，點卡片翻面對答案</div>`}
    </div>
    <div class="btn-row">
      <button class="ghost" onclick="vTIdx=Math.max(0,vTIdx-1);vFlip=false;showVocabBrowse()" ${vTIdx === 0 ? "disabled" : ""}>上一個</button>
      ${vTIdx < vWords.length - 1
        ? `<button onclick="vTIdx++;vFlip=false;showVocabBrowse()">下一個</button>`
        : ""}
      ${seenAll ? `<button onclick="startVocabQuiz()">✋ 提交，開始測驗</button>` : ""}
    </div>
    ${!seenAll ? `<p class="muted" style="text-align:center;margin-top:8px">看完全部 ${vWords.length} 個字後，提交按鈕會出現</p>` : ""}`;
}

function startVocabQuiz() {
  const st = vStages();
  vTasks = vWords.map(v => {
    const stage = st[v.w] || 0;
    const blanked = v.ex ? blankWord(v.ex, v.w) : null;
    const type = (blanked && stage < 2) ? "cloze" : "zh2en";
    return { v, type, blanked };
  }).sort(() => Math.random() - 0.5);
  vPhase = "quiz"; vTIdx = 0; vAnswered = null; vRight = 0;
  showVocabTask();
}

function showVocabTask() {
  if (vTIdx >= vTasks.length) return showVocabDone();
  const t = vTasks[vTIdx];
  const head = `
    <div class="exam-top">
      <button class="small ghost" onclick="showVocabTab()">結束</button>
      <span class="muted">測驗 ${vTIdx + 1}/${vTasks.length}</span>
      <span class="muted">${t.type === "cloze" ? "✏️ 例句挖空" : "🎯 中翻英"}</span>
    </div>`;
  const opts = t.opts || (t.opts = [t.v, ...distractors(t.v, 3)].sort(() => Math.random() - 0.5));
  const answered = vAnswered !== null;
  const stem = t.type === "cloze"
    ? `<div class="q-stem">${t.blanked}</div><p class="muted">（${t.v.pos}${t.v.zh ? "．" + t.v.zh : ""}）</p>`
    : `<div class="q-stem" style="font-size:1.2rem;font-weight:700">${t.v.zh}<span class="muted" style="font-size:0.85rem">（${t.v.pos}）</span></div>`;
  $app.innerHTML = head + stem + opts.map(o => {
    let cls = "opt";
    if (answered) {
      if (o.w === t.v.w) cls += " correct";
      else if (o.w === vAnswered) cls += " wrong";
    }
    return `<button class="${cls}" ${answered ? "disabled" : ""} style="${answered ? "opacity:1" : ""}"
      onclick="pickVocab('${o.w.replace(/'/g, "\\'")}')">${o.w}</button>`;
  }).join("") + (answered ? `
    <div class="explain">${t.v.w}（${t.v.pos}）${t.v.zh}${t.v.ex ? "\n" + t.v.ex : ""}</div>
    <div class="btn-row">
      <button class="small ghost" onclick="speak('${t.v.w.replace(/'/g, "\\'")}')">🔊 唸一次</button>
      <button onclick="nextVocab()">${vTIdx === vTasks.length - 1 ? "看結果" : "下一題"}</button>
    </div>` : "");
}

function pickVocab(w) {
  if (vAnswered !== null) return;
  const t = vTasks[vTIdx];
  vAnswered = w;
  const cur = vStages()[t.v.w] || 0;
  bumpVocabDaily(w === t.v.w);
  if (w === t.v.w) {
    vRight++;
    setStage(t.v.w, Math.min(3, cur + 1));
    speak(t.v.w);
  } else {
    setStage(t.v.w, Math.max(0, cur - 1));
  }
  showVocabTask();
}
function nextVocab() { vTIdx++; vAnswered = null; showVocabTask(); }

function showVocabDone() {
  const st = vStages();
  const mastered = allVocab().filter(v => st[v.w] === 3).length;
  const pct = Math.round(vRight / vTasks.length * 100);
  $app.innerHTML = `
    <div class="card" style="text-align:center;margin-top:30px">
      <h2 style="background:none">今日單字完成！</h2>
      <div class="score-big">${vRight}<span class="muted" style="font-size:1rem"> / ${vTasks.length}</span></div>
      <p class="muted">${pct === 100 ? "全對！記憶是真的 🎉" : "答錯的字降了一級，明天會再出現"}．已熟累計 ${mastered} / ${allVocab().length}</p>
      <div class="btn-row">
        <button onclick="startVocabRound()">再來一輪</button>
        <button class="ghost" onclick="showVocabTab()">回辭典</button>
      </div>
    </div>`;
}

/* ================= 筆記速查 ================= */
let notes = null, notesWarnOnly = false, openGroups = {};
let notesView = "notes", essays = null, essayOpen = {}, notesSubject = "郵政法規", notesTable = true;
async function showNotesTab() {
  if (notesView === "essay") return showEssayView();
  if (!notes) notes = await (await fetch("data/notes.json", { cache: "no-store" })).json();
  $app.innerHTML = `
    <h1>筆記速查</h1>
    <div class="btn-row" style="margin-bottom:4px">
      <button class="small">📌 速查表</button>
      <button class="small ghost" onclick="notesView='essay';showNotesTab()">✍️ 作文素材</button>
    </div>
    <p class="muted">數字、期間、金額速查表（來源：本機速記筆記）</p>
    <div class="btn-row" style="margin-bottom:12px">
      <button class="small ${notesSubject === "郵政法規" ? "" : "ghost"}" onclick="notesSubject='郵政法規';showNotesTab()">📮 郵政法規</button>
      <button class="small ${notesSubject === "民法" ? "" : "ghost"}" onclick="notesSubject='民法';showNotesTab()">⚖️ 民法</button>
      <button class="small ${notesWarnOnly ? "" : "ghost"}" onclick="notesWarnOnly=!notesWarnOnly;showNotesTab()">
        ${notesWarnOnly ? "顯示全部" : "只看 ⚠"}</button>
      <button class="small ghost" onclick="notesTable=!notesTable;showNotesTab()">${notesTable ? "☰ 條列" : "▦ 表格"}</button>
    </div>
    ${notes.map((g, gi) => {
      if ((g.subject || "郵政法規") !== notesSubject) return "";
      const items = notesWarnOnly ? g.items.filter(x => x.warn) : g.items;
      if (!items.length) return "";
      const open = openGroups[gi] === true;
      return `<div class="card">
        <div class="note-group" onclick="openGroups[${gi}]=${!open};showNotesTab()">
          <strong>${g.group}</strong>
          <span class="muted">${items.length} 條 ${open ? "▾" : "▸"}</span>
        </div>
        ${open ? (notesTable
          ? `<div class="note-table-wrap"><table class="note-table">
              <thead><tr><th>考點</th><th>內容</th><th>備註</th></tr></thead>
              <tbody>${items.map(x => `<tr class="${x.warn ? "warn-row" : ""}">
                <td>${x.warn ? "⚠ " : ""}${x.point}</td>
                <td>${x.value}</td>
                <td class="muted">${x.note || ""}</td>
              </tr>`).join("")}</tbody>
            </table></div>`
          : items.map(x => `
          <div class="note-item ${x.warn ? "warn-item" : ""}">
            <div class="note-point">${x.warn ? "⚠ " : ""}${x.point}</div>
            <div class="note-value">${x.value}</div>
            ${x.note ? `<div class="muted" style="font-size:0.8rem">${x.note}</div>` : ""}
          </div>`).join("")) : ""}
      </div>`;
    }).join("")}`;
}

async function showEssayView() {
  if (!essays) { try { essays = await (await fetch("data/essay.json", { cache: "no-store" })).json(); } catch { essays = []; } }
  $app.innerHTML = `
    <h1>筆記速查</h1>
    <div class="btn-row" style="margin-bottom:4px">
      <button class="small ghost" onclick="notesView='notes';showNotesTab()">📌 速查表</button>
      <button class="small">✍️ 作文素材</button>
    </div>
    <p class="muted">每日 3 個素材：好句、好例子、替換詞——假日整篇作文前先來翻彈藥庫</p>
    ${essays.length ? essays.map((e, i) => {
      const open = essayOpen[e.date] !== undefined ? essayOpen[e.date] : i === 0;
      return `<div class="card">
        <div class="note-group" onclick="essayOpen['${e.date}']=${!open};showEssayView()">
          <strong>${e.theme || "（未定主題）"}</strong>
          <span class="muted">${e.date.slice(5).replace("-", "/")} ${open ? "▾" : "▸"}</span>
        </div>
        ${open ? `
          ${e.text ? `<div class="muted" style="margin:6px 0;line-height:1.7">${e.text}</div>` : ""}
          ${e.sentence ? `<div class="note-item"><div class="note-point">💬 好句</div><div class="note-value">${e.sentence}</div></div>` : ""}
          ${e.example ? `<div class="note-item"><div class="note-point">🧩 好例子</div><div class="note-value">${e.example}</div></div>` : ""}
          ${e.words ? `<div class="note-item"><div class="note-point">🔁 替換詞</div><div class="note-value">${e.words}</div></div>` : ""}
          ${e.idiom ? `<div class="note-item"><div class="note-point">📿 今日成語</div><div class="note-value">${e.idiom}</div></div>` : ""}
          ${e.quote ? `<div class="note-item"><div class="note-point">📜 今日名句</div><div class="note-value">${e.quote}</div></div>` : ""}
          ${e.para ? `<div class="note-item"><div class="note-point">✏️ 我的短段</div><div class="note-value" style="font-weight:400">${e.para}</div>
            ${e.note ? `<div class="muted" style="font-size:0.8rem;margin-top:4px">📝 ${e.note}</div>` : ""}</div>` : ""}
        ` : ""}
      </div>`;
    }).join("") : `<div class="card"><p class="muted" style="margin:0">還沒有素材——明天開始複習時就會自動出現第一筆。</p></div>`}`;
}

/* ================= 查單字浮層 ================= */
// 把英文單字包成可點的 span（手機用：點一下就帶入查詢，免長按選字）
function linkifyEnglish(text) {
  return (text || "").replace(/[A-Za-z][A-Za-z'-]{2,}/g,
    m => `<span class="wlook" onclick="event.stopPropagation();lookupWord('${m.replace(/'/g, "\\'")}')">${m}</span>`);
}
function lookupWord(w) { openLookup(w); }

async function openLookup(preset) {
  if (!vocab) { try { vocab = await (await fetch("data/vocab.json", { cache: "no-store" })).json(); } catch {} }
  const sel = (preset || (window.getSelection ? String(window.getSelection()) : "")).trim().slice(0, 30);
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
  const exact = allVocab().find(v => v.w.toLowerCase() === kw);
  box.innerHTML = (hits.length ? hits.map(v => `
    <div class="vlist-row">
      <div><strong>${v.w}</strong> <span class="muted">${v.pos}</span>　${v.zh}
        <button class="small ghost" style="padding:1px 8px" onclick="speak('${v.w.replace(/'/g, "\\'")}')">🔊</button></div>
      <div class="muted" style="font-style:italic">${v.ex}</div>
    </div>`).join("") : `<p class="muted">單字庫沒有這個字。</p>`)
    + `<p style="margin-top:6px"><a href="https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${encodeURIComponent(kw)}" target="_blank" rel="noopener">在劍橋詞典查「${kw}」 ›</a></p>`
    + (!exact && /^[a-z][a-z '-]*$/.test(kw) ? `<div id="add-word-zone">
        <input class="plan-input" id="add-word-zh" placeholder="查到意思後，輸入中文解釋…" style="width:100%;margin-top:6px">
        <div class="btn-row" style="margin-top:8px"><button class="small" onclick="saveCustomWord('${kw.replace(/'/g, "\\'")}')">➕ 加入我的單字</button></div>
      </div>` : "");
}
function saveCustomWord(w) {
  const zh = (document.getElementById("add-word-zh")?.value || "").trim();
  if (!zh) { toast("先填中文解釋"); return; }
  addCustomWord(w, zh, "");
  toast(`「${w}」已加入辭典，會進三關輪替`);
  renderLookup();
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
