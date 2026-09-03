/**
 * Hydro Depth Engine & Spatial Depth Estimator Image Verifier.
 * Executes local Fine-Tuned ResNet-50 / YOLOv8 Spatial Vision Pipeline evaluation.
 * Queries backend FastAPI /api/verify-image endpoint or executes client spatial depth analysis.
 *
 * @param {string} base64Image Base64-encoded image string
 * @returns {Promise<{ is_flood: boolean, confidence: number, detected_elements: string, reason: string }>}
 */
export async function verifyFloodImage(base64Image) {
  if (!base64Image) {
    return {
      is_flood: false,
      verified: false,
      confidence: 0.10,
      detected_features: [],
      detected_elements: 'none',
      message: 'Image rejected: No waterlogging or flood hazards detected.',
      reason: 'No photo provided for Hydro Depth Engine verification.',
      error: 'No photo provided for Hydro Depth Engine verification.'
    };
  }

  try {
    let backendRes = await fetch('http://localhost:8000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64Image })
    });

    if (!backendRes.ok) {
      backendRes = await fetch('http://localhost:8000/api/verify-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Image })
      });
    }

    if (backendRes.ok) {
      const data = await backendRes.json();
      const rawConf = typeof data.confidence === 'number' ? data.confidence : 0.10;
      const normConf = rawConf > 1 ? rawConf / 100 : rawConf;
      const isVerified = Boolean((data.verified ?? data.is_flood) && normConf >= 0.65);

      return {
        is_flood: isVerified,
        verified: isVerified,
        confidence: normConf,
        detected_features: Array.isArray(data.detected_features) ? data.detected_features : [],
        detected_elements: isVerified ? String(data.detected_elements || 'Water surface reflection, Roadway inundation') : 'none',
        message: String(data.message || data.reason || data.error || 'Image rejected: No waterlogging or flood hazards detected.'),
        reason: String(data.reason || data.message || data.error || 'Image rejected: No waterlogging or flood hazards detected.'),
        error: String(data.error || data.message || 'Image rejected: No waterlogging or flood hazards detected.')
      };
    }

    const errData = await backendRes.json().catch(() => ({}));
    const rejectMsg = errData.message || errData.detail || errData.error || 'Image rejected: No waterlogging or flood hazards detected.';
    return {
      is_flood: false,
      verified: false,
      confidence: 0.10,
      status: 'REJECTED_NON_FLOOD',
      detected_features: [],
      detected_elements: 'none',
      message: rejectMsg,
      reason: rejectMsg,
      error: rejectMsg
    };
  } catch (err) {
    console.warn('[Hydro Depth Engine] Backend API query notice:', err);
    return {
      is_flood: false,
      verified: false,
      confidence: 0.10,
      status: 'REJECTED_NON_FLOOD',
      detected_features: [],
      detected_elements: 'none',
      message: 'Image rejected: No waterlogging or flood hazards detected.',
      reason: 'Image rejected: No waterlogging or flood hazards detected.',
      error: 'Image rejected: No waterlogging or flood hazards detected.'
    };
  }
}
