// test-invoke-codex.mjs
// invoke-codex.mjs の review の前の秘密情報の確かめを、偽物の codex だけで確かめる。Windows・Mac・Linux で動く（#100）。
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
const wrapper = path.join(here, 'invoke-codex.mjs');
// 前の呼び方を残すための中継（Windows だけで確かめる）
const wrapperPs1 = path.join(here, 'invoke-codex.ps1');
const isWindows = process.platform === 'win32';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-invoke-codex-'));
const fakeDir = path.join(root, 'fake-bin');
fs.mkdirSync(fakeDir);
// 利用者のグローバルな除外（core.excludesFile）に左右されないよう、空のファイルを指す
const emptyExcludes = path.join(root, 'empty-excludes');
fs.writeFileSync(emptyExcludes, '');
// 子プロセスの TEMP・TMP をここに向ける（ラッパーの一時ファイルが本物の %TEMP% に残らないようにし、消し忘れも確かめるため）
const tempDir = path.join(root, 'tmp');
fs.mkdirSync(tempDir);

// ---- 偽物の codex（呼ばれたら、-o の次の値のファイルに返事を書いて、印のファイル（受け取った引数）を書き、終了コード 0 で終わる） ----
// 返事は FAKE_CODEX_REPLY（無ければ fake reply）。本体は JS で、npm で入れたときと同じ置き場所に置く
// （Windows のラッパーは、シム（codex.cmd）の隣の node_modules/@openai/codex/bin/codex.js を node で起動するため）
const fakeJs = path.join(fakeDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
fs.mkdirSync(path.dirname(fakeJs), { recursive: true });
fs.writeFileSync(fakeJs, [
	"const fs = require('fs');",
	'const args = process.argv.slice(2);',
	// -Container は、この PC の codex の版を聞く（印は書かない。健さんを呼んだことにはしない）
	"if (args[0] === '--version') { process.stdout.write('codex-cli 0.0.1\\n'); process.exit(0); }",
	"const i = args.indexOf('-o');",
	"if (i >= 0 && i + 1 < args.length) fs.writeFileSync(args[i + 1], process.env.FAKE_CODEX_REPLY || 'fake reply');",
	"fs.writeFileSync(process.env.FAKE_CODEX_MARK, ['called', ...args].join(' '));",
	// 引数を配列のままでも残す（空白を含むパスでも、要素ごとに比べられるように）
	"fs.writeFileSync(process.env.FAKE_CODEX_MARK + '.json', JSON.stringify(args));",
	// 返事のファイルを置くディレクトリ（ラッパーの一時ディレクトリ）の権限を、印の隣に書く（Mac・Linux で持ち主だけかを見るため）
	"if (i >= 0 && i + 1 < args.length) fs.writeFileSync(process.env.FAKE_CODEX_MARK + '.dirmode', (fs.statSync(require('path').dirname(args[i + 1])).mode & 0o777).toString(8));",
	'process.exit(0);',
	'',
].join('\n'));
// 本体を CommonJS として読ませる（偽物の置き場所の上の package.json に左右されないように）
fs.writeFileSync(path.join(path.dirname(fakeJs), 'package.json'), '{"type":"commonjs"}\n');
if (isWindows) {
	// npm のシムの形。ラッパーはこれを起動せず、隣の codex.js を node で起動する
	fs.writeFileSync(path.join(fakeDir, 'codex.cmd'), `@"${process.execPath}" "%~dp0\node_modules\@openai\codex\bin\codex.js" %*\r\n`);
} else {
	// 実行できる codex（改行は LF。CRLF だと shebang が壊れる）
	const shim = path.join(fakeDir, 'codex');
	fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${fakeJs}" "$@"\n`);
	fs.chmodSync(shim, 0o755);
}

// ---- 子プロセスの環境（今の PATH・PATHEXT・GIT_ を引き継がず、作り直す） ----
function findGitDir() {
	// where の出力は CP932 のことがあるので使わず、PATH を自分で分けて git を探す
	const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH');
	const name = isWindows ? 'git.exe' : 'git';
	for (const dir of (process.env[pathKey] || '').split(path.delimiter)) {
		if (dir.trim() === '') continue;
		if (fs.existsSync(path.join(dir, name))) return dir;
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
	if (isWindows) {
		env.PATH = [fakeDir, gitDir, path.dirname(process.execPath), path.join(sysRoot, 'System32'), psDir].join(';');
		env.PATHEXT = '.COM;.EXE;.BAT;.CMD;.PS1';
	} else {
		env.PATH = [fakeDir, gitDir, path.dirname(process.execPath), '/usr/bin', '/bin'].join(':');
	}
	// 利用者の diff.renames の設定に左右されないよう、環境変数で固定する
	env.GIT_CONFIG_COUNT = '2';
	env.GIT_CONFIG_KEY_0 = 'diff.renames';
	env.GIT_CONFIG_VALUE_0 = 'true';
	env.GIT_CONFIG_KEY_1 = 'core.excludesFile';
	env.GIT_CONFIG_VALUE_1 = emptyExcludes;
	env.FAKE_CODEX_MARK = mark;
	// 一時ディレクトリの向け先は OS で違う（Windows は TEMP・TMP、Mac・Linux は TMPDIR）。全部向ける
	env.TEMP = tempDir;
	env.TMP = tempDir;
	env.TMPDIR = tempDir;
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
// ラッパー（invoke-codex.mjs）を今の node で呼ぶ
function runNode(wrapperPath, args, opts) {
	return spawnSync(process.execPath, [wrapperPath, ...args], { encoding: 'utf8', ...opts });
}

function runWrapper(ctx, base, mode = 'review', workDir = ctx.repo, wrapperPath = wrapper) {
	const args = ['-Mode', mode, '-WorkingDirectory', workDir];
	if (mode === 'consult') args.push('-PromptFile', promptFile);
	if (base) args.push('-Base', base);
	const r = runNode(wrapperPath, args, { cwd: workDir, env: ctx.env });
	return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '', called: fs.existsSync(ctx.mark) };
}

// ---- 最初の確かめ：子プロセスの PATH で、ラッパーが選ぶ codex が偽物か ----
// ラッパー（invoke-codex.mjs の findCodex）と同じ見方で PATH を前から探す。存在だけでなく「使えるか」まで見る
// （ラッパーは、隣に codex.js の無いシム（Windows）や実行できない codex（Mac・Linux。noexec の一時ディレクトリなど）を飛ばして
// 後ろを探す。node のフォルダに本物の codex があると、そこに届くため）
{
	const env = buildEnv(path.join(root, 'mark-probe.txt'));
	const usable = (dir) => {
		if (isWindows) {
			if (fs.existsSync(path.join(dir, 'codex.exe'))) return true;
			const shim = ['codex.cmd', 'codex.ps1', 'codex'].some((n) => fs.existsSync(path.join(dir, n)));
			return shim && fs.existsSync(path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
		}
		try {
			fs.accessSync(path.join(dir, 'codex'), fs.constants.X_OK);
			return fs.statSync(path.join(dir, 'codex')).isFile();
		} catch {
			return false;
		}
	};
	// 場所の比べ方はラッパーの sameLocation と同じ（大文字小文字は Windows だけそろえる）
	const sameDir = (a, b) => (isWindows ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));
	const first = env.PATH.split(path.delimiter).find((dir) => dir.trim() !== '' && usable(dir)) || null;
	if (first === null || !sameDir(first, fakeDir)) {
		console.error(`ラッパーが選ぶ codex が偽物ではありません（${first}）。本物に届くかもしれないので、ラッパーを呼ばずに落とします。`);
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
	fs.copyFileSync(wrapper, path.join(scripts, 'invoke-codex.mjs'));
	const realHooks = path.join(here, '..', '..', '..', 'hooks');
	const hooks = path.join(tree, 'hooks');
	if (hooksKind === 'junction') {
		fs.symlinkSync(realHooks, hooks, 'junction');
	} else {
		fs.mkdirSync(hooks, { recursive: true });
		fs.writeFileSync(path.join(hooks, 'ai-team-config.mjs'), 'process.exit(0);\n');
	}
	return path.join(scripts, 'invoke-codex.mjs');
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
			&& listTemp() === tempBefore
			// consult は Git のリポジトリでも read-only のまま（#97 で引数を足したときに崩れていないか）
			&& (mode !== 'consult' || / -s read-only /.test(fs.readFileSync(ctx.mark, 'utf8')));
		report(name, ok, `(code=${r.code} stdout=${r.stdout.trim().slice(0, 200)} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// consult：Git のリポジトリでないフォルダでも呼べる（#97）。本物の codex は --skip-git-repo-check が無いと止まるので、渡ったかを印で見る
function runNoGitConsult(name, config) {
	const dir = path.join(root, `nogit-consult-${name}`);
	fs.mkdirSync(dir, { recursive: true });
	if (config !== undefined) {
		fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
		fs.writeFileSync(path.join(dir, '.claude', 'ai-team.json'), config);
	}
	const mark = path.join(root, `mark-nogit-consult-${name}.txt`);
	const env = buildEnv(mark);
	// %TEMP% が Git の作業ツリーの下にある PC でも、テストの外のリポジトリを拾わない
	env.GIT_CEILING_DIRECTORIES = root;
	const r = spawnSync(process.execPath, [wrapper, '-Mode', 'consult', '-PromptFile', promptFile, '-WorkingDirectory', dir], { cwd: dir, env, encoding: 'utf8' });
	return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', called: fs.existsSync(mark), args: fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8') : '', dir };
}
{
	const name = '返事: Git のリポジトリでないフォルダでも consult が通り、--skip-git-repo-check を渡す';
	try {
		const r = runNoGitConsult('pass', j({ secretPatterns: [] }));
		const ok = r.code === 0
			&& r.called
			&& r.args.includes('--skip-git-repo-check')
			&& /^fake reply\s*$/m.test(r.stdout)
			&& !fs.existsSync(path.join(r.dir, 'docs'));
		report(name, ok, `(code=${r.code} args=${r.args.trim().slice(0, 200)} stderr=${r.stderr.trim().slice(0, 200)})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}
{
	const name = '止まる: Git のリポジトリでないフォルダでも、設定が壊れていれば consult は止まる';
	try {
		const r = runNoGitConsult('broken', '{ not json');
		report(name, !r.called && r.code !== 0 && r.stderr.includes(brokenWord), `(called=${r.called} code=${r.code} stderr=${r.stderr.trim().slice(0, 200)})`);
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
	const r = spawnSync(process.execPath, [wrapper, '-Mode', 'image', '-PromptFile', prompt, '-WorkingDirectory', dir, '-Image', img], { cwd: dir, env, encoding: 'utf8' });
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
		const r = spawnSync(process.execPath, [wrapper, '-Mode', mode, '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
		report(name, r.status !== 0 && !fs.existsSync(ctx.mark), `(code=${r.status})`);
	} catch (e) {
		report(name, false, String(e.message));
	}
}

// check：確かめだけで終わり、codex を呼ばない。設定ファイルが壊れていれば止まる
function runCheck(ctx) {
	const r = spawnSync(process.execPath, [wrapper, '-Mode', 'check', '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
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
		const r = spawnSync(process.execPath, [wrapper, '-Mode', 'review', '-Task', 't', '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
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

// ---- codex への引数（-Container を足しても、付けないときの引数が変わらないことの基準。#99） ----
// -o の値（ラッパーの一時ディレクトリ）と -C の値（作業の根）は呼ぶたびに違うので、置き換えてから比べる
function expectArgs(name, mode, base, expected) {
	try {
		const ctx = makeRepo();
		commitAll(ctx.git, 'init');
		if (base) {
			ctx.git('checkout', '-q', '-b', 'feature');
			ctx.write('a.txt', 'a\n');
			commitAll(ctx.git, 'a');
		}
		const r = runWrapper(ctx, base, mode);
		const args = JSON.parse(fs.readFileSync(`${ctx.mark}.json`, 'utf8'));
		const o = args.indexOf('-o');
		if (o >= 0) args[o + 1] = '<out>';
		const c = args.indexOf('-C');
		if (c >= 0 && path.resolve(args[c + 1]) === path.resolve(ctx.repo)) args[c + 1] = '<repo>';
		const ok = r.code === 0 && JSON.stringify(args) === JSON.stringify(expected);
		report(`引数: ${name}`, ok, `(code=${r.code} args=${JSON.stringify(args)})`);
	} catch (e) {
		report(`引数: ${name}`, false, String(e.message));
	}
}

expectArgs('review（-Base 無し）は未コミットの変更を read-only で見る', 'review', '', ['exec', 'review', '--uncommitted', '-c', 'sandbox_mode=read-only', '-o', '<out>']);
expectArgs('review（-Base あり）は基準ブランチとの差分を read-only で見る', 'review', 'main', ['exec', 'review', '--base', 'main', '-c', 'sandbox_mode=read-only', '-o', '<out>']);
expectArgs('consult は read-only で作業の根を読む', 'consult', '', ['exec', '--ephemeral', '--color', 'never', '--skip-git-repo-check', '-s', 'read-only', '-C', '<repo>', '-o', '<out>']);

// ---- コンテナの中のレビュー（-Container。#99）。docker は偽物（本物の Docker も健さんも呼ばない） ----
// 偽物の docker は、テストの一時ディレクトリに作る入口（container-entry.mjs）がラッパーを import して、run() に渡す。
// 受け取った引数を FAKE_DOCKER_LOG に、docker cp でコンテナに写したものを FAKE_DOCKER_CP の下に残す。
// 動きは FAKE_DOCKER_* で変える（テストの入口だけが読む。ラッパーは読まない）
const containerEntry = path.join(root, 'container-entry.mjs');
fs.writeFileSync(containerEntry, `
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from ${JSON.stringify(new URL(`file:///${wrapper.replace(/\\/g, '/').replace(/^\//, '')}`).href)};
const env = process.env;
const calls = [];
const created = {};
let n = 0;
const ok = (s = '') => ({ status: 0, stdout: Buffer.from(s) });
const fail = () => ({ status: 1, stdout: Buffer.alloc(0) });
function fake(args, opts = {}) {
	calls.push(args);
	fs.writeFileSync(env.FAKE_DOCKER_LOG, JSON.stringify(calls));
	const a = args[0] === '--context' ? args.slice(2) : args;
	if (opts.stdio && typeof opts.stdio[1] === 'number') fs.writeSync(opts.stdio[1], 'progress\\n');
	switch (a[0]) {
		case 'context':
			return a[1] === 'show' ? ok('desktop-linux\\n') : ok((env.FAKE_DOCKER_ENDPOINT || 'npipe:////./pipe/fake') + '\\n');
		case 'info':
			if (env.FAKE_ON_INFO) {
				fs.writeFileSync(path.join(process.cwd(), '.dev.vars'), 'S=1\\n');
				spawnSync('git', ['add', '.dev.vars'], { cwd: process.cwd() });
			}
			return env.FAKE_DOCKER_INFO_FAIL ? fail() : ok('27.0\\n');
		case 'image':
			if (a[1] === 'inspect') return env.FAKE_DOCKER_NO_IMAGE ? fail() : ok('[]');
			if (a[1] === 'ls') return ok('ai-team-codex:0.0.1\\nai-team-codex:0.0.0\\n');
			return ok();
		case 'build':
			return ok();
		case 'run':
			return env.FAKE_DOCKER_NO_LOGIN ? fail() : ok('Logged in\\n');
		case 'volume':
			return a[1] === 'rm' && env.FAKE_DOCKER_RM_FAIL ? fail() : ok(a[a.length - 1] + '\\n');
		case 'create':
			n++;
			created['c' + n] = a;
			return ok('c' + n + '\\n');
		case 'cp': {
			const [src, dst] = a.slice(1);
			if (/^c\\d+:/.test(src)) {
				if (env.FAKE_DOCKER_NO_REPLY) return fail();
				fs.writeFileSync(dst, env.FAKE_CODEX_REPLY || 'fake container reply');
				return ok();
			}
			const target = path.join(env.FAKE_DOCKER_CP, dst.replace(/[:/]/g, '_'));
			fs.cpSync(src.replace(/[\\\\/]\\.$/, ''), target, { recursive: true });
			return ok();
		}
		case 'start': {
			const isKen = created[a[a.length - 1]].includes('seccomp=unconfined');
			if (!isKen) return env.FAKE_DOCKER_SETUP_FAIL ? fail() : ok();
			return env.FAKE_DOCKER_START_CODE ? { status: Number(env.FAKE_DOCKER_START_CODE), stdout: Buffer.alloc(0) } : ok();
		}
		case 'rm':
			return env.FAKE_DOCKER_RM_FAIL ? fail() : ok();
	}
	return fail();
}
run(process.argv.slice(2), { docker: fake });
`);

// 健さんの決まり（AGENTS.md）。印の行あり・なしの2つ
const codexHomeOk = path.join(root, 'codex-home-ok');
const codexHomeOld = path.join(root, 'codex-home-old');
fs.mkdirSync(codexHomeOk);
fs.mkdirSync(codexHomeOld);
fs.writeFileSync(path.join(codexHomeOk, 'AGENTS.md'), '# 健さん\n\n<!-- ai-team: container-review v1 -->\n## コンテナの中のレビュー\n');
fs.writeFileSync(path.join(codexHomeOld, 'AGENTS.md'), '# 健さん\n');
const containerConfig = j({ secretPatterns: [], container: { setup: 'npm ci', test: 'npm test' } });

function makeContainerRepo() {
	const ctx = makeRepo();
	ctx.write('.claude/ai-team.json', containerConfig);
	ctx.write('package.json', '{"name":"x"}\n');
	commitAll(ctx.git, 'init');
	return ctx;
}

// -Container で呼ぶ。返り値は終了コード・出力・偽物の docker が受けた引数（calls）・写したもの（cpDir）
function runContainer(ctx, { args = ['-Mode', 'review', '-Container'], extraEnv = {}, workDir = ctx.repo } = {}) {
	const cpDir = path.join(root, `cp-${caseNo}`);
	const log = path.join(root, `docker-${caseNo}.json`);
	fs.mkdirSync(cpDir, { recursive: true });
	// 利用者の DOCKER_HOST・DOCKER_CONTEXT は引き継がない（渡したいときは extraEnv で渡す）
	const env = { ...ctx.env };
	delete env.DOCKER_HOST;
	delete env.DOCKER_CONTEXT;
	Object.assign(env, { CODEX_HOME: codexHomeOk, FAKE_DOCKER_LOG: log, FAKE_DOCKER_CP: cpDir, ...extraEnv });
	const r = spawnSync(process.execPath, [containerEntry, ...args, '-WorkingDirectory', workDir], { cwd: ctx.repo, env, encoding: 'utf8' });
	const calls = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, 'utf8')) : [];
	return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', calls, cpDir, called: fs.existsSync(ctx.mark) };
}
// 写したファイルの一覧（cpDir の下の相対パス）
function listCopied(cpDir) {
	const out = [];
	const walk = (d, rel) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const r = rel === '' ? e.name : `${rel}/${e.name}`;
			if (e.isDirectory()) walk(path.join(d, e.name), r);
			else out.push(r);
		}
	};
	if (fs.existsSync(cpDir)) walk(cpDir, '');
	return out.sort();
}
const verb = (calls, v) => calls.filter((c) => (c[0] === '--context' ? c[2] : c[0]) === v);
const detail = (r) => `(code=${r.code} stderr=${r.stderr.trim().slice(0, 300)} calls=${JSON.stringify(r.calls.map((c) => c.slice(0, 4))).slice(0, 300)})`;

function containerCase(name, fn) {
	try {
		const [ok, info] = fn();
		report(`コンテナ: ${name}`, ok, info);
	} catch (e) {
		report(`コンテナ: ${name}`, false, String(e.message));
	}
}

containerCase('通る：準備と健さんのコンテナの形・写したもの・差分・頼みの文・返事・後始末', () => {
	const ctx = makeContainerRepo();
	ctx.write('README.md', 'changed\n');
	ctx.write('docs/新しい ファイル.md', 'new\n');
	const tempBefore = listTemp();
	const r = runContainer(ctx);
	const creates = verb(r.calls, 'create');
	const prep = creates[0] || [];
	const ken = creates[1] || [];
	const copied = listCopied(r.cpDir);
	const diffFile = copied.find((p) => p.endsWith('/review.diff'));
	const promptFile2 = copied.find((p) => p.endsWith('/prompt.md'));
	const diffText = diffFile ? fs.readFileSync(path.join(r.cpDir, diffFile), 'utf8') : '';
	const promptText = promptFile2 ? fs.readFileSync(path.join(r.cpDir, promptFile2), 'utf8') : '';
	const afterInfo = r.calls.slice(r.calls.findIndex((c) => c.includes('info')));
	const ok = r.code === 0
		&& /^fake container reply\s*$/m.test(r.stdout)
		&& !r.called
		&& prep.includes('--rm') && prep.includes('-w') && prep.includes('/work/repo') && !prep.some((x) => String(x).includes('ai-team-codex-home'))
		&& ken.includes('seccomp=unconfined') && ken.includes('/work/repo') && ken.some((x) => String(x) === 'ai-team-codex-home:/root/.codex') && !ken.includes('--rm')
		&& [...prep, ...ken].filter((x) => x === 'ai-team-codex=1').length === 2
		&& ![...prep, ...ken].some((x) => String(x).includes(ctx.repo))
		&& copied.includes('c1__work_repo/package.json') && copied.includes('c1__work_repo/docs/新しい ファイル.md') && copied.includes('c1__work_repo/.claude/ai-team.json')
		&& diffText.startsWith('diff --git a/README.md b/README.md') && diffText.includes('+changed')
		&& promptText.startsWith('ガネーシャから（コンテナの中のレビュー）') && promptText.includes('`npm test`') && promptText.includes('- docs/新しい ファイル.md')
		&& afterInfo.every((c) => c[0] === '--context')
		&& verb(r.calls, 'rm').some((c) => c.includes('c2')) && verb(r.calls, 'volume').some((c) => c.includes('rm'))
		&& listTemp() === tempBefore;
	return [ok, `${detail(r)} copied=${copied.join(',').slice(0, 300)}`];
});

for (const [name, setup, word, extraEnv] of [
	['追跡していて変更の無い wp-config.php', (c) => { c.write('wp-config.php', '<?php\n'); commitAll(c.git, 'wp'); }, '秘密情報'],
	['secretPatterns に当たる、追跡していて変更の無いファイル', (c) => { c.write('.claude/ai-team.json', j({ secretPatterns: ['private/**'], container: { setup: 'npm ci', test: 'npm test' } })); c.write('private/token.json', '{}\n'); commitAll(c.git, 'p'); }, '秘密情報'],
	['サブモジュール（gitlink）', (c) => { c.git('update-index', '--add', '--cacheinfo', `160000,${c.git('rev-parse', 'HEAD').trim()},sub`); }, 'サブモジュール'],
	['未追跡の入れ子のリポジトリ', (c) => { c.write('nested/a.txt', 'a\n'); gitIn(path.join(c.repo, 'nested'), c.env, 'init', '-q'); }, '入れ子'],
	['container の設定が無い', (c) => { c.write('.claude/ai-team.json', j({ secretPatterns: [] })); commitAll(c.git, 'no container'); }, 'container'],
	['AGENTS.md に印の行が無い', () => {}, 'コンテナの中のレビューの節', { CODEX_HOME: codexHomeOld }],
	['DOCKER_CONTEXT がある', () => {}, 'DOCKER_CONTEXT', { DOCKER_CONTEXT: 'remote' }],
	['DOCKER_HOST がこの PC でない', () => {}, 'DOCKER_HOST', { DOCKER_HOST: 'tcp://10.0.0.1:2375' }],
]) {
	containerCase(`止まる（docker を呼ばない）：${name}`, () => {
		const ctx = makeContainerRepo();
		setup(ctx);
		const r = runContainer(ctx, { extraEnv });
		return [r.code !== 0 && r.stderr.includes(word) && r.calls.length === 0 && listCopied(r.cpDir).length === 0, detail(r)];
	});
}

if (!isWindows) {
	containerCase('止まる（docker を呼ばない）：名前に改行を含むファイル', () => {
		const ctx = makeContainerRepo();
		ctx.write('a\nb.txt', 'x\n');
		const r = runContainer(ctx);
		return [r.code !== 0 && r.stderr.includes('制御文字') && r.calls.length === 0, detail(r)];
	});
}

containerCase('止まる（docker を呼ばない）：根より下のリンク（Windows はジャンクション）', () => {
	const ctx = makeContainerRepo();
	const outside = path.join(root, `outside-${caseNo}`);
	fs.mkdirSync(outside);
	fs.writeFileSync(path.join(outside, 'x.txt'), 'outside\n');
	fs.symlinkSync(outside, path.join(ctx.repo, 'linked'), isWindows ? 'junction' : 'dir');
	const r = runContainer(ctx);
	return [r.code !== 0 && r.stderr.includes('リンク') && r.calls.length === 0, detail(r)];
});

containerCase('通る：根より上のリンク（リンク経由の -WorkingDirectory）とサブディレクトリの -WorkingDirectory', () => {
	const ctx = makeContainerRepo();
	ctx.write('sub/a.txt', 'a\n');
	const viaLink = path.join(root, `via-link-${caseNo}`);
	fs.symlinkSync(ctx.repo, viaLink, isWindows ? 'junction' : 'dir');
	const r1 = runContainer(ctx, { workDir: viaLink });
	const r2 = runContainer(ctx, { workDir: path.join(ctx.repo, 'sub') });
	const copied2 = listCopied(r2.cpDir);
	return [r1.code === 0 && r2.code === 0 && copied2.includes('c1__work_repo/package.json'), `${detail(r1)} ${detail(r2)}`];
});

containerCase('通る：名前の確かめの後（docker info の中）で .dev.vars を足しても、写すものと差分に入らない', () => {
	const ctx = makeContainerRepo();
	ctx.write('README.md', 'changed\n');
	const r = runContainer(ctx, { extraEnv: { FAKE_ON_INFO: '1' } });
	const copied = listCopied(r.cpDir);
	const diffFile = copied.find((p) => p.endsWith('/review.diff'));
	const diffText = diffFile ? fs.readFileSync(path.join(r.cpDir, diffFile), 'utf8') : '';
	return [r.code === 0 && !copied.some((p) => p.includes('.dev.vars')) && !diffText.includes('.dev.vars'), `${detail(r)} copied=${copied.join(',')}`];
});

containerCase('通る：-Base の差分に、基準ブランチの後のコミットが入る', () => {
	const ctx = makeContainerRepo();
	ctx.git('checkout', '-q', '-b', 'feature');
	ctx.write('feature.txt', 'feat\n');
	commitAll(ctx.git, 'feat');
	const r = runContainer(ctx, { args: ['-Mode', 'review', '-Base', 'main', '-Container'] });
	const diffFile = listCopied(r.cpDir).find((p) => p.endsWith('/review.diff'));
	const diffText = diffFile ? fs.readFileSync(path.join(r.cpDir, diffFile), 'utf8') : '';
	return [r.code === 0 && diffText.includes('diff --git a/feature.txt b/feature.txt'), detail(r)];
});

containerCase('通る：この PC の git の設定（diff.external・color.ui・diff.noprefix・fsmonitor）で差分の形が変わらず、fsmonitor のフックも動かない', () => {
	const ctx = makeContainerRepo();
	ctx.write('README.md', 'changed\n');
	const marker = path.join(root, `fsmonitor-${caseNo}.txt`);
	const hook = path.join(root, `fsmonitor-${caseNo}.sh`);
	fs.writeFileSync(hook, `#!/bin/sh\necho called > "${marker.replace(/\\/g, '/')}"\n`);
	fs.chmodSync(hook, 0o755);
	ctx.git('config', 'diff.external', 'false');
	ctx.git('config', 'color.ui', 'always');
	ctx.git('config', 'diff.noprefix', 'true');
	ctx.git('config', 'core.fsmonitor', hook.replace(/\\/g, '/'));
	const r = runContainer(ctx);
	const diffFile = listCopied(r.cpDir).find((p) => p.endsWith('/review.diff'));
	const diffText = diffFile ? fs.readFileSync(path.join(r.cpDir, diffFile), 'utf8') : '';
	return [r.code === 0 && diffText.startsWith('diff --git a/README.md b/README.md') && !diffText.includes('\u001b[') && !fs.existsSync(marker), `${detail(r)} marker=${fs.existsSync(marker)}`];
});

containerCase('通る：イメージが無ければプラグインの container/ だけをコンテキストに作り、前の版を消す', () => {
	const ctx = makeContainerRepo();
	const r = runContainer(ctx, { extraEnv: { FAKE_DOCKER_NO_IMAGE: '1' } });
	const build = verb(r.calls, 'build')[0] || [];
	const context = build[build.length - 1] || '';
	return [r.code === 0 && path.basename(context) === 'container' && !context.startsWith(ctx.repo) && build.includes('CODEX_VERSION=0.0.1')
		&& r.calls.some((c) => c.includes('rm') && c.includes('ai-team-codex:0.0.0')) && !r.calls.some((c) => c.includes('rm') && c.includes('ai-team-codex:0.0.1')), detail(r)];
});

containerCase('通る：config.toml の model は sh -c の文字列に入らず、後ろの引数で渡る', () => {
	const ctx = makeContainerRepo();
	const home = path.join(root, `codex-home-model-${caseNo}`);
	fs.mkdirSync(home);
	fs.copyFileSync(path.join(codexHomeOk, 'AGENTS.md'), path.join(home, 'AGENTS.md'));
	fs.writeFileSync(path.join(home, 'config.toml'), "model = \"a'b\"\nmodel_reasoning_effort = \"high\"\n[profiles.x]\nmodel = \"ignored\"\n");
	const r = runContainer(ctx, { extraEnv: { CODEX_HOME: home } });
	const ken = verb(r.calls, 'create')[1] || [];
	const script = ken[ken.indexOf('-c') + 1] || '';
	const tail = ken.slice(ken.lastIndexOf('sh') + 1);
	return [r.code === 0 && !script.includes("a'b") && JSON.stringify(tail) === JSON.stringify(['-c', 'model="a\'b"', '-c', 'model_reasoning_effort="high"']), `${detail(r)} tail=${JSON.stringify(tail)}`];
});

for (const [name, extraEnv, word, wantCreate] of [
	['docker info が失敗する', { FAKE_DOCKER_INFO_FAIL: '1' }, 'docker info', false],
	['向き先がこの PC でない', { FAKE_DOCKER_ENDPOINT: 'ssh://user@remote' }, '向き先', false],
	['コンテナ用のログインが無い', { FAKE_DOCKER_NO_LOGIN: '1' }, 'ログイン', false],
	['準備のコマンドが失敗する', { FAKE_DOCKER_SETUP_FAIL: '1' }, 'container.setup', true],
	['準備が /work/repo をリンクにすり替えた（97）', { FAKE_DOCKER_START_CODE: '97' }, 'すり替え', true],
	['返事が取れない', { FAKE_DOCKER_NO_REPLY: '1' }, '返事', true],
]) {
	containerCase(`止まる：${name}（作ったものは消す）`, () => {
		const ctx = makeContainerRepo();
		const tempBefore = listTemp();
		const r = runContainer(ctx, { extraEnv });
		const creates = verb(r.calls, 'create').length;
		const removedAll = verb(r.calls, 'volume').filter((c) => c.includes('create')).length === verb(r.calls, 'volume').filter((c) => c.includes('rm')).length;
		const ok = r.code !== 0 && r.stderr.includes(word) && (wantCreate ? creates > 0 : creates === 0) && removedAll && listTemp() === tempBefore
			&& (!wantCreate || name.includes('準備のコマンド') || verb(r.calls, 'rm').some((c) => c.includes('c2')));
		return [ok, detail(r)];
	});
}

containerCase('後始末に失敗したら、残ったものと消し方を出す（終了コードは変えない）', () => {
	const ctx = makeContainerRepo();
	const r = runContainer(ctx, { extraEnv: { FAKE_DOCKER_RM_FAIL: '1' } });
	return [r.code === 0 && r.stderr.includes('消せなかった') && r.stderr.includes('docker rm -f c2') && r.stderr.includes('docker volume rm'), detail(r)];
});

containerCase('check -Container はイメージとログインを確かめるだけ（コンテナを作らず、健さんも呼ばない）', () => {
	const ctx = makeContainerRepo();
	const r = runContainer(ctx, { args: ['-Container', '-Mode', 'check'] });
	return [r.code === 0 && r.stdout.includes('CHECK: ok') && verb(r.calls, 'create').length === 0 && verb(r.calls, 'run').length === 1 && !r.called, detail(r)];
});

containerCase('-Container は consult に付けられない', () => {
	const ctx = makeContainerRepo();
	const r = runContainer(ctx, { args: ['-Mode', 'consult', '-PromptFile', promptFile, '-Container'] });
	return [r.code !== 0 && r.stderr.includes('review と check だけ') && r.calls.length === 0, detail(r)];
});

containerCase('worktree から呼んでも、メインのチェックアウトから呼んでも、写すものと差分が同じ', () => {
	const ctx = makeContainerRepo();
	const wt = path.join(root, `wt-${caseNo}`);
	ctx.git('worktree', 'add', '-q', '-b', 'side', wt);
	for (const dir of [ctx.repo, wt]) {
		fs.writeFileSync(path.join(dir, 'README.md'), 'changed\n');
		fs.writeFileSync(path.join(dir, 'new.txt'), 'new\n');
	}
	const pick = (r) => {
		const copied = listCopied(r.cpDir);
		const diffFile = copied.find((p) => p.endsWith('/review.diff'));
		return JSON.stringify([copied, diffFile ? fs.readFileSync(path.join(r.cpDir, diffFile), 'utf8') : '']);
	};
	const main = runContainer(ctx);
	const mainPick = pick(main);
	caseNo++;
	const fromWt = runContainer({ ...ctx, repo: wt }, { workDir: wt });
	return [main.code === 0 && fromWt.code === 0 && mainPick === pick(fromWt), `${detail(main)} ${detail(fromWt)}`];
});

if (isWindows) {
	containerCase('中継の .ps1 から -Container を付けても、旗として届く（consult に付けると止まる。docker には届かない）', () => {
		const ctx = makeContainerRepo();
		const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperPs1, '-Mode', 'consult', '-Container', '-PromptFile', promptFile, '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env, encoding: 'utf8' });
		return [r.status !== 0 && (r.stderr || '').includes('review と check だけ') && !fs.existsSync(ctx.mark), `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`];
	});
}

containerCase('-Container は前・間・後ろのどこに置いても、次の語を値として食わない', () => {
	const ctx = makeContainerRepo();
	ctx.git('checkout', '-q', '-b', 'feature');
	const codes = [['-Container', '-Mode', 'review', '-Base', 'main'], ['-Mode', 'review', '-Container', '-Base', 'main'], ['-Mode', 'review', '-Base', 'main', '-container']]
		.map((args) => runContainer(ctx, { args }).code);
	return [codes.every((c) => c === 0), `codes=${codes.join(',')}`];
});

// ---- Windows だけ：codex の探し方と、前の呼び方（invoke-codex.ps1）の中継（#100） ----
if (isWindows) {
	// pnpm・bun などで入れた形：シム（codex.cmd）はあるが、隣に node_modules/@openai/codex/bin/codex.js が無い。直し方を出して止まる
	{
		const name = '止まる: codex のシムの隣に codex.js が無い（pnpm などで入れた形）';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			const pnpmDir = path.join(root, 'pnpm-bin');
			fs.mkdirSync(pnpmDir, { recursive: true });
			fs.writeFileSync(path.join(pnpmDir, 'codex.cmd'), '@echo off\r\nexit /b 0\r\n');
			// 偽物だけでなく、codex のあるフォルダは全部外す（node のフォルダに本物の codex があると、ラッパーが後ろまで探して本物を呼ぶため）
			const hasCodex = (d) => ['codex.exe', 'codex.cmd', 'codex.ps1', 'codex'].some((n) => fs.existsSync(path.join(d, n)));
			const env = { ...ctx.env, PATH: [pnpmDir, ...ctx.env.PATH.split(';').filter((d) => d !== fakeDir && !hasCodex(d))].join(';') };
			const r = runNode(wrapper, ['-Mode', 'consult', '-PromptFile', promptFile, '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env });
			const ok = r.status === 1 && !fs.existsSync(ctx.mark) && (r.stderr || '').includes('codex.js') && (r.stderr || '').includes('npm install -g @openai/codex');
			report(name, ok, `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}

	// PATH の前に codex.js の無いシム、後ろに npm で入れた codex がある：前のシムで止まらず、後ろの codex を呼ぶ
	{
		const name = '止まらない: codex.js の無いシムが PATH の前にあっても、後ろの npm の codex を呼ぶ';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			const pnpmDir = path.join(root, 'pnpm-bin-front');
			fs.mkdirSync(pnpmDir, { recursive: true });
			fs.writeFileSync(path.join(pnpmDir, 'codex.cmd'), '@echo off\r\nexit /b 0\r\n');
			const env = { ...ctx.env, PATH: [pnpmDir, ...ctx.env.PATH.split(';')].join(';') };
			const r = runNode(wrapper, ['-Mode', 'consult', '-PromptFile', promptFile, '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env });
			report(name, r.status === 0 && fs.existsSync(ctx.mark), `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}

	// 中継：.mjs を直接呼んだときと同じ引数が偽物に届き、終了コードと日本語の返事がそのまま返る
	const runPs1 = (args, opts) => spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperPs1, ...args], { encoding: 'utf8', ...opts });
	// 一時ディレクトリの名前（-o の値）は呼ぶたびに違うので、比べる前にそろえる（配列で比べるので、TEMP のパスに空白があってもずれない）
	const normalize = (s) => {
		try {
			const a = JSON.parse(s);
			const i = a.indexOf('-o');
			if (i >= 0 && i + 1 < a.length) a[i + 1] = '<返事のファイル>';
			return JSON.stringify(a);
		} catch {
			return '';
		}
	};
	const readArgs = (mark) => (fs.existsSync(`${mark}.json`) ? fs.readFileSync(`${mark}.json`, 'utf8') : '');
	const clearMarks = (mark) => {
		fs.rmSync(mark, { force: true });
		fs.rmSync(`${mark}.json`, { force: true });
	};
	{
		const name = '中継: .ps1 から呼んでも .mjs と同じ引数が届き、日本語の返事が化けずに返る（consult）';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			const reply = '健さんの返事：日本語のテスト';
			const args = ['-Mode', 'consult', '-PromptFile', promptFile, '-WorkingDirectory', ctx.repo];
			const direct = runNode(wrapper, args, { cwd: ctx.repo, env: { ...ctx.env, FAKE_CODEX_REPLY: reply } });
			const directArgs = readArgs(ctx.mark);
			clearMarks(ctx.mark);
			const viaPs1 = runPs1(args, { cwd: ctx.repo, env: { ...ctx.env, FAKE_CODEX_REPLY: reply } });
			const ps1Args = readArgs(ctx.mark);
			const ok = direct.status === 0 && viaPs1.status === 0
				&& directArgs !== '' && normalize(directArgs) === normalize(ps1Args)
				&& (direct.stdout || '').includes(reply) && (viaPs1.stdout || '').includes(reply);
			report(name, ok, `(code=${direct.status}/${viaPs1.status} args=${normalize(ps1Args).slice(0, 160)} stdout=${(viaPs1.stdout || '').trim().slice(0, 80)} stderr=${(viaPs1.stderr || '').trim().slice(0, 160)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
	{
		const name = '中継: 空白を含み末尾が \\ の値（-WorkingDirectory "…\\"）でも、後ろの引数が崩れずに届く';
		try {
			const ctx = makeRepo('repo with space');
			commitAll(ctx.git, 'init');
			const args = ['-WorkingDirectory', `${ctx.repo}\\`, '-Mode', 'consult', '-PromptFile', promptFile];
			const direct = runNode(wrapper, args, { cwd: ctx.repo, env: ctx.env });
			const directArgs = readArgs(ctx.mark);
			clearMarks(ctx.mark);
			const viaPs1 = runPs1(args, { cwd: ctx.repo, env: ctx.env });
			const ps1Args = readArgs(ctx.mark);
			const ok = direct.status === 0 && viaPs1.status === 0 && directArgs !== '' && normalize(directArgs) === normalize(ps1Args);
			report(name, ok, `(code=${direct.status}/${viaPs1.status} args=${normalize(ps1Args).slice(0, 160)} stderr=${(viaPs1.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
	{
		const name = '中継: 空の値（-Base ""）でも落とさずに渡し、後ろの引数がずれない（review）';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			const args = ['-Base', '', '-Mode', 'review', '-WorkingDirectory', ctx.repo];
			const direct = runNode(wrapper, args, { cwd: ctx.repo, env: ctx.env });
			const directArgs = readArgs(ctx.mark);
			clearMarks(ctx.mark);
			const viaPs1 = runPs1(args, { cwd: ctx.repo, env: ctx.env });
			const ps1Args = readArgs(ctx.mark);
			const ok = direct.status === 0 && viaPs1.status === 0 && directArgs.includes('--uncommitted') && normalize(directArgs) === normalize(ps1Args);
			report(name, ok, `(code=${direct.status}/${viaPs1.status} args=${normalize(ps1Args).slice(0, 160)} stderr=${(viaPs1.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
	{
		const name = '中継: .ps1 から呼んでも、秘密情報で止まる終了コード 1 と止めた文がそのまま返る（review）';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			ctx.write('.dev.vars', 'S=1\n');
			const r = runPs1(['-Mode', 'review', '-WorkingDirectory', ctx.repo], { cwd: ctx.repo, env: ctx.env });
			const ok = r.status === 1 && !fs.existsSync(ctx.mark) && (r.stderr || '').includes('秘密情報') && (r.stderr || '').includes('.dev.vars');
			report(name, ok, `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
	{
		const name = '中継: .ps1 から呼んでも、image の終了コード 2 がそのまま返る';
		try {
			const dir = path.join(root, 'nogit-ps1-image');
			fs.mkdirSync(dir, { recursive: true });
			const prompt = path.join(root, 'prompt-image-ps1.md');
			fs.writeFileSync(prompt, '画像を作って\n');
			const img = path.join(root, 'ref-image-ps1.png');
			fs.writeFileSync(img, 'x');
			const mark = path.join(root, 'mark-ps1-image.txt');
			const r = runPs1(['-Mode', 'image', '-PromptFile', prompt, '-WorkingDirectory', dir, '-Image', img], { cwd: dir, env: buildEnv(mark) });
			const ok = r.status === 2 && fs.existsSync(mark) && (r.stderr || '').includes('IMAGE_PATH');
			report(name, ok, `(code=${r.status} stderr=${(r.stderr || '').trim().slice(0, 200)})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
} else {
	console.log('skip codex のシムの隣に codex.js が無いときの確かめ 2 つ（Windows だけ）');
	console.log('skip 中継（invoke-codex.ps1）の確かめ 5 つ（Windows だけ）');

	// Mac・Linux：ラッパーの一時ディレクトリは持ち主だけが読み書きできる（Linux の /tmp は共有のため）
	{
		const name = '一時ディレクトリ: Mac・Linux では持ち主だけ（700）で作る';
		try {
			const ctx = makeRepo();
			commitAll(ctx.git, 'init');
			const r = runWrapper(ctx, '', 'consult');
			const mode = fs.existsSync(`${ctx.mark}.dirmode`) ? fs.readFileSync(`${ctx.mark}.dirmode`, 'utf8') : '';
			report(name, r.code === 0 && mode === '700', `(code=${r.code} mode=${mode})`);
		} catch (e) {
			report(name, false, String(e.message));
		}
	}
}

finish();
