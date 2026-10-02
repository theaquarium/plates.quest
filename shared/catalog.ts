import { REGION_IDS, type PlateJurisdiction, type RegionId } from "./types";

export const REGION_DETAILS: Record<RegionId, { name: string }> = {
  us: { name: "United States" },
  canada: { name: "Canada" },
  mexico: { name: "Mexico" },
  europe: { name: "Europe"},
};

function region(
  regionId: RegionId,
  entries: ReadonlyArray<readonly [code: string, name: string]>,
): PlateJurisdiction[] {
  return entries.map(([code, name]) => ({
    id: `${regionId}-${code.toLowerCase()}`,
    code,
    name,
    region: regionId,
  }));
}

export const PLATES: PlateJurisdiction[] = [
  ...region("us", [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
    ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
    ["DC", "Washington, DC"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
    ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
    ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
    ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
    ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
    ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
    ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
    ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
    ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
    ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
    ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ]),
  ...region("canada", [
    ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
    ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"],
    ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"],
    ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"],
    ["YT", "Yukon"],
  ]),
  ...region("mexico", [
    ["AGS", "Aguascalientes"], ["BC", "Baja California"], ["BCS", "Baja California Sur"],
    ["CAM", "Campeche"], ["CHP", "Chiapas"], ["CHH", "Chihuahua"], ["CMX", "Mexico City"],
    ["COA", "Coahuila"], ["COL", "Colima"], ["DUR", "Durango"], ["GUA", "Guanajuato"],
    ["GRO", "Guerrero"], ["HID", "Hidalgo"], ["JAL", "Jalisco"], ["MEX", "State of Mexico"],
    ["MIC", "Michoacan"], ["MOR", "Morelos"], ["NAY", "Nayarit"], ["NLE", "Nuevo Leon"],
    ["OAX", "Oaxaca"], ["PUE", "Puebla"], ["QUE", "Queretaro"], ["ROO", "Quintana Roo"],
    ["SLP", "San Luis Potosi"], ["SIN", "Sinaloa"], ["SON", "Sonora"], ["TAB", "Tabasco"],
    ["TAM", "Tamaulipas"], ["TLA", "Tlaxcala"], ["VER", "Veracruz"], ["YUC", "Yucatan"],
    ["ZAC", "Zacatecas"],
  ]),
  ...region("europe", [
    ["AL", "Albania"], ["AND", "Andorra"], ["AM", "Armenia"], ["A", "Austria"],
    ["AZ", "Azerbaijan"], ["BY", "Belarus"], ["B", "Belgium"], ["BIH", "Bosnia and Herzegovina"],
    ["BG", "Bulgaria"], ["HR", "Croatia"], ["CY", "Cyprus"], ["CZ", "Czechia"],
    ["DK", "Denmark"], ["EST", "Estonia"], ["FIN", "Finland"], ["FO", "Faroe Islands"],
    ["F", "France"], ["GE", "Georgia"], ["D", "Germany"], ["GBZ", "Gibraltar"],
    ["GR", "Greece"], ["GBG", "Guernsey"], ["H", "Hungary"], ["IS", "Iceland"],
    ["IRL", "Ireland"], ["I", "Italy"], ["GBJ", "Jersey"], ["RKS", "Kosovo"],
    ["LV", "Latvia"], ["FL", "Liechtenstein"], ["LT", "Lithuania"], ["L", "Luxembourg"],
    ["M", "Malta"], ["MD", "Moldova"], ["MC", "Monaco"], ["MNE", "Montenegro"],
    ["NL", "Netherlands"], ["NMK", "North Macedonia"], ["N", "Norway"], ["PL", "Poland"],
    ["P", "Portugal"], ["RO", "Romania"], ["RUS", "Russia"], ["RSM", "San Marino"],
    ["SRB", "Serbia"], ["SK", "Slovakia"], ["SLO", "Slovenia"], ["E", "Spain"],
    ["S", "Sweden"], ["CH", "Switzerland"], ["TR", "Turkey"], ["UA", "Ukraine"],
    ["UK", "United Kingdom"], ["V", "Vatican City"],
  ]),
];

export const PLATES_BY_REGION = Object.fromEntries(
  REGION_IDS.map((regionId) => [regionId, PLATES.filter((plate) => plate.region === regionId)]),
) as Record<RegionId, PlateJurisdiction[]>;

export const PLATE_BY_ID = new Map(PLATES.map((plate) => [plate.id, plate]));

export function platesForRegions(regions: RegionId[]): PlateJurisdiction[] {
  const selected = new Set(regions);
  return PLATES.filter((plate) => selected.has(plate.region));
}
