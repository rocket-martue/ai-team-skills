# AIチーム開発 スキル一式（下書き）

Claude Code だけで回す体制のスキル・チーム設定・権限設定。

- **ガネーシャ**（Claude Code のメイン）＝ 計画・メジェドへの実装依頼・レビュー・頼まれたときのコミットと PR・PR に付いた指摘の対応
- **メジェド**（サブエージェント `mejed`・Sonnet）＝ 実装・指摘の修正
- **adversary**（サブエージェント `adversary`・Fable）＝ 壊しに来る役。計画の承認前に、1つの計画につき1回だけ、計画書を壊す側から読んで指摘だけを返す。直さない
- **健さん**（Codex CLI・外部委託業者）＝ 読むだけの相談・レビューと、画像の生成。スキル `codex` から呼ぶ。実装は頼まない。承認前・チェックが2回以上落ちたとき・PR の前の確認の中心
- **まーちゅう** ＝ 要件決定・計画の承認・最終確認・マージ

> 以前は Codex をメジェドにしていたが、2つのツールの行き来（セッションの切り替え・進捗をリモートで見られない）の手間が大きかったので、
> サブエージェントだけにした（2026-10-04）。
> 当初は Codex の使用枠の消費も理由に挙げていたが、読み違いだった。5時間枠の表示の 85% は残りの量で、使ったのは 15% ほどだった（2026-10-05 に訂正。体制は変えない）。

## 中身と置き場所

`claude/` の中身を、リポジトリの `.claude/` にそのまま重ねる。

| ファイル | 担当 | 置き場所 |
| --- | --- | --- |
| `repo-files/docs/team/common-rules.md` | 共通 | リポジトリの `docs/team/common-rules.md` |
| `repo-files/docs/team/Ganesha.md` | ガネーシャ | リポジトリの `docs/team/Ganesha.md` |
| `repo-files/docs/team/workflow.md` | 全員 | リポジトリの `docs/team/workflow.md`。作業の流れ（フローチャート・言葉の決まり・回数の上限）の正本 |
| `repo-files/CLAUDE.md.snippet` | ガネーシャ | 中身を `CLAUDE.md` の先頭に追記 |
| `claude/agents/mejed.md` | メジェド | `.claude/agents/mejed.md`。キャラ・手順・報告の形式・禁止事項。モデルは Sonnet |
| `claude/agents/adversary.md` | adversary | `.claude/agents/adversary.md`。計画の問い・報告の形式・禁止事項。モデルは Fable |
| `claude/skills/plan-writer/` | ガネーシャ | `.claude/skills/plan-writer/`。承認を頼む前に、Fable を1回、その後は健さんを採る指摘が0になるまで呼ぶ |
| `claude/skills/delegate-to-mejed/` | ガネーシャ | `.claude/skills/delegate-to-mejed/`。メジェドに実装を頼み、レビュー→修正を回す。PR の前に健さんの review を、採る指摘が0になるまで回す |
| `claude/skills/diff-reviewer/` | ガネーシャ | `.claude/skills/diff-reviewer/`。PR 前の差分レビューと、PR に付いた指摘の対応 |
| `claude/skills/codex/` | ガネーシャ・メジェド | `.claude/skills/codex/`。健さん（Codex CLI）に相談・レビュー・画像の生成を頼む。ラッパーは `scripts/invoke-codex.ps1`（Windows PowerShell） |
| `repo-files/codex/AGENTS.md` | 健さん | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲。同じ場所に `AGENTS.override.md` を置かない（そちらが優先される） |
| `claude/hooks/guard-code-edit.mjs` | 全員 | `.claude/hooks/guard-code-edit.mjs`。編集の直前に「誰が・どこを」編集するかを見て止める |
| `claude/hooks/test-guard-code-edit.mjs` | 全員 | `.claude/hooks/test-guard-code-edit.mjs`。フックの確かめ（`node .claude/hooks/test-guard-code-edit.mjs`）。フックに入力の JSON を流して終了コードを見る。git は呼ばない |
| `claude/settings.json` | 全員 | `.claude/settings.json`。フックの登録と、git・秘密情報の権限 |
| `repo-files/gitignore.snippet` | 全員 | 各リポジトリの `.gitignore` に足す行（`.claude/worktrees/`・`docs/tasks/*/codex/`） |

## ファイルの分け方

- **CLAUDE.md**：リポジトリの説明（構成、ビルド方法、テーマ・プラグイン情報など）。先頭で `@docs/team/Ganesha.md` を取り込む
- **docs/team/common-rules.md**：共通規約とチェックコマンド。ガネーシャは取り込みで、メジェドと adversary は作業の最初に Read で読む
- **docs/team/Ganesha.md**：ガネーシャの役割・キャラ設定・禁止事項
- **docs/team/workflow.md**：作業の流れの正本。取り込みには入れず、スキル・メジェド・adversary が作業の最初に Read で読む
- **.claude/agents/mejed.md**：メジェドの役割・キャラ設定・禁止事項（メジェドの定義はここだけ）
- **.claude/agents/adversary.md**：壊しに来る役の問い・報告の形式・禁止事項。キャラ設定は持たない
- **スキル**：計画・実装の依頼・レビューの手順とテンプレート
- **フック＋settings.json**：編集できる範囲と git の権限

