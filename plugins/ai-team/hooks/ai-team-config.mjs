#!/usr/bin/env node
// ガード（guard-code-edit.mjs）と健さんのラッパー（invoke-codex.ps1）の両方が使う判定の正本。
// - 秘密情報の既定の一覧
// - リンク（シンボリックリンク・ジャンクション）をたどる関数
// - グロブを正規表現に直す関数
// - 設定ファイル（.claude/ai-team.json）の読み込みと確かめ
// - 「直接コード」の印（まーちゅうの指示でガネーシャがコードを直せるしるし）の置き場所と読み方
// - ラッパーから呼ぶ入口（node ai-team-config.mjs check ...）
// リポジトリごとの追加は .claude/ai-team.json（secretPatterns・plannerWritable）に書く。このファイルは書き換えない。

import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 誰も編集できない・健さんも開かないパス（既定。設定ファイルで足せるが、外せない）。
// 先頭で固定しない（`(^|/)`）。worktree の中（.claude/worktrees/<名前>/.dev.vars）でも当たるようにする。
export const SECRET_PATTERNS = [/(^|\/)\.dev\.vars$/, /(^|\/)\.kv\//, /(^|\/)wp-config\.php$/, /(^|\/)\.env[^/]*$/];

// 設定ファイルの、リポジトリの根からの相対パス（候補の順。テンプレートのリポジトリは repo-files/claude/ai-team.json）
export const CONFIG_CANDIDATES = ['.claude/ai-team.json', 'repo-files/claude/ai-team.json'];

// 確かめが済んだときに --out の1行目へ書く印（ラッパーが読む）
export const OK_MARK = 'ai-team-config: ok';

const CONFIG_KEYS = ['secretPatterns', 'plannerWritable'];

// ---- 「直接コード」の印 ----
// まーちゅうが決まった言い方で指示したセッションにだけ付く。ガードは、メインのエージェントの行 8（コード）を、有効な印があるときだけ通す。
// 置き場所：<一時ディレクトリ>/ai-team-direct-edit/<session_id>（scratchpad の <一時ディレクトリ>/claude/ の外）。
// 中身：{"createdAt": <付けた時刻。1970年からのミリ秒の整数>}
export const MARK_DIR_NAME = 'ai-team-direct-edit';
export const MARK_TTL_MS = 24 * 60 * 60 * 1000;
export const MARK_FUTURE_MS = 5 * 60 * 1000;

export function markDir() {
	return path.join(tmpdir(), MARK_DIR_NAME);
}

// session_id はファイル名に使うので、英数字・-・_ の1〜128文字だけ受ける。
export function isValidSessionId(id) {
	return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function markPath(sessionId) {
	return path.join(markDir(), sessionId);
}

// 印の状態を返す。'valid'（有効）・'expired'（24時間より古い）・'none'（無い・読めない・壊れている・リンク・ハードリンクが2つ以上）。
// 未来の時刻は、5分先までは今と同じ、それより先は壊れているとする。
export function readMark(sessionId, now = Date.now()) {
	if (!isValidSessionId(sessionId)) {
		return 'none';
	}

	try {
		if (lstatSync(markDir()).isSymbolicLink()) {
			return 'none';
		}

		const file = markPath(sessionId);
		const stat = lstatSync(file);

		if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1) {
			return 'none';
		}

		const data = JSON.parse(readFileSync(file, 'utf8'));
		const createdAt = data && typeof data === 'object' ? data.createdAt : undefined;

		if (!Number.isSafeInteger(createdAt) || createdAt > now + MARK_FUTURE_MS) {
			return 'none';
		}

		return now - createdAt > MARK_TTL_MS ? 'expired' : 'valid';
	} catch {
		return 'none';
	}
}

// Windows のファイルシステムは大文字小文字を区別しない（.DEV.VARS と .dev.vars は同じファイル）。
// パターンとの照合も包含の判定も、Windows では小文字にそろえてから行う。
export function forMatch(p) {
	return process.platform === 'win32' ? p.toLowerCase() : p;
}

// そのパス自体がリンク（Windows のジャンクションを含む）か。リンク先の有無は問わない。
export function isLink(p) {
	try {
		return lstatSync(p).isSymbolicLink();
	} catch {
		return false;
	}
}

// シンボリックリンク（Windows のジャンクションを含む）をたどった実体のパス。
// まだ無いファイル（新規作成）は、存在する一番近い親ディレクトリの実体に、残りの部分をつなぐ。
// リンク先が無いリンク（壊れたリンク）は、実体を判定できないので null を返す（呼び出し側で止める）。
// 通常のまだ無いパスと区別しないと、リンクの見た目のパスで判定されて、リンク経由の新規作成が通ってしまう。
export function realPath(p) {
	let current = path.resolve(p);
	const rest = [];

	for (;;) {
		try {
			return path.join(realpathSync.native(current), ...rest);
		} catch {
			if (isLink(current)) {
				return null;
			}

			const parent = path.dirname(current);

			if (parent === current) {
				return path.resolve(p);
			}

			rest.unshift(path.basename(current));
			current = parent;
		}
	}
}

// グロブを正規表現に直す。壊れているグロブは Error を投げる。
// 記号は ** ・ * ・ ? だけ。ほかの文字は、正規表現の記号も含めて、ただの文字として当てる。
// - `**/`（先頭でも途中でも）は区切りごと省ける（0個以上のディレクトリ）
// - 最後の `/**` は区切りごと省ける（そのもの自身とその中）
// - `\` ・ `[` ・ `]` ・ `{` ・ `}` を含むもの、空の文字列、`/` で始まるものは壊れている
export function globToRegExp(glob) {
	if (typeof glob !== 'string' || glob === '') {
		throw new Error('グロブが空の文字列です');
	}

	if (glob.startsWith('/')) {
		throw new Error('グロブが / で始まっています');
	}

	if (/[\\[\]{}]/.test(glob)) {
		throw new Error('グロブに使えない文字（\\ [ ] { }）があります');
	}

	let source = '^';
	let i = 0;

	while (i < glob.length) {
		if (glob.startsWith('**/', i)) {
			source += '([\\s\\S]*/)?';
			i += 3;
		} else if (glob.startsWith('/**', i) && i + 3 === glob.length) {
			source += '(/[\\s\\S]*)?';
			i += 3;
		} else if (glob.startsWith('**', i)) {
			source += '[\\s\\S]*';
			i += 2;
		} else if (glob[i] === '*') {
			source += '[^/]*';
			i += 1;
		} else if (glob[i] === '?') {
			source += '[^/]';
			i += 1;
		} else {
			source += glob[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			i += 1;
		}
	}

	return new RegExp(source + '$');
}

// 設定ファイルの中身（バイト列）を読んで確かめる。足すグロブの一覧を返す。壊れていれば Error を投げる。
function parseConfig(buffer) {
	let bytes = buffer;

	// 文字コードは UTF-8 だけ。UTF-8 の BOM は取り除く。UTF-16・UTF-32 の BOM で始まるものは壊れている。
	if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
		bytes = bytes.subarray(3);
	} else if (
		(bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) ||
		(bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff)
	) {
		throw new Error('UTF-8 ではない文字コード（UTF-16・UTF-32）です');
	}

	let text;
	try {
		text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		throw new Error('UTF-8 として正しくないバイト列です');
	}

	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error('JSON として読めません');
	}

	if (data === null || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('最上位がオブジェクトではありません');
	}

	for (const key of Object.keys(data)) {
		if (!CONFIG_KEYS.includes(key)) {
			throw new Error(`知らないキーがあります（使えるのは ${CONFIG_KEYS.join('・')} だけ。大文字小文字は区別します）`);
		}
	}

	const result = {};

	for (const key of CONFIG_KEYS) {
		const value = data[key];

		if (value === undefined) {
			result[key] = [];
			continue;
		}

		if (!Array.isArray(value)) {
			throw new Error(`${key} が配列ではありません`);
		}

		const regexps = [];

		for (const item of value) {
			if (typeof item !== 'string') {
				throw new Error(`${key} に文字列でないものがあります`);
			}

			try {
				regexps.push(globToRegExp(item));
			} catch (e) {
				throw new Error(`${key} のグロブが壊れています（${e.message}）`);
			}
		}

		result[key] = regexps;
	}

	return result;
}

