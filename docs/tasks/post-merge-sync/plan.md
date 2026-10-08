# 計画書：post-merge-sync

- 作成：ガネーシャ（2026-10-08）
- 承認：[x] まーちゅう（承認日：2026-10-08。承認の言葉：「いいよ」。PR は `Closes #19` で、ユーザー側の片付けのスキルはマージの後にガネーシャが直す、も OK）
<!-- 承認欄の埋め方は docs/team/workflow.md の「承認欄」 -->
- ブランチ：`chore/19-post-merge-sync`（リポジトリの外の worktree で作業）
- イシュー：#19。PR には `Closes #19` と書く
- 改訂履歴：
  - 2026-10-08 初版
  - 2026-10-08 承認前の確認（Fable・1回）の指摘で改訂。今のブランチを `git status` で確かめてから切り替える（worktree でもメインのチェックアウトが既定ブランチとは限らない）。既定ブランチは `gh repo view` で求め直す（「マージした」は別のセッションで言われる）。ブランチの片付けより先に行う。メジェドが止まったときのために workflow.md の「停止」の理由にコマンドが止められた場合を足す（対象外から外す）。完了条件の「手元の PC の状態」を判定できる形にした。ユーザー側のスキルの直しの追い先を PR の「マージの後」にした
  - 2026-10-08 健さん1回目の指摘で改訂。始める前に PR がこのリポジトリのもので MERGED かを確かめる。`switch` の前に未コミットの変更が無いことを確かめる。`pull` の後に、既定ブランチにいて origin と同じ（ahead・behind が無い）ことを確かめ、違えば止まる（確認待ちの間の切り替えと、ローカルが先行していて `--ff-only` が成功する場合のため）。`--ff-only` の説明を直した。Bash ツールで打つ（allow は Bash にだけある）。PR の「マージの後」の記載を完了条件に足した
  - 2026-10-08 健さん2回目の指摘で改訂。`gh pr view` の前に、言われた PR が、このセッションで作った PR か、まーちゅうの言葉のリポジトリと同じかを確かめる。未コミットの変更は `--untracked-files=all` を付けて確かめる。PR の本文の記載を完了条件から外し、「変更内容」に移した。確認待ちの間の切り替えは、防げない限界として背景に書いた

## 目的

マージの後に既定ブランチを origin に追いつかせる git を1つに決めて、テンプレートに書く。settings.json の allow・ask・deny とも食い違わないようにする。あわせて、コマンドが確認で止められた・拒否されたときの報告に、止まったコマンドと、ask（まーちゅうが確認で通せる）か deny（通せない）かを添える決まりを足す。

## 背景・前提

- 反映したリポジトリで、マージの後にガネーシャが `git merge --ff-only origin/<既定ブランチ>` を打ち、settings.json の deny（`Bash(git merge:*)`）に当たって止まった。どの git で進めればよいかが、テンプレートのどこにも書かれていない
- テンプレートの流れは PR を作ったところで終わる。マージの後の段は無い
  - `claude/skills/delegate-to-mejed/SKILL.md` の手順8は「PR を作ったら、まーちゅうに PR のリンクを渡して止まる。マージはしない」で終わる
  - `repo-files/docs/team/workflow.md` のフローチャートは、Copilot のレビュー（CP）で終わる
  - `README.md:110` の「使い方」は「5. マージ：まーちゅう」で終わる
- 今の settings.json（`claude/settings.json`）での扱い
  - `git switch`：ask
  - `git branch`：ask（引数の有無を問わず全部）
  - `git -C`：ask（worktree で作業するときの git は毎回確認が出る）
  - `git fetch origin`：allow（ちょうどこの形だけ。`git fetch --prune` などはどのリストにも無く、確認が出る）
  - `git merge`・`git reset`・`git checkout`・`git rebase`：deny
  - `git pull`：どのリストにも無い（確認が出る）
