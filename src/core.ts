// Pure helpers without Obsidian imports, so they can be unit tested with `node --test`.

export const DEFAULT_EXTENSIONS =
	'png, jpg, jpeg, gif, webp, svg, avif, heic, heif, bmp, tif, tiff, mp4, mov, webm, m4v';

/**
 * Returns the vault paths of all file nodes in a canvas.
 * Returns null if the text is not a valid canvas, so a half-written file never
 * looks like a canvas whose nodes were all removed.
 */
export function parseCanvasFiles(text: string): Set<string> | null {
	const files = new Set<string>();
	if (text.trim() === '') return files;

	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return null;
	}
	if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;

	const nodes = (data as { nodes?: unknown }).nodes;
	if (nodes === undefined) return files;
	if (!Array.isArray(nodes)) return null;

	for (const node of nodes) {
		if (node === null || typeof node !== 'object') continue;
		const { type, file } = node as { type?: unknown; file?: unknown };
		if (type === 'file' && typeof file === 'string' && file !== '') files.add(file);
	}
	return files;
}

export function diffSets(prev: Set<string>, next: Set<string>): { added: string[]; removed: string[] } {
	return {
		added: [...next].filter((p) => !prev.has(p)),
		removed: [...prev].filter((p) => !next.has(p)),
	};
}

export function parseExtensions(value: string): Set<string> {
	return new Set(
		value
			.split(/[\s,;]+/)
			.map((e) => e.trim().replace(/^\.+/, '').toLowerCase())
			.filter((e) => e !== ''),
	);
}

export function extensionOf(path: string): string {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

function cleanFolder(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.filter((part) => part !== '' && part !== '.')
		.join('/');
}

/**
 * Turns the target folder setting into a vault folder path for a canvas.
 * "./x" is relative to the canvas folder, "{canvas}" is the canvas name without extension.
 * Returns null for an empty setting or a path that leaves the vault ("..").
 * Returns "" for the vault root.
 */
export function resolveTargetFolder(canvasPath: string, setting: string): string | null {
	const template = setting.trim();
	if (template === '') return null;

	const canvasName = canvasPath.slice(canvasPath.lastIndexOf('/') + 1).replace(/\.canvas$/i, '');
	let folder = template.split('{canvas}').join(canvasName);

	if (folder === '.' || folder.startsWith('./')) {
		folder = `${parentOf(canvasPath)}/${folder.slice(1)}`;
	}
	if (folder.split(/[\\/]/).includes('..')) return null;
	return cleanFolder(folder);
}

export function parseFolderList(value: string): string[] {
	return value
		.split('\n')
		.map((line) => cleanFolder(line.trim()))
		.filter((line) => line !== '');
}

/** True if the path lies inside one of the folders, or if the list is empty. */
export function isInFolders(path: string, folders: string[]): boolean {
	if (folders.length === 0) return true;
	return folders.some((folder) => path.startsWith(`${folder}/`));
}

/** Finds a free path like "folder/name 2.png" if "folder/name.png" is taken. */
export function uniquePath(folder: string, fileName: string, exists: (path: string) => boolean): string {
	const prefix = folder === '' ? '' : `${folder}/`;
	const dot = fileName.lastIndexOf('.');
	const base = dot <= 0 ? fileName : fileName.slice(0, dot);
	const ext = dot <= 0 ? '' : fileName.slice(dot);

	let candidate = `${prefix}${fileName}`;
	for (let i = 2; exists(candidate); i++) candidate = `${prefix}${base} ${i}${ext}`;
	return candidate;
}
