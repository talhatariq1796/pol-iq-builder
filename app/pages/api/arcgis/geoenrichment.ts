import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Request body:', req.body);

  try {
    const response = await fetch(
      'https://geoenrichment.arcgis.com/arcgis/rest/services/World/GeoenrichmentServer/Geoenrichment/enrich',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(req.body).toString()
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ArcGIS API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}