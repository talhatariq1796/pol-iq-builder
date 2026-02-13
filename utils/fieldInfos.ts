//import type { Field } from '../components/LayerController/LayerController';

export const createDemographicFieldInfos = () => {
  const fieldInfos = [
    {
      fieldName: "SMALL_AREA",
      label: "Small Area"
    },
    {
      fieldName: "EDNAME",
      label: "Electoral Division"
    },
    {
      fieldName: "COUNTY",
      label: "County"
    }
  ];

  return fieldInfos;
};

export const createVehicleFieldInfos = () => {
  const yearFields: Record<string, string[]> = {
    'Diesel': ['F2018Diesel', 'F2019Diesel', 'F2020Diesel', 'F2021Diesel', 'F2022Diesel', 'F2023Diesel', 'ChangeDiesel'],
    'Diesel Hybrid': ['F2018DandE', 'F2019DandE', 'F2020DandE', 'F2021DandE', 'F2022DandE', 'F2023DandE', 'ChangeDandE'],
    'Diesel Plug-in': ['F2018DPHE', 'F2019DPHE', 'F2020DPHE', 'F2021DPHE', 'F2022DPHE', 'F2023DPHE', 'ChangeDPHE'],
    'Electric': ['F2018E', 'F2019E', 'F2020E', 'F2021E', 'F2022E', 'F2023E', 'ChangeE'],
    'Ethanol-Petrol': ['F2018EP', 'F2019EP', 'F2020EP', 'F2021EP', 'F2022EP', 'F2023EP', 'ChangeEP'],
    'Gas': ['F2018GAS', 'F2019GAS', 'F2020GAS', 'F2021GAS', 'F2022GAS', 'F2023GAS', 'ChangeGAS'],
    'Other': ['F2018O', 'F2019O', 'F2020O', 'F2021O', 'F2022O', 'F2023O', 'ChangeO'],
    'Petrol': ['F2018P', 'F2019P', 'F2020P', 'F2021P', 'F2022P', 'F2023P', 'ChangeP'],
    'Petrol Hybrid': ['F2018PE', 'F2019PE', 'F2020PE', 'F2021PE', 'F2022PE', 'F2023PE', 'ChangePE'],
    'Petrol Plug-in': ['F2018PPHE', 'F2019PPHE', 'F2020PPHE', 'F2021PPHE', 'F2022PPHE', 'F2023PPHE', 'ChangePPHE']
  };

  const fieldInfos = [
    {
      fieldName: "COUNTY",
      label: "County"
    },
    {
      fieldName: "km2020",
      label: "Avg Kilometers 2020",
      format: {
        places: 1,
        digitSeparator: true
      }
    },
    {
      fieldName: "km2021",
      label: "Avg Kilometers 2021",
      format: {
        places: 1,
        digitSeparator: true
      }
    },
    {
      fieldName: "km2022",
      label: "Avg Kilometers 2022",
      format: {
        places: 1,
        digitSeparator: true
      }
    },
    {
      fieldName: "kmchange",
      label: "Kilometers % Change",
      format: {
        places: 1,
        digitSeparator: true
      }
    }
  ];

  Object.entries(yearFields).forEach(([type, fields]) => {
    fields.forEach(field => {
      fieldInfos.push({
        fieldName: field,
        label: field.startsWith('Change') ? `${type} % Change` : `${type} ${field.slice(1, 5)}`,
        format: {
          places: field.startsWith('Change') ? 1 : 0,
          digitSeparator: true
        }
      });
    });
  });

  return fieldInfos;
};