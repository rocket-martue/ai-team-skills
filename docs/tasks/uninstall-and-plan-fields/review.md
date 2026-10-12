# レビュー：uninstall-and-plan-fields

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-12）

- 対象：`fix/52-uninstall-plan-fields`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：haiku

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| README の「このリポジトリで打つチェックコマンド」の5本が通る | ○ | ガード・SessionStart は全部通った、ラッパー 79/79、validate は2つとも警告が `version` だけ。メジェドが報告した common-rules.md の phpcs は、テンプレートの見本の行で、この計画の完了条件ではない（打てないのは前から） |
| 外し方の順と、片付けの PR で必ず消すもの | ○ | `README.md` の「外し方」の手順1〜5。目印の3つ（`.claude/ai-team.json`・`enabledPlugins`・`.claude/skills/delegate-to-mejed/`）と Ganesha.md・CLAUDE.md の取り込みを「必ず」で消す |
| 雛形の冒頭に「イシュー」「worktree」が「ブランチ」の次にこの順 | ○ | |
| plan-writer の「書き方の基準」に埋め方と、gh-* が読むこと | ○ | |
| delegate-to-mejed の手順8に、値だけを書くことと、欄が無い・形が違うときの扱い | ○ | |
| 雛形・plan-writer の「worktree」が、中は相対パス、外は「リポジトリの外」 | ○ | |
| workflow.md の「本文」の冒頭の箇条に「worktree」 | ○ | |
| 対象ファイルと `docs/tasks/uninstall-and-plan-fields/` のほかに差分が無い | ○ | |
| 差分にローカルの絶対パス・クライアント識別情報が無い | ○ | grep で確かめた |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-12）

- 対象：`fix/52-uninstall-plan-fields`（未コミット）
- 判定：OK
- 出所：健さん・review・1回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前のレビュー役（健さん） 1回目 ／ 承認依頼 1
- メジェドのモデル：なし
- 返事：`docs/tasks/uninstall-and-plan-fields/codex/04-review.md`

### 指摘

- なし（健さんの返事は「修正が必要な不具合は見つかりませんでした」）

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第3回（PR レビュー・2026-10-12）

- 対象：PR #53（`fix/52-uninstall-plan-fields`、最新コミット：`3b1af3b`）
- 判定：要修正（`.md` だけなので、まーちゅうの OK でガネーシャが直した）
- 出所：PR レビュー（Fさん（adversary）。Copilot の代わりを試した。#54）
- 数：PR レビューでの修正依頼 0回目（`.md` だけでメジェドに頼んでいない） ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応 | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `README.md:225` | `enabledPlugins` の行を先に消すと、`uninstall --scope project` が「その scope に入っていない」で失敗しうる（推測。公式の cli-reference） | まだ確かめられないので、失敗して `claude plugin list` に残るときは止まってまーちゅうが決める、と書く。確かめは #34 の 3（まーちゅうの決めたこと） | 直した | 解決 |
| 2 | 必須 | `README.md:225` | ほかの PC で入れた記録が残ると、行を消しても `defaultEnabled` で動き続けうる（推測） | 手順3を、入れた PC ごとに打つ、と書く | 直した | 解決 |
| 3 | 必須 | `README.md:216` | 手順1で gh-issue を使うと ai-team の流れに入る | 使わないものに gh-issue を足す | 直した | 解決 |
| 4 | 必須 | 雛形 `plan.md:8`・`plan-writer/SKILL.md:54` | ai-team のリポジトリでは worktree はいつも中（gh-skills の worktree.md）。「リポジトリの外」と食い違う | 「外」は ai-team の目印に当たらないリポジトリだけ、と書く | 直した | 解決 |
| 5 | 必須 | `delegate-to-mejed/SKILL.md:46-47` | 「PR を作る前に伝える」箇条が `gh pr create` の後にある | `gh pr create` の前に移す | 直した | 解決 |
| 6 | 必須 | `README.md:216-227` | 片付けの worktree とブランチの片付け方が無い | 手順2で追いついた後に gh-wrapup で、と書く | 直した | 解決 |
| 7 | 必須 | 雛形 `plan.md:7`・`delegate-to-mejed/SKILL.md:47` | `・` でつないだ複数のイシューを GitHub が閉じるか確かめていない（推測） | PR 本文には1行に1つずつ書く | 直した | 解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし（直しは計画の目的の中。外し方の順と雛形の欄の書き方）