- `git pull` は、`--ff-only` を付けないと merge コミットを作れる。allow に置くと、`git merge` を deny にした柵をすり抜けられる。だから ask に置く（まーちゅうが確認のダイアログで、`--ff-only` が付いているかを見られる）
- `git pull --ff-only` は、早送りできないとき（ローカルと origin が分かれている）は何も変えずに失敗する。ただし、ローカルが origin より先に進んでいるだけのとき（origin がローカルの祖先）は、何もせずに成功する。だから、`pull` が成功しても、origin と同じになったとは限らない
- `git pull` は、打った時点の今のブランチを進める。確認のダイアログを待つ間に、別のセッションがメインのチェックアウトを切り替えると、そのブランチが早送りされる。これは防げない限界として受け入れる（同じ作業ツリーで並行しないのは common-rules.md の「タスクは1本ずつ」の前提。許可の範囲の git では防げない：`git fetch origin <既定ブランチ>:<既定ブランチ>` は今いるブランチには使えず、`git merge`・`git reset` は deny）。`pull` の後の確かめで見つけて止まる（早送りされただけなら、reflog で戻せる）
- settings.json の allow は Bash ツールのルールだけ（`README.md:89`）。PowerShell ツールで打つと、allow のコマンドも確認が出る
- Ganesha.md の「絶対にしないこと」に「まーちゅうに頼まれていないコミット、プッシュ、ブランチの切り替え、PR 作成」がある（`repo-files/docs/team/Ganesha.md`）。マージの後に既定ブランチへ切り替えるのが「頼まれたこと」に入るかが書かれていない
- 止まったときの報告の決まりは、どこにも無い。メジェドも Bash を使うので、規約はガネーシャ・メジェドの両方が読む `common-rules.md` に置く
- フックのテスト（`claude/hooks/test-guard-code-edit.mjs:203-227`）は、settings.json の ask に決まったルールがあることと、ask・deny の Bash のルールすべてに同じ形の PowerShell のルールがあることを確かめる
- ユーザー側の片付けのスキル（リポジトリの外）は、`git -C <パス> fetch --prune`・`git -C <パス> branch -d` を使う。どちらも反映先では ask（`git -C` で始まるため）で、deny には当たらない。既定ブランチを進める段は無い。このタスクでは、テンプレートの決まりと食い違わないことだけを確かめる
- このリポジトリのチェックコマンド（このタスクに限る）：`node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs`

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/settings.json` | 変更 | ask に `Bash(git pull:*)` と `PowerShell(git pull:*)` を足す |
| `claude/hooks/test-guard-code-edit.mjs` | 変更 | ask にあるべきルールの一覧（203-215行目）に `Bash(git pull:*)` を足す |
| `claude/skills/delegate-to-mejed/SKILL.md` | 変更 | 手順8の後に「マージの後」の節を足す |
| `repo-files/docs/team/Ganesha.md` | 変更 | 「絶対にしないこと」のブランチの切り替えの箇条に、マージの後に既定ブランチへ戻るのは頼まれたことに含まれる、と添える |
| `repo-files/docs/team/common-rules.md` | 変更 | 「作業の進め方」に、確認で止められた・拒否されたときの報告の決まりを足す |
| `repo-files/docs/team/workflow.md` | 変更 | 「言葉の決まり」の「停止」の理由の一覧に、コマンドが確認で止められた・拒否された場合を足す |
| `README.md` | 変更 | 「git の権限」の表に `git pull` を足す。「使い方」に「6. マージの後」を足す |
| `docs/tasks/post-merge-sync/review.md` | 新規 | ガネーシャが書く記録 |

## 変更内容

### 書く中身（言い回しはメジェドに任せる。意味はこのとおり）

- delegate-to-mejed の「マージの後」の節
  - まーちゅうに「マージした」と言われたら、既定ブランチを origin に追いつかせる。これは頼まれたことに含まれる
  - worktree・ブランチの削除より先に行う（今のブランチを消そうとすると失敗するため）
  - 打つ順は次のとおり。メインのチェックアウト（リポジトリの根）で、Bash ツールで打つ（allow は Bash にだけあるため）
    1. `gh repo view "$(git remote get-url origin)" --json defaultBranchRef,nameWithOwner` で、既定ブランチと `<owner>/<name>` を求め直す（「マージした」は PR を作ったのと別のセッションで言われることが多く、手順2の値が手元に無いため。`main` と決め打ちしない）
    2. 言われた PR が、このセッションで作った PR か、まーちゅうの言葉にリポジトリ名・URL があればそれが `<owner>/<name>` と同じかを確かめる。どちらでもない・分からないときは、何も触らずにまーちゅうに聞く（別のリポジトリ宛ての合図のことがあるため）
    3. `gh pr view <番号> --repo <owner>/<name> --json state,baseRefName` で、`state` が `MERGED`、`baseRefName` が既定ブランチであることを確かめる。違えば、何も触らずにまーちゅうに聞く
    4. `git fetch origin`
    5. `git status --short --branch --untracked-files=all` で、今のブランチと、未コミットの変更が無いこと（1行目の `##` の行だけ）を確かめる。変更があれば、何も触らずに止まって報告する（別のセッションの変更を既定ブランチへ持ち越さないため）。worktree で作業したときも確かめる（メインのチェックアウトが別のセッションに切り替えられていることがあるため）
    6. 今のブランチが既定ブランチでなければ `git switch <既定ブランチ>`
    7. `git pull --ff-only origin <既定ブランチ>`
    8. `git status --short --branch` で、1行目が `## <既定ブランチ>...origin/<既定ブランチ>` で、`[ahead`・`[behind` が付いていないことを確かめる。違えば止まって報告する（確認を待つ間に別のブランチへ切り替えられた・ローカルが origin より先に進んでいた、を見つけるため）
  - `git merge`・`git reset`・`git checkout` は deny なので使わない。`git pull` は `--ff-only` を必ず付ける（付けないと merge コミットを作れるため）
  - `git pull --ff-only` が失敗したら（早送りできない）、それ以上は打たずに止まって、まーちゅうに報告する
  - `gh pr view`・`git switch`・`git pull` は ask で、確認が出る
  - worktree・ブランチの片付けとイシューの扱いは、この節では決めない（ユーザー側の手順に任せる）
