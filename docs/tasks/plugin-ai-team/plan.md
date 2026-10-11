# 計画書：plugin-ai-team

- 作成：ガネーシャ（2026-10-12）
- 承認：[x] まーちゅう（承認日：2026-10-12。承認の言葉：「承認」）
<!-- 承認欄の埋め方は docs/team/workflow.md の「承認欄」 -->
- ブランチ：`feat/34-plugin`（リポジトリの外の worktree で作業）
- イシュー：#34。PR には `Refs #34`（この PR ではクローズしない。gh-skills の目印（2）と4つのリポジトリの切り替え（3）が残るため）と書く
- メジェドのモデル：sonnet（ファイルの移動と、パス・エージェントの名前の書き換えが多くのファイルにまたがり、フックの新設とテストの読み先の直しもある。書き換えの漏れを見つける判断が実装に残るため）
- レビューの道：承認前は Fable・健さん ／ PR の前は 健さん
- 改訂履歴：
  - 2026-10-12 初版
  - 2026-10-12 Fable の指摘と、実機の確かめ（まーちゅうの OK で `claude.exe -p --plugin-dir` を使った）で改訂。ガードのテストの settings.json の確かめを hooks.json の確かめに置き換えた。メジェドは健さんのラッパーの呼び方を mejed.md の本文から使う（SKILL.md を Read で読むと展開されないため）。`plugin install` は `--scope project`。`validate` は `--strict` を付けない。allow の末尾は ` *`。SessionStart で workflow.md の場所も渡す。共有モジュールの設定ファイルの候補を `repo-files/claude/ai-team.json` に直す。健さんへの頼みの文にプラグインの文書の場所を書く。完了条件の grep の残りを決めた。チームの表と workflow.md の呼び名を `ai-team:` に
  - 2026-10-12 健さん consult 1回目の指摘で改訂。README の導入の順を、settings.json を置いてから `plugin install` にした（install が書く `enabledPlugins` を消さないため）。外し方の uninstall に `--scope project` を付け、マーケットプレイスとキャッシュはどのリポジトリでも使わなくなったときだけ消す。ラッパーのパスを二重引用符で囲み、allow も同じ形にした（実機で確かめた）。SessionStart の読めないとき・長すぎるときの文にも2つの絶対パスを入れ、テストで確かめる。完了条件の grep の残りに `.claude/ai-team.json` を足した。テスト観点の `--strict` を外した。team-rules.md に移す節を指す文（workflow.md・mejed.md）も直す。settings.json からフックを消す理由を現物に合わせた
  - 2026-10-12 健さん consult 2回目の指摘で改訂。README の更新の手順の `plugin update` を、入れた各リポジトリの根で `--scope project` を付けて打つ形にした。SessionStart の長さの判定を、頭の2行を足した後の全体にし、中身は1万文字以下でも全体が超える境目のテストを足した

## 目的

テンプレートのチームで共通のもの（スキル・エージェント・フック・健さんのラッパー・共有モジュール・作業の流れ・チーム共通の決まり）を、Claude Code のプラグイン `ai-team` にする。各リポジトリはプラグインを入れて参照し、リポジトリに残すのは固有の設定と決まりだけにする（#34 の 1b）。

## 背景・前提

- #34 の割り方：1a（固有のものの切り出し。PR #44 で済んだ）→ 1b（この計画）→ 2（gh-skills の目印）→ 3（4つのリポジトリの切り替え）
- #27 の PoC で分かったこと（#34 の本文の表）：プラグインのエージェントは `<プラグイン名>:<名前>` になり、フックの `agent_type` には `ai-team-poc:poc-agent` のように入った。settings.json の allow では `${CLAUDE_PLUGIN_ROOT}` は展開されないが、版によらないワイルドカード（`*/<マーケットプレイス>/<プラグイン>/*/...`）は効いた。入れた後は VS Code を閉じて開き直す必要があった。`enabledPlugins` をコミットしただけでは入らず、PC ごとに `plugin install` が要る
- 公式ドキュメントで分かったこと（#34 のコメント「1b の前に調べたことと、決めたこと」。2026-10-12）
  - `${CLAUDE_PLUGIN_ROOT}` は、スキルの本文と `allowed-tools`、エージェントの本文、フックの command・args で展開される
  - プラグインは自分のフォルダの中だけがキャッシュにコピーされる
  - マーケットプレイスの `source` に、同じリポジトリの中の相対パスを書ける
  - `plugin.json` に `version` を書かなければ、コミットの SHA で追う
  - プラグインからは permissions を足せない。プロジェクトのフックとプラグインのフックは両方動き、判定が割れたら deny > ask > allow
  - プラグインの根の CLAUDE.md は読まれず、CLAUDE.md の `@` 取り込みでは `${CLAUDE_PLUGIN_ROOT}` は使えない（キャッシュのパスは版ごとに変わる）
  - SessionStart フック（プラグインの `hooks/hooks.json` でも）の `hookSpecificOutput.additionalContext` で、セッションの始めにメインのエージェントの文脈へ文書を入れられる。上限は1万文字で、超えるとファイルに逃がされ先頭しか入らない。サブエージェントには入らない
  - `claude plugin validate <パス> [--strict]` で、マーケットプレイスとプラグインの形を確かめられる（終了コード 0 = 通った、1 = 失敗、2 = 確かめ自体の失敗）。この PC では PATH に無く、VS Code の拡張の `claude.exe`（2.1.296）で動いた
