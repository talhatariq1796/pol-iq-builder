/**
 * Predictive Analytics Module
 * Provides price forecasting, velocity predictions, and market projections
 */

export interface PriceForecast {
  predictions: MonthlyPrediction[];
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
  methodology: 'linear' | 'exponential' | 'seasonal' | 'hybrid';
  accuracy: number; // Historical accuracy score 0-100
}

export interface MonthlyPrediction {
  month: string;
  predictedPrice: number;
  confidence: number; // 0-1
  factors: {
    seasonal: number;
    trend: number;
    economic: number;
  };
}

export interface VelocityPrediction {
  currentVelocity: number; // % per month
  predictedVelocity: number; // Next 6 months
  acceleration: number; // Change in velocity
  inflectionPoint?: Date; // When trend might reverse
}

export interface SeasonalFactors {
  monthlyMultipliers: Record<string, number>; // 1-12 -> multiplier
  peakMonth: number;
  troughMonth: number;
  seasonalStrength: number; // 0-1
}

export interface EconomicImpact {
  interestRateImpact: number; // -1 to 1
  unemploymentImpact: number; // -1 to 1
  inflationImpact: number; // -1 to 1
  overallScore: number; // -1 to 1
}

export class PredictiveAnalytics {
  /**
   * Generate 6-month price forecast with confidence intervals
   */
  public generatePriceForecast(
    historicalData: HistoricalDataPoint[],
    economicIndicators?: EconomicIndicators
  ): PriceForecast {
    if (historicalData.length < 6) {
      return this.getDefaultForecast();
    }

    // Determine best methodology based on data characteristics
    const methodology = this.selectBestMethodology(historicalData);

    // Calculate seasonal factors
    const seasonalFactors = this.calculateSeasonalFactors(historicalData);

    // Generate base predictions
    const predictions = this.generatePredictions(
      historicalData,
      methodology,
      seasonalFactors,
      economicIndicators
    );

    // Calculate confidence intervals
    const confidenceInterval = this.calculateConfidenceIntervals(
      historicalData,
      predictions
    );

    // Calculate historical accuracy
    const accuracy = this.calculateForecastAccuracy(historicalData);

    return {
      predictions,
      confidenceInterval,
      methodology,
      accuracy
    };
  }

