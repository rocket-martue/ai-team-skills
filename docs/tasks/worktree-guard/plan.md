# 計画書：worktree-guard

- 作成：ガネーシャ（2026-10-06）
- 承認：[x] まーちゅう（承認日：2026-10-06。会話で「それだけ直して PR 作成しておいて」。健さん5回目の2件を直したうえでの承認）
- ブランチ：`chore/1-worktree`（リポジトリの外の worktree で作業。このタスク自身は今の置き方のまま）
- イシュー：#1 の 1・7・8（worktree まわり）。PR には `Refs #1` と書く（#1 には 2〜4・6・9・10 と4リポジトリへの反映が残るため）
- 改訂履歴：
  - 2026-10-06 初版
  - 2026-10-06 承認前の確認（Fable・1回）の指摘で、置き場所をリポジトリの中（`.claude/worktrees/`）に替えて書き直した（まーちゅうの判断）。`git` のフックは、書き方を見分けるのをやめ、語で止める形に削った
  - 2026-10-06 健さん1回目の指摘で改訂。git の語は、引用符とエスケープを消してから分け、パスで書いた git も拾う。秘密情報の判定は剥がす前のパスにも当てる。片付けの手順（gh-flow の worktree.md・gh-wrapup）もリポジトリの外の変更に足した。allow のパスは入力の cwd を起点に解決し実体でも見る。完了条件を足した。背景の公式の決まりの例を直した
  - 2026-10-06 健さん2回目の指摘で改訂。git のフックは「素直な形」でなければ中身を読まずに ask にする作りに替えた（書き方の抜け道を1つずつ潰すのをやめた）。引用符のかたまりは1語。git の語はちょうど一致。worktree のパスは相対パスで渡し、フックは /c/ 形も直す。ラッパーは返事をメインのチェックアウトに保存する（写す手順をやめた）。gh-wrapup の参照資料と commit-style の例もリポジトリの外の変更に足した。完了条件に境界の場合を足した。フックの柵の範囲（うっかり別の書き方で打つのを止める。わざと隠す書き方は対象外）を書いた
  - 2026-10-06 健さん3回目の指摘で改訂。git の書き方を見分けるフックをやめ、settings.json の ask に大域オプションで始まる git の形を足すだけにした（抜け道を潰すたびに新しい抜け道が出たため。柵の範囲は「うっかり」）。worktree を先に作り plan.md と review.md をその中に書く決まりを足し、plan-writer を対象にした。メインのチェックアウトは worktree list の1件目で求める。.gitignore の手順を健さんと切り離した
  - 2026-10-06 健さん4回目の指摘で改訂。--git-dir・--work-tree の ask は空白を挟まない形にした。チェックコマンドは括弧の中で cd する。gh-flow の worktree.md はコマンドも全部分かれに直す
  - 2026-10-06 健さん5回目の2件を、まーちゅうの指示で直した（保留の解除）。worktree を作るのは gh-issue だけ。gh-issue は、テンプレートを入れたリポジトリでは worktree の後に plan-writer で計画を書く。codex スキルの「直ったのか隠しただけか」の差分も worktree では git -C
  - 2026-10-06 PR の前の健さん1回目の指摘で改訂。codex スキルの「直ったのか隠しただけか」の差分の取り方に git -C を付けるのは誤り（健さんは worktree を作業の根にして動く）。-C を付けない、と書くように直した（まーちゅうの「指摘が0になったら PR」の指示のもとで、保留にせずに直した）

## 目的

テンプレートを入れたリポジトリで開いた Claude Code から、git worktree でメジェドが実装でき、ガネーシャがレビューできるようにする。そのとき、worktree での git の打ち方（`git -C <パス>`）で、権限のルールがうっかりすり抜けないようにする。

## 背景・前提

