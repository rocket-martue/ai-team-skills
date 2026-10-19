# AIチーム開発 スキル一式

Claude Code のメイン（ガネーシャ）が、メジェド・健さん・藤さん・純ちゃんを呼べるようにするプラグイン `ai-team` と、各リポジトリに置く設定。作業の流れ（手順・回数・分かれ目）は決めない。誰をいつ呼ぶかは、ガネーシャがチーム共通の決まり（`plugins/ai-team/docs/team-rules.md`）の目安でその都度選び、迷ったらまーちゅうに聞く。

| 名前 | 役 | 呼び方 |
| --- | --- | --- |
| ガネーシャ | 計画・実装（直接直すかメジェドに頼むかを選ぶ）・レビュー役を選んで呼ぶ・頼まれたらコミットと PR | Claude Code のメイン |
| メジェド | 頼まれた範囲の実装 | Agent ツールで `ai-team:mejed`（既定は Haiku。大きい実装は `model: sonnet` を付ける） |
| 藤さん | 壊す側から読んで、指摘だけ返す | Agent ツールで `ai-team:adversary`（Fable） |
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
| `docs/team-rules.md` | チーム共通の決まり（言語・作業の進め方・チームの表・選び方の目安）。ガネーシャにはセッションの始めに SessionStart フックで入る。メジェドと藤さんは最初に Read で読む |
| `agents/mejed.md`・`agents/adversary.md` | メジェドと藤さんの定義 |
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
| `claude/ai-team.json` | `.claude/ai-team.json`。秘密情報のパターンの追加（`secretPatterns`。グロブ。既定の4つ `.env*`・`.dev.vars`・`.kv/`・`wp-config.php` は外せない）と、呼び名の対応（`names`。下の「呼び名を変える」）。ガードとラッパーと SessionStart のフックが読む。壊れていると、ガードは設定ファイルのほかの編集を全部止め、ラッパーは健さんを呼ばない。知らないキーは読み捨てる。ただし、知っているキーの打ち間違いに見えるキー（記号を除いて小文字にそろえたら同じ、か、2文字以内の違い。例：`secretPattern`・`secret_patterns`・`Names`）は、秘密情報の守りが黙って消えないよう、壊れている扱い |
| `codex/AGENTS.md` | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲 |
| `gitignore.snippet` | `.gitignore` に足す行 |

ガードが見るのは Edit / Write などの編集ツールだけで、Bash・PowerShell 経由の書き込み・読み取りは止まらない（柵であって壁ではない。team-rules.md で「回り込まない」と縛っている）。

## 使い方

ガネーシャにふつうに頼む。誰を呼ぶかは、作業を始めるときにガネーシャが一言伝える。指名もできる。

- 「メジェドに実装を頼んで」→ ガネーシャが範囲（と、あれば `docs/tasks/<タスク名>/plan.md`）を渡して `ai-team:mejed` を呼ぶ。報告は短い見出し（結果・変更したファイル・チェックの結果と、あれば範囲の外）
- 「藤さんに見てもらって」→ ガネーシャが計画書のパスか比べるブランチだけを渡して `ai-team:adversary` を呼ぶ（自分の結論は渡さない）
- 「健さんに聞いて」「健さんにレビューして」→ スキル `codex` の `consult`・`review`
- 「純ちゃんに見てもらって」→ `/code-review`（枠の消費が大きい）

指摘は、ガネーシャが一次データで確かめてから採る。コミット・PR は頼まれたときだけ。マージはまーちゅう。

### 呼び名を変える

この README とプラグインの文書の名前（ガネーシャ・メジェド・健さん・藤さん・純ちゃん・まーちゅう）は既定の名前。リポジトリの `.claude/ai-team.json` の `names` に、既定の名前から呼び名への対応を書くと、そのリポジトリではその呼び名で動く（書いた名前だけ変わる）。

