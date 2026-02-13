import React, { useState, useEffect, useCallback } from 'react';
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Query from "@arcgis/core/rest/support/Query";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MapPin, DollarSign, Activity, MoreHorizontal, Download, Edit, Users } from 'lucide-react';
import { ChartComponent } from './ChartComponent';
import { ChartCustomizer } from './ChartCustomizer';
import { ColorPicker } from '@/components/ui/color-picker';
import type { ChartConfig } from '@/types/reports';
import SimpleMap from './SimpleMap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Skeleton } from './ui/skeleton';
import { layers } from '@/config/layers';

type BusinessData = Array<{
  type: string;
  count: number;
}>;

type IndexData = Array<{
  category: string;
  index: number;
}>;

interface DemographicData {
  totalPopulation: number;
  medianAge: number;
  medianIncome: number;
  diversityIndex: number;
}

interface AnalysisData {
  business: BusinessData;
  spending: IndexData;
  psychographics: IndexData;
  demographics: DemographicData;
}

interface AnalysisDashboardProps {
  geometry?: __esri.Geometry;
}

interface MapConfig {
  unitType: 'miles' | 'kilometers';
  colors: {
    area: string;
    border: string;
  };
  zoom: number;
  center: [number, number];
}

interface DemographicsConfig {
  iconColor: string;
  textColor: string;
}

type ExtendedPolygon = __esri.Polygon;

// Define a type for the other layers query structure (placeholder)
interface OtherLayerQueryInfo {
  id: string;
  url: string;
  field?: string; 
  // Add other necessary properties based on actual usage
}

const createLayer = async (url: string) => {
  try {
    const layer = new FeatureLayer({ url });
    await layer.load();
    return layer;
  } catch (error) {
    console.error('Layer load error:', url, error);
    throw error;
  }
};

const exportAsImage = async (elementId: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const canvas = await html2canvas(element);
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = image;
  link.download = `${elementId}-export.png`;
  link.click();
};

