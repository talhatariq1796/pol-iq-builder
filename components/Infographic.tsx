/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import esriConfig from '@arcgis/core/config';
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import * as projection from "@arcgis/core/geometry/projection";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  geometry: __esri.Geometry;
  apiKey: string;
}

const Infographic: React.FC<Props> = ({ geometry, apiKey }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichData, setEnrichData] = useState<any>(null);
  
  useEffect(() => {
    if (!geometry || !apiKey) {
      setError('Missing required parameters');
      return;
    }

    const generateInfographic = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Configure ArcGIS settings
        esriConfig.apiKey = apiKey;

        // Load projection engine if not loaded
        if (!projection.isLoaded()) {
          await projection.load();
        }

        // Convert geometry to polygon if needed
        let polygonGeometry: __esri.Polygon;

        if (geometry.type === "polygon") {
          polygonGeometry = geometry as __esri.Polygon;
        } else if (geometry.type === "point" || geometry.type === "polyline") {
          polygonGeometry = geometryEngine.buffer(
            geometry as __esri.Point | __esri.Polyline,
            1,
            "miles"
          ) as __esri.Polygon;
        } else {
          throw new Error("Unsupported geometry type");
        }

        // Validate polygon geometry
        if (!polygonGeometry.rings || polygonGeometry.rings.length === 0) {
          throw new Error("Invalid polygon geometry");
        }

        // Project geometry to WGS84 if needed
        if (polygonGeometry.spatialReference.wkid !== 4326) {
          const wgs84SR = new SpatialReference({ wkid: 4326 });
          polygonGeometry = projection.project(
            polygonGeometry,
            wgs84SR
          ) as __esri.Polygon;
        }

        const studyArea = {
          geometry: {
            rings: polygonGeometry.rings,
            spatialReference: { wkid: 4326 },
            type: "polygon"
          }
        };

        const params = new URLSearchParams({
          f: 'json',
          studyAreas: JSON.stringify([studyArea]),
          analysisVariables: JSON.stringify([
            "KeyGlobalFacts.TOTPOP",
            "KeyGlobalFacts.TOTHH",
            "KeyGlobalFacts.AVGHHSZ"
          ]),
          returnGeometry: 'false',
          token: apiKey
        });

        const response = await fetch('/api/geoenrich/enrich', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'Server error occurred');
        }

        // Extract the attributes from the correct path in the response
        const attributes = data.results?.[0]?.value?.FeatureSet?.[0]?.features?.[0]?.attributes;

        if (!attributes) {
          throw new Error('No enrichment data available for this area');
        }

        setEnrichData(attributes);

      } catch (err) {
        console.error('Error generating infographic:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate infographic');
      } finally {
        setIsLoading(false);
      }
    };

    generateInfographic();
  }, [geometry, apiKey]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 text-red-500 p-4 rounded-lg max-w-md text-center">
          <p className="font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!enrichData) {
    return null;
  }

  return (
    <Card className="w-full h-full overflow-auto">
      <CardContent className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Area Demographics Report</h1>
        <div className="grid gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Total Population</h2>
            <p className="text-3xl font-bold text-blue-600">
              {enrichData.TOTPOP?.toLocaleString() || 'N/A'}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Total Households</h2>
            <p className="text-3xl font-bold text-green-600">
              {enrichData.TOTHH?.toLocaleString() || 'N/A'}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Average Household Size</h2>
            <p className="text-3xl font-bold text-purple-600">
              {enrichData.AVGHHSZ?.toFixed(2) || 'N/A'}
            </p>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-6 text-center">
          Data provided by ArcGIS Geoenrichment Service
        </p>
      </CardContent>
    </Card>
  );
};

export default Infographic;