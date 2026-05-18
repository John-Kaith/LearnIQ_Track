import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  captureLocationMetadata,
  formatDisplayTime,
  getCaptureModeHint,
  getCaptureReadyHint,
  submitTimeIn,
  submitTimeOut,
} from '@/services/immersion';
import type {
  AttendanceCapture,
  AttendanceRecord,
  AttendanceSessionStatus,
  CaptureMode,
} from '@/types/immersion';

function formatDuration(ms: number): string {
  if (ms < 0) return '0:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function captureLivePhoto(): Promise<{ uri: string; base64?: string } | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is required. Immersion attendance uses live camera capture only.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.7,
    base64: true,
    cameraType: ImagePicker.CameraType.back,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  return { uri: asset.uri, base64: asset.base64 ?? undefined };
}

export function useImmersionAttendance() {
  const [sessionStatus, setSessionStatus] = useState<AttendanceSessionStatus>('idle');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('time_in');
  const [pendingCapture, setPendingCapture] = useState<AttendanceCapture | null>(null);
  const [timeIn, setTimeIn] = useState<AttendanceRecord | null>(null);
  const [timeOut, setTimeOut] = useState<AttendanceRecord | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [captureStatus, setCaptureStatus] = useState(getCaptureModeHint('time_in'));
  const [isCapturing, setIsCapturing] = useState(false);
  const [durationLabel, setDurationLabel] = useState('—');

  const refreshDuration = useCallback(() => {
    if (sessionStatus === 'completed' && timeIn && timeOut) {
      const ms =
        new Date(timeOut.captureTimestamp).getTime() -
        new Date(timeIn.captureTimestamp).getTime();
      setDurationLabel(`${formatDuration(ms)} total`);
      return;
    }
    if (sessionStatus === 'in_session' && timeIn) {
      const ms = Date.now() - new Date(timeIn.captureTimestamp).getTime();
      setDurationLabel(formatDuration(ms));
      return;
    }
    setDurationLabel('—');
  }, [sessionStatus, timeIn, timeOut]);

  useEffect(() => {
    refreshDuration();
    if (sessionStatus !== 'in_session' || !timeIn) return;
    const id = setInterval(refreshDuration, 1000);
    return () => clearInterval(id);
  }, [sessionStatus, timeIn, refreshDuration]);

  const takePhoto = useCallback(async () => {
    if (sessionStatus === 'completed') {
      Alert.alert('Session complete', 'You have already completed attendance for today (mock).');
      return;
    }
    if (captureMode === 'time_in' && timeIn) {
      Alert.alert('Already timed in', 'Take a new photo for Time Out.');
      return;
    }
    if (captureMode === 'time_out' && timeOut) {
      Alert.alert('Already timed out', 'Attendance is complete for today (mock).');
      return;
    }

    setIsCapturing(true);
    setCaptureStatus('Opening camera…');

    try {
      const photo = await captureLivePhoto();
      if (!photo) {
        setCaptureStatus(getCaptureModeHint(captureMode));
        return;
      }

      setCaptureStatus('Capturing GPS and timestamp…');
      const meta = await captureLocationMetadata();

      const capture: AttendanceCapture = {
        photoUri: photo.uri,
        photoBase64: photo.base64,
        latitude: meta.latitude,
        longitude: meta.longitude,
        readableLocationName: meta.readableLocationName,
        captureTimestamp: meta.captureTimestamp,
      };

      setPendingCapture(capture);
      setCaptureStatus(getCaptureReadyHint(captureMode));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not capture photo.';
      setCaptureStatus(message);
      Alert.alert('Capture failed', message);
    } finally {
      setIsCapturing(false);
    }
  }, [captureMode, sessionStatus, timeIn, timeOut]);

  const recordTimeIn = useCallback(async () => {
    if (!pendingCapture || captureMode !== 'time_in' || timeIn) return;

    try {
      const record = await submitTimeIn(pendingCapture);
      setTimeIn(record);
      setPendingCapture(null);
      setCaptureMode('time_out');
      setSessionStatus('in_session');
      setCaptureStatus(getCaptureModeHint('time_out'));
      Alert.alert('Time In Successful', `Recorded at ${record.displayTime} (mock).`);
    } catch (e) {
      Alert.alert('Time In failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [pendingCapture, captureMode, timeIn]);

  const recordTimeOut = useCallback(async () => {
    if (!pendingCapture || captureMode !== 'time_out' || !timeIn || timeOut) return;

    try {
      const { record, totalHours: hours } = await submitTimeOut(
        pendingCapture,
        timeIn.captureTimestamp,
      );
      setTimeOut(record);
      setTotalHours(hours);
      setPendingCapture(null);
      setSessionStatus('completed');
      setCaptureStatus('Attendance completed for today.');
      Alert.alert(
        'Time Out Successful',
        `Recorded at ${record.displayTime}. Total: ${hours.toFixed(1)} hrs (mock).`,
      );
    } catch (e) {
      Alert.alert('Time Out failed', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [pendingCapture, captureMode, timeIn, timeOut]);

  const statusLabel =
    sessionStatus === 'in_session'
      ? '🟢 In Session'
      : sessionStatus === 'completed'
        ? 'Completed'
        : 'Not started';

  const canTimeIn =
    Boolean(pendingCapture) && captureMode === 'time_in' && !timeIn && sessionStatus !== 'completed';
  const canTimeOut =
    Boolean(pendingCapture) &&
    captureMode === 'time_out' &&
    Boolean(timeIn) &&
    !timeOut &&
    sessionStatus === 'in_session';

  return {
    sessionStatus,
    captureMode,
    pendingCapture,
    timeIn,
    timeOut,
    totalHours,
    captureStatus,
    isCapturing,
    statusLabel,
    durationLabel,
    canTimeIn,
    canTimeOut,
    takePhoto,
    recordTimeIn,
    recordTimeOut,
    formatDisplayTime,
  };
}
