#!/usr/bin/env node
// guard-bash.mjs の確かめ。フックに入力の JSON を流して、終了コードと標準出力を見る。
// 使い方：リポジトリの根から node plugins/ai-team/hooks/test-guard-bash.mjs
// 期待は「allow（標準出力が permissionDecision: allow の JSON）」か「判定なし（標準出力が空）」。どちらも終了コードは 0。
// どの入力でも ask・deny は返さない。git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(here, 'guard-bash.mjs');
const pluginRoot = path.resolve(here, '..');
const win = process.platform === 'win32';

// 仮の置き場所：マーケットプレイスの写し（CLAUDE_CONFIG_DIR で指す）と、リポジトリの中の偽物
const sandbox = mkdtempSync(path.join(tmpdir(), 'guard-bash-test-'));
const configDir = path.join(sandbox, 'config');
const copyRoot = path.join(configDir, 'plugins', 'marketplaces', 'ai-team-skills', 'plugins', 'ai-team');
const fakeRoot = path.join(sandbox, 'repo', 'tools', 'ai-team-skills', 'ai-team', 'x');
const emptyConfigDir = path.join(sandbox, 'no-config');
const worktree = path.join(sandbox, 'wt');

let failed = 0;

const check = (label, ok) => {
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

const trySymlink = (target, linkPath, type) => {
	try {
		symlinkSync(target, linkPath, type);
		return true;
	} catch {
		return false;
	}
};

const script = (root, name) => path.join(root, 'skills', 'codex', 'scripts', name);
const toForward = (p) => p.split(path.sep).join('/');
// Git Bash の `/c/…` 形（Windows のドライブつきパスだけ）
const toGitBash = (p) => toForward(p).replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);

// 出力の形を確かめて、'allow' か 'none'（判定なし）を返す。ask・deny・形の崩れは 'bad'
function decide(result) {
	if (result.status !== 0) {
		return 'bad';
	}
	if (result.stdout.trim() === '') {
		return 'none';
	}
	try {
		const out = JSON.parse(result.stdout).hookSpecificOutput;
		const ok =
			out.hookEventName === 'PreToolUse' &&
			out.permissionDecision === 'allow' &&
			typeof out.permissionDecisionReason === 'string' &&
			out.permissionDecisionReason !== '';
		return ok ? 'allow' : 'bad';
	} catch {
		return 'bad';
	}
}

function runRaw(name, raw, expected, env = {}) {
	const result = spawnSync(process.execPath, [hook], {
		input: raw,
		env: { ...process.env, CLAUDE_CONFIG_DIR: configDir, ...env },
		encoding: 'utf8',
	});
	const actual = decide(result);
	check(`${name}（期待 ${expected}・実際 ${actual}）`, actual === expected);
}

function run(name, command, expected, env = {}) {
	runRaw(name, JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: worktree }), expected, env);
}

