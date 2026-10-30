#!/usr/bin/env node
// PreToolUse フック（Bash）：健さんのラッパー（invoke-codex.mjs・invoke-codex.ps1）の呼び出しだけ、確認なしで通す。
// 返すのは allow か、何も返さない（今の決まりに任せる）かだけ。ask・deny は返さない。settings の deny・ask はこの allow より先に効く。
// 決まりの書き方（settings.json の allow）では、リポジトリの中に置いた偽物のラッパー（.../ai-team-skills/ai-team/x/skills/codex/scripts/invoke-codex.mjs）を外せないので、フックで本物かを見る（#109）。
// 本物とは、次の2つの根の下の skills/codex/scripts/ にあるもの（リンクをたどった実体で比べる）。
// - このフック自身の根（入れた形ではキャッシュ。--plugin-dir で動かしたときはそのフォルダ）
// - マーケットプレイスの写し（<設定の根>/plugins/marketplaces/ai-team-skills/plugins/ai-team。gh-pr が呼ぶ）。設定の根は CLAUDE_CONFIG_DIR か <ホーム>/.claude
// 当たる形は、前に `cd <パス> && ` が1つ付いてもよい次の2つだけ。ほかは何も返さない。
// - node "<根>/skills/codex/scripts/invoke-codex.mjs" <引数>
// - powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<根>/skills/codex/scripts/invoke-codex.ps1" <引数>
// 引数と cd のパスにシェルの記号（引用の外の ; & | < > ( ) $ ` 改行、引用の中の $ ` \"）があれば、何も返さない。
// 失敗しても（例外・入力が読めない）何も返さない＝判定なしで今の決まりに戻る。

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forPath, realPath, toSlash } from './ai-team-config.mjs';

const HEAD_NODE = /^node[ \t]+/;
const HEAD_POWERSHELL = /^powershell\.exe[ \t]+-NoProfile[ \t]+-ExecutionPolicy[ \t]+Bypass[ \t]+-File[ \t]+/;

// 本物のラッパーがある根（フック自身の根と、マーケットプレイスの写し）。無い根は matches の中で飛ばす。
function wrapperRoots() {
	const own = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const configRoot = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'));

	return [own, path.join(configRoot, 'plugins', 'marketplaces', 'ai-team-skills', 'plugins', 'ai-team')];
}

// 比べる前のそろえ方：`\` → `/`、Git Bash の `/c/…` → `c:/…`（どちらも Windows だけ）。絶対パスでないもの・`..` を含むものは null。
function normalizePath(p) {
	let q = toSlash(p);

	if (process.platform === 'win32') {
		q = q.replace(/^\/([A-Za-z])(?=\/|$)/, '$1:');
	}

	if (!path.isAbsolute(q) || q.split('/').includes('..')) {
		return null;
	}

	return q;
}

const sameFile = (a, b) => forPath(a.split(path.sep).join('/')) === forPath(b.split(path.sep).join('/'));

// a と b が、リンクをたどった実体で同じファイルか（どちらかが無ければ false）。
function sameReal(a, b) {
	if (!existsSync(a) || !existsSync(b)) {
		return false;
	}

	const ra = realPath(a);
	const rb = realPath(b);

	return ra !== null && rb !== null && sameFile(ra, rb);
}

// p が、どちらかの根の skills/codex/scripts/<script> の本物（リンクをたどった実体が同じ）か。
// .ps1 の中継は、呼ばれた場所（リンクならリンク側）の隣の invoke-codex.mjs を動かすので、その隣の .mjs も本物と同じ実体かを見る。
function matches(p, script) {
	const q = normalizePath(p);

	if (q === null) {
		return false;
	}

	return wrapperRoots().some((root) => {
		const dir = path.join(root, 'skills', 'codex', 'scripts');

		if (!sameReal(q, path.join(dir, script))) {
			return false;
		}

		return script !== 'invoke-codex.ps1' || sameReal(path.join(path.dirname(q), 'invoke-codex.mjs'), path.join(dir, 'invoke-codex.mjs'));
	});
}

