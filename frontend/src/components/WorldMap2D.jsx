import { useRef, useState } from 'react';
import { WORLD_CITIES, getTimeInfo } from '../data/worldTimezones';
import { WORLD_MAP_SVG_PATH } from '../data/worldMapData';
import { Clock, MapPin } from 'lucide-react';

const WorldMap2D = ({ selectedCity, onSelectCity }) => {
  const containerRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Convert longitude and latitude into 1000 x 500 SVG equirectangular coordinates
  const getCoords = (lat, lng) => {
    const x = ((lng + 180) / 360) * 1000;
    const y = ((90 - lat) / 180) * 500;
    return { x, y };
  };

  const handleMouseEnter = (city, event) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoveredCity(city);
    setTooltipPos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div
      ref={containerRef}
      id="world-map-2d-container"
      className="relative w-full h-[450px] md:h-[550px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center select-none"
    >
      <svg
        id="world-map-2d-svg"
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
      >
        <defs>
          <linearGradient id="ocean-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#091024" />
            <stop offset="100%" stopColor="#0e172e" />
          </linearGradient>

          <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean Background */}
        <rect width="1000" height="500" fill="url(#ocean-gradient)" rx="24" />

        {/* Graticule Longitude & Latitude Meridian Lines (15 deg intervals) */}
        <g id="map-graticules" stroke="rgba(99, 102, 241, 0.12)" strokeWidth="0.75" fill="none">
          {/* Longitude lines */}
          {Array.from({ length: 25 }).map((_, i) => {
            const x = (i / 24) * 1000;
            return <line key={`lon-${i}`} x1={x} y1="0" x2={x} y2="500" />;
          })}
          {/* Latitude lines */}
          {Array.from({ length: 13 }).map((_, j) => {
            const y = (j / 12) * 500;
            return <line key={`lat-${j}`} x1="0" y1={y} x2="1000" y2={y} />;
          })}
        </g>

        {/* Equator line */}
        <line
          x1="0"
          y1="250"
          x2="1000"
          y2="250"
          stroke="rgba(129, 140, 248, 0.35)"
          strokeWidth="1.2"
          strokeDasharray="4,4"
        />

        {/* Prime Meridian line */}
        <line
          x1="500"
          y1="0"
          x2="500"
          y2="500"
          stroke="rgba(129, 140, 248, 0.25)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />

        {/* Continents & Landmasses */}
        <path
          id="world-continents-path"
          d={WORLD_MAP_SVG_PATH}
          fill="#1e293b"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeOpacity="0.85"
        />

        {/* City Markers */}
        <g id="world-cities-markers">
          {WORLD_CITIES.map((city) => {
            const { x, y } = getCoords(city.lat, city.lng);
            const isSelected = selectedCity?.id === city.id;
            const cityColor = city.color || '#38bdf8';

            return (
              <g
                key={city.id}
                id={`city-marker-${city.id}`}
                className="cursor-pointer transition-transform duration-150"
                transform={`translate(${x}, ${y})`}
                onMouseEnter={(e) => handleMouseEnter(city, e)}
                onMouseLeave={() => setHoveredCity(null)}
                onClick={() => onSelectCity(city)}
              >
                {/* Outer animated pulse ring for selected city */}
                {isSelected && (
                  <circle
                    r="12"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                    className="animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                )}

                {/* Halo ring */}
                <circle
                  r={isSelected ? 8 : 6}
                  fill={cityColor}
                  fillOpacity={isSelected ? 0.35 : 0.18}
                  stroke={cityColor}
                  strokeWidth="1.2"
                />

                {/* Core dot */}
                <circle
                  r={isSelected ? 4.5 : 3}
                  fill={isSelected ? '#ffffff' : cityColor}
                  filter="url(#pin-glow)"
                />

                {/* City name text label for selected city */}
                {isSelected && (
                  <text
                    y="-12"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="11px"
                    fontWeight="700"
                    className="drop-shadow-md"
                  >
                    {city.flag} {city.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Instructions Pill */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shadow-lg">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        <span>Equirectangular World Map · Click any city</span>
      </div>

      {/* Hover Tooltip */}
      {hoveredCity && (
        <div
          id="map-city-tooltip"
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-white text-xs shadow-2xl"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 10}px` }}
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-100">
            <span>{hoveredCity.flag}</span>
            <span>{hoveredCity.name}</span>
            <span className="text-slate-400 font-normal">({hoveredCity.country})</span>
          </div>
          <div className="text-cyan-400 font-mono text-[11px] mt-0.5">
            {getTimeInfo(hoveredCity.timezone).time} · {getTimeInfo(hoveredCity.timezone).utcOffset}
          </div>
        </div>
      )}

      {/* Bottom Status bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-rose-400" />
          <span>
            {selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : 'Select a location on the map'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
          <span>Planetary Graticule Projection</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap2D;
