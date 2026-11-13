# 計画：編集のガードが、scratchpad（`<一時ディレクトリ>/claude-<uid>/`）を通すようにする（#116）

- 作成：2026-11-13 ガネーシャ（同じ日に、藤さんの指摘で改訂）
- ブランチ：`fix/116-scratchpad-uid-dir`（worktree：`C:\Temp\wt\ai-team-skills-116`。`origin/main` から）
- 計画書：`docs/tasks/scratchpad-uid-dir/plan.md`（同じ PR に入れる）
- イシュー：#116（**Refs**。困っている DevContainer で通るのを確かめてから閉じる）。Mac の確かめは別イシューに切り出す
- 実装：メジェド（Haiku。直すのは下の「やること」の 1〜3 だけ）
- 確かめ・イシューへの記録・コミット・PR：ガネーシャ
- レビュー：計画の段に藤さん（定義どおりの Fable）を1回。PR の前に健さんの `review`。純ちゃんは呼ばない
- このセッションにはプラグイン ai-team が入っていないので、藤さん・メジェドは、エージェントの定義（`plugins/ai-team/agents/`）を読ませた Fable・Haiku として呼ぶ

## Context

root で動く DevContainer で、Write ツールが scratchpad に書けない。ガード（`plugins/ai-team/hooks/guard-code-edit.mjs`）がリポジトリの外で通す一時ディレクトリは `<一時ディレクトリ>/claude/` だけだが、その環境の scratchpad は `/tmp/claude-0/…`（uid が 0）にある。

一時ファイルを置けないと、Issue やコメントの本文をファイルに書いて `gh` に渡す進め方ができない。止められたら回り込まない決まりなので、そのたびに作業が止まる。

調べて分かったこと（2026-11-13）：

- リポジトリの外で通す場所は、`guard-code-edit.mjs` の `OUTSIDE_WRITABLE`（26〜30行目）。scratchpad は29行目の `path.join(tmpdir(), 'claude')`
- Claude Code の実体（Windows 版 2.1.322）に、`claude-${process.getuid?.()??""}` という名前の作り方と、「置き場所の根は `CLAUDE_CODE_TMPDIR` があればそれ、無ければ `os.tmpdir()`」という関数がある。`-0` は uid から来ている。一時フォルダの持ち主の uid が違うと使わない確かめもある
- Windows の scratchpad は `%TEMP%\claude\…`（このセッションの scratchpad で確かめた）。Windows には `process.getuid` が無い
- Mac・Linux 版の実体は読んでいない。Mac の実機の scratchpad の場所も確かめていない

まーちゅうの選択（2026-11-13）：

- Mac の確かめは **別イシューに切り出す**
- 通す範囲は「どうするのがいいか」をガネーシャに聞いた → ガネーシャの案は **自分の uid のフォルダだけ**（下の 1）。この計画の OK で決まりとする

## やること

### 1. `plugins/ai-team/hooks/guard-code-edit.mjs`（メジェド）

- `OUTSIDE_WRITABLE` に、`process.getuid` が関数のときだけ、`<一時ディレクトリ>/claude-<process.getuid()>/` を足す（`pattern` は今の scratchpad と同じ `/^/`）
- **足す前に、その場所を `lstat` で見る**（藤さんの指摘1）。次のときは足さない
  - ディレクトリでない（シンボリックリンクを含む。リンク先が丸ごと通ってしまうため）
  - 持ち主の uid が自分でない（`/tmp` は共有で、ほかのユーザーが先に作れるため）
  - `lstat` が「無い」以外の理由で失敗した
  - まだ無いとき（`ENOENT`）は足す（Claude Code がこれから作る場所）
- 上のコメント（21〜24行目）の「次の3か所」を直し、`claude-<uid>/` を足した理由を書く。書き方は「uid がある環境（Mac・Linux）の Claude Code は、この名前を使う（Linux で確かめた。Mac の実機は未確認）。Windows は uid が無いので今のまま」
- ほかは変えない。今の `claude/` の判定も変えない。次の3つは、今の作りでそのまま満たされる（直さずに、テストで確かめる）
  - `claude-x/`・`claudex/`・ほかの uid のフォルダは通らない（`isInside` が `base + '/'` で比べるため）
  - リンクをたどった実体のパスの判定（233行目）は `OUTSIDE_WRITABLE` の全部を写すので、足した分にも効く
  - 秘密情報の判定は、通す場所の判定より前（70行目）なので、`claude-<uid>/.env` は止まる

### 2. `plugins/ai-team/hooks/test-guard-code-edit.mjs`（メジェド）

「リポジトリの外」の並び（118〜121行目）に足す。

- uid がある環境だけ：`claude-<uid>/a.txt` は通る／`claude-<uid>/.env` は止まる／`claude-<uid+1>/a.txt` は止まる
- uid があって、`<一時ディレクトリ>/claude-<uid>` がまだ無い環境だけ（Docker で流すとき）：そこに、ほかのフォルダへのシンボリックリンクを作ると `claude-<uid>/a.txt` が止まる。確かめたらリンクを消す。元からある環境では、作らずに飛ばす
- uid が無い環境（Windows）だけ：`claude-0/a.txt` は止まる（今までと同じ）
- どの環境でも：`claude-x/a.txt`・`claudex/a.txt` は止まる
- 設定が壊れているとき（517行目の並び）：uid がある環境では `claude-<uid>/a.txt` も止まる
- 18行目のコメント（仮のリポジトリの名前の断り書き）に `claude-<uid>/` を足す

