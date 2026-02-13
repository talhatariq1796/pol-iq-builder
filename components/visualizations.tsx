import React from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<{
    category: string;
    value: number;
  }>;
  title?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
  return (
    <div className="bar-chart-container">
      {title && <h3>{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Additional visualization components can be added here
export const PieChart = () => {
  // Placeholder for pie chart implementation
  return null;
};

export const LineChart = () => {
  // Placeholder for line chart implementation
  return null;
};