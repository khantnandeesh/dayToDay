import { useState, useEffect, useMemo } from 'react';
import WorldGlobe3D from './WorldGlobe3D';
import WorldMap2D from './WorldMap2D';
import { CONTINENTS, WORLD_CITIES, getTimeInfo } from '../data/worldTimezones';
import {
  Globe,
  Map as MapIcon,
  Search,
  Sun,
  Moon,
  Briefcase,
  Compass,
  ArrowRightLeft,
  Calendar,
  Activity,
  Maximize2,
} from 'lucide-react';

const WorldTimeExplorer = () => {
  const [viewMode, setViewMode] = useState('globe'); // 'globe' | 'map'
  const [is24Hour, setIs24Hour] = useState(true);
  const [selectedContinent, setSelectedContinent] = useState('all');
  const [selectedCity, setSelectedCity] = useState(
    () => WORLD_CITIES.find((c) => c.id === 'tokyo') || WORLD_CITIES[0]
  );
  const [targetFocusCoord, setTargetFocusCoord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());

  // High-frequency tick for smooth chronometer (100ms interval for precision)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Filtered cities based on continent & search query
  const filteredCities = useMemo(() => {
    return WORLD_CITIES.filter((city) => {
      const matchContinent =
        selectedContinent === 'all' || city.continent === selectedContinent;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        city.name.toLowerCase().includes(q) ||
        city.country.toLowerCase().includes(q) ||
        city.code.toLowerCase().includes(q) ||
        city.iata.toLowerCase().includes(q) ||
        city.continent.toLowerCase().includes(q) ||
        city.timezone.toLowerCase().includes(q);
      return matchContinent && matchSearch;
    });
  }, [selectedContinent, searchQuery]);

  // Selected city live time info
  const activeTimeInfo = useMemo(() => {
    return getTimeInfo(selectedCity.timezone, now);
  }, [selectedCity, now]);

  // Local device time
  const userLocalTimeInfo = useMemo(() => {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getTimeInfo(localTz, now);
  }, [now]);

  // Master UTC Zulu time
  const utcTimeInfo = useMemo(() => {
    return getTimeInfo('UTC', now);
  }, [now]);

  // Handle city selection
  const handleSelectCity = (city, meta = null) => {
    setSelectedCity(city);
    if (meta?.clickedLat && meta?.clickedLng) {
      setTargetFocusCoord({ lat: meta.clickedLat, lng: meta.clickedLng });
    } else {
      setTargetFocusCoord({ lat: city.lat, lng: city.lng });
    }
  };

  // Handle continent filter selection
  const handleSelectContinent = (continentId) => {
    setSelectedContinent(continentId);
    const continentObj = CONTINENTS.find((c) => c.id === continentId);
    if (continentObj && continentObj.centerLat !== undefined) {
      setTargetFocusCoord({
        lat: continentObj.centerLat,
        lng: continentObj.centerLng,
      });
      const firstCity = WORLD_CITIES.find((c) => c.continent === continentId);
      if (firstCity) {
        setSelectedCity(firstCity);
      }
    }
  };

  // Calculate 24-hour dial hand rotation angle (0 to 360 deg)
  const dialAngle =
    ((activeTimeInfo.hour * 3600 +
      activeTimeInfo.minute * 60 +
      activeTimeInfo.second) /
      86400) *
    360;

  return (
    <div className="w-full bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden text-slate-100 font-sans">
      {/* Top Cockpit Header Bar */}
      <div className="p-5 md:p-6 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/60">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Planetary Satellite Telemetry & Precision Chronometer</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-0.5">
            NASA Satellite World Instrument
          </h2>
        </div>

        {/* Global Controls & Master Zulu Reference */}
        <div className="flex flex-wrap items-center gap-3">
          {/* UTC Zulu Reference Bar */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 text-[10px]">ZULU:</span>
            <strong className="text-cyan-400 font-bold tracking-wider">
              {utcTimeInfo.time24} Z
            </strong>
          </div>

          {/* Local Device Sync */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 text-[10px]">LOCAL:</span>
            <strong className="text-slate-200 font-bold">
              {is24Hour ? userLocalTimeInfo.time24 : userLocalTimeInfo.time}
            </strong>
          </div>

          {/* 3D Globe vs 2D Map Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setViewMode('globe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'globe'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Satellite</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'map'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/60 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>2D Satellite</span>
            </button>
          </div>

          {/* 24h / 12h Toggle */}
          <button
            onClick={() => setIs24Hour(!is24Hour)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs font-mono text-slate-300 transition-colors"
          >
            {is24Hour ? '24H MIL' : '12H STD'}
          </button>
        </div>
      </div>

      {/* Minimalist Regional Filter Strip */}
      <div className="px-5 md:px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none font-mono text-xs">
        <span className="text-[10px] text-slate-400 tracking-wider uppercase mr-1">
          REGION:
        </span>
        {CONTINENTS.map((continent) => {
          const isActive = selectedContinent === continent.id;
          return (
            <button
              key={continent.id}
              onClick={() => handleSelectContinent(continent.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {continent.name}
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage */}
      <div className="p-5 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 3D Globe / 2D Map (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
            {viewMode === 'globe' ? (
              <WorldGlobe3D
                selectedCity={selectedCity}
                onSelectCity={handleSelectCity}
                targetFocusCoord={targetFocusCoord}
              />
            ) : (
              <WorldMap2D
                selectedCity={selectedCity}
                onSelectCity={handleSelectCity}
              />
            )}

            {/* Quick Nodes Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider shrink-0">
                NODES:
              </span>
              {filteredCities.slice(0, 8).map((city) => {
                const isSelected = selectedCity.id === city.id;
                const cTime = getTimeInfo(city.timezone, now);
                return (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCity(city)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shrink-0 transition-all ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-700/80 text-cyan-300'
                        : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold tracking-wider">{city.code}</span>
                    <span className="text-[11px] font-sans">{city.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {is24Hour ? cTime.time24 : cTime.time.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Precision Chronometer Instrument (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
            {/* Primary Precision Chronometer Card */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
              {/* Subtle radial glow */}
              <div
                className="absolute -top-16 -right-16 w-52 h-52 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ backgroundColor: selectedCity.color || '#38bdf8' }}
              />

              {/* City Header & Airport/ISO Badge */}
              <div className="flex items-start justify-between gap-3 relative z-10 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono font-bold text-xs border border-cyan-800/80">
                      {selectedCity.code}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {selectedCity.iata} / {selectedCity.countryCode}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    {selectedCity.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedCity.country} · {selectedCity.continent}
                  </p>
                </div>

                {/* Day / Night Indicator Pill */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
                    activeTimeInfo.isDaytime
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                      : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
                  }`}
                >
                  {activeTimeInfo.isDaytime ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>DAY</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>NIGHT</span>
                    </>
                  )}
                </div>
              </div>

              {/* Digital Big Chronometer Display with Millisecond Ticker */}
              <div className="my-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm relative z-10 text-center">
                <div className="text-4xl md:text-5xl font-mono font-black tracking-tight text-white tabular-nums drop-shadow-sm flex items-baseline justify-center gap-1">
                  <span>{is24Hour ? activeTimeInfo.time24 : activeTimeInfo.time}</span>
                  <span className="text-sm font-normal text-cyan-400 font-mono opacity-80">
                    .{activeTimeInfo.ms}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{activeTimeInfo.date}</span>
                </div>
              </div>

              {/* 24-Hour Observatory Solar Dial Gauge */}
              <div className="my-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 relative z-10 flex items-center justify-between gap-4">
                {/* Miniature 24h Circular Dial */}
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  {/* Outer bezel */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3"
                    />
                    {/* Daylight arc (06:00 to 18:00 is half circle) */}
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeDasharray="88 88"
                      strokeDashoffset="-44"
                      strokeOpacity="0.4"
                    />
                    {/* Indicator pointer */}
                    <line
                      x1="32"
                      y1="32"
                      x2={32 + 22 * Math.cos((dialAngle * Math.PI) / 180)}
                      y2={32 + 22 * Math.sin((dialAngle * Math.PI) / 180)}
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="32" cy="32" r="3" fill="#38bdf8" />
                  </svg>
                  <span className="absolute text-[8px] font-mono text-slate-400 top-1">
                    00
                  </span>
                  <span className="absolute text-[8px] font-mono text-slate-400 bottom-1">
                    12
                  </span>
                </div>

                {/* Solar Elevation and Zenith metadata */}
                <div className="flex-1 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>SOLAR ELEVATION:</span>
                    <strong className="text-slate-200">
                      {activeTimeInfo.solarElevation > 0 ? '+' : ''}
                      {activeTimeInfo.solarElevation}°
                    </strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            ((activeTimeInfo.solarElevation + 90) / 180) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>NADIR (00H)</span>
                    <span>ZENITH (12H)</span>
                  </div>
                </div>
              </div>

              {/* Time Details Grid */}
              <div className="grid grid-cols-2 gap-2 my-4 relative z-10 text-xs font-mono">
                {/* UTC Offset & Timezone */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase mb-0.5">
                    TIMEZONE
                  </span>
                  <strong className="text-slate-200 font-semibold block truncate">
                    {activeTimeInfo.tzAbbr}
                  </strong>
                  <span className="text-[11px] text-cyan-400">
                    {activeTimeInfo.utcOffset}
                  </span>
                </div>

                {/* Financial Market Status */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase mb-0.5">
                    MARKET [{selectedCity.market || 'FIN'}]
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeTimeInfo.isBusinessHours
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        activeTimeInfo.isBusinessHours
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {activeTimeInfo.isBusinessHours ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">09:00 - 17:00</span>
                </div>

                {/* Coordinates */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase mb-0.5">
                    COORDINATES
                  </span>
                  <span className="text-slate-200 block text-[11px]">
                    {Math.abs(selectedCity.lat).toFixed(2)}°{' '}
                    {selectedCity.lat >= 0 ? 'N' : 'S'}
                  </span>
                  <span className="text-slate-400 block text-[11px]">
                    {Math.abs(selectedCity.lng).toFixed(2)}°{' '}
                    {selectedCity.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>

                {/* Relative to local device clock */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase mb-0.5">
                    LOCAL DELTA
                  </span>
                  <div className="flex items-center gap-1 text-slate-200 font-semibold">
                    <ArrowRightLeft className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="text-[11px] truncate">
                      {activeTimeInfo.relativeToUser}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">vs user machine</span>
                </div>
              </div>

              {/* Hub description */}
              {selectedCity.description && (
                <div className="mt-2 text-xs text-slate-400 border-t border-slate-800/80 pt-3 flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[11px]">{selectedCity.description}</span>
                </div>
              )}
            </div>

            {/* City Search Bar & Filter */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2 font-mono text-xs">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  FILTER HUBS
                </span>
                <span className="text-slate-400 text-[11px]">
                  {filteredCities.length} locations
                </span>
              </div>

              {/* Search input */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code, city, country, or timezone..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono transition-all"
                />
              </div>

              {/* Scrollable List of Cities */}
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                {filteredCities.length === 0 ? (
                  <div className="text-center py-3 text-slate-400 text-xs">
                    No matching locations found
                  </div>
                ) : (
                  filteredCities.map((city) => {
                    const isSelected = selectedCity.id === city.id;
                    const cInfo = getTimeInfo(city.timezone, now);
                    return (
                      <button
                        key={city.id}
                        onClick={() => handleSelectCity(city)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-semibold'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400 font-bold border border-slate-800">
                            {city.code}
                          </span>
                          <span className="truncate text-slate-200 font-sans text-xs">
                            {city.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            [{city.countryCode}]
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {is24Hour ? cInfo.time24 : cInfo.time.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Global Financial Market Ribbon at Bottom */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3 font-mono text-xs">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>GLOBAL FINANCIAL CENTERS</span>
            </span>
            <span className="text-slate-400 text-[10px]">REAL-TIME TICKER</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono">
            {[
              { id: 'tokyo', name: 'Tokyo', code: 'TYO', market: 'TSE' },
              { id: 'hong_kong', name: 'Hong Kong', code: 'HKG', market: 'HKEX' },
              { id: 'dubai', name: 'Dubai', code: 'DXB', market: 'DFM' },
              { id: 'london', name: 'London', code: 'LON', market: 'LSE' },
              { id: 'new_york', name: 'New York', code: 'NYC', market: 'NYSE' },
              { id: 'san_francisco', name: 'San Francisco', code: 'SFO', market: 'NASDAQ' },
            ].map((refCity) => {
              const fullCity = WORLD_CITIES.find((c) => c.id === refCity.id);
              if (!fullCity) return null;
              const isSelected = selectedCity.id === fullCity.id;
              const tInfo = getTimeInfo(fullCity.timezone, now);

              return (
                <button
                  key={refCity.id}
                  onClick={() => handleSelectCity(fullCity)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-700 ring-1 ring-cyan-500/30'
                      : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">
                      {refCity.code}
                    </span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                        tInfo.isBusinessHours
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {tInfo.isBusinessHours ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate font-sans">
                    {refCity.name}
                  </div>
                  <div className="text-sm font-bold text-white tracking-tight mt-0.5">
                    {is24Hour ? tInfo.time24 : tInfo.time}
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-0.5">
                    {tInfo.utcOffset}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldTimeExplorer;
