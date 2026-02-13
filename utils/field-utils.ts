import { FIELD_ALIASES } from './field-aliases';

export const preferPercentage = (fieldCode: string): string => {
  // If already a percentage field, leave unchanged
  if (!fieldCode) return fieldCode;
  if (fieldCode.endsWith('_P')) return fieldCode;

  const percentVersion = `${fieldCode}_P`;
  // If alias table contains percentVersion mapping to itself, assume it exists
  if (FIELD_ALIASES[percentVersion.toLowerCase()] === percentVersion) {
    return percentVersion;
  }
  return fieldCode;
}; 