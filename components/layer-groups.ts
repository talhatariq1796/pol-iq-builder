// Export all the interfaces first
export interface LayerFields {
  count?: string;
  percent?: string;
  amount?: string;
  average?: string;
  alias: Record<string, string>;
  description: { [key: string]: string };
}

export interface LayerConfig {
  id: string;
  url: string;
  title: string;
  description: string;
  group: string;
  fields: LayerFields;
}

export interface LayerGroup {
  id: string;
  title: string;
  layers: LayerConfig[];
}

// Copy the entire RAW_LAYER_GROUPS constant from your file
export const RAW_LAYER_GROUPS: LayerGroup[] = [
    {
      id: 'stores',
      title: 'Stores',
      layers: [
        {
          id: 'home-depot',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__747a50bd306c4fec/FeatureServer/1',
          title: 'Home Depot',
          description: 'Home Depot store locations',
          group: 'stores',
          fields: {
            count: 'name',
            percent: 'address',
            alias: {
              'name': 'Store Name',
              'address': 'Address'
            },
            description: {
              'name': 'Store location name',
              'address': 'Store address'
            }
          }
        },
        {
          id: 'lowes',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__747a50bd306c4fec/FeatureServer/0',
          title: 'Lowes',
          description: 'Lowes store locations',
          group: 'stores',
          fields: {
            count: 'name',
            percent: 'address',
            alias: {
              'name': 'Store Name',
              'address': 'Address'
            },
            description: {
              'name': 'Store location name',
              'address': 'Store address'
            }
          }
        }
      ]
    },
    {
      id: 'spending',
      title: 'Spending',
      layers: [
        {
          id: 'window-ac-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/0',
          title: '2024 Window Air Conditioners',
          description: 'Window air conditioner spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4070_X_I',
            alias: {
              'X4070_X_I': 'Spending Index'
            },
            description: {
              'X4070_X_I': 'Index of spending on window air conditioners'
            }
          }
        },
        {
          id: 'window-ac-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/13',
          title: '2029 Window Air Conditioners',
          description: 'Projected window air conditioner spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4070FY_X_I',
            alias: {
              'X4070FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4070FY_X_I': 'Projected index of spending on window air conditioners'
            }
          }
        },
        {
          id: 'microwave-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/2',
          title: '2024 Microwave Ovens',
          description: 'Microwave oven spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4069_X_I',
            alias: {
              'X4069_X_I': 'Spending Index'
            },
            description: {
              'X4069_X_I': 'Index of spending on microwave ovens'
            }
          }
        },
        {
          id: 'microwave-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/1',
          title: '2029 Microwave Ovens',
          description: 'Projected microwave oven spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4069FY_X_I',
            alias: {
              'X4069FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4069FY_X_I': 'Projected index of spending on microwave ovens'
            }
          }
        },
        {
          id: 'stoves-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/4',
          title: '2024 Cooking Stoves & Ovens',
          description: 'Cooking stoves and ovens spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4068_X_I',
            alias: {
              'X4068_X_I': 'Spending Index'
            },
            description: {
              'X4068_X_I': 'Index of spending on cooking stoves and ovens'
            }
          }
        },
        {
          id: 'stoves-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/3',
          title: '2029 Cooking Stoves & Ovens',
          description: 'Projected cooking stoves and ovens spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4068FY_X_I',
            alias: {
              'X4068FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4068FY_X_I': 'Projected index of spending on cooking stoves and ovens'
            }
          }
        },
        {
          id: 'laundry-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/6',
          title: '2024 Washers & Dryers',
          description: 'Clothes washers and dryers spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4110_X_I',
            alias: {
              'X4110_X_I': 'Spending Index'
            },
            description: {
              'X4110_X_I': 'Index of spending on clothes washers and dryers'
            }
          }
        },
        {
          id: 'laundry-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/5',
          title: '2029 Washers & Dryers',
          description: 'Projected clothes washers and dryers spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4110FY_X_I',
            alias: {
              'X4110FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4110FY_X_I': 'Projected index of spending on clothes washers and dryers'
            }
          }
        },
        {
          id: 'refrigeration-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/8',
          title: '2024 Refrigerators & Freezers',
          description: 'Refrigerators and freezers spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4065_X_I',
            alias: {
              'X4065_X_I': 'Spending Index'
            },
            description: {
              'X4065_X_I': 'Index of spending on refrigerators and freezers'
            }
          }
        },
        {
          id: 'refrigeration-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/7',
          title: '2029 Refrigerators & Freezers',
          description: 'Projected refrigerators and freezers spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4065FY_X_I',
            alias: {
              'X4065FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4065FY_X_I': 'Projected index of spending on refrigerators and freezers'
            }
          }
        },
        {
          id: 'dishwasher-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/10',
          title: '2024 Dishwashers & Disposals',
          description: 'Dishwashers, disposals, and range hoods spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4064_X_I',
            alias: {
              'X4064_X_I': 'Spending Index'
            },
            description: {
              'X4064_X_I': 'Index of spending on dishwashers, disposals, and range hoods'
            }
          }
        },
        {
          id: 'dishwasher-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/9',
          title: '2029 Dishwashers & Disposals',
          description: 'Projected dishwashers, disposals, and range hoods spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4064FY_X_I',
            alias: {
              'X4064FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4064FY_X_I': 'Projected index of spending on dishwashers, disposals, and range hoods'
            }
          }
        },
        {
          id: 'major-appliances-2024',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/12',
          title: '2024 Major Appliances',
          description: 'Major appliances spending index for 2024',
          group: 'spending',
          fields: {
            count: 'X4063_X_I',
            alias: {
              'X4063_X_I': 'Spending Index'
            },
            description: {
              'X4063_X_I': 'Index of spending on major appliances'
            }
          }
        },
        {
          id: 'major-appliances-2029',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__f220d3bf55cb4012/FeatureServer/11',
          title: '2029 Major Appliances',
          description: 'Projected major appliances spending index for 2029',
          group: 'spending',
          fields: {
            count: 'X4063FY_X_I',
            alias: {
              'X4063FY_X_I': 'Projected Spending Index'
            },
            description: {
              'X4063FY_X_I': 'Projected index of spending on major appliances'
            }
          }
        }
      ]
    },
    {
      id: 'demographics',
      title: 'Demographics & Behavior',
      layers: [
        {
          id: 'gas-range',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__aa43ed202d8b4de1/FeatureServer/0',
          title: 'Gas Range Ownership',
          description: 'Households that own a built-in gas range or oven',
          group: 'demographics',
          fields: {
            count: 'MP16074H_B_I',
            alias: {
              'MP16074H_B_I': 'Ownership Index'
            },
            description: {
              'MP16074H_B_I': 'Index of households owning a built-in gas range or oven'
            }
          }
        },
        {
          id: 'electric-range',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__aa43ed202d8b4de1/FeatureServer/1',
          title: 'Electric Range Ownership',
          description: 'Households that own a built-in electric range or oven',
          group: 'demographics',
          fields: {
            count: 'MP16073H_B_I',
            alias: {
              'MP16073H_B_I': 'Ownership Index'
            },
            description: {
              'MP16073H_B_I': 'Index of households owning a built-in electric range or oven'
            }
          }
        },
        {
          id: 'recent-buyers',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__aa43ed202d8b4de1/FeatureServer/2',
          title: 'Recent Appliance Buyers',
          description: 'Households that bought a large kitchen appliance in the last 12 months',
          group: 'demographics',
          fields: {
            count: 'MP16061H_B_I',
            alias: {
              'MP16061H_B_I': 'Recent Buyers Index'
            },
            description: {
              'MP16061H_B_I': 'Index of households that recently purchased large kitchen appliances'
            }
          }
        },
        {
          id: 'recent-movers',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__aa43ed202d8b4de1/FeatureServer/3',
          title: 'Recent Movers',
          description: 'Households that moved in 2021 or later',
          group: 'demographics',
          fields: {
            percent: 'ACSOMV2021_P',
            alias: {
              'ACSOMV2021_P': 'Recent Movers Percentage'
            },
            description: {
              'ACSOMV2021_P': 'Percentage of households that moved in 2021 or later'
            }
          }
        },
        {
          id: 'housing-units',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__aa43ed202d8b4de1/FeatureServer/4',
          title: 'Housing Units',
          description: 'Total number of housing units',
          group: 'demographics',
          fields: {
            count: 'TSHU23_CY',
            alias: {
              'TSHU23_CY': 'Housing Units'
            },
            description: {
              'TSHU23_CY': 'Total number of housing units in the area'
            }
          }
        }
      ]
    },
    {
      id: 'store-expenditure',
      title: 'Store Expenditure',
      layers: [
        {
          id: 'appliance-stores',
          url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__2b66b7828a8341fd/FeatureServer/0',
          title: 'Appliance Store Spending',
          description: 'Expenditure index for appliance stores',
          group: 'store-expenditure',
          fields: {
            count: 'IND443_X_I',
            alias: {
              'IND443_X_I': 'Store Spending Index'
            },
            description: {
              'IND443_X_I': 'Index of consumer spending at appliance stores'
            }
          }
        }
      ]
    }
];

// Create sorted version of layer groups
export const LAYER_GROUPS = RAW_LAYER_GROUPS.map(group => ({
  ...group,
  layers: [...group.layers].sort((a, b) => a.title.localeCompare(b.title))
})); 