# レビュー：review-secret-check

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-06）

- 対象：`fix/14-review-secret-check`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 確かめが git status のすべての項目（R・C は元のパスも）と、-Base の git diff --no-renames のすべてのパスに当たる | ○ | `invoke-codex.ps1` の review の分岐。`git diff` の失敗でも止まる。基準ブランチ名の後ろに `--` を足している（計画との差分ではなく、オプションと読まれない備え） |
| test-invoke-codex.mjs が終了コード 0 で、止まる9つ・止まらない3つ。環境の作り直し・最初の Get-Command の確かめ | ○ | ガネーシャが打って 12/12。`GIT_` は大文字小文字を問わず除く。準備の git も `buildEnv` の環境。写した版から `--no-renames` を外すと、-Base の名前の変更の場合だけが落ちる（11/12）ことも確かめた |
| test-guard-code-edit.mjs が通る | ○ | ガネーシャが打って全部通った |
| invoke-codex.ps1 が BOM 付きのまま | ○ | 先頭のバイトで確かめた |
| SKILL.md の「ラッパーがしてくれること」が新しい範囲と同じ | ○ | |
| 差分にローカルの絶対パス・契約しているプラン名が無い | ○ | テストの `C:\Windows` は SystemRoot が無いときの既定値で、手元の環境ではない |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 推奨 | `README.md:32` | テストの行が `repo-files/codex/AGENTS.md` の行の後ろにあり、codex スキルの行（30行目）と離れている。フックとそのテストは隣り合っているので、並びがそろわない | テストの行を codex スキルの行の直後へ移す | codex スキルの行の直後へ移した | 解決 |
| 2 | 推奨 | `claude/skills/codex/scripts/test-invoke-codex.mjs:33` | `git` が見つからないと `findGitDir` が投げて、一時ディレクトリ（`root`）を消さずに落ちる | 最初の確かめの前に git の場所を1回だけ求め、見つからなければ `root` を消して終了コード 1 で終わる | git の場所を最初に1回だけ求め、見つからなければ root を消して終了コード 1 で終わるようにした | 解決 |

### 見送った指摘（あれば）

-

### 計画への指摘（あれば）

-

### 良かった点（任意）

- 実装の前に、元のラッパーでテストが落ちる（4/12）ことを確かめてから直している

## 第2回（2026-10-06）

- 対象：`fix/14-review-secret-check`（未コミット）
- 判定：要修正
- 出所：健さん・review・1回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前の健さん 1回目 ／ 承認依頼 1

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 第1回と同じ | ○ | 下の指摘3は、日本語を含む一時パスの環境でだけ起きる |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 必須 | `claude/skills/codex/scripts/test-invoke-codex.mjs:110-113` | 最初の確かめの PowerShell の標準出力は既定で CP932（Windows PowerShell 5.1）なのに、UTF-8 として読んでいる。一時ディレクトリのパスに日本語が入る環境では、`(Get-Command codex).Source` が化けて `startsWith(fakeDir)` が偽になり、偽物が正しくてもテストが全部の前に落ちる。ラッパーは 37〜38行目で UTF-8 にそろえているが、確かめの子プロセスはそろえていない | 確かめの `-Command` の頭で `[Console]::OutputEncoding` を UTF-8 にしてから `Source` を出す | 確かめの -Command の頭で OutputEncoding を UTF-8（BOM なし）にしてから Source を出すようにした | 解決 |

第1回の推奨1・2も、この回で一緒に対応する。

### 見送った指摘（あれば）

-

### 計画への指摘（あれば）

-

## 第3回（2026-10-06）

- 対象：`fix/14-review-secret-check`（未コミット）
- 判定：要修正
- 出所：健さん・review・2回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前の健さん 2回目 ／ 承認依頼 1

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | 必須 | `claude/skills/codex/scripts/test-invoke-codex.mjs:61-64` | 利用者のグローバルな除外（`core.excludesFile`、未設定でも既定の `~/.config/git/ignore`）に `.env`・`.dev.vars` があると、未追跡の `.dev.vars` が status に出ず、`.env` もコミットされずに `git mv` が落ちる。ラッパーが正しくてもテストが落ちる | `buildEnv` の `GIT_CONFIG_*` に `core.excludesFile` を足し（`GIT_CONFIG_COUNT=2`）、一時ディレクトリ（`root`）の下の空のファイルを指す。準備の git とラッパーの中の git の両方に効く | buildEnv の GIT_CONFIG を2件にして core.excludesFile を root 下の空のファイルへ向けた | 解決 |

### 見送った指摘（あれば）

-

### 計画への指摘（あれば）

- なし（計画の「git の設定を環境変数で固定する」の範囲で直せる）

## 第4回（2026-10-06）

- 対象：`fix/14-review-secret-check`（未コミット）
- 判定：要修正
- 出所：健さん・review・3回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前の健さん 3回目 ／ 承認依頼 1

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 必須 | `claude/skills/codex/scripts/test-invoke-codex.mjs:37-40` | `where git` の出力（日本語版 Windows では CP932）を UTF-8 として読んでいる。git の置き場所に日本語が入る環境では、化けたパスが子プロセスの PATH に入り、準備の `git init` から全部落ちる | `where` を使わず、Node.js の中で `process.env.PATH`（キーの大文字小文字を問わず）を `;` で分け、`git.exe` がある最初のディレクトリを `fs.existsSync` で探す。見つからなければ今と同じく root を消して終了コード 1 | where をやめ、process.env の PATH（キーの大文字小文字を問わず）を ; で分けて git.exe がある最初のディレクトリを fs.existsSync で探すようにした。見つからなければ今までどおり root を消して終了コード 1 | 解決 |

### 見送った指摘（あれば）

-

### 計画への指摘（あれば）

-

## 第5回（2026-10-06）

- 対象：`fix/14-review-secret-check`（未コミット）
- 判定：OK
- 出所：健さん・review・4回目
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ PR の前の健さん 4回目 ／ 承認依頼 1

### 指摘

- なし（健さんは修正の要る不具合なしと返した）

### 見送った指摘（あれば）

-
