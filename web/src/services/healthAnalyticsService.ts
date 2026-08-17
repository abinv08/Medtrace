import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './notificationService';

export interface VitalReading {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  heartRate: number; // bpm
  glucoseFasting?: number; // mg/dL
  glucosePostPrandial?: number; // mg/dL
  spO2?: number; // %
  respiratoryRate?: number; // breaths/min
  weightKg?: number; // kg
  bmi?: number;
  cholesterolTotal?: number; // mg/dL
  notes?: string;
  source: 'manual' | 'iot_monitor' | 'csi_sensor' | 'lab';
}

export interface AnomalyAlert {
  id: string;
  metric: 'Blood Pressure' | 'Blood Glucose' | 'Heart Rate' | 'Oxygen Saturation' | 'Respiratory Rate';
  severity: 'critical' | 'high' | 'moderate';
  detectedValue: string;
  baselineValue: string;
  standardDeviations: number;
  title: string;
  description: string;
  clinicalAction: string;
  timestamp: string;
}

export interface MetricBaseline {
  metric: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  normalRange: [number, number];
  unit: string;
}

// Generate realistic 30-day longitudinal trend data
const generateMockVitals = (patientId: string): VitalReading[] => {
  const readings: VitalReading[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];

    // Base values with slight natural variance
    const sysVariation = Math.sin(i / 3) * 6 + (Math.random() * 8 - 4);
    const diaVariation = Math.sin(i / 3) * 4 + (Math.random() * 6 - 3);
    const hrVariation = Math.cos(i / 2) * 5 + (Math.random() * 8 - 4);
    const gluVariation = Math.sin(i / 4) * 8 + (Math.random() * 10 - 5);

    // On day 2, add a mild spike for anomaly demonstration
    const isSpikeDay = i === 2;

    readings.push({
      id: `vital-mock-${i}`,
      patientId,
      date: dateStr,
      time: '08:30',
      systolicBP: isSpikeDay ? 156 : Math.round(124 + sysVariation),
      diastolicBP: isSpikeDay ? 98 : Math.round(82 + diaVariation),
      heartRate: isSpikeDay ? 94 : Math.round(72 + hrVariation),
      glucoseFasting: Math.round(102 + gluVariation),
      glucosePostPrandial: Math.round(138 + gluVariation * 1.3),
      spO2: Math.min(100, Math.round(98 + (Math.random() * 2 - 1))),
      respiratoryRate: Math.round(16 + (Math.random() * 2 - 1)),
      weightKg: Number((76.5 - (29 - i) * 0.04).toFixed(1)),
      bmi: Number(((76.5 - (29 - i) * 0.04) / (1.75 * 1.75)).toFixed(1)),
      cholesterolTotal: Math.round(205 + Math.sin(i / 6) * 10),
      source: i % 3 === 0 ? 'csi_sensor' : 'manual',
    });
  }

  return readings;
};

const LOCAL_VITALS: Record<string, VitalReading[]> = {};

export const fetchPatientVitals = async (patientId: string): Promise<VitalReading[]> => {
  try {
    const q = query(
      collection(db, 'vitals'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!LOCAL_VITALS[patientId]) {
        LOCAL_VITALS[patientId] = generateMockVitals(patientId);
      }
      return LOCAL_VITALS[patientId];
    }
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VitalReading));
    LOCAL_VITALS[patientId] = list;
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch {
    if (!LOCAL_VITALS[patientId]) {
      LOCAL_VITALS[patientId] = generateMockVitals(patientId);
    }
    return LOCAL_VITALS[patientId];
  }
};

