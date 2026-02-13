/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

interface SpatialAnalysisProps {
  view: __esri.MapView;
  layerController: React.RefObject<any>;
}

const SpatialAnalysis: React.FC<SpatialAnalysisProps> = ({ view, layerController }) => {
  const [demographicData, setDemographicData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeSelectedArea = async () => {
    if (!view || !layerController.current) return;
    
    setLoading(true);
    try {
      // Get visible demographic layers
      const demoLayers = Object.entries(layerController.current.layerStates)
        .filter(([_, state]: [string, any]) => 
          state.group === 'psychographics' && state.visible);

      const data = await Promise.all(demoLayers.map(async ([id, state]: [string, any]) => {
        const layer = state.layer;
        if (!layer) return null;

        const query = layer.createQuery();
        query.geometry = view.extent;
        query.outStatistics = [{
          statisticType: "avg",
          onStatisticField: "MP28646A_B_I",
          outStatisticFieldName: "avgIndex"
        }];

        const result = await layer.queryFeatures(query);
        return {
          category: layer.title,
          value: result.features[0].attributes.avgIndex
        };
      }));

      setDemographicData(data.filter(d => d !== null));
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view) {
      view.watch('extent', analyzeSelectedArea);
    }
  }, [view]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Area Analysis
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demographicData}>
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpatialAnalysis;