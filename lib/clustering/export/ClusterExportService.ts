/**
 * Cluster Export Service
 * 
 * Provides comprehensive export functionality for clustering results,
 * including territory-level data, campaign planning sheets, and GIS formats.
 */

import { ClusterResult, ClusteringResult, ClusterConfig } from '../types';

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'geojson' | 'pdf';
  includeIndividualZipCodes?: boolean;
  includeCampaignRecommendations?: boolean;
  includeGeography?: boolean;
  customFields?: string[];
  templateType?: 'summary' | 'detailed' | 'campaign-planning' | 'gis';
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  data?: any;
  error?: string;
}

/**
 * Main export service for clustering results
 */
export class ClusterExportService {
  private static instance: ClusterExportService | null = null;

  private constructor() {}

  public static getInstance(): ClusterExportService {
    if (!ClusterExportService.instance) {
      ClusterExportService.instance = new ClusterExportService();
    }
    return ClusterExportService.instance;
  }

  /**
   * Export all territories
   */
  public async exportAllTerritories(
    clusteringResult: ClusteringResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const data = this.prepareExportData(clusteringResult, options);
      
      switch (options.format) {
        case 'csv':
          return this.exportAsCSV(data, 'all-territories', options);
        case 'xlsx':
          return this.exportAsExcel(data, 'all-territories', options);
        case 'json':
          return this.exportAsJSON(data, 'all-territories');
        case 'geojson':
          return this.exportAsGeoJSON(clusteringResult.clusters, 'all-territories');
        case 'pdf':
          return this.exportAsPDF(data, clusteringResult, 'all-territories', options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Export single territory
   */
  public async exportSingleTerritory(
    cluster: ClusterResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const data = this.prepareSingleClusterData(cluster, options);
      const fileName = this.sanitizeFileName(cluster.name);
      
      switch (options.format) {
        case 'csv':
          return this.exportAsCSV([data], fileName, options);
        case 'xlsx':
          return this.exportAsExcel([data], fileName, options);
        case 'json':
          return this.exportAsJSON(data, fileName);
        case 'geojson':
          return this.exportAsGeoJSON([cluster], fileName);
        case 'pdf':
          return this.exportSingleTerritoryPDF(cluster, fileName, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Export comparison between territories
   */
  public async exportTerritoryComparison(
    clusters: ClusterResult[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const comparisonData = this.prepareComparisonData(clusters, options);
      const fileName = `territory-comparison-${clusters.length}-territories`;
      
      switch (options.format) {
        case 'csv':
          return this.exportAsCSV(comparisonData, fileName, options);
        case 'xlsx':
          return this.exportComparisonExcel(comparisonData, clusters, fileName, options);
        case 'json':
          return this.exportAsJSON(comparisonData, fileName);
        case 'pdf':
          return this.exportComparisonPDF(comparisonData, clusters, fileName, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Prepare export data from clustering result
   */
  private prepareExportData(
    clusteringResult: ClusteringResult,
    options: ExportOptions
  ): any[] {
    return clusteringResult.clusters.map(cluster => 
      this.prepareSingleClusterData(cluster, options)
    );
  }

  /**
   * Prepare data for a single cluster
   */
  private prepareSingleClusterData(
    cluster: ClusterResult,
    options: ExportOptions
  ): any {
    const baseData = {
      territory_id: cluster.clusterId,
      territory_name: cluster.name,
      zip_code_count: cluster.zipCodes.length,
      total_population: cluster.totalPopulation,
      average_score: cluster.averageScore,
      score_range_min: cluster.scoreRange[0],
      score_range_max: cluster.scoreRange[1],
      radius_miles: cluster.radiusMiles,
      is_valid: cluster.isValid,
      key_insights: cluster.keyInsights,
      validation_issues: cluster.validationIssues.join('; ')
    };

    // Add geography data if requested
    if (options.includeGeography) {
      Object.assign(baseData, {
        centroid_longitude: cluster.centroid[0],
        centroid_latitude: cluster.centroid[1],
        boundary_coordinates: JSON.stringify(cluster.boundary.coordinates)
      });
    }

    // Add individual zip codes if requested
    if (options.includeIndividualZipCodes) {
      Object.assign(baseData, {
        zip_codes: cluster.zipCodes.join(', '),
        zip_code_list: cluster.zipCodes
      });
    }

    // Add campaign recommendations if requested
    if (options.includeCampaignRecommendations) {
      const recommendations = this.generateCampaignRecommendations(cluster);
      Object.assign(baseData, {
        recommended_budget_range: recommendations.budgetRange,
        primary_channels: recommendations.primaryChannels.join(', '),
        campaign_type: recommendations.campaignType,
        target_demographics: recommendations.targetDemographics,
        media_recommendations: recommendations.mediaRecommendations.join('; ')
      });
    }

    // Add custom fields if specified
    if (options.customFields) {
      options.customFields.forEach(field => {
        // This would be extended to include custom field extraction logic
        (baseData as any)[field] = cluster[field as keyof ClusterResult] || '';
      });
    }

    return baseData;
  }

  /**
   * Prepare comparison data
   */
  private prepareComparisonData(
    clusters: ClusterResult[],
    options: ExportOptions
  ): any[] {
    const data = clusters.map(cluster => this.prepareSingleClusterData(cluster, options));
    
    // Add ranking information
    const sortedByScore = [...data].sort((a, b) => b.average_score - a.average_score);
    const sortedByPopulation = [...data].sort((a, b) => b.total_population - a.total_population);
    const sortedBySize = [...data].sort((a, b) => b.zip_code_count - a.zip_code_count);

    data.forEach(item => {
      item.score_rank = sortedByScore.findIndex(d => d.territory_id === item.territory_id) + 1;
      item.population_rank = sortedByPopulation.findIndex(d => d.territory_id === item.territory_id) + 1;
      item.size_rank = sortedBySize.findIndex(d => d.territory_id === item.territory_id) + 1;
    });

    return data;
  }

  /**
   * Export as CSV
   */
  private async exportAsCSV(
    data: any[],
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.csv`,
      data: csvContent
    };
  }

  /**
   * Export as Excel (simplified - would use a library like xlsx in production)
   */
  private async exportAsExcel(
    data: any[],
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // In a real implementation, you would use a library like xlsx or exceljs
    // For now, we'll return CSV format as a fallback
    console.warn('Excel export not fully implemented, falling back to CSV');
    const result = await this.exportAsCSV(data, fileName, options);
    return {
      ...result,
      fileName: `${fileName}.xlsx`
    };
  }

  /**
   * Export as JSON
   */
  private async exportAsJSON(
    data: any,
    fileName: string
  ): Promise<ExportResult> {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.json`,
      data: jsonContent
    };
  }

  /**
   * Export as GeoJSON
   */
  private async exportAsGeoJSON(
    clusters: ClusterResult[],
    fileName: string
  ): Promise<ExportResult> {
    const geoJson = {
      type: 'FeatureCollection',
      features: clusters.map(cluster => ({
        type: 'Feature',
        properties: {
          territory_id: cluster.clusterId,
          territory_name: cluster.name,
          zip_code_count: cluster.zipCodes.length,
          total_population: cluster.totalPopulation,
          average_score: cluster.averageScore,
          radius_miles: cluster.radiusMiles,
          is_valid: cluster.isValid,
          key_insights: cluster.keyInsights,
          zip_codes: cluster.zipCodes.join(', ')
        },
        geometry: cluster.boundary
      }))
    };

    const geoJsonContent = JSON.stringify(geoJson, null, 2);
    const blob = new Blob([geoJsonContent], { type: 'application/geo+json;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.geojson`,
      data: geoJsonContent
    };
  }

  /**
   * Export as PDF (simplified implementation)
   */
  private async exportAsPDF(
    data: any[],
    clusteringResult: ClusteringResult,
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // In a real implementation, you would use a library like jsPDF or Puppeteer
    // For now, we'll create a simple HTML report and suggest printing to PDF
    const htmlContent = this.generateHTMLReport(data, clusteringResult, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.html`,
      data: htmlContent
    };
  }

  /**
   * Export single territory as PDF
   */
  private async exportSingleTerritoryPDF(
    cluster: ClusterResult,
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const htmlContent = this.generateSingleTerritoryHTML(cluster, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.html`,
      data: htmlContent
    };
  }

  /**
   * Export comparison as Excel with multiple sheets
   */
  private async exportComparisonExcel(
    data: any[],
    clusters: ClusterResult[],
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Would create multiple sheets: Summary, Detailed Comparison, Rankings
    return this.exportAsCSV(data, fileName, options);
  }

  /**
   * Export comparison as PDF
   */
  private async exportComparisonPDF(
    data: any[],
    clusters: ClusterResult[],
    fileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const htmlContent = this.generateComparisonHTML(data, clusters, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);

    return {
      success: true,
      downloadUrl,
      fileName: `${fileName}.html`,
      data: htmlContent
    };
  }

  /**
   * Generate campaign recommendations for a cluster
   */
  private generateCampaignRecommendations(cluster: ClusterResult) {
    const population = cluster.totalPopulation;
    const score = cluster.averageScore;
    const radius = cluster.radiusMiles;

    // Budget recommendations based on population and score
    let budgetRange = '';
    if (population >= 200000 && score >= 7) {
      budgetRange = '$100K - $500K';
    } else if (population >= 100000 && score >= 5) {
      budgetRange = '$50K - $200K';
    } else if (population >= 50000) {
      budgetRange = '$25K - $100K';
    } else {
      budgetRange = '$10K - $50K';
    }

    // Channel recommendations based on geography and demographics
    const primaryChannels = [];
    if (radius <= 25) {
      primaryChannels.push('Local Radio', 'Community Events', 'Local Digital');
    } else if (radius <= 50) {
      primaryChannels.push('Regional TV', 'Digital Display', 'Social Media');
    } else {
      primaryChannels.push('Broadcast TV', 'Digital Video', 'Programmatic');
    }

    // Campaign type based on score
    let campaignType = '';
    if (score >= 7) {
      campaignType = 'Conversion-focused';
    } else if (score >= 5) {
      campaignType = 'Consideration-building';
    } else {
      campaignType = 'Awareness-building';
    }

    return {
      budgetRange,
      primaryChannels,
      campaignType,
      targetDemographics: cluster.keyInsights,
      mediaRecommendations: [
        `Optimal reach: ${Math.round(population * 0.6).toLocaleString()} people`,
        `Frequency cap: 3-5 impressions per person`,
        `Campaign duration: ${score >= 6 ? '4-6 weeks' : '6-8 weeks'}`
      ]
    };
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(
    data: any[],
    clusteringResult: ClusteringResult,
    options: ExportOptions
  ): string {
    const date = new Date().toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Territory Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .summary { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; }
        .territory { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; }
        .metrics { display: flex; justify-content: space-between; margin: 10px 0; }
        .metric { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Territory Analysis Report</h1>
        <p>Generated on ${date}</p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metrics">
            <div class="metric">
                <strong>${clusteringResult.clusters.length}</strong><br>
                Total Territories
            </div>
            <div class="metric">
                <strong>${clusteringResult.clusteredZipCodes}</strong><br>
                Zip Codes Clustered
            </div>
            <div class="metric">
                <strong>${data.reduce((sum, d) => sum + d.total_population, 0).toLocaleString()}</strong><br>
                Total Population
            </div>
            <div class="metric">
                <strong>${(data.reduce((sum, d) => sum + d.average_score, 0) / data.length).toFixed(1)}</strong><br>
                Average Score
            </div>
        </div>
    </div>

    ${data.map((territory, index) => `
    <div class="territory">
        <h3>${territory.territory_name}</h3>
        <div class="metrics">
            <div class="metric">
                <strong>${territory.zip_code_count}</strong><br>
                Zip Codes
            </div>
            <div class="metric">
                <strong>${territory.total_population.toLocaleString()}</strong><br>
                Population
            </div>
            <div class="metric">
                <strong>${territory.average_score.toFixed(1)}</strong><br>
                Score
            </div>
            <div class="metric">
                <strong>${territory.radius_miles.toFixed(1)}mi</strong><br>
                Radius
            </div>
        </div>
        <p><strong>Insights:</strong> ${territory.key_insights}</p>
        ${options.includeCampaignRecommendations ? `
        <p><strong>Campaign Type:</strong> ${territory.campaign_type}</p>
        <p><strong>Recommended Budget:</strong> ${territory.recommended_budget_range}</p>
        <p><strong>Primary Channels:</strong> ${territory.primary_channels}</p>
        ` : ''}
    </div>
    `).join('')}

</body>
</html>`;
  }

  /**
   * Generate single territory HTML
   */
  private generateSingleTerritoryHTML(
    cluster: ClusterResult,
    options: ExportOptions
  ): string {
    const recommendations = this.generateCampaignRecommendations(cluster);
    const date = new Date().toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${cluster.name} - Territory Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${cluster.name}</h1>
        <p>Territory Analysis Report - Generated on ${date}</p>
    </div>

    <div class="section">
        <h2>Territory Overview</h2>
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${cluster.zipCodes.length}</div>
                <div class="metric-label">Zip Codes</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${cluster.totalPopulation.toLocaleString()}</div>
                <div class="metric-label">Total Population</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${cluster.averageScore.toFixed(1)}</div>
                <div class="metric-label">Average Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${cluster.radiusMiles.toFixed(1)}mi</div>
                <div class="metric-label">Territory Radius</div>
            </div>
        </div>
        <p><strong>Key Insights:</strong> ${cluster.keyInsights}</p>
    </div>

    ${options.includeCampaignRecommendations ? `
    <div class="section">
        <h2>Campaign Recommendations</h2>
        <p><strong>Campaign Type:</strong> ${recommendations.campaignType}</p>
        <p><strong>Recommended Budget:</strong> ${recommendations.budgetRange}</p>
        <p><strong>Primary Channels:</strong> ${recommendations.primaryChannels.join(', ')}</p>
        <p><strong>Target Demographics:</strong> ${recommendations.targetDemographics}</p>
        <h3>Media Recommendations:</h3>
        <ul>
            ${recommendations.mediaRecommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${options.includeIndividualZipCodes ? `
    <div class="section">
        <h2>Included Zip Codes (${cluster.zipCodes.length})</h2>
        <p>${cluster.zipCodes.join(', ')}</p>
    </div>
    ` : ''}

</body>
</html>`;
  }

  /**
   * Generate comparison HTML
   */
  private generateComparisonHTML(
    data: any[],
    clusters: ClusterResult[],
    options: ExportOptions
  ): string {
    const date = new Date().toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Territory Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .rank-1 { background-color: #d4edda; }
        .rank-2 { background-color: #d1ecf1; }
        .rank-3 { background-color: #ffeaa7; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Territory Comparison Report</h1>
        <p>Comparing ${clusters.length} territories - Generated on ${date}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Territory Name</th>
                <th>Score</th>
                <th>Score Rank</th>
                <th>Population</th>
                <th>Pop. Rank</th>
                <th>Zip Codes</th>
                <th>Size Rank</th>
                <th>Radius (mi)</th>
                <th>Key Insights</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(territory => `
            <tr class="${territory.score_rank <= 3 ? `rank-${territory.score_rank}` : ''}">
                <td><strong>${territory.territory_name}</strong></td>
                <td>${territory.average_score.toFixed(1)}</td>
                <td>#${territory.score_rank}</td>
                <td>${territory.total_population.toLocaleString()}</td>
                <td>#${territory.population_rank}</td>
                <td>${territory.zip_code_count}</td>
                <td>#${territory.size_rank}</td>
                <td>${territory.radius_miles.toFixed(1)}</td>
                <td>${territory.key_insights}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

</body>
</html>`;
  }

  /**
   * Sanitize filename for download
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }
}