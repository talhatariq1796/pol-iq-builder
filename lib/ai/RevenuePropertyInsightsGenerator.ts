/**
 * Revenue Property Insights Generator
 *
 * Generates investment-specific insights and warnings for revenue properties.
 * Analyzes metrics and provides actionable intelligence for investors.
 */

import type { CMAProperty } from '@/components/cma/types';

export interface InvestmentInsight {
  type: 'positive' | 'warning' | 'neutral' | 'critical';
  category: 'cashFlow' | 'valuation' | 'expenses' | 'risk' | 'market' | 'opportunity';
  title: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendation?: string;
}

export interface InsightsSummary {
  overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  investmentGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  insights: InvestmentInsight[];
  keyMetrics: {
    capRate?: number;
    cashOnCash?: number;
    gim?: number;
    nim?: number;
    expenseRatio?: number;
  };
  recommendations: string[];
  redFlags: string[];
}

export class RevenuePropertyInsightsGenerator {
  private static readonly VACANCY_RATE_MONTREAL_2025 = 0.025; // 2.5% CMHC projection

  // Market benchmarks for Montreal investment properties
  private static readonly BENCHMARKS = {
    capRate: { min: 0.04, ideal: 0.055, max: 0.08 },
    gim: { min: 7, ideal: 9.5, max: 13 },
    nim: { min: 10, ideal: 14, max: 18 },
    expenseRatio: { min: 0.30, ideal: 0.40, max: 0.55 },
    priceVsAssessment: { min: 90, ideal: 105, max: 120 },
  };

  /**
   * Generate comprehensive insights for a revenue property
   */
  static generateInsights(
    property: CMAProperty,
    comparables?: CMAProperty[],
    marketData?: { avgCapRate?: number; avgGIM?: number; avgNIM?: number }
  ): InsightsSummary {
    const insights: InvestmentInsight[] = [];
    const redFlags: string[] = [];
    const recommendations: string[] = [];

    // Extract investment metrics
    const metrics = this.extractMetrics(property);

    // Generate insights by category
    insights.push(...this.analyzeCapRate(metrics, marketData));
    insights.push(...this.analyzeGIM(metrics, marketData));
    insights.push(...this.analyzeNIM(metrics, marketData));
    insights.push(...this.analyzeExpenseRatio(metrics));
    insights.push(...this.analyzeCashFlow(metrics));
    insights.push(...this.analyzePriceVsAssessment(metrics));
    insights.push(...this.analyzeMarketPosition(metrics, comparables));

    // Extract red flags from critical insights
    insights
      .filter(i => i.type === 'critical' || (i.type === 'warning' && i.impact === 'high'))
      .forEach(i => redFlags.push(i.title));

    // Generate recommendations from actionable insights
    insights
      .filter(i => i.actionable && i.recommendation)
      .forEach(i => recommendations.push(i.recommendation!));

    // Calculate overall rating
    const overallRating = this.calculateOverallRating(insights, metrics);
    const investmentGrade = this.calculateInvestmentGrade(insights, metrics);

    return {
      overallRating,
      investmentGrade,
      insights: insights.sort((a, b) => {
        // Sort by: critical > warning > positive > neutral
        const typeOrder = { critical: 0, warning: 1, positive: 2, neutral: 3 };
        return typeOrder[a.type] - typeOrder[b.type];
      }),
      keyMetrics: metrics,
      recommendations,
      redFlags,
    };
  }

  /**
   * Extract investment metrics from property
   */
  private static extractMetrics(property: CMAProperty): {
    capRate?: number;
    cashOnCash?: number;
    gim?: number;
    nim?: number;
    expenseRatio?: number;
    noi?: number;
    pgi?: number;
    egi?: number;
    expenses?: number;
    priceVsAssessment?: number;
  } {
    const propAny = property as any;
    const pgi = propAny.potentialGrossIncome || propAny.potential_gross_revenue;
    const expenses = propAny.common_expenses;
    const noi = propAny.netOperatingIncome;

    return {
      capRate: propAny.capRate,
      cashOnCash: propAny.cashOnCash,
      gim: propAny.grossIncomeMultiplier || propAny.gross_income_multiplier,
      nim: propAny.netIncomeMultiplier,
      expenseRatio: pgi && expenses ? expenses / pgi : undefined,
      noi: noi,
      pgi: pgi,
      egi: propAny.effectiveGrossIncome,
      expenses: expenses,
      priceVsAssessment: propAny.priceVsAssessment || propAny.price_vs_assessment,
    };
  }

