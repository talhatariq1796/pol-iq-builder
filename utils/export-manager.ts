import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from './layer-error-handler';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

export interface ExportConfig {
  format: 'csv';
  includeMetadata: boolean;
  includeGeometry: boolean;
  includeAttributes: boolean;
  includeRenderer: boolean;
  includeTimeData: boolean;
  compression: boolean;
  filename: string;
  description?: string;
}

export class ExportManager {
  private static instance: ExportManager;
  private errorHandler: LayerErrorHandler;

  private constructor() {
    this.errorHandler = LayerErrorHandler.getInstance();
  }

  public static getInstance(): ExportManager {
    if (!ExportManager.instance) {
      ExportManager.instance = new ExportManager();
    }
    return ExportManager.instance;
  }

  public async exportLayer(layer: LayerConfig, config: ExportConfig): Promise<Blob> {
    try {
      const data: any = {};

      // Include basic layer information
      data.id = layer.id;
      data.name = layer.name;
      data.type = layer.type;
      data.description = config.description || layer.description;

      // Include metadata if requested
      if (config.includeMetadata && layer.metadata) {
        data.metadata = layer.metadata;
      }

      // Include geometry if requested
      if (config.includeGeometry && layer.type !== 'index') {
        data.geometry = await this.fetchLayerGeometry(layer);
      }

      // Include attributes if requested
      if (config.includeAttributes) {
        data.attributes = await this.fetchLayerAttributes(layer);
      }

      // Include renderer if requested
      if (config.includeRenderer && layer.rendererField) {
        data.renderer = {
          field: layer.rendererField,
          type: layer.type
        };
      }

      // Include time data if requested
      if (config.includeTimeData && layer.metadata?.lastUpdate) {
        data.timeData = {
          lastUpdate: layer.metadata.lastUpdate,
          updateFrequency: layer.metadata.updateFrequency
        };
      }

      // Convert to CSV format
      const blob = await this.convertToCSV(data);

      // Apply compression if requested
      if (config.compression) {
        return await this.compressData(blob);
      }

      return blob;
    } catch (err) {
      await this.errorHandler.handleValidationError('export', err);
      throw err;
    }
  }

  private async fetchLayerGeometry(layer: LayerConfig): Promise<any> {
    // Fetch geometry based on layer type
    try {
      if (layer.id === 'precincts' || layer.name?.toLowerCase().includes('precinct')) {
        // Fetch precinct data using PoliticalDataService (single source of truth)
        const data = await politicalDataService.getPrecinctDataFileFormat();

        // Return geometry for all precincts
        const precincts = data.precincts || {};
        return Object.entries(precincts).map(([id, precinct]: [string, any]) => ({
          precinctId: id,
          precinctName: precinct.name,
          // Note: Actual geometry coordinates not available in current data structure
          // Would need to be added from GeoJSON source
          geometry: null,
          centroid: precinct.centroid || null,
        }));
      }

      // For other layer types, attempt to fetch from layer URL if available
      if (layer.id && typeof layer.id === 'string' && layer.id.startsWith('http')) {
        const response = await fetch(`${layer.id}/query?f=json&where=1=1&outFields=*&returnGeometry=true`);
        if (response.ok) {
          const data = await response.json();
          return data.features || [];
        }
      }

      return [];
    } catch (error) {
      console.error('Error fetching layer geometry:', error);
      return [];
    }
  }

