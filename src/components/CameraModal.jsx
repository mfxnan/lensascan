import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Grid3x3,
  ImagePlus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { fileToDataUrl, urlToDataUrl } from '../utils/imageProcessing';

export default function CameraModal({ onComplete, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [facingMode, setFacingMode] = useState('environment');
  const [showGrid, setShowGrid] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [capturedList, setCapturedList] = useState([]);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      setCameraError('');
      setIsReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Browser ini tidak mendukung akses kamera langsung. Gunakan Unggah Galeri atau Dokumen Contoh.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err) {
        if (!active) return;
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Izinkan akses kamera di browser atau unggah foto dari galeri.'
            : 'Kamera tidak tersedia pada perangkat ini. Kamu tetap bisa unggah foto dari galeri atau mencoba dokumen contoh.';
        setCameraError(msg);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    setFlashKey((k) => k + 1);
    setCapturedList((prev) => [...prev, dataUrl]);
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const urls = [];
    for (const file of files) {
      try {
        const url = await fileToDataUrl(file);
        urls.push(url);
      } catch {
        // Ignore invalid image files
      }
    }
    if (urls.length > 0) {
      onComplete([...capturedList, ...urls]);
    }
  };

  const handleUseSample = async () => {
    const sampleUrl = await urlToDataUrl('/sample-invoice.jpg');
    onComplete([...capturedList, sampleUrl]);
  };

  const handleFinishBatch = () => {
    if (capturedList.length > 0) {
      onComplete(capturedList);
    }
  };

  return (
    <div className="studio-overlay" role="dialog" aria-modal="true" aria-label="Kamera Pemindai">
      <div className="studio-topbar">
        <button id="camera-close-btn" className="studio-ghost-btn" onClick={onCancel}>
          <X size={18} />
          Batal
        </button>

        <div className="studio-title-wrap">
          <span className="studio-title">Kamera Dokumen</span>
          <span className="studio-subtitle">
            {capturedList.length > 0
              ? `${capturedList.length} halaman siap diproses`
              : 'Posisikan dokumen di dalam bingkai'}
          </span>
        </div>

        <button
          id="camera-grid-btn"
          className="studio-ghost-btn"
          onClick={() => setShowGrid((s) => !s)}
          title="Tampilkan Grid"
        >
          <Grid3x3 size={18} />
        </button>
      </div>

      <div className="camera-viewport">
        {!cameraError ? (
          <>
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            {showGrid && <div className="camera-grid" />}
            <div className="camera-guide-frame">
              <span className="guide-corner tl" />
              <span className="guide-corner tr" />
              <span className="guide-corner bl" />
              <span className="guide-corner br" />
            </div>
            {flashKey > 0 && <div key={flashKey} className="camera-flash" />}
          </>
        ) : (
          <div className="camera-fallback-card">
            <div className="empty-icon-ring">
              <Camera size={28} />
            </div>
            <h3>Kamera Tidak Terdeteksi</h3>
            <p>{cameraError}</p>
            <div className="empty-actions">
              <button
                id="camera-fallback-upload"
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={18} />
                Pilih dari Galeri
              </button>
              <button
                id="camera-fallback-sample"
                className="studio-tool-btn"
                onClick={handleUseSample}
              >
                <Sparkles size={16} />
                Coba Dokumen Contoh
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="camera-dock-wrap">
        <div className="camera-bottom-dock">
          <button
            id="camera-gallery-btn"
            className="camera-side-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={24} />
            <span>Galeri</span>
          </button>

          <button
            id="camera-shutter-btn"
            className="shutter-btn"
            onClick={handleCapture}
            disabled={!isReady}
            aria-label="Ambil Foto Dokumen"
          >
            <span className="shutter-inner" />
          </button>

          {capturedList.length > 0 ? (
            <button
              id="camera-done-btn"
              className="studio-primary-btn"
              onClick={handleFinishBatch}
            >
              <Check size={18} />
              Lanjut ({capturedList.length})
            </button>
          ) : (
            <button
              id="camera-flip-btn"
              className="camera-side-btn"
              onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
              disabled={Boolean(cameraError)}
            >
              <RefreshCw size={22} />
              <span>Putar</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleGalleryUpload}
      />
    </div>
  );
}
