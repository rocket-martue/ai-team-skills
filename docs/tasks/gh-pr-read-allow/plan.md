# 計画書：gh-pr-read-allow

- 作成：ガネーシャ（2026-10-14）
- 承認：[x] まーちゅう（承認日：2026-10-14。承認の言葉：「承認」）
<!-- 承認欄の埋め方は作業の流れ（プラグイン ai-team の docs/workflow.md）の「承認欄」 -->
- ブランチ：`chore/59-gh-pr-read-allow`
- イシュー：Refs #59（この PR ではクローズしない。完了条件の「VS Code のセッションで確かめる」は、各リポジトリに反映した後に確かめるため）
- worktree：リポジトリの外
- メジェドのモデル：haiku（既定）
- レビューの道：承認前は Fable・健さん ／ PR の前は 健さん ／ PR の後は なし
- 改訂履歴：
  - 2026-10-14 初版
  - 2026-10-14 確認事項へのまーちゅうの答えで改訂。今回足す allow の6つは、PowerShell の形にも足す（もともとある allow は Bash だけのまま）。README・delegate-to-mejed の「allow は Bash にだけ」の文を、その形に合わせて直す
  - 2026-10-14 承認前の確認（Fable・1回）の指摘で改訂。PR の前の `-p` の確かめは、通らなかったことではなく記録の `permissionDecision` で ask に当たったかを見る（見分けられなければ確かめられなかったとする）。`git remote get-url origin` は cwd がメインでも worktree でもそのまま打つ。漏れの限界に、引用符つき・空白2つの書き方と、`--web`・`--watch` を足して README にも書く。`gh co` のエイリアスと `--web`・`--watch` を決まりで押さえないことを対象外に足した
  - 2026-10-14 健さん consult 1回目の指摘で改訂。サブコマンドの別名（`gh pr new`・`gh pr co` を ask、`gh pr ls` を allow）を振り分けに足した。テストで `PowerShell(gh pr:*)` が無いことも確かめる。worktree の git を `-C` で打つ決まり（README・delegate-to-mejed）に、`git remote get-url origin` の例外を書く。背景のローカルのパスを消した
  - 2026-10-14 健さん consult 2回目の指摘で改訂。README の「worktree での git は毎回確認が出る」（`:214`）にも、`git remote get-url origin` の例外を書く
  - 2026-10-14 健さん consult 3回目の指摘で改訂。`git remote get-url origin` を cwd のまま打つのは、`extensions.worktreeConfig` で worktree ごとに remote を変えていない前提だと書く。gh-skills の worktree.md の同じ言い切りは、PR の後にイシューを立てる（背景の「イシューは立てない」を直した）
  - 2026-10-14 PR の前の確かめで、-p の default モードでは ask に当たったかを見分けられないと分かった（どの決まりにも当たらない `gh issue status` と記録が同じ）ので、まーちゅうに相談して改訂。ask の側は auto モードで、無い番号への `gh pr comment` と、比べる用の `gh issue comment` で確かめる（まーちゅうの言葉：「このセッションはAutoモードで回してる」）
  - 2026-10-14 承認依頼2の健さん consult 1回目の指摘で改訂。delegate-to-mejed の `$(` の完了条件を、手順のコマンドに限った。allow の判定を `reasonType` が `rule` か `subcommandResults` にした

## 目的

読むだけの `gh pr`（list・view・diff・checks・status）を、確認なしで打てるようにする。書き込む `gh pr`（create・edit・comment など）には、今までどおり確認を出す。あわせて、delegate-to-mejed の `gh repo view "$(git remote get-url origin)"` を2回に分けて、`$(...)` のために出る確認をなくす。

## 背景・前提

