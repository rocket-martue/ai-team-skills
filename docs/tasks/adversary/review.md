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

## 第4回（2026-10-05・PR の前の確認）

- 対象：`chore/4-adversary`（最新コミット：`d3ccbc5`。`origin/main...HEAD` の3コミット・未コミットなし）
- 判定：要修正
- 出所：adversary・pre-pr・1巡目 ／ /code-review・high・1巡目
- 数：PR の前の確認 1巡目（承認依頼2で数え直した）。このタスクにメジェドの修正依頼は無い
- 訂正：第3回に「次は2巡目を回す」と書いたのは誤り。承認依頼2で承認をやり直したので、上限は数え直しになり、この回は1巡目（adversary の指摘で分かった）

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応 | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/skills/diff-reviewer/SKILL.md:22` | 手順5が「次の手は手順6」と決め打ちなので、PR の前の確認の指摘を受けた回も手順6（修正依頼）に流れ、V3 の「2巡目で必須なら直さずに保留」を通らない（/code-review） | PR の前の確認から来た回は、delegate-to-mejed の「PR の前の確認」の4に返す、と分ける | 第5回で直した（ガネーシャ） | 解決 |
| 2 | 必須 | `claude/agents/adversary.md:23` | `??` の新規ファイルを読むと、まだコミットしていない `docs/tasks/<タスク名>/review.md`（ガネーシャの判定・採否）も読む。「結論や見立ては受け取らない」に反する（/code-review） | `??` の新規ファイルのうち `docs/tasks/<タスク名>/review.md` は読まない | 第5回で直した（ガネーシャ） | 解決 |
| 3 | 必須 | `claude/skills/plan-writer/templates/plan.md` の「確認事項」 | 空の `-` は「なし」でも「→ 付き」でもないので、確認事項の無い計画が Q1 で保留になる（adversary・/code-review） | テンプレートの既定を「- なし」にし、plan-writer に「不明点が無ければ『なし』と書く」を足す | 第5回で直した（ガネーシャ） | 解決 |
| 4 | 必須 | `repo-files/docs/team/workflow.md`（V1・言葉の決まり） | V1 の「plan.md の本文」が定義されていない。承認前の記録を書き込むだけでも本文が変わったと読める（adversary） | 言葉の決まりに「本文」＝「承認前の adversary」「改訂履歴」「確認事項」以外の節、を足す | 第5回で直した（ガネーシャ） | 解決 |
| 5 | 必須 | `repo-files/docs/team/workflow.md`（確認事項の未解決） | Q1 で保留した後、まーちゅうの答えを誰がどう書くか決まっていない。ガネーシャが「→ 案：」と書けば、答えていないのに通る（/code-review） | 「まーちゅうの答えをガネーシャが『→』で書き足すのは改訂に当たらない（確認事項は本文に入らない）。ガネーシャ自身の案を『→』で書かない」を足す | 第5回で直した（ガネーシャ） | 解決 |
| 6 | 推奨 | `claude/agents/mejed.md:34` | 手順5（計画どおりでは実装できない）だけ、報告の形式で「結果：停止」と書く形になっていない。「指摘を修正するとき」にも計画を変えないと直せないときの停止が無い（adversary・/code-review） | 両方とも「報告の形式で『結果：停止（理由）』と報告して終わる」にする | 第5回で直した（ガネーシャ） | 解決 |
| 7 | 推奨 | `claude/skills/delegate-to-mejed/SKILL.md:89` 以下 | 回数の上限の表が workflow.md の写しで、すでにずれている（2巡目の条件・`--max-findings`・PR レビューの行が無い）。手順1の確認事項の基準も言い換えて写している（/code-review） | 表を消して「workflow.md の『回数の上限』に従う」の1文にする。手順1・mejed.md の手順2も、基準は workflow.md を指すだけにする | 第5回で直した（ガネーシャ） | 解決 |
| 8 | 推奨 | `claude/agents/adversary.md:14` | adversary の「最初に必ず読むこと」に workflow.md が無い。「2回以上落ちたチェック」や「中身の指摘」の定義が届かない（/code-review） | 「最初に必ず読むこと」に workflow.md を足す。README のファイルの分け方も「スキル・メジェド・adversary が読む」にそろえる | 第5回で直した（ガネーシャ） | 解決 |
| 9 | 推奨 | `repo-files/docs/team/Ganesha.md:17` ほか | 「チェックが2回落ちたとき」と書いていて、正本の「2回以上」とずれる（/code-review） | Ganesha.md・common-rules.md・README・adversary.md の description を「2回以上」にそろえる | 第5回で直した（ガネーシャ） | 解決 |
| 10 | 推奨 | `README.md:89` | 要約の「修正依頼は由来を問わず合算で最大3回」から「PR の前まで」が落ち、PR に付いたレビューの別枠が読めない（adversary） | 「PR の前までは合算で最大3回。PR に付いたレビューは別に最大3回」にする | 第5回で直した（ガネーシャ） | 解決 |
| 11 | 推奨 | `claude/skills/diff-reviewer/templates/review.md:8` | 判定の選択肢が「OK ／ 要修正」だけで、「保留」が無い（adversary） | 「OK ／ 要修正 ／ 保留」にする | 第5回で直した（ガネーシャ） | 解決 |
| 12 | 推奨 | `claude/skills/diff-reviewer/SKILL.md:16` | PR に付いたレビューでメジェドに直させた後（未コミット）の差分の取り方が決まっていない（/code-review） | 手順2に「PR に付いたレビューの修正の後も、コミット前の取り方」を足す | 第5回で直した（ガネーシャ） | 解決 |

### 見送った指摘（あれば）

- 改訂履歴と確認事項からも、ガネーシャの採否の判断が adversary に伝わる（/code-review）→ 改訂履歴は要る。2回目は「1回目の直しが正しいか」を見る回でもあるので、限界として承知する
- 保留して承認をやり直した後に delegate-to-mejed を頭から回すと、手順2（main にいる・未コミットの変更が無い）とぶつかる（adversary）→ 保留の後の進め方はまーちゅうの指示で決める、と計画でわざと外した部分（plan.md の改訂履歴・3回目）

### 計画への指摘（あれば）

- なし（#5 は「確認事項は本文に入らない」の定義から出る決まりなので、計画の範囲として扱った。まーちゅう確認済み）

## 第5回（2026-10-05・第4回の指摘を直した後）

- 対象：`chore/4-adversary`（最新コミット：`d3ccbc5` ／ 未コミットの直しあり）
- 判定：OK
- 出所：diff-reviewer（ガネーシャ自身。第4回の指摘の解決と、突き合わせの表の更新）
- 数：PR の前の確認は1巡目が済んだ（承認依頼2で数え直した後）。1巡目で中身の指摘を直したので、次は2巡目を回す

### 第4回の指摘の解決

| # | 対応 | 再レビュー |
| --- | --- | --- |
| 1 | diff-reviewer の手順5を、ふつうの回は手順6、PR の前の確認の指摘を受けた回は「PR の前の確認」の4、と分けた | 解決 |
| 2 | adversary は `??` の新規ファイルのうち `docs/tasks/<タスク名>/review.md` を読まない | 解決 |
| 3 | テンプレートの確認事項の既定を「- なし」にし、plan-writer の手順5に「不明点が無ければ『なし』と書く」「答えは『→』で書き足す」を足した | 解決 |
| 4 | workflow.md の言葉の決まりに「本文」の定義を足した | 解決 |
| 5 | workflow.md に「まーちゅうの答えをガネーシャが『→』で書き足すのは改訂に当たらない」「自分の案を『→』で書かない」を足した | 解決 |
| 6 | mejed.md の手順5と「指摘を修正するとき」の4を、報告の形式で「結果：停止（理由）」にした | 解決 |
| 7 | delegate-to-mejed の上限の表を消して「workflow.md の『回数の上限』に従う」の1文にした。手順1と mejed.md の手順2の基準の言い換えも、workflow.md を指すだけにした | 解決 |
| 8 | adversary の「最初に必ず読むこと」に workflow.md を足し、README も「スキル・メジェド・adversary が読む」にそろえた | 解決 |
| 9 | Ganesha.md・common-rules.md・README・adversary.md を「2回以上落ちたとき」にそろえた（`grep` で「2回落ちた」の残りは0件） | 解決 |
| 10 | README の要約を「PR の前までは合算で最大3回。PR に付いたレビューは別に最大3回」にし、「承認をやり直したら数え直す」も足した | 解決 |
| 11 | review.md のテンプレートの判定を「OK ／ 要修正 ／ 保留」にした | 解決 |
| 12 | diff-reviewer の手順2のコミット前の取り方に「PR に付いたレビューの修正をメジェドがした後」を足した | 解決 |

### フローチャートの分かれ目とスキルの文の突き合わせ（第3回の表を置き換える）

正本は `repo-files/docs/team/workflow.md`。行番号はこの回の時点のもの。

| 分かれ目（ノード） | 内容 | 対応する文 |
| --- | --- | --- |
| （全体） | スキル・メジェド・adversary が最初に workflow.md を読む | `claude/skills/plan-writer/SKILL.md:10`、`claude/skills/delegate-to-mejed/SKILL.md:10`、`claude/skills/diff-reviewer/SKILL.md:10`、`claude/agents/mejed.md:16`、`claude/agents/adversary.md:15` |
| A1・V1 | 承認前の adversary。2回目は1回目の指摘で本文を直したときだけ | `claude/skills/plan-writer/SKILL.md:22`・`:33`（本文の定義は workflow.md の言葉の決まり） |
| U1 →「もう1回」 | まーちゅうに頼まれた分は上限の外 | `claude/skills/plan-writer/SKILL.md:34` |
| Q1 | 承認の後、確認事項に未解決が残っていれば保留 | `claude/skills/delegate-to-mejed/SKILL.md:15`、`claude/agents/mejed.md:31`、`claude/skills/plan-writer/SKILL.md:18`（「なし」と書く・答えは「→」） |
| S1 →「停止」→ H | 停止なら保留（理由を添える） | `claude/skills/delegate-to-mejed/SKILL.md:50`・`:44`、`claude/agents/mejed.md:30`・`:31`・`:34`・`:43`・`:59` |
| R1 →「行が無い」→ RW | 報告ごとに1回だけ、同じメジェドに SendMessage で書き直させる。それでも無ければ保留 | `claude/skills/delegate-to-mejed/SKILL.md:52` |
| R1 →「なし」→ D1 | そのまま diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:53` |
| R1 →「あり」→ A2 | repeated-failure の adversary を呼んでから diff-reviewer へ | `claude/skills/delegate-to-mejed/SKILL.md:54`、`claude/agents/adversary.md:33` |
| R1 の粒度 | チェックコマンドの箇条1つが1回の作業の中で2回以上失敗 | `claude/skills/delegate-to-mejed/SKILL.md:56`、`claude/agents/mejed.md:52` |
| D1 →「計画に効く指摘」→ H | 保留 | `claude/skills/delegate-to-mejed/SKILL.md:30`、`claude/skills/diff-reviewer/SKILL.md:49` |
| D1 →「要修正」→ L1 | 修正依頼は合算で3回未満なら直させる。3回なら保留 | `claude/skills/delegate-to-mejed/SKILL.md:31`・`:91`、`claude/skills/diff-reviewer/SKILL.md:50` |
| D1 の後 | diff-reviewer は delegate-to-mejed の途中なら止まらずに続ける。PR の前の確認の回は V3 に返す | `claude/skills/diff-reviewer/SKILL.md:22` |
| C1 | 1巡目がまだ／前の巡で中身の指摘を直し2巡目がまだ／それ以外 | `claude/skills/delegate-to-mejed/SKILL.md:74`・`:75`・`:76` |
| X | adversary（pre-pr）と `/code-review high --max-findings default` を並べる | `claude/skills/delegate-to-mejed/SKILL.md:80`・`:81` |
| W | 採る指摘が無くても review.md に回を書く（出所・数・見送り） | `claude/skills/delegate-to-mejed/SKILL.md:82`、`claude/skills/diff-reviewer/SKILL.md:57`・`:58`・`:59` |
| V3 | なし→報告／計画に効く→保留／2巡目の必須→保留／それ以外→L1 | `claude/skills/delegate-to-mejed/SKILL.md:84`〜`:87` |
| U2 | 「いいえ」なら指示を待つ | `claude/skills/delegate-to-mejed/SKILL.md:37` |
| 回数の上限 | workflow.md の表に従う（スキルには写さない） | `claude/skills/delegate-to-mejed/SKILL.md:91` |
| PR に付いたレビュー | 修正依頼は最大3回。メジェドに直させたら delegate-to-mejed の手順どおりに報告を見る。差分はコミット前の取り方 | `claude/skills/diff-reviewer/SKILL.md:50`・`:70`・`:16` |

