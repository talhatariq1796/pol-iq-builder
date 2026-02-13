import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BrandData, MarketShareData, fetchDublinMarketData } from '../utils/dublinMarketData';

interface MarketSharePopupProps {
  feature: __esri.Graphic;
}

const MarketSharePopup: React.FC<MarketSharePopupProps> = ({ feature }) => {
  const isDublin = feature.attributes.COUNTY === 'DUBLIN';
  const [selectedYear, setSelectedYear] = useState(2023);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    yearlyData: BrandData[];
    marketShareData: MarketShareData[];
    monthlyData: any[];
  }>({ yearlyData: [], marketShareData: [], monthlyData: [] });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await fetchDublinMarketData();
        setData({
          yearlyData: result.yearlyData,
          marketShareData: result.marketShareData || [],
          monthlyData: result.monthlyData || []
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load market data');
        console.error('Error loading market data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isDublin) {
      loadData();
    }
  }, [isDublin]);

  if (!isDublin) {
    return null; // Return early if not Dublin
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-gray-600">Loading market data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full h-full">
      <Card className="w-full h-full bg-white shadow-lg">
        <CardContent className="p-6">

        </CardContent>
      </Card>
    </div>
  );
};

export default MarketSharePopup;