## 編集できる範囲（フックで判定）

| 誰が | docs/tasks/ と Markdown（.md） | それ以外のコード | 秘密情報（.dev.vars、.kv/、wp-config.php、.env） | リポジトリの外 |
| --- | --- | --- | --- | --- |
| ガネーシャ | ○ | × | × | `~/.claude/projects/<p>/memory/`・`~/.claude/plans/`・`<一時ディレクトリ>/claude/` だけ ○ |
| メジェド（mejed） | ○ | ○ | × | 同上 |
| ほかのサブエージェント | ○ | × | × | 同上 |

- Markdown を通すのは「コード以外（.md）の PR レビューの指摘はガネーシャが直す」（Ganesha.md）ため
- adversary は tools に Edit / Write を持たないので、そもそもフックまで届かない。ファイルを書ける経路は Bash（リダイレクト・`sed -i`・`git stash` など）だけで、adversary.md の禁止事項で縛っている（Bash はフックの対象外）
- Windows のファイルシステムは大文字小文字を区別しないので、Windows ではパスを小文字にそろえてから照合する（`.DEV.VARS` も止まる）
- 判定は「指定されたパス」と「シンボリックリンク（ジャンクションを含む）をたどった実体のパス」の両方に当てる。リンク経由で秘密情報・コード・リポジトリの外を書き換えることはできない
- `~/.claude/` は丸ごと通さない。ユーザー共通の settings.json・CLAUDE.md・スキル・認証情報が入っているので、メモリと計画ファイルの2か所だけにする

- settings.json の `Edit(**/*.php)` のような禁止ルールはサブエージェントにも効いてしまい、メジェドが実装できなくなる。
  そのため編集の制限は settings.json ではなくフックで行う（フックの入力に含まれる `agent_id`／`agent_type` で呼び出し元を見分ける。メインのときは両方とも入らない）
- リポジトリの外で通すのは、Claude Code 自身の置き場所（メモリ・プランモードの計画ファイル・scratchpad）だけ
- 秘密情報のパターンは先頭で固定していないので、`.claude/worktrees/<名前>/.dev.vars` のような入れ子でも止まる

## git の権限（settings.json）

| 操作 | 扱い |
| --- | --- |
| `git diff` / `log` / `status` / `show` | 許可 |
| `git add` / `commit` / `push` / `switch`、`gh pr` | 確認付き（まーちゅうに頼まれたときだけガネーシャが行う） |
| `git checkout` / `merge` / `rebase` / `reset`、`gh pr merge` | 禁止 |

メジェドは git に書き込まない（mejed.md の禁止事項）。マージはまーちゅうが行う。

## 使い方

**タスクは1本ずつ回す。** 2本を同じ作業ツリーで並行すると、未コミットの変更が混ざる。

1. 計画：「<タスク名> の計画を立てて」→ ガネーシャが plan.md を書き（プランモードは使わない）、Fable に1回、続けて健さんに採る指摘が0になるまで壊しに来させて直す → まーちゅうが承認欄にチェック
2. 実装：「<タスク名> をメジェドに実装してもらって」→ ガネーシャが `feature/<タスク名>` を切ってメジェドを呼び、レビュー→修正を回す。チェックが2回以上落ちていたら健さんに「隠しただけか」を見させる。OK になったら PR の前に健さんの review を回し、片付いたら報告してくる
3. PR：「コミットして PR を出して」→ ガネーシャがコミット・push・PR 作成。マージはしない
4. PR のレビュー：「PR の指摘を見て」→ ガネーシャが検証して review.md に書き、コードの指摘はメジェドに直させ、スレッドに返信する（Copilot のレビューは1回だけ。再レビューを頼むかはまーちゅうが決める）
5. マージ：まーちゅう

### 作業の流れ（要約）

計画から PR までの細かい分かれ目（フローチャート）・言葉の決まり・回数の上限の**正本は [repo-files/docs/team/workflow.md](repo-files/docs/team/workflow.md)**。各リポジトリには `docs/team/workflow.md` として配る。スキル・メジェド・adversary は、作業の最初にこれを Read で読む。

- 計画：書いたら Fable（adversary・plan）に壊しに来させる（1つの計画につき1回）。その後は健さんに、採る指摘が0になるまで頼む（最大5回）
- 実装：メジェドの報告を受けるたびに、停止なら保留、「途中で2回以上落ちたチェック」があれば健さん（consult）
- PR の前：diff-reviewer が OK なら、健さんの review を、採る指摘が0になるまで回す（最大5回）。`/code-review` は頼まれたときだけ
- diff-reviewer の指摘による修正依頼は最大3回。PR に付いたレビューでの修正依頼は別に最大3回。上限に達したら保留して、まーちゅうに判断を頼む
- 承認をやり直したら、上限は数え直す（Fable は数え直さない）

## worktree で作業するとき

