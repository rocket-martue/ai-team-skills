# レビュー：gh-pr-read-allow

<!-- 回ごとに下に追記する。過去の回は消さない -->

## 第1回（2026-10-14）

- 対象：`chore/59-gh-pr-read-allow`（未コミット）
- 判定：要修正
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 0回目 ／ 承認依頼 1
- メジェドのモデル：haiku

### メジェドの報告

- 結果：完了
- 途中で2回以上落ちたチェック：なし

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| README の「このリポジトリで打つチェックコマンド」の6本が通る（validate の警告は `version` が無いことだけ） | ○ | ガネーシャが打った。フックのテスト3本は全部通った、ラッパーは 79/79、validate は2つとも終了コード 0 で警告は `version` だけ |
| settings.json の ask に `Bash(gh pr:*)`・`PowerShell(gh pr:*)` が無く、14個と `gh pr -*` が Bash と PowerShell の両方の形である | ○ | |
| allow に7つが Bash と PowerShell の両方の形であり、それ以外の PowerShell の allow は無い。deny の `gh pr merge` の2つが残っている | ○ | |
| サブコマンド18個と別名3つが、allow・ask・deny のどれか1つにだけ入っている | ○ | allow 6（list・ls・view・diff・checks・status）・ask 14・deny 1（merge）で21。重なりなし |
| テストが変更内容2の3つを確かめている | ○ | `test-guard-code-edit.mjs:511-542` |
| delegate-to-mejed に `$(` が無く、2つの手順が2回に分かれている。手順2に `git -C <パス> remote get-url origin` が無く、worktree の箇条に例外がある | ○ | `$(` が当たるのは `:19`・`:66` の「`$(...)` でつながない理由」の文だけ（変更内容3が理由を添えると決めている）。コマンドの形の `$(` は無い |
| 「マージの後」の ask・allow の箇条と前置きの理由が settings.json と合っている | ○ | `:64`・`:77` |
| adversary.md `:35` の理由が変更内容4のとおり | ○ | |
| README の「git の権限」の表と箇条が変更内容5のとおりで settings.json と合っている。「worktree で作業するとき」の例外と `:214` の言い切りにも例外がある | × | 中身はそろっているが、`README.md:173` の文の理由と結果がつながっていない（指摘1） |
| PR の前の `claude -p` の確かめ | 未 | ガネーシャが PR の前の確認と一緒に行う（plan.md のとおり） |
| 差分にドライブ文字・ユーザー名を含むローカルのパスが無い | ○ | plan.md・review.md も見た。当たったのは README の前からある文（Git Bash の `/c/...` 形の説明）だけ |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 必須 | README.md:173 | 「`--web`…と `gh pr checks --watch`…は、ローカルで副作用があるので、確認なしで通る」が、副作用があることを確認なしで通る理由のように読める。計画（変更内容5）は、副作用はあるが確認なしで通る、という限界を書くこと | 「ローカルの副作用はあるが、確認なしで通る」の形に直す（ほかの文は変えない） | README.md:173 を「ローカルの副作用はあるが、確認なしで通る」の形に直した | 解決 |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

### 良かった点（任意）

- settings.json の並びが今のまとまりのまま、`gh pr:*` のあった場所に入っていて、差分が読みやすい

## 第2回（2026-10-14）

- 対象：`chore/59-gh-pr-read-allow`（未コミット）
- 判定：OK
- 出所：diff-reviewer
- 数：diff-reviewer の指摘による修正依頼 1回目 ／ 承認依頼 1
- メジェドのモデル：haiku

### メジェドの報告

- 結果：完了
- 途中で2回以上落ちたチェック：なし

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| 第1回で × だった README の「git の権限」の項目 | ○ | `README.md:173` が「ローカルの副作用はあるが、確認なしで通る」になった。ほかの文は変わっていない（差分の行数も第1回と同じ） |
| チェックコマンドの6本 | ○ | メジェドの報告で全部通った（ラッパー 79/79、validate の警告は `version` だけ） |
| ほかの項目 | ○ | 第1回のとおり。`claude -p` の確かめは PR の前に行う |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | なし | - | - | - |

### 見送った指摘（あれば）

- なし

### 計画への指摘（あれば）

- なし

## 第3回（2026-10-14）

