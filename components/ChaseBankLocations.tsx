import React, { useEffect } from 'react';
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";

interface ChaseBankLocationsProps {
  view: __esri.MapView;
  onLayerCreate?: (layer: __esri.FeatureLayer) => void;
}

const ChaseBankLocations: React.FC<ChaseBankLocationsProps> = ({ view, onLayerCreate }) => {
  useEffect(() => {
    if (!view || !onLayerCreate) return;

    const symbol = new PictureMarkerSymbol({
      url: "/chase-bank.png",
      width: "24px",
      height: "24px"
    });

    const popupTemplate = new PopupTemplate({
      title: "Chase Bank",
      content: [
        {
          type: "text",
          text: `
            <strong>Address:</strong> {ADDR}<br/>
            <strong>City:</strong> {CITY}<br/>
            <strong>State:</strong> {STATE}<br/>
            <strong>ZIP:</strong> {ZIP}
          `
        }
      ]
    });

    const chaseLayer = new FeatureLayer({
      url: "https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__b4c281d0f73a4127/FeatureServer/0",
      renderer: new SimpleRenderer({
        symbol: symbol
      }),
      popupTemplate: popupTemplate,
      title: "Chase Bank Locations",
      outFields: ["*"],
      visible: false,
      id: "chase-locations"
    });

    onLayerCreate(chaseLayer);

    return () => {
      if (view?.map) {
        view.map.layers.remove(chaseLayer);
      }
    };
  }, [view, onLayerCreate]); // Only recreate layer if view or callback changes

  return null;
};

export default ChaseBankLocations;