  /**
   * Predict market velocity trends
   */
  public predictVelocity(historicalData: HistoricalDataPoint[]): VelocityPrediction {
    if (historicalData.length < 3) {
      return {
        currentVelocity: 0,
        predictedVelocity: 0,
        acceleration: 0
      };
    }

    const sorted = [...historicalData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate current velocity (most recent 3 months)
    const currentVelocity = this.calculateVelocity(sorted.slice(-3));

    // Calculate historical velocity trend
    const velocities = this.calculateVelocityTrend(sorted);

    // Predict future velocity using linear regression
    const predictedVelocity = this.forecastVelocity(velocities);

    // Calculate acceleration (change in velocity)
    const acceleration = predictedVelocity - currentVelocity;

    // Detect inflection point if velocity trend is changing
    const inflectionPoint = this.detectInflectionPoint(sorted, velocities);

    return {
      currentVelocity,
      predictedVelocity,
      acceleration,
      inflectionPoint
    };
  }

  /**
   * Calculate seasonal adjustment factors
   */
  public calculateSeasonalFactors(
    historicalData: HistoricalDataPoint[]
  ): SeasonalFactors {
    // Group data by month
    const monthlyData: Record<number, number[]> = {};

    for (const point of historicalData) {
      const month = new Date(point.date).getMonth() + 1; // 1-12
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(point.price);
    }

    // Calculate average for each month
    const monthlyAverages: Record<number, number> = {};
    for (const month in monthlyData) {
      const prices = monthlyData[month];
      monthlyAverages[month] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    // Calculate overall average
    const overallAverage = Object.values(monthlyAverages).reduce((a, b) => a + b, 0)
      / Object.keys(monthlyAverages).length;

    // Calculate multipliers
    const monthlyMultipliers: Record<string, number> = {};
    for (const month in monthlyAverages) {
      monthlyMultipliers[month] = overallAverage > 0
        ? monthlyAverages[month] / overallAverage
        : 1.0;
    }

    // Find peak and trough
    let peakMonth = 1;
    let troughMonth = 1;
    let maxMultiplier = 0;
    let minMultiplier = Infinity;

    for (const month in monthlyMultipliers) {
      const multiplier = monthlyMultipliers[month];
      if (multiplier > maxMultiplier) {
        maxMultiplier = multiplier;
        peakMonth = parseInt(month);
      }
      if (multiplier < minMultiplier) {
        minMultiplier = multiplier;
        troughMonth = parseInt(month);
      }
    }

    // Calculate seasonal strength (variance from 1.0)
    const variances = Object.values(monthlyMultipliers).map(m => Math.abs(m - 1.0));
    const seasonalStrength = variances.reduce((a, b) => a + b, 0) / variances.length;

    return {
      monthlyMultipliers,
      peakMonth,
      troughMonth,
      seasonalStrength
    };
  }

  /**
   * Analyze economic impact on market
   */
  public analyzeEconomicImpact(
    economicIndicators: EconomicIndicators
  ): EconomicImpact {
    // Interest rate impact (inverse relationship)
    const interestRateImpact = this.calculateInterestRateImpact(
      economicIndicators.interestRate,
      economicIndicators.historicalInterestRate
    );

    // Unemployment impact (inverse relationship)
    const unemploymentImpact = this.calculateUnemploymentImpact(
      economicIndicators.unemployment,
      economicIndicators.historicalUnemployment
    );

    // Inflation impact (complex relationship)
    const inflationImpact = this.calculateInflationImpact(
      economicIndicators.inflation,
      economicIndicators.historicalInflation
    );

    // Overall score (weighted average)
    const overallScore = (
      interestRateImpact * 0.4 +
      unemploymentImpact * 0.3 +
      inflationImpact * 0.3
    );

    return {
      interestRateImpact,
      unemploymentImpact,
      inflationImpact,
      overallScore
    };
  }

  // Helper methods

  private getDefaultForecast(): PriceForecast {
    return {
      predictions: [],
      confidenceInterval: { lower: [], upper: [] },
      methodology: 'linear',
      accuracy: 0
    };
  }

  private selectBestMethodology(
    data: HistoricalDataPoint[]
  ): PriceForecast['methodology'] {
    // Check for seasonal patterns
    const seasonalStrength = this.calculateSeasonalFactors(data).seasonalStrength;

    if (seasonalStrength > 0.1) {
      return 'seasonal';
    }

    // Check for exponential growth
    if (this.isExponentialGrowth(data)) {
      return 'exponential';
    }

    return 'linear';
  }

  private isExponentialGrowth(data: HistoricalDataPoint[]): boolean {
    if (data.length < 4) return false;

    const prices = data.map(d => d.price);
    const logPrices = prices.map(p => Math.log(Math.max(1, p)));

    // Check if log prices are linear (indicates exponential)
    const correlation = this.calculateCorrelation(
      Array.from({ length: logPrices.length }, (_, i) => i),
      logPrices
    );

    return Math.abs(correlation) > 0.9;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xDenom = 0;
    let yDenom = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenom += xDiff * xDiff;
      yDenom += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenom * yDenom);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private generatePredictions(
    historicalData: HistoricalDataPoint[],
    methodology: PriceForecast['methodology'],
    seasonalFactors: SeasonalFactors,
    economicIndicators?: EconomicIndicators
  ): MonthlyPrediction[] {
    const predictions: MonthlyPrediction[] = [];
    const sorted = [...historicalData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const lastDate = new Date(sorted[sorted.length - 1].date);
    const lastPrice = sorted[sorted.length - 1].price;

    // Calculate trend
    const trend = this.calculateTrendSlope(sorted);

    // Economic impact
    const economicImpact = economicIndicators
      ? this.analyzeEconomicImpact(economicIndicators).overallScore
      : 0;

    // Generate 6 monthly predictions
    for (let i = 1; i <= 6; i++) {
      const predictionDate = new Date(lastDate);
      predictionDate.setMonth(predictionDate.getMonth() + i);

      const month = predictionDate.getMonth() + 1;
      const monthStr = predictionDate.toISOString().substring(0, 7);

      // Base prediction using methodology
      let basePrediction = 0;
      if (methodology === 'linear') {
        basePrediction = lastPrice + (trend * i);
      } else if (methodology === 'exponential') {
        basePrediction = lastPrice * Math.pow(1 + (trend / lastPrice), i);
      } else {
        basePrediction = lastPrice + (trend * i);
      }

      // Apply seasonal adjustment
      const seasonalMultiplier = seasonalFactors.monthlyMultipliers[month] || 1.0;
      const seasonalAdjustment = (seasonalMultiplier - 1.0) * 0.5; // Dampen seasonal effect

      // Apply economic impact
      const economicAdjustment = economicImpact * 0.3;

      // Final prediction
      const predictedPrice = basePrediction * (1 + seasonalAdjustment + economicAdjustment);

      // Calculate confidence (decreases with time)
      const confidence = Math.max(0.5, 1 - (i * 0.08));

      predictions.push({
        month: monthStr,
        predictedPrice: Math.round(predictedPrice),
        confidence,
        factors: {
          seasonal: seasonalAdjustment,
          trend: trend / lastPrice,
          economic: economicAdjustment
        }
      });
    }

    return predictions;
  }

  private calculateTrendSlope(sorted: HistoricalDataPoint[]): number {
    const n = sorted.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = sorted.map(d => d.price);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateConfidenceIntervals(
    historicalData: HistoricalDataPoint[],
    predictions: MonthlyPrediction[]
  ): { lower: number[]; upper: number[] } {
    // Calculate historical standard deviation
    const prices = historicalData.map(d => d.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    const lower: number[] = [];
    const upper: number[] = [];

    predictions.forEach((pred, index) => {
      // Confidence interval widens over time
      const multiplier = 1.96 * (1 + index * 0.2); // 95% confidence
      const margin = stdDev * multiplier;

      lower.push(Math.round(pred.predictedPrice - margin));
      upper.push(Math.round(pred.predictedPrice + margin));
    });

    return { lower, upper };
  }

  private calculateForecastAccuracy(historicalData: HistoricalDataPoint[]): number {
    if (historicalData.length < 12) return 50; // Default for insufficient data

    // Use last 6 months to test prediction accuracy
    const testData = historicalData.slice(-6);
    const trainData = historicalData.slice(0, -6);

    const testForecast = this.generatePredictions(
      trainData,
      this.selectBestMethodology(trainData),
      this.calculateSeasonalFactors(trainData)
    );

    // Calculate MAPE (Mean Absolute Percentage Error)
    let totalError = 0;
    const compareLength = Math.min(testForecast.length, testData.length);

    for (let i = 0; i < compareLength; i++) {
      const actual = testData[i].price;
      const predicted = testForecast[i].predictedPrice;
      const percentageError = Math.abs((actual - predicted) / actual);
      totalError += percentageError;
    }

    const mape = (totalError / compareLength) * 100;
    const accuracy = Math.max(0, Math.min(100, 100 - mape));

    return Math.round(accuracy);
  }

  private calculateVelocity(data: HistoricalDataPoint[]): number {
    if (data.length < 2) return 0;

    const sorted = [...data].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstPrice = sorted[0].price;
    const lastPrice = sorted[sorted.length - 1].price;
    const monthsDiff = this.getMonthsDifference(
      new Date(sorted[0].date),
      new Date(sorted[sorted.length - 1].date)
    );

    return monthsDiff > 0
      ? ((lastPrice - firstPrice) / firstPrice / monthsDiff) * 100
      : 0;
  }

  private calculateVelocityTrend(sorted: HistoricalDataPoint[]): number[] {
    const velocities: number[] = [];
    const windowSize = 3;

    for (let i = windowSize; i < sorted.length; i++) {
      const window = sorted.slice(i - windowSize, i);
      velocities.push(this.calculateVelocity(window));
    }

    return velocities;
  }

  private forecastVelocity(velocities: number[]): number {
    if (velocities.length === 0) return 0;
    if (velocities.length === 1) return velocities[0];

    // Simple linear forecast
    const n = velocities.length;
    const xMean = (n - 1) / 2;
    const yMean = velocities.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (velocities[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    return yMean + slope * n; // Forecast next period
  }

  private detectInflectionPoint(
    sorted: HistoricalDataPoint[],
    velocities: number[]
  ): Date | undefined {
    if (velocities.length < 3) return undefined;

    // Detect sign change in acceleration
    for (let i = 1; i < velocities.length; i++) {
      const prevAccel = velocities[i] - velocities[i - 1];
      const currAccel = velocities[i] - velocities[i - 1];

      if (prevAccel * currAccel < 0) {
        // Sign change detected
        const inflectionIndex = Math.min(i + 2, sorted.length - 1);
        return new Date(sorted[inflectionIndex].date);
      }
    }

    return undefined;
  }

  private getMonthsDifference(start: Date, end: Date): number {
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  private calculateInterestRateImpact(current: number, historical: number): number {
    const change = current - historical;
    // Higher rates = negative impact
    return Math.max(-1, Math.min(1, -change * 0.2));
  }

  private calculateUnemploymentImpact(current: number, historical: number): number {
    const change = current - historical;
    // Higher unemployment = negative impact
    return Math.max(-1, Math.min(1, -change * 0.3));
  }

  private calculateInflationImpact(current: number, historical: number): number {
    const change = current - historical;
    // Moderate inflation is positive, high inflation is negative
    if (current < 2) return 0.2;
    if (current > 5) return -0.5;
    return Math.max(-1, Math.min(1, -change * 0.15));
  }
}

// Supporting interfaces

export interface HistoricalDataPoint {
  date: string;
  price: number;
}

export interface EconomicIndicators {
  interestRate: number;
  historicalInterestRate: number;
  unemployment: number;
  historicalUnemployment: number;
  inflation: number;
  historicalInflation: number;
}
