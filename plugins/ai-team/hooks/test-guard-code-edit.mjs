#!/usr/bin/env node
// guard-code-edit.mjs の確かめ。フックに入力の JSON を流して、終了コードを見る。
// 使い方：リポジトリの根から node plugins/ai-team/hooks/test-guard-code-edit.mjs（テンプレートのリポジトリでだけ打つ。repo-files/claude/settings.json を読むため）
// 期待は 0（通す。標準出力は空）・2（止める）。
// git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
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
	const ok = expected === 0 ? result.status === 0 && result.stdout.trim() === '' : result.status === expected;
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}（期待 ${expected}・実際 ${result.status}）`);
}

function run(name, { file, agent = 'main', proj = project }, expected) {
	const input = { tool_name: 'Edit', tool_input: { file_path: file }, cwd: proj };
	if (agent !== 'main') {
		input.agent_id = 'a1';
		input.agent_type = agent;
	}
	const result = spawnSync(process.execPath, [hook], {
		input: JSON.stringify(input),
		env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
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

// リンク（作れない環境では飛ばす）
const trySymlink = (target, linkPath, type) => {
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

const MEJED = { agent: 'ai-team:mejed' };
const OTHER = { agent: 'general-purpose' };
const p = (...parts) => path.join(project, ...parts);
const WT = '.claude/worktrees/x';
const WT2 = '.claude/worktrees/x/.claude/worktrees/y';

try {
	// ---- 誰が編集しても同じ判定（メインのチェックアウトと worktree の中の両方） ----
	const roles = [
		['ガネーシャ', {}],
		['メジェド', MEJED],
		['ほかのサブエージェント', OTHER],
	];
	// [名前, リポジトリの根からの相対パス, 期待]
	const table = [
		['秘密情報 .dev.vars', '.dev.vars', 2],
		['秘密情報 .env', '.env', 2],
		['秘密情報 .env.local', '.env.local', 2],
		['秘密情報 wp-config.php', 'wp-config.php', 2],
		['秘密情報 .kv/', '.kv/a.json', 2],
		['下の階層の秘密情報', 'sub/.env', 2],
		['コード', 'src/a.php', 0],
		['.md', 'README.md', 0],
		['docs/tasks/', 'docs/tasks/x/plan.md', 0],
		['.claude/settings.json', '.claude/settings.json', 0],
		['docs/team/', 'docs/team/common-rules.md', 0],
		['根の CLAUDE.md', 'CLAUDE.md', 0],
		['.github/workflows/', '.github/workflows/ci.yml', 0],
	];
	for (const [label, rel, expected] of table) {
		for (const [roleName, role] of roles) {
			run(`表 main ${label}: ${roleName}`, { file: p(...rel.split('/')), ...role }, expected);
			run(`表 wt ${label}: ${roleName}`, { file: p(...WT.split('/'), ...rel.split('/')), ...role }, expected);
		}
	}

	// ---- リポジトリの外 ----
	for (const [roleName, role] of roles) {
		run(`外: リポジトリの外は止まる（${roleName}）`, { file: path.join(outside, 'a.md'), ...role }, 2);
	}
	run('外: メモリは通る', { file: path.join(homedir(), '.claude', 'projects', 'p', 'memory', 'a.md') }, 0);
	run('外: 計画ファイルは通る', { file: path.join(homedir(), '.claude', 'plans', 'a.md') }, 0);
	run('外: scratchpad は通る', { file: path.join(tmpdir(), 'claude', 'a.txt') }, 0);
	run('外: ~/.claude/settings.json は止まる', { file: path.join(homedir(), '.claude', 'settings.json') }, 2);
	run('外: ~/.claude/skills/ は止まる', { file: path.join(homedir(), '.claude', 'skills', 's', 'SKILL.md') }, 2);
	run('外: scratchpad の中でも .env は止まる', { file: path.join(tmpdir(), 'claude', '.env') }, 2);
	runRaw('JSON でない入力は止まる', 'not json', 2);
	// 思わぬ形の入力は止まる（例外で終了コード 1 になると、Claude Code は編集を通すため。#108）
	runRaw('入力が JSON の null なら止まる', 'null', 2);
	runRaw('入力が配列なら止まる', '[]', 2);
	runRaw('tool_input が null なら止まる', JSON.stringify({ tool_name: 'Edit', tool_input: null }), 2);
	runRaw('tool_input が文字列なら止まる', JSON.stringify({ tool_name: 'Edit', tool_input: 'x' }), 2);
	runRaw('file_path が文字列でなければ止まる', JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 123 } }), 2);
	runRaw('file_path が無ければ止まる（編集先が無い）', JSON.stringify({ tool_name: 'Edit', tool_input: {} }), 2);
	runRaw('file_path が空文字なら止まる', JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: '' } }), 2);
	runRaw('tool_input が無ければ止まる', JSON.stringify({ tool_name: 'Edit' }), 2);

	// ---- 設定を読む根（#108。ラッパーと同じく、作業の根とメインのチェックアウトの根の両方を読む） ----
	// git は呼ばないので、worktree の .git（gitdir: と commondir）は手で作る
	{
		const mainRepo = path.join(sandbox, 'roots-main');
		const linked = path.join(sandbox, 'roots-linked');
		const child = path.join(mainRepo, '.claude', 'worktrees', 'c');
		const makeWorktree = (dir, name) => {
			mkdirSync(path.join(mainRepo, '.git', 'worktrees', name), { recursive: true });
			writeFileSync(path.join(mainRepo, '.git', 'worktrees', name, 'commondir'), '../..\n');
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, '.git'), `gitdir: ${path.join(mainRepo, '.git', 'worktrees', name)}\n`);
		};
		mkdirSync(path.join(mainRepo, '.git'), { recursive: true });
		mkdirSync(path.join(mainRepo, '.claude'), { recursive: true });
		writeFileSync(path.join(mainRepo, '.claude', 'ai-team.json'), JSON.stringify({ secretPatterns: ['private/**'] }));
		makeWorktree(linked, 'linked');
		makeWorktree(child, 'c');
		mkdirSync(path.join(child, '.claude'), { recursive: true });
		writeFileSync(path.join(child, '.claude', 'ai-team.json'), JSON.stringify({ secretPatterns: ['only-child/**'] }));

		const runIn = (name, { file, proj, cwd = proj }, expected) => {
			const result = spawnSync(process.execPath, [hook], {
				input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file }, cwd }),
				env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
				encoding: 'utf8',
			});
			judgeResult(name, result, expected);
		};
		runIn('根: メインで足した secretPatterns は、メインで止まる', { file: path.join(mainRepo, 'private', 'a.json'), proj: mainRepo }, 2);
		runIn('根: 設定の無い worktree で始めたセッションでも、メインで足した secretPatterns で止まる', { file: path.join(linked, 'private', 'a.json'), proj: linked }, 2);
		runIn('根: 設定の無い worktree のコードは通る', { file: path.join(linked, 'src', 'a.js'), proj: linked }, 0);
		runIn('根: メインから、.claude/worktrees/ の中の worktree にだけある secretPatterns で止まる', { file: path.join(child, 'only-child', 'a.json'), proj: mainRepo }, 2);
		runIn('根: メインから、.claude/worktrees/ の中の worktree のコードは通る', { file: path.join(child, 'src', 'a.js'), proj: mainRepo }, 0);

		// テンプレートのリポジトリ（repo-files/claude/ai-team.json だけ）でも、そこの secretPatterns が効く。壊れていても、そのファイルは直せる
		const tmpl = path.join(sandbox, 'roots-template');
		mkdirSync(path.join(tmpl, 'repo-files', 'claude'), { recursive: true });
		const tmplConfig = path.join(tmpl, 'repo-files', 'claude', 'ai-team.json');
		writeFileSync(tmplConfig, JSON.stringify({ secretPatterns: ['tmpl-secret/**'] }));
		runIn('根: repo-files/claude/ai-team.json の secretPatterns も効く', { file: path.join(tmpl, 'tmpl-secret', 'a'), proj: tmpl }, 2);
		writeFileSync(tmplConfig, '{ broken');
		runIn('根: repo-files/claude/ai-team.json が壊れていれば、ほかの編集は止まる', { file: path.join(tmpl, 'src', 'a.js'), proj: tmpl }, 2);
		runIn('根: repo-files/claude/ai-team.json が壊れていても、そのファイルは直せる', { file: tmplConfig, proj: tmpl }, 0);
	}

	// ---- 設定を読む根の絞り込み（#108 の1巡目の指摘） ----
	{
		const mkMain = (dir) => {
			mkdirSync(path.join(dir, '.git'), { recursive: true });
			mkdirSync(path.join(dir, '.claude'), { recursive: true });
		};
		const linkWorktree = (mainDir, dir, name) => {
			mkdirSync(path.join(mainDir, '.git', 'worktrees', name), { recursive: true });
			writeFileSync(path.join(mainDir, '.git', 'worktrees', name, 'commondir'), '../..\n');
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, '.git'), `gitdir: ${path.join(mainDir, '.git', 'worktrees', name)}\n`);
		};
		const runAt = (name, { file, proj, cwd = proj }, expected) => {
			const result = spawnSync(process.execPath, [hook], {
				input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file }, cwd }),
				env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
				encoding: 'utf8',
			});
			judgeResult(name, result, expected);
		};
		const cfgOf = (dir) => path.join(dir, '.claude', 'ai-team.json');

		// 細工した .git（commondir が外を指す）：外の設定ファイルは、読むだけで、編集は止まる
		{
			const forge = path.join(sandbox, 'forge');
			const sub = path.join(forge, 'sub');
			const victim = path.join(sandbox, 'victim');
			mkMain(victim);
			writeFileSync(cfgOf(victim), JSON.stringify({ secretPatterns: ['x/**'] }));
			mkdirSync(path.join(sub, 'g'), { recursive: true });
			writeFileSync(path.join(sub, '.git'), 'gitdir: ./g\n');
			writeFileSync(path.join(sub, 'g', 'commondir'), `${path.relative(path.join(sub, 'g'), path.join(victim, '.git'))}\n`);
			runAt('細工した .git: 外の設定ファイルの編集は止まる', { file: cfgOf(victim), proj: sub }, 2);
			runAt('細工した .git: 外の設定は読むので、そこの secretPatterns は効く', { file: path.join(sub, 'x', 'a'), proj: sub }, 2);
		}

		// 設定が壊れているときの止める文：プロジェクトの中なら「直してください」、外なら「このセッションからは直せません」
		{
			const stderrAt = (file, proj) =>
				spawnSync(process.execPath, [hook], {
					input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file }, cwd: proj }),
					env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
					encoding: 'utf8',
				});
			const inDir = path.join(sandbox, 'hint-in');
			mkMain(inDir);
			writeFileSync(cfgOf(inDir), '{ broken');
			const rIn = stderrAt(path.join(inDir, 'src', 'a.js'), inDir);
			check('壊れた設定がプロジェクトの中: 止める文に「先にそのファイルを直してください」が出る', rIn.status === 2 && rIn.stderr.includes('先にそのファイルを直してください。') && !rIn.stderr.includes('このセッションからは直せません'));

			const forge2 = path.join(sandbox, 'hint-forge', 'sub');
			const victim2 = path.join(sandbox, 'hint-victim');
			mkMain(victim2);
			writeFileSync(cfgOf(victim2), '{ broken');
			mkdirSync(path.join(forge2, 'g'), { recursive: true });
			writeFileSync(path.join(forge2, '.git'), 'gitdir: ./g\n');
			writeFileSync(path.join(forge2, 'g', 'commondir'), `${path.relative(path.join(forge2, 'g'), path.join(victim2, '.git'))}\n`);
			const rOut = stderrAt(path.join(forge2, 'src', 'a.js'), forge2);
			check('壊れた設定がプロジェクトの外: 止める文に「このセッションからは直せません」が出る', rOut.status === 2 && rOut.stderr.includes('このセッションからは直せません') && !rOut.stderr.includes('先にそのファイルを直してください'));
		}

		// リンクの実体が入れ子のリポジトリの中：指定のパスは外のリポジトリの中でも、実体の側の設定の secretPatterns で止まる
		{
			const outer = path.join(sandbox, 'alias-outer');
			const lib = path.join(outer, 'packages', 'lib');
			mkMain(outer);
			mkMain(lib);
			writeFileSync(cfgOf(lib), JSON.stringify({ secretPatterns: ['private/**'] }));
			mkdirSync(path.join(lib, 'private'), { recursive: true });
			writeFileSync(path.join(lib, 'private', 'token.json'), '{}');
			if (trySymlink(path.join(lib, 'private', 'token.json'), path.join(outer, 'alias.json'), 'file')) {
				runAt('入れ子のリポジトリへのリンク: 実体が中の secretPatterns に当たれば止まる', { file: path.join(outer, 'alias.json'), proj: outer }, 2);
			} else {
				console.log('skip 入れ子のリポジトリへのリンクの確かめ（シンボリックリンクを作れない環境）');
			}
		}

		// .kv の名前の worktree の設定ファイルは止まる（.kv/ は秘密情報）
		{
			const mainDir = path.join(sandbox, 'kv-main');
			const kvWt = path.join(mainDir, '.claude', 'worktrees', '.kv');
			mkMain(mainDir);
			linkWorktree(mainDir, kvWt, 'kv');
			mkdirSync(path.join(kvWt, '.claude'), { recursive: true });
			writeFileSync(cfgOf(kvWt), JSON.stringify({}));
			runAt('.kv の名前の worktree の設定ファイルの編集は止まる', { file: cfgOf(kvWt), proj: mainDir }, 2);
		}

		// 入れ子のリポジトリ（.claude/worktrees/ の外）の secretPatterns は、そのリポジトリの根からの相対パスで効く
		{
			const outer = path.join(sandbox, 'nest-outer');
			const lib = path.join(outer, 'packages', 'lib');
			mkMain(outer);
			mkMain(lib);
			writeFileSync(cfgOf(lib), JSON.stringify({ secretPatterns: ['private/**'] }));
			runAt('入れ子のリポジトリ: 中の設定の secretPatterns で止まる', { file: path.join(lib, 'private', 'a.json'), proj: outer }, 2);
			runAt('入れ子のリポジトリ: 中のコードは通る', { file: path.join(lib, 'src', 'a.js'), proj: outer }, 0);
			runAt('入れ子のリポジトリ: 外のリポジトリの同じ名前のフォルダは止まらない', { file: path.join(outer, 'private', 'a.json'), proj: outer }, 0);
		}

		// cwd だけが worktree を指す（CLAUDE_PROJECT_DIR はメイン）：その worktree の設定も読む。関係ないリポジトリの壊れた設定は読まない
		{
			const mainDir = path.join(sandbox, 'cwd-main');
			const wt = path.join(sandbox, 'cwd-linked');
			const other = path.join(sandbox, 'cwd-other');
			mkMain(mainDir);
			linkWorktree(mainDir, wt, 'w');
			mkdirSync(path.join(wt, '.claude'), { recursive: true });
			writeFileSync(cfgOf(wt), JSON.stringify({ secretPatterns: ['wt-only/**'] }));
			mkMain(other);
			writeFileSync(cfgOf(other), '{ broken');
			runAt('cwd だけが worktree: worktree の設定の secretPatterns も効く', { file: path.join(wt, 'wt-only', 'a'), proj: mainDir, cwd: wt }, 2);
			runAt('cwd だけが worktree: コードは通る', { file: path.join(mainDir, 'src', 'a.js'), proj: mainDir, cwd: wt }, 0);
			runAt('cwd が関係ないリポジトリなら、その壊れた設定は読まない（編集は通る）', { file: path.join(mainDir, 'src', 'a.js'), proj: mainDir, cwd: other }, 0);
			const junk = path.join(sandbox, 'cwd-junk');
			mkdirSync(junk, { recursive: true });
			writeFileSync(path.join(junk, '.git'), 'not a gitdir line');
			runAt('cwd が関係ないフォルダで、その .git に gitdir: の行が無くても、プロジェクトの編集は止まらない', { file: path.join(mainDir, 'src', 'a.js'), proj: mainDir, cwd: junk }, 0);
		}

		// .claude/ai-team.json がある根の repo-files/claude/ai-team.json は、実際に読む設定ではないので、設定が壊れているとき止まる
		{
			const dir = path.join(sandbox, 'two-configs');
			mkdirSync(path.join(dir, '.claude'), { recursive: true });
			mkdirSync(path.join(dir, 'repo-files', 'claude'), { recursive: true });
			writeFileSync(cfgOf(dir), '{ broken');
			const tmplCfg = path.join(dir, 'repo-files', 'claude', 'ai-team.json');
			writeFileSync(tmplCfg, JSON.stringify({}));
			runAt('両方ある根: 読んでいる .claude/ai-team.json は壊れていても直せる', { file: cfgOf(dir), proj: dir }, 0);
			runAt('両方ある根: 読んでいない repo-files/claude/ai-team.json は、設定が壊れていれば止まる', { file: tmplCfg, proj: dir }, 2);
		}

		// .git が読めない・gitdir: の行が無いときは止まる。commondir が無いだけ（サブモジュールの形）なら通る
		{
			const noLine = path.join(sandbox, 'git-noline');
			mkdirSync(noLine, { recursive: true });
			writeFileSync(path.join(noLine, '.git'), 'not a gitdir line\n');
			runAt('.git に gitdir: の行が無ければ止まる', { file: path.join(noLine, 'src', 'a.js'), proj: noLine }, 2);

			const subm = path.join(sandbox, 'git-submodule');
			mkdirSync(path.join(subm, 'g'), { recursive: true });
			writeFileSync(path.join(subm, '.git'), 'gitdir: ./g\n');
			runAt('commondir が無いだけ（サブモジュールの形）なら、通る', { file: path.join(subm, 'src', 'a.js'), proj: subm }, 0);

			// .git が読めない（アクセス権）：作れる OS だけ（Windows と root では作れない）
			const locked = path.join(sandbox, 'git-locked');
			mkdirSync(locked, { recursive: true });
			const lockedGit = path.join(locked, '.git');
			writeFileSync(lockedGit, 'gitdir: ./g\n');
			let canLock = false;
			if (process.platform !== 'win32') {
				chmodSync(lockedGit, 0o000);
				try {
					readFileSync(lockedGit);
				} catch {
					canLock = true;
				}
			}
			if (canLock) {
				runAt('.git が読めない（アクセス権）なら止まる', { file: path.join(locked, 'src', 'a.js'), proj: locked }, 2);
				chmodSync(lockedGit, 0o600);
			} else {
				console.log('skip .git が読めないときの確かめ（アクセス権を作れない OS か、root で実行）');
			}
		}
	}

	// ---- worktree・境界 ----
	run('入れ子の worktree: コードは通る', { file: p(...WT2.split('/'), 'src', 'a.php') }, 0);
	run('入れ子の worktree: .env は止まる', { file: p(...WT2.split('/'), '.env') }, 2);
	run('境界: worktree の名前が .kv なら止まる', { file: p('.claude', 'worktrees', '.kv', 'a.php') }, 2);
	run('境界: ../ で .env に出る', { file: p(WT, '..', '..', '.env'), ...MEJED }, 2);
	run('境界: ../ でリポジトリの外に出る', { file: p('..', 'elsewhere', 'a.php') }, 2);
	run('境界: まだ無い深い階層は通る', { file: p(WT, 'a', 'b', 'c', 'new.php') }, 0);
	if (process.platform === 'win32') {
		run('境界: 大文字の .ENV も止まる', { file: `${project}\\.ENV` }, 2);
		run('境界: \\ 区切りの worktree の .dev.vars も止まる', { file: `${project}\\.claude\\worktrees\\x\\.DEV.VARS` }, 2);
	}

	// ---- リンク：指定されたパスと実体のパスのどちらかで止まれば止める ----
	const linkType = process.platform === 'win32' ? 'junction' : 'dir';
	mkdirSync(p('.kv'), { recursive: true });
	if (trySymlink(p('.kv'), p('vault'), linkType)) {
		run('リンク: リンク先が秘密情報なら止まる', { file: p('vault', 'a.md') }, 2);
	} else {
		console.log('skip リンク先が秘密情報の確かめ（リンクを作れない環境）');
	}
	if (trySymlink(outside, p('out'), linkType)) {
		run('リンク: リンク先がリポジトリの外なら止まる', { file: p('out', 'a.md') }, 2);
	} else {
		console.log('skip リンク先がリポジトリの外の確かめ（リンクを作れない環境）');
	}
	if (trySymlink(p('no-such-dir'), p('dangling'), linkType)) {
		run('リンク: リンク切れを経由する編集は止まる', { file: p('dangling', 'a.md') }, 2);
	} else {
		console.log('skip リンク切れの確かめ（リンクを作れない環境）');
	}

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

	withConfig(j({ secretPatterns: ['**/.wrangler/**'] }), () => {
		run('設定: .wrangler/ は止まる', { file: p('.wrangler', 'state.json') }, 2);
		run('設定: sub/.wrangler/x は止まる（メジェド）', { file: p('sub', '.wrangler', 'x'), ...MEJED }, 2);
		run('設定: worktree の中の .wrangler/ は止まる', { file: p(WT, '.wrangler', 'x') }, 2);
		run('設定: 改行を含む .wrangler/ のファイル名も止まる', { file: p('.wrangler', 'state\n.json') }, 2);
		run('設定: wrangler.toml は止まらない', { file: p('wrangler.toml') }, 0);
		run('設定: 既定の .dev.vars は設定があっても止まる', { file: p('.dev.vars') }, 2);
		run('設定: 設定ファイル自体は通る', { file: configPath }, 0);
	});

	withConfig(j({ secretPatterns: ['private/**/token.json'] }), () => {
		run('設定: private/token.json は止まる', { file: p('private', 'token.json') }, 2);
		run('設定: private/a/b/token.json は止まる', { file: p('private', 'a', 'b', 'token.json') }, 2);
		run('設定: private/token.jsonx は止まらない', { file: p('private', 'token.jsonx') }, 0);
	});

	withConfig(j({ secretPatterns: ['a.b/x(1).txt'] }), () => {
		run('設定: 正規表現の記号はただの文字（当たる）', { file: p('a.b', 'x(1).txt') }, 2);
		run('設定: 正規表現の記号はただの文字（. は任意の1文字ではない）', { file: p('axb', 'x(1).txt') }, 0);
	});

	// 導入済みのリポジトリの互換：plannerWritable が残っていても止めない（形は確かめる。中身は使わない）
	withConfig(j({ secretPatterns: [], plannerWritable: [] }), () => {
		run('互換: plannerWritable が空の配列で残っていても、コードは通る', { file: p('src', 'a.php') }, 0);
		run('互換: plannerWritable が残っていても、.env は止まる', { file: p('.env') }, 2);
	});
	withConfig(j({ plannerWritable: ['data/*.json'] }), () => {
		run('互換: plannerWritable に中身があっても、ほかの編集は今までどおり', { file: p('src', 'a.php') }, 0);
	});

	// 知らないキーは読み捨てる（これより後の版でキーを足しても止めない）
	withConfig(j({ secretPatterns: ['**/.wrangler/**'], futureKey: { a: 1 } }), () => {
		run('先の版: 知らないキーがあっても、コードは通る', { file: p('src', 'a.php') }, 0);
		run('先の版: 知らないキーがあっても、secretPatterns は効く', { file: p('.wrangler', 'x') }, 2);
	});

	// 呼び名の対応（names。#46）：正しければ、ガードの動きは今までどおり
	withConfig(j({ secretPatterns: [], names: { ガネーシャ: 'アヤ', メジェド: 'ハナコ', 健さん: 'ケン', 藤さん: 'エフ', 純ちゃん: 'ジュン', まーちゅう: 'ゆう' } }), () => {
		run('呼び名: names が正しければ、コードは通る', { file: p('src', 'a.php') }, 0);
		run('呼び名: names が正しくても、.env は止まる', { file: p('.env') }, 2);
	});
	withConfig(j({ names: {} }), () => {
		run('呼び名: names が空のオブジェクトでも通る', { file: p('src', 'a.php') }, 0);
	});
	withConfig(j({ names: { メジェド: ` ${'あ'.repeat(40)} ` } }), () => {
		run('呼び名: 前後の空白を除いて40文字なら通る（長さは空白を取った後で数える）', { file: p('src', 'a.php') }, 0);
	});

	// コンテナの中のレビューの設定（container。#99）：正しければ、ガードの動きは今までどおり
	withConfig(j({ secretPatterns: [], container: { setup: 'npm ci', test: 'npm test' } }), () => {
		run('container: 正しければ、コードは通る', { file: p('src', 'a.php') }, 0);
		run('container: 正しくても、.env は止まる', { file: p('.env') }, 2);
	});

	// 壊れているとき：設定ファイル自体のほかは、すべての編集を止める
	const broken = [
		['JSON として壊れている', '{ not json'],
		['知っているキーと大文字小文字だけ違う（SecretPatterns）', j({ SecretPatterns: [] })],
		['知っているキーと大文字小文字だけ違う（Names）', j({ Names: { メジェド: 'ハナコ' } })],
		['知っているキーの打ち間違い（secretPattern。s 抜け）', j({ secretPattern: ['**/.wrangler/**'] })],
		['知っているキーの打ち間違い（secret_patterns）', j({ secret_patterns: ['**/.wrangler/**'] })],
		['知っているキーの打ち間違い（secretsPatterns）', j({ secretsPatterns: ['**/.wrangler/**'] })],
		['names が配列', j({ names: ['ハナコ'] })],
		['names に知らない名前のキー', j({ names: { だれか: 'x' } })],
		['names の呼び名が空', j({ names: { メジェド: ' ' } })],
		['names の呼び名が文字列でない', j({ names: { メジェド: 1 } })],
		['names の呼び名に改行', j({ names: { メジェド: 'ハナ\nコ' } })],
		['names の呼び名に U+2028', j({ names: { メジェド: `ハナ${String.fromCharCode(0x2028)}コ` } })],
		['names の呼び名に U+0085（C1 制御文字）', j({ names: { メジェド: `ハナ${String.fromCharCode(0x85)}コ` } })],
		['names の呼び名が 41 文字', j({ names: { メジェド: 'あ'.repeat(41) } })],
		['知っているキーの打ち間違い（containers）', j({ containers: { setup: 'npm ci', test: 'npm test' } })],
		['container が配列', j({ container: ['npm ci'] })],
		['container に test が無い', j({ container: { setup: 'npm ci' } })],
		['container の setup が空', j({ container: { setup: ' ', test: 'npm test' } })],
		['container の test が文字列でない', j({ container: { setup: 'npm ci', test: 1 } })],
		['container のコマンドに改行', j({ container: { setup: 'npm ci\nrm -rf /', test: 'npm test' } })],
		['container に知らないキー', j({ container: { setup: 'npm ci', test: 'npm test', image: 'x' } })],
		['文字列の配列でない（文字列）', j({ secretPatterns: 'x' })],
		['文字列の配列でない（数）', j({ secretPatterns: [1] })],
		['plannerWritable が配列でない', j({ plannerWritable: 'x' })],
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
			run(`設定が壊れている（${label}）: .md も止まる`, { file: p('docs', 'tasks', 'x', 'plan.md') }, 2);
			run(`設定が壊れている（${label}）: メジェドのコードも止まる`, { file: p('src', 'a.js'), ...MEJED }, 2);
			run(`設定が壊れている（${label}）: scratchpad も止まる`, { file: path.join(tmpdir(), 'claude', 'a.txt') }, 2);
			run(`設定が壊れている（${label}）: 設定ファイル自体は通る`, { file: configPath }, 0);
		});
	}

	// 設定ファイルの中身（秘密情報かもしれない）を、止める理由に出さない
	withConfig('API_KEY=abc123secret', () => {
		const r = run('設定の中身が壊れていれば止まる', { file: p('src', 'a.js') }, 2);
		check('設定の中身が止める理由に出ない', !`${r.stdout}${r.stderr}`.includes('abc123secret'));
	});

	// 文字コード：UTF-8 の BOM 付きで中身が正しければ、判定する
	withConfig(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(j({ secretPatterns: ['**/.wrangler/**'] }), 'utf8')]), () => {
		run('設定: UTF-8 の BOM 付きでも読める（.wrangler/ が止まる）', { file: p('.wrangler', 'x') }, 2);
		run('設定: UTF-8 の BOM 付きでも読める（ほかは通る）', { file: p('src', 'a.js') }, 0);
	});

	// secretPatterns が設定ファイル自体に当たっても、設定ファイルは直せる
	withConfig(j({ secretPatterns: ['.claude/ai-team.json'] }), () => {
		run('設定: 自分に当たるグロブがあっても設定ファイルは通る', { file: configPath }, 0);
		run('設定: 自分に当たるグロブがあってもほかの編集は今までどおり', { file: p('src', 'a.js') }, 0);
	});

	// 設定ファイルが、リンク先のある .env へのシンボリックリンク
	mkdirSync(p('.claude'), { recursive: true });
	writeFileSync(p('.env'), j({}));
	if (trySymlink(p('.env'), configPath, 'file')) {
		run('設定: 設定ファイルが .env へのリンクなら、設定ファイルの編集は止まる', { file: configPath }, 2);
		unlinkSync(configPath);
	} else {
		console.log('skip 設定ファイルが .env へのリンクの確かめ（シンボリックリンクを作れない環境）');
	}
	rmSync(p('.env'), { force: true });

	// 設定ファイルがリンク切れのシンボリックリンク
	if (trySymlink(p('no-such-target.json'), configPath, 'file')) {
		run('設定: 設定ファイルがリンク切れなら .md も止まる', { file: p('docs', 'tasks', 'x', 'plan.md') }, 2);
		run('設定: 設定ファイルがリンク切れなら設定ファイル自体も止まる', { file: configPath }, 2);
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
			run('設定: 親の .claude がリンク切れなら .md も止まる', { file: path.join(proj2, 'docs', 'a.md'), proj: proj2 }, 2);
			run('設定: 親の .claude がリンク切れなら設定ファイル自体も止まる', { file: path.join(proj2, '.claude', 'ai-team.json'), proj: proj2 }, 2);
		} else {
			console.log('skip 親の .claude がリンク切れの確かめ（リンクを作れない環境）');
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

	// 大文字を含む secretPatterns（Secrets/**）も、今の OS のそろえ方で当たる（#100。Windows・Mac でパスだけ小文字にして外れないように）
	{
		const { readConfig, isSecretPath } = await import('./ai-team-config.mjs');
		const proj = mkdtempSync(path.join(tmpdir(), 'guard-upper-'));
		mkdirSync(path.join(proj, '.claude'), { recursive: true });
		writeFileSync(path.join(proj, '.claude', 'ai-team.json'), JSON.stringify({ secretPatterns: ['Secrets/**'] }));
		const config = readConfig([path.join(proj, '.claude', 'ai-team.json')]);
		check('大文字を含む secretPatterns（Secrets/**）が Secrets/token.json に当たる', config.status === 'ok' && isSecretPath('Secrets/token.json', config.secretRegexps));
		rmSync(proj, { recursive: true, force: true });
	}

	// forMatch：Windows と Mac は大文字小文字をそろえ、Linux はそろえない（#100。Mac の既定の APFS は区別しないため）
	{
		const { forMatch } = await import('./ai-team-config.mjs');
		check('forMatch: darwin（Mac）では .ENV を .env にそろえる', forMatch('.ENV', 'darwin') === '.env');
		check('forMatch: win32 では WP-CONFIG.PHP を wp-config.php にそろえる', forMatch('WP-CONFIG.PHP', 'win32') === 'wp-config.php');
		check('forMatch: linux ではそろえない（大文字小文字を区別するファイルシステム）', forMatch('.ENV', 'linux') === '.ENV');
		// 場所の判定（中か外か）は Windows だけそろえる。Mac には大文字小文字を区別する APFS もあり、Repo と repo を同じ場所と見ないため
		const { forPath } = await import('./ai-team-config.mjs');
		check('forPath: darwin（Mac）では場所の判定をそろえない（/x/Repo と /x/repo は別の場所）', forPath('/x/Repo', 'darwin') === '/x/Repo');
		check('forPath: win32 では場所の判定をそろえる', forPath('C:/X/Repo', 'win32') === 'c:/x/repo');
	}

	// toSlash：`\` を `/` にするのは Windows だけ（#107。Linux・Mac では `\` は名前の文字）
	{
		const { toSlash, isSecretPath, globToRegExp } = await import('./ai-team-config.mjs');
		const bs = '\\';
		check('toSlash: Linux では .env\\local をそのままにする', toSlash(`.env${bs}local`, false) === `.env${bs}local`);
		check('toSlash: Windows では .env\\local を .env/local にする', toSlash(`.env${bs}local`, true) === '.env/local');
		check('Linux の扱い: .env\\local（1つの名前）が .env* に当たる', isSecretPath(toSlash(`.env${bs}local`, false)));
		check('Windows の扱い: .env\\local は .env/local（.env フォルダの中）になり、.env* には当たらない', !isSecretPath(toSlash(`.env${bs}local`, true)));
		check('Windows の扱い: .kv\\x が .kv/x として当たる', isSecretPath(toSlash(`.kv${bs}x`, true)));
		check('Linux の扱い: .kv\\x は1つの名前で、.kv/ には当たらない', !isSecretPath(toSlash(`.kv${bs}x`, false)));
		check('Windows の扱い: sub\\.env が sub/.env として当たる', isSecretPath(toSlash(`sub${bs}.env`, true)));
		check('Linux の扱い: sub\\.env は1つの名前で、既定の一覧には当たらない', !isSecretPath(toSlash(`sub${bs}.env`, false)));

		// u フラグ：? はコードポイント1つに当たる
		const emoji = String.fromCodePoint(0x1f511);
		const re = globToRegExp('private/?.json');
		check('? は絵文字1つに当たる（private/<絵文字>.json）', re.test(`private/${emoji}.json`));
		check('? は2文字には当たらない（private/ab.json）', !re.test('private/ab.json'));
		check('? は / には当たらない', !re.test('private//.json'));
		// u フラグで new RegExp が投げない（- / 日本語 絵文字 を含むグロブ）
		for (const g of ['a-b/c.txt', '**/x-y', 'x/**', '秘密/ぱ*', `${emoji}/*.json`, 'a.b+c(d)^$|/?']) {
			let ok = true;
			try {
				globToRegExp(g);
			} catch {
				ok = false;
			}
			check(`globToRegExp が投げない: ${g}`, ok);
		}
		// 既定のパターン（u なし）と同じに通る
		for (const p of ['.env', '.env.local', 'a/.env', 'wp-config.php', 'x/wp-config.php', '.dev.vars', '.kv/x']) {
			check(`既定の一覧に当たる: ${p}`, isSecretPath(p));
		}
		check('既定の一覧に当たらない: env.txt', !isSecretPath('env.txt'));
		// NFC と NFD は区別して当てる（OS に依らない事実の記録。#107）
		const nfc = '秘密/ぱ'.normalize('NFC');
		const nfd = '秘密/ぱ'.normalize('NFD');
		const reN = globToRegExp(`${nfc}*`);
		check('NFC のグロブは NFC の名前に当たる', reN.test(nfc));
		check('NFC のグロブは NFD の名前に当たらない（区別する。Mac での扱いは未確認）', !reN.test(nfd));
	}

	// ---- settings.json ----
	const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
	const allow = settings.permissions?.allow || [];
	const deny = settings.permissions?.deny || [];
	// ask は置かない（Manual では、どの決まりにも当たらないコマンドは確認が出る。Auto では判定器が見る。止めたいものは deny）
	check('settings.json に ask が無い', settings.permissions?.ask === undefined);
	check('settings.json の allow に Edit(docs/tasks/**) が無い（ガードが止めないので要らない）', !allow.includes('Edit(docs/tasks/**)'));
	for (const sub of ['list', 'ls', 'view', 'diff', 'checks', 'status']) {
		for (const rule of [`Bash(gh pr ${sub}:*)`, `PowerShell(gh pr ${sub}:*)`]) {
			check(`settings.json の allow に ${rule} がある`, allow.includes(rule));
		}
	}
	for (const rule of ['Bash(git remote get-url:*)', 'PowerShell(git remote get-url:*)']) {
		check(`settings.json の allow に ${rule} がある`, allow.includes(rule));
	}
	// 健さんのラッパー：Node 版（#100）と、前の呼び方の中継（.ps1）の両方
	for (const rule of [
		'Bash(node "*/ai-team-skills/ai-team/*/skills/codex/scripts/invoke-codex.mjs" *)',
		'Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File "*/ai-team-skills/ai-team/*/skills/codex/scripts/invoke-codex.ps1" *)',
	]) {
		check(`settings.json の allow に ${rule} がある`, allow.includes(rule));
	}
	for (const rule of ['Read(**/.dev.vars)', 'Read(**/.kv/**)', 'Read(**/wp-config.php)', 'Read(**/.env*)', 'Bash(gh pr merge:*)']) {
		check(`settings.json の deny に ${rule} がある`, deny.includes(rule));
	}
	// deny の Bash のルールすべてに、同じ形の PowerShell のルールがある
	for (const rule of deny.filter((r) => r.startsWith('Bash('))) {
		const ps = rule.replace(/^Bash\(/, 'PowerShell(');
		check(`settings.json の deny に ${ps} がある`, deny.includes(ps));
	}
	check('settings.json に hooks が無い（ガードのフックはプラグインにある）', settings.hooks === undefined);

	// ---- フックの登録（プラグインの hooks/hooks.json）は、シェルを通さない書き方 ----
	const pluginHooks = JSON.parse(readFileSync(hooksJsonPath, 'utf8')).hooks || {};
	const guardEntry = (pluginHooks.PreToolUse || []).find((entry) =>
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
	check(
		'hooks.json の SessionStart に session-start.mjs が matcher なしで登録されている',
		(pluginHooks.SessionStart || []).some(
			(e) =>
				e.matcher === undefined &&
				(e.hooks || []).some((h) => h.command === 'node' && (h.args || [])[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs')
		)
	);
	check(
		'hooks.json のガードは onFailure が block（起動できない・タイムアウト・終了コード 2 以外でも編集を止める。#108）',
		(pluginHooks.PreToolUse || []).some((e) => (e.hooks || []).some((h) => (h.args || [])[0] === '${CLAUDE_PLUGIN_ROOT}/hooks/guard-code-edit.mjs' && h.onFailure === 'block'))
	);
	check(
		'hooks.json に登録されているのは PreToolUse と SessionStart だけ',
		Object.keys(pluginHooks).sort().join(',') === 'PreToolUse,SessionStart'
	);
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
