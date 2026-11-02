import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/hunter-icon.png');
const destination = path.join(root, 'public/icons');
await mkdir(destination, { recursive: true });
for (const [size, name, scale] of [[180, 'hunter-apple-v2.png', 0.8], [192, 'hunter-192-v2.png', 0.8], [512, 'hunter-512-v2.png', 0.8], [512, 'hunter-maskable-v2.png', 0.64]]) {
  const icon = await sharp(source).resize(Math.round(size * scale), Math.round(size * scale), { fit: 'contain' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#d9ed8f' } })
    .composite([{ input: icon, gravity: 'centre' }]).png().toFile(path.join(destination, name));
}