export const addVitalReading = async (
  reading: Omit<VitalReading, 'id'>
): Promise<{ reading: VitalReading; anomalies: AnomalyAlert[] }> => {
  const id = `vital-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newReading: VitalReading = {
    ...reading,
    id,
  };

  try {
    await setDoc(doc(db, 'vitals', id), {
      ...newReading,
      createdAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_VITALS[reading.patientId]) {
      LOCAL_VITALS[reading.patientId] = generateMockVitals(reading.patientId);
    }
    LOCAL_VITALS[reading.patientId].push(newReading);
  }

  // Calculate anomalies against historical baseline
  const historical = await fetchPatientVitals(reading.patientId);
  const anomalies = detectAnomalies(newReading, historical);

  if (anomalies.length > 0) {
    for (const anom of anomalies) {
      await createNotification({
        userId: reading.patientId,
        title: `Health Alert: ${anom.title}`,
        message: `${anom.description} ${anom.clinicalAction}`,
        category: 'anomaly',
        priority: anom.severity === 'critical' ? 'urgent' : 'high',
      });
    }
  }

  return { reading: newReading, anomalies };
};

// ─── Anomaly Detection Engine ────────────────────────────────────────────────
export const detectAnomalies = (
  current: VitalReading,
  history: VitalReading[]
): AnomalyAlert[] => {
  const alerts: AnomalyAlert[] = [];
  const nowStr = new Date().toISOString();

  // 1. Calculate Baselines for key metrics from history (excluding current)
  const priorReadings = history.filter((h) => h.id !== current.id);
  const computeStats = (vals: number[]) => {
    if (vals.length === 0) return { mean: 0, stdDev: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
    return { mean: Math.round(mean * 10) / 10, stdDev: Math.round(Math.sqrt(variance) * 10) / 10 };
  };

  const sysStats = computeStats(priorReadings.map((r) => r.systolicBP).filter(Boolean));
  const diaStats = computeStats(priorReadings.map((r) => r.diastolicBP).filter(Boolean));
  const hrStats = computeStats(priorReadings.map((r) => r.heartRate).filter(Boolean));
  const gluStats = computeStats(priorReadings.map((r) => r.glucoseFasting || 0).filter((v) => v > 0));

  // Check Blood Pressure
  if (current.systolicBP >= 180 || current.diastolicBP >= 120) {
    alerts.push({
      id: `anom-bp-crit-${Date.now()}`,
      metric: 'Blood Pressure',
      severity: 'critical',
      detectedValue: `${current.systolicBP}/${current.diastolicBP} mmHg`,
      baselineValue: `${sysStats.mean}/${diaStats.mean} mmHg`,
      standardDeviations: sysStats.stdDev > 0 ? Number(((current.systolicBP - sysStats.mean) / sysStats.stdDev).toFixed(1)) : 3.5,
      title: 'Hypertensive Crisis Threshold Exceeded',
      description: `Blood pressure reading of ${current.systolicBP}/${current.diastolicBP} mmHg is severely elevated above your baseline.`,
      clinicalAction: 'Rest immediately in a quiet area. Contact emergency clinical response or your physician right away if accompanied by chest pain or shortness of breath.',
      timestamp: nowStr,
    });
  } else if (current.systolicBP >= 145 || current.diastolicBP >= 92) {
    const sds = sysStats.stdDev > 0 ? Number(((current.systolicBP - sysStats.mean) / sysStats.stdDev).toFixed(1)) : 2.1;
    alerts.push({
      id: `anom-bp-high-${Date.now()}`,
      metric: 'Blood Pressure',
      severity: 'high',
      detectedValue: `${current.systolicBP}/${current.diastolicBP} mmHg`,
      baselineValue: `${sysStats.mean}/${diaStats.mean} mmHg`,
      standardDeviations: sds,
      title: 'Elevated Blood Pressure Spike',
      description: `Systolic BP (${current.systolicBP} mmHg) is +${Math.round(current.systolicBP - sysStats.mean)} mmHg above your 30-day baseline.`,
      clinicalAction: 'Retake measurement after 10 minutes of resting. Confirm medication adherence and reduce sodium intake.',
      timestamp: nowStr,
    });
  }

  // Check Glucose
  if (current.glucoseFasting && current.glucoseFasting < 70) {
    alerts.push({
      id: `anom-glu-low-${Date.now()}`,
      metric: 'Blood Glucose',
      severity: 'critical',
      detectedValue: `${current.glucoseFasting} mg/dL`,
      baselineValue: `${gluStats.mean} mg/dL`,
      standardDeviations: -2.8,
      title: 'Hypoglycemia Alert (Low Glucose)',
      description: `Blood glucose has dropped to ${current.glucoseFasting} mg/dL.`,
      clinicalAction: 'Consume 15g of fast-acting carbohydrates (e.g. 4oz fruit juice, glucose tablets) immediately. Recheck in 15 minutes.',
      timestamp: nowStr,
    });
  } else if (current.glucoseFasting && current.glucoseFasting > 180) {
    alerts.push({
      id: `anom-glu-high-${Date.now()}`,
      metric: 'Blood Glucose',
      severity: 'high',
      detectedValue: `${current.glucoseFasting} mg/dL`,
      baselineValue: `${gluStats.mean} mg/dL`,
      standardDeviations: 2.4,
      title: 'Hyperglycemia Spike',
      description: `Fasting blood glucose is elevated at ${current.glucoseFasting} mg/dL.`,
      clinicalAction: 'Stay hydrated with water. Verify insulin or oral antidiabetic dosage. Report persistent levels to your endocrinologist.',
      timestamp: nowStr,
    });
  }

  // Check Heart Rate
  if (current.heartRate > 110) {
    alerts.push({
      id: `anom-hr-high-${Date.now()}`,
      metric: 'Heart Rate',
      severity: 'high',
      detectedValue: `${current.heartRate} bpm`,
      baselineValue: `${hrStats.mean} bpm`,
      standardDeviations: 2.3,
      title: 'Resting Tachycardia (Elevated Pulse)',
      description: `Resting heart rate of ${current.heartRate} bpm exceeds normal bounds.`,
      clinicalAction: 'Sit calmly and practice slow diaphragmatic breathing. Avoid caffeine and stimulants.',
      timestamp: nowStr,
    });
  }

  // Check SpO2
  if (current.spO2 && current.spO2 < 93) {
    alerts.push({
      id: `anom-spo2-low-${Date.now()}`,
      metric: 'Oxygen Saturation',
      severity: 'critical',
      detectedValue: `${current.spO2}%`,
      baselineValue: `98%`,
      standardDeviations: -3.2,
      title: 'Hypoxemia / Low Blood Oxygen',
      description: `SpO2 reading of ${current.spO2}% is below the safe clinical threshold.`,
      clinicalAction: 'Sit upright, inhale deeply, and seek urgent clinical evaluation if persistent.',
      timestamp: nowStr,
    });
  }

  return alerts;
};

export const getBaselineStatistics = (history: VitalReading[]): MetricBaseline[] => {
  const getStats = (vals: number[]) => {
    if (vals.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
    return {
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  };

  const sys = getStats(history.map((r) => r.systolicBP).filter(Boolean));
  const dia = getStats(history.map((r) => r.diastolicBP).filter(Boolean));
  const hr = getStats(history.map((r) => r.heartRate).filter(Boolean));
  const glu = getStats(history.map((r) => r.glucoseFasting || 0).filter((v) => v > 0));
  const spo2 = getStats(history.map((r) => r.spO2 || 0).filter((v) => v > 0));

  return [
    { metric: 'Systolic Blood Pressure', mean: sys.mean, stdDev: sys.stdDev, min: sys.min, max: sys.max, normalRange: [90, 120], unit: 'mmHg' },
    { metric: 'Diastolic Blood Pressure', mean: dia.mean, stdDev: dia.stdDev, min: dia.min, max: dia.max, normalRange: [60, 80], unit: 'mmHg' },
    { metric: 'Resting Heart Rate', mean: hr.mean, stdDev: hr.stdDev, min: hr.min, max: hr.max, normalRange: [60, 100], unit: 'bpm' },
    { metric: 'Fasting Blood Glucose', mean: glu.mean, stdDev: glu.stdDev, min: glu.min, max: glu.max, normalRange: [70, 99], unit: 'mg/dL' },
    { metric: 'Oxygen Saturation (SpO2)', mean: spo2.mean, stdDev: spo2.stdDev, min: spo2.min, max: spo2.max, normalRange: [95, 100], unit: '%' },
  ];
};
