# AIチーム開発 スキル一式（下書き）

Claude Code だけで回す体制のスキル・チーム設定・権限設定。

- **ガネーシャ**（Claude Code のメイン）＝ 計画・メジェドへの実装依頼・レビュー・頼まれたときのコミットと PR・PR に付いた指摘の対応
- **メジェド**（サブエージェント `mejed`・既定は Haiku。plan.md で Sonnet を選べる）＝ 実装・指摘の修正
- **adversary**（サブエージェント `adversary`・Fable）＝ 壊しに来る役。計画の承認前に（レビューの道で選んだとき）、1つの計画につき1回だけ、計画書を壊す側から読んで指摘だけを返す。直さない
- **健さん**（Codex CLI・外部委託業者）＝ 読むだけの相談・レビューと、画像の生成。スキル `codex` から呼ぶ。実装は頼まない。承認前・チェックが2回以上落ちたとき・PR の前の確認の中心（いずれもレビューの道で選んだとき）
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
| `claude/agents/mejed.md` | メジェド | `.claude/agents/mejed.md`。キャラ・手順・報告の形式・禁止事項。モデルは Haiku（既定。plan.md の「メジェドのモデル」で Sonnet を選べる。呼ぶたびに model を明示して渡す） |
| `claude/agents/adversary.md` | adversary | `.claude/agents/adversary.md`。計画の問い・報告の形式・禁止事項。モデルは Fable |
| `claude/skills/plan-writer/` | ガネーシャ | `.claude/skills/plan-writer/`。承認を頼む前に、承認前の1つ目（Fable か `/code-review`）を1回、その後は2つ目（健さんか `/code-review`）を採る指摘が0になるまで呼ぶ（レビューの道） |
| `claude/skills/delegate-to-mejed/` | ガネーシャ | `.claude/skills/delegate-to-mejed/`。メジェドに実装を頼み、レビュー→修正を回す。PR の前にレビュー役（健さんの review か `/code-review`。レビューの道）を、採る指摘が0になるまで回す |
| `claude/skills/diff-reviewer/` | ガネーシャ | `.claude/skills/diff-reviewer/`。PR 前の差分レビューと、PR に付いた指摘の対応 |
| `claude/skills/codex/` | ガネーシャ・メジェド | `.claude/skills/codex/`。健さん（Codex CLI）に相談・レビュー・画像の生成を頼む。ラッパーは `scripts/invoke-codex.ps1`（Windows PowerShell） |
| `claude/skills/codex/scripts/test-invoke-codex.mjs` | ガネーシャ・メジェド | `.claude/skills/codex/scripts/test-invoke-codex.mjs`。ラッパーの review・make-patch の前の秘密情報の確かめと、make-patch のパッチの確認（`node .claude/skills/codex/scripts/test-invoke-codex.mjs`）。偽物の `codex` と仮の Git のリポジトリだけを使い、本物の健さんは呼ばない |
| `repo-files/codex/AGENTS.md` | 健さん | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲。同じ場所に `AGENTS.override.md` を置かない（そちらが優先される） |
| `claude/hooks/guard-code-edit.mjs` | 全員 | `.claude/hooks/guard-code-edit.mjs`。編集の直前に「誰が・どこを」編集するかを見て止める |
| `claude/hooks/ai-team-config.mjs` | 全員 | `.claude/hooks/ai-team-config.mjs`。ガードと健さんのラッパーが使う判定の部品（秘密情報の既定の一覧・`ai-team.json` の読み込みとグロブ）。リポジトリでは書き換えない |
| `claude/ai-team.json` | 全員 | `.claude/ai-team.json`。リポジトリごとの秘密情報のパターン（`secretPatterns`）と、ガネーシャが確認なしで編集できるパス（`plannerWritable`）の追加。ガードと健さんのラッパーが読む。既定の一覧に足すだけで、外すことはできない |
| `claude/hooks/test-guard-code-edit.mjs` | 全員 | `.claude/hooks/test-guard-code-edit.mjs`。フックの確かめ（`node .claude/hooks/test-guard-code-edit.mjs`）。フックに入力の JSON を流して終了コードを見る。git は呼ばない |
| `claude/settings.json` | 全員 | `.claude/settings.json`。フックの登録と、git・秘密情報の権限 |
| `repo-files/gitignore.snippet` | 全員 | 各リポジトリの `.gitignore` に足す行（`.claude/worktrees/`・`docs/tasks/*/codex/`） |

