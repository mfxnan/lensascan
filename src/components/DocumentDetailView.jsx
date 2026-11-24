import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronLeft,
  Crop,
  FileDown,
  ImagePlus,
  Plus,
  RotateCw,
  ScanText,
  Trash2,
} from 'lucide-react';
import { FOLDERS } from '../utils/storage';
import OcrSheet from './OcrSheet';
import ExportSheet from './ExportSheet';
import { rotateImageDataUrl } from '../utils/imageProcessing';

export default function DocumentDetailView({
  doc,
  onBack,
  onUpdateDoc,
  onDeleteDoc,
  onAddPagesFromCamera,
  onAddPagesFromFiles,
  onReEditPage,
  onToast,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showOcr, setShowOcr] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const fileInputRef = useRef(null);

  const safeIndex = Math.min(activeIndex, Math.max(0, doc.pages.length - 1));
  const activePage = doc.pages[safeIndex];

  const handleTitleChange = (newTitle) => {
    onUpdateDoc({ ...doc, title: newTitle, updatedAt: new Date().toISOString() });
  };

  const handleFolderChange = (newFolder) => {
    onUpdateDoc({ ...doc, folder: newFolder, updatedAt: new Date().toISOString() });
  };

  const handleMovePage = (direction) => {
    const target = safeIndex + direction;
    if (target < 0 || target >= doc.pages.length) return;
    const nextPages = [...doc.pages];
    const [moved] = nextPages.splice(safeIndex, 1);
    nextPages.splice(target, 0, moved);
    onUpdateDoc({ ...doc, pages: nextPages, updatedAt: new Date().toISOString() });
    setActiveIndex(target);
  };

  const handleDeletePage = () => {
    if (doc.pages.length <= 1) {
      if (window.confirm('Ini adalah halaman terakhir. Hapus seluruh dokumen ini?')) {
        onDeleteDoc(doc);
      }
      return;
    }
    if (!window.confirm(`Hapus halaman ${safeIndex + 1}?`)) return;
    const nextPages = doc.pages.filter((_, i) => i !== safeIndex);
    onUpdateDoc({ ...doc, pages: nextPages, updatedAt: new Date().toISOString() });
    setActiveIndex(Math.max(0, safeIndex - 1));
    onToast?.('Halaman dihapus');
  };

  const handleQuickRotate = async () => {
    if (!activePage || isRotating) return;
    setIsRotating(true);
    try {
      const nextProcessed = await rotateImageDataUrl(
        activePage.processedDataUrl || activePage.originalDataUrl,
        90
      );
      const nextPages = doc.pages.map((p, idx) =>
        idx === safeIndex ? { ...p, processedDataUrl: nextProcessed } : p
      );
      onUpdateDoc({ ...doc, pages: nextPages, updatedAt: new Date().toISOString() });
    } finally {
      setIsRotating(false);
    }
  };

  const handleSaveOcrText = (text, confidence) => {
    const nextPages = doc.pages.map((p, idx) =>
      idx === safeIndex ? { ...p, ocrText: text, ocrConfidence: confidence } : p
    );
    onUpdateDoc({ ...doc, pages: nextPages, updatedAt: new Date().toISOString() });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onAddPagesFromFiles(files);
    }
    e.target.value = '';
  };

  return (
    <div className="detail-shell">
      <header className="detail-header">
        <div className="detail-header-inner">
          <button id="detail-back-btn" className="back-btn" onClick={onBack}>
            <ChevronLeft size={21} />
            <span>Dokumen</span>
          </button>

          <div className="detail-title-wrap">
            <input
              id="detail-title-input"
              type="text"
              className="detail-title-input"
              value={doc.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              aria-label="Judul Dokumen"
            />
          </div>

          <button
            id="detail-export-top-btn"
            className="btn-primary"
            style={{ padding: '9px 14px', fontSize: '0.84rem' }}
            onClick={() => setShowExport(true)}
          >
            <FileDown size={16} />
            <span>Ekspor PDF</span>
          </button>
        </div>
      </header>

      <main className="detail-body">
        {/* Main Preview Stage */}
        <section className="preview-column">
          {activePage && (
            <div className="page-stage-card">
              <div className="page-stage-img-wrap">
                <img
                  src={activePage.processedDataUrl || activePage.originalDataUrl}
                  alt={`${doc.title} - Halaman ${safeIndex + 1}`}
                  className="page-stage-img"
                />
              </div>

              <div className="page-controls-bar">
                <span className="page-indicator">
                  Halaman {safeIndex + 1} dari {doc.pages.length}
                </span>

                <div className="page-inline-actions">
                  <button
                    id="detail-reedit-btn"
                    className="chip-btn accent"
                    onClick={() => onReEditPage(safeIndex)}
                  >
                    <Crop size={15} />
                    <span>Potong & Filter</span>
                  </button>

                  <button
                    id="detail-ocr-btn"
                    className="chip-btn accent"
                    onClick={() => setShowOcr(true)}
                  >
                    <ScanText size={15} />
                    <span>OCR Teks</span>
                  </button>

                  <button
                    id="detail-rotate-btn"
                    className="chip-btn"
                    onClick={handleQuickRotate}
                    disabled={isRotating}
                    title="Putar 90°"
                  >
                    <RotateCw size={15} />
                    <span>Putar</span>
                  </button>

                  {doc.pages.length > 1 && (
                    <>
                      <button
                        id="detail-move-left"
                        className="chip-btn"
                        disabled={safeIndex === 0}
                        onClick={() => handleMovePage(-1)}
                        title="Geser ke kiri"
                        aria-label="Geser halaman ke kiri"
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <button
                        id="detail-move-right"
                        className="chip-btn"
                        disabled={safeIndex === doc.pages.length - 1}
                        onClick={() => handleMovePage(1)}
                        title="Geser ke kanan"
                        aria-label="Geser halaman ke kanan"
                      >
                        <ArrowRight size={15} />
                      </button>
                    </>
                  )}

                  <button
                    id="detail-delete-page"
                    className="chip-btn danger"
                    onClick={handleDeletePage}
                    title="Hapus Halaman"
                    aria-label="Hapus Halaman"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right / Bottom Pages & Metadata Panel */}
        <aside className="pages-sidebar">
          <div className="panel-card">
            <div className="panel-header">
              <h3>Halaman ({doc.pages.length})</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  id="detail-add-camera-btn"
                  className="chip-btn accent"
                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  onClick={onAddPagesFromCamera}
                >
                  <Camera size={14} />
                  Kamera
                </button>
                <button
                  id="detail-add-gallery-btn"
                  className="chip-btn"
                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={14} />
                  Foto
                </button>
              </div>
            </div>

            <div className="filmstrip-grid">
              {doc.pages.map((page, idx) => (
                <button
                  key={page.id}
                  id={`page-thumb-${idx}`}
                  className={`thumb-tile ${idx === safeIndex ? 'active' : ''}`}
                  onClick={() => setActiveIndex(idx)}
                >
                  <img
                    src={page.processedDataUrl || page.originalDataUrl}
                    alt={`Halaman ${idx + 1}`}
                  />
                  <span className="thumb-num">{idx + 1}</span>
                </button>
              ))}

              <button
                id="filmstrip-add-page"
                className="thumb-add-tile"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={20} />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Teks OCR Halaman {safeIndex + 1}</h3>
              <button
                className="chip-btn accent"
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setShowOcr(true)}
              >
                {activePage?.ocrText ? 'Buka' : 'Ekstrak'}
              </button>
            </div>
            {activePage?.ocrText ? (
              <div className="ocr-preview-snippet">{activePage.ocrText}</div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                Belum ada teks diekstrak pada halaman ini. Klik <strong>OCR Teks</strong> untuk menyalin isi dokumen secara otomatis.
              </p>
            )}
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Folder & Pengaturan</h3>
            </div>
            <select
              id="detail-folder-select"
              className="folder-select"
              value={doc.folder || 'Pribadi'}
              onChange={(e) => handleFolderChange(e.target.value)}
            >
              {FOLDERS.filter((f) => f !== 'Semua').map((f) => (
                <option key={f} value={f}>
                  Folder: {f}
                </option>
              ))}
            </select>
            <button
              id="detail-delete-doc-btn"
              className="btn-danger-soft"
              onClick={() => onDeleteDoc(doc)}
            >
              <Trash2 size={16} />
              Hapus Seluruh Dokumen
            </button>
          </div>
        </aside>
      </main>

      {/* Mobile Sticky Detail Action Bar */}
      <div className="detail-bottom-bar">
        <button className="detail-bar-btn" onClick={onAddPagesFromCamera}>
          <Camera size={20} />
          <span>Tambah</span>
        </button>
        <button className="detail-bar-btn" onClick={() => onReEditPage(safeIndex)}>
          <Crop size={20} />
          <span>Edit</span>
        </button>
        <button className="detail-bar-btn" onClick={() => setShowOcr(true)}>
          <ScanText size={20} />
          <span>OCR</span>
        </button>
        <button className="detail-bar-btn accent" onClick={() => setShowExport(true)}>
          <FileDown size={20} />
          <span>Ekspor</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileUpload}
      />

      {showOcr && activePage && (
        <OcrSheet
          page={activePage}
          pageNumber={safeIndex + 1}
          documentTitle={doc.title}
          onSaveText={handleSaveOcrText}
          onClose={() => setShowOcr(false)}
          onToast={onToast}
        />
      )}

      {showExport && (
        <ExportSheet
          doc={doc}
          activePageIndex={safeIndex}
          onClose={() => setShowExport(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
