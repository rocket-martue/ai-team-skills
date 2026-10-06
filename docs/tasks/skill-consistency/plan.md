# 計画書：skill-consistency

- 作成：ガネーシャ（2026-10-06）
- 承認：[x] まーちゅう（承認日：2026-10-06。会話で「確認したよ　承認する」。settings.json をガネーシャが入れることを含む）
- ブランチ：`chore/1-skill-consistency`（リポジトリの外の worktree で作業。このリポジトリの `.gitignore` に `.claude/worktrees/` は無い）
- イシュー：#1 の 3・4・9（スキルどうしの食い違い・外への依存・gh-review との重なり）。PR には `Refs #1` と書く（#1 には 10（4リポジトリへの反映）が残るため）
- 改訂履歴：
  - 2026-10-06 初版
  - 2026-10-06 承認前の確認（Fable・1回）の指摘で改訂。ボードの Status の節を delegate-to-mejed から消した（動かすのに要る id が取れず、ボードは人ごとの使い方のため）。ブランチは origin/<既定ブランチ> から切り、既定のブランチと --repo の求め方を書く。テンプレートのブランチ欄は型を決めない。git fetch と gh repo view を allow に足す。gh-review の注記は description に書き、gh-flow・gh-pr の案内にも分かれを足す。配る文書にユーザー側のスキルの名前を新しく書かない
  - 2026-10-06 健さん1回目の指摘で改訂。ブランチは --no-track で切り、push は宛先を明示する。既定のブランチと owner/name は origin の URL を引数にした gh repo view で求める。gh-pr の /code-review の段にも分かれを足す（リポジトリの外）。リポジトリの外の変更とスキルの名前の確かめ方を完了条件に足した・直した
  - 2026-10-06 健さん2回目の指摘で改訂。リポジトリの外の変更を diff-reviewer の完了条件から外し、「PR を出す前に確かめること」に分けた。gh-flow の止まる地点にも分かれを足す。gh pr create に --base を足す。スキルの名前の確かめ方をコミット前と後の両方で書いた
  - 2026-10-06 健さん3回目の指摘で改訂。ユーザー側の gh-review・gh-pr・gh-flow には、段ごとの分かれをやめ、冒頭に「delegate-to-mejed があるリポジトリでは使わない」の1つの決まりだけを書く。codex スキルの -Base も origin/<既定ブランチ> にする。完了条件に --base を足した
  - 2026-10-06 健さん4回目の指摘で改訂。codex スキルの -Base で呼ぶ前に、今のブランチが plan.md のブランチと同じか確かめる
  - 2026-10-06 PR の前の健さん1回目の指摘で改訂。allow の git fetch は引数ちょうどの git fetch origin だけにした。既定のブランチと owner/name を求める箇条は worktree のときも通る共通のものにした

## 目的

スキル・エージェント・規約のあいだの食い違いと、リポジトリの外への依存を無くす。あわせて、メジェドの報告から「途中で2回以上落ちたチェック」の行が抜ける問題を、報告の形式の側で直す。

## 背景・前提

- （#1 の 3）
  - delegate-to-mejed の手順2は `git switch -c feature/<タスク名>` でブランチを切るが、Ganesha.md の「絶対にしないこと」は「まーちゅうに頼まれていないブランチの切り替え」を禁じている
  - ブランチ名が `feature/` の決め打ち（delegate-to-mejed の手順2・8、diff-reviewer の手順2、mejed.md の手順3、plan と review のテンプレート、README の使い方）。各リポジトリの慣習（`docs/`・`chore/`・`fix/`）と合わない
  - diff-reviewer のコミット後の差分は `git diff main...feature/<タスク名>`。ローカルの `main` が古いと、ほかの PR の変更が混ざる。既定のブランチが `main` でないリポジトリもある
- （#1 の 4）
  - delegate-to-mejed の「ボードの Status」が、ユーザー側の `~/.claude/skills/gh-flow/references/project-status.md` と `gh-wrapup` スキルに頼っている。別の PC やクラウドのセッションでは無い
  - delegate-to-mejed の手順8の `gh pr create` に `--repo` が無い（リポジトリをまたぐと、別のリポジトリの番号を黙って操作しうる）
  - settings.json の allow の `Bash(git status)` は完全一致なので、スキルが打つ `git status --short --branch` に当たらない。チェックの前に要る依存のインストール（`composer install`・`npm ci` など）も allow に無い
