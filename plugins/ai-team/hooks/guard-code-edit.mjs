#!/usr/bin/env node
// PreToolUse フック：ファイル編集を、秘密情報とリポジトリの外だけで止める。誰が編集するか（ガネーシャ・メジェド）は見ない。
// - 秘密情報のファイルは誰も触れない
// - リポジトリの外は、Claude Code 自身の置き場所（メモリ・計画ファイル・scratchpad）だけ通す
// - 設定ファイル（.claude/ai-team.json）が壊れている・リンク切れのときは止める（足した秘密情報のパターンが黙って消えないため）。設定ファイルそのものの編集だけは通す（直す道）
// リポジトリごとの追加は .claude/ai-team.json（secretPatterns）に書く。判定の部品は ai-team-config.mjs。このファイルは書き換えない。
// 判定は「指定されたパス」と「シンボリックリンクをたどった実体のパス」の両方に当て、どちらかで止まれば止める。
// 止めるときは exit 2 と stderr の理由を返す（Claude に理由が伝わる）。

import { readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { CONFIG_CANDIDATES, forMatch, forPath, gitRoots, isSecretPath, readConfig, realPath, SECRET_PATTERNS } from './ai-team-config.mjs';

// git worktree の置き場所（リポジトリの中）。この頭を剥がした相対パスでも、秘密情報の判定をする。
const WORKTREE_PREFIX = /^\.claude\/worktrees\/[^/]+\/(.+)$/;

// リポジトリの外でも編集してよい場所。Claude Code 自身が使う置き場所だけにする。
// `base` の中で、`base` からの相対パスが `pattern` に当たるものだけ通す。
// ~/.claude/ を丸ごと通すと、ユーザー共通の settings.json・CLAUDE.md・スキル・認証情報まで書き換えられるので、
// ~/.claude/ の中はメモリと計画ファイルの2か所だけにする。通すのは、それに一時ディレクトリの scratchpad を足した次の3か所。
// - ~/.claude/projects/<プロジェクト>/memory/ … メモリ
// - ~/.claude/plans/                          … プランモードの計画ファイル
// - <一時ディレクトリ>/claude/                … セッションごとの scratchpad
const CLAUDE_HOME = path.join(homedir(), '.claude');
const OUTSIDE_WRITABLE = [
	{ base: CLAUDE_HOME, pattern: /^projects\/[^/]+\/memory\// },
	{ base: CLAUDE_HOME, pattern: /^plans\// },
	{ base: path.join(tmpdir(), 'claude'), pattern: /^/ },
];

function block(reason) {
	process.stderr.write(reason + '\n');
	process.exit(2);
}

// 場所の判定（中か外か）に使う形。大文字小文字のそろえ方は forPath（Windows だけ）。秘密情報の照らしには forMatch を重ねる（#100）
function normalize(p) {
	return forPath(path.resolve(p).split(path.sep).join('/'));
}

function isInside(target, dir) {
	const t = normalize(target);
	const d = normalize(dir);
	return t === d || t.startsWith(d.endsWith('/') ? d : d + '/');
}

// 止めるなら理由の文字列、通すなら null を返す。
function judge(absolute, projectDir, outsideWritable, label, secretRegexps) {
	const secretReason = `guard-code-edit: ${label} は秘密情報のファイルなので編集できません。`;

	if (!isInside(absolute, projectDir)) {
		if (SECRET_PATTERNS.some((re) => re.test(forMatch(normalize(absolute))))) {
			return secretReason;
		}

		const allowed = outsideWritable.some(
			({ base, pattern }) =>
				isInside(absolute, base) && pattern.test(forPath(path.relative(base, absolute).split(path.sep).join('/')))
		);

		return allowed ? null : `guard-code-edit: リポジトリの外（${label}）は編集できません。`;
	}

	const projectRel = forMatch(path.relative(projectDir, absolute).split(path.sep).join('/'));

	// 秘密情報の判定は、worktree の頭を剥がす前のパスにも当てる（worktree の名前が `.kv` などでも抜けないように）。
	if (isSecretPath(projectRel, secretRegexps)) {
		return secretReason;
	}

	// `.claude/worktrees/<名前>/` の中は、その頭を剥がした相対パスでも判定する。入れ子でも、剥がせなくなるまで繰り返す。
	let rel = projectRel;
	for (let m = WORKTREE_PREFIX.exec(rel); m; m = WORKTREE_PREFIX.exec(rel)) {
		rel = m[1];
	}

	return isSecretPath(rel, secretRegexps) ? secretReason : null;
}

// 設定ファイルを読む根を集める（#108。ラッパーと同じく、作業の根とメインのチェックアウトの根の両方を読む）。
// - プロジェクトの根と、そのメインの根
// - フックの cwd の git の根と、そのメインの根（EnterWorktree の後は、cwd が worktree、CLAUDE_PROJECT_DIR がメインを指すため）
// - 編集先がプロジェクトの中なら、編集先が入っている git の根（.claude/worktrees/<名前>/ の中など）と、そのメインの根
function configRoots(projectDir, cwd, specified) {
	const roots = [projectDir];
	const add = (r) => {
		if (r && !roots.some((x) => normalize(x) === normalize(r))) roots.push(r);
	};
	const own = gitRoots(projectDir);
	if (own !== null) add(own.main);
	if (typeof cwd === 'string' && cwd !== '') {
		const here = gitRoots(cwd);
		if (here !== null) {
			add(here.root);
			add(here.main);
		}
	}
	if (isInside(specified, projectDir)) {
		const target = gitRoots(specified);
		if (target !== null) {
			add(target.root);
			add(target.main);
		}
	}
	return roots;
}

// 止めるなら止め、通すなら終了コード 0 で終わる。
function main() {
	let input;
	try {
		input = JSON.parse(readFileSync(0, 'utf8'));
	} catch {
		// 入力が読めないときは安全側に倒して止める
		block('guard-code-edit: フック入力を読めなかったので編集を止めました。');
	}

	// 形が思わぬもの（null・配列・文字列でないパスなど）のときも止める（例外で終わると、Claude Code は編集を通すため。#108）
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		block('guard-code-edit: フック入力の形が思わぬものなので編集を止めました。');
	}
	const toolInput = input.tool_input === undefined ? {} : input.tool_input;
	if (toolInput === null || typeof toolInput !== 'object' || Array.isArray(toolInput)) {
		block('guard-code-edit: フック入力の tool_input の形が思わぬものなので編集を止めました。');
	}
	const target = toolInput.file_path || toolInput.notebook_path;
	if (!target) {
		process.exit(0);
	}
	if (typeof target !== 'string') {
		block('guard-code-edit: 編集先のパスが文字列ではないので編集を止めました。');
	}

	const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
	const specified = path.resolve(projectDir, target);
	const real = realPath(specified);

	// リポジトリごとの追加（.claude/ai-team.json。無ければ repo-files/claude/ai-team.json）を、読む根の全部から合わせる。
	// どれかが壊れていたら、黙って既定の一覧に戻らず、編集を止める。
	const roots = configRoots(projectDir, input.cwd, specified);
	const loaded = roots.map((root) => readConfig(CONFIG_CANDIDATES.map((c) => path.join(root, ...c.split('/')))));

	const linkBroken = loaded.find((l) => l.status === 'broken' && l.link);
	if (linkBroken) {
		block(`guard-code-edit: 設定ファイル ${linkBroken.file}（または親のフォルダ）がリンク切れなので編集を止めました。リンクを手で直してください。`);
	}

	// 編集先が、読む根のどれかの設定ファイルそのものか。設定ファイルがリンクのときは当たらない（ふつうの判定に回す。リンク先が秘密情報なら止まる）。
	// 設定ファイルそのものは、壊れていても・secretPatterns が当たっても直せるように通す（秘密情報ではない）。
	const isConfigItself =
		real !== null &&
		roots.some((root) =>
			CONFIG_CANDIDATES.some((c) => {
				const file = path.join(root, ...c.split('/'));
				return normalize(specified) === normalize(file) && normalize(real) === normalize(path.join(realPath(root) || root, ...c.split('/')));
			})
		);
	if (isConfigItself) {
		process.exit(0);
	}

	const broken = loaded.find((l) => l.status === 'broken');
	if (broken) {
		block(`guard-code-edit: 設定ファイル ${broken.file} を読めないので編集を止めました（${broken.reason}）。先にそのファイルを直してください。`);
	}

	if (real === null) {
		block(`guard-code-edit: ${target} はリンク先が無いシンボリックリンクを経由するので、編集先を判定できません。`);
	}

	const secretRegexps = loaded.flatMap((l) => (l.status === 'ok' ? l.secretRegexps : []));
	const reasons = [
		judge(specified, projectDir, OUTSIDE_WRITABLE, target, secretRegexps),
		judge(
			real,
			realPath(projectDir) || projectDir,
			OUTSIDE_WRITABLE.map((entry) => ({ ...entry, base: realPath(entry.base) || entry.base })),
			`${target}（リンク先 ${real}）`,
			secretRegexps
		),
	].filter((r) => r !== null);

	if (reasons.length > 0) {
		block(reasons[0]);
	}

	process.exit(0);
}

// 思わぬ例外で終わると、終了コード 1 になり、Claude Code は編集を通す。止める側に倒す（#108）
try {
	main();
} catch (e) {
	block(`guard-code-edit: 判定の途中で思わぬ失敗があったので編集を止めました（${e && e.message ? e.message : e}）。`);
}
