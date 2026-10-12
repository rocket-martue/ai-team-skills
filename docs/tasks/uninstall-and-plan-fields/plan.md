# 計画書：uninstall-and-plan-fields

- 作成：ガネーシャ（2026-10-12）
- 承認：[x] まーちゅう（承認日：2026-10-12。承認の言葉：「承認」）
<!-- 承認欄の埋め方は作業の流れ（プラグイン ai-team の docs/workflow.md）の「承認欄」 -->
- ブランチ：`fix/52-uninstall-plan-fields`（リポジトリの外の worktree で作業。このリポジトリは `.claude/worktrees/` を無視していないため）
- イシュー：#52。PR には `Closes #52`
- メジェドのモデル：haiku（README・雛形・スキルの文の追記で、中身はこの計画に書き切れるため）
- レビューの道：承認前は Fable・健さん ／ PR の前は 健さん
- 改訂履歴：
  - 2026-10-12 初版
  - 2026-10-12 Fable の指摘で改訂。冒頭の「ブランチ」から絶対パスを外した。外し方に、シェルのコマンドで外すこと（画面の「Disable for me」では残る）と、uninstall が消した `enabledPlugins` の行をコミットに入れることを足した。雛形の「worktree」は、外なら「リポジトリの外」とだけ書く。「イシュー」は複数・Closes と Refs の混在・別リポジトリを並べられる形にした。delegate-to-mejed で欄が無い plan.md の扱いを決めた。完了条件のチェックコマンドを README の5本にした
  - 2026-10-12 健さん consult 1回目の指摘で改訂。外し方を、プラグインが動いているうちに片付けの PR をマージしてから uninstall する順にし、片付けの PR は gh-* と ai-team の流れを使わずに作ることにした。`enabledPlugins` の行は手で消してコミットする。`CLAUDE.md` の取り込みと Ganesha.md は必ず消す。PR 本文に写すのは「イシュー」の値だけにし、形が違う古い plan.md の扱いを足した
  - 2026-10-12 健さん consult 2回目の指摘で改訂。片付けのブランチは worktree に切り、メインの追いつきは既定のブランチを確かめて `git pull --ff-only origin <既定ブランチ>` にした。古いガードの `hooks` の登録も消す。シェルで外す理由を「Disable for me」に限った

## 目的

プラグイン ai-team を外したリポジトリが、gh-* の目印（`.claude/ai-team.json` など）に当たり続けないよう、README の「外し方」にリポジトリ側のファイルの片付けを足す。あわせて、gh-* が後の段で読む「Closes か Refs か」と「worktree のパス」を、plan.md の冒頭に書く欄を作る（#52）。

## 背景・前提

- rocket-martue/gh-skills#7（PR rocket-martue/gh-skills#8、マージ済み）で、gh-* は、メインのチェックアウトが次のどれかに当たるリポジトリを「ai-team のリポジトリ」として、gh-pr・gh-review を使わず ai-team のスキルに回すようになった（gh-skills の `gh-flow/SKILL.md` の冒頭）
  - `.claude/ai-team.json` がある
  - `.claude/settings.json` の `enabledPlugins` で `ai-team@ai-team-skills` が `true`
  - `.claude/skills/delegate-to-mejed/` がある（プラグインに切り替える前）
  - 当たるのに ai-team のスキルを呼べないときは、gh-pr・gh-review で代わりに進めず、本人に伝えて止まる
- 今の README の「外し方」（`README.md:212-216`）は、`claude plugin uninstall ai-team@ai-team-skills --scope project` と、マーケットプレイス・キャッシュの片付けだけ。uninstall は `enabledPlugins` を外すが、導入の手順2（`README.md:197-201`）で置いた `.claude/ai-team.json`・`docs/team/`・`CLAUDE.md` の取り込み・`.gitignore` の行・settings.json の permissions は残る。`.claude/ai-team.json` が残ると、外した後も gh-* の目印に当たり、スキルが呼べないので止まり続ける（gh-skills#7 の adversary の指摘1）
- gh-* は、ふつうのリポジトリでは gh-issue の作業計画の項目6（Closes か Refs か）と worktree のパスを、後の段で読む（gh-skills の `gh-flow/references/project-status.md` の PR の段「作業計画の 6 で決めた Closes と Refs のイシュー」、`gh-wrapup/SKILL.md` の「作業計画に書いた worktree のパス」）。ai-team のリポジトリでは作業計画が plan.md になる（gh-issue の手順4の例外）が、plan.md の雛形（`plugins/ai-team/skills/plan-writer/templates/plan.md:1-11`）の冒頭の箇条には、イシュー・Closes／Refs・worktree の欄が無い（gh-skills#7 の adversary の指摘5）
- workflow.md の言葉の決まり「本文」（`plugins/ai-team/docs/workflow.md:107`）は、plan.md の冒頭の箇条に「イシュー」を挙げているが、雛形に無い
- delegate-to-mejed の手順8（`plugins/ai-team/skills/delegate-to-mejed/SKILL.md:43-50`）は、PR 本文に plan.md と review.md へのリンクを貼るとだけ書いていて、Closes／Refs をどこから取るかを書いていない（今までは、ガネーシャが計画の冒頭やイシューを見て書いていた。#34 の 1b の plan.md には「イシュー：#34。PR には `Refs #34`」と手で書いた）