- （#1 の 9）「PR の指摘を見て」のような頼みで、テンプレートの diff-reviewer（PR に付いたレビュー）と、ユーザー共通の gh-review の両方が候補になる。gh-review が使われると、PR レビューの修正依頼の上限（workflow.md の表）と review.md への記録が抜ける
- （#1 の外）メジェドの報告から「途中で2回以上落ちたチェック」の行が、2026-10-06 だけで5回抜けた（書き直しを頼むと足された）。うち1回は、本当にテストが2回落ちていたのに、最初の報告には出ていなかった（hook-scope の review.md 第1回）。チェックコマンドが無いリポジトリや、修正の報告で省きやすい
- （hook-scope の review.md 第1回の推奨）`guard-code-edit.mjs` の `CONFIRM_PATTERNS` のコメントで、同じ説明が2回書かれている
- このリポジトリには phpcs が無い。**このタスクのチェックコマンドは `node claude/hooks/test-guard-code-edit.mjs` だけ**（フックのコメントを直すため。ほかは Markdown と settings.json）
- **`claude/settings.json` は、まーちゅうの許可を得てガネーシャが書き換える**（前のタスクと同じ）。メジェドは触らない
- 4リポジトリへの反映は、このタスクではしない

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/skills/delegate-to-mejed/SKILL.md` | 変更 | 手順2：ブランチを切るのは「メジェドに実装を頼まれた」ことに含まれる、と書く。「main にいて、main が最新」を、`git fetch origin` のあと `origin/<既定ブランチ>` から plan.md の「ブランチ」欄の名前で切る（`git switch -c <ブランチ> --no-track origin/<既定ブランチ>`。`--no-track` が無いと追跡先が既定のブランチになり、引数なしの `git push` が失敗するか既定のブランチへ送ってしまうため）にする。既定のブランチと `<owner>/<name>` は、origin を引数で指定して求める（worktree のときも通る共通の箇条にし、worktree のときに省くのはブランチを切るところだけ）（`gh repo view "$(git remote get-url origin)" --json defaultBranchRef,nameWithOwner`。環境変数 `GH_REPO` があっても origin と食い違わないように）。手順8：push は `git push -u origin <ブランチ>` と宛先を明示する。`gh pr create` に `--repo <owner>/<name>`・`--base <既定ブランチ>`・`--head <ブランチ>` を明示する（`--base` が無いと、ブランチの `gh-merge-base` の設定が既定のブランチより優先され、レビューした差分と PR の宛先が食い違うことがある）。**「ボードの Status」の節と、手順2・8のボードの箇条を消す**（ボードは人ごとの使い方なので、テンプレートは持たない。README に「ボードを使うなら、ユーザー側の手順で動かす」とだけ書く） |
| `claude/skills/diff-reviewer/SKILL.md` | 変更 | 手順2のコミット後の差分を、`git fetch origin` のあと `git log origin/<既定ブランチ>..<ブランチ> --oneline` と `git diff origin/<既定ブランチ>...<ブランチ>` にする（`<ブランチ>` は plan.md の「ブランチ」欄。worktree のときは `git -C <パス>`）。`description` に、PR のレビューの頼み方（「レビューの指摘に対応して」「Copilot のコメントを見て」「レビューに返信して」「再レビューを頼んで」）を足し、「ユーザー共通のレビュー用のスキルがあっても、このリポジトリではこちらを使う」と書く（スキルの名前は書かない。公開するリポジトリに手元の環境を書かないため） |
| `claude/agents/mejed.md` | 変更 | 手順3の `feature/<タスク名>` を「plan.md の『ブランチ』欄のブランチ」にする。「報告の形式」を、写して埋める5行の決まった形（コードブロック）にし、「5行すべてをこの順で書く。チェックコマンドが無いとき・修正の報告でも、『途中で2回以上落ちたチェック：なし』の行を省かない」と書く |
| `claude/skills/codex/SKILL.md` | 変更 | `review` のコミット済みを見るときの `-Base <既定ブランチ>` を、`git fetch origin` のあと `-Base origin/<既定ブランチ>` にする（diff-reviewer と同じ基準で比べるため）。`-Base` で呼ぶ前に、`git status --short --branch` で今のブランチが plan.md の「ブランチ」欄と同じか確かめ、違えば呼ばずに保留する（ラッパーは今のブランチ（HEAD）を見るので、別のブランチにいると別の変更を確認してしまうため。`git branch` は ask なので、allow の `git status` で確かめる） |
| `claude/skills/plan-writer/templates/plan.md` | 変更 | 「ブランチ」欄を `<ブランチ名>`（リポジトリの慣習に合わせて書く。型は決めない）にする |
| `claude/skills/diff-reviewer/templates/review.md` | 変更 | 対象欄の `feature/<タスク名>` を `<ブランチ>` にする |
| `repo-files/docs/team/Ganesha.md` | 変更 | 「頼まれていないブランチの切り替え」に、「メジェドへの実装の依頼（delegate-to-mejed の手順2）でブランチを切るのは、頼まれたことに含まれる」を添える。PR に付いたレビューは diff-reviewer で受ける（ユーザー共通のレビュー用のスキルがあっても使わない。スキルの名前は書かない）、を足す |
| `claude/settings.json` | 変更 | allow の `Bash(git status)` を `Bash(git status:*)` にする。allow に `Bash(git fetch origin)`（引数ちょうど。`--force` や refspec でローカルのブランチを上書きする書き方を確認なしで通さないため）・`Bash(gh repo view:*)` を足す（スキルが新しく打たせる、読むだけのコマンド）。**ガネーシャが入れる** |
| `claude/hooks/guard-code-edit.mjs` | 変更 | `CONFIRM_PATTERNS` のコメントの重複を1つにまとめる（判定は変えない） |
| `README.md` | 変更 | 使い方の `feature/<タスク名>` を「plan.md の『ブランチ』欄」にする。導入方法に「チェックの前に要る依存のインストール（`composer install`・`npm ci` など）は、リポジトリごとに settings.json の allow に足す」を足す。「PR の指摘」は diff-reviewer で受ける（ユーザー共通のレビュー用のスキルがあっても）、を足す。「ボードを使うなら、ユーザー側の手順で動かす」を足す |
| `docs/tasks/skill-consistency/review.md` | 新規 | ガネーシャが書く記録 |

**リポジトリの外の変更**（PR に入らない。メジェドは触らない。PR の前の健さんの確認のあとで、まーちゅうに確かめてからガネーシャが直す）

| パス | 変更の概要 |
| --- | --- |
| `~/.claude/skills/gh-review/SKILL.md`・`~/.claude/skills/gh-pr/SKILL.md`・`~/.claude/skills/gh-flow/SKILL.md` | 3つとも、`description` と本文の冒頭に同じ1つの決まりを書く：「リポジトリに `.claude/skills/delegate-to-mejed/` があるなら、このスキルは使わない。コミットと PR は delegate-to-mejed の手順8、PR に付いたレビューは diff-reviewer の『PR に付いたレビュー』に従う」。中の段ごとの分かれ（`/code-review` を飛ばす・止まる地点など）は足さない（途中から入り込む道を無くし、食い違いを生まないため） |

## 変更内容

### 関数・フック

| 名前 | 種別 | 引数 | 戻り値 | 役割 |
| --- | --- | --- | --- | --- |
| `guard-code-edit.mjs` の `CONFIRM_PATTERNS` のコメント | コメントだけ | — | — | 重複を消す。判定は変えない |

### mejed.md の報告の形式（決まった形）

コードブロックで次の5行を示し、写して埋めさせる（中身はスキル側の説明のまま）。

- `結果：` 完了／停止（停止なら理由）
- `変更したファイル：` パスの一覧
- `チェックコマンドの結果：` 打ったコマンドと結果。チェックコマンドが無いときは「無い」と書く
- `途中で2回以上落ちたチェック：` チェックの名前と、通すために変えたこと。無ければ「なし」
- `計画との差分：` あれば。無ければ「なし」

### データの流れ

- なし（スキルと規約の文章・設定の1行・コメントの変更）

## 使う API と方針

- なし（文章と設定）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- #1 の 10（4リポジトリへの反映）
- 依存のインストールを allow に足すこと（リポジトリごとに違う。README に書くだけ）
- ボードの Status をテンプレートで扱うこと
- 前からある、ユーザー側のスキルの名前への言及（gh-issue など）を消すこと（公開の前の整理でまとめて見る）
- フックの判定を変えること

## 完了条件

- [ ] `node claude/hooks/test-guard-code-edit.mjs` が通る（フックはコメントだけの変更）
- [ ] `claude/`・`repo-files/`・`README.md` に、ブランチ名を `feature/` で決め打ちした記述が無い（例として書いたものを除く。`grep -rn "feature/" claude repo-files README.md` で確かめ、残るものは「例:」の中だけ）
- [ ] delegate-to-mejed の手順2と Ganesha.md の禁止事項が食い違っていない（実装を頼まれたことにブランチを切ることが含まれる、と両方に書いてある）
- [ ] diff-reviewer のコミット後の差分と、codex スキルの `review` の `-Base` が、どちらも `git fetch origin` のあと `origin/<既定ブランチ>` を基準にしている。codex スキルに、`-Base` で呼ぶ前に今のブランチが plan.md の「ブランチ」欄と同じか確かめる決まりがある
- [ ] delegate-to-mejed の `gh pr create` に `--repo`・`--base`・`--head` がある
- [ ] delegate-to-mejed に、ユーザー側のスキル（`~/.claude/skills/`）を参照する記述が無い（「ボードの Status」の節が無い）
- [ ] delegate-to-mejed の手順2が `git fetch origin` のあと `--no-track` で `origin/<既定ブランチ>` から切り、既定のブランチと `--repo` の値を origin の URL を引数にした `gh repo view` で求めている。手順8の push が `git push -u origin <ブランチ>`
- [ ] settings.json の allow に `Bash(git status:*)`・`Bash(git fetch origin)`・`Bash(gh repo view:*)` がある
- [ ] diff-reviewer の `description`・Ganesha.md・README に、PR の指摘は diff-reviewer で受ける（ユーザー共通のレビュー用のスキルがあっても）と書いてある
- [ ] 配るファイルに新しく足した文に、ユーザー側のスキルの名前（`gh-` で始まるもの）が無い（追加行で確かめる。コミット前は `git diff HEAD -- claude repo-files README.md`、コミット後は `git diff origin/<既定ブランチ>...<ブランチ> -- claude repo-files README.md`。`docs/tasks/` の記録と、前からある記述は対象外）

### PR を出す前に確かめること（リポジトリの外。diff-reviewer の完了条件には入れない）

リポジトリの外の変更は、差分に出ず、PR の前の健さんの確認のあとで直すので、diff-reviewer の完了条件に入れると流れが回らない。PR を出す前に、ガネーシャが確かめて review.md の最後の回に書く。

- [ ] gh-review・gh-pr・gh-flow の `description` と冒頭に、`.claude/skills/delegate-to-mejed/` があるリポジトリではこのスキルを使わない、の決まりがある
- [ ] mejed.md の報告の形式が5行の決まった形で、「途中で2回以上落ちたチェック」を省かない決まりが書いてある
- [ ] 差分に、ローカルの絶対パスと契約しているプラン名が無い

## テスト観点

- このタスク自身のメジェドの報告で、「途中で2回以上落ちたチェック」の行が最初から入っているか（新しい mejed.md は反映するまで効かないので、参考として見る）
- 実際のリポジトリで、「PR の指摘を見て」と頼んだとき diff-reviewer が使われるか（反映のあとの実際のタスクで確かめる）

## 承認前の確認

### 承認依頼1・Fable（2026-10-06）

- 採った（plan.md を直した）：必須1（ボードを動かすのに要る id が取れない）、推奨6（ブランチの例が慣習と合わない／既定のブランチが main でないとき・求め方が無い／新しいコマンドが allow に無い／gh-review の注記の置き場所と他の入口／マージ後の手順が宙に浮く／配る文書にユーザー側のスキルの名前を書く）。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん1回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：5件すべて（追跡先が既定のブランチになり push を誤る／GH_REPO で別のリポジトリを見る／gh-pr の /code-review が必ず回る／リポジトリの外の変更の完了条件が無い／スキルの名前の確かめ方が計画書自身と未追跡のファイルで食い違う）。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/skill-consistency/codex/01-consult.md`

