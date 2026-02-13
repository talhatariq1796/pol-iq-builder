import React from 'react';
import { Target, MousePointerClick, Hexagon, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface DrawingToolsProps {
  drawMode: string | null;
  handleDrawButtonClick: (mode: 'point' | 'polygon' | 'click') => void;
  isDrawing: boolean;
  isSelectionMode: boolean;
  onSelectionComplete: () => void;
  hasSelectedFeature: boolean;
  shouldShowNext: boolean;
  selectedCount?: number;
}

const DrawingTools = ({
  drawMode,
  handleDrawButtonClick,
  isDrawing,
  onSelectionComplete,
  hasSelectedFeature,
  selectedCount = 0
}: DrawingToolsProps) => {
  const tools = [
    {
      type: 'point',
      Icon: Target,
      label: 'Point',
      tooltip: 'Drop Point on Map',
      classes: {
        active: 'bg-blue-50 text-blue-600 border border-blue-200',
        default: 'theme-draw-button hover:text-blue-600'
      }
    },
    {
      type: 'polygon',
      Icon: Hexagon,
      label: 'Area',
      tooltip: 'Draw Polygon Area',
      classes: {
        active: 'bg-green-50 text-green-600 border border-green-200',
        default: 'theme-draw-button hover:text-green-600'
      }
    },
    {
      type: 'click',
      Icon: MousePointerClick,
      label: 'Select',
      tooltip: 'Select Existing Feature',
      classes: {
        active: 'bg-purple-50 text-purple-600 border border-purple-200',
        default: 'theme-draw-button hover:text-purple-600'
      }
    }
  ] as const;

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {tools.map(tool => (
          <button
            key={tool.type}
            disabled={isDrawing && tool.type !== 'click'}
            onClick={() => handleDrawButtonClick(tool.type as 'point' | 'polygon' | 'click')}
            className={`
              flex flex-col items-center justify-center gap-1 h-12 w-full
              transition-colors duration-200 rounded-md
              ${drawMode === tool.type ? tool.classes.active : tool.classes.default}
              ${isDrawing && tool.type !== 'click' ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={tool.tooltip}
          >
            <tool.Icon className="h-3 w-3" />
            <span className="text-xs font-medium">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Updated visibility condition based on actual state values */}
      {drawMode === 'click' && hasSelectedFeature && selectedCount > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onSelectionComplete}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Complete Selection {selectedCount > 0 && `(${selectedCount} areas)`}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DrawingTools;