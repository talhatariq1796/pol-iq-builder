/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Constants for API configuration
const API_CONFIG = {
  BASE_URL: 'https://trends.google.com/trends/explore',
  DEFAULT_HEADERS: {
    'Accept': 'application/json'
  }
};

// Bright Data configuration
const BRIGHT_DATA_CONFIG = {
  username: process.env.BRIGHT_DATA_USERNAME,
  password: process.env.BRIGHT_DATA_PASSWORD,
  host: process.env.BRIGHT_DATA_HOST,
  port: process.env.BRIGHT_DATA_PORT
};

// Load Bright Data certificate with graceful fallback
const CERT_PATH = path.join(process.cwd(), 'certs', 'BrightData SSL certificate (port 33335).crt');
let ca: Buffer | undefined;
try {
  if (fs.existsSync(CERT_PATH)) {
    ca = fs.readFileSync(CERT_PATH);
    console.log('Bright Data certificate loaded successfully');
  } else {
    console.warn('Bright Data certificate not found at:', CERT_PATH);
    console.warn('Trends API will operate without SSL certificate verification');
  }
} catch (error) {
  console.error('Error loading Bright Data certificate:', error);
  console.warn('Trends API will operate without SSL certificate verification');
}

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to get time range parameters
const getTimeRangeParams = (timeframe: string): string => {
  switch (timeframe.toLowerCase()) {
    case 'past month':
    case 'past 30 days':
      return 'today 1-m';
    case 'past 90 days':
      return 'today 3-m';
    case 'past year':
      return 'today 12-m';
    default:
      return 'today 1-m';
  }
};

// Add rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  delayMs: 2000 // 2 seconds between requests
};

// Add request tracking
const requestTracker = {
  requests: new Map<string, number[]>(),
  lastRequestTime: new Map<string, number>()
};

// Helper function to check rate limit
const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const requests = requestTracker.requests.get(ip) || [];
  const lastRequest = requestTracker.lastRequestTime.get(ip) || 0;

  // Clean old requests
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT.windowMs);
  requestTracker.requests.set(ip, recentRequests);

  // Check if we're within the rate limit
  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    return false;
  }

  // Check if we need to delay
  if (now - lastRequest < RATE_LIMIT.delayMs) {
    return false;
  }

  // Update tracking
  recentRequests.push(now);
  requestTracker.requests.set(ip, recentRequests);
  requestTracker.lastRequestTime.set(ip, now);

  return true;
};

// Helper function to get trends data
const getTrendsData = async (
  keyword: string,
  timeframe: string,
  geo: string,
  category: string,
  maxRetries: number = 3
): Promise<any> => {
  // Validate Bright Data configuration with detailed error message
  const missingVars = Object.entries(BRIGHT_DATA_CONFIG)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('Missing Bright Data environment variables:', missingVars);
    throw new Error(`Missing required Bright Data environment variables: ${missingVars.join(', ')}`);
  }

  if (!ca) {
    throw new Error('Failed to load Bright Data certificate. Please ensure the certificate file exists.');
  }

  // Bright Data proxy configuration
  const proxyUrl = new URL(`http://${BRIGHT_DATA_CONFIG.host}:${BRIGHT_DATA_CONFIG.port}`);
  proxyUrl.username = BRIGHT_DATA_CONFIG.username as string;
  proxyUrl.password = BRIGHT_DATA_CONFIG.password as string;
  
  const proxyAgent = new HttpsProxyAgent(proxyUrl.toString());
  (proxyAgent as any).options.rejectUnauthorized = false;
  (proxyAgent as any).options.timeout = 60000; // 60 seconds for proxy connection
  (proxyAgent as any).options.keepAlive = true;
  (proxyAgent as any).options.keepAliveMsecs = 1000;
  (proxyAgent as any).options.maxSockets = 1;
  (proxyAgent as any).options.maxFreeSockets = 1;
  (proxyAgent as any).options.scheduling = 'fifo';

  // Construct the Google Trends URL with parameters
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `https://trends.google.com/trends/explore?q=${encodedKeyword}&date=today%201-m&geo=US-MI`;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      console.log('Requesting URL:', url);
      
      // Make request using Bright Data proxy with improved headers
      const response = await axios.get(url, {
        httpsAgent: proxyAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        },
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        },
        timeout: 60000, // 60 seconds timeout for the entire request
        maxRedirects: 5
      });

      // For debugging
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data preview:', typeof response.data === 'string' ? response.data.substring(0, 200) : 'Non-string response');

      // Parse the HTML response to extract trends data
      const geoData = parseGoogleTrendsResponse(response.data);
      
      // Log location statistics
      const totalLocations = geoData.length;
      const locationsWithValues = geoData.filter((loc: { value?: number }) => loc.value !== undefined && loc.value !== null).length;
      const locationsWithoutValues = totalLocations - locationsWithValues;

      console.log('Location Statistics:', {
        totalLocations,
        locationsWithValues,
        locationsWithoutValues,
        sampleLocations: geoData.slice(0, 3).map((loc: { geoName: string; value?: number }) => ({
          name: loc.geoName,
          value: loc.value,
          hasValue: loc.value !== undefined && loc.value !== null
        }))
      });

      // Return the actual data
      return {
        keyword,
        timeframe: getTimeRangeParams(timeframe),
        geo: geo,
        category,
        results: [], // Empty array since we're not using time series data
        geoData: geoData,
        searchMetadata: {
          id: Date.now().toString(),
          status: 'Success',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          locationStats: {
            total: totalLocations,
            withValues: locationsWithValues,
            withoutValues: locationsWithoutValues
          }
        }
      };
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any).code,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
        headers: (error as any).response?.headers,
        proxy: (error as any).config?.httpsAgent?.proxy
      });
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Waiting ${delayMs}ms before retry...`);
        await delay(delayMs);
      }
    }
  }

  // If we get here, all retries failed
  console.error('All retry attempts failed:', lastError);
  throw lastError;
};

// Helper function to parse Google Trends response
const parseGoogleTrendsResponse = (html: string): any[] => {
  try {
    // Log the HTML content for debugging
    console.log('HTML Content Preview:', html.substring(0, 500));

    // Extract location data from the HTML
    // Look for patterns like "geoName":"Toronto","value":100
    const locationPattern = /"geoName":"([^"]+)","value":(\d+)/g;
    const locations: any[] = [];
    let match;

    while ((match = locationPattern.exec(html)) !== null) {
      locations.push({
        geoName: match[1],
        value: parseInt(match[2], 10),
        geo: 'CA-ON' // Since we're only querying Ontario
      });
    }

    // Log the extracted locations
    console.log('Extracted Locations:', locations);

    return locations;
  } catch (error) {
    console.error('Error parsing Google Trends response:', error);
    return [];
  }
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const timeframe = searchParams.get('timeframe') || 'past 30 days';
    const geo = searchParams.get('geo') || 'CA';
    const category = searchParams.get('category') || '0';

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for') || 'unknown';
    const clientIp = forwardedFor.split(',')[0].trim();

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    console.log('Processing request:', {
      keyword,
      timeframe,
      geo,
      category,
      timestamp: new Date().toISOString(),
      clientIp
    });

    const trendsData = await getTrendsData(keyword, timeframe, geo, category);

    // Return a proper response with CORS headers
    return new NextResponse(JSON.stringify(trendsData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Error in trends API:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch trends data',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
} 