## 対象ファイル

| パス | 種別（新規／変更／削除） | 変更の概要 |
| --- | --- | --- |
| `README.md` | 変更 | 「外し方」に、リポジトリ側のファイルの片付けを足す |
| `plugins/ai-team/skills/plan-writer/templates/plan.md` | 変更 | 冒頭の箇条に「イシュー」と「worktree」を足す |
| `plugins/ai-team/skills/plan-writer/SKILL.md` | 変更 | 書き方の基準に、2つの欄の埋め方を足す |
| `plugins/ai-team/skills/delegate-to-mejed/SKILL.md` | 変更 | 手順8で、PR 本文の頭に plan.md の「イシュー」の Closes／Refs を書く |
| `plugins/ai-team/docs/workflow.md` | 変更 | 言葉の決まり「本文」の冒頭の箇条に「worktree」を足す |

## 変更内容

### `README.md` の「外し方」

今の2段落を、次の順の手順にする。**プラグインが動いているうちに、リポジトリ側を先に片付けてマージし、最後に手元のプラグインを外す**（先に外すと、メインのチェックアウトに `.claude/ai-team.json` などの目印が残ったまま ai-team のスキルが呼べなくなり、gh-* が止まるため。目印を見るのはメインのチェックアウト）。

1. 片付けのブランチを worktree に切り（メインのチェックアウトは切り替えない。gh-skills の worktree.md の置き場所）、リポジトリ側のファイルを片付けて PR にする。この PR は、gh-* の gh-pr・gh-review も ai-team の流れ（計画・メジェド）も使わずに作る（gh-* は目印に当たって gh-pr を使わず、ai-team の流れは外す対象のため）。まーちゅうが手で作るか、ガネーシャに「git と gh を直接打って」と頼む（gh-* の安全装置の `--repo`・`--head` を付け、マージはしない）
   - `.claude/settings.json` の `enabledPlugins` から `ai-team@ai-team-skills` の行を消す（**必ず**。手で消してコミットする。コミットしないと、ほかの PC やクローンで gh-* の目印に当たり続ける）
   - `.claude/ai-team.json` を消す（**必ず**。導入の手順2で置いたもの。残すと gh-* の目印に当たり続ける。目印は gh-skills の gh-flow の冒頭）
   - プラグインに切り替える前の写し（`.claude/skills/`・`.claude/agents/`・`.claude/hooks/` の ai-team のもの）が残っていれば消す（**必ず**。`.claude/skills/delegate-to-mejed/` も gh-* の目印のため）。`.claude/settings.json` の `hooks` に古いガード（`${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-code-edit.mjs`）の登録が残っていれば、それも消す（ファイルだけ消すと、無いガードを呼び続けるため）
   - `CLAUDE.md` の先頭の取り込み（`CLAUDE.md.snippet` で足した行）と `docs/team/Ganesha.md` を消す（**必ず**。Ganesha.md は、計画・実装・PR・レビューを ai-team のスキルで行うよう指示し続けるため）
   - `docs/team/common-rules.md` と `docs/tasks/` の記録は、残してもよい（取り込まなければ効かない）
   - `.claude/settings.json` の permissions は、導入のときに置き換えた分を見直す（ai-team の allow・ask・deny を、そのリポジトリに要るものだけにする）
   - `.gitignore` に足した行（`gitignore.snippet`）は、残しても害は無い
