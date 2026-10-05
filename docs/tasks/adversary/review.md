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

## 第2回（2026-10-05・PR の前の確認）

- 対象：`chore/4-adversary`（最新コミット：`5f3c11c`。`origin/main...HEAD` の2コミット・未コミットなし）
- 判定：保留（計画に効く指摘がある）
- 出所：adversary・pre-pr・1巡目 ／ /code-review・high・1巡目
- 数：PR の前の確認 1巡目（このタスクにメジェドの修正依頼は無い）
- 補足：このセッションは別のリポジトリをプロジェクトにして開いているので、`/code-review` を引数なしで呼ぶと別のリポジトリの差分を見る。今回だけ対象の作業ツリーとブランチを文章で指定した（worktree のときのツリーの扱いは #1 の8）。adversary は定義どおりのエージェントではなく、汎用のエージェントに Fable を指定して定義を読ませた

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応 | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `README.md:141-143` | 「使い方」の番号リストの途中に「作業の流れ」を差し込んだので、3〜5（PR・PR のレビュー・マージ）が「回数の上限」の節の下に沈む（adversary・/code-review） | 「作業の流れ」を「使い方」の 5 の後ろへ移す | 第3回で直した（ガネーシャ） | 解決 |
| 2 | 必須 | `README.md:87`（V1 の戻り辺） | 「1回目の指摘で本文を直した」は2回目の後も真のままなので、図を字義どおりに追うと3回目に戻る。2回目の結果を直す・確認事項に移す節点も無い（adversary・/code-review） | 戻り辺に「2回目がまだ」の条件を足し、「上以外」に「2回目の結果は直すか確認事項に移してから」を書く | 第3回で直した（ガネーシャ） | 解決 |
| 3 | 必須 | `claude/skills/diff-reviewer/SKILL.md:69` | PR レビューの修正の報告の見方を要約したときに、「行が無い → 書き直させる → それでも無ければ保留」が落ち、「なし以外は adversary」だけになった（/code-review） | 要約せず「delegate-to-mejed の『メジェドの報告の受け方』の手順どおりに見る」とだけ書く | 第3回で直した（ガネーシャ） | 解決 |
| 4 | 必須 | `claude/skills/diff-reviewer/SKILL.md:21` | 手順5「判定を出して、まーちゅうに結果を伝えて止まる」が、フローチャートの D1 → C1・L1（止まらずに続く）と食い違う（/code-review） | delegate-to-mejed の途中なら判定を返して続ける。単独で頼まれたときだけ伝えて止まる | 第3回で直した（ガネーシャ） | 解決 |
| 5 | 推奨 | `claude/skills/plan-writer/SKILL.md:31` | 承認前の記録（採った・見送った理由）を plan.md に書くので、次に plan.md を読む adversary にガネーシャの判断が渡る。「結論や見立ては渡さない」に反する（/code-review） | adversary.md に「plan.md の『承認前の adversary』の節は読まない」を足す | 第3回で直した（ガネーシャ） | 解決 |
| 6 | 推奨 | `claude/agents/adversary.md:23` | 差分の取り方が `git diff HEAD` と `git status --short` だけで、未追跡の新規ファイルの中身を読む指示が無い。`/code-review` が新規ファイルを見るかも確かめていない（/code-review） | 「`git status --short` の `??` のファイルは Read で中身を読む」を足す | 第3回で直した（ガネーシャ） | 解決 |
| 7 | 推奨 | `claude/skills/delegate-to-mejed/SKILL.md:80` | `/code-review` は `--max-findings` も前の値を引き継ぐ（公式ドキュメント code-review）のに、レベルだけを渡している（/code-review） | 引数を `high --max-findings default` にする（README・上限の表も） | 第3回で直した（ガネーシャ） | 解決 |
| 8 | 推奨 | `claude/skills/diff-reviewer/SKILL.md:49` | PR レビューの上限「3回目でも必須が残れば保留」は修正依頼2回で、PR の前（3回）と数え方がそろっていない。README の「repeated-failure は多くて4回」も PR レビューの段を含まない（/code-review） | PR レビューも「修正依頼は最大3回」にそろえ、「多くて4回」は PR の前までと書く | 第3回で直した（ガネーシャ） | 解決 |
| 9 | 推奨 | `claude/skills/delegate-to-mejed/SKILL.md:49` | 「停止なら理由を伝えて止まる」が「保留する」だけになり、停止の理由を伝えることが落ちた（/code-review） | 保留の定義に「理由（メジェドの停止の理由・達した上限・該当する指摘）を添える」を足す | 第3回で直した（ガネーシャ） | 解決 |
| 10 | 推奨 | `claude/agents/mejed.md:29-30` | 未承認・確認事項ありのときは「報告の形式」を通らずに終わる書き方で、「結果：停止」の行が求められていない（adversary） | 「結果：停止として報告して終わる」にする | 第3回で直した（ガネーシャ） | 解決 |
| 11 | 推奨 | この review.md の第1回 | 対象が「a4c43b0 ／ 未コミットの改訂あり」のままで、見た木が辿れない（adversary） | 第1回は記録として残し、第2回の対象に正しいコミットを書いた（この回） | 第2回で対応 | 解決 |

