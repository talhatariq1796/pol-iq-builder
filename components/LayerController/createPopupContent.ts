// src/components/LayerController/createPopupContent.ts
import type { LayerField } from '@/types/layers';

// Define the PopupContent type based on ArcGIS API structure
interface PopupFieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    places?: number;
    digitSeparator?: boolean;
  };
}

interface PopupContent {
  type: "fields";
  fieldInfos: PopupFieldInfo[];
}

export const createPopupContent = (fields: LayerField[]): PopupContent[] => {
  return [{
    type: "fields",
    fieldInfos: fields.map(field => ({
      fieldName: field.name,
      label: field.label || field.name,
      visible: true,
      format: field.format
    }))
  }];
};