# 計画：健さんのラッパーを Node.js で書き直し、Windows・Mac・Linux で動くようにする（#100）

- 作成：2026-10-30 ガネーシャ
- 改訂：2026-10-30 D4 をまーちゅうの決定に直した。藤さん（計画の段）の指摘で、共有モジュールは今と同じく子プロセスで呼ぶ形に戻し、マージの順番（D5）・Linux と Mac での細部・完了条件を直した（下の「藤さんの指摘の扱い」）
- ブランチ：`feat/100-node-wrapper`（worktree：`C:\Temp\wt\ai-team-skills-100`）
- イシュー：#100（Closes）。この後に #99（コンテナ）を、Node の前提に計画を直して進める

## 目的

健さんのラッパー（`invoke-codex.ps1`）は Windows PowerShell 用で、Mac と Linux（devcontainer を含む）では健さんを使えない。チームの開発者は Mac が多い。Node.js はフックのためにもう前提になっているので、ラッパーを Node.js で書き直す。

PowerShell だったのは、元にしたサンプルのスキルが PowerShell だったため（`docs/tasks/codex-skill/plan.md` 36 行目。Mac・Linux は当時わざと外していた：同 134 行目）。

## 決めてほしいこと（まーちゅう）

| # | 決めること | おすすめ | ほかの案 |
| --- | --- | --- | --- |
| D1 | 引数の形 | 今と同じ名前（`-Mode`・`-PromptFile`・`-WorkingDirectory`・`-Image`・`-Base`・`-Task`）。大文字小文字の違いは受ける。前方一致（`-M` など）は受けない（今の呼び手は全部正式名）。呼び方の変更が、頭の `powershell.exe ... .ps1` を `node ... .mjs` に変えるだけで済む | Node でよく見る形（`--mode consult`）にする |
| D2 | 古い呼び方（`powershell.exe ... invoke-codex.ps1`） | `.ps1` を、受け取った引数をそのまま `invoke-codex.mjs` に渡すだけの中継にして残す。gh-skills の gh-pr（`.ps1` を直書き）と、手で打つ人の呼び方がそのまま動く。消すのは別のイシュー | すぐ消す |
| D3 | Windows での `codex` の呼び方 | PATH から `codex` を探し、`.exe` ならそのまま、npm のシム（`.cmd`・`.ps1`）なら隣の `node_modules/@openai/codex/bin/codex.js` を、今の node で直接起動する（シェルを通さない。実行ポリシーで止まらない。`.cmd` を通すと引数の引用が崩れる）。隣に無いシム（pnpm・bun などで入れた）は飛ばして PATH の後ろも探し、最後まで使えるものが無いときだけ、見つけたシムのパスと「npm で入れ直すか、`codex.exe` を PATH に置く」を出して止める（藤さんの2巡目の指摘で、前で止めていたのを変えた）。Mac・Linux は `codex` をそのまま起動する | `shell: true` で `codex.cmd` を起動する（引数の引用の扱いが難しい） |
| D4 | Mac で確かめる手段 | **決定（まーちゅう 2026-10-30）。** マージの前：この PC で Linux のコンテナ（`node:22-bookworm`）でテストを通す。Mac の開発者に頼めるなら、ブランチを clone してテストを1行打ってもらう（任意。テストは偽物の codex で動くので、Codex のインストールもアカウントも要らない）。マージの後：Mac の開発者に、本物の健さんを一度呼んでもらう。動かなければ別のイシューで直す。PR 本文に、Mac でどこまで確かめたかを書く（今の Mac は健さんを使えないので、この PR で悪くなることは無い） | Mac で確かめるまでマージしない |
| D5 | 導入済みのリポジトリの allow（藤さんの必須 1） | **マージの前に**、導入済みのリポジトリの `.claude/settings.json` に `.mjs` の allow の行を足す（リポジトリごとの小さな PR。足すだけなら、この PR の前でも害は無い）。全部入ってからこの PR をマージする。プラグインは allow を足せず（`docs/tasks/plugin-ai-team/plan.md` 29 行目）、SKILL.md は自動更新ですぐ届くので、順番が逆だと、健さんを呼ぶたびに確認が出る（auto モードでは止まる） | SKILL.md に、Windows は `.ps1`・Mac と Linux は `.mjs` と2つの呼び方を書く（allow の差し替えを急がなくてよいが、呼び方が2つになる） |

**決めたこと（まーちゅう 2026-10-30）：D1〜D5 とも、おすすめのとおり。** 公開しているので、ほかの人の導入済みのリポジトリは README の「導入済みのリポジトリへの反映」で知らせる（この版から `.mjs` の行が要ること・足す行・足さないと起きること・古い呼び方なら Windows では今までどおり動くこと）。

以下は、その中身。

## 変えるもの

