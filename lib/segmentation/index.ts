/**
 * Voter Segmentation Tool
 *
 * Multi-dimensional filtering and analysis of voter precincts
 * based on demographics, political profile, targeting scores,
 * and engagement metrics.
 *
 * @module segmentation
 */

// Core engine
export { SegmentEngine } from "./SegmentEngine";

// Storage/persistence
export { SegmentStore, segmentStore } from "./SegmentStore";

// Phase 3: Export Manager & Exporters
export { ExportManager } from "./ExportManager";
export { CSVExporter } from "./exporters";

export {
  defaultSegments,
  getPreset,
  getAllPresets,
  isPreset,
} from "./presets/default-segments";

// Types
export type {
  // Filter types
  SegmentFilters,
  DemographicFilters,
  PoliticalFilters,
  TargetingFilters,
  EngagementFilters,

  // Utility types
  DensityType,
  HousingType,
  TargetingStrategyType,
  PartyLeanType,
  CompetitivenessType,
  PoliticalOutlookType,
  NewsPreferenceType,
  SocialMediaPlatformType,

  // Result types
  SegmentResults,
  PrecinctMatch,
  SegmentDefinition,

  // Data types
  PrecinctData,
  SegmentExportRow,

  // Phase 1: Electoral types
  ElectoralFilters,
  ElectoralDistrict,
  DistrictCrosswalk,

  // Phase 2: Election history types
  ElectionHistoryFilters,
  ElectionResultRecord,
  ElectionDataFile,

  // Phase 3: Export types
  ExportOptions,
  ExportFormat,
  VANExportRow,
  MailMergeExportRow,
  PhoneListExportRow,
  DigitalAdsExportRow,

  // Phase 4: Tapestry types
  TapestryFilters,
  TapestrySegment,
  PrecinctTapestry,

  // Phase 5: Lookalike types
  LookalikeProfile,
  LookalikeResults,
  LookalikeMatch,

  // Phase 6: Comparison types
  SegmentComparisonConfig,
  SegmentSummary,
  SegmentOverlap,
  ComparisonResults,

  // Extended types
  ExtendedSegmentFilters,
  ExtendedSegmentResults,
} from "./types";
