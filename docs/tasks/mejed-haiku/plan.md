# 計画書：mejed-haiku

- 作成：ガネーシャ（2026-10-09）
- 承認：[x] まーちゅう（承認日：2026-10-09。承認の言葉：「承認」）
<!-- 承認欄の埋め方は docs/team/workflow.md の「承認欄」 -->
- ブランチ：`feat/28-mejed-haiku`（リポジトリの外の worktree で作業）
- イシュー：#28。PR には `Closes #28` と書く（コードのタスクでの様子は、そのタスクの review.md の「メジェドのモデル」の行で見る。このイシューには残さない）
- メジェドのモデル：haiku
- 改訂履歴：
  - 2026-10-09 初版
  - 2026-10-09 Fable の指摘とまーちゅうの補足で改訂。モデルは haiku でも必ず明示して渡す、にした（mejed.md が効いていない場・反映直後のセッションがあるため）。モデルを替えると決めるのはまーちゅう・上限は数え直さない、とした。plan-writer の手順7の要点にモデルを足した。#28 にまーちゅうの判断をコメントで残した。review.md の「メジェドのモデル」の行を書く条件を決めた。sonnet の基準を「計画で書き切れない判断が実装に残るとき」に絞った（まーちゅう：コードでも plan.md に中身が書いてあれば Sonnet は要らない）
  - 2026-10-09 健さん1回目の指摘で改訂。review.md の「メジェドのモデル」の行は、その回の直前にメジェドに頼んだときに渡したモデル（直近の1回）を書く、にした（途中でモデルを替えると差分に両方の成果が混ざるため）

## 目的

メジェドの既定のモデルを Haiku にする。判断が重い・広く絡むタスクだけ、計画のときに Sonnet を選べるようにする。速さとコストを良くするため。

## 背景・前提

