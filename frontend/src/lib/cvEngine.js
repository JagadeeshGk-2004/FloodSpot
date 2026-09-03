/**
 * Hydro Depth Engine Vision Classifier Integration.
 * Calls backend FastAPI /api/verify endpoint to evaluate visual evidence.
 *
 * @param {string} base64Image Base64 image data string
 * @returns {Promise<{ verified: boolean, confidence: number, detected_features: string[], error?: str, severity?: str, depth_est?: str }>}
 */
export async function verifyFloodImage(base64Image) {
  const defaultErrorMsg = "Verification Failed: No floodwater, road inundation, or storm hazard detected in this image.";

  if (!base64Image) {
    return {
      verified: false,
      confidence: 0.10,
      detected_features: [],
      error: defaultErrorMsg
    };
  }

  try {
    const res = await fetch('http://localhost:8000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64Image })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    const errBody = await res.json().catch(() => ({}));
    return {
      verified: false,
      confidence: 0.12,
      detected_features: [],
      error: errBody.error || errBody.detail || defaultErrorMsg
    };
  } catch (err) {
    console.warn('[cvEngine] Backend API query notice:', err);
    return {
      verified: false,
      confidence: 0.12,
      detected_features: [],
      error: defaultErrorMsg
    };
  }
}
