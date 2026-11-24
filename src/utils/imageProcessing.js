/**
 * Computer Vision & Image Processing Engine for LensaScan
 * - Auto document edge/corner detection (Otsu + largest bright paper component)
 * - 3x3 Projective Homography 4-point perspective warp with bilinear interpolation
 * - Document enhancement filters (Original, Magic Color, Grayscale, B&W)
 *   powered by fast O(W*H) integral-image local illumination normalization
 */

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function fileToDataUrl(file, maxDimension = 2200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = async () => {
      try {
        const img = await loadImage(reader.result);
        const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsDataURL(file);
  });
}

export async function urlToDataUrl(url) {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function rotateImageDataUrl(dataUrl, deltaDegrees = 90) {
  const img = await loadImage(dataUrl);
  const rad = (((deltaDegrees % 360) + 360) % 360) * (Math.PI / 180);
  const isRightAngle = Math.abs(Math.sin(rad)) > 0.5;
  const w = isRightAngle ? img.naturalHeight : img.naturalWidth;
  const h = isRightAngle ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function getDefaultCorners(inset = 0.08) {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ];
}

export function getFullCorners() {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
}

/**
 * Automatically detect the 4 corners of a bright document page resting on a darker surface.
 * Uses paper whiteness scoring + Otsu thresholding + largest 4-connected component + extreme points.
 * Returns normalized coordinates [{x, y}, ...] in order: TL, TR, BR, BL.
 */
export function detectDocumentCorners(img) {
  try {
    const maxSide = 220;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(32, Math.round(img.naturalWidth * scale));
    const h = Math.max(32, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // 1. Paper whiteness score: high luminance + low color saturation
    const score = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const val = Math.max(0, Math.min(255, Math.round(lum - 0.35 * sat)));
      score[i] = val;
      hist[val]++;
    }

    // 2. Otsu threshold
    const total = w * h;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let maxVar = 0;
    let threshold = 140;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) {
        maxVar = between;
        threshold = t;
      }
    }

    // Ensure threshold isn't absurdly low on dark scenes
    threshold = Math.max(threshold, 110);

    // 3. Binary mask + simple 3x3 erosion to break thin bridges (like glare/pen)
    const rawMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      rawMask[i] = score[i] >= threshold ? 1 : 0;
    }

    const mask = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (
          rawMask[idx] &&
          rawMask[idx - 1] &&
          rawMask[idx + 1] &&
          rawMask[idx - w] &&
          rawMask[idx + w]
        ) {
          mask[idx] = 1;
        }
      }
    }

    // 4. Find largest 4-connected component
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let bestPixels = null;
    let bestCount = 0;

    for (let i = 0; i < w * h; i++) {
      if (!mask[i] || visited[i]) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = i;
      visited[i] = 1;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % w;
        const cy = (cur - cx) / w;

        if (cx > 0) {
          const n = cur - 1;
          if (mask[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cx < w - 1) {
          const n = cur + 1;
          if (mask[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cy > 0) {
          const n = cur - w;
          if (mask[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        if (cy < h - 1) {
          const n = cur + w;
          if (mask[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }

      if (tail > bestCount) {
        bestCount = tail;
        bestPixels = queue.slice(0, tail);
      }
    }

    const coverage = bestCount / total;
    if (!bestPixels || coverage < 0.14 || coverage > 0.94) {
      return getDefaultCorners(0.06);
    }

    // 5. Compute extreme 4 corners of the largest paper component
    let tl = { x: w, y: h, v: Infinity };
    let tr = { x: 0, y: h, v: -Infinity };
    let br = { x: 0, y: 0, v: -Infinity };
    let bl = { x: w, y: 0, v: Infinity };

    for (let i = 0; i < bestPixels.length; i++) {
      const idx = bestPixels[i];
      const x = idx % w;
      const y = (idx - x) / w;
      const sumXY = x + y;
      const diffXY = x - y;

      if (sumXY < tl.v) tl = { x, y, v: sumXY };
      if (diffXY > tr.v) tr = { x, y, v: diffXY };
      if (sumXY > br.v) br = { x, y, v: sumXY };
      if (diffXY < bl.v) bl = { x, y, v: diffXY };
    }

    // Compensate slightly (1px) for the 1px erosion outward from centroid
    const cx = (tl.x + tr.x + br.x + bl.x) / 4;
    const cy = (tl.y + tr.y + br.y + bl.y) / 4;
    const expand = (pt) => {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = Math.max(0, Math.min(w - 1, pt.x + (dx / len) * 1.5));
      const ny = Math.max(0, Math.min(h - 1, pt.y + (dy / len) * 1.5));
      return { x: nx / w, y: ny / h };
    };

    const corners = [expand(tl), expand(tr), expand(br), expand(bl)];

    // Sanity check: polygon area via shoelace formula
    const area = Math.abs(
      (corners[0].x * corners[1].y - corners[1].x * corners[0].y +
        corners[1].x * corners[2].y - corners[2].x * corners[1].y +
        corners[2].x * corners[3].y - corners[3].x * corners[2].y +
        corners[3].x * corners[0].y - corners[0].x * corners[3].y) /
        2
    );

    if (area < 0.14 || area > 0.98) {
      return getDefaultCorners(0.06);
    }

    return corners;
  } catch {
    return getDefaultCorners(0.06);
  }
}

/**
 * Solve 8x8 linear system Ax = b via Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null;

    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Compute projective homography mapping dst rectangle -> src quad
 */
function computeHomography(dstPts, srcPts) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const x = dstPts[i].x;
    const y = dstPts[i].y;
    const u = srcPts[i].x;
    const v = srcPts[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinearSystem(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Warp a 4-point quadrilateral region from an HTMLImageElement into a flat rectangular canvas.
 * corners: normalized [{x,y}, {x,y}, {x,y}, {x,y}] in TL, TR, BR, BL order.
 */
export function warpPerspective(img, corners, maxDim = 1600) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const srcPts = corners.map((c) => ({
    x: c.x * srcW,
    y: c.y * srcH,
  }));

  const topWidth = Math.hypot(srcPts[1].x - srcPts[0].x, srcPts[1].y - srcPts[0].y);
  const bottomWidth = Math.hypot(srcPts[2].x - srcPts[3].x, srcPts[2].y - srcPts[3].y);
  const leftHeight = Math.hypot(srcPts[3].x - srcPts[0].x, srcPts[3].y - srcPts[0].y);
  const rightHeight = Math.hypot(srcPts[2].x - srcPts[1].x, srcPts[2].y - srcPts[1].y);

  let outW = Math.max(64, Math.round(Math.max(topWidth, bottomWidth)));
  let outH = Math.max(64, Math.round(Math.max(leftHeight, rightHeight)));

  const scale = Math.min(1, maxDim / Math.max(outW, outH));
  outW = Math.max(64, Math.round(outW * scale));
  outH = Math.max(64, Math.round(outH * scale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0, srcW, srcH);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW;
  dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
  const dstImgData = dstCtx.createImageData(outW, outH);
  const dstData = dstImgData.data;

  const dstPts = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];

  const H = computeHomography(dstPts, srcPts);
  if (!H) {
    dstCtx.drawImage(img, 0, 0, outW, outH);
    return dstCanvas;
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
  const maxSrcX = srcW - 1;
  const maxSrcY = srcH - 1;

  for (let y = 0; y < outH; y++) {
    const h1y_h2 = h1 * y + h2;
    const h4y_h5 = h4 * y + h5;
    const h7y_h8 = h7 * y + h8;
    let dstIdx = y * outW * 4;

    for (let x = 0; x < outW; x++) {
      const denom = h6 * x + h7y_h8;
      const sx = (h0 * x + h1y_h2) / denom;
      const sy = (h3 * x + h4y_h5) / denom;

      if (sx >= 0 && sx < maxSrcX && sy >= 0 && sy < maxSrcY) {
        const x0 = sx | 0;
        const y0 = sy | 0;
        const fx = sx - x0;
        const fy = sy - y0;
        const fx1 = 1 - fx;
        const fy1 = 1 - fy;

        const w00 = fx1 * fy1;
        const w10 = fx * fy1;
        const w01 = fx1 * fy;
        const w11 = fx * fy;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;

        dstData[dstIdx] =
          srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11;
        dstData[dstIdx + 1] =
          srcData[i00 + 1] * w00 +
          srcData[i10 + 1] * w10 +
          srcData[i01 + 1] * w01 +
          srcData[i11 + 1] * w11;
        dstData[dstIdx + 2] =
          srcData[i00 + 2] * w00 +
          srcData[i10 + 2] * w10 +
          srcData[i01 + 2] * w01 +
          srcData[i11 + 2] * w11;
        dstData[dstIdx + 3] = 255;
      } else {
        const cx = Math.max(0, Math.min(maxSrcX, Math.round(sx)));
        const cy = Math.max(0, Math.min(maxSrcY, Math.round(sy)));
        const i = (cy * srcW + cx) * 4;
        dstData[dstIdx] = srcData[i];
        dstData[dstIdx + 1] = srcData[i + 1];
        dstData[dstIdx + 2] = srcData[i + 2];
        dstData[dstIdx + 3] = 255;
      }
      dstIdx += 4;
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

/**
 * Fast O(W*H) integral image for local illumination estimation
 */
function buildGrayIntegral(data, w, h) {
  const integral = new Float64Array((w + 1) * (h + 1));
  const stride = w + 1;
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const rowOff = (y + 1) * stride;
    const prevOff = y * stride;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      rowSum += gray;
      integral[rowOff + x + 1] = integral[prevOff + x + 1] + rowSum;
    }
  }
  return integral;
}

function getBoxMean(integral, w, h, x, y, r) {
  const x1 = Math.max(0, x - r);
  const y1 = Math.max(0, y - r);
  const x2 = Math.min(w - 1, x + r);
  const y2 = Math.min(h - 1, y + r);
  const stride = w + 1;
  const area = (x2 - x1 + 1) * (y2 - y1 + 1);
  const sum =
    integral[(y2 + 1) * stride + (x2 + 1)] -
    integral[y1 * stride + (x2 + 1)] -
    integral[(y2 + 1) * stride + x1] +
    integral[y1 * stride + x1];
  return sum / area;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export const FILTER_PRESETS = [
  { id: 'magic', label: 'Magic Color', desc: 'Kertas putih bersih, tinta tajam' },
  { id: 'original', label: 'Asli', desc: 'Warna natural hasil foto' },
  { id: 'grayscale', label: 'Abu-abu', desc: 'Kontras tinggi monokrom' },
  { id: 'bw', label: 'Hitam Putih', desc: 'Teks super tajam ala fotokopi' },
];

/**
 * Apply document enhancement filter + brightness/contrast adjustments to a canvas
 * Returns a new filtered canvas.
 */
export function applyDocumentFilter(sourceCanvas, filter = 'magic', brightness = 0, contrast = 0) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  outCtx.drawImage(sourceCanvas, 0, 0);

  const imgData = outCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const needsIntegral = filter === 'magic' || filter === 'grayscale' || filter === 'bw';
  const integral = needsIntegral ? buildGrayIntegral(data, w, h) : null;
  const radius = Math.max(18, Math.round(Math.min(w, h) * 0.045));

  const brightOffset = brightness * 1.8;
  const contrastFactor = Math.pow((100 + contrast * 1.4) / 100, 1.5);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (filter === 'magic') {
        const localMean = Math.max(40, getBoxMean(integral, w, h, x, y, radius));
        // Divide by local illumination so uneven shadows become pure white paper
        const gain = 246 / localMean;
        r = r * gain;
        g = g * gain;
        b = b * gain;

        // Gentle S-curve contrast boost while preserving color ink (signatures/logos)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 224) {
          // Whiten near-white paper grain cleanly
          const t = Math.min(1, (lum - 224) / 24);
          r = r + (255 - r) * t;
          g = g + (255 - g) * t;
          b = b + (255 - b) * t;
        } else {
          // Deepen ink slightly and boost saturation a touch
          const satBoost = 1.18;
          r = lum + (r - lum) * satBoost;
          g = lum + (g - lum) * satBoost;
          b = lum + (b - lum) * satBoost;
          r = (r - 128) * 1.28 + 128;
          g = (g - 128) * 1.28 + 128;
          b = (b - 128) * 1.28 + 128;
        }
      } else if (filter === 'grayscale') {
        const localMean = Math.max(40, getBoxMean(integral, w, h, x, y, radius));
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        let v = (gray * 244) / localMean;
        v = (v - 128) * 1.38 + 128;
        if (v > 228) v = 255;
        r = g = b = v;
      } else if (filter === 'bw') {
        const localMean = getBoxMean(integral, w, h, x, y, radius);
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        // Adaptive Bradley-style threshold with smooth anti-aliased transition
        const thresh = localMean * 0.87 - 4;
        const diff = gray - thresh;
        let v;
        if (diff > 10) v = 255;
        else if (diff < -10) v = 16;
        else v = 16 + ((diff + 10) / 20) * 239;
        r = g = b = v;
      }

      // Apply user manual brightness & contrast
      if (brightness !== 0 || contrast !== 0) {
        r = (r - 128) * contrastFactor + 128 + brightOffset;
        g = (g - 128) * contrastFactor + 128 + brightOffset;
        b = (b - 128) * contrastFactor + 128 + brightOffset;
      }

      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
    }
  }

  outCtx.putImageData(imgData, 0, 0);
  return outCanvas;
}
