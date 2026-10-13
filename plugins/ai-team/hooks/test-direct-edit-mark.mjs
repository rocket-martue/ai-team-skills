#!/usr/bin/env node
// direct-edit-mark.mjs の確かめ。フックに入力の JSON を流して、終了コード・標準出力・印のファイルを見る。
// 使い方：リポジトリの根から node plugins/ai-team/hooks/test-direct-edit-mark.mjs
// 印の置き場所は一時ディレクトリの下なので、子のプロセスの TEMP・TMP・TMPDIR を仮の場所に向け、本物の一時ディレクトリに印を残さない。
// git は呼ばない。依存なし。

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(here, 'direct-edit-mark.mjs');

const sandbox = mkdtempSync(path.join(tmpdir(), 'mark-test-'));
const fakeTmp = path.join(sandbox, 'tmp');
const markRoot = path.join(fakeTmp, 'ai-team-direct-edit');
mkdirSync(fakeTmp, { recursive: true });

let failed = 0;

function check(label, ok) {
	if (!ok) {
		failed++;
	}
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
}

function runRaw(raw) {
	return spawnSync(process.execPath, [hook], {
		input: raw,
		env: { ...process.env, TEMP: fakeTmp, TMP: fakeTmp, TMPDIR: fakeTmp },
		encoding: 'utf8',
	});
}

const run = (input) => runRaw(JSON.stringify(input));
const prompt = (session, text) => run({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt: text });
const sessionEnd = (session) => run({ hook_event_name: 'SessionEnd', session_id: session, reason: 'other' });
const sessionStart = (session, source) => run({ hook_event_name: 'SessionStart', session_id: session, source });

const markFile = (session) => path.join(markRoot, session);
const has = (session) => existsSync(markFile(session));
const context = (r) => {
	try {
		return JSON.parse(r.stdout).hookSpecificOutput.additionalContext || '';
	} catch {
		return '';
	}
};
const reset = () => {
	rmSync(markRoot, { recursive: true, force: true });
};
const writeOld = (session, ageMs) => {
	mkdirSync(markRoot, { recursive: true });
	writeFileSync(markFile(session), JSON.stringify({ createdAt: Date.now() - ageMs }));
};

const ATTACH_1 = 'ガネーシャが直接コード書いて';
const ATTACH_2 = 'ガネーシャが直接直して';
const DETACH = '直接書くのはおしまい';

