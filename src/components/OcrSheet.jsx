import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  ScanText,
  X,
} from 'lucide-react';
import { OCR_LANGUAGES, extractTextFromImage } from '../utils/ocr';
import { downloadTextFile } from '../utils/export';

export default function OcrSheet({
  page,
  pageNumber,
  documentTitle,
  onSaveText,
  onClose,
  onToast,
}) {
  const [lang, setLang] = useState('ind+eng');
  const [text, setText] = useState(page.ocrText || '');
  const [confidence, setConfidence] = useState(page.ocrConfidence || null);
  const [isRunning, setIsRunning] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ status: '', progress: 0 });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleRunOcr = async () => {
    setIsRunning(true);
    setError('');
    setProgressInfo({ status: 'Menyiapkan mesin OCR...', progress: 5 });

    try {
      const result = await extractTextFromImage(
        page.processedDataUrl || page.originalDataUrl,
        lang,
        (info) => setProgressInfo(info)
      );
      setText(result.text);
      setConfidence(result.confidence);
      onSaveText(result.text, result.confidence);
      onToast?.('Teks berhasil diekstrak dari dokumen');
    } catch (err) {
      setError('Gagal menjalankan OCR. Pastikan koneksi internet aktif saat pertama kali mengunduh model bahasa.');
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onToast?.('Teks disalin ke clipboard');
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveManual = () => {
    onSaveText(text, confidence);
    onToast?.('Catatan teks OCR disimpan');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Ekstrak Teks OCR"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>OCR — Halaman {pageNumber}</h3>
          <button id="ocr-close-btn" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="option-group">
            <span className="option-label">Bahasa Dokumen</span>
            <div className="segmented-control">
              {OCR_LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  id={`ocr-lang-${item.code}`}
                  className={`segment-btn ${lang === item.code ? 'active' : ''}`}
                  onClick={() => setLang(item.code)}
                  disabled={isRunning}
                >
                  {item.code === 'ind+eng' ? 'ID + EN' : item.code === 'ind' ? 'Indonesia' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <button
            id="ocr-run-btn"
            className="btn-primary"
            onClick={handleRunOcr}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 size={18} className="spin" /> : <ScanText size={18} />}
            {isRunning ? 'Sedang Membaca Teks...' : text ? 'Pindai Ulang Teks (OCR)' : 'Mulai Ekstrak Teks (OCR)'}
          </button>

          {isRunning && (
            <div className="ocr-progress-box">
              <div className="ocr-meta-row">
                <span>{progressInfo.status}</span>
                <strong>{progressInfo.progress}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressInfo.progress}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="btn-danger-soft" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
              {error}
            </div>
          )}

          {(text || !isRunning) && (
            <div className="option-group">
              <div className="ocr-meta-row">
                <span className="option-label">Hasil Teks (Dapat Diedit)</span>
                {confidence !== null && (
                  <span>Akurasi estimasi: <strong>{confidence}%</strong></span>
                )}
              </div>
              <textarea
                id="ocr-result-textarea"
                className="ocr-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Klik 'Mulai Ekstrak Teks (OCR)' untuk membaca teks secara otomatis dari halaman ini..."
              />
            </div>
          )}

          {text && (
            <div className="ocr-actions-row">
              <button id="ocr-copy-btn" className="btn-soft-accent" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Tersalin' : 'Salin Teks'}
              </button>
              <button
                id="ocr-download-txt-btn"
                className="btn-secondary"
                onClick={() => downloadTextFile(text, `${documentTitle}_hal_${pageNumber}`)}
              >
                <Download size={16} />
                Unduh .TXT
              </button>
              <button id="ocr-save-btn" className="btn-secondary" onClick={handleSaveManual}>
                <FileText size={16} />
                Simpan Perubahan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
