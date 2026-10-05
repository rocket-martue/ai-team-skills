# 計画書：adversary

- 作成：ガネーシャ（2026-10-05）
- 承認：[x] まーちゅう（承認日：2026-10-05。口頭の承認をガネーシャが記入）
- ブランチ：`chore/4-adversary`（作業は worktree `C:\Temp\wt\ats-4`）
- イシュー：#4
- 改訂履歴：
  - 2026-10-05 初版

## 目的

コードを書かずに壊しに来るだけの役（adversary）を、テンプレートに足す。
同じ計画を読んだレビュー（diff-reviewer）が同じ思い込みで読み飛ばすところを、計画を知らない目で突く。

## 決めたこと（まーちゅう・2026-10-05）

- 作り方は**案1から始める**：読むだけのサブエージェント（モデルは Fable）。Codex に任せる案2は #3 ができてから
- タイミングは**3つとも入れる**：計画の承認前／チェックが2回落ちたとき／PR の前
- PR の前の `/code-review` とは**並べる**（置き換えない）

## 背景・前提

- 2026-10-04 に、diff-reviewer の判定 OK の後で `/code-review` を回すと、指摘がまとまって出た（rocket-martue/ganesha-mejed-channel#62・rocket-martue/Ganemeje-Voice-Studio#7 の review.md）
- テンプレートの delegate-to-mejed には、まだ `/code-review` の段が無い。hub では rocket-martue/swx-inventory-hub#92 の3で足す予定だったが未着手。「並べる」ために、この計画で `/code-review` の段も一緒に入れる
- **サブエージェントは別のサブエージェントを呼べない。** 2つ目のタイミングは、メジェドが自分で呼ぶのではなく、メジェドの報告を受けたガネーシャが呼ぶ
- フック（`guard-code-edit.mjs`）は、`mejed` 以外のサブエージェントのコードの Edit / Write を止める。adversary もこれで止まる。ただし **`.md` と `docs/tasks/` は通る**（ガネーシャと同じ扱い）ので、plan.md・review.md は書き換えられてしまう。ここと Bash 経由は、定義の禁止事項で縛る（ほかの役と同じ）。フックの範囲の見直しは #1 で扱い、この計画ではフックと settings.json を変えない

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `claude/agents/adversary.md` | 新規 | 壊しに来る役の定義（下の「adversary.md の中身」） |
| `claude/skills/plan-writer/SKILL.md` | 変更 | 承認を頼む前に adversary を呼ぶ段（タイミング1） |
| `claude/skills/delegate-to-mejed/SKILL.md` | 変更 | メジェドの報告に「2回以上落ちたチェック」があれば adversary を呼ぶ段（タイミング2）。diff-reviewer の OK の後に adversary と `/code-review` を並べて回す段（タイミング3） |
| `claude/agents/mejed.md` | 変更 | 報告の形式に「途中で2回以上落ちたチェックと、通すために変えたこと」を足す。禁止事項に「チェックやテストを弱めて通すこと」を足す |
| `claude/skills/diff-reviewer/SKILL.md` | 変更 | adversary と `/code-review` の指摘の受け方（一次データで確かめてから review.md に書く。出所を書く） |
| `claude/skills/diff-reviewer/templates/review.md` | 変更 | 回の見出しの下に「出所」の行（diff-reviewer／adversary／/code-review／PR レビュー） |
| `repo-files/docs/team/common-rules.md` | 変更 | チームの表に adversary の行 |
| `repo-files/docs/team/Ganesha.md` | 変更 | 役割に「adversary を呼び、指摘を確かめる」 |
| `README.md` | 変更 | 中身と置き場所の表、編集できる範囲の表（adversary は「ほかのサブエージェント」と同じ扱い）、使い方の流れ |

## 変更内容

### adversary.md の中身

- frontmatter：`name: adversary`、`model: fable`、`tools: Read, Grep, Glob, Bash`
- 役割：計画・差分を壊す側から読む。**直さない・コードを書かない・指摘だけ**
- 受け取るもの（ガネーシャが渡す。ガネーシャ自身の結論や見立ては渡さない。メジェドへの頼み方と同じで、先入観を移さないため）
  - タイミングの名前（plan／repeated-failure／pre-pr）
  - タスク名と plan.md のパス
  - タイミング2・3は差分の取り方（`git diff HEAD`、未追跡ファイルの一覧）
  - タイミング2は、メジェドの報告の「2回以上落ちたチェック」の行
- タイミングごとの問い
  - plan：外との約束（ほかのリポジトリ・API・データの形）が両側で合っているか。完了条件は第三者が Yes／No で判定できるか。対象外にしたことが、実は対象に要らないか
  - repeated-failure：落ちていたチェックは本当に直ったのか、隠しただけか（テストを弱めた・条件を外した・例外を握り潰した・期待値を書き換えた）
  - pre-pr：何がこれを壊すか（境界値・空・重複・並行・古いデータ・権限・秘密情報）
