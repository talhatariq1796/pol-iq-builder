import React from 'react';
import { ResponsiveContainer, BarChart, LineChart, PieChart, XAxis, YAxis, 
         CartesianGrid, Tooltip, Legend, Bar, Line, Pie } from 'recharts';

// Define proper types
interface Axis {
  title?: string;
  type?: 'category' | 'value';
}

interface ExtendedVisualizationConfig {
  title?: string;
  description?: string;
  metrics?: any[];
  axes?: {
    x?: Axis;
    y?: Axis;
  };
  colors?: string[];
  tooltips?: boolean;
  animations?: boolean;
}

interface ChartProps {
  data: Array<{
    category: string;
    values: Record<string, number>;
  }>;
  config: ExtendedVisualizationConfig;
}

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

export const RenderDistributionChart: React.FC<ChartProps> = ({ data, config }) => {
  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="category"
            label={{ value: config.axes?.x?.title, position: 'bottom' }}
          />
          <YAxis
            label={{ value: config.axes?.y?.title, angle: -90, position: 'left' }}
          />
          <Tooltip />
          <Legend />
          <Bar 
            dataKey="values.value" 
            fill="#33a852"
            name={config.title || 'Value'}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RenderTrendChart: React.FC<ChartProps> = ({ data, config }) => {
  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="category"
            label={{ value: config.axes?.x?.title, position: 'bottom' }}
          />
          <YAxis
            label={{ value: config.axes?.y?.title, angle: -90, position: 'left' }}
          />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="values.value" 
            stroke="#33a852"
            name={config.title || 'Trend'}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RenderComparisonChart: React.FC<ChartProps> = ({ data, config }) => {
  const processedData = data.map(item => ({
    name: item.category,
    value: item.values.value
  }));

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={processedData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={150}
            fill="#33a852"
            label={(entry: { name: string }) => entry.name}
          />
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RenderTimeseriesChart: React.FC<ChartProps> = ({ data, config }) => {
  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="category"
            label={{ value: config.axes?.x?.title, position: 'bottom' }}
          />
          <YAxis
            label={{ value: config.axes?.y?.title, angle: -90, position: 'left' }}
          />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="values.value" 
            stroke="#33a852"
            name={config.title || 'Time Series'}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Fixed error boundary with proper types
export class ChartErrorBoundary extends React.Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-64 flex items-center justify-center bg-red-50 rounded-lg">
          <div className="text-center text-red-600">
            <p className="font-semibold">Unable to render chart</p>
            <p className="text-sm mt-2">Please try refreshing the page</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}