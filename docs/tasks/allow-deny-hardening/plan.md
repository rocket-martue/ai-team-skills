# 計画：テンプレートの allow・deny を、リポジトリの中身から使われない形にする（#109）

- ブランチ：`fix/109-allow-deny-hardening`（worktree で作業）
- 計画書：着手時に `docs/tasks/allow-deny-hardening/plan.md` に、この内容で置く
- 実装：メジェド（`model: sonnet`）。確かめ・`-p` の実験・イシューへの記録・PR はガネーシャ
- 承認前の確認：藤さん（の定義どおりの Fable）3回（2026-10-30・31）。採った指摘は末尾

## Context

#104 の見直しで、テンプレート `repo-files/claude/settings.json` の allow に、信用できない PR の中身から使える道が見つかった。調べて分かったこと（code.claude.com/docs/en/permissions・hooks）：

- Bash の決まりの `*` は空白・`/`・`..` にも当たり、ホームやプラグインのフォルダに絞る書き方は無い。プラグインは allow を足せない → 決まりの書き方ではラッパーの偽物を外せない
- プラグインの PreToolUse フックは `permissionDecision: "allow"` で確認を飛ばせる。settings の deny・ask はそれでも勝つ
- `git`（読むだけの形）・`cat`・`grep` などは組み込みの「読むだけ」の許可で、どのモードでも確認なしに通る。ただし Read の deny は、Claude Code が見分けるファイルのコマンド（`cat`・`head`・`tail`・`sed`・`tee`）とリダイレクトの先にも効く。効かないのは、ファイル名を書かない読み方（`grep -r`）・スクリプト（node・python）・git（`git show HEAD:<パス>`・`git log -p`）
- ask に当たると、バックグラウンドのエージェントや `-p` ではダイアログを受けられずに止まる（まーちゅうも auto で止まるのを見た。文書は auto の対話のセッションでは確認を出すと書く）。allow を消すだけなら止まらない（auto は判定器に回る）
- phpcs は、追跡している `phpcs.xml` の `<autoload>`・`<rule ref="./…">` で、リポジトリの中の PHP を読み込んで動かす（PHP_CodeSniffer の Annotated Ruleset）→ 実行ファイルを追跡していなくても、PR の中身を動かす

まーちゅうの選択（2026-10-30）：
- ラッパーは **プラグインの Bash のフックで allow を判定**（ask は使わない。止まる場面を増やさない）
- phpcs は **テンプレートの allow から外す**（フックでも判定しない）
- git の秘密情報の読み取りは、フックで読み解かない。**秘密情報の名前を含む `git show` を settings の deny で止める**（2026-10-31。「`cat` も通る」というガネーシャの誤りを直した後に選び直した）。`git diff`・`git log -p` と、引用で名前を割る形・ハッシュで指す形は止まらないので、README に限界として書く
- `--output`（書き込み）は実験の結果で決める（2 を見る）

## やること

### 1. 新しいフック `plugins/ai-team/hooks/guard-bash.mjs`
`hooks.json` の PreToolUse に matcher `Bash` で登録（今のガードと同じ `command: node` + `args`。`onFailure` は付けない＝失敗したら判定なしで今の決まりに戻る）。**allow を返すか、何も返さないかだけ**（ask・deny は返さない）。

**(a) 健さんのラッパー（Bash だけ）**
- 当たる形：`node "<根>/skills/codex/scripts/invoke-codex.mjs" <引数>` と `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<根>/skills/codex/scripts/invoke-codex.ps1" <引数>`。前に `cd <パス> && ` が1つ付いた形も受ける（gh-pr の `SKILL.md:95` の呼び方）
- `<根>` は2つ：フック自身の場所（入れた形ではキャッシュ。`import.meta.url` から2つ上。`--plugin-dir` で動かしたときはそのフォルダ）と、マーケットプレイスの写し（`<設定の根>/plugins/marketplaces/ai-team-skills/plugins/ai-team`。`<設定の根>` は `CLAUDE_CONFIG_DIR` があればそれ、無ければ `<ホーム>/.claude`。gh-pr が呼ぶ）
- `node` とパスの引用の間には何も入れない形だけ受ける（`node -r …`・`node --import …`・`NODE_OPTIONS=… node …` などの前置きは判定なし）
- パスの書き方は、二重引用・一重引用・引用なし（空白の無いパス）と、`\` 区切りを受ける
- 根のどちらかが無い（マーケットプレイスの写しが無い PC など）ときは、その根を飛ばし、もう一方で判定する（例外で落ちない）
- 比べる前にそろえる：`\`→`/`、Git Bash の `/c/…`→`c:/…`、Windows は大小を畳む、両側を realpath（リンク越しの置き方でも当たる）。`..` などで外へ出る形は当たらない
- 引数・`cd` のパスは、シェルの記号（引用の外の `; & | < > ( ) $ ` 改行`、引用の中の `$`・`` ` ``・`\"`）を1つでも含めば判定なし。`-Image "<a>|<b>"` の引用の中の `|` は通す

