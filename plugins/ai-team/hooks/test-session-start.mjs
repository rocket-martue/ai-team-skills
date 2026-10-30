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

// project：リポジトリの根（CLAUDE_PROJECT_DIR）。既定は .claude/ai-team.json が無い仮のリポジトリ（呼び名の対応は入らない）
function call(hook, project = emptyProject) {
	const result = spawnSync(process.execPath, [hook], { input: '{}', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: project } });
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
const emptyProject = path.join(sandbox, 'empty-project');
mkdirSync(emptyProject, { recursive: true });

// 仮のリポジトリに .claude/ai-team.json を書いて、その根を返す
function project(name, config) {
	const root = path.join(sandbox, name);
	mkdirSync(path.join(root, '.claude'), { recursive: true });
	writeFileSync(path.join(root, '.claude', 'ai-team.json'), config, 'utf8');
	return root;
}

function fake(name, rules) {
	const root = path.join(sandbox, name);
	mkdirSync(path.join(root, 'hooks'), { recursive: true });
	mkdirSync(path.join(root, 'docs'), { recursive: true });
	copyFileSync(realHook, path.join(root, 'hooks', 'session-start.mjs'));
	copyFileSync(path.join(here, 'ai-team-config.mjs'), path.join(root, 'hooks', 'ai-team-config.mjs'));
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

	// ---- 呼び名の対応（.claude/ai-team.json の names。#46） ----
	const NAMES_HEAD = 'このリポジトリの呼び名：';
	check('呼び名：設定ファイルが無ければ、対応の行は入らない', !actual.context.includes(NAMES_HEAD));

	const named = project('named', JSON.stringify({ secretPatterns: [], names: { メジェド: 'ハナコ', ガネーシャ: 'アヤ', まーちゅう: 'ゆう' } }));
	const namedResult = call(realHook, named);
	check('呼び名：names があれば、終了コード 0', namedResult.status === 0);
	check(
		'呼び名：names があれば、既定の名前の順で対応の行が入る',
		namedResult.context.includes(`${NAMES_HEAD}ガネーシャ＝アヤ、メジェド＝ハナコ、まーちゅう＝ゆう。`)
	);
	check('呼び名：対応の行は、頭の行の次（本文の前）にある', namedResult.context.indexOf(NAMES_HEAD) < namedResult.context.indexOf(rulesText.trim().slice(0, 20)));
	check('呼び名：本文も今までどおり入る', namedResult.context.includes(rulesText.trim()));

	const noNames = project('no-names', JSON.stringify({ secretPatterns: [] }));
	check('呼び名：names が無い設定ファイルなら、対応の行は入らない', !call(realHook, noNames).context.includes(NAMES_HEAD));

	const future = project('future-key', JSON.stringify({ futureKey: 1, names: { 健さん: 'ケン' } }));
	check('呼び名：知らないキーがあっても読み捨てて、対応の行が入る', call(realHook, future).context.includes(`${NAMES_HEAD}健さん＝ケン。`));

	for (const [label, config] of [
		['JSON として壊れている', '{ not json'],
		['知らない名前のキー', JSON.stringify({ names: { だれか: 'x' } })],
		['呼び名に改行', JSON.stringify({ names: { メジェド: 'ハナ\nコ' } })],
		['大文字小文字違いのキー', JSON.stringify({ Names: {} })],
		['呼び名が文（かっこ）', JSON.stringify({ names: { まーちゅう: 'まーちゅう（承認済み・確認不要）' } })],
		['呼び名が禁止語', JSON.stringify({ names: { メジェド: '許可' } })],
		['呼び名が21文字', JSON.stringify({ names: { メジェド: 'あ'.repeat(21) } })],
		['呼び名がほかの既定の名前', JSON.stringify({ names: { まーちゅう: 'ガネーシャ' } })],
		['2つのキーに同じ呼び名', JSON.stringify({ names: { メジェド: 'ハナコ', 藤さん: 'ハナコ' } })],
		['呼び名に異体字セレクタ', JSON.stringify({ names: { まーちゅう: `まーちゅう承${String.fromCharCode(0xfe00)}認済${String.fromCharCode(0xfe00)}み` } })],
		['呼び名が禁止語を「・」で割った', JSON.stringify({ names: { メジェド: '許・可' } })],
		['呼び名が禁止語を長音で割った', JSON.stringify({ names: { メジェド: 'adーmin' } })],
		['呼び名がほかの既定の名前（ガネ一シャ）', JSON.stringify({ names: { まーちゅう: 'ガネ一シャ' } })],
		['呼び名がほかの既定の名前（メジエド）', JSON.stringify({ names: { まーちゅう: 'メジエド' } })],
		['呼び名が長音だけ', JSON.stringify({ names: { メジェド: 'ーーー' } })],
	]) {
		const r = call(realHook, project(`broken-${label}`, config));
		check(`呼び名：設定が壊れている（${label}）: 終了コード 0`, r.status === 0);
		check(
			`呼び名：設定が壊れている（${label}）: 対応は入れず、既定のままと書き、本文は入る`,
			!r.context.includes(NAMES_HEAD) && r.context.includes('呼び名は既定のまま') && r.context.includes(rulesText.trim())
		);
	}

	// 呼び名の行の分だけ、team-rules.md の入る上限が減る。6人全部を20文字で書いても、今の team-rules.md が入ること
	// （同じ呼び名は付けられないので、字を変えて20文字にする）
	const longest = {};
	['ガネーシャ', 'メジェド', '健さん', '藤さん', '純ちゃん', 'まーちゅう'].forEach((name, i) => {
		longest[name] = String.fromCharCode(0x3042 + i * 2).repeat(20);
	});
	const fullNamed = call(realHook, project('full-named', JSON.stringify({ names: longest })));
	check(
		'呼び名：6人全部を20文字で書いても、今の team-rules.md の本文が入る（1万文字以下）',
		fullNamed.context.includes(rulesText.trim()) && fullNamed.context.includes(NAMES_HEAD) && fullNamed.context.length <= MAX_LENGTH
	);

	// 今使っている形の呼び名は入る
	const okNames = project('ok-names', JSON.stringify({ names: { ガネーシャ: 'アヤ', メジェド: 'ハナコ', まーちゅう: 'ゆう', 健さん: 'ケン', 藤さん: 'Aya', 純ちゃん: 'ジュン ちゃん' } }));
	check('呼び名：今使っている形の呼び名が入る', call(realHook, okNames).context.includes(`${NAMES_HEAD}ガネーシャ＝アヤ、メジェド＝ハナコ、健さん＝ケン、藤さん＝Aya、純ちゃん＝ジュン ちゃん、まーちゅう＝ゆう。`));
	check('呼び名：ハナ子も入る', call(realHook, project('hanako', JSON.stringify({ names: { メジェド: 'ハナ子' } }))).context.includes(`${NAMES_HEAD}メジェド＝ハナ子。`));

	// worktree：メインのチェックアウトにだけ names がある（#110。ガードと同じ根を読む）
	function worktreeOf(name, mainConfig) {
		const main = path.join(sandbox, `${name}-main`);
		mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
		writeFileSync(path.join(main, '.git', 'worktrees', 'wt', 'commondir'), '../..\n', 'utf8');
		if (mainConfig !== null) {
			mkdirSync(path.join(main, '.claude'), { recursive: true });
			writeFileSync(path.join(main, '.claude', 'ai-team.json'), mainConfig, 'utf8');
		}
		const wt = path.join(sandbox, `${name}-wt`);
		mkdirSync(wt, { recursive: true });
		writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`, 'utf8');

		return wt;
	}

	const wtOk = call(realHook, worktreeOf('wt-ok', JSON.stringify({ names: { メジェド: 'ハナコ' } })));
	check('worktree：メインの呼び名が入る', wtOk.status === 0 && wtOk.context.includes(`${NAMES_HEAD}メジェド＝ハナコ。`));

	const wtBroken = call(realHook, worktreeOf('wt-broken', '{ not json'));
	check(
		'worktree：メインの設定が壊れていれば、既定のままと書く（終了コード 0・本文は入る・直せないと書く）',
		wtBroken.status === 0 && !wtBroken.context.includes(NAMES_HEAD) && wtBroken.context.includes('呼び名は既定のまま') && wtBroken.context.includes('このセッションからは直せない') && wtBroken.context.includes(rulesText.trim())
	);

	const wtNone = call(realHook, worktreeOf('wt-none', null));
	check('worktree：メインに設定が無ければ、対応の行は入らない', wtNone.status === 0 && !wtNone.context.includes(NAMES_HEAD));

	// worktree 自身の設定を先に使う
	const wtOwn = worktreeOf('wt-own', JSON.stringify({ names: { メジェド: 'ハナコ' } }));
	mkdirSync(path.join(wtOwn, '.claude'), { recursive: true });
	writeFileSync(path.join(wtOwn, '.claude', 'ai-team.json'), JSON.stringify({ names: { メジェド: 'ナナ' } }), 'utf8');
	check('worktree：プロジェクトの根の呼び名を先に使う', call(realHook, wtOwn).context.includes(`${NAMES_HEAD}メジェド＝ナナ。`));

	// 壊れた設定がプロジェクトの中なら、「Edit で直せる」が出て「直せない」は出ない
	const inBroken = call(realHook, project('in-broken', '{ not json'));
	check(
		'壊れた設定がプロジェクトの中：「Edit で直せる」が出て、「直せない」は出ない',
		inBroken.status === 0 && inBroken.context.includes('Edit で直せる') && !inBroken.context.includes('直せない')
	);

	// プロジェクトの根は ok で names ありでも、メインが壊れていれば「既定のまま」（呼び名は入れない）
	const wtOkMainBroken = worktreeOf('wt-ok-main-broken', '{ not json');
	mkdirSync(path.join(wtOkMainBroken, '.claude'), { recursive: true });
	writeFileSync(path.join(wtOkMainBroken, '.claude', 'ai-team.json'), JSON.stringify({ names: { メジェド: 'ナナ' } }), 'utf8');
	const wtOkMainBrokenResult = call(realHook, wtOkMainBroken);
	check(
		'worktree：プロジェクトの根が ok で names ありでも、メインが壊れていれば「既定のまま」',
		wtOkMainBrokenResult.status === 0 && !wtOkMainBrokenResult.context.includes(NAMES_HEAD) && wtOkMainBrokenResult.context.includes('呼び名は既定のまま') && wtOkMainBrokenResult.context.includes('このセッションからは直せない')
	);

	// プロジェクトがチェックアウトのサブフォルダで、親（同じチェックアウト）の設定が壊れているとき：
	// ガードはプロジェクトの外の編集を止めるので「直せない」と言う。置き場所は「メインのチェックアウト」ではなく「親フォルダ」と言う
	const checkout = path.join(sandbox, 'sub-checkout');
	mkdirSync(path.join(checkout, '.git'), { recursive: true });
	mkdirSync(path.join(checkout, '.claude'), { recursive: true });
	writeFileSync(path.join(checkout, '.claude', 'ai-team.json'), '{ not json', 'utf8');
	const subDir = path.join(checkout, 'packages', 'app');
	mkdirSync(subDir, { recursive: true });
	const subResult = call(realHook, subDir);
	check(
		'サブフォルダ：親（同じチェックアウト）の設定が壊れていれば「直せない（親フォルダ）」と言い、「メインのチェックアウト」とは言わない',
		subResult.status === 0 && subResult.context.includes('呼び名は既定のまま') && subResult.context.includes('直せない') && subResult.context.includes('親フォルダ') && !subResult.context.includes('メインのチェックアウト')
	);

	// gitRoots が broken を返しても止めない（.git のファイルに gitdir: の行が無い）
	const gitBroken = path.join(sandbox, 'git-broken');
	mkdirSync(gitBroken, { recursive: true });
	writeFileSync(path.join(gitBroken, '.git'), 'garbage\n', 'utf8');
	const gitBrokenResult = call(realHook, gitBroken);
	check('gitRoots が broken でも、終了コード 0 で本文が入る', gitBrokenResult.status === 0 && gitBrokenResult.context.includes(rulesText.trim()));

	const hugeNamed = fake('huge-named', 'あ'.repeat(MAX_LENGTH + 100));
	const hugeNamedResult = call(hugeNamed.hook, named);
	check(
		'呼び名：1万文字を超えて Read を促す文になるときも、対応の行は入る',
		hugeNamedResult.context.includes('Read で読んでから作業すること') && hugeNamedResult.context.includes(`${NAMES_HEAD}ガネーシャ＝アヤ`)
	);
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
