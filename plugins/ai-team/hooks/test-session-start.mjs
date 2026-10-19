#!/usr/bin/env node
// session-start.mjs の確かめ。フックを呼んで、終了コードと標準出力（JSON）を見る。
// 使い方：リポジトリの根から node plugins/ai-team/hooks/test-session-start.mjs
// 仮の置き場所（フックのファイルを一時ディレクトリに写したもの）で、読めないとき・長すぎるときを確かめる。依存なし。

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LENGTH = 10000;

const here = path.dirname(fileURLToPath(import.meta.url));
const realHook = path.join(here, 'session-start.mjs');
const realRules = path.resolve(here, '..', 'docs', 'team-rules.md');

let failed = 0;

function check(name, ok) {
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
}

function call(hook) {
	const result = spawnSync(process.execPath, [hook], { input: '{}', encoding: 'utf8' });
	let parsed = null;
	try {
		parsed = JSON.parse(result.stdout);
	} catch {
		parsed = null;
	}
	const out = parsed && parsed.hookSpecificOutput;

	return { status: result.status, out, context: out && typeof out.additionalContext === 'string' ? out.additionalContext : '' };
}

// 仮の置き場所：<sandbox>/<name>/hooks/session-start.mjs と <sandbox>/<name>/docs/team-rules.md
const sandbox = mkdtempSync(path.join(tmpdir(), 'session-start-test-'));

function fake(name, rules) {
	const root = path.join(sandbox, name);
	mkdirSync(path.join(root, 'hooks'), { recursive: true });
	mkdirSync(path.join(root, 'docs'), { recursive: true });
	copyFileSync(realHook, path.join(root, 'hooks', 'session-start.mjs'));
	if (rules !== null) {
		writeFileSync(path.join(root, 'docs', 'team-rules.md'), rules, 'utf8');
	}

	return {
		hook: path.join(root, 'hooks', 'session-start.mjs'),
		rules: path.join(root, 'docs', 'team-rules.md'),
	};
}

try {
	// 今の team-rules.md
	const actual = call(realHook);
	const rulesText = readFileSync(realRules, 'utf8');
	check('今の team-rules.md: 終了コード 0', actual.status === 0);
	check('今の team-rules.md: hookEventName が SessionStart', Boolean(actual.out) && actual.out.hookEventName === 'SessionStart');
	check('今の team-rules.md: additionalContext が1万文字以下', actual.context.length > 0 && actual.context.length <= MAX_LENGTH);
	check('今の team-rules.md: team-rules.md の中身を含む', actual.context.includes(rulesText.trim()));
	check(
		'今の team-rules.md: team-rules.md の絶対パスが入っている',
		actual.context.includes(realRules)
	);

	// team-rules.md が無い
	const missing = fake('missing', null);
	const missingResult = call(missing.hook);
	check('team-rules.md が無い: 終了コード 0', missingResult.status === 0);
	check('team-rules.md が無い: Read を促す文になる', missingResult.context.includes('Read で読んでから作業すること'));
	check(
		'team-rules.md が無い: 絶対パスが入っている',
		missingResult.context.includes(missing.rules)
	);

	// 1万文字を超える
	const huge = fake('huge', 'あ'.repeat(MAX_LENGTH + 100));
	const hugeResult = call(huge.hook);
	check('1万文字を超える: 終了コード 0', hugeResult.status === 0);
	check('1万文字を超える: Read を促す文になり、中身を入れない', hugeResult.context.includes('Read で読んでから作業すること') && !hugeResult.context.includes('ああああ'));
	check('1万文字を超える: 絶対パスが入っている', hugeResult.context.includes(huge.rules));

	// 中身は1万文字以下だが、頭の行を足すと超える（境目）
	const probe = fake('edge-prbe', 'x');
	const probeContext = call(probe.hook).context;
	const headerLength = probeContext.length - 1; // 中身 'x' の1文字を引く
	const justOver = fake('edge-over', 'x'.repeat(MAX_LENGTH - headerLength + 1));
	const justOverResult = call(justOver.hook);
	check('境目（中身は1万文字以下・頭を足すと超える）: 中身が1万文字以下', MAX_LENGTH - headerLength + 1 <= MAX_LENGTH);
	check('境目: 終了コード 0', justOverResult.status === 0);
	check('境目: Read を促す文になる', justOverResult.context.includes('Read で読んでから作業すること') && !justOverResult.context.includes('xxxx'));
	check('境目: 絶対パスが入っている', justOverResult.context.includes(justOver.rules));

	// ちょうど1万文字（収まる側の境目）
	const justFit = fake('edge-fits', 'x'.repeat(MAX_LENGTH - headerLength));
	const justFitResult = call(justFit.hook);
	check('境目の内側（全体がちょうど1万文字）: 中身が入る', justFitResult.context.length === MAX_LENGTH && justFitResult.context.includes('xxxx'));
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
