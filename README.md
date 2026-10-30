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

最低要件（これより古い版は扱わない）：

| もの | 版 | 理由 |
| --- | --- | --- |
| Node.js | 22 以降 | フックとラッパーを動かす（20 は 2026年4月にサポートが終わった） |
| Git | 2.36 以降 | ラッパーが `git worktree list --porcelain -z` で worktree を読む（#106 から） |
| Claude Code | 2.1.295 以降 | 編集のガードの `onFailure: "block"` が効く |

- 日本語で進める WordPress（PHP、phpcs）の案件向け。ほかの技術スタックでは、リポジトリの `docs/team/common-rules.md` と `.claude/settings.json` の allow を書き換える
- Claude Code（VS Code の拡張か CLI）で使う。Cursor でも、Claude Code の拡張（か Cursor のターミナルで打つ `claude`）なら同じように動く。Cursor 自体のチャット・Agent では、モデルに Claude を選んでも動かない（プラグイン・フック・エージェントは Claude Code の仕組みのため）
- フックに Node.js が要る。編集のガードは、node が PATH に無い・途中で失敗した・時間切れのときも編集を止める（`onFailure: "block"`）
- マーケットプレイスの登録に git が要る（GitHub から clone するため）
- 入れるフォルダは git のリポジトリでなくてもよい（ガードとフックは、開いたフォルダを根として見る）。ただし、差分を使うもの（健さんのレビュー・藤さんに比べるブランチで見てもらう・純ちゃん・コミットと PR）は使えない。健さんへの相談と画像の生成は使える。そのときは「使うリポジトリごと」の 6 を飛ばす。「入ったかを確かめる」の 2 の `git fetch origin` は失敗する（`not a git repository`）が、確認のダイアログが出なければ allow は効いている
- 健さんは使わなくても回る。使うときは、各 PC に Codex CLI と健さんの AGENTS.md が要る（健さんにテストも打たせる「コンテナでのレビュー」を使うなら、Docker も）。ラッパーは Node.js で書いてあり、Windows・Mac・Linux で動く（Mac は、テストを Linux で通しただけで、実機ではまだ確かめていない）

## 導入

入れるものは2段になっている。

- **PC ごとに1回**：マーケットプレイス（このリポジトリ）を登録する。プラグインの入手元になる
- **使うリポジトリごと**：設定ファイルを写して、プラグインをそのリポジトリにだけ入れる。入れたリポジトリでだけチームが動く

終わったら「入ったかを確かめる」で確かめる。コマンドはどれも PowerShell で打つ（VS Code のターミナルでよい）。`<ホーム>` は `C:\Users\<ユーザー名>`、`<リポジトリのパス>` は入れるリポジトリのフォルダの場所（例：`C:\GitHub\my-site`）。Mac・Linux では、下の「Mac・Linux での読み替え」を見る。

### Claude Code に頼んで入れる

入れたいリポジトリを VS Code で開き、Claude Code に次のように頼むと、この README を読んで、コマンドを打つところとファイルを写すところまで進めてくれる（既にある `.claude\settings.json` などとの合わせも頼める）。途中で出る確認のダイアログは、中身を見て許可する。

```
https://github.com/rocket-martue/ai-team-skills の README の「導入」のとおりに、このリポジトリに ai-team を入れて。
「PC ごとに1回」の 1・2 と、「使うリポジトリごと」の 1〜3 まで進めて、終わったら、私がする残りの手順を教えて。
```

次は Claude Code からはできないので、自分でする。

- 「使うリポジトリごと」の 4（信頼のダイアログで選ぶ）と 5（VS Code の開き直し）
- 「入ったかを確かめる」（開き直した後の新しいセッションで聞く）
- 健さんを使うなら、「PC ごとに1回」の 3 の `codex login`（ブラウザでログインする）

### 最初に：`claude` コマンドが打てるかを見る

```
claude --version
```

版が出ればそのまま次へ。「認識されません」と出たら、VS Code（か Cursor）の拡張に入っている `claude.exe` を、その PowerShell の PATH に足す（閉じるまで有効。閉じたらまた打つ）。