- worktree を作るのは gh-issue スキル（まーちゅうに頼まれたとき）だけ。置き場所はリポジトリの中の `.claude/worktrees/<名前>/`。plan-writer・delegate-to-mejed は worktree もブランチも作らない。使わないときは、今のまま（作業ツリーで `git switch -c`）
- パスは、どこでもリポジトリの根からの相対パスで書いて渡す（Git Bash の `/c/...` 形は Node.js と PowerShell で別のパスになるため）
- plan.md も review.md も worktree の中の `docs/tasks/<タスク名>/` に書く（メインのチェックアウトの未コミットのファイルは worktree から見えないため）
- git は `git -C <パス>`。ほかのコマンド（チェックコマンドなど）は `(cd <パス> && <コマンド>)`。健さんのラッパーは `-WorkingDirectory <パス>`（返事はメインのチェックアウトの `docs/tasks/<タスク名>/codex/` に残る）
- フックは `.claude/worktrees/<名前>/` の頭を剥がして、メインのチェックアウトと同じ判定をする。秘密情報の判定だけは、剥がす前のパスにも当てる
- settings.json の `deny` は先頭一致なので、`git -C <パス> reset --hard` は `Bash(git reset:*)` に当たらない。そこで ask に大域オプションで始まる git（`git -C`・`git -c`・`git --git-dir`・`git --work-tree`・`git --no-pager`）を足してある。**worktree での git は毎回確認が出る**（手間として受け入れる）。この柵は、うっかり別の書き方で打つのを止めるもの。`sh -c '...'` で包む・パスで git を呼ぶなど、わざと別の形にするものは防がない（サンドボックスの役目）

## 導入方法

1. `claude/` の中身をリポジトリの `.claude/` に重ねる（既存の `settings.json` があれば、内容を見比べて置き換える。`Edit(**/*.php)` のような Edit の禁止が残るとメジェドが実装できない）
2. `repo-files/docs/team/` をリポジトリの `docs/team/` に置き（common-rules.md・Ganesha.md・workflow.md の3つが入る）、`CLAUDE.md.snippet` の中身を `CLAUDE.md` の先頭に足す
3. `common-rules.md` の「チェックコマンド」を案件に合わせて書き換える
4. 案件に合わせて `guard-code-edit.mjs` の `SECRET_PATTERNS` を足す（`invoke-codex.ps1` の `$SecretPatterns` も同じにそろえる）
5. 健さん（Codex）を使うなら
   - Codex CLI を入れて、ログインする：`npm install -g @openai/codex` と `codex login`
   - `repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）に置く。既にあれば中身を見比べて合わせる
   - `docs/tasks/*/codex/` は健さんの返事の保存先で、Git に入れない（次の手順 6 の snippet に入っている）
6. `repo-files/gitignore.snippet` の行を、リポジトリの `.gitignore` に足す（健さんを使うかどうかに関係なく。`.claude/worktrees/` は worktree の置き場所）

## 導入後に確認すること

- **取り込みが効くか**：`/memory` を開き、Ganesha.md と common-rules.md が読み込まれているか確認する
- **フックが動くか**：ガネーシャに「inc/ の PHP を1行直して」と頼み、フックで止められるか確認する。次にメジェドに同じことを頼み、通るか確認する。ガネーシャがメモリに書けることも確かめる
- **Windows での実行**：フックは `node "$CLAUDE_PROJECT_DIR/..."` で呼んでいる。Windows でどのシェルが使われるかは公式ドキュメントに書かれていないが、Windows 11 の Claude Code（VS Code 拡張）では、この書き方のまま起動し、メインは止まり・`mejed` は通り・ほかのサブエージェント（`general-purpose`）は止まることを確かめた（2026-10-04・swx-inventory-hub）。止まらないときは `/hooks` で登録を確認し、コマンドをフルパスに書き換える
- **フックの単体確認**：フックに JSON を標準入力で渡して終了コードを見る（`CLAUDE_PROJECT_DIR` に仮のリポジトリのパスを入れる）。期待値は、メインの `src/a.js` が 2、メインの `docs/tasks/x/plan.md` が 0、`agent_type: mejed` の `src/a.js` が 0、`agent_type: mejed` の `.dev.vars` が 2、ほかのサブエージェントの `src/a.js` が 2、メインのメモリ（`~/.claude/projects/<p>/memory/`）が 0、リポジトリの外が 2、JSON でない入力が 2
- **Bash 経由の書き込みは止まらない**：`echo > file` や `sed -i` のようなシェル経由の書き込みは、このフックの対象外。
  **auto モードでは確認も出ない**ので、仕組みの上ではガネーシャも Bash でコードを書き換えられる。ここは Ganesha.md の禁止事項で縛っている。気づいたら止める
- **サブエージェントの権限モード**：メインが `acceptEdits` や `auto` で動いているときは、メジェドもそのモードで動く。フックは権限モードとは別の仕組みだけど、念のため `acceptEdits` でもガネーシャの編集が止まるか試す
- **秘密情報**：フックの `SECRET_PATTERNS` と settings.json の `Read(...)` の deny を、案件に応じて追加・削除する
