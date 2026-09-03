/**
 * Comprehensive World Timezones & Major Continental Cities
 */

export const CONTINENTS = [
  { id: 'all', name: 'All Continents', icon: '🌐' },
  { id: 'Asia', name: 'Asia', icon: '🌏', centerLat: 34.0, centerLng: 100.0 },
  { id: 'Europe', name: 'Europe', icon: '🌍', centerLat: 54.0, centerLng: 15.0 },
  { id: 'North America', name: 'North America', icon: '🌎', centerLat: 40.0, centerLng: -100.0 },
  { id: 'South America', name: 'South America', icon: '🌎', centerLat: -15.0, centerLng: -60.0 },
  { id: 'Africa', name: 'Africa', icon: '🌍', centerLat: 2.0, centerLng: 20.0 },
  { id: 'Oceania', name: 'Oceania', icon: '🌏', centerLat: -25.0, centerLng: 135.0 },
];

export const WORLD_CITIES = [
  // --- Asia ---
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    continent: 'Asia',
    timezone: 'Asia/Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    description: 'East Asia Financial Hub',
    color: '#EC4899',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    continent: 'Asia',
    timezone: 'Asia/Singapore',
    lat: 1.3521,
    lng: 103.8198,
    description: 'Global Financial & Shipping Gateway',
    color: '#F43F5E',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    continent: 'Asia',
    timezone: 'Asia/Dubai',
    lat: 25.2048,
    lng: 55.2708,
    description: 'Middle East Trade & Innovation Hub',
    color: '#F59E0B',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'India',
    flag: '🇮🇳',
    continent: 'Asia',
    timezone: 'Asia/Kolkata',
    lat: 19.076,
    lng: 72.8777,
    description: 'India Commercial & Tech Capital',
    color: '#FB923C',
  },
  {
    id: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    flag: '🇹🇭',
    continent: 'Asia',
    timezone: 'Asia/Bangkok',
    lat: 13.7563,
    lng: 100.5018,
    description: 'Southeast Asian Cultural & Tourism Center',
    color: '#FBBF24',
  },
  {
    id: 'seoul',
    name: 'Seoul',
    country: 'South Korea',
    flag: '🇰🇷',
    continent: 'Asia',
    timezone: 'Asia/Seoul',
    lat: 37.5665,
    lng: 126.978,
    description: 'High-Tech & Entertainment Megacity',
    color: '#A855F7',
  },
  {
    id: 'beijing',
    name: 'Beijing',
    country: 'China',
    flag: '🇨🇳',
    continent: 'Asia',
    timezone: 'Asia/Shanghai',
    lat: 39.9042,
    lng: 116.4074,
    description: 'Capital of China',
    color: '#EF4444',
  },
  {
    id: 'hong_kong',
    name: 'Hong Kong',
    country: 'China (SAR)',
    flag: '🇭🇰',
    continent: 'Asia',
    timezone: 'Asia/Hong_Kong',
    lat: 22.3193,
    lng: 114.1694,
    description: 'Global Port & Financial Center',
    color: '#E11D48',
  },
  {
    id: 'jakarta',
    name: 'Jakarta',
    country: 'Indonesia',
    flag: '🇮🇩',
    continent: 'Asia',
    timezone: 'Asia/Jakarta',
    lat: -6.2088,
    lng: 106.8456,
    description: 'Economic Engine of Southeast Asia',
    color: '#EA580C',
  },

  // --- Europe ---
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    continent: 'Europe',
    timezone: 'Europe/London',
    lat: 51.5074,
    lng: -0.1278,
    description: 'Prime Meridian & International Financial Capital',
    color: '#3B82F6',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    flag: '🇫🇷',
    continent: 'Europe',
    timezone: 'Europe/Paris',
    lat: 48.8566,
    lng: 2.3522,
    description: 'European Cultural & Diplomatic Center',
    color: '#6366F1',
  },
  {
    id: 'berlin',
    name: 'Berlin',
    country: 'Germany',
    flag: '🇩🇪',
    continent: 'Europe',
    timezone: 'Europe/Berlin',
    lat: 52.52,
    lng: 13.405,
    description: 'European Tech & Creative Capital',
    color: '#8B5CF6',
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    flag: '🇪🇸',
    continent: 'Europe',
    timezone: 'Europe/Madrid',
    lat: 40.4168,
    lng: -3.7038,
    description: 'Iberian Peninsula Hub',
    color: '#EAB308',
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    flag: '🇮🇹',
    continent: 'Europe',
    timezone: 'Europe/Rome',
    lat: 41.9028,
    lng: 12.4964,
    description: 'Historic Mediterranean Center',
    color: '#10B981',
  },
  {
    id: 'zurich',
    name: 'Zurich',
    country: 'Switzerland',
    flag: '🇨🇭',
    continent: 'Europe',
    timezone: 'Europe/Zurich',
    lat: 47.3769,
    lng: 8.5417,
    description: 'Global Private Banking & Tech Core',
    color: '#06B6D4',
  },
  {
    id: 'athens',
    name: 'Athens',
    country: 'Greece',
    flag: '🇬🇷',
    continent: 'Europe',
    timezone: 'Europe/Athens',
    lat: 37.9838,
    lng: 23.7275,
    description: 'Eastern Mediterranean Gateway',
    color: '#0284C7',
  },
  {
    id: 'stockholm',
    name: 'Stockholm',
    country: 'Sweden',
    flag: '🇸🇪',
    continent: 'Europe',
    timezone: 'Europe/Stockholm',
    lat: 59.3293,
    lng: 18.0686,
    description: 'Nordic Technology Unicorn Hub',
    color: '#0EA5E9',
  },

  // --- North America ---
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    continent: 'North America',
    timezone: 'America/New_York',
    lat: 40.7128,
    lng: -74.006,
    description: 'Global Financial & Media Capital',
    color: '#2563EB',
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    country: 'United States',
    flag: '🇺🇸',
    continent: 'North America',
    timezone: 'America/Los_Angeles',
    lat: 37.7749,
    lng: -122.4194,
    description: 'Silicon Valley & AI Frontier',
    color: '#0D9488',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    country: 'United States',
    flag: '🇺🇸',
    continent: 'North America',
    timezone: 'America/Chicago',
    lat: 41.8781,
    lng: -87.6298,
    description: 'Midwest Commerce & Commodities Capital',
    color: '#0284C7',
  },
  {
    id: 'toronto',
    name: 'Toronto',
    country: 'Canada',
    flag: '🇨🇦',
    continent: 'North America',
    timezone: 'America/Toronto',
    lat: 43.6532,
    lng: -79.3832,
    description: 'Canada Financial & Tech Nexus',
    color: '#DC2626',
  },
  {
    id: 'vancouver',
    name: 'Vancouver',
    country: 'Canada',
    flag: '🇨🇦',
    continent: 'North America',
    timezone: 'America/Vancouver',
    lat: 49.2827,
    lng: -123.1207,
    description: 'Pacific Northwest Trade Port',
    color: '#059669',
  },
  {
    id: 'mexico_city',
    name: 'Mexico City',
    country: 'Mexico',
    flag: '🇲🇽',
    continent: 'North America',
    timezone: 'America/Mexico_City',
    lat: 19.4326,
    lng: -99.1332,
    description: 'Largest Metropolis in North America',
    color: '#16A34A',
  },
  {
    id: 'honolulu',
    name: 'Honolulu',
    country: 'United States (Hawaii)',
    flag: '🌺',
    continent: 'North America',
    timezone: 'Pacific/Honolulu',
    lat: 21.3069,
    lng: -157.8583,
    description: 'Central Pacific Gateway',
    color: '#14B8A6',
  },

  // --- South America ---
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    country: 'Brazil',
    flag: '🇧🇷',
    continent: 'South America',
    timezone: 'America/Sao_Paulo',
    lat: -23.5505,
    lng: -46.6333,
    description: 'Financial Powerhouse of Latin America',
    color: '#10B981',
  },
  {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    flag: '🇦🇷',
    continent: 'South America',
    timezone: 'America/Argentina/Buenos_Aires',
    lat: -34.6037,
    lng: -58.3816,
    description: 'Southern Cone Cultural Capital',
    color: '#38BDF8',
  },
  {
    id: 'santiago',
    name: 'Santiago',
    country: 'Chile',
    flag: '🇨🇱',
    continent: 'South America',
    timezone: 'America/Santiago',
    lat: -33.4489,
    lng: -70.6693,
    description: 'Andean Technology & Mining Center',
    color: '#DC2626',
  },
  {
    id: 'bogota',
    name: 'Bogotá',
    country: 'Colombia',
    flag: '🇨🇴',
    continent: 'South America',
    timezone: 'America/Bogota',
    lat: 4.711,
    lng: -74.0721,
    description: 'High-Altitude Andean Commercial Hub',
    color: '#F59E0B',
  },
  {
    id: 'lima',
    name: 'Lima',
    country: 'Peru',
    flag: '🇵🇪',
    continent: 'South America',
    timezone: 'America/Lima',
    lat: -12.0464,
    lng: -77.0428,
    description: 'Pacific Coast Gastronomy & Trade Center',
    color: '#EF4444',
  },

  // --- Africa ---
  {
    id: 'cairo',
    name: 'Cairo',
    country: 'Egypt',
    flag: '🇪🇬',
    continent: 'Africa',
    timezone: 'Africa/Cairo',
    lat: 30.0444,
    lng: 31.2357,
    description: 'Gateway between Africa & Middle East',
    color: '#D97706',
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    country: 'South Africa',
    flag: '🇿🇦',
    continent: 'Africa',
    timezone: 'Africa/Johannesburg',
    lat: -26.2041,
    lng: 28.0473,
    description: 'Sub-Saharan Financial Center',
    color: '#059669',
  },
  {
    id: 'nairobi',
    name: 'Nairobi',
    country: 'Kenya',
    flag: '🇰🇪',
    continent: 'Africa',
    timezone: 'Africa/Nairobi',
    lat: -1.2921,
    lng: 36.8219,
    description: 'Silicon Savannah Tech Hub',
    color: '#10B981',
  },
  {
    id: 'lagos',
    name: 'Lagos',
    country: 'Nigeria',
    flag: '🇳🇬',
    continent: 'Africa',
    timezone: 'Africa/Lagos',
    lat: 6.5244,
    lng: 3.3792,
    description: 'West Africa Entertainment & Tech Megacity',
    color: '#16A34A',
  },
  {
    id: 'casablanca',
    name: 'Casablanca',
    country: 'Morocco',
    flag: '🇲🇦',
    continent: 'Africa',
    timezone: 'Africa/Casablanca',
    lat: 33.5731,
    lng: -7.5898,
    description: 'North African Trade & Port Center',
    color: '#B45309',
  },

  // --- Oceania ---
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    flag: '🇦🇺',
    continent: 'Oceania',
    timezone: 'Australia/Sydney',
    lat: -33.8688,
    lng: 151.2093,
    description: 'Australia Financial & Maritime Capital',
    color: '#2563EB',
  },
  {
    id: 'melbourne',
    name: 'Melbourne',
    country: 'Australia',
    flag: '🇦🇺',
    continent: 'Oceania',
    timezone: 'Australia/Melbourne',
    lat: -37.8136,
    lng: 144.9631,
    description: 'Cultural & Sporting Capital of Australia',
    color: '#4F46E5',
  },
  {
    id: 'perth',
    name: 'Perth',
    country: 'Australia',
    flag: '🇦🇺',
    continent: 'Oceania',
    timezone: 'Australia/Perth',
    lat: -31.9505,
    lng: 115.8605,
    description: 'Western Australia Resources Capital',
    color: '#0D9488',
  },
  {
    id: 'auckland',
    name: 'Auckland',
    country: 'New Zealand',
    flag: '🇳🇿',
    continent: 'Oceania',
    timezone: 'Pacific/Auckland',
    lat: -36.8485,
    lng: 174.7633,
    description: 'First Major World City to Greet the Day',
    color: '#059669',
  },
];

