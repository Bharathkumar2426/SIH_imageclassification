/**
 * Maritime Incident Intelligence API Client (SIH 26057).
 *
 * Provides REST calls for incident querying, metrics, source health monitors,
 * human operator map confirmation workflows, and safe AIS risk correlation.
 */

const API_BASE = '/api/incidents';

export async function getIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.severity) query.set('severity', params.severity);
  if (params.incident_type) query.set('incident_type', params.incident_type);
  if (params.is_mapped) query.set('is_mapped', 'true');
  if (params.pending_review) query.set('pending_review', 'true');
  if (params.search) query.set('search', params.search);

  const url = query.toString() ? `${API_BASE}?${query.toString()}` : API_BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.statusText}`);
  return res.json();
}

export async function getIncidentMetrics() {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.statusText}`);
  return res.json();
}

export async function getSourcesStatus() {
  const res = await fetch(`${API_BASE}/sources/status`);
  if (!res.ok) throw new Error(`Failed to fetch source statuses: ${res.statusText}`);
  return res.json();
}

export async function getIncidentById(incidentId) {
  const res = await fetch(`${API_BASE}/${incidentId}`);
  if (!res.ok) throw new Error(`Failed to fetch incident ${incidentId}: ${res.statusText}`);
  return res.json();
}

export async function confirmMapIncident(incidentId, customDangerRadiusKm = null, notes = null) {
  const res = await fetch(`${API_BASE}/${incidentId}/confirm-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      incident_id: incidentId,
      custom_danger_radius_km: customDangerRadiusKm,
      operator_notes: notes,
    }),
  });
  if (!res.ok) throw new Error(`Failed to confirm map incident: ${res.statusText}`);
  return res.json();
}

export async function dismissIncident(incidentId) {
  const res = await fetch(`${API_BASE}/${incidentId}/dismiss`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to dismiss incident: ${res.statusText}`);
  return res.json();
}

export async function triggerManualRefresh() {
  const res = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to trigger refresh: ${res.statusText}`);
  return res.json();
}

export async function getNearbyVessels(incidentId) {
  const res = await fetch(`${API_BASE}/${incidentId}/nearby-vessels`);
  if (!res.ok) throw new Error(`Failed to fetch nearby vessels: ${res.statusText}`);
  return res.json();
}
