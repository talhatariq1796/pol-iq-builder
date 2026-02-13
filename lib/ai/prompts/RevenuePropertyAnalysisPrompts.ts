/**
 * Revenue Property Analysis Prompts
 *
 * Investment-focused AI prompts for revenue property analysis.
 * Uses cash flow language and investment metrics terminology.
 */

import type { CMAProperty } from '@/components/cma/types';

export interface InvestmentMetrics {
  grossIncomeMultiplier?: number | null;
  potentialGrossIncome?: number | null;
  netOperatingIncome?: number | null;
  netIncomeMultiplier?: number | null;
  effectiveGrossIncome?: number | null;
  effectiveNOI?: number | null;
  priceVsAssessment?: number | null;
  capRate?: number | null;
  cashOnCash?: number | null;
  debtServiceCoverage?: number | null;
}

export interface PromptContext {
  property: CMAProperty;
  comparables?: CMAProperty[];
  neighborhoodData?: {
    name: string;
    averagePrice?: number;
    medianPrice?: number;
    vacancy_rate?: number;
  };
  marketStats?: {
    avgCapRate?: number;
    avgGIM?: number;
    avgNIM?: number;
  };
}

/**
 * Cash Flow Analysis Prompt
 * Focuses on income generation potential and operating cash flow
 */
export function getCashFlowAnalysisPrompt(context: PromptContext): string {
  const { property, neighborhoodData, marketStats } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  return `Analyze the cash flow potential of this investment property:

**Property Details:**
- Address: ${property.address}
- Price: $${property.price?.toLocaleString() || 'N/A'}
- Property Type: ${property.property_type || 'N/A'}

**Investment Metrics:**
- Potential Gross Income (PGI): $${metrics.potentialGrossIncome?.toLocaleString() || 'N/A'}
- Effective Gross Income (EGI): $${metrics.effectiveGrossIncome?.toLocaleString() || 'N/A'}
- Net Operating Income (NOI): $${metrics.netOperatingIncome?.toLocaleString() || 'N/A'}
- Effective NOI: $${metrics.effectiveNOI?.toLocaleString() || 'N/A'}
- Common Expenses: $${metrics.common_expenses?.toLocaleString() || 'N/A'}/year
- Gross Income Multiplier (GIM): ${metrics.grossIncomeMultiplier?.toFixed(2) || 'N/A'}
- Net Income Multiplier (NIM): ${metrics.netIncomeMultiplier?.toFixed(2) || 'N/A'}

**Market Context:**
- Neighborhood: ${neighborhoodData?.name || 'N/A'}
- CMHC Vacancy Rate (Montreal 2025): 2.5%
- Market Avg GIM: ${marketStats?.avgGIM?.toFixed(2) || 'N/A'}
- Market Avg NIM: ${marketStats?.avgNIM?.toFixed(2) || 'N/A'}

**Analysis Required:**
1. Evaluate the property's income generation potential
2. Assess operating expense ratio (expenses/PGI)
3. Compare GIM and NIM to market averages
4. Identify cash flow strengths and weaknesses
5. Flag any concerning expense ratios or income projections
6. Provide actionable insights for maximizing cash flow

Focus on: Operating efficiency, expense management, income optimization, and cash-on-cash return potential.`;
}

/**
 * Cap Rate Comparison Prompt
 * Analyzes capitalization rate relative to market
 */
