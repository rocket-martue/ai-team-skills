// test-invoke-codex.mjs
// invoke-codex.ps1 の review の前の秘密情報の確かめを、偽物の codex だけで確かめる。
// 本物の健さん（codex）は呼ばない。依存なし（Node.js の標準モジュールだけ）。
//
// 使い方（リポジトリの根から）:
//   node plugins/ai-team/skills/codex/scripts/test-invoke-codex.mjs（プラグインを入れたリポジトリでは、プラグインの skills/codex/scripts/ の下）
//
// 終了コード: 0 = すべて通った / 1 = 1つでも落ちた

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wrapper = path.join(here, 'invoke-codex.ps1');

if (process.platform !== 'win32') {
	console.error('このテストは Windows PowerShell 5.1 用です（win32 以外では実行しません）。');
	process.exit(1);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-invoke-codex-'));
const fakeDir = path.join(root, 'fake-bin');
fs.mkdirSync(fakeDir);
// 利用者のグローバルな除外（core.excludesFile）に左右されないよう、空のファイルを指す
const emptyExcludes = path.join(root, 'empty-excludes');
fs.writeFileSync(emptyExcludes, '');
// 子プロセスの TEMP・TMP をここに向ける（一時ディレクトリへの保存が、本物の %TEMP% に残らないようにするため）
const tempDir = path.join(root, 'tmp');
fs.mkdirSync(tempDir);

// ---- 偽物の codex（呼ばれたら、-o の次の値のファイルに返事（fake reply）を書いて、印のファイルを書き、終了コード 0 で終わる） ----
fs.writeFileSync(path.join(fakeDir, 'codex.cmd'), [
	'@echo off',
	'set "OUT="',
	':loop',
	'if "%~1"=="" goto done',
	'if "%~1"=="-o" set "OUT=%~2"',
	'shift',
	'goto loop',
	':done',
	'if defined OUT > "%OUT%" echo fake reply',
	'echo called> "%FAKE_CODEX_MARK%"',
	'exit /b 0',
	'',
].join('\r\n'));
fs.writeFileSync(path.join(fakeDir, 'codex.ps1'), [
	'$out = \'\'',
	'for ($i = 0; $i -lt $args.Count; $i++) { if ($args[$i] -eq \'-o\' -and ($i + 1) -lt $args.Count) { $out = $args[$i + 1] } }',
	'$utf8 = New-Object System.Text.UTF8Encoding($false)',
	'if ($out -ne \'\') { [System.IO.File]::WriteAllText($out, \'fake reply\', $utf8) }',
	'[System.IO.File]::WriteAllText($env:FAKE_CODEX_MARK, \'called\', $utf8)',
	'exit 0',
	'',
].join('\r\n'));

// ---- 子プロセスの環境（今の PATH・PATHEXT・GIT_ を引き継がず、作り直す） ----
function findGitDir() {
	// where の出力は CP932 のことがあるので使わず、PATH を自分で分けて git.exe を探す
	const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH');
	for (const dir of (process.env[pathKey] || '').split(';')) {
		if (dir.trim() === '') continue;
		if (fs.existsSync(path.join(dir, 'git.exe'))) return dir;
	}
	throw new Error('git が見つかりません');
}
// git の場所は最初に1回だけ求める。見つからなければ一時ディレクトリを消して落ちる
let gitDir;
try {
	gitDir = findGitDir();
} catch (e) {
	console.error(String(e.message));
	fs.rmSync(root, { recursive: true, force: true });
	process.exit(1);
}
const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
const psDir = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0');
const psExe = path.join(psDir, 'powershell.exe');

function buildEnv(mark) {
	const env = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (/^GIT_/i.test(k)) continue;
		if (/^(PATH|PATHEXT)$/i.test(k)) continue;
		env[k] = v;
	}
	env.PATH = [fakeDir, gitDir, path.dirname(process.execPath), path.join(sysRoot, 'System32'), psDir].join(';');
	env.PATHEXT = '.COM;.EXE;.BAT;.CMD;.PS1';
	// 利用者の diff.renames の設定に左右されないよう、環境変数で固定する
	env.GIT_CONFIG_COUNT = '2';
	env.GIT_CONFIG_KEY_0 = 'diff.renames';
	env.GIT_CONFIG_VALUE_0 = 'true';
	env.GIT_CONFIG_KEY_1 = 'core.excludesFile';
	env.GIT_CONFIG_VALUE_1 = emptyExcludes;
	env.FAKE_CODEX_MARK = mark;
	env.TEMP = tempDir;
	env.TMP = tempDir;
	return env;
}

let total = 0;
let passed = 0;
function report(name, ok, detail = '') {
	total++;
	if (ok) passed++;
	console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok ? '' : ' ' + detail}`);
}

function finish() {
	fs.rmSync(root, { recursive: true, force: true });
	console.log(`${passed}/${total} 通った`);
	process.exit(passed === total && total > 0 ? 0 : 1);
}

let caseNo = 0;
function makeRepo(rel = '') {
	caseNo++;
	const repo = path.join(root, rel || `repo-${caseNo}`);
	const mark = path.join(root, `mark-${caseNo}.txt`);
	fs.mkdirSync(repo, { recursive: true });
	const env = buildEnv(mark);
	const git = (...args) => {
		const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: repo, env, encoding: 'utf8' });
		if (r.status !== 0) throw new Error(`git ${args.join(' ')} が失敗: ${r.stderr}`);
		return r.stdout;
	};
	const write = (rel, text = 'x\n') => {
		const full = path.join(repo, rel);
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, text);
	};
	git('init', '-q', '-b', 'main');
	write('README.md', 'readme\n');
	return { repo, mark, env, git, write };
}

function commitAll(git, msg) {
	git('add', '-A');
	git('commit', '-q', '-m', msg);
}

// consult の頼みの文
const promptFile = path.join(root, 'prompt-consult.md');
fs.writeFileSync(promptFile, '相談です\n');

// workDir：作業の根（省略時は ctx.repo）。worktree から呼ぶときに指す
function runWrapper(ctx, base, mode = 'review', workDir = ctx.repo, wrapperPath = wrapper) {
	const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath, '-Mode', mode, '-Task', 't', '-WorkingDirectory', workDir];
	if (mode === 'consult') args.push('-PromptFile', promptFile);
	if (base) args.push('-Base', base);
	const r = spawnSync(psExe, args, { cwd: workDir, env: ctx.env, encoding: 'utf8' });
	return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '', called: fs.existsSync(ctx.mark) };
}

// ---- 最初の確かめ：子プロセスで codex が偽物を指すか ----
{
	const env = buildEnv(path.join(root, 'mark-probe.txt'));
	const r = spawnSync(psExe, ['-NoProfile', '-Command', '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); (Get-Command codex).Source'], { env, encoding: 'utf8' });
	const src = (r.stdout || '').trim();
	if (r.status !== 0 || !src.toLowerCase().startsWith(fakeDir.toLowerCase())) {
		console.error(`Get-Command codex が偽物を指していません（${src || r.stderr}）。ラッパーを呼ばずに落とします。`);
		fs.rmSync(root, { recursive: true, force: true });
		process.exit(1);
	}
}

// 止まる：偽物の印が無く、ラッパーが期待の言葉で止まる
function expectStop(name, setup, { base = '', word = '秘密情報', mode = 'review' } = {}) {
	try {
		const ctx = makeRepo();
		setup(ctx);
		const r = runWrapper(ctx, base, mode);
		const ok = !r.called && r.code !== 0 && r.stderr.includes(word);
		report(`止まる: ${name}`, ok, `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(`止まる: ${name}`, false, String(e.message));
	}
}

