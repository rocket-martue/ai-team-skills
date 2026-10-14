# AIチーム開発 スキル一式

Claude Code だけで回す体制のスキル・チーム設定・権限設定。共通のもの（スキル・エージェント・フック・作業の流れ・チーム共通の決まり）は Claude Code のプラグイン `ai-team` として配り、各リポジトリには固有の設定と決まりだけを置く。

| 名前 | 役 | 中身 |
| --- | --- | --- |
| ガネーシャ | 計画・メジェドへの実装依頼・レビュー・頼まれたときのコミットと PR・PR に付いた指摘の対応・まーちゅうの指示があったときの小さなコードの直し | Claude Code のメイン |
| メジェド | 実装・指摘の修正 | サブエージェント `ai-team:mejed`（既定は Haiku。plan.md で Sonnet を選べる） |
| 健さん | 読むだけの相談・レビューと、画像の生成。実装は頼まない。計画・チェックが2回以上落ちたとき・PR の前の確認の中心（いずれもレビューの道で選んだとき） | Codex CLI（外部委託業者）。スキル `codex` から呼ぶ |
| Fさん | 壊しに来る役。計画の承認を頼む前と PR の前に（レビューの道で選んだとき）、1つの承認依頼につき1回ずつ、壊す側から読んで指摘だけを返す。直さない | サブエージェント `ai-team:adversary`（Fable） |
| 純ちゃん | 計画書や差分を読んで指摘を返すレビュー（レビューの道で選んだとき（計画・PR の前・チェックが2回以上落ちたとき）と、まーちゅうに頼まれたとき）。直させない | スキル `code-review`（コマンド `/code-review`） |
| まーちゅう | 要件決定・計画の承認・最終確認・マージ | 人 |

流れの一言：計画を書いたら、選んだレビュー役（Fさん・健さん・純ちゃん）が穴を探し、メジェドが実装して、PR の前に Fさん（選んだとき）と、健さんか純ちゃんが見る（誰を呼ぶかはレビューの道で選ぶ）。

> 以前は Codex をメジェドにしていたが、2つのツールの行き来（セッションの切り替え・進捗をリモートで見られない）の手間が大きかったので、
> サブエージェントだけにした（2026-10-04）。

## 前提

- 対象は、日本語で進める WordPress（PHP、phpcs）の案件。ほかの技術スタックで使うときは、リポジトリの `docs/team/common-rules.md` のチェックコマンドとレビューの観点、`.claude/settings.json` の allow を書き換える
- フックに Node.js が要る。node が PATH に無いと、フックは何も言わずに外れる（止めない）
- プラグインと、フックの入力に `agent_id`／`agent_type` が入る版の Claude Code が要る
- 健さん（Codex CLI）は使わなくても回る。使うときのラッパーは Windows PowerShell 用
- この README に出てくる gh-issue・gh-flow などの gh-* スキルは、ユーザー側に置くもので、このリポジトリには入っていない（無くても ai-team の流れは動く）

## 中身と置き場所

このリポジトリは、Claude Code のマーケットプレイス `ai-team-skills`（根の `.claude-plugin/marketplace.json`）で、プラグイン `ai-team`（`plugins/ai-team/`）を配る。共通のものはプラグインに入り、リポジトリごとに違うもの（設定・固有の規約）は `repo-files/` から各リポジトリに写す。`docs/tasks/` は、このリポジトリ自体の作業記録で、テンプレートには含まない（プラグインにも `repo-files/` にも入らない）。

### プラグイン（`plugins/ai-team/`）

プラグインを入れると、各リポジトリの `.claude/` に写さなくても、Claude Code が `<ユーザーのホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/` から読む。版は `plugin.json` に書かず、コミットの SHA で追う。

| ファイル | 担当 | 中身 |
| --- | --- | --- |
| `plugins/ai-team/docs/team-rules.md` | 全員 | チーム共通の決まり（言語・作業の進め方・チームの表・健さんに頼むときの決まり）。ガネーシャにはセッションの始めに SessionStart フックで入る。メジェドと adversary は作業の最初に Read で読む |
| `plugins/ai-team/docs/workflow.md` | 全員 | 作業の流れ（フローチャート・言葉の決まり・回数の上限）の正本。いつも入れず、スキル・メジェド・adversary が作業の最初に Read で読む。場所は、SessionStart で入る頭の行に書いてある |
| `plugins/ai-team/agents/mejed.md` | メジェド | キャラ・手順・報告の形式・禁止事項。モデルは Haiku（既定。plan.md の「メジェドのモデル」で Sonnet を選べる。呼ぶたびに model を明示して渡す）。呼ぶときの名前は `ai-team:mejed` |
| `plugins/ai-team/agents/adversary.md` | adversary | 計画と PR の前の差分の問い・報告の形式・禁止事項。モデルは Fable。呼ぶときの名前は `ai-team:adversary` |
| `plugins/ai-team/skills/plan-writer/` | ガネーシャ | 承認を頼む前に、レビューの道で選んだレビュー役（Fable・健さん・`/code-review`）を1回ずつ呼ぶ |
| `plugins/ai-team/skills/delegate-to-mejed/` | ガネーシャ | メジェドに実装を頼み、レビュー→修正を回す。PR の前の確認（レビューの道）を、採る指摘が0になるまで回す |
| `plugins/ai-team/skills/diff-reviewer/` | ガネーシャ | PR 前の差分レビューと、PR に付いた指摘の対応 |
| `plugins/ai-team/skills/codex/` | ガネーシャ・メジェド | 健さん（Codex CLI）に相談・レビュー・画像の生成を頼む。ラッパーは `scripts/invoke-codex.ps1`（Windows PowerShell） |
| `plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` | ガネーシャ・メジェド | ラッパーの review・make-patch の前の秘密情報の確かめと、make-patch のパッチの確認。偽物の `codex` と仮の Git のリポジトリだけを使い、本物の健さんは呼ばない |
| `plugins/ai-team/hooks/hooks.json` | 全員 | フックの登録。PreToolUse（編集のガード）、SessionStart（チーム共通の決まりを入れる）、UserPromptSubmit・SessionEnd・SessionStart の matcher `resume`（直接コードの印を付ける・消す） |
| `plugins/ai-team/hooks/guard-code-edit.mjs` | 全員 | 編集の直前に「誰が・どこを」編集するかを見て止める |
| `plugins/ai-team/hooks/session-start.mjs` | 全員 | `docs/team-rules.md` を、セッションの始めにメインのエージェントの文脈へ入れる。読めないとき・1万文字を超えるときは、Read を促す文を入れる（セッションは止めない） |
| `plugins/ai-team/hooks/direct-edit-mark.mjs` | 全員 | まーちゅうのメッセージの決まった言い方を見て、セッションごとの「直接コード」の印を付ける・消す（UserPromptSubmit・SessionEnd・SessionStart の `resume`）。印があるセッションのガネーシャは、簡単な修正の道の範囲でコードを直せる |
| `plugins/ai-team/hooks/ai-team-config.mjs` | 全員 | ガードと健さんのラッパーと印のフックが使う判定の部品（秘密情報の既定の一覧・`ai-team.json` の読み込みとグロブ・印の置き場所と読み方）。リポジトリでは書き換えない |
| `plugins/ai-team/hooks/test-guard-code-edit.mjs`・`test-session-start.mjs`・`test-direct-edit-mark.mjs` | 全員 | フックの確かめ。フックに入力の JSON を流して終了コードを見る。git は呼ばない（ガードの確かめは、テンプレートのリポジトリでだけ打つ） |

