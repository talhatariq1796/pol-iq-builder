import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { VisualizationControls } from './VisualizationControls';
import type { BlendMode } from '../types/visualization';

interface DraggableLayerProps {
  id: string;
  title: string;
  description?: string;
  isVisible: boolean;
  isLoading?: boolean;
  layer?: __esri.FeatureLayer | null;
  onToggle: () => void;
  isDragOverlay?: boolean;
  isAnalysisLayer?: boolean;
}

export const DraggableLayer: React.FC<DraggableLayerProps> = ({
  id,
  title,
  description,
  isVisible,
  isLoading,
  layer,
  onToggle,
  isDragOverlay,
  isAnalysisLayer
}) => {
  const [showControls, setShowControls] = useState(false);
  const [opacity, setOpacity] = useState(layer?.opacity || 1);
  const [blendMode, setBlendMode] = useState<BlendMode>('normal');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    if (layer) {
      layer.opacity = newOpacity;
    }
  };

  const handleBlendModeChange = (newBlendMode: BlendMode) => {
    setBlendMode(newBlendMode);
    if (layer) {
      // Apply blend mode to layer
      layer.blendMode = newBlendMode;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex flex-col border rounded-lg bg-white shadow-sm
        ${isDragOverlay ? 'cursor-grabbing' : 'cursor-grab'}
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center px-4 py-2 space-x-3">
        <button
          onClick={onToggle}
          className={`
            p-1 rounded-full
            ${isVisible ? 'text-green-500' : 'text-gray-400'}
            hover:bg-gray-100
          `}
        >
          {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        
        <div className="flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>

        {layer && (
          <button
            onClick={() => setShowControls(!showControls)}
            className={`
              p-1 rounded-full
              ${showControls ? 'text-blue-500' : 'text-gray-400'}
              hover:bg-gray-100
            `}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      {showControls && layer && (
        <div className="px-4 py-2 border-t">
          <VisualizationControls
            layer={layer}
            opacity={opacity}
            blendMode={blendMode}
            onOpacityChange={handleOpacityChange}
            onBlendModeChange={handleBlendModeChange}
          />
        </div>
      )}
    </div>
  );
}; 