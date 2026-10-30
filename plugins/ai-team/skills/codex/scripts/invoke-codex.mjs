#!/usr/bin/env node
// invoke-codex.mjs
// Claude Code（ガネーシャ・メジェド）から Codex CLI（健さん）を呼ぶラッパー。Windows・Mac・Linux で動く（#100）。
// モードは consult（読むだけの相談）・review（読むだけのレビュー）・image（画像の生成）の3つだけ。
// と、codex を呼ばない check（秘密情報と設定ファイルの確かめだけ。allow が効くかを、Codex の枠を使わずに確かめるため）。
// 実装（ファイルの書き換え）は頼まない。返事は標準出力に出すだけで、保存しない。
// この PC で動く健さんの sandbox は常に read-only。review・check に -Container を付けると、Docker のコンテナの中で動かし、
// 健さんにテストも打たせる（コンテナの中だけ workspace-write。#99。流れは docs/tasks/codex-container/plan.md）。
//
// 呼び方（リポジトリの根から、Bash ツールで）:
//   node "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.mjs" -Mode consult -PromptFile <一時ファイル>
//
// 引数の名前は、前の invoke-codex.ps1 と同じ（-Mode・-PromptFile・-WorkingDirectory・-Image・-Base・-Task）と、値を取らない -Container。
// 大文字小文字の違いは受ける。略した形（-M など）は受けない。
//
// 終了コード: 0 = 成功 / 1 = 呼ぶ前の確認で止めた / 2 = image で画像のパスが取れなかった / それ以外 = codex の終了コード

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

// 止めるときに投げる。一番外で受けて、後始末（finally）を通してから終了コードを決める
// （process.exit を途中で呼ぶと、finally の後始末も、標準出力の書き出しも済まないことがあるため）
class Stop extends Error {
	constructor(message, code = 1) {
		super(message);
		this.code = code;
	}
}

function stopWrapper(message, code = 1) {
	throw new Stop(message, code);
}