export function getCapRateAnalysisPrompt(context: PromptContext): string {
  const { property, comparables, marketStats, neighborhoodData } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  const compCapRates = comparables
    ?.filter(c => (c as any).capRate)
    .map(c => `- ${c.address}: ${((c as any).capRate * 100).toFixed(2)}%`)
    .join('\n') || 'No comparable cap rates available';

  return `Analyze the capitalization rate for this investment property:

**Subject Property:**
- Address: ${property.address}
- Price: $${property.price?.toLocaleString() || 'N/A'}
- NOI: $${metrics.netOperatingIncome?.toLocaleString() || 'N/A'}
- Implied Cap Rate: ${metrics.capRate ? (metrics.capRate * 100).toFixed(2) + '%' : 'N/A'}

**Market Context:**
- Neighborhood: ${neighborhoodData?.name || 'N/A'}
- Market Average Cap Rate: ${marketStats?.avgCapRate ? (marketStats.avgCapRate * 100).toFixed(2) + '%' : 'N/A'}

**Comparable Properties Cap Rates:**
${compCapRates}

**Analysis Required:**
1. Evaluate if the cap rate is attractive relative to market
2. Assess if the property is priced appropriately for its NOI
3. Compare to similar properties in the area
4. Identify factors that may justify cap rate premium/discount
5. Assess risk level based on cap rate positioning
6. Provide valuation insights based on cap rate analysis

Focus on: Risk-adjusted returns, market positioning, valuation accuracy, and investment opportunity assessment.`;
}

/**
 * Operating Expense Evaluation Prompt
 * Analyzes expense ratios and operating efficiency
 */
export function getOperatingExpensePrompt(context: PromptContext): string {
  const { property, comparables } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  const expenseRatio = metrics.potentialGrossIncome && metrics.common_expenses
    ? ((metrics.common_expenses / metrics.potentialGrossIncome) * 100).toFixed(1)
    : 'N/A';

  const compExpenseRatios = comparables
    ?.filter(c => (c as any).common_expenses && (c as any).potentialGrossIncome)
    .map(c => {
      const ratio = (((c as any).common_expenses / (c as any).potentialGrossIncome) * 100).toFixed(1);
      return `- ${c.address}: ${ratio}%`;
    })
    .join('\n') || 'No comparable expense ratios available';

  return `Evaluate the operating expenses and efficiency of this investment property:

**Subject Property:**
- Address: ${property.address}
- Common Expenses: $${metrics.common_expenses?.toLocaleString() || 'N/A'}/year
- Potential Gross Income: $${metrics.potentialGrossIncome?.toLocaleString() || 'N/A'}/year
- Operating Expense Ratio: ${expenseRatio}%
- Property Type: ${property.property_type || 'N/A'}
- Year Built: ${property.yearBuilt || 'N/A'}

**Comparable Operating Expense Ratios:**
${compExpenseRatios}

**Typical Expense Ratio Benchmarks:**
- Multi-family (well-maintained): 35-45%
- Multi-family (older buildings): 45-55%
- Commercial: 30-40%

**Analysis Required:**
1. Evaluate if operating expense ratio is reasonable
2. Compare to similar properties and industry benchmarks
3. Identify potential expense optimization opportunities
4. Flag any red flags (unusually high/low expenses)
5. Assess impact of property age on maintenance costs
6. Provide recommendations for expense management

Focus on: Operating efficiency, expense benchmarking, cost reduction opportunities, and sustainability of expense structure.`;
}

/**
 * Market Rental Rate Analysis Prompt
 * Evaluates income potential and rental pricing
 */
export function getMarketRentalRatePrompt(context: PromptContext): string {
  const { property, comparables, neighborhoodData } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  const monthlyIncome = metrics.potentialGrossIncome
    ? (metrics.potentialGrossIncome / 12).toFixed(0)
    : 'N/A';

  const compRentalRates = comparables
    ?.filter(c => (c as any).potentialGrossIncome)
    .map(c => {
      const monthly = ((c as any).potentialGrossIncome / 12).toFixed(0);
      return `- ${c.address}: $${Number(monthly).toLocaleString()}/month`;
    })
    .join('\n') || 'No comparable rental rates available';

  return `Analyze the rental income potential and market positioning:

**Subject Property:**
- Address: ${property.address}
- Monthly Gross Income: $${Number(monthlyIncome).toLocaleString()}/month
- Annual Gross Income: $${metrics.potentialGrossIncome?.toLocaleString() || 'N/A'}
- Bedrooms: ${property.bedrooms || 'N/A'}
- Bathrooms: ${property.bathrooms || 'N/A'}
- Square Footage: ${property.squareFootage?.toLocaleString() || 'N/A'}

**Market Context:**
- Neighborhood: ${neighborhoodData?.name || 'N/A'}
- CMHC Vacancy Rate (Montreal 2025): 2.5%
- Market Demand: ${neighborhoodData?.vacancy_rate && neighborhoodData.vacancy_rate < 3 ? 'Strong (low vacancy)' : 'Moderate'}

**Comparable Rental Rates:**
${compRentalRates}

**Analysis Required:**
1. Evaluate if rental income assumptions are realistic
2. Compare to market rates for similar properties
3. Assess potential for rental rate increases
4. Identify factors affecting rental demand
5. Evaluate impact of low vacancy rate on pricing power
6. Provide rent optimization recommendations

Focus on: Market rental rates, income growth potential, competitive positioning, and demand drivers.`;
}

