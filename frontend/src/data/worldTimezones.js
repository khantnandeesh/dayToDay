/**
 * Professional World Timezones & Major Continental Financial & Tech Hubs
 * Clean ISO codes, IATA hubs, coordinates, and precision time calculations.
 * Completely free of toy emojis.
 */

export const CONTINENTS = [
  { id: 'all', name: 'Global', code: 'WLD' },
  { id: 'Asia', name: 'Asia', code: 'ASI', centerLat: 34.0, centerLng: 100.0 },
  { id: 'Europe', name: 'Europe', code: 'EUR', centerLat: 54.0, centerLng: 15.0 },
  { id: 'North America', name: 'North America', code: 'NAM', centerLat: 40.0, centerLng: -100.0 },
  { id: 'South America', name: 'South America', code: 'SAM', centerLat: -15.0, centerLng: -60.0 },
  { id: 'Africa', name: 'Africa', code: 'AFR', centerLat: 2.0, centerLng: 20.0 },
  { id: 'Oceania', name: 'Oceania', code: 'OCE', centerLat: -25.0, centerLng: 135.0 },
];

export const WORLD_CITIES = [
  // --- Asia ---
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    code: 'TYO',
    iata: 'HND',
    continent: 'Asia',
    timezone: 'Asia/Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    description: 'East Asia Financial & Technology Center',
    market: 'TSE',
    color: '#06b6d4',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    code: 'SIN',
    iata: 'SIN',
    continent: 'Asia',
    timezone: 'Asia/Singapore',
    lat: 1.3521,
    lng: 103.8198,
    description: 'Global Financial & Maritime Gateway',
    market: 'SGX',
    color: '#38bdf8',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    code: 'DXB',
    iata: 'DXB',
    continent: 'Asia',
    timezone: 'Asia/Dubai',
    lat: 25.2048,
    lng: 55.2708,
    description: 'Middle East Trade & Innovation Hub',
    market: 'DFM',
    color: '#f59e0b',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    code: 'BOM',
    iata: 'BOM',
    continent: 'Asia',
    timezone: 'Asia/Kolkata',
    lat: 19.076,
    lng: 72.8777,
    description: 'Commercial & Financial Capital of India',
    market: 'NSE',
    color: '#f97316',
  },
  {
    id: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    countryCode: 'TH',
    code: 'BKK',
    iata: 'BKK',
    continent: 'Asia',
    timezone: 'Asia/Bangkok',
    lat: 13.7563,
    lng: 100.5018,
    description: 'Southeast Asian Cultural & Trade Core',
    market: 'SET',
    color: '#fbbf24',
  },
  {
    id: 'seoul',
    name: 'Seoul',
    country: 'South Korea',
    countryCode: 'KR',
    code: 'SEL',
    iata: 'ICN',
    continent: 'Asia',
    timezone: 'Asia/Seoul',
    lat: 37.5665,
    lng: 126.978,
    description: 'High-Tech & Electronics Megacity',
    market: 'KRX',
    color: '#818cf8',
  },
  {
    id: 'beijing',
    name: 'Beijing',
    country: 'China',
    countryCode: 'CN',
    code: 'PEK',
    iata: 'PEK',
    continent: 'Asia',
    timezone: 'Asia/Shanghai',
    lat: 39.9042,
    lng: 116.4074,
    description: 'Administrative & Strategic Capital of China',
    market: 'SSE',
    color: '#ef4444',
  },
  {
    id: 'hong_kong',
    name: 'Hong Kong',
    country: 'China (SAR)',
    countryCode: 'HK',
    code: 'HKG',
    iata: 'HKG',
    continent: 'Asia',
    timezone: 'Asia/Hong_Kong',
    lat: 22.3193,
    lng: 114.1694,
    description: 'International Capital & Free Trade Port',
    market: 'HKEX',
    color: '#f43f5e',
  },
  {
    id: 'jakarta',
    name: 'Jakarta',
    country: 'Indonesia',
    countryCode: 'ID',
    code: 'JKT',
    iata: 'CGK',
    continent: 'Asia',
    timezone: 'Asia/Jakarta',
    lat: -6.2088,
    lng: 106.8456,
    description: 'Economic Engine of Southeast Asia',
    market: 'IDX',
    color: '#fb923c',
  },

  // --- Europe ---
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    code: 'LON',
    iata: 'LHR',
    continent: 'Europe',
    timezone: 'Europe/London',
    lat: 51.5074,
    lng: -0.1278,
    description: 'Prime Meridian Reference & Financial Capital',
    market: 'LSE',
    color: '#38bdf8',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    code: 'PAR',
    iata: 'CDG',
    continent: 'Europe',
    timezone: 'Europe/Paris',
    lat: 48.8566,
    lng: 2.3522,
    description: 'European Cultural & Diplomatic Center',
    market: 'EPA',
    color: '#6366f1',
  },
  {
    id: 'frankfurt',
    name: 'Frankfurt',
    country: 'Germany',
    countryCode: 'DE',
    code: 'FRA',
    iata: 'FRA',
    continent: 'Europe',
    timezone: 'Europe/Berlin',
    lat: 50.1109,
    lng: 8.6821,
    description: 'European Central Bank & Financial Axis',
    market: 'FWB',
    color: '#a855f7',
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    code: 'AMS',
    iata: 'AMS',
    continent: 'Europe',
    timezone: 'Europe/Amsterdam',
    lat: 52.3676,
    lng: 4.9041,
    description: 'European Internet Exchange & Tech Hub',
    market: 'AEX',
    color: '#06b6d4',
  },
  {
    id: 'zurich',
    name: 'Zurich',
    country: 'Switzerland',
    countryCode: 'CH',
    code: 'ZRH',
    iata: 'ZRH',
    continent: 'Europe',
    timezone: 'Europe/Zurich',
    lat: 47.3769,
    lng: 8.5417,
    description: 'Global Private Banking & Precision Engineering',
    market: 'SIX',
    color: '#14b8a6',
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    countryCode: 'ES',
    code: 'MAD',
    iata: 'MAD',
    continent: 'Europe',
    timezone: 'Europe/Madrid',
    lat: 40.4168,
    lng: -3.7038,
    description: 'Iberian Peninsula Commercial Hub',
    market: 'BME',
    color: '#eab308',
  },
  {
    id: 'stockholm',
    name: 'Stockholm',
    country: 'Sweden',
    countryCode: 'SE',
    code: 'STO',
    iata: 'ARN',
    continent: 'Europe',
    timezone: 'Europe/Stockholm',
    lat: 59.3293,
    lng: 18.0686,
    description: 'Nordic Technology & Innovation Center',
    market: 'OMXS',
    color: '#38bdf8',
  },

  // --- North America ---
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    countryCode: 'US',
    code: 'NYC',
    iata: 'JFK',
    continent: 'North America',
    timezone: 'America/New_York',
    lat: 40.7128,
    lng: -74.006,
    description: 'Global Financial, Media & Commercial Center',
    market: 'NYSE',
    color: '#38bdf8',
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    country: 'United States',
    countryCode: 'US',
    code: 'SFO',
    iata: 'SFO',
    continent: 'North America',
    timezone: 'America/Los_Angeles',
    lat: 37.7749,
    lng: -122.4194,
    description: 'Silicon Valley Technology & Venture Capital',
    market: 'NASDAQ',
    color: '#10b981',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    country: 'United States',
    countryCode: 'US',
    code: 'CHI',
    iata: 'ORD',
    continent: 'North America',
    timezone: 'America/Chicago',
    lat: 41.8781,
    lng: -87.6298,
    description: 'Global Derivatives & Commodities Capital',
    market: 'CME',
    color: '#0284c7',
  },
  {
    id: 'toronto',
    name: 'Toronto',
    country: 'Canada',
    countryCode: 'CA',
    code: 'TOR',
    iata: 'YYZ',
    continent: 'North America',
    timezone: 'America/Toronto',
    lat: 43.6532,
    lng: -79.3832,
    description: 'Canadian Financial & Tech Corridor',
    market: 'TSX',
    color: '#f43f5e',
  },

  // --- South America ---
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    country: 'Brazil',
    countryCode: 'BR',
    code: 'SAO',
    iata: 'GRU',
    continent: 'South America',
    timezone: 'America/Sao_Paulo',
    lat: -23.5505,
    lng: -46.6333,
    description: 'Financial Engine of South America',
    market: 'B3',
    color: '#10b981',
  },
  {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    countryCode: 'AR',
    code: 'BUE',
    iata: 'EZE',
    continent: 'South America',
    timezone: 'America/Argentina/Buenos_Aires',
    lat: -34.6037,
    lng: -58.3816,
    description: 'Río de la Plata Commercial Core',
    market: 'BYMA',
    color: '#38bdf8',
  },
  {
    id: 'santiago',
    name: 'Santiago',
    country: 'Chile',
    countryCode: 'CL',
    code: 'SCL',
    iata: 'SCL',
    continent: 'South America',
    timezone: 'America/Santiago',
    lat: -33.4489,
    lng: -70.6693,
    description: 'Andean Financial & Mining Technology Hub',
    market: 'BCS',
    color: '#f59e0b',
  },

  // --- Africa ---
  {
    id: 'cairo',
    name: 'Cairo',
    country: 'Egypt',
    countryCode: 'EG',
    code: 'CAI',
    iata: 'CAI',
    continent: 'Africa',
    timezone: 'Africa/Cairo',
    lat: 30.0444,
    lng: 31.2357,
    description: 'Nile Valley & North African Center',
    market: 'EGX',
    color: '#f59e0b',
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    country: 'South Africa',
    countryCode: 'ZA',
    code: 'JNB',
    iata: 'JNB',
    continent: 'Africa',
    timezone: 'Africa/Johannesburg',
    lat: -26.2041,
    lng: 28.0473,
    description: 'Southern African Mining & Finance Capital',
    market: 'JSE',
    color: '#eab308',
  },
  {
    id: 'nairobi',
    name: 'Nairobi',
    country: 'Kenya',
    countryCode: 'KE',
    code: 'NBO',
    iata: 'NBO',
    continent: 'Africa',
    timezone: 'Africa/Nairobi',
    lat: -1.2921,
    lng: 36.8219,
    description: 'East African Silicon Savannah Hub',
    market: 'NSE',
    color: '#10b981',
  },

  // --- Oceania ---
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    countryCode: 'AU',
    code: 'SYD',
    iata: 'SYD',
    continent: 'Oceania',
    timezone: 'Australia/Sydney',
    lat: -33.8688,
    lng: 151.2093,
    description: 'Asia-Pacific Financial & Maritime Hub',
    market: 'ASX',
    color: '#06b6d4',
  },
  {
    id: 'melbourne',
    name: 'Melbourne',
    country: 'Australia',
    countryCode: 'AU',
    code: 'MEL',
    iata: 'MEL',
    continent: 'Oceania',
    timezone: 'Australia/Melbourne',
    lat: -37.8136,
    lng: 144.9631,
    description: 'Australian Cultural & Biomedical Center',
    market: 'ASX',
    color: '#6366f1',
  },
  {
    id: 'auckland',
    name: 'Auckland',
    country: 'New Zealand',
    countryCode: 'NZ',
    code: 'AKL',
    iata: 'AKL',
    continent: 'Oceania',
    timezone: 'Pacific/Auckland',
    lat: -36.8485,
    lng: 174.7633,
    description: 'South Pacific Commercial Gateway',
    market: 'NZX',
    color: '#38bdf8',
  },
];

