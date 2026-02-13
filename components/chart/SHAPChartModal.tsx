import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldMappingHelper } from '@/utils/visualizations/field-mapping-helper';

interface SHAPChartData {
  name: string;
  value: number;
}

interface SHAPChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SHAPChartData[];
  analysisType?: string;
}

export const SHAPChartModal: React.FC<SHAPChartModalProps> = ({
  isOpen,
  onClose,
  data,
  analysisType = 'Analysis'
}) => {
  // Find max value for scaling bars
  const maxValue = Math.max(...data.map(item => item.value));
  
  // Format analysis type for display
  const formattedAnalysisType = analysisType
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xs font-semibold">
              📊 Feature Importance - {formattedAnalysisType}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <p className="text-xs text-gray-600 mb-6">
            These factors have the strongest influence on the analysis results. 
            Higher bars indicate greater importance in determining the scores.
          </p>
          
          {data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No feature importance data available for this analysis.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.map((item, index) => {
                const barWidth = (item.value / maxValue) * 100;
                const intensity = Math.min(item.value / maxValue, 1);
                
                return (
                  <div key={index} className="flex items-center gap-3">
                    {/* Feature name */}
                    <div className="w-32 text-xs font-medium text-gray-700 text-right flex-shrink-0">
                      {FieldMappingHelper.getFriendlyFieldName(item.name)}
                    </div>
                    
                    {/* Bar container */}
                    <div className="flex-1 relative">
                      <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md transition-all duration-300 relative"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: `rgba(51, 168, 82, ${0.3 + intensity * 0.7})` // Green (#33a852) with variable opacity
                          }}
                        >
                        </div>
                      </div>
                    </div>
                    
                    {/* Rank indicator */}
                    <div className="w-8 text-xs text-gray-400 flex-shrink-0">
                      #{index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {data.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>How to read this chart:</strong></p>
                <p>• Longer bars = more important factors</p>
                <p>• Values show average influence strength across all areas</p>
                <p>• Top factors explain why certain areas score higher</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};