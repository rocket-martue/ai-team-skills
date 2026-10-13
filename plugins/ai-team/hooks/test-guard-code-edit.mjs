#!/usr/bin/env node
// guard-code-edit.mjs の確かめ。フックに入力の JSON を流して、終了コードと標準出力を見る。
// 使い方：リポジトリの根から node plugins/ai-team/hooks/test-guard-code-edit.mjs（テンプレートのリポジトリでだけ打つ。repo-files/claude/settings.json を読むため）
// 期待は 0（通す。標準出力は空）・2（止める）・'ask'（終了コード0で、標準出力の JSON が確認を求める）。
// git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(here, 'guard-code-edit.mjs');
const settingsPath = path.join(here, '..', '..', '..', 'repo-files', 'claude', 'settings.json');
const hooksJsonPath = path.join(here, 'hooks.json');

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

// session と tmp は印の確かめ用。tmp を渡すと、子のプロセスの一時ディレクトリ（TEMP・TMP・TMPDIR）を仮の場所に向ける。
function run(name, { file, agent = 'main', proj = project, session, tmp }, expected) {
	const input = { tool_name: 'Edit', tool_input: { file_path: file }, cwd: proj };
	if (session !== undefined) {
		input.session_id = session;
	}
	if (agent !== 'main') {
		input.agent_id = 'a1';
		input.agent_type = agent;
	}
	const env = { ...process.env, CLAUDE_PROJECT_DIR: proj };
	if (tmp !== undefined) {
		env.TEMP = tmp;
		env.TMP = tmp;
		env.TMPDIR = tmp;
	}
	const result = spawnSync(process.execPath, [hook], {
		input: JSON.stringify(input),
		env,
		encoding: 'utf8',
	});
	judgeResult(name, result, expected);
	return result;
}

