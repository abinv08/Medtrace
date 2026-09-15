import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Gemini client (key from env) ─────────────────────────────────────────────
const getClient = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set in your .env file.');
  return new GoogleGenerativeAI(key);
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReportSummary {
  overview: string;
  keyFindings: string[];
  abnormalValues: { parameter: string; value: string; note: string }[];
  recommendations: string[];
  urgencyLevel: 'Normal' | 'Monitor' | 'Urgent';
  disclaimer: string;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are MedTrace AI, a clinical intelligence assistant. 
Analyze the uploaded medical report (lab test, radiology, discharge summary, or prescription) and return a structured JSON response.

Return ONLY valid JSON in exactly this shape:
{
  "overview": "2-3 sentence plain-English summary of what this report is about",
  "keyFindings": ["finding 1", "finding 2", "...up to 6 key findings"],
  "abnormalValues": [
    { "parameter": "Hemoglobin", "value": "9.2 g/dL", "note": "Below normal range (12-16 g/dL)" }
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "...up to 4 actionable suggestions"],
  "urgencyLevel": "Normal" | "Monitor" | "Urgent",
  "disclaimer": "This is an AI-generated summary for informational purposes only. Always consult a qualified healthcare professional for medical decisions."
}

Rules:
- urgencyLevel = "Urgent" if there are life-threatening values, "Monitor" if there are mild abnormalities, "Normal" if all values are within range.
- If the document is not a medical report, set overview to explain that and return empty arrays.
- Do not include markdown code fences in your response.
- Return only the raw JSON object.`;

// ─── Convert File to base64 inline data ───────────────────────────────────────
const fileToGenerativePart = (
  base64Data: string,
  mimeType: string
): { inlineData: { data: string; mimeType: string } } => ({
  inlineData: { data: base64Data, mimeType },
});

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (data:...;base64,)
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── Generative AI Helper with Fallbacks ──────────────────────────────────────
export async function getWorkingGenerativeModel<T>(
  genAI: GoogleGenerativeAI,
  execute: (model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>) => Promise<T>
): Promise<T> {
  const primaryModel = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.6-flash';
  const modelsToTry = [
    primaryModel,        // gemini-3.6-flash (stable, current default)
    'gemini-3.5-flash',  // prior stable gen, still fully supported
    'gemini-3.1-flash-lite', // lighter/cheaper stable fallback
  ].filter((m, i, self) => self.indexOf(m) === i);

  let lastError: any;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await execute(model);
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${modelName} failed, trying fallback:`, err?.message || err);
    }
  }
  throw lastError;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export const analyzeReport = async (file: File): Promise<ReportSummary> => {
  const genAI = getClient();
  const base64 = await readFileAsBase64(file);
  const mimeType = file.type as string;

  const result = await getWorkingGenerativeModel(genAI, (model) =>
    model.generateContent([
      SYSTEM_PROMPT,
      fileToGenerativePart(base64, mimeType),
    ])
  );

  const text = result.response.text().trim();

  try {
    return JSON.parse(text) as ReportSummary;
  } catch {
    throw new Error('AI returned an unexpected format. Please try again.');
  }
};