2. PR をマージしたら、メインのチェックアウトを origin に追いつかせる。`git status --short --branch` で既定のブランチにいて未コミットの変更が無いことを確かめ、`git pull --ff-only origin <既定ブランチ>` を打ち、もう一度 `git status --short --branch` で ahead・behind が無いことを確かめる（違えば止まる）
3. メインのチェックアウトの根で `claude plugin uninstall ai-team@ai-team-skills --scope project`（今の1段落目の中身。入れたときと同じスコープ）。シェルのコマンドで外す（`/plugin` や VS Code の画面で「Disable for me」を選ぶと、`.claude/settings.local.json` に `false` を書くだけで、入れた記録が残るため）。`enabledPlugins` の行は手順1で消してあるので、uninstall の後に `git status` で `.claude/settings.json` に差分が出ていないかを見る（出ていたら中身を見て、要るならコミットする）。`claude plugin list` で、このリポジトリに ai-team が無いことを確かめる
4. VS Code を閉じて開き直す
5. その PC のどのリポジトリでも使わなくなったときだけ、マーケットプレイスとキャッシュを片付ける（今の2段落目の中身のまま）

### `plugins/ai-team/skills/plan-writer/templates/plan.md`

冒頭の箇条の「ブランチ」の次に、次の2行を足す（コメントの書き方は、今の「メジェドのモデル」「レビューの道」の行と同じ形）。

- `- イシュー：`Closes #<番号>`` と、コメント「PR 本文の頭に書く値（バッククォートは付けない）。イシューごとに `Closes #<番号>` か `Refs #<番号>（この PR ではクローズしない。理由）` を `・` でつないで並べる（マージの後に確認が残るなら Refs。別のリポジトリのイシューは `owner/repo#<番号>`）。イシューが無いときは「なし」。gh-* のボードの Status が読む」
- `- worktree：`<パス>`` と、コメント「gh-issue で worktree を作ったときの置き場所。リポジトリの中なら `.claude/worktrees/<名前>`（リポジトリの根からの相対パス）。リポジトリの外なら「リポジトリの外」とだけ書く（ローカルの絶対パスを書かない。gh-wrapup は `git worktree list` でブランチ名から探す）。使わないときは「なし」。gh-wrapup の片付けが読む」

### `plugins/ai-team/skills/plan-writer/SKILL.md`

- 「書き方の基準」に1つ足す：冒頭の「イシュー」と「worktree」を必ず埋める（「イシュー」は、イシューごとに Closes か Refs かを決めて、PR 本文の頭に書く値の形（`Closes #<番号>`・`Refs #<番号>（理由）`）で並べる。マージの後に確かめることが残るなら Refs。「worktree」は、リポジトリの中ならリポジトリの根からの相対パス、外なら「リポジトリの外」。どちらも無ければ「なし」）。gh-* が、PR の後のボードの Status と、マージの後の片付けで読むため

### `plugins/ai-team/skills/delegate-to-mejed/SKILL.md`

- 手順8の箇条（`gh pr create` の行の後）に1つ足す：PR 本文の頭に、plan.md の「イシュー」の欄の値（`Closes #<番号>`・`Refs #<番号>（理由）` など。欄の名前とバッククォートは写さない）を書く（「なし」なら書かない）。欄が無い・値がこの形でない plan.md（この変更の前に書いたもの。例：「イシュー：#34。PR には `Refs #34`」）は、イシューと plan.md を読んで Closes か Refs かを決め、PR を作る前にまーちゅうに伝える

### `plugins/ai-team/docs/workflow.md`

- 言葉の決まり「本文」の、冒頭の箇条の並び（作成・承認・ブランチ・イシュー・メジェドのモデル・レビューの道・改訂履歴）に「worktree」を足す（「イシュー」の後）。冒頭の箇条は本文に入らないので、埋めても承認はやり直さない

## 方針

- 文書の直しだけ。コード・フック・ラッパー・テストは触らない
- gh-skills 側の文（gh-flow の冒頭・project-status.md・gh-wrapup）は直さない（rocket-martue/gh-skills#8 で、ai-team のリポジトリでも「作業計画の 6」「作業計画に書いた worktree のパス」と書いている。plan.md の欄がその作業計画に当たる）
- 外し方の片付けは、「必ず消すもの（gh-* の目印に当たるもの）」と「体制をやめるなら消すもの」を分けて書く

## 必須パターン（任意・3行以内）

なし

## 対象外（やらないこと）

- gh-skills の直し（gh-* の目印・作業計画の読み方は、gh-skills#8 のまま）
- 外し方を自動でするスクリプト
- 4つのリポジトリの切り替え（#34 の 3）
- Copilot のレビューの扱いの見直し（まーちゅうが解約を考えている。別のイシューにする）
- 既にある plan.md（`docs/tasks/*/plan.md`）に欄を足すこと

## 完了条件

