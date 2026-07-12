#!/usr/bin/env python3
"""每日收尾：讀書紀錄「明日建議」→ 網站今日進度，一鍵完成。

用法：
  update_progress.py            讀今日讀書紀錄，寫入「明天」的進度並 push
  update_progress.py --date YYYY-MM-DD   指定讀書紀錄日期（進度寫入其翌日）
  update_progress.py --dry-run  只顯示將寫入的內容，不改檔不推

流程：解析 ~/Desktop/考試/讀書紀錄/{日期}*讀書紀錄.md 的「## 明日建議」
條列項目 → 合併寫入 data/progress.json（新格式 {"日期":{"items":[...],"done":[...]}}，
保留既有勾選狀態與其他日期）→ commit push。收尾時由 AI 在寫完讀書紀錄後執行。
"""
import argparse, datetime, glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRESS = os.path.join(ROOT, "data", "progress.json")
RECORD_DIR = os.path.expanduser("~/Desktop/考試/讀書紀錄")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=datetime.date.today().isoformat(),
                    help="讀書紀錄日期（預設今天）")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    recs = sorted(glob.glob(os.path.join(RECORD_DIR, f"{a.date}*讀書紀錄.md")))
    if not recs:
        sys.exit(f"找不到 {a.date} 的讀書紀錄——先寫完紀錄再跑")
    text = open(recs[0]).read()
    m = re.search(r"^## 明日建議\s*$(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not m:
        sys.exit(f"{os.path.basename(recs[0])} 沒有「## 明日建議」段落——補上再跑（session.py audit 會擋這個）")
    items = []
    for ln in m.group(1).strip().splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#"):          # 跳過子標題
            continue
        x = re.sub(r"^[-*\d.、\s]+", "", ln).strip().strip("`")
        if not x or re.fullmatch(r"[^：:]{1,6}[：:]", x):   # 跳過「民法：」類分類行
            continue
        items.append(x)
    if not items:
        sys.exit("明日建議段落是空的，沒東西可同步")

    target = (datetime.date.fromisoformat(a.date) + datetime.timedelta(days=1)).isoformat()
    print(f"→ {target} 進度（{len(items)} 項）：")
    for x in items:
        print(f"   - {x}")
    if a.dry_run:
        print("（--dry-run：未寫入）")
        return

    try:
        prog = json.load(open(PROGRESS))
    except Exception:
        prog = {}
    old = prog.get(target)
    if isinstance(old, dict) and old.get("items") == items:
        print("內容與網站現況相同，不需更新")
        return
    # 保留同日已勾選的舊項目狀態
    done = [False] * len(items)
    if isinstance(old, dict):
        for i, it in enumerate(items):
            if it in old.get("items", []):
                done[i] = old["done"][old["items"].index(it)]
    prog[target] = {"items": items, "done": done}
    json.dump(prog, open(PROGRESS, "w"), ensure_ascii=False, indent=1)

    subprocess.run(["git", "-C", ROOT, "add", "data/progress.json"], check=True)
    subprocess.run(["git", "-C", ROOT, "commit", "-q", "-m", f"進度同步：{target}（{len(items)} 項）"], check=True)
    subprocess.run(["git", "-C", ROOT, "push", "-q"], check=True)
    print(f"✓ 已 push，網站明天首頁就是這份清單")


if __name__ == "__main__":
    main()