```json
{
	"secretPatterns": [],
	"names": { "ガネーシャ": "アヤ", "メジェド": "ハナコ", "まーちゅう": "ゆう" }
}
```

- SessionStart のフックが、ガネーシャの文脈の頭に対応を入れる。メジェド・藤さんは、作業の最初に ai-team.json を読んで読み替える。書いた後は VS Code を開き直す（セッションの始めに入るため）
- 書き間違えると（キーが違う・呼び名が空や改行入り）、設定ファイルが壊れている扱いになる。ガードは設定ファイルのほかの編集を全部止め、健さんも呼ばない（設定ファイルそのものは直せる）。SessionStart は止めずに「呼び名は既定のまま」と入れる
- 呼び名は1行の文字列（改行・制御文字なし、40文字まで）。キーは既定の名前の6つだけ。違えば設定ファイルが壊れている扱いになる
- 変わらないもの：呼び出しの名前（`ai-team:mejed`・`ai-team:adversary`・スキル `codex`・`/code-review`）、健さんへの頼みの文の頭（「ガネーシャから」など。健さんの AGENTS.md がこの頭で見分けるため）
- キャラ設定（口調・性格）は別の場所にある。ガネーシャはリポジトリの `docs/team/Ganesha.md`、健さんは各 PC の `<CODEX_HOME>/AGENTS.md`。メジェドと藤さんはプラグインの中（`plugins/ai-team/agents/`）なので、変えるならこのリポジトリをフォークして直す
- **`names` を書く前に**、そのリポジトリを使う全部の PC で、プラグインを `names` に対応した版にし（「導入済みのリポジトリへの反映」）、開いているセッションを開き直す。対応する前の版は `names` を知らないキーとして「壊れている」と扱い、ガードが全部の編集を止める
- それでも古い版で止まったとき（止める文に「使えるのは secretPatterns・plannerWritable だけ」とある）は、`names` を消さずに、その PC でプラグインを上げて（「導入済みのリポジトリへの反映」の手で打つコマンド）、VS Code を開き直す

## 導入

`claude` が PATH に無ければ、VS Code の拡張の `claude.exe`（`<ホーム>/.vscode/extensions/anthropic.claude-code-<版>-<OS>/resources/native-binary/claude.exe`）で打つ。理由や注意は、最後の「つまずきやすいところ」にまとめてある。

### PC ごとに1回

1. マーケットプレイスを入れる

   ```
   claude plugin marketplace add rocket-martue/ai-team-skills
   ```

2. 自動更新をオンにする。セッションで `/plugin` → Marketplaces → ai-team-skills → 「Enable auto-update」。または、`<ホーム>/.claude/settings.json` の `extraKnownMarketplaces` の `ai-team-skills` に `"autoUpdate": true` を書く
3. 健さんを使うなら：Codex CLI を入れてログインし（`npm install -g @openai/codex`・`codex login`）、このリポジトリの `repo-files/codex/AGENTS.md` を `<CODEX_HOME>/AGENTS.md`（既定は `<ホーム>/.codex/AGENTS.md`）に置く

### リポジトリごと

1. ファイルを置く（写す元はこのリポジトリの `repo-files/`）

   | 写す元 | 写す先（入れるリポジトリ） |
   | --- | --- |
   | `claude/settings.json` | `.claude/settings.json`（既にあれば、そのリポジトリの allow・deny を残して合わせる） |
   | `claude/ai-team.json` | `.claude/ai-team.json`（既にあれば、足した `secretPatterns` を残す） |
   | `docs/team/Ganesha.md`・`docs/team/common-rules.md` | `docs/team/` |
   | `CLAUDE.md.snippet` の中身 | `CLAUDE.md` の先頭に足す |
   | `gitignore.snippet` の中身 | `.gitignore` に足す |