- 実機での確かめ（2026-10-12。まーちゅうの OK で、使い捨てのプラグイン `exp34` と使い捨てのリポジトリを scratchpad に作り、VS Code の拡張の `claude.exe`（2.1.296）を `-p`・`--plugin-dir`・`--settings` で動かした）
  - SessionStart のフック（`args` の形）の `additionalContext` は、メインのエージェントの文脈に入った（入れた合言葉を答えた）
  - エージェント（`--agent exp34:reader`）の本文の `${CLAUDE_PLUGIN_ROOT}` は展開され、プラグインの中のファイルを Read で読めた
  - プラグインの PreToolUse のフック（`args` の形）は動き、`agent_type` には `exp34:reader`（プラグイン名つき）が入った
  - Bash の中の `$CLAUDE_PLUGIN_ROOT` は、変数の確かめに弾かれて打てず、入るかは分からなかった。だから、Bash で打つ文字列には頼らず、エージェント・スキルの本文に書いて展開させる
  - settings.json の allow で、途中の `*` と末尾の `:*` を混ぜると、`*` が展開されずに当たらない（Claude Code が警告を出し、確認が要った）。末尾を ` *`（空白と `*`）にした `Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File */exp34/plugin/scripts/hello.ps1 *)` は、引数つき（`-Mode consult -Task t1`）でも確認なしで通った
  - 空白を含むパス（`exp34/sp ace/plugin/scripts/hello.ps1`）を `-File "<パス>"` と引用符で囲んで打つと、allow `Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "*/exp34/*/plugin/scripts/hello.ps1" *)` で確認なしに通り、引数も渡った。allow が無い設定で同じコマンドを打つと「This command requires approval」で止まった（allow が効いたことの確かめ）
  - `version` の無い plugin.json に `claude plugin validate --strict` を当てると、`version`（と `author`）の警告が失敗になる（終了コード 1）
  - 健さんの consult（read-only の sandbox、`-C` は作業の根）は、作業の根の外（scratchpad の下のプラグインの中）のファイルを読めた（`docs/tasks/plugin-ai-team/codex/01-consult.md`。承認前の確認の回には数えない）
- `plugin install` の既定のスコープは `user` で、user で入れると、その PC の全部のリポジトリでプラグイン（ガードと SessionStart）が動く（Fable の指摘。`claude.exe plugin install --help`）。だから、各リポジトリで `--scope project` で入れる（プロジェクトの `.claude/settings.json` に書かれる）
- まーちゅうの決めたこと（#34 のコメント。2026-10-12）
  - 置き場所：`claude/` の共通のものを `plugins/ai-team/` に移し、根に `.claude-plugin/marketplace.json` を置く。リポジトリ側のもの（settings.json・ai-team.json）は `repo-files/` に移す
  - 版：`plugin.json` に `version` を書かない
  - workflow.md と common-rules.md のチーム共通の部分は、プラグインに移す。リポジトリの common-rules.md には固有の決まりだけを残す
- チーム共通の決まりをガネーシャの頭に入れる方法（ガネーシャの案）：プラグインの SessionStart フックで、プラグインの `docs/team-rules.md` を `additionalContext` として入れる（今は CLAUDE.md → Ganesha.md → `@common-rules.md` の取り込みで入っている。共通の部分をプラグインに移すと、取り込みでは届かないため）。team-rules.md は1万文字に収める（今の common-rules.md の全体で 7,032 バイト。日本語なので文字数はもっと少ない）
- workflow.md（33,347 バイト）は長いので、いつも入れるのではなく、今までどおりスキル・エージェントが作業の最初に Read で読む。場所は `${CLAUDE_PLUGIN_ROOT}/docs/workflow.md`（スキルとエージェントの本文で展開される）
- メジェドと adversary（サブエージェント）には SessionStart の文脈が入らないので、本文の「最初に必ず読むこと」で、プラグインの `docs/team-rules.md`・`docs/workflow.md` と、リポジトリの `docs/team/common-rules.md` を Read で読む
- マーケットプレイスの名前：`ai-team-skills`（リポジトリの名前とそろえる）。プラグインの名前：`ai-team`（まーちゅうの決めたこと）。キャッシュの場所は `<ユーザーのホーム>/.claude/plugins/cache/ai-team-skills/ai-team/<版>/`
- このリポジトリのチェックコマンド（このタスクの後の形。実装の中で、移した後のパスで打つ）
  - `node plugins/ai-team/hooks/test-guard-code-edit.mjs`
  - `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs`
  - `claude plugin validate .` と `claude plugin validate plugins/ai-team`（`claude` が PATH に無ければ、VS Code の拡張の `claude.exe` を使う）。`--strict` は付けない（`version` を書かないので、`--strict` では必ず失敗するため）。どちらも終了コード 0 で、出ている警告が `version` が無いことだけ

