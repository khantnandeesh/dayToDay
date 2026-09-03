import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WORLD_CITIES, GLOBAL_ROUTES, findNearestCity, getTimeInfo } from '../data/worldTimezones';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Layers,
  Crosshair,
  Radio,
  Cloud,
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
  const cloudsMeshRef = useRef(null);
  const reticleRef = useRef(null);
  const globeMeshRef = useRef(null);
  const animationFrameRef = useRef(null);

  // View & Layer Controls
  const [showClouds, setShowClouds] = useState(true);
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
  const cameraDistanceRef = useRef(255);

  // Flight particles animated along arcs
  const arcParticlesRef = useRef([]);

  // Textures cache ref
  const texturesRef = useRef({
    satellite: null,
    normal: null,
    specular: null,
    clouds: null,
  });

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

    // Load authentic NASA Satellite textures
    const textureLoader = new THREE.TextureLoader();
    const satelliteTexture = textureLoader.load('/textures/earth_satellite_2048.jpg');
    satelliteTexture.anisotropy = 8;
    const normalTexture = textureLoader.load('/textures/earth_normal_2048.jpg');
    normalTexture.anisotropy = 4;
    const specularTexture = textureLoader.load('/textures/earth_specular_2048.jpg');
    const cloudsTexture = textureLoader.load('/textures/earth_clouds_1024.png');

    texturesRef.current = {
      satellite: satelliteTexture,
      normal: normalTexture,
      specular: specularTexture,
      clouds: cloudsTexture,
    };

    // Base Earth Sphere with authentic NASA Satellite imagery
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: satelliteTexture,
      bumpMap: normalTexture,
      bumpScale: 0.06,
      specularMap: specularTexture,
      specular: new THREE.Color(0x38bdf8),
      shininess: 32,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeMesh.name = 'globe_sphere';
    globeMeshRef.current = globeMesh;
    globeGroup.add(globeMesh);

    // Realistic Atmospheric Clouds Layer
    const cloudsGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.01, 64, 64);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);
    cloudsMesh.name = 'globe_clouds';
    cloudsMeshRef.current = cloudsMesh;
    globeGroup.add(cloudsMesh);

    // Inner Atmospheric Glow Shell (Rayleigh scattering)
    const atmoGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeom, atmoMat);
    globeGroup.add(atmoMesh);

    // Outer Celestial Rim Halo
    const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.065, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.07,
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

    // Deep Space Starfield
    const starsCount = 650;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1100;
      starPositions[i + 1] = (Math.random() - 0.5) * 1100;
      starPositions[i + 2] = -160 - Math.random() * 400;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 1.2,
      transparent: true,
      opacity: 0.6,
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // Natural Sunlight & Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf5, 2.2);
    sunLight.position.set(320, 200, 260);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-320, -120, -220);
    scene.add(rimLight);

    // Great-Circle Telemetry Arcs
    const arcsGroup = new THREE.Group();
    arcsGroupRef.current = arcsGroup;
    globeGroup.add(arcsGroup);

    const cityMap = new Map(WORLD_CITIES.map((c) => [c.id, c]));
    const particles = [];

    GLOBAL_ROUTES.forEach((route) => {
      const fromCity = cityMap.get(route.from);
      const toCity = cityMap.get(route.to);
      if (!fromCity || !toCity) return;

      const p1 = latLngToVector3(fromCity.lat, fromCity.lng, GLOBE_RADIUS * 1.015);
      const p2 = latLngToVector3(toCity.lat, toCity.lng, GLOBE_RADIUS * 1.015);

      const curve = createArcCurve(p1, p2, 16);
      const points = curve.getPoints(50);
      const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(route.color || 0x38bdf8),
        transparent: true,
        opacity: 0.45,
      });
      const arcLine = new THREE.Line(arcGeom, arcMat);
      arcsGroup.add(arcLine);

      // Pulse packet traveling along satellite trajectory
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

    // City Surface Markers Group
    const markersGroup = new THREE.Group();
    markersGroupRef.current = markersGroup;
    globeGroup.add(markersGroup);

    const pinGeom = new THREE.SphereGeometry(1.6, 12, 12);
    const ringGeom = new THREE.RingGeometry(2.4, 3.2, 20);

    WORLD_CITIES.forEach((city) => {
      const pos = latLngToVector3(city.lat, city.lng, GLOBE_RADIUS * 1.016);

      // Core pin
      const pinMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
      });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = { city, isPin: true };
      markersGroup.add(pinMesh);

      // Normal oriented ground ring
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      markersGroup.add(ringMesh);

      // Telemetry beacon stalk
      const stalkGeom = new THREE.BufferGeometry().setFromPoints([
        pos,
        pos.clone().multiplyScalar(1.045),
      ]);
      const stalkMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(city.color || 0x38bdf8),
        transparent: true,
        opacity: 0.7,
      });
      const stalk = new THREE.Line(stalkGeom, stalkMat);
      markersGroup.add(stalk);
    });

    // Targeting Crosshairs Reticle for Selected City
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

      // Auto-rotation of Earth
      if (autoRotate && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0016;
      }

      // Independent dynamic atmospheric cloud rotation
      if (cloudsMeshRef.current && showClouds) {
        cloudsMeshRef.current.rotation.y += 0.00035;
      }

      // Smooth camera interpolation
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
          GLOBE_RADIUS * 1.055
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
      globeMaterial.dispose();
      cloudsGeom.dispose();
      cloudsMat.dispose();
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
    };
  }, [autoRotate, selectedCity, showClouds]);

  // Update cloud visibility
  useEffect(() => {
    if (cloudsMeshRef.current) {
      cloudsMeshRef.current.visible = showClouds;
    }
  }, [showClouds]);

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
      150,
      Math.min(420, cameraDistanceRef.current + e.deltaY * 0.25)
    );
    if (cameraRef.current) {
      cameraRef.current.position.z = cameraDistanceRef.current;
    }
  };

  const handleZoom = (direction) => {
    cameraDistanceRef.current = Math.max(
      150,
      Math.min(420, cameraDistanceRef.current + direction * 35)
    );
    if (cameraRef.current) {
      cameraRef.current.position.z = cameraDistanceRef.current;
    }
  };

  const handleResetView = () => {
    targetRotationRef.current = { x: 0.25, y: -0.8 };
    cameraDistanceRef.current = 255;
    if (cameraRef.current) {
      cameraRef.current.position.z = 255;
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

      {/* Top Left: NASA Satellite Orbit Telemetry HUD */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1.5 font-mono text-[11px] text-slate-300 bg-slate-950/85 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wider uppercase text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>NASA Blue Marble Satellite</span>
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
            ALT: <strong className="text-slate-200">35,786 KM (GEO)</strong>
          </span>
        </div>
      </div>

      {/* Top Right: Layer & Satellite Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        {/* Toggle Atmospheric Cloud Layer */}
        <button
          onClick={() => setShowClouds(!showClouds)}
          className={`p-2 rounded-lg text-xs font-semibold transition-all ${
            showClouds
              ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title={showClouds ? 'Hide Cloud Layer' : 'Show Atmospheric Clouds'}
        >
          <Cloud className="w-4 h-4" />
        </button>

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

        {/* Toggle Equatorial Ring */}
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

      {/* Bottom Right: Precision Zoom Controls */}
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
