#!/usr/bin/env node
// SessionStart フック：プラグイン ai-team のチーム共通の決まり（docs/team-rules.md）を、ガネーシャ（メインのエージェント）の文脈へ入れる。
// - 読めないとき、頭の2行を足した後の全体が1万文字（additionalContext の上限）を超えるときは、先頭だけを入れず、Read を促す文を入れる。
// - どの場合も終了コード 0 で終わる（セッションを止めない）。
// - 場所は、このフックのファイルから求める（キャッシュには古い版のフォルダも残るので、今の版の場所をここで渡す）。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LENGTH = 10000;

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(here, '..', 'docs', 'team-rules.md');
const workflowPath = path.resolve(here, '..', 'docs', 'workflow.md');

const header =
	`プラグイン ai-team のチーム共通の決まり（${rulesPath}）。リポジトリの固有の決まりは docs/team/common-rules.md\n` +
	`作業の流れ（workflow.md）は ${workflowPath}。スキルを使わずに作業するとき（簡単な修正の道など）は、ここを Read で読む\n`;

const readInstead =
	`チーム共通の決まり（${rulesPath}）を読めなかった、または長すぎて入れられなかった。Read で読んでから作業すること。` +
	`作業の流れ（workflow.md）は ${workflowPath}`;

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
