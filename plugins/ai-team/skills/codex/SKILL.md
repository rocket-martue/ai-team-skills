---
name: codex
description: 外部委託業者の健さん（Codex CLI）に、読むだけの相談・レビューと、画像の生成を頼むときに使う。「健さんに聞いて」「Codex に聞いて」「Codex にレビューさせて」「セカンドオピニオンがほしい」「画像を作って」などで使う。実装（ファイルの書き換え）は頼まない。
argument-hint: "[consult|review|image] <依頼>"
allowed-tools:
  - Read
  - Write
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.mjs" *)
---

# codex（健さんに頼む）

健さんは、チームに外から入っている外部委託業者（Codex CLI）。頼めるのは次の表の上の3つだけで（`check` は健さんを呼ばないモード）、**実装は頼まない**（健さんがファイルを書き換えると、ガードも秘密情報の確かめも通らないため）。

| モード | 中身 | 使う人 |
| --- | --- | --- |
| `consult` | 読むだけの相談。既定のモード | ガネーシャ・メジェド |
| `review` | 読むだけのレビュー（未コミットの変更、または基準ブランチとの差分） | ガネーシャ |
| `image` | 参照画像を渡して、画像を1枚作る。できた画像は健さんの保存先に置いたまま | ガネーシャ・メジェド |
| `check` | 健さんを呼ばない。秘密情報と設定ファイルの確かめだけして `CHECK: ok` を出す（導入の後に、settings.json の allow が効くかを Codex の枠を使わずに確かめるため） | ガネーシャ |

健さんの設定（キャラ・請け負う範囲）は、各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）にある。見本はテンプレートの `repo-files/codex/AGENTS.md`。AGENTS.md が無い PC では健さんとして振る舞わないので、使う前に置いてあるか確かめる。

## 呼び方

1. 依頼を、健さんが1回で答えられる1つの頼みにする。会話の経緯をそのまま渡さない。自分の結論や見立ては渡さない（先入観を移さないため）
2. 頼みの文をセッションの scratchpad（`<一時ディレクトリ>/claude/` の下）の一時ファイルに書く。`review` は頼みの文を使わない
3. リポジトリの根から、Bash ツールで次の形で呼ぶ（Windows・Mac・Linux で同じ。settings.json の allow に入っているのはこの形と、前の呼び方（下の「前の呼び方」）だけ）。1回に数分かかるので、`run_in_background` で回し、終わりの知らせを受けてから読む

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.mjs" -Mode <consult|review|image> [-PromptFile <一時ファイル>] [-Image "<画像1>|<画像2>"] [-Base <基準ブランチ>] [-WorkingDirectory <パス>] [-Container]
   ```

   - worktree で作業しているときは `-WorkingDirectory <worktree のパス>` を付ける（健さんはそこを作業の根にして読む）
   - `review`：コミット前は何も付けない（未コミットの変更を見る）。コミット済みを見るときは `git fetch origin` のあと `-Base origin/<既定ブランチ>`。今のブランチ（HEAD）を見るので、呼ぶ前に `git status --short --branch` で見たいブランチにいるか確かめる
   - `image`：参照画像は `|` 区切りの1つの文字列で渡す（Mac・Linux でも、名前に `|` を含む画像は渡せない）。できた画像のパスは、返事の後ろの `IMAGE: <絶対パス>` の行に出る。ラッパーが終了コード 2 で止まったら、画像は取れていないので、コピーしない
   - `review -Container`：健さんにテストも打たせたいとき（下の「コンテナの中のレビュー」）。付けなければ今までどおり
4. 一時ファイルを消す
5. 返事は標準出力に出るだけで、どこにも保存されない。まーちゅうに伝えるときや PR に貼るときは、その場で写す（貼る前に、秘密情報・クライアントの識別情報・ローカルの絶対パスが無いことを確かめる）
6. **答えはそのまま採らない。** コード・一次データと照らして確かめてから採る。返すときは「健さんの答え（使えるところ）」と「判断（同意・不同意・残るリスク）」を分ける

## 頼みの文に必ず入れること

- 頭に「ガネーシャから」か「メジェドから」（健さんの AGENTS.md は、この頭で請け負う範囲を決める。`.claude/ai-team.json` の `names` で呼び名を変えていても、ここは既定の名前で書く）
- モードと目的
- **秘密情報のファイルを開かないこと**（既定の4つ `.env*`・`.dev.vars`・`.kv/`・`wp-config.php` と、読むリポジトリの根の `.claude/ai-team.json` の `secretPatterns` に当たるもの。細かい照らし方は AGENTS.md にある）
- **ファイルを書き換えない・作らないこと**
- `consult`：推測せずにリポジトリを読んでから答えること。答えにファイル:行（リポジトリの根からの相対パス）を付けること。テストは走らせず、関係するテストのコードを読んで、壊れそう・弱められたテストが無いかを見ること
- `image`：作りたい画像の中身（用途・大きさ・背景の透過など）と参照画像の役割。**答えの最後の行に `IMAGE_PATH: <保存した画像の絶対パス>` とだけ書くこと**（ラッパーはこの行だけを読む）。リポジトリは読まないので「リポジトリを読む」「ファイル:行」は入れない

`review` は頼みの文を渡せない（対象の指定と同時に受け付けないため）。同じ決まりは健さんの AGENTS.md の「レビューで呼ばれたとき」で持たせている。

## ラッパーがしてくれること

- この PC で動く健さんの sandbox は常に `read-only`。健さんは一時ディレクトリにも書けないので、テストは走らない（結果はガネーシャ・メジェドのチェックコマンドで取る。走らせたいときは `-Container`）
- 秘密情報の照らし合わせは、ガードと同じ共有モジュール（プラグインの `hooks/ai-team-config.mjs`）で行う。作業の根とメインのチェックアウトの根の `.claude/ai-team.json`（無ければ `repo-files/claude/ai-team.json`）の `secretPatterns` も足す。設定ファイルが壊れていれば、どのモードでも呼ばずに止まる
- `review`：健さんに渡る変更のすべてのパス（`git status --porcelain -z -uall` の全項目と、`-Base` のときは `git diff --name-only --no-renames <基準>...HEAD`）を照らし、1つでも秘密情報に当たれば呼ばずに止まる。どちらも `--ignore-submodules=none` を付けて、サブモジュールの `ignore` の設定があっても、サブモジュールの変更を拾う（照らすのはサブモジュールの置き場所のパスまで。中のファイルは照らさない）
- `image`：参照画像を空の一時ディレクトリにコピーしてそこで呼ぶ（リポジトリには触れない）。`IMAGE_PATH:` の画像が `<CODEX_HOME>/generated_images/` の下にあり、参照画像と別のファイルのときだけ `IMAGE:` を出す
- `codex` が PATH に無ければ、入れ方を出して止まる（`check` は `codex` が無くても動く）。Windows で npm のシム（`codex.cmd`）なら、隣の `node_modules/@openai/codex/bin/codex.js` を node で直接起動する（シェルを通さない）。隣に無い（pnpm・bun などで入れた）シムは飛ばして PATH の後ろも探し、最後まで使えるものが無いときだけ、直し方を出して止まる

## コンテナの中のレビュー（`-Container`）

`review`（と `check`）に `-Container` を付けると、Docker のコンテナの中で健さんを動かし、`.claude/ai-team.json` の `container.test` のテストも打たせる（コンテナの中だけ `workspace-write`）。流れと理由は、このプラグインのリポジトリの `docs/tasks/codex-container/plan.md`。

- 前提（どれかが欠けていれば、理由と直し方を出して止まる。黙って今の `review` に戻らない）
  - リポジトリの `.claude/ai-team.json` に `container`（`setup`：準備のコマンド、`test`：テストのコマンド）がある
  - Docker が動いていて、向き先がこの PC（`DOCKER_CONTEXT` が無い。`DOCKER_HOST` は `unix://`・`npipe://` だけ）
  - コンテナ用のログインがある（PC ごとに1回。README の「コンテナでのレビュー」）
  - 各 PC の AGENTS.md に、コンテナのレビューの節（`<!-- ai-team: container-review v1 -->` の行で始まる節）がある