- メジェドのモデルは `claude/agents/mejed.md:5` の `model: sonnet` で決まっている。ガネーシャがメジェドを呼ぶとき（Agent ツール）に `model` を渡せば、その回だけ別のモデルで動く
- #28 の試し：PR #29（文書のタスク）と PR #32（6ファイルにまたがる文書のタスク）で、メジェドを Haiku で呼んだ。報告の形・計画の範囲・止まる条件を守り、diff-reviewer の指摘は 1件 → 0件だった（#28 のコメント、`docs/tasks/template-backport/review.md`・`docs/tasks/light-change-path/review.md` の第1回）。コードのタスクではまだ試していない
- まーちゅうの判断（2026-10-09。#28 のコメントに記録）：Haiku 5.5 が出たので、コードも Haiku でいける。コードのタスクでも plan.md にある程度の中身まで書いてあるので、Sonnet を呼ぶ必要が無い。既定を Haiku にし、Sonnet は計画で選んだときだけにする。#28 の本文の「案」（欄が無ければ sonnet）から向きを変えた
- メジェドの定義（`.claude/agents/mejed.md`）は、効いていない場がある。このテンプレートのリポジトリには `.claude/` が無く、メジェドはガネーシャが呼び出しで model を指定して呼んでいる。反映先でも `.claude/` はセッションの開始時に読まれるので、反映した直後のセッションでは前の定義で動く（`README.md` の「テンプレートを直した後の反映」の「流れ」）。Agent ツールは model を渡さないと、定義のモデル、定義が無ければ親のモデルで動く。だから、モデルは呼ぶたびに明示して渡す
- plan-writer の手順7で、承認を頼むときに伝える要点は「目的・対象ファイル・決めてほしいこと」（`claude/skills/plan-writer/SKILL.md:23`）
- メジェドを新しく呼ぶ場面は4つ：実装（`claude/skills/delegate-to-mejed/SKILL.md:23`）、diff-reviewer の指摘の修正（同 `:35`）、健さんの PR の前の指摘の修正（同 `:93`）、PR に付いたレビューのコードの修正（`claude/skills/diff-reviewer/SKILL.md:74`）。報告の書き直しは、同じメジェドに続けて頼む（SendMessage。同 `delegate-to-mejed/SKILL.md:78`）ので、モデルは前と同じになる
- workflow.md の「本文」は、plan.md のうち冒頭の箇条（作成・承認・ブランチ・イシュー・改訂履歴）と「承認前の確認」「確認事項」を除いた部分。本文が変わると承認をやり直す（`repo-files/docs/team/workflow.md:74`）
- モデルが書かれている場所：`claude/agents/mejed.md:5`、`repo-files/docs/team/common-rules.md:43`（チーム表）、`README.md:6`・`:25`
- このリポジトリのチェックコマンド（このタスクに限る）：`node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs`（どちらも変えないことの確かめ）

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/agents/mejed.md` | 変更 | 頭の `model: sonnet` を `model: haiku` にする |
| `claude/skills/plan-writer/templates/plan.md` | 変更 | 冒頭の箇条（「ブランチ」の後）に「メジェドのモデル」の欄を足す |
| `claude/skills/plan-writer/SKILL.md` | 変更 | 「書き方の基準」に、メジェドのモデルの選び方を1つ足す。手順7の要点に、メジェドのモデルを足す |
| `claude/skills/delegate-to-mejed/SKILL.md` | 変更 | メジェドを新しく呼ぶときのモデルの渡し方を書く（手順3の後に1つの箇条） |
| `claude/skills/diff-reviewer/SKILL.md` | 変更 | 「PR に付いたレビュー」の手順4のメジェドへの依頼に、モデルの渡し方は delegate-to-mejed に従う、を足す |
| `claude/skills/diff-reviewer/templates/review.md` | 変更 | 回の冒頭の箇条に「メジェドのモデル」の行を足す |
| `repo-files/docs/team/workflow.md` | 変更 | 言葉の決まりの「本文」で除く冒頭の箇条に「メジェドのモデル」を足す |
| `repo-files/docs/team/common-rules.md` | 変更 | チーム表のメジェドを「Haiku（plan.md で Sonnet を選べる）」にする |
| `README.md` | 変更 | `:6`・`:25` のメジェドのモデルの書き方を、common-rules と同じ意味にする |
| `docs/tasks/mejed-haiku/review.md` | 新規 | ガネーシャが書く記録 |

## 変更内容

### 書く中身（言い回しはメジェドに任せる。意味はこのとおり）

- plan.md の雛形：「ブランチ」の箇条の後に「メジェドのモデル：haiku（既定）／sonnet」の欄。選び方は plan-writer の「書き方の基準」を見る、と注記
- plan-writer の「書き方の基準」：メジェドのモデルは既定で haiku（コードのタスクでも、計画に中身が書いてあれば haiku で足りる）。計画で書き切れない判断が実装に残ると見えたときだけ sonnet にする
- plan-writer の手順7：承認を頼むときの要点に、メジェドのモデル（sonnet にしたなら理由も）を足す
- delegate-to-mejed：メジェドを新しく呼ぶとき（実装・diff-reviewer の指摘の修正・健さんの指摘の修正・PR に付いたレビューの修正のどれでも）、plan.md の「メジェドのモデル」の値を、Agent ツールの `model` に**必ず明示して渡す**（haiku でも渡す。欄が無ければ haiku を渡す）。mejed.md の既定に頼らない（定義が効いていない場や、反映した直後のセッションでは、別のモデルで動くため）。報告の書き直し（SendMessage）は、続けて頼むので渡さない
- delegate-to-mejed：モデルを替える（haiku → sonnet も、その逆も）と決めるのは、まーちゅう。ガネーシャは、停止や要修正が続いて替えたほうがよさそうなら、保留のときにそう伝える。まーちゅうが替えると言ったら、ガネーシャが plan.md の欄を書き換え、「改訂履歴」に書く（本文ではないので承認はやり直さない）。回数の上限は数え直さない（承認をやり直していないため）
- diff-reviewer の「PR に付いたレビュー」の手順4：メジェドに頼むときのモデルは、delegate-to-mejed の決まりに従う
- review.md の雛形：回の冒頭の箇条（「数」の後）に「メジェドのモデル：haiku／sonnet」の行。その回の直前に、メジェドに実装・修正を頼んだときに渡したモデル（直近の1回）を書く。差分全体のうちどこをどのモデルが作ったかは書かない（前の回の行で追える）。その回の直前にメジェドに頼んでいないとき（健さんの PR の前の確認の回・ガネーシャが `.md` だけ直した PR レビューの回など）は「なし」と書く
- workflow.md の「本文」：除く冒頭の箇条を「作成・承認・ブランチ・イシュー・メジェドのモデル・改訂履歴」にする
- common-rules.md のチーム表：メジェドのツールを「Claude Code（サブエージェント `mejed`・既定は Haiku。plan.md で Sonnet を選べる）」にする
- README：`:6` と `:25` のメジェドのモデルを、既定は Haiku・plan.md で Sonnet を選べる、の意味にする

## 使う WordPress API と方針

- なし（文書と設定だけ）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- adversary のモデル（Fable のまま）
- 健さん（Codex）のモデル
- 既にある `docs/tasks/*/plan.md`・`review.md` の書き換え（欄が無ければ haiku として扱う）
- 各リポジトリへの反映（次の反映で各リポジトリが取り入れる）
- コードのタスクでの Haiku の試し（次のコードのタスクの review.md の「メジェドのモデル」の行で見る）

## 完了条件

- [ ] `claude/agents/mejed.md` の頭が `model: haiku` で、ほかの行は変更前と同じ
- [ ] plan.md の雛形の冒頭の箇条に「メジェドのモデル」の欄があり、選び方は plan-writer を指している
- [ ] plan-writer の「書き方の基準」に、既定は haiku（コードでも）・計画で書き切れない判断が実装に残るときだけ sonnet、がある。手順7の要点にメジェドのモデルがある
- [ ] delegate-to-mejed に、新しく呼ぶ4つの場面でのモデルの渡し方（欄の値を必ず明示して渡す・欄が無ければ haiku を渡す・書き直しは渡さない）と、モデルを替えるときの扱い（決めるのはまーちゅう・保留で伝える・欄を書き換えて改訂履歴に書く・承認はやり直さない・上限は数え直さない）がある
- [ ] diff-reviewer の「PR に付いたレビュー」の手順4に、モデルは delegate-to-mejed に従う、がある
- [ ] review.md の雛形に「メジェドのモデル」の行があり、書く条件（その回の直前にメジェドに実装・修正を頼んだときに渡したモデル。頼んでいなければ「なし」）がある
- [ ] workflow.md の「本文」で除く冒頭の箇条に「メジェドのモデル」がある
- [ ] common-rules.md のチーム表と README の2か所に「Sonnet」だけの書き方が残っていない（`grep -n Sonnet` で、既定が Haiku で Sonnet は選べる、の書き方だけが出る）
- [ ] `node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs` が通る
- [ ] 差分（plan.md・review.md を含む）に、ドライブ文字やユーザー名を含むローカルのパスと、契約しているプラン名が無い

## テスト観点

- 文書と設定だけの変更なので、差分を読んで確かめる
- メジェドを新しく呼ぶ4つの場面のどれからも、モデルの決まりにたどれるか
- 「メジェドのモデル」の欄を書き換えても承認をやり直さない、が workflow.md・plan-writer・delegate-to-mejed で食い違っていないか

## 承認前の確認

### 承認依頼1・Fable（2026-10-09）

- 採った（plan.md を直した）：5件（必須1・推奨4）。haiku のとき model を渡さないと定義が効いていない場で Haiku にならない／モデルを替えると決める人と上限の扱いが無い／承認のときにモデルを見る導線が無い／既定を逆にした判断が #28 に無い／review.md の「メジェドのモデル」の行を書く条件があいまい。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん1回目（2026-10-09）

- 採った（plan.md を直した。必須として書く）：1件（モデルを替えたとき review.md にどちらのモデルを書くか決まらない）。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし（#28 のコメントを健さんが確かめられなかった点は、ガネーシャが `gh issue comment` の結果の URL で確かめ済み）
- 返事：`docs/tasks/mejed-haiku/codex/01-consult.md`（Git に入れない）

### 承認依頼1・健さん2回目（2026-10-09）

- 採った：なし（指摘なし。#28 のコメントは健さんの環境から読めなかったが、ガネーシャが確かめ済み）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 採る指摘が無い回なので、承認依頼1の健さんはここで止める（数：Fable 1回・健さん2回。採った指摘は Fable 5、健さん 1 → 0）
- 返事：`docs/tasks/mejed-haiku/codex/02-consult.md`（Git に入れない）

## 確認事項

- なし
