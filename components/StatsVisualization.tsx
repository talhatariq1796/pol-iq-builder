import { BarChart, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer, LineChart, Line } from "recharts";

interface StatsProps {
  data: __esri.Graphic[];
  statistics: Record<string, number>;
  analysisType?: 'standard' | 'competition' | 'market';
  enlarged?: boolean;
}

export default function StatsVisualization({ 
  data = [], 
  statistics = {}, 
  analysisType = 'standard',
  enlarged = false 
}: StatsProps) {
  
  // Competition Analysis View
  if (analysisType === 'competition') {
    const { competitors = 0, averageDistance = 0, marketShare = 0 } = statistics;
    
    return (
      <div className={`space-y-4 p-4 bg-white rounded-lg shadow ${enlarged ? 'w-[800px]' : 'w-full'}`}>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard 
            title="Competitors" 
            value={competitors.toString()} 
          />
          <MetricCard 
            title="Avg Distance" 
            value={`${(averageDistance/1000).toFixed(1)}km`}
          />
          <MetricCard 
            title="Market Share" 
            value={`${marketShare.toFixed(1)}%`}
          />
        </div>
        
        <div className={`w-full ${enlarged ? 'h-[400px]' : 'h-[250px]'}`}>
          <ResponsiveContainer>
            <BarChart data={[{ competitors, averageDistance, marketShare }]}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="competitors" fill="#33a852" name="Competitors" />
              <Bar dataKey="marketShare" fill="#82ca9d" name="Market Share %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Market Analysis View
  if (analysisType === 'market') {
    const { spendingPower = 0, penetrationRate = 0 } = statistics;
    
    return (
      <div className={`space-y-4 p-4 bg-white rounded-lg shadow ${enlarged ? 'w-[800px]' : 'w-full'}`}>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard 
            title="Spending Power" 
            value={`$${(spendingPower/1000).toFixed(1)}K`}
          />
          <MetricCard 
            title="Penetration Rate" 
            value={`${penetrationRate.toFixed(1)}%`}
          />
        </div>
        
        <div className={`w-full ${enlarged ? 'h-[400px]' : 'h-[250px]'}`}>
          <ResponsiveContainer>
            <LineChart data={data.map(d => ({
              name: d.attributes.name,
              spending: d.attributes.spending,
              penetration: d.attributes.penetration
            }))}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="spending" stroke="#33a852" />
              <Line type="monotone" dataKey="penetration" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Standard Statistics View
  const avgValue = statistics.avg ?? statistics.MEAN ?? statistics.mean ?? statistics.avg_value ?? 0;
  const maxValue = statistics.max ?? statistics.MAX ?? statistics.max_value ?? 0;
  const minValue = statistics.min ?? statistics.MIN ?? statistics.min_value ?? 0;

  const chartData = data
    .filter(feature => feature?.attributes)
    .map(feature => ({
      name: feature.attributes.admin4_name || feature.attributes.name || 'Unknown',
      value: parseFloat(feature.attributes.thematic_value) || 0
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return <div className="p-4 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className={`space-y-4 p-4 bg-white rounded-lg shadow ${enlarged ? 'w-[800px]' : 'w-full'}`}>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard 
          title="Average" 
          value={`${avgValue.toFixed(1)}%`}
        />
        <MetricCard 
          title="Highest" 
          value={`${maxValue.toFixed(1)}%`}
          textColor="text-green-600"
        />
        <MetricCard 
          title="Lowest" 
          value={`${minValue.toFixed(1)}%`}
          textColor="text-red-600"
        />
      </div>

      <div className={`w-full ${enlarged ? 'h-[400px]' : 'h-[250px]'}`}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 40,
              bottom: enlarged ? 80 : 50
            }}
          >
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: enlarged ? 14 : 12, fill: '#666' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={enlarged ? 100 : 60}
            />
            <YAxis 
              tick={{ fontSize: enlarged ? 14 : 12, fill: '#666' }}
              domain={[0, Math.ceil(Math.max(...chartData.map(d => d.value)) * 1.1)]}
              tickFormatter={(value: any) => `${value.toFixed(0)}%`}
            />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Value']}
              contentStyle={{
                fontSize: enlarged ? 14 : 12,
                padding: '8px 12px'
              }}
            />
            <Bar
              dataKey="value"
              fill="#33a852"
              radius={[4, 4, 0, 0]}
              maxBarSize={enlarged ? 50 : 35}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  textColor?: string;
}

function MetricCard({ title, value, textColor = 'text-gray-900' }: MetricCardProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-xl font-bold ${textColor}`}>{value}</div>
    </div>
  );
}