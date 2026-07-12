#!/usr/bin/env python3
"""作文素材入庫：每日素材（AI 生成後）與短段批改結果，直接上網站。

用法：
  新增當日素材：
    add_essay.py --theme 主題 --text 短文 --sentence 好句 --example 好例子 --words 替換詞
  補使用者短段與批改重點（同日重跑即更新）：
    add_essay.py --para 使用者短段 --note 批改重點
  皆可加 --date YYYY-MM-DD（預設今天）、--no-push

資料存 data/essay.json（依日期一天一筆），筆記分頁「✍️ 作文素材」顯示。
給 AI 的慣例：每日啟動生成素材後立即跑本腳本；短段批改完再跑一次補 --para --note。
"""
import argparse, datetime, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESSAY = os.path.join(ROOT, "data", "essay.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    for k in ["theme", "text", "sentence", "example", "words", "idiom", "quote", "para", "note"]:
        ap.add_argument(f"--{k}", default=None)
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args()

    try:
        data = json.load(open(ESSAY))
    except Exception:
        data = []
    entry = next((e for e in data if e["date"] == a.date), None)
    if entry is None:
        if not (a.theme and a.text):
            raise SystemExit(f"{a.date} 尚無素材——新增需要 --theme 與 --text")
        entry = {"date": a.date}
        data.append(entry)
    for k in ["theme", "text", "sentence", "example", "words", "idiom", "quote", "para", "note"]:
        v = getattr(a, k)
        if v is not None:
            entry[k] = v
    data.sort(key=lambda e: e["date"], reverse=True)
    json.dump(data, open(ESSAY, "w"), ensure_ascii=False, indent=1)
    print(f"✓ {a.date}「{entry.get('theme', '')}」已寫入（共 {len(data)} 天素材）")

    if a.no_push:
        print("（--no-push：未 commit）")
        return
    subprocess.run(["git", "-C", ROOT, "add", "data/essay.json"], check=True)
    subprocess.run(["git", "-C", ROOT, "commit", "-q", "-m",
                    f"作文素材：{a.date} {entry.get('theme', '')}"], check=True)
    subprocess.run(["git", "-C", ROOT, "push", "-q"], check=True)
    print("✓ 已 push 上線")


if __name__ == "__main__":
    main()
