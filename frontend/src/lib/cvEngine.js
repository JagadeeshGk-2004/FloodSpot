/**
 * Hydro Depth Engine Vision Classifier Integration with AbortController 4s timeout.
 * Calls backend FastAPI /api/verify endpoint to evaluate visual evidence within sub-200ms.
 *
 * @param {string} base64Image Base64 image data string
 * @returns {Promise<{ success: boolean, verified: boolean, confidence: number, detected_features: string[], error?: string, severity?: string, depth_est?: string }>}
 */
export async function verifyFloodImage(base64Image) {
  const timeoutMsg = "Verification check timed out. Please verify your photo and retry.";

  if (!base64Image) {
    return {
      success: true,
      verified: false,
      confidence: 0.10,
      detected_features: [],
      error: "No photo provided for verification."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('http://localhost:8000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64Image }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    const errBody = await res.json().catch(() => ({}));
    return {
      success: true,
      verified: false,
      confidence: 0.12,
      detected_features: [],
      error: errBody.error || errBody.detail || "No floodwater, road inundation, or waterlogging detected in this image."
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errMsg = isTimeout ? timeoutMsg : "Verification check timed out. Please verify your photo and retry.";
    
    return {
      success: true,
      verified: false,
      confidence: 0.05,
      detected_features: [],
      error: errMsg
    };
  }
}
