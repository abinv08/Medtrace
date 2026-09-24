import api from './api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getWorkingGenerativeModel } from './geminiService';

export interface ExerciseItem {
  _id?: string;
  id?: string;
  name: string;
  sets?: number;
  reps?: number;
  notes?: string;
  category?: 'Cardio' | 'Strength' | 'Flexibility & Mobility' | 'Breathing & Rehabilitation' | 'Balance' | string;
  durationMinutes?: number;
  frequency?: string;
  intensity?: 'Light' | 'Moderate' | 'Vigorous' | string;
  targetHeartRate?: string;
  instructions?: string;
  precautions?: string[];
  benefits?: string;
}

export interface ExerciseProgressLog {
  _id?: string;
  id?: string;
  date: string | Date;
  completed: boolean;
  notes?: string;
  activityName?: string;
  category?: string;
  durationMinutes?: number;
  caloriesBurned?: number;
  intensity?: string;
  averageHeartRate?: number;
}

export type ExerciseActivityLog = ExerciseProgressLog;

export interface ExercisePlan {
  _id?: string;
  id?: string;
  patientId: string;
  title?: string;
  weeklyTargetMinutes?: number;
  dailyGoalCalories?: number;
  conditionFocus?: string;
  frequency?: string;
  assignedBy?: {
    _id?: string;
    name?: string;
    email?: string;
    hospitalName?: string;
    department?: string;
  } | string;
  prescribedBy?: string;
  exercises: ExerciseItem[];
  routines?: ExerciseItem[];
  progressLog: ExerciseProgressLog[];
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Normalizes backend ExercisePlan data so both 'exercises' and 'routines',
 * and '_id' and 'id', can be accessed uniformly.
 */
export const normalizeExercisePlan = (rawPlan: any): ExercisePlan => {
  const exercises = rawPlan.exercises || rawPlan.routines || [];
  return {
    ...rawPlan,
    _id: rawPlan._id || rawPlan.id,
    id: rawPlan._id || rawPlan.id,
    title: rawPlan.title || 'Personalized Exercise Prescription',
    weeklyTargetMinutes: rawPlan.weeklyTargetMinutes || 150,
    dailyGoalCalories: rawPlan.dailyGoalCalories || 250,
    frequency: rawPlan.frequency || 'Custom Schedule',
    prescribedBy: typeof rawPlan.assignedBy === 'object' && rawPlan.assignedBy?.name
      ? rawPlan.assignedBy.name
      : (rawPlan.prescribedBy || 'Clinical Health Engine'),
    exercises,
    routines: exercises,
    progressLog: rawPlan.progressLog || [],
  };
};

/**
 * Fetch patient exercise plan from GET /api/exercise-plans/:patientId
 */
export const fetchPatientExercisePlan = async (patientId: string): Promise<ExercisePlan | null> => {
  try {
    const res = await api.get(`/api/exercise-plans/${patientId}`);
    if (res.data?.success && res.data?.exercisePlan) {
      return normalizeExercisePlan(res.data.exercisePlan);
    }
    return null;
  } catch (err: any) {
    if (err.response?.status !== 404) {
      console.warn('fetchPatientExercisePlan error:', err);
    }
    return null;
  }
};

/**
 * Create a new exercise plan via POST /api/exercise-plans
 */
export const createBackendExercisePlan = async (planData: {
  patientId: string;
  exercises: ExerciseItem[];
  frequency?: string;
  assignedBy?: string;
}): Promise<ExercisePlan | null> => {
  try {
    const res = await api.post('/api/exercise-plans', planData);
    if (res.data?.success && res.data?.exercisePlan) {
      return normalizeExercisePlan(res.data.exercisePlan);
    }
    return null;
  } catch (err) {
    console.error('createBackendExercisePlan error:', err);
    return null;
  }
};

/**
 * Log exercise progress via PUT /api/exercise-plans/:id/progress
 */
export const logExerciseProgress = async (
  planIdOrPatientId: string,
  progress: {
    date?: string | Date;
    completed?: boolean;
    notes?: string;
    activityName?: string;
    category?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
    intensity?: string;
    averageHeartRate?: number;
  }
): Promise<{ success: boolean; exercisePlan?: ExercisePlan; progressEntry?: ExerciseProgressLog }> => {
  const noteParts = [
    progress.activityName ? `Activity: ${progress.activityName}` : '',
    progress.category ? `Category: ${progress.category}` : '',
    progress.durationMinutes ? `Duration: ${progress.durationMinutes} min` : '',
    progress.caloriesBurned ? `Calories: ${progress.caloriesBurned} kcal` : '',
    progress.intensity ? `Intensity: ${progress.intensity}` : '',
    progress.averageHeartRate ? `Avg HR: ${progress.averageHeartRate} bpm` : '',
    progress.notes ? `Notes: ${progress.notes}` : '',
  ].filter(Boolean);

  const formattedNotes = progress.notes && !progress.activityName
    ? progress.notes
    : noteParts.join(' | ');

  const payload = {
    date: progress.date || new Date().toISOString(),
    completed: progress.completed !== undefined ? progress.completed : true,
    notes: formattedNotes,
  };

  const res = await api.put(`/api/exercise-plans/${planIdOrPatientId}/progress`, payload);
  if (res.data?.success) {
    const rawPlan = res.data.exercisePlan;
    return {
      success: true,
      exercisePlan: rawPlan ? normalizeExercisePlan(rawPlan) : undefined,
      progressEntry: res.data.progressEntry,
    };
  }
  return { success: false };
};

/**
 * Log exercise activity helper for backward compatibility
 */
export const logExerciseActivity = async (
  log: {
    patientId: string;
    date?: string;
    activityName: string;
    category?: any;
    durationMinutes?: number;
    caloriesBurned?: number;
    intensity?: any;
    averageHeartRate?: number;
    completed?: boolean;
    notes?: string;
  }
): Promise<ExerciseProgressLog> => {
  const res = await logExerciseProgress(log.patientId, log);
  return res.progressEntry || {
    date: log.date || new Date().toISOString(),
    completed: true,
    notes: log.notes,
  };
};

/**
 * Fetch exercise logs helper for backward compatibility
 */
export const fetchExerciseLogs = async (patientId: string): Promise<ExerciseProgressLog[]> => {
  const plan = await fetchPatientExercisePlan(patientId);
  return plan?.progressLog || [];
};

/**
 * Generate an AI exercise plan and persist it to the backend via POST /api/exercise-plans
 */
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

