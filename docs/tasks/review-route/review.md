# レビュー：review-route

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-12）

- 対象：`feat/43-review-route`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：sonnet

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| ラッパーに `save-code-review` があり、足した確かめが通る | ○ | `-Task` の確かめの後、PromptFile・node・設定ファイルの確かめより前で終わる（`claude/skills/codex/scripts/invoke-codex.ps1:185`）。`test-invoke-codex.mjs` 51/51 |
| codex の SKILL.md のモードの表・2か所の例外・呼び方と保存先 | ○ | |
| workflow.md の言葉の決まり「レビューの道」（止めどき・保存・限界の3つ・plan.md を指さない）と「本文」 | ○ | |
| フローチャートの `F0`・`F0` の「いいえ」の矢印・`F1`・`K1`・`V1` のラベル。ノードの名前と矢印は main と同じ | ○ | |
| フローチャートの下の箇条・回数の上限の表の2行・`:104` | ○ | |
| plan-writer の手順1・手順7の要点・承認前の確認の手順1・3（止めどき）・4・改訂・絶対にしないこと | ○ | |
| plan.md の雛形の「レビューの道」の行・コメント・見出しの例・返事の行 | ○ | |
| delegate-to-mejed・codex の SKILL.md `:21`・Ganesha.md・common-rules.md・README の各所 | ○ | 古い書き方（「Fable は数え直さない」など）が残っていないことを grep で確かめた |
| `.gitignore` と snippet に `docs/tasks/*/code-review/` | ○ | |
| 対象ファイルのほかに差分が無い | ○ | 12ファイルと `docs/tasks/review-route/` |
| チェックコマンドが通る | ○ | `node claude/hooks/test-guard-code-edit.mjs` 全部通った。`node claude/skills/codex/scripts/test-invoke-codex.mjs` 51/51（リンクの1件は skip） |
| 差分にローカルの絶対パス・クライアント識別情報が無い | ○ | |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-12）

- 対象：`feat/43-review-route`（未コミット）
- 判定：OK
- 出所：健さん・review・1回目
- 数：PR の前の健さん 1回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

なし（健さんの返事：変更差分と関連するテストコードを確認した。保存専用モードの追加、既存モードの互換性、レビュー手順の整合性に、修正が必要な不具合は見つからなかった）

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/review-route/codex/04-review.md`（Git に入れない）
