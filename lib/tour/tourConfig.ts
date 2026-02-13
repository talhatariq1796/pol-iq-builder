/**
 * Guided Tour Configuration
 *
 * Defines all tour steps for the Political Landscape Analysis Platform.
 * Updated December 2025 to match current UI and features.
 *
 * Each step can include an `onActivate` callback that triggers app state changes
 * when the step is highlighted, ensuring the UI matches what the step describes.
 */

import type { DriveStep, Config } from 'driver.js';
import type { TourAction } from './tourActions';

/**
 * Tour themes for different contexts
 */
export type TourTheme =
  | 'welcome'
  | 'segmentation'
  | 'comparison'
  | 'donor'
  | 'canvassing'
  | 'full'
  // Demo scenarios - comprehensive campaign walkthroughs (Democratic perspective)
  | 'demo-scenario'           // State House District 73 (Julie Brixie defense)
  | 'demo-scenario-senate'    // US Senate (statewide, Ingham County focus)
  | 'demo-scenario-congress'  // US House MI-07 (competitive district)
  // Workflow tours - specific task walkthroughs
  | 'workflow-find-swing'
  | 'workflow-analyze-precinct'
  | 'workflow-build-gotv'
  | 'workflow-find-donors'
  | 'workflow-plan-canvass'
  | 'workflow-compare-areas'
  // Cross-tool workflow tours
  | 'cross-tool-segment-to-canvass'  // Build segment → Plan canvass
  | 'cross-tool-analyze-to-donors'   // Analyze area → Find donors
  | 'cross-tool-full-workflow';      // Complete end-to-end campaign workflow

/**
 * Extended step type that includes actions to execute when step activates
 */
export interface TourStepWithAction extends DriveStep {
  /** Actions to execute when this step is highlighted */
  onActivate?: Array<{
    action: TourAction;
    params?: Record<string, unknown>;
    delay?: number;
  }>;
}

/**
 * Welcome tour steps - shown to first-time users
 * Quick introduction to the main interface
 */
export const WELCOME_TOUR_STEPS: TourStepWithAction[] = [
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI Assistant',
      description:
        'Your AI-powered campaign analyst. Ask natural language questions about areas, demographics, and targeting strategies. The AI understands political context and provides data-driven recommendations.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Interactive Political Map',
      description:
        'Click any precinct to see detailed voter statistics. The map shows all 145+ precincts in Ingham County with targeting scores, demographics, and election history. Use the layer controls to switch between views.',
      side: 'left',
      align: 'center',
    },
    // No action needed - map is always visible
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Analysis & IQ Builder',
      description:
        'Build custom voter segments, run area analysis, and generate reports. Select areas by clicking, drawing, or searching, then analyze demographics and targeting opportunities.',
      side: 'left',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: 'Need Help?',
      description:
        'Click here anytime to restart this tour or explore specific features like Voter Segmentation, Donor Analysis, or Canvassing Planning.',
      side: 'right',
      align: 'end',
    },
  },
];

/**
 * Full platform tour - comprehensive walkthrough of all features
 */
export const FULL_TOUR_STEPS: TourStepWithAction[] = [
  // Welcome Section - Core Interface
  ...WELCOME_TOUR_STEPS.slice(0, 3), // First 3 welcome steps (AI, Map, Analysis)

  // AI Chat Features - Ask the AI step
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI-Powered Analysis',
      description:
        'Ask questions like "Which precincts have highest swing potential?" or "Compare Lansing vs East Lansing." The AI analyzes your data and provides strategic recommendations with citations.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Which precincts have the highest swing potential?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Map Commands via AI',
      description:
        'The AI can control the map for you. Try "Show swing precincts as a heatmap" or "Highlight East Lansing precincts." Suggested actions appear as clickable buttons after each response.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'showHeatmap', params: { metric: 'swing_potential' }, delay: 200 },
    ],
  },

  // Map Features
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Precinct Selection',
      description:
        'Click any precinct to see a Feature Selection Card in the AI chat. This shows key metrics (voters, turnout, lean) and targeting scores (GOTV, Swing, Persuasion) with suggested next actions.',
      side: 'left',
      align: 'center',
    },
    // No action - map is visible
  },

  // Toolbar Features - Layer Toggle
  {
    element: '[data-tour="layer-toggle"]',
    popover: {
      title: 'Layer Type Selector',
      description:
        'Switch between visualization modes: Precincts (colored boundaries), H3 Hexagons (uniform grid), Bivariate (two metrics), Symbols (proportional), and VxA (value-by-alpha). Each reveals different insights.',
      side: 'bottom',
      align: 'start',
    },
  },

  // Toolbar Features - Temporal Mode
  {
    element: '[data-tour="temporal-toggle"]',
    popover: {
      title: 'Time-Series Mode',
      description:
        'Click "Time" to enable temporal mode. View election data across 2020, 2022, and 2024. Use playback controls to animate changes over time and spot voting trends.',
      side: 'bottom',
      align: 'center',
    },
  },

  // Toolbar Features - Basemap
  {
    element: '[data-tour="basemap-selector"]',
    popover: {
      title: 'Basemap Options',
      description:
        'Choose from Light Gray (default), Dark Gray (high contrast), Streets (street names), Topographic (terrain), Satellite, or Hybrid views to suit your analysis needs.',
      side: 'bottom',
      align: 'end',
    },
  },

  // Toolbar Features - Upload
  {
    element: '[data-tour="upload-button"]',
    popover: {
      title: 'Upload Your Data',
      description:
        'Add your own data files as overlay layers. Supports GeoJSON, CSV (with lat/lon columns), and Shapefiles (ZIP). Your uploaded layers appear on top of the political data.',
      side: 'bottom',
      align: 'end',
    },
  },

  // Analysis Panel Features
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Area Selection Methods',
      description:
        'Four ways to select areas: Click on the map, Draw a polygon, Search by name, or Select by boundary type (municipality, State House district, etc.).',
      side: 'left',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Analysis Results',
      description:
        'After selecting an area, see aggregated demographics, political metrics, and Tapestry lifestyle segments. Generate PDF reports or export data for your analysis.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
    ],
  },

  // Navigation & Tools
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: 'Explore More Features',
      description:
        'Use the sidebar navigation to access specialized tools: /segments for voter segmentation, /donors for FEC analysis, /canvass for field operations, and /compare for side-by-side comparison.',
      side: 'right',
      align: 'center',
    },
  },
];

/**
 * Segmentation-specific tour - expanded for comprehensive coverage
 */
export const SEGMENTATION_TOUR_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: 'Voter Segmentation',
      description:
        'Build custom voter universes by combining multiple filters. Navigate to /segments to access the full Segment Builder with demographic, political, electoral, and lifestyle filters.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Quick Segmentation',
      description:
        'Use the Analysis Panel to select areas and see demographic breakdowns. For advanced filtering, visit the dedicated Segments page from the sidebar.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI-Powered Segmentation',
      description:
        'Ask the AI to find specific voter groups: "Find suburban areas with college-educated voters where margins were under 5 points" or "Show areas with College Towns Tapestry segments." The AI understands context.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'focusChatInput', delay: 200 },
    ],
  },
  {
    popover: {
      title: 'Filter Options',
      description:
        'Filter by demographics (age, income, education), political lean (D/R margin), lifestyle (Tapestry segments), and electoral history (turnout, competitiveness).',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Save Segments',
      description:
        'Save your filtered segments for later use. Saved segments can be used in canvassing plans, donor prospecting, and reports. Ask "Save this as my student areas segment."',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Try It Now',
      description:
        'Try asking: "Find competitive areas with high college education" to see a filtered segment. You can then save it or use it for canvassing planning.',
      side: 'bottom',
      align: 'center',
    },
  },
];

/**
 * Comparison-specific tour - expanded for comprehensive coverage
 */
