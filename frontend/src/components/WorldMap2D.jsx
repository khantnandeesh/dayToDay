import { useRef, useState } from 'react';
import { WORLD_CITIES, getTimeInfo } from '../data/worldTimezones';
import { WORLD_MAP_SVG_PATH } from '../data/worldMapData';
import { Crosshair, MapPin } from 'lucide-react';

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
      className="relative w-full h-[520px] md:h-[620px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl flex items-center justify-center select-none"
    >
      <svg
        id="world-map-2d-svg"
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
      >
        <defs>
          <linearGradient id="ocean-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#040714" />
            <stop offset="50%" stopColor="#0a1438" />
            <stop offset="100%" stopColor="#040714" />
          </linearGradient>

          <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Deep Ocean Background */}
        <rect width="1000" height="500" fill="url(#ocean-gradient)" />

        {/* Graticule Longitude & Latitude Meridian Lines (15 deg intervals) */}
        <g id="map-graticules" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.75" fill="none">
          {/* Longitude lines (24 meridians) */}
          {Array.from({ length: 25 }).map((_, i) => {
            const x = (i / 24) * 1000;
            return <line key={`lon-${i}`} x1={x} y1="0" x2={x} y2="500" />;
          })}
          {/* Latitude lines (12 parallels) */}
          {Array.from({ length: 13 }).map((_, j) => {
            const y = (j / 12) * 500;
            return <line key={`lat-${j}`} x1="0" y1={y} x2="1000" y2={y} />;
          })}
        </g>

        {/* Tropic of Cancer (23.5 N) & Capricorn (23.5 S) */}
        <line
          x1="0"
          y1={((90 - 23.5) / 180) * 500}
          x2="1000"
          y2={((90 - 23.5) / 180) * 500}
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        <line
          x1="0"
          y1={((90 - -23.5) / 180) * 500}
          x2="1000"
          y2={((90 - -23.5) / 180) * 500}
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />

        {/* Equator line */}
        <line
          x1="0"
          y1="250"
          x2="1000"
          y2="250"
          stroke="rgba(56, 189, 248, 0.45)"
          strokeWidth="1.2"
        />

        {/* Prime Meridian line */}
        <line
          x1="500"
          y1="0"
          x2="500"
          y2="500"
          stroke="rgba(56, 189, 248, 0.4)"
          strokeWidth="1"
        />

        {/* Continents & Landmasses */}
        <path
          id="world-continents-path"
          d={WORLD_MAP_SVG_PATH}
          fill="#0f172a"
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
                className="cursor-pointer"
                transform={`translate(${x}, ${y})`}
                onMouseEnter={(e) => handleMouseEnter(city, e)}
                onMouseLeave={() => setHoveredCity(null)}
                onClick={() => onSelectCity(city)}
              >
                {/* Outer animated targeting ring for selected city */}
                {isSelected && (
                  <>
                    <circle
                      r="12"
                      fill="none"
                      stroke="#00ffff"
                      strokeWidth="1.5"
                      strokeOpacity="0.9"
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                    <circle
                      r="16"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                      strokeOpacity="0.6"
                    />
                  </>
                )}

                {/* Halo ring */}
                <circle
                  r={isSelected ? 6 : 4}
                  fill={cityColor}
                  fillOpacity={isSelected ? 0.4 : 0.2}
                  stroke={cityColor}
                  strokeWidth="1"
                />

                {/* Core dot */}
                <circle
                  r={isSelected ? 3.5 : 2.5}
                  fill={isSelected ? '#ffffff' : cityColor}
                  filter="url(#pin-glow)"
                />

                {/* City code label for selected city */}
                {isSelected && (
                  <text
                    y="-12"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontFamily="monospace"
                    fontSize="10px"
                    fontWeight="700"
                    letterSpacing="0.05em"
                  >
                    [{city.code}] {city.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Instructions Pill */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
        <span>EQUIRECTANGULAR PROJECTION 2:1</span>
      </div>

      {/* Hover Tooltip */}
      {hoveredCity && (
        <div
          id="map-city-tooltip"
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-white text-xs shadow-2xl"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 10}px` }}
        >
          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-100">
            <span className="px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] border border-cyan-800">
              {hoveredCity.code}
            </span>
            <span>{hoveredCity.name}</span>
            <span className="text-slate-400 font-normal">[{hoveredCity.countryCode}]</span>
          </div>
          <div className="text-cyan-400 font-mono text-[11px] mt-0.5">
            {getTimeInfo(hoveredCity.timezone).time24} · {getTimeInfo(hoveredCity.timezone).utcOffset}
          </div>
        </div>
      )}

      {/* Bottom Status bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400 pointer-events-none font-mono">
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {selectedCity
              ? `[${selectedCity.code}] ${selectedCity.name}, ${selectedCity.countryCode}`
              : 'SELECT NODE ON GRID'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
          <span>WGS-84 GRID REFERENCE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap2D;
