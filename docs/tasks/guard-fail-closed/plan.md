# 計画：ガードを思わぬ失敗でも止める側に倒し、設定を読む根をラッパーとそろえる（#108）

- 作成：2026-10-30 ガネーシャ
- ブランチ：`fix/108-guard-fail-closed`（worktree：`C:\Temp\wt\ai-team-skills-108`）
- イシュー：#108（Closes）。見直しの結果は #104

## やること

1. 思わぬ失敗は止める側に倒す
   - 本体を関数にまとめ、一番外で例外を受けて終了コード 2 で止める
   - 入力が JSON でもオブジェクトでない（`null` など）・`tool_input` がオブジェクトでない・`file_path`（`notebook_path`）が文字列でないときは止める
   - フックの失敗（起動できない・タイムアウト）でツールを止める設定が Claude Code にあれば、`hooks.json` に足す（無ければ、無いことを README の「つまずきやすいところ」に書く）
2. 設定を読む根をラッパーとそろえる
   - 読む根：プロジェクトの根・そのメインのチェックアウトの根・編集先が入っている git の根（`.claude/worktrees/<名前>/` の中など）・そのメインの根。重ならないものだけ
   - 根ごとの候補は、ラッパーと同じ `CONFIG_CANDIDATES`（`.claude/ai-team.json`、無ければ `repo-files/claude/ai-team.json`）
   - `secretPatterns` は全部を合わせる。どれかが壊れていれば止める（その設定ファイルそのものの編集だけは通す）
   - メインの根は、git を起こさずに `.git` のファイル（`gitdir:` と、その中の `commondir`）から求める（編集のたびに走るため）。共有モジュールに置く
3. 相対の `file_path` の扱い：Claude Code のフックの入力で `file_path` がいつも絶対パスかを文書で確かめ、相対が来うるなら、ツールと同じ根（`cwd`）で解く

## やらないこと

- ガードが Bash を見ること（決めてある。柵であって壁ではない）
- ラッパーの設定の読み方（`git worktree list` を使う今の形）を変えること（#106 で扱う）

## 完了条件

- 例外の筋（`null`・オブジェクトでない `tool_input`・文字列でない `file_path`）で止まる確かめが `test-guard-code-edit.mjs` にある
- worktree から、メインにだけある `secretPatterns` に当たるファイルの編集が止まる。メインから、`.claude/worktrees/<名前>/` の中の worktree にだけある `secretPatterns` に当たるファイルの編集も止まる
- `repo-files/claude/ai-team.json` だけのリポジトリ（テンプレート）でも、そこの `secretPatterns` が効く
- 今のガードの確かめが全部通る（Windows・Linux）

## 確かめ方

- `node plugins/ai-team/hooks/test-guard-code-edit.mjs`・`test-session-start.mjs`・`skills/codex/scripts/test-invoke-codex.mjs` を Windows と Linux のコンテナで
- PR の前に健さんの review。ガードの判定を変えるので `/security-review` も

## 実装で決めたこと・確かめたこと

- Claude Code の文書（hooks.md）：PreToolUse のフックは終了コード 2 のときだけ止め、1・起動できない・時間切れは通す。`onFailure: "block"`（2.1.295 以降）で、どの失敗でも止める。この PC は 2.1.312 で、`claude plugin validate` も通った → ガードに付けた
- 同じ文書：Edit・Write・Read の `tool_input.file_path` はいつも絶対パス → 計画の 3（相対パス）は当たらない。EnterWorktree の後は、フックの `cwd` が worktree、`CLAUDE_PROJECT_DIR` がメインを指す → 設定を読む根に、`cwd` の git の根とメインの根も足した
- 足したテストを、直す前のガードに当てると10件落ちる（例外の筋5・設定を読む根4・onFailure 1）ことを確かめた