### 見送った指摘（あれば）

- `git status --short` が settings.json の allow（完全一致の `Bash(git status)`）に当たらない（adversary）→ #1 の4（`git status` の完全一致）と同じ件。#1 で扱う

### 計画への指摘（あれば）

- **計画に効く指摘（保留）**：README は反映先のリポジトリに配られない（配るのは `claude/` と `repo-files/`）。計画は「マージ後のフローチャートの正本は README」としているが、反映先のガネーシャは正本を開けず、「食い違ったら README に合わせてスキルを直す」も反映先ではできない（adversary）
- **計画に効く指摘（保留）**：plan-writer は2回目の adversary の指摘を「確認事項に移して承認を頼む」ことを認めているが、delegate-to-mejed の手順1は承認欄しか見ない。確認事項が残ったまま承認されると、メジェドが着手せずに停止して1往復むだになる。フローチャートの U1 → M1 にも、確認事項を片付ける節点が無い（/code-review）

## 第3回（2026-10-05・計画の改訂（承認依頼2）に合わせて直した後）

- 対象：`chore/4-adversary`（最新コミット：`5f3c11c` ／ 未コミットの直しあり）
- 判定：OK
- 出所：diff-reviewer（ガネーシャ自身。第2回の指摘の解決と、フローチャートの分かれ目の突き合わせ）
- 数：PR の前の確認は1巡目が済んだ。1巡目で中身の指摘を直したので、次は2巡目を回す（このタスクにメジェドの修正依頼は無い）

### 第2回の指摘の解決

- #1（README の番号リスト）：「作業の流れ」の節を抜いて、「使い方」の 1〜5 の後ろに要約とリンクだけを置いた
- #2（V1 の戻り辺）：「2回目がまだ。まーちゅうに頼まれた回の後は除く」の条件を足した（`repo-files/docs/team/workflow.md`）
- #3（diff-reviewer の報告の見方の要約）：「delegate-to-mejed の『メジェドの報告の受け方』の手順どおりに見る」の1文にした（`claude/skills/diff-reviewer/SKILL.md:70`）
- #4（diff-reviewer の手順5）：delegate-to-mejed の途中なら判定を返して続け、単独のときだけ止まる（`claude/skills/diff-reviewer/SKILL.md:22`）
- #5〜#10：adversary は承認前の記録の節を判断に使わない・`??` の新規ファイルを読む／`/code-review high --max-findings default`／PR レビューの修正依頼も最大3回／保留に理由を添える／メジェドは未承認・確認事項ありでも「結果：停止」で報告
- 計画に効く指摘2件：まーちゅうの判断で計画を改訂した（正本は `docs/team/workflow.md`、承認の後に確認事項を確かめる Q1）

