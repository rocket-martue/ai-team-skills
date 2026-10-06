# レビュー：skill-consistency

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：要修正
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目 ／ 承認依頼 1

メジェドの報告は、最初から「途中で2回以上落ちたチェック：なし」の行が入っていた（今回の mejed.md の変更は反映まで効かないので、参考）。`claude/settings.json` は、まーちゅうの許可を得てガネーシャが書き換えた（allow に `git status:*`・`git fetch:*`・`gh repo view:*`）。

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| `node claude/hooks/test-guard-code-edit.mjs` が通る | ○ | 「全部通った」。フックはコメントの重複を1つにしただけ |
| `feature/` の決め打ちが無い | ○ | `grep -rn "feature/" claude repo-files README.md` は0件 |
| delegate-to-mejed の手順2と Ganesha.md が食い違わない | ○ | 両方に「実装の依頼にブランチを切ることが含まれる」。ただし手順2の中の別の箇条に古い参照（指摘1） |
| diff-reviewer と codex の `-Base` が `origin/<既定ブランチ>`。codex に今のブランチを確かめる決まり | ○ | |
| `gh pr create` に `--repo`・`--base`・`--head` | ○ | push も `git push -u origin <ブランチ>` |
| delegate-to-mejed にユーザー側のスキルの参照が無い（ボードの節が無い） | ○ | |
| 手順2が `--no-track` で `origin/<既定ブランチ>` から切り、`gh repo view` に origin の URL を渡す。手順8の push が宛先つき | ○ | |
| settings.json の allow に `git status:*`・`git fetch:*`・`gh repo view:*` | ○ | |
| diff-reviewer の `description`・Ganesha.md・README に PR の指摘は diff-reviewer で | ○ | スキルの名前は書いていない |
| mejed.md の報告が5行の決まった形 | ○ | |
| 配るファイルの新しい行にユーザー側のスキルの名前が無い | ○ | `gh-` に当たったのは `gh-merge-base`（git の設定キー）だけ |
| 差分にローカルの絶対パス・契約プラン名が無い | ○ | |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | claude/skills/delegate-to-mejed/SKILL.md:18 | worktree の箇条が「次の『main にいて』『切る』の代わりに」と言っているが、「main にいて」の箇条は今回消え、「ブランチを切る」（子の箇条3つ）に変わった。指す先が無い | 「次の『ブランチを切る』の代わりに」にする | 手順2の worktree の箇条を「次の『ブランチを切る』の代わりに」に直した | 解決 |

### 見送った指摘（あれば）

- repo-files/docs/team/Ganesha.md:23 の「Bash 経由の書き込みは止まらない」が、hook-scope で common-rules.md を「Bash・PowerShell 経由」に直したのに古いまま。今回の計画の対象外なので、4リポジトリへの反映のときにまとめて直す

### 計画への指摘（あれば）

- なし

## 第2回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目の後 ／ 承認依頼 1

### 指摘

- なし（第1回の指摘1は、18行が「次の『ブランチを切る』の代わりに」になり、「main にいて」はファイルに残っていない。チェックコマンドも「全部通った」）

## 第3回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：要修正
- 出所：健さん・review・1回目
- 数：PR の前の健さん 1回目 ／ diff-reviewer の指摘による修正依頼 2回目 ／ 承認依頼 1

返事は `docs/tasks/skill-consistency/codex/06-review.md`。2件とも確かめて本当だった。計画の本文に効くので plan.md も直した（改訂履歴の最後の行）。1件目は settings.json なので、ガネーシャが直した（`Bash(git fetch:*)` → `Bash(git fetch origin)`）。

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | claude/settings.json:8 | `Bash(git fetch:*)` は `git fetch --force origin main:refs/heads/<ブランチ>` のようにローカルのブランチを上書きする書き方も確認なしで通す | 引数ちょうどの `Bash(git fetch origin)` にする | ガネーシャが直した（メジェドは触らない） | 解決 |
| 2 | 必須 | claude/skills/delegate-to-mejed/SKILL.md:18-21 | worktree のときは「ブランチを切る」の箇条ごと置き換わるので、その子の「既定のブランチと `<owner>/<name>` を求める」も飛ばされる。手順8の `gh pr create` で両方の値が要る | 「`git fetch origin`」と「既定のブランチと `<owner>/<name>` を求める」を、worktree の箇条と「ブランチを切る」の前の共通の箇条に出す。worktree の箇条は「次の『ブランチを切る』の代わりに」のまま（省くのはブランチを切るところだけ）。worktree のときは `git -C <パス> remote get-url origin` | `git fetch origin` と「既定のブランチと owner/name を求める」を共通の箇条として worktree の箇条の前に出した（worktree のときは `git -C <パス>` 版を併記）。worktree の箇条は「次の『ブランチを切る』の代わりに」のまま、「ブランチを切る」の子は switch だけにした | 解決 |

## 第4回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 2回目の後 ／ 承認依頼 1

### 指摘

- なし（第3回の指摘2は、手順2で「`git fetch origin`」と「既定のブランチと `<owner>/<name>` を求める」が worktree の箇条の前の共通の箇条になり、「ブランチを切る」の子は `git switch -c` だけになった。チェックコマンドも「全部通った」）

## 第5回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：要修正
- 出所：健さん・review・2回目
- 数：PR の前の健さん 2回目 ／ diff-reviewer の指摘による修正依頼 3回目 ／ 承認依頼 1

返事は `docs/tasks/skill-consistency/codex/07-review.md`。確かめて本当だった。

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | claude/skills/codex/SKILL.md:37 | `-Base` で呼ぶ前のブランチの確かめ（`git status --short --branch`）と `git fetch origin` は、ラッパーを呼ぶリポジトリの根で打つので、worktree のときはメイン側のブランチを見る。正しいレビューまで保留してしまう | worktree のときは `git -C <パス> fetch origin`・`git -C <パス> status --short --branch` で確かめる、と書く | codex スキルの `review` の箇条に、worktree のときは `git -C <パス> fetch origin`・`git -C <パス> status --short --branch` で確かめる、と足した | 解決 |

## 第6回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 3回目の後（上限に達した。次に要修正が出たら保留） ／ 承認依頼 1

### 指摘

- なし（第5回の指摘1は、37行に worktree のときの `git -C <パス> fetch origin`・`git -C <パス> status --short --branch` が入った。チェックコマンドも「全部通った」）

## 第7回（2026-10-06）

- 対象：`chore/1-skill-consistency`（未コミット）
- 判定：OK
- 出所：健さん・review・3回目
- 数：PR の前の健さん 3回目 ／ 承認依頼 1

### 指摘

- なし（健さんの返事：「変更内容と未追跡ファイルを確認し、修正が必要な不具合は見つかりませんでした。JSON・JavaScript の構文確認は通っています。フックのテストは一時ファイルの作成が権限制限で拒否され、実行できませんでした」。テスト全体はガネーシャとメジェドの手元で「全部通った」。返事は `docs/tasks/skill-consistency/codex/08-review.md`）

### PR を出す前に確かめること（リポジトリの外）

- [x] gh-review・gh-pr・gh-flow の `description` と冒頭に、`.claude/skills/delegate-to-mejed/` があるリポジトリではこのスキルを使わない、の決まりを書いた（まーちゅうの OK を得て、ガネーシャが直した。2026-10-06）
