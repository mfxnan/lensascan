import { jsPDF } from 'jspdf';
import { loadImage } from './imageProcessing';

function sanitizeFilename(name) {
  return (name || 'dokumen-lensascan')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'dokumen-lensascan';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Export multi-page document to PDF using jsPDF
 * pageFormat: 'a4' | 'letter' | 'auto'
 */
export async function exportDocumentToPdf(doc, pageFormat = 'a4') {
  if (!doc.pages || doc.pages.length === 0) {
    throw new Error('Dokumen tidak memiliki halaman.');
  }

  let pdf = null;

  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    const dataUrl = page.processedDataUrl || page.originalDataUrl;
    const img = await loadImage(dataUrl);
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const orientation = imgW > imgH ? 'landscape' : 'portrait';

    if (pageFormat === 'auto') {
      // Convert pixels to mm at 150 DPI
      const mmW = Math.max(50, (imgW / 150) * 25.4);
      const mmH = Math.max(50, (imgH / 150) * 25.4);
      if (i === 0) {
        pdf = new jsPDF({ orientation, unit: 'mm', format: [mmW, mmH] });
      } else {
        pdf.addPage([mmW, mmH], orientation);
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
    } else {
      if (i === 0) {
        pdf = new jsPDF({ orientation, unit: 'mm', format: pageFormat });
      } else {
        pdf.addPage(pageFormat, orientation);
      }
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const ratio = Math.min(availW / imgW, availH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
    }
  }

  const filename = `${sanitizeFilename(doc.title)}.pdf`;
  const blob = pdf.output('blob');
  triggerDownload(blob, filename);
  return { blob, filename };
}

/**
 * Export single page or all pages as JPG / PNG
 */
export async function exportPageAsImage(page, title, format = 'jpeg', pageIndex = 0) {
  const dataUrl = page.processedDataUrl || page.originalDataUrl;
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.94));
  const suffix = pageIndex > 0 ? `_hal_${pageIndex + 1}` : '';
  const filename = `${sanitizeFilename(title)}${suffix}.${ext}`;
  triggerDownload(blob, filename);
  return { blob, filename };
}

export async function exportAllPagesAsImages(doc, format = 'jpeg') {
  for (let i = 0; i < doc.pages.length; i++) {
    await exportPageAsImage(doc.pages[i], doc.title, format, i);
    // Small stagger so browsers don't block multiple downloads
    await new Promise((r) => setTimeout(r, 180));
  }
}

export async function shareDocumentPdf(doc, pageFormat = 'a4') {
  if (!navigator.share) {
    return exportDocumentToPdf(doc, pageFormat);
  }
  const { blob, filename } = await generatePdfBlob(doc, pageFormat);
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: doc.title,
      text: `Dokumen ${doc.title} (${doc.pages.length} halaman) dipindai dengan LensaScan`,
      files: [file],
    });
    return { shared: true, filename };
  }
  triggerDownload(blob, filename);
  return { shared: false, filename };
}

async function generatePdfBlob(doc, pageFormat = 'a4') {
  let pdf = null;
  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    const dataUrl = page.processedDataUrl || page.originalDataUrl;
    const img = await loadImage(dataUrl);
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const orientation = imgW > imgH ? 'landscape' : 'portrait';

    if (pageFormat === 'auto') {
      const mmW = Math.max(50, (imgW / 150) * 25.4);
      const mmH = Math.max(50, (imgH / 150) * 25.4);
      if (i === 0) pdf = new jsPDF({ orientation, unit: 'mm', format: [mmW, mmH] });
      else pdf.addPage([mmW, mmH], orientation);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
    } else {
      if (i === 0) pdf = new jsPDF({ orientation, unit: 'mm', format: pageFormat });
      else pdf.addPage(pageFormat, orientation);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const ratio = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      pdf.addImage(dataUrl, 'JPEG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH, undefined, 'FAST');
    }
  }
  const filename = `${sanitizeFilename(doc.title)}.pdf`;
  return { blob: pdf.output('blob'), filename };
}

export function downloadTextFile(text, title) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(title)}_OCR.txt`);
}
