import { useState, useRef } from 'react';
import { Loader2, FileDown, Image, Code, X } from 'lucide-react';
import { exportChart } from '@/utils/exportUtils';
import styles from './ReportDialog.module.css';
import AnalysisDashboard from './AnalysisDashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: __esri.Geometry;
  reportType: string;
}

const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  geometry,
  reportType
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFullReportExport = async (type: 'pdf' | 'image' | 'html') => {
    if (reportRef.current) {
      await exportChart({
        type,
        title: 'Area Analysis Report',
        element: reportRef.current
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-7xl h-screen m-0 p-0">
        <div className={`h-full flex flex-col overflow-y-auto ${styles.scrollContainer}`} ref={reportRef}>
          <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between bg-white sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <DialogTitle>Area Analysis Report</DialogTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => handleFullReportExport('pdf')}
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => handleFullReportExport('image')}
                >
                  <Image className="h-4 w-4" aria-label="Export image" />
                  Export Image
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => handleFullReportExport('html')}
                >
                  <Code className="h-4 w-4" />
                  Export HTML
                </Button>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 p-6 bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : error ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-red-600">{error}</div>
                </CardContent>
              </Card>
            ) : (
              <AnalysisDashboard geometry={geometry} />
            )}

           
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;