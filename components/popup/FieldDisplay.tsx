import React from 'react';
import Graphic from '@arcgis/core/Graphic';
import { PopupField } from '../../types/popup-config';
import './popup-styles.css';

interface FieldDisplayProps {
  feature: Graphic;
  fields: PopupField[];
  displayType?: 'list' | 'table' | 'custom';
}

const FieldDisplay: React.FC<FieldDisplayProps> = ({
  feature,
  fields,
  displayType = 'list'
}) => {
  if (!feature || !fields || fields.length === 0) {
    return <div className="field-display-empty">No fields to display</div>;
  }

  // Function to get field value based on field configuration
  const getFieldValue = (field: PopupField) => {
    // If custom formatter is provided, use it
    if (field.formatter) {
      return field.formatter(feature);
    }

    // Get value from feature attributes
    let value = field.fieldName ? feature.attributes[field.fieldName] : null;
    
    // Apply transformation if needed
    if (field.transform && value !== null && value !== undefined) {
      value = field.transform(value);
    }
    
    // Format value based on field type
    if (value === null || value === undefined) {
      return field.nullValue || 'N/A';
    }
    
    if (typeof value === 'number') {
      if (field.decimals !== undefined) {
        return value.toFixed(field.decimals);
      }
      return value.toString();
    }
    
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    return value.toString();
  };

  // Render field values based on display type
  if (displayType === 'table') {
    return (
      <div className="field-display field-display-table">
        <table className="field-table">
          <thead>
            <tr>
              {fields.map((field, index) => (
                <th key={index}>{field.label || field.fieldName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {fields.map((field, index) => (
                <td key={index}>{getFieldValue(field)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Default list display
  return (
    <div className="field-display field-display-list">
      <div className="field-list">
        {fields.map((field, index) => (
          <div key={index} className="field-item">
            <div className="field-name">{field.label || field.fieldName}</div>
            <div className="field-value">{getFieldValue(field)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldDisplay; 