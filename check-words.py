#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""词库体检 —— 改完 words-a1.js 跑一遍：python3 check-words.py

查七件事（全是踩过的坑）：
  1. 五个字段齐不齐
  2. 英文有没有重复（WMAP 按英文做键，重了会被静默覆盖）
  3. 同一难度里中文释义有没有重复（选择题干扰项同难度挑，重了会「两个选项都对」）
  4. 类别在不在 CAT_CN 里
  5. 词性是不是 n / v / adj / adv / num 这五种
  6. 每个难度的每个类别、每个词性够不够 6 个（普通怪按类别出题，Boss 弱点按词性挑）
  7. 英文有没有超过 11 个字母（拼写题的字格只量到 11）

这个文件**不上线** —— .github/workflows/deploy.yml 里的 cp 列表没有它。
"""
import re, sys, collections

POS_OK = ("n", "v", "adj", "adv", "num")
MAX_LEN = 11
MIN_PER_BUCKET = 6

src = open("words-a1.js", encoding="utf-8", newline="").read()
if "\r\n" not in src:
    print("⚠️  words-a1.js 不是 CRLF 换行了 —— 这个仓库里只有它是 CRLF，别改成 LF")

cats = set(re.findall(r"(\w+):\"[^\"]+\"", src.split("var CAT_CN = {", 1)[1].split("};", 1)[0]))
body = src.split("var WORDS = [", 1)[1].split("\n];", 1)[0]
rows = re.findall(r'\["([^"]*)","([^"]*)","([^"]*)",(\d+),"([^"]*)"\]', body)

err = []
# 1. 字段齐不齐：条目数对不对得上「[ 开头的行内片段」数
if len(rows) != body.count('["'):
    err.append("有条目不是「五个字段」的标准格式（写全 [英文,中文,类别,难度,词性]）")

seen, cn_seen = {}, {}
for en, cn, cat, lv, pos in rows:
    lv = int(lv)
    if en in seen:
        err.append("英文重复：%s（%s / %s）" % (en, seen[en], (cn, cat, lv)))
    seen[en] = (cn, cat, lv)
    if (lv, cn) in cn_seen:
        err.append("同级释义重复：难度%d 「%s」 = %s / %s" % (lv, cn, cn_seen[(lv, cn)], en))
    cn_seen[(lv, cn)] = en
    if cat not in cats:
        err.append("类别不在 CAT_CN 里：%s → %s" % (en, cat))
    if pos not in POS_OK:
        err.append("词性不合法：%s → %s（只能是 %s）" % (en, pos, "/".join(POS_OK)))
    if len(en) > MAX_LEN:
        err.append("超过 %d 个字母：%s（%d）" % (MAX_LEN, en, len(en)))

bycat = collections.Counter((int(r[3]), r[2]) for r in rows)
bypos = collections.Counter((int(r[3]), r[4]) for r in rows)
bylv = collections.Counter(int(r[3]) for r in rows)
for lv in sorted(bylv):
    for c in sorted(cats):
        if bycat[(lv, c)] < MIN_PER_BUCKET:
            err.append("难度%d 的类别 %s 只有 %d 个（要 ≥%d）" % (lv, c, bycat[(lv, c)], MIN_PER_BUCKET))
    for p in POS_OK:
        if bypos[(lv, p)] < MIN_PER_BUCKET:
            err.append("难度%d 的词性 %s 只有 %d 个（要 ≥%d）" % (lv, p, bypos[(lv, p)], MIN_PER_BUCKET))

if err:
    print("\n".join(err))
    print("—— 共 %d 条问题" % len(err))
    sys.exit(1)

print("✅ 体检通过：共 %d 词（%s）" % (len(rows), " / ".join("难度%d %d" % (lv, bylv[lv]) for lv in sorted(bylv))))
for lv in sorted(bylv):
    print("  难度%d 类别：%s" % (lv, "  ".join("%s %d" % (c, bycat[(lv, c)]) for c in sorted(cats))))
    print("        词性：%s" % "  ".join("%s %d" % (p, bypos[(lv, p)]) for p in POS_OK))
