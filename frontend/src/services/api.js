/**
 * API Client for SIH26057 Sonar Detection Pipeline.
 */

const API_BASE = '/api';

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function getConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`Config fetch failed: ${res.statusText}`);
  return res.json();
}

export async function detectSonarImage(file, { confidenceThreshold = 0.25, iouThreshold = 0.45, enablePreprocessing = true } = {}) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_BASE}/detect?confidence_threshold=${confidenceThreshold}&iou_threshold=${iouThreshold}&enable_preprocessing=${enablePreprocessing}`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Detection failed with HTTP ${res.status}`);
  }

  return res.json();
}

export async function getDetections(imageId) {
  const res = await fetch(`${API_BASE}/detections/${imageId}`);
  if (!res.ok) throw new Error(`Failed to load detections for ${imageId}`);
  return res.json();
}

export async function getImageDetails(imageId) {
  const res = await fetch(`${API_BASE}/images/${imageId}`);
  if (!res.ok) throw new Error(`Failed to load image details for ${imageId}`);
  return res.json();
}

export async function getSamplesList() {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSampleAsFile(filename) {
  const res = await fetch(`${API_BASE}/samples/${filename}`);
  if (!res.ok) throw new Error(`Failed to download sample file: ${filename}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