## 対象ファイル

| パス | 種別（新規／変更／削除） | 変更の概要 |
| --- | --- | --- |
| `.claude-plugin/marketplace.json` | 新規 | マーケットプレイス `ai-team-skills`。プラグイン `ai-team` の `source` は `./plugins/ai-team` |
| `plugins/ai-team/.claude-plugin/plugin.json` | 新規 | `name`・`description`・`author`。`version` は書かない |
| `plugins/ai-team/hooks/hooks.json` | 新規 | PreToolUse（ガード）と SessionStart（チーム共通の決まりを入れる） |
| `plugins/ai-team/hooks/session-start.mjs` | 新規 | `docs/team-rules.md` を読み、`additionalContext` で返す |
| `plugins/ai-team/hooks/test-session-start.mjs` | 新規 | SessionStart のフックの確かめ（1万文字に収まるか、壊れたときの扱い） |
| `claude/agents/` → `plugins/ai-team/agents/` | 移動・変更 | mejed.md・adversary.md。読む文書の場所 |
| `claude/hooks/` → `plugins/ai-team/hooks/` | 移動・変更 | guard-code-edit.mjs（メジェドの名前）・ai-team-config.mjs・test-guard-code-edit.mjs（settings.json の読み先） |
| `claude/skills/` → `plugins/ai-team/skills/` | 移動・変更 | plan-writer・delegate-to-mejed・diff-reviewer・codex と雛形・ラッパー・テスト。読む文書の場所・エージェントの呼び名・ラッパーのパス |
| `repo-files/docs/team/workflow.md` → `plugins/ai-team/docs/workflow.md` | 移動・変更 | 中のパスの書き方 |
| `plugins/ai-team/docs/team-rules.md` | 新規 | 今の common-rules.md のチーム共通の部分 |
| `repo-files/docs/team/common-rules.md` | 変更 | 固有の決まりだけを残す |
| `repo-files/docs/team/Ganesha.md` | 変更 | 文書の場所の書き方 |
| `claude/settings.json` → `repo-files/claude/settings.json` | 移動・変更 | ガードのフックを消す（プラグインに移る）。健さんのラッパーの allow をキャッシュのワイルドカードにする |
| `claude/ai-team.json` → `repo-files/claude/ai-team.json` | 移動 | 中身は変えない |
| `repo-files/codex/AGENTS.md` | 変更 | 秘密情報の一覧の出どころ（プラグインのフックはリポジトリに無い） |
| `README.md` | 変更 | 中身と置き場所・導入・更新・外し方・反映の手順をプラグインの形に書き直す |
| `.gitignore` | 確認 | 変えない見込み（`docs/tasks/*/codex/`・`code-review/` は今のまま） |

## 変更内容

### 置き場所（`git mv` で移す。履歴を残すため）

- `claude/agents/` → `plugins/ai-team/agents/`、`claude/hooks/` → `plugins/ai-team/hooks/`、`claude/skills/` → `plugins/ai-team/skills/`
- `repo-files/docs/team/workflow.md` → `plugins/ai-team/docs/workflow.md`
- `claude/settings.json` → `repo-files/claude/settings.json`、`claude/ai-team.json` → `repo-files/claude/ai-team.json`
- 移した後、`claude/` は空になるので無くなる

### `.claude-plugin/marketplace.json`（新規）

- `{"name": "ai-team-skills", "owner": {"name": "rocket-martue"}, "plugins": [{"name": "ai-team", "source": "./plugins/ai-team", "description": "<短い説明>"}]}`（#27 の PoC の `poc/27-plugin` ブランチの `.claude-plugin/marketplace.json` と同じ形）

### `plugins/ai-team/.claude-plugin/plugin.json`（新規）

- `{"name": "ai-team", "description": "<短い説明>", "author": {"name": "rocket-martue"}}`。`version` は書かない

### `plugins/ai-team/hooks/hooks.json`（新規）

- `PreToolUse`：`matcher` は今の settings.json と同じ `Edit|Write|MultiEdit|NotebookEdit`。`command` は `node`、`args` は `["${CLAUDE_PLUGIN_ROOT}/hooks/guard-code-edit.mjs"]`（今の settings.json の書き方に合わせる）
- `SessionStart`：`matcher` は付けない（startup・resume・clear・compact・fork のどれでも入れる。compact の後に消えた決まりを入れ直すため）。`command` は `node`、`args` は `["${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs"]`

### `plugins/ai-team/hooks/session-start.mjs`（新規）