const check = (label, ok) => {
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

const trySymlinkSafe = (target, linkPath, type) => {
	try {
		symlinkSync(target, linkPath, type);
		return true;
	} catch {
		return false;
	}
};

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

	// ---- プラグインのエージェント名（ai-team:mejed） ----
	const PLUGIN_MEJED = { agent: 'ai-team:mejed' };
	run('ai-team:mejed: コードは通る', { file: p('src', 'a.js'), ...PLUGIN_MEJED }, 0);
	run('ai-team:mejed: plan.md は止まる', { file: p('docs', 'tasks', 't', 'plan.md'), ...PLUGIN_MEJED }, 2);
	run('ai-team:mejed: .dev.vars は止まる', { file: p('.dev.vars'), ...PLUGIN_MEJED }, 2);
	run('ai-team:adversary: コードは止まる', { file: p('src', 'a.js'), agent: 'ai-team:adversary' }, 2);
	run('other:mejed: コードは止まる', { file: p('src', 'a.js'), agent: 'other:mejed' }, 2);

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

	// ---- 設定ファイル（.claude/ai-team.json） ----
	const configPath = p('.claude', 'ai-team.json');
	// 設定ファイルを書いて fn を回し、消す。content は文字列かバッファ
	const withConfig = (content, fn) => {
		mkdirSync(p('.claude'), { recursive: true });
		writeFileSync(configPath, content);
		try {
			fn();
		} finally {
			rmSync(configPath, { force: true });
		}
	};
	const j = (obj) => JSON.stringify(obj);
	const both = (label, file, expected) => {
		run(`設定 ${label}: ガネーシャ`, { file }, expected);
		run(`設定 ${label}: メジェド`, { file, ...MEJED }, expected);
	};

	// 設定ファイルが無いとき：ここまでの確かめが全部、今までどおり通っている
	run('設定: 設定ファイルが無ければ docs/tasks/ は通る', { file: p('docs', 'tasks', 'x', 'plan.md') }, 0);

	withConfig(j({ secretPatterns: ['**/.wrangler/**'] }), () => {
		both('.wrangler/ は止まる', p('.wrangler', 'state.json'), 2);
		both('sub/.wrangler/x は止まる', p('sub', '.wrangler', 'x'), 2);
		both('worktree の中の .wrangler/ は止まる', p(WT, '.wrangler', 'x'), 2);
		both('U+2028 を含む .wrangler/ のファイル名も止まる', p('.wrangler', 'state .json'), 2);
		both('改行を含む .wrangler/ のファイル名も止まる', p('.wrangler', 'state\n.json'), 2);
		run('設定: wrangler.toml は止まらない（メジェド）', { file: p('wrangler.toml'), ...MEJED }, 0);
		run('設定: 既定の .dev.vars は設定があっても止まる', { file: p('.dev.vars'), ...MEJED }, 2);
		run('設定: 設定ファイル自体は ask', { file: configPath }, 'ask');
		run('設定: 設定ファイル自体は ask（メジェド）', { file: configPath, ...MEJED }, 'ask');
	});

	withConfig(j({ secretPatterns: ['private/**/token.json'] }), () => {
		run('設定: private/token.json は止まる', { file: p('private', 'token.json'), ...MEJED }, 2);
		run('設定: private/a/b/token.json は止まる', { file: p('private', 'a', 'b', 'token.json'), ...MEJED }, 2);
		run('設定: private/token.jsonx は止まらない', { file: p('private', 'token.jsonx'), ...MEJED }, 0);
	});

	withConfig(j({ plannerWritable: ['data/*.json'] }), () => {
		run('設定: data/a.json はガネーシャが通る', { file: p('data', 'a.json') }, 0);
		run('設定: data/a.json はほかのサブエージェントも通る', { file: p('data', 'a.json'), ...OTHER }, 0);
		run('設定: data/sub/a.json は止まる', { file: p('data', 'sub', 'a.json') }, 2);
		run('設定: data/a.jsonx は止まる', { file: p('data', 'a.jsonx') }, 2);
	});

	withConfig(j({ plannerWritable: ['data/?.json'] }), () => {
		run('設定: data/a.json は通る（? は1文字）', { file: p('data', 'a.json') }, 0);
		run('設定: data/ab.json は止まる', { file: p('data', 'ab.json') }, 2);
	});

	withConfig(j({ plannerWritable: ['a.b/x(1).md.txt'] }), () => {
		run('設定: 正規表現の記号はただの文字（当たる）', { file: p('a.b', 'x(1).md.txt') }, 0);
		run('設定: 正規表現の記号はただの文字（. は任意の1文字ではない）', { file: p('axb', 'x(1).md.txt') }, 2);
	});

	// 壊れているとき：すべての編集を止める。設定ファイル自体は ask
	const broken = [
		['JSON として壊れている', '{ not json'],
		['知らないキー（大文字小文字違い）', j({ SecretPatterns: [] })],
		['文字列の配列でない（文字列）', j({ secretPatterns: 'x' })],
		['文字列の配列でない（数）', j({ secretPatterns: [1] })],
		['最上位が配列', '[]'],
		['グロブが壊れている [ab]', j({ secretPatterns: ['[ab]'] })],
		['グロブが壊れている {a,b}', j({ plannerWritable: ['{a,b}'] })],
		['グロブが空', j({ secretPatterns: [''] })],
		['グロブが / で始まる', j({ secretPatterns: ['/x'] })],
		['グロブにバックスラッシュを含む', j({ secretPatterns: ['a\\b'] })],
		['UTF-16LE（BOM 付き）', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(j({ secretPatterns: [] }), 'utf16le')])],
	];
	for (const [label, content] of broken) {
		withConfig(content, () => {
			run(`設定が壊れている（${label}）: docs/tasks/x/plan.md も止まる`, { file: p('docs', 'tasks', 'x', 'plan.md') }, 2);
			run(`設定が壊れている（${label}）: メジェドのコードも止まる`, { file: p('src', 'a.js'), ...MEJED }, 2);
			run(`設定が壊れている（${label}）: scratchpad も止まる`, { file: path.join(tmpdir(), 'claude', 'a.txt') }, 2);
			run(`設定が壊れている（${label}）: 設定ファイル自体は ask`, { file: configPath }, 'ask');
		});
	}

	// 設定ファイルの中身（秘密情報かもしれない）を、止める理由に出さない
	withConfig('API_KEY=abc123secret', () => {
		const input = { tool_name: 'Edit', tool_input: { file_path: p('src', 'a.js') }, cwd: project };
		const r = spawnSync(process.execPath, [hook], {
			input: JSON.stringify(input),
			env: { ...process.env, CLAUDE_PROJECT_DIR: project },
			encoding: 'utf8',
		});
		const leaked = `${r.stdout}${r.stderr}`.includes('abc123secret');
		const ok = r.status === 2 && !leaked;
		if (!ok) {
			failed++;
		}
		console.log(`${ok ? 'ok  ' : 'FAIL'} 設定の中身が止める理由に出ない（終了コード ${r.status}・漏れ ${leaked}）`);
	});

	// 文字コード：UTF-8 の BOM 付きで中身が正しければ、判定する
	withConfig(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(j({ secretPatterns: ['**/.wrangler/**'] }), 'utf8')]), () => {
		run('設定: UTF-8 の BOM 付きでも読める（.wrangler/ が止まる）', { file: p('.wrangler', 'x'), ...MEJED }, 2);
		run('設定: UTF-8 の BOM 付きでも読める（ほかは通る）', { file: p('src', 'a.js'), ...MEJED }, 0);
	});

	// secretPatterns が設定ファイル自体に当たっても、設定ファイルは ask。ほかは今までどおり
	withConfig(j({ secretPatterns: ['.claude/ai-team.json'] }), () => {
		run('設定: 自分に当たるグロブがあっても設定ファイルは ask', { file: configPath }, 'ask');
		run('設定: 自分に当たるグロブがあっても設定ファイルは ask（メジェド）', { file: configPath, ...MEJED }, 'ask');
		run('設定: 自分に当たるグロブがあってもほかの編集は今までどおり', { file: p('src', 'a.js'), ...MEJED }, 0);
	});

	// 設定ファイルが読めたときの設定ファイルの編集は ask
	withConfig(j({}), () => {
		run('設定: 読めたときの設定ファイルの編集は ask', { file: configPath }, 'ask');
		run('設定: 読めたときの設定ファイルの編集は ask（メジェド）', { file: configPath, ...MEJED }, 'ask');
	});

	// リンク（作れない環境では飛ばす）
	const trySymlink = (target, linkPath, type) => {
		try {
			symlinkSync(target, linkPath, type);
			return true;
		} catch {
			return false;
		}
	};

	// 設定ファイルが、リンク先のある .env へのシンボリックリンク
	mkdirSync(p('.claude'), { recursive: true });
	writeFileSync(p('.env'), j({}));
	if (trySymlink(p('.env'), configPath, 'file')) {
		run('設定: 設定ファイルが .env へのリンクなら、設定ファイルの編集は止まる', { file: configPath }, 2);
		run('設定: 設定ファイルが .env へのリンクなら、設定ファイルの編集は止まる（メジェド）', { file: configPath, ...MEJED }, 2);
		unlinkSync(configPath);
	} else {
		console.log('skip 設定ファイルが .env へのリンクの確かめ（シンボリックリンクを作れない環境）');
	}
	rmSync(p('.env'), { force: true });

	// 設定ファイルがリンク切れのシンボリックリンク
	if (trySymlink(p('no-such-target.json'), configPath, 'file')) {
		run('設定: 設定ファイルがリンク切れなら docs/tasks/x/plan.md も止まる', { file: p('docs', 'tasks', 'x', 'plan.md') }, 2);
		run('設定: 設定ファイルがリンク切れなら設定ファイル自体も止まる', { file: configPath }, 2);
		run('設定: 設定ファイルがリンク切れなら設定ファイル自体も止まる（メジェド）', { file: configPath, ...MEJED }, 2);
		unlinkSync(configPath);
	} else {
		console.log('skip 設定ファイルがリンク切れの確かめ（シンボリックリンクを作れない環境）');
	}

	// 親の .claude がリンク切れ（ジャンクション）
	{
		const proj2 = path.join(sandbox, 'repo2');
		const gone = path.join(sandbox, 'gone');
		mkdirSync(proj2, { recursive: true });
		mkdirSync(gone, { recursive: true });
		if (trySymlink(gone, path.join(proj2, '.claude'), linkType)) {
			rmSync(gone, { recursive: true, force: true });
			run('設定: 親の .claude がリンク切れなら docs/tasks/x/plan.md も止まる', { file: path.join(proj2, 'docs', 'tasks', 'x', 'plan.md'), proj: proj2 }, 2);
			run('設定: 親の .claude がリンク切れなら設定ファイル自体も止まる', { file: path.join(proj2, '.claude', 'ai-team.json'), proj: proj2 }, 2);
		} else {
			console.log('skip 親の .claude がリンク切れの確かめ（リンクを作れない環境）');
		}
	}

	// ---- 直接コードの印（まーちゅうの指示。direct-edit-mark.mjs が付ける） ----
	{
		const fakeTmp = path.join(sandbox, 'faketmp');
		const markRoot = path.join(fakeTmp, 'ai-team-direct-edit');
		mkdirSync(markRoot, { recursive: true });
		const HOUR = 60 * 60 * 1000;
		const setMark = (session, content) => {
			mkdirSync(markRoot, { recursive: true });
			writeFileSync(path.join(markRoot, session), typeof content === 'string' ? content : JSON.stringify(content));
		};
		const fresh = () => ({ createdAt: Date.now() });
		const code = p('src', 'a.js');
		const withMark = (session, extra = {}) => ({ file: code, session, tmp: fakeTmp, ...extra });

		setMark('S1', fresh());
		run('印: 印があるメインの src/a.js は通る', withMark('S1'), 0);
		run('印: 印が無いセッションは止まる', withMark('S9'), 2);
		run('印: session_id が無いと止まる', { file: code, tmp: fakeTmp }, 2);
		setMark('S2', fresh());
		run('印: ほかのセッションの印では止まる', withMark('S3'), 2);
		run('印: worktree の中のコードも、印があれば通る', { file: p(WT, 'src', 'a.js'), session: 'S1', tmp: fakeTmp }, 0);
		run('印: 印があっても .dev.vars は止まる', { file: p('.dev.vars'), session: 'S1', tmp: fakeTmp }, 2);
		run('印: 印があってもリポジトリの外は止まる', { file: path.join(outside, 'a.js'), session: 'S1', tmp: fakeTmp }, 2);
		run('印: 印があっても .claude/ の下は ask', { file: p('.claude', 'agents', 'a.md'), session: 'S1', tmp: fakeTmp }, 'ask');
		run('印: 印があっても docs/team/ の下は ask', { file: p('docs', 'team', 'a.md'), session: 'S1', tmp: fakeTmp }, 'ask');
		run('印: 印があっても plan.md は今までどおり通る', { file: p('docs', 'tasks', 'x', 'plan.md'), session: 'S1', tmp: fakeTmp }, 0);
		run('印: ほかのサブエージェントは印があっても止まる', withMark('S1', OTHER), 2);
		run('印: メジェドは今までどおり通る（印が無くても）', withMark('S9', MEJED), 0);
		run('印: メジェドの plan.md は今までどおり止まる', { file: p('docs', 'tasks', 'x', 'plan.md'), session: 'S1', tmp: fakeTmp, ...MEJED }, 2);

		setMark('Sold', { createdAt: Date.now() - 25 * HOUR });
		const expiredResult = run('印: 24時間より古い印では止まる', withMark('Sold'), 2);
		check('印: 24時間より古い印の理由に、印が切れたことが入る', expiredResult.stderr.includes('24時間で切れました'));
		const noMarkResult = run('印: 印が無いときの理由は今のまま', withMark('S9'), 2);
		check(
			'印: 印が無いときの理由に、印のことは書かない',
			!noMarkResult.stderr.includes('印') && noMarkResult.stderr.includes('mejed サブエージェントに任せてください')
		);
		setMark('Sfuture4', { createdAt: Date.now() + 4 * 60 * 1000 });
		run('印: 4分先の時刻は今と同じに扱う（通る）', withMark('Sfuture4'), 0);
		setMark('Sfuture6', { createdAt: Date.now() + 6 * 60 * 1000 });
		run('印: 5分より先の時刻は止まる', withMark('Sfuture6'), 2);
		setMark('Sbad1', 'not json');
		run('印: JSON でない中身は止まる', withMark('Sbad1'), 2);
		setMark('Sbad2', { createdAt: 1.5 });
		run('印: createdAt が整数でないと止まる（小数）', withMark('Sbad2'), 2);
		setMark('Sbad3', { createdAt: String(Date.now()) });
		run('印: createdAt が整数でないと止まる（文字列）', withMark('Sbad3'), 2);
		setMark('Sbad4', {});
		run('印: createdAt が無いと止まる', withMark('Sbad4'), 2);
		run('印: session_id が不正（../）なら止まる', withMark('../S1'), 2);

		// リンク・ハードリンク（作れない環境では飛ばす）
		const victim = path.join(sandbox, 'mark-victim.json');
		writeFileSync(victim, JSON.stringify(fresh()));
		if (trySymlinkSafe(victim, path.join(markRoot, 'Slink'), 'file')) {
			run('印: 印のファイルがシンボリックリンクなら止まる', withMark('Slink'), 2);
		} else {
			console.log('skip 印のファイルがシンボリックリンクの確かめ（シンボリックリンクを作れない環境）');
		}
		let hardLinked = true;
		try {
			linkSync(path.join(markRoot, 'S1'), path.join(sandbox, 'mark-alias'));
		} catch {
			hardLinked = false;
		}
		if (hardLinked) {
			run('印: ハードリンクが2つ以上ある印は止まる', withMark('S1'), 2);
			unlinkSync(path.join(sandbox, 'mark-alias'));
			run('印: ハードリンクの別名を消せば、また通る', withMark('S1'), 0);
		} else {
			console.log('skip ハードリンクの確かめ（作れない環境）');
		}
		{
			const linkTmp = path.join(sandbox, 'linktmp');
			const realMarks = path.join(sandbox, 'realmarks');
			mkdirSync(linkTmp, { recursive: true });
			mkdirSync(realMarks, { recursive: true });
			writeFileSync(path.join(realMarks, 'S1'), JSON.stringify(fresh()));
			if (trySymlinkSafe(realMarks, path.join(linkTmp, 'ai-team-direct-edit'), process.platform === 'win32' ? 'junction' : 'dir')) {
				run('印: 置き場所のディレクトリがリンクなら止まる', { file: code, session: 'S1', tmp: linkTmp }, 2);
			} else {
				console.log('skip 置き場所のディレクトリがリンクの確かめ（リンクを作れない環境）');
			}
		}

		// 印の置き場所への編集は、誰でも止める（リポジトリを置き場所の上で開いたときも含む）
		const inMark = path.join(markRoot, 'Snew');
		for (const [roleName, role] of roles) {
			run(`印: 置き場所への編集は止まる（${roleName}・仮の一時ディレクトリを開いたとき）`, { file: inMark, proj: fakeTmp, session: 'S1', tmp: fakeTmp, ...role }, 2);
			run(`印: 置き場所への編集は止まる（${roleName}・別のリポジトリを開いたとき）`, { file: inMark, session: 'S1', tmp: fakeTmp, ...role }, 2);
			run(`印: 置き場所そのものへの編集も止まる（${roleName}）`, { file: markRoot, proj: fakeTmp, session: 'S1', tmp: fakeTmp, ...role }, 2);
			run(`印: 既にある印への編集も止まる（${roleName}）`, { file: path.join(markRoot, 'S1'), proj: fakeTmp, session: 'S1', tmp: fakeTmp, ...role }, 2);
		}
		run(
			'印: 仮の一時ディレクトリを開いたとき、置き場所の外のコードは今までどおり（メジェドは通る）',
			{ file: path.join(fakeTmp, 'src', 'a.js'), proj: fakeTmp, session: 'S9', tmp: fakeTmp, ...MEJED },
			0
		);
	}

	// ---- settings.json ----
	const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
	const ask = settings.permissions?.ask || [];
	const deny = settings.permissions?.deny || [];
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
		'Bash(git pull:*)',
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

	// readConfig: lstat が ENOENT 以外で失敗するとき（アクセス権の失敗は環境で作れないので、lstat を差し替えて確かめる）
	{
		const { readConfig } = await import('./ai-team-config.mjs');
		const failWith = (code) => () => {
			const e = new Error('secret-looking text');
			e.code = code;
			throw e;
		};
		const cand = [path.join(project, '.claude', 'ai-team.json')];
		const eacces = readConfig(cand, failWith('EACCES'));
		check('readConfig: lstat が EACCES で失敗したら壊れている扱い', eacces.status === 'broken' && !eacces.link);
		check('readConfig: 壊れている理由に OS のエラーの文を入れない', eacces.status === 'broken' && !eacces.reason.includes('secret-looking'));
		check('readConfig: lstat が ENOENT なら無い扱い', readConfig(cand, failWith('ENOENT')).status === 'none');
		check('readConfig: lstat が ENOTDIR なら無い扱い', readConfig(cand, failWith('ENOTDIR')).status === 'none');
	}

	// check --resolve-real：リンクの先の実体も照らす（ジャンクションを作れない環境では飛ばす）
	{
		const configModule = path.join(here, 'ai-team-config.mjs');
		const rootR = path.join(sandbox, 'resolve-real');
		const far = path.join(sandbox, 'resolve-real-far');
		mkdirSync(path.join(rootR, '.kv'), { recursive: true });
		mkdirSync(path.join(rootR, 'src'), { recursive: true });
		mkdirSync(far, { recursive: true });
		writeFileSync(path.join(rootR, '.kv', 'a.md'), 'x');
		writeFileSync(path.join(rootR, 'src', 'a.md'), 'x');
		writeFileSync(path.join(far, 'a.md'), 'x');
		const runCheck = (relPaths, flag) => {
			const pathsFile = path.join(sandbox, 'resolve-real-paths.bin');
			const outFile = path.join(sandbox, 'resolve-real-out.txt');
			writeFileSync(pathsFile, relPaths.join('\0'));
			rmSync(outFile, { force: true });
			const args = [configModule, 'check', '--root', rootR, '--paths-file', pathsFile, '--out', outFile];
			if (flag) {
				args.push('--resolve-real');
			}
			const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
			return r.status;
		};
		let linked = true;
		try {
			symlinkSync(path.join(rootR, '.kv'), path.join(rootR, 'vault'), 'junction');
			symlinkSync(far, path.join(rootR, 'outside'), 'junction');
		} catch {
			linked = false;
		}
		if (linked) {
			check('check: 親が .kv/ へのジャンクションのパスは、--resolve-real なしでは通る（今までどおり）', runCheck(['vault/a.md'], false) === 0);
			check('check --resolve-real: 親が .kv/ へのジャンクションのパスは止まる（終了コード 3）', runCheck(['vault/a.md'], true) === 3);
			check('check --resolve-real: 実体が根の外のパスは止まる（終了コード 3）', runCheck(['outside/a.md'], true) === 3);
			check('check --resolve-real: ふつうのパスは通る', runCheck(['src/a.md'], true) === 0);
			check('check --resolve-real: まだ無いファイル（ジャンクションの下の新規）も止まる', runCheck(['vault/new.md'], true) === 3);
		} else {
			console.log('skip check --resolve-real の確かめ（ジャンクションを作れない環境）');
		}
		check('check --resolve-real: ふつうのパスは通る（リンクが無くても）', runCheck(['src/a.md'], true) === 0);
		check('check --resolve-real: 付けても、直接 .kv/ のパスは止まる', runCheck(['.kv/a.md'], true) === 3);
	}

	// フックの登録（プラグインの hooks/hooks.json）は、シェルを通さない書き方
	const pluginHooks = JSON.parse(readFileSync(hooksJsonPath, 'utf8')).hooks || {};
	const preEntries = pluginHooks.PreToolUse || [];
	const guardEntry = preEntries.find((entry) =>
		(entry.hooks || []).some((h) => (h.args || []).some((a) => a.includes('guard-code-edit.mjs')))
	);
	const guard = guardEntry && guardEntry.hooks.find((h) => (h.args || []).some((a) => a.includes('guard-code-edit.mjs')));
	check(
		'hooks.json の PreToolUse が Edit|Write|MultiEdit|NotebookEdit に、ガードを command と args の形（${CLAUDE_PLUGIN_ROOT}）で登録している',
		Boolean(guard) &&
			guardEntry.matcher === 'Edit|Write|MultiEdit|NotebookEdit' &&
			guard.command === 'node' &&
			guard.args[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/guard-code-edit.mjs'
	);
	const sessionHooks = (pluginHooks.SessionStart || []).flatMap((entry) => entry.hooks || []);
	check(
		'hooks.json の SessionStart に session-start.mjs が登録されている',
		sessionHooks.some((h) => h.command === 'node' && (h.args || [])[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs')
	);
	// 印のフック（direct-edit-mark.mjs）の登録
	const markCommand = (h) => h.command === 'node' && (h.args || [])[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/direct-edit-mark.mjs';
	const hooksOf = (name) => (pluginHooks[name] || []).flatMap((e) => e.hooks || []);
	check('hooks.json の UserPromptSubmit に direct-edit-mark.mjs が登録されている', hooksOf('UserPromptSubmit').some(markCommand));
	check('hooks.json の SessionEnd に direct-edit-mark.mjs が登録されている', hooksOf('SessionEnd').some(markCommand));
	check(
		'hooks.json の SessionStart の matcher resume に direct-edit-mark.mjs が登録されている',
		(pluginHooks.SessionStart || []).some((e) => e.matcher === 'resume' && (e.hooks || []).some(markCommand))
	);
	check(
		'hooks.json の SessionStart の session-start.mjs は matcher なしで残っている',
		(pluginHooks.SessionStart || []).some(
			(e) =>
				e.matcher === undefined &&
				(e.hooks || []).some((h) => h.command === 'node' && (h.args || [])[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs')
		)
	);
	check('settings.json に hooks が無い（ガードのフックはプラグインに移った）', settings.hooks === undefined);
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
