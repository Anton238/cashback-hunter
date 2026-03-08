import { CATEGORY_KEYWORD_MAP } from './constants';

export interface OcrResult {
  category: string;
  percentage: number;
}

function preprocessCanvas(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Повышаем контраст для лучшего OCR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const factor = 1.5;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.max(0, factor * (data[i]     - 128) + 128));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
      }
      ctx.putImageData(imageData, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function parseOcrText(text: string): OcrResult[] {
  const results: OcrResult[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Ищем строки вида: "5% Продукты" или "Кэшбэк 5% на продукты"
  const percentPattern = /(\d+(?:[.,]\d+)?)\s*%/g;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    let match: RegExpExecArray | null;

    while ((match = percentPattern.exec(line)) !== null) {
      const percentage = parseFloat(match[1].replace(',', '.'));
      if (percentage <= 0 || percentage > 100) continue;

      // Определяем категорию по ключевым словам в строке
      let matchedCategory: string | null = null;
      for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
        if (keywords.some(kw => lineLower.includes(kw))) {
          matchedCategory = category;
          break;
        }
      }

      if (matchedCategory) {
        const existing = results.find(r => r.category === matchedCategory);
        if (!existing) {
          results.push({ category: matchedCategory, percentage });
        } else if (percentage > existing.percentage) {
          existing.percentage = percentage;
        }
      }
    }
    percentPattern.lastIndex = 0;
  }

  return results;
}

export async function runOcr(file: File): Promise<OcrResult[]> {
  const Tesseract = await import('tesseract.js');
  const processedImage = await preprocessCanvas(file);
  const { data: { text } } = await Tesseract.recognize(processedImage, 'rus', {
    logger: () => {},
  });
  return parseOcrText(text);
}
