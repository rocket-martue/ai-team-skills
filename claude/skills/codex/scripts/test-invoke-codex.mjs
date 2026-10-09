// test-invoke-codex.mjs
// invoke-codex.ps1 の review の前の秘密情報の確かめを、偽物の codex だけで確かめる。
// 本物の健さん（codex）は呼ばない。依存なし（Node.js の標準モジュールだけ）。
//
// 使い方（リポジトリの根から）:
//   node .claude/skills/codex/scripts/test-invoke-codex.mjs
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
	env.PATH = [fakeDir, gitDir, path.join(sysRoot, 'System32'), psDir].join(';');
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

function runWrapper(ctx, base) {
	const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-Mode', 'review', '-Task', 't', '-WorkingDirectory', ctx.repo];
	if (base) args.push('-Base', base);
	const r = spawnSync(psExe, args, { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
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
function expectStop(name, setup, { base = '', word = '秘密情報' } = {}) {
	try {
		const ctx = makeRepo();
		setup(ctx);
		const r = runWrapper(ctx, base);
		const ok = !r.called && r.code !== 0 && r.stderr.includes(word);
		report(`止まる: ${name}`, ok, `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(`止まる: ${name}`, false, String(e.message));
	}
}

// 止まらない：偽物の印がある（健さんを呼ぶところまで進んだ）
function expectPass(name, setup, { base = '' } = {}) {
	try {
		const ctx = makeRepo();
		setup(ctx);
		const r = runWrapper(ctx, base);
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

finish();
