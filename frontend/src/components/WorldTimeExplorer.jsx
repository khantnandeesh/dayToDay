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
  Navigation,
  Clock,
  ArrowRightLeft,
  Sparkles,
  Calendar,
} from 'lucide-react';

const WorldTimeExplorer = () => {
  const [viewMode, setViewMode] = useState('globe'); // 'globe' | 'map'
  const [is24Hour, setIs24Hour] = useState(false);
  const [selectedContinent, setSelectedContinent] = useState('all');
  const [selectedCity, setSelectedCity] = useState(
    () => WORLD_CITIES.find((c) => c.id === 'tokyo') || WORLD_CITIES[0]
  );
  const [targetFocusCoord, setTargetFocusCoord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());

  // Live timer tick every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtered cities based on continent & search query
  const filteredCities = useMemo(() => {
    return WORLD_CITIES.filter((city) => {
      const matchContinent =
        selectedContinent === 'all' || city.continent === selectedContinent;
      const matchSearch =
        searchQuery.trim() === '' ||
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.continent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.timezone.toLowerCase().includes(searchQuery.toLowerCase());
      return matchContinent && matchSearch;
    });
  }, [selectedContinent, searchQuery]);

  // Selected city live time info
  const activeTimeInfo = useMemo(() => {
    return getTimeInfo(selectedCity.timezone, now);
  }, [selectedCity, now]);

  // User's own local time for direct comparison
  const userLocalTimeInfo = useMemo(() => {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getTimeInfo(localTz, now);
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
      // Also select the first city in this continent
      const firstCityInContinent = WORLD_CITIES.find(
        (c) => c.continent === continentId
      );
      if (firstCityInContinent) {
        setSelectedCity(firstCityInContinent);
      }
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
      {/* Top Header Bar */}
      <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Continental Clock & Planetary Map</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            World Time & 3D Globe
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Rotate the 3D globe, explore planetary time zones, or click any continent point for live local time.
          </p>
        </div>

        {/* View Mode & Time Format Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 3D Globe vs 2D Map Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('globe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'globe'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>3D Globe</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'map'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>2D Map</span>
            </button>
          </div>

          {/* 12h / 24h Toggle */}
          <button
            onClick={() => setIs24Hour(!is24Hour)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
            title="Toggle between 12-hour and 24-hour time format"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{is24Hour ? '24h Military' : '12h AM/PM'}</span>
          </button>

          {/* User's local time chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Your Device:</span>
            <strong className="font-mono font-bold">
              {is24Hour ? userLocalTimeInfo.time24 : userLocalTimeInfo.time}
            </strong>
          </div>
        </div>
      </div>

      {/* Continents Navigation Filter */}
      <div className="px-6 md:px-8 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1">
          Continents:
        </span>
        {CONTINENTS.map((continent) => {
          const isActive = selectedContinent === continent.id;
          return (
            <button
              key={continent.id}
              onClick={() => handleSelectContinent(continent.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span>{continent.icon}</span>
              <span>{continent.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage: 3D Globe / 2D Map + Details Card */}
      <div className="p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Globe/Map (7 or 8 cols on large screen) */}
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

            {/* City Quick-Select Carousel / Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-slate-400 shrink-0">
                Key Cities:
              </span>
              {filteredCities.slice(0, 8).map((city) => {
                const isSelected = selectedCity.id === city.id;
                const cTime = getTimeInfo(city.timezone, now);
                return (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCity(city)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{city.flag}</span>
                    <span className="font-semibold">{city.name}</span>
                    <span className={`font-mono text-[11px] ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                      {is24Hour ? cTime.time24 : cTime.time.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Location Inspector Card (5 or 4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
            {/* Active City Inspector Card */}
            <div className="p-6 rounded-3xl bg-radial from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
              {/* Subtle background glow element */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: selectedCity.color || '#6366f1' }}
              />

              {/* City Header */}
              <div className="flex items-start justify-between gap-3 relative z-10 mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-inner">
                    {selectedCity.flag}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-white">
                      {selectedCity.name}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{selectedCity.country}</span>
                      <span>·</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {selectedCity.continent}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Day / Night Badge */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                    activeTimeInfo.isDaytime
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  }`}
                >
                  {activeTimeInfo.isDaytime ? (
                    <>
                      <Sun className="w-3.5 h-3.5" />
                      <span>Daylight</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      <span>Night</span>
                    </>
                  )}
                </div>
              </div>

              {/* Digital Big Clock Display */}
              <div className="my-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm relative z-10 text-center">
                <div className="text-4xl md:text-5xl font-mono font-black tracking-tight text-white drop-shadow-sm">
                  {is24Hour ? activeTimeInfo.time24 : activeTimeInfo.time}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-300 mt-2 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{activeTimeInfo.date}</span>
                </div>
              </div>

              {/* Time Details Grid */}
              <div className="grid grid-cols-2 gap-2.5 my-4 relative z-10 text-xs">
                {/* UTC Offset */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Timezone</span>
                  <strong className="font-mono text-slate-200 font-semibold block truncate">
                    {activeTimeInfo.tzAbbr}
                  </strong>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {activeTimeInfo.utcOffset}
                  </span>
                </div>

                {/* Business Status */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Business Hours</span>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                    <span
                      className={`font-semibold ${
                        activeTimeInfo.isBusinessHours
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {activeTimeInfo.isBusinessHours ? 'Open Now' : 'Closed'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">09:00 - 17:00</span>
                </div>

                {/* Coordinates */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Coordinates</span>
                  <span className="font-mono text-slate-200 block text-[11px]">
                    {Math.abs(selectedCity.lat).toFixed(2)}° {selectedCity.lat >= 0 ? 'N' : 'S'},
                  </span>
                  <span className="font-mono text-slate-200 block text-[11px]">
                    {Math.abs(selectedCity.lng).toFixed(2)}° {selectedCity.lng >= 0 ? 'E' : 'W'}
                  </span>
                </div>

                {/* Relative to local device time */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[11px] mb-0.5">Relative to You</span>
                  <div className="flex items-center gap-1 text-slate-200 font-semibold">
                    <ArrowRightLeft className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="text-[11px] truncate">{activeTimeInfo.relativeToUser}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">vs device clock</span>
                </div>
              </div>

              {/* Hub description */}
              {selectedCity.description && (
                <div className="mt-3 text-xs text-slate-400 border-t border-white/10 pt-3 flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="italic">{selectedCity.description}</span>
                </div>
              )}
            </div>

            {/* City Search Bar & Filter */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Find Any City / Hub
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {filteredCities.length} locations
                </span>
              </div>

              {/* Search input */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, country, or timezone..."
                  className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Scrollable List of Cities */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {filteredCities.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    No matching cities found
                  </div>
                ) : (
                  filteredCities.map((city) => {
                    const isSelected = selectedCity.id === city.id;
                    const cInfo = getTimeInfo(city.timezone, now);
                    return (
                      <button
                        key={city.id}
                        onClick={() => handleSelectCity(city)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold'
                            : 'hover:bg-white text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{city.flag}</span>
                          <span className="truncate">{city.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({city.continent})
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">
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

        {/* Global Continents Snapshot Grid */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Simultaneous Continental Clocks</span>
            </h4>
            <span className="text-xs text-slate-500">Live synchronized ticks</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', continent: 'Asia' },
              { id: 'london', name: 'London', flag: '🇬🇧', continent: 'Europe' },
              { id: 'new_york', name: 'New York', flag: '🇺🇸', continent: 'North America' },
              { id: 'sao_paulo', name: 'São Paulo', flag: '🇧🇷', continent: 'South America' },
              { id: 'cairo', name: 'Cairo', flag: '🇪🇬', continent: 'Africa' },
              { id: 'sydney', name: 'Sydney', flag: '🇦🇺', continent: 'Oceania' },
            ].map((refCity) => {
              const fullCity = WORLD_CITIES.find((c) => c.id === refCity.id);
              if (!fullCity) return null;
              const isSelected = selectedCity.id === fullCity.id;
              const tInfo = getTimeInfo(fullCity.timezone, now);

              return (
                <button
                  key={refCity.id}
                  onClick={() => handleSelectCity(fullCity)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-slate-50 hover:bg-white hover:border-slate-300 border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">{refCity.flag}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        tInfo.isDaytime
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tInfo.isDaytime ? 'Day' : 'Night'}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate">
                    {refCity.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mb-1">
                    {refCity.continent}
                  </div>
                  <div className="font-mono font-black text-slate-800 text-sm">
                    {is24Hour ? tInfo.time24 : tInfo.time}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium truncate mt-0.5">
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
