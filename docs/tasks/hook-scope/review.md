# レビュー：hook-scope

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-06）

- 対象：`chore/1-hook-scope`（未コミット）
- 判定：OK
- 出所：diff-reviewer ／ 健さん・consult・repeated-failure
- 数：diff-reviewer の指摘による修正依頼 0回 ／ 承認依頼 1

メジェドの実装の報告は、最初は「途中で2回以上落ちたチェック」の行が無く、書き直しを頼むと「`node claude/hooks/test-guard-code-edit.mjs` が2回落ちた（同じ10件。根の `CLAUDE.md` と `.github/ISSUE_TEMPLATE/` が Windows の小文字化に当たらなかった。フック側の正規表現に `i` フラグを付けて直した）」と出てきた。健さんに「直ったのか、隠しただけか」を頼み、**指摘なし**（期待値は維持、除外の分岐なし。正規表現を戻すと同じ10件が落ちることも確かめた。返事はメインのチェックアウトの `docs/tasks/hook-scope/codex/06-consult.md`）。

`claude/settings.json` は、まーちゅうの許可を得てガネーシャが書き換えた（plan.md のとおり）。

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| `node claude/hooks/test-guard-code-edit.mjs` が通る（表の7行×3役×メインと worktree・ask の JSON・`.claude/worktrees/` そのもの・根の `CLAUDE.md`・リンク・`.gitignore` と `.github/`・plan.md と review.md・今までの判定・入れ子） | ○ | 「全部通った」。リンクはジャンクションを作って確かめている。`\` 区切りと大文字小文字は Windows でだけ回す |
| フックの登録が `command: node` と `args` の形 | ○ | ガネーシャが書き換えた。テストでも確かめている |
| ask に stash・restore・clean・rm・branch・worktree remove。deny と ask の Bash のルールすべてに同じ形の PowerShell | ○ | テストで対応を全件確かめている |
| README に古いフックの登録の説明が残っていない | ○ | 「Windows での実行」を書き直した |
| README の「編集できる範囲」の表が計画の表と一致・「直さないもの」4件・「git の権限」が settings.json と一致し PowerShell のことが書いてある | ○ | |
| common-rules.md に確認が出るもの・「Bash・PowerShell 経由」 | ○ | |
| 差分にローカルの絶対パス・契約プラン名が無い | ○ | grep で確認 |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 推奨 | claude/hooks/guard-code-edit.mjs:23-26 | `CONFIRM_PATTERNS` のコメントで「Windows では小文字にそろえて照合するので、大文字を含む名前は i フラグで書く」が2回書かれている | 1回にまとめる（次に直すときのついでで足りる） |  | 未解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-06）

- 対象：`chore/1-hook-scope`（未コミット）
- 判定：OK
- 出所：健さん・review・1回目
- 数：PR の前の健さん 1回目 ／ 承認依頼 1

### 指摘

- なし（健さんの返事：「変更差分に、修正が必要な不具合は見つかりませんでした。構文チェックと、ファイル作成を伴わない判定・設定テストは通りました。リンク作成テストと Claude Code 内での実動作は未確認です」。健さんの sandbox は読むだけなので、一時ディレクトリを作るテストは回せない。テスト全体はガネーシャとメジェドの手元で通っている。返事は `docs/tasks/hook-scope/codex/07-review.md`）
