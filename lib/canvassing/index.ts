// Canvassing Engine - Route optimization, voter targeting, and field operations
export { CanvassingEngine } from './CanvassingEngine';

// Canvassing Store - State management for canvassing operations
export { CanvassingStore, canvassingStore } from './CanvassingStore';

// Progress tracking - Session management, metrics, and analytics
export { ProgressStore } from './ProgressStore';
export { ProgressTracker } from './ProgressTracker';
export { ProgressAggregator } from './ProgressAggregator';

// Volunteer Manager - Volunteer roster and assignment management
export { VolunteerManager } from './VolunteerManager';

// Volunteer Store - Persistence for volunteers and assignments
export { VolunteerStore } from './VolunteerStore';

// Assignment Engine - Smart assignment optimization
export { AssignmentEngine } from './AssignmentEngine';

// VAN Exporter - VAN-compatible export/import
export { VANExporter } from './VANExporter';

// Route Optimizer - Route optimization for canvassing turfs
export { RouteOptimizer } from './RouteOptimizer';
export type {
  RouteStop,
  OptimizedRoute,
  BreakSuggestion,
  RouteOptions,
  RoutePrecinctData,
} from './RouteOptimizer';

// Performance Analyzer - Comprehensive performance analytics
export { PerformanceAnalyzer } from './PerformanceAnalyzer';
export type {
  PerformanceInsight,
  VolunteerRanking,
  TurfRanking,
} from './PerformanceAnalyzer';

// Donor Integrator - Cross-tool integration for donor-aware canvassing
export { DonorIntegrator } from './DonorIntegrator';
export type {
  DonorType,
  DonorEnrichedAddress,
  DonorTargetingOptions,
  DonorRecoveryTurf,
  DonorCanvassingResult,
  DonorRecoverySummary,
} from './DonorIntegrator';

// Type definitions for canvassing operations
export * from './types';
export * from './types-volunteer';
export * from './types-progress';
export * from './types-analytics';