// 止まらない：偽物の印がある（健さんを呼ぶところまで進んだ）
function expectPass(name, setup, { base = '', mode = 'review' } = {}) {
	try {
		const ctx = makeRepo();
		setup(ctx);
		const r = runWrapper(ctx, base, mode);
		report(`止まらない: ${name}`, r.called, `(code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(`止まらない: ${name}`, false, String(e.message));
	}
}

const envBody = Array.from({ length: 20 }, (_, i) => `KEY_${i}=value${i}`).join('\n') + '\n';

// ---- 止まる 9つ ----
expectStop('未追跡の .dev.vars', ({ git, write }) => {
	commitAll(git, 'init');
	write('.dev.vars', 'S=1\n');
});

expectStop('ステージした .dev.vars', ({ git, write }) => {
	commitAll(git, 'init');
	write('.dev.vars', 'S=1\n');
	git('add', '.dev.vars');
});

expectStop('追跡していて書き換えた wp-config.php（ステージしていない）', ({ git, write }) => {
	write('wp-config.php', '<?php // a\n');
	commitAll(git, 'init');
	write('wp-config.php', '<?php // b\n');
});

expectStop('名前を変えて、新しい名前が秘密情報（git mv a.txt .env）', ({ git, write }) => {
	write('a.txt', envBody);
	commitAll(git, 'init');
	git('mv', 'a.txt', '.env');
});

expectStop('名前を変えて、元の名前が秘密情報（git mv .env a.txt）', ({ git, write }) => {
	write('.env', envBody);
	commitAll(git, 'init');
	git('mv', '.env', 'a.txt');
});

expectStop('-Base で、基準ブランチの後のコミットで .kv/x を足した', ({ git, write }) => {
	commitAll(git, 'init');
	git('checkout', '-q', '-b', 'feature');
	write('.kv/x', 'v\n');
	commitAll(git, 'add kv');
}, { base: 'main' });

expectStop('-Base で、基準ブランチの後のコミットで .env を env.example に名前を変えた', (ctx) => {
	const { git, write, repo, env } = ctx;
	write('.env', envBody);
	commitAll(git, 'init');
	git('checkout', '-q', '-b', 'feature');
	git('mv', '.env', 'env.example');
	write('env.example', envBody.replace('KEY_3=value3', 'KEY_3=changed'));
	commitAll(git, 'rename');
	// git が名前の変更（R）と読んでいることを先に確かめる（--no-renames の付け忘れを見分けるため）
	const r = spawnSync('git', ['diff', '-M', '--name-status', 'main...HEAD'], { cwd: repo, env, encoding: 'utf8' });
	if (!/^R/.test((r.stdout || '').trim())) throw new Error(`git が R と読んでいません: ${r.stdout}`);
}, { base: 'main' });

expectStop('-Base で、差分は秘密情報でないが、未コミットの .dev.vars をステージした', ({ git, write }) => {
	commitAll(git, 'init');
	git('checkout', '-q', '-b', 'feature');
	write('ok.txt', 'ok\n');
	commitAll(git, 'ok');
	write('.dev.vars', 'S=1\n');
	git('add', '.dev.vars');
}, { base: 'main' });

expectStop('-Base で、無い基準ブランチ', ({ git }) => {
	commitAll(git, 'init');
}, { base: 'no-such-branch', word: 'git diff が失敗' });

// ---- 止まらない 3つ ----
expectPass('作業ツリーがきれい', ({ git }) => {
	commitAll(git, 'init');
});

expectPass('秘密情報でないファイル（空白と日本語のパス）を未追跡・ステージ・書き換え', ({ git, write }) => {
	write('メモ 一覧.txt', 'a\n');
	commitAll(git, 'init');
	write('メモ 一覧.txt', 'b\n');
	write('新しい 資料.txt', 'c\n');
	git('add', '新しい 資料.txt');
	write('未追跡 ファイル.txt', 'd\n');
});

expectPass('-Base で、基準ブランチの後のコミットが秘密情報でないファイルだけ', ({ git, write }) => {
	commitAll(git, 'init');
	git('checkout', '-q', '-b', 'feature');
	write('docs/説明 書.md', 'doc\n');
	commitAll(git, 'doc');
}, { base: 'main' });

// ---- 設定ファイル（.claude/ai-team.json・repo-files/claude/ai-team.json）。判定は共有モジュール（ガードと同じ）に任せている ----
const j = (obj) => JSON.stringify(obj);
const wrangler = j({ secretPatterns: ['**/.wrangler/**'] });

expectStop('設定: .wrangler/ の未追跡のファイル', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.wrangler/state.json', 's\n');
});

expectStop('設定: sub/.wrangler/x の未追跡のファイル', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('sub/.wrangler/x', 's\n');
});

expectStop('設定: 日本語のパス（.wrangler/日本語.json）は止まり、止まった文に化けずに出る', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.wrangler/日本語.json', 's\n');
}, { word: '.wrangler/日本語.json' });

expectStop('設定: U+2028 を含むパス（.wrangler/state<U+2028>.json）も止まる', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.wrangler/state .json', 's\n');
});

expectPass('設定: .wrangler/ に当たる変更が無い（wrangler.toml だけ）', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('wrangler.toml', 'name = "x"\n');
});

expectPass('設定: 設定ファイルが無ければ今までどおり（.wrangler/ は秘密情報ではない）', ({ git, write }) => {
	commitAll(git, 'init');
	write('.wrangler/state.json', 's\n');
});

expectStop('設定: 既定の秘密情報は、設定ファイルがあっても止まる', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.dev.vars', 'S=1\n');
});

expectPass('設定: repo-files/claude/ai-team.json だけのリポジトリ（テンプレートのリポジトリ）で、当たらなければ通る', ({ git, write }) => {
	write('repo-files/claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('src/a.txt', 'a\n');
});

expectStop('設定: .claude/ が無く repo-files/claude/ai-team.json だけのリポジトリ（テンプレートのリポジトリ）', ({ git, write }) => {
	write('repo-files/claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.wrangler/state.json', 's\n');
});

// 壊れている設定：consult も止まる（健さんを呼ばない）
const brokenWord = '壊れている';
expectStop('設定が JSON として壊れている: consult も止まる', ({ git, write }) => {
	write('.claude/ai-team.json', '{ not json');
	commitAll(git, 'init');
}, { mode: 'consult', word: brokenWord });

expectStop('設定が JSON として壊れている: review も止まる', ({ git, write }) => {
	write('.claude/ai-team.json', '{ not json');
	commitAll(git, 'init');
}, { word: brokenWord });

// 設定ファイルの中身（秘密情報かもしれない）を、止めた文に出さない
for (const [label, body] of [['JSON でない中身', 'API_KEY=abc123secret'], ['知らないキーの名前', '{"abc123secret": []}']]) {
	const name = `止まる: 設定の中身（${label}）が止めた文に出ない`;
	try {
		const ctx = makeRepo();
		ctx.write('.claude/ai-team.json', body);
		commitAll(ctx.git, 'init');
		const r = runWrapper(ctx, '', 'consult');
		const out = `${r.stdout}${r.stderr}`;
		const ok = !r.called && r.code !== 0 && out.includes(brokenWord) && !out.includes('abc123secret');
		report(name, ok, `(called=${r.called} code=${r.code} out=${out.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

expectStop('設定に知らないキー（SecretPatterns）がある: 止まる', ({ git, write }) => {
	write('.claude/ai-team.json', j({ SecretPatterns: [] }));
	commitAll(git, 'init');
}, { mode: 'consult', word: brokenWord });

expectStop('設定の plannerWritable が [1]: 止まる', ({ git, write }) => {
	write('.claude/ai-team.json', j({ plannerWritable: [1] }));
	commitAll(git, 'init');
}, { mode: 'consult', word: brokenWord });

expectStop('設定のグロブが壊れている（{a,b}）: 止まる', ({ git, write }) => {
	write('.claude/ai-team.json', j({ secretPatterns: ['{a,b}'] }));
	commitAll(git, 'init');
}, { mode: 'consult', word: brokenWord });

expectStop('設定が UTF-16LE（BOM 付き）: 止まる', (ctx) => {
	fs.mkdirSync(path.join(ctx.repo, '.claude'), { recursive: true });
	fs.writeFileSync(path.join(ctx.repo, '.claude', 'ai-team.json'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(wrangler, 'utf16le')]));
	commitAll(ctx.git, 'init');
}, { mode: 'consult', word: brokenWord });

expectPass('設定が UTF-8 の BOM 付きで中身が正しい: 読める（consult が通る）', (ctx) => {
	fs.mkdirSync(path.join(ctx.repo, '.claude'), { recursive: true });
	fs.writeFileSync(path.join(ctx.repo, '.claude', 'ai-team.json'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(wrangler, 'utf8')]));
	commitAll(ctx.git, 'init');
}, { mode: 'consult' });

// 設定がリンク切れ（シンボリックリンクを作れない環境では飛ばす）
try {
	const ctx = makeRepo();
	commitAll(ctx.git, 'init');
	fs.mkdirSync(path.join(ctx.repo, '.claude'), { recursive: true });
	let linked = true;
	try {
		fs.symlinkSync(path.join(ctx.repo, 'no-such-target.json'), path.join(ctx.repo, '.claude', 'ai-team.json'), 'file');
	} catch {
		linked = false;
	}
	if (linked) {
		const r = runWrapper(ctx, '', 'consult');
		report('設定がリンク切れ: consult も止まる', !r.called && r.code !== 0 && r.stderr.includes('壊れている'), `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} else {
		console.log('skip 設定がリンク切れの確かめ（シンボリックリンクを作れない環境）');
	}
} catch (e) {
	report('設定がリンク切れ: consult も止まる', false, String(e.message));
}

// worktree から呼ぶ：worktree の根に設定が無くても、メインのチェックアウトの根の設定を読む
function worktreeCase(name, configRel) {
	try {
		const main = makeRepo();
		commitAll(main.git, 'init');
		const wt = path.join(root, `wt-cfg-${caseNo}`);
		gitIn(main.repo, main.env, 'worktree', 'add', '-q', '-b', 'feature', wt);
		// 設定は worktree を作った後に、メインのチェックアウトの根だけに置く（worktree の根には無い）
		const full = path.join(main.repo, ...configRel.split('/'));
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, wrangler);
		fs.mkdirSync(path.join(wt, '.wrangler'), { recursive: true });
		fs.writeFileSync(path.join(wt, '.wrangler', 'state.json'), 's\n');
		const r = runWrapper(main, '', 'review', wt);
		const ok = !r.called && r.code !== 0 && r.stderr.includes('秘密情報') && r.stderr.includes('.wrangler/state.json');
		report(`止まる: ${name}`, ok, `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(`止まる: ${name}`, false, String(e.message));
	}
}
worktreeCase('設定: worktree の根に設定が無く、メインのチェックアウトの .claude/ai-team.json に .wrangler/ がある', '.claude/ai-team.json');
worktreeCase('設定: worktree の根にもメインの .claude/ にも設定が無く、メインの repo-files/claude/ai-team.json に .wrangler/ がある', 'repo-files/claude/ai-team.json');

// 共有モジュールの置き方の確かめ：ラッパーのコピーの 3 つ上に hooks/ を置く（skills/codex/scripts/ の形）
function makeWrapperTree(hooksKind) {
	const tree = path.join(root, `wrapper-tree-${hooksKind}-${caseNo}`);
	const scripts = path.join(tree, 'skills', 'codex', 'scripts');
	fs.mkdirSync(scripts, { recursive: true });
	fs.copyFileSync(wrapper, path.join(scripts, 'invoke-codex.ps1'));
	const realHooks = path.join(here, '..', '..', '..', 'hooks');
	const hooks = path.join(tree, 'hooks');
	if (hooksKind === 'junction') {
		fs.symlinkSync(realHooks, hooks, 'junction');
	} else {
		fs.mkdirSync(hooks, { recursive: true });
		fs.writeFileSync(path.join(hooks, 'ai-team-config.mjs'), 'process.exit(0);\n');
	}
	return path.join(scripts, 'invoke-codex.ps1');
}

// hooks/ がジャンクション経由でも、秘密情報で review が止まる（起動の判定が実体のパスにそろっている）
try {
	const ctx = makeRepo();
	commitAll(ctx.git, 'init');
	ctx.write('.dev.vars', 'S=1\n');
	let tree = null;
	try {
		tree = makeWrapperTree('junction');
	} catch {
		console.log('skip hooks がジャンクション経由の確かめ（ジャンクションを作れない環境）');
	}
	if (tree) {
		const r = runWrapper(ctx, '', 'review', ctx.repo, tree);
		report('止まる: hooks/ がジャンクション経由でも、未追跡の .dev.vars で review が止まる', !r.called && r.code !== 0 && r.stderr.includes('秘密情報'), `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	}
} catch (e) {
	report('止まる: hooks/ がジャンクション経由でも、未追跡の .dev.vars で review が止まる', false, String(e.message));
}

// 共有モジュールが何も書かずに終了コード 0 で終わる（印が無い）と、確かめが済んだか分からないので止まる
try {
	const ctx = makeRepo();
	commitAll(ctx.git, 'init');
	const r = runWrapper(ctx, '', 'consult', ctx.repo, makeWrapperTree('stub'));
	report('止まる: 共有モジュールが印を書かずに 0 で終わると、consult も止まる', !r.called && r.code !== 0 && r.stderr.includes('済んだか分からない'), `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('止まる: 共有モジュールが印を書かずに 0 で終わると、consult も止まる', false, String(e.message));
}

// ---- 返事の保存先（Git に無視されるか）の7本。偽物の codex で、保存まで通す ----
const envForGit = buildEnv(path.join(root, 'mark-unused.txt'));
function gitStatus(dir) {
	const r = spawnSync('git', ['status', '--porcelain', '-uall'], { cwd: dir, env: envForGit, encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`git status が失敗: ${r.stderr}`);
	return r.stdout;
}
function gitIn(dir, env, ...args) {
	const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, env, encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`git ${args.join(' ')} が失敗: ${r.stderr}`);
	return r.stdout;
}
function runRaw(args, cwd, env) {
	const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, ...args], { cwd, env, encoding: 'utf8' });
	return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '' };
}
function reviewArgs(repo) {
	return ['-Mode', 'review', '-Task', 't', '-WorkingDirectory', repo];
}
function savedPath(stdout) {
	const m = stdout.match(/^SAVED: (.+?)\s*$/m);
	return m ? m[1] : null;
}
function isUnderTemp(p) {
	return p !== null && path.isAbsolute(p) && p.toLowerCase().startsWith(tempDir.toLowerCase() + path.sep);
}
function readReply(p) {
	return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}
const NOTICE = '一時ディレクトリに保存しました';

// 1. 無視されるリポジトリ：リポジトリの中に保存し、SAVED は相対パス
try {
	const ctx = makeRepo();
	ctx.write('.gitignore', 'docs/tasks/*/codex/\n');
	commitAll(ctx.git, 'ignore');
	const before = gitStatus(ctx.repo);
	const r = runRaw(reviewArgs(ctx.repo), ctx.repo, ctx.env);
	const saved = savedPath(r.stdout);
	const ok = r.code === 0
		&& saved === 'docs/tasks/t/codex/01-review.md'
		&& readReply(path.join(ctx.repo, 'docs', 'tasks', 't', 'codex', '01-review.md')) === 'fake reply'
		&& gitStatus(ctx.repo) === before;
	report('保存: 無視されるリポジトリはリポジトリの中に保存し、SAVED は相対パス', ok, `(code=${r.code} saved=${saved} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('保存: 無視されるリポジトリはリポジトリの中に保存し、SAVED は相対パス', false, String(e.message));
}

// 2. 無視されないリポジトリ：リポジトリに何も作らず、一時ディレクトリに保存する。続けて呼ぶと連番が続く（テスト3）
try {
	const ctx = makeRepo();
	commitAll(ctx.git, 'init');
	const before = gitStatus(ctx.repo);
	const r1 = runRaw(reviewArgs(ctx.repo), ctx.repo, ctx.env);
	const s1 = savedPath(r1.stdout);
	const ok1 = r1.code === 0
		&& isUnderTemp(s1)
		&& path.basename(s1) === '01-review.md'
		&& readReply(s1) === 'fake reply'
		&& r1.stderr.includes(NOTICE)
		&& !fs.existsSync(path.join(ctx.repo, 'docs'))
		&& gitStatus(ctx.repo) === before;
	report('保存: 無視されないリポジトリは一時ディレクトリに保存し、リポジトリに何も作らない', ok1, `(code=${r1.code} saved=${s1} stderr=${r1.stderr.trim().slice(0, 200)})`);

	// 3. 同じリポジトリでもう一度呼ぶ：連番が一時ディレクトリでも続く
	const r2 = runRaw(reviewArgs(ctx.repo), ctx.repo, ctx.env);
	const s2 = savedPath(r2.stdout);
	const ok2 = r2.code === 0
		&& isUnderTemp(s2)
		&& path.basename(s2) === '02-review.md'
		&& readReply(s2) === 'fake reply'
		&& r2.stderr.includes(NOTICE)
		&& gitStatus(ctx.repo) === before;
	report('保存: 二回目は一時ディレクトリの 02-review.md に続けて保存し、知らせが出る', ok2, `(code=${r2.code} saved=${s2} stderr=${r2.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('保存: 無視されないリポジトリは一時ディレクトリに保存し、リポジトリに何も作らない', false, String(e.message));
	report('保存: 二回目は一時ディレクトリの 02-review.md に続けて保存し、知らせが出る', false, String(e.message));
}

// 4. 除外の除外：仮の名前は無視されるが、review の返事の名前は無視されない
try {
	const ctx = makeRepo();
	ctx.write('.gitignore', 'docs/tasks/*/codex/*\n!docs/tasks/*/codex/*-review.md\n');
	commitAll(ctx.git, 'ignore');
	const before = gitStatus(ctx.repo);
	const r = runRaw(reviewArgs(ctx.repo), ctx.repo, ctx.env);
	const s = savedPath(r.stdout);
	const ok = r.code === 0 && isUnderTemp(s) && readReply(s) === 'fake reply' && gitStatus(ctx.repo) === before;
	report('保存: 除外の除外で review の名前が無視されないなら一時ディレクトリに保存する', ok, `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('保存: 除外の除外で review の名前が無視されないなら一時ディレクトリに保存する', false, String(e.message));
}

// 5. Git のリポジトリでないディレクトリから image で呼ぶ：docs/ を作らず、一時ディレクトリに保存する
try {
	const dir = path.join(root, 'nogit');
	fs.mkdirSync(dir, { recursive: true });
	const prompt = path.join(root, 'prompt-5.md');
	fs.writeFileSync(prompt, '画像を作って\n');
	const img = path.join(root, 'ref-5.png');
	fs.writeFileSync(img, 'x');
	const env = buildEnv(path.join(root, 'mark-5.txt'));
	const r = runRaw(['-Mode', 'image', '-Task', 't', '-PromptFile', prompt, '-WorkingDirectory', dir, '-Image', img], dir, env);
	const s = savedPath(r.stdout);
	// 偽物の codex は IMAGE_PATH の行を書かないので、ラッパーは終了コード 2 で止まる（保存のあとで）
	const ok = r.code === 2
		&& isUnderTemp(s)
		&& readReply(s) === 'fake reply'
		&& r.stderr.includes(NOTICE)
		&& !fs.existsSync(path.join(dir, 'docs'));
	report('保存: Git のリポジトリでない image は docs/ を作らず一時ディレクトリに保存する', ok, `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('保存: Git のリポジトリでない image は docs/ を作らず一時ディレクトリに保存する', false, String(e.message));
}

// 6. 親の違う同じ名前のリポジトリ2つ：保存先が混ざらない
try {
	const a = makeRepo(path.join('a', 'same'));
	commitAll(a.git, 'init');
	const b = makeRepo(path.join('b', 'same'));
	commitAll(b.git, 'init');
	const ra = runRaw(reviewArgs(a.repo), a.repo, a.env);
	const rb = runRaw(reviewArgs(b.repo), b.repo, b.env);
	const sa = savedPath(ra.stdout);
	const sb = savedPath(rb.stdout);
	const ok = ra.code === 0 && rb.code === 0
		&& isUnderTemp(sa) && isUnderTemp(sb)
		&& path.dirname(sa) !== path.dirname(sb)
		&& path.basename(sa) === '01-review.md' && path.basename(sb) === '01-review.md'
		&& readReply(sa) === 'fake reply' && readReply(sb) === 'fake reply';
	report('保存: 親の違う同じ名前のリポジトリは、一時ディレクトリの保存先が混ざらない', ok, `(a=${sa} b=${sb})`);
} catch (e) {
	report('保存: 親の違う同じ名前のリポジトリは、一時ディレクトリの保存先が混ざらない', false, String(e.message));
}

// 7. worktree から呼ぶ：無視されているかはメインのチェックアウトで判定する（そこには行が無い）
try {
	const main = makeRepo();
	commitAll(main.git, 'init');
	const wt = path.join(root, 'wt-7');
	gitIn(main.repo, main.env, 'worktree', 'add', '-q', '-b', 'feature', wt);
	fs.writeFileSync(path.join(wt, '.gitignore'), 'docs/tasks/*/codex/\n');
	gitIn(wt, main.env, 'add', '-A');
	gitIn(wt, main.env, 'commit', '-q', '-m', 'ignore');
	const beforeMain = gitStatus(main.repo);
	const beforeWt = gitStatus(wt);
	const r = runRaw(reviewArgs(wt), wt, main.env);
	const s = savedPath(r.stdout);
	const ok = r.code === 0
		&& isUnderTemp(s)
		&& readReply(s) === 'fake reply'
		&& !fs.existsSync(path.join(main.repo, 'docs'))
		&& gitStatus(main.repo) === beforeMain
		&& gitStatus(wt) === beforeWt;
	report('保存: worktree から呼ぶと、無視されているかはメインのチェックアウトで判定する', ok, `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('保存: worktree から呼ぶと、無視されているかはメインのチェックアウトで判定する', false, String(e.message));
}

// ---- save-code-review（/code-review の結果を保存するだけ。codex は呼ばない）----
const saveBody = '2026-10-12 /code-review high plan.md\n{"findings": []}\n日本語の中身\n';
const saveInput = path.join(root, 'save-input.md');
fs.writeFileSync(saveInput, saveBody);
const emptyInput = path.join(root, 'save-empty.md');
fs.writeFileSync(emptyInput, '  \n');

function saveArgs(repo, { stage = 'plan', input = saveInput } = {}) {
	const args = ['-Mode', 'save-code-review', '-Task', 't', '-WorkingDirectory', repo];
	if (stage !== null) args.push('-Stage', stage);
	if (input !== null) args.push('-InputFile', input);
	return args;
}
// codex も node も PATH に無い環境（git と PowerShell だけ）
function envWithoutCodexAndNode(env) {
	const e = { ...env };
	e.PATH = [gitDir, path.join(sysRoot, 'System32'), psDir].join(';');
	return e;
}

// S1. 無視されるリポジトリ：docs/tasks/t/code-review/01-plan.md に中身をそのまま保存し、SAVED は相対パス。2回目は 02-plan.md。codex は呼ばれない
try {
	const ctx = makeRepo();
	ctx.write('.gitignore', 'docs/tasks/*/code-review/\n');
	commitAll(ctx.git, 'ignore');
	const before = gitStatus(ctx.repo);
	const r1 = runRaw(saveArgs(ctx.repo), ctx.repo, ctx.env);
	const s1 = savedPath(r1.stdout);
	const body1 = fs.existsSync(path.join(ctx.repo, 'docs', 'tasks', 't', 'code-review', '01-plan.md'))
		? fs.readFileSync(path.join(ctx.repo, 'docs', 'tasks', 't', 'code-review', '01-plan.md'), 'utf8') : null;
	const ok1 = r1.code === 0 && s1 === 'docs/tasks/t/code-review/01-plan.md' && body1 === saveBody && !fs.existsSync(ctx.mark) && gitStatus(ctx.repo) === before;
	report('save-code-review: 無視されるリポジトリは docs/tasks/t/code-review/01-plan.md に中身のまま保存し、SAVED は相対パス。codex は呼ばれない', ok1, `(code=${r1.code} saved=${s1} stderr=${r1.stderr.trim().slice(0, 200)})`);
	const r2 = runRaw(saveArgs(ctx.repo), ctx.repo, ctx.env);
	const s2 = savedPath(r2.stdout);
	report('save-code-review: 2回目は 02-plan.md になる', r2.code === 0 && s2 === 'docs/tasks/t/code-review/02-plan.md', `(code=${r2.code} saved=${s2} stderr=${r2.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('save-code-review: 無視されるリポジトリは docs/tasks/t/code-review/01-plan.md に中身のまま保存し、SAVED は相対パス。codex は呼ばれない', false, String(e.message));
	report('save-code-review: 2回目は 02-plan.md になる', false, String(e.message));
}

// S2. 無視されないリポジトリ：<一時ディレクトリ>/code-review-replies/…/t/01-plan.md に保存し、リポジトリに何も作らない
try {
	const ctx = makeRepo();
	commitAll(ctx.git, 'init');
	const before = gitStatus(ctx.repo);
	const r = runRaw(saveArgs(ctx.repo), ctx.repo, ctx.env);
	const s = savedPath(r.stdout);
	const ok = r.code === 0
		&& isUnderTemp(s)
		&& s.includes(`${path.sep}code-review-replies${path.sep}`)
		&& path.basename(path.dirname(s)) === 't'
		&& path.basename(s) === '01-plan.md'
		&& fs.readFileSync(s, 'utf8') === saveBody
		&& !fs.existsSync(path.join(ctx.repo, 'docs'))
		&& !fs.existsSync(ctx.mark)
		&& gitStatus(ctx.repo) === before;
	report('save-code-review: 無視されないリポジトリは code-review-replies の下に保存し、リポジトリに何も作らない', ok, `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('save-code-review: 無視されないリポジトリは code-review-replies の下に保存し、リポジトリに何も作らない', false, String(e.message));
}

// S3. codex も node も PATH に無くても保存できる
try {
	const ctx = makeRepo();
	ctx.write('.gitignore', 'docs/tasks/*/code-review/\n');
	commitAll(ctx.git, 'ignore');
	const env = envWithoutCodexAndNode(ctx.env);
	const probe = spawnSync(psExe, ['-NoProfile', '-Command', 'if ((Get-Command codex -ErrorAction SilentlyContinue) -or (Get-Command node -ErrorAction SilentlyContinue)) { exit 1 } else { exit 0 }'], { env, encoding: 'utf8' });
	if (probe.status !== 0) throw new Error('子のプロセスの PATH から codex・node を外せていません');
	const r = runRaw(saveArgs(ctx.repo), ctx.repo, env);
	const s = savedPath(r.stdout);
	report('save-code-review: codex も node も PATH に無くても保存できる', r.code === 0 && s === 'docs/tasks/t/code-review/01-plan.md', `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('save-code-review: codex も node も PATH に無くても保存できる', false, String(e.message));
}

// S4. 設定ファイル（.claude/ai-team.json）が壊れていても保存できる
try {
	const ctx = makeRepo();
	ctx.write('.claude/ai-team.json', '{ not json');
	ctx.write('.gitignore', 'docs/tasks/*/code-review/\n');
	commitAll(ctx.git, 'init');
	const r = runRaw(saveArgs(ctx.repo), ctx.repo, ctx.env);
	const s = savedPath(r.stdout);
	report('save-code-review: 設定ファイルが壊れていても保存できる', r.code === 0 && s === 'docs/tasks/t/code-review/01-plan.md', `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
} catch (e) {
	report('save-code-review: 設定ファイルが壊れていても保存できる', false, String(e.message));
}

// S5. 止まる：-Stage が無い・plan でない、-InputFile が無い・空（終了コード 1。何も保存しない）
for (const [label, opts] of [
	['-Stage が無い', { stage: null }],
	['-Stage が plan・pr・check のどれでもない', { stage: 'pr-before' }],
	['-InputFile が無い', { input: null }],
	['-InputFile のファイルが見つからない', { input: path.join(root, 'no-such-input.md') }],
	['-InputFile が空', { input: emptyInput }],
]) {
	const name = `save-code-review: 止まる（${label}）`;
	try {
		const ctx = makeRepo();
		ctx.write('.gitignore', 'docs/tasks/*/code-review/\n');
		commitAll(ctx.git, 'ignore');
		const r = runRaw(saveArgs(ctx.repo, opts), ctx.repo, ctx.env);
		const ok = r.code === 1 && !fs.existsSync(path.join(ctx.repo, 'docs')) && savedPath(r.stdout) === null;
		report(name, ok, `(code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// S6. -Stage pr と check で保存できる（<連番>-pr.md・<連番>-check.md）
for (const stage of ['pr', 'check']) {
	const name = `save-code-review: -Stage ${stage} で 01-${stage}.md に保存できる`;
	try {
		const ctx = makeRepo();
		ctx.write('.gitignore', 'docs/tasks/*/code-review/\n');
		commitAll(ctx.git, 'ignore');
		const r = runRaw(saveArgs(ctx.repo, { stage }), ctx.repo, ctx.env);
		const s = savedPath(r.stdout);
		const file = path.join(ctx.repo, 'docs', 'tasks', 't', 'code-review', `01-${stage}.md`);
		const ok = r.code === 0 && s === `docs/tasks/t/code-review/01-${stage}.md` && fs.existsSync(file) && fs.readFileSync(file, 'utf8') === saveBody && !fs.existsSync(ctx.mark);
		report(name, ok, `(code=${r.code} saved=${s} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// ---- make-patch（コミットの前の差分をパッチのファイルにするだけ。codex は呼ばない）----
function envWithGitConfig(env, pairs) {
	const e = { ...env };
	let n = Number(e.GIT_CONFIG_COUNT || '0');
	for (const [k, v] of pairs) {
		e[`GIT_CONFIG_KEY_${n}`] = k;
		e[`GIT_CONFIG_VALUE_${n}`] = v;
		n++;
	}
	e.GIT_CONFIG_COUNT = String(n);
	return e;
}
function runPatch(ctx, { env = ctx.env, workDir = ctx.repo, omitOut = false, wrapperPath = wrapper } = {}) {
	const out = path.join(root, `patch-${caseNo}-${Math.random().toString(16).slice(2, 8)}.patch`);
	const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath, '-Mode', 'make-patch', '-Task', 't', '-WorkingDirectory', workDir];
	if (!omitOut) args.push('-OutFile', out);
	const r = spawnSync(psExe, args, { cwd: workDir, env, encoding: 'utf8' });
	return {
		code: r.status,
		stderr: r.stderr || '',
		stdout: r.stdout || '',
		called: fs.existsSync(ctx.mark),
		out,
		wrote: fs.existsSync(out),
		text: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '',
	};
}
function patchCase(name, fn) {
	try {
		const [ok, detail] = fn();
		report(`make-patch: ${name}`, ok, detail);
	} catch (e) {
		report(`make-patch: ${name}`, false, String(e.message));
	}
}
const short = (r) => `(code=${r.code} called=${r.called} wrote=${r.wrote} stderr=${r.stderr.trim().slice(0, 200)})`;
const baseLines = 'one\ntwo\nthree\n';
const editedLines = 'one\nthree\nfour\n';

// 消した行・足した行と未追跡のファイルが入る。codex は呼ばれず、PATCH: と FILES: が出て、インデックスは変わらない
patchCase('書き換え（消した行・足した行）と未追跡のファイルがパッチに入る。codex は呼ばれず、インデックスも変わらない', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	ctx.write('new.txt', 'brand new\n');
	const before = gitStatus(ctx.repo);
	const r = runPatch(ctx);
	const ok = r.code === 0 && !r.called && r.wrote
		&& /^-two$/m.test(r.text) && /^\+four$/m.test(r.text)
		&& r.text.includes('new file mode') && r.text.includes('+++ b/new.txt') && r.text.includes('+brand new')
		&& r.stdout.includes(`PATCH: ${r.out}`) && /^FILES: 2$/m.test(r.stdout)
		&& gitStatus(ctx.repo) === before;
	return [ok, `${short(r)} stdout=${r.stdout.trim().slice(0, 100)}`];
});

patchCase('codex が PATH に無くても作れる', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	// node だけを呼べる場所を作る（node のある場所に codex があるかもしれないため、そこは PATH に入れない）
	const nodeOnly = path.join(root, `node-only-${caseNo}`);
	fs.mkdirSync(nodeOnly);
	fs.writeFileSync(path.join(nodeOnly, 'node.cmd'), `@echo off\r\n"${process.execPath}" %*\r\nexit /b %errorlevel%\r\n`);
	const env = { ...ctx.env, PATH: [nodeOnly, gitDir, path.join(sysRoot, 'System32'), psDir].join(';') };
	const probe = spawnSync(psExe, ['-NoProfile', '-Command', 'if (Get-Command codex -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }'], { env, encoding: 'utf8' });
	if (probe.status !== 0) throw new Error('子のプロセスの PATH から codex を外せていません');
	const r = runPatch(ctx, { env });
	return [r.code === 0 && r.wrote && /^-two$/m.test(r.text), short(r)];
});

patchCase('-OutFile に書いたパッチは、確かめの一時ディレクトリの削除で消えない', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	const r = runPatch(ctx);
	const printed = (r.stdout.match(/^PATCH: (.+?)\s*$/m) || [])[1];
	return [r.code === 0 && printed === r.out && fs.existsSync(printed), short(r)];
});

patchCase('docs/tasks/<Task>/ の下の書き換え・未追跡のファイルは、パッチに入らない', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	ctx.write('docs/tasks/t/plan.md', 'plan\n');
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	ctx.write('docs/tasks/t/plan.md', 'plan changed\n');
	ctx.write('docs/tasks/t/review.md', 'review\n');
	ctx.write('docs/tasks/other/x.md', 'other task\n');
	const r = runPatch(ctx);
	const ok = r.code === 0 && r.text.includes('a.txt') && !r.text.includes('docs/tasks/t/') && r.text.includes('docs/tasks/other/x.md');
	return [ok, short(r)];
});

patchCase('color.diff=always でも、色の制御文字が入らず、消した行が - で始まる', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	ctx.write('new.txt', 'brand new\n');
	const env = envWithGitConfig(ctx.env, [['color.diff', 'always'], ['color.ui', 'always']]);
	const r = runPatch(ctx, { env });
	return [r.code === 0 && !r.text.includes('\u001b') && /^-two$/m.test(r.text) && r.text.includes('+brand new'), short(r)];
});

patchCase('diff.external（中身を出さない外部の diff）を付けても、消した行が残る', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	const env = envWithGitConfig(ctx.env, [['diff.external', 'node -e 0']]);
	// 前提：付けないで git diff を打つと、外部の diff に取られて消した行が出ない
	const plain = spawnSync('git', ['diff', 'HEAD'], { cwd: ctx.repo, env, encoding: 'utf8' });
	if (/^-two$/m.test(plain.stdout || '')) throw new Error('前提が崩れています：diff.external が効いていません');
	const r = runPatch(ctx, { env });
	return [r.code === 0 && /^-two$/m.test(r.text), short(r)];
});

patchCase('.gitattributes の diff= と textconv（中身を変える）を付けても、消した行が残る', () => {
	const ctx = makeRepo();
	ctx.write('.gitattributes', '*.txt diff=conv\n');
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	const env = envWithGitConfig(ctx.env, [['diff.conv.textconv', 'node -e 0']]);
	const plain = spawnSync('git', ['diff', 'HEAD'], { cwd: ctx.repo, env, encoding: 'utf8' });
	if (/^-two$/m.test(plain.stdout || '')) throw new Error('前提が崩れています：textconv が効いていません');
	const r = runPatch(ctx, { env });
	return [r.code === 0 && /^-two$/m.test(r.text), short(r)];
});

// サブモジュール（作れない環境では飛ばす）
function makeSubmoduleCtx() {
	const ctx = makeRepo();
	const subSrc = path.join(root, `subsrc-${caseNo}`);
	fs.mkdirSync(subSrc, { recursive: true });
	gitIn(subSrc, ctx.env, 'init', '-q', '-b', 'main');
	fs.writeFileSync(path.join(subSrc, 'inner.txt'), 'inner one\n');
	gitIn(subSrc, ctx.env, 'add', '-A');
	gitIn(subSrc, ctx.env, 'commit', '-q', '-m', 's');
	// git submodule は sh のスクリプトなので、Git の bin・usr\bin を PATH に足した環境で打つ（ラッパーを呼ぶ環境には足さない）
	let gitRoot = gitDir;
	for (let up = 0; up < 4 && !fs.existsSync(path.join(gitRoot, 'usr', 'bin', 'sh.exe')); up++) gitRoot = path.dirname(gitRoot);
	const envSh = { ...ctx.env, PATH: [ctx.env.PATH, path.join(gitRoot, 'bin'), path.join(gitRoot, 'usr', 'bin')].join(';') };
	gitIn(ctx.repo, envSh, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', subSrc, 'sub');
	commitAll(ctx.git, 'add sub');
	// サブモジュールの中で、新しいコミットと未追跡の .env を作る（親から見ると参照が変わる）
	const sub = path.join(ctx.repo, 'sub');
	fs.writeFileSync(path.join(sub, 'inner.txt'), 'INNER_CONTENT_MARKER\n');
	gitIn(sub, ctx.env, 'add', '-A');
	gitIn(sub, ctx.env, 'commit', '-q', '-m', 'inner change');
	fs.writeFileSync(path.join(sub, '.env'), 'INNER_SECRET=1\n');
	return ctx;
}
let submoduleOk = true;
try {
	makeSubmoduleCtx();
} catch {
	submoduleOk = false;
}
if (!submoduleOk) {
	console.log('skip make-patch のサブモジュールの確かめ（サブモジュールを作れない環境）');
} else {
	patchCase('diff.ignoreSubmodules=all でも、サブモジュールの参照の変更がパッチに入る', () => {
		const ctx = makeSubmoduleCtx();
		const env = envWithGitConfig(ctx.env, [['diff.ignoreSubmodules', 'all']]);
		const r = runPatch(ctx, { env });
		return [r.code === 0 && r.text.includes('Subproject commit'), short(r)];
	});
	patchCase('diff.submodule=diff でも、サブモジュールの中の変更・未追跡の .env はパッチに入らない', () => {
		const ctx = makeSubmoduleCtx();
		const env = envWithGitConfig(ctx.env, [['diff.submodule', 'diff']]);
		const r = runPatch(ctx, { env });
		return [r.code === 0 && r.text.includes('Subproject commit') && !r.text.includes('INNER_CONTENT_MARKER') && !r.text.includes('INNER_SECRET'), short(r)];
	});
}

// 名前の変更
for (const renames of ['true', 'false']) {
	patchCase(`名前の変更は「名前を変えた」の形で、ファイル全体が2回入らない（diff.renames=${renames}）`, () => {
		const ctx = makeRepo();
		ctx.write('old-name.txt', Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n');
		commitAll(ctx.git, 'init');
		ctx.git('mv', 'old-name.txt', 'new-name.txt');
		ctx.write('new-name.txt', Array.from({ length: 30 }, (_, i) => (i === 5 ? 'line five changed' : `line ${i}`)).join('\n') + '\n');
		const env = envWithGitConfig(ctx.env, [['diff.renames', renames]]);
		const r = runPatch(ctx, { env });
		const ok = r.code === 0 && r.text.includes('rename from old-name.txt') && r.text.includes('rename to new-name.txt')
			&& !r.text.includes('deleted file mode') && (r.text.match(/line 20/g) || []).length === 0;
		return [ok, short(r)];
	});
}

// 止まる
function patchStop(name, setup, { word = '', env = null, code = null } = {}) {
	patchCase(`止まる: ${name}`, () => {
		const ctx = makeRepo();
		const extra = setup(ctx) || {};
		const r = runPatch(ctx, { env: extra.env || env || ctx.env, ...(extra.opts || {}) });
		const codeOk = code === null ? (r.code !== 0 && r.code !== 4) : r.code === code;
		return [!r.called && !r.wrote && codeOk && (word === '' || r.stderr.includes(word)), short(r)];
	});
}
patchStop('未追跡の .env.local（既定の秘密情報）', ({ git, write }) => {
	write('a.txt', baseLines);
	commitAll(git, 'init');
	write('.env.local', 'S=1\n');
}, { word: '秘密情報' });
patchStop('名前を変えた元の名前が秘密情報（git mv .env a.txt）', ({ git, write }) => {
	write('.env', envBody);
	commitAll(git, 'init');
	git('mv', '.env', 'a.txt');
}, { word: '秘密情報' });
patchStop('設定ファイルが壊れている', ({ git, write }) => {
	write('.claude/ai-team.json', '{ not json');
	write('a.txt', baseLines);
	commitAll(git, 'init');
	write('a.txt', editedLines);
}, { word: '壊れている' });
patchStop('設定ファイルの secretPatterns に当たる未追跡のファイル', ({ git, write }) => {
	write('.claude/ai-team.json', wrangler);
	commitAll(git, 'init');
	write('.wrangler/state.json', 's\n');
}, { word: '秘密情報' });
patchStop('-OutFile が無い', ({ git, write }) => {
	write('a.txt', baseLines);
	commitAll(git, 'init');
	write('a.txt', editedLines);
	return { opts: { omitOut: true } };
}, { word: '-OutFile', code: 1 });
patchStop('コミットが1つも無いリポジトリ（HEAD が無い）は、終了コード 1（4 にならない）', () => {}, { code: 1 });
patchStop('未追跡の入れ子のリポジトリ（nested/）がある', (ctx) => {
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	const nested = path.join(ctx.repo, 'nested');
	fs.mkdirSync(nested);
	gitIn(nested, ctx.env, 'init', '-q', '-b', 'main');
	fs.writeFileSync(path.join(nested, 'n.txt'), 'n\n');
	gitIn(nested, ctx.env, 'add', '-A');
	gitIn(nested, ctx.env, 'commit', '-q', '-m', 'n');
	ctx.write('a.txt', editedLines);
}, { code: 1, word: 'ふつうのファイルではない' });
patchStop('git ls-files だけが失敗する（先に打つ git status・git diff は成功する）', (ctx) => {
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	const fake = path.join(root, `fake-git-${caseNo}`);
	fs.mkdirSync(fake);
	fs.writeFileSync(path.join(fake, 'git.cmd'), [
		'@echo off',
		':loop',
		'if "%~1"=="" goto run',
		'if "%~1"=="ls-files" exit /b 1',
		'shift',
		'goto loop',
		':run',
		`"${path.join(gitDir, 'git.exe')}" %*`,
		'exit /b %errorlevel%',
		'',
	].join('\r\n'));
	return { env: { ...ctx.env, PATH: `${fake};${ctx.env.PATH}` } };
}, { code: 1, word: 'ls-files' });
patchStop('git diff --no-index がエラーを出して 1 を返す（先に打つ git status・git diff・ls-files は成功する）', (ctx) => {
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('a.txt', editedLines);
	ctx.write('new.txt', 'brand new\n');
	const fake = path.join(root, `fake-git-${caseNo}`);
	fs.mkdirSync(fake);
	fs.writeFileSync(path.join(fake, 'git.cmd'), [
		'@echo off',
		':loop',
		'if "%~1"=="" goto run',
		'if "%~1"=="--no-index" goto fail',
		'shift',
		'goto loop',
		':fail',
		'echo fatal: simulated no-index failure 1>&2',
		'exit /b 1',
		':run',
		`"${path.join(gitDir, 'git.exe')}" %*`,
		'exit /b %errorlevel%',
		'',
	].join('\r\n'));
	return { env: { ...ctx.env, PATH: `${fake};${ctx.env.PATH}` } };
}, { code: 1, word: 'simulated no-index failure' });

// 親のディレクトリが .kv/ へのジャンクション（作れない環境では飛ばす）
{
	let skipped = false;
	patchCase('止まる: 親のディレクトリが .kv/ へのジャンクションで、その下のファイルを書き換えた', () => {
		const ctx = makeRepo();
		ctx.write('.gitignore', '.kv/\n');
		ctx.write('.kv/a.md', 'secret\n');
		commitAll(ctx.git, 'init');
		try {
			fs.symlinkSync(path.join(ctx.repo, '.kv'), path.join(ctx.repo, 'vault'), 'junction');
		} catch {
			skipped = true;
			return [true, ''];
		}
		ctx.write('.kv/a.md', 'secret changed\n');
		const listed = gitStatus(ctx.repo);
		if (!listed.includes('vault')) {
			skipped = true;
			return [true, ''];
		}
		const r = runPatch(ctx);
		return [!r.called && !r.wrote && r.code !== 0 && r.code !== 4 && r.stderr.includes('秘密情報'), `${short(r)} status=${listed.trim().slice(0, 100)}`];
	});
	if (skipped) console.log('skip make-patch のジャンクションの確かめ（ジャンクションを作れない・Git がジャンクションの下を変更として見ない環境）');
}

// 変更が無い
patchCase('変更が無いときは終了コード 4 で、-OutFile を書かない', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	const r = runPatch(ctx);
	return [r.code === 4 && !r.wrote && !r.called, short(r)];
});
patchCase('docs/tasks/<Task>/ の下だけが変わったときも終了コード 4 で、-OutFile を書かない', () => {
	const ctx = makeRepo();
	ctx.write('docs/tasks/t/plan.md', 'plan\n');
	commitAll(ctx.git, 'init');
	ctx.write('docs/tasks/t/plan.md', 'plan changed\n');
	ctx.write('docs/tasks/t/review.md', 'review\n');
	const r = runPatch(ctx);
	return [r.code === 4 && !r.wrote, short(r)];
});

// 名前が - の未追跡のファイル
patchCase('名前が - の未追跡のファイル：入力待ちにならず、中身がパッチに入る', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('-', 'DASH_FILE_CONTENT\n');
	const r = runPatch(ctx);
	return [r.code === 0 && r.text.includes('DASH_FILE_CONTENT'), short(r)];
});

// 日本語・空白のパス
patchCase('日本語・空白のパスの未追跡のファイルが、化けずにパッチに入る', () => {
	const ctx = makeRepo();
	ctx.write('a.txt', baseLines);
	commitAll(ctx.git, 'init');
	ctx.write('メモ 一覧.txt', '日本語の中身\n');
	const r = runPatch(ctx);
	return [r.code === 0 && r.text.includes('メモ 一覧.txt') && r.text.includes('+日本語の中身'), short(r)];
});

// worktree から呼ぶ
patchCase('worktree を作業の根にして呼べる', () => {
	const main = makeRepo();
	main.write('a.txt', baseLines);
	commitAll(main.git, 'init');
	const wt = path.join(root, `wt-patch-${caseNo}`);
	gitIn(main.repo, main.env, 'worktree', 'add', '-q', '-b', 'feature', wt);
	fs.writeFileSync(path.join(wt, 'a.txt'), editedLines);
	const r = runPatch(main, { workDir: wt });
	return [r.code === 0 && /^-two$/m.test(r.text) && !r.called, short(r)];
});

finish();
