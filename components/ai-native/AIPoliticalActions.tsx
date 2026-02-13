'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Target,
  BarChart3,
  GitCompare,
  FileText,
  Map,
  Users,
  TrendingUp,
  Search,
  LucideIcon,
} from 'lucide-react';

interface SuggestedAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

interface PoliticalAIContext {
  currentView: 'overview' | 'jurisdiction' | 'precinct' | 'comparison';
  selectedPrecincts: string[];
  selectedJurisdiction?: string;
  lastAction: string;
  targetingStrategy?: 'gotv' | 'persuasion' | 'battleground';
}

interface AIPoliticalActionsProps {
  context: PoliticalAIContext;
  onActionClick: (action: SuggestedAction) => void;
  customActions?: SuggestedAction[];
}

const iconMap: Record<string, LucideIcon> = {
  target: Target,
  chart: BarChart3,
  compare: GitCompare,
  report: FileText,
  map: Map,
  users: Users,
  trending: TrendingUp,
  search: Search,
};

/**
 * Generates context-appropriate political actions based on current analysis state
 */
export function generatePoliticalActions(
  context: PoliticalAIContext
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  // Overview context actions
  if (context.currentView === 'overview') {
    actions.push({
      id: 'identify-battlegrounds',
      label: 'Identify Battlegrounds',
      action: 'identify_battlegrounds',
      icon: 'target',
      variant: 'primary',
    });

    actions.push({
      id: 'demographic-trends',
      label: 'Demographic Trends',
      action: 'show_demographic_trends',
      icon: 'trending',
      variant: 'default',
    });

    actions.push({
      id: 'turnout-analysis',
      label: 'Turnout Analysis',
      action: 'analyze_turnout',
      icon: 'chart',
      variant: 'default',
    });

    actions.push({
      id: 'search-precincts',
      label: 'Search Precincts',
      action: 'search_precincts',
      icon: 'search',
      variant: 'default',
    });
  }

  // Jurisdiction context actions
  if (context.currentView === 'jurisdiction' && context.selectedJurisdiction) {
    actions.push({
      id: 'generate-report',
      label: 'Generate Report',
      action: 'generate_jurisdiction_report',
      icon: 'report',
      variant: 'primary',
    });

    actions.push({
      id: 'compare-similar',
      label: 'Compare Similar',
      action: 'compare_similar_jurisdictions',
      icon: 'compare',
      variant: 'default',
    });

    actions.push({
      id: 'view-precincts',
      label: 'View Precincts',
      action: 'show_precincts',
      icon: 'map',
      variant: 'default',
    });

    actions.push({
      id: 'voter-segments',
      label: 'Voter Segments',
      action: 'analyze_voter_segments',
      icon: 'users',
      variant: 'default',
    });

    actions.push({
      id: 'swing-analysis',
      label: 'Swing Analysis',
      action: 'analyze_swing_potential',
      icon: 'trending',
      variant: 'default',
    });
  }

  // Precinct context actions
  if (context.currentView === 'precinct' && context.selectedPrecincts.length > 0) {
    const isMultiplePrecincts = context.selectedPrecincts.length > 1;

    if (isMultiplePrecincts) {
      actions.push({
        id: 'compare-precincts',
        label: 'Compare Precincts',
        action: 'compare_precincts',
        icon: 'compare',
        variant: 'primary',
      });

      actions.push({
        id: 'canvassing-route',
        label: 'Canvassing Route',
        action: 'plan_canvassing_route',
        icon: 'map',
        variant: 'default',
      });
    } else {
      actions.push({
        id: 'precinct-profile',
        label: 'Precinct Profile',
        action: 'generate_precinct_profile',
        icon: 'report',
        variant: 'primary',
      });

      actions.push({
        id: 'find-similar',
        label: 'Find Similar',
        action: 'find_similar_precincts',
        icon: 'search',
        variant: 'default',
      });
    }

    actions.push({
      id: 'targeting-score',
      label: 'Targeting Score',
      action: 'calculate_targeting_score',
      icon: 'target',
      variant: 'default',
    });

    actions.push({
      id: 'voter-breakdown',
      label: 'Voter Breakdown',
      action: 'show_voter_breakdown',
      icon: 'users',
      variant: 'default',
    });

    actions.push({
      id: 'historical-trends',
      label: 'Historical Trends',
      action: 'show_historical_trends',
      icon: 'chart',
      variant: 'default',
    });
  }

  // Comparison context actions
  if (context.currentView === 'comparison') {
    actions.push({
      id: 'export-comparison',
      label: 'Export Comparison',
      action: 'export_comparison_report',
      icon: 'report',
      variant: 'primary',
    });

    actions.push({
      id: 'add-to-comparison',
      label: 'Add More',
      action: 'add_to_comparison',
      icon: 'search',
      variant: 'default',
    });

    actions.push({
      id: 'targeting-strategy',
      label: 'Targeting Strategy',
      action: 'create_targeting_strategy',
      icon: 'target',
      variant: 'default',
    });

    actions.push({
      id: 'visualize-map',
      label: 'Visualize on Map',
      action: 'show_on_map',
      icon: 'map',
      variant: 'default',
    });
  }

  // Strategy-specific actions
  if (context.targetingStrategy === 'gotv') {
    actions.push({
      id: 'gotv-priority',
      label: 'GOTV Priority',
      action: 'rank_gotv_priority',
      icon: 'trending',
      variant: 'secondary',
    });
  } else if (context.targetingStrategy === 'persuasion') {
    actions.push({
      id: 'persuasion-targets',
      label: 'Persuasion Targets',
      action: 'identify_persuasion_targets',
      icon: 'users',
      variant: 'secondary',
    });
  } else if (context.targetingStrategy === 'battleground') {
    actions.push({
      id: 'battleground-map',
      label: 'Battleground Map',
      action: 'show_battleground_map',
      icon: 'map',
      variant: 'secondary',
    });
  }

  // Limit to 5 actions
  return actions.slice(0, 5);
}

export function AIPoliticalActions({
  context,
  onActionClick,
  customActions,
}: AIPoliticalActionsProps) {
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Trigger animation when context changes
    setIsAnimating(true);

    const timer = setTimeout(() => {
      const generatedActions = customActions || generatePoliticalActions(context);
      setActions(generatedActions);
      setIsAnimating(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [context, customActions]);

  const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return Target;
    return iconMap[iconName] || Target;
  };

  const getVariantClass = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'secondary':
        return 'bg-purple-600 hover:bg-purple-700 text-white';
      default:
        return '';
    }
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden">
      <div
        className={`flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent transition-opacity duration-150 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {actions.map((action) => {
          const IconComponent = getIcon(action.icon);
          const variantClass = getVariantClass(action.variant);

          return (
            <Button
              key={action.id}
              onClick={() => onActionClick(action)}
              className={`flex items-center gap-2 whitespace-nowrap ${variantClass}`}
              variant={action.variant === 'default' ? 'outline' : 'default'}
              size="sm"
            >
              <IconComponent className="h-4 w-4" />
              <span>{action.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default AIPoliticalActions;
