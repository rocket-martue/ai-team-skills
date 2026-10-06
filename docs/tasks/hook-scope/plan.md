# 計画書：hook-scope

- 作成：ガネーシャ（2026-10-06）
- 承認：[x] まーちゅう（承認日：2026-10-06。会話で「OKなので進めて」。根の CLAUDE.md を確認の対象に入れること、settings.json をガネーシャが入れることも含む）
- ブランチ：`chore/1-hook-scope`（リポジトリの外の worktree で作業。このリポジトリの `.gitignore` に `.claude/worktrees/` は無い）
- イシュー：#1 の 2・6（フックと権限の範囲）。PR には `Refs #1` と書く（#1 には 3・4・9・10 と4リポジトリへの反映が残るため）
- 改訂履歴：
  - 2026-10-06 初版
  - 2026-10-06 承認前の確認（Fable・1回）の指摘で改訂。ask の JSON に hookEventName を足した。`.claude/` の行から `.claude/worktrees/` の下を外した（今のテストの期待を変えない）。リポジトリの根の CLAUDE.md も確認の対象にした。git rm・git branch -D・git worktree remove も ask に足した。リンクのテストを完了条件に足した。auto モードでの protected paths との重なりの書き方を直した
  - 2026-10-06 健さん1回目の指摘で改訂。worktree の頭は剥がせなくなるまで繰り返す。ブランチの削除は書き方を問わず確認にする。README の「git の権限」の節も対象にした。.env.example の理由を公式の仕様に合わせて直した。\ 区切りのテストは Windows でだけ回す
  - 2026-10-06 健さん2回目の指摘で改訂。ブランチの削除の ask は * をどこにでも当たる形にした。フックの登録をシェルを通さない書き方（command と args）に替える。フックに見えない書き込みの説明を Bash・PowerShell にした
  - 2026-10-06 健さん3回目の指摘で改訂。git branch は引数の有無を問わず全部 ask にした（短いオプションをまとめた書き方まで潰しきれないため）。README の古いフックの登録の説明も対象にした
  - 2026-10-06 健さん4回目の指摘で改訂。データの流れの ask の分かれに根の CLAUDE.md を足した

## 目的

フック（`guard-code-edit.mjs`）と settings.json の権限の範囲を、守りたいものに合わせる。コミット前の作業を消す git のコマンドに確認を出し、worktree の中のチームの設定を守り、ガネーシャが要るコード以外の設定を編集できるようにする。直さないものは、理由を README に書く。

## 背景・前提

- （#1 の 6）settings.json の ask にも deny にも `git stash`・`git restore`・`git clean` が無い（ほかに `git rm`・`git branch -D`・`git worktree remove --force` も同じ）。Bash を持つ役（ガネーシャ・メジェド・adversary）が、コミット前の作業ツリーを確認なしで消せる
- PowerShell ツールの権限は `PowerShell(...)` の別のルールで、Bash のルールは効かない。書き方は Bash と同じ形（`:*` は末尾の ` *` と同じ）で、大文字小文字を区別しない（公式ドキュメント permissions の「PowerShell」）。今の settings.json に PowerShell のルールは無い
- （#1 の 2）フックの範囲のずれ。公式ドキュメント permission-modes の「Protected paths」で、Claude Code は `.claude/` の下への書き込みを自動では通さない（default・acceptEdits は確認、auto は分類器。allow のルールでも通らない）。**ただし `.claude/worktrees/` の下は例外**で守られない
  - メインのチェックアウトの `.claude/hooks/`・`.claude/settings.json`・`.claude/agents/`・`.claude/skills/` は、Claude Code がもう守っている。前のタスクで、メジェドがテンプレートの settings.json を書けずに止まったのもこの仕組み
  - worktree の中の `.claude/worktrees/<名前>/.claude/...` は守られない。今のフックは頭を剥がしたあと `.md` ならガネーシャも通すので、worktree の中のスキルやエージェントの定義をガネーシャもメジェドも確認なしで書き換えられる
  - `docs/team/`（共通規約・作業の流れ・Ganesha.md）は `.md` なので、ガネーシャが確認なしで書き換えられる
  - メジェドは `docs/tasks/<タスク名>/plan.md` を書き換えられる（mejed.md の禁止事項で頼んでいるだけ）
  - ガネーシャは `.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` の下を編集できない（コードではない設定）。4リポジトリへの反映で `.gitignore` に `.claude/worktrees/` を足すのに要る
  - `.env.example` は、フックの秘密情報のパターンと settings.json の `Read(**/.env*)` の両方で止まる
