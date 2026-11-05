import { Plugin } from 'obsidian';
import { BetterImagesSettingTab, DEFAULT_SETTINGS } from './settings';
import type { BetterImagesSettings } from './settings';
import { CanvasWatcher } from './watcher';

export default class BetterImagesPlugin extends Plugin {
	settings: BetterImagesSettings = { ...DEFAULT_SETTINGS };
	private watcher: CanvasWatcher | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BetterImagesSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			void this.startWatching();
		});
	}

	onunload(): void {
		this.watcher?.stop();
		this.watcher = null;
	}

	private async startWatching(): Promise<void> {
		const watcher = new CanvasWatcher(this.app, () => this.settings);
		this.watcher = watcher;
		await watcher.start();

		this.registerEvent(this.app.vault.on('create', (file) => watcher.onCreate(file)));
		this.registerEvent(this.app.vault.on('modify', (file) => watcher.onModify(file)));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => watcher.onRename(file, oldPath)));
		this.registerEvent(this.app.vault.on('delete', (file) => watcher.onDelete(file)));
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<BetterImagesSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