export const COMPARISON_TOUR_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: 'Comparison Tools',
      description:
        'Compare any two jurisdictions or areas side-by-side. Navigate to /compare for the full comparison interface, or ask the AI to compare areas directly.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI Comparison',
      description:
        'Ask "Compare Lansing vs East Lansing" or "What makes Meridian Township different from Delhi Township?" The AI provides detailed breakdowns of demographics, political lean, and key differences.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'focusChatInput', delay: 200 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Visual Comparison on Map',
      description:
        'When comparing two areas, both are highlighted on the map with different colors. This helps visualize geographic relationships and spot patterns.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Comparison Metrics',
      description:
        'The comparison shows key metrics side-by-side: population, demographics, political lean, turnout rates, and targeting scores. Use this to identify which area better fits your campaign strategy.',
      side: 'left',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    popover: {
      title: 'Try It Now',
      description:
        'Try asking: "Compare East Lansing with Meridian Township" to see a detailed side-by-side analysis. You can compare cities, townships, or individual areas.',
      side: 'bottom',
      align: 'center',
    },
  },
];

/**
 * Donor-specific tour - expanded for comprehensive coverage
 */
export const DONOR_TOUR_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: 'Donor Analysis',
      description:
        'Analyze FEC contribution data at the ZIP code level. Navigate to /donors for the full Donor Dashboard with segmentation, lapsed donor analysis, and upgrade potential scoring.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI Donor Insights',
      description:
        'Ask "Where are Democratic donors concentrated?" or "Which areas have lapsed donors we should re-engage?" The AI analyzes FEC data and provides fundraising recommendations.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'focusChatInput', delay: 200 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Donor Heatmaps',
      description:
        'View donor concentration by ZIP code on the map. The AI can show you donor heatmaps: "Show donor concentration as a heatmap" or "Highlight high-donor ZIP codes."',
      side: 'left',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Prospect Scoring',
      description:
        'Identify high-potential donors based on ZIP code wealth indicators, political lean, and historical giving patterns. Ask "Which areas have the best fundraising potential?"',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Lapsed Donor Re-engagement',
      description:
        'Find donors who gave in previous cycles but not recently. Ask "Show lapsed donors in East Lansing" to identify re-engagement opportunities for your fundraising outreach.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Try It Now',
      description:
        'Try asking: "Where are donors concentrated in Ingham County?" to see a breakdown of giving by area. You can also ask about specific party affiliations or giving ranges.',
      side: 'bottom',
      align: 'center',
    },
  },
];

/**
 * Canvassing-specific tour - expanded for comprehensive coverage
 */
export const CANVASSING_TOUR_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: 'Canvassing Planner',
      description:
        'Convert voter segments into actionable door-to-door operations. Navigate to /canvass for turf allocation, volunteer management, route optimization, and progress tracking.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'AI Canvassing Planning',
      description:
        'Ask "Create a canvassing plan for high-GOTV areas in Lansing" or "How many volunteer hours to knock 5,000 doors?" The AI helps optimize your field operations.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'focusChatInput', delay: 200 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Canvassing Visualization',
      description:
        'See your canvassing universe on the map. The AI can highlight target areas and show GOTV priority heatmaps to help you allocate resources efficiently.',
      side: 'left',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Area Selection',
      description:
        'Select areas for your canvass by clicking on the map, drawing a custom area, or using search. The AI can also recommend areas based on your targeting goals.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Universe Building',
      description:
        'Build your canvassing universe by combining filters: GOTV priority, demographic targeting, and geographic clustering. Ask "Build a canvassing universe for student areas" to get started.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Route Optimization',
      description:
        'Get estimated door counts and volunteer hours for your selected areas. The AI calculates efficient routing based on housing density and geographic clustering.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Try It Now',
      description:
        'Try asking: "How many doors in East Lansing and how long would it take to canvass?" to see estimated volunteer hours and door counts.',
      side: 'bottom',
      align: 'center',
    },
  },
];

// =============================================================================
// DEMO SCENARIO TOUR - "Defend State House District 73"
// A comprehensive campaign walkthrough using all platform features
// =============================================================================

/**
 * Demo Scenario Tour
 *
 * Story: You're a political consultant working on State House District 73
 * (MSU/Okemos/Mason area). Rep. Julie Brixie (D) holds this safe Democratic
 * seat (D+32.8, won by 28.5 points in 2024). While not competitive, the
 * district demonstrates full platform capabilities for base mobilization.
 *
 * This tour demonstrates all major platform features through a realistic
 * campaign planning workflow focused on maximizing turnout.
 *
 * Note: Ingham County State House Districts are 73, 74, 75, 76, and 77.
 * District 76 only partially covers Ingham County.
 */
