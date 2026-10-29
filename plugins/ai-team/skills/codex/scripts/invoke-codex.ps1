# invoke-codex.ps1（中継）
# 健さんのラッパーは invoke-codex.mjs（Node.js。Windows・Mac・Linux で動く。#100）。
# このファイルは、前の呼び方（powershell.exe ... invoke-codex.ps1）を残すための中継で、受け取った引数をそのまま渡すだけ。
# 導入済みのリポジトリの settings.json の allow と、gh-skills の呼び方がこの形のため（消すのは別のイシュー）。
#
# 呼び方（前と同じ）:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.ps1" -Mode consult -PromptFile <一時ファイル>
#
# 終了コード: invoke-codex.mjs の終了コードをそのまま返す（node が無ければ 1）

$ErrorActionPreference = 'Stop'

# 健さんの返事（日本語）が化けないように、標準入出力を UTF-8（BOM なし）にそろえる
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	[Console]::Error.WriteLine('invoke-codex: node が PATH にありません。秘密情報と設定ファイル（.claude/ai-team.json）の確かめに使うので、Node.js を入れてから呼んでください。')
	exit 1
}

# Windows PowerShell 5.1 が外のコマンドに引数を渡すときの癖を、2つ避ける（前の .ps1 は param() で受けていたので起きなかった）
# - 空白を含む値を "…" で囲むが、末尾の \ を重ねない。"C:\x y\" の \" が引用符と読まれ、後ろの引数が1つに溶ける → 末尾の \ を重ねる
# - 空の値（-Base "" など）を渡さずに落とす。後ろの引数が1つずつずれる → 空の値は "" として渡す
$passArgs = @(foreach ($a in $args) {
	$s = [string]$a
	if ($s -eq '') { '""' }
	elseif ($s -match '\s' -and $s -match '\\+$') { $s + $Matches[0] }
	else { $s }
})

# node が標準エラーに書いても止めない（Stop のままだと、そこで打ち切られて終了コードが 1 になる）
$ErrorActionPreference = 'Continue'
& node (Join-Path $PSScriptRoot 'invoke-codex.mjs') @passArgs
exit $LASTEXITCODE
