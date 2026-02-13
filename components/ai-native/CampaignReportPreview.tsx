'use client';

import React, { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'comparison' | 'segment' | 'canvass' | 'donor' | 'recommendations';
  content: ReportContent;
  included: boolean;
}

export type ReportContent =
  | SummaryContent
  | ComparisonContent
  | SegmentContent
  | CanvassContent
  | DonorContent
  | RecommendationsContent;

export interface SummaryContent {
  type: 'summary';
  areaName: string;
  totalPrecincts: number;
  totalVoters: number;
  avgPartisanLean: number;
  avgTurnout: number;
  competitivenessBreakdown: Record<string, number>;
  keyInsights: string[];
}

export interface ComparisonContent {
  type: 'comparison';
  leftArea: string;
  rightArea: string;
  metrics: Array<{
    metric: string;
    leftValue: string | number;
    rightValue: string | number;
    insight: string;
  }>;
}

export interface SegmentContent {
  type: 'segment';
  segmentName: string;
  precinctCount: number;
  voterCount: number;
  filters: string[];
  topPrecincts: Array<{ name: string; score: number }>;
}

export interface CanvassContent {
  type: 'canvass';
  universeName: string;
  totalDoors: number;
  totalTurfs: number;
  volunteerHoursNeeded: number;
  priorityPrecincts: Array<{ name: string; doors: number; priority: number }>;
}

export interface DonorContent {
  type: 'donor';
  totalRaised: number;
  donorCount: number;
  avgDonation: number;
  topZips: Array<{ zip: string; amount: number; donors: number }>;
  prospectAreas: string[];
}

export interface RecommendationsContent {
  type: 'recommendations';
  strategy: 'gotv' | 'persuasion' | 'battleground';
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
    targetAreas: string[];
  }>;
}

export interface CampaignReportConfig {
  title: string;
  subtitle?: string;
  preparedFor?: string;
  preparedBy?: string;
  date: Date;
  sections: ReportSection[];
}

export interface CampaignReportPreviewProps {
  config: CampaignReportConfig;
  onConfigChange?: (config: CampaignReportConfig) => void;
  onExport?: (format: 'pdf' | 'docx' | 'html') => void;
  onClose?: () => void;
}

// ============================================================================
// Section Renderers
// ============================================================================

