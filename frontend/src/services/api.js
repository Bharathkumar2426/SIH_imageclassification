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

export async function enrichGeospatial(detectionResult, { latitude = 9.3142, longitude = 79.1821, depth = 28.0 } = {}) {
  const url = `${API_BASE}/geospatial/enrich?latitude=${latitude}&longitude=${longitude}&depth=${depth}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detectionResult),
  });
  if (!res.ok) throw new Error(`Geospatial enrichment failed: ${res.statusText}`);
  return res.json();
}

export async function getGeospatialForImage(imageId, { latitude = 9.3142, longitude = 79.1821, depth = 28.0 } = {}) {
  const url = `${API_BASE}/geospatial/${imageId}?latitude=${latitude}&longitude=${longitude}&depth=${depth}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch geospatial data for ${imageId}`);
  return res.json();
}

export async function getFleetGeospatial() {
  const res = await fetch(`${API_BASE}/geospatial/all/fleet`);
  if (!res.ok) throw new Error('Failed to fetch fleet geospatial data');
  return res.json();
}

export async function getGeospatialConfig() {
  const res = await fetch(`${API_BASE}/geospatial/config/parameters`);
  if (!res.ok) throw new Error('Failed to fetch geospatial configuration');
  return res.json();
}

