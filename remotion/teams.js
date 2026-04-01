// All 48 FIFA World Cup 2026 teams with flag colors for canvas rendering
export const TEAMS = {
  // Group A
  MEX: { name: 'MEXICO', shortName: 'MEX', color: '#006847', altColor: '#CE1126', flag: [['#006847',0,0,1/3,1],['#fff',1/3,0,1/3,1],['#CE1126',2/3,0,1/3,1]] },
  RSA: { name: 'SOUTH AFRICA', shortName: 'RSA', color: '#007749', altColor: '#FFB81C', flag: [['#007749',0,0.3,1,0.4],['#000',0,0,1,0.33],['#FFB81C',0,0.66,1,0.34]] },
  KOR: { name: 'SOUTH KOREA', shortName: 'KOR', color: '#CD2E3A', altColor: '#0047A0', flag: [['#fff',0,0,1,1],['#CD2E3A',0.3,0.25,0.4,0.5]] },
  CZE: { name: 'CZECHIA', shortName: 'CZE', color: '#11457E', altColor: '#D7141A', flag: [['#fff',0,0,1,0.5],['#D7141A',0,0.5,1,0.5],['#11457E',0,0,0.4,1]] },

  // Group B
  CAN: { name: 'CANADA', shortName: 'CAN', color: '#FF0000', altColor: '#fff', flag: [['#FF0000',0,0,0.25,1],['#fff',0.25,0,0.5,1],['#FF0000',0.75,0,0.25,1]] },
  BIH: { name: 'BOSNIA & HER.', shortName: 'BOS', color: '#002395', altColor: '#FFC107', flag: [['#002395',0,0,1,1],['#FFC107',0.2,0,0.15,1]] },
  QAT: { name: 'QATAR', shortName: 'QAT', color: '#8A1538', altColor: '#fff', flag: [['#fff',0,0,0.3,1],['#8A1538',0.3,0,0.7,1]] },
  SUI: { name: 'SWITZERLAND', shortName: 'SUI', color: '#FF0000', altColor: '#fff', flag: [['#FF0000',0,0,1,1],['#fff',0.35,0.2,0.3,0.6]] },

  // Group C
  BRA: { name: 'BRAZIL', shortName: 'BRA', color: '#009739', altColor: '#FEDD00', flag: [['#009739',0,0,1,1],['#FEDD00',0.2,0.2,0.6,0.6]] },
  MAR: { name: 'MOROCCO', shortName: 'MAR', color: '#C1272D', altColor: '#006233', flag: [['#C1272D',0,0,1,1],['#006233',0.3,0.3,0.4,0.4]] },
  HAI: { name: 'HAITI', shortName: 'HAI', color: '#00209F', altColor: '#D21034', flag: [['#00209F',0,0,1,0.5],['#D21034',0,0.5,1,0.5]] },
  SCO: { name: 'SCOTLAND', shortName: 'SCO', color: '#003078', altColor: '#fff', flag: [['#003078',0,0,1,1],['#fff',0.45,0,0.1,1],['#fff',0,0.45,1,0.1]] },

  // Group D
  USA: { name: 'USA', shortName: 'USA', color: '#002868', altColor: '#BF0A30', flag: [['#BF0A30',0,0,1,0.15],['#fff',0,0.15,1,0.15],['#BF0A30',0,0.3,1,0.15],['#fff',0,0.45,1,0.15],['#BF0A30',0,0.6,1,0.15],['#002868',0,0,0.4,0.45]] },
  PAR: { name: 'PARAGUAY', shortName: 'PAR', color: '#D52B1E', altColor: '#0038A8', flag: [['#D52B1E',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#0038A8',0,0.67,1,0.33]] },
  AUS: { name: 'AUSTRALIA', shortName: 'AUS', color: '#002868', altColor: '#FFD700', flag: [['#002868',0,0,1,1],['#fff',0.3,0.3,0.1,0.4]] },
  TUR: { name: 'TURKEY', shortName: 'TUR', color: '#E30A17', altColor: '#fff', flag: [['#E30A17',0,0,1,1],['#fff',0.35,0.25,0.15,0.5]] },

  // Group E
  GER: { name: 'GERMANY', shortName: 'GER', color: '#000', altColor: '#DD0000', flag: [['#000',0,0,1,0.33],['#DD0000',0,0.33,1,0.34],['#FFCE00',0,0.67,1,0.33]] },
  CUW: { name: 'CURACAO', shortName: 'CUW', color: '#002B7F', altColor: '#F9E814', flag: [['#002B7F',0,0,1,1],['#F9E814',0,0.65,1,0.08],['#F9E814',0,0.8,1,0.08]] },
  CIV: { name: 'IVORY COAST', shortName: 'CIV', color: '#F77F00', altColor: '#009E60', flag: [['#F77F00',0,0,0.33,1],['#fff',0.33,0,0.34,1],['#009E60',0.67,0,0.33,1]] },
  ECU: { name: 'ECUADOR', shortName: 'ECU', color: '#FFD100', altColor: '#034EA2', flag: [['#FFD100',0,0,1,0.5],['#034EA2',0,0.5,1,0.25],['#CE1126',0,0.75,1,0.25]] },

  // Group F
  NED: { name: 'NETHERLANDS', shortName: 'NED', color: '#FF4F00', altColor: '#21468B', flag: [['#AE1C28',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#21468B',0,0.67,1,0.33]] },
  JPN: { name: 'JAPAN', shortName: 'JPN', color: '#BC002D', altColor: '#fff', flag: [['#fff',0,0,1,1],['#BC002D',0.35,0.25,0.3,0.5]] },
  SWE: { name: 'SWEDEN', shortName: 'SWE', color: '#006AA7', altColor: '#FECC00', flag: [['#006AA7',0,0,1,1],['#FECC00',0.3,0,0.12,1],['#FECC00',0,0.4,1,0.2]] },
  TUN: { name: 'TUNISIA', shortName: 'TUN', color: '#E70013', altColor: '#fff', flag: [['#E70013',0,0,1,1],['#fff',0.35,0.25,0.3,0.5]] },

  // Group G
  BEL: { name: 'BELGIUM', shortName: 'BEL', color: '#ED2939', altColor: '#FAE042', flag: [['#000',0,0,0.33,1],['#FAE042',0.33,0,0.34,1],['#ED2939',0.67,0,0.33,1]] },
  EGY: { name: 'EGYPT', shortName: 'EGY', color: '#C8102E', altColor: '#fff', flag: [['#C8102E',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#000',0,0.67,1,0.33]] },
  IRN: { name: 'IR IRAN', shortName: 'IRN', color: '#239F40', altColor: '#DA0000', flag: [['#239F40',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#DA0000',0,0.67,1,0.33]] },
  NZL: { name: 'NEW ZEALAND', shortName: 'NZL', color: '#00247D', altColor: '#CC142B', flag: [['#00247D',0,0,1,1],['#CC142B',0.6,0.2,0.08,0.08]] },

  // Group H
  ESP: { name: 'SPAIN', shortName: 'ESP', color: '#AA151B', altColor: '#F1BF00', flag: [['#AA151B',0,0,1,0.25],['#F1BF00',0,0.25,1,0.5],['#AA151B',0,0.75,1,0.25]] },
  CPV: { name: 'CAPE VERDE', shortName: 'CPV', color: '#003893', altColor: '#CF2027', flag: [['#003893',0,0,1,1],['#CF2027',0,0.55,1,0.1],['#fff',0,0.5,1,0.05]] },
  KSA: { name: 'SAUDI ARABIA', shortName: 'KSA', color: '#006C35', altColor: '#fff', flag: [['#006C35',0,0,1,1],['#fff',0.2,0.3,0.6,0.4]] },
  URU: { name: 'URUGUAY', shortName: 'URU', color: '#001489', altColor: '#fff', flag: [['#fff',0,0,1,0.2],['#001489',0,0.2,1,0.2],['#fff',0,0.4,1,0.2],['#001489',0,0.6,1,0.2],['#fff',0,0.8,1,0.2]] },

  // Group I
  FRA: { name: 'FRANCE', shortName: 'FRA', color: '#002395', altColor: '#ED2939', flag: [['#002395',0,0,0.33,1],['#fff',0.33,0,0.34,1],['#ED2939',0.67,0,0.33,1]] },
  SEN: { name: 'SENEGAL', shortName: 'SEN', color: '#00853F', altColor: '#FDEF42', flag: [['#00853F',0,0,0.33,1],['#FDEF42',0.33,0,0.34,1],['#EF3340',0.67,0,0.33,1]] },
  IRQ: { name: 'IRAQ', shortName: 'IRQ', color: '#CE1126', altColor: '#007A3D', flag: [['#CE1126',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#000',0,0.67,1,0.33]] },
  NOR: { name: 'NORWAY', shortName: 'NOR', color: '#EF2B2D', altColor: '#002868', flag: [['#EF2B2D',0,0,1,1],['#fff',0.28,0,0.16,1],['#fff',0,0.38,1,0.24],['#002868',0.32,0,0.08,1],['#002868',0,0.42,1,0.16]] },

  // Group J
  ARG: { name: 'ARGENTINA', shortName: 'ARG', color: '#74ACDF', altColor: '#fff', flag: [['#74ACDF',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#74ACDF',0,0.67,1,0.33]] },
  ALG: { name: 'ALGERIA', shortName: 'ALG', color: '#006233', altColor: '#D21034', flag: [['#006233',0,0,0.5,1],['#fff',0.5,0,0.5,1],['#D21034',0.35,0.25,0.3,0.5]] },
  AUT: { name: 'AUSTRIA', shortName: 'AUT', color: '#ED2939', altColor: '#fff', flag: [['#ED2939',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#ED2939',0,0.67,1,0.33]] },
  JOR: { name: 'JORDAN', shortName: 'JOR', color: '#007A3D', altColor: '#CE1126', flag: [['#000',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#007A3D',0,0.67,1,0.33],['#CE1126',0,0,0.4,1]] },

  // Group K
  POR: { name: 'PORTUGAL', shortName: 'POR', color: '#006600', altColor: '#FF0000', flag: [['#006600',0,0,0.4,1],['#FF0000',0.4,0,0.6,1]] },
  COD: { name: 'DR CONGO', shortName: 'COD', color: '#007FFF', altColor: '#CE1021', flag: [['#007FFF',0,0,1,1],['#CE1021',0.1,0.1,0.15,1],['#F7D618',0,0,0.3,0.3]] },
  UZB: { name: 'UZBEKISTAN', shortName: 'UZB', color: '#0099B5', altColor: '#1EB53A', flag: [['#0099B5',0,0,1,0.33],['#fff',0,0.33,1,0.04],['#CE1126',0,0.37,1,0.04],['#fff',0,0.41,1,0.04],['#1EB53A',0,0.45,1,0.55]] },
  COL: { name: 'COLOMBIA', shortName: 'COL', color: '#FCD116', altColor: '#003893', flag: [['#FCD116',0,0,1,0.5],['#003893',0,0.5,1,0.25],['#CE1126',0,0.75,1,0.25]] },

  // Group L
  ENG: { name: 'ENGLAND', shortName: 'ENG', color: '#CF081F', altColor: '#fff', flag: [['#fff',0,0,1,1],['#CF081F',0.42,0,0.16,1],['#CF081F',0,0.42,1,0.16]] },
  CRO: { name: 'CROATIA', shortName: 'CRO', color: '#FF0000', altColor: '#171796', flag: [['#FF0000',0,0,1,0.33],['#fff',0,0.33,1,0.34],['#171796',0,0.67,1,0.33]] },
  GHA: { name: 'GHANA', shortName: 'GHA', color: '#EF3340', altColor: '#FCD116', flag: [['#EF3340',0,0,1,0.33],['#FCD116',0,0.33,1,0.34],['#006B3F',0,0.67,1,0.33]] },
  PAN: { name: 'PANAMA', shortName: 'PAN', color: '#D21034', altColor: '#005293', flag: [['#fff',0,0,0.5,0.5],['#005293',0.5,0,0.5,0.5],['#D21034',0,0.5,0.5,0.5],['#fff',0.5,0.5,0.5,0.5]] },
};

// Group stage schedule - all 96 matches
export const GROUP_MATCHES = [
  // Day 1 - June 11
  { home: 'MEX', away: 'RSA', group: 'A', date: '11 Jun', time: '15:00', venue: 'Mexico City' },
  { home: 'KOR', away: 'CZE', group: 'A', date: '11 Jun', time: '22:00', venue: 'Guadalajara' },
  // Day 2 - June 12
  { home: 'CAN', away: 'BIH', group: 'B', date: '12 Jun', time: '15:00', venue: 'Toronto' },
  { home: 'USA', away: 'PAR', group: 'D', date: '12 Jun', time: '21:00', venue: 'Los Angeles' },
  // Day 3 - June 13
  { home: 'QAT', away: 'SUI', group: 'B', date: '13 Jun', time: '15:00', venue: 'San Francisco' },
  { home: 'BRA', away: 'MAR', group: 'C', date: '13 Jun', time: '18:00', venue: 'New York' },
  { home: 'HAI', away: 'SCO', group: 'C', date: '13 Jun', time: '21:00', venue: 'Boston' },
  { home: 'AUS', away: 'TUR', group: 'D', date: '13 Jun', time: '00:00', venue: 'Vancouver' },
  // Day 4 - June 14
  { home: 'GER', away: 'CUW', group: 'E', date: '14 Jun', time: '13:00', venue: 'Houston' },
  { home: 'NED', away: 'JPN', group: 'F', date: '14 Jun', time: '16:00', venue: 'Dallas' },
  { home: 'CIV', away: 'ECU', group: 'E', date: '14 Jun', time: '19:00', venue: 'Philadelphia' },
  { home: 'SWE', away: 'TUN', group: 'F', date: '14 Jun', time: '22:00', venue: 'Monterrey' },
  // Day 5 - June 15
  { home: 'ESP', away: 'CPV', group: 'H', date: '15 Jun', time: '12:00', venue: 'Atlanta' },
  { home: 'BEL', away: 'EGY', group: 'G', date: '15 Jun', time: '15:00', venue: 'Seattle' },
  { home: 'KSA', away: 'URU', group: 'H', date: '15 Jun', time: '18:00', venue: 'Miami' },
  { home: 'IRN', away: 'NZL', group: 'G', date: '15 Jun', time: '21:00', venue: 'Los Angeles' },
  // Day 6 - June 16
  { home: 'FRA', away: 'SEN', group: 'I', date: '16 Jun', time: '15:00', venue: 'New York' },
  { home: 'IRQ', away: 'NOR', group: 'I', date: '16 Jun', time: '18:00', venue: 'Boston' },
  { home: 'ARG', away: 'ALG', group: 'J', date: '16 Jun', time: '21:00', venue: 'Kansas City' },
  { home: 'AUT', away: 'JOR', group: 'J', date: '16 Jun', time: '00:00', venue: 'San Francisco' },
  // Day 7 - June 17
  { home: 'POR', away: 'COD', group: 'K', date: '17 Jun', time: '13:00', venue: 'Houston' },
  { home: 'ENG', away: 'CRO', group: 'L', date: '17 Jun', time: '16:00', venue: 'Dallas' },
  { home: 'GHA', away: 'PAN', group: 'L', date: '17 Jun', time: '19:00', venue: 'Toronto' },
  { home: 'UZB', away: 'COL', group: 'K', date: '17 Jun', time: '22:00', venue: 'Mexico City' },
  // Matchday 2 - June 18
  { home: 'CZE', away: 'RSA', group: 'A', date: '18 Jun', time: '12:00', venue: 'Atlanta' },
  { home: 'SUI', away: 'BIH', group: 'B', date: '18 Jun', time: '15:00', venue: 'Los Angeles' },
  { home: 'CAN', away: 'QAT', group: 'B', date: '18 Jun', time: '18:00', venue: 'Vancouver' },
  { home: 'MEX', away: 'KOR', group: 'A', date: '18 Jun', time: '21:00', venue: 'Guadalajara' },
  // June 19
  { home: 'USA', away: 'AUS', group: 'D', date: '19 Jun', time: '15:00', venue: 'Seattle' },
  { home: 'SCO', away: 'MAR', group: 'C', date: '19 Jun', time: '18:00', venue: 'Boston' },
  { home: 'BRA', away: 'HAI', group: 'C', date: '19 Jun', time: '21:00', venue: 'Philadelphia' },
  { home: 'TUR', away: 'PAR', group: 'D', date: '19 Jun', time: '00:00', venue: 'San Francisco' },
  // June 20
  { home: 'NED', away: 'SWE', group: 'F', date: '20 Jun', time: '13:00', venue: 'Houston' },
  { home: 'GER', away: 'CIV', group: 'E', date: '20 Jun', time: '16:00', venue: 'Toronto' },
  { home: 'ECU', away: 'CUW', group: 'E', date: '20 Jun', time: '20:00', venue: 'Kansas City' },
  { home: 'TUN', away: 'JPN', group: 'F', date: '20 Jun', time: '00:00', venue: 'Monterrey' },
  // June 21
  { home: 'ESP', away: 'KSA', group: 'H', date: '21 Jun', time: '12:00', venue: 'Atlanta' },
  { home: 'BEL', away: 'IRN', group: 'G', date: '21 Jun', time: '15:00', venue: 'Los Angeles' },
  { home: 'URU', away: 'CPV', group: 'H', date: '21 Jun', time: '18:00', venue: 'Miami' },
  { home: 'NZL', away: 'EGY', group: 'G', date: '21 Jun', time: '21:00', venue: 'Vancouver' },
  // June 22
  { home: 'ARG', away: 'AUT', group: 'J', date: '22 Jun', time: '13:00', venue: 'Dallas' },
  { home: 'FRA', away: 'IRQ', group: 'I', date: '22 Jun', time: '17:00', venue: 'Philadelphia' },
  { home: 'NOR', away: 'SEN', group: 'I', date: '22 Jun', time: '20:00', venue: 'New York' },
  { home: 'JOR', away: 'ALG', group: 'J', date: '22 Jun', time: '23:00', venue: 'San Francisco' },
  // June 23
  { home: 'POR', away: 'UZB', group: 'K', date: '23 Jun', time: '13:00', venue: 'Houston' },
  { home: 'ENG', away: 'GHA', group: 'L', date: '23 Jun', time: '16:00', venue: 'Boston' },
  { home: 'PAN', away: 'CRO', group: 'L', date: '23 Jun', time: '19:00', venue: 'Toronto' },
  { home: 'COL', away: 'COD', group: 'K', date: '23 Jun', time: '22:00', venue: 'Guadalajara' },
  // Matchday 3 - June 24
  { home: 'SUI', away: 'CAN', group: 'B', date: '24 Jun', time: '15:00', venue: 'Vancouver' },
  { home: 'BIH', away: 'QAT', group: 'B', date: '24 Jun', time: '15:00', venue: 'Seattle' },
  { home: 'SCO', away: 'BRA', group: 'C', date: '24 Jun', time: '18:00', venue: 'Miami' },
  { home: 'MAR', away: 'HAI', group: 'C', date: '24 Jun', time: '18:00', venue: 'Atlanta' },
  { home: 'CZE', away: 'MEX', group: 'A', date: '24 Jun', time: '21:00', venue: 'Mexico City' },
  { home: 'RSA', away: 'KOR', group: 'A', date: '24 Jun', time: '21:00', venue: 'Monterrey' },
  // June 25
  { home: 'ECU', away: 'GER', group: 'E', date: '25 Jun', time: '16:00', venue: 'New York' },
  { home: 'CUW', away: 'CIV', group: 'E', date: '25 Jun', time: '16:00', venue: 'Philadelphia' },
  { home: 'TUN', away: 'NED', group: 'F', date: '25 Jun', time: '19:00', venue: 'Kansas City' },
  { home: 'JPN', away: 'SWE', group: 'F', date: '25 Jun', time: '19:00', venue: 'Dallas' },
  { home: 'TUR', away: 'USA', group: 'D', date: '25 Jun', time: '22:00', venue: 'Los Angeles' },
  { home: 'PAR', away: 'AUS', group: 'D', date: '25 Jun', time: '22:00', venue: 'San Francisco' },
  // June 26
  { home: 'NOR', away: 'FRA', group: 'I', date: '26 Jun', time: '15:00', venue: 'Boston' },
  { home: 'SEN', away: 'IRQ', group: 'I', date: '26 Jun', time: '15:00', venue: 'Toronto' },
  { home: 'URU', away: 'ESP', group: 'H', date: '26 Jun', time: '20:00', venue: 'Guadalajara' },
  { home: 'CPV', away: 'KSA', group: 'H', date: '26 Jun', time: '20:00', venue: 'Houston' },
  { home: 'NZL', away: 'BEL', group: 'G', date: '26 Jun', time: '23:00', venue: 'Vancouver' },
  { home: 'EGY', away: 'IRN', group: 'G', date: '26 Jun', time: '23:00', venue: 'Seattle' },
  // June 27
  { home: 'PAN', away: 'ENG', group: 'L', date: '27 Jun', time: '17:00', venue: 'New York' },
  { home: 'CRO', away: 'GHA', group: 'L', date: '27 Jun', time: '17:00', venue: 'Philadelphia' },
  { home: 'COL', away: 'POR', group: 'K', date: '27 Jun', time: '19:30', venue: 'Miami' },
  { home: 'COD', away: 'UZB', group: 'K', date: '27 Jun', time: '19:30', venue: 'Atlanta' },
  { home: 'JOR', away: 'ARG', group: 'J', date: '27 Jun', time: '22:00', venue: 'Dallas' },
  { home: 'ALG', away: 'AUT', group: 'J', date: '27 Jun', time: '22:00', venue: 'Kansas City' },
];
