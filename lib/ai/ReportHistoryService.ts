/**
 * ReportHistoryService - Manages report generation history
 *
 * Phase E: Polish & Integration
 * - Tracks recently generated reports
 * - Provides quick access to regenerate
 * - Stores in localStorage
 */

export interface ReportHistoryEntry {
  id: string;
  reportType: 'executive' | 'targeting' | 'profile' | 'comparison' | 'segment' | 'canvassing' | 'donor';
  title: string;
  precinctCount: number;
  precinctNames?: string[];
  generatedAt: string; // ISO date string
  filename: string;
  metadata?: Record<string, unknown>;
}

export interface ReportCustomization {
  reportType: string;
  includeSections: string[];
  excludeSections: string[];
}

const STORAGE_KEY = 'pol_report_history';
const MAX_HISTORY = 20;

/**
 * Report type configuration with icons and sections
 */
export const REPORT_TYPE_CONFIG: Record<string, {
  icon: string;
  label: string;
  emoji: string;
  sections: Array<{ id: string; label: string; required?: boolean }>;
}> = {
  executive: {
    icon: 'file-text',
    label: 'Executive Summary',
    emoji: '📋',
    sections: [
      { id: 'header', label: 'Header & Metrics', required: true },
      { id: 'map', label: 'Mini Map' },
      { id: 'assessment', label: 'Quick Assessment', required: true },
      { id: 'recommendation', label: 'Recommendation', required: true },
    ],
  },
  targeting: {
    icon: 'target',
    label: 'Targeting Brief',
    emoji: '🎯',
    sections: [
      { id: 'header', label: 'Header & Summary', required: true },
      { id: 'table', label: 'Ranked Precinct Table', required: true },
      { id: 'legend', label: 'Score Legend' },
      { id: 'notes', label: 'Strategic Notes' },
    ],
  },
  profile: {
    icon: 'book-open',
    label: 'Political Profile',
    emoji: '📊',
    sections: [
      { id: 'cover', label: 'Cover Page', required: true },
      { id: 'political', label: 'Political Overview', required: true },
      { id: 'elections', label: 'Election History' },
      { id: 'demographics', label: 'Demographics' },
      { id: 'attitudes', label: 'Political Attitudes' },
      { id: 'engagement', label: 'Engagement Profile' },
      { id: 'analysis', label: 'AI Analysis', required: true },
    ],
  },
  comparison: {
    icon: 'columns',
    label: 'Comparison Report',
    emoji: '⚖️',
    sections: [
      { id: 'header', label: 'Header', required: true },
      { id: 'kpis', label: 'Side-by-Side KPIs', required: true },
      { id: 'demographics', label: 'Demographic Comparison' },
      { id: 'political', label: 'Political Comparison' },
      { id: 'history', label: 'Electoral History' },
      { id: 'insights', label: 'AI Insights', required: true },
    ],
  },
  segment: {
    icon: 'filter',
    label: 'Segment Report',
    emoji: '🔍',
    sections: [
      { id: 'definition', label: 'Segment Definition', required: true },
      { id: 'summary', label: 'Summary Statistics', required: true },
      { id: 'distributions', label: 'Score Distributions' },
      { id: 'precincts', label: 'Precinct List', required: true },
      { id: 'demographics', label: 'Demographic Profile' },
      { id: 'recommendations', label: 'Strategic Recommendations' },
    ],
  },
  canvassing: {
    icon: 'map-pin',
    label: 'Canvassing Plan',
    emoji: '🚶',
    sections: [
      { id: 'overview', label: 'Operation Overview', required: true },
      { id: 'priority', label: 'Priority Ranking', required: true },
      { id: 'turfs', label: 'Turf Summary' },
      { id: 'logistics', label: 'Logistics' },
      { id: 'sheets', label: 'Turf Sheets' },
      { id: 'scripts', label: 'Scripts & Tips' },
    ],
  },
  donor: {
    icon: 'dollar-sign',
    label: 'Donor Analysis',
    emoji: '💰',
    sections: [
      { id: 'summary', label: 'Fundraising Summary', required: true },
      { id: 'zipcodes', label: 'Top ZIP Codes', required: true },
      { id: 'segments', label: 'Donor Segments' },
      { id: 'lapsed', label: 'Lapsed Donor Opportunity' },
      { id: 'prospects', label: 'Upgrade Prospects' },
      { id: 'geography', label: 'Geographic Opportunities' },
      { id: 'trends', label: 'Time Trends' },
    ],
  },
};

/**
 * Get report history from localStorage
 */
export function getReportHistory(): ReportHistoryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ReportHistoryEntry[];
  } catch (error) {
    console.error('[ReportHistory] Error reading history:', error);
    return [];
  }
}

/**
 * Add a report to history
 */
export function addReportToHistory(entry: Omit<ReportHistoryEntry, 'id' | 'generatedAt'>): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getReportHistory();

    const newEntry: ReportHistoryEntry = {
      ...entry,
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: new Date().toISOString(),
    };

    // Add to front of array
    history.unshift(newEntry);

    // Limit history size
    const trimmed = history.slice(0, MAX_HISTORY);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[ReportHistory] Error saving history:', error);
  }
}

/**
 * Get recent reports (last 5)
 */
export function getRecentReports(limit = 5): ReportHistoryEntry[] {
  return getReportHistory().slice(0, limit);
}

/**
 * Clear report history
 */
export function clearReportHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Format a history entry for display
 */
export function formatHistoryEntry(entry: ReportHistoryEntry): string {
  const config = REPORT_TYPE_CONFIG[entry.reportType];
  const date = new Date(entry.generatedAt);
  const timeAgo = getTimeAgo(date);

  return `${config?.emoji || '📄'} ${entry.title} (${timeAgo})`;
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get default sections for a report type
 */
export function getDefaultSections(reportType: string): string[] {
  const config = REPORT_TYPE_CONFIG[reportType];
  if (!config) return [];
  return config.sections.map(s => s.id);
}

/**
 * Get required sections for a report type
 */
export function getRequiredSections(reportType: string): string[] {
  const config = REPORT_TYPE_CONFIG[reportType];
  if (!config) return [];
  return config.sections.filter(s => s.required).map(s => s.id);
}
