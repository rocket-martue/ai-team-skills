# レビュー：plugin-ai-team

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-12）

- 対象：`feat/34-plugin`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：sonnet

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| `claude/` が無く、スキル・エージェント・フックが `plugins/ai-team/` の下にあり、`git mv` で移した | ○ | `git status` で全部 `R`（rename）。`claude/` は無い |
| `marketplace.json` と `plugin.json` が計画どおりで、`plugin.json` に `version` が無い | ○ | `marketplace.json` にトップレベルの `description` がある（メジェドの「計画との差分」。validate の警告を消すため。受け入れた） |
| `claude plugin validate .` と `claude plugin validate plugins/ai-team` が終了コード 0 で、警告が `version` が無いことだけ | ○ | どちらも `version` の警告1件だけ |
| `hooks.json` に PreToolUse と SessionStart、`session-start.mjs` と `test-session-start.mjs` があり、テストが通る | ○ | 全部通った（境目の前後も確かめている） |
| `plugins/ai-team/docs/` に workflow.md と team-rules.md があり、`repo-files/docs/team/workflow.md` が無い。common-rules.md は固有の節と冒頭の説明だけ | ○ | team-rules.md は 5,564 文字 |
| 完了条件の grep の残りが (a)〜(e) だけ | ○ | 残りは、ガードのテストの仮のリポジトリの `.claude/...`、`repo-files/claude/ai-team.json`、`.claude/ai-team.json`、「プラグインに切り替える前のリポジトリでは」の文 |
| サブエージェントの名前・チームの表・workflow.md の呼び名が `ai-team:` つき | ○ | |
| mejed.md の本文にラッパーの呼び方（二重引用符つき）があり、codex の SKILL.md・`allowed-tools`・settings.json の allow も二重引用符。workflow.md にラッパーのパスが無い | ○ | workflow.md は「`codex` スキル（`ai-team:codex` を読み込む）」の書き方 |
| `common-rules.md の「(言語\|作業の進め方\|チーム)` が0件 | ○ | `workflow.md:70` と `mejed.md:78` は team-rules.md を指す形 |
| 共有モジュールの設定ファイルの候補と、codex の SKILL.md・AGENTS.md・ラッパーのテストが `repo-files/claude/ai-team.json` | ○ | |
| ガードが `mejed` と `ai-team:mejed` を通し、ガードのテストが通る | ○ | 全部通った（skip 2）。`ai-team:adversary`・`other:mejed` は止まる確かめあり |
| ラッパーのテストが通る | ○ | 79/79 |
| settings.json に `hooks` が無く、allow が末尾 ` *` の形で、`enabledPlugins` が無い | ○ | |
| AGENTS.md と README（導入・更新・外し方、`--scope project`、settings.json の後に install） | ○ | README `:196-228` |
| 対象ファイルと `docs/tasks/plugin-ai-team/` のほかに差分が無い | ○ | |
| 差分にローカルの絶対パス・クライアント識別情報が無い | ○ | `C:\\Windows` はテストの既定値（既存） |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-12）

- 対象：`feat/34-plugin`（未コミット）
- 判定：要修正
- 出所：健さん・review・1回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前のレビュー役（健さん） 1回目 ／ 承認依頼 1
- メジェドのモデル：なし
- 返事：`docs/tasks/plugin-ai-team/codex/05-review.md`

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `README.md:205`、`README.md:304` | 案件の秘密情報のパターンを足すときに、「チーム共通の決まり（team-rules.md）の秘密情報の箇条も、同じにそろえる」と書いている。team-rules.md はプラグインの中（全リポジトリで共通・キャッシュにあり、プラグインの更新で上書きされる）なので、案件ごとに書き足せない。移す前は common-rules.md（リポジトリ側）だった | 2か所とも、そろえる先を「リポジトリの `docs/team/common-rules.md` に、案件の秘密情報の箇条を足す」にする（team-rules.md はプラグインの中なので直さない、と添える）。ほかの README の文で、案件ごとに team-rules.md を書き換えさせる文が無いかも見る | README の2か所（205行と304行）を、リポジトリの `docs/team/common-rules.md` に案件の秘密情報の箇条を足す形に直し、team-rules.md はプラグインの中なので直さないと添えた。ほかに案件ごとに team-rules.md を書き換えさせる文は無し | 解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第3回（2026-10-12）

- 対象：`feat/34-plugin`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前のレビュー役（健さん） 1回目の指摘の修正の後 ／ 承認依頼 1
- メジェドのモデル：sonnet

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 第2回の指摘1 | ○ | `README.md:205`・`:304` は、リポジトリの `docs/team/common-rules.md` に案件の秘密情報の箇条を足す形。案件ごとに team-rules.md を直させる文はほかに無い |
| ほかの完了条件 | ○ | 第1回から変わったのは README の2か所と review.md だけ。ガードと SessionStart のテストは通った（メジェドの報告では、ラッパーのテスト 79/79・validate も通った） |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第4回（2026-10-12）

- 対象：`feat/34-plugin`（未コミット）
- 判定：OK
- 出所：健さん・review・2回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前のレビュー役（健さん） 2回目 ／ 承認依頼 1
- メジェドのモデル：なし
- 返事：`docs/tasks/plugin-ai-team/codex/06-review.md`

### 指摘

- なし（健さんの返事は「修正が必要な不具合は見つかりませんでした」）

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし
