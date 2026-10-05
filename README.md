# AIチーム開発 スキル一式（下書き）

Claude Code だけで回す体制のスキル・チーム設定・権限設定。

- **ガネーシャ**（Claude Code のメイン）＝ 計画・メジェドへの実装依頼・レビュー・頼まれたときのコミットと PR・PR に付いた指摘の対応
- **メジェド**（サブエージェント `mejed`・Sonnet）＝ 実装・指摘の修正
- **まーちゅう** ＝ 要件決定・計画の承認・最終確認・マージ

> 以前は Codex をメジェドにしていたが、2つのツールの行き来（セッションの切り替え・進捗をリモートで見られない）の手間が大きかったので、
> サブエージェントだけにした（2026-10-04）。
> 当初は Codex の使用枠の消費も理由に挙げていたが、読み違いだった。5時間枠の表示の 85% は残りの量で、使ったのは 15% ほどだった（2026-10-05 に訂正。体制は変えない）。

## 中身と置き場所

`claude/` の中身を、リポジトリの `.claude/` にそのまま重ねる。

| ファイル | 担当 | 置き場所 |
| --- | --- | --- |
| `repo-files/docs/team/common-rules.md` | 共通 | リポジトリの `docs/team/common-rules.md` |
| `repo-files/docs/team/Ganesha.md` | ガネーシャ | リポジトリの `docs/team/Ganesha.md` |
| `repo-files/CLAUDE.md.snippet` | ガネーシャ | 中身を `CLAUDE.md` の先頭に追記 |
| `claude/agents/mejed.md` | メジェド | `.claude/agents/mejed.md`。キャラ・手順・報告の形式・禁止事項。モデルは Sonnet |
| `claude/skills/plan-writer/` | ガネーシャ | `.claude/skills/plan-writer/` |
| `claude/skills/delegate-to-mejed/` | ガネーシャ | `.claude/skills/delegate-to-mejed/`。メジェドに実装を頼み、レビュー→修正を最大3回回す |
| `claude/skills/diff-reviewer/` | ガネーシャ | `.claude/skills/diff-reviewer/`。PR 前の差分レビューと、PR に付いた指摘の対応 |
| `claude/hooks/guard-code-edit.mjs` | 全員 | `.claude/hooks/guard-code-edit.mjs`。編集の直前に「誰が・どこを」編集するかを見て止める |
| `claude/settings.json` | 全員 | `.claude/settings.json`。フックの登録と、git・秘密情報の権限 |

## ファイルの分け方

- **CLAUDE.md**：リポジトリの説明（構成、ビルド方法、テーマ・プラグイン情報など）。先頭で `@docs/team/Ganesha.md` を取り込む
- **docs/team/common-rules.md**：共通規約とチェックコマンド。ガネーシャは取り込みで、メジェドは作業の最初に Read で読む
- **docs/team/Ganesha.md**：ガネーシャの役割・キャラ設定・禁止事項
- **.claude/agents/mejed.md**：メジェドの役割・キャラ設定・禁止事項（メジェドの定義はここだけ）
- **スキル**：計画・実装の依頼・レビューの手順とテンプレート
- **フック＋settings.json**：編集できる範囲と git の権限

## 編集できる範囲（フックで判定）

| 誰が | docs/tasks/ と Markdown（.md） | それ以外のコード | 秘密情報（.dev.vars、.kv/、wp-config.php、.env） | リポジトリの外 |
| --- | --- | --- | --- | --- |
| ガネーシャ | ○ | × | × | `~/.claude/projects/<p>/memory/`・`~/.claude/plans/`・`<一時ディレクトリ>/claude/` だけ ○ |
| メジェド（mejed） | ○ | ○ | × | 同上 |
| ほかのサブエージェント | ○ | × | × | 同上 |

- Markdown を通すのは「コード以外（.md）の PR レビューの指摘はガネーシャが直す」（Ganesha.md）ため
- Windows のファイルシステムは大文字小文字を区別しないので、Windows ではパスを小文字にそろえてから照合する（`.DEV.VARS` も止まる）
- 判定は「指定されたパス」と「シンボリックリンク（ジャンクションを含む）をたどった実体のパス」の両方に当てる。リンク経由で秘密情報・コード・リポジトリの外を書き換えることはできない
- `~/.claude/` は丸ごと通さない。ユーザー共通の settings.json・CLAUDE.md・スキル・認証情報が入っているので、メモリと計画ファイルの2か所だけにする