- 自分の場所からの `../docs/team-rules.md` を UTF-8 で読み、`{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "<中身>"}}` を標準出力に書いて、終了コード 0 で終わる
- 中身の頭に2行足す：「プラグイン ai-team のチーム共通の決まり（`<team-rules.md の絶対パス>`）。リポジトリの固有の決まりは docs/team/common-rules.md」と「作業の流れ（workflow.md）は `<docs/workflow.md の絶対パス>`。スキルを使わずに作業するとき（簡単な修正の道など）は、ここを Read で読む」（絶対パスは、このフックのファイルの場所から求める。キャッシュには古い版のフォルダも残るので、今の版の場所をここで渡す）
- 読めないときは、`additionalContext` に「チーム共通の決まり（`<team-rules.md の絶対パス>`）を読めなかった。Read で読んでから作業すること。作業の流れ（workflow.md）は `<docs/workflow.md の絶対パス>`」と書いて、終了コード 0 で終わる（セッションを止めない。場所は正常のときと同じ求め方）
- 頭の2行を足した後の `additionalContext` 全体が1万文字を超えるときは、先頭だけを入れず、上の「読めなかった」と同じ形で Read を促す（切れた決まりを黙って入れないため。上限は `additionalContext` 全体にかかるので、team-rules.md の中身だけでは判定しない）

### `plugins/ai-team/hooks/test-session-start.mjs`（新規）

- 今の `docs/team-rules.md` で、出力が JSON として読め、`hookEventName` が `SessionStart`、`additionalContext` が1万文字以下で、team-rules.md の中身を含む
- 今の `docs/team-rules.md` で、`additionalContext` に team-rules.md と docs/workflow.md の絶対パス（フックの場所から求めたもの）が入っている
- team-rules.md が無い仮の置き場所（フックのファイルを一時ディレクトリに写して呼ぶ）で、終了コード 0 で、`additionalContext` が Read を促す文になり、team-rules.md と workflow.md の絶対パスが入っている
- 1万文字を超える仮の team-rules.md で、Read を促す文になり、2つの絶対パスが入っている
- 中身は1万文字以下だが、頭の2行を足すと1万文字を超える仮の team-rules.md（1万文字から頭の2行の長さを引いた値より少し長いもの）で、Read を促す文になる

### `plugins/ai-team/docs/team-rules.md`（新規）と `repo-files/docs/team/common-rules.md`

- 今の common-rules.md（`repo-files/docs/team/common-rules.md`）を、次のように分ける
  - team-rules.md に移す：冒頭の説明（「ガネーシャ・メジェド・adversary が従う規約」）、「言語」、「作業の進め方」の全部（`:21-30`）、「チーム」の表と、その下の健さんに頼むときの決まり・指摘の扱い・PR に付いた指摘の段落（`:54-74`）
  - common-rules.md に残す：「コーディング」（`:9-17`）、「チェックコマンド」（`:32-36`）、「レビューの観点」（`:38-45`）、「計画の書き方」（`:47-52`）。冒頭の説明を「このリポジトリの固有の決まり。チーム共通の決まりと作業の流れは、プラグイン ai-team の docs/team-rules.md と docs/workflow.md（ガネーシャにはセッションの始めにフックで入る。メジェドと adversary は作業の最初に読む）」にする
- team-rules.md の中のパス（`.claude/hooks/guard-code-edit.mjs`・`.claude/skills/codex/SKILL.md` など）を、プラグインの中の場所の書き方（例：「プラグインのフック `hooks/guard-code-edit.mjs`」「`codex` スキル」）にする。`.claude/ai-team.json` はリポジトリ側なので、そのまま
- team-rules.md の「チーム」の表と workflow.md の中で、サブエージェントの呼び名（Agent ツールに渡す名前）として書いている `mejed`・`adversary` は、`ai-team:mejed`・`ai-team:adversary` にする（人として呼ぶ「メジェド」「adversary（Fable）」はそのまま）
- team-rules.md の中で common-rules.md を指していたところ（「チェックコマンド」など）は、「リポジトリの `docs/team/common-rules.md` の…」にする
- 逆に、ほかのファイルで、team-rules.md に移す節（「言語」「作業の進め方」「チーム」）を「common-rules.md の『…』」と指している文（今は `repo-files/docs/team/workflow.md:70` と `claude/agents/mejed.md:76` の「common-rules.md の『作業の進め方』」）は、「チーム共通の決まり（team-rules.md）の『…』」にする。実装のときに `grep -rn "common-rules.md の「\(言語\|作業の進め方\|チーム\)" plugins/ repo-files/ README.md` で全部を探す

### `repo-files/docs/team/Ganesha.md`

- 冒頭の `@common-rules.md` はそのまま（固有の決まりは取り込みで入る）
- 中の `docs/team/workflow.md` を「作業の流れ（workflow.md。場所は、セッションの始めに入るチーム共通の決まりの頭の行に書いてある）」の書き方にする。`delegate-to-mejed` などのスキルの名前は、呼ぶときの名前（`ai-team:delegate-to-mejed`）を添える
- 「サブエージェントの `mejed`」を「サブエージェントの `ai-team:mejed`」にする

### スキル（`plugins/ai-team/skills/`）