  private async fetchLayerAttributes(layer: LayerConfig): Promise<any> {
    // Fetch attributes based on layer type
    try {
      if (layer.id === 'precincts' || layer.name?.toLowerCase().includes('precinct')) {
        // Fetch complete precinct data using PoliticalDataService (single source of truth)
        const data = await politicalDataService.getPrecinctDataFileFormat();

        // Return all attributes for all precincts
        const precincts = data.precincts || {};
        return Object.entries(precincts).map(([id, precinct]: [string, any]) => ({
          // Core identification
          precinctId: id,
          precinctName: precinct.name,
          jurisdiction: precinct.jurisdiction,
          jurisdictionType: precinct.jurisdictionType,

          // Demographics
          totalPopulation: precinct.demographics?.totalPopulation,
          population18up: precinct.demographics?.population18up,
          medianAge: precinct.demographics?.medianAge,
          medianHHI: precinct.demographics?.medianHHI,
          collegePct: precinct.demographics?.collegePct,
          homeownerPct: precinct.demographics?.homeownerPct,
          diversityIndex: precinct.demographics?.diversityIndex,
          populationDensity: precinct.demographics?.populationDensity,

          // Political attitudes
          demAffiliationPct: precinct.political?.demAffiliationPct,
          repAffiliationPct: precinct.political?.repAffiliationPct,
          independentPct: precinct.political?.independentPct,
          liberalPct: precinct.political?.liberalPct,
          moderatePct: precinct.political?.moderatePct,
          conservativePct: precinct.political?.conservativePct,

          // Electoral metrics
          partisanLean: precinct.electoral?.partisanLean,
          swingPotential: precinct.electoral?.swingPotential,
          competitiveness: precinct.electoral?.competitiveness,
          avgTurnout: precinct.electoral?.avgTurnout,
          turnoutDropoff: precinct.electoral?.turnoutDropoff,

          // Targeting scores
          gotvPriority: precinct.targeting?.gotvPriority,
          persuasionOpportunity: precinct.targeting?.persuasionOpportunity,
          combinedScore: precinct.targeting?.combinedScore,
          strategy: precinct.targeting?.strategy,

          // Recent election results
          election2024_demPct: precinct.elections?.['2024']?.demPct,
          election2024_repPct: precinct.elections?.['2024']?.repPct,
          election2024_margin: precinct.elections?.['2024']?.margin,
          election2024_turnout: precinct.elections?.['2024']?.turnout,
          election2024_ballotsCast: precinct.elections?.['2024']?.ballotsCast,

          election2022_demPct: precinct.elections?.['2022']?.demPct,
          election2022_repPct: precinct.elections?.['2022']?.repPct,
          election2022_margin: precinct.elections?.['2022']?.margin,
          election2022_turnout: precinct.elections?.['2022']?.turnout,
          election2022_ballotsCast: precinct.elections?.['2022']?.ballotsCast,

          election2020_demPct: precinct.elections?.['2020']?.demPct,
          election2020_repPct: precinct.elections?.['2020']?.repPct,
          election2020_margin: precinct.elections?.['2020']?.margin,
          election2020_turnout: precinct.elections?.['2020']?.turnout,
          election2020_ballotsCast: precinct.elections?.['2020']?.ballotsCast,

          // Engagement metrics
          cnnMsnbcPct: precinct.engagement?.cnnMsnbcPct,
          foxNewsmaxPct: precinct.engagement?.foxNewsmaxPct,
          nprPct: precinct.engagement?.nprPct,
          socialMediaPct: precinct.engagement?.socialMediaPct,
          politicalDonorPct: precinct.engagement?.politicalDonorPct,

          // Tapestry segmentation
          tapestryCode: precinct.tapestry?.primary?.code,
          tapestryName: precinct.tapestry?.primary?.name,
          tapestryLifeMode: precinct.tapestry?.primary?.lifeMode,
          tapestryUrbanization: precinct.tapestry?.primary?.urbanization,
          tapestryPartisanLean: precinct.tapestry?.politicalProfile?.partisanLean,
          tapestryPersuadability: precinct.tapestry?.politicalProfile?.persuadability,
          tapestryTurnoutLikelihood: precinct.tapestry?.politicalProfile?.turnoutLikelihood,
        }));
      }

      // For other layer types, attempt to fetch from layer URL if available
      if (layer.id && typeof layer.id === 'string' && layer.id.startsWith('http')) {
        const response = await fetch(`${layer.id}/query?f=json&where=1=1&outFields=*&returnGeometry=false`);
        if (response.ok) {
          const data = await response.json();
          return data.features?.map((f: any) => f.attributes) || [];
        }
      }

      return [];
    } catch (error) {
      console.error('Error fetching layer attributes:', error);
      return [];
    }
  }

  private async convertToCSV(data: any): Promise<Blob> {
    try {
      // Extract all possible fields from the data
      const fields = new Set<string>();
      const rows: any[] = [];

      // Helper function to flatten nested objects
      const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
        return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
          const prefixedKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(acc, flattenObject(obj[key], prefixedKey));
          } else if (Array.isArray(obj[key])) {
            // Convert arrays to comma-separated strings
            acc[prefixedKey] = obj[key].join('; ');
          } else {
            acc[prefixedKey] = obj[key];
          }
          return acc;
        }, {});
      };

      // Check if attributes is an array of records (from fetchLayerAttributes)
      if (data.attributes && Array.isArray(data.attributes)) {
        // Process each attribute record as a separate row
        for (const attr of data.attributes) {
          const flattenedAttr = flattenObject(attr);
          Object.keys(flattenedAttr).forEach(field => fields.add(field));
          rows.push(flattenedAttr);
        }
      } else {
        // Process the data object as a single row
        const flattenedData = flattenObject(data);
        Object.keys(flattenedData).forEach(field => fields.add(field));
        rows.push(flattenedData);
      }

      // Convert to CSV format
      const csvContent = [
        // Header row
        Array.from(fields).join(','),
        // Data rows
        ...rows.map(row =>
          Array.from(fields).map(field => {
            const value = row[field];
            // Handle different value types
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
              // Escape quotes and wrap in quotes if contains special characters
              const escaped = value.replace(/"/g, '""');
              return /[",\n\r]/.test(value) ? `"${escaped}"` : escaped;
            }
            if (value instanceof Date) return value.toISOString();
            return String(value);
          }).join(',')
        )
      ].join('\n');

      return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    } catch (err) {
      await this.errorHandler.handleValidationError('csv-conversion', err);
      throw new Error('Failed to convert data to CSV format');
    }
  }

  private async compressData(blob: Blob): Promise<Blob> {
    // TODO: Implement compression using pako or similar library
    return blob;
  }

  public async saveExportTemplate(config: ExportConfig): Promise<void> {
    try {
      const templates = JSON.parse(localStorage.getItem('exportTemplates') || '[]');
      templates.push({
        ...config,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('exportTemplates', JSON.stringify(templates));
    } catch (err) {
      await this.errorHandler.handleValidationError('export-template', err);
      throw err;
    }
  }

  public async loadExportTemplates(): Promise<ExportConfig[]> {
    try {
      return JSON.parse(localStorage.getItem('exportTemplates') || '[]');
    } catch (err) {
      await this.errorHandler.handleValidationError('export-template', err);
      throw err;
    }
  }

  public async deleteExportTemplate(templateId: string): Promise<void> {
    try {
      const templates = JSON.parse(localStorage.getItem('exportTemplates') || '[]');
      const updatedTemplates = templates.filter((t: any) => t.id !== templateId);
      localStorage.setItem('exportTemplates', JSON.stringify(updatedTemplates));
    } catch (err) {
      await this.errorHandler.handleValidationError('export-template', err);
      throw err;
    }
  }
} 