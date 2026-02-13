import { AnalysisServiceRequest } from '@/lib/analytics/types';
import { FIELD_ALIASES } from '@/utils/field-aliases';

export const ALLOWED_ANALYSIS_TYPES = [
  'jointHigh', 'joint_high', 'correlation', 'ranking', 'distribution', 'trends', 'topN'
] as const;

type AllowedType = (typeof ALLOWED_ANALYSIS_TYPES)[number];

const uniq = <T,>(arr: T[]): T[] => Array.from(new Set(arr));

export function validateRequest(req: AnalysisServiceRequest, columns: string[]): void {
  const analysisType = (req.analysis_type || (req as any).analysisType) as string;
  if (!analysisType || !ALLOWED_ANALYSIS_TYPES.includes(analysisType as AllowedType)) {
    throw new Error(`analysis_type must be one of ${ALLOWED_ANALYSIS_TYPES.join(', ')}`);
  }

  let target = (req.target_variable || (req as any).targetVariable) as string;
  target = FIELD_ALIASES[target] || target;
  if (!target) throw new Error('target_variable is required');
  if (!columns.includes(target)) throw new Error(`Unknown column ${target}`);

  const matchedRaw = (req.matched_fields || (req as any).matchedFields || []) as string[];
  const matched = matchedRaw.map(f => FIELD_ALIASES[f] || f);
  const bad = uniq(matched.filter(f => !columns.includes(f)));
  if (bad.length) throw new Error(`Unknown metric fields: ${bad.join(', ')}`);
}