### リポジトリ側（`repo-files/` の中身を写す）

| ファイル | 担当 | 置き場所 |
| --- | --- | --- |
| `repo-files/docs/team/common-rules.md` | 共通 | リポジトリの `docs/team/common-rules.md`。このリポジトリ固有の決まり（コーディング・チェックコマンド・レビューの観点・計画の書き方）。ガネーシャは取り込みで、メジェドと adversary は作業の最初に Read で読む |
| `repo-files/docs/team/Ganesha.md` | ガネーシャ | リポジトリの `docs/team/Ganesha.md` |
| `repo-files/CLAUDE.md.snippet` | ガネーシャ | 中身を `CLAUDE.md` の先頭に追記 |
| `repo-files/claude/settings.json` | 全員 | `.claude/settings.json`。git・秘密情報の権限と、健さんのラッパーの allow（プラグインのフックは `hooks.json` にあるので、ここには無い） |
| `repo-files/claude/ai-team.json` | 全員 | `.claude/ai-team.json`。リポジトリごとの秘密情報のパターン（`secretPatterns`）と、ガネーシャが確認なしで編集できるパス（`plannerWritable`）の追加。ガードと健さんのラッパーが読む。既定の一覧に足すだけで、外すことはできない |
| `repo-files/codex/AGENTS.md` | 健さん | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲。同じ場所に `AGENTS.override.md` を置かない（そちらが優先される） |
| `repo-files/gitignore.snippet` | 全員 | 各リポジトリの `.gitignore` に足す行（`.claude/worktrees/`・`docs/tasks/*/codex/`・`docs/tasks/*/code-review/`） |

### このリポジトリで打つチェックコマンド

テンプレートのリポジトリの根で打つ。全部は打たない。触ったファイルに当たるものだけ打つ（`.md` だけの直しなら、打つものは無い）。

| 触ったもの | 打つもの |
| --- | --- |
| `repo-files/claude/settings.json`・`plugins/ai-team/hooks/guard-code-edit.mjs`・`hooks/ai-team-config.mjs`・`hooks/hooks.json` | `node plugins/ai-team/hooks/test-guard-code-edit.mjs` |
| `plugins/ai-team/hooks/session-start.mjs`・`plugins/ai-team/docs/team-rules.md`（1万文字の上限） | `node plugins/ai-team/hooks/test-session-start.mjs` |
| `plugins/ai-team/hooks/direct-edit-mark.mjs`・`hooks/ai-team-config.mjs` | `node plugins/ai-team/hooks/test-direct-edit-mark.mjs` |
| `plugins/ai-team/skills/codex/scripts/`・`hooks/ai-team-config.mjs` | `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` |
| `.claude-plugin/`・`plugins/ai-team/.claude-plugin/`・スキルやエージェントの追加・名前の変更 | `claude plugin validate .` と `claude plugin validate plugins/ai-team` |

- `claude plugin validate` は、マーケットプレイスとプラグインの形を確かめる。`--strict` は付けない（`version` を書かないので、`--strict` では必ず失敗する）。終了コード 0 で、出ている警告が `version` が無いことだけであること。`claude` が PATH に無ければ、VS Code の拡張の `claude.exe` を使う
- `claude -p --settings <ファイル>` で試すときは、`enabledPlugins` を含む設定を渡さない（そのプラグインが user スコープに自動で入る）。試しの後は `installed_plugins.json` に user の記録が増えていないか見る
- `claude -p` で allow を試すときは、信頼していないリポジトリでは `.claude/settings.json` の allow が無視される（「Ignoring N permissions.allow entries from .claude/settings.json: this workspace has not been trusted」と出る）。`--settings` で渡した allow は信頼と関係なく効くので、`--settings` で通っても、そのリポジトリの VS Code のセッションで allow が効くとは言えない（#57）。VS Code のセッションでの確かめ方は「導入後に確認すること」の「allow が効くか」

### `ai-team.json` の書き方

リポジトリごとの違いのうち、フックと健さんのラッパーが読むものは、`.claude/ai-team.json`（テンプレートのリポジトリでは `repo-files/claude/ai-team.json`）に書く。フックやラッパーのコードは書き換えない。

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
- **docs/team/common-rules.md**：このリポジトリ固有の決まり（コーディング・チェックコマンド・レビューの観点・計画の書き方）。ガネーシャは取り込みで、メジェドと adversary は作業の最初に Read で読む
- **docs/team/Ganesha.md**：ガネーシャの役割・キャラ設定・禁止事項
- **プラグインの docs/team-rules.md**：チーム共通の決まり。ガネーシャにはセッションの始めにフックで入り、メジェドと adversary は作業の最初に Read で読む
- **プラグインの docs/workflow.md**：作業の流れの正本。取り込みには入れず、スキル・メジェド・adversary が作業の最初に Read で読む
- **プラグインの agents/mejed.md**：メジェドの役割・キャラ設定・禁止事項（メジェドの定義はここだけ）
- **プラグインの agents/adversary.md**：壊しに来る役の問い・報告の形式・禁止事項。キャラ設定は持たない
- **スキル**：計画・実装の依頼・レビューの手順とテンプレート（プラグインの中）
- **フック（プラグインの hooks/hooks.json）＋ settings.json**：編集できる範囲はフック、git の権限は settings.json

## 編集できる範囲（フックで判定）

判定は上から順に当てて、当たったところで決まる。`.claude/worktrees/<名前>/` の頭は、剥がせなくなるまで繰り返し剥がしてから当てる（秘密情報だけは、剥がす前のパスにも当てる）。

