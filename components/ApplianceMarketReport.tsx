import React, { useEffect, useRef, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer
} from 'recharts';

const recharts = require('recharts') as { 
  ScatterChart: React.ComponentType<any>; 
  Scatter: React.ComponentType<any>; 
};
const ScatterChart = recharts.ScatterChart;
const Scatter = recharts.Scatter;
import { Loader2, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Select, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select';

// Interfaces
interface SpendingData {
  category: string;
  current: number;
  projected: number;
  growthRate: number;
  [key: string]: string | number;
}

interface StoreExpenditureData {
  name: string;
  spendingIndex: number;
}

interface MarketOverview {
  totalPotential?: number;
  growthRate?: number;
  storeIndex?: number;
  housingUnits?: number;
}

interface ApplianceDemographics {
  gasRangeIndex?: number;
  electricRangeIndex?: number;
  recentBuyersIndex?: number;
  recentMoversPercentage?: number;
  housingUnits?: number;
  MP16074H_B_I?: number;
  MP16073H_B_I?: number;
  MP16061H_B_I?: number;
  ACSOMV2021_P?: number;
  TSHU23_CY?: number;
  [key: string]: number | undefined;
}

interface MobilityAndPurchaseData {
  recentMoversPercentage?: number;
  recentBuyersIndex?: number;
  housingUnits?: number;
  averageSpendingIndex?: number;
}

interface TechnologyAndEfficiencyData {
  gasRangeIndex?: number;
  electricRangeIndex?: number;
  applianceSpendingTrends?: SpendingData[];
}

interface ApplianceMarketData {
  marketOverview?: MarketOverview;
  spendingTrends?: SpendingData[];
  demographics?: ApplianceDemographics;
  mobilityInsights?: MobilityAndPurchaseData;
  technologyTrends?: TechnologyAndEfficiencyData;
  storeExpenditure?: StoreExpenditureData[];
}

interface ApplianceMarketReportProps {
  view: __esri.MapView;
  data?: ApplianceMarketData | null;
  loading?: boolean;
  error?: string | React.ReactNode | null;
  open?: boolean;
  onClose?: () => void;
  reportTemplate?: string;
  onReportTemplateChange?: (value: string) => void;
}

interface MetricCardProps {
  value: number | null | undefined;
  label: string;
  format?: 'currency' | 'percent' | 'number' | 'index';
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Utility Colors and Functions
const COLORS = ['#E22019', '#33A851', '#3F4A49', '#FF8042', '#8884d8'];

const formatValue = (
  value: number | null | undefined, 
  format: MetricCardProps['format'] = 'number'
): string => {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        maximumFractionDigits: 0 
      }).format(value);
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'index':
      return Number(value).toFixed(0);
    default:
      return new Intl.NumberFormat().format(value);
  }
};

// Utility Components
const MetricCard: React.FC<MetricCardProps> = ({ value, label, format = 'number' }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border">
    <div className="text-2xl font-bold">{formatValue(value, format)}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </div>
);

const ChartCard: React.FC<ChartCardProps> = ({ title, children, className = '' }) => (
  <Card className={`shadow-sm h-full overflow-hidden ${className}`}>
    <div className="bg-white h-full">
      <CardHeader className="pb-2 bg-white border-b">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="bg-white">{children}</CardContent>
    </div>
  </Card>
);

// Data Transformation Function
const transformData = (rawData: ApplianceMarketData | null): ApplianceMarketData | null => {
  if (!rawData) return null;

  const transformedSpendingTrends = rawData.spendingTrends?.map(trend => ({
    category: trend.category,
    current: trend.current,
    projected: trend.projected,
    growthRate: trend.growthRate
  })) || [];

  const { 
    gasRangeIndex = 0,
    electricRangeIndex = 0,
    recentBuyersIndex = 0,
    recentMovers = 0,
    totalHousingUnits: housingUnits = 0 
  } = rawData.demographics || {};

  return {
    marketOverview: rawData.marketOverview || {},
    spendingTrends: transformedSpendingTrends,
    demographics: {
      gasRangeIndex,
      electricRangeIndex,
      recentBuyersIndex,
      recentMoversPercentage: recentMovers,
      housingUnits: rawData?.marketOverview?.housingUnits || 0
    },
    mobilityInsights: {
      recentMoversPercentage: recentMovers,
      recentBuyersIndex,
      housingUnits: rawData?.marketOverview?.housingUnits || 0,
      averageSpendingIndex: rawData?.marketOverview?.storeIndex || 0
    },
    storeExpenditure: rawData.storeExpenditure || []
  };
};