- #59 の本文：swx-inventory-hub のセッションで、PR を出すまでに `gh pr list`・`gh pr view` に確認が出た。読むだけなのに、テンプレートの `repo-files/claude/settings.json` の ask の `Bash(gh pr:*)` に当たっている
- **ask は allow より先に見られる。** 公式ドキュメント（https://code.claude.com/docs/en/permissions の「Manage permissions」）：「Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order.」「a matching ask rule prompts even when a more specific allow rule also matches the same call.」。だから、ask の `Bash(gh pr:*)` を残したまま allow に `Bash(gh pr list:*)` を足しても、`gh pr list` には確認が出る。ask の `gh pr:*` を、書き込むサブコマンドの個別の決まりに分ける
- ask の決まりは auto モードでも確認を出す（https://code.claude.com/docs/en/permission-modes：「Explicit ask rules still force a prompt.」）。どの決まりにも当たらないコマンドは、Manual（default）では確認が出て、auto モードでは判定器に回る。だから、個別に分けた ask から漏れた書き方は、auto モードでは確認なしで通りうる。漏れるのは、gh に後から足されたサブコマンドと、決まりの文字列に当たらない書き方（`gh pr "create" …` のような引用符つき・`gh pr  create` のような空白が2つ。決まりは、送られたコマンドの文字列そのままと照らす：https://code.claude.com/docs/en/permissions「The value is compared against the literal input Claude sends, before any normalization.」。今の `gh pr:*` には当たる）。限界として承知し、今の gh（2.93.0）のサブコマンドは全部どちらかに振り分ける
- allow に移る読むだけのサブコマンドにも、ローカルの副作用があるフラグがある：`view`・`diff`・`list` の `--web`（ブラウザを開く）、`checks` の `--watch`（チェックが終わるまで戻らない）。GitHub には書き込まないので allow に置き、限界として README に書く
- `gh pr --help`（gh 2.93.0）のサブコマンド：create・list・status・checkout・checks・close・comment・diff・edit・lock・merge・ready・reopen・revert・review・unlock・update-branch・view。サブコマンドの別名（各サブコマンドの `--help` の「ALIASES」）：`gh pr new`（create）・`gh pr ls`（list）・`gh pr co`（checkout）。別名も今の `gh pr:*` には当たるので、分けた決まりにも別名を入れないと、ask から漏れる（create・checkout）
- cobra は、サブコマンドの名前の前のフラグも読む（`gh pr -R <owner>/<name> create` は create として動く）。この書き方は `Bash(gh pr create:*)` に当たらないので、ask に `Bash(gh pr -*)` を足して、フラグが前にある `gh pr` は全部確認にする（読むだけでも確認が出るが、スキルはいつも `--repo` をサブコマンドの後に書いている）
- #59 のコメント（マージの後の片付け）：delegate-to-mejed の「マージの後」の手順1 `gh repo view "$(git remote get-url origin)" --json …` に、「Quoted text in this command can't be checked before it runs」の確認が出た。`$(...)` の中身は打つ前に確かめられないので、allow に関係なく確認が出る。同じ書き方が「手順」の2にもある（`plugins/ai-team/skills/delegate-to-mejed/SKILL.md:19`）。gh-skills（`~/.claude/skills/gh-*`）には `$(git` の書き方は無い（2026-10-14 に grep で確かめた）。ただし、gh-skills の `gh-flow/references/worktree.md:24` に「worktree での git は毎回確認が出る」の言い切りがあり、この変更の後は `git remote get-url origin` が例外になって合わなくなる
- `git remote get-url` は今の allow に無い。2回に分けたら、`git remote get-url origin` を確認なしで打てるように allow に足す。worktree は、メインのチェックアウトと同じ `.git` の設定（remote）を持つので、セッションの cwd がメインのチェックアウトでも worktree でも、`git remote get-url origin` だけで同じ URL が返る（2026-10-14、Fさんがリポジトリの外の worktree で打って、メインと同じ URL が返った）。`git -C <パス> remote get-url origin` は要らない（`git -C` は ask で確認が出る）。ただし、`extensions.worktreeConfig` を有効にすると worktree ごとの設定で remote を変えられ、この前提が崩れる（https://git-scm.com/docs/git-worktree#_configuration_file）。ai-team のリポジトリ（ai-team-skills・swx-inventory-hub・swx-site-inventory・ganesha-mejed-channel・Ganemeje-Voice-Studio）では未設定だと 2026-10-14 に確かめた。使わない前提として書く
- 今の決まり：allow は Bash にだけ置き、PowerShell には置かない（README の「git の権限（settings.json）」：「allow は PowerShell には足していない」。delegate-to-mejed の「マージの後」：「allow は Bash にだけあるため。PowerShell ツールでは allow のコマンドも確認が出る」）。ask と deny は、Bash と PowerShell の両方に同じ形で置く（`test-guard-code-edit.mjs` がそろっているかを確かめている）
- まーちゅうの決めたこと（2026-10-14 の会話）：今回足す allow は、PowerShell の形にも足す。もともとある allow（`git diff`・`git log`・`git status`・`git fetch origin`・`gh repo view`・`git show`・phpcs・健さんのラッパー）は、Bash だけのまま
- `plugins/ai-team/hooks/test-guard-code-edit.mjs` は、`repo-files/claude/settings.json` を読んで、ask に決まった決まりがあることと、Bash の ask・deny と同じ形の PowerShell の決まりがあることを確かめている（`:490-520`）
- worktree での git は `git -C <パス>` で打つ決まりがある（`README.md:212`、`plugins/ai-team/skills/delegate-to-mejed/SKILL.md:20`）。`git remote get-url origin` だけは、その例外にする（`-C` を付けない）と書かないと、決まりどおりに `-C` を付けて ask に当たる
- `plugins/ai-team/agents/adversary.md:35` は、Fさんが `gh pr` を使わない理由を「settings.json の ask に当たり、バックグラウンドで止まるため」と書いている。この変更の後は、読むだけの `gh pr` は ask に当たらなくなる