export const DEMO_SCENARIO_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🎯 Demo: State House District 73 Strategy',
      description:
        'In this demo, you\'re a political consultant developing a field strategy for State House District 73 (MSU/Okemos/Mason area). Rep. Julie Brixie (D) holds this safe seat (D+32.8), but maximizing turnout here contributes to statewide Democratic margins.\n\n<strong>Your mission:</strong> Build a GOTV strategy to maximize Democratic vote yield.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'expandAnalysisPanel', delay: 100 },
      { action: 'showChoropleth', delay: 200 },
    ],
  },

  // =========================================================================
  // ACT 1: DISCOVERY & ANALYSIS
  // =========================================================================
  {
    popover: {
      title: 'Act 1: Discovery & Analysis',
      description:
        'First, let\'s understand the political landscape. We\'ll explore the district, identify swing precincts, and analyze the electorate.\n\n<em>The AI will now query the district automatically.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Analyzing the District',
      description:
        'Watch as the AI analyzes District 73. It will identify competitive precincts, show partisan lean, and highlight key opportunities.\n\n<em>No action needed - the query runs automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Show me the political landscape of State House District 73' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ Automated: Swing Potential Heatmap',
      description:
        'The map now shows swing potential across all precincts. Darker purple areas are more competitive - these are your persuasion targets.\n\n<em>The heatmap updates automatically.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'swing_potential' } },
      { action: 'flyToLocation', params: { target: 'East Lansing' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '📍 Automated: Selecting a Precinct',
      description:
        'Watch as the AI selects <strong>East Lansing Precinct 3</strong> - a competitive precinct near MSU campus. A Feature Card will appear with detailed voter statistics.\n\n<em>The selection happens automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'selectPrecinct', params: { precinctId: 'East Lansing 3' }, delay: 300 },
      // Note: showFeatureCard removed - selectPrecinct already triggers feature card display
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '📊 Review the Feature Card',
      description:
        'The Feature Card shows:\n\n• <strong>Voter count & turnout rate</strong>\n• <strong>Partisan lean</strong> (D+/R+)\n• <strong>GOTV Priority</strong> - mobilization value\n• <strong>Swing Potential</strong> - persuadability\n• <strong>Suggested actions</strong> - click to explore\n\n<em>Continue to see how to find similar precincts.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
    ],
  },

  // =========================================================================
  // ACT 2: VOTER SEGMENTATION
  // =========================================================================
  {
    popover: {
      title: 'Act 2: Voter Segmentation',
      description:
        'Now let\'s build targeted voter universes. We\'ll create segments for:\n\n1. <strong>Persuasion</strong> - swing voters in competitive precincts\n2. <strong>GOTV</strong> - low-turnout Democratic-leaning areas\n\n<em>The AI will help you build these segments.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Finding Swing Voters',
      description:
        'Watch as the AI finds college-educated precincts with competitive margins - ideal for persuasion campaigns.\n\n<em>The query runs automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Find precincts with swing potential over 40 and college education above 50%' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗳️ GOTV Priority Heatmap',
      description:
        'The GOTV priority heatmap shows where turnout mobilization has the biggest impact. <strong>Yellow/orange = higher priority.</strong>\n\n<em>These are your GOTV Universe targets.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Building GOTV Universe',
      description:
        'Now let\'s find specific GOTV targets - Democratic-leaning precincts with lower turnout where mobilization matters most.\n\n<em>The AI queries automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'typeInChat', params: { text: 'Which precincts have D+15 or higher lean but turnout under 65%?' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🎯 Highlighting GOTV Matches',
      description:
        'The matching precincts are now highlighted on the map. These are your <strong>GOTV Universe</strong> - Democratic-leaning voters who need mobilization.\n\n<em>Notice how they cluster in Lansing urban areas.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'highlightPrecincts', params: { precincts: ['Lansing 1-1', 'Lansing 1-3', 'Lansing 2-12', 'Lansing 3-23'] }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '💾 Save Your Segment',
      description:
        'You\'ve identified your GOTV universe! To save these precincts as a reusable segment:\n\n1. Go to <strong>/segments</strong> from the sidebar\n2. Apply the same filters (D+15 lean, turnout under 65%)\n3. Click <strong>Save Segment</strong> and name it\n\n<em>Saved segments can be exported to CSV or used for canvassing.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 3: COMPARISON ANALYSIS
  // =========================================================================
  {
    popover: {
      title: 'Act 3: Comparison Analysis',
      description:
        'Let\'s compare areas side-by-side to understand what makes them different. This helps identify which strategies work where.\n\n<em>The AI will compare East Lansing vs Meridian.</em>',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'clearHighlight', delay: 200 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Comparing Areas',
      description:
        'Watch as the AI compares East Lansing (university town) with Meridian Township (affluent suburbs). You\'ll see how demographics and voting patterns differ.\n\n<em>Query runs automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Compare East Lansing with Meridian Township - what are the key differences?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🔍 Comparison Visualization',
      description:
        'The AI response includes demographic breakdowns, partisan lean, turnout patterns, and Tapestry lifestyle segments.\n\n<strong>Key insight:</strong> East Lansing is younger, more transient (students), while Meridian is older, wealthier, more stable.\n\n<em>Visit /compare for full split-screen comparison.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'flyToLocation', params: { target: 'East Lansing' } },
    ],
  },

  // =========================================================================
  // ACT 4: DONOR INTELLIGENCE
  // =========================================================================
  {
    popover: {
      title: 'Act 4: Donor Intelligence',
      description:
        'No campaign runs without fundraising. Let\'s find where donors are concentrated and identify upgrade opportunities.\n\n<em>The AI will analyze FEC contribution data.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Finding Donors',
      description:
        'The AI analyzes FEC data to find Democratic donor concentrations by ZIP code.\n\n<em>Query runs automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Where are Democratic donors concentrated in Ingham County?' }, delay: 300 },
      // Show persuasion opportunity heatmap - correlates with donor potential (educated, affluent voters)
      { action: 'showHeatmap', params: { metric: 'persuasion_opportunity' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '💰 Donor Geography',
      description:
        'The map shows <strong>persuasion opportunity</strong> - areas with educated, affluent voters who correlate with donor capacity.\n\n• <strong>Darker areas</strong> = Higher donor potential\n• Key areas: East Lansing, Okemos, Meridian Township\n\n<em>High persuasion areas often have more Democratic donors.</em>',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '💰 Donor Insights',
      description:
        'The AI shows:\n\n• <strong>Top donor ZIP codes</strong> with total giving\n• <strong>Average gift size</strong> by area\n• <strong>Donor occupations</strong> (educators, retirees, etc.)\n• <strong>Lapsed donors</strong> for re-engagement\n\n<em>Visit /donors for the full Donor Dashboard with prospect scoring.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 5: CANVASSING OPERATIONS
  // =========================================================================
  {
    popover: {
      title: 'Act 5: Canvassing Operations',
      description:
        'Finally, let\'s convert our segments into door-knocking operations. We\'ll estimate volunteer hours and optimize routes.\n\n<em>The AI will calculate canvassing requirements.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Canvass Planning',
      description:
        'The AI calculates door counts and volunteer hours needed for your GOTV universe.\n\n<em>Query runs automatically.</em>',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'How many doors and volunteer hours to canvass East Lansing and Lansing high-GOTV precincts?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🚶 Route Visualization',
      description:
        'The AI estimates:\n\n• <strong>Door counts</strong> per precinct\n• <strong>Hours needed</strong> (30-50 doors/hour based on density)\n• <strong>Geographic clusters</strong> for efficient routing\n\n<em>Urban areas are faster to canvass than rural spread.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'highlightPrecincts', params: { precincts: ['Lansing 1-8', 'Lansing 1-9', 'Lansing 2-12', 'East Lansing 1', 'East Lansing 3'] }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '📋 Canvass Deliverables',
      description:
        'From /canvass you can:\n\n• Assign turfs to volunteer teams\n• Export walk lists (CSV)\n• Track completion progress\n• Generate walk sheet PDFs\n\n<em>The platform handles the logistics so you focus on strategy.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 6: REPORTS & EXPORTS
  // =========================================================================
  {
    popover: {
      title: 'Act 6: Reports & Exports',
      description:
        'Every analysis can be exported or turned into professional reports.\n\n<strong>Available exports:</strong>\n• Precinct Profile PDFs (7 pages)\n• Segment CSV files (26 columns)\n• Comparison reports\n• Canvass walk lists\n• Knowledge graph data (JSON/CSV)',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'showChoropleth', delay: 200 },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 400 },
    ],
  },

  // =========================================================================
  // SUMMARY & NEXT STEPS
  // =========================================================================
  {
    popover: {
      title: '✅ Campaign Strategy Complete!',
      description:
        'You\'ve now seen the full platform workflow:\n\n1. ✅ <strong>Discovery</strong> - Analyzed District 73\n2. ✅ <strong>Segmentation</strong> - Built persuasion & GOTV universes\n3. ✅ <strong>Comparison</strong> - Compared East Lansing vs Meridian\n4. ✅ <strong>Donors</strong> - Found fundraising opportunities\n5. ✅ <strong>Canvassing</strong> - Planned field operations\n6. ✅ <strong>Exports</strong> - Ready for deliverables',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: '🎯 Your Deliverables',
      description:
        '<strong>For District 73, you identified:</strong>\n\n• 12 high-priority precincts (~45,000 voters)\n• 8 swing precincts for persuasion\n• 6 GOTV precincts for mobilization\n• 3 ZIP codes with $250K+ donor capacity\n• 5 canvass routes covering 2,100 doors/weekend\n\n<strong>Key insight:</strong> Focus "College Towns" messaging on education policy.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: '🚀 Explore More',
      description:
        'Ready to try it yourself?\n\n• Click <strong>Tours</strong> anytime for feature guides\n• Use the <strong>sidebar navigation</strong> to visit each tool\n• Ask the <strong>AI anything</strong> about your data\n\n<strong>Pro tip:</strong> The AI understands natural language - just describe what you want to find!',
      side: 'right',
      align: 'end',
    },
  },
];

// =============================================================================
// DEMO SCENARIO TOUR - "Win the US Senate Seat"
// Statewide campaign with Ingham County focus (Democratic perspective)
// =============================================================================

/**
 * Demo Scenario: US Senate Campaign
 *
 * Story: You're a political consultant working for the Democratic Senate candidate
 * in Michigan. The race is competitive statewide. You're analyzing Ingham County
 * (Lansing metro) - a key Democratic stronghold that must deliver high turnout
 * and margins to offset losses in rural areas.
 *
 * This tour demonstrates strategic analysis for a statewide campaign,
 * focusing on how a single county contributes to the overall win number.
 */
export const DEMO_SCENARIO_SENATE_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🏛️ Demo: US Senate Campaign Strategy',
      description:
        'In this demo, you\'re developing a field strategy for the Democratic US Senate candidate in Michigan. Ingham County (Lansing metro) is a critical Democratic stronghold.\n\n<strong>Your mission:</strong> Maximize Democratic turnout and margins in Ingham County to contribute to the statewide win number.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'expandAnalysisPanel', delay: 100 },
      { action: 'showChoropleth', delay: 200 },
    ],
  },
  {
    popover: {
      title: '📊 The Senate Math',
      description:
        'In a statewide race, every county matters. Ingham County typically delivers:\n\n• <strong>~150,000 votes</strong> in a presidential year\n• <strong>D+20 to D+25</strong> partisan lean\n• <strong>Net ~30,000-40,000 Democratic votes</strong>\n\nThis margin helps offset Republican advantages in outstate Michigan.',
      side: 'bottom',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 1: COUNTY-WIDE LANDSCAPE
  // =========================================================================
  {
    popover: {
      title: 'Act 1: County-Wide Landscape',
      description:
        'First, let\'s understand Ingham County\'s political geography. We\'ll identify where to focus limited statewide campaign resources for maximum impact.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Analyzing Ingham County',
      description:
        'Watch as the AI provides a county-wide political overview. For a Senate campaign, we care about total vote yield and Democratic margins.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Give me a political overview of Ingham County for a Democratic Senate campaign' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ Partisan Lean Across the County',
      description:
        'The choropleth shows partisan lean by precinct. <strong>Blue = Democratic</strong>, Red = Republican.\n\n• <strong>Dark blue (D+20+):</strong> Lansing, East Lansing - maximize turnout\n• <strong>Light blue (D+5-15):</strong> Suburbs - persuasion + turnout\n• <strong>Red areas:</strong> Rural townships - minimize losses',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🎯 Strategic Priorities',
      description:
        'For a Senate campaign in a Democratic stronghold:\n\n1. <strong>GOTV in base areas</strong> - Lansing, East Lansing (students!)\n2. <strong>Persuasion in suburbs</strong> - Meridian, Delhi, Okemos\n3. <strong>Damage control in rural</strong> - Don\'t over-invest, but don\'t ignore\n\n<em>The AI will help identify these universes.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 2: MAXIMIZING BASE TURNOUT
  // =========================================================================
  {
    popover: {
      title: 'Act 2: Maximizing Base Turnout',
      description:
        'In a statewide race, Democratic strongholds must over-perform. Let\'s identify where turnout mobilization has the biggest impact on the county\'s contribution to the win number.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Finding GOTV Priorities',
      description:
        'The AI identifies precincts where additional turnout yields the most net Democratic votes. These are D+15 or higher areas with room for turnout improvement.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Find high-GOTV priority precincts that lean D+15 or more for maximum Democratic turnout' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗳️ GOTV Priority Heatmap',
      description:
        'Darker green = higher GOTV priority. Notice the concentration in:\n\n• <strong>Central Lansing</strong> - Working-class Democratic base\n• <strong>East Lansing</strong> - MSU students (low midterm turnout!)\n• <strong>South Lansing</strong> - Diverse, younger voters\n\n<em>These areas can add thousands of net Democratic votes.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
      { action: 'flyToLocation', params: { target: 'Lansing' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🎓 The Student Vote',
      description:
        'East Lansing\'s MSU precincts are <strong>critical</strong> for Senate campaigns:\n\n• ~30,000 student voters in East Lansing\n• Turnout swings wildly (45% midterm → 70% presidential)\n• Every 5-point turnout increase = ~1,500 net Democratic votes\n\n<em>Ask about student-focused strategies.</em>',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'flyToLocation', params: { target: 'East Lansing' } },
      { action: 'highlightPrecincts', params: { precincts: ['East Lansing 1', 'East Lansing 3', 'East Lansing 4', 'East Lansing 6', 'East Lansing 7'] }, delay: 500 },
    ],
  },

  // =========================================================================
  // ACT 3: SUBURBAN PERSUASION
  // =========================================================================
  {
    popover: {
      title: 'Act 3: Suburban Persuasion',
      description:
        'Michigan\'s suburban voters have trended Democratic since 2016. Let\'s identify persuadable voters in Ingham\'s affluent suburbs who can be moved with the right message.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'showChoropleth', delay: 200 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Finding Persuadable Suburbs',
      description:
        'The AI identifies suburban precincts with:\n• College-educated voters (responsive to policy messaging)\n• Recent Democratic trend (Obama→Clinton→Biden)\n• High swing potential scores',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Find suburban precincts with high persuasion opportunity and college education above 50%' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🏡 Persuasion Opportunity Map',
      description:
        'The persuasion heatmap highlights:\n\n• <strong>Meridian Township</strong> - Affluent, educated, trending D\n• <strong>Okemos</strong> - Professional class, responsive to healthcare/education\n• <strong>Haslett</strong> - Swing area, competitive\n\n<em>These voters decide close statewide races.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'persuasion_opportunity' } },
      { action: 'flyToLocation', params: { target: 'Meridian Township' }, delay: 500 },
    ],
  },

  // =========================================================================
  // ACT 4: DONOR NETWORK
  // =========================================================================
  {
    popover: {
      title: 'Act 4: Fundraising Geography',
      description:
        'Senate campaigns are expensive ($50M+ in Michigan). Let\'s identify where Democratic donors are concentrated for fundraising events and house parties.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Mapping the Donor Base',
      description:
        'The AI analyzes FEC contribution data to find Democratic donor concentrations by ZIP code.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Where are Democratic donors concentrated for fundraising in Ingham County?' }, delay: 300 },
      // Show persuasion opportunity heatmap - correlates with donor potential
      { action: 'showHeatmap', params: { metric: 'persuasion_opportunity' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '💰 Donor Geography',
      description:
        'The map highlights areas with high donor potential. Persuasion opportunity correlates with:\n\n• <strong>College-educated voters</strong>\n• <strong>Higher income households</strong>\n• <strong>Professional occupations</strong>',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '💰 Donor Intelligence',
      description:
        'Key donor areas in Ingham County:\n\n• <strong>48823 (East Lansing)</strong> - Faculty, professionals\n• <strong>48864 (Okemos)</strong> - Affluent families\n• <strong>48912 (East Lansing)</strong> - Older donors, high gift size\n\n<em>Plan house parties in high-donor ZIPs for efficient fundraising.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 5: FIELD OPERATIONS
  // =========================================================================
  {
    popover: {
      title: 'Act 5: Deploying Field Resources',
      description:
        'With limited statewide resources, Ingham County gets a modest field team. Let\'s optimize where to deploy them for maximum vote yield.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Canvass Planning',
      description:
        'The AI calculates optimal canvassing allocation based on GOTV priority and voter density.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'How many volunteer shifts to canvass high-GOTV precincts in Lansing and East Lansing?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🚶 Canvassing Priorities',
      description:
        'For a Senate campaign in Ingham:\n\n• <strong>Priority 1:</strong> East Lansing student precincts (high yield, low turnout)\n• <strong>Priority 2:</strong> Central Lansing (dense, efficient)\n• <strong>Priority 3:</strong> Suburban swing areas (persuasion + GOTV)\n\n<em>Concentrate resources where vote yield per hour is highest.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'highlightPrecincts', params: { precincts: ['East Lansing 1', 'East Lansing 3', 'Lansing 1-8', 'Lansing 1-9', 'Lansing 2-12'] }, delay: 300 },
    ],
  },

  // =========================================================================
  // SUMMARY
  // =========================================================================
  {
    popover: {
      title: '✅ Senate Strategy Complete!',
      description:
        'You\'ve developed an Ingham County strategy for the Democratic Senate campaign:\n\n1. ✅ <strong>County overview</strong> - Understood the D+20 stronghold\n2. ✅ <strong>GOTV priorities</strong> - Identified student + urban turnout targets\n3. ✅ <strong>Suburban persuasion</strong> - Found educated swing voters\n4. ✅ <strong>Donor geography</strong> - Mapped fundraising opportunities\n5. ✅ <strong>Field allocation</strong> - Optimized canvassing resources',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'showChoropleth', delay: 200 },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 400 },
    ],
  },
  {
    popover: {
      title: '🎯 Ingham County Contribution',
      description:
        '<strong>Target for Ingham County:</strong>\n\n• 160,000+ total votes (maximize turnout)\n• D+22 margin (net +35,000 Democratic)\n• 85%+ student turnout in East Lansing\n• $500K+ raised from local donors\n\n<strong>Key message:</strong> Protect reproductive rights, support public education, defend democracy.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: '🚀 Scale Statewide',
      description:
        'This analysis can be repeated for all 83 Michigan counties. Focus on:\n\n• <strong>Wayne County</strong> - Detroit (biggest D stronghold)\n• <strong>Oakland/Macomb</strong> - Suburban battleground\n• <strong>Kent County</strong> - Grand Rapids (competitive)\n• <strong>Washtenaw</strong> - Ann Arbor (D stronghold)\n\n<em>Expand the platform to win statewide!</em>',
      side: 'right',
      align: 'end',
    },
  },
];

// =============================================================================
// DEMO SCENARIO TOUR - "Flip MI-07 Congressional"
// Competitive congressional district (Democratic challenger perspective)
// =============================================================================

/**
 * Demo Scenario: US House MI-07 Campaign
 *
 * Story: You're working for the Democratic challenger in Michigan's 7th
 * Congressional District. MI-07 is currently held by Rep. Tom Barrett (R)
 * who won by just 4.8 points in 2024. The district leans R+2.5 but includes
 * all of Ingham County (Democratic stronghold) plus parts of surrounding
 * Republican-leaning counties. It's a top Democratic pickup opportunity.
 *
 * This tour demonstrates targeting for a competitive House race where
 * every precinct matters.
 */
export const DEMO_SCENARIO_CONGRESS_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🏛️ Demo: Flip MI-07 Congressional',
      description:
        'In this demo, you\'re developing a strategy to <strong>flip MI-07</strong> for the Democratic challenger. This competitive district includes all of Ingham County.\n\n<strong>Your mission:</strong> Build a winning coalition by combining base turnout in Lansing with suburban persuasion and rural damage control.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'expandAnalysisPanel', delay: 100 },
      { action: 'showChoropleth', delay: 200 },
    ],
  },
  {
    popover: {
      title: '📊 The MI-07 Battleground',
      description:
        'MI-07 is a <strong>true swing district</strong>:\n\n• Rep. Tom Barrett (R) won by just 4.8 points in 2024\n• District leans R+2.5 overall\n• Ingham County (D stronghold) vs. surrounding R counties\n• Every precinct is in play\n\n<em>This is a top Democratic pickup opportunity.</em>',
      side: 'bottom',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 1: DISTRICT ANALYSIS
  // =========================================================================
  {
    popover: {
      title: 'Act 1: Know Your Battlefield',
      description:
        'First, let\'s analyze MI-07\'s Ingham County portion. We need to understand which precincts are safely Democratic, which are competitive, and which are Republican.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Analyzing MI-07',
      description:
        'The AI provides a breakdown of MI-07\'s Ingham County precincts by competitiveness.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Analyze MI-07 congressional district - show me the competitive breakdown in Ingham County' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ The Three Zones',
      description:
        'For a competitive House race, think in zones:\n\n🔵 <strong>Blue Zone (D+10+):</strong> Lansing, East Lansing - 40% of vote, GOTV focus\n🟣 <strong>Purple Zone (±10):</strong> Suburbs - 35% of vote, persuasion battleground\n🔴 <strong>Red Zone (R+10+):</strong> Rural townships - 25% of vote, damage control',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 300 },
    ],
  },

  // =========================================================================
  // ACT 2: THE PERSUASION UNIVERSE
  // =========================================================================
  {
    popover: {
      title: 'Act 2: Building the Persuasion Universe',
      description:
        'In a swing district, persuasion is everything. Let\'s identify the precincts where swing voters will decide this race.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Finding Swing Precincts',
      description:
        'The AI identifies precincts with high swing potential - areas where voters have switched between parties in recent elections.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Find the most competitive swing precincts in MI-07 where persuasion campaigns will be most effective' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🎯 Swing Potential Heatmap',
      description:
        'Darker purple = higher swing potential. Key battlegrounds:\n\n• <strong>Meridian Township</strong> - Educated suburbanites, ticket-splitters\n• <strong>Delhi Township</strong> - Working-class swing voters\n• <strong>Lansing outer precincts</strong> - Mixed demographics\n\n<em>These precincts decide MI-07.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'swing_potential' } },
      { action: 'flyToLocation', params: { target: 'Meridian Township' }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '📋 Persuasion Targets',
      description:
        'Your persuasion universe should focus on:\n\n• <strong>Ticket-splitters</strong> - Voted Biden but also Republican downballot\n• <strong>Soft Republicans</strong> - Romney/McCain voters who dislike MAGA\n• <strong>Independents</strong> - Especially in suburban precincts\n\n<em>Messaging: bipartisan problem-solver, local focus.</em>',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 3: GOTV UNIVERSE
  // =========================================================================
  {
    popover: {
      title: 'Act 3: Mobilizing the Democratic Base',
      description:
        'Even in a swing district, GOTV matters. Increasing turnout in D+15 precincts by just 5 points can net thousands of votes.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: GOTV Priorities',
      description:
        'The AI finds Democratic-leaning precincts where turnout mobilization yields the most net votes.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Which precincts have the highest GOTV priority for Democrats in MI-07?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗳️ GOTV Priority Map',
      description:
        'GOTV focus areas for MI-07:\n\n• <strong>East Lansing student precincts</strong> - Low midterm turnout, huge upside\n• <strong>Central Lansing</strong> - Working-class base, needs mobilization\n• <strong>South Lansing</strong> - Diverse voters, lower turnout\n\n<em>Every additional vote from these areas is a net Democratic vote.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
      { action: 'flyToLocation', params: { target: 'Lansing' }, delay: 500 },
    ],
  },

  // =========================================================================
  // ACT 4: COMPARATIVE ANALYSIS
  // =========================================================================
  {
    popover: {
      title: 'Act 4: Understanding Voter Segments',
      description:
        'Let\'s compare different areas to understand what messages resonate where. This helps tailor your voter contact strategy.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'clearHighlight', delay: 200 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Area Comparison',
      description:
        'The AI compares East Lansing (urban/student) with Delhi Township (suburban/working-class) to show how different voter segments require different approaches.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Compare East Lansing voters with Delhi Township - what different approaches should we use?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '📊 Segment Insights',
      description:
        '<strong>East Lansing approach:</strong>\n• Young voters, students\n• Focus on climate, student debt, abortion rights\n• Digital-first outreach, campus events\n\n<strong>Delhi Township approach:</strong>\n• Working families, homeowners\n• Focus on economy, healthcare costs, property taxes\n• Door-to-door, community events',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // ACT 5: RESOURCE ALLOCATION
  // =========================================================================
  {
    popover: {
      title: 'Act 5: Winning Resource Allocation',
      description:
        'A House campaign has limited resources. Let\'s optimize where to deploy staff, volunteers, and paid media for maximum impact.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Automated: Resource Planning',
      description:
        'The AI calculates optimal resource allocation across persuasion and GOTV universes.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'How should we allocate canvassing resources between persuasion in suburbs and GOTV in Lansing for MI-07?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '⚖️ The Winning Formula',
      description:
        'For MI-07, the optimal split is typically:\n\n• <strong>50% Persuasion</strong> - Suburban swing precincts\n• <strong>35% GOTV</strong> - Lansing + East Lansing base\n• <strong>15% Defense</strong> - Soft D areas that might slip\n\n<em>Adjust based on polling and early vote data.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'combined_score' } },
    ],
  },

  // =========================================================================
  // ACT 6: PATH TO VICTORY
  // =========================================================================
  {
    popover: {
      title: 'Act 6: The Path to Victory',
      description:
        'Let\'s calculate what it takes to win MI-07 by building a precinct-level vote target model.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🎯 Win Number Calculation',
      description:
        'To flip MI-07, you need to:\n\n<strong>In Ingham County (your stronghold):</strong>\n• Win by 8-10 points (net +12,000 votes)\n• Hit 75% turnout in D precincts\n• Win persuadable suburbs by 5+ points\n\n<strong>Offset losses elsewhere in district:</strong>\n• Other counties lean R by ~6-8 points\n• Ingham margin must overcome that deficit',
      side: 'right',
      align: 'center',
    },
  },

  // =========================================================================
  // SUMMARY
  // =========================================================================
  {
    popover: {
      title: '✅ MI-07 Strategy Complete!',
      description:
        'You\'ve built a comprehensive strategy to flip MI-07:\n\n1. ✅ <strong>Battlefield analysis</strong> - Mapped the three zones\n2. ✅ <strong>Persuasion universe</strong> - Identified swing precincts\n3. ✅ <strong>GOTV universe</strong> - Targeted base mobilization\n4. ✅ <strong>Voter segments</strong> - Tailored messaging by area\n5. ✅ <strong>Resource allocation</strong> - Optimized campaign spending\n6. ✅ <strong>Path to victory</strong> - Defined the win number',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'showChoropleth', delay: 200 },
    ],
  },
  {
    popover: {
      title: '🏆 Your Campaign Plan',
      description:
        '<strong>MI-07 Victory Targets:</strong>\n\n• Win Ingham County by <strong>D+10</strong> (net +15,000)\n• Flip 12 swing precincts from 2022\n• 80% student turnout in East Lansing\n• Hold suburban margins from 2020\n\n<strong>Key message:</strong> Independent voice for Michigan, focused on lowering costs and protecting rights.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: '🚀 Execute the Plan',
      description:
        'Now you can:\n\n• Export voter segments for your voter file\n• Generate canvassing walk lists\n• Create precinct reports for field staff\n• Track progress against targets\n\n*This platform turns strategy into action.*',
      side: 'right',
      align: 'end',
    },
  },
];

// =============================================================================
// WORKFLOW TOURS - Task-specific walkthroughs
// =============================================================================

/**
 * Workflow: Find Swing Areas
 * Goal: Identify competitive areas for persuasion campaigns
 */
export const WORKFLOW_FIND_SWING_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '🎯 Workflow: Find Swing Areas',
      description:
        'This workflow will teach you how to identify competitive areas where voters are persuadable. Perfect for targeting persuasion campaigns.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 1: Ask the AI',
      description:
        'Type a question like: "Show me the most competitive precincts" or "Which precincts have the highest swing potential?" The AI will identify swing areas based on historical voting patterns.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Show me the most competitive swing precincts' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 2: View on Map',
      description:
        'The AI will highlight swing precincts on the map. Look for areas colored by swing potential - darker colors indicate more competitive areas. Click any precinct to see details.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'swing_potential' } },
      { action: 'highlightPrecincts', params: { precincts: ['East Lansing 1', 'East Lansing 3', 'Lansing 1-4', 'Lansing 4-37'] }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 3: Dig Deeper',
      description:
        'Click a suggested action like "Show heatmap" to visualize swing potential across all precincts. Ask follow-up questions: "Why is this precinct competitive?" or "What demographics drive this?"',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
    ],
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Step 4: Build a Segment',
      description:
        'Once you\'ve identified swing precincts, use the Analysis Panel to save them as a segment. This lets you export the list for canvassing or generate reports.',
      side: 'left',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
      { action: 'clearHighlight', delay: 200 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You now know how to find swing areas. Try asking the AI: "Find areas where margins were under 5 points in the last 3 elections."',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
    ],
  },
];

/**
 * Workflow: Analyze a Precinct
 * Goal: Deep-dive into a specific precinct's data
 */
export const WORKFLOW_ANALYZE_PRECINCT_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '🔍 Workflow: Analyze a Precinct',
      description:
        'Learn how to get detailed information about any precinct - demographics, voting history, lifestyle segments, and targeting recommendations.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'showChoropleth' },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 1: Click a Precinct',
      description:
        'Click any precinct on the map. This selects it and opens a Feature Card in the AI panel showing key metrics: voter count, turnout rate, partisan lean, and targeting scores.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'flyToLocation', params: { target: 'East Lansing' } },
      { action: 'highlightPrecincts', params: { precincts: ['East Lansing 3'] }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 2: Review the Feature Card',
      description:
        'The AI shows you GOTV Priority, Swing Potential, and Persuasion Opportunity scores. These help you prioritize precincts for different campaign strategies. Click any suggested action to learn more.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 3: Ask Follow-up Questions',
      description:
        'Get deeper insights by asking: "What Tapestry segments live here?" "How has turnout changed over time?" "What makes this precinct unique?" The AI provides detailed analysis.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'What Tapestry lifestyle segments live in East Lansing?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Step 4: Compare or Export',
      description:
        'Use the Analysis Panel to compare this precinct with others, or generate a report. You can also find similar precincts to expand your targeting.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
      { action: 'clearHighlight', delay: 200 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You can now analyze any precinct in depth. Try clicking different precincts to compare their characteristics.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'zoomToExtent', params: { zoom: 10 } },
    ],
  },
];

/**
 * Workflow: Build a GOTV Universe
 * Goal: Create a targeted list of precincts for turnout campaigns
 */
export const WORKFLOW_BUILD_GOTV_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '🗳️ Workflow: Build a GOTV Universe',
      description:
        'Create a targeted universe of precincts for Get Out The Vote campaigns. You\'ll learn to identify high-potential turnout areas and save them for canvassing.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'expandAnalysisPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 1: Define Your Target',
      description:
        'Ask the AI: "Find precincts with high GOTV priority" or "Show me areas with strong Democratic lean but low turnout." The AI identifies precincts where mobilization has the biggest impact.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Which precincts have the highest GOTV priority?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 2: Review the Results',
      description:
        'The AI highlights matching precincts on the map. You\'ll see a GOTV Priority heatmap - darker areas have more turnout potential. Click precincts to see voter counts and current turnout rates.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
      { action: 'highlightPrecincts', params: { precincts: ['Lansing 1-8', 'Lansing 1-9', 'Lansing 1-10', 'Lansing 2-12'] }, delay: 500 },
    ],
  },
  {
    element: '[data-tour="analysis-panel"]',
    popover: {
      title: 'Step 3: Refine Your Universe',
      description:
        'Use the Analysis Panel filters to narrow down your list. Consider geographic clustering (easier canvassing), population density (doors per hour), and total voter count.',
      side: 'left',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAnalysisPanel' },
      { action: 'clearHighlight', delay: 200 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 4: Save and Plan',
      description:
        'Click "Save Segment" to save your GOTV universe. Ask the AI: "How many doors in this segment?" or "Create a canvassing plan for these precincts" to estimate volunteer needs.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'How many volunteer hours to canvass East Lansing?' }, delay: 300 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You\'ve built a GOTV universe! Navigate to /canvass to convert this into turf assignments, or export to CSV for your voter file vendor.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
    ],
  },
];

/**
 * Workflow: Find Top Donor Areas
 * Goal: Identify geographic concentrations of donors
 */
export const WORKFLOW_FIND_DONORS_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '💰 Workflow: Find Top Donor Areas',
      description:
        'Discover where your donors are concentrated and identify areas with untapped fundraising potential using FEC contribution data.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 1: Ask About Donors',
      description:
        'Ask: "Where are donors concentrated?" or "Show me top donor ZIP codes." The AI analyzes FEC data to find geographic patterns in political giving.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Where are donors concentrated?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 2: View High-Potential Areas',
      description:
        'While the AI retrieves donor data by ZIP code, the map shows persuasion opportunity - areas with educated, affluent voters who often correlate with donor capacity. Visit /donors for the full donor heatmap.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'persuasion_opportunity' } },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 3: Analyze Patterns',
      description:
        'Ask follow-up questions: "What occupations give the most?" "Are there lapsed donors we should re-engage?" "Which areas have high average gifts?" The AI provides fundraising insights.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Which occupations contribute the most?' }, delay: 300 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You know how to find donor concentrations. Visit /donors for the full Donor Dashboard with RFM segmentation, lapsed donor analysis, and more.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
    ],
  },
];

