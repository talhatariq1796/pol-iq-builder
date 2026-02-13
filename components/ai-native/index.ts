/**
 * AI-Native Components Export
 *
 * Barrel export for all AI-powered political analysis interface components
 */

// Core Components (Phase 1)
export { AIPoliticalWelcome } from './AIPoliticalWelcome';
export { AIPoliticalSessionHost } from './AIPoliticalSessionHost';
export { AIPoliticalConversation } from './AIPoliticalConversation';
export { AIPoliticalActions } from './AIPoliticalActions';

// Advanced Components (Phase 3)
export { WhatIfPoliticalPanel } from './WhatIfPoliticalPanel';
export { CampaignReportPreview } from './CampaignReportPreview';

// Mobile & Responsive Components (Phase 4)
export {
  ResponsiveLayout,
  MobileInput,
  MobileActionSheet,
  TouchActionButton,
  useBreakpoint,
} from './ResponsiveLayout';

// Re-export types for convenience
export type {
  Message,
  SuggestedAction,
  MapCommand,
  PoliticalAIContext,
  AISession,
} from '@/lib/ai-native/types';

// Re-export Phase 3 component types
export type {
  TurnoutScenario,
  ScenarioSummary,
  PrecinctScenarioResult,
} from './WhatIfPoliticalPanel';

export type {
  ReportSection,
  CampaignReportConfig,
} from './CampaignReportPreview';

// Phase 4 Types
export type {
  BreakpointSize,
  ResponsiveLayoutProps,
  MobileInputProps,
  MobileActionSheetProps,
  TouchActionButtonProps,
} from './ResponsiveLayout';
