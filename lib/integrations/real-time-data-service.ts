import { cache } from 'react';

interface EconomicIndicator {
  series_id: string;
  title: string;
  value: number;
  date: string;
  units: string;
  change_percent?: number;
}

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  change_percent: string;
  volume: number;
  timestamp: string;
}

interface RealTimeDataResponse {
  economic_indicators: EconomicIndicator[];
  market_data: MarketData[];
  last_updated: string;
  data_quality: 'high' | 'medium' | 'low';
  cache_status: 'fresh' | 'cached' | 'stale';
}

class RealTimeDataService {
  private fredApiKey: string;
  private alphaVantageApiKey: string;
  private cacheMap = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor() {
    this.fredApiKey = process.env.FRED_API_KEY || '';
    this.alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cacheMap.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      this.cacheMap.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttlSeconds: number = 3600): void {
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  async getEconomicIndicators(): Promise<EconomicIndicator[]> {
    const cacheKey = 'economic-indicators';
    const cached = this.getCachedData<EconomicIndicator[]>(cacheKey);
    if (cached) return cached;

    try {
      // Key economic indicators relevant to consumer behavior and demographics
      const indicators = [
        'GDP',          // GDP Growth
        'UNRATE',       // Unemployment Rate  
        'CPIAUCSL',     // Consumer Price Index
        'HOUST',        // Housing Starts
        'PAYEMS',       // Nonfarm Payrolls
        'DSPIC96',      // Real Disposable Personal Income
        'PCE'           // Personal Consumption Expenditures
      ];

      const promises = indicators.map(async (series) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${this.fredApiKey}&file_type=json&limit=1&sort_order=desc`;
        
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.observations && data.observations.length > 0) {
            const latest = data.observations[0];
            return {
              series_id: series,
              title: this.getIndicatorTitle(series),
              value: parseFloat(latest.value),
              date: latest.date,
              units: this.getIndicatorUnits(series),
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch ${series}:`, error);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validIndicators = results.filter((indicator): indicator is EconomicIndicator => 
        indicator !== null
      );

      this.setCachedData(cacheKey, validIndicators, 14400); // 4 hour cache
      return validIndicators;

    } catch (error) {
      console.error('Error fetching economic indicators:', error);
      return [];
    }
  }

  async getMarketData(): Promise<MarketData[]> {
    const cacheKey = 'market-data';
    const cached = this.getCachedData<MarketData[]>(cacheKey);
    if (cached) return cached;

    try {
      // Market indices relevant to consumer and retail analysis
      const symbols = ['SPY', 'QQQ', 'XLY', 'XLP']; // S&P 500, NASDAQ, Consumer Disc, Consumer Staples
      const promises = symbols.map(async (symbol) => {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.alphaVantageApiKey}`;
        
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data['Global Quote']) {
            const quote = data['Global Quote'];
            return {
              symbol,
              price: parseFloat(quote['05. price']),
              change: parseFloat(quote['09. change']),
              change_percent: quote['10. change percent'],
              volume: parseInt(quote['06. volume']),
              timestamp: new Date().toISOString()
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch ${symbol}:`, error);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validData = results.filter((data): data is MarketData => data !== null);

      this.setCachedData(cacheKey, validData, 300); // 5 minute cache
      return validData;

    } catch (error) {
      console.error('Error fetching market data:', error);
      return [];
    }
  }

  async getRealTimeDataSummary(): Promise<RealTimeDataResponse> {
    try {
      const [economicIndicators, marketData] = await Promise.all([
        this.getEconomicIndicators(),
        this.getMarketData()
      ]);

      const dataQuality = this.assessDataQuality(economicIndicators, marketData);
      const cacheStatus = this.getCacheStatus();

      return {
        economic_indicators: economicIndicators,
        market_data: marketData,
        last_updated: new Date().toISOString(),
        data_quality: dataQuality,
        cache_status: cacheStatus
      };

    } catch (error) {
      console.error('Error getting real-time data summary:', error);
      
      // Return fallback data structure
      return {
        economic_indicators: [],
        market_data: [],
        last_updated: new Date().toISOString(),
        data_quality: 'low',
        cache_status: 'stale'
      };
    }
  }

  private getIndicatorTitle(series: string): string {
    const titles: Record<string, string> = {
      'GDP': 'Gross Domestic Product',
      'UNRATE': 'Unemployment Rate',
      'CPIAUCSL': 'Consumer Price Index',
      'HOUST': 'Housing Starts',
      'PAYEMS': 'Nonfarm Payrolls',
      'DSPIC96': 'Real Disposable Personal Income',
      'PCE': 'Personal Consumption Expenditures'
    };
    return titles[series] || series;
  }

  private getIndicatorUnits(series: string): string {
    const units: Record<string, string> = {
      'GDP': 'Billions of $',
      'UNRATE': 'Percent',
      'CPIAUCSL': 'Index 1982-84=100',
      'HOUST': 'Thousands of Units',
      'PAYEMS': 'Thousands of Persons',
      'DSPIC96': 'Billions of $',
      'PCE': 'Billions of $'
    };
    return units[series] || 'Units';
  }

  private assessDataQuality(economic: EconomicIndicator[], market: MarketData[]): 'high' | 'medium' | 'low' {
    const totalIndicators = economic.length + market.length;
    if (totalIndicators >= 8) return 'high';
    if (totalIndicators >= 5) return 'medium';
    return 'low';
  }

  private getCacheStatus(): 'fresh' | 'cached' | 'stale' {
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    
    const cachedEcon = this.cacheMap.get('economic-indicators');
    const cachedMarket = this.cacheMap.get('market-data');
    
    if (cachedEcon && cachedMarket) {
      const oldestCache = Math.min(cachedEcon.timestamp, cachedMarket.timestamp);
      if (now - oldestCache < recentThreshold) return 'fresh';
      return 'cached';
    }
    
    return 'stale';
  }

  // Test API connectivity
  async testConnectivity(): Promise<{ fred: boolean; alphavantage: boolean }> {
    const fredTest = this.fredApiKey ? await this.testFredConnection() : false;
    const avTest = this.alphaVantageApiKey ? await this.testAlphaVantageConnection() : false;
    
    return {
      fred: fredTest,
      alphavantage: avTest
    };
  }

  private async testFredConnection(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${this.fredApiKey}&file_type=json`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testAlphaVantageConnection(): Promise<boolean> {
    try {
      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${this.alphaVantageApiKey}`);
      const data = await response.json();
      return !data['Error Message'] && !data['Note'];
    } catch {
      return false;
    }
  }
}

// Singleton instance with caching
const realTimeDataService = new RealTimeDataService();

// Cached function for Next.js optimization
export const getRealTimeData = cache(async (): Promise<RealTimeDataResponse> => {
  return realTimeDataService.getRealTimeDataSummary();
});

export const testDataConnectivity = cache(async () => {
  return realTimeDataService.testConnectivity();
});

export { realTimeDataService };
export type { RealTimeDataResponse, EconomicIndicator, MarketData };