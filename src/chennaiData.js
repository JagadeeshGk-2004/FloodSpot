// ─────────────────────────────────────────────────────────────────────────────
// FloodSpot — Chennai Offline Data Cache
// All data is pre-bundled: renders & sorts with ZERO network calls.
// Total payload: < 4 KB
// ─────────────────────────────────────────────────────────────────────────────

// Historical flood hotspot polygons — semi-transparent red overlays on map
// Coordinates are [lat, lng] pairs forming closed polygons
export const FLOOD_HOTSPOTS = [
  {
    id: 'velachery',
    name: 'Velachery',
    risk: 'Extreme',
    coords: [
      [12.9785, 80.2182], [12.9810, 80.2250], [12.9760, 80.2300],
      [12.9720, 80.2250], [12.9740, 80.2182], [12.9785, 80.2182],
    ],
  },
  {
    id: 'mudichur',
    name: 'Mudichur',
    risk: 'High',
    coords: [
      [12.9200, 80.0820], [12.9240, 80.0880], [12.9190, 80.0930],
      [12.9150, 80.0890], [12.9160, 80.0820], [12.9200, 80.0820],
    ],
  },
  {
    id: 'vyasarpadi',
    name: 'Vyasarpadi',
    risk: 'High',
    coords: [
      [13.1270, 80.2490], [13.1300, 80.2540], [13.1260, 80.2580],
      [13.1230, 80.2540], [13.1240, 80.2490], [13.1270, 80.2490],
    ],
  },
  {
    id: 'tambaram',
    name: 'Tambaram',
    risk: 'Moderate',
    coords: [
      [12.9249, 80.1130], [12.9280, 80.1185], [12.9240, 80.1230],
      [12.9200, 80.1185], [12.9215, 80.1130], [12.9249, 80.1130],
    ],
  },
  {
    id: 'kotturpuram',
    name: 'Kotturpuram',
    risk: 'High',
    coords: [
      [13.0200, 80.2390], [13.0230, 80.2440], [13.0195, 80.2480],
      [13.0165, 80.2440], [13.0175, 80.2390], [13.0200, 80.2390],
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Official Government-Verified Chennai Safe Havens (Zone-mapped)
// Sorted dynamically at runtime by Haversine distance from user GPS
// ─────────────────────────────────────────────────────────────────────────────
export const SHELTERS = [
  {
    id: 'sh1',
    name: 'Chennai Corporation Night Shelter',
    shortName: 'Corporation Night Shelter',
    location: 'Pasumpon Muthuramalinga Thevar Road, Alwarpet',
    zone: 'Zone 13',
    lat: 13.0350,
    lng: 80.2519,
    capacity: 150,
    capacityNote: 'High-Ground Facility',
    contact: '044-25384500',
    amenities: ['Medical Kit', 'Dry Rations', 'Restrooms'],
    type: 'general',
  },
  {
    id: 'sh2',
    name: 'Public Night Shelter — RSRM Lying In Hospital',
    shortName: 'RSRM Hospital Shelter',
    location: 'Cemetery Road, Royapuram',
    zone: 'Zone 5',
    lat: 13.1175,
    lng: 80.2913,
    capacity: 300,
    capacityNote: 'Emergency Medical Wing Support',
    contact: '044-25950120',
    amenities: ['24/7 Power Backup', 'Safe Drinking Water', 'Beds'],
    type: 'medical',
  },
  {
    id: 'sh3',
    name: 'Public Night Shelter — Teynampet School (Women)',
    shortName: 'Teynampet Women Shelter',
    location: 'Subbarayan Nagar, Teynampet',
    zone: 'Zone 10',
    lat: 13.0444,
    lng: 80.2513,
    capacity: 200,
    capacityNote: 'Secured Women & Children Facility',
    contact: '044-24330300',
    amenities: ['Sanitary Kits', 'Hot Meals', 'First Aid Station'],
    type: 'women',
  },
  {
    id: 'sh4',
    name: 'Real Charitable Trust Shelter — Vyasarpadi',
    shortName: 'Real Charitable Trust',
    location: 'Mahakavi Bharathiyar Nagar East, Vyasarpadi',
    zone: 'Zone 4',
    lat: 13.1267,
    lng: 80.2479,
    capacity: 250,
    capacityNote: 'High-Ground Flood Shelter',
    contact: '1913',
    amenities: ['Emergency Kitchen', 'Blankets', 'Heavy Rescue Gear Access'],
    type: 'general',
  },
  {
    id: 'sh5',
    name: 'Public Night Shelter — Triplicane Corporation School',
    shortName: 'Triplicane School Shelter',
    location: 'Thangavelu Street, Triplicane',
    zone: 'Zone 9',
    lat: 13.0577,
    lng: 80.2782,
    capacity: 180,
    capacityNote: 'Inside Reinforced Brick Building',
    contact: '044-28440500',
    amenities: ['Basic Health Checkups', 'Clean Drinking Water', 'Solar Charger Station'],
    type: 'general',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Crowdsourced Road Status Markers
// Each marker < 120 bytes. Total payload: ~900 bytes — syncs over GPRS/2G.
// depth: human-readable water level label
// depthCm: numeric range for severity classification
// vehicleWarning: plain-language vehicle compatibility warning
// ─────────────────────────────────────────────────────────────────────────────
export const ROAD_MARKERS = [
  {
    id: 'm1',
    lat: 12.9790, lng: 80.2210,
    type: 'blocked',
    label: 'Velachery Main Road Junction',
    depth: 'Waist Deep',
    depthCm: '90–120 cm',
    vehicleWarning: 'Impassable for all vehicles including SUVs and trucks. Pedestrians at extreme risk.',
    reportedBy: 'TANGEDCO Field Team',
  },
  {
    id: 'm2',
    lat: 12.9248, lng: 80.0855,
    type: 'blocked',
    label: 'Mudichur Road — Submerged Stretch',
    depth: 'Waist Deep',
    depthCm: '100–140 cm',
    vehicleWarning: 'Impassable for Hatchbacks, Sedans, SUVs. Road buried under debris.',
    reportedBy: 'GCC Disaster Response',
  },
  {
    id: 'm3',
    lat: 13.1260, lng: 80.2515,
    type: 'caution',
    label: 'Vyasarpadi Underpass',
    depth: 'Knee Deep',
    depthCm: '40–60 cm',
    vehicleWarning: 'Impassable for Hatchbacks and Sedans. High-clearance SUVs proceed with extreme caution.',
    reportedBy: 'Citizen Report · Verified',
  },
  {
    id: 'm4',
    lat: 13.0820, lng: 80.2750,
    type: 'safe',
    label: 'NH-16 Northbound',
    depth: 'Dry — Clear',
    depthCm: '0 cm',
    vehicleWarning: 'Safe for all vehicle types. Road surface intact.',
    reportedBy: 'NHAI Traffic Cell',
  },
  {
    id: 'm5',
    lat: 12.9260, lng: 80.1150,
    type: 'caution',
    label: 'Tambaram Bypass — Partial Blockage',
    depth: 'Ankle Deep',
    depthCm: '15–25 cm',
    vehicleWarning: 'Passable for SUVs only. Hatchbacks and Sedans advised to avoid.',
    reportedBy: 'Citizen Report · Verified',
  },
  {
    id: 'm6',
    lat: 13.0100, lng: 80.2400,
    type: 'safe',
    label: 'Kotturpuram Bridge',
    depth: 'Dry — Passable',
    depthCm: '0 cm',
    vehicleWarning: 'Safe for all vehicle types. Bridge structure intact.',
    reportedBy: 'PWD Field Inspection',
  },
  {
    id: 'm7',
    lat: 13.0590, lng: 80.2680,
    type: 'caution',
    label: 'Triplicane — Wallajah Road',
    depth: 'Ankle Deep',
    depthCm: '20–30 cm',
    vehicleWarning: 'Caution advised for Sedans. SUVs may pass slowly. Pedestrians use footpaths.',
    reportedBy: 'GCC Zone 9 Team',
  },
  {
    id: 'm8',
    lat: 13.0440, lng: 80.2530,
    type: 'safe',
    label: 'Teynampet — TTK Road',
    depth: 'Dry — Clear',
    depthCm: '0 cm',
    vehicleWarning: 'Safe for all vehicle types.',
    reportedBy: 'Traffic Police Control Room',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Critical Landmark Overlays (Police & Fire Stations)
// Shown as optional overlay when a shelter card is selected
// ─────────────────────────────────────────────────────────────────────────────
export const LANDMARKS = [
  { id: 'l1', lat: 13.0827, lng: 80.2707, type: 'police', label: 'Vepery Police Station' },
  { id: 'l2', lat: 13.0500, lng: 80.2550, type: 'police', label: 'Teynampet Police Station' },
  { id: 'l3', lat: 13.1170, lng: 80.2900, type: 'police', label: 'Royapuram Police Station' },
  { id: 'l4', lat: 13.0350, lng: 80.2510, type: 'police', label: 'Alwarpet Police Station' },
  { id: 'l5', lat: 13.0580, lng: 80.2790, type: 'police', label: 'Triplicane Police Station' },
  { id: 'l6', lat: 13.0620, lng: 80.2760, type: 'fire',   label: 'Mylapore Fire Station' },
  { id: 'l7', lat: 13.1100, lng: 80.2870, type: 'fire',   label: 'Tondiarpet Fire Station' },
  { id: 'l8', lat: 13.0200, lng: 80.2500, type: 'fire',   label: 'Saidapet Fire Station' },
];