/**
 * Calculates real-time time information for any timezone
 */
export function getTimeInfo(timeZone, baseDate = new Date()) {
  try {
    const now = baseDate;

    // Formatter for full digital time
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const time24Formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    });

    const tzNameFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    });

    const tzLongFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'long',
    });

    const timeStr = timeFormatter.format(now);
    const time24Str = time24Formatter.format(now);
    const dateStr = dateFormatter.format(now);
    const shortDateStr = shortDateFormatter.format(now);
    const hour = parseInt(hourFormatter.format(now), 10);

    // Extract time zone name
    const tzParts = tzNameFormatter.formatToParts(now);
    const tzPart = tzParts.find((p) => p.type === 'timeZoneName');
    const tzAbbr = tzPart ? tzPart.value : timeZone;

    const tzLongParts = tzLongFormatter.formatToParts(now);
    const tzLongPart = tzLongParts.find((p) => p.type === 'timeZoneName');
    const tzLongName = tzLongPart ? tzLongPart.value : timeZone;

    // Calculate UTC offset
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const targetDate = new Date(now.toLocaleString('en-US', { timeZone }));
    const diffMinutes = Math.round((targetDate.getTime() - utcDate.getTime()) / 60000);

    const sign = diffMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(diffMinutes);
    const offsetHours = Math.floor(absMinutes / 60);
    const offsetMins = absMinutes % 60;
    const utcOffsetStr = `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // Relative to user local timezone
    const userLocalMinutes = -now.getTimezoneOffset();
    const userDiffMinutes = diffMinutes - userLocalMinutes;
    let relativeStr = 'Same as your time';
    if (userDiffMinutes > 0) {
      const h = Math.floor(userDiffMinutes / 60);
      const m = userDiffMinutes % 60;
      relativeStr = m > 0 ? `${h}h ${m}m ahead` : `${h}h ahead`;
    } else if (userDiffMinutes < 0) {
      const h = Math.floor(Math.abs(userDiffMinutes) / 60);
      const m = Math.abs(userDiffMinutes) % 60;
      relativeStr = m > 0 ? `${h}h ${m}m behind` : `${h}h behind`;
    }

    const isDaytime = hour >= 6 && hour < 18;
    const isBusinessHours = hour >= 9 && hour < 17;

    return {
      time: timeStr,
      time24: time24Str,
      date: dateStr,
      shortDate: shortDateStr,
      hour,
      tzAbbr,
      tzLongName,
      utcOffset: utcOffsetStr,
      diffMinutes,
      relativeToUser: relativeStr,
      isDaytime,
      isBusinessHours,
    };
  } catch {
    return {
      time: '--:--:--',
      time24: '--:--',
      date: 'Unknown Date',
      shortDate: '',
      hour: 12,
      tzAbbr: 'UTC',
      tzLongName: 'Coordinated Universal Time',
      utcOffset: 'UTC+00:00',
      diffMinutes: 0,
      relativeToUser: '',
      isDaytime: true,
      isBusinessHours: false,
    };
  }
}

/**
 * Finds the nearest world city given latitude and longitude coordinates
 */
export function findNearestCity(lat, lng) {
  let nearest = WORLD_CITIES[0];
  let minDistance = Infinity;

  // Simple haversine-like squared distance calculation
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
