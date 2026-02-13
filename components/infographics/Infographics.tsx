/* eslint-disable @typescript-eslint/no-unused-vars */
// Infographics.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  geometry: __esri.Geometry;
  apiKey: string;
  reportTemplate?: string;
}

interface ApiError {
  error: string;
  details: string;
}

const isApiError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    'details' in error
  );
};

const Infographics: React.FC<Props> = ({ geometry, apiKey, reportTemplate = "KeyFacts" }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const generateReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure geometry is in the correct format
      const studyArea = {
        geometry: {
          rings: geometry.toJSON().rings,
          spatialReference: { wkid: 4326 } // Ensure we're using WGS84
        }
      };

      const requestBody = {
        token: apiKey,
        studyArea,
        reportTemplate,
        langCode: 'en-ca', // Changed from 'en-us' to 'en-ca' for Canadian demographics
        format: 'html' // Change from 'pdf' to 'html'
      };

      console.log('Sending request with data:', requestBody);

      const response = await fetch('/api/arcgis/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.reportHtml) {
        throw new Error('No report HTML in response');
      }

      setReportHtml(data.reportHtml);
      
      if (reportContainerRef.current) {
        reportContainerRef.current.innerHTML = data.reportHtml;
        // Add necessary styles
        const style = document.createElement('style');
        style.textContent = `
          .esri-infographic {
            width: 100%;
            height: 100%;
            overflow: auto;
          }
          .esri-infographic__content {
            padding: 1rem;
          }
        `;
        reportContainerRef.current.appendChild(style);
      }

      retryCount.current = 0;

    } catch (err: unknown) {
      console.error('Error generating report:', err);
      
      const errorMessage = isApiError(err) 
        ? err.details 
        : err instanceof Error 
          ? err.message 
          : 'An unknown error occurred';
      
      const isNetworkError = err instanceof Error && (
        errorMessage.includes('ENOTFOUND') || 
        errorMessage.includes('network') ||
        errorMessage.includes('NetworkError')
      );
      
      if (retryCount.current < maxRetries && isNetworkError) {
        retryCount.current++;
        setTimeout(() => {
          generateReport();
        }, 2000 * retryCount.current);
        return;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [geometry, apiKey, reportTemplate]);

  useEffect(() => {
    if (geometry && apiKey) {
      generateReport();
    }
  }, [geometry, apiKey, generateReport]);

  return (
    <div className="flex flex-col h-full bg-white">
      {isLoading && (
        <div className="flex items-center justify-center p-4 bg-white bg-opacity-90 absolute inset-0 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-lg">
            Generating report{retryCount.current > 0 ? ` (Attempt ${retryCount.current + 1}/${maxRetries + 1})` : ''}...
          </span>
        </div>
      )}
      {error && (
        <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-semibold text-red-700">Error</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => {
              retryCount.current = 0;
              generateReport();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
      <div 
        ref={reportContainerRef} 
        className={`flex-1 overflow-auto p-4 ${isLoading ? 'opacity-50' : ''}`}
      />
    </div>
  );
};

export default Infographics;