// s の i 文字目から、シェルの1語（二重引用・一重引用・引用なし）を読む。{ value, end } か、読めない・記号を含むときは null。
// パスの語なので、引用の中の $ ` \" と改行、`\` の後ろが $ ` " \ のものも受けない。引用なしは、記号・展開の記号と `\`（シェルが消す文字）を含まない空白なしの語だけ。
function readWord(s, i) {
	const c = s[i];

	if (c === '"') {
		for (let j = i + 1; j < s.length; j++) {
			const d = s[j];

			// 改行も受けない（`\` と改行はシェルが消すので、照らしたパスと動くパスがずれる）
			if (d === '$' || d === '`' || d === '\n' || d === '\r') {
				return null;
			}

			if (d === '\\') {
				if (['$', '`', '"', '\\'].includes(s[j + 1])) {
					return null;
				}
			} else if (d === '"') {
				return { value: s.slice(i + 1, j), end: j + 1 };
			}
		}

		return null;
	}

	if (c === "'") {
		const j = s.indexOf("'", i + 1);

		if (j < 0 || /[$`\n\r]/.test(s.slice(i + 1, j))) {
			return null;
		}

		return { value: s.slice(i + 1, j), end: j + 1 };
	}

	// 引用なしは、展開の記号（* ? [ ] { } ~）とコメントの # も受けない（照らしたファイルと、シェルが展開して動かすファイルがずれるため）
	const m = /^[^\s"'`$;&|<>()\\*?[\]{}~#]+/.exec(s.slice(i));

	return m === null ? null : { value: m[0], end: i + m[0].length };
}

// 引数の並びにシェルの記号が無いか。引用の外の ; & | < > ( ) $ ` 改行、二重引用の中の $ ` \" があれば false。閉じていない引用も false。
// 引用の外の `\` は、次の1字をただの文字にする（行末の `\` は行の継ぎ足しなので false）。
function argsSafe(s) {
	let quote = '';

	for (let i = 0; i < s.length; i++) {
		const c = s[i];

		if (quote === "'") {
			if (c === "'") {
				quote = '';
			}
		} else if (quote === '"') {
			if (c === '"') {
				quote = '';
			} else if (c === '$' || c === '`') {
				return false;
			} else if (c === '\\') {
				// \" \$ \` と、\ と改行（シェルが消す）は受けない
				if (['"', '$', '`', '\n', '\r'].includes(s[i + 1])) {
					return false;
				}

				if (s[i + 1] === '\\') {
					i++;
				}
			}
		} else if (c === '\\') {
			if (s[i + 1] === '\n' || s[i + 1] === '\r') {
				return false;
			}

			i++;
		} else if (';&|<>()$`#\n\r'.includes(c)) {
			// # はコメントの始まりになりうる（コメントの中の引用符で、引用の読み方がずれるため受けない）
			return false;
		} else if (c === "'" || c === '"') {
			quote = c;
		}
	}

	return quote === '';
}

// 通すなら理由の文字列、判定しないなら null。
function judge(command) {
	let rest = command.trim();

	// 制御文字（タブ以外。改行・CR を含む）があれば判定しない。正しい呼び出しには要らず、シェルの読み方の違いを生むため（前後の空白・改行は落としてから見る）
	if (/[\x00-\x08\x0a-\x1f\x7f]/.test(rest)) {
		return null;
	}
	const cd = /^cd[ \t]+/.exec(rest);

	if (cd !== null) {
		const word = readWord(rest, cd[0].length);
		const and = word === null ? null : /^[ \t]+&&[ \t]+/.exec(rest.slice(word.end));

		if (word === null || and === null) {
			return null;
		}

		rest = rest.slice(word.end + and[0].length);
	}

	const forms = [
		{ head: HEAD_NODE, script: 'invoke-codex.mjs' },
		{ head: HEAD_POWERSHELL, script: 'invoke-codex.ps1' },
	];

	for (const { head, script } of forms) {
		const m = head.exec(rest);

		if (m === null) {
			continue;
		}

		const word = readWord(rest, m[0].length);

		if (word === null) {
			return null;
		}

		const args = rest.slice(word.end);

		if (args !== '' && !/^[ \t]/.test(args)) {
			return null;
		}

		if (!argsSafe(args) || !matches(word.value, script)) {
			return null;
		}

		return `guard-bash: 健さんのラッパー（${script}）の本物の呼び出しなので、確認なしで通します。`;
	}

	return null;
}

function main() {
	let input;

	try {
		input = JSON.parse(readFileSync(0, 'utf8'));
	} catch {
		return;
	}

	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		return;
	}

	const toolInput = input.tool_input;

	if (input.tool_name !== 'Bash' || toolInput === null || typeof toolInput !== 'object' || typeof toolInput.command !== 'string') {
		return;
	}

	const reason = judge(toolInput.command);

	if (reason !== null) {
		process.stdout.write(
			JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: reason } })
		);
	}
}

// 判定の途中で思わぬ失敗があっても、何も返さない（今の決まりに戻る）
try {
	main();
} catch {
	// 何も返さない
}