/**
 * Workflow: Plan a Canvass
 * Goal: Convert a segment into canvassing operations
 */
export const WORKFLOW_PLAN_CANVASS_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '🚶 Workflow: Plan a Canvass',
      description:
        'Convert your voter segments into actionable door-knocking plans with volunteer hour estimates and route optimization.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 1: Define Your Universe',
      description:
        'Start by asking: "Show me high-GOTV precincts in Lansing" or load a saved segment. The AI will highlight your target area on the map.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Show me high-GOTV precincts in Lansing' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 2: Review Geographic Spread',
      description:
        'Look at how your target precincts cluster. Tightly clustered precincts are more efficient to canvass. Consider splitting distant precincts into separate days.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
      { action: 'flyToLocation', params: { target: 'Lansing' }, delay: 300 },
      { action: 'highlightPrecincts', params: { precincts: ['Lansing 1-8', 'Lansing 1-9', 'Lansing 1-5', 'Lansing 1-2'] }, delay: 600 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 3: Estimate Resources',
      description:
        'Ask: "How many volunteer hours to canvass this area?" or "How many doors in these precincts?" The AI calculates based on voter density and estimates 30-50 doors per hour.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'How many volunteer hours to canvass these 4 precincts?' }, delay: 300 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You have a canvassing plan outline. Visit /canvass to assign turfs to volunteers, track progress, and generate walk lists.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'clearHighlight' },
      { action: 'showChoropleth', delay: 200 },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 400 },
    ],
  },
];

