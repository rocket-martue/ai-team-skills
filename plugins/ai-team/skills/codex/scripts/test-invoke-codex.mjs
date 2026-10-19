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
// 子プロセスの TEMP・TMP をここに向ける（ラッパーの一時ファイルが本物の %TEMP% に残らないようにし、消し忘れも確かめるため）
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
	const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath, '-Mode', mode, '-WorkingDirectory', workDir];
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

// サブモジュール（#60）：ignore=all の設定があっても、サブモジュールの変更のパスを照らす。
// 置き場所を秘密情報に当たる名前（.env.sub）にして、変更が拾われれば止まることで確かめる
function addIgnoredSubmodule(ctx) {
	const { git, repo, env } = ctx;
	// git submodule（シェルのスクリプト）も、ローカルの git clone も、テストの絞った PATH では動かない。
	// そこで、置き場所の中で直接 git init し、親から git add して、サブモジュールの参照（gitlink）と .gitmodules を作る
	const inner = path.join(repo, '.env.sub');
	fs.mkdirSync(inner, { recursive: true });
	const ig = (...args) => {
		const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: inner, env, encoding: 'utf8' });
		if (r.status !== 0) throw new Error(`git ${args.join(' ')} が失敗: ${r.stderr}`);
	};
	ig('init', '-q', '-b', 'main');
	fs.writeFileSync(path.join(inner, 'a.txt'), 'a\n');
	ig('add', '-A');
	ig('commit', '-q', '-m', 's1');
	fs.writeFileSync(path.join(repo, '.gitmodules'), '[submodule ".env.sub"]\n\tpath = .env.sub\n\turl = ./.env.sub\n\tignore = all\n');
	git('add', '.gitmodules', '.env.sub');
	git('commit', '-q', '-m', 'add submodule');
	// サブモジュールの中で1つコミットを進める（親から見ると、サブモジュールの参照の変更）
	fs.writeFileSync(path.join(inner, 'a.txt'), 'b\n');
	ig('commit', '-q', '-am', 's2');
	// ignore=all が効いていて、ふつうの git status には出ないことを先に確かめる（直しの前の漏れを再現しているか）
	const r = spawnSync('git', ['status', '--porcelain'], { cwd: repo, env, encoding: 'utf8' });
	if ((r.stdout || '').trim() !== '') throw new Error(`ignore=all が効いていません: ${r.stdout}`);
}

expectStop('サブモジュール：ignore=all でも、未コミットのサブモジュールの変更（.env.sub）を照らす', (ctx) => {
	commitAll(ctx.git, 'init');
	addIgnoredSubmodule(ctx);
}, { word: '.env.sub' });

