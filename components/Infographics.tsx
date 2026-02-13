/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, FileSpreadsheet, Download, Users, DollarSign, Home, TrendingUp, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ReportSelectionDialog from './ReportSelectionDialog';
import EndpointScoringReport from './EndpointScoringReport';
import { fetchReports, Report } from '@/services/ReportsService';

// Removed unused ReportTemplateName, ReportCategory and ReportTemplate interfaces

interface InfographicsProps {
  geometry: __esri.Geometry | null;
  reportTemplate: string | null;
  onReportTemplateChange: (template: string | null) => void;
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } };
  generateStandardReport?: (geometry: __esri.Geometry, reportType: string) => Promise<string>;
  view: __esri.MapView | __esri.SceneView | null;
  onExportPDF?: () => void;
}

// Legacy hardcoded templates - now using ReportsService for all report dialogs

// Mock Canadian demographic data generator
const generateMockDemographicData = (reportTemplate: string) => {
  const baseData = {
    totalPopulation: Math.floor(Math.random() * 50000) + 10000,
    totalHouseholds: Math.floor(Math.random() * 25000) + 5000,
    medianAge: Math.floor(Math.random() * 15) + 38, // Canadian median age ~41
    medianIncome: Math.floor(Math.random() * 40000) + 65000, // CAD median income higher
    averageHouseholdSize: (Math.random() * 0.8 + 2.3).toFixed(1), // Canadian average ~2.5
    diversityIndex: Math.floor(Math.random() * 35) + 65, // Canada is quite diverse
    homeOwnership: Math.floor(Math.random() * 25) + 67, // Canadian homeownership ~69%
    universityEducation: Math.floor(Math.random() * 20) + 35, // Canada has high education rates
    frenchSpeaking: Math.floor(Math.random() * 30) + 15, // Varies by region
    immigrantPopulation: Math.floor(Math.random() * 25) + 20, // Canada has high immigration
  };

  // Customize data based on report template
  if (reportTemplate?.includes('demographic')) {
    return { ...baseData, focus: 'demographics' };
  } else if (reportTemplate?.includes('income')) {
    return { ...baseData, focus: 'income', medianIncome: baseData.medianIncome + 15000 };
  } else if (reportTemplate?.includes('market') || reportTemplate?.includes('prizm')) {
    return { ...baseData, focus: 'market' };
  }
  
  return { ...baseData, focus: 'general' };
};