/**
 * Investment Risk Assessment Prompt
 * Identifies and evaluates investment risks
 */
export function getInvestmentRiskPrompt(context: PromptContext): string {
  const { property, neighborhoodData, marketStats } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  return `Conduct a comprehensive risk assessment for this investment property:

**Property Profile:**
- Address: ${property.address}
- Price: $${property.price?.toLocaleString() || 'N/A'}
- Year Built: ${property.yearBuilt || 'N/A'}
- Property Age: ${property.yearBuilt ? new Date().getFullYear() - property.yearBuilt + ' years' : 'N/A'}

**Investment Metrics:**
- NOI: $${metrics.netOperatingIncome?.toLocaleString() || 'N/A'}
- Cap Rate: ${metrics.capRate ? (metrics.capRate * 100).toFixed(2) + '%' : 'N/A'}
- GIM: ${metrics.grossIncomeMultiplier?.toFixed(2) || 'N/A'}
- Operating Expense Ratio: ${metrics.potentialGrossIncome && metrics.common_expenses ? ((metrics.common_expenses / metrics.potentialGrossIncome) * 100).toFixed(1) + '%' : 'N/A'}
- Price vs Assessment: ${metrics.priceVsAssessment?.toFixed(0) || 'N/A'}%

**Market Context:**
- Neighborhood: ${neighborhoodData?.name || 'N/A'}
- Vacancy Rate: 2.5% (tight market)
- Market Avg Cap Rate: ${marketStats?.avgCapRate ? (marketStats.avgCapRate * 100).toFixed(2) + '%' : 'N/A'}

**Risk Assessment Required:**
1. **Property Age Risk**: Evaluate maintenance/replacement reserves needed
2. **Market Risk**: Assess exposure to vacancy rate changes
3. **Income Risk**: Evaluate income stability and tenant profile
4. **Expense Risk**: Identify potential for expense increases
5. **Valuation Risk**: Compare price to assessment ratio
6. **Liquidity Risk**: Assess marketability and exit strategy
7. **Leverage Risk**: Consider debt service coverage potential

**Deliverables:**
- Risk rating (Low/Medium/High) with justification
- Top 3 risk factors with mitigation strategies
- Red flags requiring further due diligence
- Risk-adjusted return assessment

Focus on: Comprehensive risk identification, quantifiable risk factors, and actionable mitigation strategies.`;
}

/**
 * ROI Projection Prompt
 * Projects returns and investment performance
 */
