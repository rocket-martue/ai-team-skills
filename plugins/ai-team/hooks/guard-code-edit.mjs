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

// 相対パス（区切りは /）が、既定の一覧か足したグロブに当たるか。`.claude/worktrees/<名前>/` の中は、その頭を剥がした相対パスでも判定する。
// 入れ子でも、剥がせなくなるまで繰り返す。判定は、頭を剥がす前のパスにも当てる（worktree の名前が `.kv` などでも抜けないように）。
function isSecretRel(projectRel, regexps) {
	if (isSecretPath(projectRel, regexps)) {
		return true;
	}

	let rel = projectRel;
	for (let m = WORKTREE_PREFIX.exec(rel); m; m = WORKTREE_PREFIX.exec(rel)) {
		rel = m[1];
	}

	return isSecretPath(rel, regexps);
}

// 止めるなら理由の文字列、通すなら null を返す。
// secretRegexps は、全部の設定のパターン（プロジェクトの根からの相対パスに当てる）。
// perRoot は [{ root, regexps }]。パターンを書いた設定の根からの相対パスにも当てる（入れ子のリポジトリの設定が効くように）。
function judge(absolute, projectDir, outsideWritable, label, secretRegexps, perRoot) {
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

	if (isSecretRel(projectRel, secretRegexps)) {
		return secretReason;
	}

	const underRoot = perRoot.some(({ root, regexps }) => {
		if (!isInside(absolute, root)) {
			return false;
		}
		return isSecretRel(forMatch(path.relative(root, absolute).split(path.sep).join('/')), regexps);
	});

	return underRoot ? secretReason : null;
}

// 設定ファイルを読む根を集める（#108。ラッパーと同じく、作業の根とメインのチェックアウトの根の両方を読む）。
// - プロジェクトの根と、そのメインの根
// - フックの cwd の git の根と、そのメインの根。ただし、そのメインの根がプロジェクトのメインの根と同じとき（同じリポジトリ）だけ
//   （EnterWorktree の後は、cwd が worktree、CLAUDE_PROJECT_DIR がメインを指すため。関係ないリポジトリの壊れた設定で、全部の編集が止まらないように）
// - 編集先がプロジェクトの中なら、編集先が入っている git の根（.claude/worktrees/<名前>/ の中など）と、そのメインの根
// 返すのは { roots: 根の配列, problem: 止める理由（無ければ null） }。.git を読めないときは problem に入れる。
function configRoots(projectDir, cwd, specified) {
	const roots = [projectDir];
	let problem = null;
	const add = (r) => {
		if (r && !roots.some((x) => normalize(x) === normalize(r))) roots.push(r);
	};
	const look = (dir) => {
		const found = gitRoots(dir);
		if (found !== null && found.broken && problem === null) {
			problem = `guard-code-edit: ${found.root} の .git を読めない（アクセス権など）か形が壊れているので、設定ファイルを読む根を決められず編集を止めました。`;
		}
		return found;
	};
	const own = look(projectDir);
	if (own !== null) add(own.main);
	if (typeof cwd === 'string' && cwd !== '') {
		const here = look(cwd);
		if (here !== null && own !== null && own.main !== null && here.main !== null && normalize(here.main) === normalize(own.main)) {
			add(here.root);
			add(here.main);
		}
	}
	if (isInside(specified, projectDir)) {
		const target = look(specified);
		if (target !== null) {
			add(target.root);
			add(target.main);
		}
	}
	return { roots, problem };
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
	// 編集先が無い・空のときも止める（見ないまま通すと、判定が抜けるため）
	if (target === undefined || target === null || target === '') {
		block('guard-code-edit: 編集先のパス（file_path・notebook_path）が無いか空なので編集を止めました。');
	}
	if (typeof target !== 'string') {
		block('guard-code-edit: 編集先のパスが文字列ではないので編集を止めました。');
	}

	const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
	const specified = path.resolve(projectDir, target);
	const real = realPath(specified);
	const projectReal = realPath(projectDir) || projectDir;

	// リポジトリごとの追加（.claude/ai-team.json。無ければ repo-files/claude/ai-team.json）を、読む根の全部から合わせる。
	// どれかが壊れていたら、黙って既定の一覧に戻らず、編集を止める。
	const { roots, problem } = configRoots(projectDir, input.cwd, specified);
	if (problem !== null) {
		block(problem);
	}
	const loaded = roots.map((root) => readConfig(CONFIG_CANDIDATES.map((c) => path.join(root, ...c.split('/')))));

	const linkBroken = loaded.find((l) => l.status === 'broken' && l.link);
	if (linkBroken) {
		block(`guard-code-edit: 設定ファイル ${linkBroken.file}（または親のフォルダ）がリンク切れなので編集を止めました。リンクを手で直してください。`);
	}

	// 編集先が、プロジェクトの中にある根の設定ファイルそのものか。通すのは、その根で実際に読む1つだけ
	// （.claude/ai-team.json があればそれ、無ければ repo-files/claude/ai-team.json）。しかも、指定のパスと実体のパスの両方が、
	// 既定の秘密情報の判定を通ったときだけ（`.claude/worktrees/.kv/` の中などは通さない）。
	// プロジェクトの外の根（細工した .git が指す場所など）の設定ファイルは、読むだけで、編集は「外」の判定に回す。
	// 設定ファイルがリンクのときは当たらない（ふつうの判定に回す。リンク先が秘密情報なら止まる）。
	// 設定ファイルそのものは、壊れていても・secretPatterns が当たっても直せるように通す（秘密情報ではない）。
	const cleanOfDefaults = (abs, base) => !SECRET_PATTERNS.some((re) => re.test(forMatch(path.relative(base, abs).split(path.sep).join('/'))));
	const isConfigItself =
		real !== null &&
		roots.some((root, i) => {
			if (!isInside(root, projectDir) || !isInside(realPath(root) || root, projectReal)) {
				return false;
			}
			const l = loaded[i];
			const file = l.status === 'none' ? path.join(root, ...CONFIG_CANDIDATES[0].split('/')) : l.file;
			return (
				normalize(specified) === normalize(file) &&
				normalize(real) === normalize(path.join(realPath(root) || root, path.relative(root, file))) &&
				cleanOfDefaults(specified, projectDir) &&
				cleanOfDefaults(real, projectReal)
			);
		});
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
	const perRoot = (toReal) =>
		loaded.flatMap((l, i) => (l.status === 'ok' && l.secretRegexps.length > 0 ? [{ root: toReal ? realPath(roots[i]) || roots[i] : roots[i], regexps: l.secretRegexps }] : []));
	const reasons = [
		judge(specified, projectDir, OUTSIDE_WRITABLE, target, secretRegexps, perRoot(false)),
		judge(
			real,
			projectReal,
			OUTSIDE_WRITABLE.map((entry) => ({ ...entry, base: realPath(entry.base) || entry.base })),
			`${target}（リンク先 ${real}）`,
			secretRegexps,
			perRoot(true)
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
