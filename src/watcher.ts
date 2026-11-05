import { App, Notice, TAbstractFile, TFile, TFolder, normalizePath } from 'obsidian';
import type { BetterImagesSettings } from './settings';
import { MIN_REMOVE_DELAY_SECONDS } from './settings';
import {
	diffSets,
	extensionOf,
	isInFolders,
	parentOf,
	parseCanvasFiles,
	parseExtensions,
	resolveTargetFolder,
	uniquePath,
} from './core';

/** Only images created this recently count as "new" and get sorted. */
const NEW_FILE_MAX_AGE_MS = 2 * 60 * 1000;
/** Wait a moment so the canvas has finished saving before an image is moved. */
const SORT_DELAY_MS = 3000;

const isCanvas = (file: TAbstractFile | null): file is TFile => file instanceof TFile && file.extension === 'canvas';

/**
 * Remembers which files each canvas uses, compares every saved canvas with
 * its previous state, and sorts added images or removes images no longer used.
 */
export class CanvasWatcher {
	private readonly app: App;
	private readonly getSettings: () => BetterImagesSettings;
	private readonly canvases = new Map<string, Set<string>>();
	private readonly timers = new Set<number>();
	private readonly removals = new Map<string, number>();
	private queue: Promise<void> = Promise.resolve();
	private stopped = false;

	constructor(app: App, getSettings: () => BetterImagesSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async start(): Promise<void> {
		for (const file of this.app.vault.getFiles()) {
			if (isCanvas(file)) await this.remember(file);
		}
	}

	stop(): void {
		this.stopped = true;
		for (const timer of this.timers) window.clearTimeout(timer);
		this.timers.clear();
		this.removals.clear();
		this.canvases.clear();
	}

	onCreate(file: TAbstractFile): void {
		if (isCanvas(file)) this.enqueue(() => this.remember(file));
	}

	onModify(file: TAbstractFile): void {
		if (isCanvas(file)) this.enqueue(() => this.compare(file));
	}

	onRename(file: TAbstractFile, oldPath: string): void {
		const files = this.canvases.get(oldPath);
		if (!files) return;
		this.canvases.delete(oldPath);
		if (isCanvas(file)) this.canvases.set(file.path, files);
	}

	onDelete(file: TAbstractFile): void {
		this.canvases.delete(file.path);
	}

	private enqueue(task: () => Promise<void>): void {
		this.queue = this.queue.then(async () => {
			if (this.stopped) return;
			try {
				await task();
			} catch (error) {
				console.error('Better Images:', error);
			}
		});
	}

	private later(ms: number, task: () => Promise<void>): number {
		const timer = window.setTimeout(() => {
			this.timers.delete(timer);
			this.enqueue(task);
		}, ms);
		this.timers.add(timer);
		return timer;
	}

	private async readCanvas(file: TFile): Promise<Set<string> | null> {
		return parseCanvasFiles(await this.app.vault.read(file));
	}

	private async remember(file: TFile): Promise<void> {
		const files = await this.readCanvas(file);
		if (files) this.canvases.set(file.path, files);
	}

	private async compare(file: TFile): Promise<void> {
		const next = await this.readCanvas(file);
		if (!next) return;
		const prev = this.canvases.get(file.path);
		this.canvases.set(file.path, next);
		if (!prev) return;

		const { added, removed } = diffSets(prev, next);
		for (const path of removed) this.scheduleRemoval(path);
		for (const path of added) this.later(SORT_DELAY_MS, () => this.sort(file.path, path));
	}

	private isHandled(file: TFile): boolean {
		return parseExtensions(this.getSettings().extensions).has(extensionOf(file.path));
	}

	/** True if any canvas (read fresh from disk) or any note links to the file. */
	private async isUsed(path: string, ignoreCanvas?: string): Promise<boolean> {
		for (const file of this.app.vault.getFiles()) {
			if (!isCanvas(file) || file.path === ignoreCanvas) continue;
			const files = await this.readCanvas(file);
			if (files?.has(path)) return true;
		}
		const links = this.app.metadataCache.resolvedLinks;
		for (const source of Object.keys(links)) {
			if (source === ignoreCanvas || source === path) continue;
			if (links[source]?.[path]) return true;
		}
		return false;
	}

	private async sort(canvasPath: string, path: string): Promise<void> {
		const settings = this.getSettings();
		if (!settings.sortEnabled || !isInFolders(canvasPath, settings.canvasFolders)) return;

		const file = this.app.vault.getFileByPath(path);
		if (!file || !this.isHandled(file)) return;
		if (Date.now() - file.stat.ctime > NEW_FILE_MAX_AGE_MS) return;

		const resolved = resolveTargetFolder(canvasPath, settings.targetFolder);
		if (resolved === null) return;
		const folder = resolved === '' ? '' : normalizePath(resolved);
		if (parentOf(file.path) === folder) return;

		// The image may have been removed again in the meantime.
		const canvas = this.app.vault.getFileByPath(canvasPath);
		if (!canvas || !(await this.readCanvas(canvas))?.has(path)) return;
		if (await this.isUsed(path, canvasPath)) return;

		if (folder !== '') {
			const existing = this.app.vault.getAbstractFileByPath(folder);
			if (existing && !(existing instanceof TFolder)) return;
			if (!existing) await this.app.vault.createFolder(folder);
		}
		const target = uniquePath(folder, file.name, (p) => this.app.vault.getAbstractFileByPath(p) !== null);
		await this.app.fileManager.renameFile(file, target);
	}

	private scheduleRemoval(path: string): void {
		const settings = this.getSettings();
		if (!settings.removeEnabled) return;
		if (!parseExtensions(settings.extensions).has(extensionOf(path))) return;

		const pending = this.removals.get(path);
		if (pending !== undefined) {
			window.clearTimeout(pending);
			this.timers.delete(pending);
		}
		const seconds = Math.max(MIN_REMOVE_DELAY_SECONDS, settings.removeDelaySeconds);
		const timer = this.later(seconds * 1000, async () => {
			this.removals.delete(path);
			await this.removeIfUnused(path);
		});
		this.removals.set(path, timer);
	}

	private async removeIfUnused(path: string): Promise<void> {
		const settings = this.getSettings();
		if (!settings.removeEnabled) return;

		const file = this.app.vault.getFileByPath(path);
		if (!file || !this.isHandled(file)) return;
		if (await this.isUsed(path)) return;

		await this.app.fileManager.trashFile(file);
		if (settings.showRemoveNotice) {
			new Notice(`Better Images: moved "${file.name}" to the trash because no canvas or note uses it anymore.`);
		}
	}
}