- 「最初に `docs/team/workflow.md` を Read で読む」（plan-writer・delegate-to-mejed・diff-reviewer）を、「最初に `${CLAUDE_PLUGIN_ROOT}/docs/workflow.md`（作業の流れ）を Read で読む」にする。本文の中の `workflow.md` を指す文は、そのまま「workflow.md」でよい（最初に場所を書くため）
- `docs/team/common-rules.md` を指す文は、そのまま（リポジトリ側に残る）。チーム共通の部分（作業の進め方・チームの表など）を指している文は、「チーム共通の決まり（`${CLAUDE_PLUGIN_ROOT}/docs/team-rules.md`）」にする
- サブエージェントの呼び名：`mejed` を `ai-team:mejed`、`adversary` を `ai-team:adversary` にする（Agent ツールの `subagent_type` に渡す名前）。文の中で人として呼ぶ「メジェド」はそのまま
- `codex` スキル
  - frontmatter の `allowed-tools` の `Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File .claude/skills/codex/scripts/invoke-codex.ps1:*)` を `Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1" *)` にする
  - 本文の呼び方の文字列の `.claude/skills/codex/scripts/invoke-codex.ps1` を `"${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1"`（二重引用符で囲む）にする（リポジトリの根から打つのは今と同じ）。展開先（ユーザーのホームの下）に空白があっても1つの引数になるようにするため（背景・前提の実機の確かめ）
  - `.claude/hooks/ai-team-config.mjs`・`.claude/hooks/guard-code-edit.mjs`・`.claude/agents/adversary.md` を指す文を、プラグインの中の場所の書き方にする
  - 「壊しに来る役を頼むとき」の「計画書のパス、`docs/team/common-rules.md` と `docs/team/workflow.md` の場所」を、「計画書のパス、リポジトリの `docs/team/common-rules.md`、チーム共通の決まり `${CLAUDE_PLUGIN_ROOT}/docs/team-rules.md` と作業の流れ `${CLAUDE_PLUGIN_ROOT}/docs/workflow.md` の場所（スキルとして読み込むと絶対パスになる。健さんは作業の根の外のファイルも読める（背景・前提の実機の確かめ））」にする。答えの場所の書き方は、リポジトリの外の文書については `<プラグイン>/docs/workflow.md:NN` の形で書くよう頼む（AGENTS.md の「絶対パスを書かない」と合わせる）
- plan.md の雛形のコメントの `docs/team/workflow.md` を「作業の流れ（プラグイン ai-team の docs/workflow.md）」にする（plan.md はリポジトリに書かれ、`${CLAUDE_PLUGIN_ROOT}` は展開されないため）
- workflow.md の中で、健さんのラッパーの呼び方（`make-patch`・`save-code-review` など）を書いているところは、パスを書かずに「呼び方は `codex` スキル（Skill ツールで読み込むと、ラッパーの場所が入る）」にする（workflow.md は Read で読まれ、`${CLAUDE_PLUGIN_ROOT}` が展開されないため）。ガネーシャは、健さんのラッパーを打つ前に Skill ツールで `ai-team:codex` を読み込む、を delegate-to-mejed・plan-writer の健さんを呼ぶ箇所に足す
- 健さんのラッパー（`invoke-codex.ps1`）とテストの中のパス：冒頭のコメントの呼び方の例（`.claude/skills/codex/scripts/invoke-codex.ps1`）をプラグインの形にする。共有モジュールへの相対パス（`../../../hooks/ai-team-config.mjs`）は、移した後もプラグインの中で同じ形なので変えない

### エージェント（`plugins/ai-team/agents/`）

- mejed.md と adversary.md の「最初に必ず読むこと」を、`${CLAUDE_PLUGIN_ROOT}/docs/team-rules.md`（チーム共通の決まり）・`docs/team/common-rules.md`（リポジトリの固有の決まり）・`${CLAUDE_PLUGIN_ROOT}/docs/workflow.md`（作業の流れ）の3つにする
- mejed.md の「頼む前に `.claude/skills/codex/SKILL.md` を Read で読み」を `${CLAUDE_PLUGIN_ROOT}/skills/codex/SKILL.md` にする（頼みの文の決まりを読むため）
- メジェドは SKILL.md を Read で読むので、その中の `${CLAUDE_PLUGIN_ROOT}` は展開されない（展開されるのは、スキルとして読み込んだときと、エージェントの本文だけ）。だから、mejed.md の「健さん（Codex）に頼むとき」の手順3の「SKILL.md の『呼び方の文字列』のとおりに呼ぶ」を、mejed.md の本文に呼び方の文字列そのもの（`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1" -Mode <consult|image> -Task <タスク名> -PromptFile <一時ファイル> [-Image "<画像1>|<画像2>"] [-WorkingDirectory <パス>]`）を書いて、そのとおりに呼ぶ、にする（本文なら展開されて絶対パスになる。Bash の中の `$CLAUDE_PLUGIN_ROOT` には頼らない）
- frontmatter の `name`（`mejed`・`adversary`）は変えない（プラグインの中では `ai-team:` が付く）

### 共有モジュール（`plugins/ai-team/hooks/ai-team-config.mjs`）

- 設定ファイルの候補 `CONFIG_CANDIDATES`（`['.claude/ai-team.json', 'claude/ai-team.json']`）の2つ目を、移した後のテンプレートの場所 `repo-files/claude/ai-team.json` にする（コメントの「テンプレートのリポジトリは claude/ai-team.json」も直す）。codex の SKILL.md・AGENTS.md の「無ければ `claude/ai-team.json`」も「無ければ `repo-files/claude/ai-team.json`（テンプレートのリポジトリ）」にする。ラッパーのテストの「テンプレートのリポジトリ」の確かめ（`test-invoke-codex.mjs:325-334`・`:434` 付近）も、`repo-files/claude/ai-team.json` に置いた形に直す