## 対象ファイル

| パス | 種別（新規／変更／削除） | 変更の概要 |
| --- | --- | --- |
| `repo-files/claude/settings.json` | 変更 | ask の `gh pr:*` を書き込むサブコマンドの個別の決まりに分ける。allow に読むだけの `gh pr` と `git remote get-url` を足す |
| `plugins/ai-team/hooks/test-guard-code-edit.mjs` | 変更 | settings.json の確かめに、`gh pr` の分け方を足す |
| `plugins/ai-team/skills/delegate-to-mejed/SKILL.md` | 変更 | `gh repo view "$(git remote get-url origin)"` を2回に分ける（手順2と「マージの後」の手順1）。「マージの後」の ask・allow の箇条を直す |
| `plugins/ai-team/agents/adversary.md` | 変更 | `gh pr` を使わない理由の文を直す |
| `README.md` | 変更 | 「git の権限（settings.json）」の表と、PowerShell の allow の文を直す。「worktree で作業するとき」の git の箇条に例外を足す |

## 変更内容

1. `repo-files/claude/settings.json`
   - ask から `Bash(gh pr:*)` と `PowerShell(gh pr:*)` を消す
   - ask に、次の14個を Bash と PowerShell の両方の形で足す（`Bash(gh pr <サブコマンド>:*)` と `PowerShell(gh pr <サブコマンド>:*)`）：create・new・edit・comment・close・reopen・ready・review・checkout・co・revert・lock・unlock・update-branch（`new` は create、`co` は checkout の別名）。これに加えて、フラグが前にある形 `Bash(gh pr -*)` と `PowerShell(gh pr -*)`
   - allow に、次の7つを Bash と PowerShell の両方の形で足す：`gh pr list:*`・`gh pr ls:*`（list の別名）・`gh pr view:*`・`gh pr diff:*`・`gh pr checks:*`・`gh pr status:*`・`git remote get-url:*`（`Bash(gh pr list:*)` と `PowerShell(gh pr list:*)` のように）。もともとある allow には PowerShell の形を足さない
   - deny の `gh pr merge` の2つはそのまま
   - 並びは、今のファイルの並び（Bash の決まりのまとまりの後に PowerShell のまとまり）に合わせ、`gh pr` の決まりは、今 `gh pr:*` があった位置に並べる
