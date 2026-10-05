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

# 秘密情報のパターン（テンプレートの guard-code-edit.mjs の SECRET_PATTERNS と同じ。リポジトリに合わせて足す）
$SecretPatterns = @(
	'(^|/)\.dev\.vars$',
	'(^|/)\.kv/',
	'(^|/)wp-config\.php$',
	'(^|/)\.env[^/]*$'
)

function Test-SecretPath {
	param([string] $Path)
	$p = $Path.Replace('\', '/').ToLowerInvariant()
	foreach ($re in $SecretPatterns) {
		if ($p -match $re) { return $true }
	}
	return $false
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

if ($Mode -eq 'review') {
	# --uncommitted は未追跡のファイルを Codex が自分で拾う。頼みの文では止められないので、呼ぶ前に見る
	# -uall: 未追跡のディレクトリを1行にまとめず、中のファイルまで出す。-z: 空白や日本語のパスを引用符で囲まない
	Push-Location -LiteralPath $RepoRoot
	try {
		$previous = $ErrorActionPreference
		$ErrorActionPreference = 'Continue'
		$status = (& git status --porcelain -z -uall 2>$null) -join "`n"
		$gitCode = $LASTEXITCODE
		$ErrorActionPreference = $previous
	} finally {
		Pop-Location
	}
	if ($gitCode -ne 0) { Stop-Wrapper "git status が失敗しました（Git のリポジトリですか？）: $RepoRoot" }
	$secrets = @()
	foreach ($entry in ($status -split [char]0)) {
		if ($entry.StartsWith('?? ')) {
			$path = $entry.Substring(3)
			if (Test-SecretPath $path) { $secrets += $path }
		}
	}
	if ($secrets.Count -gt 0) {
		Stop-Wrapper ('未追跡の秘密情報のファイルがあるので、review を呼びません（--uncommitted は未追跡のファイルを Codex に送るため）: ' + ($secrets -join ', '))
	}
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

function Save-Reply {
	param([string] $Text)
	$dir = Join-Path $RepoRoot ("docs\tasks\$Task\codex")
	New-Item -ItemType Directory -Path $dir -Force | Out-Null
	# 連番は「今ある一番大きい番号 + 1」。同じ名前があれば上書きせず次の番号にする（欠番や同時の呼び出しで消さないため）
	$max = 0
	foreach ($f in @(Get-ChildItem -LiteralPath $dir -Filter '*.md' -File)) {
		if ($f.Name -match '^(\d+)-') { $n = [int]$Matches[1]; if ($n -gt $max) { $max = $n } }
	}
	$bytes = $utf8.GetBytes($Text)
	for ($n = $max + 1; $n -le $max + 100; $n++) {
		$name = '{0:D2}-{1}.md' -f $n, $Mode
		try {
			$stream = [System.IO.File]::Open((Join-Path $dir $name), [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
		} catch [System.IO.IOException] {
			continue
		}
		try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
		return "docs/tasks/$Task/codex/$name"
	}
	Stop-Wrapper "返事の保存先の名前が決められませんでした: $dir"
}

$exitCode = 0
try {
	switch ($Mode) {
		'consult' {
			$codexArgs = @('exec', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', $RepoRoot, '-o', $LastMessage)
			$exitCode = Invoke-Codex -Arguments $codexArgs -Stdin $Prompt
		}

		'review' {
			# 未追跡の秘密情報の確認は、一時ディレクトリを作る前に済ませてある
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
		# 画像のパスは健さんの答えだけから取る（時刻で探すと、同時に別の Codex が作った画像を取り違えるため）
		# 生成画像の保存先（<CODEX_HOME>/generated_images）の下にある画像だけを選ぶ（参照画像を選ばないため）
		$codexHome = if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) { Join-Path $HOME '.codex' } else { $env:CODEX_HOME }
		$generatedRoot = (Join-Path $codexHome 'generated_images').Replace('/', '\').TrimEnd('\') + '\'
		$found = $null
		# パスに空白が入ることがある（ユーザー名や CODEX_HOME）ので、空白は許し、引用符・改行などで区切る
		# ドライブ文字（C:\...）と UNC（\\server\share\...）の両方を拾う
		$hits = [regex]::Matches($reply, '(?i)((?:[A-Z]:[\\/]|\\\\[^\\/\s`"''<>|*?]+[\\/])[^`"''<>|*?\r\n]+?\.(png|jpe?g|webp))')
		foreach ($m in $hits) {
			$candidate = $m.Groups[1].Value.Trim()
			if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
			$resolved = (Resolve-Path -LiteralPath $candidate).Path
			if ($resolved.StartsWith($generatedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { $found = $resolved; break }
		}
		if ($null -eq $found) {
			Stop-Wrapper "健さんの答えに、生成画像の保存先（$generatedRoot）の下の、存在する画像の絶対パスがありませんでした。コピーせずに止めてください。" 2
		}
		Write-Output "IMAGE: $found"
	}
} finally {
	Remove-Item -LiteralPath $WorkDir -Recurse -Force -ErrorAction SilentlyContinue
}

exit $exitCode