### ガード（`plugins/ai-team/hooks/guard-code-edit.mjs`）

- `IMPLEMENTER` を、`mejed`（プラグインに切り替える前のリポジトリの `.claude/agents/mejed.md`）と `ai-team:mejed`（プラグインのエージェント）の両方で通す形にする（#34 の本文の表）。ほかの判定は変えない
- 冒頭のコメントの「メジェド（サブエージェント mejed）」に `ai-team:mejed` を足す

### ガードのテスト（`plugins/ai-team/hooks/test-guard-code-edit.mjs`）

- `settingsPath`（`:15`。`path.join(here, '..', 'settings.json')`）を、移した後の `repo-files/claude/settings.json`（`path.join(here, '..', '..', '..', 'repo-files', 'claude', 'settings.json')`）にする（このテストはテンプレートのリポジトリでだけ打つ）
- 今の最後の確かめ（`:451-457`。settings.json の `hooks.PreToolUse` にガードが `node`・`${CLAUDE_PROJECT_DIR}/` で登録されている）を、プラグインの `hooks/hooks.json`（`path.join(here, 'hooks.json')`）を読む確かめに置き換える：PreToolUse の `matcher` が `Edit|Write|MultiEdit|NotebookEdit` で、`command` が `node`、`args[0]` が `${CLAUDE_PLUGIN_ROOT}/hooks/guard-code-edit.mjs`。SessionStart に `session-start.mjs` が登録されている。あわせて、settings.json に `hooks` が無い（ガードのフックが残っていない）ことを確かめる
- `ai-team:mejed` として編集したとき、`mejed` と同じ判定になる確かめを足す（コードの編集が通る・plan.md は止まる）。`ai-team:adversary` や `other:mejed` は通らない
- 冒頭のコメントの使い方の例のパスを、移した後の形にする

### `repo-files/claude/settings.json`

- `hooks` の PreToolUse（`${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-code-edit.mjs`）を消す（プラグインの hooks.json に移る。残すと、切り替えた後のリポジトリで2つのフックが動き、リポジトリに古いガードのファイルが残っていれば、`mejed` しか知らない古いガードが `ai-team:mejed` のコードの編集を止める。古いガードのファイルを消した後は、`node` が起動に失敗するだけで、止める側には倒れない（README の「Windows での実行」）。どちらにしても要らないため）
- 健さんのラッパーの allow（`Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File .claude/skills/codex/scripts/invoke-codex.ps1:*)`）を、`Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "*/ai-team-skills/ai-team/*/skills/codex/scripts/invoke-codex.ps1" *)` にする（パスは呼び方の文字列と同じく二重引用符で囲む。末尾は `:*` ではなく ` *`。途中の `*` と末尾の `:*` を混ぜると当たらないため。背景・前提の実機の確かめ。版が変わっても効く）
- ほかの permissions は変えない
- `enabledPlugins` は、テンプレートの settings.json には書かない（各リポジトリで `claude plugin install ai-team@ai-team-skills --scope project` を打つと、プロジェクトの `.claude/settings.json` に書かれるため。手で書くと、マーケットプレイスを入れていない PC で「入っていない」のエラーになる）

### `repo-files/codex/AGENTS.md`

- 「ファイルの場所は、リポジトリの根からの相対パスで書く」に、「リポジトリの外のプラグインの文書は `<プラグイン>/docs/workflow.md:NN` の形で書く（キャッシュの絶対パスを書かない）」を足す
- 秘密情報の一覧の出どころの「根の `.claude/hooks/ai-team-config.mjs`（無ければ `claude/hooks/ai-team-config.mjs`）の秘密情報の既定の一覧」は、プラグインに切り替えたリポジトリには無い。「既定の4つ（この文書に書いてある）と、`.claude/ai-team.json` の `secretPatterns`。プラグインに切り替える前のリポジトリでは、根の `.claude/hooks/` のフック・共有モジュールの一覧も」の形にする

### `README.md`

- 「中身と置き場所」の表を、プラグイン（`plugins/ai-team/` の中身）とリポジトリ側（`repo-files/` の中身）に分けて書き直す
- 「導入方法」を次の順に書き直す
  1. Claude Code に、マーケットプレイスを入れる（PC ごとに1回）：`claude plugin marketplace add rocket-martue/ai-team-skills`。private のリポジトリなので、gh の認証（`gh auth login` と `gh auth setup-git`）が要る
  2. リポジトリに `repo-files/` の中身を置く：`repo-files/claude/` → `.claude/`（settings.json・ai-team.json）、`repo-files/docs/team/` → `docs/team/`（common-rules.md・Ganesha.md）、`CLAUDE.md.snippet`、`gitignore.snippet`
  3. 入れるリポジトリの根で、プラグインを入れる（リポジトリごとに1回）：`claude plugin install ai-team@ai-team-skills --scope project`。**settings.json を置いた後に打つ**（install が `.claude/settings.json` に `enabledPlugins` を書くので、先に打つと、settings.json を写したときに消える）。**`--scope` を付けずに（user で）入れない**（その PC の全部のリポジトリで、ガードと SessionStart が動くため）
  4. common-rules.md の固有の決まり（チェックコマンド・レビューの観点・計画の書き方・コーディング）を書き換える。`ai-team.json` に秘密情報のパターンを足す
  5. 健さんを使うなら、今までどおり Codex と AGENTS.md
  6. VS Code を閉じて開き直す（ウィンドウの再読み込みでは読み込まれない）
