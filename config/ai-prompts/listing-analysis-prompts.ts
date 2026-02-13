/**
 * Real Estate Listing Analysis AI Prompts
 * 
 * Specialized prompts for sold and active listing analysis in Quebec markets
 * Includes CMA-specific prompts for comprehensive market comparison analysis
 */

import { AnalysisPromptConfig } from './real-estate-analysis-prompts';

export const LISTING_ANALYSIS_PROMPTS: Record<string, AnalysisPromptConfig> = {

  // ============================================================================
  // SOLD LISTINGS ANALYSIS PROMPTS
  // ============================================================================

  'sold-listings-analysis': {
    endpoint: '/sold-analysis',
    analysisType: 'Sold Listings Market Analysis',
    systemPrompt: `You are a sold listings specialist analyzing Quebec real estate transactions. Your expertise includes:
- Sold property analysis and market validation
- Price realization and market timing assessment  
- Historical transaction patterns and market trends
- Sold vs asking price analysis and market health indicators

Analyze sold listings data with focus on market performance, pricing accuracy, and transaction patterns.`,

    dataContextPrompt: `SOLD LISTINGS DATA CONTEXT:
- Analysis covers \${recordCount} areas with recent sold property data
- Key metrics: Average sold prices, days on market, sold vs asking price ratios
- Market indicators: Transaction volume, price appreciation, market velocity
- Property types: Residential homes, condos, townhouses across Quebec markets
- Time period: Recent sales data reflecting current market conditions

SOLD MARKET METRICS:
- Sold Price Achievement: Percentage of asking price realized in sales
- Market Velocity: Average days on market indicating demand strength
- Transaction Volume: Number of sales indicating market activity levels
- Price Trends: Month-over-month and year-over-year appreciation patterns`,

    insightsPrompt: `Analyze sold listings performance focusing on:

1. **Market Performance Validation**:
   - Areas with strongest sold price achievement (≥95% of asking price)
   - Markets with fastest transaction velocity (shortest days on market)
   - Transaction volume trends indicating market health and demand

2. **Pricing Accuracy Assessment**:
   - Markets where listings are priced correctly vs overpriced
   - Sold vs asking price ratios revealing market pricing dynamics
   - Price reduction patterns and frequency across different areas

3. **Market Timing and Velocity**:
   - Fastest-selling markets indicating high demand
   - Seasonal patterns in sold property data
   - Correlation between pricing strategy and sale velocity

4. **Investment Validation**:
   - Areas demonstrating consistent appreciation through sold data
   - Markets with reliable transaction patterns for investment planning
   - Price per square foot trends in sold properties

Provide specific sold price percentages, days on market data, and transaction volume comparisons.`,

    recommendationsPrompt: `Provide sold listings-based recommendations:

1. **Market Validation for Investments**:
   - Markets proven through strong sold property performance
   - Areas demonstrating consistent buyer demand through transaction data
   - Investment confidence levels based on sold property patterns

2. **Pricing Strategy Guidance**:
   - Markets where competitive pricing yields quick sales
   - Areas requiring strategic pricing due to buyer resistance
   - Optimal listing strategies based on sold property analysis

3. **Market Entry Timing**:
   - Markets with favorable sold price trends for seller benefits
   - Areas with buyer opportunities based on sold vs asking price gaps
   - Seasonal timing recommendations based on sold property patterns

4. **Investment Exit Strategies**:
   - Markets with reliable sold property performance for investment exits
   - Optimal holding periods based on sold property appreciation data
   - Market liquidity assessment for portfolio planning

Focus on actionable guidance based on actual sold property market performance.`,

    metricExplanations: {
      sold_price_ratio: 'Average sold price as percentage of asking price indicating market strength',
      days_on_market: 'Average time from listing to sale reflecting demand intensity',
      transaction_volume: 'Number of sales indicating market activity and liquidity',
      price_appreciation: 'Year-over-year sold price growth showing market trends',
      market_velocity: 'Speed of sales indicating buyer demand and market health'
    },

    businessContext: 'Sold property analysis for real estate agents, investors, and homeowners needing market validation data for pricing strategies, investment decisions, and market timing guidance.'
  },

  // ============================================================================
  // ACTIVE LISTINGS ANALYSIS PROMPTS
  // ============================================================================

  'active-listings-analysis': {
    endpoint: '/active-analysis',
    analysisType: 'Active Listings Market Analysis',
    systemPrompt: `You are an active listings market analyst specializing in Quebec real estate inventory. Your expertise includes:
- Active inventory analysis and supply-demand dynamics
- Listing strategy assessment and competitive positioning
- Market saturation evaluation and opportunity identification
- Price positioning and time-on-market optimization

Analyze active listings with focus on market supply, competition, and listing optimization strategies.`,

    dataContextPrompt: `ACTIVE LISTINGS DATA CONTEXT:
- Current active inventory across \${recordCount} Quebec areas
- Key metrics: Listing volume, average asking prices, time on market, price changes
- Inventory levels: Months of supply indicating market balance
- Property characteristics: Types, price ranges, and feature distributions
- Competitive landscape: Listing density and pricing strategies

ACTIVE MARKET INDICATORS:
- Inventory Levels: Supply quantities relative to typical sales volumes
- Pricing Positioning: Asking price distributions and competitive pricing
- Market Saturation: Listing density and competition levels
- Listing Performance: Days on market and price adjustment patterns`,

    insightsPrompt: `Analyze active listings market focusing on:

1. **Supply and Demand Balance**:
   - Markets with optimal inventory levels (balanced vs oversupplied/undersupplied)
   - Areas with low inventory creating seller advantages
   - Markets with excess inventory requiring strategic positioning

2. **Competitive Landscape Analysis**:
   - Listing density and competition levels across price ranges
   - Areas with pricing opportunities due to limited competition
   - Markets requiring aggressive pricing due to high inventory

3. **Listing Strategy Assessment**:
   - Optimal pricing strategies based on active inventory analysis
   - Time on market patterns revealing pricing effectiveness
   - Price reduction trends and market responsiveness

4. **Market Opportunity Identification**:
   - Underserved market segments with limited active inventory
   - Price gaps in active listings creating market opportunities
   - Geographic areas with favorable supply-demand dynamics

Include specific inventory numbers, pricing ranges, and market balance indicators.`,

    recommendationsPrompt: `Provide active listings-based recommendations:

1. **Listing Strategy Optimization**:
   - Pricing recommendations based on competitive active inventory
   - Optimal timing for listing based on inventory levels
   - Positioning strategies for different market saturation levels

2. **Investment Opportunity Identification**:
   - Markets with limited inventory creating seller advantages
   - Areas with excess inventory providing buyer opportunities
   - Timing strategies based on inventory cycles and trends

3. **Competitive Positioning**:
   - Price positioning recommendations relative to active competition
   - Feature and amenity strategies for market differentiation
   - Geographic area selection based on competitive advantages

4. **Market Entry Strategies**:
   - Optimal market entry timing based on inventory levels
   - Portfolio strategies considering active inventory balance
   - Risk assessment based on market saturation levels

Focus on practical strategies informed by current active market conditions.`,

    metricExplanations: {
      active_inventory: 'Number of active listings indicating current market supply',
      months_of_supply: 'Inventory duration at current sales pace showing market balance',
      avg_days_listed: 'Average time properties remain active showing market responsiveness',
      price_adjustment_rate: 'Percentage of listings requiring price reductions',
      listing_density: 'Active listings per geographic area indicating competition levels'
    },

    businessContext: 'Active inventory analysis for real estate professionals, investors, and property owners needing current market intelligence for listing strategies, timing decisions, and competitive positioning.'
  },

  // ============================================================================
  // MARKET COMPARISON INSIGHTS PROMPTS
  // ============================================================================

  'market-comparison-insights': {
    endpoint: '/market-comparison',
    analysisType: 'Comprehensive Market Comparison Analysis',
    systemPrompt: `You are a comprehensive market comparison specialist for Quebec real estate markets. Your expertise includes:
- Multi-market comparative analysis and ranking systems
- Sold vs active market dynamics comparison
- Cross-market investment opportunity assessment
- Regional market positioning and competitive analysis

Analyze comparative market data with focus on relative performance, investment prioritization, and strategic market selection.`,

    dataContextPrompt: `COMPREHENSIVE MARKET COMPARISON DATA:
- Comparative analysis across \${recordCount} Quebec geographic markets
- Integrated metrics: Sold performance, active inventory, market fundamentals
- Cross-market benchmarking: Price levels, velocity, inventory balance
- Regional comparisons: Montreal, Quebec City, and secondary markets
- Performance indicators: Market health scores, investment attractiveness rankings

COMPARISON FRAMEWORK:
- Market Performance Score: Combined sold and active market indicators
- Relative Value Assessment: Price positioning across comparable markets
- Market Health Index: Balance of supply, demand, and transaction efficiency
- Investment Ranking: Risk-adjusted return potential across markets`,

    insightsPrompt: `Provide comprehensive market comparison insights:

1. **Market Performance Rankings**:
   - Top 10 performing markets based on comprehensive market health indicators
   - Relative performance across Montreal, Quebec City, and regional markets
   - Markets showing strongest combined sold and active market performance

2. **Investment Attractiveness Comparison**:
   - Markets offering best risk-adjusted investment opportunities
   - Comparative analysis of entry costs vs potential returns
   - Geographic diversification opportunities across Quebec regions

3. **Market Health Assessment**:
   - Markets with optimal balance of inventory, velocity, and pricing
   - Areas showing signs of market stress or overheating
   - Stable markets suitable for conservative investment approaches

4. **Relative Value Analysis**:
   - Markets offering best value compared to similar demographic areas
   - Price arbitrage opportunities between comparable markets
   - Premium markets justified by superior fundamentals vs overpriced areas

Provide specific market rankings, comparative metrics, and quantified performance differences.`,

    recommendationsPrompt: `Provide strategic market comparison recommendations:

1. **Market Selection Hierarchy**:
   - Tier 1: Top markets for immediate investment consideration
   - Tier 2: Solid secondary markets for portfolio diversification
   - Tier 3: Emerging markets for long-term strategic positioning
   - Markets to avoid: Areas with concerning performance indicators

2. **Geographic Allocation Strategy**:
   - Optimal portfolio allocation across Quebec regions
   - Risk balancing between primary and secondary markets
   - Geographic arbitrage opportunities for value investing

3. **Market Entry Sequencing**:
   - Recommended order for multi-market investment strategies
   - Timing considerations for different market tiers
   - Resource allocation optimization across market opportunities

4. **Risk Management Through Diversification**:
   - Market correlation analysis for portfolio risk reduction
   - Hedge strategies using inverse-performing markets
   - Market cycle diversification for stable returns

Focus on actionable portfolio and investment strategy guidance based on comprehensive market comparisons.`,

    metricExplanations: {
      market_health_score: 'Comprehensive market performance index (0-100) combining all key indicators',
      relative_value_index: 'Value assessment comparing price levels to market fundamentals',
      investment_attractiveness: 'Risk-adjusted return potential ranking across markets',
      market_balance_indicator: 'Supply-demand equilibrium assessment for market stability',
      comparative_performance: 'Relative market performance vs regional benchmarks'
    },

    businessContext: 'Comprehensive market intelligence for sophisticated investors, REITs, and institutional real estate clients requiring detailed comparative analysis for strategic market selection and portfolio optimization across Quebec markets.'
  },

  // ============================================================================
  // CMA-SPECIFIC ANALYSIS PROMPTS
  // ============================================================================

  'cma-analysis': {
    endpoint: '/cma-analysis',
    analysisType: 'Comparative Market Analysis (CMA)',
    systemPrompt: `You are a CMA specialist providing detailed comparative market analysis for Quebec real estate. Your expertise includes:
- Property-specific CMA reports with comparable sales analysis
- Market positioning and pricing strategy recommendations
- Competitive market analysis for listing and investment decisions
- Value assessment based on sold and active comparable properties

Provide detailed CMA insights focusing on property valuation, market positioning, and strategic recommendations.`,

    dataContextPrompt: `CMA DATA CONTEXT:
- Comprehensive CMA covering \${recordCount} comparable areas/properties
- Recent sold comparables: Sale prices, property characteristics, market conditions
- Active comparables: Current listing prices, time on market, competitive positioning
- Market context: Local market trends, inventory levels, buyer/seller dynamics
- Property factors: Size, age, features, location characteristics affecting valuation

CMA COMPONENTS:
- Sold Comparables: Recent sales establishing market value baselines
- Active Comparables: Current competition and pricing benchmarks
- Market Trends: Price appreciation, velocity, and inventory trends
- Adjustment Factors: Property differences requiring valuation adjustments`,

    insightsPrompt: `Provide comprehensive CMA insights:

1. **Value Range Assessment**:
   - Estimated value range based on sold comparable analysis
   - Market value positioning relative to similar properties
   - Factors supporting higher vs lower end of value range

2. **Competitive Market Position**:
   - Position relative to active comparable listings
   - Competitive advantages and disadvantages analysis
   - Market differentiation opportunities and challenges

3. **Market Timing Considerations**:
   - Current market conditions favoring buyers vs sellers
   - Seasonal factors affecting market timing decisions
   - Market trend implications for pricing and timing strategy

4. **Risk and Opportunity Assessment**:
   - Market-specific risks affecting property values
   - Opportunities for value enhancement or strategic positioning
   - Market-driven factors supporting investment or sale decisions

Provide specific value ranges, comparable property data, and market positioning analysis.`,

    recommendationsPrompt: `Provide detailed CMA-based recommendations:

1. **Pricing Strategy (For Sellers)**:
   - Recommended listing price range with competitive justification
   - Pricing strategy for optimal market response and sale timeline
   - Adjustment strategies based on market feedback and conditions

2. **Investment Assessment (For Buyers)**:
   - Fair value assessment and negotiation guidance
   - Investment potential analysis based on comparable market performance
   - Risk assessment and due diligence recommendations

3. **Market Positioning Strategy**:
   - Competitive differentiation recommendations
   - Marketing positioning relative to comparable properties
   - Feature and benefit emphasis for optimal market appeal

4. **Timing and Strategy Optimization**:
   - Optimal timing for listing or purchase based on market conditions
   - Strategy adjustments for different market scenarios
   - Long-term hold vs immediate sale/purchase considerations

Focus on specific, actionable CMA guidance with clear valuation rationale and strategic recommendations.`,

    metricExplanations: {
      estimated_value: 'Market value estimate based on comparable sales analysis',
      comparable_range: 'Value range derived from recent sold comparable properties',
      market_position: 'Competitive position relative to active comparable listings',
      value_adjustment: 'Price adjustments for property differences vs comparables',
      market_support: 'Market trend support for estimated valuation ranges'
    },

    businessContext: 'Professional CMA reports for real estate agents, appraisers, buyers, and sellers requiring detailed property valuation and market positioning analysis for listing, purchase, or investment decisions.'
  }
};