/**
 * Workflow: Compare Two Areas
 * Goal: Side-by-side comparison of jurisdictions or precincts
 */
export const WORKFLOW_COMPARE_AREAS_STEPS: TourStepWithAction[] = [
  {
    popover: {
      title: '⚖️ Workflow: Compare Two Areas',
      description:
        'Learn how to compare any two precincts, cities, or townships side-by-side to understand their differences and similarities.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 1: Ask for Comparison',
      description:
        'Ask: "Compare Lansing vs East Lansing" or "How does Meridian Township differ from Delhi Township?" The AI provides a detailed breakdown of demographics, political lean, and key metrics.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Compare Lansing vs East Lansing' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: 'Step 2: Visualize Differences',
      description:
        'Both areas are highlighted on the map. Look at their relative positions and sizes. Ask the AI to show specific metrics: "Show median income comparison on map."',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'flyToLocation', params: { target: 'Lansing' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: 'Step 3: Dig Into Specifics',
      description:
        'Ask follow-up questions: "Why is East Lansing more Democratic?" "What lifestyle segments are different?" "Which has better GOTV potential?" The AI explains the key drivers.',
      side: 'right',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Why is East Lansing more Democratic than Lansing?' }, delay: 300 },
    ],
  },
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You can now compare any two areas. Visit /compare for a full split-screen comparison view with detailed charts.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'zoomToExtent', params: { zoom: 10 } },
    ],
  },
];

