# AIチーム開発 スキル一式

Claude Code のメイン（ガネーシャ）が、メジェド・健さん・Fさん・純ちゃんを呼べるようにするプラグイン `ai-team` と、各リポジトリに置く設定。作業の流れ（手順・回数・分かれ目）は決めない。誰をいつ呼ぶかは、ガネーシャがチーム共通の決まり（`plugins/ai-team/docs/team-rules.md`）の目安でその都度選び、迷ったらまーちゅうに聞く。

| 名前 | 役 | 呼び方 |
| --- | --- | --- |
| ガネーシャ | 計画・実装（直接直すかメジェドに頼むかを選ぶ）・レビュー役を選んで呼ぶ・頼まれたらコミットと PR | Claude Code のメイン |
| メジェド | 頼まれた範囲の実装 | Agent ツールで `ai-team:mejed`（既定は Haiku。大きい実装は `model: sonnet` を付ける） |
| Fさん | 壊す側から読んで、指摘だけ返す | Agent ツールで `ai-team:adversary`（Fable） |
| 健さん | 読むだけの相談・レビュー、画像の生成（外部委託業者。Codex CLI） | スキル `codex` |
| 純ちゃん | 差分を読んで指摘を返す | スキル `code-review`（`/code-review`。`--fix` は付けない） |
| まーちゅう | 要件と最終判断・マージ | 人 |

## 前提

- 日本語で進める WordPress（PHP、phpcs）の案件向け。ほかの技術スタックでは、リポジトリの `docs/team/common-rules.md` と `.claude/settings.json` の allow を書き換える
- フックに Node.js が要る（node が PATH に無いと、フックは何も言わずに外れる）
- 健さんは使わなくても回る。使うときのラッパーは Windows PowerShell 用で、各 PC に Codex CLI と健さんの AGENTS.md が要る

## 中身

### プラグイン（`plugins/ai-team/`）

| ファイル | 中身 |
| --- | --- |
| `docs/team-rules.md` | チーム共通の決まり（言語・作業の進め方・チームの表・選び方の目安）。ガネーシャにはセッションの始めに SessionStart フックで入る。メジェドと Fさんは最初に Read で読む |
| `agents/mejed.md`・`agents/adversary.md` | メジェドと Fさんの定義 |
| `skills/codex/` | 健さんの呼び方と、ラッパー `scripts/invoke-codex.ps1`（read-only・秘密情報の照らし合わせ・返事は標準出力に出すだけ） |
| `hooks/guard-code-edit.mjs` | 編集のガード。秘密情報のファイルと、リポジトリの外（メモリ・計画ファイル・scratchpad を除く）の編集だけを止める。誰が編集するかは見ない |
| `hooks/session-start.mjs` | team-rules.md をセッションの始めに入れる |
| `hooks/ai-team-config.mjs` | ガードとラッパーが使う判定の部品（秘密情報の既定の一覧・`.claude/ai-team.json` の読み込み） |
| `hooks/test-*.mjs`・`skills/codex/scripts/test-invoke-codex.mjs` | 確かめのスクリプト（依存なし） |

### リポジトリ側（`repo-files/` の中身を写す）

| ファイル | 置き場所 |
| --- | --- |
| `docs/team/Ganesha.md`・`docs/team/common-rules.md` | リポジトリの `docs/team/`。common-rules.md はリポジトリ固有の決まり（コーディング・チェックコマンド） |
| `CLAUDE.md.snippet` | 中身を `CLAUDE.md` の先頭に足す |
| `claude/settings.json` | `.claude/settings.json`。読むだけの git・gh と健さんのラッパーの allow、秘密情報の Read と `git checkout`・`merge`・`rebase`・`reset`・`gh pr merge` の deny（Bash と PowerShell の両方） |
| `claude/ai-team.json` | `.claude/ai-team.json`。秘密情報のパターンの追加（`secretPatterns`。グロブ。既定の4つ `.env*`・`.dev.vars`・`.kv/`・`wp-config.php` は外せない）。ガードとラッパーが読む。壊れていると、ガードは設定ファイルのほかの編集を全部止め、ラッパーは健さんを呼ばない |
| `codex/AGENTS.md` | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲 |
| `gitignore.snippet` | `.gitignore` に足す行 |

ガードが見るのは Edit / Write などの編集ツールだけで、Bash・PowerShell 経由の書き込み・読み取りは止まらない（柵であって壁ではない。team-rules.md で「回り込まない」と縛っている）。

## 使い方

ガネーシャにふつうに頼む。誰を呼ぶかは、作業を始めるときにガネーシャが一言伝える。指名もできる。

- 「メジェドに実装を頼んで」→ ガネーシャが範囲（と、あれば `docs/tasks/<タスク名>/plan.md`）を渡して `ai-team:mejed` を呼ぶ。報告は短い見出し（結果・変更したファイル・チェックの結果と、あれば範囲の外）
- 「Fさんに見てもらって」→ ガネーシャが計画書のパスか比べるブランチだけを渡して `ai-team:adversary` を呼ぶ（自分の結論は渡さない）
- 「健さんに聞いて」「健さんにレビューして」→ スキル `codex` の `consult`・`review`
- 「純ちゃんに見てもらって」→ `/code-review`（枠の消費が大きい）

指摘は、ガネーシャが一次データで確かめてから採る。コミット・PR は頼まれたときだけ。マージはまーちゅう。

## 導入

`claude` が PATH に無ければ、VS Code の拡張の `claude.exe`（`<ホーム>/.vscode/extensions/anthropic.claude-code-<版>-<OS>/resources/native-binary/claude.exe`）で打つ。

