import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'public', 'pwa-icon-source.png');
const iconsDir = path.join(root, 'public', 'icons');
const BG = '#0f172a';

const buf = await sharp(sourcePath).toBuffer();

const { width: w, height: h } = await sharp(buf).metadata();
const side = Math.max(w, h);
const padTop = Math.floor((side - h) / 2);
const padBottom = side - h - padTop;
const padLeft = Math.floor((side - w) / 2);
const padRight = side - w - padLeft;

const square = await sharp(buf)
  .extend({
    top: padTop,
    bottom: padBottom,
    left: padLeft,
    right: padRight,
    background: BG,
  })
  .toBuffer();

fs.mkdirSync(iconsDir, { recursive: true });

await Promise.all([
  sharp(square).resize(180).toFile(path.join(iconsDir, 'apple-icon-180.png')),
  sharp(square).resize(192).toFile(path.join(iconsDir, 'icon-192.png')),
  sharp(square).resize(512).toFile(path.join(iconsDir, 'icon-512.png')),
]);

console.log('Icons written: apple-icon-180.png, icon-192.png, icon-512.png');