| ファイル | 中身 |
| --- | --- |
| `plugins/ai-team/skills/codex/scripts/invoke-codex.mjs`（新規） | 今の `.ps1` と同じ動き（モード・確かめ・止まり方・終了コード・返事の出し方）を Node.js で。共有モジュール（`hooks/ai-team-config.mjs`）は、今と同じく CLI（`check`）を子プロセスで呼び、印（`ai-team-config: ok`）を確かめる（判定と止まり方を変えないため）。パスは `path` で扱い、`\` を決め打ちしない（画像の保存先の照らし、`CODEX_HOME` の既定 `~/.codex`）。codex の出力（進み具合）はメモリに溜めず一時ファイルに流し、失敗したときだけ末尾 20 行を出す（`spawnSync` の出力の上限で途中で止まらないため）。引数は D1 |
| `plugins/ai-team/skills/codex/scripts/invoke-codex.ps1` | 中継だけにする（D2）。`node` が無ければ今と同じ文で止める。標準入出力を UTF-8 にそろえ、node を呼ぶ間は `$ErrorActionPreference` を `Continue` にして、node の終了コード（image の 2 を含む）をそのまま返す（今の `.ps1` と同じ避け方） |
| `plugins/ai-team/hooks/ai-team-config.mjs` | 秘密情報の照らしで、大文字小文字をそろえるのを win32 だけから、darwin（Mac）にも広げる（Mac の既定のファイルシステムは大文字小文字を区別せず、`.ENV` で `.env` が開けるため。ガードにも効く）。頭のコメントの `invoke-codex.ps1` を `.mjs` に |
| `plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` | `.mjs` を直接呼ぶ形にする。win32 だけで止める頭を外す。偽物の `codex` を、Windows（`codex.cmd` と隣の `node_modules/@openai/codex/bin/codex.js`）と Mac・Linux（実行できる `codex`。改行は LF）で作る。子プロセスの環境を OS ごとに組む（PATH の区切り、`git` の探し方、一時ディレクトリは `TEMP`・`TMP`・`TMPDIR` の全部を向ける）。最初の「偽物を指すか」の確かめも OS ごとに。Windows だけの確かめ（中継の `.ps1`：引数と終了コードがそのまま渡る・日本語の返事が化けない）を足し、ほかの OS では飛ばしたと出す。足す確かめ：pnpm 型（シムの隣に `codex.js` が無い）で止まる。Mac の大文字小文字は `test-guard-code-edit.mjs` 側で |
| `plugins/ai-team/hooks/test-guard-code-edit.mjs` | darwin の大文字小文字の確かめ（`process.platform` を差し替えられないので、判定の関数に OS を渡せる形にして確かめる）。settings.json の allow の確かめに `.mjs` の行 |
| `plugins/ai-team/skills/codex/SKILL.md` | 呼び方と `allowed-tools` を `node "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.mjs" *` に。「Windows PowerShell」の記述を直す |
| `plugins/ai-team/agents/mejed.md`・`adversary.md` | 呼び方（メジェド）と、呼ばないものの名前（藤さん）を `.mjs` に |
| `repo-files/claude/settings.json` | allow に `Bash(node "*/ai-team-skills/ai-team/*/skills/codex/scripts/invoke-codex.mjs" *)` を足す。`.ps1` の行は残す（D2） |
| `README.md` | 前提の「ラッパーは Windows PowerShell 用」を直す。「入ったかを確かめる」の `-Mode check` を `.mjs` の形に。導入の手順に、Mac・Linux での読み替え（`claude` の場所、信頼は1回でよい、写すコマンドを bash で）を足す。「中身」の表とチェックコマンドの表。「導入済みのリポジトリへの反映」に、この版で settings.json に `.mjs` の行を足すことを書く |

導入済みのリポジトリ（D5）：マージの前に、`~/.claude/plugins/installed_plugins.json` の ai-team の project スコープの記録から一覧を作り、各リポジトリの `.claude/settings.json` に `.mjs` の行を足す PR を出す（リポジトリごと。まーちゅうがマージ）。この PR の本文に一覧と各 PR を書く。

## 変えないもの（やらないこと）

- モード・秘密情報の確かめ・止まる条件・返事の出し方（動きは今と同じ。Mac の大文字小文字が厳しくなるのと、PR の前の review で見つかった「大文字を含む `secretPatterns` のグロブが当たらない」穴を塞ぐので、Windows でもその分だけ厳しくなる）
- `.ps1` を消すこと（別のイシュー。D2）
- gh-skills の gh-pr の呼び方（中継の `.ps1` で今のまま動く）。gh-pr の呼び方が、テンプレートの allow（キャッシュの形）に今も当たっていないこと（マーケットプレイスの写しを呼んでいるため。この PR より前からある。藤さんの推奨 9）は、gh-skills 側で別に
- #99（コンテナ）。この PR の後に計画を直す
- `docs/tasks/` の過去の記録

## 確かめること（完了条件）

- この PC（Windows）で `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` が全部通る
- 今のテストの確かめが、名前を変えずに全部残っている（この PR の前と後で、確かめの名前の一覧を比べる。中身を変えてよいのは、`.mjs` を直接呼ぶための呼び方と、OS ごとの環境の組み方だけ）。飛ばす確かめ（シンボリックリンク・ジャンクションを作れない環境、ほかの OS での Windows だけの確かめ）は、名前と「飛ばした」を出す
- Linux のコンテナ（`node:22-bookworm`。git を含む）で、同じテストが全部通る
- 中継の `.ps1` で、`.mjs` を直接呼んだときと同じ引数が偽物の codex に届き、終了コード（0・1・2）と日本語の返事がそのまま返る（Windows のテスト）
- `test-guard-code-edit.mjs`・`test-session-start.mjs` が通る
- 実機（この PC）で、`.mjs` の consult・review が健さんを呼べ、check が健さんを呼ばずに `CHECK: ok` を返す。古い呼び方（`.ps1`）でも同じ
- `claude plugin validate .`・`claude plugin validate plugins/ai-team` が通る
- D5 の一覧のリポジトリ全部で、`.mjs` の allow を足す PR がマージされている（この PR のマージの前に）
- Mac は D4 のとおり。マージの前に確かめられた範囲を PR 本文に書く

## #99 のための確かめ（完了条件には入れない）

- Linux のコンテナの中で、Codex の sandbox（`workspace-write`）でテストが走るか。#39 の PoC では Docker の既定の設定で止まったので、devcontainer でも同じになるかを見る
- 結果は #99 にコメントで書く

## 実装とレビュー

- 実装はガネーシャ。テストの偽物と OS ごとの環境の作り直しは、メジェドに頼むかもしれない
- PR の前に健さんの review（この PR の `.mjs` で呼ぶ）と藤さん

## 藤さんの指摘の扱い（計画の段・1回目）

- 採った（必須 2 件）：新しい呼び方が導入済みのリポジトリの allow に当たらない → D5（マージの前に各リポジトリに `.mjs` の行を足す）。「51 件」の完了条件が判定できず、import に変えるとスタブの確かめが成り立たない → 共有モジュールは今と同じく子プロセスで呼び、完了条件を確かめの名前の一覧で比べる形にした
- 採った（推奨）：pnpm・bun でシムの隣に `codex.js` が無いとき（D3）／中継の `.ps1` の文字化けと終了コード（`.ps1` の行と完了条件）／Linux でのテストの環境（一時ディレクトリ・PATH・git・改行）／出力の上限（一時ファイルに流す）／Mac の大文字小文字（`ai-team-config.mjs` の行）／引数の受け方（D1）
- 記録だけ（この PR の外）：gh-pr の呼び方がテンプレートの allow に今も当たっていない（推奨 9）
- 確かめていないこと：`node:22-bookworm` に git があるか（PoC で使ったイメージの元なので、実装の最初に確かめる）。Mac での `${CLAUDE_PLUGIN_ROOT}` の展開の形（D4 のマージの後の確かめで分かる）

## PR の前のレビュー（1巡目）

- 健さん（新しい `.mjs` の review で呼んだ）：3件、どれも採った。大文字を含む `secretPatterns` のグロブが、小文字にそろえたパスに当たらない（Mac で新しく、Windows では前から）→ グロブも `forMatch` でそろえる／Linux の一時ディレクトリがほかのユーザーから読める → `mkdtemp`（700）とログを 600 に／Mac で参照画像と出力の比べ方が大文字小文字で外れる → Mac も区別しない比べ方に
- 藤さん：必須なし・推奨5件。採った：中継の `.ps1` で、空白を含み末尾が `\` の値で引数が崩れる（PowerShell 5.1 の引数の渡し方）→ 末尾の `\` を重ねる（直す前の `.ps1` では足した確かめが落ちることを確かめた）／グロブの直しが Windows の判定も変える → 「変えないもの」に書いた。採らない：review の標準入力を空にしている（実機の review が通ったので今の版では問題ない）。記録だけ：gh-pr の説明が `.ps1` を「ラッパー」と呼んでいる（gh-skills 側）、中継の標準エラーに `#< CLIXML` が混じる（前の `.ps1` から）

