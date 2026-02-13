/**
 * Canvassing Tool Components
 * Barrel export for all canvassing-related components
 */

// Core Components
export { CanvassingPlanner } from './CanvassingPlanner';

// Dashboard & Analytics Components
export { ProgressDashboard } from './ProgressDashboard';
export { PerformanceAnalytics } from './PerformanceAnalytics';
export { VolunteerRoster } from './VolunteerRoster';

// Tool Panels
export { VANExportDialog } from './VANExportDialog';
export { RouteOptimizerPanel } from './RouteOptimizerPanel';
export { DonorTargetingPanel } from './DonorTargetingPanel';
export { AssignmentPanel } from './AssignmentPanel';
export { ProgressLogger } from './ProgressLogger';

// Map Layers
export { TurfBoundaryLayer, TurfBoundaryLegend } from './TurfBoundaryLayer';
export {
  ProgressHeatmapLayer,
  ProgressHeatmapLegend,
  MetricSelector,
  ProgressHeatmapControls,
} from './ProgressHeatmapLayer';
export { VolunteerLocationLayer } from './VolunteerLocationLayer';
export { RouteVisualizationLayer } from './RouteVisualizationLayer';

// Legacy exports removed:
// - RouteOptimizationLayer (replaced by RouteVisualizationLayer)
// - TurfCutLayer (replaced by TurfBoundaryLayer)

// Type exports
export type { TurfBoundaryLayerProps } from './TurfBoundaryLayer';
export type { VolunteerLocation, VolunteerLocationLayerProps } from './VolunteerLocationLayer';
export type { RouteVisualizationLayerProps } from './RouteVisualizationLayer';
export type { ProgressHeatmapLayerProps } from './ProgressHeatmapLayer';
