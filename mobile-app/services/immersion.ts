import type { AttendanceCapture, AttendanceRecord, CaptureMode } from '@/types/immersion';

/**
 * Mock immersion attendance — maps to `attendance_logs` when API is wired:
 * time_in, time_out, total_hours, latitude, longitude,
 * readable_location_name, capture_timestamp,
 * time_in_photo_base64, time_out_photo_base64
 */
const USE_MOCK = true;

const MOCK_LOCATION = {
  latitude: 14.281,
  longitude: 121.416,
  readableLocationName: 'Santa Cruz, Laguna',
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatDisplayTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Mock GPS + readable place — swap for expo-location + reverse geocode when wired to API. */
export async function captureLocationMetadata(): Promise<{
  latitude: number;
  longitude: number;
  readableLocationName: string;
  captureTimestamp: string;
}> {
  if (USE_MOCK) {
    await delay(200);
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = pos.coords;
        return {
          latitude,
          longitude,
          readableLocationName: MOCK_LOCATION.readableLocationName,
          captureTimestamp: new Date().toISOString(),
        };
      }
    } catch {
      // fall through to mock
    }
    return {
      ...MOCK_LOCATION,
      captureTimestamp: new Date().toISOString(),
    };
  }
  throw new Error('Location not available');
}

export async function submitTimeIn(
  capture: AttendanceCapture,
): Promise<AttendanceRecord> {
  if (USE_MOCK) {
    await delay(300);
    return {
      ...capture,
      displayTime: formatDisplayTime(capture.captureTimestamp),
    };
  }
  // Future: POST /immersion/time-in { ...capture, time_in_photo_base64 }
  throw new Error('Not implemented');
}

export async function submitTimeOut(
  capture: AttendanceCapture,
  timeInIso: string,
): Promise<{ record: AttendanceRecord; totalHours: number }> {
  if (USE_MOCK) {
    await delay(300);
    const outIso = capture.captureTimestamp;
    const ms = new Date(outIso).getTime() - new Date(timeInIso).getTime();
    const totalHours = Math.max(0, Math.round((ms / 3600000) * 10) / 10) || 8.5;
    return {
      record: {
        ...capture,
        displayTime: formatDisplayTime(outIso),
      },
      totalHours,
    };
  }
  // Future: POST /immersion/time-out
  throw new Error('Not implemented');
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
