#!/usr/bin/env node
// guard-code-edit.mjs の確かめ。フックに入力の JSON を流して、終了コードと標準出力を見る。
// 使い方：node .claude/hooks/test-guard-code-edit.mjs（このリポジトリのテンプレートでは node claude/hooks/test-guard-code-edit.mjs）
// 期待は 0（通す。標準出力は空）・2（止める）・'ask'（終了コード0で、標準出力の JSON が確認を求める）。
// git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
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

function judgeResult(name, result, expected) {
	let ok;
	if (expected === 'ask') {
		let parsed = null;
		try {
			parsed = JSON.parse(result.stdout);
		} catch {
			parsed = null;
		}
		const out = parsed && parsed.hookSpecificOutput;
		ok =
			result.status === 0 &&
			Boolean(out) &&
			out.hookEventName === 'PreToolUse' &&
			out.permissionDecision === 'ask' &&
			typeof out.permissionDecisionReason === 'string' &&
			out.permissionDecisionReason !== '';
	} else if (expected === 0) {
		ok = result.status === 0 && result.stdout.trim() === '';
	} else {
		ok = result.status === expected;
	}
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}（期待 ${expected}・実際 ${result.status}）`);
}

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
	judgeResult(name, result, expected);
}

function runRaw(name, raw, expected) {
	const result = spawnSync(process.execPath, [hook], {
		input: raw,
		env: { ...process.env, CLAUDE_PROJECT_DIR: project },
		encoding: 'utf8',
	});
	judgeResult(name, result, expected);
}

const MAIN = {};
const MEJED = { agent: 'mejed' };
const OTHER = { agent: 'general-purpose' };
const p = (...parts) => path.join(project, ...parts);
const WT = '.claude/worktrees/x';
const WT2 = '.claude/worktrees/x/.claude/worktrees/y';

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
	run('wt main: docs/tasks/ は通る', { file: p(WT, 'docs', 'tasks', 't', 'review.md') }, 0);
	run('wt other: コードは止まる', { file: p(WT, 'src', 'a.php'), ...OTHER }, 2);
	run('wt mejed: .env は止まる', { file: p(WT, '.env'), ...MEJED }, 2);
	run('wt mejed: .dev.vars は止まる', { file: p(WT, '.dev.vars'), ...MEJED }, 2);
	run('wt mejed: wp-config.php は止まる', { file: p(WT, 'wp-config.php'), ...MEJED }, 2);
	run('wt main: .env は止まる', { file: p(WT, '.env.local') }, 2);

	// ---- 新しい判定の表（メインのチェックアウトと worktree の中の両方・3つの役） ----
	const roles = [
		['ガネーシャ', MAIN],
		['メジェド', MEJED],
		['ほかのサブエージェント', OTHER],
	];
	// [名前, リポジトリの根からの相対パス, ガネーシャ, メジェド, ほかのサブエージェント]
	const table = [
		['2 秘密情報', '.dev.vars', 2, 2, 2],
		['3 .claude/', '.claude/agents/a.md', 'ask', 'ask', 'ask'],
		['3 .claude/hooks/', '.claude/hooks/guard-code-edit.mjs', 'ask', 'ask', 'ask'],
		['3 .claude/settings.json', '.claude/settings.json', 'ask', 'ask', 'ask'],
		['4 docs/team/', 'docs/team/common-rules.md', 'ask', 'ask', 'ask'],
		['4 根の CLAUDE.md', 'CLAUDE.md', 'ask', 'ask', 'ask'],
		['4 似た名前 docs/teams/', 'docs/teams/a.php', 2, 0, 2],
		['4 似た名前 docs/team（ファイル）', 'docs/team', 2, 0, 2],
		['4 docs/x/CLAUDE.md は .md なので通る', 'docs/x/CLAUDE.md', 0, 0, 0],
		['5 plan.md', 'docs/tasks/x/plan.md', 0, 2, 0],
		['6 review.md', 'docs/tasks/x/review.md', 0, 0, 0],
		['6 .md', 'README.md', 0, 0, 0],
		['6 根の .gitignore', '.gitignore', 0, 0, 0],
		['6 下の階層の .gitignore', 'sub/.gitignore', 0, 0, 0],
		['6 .gitattributes', '.gitattributes', 0, 0, 0],
		['6 .github/ISSUE_TEMPLATE/', '.github/ISSUE_TEMPLATE/bug.yml', 0, 0, 0],
		['7 コード', 'src/a.php', 2, 0, 2],
		['7 .github/workflows/', '.github/workflows/ci.yml', 2, 0, 2],
		['7 docs/tasks/x/plan.md の下の階層は plan.md ではない', 'docs/tasks/x/y/plan.md', 0, 0, 0],
	];
	for (const [label, rel, ...expects] of table) {
		roles.forEach(([roleName, role], i) => {
			run(`表 main ${label}: ${roleName}`, { file: p(...rel.split('/')), ...role }, expects[i]);
			run(`表 wt ${label}: ${roleName}`, { file: p(...WT.split('/'), ...rel.split('/')), ...role }, expects[i]);
		});
	}
	// 1 リポジトリの外（worktree の中は無い）
	roles.forEach(([roleName, role]) => {
		run(`表 1 リポジトリの外: ${roleName}`, { file: path.join(outside, 'a.md'), ...role }, 2);
	});

	// ---- 3・4 の細かいところ ----
	run('wt mejed: worktree の中のフックは ask', { file: p(WT, '.claude', 'hooks', 'guard-code-edit.mjs'), ...MEJED }, 'ask');
	run('wt main: worktree の中のスキルは ask', { file: p(WT, '.claude', 'skills', 's', 'SKILL.md') }, 'ask');
	run('3: .claude/worktrees 直下のファイルは今のまま（ガネーシャは止まる）', { file: p('.claude', 'worktrees', 'a.php') }, 2);
	run('3: .claude/worktrees/x そのものは今のまま（ガネーシャは止まる）', { file: p(WT) }, 2);
	run('3: .claude/worktrees/x そのものは今のまま（メジェドは通る）', { file: p(WT), ...MEJED }, 0);

	// ---- 入れ子の worktree ----
	run('入れ子: .claude/agents は ask', { file: p(...WT2.split('/'), '.claude', 'agents', 'a.md') }, 'ask');
	run('入れ子: plan.md はメジェドが止まる', { file: p(...WT2.split('/'), 'docs', 'tasks', 't', 'plan.md'), ...MEJED }, 2);
	run('入れ子: plan.md はガネーシャが通る', { file: p(...WT2.split('/'), 'docs', 'tasks', 't', 'plan.md') }, 0);
	run('入れ子: コードはガネーシャが止まる', { file: p(...WT2.split('/'), 'src', 'a.php') }, 2);

	// ---- 境界 ----
	// \ 区切りは Windows でだけ区切りになるので、Windows でだけ回す
	if (process.platform === 'win32') {
		run('境界: \\ 区切りが同じ判定（mejed）', { file: `${project}\\.claude\\worktrees\\x\\a.php`, ...MEJED }, 0);
		run('境界: \\ 区切りが同じ判定（main）', { file: `${project}\\.claude\\worktrees\\x\\a.php` }, 2);
		run('境界: \\ 区切りの worktree 内 .claude は ask', { file: `${project}\\.claude\\worktrees\\x\\.claude\\agents\\a.md` }, 'ask');
		run('境界: 大文字小文字が同じ判定（mejed）', { file: `${project}\\.CLAUDE\\Worktrees\\x\\a.php`, ...MEJED }, 0);
		run('境界: 大文字小文字が同じ判定（main）', { file: `${project}\\.CLAUDE\\Worktrees\\x\\a.php` }, 2);
		run('境界: 大文字小文字が違う DOCS\\Team も ask', { file: `${project}\\DOCS\\Team\\a.md` }, 'ask');
	}
	run('境界: 名前が .kv だと、ガネーシャの docs/tasks/ も止まる', { file: p('.claude', 'worktrees', '.kv', 'docs', 'tasks', 'a.md') }, 2);
	run('境界: 名前が .kv だと、メジェドも止まる', { file: p('.claude', 'worktrees', '.kv', 'a.php'), ...MEJED }, 2);
	run('境界: ../ で .env に出る', { file: p(WT, '..', '..', '.env'), ...MEJED }, 2);
	run('境界: ../ でメインのコードに出る（main）', { file: p(WT, '..', '..', '..', 'src', 'a.js') }, 2);
	run('境界: worktree そのものはガネーシャが止まる', { file: p(WT) }, 2);
	run('境界: .claude/worktrees 直下（名前なし）の .php はガネーシャが止まる', { file: p('.claude', 'worktrees', 'a.php') }, 2);

	// ---- リンク（きつい方を取る） ----
	// Windows はジャンクション、それ以外はシンボリックリンク。リンク元はコードでない名前（.md）、リンク先は守るところ。
	const linkType = process.platform === 'win32' ? 'junction' : 'dir';
	mkdirSync(p('docs', 'team'), { recursive: true });
	mkdirSync(p('.kv'), { recursive: true });
	symlinkSync(p('docs', 'team'), p('notes'), linkType);
	symlinkSync(p('.kv'), p('vault'), linkType);
	run('リンク: リンク元が .md でリンク先が docs/team/ なら ask（ガネーシャ）', { file: p('notes', 'a.md') }, 'ask');
	run('リンク: リンク元が .md でリンク先が docs/team/ なら ask（メジェド）', { file: p('notes', 'a.md'), ...MEJED }, 'ask');
	run('リンク: リンク先が秘密情報なら止まる（ガネーシャ）', { file: p('vault', 'a.md') }, 2);
	run('リンク: リンク先が秘密情報なら止まる（メジェド）', { file: p('vault', 'a.md'), ...MEJED }, 2);

	// ---- settings.json ----
	const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
	const ask = settings.permissions?.ask || [];
	const deny = settings.permissions?.deny || [];
	const check = (label, ok) => {
		if (!ok) {
			failed++;
		}
		console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
	};

	for (const rule of [
		'Bash(git -C:*)',
		'Bash(git -c:*)',
		'Bash(git --git-dir*)',
		'Bash(git --work-tree*)',
		'Bash(git --no-pager:*)',
		'Bash(git stash:*)',
		'Bash(git restore:*)',
		'Bash(git clean:*)',
		'Bash(git rm:*)',
		'Bash(git branch:*)',
		'Bash(git worktree remove:*)',
	]) {
		check(`settings.json の ask に ${rule} がある`, ask.includes(rule));
	}

	// deny と ask の Bash のルールすべてに、同じ形の PowerShell のルールがある
	for (const [listName, list] of [
		['ask', ask],
		['deny', deny],
	]) {
		for (const rule of list.filter((r) => r.startsWith('Bash('))) {
			const ps = rule.replace(/^Bash\(/, 'PowerShell(');
			check(`settings.json の ${listName} に ${ps} がある`, list.includes(ps));
		}
	}

	// フックの登録は、シェルを通さない書き方
	const registered = (settings.hooks?.PreToolUse || []).flatMap((entry) => entry.hooks || []);
	const guard = registered.find((h) => (h.args || []).some((a) => a.includes('guard-code-edit.mjs')));
	check(
		'settings.json のフックが command と args の形で、${CLAUDE_PROJECT_DIR} を使っている',
		Boolean(guard) && guard.command === 'node' && guard.args[0].startsWith('${CLAUDE_PROJECT_DIR}/')
	);
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
