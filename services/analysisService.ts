import type { PDFData } from '@/types/reports';

const SYSTEM_PROMPT = `You are an expert data analyst specializing in location intelligence and demographic analysis. 
Your task is to analyze the provided data and create a comprehensive report that includes:
1. Key insights and patterns
2. Demographic trends and characteristics
3. Market opportunities and challenges
4. Actionable recommendations

Format your response in markdown with clear sections and bullet points where appropriate.`;

export async function generateAnalysis(pdfData: PDFData) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemPrompt: SYSTEM_PROMPT,
      data: pdfData,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate analysis');
  }

  return await response.json();
}