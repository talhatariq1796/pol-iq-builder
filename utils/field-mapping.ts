import { LayerField } from '../types/geospatial-ai-types';
import { FieldMappingHelper } from './visualizations/field-mapping-helper';

export interface FieldMappingOptions {
  includeUnmappedFields?: boolean;
}

interface PopupFieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: any;
}

/**
 * Maps feature attributes to standardized fields based on layer configuration
 */
export function mapFeatureFields(
  feature: { properties?: any; attributes?: any; rendererField?: string; rendererValue?: any },
  configuredFields?: LayerField[],
  options: FieldMappingOptions = {}
): { [key: string]: any } {
  console.log('=== Field Mapping Start ===', {
    hasProperties: !!feature.properties,
    hasAttributes: !!feature.attributes,
    rendererField: feature.rendererField,
    configuredFields: configuredFields?.map(f => ({
      name: f.name,
      type: f.type,
      label: f.label
    }))
  });

  // Combine all possible sources of attributes
  const combinedAttributes = {
    ...feature.properties,
    ...feature.attributes,
    ...(feature.rendererField && feature.rendererValue ? { [feature.rendererField]: feature.rendererValue } : {})
  };

  // Create standardized attributes
  const standardizedAttributes: { [key: string]: any } = {};

  // Process configured fields first
  if (configuredFields?.length) {
    configuredFields.forEach(field => {
      // Get all possible names for this field
      const possibleNames = [
        field.name,
        field.alias,
        field.label,
        ...(field.alternateNames || [])
      ].filter((name): name is string => typeof name === 'string');

      // Try exact matches first
      let found = false;
      for (const name of possibleNames) {
        if (name in combinedAttributes) {
          const value = combinedAttributes[name];
          // Convert and validate the value based on field type
          standardizedAttributes[field.name] = convertFieldValue(value, field.type);
          if (name !== field.name) {
            standardizedAttributes[name] = value; // Preserve original field name and value
          }
          console.log(`Mapped field ${field.name}:`, {
            originalName: name,
            originalValue: value,
            convertedValue: standardizedAttributes[field.name],
            fieldType: field.type
          });
          found = true;
          break;
        }
      }

      // If no exact match, try case-insensitive matching
      if (!found) {
        const lowerCaseFields = Object.keys(combinedAttributes).map(k => k.toLowerCase());
        for (const name of possibleNames) {
          const lowerName = name.toLowerCase();
          const index = lowerCaseFields.indexOf(lowerName);
          if (index !== -1) {
            const originalKey = Object.keys(combinedAttributes)[index];
            const value = combinedAttributes[originalKey];
            standardizedAttributes[field.name] = convertFieldValue(value, field.type);
            if (originalKey !== field.name) {
              standardizedAttributes[originalKey] = value;
            }
            console.log(`Case-insensitive mapped field ${field.name}:`, {
              originalName: originalKey,
              originalValue: value,
              convertedValue: standardizedAttributes[field.name],
              fieldType: field.type
            });
            break;
          }
        }
      }
    });
  }

  // Include unmapped fields if requested
  if (options.includeUnmappedFields) {
    Object.entries(combinedAttributes).forEach(([key, value]) => {
      if (!(key in standardizedAttributes)) {
        // Try to determine field type for unmapped fields
        let fieldType: LayerField['type'] = 'string';
        if (typeof value === 'number') {
          fieldType = Number.isInteger(value) ? 'integer' : 'double';
        } else if (value instanceof Date) {
          fieldType = 'date';
        }
        standardizedAttributes[key] = convertFieldValue(value, fieldType);
      }
    });
  }

  console.log('=== Field Mapping Result ===', {
    mappedFields: Object.keys(standardizedAttributes),
    numericFields: Object.entries(standardizedAttributes)
      .filter(([_, v]) => typeof v === 'number')
      .map(([k]) => k)
  });

  return standardizedAttributes;
}

/**
 * Converts a field value to the appropriate type
 */
export function convertFieldValue(value: any, type: LayerField['type']): any {
  if (value === null || value === undefined) {
    return value;
  }

  switch (type) {
    case 'integer':
    case 'small-integer':
      return Math.round(Number(value));
    case 'double':
    case 'single':
      return Number(value);
    case 'date':
      return value instanceof Date ? value : new Date(value);
    case 'string':
      return String(value);
    default:
      return value;
  }
}

/**
 * Creates ArcGIS field definitions from feature attributes
 */
export function createFieldDefinitions(
  attributes: { [key: string]: any },
  configuredFields?: LayerField[]
): __esri.FieldProperties[] {
  const fields: __esri.FieldProperties[] = [
    {
      name: "OBJECTID",
      type: "oid"
    }
  ];

  // Add configured fields first
  if (configuredFields?.length) {
    configuredFields.forEach(field => {
      if (field.name !== "OBJECTID") {
        fields.push({
          name: field.name,
          type: field.type,
          alias: field.alias || field.label || field.name
        });
      }
    });
  }

  // Add any remaining fields from attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key !== "OBJECTID" && !fields.some(f => f.name === key)) {
      let fieldType: LayerField['type'];
      
      if (typeof value === 'number') {
        fieldType = Number.isInteger(value) ? "integer" : "double";
      } else if (typeof value === 'boolean') {
        fieldType = "small-integer";
      } else if (value instanceof Date) {
        fieldType = "date";
      } else {
        fieldType = "string";
      }

      fields.push({
        name: key,
        type: fieldType,
        alias: key
      });
    }
  });

  return fields;
}

/**
 * Creates popup template field infos from field definitions
 */
export function createPopupFieldInfos(
  fields: __esri.FieldProperties[],
  configuredFields?: LayerField[]
): PopupFieldInfo[] {
  return fields
    .filter((field): field is __esri.FieldProperties & { name: string; type: string } => 
      field.type !== "oid" && typeof field.name === "string"
    )
    .map(field => {
      const configField = configuredFields?.find(f => f.name === field.name);
      return {
        fieldName: field.name,
        label: configField?.label || FieldMappingHelper.getFriendlyFieldName(field.name) || field.alias || field.name,
        visible: true,
        format: getFieldFormat(field.type)
      };
    });
}

/**
 * Gets appropriate format configuration for field type
 */
function getFieldFormat(fieldType: string): any {
  switch (fieldType) {
    case "double":
    case "single":
      return {
        places: 2,
        digitSeparator: true
      };
    case "integer":
    case "small-integer":
      return {
        places: 0,
        digitSeparator: true
      };
    case "date":
      return {
        dateFormat: "short-date-short-time"
      };
    default:
      return undefined;
  }
} 