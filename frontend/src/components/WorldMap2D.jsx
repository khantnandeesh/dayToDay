import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import landTopology from '../data/land-110m.json';
import { WORLD_CITIES, getTimeInfo } from '../data/worldTimezones';
import { Clock, MapPin } from 'lucide-react';

const WorldMap2D = ({ selectedCity, onSelectCity }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 900, height: 480 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const height = Math.max(340, Math.min(560, width * 0.52));
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Natural Earth 1 projection provides a balanced, realistic continental view
    const projection = d3
      .geoNaturalEarth1()
      .scale(width / 5.6)
      .translate([width / 2, height / 2]);

    const pathGenerator = d3.geoPath(projection);

    // Defs for gradients & filters
    const defs = svg.append('defs');

    const oceanGrad = defs
      .append('linearGradient')
      .attr('id', 'ocean-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    oceanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#091024');
    oceanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0e172e');

    const pinGlow = defs.append('filter').attr('id', 'pin-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    pinGlow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMerge = pinGlow.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Background Ocean
    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#ocean-gradient)')
      .attr('rx', 24);

    // Time Zone Meridian Stripes / Graticules
    const graticuleGroup = svg.append('g').attr('class', 'graticules');
    const graticule = d3.geoGraticule().step([15, 15]);

    graticuleGroup
      .append('path')
      .datum(graticule)
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(99, 102, 241, 0.12)')
      .attr('stroke-width', 0.75);

    // Landmasses
    const landFeatures = feature(landTopology, landTopology.objects.land);
    const landGroup = svg.append('g').attr('class', 'land');

    landGroup
      .append('path')
      .datum(landFeatures)
      .attr('d', pathGenerator)
      .attr('fill', '#1e293b')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.85);

    // Equator Line Highlight
    const equator = d3.geoGraticule().stepMinor([0, 0]).stepMajor([0, 0]);
    svg
      .append('path')
      .datum(equator)
      .attr('d', pathGenerator)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(129, 140, 248, 0.35)')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,4');

    // World Cities Markers Group
    const citiesGroup = svg.append('g').attr('class', 'cities');

    WORLD_CITIES.forEach((city) => {
      const coords = projection([city.lng, city.lat]);
      if (!coords) return;

      const [x, y] = coords;
      const isSelected = selectedCity?.id === city.id;

      const cityG = citiesGroup
        .append('g')
        .attr('class', 'city-marker cursor-pointer')
        .attr('transform', `translate(${x}, ${y})`)
        .on('mouseenter', (event) => {
          const rect = containerRef.current.getBoundingClientRect();
          setHoveredCity(city);
          setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        })
        .on('mouseleave', () => {
          setHoveredCity(null);
        })
        .on('click', () => {
          onSelectCity(city);
        });

      // Outer animated pulse ring for selected city
      if (isSelected) {
        cityG
          .append('circle')
          .attr('r', 12)
          .attr('fill', 'none')
          .attr('stroke', '#38bdf8')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.8)
          .attr('class', 'animate-ping')
          .style('animation-duration', '2s');
      }

      // Halo ring
      cityG
        .append('circle')
        .attr('r', isSelected ? 8 : 6)
        .attr('fill', city.color || '#38bdf8')
        .attr('fill-opacity', isSelected ? 0.35 : 0.18)
        .attr('stroke', city.color || '#38bdf8')
        .attr('stroke-width', 1.2);

      // Core dot
      cityG
        .append('circle')
        .attr('r', isSelected ? 4.5 : 3)
        .attr('fill', isSelected ? '#ffffff' : (city.color || '#38bdf8'))
        .attr('filter', 'url(#pin-glow)');

      // Label on selected
      if (isSelected) {
        cityG
          .append('text')
          .attr('y', -12)
          .attr('text-anchor', 'middle')
          .attr('fill', '#f8fafc')
          .attr('font-size', '11px')
          .attr('font-weight', '700')
          .attr('class', 'drop-shadow-md')
          .text(`${city.flag} ${city.name}`);
      }
    });
  }, [dimensions, selectedCity, onSelectCity]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[450px] md:h-[550px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center select-none"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full block"
      />

      {/* Floating Instructions Pill */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shadow-lg">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        <span>Natural Earth Projection · Click any city dot</span>
      </div>

      {/* Hover Tooltip */}
      {hoveredCity && (
        <div
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
          <span>Equirectangular Natural Projection</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap2D;