    const res = await getWorkingGenerativeModel(genAI, (model) =>
      model.generateContent(prompt)
    );
    const text = res.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const routines: ExerciseItem[] = parsed.routines || [];

      // Format exercises for Firestore storage.
      const exercisesForBackend: ExerciseItem[] = routines.map((r: any) => ({
        name: r.name,
        notes: [
          r.category ? `Category: ${r.category}` : '',
          r.durationMinutes ? `${r.durationMinutes} min` : '',
          r.frequency ? `${r.frequency}` : '',
          r.intensity ? `${r.intensity} intensity` : '',
          r.instructions ? `Instructions: ${r.instructions}` : '',
          r.benefits ? `Benefit: ${r.benefits}` : '',
        ].filter(Boolean).join(' | '),
      }));

      const createdPlan = await createBackendExercisePlan({
        patientId,
        frequency: parsed.weeklyTargetMinutes ? `${parsed.weeklyTargetMinutes} min/week` : '4-5 days/week',
        exercises: exercisesForBackend,
      });

      if (createdPlan) {
        return {
          ...createdPlan,
          title: parsed.title || createdPlan.title || 'AI Personalized Fitness Prescription',
          weeklyTargetMinutes: parsed.weeklyTargetMinutes || 150,
          dailyGoalCalories: parsed.dailyGoalCalories || 250,
          conditionFocus: parsed.conditionFocus || patientData.chronicConditions || 'General Wellness',
          prescribedBy: 'MedTrace AI Clinical Physiology Engine',
          routines,
        };
      }
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