- 最初に `docs/team/common-rules.md` と plan.md を Read で読む
- 報告の形式：指摘ごとに「重要度（必須／推奨）」「場所（ファイル:行 か plan.md の節）」「壊れ方（どんな入力・状態で、何が起きるか）」「根拠（実際に見たもの）」。見つからなければ「なし」と書く。推測は推測と書く
- 絶対にしないこと：ファイルの編集・作成（plan.md・review.md も含む。Bash 経由も）、コミット・ブランチ操作、秘密情報のファイルを読むこと、チェックコマンド以外のコマンドで状態を変えること

### タイミング1：計画の承認前（plan-writer）

- plan.md を書き終えて、まーちゅうに承認を頼む前に adversary を呼ぶ（改訂のときも、承認をやり直す改訂なら呼ぶ）
- 指摘は一次データ（コード・ほかのリポジトリ・仕様）で確かめる。本当のものは plan.md を直して改訂履歴に書くか、「確認事項」に移す。見送ったものは理由を添えて、承認を頼むときにまーちゅうへ伝える

### タイミング2：チェックが2回落ちたとき（delegate-to-mejed・mejed.md）

- メジェドは今までどおり、チェックが全部通るまで直す（途中で止めない）
- そのかわり報告に「途中で2回以上落ちたチェックと、通すために変えたこと」を書く。無ければ「なし」
- ガネーシャは、この行が「なし」でなければ、diff-reviewer の前に adversary を repeated-failure で呼ぶ。指摘は diff-reviewer の回に出所付きで入れる

### タイミング3：PR の前（delegate-to-mejed）

- diff-reviewer の判定が OK になったら、adversary（pre-pr）と `/code-review`（作業ツリーの差分）の両方を回す
- 指摘は1件ずつ一次データで確かめ、本当のものは review.md に新しい回として書き（出所を書く）、メジェドに直させて手順5（diff-reviewer）に戻る。見送ったものは理由を review.md に書く
- 直した後にもう1巡回すのは、事実・判断・規則に効く指摘が出た回だけ。**adversary と `/code-review` の巡は最大2回。** 2巡目でも必須が残ったら、まーちゅうに判断を頼む
- まーちゅうへの報告（手順7）に、両方の結果を入れる

### データの流れ

なし（スキル・エージェント定義・チーム文書だけ）。

## 方針

- 費用：Fable は1タスクで最大4回（タイミング1・2が各1回、タイミング3が2巡）。`/code-review` は最大2回
- 指摘を確かめるのはガネーシャ。adversary の指摘をそのまま直させない（`/code-review` と同じ扱い）

## 必須パターン

なし

## 対象外（やらないこと）

- 案2（Codex に壊しに来させる）。#3 ができてから、adversary の代わりに選べるようにする
- 4リポジトリ（hub・site・チャンネル・ボイススタジオ）への反映。テンプレートを直したあと、#1 の反映と一緒に行う
- 実際のタスクで1本回して確かめること（#4 の完了条件の2つ目）。反映した先のリポジトリで行う
- #1 の各項目（外部 worktree・フックの範囲など）と、hub #92 の承認欄の埋め方
- `/code-review` の段の中身を #92 の書き方に揃えること以上の変更

## 完了条件

- [ ] `claude/agents/adversary.md` があり、frontmatter が `model: fable`・tools が Read・Grep・Glob・Bash で、上の「adversary.md の中身」がすべて入っている
- [ ] plan-writer・delegate-to-mejed に3つのタイミングの段が入っていて、それぞれ「誰が呼ぶ」「何を渡す」「指摘をどこに書く」が読み取れる
- [ ] delegate-to-mejed の PR の前の段で、adversary と `/code-review` を両方回し、巡の上限（2回）が書いてある
- [ ] mejed.md の報告の形式に「途中で2回以上落ちたチェック」の行があり、禁止事項に「チェックやテストを弱めて通すこと」がある
- [ ] review.md のテンプレートに「出所」の行がある
- [ ] README・common-rules.md・Ganesha.md のチームの説明に adversary が出てくる
- [ ] フックの単体確認：`agent_type: adversary` の `src/a.js` の Edit が終了コード 2 で止まる（`docs/tasks/x/plan.md` は 0 で通ることも確かめ、定義の禁止事項に「plan.md・review.md を含め、ファイルを編集しない」があることを確かめる）

## テスト観点

- フックに `agent_type: adversary` の JSON を渡して、コードの編集が止まり、`.md` は通ることを確かめる（テンプレートのフックは変えないので、今の動きの確認）
- 反映先のリポジトリで実際に回す確認は、対象外（#4 の完了条件の2つ目として後で行う）

## 確認事項

- なし