1. マーケットプレイスを入れる（PC ごとに1回）：`claude plugin marketplace add rocket-martue/ai-team-skills`。続けて自動更新をオンにする（自前のマーケットプレイスは既定でオフ）。セッションで `/plugin` → Marketplaces → ai-team-skills → 「Enable auto-update」か、`<ホーム>/.claude/settings.json` の `extraKnownMarketplaces` の `ai-team-skills` に `"autoUpdate": true`
2. リポジトリに `repo-files/` の中身を置く（上の表。既存の `.claude/settings.json`・`.claude/ai-team.json` があれば、リポジトリ固有の分を残して合わせる）
3. **settings.json を置いた後に**、リポジトリの根で `claude plugin install ai-team@ai-team-skills --scope project`（install が `enabledPlugins` を書くので、先に打つと写したときに消える。`--scope` を付けずに入れると、PC の全リポジトリでガードが動く）
4. `docs/team/common-rules.md` のチェックコマンドと、`.claude/ai-team.json` の `secretPatterns`（settings.json の `Read(...)` の deny もそろえる）を案件に合わせる
5. 健さんを使うなら、`npm install -g @openai/codex`・`codex login` と、`repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md` に置く
6. リポジトリを信頼してから（信頼していないと settings.json の allow が無視される。ドライブ名の大文字・小文字で別に持つので、`cd C:\GitHub\<repo>; claude` と `cmd /c "cd /d c:\GitHub\<repo> && claude"` の両方で信頼する）、VS Code を閉じて開き直す
7. allow が効くかを確かめる：VS Code の新しいセッションを Manual で開き、スキルを読み込ませずに、次の2つを**Bash ツールで**、1つずつ単独で、書いてある形のまま打たせる（「Bash ツールで」と頼みに書く。この2つの allow は Bash の形にしか無いので、PowerShell ツールで打つと当たらず、確認が出る）。確認が出なければ効いている（画面を見なくても、セッションの記録の jsonl の、そのツールの結果の `permissionDecision` が `"source":"config"` なら allow に当たった）。確認が出たら、6 の信頼を見直す。「常に許可」は選ばない
   - `git fetch origin`
   - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<ホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/skills/codex/scripts/invoke-codex.ps1" -Mode check`（健さんは呼ばない。`CHECK: ok` が出る）

### 導入済みのリポジトリへの反映

- **プラグインの中身は自動で届く。** 自動更新をオンにしてあれば（「導入」の1）、そのリポジトリのセッションで最初のメッセージを送ってから最大10分で、マーケットプレイスと `--scope project` のプラグインが新しい版になる。効くのは、次に VS Code を開き直したときか `/reload-plugins` の後。そのリポジトリでセッションを使わない間は、古い版のまま
- すぐ入れたいときだけ手で打つ：PC ごとに `claude plugin marketplace update ai-team-skills`、リポジトリごとに根で `claude plugin update ai-team@ai-team-skills --scope project`、そのあと VS Code を開き直す。入った版は `<ホーム>/.claude/plugins/installed_plugins.json` の ai-team の記録のうち、scope が project で projectPath がそのリポジトリのものの `gitCommitSha`
- **リポジトリ側（`repo-files/` の中身）は手で反映する。** `docs/team/Ganesha.md`・`common-rules.md` を今の版に差し替えて、固有の分（チェックコマンドなど）を戻す。写すときは、テンプレートの作業ツリー（LF）から写す。`.claude/ai-team.json` に古い `plannerWritable` が残っていても動く（読み捨てる）
- プラグインだけ先に届いて、リポジトリ側の文書が古いままの間は、ガネーシャはチーム共通の決まり（team-rules.md）に従い、まーちゅうに差し替えを伝える（team-rules.md の「作業の進め方」に書いてある）

## 外し方

1. リポジトリ側を片付けて PR にする：`.claude/settings.json` の `enabledPlugins` から `ai-team@ai-team-skills` の行を消す・`.claude/ai-team.json` を消す・`CLAUDE.md` の取り込みと `docs/team/Ganesha.md` を消す（`.claude/ai-team.json` と `enabledPlugins` は、gh-skills が ai-team のリポジトリと見分ける目印なので必ず消す）
2. マージしたら、PC ごとに、リポジトリの根で `claude plugin uninstall ai-team@ai-team-skills --scope project` を打ち、VS Code を開き直す
3. その PC のどのリポジトリでも使わなくなったら、`claude plugin marketplace remove ai-team-skills` と、キャッシュの `<ホーム>/.claude/plugins/cache/ai-team-skills/` を消す

## このリポジトリで打つチェックコマンド

触ったファイルに当たるものだけ打つ（`.md` だけの直しなら、打つものは無い）。

| 触ったもの | 打つもの |
| --- | --- |
| `repo-files/claude/settings.json`・`plugins/ai-team/hooks/guard-code-edit.mjs`・`hooks/ai-team-config.mjs`・`hooks/hooks.json` | `node plugins/ai-team/hooks/test-guard-code-edit.mjs` |
| `plugins/ai-team/hooks/session-start.mjs`・`plugins/ai-team/docs/team-rules.md`（1万文字の上限） | `node plugins/ai-team/hooks/test-session-start.mjs` |
| `plugins/ai-team/skills/codex/scripts/`・`hooks/ai-team-config.mjs` | `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` |
| `.claude-plugin/`・`plugins/ai-team/.claude-plugin/`・スキルやエージェントの追加・名前の変更 | `claude plugin validate .` と `claude plugin validate plugins/ai-team` |

- `claude plugin validate` は `--strict` を付けない（`version` を書かないので必ず失敗する）。終了コード 0 で、警告が `version` が無いことだけならよい
- `claude -p --settings <ファイル>` で試すときは、`enabledPlugins` を含む設定を渡さない（そのプラグインが user スコープに自動で入る）

## ライセンス

MIT No Attribution（MIT-0）。`LICENSE` を参照。
