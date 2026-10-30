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

## PR の前のレビュー（1巡目）で直すこと（まーちゅう OK 2026-10-30）

健さん（P2 3件）・藤さん（必須0・推奨8・表記1）・セキュリティのレビュー（MEDIUM 1件）。

1. 「設定ファイルそのものは通す」の例外を狭める：通すのは、プロジェクトの中にある根（プロジェクトの根と、その中の worktree など）の設定ファイルで、その根で実際に読む1つ（`.claude/ai-team.json` があればそれ、無ければ `repo-files/claude/ai-team.json`）だけ。しかも、指定のパスと実体のパスの両方が、既定の秘密情報の判定（`SECRET_PATTERNS`）を通ったときだけ。プロジェクトの外の根（細工した `.git` が指す場所など）の設定は、読むだけで、編集は「外」の判定に回す
   - 筋書き（セキュリティ）：`sub/.git` に `gitdir: ./g`、`sub/g/commondir` に `../../../../victim/.git` と書くと、`gitRoots` が `victim` をメインとして返し、`victim/.claude/ai-team.json` への書き込みが「設定ファイルそのもの」として通る
   - 筋書き（健さん）：`.claude/worktrees/.kv/.claude/ai-team.json` が例外で通る（前は `.kv/` で止まっていた）
2. `gitRoots`：`.git` のファイルや `commondir` が読めない（アクセス権など）・`gitdir:` の行が無いときは、「メインを求められない」と区別して、ガードは止める。`commondir` が無い（ENOENT。サブモジュールの形）だけなら、今までどおりメインは無いとして進める
3. 秘密情報のパターンを、そのパターンを書いた設定の根からの相対パスにも当てる（入れ子のリポジトリ `packages/lib/` などの設定も効くように）。プロジェクトの根からの相対パスに全部のパターンを当てる今の判定も残す
4. フックの `cwd` の根は、そのメインの根がプロジェクトのメインの根と同じとき（同じリポジトリ）だけ読む（関係ないリポジトリの壊れた設定で、全部の編集が止まらないように）
5. `file_path`（`notebook_path`）が無い・空のときも止める（今の「無ければ通る」のテストは、止める側に直す）
6. テストを足す：`cwd` だけが worktree を指す（`CLAUDE_PROJECT_DIR` はメイン）とき／入れ子のリポジトリ（`.claude/worktrees/` の外）の `secretPatterns`／細工した `.git` が外を指すときの外の設定ファイルの編集は止まる／`.kv` の名前の worktree の設定ファイルは止まる／`.claude/ai-team.json` がある根の `repo-files/claude/ai-team.json` は、設定が壊れているとき止まる／`.git` が読めないとき止まる（アクセス権を作れる OS だけ）
7. README の「中身」の `claude/ai-team.json` の説明に、ガードが読む根（プロジェクトの根・メインの根・編集先の git の根・`repo-files/claude/ai-team.json`）を書く。2.1.295 より前の版が `onFailure` をどう扱うかは確かめていない、と README に書く

このイシューで直さないもの：SessionStart がメインの根・`repo-files` を読まない（#110 で呼び名と一緒に直す）／一番外の例外の受けを通るテスト（投げる場所がほぼ無いので、守りとして残す）

## PR の前のレビュー（2〜4巡目）

| 巡 | 健さん | 藤さん |
| --- | --- | --- |
| 2 | なし | 推奨1・表記3（cwd の壊れた .git で全部止まる・止める文・README） |
| 3 | P2 1（リンクの実体の場所から根を集める） | 表記2（コメント・止める文のテスト） |
| 4 | なし | 推奨1（README の Git の理由）・表記1 |

- どれも採った。4巡目の藤さんの表記（プロジェクトをリンク経由で開き、実体側にしか無い根の設定ファイルは「設定ファイルそのもの」として通らない）は、実害が小さいので記録だけ
- 3巡目の後に、まーちゅうと最低要件（Node.js 22・Git 2.36・Claude Code 2.1.295）を決め、README の前提に表で書いた。Git 2.36 は #106 のラッパーが `-z` を使うため
