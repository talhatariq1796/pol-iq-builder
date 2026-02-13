'use client';

/**
 * MethodologyDialog - Reusable dialog for explaining political analysis metrics
 *
 * Provides detailed explanations of metrics with:
 * - Definition
 * - Calculation formula
 * - Data sources
 * - Academic citations (from METHODOLOGY.md)
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, ExternalLink, Calculator, Database, BookOpen } from 'lucide-react';

export type MetricType =
  | 'partisan_lean'
  | 'swing_potential'
  | 'gotv_priority'
  | 'persuasion_opportunity'
  | 'turnout_rate'
  | 'margin_of_victory'
  | 'vote_share'
  | 'competitiveness'
  | 'canvassing_efficiency'
  | 'tapestry_segment';

interface MetricDefinition {
  title: string;
  shortDescription: string;
  definition: string;
  formula?: string;
  dataSource: string;
  factors?: string[];
  scale?: string;
  citations?: Array<{
    author: string;
    title: string;
    source: string;
    url?: string;
  }>;
}

const METRIC_DEFINITIONS: Record<MetricType, MetricDefinition> = {
  partisan_lean: {
    title: 'Partisan Lean',
    shortDescription: 'Historical voting pattern on a D to R scale',
    definition:
      'Partisan lean measures the historical voting pattern of a precinct on a scale from -100 (strong Democrat) to +100 (strong Republican). A value of 0 indicates a perfectly balanced precinct.',
    formula:
      'Lean = (2024_margin × 0.5) + (2022_margin × 0.3) + (2020_margin × 0.2)\n\nWhere margin = (D_votes - R_votes) / total_votes × 100',
    dataSource: 'Historical election results from Ingham County Clerk (2020, 2022, 2024)',
    scale: '-100 (Safe D) to +100 (Safe R)',
    factors: [
      '2024 general election margin (50% weight)',
      '2022 general election margin (30% weight)',
      '2020 general election margin (20% weight)',
    ],
    citations: [
      {
        author: 'Rogers & Aida',
        title: 'Political Campaigns and Big Data',
        source: 'Harvard Kennedy School, 2014',
        url: 'https://scholar.harvard.edu/files/todd_rogers/files/political_campaigns_and_big_data_0.pdf',
      },
    ],
  },

  swing_potential: {
    title: 'Swing Potential',
    shortDescription: 'Likelihood of changing partisan outcome',
    definition:
      'Swing potential estimates the likelihood that a precinct could change its partisan outcome in future elections. High swing potential indicates competitive, persuadable areas.',
    formula:
      'Swing = f(margin_volatility, ticket_splitting, demographic_indicators)\n\nMargin volatility = std_dev(margins across elections)',
    dataSource: 'Election results, demographic data from ArcGIS Business Analyst',
    scale: '0-100 (higher = more likely to swing)',
    factors: [
      'Margin volatility across elections (high volatility = high swing)',
      'Proportion of ticket-splitters (different party for different offices)',
      'Demographic indicators (education, suburban density)',
      'Presence of independent voters',
    ],
    citations: [
      {
        author: 'Rogers & Aida',
        title: 'Political Campaigns and Big Data',
        source: 'Harvard Kennedy School, 2014',
        url: 'https://scholar.harvard.edu/files/todd_rogers/files/political_campaigns_and_big_data_0.pdf',
      },
    ],
  },

  gotv_priority: {
    title: 'GOTV Priority',
    shortDescription: 'Value of turnout mobilization efforts',
    definition:
      'GOTV (Get Out The Vote) Priority measures the value of investing turnout mobilization resources in a precinct. High priority indicates strong supporters who vote inconsistently.',
    formula:
      'GOTV_Priority = Support_Score × (1 - Turnout_Rate) × Voter_Count_Factor\n\nSupport_Score derived from partisan lean toward your party',
    dataSource: 'Election turnout data, voter registration counts',
    scale: '0-100 (higher = more valuable to mobilize)',
    factors: [
      'Support level (how likely voters are to support your candidate)',
      'Turnout gap (lower historical turnout = more room for improvement)',
      'Voter count (larger precincts have more impact)',
    ],
    citations: [
      {
        author: 'Green & Gerber',
        title: 'Get Out the Vote: How to Increase Voter Turnout',
        source: 'Brookings Institution Press, 2019',
        url: 'https://www.brookings.edu/books/get-out-the-vote/',
      },
      {
        author: 'Ragtag Helpdesk',
        title: 'How to Analyze the Voter File',
        source: 'Ragtag Documentation',
        url: 'https://helpdesk.ragtag.org/hc/en-us/articles/360016010232-How-to-Analyze-the-Voter-File',
      },
    ],
  },

  persuasion_opportunity: {
    title: 'Persuasion Opportunity',
    shortDescription: 'Proportion of persuadable voters',
    definition:
      'Persuasion opportunity estimates the proportion of voters in a precinct who could be persuaded to change their vote. Targets voters with support scores around 30-70.',
    formula:
      'Persuasion = f(margin_closeness, ticket_splitting, moderate_demographics)\n\nHigher values indicate more persuadable population',
    dataSource: 'Election margins, demographic data, Tapestry segmentation',
    scale: '0-100 (higher = more persuadable voters)',
    factors: [
      'Margin closeness (close margins = more persuadables)',
      'Ticket-splitting history',
      'Demographic indicators of moderate voters',
      'Presence of independent-leaning Tapestry segments',
    ],
    citations: [
      {
        author: 'Rogers & Aida',
        title: 'Political Campaigns and Big Data',
        source: 'Harvard Kennedy School, 2014',
        url: 'https://scholar.harvard.edu/files/todd_rogers/files/political_campaigns_and_big_data_0.pdf',
      },
    ],
  },

  turnout_rate: {
    title: 'Turnout Rate',
    shortDescription: 'Percentage of eligible voters who voted',
    definition:
      'Turnout rate is the percentage of registered voters in a precinct who cast ballots in an election. Higher turnout typically favors the party with better organization.',
    formula: 'Turnout_Rate = (Votes_Cast / Registered_Voters) × 100',
    dataSource: 'Official election results from Ingham County Clerk',
    scale: '0-100% of registered voters',
    factors: [
      'Election type (presidential years have higher turnout)',
      'Competitive races on ballot',
      'Demographic factors (age, education)',
      'Voter mobilization efforts',
    ],
  },

  margin_of_victory: {
    title: 'Margin of Victory',
    shortDescription: 'Point spread between winner and runner-up',
    definition:
      'Margin of victory is the percentage point difference between the winning candidate and the runner-up. Smaller margins indicate more competitive races.',
    formula: 'Margin = |Winner_Percentage - RunnerUp_Percentage|',
    dataSource: 'Official election results from Ingham County Clerk',
    scale: '0-100 percentage points',
    factors: [
      'Candidate quality and fundraising',
      'National political environment',
      'Local issues and demographics',
    ],
  },

  vote_share: {
    title: 'Vote Share',
    shortDescription: 'Percentage of votes received',
    definition:
      'Vote share is the percentage of total votes a candidate or party received in an election. Used to compare performance across precincts of different sizes.',
    formula: 'Vote_Share = (Candidate_Votes / Total_Votes) × 100',
    dataSource: 'Official election results from Ingham County Clerk',
    scale: '0-100% of votes cast',
  },

  competitiveness: {
    title: 'Competitiveness Classification',
    shortDescription: 'Safe, likely, lean, or toss-up rating',
    definition:
      'Competitiveness classification categorizes precincts based on their partisan lean, helping campaigns prioritize resources.',
    dataSource: 'Calculated from partisan lean score',
    scale:
      'safe_d (<-20) → likely_d (-20 to -10) → lean_d (-10 to -5) → toss_up (-5 to +5) → lean_r (+5 to +10) → likely_r (+10 to +20) → safe_r (>+20)',
    factors: [
      'Historical partisan lean',
      'Margin trends over recent elections',
      'National political environment',
    ],
  },

  canvassing_efficiency: {
    title: 'Canvassing Efficiency',
    shortDescription: 'Estimated doors per hour',
    definition:
      'Canvassing efficiency estimates how many doors a volunteer can knock in one hour, based on housing density and geographic layout.',
    formula:
      'Doors_Per_Hour = f(housing_density, road_network, building_type)\n\nUrban: 30-40, Suburban: 40-50, Rural: 20-30',
    dataSource: 'Census housing data, OpenStreetMap road network',
    scale: '20-50 doors per hour',
    factors: [
      'Housing density (doors per square mile)',
      'Building type (single-family vs. apartments)',
      'Road network connectivity',
      'Terrain and walkability',
    ],
    citations: [
      {
        author: 'Minnesota DFL',
        title: 'Turf Cutting Best Practices',
        source: 'DFL VAN Support',
        url: 'https://dflvan.freshdesk.com/support/solutions/articles/48001155890-turf-cutting-how-to-best-practices',
      },
    ],
  },

  tapestry_segment: {
    title: 'Tapestry Segmentation',
    shortDescription: 'ESRI lifestyle segment classification',
    definition:
      'Tapestry segmentation is ESRI\'s proprietary classification system that divides US neighborhoods into 67 unique lifestyle segments based on demographics, socioeconomics, and consumer behavior.',
    dataSource: 'ArcGIS Business Analyst (ESRI)',
    factors: [
      '60+ demographic, economic, and behavioral variables',
      'Census data (age, income, education, housing)',
      'Consumer spending patterns',
      'GfK MRI consumer survey data',
    ],
    citations: [
      {
        author: 'ESRI',
        title: 'How Do People Lean Politically in Pivotal Swing States?',
        source: 'ArcWatch, 2012',
        url: 'https://www.esri.com/news/arcwatch/1012/how-do-people-lean-politically-in-pivotal-swing-states.html',
      },
    ],
  },
};

interface MethodologyDialogProps {
  metric: MetricType;
  trigger?: React.ReactNode;
  compact?: boolean;
}

export function MethodologyDialog({
  metric,
  trigger,
  compact = false,
}: MethodologyDialogProps) {
  const definition = METRIC_DEFINITIONS[metric];

  if (!definition) {
    console.warn(`Unknown metric: ${metric}`);
    return null;
  }

  const defaultTrigger = compact ? (
    <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
    </Button>
  ) : (
    <Button variant="outline" size="sm">
      <HelpCircle className="h-4 w-4 mr-1" />
      Learn More
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {definition.title}
            {definition.scale && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {definition.scale.split(' ')[0]}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{definition.shortDescription}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Definition */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Definition
              </h4>
              <p className="text-sm text-muted-foreground">{definition.definition}</p>
            </div>

            {/* Formula */}
            {definition.formula && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Calculation
                </h4>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                  {definition.formula}
                </pre>
              </div>
            )}

            {/* Scale */}
            {definition.scale && (
              <div>
                <h4 className="text-sm font-medium mb-2">Scale</h4>
                <p className="text-sm text-muted-foreground">{definition.scale}</p>
              </div>
            )}

            {/* Factors */}
            {definition.factors && definition.factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Contributing Factors</h4>
                <ul className="list-disc list-inside space-y-1">
                  {definition.factors.map((factor, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Data Source */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Source
              </h4>
              <p className="text-sm text-muted-foreground">{definition.dataSource}</p>
            </div>

            {/* Citations */}
            {definition.citations && definition.citations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Academic References
                </h4>
                <div className="space-y-2">
                  {definition.citations.map((citation, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">{citation.author}</span>
                      {' - '}
                      <span className="italic">{citation.title}</span>
                      {' ('}
                      <span className="text-muted-foreground">{citation.source}</span>
                      {')'}
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-primary hover:underline inline-flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Link
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link to full methodology */}
            <div className="pt-4 border-t">
              <a
                href="/docs/methodology"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Complete Methodology Documentation
              </a>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * MetricLabel with built-in help icon
 * Use this to add methodology explanations inline with metric labels
 */
interface MetricLabelProps {
  metric: MetricType;
  label?: string;
  className?: string;
}

export function MetricLabel({ metric, label, className }: MetricLabelProps) {
  const definition = METRIC_DEFINITIONS[metric];
  const displayLabel = label || definition?.title || metric;

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      {displayLabel}
      <MethodologyDialog metric={metric} compact />
    </span>
  );
}

export { METRIC_DEFINITIONS };
export default MethodologyDialog;
