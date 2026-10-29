#!/usr/bin/env node
// invoke-codex.mjs
// Claude Code（ガネーシャ・メジェド）から Codex CLI（健さん）を呼ぶラッパー。Windows・Mac・Linux で動く（#100）。
// モードは consult（読むだけの相談）・review（読むだけのレビュー）・image（画像の生成）の3つだけ。
// と、codex を呼ばない check（秘密情報と設定ファイルの確かめだけ。allow が効くかを、Codex の枠を使わずに確かめるため）。
// 実装（ファイルの書き換え）は頼まない。sandbox は常に read-only。返事は標準出力に出すだけで、保存しない。
//
// 呼び方（リポジトリの根から、Bash ツールで）:
//   node "${CLAUDE_PLUGIN_ROOT}/skills/codex/scripts/invoke-codex.mjs" -Mode consult -PromptFile <一時ファイル>
//
// 引数の名前は、前の invoke-codex.ps1 と同じ（-Mode・-PromptFile・-WorkingDirectory・-Image・-Base・-Task）。
// 大文字小文字の違いは受ける。略した形（-M など）は受けない。
//
// 終了コード: 0 = 成功 / 1 = 呼ぶ前の確認で止めた / 2 = image で画像のパスが取れなかった / それ以外 = codex の終了コード

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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

// パスの比べ方（Windows は大文字小文字を区別しない）
function samePath(a, b) {
	return isWindows ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// ---- 引数 ----

const OPTIONS = ['Mode', 'PromptFile', 'WorkingDirectory', 'Image', 'Base', 'Task'];
const MODES = ['consult', 'review', 'image', 'check'];

function parseArgs(argv) {
	const opts = { Mode: '', PromptFile: '', WorkingDirectory: '', Image: '', Base: '', Task: '' };
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		const name = token.startsWith('-') ? OPTIONS.find((o) => `-${o}`.toLowerCase() === token.toLowerCase()) : undefined;
		if (name === undefined) stopWrapper(`知らない引数です: ${token}（使えるのは ${OPTIONS.map((o) => `-${o}`).join('・')}）`);
		if (i + 1 >= argv.length) stopWrapper(`${token} の値がありません。`);
		opts[name] = argv[++i];
	}
	const mode = MODES.find((m) => m === opts.Mode.toLowerCase());
	if (mode === undefined) stopWrapper(`-Mode は ${MODES.join('・')} のどれかにしてください: ${opts.Mode}`);
	opts.Mode = mode;
	// -Task は使わない（返事を保存していたころのタスク名）。古い呼び方（gh-skills の gh-pr など）で渡されても止めないよう、受け取って捨てる
	return opts;
}

// ---- codex の探し方 ----
// Windows：PATH から codex を探し、.exe ならそのまま起動する。npm のシム（.cmd・.ps1）なら、隣の
// node_modules/@openai/codex/bin/codex.js を今の node で直接起動する（シェルを通さない。実行ポリシーで止まらず、
// .cmd を通したときの引数の引用の崩れも無い）。隣に無ければ（pnpm・bun などで入れた）、直し方を出して止める。
// Mac・Linux：PATH の codex をそのまま起動する。
function findCodex() {
	const dirs = (process.env.PATH || '').split(path.delimiter).filter((d) => d.trim() !== '');
	for (const dir of dirs) {
		if (isWindows) {
			const exe = path.join(dir, 'codex.exe');
			if (isFile(exe)) return { command: exe, prefix: [] };
			const shim = ['codex.cmd', 'codex.ps1', 'codex'].map((n) => path.join(dir, n)).find(isFile);
			if (shim !== undefined) {
				const js = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
				if (isFile(js)) return { command: process.execPath, prefix: [js] };
				stopWrapper(`codex のシム（${shim}）の隣に node_modules/@openai/codex/bin/codex.js がありません（pnpm・bun などで入れたときの形）。npm install -g @openai/codex で入れ直すか、codex.exe を PATH に置いてください。`);
			}
		} else {
			const bin = path.join(dir, 'codex');
			if (isExecutable(bin)) return { command: bin, prefix: [] };
		}
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

// git を呼ぶ（失敗しても例外にせず、終了コードと出力を返す）
function git(args, cwd) {
	const r = spawnSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024 });
	return { code: r.status === null ? 1 : r.status, stdout: r.stdout ? r.stdout.toString('utf8') : '' };
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
	const fd = fs.openSync(logFile, 'w');
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

function main(cleanups) {
	const opts = parseArgs(process.argv.slice(2));
	const mode = opts.Mode;

	// ---- 呼ぶ前の確認 ----

	let codex = null;
	if (mode !== 'check') {
		codex = findCodex();
		if (codex === null) stopWrapper('codex が PATH にありません。npm install -g @openai/codex で入れて、codex login を打ってから呼んでください。');
	}

	const callerDirectory = process.cwd();
	const workingDirectory = opts.WorkingDirectory.trim() === '' ? callerDirectory : opts.WorkingDirectory;
	if (!isDirectory(workingDirectory)) stopWrapper(`作業の根が見つかりません: ${workingDirectory}`);
	const repoRoot = path.resolve(workingDirectory);

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
	if (!samePath(mainRoot, repoRoot)) checkRoots.push(mainRoot);

	const checkDir = path.join(os.tmpdir(), 'claude', `codex-check-${randomUUID().replace(/-/g, '')}`);
	fs.mkdirSync(checkDir, { recursive: true });
	let checkCode = 1;
	let checkOut = '';
	try {
		const checkPathsFile = path.join(checkDir, 'paths.bin');
		const checkOutFile = path.join(checkDir, 'out.txt');
		// NUL 区切りの UTF-8（BOM なし）。標準入出力を通さず、ファイルで渡す
		fs.writeFileSync(checkPathsFile, Buffer.from(gitPaths.join('\0'), 'utf8'));
		const nodeArgs = [configModule, 'check'];
		for (const root of checkRoots) nodeArgs.push('--root', root);
		nodeArgs.push('--paths-file', checkPathsFile, '--out', checkOutFile);
		const r = spawnSync(process.execPath, nodeArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
		checkCode = r.status === null ? 1 : r.status;
		if (isFile(checkOutFile)) checkOut = readUtf8(checkOutFile);
	} finally {
		fs.rmSync(checkDir, { recursive: true, force: true });
	}
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

	// ---- check：ここまでの確かめだけで終わる（codex は呼ばない） ----
	if (mode === 'check') {
		process.stdout.write('CHECK: ok（設定ファイルを読めた。健さんは呼んでいない）\n');
		return 0;
	}

	// 一時ディレクトリ（終わったら消す）
	const workDir = path.join(os.tmpdir(), 'claude', `codex-${randomUUID().replace(/-/g, '')}`);
	fs.mkdirSync(workDir, { recursive: true });
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
				const under = isWindows ? resolved.toLowerCase().startsWith(generatedRoot.toLowerCase()) : resolved.startsWith(generatedRoot);
				if (!under) {
					why = `IMAGE_PATH が生成画像の保存先（${generatedRoot}）の下にありません: ${resolved}`;
				} else if (refOriginals.some((o) => samePath(o, resolved))) {
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

const cleanups = [];
try {
	process.exitCode = main(cleanups);
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
