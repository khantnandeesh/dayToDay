import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WORLD_CITIES, findNearestCity, getTimeInfo } from '../data/worldTimezones';
import { WORLD_NORMALIZED_RINGS } from '../data/worldMapData';
import { RotateCw, ZoomIn, ZoomOut, Compass, Play, Pause, MapPin } from 'lucide-react';

const GLOBE_RADIUS = 100;

// Convert Lat/Lng to 3D Cartesian coordinates on sphere
function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Generate world landmass canvas texture using precomputed continental geometry
function createWorldTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep space ocean background
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#0a1026');
  oceanGrad.addColorStop(0.5, '#0d1838');
  oceanGrad.addColorStop(1, '#080d20');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Draw delicate graticule grid lines (every 15 degrees)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.lineWidth = 1;
  // Longitude verticals (24 steps for 360 deg)
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * width;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  // Latitude horizontals (12 steps for 180 deg)
  for (let j = 0; j <= 12; j++) {
    const y = (j / 12) * height;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Highlight Equator and Prime Meridian
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
  ctx.lineWidth = 1.5;
  // Equator
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  // Prime Meridian
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Render landmasses
  ctx.beginPath();
  for (let r = 0; r < WORLD_NORMALIZED_RINGS.length; r++) {
    const ring = WORLD_NORMALIZED_RINGS[r];
    for (let i = 0; i < ring.length; i++) {
      const px = ring[i][0] * width;
      const py = ring[i][1] * height;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  // Land fill
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  // Coastline glowing stroke
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0; // reset shadow

  return new THREE.CanvasTexture(canvas);
}

const WorldGlobe3D = ({
  selectedCity,
  onSelectCity,
  targetFocusCoord,
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const globeGroupRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const markersGroupRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // References for dragging and interaction state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.2, y: 0 });
  const currentRotationRef = useRef({ x: 0.2, y: 0 });
  const cameraDistanceRef = useRef(260);

  // Pulse ring animation reference
  const ringsRef = useRef([]);

  // Rotate globe smoothly towards coordinates
  const flyToCoord = useCallback((lat, lng) => {
    // Calculate target rotation Y and X to center this lat/lng facing the camera (+Z)
    const targetY = -((lng + 180) * (Math.PI / 180)) + Math.PI / 2;
    const targetX = (lat * (Math.PI / 180));

    targetRotationRef.current = {
      x: Math.max(-1.2, Math.min(1.2, targetX)),
      y: targetY,
    };
  }, []);

  // When targetFocusCoord changes, fly to it
  useEffect(() => {
    if (targetFocusCoord && typeof targetFocusCoord.lat === 'number') {
      flyToCoord(targetFocusCoord.lat, targetFocusCoord.lng);
    }
  }, [targetFocusCoord, flyToCoord]);

  // When selectedCity changes, also smoothly focus on it
  useEffect(() => {
    if (selectedCity && selectedCity.lat) {
      flyToCoord(selectedCity.lat, selectedCity.lng);
    }
  }, [selectedCity, flyToCoord]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.z = cameraDistanceRef.current;
    cameraRef.current = camera;

    // WebGL Renderer with high pixel ratio and alpha
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Main Group containing the rotating globe and pins
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // Globe Texture & Sphere
    const worldTexture = createWorldTexture();
    const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      map: worldTexture,
      shininess: 25,
      specular: new THREE.Color(0x1e293b),
      emissive: new THREE.Color(0x050a18),
      emissiveIntensity: 0.3,
    });
    const globeMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeMesh.name = 'globe_sphere';
    globeGroup.add(globeMesh);

    // Atmospheric outer glow shell
    const atmosphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 48, 48);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphereMesh);

    // Outer soft blue halo
    const haloGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.07, 32, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    globeGroup.add(haloMesh);

    // Subtle starfield particles in deep background
    const starsCount = 400;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 800;
      starPositions[i + 1] = (Math.random() - 0.5) * 800;
      starPositions[i + 2] = -150 - Math.random() * 300;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.5,
      transparent: true,
      opacity: 0.4,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(300, 150, 200);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.8);
    rimLight.position.set(-300, -100, -200);
    scene.add(rimLight);

    // Markers Group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    globeGroup.add(markersGroup);

    // Populate City Markers
    const pinGeometry = new THREE.SphereGeometry(2.0, 16, 16);
    const ringGeometry = new THREE.RingGeometry(2.5, 3.5, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });

    const activeRings = [];

    WORLD_CITIES.forEach((city) => {
      const pos = latLngToVector3(city.lat, city.lng, GLOBE_RADIUS * 1.01);

      // Pin core mesh
      const pinMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
      });
      const pinMesh = new THREE.Mesh(pinGeometry, pinMaterial);
      pinMesh.position.copy(pos);
      pinMesh.userData = { city, isPin: true };
      markersGroup.add(pinMesh);

      // Pulsing Ring oriented tangent to the sphere surface
      const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial.clone());
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      ringMesh.userData = { city, isRing: true, baseScale: 1, pulseSpeed: 0.02 + Math.random() * 0.01 };
      markersGroup.add(ringMesh);
      activeRings.push(ringMesh);

      // Vertical marker stalk pointing outwards
      const stalkGeom = new THREE.BufferGeometry().setFromPoints([
        pos,
        pos.clone().multiplyScalar(1.04),
      ]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
        transparent: true,
        opacity: 0.6,
      });
      const stalk = new THREE.Line(stalkGeom, stalkMat);
      markersGroup.add(stalk);
    });

    ringsRef.current = activeRings;

    // Responsive Canvas Resize via ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Smooth interpolation for rotation
      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.002;
      }

      // Smooth damping / slerp towards target rotation
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

      if (globeGroupRef.current) {
        globeGroupRef.current.rotation.x = currentRotationRef.current.x;
        globeGroupRef.current.rotation.y = currentRotationRef.current.y;
      }

      // Animate pulsing rings
      const time = clock.getElapsedTime();
      ringsRef.current.forEach((ring, idx) => {
        const scale = 1 + 0.5 * Math.sin(time * 3 + idx);
        ring.scale.set(scale, scale, scale);
        ring.material.opacity = Math.max(0.2, 0.8 - (scale - 1) * 0.6);
      });

      // Smooth camera zoom
      camera.position.z += (cameraDistanceRef.current - camera.position.z) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      worldTexture.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      pinGeometry.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    };
  }, [autoRotate]);

  // Raycasting for click detection on cities and sphere surface
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = {
      x: e.clientX || (e.touches && e.touches[0].clientX) || 0,
      y: e.clientY || (e.touches && e.touches[0].clientY) || 0,
    };
  };

  const handlePointerMove = (e) => {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

    if (isDraggingRef.current) {
      const deltaX = clientX - previousMousePositionRef.current.x;
      const deltaY = clientY - previousMousePositionRef.current.y;

      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x = Math.max(
        -1.2,
        Math.min(1.2, targetRotationRef.current.x + deltaY * 0.005)
      );

      previousMousePositionRef.current = { x: clientX, y: clientY };
      setHoveredCity(null);
      return;
    }

    // Hover Raycasting
    if (!rendererRef.current || !cameraRef.current || !globeGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);

    if (markersGroupRef.current) {
      const intersects = raycaster.intersectObjects(markersGroupRef.current.children, true);
      const hitPin = intersects.find((hit) => hit.object?.userData?.city);

      if (hitPin) {
        setHoveredCity(hitPin.object.userData.city);
        setTooltipPos({ x: clientX - rect.left, y: clientY - rect.top });
        mountRef.current.style.cursor = 'pointer';
        return;
      }
    }

    mountRef.current.style.cursor = 'grab';
    setHoveredCity(null);
  };

  const handlePointerUp = (e) => {
    isDraggingRef.current = false;

    // Check if it was a quick click rather than a drag
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0;
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY) || 0;

    if (
      Math.abs(clientX - previousMousePositionRef.current.x) < 5 &&
      Math.abs(clientY - previousMousePositionRef.current.y) < 5
    ) {
      performClickRaycast(clientX, clientY);
    }
  };

  const performClickRaycast = (clientX, clientY) => {
    if (!rendererRef.current || !cameraRef.current || !globeGroupRef.current || !mountRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);

    // Check city pins first
    if (markersGroupRef.current) {
      const pinHits = raycaster.intersectObjects(markersGroupRef.current.children, true);
      const hit = pinHits.find((h) => h.object?.userData?.city);
      if (hit && hit.object.userData.city) {
        onSelectCity(hit.object.userData.city);
        return;
      }
    }

    // Check globe sphere intersection to calculate (lat, lng) from click
    const globeHits = raycaster.intersectObjects(globeGroupRef.current.children, false);
    const sphereHit = globeHits.find((h) => h.object?.name === 'globe_sphere');

    if (sphereHit && sphereHit.point) {
      // Convert world hit point into globe's local coordinate space
      const localPoint = sphereHit.point.clone();
      globeGroupRef.current.worldToLocal(localPoint);

      // Invert sphere math:
      // y = radius * cos(phi) => phi = acos(y / radius)
      // lat = 90 - phi_deg
      const normY = Math.max(-1, Math.min(1, localPoint.y / GLOBE_RADIUS));
      const phi = Math.acos(normY);
      const lat = 90 - (phi * 180) / Math.PI;

      // x = -R * sin(phi) * cos(theta), z = R * sin(phi) * sin(theta)
      // theta = atan2(z, -x)
      // lng = theta_deg - 180
      const theta = Math.atan2(localPoint.z, -localPoint.x);
      let lng = (theta * 180) / Math.PI - 180;
      while (lng < -180) lng += 360;
      while (lng > 180) lng -= 360;

      // Find the nearest city to this clicked point
      const nearest = findNearestCity(lat, lng);
      onSelectCity(nearest, { clickedLat: lat, clickedLng: lng });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    cameraDistanceRef.current = Math.max(160, Math.min(360, cameraDistanceRef.current + e.deltaY * 0.2));
  };

  const zoomIn = () => {
    cameraDistanceRef.current = Math.max(160, cameraDistanceRef.current - 35);
  };

  const zoomOut = () => {
    cameraDistanceRef.current = Math.min(360, cameraDistanceRef.current + 35);
  };

  const resetOrientation = () => {
    targetRotationRef.current = { x: 0.2, y: 0 };
    cameraDistanceRef.current = 260;
  };

  return (
    <div className="relative w-full h-[450px] md:h-[550px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center select-none group">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Atmospheric Vignette overlay */}
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent via-transparent to-slate-950/60" />

      {/* Floating Instructions Pill */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shadow-lg">
        <RotateCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
        <span>Drag to rotate · Click any point or city pin</span>
      </div>

      {/* Controls Bar (Right Edge) */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2.5 rounded-xl backdrop-blur-md border transition-all text-xs font-semibold flex items-center justify-center shadow-lg ${
            autoRotate
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30'
              : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
          title={autoRotate ? 'Pause Rotation' : 'Resume Auto-Rotate'}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={zoomIn}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all shadow-lg flex items-center justify-center"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={zoomOut}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all shadow-lg flex items-center justify-center"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={resetOrientation}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all shadow-lg flex items-center justify-center"
          title="Reset View"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredCity && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-white text-xs shadow-2xl transition-transform"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 12}px` }}
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-100">
            <span>{hoveredCity.flag}</span>
            <span>{hoveredCity.name}</span>
            <span className="text-slate-400 font-normal">({hoveredCity.country})</span>
          </div>
          <div className="text-cyan-400 font-mono text-[11px] mt-0.5">
            {getTimeInfo(hoveredCity.timezone).time} · {getTimeInfo(hoveredCity.timezone).utcOffset}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Click to view full timezone details
          </div>
        </div>
      )}

      {/* Bottom Status bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-rose-400" />
          <span>
            {selectedCity ? `${selectedCity.name}, ${selectedCity.country}` : 'Select a location on the globe'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px]">
          <span>Planetary Coordinate Engine</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
        </div>
      </div>
    </div>
  );
};

export default WorldGlobe3D;