2. 案件に合わせる：`docs/team/common-rules.md` のチェックコマンド、`.claude/settings.json` の allow（チェックコマンドの分）、`.claude/ai-team.json` の `secretPatterns`（足したら settings.json の `Read(...)` の deny もそろえる）
3. プラグインを入れる。**1 で settings.json を置いた後に**、リポジトリの根で打つ

   ```
   claude plugin install ai-team@ai-team-skills --scope project
   ```

4. リポジトリを信頼する。PowerShell で1つずつ打ち、「Yes, I trust this folder」を選んで `/exit` で終える（ダイアログに並ぶ決まりに、知らないものが無いかも見る）

   ```
   cd C:\GitHub\<repo>; claude
   cmd /c "cd /d c:\GitHub\<repo> && claude"
   ```

5. VS Code を閉じて開き直す

### 入ったかを確かめる

VS Code の新しいセッションを Manual モードで開いて、ガネーシャに1つずつ頼む。

1. 「チーム共通の決まりの場所は？」と聞く。`<ホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/docs/team-rules.md` のような答えが返れば、プラグインが入っている。`<版>` はコミットの先頭12文字のフォルダ名で、次の 2 で使う
2. allow が効くかを確かめる。次の2つを、それぞれ単独で頼む（`<版>` は 1 の答えのもの）。どちらも確認のダイアログが出なければ効いている

   ```
   Bash ツールで git fetch origin だけを単独で打って
   ```

   ```
   Bash ツールで、次のコマンドを書いてある形のまま単独で打って：
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<ホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/skills/codex/scripts/invoke-codex.ps1" -Mode check
   ```

   2つ目は健さんを呼ばず、`CHECK: ok（…）` を返すだけ（Codex の枠を使わない）。ダイアログを見逃しても、セッションの記録（`<ホーム>/.claude/projects/<プロジェクト>/<セッション>.jsonl`）の、そのツールの結果の `permissionDecision` が `"source":"config"` なら allow に当たっている

### つまずきやすいところ

- **install は settings.json を置いた後に打つ。** install が `.claude/settings.json` に `enabledPlugins` を書くので、先に打つと、settings.json を写したときに消える
- **`--scope project` を付ける。** 付けないと user のスコープに入り、その PC の全部のリポジトリでガードが動く
- **信頼は `C:` と `c:` の両方で。** 信頼していないリポジトリでは、settings.json の allow が丸ごと無視される。信頼の印はドライブ名の大文字・小文字で別に持ち、VS Code は小文字の `c:` で動くことがある
- **allow の確かめは Bash ツールで、パスまで書いて頼む。** この2つの allow は Bash の形にしか無いので、PowerShell ツールで打つと当たらずに確認が出る。パスを書かずに「`-Mode check` を打って」とだけ頼むと、ガネーシャが `-Mode check` だけを打とうとする
- **確認が出ても「常に許可」は選ばない。** `.claude/settings.local.json` に決まりが書かれ、settings.json の allow が効いていないことが隠れる。出たら、4 の信頼を見直す
- **写すときは、このリポジトリの作業ツリーからそのまま写してよい。** `.gitattributes` で LF にそろえてある

### 導入済みのリポジトリへの反映

- **プラグインの中身は自動で届く。** 自動更新をオンにしてあれば（「導入」の「PC ごとに1回」の2）、そのリポジトリのセッションで最初のメッセージを送ってから最大10分で、マーケットプレイスと `--scope project` のプラグインが新しい版になる。効くのは、次に VS Code を開き直したときか `/reload-plugins` の後。そのリポジトリでセッションを使わない間は、古い版のまま
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
- plugin.json に `version` を書かないのは、コミットの SHA を版にして、マージのたびに自動で届くようにするため。書くと、版を上げない限り、自動更新でも `claude plugin update` でも更新が届かなくなる
- `claude -p --settings <ファイル>` で試すときは、`enabledPlugins` を含む設定を渡さない（そのプラグインが user スコープに自動で入る）

## ライセンス

MIT No Attribution（MIT-0）。`LICENSE` を参照。
