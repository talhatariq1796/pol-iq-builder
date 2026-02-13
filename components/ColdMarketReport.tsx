import React, { useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';

const ReferenceLine = (require('recharts') as { ReferenceLine: React.ComponentType<any> }).ReferenceLine;
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ColdData } from '@/types/fitness';

interface FitnessMarketReportProps {
  view: __esri.MapView;
  data: ColdData | null;
  loading?: boolean;
  error?: string | null;
  reportTemplate: string;
  onReportTemplateChange: (template: string) => void;
}

const MetricCard = ({ value, label }: { value: number; label: string }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border">
    <div className="text-2xl font-bold">{value.toFixed(0)}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </div>
);

const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <Card className={`shadow-sm h-full overflow-hidden mb-6 ${className}`}>
    <CardHeader className="pb-2">
      <CardTitle className="text-lg font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const FitnessMarketReport: React.FC<FitnessMarketReportProps> = ({
  data,
  loading = false,
  error = null,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

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

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No data available</AlertDescription>
      </Alert>
    );
  }

  const renderSpendingAnalysis = () => {
    const spendingData = Object.entries(data.spendingTrends).map(([category, current]) => ({
      name: category,
      index: current
    }));

    const COLORS = {
      'Sports Equipment': '#8884d8',
      'Workout Wear': '#82ca9d',
      'Fitness Apparel': '#ffc658'
    };

    return (
      <ChartCard title="Fitness Spending Index">
        <div className="h-[300px] w-full min-w-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendingData} margin={{ top: 20, right: 60, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis 
                label={{ value: 'Index Value', angle: -90, position: 'insideLeft' }}
                domain={[0, 200]}
              />
              <Tooltip />
              <ReferenceLine 
                y={100} 
                stroke="#666" 
                strokeDasharray="3 3"
                label={{ 
                  value: "Nat. Avg.", 
                  position: 'right',
                  fill: '#666',
                  offset: 10,
                  fontSize: 11
                }}
              />
              <Bar dataKey="index">
                {spendingData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  };

  const renderPsychographics = () => {
    const psychoData = [
      { name: 'Exercise Daily', index: data.psychographics.exerciseDaily },
      { name: 'More Fit/Active', index: data.psychographics.moreFitActive }
    ];

    const COLORS = {
      'Exercise Daily': '#00C49F',
      'More Fit/Active': '#0088FE'
    };

    return (
      <ChartCard title="Fitness Psychographics Index">
        <div className="h-[300px] w-full min-w-[200px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={psychoData} margin={{ top: 20, right: 60, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis 
                label={{ value: 'Index Value', angle: -90, position: 'insideLeft' }}
                domain={[0, 200]}
              />
              <Tooltip />
              <ReferenceLine 
                y={100} 
                stroke="#666" 
                strokeDasharray="3 3"
                label={{ 
                  value: "Nat. Avg.", 
                  position: 'right',
                  fill: '#666',
                  offset: 10,
                  fontSize: 11
                }}
              />
              <Bar dataKey="index">
                {psychoData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  };

  const renderBusinessAnalysis = () => {
    if (!data.businesses) return null;

    return (
      <ChartCard title="Business Analysis">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            value={data.businesses.spas}
            label="Spa Locations"
          />
          <MetricCard
            value={data.businesses.gyms}
            label="Gym Locations"
          />
        </div>
      </ChartCard>
    );
  };

  return (
    <div 
      className="report-content h-full overflow-y-scroll [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100" 
      ref={contentRef}
    >
      <div className="p-6 space-y-6">
        {renderSpendingAnalysis()}
        {renderPsychographics()}
        {renderBusinessAnalysis()}
      </div>
    </div>
  );
};

export default FitnessMarketReport;