- PreToolUse フックは `permissionDecision: "ask"` を返して確認を出せる。ただし deny・ask のルールはフックの結果にかかわらず当たる（公式ドキュメント permissions の「Extend permissions with hooks」）
- このリポジトリには phpcs が無い。**このタスクのチェックコマンドは `node claude/hooks/test-guard-code-edit.mjs` だけ**
- **`claude/settings.json` は、まーちゅうの許可を得てガネーシャが書き換える。** 前のタスクで、メジェドの書き換えが Claude Code の auto モードの安全チェック（設定の自己書き換え）に止められたため。メジェドは settings.json に触らない
- 4リポジトリへの反映は、このタスクではしない

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/hooks/guard-code-edit.mjs` | 変更 | 下の「フックの判定（新しい表）」にする |
| `claude/hooks/test-guard-code-edit.mjs` | 変更 | 新しい判定の確かめを足す |
| `claude/settings.json` | 変更 | フックの登録を、シェルを通さない書き方（`"command": "node"` と `"args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-code-edit.mjs"]`）に替える（Git Bash が無い Windows ではフックのコマンドが PowerShell で動き、`$CLAUDE_PROJECT_DIR` が空になって、フックが起動しないまま編集が通るため。起動できないフックは止める側に倒れない。公式ドキュメント hooks の「Exec form and shell form」）。ask に `Bash(git stash:*)`・`Bash(git restore:*)`・`Bash(git clean:*)`・`Bash(git rm:*)`・`Bash(git branch:*)`・`Bash(git worktree remove:*)` を足す（どれもコミット前の作業かマージ前のブランチを消せる。ブランチの削除は `-fD`・`-f -d`・`--force --delete` のように書き方がいくつもあり、ルールの形で潰しきれないので、`git branch` は引数の有無を問わず全部確認にする。ブランチの名前は `git status` で分かる）。deny と ask の Bash のルールと同じものを、`PowerShell(...)` でも足す（allow は足さない）。**ガネーシャが入れる** |
| `README.md` | 変更 | 「導入後に確認すること」の Windows での実行の箇条を、新しいフックの登録（`command` と `args`）に合わせて書き直す。「編集できる範囲（フックで判定）」の表と箇条を新しい判定に合わせる。「git の権限（settings.json）」の表に、確認付きに足したもの（stash・restore・clean・rm・ブランチの削除・worktree remove・前のタスクの `git -C` など）と、同じルールを PowerShell ツールにも付けたことを足す。「直さないもの」と理由を足す（下の表） |
| `repo-files/docs/team/common-rules.md` | 変更 | 編集の制限の行に、`docs/team/` と worktree の中の `.claude/` は確認が出る、`git stash`・`restore`・`clean` などは確認が出る、を足す。「Bash 経由の書き込みは止まらない」を「Bash・PowerShell 経由」にする |
| `docs/tasks/hook-scope/review.md` | 新規 | ガネーシャが書く記録 |

## 変更内容

### フックの判定（新しい表）

判定の順番は上から。どれかに当たったら、そこで決まる。パスは、`.claude/worktrees/<名前>/` の頭を**剥がせなくなるまで繰り返し**剥がした後の、リポジトリの根からの相対パス（`.claude/worktrees/x/.claude/worktrees/y/.claude/agents/a.md` は `.claude/agents/a.md` になる。秘密情報だけは、剥がす前のパスにも当てる。今のまま）。

| # | 当たるパス | ガネーシャ | メジェド | ほかのサブエージェント |
| --- | --- | --- | --- | --- |
| 1 | リポジトリの外（今の3か所を除く） | 止める | 止める | 止める |
| 2 | 秘密情報（今のパターン） | 止める | 止める | 止める |
| 3 | `.claude/` の下（ただし `.claude/worktrees/` の下は除く。剥がせなかった `.claude/worktrees/<名前>` そのものや `.claude/worktrees/a.php` は、今のとおり 6・7 で判定する） | 確認（ask） | 確認（ask） | 確認（ask） |
| 4 | `docs/team/` の下・リポジトリの根の `CLAUDE.md`（`@docs/team/Ganesha.md` を取り込む入口なので、`docs/team/` と同じに守る） | 確認（ask） | 確認（ask） | 確認（ask） |
| 5 | `docs/tasks/<タスク名>/plan.md` | 通す | 止める | 通す（今の `docs/tasks/` のまま） |
| 6 | `docs/tasks/` の下・`.md`・`.gitignore`・`.gitattributes`・`.github/ISSUE_TEMPLATE/` の下 | 通す | 通す | 通す |
| 7 | それ以外 | 止める | 通す | 止める |

- 3 は、メインのチェックアウトでは Claude Code の protected paths と重なる（default・acceptEdits では確認どうしで重なる。auto では protected paths は分類器に回り、フックの ask は確認を出すので、両方が当たる。どちらが先に効くかは確かめていない。テスト観点に入れる）。worktree の中（`.claude/worktrees/<名前>/.claude/...`）を守るのが目的
- 3・4 の確認は、終了コード0で `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": "<理由>"}}` を標準出力に返す（`hookEventName` は必須。公式ドキュメント hooks の `hookSpecificOutput` の表）。理由は「チームの設定・規約なので、まーちゅうの確認を取る」
- `.gitignore` は、リポジトリの根のものと、下の階層のもの（`<dir>/.gitignore`）の両方を通す
- 5 の `plan.md` は `docs/tasks/<1階層>/plan.md` のときだけ
- リンクをたどった実体のパスにも同じ判定を当てるのは今のまま。指定されたパスと実体のパスの判定が違うときは、きつい方（止める > 確認 > 通す）を取る