// 設定ファイルを読む。candidates は絶対パスの一覧で、前から順に見て、最初に「ある」ものを読む。
// 結果は次のどれか。
// - { status: 'none' }                                          … どの候補も無い（既定の一覧だけで動く）
// - { status: 'ok', file, secretRegexps, writableRegexps }      … 読めた
// - { status: 'broken', file, reason, link }                    … 壊れている。link は「リンク切れ」のとき真
// 設定ファイルか親のディレクトリがリンクで、リンク先が無いときは、「無い」ではなくリンク切れとして止める
// （足したパターンが黙って消えないため）。
export function readConfig(candidates, lstat = lstatSync) {
	for (const file of candidates) {
		if (realPath(file) === null) {
			return { status: 'broken', file, reason: 'リンク先が無いリンクです', link: true };
		}

		let exists = true;

		try {
			lstat(file);
		} catch (e) {
			// 無いことを示すもの（ENOENT・ENOTDIR）だけを「無い」とする。アクセス権などで読めないときは、黙って飛ばさず止める。
			if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
				exists = false;
			} else {
				return { status: 'broken', file, reason: '設定ファイルの有無を確かめられません（アクセス権など）', link: false };
			}
		}

		if (!exists) {
			continue;
		}

		try {
			const parsed = parseConfig(readFileSync(file));

			return { status: 'ok', file, secretRegexps: parsed.secretPatterns, writableRegexps: parsed.plannerWritable };
		} catch (e) {
			return { status: 'broken', file, reason: e.message, link: false };
		}
	}

	return { status: 'none' };
}

