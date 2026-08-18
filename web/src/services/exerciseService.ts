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

export const fetchPatientExercisePlan = async (patientId: string): Promise<ExercisePlan | null> => {
  try {
    const q = query(
      collection(db, 'exercisePlans'),
      where('patientId', '==', patientId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return LOCAL_PLANS[patientId] || null;
    }
    return snap.docs[0].data() as ExercisePlan;
  } catch {
    return LOCAL_PLANS[patientId] || null;
  }
};

// Removed: DEFAULT_PLAN_FOR_USER — no longer used

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
      LOCAL_EX_LOGS[log.patientId] = [];
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
      return LOCAL_EX_LOGS[patientId] || [];
    }
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExerciseActivityLog));
    LOCAL_EX_LOGS[patientId] = list;
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return LOCAL_EX_LOGS[patientId] || [];
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
): Promise<ExercisePlan | null> => {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a clinical physical rehabilitation and exercise physiology specialist.
Generate a safe, personalized exercise and wellness prescription in JSON format for this patient:
Name: ${patientData.name || 'Patient'}
Health Conditions: ${patientData.chronicConditions || 'General Wellness'}
Current BP: ${patientData.bloodPressure || 'Not provided'}

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
        routines: parsed.routines || [],
        createdAt: new Date().toISOString(),
      };
      LOCAL_PLANS[patientId] = generatedPlan;
      return generatedPlan;
    }
  } catch (err) {
    console.warn('generateAIExercisePlan error:', err);
  }

  return null;
};

// ─── Vitals-Based Exercise Suggestion Engine ───────────────────────────────────
export interface VitalsSuggestion {
  id: string;
  title: string;
  category: ExerciseItem['category'];
  intensity: ExerciseItem['intensity'];
  duration: string;
  frequency: string;
  reason: string;
  benefit: string;
  precautions: string[];
  icon: 'cardio' | 'strength' | 'breathing' | 'flexibility' | 'balance';
}

