// utils/dublinMarketData.ts
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import esriConfig from "@arcgis/core/config";

export interface BrandData {
  brand: string;
  year: number;
  total: number;
}

export interface MonthlyBrandData {
  brand: string;
  month: string;
  total: number;
}

export interface MarketShareData {
  year: number;
  month: string;
  brand: string;
  total: number;
}

export const fetchDublinMarketData = async () => {
  console.log('ArcGIS API Key:', process.env.NEXT_PUBLIC_ARCGIS_API_KEY);
  esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';

  const layer = new FeatureLayer({
    url: "https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/marketshare/FeatureServer/0",
    outFields: ["*"]
  });

  try {
    await layer.load();
    console.log('Layer loaded successfully');

    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = ["*"];

    const results = await layer.queryFeatures(query);
    console.log('Raw feature data:', results.features);

    if (!results.features.length) {
      console.error('No features returned - authentication may be required');
      throw new Error('No data available - authentication required');
    }

    const yearlyData: BrandData[] = [];
    const monthlyData: MonthlyBrandData[] = [];
    const marketShareData: MarketShareData[] = [];

    results.features.forEach(feature => {
      const attrs = feature.attributes;
      if (!attrs) return;

      const brand = attrs.Brand;
      if (!brand) return;

      const isMarketShare = brand.endsWith('_MS');
      const cleanBrand = isMarketShare ? brand.slice(0, -3) : brand;
      
      if (cleanBrand === '4BRANDS') return;

      for (const year of [2022, 2023]) {
        let yearTotal = 0;
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = `F${month}_1_${year}`;
          const monthValue = attrs[monthKey] || 0;

          if (monthValue > 0) {
            const monthString = `${year}-${String(month).padStart(2, '0')}`;

            if (isMarketShare) {
              marketShareData.push({
                brand: cleanBrand,
                year,
                month: monthString,
                total: monthValue
              });
            } else {
              yearTotal += monthValue;
              monthlyData.push({
                brand: cleanBrand,
                month: monthString,
                total: monthValue
              });
            }
          }
        }

        // Add yearly total for sales data
        if (!isMarketShare && yearTotal > 0) {
          yearlyData.push({ brand: cleanBrand, year, total: yearTotal });
        }
      }
    });

    console.log('Processed yearly data:', yearlyData);
    console.log('Processed monthly data:', monthlyData);
    console.log('Processed market share data:', marketShareData);

    return {
      yearlyData: yearlyData.sort((a, b) => a.year - b.year || a.brand.localeCompare(b.brand)),
      monthlyData: monthlyData.sort((a, b) => a.month.localeCompare(b.month) || a.brand.localeCompare(b.brand)),
      marketShareData: marketShareData.sort((a, b) => a.year - b.year || a.month.localeCompare(b.month) || a.brand.localeCompare(b.brand))
    };
  } catch (error) {
    console.error('Error accessing market share data:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Return mock data as before
    return {
      yearlyData: [
        { brand: "Brand A", year: 2022, total: 1000 },
        { brand: "Brand B", year: 2022, total: 800 },
        { brand: "Brand A", year: 2023, total: 1200 },
        { brand: "Brand B", year: 2023, total: 900 }
      ],
      monthlyData: [
        { brand: "Brand A", month: "2023-01", total: 100 },
        { brand: "Brand A", month: "2023-02", total: 110 },
        { brand: "Brand B", month: "2023-01", total: 80 },
        { brand: "Brand B", month: "2023-02", total: 85 }
      ]
    };
  }
};