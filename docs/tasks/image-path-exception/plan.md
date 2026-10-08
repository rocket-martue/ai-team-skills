# 計画書：image-path-exception

- 作成：ガネーシャ（2026-10-08）
- 承認：[x] まーちゅう（承認日：2026-10-08。承認の言葉：「OK」。PR は `Refs #21` にして、マージの後に確かめてから閉じる、も OK）
<!-- 承認欄の埋め方は docs/team/workflow.md の「承認欄」 -->
- ブランチ：`fix/21-image-path-exception`（リポジトリの外の worktree で作業）
- イシュー：#21。PR には `Refs #21` と書く（実際に `image` を呼んで確かめるのは、マージの後に各 PC の AGENTS.md を写してからのため）
- 改訂履歴：
  - 2026-10-08 初版

## 目的

健さんの AGENTS.md の「絶対パスを書かない」と、`image` の答えの最後の行 `IMAGE_PATH: <絶対パス>` がぶつからないようにする。AGENTS.md に `IMAGE_PATH:` の行だけの例外を書き、頼む人が頼みの文で毎回例外を書き足さなくてよい形にする。

## 背景・前提

- 健さんの AGENTS.md の見本は `repo-files/codex/AGENTS.md`。相対パスの決まりは2か所にある
  - 34行目：「ガネーシャ・メジェドから頼まれたとき」。`C:\...` や `/C:/...` のような絶対パスやファイルへのリンクは書かない
  - 49行目：「レビュー（`codex exec review`）で呼ばれたとき」。同じく絶対パスを書かない
- `image` の頼みの文は「ガネーシャから」「メジェドから」で始まる（`claude/skills/codex/SKILL.md:49`）。だから、`image` に当たるのは34行目の決まりだけ。49行目の review には `image` の頼みの文が渡らない（review は頼みの文を受け付けない。`claude/skills/codex/SKILL.md:66`）ので、例外は要らない
- `image` では、頼みの文に「答えの最後の行に `IMAGE_PATH: <保存した画像の絶対パス>` とだけ書く」と入れる決まり（`claude/skills/codex/SKILL.md:63`）。理由は、作業の根が一時ディレクトリで、相対パスだと解釈の根がずれるため
- ラッパーは答えの `IMAGE_PATH:` の行だけを読む（`claude/skills/codex/scripts/invoke-codex.ps1:281-300`）。パスが無い・ファイルが見つからない・生成画像の保存先（`<CODEX_HOME>/generated_images/`）の下に無い・参照画像と同じ、のどれかなら終了コード 2 で止まる。`Test-Path -LiteralPath` で確かめるので、相対パスだと PowerShell のカレント（ラッパーの作業の根）から解釈されて、見つからずに止まる
- 実例：rocket-martue/ganesha-mejed-channel#83 では、頼みの文に「`IMAGE_PATH:` の行だけは絶対パスで書く（AGENTS.md の例外）」と書き足して回し、絶対パスで返ってきた。書き足さずに回した記録は無い
- SKILL.md の63行目は、もともと例外の一言を頼みの文に入れろとは書いていない。#83 で書き足したのは、頼む人がその場で判断したもの
- 各 PC の `<CODEX_HOME>/AGENTS.md` は、リポジトリからは配られない。README の導入方法の5に「`repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md` に置く。既にあれば中身を見比べて合わせる」とある（`README.md:141`）。そろえる手順はこれで足りるので、README は変えない
- 健さんの返事（`IMAGE_PATH:` の絶対パスを含む）は `docs/tasks/<タスク名>/codex/` に保存され、`.gitignore` で Git に入らない（`repo-files/gitignore.snippet`）。PR に貼るのは PR の前の確認（review）の返事だけ（`claude/skills/delegate-to-mejed/SKILL.md:46`）なので、`image` の絶対パスが PR やコミットに残る経路は無い
- このリポジトリのチェックコマンド（このタスクに限る）：`node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs`（どちらも変えないことの確かめ）

## 対象ファイル

| パス | 種別 | 変更の概要 |
| --- | --- | --- |
| `repo-files/codex/AGENTS.md` | 変更 | 「ガネーシャ・メジェドから頼まれたとき」の相対パスの箇条（34行目）に、`IMAGE_PATH:` の行だけの例外を足す |
| `claude/skills/codex/SKILL.md` | 変更 | 「頼みの文に必ず入れること」の `image` の `IMAGE_PATH:` の箇条（63行目）に、AGENTS.md に例外があるので頼みの文に例外を書き足さなくてよい、と一言添える |
| `docs/tasks/image-path-exception/review.md` | 新規 | ガネーシャが書く記録 |