### 2. `repo-files/claude/settings.json`
- allow から消す：ラッパーの2行・`Bash(git show:*)`・`Bash(vendor/bin/phpcs:*)`
- deny に足す：`Bash(git show *wp-config.php*)`・`Bash(git show *.env*)`・`Bash(git show *.dev.vars*)`・`Bash(git show *.kv/*)` と、同じ形の PowerShell（`:0:wp-config.php` の index 形も名前を含むので当たる）
- `--output`：実装の前に `-p` で実験して決める（allow を `git fetch origin` だけにした設定で、`git diff`・`git log --oneline -1`・`git diff --output=x`・`git log --output=x` を打ち、記録を見る）
  - ふつうの形が組み込みの許可で通り、`--output` の形が確認（default で reject）になる → `git diff:*`・`git log:*` の allow を消すだけ。`--output` の deny は置かない
  - `--output` の形も通る → allow は残し、deny に狭い形 `Bash(git diff *--output*)`・`Bash(git log *--output*)`・`Bash(git show *--output*)` と PowerShell の形を足す（`git *--output*` はコミットメッセージなどにも当たるので使わない）。引用で割る形はすり抜けるので README に書く
  - **実験の結果（2026-10-31、Claude Code 2.1.312）：`--output` の形も通る → 下の枝にする。** allow を `git fetch origin` だけにした設定で、`git diff --output=x1`・`git log --output=x2 -1`・`git diff --out'put'=x4` は `{"decision":"accept","source":"config","reasonType":"subcommandResults"}`（組み込みの許可）でファイルができた。`git --no-pager diff --output=x3` は `reject`（`bashMiss:no-rule-match`）。`git fetch origin` は `ruleSource: flagSettings` で accept（`--settings` の allow は効く）
- ask は置かない（今のテストの決まりのまま）

