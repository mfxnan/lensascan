import { useRef } from 'react';
import {
  Camera,
  FileText,
  Folder,
  HardDrive,
  ImagePlus,
  LayoutGrid,
  List,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FOLDERS, estimateStorageBytes, formatBytes } from '../utils/storage';

function formatDateId(iso) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export default function LibraryView({
  documents,
  selectedFolder,
  onSelectFolder,
  searchQuery,
  onSearchChange,
  viewMode,
  onToggleViewMode,
  onOpenCamera,
  onUploadFiles,
  onLoadSample,
  onSelectDoc,
  onDeleteDoc,
}) {
  const fileInputRef = useRef(null);

  const filteredDocs = documents.filter((doc) => {
    const matchFolder = selectedFolder === 'Semua' || doc.folder === selectedFolder;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchFolder;
    const inTitle = (doc.title || '').toLowerCase().includes(q);
    const inOcr = (doc.pages || []).some((p) => (p.ocrText || '').toLowerCase().includes(q));
    return matchFolder && (inTitle || inOcr);
  });

  const totalPages = documents.reduce((acc, d) => acc + (d.pages?.length || 0), 0);
  const storageBytes = estimateStorageBytes(documents);

  const countInFolder = (folder) =>
    folder === 'Semua'
      ? documents.length
      : documents.filter((d) => d.folder === folder).length;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onUploadFiles(files);
    }
    e.target.value = '';
  };

  return (
    <div className="app-shell">
      {/* Desktop Left Sidebar */}
      <aside className="desktop-sidebar" aria-label="Navigasi Utama">
        <div className="brand-row">
          <div className="brand-mark">
            <ScanLine size={20} />
          </div>
          <div className="brand-text">
            <h2>LensaScan</h2>
            <span>Pemindai Dokumen Web</span>
          </div>
        </div>

        <div className="sidebar-cta-stack">
          <button id="sidebar-scan-camera-btn" className="btn-primary" onClick={onOpenCamera}>
            <Camera size={18} />
            Pindai dengan Kamera
          </button>
          <button
            id="sidebar-upload-btn"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={17} />
            Impor dari Galeri
          </button>
          <button id="sidebar-sample-btn" className="btn-soft-accent" onClick={onLoadSample}>
            <Sparkles size={16} />
            Coba Dokumen Contoh
          </button>
        </div>

        <div>
          <div className="sidebar-section-label">Folder</div>
          <nav className="sidebar-nav">
            {FOLDERS.map((folder) => (
              <button
                key={folder}
                id={`sidebar-folder-${folder.toLowerCase()}`}
                className={`sidebar-nav-item ${selectedFolder === folder ? 'active' : ''}`}
                onClick={() => onSelectFolder(folder)}
              >
                <span className="sidebar-nav-left">
                  <Folder size={16} />
                  <span>{folder}</span>
                </span>
                <span className="sidebar-count">{countInFolder(folder)}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="storage-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <HardDrive size={14} />
              Penyimpanan Lokal
            </span>
            <span>{formatBytes(storageBytes)}</span>
          </div>
          <div className="storage-note">
            {documents.length} dokumen · {totalPages} halaman tersimpan aman di perangkat ini (IndexedDB).
          </div>
        </div>
      </aside>

      {/* Main Content Stage */}
      <div className="main-stage">
        <header className="top-bar">
          <div className="top-bar-inner">
            <div className="top-bar-row">
              <div className="page-title-group">
                <div className="mobile-brand-dot" aria-hidden="true">
                  <ScanLine size={17} />
                </div>
                <h1 className="page-title">
                  {selectedFolder === 'Semua' ? 'Dokumen' : selectedFolder}
                </h1>
              </div>

              <div className="top-actions">
                <button
                  id="toggle-view-grid"
                  className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => onToggleViewMode('grid')}
                  aria-label="Tampilan Grid"
                  title="Tampilan Grid"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  id="toggle-view-list"
                  className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => onToggleViewMode('list')}
                  aria-label="Tampilan Daftar"
                  title="Tampilan Daftar"
                >
                  <List size={18} />
                </button>
              </div>
            </div>

            <div className="search-row">
              <div className="search-box">
                <Search size={17} className="search-icon" />
                <input
                  id="doc-search-input"
                  type="search"
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Cari judul dokumen atau teks OCR..."
                />
                {searchQuery && (
                  <button
                    className="search-clear"
                    onClick={() => onSearchChange('')}
                    aria-label="Hapus pencarian"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="folder-strip" role="tablist" aria-label="Filter Folder">
              {FOLDERS.map((folder) => (
                <button
                  key={folder}
                  id={`mobile-folder-${folder.toLowerCase()}`}
                  className={`folder-pill ${selectedFolder === folder ? 'active' : ''}`}
                  onClick={() => onSelectFolder(folder)}
                >
                  {folder}
                  {countInFolder(folder) > 0 ? ` (${countInFolder(folder)})` : ''}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="content-container">
          {/* Mobile Quick Actions */}
          <div className="quick-action-bar">
            <button id="quick-camera-btn" className="quick-tile" onClick={onOpenCamera}>
              <div className="quick-tile-icon">
                <Camera size={19} />
              </div>
              <span>Kamera</span>
            </button>
            <button
              id="quick-gallery-btn"
              className="quick-tile"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="quick-tile-icon">
                <ImagePlus size={19} />
              </div>
              <span>Impor Foto</span>
            </button>
            <button id="quick-sample-btn" className="quick-tile" onClick={onLoadSample}>
              <div className="quick-tile-icon">
                <Sparkles size={19} />
              </div>
              <span>Coba Demo</span>
            </button>
          </div>

          {filteredDocs.length === 0 ? (
            <section className="empty-state">
              <div className="empty-icon-ring">
                <FileText size={30} />
              </div>
              <h2>
                {documents.length === 0
                  ? 'Siap Memindai Dokumen Pertama?'
                  : 'Tidak Ada Dokumen yang Cocok'}
              </h2>
              <p>
                {documents.length === 0
                  ? 'Foto dokumen langsung dari kamera atau unggah gambar. LensaScan akan meluruskan perspektif 4 titik, menjernihkan kertas, lalu siap diekspor ke PDF atau OCR.'
                  : 'Coba ubah kata kunci pencarian atau pilih folder lain.'}
              </p>
              <div className="empty-actions">
                <button id="empty-scan-btn" className="btn-primary" onClick={onOpenCamera}>
                  <Camera size={18} />
                  Buka Kamera
                </button>
                <button
                  id="empty-upload-btn"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={17} />
                  Unggah Foto
                </button>
                <button id="empty-sample-btn" className="btn-soft-accent" onClick={onLoadSample}>
                  <Sparkles size={16} />
                  Coba Invoice Contoh
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="section-header-row">
                <span className="section-meta">
                  {filteredDocs.length} dokumen · Diurutkan terbaru
                </span>
              </div>

              {viewMode === 'grid' ? (
                <div className="doc-grid">
                  {filteredDocs.map((doc) => {
                    const cover = doc.pages?.[0];
                    const hasOcr = (doc.pages || []).some((p) => Boolean(p.ocrText));
                    return (
                      <article
                        key={doc.id}
                        id={`doc-card-${doc.id}`}
                        className="doc-card"
                        onClick={() => onSelectDoc(doc.id)}
                      >
                        <div className="doc-thumb-stage">
                          {hasOcr && <span className="ocr-badge">OCR</span>}
                          <div className={`doc-paper-stack ${doc.pages.length > 1 ? 'multi' : ''}`}>
                            {cover && (
                              <img
                                src={cover.processedDataUrl || cover.originalDataUrl}
                                alt={doc.title}
                                className="doc-thumb-img"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <span className="page-count-badge">{doc.pages.length} hal</span>
                        </div>

                        <div className="doc-card-body">
                          <div className="doc-card-top">
                            <h3 className="doc-card-title">{doc.title}</h3>
                            <button
                              className="card-delete-btn"
                              aria-label={`Hapus ${doc.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteDoc(doc);
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="doc-card-meta">
                            <span>{formatDateId(doc.updatedAt)}</span>
                            <span className="doc-folder-tag">{doc.folder || 'Pribadi'}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="doc-list">
                  {filteredDocs.map((doc) => {
                    const cover = doc.pages?.[0];
                    const hasOcr = (doc.pages || []).some((p) => Boolean(p.ocrText));
                    return (
                      <article
                        key={doc.id}
                        id={`doc-row-${doc.id}`}
                        className="doc-list-row"
                        onClick={() => onSelectDoc(doc.id)}
                      >
                        <div className="doc-list-thumb">
                          {cover && (
                            <img
                              src={cover.processedDataUrl || cover.originalDataUrl}
                              alt={doc.title}
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="doc-list-info">
                          <h3>{doc.title}</h3>
                          <div className="doc-list-sub">
                            <span>{doc.pages.length} halaman</span>
                            <span>·</span>
                            <span>{formatDateId(doc.updatedAt)}</span>
                            <span className="doc-folder-tag">{doc.folder || 'Pribadi'}</span>
                            {hasOcr && <span className="doc-folder-tag" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>OCR</span>}
                          </div>
                        </div>
                        <button
                          className="card-delete-btn"
                          aria-label={`Hapus ${doc.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDoc(doc);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Tab Bar */}
      <nav className="mobile-bottom-bar" aria-label="Menu Bawah">
        <button
          id="mobile-tab-docs"
          className="tab-btn active"
          onClick={() => onSelectFolder('Semua')}
        >
          <FileText size={20} />
          <span>Dokumen</span>
        </button>

        <button id="mobile-fab-scan" className="fab-scan-btn" onClick={onOpenCamera}>
          <Camera size={20} />
          <span>Pindai</span>
        </button>

        <button
          id="mobile-tab-import"
          className="tab-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={20} />
          <span>Galeri</span>
        </button>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}