2. `plugins/ai-team/hooks/test-guard-code-edit.mjs` の「settings.json」の確かめ
   - ask に、変更内容1で足した Bash の ask（14個と `gh pr -*`）があることを確かめる（今の ask の一覧の確かめに足す）
   - ask に `Bash(gh pr:*)` と `PowerShell(gh pr:*)` が無いことを確かめる（あると allow の読むだけの `gh pr` に確認が出るため。今の PowerShell の形の確かめは、Bash の決まりに対応する PowerShell の決まりがあるかだけを見て、余分な PowerShell の決まりは見つけないので、PowerShell も別に確かめる）
   - allow に、変更内容1で足した7つが Bash と PowerShell の両方の形であることを確かめる
   - allow のどの決まりも、ask の決まりと同じ文字列でないことは確かめない（今の確かめに無い）
   - PowerShell の形がそろっているかの今の確かめは、そのまま（足した ask にも効く）
3. `plugins/ai-team/skills/delegate-to-mejed/SKILL.md`
   - 手順2の箇条「既定のブランチと `<owner>/<name>` を、origin を引数にして求める」（`:19`）：`git remote get-url origin` で URL を求めてから、その URL を引数に `gh repo view <URL> --json defaultBranchRef,nameWithOwner` を打つ、の2回に分ける。`$(...)` でつながない理由（中身を打つ前に確かめられないので、allow に関係なく確認が出る）を括弧で添える。worktree のときの `git -C <パス> remote get-url origin` の書き方は消し、cwd がメインのチェックアウトでも worktree でも `git remote get-url origin` をそのまま打つ（worktree は同じ remote の設定を持つため。`git -C` を付けない。`extensions.worktreeConfig` で worktree ごとに remote を変えていない前提）と書く。`GH_REPO` の理由の括弧は残す
   - 手順2の worktree の箇条（`:20`）の「git は `git -C <パス>` で打ち」に、`git remote get-url origin` は例外で `-C` を付けない（remote は worktree と共通で、`-C` を付けると ask に当たるため）を足す
   - 「マージの後」の手順1（`:66`）：同じく2回に分ける
   - 「マージの後」の箇条（`:77`）：「`gh pr view`・`git switch`・`git pull` は ask で、確認が出る。`gh repo view`・`git fetch origin`・`git status` は allow」を、`gh pr view`・`git remote get-url` を allow の側に移した形にする（ask は `git switch`・`git pull`）
   - 「マージの後」の前置き（`:64`）の「**Bash ツールで**次の順に打つ（allow は Bash にだけあるため。PowerShell ツールでは allow のコマンドも確認が出る）」：Bash ツールで打つことは変えない。理由を、`gh repo view`・`git fetch origin`・`git status` の allow は Bash にだけあるため、の形に直す（`gh pr view`・`git remote get-url` は PowerShell にもあるが、全部を Bash でそろえる）
4. `plugins/ai-team/agents/adversary.md:35`：「`git -C`・`git -c`・`gh pr` は使わない（settings.json の ask に当たり、バックグラウンドで止まるため）」の理由を、ask に当たるのは `git -C`・`git -c` と書き込む `gh pr` であること、読むだけの `gh pr` も、差分はガネーシャの渡した取り方で取るので使わないこと、の形に直す（使わないものは変えない）
5. `README.md` の「git の権限（settings.json）」
   - 「許可」の行に、`gh pr list`（`ls`） / `view` / `diff` / `checks` / `status`（読むだけ）と `git remote get-url` を足す
   - 「確認付き」の行の `gh pr` を、`gh pr create`（`new`） / `edit` / `comment` / `close` / `reopen` / `ready` / `review` / `checkout`（`co`） / `revert` / `lock` / `unlock` / `update-branch` と、フラグがサブコマンドの前にある `gh pr` に直す
   - 表の後に、分けた理由を箇条で足す：ask は allow より先に見られる（決まりの細かさでは順番が変わらない）ので、読むだけの `gh pr` を allow にするには ask を書き込むサブコマンドごとに分ける必要があること。分けた ask から漏れた書き方（gh に後から足されたサブコマンド、引用符つき・空白が2つなど決まりの文字列に当たらない書き方）は、Manual では確認が出るが auto モードでは判定器に回ること（gh を更新して `gh pr` にサブコマンドや別名が増えたら、どちらかに振り分ける。別名は各サブコマンドの `--help` の「ALIASES」に出る）。`gh pr -R … create` のようにフラグが前にある書き方は `gh pr -*` で確認にしていること。読むだけのサブコマンドでも `--web`（ブラウザを開く）・`gh pr checks --watch`（終わるまで戻らない）は確認なしで通ること。gh のエイリアス `gh co`（`gh pr checkout`）は `gh pr` で始まらないので、前と同じく決まりに当たらないこと
   - 「同じルールを、PowerShell ツールにも…（allow は PowerShell には足していない）」の括弧を、allow は読むだけの `gh pr`（別名の `ls` を入れて6つ）と `git remote get-url` だけ PowerShell にも足していて、ほかの allow は Bash にだけ、の形に直す
   - 「worktree で作業するとき」の「git は `git -C <パス>`」の箇条（`:212`）に、`git remote get-url origin` は例外で `-C` を付けない（remote は worktree と共通。`-C` を付けると ask に当たる）を足す。同じ節の「**worktree での git は毎回確認が出る**」（`:214`）も、`git remote get-url origin`（`-C` を付けない）を除いて、の形に直す