- （#1 の 1）`guard-code-edit.mjs` は、`$CLAUDE_PROJECT_DIR`（メインのチェックアウト）の外を、メモリ・計画ファイル・scratchpad の3か所しか通さない。gh-issue スキルは worktree をリポジトリの外に作るので、worktree のファイルは全部「リポジトリの外」になり、メジェドも含めて全員の編集が止まる
- しかも、フックが通しても、作業ディレクトリ（と `additionalDirectories`）の外のファイルの Edit・`cd` には Claude Code が別に確認を出す（公式ドキュメント permissions の「Working directories」）
- 判断（まーちゅう・2026-10-06）：**worktree をリポジトリの中の `.claude/worktrees/<名前>/` に置く**。作業ディレクトリの中なので、上の確認の問題が起きない。Claude Code の標準の置き場所でもある。フックは、そのパスの頭を剥がして今と同じ判定をするだけでよい
- （#1 の 7）settings.json の Bash のルールはコマンドの文字の先頭一致なので、`git -C <パス> reset --hard` は deny の `Bash(git reset:*)` に当たらない（公式ドキュメント permissions の「What a Bash rule doesn't match」）。`&&`・`;`・`$()` などで区切られた部分ごとにルールを当てることと、先頭の環境変数の代入を外して当てることは、Claude Code がしてくれる（同「Compound commands」）
- `cd <別のディレクトリ> && git ...` は、各部分が読むだけでも確認が出る（公式ドキュメント permissions の「Compound commands」：「`cd` with `git`: prompts when the `cd` changes into a different directory」）。worktree での git は `git -C <worktree のパス>` で打つ
- 判断（ガネーシャ・健さん3回目の後）：`git -C` などの書き方を見分けるフックは作らない。書き方を潰すたびに新しい抜け道が出て収束しなかったため。代わりに、**settings.json の ask に、大域オプションで始まる git の形を足す**。この柵は「Claude がうっかり `git -C` で打って deny をすり抜ける」のを止めるためのもので、`sh -c '...'` で包む・パスで git を呼ぶなど、わざと別の形にするものまでは防がない（サンドボックスの役目。対象外）
- その結果、worktree での `git -C <パス> diff` なども毎回確認が出る（ask は auto モードでも確認になる。公式ドキュメント permission-modes）。手間として受け入れる
- （#1 の 8）メジェドと diff-reviewer は、セッションの作業ディレクトリを読み書きする前提で、作業ツリーのパスを受け取らない。また、メインのチェックアウトで書いた未コミットの plan.md・review.md は worktree に入らない
- サブエージェントの操作も、親と同じ権限のルールとフックを通る（公式ドキュメント permission-modes）
- 対象は「テンプレートを入れたリポジトリで開いたセッション」。別のリポジトリで開いたセッションから worktree を触る形は対象外
- このリポジトリには phpcs が無い（common-rules.md のチェックコマンドは WordPress のリポジトリ向け）。**このタスクのチェックコマンドは `node claude/hooks/test-guard-code-edit.mjs` だけ**とする（メジェドの報告の「チェックコマンドの結果」と「2回以上落ちたチェック」も、これで数える）
- 4リポジトリへの反映は、このタスクではしない（#1 の残りと一緒）

## worktree で作業するときの決まり（スキルとエージェントに書く中身）

