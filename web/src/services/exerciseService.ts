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
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExerciseItem {
  id: string;
  name: string;
  category: 'Cardio' | 'Strength' | 'Flexibility & Mobility' | 'Breathing & Rehabilitation' | 'Balance';
  durationMinutes: number;
  frequency: string;
  intensity: 'Light' | 'Moderate' | 'Vigorous';
  targetHeartRate?: string;
  instructions: string;
  precautions: string[];
  benefits: string;
}

export interface ExercisePlan {
  id: string;
  patientId: string;
  title: string;
  weeklyTargetMinutes: number;
  dailyGoalCalories: number;
  conditionFocus?: string;
  routines: ExerciseItem[];
  prescribedBy?: string; // 'AI Health Engine' | doctor name
  createdAt?: any;
}

export interface ExerciseActivityLog {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  activityName: string;
  category: 'Cardio' | 'Strength' | 'Flexibility & Mobility' | 'Breathing & Rehabilitation' | 'Balance';
  durationMinutes: number;
  caloriesBurned: number;
  intensity: 'Light' | 'Moderate' | 'Vigorous';
  averageHeartRate?: number;
  completed: boolean;
  notes?: string;
  loggedAt?: string;
}

const DEFAULT_EXERCISE_PLAN: ExercisePlan = {
  id: 'plan-1',
  patientId: 'default',
  title: 'Cardio-Metabolic Wellness & Vitality Routine',
  weeklyTargetMinutes: 150,
  dailyGoalCalories: 250,
  conditionFocus: 'Hypertension & Glycemic Management',
  prescribedBy: 'MedTrace AI Clinical Health Engine',
  routines: [
    {
      id: 'ex-1',
      name: 'Brisk Walking / Interval Striding',
      category: 'Cardio',
      durationMinutes: 30,
      frequency: '5 days/week',
      intensity: 'Moderate',
      targetHeartRate: '105 - 125 bpm',
      instructions: 'Walk at a steady, brisk pace on flat or gently inclined terrain. Keep arms swinging naturally and shoulders relaxed.',
      precautions: ['Stay hydrated', 'Stop if feeling dizzy or chest pressure', 'Wear supportive athletic footwear'],
      benefits: 'Lowers systolic BP by 4-9 mmHg and enhances peripheral insulin sensitivity.',
    },
    {
      id: 'ex-2',
      name: 'Low-Impact Bodyweight Resistance & Squats',
      category: 'Strength',
      durationMinutes: 20,
      frequency: '3 days/week',
      intensity: 'Moderate',
      instructions: 'Perform chair squats, wall push-ups, and calf raises. 2 sets of 10–12 repetitions with 60s rest between sets.',
      precautions: ['Avoid holding breath (Valsalva maneuver)', 'Maintain upright posture'],
      benefits: 'Preserves lean muscle mass and enhances glucose uptake.',
    },
    {
      id: 'ex-3',
      name: 'Diaphragmatic Breathing & Postural Mobility',
      category: 'Breathing & Rehabilitation',
      durationMinutes: 15,
      frequency: 'Daily',
      intensity: 'Light',
      instructions: 'Lie or sit comfortably. Inhale slowly through nose for 4 counts, hold for 2, exhale through mouth for 6 counts.',
      precautions: ['Do not strain', 'Perform in a calm, well-ventilated space'],
      benefits: 'Downregulates sympathetic nervous tone and eases stress-induced blood pressure spikes.',
    },
  ],
};

const DEFAULT_ACTIVITY_LOGS: ExerciseActivityLog[] = [
  {
    id: 'log-1',
    patientId: 'default',
    date: new Date().toISOString().split('T')[0],
    activityName: 'Morning Brisk Walk in Park',
    category: 'Cardio',
    durationMinutes: 30,
    caloriesBurned: 145,
    intensity: 'Moderate',
    averageHeartRate: 112,
    completed: true,
    notes: 'Felt energized, morning weather was pleasant.',
  },
  {
    id: 'log-2',
    patientId: 'default',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    activityName: 'Wall Pushups & Chair Squats',
    category: 'Strength',
    durationMinutes: 20,
    caloriesBurned: 95,
    intensity: 'Moderate',
    averageHeartRate: 104,
    completed: true,
    notes: '2 sets completed comfortably.',
  },
  {
    id: 'log-3',
    patientId: 'default',
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    activityName: 'Evening Pranayama & Gentle Stretch',
    category: 'Breathing & Rehabilitation',
    durationMinutes: 15,
    caloriesBurned: 40,
    intensity: 'Light',
    averageHeartRate: 74,
    completed: true,
  },
];

const LOCAL_PLANS: Record<string, ExercisePlan> = {};
const LOCAL_EX_LOGS: Record<string, ExerciseActivityLog[]> = {};

