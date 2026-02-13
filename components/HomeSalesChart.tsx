import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Data structure for sales data
interface SalesData {
  quarter: string;
  'Miami-Dade County, FL': number;
  'Hillsborough County, FL': number;
  'Florida': number;
  'Florida Sales': number;
}

const salesData: SalesData[] = [
  { quarter: 'Q1 2019', 'Miami-Dade County, FL': -272, 'Hillsborough County, FL': -56, 'Florida': -5424, 'Florida Sales': -3.7 },
  { quarter: 'Q2 2019', 'Miami-Dade County, FL': 1342, 'Hillsborough County, FL': 1385, 'Florida': 13474, 'Florida Sales': 1.3 },
  { quarter: 'Q3 2019', 'Miami-Dade County, FL': 715, 'Hillsborough County, FL': 452, 'Florida': 7411, 'Florida Sales': 5.2 },
  { quarter: 'Q4 2019', 'Miami-Dade County, FL': -219, 'Hillsborough County, FL': 700, 'Florida': 1041, 'Florida Sales': 4.1 },
  { quarter: 'Q1 2020', 'Miami-Dade County, FL': 592, 'Hillsborough County, FL': 783, 'Florida': 1951, 'Florida Sales': -9.1 },
  { quarter: 'Q2 2020', 'Miami-Dade County, FL': 1221, 'Hillsborough County, FL': 2490, 'Florida': 14125, 'Florida Sales': -84.0 },
  { quarter: 'Q3 2020', 'Miami-Dade County, FL': 1366, 'Hillsborough County, FL': 2008, 'Florida': 19533, 'Florida Sales': 6.4 },
  { quarter: 'Q4 2020', 'Miami-Dade County, FL': 654, 'Hillsborough County, FL': 725, 'Florida': 8590, 'Florida Sales': -2.3 },
  { quarter: 'Q1 2021', 'Miami-Dade County, FL': 3650, 'Hillsborough County, FL': 3130, 'Florida': 30520, 'Florida Sales': 68.8 },
  { quarter: 'Q2 2021', 'Miami-Dade County, FL': 2766, 'Hillsborough County, FL': -134, 'Florida': 8462, 'Florida Sales': 268.2 },
  { quarter: 'Q3 2021', 'Miami-Dade County, FL': 96, 'Hillsborough County, FL': -751, 'Florida': -5314, 'Florida Sales': 37.3 },
  { quarter: 'Q4 2021', 'Miami-Dade County, FL': 1685, 'Hillsborough County, FL': 743, 'Florida': 7841, 'Florida Sales': 40.8 },
  { quarter: 'Q1 2022', 'Miami-Dade County, FL': 2515, 'Hillsborough County, FL': 986, 'Florida': 9649, 'Florida Sales': 17.8 },
  { quarter: 'Q2 2022', 'Miami-Dade County, FL': -1339, 'Hillsborough County, FL': -3190, 'Florida': -22586, 'Florida Sales': 15.4 },
  { quarter: 'Q3 2022', 'Miami-Dade County, FL': -1926, 'Hillsborough County, FL': -3810, 'Florida': -23590, 'Florida Sales': 1.4 },
  { quarter: 'Q4 2022', 'Miami-Dade County, FL': -1152, 'Hillsborough County, FL': -850, 'Florida': -7674, 'Florida Sales': 0.4 },
  { quarter: 'Q1 2023', 'Miami-Dade County, FL': 1082, 'Hillsborough County, FL': 2078, 'Florida': 5521, 'Florida Sales': 15.4 },
  { quarter: 'Q2 2023', 'Miami-Dade County, FL': 818, 'Hillsborough County, FL': 670, 'Florida': 2305, 'Florida Sales': -6.1 },
  { quarter: 'Q3 2023', 'Miami-Dade County, FL': -670, 'Hillsborough County, FL': -1388, 'Florida': -9046, 'Florida Sales': 4.1 },
  { quarter: 'Q4 2023', 'Miami-Dade County, FL': -2120, 'Hillsborough County, FL': -2833, 'Florida': -22767, 'Florida Sales': -11.0 },
  { quarter: 'Q1 2024', 'Miami-Dade County, FL': -1202, 'Hillsborough County, FL': -1611, 'Florida': -18391, 'Florida Sales': -34.9 },
  { quarter: 'Q2 2024', 'Miami-Dade County, FL': -473, 'Hillsborough County, FL': -1778, 'Florida': -8134, 'Florida Sales': -25.2 },
  { quarter: 'Q3 2024', 'Miami-Dade County, FL': -1564, 'Hillsborough County, FL': -857, 'Florida': -4292, 'Florida Sales': -11.8 }
];

interface HomeSalesChartProps {
    county: 'Miami-Dade County, FL' | 'Hillsborough County, FL';
  }

  const HomeSalesChart: React.FC<HomeSalesChartProps> = ({ county }) => {
    return (
      <div className="w-full max-w-full space-y-4">
        <h3 className="text-sm font-medium">Home Sales Trends</h3>
        <div style={{ width: '260px', height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={salesData}
              margin={{ top: 5, right: 5, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="quarter" 
                angle={-45}
                textAnchor="end"
                height={60}
                interval={3}
                tick={{ fontSize: 8 }}
              />
              <YAxis tick={{ fontSize: 8 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line
                type="monotone"
                dataKey={county}
                stroke="#8884d8"
                name="County Sales"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Florida"
                stroke="#82ca9d"
                name="Florida Total"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-sm text-gray-600">
          <p>Quarterly home sales data comparing {county} with overall Florida trends.</p>
        </div>
      </div>
    );
  };

export default HomeSalesChart;