#!/usr/bin/env node
// SessionStart フック：プラグイン ai-team のチーム共通の決まり（docs/team-rules.md）を、ガネーシャ（メインのエージェント）の文脈へ入れる。
// - 読めないとき、頭の行を足した後の全体が1万文字（additionalContext の上限）を超えるときは、先頭だけを入れず、Read を促す文を入れる。
// - 設定は、プロジェクトの根とそのメインのチェックアウトの根（worktree のとき）の .claude/ai-team.json（無ければ repo-files/claude/ai-team.json）から読む（ガードと同じ。#108）。
// - リポジトリの .claude/ai-team.json に names（呼び名の対応）があれば、頭の行の後に対応の1行を入れる（Read を促す文のときも入れる）。
// - どの場合も終了コード 0 で終わる（セッションを止めない）。設定ファイルが壊れていても止めず、呼び名は既定のままと書く。
// - 場所は、このフックのファイルから求める（キャッシュには古い版のフォルダも残るので、今の版の場所をここで渡す）。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LENGTH = 10000;

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(here, '..', 'docs', 'team-rules.md');

// フックの入力（JSON）。読めなくても止めない。
let input = {};
try {
	input = JSON.parse(readFileSync(0, 'utf8')) || {};
} catch {
	input = {};
}

// 呼び名の対応の1行（無ければ空の文字列）。部品が読めない・設定ファイルが無いときも空にする。
async function namesLine() {
	const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

	try {
		const { readConfig, gitRoots, forPath, CONFIG_CANDIDATES, DEFAULT_NAMES } = await import('./ai-team-config.mjs');
		// target が dir の中（dir そのものを含む）か。ガード（guard-code-edit.mjs）の isInside と同じ形
		const normalize = (p) => forPath(path.resolve(p).split(path.sep).join('/'));
		const isInside = (target, dir) => {
			const t = normalize(target);
			const d = normalize(dir);

			return t === d || t.startsWith(d.endsWith('/') ? d : d + '/');
		};
		const candidatesOf = (root) => CONFIG_CANDIDATES.map((c) => path.join(root, ...c.split('/')));

		// 読む根：プロジェクトの根と、そのメインのチェックアウトの根（ガードと同じ。#108）。
		// gitRoots が壊れていても止めず、メインの根を読まないだけ。
		const loadedProject = readConfig(candidatesOf(projectDir));
		let loadedMain = { status: 'none' };
		let mainRoot = null;
		let checkoutRoot = null;

		try {
			const roots = gitRoots(projectDir);

			if (roots !== null && !roots.broken) {
				checkoutRoot = roots.root;
			}

			if (roots !== null && !roots.broken && roots.main !== null && forPath(path.resolve(roots.main)) !== forPath(path.resolve(projectDir))) {
				mainRoot = roots.main;
				loadedMain = readConfig(candidatesOf(mainRoot));
			}
		} catch {
			loadedMain = { status: 'none' };
		}

		if (loadedProject.status === 'broken' || loadedMain.status === 'broken') {
			const brokenFile = loadedProject.status === 'broken' ? loadedProject.file : loadedMain.file;
			// プロジェクトの外にあるときは「直せない」と言う（ガードと同じ isInside。ガードはプロジェクトの外の編集を止めるため）。
			// 置き場所は、同じチェックアウトの親フォルダか、ほかのチェックアウト（worktree のメイン）かで言い分ける
			const outside = !isInside(brokenFile, projectDir);
			const sameCheckout = checkoutRoot !== null && isInside(brokenFile, checkoutRoot);
			const how = !outside
				? '設定ファイルそのものは Edit で直せる'
				: sameCheckout
					? 'このセッションからは直せない（プロジェクトの親フォルダにある設定ファイル。その場所を開いたセッションか、手で直す）'
					: 'このセッションからは直せない（プロジェクトの外にある設定ファイル。メインのチェックアウトで直す）';

			return `.claude/ai-team.json を読めないので、呼び名は既定のまま（直すまで、ガードは設定ファイルのほかの編集を止め、健さんも呼ばない。${how}）\n`;
		}

		// 呼び名は、プロジェクトの根の設定を先に使い、無ければメインの根のもの
		const loaded = loadedProject.status === 'ok' && Object.keys(loadedProject.names).length > 0 ? loadedProject : loadedMain;

		if (loaded.status !== 'ok' || Object.keys(loaded.names).length === 0) {
			return '';
		}

		const pairs = DEFAULT_NAMES.filter((name) => loaded.names[name] !== undefined).map((name) => `${name}＝${loaded.names[name]}`);

		return `このリポジトリの呼び名：${pairs.join('、')}。決まりや定義の文書の名前は既定の名前で書いてあるので、この対応で読み替える（呼び出しの名前 ai-team:mejed・ai-team:adversary・codex・/code-review は変わらない）\n`;
	} catch {
		return '';
	}
}

const names = await namesLine();

const header = `プラグイン ai-team のチーム共通の決まり（${rulesPath}）。リポジトリの固有の決まりは docs/team/common-rules.md\n${names}`;

const readInstead = `${names}チーム共通の決まり（${rulesPath}）を読めなかった、または長すぎて入れられなかった。Read で読んでから作業すること。`;

let context;
try {
	const body = readFileSync(rulesPath, 'utf8').replace(/^﻿/, '');
	context = header + '\n' + body;
	if (context.length > MAX_LENGTH) {
		context = readInstead;
	}
} catch {
	context = readInstead;
}

process.stdout.write(
	JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } })
);
process.exit(0);
