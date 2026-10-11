# レビュー：repo-specific-split

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-11）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：要修正
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：sonnet

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| `claude/ai-team.json` が空の2つの配列だけ | ○ | |
| ガードが設定ファイルを読んで判定し、壊れていれば止め、リンク切れ・リンクの扱いが計画どおり | ○ | ただし指摘1。リンクの確かめのうち、ファイルのシンボリックリンクを使う2つは、この環境で作れずに飛ばした（親の `.claude` のジャンクションのリンク切れは通った） |
| 共有モジュールにだけ判定がある | ○ | ガードには import と使う所だけ。ラッパーには `$SecretPatterns`・`Test-SecretPath` が無い |
| ラッパーが共有モジュールを `node` で呼び、両方の根の設定を読み、壊れていれば止まる | ○ | ただし指摘1。設定ファイルのリンク切れの確かめは、この環境で飛ばした |
| codex の SKILL.md と AGENTS.md の秘密情報の出どころ | ○ | |
| diff-reviewer の「共通規約」・PR のレビューの手順4 | ○ | |
| plan-writer・plan.md の雛形・diff-reviewer に WordPress などの語が無い | ○ | grep 0件 |
| plan.md の雛形の見出し | ○ | |
| common-rules.md の2つの節と設定ファイルの箇条 | ○ | |
| README の各所 | ○ | 「編集できる範囲」の表の番号の振り直しに合わせて、下の注記の番号も直してある |
| 対象外のファイルに差分が無い | ○ | |
| チェックコマンドが通る | ○ | `node claude/hooks/test-guard-code-edit.mjs` 全部通った（skip 2）、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 36/36 |
| 差分にローカルの絶対パス・クライアント識別情報が無い | ○ | |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/hooks/ai-team-config.mjs:137` | 設定ファイルが JSON として読めないとき、`JSON.parse` のエラーの文（`e.message`）を理由に入れている。Node 24 では、この文に読んだ中身の頭がそのまま入る（`node -e` で `JSON.parse("API_KEY=abc123secret")` の文が `Unexpected token 'A', "API_KEY=abc123secret" is not valid JSON` になることを確かめた）。設定ファイルが `.env` などへのリンクのとき、ガードの止める理由（Claude に渡る）とラッパーの出力に、秘密情報の中身が出る | 理由に `JSON.parse` の文を入れず、「JSON として読めません」だけにする。ほかの理由（知らないキーなど）にも、ファイルの中身から取った文字列を入れない（キーの名前は入れてよいかを決めずに、入れない側に倒す）。ガードとラッパーの両方のテストに、中身が `API_KEY=abc123secret` の設定ファイルで止まり、止まった文（ガードの標準エラー・ラッパーの出力）に `abc123secret` が出ない確かめを足す | `ai-team-config.mjs` の理由から `JSON.parse` の文・キー名・グロブの中身を外し固定の文にした。ガードとラッパーのテストに `API_KEY=abc123secret` の設定で `abc123secret` が出ない確かめを足した（ラッパーは知らないキー名の場合も） | 解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

### 確かめられなかったこと

- ファイルのシンボリックリンクを作れない環境なので、「設定ファイルがリンク切れ」（ガード・ラッパー）と「設定ファイルが `.env` へのリンク」（ガード）の確かめは飛ばした。コードは読んで、計画どおりの分かれ方になっていることを確かめた

## 第2回（2026-10-11）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目 ／ 承認依頼 1
- メジェドのモデル：sonnet

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 第1回の完了条件 | ○ | 第1回から変わったのは `claude/hooks/ai-team-config.mjs` と2つのテストだけ |
| チェックコマンドが通る | ○ | `node claude/hooks/test-guard-code-edit.mjs` 全部通った（skip 2）、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 38/38 |

### 前回の指摘

| # | 再レビュー | メモ |
| --- | --- | --- |
| 1 | 解決 | `claude/hooks/ai-team-config.mjs` の理由はどれも決まった文（`:73`〜`:174`）で、ファイルの中身から取った文字列を入れていない。ガードとラッパーの両方に、中身が `API_KEY=abc123secret` の設定で止まり、出力に `abc123secret` が出ない確かめがある（`claude/hooks/test-guard-code-edit.mjs:270`・`claude/skills/codex/scripts/test-invoke-codex.mjs:344`） |

### 指摘

- なし

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第3回（2026-10-11）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：要修正
- 出所：健さん・review・1回目
- 数：PR の前の健さん 1回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/hooks/ai-team-config.mjs:199-206` | 設定ファイルがあるかを `lstatSync` で見るとき、失敗をすべて「無い」として次の候補へ進む。アクセス権（`EACCES`）などで読めないときも、足した `secretPatterns` が黙って消え、ガードが秘密情報の編集を通し、ラッパーが review を呼ぶ。plan.md の「設定ファイルの読み方」（読めないときは止める）と食い違う（健さんの指摘。コードを読んで確かめた） | `lstatSync` の失敗のうち、無いことを示すもの（`ENOENT`・`ENOTDIR`）だけを「無い」とし、それ以外は「壊れている（読めない）」として返す。理由は決まった文にする（ファイルの中身や OS のエラーの文を入れない）。テストに、`lstatSync` が `ENOENT` 以外で失敗する場合の確かめを足す（環境で作れなければ、`readConfig` を直接呼ぶ形でもよい。どちらも無理なら飛ばして、飛ばしたことを出力に書く） | `readConfig` の `lstat` の失敗を `ENOENT`・`ENOTDIR` だけ「無い」にし、ほかは固定の文で「壊れている」にした。`lstat` を差し替えられる引数を足し、`test-guard-code-edit.mjs` に `EACCES`・`ENOENT`・`ENOTDIR` の確かめ4件を足した | 解決 |

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/repo-specific-split/codex/08-review.md`（Git に入れない）

## 第4回（2026-10-11）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目（健さんの指摘の直しの後の D1。要修正は無し） ／ 承認依頼 1
- メジェドのモデル：sonnet

### 前回の指摘

| # | 再レビュー | メモ |
| --- | --- | --- |
| 第3回の1 | 解決 | `readConfig` は `ENOENT`・`ENOTDIR` だけを「無い」とし、ほかは決まった文で broken を返す。テストに `EACCES`・`ENOENT`・`ENOTDIR` の確かめがある |

### 指摘

- なし

- チェックコマンド：`node claude/hooks/test-guard-code-edit.mjs` 全部通った（skip 2）、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 38/38

## 第5回（2026-10-12）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：要修正
- 出所：健さん・review・2回目
- 数：PR の前の健さん 2回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/hooks/ai-team-config.mjs:89-109` | `globToRegExp()` は `**` を `.*` に直すが、フラグが無いので `.` は改行（`\n`・`\r`）と U+2028・U+2029 に当たらない。ファイル名にこれらを含む `.wrangler/state<U+2028>.json` は `**/.wrangler/**` に当たらず、ガードもラッパーも秘密情報として止めない（健さんの指摘。`node -e` で同じ形の正規表現が U+2028 入りのパスに当たらないことを確かめた） | `**` から作る部分（`(.*/)?`・`(/.*)?`・`.*`）が、どの文字にも当たるようにする（`s` フラグか、`[^]` でない書き方（例：`[\s\S]`））。`*`・`?` から作る `[^/]` はそのまま。テストに、`**/.wrangler/**` で U+2028 と改行を含むパスが止まる確かめを、ガードとラッパーの両方に足す（ラッパー側で、改行を含むファイル名を Git で扱えなければ、U+2028 だけでよい） | `globToRegExp` の `**` 由来の3か所を `[\s\S]*` に変え、ガードのテストに U+2028・改行入りの `.wrangler/` の確かめ、ラッパーのテストに U+2028 入りの確かめを足した（ラッパーは Windows で改行入りのファイル名を作れないため U+2028 だけ） | 解決 |

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/repo-specific-split/codex/09-review.md`（Git に入れない）

## 第6回（2026-10-12）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目（健さんの指摘の直しの後の D1。要修正は無し） ／ 承認依頼 1
- メジェドのモデル：sonnet

### 前回の指摘

| # | 再レビュー | メモ |
| --- | --- | --- |
| 第5回の1 | 解決 | `globToRegExp()` の `**` から作る3か所が `[\s\S]*` の形になり（`claude/hooks/ai-team-config.mjs:89-96`）、`*`・`?` は `[^/]` のまま。ガードに U+2028 と改行、ラッパーに U+2028 の確かめがある |

### 指摘

- なし

- チェックコマンド：`node claude/hooks/test-guard-code-edit.mjs` 全部通った（skip 2）、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 39/39

## 第7回（2026-10-12）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：要修正
- 出所：健さん・review・3回目
- 数：PR の前の健さん 3回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | `claude/hooks/ai-team-config.mjs:302-306`・`claude/skills/codex/scripts/invoke-codex.ps1` の `node` を呼ぶところ | 直接実行されたかを、`process.argv[1]` と `import.meta.url` を比べて決めている。モジュールや親の `.claude/` がジャンクション・シンボリックリンク経由だと、Node は `import.meta.url` だけを実体パスにするので一致せず、`cli()` が動かないまま終了コード 0 で終わる。ラッパーは 0 を「確かめが済んだ」と受け取るので、秘密情報を含む変更や壊れた設定があっても健さんを呼ぶ（健さんの指摘。コードを読んで確かめた。gh-skills はジャンクションで置いていて、プラグインにした後もキャッシュから読むので、リンク経由で呼ぶことは起こりうる） | 2つを重ねる。(1) 起動の判定は、`process.argv[1]` と `import.meta.url` の両方を `realPath()`（または `realpathSync.native`）で実体にそろえてから比べる。(2) 失敗したら止まる側に倒す：`cli()` は、終了コード 0 で終わるときも `--out` に決まった印（例：1行目が `ai-team-config: ok`）を書く。ラッパーは、終了コード 0 でも `--out` が無い・印が無いなら止まる（「確かめが済んだか分からない」の文で）。テストに、モジュールをジャンクション（またはリンク）を通して置いた形で、秘密情報で review が止まる確かめを足す（作れなければ飛ばして、飛ばしたことを出力に書く）。印が無いときにラッパーが止まる確かめも足す（例：何も書かずに 0 で終わる偽物のモジュールをテストで差し替えられるなら） | 起動の判定を `process.argv[1]` と `import.meta.url` の両方を `realPath()` で実体にそろえて比べる形にし、`cli()` は 0 で終わるときも `--out` に `ai-team-config: ok` を書き、ラッパーは 0 でも印が無ければ「済んだか分からない」で止まるようにした。テストに hooks/ をジャンクション経由で置いた形と、印を書かない偽物のモジュールの確かめを足した | 解決 |

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/repo-specific-split/codex/10-review.md`（Git に入れない）