// パスの比べ方は2つある。共有モジュール（hooks/ai-team-config.mjs）の2つのそろえ方と対になっている
// （ここでは共有モジュールを import しない。確かめは子プロセスの CLI で行うため）。
//
// - sameCaseFolded：Windows と Mac（既定の APFS）で大文字小文字をそろえて比べる。共有モジュールの forMatch と同じ。
//   取り違えると止める側に倒れる比べ方（参照画像と出力が同じか）に使う
// - sameLocation・isUnderLocation：Windows だけそろえる。共有モジュールの forPath と同じ。場所の判定に使う
//   （設定を読む根を重ねないため・生成画像の保存先の下か）。Mac には大文字小文字を区別する APFS もあり、
//   別の場所の Repo と repo を同じと見ると、設定を読み落としたり、保存先の外の画像を受け入れたりするため（#100）
const foldsForMatch = isWindows || process.platform === 'darwin';
function sameCaseFolded(a, b) {
	return foldsForMatch ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function sameLocation(a, b) {
	return isWindows ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isUnderLocation(child, parentWithSep) {
	return isWindows ? child.toLowerCase().startsWith(parentWithSep.toLowerCase()) : child.startsWith(parentWithSep);
}

// 一時ディレクトリを、持ち主だけが読み書きできる形で作る（Linux の /tmp は共有なので、
// codex の進み具合（読んだコードや差分が入る）をほかのユーザーに読ませないため）。
// Windows は前と同じく %TEMP%\claude\ の下（%TEMP% はユーザーごと）。Mac・Linux は共有の名前のフォルダ（/tmp/claude）を挟まず、
// 一時ディレクトリの直下に作る（先にほかのユーザーが /tmp/claude を作っていると、その下に作れないため）
function makePrivateTempDir(prefix) {
	if (isWindows) {
		const parent = path.join(os.tmpdir(), 'claude');
		fs.mkdirSync(parent, { recursive: true });
		return fs.mkdtempSync(path.join(parent, prefix));
	}
	return fs.mkdtempSync(path.join(os.tmpdir(), `claude-${prefix}`));
}

// ---- 引数 ----

const OPTIONS = ['Mode', 'PromptFile', 'WorkingDirectory', 'Image', 'Base', 'Task'];
// 値を取らない旗（前・間・後ろのどこに置いても、次の語を値として食わない）
const FLAGS = ['Container'];
const MODES = ['consult', 'review', 'image', 'check'];

function parseArgs(argv) {
	const opts = { Mode: '', PromptFile: '', WorkingDirectory: '', Image: '', Base: '', Task: '', Container: false };
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		const flag = token.startsWith('-') ? FLAGS.find((f) => `-${f}`.toLowerCase() === token.toLowerCase()) : undefined;
		if (flag !== undefined) {
			opts[flag] = true;
			continue;
		}
		const name = token.startsWith('-') ? OPTIONS.find((o) => `-${o}`.toLowerCase() === token.toLowerCase()) : undefined;
		if (name === undefined) stopWrapper(`知らない引数です: ${token}（使えるのは ${[...OPTIONS, ...FLAGS].map((o) => `-${o}`).join('・')}）`);
		if (i + 1 >= argv.length) stopWrapper(`${token} の値がありません。`);
		opts[name] = argv[++i];
	}
	const mode = MODES.find((m) => m === opts.Mode.toLowerCase());
	if (mode === undefined) stopWrapper(`-Mode は ${MODES.join('・')} のどれかにしてください: ${opts.Mode}`);
	opts.Mode = mode;
	if (opts.Container && mode !== 'review' && mode !== 'check') stopWrapper('-Container を付けられるのは review と check だけです。');
	// -Task は使わない（返事を保存していたころのタスク名）。古い呼び方（gh-skills の gh-pr など）で渡されても止めないよう、受け取って捨てる
	return opts;
}

// ---- codex の探し方 ----
// Windows：PATH から codex を探し、.exe ならそのまま起動する。npm のシム（.cmd・.ps1）なら、隣の
// node_modules/@openai/codex/bin/codex.js を今の node で直接起動する（シェルを通さない。実行ポリシーで止まらず、
// .cmd を通したときの引数の引用の崩れも無い）。隣に無いシム（pnpm・bun などで入れた）は飛ばして PATH の後ろも探し、
// 最後まで使えるものが無ければ、見つけたシムと直し方を出して止める。
// Mac・Linux：PATH の codex をそのまま起動する。
function findCodex() {
	const dirs = (process.env.PATH || '').split(path.delimiter).filter((d) => d.trim() !== '');
	let skippedShim = null;
	for (const dir of dirs) {
		if (isWindows) {
			const exe = path.join(dir, 'codex.exe');
			if (isFile(exe)) return { command: exe, prefix: [] };
			const shim = ['codex.cmd', 'codex.ps1', 'codex'].map((n) => path.join(dir, n)).find(isFile);
			if (shim !== undefined) {
				const js = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
				if (isFile(js)) return { command: process.execPath, prefix: [js] };
				if (skippedShim === null) skippedShim = shim;
			}
		} else {
			const bin = path.join(dir, 'codex');
			if (isExecutable(bin)) return { command: bin, prefix: [] };
		}
	}
	if (skippedShim !== null) {
		stopWrapper(`codex のシム（${skippedShim}）の隣に node_modules/@openai/codex/bin/codex.js がありません（pnpm・bun などで入れたときの形）。npm install -g @openai/codex で入れ直すか、codex.exe を PATH に置いてください。`);
	}
	return null;
}

function isFile(p) {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}

function isExecutable(p) {
	try {
		fs.accessSync(p, fs.constants.X_OK);
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}

// git の頭に付ける引数。-Container のときは、fsmonitor のフックを動かさず、索引も書き戻さない（D12。#99）
let gitPrefix = [];

// git を呼ぶ（失敗しても例外にせず、終了コードと出力を返す）
function git(args, cwd) {
	const r = gitRaw(args, cwd);
	return { code: r.code, stdout: r.stdout.toString('utf8') };
}

// 出力をバイト列のまま返す（差分は、元のファイルのバイトのまま渡すため）
function gitRaw(args, cwd) {
	const r = spawnSync('git', [...gitPrefix, ...args], { cwd, maxBuffer: 1024 * 1024 * 1024 });
	return { code: r.status === null ? 1 : r.status, stdout: r.stdout || Buffer.alloc(0) };
}

// メインのチェックアウト（worktree list の1件目）の根。worktree から呼ばれても、そこの設定ファイルも読むため。
// 求められなければ（git が失敗・worktree でない）、作業の根のまま。
function getMainRoot(repoRoot) {
	const r = git(['-C', repoRoot, 'worktree', 'list', '--porcelain'], repoRoot);
	if (r.code !== 0) return repoRoot;
	for (const line of r.stdout.split(/\r?\n/)) {
		const m = line.match(/^worktree (.+)$/);
		if (m) {
			const main = path.resolve(m[1].trim());
			return isDirectory(main) ? main : repoRoot;
		}
	}
	return repoRoot;
}

function isDirectory(p) {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

// UTF-8 で読む（頭の BOM は外す。前の .ps1 の ReadAllText と同じ）
function readUtf8(p) {
	return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
}

// codex を呼ぶ。進み具合の出力はメモリに溜めず一時ファイルに流し（出力の上限で途中で止めないため）、
// 失敗したときだけ末尾 20 行を出す
function invokeCodex(codex, args, { stdin = null, cwd, workDir }) {
	const logFile = path.join(workDir, 'codex-output.log');
	const fd = fs.openSync(logFile, 'w', 0o600);
	let r;
	try {
		r = spawnSync(codex.command, [...codex.prefix, ...args], {
			cwd,
			input: stdin === null ? undefined : Buffer.from(stdin, 'utf8'),
			stdio: [stdin === null ? 'ignore' : 'pipe', fd, fd],
		});
	} finally {
		fs.closeSync(fd);
	}
	const code = r.status === null ? 1 : r.status;
	if (code !== 0) {
		process.stderr.write(`invoke-codex: codex が終了コード ${code} で終わりました。最後の出力:\n`);
		if (r.error) process.stderr.write(`  ${r.error.message}\n`);
		const log = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter((l, i, all) => !(i === all.length - 1 && l === ''));
		for (const line of log.slice(-20)) process.stderr.write(`  ${line}\n`);
	}
	return code;
}

// 共有モジュールの check を呼ぶ。paths は照らすパスの一覧（リポジトリの根からの相対）。
// 返り値の code は共有モジュールの終了コード（0・1・2・3）、out は --out に書かれたもの
function runConfigCheck(configModule, checkRoots, paths) {
	const checkDir = makePrivateTempDir('codex-check-');
	try {
		const checkPathsFile = path.join(checkDir, 'paths.bin');
		const checkOutFile = path.join(checkDir, 'out.txt');
		// NUL 区切りの UTF-8（BOM なし）。標準入出力を通さず、ファイルで渡す
		fs.writeFileSync(checkPathsFile, Buffer.from(paths.join('\0'), 'utf8'));
		const nodeArgs = [configModule, 'check'];
		for (const root of checkRoots) nodeArgs.push('--root', root);
		nodeArgs.push('--paths-file', checkPathsFile, '--out', checkOutFile);
		const r = spawnSync(process.execPath, nodeArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
		return { code: r.status === null ? 1 : r.status, out: isFile(checkOutFile) ? readUtf8(checkOutFile) : '' };
	} finally {
		fs.rmSync(checkDir, { recursive: true, force: true });
	}
}

// ---- コンテナの中のレビュー（-Container。#99） ----
// 流れと、その理由は docs/tasks/codex-container/plan.md。番号は計画の「流れ」の番号。

const IMAGE_NAME = 'ai-team-codex';
const LOGIN_VOLUME = 'ai-team-codex-home';
const LABEL = 'ai-team-codex=1';
// 健さんの AGENTS.md に、コンテナのレビューの決まりが入っているかの印（repo-files/codex/AGENTS.md の節の頭）
const AGENTS_MARK = '<!-- ai-team: container-review v1 -->';
// 健さんのコンテナで打つ、決まった文字列のコマンド。リポジトリから来るものは入れない（config.toml の値は "$@" で渡す）。
// 頭で、準備のコンテナが /work/repo をリンクにすり替えていないかを確かめ、すり替えていれば 97 で終わる
const REVIEW_SCRIPT = '[ -d /work/repo ] && [ ! -L /work/repo ] || exit 97; exec codex exec --ephemeral --color never --skip-git-repo-check -s workspace-write -C /work/repo -o /review/out/last-message.md "$@" - < /review/prompt.md';
const SWAPPED_REPO = 97;
// 名前に入っていたら止める文字（制御文字・U+2028・U+2029）
const BAD_NAME = /[\u0000-\u001f\u007f\u2028\u2029]/;

// docker の呼び方。テストは run() の deps.docker で偽物に差し替える（環境変数などの、リポジトリの設定から差し込める口は作らない）
function realDocker(args, opts = {}) {
	return spawnSync('docker', args, { maxBuffer: 64 * 1024 * 1024, ...opts });
}

function codexHome() {
	return (process.env.CODEX_HOME || '').trim() === '' ? path.join(os.homedir(), '.codex') : process.env.CODEX_HOME;
}

// config.toml の最上位（最初の [表] より前）の model・model_reasoning_effort を、-c の値として返す
function modelOverrides() {
	const file = path.join(codexHome(), 'config.toml');
	if (!isFile(file)) return [];
	const out = [];
	for (const line of readUtf8(file).split(/\r?\n/)) {
		if (/^\s*\[/.test(line)) break;
		const m = line.match(/^\s*(model|model_reasoning_effort)\s*=\s*"([^"\\]*)"\s*(#.*)?$/);
		if (m) out.push('-c', `${m[1]}=${JSON.stringify(m[2])}`);
	}
	return out;
}

// docker を包む。向き先（--context）を固定し、見つからないときは止める
function makeDocker(deps) {
	const call = deps.docker || realDocker;
	let ctxArgs = [];
	const run = (args, opts = {}) => {
		const r = call([...ctxArgs, ...args], opts);
		if (r.error && r.error.code === 'ENOENT') stopWrapper('docker が見つかりません。Docker Desktop（か Docker Engine）を入れて起動してください（devcontainer の中では、Docker が使えなければ -Container は使えません）。');
		return { code: r.status === null ? 1 : r.status, stdout: r.stdout ? r.stdout.toString('utf8') : '' };
	};
	return {
		run,
		setContext(args) {
			ctxArgs = args;
		},
		// 出力を一時ファイルに流し、失敗したときだけ末尾 20 行を出す（codex の進み具合や npm ci の出力を溜めないため）
		logged(args, logFile, label) {
			const fd = fs.openSync(logFile, 'w', 0o600);
			let r;
			try {
				r = run(args, { stdio: ['ignore', fd, fd] });
			} finally {
				fs.closeSync(fd);
			}
			if (r.code !== 0 && r.code !== SWAPPED_REPO) {
				process.stderr.write(`invoke-codex: ${label}が終了コード ${r.code} で終わりました。最後の出力:\n`);
				const log = fs.readFileSync(logFile, 'utf8').split(/\r?\n/).filter((l, i, all) => !(i === all.length - 1 && l === ''));
				for (const line of log.slice(-20)) process.stderr.write(`  ${line}\n`);
			}
			return r.code;
		},
	};
}

// 2. この PC の codex の版と、AGENTS.md（印の行）を確かめる
function checkCodexForContainer(codex) {
	const v = spawnSync(codex.command, [...codex.prefix, '--version'], { encoding: 'utf8' });
	const m = (v.stdout || '').match(/(\d+\.\d+\.\d+[0-9A-Za-z.+-]*)/);
	if (v.status !== 0 || !m) stopWrapper('codex の版が分かりません（codex --version が失敗しました）。');
	const agents = path.join(codexHome(), 'AGENTS.md');
	if (!isFile(agents)) stopWrapper(`健さんの決まり（${agents}）がありません。README の「PC ごとに1回」のとおりに置いてください。`);
	if (!readUtf8(agents).includes(AGENTS_MARK)) {
		stopWrapper(`健さんの決まり（${agents}）に、コンテナの中のレビューの節（${AGENTS_MARK} の行で始まる節）がありません。README のとおりに、テンプレートからその節を写してください。`);
	}
	return { version: m[1], agents };
}

// 7〜9. docker の向き先・イメージ・ログインを確かめる。返り値はイメージの名前
function prepareDocker(docker, version, workDir) {
	if ((process.env.DOCKER_CONTEXT || '') !== '') stopWrapper('DOCKER_CONTEXT があるときは -Container を使いません（向き先の決まり方が分かれるため）。消してから呼んでください。');
	const local = (h) => /^(unix|npipe):\/\//.test(h);
	const host = process.env.DOCKER_HOST || '';
	if (host !== '') {
		if (!local(host)) stopWrapper(`DOCKER_HOST（${host}）がこの PC を指していません。作業ツリーとログインを別のマシンに送らないよう、-Container を使いません。`);
	} else {
		const show = docker.run(['context', 'show']);
		const name = show.stdout.trim();
		if (show.code !== 0 || name === '') stopWrapper('docker の context が分かりません（docker context show が失敗しました）。');
		const inspect = docker.run(['context', 'inspect', name, '--format', '{{.Endpoints.docker.Host}}']);
		if (inspect.code !== 0 || !local(inspect.stdout.trim())) {
			stopWrapper(`docker の向き先（context ${name}: ${inspect.stdout.trim()}）がこの PC ではありません。作業ツリーとログインを別のマシンに送らないよう、-Container を使いません。`);
		}
		// 以後の docker は全部この context に固定する（途中で既定の context が変わっても、向き先を変えない）
		docker.setContext(['--context', name]);
	}
	if (docker.run(['info', '--format', '{{.ServerVersion}}']).code !== 0) stopWrapper('Docker が動いていません（docker info が失敗しました）。Docker Desktop を起動してから呼んでください。');

	const image = `${IMAGE_NAME}:${version}`;
	if (docker.run(['image', 'inspect', image]).code !== 0) {
		// build のコンテキストは、プラグインの中のこのフォルダだけ（対象のリポジトリを渡さない）
		const context = path.resolve(here, '..', 'container');
		const code = docker.logged(['build', '-t', image, '--build-arg', `CODEX_VERSION=${version}`, context], path.join(workDir, 'docker-build.log'), 'イメージの作成（docker build）');
		if (code !== 0) stopWrapper(`イメージ ${image} を作れませんでした（npm に @openai/codex@${version} が無いかもしれません）。`);
		// ほかの版のイメージを消す。消せなければ（強制終了で残ったコンテナが使っているなど）、続けて知らせる
		const list = docker.run(['image', 'ls', IMAGE_NAME, '--format', '{{.Repository}}:{{.Tag}}']);
		for (const old of list.stdout.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '' && s !== image)) {
			if (docker.run(['image', 'rm', old]).code !== 0) process.stderr.write(`invoke-codex: 前の版のイメージ ${old} を消せませんでした。残ったコンテナを消してから docker image rm ${old} で消してください。\n`);
		}
	}

	if (docker.run(['run', '--rm', '--label', LABEL, '-v', `${LOGIN_VOLUME}:/root/.codex`, image, 'codex', 'login', 'status']).code !== 0) {
		stopWrapper(`コンテナ用のログインがありません。README の「コンテナでのレビュー」のとおりに、ChatGPT の設定でデバイスコードのサインインを一時的にオンにしてから、次を打ってログインしてください:\n  docker run --rm -it -v ${LOGIN_VOLUME}:/root/.codex ${image} codex login --device-auth`);
	}
	return image;
}

// 4〜6. 送るものを決め、名前で確かめてから写す。返り値は未追跡のファイルの一覧
function makeSnapshot(top, compare, workDir, configModule, checkRoots) {
	// 4. 差分：パスの一覧（raw）と差分を、1回の git で一緒に作る
	const diff = gitRaw(['-c', 'core.quotePath=false', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false',
		'diff', '--patch-with-raw', '-z', '--no-ext-diff', '--no-color', '--no-textconv', '--no-renames', '--submodule=short',
		'--src-prefix=a/', '--dst-prefix=b/', compare, '--'], top);
	if (diff.code !== 0) stopWrapper(`git diff が失敗しました: ${top}`);
	const diffPaths = [];
	const buf = diff.stdout;
	let pos = 0;
	// 頭は「:<メタ>\0<パス>\0」の並び。尽きたところに空の項目（\0）が1つあり、その次からが差分
	while (pos < buf.length && buf[pos] === 0x3a) {
		const metaEnd = buf.indexOf(0, pos);
		const pathEnd = metaEnd < 0 ? -1 : buf.indexOf(0, metaEnd + 1);
		if (pathEnd < 0) stopWrapper('git diff の出力を読めませんでした。');
		diffPaths.push(buf.subarray(metaEnd + 1, pathEnd).toString('utf8'));
		pos = pathEnd + 1;
	}
	if (pos < buf.length && buf[pos] === 0) pos++;
	const patch = buf.subarray(pos);

	// 写す候補：追跡しているものと、無視されていない未追跡のもの
	const tracked = git(['ls-files', '-z', '-c'], top);
	const others = git(['ls-files', '-z', '-o', '--exclude-standard'], top);
	const staged = git(['ls-files', '-z', '-s'], top);
	if (tracked.code !== 0 || others.code !== 0 || staged.code !== 0) stopWrapper(`git ls-files が失敗しました: ${top}`);
	const untracked = others.stdout.split('\0').filter((p) => p !== '');
	const candidates = [...new Set([...tracked.stdout.split('\0'), ...untracked].filter((p) => p !== ''))].filter((rel) => {
		// 消したファイルは写さない（壊れたシンボリックリンクはディスクにあるので残し、下でリンクとして止める）
		try {
			fs.lstatSync(path.join(top, rel));
			return true;
		} catch {
			return false;
		}
	});

	// 5. 名前で確かめる（D10。中身はまだ写していない）。どのパスかは手元にだけ出す
	const stop = (why, list) => stopWrapper(`${why}ので、-Container を使いません（外して写すと、外し方の穴から漏れるため）: ${list.slice(0, 10).join(', ')}${list.length > 10 ? ` ほか ${list.length - 10} 件` : ''}`);
	const badNames = [...candidates, ...diffPaths].filter((p) => BAD_NAME.test(p));
	if (badNames.length > 0) stop('名前に制御文字（改行など）を含むファイルがある', badNames.map((p) => JSON.stringify(p)));
	const gitlinks = staged.stdout.split('\0').filter((e) => e.startsWith('160000 ')).map((e) => e.slice(e.indexOf('\t') + 1));
	if (gitlinks.length > 0 || candidates.includes('.gitmodules')) stop('サブモジュールがある', gitlinks.length > 0 ? gitlinks : ['.gitmodules']);
	const nested = candidates.filter((p) => p.endsWith('/'));
	if (nested.length > 0) stop('未追跡の入れ子のリポジトリがある（中のファイルを照らせない）', nested);
	const check = runConfigCheck(configModule, checkRoots, [...candidates, ...diffPaths]);
	if (check.code === 3) stop('秘密情報のファイルがある（変更していなくても、写すと Codex に送られる）', [...new Set(check.out.split('\n').filter((s) => s !== ''))]);
	if (check.code === 2) stopWrapper(`設定ファイル（.claude/ai-team.json）が壊れているので、健さんを呼びません: ${check.out}`);
	if (check.code !== 0 || check.out.split('\n')[0].trim() !== 'ai-team-config: ok') stopWrapper('秘密情報の確かめが済んだか分からないので、健さんを呼びません。');
	// リンク：根の実体を基準に、候補の実体が「根の実体＋相対パス」と違えば止める（根より上のリンクと、根の綴りの大小は比べない）
	const realTop = fs.realpathSync.native(top);
	const links = candidates.filter((rel) => {
		const full = path.join(top, rel);
		try {
			if (fs.lstatSync(full).isSymbolicLink()) return true;
			return !sameLocation(fs.realpathSync.native(full), path.join(realTop, rel));
		} catch {
			return true;
		}
	});
	if (links.length > 0) stop('リンク（シンボリックリンク・ジャンクション）か、綴りの大文字小文字が索引とディスクで違うファイルがある', links);

	// 6. 写す。写す直前にもう一度、リンクに変わっていないかを見る
	const repoDir = path.join(workDir, 'repo');
	fs.mkdirSync(repoDir);
	for (const rel of candidates) {
		const full = path.join(top, rel);
		if (fs.lstatSync(full).isSymbolicLink()) stop('写す途中でリンクに変わったファイルがある', [rel]);
		const dest = path.join(repoDir, rel);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(full, dest);
	}
	const reviewDir = path.join(workDir, 'review');
	fs.mkdirSync(path.join(reviewDir, 'out'), { recursive: true });
	fs.writeFileSync(path.join(reviewDir, 'review.diff'), patch);
	return untracked.filter((p) => candidates.includes(p));
}

// 13. 頼みの文（ラッパーが組み立てる）
function buildContainerPrompt(container, untracked) {
	return [
		'ガネーシャから（コンテナの中のレビュー）',
		'',
		'次の変更をレビューしてください。',
		'',
		'- 見る差分：/review/review.diff',
		'- 作業ツリー：/work/repo（git のリポジトリではありません。秘密情報のファイルは入っていません）',
		`- テスト：作業ツリーで \`${container.test}\` を打ち、その結果も根拠にしてください（準備のコマンド \`${container.setup}\` は打ってあります）`,
		'- 作業ツリーのファイルを書き換えないでください（テストが作るキャッシュや一時ファイルは除く）',
		'- 指摘は、/work/repo からの相対パスのファイル:行と、重要度（必須／推奨／表記）を付けて書いてください',
		'',
		untracked.length === 0 ? '未追跡のファイル（差分には入っていない新しいファイル）：なし' : `未追跡のファイル（差分には入っていない新しいファイル。中身は作業ツリーにあります）：\n${untracked.map((p) => `- ${p}`).join('\n')}`,
		'',
	].join('\n');
}

// 10〜14. コンテナで健さんを動かす。返り値は終了コード
function reviewInContainer({ docker, image, workDir, container, agents, state }) {
	// 10. 作業用のボリューム
	const volume = `${IMAGE_NAME}-work-${path.basename(workDir).replace(/[^A-Za-z0-9]/g, '').toLowerCase()}`;
	if (docker.run(['volume', 'create', '--label', LABEL, volume]).code !== 0) stopWrapper('作業用のボリュームを作れませんでした。');
	state.volumes.push(volume);

	// 11. 準備のコンテナ（ログインのボリュームは付けない。ネットワークあり）
	const prep = docker.run(['create', '--rm', '--label', LABEL, '-w', '/work/repo', '-v', `${volume}:/work`, image, 'sh', '-c', container.setup]);
	if (prep.code !== 0 || prep.stdout.trim() === '') stopWrapper('準備のコンテナを作れませんでした。');
	const prepId = prep.stdout.trim();
	state.containers.push(prepId);
	if (docker.run(['cp', `${path.join(workDir, 'repo')}${path.sep}.`, `${prepId}:/work/repo`]).code !== 0) stopWrapper('作業ツリーをコンテナに写せませんでした。');
	const setupCode = docker.logged(['start', '-a', prepId], path.join(workDir, 'setup.log'), '準備のコマンド（container.setup）');
	// --rm なので、終われば消えている
	state.containers.splice(state.containers.indexOf(prepId), 1);
	if (setupCode !== 0) stopWrapper(`準備のコマンド（container.setup）が失敗しました（終了コード ${setupCode}）。`);

	// 12. 健さんのコンテナ
	const ken = docker.run(['create', '--label', LABEL, '--security-opt', 'seccomp=unconfined', '-w', '/work/repo', '-e', 'TMPDIR=/tmp',
		'-v', `${volume}:/work`, '-v', `${LOGIN_VOLUME}:/root/.codex`, image, 'sh', '-c', REVIEW_SCRIPT, 'sh', ...modelOverrides()]);
	if (ken.code !== 0 || ken.stdout.trim() === '') stopWrapper('健さんのコンテナを作れませんでした。');
	const kenId = ken.stdout.trim();
	state.containers.push(kenId);
	if (docker.run(['cp', agents, `${kenId}:/root/.codex/AGENTS.md`]).code !== 0) stopWrapper('健さんの決まりをコンテナに写せませんでした。');
	// /review は健さんのコンテナだけの場所（準備と共有するボリュームの外）
	if (docker.run(['cp', path.join(workDir, 'review'), `${kenId}:/review`]).code !== 0) stopWrapper('差分と頼みの文をコンテナに写せませんでした。');
	const code = docker.logged(['start', '-a', kenId], path.join(workDir, 'codex-output.log'), 'コンテナの中の codex');
	if (code === SWAPPED_REPO) stopWrapper('準備のコマンドが作業ツリー（/work/repo）をリンクにすり替えていたので、健さんを起こしませんでした。');

	// 14. 返事を取り出す
	const lastMessage = path.join(workDir, 'last-message.md');
	docker.run(['cp', `${kenId}:/review/out/last-message.md`, lastMessage]);
	if (!isFile(lastMessage)) stopWrapper(`健さんの返事が取れませんでした（終了コード ${code}）。`, code === 0 ? 1 : code);
	const reply = readUtf8(lastMessage);
	process.stdout.write(reply.endsWith('\n') ? reply : `${reply}\n`);
	return code;
}

// 15. 後始末：コンテナ → 作業用のボリューム → 一時ディレクトリの順。失敗しても続け、残ったものと消し方を出す（D11）
function cleanupContainer(docker, state, workDir) {
	const left = [];
	for (const id of state.containers) {
		if (docker.run(['rm', '-f', id]).code !== 0) left.push(`コンテナ ${id}（docker rm -f ${id}）`);
	}
	for (const v of state.volumes) {
		if (docker.run(['volume', 'rm', v]).code !== 0) left.push(`ボリューム ${v}（docker volume rm ${v}）`);
	}
	try {
		fs.rmSync(workDir, { recursive: true, force: true });
	} catch {
		// 下で知らせる
	}
	if (fs.existsSync(workDir)) left.push(`一時ディレクトリ ${workDir}`);
	if (left.length > 0) process.stderr.write(`invoke-codex: 後始末で消せなかったものがあります。手で消してください:\n${left.map((l) => `  ${l}`).join('\n')}\n`);
}

function main(cleanups, argv, deps) {
	const opts = parseArgs(argv);
	const mode = opts.Mode;
	if (opts.Container) gitPrefix = ['--no-optional-locks', '-c', 'core.fsmonitor=false'];

	// ---- 呼ぶ前の確認 ----

	let codex = null;
	if (mode !== 'check' || opts.Container) {
		codex = findCodex();
		if (codex === null) stopWrapper('codex が PATH にありません。npm install -g @openai/codex で入れて、codex login を打ってから呼んでください。');
	}

	const callerDirectory = process.cwd();
	const workingDirectory = opts.WorkingDirectory.trim() === '' ? callerDirectory : opts.WorkingDirectory;
	if (!isDirectory(workingDirectory)) stopWrapper(`作業の根が見つかりません: ${workingDirectory}`);
	let repoRoot = path.resolve(workingDirectory);
	if (opts.Container) {
		// 写しと差分は、-WorkingDirectory によらず、リポジトリの根から作る
		const top = git(['rev-parse', '--show-toplevel'], repoRoot);
		if (top.code !== 0 || top.stdout.trim() === '') stopWrapper(`-Container は Git のリポジトリでだけ使えます: ${repoRoot}`);
		repoRoot = path.resolve(top.stdout.trim());
	}

	let prompt = '';
	if (mode !== 'review' && mode !== 'check') {
		if (opts.PromptFile.trim() === '' || !isFile(opts.PromptFile)) stopWrapper(`頼みの文のファイル（-PromptFile）が見つかりません: ${opts.PromptFile}`);
		prompt = readUtf8(path.resolve(opts.PromptFile));
		if (prompt.trim() === '') stopWrapper('頼みの文が空です。');
	}

	// ---- 設定ファイルと秘密情報の確認 ----
	// 判定は共有モジュール（hooks/ai-team-config.mjs）に任せる（ガードと同じ判定にするため）。
	// review は健さんに変更を渡す（--uncommitted: ステージ済み・未ステージ・未追跡 / --base: 基準ブランチとの差分と、見込みでは未コミットの変更）。
	// 渡る変更のすべてのパスを集めて、呼ぶ前に秘密情報のパターンと照らす。review でなければ、パスは空（設定ファイルの確かめだけをする）。
	const gitPaths = [];
	if (mode === 'review') {
		// git status の -uall: 未追跡のディレクトリを1行にまとめず、中のファイルまで出す。-z: 空白や日本語のパスを引用符で囲まない
		// --ignore-submodules=none: submodule.<名前>.ignore・diff.ignoreSubmodules の設定があっても、サブモジュールの変更を拾う。
		// 健さんに渡るものにサブモジュールが入るかは外から確かめられないので、照らす側は多めに拾う（#60）
		const status = git(['status', '--porcelain', '-z', '-uall', '--ignore-submodules=none'], repoRoot);
		let diff = { code: 0, stdout: '' };
		if (opts.Base.trim() !== '') {
			// --no-renames: 名前を変えたファイルを「元の名前の削除」と「新しい名前の追加」に分け、両方のパスを出させる
			diff = git(['diff', '--name-only', '--no-renames', '-z', '--ignore-submodules=none', `${opts.Base}...HEAD`, '--'], repoRoot);
		}
		if (status.code !== 0) stopWrapper(`git status が失敗しました（Git のリポジトリですか？）: ${repoRoot}`);
		if (diff.code !== 0) stopWrapper(`git diff が失敗しました（基準ブランチ ${opts.Base} はありますか？）: ${repoRoot}`);
		// 各項目は「XY <パス>」。X か Y が R・C（名前を変えた・写した）の項目は、次の項目に元のパスだけが続く
		const entries = status.stdout.split('\0');
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (entry === '' || entry.length < 4) continue;
			const xy = entry.slice(0, 2);
			gitPaths.push(entry.slice(3));
			if (xy.includes('R') || xy.includes('C')) {
				i++;
				if (i < entries.length && entries[i] !== '') gitPaths.push(entries[i]);
			}
		}
		for (const p of diff.stdout.split('\0')) {
			if (p !== '') gitPaths.push(p);
		}
	}

	const configModuleLink = path.join(here, '..', '..', '..', 'hooks', 'ai-team-config.mjs');
	if (!isFile(configModuleLink)) stopWrapper(`共有モジュールが見つかりません: ${configModuleLink}`);
	const configModule = path.resolve(configModuleLink);

	// 作業の根と、メインのチェックアウト（worktree list の1件目）の根の両方で、設定ファイルを読む
	const checkRoots = [repoRoot];
	const mainRoot = getMainRoot(repoRoot);
	if (!sameLocation(mainRoot, repoRoot)) checkRoots.push(mainRoot);

	const { code: checkCode, out: checkOut } = runConfigCheck(configModule, checkRoots, gitPaths);
	if (checkCode === 3) {
		const secrets = [...new Set(checkOut.split('\n').filter((s) => s !== ''))];
		stopWrapper(`健さんに渡る変更に秘密情報のファイルがあるので、review を呼びません（未追跡・ステージ済み・書き換え・名前の変更・基準ブランチとの差分のどれも Codex に送られるため）: ${secrets.join(', ')}`);
	}
	if (checkCode === 2) {
		stopWrapper(`設定ファイル（.claude/ai-team.json）が壊れているので、健さんを呼びません（黙って既定の一覧に戻ると、足した秘密情報が守られないため）: ${checkOut}`);
	}
	if (checkCode !== 0) {
		stopWrapper(`秘密情報と設定ファイルの確かめが失敗しました（node の終了コード ${checkCode}）。`);
	}
	// 終了コード 0 でも、共有モジュールが印を書いていなければ、確かめが済んだか分からない（リンク経由の起動で何もせずに終わった場合など）
	if (checkOut.split('\n')[0].trim() !== 'ai-team-config: ok') {
		stopWrapper('秘密情報と設定ファイルの確かめが済んだか分からないので、健さんを呼びません（共有モジュールが印を返しませんでした）。');
	}

	// ---- -Container：コンテナの中で健さんを動かす（#99） ----
	if (opts.Container) {
		// 1. container の設定（共有モジュールが check の出力の2行目に書く）
		const line = checkOut.split('\n').find((l) => l.startsWith('container: '));
		if (line === undefined) stopWrapper('このリポジトリの .claude/ai-team.json に container（setup・test）がありません。README の「コンテナでのレビュー」のとおりに書いてください。');
		const container = JSON.parse(line.slice('container: '.length));
		// 2. この PC の codex の版と AGENTS.md
		const { version, agents } = checkCodexForContainer(codex);

		const workDir = makePrivateTempDir('codex-');
		const docker = makeDocker(deps);
		const state = { containers: [], volumes: [] };
		cleanups.push(() => cleanupContainer(docker, state, workDir));

		if (mode === 'check') {
			// 7〜9 だけ（イメージを作り、ログインを確かめる。健さんは呼ばない）
			const image = prepareDocker(docker, version, workDir);
			process.stdout.write(`CHECK: ok（設定ファイルを読めた。コンテナ：イメージ ${image}・ログインあり。健さんは呼んでいない）\n`);
			return 0;
		}

		// 4〜6. 送るものを決め、名前で確かめてから写す（docker はまだ呼ばない）
		let compare = 'HEAD';
		if (opts.Base.trim() !== '') {
			const mb = git(['merge-base', opts.Base, 'HEAD'], repoRoot);
			if (mb.code !== 0 || mb.stdout.trim() === '') stopWrapper(`基準ブランチ ${opts.Base} との分かれ目が分かりません。`);
			compare = mb.stdout.trim();
		}
		const untracked = makeSnapshot(repoRoot, compare, workDir, configModule, checkRoots);
		fs.writeFileSync(path.join(workDir, 'review', 'prompt.md'), buildContainerPrompt(container, untracked));

		// 7〜14
		const image = prepareDocker(docker, version, workDir);
		return reviewInContainer({ docker, image, workDir, container, agents, state });
	}

	// ---- check：ここまでの確かめだけで終わる（codex は呼ばない） ----
	if (mode === 'check') {
		process.stdout.write('CHECK: ok（設定ファイルを読めた。健さんは呼んでいない）\n');
		return 0;
	}

	// 一時ディレクトリ（終わったら消す）
	const workDir = makePrivateTempDir('codex-');
	cleanups.push(() => fs.rmSync(workDir, { recursive: true, force: true }));
	const lastMessage = path.join(workDir, 'last-message.md');

	let exitCode = 0;
	const refOriginals = [];
	switch (mode) {
		case 'consult': {
			// --skip-git-repo-check: Git のリポジトリでないフォルダ（サーバーのフォルダを持ってきた案件など）でも相談できるようにする（#97）
			const args = ['exec', '--ephemeral', '--color', 'never', '--skip-git-repo-check', '-s', 'read-only', '-C', repoRoot, '-o', lastMessage];
			exitCode = invokeCodex(codex, args, { stdin: prompt, cwd: callerDirectory, workDir });
			break;
		}

		case 'review': {
			// 健さんに渡る変更の秘密情報の確認は、一時ディレクトリを作る前に済ませてある
			// review は対象の指定と頼みの文を同時に受け付けない。決まりは健さんの AGENTS.md で持たせる
			const args = ['exec', 'review'];
			if (opts.Base.trim() === '') args.push('--uncommitted');
			else args.push('--base', opts.Base);
			args.push('-c', 'sandbox_mode=read-only', '-o', lastMessage);
			exitCode = invokeCodex(codex, args, { cwd: repoRoot, workDir });
			break;
		}

		case 'image': {
			if (opts.Image.trim() === '') stopWrapper('image には参照画像（-Image）を1枚以上渡してください。');
			// 参照画像は安全な名前でコピーし、このディレクトリに移動してから名前だけを渡す
			// （Codex の -i は値をカンマで分けるので、元の名前や親のパスにカンマがあると割れる）
			const refs = [];
			let i = 0;
			for (const raw of opts.Image.split('|')) {
				const src = raw.trim();
				if (src === '') continue;
				const full = path.isAbsolute(src) ? src : path.join(callerDirectory, src);
				if (!isFile(full)) stopWrapper(`参照画像が見つかりません: ${src}`);
				// 元のファイルの場所を控える（前に作った画像を参照に渡したとき、それを今回の出力と取り違えないため）
				refOriginals.push(path.resolve(full));
				i++;
				const name = `ref-${i}${path.extname(full).toLowerCase()}`;
				fs.copyFileSync(full, path.join(workDir, name));
				refs.push(name);
			}
			if (refs.length === 0) stopWrapper('image には参照画像（-Image）を1枚以上渡してください。');

			const args = ['exec', '--ephemeral', '--color', 'never', '--skip-git-repo-check', '-s', 'read-only', '-C', '.', '-o', lastMessage];
			for (const r of refs) args.push('-i', r);
			exitCode = invokeCodex(codex, args, { stdin: prompt, cwd: workDir, workDir });
			break;
		}
	}

	if (!isFile(lastMessage)) {
		if (exitCode === 0) exitCode = 1;
		stopWrapper(`健さんの返事が取れませんでした（終了コード ${exitCode}）。`, exitCode);
	}

	const reply = readUtf8(lastMessage);
	process.stdout.write(reply.endsWith('\n') ? reply : `${reply}\n`);

	if (mode === 'image' && exitCode === 0) {
		// 画像のパスは、健さんの答えの「IMAGE_PATH: <絶対パス>」の行だけから取る
		// （文章から正規表現でパスを探すと、空白・UNC・アポストロフィなどで取りこぼす。時刻で探すと別の依頼の画像を取り違える）
		const codexHome = (process.env.CODEX_HOME || '').trim() === '' ? path.join(os.homedir(), '.codex') : process.env.CODEX_HOME;
		const generatedRoot = path.resolve(codexHome, 'generated_images') + path.sep;
		let declared = null;
		for (const line of reply.split(/\r?\n/)) {
			const m = line.match(/^\s*IMAGE_PATH:\s*(.+?)\s*$/);
			if (m) declared = m[1];
		}
		let found = null;
		let why = '答えに「IMAGE_PATH: <絶対パス>」の行がありませんでした';
		if (declared !== null) {
			// 行全体がバッククォートで囲まれていたら外す（パスの中の引用符には触らない）
			if (declared.length >= 2 && declared.startsWith('`') && declared.endsWith('`')) declared = declared.slice(1, -1);
			why = `IMAGE_PATH の画像が見つかりません: ${declared}`;
			if (isFile(declared)) {
				const resolved = path.resolve(declared);
				const under = isUnderLocation(resolved, generatedRoot);
				if (!under) {
					why = `IMAGE_PATH が生成画像の保存先（${generatedRoot}）の下にありません: ${resolved}`;
				} else if (refOriginals.some((o) => sameCaseFolded(o, resolved))) {
					why = `IMAGE_PATH が今回渡した参照画像と同じです: ${resolved}`;
				} else {
					found = resolved;
				}
			}
		}
		if (found === null) stopWrapper(`${why}。コピーせずに止めてください。`, 2);
		process.stdout.write(`\nIMAGE: ${found}\n`);
	}

	return exitCode;
}

// ラッパーを動かす。deps.docker は docker の呼び方で、テストが偽物に差し替えるためだけにある（#99）
export function run(argv, deps = {}) {
	const cleanups = [];
	try {
		process.exitCode = main(cleanups, argv, deps);
	} catch (e) {
		if (e instanceof Stop) {
			process.stderr.write(`invoke-codex: ${e.message}\n`);
			process.exitCode = e.code;
		} else {
			process.stderr.write(`invoke-codex: 思わぬ失敗です: ${e && e.stack ? e.stack : e}\n`);
			process.exitCode = 1;
		}
	} finally {
		for (const f of cleanups) {
			try {
				f();
			} catch {
				// 後始末の失敗では止めない
			}
		}
	}
}

// 直接起動されたときだけ動く（テストは import して run を呼ぶ）。リンク経由の起動でも合うよう、両方を実体にそろえて比べる
function realOrNull(p) {
	try {
		return fs.realpathSync(p);
	} catch {
		return null;
	}
}
const entry = process.argv[1] ? realOrNull(process.argv[1]) : null;
const self = realOrNull(fileURLToPath(import.meta.url));
if (entry !== null && self !== null && sameLocation(entry, self)) run(process.argv.slice(2));
