/**
 * AI-Native Module
 *
 * Core infrastructure for AI-first political analysis interface.
 * Provides context-aware actions, map integration, score explanations,
 * proactive insights, session persistence, and UI utilities.
 */

// Types
export * from './types';
export * from './types/unified-state';

// Application State Manager
export { default as ApplicationStateManager, getStateManager } from './ApplicationStateManager';
export type {
  ApplicationState,
  MapState as AppMapState,
  SelectionState,
  IQBuilderState,
  WorkflowState,
  BehaviorState,
  TemporalState,
  SegmentationState,
  CanvassingState,
  DonorState,
  ComparisonState,
  ReportState,
  StateEventType,
  StateEvent,
  StateListener,
} from './ApplicationStateManager';

// Suggestion Engine
export { default as SuggestionEngine, getSuggestionEngine } from './SuggestionEngine';

// Engines
export { PoliticalSuggestedActionsEngine, suggestedActionsEngine } from './PoliticalSuggestedActionsEngine';
export { MapCommandBridge, mapCommandBridge } from './MapCommandBridge';
export { PoliticalScoreExplainer, scoreExplainer } from './PoliticalScoreExplainer';
export { PoliticalInsightsEngine, insightsEngine } from './PoliticalInsightsEngine';
export { PoliticalSessionPersistence, sessionPersistence } from './PoliticalSessionPersistence';

// UI Hooks
export { useVoiceInput, createVoiceInputProps } from './useVoiceInput';
export {
  useKeyboardShortcuts,
  DEFAULT_POLITICAL_SHORTCUTS,
  renderShortcutGroups,
} from './useKeyboardShortcuts';
export { useToolUrlParams, hasUrlParams, buildQueryString } from './hooks/useToolUrlParams';

// Navigation
export {
  CrossToolNavigator,
  navigateToSegments,
  navigateToDonors,
  navigateToCanvass,
  navigateToComparison,
} from './navigation/CrossToolNavigator';

// Performance Utilities
export {
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useThrottledCallback,
  useMemoWithTTL,
  useVirtualScroll,
  useIntersectionObserver,
  useLazyLoad,
  useRAFCallback,
  useBatchedUpdates,
  MemoCache,
  PreloadManager,
  preloadManager,
} from './performance';

// NLP Handlers
export {
  ToolOrchestrator,
  toolOrchestrator,
  processQuery,
  canHandleQuery,
  segmentationHandler,
  canvassingHandler,
  donorHandler,
  reportHandler,
} from './handlers';

// Re-export commonly used types
export type {
  Message,
  SuggestedAction,
  MapCommand,
  PoliticalAIContext,
  AISession,
  ToolResult,
  ParsedQuery,
  Citation,
} from './types';

export type {
  ActionContext,
  AnalysisResult as ActionAnalysisResult,
} from './PoliticalSuggestedActionsEngine';

export type {
  MapState,
  MapBridgeConfig,
  MapEvent,
} from './MapCommandBridge';

export type {
  ScoreExplanation,
  ScoreContribution,
  ScoreType,
} from './PoliticalScoreExplainer';

export type {
  Insight,
  InsightType,
  InsightEvidence,
} from './PoliticalInsightsEngine';

export type {
  SessionMetadata,
  SessionExport,
  SessionListOptions,
} from './PoliticalSessionPersistence';

// Voice Input Types
export type {
  VoiceInputState,
  VoiceInputConfig,
  UseVoiceInputReturn,
  VoiceInputButtonProps,
} from './useVoiceInput';

// Keyboard Shortcut Types
export type {
  KeyboardShortcut,
  ShortcutGroup,
  UseKeyboardShortcutsConfig,
  UseKeyboardShortcutsReturn,
  KeyboardShortcutsHelpProps,
} from './useKeyboardShortcuts';

// Performance Types
export type {
  VirtualScrollConfig,
  VirtualScrollResult,
} from './performance';

// NLP Handler Types
export type {
  NLPHandler,
  ParsedQuery as NLPParsedQuery,
  QueryIntent,
  ExtractedEntities,
  HandlerResult,
  QueryPattern,
} from './handlers';

// Navigation Types
export type {
  ToolUrlParams,
} from './hooks/useToolUrlParams';

export type {
  NavigableTool,
  NavigationContext,
} from './navigation/CrossToolNavigator';
