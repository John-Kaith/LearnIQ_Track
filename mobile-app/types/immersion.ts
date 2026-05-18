export type AttendanceSessionStatus = 'idle' | 'in_session' | 'completed';

export type CaptureMode = 'time_in' | 'time_out';

export type AttendanceCapture = {
  photoUri: string;
  photoBase64?: string;
  latitude: number;
  longitude: number;
  readableLocationName: string;
  captureTimestamp: string;
};

export type AttendanceRecord = AttendanceCapture & {
  displayTime: string;
};

export type TodayAttendanceState = {
  status: AttendanceSessionStatus;
  captureMode: CaptureMode;
  pendingCapture: AttendanceCapture | null;
  timeIn: AttendanceRecord | null;
  timeOut: AttendanceRecord | null;
  totalHours: number;
  durationLabel: string;
};