### データの流れ

- Claude Code は、Bash ツールのコマンドを deny → ask → allow の順に settings.json の決まりと照らす
  - `gh pr list …`・`gh pr view …` など：deny・ask に当たらず、allow に当たる → 確認なしで通る
  - `gh pr create …` など：ask の個別の決まりに当たる → 確認が出る
  - `gh pr -R … <何か>`：ask の `gh pr -*` に当たる → 確認が出る
  - `gh pr merge …`：deny に当たる → 止まる
- delegate-to-mejed：`git remote get-url origin`（allow）の出力の URL を、ガネーシャが次の `gh repo view <URL> --json …`（allow）の引数に書く

## 方針

- 決まりは、今の settings.json の書き方（`Bash(<コマンド>:*)`）に合わせる
- 今回足す allow だけ PowerShell にも置く（まーちゅうの決めたこと）。もともとある allow を PowerShell にそろえるのは、このタスクではしない
- ask から漏れても Manual では確認が出るので、gh の今のサブコマンドとその別名を全部どちらかに振り分けることで足りるとする。gh を更新したときの見直しは README に書くだけで、仕組みは作らない
- テストは、今の確かめ（決まりの一覧が入っているか）の形に合わせて足す

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- `git add`・`git commit`・`git push`・`gh pr create` の ask を外すこと、`gh pr merge` の deny を外すこと
- `gh api graphql` を allow に入れること
- もともとある allow（`git diff` など）に PowerShell の形を足すこと
- `gh issue`・`gh repo` など、`gh pr` 以外の gh の決まりを変えること
- 各リポジトリへの反映（README の「テンプレートを直した後の反映」で、頼まれてから行う）
- gh-skills（`~/.claude/skills/gh-*`）の変更。`gh-flow/references/worktree.md:24` の言い切りの直しは、PR を作った後に、まーちゅうの OK を取ってから、ガネーシャが gh-skills のリポジトリにイシューを立てる（gh-skills は worktree と PR で直す決まりのため、この PR には入れない）
- gh の大域のエイリアス（`gh alias list` の `gh co` = `gh pr checkout` など。`gh pr` で始まらない）を決まりで押さえること（今の `gh pr:*` にも当たっていない、前からの穴。README に書くだけ）。サブコマンドの別名（`gh pr new`・`gh pr co`・`gh pr ls`）は対象に入れる
- `--web`・`--watch` を決まりで確認にすること（README に限界として書くだけ）

## 完了条件

