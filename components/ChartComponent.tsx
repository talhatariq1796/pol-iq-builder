import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ChartConfig } from '@/types/reports';

interface ChartComponentProps {
  data: any[];
  config: ChartConfig;
  dataKey: string;
  nameKey: string;
  height?: number | string;
}

export const ChartComponent: React.FC<ChartComponentProps> = ({
  data,
  config,
  dataKey,
  nameKey,
  height = "100%"
}) => {
  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Bar dataKey={dataKey}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={config.colors[index % config.colors.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            {config.showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={config.colors[0]}
              strokeWidth={2}
            />
          </LineChart>
        );

      case 'pie':
      case 'donut':
        return (
          <PieChart>
            <Pie
              data={data}
              nameKey={nameKey}
              dataKey={dataKey}
              innerRadius={config.type === 'donut' ? '60%' : '0'}
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={config.colors[index % config.colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            {config.showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart() || <div>No chart data available</div>}
    </ResponsiveContainer>
  );
};