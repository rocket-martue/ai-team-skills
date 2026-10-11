# レビュー：image-task-review-scope

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-11）

- 対象：`fix/41-image-task-review-scope`（未コミット）
- 判定：要修正
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：haiku

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| フローチャートの矢印の向き（`D1`→`K3`、`V3`→`IMG`、`IMG`→`RP`／`EYE`、`EYE`→`RP`／`H`）。`IMG -->|"いいえ"| K3` が無い | ○ | `repo-files/docs/team/workflow.md:35-46` |
| `K3`・`IMG`・`RP`・`EYE` のラベルが1回ずつ。`PR` のノードの頭が「ガネーシャ: コミット・push・PR。」 | ○ | 同上。`:46` |
| 「画像のタスクでは K3 を回さない」という意味の文が無い | ○ | `grep -rn "回さない\|回さず\|代わりに"` の残りは `claude/skills/delegate-to-mejed/SKILL.md:92`（PR の前の確認はやり直さない）と `repo-files/docs/team/workflow.md:121`（簡単な修正の道）で、どちらも別の意味 |
| workflow.md の K3 の返事の採否・目視の NG を必須で書く・作り直しの戻り方と数え方・5回で保留・P1 | ○ | `repo-files/docs/team/workflow.md:58-66` |
| delegate-to-mejed の目視の OK は手順7の報告へ・作り直しは「手順」の4へ・NG を必須で書く | ○ | `claude/skills/delegate-to-mejed/SKILL.md:91-92` |
| mejed.md の手順6と修正の手順3に、通らない項目を通るまで直す | ○ | `claude/agents/mejed.md:39`・`:47` |
| 「2回以上落ちたチェック」に `### AI が見ること` の項目。delegate-to-mejed は workflow.md を指す | ○ | `repo-files/docs/team/workflow.md:69`・`claude/skills/delegate-to-mejed/SKILL.md:83` |
| delegate-to-mejed の手順7が「健さんの呼び方」の「PR の前」を指す | ○ | `claude/skills/delegate-to-mejed/SKILL.md:38` |
| 「PR の前」で採る指摘が無いとき、画像のタスクなら目視へ | ○ | `claude/skills/delegate-to-mejed/SKILL.md:103` |
| diff-reviewer の画像の見出しの箇条と、手順4の先頭の画像の作り直しの箇条 | ○ | `claude/skills/diff-reviewer/SKILL.md:29`・`:75` |
| plan-writer に「画像と、その置き場所の記録…だけを入れ」の文が無い | ○ | ただし指摘1 |
| mejed.md の手順5と報告の形式の2行。報告は5行のまま | ○ | `claude/agents/mejed.md:60`・`:68-72` |
| 対象外のファイルに差分が無い | ○ | `git diff origin/main --stat` は対象の8ファイルだけ |
| チェックコマンドが通る | ○ | `node claude/hooks/test-guard-code-edit.mjs` 終了0、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 19/19 |
| 差分にローカルの絶対パス・クライアント識別情報が無い | ○ | |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/skills/plan-writer/SKILL.md:51` | 文を消したときに、残す文の終わりの句点「。」と改行まで消え、次の箇条「- 「対象外（やらないこと）」を必ず書き、…」が同じ行につながっている（行末が「…この2つの見出しを書かない- 「対象外…」） | 「…この2つの見出しを書かない。」で行を終え、改行して次の箇条「- 「対象外（やらないこと）」…」を元どおり別の行にする | plan-writer の「書かない。」で行を終え、「対象外」の箇条を別の行に戻した（句点と改行を入れ直した）。本文の残りは変えていない | 解決 |
| 2 | 必須 | `claude/skills/codex/SKILL.md`（ファイルの最後） | 最後の箇条を消したときに、ファイルの最後の改行も消えた（`git diff` に「\ No newline at end of file」）。最後の行は内容が変わっていないのに差分に出ている | ファイルの最後に改行を1つ戻し、最後の行が差分に出ないようにする | codex/SKILL.md の末尾に改行を1つ戻した。差分は「注意」の箇条の削除だけになり、「No newline」は出ない | 解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-11）

- 対象：`fix/41-image-task-review-scope`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目 ／ 承認依頼 1
- メジェドのモデル：haiku

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 第1回の完了条件 | ○ | 第1回から変わったのは `claude/skills/plan-writer/SKILL.md` と `claude/skills/codex/SKILL.md` の2つだけ |
| チェックコマンドが通る | ○ | `node claude/hooks/test-guard-code-edit.mjs` 終了0、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 19/19 |
| 対象外のファイルに差分が無い | ○ | `git diff --stat` は対象の8ファイルだけ |

### 前回の指摘

| # | 再レビュー | メモ |
| --- | --- | --- |
| 1 | 解決 | `claude/skills/plan-writer/SKILL.md:51` は「…この2つの見出しを書かない。」で終わり、`:52` が「- 「対象外（やらないこと）」…」 |
| 2 | 解決 | `claude/skills/codex/SKILL.md` の差分は、消す箇条の1行だけ。「No newline at end of file」は出ない。改行コードは LF のまま（警告は `core.autocrlf` の設定による） |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第3回（2026-10-11）

- 対象：`fix/41-image-task-review-scope`（未コミット）
- 判定：OK
- 出所：健さん・review・1回目
- 数：PR の前の健さん 1回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

なし（健さんの返事：画像タスクのレビュー後に目視確認を行う流れと、修正時の戻り先・回数制限は各文書で整合している。変更によって導入された、修正すべき不具合は見つからなかった）

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/image-task-review-scope/codex/03-review.md`（Git に入れない）
