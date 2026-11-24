import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import LibraryView from './components/LibraryView';
import DocumentDetailView from './components/DocumentDetailView';
import CameraModal from './components/CameraModal';
import CropFilterStudio from './components/CropFilterStudio';
import {
  createId,
  deleteDocument,
  getAllDocuments,
  saveDocument,
} from './utils/storage';
import { fileToDataUrl, urlToDataUrl } from './utils/imageProcessing';

function defaultDocTitle() {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const timePart = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
  return `Scan ${datePart} ${timePart}`;
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  // Camera modal state: { targetDocId: string | null }
  const [cameraSession, setCameraSession] = useState(null);

  // Batch crop/filter editor state:
  // { mode: 'new' | 'append' | 'reedit', targetDocId, pageIndex?, queue: string[], processedPages: [], reeditMeta?, customTitle? }
  const [editorSession, setEditorSession] = useState(null);

  const [toast, setToast] = useState('');

  useEffect(() => {
    getAllDocuments()
      .then((docs) => setDocuments(docs))
      .catch((err) => console.error('Gagal memuat IndexedDB:', err));
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast((current) => (current === msg ? '' : current));
    }, 2800);
  };

  const activeDoc = documents.find((d) => d.id === selectedDocId) || null;

  const persistDoc = async (doc) => {
    await saveDocument(doc);
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === doc.id);
      const next = exists ? prev.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...prev];
      return next.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  };

  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Hapus dokumen "${doc.title}" beserta semua halamannya?`)) return;
    await deleteDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedDocId === doc.id) {
      setSelectedDocId(null);
    }
    showToast('Dokumen dihapus');
  };

  // Start crop/filter pipeline for a list of raw image Data URLs
  const startBatchEditor = (dataUrls, targetDocId = null, customTitle = '') => {
    if (!dataUrls.length) return;
    setEditorSession({
      mode: targetDocId ? 'append' : 'new',
      targetDocId,
      queue: dataUrls,
      currentIndex: 0,
      processedPages: [],
      customTitle,
    });
  };

  const handleUploadFiles = async (files, targetDocId = null) => {
    const urls = [];
    for (const file of files) {
      try {
        const dataUrl = await fileToDataUrl(file);
        urls.push(dataUrl);
      } catch {
        // skip unsupported file
      }
    }
    if (urls.length > 0) {
      const firstBase = files[0]?.name?.replace(/\.[^.]+$/, '') || '';
      startBatchEditor(urls, targetDocId, targetDocId ? '' : firstBase);
    }
  };

  const handleLoadSample = async () => {
    try {
      const sampleUrl = await urlToDataUrl('/sample-invoice.jpg');
      startBatchEditor([sampleUrl], null, 'Invoice PT Nusantara Digital');
    } catch {
      showToast('Gagal memuat gambar contoh');
    }
  };

  const handleCameraComplete = (capturedUrls) => {
    const targetDocId = cameraSession?.targetDocId || null;
    setCameraSession(null);
    startBatchEditor(capturedUrls, targetDocId);
  };

  const handleReEditPage = (pageIndex) => {
    if (!activeDoc) return;
    const page = activeDoc.pages[pageIndex];
    if (!page) return;
    setEditorSession({
      mode: 'reedit',
      targetDocId: activeDoc.id,
      pageIndex,
      queue: [page.originalDataUrl || page.processedDataUrl],
      currentIndex: 0,
      processedPages: [],
      reeditMeta: {
        corners: page.corners || null,
        filter: page.filter || 'magic',
        brightness: page.brightness || 0,
        contrast: page.contrast || 0,
        ocrText: page.ocrText || '',
        ocrConfidence: page.ocrConfidence ?? null,
        id: page.id,
      },
    });
  };

  const handleSaveEditedPage = async (result) => {
    if (!editorSession) return;

    if (editorSession.mode === 'reedit') {
      const target = documents.find((d) => d.id === editorSession.targetDocId);
      if (target) {
        const updatedPages = target.pages.map((p, idx) =>
          idx === editorSession.pageIndex
            ? {
                ...p,
                ...result,
                id: p.id,
                ocrText: editorSession.reeditMeta?.ocrText || '',
                ocrConfidence: editorSession.reeditMeta?.ocrConfidence ?? null,
              }
            : p
        );
        await persistDoc({
          ...target,
          pages: updatedPages,
          updatedAt: new Date().toISOString(),
        });
        showToast('Halaman diperbarui');
      }
      setEditorSession(null);
      return;
    }

    const newPage = {
      id: createId('page'),
      ...result,
      ocrText: '',
      ocrConfidence: null,
    };

    const collected = [...editorSession.processedPages, newPage];
    const nextIdx = editorSession.currentIndex + 1;

    if (nextIdx < editorSession.queue.length) {
      setEditorSession({
        ...editorSession,
        currentIndex: nextIdx,
        processedPages: collected,
      });
      return;
    }

    // All pages in batch are finished -> save to IndexedDB
    const now = new Date().toISOString();
    if (editorSession.mode === 'append' && editorSession.targetDocId) {
      const target = documents.find((d) => d.id === editorSession.targetDocId);
      if (target) {
        const updated = {
          ...target,
          pages: [...target.pages, ...collected],
          updatedAt: now,
        };
        await persistDoc(updated);
        showToast(`${collected.length} halaman ditambahkan`);
      }
    } else {
      const folder = selectedFolder === 'Semua' ? 'Pribadi' : selectedFolder;
      const newDoc = {
        id: createId('doc'),
        title: editorSession.customTitle || defaultDocTitle(),
        folder,
        createdAt: now,
        updatedAt: now,
        pages: collected,
      };
      await persistDoc(newDoc);
      setSelectedDocId(newDoc.id);
      showToast(`Dokumen disimpan (${collected.length} halaman)`);
    }

    setEditorSession(null);
  };

  return (
    <>
      {activeDoc ? (
        <DocumentDetailView
          doc={activeDoc}
          onBack={() => setSelectedDocId(null)}
          onUpdateDoc={persistDoc}
          onDeleteDoc={handleDeleteDoc}
          onAddPagesFromCamera={() => setCameraSession({ targetDocId: activeDoc.id })}
          onAddPagesFromFiles={(files) => handleUploadFiles(files, activeDoc.id)}
          onReEditPage={handleReEditPage}
          onToast={showToast}
        />
      ) : (
        <LibraryView
          documents={documents}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          onOpenCamera={() => setCameraSession({ targetDocId: null })}
          onUploadFiles={(files) => handleUploadFiles(files, null)}
          onLoadSample={handleLoadSample}
          onSelectDoc={(id) => setSelectedDocId(id)}
          onDeleteDoc={handleDeleteDoc}
        />
      )}

      {cameraSession && (
        <CameraModal
          onComplete={handleCameraComplete}
          onCancel={() => setCameraSession(null)}
        />
      )}

      {editorSession && (
        <CropFilterStudio
          key={`${editorSession.mode}_${editorSession.currentIndex}`}
          initialDataUrl={editorSession.queue[editorSession.currentIndex]}
          initialCorners={editorSession.reeditMeta?.corners || null}
          initialFilter={editorSession.reeditMeta?.filter || 'magic'}
          initialBrightness={editorSession.reeditMeta?.brightness || 0}
          initialContrast={editorSession.reeditMeta?.contrast || 0}
          batchProgress={
            editorSession.queue.length > 1
              ? {
                  current: editorSession.currentIndex + 1,
                  total: editorSession.queue.length,
                }
              : null
          }
          onSave={handleSaveEditedPage}
          onCancel={() => setEditorSession(null)}
        />
      )}

      {toast && (
        <div className="toast-banner" role="status" aria-live="polite">
          <CheckCircle2 size={16} color="#2DD4BF" />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}