const exportAsPDF = async (elementId: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${elementId}-export.pdf`);
};

const exportAsText = (text: string, filename: string): void => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const ActionMenu = ({ 
  onEdit, 
  onExportImage, 
  onExportPDF,
  onExportTXT,
  title = "Chart"
}: { 
  onEdit?: () => void, 
  onExportImage?: () => void,
  onExportPDF?: () => void,
  onExportTXT?: () => void,
  title?: string
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="bg-white">
      {onEdit && <DropdownMenuItem onClick={onEdit}><Edit className="mr-2 h-4 w-4" /><span>Edit {title}</span></DropdownMenuItem>}
      {(onExportImage || onExportPDF || onExportTXT) && (
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" /><span>Export</span>
            </DropdownMenuItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white">
            {onExportImage && <DropdownMenuItem onClick={onExportImage}>As Image</DropdownMenuItem>}
            {onExportPDF && <DropdownMenuItem onClick={onExportPDF}>As PDF</DropdownMenuItem>}
            {onExportTXT && <DropdownMenuItem onClick={onExportTXT}>As Text</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

const MapCustomizer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: MapConfig) => void;
  config: MapConfig;
}> = ({
  isOpen,
  onClose,
  onConfigChange,
  config
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="bg-white">
      <DialogHeader>
        <DialogTitle>Customize Map</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label>Unit Type</Label>
          <RadioGroup
            value={config.unitType}
            onValueChange={(value: string) => 
              onConfigChange({ ...config, unitType: value as 'miles' | 'kilometers' })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="miles" id="miles" />
              <Label htmlFor="miles">Miles</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="kilometers" id="kilometers" />
              <Label htmlFor="kilometers">Kilometers</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>Colors</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Area Fill</Label>
              <ColorPicker
                color={config.colors.area}
                onChange={(color) => 
                  onConfigChange({ 
                    ...config, 
                    colors: { ...config.colors, area: color }
                  })
                }
              />
            </div>
            <div>
              <Label>Border</Label>
              <ColorPicker
                color={config.colors.border}
                onChange={(color) => 
                  onConfigChange({ 
                    ...config, 
                    colors: { ...config.colors, border: color }
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const DemographicsCustomizer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: DemographicsConfig) => void;
  config: DemographicsConfig;
}> = ({
  isOpen,
  onClose,
  onConfigChange,
  config
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="bg-white">
      <DialogHeader>
        <DialogTitle>Customize Demographics Display</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div>
          <Label>Icon Color</Label>
          <ColorPicker
            color={config.iconColor}
            onChange={(color) => 
              onConfigChange({ ...config, iconColor: color })
            }
          />
        </div>
        <div>
          <Label>Text Color</Label>
          <ColorPicker
            color={config.textColor}
            onChange={(color) => 
              onConfigChange({ ...config, textColor: color })
            }
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const StatCard = ({ 
  icon, 
  value, 
  label, 
  formatter = (val: number) => val,
  textColor = '#1e293b'
}: { 
  icon: React.ReactNode;
  value: number;
  label: string;
  formatter?: (val: number) => string | number;
  textColor?: string;
}) => (
  <div className="flex flex-col items-center justify-center p-4 bg-muted/5 rounded-lg">
    <div className="h-8 w-8 mb-2 text-muted-foreground">
      {icon}
    </div>
    <p className="font-bold text-lg" style={{ color: textColor }}>{formatter(value)}</p>
    <p className="text-sm text-muted-foreground" style={{ color: textColor }}>{label}</p>
  </div>
);

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ geometry }) => {
  const [businessChartConfig, setBusinessChartConfig] = useState<ChartConfig>({
    type: 'bar',
    colors: ['#2563eb', '#3b82f6', '#60a5fa'],
    showLegend: true,
    title: 'Business Distribution'
  });
  
  const [spendingChartConfig, setSpendingChartConfig] = useState<ChartConfig>({
    type: 'bar',
    colors: ['#059669', '#10b981', '#34d399'],
    showLegend: true,
    title: 'Spending & Attitudes'
  });

  const [mapConfig, setMapConfig] = useState<MapConfig>({
    unitType: 'miles',
    colors: {
      area: '#3b82f6',
      border: '#1d4ed8'
    },
    zoom: 12,
    center: [-118.2437, 34.0522] as [number, number]
  });

  const [demographicsConfig, setDemographicsConfig] = useState<DemographicsConfig>({
    iconColor: '#64748b',
    textColor: '#1e293b'
  });

  const [isBusinessChartCustomizerOpen, setIsBusinessChartCustomizerOpen] = useState(false);
  const [isSpendingChartCustomizerOpen, setIsSpendingChartCustomizerOpen] = useState(false);
  const [isMapCustomizerOpen, setIsMapCustomizerOpen] = useState(false);
  const [isDemographicsCustomizerOpen, setIsDemographicsCustomizerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const fetchData = useCallback(async () => {
    if (!geometry) return;
    setIsLoading(true);
    setError(null);

    const demographicValues = { totalPopulation: 0,
                                medianAge: 0, 
                                medianIncome: 0, 
                                diversityIndex: 0 };
    const businessData: BusinessData = [];
    const spendingData: IndexData = [];
    const psychographicsData: IndexData = [];

    try {
      const fedLayerConfig = layers['FED_data'];
      if (!fedLayerConfig) {
        throw new Error('FED_data layer configuration not found.');
      }

      const fieldsToFetch = [
        'ECYHTYHHD',
        'ECYPTAMED',
        'ECYHNIMED'
      ];

      const fedLayer = await createLayer(fedLayerConfig.url);
      const demographicQuery = new Query({
        geometry: geometry,
        spatialRelationship: "intersects",
        outFields: fieldsToFetch,
        returnGeometry: false
      });

      const demographicResults = await fedLayer.queryFeatures(demographicQuery);

      let totalHouseholdsSum = 0;
      let medianAgeSum = 0;
      let medianIncomeSum = 0;
      let validFeaturesCount = 0;

      if (demographicResults.features && demographicResults.features.length > 0) {
        demographicResults.features.forEach(feature => {
          const attrs = feature.attributes;
          if (attrs) {
              totalHouseholdsSum += attrs['ECYHTYHHD'] || 0;
              medianAgeSum += attrs['ECYPTAMED'] || 0;
              medianIncomeSum += attrs['ECYHNIMED'] || 0;
              validFeaturesCount++;
          }
        });

        if (validFeaturesCount > 0) {
           demographicValues.totalPopulation = totalHouseholdsSum;
           demographicValues.medianAge = medianAgeSum / validFeaturesCount;
           demographicValues.medianIncome = medianIncomeSum / validFeaturesCount;
        } else {
          console.warn('No valid demographic features found in the specified geometry.');
        }
      } else {
          console.warn('No demographic features found intersecting the geometry.');
      }

      // --- Fetch other data (Business, Spending, Psychographics) - Assuming these have separate configs/logic --- 
      // Provide explicit type for the array
      const otherLayersToQuery: OtherLayerQueryInfo[] = [
          // Example: Keep existing logic for other layers if they are still valid
          // { id: 'business', url: 'URL_FOR_BUSINESS_LAYER', field: 'BUSINESS_FIELD' }, 
          // { id: 'spending', url: 'URL_FOR_SPENDING_LAYER', field: 'SPENDING_FIELD' },
          // ... etc ...
      ];

      // Example: Placeholder for fetching and processing other data 
      const otherPromises = otherLayersToQuery.map(async (layerInfo) => { 
          try {
             const layer = await createLayer(layerInfo.url);
             // Use layerInfo.field if needed in the query
             const query = new Query({ 
                 geometry: geometry, 
                 spatialRelationship: "intersects", 
                 outFields: layerInfo.field ? [layerInfo.field, '*'] : ['*'], // Example query fields
                 returnGeometry: false 
             });
             const results = await layer.queryFeatures(query);
             // Process results for business, spending, etc.
             // Example: return { id: layerInfo.id, data: processedResults };
             return null; // Placeholder
          } catch(err) {
              console.error(`Failed to fetch/process layer ${layerInfo.id}:`, err);
              return null; // Handle error for individual layers
          }
      });

      const otherResults = await Promise.all(otherPromises);
      otherResults.forEach(result => {
          if (!result) return;
      });

      setAnalysisData({
        business: businessData,
        spending: spendingData,
        psychographics: psychographicsData,
        demographics: demographicValues,
      });

    } catch (error) {
      console.error('Error fetching analysis data:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [geometry]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateAIInsights = (data: AnalysisData): string => {
    const { demographics, business, spending, psychographics } = data;
    
    const highSpendingCategories = spending
      .filter(s => s.index > 120)
      .map(s => s.category.replace(/-/g, ' '))
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    
    const youngPopulation = demographics.medianAge < 35;
    const affluentArea = demographics.medianIncome > 100000;
    const diverseArea = demographics.diversityIndex > 75;
    
    const fitnessEngagement = psychographics
      .filter(p => p.index > 110)
      .length / psychographics.length;
    
    const totalBusinesses = business.reduce((sum, b) => sum + b.count, 0);
    
    return `This area has a population of ${demographics.totalPopulation.toLocaleString()} with ${diverseArea ? 'high cultural diversity' : 'moderate diversity'} and a ${youngPopulation ? 'younger' : 'mature'} demographic profile (median age: ${demographics.medianAge}). ${
      highSpendingCategories.length > 0 
        ? `Residents show above-average spending on ${highSpendingCategories.join(', ')}.`
        : 'Spending patterns align with national averages.'
    } ${
      fitnessEngagement > 0.5 
        ? `Strong interest in fitness activities suggests potential for specialized services.` 
        : 'Moderate fitness engagement indicates opportunity for introductory programs.'
    } The area contains ${totalBusinesses} fitness-related businesses, with ${
      affluentArea 
        ? `premium service potential due to high median income ($${demographics.medianIncome.toLocaleString()}).`
        : `opportunities for value-oriented services (median income: $${demographics.medianIncome.toLocaleString()}).`
    }`;
  };

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (isLoading || !analysisData) {
    return (
      <div className="h-screen overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {/* Skeletons for loading state */}
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[400px] w-full lg:col-span-2" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const aiInsightsText = generateAIInsights(analysisData);

  return (
    <div className="h-screen overflow-y-auto">
      <div className="grid grid-cols-1 gap-4 p-4">
        <Card className="col-span-2" id="insights-export">
          <CardHeader className="pb-2 flex flex-row justify-between items-center border-b">
            <CardTitle>AI Insights</CardTitle>
            <ActionMenu
              title="Insights"
              onExportPDF={() => exportAsPDF('insights-export')}
              onExportTXT={() => exportAsText(aiInsightsText, 'insights-export.txt')}
            />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground pt-4">
              {aiInsightsText}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        <Card className="h-[calc(50vh-32px)] overflow-hidden relative" id="map-export">
          <CardHeader className="pb-2 flex flex-row justify-between items-center border-b z-20 bg-card absolute top-0 left-0 right-0 bg-[#F9FAFB]">
            <div className="flex items-center gap-2">
              <CardTitle>Area Map</CardTitle>
            </div>
            <div>
              <DropdownMenu modal={true}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <DropdownMenuItem onClick={() => setIsMapCustomizerOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Map</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsImage('map-export')}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Export as Image</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsPDF('map-export')}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Export as PDF</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-full">
            {geometry && <SimpleMap 
              geometry={geometry as ExtendedPolygon} 
              config={{
                center: mapConfig.center, 
                zoom: mapConfig.zoom, 
                colors: { 
                  area: mapConfig.colors.area,
                  border: mapConfig.colors.border
                },
                unitType: mapConfig.unitType
              }}
              areaDescription=""
            />}
            <MapCustomizer
              isOpen={isMapCustomizerOpen}
              onClose={() => setIsMapCustomizerOpen(false)}
              config={mapConfig}
              onConfigChange={setMapConfig}
            />
          </CardContent>
        </Card>

        <Card className="h-[calc(50vh-32px)] overflow-hidden" id="demographics-export">
          <div className="h-full flex flex-col">
            <CardHeader className="pb-2 flex flex-row justify-between items-center border-b">
              <CardTitle>Demographics Overview</CardTitle>
              <ActionMenu 
                title="Demographics"
                onEdit={() => setIsDemographicsCustomizerOpen(true)}
                onExportImage={() => exportAsImage('demographics-export')}
                onExportPDF={() => exportAsPDF('demographics-export')}
              />
            </CardHeader>
            <CardContent className="flex-1 p-1 min-h-0">
              <div className="h-full grid grid-cols-2 items-center">
                <StatCard
                  icon={<Users style={{ color: demographicsConfig.iconColor }} />}
                  value={analysisData.demographics.totalPopulation}
                  label="Households"
                  formatter={val => val.toLocaleString()}
                  textColor={demographicsConfig.textColor}
                />
                <StatCard
                  icon={<Activity style={{ color: demographicsConfig.iconColor }} />}
                  value={analysisData.demographics.medianAge}
                  label="Median Age"
                  textColor={demographicsConfig.textColor}
                />
                <StatCard
                  icon={<DollarSign style={{ color: demographicsConfig.iconColor }} />}
                  value={analysisData.demographics.medianIncome}
                  label="Median Income"
                  formatter={val => `$${val.toLocaleString()}`}
                  textColor={demographicsConfig.textColor}
                />
                <StatCard
                  icon={<Activity style={{ color: demographicsConfig.iconColor }} />}
                  value={analysisData.demographics.diversityIndex}
                  label="Diversity Index"
                  textColor={demographicsConfig.textColor}
                />
              </div>
            </CardContent>
            <DemographicsCustomizer
              isOpen={isDemographicsCustomizerOpen}
              onClose={() => setIsDemographicsCustomizerOpen(false)}
              config={demographicsConfig}
              onConfigChange={setDemographicsConfig}
            />
          </div>
        </Card>

        <Card className="h-[calc(50vh-32px)] overflow-hidden" id="business-export">
          <CardHeader className="pb-2 flex flex-row justify-between items-center border-b">
            <CardTitle>Business Distribution</CardTitle>
            <ActionMenu 
              title="Chart"
              onEdit={() => setIsBusinessChartCustomizerOpen(true)}
              onExportImage={() => exportAsImage('business-export')}
              onExportPDF={() => exportAsPDF('business-export')}
            />
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <div className="h-full w-full">
              <ChartComponent
                data={analysisData.business}
                config={businessChartConfig}
                dataKey="count"
                nameKey="type"
              />
            </div>
            <ChartCustomizer
              isOpen={isBusinessChartCustomizerOpen}
              onClose={() => setIsBusinessChartCustomizerOpen(false)}
              chartType="business"
              config={businessChartConfig}
              onConfigChange={setBusinessChartConfig}
            />
          </CardContent>
        </Card>

        <Card className="h-[calc(50vh-32px)] overflow-hidden" id="spending-export">
          <CardHeader className="pb-2 flex flex-row justify-between items-center border-b">
            <CardTitle>Spending & Attitudes</CardTitle>
            <ActionMenu
              title="Chart"
              onEdit={() => setIsSpendingChartCustomizerOpen(true)}
              onExportImage={() => exportAsImage('spending-export')}
              onExportPDF={() => exportAsPDF('spending-export')}
            />
          </CardHeader>
          <CardContent className="h-[calc(100%-4rem)]">
            <div className="h-full w-full">
              <ChartComponent
                data={[...analysisData.spending, ...analysisData.psychographics]}
                config={spendingChartConfig}
                dataKey="index"
                nameKey="category"
              />
            </div>
            <ChartCustomizer
              isOpen={isSpendingChartCustomizerOpen}
              onClose={() => setIsSpendingChartCustomizerOpen(false)}
              chartType="spending"
              config={spendingChartConfig}
              onConfigChange={setSpendingChartConfig}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalysisDashboard;