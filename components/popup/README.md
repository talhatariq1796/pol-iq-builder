# Enhanced Popup Components

This directory contains advanced React components for creating and managing popups in an ArcGIS MapView.

## Components

### CustomPopupManager

This component provides a more advanced and customizable popup experience, replacing the default ArcGIS popup with a custom-styled, React-based popup.

#### Key Features

- Custom popup styling with CSS
- Action buttons (e.g., "Zoom to," "Infographics")
- Charting integration (e.g., bar charts)
- Custom content rendering

#### Usage

To use the `CustomPopupManager`, import it and include it in your map component, providing the necessary `mapView` and `layer` props.

```tsx
import CustomPopupManager from './popup/CustomPopupManager';

// ... inside your component
<CustomPopupManager
          mapView={mapView}
  layer={featureLayer}
          config={popupConfig}
  onPopupOpen={handlePopupOpen}
  onPopupClose={handlePopupClose}
        />
```

### Configuration

The popup's appearance and behavior are controlled through a `PopupConfig` object. This allows you to define:

-   **Title**: The popup title, which can be a string or a function that returns a string.
-   **Fields**: The fields to display, with options for custom labels and formatting.
-   **Actions**: Custom buttons that trigger callbacks when clicked.

```ts
const popupConfig: PopupConfig = {
  title: (feature) => `Details for ${feature.attributes.NAME}`,
  fields: [
    { fieldName: 'POP', label: 'Population' },
    { fieldName: 'AREA', label: 'Area (sq km)' }
  ],
  actions: [
    { label: 'Zoom to', onClick: (feature) => zoomToFeature(feature) },
    { label: 'Infographics', onClick: (feature) => showInfographics(feature) }
  ]
};
```

## Styling

The popups are styled using the `popup-styles.css` file. You can customize the appearance by modifying this file.

Key classes to target:

-   `.custom-popup`: The main container for the custom popup.
-   `.custom-popup-header`: The header section containing the title and close button.
-   `.custom-popup-content`: The body of the popup.
-   `.custom-popup-actions`: The container for action buttons.

## Event Handling

The `CustomPopupManager` provides callbacks for key events:

-   `onPopupOpen`: Fired when a popup is opened.
-   `onPopupClose`: Fired when a popup is closed.
-   `onFeatureSelect`: Fired when a feature is selected.

These can be used to coordinate map interactions with other parts of your application. 