// パス（リポジトリの根からの相対パス。区切りは /）が、既定の一覧か足したグロブに当たるか。
// 照らす前に forMatch でそろえる。
export function isSecretPath(rel, extraRegexps = []) {
	const p = forMatch(rel);

	return SECRET_PATTERNS.some((re) => re.test(p)) || extraRegexps.some((re) => re.test(p));
}

// ---- ラッパーから呼ぶ入口 ----
// node ai-team-config.mjs check --root <根> [--root <根2>] --paths-file <ファイル> --out <ファイル> [--resolve-real]
// --resolve-real：各パス（最初の --root からの相対パス）の実体（リンクをたどった先）も照らす。実体が根の外・実体を判定できない（リンク切れ）ときも当たりとする。
// ファイルの中身を渡すとき（make-patch）に付ける。付けないときの動きは変えない
// 終了コード：0 = 当たるパスなし / 1 = 引数やファイルの読み込みの失敗 / 2 = 設定ファイルが壊れている / 3 = 秘密情報に当たるパスがある
function cli(argv) {
	const [command, ...rest] = argv;
	const roots = [];
	let pathsFile = '';
	let outFile = '';
	let resolveReal = false;

	for (let i = 0; i < rest.length; i++) {
		if (rest[i] === '--root' && i + 1 < rest.length) {
			roots.push(rest[++i]);
		} else if (rest[i] === '--paths-file' && i + 1 < rest.length) {
			pathsFile = rest[++i];
		} else if (rest[i] === '--out' && i + 1 < rest.length) {
			outFile = rest[++i];
		} else if (rest[i] === '--resolve-real') {
			resolveReal = true;
		} else {
			process.stderr.write(`ai-team-config: 知らない引数です: ${rest[i]}\n`);
			return 1;
		}
	}

	if (command !== 'check' || roots.length === 0 || pathsFile === '' || outFile === '') {
		process.stderr.write('ai-team-config: 使い方: check --root <根> [--root <根2>] --paths-file <ファイル> --out <ファイル> [--resolve-real]\n');
		return 1;
	}

	let paths;

	try {
		paths = readFileSync(pathsFile).toString('utf8').split('\0').filter((p) => p !== '');
	} catch (e) {
		process.stderr.write(`ai-team-config: パスの一覧を読めません: ${e.message}\n`);
		return 1;
	}

	const extra = [];

	for (const root of roots) {
		const config = readConfig(CONFIG_CANDIDATES.map((c) => path.join(root, ...c.split('/'))));

		if (config.status === 'broken') {
			try {
				writeFileSync(outFile, `${config.file} を読めません（${config.reason}）`);
			} catch (e) {
				process.stderr.write(`ai-team-config: 出力を書けません: ${e.message}\n`);
				return 1;
			}

			return 2;
		}

		if (config.status === 'ok') {
			extra.push(...config.secretRegexps);
		}
	}

	const hits = paths.filter((p) => isSecretPath(p.replace(/\\/g, '/'), extra));

	if (resolveReal) {
		const base = roots[0];
		const baseReal = realPath(base);

		for (const p of paths) {
			if (hits.includes(p)) {
				continue;
			}

			const real = realPath(path.join(base, ...p.replace(/\\/g, '/').split('/')));

			if (real === null || baseReal === null) {
				hits.push(p);
				continue;
			}

			const rel = path.relative(baseReal, real);

			if (rel === '') {
				continue;
			}

			if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
				hits.push(p);
				continue;
			}

			if (isSecretPath(rel.replace(/\\/g, '/'), extra)) {
				hits.push(p);
			}
		}
	}

	if (hits.length > 0) {
		try {
			writeFileSync(outFile, hits.join('\n'));
		} catch (e) {
			process.stderr.write(`ai-team-config: 出力を書けません: ${e.message}\n`);
			return 1;
		}

		return 3;
	}

	// 終了コード 0 のときも印を書く（ラッパーは印が無ければ「確かめが済んだか分からない」として止まる）
	try {
		writeFileSync(outFile, `${OK_MARK}
`);
	} catch (e) {
		process.stderr.write(`ai-team-config: 出力を書けません: ${e.message}
`);
		return 1;
	}

	return 0;
}

// 直接実行されたか。process.argv[1] と import.meta.url は、リンク（ジャンクション・シンボリックリンク）経由だと
// 片方だけ実体のパスになるので、両方を実体にそろえてから比べる。
const self = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? realPath(process.argv[1]) : null;
const selfReal = realPath(self);

if (entry !== null && selfReal !== null && forMatch(entry) === forMatch(selfReal)) {
	process.exit(cli(process.argv.slice(2)));
}