try {
	// 仮のラッパー（本物と同じ置き場所の形）
	for (const root of [copyRoot, fakeRoot]) {
		mkdirSync(path.join(root, 'skills', 'codex', 'scripts'), { recursive: true });
		for (const name of ['invoke-codex.mjs', 'invoke-codex.ps1']) {
			writeFileSync(script(root, name), '// 確かめ用の仮のファイル\n');
		}
	}
	mkdirSync(worktree, { recursive: true });
	mkdirSync(emptyConfigDir, { recursive: true });

	const own = script(pluginRoot, 'invoke-codex.mjs');
	const ownPs = script(pluginRoot, 'invoke-codex.ps1');
	const copy = script(copyRoot, 'invoke-codex.mjs');
	const copyPs = script(copyRoot, 'invoke-codex.ps1');
	const fake = script(fakeRoot, 'invoke-codex.mjs');
	const fakePs = script(fakeRoot, 'invoke-codex.ps1');
	check('フックの根に本物のラッパー（.mjs・.ps1）がある', existsSync(own) && existsSync(ownPs));

	const PS = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File';

	// ---- 本物 → allow ----
	run('本物（フックの根）', `node "${own}" -Mode check`, 'allow');
	run('本物（フックの根）・引数つき', `node "${toForward(own)}" -Mode consult -PromptFile "${toForward(path.join(sandbox, 'p.txt'))}" -WorkingDirectory "${toForward(worktree)}"`, 'allow');
	run('本物（マーケットプレイスの写し。CLAUDE_CONFIG_DIR で指す）', `node "${copy}" -Mode check`, 'allow');
	run('本物（フックの根）・.ps1', `${PS} "${ownPs}" -Mode check`, 'allow');
	run('本物（マーケットプレイスの写し）・.ps1', `${PS} "${copyPs}" -Mode check`, 'allow');
	run('本物・一重引用', `node '${toForward(own)}' -Mode check`, 'allow');
	// 引用なしの形は、チェックアウトのパスに空白が無いときだけ（空白があれば判定なしが正しい）
	const unquotable = !/\s/.test(toForward(own));
	if (unquotable) {
		run('本物・引用なし（空白の無いパス）', `node ${toForward(own)} -Mode check`, 'allow');
	}
	run('本物・引数なし', `node "${own}"`, 'allow');
	run('本物・cd つき', `cd "${worktree}" && node "${own}" -Mode check`, 'allow');
	if (unquotable) {
		run('本物・cd つき（一重引用・引用なし）', `cd '${toForward(worktree)}' && node ${toForward(own)} -Mode check`, 'allow');
	}
	run('本物・cd つきの .ps1（マーケットプレイスの写し）', `cd "${worktree}" && ${PS} "${copyPs}" -Mode check`, 'allow');
	run('本物・引数の引用の中の | は通す（-Image "a|b"）', `node "${own}" -Mode image -Image "${toForward(path.join(sandbox, 'a.png'))}|${toForward(path.join(sandbox, 'b.png'))}"`, 'allow');
	run('本物・一重引用の引数の中の ; は通す', `node "${own}" -PromptFile 'a;b'`, 'allow');
	run('本物・前後の空白', `  node "${own}" -Mode check  `, 'allow');
	run('本物・末尾の改行', `node "${own}" -Mode check\n`, 'allow');
	run('途中の制御文字（判定なし）', `node "${own}" -Mode\x01check`, 'none');
	// CLAUDE_CONFIG_DIR を変えたときの写し（もう一つの設定の根を一時フォルダに作って指す）
	const otherConfig = path.join(sandbox, 'config2');
	const otherCopyRoot = path.join(otherConfig, 'plugins', 'marketplaces', 'ai-team-skills', 'plugins', 'ai-team');
	mkdirSync(path.join(otherCopyRoot, 'skills', 'codex', 'scripts'), { recursive: true });
	writeFileSync(script(otherCopyRoot, 'invoke-codex.mjs'), '// 確かめ用の仮のファイル\n');
	run('本物（別の CLAUDE_CONFIG_DIR の写し）', `node "${script(otherCopyRoot, 'invoke-codex.mjs')}" -Mode check`, 'allow', { CLAUDE_CONFIG_DIR: otherConfig });
	run('別の CLAUDE_CONFIG_DIR のとき、前の設定の根の写しは当たらない', `node "${copy}" -Mode check`, 'none', { CLAUDE_CONFIG_DIR: otherConfig });

	// ---- マーケットプレイスの写しが無いとき ----
	run('写しが無い PC でも、フックの根の本物は通る', `node "${own}" -Mode check`, 'allow', { CLAUDE_CONFIG_DIR: emptyConfigDir });
	run('写しが無い PC では、写しの形のパスは判定なし（例外で落ちない）', `node "${copy}" -Mode check`, 'none', { CLAUDE_CONFIG_DIR: emptyConfigDir });

	// ---- パスの書き方（Windows のときだけ。Mac・Linux では \ も /c/ もただの名前の文字） ----
	if (win) {
		run('本物・\\ 区切り', `node "${own.split('/').join('\\')}" -Mode check`, 'allow');
		run('本物・/ 区切り', `node "${toForward(own)}" -Mode check`, 'allow');
		run('本物・Git Bash の /c/… 形', `node "${toGitBash(own)}" -Mode check`, 'allow');
		run('本物・/c/… 形（引用なし）', `node ${toGitBash(own)} -Mode check`, 'allow');
		run('本物・大文字小文字違い（Windows は区別しない）', `node "${own.toUpperCase()}" -Mode check`, 'allow');
		run('本物・.ps1 を \\ 区切りで', `${PS} "${ownPs.split('/').join('\\')}" -Mode check`, 'allow');
		run('引用なしで \\ 区切り（シェルが \\ を消すので判定なし）', `node ${own} -Mode check`, 'none');
	} else {
		console.log('skip \\ 区切り・/c/… 形・大文字小文字の確かめ（Windows だけ）');
	}

	// ---- リンク越しの置き方 ----
	const linked = path.join(sandbox, 'linked-root');
	if (trySymlink(pluginRoot, linked, 'junction')) {
		run('本物・リンク越しの置き方（フックの根へのリンク）', `node "${script(linked, 'invoke-codex.mjs')}" -Mode check`, 'allow');
	} else {
		console.log('skip リンク越しの確かめ（リンクを作れない環境）');
	}

	// ---- 引用なしの展開の記号：照らすファイル（本物へのリンク run[1].mjs）と、シェルが動かすファイル（run1.mjs）がずれる ----
	const globDir = path.join(sandbox, 'glob');
	mkdirSync(globDir, { recursive: true });
	writeFileSync(path.join(globDir, 'run1.mjs'), '// 確かめ用の仮のファイル\n');
	if (!/\s/.test(toForward(globDir)) && trySymlink(own, path.join(globDir, 'run[1].mjs'), 'file')) {
		run('引用なしのパスに [ ]（本物へのリンクでも判定なし）', `node ${toForward(path.join(globDir, 'run[1].mjs'))} -Mode check`, 'none');
	} else {
		console.log('skip 引用なしの [ ] の確かめ（リンクを作れない環境か、パスに空白がある）');
	}
	run('引用なしのパスに *', `node ${toForward(path.dirname(own))}/invoke-codex.m*s -Mode check`, 'none');

	// ---- 二重引用のパスの中の \ と改行（シェルが消すので、照らすリンク run\<改行>.mjs と動く run.mjs がずれる） ----
	const nlDir = path.join(sandbox, 'nl');
	mkdirSync(nlDir, { recursive: true });
	writeFileSync(path.join(nlDir, 'run.mjs'), '// 確かめ用の偽物\n');
	if (!win && trySymlink(own, path.join(nlDir, 'run\\\n.mjs'), 'file')) {
		run('二重引用のパスに \\ と改行（本物へのリンクでも判定なし）', `node "${toForward(nlDir)}/run\\\n.mjs" -Mode check`, 'none');
	} else {
		console.log('skip 二重引用のパスの \\ と改行の確かめ（Mac・Linux だけ）');
	}
	run('二重引用のパスに改行', `node "${toForward(path.dirname(own))}/\ninvoke-codex.mjs" -Mode check`, 'none');
	run('一重引用のパスに改行', `node '${toForward(path.dirname(own))}/\ninvoke-codex.mjs' -Mode check`, 'none');
	run('引数の二重引用の中の \\ と改行', `node "${own}" -PromptFile "a\\\nb"`, 'none');

	// ---- .ps1 だけ本物へのリンクにし、隣に偽物の .mjs を置く形（中継はリンク側の隣の .mjs を動かす） ----
	const ps1LinkDir = path.join(sandbox, 'ps1-link');
	mkdirSync(ps1LinkDir, { recursive: true });
	writeFileSync(path.join(ps1LinkDir, 'invoke-codex.mjs'), '// 確かめ用の偽物\n');
	if (trySymlink(ownPs, path.join(ps1LinkDir, 'invoke-codex.ps1'), 'file')) {
		run('.ps1 だけ本物へのリンクで、隣の .mjs が偽物（判定なし）', `${PS} "${toForward(path.join(ps1LinkDir, 'invoke-codex.ps1'))}" -Mode check`, 'none');
	} else {
		console.log('skip .ps1 だけのリンクの確かめ（リンクを作れない環境）');
	}

	// ---- 偽物・外へ出る形・シェルの記号 → 判定なし ----
	run('偽物（リポジトリの中の tools/ai-team-skills/ai-team/x/…）', `node "${fake}" -Mode check`, 'none');
	run('偽物の .ps1', `${PS} "${fakePs}" -Mode check`, 'none');
	run('偽物・cd つき', `cd "${worktree}" && node "${fake}" -Mode check`, 'none');
	run('偽物・本物と同じ名前のフォルダを重ねた形', `node "${toForward(path.join(fakeRoot, 'skills', 'codex', 'scripts'))}/../scripts/invoke-codex.mjs" -Mode check`, 'none');
	run('.. で出る形（本物を指していても判定なし）', `node "${toForward(pluginRoot)}/skills/../skills/codex/scripts/invoke-codex.mjs" -Mode check`, 'none');
	run('.. で外へ出る形', `node "${toForward(pluginRoot)}/../../x/invoke-codex.mjs" -Mode check`, 'none');
	run('相対パス', 'node "skills/codex/scripts/invoke-codex.mjs" -Mode check', 'none');
	run('ラッパーの名前が違う', `node "${toForward(path.join(pluginRoot, 'skills', 'codex', 'scripts', 'test-invoke-codex.mjs'))}" -Mode check`, 'none');
	run('本物の .mjs を .ps1 の形で呼ぶ', `${PS} "${own}" -Mode check`, 'none');
	run('; rm（引数のあと）', `node "${own}" -Mode check; rm -rf x`, 'none');
	run('&& で続く', `node "${own}" -Mode check && rm -rf x`, 'none');
	run('| で続く', `node "${own}" -Mode check | cat`, 'none');
	run('リダイレクト', `node "${own}" -Mode check > out.txt`, 'none');
	run('$(…) を引数に', `node "${own}" -Mode "$(rm -rf x)"`, 'none');
	run('コメントの中の引用符で引用を偽装し、改行の後に別のコマンド', `node "${own}" -Mode check # '\nprintf probe # '`, 'none');
	run('引数のあとのコメント', `node "${own}" -Mode check # x`, 'none');
	run('$VAR を引数に（引用の外）', `node "${own}" -WorkingDirectory $HOME`, 'none');
	run('$VAR を引数に（二重引用の中）', `node "${own}" -WorkingDirectory "$HOME"`, 'none');
	run('バッククォートを引数に', `node "${own}" -Mode \`id\``, 'none');
	run('バッククォートを二重引用の中に', `node "${own}" -Mode "\`id\`"`, 'none');
	run('二重引用の中の \\"', `node "${own}" -Mode "a\\"b"`, 'none');
	run('引数の中の改行（引用の外）', `node "${own}" -Mode check\nrm -rf x`, 'none');
	run('引用の外の ( ) を引数に', `node "${own}" -Mode (check)`, 'none');
	run('閉じていない引用', `node "${own}" -Mode "check`, 'none');
	run('引用の外の \\\' で引用を偽装', `node "${own}" -Mode \\' ; rm -rf x ; \\'`, 'none');
	run('行末の \\ （行の継ぎ足し）', `node "${own}" -Mode check \\\nrm -rf x`, 'none');
	run('cd $(…) &&', `cd $(rm -rf x) && node "${own}" -Mode check`, 'none');
	run('cd の引用の中に $(…)', `cd "$(rm -rf x)" && node "${own}" -Mode check`, 'none');
	run('cd のあとが ; ', `cd "${worktree}"; node "${own}" -Mode check`, 'none');
	run('cd が2つ', `cd "${worktree}" && cd "${worktree}" && node "${own}" -Mode check`, 'none');
	run('別のコマンドが前に付く', `echo x && node "${own}" -Mode check`, 'none');
	run('node -r ./x.js "<本物>"', `node -r ./x.js "${own}" -Mode check`, 'none');
	run('node --import ./x.mjs "<本物>"', `node --import ./x.mjs "${own}" -Mode check`, 'none');
	run('NODE_OPTIONS=--require=./x.js node "<本物>"', `NODE_OPTIONS=--require=./x.js node "${own}" -Mode check`, 'none');
	run('node とパスの引用の間に何か入る（node -e）', `node -e "1" "${own}"`, 'none');
	run('引用の直後に文字が続く', `node "${own}"x -Mode check`, 'none');
	run('powershell.exe に -NoProfile が無い', `powershell.exe -ExecutionPolicy Bypass -File "${ownPs}" -Mode check`, 'none');
	run('powershell.exe の前置き（-Command）', `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& '${ownPs}'"`, 'none');
	run('ほかのコマンド', 'git status', 'none');
	run('空のコマンド', '', 'none');

	// ---- 入力が思わぬ形でも、何も返さずに終わる ----
	runRaw('入力が空', '', 'none');
	runRaw('入力が JSON ではない', 'not json', 'none');
	runRaw('入力が null', 'null', 'none');
	runRaw('入力が配列', '[]', 'none');
	runRaw('tool_input が無い', JSON.stringify({ tool_name: 'Bash' }), 'none');
	runRaw('tool_input が null', JSON.stringify({ tool_name: 'Bash', tool_input: null }), 'none');
	runRaw('command が文字列ではない', JSON.stringify({ tool_name: 'Bash', tool_input: { command: 1 } }), 'none');
	runRaw('tool_name が Bash ではない', JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: `node "${own}" -Mode check` } }), 'none');
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