  /**
   * Analyze Capitalization Rate
   */
  private static analyzeCapRate(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>,
    marketData?: { avgCapRate?: number }
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { capRate } = metrics;
    const { min, ideal, max } = this.BENCHMARKS.capRate;

    if (!capRate) {
      insights.push({
        type: 'warning',
        category: 'valuation',
        title: 'Cap Rate Not Available',
        message: 'Unable to calculate capitalization rate. NOI data may be incomplete.',
        impact: 'medium',
        actionable: true,
        recommendation: 'Request detailed income and expense statements from seller to calculate accurate NOI.',
      });
      return insights;
    }

    const capRatePct = capRate * 100;
    const marketAvg = marketData?.avgCapRate ? marketData.avgCapRate * 100 : ideal * 100;

    if (capRate < min) {
      insights.push({
        type: 'warning',
        category: 'valuation',
        title: 'Low Cap Rate',
        message: `Cap rate of ${capRatePct.toFixed(2)}% is below market minimum (${(min * 100).toFixed(1)}%). Property may be overpriced relative to its income.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Negotiate price reduction or verify income assumptions are accurate and conservative.',
      });
    } else if (capRate >= min && capRate < ideal) {
      insights.push({
        type: 'neutral',
        category: 'valuation',
        title: 'Below Average Cap Rate',
        message: `Cap rate of ${capRatePct.toFixed(2)}% is below ideal (${(ideal * 100).toFixed(1)}%) but within acceptable range. Market average is ${marketAvg.toFixed(2)}%.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Justify lower cap rate with property location, condition, or income growth potential.',
      });
    } else if (capRate >= ideal && capRate <= max) {
      insights.push({
        type: 'positive',
        category: 'valuation',
        title: 'Strong Cap Rate',
        message: `Cap rate of ${capRatePct.toFixed(2)}% is in the ideal range (${(ideal * 100).toFixed(1)}-${(max * 100).toFixed(1)}%), indicating good value relative to income.`,
        impact: 'high',
        actionable: false,
      });
    } else {
      insights.push({
        type: 'warning',
        category: 'risk',
        title: 'High Cap Rate - Investigate Risk',
        message: `Cap rate of ${capRatePct.toFixed(2)}% is above market range (>${(max * 100).toFixed(1)}%). May indicate higher risk or deferred maintenance.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Conduct thorough property inspection and verify tenant quality and lease terms.',
      });
    }

    return insights;
  }

  /**
   * Analyze Gross Income Multiplier
   */
  private static analyzeGIM(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>,
    marketData?: { avgGIM?: number }
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { gim } = metrics;
    const { min, ideal, max } = this.BENCHMARKS.gim;

    if (!gim) return insights;

    const marketAvg = marketData?.avgGIM || ideal;

    if (gim < min) {
      insights.push({
        type: 'positive',
        category: 'valuation',
        title: 'Excellent GIM - Strong Value',
        message: `GIM of ${gim.toFixed(2)} is below ${min}, indicating the property generates strong income relative to purchase price.`,
        impact: 'high',
        actionable: false,
      });
    } else if (gim >= min && gim <= ideal) {
      insights.push({
        type: 'positive',
        category: 'valuation',
        title: 'Good GIM',
        message: `GIM of ${gim.toFixed(2)} is in the ideal range (${min}-${ideal}). Market average is ${marketAvg.toFixed(2)}.`,
        impact: 'medium',
        actionable: false,
      });
    } else if (gim > ideal && gim <= max) {
      insights.push({
        type: 'neutral',
        category: 'valuation',
        title: 'Moderate GIM',
        message: `GIM of ${gim.toFixed(2)} is above ideal (${ideal}) but within acceptable range (<${max}). Income relative to price is moderate.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Evaluate if income growth potential or property appreciation justifies higher GIM.',
      });
    } else {
      insights.push({
        type: 'warning',
        category: 'valuation',
        title: 'High GIM - Price Concerns',
        message: `GIM of ${gim.toFixed(2)} exceeds ${max}, indicating property may be overpriced relative to gross income.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Negotiate price reduction or verify significant value-add opportunities exist.',
      });
    }

    return insights;
  }

  /**
   * Analyze Net Income Multiplier
   */
  private static analyzeNIM(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>,
    marketData?: { avgNIM?: number }
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { nim } = metrics;
    const { min, ideal, max } = this.BENCHMARKS.nim;

    if (!nim) return insights;

    const marketAvg = marketData?.avgNIM || ideal;

    if (nim < min) {
      insights.push({
        type: 'positive',
        category: 'cashFlow',
        title: 'Excellent NIM - Strong Cash Flow',
        message: `NIM of ${nim.toFixed(2)} is below ${min}, indicating exceptional cash flow relative to price after expenses.`,
        impact: 'high',
        actionable: false,
      });
    } else if (nim >= min && nim <= ideal) {
      insights.push({
        type: 'positive',
        category: 'cashFlow',
        title: 'Good NIM',
        message: `NIM of ${nim.toFixed(2)} is in the ideal range (${min}-${ideal}). Market average is ${marketAvg.toFixed(2)}.`,
        impact: 'medium',
        actionable: false,
      });
    } else if (nim > ideal && nim <= max) {
      insights.push({
        type: 'neutral',
        category: 'cashFlow',
        title: 'Moderate NIM',
        message: `NIM of ${nim.toFixed(2)} is above ideal (${ideal}) but within acceptable range (<${max}). Net income relative to price is moderate.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Evaluate expense reduction opportunities to improve net income.',
      });
    } else {
      insights.push({
        type: 'warning',
        category: 'cashFlow',
        title: 'High NIM - Cash Flow Concerns',
        message: `NIM of ${nim.toFixed(2)} exceeds ${max}, indicating weak cash flow relative to purchase price after expenses.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Analyze if expenses can be reduced or rents increased to improve cash flow.',
      });
    }

    return insights;
  }

  /**
   * Analyze Operating Expense Ratio
   */
  private static analyzeExpenseRatio(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { expenseRatio, expenses, pgi } = metrics;
    const { min, ideal, max } = this.BENCHMARKS.expenseRatio;

    if (!expenseRatio || !expenses || !pgi) return insights;

    const ratioPct = expenseRatio * 100;

    if (expenseRatio < min) {
      insights.push({
        type: 'warning',
        category: 'expenses',
        title: 'Unusually Low Expenses - Verify',
        message: `Operating expense ratio of ${ratioPct.toFixed(1)}% is below ${(min * 100).toFixed(0)}%. This may indicate underestimated expenses.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Verify all operating expenses are included and request 3-year expense history.',
      });
    } else if (expenseRatio >= min && expenseRatio <= ideal) {
      insights.push({
        type: 'positive',
        category: 'expenses',
        title: 'Efficient Operating Expenses',
        message: `Operating expense ratio of ${ratioPct.toFixed(1)}% is within ideal range (${(min * 100).toFixed(0)}-${(ideal * 100).toFixed(0)}%), indicating well-managed property.`,
        impact: 'high',
        actionable: false,
      });
    } else if (expenseRatio > ideal && expenseRatio <= max) {
      insights.push({
        type: 'neutral',
        category: 'expenses',
        title: 'Moderate Operating Expenses',
        message: `Operating expense ratio of ${ratioPct.toFixed(1)}% is above ideal (${(ideal * 100).toFixed(0)}%) but within acceptable range (<${(max * 100).toFixed(0)}%).`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Identify expense reduction opportunities, particularly in utilities, maintenance, and property management.',
      });
    } else {
      insights.push({
        type: 'critical',
        category: 'expenses',
        title: 'High Operating Expenses - Red Flag',
        message: `Operating expense ratio of ${ratioPct.toFixed(1)}% exceeds ${(max * 100).toFixed(0)}%, indicating inefficient operations or deferred maintenance.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Conduct detailed expense audit and property inspection to identify cost drivers and potential for reduction.',
      });
    }

    return insights;
  }

  /**
   * Analyze Cash Flow Metrics
   */
  private static analyzeCashFlow(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { noi, pgi, egi, expenses } = metrics;

    if (!noi || !pgi) return insights;

    // NOI Margin (NOI / PGI)
    const noiMargin = noi / pgi;
    const noiMarginPct = noiMargin * 100;

    if (noiMargin > 0.60) {
      insights.push({
        type: 'positive',
        category: 'cashFlow',
        title: 'Strong NOI Margin',
        message: `NOI margin of ${noiMarginPct.toFixed(1)}% (>60%) indicates strong profitability and efficient operations.`,
        impact: 'high',
        actionable: false,
      });
    } else if (noiMargin >= 0.45 && noiMargin <= 0.60) {
      insights.push({
        type: 'positive',
        category: 'cashFlow',
        title: 'Healthy NOI Margin',
        message: `NOI margin of ${noiMarginPct.toFixed(1)}% is within healthy range (45-60%).`,
        impact: 'medium',
        actionable: false,
      });
    } else if (noiMargin >= 0.30 && noiMargin < 0.45) {
      insights.push({
        type: 'neutral',
        category: 'cashFlow',
        title: 'Moderate NOI Margin',
        message: `NOI margin of ${noiMarginPct.toFixed(1)}% is below ideal (45%), indicating moderate profitability after expenses.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Explore opportunities to increase income or reduce expenses to improve NOI margin.',
      });
    } else {
      insights.push({
        type: 'critical',
        category: 'cashFlow',
        title: 'Low NOI Margin - Cash Flow Risk',
        message: `NOI margin of ${noiMarginPct.toFixed(1)}% is below 30%, indicating weak cash flow after expenses.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Critically evaluate if this investment can generate positive cash flow after debt service.',
      });
    }

    // Vacancy allowance (if EGI available)
    if (egi && pgi) {
      const vacancyAllowance = (pgi - egi) / pgi;
      const vacancyPct = vacancyAllowance * 100;

      if (vacancyAllowance < this.VACANCY_RATE_MONTREAL_2025) {
        insights.push({
          type: 'warning',
          category: 'risk',
          title: 'Low Vacancy Allowance',
          message: `Vacancy allowance of ${vacancyPct.toFixed(1)}% is below Montreal's projected ${(this.VACANCY_RATE_MONTREAL_2025 * 100).toFixed(1)}% rate. Income projections may be optimistic.`,
          impact: 'medium',
          actionable: true,
          recommendation: `Use minimum ${(this.VACANCY_RATE_MONTREAL_2025 * 100).toFixed(1)}% vacancy allowance for conservative projections.`,
        });
      }
    }