| # | 当たるパス | ガネーシャ | メジェド（mejed・ai-team:mejed） | ほかのサブエージェント |
| --- | --- | --- | --- | --- |
| 1 | `.claude/ai-team.json`（設定ファイル自体）。中身が壊れていても、`secretPatterns` が当たっても、誰も確認。ただし、設定ファイルがリンクのとき（リンク先があってもなくても）は、この行に当てず、下の行で判定する（リンク先が秘密情報なら×）。設定ファイルか親の `.claude/` がリンク切れのときは、この行も含めて全部止める（×） | 確認 | 確認 | 確認 |
| 2 | リポジトリの外（`~/.claude/projects/<p>/memory/`・`~/.claude/plans/`・`<一時ディレクトリ>/claude/` を除く） | × | × | × |
| 3 | 秘密情報（`.dev.vars`、`.kv/`、`wp-config.php`、`.env`。＋ `.claude/ai-team.json` で足したもの） | × | × | × |
| 4 | `.claude/` の下（ただし `.claude/worktrees/` の下は除く。頭を剥がした後のパスで判定する） | 確認 | 確認 | 確認 |
| 5 | `docs/team/` の下・リポジトリの根の `CLAUDE.md`（`Ganesha.md` を取り込む入口なので `docs/team/` と同じに守る） | 確認 | 確認 | 確認 |
| 6 | `docs/tasks/<タスク名>/plan.md` | ○ | × | ○ |
| 7 | `docs/tasks/` の下・Markdown（`.md`）・`.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` の下（＋ `.claude/ai-team.json` の `plannerWritable` で足したもの） | ○ | ○ | ○ |
| 8 | それ以外（コード） | ×（まーちゅうの指示の印があるセッションでは○） | ○ | × |

**直接コードの印**（行 8 をガネーシャに通すしるし）：
- 置き場所は `<一時ディレクトリ>/ai-team-direct-edit/<session_id>`（セッションごと。中身は `{"createdAt": <ミリ秒>}`）。印のフック（`direct-edit-mark.mjs`）が、まーちゅうのメッセージに付ける言い方（「ガネーシャが直接コード書いて」「ガネーシャが直接直して」。空白は無視する。ほかの言い方は拾わない）があったときに付け、ガードが、メインのエージェントで、そのセッションの印が有効（24時間以内）のときだけ行 8 を通す。ほかのサブエージェントは印があっても×
- 消す言い方は「直接書くのはおしまい」。セッションの終わり・再開でも消える。24時間で切れる（切れると、ガードの止める理由にそう出る）
- まーちゅう以外が送ったと分かる書き出し（`Another Claude session sent a message`・`<agent-message`・`<task-notification`・`<system-reminder`）のメッセージでは付かない。知らない書き出しでは付きうる（フックは柵で、壁ではない）
- 印の置き場所への編集は、誰でも止める。印のファイルかディレクトリがリンク、ハードリンクが2つ以上ある印は、無いものとして扱う
- 範囲と流れは [plugins/ai-team/docs/workflow.md](plugins/ai-team/docs/workflow.md) の「簡単な修正の道」

「確認」は、フックが `permissionDecision: "ask"` を返して、まーちゅうの確認を取る（理由は「チームの設定・規約なので、まーちゅうの確認を取る」）。

設定ファイルが壊れているときは、1 の行のほかは全部止まる。リンク切れのときは、1 の行も含めて全部止まるので、リンクを手で直す。設定ファイルがリンクのときは、1 の行は使わない。

- Markdown を通すのは「コード以外（.md）の PR レビューの指摘はガネーシャが直す」（Ganesha.md）ため
- adversary は tools に Edit / Write を持たないので、そもそもフックまで届かない。ファイルを書ける経路は Bash・PowerShell（リダイレクト・`sed -i`・`git stash` など）だけで、adversary.md の禁止事項で縛っている（Bash・PowerShell はフックの対象外）
- Windows のファイルシステムは大文字小文字を区別しないので、Windows ではパスを小文字にそろえてから照合する（`.DEV.VARS` も止まる）
- 判定は「指定されたパス」と「シンボリックリンク（ジャンクションを含む）をたどった実体のパス」の両方に当てる。リンク経由で秘密情報・コード・リポジトリの外を書き換えることはできない。2つの判定が違うときは、きつい方（止める > 確認 > 通す）を取る
- 4 は、メインのチェックアウトでは Claude Code の protected paths（`.claude/` の下への書き込みを自動では通さない仕組み）と重なる。`.claude/worktrees/` の下は protected paths の例外で守られないので、worktree の中の `.claude/`（スキル・エージェント・フック）を守るのが目的。auto モードで、フックの確認と protected paths の分類器のどちらが先に効くかは、確かめていない
- 5 は、固有の規約・Ganesha.md を、ガネーシャが確認なしで書き換えられないようにするため（チーム共通の決まりと作業の流れはプラグインにあり、リポジトリの外のキャッシュなので、リポジトリの編集の判定には当たらない）。6 は、メジェドが計画書を書き換えられないようにするため
- `.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` は、コードではない設定なので、ガネーシャが編集できる（各リポジトリへの反映で `.gitignore` に `.claude/worktrees/` を足すのに要る）
- `~/.claude/` は丸ごと通さない。ユーザー共通の settings.json・CLAUDE.md・スキル・認証情報が入っているので、メモリと計画ファイルの2か所だけにする

- settings.json の `Edit(**/*.php)` のような禁止ルールはサブエージェントにも効いてしまい、メジェドが実装できなくなる。
  そのため編集の制限は settings.json ではなくフックで行う（フックの入力に含まれる `agent_id`／`agent_type` で呼び出し元を見分ける。メインのときは両方とも入らない）
- リポジトリの外で通すのは、Claude Code 自身の置き場所（メモリ・プランモードの計画ファイル・scratchpad）だけ
- 秘密情報のパターンは先頭で固定していないので、`.claude/worktrees/<名前>/.dev.vars` のような入れ子でも止まる

## git の権限（settings.json）

| 操作 | 扱い |
| --- | --- |
| `git diff` / `log` / `status` / `show`、`git fetch origin`、`git remote get-url`、`gh repo view`、`gh pr list`（`ls`） / `view` / `diff` / `checks` / `status`（読むだけ） | 許可（allow） |
| `git checkout` / `merge` / `rebase` / `reset`、`gh pr merge` | 禁止（deny） |
| それ以外（`git add` / `commit` / `push` / `switch` / `pull` / `branch` / `stash` / `clean`、`gh pr create` など） | 決まりを置かない。Manual では確認が出る。Auto では判定器が見る |

ask は置かない。Manual では、どの決まりにも当たらないコマンドは確認が出るので、ask を足しても変わらない。Auto では、ask は確認を出させるが、書き込む git や `gh pr` を1つずつ並べる決まりは漏れやすく、直すたびに各リポジトリへの反映が要っていた。止めなければならないもの（マージ・履歴の書き換え）は deny に置き、コミット・push・PR は「頼まれたときだけ」（Ganesha.md）で守る。

