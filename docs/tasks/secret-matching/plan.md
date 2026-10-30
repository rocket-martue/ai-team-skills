# 計画：秘密情報の照らし方を、名前の書き方（`\`・`?`・Unicode の正規化）で外せなくする（#107）

- 作成：2026-10-30 ガネーシャ
- ブランチ：`fix/107-secret-matching`（worktree：`C:\Temp\wt\ai-team-skills-107`）
- イシュー：#107（Closes）。見直しの結果は #104
- 実装：メジェド

## やること

1. `\` を `/` に置き換えるのを、Windows のときだけにする
   - 今の置き換え箇所は2つ：`plugins/ai-team/hooks/ai-team-config.mjs` の `check` の入口（`isSecretPath(p.replace(/\\/g, '/'), extra)`）と、`plugins/ai-team/skills/codex/scripts/invoke-codex.mjs` の `relOrAbs` の最後の `.replace(/\\/g, '/')`
   - Linux・Mac では `\` はただの名前の文字。置き換えると `.env\local` が `.env/local` になり `.env*`（`[^/]*`）に当たらない。置き換えなければ `.env\local` 全体が `.env*` に当たる
   - `foldsForMatch` と同じく、OS を引数で差し替えられる形にする（例：`isWindows = process.platform === 'win32'`）。テストが Windows・Linux のどちらでも、両方の枝を確かめられるようにするため
   - ガード側（`guard-code-edit.mjs`）は `path.sep` で区切るので変えない。ラッパーの照らしをそれに合わせる
2. `globToRegExp` の `new RegExp(source + '$')` に `u` フラグを付ける
   - `?` を `[^/]`（UTF-16 の1単位）から、コードポイント1つに当たる形にする。`private/?.json` が `private/🔑.json` に当たる
   - 付ける前に確かめる：`u` フラグは、`\` の後ろが構文文字以外だと SyntaxError にする。今のエスケープ（構文文字だけを `\` で逃がす）は通るはずだが、`-`・`/`・日本語・絵文字を含むグロブで `new RegExp` が投げないことをテストで確かめる
   - 壊れたグロブは今と同じく Error → 「設定が壊れている」扱いのまま
3. Mac の Unicode の正規化（NFC・NFD）は「確かめて判断を残す」までにする。コードは変えない
   - 疑い：APFS は名前の正規化を区別せずに開けるが、グロブの照らしは文字列の比べなので、NFC のグロブ（`秘密/ぱ*`）が NFD の名前（`ぱ` が `は`＋濁点）に当たらない道がありうる
   - 確かめ方（Mac の実機で）：
     1. 一時フォルダに NFD の名前のファイルを作る（`node -e "require('fs').writeFileSync('ぱ.txt'.normalize('NFD'), '')"`）
     2. `fs.readdirSync` が返す名前が NFD か NFC かを見る（`name.normalize('NFC') === name`）
     3. NFC の綴りでも開けるかを見る（`fs.readFileSync('ぱ.txt'.normalize('NFC'))`）
     4. NFC のグロブ `ぱ*` の `globToRegExp` が、NFD の名前に当たるかを見る（当たらないはず）
     5. ガードが受けるパスの綴り（ツールの入力のまま＝NFC が多いのか、OS が返す綴りか）を見る
   - 結果と判断（そろえる／そろえない、理由）をイシュー #107 のコメントに残す。そろえるなら別のイシューにする（`forMatch` に `normalize('NFC')` を足す案）。Mac が手元に無い間は、手順を書いて「未確認」と残し、このイシューの正規化の項は閉じない
   - Linux・Windows でも、NFC と NFD を区別して当てることだけは、テストで事実として記録する（OS に依らない）

   - 状態：Mac が手元に無いので **未確認**（2026-10-30）。Linux・Windows のテストには、NFC のグロブが NFD の名前に当たらない事実を記録した（`test-guard-code-edit.mjs`）。Mac での確かめ結果と判断は、確かめたあとに #107 へ

## やらないこと

- Mac の正規化をそろえる実装（確かめて判断を残すまで）
- グロブの記号の追加（`[` `]` `{` `}` `\` は今と同じく壊れている扱い）
- ガードの区切りの扱い（`path.sep`）と大小文字の畳み（`forMatch`）の変更

## 完了条件

- `test-guard-code-edit.mjs` と `test-invoke-codex.mjs` に、Windows・Linux で通る確かめがある
  - `\`：Linux の扱い（`.env\local` が `.env*` に当たる）と、Windows の扱い（`.env\local` は `.env/local` になって `.env*` には当たらない。`.kv\x` は `.kv/x` として当たる）を、OS の引数で両方確かめる。ラッパーの `relOrAbs` も同じ
  - `?`：`private/?.json` が `private/🔑.json` に当たり、`private/ab.json` に当たらない。`?` は1コードポイントに当たるので、Mac の NFD で濁点つきの文字（2コードポイント）になった名前には当たらない（正規化は未確認の範囲）
  - `u` フラグを付けても、既定のパターン（`.env*`・`wp-config.php` など）と今のテストが同じに通る
- 正規化は、Mac で確かめた結果と、そろえるかどうかの判断が、イシュー #107 に残っている（Mac が無い間は、確かめ方と「未確認」）

## PR のレビュー（藤さん・1巡目）で直すこと（まーちゅう OK 2026-10-30）

1. 完了条件の `\` の項の「Windows の扱い（`.env\local` が `.env/local` として当たる）」は事実と違う。`.env/local` は `.env` フォルダの中になり、`.env*`（`/(^|\/)\.env[^/]*$/`）には当たらない（`test-guard-code-edit.mjs` の確かめのほうが正しい）。正しくは「Windows の扱い（`.env\local` は `.env/local` になって `.env*` には当たらない。`.kv\x` は `.kv/x` として当たる）」
2. `test-guard-code-edit.mjs` の「既定のパターン（u なし）と同じに通る」ブロックは、`SECRET_PATTERNS`（`globToRegExp` を通らない）だけを照らしていて、`u` フラグの影響を確かめていない。設定ファイルの `secretPatterns`（`globToRegExp` を通る。`**/`・`/**`・記号のエスケープを含むグロブ）経由で、`u` 付きでも今までどおり当たる・当たらないを確かめる形に直す（名前も中身に合わせる）
3. Linux の本番の道の確かめ：`test-invoke-codex.mjs` に、名前に `\` を含む未追跡の秘密情報のファイル（例 `.env\local`）がある review が「秘密情報」で止まり、偽物の codex を呼ばないことの通しの確かめを足す（Linux・Mac だけ。Windows は名前に `\` を使えないので skip）。直す前のコード（`git show HEAD:` の写し）では止まらないことを確かめる
4. `?` は1コードポイントに当たるので、Mac の NFD で濁点つきの文字（2コードポイント）になった名前には当たらない（正規化は未確認の範囲）