    return insights;
  }

  /**
   * Analyze Price vs Assessment
   */
  private static analyzePriceVsAssessment(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];
    const { priceVsAssessment } = metrics;
    const { min, ideal, max } = this.BENCHMARKS.priceVsAssessment;

    if (!priceVsAssessment) return insights;

    if (priceVsAssessment < min) {
      insights.push({
        type: 'positive',
        category: 'valuation',
        title: 'Price Below Assessment',
        message: `Price at ${priceVsAssessment.toFixed(0)}% of assessment (<${min}%) may indicate undervalued opportunity or property issues.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Verify property condition and investigate why price is below municipal assessment.',
      });
    } else if (priceVsAssessment >= min && priceVsAssessment <= ideal) {
      insights.push({
        type: 'positive',
        category: 'valuation',
        title: 'Price Aligned with Assessment',
        message: `Price at ${priceVsAssessment.toFixed(0)}% of assessment (${min}-${ideal}%) indicates market value pricing.`,
        impact: 'low',
        actionable: false,
      });
    } else if (priceVsAssessment > ideal && priceVsAssessment <= max) {
      insights.push({
        type: 'neutral',
        category: 'valuation',
        title: 'Price Above Assessment',
        message: `Price at ${priceVsAssessment.toFixed(0)}% of assessment (${ideal}-${max}%) is moderate premium. Verify justification.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Ensure income potential or property improvements justify premium over assessment.',
      });
    } else {
      insights.push({
        type: 'warning',
        category: 'valuation',
        title: 'Significant Premium Over Assessment',
        message: `Price at ${priceVsAssessment.toFixed(0)}% of assessment (>${max}%) is significant premium. Strong justification required.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Obtain independent appraisal and verify income projections support this valuation.',
      });
    }

    return insights;
  }

  /**
   * Analyze Market Position relative to comparables
   */
  private static analyzeMarketPosition(
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>,
    comparables?: CMAProperty[]
  ): InvestmentInsight[] {
    const insights: InvestmentInsight[] = [];

    if (!comparables || comparables.length < 3) return insights;

    // Compare cap rates if available
    const compCapRates = comparables
      .map(c => (c as any).capRate)
      .filter((cr): cr is number => typeof cr === 'number');

    if (metrics.capRate && compCapRates.length >= 3) {
      const avgCompCapRate = compCapRates.reduce((sum, cr) => sum + cr, 0) / compCapRates.length;
      const capRateDiff = metrics.capRate - avgCompCapRate;
      const diffPct = (capRateDiff * 100).toFixed(2);

      if (capRateDiff > 0.005) {
        insights.push({
          type: 'positive',
          category: 'market',
          title: 'Above Market Cap Rate',
          message: `Property cap rate is ${diffPct}% above comparable average, indicating better value.`,
          impact: 'medium',
          actionable: false,
        });
      } else if (capRateDiff < -0.005) {
        insights.push({
          type: 'neutral',
          category: 'market',
          title: 'Below Market Cap Rate',
          message: `Property cap rate is ${Math.abs(Number(diffPct))}% below comparable average. Ensure quality justifies premium.`,
          impact: 'medium',
          actionable: true,
          recommendation: 'Verify property quality, location, or tenant profile justifies lower cap rate.',
        });
      }
    }

    return insights;
  }

  /**
   * Calculate overall rating based on insights and metrics
   */
  private static calculateOverallRating(
    insights: InvestmentInsight[],
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const criticalCount = insights.filter(i => i.type === 'critical').length;
    const warningCount = insights.filter(i => i.type === 'warning').length;
    const positiveCount = insights.filter(i => i.type === 'positive').length;

    // Critical issues = poor rating
    if (criticalCount > 0) return 'poor';

    // Multiple warnings = fair rating
    if (warningCount >= 3) return 'fair';

    // Mostly positive with few warnings = excellent
    if (positiveCount >= 4 && warningCount <= 1) return 'excellent';

    // Balance of positive and warnings = good
    if (positiveCount >= 2) return 'good';

    return 'fair';
  }

  /**
   * Calculate investment grade (A-F) based on metrics
   */
  private static calculateInvestmentGrade(
    insights: InvestmentInsight[],
    metrics: ReturnType<typeof RevenuePropertyInsightsGenerator.extractMetrics>
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0;
    let maxScore = 0;

    // Cap Rate (30 points)
    maxScore += 30;
    if (metrics.capRate) {
      const { min, ideal, max } = this.BENCHMARKS.capRate;
      if (metrics.capRate >= ideal && metrics.capRate <= max) score += 30;
      else if (metrics.capRate >= min && metrics.capRate < ideal) score += 20;
      else if (metrics.capRate > max) score += 15;
      else score += 10;
    } else {
      score += 15; // Neutral if not available
    }

    // GIM (20 points)
    maxScore += 20;
    if (metrics.gim) {
      const { min, ideal } = this.BENCHMARKS.gim;
      if (metrics.gim <= ideal) score += 20;
      else if (metrics.gim <= ideal + 2) score += 15;
      else score += 10;
    } else {
      score += 10;
    }

    // Expense Ratio (20 points)
    maxScore += 20;
    if (metrics.expenseRatio) {
      const { min, ideal, max } = this.BENCHMARKS.expenseRatio;
      if (metrics.expenseRatio >= min && metrics.expenseRatio <= ideal) score += 20;
      else if (metrics.expenseRatio <= max) score += 15;
      else score += 5;
    } else {
      score += 10;
    }

    // NOI Margin (20 points)
    maxScore += 20;
    if (metrics.noi && metrics.pgi) {
      const noiMargin = metrics.noi / metrics.pgi;
      if (noiMargin > 0.60) score += 20;
      else if (noiMargin >= 0.45) score += 15;
      else if (noiMargin >= 0.30) score += 10;
      else score += 5;
    } else {
      score += 10;
    }

    // Insights (10 points)
    maxScore += 10;
    const criticalCount = insights.filter(i => i.type === 'critical').length;
    const warningCount = insights.filter(i => i.type === 'warning').length;
    if (criticalCount === 0 && warningCount <= 1) score += 10;
    else if (criticalCount === 0 && warningCount <= 3) score += 7;
    else if (criticalCount <= 1) score += 5;
    else score += 2;

    // Calculate grade
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate quick summary text
   */
  static generateQuickSummary(summary: InsightsSummary): string {
    const { overallRating, investmentGrade, redFlags, recommendations } = summary;

    let text = `Investment Grade: ${investmentGrade} (${overallRating})\n\n`;

    if (redFlags.length > 0) {
      text += `⚠️ Red Flags:\n${redFlags.map(rf => `• ${rf}`).join('\n')}\n\n`;
    }

    if (recommendations.length > 0) {
      text += `💡 Top Recommendations:\n${recommendations.slice(0, 3).map(r => `• ${r}`).join('\n')}`;
    }

    return text;
  }
}
