/**
 * DEPRECATED: This service is obsolete and should not be used for new development.
 * All functionality has been centralized in the FieldMappingHelper.
 * 
 * This file is maintained for backward compatibility with legacy code and build scripts.
 * It now simply re-exports the centralized helper functions.
 */
export {
  getFriendlyFieldName,
  cleanFieldLabel,
  prettifyFieldName,
  createLegendTitle,
  FieldMappingHelper
} from '../utils/visualizations/field-mapping-helper';