### 指摘

なし

## 第6回（2026-10-05・PR の前の確認）

- 対象：`chore/4-adversary`（最新コミット：`c509cb3`。`origin/main...HEAD` の4コミット・未コミットなし）
- 判定：保留（計画に効く指摘がある。2巡目でもある）
- 出所：adversary・pre-pr・2巡目 ／ /code-review・high・2巡目
- 数：PR の前の確認 2巡目（承認依頼2で数え直した後）。上限に達した
- 補足：1回目の実行は使用量の上限で途中で止まり、上限が戻ってから同じ依頼で回し直した

### 指摘（直さずに保留。採るかどうかと直し方は、まーちゅうの判断の後に決める）

| # | 重要度 | ファイル:行 | 問題と理由 | 出所 |
| --- | --- | --- | --- | --- |
| 1 | 必須（計画に効く） | `repo-files/docs/team/workflow.md:56`〜`:57` | 「→」で答えが書かれれば解決で、書き足しは改訂に当たらない。答えが計画を変えるもの（例「A か B か」→「B で」）でも P1 に戻らないので、メジェドは本文どおり A を作り、答えが実装されない | /code-review |
| 2 | 必須 | `claude/skills/plan-writer/SKILL.md:22` | 改訂を頼まれたら必ず承認欄を外して adversary を回し直す、のまま。workflow.md の「承認をやり直すのは本文が変わったときだけ」「確認事項の答えの書き足しは改訂に当たらない」と食い違う。外すと上限も数え直しになる | /code-review |
| 3 | 推奨 | `claude/agents/adversary.md:24` | review.md を読まない規則が `??` の文の中にあるので、review.md がコミット済み（PR レビューの段など）だと `git diff HEAD` 経由でガネーシャの判定と採否が渡る | adversary・/code-review |
| 4 | 推奨 | `repo-files/docs/team/workflow.md:56` | 未解決の基準が字面だけで、「- なし（注記）」は未解決扱い、「→ 後で決める」や質問文の中の「→」は解決扱いになる。hub には子の箇条で「**→ 決定：案A**」と書く例もある | adversary |
| 5 | 推奨 | `claude/skills/delegate-to-mejed/SKILL.md:31`・`:87`、`claude/skills/diff-reviewer/SKILL.md:50`、`claude/skills/plan-writer/SKILL.md:33`、README | 「上限は写さない」と書いたのに、数字（3回・2回・2巡）や定義（停止・保留・中身の指摘・2回以上落ちたチェック）がスキルに写っている | adversary・/code-review |
| 6 | 推奨 | `repo-files/docs/team/workflow.md:54`、`claude/skills/delegate-to-mejed/SKILL.md:50` | 停止の理由の一覧に、mejed.md の「計画どおりでは直せない」が無い | /code-review |
| 7 | 推奨 | `README.md:77` | 「チェックが2回落ちていたら」が残っている（第4回 #9 の grep の語が「2回落ちた」で、当たらなかった） | /code-review |
| 8 | 推奨 | 各スキルと mejed.md・adversary.md の「最初に workflow.md を読む」 | workflow.md が無いとき（`claude/` だけ反映して `repo-files/` を置いていない、今の4リポジトリの状態）の振る舞いが決まっていない | adversary |
| 9 | 推奨 | `claude/skills/diff-reviewer/templates/review.md:10` | 「数」に、どの承認依頼の数かを書く欄が無い。数え直しの後に読み違える（この review.md の第3回の誤りが実例） | /code-review |
| 10 | 推奨 | `repo-files/docs/team/workflow.md:59` | 「本文」の定義で、計画書の冒頭（作成・承認・ブランチ・改訂履歴の箇条）がどちらに入るか決まっていない | /code-review |
| 11 | 推奨 | `claude/skills/delegate-to-mejed/SKILL.md:87` | V3 の「上以外であり」は、採った指摘が推奨だけでも修正依頼に回り、上限を1回使う。C1 の「中身の指摘を直した」も、推奨を見送られたときに決まらない | /code-review |
| 12 | 推奨 | `repo-files/docs/team/workflow.md:4` | 「この分かれ目に合わせて書いている文書」の一覧に adversary.md が無い | /code-review |
| 13 | 推奨（推測） | `claude/agents/adversary.md:24` | 未追跡のディレクトリは `git status --short` で1行に畳まれ、「`??` のファイルを読む」がファイル単位にならない | adversary |