export const fetchPatientExercisePlan = async (patientId: string): Promise<ExercisePlan> => {
  try {
    const q = query(
      collection(db, 'exercisePlans'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!LOCAL_PLANS[patientId]) {
        LOCAL_PLANS[patientId] = { ...DEFAULT_PLAN_FOR_USER(patientId) };
      }
      return LOCAL_PLANS[patientId];
    }
    return snap.docs[0].data() as ExercisePlan;
  } catch {
    if (!LOCAL_PLANS[patientId]) {
      LOCAL_PLANS[patientId] = { ...DEFAULT_PLAN_FOR_USER(patientId) };
    }
    return LOCAL_PLANS[patientId];
  }
};

const DEFAULT_PLAN_FOR_USER = (patientId: string): ExercisePlan => ({
  ...DEFAULT_EXERCISE_PLAN,
  patientId,
});

export const logExerciseActivity = async (
  log: Omit<ExerciseActivityLog, 'id' | 'loggedAt'>
): Promise<ExerciseActivityLog> => {
  const id = `exlog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newLog: ExerciseActivityLog = {
    ...log,
    id,
    loggedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'exerciseLogs', id), {
      ...newLog,
      loggedAt: serverTimestamp(),
    });
  } catch {
    if (!LOCAL_EX_LOGS[log.patientId]) {
      LOCAL_EX_LOGS[log.patientId] = [...DEFAULT_ACTIVITY_LOGS.map((l) => ({ ...l, patientId: log.patientId }))];
    }
    LOCAL_EX_LOGS[log.patientId].unshift(newLog);
  }

  return newLog;
};

export const fetchExerciseLogs = async (patientId: string): Promise<ExerciseActivityLog[]> => {
  try {
    const q = query(
      collection(db, 'exerciseLogs'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      if (!LOCAL_EX_LOGS[patientId]) {
        LOCAL_EX_LOGS[patientId] = DEFAULT_ACTIVITY_LOGS.map((l) => ({ ...l, patientId }));
      }
      return LOCAL_EX_LOGS[patientId];
    }
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExerciseActivityLog));
    LOCAL_EX_LOGS[patientId] = list;
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    if (!LOCAL_EX_LOGS[patientId]) {
      LOCAL_EX_LOGS[patientId] = DEFAULT_ACTIVITY_LOGS.map((l) => ({ ...l, patientId }));
    }
    return LOCAL_EX_LOGS[patientId];
  }
};

export const generateAIExercisePlan = async (
  patientId: string,
  patientData: {
    name?: string;
    age?: number;
    chronicConditions?: string;
    bloodPressure?: string;
    allergies?: string;
  }
): Promise<ExercisePlan> => {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) {
    return DEFAULT_PLAN_FOR_USER(patientId);
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a clinical physical rehabilitation and exercise physiology specialist.
Generate a safe, personalized exercise and wellness prescription in JSON format for this patient:
Name: ${patientData.name || 'Patient'}
Health Conditions: ${patientData.chronicConditions || 'Hypertension, Borderline High Glucose'}
Current BP: ${patientData.bloodPressure || '135/85 mmHg'}

Output ONLY valid JSON with this structure:
{
  "title": "Clinical title",
  "weeklyTargetMinutes": 150,
  "dailyGoalCalories": 250,
  "conditionFocus": "Focus area",
  "routines": [
    {
      "id": "ex-ai-1",
      "name": "Exercise Name",
      "category": "Cardio",
      "durationMinutes": 30,
      "frequency": "4 days/week",
      "intensity": "Moderate",
      "targetHeartRate": "100-120 bpm",
      "instructions": "Step-by-step guidance",
      "precautions": ["Precaution 1", "Precaution 2"],
      "benefits": "Clinical benefit explanation"
    }
  ]
}`;

    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const generatedPlan: ExercisePlan = {
        id: `plan-ai-${Date.now()}`,
        patientId,
        title: parsed.title || 'AI Personalized Fitness Prescription',
        weeklyTargetMinutes: parsed.weeklyTargetMinutes || 150,
        dailyGoalCalories: parsed.dailyGoalCalories || 250,
        conditionFocus: parsed.conditionFocus || patientData.chronicConditions || 'General Wellness',
        prescribedBy: 'MedTrace AI Clinical Physiology Engine',
        routines: parsed.routines || DEFAULT_EXERCISE_PLAN.routines,
        createdAt: new Date().toISOString(),
      };
      LOCAL_PLANS[patientId] = generatedPlan;
      return generatedPlan;
    }
  } catch (err) {
    console.warn('generateAIExercisePlan error, using default:', err);
  }

  return DEFAULT_PLAN_FOR_USER(patientId);
};