// Global Great-Circle Interconnect Telemetry Routes
export const GLOBAL_ROUTES = [
  { from: 'tokyo', to: 'san_francisco', color: '#06b6d4' },
  { from: 'san_francisco', to: 'new_york', color: '#38bdf8' },
  { from: 'new_york', to: 'london', color: '#6366f1' },
  { from: 'london', to: 'frankfurt', color: '#8b5cf6' },
  { from: 'frankfurt', to: 'dubai', color: '#f59e0b' },
  { from: 'dubai', to: 'singapore', color: '#10b981' },
  { from: 'singapore', to: 'tokyo', color: '#06b6d4' },
  { from: 'singapore', to: 'sydney', color: '#38bdf8' },
  { from: 'london', to: 'johannesburg', color: '#eab308' },
  { from: 'new_york', to: 'sao_paulo', color: '#10b981' },
];

/**
 * Calculates accurate local time, UTC offset, and solar status for a given timezone
 */
export function getTimeInfo(timeZoneStr, dateObj = new Date()) {
  try {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);

    // Formatter for 12-hour time
    const dtf12 = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneStr,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    // Formatter for 24-hour military/chronometer time
    const dtf24 = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneStr,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Millisecond component
    const ms = String(d.getMilliseconds()).padStart(3, '0');

    // Formatter for date
    const dtfDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneStr,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Time parts to extract hour number accurately
    const dtfParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneStr,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
      timeZoneName: 'short',
    });

    const parts = dtfParts.formatToParts(d);
    let hour = 12;
    let minute = 0;
    let second = 0;
    let tzAbbr = 'UTC';

    parts.forEach((p) => {
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
      if (p.type === 'second') second = parseInt(p.value, 10);
      if (p.type === 'timeZoneName') tzAbbr = p.value;
    });

    // Time strings
    const timeStr = dtf12.format(d);
    const time24Str = dtf24.format(d);
    const dateStr = dtfDate.format(d);

    // Calculate UTC offset
    const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone: timeZoneStr }));
    const diffMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60));

    const offsetHours = Math.floor(Math.abs(diffMinutes) / 60);
    const offsetRemMins = Math.abs(diffMinutes) % 60;
    const sign = diffMinutes >= 0 ? '+' : '-';
    const utcOffsetStr = `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetRemMins).padStart(2, '0')}`;

    // Comparison to local user machine
    const userOffsetMinutes = -d.getTimezoneOffset();
    const diffFromUserMinutes = diffMinutes - userOffsetMinutes;
    const diffFromUserHours = Math.round((diffFromUserMinutes / 60) * 10) / 10;

    let relativeStr = 'Sync with your clock';
    if (diffFromUserHours > 0) {
      relativeStr = `+${diffFromUserHours}h ahead of your local`;
    } else if (diffFromUserHours < 0) {
      relativeStr = `${diffFromUserHours}h behind your local`;
    }

    // Daytime: 06:00 to 18:00
    const isDaytime = hour >= 6 && hour < 18;
    // Standard financial market trading hours: 09:00 to 17:00
    const isBusinessHours = hour >= 9 && hour < 17;

    // Approximate solar elevation (-90 to +90 degrees)
    // Noon (12:00) = peak solar altitude, midnight (00:00) = nadir
    const solarFraction = ((hour * 60 + minute) / 1440) * 2 * Math.PI;
    const solarElevation = Math.round(Math.sin(solarFraction - Math.PI / 2) * 85);

    return {
      time: timeStr,
      time24: time24Str,
      ms,
      date: dateStr,
      hour,
      minute,
      second,
      tzAbbr,
      utcOffset: utcOffsetStr,
      diffMinutes,
      diffFromUserHours,
      relativeToUser: relativeStr,
      isDaytime,
      isBusinessHours,
      solarElevation,
    };
  } catch {
    return {
      time: '--:--:--',
      time24: '--:--:--',
      ms: '000',
      date: 'UTC Reference',
      hour: 12,
      minute: 0,
      second: 0,
      tzAbbr: 'UTC',
      utcOffset: 'UTC+00:00',
      diffMinutes: 0,
      diffFromUserHours: 0,
      relativeToUser: 'UTC',
      isDaytime: true,
      isBusinessHours: false,
      solarElevation: 45,
    };
  }
}

/**
 * Finds the nearest world city given latitude and longitude coordinates
 */
export function findNearestCity(lat, lng) {
  let nearest = WORLD_CITIES[0];
  let minDistance = Infinity;

  WORLD_CITIES.forEach((city) => {
    const dLat = city.lat - lat;
    let dLng = city.lng - lng;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDistance) {
      minDistance = dist;
      nearest = city;
    }
  });

  return nearest;
}