- 対象：`chore/59-gh-pr-read-allow`（未コミット）
- 判定：保留
- 出所：健さん・review・1回目
- 数：PR の前のレビュー役（健さん） 1回目 ／ 承認依頼 1
- メジェドのモデル：なし
- 返事：`docs/tasks/gh-pr-read-allow/codex/05-review.md`

### 健さんの指摘

- 指摘なし（「読み取り操作の許可と書き込み操作の確認が整合しており、今回の差分で導入された修正必須の不具合は見つかりませんでした」）

### PR の前の `claude -p` の確かめ（完了条件の最後の項目）

`claude -p --settings repo-files/claude/settings.json --permission-mode default --output-format stream-json --verbose` を worktree の根で打ち、セッションの記録の `permissionDecision` を見た。

| コマンド | permissionDecision | 結果 |
| --- | --- | --- |
| `gh pr list --repo rocket-martue/ai-team-skills --limit 1` | `{"decision":"accept","source":"config","reasonType":"subcommandResults"}` | 確認なしで通った |
| `gh pr view 73 --repo rocket-martue/ai-team-skills --json state` | 同上 | 確認なしで通った（`MERGED`） |
| `git remote get-url origin` | 同上 | 確認なしで通った |
| `gh pr create … --dry-run` | `{"decision":"reject","source":"config"}`・`toolDenialKind: user-rejected` | 止まった |
| `gh pr -R … create --dry-run …` | 同上 | 止まった |
| （比べる用）`gh issue status --repo rocket-martue/ai-team-skills`（どの決まりにも当たらない） | 同上 | 止まった |

- 止まった2つは、どの決まりにも当たらないコマンドと記録が同じで、ask に当たったのかを見分けられない。plan.md の完了条件のとおり「確かめられなかった」とし、完了にしないで保留する

## 第4回（2026-10-14）

- 対象：`chore/59-gh-pr-read-allow`（未コミット）
- 判定：OK
- 出所：diff-reviewer（承認依頼2で直した完了条件の最後の項目の確かめ）
- 数：承認依頼 2（実装は承認依頼1から変わっていないので、メジェドへの修正依頼と PR の前のレビュー役は回していない）
- メジェドのモデル：なし

### PR の前の `claude -p` の確かめ（完了条件の最後の項目）

worktree の根で `claude -p --settings repo-files/claude/settings.json --output-format stream-json --verbose` を2回打ち、セッションの記録の `permissionDecision` を見た（Claude Code 2.1.296）。打つ前に、PR・イシューの 999999 が無いことを `gh pr view`・`gh issue view` で確かめた。

| モード | コマンド | permissionDecision | 判定 |
| --- | --- | --- | --- |
| default | `gh pr list --repo rocket-martue/ai-team-skills --limit 1` | `{"decision":"accept","source":"config","reasonType":"subcommandResults"}` | ○ 確認なしで通った |
| default | `gh pr view 73 --repo rocket-martue/ai-team-skills --json state` | 同上 | ○ |
| default | `git remote get-url origin` | 同上 | ○ |
| auto | `gh pr comment 999999 --repo rocket-martue/ai-team-skills --body x` | `{"decision":"reject","source":"config"}` | ○ ask に当たって止まった |
| auto | `gh pr -R rocket-martue/ai-team-skills comment 999999 --body x` | 同上 | ○ `gh pr -*` に当たって止まった |
| auto | （比べる用）`gh issue comment 999999 --repo rocket-martue/ai-team-skills --body x` | `{"decision":"accept","source":"config","reasonType":"classifier"}` | ○ 判定器に回った（番号が無いので失敗した） |

### 完了条件チェック

| 完了条件 | 判定 | メモ |
| --- | --- | --- |
| delegate-to-mejed の手順のコマンドに `$(` が無い（承認依頼2で直した言い回し） | ○ | `:19`・`:66` の `$(...)` は、つながない理由の文だけ |
| PR の前の `claude -p` の確かめ（承認依頼2で直した形） | ○ | 上の表 |
| ほかの項目 | ○ | 第1回・第2回のとおり（実装は変わっていない） |

### 指摘

| # | 重要度 | ファイル:行 | 問題と理由 | 修正方針 | 対応（メジェド記入） | 再レビュー |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | なし | - | - | - |