expectStop('サブモジュール：-Base で、ignore=all でも、コミットしたサブモジュールの更新（.env.sub）を照らす', (ctx) => {
	const { git } = ctx;
	commitAll(git, 'init');
	addIgnoredSubmodule(ctx);
	// サブモジュールを足したところを基準にし、その後のコミットで参照だけを進める
	git('branch', 'base-point');
	git('checkout', '-q', '-b', 'feature');
	git('add', '--force', '.env.sub');
	git('commit', '-q', '-m', 'bump submodule');
}, { base: 'base-point', word: '.env.sub' });

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
for (const [label, body] of [['JSON でない中身', 'API_KEY=abc123secret'], ['大文字小文字違いのキーの中身', '{"SecretPatterns": ["abc123secret"]}'], ['呼び名', '{"names": {"だれか": "abc123secret"}}']]) {
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

expectStop('設定に、知っているキーと大文字小文字だけ違うキー（SecretPatterns）がある: 止まる', ({ git, write }) => {
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

// ---- 返事は標準出力に出すだけ（保存しない）。偽物の codex で、返事を出すまで通す ----
function gitIn(dir, env, ...args) {
	const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, env, encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`git ${args.join(' ')} が失敗: ${r.stderr}`);
	return r.stdout;
}
function gitStatus(ctx) {
	return gitIn(ctx.repo, ctx.env, 'status', '--porcelain', '-uall');
}
// ラッパーは <TEMP>/claude/ の下に一時ディレクトリを作って消す。claude/ そのものは残ってよい
function listTemp() {
	fs.mkdirSync(path.join(tempDir, 'claude'), { recursive: true });
	return [...fs.readdirSync(tempDir), ...fs.readdirSync(path.join(tempDir, 'claude')).map((n) => `claude/${n}`)].sort().join(',');
}

for (const mode of ['review', 'consult']) {
	const name = `返事: ${mode} の返事が標準出力に出て、リポジトリにも一時ディレクトリにも何も残さない`;
	try {
		const ctx = makeRepo();
		commitAll(ctx.git, 'init');
		const before = gitStatus(ctx);
		const tempBefore = listTemp();
		const r = runWrapper(ctx, '', mode);
		const ok = r.code === 0
			&& r.called
			&& /^fake reply\s*$/m.test(r.stdout)
			&& !/^SAVED:/m.test(r.stdout)
			&& gitStatus(ctx) === before
			&& !fs.existsSync(path.join(ctx.repo, 'docs'))
			&& listTemp() === tempBefore;
		report(name, ok, `(code=${r.code} stdout=${r.stdout.trim().slice(0, 200)} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// image：偽物の codex は IMAGE_PATH の行を書かないので、返事を出したあと終了コード 2 で止まる（Git のリポジトリでなくても呼べる）
try {
	const dir = path.join(root, 'nogit');
	fs.mkdirSync(dir, { recursive: true });
	const prompt = path.join(root, 'prompt-image.md');
	fs.writeFileSync(prompt, '画像を作って\n');
	const img = path.join(root, 'ref-image.png');
	fs.writeFileSync(img, 'x');
	const mark = path.join(root, 'mark-image.txt');
	const env = buildEnv(mark);
	const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-Mode', 'image', '-PromptFile', prompt, '-WorkingDirectory', dir, '-Image', img], { cwd: dir, env, encoding: 'utf8' });
	const ok = r.status === 2
		&& fs.existsSync(mark)
		&& /^fake reply\s*$/m.test(r.stdout || '')
		&& (r.stderr || '').includes('IMAGE_PATH')
		&& !fs.existsSync(path.join(dir, 'docs'));
	report('返事: image は IMAGE_PATH が無ければ、返事を出したあと終了コード 2 で止まる', ok, `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
} catch (e) {
	report('返事: image は IMAGE_PATH が無ければ、返事を出したあと終了コード 2 で止まる', false, String(e.message));
}

// 消したモードは受け付けない
for (const mode of ['save-code-review', 'make-patch']) {
	const name = `止まる: 消したモード ${mode} は受け付けない`;
	try {
		const ctx = makeRepo();
		commitAll(ctx.git, 'init');
		const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-Mode', mode, '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
		report(name, r.status !== 0 && !fs.existsSync(ctx.mark), `(code=${r.status})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// check：確かめだけで終わり、codex を呼ばない。設定ファイルが壊れていれば止まる
function runCheck(ctx) {
	const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-Mode', 'check', '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
	return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', called: fs.existsSync(ctx.mark) };
}
{
	const name = 'check: 確かめだけで終わり、CHECK: ok を出し、健さんを呼ばない';
	try {
		const ctx = makeRepo();
		ctx.write('.claude/ai-team.json', j({ secretPatterns: [], plannerWritable: [] }));
		commitAll(ctx.git, 'init');
		ctx.write('.env', 'S=1\n');
		const tempBefore = listTemp();
		const r = runCheck(ctx);
		const ok = r.code === 0 && !r.called && /^CHECK: ok/m.test(r.stdout) && listTemp() === tempBefore;
		report(name, ok, `(code=${r.code} called=${r.called} stdout=${r.stdout.trim().slice(0, 200)} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}
{
	const name = 'check: 設定ファイルが壊れていれば止まり、健さんを呼ばない';
	try {
		const ctx = makeRepo();
		ctx.write('.claude/ai-team.json', '{ not json');
		commitAll(ctx.git, 'init');
		const r = runCheck(ctx);
		report(name, r.code !== 0 && !r.called && r.stderr.includes('壊れている') && !/^CHECK:/m.test(r.stdout), `(code=${r.code} called=${r.called} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// 古い呼び方の互換：-Task を渡されても止めず、何も保存しない
{
	const name = '返事: 古い呼び方（-Task 付き）でも review が通り、何も保存しない';
	try {
		const ctx = makeRepo();
		commitAll(ctx.git, 'init');
		const tempBefore = listTemp();
		const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-Mode', 'review', '-Task', 't', '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
		const ok = r.status === 0
			&& fs.existsSync(ctx.mark)
			&& /^fake reply\s*$/m.test(r.stdout || '')
			&& !fs.existsSync(path.join(ctx.repo, 'docs'))
			&& listTemp() === tempBefore;
		report(name, ok, `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// 呼び名の対応（names。#46）と、これより後の版のキー：どちらも健さんを呼べる
expectPass('設定に names（呼び名の対応）があっても consult が通る', ({ git, write }) => {
	write('.claude/ai-team.json', j({ secretPatterns: [], names: { 健さん: 'ケン', ガネーシャ: 'アヤ' } }));
	commitAll(git, 'init');
}, { mode: 'consult' });

expectPass('設定に知らないキーがあっても読み捨てて consult が通る', ({ git, write }) => {
	write('.claude/ai-team.json', j({ secretPatterns: [], futureKey: [1] }));
	commitAll(git, 'init');
}, { mode: 'consult' });

expectStop('設定の names が壊れている（知らない名前のキー）: 止まる', ({ git, write }) => {
	write('.claude/ai-team.json', j({ names: { だれか: 'x' } }));
	commitAll(git, 'init');
}, { mode: 'consult', word: brokenWord });

// 導入済みのリポジトリの互換：設定に plannerWritable が残っていても、健さんを呼べる
expectPass('設定に plannerWritable が残っていても consult が通る', ({ git, write }) => {
	write('.claude/ai-team.json', j({ secretPatterns: [], plannerWritable: [] }));
	commitAll(git, 'init');
}, { mode: 'consult' });

finish();
