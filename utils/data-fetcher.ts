import { ProjectLayerConfig as ProjectConfig, LayerConfig, LayerGroup as GroupConfig } from "../types/layers";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import * as query from "@arcgis/core/rest/query";
import Query from "@arcgis/core/rest/support/Query";
import { AnalysisResult as BaseAnalysisResult } from "@/lib/analytics/types";

// Extend the base type to include the missing property
type AnalysisResult = BaseAnalysisResult & {
  sqlWhereClause?: string;
};

export interface LayerDataOptions {
  query: string;
  spatialFilter?: any;
  limit?: number;
  targetFields?: string[]; // Add target fields for filtering
  sqlWhere?: string; // Add custom SQL where clause
  minApplications?: number; // Minimum number of applications filter
}

export interface LayerDataResult {
  layerId: string;
  layerName: string;
  layerType: string;
  features: any[];
  error?: string;
  totalFeatures?: number; // Track total before any filtering
}

export interface DataFetcherOptions {
  projectConfig: ProjectConfig;
  analysisResult: AnalysisResult;
}

export async function fetchDataForAnalysis(
  options: DataFetcherOptions
): Promise<LayerDataResult[]> {
  const { projectConfig, analysisResult } = options;
  const { relevantLayers, sqlWhereClause } = analysisResult;

  if (!relevantLayers || relevantLayers.length === 0) {
    console.warn("[DataFetcher] No relevant layers identified for analysis.");
    return [];
  }

  const allLayers: LayerConfig[] = Object.values(projectConfig.layers);
  const layersToQuery = allLayers.filter(layer => relevantLayers.includes(layer.id));

  if (layersToQuery.length === 0) {
    console.warn("[DataFetcher] No matching layers found in config for:", relevantLayers);
    return [];
  }

  const promises: Promise<LayerDataResult>[] = layersToQuery.map(async (layerConfig: LayerConfig): Promise<LayerDataResult> => {
    try {
      const layer = new FeatureLayer({
        url: layerConfig.url,
        outFields: ["*"],
      });

      const queryParams = new Query({
        where: sqlWhereClause || "1=1",
        returnGeometry: true,
        outSpatialReference: { wkid: 4326 }, // Ensure WGS84 for consistency
      });

      const featureSet = await layer.queryFeatures(queryParams);

      return {
        layerId: layerConfig.id,
        features: featureSet.features,
        layerName: layerConfig.name,
        layerType: layerConfig.type || 'feature',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[DataFetcher] Failed to fetch data for layer ${layerConfig.id}:`,
        errorMessage
      );
      return {
        layerId: layerConfig.id,
        features: [],
        error: errorMessage,
        layerName: layerConfig.name || 'Unknown',
        layerType: layerConfig.type || 'unknown',
      };
    }
  });

  return Promise.all(promises);
} 