- PR の本文（ガネーシャが書く。完了条件ではない）：「マージの後」に、ユーザー側の片付けのスキルに「既定ブランチを origin に追いつかせる」段と、テンプレートの「マージの後」より後に片付けることを足す、と書く
- Ganesha.md：ブランチの切り替えの箇条の括弧に、「マージした」と言われた後に既定ブランチへ戻ること（delegate-to-mejed の「マージの後」）も、頼まれたことに含まれる、と足す
- workflow.md の「言葉の決まり」の「停止」の理由の一覧に「コマンドが確認で止められた・拒否された」を足す（メジェドが報告の「結果：停止（理由）」に書けるように。理由には、止まったコマンドと ask か deny かを書く）
- common-rules.md の「作業の進め方」に1箇条
  - コマンドが確認で止められた・拒否されたときは、別の書き方で回り込まずに止まる
  - 報告には、止まったコマンドそのものと、settings.json のどのルールに当たったか、それが ask（まーちゅうが確認のダイアログで通せる）か deny（通せない。別の書き方を決める必要がある）かを添える。どのリストにも無いコマンドで確認が出たときは、その旨を書く
- README
  - 「git の権限」の表：`git pull` を確認付きの行に足す。理由（`--ff-only` を付けないと merge コミットを作れるため、allow に置かない。マージの後は `--ff-only` で使う）を書く
  - 「使い方」に「6. マージの後：「マージした」→ ガネーシャが既定ブランチを origin に追いつかせる（delegate-to-mejed の「マージの後」）」を足す
- settings.json：ask に `Bash(git pull:*)` と `PowerShell(git pull:*)` を、既存の並び（Bash のまとまりと PowerShell のまとまり）に合わせて足す
- フックのテスト：ask にあるべきルールの一覧に `Bash(git pull:*)` を足す（PowerShell の方は、既存の「同じ形の PowerShell のルールがある」確かめで見られる）

### データの流れ

- まーちゅう「マージした」→ ガネーシャ（Bash ツール）：`gh repo view`（allow）→ 合図の PR がこのリポジトリのものか確かめる → `gh pr view --repo`（ask。MERGED とベースを確かめる）→ `git fetch origin`（allow）→ `git status --short --branch --untracked-files=all`（allow。ブランチと未コミットの変更）→ 既定ブランチでなければ `git switch <既定ブランチ>`（ask）→ `git pull --ff-only origin <既定ブランチ>`（ask）→ `git status --short --branch`（origin と同じか）→ どこかで違えば止まって報告 → その後で、worktree・ブランチの片付け（ユーザー側の手順）

## 使う WordPress API と方針

- なし（文書と settings.json だけ）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- ユーザー側の片付けのスキル（リポジトリの外）の変更。「既定ブランチを origin に追いつかせる」段を足すのと、テンプレートの「マージの後」より後に片付けることを書くのは、マージの後に、まーちゅうの許可を得てガネーシャが行う（PR の「マージの後」に書いて追う）
- `git fetch --prune` の allow への追加（ask の確認で足りる。規則を増やさない）
- workflow.md のフローチャートの変更（マージは流れの外。まーちゅうの手で行う。変えるのは「停止」の理由の一覧だけ）
- 各リポジトリへの反映（このタスクで変えるのはテンプレートだけ）
- worktree・ブランチの片付け、イシューを閉じるかの扱いの決まり

## 完了条件