const Infographics: React.FC<InfographicsProps> = ({
  geometry,
  reportTemplate,
  onReportTemplateChange,
  generateStandardReport,
  onExportPDF
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mockData, setMockData] = useState<Record<string, number | string> | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableReports, setAvailableReports] = useState<Report[]>([]);
  // Removed unused selectedReport state

  const handleDialogOpen = () => setIsDialogOpen(true);
  const handleDialogClose = () => setIsDialogOpen(false);
  const handleReportSelect = (reportId: string) => {
    onReportTemplateChange(reportId);
    setIsDialogOpen(false);
  };

  // Load available reports when component mounts
  useEffect(() => {
    const loadReports = async () => {
      try {
        const reports = await fetchReports();
        setAvailableReports(reports);
        console.log('[Infographics] Loaded reports:', reports.map(r => r.title));
      } catch (error) {
        console.error('[Infographics] Error loading reports:', error);
      }
    };

    loadReports();
  }, []);

  // Removed unused handleCardClick function

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      // Clean up any blob URLs to prevent memory leaks
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    let isMounted = true;
    const currentTimeout = cleanupTimeoutRef.current;

    console.log('[Infographics Effect RUN]', { 
        hasGeometry: !!geometry, 
        reportTemplate, 
        generateFuncExists: !!generateStandardReport 
    });

    const generateReport = async () => {
      if (isMounted) { 
          console.log('[generateReport] Clearing error and pdfUrl before starting generation.');
          setError(null); 
          setPdfUrl(null);
          setMockData(null);
          setLoading(true);
      }

      console.log('[generateReport START]', { hasGeometry: !!geometry, reportTemplate }); 
      
      if (!reportTemplate) {
         console.warn('[generateReport WARN] No report template selected. Exiting.');
         if (isMounted) setLoading(false);
         return;
      }

      // If no geometry, still allow the interface to show but display the "select area" message
      if (!geometry) {
        console.warn('[generateReport WARN] No geometry available for report generation. Setting loading to false but not exiting.');
         if (isMounted) setLoading(false);
         return;
      }

      try {
        console.log(`[generateReport TRY] Generating report with template: ${reportTemplate}`);
        
        if (generateStandardReport) {
          console.log('[generateReport] Using provided generateStandardReport function');
          try {
            const reportUrl = await generateStandardReport(geometry, reportTemplate);
            console.log('[generateReport SUCCESS] Generated report URL:', reportUrl);
            if (isMounted) setPdfUrl(reportUrl);
          } catch (genError) {
            console.error('[generateReport ERROR] Standard report generation failed:', genError);
            if (isMounted) setError(genError instanceof Error ? genError.message : String(genError));
          }
        } else {
          console.log('[generateReport] No generateStandardReport function provided, generating mock demographic report');
          // Generate mock demographic report for demo purposes
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (isMounted) {
            const data = generateMockDemographicData(reportTemplate);
            setMockData(data);
          }
        }
      } catch (err) {
        console.error('[generateReport CATCH] Unexpected error during generation:', err);
        if (isMounted) {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
            console.log(`[generateReport CATCH] Setting error state to: "${errorMsg}"`);
            setError(errorMsg);
        }
      } finally {
        console.log('[generateReport FINALLY] Setting loading to false.');
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    console.log('[Infographics Effect] Setting timeout to call generateReport');
    cleanupTimeoutRef.current = setTimeout(() => {
      console.log('[Infographics Effect TIMEOUT] Timeout fired, calling generateReport.');
      generateReport();
    }, 300);

    return () => {
      console.log('[Infographics Effect CLEANUP]', { timeoutId: currentTimeout });
      isMounted = false;
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        console.log('[Infographics Effect CLEANUP] Cleared previous timeout.');
      }
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
          console.log('[Infographics Effect CLEANUP] Revoking PDF blob URL.');
          URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [geometry, reportTemplate, generateStandardReport]);

  // Convert reportTemplate ID to display name
  const getDisplayName = (templateId: string | null): string => {
    if (!templateId) return '';
    // Convert kebab-case to title case
    return templateId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderHeader = () => {
    return (
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-base font-medium">{getDisplayName(reportTemplate)}</h2>
        <div className="flex items-center gap-4">
          <Button onClick={handleDialogOpen} className="w-[220px] h-8 bg-white text-black border border-gray-300 hover:bg-gray-50">
            {getDisplayName(reportTemplate) || 'Select Report'}
          </Button>
          <ReportSelectionDialog
            open={isDialogOpen}
            reports={availableReports.map(report => ({
              id: report.id,
              title: report.title,
              description: report.description,
              thumbnail: report.thumbnail || '',
              categories: report.categories
            }))}
            onClose={handleDialogClose}
            onSelect={handleReportSelect as any}
          />
        </div>
      </div>
    );
  };

  const renderMockReport = () => {
    if (!mockData) return null;

    // Get display name for the selected template
    const templateDisplayName = getDisplayName(reportTemplate);
    
    return (
      <div className="report-content p-6 max-w-4xl mx-auto bg-white">
        {/* Header */}
        <div className="text-center mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{templateDisplayName}</h1>
          <p className="text-lg text-gray-600">Area Analysis Report</p>
          <p className="text-sm text-gray-500 mt-2">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-blue-900">{mockData.totalPopulation.toLocaleString()}</h3>
            <p className="text-sm text-blue-700">Total Population</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <Home className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-green-900">{mockData.totalHouseholds.toLocaleString()}</h3>
            <p className="text-sm text-green-700">Total Households</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-purple-900">{mockData.medianAge}</h3>
            <p className="text-sm text-purple-700">Median Age</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <DollarSign className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-yellow-900">${mockData.medianIncome.toLocaleString()} CAD</h3>
            <p className="text-sm text-yellow-700">Median Income</p>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Household Characteristics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Average Household Size:</span>
                <span className="font-medium">{mockData.averageHouseholdSize} people</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Home Ownership Rate:</span>
                <span className="font-medium">{mockData.homeOwnership}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">University Education:</span>
                <span className="font-medium">{mockData.universityEducation}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">French Speaking:</span>
                <span className="font-medium">{mockData.frenchSpeaking}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Profile</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Diversity Index:</span>
                <span className="font-medium">{mockData.diversityIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Immigrant Population:</span>
                <span className="font-medium">{mockData.immigrantPopulation}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Population Growth:</span>
                <span className="font-medium text-green-600">+1.8% annually</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Employment Rate:</span>
                <span className="font-medium">92.1%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights Section */}
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Key Insights</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• This Quebec area shows strong economic indicators with median income of ${mockData.medianIncome.toLocaleString()} CAD</p>
            <p>• High education levels ({mockData.universityEducation}%) indicate skilled workforce potential</p>
            <p>• Multicultural community with {mockData.immigrantPopulation}% immigrant population contributing to diversity</p>
            <p>• {mockData.frenchSpeaking}% French-speaking population reflects Quebec's linguistic character</p>
            <p>• Homeownership rate of {mockData.homeOwnership}% indicates housing market stability</p>
          </div>
        </div>

        {/* Charts Placeholder */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-2">
              <BarChart className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-500">Age Distribution Chart</p>
            <p className="text-xs text-gray-400 mt-1">Would display age group breakdown</p>
          </div>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-2">
              <TrendingUp className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-500">Income Distribution</p>
            <p className="text-xs text-gray-400 mt-1">Would display income brackets</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 border-t pt-4">
          <p>Data provided by Statistics Canada & ArcGIS Canadian Demographics | Report generated by MPIQ Housing Intelligence</p>
          <p>This is a sample Quebec demographic report for demonstration purposes</p>
        </div>
      </div>
    );
  };

  const exportToPDF = async () => {
    try {
      console.log('Starting export...');
      const reportElement = document.querySelector('.report-content');
      
      if (!reportElement) {
        console.error('Report content element not found');
        return;
      }

      const contentHeight = reportElement.scrollHeight;
      const contentWidth = reportElement.clientWidth;

      const originalStyle = (reportElement as HTMLElement).getAttribute('style') || '';
      (reportElement as HTMLElement).style.height = `${contentHeight}px`;
      (reportElement as HTMLElement).style.overflow = 'visible';

      console.log('Converting to canvas...');
      const canvas = await html2canvas(reportElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        height: contentHeight,
        width: contentWidth,
        windowHeight: contentHeight
      });

      reportElement.setAttribute('style', originalStyle);

      console.log('Creating PDF...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const aspectRatio = canvas.width / canvas.height;
      const imgWidth = pdfWidth - 20;
      const imgHeight = imgWidth / aspectRatio;

      let heightLeft = imgHeight;
      let position = 0;
      let firstPage = true;

      while (heightLeft >= 0) {
        if (!firstPage) {
          pdf.addPage();
        }
        
        pdf.addImage(
          canvas.toDataURL('image/png'), 
          'PNG',
          10,
          firstPage ? 10 : -(position * pdfHeight) + 10,
          imgWidth,
          imgHeight
        );
        
        heightLeft -= (pdfHeight - 20);
        position++;
        firstPage = false;
      }

      pdf.save(`${reportTemplate}-report.pdf`);
      console.log('PDF saved');
    } catch (error) {
      console.error('Error during PDF export:', error);
    }
  };

  console.log('[Infographics Render]', { loading, error, pdfUrl, mockData });

  if (!geometry) {
    return (
      <Card className="h-full">
        {renderHeader()}
        <div className="flex flex-col items-center justify-center p-4 gap-3">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-gray-600 text-center px-4">
            Please select an area on the map to generate a report.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-none border-0">
       {renderHeader()}
      <CardContent className="flex-1 overflow-auto p-0">
        {/* Check if this is an endpoint scoring report */}
        {(reportTemplate === 'endpoint-scoring-combined' || reportTemplate === 'market-intelligence-report') ? (
          <EndpointScoringReport geometry={geometry} onExportPDF={onExportPDF} />
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Generating report...</p>
                </div>
              </div>
            )}
            {error && (
              <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {pdfUrl && !loading && !error && (
              <iframe
                src={pdfUrl}
                title="Infographic Report"
                className="w-full border-0"
                style={{ 
                  height: '800px', 
                  minHeight: '100%'
                }}
          />
        )}
            {mockData && !loading && !error && !pdfUrl && (
              <div className="min-h-0 flex-1">
                {renderMockReport()}
              </div>
            )}
            {!loading && !error && !pdfUrl && !mockData && (
               <div className="flex items-center justify-center p-8">
                 <div className="text-center text-gray-500">
                 <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                 <p>Report will be displayed here once generated.</p>
                 </div>
               </div>
            )}
          </>
        )}
      </CardContent>
       {(pdfUrl || mockData) && !loading && (
         <div className="p-2 border-t flex justify-end gap-2">
           {pdfUrl && (
           <Button size="sm" onClick={() => window.open(pdfUrl, '_blank')} disabled={!pdfUrl || loading}>
              <Download className="mr-2 h-4 w-4" />
             Open PDF
           </Button>
           )}
           {mockData && (
             <Button size="sm" onClick={exportToPDF} disabled={loading}>
             <Download className="mr-2 h-4 w-4" />
             Export PDF
             </Button>
           )}
         </div>
       )}
    </Card>
  );
};

export default Infographics;