### 3. `plugins/ai-team/skills/codex/SKILL.md`（メジェド）

- 27行目の scratchpad の場所の書き方（`<一時ディレクトリ>/claude/` の下）に、「uid がある環境（Mac・Linux）では `claude-<uid>/` の下」と足す

### 4. イシュー（ガネーシャ）

- Mac の確かめのイシューを立てる（題名と本文は、立てる前にまーちゅうに見せる）。今の `claude/` がリンクのときの扱い（藤さんの指摘1の残り）も、そこに書く
- #116 の完了条件を書き換える
  - 3つ目：「`claude-<uid>/` が通ること（root で流すと `claude-0/`）、`claude-x/`・`claudex/`・ほかの uid が止まることのテストを足した」
  - 4つ目：「Windows は確かめた（`%TEMP%\claude\` のまま）。Mac は #NN」
- ボード #16 の #116 は、着手で In Progress にした（2026-11-13）。PR を作ったら Review、マージの後は In Progress に戻す（Refs のため）

## やらないこと

- 数字なら何でも通す形（`claude-<数字>/`）
- 今の `claude/` の判定の直し（リンク・持ち主の確かめを足すこと。別イシュー）
- `CLAUDE_CODE_TMPDIR` で場所を変えたときの対応（今回の困りごとではない。要るなら別イシュー）
- Mac の実機の確かめ（別イシュー）。ただし、コードは uid がある環境で同じに動くので、Mac でも `claude-<uid>/` を通すようになる
- `.claude/ai-team.json` に「外で通す場所」のキーを足すこと
- 共有モジュール（`ai-team-config.mjs`）・`invoke-codex.mjs`・README は変えない
- 導入済みのリポジトリへの反映（プラグインの版を上げる作業は、頼まれてから）

## 完了条件

PR の前に確かめるもの：

- Linux の root（Docker）で、`<一時ディレクトリ>/claude-0/…` への編集がガードを通る
- その中でも、秘密情報のファイルは止まる
- `claude-x/`・`claudex/`・ほかの uid のフォルダ・リンクにした `claude-<uid>` が止まる確かめがテストにある
- Windows で、今までの判定が変わっていない

マージの後に確かめるもの（これが済んだら #116 を閉じる）：

- 困っている DevContainer で、プラグインを新しい版にしてから、scratchpad への Write が通る
  - 通らなければ、フックのプロセスの `os.tmpdir()` と `process.getuid()` を見る（イシューの `tmpdir() = /tmp` は、どのプロセスで測ったかが書かれていない）

## 確かめ（PR の前・ガネーシャ）

時間のかかるものはバックグラウンドで打つ。Docker のコマンドは **PowerShell で打つ**（Git Bash だと `-w /w` が `W:/` に化ける）。

- Windows：worktree で `node plugins/ai-team/hooks/test-guard-code-edit.mjs`（FAIL が 0）
- Linux の root（困った環境と同じ uid 0）：`docker run --rm -v C:\Temp\wt\ai-team-skills-116:/w:ro -w /w node:24 node plugins/ai-team/hooks/test-guard-code-edit.mjs`
  - イメージの都合で落ちるテストがあれば、直す前の main でも同じコマンドを流し、落ち方が前と同じかを比べる
- Linux の root でない uid：同じコマンドに `--user 1000:1000` を付ける（`claude-1000/` が通り、`claude-0/` が止まる側になる）
- 結果を PR 本文に書く。差分にローカルのパス・クライアント名が無いこと
- PR は `Refs #116`。リンクを渡して止まる（マージはまーちゅう）

## 承認前の確認（藤さんの定義どおりの Fable・1回目・2026-11-13）

必須なし・推奨6件。計画の行番号は、全部いまのコードと合っていた。

- 採った：1（通す場所そのものがリンクだと、リンク先が丸ごと通る → 足す場所は `lstat` で見る。今の `claude/` は別イシュー）・2（Mac は確かめていないのに、文書に事実として書く → 「Mac の実機は未確認」と書く。コードが Mac でも効くことを「やらないこと」に書いた）・3（いちばん大事な完了条件を確かめる前にイシューが閉じる → Refs にし、完了条件を PR の前とマージの後に分けた）・4（Docker のコマンドは Git Bash でパスが化ける → PowerShell で打つ）・5（「藤さんは呼ばない」が実際と食い違う・イシューの完了条件の3つ目が判定しにくい → 両方直す）
- 計画の裏付けになった：6（実体に `claude-${process.getuid?.()??""}` と、置き場所の根を決める関数があった。ガネーシャが 2.1.322 で同じ文字列を確かめた）

## 実装の後の確かめ（2026-11-13）

- 実装：メジェド（定義どおりの Haiku）。計画の 1〜3 だけで、範囲の外の直しは無し
- Windows：`node plugins/ai-team/hooks/test-guard-code-edit.mjs` は ok 524・FAIL 0（uid が無いので、`claude-0/` は止まる側）
- Linux の root（Docker の `node:24`。uid 0）：全部通った。`claude-<uid>/a.txt` は通る・`.env` は止まる・`claude-<uid+1>/`・`claude-x/`・`claudex/` は止まる・`claude-<uid>` をほかのフォルダへのリンクにすると止まる
- Linux の uid 1000（同じイメージに `--user 1000:1000`）：全部通った。足した確かめは root と同じ結果
- 健さん（`review`。未コミットの変更）：1巡。指摘なし（直す必要のある不具合は見つからなかった、という返事）
- 残り：困っている DevContainer での実機の確かめ（マージの後）