// =============================================================================
// CROSS-TOOL WORKFLOW TOURS
// Demonstrate workflows that span multiple pages/tools
// =============================================================================

/**
 * Cross-Tool Tour: Segment → Canvass
 *
 * Shows the complete workflow from building a voter segment to planning
 * canvassing operations. Navigates from /political-ai to /segments to /canvass.
 */
export const CROSS_TOOL_SEGMENT_TO_CANVASS_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🔄 Cross-Tool Workflow: Segment → Canvass',
      description:
        'This tour demonstrates a complete workflow from identifying target voters to planning field operations. You\'ll learn how tools connect across the platform.\n\n<strong>The workflow:</strong> Build Segment → Review Data → Plan Canvass',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'showChoropleth' },
    ],
  },

  // =========================================================================
  // PART 1: IDENTIFY TARGET VOTERS (Main Page)
  // =========================================================================
  {
    popover: {
      title: 'Part 1: Identify Target Voters',
      description:
        'First, we\'ll use the AI to identify high-GOTV precincts. These are areas where turnout mobilization has the biggest impact.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Finding GOTV Targets',
      description:
        'Watch as the AI identifies precincts with high GOTV priority - areas where increasing turnout yields the most net votes.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Find the top 10 precincts with highest GOTV priority in Lansing' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ Visualize the Universe',
      description:
        'The AI highlights your target precincts. Notice they cluster in urban areas with Democratic lean but lower turnout.\n\n<em>This becomes your canvassing universe.</em>',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showHeatmap', params: { metric: 'gotv_priority' } },
      { action: 'flyToLocation', params: { target: 'Lansing' }, delay: 500 },
    ],
  },

  // =========================================================================
  // PART 2: NAVIGATE TO SEGMENTS TOOL
  // =========================================================================
  {
    popover: {
      title: 'Part 2: Build the Segment',
      description:
        'Now let\'s save this as a formal segment. The Segments tool (/segments) lets you:\n\n• Apply advanced filters\n• Save segments for reuse\n• Export to voter files\n\n<em>Click Next to navigate to the Segments page.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: '➡️ Navigating to Segments',
      description:
        'You\'ll be redirected to the <strong>Segments page</strong>. This page provides advanced filtering tools to refine your voter universe.\n\n<strong>Pro tip:</strong> Your AI context travels with you - the AI remembers what you were analyzing.',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'navigateTo', params: { path: '/segments', delay: 2000 } },
    ],
  },
];