export function getROIProjectionPrompt(context: PromptContext): string {
  const { property, neighborhoodData } = context;
  const metrics = property as CMAProperty & InvestmentMetrics;

  const cashOnCashReturn = metrics.cashOnCash
    ? (metrics.cashOnCash * 100).toFixed(2)
    : 'N/A';

  return `Project the return on investment (ROI) for this property:

**Investment Parameters:**
- Purchase Price: $${property.price?.toLocaleString() || 'N/A'}
- Annual NOI: $${metrics.netOperatingIncome?.toLocaleString() || 'N/A'}
- Effective NOI: $${metrics.effectiveNOI?.toLocaleString() || 'N/A'}
- Cap Rate: ${metrics.capRate ? (metrics.capRate * 100).toFixed(2) + '%' : 'N/A'}
- Cash-on-Cash Return: ${cashOnCashReturn}%

**Assumptions:**
- Financing: 75% LTV, 5.5% interest rate, 25-year amortization
- Down Payment (25%): $${property.price ? (property.price * 0.25).toLocaleString() : 'N/A'}
- Vacancy Allowance: 2.5% (CMHC Montreal 2025)
- Annual Appreciation: 3.5% (historical Montreal average)
- Income Growth: 2.5% annually
- Expense Growth: 2% annually

**Market Context:**
- Neighborhood: ${neighborhoodData?.name || 'N/A'}
- Market Conditions: Tight rental market (2.5% vacancy)

**ROI Projections Required:**
1. **Year 1 Returns:**
   - Cash-on-cash return
   - Total return (cash flow + appreciation)
   - Debt service coverage ratio

2. **5-Year Projection:**
   - Cumulative cash flow
   - Equity buildup from mortgage paydown
   - Property value appreciation
   - Total return on equity

3. **10-Year Hold Analysis:**
   - IRR (Internal Rate of Return)
   - Equity multiple
   - Exit strategy scenarios

4. **Sensitivity Analysis:**
   - Impact of 1% vacancy increase
   - Impact of 0.5% cap rate compression
   - Impact of expense ratio increase

**Deliverables:**
- Year-by-year cash flow projection
- Return metrics with sensitivity ranges
- Comparison to alternative investments
- Hold period recommendations

Focus on: Realistic return projections, comprehensive financial modeling, and risk-adjusted performance expectations.`;
}

/**
 * Get appropriate prompt based on analysis type
 */
export function getRevenuePropertyPrompt(
  analysisType: 'cashFlow' | 'capRate' | 'expenses' | 'rental' | 'risk' | 'roi',
  context: PromptContext
): string {
  switch (analysisType) {
    case 'cashFlow':
      return getCashFlowAnalysisPrompt(context);
    case 'capRate':
      return getCapRateAnalysisPrompt(context);
    case 'expenses':
      return getOperatingExpensePrompt(context);
    case 'rental':
      return getMarketRentalRatePrompt(context);
    case 'risk':
      return getInvestmentRiskPrompt(context);
    case 'roi':
      return getROIProjectionPrompt(context);
    default:
      return getCashFlowAnalysisPrompt(context);
  }
}

/**
 * Residential Property Prompts (for contrast)
 * These focus on lifestyle, family needs, and residential features
 */
export function getResidentialPropertyPrompt(context: PromptContext): string {
  const { property, comparables, neighborhoodData } = context;

  return `Analyze this residential property for potential homebuyers:

**Property Details:**
- Address: ${property.address}
- Price: $${property.price?.toLocaleString() || 'N/A'}
- Bedrooms: ${property.bedrooms || 'N/A'}
- Bathrooms: ${property.bathrooms || 'N/A'}
- Square Footage: ${property.squareFootage?.toLocaleString() || 'N/A'}
- Year Built: ${property.yearBuilt || 'N/A'}

**Neighborhood:**
- Area: ${neighborhoodData?.name || 'N/A'}
- Average Price: $${neighborhoodData?.averagePrice?.toLocaleString() || 'N/A'}
- Median Price: $${neighborhoodData?.medianPrice?.toLocaleString() || 'N/A'}

**Comparable Properties:**
${comparables?.slice(0, 5).map(c => `- ${c.address}: $${c.price?.toLocaleString()}, ${c.bedrooms} bed, ${c.bathrooms} bath`).join('\n') || 'No comparables'}

**Analysis Required:**
1. Evaluate value relative to comparable homes
2. Assess family-friendly features and layout
3. Identify lifestyle advantages and amenities
4. Compare price per square foot to market
5. Highlight unique selling points
6. Provide buyer suitability insights

Focus on: Family needs, lifestyle fit, neighborhood amenities, and residential value.`;
}