- 置き場所は `.claude/worktrees/<名前>/`。パスは、どこでも**リポジトリの根からの相対パス**（`.claude/worktrees/<名前>`）で書き、渡す（Git Bash の `/c/...` 形は Node.js と PowerShell で別のパスになるため）
- **worktree を作るのは gh-issue スキル（まーちゅうに頼まれたとき）だけ。** plan-writer・delegate-to-mejed は worktree もブランチも作らない（plan-writer の「ブランチ作成をしない」、Ganesha.md の「頼まれていないブランチの切り替えをしない」のまま）
- gh-issue で worktree が用意されているときは、plan.md も review.md も worktree の中の `docs/tasks/<タスク名>/` に書く（メインのチェックアウトの未コミットのファイルは worktree から見えないため）。用意されていなければ、今のまま（メインで書き、delegate-to-mejed がブランチを切る）
- ファイルの読み書きは worktree の中。git は `git -C <パス>`。ほかのコマンド（チェックコマンドなど）は、括弧で囲んだ `(cd <パス> && <コマンド>)` で打つ（メインのセッションでは `cd` が次の Bash に持ち越され、相対パスがずれるため。括弧の中の `cd` は持ち越さない）。健さんのラッパーは `-WorkingDirectory <パス>`
- worktree を使わないときは、今のまま（セッションの作業ツリーで `git switch -c`）

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/hooks/guard-code-edit.mjs` | 変更 | プロジェクトの中のパスが `.claude/worktrees/<名前>/` で始まるなら、その頭を剥がした相対パスで、今と同じ判定（秘密情報・メジェド・ガネーシャの書ける場所）をする。秘密情報の判定だけは、剥がす前のパスにも当てる（worktree の名前が `.kv` などでも抜けないように）。`.claude/worktrees/<名前>` そのもの（頭を剥がすと空）は、今と同じ判定のまま |
| `claude/hooks/test-guard-code-edit.mjs` | 新規 | フックの確かめ。フックに入力の JSON を流して、終了コードを見る。git は呼ばない。依存なし |
| `claude/settings.json` | 変更 | ask に `Bash(git -C:*)`・`Bash(git -c:*)`・`Bash(git --git-dir*)`・`Bash(git --work-tree*)`（この2つは空白を挟まない形。`--git-dir=<パス>` の書き方にも当てるため。`:*` は「空白のあと何でも」）・`Bash(git --no-pager:*)` を足す |
| `repo-files/gitignore.snippet` | 新規 | 各リポジトリの `.gitignore` に足す行：`.claude/worktrees/` と `docs/tasks/*/codex/` |
| `claude/skills/plan-writer/SKILL.md` | 変更 | gh-issue で worktree が用意されているときは、plan.md をその中に書く。worktree は作らない（上の「決まり」を指す） |
| `claude/skills/delegate-to-mejed/SKILL.md` | 変更 | 手順2に「worktree で作業するとき」の分かれを足す（`.claude/worktrees/<名前>/` にあるならそのパスを作業ツリーとし、`git switch -c` はしない）。メジェドに渡すものに作業ツリーのパスを足す（worktree のときだけ）。差分は `git -C <パス>` で取る |
| `claude/skills/diff-reviewer/SKILL.md` | 変更 | 作業ツリーのパスを受け取ったら、git は `git -C <パス>` で、ファイルと review.md はそのパスの下を読み書きする |
| `claude/agents/mejed.md` | 変更 | 作業ツリーのパスを渡されたら、上の「決まり」のとおりに読み書きし、コマンドを打つ |
| `claude/skills/codex/SKILL.md` | 変更 | worktree で呼ぶときは `-WorkingDirectory <パス>` を付ける。「壊しに来る役を頼むとき」の「直ったのか隠しただけか」の差分の取り方は、worktree のときも `-C` を付けない（健さんはラッパーの `-WorkingDirectory` で worktree を作業の根にして動くので、頼みの文のコマンドは作業の根からの形のままでよい。`-C` を付けると二重になって失敗する）、と書く。返事は、worktree から呼んでも**メインのチェックアウト**の `docs/tasks/<タスク名>/codex/` に残る（写す手順は要らない） |
| `claude/skills/codex/scripts/invoke-codex.ps1` | 変更 | 返事の保存先を、作業の根ではなく、メインのチェックアウト（`git -C <作業の根> worktree list --porcelain` の1件目の `worktree` の行）の `docs/tasks/<タスク名>/codex/` にする。worktree でないときは今と同じ場所になる。求められなければ今と同じ（作業の根）にする。番号の振り方は今と同じ |
| `README.md` | 変更 | 中身と置き場所の表に `test-guard-code-edit.mjs`・`gitignore.snippet` を足す。導入方法の `.gitignore` の手順を、健さんを使うかどうかに関係ない手順にして snippet を指す。上の「決まり」を1段落（worktree の git は毎回確認が出ること、ask に足した柵の範囲も書く） |
| `docs/tasks/worktree-guard/review.md` | 新規 | ガネーシャが書く記録 |

**リポジトリの外の変更**（PR に入らない。**メジェドは触らない。** PR の前の健さんの確認のあとで、まーちゅうに確かめてからガネーシャが直す）

| パス | 変更の概要 |
| --- | --- |
| `~/.claude/skills/gh-issue/SKILL.md` の「4. 作業計画を書く」「6. worktree を切る」 | リポジトリに `.claude/agents/mejed.md` がある（テンプレートを入れた）ときは、worktree を `<repo>/.claude/worktrees/<repo>-<issue#>` に作り、作業計画は 4 では書かずに、6 の後で plan-writer スキルで worktree の中の `docs/tasks/<タスク名>/plan.md` に書く（そのリポジトリの決まり。4 の「リポジトリ内に計画ファイルを新設しない」の例外）、を足す。それ以外のリポジトリは今のまま |
| `~/.claude/skills/gh-flow/references/worktree.md` | 置き場所の説明と、ジャンクションの作成・解除、worktree の削除、復旧のコマンドのすべてに、同じ分かれ（テンプレートを入れたリポジトリは `.claude/worktrees/`）を入れる |
| `~/.claude/skills/gh-wrapup/SKILL.md` の worktree を消す段・`references/cleanup-commands.md` | 消す先を、作ったときの置き場所（作業計画に書いたパス）にする。テンプレートを入れたリポジトリは `.claude/worktrees/` の下 |
| `~/.claude/skills/gh-flow/references/commit-style.md` の例 | `git -C` の例の worktree のパスに、テンプレートを入れたリポジトリでは `.claude/worktrees/<repo>-<n>` になる、を添える |

## 変更内容

### 関数・フック

| 名前 | 種別 | 引数 | 戻り値 | 役割 |
| --- | --- | --- | --- | --- |
| `guard-code-edit.mjs` の `judge` | 関数（変更） | 今と同じ | 今と同じ | プロジェクトの中の相対パスを求めたあと、秘密情報の判定を剥がす前のパスに当て、`.claude/worktrees/<名前>/` で始まれば頭を剥がして、秘密情報・メジェド・ガネーシャの判定に回す。指定されたパスとリンクをたどった実体のパスの両方に当てるのは今と同じ |

### データの流れ

- Edit・Write：Claude Code → `guard-code-edit.mjs` → プロジェクトの中か → 秘密情報（剥がす前）→ `.claude/worktrees/<名前>/` を剥がす → 今の判定
- Bash：Claude Code が区切りごとに settings.json のルールを当てる → `git -C` などで始まる部分は ask

## 使う API と方針

- Node.js の標準モジュールだけ（`node:fs`・`node:path`・`node:os`）。フックもテストも git を呼ばない
- 剥がすときの照合は、今の `normalize`・`forMatch` と同じ（区切りは `/` にそろえ、Windows では小文字にそろえる）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- #1 の 2〜4・6・9・10（フックの範囲・`git stash` などの権限・PowerShell ツールの権限・スキルどうしの食い違い（`feature/` の決め打ちを含む）・外への依存・gh-review との重なり・hub との差）
- git の書き方を見分けるフック（わざと別の形にする書き方を防ぐこと・サンドボックス）
- 4リポジトリへの反映（`.gitignore` と各リポジトリのチェックコマンドの除外も、反映のときに入れる）
- 別のリポジトリで開いたセッションから worktree を触ること

## 完了条件

- [ ] `node claude/hooks/test-guard-code-edit.mjs` が通る。少なくとも次を確かめている
  - `.claude/worktrees/<名前>/` の中で：メジェドはコードを編集できる／ガネーシャは `.md` と `docs/tasks/` だけ編集できる／秘密情報のファイル（`.env` など）は誰も編集できない
  - 境界：`.claude\worktrees\x\a.php`（`\` 区切り）と `.CLAUDE/Worktrees/x/a.php`（大文字小文字。Windows だけ）が `.claude/worktrees/x/a.php` と同じ判定／`.claude/worktrees/.kv/docs/tasks/a.md` はガネーシャも止まる（剥がす前の秘密情報）／`.claude/worktrees/x/../../.env` は止まる／`.claude/worktrees/x` そのものはガネーシャが止まる
  - 今までの判定（メインのチェックアウトの中・リポジトリの外・メモリ・scratchpad）が変わっていない
- [ ] settings.json の ask に、上の5つのルールがある（`--git-dir`・`--work-tree` は空白を挟まない形）
- [ ] plan-writer・delegate-to-mejed・diff-reviewer・mejed.md・codex スキルに、worktree で作業するときの置き場所（相対パス）・plan.md と review.md の場所・git の打ち方（`git -C <パス>`）がある（それぞれ自分に関わるところ）。worktree を作るのは gh-issue だけで、plan-writer・delegate-to-mejed は作らない、と書いてある
- [ ] worktree からラッパーを呼んだとき、返事がメインのチェックアウトの `docs/tasks/<タスク名>/codex/` に保存される（実装の後に1回呼んで確かめ、review.md に書く）
- [ ] `repo-files/gitignore.snippet` に `.claude/worktrees/` と `docs/tasks/*/codex/` の2行があり、README の導入方法が、健さんを使うかどうかに関係なく snippet を指している
- [ ] README の中身と置き場所の表に、足した2つのファイルがあり、worktree で作業するときの決まりの段落がある
- [ ] （リポジトリの外）gh-issue・gh-flow の worktree.md と commit-style.md・gh-wrapup と cleanup-commands.md に、テンプレートを入れたリポジトリでは `.claude/worktrees/` に作り、そこから消す分かれがある。古い置き場所を決め打ちしたコマンド（作成・ジャンクション・削除・復旧）が、分かれの外に残っていない（`grep` で確かめる）
- [ ] 差分に、ローカルの絶対パスと契約しているプラン名が無い

## テスト観点

- `.claude/worktrees/<名前>` の直下のファイル・深い階層・まだ無いファイル（新規作成）
- リンクを経由して `.claude/worktrees/` の外を指す場合（今の「リンクの実体でも判定」がそのまま効くか）
- 実際の Claude Code のセッションで、`.claude/worktrees/` のファイルをメジェドが確認なしで Edit できるか、`git -C .claude/worktrees/<名前> diff` に確認が出るか、`(cd <worktree> && <チェックコマンド>)` がどう扱われるか（確認が出るか・作業ディレクトリが持ち越されないか）（フックの単体の確かめとは別に、#1 の反映のあとの実際のタスクで確かめる）

## 承認前の確認

### 承認依頼1・Fable（2026-10-06）

- 採った（plan.md を直した）：必須4（`git -C` 以外の書き方で deny がすり抜ける／作業ディレクトリの外なので Edit・`cd` に確認が出る／本物の worktree のテストと「git を呼ばない」が両立しない／このリポジトリのチェックコマンドが回らない）、推奨4（別のリポジトリで開いたセッションは対象かが不明／テストが本物の settings.json を読むか不明／PowerShell ツールを見ない／入れ子の `.git` で判定が変わる）。2つ目を受けて、置き場所をリポジトリの中に替えた（まーちゅうの判断）。3つ目と入れ子の `.git` は、`.git` を読む仕掛けごと無くなった
- 確認事項に移した：なし
- 見送った（理由）：推奨1（diff-reviewer のコミット後の差分が `feature/` 決め打ちで、このブランチ名では取れない）。このタスクのレビューはコミット前に行うので当たらない。`feature/` の決め打ちは #1 の 3 で扱う

### 承認依頼1・健さん1回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：7件すべて（改訂履歴の3行目）
- 確認事項に移した：なし
- 見送った（理由）：なし（7件目は一部だけ。`cd` と `git` の組み合わせで確認が出るのは公式ドキュメントの文で確かめてあるので、背景に引用して残した）
- 返事：`docs/tasks/worktree-guard/codex/01-consult.md`（Git に入れない）

### 承認依頼1・健さん2回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：5件すべて（改訂履歴の4行目）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/worktree-guard/codex/02-consult.md`