- 「テンプレートを直した後の反映」を2つに分ける
  - プラグインの中身：各 PC で `claude plugin marketplace update ai-team-skills`（PC ごとに1回）→ プラグインを入れた各リポジトリの根で `claude plugin update ai-team@ai-team-skills --scope project`（入れたときと同じスコープ。スコープを省くと、今いるプロジェクトの中から探すので、入れていないリポジトリで打つと見つからない）→ VS Code を閉じて開き直す
  - リポジトリ側（`repo-files/` の中身）：今までの手で反映する手順（写す版を決める・差分を見る・取り入れるかを決める・残すものが消えていないかを確かめる）。settings.json の `enabledPlugins` は、テンプレートに無いが消さない
- 「外し方」を足す：外すリポジトリの根で `claude plugin uninstall ai-team@ai-team-skills --scope project`（入れたときと同じスコープ。付けないと user のスコープを探す）。その PC のどのリポジトリでも使わなくなったときだけ、`claude plugin marketplace remove ai-team-skills` と、キャッシュの `<ユーザーのホーム>/.claude/plugins/cache/ai-team-skills/` を手で消す（マーケットプレイスとキャッシュは PC で1つで、ほかのリポジトリも使っているため）
- そのほか、`claude/` を指す文（チェックコマンドの例、ファイルの分け方、編集できる範囲など）を、移した後の場所にする

### このリポジトリのチェックコマンド

- 上の「背景・前提」のとおり、移した後のパスで打つ。README の「このリポジトリで打つチェックコマンド」に当たる文があれば、合わせる

## 対象外（やらないこと）

- gh-skills の目印の直し（#34 の 2。rocket-martue/gh-skills の PR）
- 4つのリポジトリの切り替え（#34 の 3）と、Takamats-WordPress-Meetup への導入
- 実際にマーケットプレイスから入れて動かす確かめ（VS Code を開き直す必要がある。#34 の 3 の最初に、まーちゅうが1つのリポジトリで確かめる）。仕組みの確かめ（エージェントの本文の展開・フックの `args` の形・SessionStart・allow の形）は、背景・前提の実機の確かめで済んでいる
- `poc/27-plugin` ブランチを消すこと（#34 の 3 の後）
- メジェドの既定のモデル（#48）と、レビュー役の呼び名（#49）
- スキル・エージェント・フックの中身の判定の変更（ガードの `IMPLEMENTER` のほか）

## 完了条件

- [ ] `claude/` が無く、スキル・エージェント・フックが `plugins/ai-team/` の下にあり、`git log --follow` で移す前の履歴をたどれる（`git mv` で移した）
- [ ] `.claude-plugin/marketplace.json` と `plugins/ai-team/.claude-plugin/plugin.json` が上の変更内容のとおりで、`plugin.json` に `version` が無い
- [ ] `claude plugin validate .` と `claude plugin validate plugins/ai-team` が、どちらも終了コード 0 で、出ている警告が `version` が無いことだけ
- [ ] `plugins/ai-team/hooks/hooks.json` に PreToolUse（ガード）と SessionStart があり、`session-start.mjs` と `test-session-start.mjs` がある。`node plugins/ai-team/hooks/test-session-start.mjs` が通る
- [ ] `plugins/ai-team/docs/workflow.md` と `plugins/ai-team/docs/team-rules.md` があり、`repo-files/docs/team/workflow.md` が無い。`repo-files/docs/team/common-rules.md` には、コーディング・チェックコマンド・レビューの観点・計画の書き方と冒頭の説明だけがある
- [ ] `grep -rn "docs/team/workflow.md\|\.claude/skills/\|\.claude/hooks/\|\.claude/agents/\|claude/ai-team.json\|\`claude/" plugins/ repo-files/ README.md` の結果に残るのが、次だけ：(a) ガードとそのテストの、仮のリポジトリの中のパス（`.claude/hooks/...` を編集先として確かめるもの）、(b) 「プラグインに切り替える前のリポジトリでは」と前置きして書いた文（codex の SKILL.md と AGENTS.md の秘密情報の出どころ）、(c) `repo-files/claude/ai-team.json`、(d) README の「中身と置き場所」の、移した先を説明する文、(e) リポジトリの設定ファイル `.claude/ai-team.json`（リポジトリ側に残るもの）。ほかに残っていない
- [ ] Agent ツールに渡すサブエージェントの名前と、team-rules.md の「チーム」の表・workflow.md の呼び名が、`ai-team:mejed`・`ai-team:adversary` になっている
- [ ] mejed.md の本文に、健さんのラッパーの呼び方の文字列が `"${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1"`（二重引用符つき）で書いてあり、codex の SKILL.md の呼び方の文字列と `allowed-tools`、settings.json の allow も二重引用符でパスを囲んでいる。workflow.md にラッパーのパスが書いていない
- [ ] `grep -rn "common-rules.md の「\(言語\|作業の進め方\|チーム\)" plugins/ repo-files/ README.md` の結果が0件
- [ ] 共有モジュールの設定ファイルの候補が `.claude/ai-team.json` と `repo-files/claude/ai-team.json` で、codex の SKILL.md・AGENTS.md・ラッパーのテストが同じ場所を指している
- [ ] ガードが `mejed` と `ai-team:mejed` の両方を実装担当として通し、`node plugins/ai-team/hooks/test-guard-code-edit.mjs` が通る（足した確かめを含む）
- [ ] `node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs` が通る
- [ ] `repo-files/claude/settings.json` に、`hooks` が無く、健さんのラッパーの allow が末尾 ` *` のワイルドカードの形で、`enabledPlugins` が無い
- [ ] AGENTS.md と README が上の変更内容のとおり（README に導入・更新・外し方の手順があり、`plugin install`・`plugin update`・`plugin uninstall` に `--scope project` が付いて、リポジトリの根で打つ手順になっていて、`plugin install` が settings.json を置いた後の手順になっている）
- [ ] 対象ファイルの表のもの（移したものを含む）と、`docs/tasks/plugin-ai-team/` のほかに差分が無い
- [ ] 差分にローカルの絶対パス・クライアント識別情報が無い

