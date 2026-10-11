# invoke-codex.ps1
# Claude Code（ガネーシャ・メジェド）から Codex CLI（健さん）を呼ぶラッパー。
# モードは consult（読むだけの相談）・review（読むだけのレビュー）・image（画像の生成）の3つだけ。
# 実装（ファイルの書き換え）は頼まない。sandbox は常に read-only。
#
# 呼び方（リポジトリの根から、Bash ツールで）:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .claude/skills/codex/scripts/invoke-codex.ps1 -Mode consult -Task <タスク名> -PromptFile <一時ファイル>
#
# 終了コード: 0 = 成功 / 1 = 呼ぶ前の確認で止めた / 2 = image で画像のパスが取れなかった / それ以外 = codex の終了コード

[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet('consult', 'review', 'image')]
	[string] $Mode,

	# 返事を docs/tasks/<Task>/codex/ に保存するためのタスク名（必須）
	[string] $Task = '',

	# 頼みの文のファイル（consult・image で必須。review では使わない）
	[string] $PromptFile = '',

	# 作業の根（リポジトリの根）。省略時は今のディレクトリ
	[string] $WorkingDirectory = '',

	# image の参照画像。複数は | 区切りの1つの文字列で渡す（Windows のパスに | は使えない）
	[string] $Image = '',

	# review でコミット済みの差分を見るときの基準ブランチ（無ければ未コミットの変更を見る）
	[string] $Base = ''
)

$ErrorActionPreference = 'Stop'

# 日本語の頼みの文が化けないように、標準入出力を UTF-8（BOM なし）にそろえる
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Stop-Wrapper {
	param([string] $Message, [int] $Code = 1)
	[Console]::Error.WriteLine("invoke-codex: $Message")
	exit $Code
}

# ---- 呼ぶ前の確認 ----

if ([string]::IsNullOrWhiteSpace($Task)) {
	Stop-Wrapper '-Task（タスク名）が無いので呼びません。健さんの返事を docs/tasks/<タスク名>/codex/ に残すために必須です。'
}
# 英数字で始める（`.` や `..` だと保存先が docs/tasks/<タスク名>/codex/ から外れ、.gitignore に当たらなくなるため）
if ($Task -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
	Stop-Wrapper "-Task は英数字で始め、英数字と . _ - だけを使ってください: $Task"
}

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
	Stop-Wrapper 'codex が PATH にありません。npm install -g @openai/codex で入れて、codex login を打ってから呼んでください。'
}

$CallerDirectory = (Get-Location).Path
if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) { $WorkingDirectory = $CallerDirectory }
if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
	Stop-Wrapper "作業の根が見つかりません: $WorkingDirectory"
}
$RepoRoot = (Resolve-Path -LiteralPath $WorkingDirectory).Path

# 返事の保存先の根。worktree から呼ばれても、メインのチェックアウト（worktree list の1件目）にする。
# 求められなければ（git が失敗・worktree でない）、作業の根のまま。
function Get-ReplyRoot {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		$lines = @(& git -C $RepoRoot worktree list --porcelain 2>$null)
		$code = $LASTEXITCODE
	} catch {
		$code = 1
	} finally {
		$ErrorActionPreference = $previous
	}
	if ($code -ne 0) { return $RepoRoot }
	foreach ($line in $lines) {
		if ($line -match '^worktree (.+)$') {
			$main = $Matches[1].Trim().Replace('/', '\')
			if (Test-Path -LiteralPath $main -PathType Container) { return (Resolve-Path -LiteralPath $main).Path }
			return $RepoRoot
		}
	}
	return $RepoRoot
}

$Prompt = ''
if ($Mode -ne 'review') {
	if ([string]::IsNullOrWhiteSpace($PromptFile) -or -not (Test-Path -LiteralPath $PromptFile -PathType Leaf)) {
		Stop-Wrapper "頼みの文のファイル（-PromptFile）が見つかりません: $PromptFile"
	}
	$Prompt = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $PromptFile).Path, $utf8)
	if ([string]::IsNullOrWhiteSpace($Prompt)) {
		Stop-Wrapper '頼みの文が空です。'
	}
}