// Main Component
const ApplianceMarketReport: React.FC<ApplianceMarketReportProps> = ({ 
  view,
  data: rawData,
  loading = false,
  error = null,
  reportTemplate,
  onReportTemplateChange
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Only clean up report-specific resources
  useEffect(() => {
    const cleanup = () => {
      // Clean up any report-specific state or resources here
      if (contentRef.current) {
        // Reset any modifications made to the content container
        contentRef.current.style.overflow = '';
        contentRef.current.style.height = '';
      }
    };

    // Call cleanup on component unmount
    return cleanup;
  }, []);

  const exportToPDF = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    
    try {
      const originalOverflow = contentRef.current.style.overflow;
      contentRef.current.style.overflow = 'visible';
      contentRef.current.style.height = 'auto';

      const canvas = await html2canvas(contentRef.current, { 
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowHeight: document.documentElement.scrollHeight
      });
      
      contentRef.current.style.overflow = originalOverflow;
      contentRef.current.style.height = '';

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let remainingHeight = pdfHeight;
      let currentPage = 0;

      while (remainingHeight > 0) {
        if (currentPage > 0) {
          pdf.addPage();
        }

        const pageHeight = pdf.internal.pageSize.getHeight();
        const sliceHeight = Math.min(remainingHeight, pageHeight);

        pdf.addImage(
          imgData, 
          'PNG', 
          0, 
          -currentPage * pageHeight, 
          pdfWidth, 
          pdfHeight
        );

        remainingHeight -= pageHeight;
        currentPage++;
      }

      pdf.save('appliance-market-report.pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const data = transformData(rawData ?? null);

  const renderMarketOverview = () => {
    const marketOverview = data?.marketOverview || {};
    const { 
      totalPotential = 0, 
      growthRate = 0, 
      storeIndex = 0, 
      housingUnits = 0 
    } = marketOverview;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Market Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            value={totalPotential}
            label="Market Potential"
            format="currency"
          />
          <MetricCard
            value={growthRate}
            label="Growth Rate"
            format="percent"
          />
          <MetricCard
            value={storeIndex}
            label="Store Index"
            format="index"
          />
          <MetricCard
            value={housingUnits}
            label="Housing Units"
            format="number"
          />
        </div>
      </div>
    );
  };

  const renderApplianceSpendingTrends = () => {
    const currentTrends = data?.spendingTrends || [];
    const storeExpenditure = data?.storeExpenditure || [];

    if (currentTrends.length === 0) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No spending trends data available</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4 bg-white">
        <h3 className="text-lg font-medium">Appliance Category Spending Trends</h3>
        {currentTrends.length > 0 && (
          <ChartCard title="Current vs Projected Spending">
            <div className="h-[400px] w-full bg-white">
              <ResponsiveContainer>
                <BarChart 
                  data={currentTrends}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 100
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                    interval={0}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 'auto']}
                    tickFormatter={(value: number) => value.toFixed(0)}
                    label={{ 
                      value: 'Spending Index', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      value.toFixed(1), 
                      name === 'current' ? 'Current (2024)' : 'Projected (2029)'
                    ]}
                  />
                  <Legend />
                  <Bar 
                    dataKey="current" 
                    name="Current (2024)" 
                    fill="#8884d8"
                    minPointSize={5}
                  />
                  <Bar 
                    dataKey="projected" 
                    name="Projected (2029)" 
                    fill="#82ca9d"
                    minPointSize={5}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
        
        {storeExpenditure.length > 0 && (
          <ChartCard title="Store Expenditure Analysis">
            <div className="h-[300px] w-full bg-white">
              <ResponsiveContainer>
                <BarChart 
                  data={storeExpenditure}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    label={{ 
                      value: 'Spending Index', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => value.toFixed(1)}
                  />
                  <Bar 
                    dataKey="spendingIndex" 
                    fill="#00C49F" 
                    name="Store Spending Index"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>
    );
  };

  const renderDemographicInsights = () => {
    const demographics = data?.demographics || {};
    const { 
      gasRangeIndex = 0, 
      electricRangeIndex = 0, 
      recentBuyersIndex = 0, 
      recentMoversPercentage = 0, 
      housingUnits = 0 
    } = demographics;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Demographic Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Range Ownership">
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Gas Range', value: gasRangeIndex },
                      { name: 'Electric Range', value: electricRangeIndex }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {['#0088FE', '#00C49F'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toFixed(1)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Market Dynamics">
            <div className="space-y-4 p-4">
              <MetricCard
                value={recentBuyersIndex}
                label="Recent Appliance Buyers Index"
                format="index"
              />
              <MetricCard
                value={recentMoversPercentage}
                label="Recent Movers Percentage"
                format="percent"
              />
              <MetricCard
                value={housingUnits}
                label="Total Housing Units"
                format="number"
              />
            </div>
          </ChartCard>
        </div>
      </div>
    );
  };

  const renderMobilityAndPurchaseInsights = () => {
    if (!data?.mobilityInsights) return null;
    
    const mobilityData = data.mobilityInsights;
    const { 
      recentMoversPercentage = 0, 
      recentBuyersIndex = 0, 
      housingUnits = 0,
      averageSpendingIndex = 0
    } = mobilityData;

    const scatterData = [
      { 
        x: recentMoversPercentage, 
        y: recentBuyersIndex, 
        name: 'Mobility vs Purchases' 
      }
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Mobility and Appliance Purchase Dynamics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Recent Movers vs Appliance Buyers">
            <div className="h-[400px] w-full">
              <ResponsiveContainer>
                <ScatterChart
                  margin={{
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20,
                  }}
                >
                  <CartesianGrid />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Recent Movers (%)"
                    domain={[0, 'auto']}
                    tickFormatter={(value: number) => `${value}%`}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Recent Buyers Index"
                    domain={[0, 'auto']}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    formatter={(value: number, name: string) => {
                      if (name === 'x') {
                        return [`${Number(value).toFixed(1)}%`, 'Recent Movers'];
                      }
                      return [`${Number(value).toFixed(1)}`, 'Buyers Index'];
                    }}
                  />
                  <Scatter 
                    name="Mobility vs Purchases" 
                    data={scatterData} 
                    fill="#8884d8"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Market Mobility Metrics">
            <div className="space-y-4 p-4">
              <MetricCard
                value={recentMoversPercentage}
                label="Recent Movers Percentage"
                format="percent"
              />
              <MetricCard
                value={recentBuyersIndex}
                label="Recent Appliance Buyers Index"
                format="index"
              />
              <MetricCard
                value={housingUnits}
                label="Total Housing Units"
                format="number"
              />
              <MetricCard
                value={averageSpendingIndex}
                label="Average Spending Index"
                format="index"
              />
            </div>
          </ChartCard>
        </div>
      </div>
    );
  };

  const renderTechnologyAndEfficiencyTrends = () => {
    if (!data?.technologyTrends) return null;
    
    const technologyData = data.technologyTrends;
    const { 
      gasRangeIndex = 0, 
      electricRangeIndex = 0,
      applianceSpendingTrends = []
    } = technologyData;

    const rangeData = [
      { name: 'Gas Range', value: gasRangeIndex },
      { name: 'Electric Range', value: electricRangeIndex }
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Technology and Efficiency Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Range Technology Ownership">
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={rangeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    label={(entry: { name: string; value: number }) => `${entry.name}: ${entry.value.toFixed(1)}`}
                  >
                    {rangeData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#0088FE' : '#00C49F'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toFixed(1)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Appliance Category Spending Trends">
            <div className="h-[400px] w-full">
              <ResponsiveContainer>
                <BarChart
                  data={applianceSpendingTrends}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 100
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    label={{ 
                      value: 'Spending Index', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => value.toFixed(1)}
                  />
                  <Bar 
                    dataKey="current" 
                    name="Current Spending" 
                    fill="#8884d8"
                  />
                  <Bar 
                    dataKey="projected" 
                    name="Projected Spending" 
                    fill="#82ca9d"
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (!rawData) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No data available</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-8">
        {renderMarketOverview()}
        {renderApplianceSpendingTrends()}
        {renderDemographicInsights()}
        {renderMobilityAndPurchaseInsights()}
        {renderTechnologyAndEfficiencyTrends()}
      </div>
    );
  };

  return (
    <div className="report-content" ref={contentRef}>
      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default ApplianceMarketReport;