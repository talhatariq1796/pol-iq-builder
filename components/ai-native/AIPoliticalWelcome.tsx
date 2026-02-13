'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  BarChart3,
  Scale,
  History,
  Mic,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the AI-first political welcome screen
 */
export interface AIPoliticalWelcomeProps {
  /** Callback when a workflow card is clicked */
  onWorkflowSelect: (workflowId: string) => void;

  /** Callback when user submits a query */
  onQuerySubmit: (query: string) => void;

  /** Optional custom greeting message */
  greeting?: string;

  /** Optional AI-generated insights to display */
  insights?: string[];

  /** Whether AI is currently processing */
  isLoading?: boolean;
}

/**
 * Workflow cards configuration
 */
const WORKFLOWS = [
  {
    id: 'find-targets',
    title: 'Find Target Areas',
    description: 'Discover high-GOTV or swing areas',
    icon: Search,
    color: 'blue',
    tourId: 'workflow-find-targets',
  },
  {
    id: 'analyze-jurisdiction',
    title: 'Analyze Jurisdiction',
    description: 'Deep dive into a township or city',
    icon: BarChart3,
    color: 'green',
    tourId: 'workflow-analyze',
  },
  {
    id: 'compare-jurisdictions',
    title: 'Compare Jurisdictions',
    description: 'Lansing vs East Lansing, urban vs rural',
    icon: Scale,
    color: 'purple',
    tourId: 'workflow-compare',
  },
  {
    id: 'past-sessions',
    title: 'Past Sessions',
    description: 'Continue where you left off',
    icon: History,
    color: 'orange',
    tourId: 'workflow-history',
  },
] as const;

/**
 * Example queries that rotate in the placeholder
 * Organized by category to showcase platform capabilities
 */
const EXAMPLE_QUERIES = [
  // Strategic targeting
  'Which precincts have highest swing potential?',
  'Where should we focus our GOTV efforts?',
  'Find precincts with high persuasion opportunity scores',

  // Comparisons
  'Compare Lansing vs East Lansing',
  'What makes Meridian Township different from Delhi Township?',

  // Multi-criteria segmentation
  'Find suburban precincts with college-educated voters where margins were under 5 points',
  'Show me precincts with high income and Democratic lean',

  // Electoral district filtering
  'Show precincts in State House District 73 with high GOTV priority',
  'Which precincts in the 7th Congressional District are most competitive?',

  // Election history & trends
  'Find precincts where turnout dropped more than 10% from 2020 to 2022',
  'Which precincts shifted toward Democrats since 2020?',
  'Show me precincts that voted for Biden but have conservative demographics',

  // Tapestry lifestyle segments
  'Which precincts have College Towns Tapestry segments?',
  'Find areas with Rustbelt Traditions lifestyle segments',
  'What Tapestry segments dominate East Lansing?',

  // Lookalike modeling
  'Find precincts similar to East Lansing Precinct 3',
  'Which precincts are demographically similar to Meridian Township?',

  // Donor analysis
  'Where are Democratic donors concentrated?',
  'Show ZIP codes with high donor potential but low current giving',
  'Which areas have lapsed donors we should re-engage?',

  // Canvassing operations
  'Create a canvassing plan for high-GOTV precincts in Lansing',
  'How many volunteer hours to knock 5,000 doors in our target universe?',
  'Plan a 500-door canvass in urban precincts',
] as const;

/**
 * Default greeting message
 */
const DEFAULT_GREETING = `Ingham County electoral analysis for 2026 midterms. Find target areas, analyze voter demographics, and optimize outreach strategy.`;

/**
 * AI-first welcome screen for political analysis platform
 *
 * Greets users with AI message and provides guided workflows plus free-form input.
 * Follows the "AI speaks first" principle from AI-NATIVE-UI-IMPLEMENTATION-PLAN.md
 */
export function AIPoliticalWelcome({
  onWorkflowSelect,
  onQuerySubmit,
  greeting = DEFAULT_GREETING,
  insights = [],
  isLoading = false,
}: AIPoliticalWelcomeProps) {
  const [query, setQuery] = React.useState('');
  const [currentPlaceholder, setCurrentPlaceholder] = React.useState(0);

  // Rotate placeholder examples every 3 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev: number) => (prev + 1) % EXAMPLE_QUERIES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onQuerySubmit(query.trim());
      setQuery('');
    }
  };

  const handleWorkflowClick = (workflowId: string) => {
    onWorkflowSelect(workflowId);
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950',
      green: 'hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950',
      purple: 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950',
      orange: 'hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950',
    };
    return colorMap[color] || colorMap.blue;
  };

  const getIconColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'text-blue-600 dark:text-blue-400',
      green: 'text-green-600 dark:text-green-400',
      purple: 'text-purple-600 dark:text-purple-400',
      orange: 'text-orange-600 dark:text-orange-400',
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-6">
        {/* AI Greeting Card */}
        <Card className="theme-card-elevated" data-tour="ai-greeting">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl text-white">
                🗳️
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">
                    Political Landscape Analysis - Ingham County
                  </CardTitle>
                </div>
                <CardDescription className="whitespace-pre-line text-base leading-relaxed">
                  {greeting}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {/* AI Insights (if any) */}
          {insights.length > 0 && (
            <CardContent className="space-y-2 pt-0">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <p className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Recent Insights:
                </p>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  {insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Workflow Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOWS.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <button
                key={workflow.id}
                data-tour={workflow.tourId}
                onClick={() => handleWorkflowClick(workflow.id)}
                className={cn(
                  'group relative overflow-hidden rounded-lg border-2 border-border bg-card p-6 text-left transition-all duration-200',
                  'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  getColorClasses(workflow.color)
                )}
                disabled={isLoading}
              >
                <div className="space-y-3">
                  <div className={cn('transition-colors', getIconColorClasses(workflow.color))}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground group-hover:underline">
                      {workflow.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{workflow.description}</p>
                  </div>
                </div>
                <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>

        {/* Free-Form Input */}
        <Card data-tour="query-input">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Or ask anything:</p>
              </div>

              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                  placeholder={EXAMPLE_QUERIES[currentPlaceholder]}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 transition-all duration-300',
                    isLoading && 'opacity-50'
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                  className="shrink-0"
                  title="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="shrink-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  <span>AI is analyzing...</span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Footer Hint */}
        <p className="text-center text-xs text-muted-foreground">
          This AI assistant analyzes precinct-level data for Ingham County, Michigan. Data sources
          include Michigan SOS, ArcGIS Business Analyst, and Ingham County Clerk.
        </p>
      </div>
    </div>
  );
}

// Named export (primary)
export default AIPoliticalWelcome;