# ---- 設定ファイルと秘密情報の確認 ----
# 判定は共有モジュール（hooks/ai-team-config.mjs）に任せる（ガードと同じ判定にするため）。
# review は健さんに変更を渡す（--uncommitted: ステージ済み・未ステージ・未追跡 / --base: 基準ブランチとの差分と、見込みでは未コミットの変更）。
# 渡る変更のすべてのパスを集めて、呼ぶ前に秘密情報のパターンと照らす。review でなければ、パスは空（設定ファイルの確かめだけをする）
$GitPaths = @()
if ($Mode -eq 'review') {
	# git status の -uall: 未追跡のディレクトリを1行にまとめず、中のファイルまで出す。-z: 空白や日本語のパスを引用符で囲まない
	Push-Location -LiteralPath $RepoRoot
	try {
		$previous = $ErrorActionPreference
		$ErrorActionPreference = 'Continue'
		$status = (& git status --porcelain -z -uall 2>$null) -join "`n"
		$gitCode = $LASTEXITCODE
		$diffNames = ''
		$diffCode = 0
		if (-not [string]::IsNullOrWhiteSpace($Base)) {
			# --no-renames: 名前を変えたファイルを「元の名前の削除」と「新しい名前の追加」に分け、両方のパスを出させる
			$diffNames = (& git diff --name-only --no-renames -z "$Base...HEAD" -- 2>$null) -join "`n"
			$diffCode = $LASTEXITCODE
		}
		$ErrorActionPreference = $previous
	} finally {
		Pop-Location
	}
	if ($gitCode -ne 0) { Stop-Wrapper "git status が失敗しました（Git のリポジトリですか？）: $RepoRoot" }
	if ($diffCode -ne 0) { Stop-Wrapper "git diff が失敗しました（基準ブランチ $Base はありますか？）: $RepoRoot" }
	# 各項目は「XY <パス>」。X か Y が R・C（名前を変えた・写した）の項目は、次の項目に元のパスだけが続く
	$entries = @($status -split [char]0)
	for ($i = 0; $i -lt $entries.Count; $i++) {
		$entry = $entries[$i]
		if ($entry -eq '' -or $entry.Length -lt 4) { continue }
		$xy = $entry.Substring(0, 2)
		$GitPaths += $entry.Substring(3)
		if ($xy.Contains('R') -or $xy.Contains('C')) {
			$i++
			if ($i -lt $entries.Count -and $entries[$i] -ne '') { $GitPaths += $entries[$i] }
		}
	}
	foreach ($path in ($diffNames -split [char]0)) {
		if ($path -ne '') { $GitPaths += $path }
	}
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	Stop-Wrapper 'node が PATH にありません。秘密情報と設定ファイル（.claude/ai-team.json）の確かめに使うので、Node.js を入れてから呼んでください。'
}
$ConfigModule = Join-Path $PSScriptRoot '..\..\..\hooks\ai-team-config.mjs'
if (-not (Test-Path -LiteralPath $ConfigModule -PathType Leaf)) {
	Stop-Wrapper "共有モジュールが見つかりません: $ConfigModule"
}
$ConfigModule = (Resolve-Path -LiteralPath $ConfigModule).Path

# 作業の根と、メインのチェックアウト（worktree list の1件目）の根の両方で、設定ファイルを読む
$CheckRoots = @($RepoRoot)
$MainRoot = Get-ReplyRoot
if ($MainRoot -ine $RepoRoot) { $CheckRoots += $MainRoot }