### 承認依頼1・健さん3回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：6件すべて（改訂履歴の5行目）。1〜3（git のフックの判定）は、フックごとやめて問題を無くした
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/worktree-guard/codex/03-consult.md`

### 承認依頼1・健さん4回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：3件すべて（改訂履歴の6行目）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/worktree-guard/codex/04-consult.md`

### 承認依頼1・健さん5回目（2026-10-06）

- 指摘：必須1・推奨1。どちらも確かめて本当だった。**上限の5回目なので直さずに保留**（まーちゅうに判断を頼む）
  - 必須：gh-issue は「4. 作業計画を書く」の後に「6. worktree を切る」で、4 に「リポジトリ内に計画ファイルを新設しない」がある。「worktree を先に作り、その中に plan.md を書く」と順番も禁止文も合わない。plan-writer の「ブランチ作成をしない」とも、worktree を誰が作るかが決まっていない
  - 推奨：codex スキルの「直ったのか隠しただけか」の差分の取り方（`git diff HEAD`・`git status --porcelain -uall`）が裸のままで、worktree のときに `git -C <パス>` にする、が対象の変更概要に無い
- 数：Fable 1回・健さん5回（指摘 7 → 5 → 6 → 3 → 2）
- その後：まーちゅうの指示で2件を直し、承認（改訂履歴の7行目）。健さんの6回目は回していない
- 返事：`docs/tasks/worktree-guard/codex/05-consult.md`

## 確認事項

- なし