### 直さないもの（README に理由を書く）

| #1 の項目 | 理由 |
| --- | --- |
| メジェドが review.md の指摘欄・判定欄を書き換えられる | フックはファイル単位でしか判定できず、メジェドは「対応」欄を書く必要がある。mejed.md の禁止事項で頼み、diff-reviewer が差分で見る |
| `.env.example` が読めない・編集できない | Read の deny には例外の書き方（`!` で始まるパターン。公式ドキュメント permissions の「Read and Edit」）があるが、使わない。`.env.example` にうっかり本物の値を写してしまうことがあり、確かめずに読ませないため。読めない側に倒す。見せたいときは、まーちゅうが中身を確かめて貼る |
| データの JSON をガネーシャが編集できない | リポジトリごとに場所が違う。要るリポジトリで `PLANNER_WRITABLE` に足す（反映のときに各リポジトリで決める） |
| Bash・PowerShell 経由の書き込みはフックに見えない | 編集のフックは Edit・Write などの編集ツールにだけ登録している（Claude Code のフックの仕組み）。README と common-rules.md の説明を「Bash・PowerShell 経由」に直す |

### データの流れ

- Edit・Write：Claude Code → `guard-code-edit.mjs` → 外か・秘密情報か（止める）→ `.claude/`（`.claude/worktrees/` の下を除く）・`docs/team/`・根の `CLAUDE.md` か（ask）→ メジェドの plan.md か（止める）→ 書ける場所か（通す）→ メジェドか（通す）→ 止める
- Bash・PowerShell：Claude Code が区切りごとに settings.json のルールを当てる

## 使う API と方針

- Node.js の標準モジュールだけ。フックの出力の形は公式ドキュメント hooks の PreToolUse（止めるのは終了コード2、確認は終了コード0で `hookSpecificOutput` の JSON）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- #1 の 3・4・9・10（スキルどうしの食い違い・外への依存・gh-review との重なり・hub との差）
- Bash 経由の書き込みを止めること（サンドボックス）
- 4リポジトリへの反映

## 完了条件

