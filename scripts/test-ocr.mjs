import { createWorker } from 'tesseract.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagePath = process.argv[2] || join(process.env.HOME || '', 'Downloads', '1.png');

if (!existsSync(imagePath)) {
  console.error('File not found:', imagePath);
  process.exit(1);
}

console.log('Image:', imagePath);
console.log('Creating worker (rus)...');
const worker = await createWorker('rus', 1, { logger: (m) => console.log('[tesseract]', m.status || m) });
try {
  console.log('Recognizing...');
  const { data: { text } } = await worker.recognize(imagePath);
  console.log('--- Raw OCR text ---');
  console.log(text || '(empty)');
  console.log('--- End ---');
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
} finally {
  await worker.terminate();
}
