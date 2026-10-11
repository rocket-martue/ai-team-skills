# 計画書：repo-specific-split

- 作成：ガネーシャ（2026-10-11）
- 承認：[x] まーちゅう（承認日：2026-10-11。承認の言葉：「承認」）
<!-- 承認欄の埋め方は docs/team/workflow.md の「承認欄」 -->
- ブランチ：`feat/34-split-repo-config`（リポジトリの外の worktree で作業）
- イシュー：#34。PR には `Refs #34`（この PR ではクローズしない。プラグイン化と4つのリポジトリの切り替えが残るため）と書く
- メジェドのモデル：sonnet（ガードのフック（JavaScript）と健さんのラッパー（PowerShell）の両方で、設定ファイルの読み込みと失敗のときの扱いを足し、テストも足す。2つの言語で同じ判定にそろえる判断が実装に残るため）
- 改訂履歴：
  - 2026-10-11 初版
  - 2026-10-11 Fable の指摘で改訂。設定ファイルの知らないキー（大文字小文字違いを含む）も壊れているとして止める、を足した。ラッパーで `Get-ReplyRoot` を読み込みより前に動かす、と書いた。設定ファイルが壊れていても、設定ファイル自体は確認（ask）で直せるようにした。README の「取り入れるかを決める」「導入後に確認すること」と、codex の SKILL.md の worktree の箇条と「注意」も直す対象にした。diff-reviewer の「計画との一致」と plan.md の雛形の「背景・前提」のコメントの WordPress の言葉も外す対象にした。ラッパーの確かめに worktree とテンプレートの `claude/ai-team.json` を足した。完了条件に docs/tasks の扱いと grep の語を足し、AGENTS.md の行の書き方を直した
  - 2026-10-11 健さん1回目の指摘で改訂。ラッパーも `plannerWritable` をガードと同じく確かめる、メインのチェックアウトでも `claude/ai-team.json` を探す、設定ファイル自体はいつも確認で直せる（`secretPatterns` が当たっても）、正規表現で使える書き方を決めて `\` の後の英数字と `(?` を止める、を足した。知らないキーの確かめの例を正しい JSON にした。README の導入の手順2に既存の `ai-team.json` を残す、を足した。common-rules.md の「方針」に「使う WordPress API」を足した
  - 2026-10-11 健さん2回目の指摘で改訂。文字クラスの中の `[` を止める、設定ファイルのリンク切れを止める、BOM をガードとラッパーの両方で取り除く、README の表に設定ファイル自体の行を足す、を足した
  - 2026-10-11 健さん3回目の指摘で改訂。正規表現をやめてグロブにした（記号は `**`・`*`・`?` だけ。ガードとラッパーが同じ規則で正規表現に直す）。正規表現の方言の差を塞ぐたびに次の差が見つかったため。リンク切れは親の `.claude/` も `realPath()` で拾い、設定ファイル自体も止めて「手で直す」にした。README に `ai-team.json` の書き方の節を足す、を足した
  - 2026-10-11 健さん4回目の指摘で改訂。README の表と完了条件に、リンク切れのときは設定ファイル自体も止まる、を足した。健さん向けのグロブの説明に、`**/` と `/**` が区切りごと省けることと、根の直下でも当たる例を足した
  - 2026-10-11 健さん5回目の指摘の後、まーちゅうの決めた案3で改訂。判定（秘密情報の既定の一覧・グロブ・リンク・設定ファイルの読み込み）を Node の共有モジュール `claude/hooks/ai-team-config.mjs` 1つにまとめ、ガードは import、ラッパーは `node` で呼ぶ形にした（ラッパーの `$SecretPatterns`・`Test-SecretPath` は消す）。文字コードは UTF-8 だけにした。健さん向けのグロブの説明に、途中の `**/` も省ける、を足した
  - 2026-10-11 健さん6回目の指摘で改訂。ラッパーのテストの子のプロセスの PATH に `node` の場所を足す、を足した。設定ファイルがリンクのときは確認の例外を使わず `judge` で判定する（リンク先の秘密情報を守る）、と「設定ファイルそのもの」の比べ方を書いた
  - 2026-10-11 健さん7回目の指摘で改訂。README の「`ai-team.json` の書き方」と「編集できる範囲」の表、完了条件に、設定ファイルがリンクのときは確認の例外を使わない、をそろえた

## 目的

テンプレートをプラグインにする前に、各リポジトリが今スキルやフックの中で上書きしている「リポジトリ固有のもの」を、リポジトリ側のファイルに切り出す。スキル・エージェント・フック・ラッパーは、どのリポジトリでも同じ中身のまま使えるようにする。

## 背景・前提

- #34 の PR の割り方（まーちゅうと決めた。2026-10-11）：1a（この計画。固有のものの切り出し）→ 1b（テンプレートをプラグインにする）→ 2（gh-skills の目印）→ 3（4つのリポジトリの切り替え）
- 4つのリポジトリの `.claude/` とテンプレートの `claude/` の差分を洗い出した（#34 のコメント「反映先の固有の上書きの洗い出しと、決めたこと」）。リポジトリ固有の上書きは次の5種類
  - チェックコマンドの allow・デプロイの deny（`settings.json`）
  - レビューの観点（`claude/skills/diff-reviewer/SKILL.md:30-35` の「共通規約」の箇条と、`:76` のコードの拡張子の例）。WordPress 以外の3つは丸ごと置き換えている
  - 計画の書き方と雛形（`claude/skills/plan-writer/SKILL.md:3` の description・`:48-49` の書き方の基準・`:58` の実装コードの例、`claude/skills/plan-writer/templates/plan.md:28-43` の見出しと `:57` の完了条件）
  - 秘密情報のパターン（`claude/hooks/guard-code-edit.mjs:21` の `SECRET_PATTERNS` と `claude/skills/codex/scripts/invoke-codex.ps1:47-52` の `$SecretPatterns`。hub が `.wrangler/` を足している）
  - ボードの Status（`delegate-to-mejed` の手順。テンプレートは #1 で外したので、テンプレートには今は無い）
- まーちゅうの決めたこと（2026-10-11。#34 のコメント）
  - レビューの観点と、計画の書き方の基準・plan.md の雛形は、各リポジトリの `docs/team/` に出し、スキルはそれを読む。テンプレートの中身は WordPress 向けの見本として持つ
  - ボードの Status は、使うリポジトリだけ、リポジトリ側（`docs/team/Ganesha.md`）に置く。テンプレートには入れない
- 置き場所の決め方（ガネーシャの案。この計画で決める）
  - **レビューの観点と計画の書き方は、`docs/team/common-rules.md` に節を足して置く。** common-rules.md は、すでにリポジトリごとに中身を書き換える文書（「コーディング」の節と「チェックコマンド」の節。`repo-files/docs/team/common-rules.md:9-17`・`:31-35`）で、ガネーシャ・メジェド・adversary が読む。新しいファイルを増やさずに済む
  - **plan.md の雛形は、チームで共通の骨組み（冒頭の箇条・目的・背景・対象ファイル・対象外・完了条件・テスト観点・承認前の確認・確認事項）をテンプレートに残し、リポジトリごとに違う見出し（関数・フック・ブロックの表、使う WordPress API と方針）だけを common-rules.md の「計画の書き方」に移す。** 雛形を丸ごとリポジトリ側に置くと、#28 の「メジェドのモデル」のような共通の直しが、リポジトリごとの雛形に届かなくなるため
  - **秘密情報のパターンは、リポジトリ側の設定ファイル `.claude/ai-team.json` に置く。** ガード（JavaScript）とラッパー（PowerShell）の両方が読むので、Markdown ではなく JSON にする。`.claude/` の下なので、編集はガードの確認（ask）になる（`claude/hooks/guard-code-edit.mjs:27`）。テンプレートでは `claude/ai-team.json`（`claude/` は `.claude/` に重ねるので、反映先では `.claude/ai-team.json` になる）
  - 同じ設定ファイルに、ガネーシャが確認なしで編集できるパス（`PLANNER_WRITABLE`）の追加も置く。README の「直さないもの」が「データの JSON は、要るリポジトリで `PLANNER_WRITABLE` に足す」と、フックのコードの書き換えを前提にしている（`README.md` の「直さないもの」の表）。プラグインにするとフックのコードはリポジトリで書き換えられないので、ここで一緒に出す
- 設定ファイルの形（ガネーシャの案）
  - `{ "secretPatterns": [], "plannerWritable": [] }`。どちらもグロブの文字列の配列で、**既定の一覧に足すだけ**（既定を外すことはできない。秘密情報の既定の4つを、リポジトリ側の書き間違いで外さないため）
  - **正規表現ではなくグロブにする。** 正規表現は言語ごとに方言の差があり、書いた人が読み違えやすい。グロブなら書き方が小さく、健さんの AGENTS.md にも短く説明できる
  - グロブの書き方
    - リポジトリの根からの相対パスに当てる。区切りは `/`、小文字で書く（照らす前に、Windows ではパスを小文字にそろえる。今のガードと同じ。`claude/hooks/guard-code-edit.mjs:74-76`）
    - 記号は3つだけ。`**`（`/` をまたいで0文字以上）・`*`（`/` 以外の0文字以上）・`?`（`/` 以外の1文字）。ほかの文字は、正規表現の記号（`.`・`(`・`|` など）も含めて、ただの文字として当てる
    - `**/` は、先頭でも途中でも、区切りごと省ける（0個以上のディレクトリに当たる）。最後の `/**` も区切りごと省けて、そのもの自身とその中に当たる
    - `\`・`[`・`]`・`{`・`}` を含むもの、空の文字列、`/` で始まるものは、壊れているとして止める
    - 正規表現への直し方：先頭に `^`、最後に `$` を付ける。前から順に、`**/` は `(.*/)?`、最後の `/**` は `(/.*)?`、それ以外の `**` は `.*`、`*` は `[^/]*`、`?` は `[^/]`、ほかの文字はエスケープした1文字にする
    - 例：hub の `.wrangler/` は `**/.wrangler/**`（根の直下も含めて、どの深さの `.wrangler` も、その中も当たる）。データの JSON は `data/*.json`（`data/a.json` は当たり、`data/sub/a.json` は当たらない）。`private/**/token.json` は `private/token.json` にも `private/a/b/token.json` にも当たる
- **判定は、Node の共有モジュール1つ（`claude/hooks/ai-team-config.mjs`）にまとめる。** ガードは import し、ラッパーは `node` で呼ぶ。ガード（JavaScript）とラッパー（PowerShell）で同じ判定を2回書くと、正規表現の方言・JSON の読み方（キーの大文字小文字）・文字コードの判別で、判定が割れるところが何度も見つかったため（健さんの1〜5回目）。判定を1か所にすれば、割れようが無い
  - モジュールが持つもの：秘密情報の既定の一覧（今のガードの `SECRET_PATTERNS`。ラッパーの `$SecretPatterns` は消す）・グロブを正規表現に直す関数・リンクをたどる関数（今のガードの `realPath()`。ガードはこれを import する）・設定ファイルを読んで確かめる関数・ラッパーから呼ぶための入口（コマンドライン）
  - ラッパーからモジュールへの道：ラッパー（`claude/skills/codex/scripts/invoke-codex.ps1`）の場所からの相対パス `../../../hooks/ai-team-config.mjs`（反映先では `.claude/hooks/ai-team-config.mjs`。プラグインにした後も、同じプラグインの中なので同じ相対パスで届く）
- 設定ファイルの読み方（モジュールの中の1か所）
  - 文字コードは UTF-8 だけ。バイト列で読み、先頭が UTF-8 の BOM なら取り除く。UTF-16・UTF-32 の BOM で始まるもの、UTF-8 として正しくないバイト列は、壊れているとする
  - ファイルが無いときは、既定の一覧だけで動く（今までどおり）。ただし、設定ファイルか親のディレクトリ（`.claude/`）がリンク（シンボリックリンク・ジャンクション）で、リンク先が無いときは、「無い」ではなく「リンク切れ」として止める（足したパターンが黙って消えないため。今のガードもリンク切れを未作成のパスと区別している（`claude/hooks/guard-code-edit.mjs:99`・`:109`））。リンク切れは Edit では直せないので、設定ファイル自体の編集も止め、理由に「リンクを手で直す」と書く
  - 壊れている：読めない・文字コードが違う・JSON として壊れている・最上位がオブジェクトでない・`secretPatterns` と `plannerWritable` 以外のキーがある（大文字小文字は区別する。`SecretPatterns` も止める）・配列でない・文字列でない・グロブとして壊れている。このときは、ガードはすべての編集を止め（理由に設定ファイルの名前と、どこが壊れているかを書く）、ラッパーは健さんを呼ばずに止まる。黙って既定の一覧に戻ると、足したはずの秘密情報が守られなくなるため
  - 設定ファイル自体（`.claude/ai-team.json`）の編集は、設定ファイルがリンクのとき（リンク先があってもなくても）を除き、設定ファイルが壊れていても、`secretPatterns` に設定ファイル自体に当たるパターンがあっても、いつも確認（ask）で通す（直す道を残すため。設定ファイルは秘密情報ではない）。ガードは、秘密情報の判定より先にこれを見る。ほかの編集は、設定ファイルが壊れているときは、リポジトリの外の scratchpad も含めて止まる
  - 設定ファイルがリンクのときは、この例外を使わず、今までどおり `judge` で判定する（指定されたパスと実体のパスの両方に当て、きつい方を取る）。リンク先が `.env` などの秘密情報なら止まる。比べ方：指定されたパスが `projectDir` の `.claude/ai-team.json` と同じで、かつ `realPath()` で求めた実体のパスが、`projectDir` の実体のパス（`realPath(projectDir)`）の下の `.claude/ai-team.json` と同じ（どちらも Windows では小文字にそろえる）ときだけ「設定ファイルそのもの」とする
- 設定ファイルを読む場所
  - ガード：`projectDir`（`CLAUDE_PROJECT_DIR`。`claude/hooks/guard-code-edit.mjs:207`）の `.claude/ai-team.json`。worktree の中の編集も、メインのチェックアウトの設定で判定する（ガードは今もメインのチェックアウトの根で判定している）
  - ラッパー：作業の根（`$RepoRoot`。`-WorkingDirectory` を付けたときは worktree の根）と、メインのチェックアウト（`git worktree list` の1件目）の根の両方で、`.claude/ai-team.json`、無ければ `claude/ai-team.json`（テンプレートのリポジトリ）を読み、合わせた一覧で照らす。健さんの AGENTS.md の「worktree のときは、両方の一覧を合わせたものを開かない」（`repo-files/codex/AGENTS.md:30`）と同じ考え方
- 健さんの AGENTS.md と codex の SKILL.md は、秘密情報の一覧を「根のフックの `SECRET_PATTERNS`」で知る、と書いている（`repo-files/codex/AGENTS.md:29`・`:48`、`claude/skills/codex/SKILL.md:53`）。設定ファイルの `secretPatterns` も見る、に変える。反映前のリポジトリ（フックに足したパターンが残っている）のために、フックの `SECRET_PATTERNS` を見ることも残す
- 4つのリポジトリへの反映は、この PR ではしない。#34 の3（切り替え）でまとめて入れる（反映のときに、各リポジトリの固有の中身を common-rules.md と `.claude/ai-team.json` に移す）
- このリポジトリのチェックコマンド（このタスクに限る）：`node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs`

## 対象ファイル

| パス | 種別（新規／変更／削除） | 変更の概要 |
| --- | --- | --- |
| `claude/ai-team.json` | 新規 | `{ "secretPatterns": [], "plannerWritable": [] }` |
| `claude/hooks/ai-team-config.mjs` | 新規 | 共有モジュール。秘密情報の既定の一覧・グロブの直し方・リンクのたどり方・設定ファイルの読み込みと確かめ・ラッパーから呼ぶ入口 |
| `claude/hooks/guard-code-edit.mjs` | 変更 | 共有モジュールを import し、`.claude/ai-team.json` の `secretPatterns`・`plannerWritable` を既定の一覧に足して判定する。壊れていたら止める。`SECRET_PATTERNS` と `realPath()` はモジュールへ移す |
| `claude/hooks/test-guard-code-edit.mjs` | 変更 | 設定ファイルとグロブの確かめを足す |
| `claude/skills/codex/scripts/invoke-codex.ps1` | 変更 | `$SecretPatterns` と `Test-SecretPath` を消し、共有モジュールを `node` で呼んで、設定ファイルの確かめと秘密情報の照らし合わせをさせる |
| `claude/skills/codex/scripts/test-invoke-codex.mjs` | 変更 | 設定ファイルの確かめを足す |
| `claude/skills/codex/SKILL.md` | 変更 | 「頼みの文に必ず入れること」の秘密情報の一覧の出どころに、設定ファイルを足す。「ラッパーがしてくれること」の review の確かめに、設定ファイルを足す |
| `repo-files/codex/AGENTS.md` | 変更 | 秘密情報の一覧の出どころ（2か所）に、設定ファイルを足す |
| `claude/skills/diff-reviewer/SKILL.md` | 変更 | 「共通規約」の WordPress の箇条を、common-rules.md の「レビューの観点」を見る形にする。PR に付いたレビューのコードの拡張子の例を外す |
| `claude/skills/plan-writer/SKILL.md` | 変更 | description と「書き方の基準」と「書いてはいけないもの」から WordPress の言葉を外し、common-rules.md の「計画の書き方」を見る形にする |
| `claude/skills/plan-writer/templates/plan.md` | 変更 | 「関数・フック・ブロック」の表と「使う WordPress API と方針」を、共通の見出しにする。完了条件の phpcs の行を、チェックコマンドの行にする |
| `repo-files/docs/team/common-rules.md` | 変更 | 節「レビューの観点」と「計画の書き方」を足す（中身は今のテンプレートの WordPress の観点と見出し）。秘密情報とフックの説明に設定ファイルを足す |
| `README.md` | 変更 | 「中身と置き場所」の表に `claude/ai-team.json`、「編集できる範囲」「直さないもの」「導入方法」の手順4・5、を設定ファイルと common-rules.md の新しい節に合わせる |

## 変更内容

### `claude/ai-team.json`（新規）

- 中身は `{ "secretPatterns": [], "plannerWritable": [] }` だけ（JSON はコメントを書けないので、説明は README とフックのコメントに書く）。インデントはタブ、最後に改行

### `claude/hooks/ai-team-config.mjs`（新規）

- 冒頭のコメント：ガードとラッパーの両方が使う判定の正本。リポジトリごとの追加は `.claude/ai-team.json` に書き、このファイルは書き換えない
- export するもの（名前はメジェドに任せる。下は役割）
  - 秘密情報の既定の一覧：今のガードの `SECRET_PATTERNS`（`claude/hooks/guard-code-edit.mjs:21`）をそのまま移す。コメントも移す
  - リンクをたどる関数：今のガードの `isLink()`・`realPath()`（`:89-122`）をそのまま移す
  - グロブを正規表現に直す関数：上の「グロブの書き方」の直し方どおり。壊れているグロブは例外か結果で知らせる
  - 設定ファイルを読む関数：候補のパスの一覧（例：`[<根>/.claude/ai-team.json, <根>/claude/ai-team.json]`）を受け取り、前から順に見て、最初に「ある」もの（リンク切れも「ある」に数えて止める）を読む。結果は「無い」「読めた（足すパターンの一覧と、読んだファイルのパス）」「壊れている（理由・リンク切れかどうか・ファイルのパス）」のどれか。読み方は上の「設定ファイルの読み方」
  - パスを照らす関数：パス（リポジトリの根からの相対パス。区切りは `/`）が、既定の一覧か足したグロブに当たるか。Windows では照らす前に小文字にそろえる（今のガードの `forMatch()` と同じ）
- ラッパーから呼ぶ入口（`node ai-team-config.mjs check --root <根> [--root <根2>] --paths-file <ファイル> --out <ファイル>`）
  - 各 `--root` で、`.claude/ai-team.json`、無ければ `claude/ai-team.json` を読む。1つでも壊れていれば、終了コード 2 で、理由を `--out` のファイルに書く
  - `--paths-file` は、NUL 区切りの UTF-8（BOM なし）で書いたパスの一覧。空でもよい（設定ファイルの確かめだけをするとき）
  - 当たったパスがあれば、終了コード 3 で、当たったパスを `--out` のファイルに改行区切りの UTF-8 で書く。無ければ終了コード 0
  - 引数が足りない・ファイルが読めないなどは、終了コード 1
  - 入出力をファイルにするのは、Windows PowerShell 5.1 の標準入出力の文字コード（日本語のパスが化ける）を通さないため
- このファイルを直接 `node` で実行したときだけ入口を動かし、import したときは動かさない

### `claude/hooks/guard-code-edit.mjs`

- 冒頭のコメントに1行足す：リポジトリごとの追加は `.claude/ai-team.json`（`secretPatterns`・`plannerWritable`）に書く。判定の部品は `ai-team-config.mjs`。このファイルは書き換えない
- `SECRET_PATTERNS`・`isLink()`・`realPath()` を消し、共有モジュールから import する。`PLANNER_WRITABLE` はガードに残し、上のコメントに「追加は `.claude/ai-team.json` の `plannerWritable`」と足す
- 入力を読んで `projectDir` を決めた後（`:207` の後）、`judge` を呼ぶ前に、共有モジュールで `projectDir` の `.claude/ai-team.json`（以下「設定ファイル」。候補はこれ1つ）を読む
  - リンク切れ：設定ファイル自体も含めて、すべての編集を止める。理由は `guard-code-edit: .claude/ai-team.json（または .claude/）がリンク切れなので編集を止めました。リンクを手で直してください。` の形
  - 壊れている（リンク切れ以外）：止める。理由は `guard-code-edit: .claude/ai-team.json を読めないので編集を止めました（<どこが壊れているか>）。直すときは .claude/ai-team.json を編集してください（確認が出ます）。` の形。ただし、編集先が設定ファイルそのもの（上の「設定ファイルの読み方」の比べ方。設定ファイルがリンクなら当たらない）なら、止めずに確認（ask）を返す。比べ方は、`judge` と同じく Windows では小文字にそろえる
  - 読めたときも、編集先が設定ファイルそのもの（同じ比べ方）なら、`judge` の秘密情報の判定より先に確認（ask）を返す
  - 読めたら、足すグロブを秘密情報と `PLANNER_WRITABLE` の判定に加える（既定は残す）。キーが無いときは足さない
- `judge` の中の秘密情報の判定（`:131`・`:150`・`:161`）と `PLANNER_WRITABLE` の判定（`:179`）は、共有モジュールの照らす関数（または、合わせた一覧）を使う。リポジトリの外のパス（`:131`）は、今までどおり絶対パスを既定の一覧に当てる（グロブは根からの相対パスに当てるものなので、外のパスには当てない）
- 設定ファイル以外の `.claude/` の下の編集は、今までどおり `CONFIRM_PATTERNS` で確認（ask）になる（判定は変えない）

### `claude/hooks/test-guard-code-edit.mjs`

- 仮のリポジトリ（`project`）に `.claude/ai-team.json` を書いて確かめる。ほかの確かめに影響しないよう、確かめの前に書き、後で消す（または、別の仮のリポジトリを作る）
- 足す確かめ（設定ファイルの中身は JSON で書く）
  - 設定ファイルが無いとき：今までの確かめが全部、今までどおり通る（今の確かめはそのまま残す）
  - `{"secretPatterns": ["**/.wrangler/**"]}`：ガネーシャ・メジェドとも `.wrangler/state.json` と `sub/.wrangler/x` の編集が止まる（2）。worktree の中（`.claude/worktrees/<名前>/.wrangler/x`）も止まる。`wrangler.toml` は止まらない
  - `{"secretPatterns": ["private/**/token.json"]}`：`private/token.json` と `private/a/b/token.json` は止まる（2）。`private/token.jsonx` は止まらない
  - 既定の秘密情報（`.dev.vars`）は、設定ファイルがあっても止まる（2）
  - `{"plannerWritable": ["data/*.json"]}`：ガネーシャが `data/a.json` を編集できる（0）。メジェド以外のサブエージェントも通る（0）。`data/sub/a.json` と `data/a.jsonx` は止まる（2）
  - `{"plannerWritable": ["data/?.json"]}`：`data/a.json` は通り（0）、`data/ab.json` は止まる（2）
  - グロブの中の正規表現の記号はただの文字：`{"plannerWritable": ["a.b/x(1).md.txt"]}` で、`a.b/x(1).md.txt` は通り（0）、`axb/x(1).md.txt` は止まる（2）
  - 設定ファイルが JSON として壊れているとき：ガネーシャの `docs/tasks/x/plan.md` の編集も止まる（2）。設定ファイルの編集は確認（`ask`）
  - 知らないキーがあるとき（`{"SecretPatterns": []}`）：止まる（2）
  - 文字列の配列でないとき（`{"secretPatterns": "x"}`、`{"secretPatterns": [1]}`）：止まる（2）
  - グロブとして壊れているとき（`["[ab]"]`、`["{a,b}"]`、`[""]`、`["/x"]`、`\` を含むもの）：止まる（2）
  - 文字コード：先頭に UTF-8 の BOM があり、中身は正しいとき：今までどおり判定する。UTF-16LE（BOM 付き）で保存した、中身は正しい設定：止まる（2）
  - `secretPatterns` に設定ファイル自体に当たるグロブ（`.claude/ai-team.json`）があるとき：設定ファイルの編集は確認（`ask`）、ほかの編集は今までどおり
  - 設定ファイルが、リンク先のある `.env` へのシンボリックリンクのとき（リンクを作れない環境では飛ばす）：設定ファイルの編集は止まる（2）
  - 設定ファイルが読めたときの設定ファイルの編集は確認（`ask`）
  - リンク切れ（リンクを作れない環境では、その確かめを飛ばして、飛ばしたことを出力に書く）
    - 設定ファイルがリンク切れのシンボリックリンク：ガネーシャの `docs/tasks/x/plan.md` の編集も、設定ファイルの編集も止まる（2）
    - 親の `.claude` がリンク切れのジャンクション（またはシンボリックリンク）：同じく止まる（2）
- 今あるリンクの確かめ（`realPath()` を使うもの）が、モジュールへ移した後も全部通ること

### `claude/skills/codex/scripts/invoke-codex.ps1`

- `$SecretPatterns`（`:46-52`）と `Test-SecretPath`（`:54-61`）を消す。秘密情報の既定の一覧と照らし合わせは、共有モジュールに任せる
- `Get-ReplyRoot`（`:167-188`）の定義を、`$RepoRoot` を決めた直後（`:82` の後）に動かす（定義の前に呼べないため）。中身は変えない
- `$RepoRoot` を決めた後、モードにかかわらず、次をする（`codex` の有無の確かめの後でよい）
  - `node` が PATH に無ければ止まる。モジュール（`Join-Path $PSScriptRoot '..\..\..\hooks\ai-team-config.mjs'`）が無ければ止まる
  - review なら、今の `git status`・`git diff` で集めているすべてのパス（`:119-136` で `Test-SecretPath` に渡していたもの。名前の変更の元の名前も含む）を、NUL 区切りの UTF-8（BOM なし）で一時ファイルに書く。review でなければ、空の一時ファイルにする
  - `node <モジュール> check --root $RepoRoot [--root <メインのチェックアウトの根>] --paths-file <一時ファイル> --out <一時ファイル>` を呼ぶ。メインのチェックアウトの根（`Get-ReplyRoot` の返す値）は、`$RepoRoot` と違うときだけ渡す
  - 終了コード 0：進む。3：`--out` の当たったパスを今と同じ形の文で出して止まる（review を呼ばない）。2：`--out` の理由を出して止まる（設定ファイルが壊れている。どのモードでも呼ばない）。それ以外：止まる
  - `--out` は UTF-8 で読む（`[System.IO.File]::ReadAllText(<パス>, $utf8)`。今のラッパーの `$utf8` を使う）
  - 一時ファイルは、今の `$WorkDir` と同じく、終わったら消す（置き場所は今の一時ディレクトリの決め方に合わせる）
- 今の review の止まる文（`:138-140`）の中身（未追跡・ステージ済み・書き換え・名前の変更・基準ブランチとの差分のどれも送られる）は残す

### `claude/skills/codex/scripts/test-invoke-codex.mjs`

- 子のプロセスの `PATH`（`:89`。今は偽物の `codex`・Git・System32・PowerShell の場所だけ）に、`node` の場所（`path.dirname(process.execPath)`）を足す。ラッパーが共有モジュールを `node` で呼ぶため。止まる確かめの期待は弱めない
- 足す確かめ（今の仮の Git のリポジトリと偽物の `codex` の仕組みを使う。設定ファイルの中身は JSON で書く）
  - 設定ファイルが無いとき：今までの確かめが全部、今までどおり通る（既定の秘密情報で review が止まる確かめも含む）
  - 仮のリポジトリの `.claude/ai-team.json` が `{"secretPatterns": ["**/.wrangler/**"]}` で、未追跡の `.wrangler/state.json` があるとき：review は止まる（偽物の `codex` が呼ばれない）。`sub/.wrangler/x` でも止まる
  - 同じ設定で、`.wrangler/` に当たる変更が無いとき（`wrangler.toml` だけ）：review は今までどおり呼ばれる
  - 日本語のパス：同じ設定で、未追跡の `.wrangler/日本語.json` だけがあるとき：review は止まる。止まった文に `.wrangler/日本語.json` が化けずに出る
  - 設定ファイルが JSON として壊れているとき：consult も止まる（偽物の `codex` が呼ばれない）
  - 知らないキー（`{"SecretPatterns": []}`）・`plannerWritable` が `[1]`・グロブとして壊れている（`{"secretPatterns": ["{a,b}"]}`）とき：止まる
  - UTF-16LE（BOM 付き）で保存した、中身は正しい設定：止まる
  - worktree から呼んだとき：worktree の根に設定ファイルが無く、メインのチェックアウトの根の `.claude/ai-team.json` に `**/.wrangler/**` があれば、worktree の未追跡の `.wrangler/state.json` で review が止まる（今の「7. worktree から呼ぶ」の仕組みを使う）
  - worktree から呼んだとき：worktree の根にも、メインのチェックアウトの根の `.claude/` にも設定ファイルが無く、メインのチェックアウトの根の `claude/ai-team.json` に `**/.wrangler/**` があれば、同じく止まる
  - 仮のリポジトリに `.claude/` が無く `claude/ai-team.json` に `**/.wrangler/**` があるとき：review が止まる（テンプレートのリポジトリ）
  - 設定ファイルがリンク切れのとき（リンクを作れない環境では飛ばして、飛ばしたことを出力に書く）：consult も止まる

### `claude/skills/codex/SKILL.md`

- 「頼みの文に必ず入れること」の秘密情報の3つ目の箇条（`:54`「worktree のときは、メインのチェックアウトの根のフックも合わせて見る」）の「フック」を「設定ファイルとフック」にする
- 「注意」の `:97`「AGENTS.md は、既定の4つに加えて、読むリポジトリの根のフックの `SECRET_PATTERNS` も見る決まり」を、「…読むリポジトリの根の設定ファイルの `secretPatterns` とフックの `SECRET_PATTERNS` も見る決まり」にする
- 「頼みの文に必ず入れること」の秘密情報の2つ目の箇条（`:53`）を、「読むリポジトリごとに、その根（git の根）の `.claude/ai-team.json`（無ければ `claude/ai-team.json`）の `secretPatterns` と、根の `.claude/hooks/ai-team-config.mjs`（無ければ `claude/hooks/ai-team-config.mjs`）の秘密情報の既定の一覧と、反映前のリポジトリでは根の `.claude/hooks/guard-code-edit.mjs` の `SECRET_PATTERNS` に当たるもの（設定ファイルとフックのファイルは読んでよい）」にする
- 「頼みの文に必ず入れること」の秘密情報の箇条に、子の箇条を1つ足す：`secretPatterns` はグロブ（`**` は `/` をまたいで0文字以上、`*` は `/` 以外の0文字以上、`?` は `/` 以外の1文字。ほかの文字はそのまま。`**/` は先頭でも途中でも区切りごと省けて0個以上のディレクトリに当たり、最後の `/**` も区切りごと省けて、そのもの自身とその中に当たる。例：`**/.wrangler/**` は、根の直下の `.wrangler` と `.wrangler/state.json` にも、`a/.wrangler/x` にも当たる。`private/**/token.json` は `private/token.json` にも `private/a/b/token.json` にも当たる）で、リポジトリの根からの相対パスに当てる
- 「ラッパーがしてくれること」の review の箇条に、「秘密情報の照らし合わせは、ガードと同じ共有モジュール（`.claude/hooks/ai-team-config.mjs`）を `node` で呼んで行う。既定の4つに、作業の根とメインのチェックアウトの根の `.claude/ai-team.json`（無ければ `claude/ai-team.json`）の `secretPatterns` を足したもの。設定ファイルが壊れていれば、どのモードでも呼ばずに止まる。`node` が無ければ止まる」を足す

### `repo-files/codex/AGENTS.md`

- 秘密情報の箇条の2か所に、子の箇条を1つ足す：`secretPatterns` はグロブ（`**` は `/` をまたいで0文字以上、`*` は `/` 以外の0文字以上、`?` は `/` 以外の1文字。ほかの文字はそのまま。`**/` は先頭でも途中でも区切りごと省けて0個以上のディレクトリに当たり、最後の `/**` も区切りごと省けて、そのもの自身とその中に当たる。例：`**/.wrangler/**` は、根の直下の `.wrangler` と `.wrangler/state.json` にも、`a/.wrangler/x` にも当たる。`private/**/token.json` は `private/token.json` にも `private/a/b/token.json` にも当たる）で、リポジトリの根からの相対パスに当てる
- 秘密情報の箇条の2か所（`:29`・`:48`）の「その根（git の根）の `.claude/hooks/guard-code-edit.mjs`（無ければ `claude/hooks/guard-code-edit.mjs`）の `SECRET_PATTERNS` に当たるもの」を、「その根（git の根）の `.claude/ai-team.json`（無ければ `claude/ai-team.json`）の `secretPatterns` と、根の `.claude/hooks/ai-team-config.mjs`（無ければ `claude/hooks/ai-team-config.mjs`）の秘密情報の既定の一覧と、反映前のリポジトリでは根のフック（`.claude/hooks/guard-code-edit.mjs`）の `SECRET_PATTERNS` に当たるもの」にする
- 続く「worktree のときは、…根のフックも見て」（`:30`・`:49`）と「フックのファイルは読んでよい」（`:32`・`:51`）を、「フック」を「設定ファイルとフック」にして合わせる

### `claude/skills/diff-reviewer/SKILL.md`

- 「チェック観点」の「計画との一致」（`:27`）の「対象ファイル・関数・フックが plan.md どおりか」を、「対象ファイルと変更の中身が plan.md どおりか」にする
- 「チェック観点」の「共通規約」の箇条（`:30-35`）を次にする
  - `- **共通規約**：`docs/team/common-rules.md` の各項目を守っているか。common-rules.md の「レビューの観点」の項目は必ず見る`
  - 子の箇条は「秘密情報・クライアント識別情報がコードやテストに入っていないか」だけを残す（どのリポジトリでも共通のため）。WordPress の4つの箇条は消す（common-rules.md の「レビューの観点」に移す）
- 「PR に付いたレビュー」の手順4の「コード（`.php` `.js` `.css` など）の指摘がある」を、「コード（`.md` 以外）の指摘がある」にする

### `claude/skills/plan-writer/SKILL.md`

- description の「WordPress案件のタスクについて、」を「このリポジトリのタスクについて、」にする
- 「書き方の基準」の `:48`「関数・フック・ブロックは、名前・引数・戻り値・役割まで書く」と `:49`「使う WordPress API と、エスケープ／サニタイズ／nonce／権限チェックの方針を書く」を、1つの箇条「『変更内容』と『方針』に書く項目は、common-rules.md の『計画の書き方』に従う」にする
- 「書いてはいけないもの」の「実装コード（関数の本体、CSS のルール、ブロックのマークアップ、SQL など）」を、「実装コード（関数の本体・スタイルのルール・マークアップ・クエリなど）」にする

### `claude/skills/plan-writer/templates/plan.md`

- 「## 背景・前提」のコメント `<!-- 現状の構成、関係するテーマ／プラグイン、前提となる制約 -->` を `<!-- 現状の構成、関係するもの（ファイル・機能など）、前提となる制約 -->` にする
- 「## 変更内容」の下の「### 関数・フック・ブロック」の表（見出しと表）を消し、「## 変更内容」のすぐ下にコメント `<!-- 書く項目は docs/team/common-rules.md の「計画の書き方」 -->` を置く。「### データの流れ」は残す
- 「## 使う WordPress API と方針」の節を「## 方針」にし、中の箇条（出力のエスケープ〜CSS）を消して、コメント `<!-- docs/team/common-rules.md の「計画の書き方」の「方針」の項目を、箇条で埋める -->` と、空の箇条 `- ` を1つ置く
- 「## 完了条件」の `- [ ] phpcs（phpcs.xml）でエラー 0` を `- [ ] docs/team/common-rules.md の「チェックコマンド」が全部通る` にする
- ほかの見出し・冒頭の箇条と、上に書いたもの以外のコメントは変えない

### `repo-files/docs/team/common-rules.md`

- 「## チェックコマンド」の節の後に、次の2つの節を足す。どちらも見出しのすぐ下に `<!-- 案件に合わせて書き換える。… -->` のコメントを置く（「チェックコマンド」の節のコメントと同じ書き方）
  - `## レビューの観点`（コメント：diff-reviewer が「共通規約」で必ず見る項目）。中身は今の diff-reviewer の4つの箇条（WordPress Coding Standards（phpcs.xml）・セキュリティ（エスケープ・サニタイズ・nonce・権限チェック・`$wpdb->prepare()`）・CSS／SCSS のモバイルファースト・翻訳関数とテキストドメイン）
  - `## 計画の書き方`（コメント：plan-writer が plan.md の「変更内容」と「方針」に書く項目）。中身は次の2つの箇条
    - 変更内容：関数・フック・ブロックの表（名前・種別（関数／アクション／フィルター／ブロック等）・引数・戻り値・役割）
    - 方針：使う WordPress API・出力のエスケープ・入力のサニタイズ・nonce／権限チェック・国際化（テキストドメイン）・CSS（モバイルファースト。ブレークポイント）
- 「作業の進め方」の「編集の制限（`.claude/hooks/guard-code-edit.mjs`）が見るのは…」の箇条の後に、箇条を1つ足す：秘密情報のパターンと、ガネーシャが確認なしで編集できるパスの追加は、`.claude/ai-team.json`（`secretPatterns`・`plannerWritable`）に書く。編集には確認が出る

### `README.md`

- 「中身と置き場所」の表の下に、短い節「`ai-team.json` の書き方」を足す：2つのキー、グロブの書き方（記号3つ・使えない文字・小文字・根からの相対パス）、例（`**/.wrangler/**`・`data/*.json`）、既定に足すだけで外せないこと、壊れているとき・リンク切れのときの動き、設定ファイル自体はいつも確認で直せること（設定ファイルがリンクのときを除く。リンクのときはふつうの判定になり、リンク先が秘密情報なら止まる）
- 「中身と置き場所」の表に行を足す：`claude/hooks/ai-team-config.mjs`｜全員｜`.claude/hooks/ai-team-config.mjs`。ガードと健さんのラッパーが使う判定の部品（秘密情報の既定の一覧・`ai-team.json` の読み込みとグロブ）。リポジトリでは書き換えない
- 「中身と置き場所」の表に行を足す：`claude/ai-team.json`｜全員｜`.claude/ai-team.json`。リポジトリごとの秘密情報のパターン（`secretPatterns`）と、ガネーシャが確認なしで編集できるパス（`plannerWritable`）の追加。ガードと健さんのラッパーが読む。既定の一覧に足すだけで、外すことはできない
- 「ファイルの分け方」の「docs/team/common-rules.md」の行に、「レビューの観点・計画の書き方」を足す
- 「編集できる範囲（フックで判定）」の表の2行目（秘密情報）と6行目に、「＋ `.claude/ai-team.json` で足したもの」を足す
- 同じ表の1行目（リポジトリの外）の前に、行を1つ足す：`.claude/ai-team.json`（設定ファイル自体）は、中身が壊れていても、`secretPatterns` が当たっても、誰も確認（ask）。ただし、設定ファイルがリンクのとき（リンク先があってもなくても）は、この行に当てず、下の行で判定する（リンク先が秘密情報なら×）。設定ファイルか親の `.claude/` がリンク切れのときは、この行も含めて全部止める（×）。表の下に「設定ファイルが壊れているときは、この行のほかは全部止まる。リンク切れのときは、この行も含めて全部止まるので、リンクを手で直す。設定ファイルがリンクのときは、この行は使わない」を足す。表の番号は振り直す
- 「直さないもの」の表の「データの JSON をガネーシャが編集できない」の理由を、「リポジトリごとに場所が違う。要るリポジトリで `.claude/ai-team.json` の `plannerWritable` に足す」にする
- 「テンプレートを直した後の反映」の「取り入れるかを決める」（`README.md:182`）の固有の上書きの例「チェックコマンド・`SECRET_PATTERNS`・レビューの観点・…」の `SECRET_PATTERNS` を `.claude/ai-team.json` にする
- 「導入後に確認すること」の「秘密情報」（`README.md:226`）の「フックの `SECRET_PATTERNS`・ラッパーの `$SecretPatterns`・…を同じにそろえる。健さんの AGENTS.md は、読むリポジトリのフックを見るので直さなくてよい」を、手順5と同じく `.claude/ai-team.json` の `secretPatterns` に足す形にする
- 「導入方法」の手順2の「既存の `settings.json` があれば、内容を見比べて置き換える」に、「既存の `ai-team.json` があれば、足したパターンを消さないよう、中身を残す」を足す
- 「導入方法」の手順4に「同じ common-rules.md の『レビューの観点』と『計画の書き方』も、案件に合わせて書き換える」を足す。手順5の「`guard-code-edit.mjs` の `SECRET_PATTERNS` を足す（フックの `SECRET_PATTERNS`・ラッパーの `$SecretPatterns`・settings.json の…を、同じにそろえる…）」を、「`.claude/ai-team.json` の `secretPatterns` に足す（フックとラッパーはこれを読む。settings.json の `Read(...)` の deny・common-rules.md の秘密情報の箇条も、同じにそろえる。健さんの AGENTS.md は、読むリポジトリの設定ファイルを見るので直さなくてよい）」にする

## 対象外（やらないこと）

- プラグインにすること（1b）。`claude/` の置き場所・`settings.json` の分け方・ガードの `agent_type` の判定・スキルの中のパスとエージェントの呼び名は変えない
- 4つのリポジトリへの反映（3。切り替えのときに、各リポジトリの固有の中身を common-rules.md と `.claude/ai-team.json` に移す）
- ボードの Status の節（テンプレートには今も無い。切り替えのときに、使うリポジトリの `docs/team/Ganesha.md` に移す）
- `claude/settings.json` の allow・deny（すでにリポジトリ側のファイル）
- 健さんの AGENTS.md の「レビュー・相談で見る観点」の節（`repo-files/codex/AGENTS.md:66-93`。PHP・JavaScript・CSS の観点。各 PC に1つで、リポジトリごとではない）
- diff-reviewer の「PR に付いたレビュー」の手順2の「公式ドキュメントなどの一次データ」（hub・site-inventory は「Cloudflare の挙動」「WordPress の挙動」に書き換えているが、「公式ドキュメント」はどのリポジトリでも通じるので変えない）
- plan-writer と plan.md の雛形の「必須パターン」の「セキュリティ上どうしても」（channel はセキュリティ以外にも広げている。広げるかはチーム共通の決まりの変更で、リポジトリ固有のものの切り出しとは別。切り替えのときに channel で要るかを確かめる）
- `docs/team/workflow.md`・`Ganesha.md`・`mejed.md`・`adversary.md`・`delegate-to-mejed`・`review.md` の雛形
- `CONFIRM_PATTERNS`・`PLAN_FILE`・`OUTSIDE_WRITABLE` を設定ファイルで変えられるようにすること（どのリポジトリも変えていない）

## 完了条件

- [ ] `claude/ai-team.json` があり、`{ "secretPatterns": [], "plannerWritable": [] }` だけが入っている
- [ ] ガードが `.claude/ai-team.json` の `secretPatterns`・`plannerWritable` を既定の一覧に足して判定し、無ければ今までどおり、壊れていれば（知らないキーを含む）設定ファイル自体の編集（確認）を除いてすべての編集を止め、設定ファイルか親の `.claude/` がリンク切れなら設定ファイル自体も含めてすべての編集を止め、設定ファイルがリンクなら確認の例外を使わずにふつうの判定をする（リンク先の `.env` は止まる）（`test-guard-code-edit.mjs` の足した確かめが全部 ok）
- [ ] `claude/hooks/ai-team-config.mjs` があり、秘密情報の既定の一覧・グロブの直し方・リンクのたどり方・設定ファイルの読み込みと確かめ・ラッパーから呼ぶ入口が、ここにだけある（`grep -n "SECRET_PATTERNS\|realPath\|SecretPatterns\|Test-SecretPath" claude/hooks/guard-code-edit.mjs claude/skills/codex/scripts/invoke-codex.ps1` で、定義が残っていない）
- [ ] ラッパーが、共有モジュールを `node` で呼び、作業の根とメインのチェックアウトの根の設定ファイル（`.claude/ai-team.json`、無ければ `claude/ai-team.json`）の `secretPatterns` を既定の一覧に足して review の前に照らし（日本語のパスも化けない）、壊れていれば（知らないキーを含む）どのモードでも健さんを呼ばずに止まる（`test-invoke-codex.mjs` の足した確かめが、worktree と `claude/ai-team.json` の分も含めて全部 ok）
- [ ] codex の SKILL.md（`:53`・`:54`・`:97` と「ラッパーがしてくれること」）と `repo-files/codex/AGENTS.md`（2か所の秘密情報の箇条と、その worktree・読んでよいの箇条）の秘密情報の一覧の出どころに、設定ファイルの `secretPatterns` があり、フックの `SECRET_PATTERNS` も残っている
- [ ] diff-reviewer の「共通規約」に WordPress の箇条が無く、common-rules.md の「レビューの観点」を必ず見る、と書いてある。PR に付いたレビューの手順4に `.php` の例が無い
- [ ] plan-writer の description・書き方の基準・書いてはいけないもの、と plan.md の雛形、diff-reviewer に、「WordPress」「phpcs」「nonce」「テーマ／プラグイン」「関数・フック」の文字が無い（`grep -n "WordPress\|phpcs\|nonce\|テーマ／プラグイン\|関数・フック" claude/skills/plan-writer/SKILL.md claude/skills/plan-writer/templates/plan.md claude/skills/diff-reviewer/SKILL.md` が0件）
- [ ] plan.md の雛形の「## 変更内容」「### データの流れ」「## 方針」「## 完了条件」が上の変更内容のとおりで、ほかの見出しと冒頭の箇条は main と同じ
- [ ] `repo-files/docs/team/common-rules.md` に「レビューの観点」「計画の書き方」の節があり、今の WordPress の観点と見出しが入っている。秘密情報と編集できるパスの追加の置き場所の箇条がある
- [ ] README の「中身と置き場所」「ファイルの分け方」「編集できる範囲」「直さないもの」「導入方法」の手順4・5「取り入れるかを決める」「導入後に確認すること」が、上の変更内容のとおり。`grep -n "SECRET_PATTERNS\|SecretPatterns" README.md` の残りが、共有モジュールの既定の一覧を指す文だけ
- [ ] 対象ファイルの表のファイルと、`docs/tasks/repo-specific-split/`（plan.md・review.md）のほかに差分が無い（`git status --short` と `git diff origin/main --stat` で確かめる）
- [ ] `node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs` が通る
- [ ] 差分にローカルの絶対パス・クライアント識別情報が無い

## テスト観点

- 設定ファイルが無いリポジトリ（今の4つ）で、ガードとラッパーの動きが変わらない（今の確かめが全部通る）
- ガードとラッパーが、同じ共有モジュールで判定している（判定を2か所に書いていない）
- 設定ファイルが壊れているときに、黙って既定の一覧に戻らない
- 既定の秘密情報が、設定ファイルで外れない

## 承認前の確認

<!-- 承認を頼む前に、Fable（adversary・plan）と健さん（consult）を呼んだ結果。承認依頼ごと・回ごとに見出しを分けて書く。Fable を呼ぶのは最初の承認依頼の前だけ。まーちゅうに頼まれて回した分は、その旨を書く -->

### 承認依頼1・Fable（2026-10-11）

- 採った（plan.md を直した）：8件（必須1・推奨7）。設定ファイルのキーの大文字小文字違いでガードとラッパーの判定が割れる／ラッパーの `Get-ReplyRoot` が読み込みより後ろで定義されている／設定ファイルが壊れると設定ファイル自体も直せない／README の2か所が古いまま／codex の SKILL.md の2か所が古いまま／diff-reviewer と plan.md の雛形に WordPress の言葉が残る／ラッパーの確かめに worktree と `claude/ai-team.json` が無い／完了条件で docs/tasks の扱いと AGENTS.md の行が合わない。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：指摘6のうち、「必須パターン」の「セキュリティ上どうしても」（channel が広げている）と、diff-reviewer の「公式ドキュメント」。前者はチーム共通の決まりの変更で、後者はどのリポジトリでも通じる言葉のため（対象外に書いた）

### 承認依頼1・健さん1回目（2026-10-11）

- 採った（plan.md を直した。必須として書く）：7件。ラッパーが `plannerWritable` を確かめずガードと判定が割れる／メインのチェックアウトの `claude/ai-team.json` を読み落とす／`secretPatterns` が設定ファイル自体に当たると直せない／正規表現の2つの言語で同じになる範囲が決まっていない（`\w` など）／知らないキーの確かめの例が JSON として壊れている／導入の手順で既存の `ai-team.json` を上書きしうる／「使う WordPress API」が移し先から抜ける。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/01-consult.md`（Git に入れない）

### 承認依頼1・健さん2回目（2026-10-11）

- 呼べなかった（Codex の使用枠の上限。「try again at 10:47 PM」）。「指摘なし」とは扱わず、保留した
- まーちゅうの指示で、22:50 に呼び直した
- 採った（plan.md を直した。必須として書く）：4件。文字クラスの引き算（`[a-z-[aeiou]]`）で判定が割れる／リンク切れの設定ファイルが「無い」扱いになる／BOM でガードだけが止まる／README の表に設定ファイル自体の例外が無い。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/02-consult.md`（Git に入れない）

### 承認依頼1・健さん3回目（2026-10-11）

- 採った（plan.md を直した。必須として書く）：3件。先頭の `]`（`[]a]`）で .NET と JavaScript の判定が割れる／リンク切れのとき、設定ファイル自体を確認で直す約束が成り立たない／親の `.claude/` のリンク切れを `lstat` で拾えない。1件目は、禁止する書き方を足すのをやめ、グロブに変えた（plan-writer の「指摘の数が回ごとに減らないときは、規則を書き足さずに削る方向で直す」）。改訂履歴の5行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/03-consult.md`（Git に入れない）

### 承認依頼1・健さん4回目（2026-10-11）

- 採った（plan.md を直した。必須として書く）：2件。README の表と完了条件が、リンク切れでも設定ファイル自体を確認で直せると読める／健さん向けのグロブの説明に、`**/` と `/**` を区切りごと省ける規則が無い。改訂履歴の6行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/04-consult.md`（Git に入れない）

### 承認依頼1・健さん5回目（2026-10-11）

- 採る指摘：2件（まだ plan.md を直していない）。ラッパーの `ReadAllText(path, Encoding.UTF8)` は BOM で UTF-16／UTF-32 も読めてしまい、ガードと判定が割れる／健さん向けのグロブの説明が、途中の `**/` も区切りごと省けることを書いていない（`private/**/token.json` が `private/token.json` に当たると伝わらない）
- 5回目でも採る指摘があるので、workflow.md の回数の上限に従って保留した
- まーちゅうの決めたこと（2026-10-11）：案3（判定を Node の共有モジュール1つにまとめる）で直し、健さんをもう1回回す（上限の外の、まーちゅうに頼まれた回）。改訂履歴の7行目
- 返事：`docs/tasks/repo-specific-split/codex/05-consult.md`（Git に入れない）

### 承認依頼1・健さん6回目（2026-10-11。まーちゅうに頼まれた、上限の外の回）

- 採った（plan.md を直した。必須として書く）：2件。ラッパーのテストの子のプロセスの PATH に `node` が無い／設定ファイルが生きているリンク（`.env` など）でも確認で通る。改訂履歴の8行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/06-consult.md`（Git に入れない）

### 承認依頼1・健さん7回目（2026-10-11。まーちゅうに頼まれた、上限の外の回）

- 採った（plan.md を直した。必須として書く）：1件。設定ファイルがリンクのときの扱いが、README の直し方と完了条件ではリンク切れだけになっている。改訂履歴の9行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/repo-specific-split/codex/07-consult.md`（Git に入れない）

## 確認事項

- なし
