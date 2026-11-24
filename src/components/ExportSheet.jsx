import { useState } from 'react';
import {
  FileDown,
  Image as ImageIcon,
  Images,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import {
  exportAllPagesAsImages,
  exportDocumentToPdf,
  exportPageAsImage,
  shareDocumentPdf,
} from '../utils/export';

export default function ExportSheet({ doc, activePageIndex, onClose, onToast }) {
  const [pdfFormat, setPdfFormat] = useState('a4');
  const [busyAction, setBusyAction] = useState('');

  const pageCount = doc.pages.length;
  const activePage = doc.pages[activePageIndex] || doc.pages[0];
  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const runAction = async (key, fn, successMsg) => {
    setBusyAction(key);
    try {
      await fn();
      onToast?.(successMsg);
      onClose();
    } catch (err) {
      if (err?.name !== 'AbortError') {
        onToast?.('Gagal mengekspor dokumen');
        console.error(err);
      }
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Ekspor & Bagikan Dokumen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>Ekspor & Bagikan</h3>
          <button id="export-close-btn" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="option-group">
            <span className="option-label">Ukuran Halaman PDF</span>
            <div className="segmented-control">
              {[
                { id: 'a4', label: 'A4 Standar' },
                { id: 'auto', label: 'Auto (Pas)' },
                { id: 'letter', label: 'Letter' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  id={`pdf-format-${opt.id}`}
                  className={`segment-btn ${pdfFormat === opt.id ? 'active' : ''}`}
                  onClick={() => setPdfFormat(opt.id)}
                  disabled={Boolean(busyAction)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="action-list">
            <button
              id="export-pdf-btn"
              className="export-action-row featured"
              disabled={Boolean(busyAction)}
              onClick={() =>
                runAction(
                  'pdf',
                  () => exportDocumentToPdf(doc, pdfFormat),
                  `PDF (${pageCount} halaman) berhasil diunduh`
                )
              }
            >
              <div className="export-row-left">
                <div className="export-icon-box">
                  {busyAction === 'pdf' ? <Loader2 size={20} className="spin" /> : <FileDown size={20} />}
                </div>
                <div>
                  <div className="export-row-title">Simpan sebagai PDF ({pageCount} Halaman)</div>
                  <div className="export-row-desc">Gabungkan seluruh halaman menjadi satu berkas PDF rapi</div>
                </div>
              </div>
            </button>

            {canShare && (
              <button
                id="export-share-btn"
                className="export-action-row"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  runAction(
                    'share',
                    () => shareDocumentPdf(doc, pdfFormat),
                    'Dokumen PDF siap dibagikan'
                  )
                }
              >
                <div className="export-row-left">
                  <div className="export-icon-box">
                    {busyAction === 'share' ? <Loader2 size={20} className="spin" /> : <Share2 size={20} />}
                  </div>
                  <div>
                    <div className="export-row-title">Bagikan PDF (AirDrop / WhatsApp / Email)</div>
                    <div className="export-row-desc">Kirim langsung lewat menu berbagi bawaan perangkat</div>
                  </div>
                </div>
              </button>
            )}

            <button
              id="export-jpg-single-btn"
              className="export-action-row"
              disabled={Boolean(busyAction) || !activePage}
              onClick={() =>
                runAction(
                  'jpg',
                  () => exportPageAsImage(activePage, doc.title, 'jpeg', activePageIndex),
                  `Halaman ${activePageIndex + 1} diunduh sebagai JPG`
                )
              }
            >
              <div className="export-row-left">
                <div className="export-icon-box">
                  {busyAction === 'jpg' ? <Loader2 size={20} className="spin" /> : <ImageIcon size={20} />}
                </div>
                <div>
                  <div className="export-row-title">Unduh Halaman {activePageIndex + 1} (JPG)</div>
                  <div className="export-row-desc">Ukuran ringan, cocok untuk unggah formulir & chat</div>
                </div>
              </div>
            </button>

            <button
              id="export-png-single-btn"
              className="export-action-row"
              disabled={Boolean(busyAction) || !activePage}
              onClick={() =>
                runAction(
                  'png',
                  () => exportPageAsImage(activePage, doc.title, 'png', activePageIndex),
                  `Halaman ${activePageIndex + 1} diunduh sebagai PNG`
                )
              }
            >
              <div className="export-row-left">
                <div className="export-icon-box">
                  {busyAction === 'png' ? <Loader2 size={20} className="spin" /> : <ImageIcon size={20} />}
                </div>
                <div>
                  <div className="export-row-title">Unduh Halaman {activePageIndex + 1} (PNG Lossless)</div>
                  <div className="export-row-desc">Kualitas maksimal tanpa kompresi</div>
                </div>
              </div>
            </button>

            {pageCount > 1 && (
              <button
                id="export-jpg-all-btn"
                className="export-action-row"
                disabled={Boolean(busyAction)}
                onClick={() =>
                  runAction(
                    'all-jpg',
                    () => exportAllPagesAsImages(doc, 'jpeg'),
                    `${pageCount} gambar JPG berhasil diunduh`
                  )
                }
              >
                <div className="export-row-left">
                  <div className="export-icon-box">
                    {busyAction === 'all-jpg' ? <Loader2 size={20} className="spin" /> : <Images size={20} />}
                  </div>
                  <div>
                    <div className="export-row-title">Unduh Semua {pageCount} Halaman sebagai JPG</div>
                    <div className="export-row-desc">Simpan setiap halaman secara terpisah</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
