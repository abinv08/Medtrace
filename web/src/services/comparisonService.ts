import { GoogleGenerativeAI } from '@google/generative-ai';
import { StoredReport } from './reportService';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ReportChange {
  parameter: string;
  previousValue: string;
  currentValue: string;
  trend: 'Increased' | 'Decreased' | 'Stable' | 'New' | 'Resolved' | 'Worsened' | 'Improved';
  significance: 'High' | 'Medium' | 'Low';
  note?: string;
}

export interface ReportComparisonResult {
  summary: string;
  changes: ReportChange[];
  clinicalSignificance: string;
  recurringAbnormalities: string[];
  newAbnormalities: string[];
  resolvedAbnormalities: string[];
  overallTrend: 'Improving' | 'Deteriorating' | 'Stable' | 'Mixed';
  disclaimer: string;
}

// ─── Compare two reports with AI ──────────────────────────────────────────────
export const compareReportsWithAI = async (
  reportA: StoredReport,  // older / previous report
  reportB: StoredReport,  // newer / current report
): Promise<ReportComparisonResult> => {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not configured.');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Build textual representation from stored AI analysis results
  const describeReport = (report: StoredReport, label: string): string => {
    if (!report.analysisResult) return `${label}: No AI analysis available for this report (${report.fileName}).`;

    const { overview, keyFindings, abnormalValues, urgencyLevel } = report.analysisResult;
    const abnormals = abnormalValues.map((v) => `${v.parameter}: ${v.value} (${v.note})`).join('; ');
    const findings = keyFindings.join('; ');

    return `
${label} — "${report.fileName}" (${report.reportType}, uploaded: ${report.uploadedAt?.slice(0, 10) || 'unknown'})
Urgency Level: ${urgencyLevel}
Overview: ${overview}
Key Findings: ${findings}
Abnormal Values: ${abnormals || 'None detected'}
    `.trim();
  };

  const prompt = `You are MedTrace AI, a clinical intelligence engine for longitudinal health analysis.
Compare the following two medical reports (A = older/previous, B = newer/current) for the same patient.

${describeReport(reportA, 'REPORT A (Previous)')}

${describeReport(reportB, 'REPORT B (Current)')}

Return ONLY valid JSON matching this exact structure:
{
  "summary": "2-3 sentence summary of what changed between the reports",
  "changes": [
    {
      "parameter": "Hemoglobin",
      "previousValue": "9.2 g/dL",
      "currentValue": "11.4 g/dL",
      "trend": "Increased",
      "significance": "High",
      "note": "Significant improvement, approaching normal range"
    }
  ],
  "clinicalSignificance": "Overall assessment of the most clinically important changes",
  "recurringAbnormalities": ["list of abnormalities present in both reports"],
  "newAbnormalities": ["list of new abnormalities that appeared in report B"],
  "resolvedAbnormalities": ["list of abnormalities from A that are absent in B"],
  "overallTrend": "Improving",
  "disclaimer": "This comparison is AI-generated for informational support only. Clinical decisions must be made by a qualified healthcare professional."
}

Rules:
- trend options: "Increased", "Decreased", "Stable", "New", "Resolved", "Worsened", "Improved"
- significance options: "High", "Medium", "Low"
- overallTrend: "Improving", "Deteriorating", "Stable", or "Mixed"
- If either report has no analysis data, note that clearly in the summary
- Extract as many comparable parameters as you can find
- Return ONLY the raw JSON object, no markdown fences`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    return JSON.parse(text) as ReportComparisonResult;
  } catch {
    // Fallback if JSON parsing fails
    return {
      summary: text.slice(0, 300),
      changes: [],
      clinicalSignificance: 'Unable to parse structured comparison. See summary above.',
      recurringAbnormalities: [],
      newAbnormalities: [],
      resolvedAbnormalities: [],
      overallTrend: 'Mixed',
      disclaimer: 'This is an AI-generated comparison for informational purposes only.',
    };
  }
};