- settings.json の `Edit(**/*.php)` のような禁止ルールはサブエージェントにも効いてしまい、メジェドが実装できなくなる。
  そのため編集の制限は settings.json ではなくフックで行う（フックの入力に含まれる `agent_id`／`agent_type` で呼び出し元を見分ける。メインのときは両方とも入らない）
- リポジトリの外で通すのは、Claude Code 自身の置き場所（メモリ・プランモードの計画ファイル・scratchpad）だけ
- 秘密情報のパターンは先頭で固定していないので、`.claude/worktrees/<名前>/.dev.vars` のような入れ子でも止まる

## git の権限（settings.json）

| 操作 | 扱い |
| --- | --- |
| `git diff` / `log` / `status` / `show` | 許可 |
| `git add` / `commit` / `push` / `switch`、`gh pr` | 確認付き（まーちゅうに頼まれたときだけガネーシャが行う） |
| `git checkout` / `merge` / `rebase` / `reset`、`gh pr merge` | 禁止 |

メジェドは git に書き込まない（mejed.md の禁止事項）。マージはまーちゅうが行う。

## 使い方

**タスクは1本ずつ回す。** 2本を同じ作業ツリーで並行すると、未コミットの変更が混ざる。

1. 計画：「<タスク名> の計画を立てて」→ ガネーシャが plan.md を書く（プランモードは使わない）→ まーちゅうが承認欄にチェック
2. 実装：「<タスク名> をメジェドに実装してもらって」→ ガネーシャが `feature/<タスク名>` を切ってメジェドを呼び、レビュー→修正を回して、OK になったら報告してくる
3. PR：「コミットして PR を出して」→ ガネーシャがコミット・push・PR 作成。マージはしない
4. PR のレビュー：「PR の指摘を見て」→ ガネーシャが検証して review.md に書き、コードの指摘はメジェドに直させ、スレッドに返信して再レビューを依頼する
5. マージ：まーちゅう

## 導入方法

1. `claude/` の中身をリポジトリの `.claude/` に重ねる（既存の `settings.json` があれば、内容を見比べて置き換える。`Edit(**/*.php)` のような Edit の禁止が残るとメジェドが実装できない）
2. `repo-files/docs/team/` をリポジトリの `docs/team/` に置き、`CLAUDE.md.snippet` の中身を `CLAUDE.md` の先頭に足す
3. `common-rules.md` の「チェックコマンド」を案件に合わせて書き換える
4. 案件に合わせて `guard-code-edit.mjs` の `SECRET_PATTERNS` を足す

## 導入後に確認すること

- **取り込みが効くか**：`/memory` を開き、Ganesha.md と common-rules.md が読み込まれているか確認する
- **フックが動くか**：ガネーシャに「inc/ の PHP を1行直して」と頼み、フックで止められるか確認する。次にメジェドに同じことを頼み、通るか確認する。ガネーシャがメモリに書けることも確かめる
- **Windows での実行**：フックは `node "$CLAUDE_PROJECT_DIR/..."` で呼んでいる。Windows でどのシェルが使われるかは公式ドキュメントに書かれていないが、Windows 11 の Claude Code（VS Code 拡張）では、この書き方のまま起動し、メインは止まり・`mejed` は通り・ほかのサブエージェント（`general-purpose`）は止まることを確かめた（2026-10-04・swx-inventory-hub）。止まらないときは `/hooks` で登録を確認し、コマンドをフルパスに書き換える
- **フックの単体確認**：フックに JSON を標準入力で渡して終了コードを見る（`CLAUDE_PROJECT_DIR` に仮のリポジトリのパスを入れる）。期待値は、メインの `src/a.js` が 2、メインの `docs/tasks/x/plan.md` が 0、`agent_type: mejed` の `src/a.js` が 0、`agent_type: mejed` の `.dev.vars` が 2、ほかのサブエージェントの `src/a.js` が 2、メインのメモリ（`~/.claude/projects/<p>/memory/`）が 0、リポジトリの外が 2、JSON でない入力が 2
- **Bash 経由の書き込みは止まらない**：`echo > file` や `sed -i` のようなシェル経由の書き込みは、このフックの対象外。
  **auto モードでは確認も出ない**ので、仕組みの上ではガネーシャも Bash でコードを書き換えられる。ここは Ganesha.md の禁止事項で縛っている。気づいたら止める
- **サブエージェントの権限モード**：メインが `acceptEdits` や `auto` で動いているときは、メジェドもそのモードで動く。フックは権限モードとは別の仕組みだけど、念のため `acceptEdits` でもガネーシャの編集が止まるか試す
- **秘密情報**：フックの `SECRET_PATTERNS` と settings.json の `Read(...)` の deny を、案件に応じて追加・削除する
