import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

interface Feature {
  attributes: {
    ZIP_CODE?: string;
    ZIP?: string;
    DESCRIPTION?: string;
    [key: string]: any;
  };
}

const EmptyDataMessage = ({ message }: { message: string }) => (
  <div className="bg-white rounded-lg p-4 text-center">
    <p className="text-gray-500 text-xs">{message}</p>
  </div>
);

export const PopupContent: React.FC<{ feature: Feature }> = ({ feature }) => {
  const { attributes } = feature;
  
  const getValue = (key: string): number => {
    const fullKey = `sum_USER_${key}`;
    const value = attributes[fullKey];
    if (value === null || value === undefined) return 0;
    return typeof value === 'number' ? value : Number(value) || 0;
  };

  // Fuel type distribution with all possible fuel types
  const fuelData = [
    { name: 'Gasoline', value: getValue('Gasoline') },
    { name: 'Hybrid', value: getValue('Hybrid_Gasoline') },
    { name: 'Plug-in Hybrid', value: getValue('Plug_in_Hybrid') },
    { name: 'Electric', value: getValue('Battery_Electric') },
    { name: 'Diesel', value: getValue('Diesel_and_Diesel_Hybr') },
    { name: 'Flex Fuel', value: getValue('Flex_Fuel') },
    { name: 'Hydrogen', value: getValue('Hydrogen_Fuel_Cell') },
    { name: 'Natural Gas', value: getValue('Natural_Gas') },
    { name: 'Other', value: getValue('Other') },
    { name: 'Unknown', value: getValue('FuelUnk') }
  ].filter(item => item.value > 0);

  // Vehicle makes data
  const allMakeData = [
    { name: 'Acura', value: getValue('ACURA') },
    { name: 'Alfa Romeo', value: getValue('ALFA_ROMEO') },
    { name: 'Audi', value: getValue('AUDI') },
    { name: 'BMW', value: getValue('BMW') },
    { name: 'Cadillac', value: getValue('CADILLAC') },
    { name: 'Genesis', value: getValue('GENESIS') },
    { name: 'Jaguar', value: getValue('JAGUAR') },
    { name: 'Lexus', value: getValue('LEXUS') },
    { name: 'Lincoln', value: getValue('LINCOLN') },
    { name: 'Mercedes', value: getValue('MERCEDES_BENZ') },
    { name: 'Polestar', value: getValue('POLESTAR') },
    { name: 'Porsche', value: getValue('PORSCHE') },
    { name: 'Rivian', value: getValue('RIVIAN') },
    { name: 'Tesla', value: getValue('TESLA') },
    { name: 'Volvo', value: getValue('VOLVO') }
  ].filter(item => item.value > 0);

  // Sort by value and take top 5 for the chart
  const makeData = [...allMakeData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Model year data
  const yearData = [
    { year: '<2010', count: getValue('MY_2010') },
    { year: '2010-2015', count: (
      getValue('MY2010') +
      getValue('MY2011') +
      getValue('MY2012') +
      getValue('MY2013') +
      getValue('MY2014') +
      getValue('MY2015')
    ) },
    { year: '2016-2020', count: (
      getValue('MY2016') +
      getValue('MY2017') +
      getValue('MY2018') +
      getValue('MY2019') +
      getValue('MY2020')
    ) },
    { year: '2021-2024', count: (
      getValue('MY2021') +
      getValue('MY2022') +
      getValue('MY2023') +
      getValue('MY2024')
    ) },
    { year: 'Unknown', count: getValue('MYUnk') }
  ].filter(item => item.count > 0);

  // Organize data for the table
  const tableData = {
    'Fuel Types': fuelData.map(item => ({
      field: item.name,
      value: item.value
    })).sort((a, b) => a.field.localeCompare(b.field)),
    
    'Luxury Makes': allMakeData.map(item => ({
      field: item.name,
      value: item.value
    })).sort((a, b) => b.value - a.value),
    
    'Model Years': yearData.map(item => ({
      field: item.year,
      value: item.count
    }))
  };

  if (!attributes || Object.keys(attributes).length === 0) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Unable to load vehicle data for this location.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>ZIP Code: {attributes.DESCRIPTION || attributes.ZIP_CODE || attributes.ZIP}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {fuelData.length > 0 ? (
              <div className="bg-white rounded-lg p-2">
                <h3 className="text-xs font-semibold mb-2">Fuel Type Distribution</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fuelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {fuelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyDataMessage message="No fuel type data available for this area" />
            )}

            <div className="bg-white rounded-lg p-2">
              <h3 className="text-xs font-semibold mb-2">Top 5 Luxury Vehicle Makes</h3>
              {makeData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={makeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={70} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyDataMessage message="No luxury vehicles found in this area" />
              )}
            </div>

            {yearData.length > 0 ? (
              <div className="bg-white rounded-lg p-2">
                <h3 className="text-xs font-semibold mb-2">Vehicle Age Distribution</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyDataMessage message="No vehicle age data available for this area" />
            )}

            <div className="bg-white rounded-lg p-2">
              <h3 className="text-xs font-semibold mb-2">Summary Data</h3>
              <div className="overflow-x-auto">
                {Object.entries(tableData).some(([_, items]) => items.length > 0) ? (
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(tableData).map(([category, items]) => {
                        if (items.length === 0) return null;
                        return (
                          <React.Fragment key={category}>
                            <tr className="bg-gray-100">
                              <th className="text-left p-2 font-semibold" colSpan={2}>
                                {category}
                              </th>
                            </tr>
                            {items.map((item, index) => (
                              <tr key={`${category}-${index}`} className="border-t">
                                <td className="p-2">{item.field}</td>
                                <td className="p-2 text-right">{item.value.toLocaleString()}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <EmptyDataMessage message="No summary data available for this area" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PopupContent;
export type { Feature };