- [ ] README の「このリポジトリで打つチェックコマンド」の6本が通る（validate の警告は `version` が無いことだけ）
- [ ] `repo-files/claude/settings.json` の ask に `Bash(gh pr:*)`・`PowerShell(gh pr:*)` が無く、変更内容1の14個と `gh pr -*` が Bash と PowerShell の両方の形である
- [ ] 同じファイルの allow に、`gh pr list:*`・`gh pr ls:*`・`gh pr view:*`・`gh pr diff:*`・`gh pr checks:*`・`gh pr status:*`・`git remote get-url:*` が Bash と PowerShell の両方の形であり、それ以外の PowerShell の allow は無い。deny の `gh pr merge` の2つが残っている
- [ ] `gh pr --help`（gh 2.93.0）のサブコマンド18個と、各サブコマンドの `--help` の「ALIASES」に出る別名3つ（new・ls・co）が、allow（list・ls・view・diff・checks・status）・ask（変更内容1の14個）・deny（merge）のどれか1つにだけ入っている
- [ ] `test-guard-code-edit.mjs` が、変更内容2の3つ（ask にある・ask に `Bash(gh pr:*)` と `PowerShell(gh pr:*)` が無い・allow に Bash と PowerShell の両方の形である）を確かめている
- [ ] delegate-to-mejed の手順のコマンドに `$(` が無く（`$(...)` は、つながない理由の文にだけある）、手順2と「マージの後」の手順1が `git remote get-url origin` → `gh repo view <URL> --json defaultBranchRef,nameWithOwner` の2回になっている。手順2に worktree のときの `git -C <パス> remote get-url origin` が無く、worktree の箇条に `git remote get-url origin` は `-C` を付けない例外がある
- [ ] delegate-to-mejed の「マージの後」の ask・allow の箇条と、前置きの Bash ツールで打つ理由が、変更後の settings.json と合っている
- [ ] adversary.md の `:35` に当たる行の理由が、変更内容4のとおり
- [ ] README の「git の権限」の表と箇条が、変更内容5のとおりで、settings.json の allow・ask・deny と合っている。「worktree で作業するとき」の git の箇条に `git remote get-url origin` の例外があり、同じ節の「worktree での git は毎回確認が出る」にも、その例外が書いてある
- [ ] PR の前に、ガネーシャが `claude -p --settings repo-files/claude/settings.json --output-format stream-json --verbose`（worktree の根で打つ。`--settings` に `enabledPlugins` は無い）を2回打ち、Bash ツールで1つずつ打たせたコマンドを、セッションの記録（`~/.claude/projects/<プロジェクト>/<session_id>.jsonl`）の tool_result の行の `permissionDecision` で判定し、結果を PR 本文に書く。1回目（`--permission-mode default`）：`gh pr list --repo rocket-martue/ai-team-skills --limit 1`・`gh pr view <マージ済みの PR の番号> --repo rocket-martue/ai-team-skills --json state`・`git remote get-url origin` が確認なしで通り、`permissionDecision` が `decision: accept`・`source: config`・`reasonType` が `rule` か `subcommandResults`（allow の決まりに当たった）。2回目（`--permission-mode auto`。無い番号に向けた、通っても失敗するだけのコマンドで確かめる）：`gh pr comment 999999 --repo rocket-martue/ai-team-skills --body x` と `gh pr -R rocket-martue/ai-team-skills comment 999999 --body x` が `decision: reject`（ask に当たり、確認を受けられずに止まった）で、比べる用の `gh issue comment 999999 --repo rocket-martue/ai-team-skills --body x`（どの決まりにも当たらない）が `reasonType: classifier`（判定器に回った）。比べる用が classifier にならない、または ask の2つが classifier になったときは、見分けられなかった・ask が効いていないとして完了にせず、保留してまーちゅうに伝える。打つ前に、PR・イシューの 999999 が無いことを `gh pr view`・`gh issue view` で確かめる
- [ ] 差分（plan.md・review.md を含む）に、ドライブ文字（`C:` など）やユーザー名を含むローカルのパスが無い

## テスト観点

- -p の default モードでは、ask に当たっても、どの決まりにも当たらなくても、記録が同じ `{"decision":"reject","source":"config"}` になる（2026-10-14 に確かめた）。ask が効くかは auto モードで、判定器に回るコマンドと比べて見る
- ask と allow に同じサブコマンドが入っていないか（入っていると ask が勝って、allow が効かない）
- `gh pr` のサブコマンドと別名の書き漏れ・書き間違い（`update-branch` のハイフンなど）
- `gh pr -*` が、読むだけの `gh pr list` などに当たらないか（`gh pr list` は `-` で始まらないので当たらないはず）
- delegate-to-mejed の2回に分けた手順で、worktree のときに違う remote を引かないか

## 承認前の確認

### 承認依頼1・Fable（2026-10-14）