```
$env:Path += ";" + (Split-Path (Get-ChildItem "$HOME\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe", "$HOME\.cursor\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1).FullName)
claude --version
```

### PC ごとに1回

1. マーケットプレイスを登録する

   ```
   claude plugin marketplace add rocket-martue/ai-team-skills
   ```

   このリポジトリが `<ホーム>\.claude\plugins\marketplaces\ai-team-skills\` に写される。次の「使うリポジトリごと」で写すファイル（`repo-files\`）もここにあるので、このリポジトリを別に clone しなくてよい

2. 自動更新をオンにする（このリポジトリにマージされた直しが、自動で届くようになる）。Claude Code のセッションで `/plugin` → Marketplaces → ai-team-skills → 「Enable auto-update」。または、`<ホーム>\.claude\settings.json` の `extraKnownMarketplaces` の `ai-team-skills` に `"autoUpdate": true` を書く
3. 健さんを使うときだけ：Codex CLI を入れてログインし（`npm install -g @openai/codex`・`codex login`）、`<ホーム>\.claude\plugins\marketplaces\ai-team-skills\repo-files\codex\AGENTS.md` を `<CODEX_HOME>\AGENTS.md`（既定は `<ホーム>\.codex\AGENTS.md`）に写す

### 使うリポジトリごと

1. ファイルを写す。写す元は `<ホーム>\.claude\plugins\marketplaces\ai-team-skills\repo-files\`

   | 写す元 | 写す先（入れるリポジトリ） |
   | --- | --- |
   | `claude\settings.json` | `.claude\settings.json`（既にあれば、そのリポジトリの allow・deny を残して合わせる） |
   | `claude\ai-team.json` | `.claude\ai-team.json`（既にあれば、足した `secretPatterns` を残す） |
   | `docs\team\Ganesha.md`・`docs\team\common-rules.md` | `docs\team\` |
   | `CLAUDE.md.snippet` の中身 | `CLAUDE.md` の先頭に、コメントの行も含めてそのまま足す（無ければ作る）。中身はコメント1行と、`@docs/team/Ganesha.md` の取り込み1行 |
   | `gitignore.snippet` の中身 | `.gitignore` に足す（`.claude/worktrees/` の1行） |

   上の4つのファイルがまだ無いリポジトリなら、次で写せる（`Copy-Item` は同じ名前のファイルを上書きするので、先に2行目で全部 `False` なのを見る。`True` のファイルがあれば、表のとおり手で合わせる）。`CLAUDE.md` と `.gitignore` は VS Code で開いて足す

   ```
   cd <リポジトリのパス>
   ".claude\settings.json", ".claude\ai-team.json", "docs\team\Ganesha.md", "docs\team\common-rules.md" | ForEach-Object { "$_ : $(Test-Path $_)" }
   $src = "$HOME\.claude\plugins\marketplaces\ai-team-skills\repo-files"
   New-Item -ItemType Directory -Force .claude, docs\team | Out-Null
   Copy-Item "$src\claude\settings.json", "$src\claude\ai-team.json" .claude\
   Copy-Item "$src\docs\team\Ganesha.md", "$src\docs\team\common-rules.md" docs\team\
   ```

2. 案件に合わせる（WordPress で `vendor/bin/phpcs` を使うなら、そのままで始められる。後で直してもよい）：`docs/team/common-rules.md` のチェックコマンド、`.claude/settings.json` の allow（チェックコマンドの分）、`.claude/ai-team.json` の `secretPatterns`（足したら settings.json の `Read(...)` の deny もそろえる）

   - phpcs がリポジトリの `vendor/` に無い（composer のグローバルに入れているなど）か、`phpcs.xml` が根に無い（自作プラグインの中だけにあるなど）ときは、テンプレートのままだと当たらない。common-rules.md のチェックコマンドを実際の打ち方（例：`phpcs --standard=<phpcs.xml のパス> <見るフォルダ>`）に、allow をそれに合う形（例：`Bash(phpcs:*)`）に書き換える
   - サーバーのフォルダをまるごと持ってきた案件では、`.ftpaccess` やログのフォルダ（`log/` など）も `secretPatterns` に足す候補。中身を見て決める

3. プラグインを入れる。リポジトリの根で打つ

   ```
   cd <リポジトリのパス>
   claude plugin install ai-team@ai-team-skills --scope project
   ```

   - **1 の後に打つ。** install が `.claude\settings.json` に `enabledPlugins` を書き足すので、先に打つと、1 で settings.json を写したときに消える
   - **`--scope project` を付ける。** 付けないと user のスコープに入り、その PC の全部のリポジトリでガードが動く

4. リポジトリを信頼する。信頼していないリポジトリでは、settings.json の allow が丸ごと無視される。次の2行を1行ずつ打ち、それぞれ「Yes, I trust this folder」を選んで `/exit` で終える（ダイアログに並ぶ決まりに、知らないものが無いかも見る）

   ```
   cd <リポジトリのパス>; claude
   cmd /c "cd /d <リポジトリのパス（ドライブ名だけ小文字）> && claude"
   ```

   例：`cd C:\GitHub\my-site; claude` と `cmd /c "cd /d c:\GitHub\my-site && claude"`。2回打つのは、信頼の印をドライブ名の大文字（`C:`）と小文字（`c:`）で別に持つため。VS Code は小文字の `c:` で動くことがある。ダイアログが出ずにそのまま起動したら、そのドライブ名ではもう信頼済みなので、`/exit` で終えて次へ進む

5. VS Code を閉じて、そのリポジトリのフォルダを開き直す
6. 写したファイルと、3 で書き足された `.claude\settings.json` はコミットしてよい。ほかの PC では、「PC ごとに1回」をしたうえで、このリポジトリの 3〜5 だけをする

### 入ったかを確かめる

VS Code の新しいセッションを Manual モードで開いて、ガネーシャに1つずつ頼む。

1. 「チーム共通の決まりの場所は？」と聞く。`<ホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/docs/team-rules.md` のような答えが返れば、プラグインが入っている。`<版>` はコミットの先頭12文字のフォルダ名で、次の 2 で使う
2. allow が効くかを確かめる。次の2つを、それぞれ単独で頼む（`<版>` は 1 の答えのもの）。どちらも確認のダイアログが出なければ効いている

   ```
   Bash ツールで git fetch origin だけを単独で打って
   ```

   ```
   Bash ツールで、次のコマンドを書いてある形のまま単独で打って：
   node "<ホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/skills/codex/scripts/invoke-codex.mjs" -Mode check
   ```

   2つ目は健さんを呼ばず、`CHECK: ok（…）` を返すだけ（Codex の枠を使わない）。Codex CLI が入っていなくても打てる（`-Container` を付けないとき）。ダイアログを見逃しても、セッションの記録（`<ホーム>/.claude/projects/<プロジェクト>/<セッション>.jsonl`）の、そのツールの結果の `permissionDecision` が `"source":"config"` なら allow に当たっている

確かめが済んだら、下の「使い方」のとおりにガネーシャに頼めば使える。

### つまずきやすいところ

- **1 で答えが返らない（プラグインが入っていない）。** 「使うリポジトリごと」の 3 を、そのリポジトリの根で `--scope project` を付けて打ったかと、5 で開き直したかを見る
- **2 で確認のダイアログが出る。** 「使うリポジトリごと」の 4 の信頼を、`C:` と `c:` の両方でしたかを見る
- **allow の確かめは Bash ツールで、パスまで書いて頼む。** この2つの allow は Bash の形にしか無いので、PowerShell ツールで打つと当たらずに確認が出る。パスを書かずに「`-Mode check` を打って」とだけ頼むと、ガネーシャが `-Mode check` だけを打とうとする
- **確認が出ても「常に許可」は選ばない。** `.claude/settings.local.json` に決まりが書かれ、settings.json の allow が効いていないことが隠れる。出たら、「使うリポジトリごと」の 4 の信頼を見直す
- **写す元は、マーケットプレイスの中か、このリポジトリの作業ツリー。** どちらも `.gitattributes` で LF にそろえてある。GitHub の画面からコピーして貼るより、ファイルごと写す

### Mac・Linux での読み替え

上の手順は Windows（PowerShell）で書いてある。Mac・Linux では、次のように読み替える（Mac は実機ではまだ確かめていない）。

- コマンドはターミナル（zsh・bash）で打つ。`<ホーム>` は `/Users/<ユーザー名>`（Linux は `/home/<ユーザー名>`）、パスの区切りは `/`
- 「最初に」：`claude --version` が通らなければ、Claude Code を入れる（`npm install -g @anthropic-ai/claude-code` など）
- 「使うリポジトリごと」の 1：写すのは次でよい（`cp -n` は同じ名前のファイルを上書きしない。2行目で `True` のファイルがあれば、表のとおり手で合わせる。Linux の新しい `cp` は、既にあるファイルを飛ばしたときに終了コード 1 を返すことがあるが、写さなかっただけなので気にしなくてよい）

  ```
  cd <リポジトリのパス>
  for f in .claude/settings.json .claude/ai-team.json docs/team/Ganesha.md docs/team/common-rules.md; do [ -e "$f" ] && echo "$f : True" || echo "$f : False"; done
  src=~/.claude/plugins/marketplaces/ai-team-skills/repo-files
  mkdir -p .claude docs/team
  cp -n "$src/claude/settings.json" "$src/claude/ai-team.json" .claude/
  cp -n "$src/docs/team/Ganesha.md" "$src/docs/team/common-rules.md" docs/team/
  ```

- 「使うリポジトリごと」の 4：信頼は1回でよい（`cd <リポジトリのパス> && claude`）。ドライブ名の大文字・小文字の話は Windows だけ
- 「入ったかを確かめる」の 2：健さんの行は、`<ホーム>` を `/Users/<ユーザー名>` にした同じ形（`node "/Users/<ユーザー名>/.claude/plugins/cache/..." -Mode check`）。`~` や `$HOME` は書かない（そのままの文字列で allow と比べるため）

### 導入済みのリポジトリへの反映

- **プラグインの中身は自動で届く。** 自動更新をオンにしてあれば（「導入」の「PC ごとに1回」の2）、そのリポジトリのセッションで最初のメッセージを送ってから最大10分で、マーケットプレイスと `--scope project` のプラグインが新しい版になる。効くのは、次に VS Code を開き直したときか `/reload-plugins` の後。そのリポジトリでセッションを使わない間は、古い版のまま
- すぐ入れたいときだけ手で打つ：PC ごとに `claude plugin marketplace update ai-team-skills`、リポジトリごとに根で `claude plugin update ai-team@ai-team-skills --scope project`、そのあと VS Code を開き直す。入った版は `<ホーム>/.claude/plugins/installed_plugins.json` の ai-team の記録のうち、scope が project で projectPath がそのリポジトリのものの `gitCommitSha`
- **リポジトリ側（`repo-files/` の中身）は手で反映する。** `docs/team/Ganesha.md`・`common-rules.md` を今の版に差し替えて、固有の分（チェックコマンドなど）を戻す。写す元は、マーケットプレイスの中の `repo-files\`（新しい版が届いた後に。急ぐなら `claude plugin marketplace update ai-team-skills` を打ってから）か、このリポジトリの作業ツリー。`.claude/ai-team.json` に古い `plannerWritable` が残っていても動く（読み捨てる）
- プラグインだけ先に届いて、リポジトリ側の文書が古いままの間は、ガネーシャはチーム共通の決まり（team-rules.md）に従い、まーちゅうに差し替えを伝える（team-rules.md の「作業の進め方」に書いてある）
- **健さんのラッパーを Node.js にした版（#100）からは、`.claude/settings.json` の allow に次の1行が要る。** プラグインからは allow を足せないので、各リポジトリで、今ある `invoke-codex.ps1` の行のすぐ下に足す。足さないと、ガネーシャ・メジェドが健さんを呼ぶたびに確認のダイアログが出る（auto モードでは止まる）。Windows で前の呼び方（`powershell.exe ... invoke-codex.ps1`）を使うものは、中継が残っているので今までどおり動く

  ```
  "Bash(node \"*/ai-team-skills/ai-team/*/skills/codex/scripts/invoke-codex.mjs\" *)",
  ```

## 使い方

ガネーシャにふつうに頼む。誰を呼ぶかは、作業を始めるときにガネーシャが一言伝える。指名もできる。

- 「メジェドに実装を頼んで」→ ガネーシャが範囲（と、あれば `docs/tasks/<タスク名>/plan.md`）を渡して `ai-team:mejed` を呼ぶ。報告は短い見出し（結果・変更したファイル・チェックの結果と、あれば範囲の外）
- 「藤さんに見てもらって」→ ガネーシャが計画書のパスか比べるブランチだけを渡して `ai-team:adversary` を呼ぶ（自分の結論は渡さない）
- 「健さんに聞いて」「健さんにレビューして」→ スキル `codex` の `consult`・`review`
- 「純ちゃんに見てもらって」→ `/code-review`（枠の消費が大きい）
- 「セキュリティを見て」→ `/security-review`（今のブランチの未マージの変更を、脆弱性の観点だけで見る。報告だけで直さない）

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

### コンテナでのレビュー（健さんにテストも打たせる）

ふつうの `review` では、健さんはテストを走らせない（この PC の sandbox は read-only）。Docker が使える PC では、`review` に `-Container` を付けると、Linux のコンテナの中で健さんを動かし、テストを打った結果も根拠にさせられる。任意の機能で、使わなければ何もしなくてよい。

**使うリポジトリごと**：`.claude/ai-team.json` に `container` を書く（`setup` は準備のコマンド、`test` はテストのコマンド。どちらも1行）。`setup` には、テストが要る生成物を作るコマンドも入れる。まずは Node のリポジトリが対象（イメージは `node:22-bookworm`）。

```json
{
	"secretPatterns": [],
	"container": { "setup": "npm ci", "test": "npm test" }
}
```

**PC ごとに1回**

1. Docker Desktop（Linux は Docker Engine）を入れて起動する
2. 健さんの AGENTS.md に、テンプレート（`repo-files/codex/AGENTS.md`）の `<!-- ai-team: container-review v1 -->` の行で始まる節（「コンテナの中のレビュー」）を写す。自分用に書き換えた AGENTS.md なら、その節だけ足す。無いと `-Container` は止まる
3. リポジトリの根で、ガネーシャに `-Mode check -Container` を打ってもらう（イメージを作る。初回は数分）。「コンテナ用のログインがありません」と出たら、次に進む
4. ChatGPT の設定（セキュリティ）で「デバイスコードによるサインインを有効にする」を一時的にオンにし、止める文に出た `docker run --rm -it -v ai-team-codex-home:/root/.codex ai-team-codex:<版> codex login --device-auth` を PowerShell で打ってログインする。済んだら設定をオフに戻す（ログインはそのまま使える）

**知っておくこと**

- コンテナには、今ディスクにあるファイル（追跡しているものと、無視されていない未追跡のもの）と差分だけを写す。git の履歴は写さない。この PC のリポジトリには何も書かない
- 秘密情報のファイル（既定の4つと `secretPatterns`。`.env.example` のような例のファイルも `.env*` に当たる）は、変更していなければ写さないだけ（名前も健さんに送らない）。変更（ステージ・書き換え・無視されていない未追跡・`-Base` の差分）に入っていれば止まる
- 写さなかったファイルを読むテスト（`.env.example` を読むなど）は、コンテナの中では落ちる。健さんには、写さなかった秘密情報のファイルを読もうとして落ちたときだけ指摘にしないよう、頼みの文で伝えてある（ほかのファイルが無くて落ちたときは指摘する）
- 次のどれかがあると止まる：サブモジュール・未追跡の入れ子のリポジトリ・根より下のリンク・名前に改行などを含むファイル
- この PC の `config.toml` から渡すのは、最上位の `model`・`model_reasoning_effort`（`"…"` の形）だけ。ほかの設定（`model_provider` など）は渡らない
- `setup`・`test` はリポジトリの設定ファイルから来る。依存パッケージは、コンテナのログインのボリュームを読める場所で動く（手元で `npm test` を打つのと同じく、依存パッケージを信じる前提）
- この PC の git の設定は信じる。フィルター（clean・process）などの設定に、リポジトリの中のスクリプトを書かない
- 健さんのコンテナは、Docker の seccomp を外して起こす（`--security-opt seccomp=unconfined`。外さないと Codex の sandbox が動かない。Codex の sandbox はコンテナの中で生きている）
- `DOCKER_CONTEXT` があるとき、`DOCKER_HOST` や docker の context がこの PC 以外を指すときは止まる（この PC と見るのは `unix://` と `npipe:////./pipe/…` だけ）
- devcontainer の中では、Docker が使えなければ止まる
- codex の版を上げると、次に呼んだときにその版のイメージを作り、前の版のイメージを消す（ビルドのキャッシュは残るので、気になれば `docker builder prune` で消す）
- 強制終了したときや、後始末に失敗したときは、コンテナ・作業用のボリューム・一時ディレクトリ（作業ツリーの写し。Windows は `%TEMP%\claude\codex-*`、Mac・Linux は一時ディレクトリの下の `claude-codex-*`）が残ることがある。次で消す

  ```
  docker ps -aq --filter label=ai-team-codex=1        # 残ったコンテナ。docker rm -f <ID> で消す
  docker volume ls -q --filter label=ai-team-codex=1  # 残ったボリューム。docker volume rm <名前> で消す
  ```

