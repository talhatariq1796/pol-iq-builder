import React from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from 'lucide-react';

const FeatureSelectionUI = ({ 
  selectedFeature, 
  displayField = "name" 
}: { 
  selectedFeature: __esri.Graphic | null;
  displayField?: string;
}) => {
  if (!selectedFeature) return null;

  return (
    <Card className="absolute bottom-20 left-4 z-10 p-3 bg-white/90 backdrop-blur-sm shadow-lg border animate-in slide-in-from-bottom-2">
      <div className="flex items-center space-x-2">
        <Tag className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-medium text-purple-900">
          Selected: {selectedFeature.attributes[displayField] || 'Unnamed Feature'}
        </span>
      </div>
    </Card>
  );
};

export default FeatureSelectionUI;