- 秘密情報のファイル（`.env.example` のような例のファイルも）は、変更していなければ写さないだけ（名前も健さんに送らない）
- 次のどれかがあると止まる。どのファイルかは止める文に出る（健さんには送らない）
  - 変更（差分）に入っている秘密情報のファイル
  - サブモジュール・未追跡の入れ子のリポジトリ
  - リポジトリの根より下のリンク（シンボリックリンク・ジャンクション）・綴りの大文字小文字が索引とディスクで違うファイル
  - 名前に改行などの制御文字を含むファイル
- 写すのは、今ディスクにあるファイル（追跡しているものと、無視されていない未追跡のもの）と差分だけ。git の履歴は写さない。この PC のリポジトリには何も書かない
- 新しい PC では、先に `-Mode check -Container` を打つ（イメージを作り、ログインが無ければログインのコマンドを出す）
- 強制終了すると、コンテナ・作業用のボリューム・一時ディレクトリが残ることがある。消し方は README の「コンテナでのレビュー」
- devcontainer の中では、Docker が使えなければ止まる

## 前の呼び方

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1" ...`（Windows だけ）も、受け取った引数をそのまま `invoke-codex.mjs` に渡す中継として残してある。導入済みのリポジトリの settings.json の allow と、gh-skills の呼び方がこの形のため。新しく書く呼び方は `node ... invoke-codex.mjs` にする

## 注意

- 呼ぶたびに、契約しているプランの Codex の枠を使う（相談・レビュー1回で、5時間枠の数%ほど）。1回の依頼は1つにまとめる
- `read-only` は書き込まないだけで、読むのは止めない。秘密情報は、頼みの文と AGENTS.md で「開かない」と縛ることしかできない（柵であって壁ではない）。`review` は組み込みの頼みの文で動くので、AGENTS.md が守られるとは限らない