### 3. テスト
- 新規 `plugins/ai-team/hooks/test-guard-bash.mjs`（依存なし。今のテストの書き方に合わせる）：
  - 本物のラッパー（フックの根・マーケットプレイスの写し・`CLAUDE_CONFIG_DIR` を変えたときの写し・`/c/…` 形・一重引用・引用なし・`\` 区切り・`cd <wt> && ` つき・`.ps1`）→ allow。写しの根は一時フォルダに作って `CLAUDE_CONFIG_DIR` で指す（PC に写しが無くても通る）
  - マーケットプレイスの写しが無いときも、フックの根の本物 → allow
  - リポジトリの中の偽物（`tools/ai-team-skills/ai-team/x/skills/codex/scripts/invoke-codex.mjs`）・`..` で出る形・`; rm`・`$(…)`・`cd $(…) &&` つき・`node -r ./x.js "<本物>"`・`node --import ./x.mjs "<本物>"`・`NODE_OPTIONS=--require=./x.js node "<本物>"` → 判定なし
  - どの入力でも ask・deny を返さない
- `test-guard-code-edit.mjs:676-706`：ラッパーの allow の確かめを「無いこと」に変え、`git show:*`・`vendor/bin/phpcs:*` が無いこと、`git show` の名前の deny 4つ（Bash・PowerShell）があることを足す（`--output` は 2 の実験の結果に合わせる）。hooks.json の確かめに新しいフックを足す

### 4. 文書
- `README.md`
  - 「使うリポジトリごと」の 2：phpcs の allow はテンプレートに無い。PR の中身を信じられる案件だけ足す（phpcs は `phpcs.xml` の `<autoload>`・`<rule ref>` でリポジトリの PHP を動かすため。`vendor/` を追跡している案件では実行ファイルそのものも PR の中身）。足さなくても、auto では判定器に回るだけ
  - 「入ったかを確かめる」の 2 と「つまずきやすいところ」：ラッパーはフックで通る。記録の `permissionDecision` の見え方を実験の結果で直す（フックの allow の理由は記録に残らないことがあるので、見える印を実験で決める）。「Bash にしか無い」の話を直す
  - 「導入済みのリポジトリへの反映」の #100 の段（`:185-189`）を、プラグインを新しい版にしてから settings.json の4行（ラッパー2・`git show`・phpcs）を消し、`git show` の名前の deny（と、実験で決めた `--output` の扱い）を写す手順に書き換える。gh-pr の呼び方（マーケットプレイスの写しの `.ps1`）は、今のテンプレートの allow にも当たっておらず、フックで初めて確認なしになる、と書く（**プラグインが先**。逆だと、古い版の間は健さんの呼び出しが確認に回り、バックグラウンドの gh-pr などが止まる）
  - 「中身」の表に `guard-bash.mjs`。`:290` の「柵であって壁ではない」に、Read の deny は `cat`・`head`・`tail`・`sed`・`tee`・リダイレクトにも効くが、`grep -r`・スクリプト・`git diff`・`git log -p` には効かないこと、`git show` は名前を含む形だけ止め、引用で割る形・ハッシュで指す形はすり抜けることを足す
  - phpcs の allow を外したので、Manual ではメジェドのチェックに確認が出る（auto は判定器）ことを、「使うリポジトリごと」の 2 に書く（まーちゅう OK 2026-10-31）
  - チェックコマンドの表に新しいテスト
- `plugins/ai-team/skills/codex/SKILL.md:83`：settings.json の allow の話をフックに合わせる

### 5. イシュー #109 へのコメント（ガネーシャ）
- git の扱いの判断と理由：`git show` は名前を含む形を deny で止める（完了条件の `git show HEAD:<秘密情報>` は、確認ではなく deny で止まる）。フックでの読み解きをやめた理由（index 形・引用・`--name-only` でも中身が出る `git show <rev>:<パス>`、など）。`git diff`・`git log -p` が止まらない限界。`--output` の実験の結果
- Read の deny の大小：Windows で一時フォルダに `wp-config.php`（比べる用）・`WP-CONFIG.PHP`・`.ENV` を置き、**その一時フォルダを cwd にして**（`**/…` は cwd の下にしか当たらないため）`claude -p --settings <テンプレートの絶対パス>` で Read させて記録の `permissionDecision` を見る。小文字の比べる用が deny にならなければ、実験の形が違うとして判断しない。結果と、直すか（直すなら別イシュー）を残す。Mac は「未確認」

## やらないこと
- `git diff`・`git log -p`・`grep -r`・スクリプトでの秘密情報の読み取りを止めること（sandbox などは、必要なら別イシュー）
- Read の deny の直し（5 で判断を残すまで）
- 各リポジトリへの実際の反映（頼まれてから）

## 確かめ（PR の前・ガネーシャ）
- `node plugins/ai-team/hooks/test-guard-bash.mjs`・`test-guard-code-edit.mjs`・`test-session-start.mjs`・`skills/codex/scripts/test-invoke-codex.mjs`、`claude plugin validate .`・`plugins/ai-team`（バックグラウンドで）
- worktree の根で `claude -p --plugin-dir plugins/ai-team --settings repo-files/claude/settings.json --output-format stream-json --verbose`（`enabledPlugins` は渡さない）を default と auto で打ち、記録の `permissionDecision` で判定：
  - 本物のラッパー `-Mode check`（worktree の `plugins/ai-team/skills/codex/scripts/invoke-codex.mjs`＝`--plugin-dir` のときのフックの根、と、マーケットプレイスの写しの `.ps1` を `cd … &&` つきで）→ 確認なしで通る
  - 偽物のラッパー → default で reject、auto で classifier（フックの allow に当たらない）
  - `git fetch origin` → `source: config`（`--settings` の allow が効いている証拠。組み込みの許可では通らないもの）
  - `git show HEAD:wp-config.php`・`git show :0:wp-config.php`（追跡した一時のファイルで）→ deny。auto でもセッションは止まらず次のコマンドを打てる
  - `--output` の形（`git diff --output=x`・`git --no-pager diff --output=x`・`git log --output=x`・`git diff --out'put'=x`）→ 2 で決めた扱いどおり（`x` ができたかも見る）
  - `git log --oneline -1`・藤さんの除外つき `git diff`・`git commit` のメッセージに `--output` を含む形（`--dry-run` で）→ 通る
- キャッシュの形（入れたプラグイン）は、マージ後に入れたリポジトリで README の「入ったかを確かめる」の 2 で確かめる
- 結果を PR 本文と #109 に書く。差分にローカルのパスが無いこと

## 承認前の確認（藤さんの定義どおりの Fable・1回目・2026-10-30）
- 採った：2（phpcs の cwd・複合・失敗時）・3（`--output` の書き込み）・7（Bash の読み取りの限界を README に）・8（`/c/…` 形・リンク）・9（gh-pr の `cd &&` とマーケットプレイスの写し）
- 方針を変えて不要になった：1・4・5・6・10・11・12（git の読み解きをやめたため）

## 承認前の確認（藤さんの定義どおりの Fable・2回目・2026-10-31）
- 採った：1（phpcs は phpcs.xml でリポジトリの PHP を動かす → フックの判定をやめ、テンプレートから外す）・2（Read の実験は cwd の下で）・3（`--plugin-dir` の確かめの根）・4・5（`--output` を `git *--output*` に）・6（`CLAUDE_CONFIG_DIR`）・7（node の前置きのテスト）・9（反映はプラグインが先）
- 前提の書き方を直した：8（auto での ask。まーちゅうに場面を確かめる）
- 方針を変えて不要になった：10・11（phpcs のフックをやめたため）

## 承認前の確認（藤さんの定義どおりの Fable・3回目・2026-10-31）
- 採った：1（`cat` は Read の deny で止まる。ガネーシャの誤り → git の扱いを選び直してもらった）・2・3（`git *--output*` は広すぎ・引用で抜ける → 実験で決める）・4（phpcs を外すと Manual でメジェドに確認 → まーちゅう OK、README に書く）・5（写しが無い根）・6（引用の形）・7（`git fetch origin` で allow が効いた証拠）・8（フックの allow の記録の見え方）・9（gh-pr は今も確認に回っている）

## 実装の後の確かめ（2026-10-31）

### `-p` の確かめ（Claude Code 2.1.312。`--plugin-dir` と `--settings` にこのブランチの版）
- default：本物のラッパー（worktree の `.mjs`・マーケットプレイスの写しの `.ps1` を `cd … &&` つき）→ `{"decision":"accept","source":"hook","reasonType":"hook"}`。偽物のラッパー → `reject`（`bashMiss:no-rule-match`）。`git show HEAD:wp-config.php`・`git show :0:wp-config.php`・`git diff --output=x` → `reject`（`rule:flagSettings`）。`git log --oneline -1`・除外つきの `git diff`・`git show --stat HEAD`・`git show HEAD:a.txt` → accept（`subcommandResults`）。`git -C . show HEAD:wp-config.php`・`git --no-pager show HEAD:wp-config.php` → `reject`（`bashMiss:no-rule-match`。deny には当たらないが、組み込みの許可にも当たらない）。`git fetch origin` → accept（`ruleSource: flagSettings`）
- auto：偽物のラッパー → `reasonType: classifier` で accept（判定器が通した。README に限界として書いた）。`git show HEAD:wp-config.php`・`git diff --output=x` → deny。その後も同じセッションで、本物のラッパー（`hook`）と `git log` を打てた（deny でセッションは止まらない）

### Read の deny の大小（Windows）
- 一時フォルダを cwd にして `--settings <テンプレート>` で Read：`a/wp-config.php`・`b/WP-CONFIG.PHP`・`c/.ENV` の3つとも `{"decision":"reject","source":"config","reasonType":"rule","ruleSource":"flagSettings"}`。Windows では大文字小文字を区別せずに当たる → 直さない。Mac は未確認

### 健さん（review -Container。5巡）
- コンテナの中では、テストの子プロセスが `spawnSync` の `EPERM` で動かず、5巡とも健さんはテストの合否を確かめられなかった。合否は、この PC（Windows）で4本、Linux のコンテナで `test-guard-bash.mjs`（リンクの確かめを含む）を打って確かめた
- 1巡目：必須1（引用の外の `#` のコメントの中の引用符で読み方がずれ、改行の後のコマンドごと allow）→ 直した。回帰テストを足した
- 2巡目：必須1（引用なしのパスの `* ? [ ] { }` で、照らすファイルと動くファイルがずれる）・推奨1（チェックアウトのパスに空白があると、引用なしの形のテストが誤って落ちる）→ 両方直した
- 3巡目：必須1（`.ps1` だけ本物へのリンクにし、隣に偽物の `.mjs` を置くと、中継が偽物を動かす）→ `.ps1` のときは隣の `.mjs` の実体も照らす
- 4巡目：必須1（二重引用のパスの `\` と改行をシェルが消す）→ パスの語の改行を受けない。あわせて、前後を落とした後のコマンドに制御文字があれば判定しない
- 5巡目：指摘なし

### 藤さん（定義どおりの Fable。差分。1巡）
- 必須なし。推奨7件
- 採った：1（前置きつきの `git show` を README の限界に。実験で、Manual は確認・auto は判定器と確かめた）・5（名前の deny の広さを README に）・7（README の2か所の古い説明）
- 実験で問題なしと確かめた：2（`git show` の allow を消しても、ふつうの形は組み込みで通る）・3（`git diff --output=x` に deny が当たる）・6（auto でもフックの allow で通る）
- 見送った：4（`git diff`・`git log` の秘密情報の読み取りを止めないのは、まーちゅうの選択。README に限界として書いてある）