1回目は、まーちゅうが途中で止めた（PowerShell の allow の改訂の前の版を見ていたため）。済んだとは扱わず、改訂した版で回し直した。下はその回し直しの結果。

- 採った（plan.md を直した）：5件（全部推奨。`-p` で通らなかっただけでは ask に当たったと言えない／allow に移る `--web`・`--watch` のローカルの副作用／「メインのチェックアウトで打つ」が `git -C` を呼び込む／引用符つき・空白2つの書き方が分けた ask に当たらない／`gh co` のエイリアスの穴を対象外に書いていない）。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん1回目（2026-10-14）

- 採った（plan.md を直した。必須として書く）：4件（サブコマンドの別名 `gh pr new`・`gh pr co` が分けた ask から漏れる／plan.md の背景にローカルのパスが残っていた／`PowerShell(gh pr:*)` が残ってもテストが通る／worktree の git を `-C` で打つ決まりと食い違う）。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/01-consult.md`

### 承認依頼1・健さん2回目（2026-10-14）

1回目の頼み（Codex の 429 で返事が取れなかった）は、指摘なしとは扱わず、まーちゅうの「待つ」で15分おいて頼み直した。回数には、返事が取れた頼み直しの分だけを数える。

- 採った（plan.md を直した。必須として書く）：1件（README の「worktree での git は毎回確認が出る」の言い切りが、例外を足した後も残る）。改訂履歴の5行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/02-consult.md`

### 承認依頼1・健さん3回目（2026-10-14）

- 採った（plan.md を直した。必須として書く）：2件（`extensions.worktreeConfig` のときは worktree と remote が違いうる／gh-skills の worktree.md にも同じ言い切りがあり、背景の「イシューは立てない」が外れていた）。改訂履歴の6行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/03-consult.md`

### 承認依頼1・健さん4回目（2026-10-14）

- 採った（plan.md を直した。必須として書く）：なし（指摘なし）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/04-consult.md`

### 承認依頼2・健さん1回目（2026-10-14）

最初の頼みは、Codex の枠を使い切っていて返事が取れなかった。指摘なしとは扱わず、まーちゅうの「待つ」で、枠が戻った後に頼み直した。

- 採った（plan.md を直した。必須として書く）：2件（`$(` の完了条件が理由の文まで不合格にする／allow の判定が `reasonType` の無いときも合格にする）。どちらも完了条件の言い回しを狭めて直した（足していない）。改訂履歴の最後の行
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/06-consult.md`

### 承認依頼2・健さん2回目（2026-10-14）

- 採った（plan.md を直した。必須として書く）：なし
- 確認事項に移した：なし
- 見送った（理由）：1件（必須とされた「`subcommandResults` は組み込みの読むだけの許可でも出るので、足した allow に当たった証拠にならない」）。allow を空にした設定（`{"permissions":{"allow":[],"ask":[],"deny":[]}}`）で同じ `claude -p --permission-mode default` を打つと、`gh pr list`・`gh pr view`・`git remote get-url origin` の3つとも `{"decision":"reject","source":"config"}` で止まった（2026-10-14、Claude Code 2.1.296）。今の版では、この3つは組み込みの許可では通らず、テンプレートの設定で通ったのは足した allow による。比べる手順を完了条件に足すのは、指摘を足す方向で直さない（plan-writer の承認前の確認の6）ために見送る。足した決まりがあることは `test-guard-code-edit.mjs` が確かめる
- 返事：`docs/tasks/gh-pr-read-allow/codex/07-consult.md`

## 確認事項

- #59 の本文には、allow に足す読むだけの `gh pr` を「PowerShell の形も同じに」とある。今の決まり（allow は Bash にだけ。README と delegate-to-mejed に理由つきで書いてある）に合わせて、この計画では PowerShell の allow は足さない。PowerShell にも足すか
  - → PowerShell の allow は足す。今回足す分だけ（2026-10-14 まーちゅう）
- 完了条件の「VS Code のセッション（Manual）で確かめる」は、各リポジトリに反映した後に確かめるので、PR は `Refs #59` にする。反映と確かめは別に頼んでもらう形でいいか
  - → OK（2026-10-14 まーちゅう）