export const generateVitalsBasedSuggestions = (
  vitals: Array<{
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    glucoseFasting?: number;
    spO2?: number;
    bmi?: number;
  }>
): VitalsSuggestion[] => {
  if (vitals.length === 0) return [];

  const suggestions: VitalsSuggestion[] = [];

  const avg = (arr: (number | undefined)[]) => {
    const valid = arr.filter((v): v is number => v !== undefined && v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : undefined;
  };

  const avgSys = avg(vitals.map((v) => v.systolicBP));
  const avgGlu = avg(vitals.map((v) => v.glucoseFasting));
  const avgHR = avg(vitals.map((v) => v.heartRate));
  const avgSpO2 = avg(vitals.map((v) => v.spO2));
  const avgBmi = avg(vitals.map((v) => v.bmi));

  // 1. Blood Pressure-based suggestions
  if (avgSys !== undefined && avgSys >= 130) {
    suggestions.push({
      id: 'sug-bp-walk',
      title: 'Brisk Walking (BP Management)',
      category: 'Cardio',
      intensity: 'Moderate',
      duration: '25-30 min',
      frequency: '5 days/week',
      reason: `Your average systolic BP is ${Math.round(avgSys)} mmHg (elevated). Regular aerobic walking is proven to reduce systolic BP by 4–9 mmHg over 4–12 weeks.`,
      benefit: 'Reduces systolic BP, improves vascular tone, lowers cardiovascular risk.',
      precautions: ['Monitor BP before and after', 'Stop if dizzy or chest pain', 'Stay hydrated'],
      icon: 'cardio',
    });
    suggestions.push({
      id: 'sug-bp-breath',
      title: 'Slow Diaphragmatic Breathing',
      category: 'Breathing & Rehabilitation',
      intensity: 'Light',
      duration: '10-15 min',
      frequency: 'Daily',
      reason: 'Slow paced breathing (6 breaths/min) activates the parasympathetic system and acutely lowers blood pressure.',
      benefit: 'Reduces sympathetic nervous tone, lowers BP, improves HRV.',
      precautions: ['Sit comfortably', 'Avoid straining', 'Quiet, well-ventilated space'],
      icon: 'breathing',
    });
  } else if (avgSys !== undefined && avgSys < 110) {
    suggestions.push({
      id: 'sug-bp-low',
      title: 'Gentle Seated Stretching & Mobility',
      category: 'Flexibility & Mobility',
      intensity: 'Light',
      duration: '15 min',
      frequency: '3-4 days/week',
      reason: `Your BP tends to run low (avg ${Math.round(avgSys)} mmHg). Light flexibility work is safe and avoids orthostatic hypotension risk.`,
      benefit: 'Maintains joint mobility without blood pressure drops.',
      precautions: ['Rise slowly from seated/lying positions', 'Avoid sudden posture changes', 'Stay hydrated'],
      icon: 'flexibility',
    });
  } else {
    suggestions.push({
      id: 'sug-bp-normal-cardio',
      title: 'Moderate Intensity Cardio',
      category: 'Cardio',
      intensity: 'Moderate',
      duration: '30-40 min',
      frequency: '4-5 days/week',
      reason: 'Your blood pressure is in a healthy range — build on this with regular aerobic activity for long-term heart health.',
      benefit: 'Maintains healthy cardiovascular function, boosts endurance and mood.',
      precautions: ['Warm up for 5 min', 'Cool down gradually'],
      icon: 'cardio',
    });
  }

  // 2. Blood Glucose-based suggestions
  if (avgGlu !== undefined && avgGlu >= 100) {
    suggestions.push({
      id: 'sug-glu-walk',
      title: 'Post-Meal Walking (Glucose Control)',
      category: 'Cardio',
      intensity: 'Light',
      duration: '10-15 min after each meal',
      frequency: 'Daily (3x/day)',
      reason: `Your fasting glucose averages ${Math.round(avgGlu)} mg/dL (pre-diabetic range). A 10–15 min post-meal walk reduces post-prandial glucose spike by up to 22%.`,
      benefit: 'Improves glucose uptake, reduces insulin resistance, lowers HbA1c over time.',
      precautions: ['Start within 30 min of finishing meal', 'Carry glucose tablets if hypoglycemia-prone'],
      icon: 'cardio',
    });
    suggestions.push({
      id: 'sug-glu-strength',
      title: 'Bodyweight Resistance Training',
      category: 'Strength',
      intensity: 'Moderate',
      duration: '20 min',
      frequency: '3 days/week',
      reason: 'Muscle contractions during resistance exercise act like a glucose sink — consuming blood sugar without requiring insulin.',
      benefit: 'Increases muscle glucose uptake, preserves lean mass, improves insulin sensitivity.',
      precautions: ['Avoid Valsalva maneuver (breath-holding)', 'Check glucose before exercise if on insulin'],
      icon: 'strength',
    });
  }

  // 3. Heart Rate-based suggestions
  if (avgHR !== undefined && avgHR >= 90) {
    suggestions.push({
      id: 'sug-hr-yoga',
      title: 'Yoga & Mind-Body Conditioning',
      category: 'Flexibility & Mobility',
      intensity: 'Light',
      duration: '20-30 min',
      frequency: '4-5 days/week',
      reason: `Your resting heart rate averages ${Math.round(avgHR)} bpm (elevated). Yoga and mind-body practices are clinically shown to reduce resting HR by 5-10 bpm.`,
      benefit: 'Lowers resting HR, reduces cortisol, improves heart rate variability.',
      precautions: ['Avoid hot yoga', 'Use slow, controlled movements'],
      icon: 'flexibility',
    });
  } else if (avgHR !== undefined && avgHR <= 55) {
    suggestions.push({
      id: 'sug-hr-balance',
      title: 'Balance & Proprioception Training',
      category: 'Balance',
      intensity: 'Light',
      duration: '15 min',
      frequency: '3 days/week',
      reason: `Your resting HR is ${Math.round(avgHR)} bpm (athletic range). Complement cardio fitness with balance and coordination work.`,
      benefit: 'Improves neuromuscular coordination, reduces fall risk.',
      precautions: ['Use a wall or chair for support initially'],
      icon: 'balance',
    });
  }

  // 4. SpO2-based suggestions
  if (avgSpO2 !== undefined && avgSpO2 < 96) {
    suggestions.push({
      id: 'sug-spo2-breath',
      title: 'Breathing Rehabilitation Exercises',
      category: 'Breathing & Rehabilitation',
      intensity: 'Light',
      duration: '15-20 min',
      frequency: 'Daily',
      reason: `Your average SpO2 is ${Math.round(avgSpO2)}% (below optimal). Pursed-lip breathing and diaphragmatic training improve oxygen efficiency.`,
      benefit: 'Improves lung capacity, oxygen saturation, and reduces breathing effort.',
      precautions: ['Stop if SpO2 drops below 90%', 'Consult doctor if readings remain low', 'Avoid vigorous exercise until cleared'],
      icon: 'breathing',
    });
  }

  // 5. BMI-based suggestion
  if (avgBmi !== undefined && avgBmi >= 25) {
    suggestions.push({
      id: 'sug-bmi-cardio',
      title: 'Low-Impact Cardio (Weight Management)',
      category: 'Cardio',
      intensity: 'Moderate',
      duration: '30-45 min',
      frequency: '5 days/week',
      reason: `Your BMI is ${avgBmi.toFixed(1)} — low-impact cardio (swimming, cycling, walking) burns calories while protecting joints.`,
      benefit: 'Supports healthy weight, reduces metabolic syndrome risk, improves mood.',
      precautions: ['Wear supportive footwear', 'Avoid high-impact running on hard surfaces'],
      icon: 'cardio',
    });
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
};
