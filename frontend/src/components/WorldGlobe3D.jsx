import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WORLD_CITIES, GLOBAL_ROUTES, findNearestCity, getTimeInfo } from '../data/worldTimezones';
import { WORLD_NORMALIZED_RINGS } from '../data/worldMapData';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Compass,
  Play,
  Pause,
  Layers,
  Crosshair,
  Radio,
} from 'lucide-react';

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

// Generate high-precision procedural planetary texture with city lights and bathymetry
function createDetailedWorldTexture() {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep space ocean with subtle bathymetric latitude gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#040714');
  oceanGrad.addColorStop(0.25, '#070f2b');
  oceanGrad.addColorStop(0.5, '#0a1438');
  oceanGrad.addColorStop(0.75, '#070f2b');
  oceanGrad.addColorStop(1, '#040714');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle longitude & latitude graticule coordinate grid (every 15 degrees)
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * width;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let j = 0; j <= 12; j++) {
    const y = (j / 12) * height;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Highlight Tropics (23.5 N & 23.5 S) and Polar Circles (66.5 N & 66.5 S)
  const drawParallel = (latDeg, strokeStyle, dash = []) => {
    const y = ((90 - latDeg) / 180) * height;
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawParallel(23.5, 'rgba(56, 189, 248, 0.2)', [4, 4]); // Tropic of Cancer
  drawParallel(-23.5, 'rgba(56, 189, 248, 0.2)', [4, 4]); // Tropic of Capricorn
  drawParallel(66.5, 'rgba(148, 163, 184, 0.2)', [2, 4]); // Arctic
  drawParallel(-66.5, 'rgba(148, 163, 184, 0.2)', [2, 4]); // Antarctic

  // Highlight Equator and Prime Meridian
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2); // Equator
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height); // Prime Meridian
  ctx.stroke();

  // Continental landmasses
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

  // Land fill: deep obsidian slate
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  // Crisp coastline stroke with luminous cyan edge
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.4;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Render illuminated night-side city light clusters
  const drawCityLightCluster = (lng, lat, radius, intensity, color = '#fef08a') => {
    const cx = ((lng + 180) / 360) * width;
    const cy = ((90 - lat) / 180) * height;

    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    radGrad.addColorStop(0, color);
    radGrad.addColorStop(0.3, 'rgba(251, 191, 36, 0.6)');
    radGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.2)');
    radGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // Major global metropolitan lighting clusters
  WORLD_CITIES.forEach((city) => {
    drawCityLightCluster(city.lng, city.lat, 10, 0.9, '#fef08a');
  });

  // Secondary regional urban constellations
  const regionalLights = [
    // US BosWash corridor
    [-71.0, 42.3], [-75.1, 39.9], [-77.0, 38.9],
    // US West Coast & Texas
    [-118.2, 34.0], [-122.3, 47.6], [-95.3, 29.7], [-96.8, 32.7],
    // Western Europe
    [4.3, 50.8], [4.9, 52.3], [7.0, 50.9], [9.1, 45.4], [-0.1, 51.5],
    // East Asia Corridor
    [135.5, 34.6], [139.7, 35.6], [121.4, 31.2], [113.2, 23.1], [126.9, 37.5],
    // South / Southeast Asia
    [77.2, 28.6], [80.2, 13.0], [77.5, 12.9], [100.5, 13.7], [103.8, 1.3],
    // Middle East
    [46.7, 24.7], [55.2, 25.2], [51.5, 25.2],
  ];

  regionalLights.forEach(([lng, lat]) => {
    drawCityLightCluster(lng, lat, 6, 0.6, 'rgba(253, 224, 71, 0.85)');
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

// Generate Great-Circle 3D curved telemetry arcs between two points
function createArcCurve(startVec, endVec, maxElevation = 18) {
  const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const distance = startVec.distanceTo(endVec);
  const elevation = Math.min(maxElevation, distance * 0.15);

  const normal = midPoint.clone().normalize();
  midPoint.add(normal.multiplyScalar(elevation));

  return new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
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
  const arcsGroupRef = useRef(null);
  const reticleRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [showGraticuleRing, setShowGraticuleRing] = useState(true);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // References for dragging and interaction state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0.25, y: -0.8 });
  const currentRotationRef = useRef({ x: 0.25, y: -0.8 });
  const cameraDistanceRef = useRef(260);

  // Flight particles animated along arcs
  const arcParticlesRef = useRef([]);

  // Rotate globe smoothly towards coordinates
  const flyToCoord = useCallback((lat, lng) => {
    const targetY = -((lng + 180) * (Math.PI / 180)) + Math.PI / 2;
    const targetX = lat * (Math.PI / 180);

    targetRotationRef.current = {
      x: Math.max(-1.2, Math.min(1.2, targetX)),
      y: targetY,
    };
  }, []);

  useEffect(() => {
    if (targetFocusCoord && typeof targetFocusCoord.lat === 'number') {
      flyToCoord(targetFocusCoord.lat, targetFocusCoord.lng);
    }
  }, [targetFocusCoord, flyToCoord]);

  useEffect(() => {
    if (selectedCity) {
      flyToCoord(selectedCity.lat, selectedCity.lng);
    }
  }, [selectedCity, flyToCoord]);

  // Main Three.js setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
    camera.position.set(0, 0, cameraDistanceRef.current);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Master Globe Group
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // Base Sphere with High-Precision Texture
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeTexture = createDetailedWorldTexture();
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: globeTexture,
      roughness: 0.75,
      metalness: 0.15,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeMesh.name = 'globe_sphere';
    globeGroup.add(globeMesh);

    // Inner Atmospheric Glow Shell
    const atmoGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.018, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeom, atmoMat);
    globeGroup.add(atmoMesh);

    // Outer Celestial Rim Halo
    const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.055, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    globeGroup.add(haloMesh);

    // Precision Armillary Equatorial Degree Ring
    const eqRingGeom = new THREE.RingGeometry(GLOBE_RADIUS * 1.04, GLOBE_RADIUS * 1.07, 72);
    const eqRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const eqRing = new THREE.Mesh(eqRingGeom, eqRingMat);
    eqRing.rotation.x = Math.PI / 2;
    eqRing.name = 'equatorial_ring';
    globeGroup.add(eqRing);

    // Starfield particles in deep space
    const starsCount = 500;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 900;
      starPositions[i + 1] = (Math.random() - 0.5) * 900;
      starPositions[i + 2] = -180 - Math.random() * 350;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.4,
      transparent: true,
      opacity: 0.45,
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(300, 180, 250);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-300, -120, -200);
    scene.add(rimLight);

    // Telemetry Great-Circle Arcs Group
    const arcsGroup = new THREE.Group();
    arcsGroupRef.current = arcsGroup;
    globeGroup.add(arcsGroup);

    const cityMap = new Map(WORLD_CITIES.map((c) => [c.id, c]));
    const particles = [];

    GLOBAL_ROUTES.forEach((route) => {
      const fromCity = cityMap.get(route.from);
      const toCity = cityMap.get(route.to);
      if (!fromCity || !toCity) return;

      const p1 = latLngToVector3(fromCity.lat, fromCity.lng, GLOBE_RADIUS * 1.01);
      const p2 = latLngToVector3(toCity.lat, toCity.lng, GLOBE_RADIUS * 1.01);

      const curve = createArcCurve(p1, p2, 16);
      const points = curve.getPoints(50);
      const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(route.color || 0x38bdf8),
        transparent: true,
        opacity: 0.35,
      });
      const arcLine = new THREE.Line(arcGeom, arcMat);
      arcsGroup.add(arcLine);

      // Moving energy packet on the arc
      const packetGeom = new THREE.SphereGeometry(1.2, 8, 8);
      const packetMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(route.color || 0xffffff),
      });
      const packetMesh = new THREE.Mesh(packetGeom, packetMat);
      arcsGroup.add(packetMesh);

      particles.push({
        mesh: packetMesh,
        curve,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.003,
      });
    });

    arcParticlesRef.current = particles;

    // City Markers Group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    globeGroup.add(markersGroup);

    // Marker geometry & materials
    const pinGeom = new THREE.SphereGeometry(1.6, 12, 12);
    const ringGeom = new THREE.RingGeometry(2.4, 3.2, 20);

    WORLD_CITIES.forEach((city) => {
      const pos = latLngToVector3(city.lat, city.lng, GLOBE_RADIUS * 1.01);

      // Core pin
      const pinMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
      });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = { city, isPin: true };
      markersGroup.add(pinMesh);

      // Surface ring oriented normal to surface
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      markersGroup.add(ringMesh);

      // Vertical altitude beacon stalk
      const stalkGeom = new THREE.BufferGeometry().setFromPoints([
        pos,
        pos.clone().multiplyScalar(1.045),
      ]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
        transparent: true,
        opacity: 0.6,
      });
      const stalk = new THREE.Line(stalkGeom, stalkMat);
      markersGroup.add(stalk);
    });

    // 3D Animated Targeting Reticle for Selected City
    const reticleGroup = new THREE.Group();
    const reticleRingGeom = new THREE.RingGeometry(4.5, 5.2, 32);
    const reticleRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const reticleRing = new THREE.Mesh(reticleRingGeom, reticleRingMat);
    reticleGroup.add(reticleRing);

    // Crosshairs lines
    const reticleCrossGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-7, 0, 0),
      new THREE.Vector3(7, 0, 0),
      new THREE.Vector3(0, -7, 0),
      new THREE.Vector3(0, 7, 0),
    ]);
    const reticleCrossMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
    });
    const reticleCross = new THREE.LineSegments(reticleCrossGeom, reticleCrossMat);
    reticleGroup.add(reticleCross);

    reticleRef.current = reticleGroup;
    globeGroup.add(reticleGroup);

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let lastTime = performance.now();

    const animate = (time) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Auto-rotation when not dragging
      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0018;
      }

      // Smooth camera spherical interpolation (lerp)
      currentRotationRef.current.x +=
        (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y +=
        (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;

      globeGroup.rotation.x = currentRotationRef.current.x;
      globeGroup.rotation.y = currentRotationRef.current.y;

      // Animate arc packets
      if (arcParticlesRef.current) {
        arcParticlesRef.current.forEach((p) => {
          p.progress = (p.progress + p.speed) % 1;
          const pos = p.curve.getPoint(p.progress);
          p.mesh.position.copy(pos);
        });
      }

      // Animate Reticle on active city
      if (selectedCity && reticleRef.current) {
        const targetPos = latLngToVector3(
          selectedCity.lat,
          selectedCity.lng,
          GLOBE_RADIUS * 1.05
        );
        reticleRef.current.position.copy(targetPos);
        reticleRef.current.lookAt(targetPos.clone().multiplyScalar(2));
        reticleRing.rotation.z += 0.015;
      }

      renderer.render(scene, camera);
      lastTime = time;
    };

    animate(lastTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      renderer.dispose();
      globeGeometry.dispose();
      globeTexture.dispose();
      globeMaterial.dispose();
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
    };
  }, [autoRotate, selectedCity]);

  // Update equatorial ring visibility
  useEffect(() => {
    if (globeGroupRef.current) {
      const ring = globeGroupRef.current.getObjectByName('equatorial_ring');
      if (ring) ring.visible = showGraticuleRing;
    }
  }, [showGraticuleRing]);

  // Update arcs visibility
  useEffect(() => {
    if (arcsGroupRef.current) {
      arcsGroupRef.current.visible = showArcs;
    }
  }, [showArcs]);

  // Pointer event handlers for orbital drag
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (isDraggingRef.current) {
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      targetRotationRef.current.y += deltaX * 0.006;
      targetRotationRef.current.x += deltaY * 0.006;

      // Limit pitch to prevent pole inversion
      targetRotationRef.current.x = Math.max(
        -1.3,
        Math.min(1.3, targetRotationRef.current.x)
      );

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Raycasting for city hover
      if (!cameraRef.current || !markersGroupRef.current || !mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(
        markersGroupRef.current.children,
        false
      );

      const hitPin = intersects.find((i) => i.object.userData?.isPin);
      if (hitPin) {
        setHoveredCity(hitPin.object.userData.city);
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setHoveredCity(null);
      }
    }
  };

  const handlePointerUp = (e) => {
    isDraggingRef.current = false;

    // Detect click vs drag
    if (!cameraRef.current || !sceneRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // 1. Check if user clicked directly on a city pin
    if (markersGroupRef.current) {
      const markerHits = raycaster.intersectObjects(
        markersGroupRef.current.children,
        false
      );
      const hitPin = markerHits.find((i) => i.object.userData?.isPin);
      if (hitPin) {
        onSelectCity(hitPin.object.userData.city);
        return;
      }
    }

    // 2. Check if user clicked anywhere on the Earth sphere
    const globeSphere = globeGroupRef.current?.getObjectByName('globe_sphere');
    if (globeSphere) {
      const sphereHits = raycaster.intersectObject(globeSphere, false);
      if (sphereHits.length > 0) {
        const hitPoint = sphereHits[0].point;
        const localPoint = globeGroupRef.current.worldToLocal(hitPoint.clone());

        const radius = localPoint.length();
        const phi = Math.acos(Math.max(-1, Math.min(1, localPoint.y / radius)));
        const lat = 90 - (phi * 180) / Math.PI;

        const theta = Math.atan2(localPoint.z, -localPoint.x);
        let lng = (theta * 180) / Math.PI - 180;
        if (lng < -180) lng += 360;
        if (lng > 180) lng -= 360;

        const nearest = findNearestCity(lat, lng);
        if (nearest) {
          onSelectCity(nearest, { clickedLat: lat, clickedLng: lng });
        }
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    cameraDistanceRef.current = Math.max(
      160,
      Math.min(420, cameraDistanceRef.current + e.deltaY * 0.25)
    );
    if (cameraRef.current) {
      cameraRef.current.position.z = cameraDistanceRef.current;
    }
  };

  const handleZoom = (direction) => {
    cameraDistanceRef.current = Math.max(
      160,
      Math.min(420, cameraDistanceRef.current + direction * 35)
    );
    if (cameraRef.current) {
      cameraRef.current.position.z = cameraDistanceRef.current;
    }
  };

  const handleResetView = () => {
    targetRotationRef.current = { x: 0.25, y: -0.8 };
    cameraDistanceRef.current = 260;
    if (cameraRef.current) {
      cameraRef.current.position.z = 260;
    }
  };

  return (
    <div
      id="world-globe-3d-wrapper"
      className="relative w-full h-[520px] md:h-[620px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl flex items-center justify-center select-none"
    >
      {/* Three.js Canvas Mount */}
      <div
        ref={mountRef}
        id="globe-webgl-canvas"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Top Left: Observatory Aerospace Telemetry HUD */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1.5 font-mono text-[11px] text-slate-300 bg-slate-950/85 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wider uppercase text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Orbital Telemetry</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[10px]">
          <span>
            LAT:{' '}
            <strong className="text-slate-200">
              {Math.abs(selectedCity?.lat || 0).toFixed(2)}°{' '}
              {selectedCity?.lat >= 0 ? 'N' : 'S'}
            </strong>
          </span>
          <span>
            LNG:{' '}
            <strong className="text-slate-200">
              {Math.abs(selectedCity?.lng || 0).toFixed(2)}°{' '}
              {selectedCity?.lng >= 0 ? 'E' : 'W'}
            </strong>
          </span>
          <span className="hidden sm:inline">
            ALT: <strong className="text-slate-200">100 KM</strong>
          </span>
        </div>
      </div>

      {/* Top Right: View & Layer Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        {/* Toggle Telemetry Arcs */}
        <button
          onClick={() => setShowArcs(!showArcs)}
          className={`p-2 rounded-lg text-xs font-semibold transition-all ${
            showArcs
              ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Toggle Global Telemetry Arcs"
        >
          <Radio className="w-4 h-4" />
        </button>

        {/* Toggle Equatorial Horizon Ring */}
        <button
          onClick={() => setShowGraticuleRing(!showGraticuleRing)}
          className={`p-2 rounded-lg text-xs font-semibold transition-all ${
            showGraticuleRing
              ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Toggle Armillary Equatorial Ring"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Auto-Rotation Play/Pause */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-2 rounded-lg text-xs font-semibold transition-all ${
            autoRotate
              ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title={autoRotate ? 'Pause Rotation' : 'Resume Planetary Rotation'}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* Reset Camera */}
        <button
          onClick={handleResetView}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          title="Reset Camera View"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Right: Precision Zoom Floating Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        <button
          onClick={() => handleZoom(-1)}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(1)}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* City Hover Tooltip */}
      {hoveredCity && (
        <div
          id="globe-city-tooltip"
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-lg bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 text-white text-xs shadow-2xl"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y - 12}px` }}
        >
          <div className="flex items-center gap-2 font-mono font-bold text-slate-100">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] border border-cyan-800/60">
              {hoveredCity.code}
            </span>
            <span>{hoveredCity.name}</span>
            <span className="text-slate-400 font-normal">[{hoveredCity.countryCode}]</span>
          </div>
          <div className="text-cyan-400 font-mono text-[11px] mt-1">
            {getTimeInfo(hoveredCity.timezone).time24} · {getTimeInfo(hoveredCity.timezone).utcOffset}
          </div>
        </div>
      )}

      {/* Bottom Left: Selected Target Status */}
      <div className="absolute bottom-4 left-4 pointer-events-none flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-xl">
        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-mono text-[11px]">
          TARGET:{' '}
          <strong className="text-white">
            {selectedCity?.name} [{selectedCity?.code}]
          </strong>
        </span>
      </div>
    </div>
  );
};

export default WorldGlobe3D;