### フローチャートの分かれ目とスキルの文の突き合わせ

正本は `repo-files/docs/team/workflow.md`（反映先では `docs/team/workflow.md`）。行番号はこの回の時点のもの。第1回の表は README を正本にしていたので、この表に置き換える。

| 分かれ目（ノード） | 内容 | 対応する文 |
| --- | --- | --- |
| （全体） | スキルとメジェドが最初に workflow.md を読む | `claude/skills/plan-writer/SKILL.md:10`、`claude/skills/delegate-to-mejed/SKILL.md:10`、`claude/skills/diff-reviewer/SKILL.md:10`、`claude/agents/mejed.md:16` |
| A1・V1 | 承認前の adversary。2回目は1回目の指摘で本文を直したときだけ | `claude/skills/plan-writer/SKILL.md:22`（改訂のときも呼ぶ）、`:33` |
| U1 →「もう1回」 | まーちゅうに頼まれた分は上限の外 | `claude/skills/plan-writer/SKILL.md:34` |
| Q1 | 承認の後、確認事項に未解決が残っていれば保留 | `claude/skills/delegate-to-mejed/SKILL.md:15`、`claude/agents/mejed.md:31`（同じ基準） |
| S1 →「停止」→ H | 停止なら保留（理由を添える） | `claude/skills/delegate-to-mejed/SKILL.md:50`・`:44`、`claude/agents/mejed.md:30`・`:31`・`:58` |
| R1 →「行が無い」→ RW | 報告ごとに1回だけ、同じメジェドに SendMessage で書き直させる。それでも無ければ保留 | `claude/skills/delegate-to-mejed/SKILL.md:52`・`:93` |
| R1 →「なし」→ D1 | そのまま diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:53` |
| R1 →「あり」→ A2 | repeated-failure の adversary を呼んでから diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:54`、`claude/agents/adversary.md:32` |
| R1 の粒度 | チェックコマンドの箇条1つが1回の作業の中で2回以上失敗 | `claude/skills/delegate-to-mejed/SKILL.md:56`、`claude/agents/mejed.md:51` |
| D1 →「計画に効く指摘」→ H | 保留 | `claude/skills/delegate-to-mejed/SKILL.md:30`、`claude/skills/diff-reviewer/SKILL.md:49` |
| D1 →「要修正」→ L1 | 修正依頼は合算で3回未満なら直させる。3回なら保留 | `claude/skills/delegate-to-mejed/SKILL.md:31`・`:94`、`claude/skills/diff-reviewer/SKILL.md:50` |
| D1 の後 | diff-reviewer は delegate-to-mejed の途中なら止まらずに続ける | `claude/skills/diff-reviewer/SKILL.md:22` |
| C1 | 1巡目がまだ／前の巡で中身の指摘を直し2巡目がまだ／それ以外 | `claude/skills/delegate-to-mejed/SKILL.md:74`・`:75`・`:76` |
| X | adversary（pre-pr）と `/code-review high --max-findings default` を並べる | `claude/skills/delegate-to-mejed/SKILL.md:80`・`:81` |
| W | 採る指摘が無くても review.md に回を書く（出所・数・見送り） | `claude/skills/delegate-to-mejed/SKILL.md:82`、`claude/skills/diff-reviewer/SKILL.md:57`・`:59` |
| V3 | なし→報告／計画に効く→保留／2巡目の必須→保留／それ以外→L1 | `claude/skills/delegate-to-mejed/SKILL.md:84`〜`:87` |
| U2 | 「いいえ」なら指示を待つ | `claude/skills/delegate-to-mejed/SKILL.md:37` |
| PR に付いたレビュー | 修正依頼は最大3回。メジェドに直させたら delegate-to-mejed の手順どおりに報告を見る | `claude/skills/diff-reviewer/SKILL.md:50`・`:70` |

### 指摘

なし
