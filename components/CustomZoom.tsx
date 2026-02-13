import React from 'react';
import type MapView from '@arcgis/core/views/MapView';
import { Plus, Minus } from 'lucide-react';

interface CustomZoomProps {
  view: MapView;
  sidebarWidth: number;
}

const CustomZoom: React.FC<CustomZoomProps> = ({ view, sidebarWidth }) => {
  const handleZoomIn = () => {
    if (view) {
      const targetZoom = view.zoom + 1;
      view.goTo({
        zoom: targetZoom
      }, {
        duration: 200,
        easing: "ease-out"
      });
    }
  };

  const handleZoomOut = () => {
    if (view) {
      const targetZoom = view.zoom - 1;
      view.goTo({
        zoom: targetZoom
      }, {
        duration: 200,
        easing: "ease-out"
      });
    }
  };

  return (
    <div
      className="custom-zoom-control"
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '84px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 1000
      }}
    >
      <button
        onClick={handleZoomIn}
        className="w-8 h-8 flex items-center justify-center theme-bg-primary border theme-border-primary rounded-t-md hover:theme-bg-tertiary focus:outline-none focus:ring-0 focus:theme-border-primary"
        aria-label="Zoom in"
      >
        <Plus className="h-4 w-4 theme-text-primary" />
      </button>
      <button
        onClick={handleZoomOut}
        className="w-8 h-8 flex items-center justify-center theme-bg-primary border theme-border-primary rounded-b-md hover:theme-bg-tertiary focus:outline-none focus:ring-0 focus:theme-border-primary"
        aria-label="Zoom out"
      >
        <Minus className="h-4 w-4 theme-text-primary" />
      </button>
    </div>
  );
};

export default CustomZoom;
