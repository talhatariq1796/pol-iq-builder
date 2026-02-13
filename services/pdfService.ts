import type { PDFData } from '@/types/reports';
import esriConfig from "@arcgis/core/config";

// Ensure API key is set
const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';
if (!apiKey) {
  throw new Error('ArcGIS API key is required');
}

esriConfig.apiKey = apiKey;

export async function generatePDFs(geometry: __esri.Geometry): Promise<PDFData> {
  const demographic = await generateDemographicReport(geometry);
  const market = await generateMarketReport(geometry);
  
  return {
    demographic,
    market,
    charts: []
  };
}

async function generateDemographicReport(geometry: __esri.Geometry): Promise<string> {
  const response = await fetch('https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      f: 'json',
      token: apiKey,
      studyAreas: JSON.stringify([{ geometry }]),
      report: 'demographic-profile',
      format: 'PDF'
    }).toString()
  });

  if (!response.ok) throw new Error('Failed to generate demographic report');
  return await response.text();
}

async function generateMarketReport(geometry: __esri.Geometry): Promise<string> {
  const response = await fetch('https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      f: 'json',
      token: apiKey,
      studyAreas: JSON.stringify([{ geometry }]),
      report: 'market-profile',
      format: 'PDF'
    }).toString()
  });

  if (!response.ok) throw new Error('Failed to generate market report');
  return await response.text();
}