- [ ] delegate-to-mejed に「マージの後」の節があり、手が `gh repo view` → 合図の PR がこのリポジトリのものかの確かめ → `gh pr view --repo`（MERGED・ベース）→ `git fetch origin` → `git status --short --branch --untracked-files=all` → （既定ブランチでなければ）`git switch <既定ブランチ>` → `git pull --ff-only origin <既定ブランチ>` → `git status --short --branch` の1通りに決まっていて、Bash ツールで打つとある
- [ ] その節に、PR が違う・未コミットの変更がある・`pull` の後に既定ブランチにいないか `[ahead`・`[behind` が付いている、のどれかなら止まることがある
- [ ] その節に、worktree・ブランチの削除より先に行うこと、worktree で作業したときも今のブランチを確かめることがある
- [ ] その節に、`git merge`・`git reset`・`git checkout` を使わないこと、`git pull` に `--ff-only` を必ず付けること、失敗したら止まって報告することがある
- [ ] settings.json の ask に `Bash(git pull:*)` と `PowerShell(git pull:*)` があり、allow・deny には `git pull` が無い
- [ ] 節で使うコマンドが、settings.json の deny に当たらない（`gh repo view`・`git fetch origin`・`git status` は allow、`gh pr view`・`git switch`・`git pull` は ask）
- [ ] Ganesha.md のブランチの切り替えの箇条に、マージの後に既定ブランチへ戻るのは頼まれたことに含まれる、とある
- [ ] common-rules.md に、止まったときはコマンドそのものと、ask か deny かを添えて報告する決まりがある
- [ ] workflow.md の「停止」の理由の一覧に、コマンドが確認で止められた・拒否された場合がある
- [ ] README の「git の権限」の表に `git pull`（確認付き・理由）があり、「使い方」に「マージの後」がある
- [ ] フックのテストの ask の一覧に `Bash(git pull:*)` がある
- [ ] `node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs` が通る
- [ ] 差分（plan.md・review.md を含む）に、ドライブ文字（`C:` など）やユーザー名を含むローカルのパスと、契約しているプラン名が無い（決まりの例として書いた `C:\...` の形は除く）

## テスト観点

- settings.json の形は、フックのテストで確かめる（ask の一覧と、Bash・PowerShell の対）
- 実際に ask の確認が出るかは、反映したリポジトリの次のタスクのマージの後で見る（このリポジトリには `.claude/settings.json` が無いので、ここでは確かめられない）

## 承認前の確認

### 承認依頼1・Fable（2026-10-08）

- 採った（plan.md を直した）：推奨6（今のブランチを確かめずに `git pull` すると別のブランチが動く／ユーザー側の片付けと順番が決まっていない／メジェドが止まったときの「停止」の理由が無い／既定ブランチを求め直す手が無い／「手元の PC の状態」が判定できない／ユーザー側のスキルの直しの追い先が無い）。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：1件（リポジトリの外の worktree の渡し方が、メジェドの定義の相対パスの形と違う。計画の中身ではなく渡し方の話で、絶対パスを渡すやり方は #21 で動いた）

### 承認依頼1・健さん1回目（2026-10-08）

- 採った（plan.md を直した。必須として書く）：6件（確認待ちの間に切り替えられると別のブランチが進む／別のリポジトリ宛ての「マージした」で動く／ローカルが先行していると `--ff-only` が成功して見逃す／未コミットの変更を既定ブランチへ持ち越す／ユーザー側のスキルの直しが完了条件に無い／PowerShell ツールでは allow にならない）。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/post-merge-sync/codex/01-consult.md`

### 承認依頼1・健さん2回目（2026-10-08）

- 採った（plan.md を直した。必須として書く）：3件（合図の PR とリポジトリの一致を確かめていない／PR の本文を完了条件にするとレビューと PR が循環する／`status.showUntrackedFiles=no` だと未追跡のファイルを見逃す）。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：1件（確認待ちの間に別のセッションが切り替えると別のブランチが進む。同じ作業ツリーで並行しないのが前提で、許可の範囲の git では防げない。`pull` の後の確かめで見つけて止まる。限界として背景に書いた）
- 返事：`docs/tasks/post-merge-sync/codex/02-consult.md`

### 承認依頼1・健さん3回目（2026-10-08）

- 採った：なし（指摘なし。前回の直しと、settings.json の ask の追加がテストと合うことも確かめた）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 採る指摘が無い回なので、承認依頼1の健さんはここで止める（数：Fable 1回・健さん3回。採った指摘は 6 → 6 → 3 → 0）
- 返事：`docs/tasks/post-merge-sync/codex/03-consult.md`

## 確認事項

- なし
