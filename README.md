# study-hub 資料流向說明

郵政升等考的隨身讀書 PWA。這份文件說明**資料怎麼跑**——作答存在哪、匯出後發生什麼、哪些檔案改了手機才看得到。

寫給「隔了三個月回來看、或換一台電腦重建」的自己，不預設你記得任何細節。

（AI 的處理規則寫在 [CLAUDE.md](CLAUDE.md)，那份是「收到匯出要做什麼」；這份是「系統怎麼運作」。）

---

## 一分鐘版本

```
手機作答  →  localStorage（只在那台手機裡）
   ↓ 按「匯出今日讀書紀錄」，JSON 進剪貼簿
貼給 Claude
   ↓ 寫回 repo、commit、push
GitHub Pages 重新部署（約 1～2 分鐘）
   ↓
手機重開 app  →  拿到新的 progress.json / vocab.json …
```

**沒有後端、沒有帳號、沒有自動同步。**匯出按鈕是手機資料離開手機的唯一途徑。

---

## 為什麼是這種架構

純靜態、無建置步驟，GitHub Pages 直接吐檔案。好處是通勤時開手機就能用、離線也能刷題；代價是資料回流得手動貼一次。

這是刻意的取捨：與其架一個要維護的後端，不如每天貼一次 JSON。

---

## 資料存在哪

### 手機端：localStorage（唯一真相）

所有作答都在這裡，GitHub 上的檔案完全不知情。

| Key | 裝什麼 |
| :-- | :-- |
| `hub.drill.wrong.v1` | 錯題本（含 `exported` 旗標，標記是否已回流） |
| `hub.drill.daily.v1` | 每日刷題數 |
| `hub.drill.seen.v1` | 每題出現次數（避免重複出題） |
| `hub.drill.cfg.v1` / `hub.drill.state.v1` | 刷題設定、中斷續作 |
| `hub.vocab.v2` | 單字熟練度（每字 0～3 級） |
| `hub.vocab.daily.v1` | 每日單字作答數與答對數 |
| `hub.vocab.custom.v1` | 自訂單字（待匯出） |
| `hub.exam.attempts.v1` / `examweb.sessions.v1` | 模考成績、作答 session |
| `hub.daily.v1` | 今日待辦勾選狀態 |
| `hub.plan.v1` | 自訂待辦項目 |
| `hub.essay.draft.v1` | 作文草稿 |

> **風險**：清除瀏覽器資料、換手機、iOS 長期未開啟自動清理 → 全部消失。匯出是唯一備份路徑，所以養成當天結束就匯出的習慣。

### repo 端：`data/` 底下的 JSON

關鍵區別是**哪些 app 會讀回去**：

| 檔案 | app 會讀回嗎 | 用途 |
| :-- | :-- | :-- |
| `data/progress.json` | ✅ 首頁待辦 | 每日固定項目＋各日期的回收清單 |
| `data/vocab.json` | ✅ | 單字庫（含詞性、例句、音檔對應） |
| `data/notes.json` | ✅ | 筆記 |
| `data/essay.json` | ✅ | 作文素材 |
| `data/grammar.json` | ✅ | 文法重點 |
| `pools/` `exams/` `reviews/` | ✅ | 題庫、考卷、詳解 |
| `data/records.json` | ❌ **不讀** | 純歷史存檔，給日後回顧與分析用 |

`records.json` 是唯一「只進不出」的檔案。改它手機上不會有任何變化——這是正常的，不是壞了。

---

## 匯出有哪幾種

app 內的匯出按鈕會把 JSON 複製到剪貼簿，開頭都是【…匯出】，貼給 Claude 就會依 [CLAUDE.md](CLAUDE.md) 的規則處理。

| 匯出 | 從哪按 | 去向 |
| :-- | :-- | :-- |
| **讀書紀錄** | 首頁 | `records.json` 存檔 ＋ 排隔日回收進 `progress.json` |
| 自訂單字 | 單字頁 | `vocab.json` |
| 作文短段 | 作文頁 | 不寫檔，直接回覆批改 |
| 單獨匯出錯題 | 刷題頁（備用） | `progress.json` 回收清單 |

**日常只需要按「匯出今日讀書紀錄」一份。**它已含當日錯題，按下去就會把錯題標記 `exported`。刷題頁那顆是備用的，用在想單獨補排、或想重排已匯出過的題。

### 讀書紀錄的欄位

```jsonc
{
  "date": "2026-07-21",
  "drill": {
    "count": 30,        // 今日刷題數
    "wrong": [ … ]      // 今日錯題
  },
  "exams": [ … ],       // 今日模考成績
  "vocab": {            // 今日單字流水計數
    "done": 15,         // 實際作答字數
    "right": 11
  },
  "vocabStages": {      // 熟練度分佈快照（僅含已接觸的字）
    "0": 2, "1": 23, "2": 8, "3": 16
  },
  "pendingWrong": [ … ] // 前幾天漏匯的錯題，只在有殘留時出現
}
```

**`vocab.done` 和 `vocabStages` 要一起看。**分佈是快照，字升到 3 級後就不再變動，光看分佈會低估用功程度（做了一輪但全答對且都已滿級 → 分佈完全沒變）。`done` 才是當天實際做了幾個。

2026-07-21 以前的紀錄沒有 `vocab` 欄位，是加這個計數之前留下的，屬正常。

---

## 幾個會踩到的細節

**同一天可以重複匯出。**匯出是當日累計快照，晚的一定比較完整，直接覆蓋。中午匯一次、晚上再匯一次沒問題。

**跨日漏匯也接得回來。**隔了幾天沒匯，`pendingWrong` 會裝殘留的錯題一併排回收，且不會跟當天的 `drill.wrong` 重複。

**待辦勾選是「本機 OR 伺服器」合併**（[app.js](app.js) 的 `showHomeTab`）。手機上勾的存 localStorage，repo 裡標的 `done` 也算數，任一為真就顯示完成——所以手機勾過的不會被回流覆蓋掉。

**快取是網路優先**（[sw.js](sw.js)）。有網路一定拿最新版，斷網（通勤地下段）才吃快取。所以 push 完不必清快取，重開 app 就好。改動 `app.js` 這類核心檔時順手把 `sw.js` 的 `CACHE` 版本號 +1 比較保險。

**push 完不會立刻生效**，要等 GitHub Pages 重新部署，約 1～2 分鐘。

---

## 雲端做不了、要回 Mac 的事

| 事項 | 為什麼 |
| :-- | :-- |
| 單字發音音檔 | `scripts/add_word.py` 要跑 macOS 的 `say`，雲端 session 只能補詞性與例句，音檔得回 Mac 生成 |
| Notion 錯題回收 | 完整流程在 Mac 本機的考試 rules，這個 repo 只負責落地成 `progress.json` |

在雲端 session 補完單字後，回 Mac 記得跑一次音檔生成。

---

## 檔案結構

```
index.html / app.js / style.css   前端本體（無建置步驟，改完直接生效）
sw.js                             service worker，離線快取
data/                             主要資料（見上表）
pools/                            刷題題庫
exams/ reviews/                   模考卷與詳解
audio/                            單字發音檔
scripts/                          Mac 端維護腳本（加單字、生音檔、排進度）
CLAUDE.md                         AI 收到匯出時的處理規則
```
