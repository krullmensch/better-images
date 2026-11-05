import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	diffSets,
	extensionOf,
	isInFolders,
	parentOf,
	parseCanvasFiles,
	parseExtensions,
	parseFolderList,
	resolveTargetFolder,
	uniquePath,
} from '../src/core.ts';

test('parseCanvasFiles reads file nodes only', () => {
	const text = JSON.stringify({
		nodes: [
			{ id: '1', type: 'file', file: 'a/b.png' },
			{ id: '2', type: 'text', text: '![[c.png]]' },
			{ id: '3', type: 'file', file: 'Note.md' },
			{ id: '4', type: 'group' },
			{ id: '5', type: 'file', file: '' },
		],
		edges: [],
	});
	assert.deepEqual([...(parseCanvasFiles(text) ?? [])], ['a/b.png', 'Note.md']);
});

test('parseCanvasFiles treats empty canvases as empty', () => {
	assert.equal(parseCanvasFiles('')?.size, 0);
	assert.equal(parseCanvasFiles('  \n')?.size, 0);
	assert.equal(parseCanvasFiles('{}')?.size, 0);
});

test('parseCanvasFiles returns null for broken files', () => {
	assert.equal(parseCanvasFiles('{"nodes":[{"id":'), null);
	assert.equal(parseCanvasFiles('[]'), null);
	assert.equal(parseCanvasFiles('{"nodes":5}'), null);
	assert.equal(parseCanvasFiles('null'), null);
});

test('diffSets', () => {
	const result = diffSets(new Set(['a', 'b']), new Set(['b', 'c']));
	assert.deepEqual(result, { added: ['c'], removed: ['a'] });
});

test('parseExtensions normalizes the list', () => {
	assert.deepEqual([...parseExtensions(' PNG, .jpg;webp\nheic ,, ')], ['png', 'jpg', 'webp', 'heic']);
});

test('extensionOf and parentOf', () => {
	assert.equal(extensionOf('a/b.c/Photo.JPG'), 'jpg');
	assert.equal(extensionOf('a/b.c/README'), '');
	assert.equal(extensionOf('.hidden'), '');
	assert.equal(parentOf('a/b/c.png'), 'a/b');
	assert.equal(parentOf('c.png'), '');
});

test('resolveTargetFolder relative to the canvas', () => {
	assert.equal(resolveTargetFolder('Projects/X/Board.canvas', './Assets'), 'Projects/X/Assets');
	assert.equal(resolveTargetFolder('Board.canvas', './Assets'), 'Assets');
	assert.equal(resolveTargetFolder('Projects/X/Board.canvas', '.'), 'Projects/X');
	assert.equal(resolveTargetFolder('Board.canvas', '.'), '');
});

test('resolveTargetFolder with {canvas} and absolute paths', () => {
	assert.equal(resolveTargetFolder('P/Mood board.canvas', './{canvas} assets'), 'P/Mood board assets');
	assert.equal(resolveTargetFolder('P/Board.canvas', 'Attachments/{canvas}/'), 'Attachments/Board');
	assert.equal(resolveTargetFolder('P/Board.canvas', '/Attachments//img'), 'Attachments/img');
});

test('resolveTargetFolder rejects empty and escaping paths', () => {
	assert.equal(resolveTargetFolder('P/Board.canvas', '  '), null);
	assert.equal(resolveTargetFolder('P/Board.canvas', '../Elsewhere'), null);
	assert.equal(resolveTargetFolder('P/Board.canvas', 'a/../../b'), null);
});

test('folder list and scope', () => {
	const folders = parseFolderList(' Projects/ \n\n/Other//Sub\n');
	assert.deepEqual(folders, ['Projects', 'Other/Sub']);
	assert.equal(isInFolders('Projects/X/Board.canvas', folders), true);
	assert.equal(isInFolders('Projects2/Board.canvas', folders), false);
	assert.equal(isInFolders('Board.canvas', []), true);
});

test('uniquePath avoids collisions', () => {
	const taken = new Set(['A/img.png', 'A/img 2.png']);
	assert.equal(uniquePath('A', 'img.png', (p) => taken.has(p)), 'A/img 3.png');
	assert.equal(uniquePath('A', 'new.png', (p) => taken.has(p)), 'A/new.png');
	assert.equal(uniquePath('', 'img.png', () => false), 'img.png');
	assert.equal(uniquePath('A', 'README', (p) => p === 'A/README'), 'A/README 2');
});