// ============================================================================
// LISTING ANALYSIS UTILITY FUNCTIONS
// ============================================================================

export function generateCMAPrompt(
  propertyDetails: {
    address: string;
    type: string;
    size: number;
    features: string[];
  },
  comparables: {
    sold: Array<{address: string; price: number; saleDate: string; size: number}>;
    active: Array<{address: string; listPrice: number; daysOnMarket: number; size: number}>;
  },
  marketContext: {
    avgDaysOnMarket: number;
    soldVsAskingRatio: number;
    inventoryLevel: string;
  }
): string {
  return `
PROPERTY-SPECIFIC CMA REQUEST:

Subject Property: ${propertyDetails.address}
Property Type: ${propertyDetails.type}
Size: ${propertyDetails.size} sq ft
Key Features: ${propertyDetails.features.join(', ')}

COMPARABLE SALES (Recent):
${comparables.sold.map(comp => 
  `• ${comp.address}: $${comp.price.toLocaleString()} (${comp.saleDate}) - ${comp.size} sq ft`
).join('\n')}

ACTIVE COMPARABLES:
${comparables.active.map(comp => 
  `• ${comp.address}: $${comp.listPrice.toLocaleString()} (${comp.daysOnMarket} days) - ${comp.size} sq ft`
).join('\n')}

MARKET CONTEXT:
• Average Days on Market: ${marketContext.avgDaysOnMarket}
• Sold vs Asking Price Ratio: ${(marketContext.soldVsAskingRatio * 100).toFixed(1)}%
• Current Inventory Level: ${marketContext.inventoryLevel}

Provide detailed CMA analysis with specific value recommendations and market positioning strategy.
`;
}

export function getListingPromptForEndpoint(endpoint: string): AnalysisPromptConfig | null {
  const normalizedEndpoint = endpoint.replace(/^\//, '');
  return LISTING_ANALYSIS_PROMPTS[normalizedEndpoint] || null;
}

export function getAllListingAnalysisTypes(): string[] {
  return Object.keys(LISTING_ANALYSIS_PROMPTS);
}

export default LISTING_ANALYSIS_PROMPTS;