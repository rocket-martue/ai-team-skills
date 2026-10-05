# レビュー：adversary

<!-- 回ごとに下に追記する。過去の回は消さない -->

このタスクはガネーシャが実装し、ガネーシャが記録する（plan.md「背景・前提」）。

## 第1回（2026-10-05）

- 対象：`chore/4-adversary`（最新コミット：`a4c43b0` ／ 未コミットの改訂あり）
- 判定：OK
- 出所：diff-reviewer（ガネーシャ自身。完了条件と、フローチャートの分かれ目の突き合わせ）
- 数：このタスクにメジェドの修正依頼は無い

### フローチャートの分かれ目とスキルの文の突き合わせ

README「作業の流れ」のフローチャート（正本）の分かれ目ごとに、対応する文を指す。行番号はこの回の時点のもの。

| 分かれ目（ノード） | 内容 | 対応する文 |
| --- | --- | --- |
| A1・V1 | 承認前の adversary。2回目は1回目の指摘で本文を直したときだけ | `claude/skills/plan-writer/SKILL.md:18`（手順6）、`:21`（改訂のときも呼ぶ）、`:32`（最大2回と2回目の条件） |
| U1 →「もう1回」 | まーちゅうに頼まれた分は上限の外 | `claude/skills/plan-writer/SKILL.md:33` |
| V1 の記録 | 結果を承認依頼ごと・回ごとに書く | `claude/skills/plan-writer/SKILL.md:31`、`claude/skills/plan-writer/templates/plan.md` の「承認前の adversary」 |
| S1 →「停止」→ H | 停止なら保留 | `claude/skills/delegate-to-mejed/SKILL.md:49`、`claude/agents/mejed.md:57`（弱めないと通せないときは停止） |
| R1 →「行が無い」→ RW | 報告ごとに1回だけ、同じメジェドに SendMessage で書き直させる。それでも無ければ保留 | `claude/skills/delegate-to-mejed/SKILL.md:51`、`:92`（上限の表） |
| R1 →「なし」→ D1 | そのまま diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:52` |
| R1 →「あり」→ A2 | repeated-failure の adversary を呼んでから diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:53`、`:61`・`:64`（渡すもの）、`claude/agents/adversary.md:32`（問い） |
| R1 の粒度 | チェックコマンドの箇条1つが1回の作業の中で2回以上失敗 | `claude/skills/delegate-to-mejed/SKILL.md:55`、`claude/agents/mejed.md:50` |
| D1 →「計画に効く指摘」→ H | 保留 | `claude/skills/delegate-to-mejed/SKILL.md:29`、`claude/skills/diff-reviewer/SKILL.md:48` |
| D1 →「要修正」→ L1 | 修正依頼は合算で3回未満なら直させる。3回なら保留 | `claude/skills/delegate-to-mejed/SKILL.md:30`、`:93`、`claude/skills/diff-reviewer/SKILL.md:49` |
| C1 | 1巡目がまだ／前の巡で中身の指摘を直し2巡目がまだ／それ以外 | `claude/skills/delegate-to-mejed/SKILL.md:73`・`:74`・`:75` |
| X | adversary（pre-pr）と `/code-review high` を並べる | `claude/skills/delegate-to-mejed/SKILL.md:79`・`:80` |
| W | 採る指摘が無くても review.md に回を書く（出所・数・見送り） | `claude/skills/delegate-to-mejed/SKILL.md:81`、`claude/skills/diff-reviewer/SKILL.md:56`・`:58`、`claude/skills/diff-reviewer/templates/review.md`（出所・数・見送った指摘） |
| V3 | なし→報告／計画に効く→保留／2巡目の必須→保留／それ以外→L1 | `claude/skills/delegate-to-mejed/SKILL.md:83`〜`:86` |
| U2 | 「いいえ」なら指示を待つ | `claude/skills/delegate-to-mejed/SKILL.md:36` |
| H の後 | 保留の後はまーちゅうの指示で決める。承認をやり直したら上限を数え直す | `claude/skills/delegate-to-mejed/SKILL.md:43` |
| PR に付いたレビュー | PR レビューの回だけを数えて3回目で保留。メジェドに直させたら報告を同じく見る | `claude/skills/diff-reviewer/SKILL.md:49`・`:69` |

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| adversary.md（`model: fable`・tools に Edit / Write が無い・中身） | ○ | 差分の取り方を `git status --short` にそろえ、禁止事項に作業ツリーを変える git コマンドを足した |
| README の「流れ」「言葉の決まり」「回数の上限」と、スキルの文の一致 | ○ | 上の突き合わせの表 |
| delegate-to-mejed（停止・書き直し・PR の前の確認・保留の後） | ○ | |
| plan-writer（最大2回・上限の外）と templates/plan.md の節 | ○ | |
| diff-reviewer（出所・計画に効く指摘・PR レビューの数え方・報告の見方） | ○ | |
| mejed.md（報告の行・粒度・禁止事項の範囲） | ○ | |
| review.md のテンプレート（出所・数・見送った指摘） | ○ | |
| README・common-rules.md・Ganesha.md の adversary と、編集できる範囲の説明 | ○ | README の「adversary も .md はフックで止まらない」という誤りを、「Edit / Write を持たず、書ける経路は Bash だけ」に直した |
| この突き合わせの表 | ○ | |
| #1 へのコメント | ○ | 6〜10番として5つを足した（#1 の issuecomment-5990751777） |

### 指摘

なし

### 見送った指摘（あれば）

-

### 計画への指摘（あれば）

-
