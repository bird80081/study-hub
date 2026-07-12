#!/usr/bin/env python3
"""單字直接入庫工具——一個字從新增到上線一次完成。

用法：
  add_word.py <word> --pos 詞性 --zh 中文解釋 [--ex 英文例句] [--no-push]

做的事：
  1. 寫入 data/vocab.json（重複字直接擋下）
  2. 用 macOS say（Samantha）生成單字與例句音檔，轉成 audio/{slug}.m4a 與 {slug}_ex.m4a
  3. git commit + push（--no-push 只改檔不推）

給 AI 的慣例：使用者說「加單字 X」時，由 AI 補齊詞性、中文、例句後執行本腳本，
一次一字直接進正式庫，不累積待轉批次。
"""
import argparse, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB = os.path.join(ROOT, "data", "vocab.json")
AUDIO = os.path.join(ROOT, "audio")


def slug_of(w):
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-z0-9]+", "_", w.lower()))


def gen_audio(text, out_m4a):
    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
        aiff = f.name
    try:
        subprocess.run(["say", "-v", "Samantha", "-o", aiff, text], check=True)
        subprocess.run(["afconvert", aiff, "-o", out_m4a, "-f", "m4af",
                        "-d", "aac@22050", "-c", "1"], check=True,
                       capture_output=True)
    finally:
        os.unlink(aiff)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("word")
    ap.add_argument("--pos", required=True, help="詞性，如 n. v. adj.")
    ap.add_argument("--zh", required=True, help="中文解釋")
    ap.add_argument("--ex", default="", help="英文例句（強烈建議，缺了測驗不能考挖空）")
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args()

    vocab = json.load(open(VOCAB))
    if any(v["w"].lower() == a.word.lower() for v in vocab):
        sys.exit(f"「{a.word}」已在庫中，不重複加入")

    vocab.append({"w": a.word, "pos": a.pos, "zh": a.zh, "ex": a.ex})
    json.dump(vocab, open(VOCAB, "w"), ensure_ascii=False, indent=1)

    slug = slug_of(a.word)
    gen_audio(a.word, os.path.join(AUDIO, f"{slug}.m4a"))
    if a.ex:
        gen_audio(a.ex, os.path.join(AUDIO, f"{slug}_ex.m4a"))
    print(f"✓ {a.word}（{a.pos} {a.zh}）已入庫，音檔 {slug}.m4a" + ("＋例句" if a.ex else ""))

    if a.no_push:
        print("（--no-push：未 commit，自行檢查後推送）")
        return
    subprocess.run(["git", "-C", ROOT, "add", "data/vocab.json", "audio"], check=True)
    subprocess.run(["git", "-C", ROOT, "commit", "-q", "-m", f"加單字：{a.word}（{a.zh}）"], check=True)
    subprocess.run(["git", "-C", ROOT, "push", "-q"], check=True)
    print(f"✓ 已 push 上線，現有 {len(vocab)} 字")


if __name__ == "__main__":
    main()
