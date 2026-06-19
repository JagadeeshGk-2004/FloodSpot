/**
 * imageValidator.js — Client-side flood image verification service.
 * 
 * Validates uploaded images using heuristic analysis:
 * - File type & dimension checks
 * - Color channel analysis (flood images tend toward blue/brown)
 * - Duplicate detection via perceptual hashing
 * - Size bounds verification
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_WIDTH = 240;
const MIN_HEIGHT = 240;
const MIN_SIZE = 30 * 1024;     // 30KB — reject tiny/placeholder images
const MAX_SIZE = 15 * 1024 * 1024; // 15MB

// Simple perceptual hash store for duplicate detection within session
const recentHashes = new Set();

/**
 * Generates a rough perceptual hash from image pixel data.
 * Downsamples to 8x8 grayscale and compares to average.
 */
function perceptualHash(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 8, 8);
      const data = ctx.getImageData(0, 0, 8, 8).data;
      let hash = '';
      let total = 0;

      // Calculate average brightness
      for (let i = 0; i < data.length; i += 4) {
        total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }
      const avg = total / 64;

      // Build hash: 1 if pixel brighter than average, 0 otherwise
      for (let i = 0; i < data.length; i += 4) {
        const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        hash += brightness > avg ? '1' : '0';
      }

      resolve(hash);
    };
    img.onerror = () => resolve(null);
    img.src = imageData;
  });
}

/**
 * Analyzes color composition of the image.
 * Flood images typically have dominant blue/brown/gray palettes.
 * Rejects images that are clearly non-flood (e.g., pure red, neon colors).
 */
function analyzeColorComposition(imageDataUrl) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Downsample to 64x64 for speed
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const totalPixels = 64 * 64;

      let blueCount = 0;
      let brownCount = 0;
      let grayCount = 0;
      let greenCount = 0;
      let extremeCount = 0; // neon/pure saturated colors

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;

        // Blue-dominant (water, sky reflection)
        if (b > r * 1.2 && b > g * 1.1 && b > 80) blueCount++;

        // Brown-dominant (muddy water, soil)
        if (r > 80 && g > 50 && b < r * 0.7 && r > g * 0.9) brownCount++;

        // Gray (overcast, concrete, wet surfaces)
        if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 60 && r < 200) grayCount++;

        // Green (vegetation — some presence is normal)
        if (g > r * 1.2 && g > b * 1.2) greenCount++;

        // Extreme saturation (neon, artificial — suspicious)
        if (saturation > 0.85 && max > 200) extremeCount++;
      }

      const blueRatio = blueCount / totalPixels;
      const brownRatio = brownCount / totalPixels;
      const grayRatio = grayCount / totalPixels;
      const greenRatio = greenCount / totalPixels;
      const extremeRatio = extremeCount / totalPixels;

      // Scoring: higher = more likely flood-related
      let score = 50; // baseline

      // Boost for flood-typical colors
      if (blueRatio > 0.1) score += Math.min(blueRatio * 80, 20);
      if (brownRatio > 0.1) score += Math.min(brownRatio * 60, 15);
      if (grayRatio > 0.15) score += Math.min(grayRatio * 40, 10);

      // Penalty for non-flood indicators
      if (extremeRatio > 0.3) score -= 25;
      if (greenRatio > 0.5) score -= 10; // Too much green = probably not flooded

      score = Math.max(0, Math.min(100, Math.round(score)));

      resolve({
        score,
        blueRatio: Math.round(blueRatio * 100),
        brownRatio: Math.round(brownRatio * 100),
        grayRatio: Math.round(grayRatio * 100),
      });
    };

    img.onerror = () => resolve({ score: 50, blueRatio: 0, brownRatio: 0, grayRatio: 0 });
    img.src = imageDataUrl;
  });
}

/**
 * Main validation function.
 * Returns { valid, confidence, status, message, details }
 * 
 * status: 'verified' | 'suspicious' | 'rejected'
 * confidence: 0-100
 */
export async function validateFloodImage(file) {
  const result = {
    valid: false,
    confidence: 0,
    status: 'rejected',
    message: '',
    details: {},
  };

  // 1. File type check
  if (!ALLOWED_TYPES.includes(file.type)) {
    result.message = 'Only JPEG, PNG, and WebP images are accepted.';
    return result;
  }

  // 2. File size check
  if (file.size < MIN_SIZE) {
    result.message = 'Image is too small. Please provide a clear photo.';
    return result;
  }
  if (file.size > MAX_SIZE) {
    result.message = 'Image exceeds 15MB limit. Please use a smaller photo.';
    return result;
  }

  // 3. Read as data URL for further analysis
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 4. Dimension check
  const dimensions = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });

  if (dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT) {
    result.message = `Image too small (${dimensions.width}×${dimensions.height}). Minimum ${MIN_WIDTH}×${MIN_HEIGHT}px required.`;
    return result;
  }

  // 5. Duplicate detection
  const hash = await perceptualHash(dataUrl);
  if (hash && recentHashes.has(hash)) {
    result.message = 'This image appears to be a duplicate of a recent upload.';
    result.status = 'rejected';
    return result;
  }
  if (hash) recentHashes.add(hash);

  // 6. Color composition analysis
  const colorAnalysis = await analyzeColorComposition(dataUrl);

  result.details = {
    dimensions,
    fileSize: file.size,
    colorAnalysis,
  };

  // 7. Determine verdict
  const score = colorAnalysis.score;

  if (score >= 55) {
    result.valid = true;
    result.confidence = score;
    result.status = 'verified';
    result.message = 'Image appears consistent with flood conditions.';
  } else if (score >= 35) {
    result.valid = true; // Allow but flag
    result.confidence = score;
    result.status = 'suspicious';
    result.message = 'Image may not clearly show flood conditions. Proceeding with flag.';
  } else {
    result.valid = false;
    result.confidence = score;
    result.status = 'rejected';
    result.message = 'Image does not appear to show flood-related conditions.';
  }

  return result;
}