## 中身

### プラグイン（`plugins/ai-team/`）

| ファイル | 中身 |
| --- | --- |
| `docs/team-rules.md` | チーム共通の決まり（言語・作業の進め方・チームの表・選び方の目安）。ガネーシャにはセッションの始めに SessionStart フックで入る。メジェドと藤さんは最初に Read で読む |
| `agents/mejed.md`・`agents/adversary.md` | メジェドと藤さんの定義 |
| `skills/codex/` | 健さんの呼び方と、ラッパー `scripts/invoke-codex.mjs`（Node.js。この PC では read-only・秘密情報の照らし合わせ・返事は標準出力に出すだけ。`-Container` のときはコンテナの中で動かす）。`scripts/invoke-codex.ps1` は、前の呼び方を残すための中継。`container/Dockerfile` は `-Container` のイメージ |
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
| `claude/ai-team.json` | `.claude/ai-team.json`。秘密情報のパターンの追加（`secretPatterns`。グロブ。既定の4つ `.env*`・`.dev.vars`・`.kv/`・`wp-config.php` は外せない）と、呼び名の対応（`names`。上の「呼び名を変える」）。ガードとラッパーと SessionStart のフックが読む。ガードが設定を読む根は、プロジェクトの根・そのメインのチェックアウトの根・編集先が入っている git の根（`.claude/worktrees/<名前>/` の中など。そのメインの根も）・フックの cwd の git の根（メインの根が同じときだけ）で、根ごとに `.claude/ai-team.json`、無ければ `repo-files/claude/ai-team.json`（テンプレートのリポジトリ）を読む。`secretPatterns` は全部を合わせ、プロジェクトの根からの相対パスと、そのパターンを書いた設定の根からの相対パス（入れ子のリポジトリ用）の両方に当てる。`.git`（プロジェクトや編集先から上へたどって見つかる祖先のフォルダのものも含む）を読めないときも止める。壊れていると、ガードは設定ファイルのほかの編集を全部止め、ラッパーは健さんを呼ばない。知らないキーは読み捨てる。ただし、知っているキーの打ち間違いに見えるキー（記号を除いて小文字にそろえたら同じ、か、2文字以内の違い。例：`secretPattern`・`secret_patterns`・`Names`）は、秘密情報の守りが黙って消えないよう、壊れている扱い |
| `codex/AGENTS.md` | 各 PC の `<CODEX_HOME>/AGENTS.md`（既定は `~/.codex/AGENTS.md`）。健さんのキャラと請け負う範囲 |
| `gitignore.snippet` | `.gitignore` に足す行 |

ガードが見るのは Edit / Write などの編集ツールだけで、Bash・PowerShell 経由の書き込み・読み取りは止まらない（柵であって壁ではない。team-rules.md で「回り込まない」と縛っている）。

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
