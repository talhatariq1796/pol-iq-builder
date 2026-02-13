import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, studyArea, reportTemplate } = body;

    if (!token) {
      return NextResponse.json({
        error: 'Missing API key',
        details: 'API key is required'
      }, { status: 400 });
    }

    // Format the request data
    const formData = new URLSearchParams();
    formData.append('f', 'json');
    formData.append('apiKey', token);
    formData.append('report', reportTemplate);
    formData.append('format', 'pdf');
    formData.append('studyAreas', JSON.stringify([studyArea]));
    formData.append('langCode', 'en-us');

    // Make request to ArcGIS
    const response = await axios.post(
      'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    if (response.data.error) {
      console.error('ArcGIS API error:', response.data.error);
      return NextResponse.json({
        error: 'ArcGIS API error',
        details: response.data.error.message || JSON.stringify(response.data.error)
      }, { status: 400 });
    }

    // Return the report URL
    const reportUrl = response.data.results?.[0]?.value?.reportUrl;
    if (!reportUrl) {
      return NextResponse.json({
        error: 'Invalid response',
        details: 'No report URL in response'
      }, { status: 400 });
    }

    return NextResponse.json({ reportUrl });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}