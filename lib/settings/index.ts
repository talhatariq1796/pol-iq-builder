/**
 * Settings Module - Phase 17.1
 *
 * Centralized settings management for the Political Landscape Analysis Platform.
 */

// Types
export * from './types';

// Defaults
export {
  DEFAULT_SETTINGS,
  DEFAULT_CAMPAIGN_SETTINGS,
  DEFAULT_TARGETING_SETTINGS,
  DEFAULT_CANVASSING_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_DATA_SETTINGS,
  DEFAULT_MAP_SETTINGS,
  DEFAULT_ORGANIZATION_SETTINGS,
  cloneSettings,
  getDefaultValue,
  getCategoryDefaults,
} from './defaults';

// Manager
export {
  SettingsManager,
  getSettingsManager,
  getSetting,
  getCampaignState,
} from './SettingsManager';

// Validation
export {
  // Individual schemas
  campaignCalendarSettingsSchema,
  targetingSettingsSchema,
  canvassingSettingsSchema,
  aiSettingsSchema,
  dataSettingsSchema,
  mapSettingsSchema,
  organizationSettingsSchema,
  allSettingsSchema,
  persistedSettingsSchema,
  // Validation helpers
  validateCategorySettings,
  validateAllSettings,
  getErrorMessages,
  type ValidationResult,
} from './validation';
