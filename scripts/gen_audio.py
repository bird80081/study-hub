#!/usr/bin/env python3
"""補音檔工具——為 vocab.json 中缺音檔的字批次生成發音。

用途：雲端 session 只能併入單字（`pos`/`zh`/`ex`），無法跑 macOS `say`。
回 Mac 後跑本腳本，掃 vocab.json 把缺 audio/{slug}.m4a（或有例句卻缺
{slug}_ex.m4a）的字補齊，沿用與 add_word.py 相同的 Samantha 語音設定。

用法：
  gen_audio.py            # 補齊所有缺音檔的字，接著 commit + push
  gen_audio.py --no-push  # 只改檔不推
  gen_audio.py foo bar    # 只補指定的字

只讀 vocab.json、只寫 audio/ 與 git，不改動任何字的欄位。
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
    ap.add_argument("words", nargs="*", help="只補這些字；省略則補全部缺音檔的字")
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args()

    if sys.platform != "darwin":
        sys.exit("本腳本需 macOS 的 say/afconvert，請在 Mac 上執行。")

    os.makedirs(AUDIO, exist_ok=True)
    vocab = json.load(open(VOCAB))
    want = {w.lower() for w in a.words}

    done = []
    for v in vocab:
        w = v["w"]
        if want and w.lower() not in want:
            continue
        slug = slug_of(w)
        made = False
        word_m4a = os.path.join(AUDIO, f"{slug}.m4a")
        if not os.path.exists(word_m4a):
            gen_audio(w, word_m4a)
            made = True
        ex = v.get("ex", "")
        if ex:
            ex_m4a = os.path.join(AUDIO, f"{slug}_ex.m4a")
            if not os.path.exists(ex_m4a):
                gen_audio(ex, ex_m4a)
                made = True
        if made:
            done.append(w)
            print(f"✓ {w} 音檔已補（{slug}.m4a" + ("＋例句）" if ex else "）"))

    if not done:
        print("沒有缺音檔的字，無須補跑。")
        return

    subprocess.run(["git", "-C", ROOT, "add", "audio"], check=True)
    subprocess.run(["git", "-C", ROOT, "commit", "-m",
                    "audio: 補跑 " + "、".join(done) + " 音檔"], check=True)
    if not a.no_push:
        subprocess.run(["git", "-C", ROOT, "push"], check=True)


if __name__ == "__main__":
    main()