- Auto では、`git push`・`gh pr create`・`git branch -D`・`git clean` などが確認なしで通りうる（判定器が止めることもある）。PR を作っても、マージは deny なのでガネーシャはできない
- deny は先頭一致なので、`git -C <パス> reset --hard` のように大域オプションで始まると `Bash(git reset:*)` に当たらない。Manual では確認が出る。Auto では判定器が見る

同じルールを、PowerShell ツールにも `PowerShell(...)` の形で付けている（Bash のルールは PowerShell ツールには効かないため。allow は、読むだけの `gh pr`（別名の `ls` を入れて6つ）と `git remote get-url` だけ PowerShell にも足していて、ほかの allow は Bash にだけ置いている）。

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

1. 計画：「<タスク名> の計画を立てて」→ ガネーシャが plan.md を書き（プランモードは使わない）、計画を書き始めるときにレビューの道を聞かれ、選んだレビュー役（Fable・健さん・`/code-review`）に1回ずつ壊しに来させて直す → ガネーシャは plan.md を開ける形で渡し、要点をまとめて承認を頼む → まーちゅうが会話で承認する（承認欄の扱いは workflow.md の「承認欄」）
2. 実装：「<タスク名> をメジェドに実装してもらって」→ ガネーシャが plan.md の「ブランチ」欄のブランチを切ってメジェドを呼び、レビュー→修正を回す。チェックが2回以上落ちていたらレビュー役（健さんか `/code-review`）に「隠しただけか」を見させる。OK になったら PR の前の確認（レビューの道）を回し、片付いたら報告してくる
3. PR：「コミットして PR を出して」→ ガネーシャがコミット・push・PR 作成。マージはしない
4. PR のレビュー：「PR の指摘を見て」→ PR の指摘は `diff-reviewer` で受ける（ユーザー共通のレビュー用のスキルがあっても）。ガネーシャが検証して review.md に書き、コードの指摘はメジェドに直させ、スレッドに返信する（bot のレビューが来なくても待たない。再レビューを頼むかはまーちゅうが決める）。簡単な修正の道で作った PR は、`workflow.md` の「簡単な修正の道」に従う（review.md は作らない）
5. マージ：まーちゅう
6. マージの後：「マージした」→ ガネーシャが既定ブランチを origin に追いつかせる（`delegate-to-mejed` の「マージの後」）

小さな文書の直し（「この README の誤字を直して。簡単な修正の道で」のような頼み方）は、計画・メジェド・diff-reviewer を通さず、まーちゅうの OK を取ってガネーシャが直し、PR の前のレビュー役（健さんの review か `/code-review`）だけを通す。直すことがもう分かっている小さなコードの直し（数行）は、まーちゅうが「ガネーシャが直接コード書いて」「ガネーシャが直接直して」と指示したときだけ、同じ道でガネーシャが直す（レビューは1回だけ）。範囲と流れは [plugins/ai-team/docs/workflow.md](plugins/ai-team/docs/workflow.md) の「簡単な修正の道」を見る。

GitHub Projects のボードを使うなら、ユーザー側の手順で動かす（このテンプレートは持たない）。

### 作業の流れ（要約）

計画から PR までの細かい分かれ目（フローチャート）・言葉の決まり・回数の上限の**正本は [plugins/ai-team/docs/workflow.md](plugins/ai-team/docs/workflow.md)**。プラグインで配る。スキル・メジェド・adversary は、作業の最初にこれを Read で読む。

- 計画：承認を頼む前に、レビューの道で選んだレビュー役（Fable（adversary・plan）・健さんの consult・`/code-review` から1人以上。既定は Fable と `/code-review`）を1回ずつ回し、指摘を確かめて直す（ループしない）
- 実装：メジェドの報告を受けるたびに、停止なら保留、「途中で2回以上落ちたチェック」があればレビュー役（健さんの consult か `/code-review`。PR の前の道に合わせる）
- PR の前の Fさん：レビューの道で `Fable` を選んだときだけ、diff-reviewer が OK のあと、レビュー役の前に Fさん（adversary: pr）を1回回し、指摘を一次データで確かめて review.md に書く
- PR の前：diff-reviewer が OK なら、レビュー役（健さんの review か `/code-review`。レビューの道）を、採る指摘が0になるまで回す（最大5回）。画像のタスクでは、その後にまーちゅうが画像を目で見る
- diff-reviewer の指摘による修正依頼は最大3回。PR に付いたレビューでの直しは別に最大3回。上限に達したら保留して、まーちゅうに判断を頼む
- 承認をやり直したら、上限は数え直す（計画の段は承認を頼む前にいつも1回ずつ。PR の前の Fさんも新しい承認依頼で1回）
- 簡単な修正：まーちゅうの OK で、ガネーシャが直して PR の前のレビュー役（健さんの review か `/code-review`）だけを通す。小さなコードの直しは、まーちゅうの指示（付ける言い方）があったときだけ（範囲は workflow.md）

## worktree で作業するとき

- worktree を作るのは gh-issue スキル（まーちゅうに頼まれたとき）だけ。置き場所はリポジトリの中の `.claude/worktrees/<名前>/`。plan-writer・delegate-to-mejed は worktree もブランチも作らない。使わないときは、今のまま（作業ツリーで `git switch -c`）
- worktree のパス（`.claude/worktrees/<名前>`）は、メジェド・健さん・スキルどうしで渡すとき、リポジトリの根からの相対パスで書く（まーちゅうへの返事のパスは、plan-writer の手順7のとおり。Git Bash の `/c/...` 形は Node.js と PowerShell で別のパスになるため）
- plan.md も review.md も worktree の中の `docs/tasks/<タスク名>/` に書く（メインのチェックアウトの未コミットのファイルは worktree から見えないため）
- git は `git -C <パス>`（`git remote get-url origin` だけは例外で、`-C` を付けない。remote は worktree と共通で、`-C` を付けると allow に当たらないため）。ほかのコマンド（チェックコマンドなど）は `(cd <パス> && <コマンド>)`。健さんのラッパーは `-WorkingDirectory <パス>`（返事はメインのチェックアウトの `docs/tasks/<タスク名>/codex/` に残る。そこが Git に無視されていなければ、一時ディレクトリに残る。codex スキルの「ラッパーがしてくれること」）
- フックは `.claude/worktrees/<名前>/` の頭を剥がして、メインのチェックアウトと同じ判定をする。秘密情報の判定だけは、剥がす前のパスにも当てる
- `git -C <パス>` で始まる git は allow に当たらないので、Manual では worktree での git は毎回確認が出る（`git remote get-url origin` を除いて。手間として受け入れる）。deny は先頭一致なので、`git -C <パス> reset --hard` は `Bash(git reset:*)` に当たらない（「git の権限」）

