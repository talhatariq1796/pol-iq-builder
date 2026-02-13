import { createContext, useContext, ReactNode } from 'react';
import MapView from '@arcgis/core/views/MapView';

interface MapContextType {
  view: MapView | null;
}

const MapContext = createContext<MapContextType>({ view: null });

export const MapProvider = ({ children, view }: { children: ReactNode; view: MapView }) => {
  return (
    <MapContext.Provider value={{ view }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
}; 