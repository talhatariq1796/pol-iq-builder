import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

async function generateToken(apiKey: string) {
  const params = new URLSearchParams({
    f: 'json',
    client_id: apiKey,
    grant_type: 'client_credentials',
    expiration: '60',
    client_secret: apiKey
  });

  const response = await axios({
    method: 'POST',
    url: 'https://www.arcgis.com/sharing/rest/oauth2/token',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: params
  });

  if (response.data.error) {
    throw new Error(`Token generation failed: ${response.data.error.message}`);
  }

  return response.data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiKey = formData.get('token') as string;
    const geometry = JSON.parse(formData.get('geometry') as string);
    const reportTemplate = formData.get('reportTemplate') as string;

    // Generate a token first
    const token = await generateToken(apiKey);

    // Format the request
    const reportParams = {
      title: "Area Analysis",
      template: {
        layout: reportTemplate,
        elements: [
          {
            type: "map",
            center: {
              x: geometry.rings[0][0][0],
              y: geometry.rings[0][0][1],
              spatialReference: geometry.spatialReference
            },
            scale: 24000
          },
          {
            type: "infographic",
            studyAreas: [{
              geometry: {
                rings: geometry.rings,
                spatialReference: geometry.spatialReference,
                type: "polygon"
              }
            }],
            variables: [
              "KeyGlobalFacts.TOTPOP",
              "KeyGlobalFacts.TOTHH",
              "KeyGlobalFacts.AVGHHSZ",
              "KeyGlobalFacts.MEDHINC_CY",
              "KeyGlobalFacts.MEDAGE_CY"
            ]
          }
        ]
      }
    };

    // Use the generated token for the report request
    const params = new URLSearchParams({
      f: 'json',
      token: token,
      format: 'HTML',
      reportParameters: JSON.stringify(reportParams)
    });

    // Use the utility service
    const endpoint = 'https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task/execute';

    const response = await axios({
      method: 'POST',
      url: endpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: params
    });

    // Get the report URL
    const reportUrl = response.data.results?.[0]?.value?.url;
    
    if (!reportUrl) {
      return NextResponse.json({
        error: 'Invalid response',
        details: 'No report URL found in response'
      }, { status: 400 });
    }

    // Fetch the report HTML
    const htmlResponse = await axios.get(reportUrl);
    
    return NextResponse.json({ 
      reportHtml: htmlResponse.data 
    });

  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `${error.message}: ${JSON.stringify(error.response.data)}`;
      }
    }
    return NextResponse.json({
      error: 'API route error',
      details: errorMessage
    }, { status: 500 });
  }
} 