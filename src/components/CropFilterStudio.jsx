import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Crop,
  Loader2,
  Maximize2,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  FILTER_PRESETS,
  applyDocumentFilter,
  detectDocumentCorners,
  getFullCorners,
  loadImage,
  rotateImageDataUrl,
  warpPerspective,
} from '../utils/imageProcessing';

const HANDLE_LABELS = ['Sudut Kiri Atas', 'Sudut Kanan Atas', 'Sudut Kanan Bawah', 'Sudut Kiri Bawah'];

export default function CropFilterStudio({
  initialDataUrl,
  initialCorners = null,
  initialFilter = 'magic',
  initialBrightness = 0,
  initialContrast = 0,
  batchProgress = null, // { current, total }
  onSave,
  onCancel,
}) {
  const [step, setStep] = useState('crop'); // 'crop' | 'filter'
  const [sourceUrl, setSourceUrl] = useState(initialDataUrl);
  const [corners, setCorners] = useState(
    initialCorners || [
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ]
  );

  const [filter, setFilter] = useState(initialFilter);
  const [brightness, setBrightness] = useState(initialBrightness);
  const [contrast, setContrast] = useState(initialContrast);
  const [showSliders, setShowSliders] = useState(false);

  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [filterThumbs, setFilterThumbs] = useState({});

  const [activeHandle, setActiveHandle] = useState(null);
  const [loupePos, setLoupePos] = useState(null);

  const imgRef = useRef(null);
  const stageRef = useRef(null);
  const loupeCanvasRef = useRef(null);
  const loadedImgRef = useRef(null);
  const warpedCanvasRef = useRef(null);

  // Load source image and auto-detect document corners when no custom corners provided
  useEffect(() => {
    let cancelled = false;
    async function initImage() {
      setIsBusy(true);
      setBusyLabel('Mendeteksi tepi dokumen...');
      try {
        const img = await loadImage(sourceUrl);
        if (cancelled) return;
        loadedImgRef.current = img;

        if (!initialCorners) {
          const detected = detectDocumentCorners(img);
          if (!cancelled) setCorners(detected);
        }
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    }
    initImage();
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, initialCorners]);

  // Draw zoomed circular magnifier loupe while dragging a corner handle
  useEffect(() => {
    if (activeHandle === null || !loupeCanvasRef.current || !loadedImgRef.current) return;
    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = loadedImgRef.current;
    const pt = corners[activeHandle];

    const size = 140;
    canvas.width = size;
    canvas.height = size;

    const srcX = pt.x * img.naturalWidth;
    const srcY = pt.y * img.naturalHeight;
    const sampleRadius = Math.max(40, Math.min(img.naturalWidth, img.naturalHeight) * 0.085);

    ctx.fillStyle = '#0c0f14';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      img,
      srcX - sampleRadius,
      srcY - sampleRadius,
      sampleRadius * 2,
      sampleRadius * 2,
      0,
      0,
      size,
      size
    );
  }, [activeHandle, corners]);

  const updateCornerFromPointer = (index, clientX, clientY) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setCorners((prev) => {
      const next = [...prev];
      next[index] = { x: nx, y: ny };
      return next;
    });

    // Place magnifier loupe away from finger/cursor
    const lx = Math.max(16, Math.min(window.innerWidth - 128, clientX - 56));
    const ly = clientY > 180 ? clientY - 142 : clientY + 42;
    setLoupePos({ x: lx, y: ly });
  };

  const handlePointerDown = (index, e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveHandle(index);
    updateCornerFromPointer(index, e.clientX, e.clientY);
  };

  const handlePointerMove = (index, e) => {
    if (activeHandle !== index) return;
    e.preventDefault();
    updateCornerFromPointer(index, e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setActiveHandle(null);
    setLoupePos(null);
  };

  const handleAutoDetect = () => {
    if (!loadedImgRef.current) return;
    const detected = detectDocumentCorners(loadedImgRef.current);
    setCorners(detected);
  };

  const handleSelectFull = () => {
    setCorners(getFullCorners());
  };

  const handleRotateSource = async () => {
    setIsBusy(true);
    setBusyLabel('Memutar gambar...');
    try {
      const rotatedUrl = await rotateImageDataUrl(sourceUrl, 90);
      const img = await loadImage(rotatedUrl);
      loadedImgRef.current = img;
      setSourceUrl(rotatedUrl);
      setCorners(detectDocumentCorners(img));
    } finally {
      setIsBusy(false);
    }
  };

  const proceedToFilter = async () => {
    if (!loadedImgRef.current) return;
    setIsBusy(true);
    setBusyLabel('Meluruskan perspektif dokumen...');

    // Allow React to paint the busy indicator before synchronous canvas warp
    await new Promise((r) => setTimeout(r, 30));

    try {
      const warped = warpPerspective(loadedImgRef.current, corners, 1500);
      warpedCanvasRef.current = warped;

      // Build tiny swatch thumbnails for each preset
      const thumbCanvas = document.createElement('canvas');
      const thumbScale = Math.min(1, 160 / Math.max(warped.width, warped.height));
      thumbCanvas.width = Math.max(32, Math.round(warped.width * thumbScale));
      thumbCanvas.height = Math.max(32, Math.round(warped.height * thumbScale));
      thumbCanvas.getContext('2d').drawImage(warped, 0, 0, thumbCanvas.width, thumbCanvas.height);

      const thumbs = {};
      for (const preset of FILTER_PRESETS) {
        const filteredThumb = applyDocumentFilter(thumbCanvas, preset.id, 0, 0);
        thumbs[preset.id] = filteredThumb.toDataURL('image/jpeg', 0.75);
      }
      setFilterThumbs(thumbs);

      const filtered = applyDocumentFilter(warped, filter, brightness, contrast);
      setPreviewUrl(filtered.toDataURL('image/jpeg', 0.91));
      setStep('filter');
    } finally {
      setIsBusy(false);
    }
  };

  // Re-apply filter when user switches preset or adjusts sliders in step 2
  useEffect(() => {
    if (step !== 'filter' || !warpedCanvasRef.current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || !warpedCanvasRef.current) return;
      const filtered = applyDocumentFilter(warpedCanvasRef.current, filter, brightness, contrast);
      setPreviewUrl(filtered.toDataURL('image/jpeg', 0.91));
    }, 55);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, filter, brightness, contrast]);

  const handleFinishSave = () => {
    if (!warpedCanvasRef.current || !previewUrl) return;
    onSave({
      originalDataUrl: sourceUrl,
      processedDataUrl: previewUrl,
      corners,
      filter,
      brightness,
      contrast,
      width: warpedCanvasRef.current.width,
      height: warpedCanvasRef.current.height,
    });
  };

  // SVG polygon coordinates in 0..1000 viewBox
  const polyPoints = corners.map((c) => `${c.x * 1000},${c.y * 1000}`).join(' ');
  const outerMaskPath = `M 0 0 H 1000 V 1000 H 0 Z M ${corners[0].x * 1000} ${corners[0].y * 1000} L ${corners[1].x * 1000} ${corners[1].y * 1000} L ${corners[2].x * 1000} ${corners[2].y * 1000} L ${corners[3].x * 1000} ${corners[3].y * 1000} Z`;

  return (
    <div className="studio-overlay" role="dialog" aria-modal="true" aria-label="Editor Pemindaian Dokumen">
      {/* Studio Top Bar */}
      <div className="studio-topbar">
        {step === 'crop' ? (
          <button id="studio-cancel-btn" className="studio-ghost-btn" onClick={onCancel}>
            <ArrowLeft size={17} />
            Batal
          </button>
        ) : (
          <button id="studio-back-crop-btn" className="studio-ghost-btn" onClick={() => setStep('crop')}>
            <Crop size={17} />
            Potong
          </button>
        )}

        <div className="studio-title-wrap">
          <span className="studio-title">
            {step === 'crop' ? 'Sesuaikan 4 Sudut' : 'Filter & Peningkatan'}
          </span>
          <span className="studio-subtitle">
            {batchProgress
              ? `Halaman ${batchProgress.current} dari ${batchProgress.total}`
              : step === 'crop'
                ? 'Geser titik sudut ke tepi kertas'
                : 'Pilih tampilan scan paling jernih'}
          </span>
        </div>

        {step === 'crop' ? (
          <button
            id="studio-next-filter-btn"
            className="studio-primary-btn"
            onClick={proceedToFilter}
            disabled={isBusy}
          >
            {isBusy ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
            Luruskan
          </button>
        ) : (
          <button
            id="studio-save-page-btn"
            className="studio-primary-btn"
            onClick={handleFinishSave}
            disabled={isBusy || !previewUrl}
          >
            <Check size={17} />
            {batchProgress && batchProgress.current < batchProgress.total ? 'Lanjut' : 'Simpan'}
          </button>
        )}
      </div>

      {/* Main Canvas Stage */}
      <div className="studio-canvas-area">
        {step === 'crop' ? (
          <div ref={stageRef} className="crop-stage-wrap">
            <img ref={imgRef} src={sourceUrl} alt="Dokumen untuk dipotong" className="crop-stage-img" />

            <svg className="crop-svg-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <path d={outerMaskPath} fill="rgba(7, 10, 16, 0.56)" fillRule="evenodd" />
              <polygon
                points={polyPoints}
                fill="rgba(45, 212, 191, 0.07)"
                stroke="#2DD4BF"
                strokeWidth="3.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {corners.map((pt, idx) => (
              <div
                key={idx}
                id={`crop-handle-${idx}`}
                role="slider"
                aria-label={HANDLE_LABELS[idx]}
                className={`crop-handle ${activeHandle === idx ? 'active' : ''}`}
                style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onPointerMove={(e) => handlePointerMove(idx, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <span className="crop-handle-dot" />
              </div>
            ))}
          </div>
        ) : (
          <div className="crop-stage-wrap">
            {previewUrl && (
              <img src={previewUrl} alt="Hasil scan dokumen" className="crop-stage-img" />
            )}
          </div>
        )}

        {isBusy && (
          <div className="processing-pill">
            <Loader2 size={16} className="spin" />
            <span>{busyLabel}</span>
          </div>
        )}
      </div>

      {/* Zoomed Magnifier Loupe */}
      {step === 'crop' && activeHandle !== null && loupePos && (
        <div
          className="magnifier-loupe"
          style={{ left: `${loupePos.x}px`, top: `${loupePos.y}px` }}
        >
          <canvas ref={loupeCanvasRef} />
          <div className="magnifier-crosshair" />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="studio-controls">
        {step === 'crop' ? (
          <div className="studio-tool-row">
            <button id="crop-auto-btn" className="studio-tool-btn" onClick={handleAutoDetect}>
              <Sparkles size={16} />
              Deteksi Otomatis
            </button>
            <button id="crop-full-btn" className="studio-tool-btn" onClick={handleSelectFull}>
              <Maximize2 size={16} />
              Penuh
            </button>
            <button id="crop-rotate-btn" className="studio-tool-btn" onClick={handleRotateSource}>
              <RotateCw size={16} />
              Putar 90°
            </button>
          </div>
        ) : (
          <>
            <div className="filter-strip">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  id={`filter-preset-${preset.id}`}
                  className={`filter-card ${filter === preset.id ? 'active' : ''}`}
                  onClick={() => setFilter(preset.id)}
                >
                  <div className="filter-swatch">
                    {filterThumbs[preset.id] && (
                      <img src={filterThumbs[preset.id]} alt={preset.label} />
                    )}
                  </div>
                  <span>{preset.label}</span>
                </button>
              ))}

              <button
                id="toggle-adjust-sliders"
                className={`filter-card ${showSliders ? 'active' : ''}`}
                onClick={() => setShowSliders((s) => !s)}
              >
                <div
                  className="filter-swatch"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#222b3a',
                    color: '#2dd4bf',
                  }}
                >
                  <SlidersHorizontal size={18} />
                </div>
                <span>Atur</span>
              </button>
            </div>

            {showSliders && (
              <div className="sliders-row">
                <label className="slider-field">
                  <span className="slider-label">
                    <span>Kecerahan</span>
                    <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </span>
                  <input
                    id="slider-brightness"
                    type="range"
                    min="-35"
                    max="35"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="studio-range"
                  />
                </label>

                <label className="slider-field">
                  <span className="slider-label">
                    <span>Kontras</span>
                    <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
                  </span>
                  <input
                    id="slider-contrast"
                    type="range"
                    min="-35"
                    max="35"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="studio-range"
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