- [ ] `node claude/hooks/test-guard-code-edit.mjs` が通る。少なくとも次を確かめている
  - 上の表の7行のそれぞれを、3つの役（ガネーシャ・メジェド・ほかのサブエージェント）で（メインのチェックアウトと `.claude/worktrees/<名前>/` の中の両方）
  - 3・4 は終了コード0で、出力の JSON に `hookEventName: "PreToolUse"` と `permissionDecision: "ask"` がある
  - `.claude/worktrees/x` そのもの・`.claude/worktrees/a.php` は今のまま（ガネーシャは止まる）
  - リポジトリの根の `CLAUDE.md` は ask／`docs/x/CLAUDE.md` は通る（`.md`）
  - リンク：テストの中でジャンクション（Windows）かシンボリックリンク（それ以外）を作り、リンク元が `.md` でリンク先が `docs/team/` の下なら ask、リンク先が秘密情報なら止める（きつい方を取る）
  - `<dir>/.gitignore`・`.github/ISSUE_TEMPLATE/bug.yml` はガネーシャが通る／`.github/workflows/ci.yml` はガネーシャが止まる
  - `docs/tasks/x/plan.md` はメジェドが止まる／`docs/tasks/x/review.md` はメジェドが通る
  - 今までの判定（秘密情報・リポジトリの外・リンク・worktree の境界）が変わっていない。ただし、`\` 区切りのパスのテスト（今のテストの「境界: \ 区切り」の2件を含む）は Windows でだけ回す（Windows 以外では `\` が区切りにならないため）
  - 入れ子：`.claude/worktrees/x/.claude/worktrees/y/.claude/agents/a.md` は ask、`.claude/worktrees/x/.claude/worktrees/y/docs/tasks/t/plan.md` はメジェドが止まる
- [ ] README に古いフックの登録（`node "$CLAUDE_PROJECT_DIR/..."`）の説明が残っていない
- [ ] settings.json のフックの登録が `"command": "node"` と `args` の形で、`${CLAUDE_PROJECT_DIR}` を使っている
- [ ] settings.json の ask に `git stash`・`git restore`・`git clean`・`git rm`・`git branch`（引数の有無を問わず）・`git worktree remove` があり、deny と ask の Bash のルールすべてに、同じ形の `PowerShell(...)` がある
- [ ] README の「編集できる範囲」の表が上の表と一致し、「直さないもの」の4件と理由がある。「git の権限」の表が settings.json の ask・deny と一致し、PowerShell にも同じルールがあることが書いてある
- [ ] common-rules.md の編集の制限の行に、確認が出るもの（`docs/team/`・worktree の中の `.claude/`・`git stash` など）があり、フックに見えない書き込みが「Bash・PowerShell 経由」と書いてある
- [ ] 差分に、ローカルの絶対パスと契約しているプラン名が無い

## テスト観点

- `.claude/worktrees/<名前>/.claude/hooks/guard-code-edit.mjs` を、メジェドが編集しようとしたとき（ask になる）
- `docs/team` と `docs/teams/` のような似た名前（`docs/team/` だけが ask）
- 実際の Claude Code のセッションで、フックの ask が確認として出るか。auto モードのメインのチェックアウトの `.claude/` で、フックの ask と protected paths の分類器のどちらが先に効くか（反映のあとの実際のタスクで確かめる）

## 承認前の確認

### 承認依頼1・Fable（2026-10-06）

- 採った（plan.md を直した）：必須2（ask の JSON に hookEventName が無い／`.claude/` の行が今のテストの期待とぶつかる）、推奨4（リンクのテストが無い／CLAUDE.md が守りの外／git rm・branch -D・worktree remove も作業を消せる／auto モードでの重なりの書き方）。改訂履歴の2行目
- 確認事項に移した：なし（CLAUDE.md を対象に入れるかは、承認のときに伝える）
- 見送った（理由）：なし

### 承認依頼1・健さん1回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：5件（入れ子の worktree で頭を1回しか剥がさない／`git branch --delete --force` が ask に当たらない／README の「git の権限」の節が対象に無い／`.env.example` の理由が公式の仕様と違う／`\` 区切りのテストが Windows 以外で落ちる）。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：1件（実際のセッションで確認が出るかを完了条件で判定できない）。このテンプレート置き場には `.claude/` が無く、セッションでは確かめられない。4リポジトリへの反映のあとの実際のタスクで確かめる（#1 の完了条件）
- 返事：メインのチェックアウトの `docs/tasks/hook-scope/codex/01-consult.md`（Git に入れない）

### 承認依頼1・健さん2回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：3件すべて（ブランチの削除がオプションの順番ですり抜ける／Git Bash が無い Windows でフックが起動しない／PowerShell 経由の書き込みの説明が無い）。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/hook-scope/codex/02-consult.md`

### 承認依頼1・健さん3回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：2件すべて（短いオプションをまとめたブランチの削除がすり抜ける／README に古いフックの登録の説明が残る）。改訂履歴の5行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/hook-scope/codex/03-consult.md`

### 承認依頼1・健さん4回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：1件（データの流れの ask の分かれに根の CLAUDE.md が無い）。改訂履歴の6行目
- 確認事項に移した：なし
- 見送った（理由）：1件（`\\?\` 付きの Windows のパスで、リポジトリの中のファイルも「外」として止まる）。止める側に倒れる誤りで、守りの穴ではない。今のフックからある挙動で、Claude Code の Edit はふつうの絶対パスを渡す。セキュリティのコードに変換を足すより、止まるままにする
- 返事：`docs/tasks/hook-scope/codex/04-consult.md`

### 承認依頼1・健さん5回目（2026-10-06）

- 指摘なし。承認依頼1の健さんはここで止める（数：Fable 1回・健さん5回。指摘は 6 → 6 → 3 → 2 → 2 → 0。見送りは2件）
- 返事：`docs/tasks/hook-scope/codex/05-consult.md`

## 確認事項

- なし