$CheckDir = Join-Path ([System.IO.Path]::GetTempPath()) ('claude\codex-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $CheckDir -Force | Out-Null
$checkCode = 1
$checkOut = ''
try {
	$pathsFile = Join-Path $CheckDir 'paths.bin'
	$outFile = Join-Path $CheckDir 'out.txt'
	# NUL 区切りの UTF-8（BOM なし）。標準入出力を通さないのは、Windows PowerShell 5.1 の文字コードで日本語のパスが化けるため
	[System.IO.File]::WriteAllBytes($pathsFile, $utf8.GetBytes(($GitPaths -join [string][char]0)))
	$nodeArgs = @($ConfigModule, 'check')
	foreach ($root in $CheckRoots) { $nodeArgs += @('--root', $root) }
	$nodeArgs += @('--paths-file', $pathsFile, '--out', $outFile)
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		& node @nodeArgs
		$checkCode = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	if (Test-Path -LiteralPath $outFile -PathType Leaf) { $checkOut = [System.IO.File]::ReadAllText($outFile, $utf8) }
} finally {
	Remove-Item -LiteralPath $CheckDir -Recurse -Force -ErrorAction SilentlyContinue
}
if ($checkCode -eq 3) {
	$secrets = @($checkOut -split "`n" | Where-Object { $_ -ne '' } | Select-Object -Unique)
	Stop-Wrapper ('健さんに渡る変更に秘密情報のファイルがあるので、review を呼びません（未追跡・ステージ済み・書き換え・名前の変更・基準ブランチとの差分のどれも Codex に送られるため）: ' + ($secrets -join ', '))
}
if ($checkCode -eq 2) {
	Stop-Wrapper ("設定ファイル（.claude/ai-team.json）が壊れているので、健さんを呼びません（黙って既定の一覧に戻ると、足した秘密情報が守られないため）: $checkOut")
}
if ($checkCode -ne 0) {
	Stop-Wrapper "秘密情報と設定ファイルの確かめが失敗しました（node の終了コード $checkCode）。"
}
# 終了コード 0 でも、共有モジュールが印を書いていなければ、確かめが済んだか分からない（リンク経由の起動で何もせずに終わった場合など）
if (($checkOut -split "`n" | Select-Object -First 1).Trim() -ne 'ai-team-config: ok') {
	Stop-Wrapper '秘密情報と設定ファイルの確かめが済んだか分からないので、健さんを呼びません（共有モジュールが印を返しませんでした）。'
}

# 一時ディレクトリ（終わったら消す）
$WorkDir = Join-Path ([System.IO.Path]::GetTempPath()) ('claude\codex-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
$LastMessage = Join-Path $WorkDir 'last-message.md'

function Invoke-Codex {
	param([string[]] $Arguments, [string] $Stdin = $null)
	# codex は進み具合を出力に流すので、答え（-o のファイル）とは分けて捨てる。失敗したときだけ末尾を出す
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		if ($null -ne $Stdin) {
			$log = $Stdin | & codex @Arguments 2>&1
		} else {
			$log = & codex @Arguments 2>&1
		}
		$code = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	if ($code -ne 0) {
		[Console]::Error.WriteLine("invoke-codex: codex が終了コード $code で終わりました。最後の出力:")
		$log | Select-Object -Last 20 | ForEach-Object { [Console]::Error.WriteLine("  $_") }
	}
	return $code
}

# 保存する名前が、Git に無視されるか（リポジトリの根 $Root で `git check-ignore`。終了コード 0 のときだけ真）。
# git が失敗したとき（Git のリポジトリでない・128）は偽にして、一時ディレクトリに保存する
function Test-ReplyIgnored {
	param([string] $Root, [string] $RelPath)
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		& git -C $Root check-ignore -q -- $RelPath 2>$null
		$code = $LASTEXITCODE
	} catch {
		$code = 1
	} finally {
		$ErrorActionPreference = $previous
	}
	return ($code -eq 0)
}

# 返事の保存先（Git に無視されていないときに使う、OS の一時ディレクトリの下のフォルダ）。
# 根の識別子は「根の最後のフォルダの名前 + - + 根のパスの SHA-256 の先頭8文字」
# （同じ名前で親の違うリポジトリが混ざらないため。小文字にそろえるのは、C: と c: の違いで別の場所にしないため）
function Get-TempReplyDir {
	param([string] $ReplyRoot)
	$key = $ReplyRoot.ToLowerInvariant().Replace('\', '/')
	$sha = [System.Security.Cryptography.SHA256]::Create()
	try {
		$hash = $sha.ComputeHash($utf8.GetBytes($key))
	} finally {
		$sha.Dispose()
	}
	$hex = -join ($hash | ForEach-Object { $_.ToString('x2') })
	$id = (Split-Path -Leaf $ReplyRoot) + '-' + $hex.Substring(0, 8)
	return (Join-Path ([System.IO.Path]::GetTempPath()) (Join-Path 'codex-replies' (Join-Path $id $Task)))
}

# 保存先のフォルダにある返事の一番大きい連番（フォルダが無ければ 0）
function Get-MaxReplyNumber {
	param([string] $Dir)
	$max = 0
	if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return 0 }
	foreach ($f in @(Get-ChildItem -LiteralPath $Dir -Filter '*.md' -File)) {
		if ($f.Name -match '^(\d+)-') { $n = [int]$Matches[1]; if ($n -gt $max) { $max = $n } }
	}
	return $max
}

# 返事を保存して、保存先を返す（リポジトリの中なら相対パス、一時ディレクトリなら絶対パス）
function Save-Reply {
	param([string] $Text)
	$replyRoot = Get-ReplyRoot
	$repoRel = "docs/tasks/$Task/codex"
	$dir = Join-Path $replyRoot ("docs\tasks\$Task\codex")
	$switched = $false
	$bytes = $utf8.GetBytes($Text)
	# 連番は「今ある一番大きい番号 + 1」。同じ名前があれば上書きせず次の番号にする（欠番や同時の呼び出しで消さないため）
	$base = Get-MaxReplyNumber $dir
	for ($n = $base + 1; $n -le ($base + 100); $n++) {
		$name = '{0:D2}-{1}.md' -f $n, $Mode
		if (-not $switched) {
			# 無視されているかは、実際に保存する名前で確かめる（仮の名前では、除外の除外（!の行）を見落とすため）
			if (-not (Test-ReplyIgnored $replyRoot "$repoRel/$name")) {
				# 無視されていなければ、リポジトリには何も作らず、一時ディレクトリに続きの連番で保存する
				$switched = $true
				$dir = Get-TempReplyDir $replyRoot
				$base = Get-MaxReplyNumber $dir
				$n = $base
				[Console]::Error.WriteLine("invoke-codex: $replyRoot では docs/tasks/*/codex/ が Git に無視されていないので、返事を一時ディレクトリに保存しました（リポジトリに未追跡のファイルを残さないため）")
				continue
			}
		}
		New-Item -ItemType Directory -Path $dir -Force | Out-Null
		try {
			$stream = [System.IO.File]::Open((Join-Path $dir $name), [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
		} catch [System.IO.IOException] {
			continue
		}
		try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
		if ($switched) { return (Join-Path $dir $name) }
		return "$repoRel/$name"
	}
	Stop-Wrapper "返事の保存先の名前が決められませんでした: $dir"
}

$exitCode = 0
$RefOriginals = @()
try {
	switch ($Mode) {
		'consult' {
			$codexArgs = @('exec', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', $RepoRoot, '-o', $LastMessage)
			$exitCode = Invoke-Codex -Arguments $codexArgs -Stdin $Prompt
		}

		'review' {
			# 健さんに渡る変更の秘密情報の確認は、一時ディレクトリを作る前に済ませてある
			Push-Location -LiteralPath $RepoRoot
			try {
				# review は対象の指定と頼みの文を同時に受け付けない。決まりは健さんの AGENTS.md で持たせる
				$codexArgs = @('exec', 'review')
				if ([string]::IsNullOrWhiteSpace($Base)) { $codexArgs += '--uncommitted' } else { $codexArgs += @('--base', $Base) }
				$codexArgs += @('-c', 'sandbox_mode=read-only', '-o', $LastMessage)
				$exitCode = Invoke-Codex -Arguments $codexArgs
			} finally {
				Pop-Location
			}
		}

		'image' {
			if ([string]::IsNullOrWhiteSpace($Image)) { Stop-Wrapper 'image には参照画像（-Image）を1枚以上渡してください。' }
			# 参照画像は安全な名前でコピーし、このディレクトリに移動してから名前だけを渡す
			# （Codex の -i は値をカンマで分けるので、元の名前や親のパスにカンマがあると割れる）
			$refs = @()
			$i = 0
			foreach ($src in ($Image -split '\|')) {
				$src = $src.Trim()
				if ($src -eq '') { continue }
				$full = if ([System.IO.Path]::IsPathRooted($src)) { $src } else { Join-Path $CallerDirectory $src }
				if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { Stop-Wrapper "参照画像が見つかりません: $src" }
				# 元のファイルの場所を控える（前に作った画像を参照に渡したとき、それを今回の出力と取り違えないため）
				$RefOriginals += (Resolve-Path -LiteralPath $full).Path
				$i++
				$ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
				$name = "ref-$i$ext"
				Copy-Item -LiteralPath $full -Destination (Join-Path $WorkDir $name)
				$refs += $name
			}
			if ($refs.Count -eq 0) { Stop-Wrapper 'image には参照画像（-Image）を1枚以上渡してください。' }

			Push-Location -LiteralPath $WorkDir
			try {
				$codexArgs = @('exec', '--ephemeral', '--color', 'never', '--skip-git-repo-check', '-s', 'read-only', '-C', '.', '-o', $LastMessage)
				foreach ($r in $refs) { $codexArgs += @('-i', $r) }
				$exitCode = Invoke-Codex -Arguments $codexArgs -Stdin $Prompt
			} finally {
				Pop-Location
			}
		}
	}

	if (-not (Test-Path -LiteralPath $LastMessage -PathType Leaf)) {
		if ($exitCode -eq 0) { $exitCode = 1 }
		Stop-Wrapper "健さんの返事が取れませんでした（終了コード $exitCode）。" $exitCode
	}

	$reply = [System.IO.File]::ReadAllText($LastMessage, $utf8)
	$saved = Save-Reply $reply
	Write-Output $reply
	Write-Output ''
	Write-Output "SAVED: $saved"

	if ($Mode -eq 'image' -and $exitCode -eq 0) {
		# 画像のパスは、健さんの答えの「IMAGE_PATH: <絶対パス>」の行だけから取る
		# （文章から正規表現でパスを探すと、空白・UNC・アポストロフィなどで取りこぼす。時刻で探すと別の依頼の画像を取り違える）
		$codexHome = if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) { Join-Path $HOME '.codex' } else { $env:CODEX_HOME }
		$generatedRoot = (Join-Path $codexHome 'generated_images').Replace('/', '\').TrimEnd('\') + '\'
		$declared = $null
		foreach ($line in ($reply -split "\r?\n")) {
			if ($line -match '^\s*IMAGE_PATH:\s*(.+?)\s*$') { $declared = $Matches[1] }
		}
		$found = $null
		$why = '答えに「IMAGE_PATH: <絶対パス>」の行がありませんでした'
		if ($null -ne $declared) {
			# 行全体がバッククォートで囲まれていたら外す（パスの中の引用符には触らない）
			if ($declared.Length -ge 2 -and $declared.StartsWith('`') -and $declared.EndsWith('`')) { $declared = $declared.Substring(1, $declared.Length - 2) }
			$why = "IMAGE_PATH の画像が見つかりません: $declared"
			if (Test-Path -LiteralPath $declared -PathType Leaf) {
				$resolved = (Resolve-Path -LiteralPath $declared).Path
				if (-not $resolved.Replace('/', '\').StartsWith($generatedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
					$why = "IMAGE_PATH が生成画像の保存先（$generatedRoot）の下にありません: $resolved"
				} elseif ($RefOriginals | Where-Object { $_ -ieq $resolved }) {
					$why = "IMAGE_PATH が今回渡した参照画像と同じです: $resolved"
				} else {
					$found = $resolved
				}
			}
		}
		if ($null -eq $found) {
			Stop-Wrapper "$why。コピーせずに止めてください。" 2
		}
		Write-Output "IMAGE: $found"
	}
} finally {
	Remove-Item -LiteralPath $WorkDir -Recurse -Force -ErrorAction SilentlyContinue
}

exit $exitCode
