import { apiRequest } from '@/services/apiClient';
import type { AttendanceLogEntry, AttendanceLogStatus } from '@/data/studentImmersionMock';
import type { AttendanceCapture, AttendanceRecord, CaptureMode } from '@/types/immersion';

/**
 * Immersion attendance — maps to `attendance_logs` via POST /time-in and /time-out
 * (backend/main.py): multipart/form-data with a photo file + GPS + capture timestamp.
 */

/**
 * Mirrors the backend's own IMMERSION_REQUIRED_HOURS constant (backend/db_supabase.py) —
 * there is no student-facing endpoint that returns it (only a teacher-only overview does),
 * so the fixed program-wide value is duplicated here rather than fetched.
 */
export const IMMERSION_REQUIRED_HOURS = 600;

export function formatDisplayTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Real GPS via expo-location. The backend can reverse-geocode a readable place name
 * itself when none is supplied, but the capture-preview UI needs *something* to show
 * immediately after the photo is taken — so we show raw coordinates there and let the
 * value travel to the backend as-is (no hardcoded placeholder location).
 */
export async function captureLocationMetadata(): Promise<{
  latitude: number;
  longitude: number;
  readableLocationName: string;
  captureTimestamp: string;
}> {
  const Location = await import('expo-location');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to capture immersion attendance.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  return {
    latitude,
    longitude,
    readableLocationName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    captureTimestamp: new Date().toISOString(),
  };
}

function guessImageMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function buildCaptureFormData(capture: AttendanceCapture): FormData {
  const form = new FormData();
  const filename = capture.photoUri.split('/').pop() || `capture-${Date.now()}.jpg`;
  // React Native's fetch accepts this {uri,name,type} shape as a file part.
  form.append('photo', {
    uri: capture.photoUri,
    name: filename,
    type: guessImageMimeType(capture.photoUri),
  } as unknown as Blob);
  form.append('latitude', String(capture.latitude));
  form.append('longitude', String(capture.longitude));
  form.append('readable_location_name', capture.readableLocationName);
  form.append('capture_timestamp', capture.captureTimestamp);
  return form;
}

export async function submitTimeIn(capture: AttendanceCapture): Promise<AttendanceRecord> {
  await apiRequest('/time-in', { method: 'POST', formData: buildCaptureFormData(capture) });
  return {
    ...capture,
    displayTime: formatDisplayTime(capture.captureTimestamp),
  };
}

export async function submitTimeOut(
  capture: AttendanceCapture,
  timeInIso: string,
): Promise<{ record: AttendanceRecord; totalHours: number }> {
  const updated = await apiRequest<{ total_hours?: number | string }>('/time-out', {
    method: 'POST',
    formData: buildCaptureFormData(capture),
  });
  const outIso = capture.captureTimestamp;
  const ms = new Date(outIso).getTime() - new Date(timeInIso).getTime();
  const fallbackHours = Math.max(0, Math.round((ms / 3600000) * 10) / 10);
  const totalHours = updated.total_hours != null ? Number(updated.total_hours) : fallbackHours;
  return {
    record: {
      ...capture,
      displayTime: formatDisplayTime(outIso),
    },
    totalHours,
  };
}

type RawAttendanceRow = {
  id: string;
  time_in?: string | null;
  time_out?: string | null;
  total_hours?: number | string | null;
  status?: string | null;
  readable_location_name?: string | null;
};

function toAttendanceLogEntry(row: RawAttendanceRow): AttendanceLogEntry {
  const timeInDate = row.time_in ? new Date(row.time_in) : null;
  const status: AttendanceLogStatus =
    row.status === 'completed' || row.time_out ? 'completed' : 'incomplete';
  return {
    id: String(row.id),
    month: timeInDate
      ? timeInDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
      : '—',
    day: timeInDate ? String(timeInDate.getDate()) : '—',
    dateLabel: timeInDate
      ? timeInDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Unknown date',
    timeIn: row.time_in ? formatDisplayTime(row.time_in) : '—',
    timeOut: row.time_out ? formatDisplayTime(row.time_out) : '—',
    totalHours: row.total_hours != null ? Number(row.total_hours) : 0,
    location: row.readable_location_name || '—',
    status,
  };
}

export async function fetchAttendanceHistory(limit = 30): Promise<{
  active: RawAttendanceRow | null;
  logs: AttendanceLogEntry[];
  totalHoursRendered: number;
}> {
  const res = await apiRequest<{
    active: RawAttendanceRow | null;
    history: RawAttendanceRow[];
    total_hours_rendered: number;
  }>('/attendance-history', { query: { limit } });
  return {
    active: res.active ?? null,
    logs: (res.history ?? []).map(toAttendanceLogEntry),
    totalHoursRendered: res.total_hours_rendered ?? 0,
  };
}

export function getCaptureModeHint(mode: CaptureMode): string {
  return mode === 'time_in'
    ? 'Take a photo to capture your location and time before Time In.'
    : 'Take a photo to capture your location and time before Time Out.';
}

export function getCaptureReadyHint(mode: CaptureMode): string {
  return mode === 'time_in'
    ? 'Photo, location, and time captured. You can now tap Time In.'
    : 'Photo, location, and time captured. You can now tap Time Out.';
}
