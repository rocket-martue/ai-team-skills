#!/usr/bin/env node
// PreToolUse フック：ファイル編集を「誰が」「どこに」するかで止める。
// - メジェド（サブエージェント mejed）だけがコードを編集できる
// - ガネーシャ（メインのエージェント）が書けるのは docs/tasks/ の中と、Markdown（.md）の文書だけ
// - 秘密情報のファイルは誰も触れない
// - リポジトリの外は、Claude Code 自身の置き場所（メモリ・計画ファイル・scratchpad）だけ通す
// 判定は「指定されたパス」と「シンボリックリンクをたどった実体のパス」の両方に当て、どちらかで止まれば止める。
// 止めるときは exit 2 と stderr の理由を返す（Claude に理由が伝わる）。

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

const IMPLEMENTER = 'mejed';

// 誰も編集できないパス（リポジトリに合わせて足す）。
// 先頭で固定しない（`(^|/)`）。worktree の中（.claude/worktrees/<名前>/.dev.vars）でも当たるようにする。
const SECRET_PATTERNS = [/(^|\/)\.dev\.vars$/, /(^|\/)\.kv\//, /(^|\/)wp-config\.php$/, /(^|\/)\.env[^/]*$/];

// ガネーシャが編集できるパス（リポジトリのルートから）。
// .md は「コード以外（.md）の PR レビューの指摘はガネーシャが直す」（Ganesha.md）のため。
const PLANNER_WRITABLE = [/^docs\/tasks\//, /\.md$/];

// git worktree の置き場所（リポジトリの中）。この頭を剥がした相対パスで、メインのチェックアウトと同じ判定をする。
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

// Windows のファイルシステムは大文字小文字を区別しない（.DEV.VARS と .dev.vars は同じファイル）。
// パターンとの照合も包含の判定も、Windows では小文字にそろえてから行う。
function forMatch(p) {
	return process.platform === 'win32' ? p.toLowerCase() : p;
}

function normalize(p) {
	return forMatch(path.resolve(p).split(path.sep).join('/'));
}

function isInside(target, dir) {
	const t = normalize(target);
	const d = normalize(dir);
	return t === d || t.startsWith(d.endsWith('/') ? d : d + '/');
}

// そのパス自体がリンク（Windows のジャンクションを含む）か。リンク先の有無は問わない。
function isLink(p) {
	try {
		return lstatSync(p).isSymbolicLink();
	} catch {
		return false;
	}
}

// シンボリックリンク（Windows のジャンクションを含む）をたどった実体のパス。
// まだ無いファイル（新規作成）は、存在する一番近い親ディレクトリの実体に、残りの部分をつなぐ。
// リンク先が無いリンク（壊れたリンク）は、実体を判定できないので null を返す（呼び出し側で止める）。
// 通常のまだ無いパスと区別しないと、リンクの見た目のパスで判定されて、リンク経由の新規作成が通ってしまう。
function realPath(p) {
	let current = path.resolve(p);
	const rest = [];

	for (;;) {
		try {
			return path.join(realpathSync.native(current), ...rest);
		} catch {
			if (isLink(current)) {
				return null;
			}

			const parent = path.dirname(current);

			if (parent === current) {
				return path.resolve(p);
			}

			rest.unshift(path.basename(current));
			current = parent;
		}
	}
}

// 編集してよければ null、だめなら理由を返す。
function judge(absolute, projectDir, outsideWritable, label) {
	if (!isInside(absolute, projectDir)) {
		if (SECRET_PATTERNS.some((re) => re.test(normalize(absolute)))) {
			return `guard-code-edit: ${label} は秘密情報のファイルなので編集できません。`;
		}

		const allowed = outsideWritable.some(
			({ base, pattern }) =>
				isInside(absolute, base) && pattern.test(forMatch(path.relative(base, absolute).split(path.sep).join('/')))
		);

		if (allowed) {
			return null;
		}

		return `guard-code-edit: リポジトリの外（${label}）は編集できません。`;
	}

	const projectRel = forMatch(path.relative(projectDir, absolute).split(path.sep).join('/'));

	// 秘密情報の判定は、worktree の頭を剥がす前のパスにも当てる（worktree の名前が `.kv` などでも抜けないように）。
	if (SECRET_PATTERNS.some((re) => re.test(projectRel))) {
		return `guard-code-edit: ${label} は秘密情報のファイルなので編集できません。`;
	}

	// `.claude/worktrees/<名前>/` の中は、その頭を剥がした相対パスで判定する。
	// `.claude/worktrees/<名前>` そのもの（剥がすと空）は、剥がさずに今と同じ判定にする。
	const worktreeMatch = WORKTREE_PREFIX.exec(projectRel);
	const rel = worktreeMatch ? worktreeMatch[1] : projectRel;

	if (SECRET_PATTERNS.some((re) => re.test(rel))) {
		return `guard-code-edit: ${label} は秘密情報のファイルなので編集できません。`;
	}

	if (isSubagent && agentType === IMPLEMENTER) {
		return null;
	}

	if (PLANNER_WRITABLE.some((re) => re.test(rel))) {
		return null;
	}

	const who = isSubagent ? `サブエージェント「${agentType}」` : 'ガネーシャ';

	return `guard-code-edit: ${who}は ${label} を編集できません。実装は mejed サブエージェントに任せてください（delegate-to-mejed スキル）。`;
}

let input;
try {
	input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
	// 入力が読めないときは安全側に倒して止める
	block('guard-code-edit: フック入力を読めなかったので編集を止めました。');
}

const toolInput = input.tool_input || {};
const target = toolInput.file_path || toolInput.notebook_path;
if (!target) {
	process.exit(0);
}

const isSubagent = Boolean(input.agent_id);
const agentType = input.agent_type || '';

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const specified = path.resolve(projectDir, target);
const real = realPath(specified);

if (real === null) {
	block(`guard-code-edit: ${target} はリンク先が無いシンボリックリンクを経由するので、編集先を判定できません。`);
}

const reason =
	judge(specified, projectDir, OUTSIDE_WRITABLE, target) ||
	judge(
		real,
		realPath(projectDir) || projectDir,
		OUTSIDE_WRITABLE.map((entry) => ({ ...entry, base: realPath(entry.base) || entry.base })),
		`${target}（リンク先 ${real}）`
	);

if (reason) {
	block(reason);
}

process.exit(0);
