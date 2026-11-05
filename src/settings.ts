import { App, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type BetterImagesPlugin from './main';
import { DEFAULT_EXTENSIONS, parseFolderList } from './core';

export interface BetterImagesSettings {
	extensions: string;
	sortEnabled: boolean;
	targetFolder: string;
	canvasFolders: string[];
	removeEnabled: boolean;
	removeDelaySeconds: number;
	showRemoveNotice: boolean;
}

type SettingKey = keyof BetterImagesSettings;

export const DEFAULT_SETTINGS: BetterImagesSettings = {
	extensions: DEFAULT_EXTENSIONS,
	sortEnabled: true,
	targetFolder: './attachments',
	canvasFolders: [],
	removeEnabled: false,
	removeDelaySeconds: 30,
	showRemoveNotice: true,
};

export const MIN_REMOVE_DELAY_SECONDS = 5;

function isSettingKey(key: string): key is SettingKey {
	return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
}

export class BetterImagesSettingTab extends PluginSettingTab {
	private readonly plugin: BetterImagesPlugin;

	constructor(app: App, plugin: BetterImagesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		const sortDisabled = (): boolean => !this.plugin.settings.sortEnabled;
		const removeDisabled = (): boolean => !this.plugin.settings.removeEnabled;

		return [
			{
				name: 'File types',
				desc: 'File extensions this plugin handles, separated by commas. Notes and other files are never touched.',
				aliases: ['extensions', 'images', 'videos'],
				control: { type: 'textarea', key: 'extensions', placeholder: DEFAULT_EXTENSIONS, rows: 2 },
			},
			{
				type: 'group',
				heading: 'Sorting new images',
				items: [
					{
						name: 'Sort new images',
						desc: 'When you paste or drop a new image onto a canvas, move it into the target folder. Images that are already in your vault, or used elsewhere, stay where they are.',
						control: { type: 'toggle', key: 'sortEnabled' },
					},
					{
						name: 'Target folder',
						desc: 'Start with ./ for a folder next to the canvas. {canvas} is replaced with the name of the canvas, for example ./{canvas} assets.',
						aliases: ['attachments', 'assets'],
						control: {
							type: 'text',
							key: 'targetFolder',
							placeholder: DEFAULT_SETTINGS.targetFolder,
							disabled: sortDisabled,
							validate: (value) =>
								value.split(/[\\/]/).includes('..') ? 'The folder must be inside your vault.' : undefined,
						},
					},
					{
						name: 'Canvas folders',
						desc: 'Only sort images for canvases inside these folders, one folder per line. Leave empty to sort for every canvas.',
						control: { type: 'textarea', key: 'canvasFolders', placeholder: 'Projects', rows: 3, disabled: sortDisabled },
					},
				],
			},
			{
				type: 'group',
				heading: 'Removing unused images',
				items: [
					{
						name: 'Remove unused images',
						desc: 'When you remove an image from a canvas and no other canvas or note uses it, move the file to the trash. The trash location follows your choice for deleted files in the files and links settings.',
						aliases: ['delete', 'trash', 'orphaned', 'cleanup'],
						control: { type: 'toggle', key: 'removeEnabled' },
					},
					{
						name: 'Delay in seconds',
						desc: 'How long to wait before an image is removed. Gives you time to undo, or to paste a cut image into another canvas.',
						control: {
							type: 'number',
							key: 'removeDelaySeconds',
							min: MIN_REMOVE_DELAY_SECONDS,
							step: 1,
							disabled: removeDisabled,
							validate: (value) =>
								Number.isFinite(value) && value >= MIN_REMOVE_DELAY_SECONDS
									? undefined
									: `Enter at least ${MIN_REMOVE_DELAY_SECONDS} seconds.`,
						},
					},
					{
						name: 'Show a notice',
						desc: 'Show a short message whenever an image is moved to the trash.',
						control: { type: 'toggle', key: 'showRemoveNotice', disabled: removeDisabled },
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (!isSettingKey(key)) return undefined;
		const settings = this.plugin.settings;
		if (key === 'canvasFolders') return settings.canvasFolders.join('\n');
		return settings[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!isSettingKey(key)) return;
		const settings = this.plugin.settings;

		switch (key) {
			case 'extensions':
				settings.extensions = typeof value === 'string' && value.trim() !== '' ? value : DEFAULT_EXTENSIONS;
				break;
			case 'targetFolder':
				settings.targetFolder =
					typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_SETTINGS.targetFolder;
				break;
			case 'canvasFolders':
				settings.canvasFolders = typeof value === 'string' ? parseFolderList(value) : [];
				break;
			case 'removeDelaySeconds': {
				const seconds = Number(value);
				settings.removeDelaySeconds = Number.isFinite(seconds)
					? Math.max(MIN_REMOVE_DELAY_SECONDS, Math.round(seconds))
					: DEFAULT_SETTINGS.removeDelaySeconds;
				break;
			}
			case 'sortEnabled':
			case 'removeEnabled':
			case 'showRemoveNotice':
				settings[key] = value === true;
				// Other rows are disabled depending on these toggles.
				this.refreshDomState();
				break;
		}
		await this.plugin.saveSettings();
	}
}