- [ ] README の「このリポジトリで打つチェックコマンド」の5本が通る：`node plugins/ai-team/hooks/test-guard-code-edit.mjs`・`node plugins/ai-team/hooks/test-session-start.mjs`・`node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs`・`claude plugin validate .`・`claude plugin validate plugins/ai-team`（validate は終了コード 0 で、警告が `version` が無いことだけ。`claude` が PATH に無ければ VS Code の拡張の `claude.exe`）
- [ ] 外し方が、片付けの PR（gh-* と ai-team の流れを使わずに作る）→ マージとメインの追いつき → uninstall（シェルのコマンド）→ VS Code の開き直し、の順になっている。片付けの PR で必ず消すものに、`enabledPlugins` の ai-team の行・`.claude/ai-team.json`・切り替える前の写し・`CLAUDE.md` の取り込みと Ganesha.md がある。この手順のとおりにすると、コミットされた中身が gh-skills の gh-flow の冒頭の3つの目印のどれにも当たらず、Ganesha.md の指示も残らない
- [ ] plan.md の雛形の冒頭の箇条に「イシュー」と「worktree」の行が、「ブランチ」の次にこの順である
- [ ] plan-writer の「書き方の基準」に、2つの欄の埋め方と、gh-* が読むことが書いてある
- [ ] delegate-to-mejed の手順8に、PR 本文の頭に plan.md の「イシュー」の値だけを書くことと、欄が無い・形が違う plan.md のときの扱いが書いてある
- [ ] 雛形・plan-writer の「worktree」の書き方が、リポジトリの中は相対パス、外は「リポジトリの外」で、ローカルの絶対パスを書かせない
- [ ] workflow.md の言葉の決まり「本文」の冒頭の箇条の並びに「worktree」がある
- [ ] 対象ファイルの表のものと、`docs/tasks/uninstall-and-plan-fields/` のほかに差分が無い
- [ ] 差分にローカルの絶対パス・クライアント識別情報が無い

## テスト観点

- 外し方の手順どおりに片付けたリポジトリが、gh-* の目印のどれにも当たらないか（目印の3つと、外し方の箇条を突き合わせる）
- plan.md の雛形・plan-writer・delegate-to-mejed・workflow.md の4つで、冒頭の箇条の並びと名前がそろっているか

## 承認前の確認

<!-- 承認を頼む前に、承認前の1つ目と2つ目（レビューの道）を呼んだ結果。承認依頼ごと・回ごとに見出しを分けて書く。1つ目を呼ぶのは最初の承認依頼の前だけ。まーちゅうに頼まれて回した分は、その旨を書く。`/code-review` のときは、見出しを「承認依頼1・/code-review（1つ目）」「承認依頼1・/code-review 1回目」のようにし、返事の行に保存先を書く。「まとめる」「省く（反映）」のときは、1つ目の見出しを消す -->

### 承認依頼1・Fable（2026-10-12）

- 採った（plan.md を直した）：6件（必須1・推奨5）。完了条件の絶対パスの除外が、この plan.md の冒頭の行で No になる（必須）／uninstall が消した `enabledPlugins` はコミットしないとほかのクローンで残る・画面の「Disable for me」では残る／外の worktree の書き方が決まっていない（絶対パスになる）／欄が無い plan.md の扱い／「イシュー」が1つの番号と二者択一に閉じている／チェックコマンドが README の5本のうち3本。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん 1回目（2026-10-12）

- 返事：`docs/tasks/uninstall-and-plan-fields/codex/01-consult.md`
- 採った（plan.md を直した。必須として書く）：3件（必須2・推奨1）。片付けの PR がマージされる前に外すと、メインに目印が残って gh-* が止まる／「体制をやめるなら」では CLAUDE.md の取り込みと Ganesha.md が ai-team のスキルを指示し続ける／「行をそのまま書く」だと欄名まで写す・形が違う古い欄がある。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん 2回目（2026-10-12）

- 返事：`docs/tasks/uninstall-and-plan-fields/codex/02-consult.md`
- 採った（plan.md を直した。必須として書く）：3件（必須1・推奨2）。メインに片付けのブランチを切ると、引数なしの pull で既定のブランチが更新されない／古いガードの `hooks` の登録が残る／`/plugin` 全体が `false` を書くだけと読める。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん 3回目（2026-10-12）

- 返事：`docs/tasks/uninstall-and-plan-fields/codex/03-consult.md`
- 指摘なし

## 確認事項

<!-- 推測で埋めなかった不明点。まーちゅうに確認してから実装へ。不明点が無ければ「なし」のままにする。まーちゅうの答えは項目の後ろに「→」で書き足す（例: → OK（YYYY-MM-DD まーちゅう）） -->

- なし