### 見送った指摘（あれば）

- `git status --short` が allow の完全一致に当たらない（adversary）→ #1 の4と同じ件

### 計画への指摘（あれば）

- **計画に効く指摘（保留）**：#1。確認事項の答えが計画を変えるときの扱い（承認依頼2でまーちゅうが決めた「確認事項は本文に入らない・答えの書き足しは改訂に当たらない」の範囲を、答えの中身で分ける必要がある）

## 第7回（2026-10-05・保留の後、まーちゅうの判断で直した）

- 対象：`chore/4-adversary`（最新コミット：`c509cb3` ／ 未コミットの直しあり）
- 判定：OK（まーちゅうの判断により、PR の前の確認の3巡目は回さない）
- 出所：diff-reviewer（ガネーシャ自身）
- 数：PR の前の確認は2巡で上限。第6回の指摘のうち5件を直し、8件はイシューに回した
- まーちゅうの判断（2026-10-05）：第6回 #1 は「答えが本文の変更を要するなら本文を直す改訂として承認をやり直す」。進め方は「はっきり壊れている・食い違っている5件だけ直し、3巡目を回さずに PR を出す。残りはイシューへ」。workflow.md の「2巡目で必須が出たら直さずに保留」を超えることも了承済み（plan.md「決めたこと」）

