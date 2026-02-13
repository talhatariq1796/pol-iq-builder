import React, { useEffect, useRef } from 'react';
import Graphic from '@arcgis/core/Graphic';
import FieldDisplay from './FieldDisplay';
import { PopupField } from '../../types/popup-config';
import './popup-styles.css';

interface PopupContentProps {
  feature: Graphic;
  fields: PopupField[];
  title: string;
  onClose: () => void;
}

const PopupContent: React.FC<PopupContentProps> = ({
  feature,
  fields,
  title,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);



  // Ensure the popup content is fully visible after mount and on updates
  useEffect(() => {
    if (containerRef.current) {
      // Force a repaint to ensure visibility
      containerRef.current.style.display = 'none';
      // Trigger reflow by reading offsetHeight
      void containerRef.current.offsetHeight;
      containerRef.current.style.display = 'flex';
      
      // Ensure the container is fully visible
      setTimeout(() => {
        const parentPopup = containerRef.current?.closest('.esri-popup__main-container');
        if (parentPopup instanceof HTMLElement) {
          const rect = parentPopup.getBoundingClientRect();
          if (rect.top < 50) {
            parentPopup.style.top = '60px';
          }
          if (rect.height > window.innerHeight - 100) {
            parentPopup.style.maxHeight = `${window.innerHeight - 100}px`;
          }
        }
      }, 50);
    }
  }, [feature]);

  // Generate default fields if none provided
  const getDefaultFields = (): PopupField[] => {
    if (!feature.attributes) return [];
    
    const skipFields = ['OBJECTID', 'FID', 'Shape', 'Shape_Length', 'Shape_Area'];
    return Object.keys(feature.attributes)
      .filter(key => !skipFields.includes(key) && !key.toLowerCase().includes('shape'))
      .map(key => ({
        fieldName: key,
        label: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
        decimals: typeof feature.attributes[key] === 'number' ? 2 : undefined
      }));
  };
  
  // Use default fields if no fields provided
  const displayFields = fields.length > 0 ? fields : getDefaultFields();
  
  return (
    <div ref={containerRef} className="popup-content-container">
      <div className="popup-header">
        <h3 className="popup-title">{title || 'Feature Information'}</h3>
        <button className="popup-close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="popup-body">
        {feature.attributes && Object.keys(feature.attributes).length > 0 ? (
          <FieldDisplay 
            feature={feature} 
            fields={displayFields} 
          />
        ) : (
          <div className="popup-no-data">No information available</div>
        )}
      </div>
    </div>
  );
};

export default PopupContent; 