### `ai-team.json` の書き方

リポジトリごとの違いのうち、フックと健さんのラッパーが読むものは、`.claude/ai-team.json`（このリポジトリでは `claude/ai-team.json`）に書く。フックやラッパーのコードは書き換えない。

```json
{
	"secretPatterns": ["**/.wrangler/**"],
	"plannerWritable": ["data/*.json"]
}
```

- キーは `secretPatterns`（誰も編集できない・健さんも開かないパス）と `plannerWritable`（ガネーシャが確認なしで編集できるパス）の2つだけ。どちらもグロブの文字列の配列で、**既定の一覧に足すだけ**。既定の4つ（`.env*`・`.dev.vars`・`.kv/`・`wp-config.php`）は外せない
- グロブは、リポジトリの根からの相対パスに当てる。区切りは `/`、小文字で書く（Windows では、パスを小文字にそろえてから当てる）
- 記号は3つだけ。`**`（`/` をまたいで0文字以上）・`*`（`/` 以外の0文字以上）・`?`（`/` 以外の1文字）。ほかの文字は、`.` や `(` なども含めて、ただの文字
- `**/` は、先頭でも途中でも区切りごと省ける（0個以上のディレクトリ）。最後の `/**` も区切りごと省けて、そのもの自身とその中に当たる
- `\`・`[`・`]`・`{`・`}` を含むもの、空の文字列、`/` で始まるものは、壊れているものとして扱う
- 例：`**/.wrangler/**` は、根の直下も含めて、どの深さの `.wrangler` も、その中も当たる。`data/*.json` は `data/a.json` に当たり、`data/sub/a.json` には当たらない。`private/**/token.json` は `private/token.json` にも `private/a/b/token.json` にも当たる
- 壊れているとき（JSON として読めない・UTF-8 でない・知らないキー（大文字小文字も区別する）・配列や文字列でない・グロブが壊れている）、ガードは設定ファイル自体の編集（確認）を除いてすべての編集を止め、健さんのラッパーは健さんを呼ばずに止まる（保存だけのモード `save-code-review` を除く。codex に何も渡さないため）。黙って既定の一覧に戻ると、足したはずの秘密情報が守られなくなるため
- 設定ファイルか親の `.claude/` がリンク（シンボリックリンク・ジャンクション）で、リンク先が無いときも、「無い」とは扱わずに止める。このときは、設定ファイル自体の編集も止まるので、リンクを手で直す
- 設定ファイル自体の編集は、中身が壊れていても、`secretPatterns` が設定ファイル自体に当たっても、いつも確認（ask）で通す（直す道を残すため）。ただし、設定ファイルがリンクのときは、この例外を使わず、ふつうの判定をする（リンク先が秘密情報なら止まる）
- 文字コードは UTF-8 だけ（先頭の BOM は取り除く）。UTF-16・UTF-32 は壊れているものとして扱う

## ファイルの分け方

- **CLAUDE.md**：リポジトリの説明（構成、ビルド方法、テーマ・プラグイン情報など）。先頭で `@docs/team/Ganesha.md` を取り込む
- **docs/team/common-rules.md**：共通規約・チェックコマンド・レビューの観点・計画の書き方。ガネーシャは取り込みで、メジェドと adversary は作業の最初に Read で読む
- **docs/team/Ganesha.md**：ガネーシャの役割・キャラ設定・禁止事項
- **docs/team/workflow.md**：作業の流れの正本。取り込みには入れず、スキル・メジェド・adversary が作業の最初に Read で読む
- **.claude/agents/mejed.md**：メジェドの役割・キャラ設定・禁止事項（メジェドの定義はここだけ）
- **.claude/agents/adversary.md**：壊しに来る役の問い・報告の形式・禁止事項。キャラ設定は持たない
- **スキル**：計画・実装の依頼・レビューの手順とテンプレート
- **フック＋settings.json**：編集できる範囲と git の権限

## 編集できる範囲（フックで判定）

判定は上から順に当てて、当たったところで決まる。`.claude/worktrees/<名前>/` の頭は、剥がせなくなるまで繰り返し剥がしてから当てる（秘密情報だけは、剥がす前のパスにも当てる）。

| # | 当たるパス | ガネーシャ | メジェド（mejed） | ほかのサブエージェント |
| --- | --- | --- | --- | --- |
| 1 | `.claude/ai-team.json`（設定ファイル自体）。中身が壊れていても、`secretPatterns` が当たっても、誰も確認。ただし、設定ファイルがリンクのとき（リンク先があってもなくても）は、この行に当てず、下の行で判定する（リンク先が秘密情報なら×）。設定ファイルか親の `.claude/` がリンク切れのときは、この行も含めて全部止める（×） | 確認 | 確認 | 確認 |
| 2 | リポジトリの外（`~/.claude/projects/<p>/memory/`・`~/.claude/plans/`・`<一時ディレクトリ>/claude/` を除く） | × | × | × |
| 3 | 秘密情報（`.dev.vars`、`.kv/`、`wp-config.php`、`.env`。＋ `.claude/ai-team.json` で足したもの） | × | × | × |
| 4 | `.claude/` の下（ただし `.claude/worktrees/` の下は除く。頭を剥がした後のパスで判定する） | 確認 | 確認 | 確認 |
| 5 | `docs/team/` の下・リポジトリの根の `CLAUDE.md`（`Ganesha.md` を取り込む入口なので `docs/team/` と同じに守る） | 確認 | 確認 | 確認 |
| 6 | `docs/tasks/<タスク名>/plan.md` | ○ | × | ○ |
| 7 | `docs/tasks/` の下・Markdown（`.md`）・`.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` の下（＋ `.claude/ai-team.json` の `plannerWritable` で足したもの） | ○ | ○ | ○ |
| 8 | それ以外（コード） | × | ○ | × |

「確認」は、フックが `permissionDecision: "ask"` を返して、まーちゅうの確認を取る（理由は「チームの設定・規約なので、まーちゅうの確認を取る」）。

設定ファイルが壊れているときは、1 の行のほかは全部止まる。リンク切れのときは、1 の行も含めて全部止まるので、リンクを手で直す。設定ファイルがリンクのときは、1 の行は使わない。

- Markdown を通すのは「コード以外（.md）の PR レビューの指摘はガネーシャが直す」（Ganesha.md）ため
- adversary は tools に Edit / Write を持たないので、そもそもフックまで届かない。ファイルを書ける経路は Bash・PowerShell（リダイレクト・`sed -i`・`git stash` など）だけで、adversary.md の禁止事項で縛っている（Bash・PowerShell はフックの対象外）
- Windows のファイルシステムは大文字小文字を区別しないので、Windows ではパスを小文字にそろえてから照合する（`.DEV.VARS` も止まる）
- 判定は「指定されたパス」と「シンボリックリンク（ジャンクションを含む）をたどった実体のパス」の両方に当てる。リンク経由で秘密情報・コード・リポジトリの外を書き換えることはできない。2つの判定が違うときは、きつい方（止める > 確認 > 通す）を取る
- 4 は、メインのチェックアウトでは Claude Code の protected paths（`.claude/` の下への書き込みを自動では通さない仕組み）と重なる。`.claude/worktrees/` の下は protected paths の例外で守られないので、worktree の中の `.claude/`（スキル・エージェント・フック）を守るのが目的。auto モードで、フックの確認と protected paths の分類器のどちらが先に効くかは、確かめていない
- 5 は、共通規約・作業の流れ・Ganesha.md を、ガネーシャが確認なしで書き換えられないようにするため。6 は、メジェドが計画書を書き換えられないようにするため
- `.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` は、コードではない設定なので、ガネーシャが編集できる（各リポジトリへの反映で `.gitignore` に `.claude/worktrees/` を足すのに要る）
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
| `git pull` | 確認付き（`--ff-only` を付けないと merge コミットを作れて、`git merge` の禁止をすり抜けるため、許可には置かない。マージの後は `--ff-only` を付けて使う。確認のダイアログで `--ff-only` が付いているかを見られる） |
| `git stash` / `restore` / `clean` / `rm` / `worktree remove`、`git branch`（引数の有無を問わず全部） | 確認付き（コミット前の作業か、マージ前のブランチを消せるため。ブランチの削除は `-fD`・`-f -d`・`--force --delete` のように書き方がいくつもあってルールの形で潰しきれないので、`git branch` は全部確認にする。ブランチの名前は `git status` で分かる） |
| `git -C` / `-c` / `--git-dir` / `--work-tree` / `--no-pager` で始まる git | 確認付き（deny は先頭一致なので、大域オプションで始まると `git reset` などの禁止をすり抜けるため。「worktree で作業するとき」を参照） |
| `git checkout` / `merge` / `rebase` / `reset`、`gh pr merge` | 禁止 |

同じルールを、PowerShell ツールにも `PowerShell(...)` の形で付けている（Bash のルールは PowerShell ツールには効かないため。allow は PowerShell には足していない）。

メジェドは git に書き込まない（mejed.md の禁止事項）。マージはまーちゅうが行う。

### 直さないもの

| 項目 | 理由 |
| --- | --- |
| メジェドが review.md の指摘欄・判定欄を書き換えられる | フックはファイル単位でしか判定できず、メジェドは「対応」欄を書く必要がある。mejed.md の禁止事項で頼み、diff-reviewer が差分で見る |
| `.env.example` が読めない・編集できない | Read の deny には例外の書き方（`!` で始まるパターン）があるが、使わない。`.env.example` にうっかり本物の値を写してしまうことがあり、確かめずに読ませないため。読めない側に倒す。見せたいときは、まーちゅうが中身を確かめて貼る |
| データの JSON をガネーシャが編集できない | リポジトリごとに場所が違う。要るリポジトリで `.claude/ai-team.json` の `plannerWritable` に足す |
| Bash・PowerShell 経由の書き込みはフックに見えない | 編集のフックは Edit・Write などの編集ツールにだけ登録している（Claude Code のフックの仕組み）。「導入後に確認すること」を参照 |

## 使い方

**タスクは1本ずつ回す。** 2本を同じ作業ツリーで並行すると、未コミットの変更が混ざる。

1. 計画：「<タスク名> の計画を立てて」→ ガネーシャが plan.md を書き（プランモードは使わない）、計画を書き始めるときにレビューの道を聞かれ、承認前の1つ目（Fable か `/code-review`）に1回、続けて2つ目（健さんか `/code-review`）に採る指摘が0になるまで壊しに来させて直す → ガネーシャは plan.md を開ける形で渡し、要点をまとめて承認を頼む → まーちゅうが会話で承認する（承認欄の扱いは workflow.md の「承認欄」）
2. 実装：「<タスク名> をメジェドに実装してもらって」→ ガネーシャが plan.md の「ブランチ」欄のブランチを切ってメジェドを呼び、レビュー→修正を回す。チェックが2回以上落ちていたらレビュー役（健さんか `/code-review`）に「隠しただけか」を見させる。OK になったら PR の前にレビュー役（健さんの review か `/code-review`）を回し、片付いたら報告してくる
3. PR：「コミットして PR を出して」→ ガネーシャがコミット・push・PR 作成。マージはしない
4. PR のレビュー：「PR の指摘を見て」→ PR の指摘は `diff-reviewer` で受ける（ユーザー共通のレビュー用のスキルがあっても）。ガネーシャが検証して review.md に書き、コードの指摘はメジェドに直させ、スレッドに返信する（Copilot のレビューは1回だけ。再レビューを頼むかはまーちゅうが決める）。簡単な修正の道で作った PR は、`workflow.md` の「簡単な修正の道」に従う（review.md は作らない）
5. マージ：まーちゅう
6. マージの後：「マージした」→ ガネーシャが既定ブランチを origin に追いつかせる（`delegate-to-mejed` の「マージの後」）

小さな文書の直し（「この README の誤字を直して。簡単な修正の道で」のような頼み方）は、計画・メジェド・diff-reviewer を通さず、まーちゅうの OK を取ってガネーシャが直し、PR の前のレビュー役（健さんの review か `/code-review`）だけを通す。範囲と流れは [repo-files/docs/team/workflow.md](repo-files/docs/team/workflow.md) の「簡単な修正の道」を見る。

GitHub Projects のボードを使うなら、ユーザー側の手順で動かす（このテンプレートは持たない）。

### 作業の流れ（要約）

計画から PR までの細かい分かれ目（フローチャート）・言葉の決まり・回数の上限の**正本は [repo-files/docs/team/workflow.md](repo-files/docs/team/workflow.md)**。各リポジトリには `docs/team/workflow.md` として配る。スキル・メジェド・adversary は、作業の最初にこれを Read で読む。

- 計画：書いたら Fable（adversary・plan）に壊しに来させる（1つの計画につき1回）。その後は健さんに、採る指摘が0になるまで頼む（最大5回）（レビューの道で、Fable の代わりに `/code-review` を1回、健さんの代わりに `/code-review` を最大5回にできる）
- 実装：メジェドの報告を受けるたびに、停止なら保留、「途中で2回以上落ちたチェック」があればレビュー役（健さんの consult か `/code-review`。PR の前の道に合わせる）
- PR の前：diff-reviewer が OK なら、レビュー役（健さんの review か `/code-review`。レビューの道）を、採る指摘が0になるまで回す（最大5回）。画像のタスクでは、その後にまーちゅうが画像を目で見る
- diff-reviewer の指摘による修正依頼は最大3回。PR に付いたレビューでの修正依頼は別に最大3回。上限に達したら保留して、まーちゅうに判断を頼む
- 承認をやり直したら、上限は数え直す（承認前の1つ目は数え直さない）
- 簡単な修正：まーちゅうの OK で、ガネーシャが直して PR の前のレビュー役（健さんの review か `/code-review`）だけを通す（範囲は workflow.md）

## worktree で作業するとき

- worktree を作るのは gh-issue スキル（まーちゅうに頼まれたとき）だけ。置き場所はリポジトリの中の `.claude/worktrees/<名前>/`。plan-writer・delegate-to-mejed は worktree もブランチも作らない。使わないときは、今のまま（作業ツリーで `git switch -c`）
- worktree のパス（`.claude/worktrees/<名前>`）は、メジェド・健さん・スキルどうしで渡すとき、リポジトリの根からの相対パスで書く（まーちゅうへの返事のパスは、plan-writer の手順7のとおり。Git Bash の `/c/...` 形は Node.js と PowerShell で別のパスになるため）
- plan.md も review.md も worktree の中の `docs/tasks/<タスク名>/` に書く（メインのチェックアウトの未コミットのファイルは worktree から見えないため）
- git は `git -C <パス>`。ほかのコマンド（チェックコマンドなど）は `(cd <パス> && <コマンド>)`。健さんのラッパーは `-WorkingDirectory <パス>`（返事はメインのチェックアウトの `docs/tasks/<タスク名>/codex/` に残る。そこが Git に無視されていなければ、一時ディレクトリに残る。codex スキルの「ラッパーがしてくれること」）
- フックは `.claude/worktrees/<名前>/` の頭を剥がして、メインのチェックアウトと同じ判定をする。秘密情報の判定だけは、剥がす前のパスにも当てる
- settings.json の `deny` は先頭一致なので、`git -C <パス> reset --hard` は `Bash(git reset:*)` に当たらない。そこで ask に大域オプションで始まる git（`git -C`・`git -c`・`git --git-dir`・`git --work-tree`・`git --no-pager`）を足してある。**worktree での git は毎回確認が出る**（手間として受け入れる）。この柵は、うっかり別の書き方で打つのを止めるもの。`sh -c '...'` で包む・パスで git を呼ぶなど、わざと別の形にするものは防がない（サンドボックスの役目）

## 導入方法

1. テンプレートの写す版を先に決める。最初にテンプレートを `git -C <テンプレート> fetch origin` し、`origin/main` のコミットを写す版として書き留める。その版の中身（`git show` などで読む）から写す。詳しいやり方は「テンプレートを直した後の反映」の「写す版を決める」を参照（作業の途中でテンプレートが進んでも、その版のまま反映するため）
2. `claude/` の中身をリポジトリの `.claude/` に重ねる（既存の `settings.json` があれば、内容を見比べて置き換える。`Edit(**/*.php)` のような Edit の禁止が残るとメジェドが実装できない。既存の `ai-team.json` があれば、足したパターンを消さないよう、中身を残す）
3. `repo-files/docs/team/` をリポジトリの `docs/team/` に置き（common-rules.md・Ganesha.md・workflow.md の3つが入る）、`CLAUDE.md.snippet` の中身を `CLAUDE.md` の先頭に足す
4. `common-rules.md` の「チェックコマンド」を案件に合わせて書き換える。同じ common-rules.md の「レビューの観点」と「計画の書き方」も、案件に合わせて書き換える。チェックの前に要る依存のインストール（`composer install`・`npm ci` など）は、リポジトリごとに settings.json の allow に足す
5. 案件に合わせて `.claude/ai-team.json` の `secretPatterns` に足す（フックとラッパーはこれを読む。settings.json の `Read(...)` の deny・common-rules.md の秘密情報の箇条も、同じにそろえる。健さんの AGENTS.md は、読むリポジトリの設定ファイルを見るので直さなくてよい）
6. 健さん（Codex）を使うなら
   - Codex CLI を入れて、ログインする：`npm install -g @openai/codex` と `codex login`
   - `repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）に置く。既にあれば中身を見比べて合わせる
   - `docs/tasks/*/codex/` は健さんの返事の保存先で、Git に入れない（次の手順 7 の snippet に入っている）
7. `repo-files/gitignore.snippet` の行を、リポジトリの `.gitignore` に足す（健さんを使うかどうかに関係なく。`.claude/worktrees/` は worktree の置き場所。`docs/tasks/*/code-review/` は `/code-review` の結果の保存先）
8. 導入の PR を作るときは、PR の題名に、写した版を「（ai-team-skills <版>）」の形で書く（次の反映の始まりになる）

## テンプレートを直した後の反映

テンプレートに直しが入ったときは、各リポジトリのセッションで反映させる。そのリポジトリのフックと権限が効くため。頼み方の例：「rocket-martue/ai-team-skills の最新を反映して」（反映のイシューがあれば、その番号も）。

### 前回の版を探す

前回の**全体の反映**の PR の題名に書いた版。その後に、部分的な反映（一部のファイルだけを先に入れたもの）や反映先での戻しがあれば、差分に出てくるので、中身で見比べる。

### 写す版を決める

1. テンプレートを `git -C <テンプレート> fetch origin` する
2. `origin/main` のコミットを写す版として plan.md に書いて固定する（計画・実装・PR の題名で版をそろえるため）
3. 作業の途中でテンプレートが進んでも、その版のまま反映する
4. その版の中身は、`git -C <テンプレート> show <写す版>:<パス>` や、その版を指定した `git diff` で読む。テンプレートのチェックアウトのファイルからは写さない（`fetch` だけでは作業ツリーが古いままで、記録した版と中身がずれるため）

### 差分を見る

テンプレートの `git log <前回の版>..<写す版>` と `git diff <前回の版> <写す版>` を、次の範囲に絞って見る：
- `claude/`
- `repo-files/docs/team/`
- `repo-files/gitignore.snippet`
- `repo-files/CLAUDE.md.snippet`
- `repo-files/codex/AGENTS.md`

置き場所の対応は「導入方法」のとおり（`claude/` → `.claude/`、`repo-files/docs/team/` → `docs/team/`）。

前回の版が分からないとき（前回の全体の反映の PR の題名に版が無いなど）は、差分ではなく、写す版のファイル全体と、そのリポジトリのファイルを見比べる（最初の導入と同じ）。

### 取り入れるかを決める

変更ごとに、そのリポジトリの固有の上書き（チェックコマンド・`.claude/ai-team.json`・レビューの観点・plan.md の雛形・settings.json の allow など）と見比べて、取り入れるかを決める。取り入れないものは、PR 本文の「残したもの」に理由を書く。テンプレートが持たないもの（ボードの Status など）を使っているなら、固有の上書きとして残してよい。

### 残すものが消えていないかを確かめる

計画の完了条件に、残すもの（固有の上書き）が消えていないかの確かめを入れる。「テンプレートとの違いが、残すものの範囲に収まっている」だけでは、残すものを丸ごと消しても通ってしまう（違いが減るだけで、範囲の外には出ないため）。確かめ方は、ファイルの直し方で選ぶ：

- 固有の上書きがあるファイルに、直しの行を足すだけのとき：今の main との違い（`git diff main`）が足した行だけで、削除の行が無いこと。足した行が、写す版の該当の行と一字一句同じこと
- テンプレートの版にそのまま置き換えるとき：置き換える前に、今の main と写す版の違いが、前回の版からのテンプレートの直しだけ（固有の上書きが無い）だと確かめる
- 固有の上書きがあるファイルを、テンプレートの版をもとに書き直すとき（差分が大きいときなど）：書き直した後、残すものの全項目が、変更前の main（`git show main:<パス>`）と同じ中身で残っていることを、項目ごとに照らす

「テンプレートとの違いが、前回の反映の後と同じ」で比べる形は使わない。テンプレートが反映先に追いついた分（反映先から戻した直しなど）があると、計画どおりでも違いが変わるため。

### テンプレートに戻す

反映先で足した直しのうち、どのリポジトリにも効きそうなものは、テンプレートのイシューに書く（テンプレートに戻すため）。

### 流れ

ふつうのタスクと同じ（plan-writer → メジェド → diff-reviewer → PR の前のレビュー役 → PR）。ただし、テンプレートでレビュー済みの変更を写すのが中心なので、承認前の1つ目は省く（レビューの道の1つ目に「省く（反映）」と書く）。ほかは workflow.md どおり（承認前の2つ目（健さんの consult か `/code-review`。レビューの道）、チェックが2回以上落ちたとき・PR の前のレビュー役（健さんか `/code-review`））。まーちゅうに頼まれたら1つ目も回す。

- 反映のセッションでは、スキル・メジェドの定義は変える前のまま動く（`.claude/` はセッションの開始時に読まれるため）。反映で mejed.md の報告の形式を変えても、そのセッションのメジェドの報告は前の形式で返ってくるので、前の版で受ける
- `.claude/settings.json` が変わる反映では、最初から auto モードを外しておく。auto モードだと、メジェドが settings.json を書き換えるのが権限の分類器に Self-Modification で拒否され、確認のダイアログも出ない

### PR の題名

全体の反映の PR の題名に、写した版を「（ai-team-skills <版>）」の形で書く（次の反映の始まりになる）。部分的な反映では、題名にこの形を書かない（次の反映の始まりと取り違えないため）。版は本文に書く。

### AGENTS.md の扱い

`repo-files/codex/AGENTS.md` が変わっていたら、PR の「マージの後」にその差分を書いて伝える。各 PC の `<CODEX_HOME>/AGENTS.md` は、まーちゅうの許可を得てから、見比べて合わせる（リポジトリの外。個人の設定を上書きしないため。「導入方法」の6と同じ）。

### マージの後

そのリポジトリのメインのチェックアウトを追いつかせ、そのリポジトリのウィンドウを再読み込みする（`.claude/` はセッションの開始時に読まれるため）。

## 導入後に確認すること

- **取り込みが効くか**：`/memory` を開き、Ganesha.md と common-rules.md が読み込まれているか確認する
- **フックが動くか**：ガネーシャに「inc/ の PHP を1行直して」と頼み、フックで止められるか確認する。次にメジェドに同じことを頼み、通るか確認する。ガネーシャがメモリに書けることも確かめる
- **Windows での実行**：フックは、シェルを通さない書き方（`"command": "node"` と `"args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-code-edit.mjs"]`）で登録している。Git Bash が無い Windows では、シェル形のコマンドが PowerShell で動いて `$CLAUDE_PROJECT_DIR` が空になり、フックが起動しないまま編集が通るため（起動できないフックは止める側に倒れない。公式ドキュメント hooks の「Exec form and shell form」）。止まらないときは `/hooks` で登録を確認する
- **フックの単体確認**：フックに JSON を標準入力で渡して終了コードを見る（`CLAUDE_PROJECT_DIR` に仮のリポジトリのパスを入れる）。期待値は、メインの `src/a.js` が 2、メインの `docs/tasks/x/plan.md` が 0、`agent_type: mejed` の `src/a.js` が 0、`agent_type: mejed` の `.dev.vars` が 2、ほかのサブエージェントの `src/a.js` が 2、メインのメモリ（`~/.claude/projects/<p>/memory/`）が 0、リポジトリの外が 2、JSON でない入力が 2。`.claude/` の下と `docs/team/` の下は終了コード 0 で、標準出力の JSON に `permissionDecision: "ask"` が入る
- **Bash・PowerShell 経由の書き込みは止まらない**：`echo > file` や `sed -i`、PowerShell の `Set-Content` のようなシェル経由の書き込みは、このフックの対象外。
  **auto モードでは確認も出ない**ので、仕組みの上ではガネーシャも Bash・PowerShell でコードを書き換えられる。ここは Ganesha.md の禁止事項で縛っている。気づいたら止める
- **サブエージェントの権限モード**：メインが `acceptEdits` や `auto` で動いているときは、メジェドもそのモードで動く。フックは権限モードとは別の仕組みだけど、念のため `acceptEdits` でもガネーシャの編集が止まるか試す
- **秘密情報**：案件に応じて、パターンを追加する（`.claude/ai-team.json` の `secretPatterns`・settings.json の `Read(...)` の deny・common-rules.md の秘密情報の箇条を、同じにそろえる。既定の4つは `ai-team-config.mjs` の `SECRET_PATTERNS` にあり、設定ファイルでは外せない。健さんの AGENTS.md は、読むリポジトリの設定ファイルを見るので直さなくてよい）