## 第8回（2026-10-12）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目（健さんの指摘の直しの後の D1。要修正は無し） ／ 承認依頼 1
- メジェドのモデル：sonnet

### 前回の指摘

| # | 再レビュー | メモ |
| --- | --- | --- |
| 第7回の1 | 解決 | 起動の判定は `process.argv[1]` と `import.meta.url` を `realPath()` でそろえて比べる（`claude/hooks/ai-team-config.mjs` の末尾）。`cli()` は 0 のときも `--out` に `ai-team-config: ok` を書き、ラッパーは印が無ければ止まる（`claude/skills/codex/scripts/invoke-codex.ps1:193-195`）。テストに、hooks/ をジャンクション経由で置いた形（PASS。飛ばしていない）と、印を書かない偽物のモジュールの確かめがある |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 推奨 | `claude/hooks/ai-team-config.mjs` の `cli()` の終わり（印を書くところと、その失敗の標準エラー） | テンプレート文字列の改行が、ほかの4か所の書き方（エスケープの `n`）と違い、本物の改行になっている。動きは同じ | 次に触るときに、ほかと同じ書き方にそろえる（この回では直させない） | 見送り（ガネーシャの判断：動きが同じで、直すための修正依頼を増やさないため） | — |

- チェックコマンド：`node claude/hooks/test-guard-code-edit.mjs` 全部通った（skip 2）、`node claude/skills/codex/scripts/test-invoke-codex.mjs` 41/41

## 第9回（2026-10-12）

- 対象：`feat/34-split-repo-config`（未コミット）
- 判定：OK
- 出所：健さん・review・4回目
- 数：PR の前の健さん 4回目 ／ 承認依頼 1
- メジェドのモデル：なし

### 指摘

なし（健さんの返事：変更差分、新規ファイル、関連テストのコードを確認した。今回の変更で導入された、修正が必要な不具合は見つからなかった）

### 見送った指摘（あれば）

- なし

- 返事：`docs/tasks/repo-specific-split/codex/11-review.md`（Git に入れない）