### 第6回の指摘の扱い

| # | 扱い | 対応 |
| --- | --- | --- |
| 1 | 直した | workflow.md の確認事項の未解決に、答えが本文の変更を要するなら改訂として承認をやり直す、を足した |
| 2 | 直した | plan-writer の改訂の段落を、本文を直したときだけ承認欄を外す、確認事項の答えの書き足しは改訂に当たらない（本文を変える答えは改訂）、にした |
| 3 | 直した | adversary.md・delegate-to-mejed の差分の取り方で review.md を外す（`git diff HEAD -- . ":(exclude)docs/tasks/<タスク名>/review.md"`。この作業ツリーで、review.md の変更が除かれることを確かめた） |
| 6 | 直した | workflow.md の停止の理由に「計画どおりでは直せない」を足し、delegate-to-mejed の一覧の写しは workflow.md を指すだけにした |
| 7 | 直した | README の「チェックが2回落ちていたら」を「2回以上」にした（「2回落」で広く grep して、残りは0件） |
| 4・5・8〜13 | イシューへ | 確認事項の基準の境界／数字と定義の写し／workflow.md が無いときの振る舞い／「数」に承認依頼の番号／本文の定義と冒頭の箇条／推奨だけの指摘の扱い／workflow.md の一覧に adversary.md／未追跡のディレクトリ |

### 指摘

なし
