# Better Images

Keep the images on your canvases tidy.

- **Sort new images.** When you paste or drop a new image onto a canvas, Better Images moves it into a folder next to that canvas, for example `Projects/Moodboard/attachments/`. Links in the canvas are updated automatically.
- **Remove unused images** (off by default). When you remove an image from a canvas and no other canvas or note uses it anymore, Better Images moves the file to the trash after a short delay.

Better Images works offline, makes no network requests and only touches files inside your vault.

## How it works

### Sorting new images

Obsidian saves pasted and dropped images in the attachment folder you chose under **Settings → Files and links**. A few seconds after the canvas is saved, Better Images moves the new image into the target folder.

An image is only moved if all of the following are true:

- Its file extension is in the **File types** list.
- It was created in the last two minutes. Images that were already in your vault and that you drag onto a canvas stay where they are.
- No other canvas or note uses it.
- The canvas is inside one of the **Canvas folders**, or that list is empty.

If a file with the same name already exists in the target folder, the image gets a number, for example `photo 2.png`.

### Removing unused images

This feature is **off by default**. Turn it on under **Settings → Better Images → Remove unused images**.

When you remove an image node from a canvas, Better Images waits (30 seconds by default). Then it reads every canvas in your vault again and checks the links of all notes. If nothing uses the image anymore, it moves the file to the trash. Your choice under **Settings → Files and links → Deleted files** decides whether that is the system trash or the `.trash` folder in your vault, so you can always restore a file.

The delay gives you time to undo, or to cut an image from one canvas and paste it into another.

Images are only removed when their node is removed from a canvas. Deleting a whole canvas file leaves its images alone, and Better Images never scans your vault for old unused files.

> [!warning]
> Better Images only recognizes images used as canvas nodes, and links or embeds that Obsidian resolves, such as `![[photo.png]]` or `![](photo.png)` in a note or in a canvas text card. An image that is only referenced from HTML (`<img src="…">`), from a plugin's own data, or from outside Obsidian counts as unused.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| File types | png, jpg, jpeg, gif, webp, svg, avif, heic, heif, bmp, tif, tiff, mp4, mov, webm, m4v | Extensions Better Images handles. Notes, PDFs and all other files are never touched. |
| Sort new images | On | Move new canvas images into the target folder. |
| Target folder | `./attachments` | Start with `./` for a folder next to the canvas. `{canvas}` is replaced with the canvas name, for example `./{canvas} assets` or `Attachments/{canvas}`. |
| Canvas folders | empty | Only sort images for canvases inside these folders, one per line. Empty means every canvas. |
| Remove unused images | Off | Move images to the trash once no canvas or note uses them. |
| Delay in seconds | 30 | Time to wait before an image is removed. Minimum 5. |
| Show a notice | On | Show a message whenever an image is moved to the trash. |

## Sync and multiple devices

If you sync your vault and run Better Images on several devices, each device reacts to the canvas changes it receives. This is safe: an image that is already moved or removed is skipped.

## Installation

Install Better Images from **Settings → Community plugins → Browse**, or copy `main.js` and `manifest.json` from the latest [release](https://github.com/krullmensch/better-images/releases) to `<vault>/.obsidian/plugins/better-images/`.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type check and production build
npm run lint
npm test        # unit tests, needs Node.js 22.18 or later
```

## License

[MIT](LICENSE)