try {
	// ---- 付ける ----
	reset();
	let r = prompt('s1', `この色を替えて。${ATTACH_1}`);
	check('付ける言い方1で印が付く・終了コード 0', r.status === 0 && has('s1'));
	check('付けたときに additionalContext が出る', context(r) !== '' && context(r).includes('印を付けた'));
	check('付けたときの additionalContext に、範囲の線の中身（「3ファイル」「20行」）が入っていない', !context(r).includes('3ファイル') && !context(r).includes('20行') && context(r).includes('workflow.md'));

	reset();
	r = prompt('s1', `${ATTACH_2}ね`);
	check('付ける言い方2で印が付く', r.status === 0 && has('s1'));

	reset();
	r = prompt('s1', 'ガネーシャが 直接　コード\n書いて');
	check('空白（半角・全角・改行）が入っていても付く', r.status === 0 && has('s1'));

	reset();
	r = prompt('s1', 'ガネーシャが直接コードを書いて');
	check('外した言い方「ガネーシャが直接コードを書いて」では付かない・標準出力は空', r.status === 0 && !has('s1') && r.stdout === '');

	// ---- 印の中身 ----
	reset();
	prompt('s1', ATTACH_1);
	let content = null;
	try {
		content = JSON.parse(readFileSync(markFile('s1'), 'utf8'));
	} catch {
		content = null;
	}
	check(
		'印の中身が {"createdAt": <整数>} の形',
		content !== null &&
			Object.keys(content).length === 1 &&
			Number.isSafeInteger(content.createdAt) &&
			Math.abs(Date.now() - content.createdAt) < 60 * 1000
	);
	check('印を作った後に一時ファイルが残らない', readdirSync(markRoot).length === 1);

	// ---- 消す ----
	r = prompt('s1', DETACH);
	check('消す言い方で消える・終了コード 0', r.status === 0 && !has('s1'));
	check('消したときに additionalContext が出る', context(r).includes('印を消した'));

	reset();
	prompt('s1', ATTACH_1);
	r = prompt('s1', `${ATTACH_1}。やっぱり${DETACH}`);
	check('付ける言い方と消す言い方が両方あれば消す', r.status === 0 && !has('s1'));

	// ---- どちらでもない ----
	reset();
	prompt('s1', ATTACH_1);
	const before = readFileSync(markFile('s1'), 'utf8');
	r = prompt('s1', 'ふつうのメッセージ');
	check('どちらでもないメッセージで、印が変わらず標準出力が空', r.status === 0 && r.stdout === '' && readFileSync(markFile('s1'), 'utf8') === before);
	reset();
	r = prompt('s1', 'ふつうのメッセージ');
	check('どちらでもないメッセージで、印は付かない', r.status === 0 && !has('s1') && r.stdout === '');

	// ---- まーちゅう以外の書き出し ----
	for (const start of ['Another Claude session sent a message:', '<agent-message from="x">', '<task-notification>', '<system-reminder>']) {
		reset();
		r = prompt('s1', `  \n${start} ${ATTACH_1}`);
		check(`書き出し ${start} では、付ける言い方があっても印が付かない`, r.status === 0 && !has('s1') && r.stdout === '');
		prompt('s1', ATTACH_1);
		r = prompt('s1', `${start} ${DETACH}`);
		check(`書き出し ${start} でも、消す言い方では消える`, r.status === 0 && !has('s1'));
	}

	// ---- SessionEnd・SessionStart ----
	reset();
	prompt('s1', ATTACH_1);
	prompt('s2', ATTACH_1);
	r = sessionEnd('s1');
	check('SessionEnd で消える（ほかのセッションの印は残る）', r.status === 0 && !has('s1') && has('s2'));

	reset();
	prompt('s1', ATTACH_1);
	r = sessionStart('s1', 'resume');
	check('SessionStart（source が resume）で消える', r.status === 0 && !has('s1') && r.stdout === '');
	prompt('s1', ATTACH_1);
	r = sessionStart('s1', 'startup');
	check('SessionStart（source が startup）では消えない', r.status === 0 && has('s1'));

	// ---- session_id が不正 ----
	reset();
	for (const bad of ['../x', 'a/b', 'a.b', '', 'x'.repeat(129), 123, null, undefined]) {
		r = prompt(bad, ATTACH_1);
		check(`session_id が不正（${JSON.stringify(bad)}）なら書かない`, r.status === 0 && r.stdout === '' && (!existsSync(markRoot) || readdirSync(markRoot).length === 0) && !existsSync(path.join(fakeTmp, 'x')));
	}
	check('session_id が128文字なら付く', prompt('x'.repeat(128), ATTACH_1).status === 0 && has('x'.repeat(128)));

	// ---- 入力が JSON でない ----
	r = runRaw('not json');
	check('入力が JSON でなくても終了コード 0', r.status === 0);
	r = runRaw('');
	check('入力が空でも終了コード 0', r.status === 0);

	// ---- 消せなかったとき ----
	reset();
	mkdirSync(markFile('s1'), { recursive: true });
	writeFileSync(path.join(markFile('s1'), 'keep'), 'x');
	r = prompt('s1', DETACH);
	check('消せなかったとき（印の場所が中身のあるディレクトリ）は消せなかったと伝える', r.status === 0 && context(r).includes('消せなかった') && context(r).includes('コードを直さない'));
	r = sessionStart('s1', 'resume');
	check('再開で消せなかったときも、消せなかったと伝える', r.status === 0 && context(r).includes('消せなかった'));
	reset();

	// ---- 掃除 ----
	const HOUR = 60 * 60 * 1000;
	const DAY = 24 * HOUR;
	reset();
	writeOld('old1', 8 * DAY);
	writeOld('mid1', 25 * HOUR);
	writeOld('fresh1', HOUR);
	r = prompt('s1', 'ふつうのメッセージ');
	check('ほかのセッションの7日より古い印が消える', r.status === 0 && !has('old1'));
	check('ほかのセッションの24時間より古く7日以内の印は残る', has('mid1'));
	check('ほかのセッションの新しい印は残る', has('fresh1'));
	writeOld('old2', 8 * DAY);
	r = prompt('s1', ATTACH_1);
	check('付けるときにも7日より古い印が消える', !has('old2') && has('s1'));

	// createdAt が5分より先の時刻・整数でない印は、ファイルの更新時刻で古さを見る
	const setMtime = (session, ageMs) => {
		const t = new Date(Date.now() - ageMs);
		utimesSync(markFile(session), t, t);
	};
	reset();
	mkdirSync(markRoot, { recursive: true });
	writeFileSync(markFile('futold'), JSON.stringify({ createdAt: Date.now() + 10 * DAY }));
	setMtime('futold', 8 * DAY);
	writeFileSync(markFile('futnew'), JSON.stringify({ createdAt: Date.now() + 10 * DAY }));
	writeFileSync(markFile('badold'), 'not json');
	setMtime('badold', 8 * DAY);
	writeFileSync(markFile('floatold'), JSON.stringify({ createdAt: 1.5 }));
	setMtime('floatold', 8 * DAY);
	r = prompt('s1', 'ふつうのメッセージ');
	check('createdAt が5分より先の時刻の印も、更新時刻が7日より古ければ消える', r.status === 0 && !has('futold'));
	check('createdAt が5分より先の時刻の印でも、更新時刻が新しければ残る', has('futnew'));
	check('JSON でない印・createdAt が整数でない印も、更新時刻が7日より古ければ消える', !has('badold') && !has('floatold'));

	// ---- 消した後の確かめが ENOENT 以外のエラーのとき ----
	reset();
	const canChmod = process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() !== 0;
	if (canChmod) {
		mkdirSync(markRoot, { recursive: true });
		writeFileSync(markFile('s1'), JSON.stringify({ createdAt: Date.now() }));
		chmodSync(markRoot, 0o000);
		try {
			r = prompt('s1', DETACH);
			check('消した後の確かめが ENOENT 以外のエラーのときは、消せなかったと伝える', r.status === 0 && context(r).includes('消せなかった') && !context(r).includes('印を消した'));
		} finally {
			chmodSync(markRoot, 0o755);
		}
	} else {
		console.log('skip 消した後の確かめが ENOENT 以外のエラーのときの確かめ（権限でエラーを作れない環境）');
	}
	reset();

	// ---- リンク ----
	const linkType = process.platform === 'win32' ? 'junction' : 'dir';

	// 印の名前が別のファイルへのリンク
	reset();
	mkdirSync(markRoot, { recursive: true });
	const victim = path.join(sandbox, 'victim.txt');
	writeFileSync(victim, 'original');
	let fileLinked = true;
	try {
		symlinkSync(victim, markFile('s1'), 'file');
	} catch {
		fileLinked = false;
	}
	if (fileLinked) {
		r = prompt('s1', ATTACH_1);
		check(
			'印の名前がファイルへのリンクのとき、付け直してもリンク先の中身が変わらない',
			r.status === 0 && readFileSync(victim, 'utf8') === 'original' && !lstatSync(markFile('s1')).isSymbolicLink() && has('s1')
		);
		reset();
		mkdirSync(markRoot, { recursive: true });
		symlinkSync(victim, markFile('s1'), 'file');
		prompt('s1', DETACH);
		check('印の名前がファイルへのリンクのとき、消してもリンク先が残る', readFileSync(victim, 'utf8') === 'original' && !lstatSync(markFile('s1'), { throwIfNoEntry: false }));
	} else {
		console.log('skip 印の名前がファイルへのリンクの確かめ（シンボリックリンクを作れない環境）');
	}

	// 置き場所のディレクトリが別の場所へのリンク（ジャンクション）
	reset();
	const farDir = path.join(sandbox, 'far');
	mkdirSync(farDir, { recursive: true });
	const farFile = path.join(farDir, 's1');
	const farOld = path.join(farDir, 'old9');
	const snapshot = () => JSON.stringify(readdirSync(farDir).sort().map((n) => [n, readFileSync(path.join(farDir, n), 'utf8')]));
	let dirLinked = true;
	try {
		symlinkSync(farDir, markRoot, linkType);
	} catch {
		dirLinked = false;
	}
	if (dirLinked) {
		writeFileSync(farFile, 'keep-1');
		writeFileSync(farOld, JSON.stringify({ createdAt: Date.now() - 48 * 60 * 60 * 1000 }));
		const base = snapshot();
		r = prompt('s1', ATTACH_1);
		check('置き場所がリンクのとき、付けてもリンク先が変わらない・付けたと伝えない', r.status === 0 && snapshot() === base && context(r) === '');
		r = prompt('s1', DETACH);
		check('置き場所がリンクのとき、消してもリンク先が変わらない・消せなかったと伝える', r.status === 0 && snapshot() === base && context(r).includes('消せなかった'));
		r = sessionEnd('s1');
		check('置き場所がリンクのとき、SessionEnd でもリンク先が変わらない', r.status === 0 && snapshot() === base);
		r = prompt('s2', 'ふつうのメッセージ');
		check('置き場所がリンクのとき、掃除でもリンク先が変わらない', r.status === 0 && snapshot() === base);
		rmSync(markRoot, { force: true, recursive: false });
	} else {
		console.log('skip 置き場所がリンクの確かめ（リンクを作れない環境）');
	}

	// ハードリンクは、印の名前そのものを消すだけ（別名には触れない）
	reset();
	mkdirSync(markRoot, { recursive: true });
	writeFileSync(victim, 'original');
	let hardLinked = true;
	try {
		linkSync(victim, markFile('s1'));
	} catch {
		hardLinked = false;
	}
	if (hardLinked) {
		prompt('s1', ATTACH_1);
		check('ハードリンクの印を付け直しても、別名の中身が変わらない', readFileSync(victim, 'utf8') === 'original');
	} else {
		console.log('skip ハードリンクの確かめ（作れない環境）');
	}
} finally {
	rmSync(sandbox, { recursive: true, force: true });
}

if (failed > 0) {
	console.log(`\n${failed} 件失敗`);
	process.exit(1);
}

console.log('\n全部通った');