/**
 * Cross-Tool Tour: Analyze → Donors
 *
 * Shows how to analyze an area and then explore donor opportunities.
 * Useful for campaigns that need to combine targeting with fundraising.
 */
export const CROSS_TOOL_ANALYZE_TO_DONORS_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🔄 Cross-Tool Workflow: Analyze → Donors',
      description:
        'This tour shows how to combine area analysis with donor intelligence. Perfect for campaigns that need to coordinate targeting with fundraising.\n\n<strong>The workflow:</strong> Analyze Area → Find Donor Clusters → Plan Outreach',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'showChoropleth' },
    ],
  },

  // =========================================================================
  // PART 1: ANALYZE THE AREA
  // =========================================================================
  {
    popover: {
      title: 'Part 1: Analyze Your Target Area',
      description:
        'First, let\'s understand the political landscape of a key area. We\'ll analyze Meridian Township - an affluent suburb with both voter and donor potential.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Area Analysis',
      description:
        'The AI provides a comprehensive breakdown of Meridian Township - demographics, partisan lean, and Tapestry lifestyle segments.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Analyze Meridian Township - demographics, political lean, and lifestyle segments' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ Visualize the Area',
      description:
        'Meridian Township is highlighted. Note the suburban character - this type of area often has:\n\n• Higher income households (donor potential)\n• Educated voters (persuadable)\n• Professional occupations (targeted messaging)',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'flyToLocation', params: { target: 'Meridian Township' } },
      { action: 'showChoropleth' },
    ],
  },

  // =========================================================================
  // PART 2: EXPLORE DONOR OPPORTUNITIES
  // =========================================================================
  {
    popover: {
      title: 'Part 2: Find Donor Opportunities',
      description:
        'Now let\'s find where donors are concentrated in this area. The Donors tool (/donors) provides:\n\n• FEC contribution data by ZIP\n• Donor occupation analysis\n• Lapsed donor identification\n\n<em>Click Next to navigate to Donors.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '💰 Quick Donor Check',
      description:
        'Before navigating, let\'s ask about donors in this area to preview what we\'ll find.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Where are donors concentrated near Meridian Township?' }, delay: 300 },
    ],
  },
  {
    popover: {
      title: '➡️ Navigating to Donors',
      description:
        'You\'ll be redirected to the <strong>Donors page</strong>. This page provides deep FEC analysis including:\n\n• Donor heatmaps by ZIP\n• Time-series giving trends\n• Occupation breakdowns\n\n<em>Use insights from area analysis to target fundraising.</em>',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'navigateTo', params: { path: '/donors', delay: 2000 } },
    ],
  },
];

/**
 * Cross-Tool Tour: Full Campaign Workflow
 *
 * Comprehensive tour showing end-to-end campaign planning across all tools.
 * This is the "master tour" for new users who want to see everything.
 */