## 導入方法

プラグインは PC ごと・リポジトリごとに入れる（`enabledPlugins` をコミットしただけでは入らない）。プラグインに切り替える前のリポジトリ（`.claude/skills/delegate-to-mejed/` などのテンプレートの写しがあるもの）は、この節ではなく「写しからプラグインへの切り替え」の順で進める。

この節と「外し方」「テンプレートを直した後の反映」の `claude` のコマンドは、`claude` が PATH に無ければ、VS Code の拡張の `claude.exe`（`<ユーザーのホーム>/.vscode/extensions/anthropic.claude-code-<版>-<OS>/resources/native-binary/claude.exe`）で打つ。

1. Claude Code に、マーケットプレイスを入れる（PC ごとに1回）：`claude plugin marketplace add rocket-martue/ai-team-skills`。リポジトリを private にしているなら（フォークを private にしたときなど）、HTTPS で取れる認証が要る（`git ls-remote https://github.com/rocket-martue/ai-team-skills.git` が通れば足りる。通らなければ `gh auth login` と `gh auth setup-git`）。マーケットプレイスはユーザーの設定に書かれる（「declared in user settings」と出る）。外すときは「外し方」の5
2. リポジトリに `repo-files/` の中身を置く
   - `repo-files/claude/` → `.claude/`（settings.json・ai-team.json）。既存の `settings.json` があれば、内容を見比べて置き換える（`Edit(**/*.php)` のような Edit の禁止が残るとメジェドが実装できない）。既存の `ai-team.json` があれば、足したパターンを消さないよう、中身を残す
   - `repo-files/docs/team/` → `docs/team/`（common-rules.md・Ganesha.md の2つが入る）
   - `repo-files/CLAUDE.md.snippet` の中身を `CLAUDE.md` の先頭に足す
   - `repo-files/gitignore.snippet` の行を、リポジトリの `.gitignore` に足す（健さんを使うかどうかに関係なく。`.claude/worktrees/` は worktree の置き場所。`docs/tasks/*/codex/` は健さんの返事の保存先、`docs/tasks/*/code-review/` は `/code-review` の結果の保存先）
3. 入れるリポジトリの根で、プラグインを入れる（リポジトリごとに1回）：`claude plugin install ai-team@ai-team-skills --scope project`
   - **手順2で settings.json を置いた後に打つ。** install が `.claude/settings.json` に `enabledPlugins` を書くので、先に打つと、settings.json を写したときに消える
   - **`--scope` を付けずに（user で）入れない。** その PC の全部のリポジトリで、ガードと SessionStart が動いてしまう
   - install は `enabledPlugins` を足すほか、`permissions` のキーの順を `allow`・`deny`・`ask` に書き直すことがある（中身と効き方は同じ）。入った版は `<ユーザーのホーム>/.claude/plugins/installed_plugins.json` の ai-team の記録のうち、scope が project で projectPath がそのリポジトリのものの `gitCommitSha` で確かめられる
