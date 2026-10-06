#!/usr/bin/env node
// guard-code-edit.mjs の確かめ。フックに入力の JSON を流して、終了コードを見る。
// 使い方：node .claude/hooks/test-guard-code-edit.mjs（このリポジトリのテンプレートでは node claude/hooks/test-guard-code-edit.mjs）
// git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(here, 'guard-code-edit.mjs');
const settingsPath = path.join(here, '..', 'settings.json');

// 仮のリポジトリ。一時ディレクトリの claude/ の下は scratchpad として通るので、避けた名前にする。
const sandbox = mkdtempSync(path.join(tmpdir(), 'guard-test-'));
const project = path.join(sandbox, 'repo');
const outside = path.join(sandbox, 'elsewhere');
mkdirSync(project, { recursive: true });
mkdirSync(outside, { recursive: true });

let failed = 0;

function run(name, { file, agent = 'main' }, expected) {
	const input = { tool_name: 'Edit', tool_input: { file_path: file }, cwd: project };
	if (agent !== 'main') {
		input.agent_id = 'a1';
		input.agent_type = agent;
	}
	const result = spawnSync(process.execPath, [hook], {
		input: JSON.stringify(input),
		env: { ...process.env, CLAUDE_PROJECT_DIR: project },
		encoding: 'utf8',
	});
	const ok = result.status === expected;
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}（期待 ${expected}・実際 ${result.status}）`);
}

function runRaw(name, raw, expected) {
	const result = spawnSync(process.execPath, [hook], {
		input: raw,
		env: { ...process.env, CLAUDE_PROJECT_DIR: project },
		encoding: 'utf8',
	});
	const ok = result.status === expected;
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}（期待 ${expected}・実際 ${result.status}）`);
}

const MEJED = { agent: 'mejed' };
const OTHER = { agent: 'general-purpose' };
const p = (...parts) => path.join(project, ...parts);
const WT = '.claude/worktrees/x';

try {
	// ---- 今までの判定 ----
	run('main: メインのコードは止まる', { file: p('src', 'a.js') }, 2);
	run('main: docs/tasks/ は通る', { file: p('docs', 'tasks', 't', 'plan.md') }, 0);
	run('main: .md は通る', { file: p('README.md') }, 0);
	run('mejed: コードは通る', { file: p('src', 'a.js'), ...MEJED }, 0);
	run('mejed: .dev.vars は止まる', { file: p('.dev.vars'), ...MEJED }, 2);
	run('other: コードは止まる', { file: p('src', 'a.js'), ...OTHER }, 2);
	run('main: リポジトリの外は止まる', { file: path.join(outside, 'a.md') }, 2);
	run('main: メモリは通る', { file: path.join(homedir(), '.claude', 'projects', 'p', 'memory', 'a.md') }, 0);
	run('main: scratchpad は通る', { file: path.join(tmpdir(), 'claude', 'a.txt') }, 0);
	run('main: ~/.claude/settings.json は止まる', { file: path.join(homedir(), '.claude', 'settings.json') }, 2);
	runRaw('JSON でない入力は止まる', 'not json', 2);

	// ---- worktree の中 ----
	run('wt mejed: コードは通る', { file: p(WT, 'src', 'a.php'), ...MEJED }, 0);
	run('wt mejed: 直下のファイルは通る', { file: p(WT, 'a.php'), ...MEJED }, 0);
	run('wt mejed: まだ無い深い階層は通る', { file: p(WT, 'a', 'b', 'c', 'new.php'), ...MEJED }, 0);
	run('wt main: コードは止まる', { file: p(WT, 'src', 'a.php') }, 2);
	run('wt main: .md は通る', { file: p(WT, 'README.md') }, 0);
	run('wt main: docs/tasks/ は通る', { file: p(WT, 'docs', 'tasks', 't', 'plan.md') }, 0);
	run('wt other: コードは止まる', { file: p(WT, 'src', 'a.php'), ...OTHER }, 2);
	run('wt mejed: .env は止まる', { file: p(WT, '.env'), ...MEJED }, 2);
	run('wt mejed: .dev.vars は止まる', { file: p(WT, '.dev.vars'), ...MEJED }, 2);
	run('wt mejed: wp-config.php は止まる', { file: p(WT, 'wp-config.php'), ...MEJED }, 2);
	run('wt main: .env は止まる', { file: p(WT, '.env.local') }, 2);

	// ---- 境界 ----
	run('境界: \\ 区切りが同じ判定（mejed）', { file: `${project}\\.claude\\worktrees\\x\\a.php`, ...MEJED }, 0);
	run('境界: \\ 区切りが同じ判定（main）', { file: `${project}\\.claude\\worktrees\\x\\a.php` }, 2);
	if (process.platform === 'win32') {
		run('境界: 大文字小文字が同じ判定（mejed）', { file: `${project}\\.CLAUDE\\Worktrees\\x\\a.php`, ...MEJED }, 0);
		run('境界: 大文字小文字が同じ判定（main）', { file: `${project}\\.CLAUDE\\Worktrees\\x\\a.php` }, 2);
	}
	run('境界: 名前が .kv だと、ガネーシャの docs/tasks/ も止まる', { file: p('.claude', 'worktrees', '.kv', 'docs', 'tasks', 'a.md') }, 2);
	run('境界: 名前が .kv だと、メジェドも止まる', { file: p('.claude', 'worktrees', '.kv', 'a.php'), ...MEJED }, 2);
	run('境界: ../ で .env に出る', { file: p(WT, '..', '..', '.env'), ...MEJED }, 2);
	run('境界: ../ でメインのコードに出る（main）', { file: p(WT, '..', '..', '..', 'src', 'a.js') }, 2);
	run('境界: worktree そのものはガネーシャが止まる', { file: p(WT) }, 2);
	run('境界: .claude/worktrees 直下（名前なし）の .php はガネーシャが止まる', { file: p('.claude', 'worktrees', 'a.php') }, 2);

	// ---- settings.json ----
	const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
	const ask = settings.permissions?.ask || [];
	for (const rule of [
		'Bash(git -C:*)',
		'Bash(git -c:*)',
		'Bash(git --git-dir*)',
		'Bash(git --work-tree*)',
		'Bash(git --no-pager:*)',
	]) {
		const ok = ask.includes(rule);
		if (!ok) {
			failed++;
		}
		console.log(`${ok ? 'ok  ' : 'FAIL'} settings.json の ask に ${rule} がある`);
	}
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
