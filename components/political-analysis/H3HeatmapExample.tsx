/**
 * H3HeatmapExample Component
 *
 * Example implementation showing how to use H3HeatmapLayer with controls.
 * This demonstrates the complete integration pattern for political heatmap visualization.
 */

'use client';

import { useState } from 'react';
import {
  H3HeatmapLayer,
  H3HeatmapControls,
  type H3Metric,
} from './H3HeatmapLayer';

interface H3HeatmapExampleProps {
  view: __esri.MapView;
}

export function H3HeatmapExample({ view }: H3HeatmapExampleProps) {
  const [metric, setMetric] = useState<H3Metric>('partisan_lean');
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [cellData, setCellData] = useState<any | null>(null);

  const handleCellClick = (h3Index: string, data: any) => {
    setSelectedCell(h3Index);
    setCellData(data);
    console.log('Cell clicked:', { h3Index, data });
  };

  const handleCellHover = (h3Index: string | null, data: any | null) => {
    setHoveredCell(h3Index);
    if (h3Index) {
      console.log('Cell hovered:', { h3Index, data });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* H3 Heatmap Layer */}
      <H3HeatmapLayer
        view={view}
        metric={metric}
        visible={visible}
        opacity={opacity}
        onCellClick={handleCellClick}
        onCellHover={handleCellHover}
      />

      {/* Controls Panel - Position in top-right corner */}
      <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <H3HeatmapControls
          metric={metric}
          onMetricChange={setMetric}
          visible={visible}
          onVisibilityChange={setVisible}
          opacity={opacity}
          onOpacityChange={setOpacity}
        />
      </div>

      {/* Selected Cell Info - Position in bottom-left corner */}
      {selectedCell && cellData && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-sm">Selected Cell</h3>
            <button
              onClick={() => {
                setSelectedCell(null);
                setCellData(null);
              }}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">H3 Index:</span>
              <span className="font-mono">{selectedCell}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Precincts:</span>
              <span>{cellData.precinct_count || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Population:</span>
              <span>{cellData.total_population?.toLocaleString() || 'N/A'}</span>
            </div>
            {cellData.partisan_lean !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600">Partisan Lean:</span>
                <span
                  className={
                    cellData.partisan_lean >= 0 ? 'text-blue-600' : 'text-red-600'
                  }
                >
                  {cellData.partisan_lean >= 0 ? 'D' : 'R'}+
                  {Math.abs(cellData.partisan_lean).toFixed(1)}
                </span>
              </div>
            )}
            {cellData.gotv_priority !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600">GOTV Priority:</span>
                <span>{cellData.gotv_priority.toFixed(1)}</span>
              </div>
            )}
            {cellData.persuasion_opportunity !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600">Persuasion:</span>
                <span>{cellData.persuasion_opportunity.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hover Tooltip - Follows cursor */}
      {hoveredCell && hoveredCell !== selectedCell && (
        <div className="absolute pointer-events-none bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
          {hoveredCell}
        </div>
      )}
    </div>
  );
}

export default H3HeatmapExample;
