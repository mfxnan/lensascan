import { createWorker } from 'tesseract.js';

export const OCR_LANGUAGES = [
  { code: 'ind+eng', label: 'Indonesia + Inggris' },
  { code: 'ind', label: 'Bahasa Indonesia' },
  { code: 'eng', label: 'English' },
];

const STATUS_LABELS = {
  'loading tesseract core': 'Memuat mesin OCR...',
  'initializing tesseract': 'Menyiapkan Tesseract...',
  'loading language traineddata': 'Mengunduh data bahasa...',
  'initializing api': 'Menginisialisasi API OCR...',
  'recognizing text': 'Membaca teks dari dokumen...',
};

export async function extractTextFromImage(imageDataUrl, lang = 'ind+eng', onProgress) {
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress && m) {
        const label = STATUS_LABELS[m.status] || 'Memproses dokumen...';
        const pct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0;
        onProgress({ status: label, progress: pct });
      }
    },
  });

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageDataUrl);
    return {
      text: (text || '').trim(),
      confidence: Math.round(confidence || 0),
    };
  } finally {
    await worker.terminate();
  }
}
