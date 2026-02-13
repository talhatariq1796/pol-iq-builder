// utils/createDublinLayer.ts
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import Color from "@arcgis/core/Color";

export const createDublinVehicleLayer = () => {
  const dublinWhereClause = "COUNTY = 'DUBLIN'";
  
  const symbol = new SimpleFillSymbol({
    color: new Color([51, 168, 82, 0.4]),
    outline: {
      color: new Color([51, 168, 82, 1]),
      width: 2
    }
  });

  const renderer = new SimpleRenderer({
    symbol
  });

  return new FeatureLayer({
    url: "https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/sales_kms/FeatureServer/0",
    outFields: ["*"],
    visible: false, // Start hidden so layer control can manage visibility
    title: "Dublin Vehicle Analysis",
    definitionExpression: dublinWhereClause,
    legendEnabled: true,
    listMode: "show", // Make sure it shows in the layer list
    popupEnabled: true,
    popupTemplate: new PopupTemplate({
      title: "Dublin Vehicle Analysis",
      outFields: ["*"],
      content: [
        {
          type: "custom",
          creator: () => {
            const container = document.createElement("div");
            container.className = "dublin-popup-container";
            return container;
          }
        }
      ]
    }),
    renderer
  });
};