## テスト観点

- 移す前と後で、ガード・ラッパーのテストが同じように通る（パスを直しただけで、判定は変わらない）
- SessionStart のフックが、読めないとき・長すぎるときにセッションを止めない
- スキル・エージェントから読む文書の場所が、全部プラグインの中かリポジトリの `docs/team/` のどちらかに合っている（どちらにも無い場所を指していない）
- マーケットプレイスとプラグインの形が `claude plugin validate`（`--strict` なし）で通り、警告が `version` が無いことだけ

## 承認前の確認

<!-- 承認を頼む前に、承認前の1つ目と2つ目（レビューの道）を呼んだ結果。承認依頼ごと・回ごとに見出しを分けて書く。1つ目を呼ぶのは最初の承認依頼の前だけ。まーちゅうに頼まれて回した分は、その旨を書く。`/code-review` のときは、見出しを「承認依頼1・/code-review（1つ目）」「承認依頼1・/code-review 1回目」のようにし、返事の行に保存先を書く -->

### 承認依頼1・Fable（2026-10-12）

- 採った（plan.md を直した）：11件（必須3・推奨8）。settings.json からフックを消すとガードのテストが必ず落ちる（必須）／メジェドが SKILL.md を Read で読むと `${CLAUDE_PLUGIN_ROOT}` が展開されない（必須）／`plugin install` の既定の user スコープで全部のリポジトリに効く（必須）／`--strict` と `version` 無しが両立しない／Ganesha.md から workflow.md の場所が分からない／allow の `*` と `:*` の組み合わせ／健さんがプラグインの文書を読めるか／共有モジュールの設定ファイルの候補 `claude/ai-team.json`／完了条件の grep の残りの判定／チームの表と workflow.md の呼び名／実機で確かめていない。改訂履歴の2行目
- 確認事項に移した：なし
- 見送った（理由）：なし
- 実機で確かめた（背景・前提の「実機での確かめ」）：Fable が推測として挙げたもののうち、`--strict` の失敗・`*` と `:*` の組み合わせが当たらないことは本当だった。エージェントの本文の展開・`args` の形のフック・SessionStart・健さんが外のファイルを読めることは、問題なかった

### 承認依頼1・健さん 1回目（2026-10-12）

- 返事：`docs/tasks/plugin-ai-team/codex/02-consult.md`
- 採った（plan.md を直した）：8件（必須6・推奨2）。テンプレートの settings.json を写すと install が書いた `enabledPlugins` が消える／uninstall のスコープと、共通のマーケットプレイス・キャッシュを消す影響／`${CLAUDE_PLUGIN_ROOT}` の展開先に空白があると `-File` が割れる（実機で、引用符で囲んだ形と allow が通ることを確かめた）／SessionStart の代わりの文に場所が無い／完了条件の grep が `.claude/ai-team.json` に当たる／テスト観点の `--strict`／workflow.md:70 の「common-rules.md の『作業の進め方』」／settings.json のフックを消す理由が現物と違う。改訂履歴の3行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん 2回目（2026-10-12）

- 返事：`docs/tasks/plugin-ai-team/codex/03-consult.md`
- 採った（plan.md を直した）：2件（必須1・推奨1）。`plugin update` を打つリポジトリとスコープが決まっていない／頭の2行を足すと1万文字を超える境目がテストに無い。改訂履歴の4行目
- 確認事項に移した：なし
- 見送った（理由）：なし

### 承認依頼1・健さん 3回目（2026-10-12）

- 返事：`docs/tasks/plugin-ai-team/codex/04-consult.md`
- 指摘なし

## 確認事項

- なし