### 承認依頼1・健さん2回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：4件すべて（リポジトリの外の変更の完了条件が流れと循環する／gh-flow の止まる地点が再レビューを求める／スキルの名前の確かめ方がコミット後に空になる／--base が無い）。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/skill-consistency/codex/02-consult.md`

### 承認依頼1・健さん3回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：4件すべて（gh-pr から入ると確認済みかを見ずに /code-review を飛ばせる／健さんの -Base がローカルのブランチのまま／gh-flow の出口の条件が残る／完了条件に --base が無い）。1と3は、段ごとの分かれをやめて冒頭の1つの決まりにし、問題ごと無くした。改訂履歴の5行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/skill-consistency/codex/03-consult.md`

### 承認依頼1・健さん4回目（2026-10-06）

- 採った（plan.md を直した。必須として書く）：1件（コミット後の確認で、健さんは今のブランチを見るので、別のブランチにいると別の変更を確認する）。改訂履歴の6行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 返事：`docs/tasks/skill-consistency/codex/04-consult.md`

### 承認依頼1・健さん5回目（2026-10-06）

- 指摘なし。承認依頼1の健さんはここで止める（数：Fable 1回・健さん5回。指摘は 7 → 5 → 4 → 4 → 1 → 0）
- 返事：`docs/tasks/skill-consistency/codex/05-consult.md`

## 確認事項

- なし
