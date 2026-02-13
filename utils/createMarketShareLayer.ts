// utils/createMarketShareLayer.ts
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import Color from "@arcgis/core/Color";

export const createMarketShareLayer = () => {
  const dublinSymbol = new SimpleFillSymbol({
    color: new Color([51, 168, 82, 0.4]),
    outline: {
      color: new Color([51, 168, 82, 1]),
      width: 2
    }
  });

  const otherCountiesSymbol = new SimpleFillSymbol({
    color: new Color([200, 200, 200, 0.4]),
    outline: {
      color: new Color([128, 128, 128, 1]),
      width: 1
    }
  });

  const renderer = new UniqueValueRenderer({
    field: "COUNTY",
    defaultSymbol: otherCountiesSymbol,
    uniqueValueInfos: [{
      value: "DUBLIN",
      symbol: dublinSymbol
    }]
  });

  // Create field infos for the popup
  const fieldInfos = [
    {
      fieldName: "COUNTY",
      label: "County"
    },
    {
      fieldName: "F2023Diesel",
      label: "Diesel 2023",
      format: {
        digitSeparator: true
      }
    },
    {
      fieldName: "F2023DandE",
      label: "Diesel Hybrid 2023",
      format: {
        digitSeparator: true
      }
    },
    {
      fieldName: "F2023E",
      label: "Electric 2023",
      format: {
        digitSeparator: true
      }
    },
    {
      fieldName: "F2023P",
      label: "Petrol 2023",
      format: {
        digitSeparator: true
      }
    },
    {
      fieldName: "F2023PE",
      label: "Petrol Hybrid 2023",
      format: {
        digitSeparator: true
      }
    },
    {
      fieldName: "km2022",
      label: "Average KM 2022",
      format: {
        digitSeparator: true,
        places: 1
      }
    }
  ];

  return new FeatureLayer({
    url: "https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/sales_kms/FeatureServer/0",
    outFields: ["*"],
    visible: false,
    title: "Market Share",
    renderer,
    popupTemplate: {
      title: "{COUNTY}",
      content: [
        {
          type: "custom",
          creator: () => {
            const container = document.createElement("div");
            container.className = "market-share-popup-container";
            return container;
          }
        }
      ]
    }
  });
};