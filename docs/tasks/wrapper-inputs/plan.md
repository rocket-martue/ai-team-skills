# 計画：ラッパーが自分で読んで送るものと、git に渡す値を確かめる（#106）

- 作成：2026-10-30 ガネーシャ
- ブランチ：`fix/106-wrapper-inputs`（worktree：`C:\Temp\wt\ai-team-skills-106`）
- イシュー：#106（Closes）。見直しの結果は #104
- 実装：メジェド

## やること（対象は `plugins/ai-team/skills/codex/scripts/invoke-codex.mjs` と、その確かめ `test-invoke-codex.mjs`）

1. `-PromptFile`・`-Image` のファイルを、送る前に秘密情報の照らしに通す
   - 照らすのは「見たままのパス」と「リンクをたどった実体のパス」の両方（`fs.realpathSync.native`）。どちらかが秘密情報なら止める
   - 照らし方は共有モジュールの `check` を使う（判定の正本を1つにする）。`check` はリポジトリの根からの相対パスを受けるので、ファイルが作業の根の中なら相対パスで、外なら絶対パス（区切りは `/`）で渡す（既定の4つのパターンは `(^|/)` で始まるので、絶対パスでも当たる）
   - 止める文は「頼みの文のファイル（または参照画像）が秘密情報なので、健さんに送りません: <パス>」
2. `-WorkingDirectory` が、ホームの `.codex`・`.ssh`・`.aws`・`.gnupg`・`.config/gh`・`.claude` の中（またはそのもの）を指すときは止める（Windows は大文字小文字をそろえて比べる。`sameLocation`・`isUnderLocation` と同じそろえ方）
3. `-Base` が `-` で始まるときは止める（「基準ブランチの名前が - で始まっています」）。git に渡すところは、今の引数の形を変えない
4. consult・image の頼みの文の頭（最初の空でない行）が「ガネーシャから」か「メジェドから」で始まらなければ止める（健さんの AGENTS.md は、この頭が無いと「まーちゅうが直接使うとき」として範囲の制限と「秘密情報を開かない」を外すため）。`.claude/ai-team.json` の `names` で呼び名を変えていても、頭は既定の名前で書く決まり（SKILL.md）なので、既定の名前だけを受ける
5. メインのチェックアウトの根（`getMainRoot`）：`git worktree list --porcelain -z` で読む（名前の改行・末尾の空白で崩れないように）。git が失敗したとき・1件目の場所がディレクトリでないときは、黙って作業の根に戻らず止める。ただし、Git のリポジトリでないフォルダ（consult は #97 で通す）では、今までどおり作業の根だけで進める（`git rev-parse --is-inside-work-tree` が失敗するなら、リポジトリでないとみなす）
6. `findCodex` で、PATH の相対の項目（`path.isAbsolute` でないもの）を飛ばす（`findDocker` と同じ）
7. `findDocker` の上の注記「Windows は、名前だけで起動するとカレントディレクトリの docker.exe を先に拾うため」を、「名前だけでなく、見つけた場所を確かめて起動するため」のような、当たっている理由に直す（#104 で試して、拾わなかった。絶対パスで起動する守りは残す）

## やらないこと

- `-Container` の流れ・共有モジュール（`ai-team-config.mjs`）・ガードは変えない（ガードは #108 で別に直している）
- `-Container` を付けない review・consult の codex への引数は変えない

## 完了条件

- 上の 1〜6 のそれぞれに、止まる側（と、通る側が要るものは通る側）の確かめが `test-invoke-codex.mjs` にある
  - `-PromptFile .env`・作業の根の外の秘密情報の名前のファイル・秘密情報へのリンク・`-Image` に `.kv/x.png`
  - `-WorkingDirectory` にホームの `.codex`（テストでは HOME・USERPROFILE を一時ディレクトリに向けて作る）
  - `-Base --output=x`
  - 頭の無い頼みの文（consult）・「メジェドから」で始まる頼みの文は通る
  - PATH の先頭に相対の項目（`.`）があり、その場所に偽物の codex を置いても、PATH の後ろの偽物の codex（テストの偽物）が選ばれる
- 今のテストが全部通る（Windows で `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs`。今の引数の確かめ（「引数:」の3件）も通る）
- 本物の codex は呼ばない（テストの最初の確かめのとおり）