4. `docs/team/common-rules.md` の「チェックコマンド」を案件に合わせて書き換える。同じファイルの「レビューの観点」と「計画の書き方」も、案件に合わせて書き換える。チェックの前に要る依存のインストール（`composer install`・`npm ci` など）は、リポジトリごとに settings.json の allow に足す。案件に合わせて `.claude/ai-team.json` の `secretPatterns` に足す（フックとラッパーはこれを読む。settings.json の `Read(...)` の deny・リポジトリの `docs/team/common-rules.md` に、案件の秘密情報の箇条を足して、同じにそろえる（team-rules.md はプラグインの中で、全リポジトリ共通・更新で上書きされるので、案件ごとには直さない）。健さんの AGENTS.md（PC の AGENTS.md がテンプレートの今の版なら）は、読むリポジトリの設定ファイルを見るので直さなくてよい）
5. 健さん（Codex）を使うなら
   - Codex CLI を入れて、ログインする：`npm install -g @openai/codex` と `codex login`
   - `repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）に置く。既にあれば、まーちゅうの許可を得て、テンプレートの版と見比べて合わせる。古い形（秘密情報の一覧をリポジトリの `.claude/hooks/guard-code-edit.mjs` の `SECRET_PATTERNS` から取る。`ai-team.json` の文字列が無い）のままだと、`.claude/ai-team.json` の `secretPatterns` を健さんが知らないので、健さんを呼ぶ前に必ず合わせる
6. VS Code を閉じて開き直す（ウィンドウの再読み込みでは読み込まれない）
   - **開き直す前に、リポジトリを信頼する**（PC ごと・リポジトリごとに1回）。信頼していないリポジトリでは、`.claude/settings.json` の allow が丸ごと無視され、健さんのラッパーや `git fetch origin` にも確認が出る（#57）
   - 信頼の印は、ドライブ名の大文字・小文字で別に持つ（`<ユーザーのホーム>/.claude.json` の `projects` の `C:/GitHub/<repo>` と `c:/GitHub/<repo>` の `hasTrustDialogAccepted`）。VS Code のセッションは小文字の `c:` で動くことがあり、PowerShell から起動した `claude` は大文字の `C:` にそろうので、両方で信頼する。ターミナル（PowerShell）で次の2つを1つずつ打ち、信頼のダイアログで「Yes, I trust this folder」を選んでから `/exit` で終える（信頼してあれば、ダイアログは出ずに入力欄が出る。初めて `claude` を起動する PC では、先に見た目やログインの画面が出る）。`claude` が PATH に無ければ、この節の冒頭の `claude.exe` のパスに置き換える
     ```
     cd C:\GitHub\<repo>; claude
     cmd /c "cd /d c:\GitHub\<repo> && claude"
     ```
   - 信頼のダイアログには、settings.json が前もって許可する決まり（「This folder pre-approves N tool permissions」）が並ぶ。テンプレートの allow と、そのリポジトリで足した分のほかに、知らない決まりが無いかを見てから信頼する
7. 導入の PR を作るときは、PR の題名に、写した版を「（ai-team-skills <版>）」の形で書く（次の反映の始まりになる）。写す版は、最初にテンプレートを `git -C <テンプレート> fetch origin` し、`origin/main` のコミットを書き留めて決める。その版の中身（`git show` などで読む）から写す（「テンプレートを直した後の反映」の「写す版を決める」）

### 書き換えるところ

承認者の名前やキャラ設定はプラグインの中にあり、リポジトリごとには書き換えられない（更新で上書きされる）。書き換えるなら、このリポジトリをフォークして直し、「導入方法」の1の `rocket-martue/ai-team-skills` を自分のフォークに替える。

- 承認者の名前（まーちゅう）：プラグインの文書・スキル・エージェントだけでなく、フックのコードとテストにも入っている。`git grep まーちゅう` で探して、まとめて替える
- キャラ設定：`repo-files/docs/team/Ganesha.md`（ガネーシャ）、`plugins/ai-team/agents/mejed.md`（メジェド）、`repo-files/codex/AGENTS.md`（健さん）
- 会話と文書の言語：`plugins/ai-team/docs/team-rules.md` の「言語」、`repo-files/codex/AGENTS.md`
- フックの止めるときの文言：`plugins/ai-team/hooks/guard-code-edit.mjs`
- 直接コードの印を付ける・消す言い方（「ガネーシャが直接コード書いて」など）：`plugins/ai-team/hooks/direct-edit-mark.mjs`

フックを直したら、「このリポジトリで打つチェックコマンド」の表で、そのフックに当たるものを通す。

### 写しからプラグインへの切り替え

プラグインに切り替える前のリポジトリ（`.claude/skills/delegate-to-mejed/` などのテンプレートの写しがあるもの）の手順。古い写しを消して、プラグインの入った形にそろえる。例：hub の切り替え（PR rocket-martue/swx-inventory-hub#109）。

1. 写す版を決める（「テンプレートを直した後の反映」の「写す版を決める」：テンプレートを fetch して `origin/main` のコミットを書き留め、その版の中身から写す）。この PC にマーケットプレイスがまだ無ければ入れる（「導入方法」の1。入っていれば `claude plugin marketplace update ai-team-skills`）。PC の健さんの AGENTS.md を合わせる（「導入方法」の5）
2. auto モードを外してから（auto モードでは `.claude/` の削除や settings.json の書き換えが自分の設定の書き換えとして止められ、確認も出ない）、いつもの流れ（計画 → 承認 → メジェド）で、リポジトリ側を書き換える
   - `.claude/ai-team.json` を、古い写しを消すより先に置く（gh-* の目印が途切れないため。目印は gh-skills の gh-flow の冒頭）
   - `docs/team/common-rules.md`・`docs/team/Ganesha.md` は、テンプレートの `repo-files/docs/team/` の版で書き直してから、そのリポジトリの固有の分（チェックコマンド・レビューの観点・計画の書き方・ボードの Status など）を戻す（今の文書に追記するだけだと、消した写しへの参照や古いエージェントの名前が残るため）。秘密情報のパターンは `.claude/ai-team.json` の `secretPatterns` に移す
   - 古い写し（`.claude/skills/`・`.claude/agents/`・`.claude/hooks/`）と `docs/team/workflow.md` を消す
   - `.gitignore` を `repo-files/gitignore.snippet` と見比べ、足りない行を足す（無いと、`/code-review` の結果などが所定の記録先に保存されず、一時ディレクトリに回る）
   - `.claude/settings.json` は、テンプレートの `repo-files/claude/settings.json` に、そのリポジトリの固有の allow・deny（チェックコマンド・デプロイの禁止・秘密情報の Read の禁止など）を残して書き換え、`hooks` の古いガードの登録を消す。settings.json の書き換えは、メジェドではなくガネーシャが、まーちゅうの確認を取って行う
   - メジェドの報告は、このセッションで delegate-to-mejed の「メジェドの報告の受け方」どおりに受け切る（行が欠けていれば、同じメジェドに書き直させる）。そのうえで、報告の「結果」の行と「途中で2回以上落ちたチェック」の行を、そのまま review.md に書いておく（開き直した後のセッションで、停止の扱いと K2 の要否を決めるため）
3. 古い写しを消した後は、**そのセッションでは古いスキルも健さんのラッパーも呼べない**（セッションの開始時の写しで動くため）。diff-reviewer・PR の前のレビュー役・K2 は、開き直した後のセッションで行う
4. settings.json を置いた後に、リポジトリの根で `claude plugin install ai-team@ai-team-skills --scope project`（「導入方法」の手順3と同じ注意）。打った後、開き直す前に、install の差分（install の前の settings.json の写しと比べる）と入った版（`installed_plugins.json` の ai-team の記録のうち、scope が project で projectPath がそのリポジトリのものの `gitCommitSha`）を見た結果を review.md に書く。入った版が手順1で決めた版と違えば、開き直さずに止まる（リポジトリ側とプラグインの版がずれるため）
5. VS Code を閉じて開き直し（開き直す前に、「導入方法」の6のとおりリポジトリを信頼する）、新しいセッションで「導入後に確認すること」を確かめる。そのあと、review.md に書いておいたメジェドの報告の行で、delegate-to-mejed の「メジェドの報告の受け方」の分け方どおりに K2 が要るかを決め（要るなら diff-reviewer の前に K2）、diff-reviewer・PR の前のレビュー役に進む。PR の題名には、写した版を「（ai-team-skills <版>）」の形で書く（「導入方法」の7と同じ。次の反映の始まりになる）

## 外し方

**プラグインが動いているうちに**、リポジトリ側を先に片付けてマージし、最後に手元のプラグインを外す。先に外すと、メインのチェックアウトに `.claude/ai-team.json` などの目印が残ったまま ai-team のスキルが呼べなくなり、gh-* が止まるため（目印を見るのはメインのチェックアウト）。

1. 片付けのブランチを worktree に切り（メインのチェックアウトは切り替えない。gh-skills の worktree.md の置き場所）、リポジトリ側のファイルを片付けて PR にする。この PR は、gh-* の gh-issue・gh-pr・gh-review も ai-team の流れ（計画・メジェド）も使わずに作る（gh-* は目印に当たって ai-team の流れに回し、ai-team の流れは外す対象のため）。まーちゅうが手で作るか、ガネーシャに「git と gh を直接打って」と頼む（gh-* の安全装置の `--repo`・`--head` を付け、マージはしない）。
   - `.claude/settings.json` の `enabledPlugins` から `ai-team@ai-team-skills` の行を消す（**必ず**。手で消してコミットする。コミットしないと、ほかの PC やクローンで gh-* の目印に当たり続ける）
   - `.claude/ai-team.json` を消す（**必ず**。導入の手順2で置いたもの。残すと gh-* の目印に当たり続ける。目印は gh-skills の gh-flow の冒頭）
   - プラグインに切り替える前の写し（`.claude/skills/`・`.claude/agents/`・`.claude/hooks/` の ai-team のもの）が残っていれば消す（**必ず**。`.claude/skills/delegate-to-mejed/` も gh-* の目印のため）。`.claude/settings.json` の `hooks` に古いガード（`${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-code-edit.mjs`）の登録が残っていれば、それも消す（ファイルだけ消すと、無いガードを呼び続けるため）
   - `CLAUDE.md` の先頭の取り込み（`CLAUDE.md.snippet` で足した行）と `docs/team/Ganesha.md` を消す（**必ず**。Ganesha.md は、計画・実装・PR・レビューを ai-team のスキルで行うよう指示し続けるため）
   - `docs/team/common-rules.md` と `docs/tasks/` の記録は、残してもよい（取り込まなければ効かない）
   - `.claude/settings.json` の permissions は、導入のときに置き換えた分を見直す（ai-team の allow・ask・deny を、そのリポジトリに要るものだけにする）
   - `.gitignore` に足した行（`gitignore.snippet`）は、残しても害は無い
2. PR をマージしたら、メインのチェックアウトを origin に追いつかせる。`git status --short --branch` で既定のブランチにいて未コミットの変更が無いことを確かめ、`git pull --ff-only origin <既定ブランチ>` を打ち、もう一度 `git status --short --branch` で ahead・behind が無いことを確かめる（違えば止まる）。追いついた後は目印が無いので、片付けの worktree とブランチは gh-wrapup で（ふつうのリポジトリとして）片付けてよい
3. プラグインを入れた**PC ごとに**、メインのチェックアウトの根で `claude plugin uninstall ai-team@ai-team-skills --scope project`（入れたときと同じスコープ。付けないと user のスコープを探す。打たない PC では、入れた記録が残り、プラグインが動き続けることがある）。シェルのコマンドで外す（`/plugin` や VS Code の画面で「Disable for me」を選ぶと、`.claude/settings.local.json` に `false` を書くだけで、入れた記録が残るため）。`enabledPlugins` の行は手順1で消してあるので、uninstall の後に `git status` で `.claude/settings.json` に差分が出ていないかを見る（出ていたら中身を見て、要るならコミットする）。`claude plugin list` で、このリポジトリに ai-team が無いことを確かめる。`enabledPlugins` の行が無いために uninstall が「Failed to uninstall plugin」で止まり、`claude plugin list` に ai-team が残るときは、まだ確かめていない（#34 の 3 で確かめる）。そのときは止まって、まーちゅうが扱いを決める
4. VS Code を閉じて開き直す
5. その PC のどのリポジトリでも使わなくなったときだけ、`claude plugin marketplace remove ai-team-skills` と、キャッシュの `<ユーザーのホーム>/.claude/plugins/cache/ai-team-skills/` を手で消す（マーケットプレイスとキャッシュは PC で1つで、ほかのリポジトリも使っているため）。

## テンプレートを直した後の反映

テンプレートに直しが入ったときは、プラグインの中身と、リポジトリ側（`repo-files/` の中身）で、反映のしかたが違う。

### プラグインの中身（`plugins/ai-team/`）の反映

写さない。各 PC で、マーケットプレイスの自動更新をオンにしておく（PC ごとに1回）。セッションで `/plugin` → Marketplaces → `ai-team-skills` → 「Enable auto-update」。自前のマーケットプレイスは、既定ではオフ（[公式ドキュメント](https://code.claude.com/docs/en/plugins/install.md)）。

- 自動更新は、対話のセッションで最初のメッセージを送ってから、ランダムで最大10分後に動く。マーケットプレイスを更新して、そこから入れたプラグインも更新する（[公式ドキュメント](https://code.claude.com/docs/en/plugins/loading.md) の「When auto-update runs」）
- そのセッションは古い版のまま動き、「Plugin updated … Run /reload-plugins to apply」が出る。新しい版は、`/reload-plugins` の後か、VS Code を開き直した後に効く
- `--scope project` で入れたものも自動で更新されるかは、確かめているところ（#80）。確かめるまでは、新しい版が入ったかを `installed_plugins.json` の記録（そのリポジトリの project スコープの `gitCommitSha`）で見て、入っていなければ下の手で打つ

すぐに入れたいとき・自動更新をオンにしていない PC では、次の順に手で打つ。

1. `claude plugin marketplace update ai-team-skills`（PC ごとに1回）
2. プラグインを入れた各リポジトリの根で、`claude plugin update ai-team@ai-team-skills --scope project`（入れたときと同じスコープ。スコープを省くと、今いるプロジェクトの中から探すので、入れていないリポジトリで打つと見つからない）
3. VS Code を閉じて開き直す

hub で確かめた（`03bc685` → `f559c20`）。`plugin update` は settings.json を書き換えない。

リポジトリ側（下の節）は自動では入らない。プラグインが新しい版になっても、リポジトリ側を反映するまでは、settings.json などは前の版のまま。

### リポジトリ側（`repo-files/` の中身）の反映

各リポジトリのセッションで反映させる。そのリポジトリのフックと権限が効くため。頼み方の例：「rocket-martue/ai-team-skills の最新を反映して」（反映のイシューがあれば、その番号も）。以降の節（前回の版を探す〜マージの後）が、この手順。settings.json の `enabledPlugins` は、テンプレートに無いが消さない（install が書いたもの）。

### 前回の版を探す

前回の**全体の反映**の PR の題名に書いた版。その後に、部分的な反映（一部のファイルだけを先に入れたもの）や反映先での戻しがあれば、差分に出てくるので、中身で見比べる。

### 写す版を決める

1. テンプレートを `git -C <テンプレート> fetch origin` する
2. `origin/main` のコミットを写す版として plan.md に書いて固定する（計画・実装・PR の題名で版をそろえるため）
3. 作業の途中でテンプレートが進んでも、その版のまま反映する
4. その版の中身は、`git -C <テンプレート> show <写す版>:<パス>` や、その版を指定した `git diff` で読む。テンプレートのチェックアウトのファイルからは写さない（`fetch` だけでは作業ツリーが古いままで、記録した版と中身がずれるため）

### 差分を見る

テンプレートの `git log <前回の版>..<写す版>` と `git diff <前回の版> <写す版>` を、次の範囲に絞って見る：
- `repo-files/claude/`
- `repo-files/docs/team/`
- `repo-files/gitignore.snippet`
- `repo-files/CLAUDE.md.snippet`
- `repo-files/codex/AGENTS.md`

置き場所の対応は「導入方法」のとおり（`repo-files/claude/` → `.claude/`、`repo-files/docs/team/` → `docs/team/`）。プラグインの中身（`plugins/ai-team/`）は写さないので、この差分には入れない。

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

ふつうのタスクと同じ（plan-writer → メジェド → diff-reviewer → PR の前のレビュー役 → PR）。計画の段の選んだレビュー役も、ふつうのタスクと同じに回す（workflow.md のレビューの道）。

- 反映のセッションでは、スキル・メジェドの定義は変える前のまま動く（`.claude/` とプラグインはセッションの開始時に読まれるため）。反映で mejed.md の報告の形式を変えても、そのセッションのメジェドの報告は前の形式で返ってくるので、前の版で受ける
- `.claude/settings.json` が変わる反映では、最初から auto モードを外しておく。auto モードだと、メジェドが settings.json を書き換えるのが権限の分類器に Self-Modification で拒否され、確認のダイアログも出ない

### PR の題名

全体の反映の PR の題名に、写した版を「（ai-team-skills <版>）」の形で書く（次の反映の始まりになる）。部分的な反映では、題名にこの形を書かない（次の反映の始まりと取り違えないため）。版は本文に書く。

### AGENTS.md の扱い

`repo-files/codex/AGENTS.md` が変わっていたら、PR の「マージの後」にその差分を書いて伝える。各 PC の `<CODEX_HOME>/AGENTS.md` は、まーちゅうの許可を得てから、見比べて合わせる（リポジトリの外。個人の設定を上書きしないため。「導入方法」の5と同じ）。

### マージの後

そのリポジトリのメインのチェックアウトを追いつかせ、VS Code を閉じて開き直す（`.claude/` とプラグインはセッションの開始時に読まれるため）。

## 導入後に確認すること

- **取り込みが効くか**：ガネーシャに、ファイルを読まずに Ganesha.md と common-rules.md の中身（ボードの Status やチェックコマンドなど、そのリポジトリで書いたもの）を言わせる（VS Code の拡張の Memory の画面は自動メモリしか出さない。ターミナルの CLI なら `/memory` でも見られる）。チーム共通の決まり（team-rules.md）は取り込みではなく SessionStart フックで入るので、ガネーシャに「チーム共通の決まりの場所は？」と聞いて、プラグインの docs/team-rules.md の絶対パスが答えに出るか確かめる
- **フックが動くか**：ガネーシャに「inc/ の PHP を1行直して」と頼み、フックで止められるか確認する。次にメジェドに同じことを頼み、通るか確認する。ガネーシャがメモリに書けることも確かめる
- **Windows での実行**：フックは、シェルを通さない書き方（プラグインの `hooks/hooks.json` の `"command": "node"` と `"args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard-code-edit.mjs"]`）で登録している。Git Bash が無い Windows では、シェル形のコマンドが PowerShell で動いて変数が空になり、フックが起動しないまま編集が通るため（起動できないフックは止める側に倒れない。公式ドキュメント hooks の「Exec form and shell form」）。止まらないときは `/hooks` で登録を確認する
- **フックの単体確認**：フック（`node plugins/ai-team/hooks/test-guard-code-edit.mjs` が同じことを確かめる）に JSON を標準入力で渡して終了コードを見る（`CLAUDE_PROJECT_DIR` に仮のリポジトリのパスを入れる）。期待値は、メインの `src/a.js` が 2、メインの `docs/tasks/x/plan.md` が 0、`agent_type: ai-team:mejed`（切り替える前のリポジトリでは `mejed`）の `src/a.js` が 0、同じ `.dev.vars` が 2、ほかのサブエージェントの `src/a.js` が 2、メインのメモリ（`~/.claude/projects/<p>/memory/`）が 0、リポジトリの外が 2、JSON でない入力が 2。`.claude/` の下と `docs/team/` の下は終了コード 0 で、標準出力の JSON に `permissionDecision: "ask"` が入る
- **直接コードの印**：ガネーシャに「ガネーシャが直接コード書いて」と言うと、印が付いた知らせが出て、小さなコード（数行）の Edit が通る。「直接書くのはおしまい」と言うと、印が消えた知らせが出て、コードの Edit がまた止まる。言い方を変えたメッセージ（「ガネーシャが直接コードを書いて」など）では付かない
- **Bash・PowerShell 経由の書き込みは止まらない**：`echo > file` や `sed -i`、PowerShell の `Set-Content` のようなシェル経由の書き込みは、このフックの対象外。
  **auto モードでは確認も出ない**ので、仕組みの上ではガネーシャも Bash・PowerShell でコードを書き換えられる。ここは Ganesha.md の禁止事項で縛っている。気づいたら止める
- **サブエージェントの権限モード**：メインが `acceptEdits` や `auto` で動いているときは、メジェドもそのモードで動く。フックは権限モードとは別の仕組みだけど、念のため `acceptEdits` でもガネーシャの編集が止まるか試す
- **秘密情報**：案件に応じて、パターンを追加する（`.claude/ai-team.json` の `secretPatterns`・settings.json の `Read(...)` の deny・リポジトリの `docs/team/common-rules.md` の案件の秘密情報の箇条を、同じにそろえる。team-rules.md はプラグインの中なので直さない。既定の4つは `ai-team-config.mjs` の `SECRET_PATTERNS` にあり、設定ファイルでは外せない。健さんの AGENTS.md（PC の AGENTS.md がテンプレートの今の版なら）は、読むリポジトリの設定ファイルを見るので直さなくてよい）
- **allow が効くか**：VS Code の新しいセッションを Manual モードで開き、スキルを読み込ませずに、settings.json の allow にあって、allow が無ければ確認が出るコマンドを、1つずつ単独で打たせる。確認が出なければ効いている。打つのは `git fetch origin` と、健さんのラッパーの `make-patch`（`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<ユーザーのホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/skills/codex/scripts/invoke-codex.ps1" -Mode make-patch -Task allow-check -OutFile "<そのセッションの scratchpad>/allow-check.patch"`。健さんは呼ばない。差分が無ければ終了コード 4 で、パッチは作らない）
  - `git status`・`git show` などの読むだけのコマンドは、allow が無くても通るので確かめにならない。codex スキルを読み込んだ後は、スキルの許可（`allowed-tools`）でラッパーが通るので、これも確かめにならない
  - 確認が出たら、リポジトリを信頼したか（「導入方法」の6。大文字・小文字の両方）を見る。「常に許可」は選ばない（`.claude/settings.local.json` に決まりが書かれ、settings.json の allow が効いていないことが隠れるため）
  - 画面を見なくても、セッションの記録（`<ユーザーのホーム>/.claude/projects/<プロジェクト>/<セッション>.jsonl`）の、そのツールの結果の行の `permissionDecision` で分かる。`"source":"config"` で `reasonType` が `rule` か `subcommandResults` なら allow（またはスキルの許可）に当たった。`classifier` なら auto モードの判定で通った（allow に当たったかは分からない）。`"source":"user_temporary"` ならダイアログで通した

## ライセンス

MIT No Attribution（MIT-0）。`LICENSE` を参照。
