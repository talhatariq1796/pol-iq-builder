export interface ApplianceData {
    marketOverview: {
      totalPotential: number;
      growthRate: number;
      storeIndex: number;
      housingUnits: number;
    };
    competitors: Array<{
      name: string;
      distance: number;
      marketShare: number;
    }>;
    spendingTrends: Array<{
      category: string;
      current: number;
      projected: number;
      growthRate: number;
    }>;
    demographics: {
      medianIncome: number;
      homeOwnership: number;
      recentMovers: number;
      gasRangeIndex: number;
      electricRangeIndex: number;
      recentBuyersIndex: number;
    };
  }
  
  export interface ApplianceMarketReportProps {
    data: ApplianceData | null;
    loading?: boolean;
    error?: string | null;
  }
  
  export interface ApplianceLayers {
    stores: __esri.FeatureLayer[];
    spending: __esri.FeatureLayer[];
    demographics: __esri.FeatureLayer[];
    storeExpenditure: __esri.FeatureLayer[];
  }