## PR の前のレビュー（2巡目）

- 健さん：3件、どれも採った。Mac の大文字小文字を区別する APFS で、ガードの場所の判定（中か外か）が `Repo` と `repo` を同じと見る → 秘密情報の照らし（`forMatch`。Windows・Mac でそろえる）と場所の判定（`forPath` を足す。Windows だけ。前と同じ動き）を分けた／Linux で、ほかのユーザーが先に `/tmp/claude` を作ると使えない → Mac・Linux は一時ディレクトリの直下に `mkdtemp`（Windows は前と同じ `%TEMP%\claude\`）／TEMP のパスに空白があるとテストの比べ方がずれる → 偽物が引数を配列でも残し、`-o` の値をまるごと置き換えて比べる
- 藤さん：必須なし・推奨4件。採った：中継の `.ps1` が空の値（`-Base ""`）を落とす → `""` として渡す／前のシムの隣に `codex.js` が無いと、PATH の後ろの `codex.exe` を見ずに止まる → 後ろも探す（D3）。健さんの指摘と重なった：`/tmp/claude`。記録だけ：ganesha-mejed-channel の作業中のブランチに `.mjs` の行が無い（main を取り込めば入る）
- 起きたこと：「後ろも探す」に直した後、pnpm の形の確かめが、テストの PATH にある node のフォルダの本物の codex に届き、本物の健さんを1回呼んだ（テストの仮のリポジトリに「相談です」を送っただけ。read-only）。その確かめの PATH から codex のあるフォルダを全部外し、3巡目で最初の確かめに「偽物の `codex.js` がある」を足した

## PR の前のレビュー（3巡目）

- 健さん：1件、採った。Mac の大文字小文字を区別する APFS で、設定を読む根を重ねないための比べ方が `Repo` と `repo` を同じと見て、メイン側の設定を読み落とす → 場所の比べ方（`sameLocation`。Windows だけそろえる）に分けた（Mac でしか起きないので、テストでは再現できない）
- 藤さん：必須なし・推奨6件。採った：中継の回避策は PowerShell 5.1 専用で pwsh 7 では逆に崩れる → 5.1 以下のときだけ使う／シムを飛ばす動きが SKILL.md と D3 に無い → 書いた／Mac・Linux で「飛ばした」と出す数が合わない → 直した／テストが本物に届かない保証が偽物の `codex.js` に頼っている → 最初の確かめに足した／この計画書に2巡目・3巡目の記録が無い → 書いた。知っておくこと（直さない）：既定の（大文字小文字を区別しない）Mac で、リポジトリのパスと綴りの大文字小文字だけ違うパスを渡すと、ガードが「外」と見て止める（止める側に倒れる。2巡目の健さんの指摘（区別する APFS で外を中と取り違える）と裏表なので、安全側のまま残す）

## PR の前のレビュー（4巡目）

- 健さん：指摘なし
- 藤さん：必須なし・推奨2件・表記2件。どれも採った。中継の版の分け方（6 未満）では pwsh 6.0〜7.2 を取りこぼす（引数を自分で正しく引用するのは 7.3 以降の既定）→ `$PSNativeCommandArgumentPassing` があって `Legacy` でないときだけ直さない、に変えた／3巡目に足した「偽物の `codex.js` がある」はテスト自身が直前に作るので落ちようがない。Mac・Linux で偽物に実行の権限が付かないと、ラッパーは後ろの本物に進むのに確かめは通す → 最初の確かめを、ラッパーと同じ見方（Windows はシムの隣の `codex.js`、Mac・Linux は実行できるか）で「ラッパーが選ぶ codex が偽物か」にした／比べ方の名前がファイルごとにずれる → `sameCaseFolded`（`forMatch` と同じ）と `sameLocation`（`forPath` と同じ）にそろえ、対をコメントに書いた／README の `cp -n` が Linux の新しい `cp` で終了コード 1 を返すことがある → 一言足した。D5 の ganesha-mejed-channel は、GitHub の既定ブランチには入っている（手元の clone が古いだけ）

## PR の前のレビュー（5巡目・上限）

- 健さん：1件。生成画像の保存先の下かの判定を、4巡目で「止める側に倒れる比べ方」（Windows・Mac でそろえる）に入れていたが、小文字にそろえると受け入れる範囲が広がる。Mac の大文字小文字を区別する APFS で、保存先の外（`Generated_images/`）の画像を受け入れる → 場所の判定（`isUnderLocation`。Windows だけそろえる）に移した。**5巡目の後に直したもの**（上限のため、もう1巡は回していない。PR 本文に書いて、まーちゅうに見てもらう）
- 藤さん：必須なし。推奨1件（推測）：中継の「直さない」側（pwsh 7.3 以降）はテストが `powershell.exe`（5.1）を呼ぶので通っていない → この PC に pwsh が無く試せないので、確かめていないこととして PR 本文に書く（Claude からの呼び方は `powershell.exe` だけなので、今の使い方には効かない）。表記2件（直さない）：Mac で一時ディレクトリの実体のパスが違うと設定の根が2回渡る（読むだけなので害は無い）／noexec の説明の精度（ラッパーとテストが同じ見方なので、本物には届かない）
