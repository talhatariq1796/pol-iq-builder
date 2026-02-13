/**
 * Client-Side Chart Generator
 *
 * Generates professional Chart.js charts and converts them to base64 images
 * for embedding in PDF reports. Works entirely client-side to avoid
 * Vercel serverless canvas limitations.
 *
 * Usage:
 * const generator = new ChartGenerator();
 * const chartImages = await generator.generateAllCharts(data);
 * // Pass chartImages to PDF API
 */

import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
  DoughnutController
} from 'chart.js';
import { ChartKeys } from './ChartKeys';

// Register Chart.js components
Chart.register(...registerables);

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartGenerationOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  showLegend?: boolean;
  showGrid?: boolean;
}

/**
 * BHHS Burgundy Color Palette - Matches ColorPalette.ts CHART_COLORS
 */
const COLOR_PALETTE = {
  lightBurgundy: '#D1A0C7',   // Light burgundy (primary)
  mediumBurgundy: '#A8668A',  // Medium burgundy
  regularBurgundy: '#8B1538', // Regular burgundy
  gold: '#C8A882',            // BHHS Gold
  baseBurgundy: '#670338',    // Base burgundy
  darkBurgundy: '#4D0229',    // Dark burgundy
  grey: '#EAE9E9',            // Light Grey
};

const CHART_COLORS = [
  COLOR_PALETTE.lightBurgundy,    // #D1A0C7 - Primary data series
  COLOR_PALETTE.mediumBurgundy,   // #A8668A - Secondary series
  COLOR_PALETTE.regularBurgundy,  // #8B1538 - Tertiary series
  COLOR_PALETTE.gold,             // #C8A882 - Gold accent
  COLOR_PALETTE.baseBurgundy,     // #670338 - Base burgundy
  COLOR_PALETTE.darkBurgundy,     // #4D0229 - Dark burgundy
  COLOR_PALETTE.mediumBurgundy,   // Repeated for more data points
  COLOR_PALETTE.lightBurgundy,    // Repeated for more data points
];

// Global counter to ensure unique canvas IDs across all instances
let globalCanvasIdCounter = 0;

/**
 * Chart Generator for CMA Reports
 */
export class ChartGenerator {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private instanceId: string;
  private chartIdCounter = 0;

  constructor() {
    // Generate unique instance ID using global counter
    this.instanceId = `gen${globalCanvasIdCounter++}`;
  }