## 変更内容

### 書く中身（言い回しはメジェドに任せる。意味はこのとおり）

- AGENTS.md の34行目の箇条に、次の例外を足す
  - 例外は1つだけ：`image` の頼みの文で、答えの最後の行に `IMAGE_PATH:` の行を書くよう求められたとき、**その行だけ**は、保存した画像の絶対パスで書く
  - 理由も短く書く：ラッパーがこの行のパスを読んで画像を探すため。作業の根は一時ディレクトリで、画像は生成画像の保存先にあるので、相対パスでは指せない
  - それ以外（答えの本文・根拠のファイル:行）は、今までどおり相対パスで書く
- AGENTS.md の49行目（レビューで呼ばれたとき）は変えない
- SKILL.md の63行目の箇条に、「健さんの AGENTS.md に、この行だけ絶対パスで書く例外があるので、頼みの文に例外を書き足さなくてよい」と添える。頼みの文に `IMAGE_PATH:` の行を求めること自体は残す（ラッパーが読むため）

### データの流れ

- メジェド → 頼みの文（`IMAGE_PATH:` の行を求める。例外の一言は無し）→ ラッパー → 健さん → AGENTS.md の例外に従い、最後の行に絶対パスで `IMAGE_PATH:` を書く → ラッパーがその行を読み、`IMAGE:` を出す

## 使う WordPress API と方針

- なし（文書だけ）

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- ラッパー（`invoke-codex.ps1`）の変更（相対パスを受け付けるようにする、など）
- AGENTS.md の49行目（レビュー）の変更
- README の変更（各 PC の AGENTS.md をそろえる手順は、導入方法の5にもうある）
- 各 PC の `<CODEX_HOME>/AGENTS.md` の更新（リポジトリの外。マージの後、まーちゅうの許可を得て、ガネーシャが写す）
- 実際に `image` を呼んで確かめること（マージの後に、各 PC の AGENTS.md を写してから。下の「テスト観点」）
- 各リポジトリへの反映（このタスクで変えるのはテンプレートだけ）

## 完了条件

- [ ] AGENTS.md の「ガネーシャ・メジェドから頼まれたとき」の相対パスの箇条に、`image` の `IMAGE_PATH:` の行だけは絶対パスで書く、という例外と、その理由がある
- [ ] その例外は `IMAGE_PATH:` の行だけに限っていて、それ以外は相対パスで書く、と読める
- [ ] AGENTS.md の「レビューで呼ばれたとき」の箇条（49行目）は変わっていない
- [ ] SKILL.md の `image` の `IMAGE_PATH:` の箇条に、AGENTS.md に例外があるので頼みの文に例外を書き足さなくてよい、とある。`IMAGE_PATH:` の行を求めること自体は残っている
- [ ] `node claude/hooks/test-guard-code-edit.mjs` と `node claude/skills/codex/scripts/test-invoke-codex.mjs` が通る
- [ ] 差分（plan.md・review.md を含む）に、ローカルの絶対パス・契約しているプラン名・手元の PC の状態の記述が無い

## テスト観点

- 文書だけの変更なので、マージの前は差分を読んで確かめる
- マージの後（イシューの完了条件の2つ目）：まーちゅうの許可を得て、この版の AGENTS.md を `<CODEX_HOME>/AGENTS.md` に写す。次に画像のタスクで `image` を呼ぶとき、頼みの文に例外を書き足さずに呼んで、絶対パスの `IMAGE_PATH:` が返り、ラッパーが `IMAGE:` を出すかを見る。結果を #21 にコメントで残し、それから閉じる

## 承認前の確認

### 承認依頼1・Fable

- 呼んでいない（小さい変更なので、まーちゅうの判断で飛ばした。2026-10-08）

### 承認依頼1・健さん1回目（2026-10-08）

- 採った：なし（指摘なし。例外がラッパーの `IMAGE_PATH:` の読み取りと合うこと、反映先のラッパーも同じことを確かめた）
- 確認事項に移した：なし
- 見送った（理由）：なし
- 健さんは、通信の制限で #21 と rocket-martue/ganesha-mejed-channel#83 を読めなかった。#21 の本文はガネーシャが gh で読んで、この計画と照らした。#83 の事実は、#3・#21 に書かれたものから取った
- 採る指摘が無い回なので、承認依頼1の健さんはここで止める（数：Fable 0回・健さん1回）
- 返事：`docs/tasks/image-path-exception/codex/01-consult.md`

## 確認事項

- なし