const SummarySection: React.FC<{ content: SummaryContent }> = ({ content }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-gray-50 p-3 rounded">
        <div className="text-2xl font-bold text-gray-900">{content.totalPrecincts}</div>
        <div className="text-xs text-gray-500">Precincts</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <div className="text-2xl font-bold text-gray-900">{content.totalVoters.toLocaleString()}</div>
        <div className="text-xs text-gray-500">Voters</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <div className={`text-2xl font-bold ${content.avgPartisanLean >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
          {content.avgPartisanLean >= 0 ? '+' : ''}{content.avgPartisanLean}D
        </div>
        <div className="text-xs text-gray-500">Avg. Lean</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <div className="text-2xl font-bold text-gray-900">{content.avgTurnout}%</div>
        <div className="text-xs text-gray-500">Avg. Turnout</div>
      </div>
    </div>

    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Competitiveness</h4>
      <div className="flex gap-2">
        {Object.entries(content.competitivenessBreakdown).map(([rating, count]) => (
          <div key={rating} className="flex-1 text-center bg-gray-100 rounded py-2">
            <div className="font-medium">{count}</div>
            <div className="text-xs text-gray-500">{rating.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
    </div>

    {content.keyInsights.length > 0 && (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Insights</h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          {content.keyInsights.map((insight, i) => (
            <li key={i}>{insight}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const ComparisonSection: React.FC<{ content: ComparisonContent }> = ({ content }) => (
  <div>
    <div className="flex justify-between items-center mb-4">
      <div className="text-center flex-1">
        <div className="font-medium text-blue-600">{content.leftArea}</div>
      </div>
      <div className="text-gray-400">vs</div>
      <div className="text-center flex-1">
        <div className="font-medium text-purple-600">{content.rightArea}</div>
      </div>
    </div>
    <table className="w-full text-sm">
      <tbody>
        {content.metrics.map((m, i) => (
          <tr key={i} className="border-b">
            <td className="py-2 text-right text-blue-600 font-medium">{m.leftValue}</td>
            <td className="py-2 px-4 text-center text-gray-500">{m.metric}</td>
            <td className="py-2 text-left text-purple-600 font-medium">{m.rightValue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SegmentSection: React.FC<{ content: SegmentContent }> = ({ content }) => (
  <div className="space-y-4">
    <div className="flex gap-4">
      <div className="bg-blue-50 px-4 py-2 rounded">
        <span className="font-bold text-blue-700">{content.precinctCount}</span>
        <span className="text-blue-600 text-sm ml-1">precincts</span>
      </div>
      <div className="bg-green-50 px-4 py-2 rounded">
        <span className="font-bold text-green-700">{content.voterCount.toLocaleString()}</span>
        <span className="text-green-600 text-sm ml-1">voters</span>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Filters Applied</h4>
      <div className="flex flex-wrap gap-2">
        {content.filters.map((filter, i) => (
          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
            {filter}
          </span>
        ))}
      </div>
    </div>
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Top Precincts</h4>
      <div className="space-y-1">
        {content.topPrecincts.slice(0, 5).map((p, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{p.name}</span>
            <span className="text-gray-500">Score: {p.score}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CanvassSection: React.FC<{ content: CanvassContent }> = ({ content }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-orange-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-orange-700">{content.totalDoors.toLocaleString()}</div>
        <div className="text-xs text-orange-600">Total Doors</div>
      </div>
      <div className="bg-orange-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-orange-700">{content.totalTurfs}</div>
        <div className="text-xs text-orange-600">Turfs</div>
      </div>
      <div className="bg-orange-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-orange-700">{content.volunteerHoursNeeded}</div>
        <div className="text-xs text-orange-600">Vol. Hours</div>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Priority Precincts</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Precinct</th>
            <th className="text-right py-1">Doors</th>
            <th className="text-right py-1">Priority</th>
          </tr>
        </thead>
        <tbody>
          {content.priorityPrecincts.slice(0, 5).map((p, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="text-right py-1">{p.doors}</td>
              <td className="text-right py-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  p.priority >= 8 ? 'bg-red-100 text-red-700' :
                  p.priority >= 5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {p.priority}/10
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const DonorSection: React.FC<{ content: DonorContent }> = ({ content }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-emerald-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-emerald-700">${(content.totalRaised / 1000).toFixed(0)}K</div>
        <div className="text-xs text-emerald-600">Total Raised</div>
      </div>
      <div className="bg-emerald-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-emerald-700">{content.donorCount.toLocaleString()}</div>
        <div className="text-xs text-emerald-600">Donors</div>
      </div>
      <div className="bg-emerald-50 p-3 rounded text-center">
        <div className="text-xl font-bold text-emerald-700">${content.avgDonation}</div>
        <div className="text-xs text-emerald-600">Avg. Donation</div>
      </div>
    </div>
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Top ZIP Codes</h4>
      <div className="space-y-2">
        {content.topZips.slice(0, 3).map((z, i) => (
          <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
            <span className="font-medium">{z.zip}</span>
            <span className="text-sm text-gray-500">{z.donors} donors</span>
            <span className="font-medium text-emerald-600">${(z.amount / 1000).toFixed(1)}K</span>
          </div>
        ))}
      </div>
    </div>
    {content.prospectAreas.length > 0 && (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Prospect Areas</h4>
        <p className="text-sm text-gray-600">{content.prospectAreas.join(', ')}</p>
      </div>
    )}
  </div>
);

const RecommendationsSection: React.FC<{ content: RecommendationsContent }> = ({ content }) => (
  <div className="space-y-4">
    <div className="text-sm text-gray-500 mb-2">
      Strategy: <span className="font-medium text-gray-700 uppercase">{content.strategy}</span>
    </div>
    {content.recommendations.map((rec, i) => (
      <div
        key={i}
        className={`p-4 rounded-lg border-l-4 ${
          rec.priority === 'high' ? 'bg-red-50 border-red-500' :
          rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
          'bg-gray-50 border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            rec.priority === 'high' ? 'bg-red-200 text-red-800' :
            rec.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
            'bg-gray-200 text-gray-800'
          }`}>
            {rec.priority.toUpperCase()}
          </span>
        </div>
        <div className="font-medium text-gray-900">{rec.action}</div>
        <div className="text-sm text-gray-600 mt-1">{rec.rationale}</div>
        {rec.targetAreas.length > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            Target: {rec.targetAreas.join(', ')}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const CampaignReportPreview: React.FC<CampaignReportPreviewProps> = ({
  config,
  onConfigChange,
  onExport,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(
    config.sections.find(s => s.included)?.id || null
  );
  const [isExporting, setIsExporting] = useState(false);

  // Toggle section inclusion
  const toggleSection = useCallback((sectionId: string) => {
    if (!onConfigChange) return;
    const newSections = config.sections.map(s =>
      s.id === sectionId ? { ...s, included: !s.included } : s
    );
    onConfigChange({ ...config, sections: newSections });
  }, [config, onConfigChange]);

  // Reorder sections
  const moveSection = useCallback((sectionId: string, direction: 'up' | 'down') => {
    if (!onConfigChange) return;
    const currentIndex = config.sections.findIndex(s => s.id === sectionId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= config.sections.length) return;

    const newSections = [...config.sections];
    [newSections[currentIndex], newSections[newIndex]] = [newSections[newIndex], newSections[currentIndex]];
    onConfigChange({ ...config, sections: newSections });
  }, [config, onConfigChange]);

  // Handle export
  const handleExport = useCallback(async (format: 'pdf' | 'docx' | 'html') => {
    if (!onExport) return;
    setIsExporting(true);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);

  // Included sections for preview
  const includedSections = useMemo(
    () => config.sections.filter(s => s.included),
    [config.sections]
  );

  // Render section content
  const renderSectionContent = (section: ReportSection) => {
    switch (section.content.type) {
      case 'summary':
        return <SummarySection content={section.content} />;
      case 'comparison':
        return <ComparisonSection content={section.content} />;
      case 'segment':
        return <SegmentSection content={section.content} />;
      case 'canvass':
        return <CanvassSection content={section.content} />;
      case 'donor':
        return <DonorSection content={section.content} />;
      case 'recommendations':
        return <RecommendationsSection content={section.content} />;
      default:
        return <div className="text-gray-500">Unknown section type</div>;
    }
  };

  return (
    <div className="campaign-report-preview bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campaign Report Preview</h2>
          <p className="text-sm text-gray-500">Customize and export your report</p>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={() => handleExport('docx')}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:bg-gray-300"
              >
                DOCX
              </button>
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Section List (Left Sidebar) */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Report Sections</h3>
          <div className="space-y-2">
            {config.sections.map((section, index) => (
              <div
                key={section.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  activeSection === section.id
                    ? 'border-blue-500 bg-blue-50'
                    : section.included
                    ? 'border-gray-200 bg-white hover:border-gray-300'
                    : 'border-gray-200 bg-gray-100 opacity-60'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={section.included}
                      onChange={() => toggleSection(section.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-900">{section.title}</span>
                  </div>
                  {onConfigChange && (
                    <div className="flex gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); moveSection(section.id, 'up'); }}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); moveSection(section.id, 'down'); }}
                        disabled={index === config.sections.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview (Right Panel) */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Report Header */}
          <div className="mb-8 pb-6 border-b">
            <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
            {config.subtitle && (
              <p className="text-lg text-gray-600 mt-1">{config.subtitle}</p>
            )}
            <div className="flex gap-4 mt-4 text-sm text-gray-500">
              {config.preparedFor && <div>Prepared for: {config.preparedFor}</div>}
              {config.preparedBy && <div>Prepared by: {config.preparedBy}</div>}
              <div>{config.date.toLocaleDateString()}</div>
            </div>
          </div>

          {/* Section Preview */}
          {activeSection ? (
            <div>
              {includedSections.map((section, index) => (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className={`mb-8 ${activeSection === section.id ? 'ring-2 ring-blue-200 rounded-lg p-4 -m-4' : ''}`}
                >
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{index + 1}.</span>
                    {section.title}
                  </h2>
                  {renderSectionContent(section)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Select a section to preview
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {includedSections.length} of {config.sections.length} sections included
        </div>
        <div className="text-xs text-gray-400">
          Political Landscape Analysis | Ingham County, MI
        </div>
      </div>
    </div>
  );
};

export default CampaignReportPreview;