export const CROSS_TOOL_FULL_WORKFLOW_STEPS: TourStepWithAction[] = [
  // =========================================================================
  // INTRODUCTION
  // =========================================================================
  {
    popover: {
      title: '🎯 Complete Campaign Workflow',
      description:
        'This comprehensive tour demonstrates how all platform tools work together for campaign planning.\n\n<strong>You\'ll experience:</strong>\n1. AI-powered analysis (main page)\n2. Voter segmentation (/segments)\n3. Donor intelligence (/donors)\n4. Side-by-side comparison (/compare)\n5. Field operations (/canvass)',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'showChoropleth' },
    ],
  },

  // =========================================================================
  // PHASE 1: AI ANALYSIS (Main Page)
  // =========================================================================
  {
    popover: {
      title: 'Phase 1: AI-Powered Discovery',
      description:
        'Every campaign starts with understanding the landscape. The AI assistant helps you explore data, identify opportunities, and form hypotheses.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🤖 Ask Strategic Questions',
      description:
        'The AI understands campaign strategy. Ask about competitive areas, GOTV priorities, demographic patterns, or specific precincts.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'What are the key strategic opportunities in Ingham County for a Democratic campaign?' }, delay: 300 },
    ],
  },
  {
    element: '[data-tour="map-container"]',
    popover: {
      title: '🗺️ Visualize Patterns',
      description:
        'The map shows partisan lean across all precincts. Blue = Democratic, Red = Republican. The AI can switch to heatmaps, bivariate views, or highlight specific areas.',
      side: 'left',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 300 },
    ],
  },

  // =========================================================================
  // PHASE 2: SEGMENTATION
  // =========================================================================
  {
    popover: {
      title: 'Phase 2: Voter Segmentation',
      description:
        'After identifying opportunities, build precise voter universes. The Segments tool offers:\n\n• Demographic filters (age, income, education)\n• Political filters (lean, turnout, swing)\n• Lifestyle filters (Tapestry segments)\n\n<em>Click Next to see the Segments page.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: '➡️ Segments Tool Preview',
      description:
        '<strong>Key capabilities:</strong>\n\n• Filter by multiple criteria simultaneously\n• Save segments for reuse\n• Export to CSV for voter file vendors\n• See results instantly on the map\n\n<em>Navigate to /segments from the sidebar anytime.</em>',
      side: 'bottom',
      align: 'center',
    },
  },

  // =========================================================================
  // PHASE 3: DONOR INTELLIGENCE
  // =========================================================================
  {
    popover: {
      title: 'Phase 3: Donor Intelligence',
      description:
        'Campaigns need money. The Donors tool analyzes FEC data to find:\n\n• Geographic donor concentrations\n• Occupation patterns\n• Lapsed donors to re-engage\n• Upgrade potential\n\n<em>Click Next to see donor insights.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '💰 Donor Discovery',
      description:
        'The AI can query donor data directly. Ask about concentration, occupations, giving trends, or specific ZIP codes.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Which ZIP codes have the highest Democratic donor concentration?' }, delay: 300 },
      // Show persuasion opportunity heatmap - correlates with donor potential
      { action: 'showHeatmap', params: { metric: 'persuasion_opportunity' }, delay: 500 },
    ],
  },

  // =========================================================================
  // PHASE 4: COMPARISON
  // =========================================================================
  {
    popover: {
      title: 'Phase 4: Comparative Analysis',
      description:
        'Understanding differences between areas helps tailor messaging. The Compare tool provides:\n\n• Side-by-side metrics\n• Demographic breakdowns\n• Strategy recommendations\n\n<em>Click Next to see comparison capabilities.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '⚖️ Compare Anything',
      description:
        'Compare cities, townships, precincts, or districts. The AI explains key differences and what they mean for your strategy.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'typeInChat', params: { text: 'Compare East Lansing with Meridian Township' }, delay: 300 },
    ],
  },

  // =========================================================================
  // PHASE 5: FIELD OPERATIONS
  // =========================================================================
  {
    popover: {
      title: 'Phase 5: Field Operations',
      description:
        'Convert strategy into action. The Canvass tool helps:\n\n• Calculate door counts and volunteer hours\n• Optimize routes by geography\n• Assign turfs to teams\n• Track progress\n\n<em>This is where strategy becomes reality.</em>',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="ai-chat-panel"]',
    popover: {
      title: '🚶 Plan Field Operations',
      description:
        'The AI calculates canvassing requirements. Ask about door counts, volunteer hours, or route optimization.',
      side: 'right',
      align: 'start',
    },
    onActivate: [
      { action: 'expandAIPanel' },
      { action: 'switchToActiveChat', delay: 100 },
      { action: 'showHeatmap', params: { metric: 'gotv_priority' }, delay: 200 },
      { action: 'typeInChat', params: { text: 'How many volunteer hours to canvass high-GOTV precincts in Lansing?' }, delay: 500 },
    ],
  },

  // =========================================================================
  // CONCLUSION
  // =========================================================================
  {
    popover: {
      title: '✅ Workflow Complete!',
      description:
        'You\'ve seen the complete campaign planning workflow:\n\n1. ✅ <strong>AI Discovery</strong> - Strategic questions answered\n2. ✅ <strong>Segmentation</strong> - Target voters identified\n3. ✅ <strong>Donors</strong> - Fundraising geography mapped\n4. ✅ <strong>Comparison</strong> - Areas differentiated\n5. ✅ <strong>Field Ops</strong> - Canvassing planned\n\n<em>Use the sidebar to navigate to any tool.</em>',
      side: 'bottom',
      align: 'center',
    },
    onActivate: [
      { action: 'showChoropleth' },
      { action: 'clearHighlight' },
      { action: 'zoomToExtent', params: { zoom: 10 }, delay: 200 },
    ],
  },
  {
    element: '[data-tour="tour-button"]',
    popover: {
      title: '🚀 Explore On Your Own',
      description:
        'Ready to dive in?\n\n• <strong>Sidebar</strong> - Navigate to specific tools\n• <strong>AI Chat</strong> - Ask anything about your data\n• <strong>Tours</strong> - Return here for guided help\n\n<strong>Pro tip:</strong> The AI maintains context as you navigate between tools!',
      side: 'right',
      align: 'end',
    },
  },
];

/**
 * Get tour steps by theme
 */
export function getTourSteps(theme: TourTheme): TourStepWithAction[] {
  switch (theme) {
    case 'welcome':
      return WELCOME_TOUR_STEPS;
    case 'segmentation':
      return SEGMENTATION_TOUR_STEPS;
    case 'comparison':
      return COMPARISON_TOUR_STEPS;
    case 'donor':
      return DONOR_TOUR_STEPS;
    case 'canvassing':
      return CANVASSING_TOUR_STEPS;
    case 'full':
      return FULL_TOUR_STEPS;
    // Demo scenarios - comprehensive campaign walkthroughs (Democratic perspective)
    case 'demo-scenario':
      return DEMO_SCENARIO_STEPS;
    case 'demo-scenario-senate':
      return DEMO_SCENARIO_SENATE_STEPS;
    case 'demo-scenario-congress':
      return DEMO_SCENARIO_CONGRESS_STEPS;
    // Workflow tours
    case 'workflow-find-swing':
      return WORKFLOW_FIND_SWING_STEPS;
    case 'workflow-analyze-precinct':
      return WORKFLOW_ANALYZE_PRECINCT_STEPS;
    case 'workflow-build-gotv':
      return WORKFLOW_BUILD_GOTV_STEPS;
    case 'workflow-find-donors':
      return WORKFLOW_FIND_DONORS_STEPS;
    case 'workflow-plan-canvass':
      return WORKFLOW_PLAN_CANVASS_STEPS;
    case 'workflow-compare-areas':
      return WORKFLOW_COMPARE_AREAS_STEPS;
    // Cross-tool workflow tours
    case 'cross-tool-segment-to-canvass':
      return CROSS_TOOL_SEGMENT_TO_CANVASS_STEPS;
    case 'cross-tool-analyze-to-donors':
      return CROSS_TOOL_ANALYZE_TO_DONORS_STEPS;
    case 'cross-tool-full-workflow':
      return CROSS_TOOL_FULL_WORKFLOW_STEPS;
    default:
      return FULL_TOUR_STEPS;
  }
}

/**
 * Default driver.js configuration
 */
export const DEFAULT_TOUR_CONFIG: Config = {
  showProgress: true,
  showButtons: ['next', 'previous', 'close'],
  animate: true,
  smoothScroll: true,
  allowClose: true,
  stagePadding: 10,
  stageRadius: 5,
  popoverClass: 'political-tour-popover',
  progressText: '{{current}} of {{total}}',
  nextBtnText: 'Next',
  prevBtnText: 'Previous',
  doneBtnText: 'Done',
};

/**
 * Tour step count by theme (for UI display)
 */
export const TOUR_STEP_COUNTS: Record<TourTheme, number> = {
  // Feature tours
  welcome: WELCOME_TOUR_STEPS.length,
  segmentation: SEGMENTATION_TOUR_STEPS.length,
  comparison: COMPARISON_TOUR_STEPS.length,
  donor: DONOR_TOUR_STEPS.length,
  canvassing: CANVASSING_TOUR_STEPS.length,
  full: FULL_TOUR_STEPS.length,
  // Demo scenarios (Democratic campaign walkthroughs)
  'demo-scenario': DEMO_SCENARIO_STEPS.length,
  'demo-scenario-senate': DEMO_SCENARIO_SENATE_STEPS.length,
  'demo-scenario-congress': DEMO_SCENARIO_CONGRESS_STEPS.length,
  // Workflow tours
  'workflow-find-swing': WORKFLOW_FIND_SWING_STEPS.length,
  'workflow-analyze-precinct': WORKFLOW_ANALYZE_PRECINCT_STEPS.length,
  'workflow-build-gotv': WORKFLOW_BUILD_GOTV_STEPS.length,
  'workflow-find-donors': WORKFLOW_FIND_DONORS_STEPS.length,
  'workflow-plan-canvass': WORKFLOW_PLAN_CANVASS_STEPS.length,
  'workflow-compare-areas': WORKFLOW_COMPARE_AREAS_STEPS.length,
  // Cross-tool workflow tours
  'cross-tool-segment-to-canvass': CROSS_TOOL_SEGMENT_TO_CANVASS_STEPS.length,
  'cross-tool-analyze-to-donors': CROSS_TOOL_ANALYZE_TO_DONORS_STEPS.length,
  'cross-tool-full-workflow': CROSS_TOOL_FULL_WORKFLOW_STEPS.length,
};