  /**
   * Initialize canvas element
   * Creates a fresh canvas for each chart to avoid Chart.js reuse errors
   */
  private initCanvas(width: number, height: number): void {
    if (typeof document === 'undefined') {
      throw new Error('ChartGenerator must be used in browser environment');
    }

    // Always create a new canvas to avoid Chart.js ID conflicts
    // Use instance ID to ensure uniqueness across multiple ChartGenerator instances
    this.canvas = document.createElement('canvas');
    this.canvas.id = `chart-canvas-${this.instanceId}-${this.chartIdCounter++}`;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Clear canvas completely to ensure no residual state
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Generate a bar chart
   */
  async generateBarChart(
    data: ChartDataPoint[],
    options: ChartGenerationOptions = {}
  ): Promise<string> {
    const {
      width = 600,
      height = 400,
      backgroundColor = '#FFFFFF',
      showLegend = false,
      showGrid = true,
    } = options;

    this.initCanvas(width, height);

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Value',
          data: data.map(d => d.value),
          backgroundColor: CHART_COLORS.slice(0, data.length).map(c => `${c}99`), // 60% opacity (hex 99)
          borderColor: CHART_COLORS.slice(0, data.length),
          borderWidth: 0,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: showLegend,
            position: 'bottom',
          },
          tooltip: {
            enabled: false,
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              display: showGrid,
              color: COLOR_PALETTE.grey,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Helvetica',
              },
              color: '#666666',
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Helvetica',
              },
              color: '#666666',
            }
          }
        },
        layout: {
          padding: 10
        }
      }
    };

    const chart = new Chart(this.ctx!, config);

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));

    const imageData = this.canvas!.toDataURL('image/png');
    chart.destroy();

    return imageData;
  }

  /**
   * Generate a line chart
   */
  async generateLineChart(
    data: ChartDataPoint[],
    options: ChartGenerationOptions = {}
  ): Promise<string> {
    const {
      width = 600,
      height = 400,
      backgroundColor = '#FFFFFF',
      showLegend = false,
      showGrid = true,
    } = options;

    this.initCanvas(width, height);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Trend',
          data: data.map(d => d.value),
          borderColor: COLOR_PALETTE.regularBurgundy,
          backgroundColor: `${COLOR_PALETTE.regularBurgundy}99`, // 60% opacity
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: COLOR_PALETTE.regularBurgundy,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: showLegend,
          },
          tooltip: {
            enabled: false,
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              display: showGrid,
              color: COLOR_PALETTE.grey,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Helvetica',
              },
              color: '#666666',
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Helvetica',
              },
              color: '#666666',
            }
          }
        },
        layout: {
          padding: 10
        }
      }
    };

    const chart = new Chart(this.ctx!, config);

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));

    const imageData = this.canvas!.toDataURL('image/png');
    chart.destroy();

    return imageData;
  }

  /**
   * Generate a donut chart
   */
  async generateDonutChart(
    data: ChartDataPoint[],
    options: ChartGenerationOptions = {}
  ): Promise<string> {
    const {
      width = 400,
      height = 400,
      backgroundColor = '#FFFFFF',
      showLegend = true,
    } = options;

    this.initCanvas(width, height);

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: CHART_COLORS.slice(0, data.length).map(c => `${c}99`), // 60% opacity (hex 99)
          borderColor: '#FFFFFF',
          borderWidth: 3,
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: showLegend,
            position: 'right',
            labels: {
              font: {
                size: 11,
                family: 'Helvetica',
              },
              color: '#666666',
              padding: 12,
            }
          },
          tooltip: {
            enabled: false,
          }
        },
        cutout: '60%',
        layout: {
          padding: 10
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: (chart) => {
          const { ctx, chartArea: { width, height } } = chart;
          ctx.save();

          const total = data.reduce((sum, d) => sum + d.value, 0);

          // Don't show center text for percentage data (total ~80-105)
          // Show center text for count data (property counts, etc.)
          // Wider range to handle rounding variations in demographic percentages
          const isPercentageData = total >= 80 && total <= 105;

          if (!isPercentageData) {
            ctx.font = 'bold 24px Helvetica';
            ctx.fillStyle = COLOR_PALETTE.regularBurgundy;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${total}`, width / 2, height / 2 - 10);

            ctx.font = '12px Helvetica';
            ctx.fillStyle = '#666666';
            ctx.fillText('Total', width / 2, height / 2 + 15);
          }

          ctx.restore();
        }
      }]
    };

    const chart = new Chart(this.ctx!, config);

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));

    const imageData = this.canvas!.toDataURL('image/png');
    chart.destroy();

    return imageData;
  }

  /**
   * Generate all charts needed for CMA report
   */
  async generateAllCharts(data: {
    priceHistory: ChartDataPoint[];
    inventoryByType: ChartDataPoint[];
    daysOnMarket: ChartDataPoint[];
    ageDistribution: ChartDataPoint[];
    incomeDistribution: ChartDataPoint[];
    industryDistribution: ChartDataPoint[];
    educationLevels?: ChartDataPoint[];
    homeownershipTenure?: ChartDataPoint[];
    affordabilityGauge?: ChartDataPoint[];
    growthIndexGauge?: ChartDataPoint[];
    // Page 4 new charts
    housingTenure?: ChartDataPoint[];
    incomeComparison?: ChartDataPoint[];
    dwellingTypes?: ChartDataPoint[];
    condoTenure?: ChartDataPoint[];
    populationStats?: ChartDataPoint[];
    ageDistributionDemographic?: ChartDataPoint[];
    // Page 6 velocity charts
    velocityDistribution?: ChartDataPoint[];
    velocityByPrice?: ChartDataPoint[];
  }): Promise<Record<string, string>> {
    console.log('[ChartGenerator] Generating all CMA charts...');

    const charts: Record<string, string> = {};

    // Page 2 Charts - use ChartKeys constants to prevent mismatches
    // Full width line chart (180mm = ~680px at 96dpi, height increased for 90mm = ~340px)
    console.log(`[ChartGenerator] Generating ${ChartKeys.PRICE_HISTORY} with data:`, data.priceHistory);
    charts[ChartKeys.PRICE_HISTORY] = await this.generateLineChart(
      data.priceHistory,
      { width: 680, height: 340 }
    );

    // REMOVED: Page 2 now only has one chart (price history)
    // charts[ChartKeys.INVENTORY_BY_TYPE] = await this.generateDonutChart(
    //   data.inventoryByType,
    //   { width: 320, height: 265 }
    // );

    // REMOVED: Page 2 now only has one chart (price history)
    // charts[ChartKeys.DAYS_ON_MARKET] = await this.generateBarChart(
    //   data.daysOnMarket,
    //   { width: 320, height: 265 }
    // );

    // Page 4 Charts (demographic data) - use ChartKeys constants
    if (data.housingTenure && data.housingTenure.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.HOUSING_TENURE} with data:`, data.housingTenure);
      charts[ChartKeys.HOUSING_TENURE] = await this.generateDonutChart(
        data.housingTenure,
        { width: 320, height: 245 }
      );
    }

    if (data.incomeComparison && data.incomeComparison.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.INCOME_COMPARISON} with data:`, data.incomeComparison);
      charts[ChartKeys.INCOME_COMPARISON] = await this.generateBarChart(
        data.incomeComparison,
        { width: 320, height: 245 }
      );
    }

    if (data.populationStats && data.populationStats.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.POPULATION_STATS} with data:`, data.populationStats);
      charts[ChartKeys.POPULATION_STATS] = await this.generateBarChart(
        data.populationStats,
        { width: 320, height: 245 }
      );
    }

    if (data.ageDistributionDemographic && data.ageDistributionDemographic.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.AGE_DISTRIBUTION_DEMOGRAPHIC} with data:`, data.ageDistributionDemographic);
      charts[ChartKeys.AGE_DISTRIBUTION_DEMOGRAPHIC] = await this.generateBarChart(
        data.ageDistributionDemographic,
        { width: 320, height: 245 }
      );
    }

    // Page 5 Charts (economic indicators) - use ChartKeys constants
    console.log(`[ChartGenerator] Generating ${ChartKeys.INDUSTRY_DISTRIBUTION} with data:`, data.industryDistribution);
    charts[ChartKeys.INDUSTRY_DISTRIBUTION] = await this.generateBarChart(
      data.industryDistribution,
      { width: 680, height: 265 }
    );

    // Page 6 Velocity Charts - use ChartKeys constants
    if (data.velocityDistribution && data.velocityDistribution.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.VELOCITY_DISTRIBUTION} with data:`, data.velocityDistribution);
      charts[ChartKeys.VELOCITY_DISTRIBUTION] = await this.generateBarChart(
        data.velocityDistribution,
        { width: 322, height: 340 } // 85mm x 90mm in pixels at 96 DPI
      );
    }

    if (data.velocityByPrice && data.velocityByPrice.length > 0) {
      console.log(`[ChartGenerator] Generating ${ChartKeys.VELOCITY_BY_PRICE} with data:`, data.velocityByPrice);
      charts[ChartKeys.VELOCITY_BY_PRICE] = await this.generateBarChart(
        data.velocityByPrice,
        { width: 322, height: 340 } // 85mm x 90mm in pixels at 96 DPI
      );
    }

    console.log('[ChartGenerator] Generated', Object.keys(charts).length, 'charts:', Object.keys(charts));

    // Debug: Log first few characters of each chart image to verify they're different
    Object.entries(charts).forEach(([key, value]) => {
      console.log(`[ChartGenerator] ${key}: ${value.substring(0, 50)}...`);
    });

    return charts;
  }

  /**
   * Cleanup canvas element
   */
  destroy(): void {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
