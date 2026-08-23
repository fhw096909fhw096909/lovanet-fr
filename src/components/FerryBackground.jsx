import React, { useRef, useMemo, useEffect, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls, Text, RoundedBox } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette, BrightnessContrast, HueSaturation, Noise, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import useSoundEffects from '../hooks/useSoundEffects';
import HubAudioControls from './HubAudioControls';
import FerryTrainCityPlaza from './FerryTrainCityPlaza';

/* ============================================================
   FERRY BACKGROUND 3D v3 — ULTRA FESTIVAL + CONCERT + DISCO
   Enhanced: Stage, strobes, crowd, realistic seagulls, wake
   ============================================================ */

const DAY = 1080; // 18 minutes par cycle complet — jour nettement plus long que la nuit

const FREIGHTER_ROUTE_OBSTACLES = [
  { x: 7.5, z: -1.5, radius: 17, push: 2.9 },
  { x: -16, z: 6, radius: 13, push: 3.6 },
  { x: 55, z: 52, radius: 20, push: 3.3 },
  { x: 34, z: 24, radius: 15, push: 2.5 },
  { x: -35, z: -25, radius: 24, push: 2.8 },
  { x: -64, z: -30, radius: 18, push: 2.2 },
  { x: 0, z: -40, radius: 17, push: 2.4 },
];

const CAPTURE_BUILDING_TARGET = { x: -18, z: -72 };

const WHITE_LIMIT_BARRIER = [
  { x: -132, z: -58, radius: 18, push: 3.4 },
  { x: -96, z: -60, radius: 18, push: 3.4 },
  { x: -60, z: -62, radius: 18, push: 3.4 },
  { x: -24, z: -64, radius: 18, push: 3.4 },
  { x: 12, z: -64, radius: 18, push: 3.4 },
  { x: 48, z: -62, radius: 18, push: 3.4 },
  { x: 84, z: -60, radius: 18, push: 3.4 },
];

const SEA_LANE_BOUNDS = { minX: -182, maxX: 92, minZ: -50, maxZ: 120 };

const SEA_VEHICLE_OBSTACLES = [
  ...FREIGHTER_ROUTE_OBSTACLES,
  ...WHITE_LIMIT_BARRIER,
  // Zones d'alerte invisibles (zéro intrusion) autour des terres
  { x: 55, z: -20, radius: 56, push: 5.6 },
  { x: -16, z: 160, radius: 64, push: 5.2 },
  { x: -24, z: -40, radius: 24, push: 3.6 },
  { x: -16, z: 10, radius: 22, push: 4.2 },
  { x: -16, z: 2, radius: 14, push: 3.6 },
  { x: -16, z: 18, radius: 14, push: 3.6 },
  { x: 90, z: -100, radius: 22, push: 3.2 },
  { x: -90, z: -100, radius: 22, push: 3.2 },
  { x: 0, z: -14, radius: 18, push: 2.8 },
  { x: 4, z: -18, radius: 16, push: 3.1 },
  { x: -42, z: 20, radius: 18, push: 2.6 },
  { x: -52, z: -6, radius: 14, push: 2.7 },
  { x: 0, z: 0, radius: 18, push: 2.4 },
  { x: 12, z: -8, radius: 8, push: 1.4 },
  { x: -14, z: -12, radius: 8, push: 1.4 },
  { x: 25, z: -18, radius: 9, push: 1.4 },
  { x: -8, z: 22, radius: 9, push: 1.35 },
  { x: 30, z: 8, radius: 9, push: 1.35 },
];

const CARRIER_ZONE_OBSTACLES = [
  ...SEA_VEHICLE_OBSTACLES,
  { x: 55, z: 52, radius: 34, push: 4.4 },
  { x: -16, z: 10, radius: 18, push: 2.8 },
  { x: 50, z: 15, radius: 20, push: 2.8 },
  { x: 48, z: 15, radius: 18, push: 2.2 },
  { x: 62, z: 22, radius: 18, push: 2.2 },
  { x: 50, z: 0, radius: 16, push: 2.4 },
];

function steerSeaVehicle(current, velocity, target, delta, options = {}) {
  const {
    obstacles = SEA_VEHICLE_OBSTACLES,
    speed = 0.75,
    sideBias = 1,
    arrivalRadius = 8,
    bounds = { minX: -170, maxX: 96, minZ: -132, maxZ: 78 },
  } = options;

  const desired = target.clone().sub(current);
  desired.y = 0;
  const distanceToTarget = desired.length();

  if (distanceToTarget > 0.0001) desired.normalize();

  obstacles.forEach((obstacle) => {
    const away = new THREE.Vector3(current.x - obstacle.x, 0, current.z - obstacle.z);
    const distance = away.length();
    const safeRadius = obstacle.radius + 11;

    if (distance < safeRadius) {
      if (distance < 0.001) away.set(sideBias, 0, 0.001);
      away.normalize();
      const pushStrength = ((safeRadius - distance) / safeRadius) * obstacle.push;
      const tangent = new THREE.Vector3(-away.z * sideBias, 0, away.x * sideBias);
      desired.addScaledVector(away, pushStrength * 1.35);
      desired.addScaledVector(tangent, pushStrength * 0.82);
    }
  });

  if (current.x > bounds.maxX) desired.add(new THREE.Vector3(-1.4, 0, -0.2));
  if (current.x < bounds.minX) desired.add(new THREE.Vector3(1.4, 0, 0.2));
  if (current.z > bounds.maxZ) desired.add(new THREE.Vector3(-0.18, 0, -1.2));
  if (current.z < bounds.minZ) desired.add(new THREE.Vector3(0.18, 0, 1.2));

  if (desired.lengthSq() > 0.0001) desired.normalize();
  velocity.lerp(desired.multiplyScalar(speed), Math.min(1, delta * 0.88));
  current.addScaledVector(velocity, delta * 10);

  return distanceToTarget <= arrivalRadius;
}

function offsetSeaVehiclePosition(candidate, sideBias = 1, obstacles = SEA_VEHICLE_OBSTACLES) {
  const adjusted = candidate.clone();
  obstacles.forEach((obstacle) => {
    const away = new THREE.Vector3(adjusted.x - obstacle.x, 0, adjusted.z - obstacle.z);
    const distance = away.length();
    const safeRadius = obstacle.radius + 8;
    if (distance < safeRadius) {
      if (distance < 0.001) away.set(sideBias, 0, 0.001);
      away.normalize();
      const tangent = new THREE.Vector3(-away.z * sideBias, 0, away.x * sideBias);
      adjusted.addScaledVector(away, safeRadius - distance);
      adjusted.addScaledVector(tangent, (safeRadius - distance) * 0.28);
    }
  });
  return adjusted;
}

// ─── Dynamic Sky Shader ────────────────────────────────────
function Sky({ tod }) {
  const ref = useRef();
  const u = useMemo(() => ({
    topColor: { value: new THREE.Color('#4da6ff') },
    bottomColor: { value: new THREE.Color('#87CEEB') },
  }), []);
  const vs = `varying vec3 vW; void main(){vW=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const fs = `uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vW;void main(){float h=normalize(vW).y;gl_FragColor=vec4(mix(bottomColor,topColor,max(h,0.0)),1.0);}`;

  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.position.copy(camera.position);
    const m = ref.current.material;
    const dT = new THREE.Color('#4da6ff'), dB = new THREE.Color('#87CEEB');
    const nT = new THREE.Color('#0a0a2e'), nB = new THREE.Color('#0a1628');
    const sT = new THREE.Color('#FF6B35'), sB = new THREE.Color('#4a2040');
    if (tod > 0.24 && tod < 0.76) { m.uniforms.topColor.value.copy(dT); m.uniforms.bottomColor.value.copy(dB); }
    else if (tod < 0.18 || tod > 0.82) { m.uniforms.topColor.value.copy(nT); m.uniforms.bottomColor.value.copy(nB); }
    else if (tod < 0.24) { const f = (tod - 0.18) / 0.06; m.uniforms.topColor.value.lerpColors(nT, sT, f); m.uniforms.bottomColor.value.lerpColors(nB, sB, f); }
    else { const f = (tod - 0.76) / 0.06; m.uniforms.topColor.value.lerpColors(dT, sT, f); m.uniforms.bottomColor.value.lerpColors(dB, sB, f); }
  });

  return <mesh ref={ref}><sphereGeometry args={[3200, 48, 24]} /><shaderMaterial uniforms={u} vertexShader={vs} fragmentShader={fs} side={THREE.BackSide} /></mesh>;
}

// ─── Ocean v6 — Custom shader for ultra-realistic water ───
function Ocean({ tod, qualityBoost = false }) {
  const ref = useRef();
  const foamRef = useRef();
  const geo = useMemo(() => new THREE.PlaneGeometry(qualityBoost ? 6200 : 5200, qualityBoost ? 6200 : 5200, qualityBoost ? 192 : 128, qualityBoost ? 192 : 128), [qualityBoost]);
  const foamGeo = useMemo(() => new THREE.PlaneGeometry(qualityBoost ? 5400 : 4200, qualityBoost ? 5400 : 4200, qualityBoost ? 96 : 64, qualityBoost ? 96 : 64), [qualityBoost]);

  // Custom shader material for realistic water
  const waterMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTod: { value: 0.5 },
        uShallowColor: { value: new THREE.Color(qualityBoost ? '#62f3ff' : '#4fe5eb') },
        uDeepColor: { value: new THREE.Color(qualityBoost ? '#0a6f91' : '#0b6178') },
        uNightColor: { value: new THREE.Color('#061828') },
        uSunsetColor: { value: new THREE.Color(qualityBoost ? '#ffc37a' : '#f0b16c') },
        uSunPos: { value: new THREE.Vector3(0, 10, -20) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveHeight;
        uniform float uTime;
        
        float wave(vec2 p, float freq, float speed, float amp) {
          return sin(p.x * freq + uTime * speed) * cos(p.y * freq * 0.7 + uTime * speed * 0.8) * amp;
        }
        
        void main() {
          vec3 pos = position;
          float dist = length(pos.xy);
          float amp = 1.0 - smoothstep(0.0, 2600.0, dist) * 0.34;
          
          // Multi-octave waves
          float h = 0.0;
          h += sin(pos.x * 0.04 + uTime * 0.4) * 0.82 * amp;
          h += sin(pos.y * 0.06 + uTime * 0.35) * 0.6 * amp;
          h += sin((pos.x * 0.7 + pos.y * 0.5) * 0.12 + uTime * 1.8) * 0.16;
          h += cos(pos.x * 0.025 - uTime * 0.2) * 1.02 * amp;
          h += sin(pos.x * 0.35 + pos.y * 0.25 + uTime * 2.5) * 0.08;
          // Extra fine detail
          h += sin(pos.x * 0.8 - pos.y * 0.6 + uTime * 3.0) * 0.05;
          h += cos(pos.x * 1.2 + pos.y * 0.9 + uTime * 2.2) * 0.035;
          h += sin(length(pos.xy) * 0.18 - uTime * 1.4) * 0.05;
          
          pos.z = h;
          vWaveHeight = h;
          
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          
          // Compute normal from nearby wave heights
          float dx = 0.5;
          float hR = sin((pos.x + dx) * 0.04 + uTime * 0.4) * 0.7 * amp + cos((pos.x + dx) * 0.025 - uTime * 0.2) * 0.9 * amp;
          float hU = sin(pos.x * 0.04 + uTime * 0.4) * 0.7 * amp + sin((pos.y + dx) * 0.06 + uTime * 0.35) * 0.5 * amp;
          vNormal = normalize(vec3(h - hR, dx, h - hU));
          
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTod;
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uNightColor;
        uniform vec3 uSunsetColor;
        uniform vec3 uSunPos;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vWaveHeight;
        
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 normal = normalize(vNormal);
          
          // Fresnel effect - more reflective at grazing angles
          float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
          fresnel = mix(0.04, 0.85, fresnel);
          
          // Base water color based on depth & time of day
          bool isDay = uTod > 0.35 && uTod < 0.65;
          bool isNight = uTod < 0.25 || uTod > 0.75;
          bool isSunset = !isDay && !isNight;
          
          // Depth-based color: wave peaks are lighter, troughs are darker
          float depthFactor = smoothstep(-1.5, 1.5, vWaveHeight);
          vec3 baseColor;
          if (isDay) {
            baseColor = mix(uDeepColor, uShallowColor, depthFactor);
          } else if (isNight) {
            baseColor = mix(uNightColor, uDeepColor * 0.5, depthFactor);
          } else {
            float sunsetMix = isSunset ? 0.3 : 0.0;
            baseColor = mix(mix(uNightColor, uShallowColor, 0.4), uSunsetColor, sunsetMix);
            baseColor = mix(baseColor * 0.8, baseColor, depthFactor);
          }
          
          // Sky reflection
          vec3 skyColor = isDay ? vec3(0.5, 0.75, 0.95) : isNight ? vec3(0.04, 0.06, 0.15) : vec3(0.8, 0.4, 0.25);
          vec3 reflectedColor = mix(baseColor, skyColor, fresnel * 0.5);
          
          // Specular highlights (sun/moon glint)
          vec3 lightDir = normalize(uSunPos - vWorldPos);
          vec3 halfDir = normalize(lightDir + viewDir);
          float spec = pow(max(dot(normal, halfDir), 0.0), 256.0);
          float specIntensity = isDay ? 1.45 : isNight ? 0.22 : 0.72;
          vec3 specColor = isDay ? vec3(1.0, 0.97, 0.9) : isNight ? vec3(0.5, 0.6, 0.8) : vec3(1.0, 0.6, 0.3);
          
          // Foam on wave crests
          float foam = smoothstep(0.72, 1.32, vWaveHeight);
          foam += smoothstep(0.54, 0.96, vWaveHeight) * 0.34 * sin(vWorldPos.x * 2.0 + uTime) * 0.5 + 0.5;
          foam += smoothstep(0.92, 1.45, vWaveHeight) * 0.22;
          foam = clamp(foam, 0.0, 1.0);
          vec3 foamColor = vec3(0.9, 0.95, 1.0);
          
          // Combine
          vec3 finalColor = reflectedColor;
          finalColor += specColor * spec * (specIntensity * 1.28);
          finalColor = mix(finalColor, foamColor, foam * (isDay ? 0.58 : 0.28));
          
          // Distance fade for fog integration
          float dist = length(vWorldPos.xz);
          float fogFactor = smoothstep(2400.0, 4600.0, dist);
          vec3 fogColor = isDay ? vec3(0.53, 0.81, 0.92) : vec3(0.04, 0.086, 0.157);
          finalColor = mix(finalColor, fogColor, fogFactor);
          
          float alpha = isDay ? 0.9 : 0.94;
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [qualityBoost]);

  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const p = ref.current.geometry.attributes.position;

    // CPU-side vertex animation (for geometry normals + foam mesh sync)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const nearShore = Math.max(0, 1 - dist / 2600);
      const amp = 1 - nearShore * 0.34;
      const w1 = Math.sin(x * 0.04 + t * 0.4) * 0.82 * amp;
      const w2 = Math.sin(y * 0.06 + t * 0.35) * 0.6 * amp;
      const w3 = Math.sin((x * 0.7 + y * 0.5) * 0.12 + t * 1.8) * 0.16;
      const w4 = Math.cos(x * 0.025 - t * 0.2) * 1.02 * amp;
      const w5 = Math.sin(x * 0.35 + y * 0.25 + t * 2.5) * 0.08;
      const w6 = Math.sin(x * 0.8 - y * 0.6 + t * 3.0) * 0.05;
      const w7 = Math.cos(x * 1.2 + y * 0.9 + t * 2.2) * 0.035;
      const w8 = Math.sin(Math.sqrt(x * x + y * y) * 0.18 - t * 1.4) * 0.05;
      p.setZ(i, w1 + w2 + w3 + w4 + w5 + w6 + w7 + w8);
    }
    p.needsUpdate = true;

    // Update shader uniforms
    waterMat.uniforms.uTime.value = t;
    waterMat.uniforms.uTod.value = tod;
    // Sun position based on time of day
    const sunAngle = tod * Math.PI * 2 - Math.PI / 2;
    waterMat.uniforms.uSunPos.value.set(Math.cos(sunAngle) * 25, Math.sin(sunAngle) * 18 + 8, 5);

    // Foam mesh sync
    if (foamRef.current) {
      const fp = foamRef.current.geometry.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const x = fp.getX(i), y = fp.getY(i);
        const wave = Math.sin(x * 0.04 + t * 0.4) * 0.82 + Math.cos(x * 0.025 - t * 0.2) * 1.02 + Math.sin(y * 0.06 + t * 0.35) * 0.3;
        fp.setZ(i, wave + 0.12);
      }
      fp.needsUpdate = true;
      foamRef.current.material.opacity = 0.14 + Math.sin(t * 0.3) * 0.04;
    }
  });

  return (
    <group>
      {/* Main water surface with custom shader */}
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
        <primitive object={geo} />
        <primitive object={waterMat} />
      </mesh>
      {/* Foam / whitecaps layer */}
      <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.9, 0]}>
        <primitive object={foamGeo} />
        <meshBasicMaterial color="#ffffff" transparent opacity={qualityBoost ? 0.12 : 0.08} side={THREE.FrontSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Foam Patches v2 — Simplifié pour un look plus propre ──
function Foam({ qualityBoost = false }) {
  const ref = useRef();
  const foams = useMemo(() => [...Array(qualityBoost ? 70 : 35)].map(() => ({
    x: (Math.random() - 0.5) * (qualityBoost ? 360 : 200), z: (Math.random() - 0.5) * (qualityBoost ? 360 : 200),
    s: 0.4 + Math.random() * (qualityBoost ? 3.2 : 2), sp: 0.2 + Math.random() * 0.5, o: Math.random() * 6.28,
  })), [qualityBoost]);
  
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      const f = foams[i];
      c.position.y = -3.4 + Math.sin(t * f.sp + f.o) * (qualityBoost ? 0.36 : 0.3);
      c.material.opacity = (qualityBoost ? 0.1 : 0.06) + Math.sin(t * f.sp * 2) * (qualityBoost ? 0.05 : 0.04);
      c.scale.setScalar(1 + Math.sin(t * f.sp * 1.5) * (qualityBoost ? 0.18 : 0.1));
    });
  });
  
  return <group ref={ref}>{foams.map((f, i) => (
    <mesh key={i} position={[f.x, -3.4, f.z]} rotation={[-Math.PI / 2, 0, Math.random() * 3.14]}>
      <circleGeometry args={[f.s, 8]} />
      <meshStandardMaterial color="white" transparent opacity={qualityBoost ? 0.12 : 0.08} />
    </mesh>
  ))}</group>;
}

// ─── Premium Ferry — Elegant blue stripe, realistic hull ───
function Ferry({ tod }) {
  const ref = useRef();
  const wakeRef = useRef();
  const night = tod < 0.18 || tod > 0.82;
  const ni = night ? 3.5 : 0;
  const we = night ? 2 : 0.1;
  const dockedPosition = useMemo(() => new THREE.Vector3(7.5, -0.05, -1.5), []);
  const dockedYaw = -Math.PI / 2;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.x = dockedPosition.x;
    ref.current.position.z = dockedPosition.z;
    ref.current.position.y = dockedPosition.y + Math.sin(t * 0.45) * 0.05 + Math.sin(t * 1.2) * 0.01;
    ref.current.rotation.y = dockedYaw;
    ref.current.rotation.z = Math.sin(t * 0.35) * 0.005;
    ref.current.rotation.x = 0; // Pas de tangage pour éviter que la proue plonge
    window.__ferryPos = { x: ref.current.position.x, y: ref.current.position.y, z: ref.current.position.z };
    if (wakeRef.current) {
      wakeRef.current.children.forEach((c, i) => {
        if (c.material) c.material.opacity = 0.025 + Math.sin(t * 2 + i * 0.5) * 0.01;
      });
    }
  });

  return (
    <group ref={ref} position={[0, 0.3, 0]} scale={[1.18, 1.18, 1.18]}>
      {/* Docked pontoon & mooring */}
      <group position={[1.2, -0.25, -18.4]}>
        <mesh>
          <boxGeometry args={[2.9, 0.42, 18.8]} />
          <meshStandardMaterial color={night ? '#394252' : '#d8e0e8'} roughness={0.32} metalness={0.28} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[3.15, 0.12, 19.05]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.55 : 0.08} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.95, 0.35, 0]}>
          <boxGeometry args={[0.1, 0.62, 18.8]} />
          <meshStandardMaterial color="#9ccfff" emissive="#9ccfff" emissiveIntensity={night ? 0.9 : 0.08} />
        </mesh>
        <mesh position={[-1.15, 0.35, 0]}>
          <boxGeometry args={[0.08, 0.52, 18.8]} />
          <meshStandardMaterial color="#d7f4ff" emissive="#d7f4ff" emissiveIntensity={night ? 0.55 : 0.05} />
        </mesh>
        {[-6, -2, 2, 6].map((z, i) => (
          <group key={`mooring-${i}`} position={[0.2, 0.18, z]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.09, 0.1, 0.5, 8]} />
              <meshStandardMaterial color="#516070" metalness={0.7} roughness={0.16} />
            </mesh>
            <mesh position={[-1.7, 0.4, 0]} rotation={[0, 0, i % 2 === 0 ? 0.28 : -0.28]}>
              <cylinderGeometry args={[0.012, 0.012, 3.6, 6]} />
              <meshStandardMaterial color="#f0f6ff" />
            </mesh>
          </group>
        ))}
        {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((z, i) => (
          <mesh key={`pontoon-fender-${i}`} position={[-1.55, -0.02, z]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.12, 0.45, 6, 8]} />
            <meshStandardMaterial color="#203245" metalness={0.62} roughness={0.24} />
          </mesh>
        ))}
        {[-7, -3.5, 0, 3.5, 7].map((z, i) => (
          <group key={`pontoon-post-${i}`} position={[1.25, 0, z]}>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 0.9, 8]} />
              <meshStandardMaterial color="#596a78" metalness={0.68} roughness={0.18} />
            </mesh>
            <mesh position={[0, 1.05, 0]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color="#fff2c1" emissive="#fff2c1" emissiveIntensity={night ? 2.6 : 0.15} />
            </mesh>
          </group>
        ))}
      </group>

      {/* HULL - Main body - PURE WHITE premium finish */}
      <mesh position={[0, 0, 0]}><boxGeometry args={[4, 1.5, 15]} />
        <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} emissive="#ffffff" emissiveIntensity={night ? 0.08 : 0} /></mesh>
      {/* Underwater hull — deep navy */}
      <mesh position={[0, -0.5, 0]}><boxGeometry args={[3.8, 0.6, 15.5]} />
        <meshStandardMaterial color="#0a1a30" roughness={0.3} metalness={0.7} /></mesh>
      {/* === BLUE STRIPE on flank (replacing red) === */}
      <mesh position={[0, -0.1, 0]}><boxGeometry args={[4.05, 0.18, 15.2]} />
        <meshStandardMaterial color="#1a5fa8" roughness={0.15} metalness={0.5} emissive={night ? '#1a5fa8' : '#000'} emissiveIntensity={night ? 0.5 : 0} /></mesh>

      {/* BOW - Proue low-poly intégrée au ferry */}
      <group position={[0, 0.18, -7.7]}>
        {/* Base avant pour raccorder la coque */}
        <mesh position={[0, 0, -0.98]}>
          <boxGeometry args={[3.68, 1.22, 2.26]} />
          <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* Flanc gauche de proue lissé */}
        <mesh position={[0.68, -0.01, -1.96]} rotation={[Math.PI / 2, 0, -0.08]} scale={[0.74, 0.54, 1]}>
          <cylinderGeometry args={[0.18, 0.74, 2.7, 20]} />
          <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* Flanc droit de proue lissé */}
        <mesh position={[-0.68, -0.01, -1.96]} rotation={[Math.PI / 2, 0, 0.08]} scale={[0.74, 0.54, 1]}>
          <cylinderGeometry args={[0.18, 0.74, 2.7, 20]} />
          <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* Pointe avant retravaillée — proue douce et relevée de paquebot */}
        <group position={[0, 0.02, -3.02]}>
          <RoundedBox args={[1.12, 0.28, 1.34]} radius={0.1} smoothness={8} position={[0, -0.02, -0.06]}>
            <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
          </RoundedBox>
          <RoundedBox args={[0.92, 0.24, 1.02]} radius={0.08} smoothness={8} position={[0, 0.1, -0.42]} rotation={[-0.18, 0, 0]}>
            <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
          </RoundedBox>
          <RoundedBox args={[0.7, 0.2, 0.72]} radius={0.07} smoothness={8} position={[0, 0.24, -0.78]} rotation={[-0.34, 0, 0]}>
            <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
          </RoundedBox>
          <RoundedBox args={[0.46, 0.16, 0.42]} radius={0.05} smoothness={8} position={[0, 0.34, -1.02]} rotation={[-0.5, 0, 0]}>
            <meshPhysicalMaterial color="#f8f9fc" roughness={0.08} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
          </RoundedBox>
        </group>
        {/* Dessous de proue façon vedette - plat et raccordé */}
        <mesh position={[0, -0.42, -3.04]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.02, 0.28, 1.52]} />
          <meshPhysicalMaterial color="#f4f7fb" roughness={0.12} metalness={0.1} clearcoat={0.75} clearcoatRoughness={0.08} />
        </mesh>
        {/* Ligne bleue qui prolonge celle de la coque autour de la proue */}
        <mesh position={[0, -0.33, -1.02]}>
          <boxGeometry args={[3.72, 0.16, 2.02]} />
          <meshStandardMaterial color="#1a5fa8" roughness={0.15} metalness={0.5} emissive={night ? '#1a5fa8' : '#000'} emissiveIntensity={night ? 0.45 : 0} />
        </mesh>
        <mesh position={[0.68, -0.34, -1.98]} rotation={[Math.PI / 2, 0, -0.08]} scale={[0.2, 0.12, 1]}>
          <cylinderGeometry args={[0.12, 0.82, 2.62, 18]} />
          <meshStandardMaterial color="#1a5fa8" roughness={0.15} metalness={0.5} emissive={night ? '#1a5fa8' : '#000'} emissiveIntensity={night ? 0.45 : 0} />
        </mesh>
        <mesh position={[-0.68, -0.34, -1.98]} rotation={[Math.PI / 2, 0, 0.08]} scale={[0.2, 0.12, 1]}>
          <cylinderGeometry args={[0.12, 0.82, 2.62, 18]} />
          <meshStandardMaterial color="#1a5fa8" roughness={0.15} metalness={0.5} emissive={night ? '#1a5fa8' : '#000'} emissiveIntensity={night ? 0.45 : 0} />
        </mesh>
        <mesh position={[0, -0.33, -3.3]}>
          <boxGeometry args={[0.16, 0.14, 0.46]} />
          <meshStandardMaterial color="#1a5fa8" roughness={0.15} metalness={0.5} emissive={night ? '#1a5fa8' : '#000'} emissiveIntensity={night ? 0.45 : 0} />
        </mesh>
        {/* Ligne de quille centrale */}
        <mesh position={[0, -0.28, -2.18]}>
          <boxGeometry args={[0.12, 0.72, 4.02]} />
          <meshPhysicalMaterial color="#e8eef4" roughness={0.1} metalness={0.3} clearcoat={1} />
        </mesh>
        {/* Sous-proue blanche pour garder une face avant claire */}
        <mesh position={[0, -0.5, -2.28]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[1.62, 0.5, 3.18]} />
          <meshPhysicalMaterial color="#f4f7fb" roughness={0.12} metalness={0.12} clearcoat={0.8} clearcoatRoughness={0.08} />
        </mesh>
      </group>

      {/* === PREMIUM REAR SPOILER — Blanc === */}
      <group position={[0, 2.2, 7.5]}>
        <mesh position={[0, 0, 0]}><boxGeometry args={[5.5, 0.1, 1]} />
          <meshStandardMaterial color="#fcfdff" metalness={0.55} roughness={0.08} /></mesh>
        <mesh position={[0, 0.3, -0.1]}><boxGeometry args={[5, 0.06, 0.6]} />
          <meshStandardMaterial color="#ffffff" metalness={0.42} roughness={0.1} /></mesh>
        {[-2.75, 2.75].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh><boxGeometry args={[0.08, 0.7, 1.2]} /><meshStandardMaterial color="#ffffff" metalness={0.42} roughness={0.06} /></mesh>
            {[-0.3, 0, 0.3].map((z, j) => (
              <mesh key={j} position={[i === 0 ? -0.05 : 0.05, 0, z]}><boxGeometry args={[0.02, 0.15, 0.08]} />
                <meshStandardMaterial color="#1a5fa8" emissive="#2080dd" emissiveIntensity={night ? 2 : 0} /></mesh>
            ))}
          </group>
        ))}
        {[-1.5, 0, 1.5].map((x, i) => (
          <mesh key={`p${i}`} position={[x, -0.65, 0]}><cylinderGeometry args={[0.05, 0.07, 1.3, 8]} /><meshStandardMaterial color="#ffffff" metalness={0.58} roughness={0.06} /></mesh>
        ))}
        <mesh position={[0, -0.08, -0.52]}><boxGeometry args={[5.3, 0.04, 0.04]} />
          <meshStandardMaterial color={night ? '#2080dd' : '#1a5fa8'} emissive="#2080dd" emissiveIntensity={night ? 5 : 0} /></mesh>
        <mesh position={[0, 0.25, -0.35]}><boxGeometry args={[4.8, 0.03, 0.03]} />
          <meshStandardMaterial color={night ? '#00FFFF' : '#0088cc'} emissive="#00FFFF" emissiveIntensity={night ? 4 : 0} /></mesh>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.4, 0.15, 0.15]} />
          <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={night ? 3 : 0.5} /></mesh>
      </group>

      {/* DECK 1 - WHITE with night glow */}
      <mesh position={[0, 1.1, -0.5]}><boxGeometry args={[3.6, 0.8, 12]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.06 : 0} roughness={0.35} /></mesh>

      {/* DECK 2 - WHITE with night glow */}
      <mesh position={[0, 1.9, -0.5]}><boxGeometry args={[3.2, 0.7, 10]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.06 : 0} roughness={0.3} /></mesh>

      {/* DECK 3 - Festival deck */}
      <mesh position={[0, 2.6, -0.3]}><boxGeometry args={[2.8, 0.5, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>

      {/* Bridge */}
      <mesh position={[0, 3.2, -3.5]}><boxGeometry args={[2, 0.6, 1.8]} /><meshStandardMaterial color="#fff" roughness={0.3} metalness={0.2} /></mesh>
      <mesh position={[0, 3.25, -4.42]}><planeGeometry args={[1.6, 0.4]} /><meshStandardMaterial color="#1a3a5c" emissive="#00FFFF" emissiveIntensity={night ? 0.8 : 0} transparent opacity={0.8} /></mesh>

      {/* Chimney - WHITE with night glow */}
      <mesh position={[0, 3.5, 2]}><cylinderGeometry args={[0.45, 0.55, 1.6, 12]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.06 : 0} roughness={0.3} /></mesh>
      <mesh position={[0, 3.6, 2]}><cylinderGeometry args={[0.47, 0.47, 0.35, 12]} /><meshStandardMaterial color="#0047AB" /></mesh>

      {/* Lifeboats */}
      {[-1.95, 1.95].map((x, xi) => [-1, 2, 5].map((z, zi) => (
        <mesh key={`lb-${xi}-${zi}`} position={[x, 1.6, z]} rotation={[0, 0, xi > 0 ? 0.1 : -0.1]}>
          <capsuleGeometry args={[0.12, 0.5, 4, 8]} /><meshStandardMaterial color="#FF6600" roughness={0.6} />
        </mesh>
      )))}

      {/* Pool */}
      <mesh position={[0, 2.88, 0.5]}><boxGeometry args={[1.8, 0.08, 2.5]} /><meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={night ? 0.8 : 0.2} transparent opacity={0.7} /></mesh>

      {/* ═══ FESTIVAL PARTY ON DECK ═══ */}
      <DeckParty night={night} />

      {/* ═══ NEON STRIPS ═══ */}
      {night && <>
        <mesh position={[2.02, 0.8, 0]}><boxGeometry args={[0.05, 0.05, 15]} /><meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={ni} /></mesh>
        <mesh position={[-2.02, 0.8, 0]}><boxGeometry args={[0.05, 0.05, 15]} /><meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={ni} /></mesh>
        <mesh position={[0, 2.35, -0.5]}><boxGeometry args={[3.2, 0.04, 0.04]} /><meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={ni} /></mesh>
        <mesh position={[0, 2.85, 3.7]}><boxGeometry args={[2.8, 0.04, 0.04]} /><meshStandardMaterial color="#00FF41" emissive="#00FF41" emissiveIntensity={ni} /></mesh>
      </>}

      {/* ═══ GLASS PROTECTION RAILS — Vitres transparentes à chaque étage ═══ */}
      {[1.82, -1.82].map((x, si) => (
        <mesh key={`gr1-${si}`} position={[x, 1.55, -0.5]}>
          <boxGeometry args={[0.04, 0.5, 12]} />
          <meshPhysicalMaterial color="#a8d8ea" transparent opacity={0.25} roughness={0.02} metalness={0.1} transmission={0.7} ior={1.5} />
        </mesh>
      ))}
      {[1.82, -1.82].map((x, si) => (
        <mesh key={`grt1-${si}`} position={[x, 1.82, -0.5]}>
          <boxGeometry args={[0.06, 0.04, 12]} />
          <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.15} />
        </mesh>
      ))}
      {[1.62, -1.62].map((x, si) => (
        <mesh key={`gr2-${si}`} position={[x, 2.3, -0.5]}>
          <boxGeometry args={[0.04, 0.45, 10]} />
          <meshPhysicalMaterial color="#a8d8ea" transparent opacity={0.22} roughness={0.02} metalness={0.1} transmission={0.7} ior={1.5} />
        </mesh>
      ))}
      {[1.62, -1.62].map((x, si) => (
        <mesh key={`grt2-${si}`} position={[x, 2.55, -0.5]}>
          <boxGeometry args={[0.06, 0.04, 10]} />
          <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.15} />
        </mesh>
      ))}
      {[1.42, -1.42].map((x, si) => (
        <mesh key={`gr3-${si}`} position={[x, 2.88, -0.3]}>
          <boxGeometry args={[0.04, 0.4, 8]} />
          <meshPhysicalMaterial color="#a8d8ea" transparent opacity={0.2} roughness={0.02} metalness={0.1} transmission={0.7} ior={1.5} />
        </mesh>
      ))}
      {[1.42, -1.42].map((x, si) => (
        <mesh key={`grt3-${si}`} position={[x, 3.1, -0.3]}>
          <boxGeometry args={[0.06, 0.04, 8]} />
          <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.15} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, -6.5]}>
        <boxGeometry args={[3.6, 0.5, 0.04]} />
        <meshPhysicalMaterial color="#a8d8ea" transparent opacity={0.22} roughness={0.02} transmission={0.7} ior={1.5} />
      </mesh>
      <mesh position={[0, 1.55, 5.5]}>
        <boxGeometry args={[3.6, 0.5, 0.04]} />
        <meshPhysicalMaterial color="#a8d8ea" transparent opacity={0.22} roughness={0.02} transmission={0.7} ior={1.5} />
      </mesh>

      {/* ═══ REAL WINDOWS — Fenêtres plus grandes et détaillées ═══ */}
      {[...Array(10)].map((_, i) => (
        <React.Fragment key={`rw1-${i}`}>
          {[1.83, -1.83].map((x, si) => (
            <group key={`rw1-${i}-${si}`} position={[x, 1.1, -4.5 + i * 1.1]}>
              <mesh><boxGeometry args={[0.03, 0.48, 0.72]} />
                <meshStandardMaterial color="#2a3a4a" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[si === 0 ? 0.01 : -0.01, 0, 0]}>
                <boxGeometry args={[0.02, 0.38, 0.62]} />
                <meshPhysicalMaterial color={night ? '#ffd86e' : '#87CEEB'} transparent opacity={night ? 0.85 : 0.5} emissive="#FFD700" emissiveIntensity={night ? 2.8 : 0} roughness={0.02} transmission={night ? 0 : 0.5} />
              </mesh>
            </group>
          ))}
        </React.Fragment>
      ))}
      {[...Array(8)].map((_, i) => (
        <React.Fragment key={`rw2-${i}`}>
          {[1.63, -1.63].map((x, si) => (
            <group key={`rw2-${i}-${si}`} position={[x, 1.9, -3.5 + i * 1.1]}>
              <mesh><boxGeometry args={[0.03, 0.42, 0.65]} />
                <meshStandardMaterial color="#2a3a4a" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[si === 0 ? 0.01 : -0.01, 0, 0]}>
                <boxGeometry args={[0.02, 0.32, 0.55]} />
                <meshPhysicalMaterial color={night ? '#ffe8a0' : '#87CEEB'} transparent opacity={night ? 0.82 : 0.5} emissive="#FFD700" emissiveIntensity={night ? 2.5 : 0} roughness={0.02} transmission={night ? 0 : 0.5} />
              </mesh>
            </group>
          ))}
        </React.Fragment>
      ))}

      {/* ═══ BALCONIES — Balcons réalistes aux étages supérieurs ═══ */}
      {[-3, -1, 1, 3, 5].map((z, i) => (
        <group key={`bal2-${i}`}>
          {[1.75, -1.75].map((x, si) => (
            <group key={`bal2-${i}-${si}`} position={[x * 1.08, 1.65, z]}>
              <mesh><boxGeometry args={[0.6, 0.04, 0.8]} />
                <meshStandardMaterial color="#d8dce2" metalness={0.3} roughness={0.4} /></mesh>
              <mesh position={[si === 0 ? 0.28 : -0.28, 0.16, 0]}>
                <boxGeometry args={[0.03, 0.3, 0.75]} />
                <meshPhysicalMaterial color="#c8e8ff" transparent opacity={0.2} roughness={0.02} transmission={0.65} />
              </mesh>
              <mesh position={[si === 0 ? 0.28 : -0.28, 0.32, 0]}>
                <boxGeometry args={[0.04, 0.03, 0.78]} />
                <meshStandardMaterial color="#b0b8c0" metalness={0.8} roughness={0.15} />
              </mesh>
              {[-0.35, 0.35].map((zz, pi) => (
                <mesh key={pi} position={[si === 0 ? 0.28 : -0.28, 0.16, zz]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.32, 6]} />
                  <meshStandardMaterial color="#a0a8b0" metalness={0.7} roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      {[-2, 0, 2].map((z, i) => (
        <group key={`bal3-${i}`}>
          {[1.5, -1.5].map((x, si) => (
            <group key={`bal3-${i}-${si}`} position={[x * 1.05, 2.42, z]}>
              <mesh><boxGeometry args={[0.5, 0.04, 0.7]} />
                <meshStandardMaterial color="#e0e4ea" metalness={0.3} roughness={0.4} /></mesh>
              <mesh position={[si === 0 ? 0.22 : -0.22, 0.14, 0]}>
                <boxGeometry args={[0.03, 0.26, 0.65]} />
                <meshPhysicalMaterial color="#c8e8ff" transparent opacity={0.18} roughness={0.02} transmission={0.65} />
              </mesh>
              <mesh position={[si === 0 ? 0.22 : -0.22, 0.28, 0]}>
                <boxGeometry args={[0.04, 0.03, 0.68]} />
                <meshStandardMaterial color="#b0b8c0" metalness={0.8} roughness={0.15} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* ═══ NIGHT LIGHTING — Éclairage nocturne premium ═══ */}
      {night && <>
        <mesh position={[0, 0.75, -0.5]}><boxGeometry args={[3.62, 0.03, 12]} />
          <meshStandardMaterial color="#ffe8c0" emissive="#FFD080" emissiveIntensity={3} transparent opacity={0.6} /></mesh>
        <mesh position={[0, 1.55, -0.5]}><boxGeometry args={[3.22, 0.03, 10]} />
          <meshStandardMaterial color="#ffe8c0" emissive="#FFD080" emissiveIntensity={2.5} transparent opacity={0.5} /></mesh>
        <mesh position={[0, 2.35, -0.3]}><boxGeometry args={[2.82, 0.03, 8]} />
          <meshStandardMaterial color="#ffe8c0" emissive="#FFD080" emissiveIntensity={2} transparent opacity={0.45} /></mesh>
      </>}
      {night && <>
        <pointLight position={[3, 1.5, -2]} intensity={2.5} color="#ffe0a0" distance={8} decay={2} />
        <pointLight position={[-3, 1.5, -2]} intensity={2.5} color="#ffe0a0" distance={8} decay={2} />
        <pointLight position={[0, 3.5, -5]} intensity={2} color="#b0d8ff" distance={10} decay={2} />
        <pointLight position={[0, 1, 5]} intensity={1.8} color="#ffd070" distance={7} decay={2} />
      </>}
      {night && <mesh position={[0, 3.25, -4.42]}><planeGeometry args={[1.6, 0.4]} />
        <meshStandardMaterial color="#40a0ff" emissive="#40a0ff" emissiveIntensity={4} transparent opacity={0.7} /></mesh>}

      {/* Nav lights - Blue */}
      <mesh position={[2.05, 1.5, -6]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={2.5} /></mesh>
      <mesh position={[-2.05, 1.5, -6]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={2.5} /></mesh>

      {/* ═══ ENHANCED WAKE TRAIL ═══ */}
      <group ref={wakeRef}>
        <mesh position={[0, -0.8, 10]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.5, 10]} /><meshStandardMaterial color="white" transparent opacity={0.06} /></mesh>
        <mesh position={[1.2, -0.85, 13]} rotation={[-Math.PI / 2, 0, 0.25]}><planeGeometry args={[2, 7]} /><meshStandardMaterial color="#e0f8ff" transparent opacity={0.05} /></mesh>
        <mesh position={[-1.2, -0.85, 13]} rotation={[-Math.PI / 2, 0, -0.25]}><planeGeometry args={[2, 7]} /><meshStandardMaterial color="#e0f8ff" transparent opacity={0.05} /></mesh>
        <mesh position={[0.8, -0.7, -8.5]} rotation={[-Math.PI / 2, 0, 0.3]}><planeGeometry args={[0.8, 2]} /><meshStandardMaterial color="white" transparent opacity={0.2} /></mesh>
        <mesh position={[-0.8, -0.7, -8.5]} rotation={[-Math.PI / 2, 0, -0.3]}><planeGeometry args={[0.8, 2]} /><meshStandardMaterial color="white" transparent opacity={0.2} /></mesh>
        {[...Array(8)].map((_, i) => (
          <mesh key={`turb-${i}`} position={[(Math.random() - 0.5) * 2, -0.9, 8 + i * 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3 + Math.random() * 0.4, 8]} /><meshStandardMaterial color="white" transparent opacity={0.08} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── FESTIVAL + DISCO Deck Party v4 — PERSONNAGES PREMIUM CINÉMATOGRAPHIQUES ─────────────────────────
function DeckParty({ night }) {
  const ref = useRef();
  const strobeRef = useRef();
  const colors = ['#FF00FF', '#00FFFF', '#FFD700', '#FF0040', '#00FF41', '#FF6B00', '#8B00FF', '#FF1493'];
  const [strobeColor, setStrobeColor] = useState(0);

  // Palette de vêtements réalistes
  const outfitColors = [
    { top: '#e74c3c', bottom: '#2c3e50' }, // Rouge / Bleu marine
    { top: '#9b59b6', bottom: '#1a1a2e' }, // Violet / Noir
    { top: '#00d4aa', bottom: '#2c3e50' }, // Turquoise / Navy
    { top: '#f39c12', bottom: '#34495e' }, // Orange / Gris
    { top: '#e91e63', bottom: '#212121' }, // Rose / Noir
    { top: '#3498db', bottom: '#1a1a1a' }, // Bleu / Noir
    { top: '#2ecc71', bottom: '#2c3e50' }, // Vert / Navy
    { top: '#f1c40f', bottom: '#2c2c2c' }, // Jaune / Charbon
  ];
  
  // Teintes de peau diverses
  const skinTones = ['#FDBCB4', '#DEB887', '#C68642', '#8D5524', '#F5DEB3', '#D2B48C', '#CD853F', '#E8BEAC'];
  
  // Couleurs de cheveux
  const hairColors = ['#1a1a1a', '#4a3728', '#8B4513', '#FFD700', '#C0C0C0', '#2c1810', '#5c3317', '#8B0000'];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    
    // Dancers - mouvements de danse réalistes
    ref.current.children.forEach((c, i) => {
      if (c.userData.dancer) {
        const phase = i * 0.4;
        // Saut rythmique
        c.position.y = c.userData.baseY + Math.abs(Math.sin(t * 3.5 + phase)) * 0.18;
        // Rotation du corps
        c.rotation.y = Math.sin(t * 2.5 + phase) * 0.4;
        // Balancement latéral
        c.rotation.z = Math.sin(t * 4 + phase) * 0.08;
      }
      if (c.userData.artist) {
        c.position.y = c.userData.baseY + Math.abs(Math.sin(t * 2)) * 0.12;
        c.rotation.y = Math.sin(t * 1.2) * 0.25;
      }
      if (c.userData.dj) {
        // DJ bouge légèrement
        c.rotation.y = Math.sin(t * 1.8) * 0.15;
      }
    });
    
    // Strobe effect
    if (night && strobeRef.current) {
      const strobeIndex = Math.floor(t * 6) % colors.length;
      setStrobeColor(strobeIndex);
    }
  });

  // Accessoires premium pour les personnages
  const accessoryColors = ['#FFD700', '#C0C0C0', '#FF69B4', '#00CED1', '#FF4500', '#9400D3'];
  
  // Composant réutilisable pour un personnage ULTRA PREMIUM
  const PremiumCharacter = ({ position, outfit, skin, hair, isRaising, isDancing, scale = 1, role, accessory = null }) => {
    // Accessoires aléatoires mais cohérents par personnage
    const hasGlasses = Math.random() > 0.7;
    const hasNecklace = Math.random() > 0.6;
    const hasBracelet = Math.random() > 0.5;
    const hasEarrings = Math.random() > 0.65;
    const accColor = accessoryColors[Math.floor(Math.random() * accessoryColors.length)];
    
    return (
      <group position={position} userData={{ dancer: isDancing, artist: role === 'artist', dj: role === 'dj', baseY: position[1] }} scale={[scale, scale, scale]}>
        {/* ═══ JAMBES PREMIUM - Plus de détails ═══ */}
        <group position={[0, 0, 0]}>
          {/* Jambe gauche avec muscle subtil */}
          <mesh position={[-0.035, 0.08, 0]}>
            <capsuleGeometry args={[0.026, 0.15, 6, 12]} />
            <meshStandardMaterial color={outfit.bottom} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Jambe droite */}
          <mesh position={[0.035, 0.08, 0]}>
            <capsuleGeometry args={[0.026, 0.15, 6, 12]} />
            <meshStandardMaterial color={outfit.bottom} roughness={0.55} metalness={0.05} />
          </mesh>
          
          {/* Chaussures premium - Style sneakers/talons */}
          <group position={[-0.035, -0.025, 0.01]}>
            <mesh>
              <boxGeometry args={[0.038, 0.028, 0.06]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.2} />
            </mesh>
            {/* Semelle colorée */}
            <mesh position={[0, -0.015, 0]}>
              <boxGeometry args={[0.04, 0.008, 0.065]} />
              <meshStandardMaterial color={outfit.top} roughness={0.4} />
            </mesh>
          </group>
          <group position={[0.035, -0.025, 0.01]}>
            <mesh>
              <boxGeometry args={[0.038, 0.028, 0.06]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.2} />
            </mesh>
            <mesh position={[0, -0.015, 0]}>
              <boxGeometry args={[0.04, 0.008, 0.065]} />
              <meshStandardMaterial color={outfit.top} roughness={0.4} />
            </mesh>
          </group>
        </group>
        
        {/* ═══ TORSE PREMIUM - Silhouette réaliste ═══ */}
        <group position={[0, 0.22, 0]}>
          {/* Corps principal - forme plus réaliste */}
          <mesh>
            <capsuleGeometry args={[0.048, 0.13, 8, 16]} />
            <meshStandardMaterial 
              color={outfit.top} 
              roughness={0.45}
              metalness={0.08}
              emissive={outfit.top}
              emissiveIntensity={night ? 0.18 : 0}
            />
          </mesh>
          
          {/* Col en V ou rond - détail vestimentaire */}
          <mesh position={[0, 0.065, 0.025]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.35} />
          </mesh>
          
          {/* Détail de couture / motif sur le vêtement */}
          <mesh position={[0, 0, 0.049]}>
            <boxGeometry args={[0.015, 0.08, 0.002]} />
            <meshStandardMaterial 
              color={outfit.bottom} 
              roughness={0.6} 
              transparent 
              opacity={0.4} 
            />
          </mesh>
          
          {/* Collier/Chaîne si accessoire */}
          {hasNecklace && (
            <mesh position={[0, 0.055, 0.04]}>
              <torusGeometry args={[0.025, 0.003, 8, 24]} />
              <meshStandardMaterial 
                color={accColor} 
                metalness={0.95} 
                roughness={0.05}
                emissive={accColor}
                emissiveIntensity={night ? 0.5 : 0}
              />
            </mesh>
          )}
        </group>
        
        {/* ═══ BRAS PREMIUM - Anatomie plus réaliste ═══ */}
        <group position={[0, 0.24, 0]}>
          {/* Épaule gauche */}
          <mesh position={[-0.055, 0.03, 0]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={outfit.top} roughness={0.45} />
          </mesh>
          
          {/* Bras gauche - avant-bras et bras */}
          <mesh position={[-0.075, isRaising ? 0.1 : -0.01, 0]} rotation={[0, 0, isRaising ? 1.0 : 0.25]}>
            <capsuleGeometry args={[0.02, 0.11, 6, 10]} />
            <meshStandardMaterial color={skin} roughness={0.38} />
          </mesh>
          
          {/* Main gauche détaillée */}
          <group position={[isRaising ? -0.13 : -0.1, isRaising ? 0.18 : -0.09, 0]}>
            <mesh>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.35} />
            </mesh>
            {/* Doigts subtils */}
            {isRaising && (
              <mesh position={[0, 0.015, 0]} rotation={[0, 0, 0.3]}>
                <boxGeometry args={[0.025, 0.012, 0.008]} />
                <meshStandardMaterial color={skin} roughness={0.35} />
              </mesh>
            )}
          </group>
          
          {/* Bracelet gauche */}
          {hasBracelet && (
            <mesh position={[isRaising ? -0.11 : -0.085, isRaising ? 0.12 : -0.05, 0]} rotation={[0, 0, isRaising ? 1.0 : 0.25]}>
              <torusGeometry args={[0.022, 0.004, 8, 16]} />
              <meshStandardMaterial color={accColor} metalness={0.9} roughness={0.1} />
            </mesh>
          )}
          
          {/* Épaule droite */}
          <mesh position={[0.055, 0.03, 0]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={outfit.top} roughness={0.45} />
          </mesh>
          
          {/* Bras droit */}
          <mesh position={[0.075, isRaising ? 0.1 : -0.01, 0]} rotation={[0, 0, isRaising ? -1.0 : -0.25]}>
            <capsuleGeometry args={[0.02, 0.11, 6, 10]} />
            <meshStandardMaterial color={skin} roughness={0.38} />
          </mesh>
          
          {/* Main droite détaillée */}
          <group position={[isRaising ? 0.13 : 0.1, isRaising ? 0.18 : -0.09, 0]}>
            <mesh>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.35} />
            </mesh>
            {isRaising && (
              <mesh position={[0, 0.015, 0]} rotation={[0, 0, -0.3]}>
                <boxGeometry args={[0.025, 0.012, 0.008]} />
                <meshStandardMaterial color={skin} roughness={0.35} />
              </mesh>
            )}
          </group>
        </group>
        
        {/* ═══ TÊTE ULTRA PREMIUM ═══ */}
        <group position={[0, 0.42, 0]}>
          {/* Crâne - forme plus ovale et réaliste */}
          <mesh scale={[1, 1.08, 0.95]}>
            <sphereGeometry args={[0.058, 16, 16]} />
            <meshStandardMaterial color={skin} roughness={0.32} />
          </mesh>
          
          {/* Oreilles */}
          <mesh position={[-0.055, 0, 0]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color={skin} roughness={0.35} />
          </mesh>
          <mesh position={[0.055, 0, 0]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color={skin} roughness={0.35} />
          </mesh>
          
          {/* Boucles d'oreilles */}
          {hasEarrings && (
            <>
              <mesh position={[-0.058, -0.01, 0]}>
                <sphereGeometry args={[0.006, 6, 6]} />
                <meshStandardMaterial color={accColor} metalness={0.95} roughness={0.05} emissive={accColor} emissiveIntensity={night ? 0.8 : 0} />
              </mesh>
              <mesh position={[0.058, -0.01, 0]}>
                <sphereGeometry args={[0.006, 6, 6]} />
                <meshStandardMaterial color={accColor} metalness={0.95} roughness={0.05} emissive={accColor} emissiveIntensity={night ? 0.8 : 0} />
              </mesh>
            </>
          )}
          
          {/* Cheveux premium - plus de volume et texture */}
          <group position={[0, 0.028, -0.008]}>
            <mesh>
              <sphereGeometry args={[0.062, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
              <meshStandardMaterial color={hair} roughness={0.65} />
            </mesh>
            {/* Mèches / texture de cheveux */}
            <mesh position={[0.025, 0.01, 0.03]} rotation={[0.2, 0.3, 0.1]}>
              <boxGeometry args={[0.015, 0.025, 0.008]} />
              <meshStandardMaterial color={hair} roughness={0.7} />
            </mesh>
            <mesh position={[-0.02, 0.015, 0.025]} rotation={[-0.1, -0.2, 0.15]}>
              <boxGeometry args={[0.012, 0.02, 0.006]} />
              <meshStandardMaterial color={hair} roughness={0.7} />
            </mesh>
          </group>
          
          {/* Sourcils */}
          <mesh position={[-0.022, 0.025, 0.048]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[0.018, 0.004, 0.003]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          <mesh position={[0.022, 0.025, 0.048]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.018, 0.004, 0.003]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          
          {/* Yeux premium - iris et pupille */}
          <group position={[-0.022, 0.008, 0.048]}>
            {/* Blanc de l'œil */}
            <mesh>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshStandardMaterial color="#f5f5f5" roughness={0.2} />
            </mesh>
            {/* Iris */}
            <mesh position={[0, 0, 0.005]}>
              <circleGeometry args={[0.006, 12]} />
              <meshStandardMaterial color="#4a3020" />
            </mesh>
            {/* Pupille */}
            <mesh position={[0, 0, 0.007]}>
              <circleGeometry args={[0.003, 8]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
            {/* Reflet */}
            <mesh position={[0.002, 0.002, 0.008]}>
              <circleGeometry args={[0.0015, 6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
            </mesh>
          </group>
          <group position={[0.022, 0.008, 0.048]}>
            <mesh>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshStandardMaterial color="#f5f5f5" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.005]}>
              <circleGeometry args={[0.006, 12]} />
              <meshStandardMaterial color="#4a3020" />
            </mesh>
            <mesh position={[0, 0, 0.007]}>
              <circleGeometry args={[0.003, 8]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0.002, 0.002, 0.008]}>
              <circleGeometry args={[0.0015, 6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
            </mesh>
          </group>
          
          {/* Lunettes de soleil premium */}
          {hasGlasses && (
            <group position={[0, 0.01, 0.055]}>
              {/* Monture */}
              <mesh position={[0, 0, 0]}>
                <torusGeometry args={[0.035, 0.003, 8, 32, Math.PI]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Verre gauche */}
              <mesh position={[-0.018, 0, 0.003]}>
                <circleGeometry args={[0.014, 12]} />
                <meshStandardMaterial 
                  color="#1a1a1a" 
                  transparent 
                  opacity={0.85} 
                  metalness={0.5}
                  emissive={night ? '#00FFFF' : '#000000'}
                  emissiveIntensity={night ? 0.2 : 0}
                />
              </mesh>
              {/* Verre droit */}
              <mesh position={[0.018, 0, 0.003]}>
                <circleGeometry args={[0.014, 12]} />
                <meshStandardMaterial 
                  color="#1a1a1a" 
                  transparent 
                  opacity={0.85}
                  metalness={0.5}
                  emissive={night ? '#FF00FF' : '#000000'}
                  emissiveIntensity={night ? 0.2 : 0}
                />
              </mesh>
            </group>
          )}
          
          {/* Nez subtil */}
          <mesh position={[0, -0.005, 0.055]}>
            <coneGeometry args={[0.008, 0.018, 4]} />
            <meshStandardMaterial color={skin} roughness={0.35} />
          </mesh>
          
          {/* Bouche premium - lèvres plus détaillées */}
          <group position={[0, -0.022, 0.05]}>
            {/* Lèvre supérieure */}
            <mesh position={[0, 0.003, 0]} scale={[1, 0.6, 1]}>
              <capsuleGeometry args={[0.012, 0.008, 4, 8]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#c0392b" roughness={0.4} />
            </mesh>
            {/* Lèvre inférieure */}
            <mesh position={[0, -0.005, 0]} scale={[1.1, 0.7, 1]}>
              <capsuleGeometry args={[0.011, 0.006, 4, 8]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#b83224" roughness={0.45} />
            </mesh>
          </group>
        </group>
      </group>
    );
  };

  return (
    <group ref={ref} position={[0, 2.9, 0.5]}>
      {/* ═══ SCÈNE DE CONCERT PREMIUM ═══ */}
      <group position={[0, 0.05, -1.5]}>
        {/* Plateforme de scène - multi-niveaux */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 0.18, 1.2]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Bande LED avant */}
        <mesh position={[0, 0.09, 0.61]}>
          <boxGeometry args={[2, 0.06, 0.03]} />
          <meshStandardMaterial 
            color={night ? colors[strobeColor] : '#333'} 
            emissive={colors[strobeColor]} 
            emissiveIntensity={night ? 5 : 0} 
          />
        </mesh>
        {/* Bandes LED latérales */}
        {[-1, 1].map((side, i) => (
          <mesh key={i} position={[side * 1.01, 0.09, 0]}>
            <boxGeometry args={[0.03, 0.06, 1.2]} />
            <meshStandardMaterial 
              color={night ? colors[(strobeColor + 2) % colors.length] : '#333'} 
              emissive={colors[(strobeColor + 2) % colors.length]} 
              emissiveIntensity={night ? 4 : 0} 
            />
          </mesh>
        ))}
        
        {/* ═══ STRUCTURE TRUSS PREMIUM ═══ */}
        {[-0.85, 0.85].map((x, i) => (
          <group key={`truss-${i}`} position={[x, 0.65, -0.4]}>
            {/* Montants verticaux */}
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Traverses */}
            {[0.2, 0.5, 0.8].map((h, hi) => (
              <mesh key={hi} position={[0, h - 0.4, 0.08]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.15, 6]} />
                <meshStandardMaterial color="#4a4a4a" metalness={0.85} />
              </mesh>
            ))}
            {/* Projecteurs orientables */}
            <group position={[0, 0.7, 0.05]}>
              <mesh rotation={[0.4, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.04, 0.12, 12]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} />
              </mesh>
              <mesh position={[0, -0.08, 0.04]} rotation={[0.4, 0, 0]}>
                <circleGeometry args={[0.035, 16]} />
                <meshStandardMaterial 
                  color={colors[(i + strobeColor) % colors.length]}
                  emissive={colors[(i + strobeColor) % colors.length]}
                  emissiveIntensity={night ? 4 : 0.5}
                />
              </mesh>
              
            </group>
          </group>
        ))}
        
        {/* Barre de truss supérieure */}
        <mesh position={[0, 1.35, -0.4]}>
          <boxGeometry args={[1.9, 0.05, 0.05]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Moving heads sur la barre */}
        {[-0.6, 0, 0.6].map((x, i) => (
          <group key={`mh-${i}`} position={[x, 1.35, -0.35]}>
            <mesh>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#222" metalness={0.8} />
            </mesh>
            
          </group>
        ))}
        
        {/* ═══ ARTISTE PRINCIPAL / CHANTEUR ═══ */}
        <PremiumCharacter 
          position={[-0.3, 0.28, 0.1]}
          outfit={{ top: '#9b59b6', bottom: '#1a1a1a' }}
          skin="#DEB887"
          hair="#1a1a1a"
          isRaising={true}
          isDancing={false}
          scale={1.1}
          role="artist"
        />
        {/* Micro dans la main */}
        <mesh position={[-0.15, 0.7, 0.1]} rotation={[0.3, 0, 0.5]}>
          <capsuleGeometry args={[0.012, 0.05, 4, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} />
        </mesh>
        <mesh position={[-0.12, 0.75, 0.1]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
        </mesh>
        
        {/* ═══ DJ AVEC ÉQUIPEMENT ═══ */}
        <group position={[0.4, 0.18, 0.25]} userData={{ dj: true }}>
          {/* DJ Character */}
          <PremiumCharacter 
            position={[0, 0.1, 0]}
            outfit={{ top: '#e74c3c', bottom: '#2c3e50' }}
            skin="#FDBCB4"
            hair="#4a3728"
            isRaising={false}
            isDancing={false}
            scale={1.0}
            role="dj"
          />
          
          {/* Table DJ Premium */}
          <mesh position={[0, 0.15, 0.2]}>
            <boxGeometry args={[0.6, 0.06, 0.35]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.3} />
          </mesh>
          
          {/* Platines CDJ */}
          {[-0.15, 0.15].map((x, i) => (
            <group key={i} position={[x, 0.19, 0.2]}>
              <mesh>
                <boxGeometry args={[0.18, 0.03, 0.2]} />
                <meshStandardMaterial color="#0a0a0a" metalness={0.4} />
              </mesh>
              {/* Jog wheel */}
              <mesh position={[0, 0.02, -0.02]}>
                <cylinderGeometry args={[0.055, 0.055, 0.015, 24]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.2} />
              </mesh>
              {/* Écran */}
              <mesh position={[0, 0.02, 0.06]}>
                <boxGeometry args={[0.08, 0.008, 0.04]} />
                <meshStandardMaterial 
                  color="#00aaff"
                  emissive="#00aaff"
                  emissiveIntensity={night ? 2 : 0.3}
                />
              </mesh>
            </group>
          ))}
          
          {/* Mixeur central */}
          <mesh position={[0, 0.19, 0.2]}>
            <boxGeometry args={[0.1, 0.04, 0.18]} />
            <meshStandardMaterial color="#111" metalness={0.5} />
          </mesh>
          {/* Faders */}
          {[-0.02, 0.02].map((x, i) => (
            <mesh key={i} position={[x, 0.22, 0.22]}>
              <boxGeometry args={[0.015, 0.01, 0.04]} />
              <meshStandardMaterial color="#e74c3c" />
            </mesh>
          ))}
          {/* VU-mètres LED */}
          <mesh position={[0, 0.22, 0.15]}>
            <boxGeometry args={[0.06, 0.008, 0.02]} />
            <meshStandardMaterial 
              color="#00ff00"
              emissive="#00ff00"
              emissiveIntensity={night ? 2.5 : 0.5}
            />
          </mesh>
          
          {/* Casque DJ autour du cou */}
          <mesh position={[0.4, 0.35, 0.25]}>
            <torusGeometry args={[0.035, 0.012, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.6} />
          </mesh>
        </group>
      </group>

      {/* ═══ FOULE DE DANSEURS PREMIUM ═══ */}
      {[
        // Première rangée (proche de la scène)
        { pos: [-0.7, 0.18, 0.3], outfit: 0, skin: 0, hair: 0, raise: true },
        { pos: [0.7, 0.18, 0.3], outfit: 1, skin: 1, hair: 1, raise: true },
        { pos: [-0.35, 0.18, 0.4], outfit: 2, skin: 2, hair: 2, raise: false },
        { pos: [0.35, 0.18, 0.4], outfit: 3, skin: 3, hair: 3, raise: true },
        { pos: [0, 0.18, 0.5], outfit: 4, skin: 4, hair: 4, raise: true },
        // Deuxième rangée
        { pos: [-0.85, 0.18, 0.8], outfit: 5, skin: 5, hair: 5, raise: false },
        { pos: [0.85, 0.18, 0.8], outfit: 6, skin: 6, hair: 6, raise: true },
        { pos: [-0.45, 0.18, 0.9], outfit: 7, skin: 0, hair: 7, raise: true },
        { pos: [0.45, 0.18, 0.9], outfit: 0, skin: 1, hair: 0, raise: false },
        { pos: [0, 0.18, 1.0], outfit: 1, skin: 2, hair: 1, raise: true },
        // Troisième rangée (arrière)
        { pos: [-0.65, 0.18, 1.25], outfit: 2, skin: 3, hair: 2, raise: true },
        { pos: [0.65, 0.18, 1.25], outfit: 3, skin: 4, hair: 3, raise: false },
        { pos: [-0.25, 0.18, 1.35], outfit: 4, skin: 5, hair: 4, raise: false },
        { pos: [0.25, 0.18, 1.35], outfit: 5, skin: 6, hair: 5, raise: true },
        // Danseurs sur les côtés
        { pos: [-1.1, 0.18, 0.6], outfit: 6, skin: 7, hair: 6, raise: true },
        { pos: [1.1, 0.18, 0.6], outfit: 7, skin: 0, hair: 7, raise: true },
        // Couples dansant ensemble
        { pos: [-0.9, 0.18, 1.1], outfit: 0, skin: 2, hair: 1, raise: false },
        { pos: [-0.75, 0.18, 1.1], outfit: 1, skin: 5, hair: 4, raise: false },
      ].map((dancer, i) => (
        <PremiumCharacter 
          key={`dancer-${i}`}
          position={dancer.pos}
          outfit={outfitColors[dancer.outfit % outfitColors.length]}
          skin={skinTones[dancer.skin % skinTones.length]}
          hair={hairColors[dancer.hair % hairColors.length]}
          isRaising={dancer.raise}
          isDancing={true}
          scale={0.95 + Math.random() * 0.1}
          role="dancer"
        />
      ))}

      {/* ═══ ENCEINTES PREMIUM ═══ */}
      {[-1.3, 1.3].map((x, i) => (
        <group key={`spk-${i}`} position={[x, 0.45, -0.7]}>
          {/* Caisson principal */}
          <mesh>
            <boxGeometry args={[0.45, 0.85, 0.4]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* Grille de protection */}
          <mesh position={[0, 0, 0.21]}>
            <boxGeometry args={[0.43, 0.83, 0.02]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.6} />
          </mesh>
          {/* Woofer 15" */}
          <mesh position={[0, -0.15, 0.22]}>
            <circleGeometry args={[0.16, 24]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.15, 0.225]}>
            <circleGeometry args={[0.06, 16]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* Tweeter */}
          <mesh position={[0, 0.2, 0.22]}>
            <circleGeometry args={[0.07, 16]} />
            <meshStandardMaterial color="#333" metalness={0.6} />
          </mesh>
          {/* LED d'état */}
          <mesh position={[0.18, 0.35, 0.22]}>
            <circleGeometry args={[0.015, 8]} />
            <meshStandardMaterial 
              color="#00ff00" 
              emissive="#00ff00" 
              emissiveIntensity={night ? 4 : 1} 
            />
          </mesh>
          {/* Logo marque */}
          <mesh position={[0, 0.35, 0.22]}>
            <boxGeometry args={[0.08, 0.02, 0.005]} />
            <meshStandardMaterial color="#666" metalness={0.8} />
          </mesh>
        </group>
      ))}
      
      {/* ═══ LASER BEAMS PREMIUM ═══ */}
      {night && [...Array(8)].map((_, i) => (
        <mesh key={`laser-${i}`} 
          position={[Math.sin(i * 0.8) * 0.6, 1.0, Math.cos(i * 0.8) * 0.6 - 0.6]} 
          rotation={[Math.PI / 4 + i * 0.15, 0, i * 0.4]}>
          <cylinderGeometry args={[0.004, 0.004, 2.5, 4]} />
          <meshStandardMaterial 
            color={colors[i % colors.length]} 
            emissive={colors[i % colors.length]} 
            emissiveIntensity={8} 
            transparent 
            opacity={0.7} 
          />
        </mesh>
      ))}

      {/* ═══ STROBE / PARTY LIGHTS — emissive only ═══ */}
      {night && (
        <group ref={strobeRef}>
          {colors.map((c, i) => (
            <mesh key={i} position={[Math.sin(i * 0.8) * 1.4, 0.7, Math.cos(i * 0.8) * 1.4]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color={c} transparent opacity={i === strobeColor ? 1 : 0.3} />
            </mesh>
          ))}
        </group>
      )}
      
      {/* ═══ CONFETTIS PREMIUM ═══ */}
      {night && [...Array(25)].map((_, i) => (
        <mesh key={`confetti-${i}`} 
          position={[
            (Math.random() - 0.5) * 3,
            0.4 + Math.random() * 1.8,
            (Math.random() - 0.5) * 2.5
          ]}
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <boxGeometry args={[0.025, 0.025, 0.003]} />
          <meshStandardMaterial 
            color={colors[i % colors.length]} 
            emissive={colors[i % colors.length]} 
            emissiveIntensity={3}
            metalness={0.4}
          />
        </mesh>
      ))}
      
      {/* ═══ FUMÉE / BROUILLARD ═══ */}
      {night && [...Array(5)].map((_, i) => (
        <mesh key={`fog-${i}`} 
          position={[(Math.random() - 0.5) * 2, 0.3 + i * 0.15, (Math.random() - 0.5) * 2]}>
          <sphereGeometry args={[0.4 + Math.random() * 0.3, 8, 8]} />
          <meshStandardMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.04} 
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Seagulls v3 — More realistic with gliding & diving ────
function Seagulls({ tod }) {
  const ref = useRef();
  const isDay = tod > 0.18 && tod < 0.82;

function HubWorldExpansion({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const pulseRefs = useRef([]);

  const skylineBuildings = useMemo(() => ([
    { x: -82, z: -170, w: 10, d: 10, h: 28, style: 'concrete' },
    { x: -64, z: -162, w: 16, d: 14, h: 42, style: 'glass-tower', crown: true },
    { x: -46, z: -154, w: 12, d: 12, h: 34, style: 'modern-slim', antenna: true },
    { x: -28, z: -160, w: 18, d: 16, h: 48, style: 'office', setbacks: true },
    { x: -10, z: -168, w: 14, d: 14, h: 38, style: 'residential' },
    { x: 12, z: -166, w: 20, d: 18, h: 58, style: 'supertall', spire: true },
    { x: 34, z: -158, w: 16, d: 14, h: 46, style: 'art-deco', crown: true },
    { x: 56, z: -150, w: 22, d: 18, h: 66, style: 'glass-tower', spire: true },
    { x: 74, z: -162, w: 12, d: 12, h: 32, style: 'concrete' },
    { x: 94, z: -170, w: 18, d: 18, h: 50, style: 'modern-slim', crown: true },
  ]), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    pulseRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.intensity = night ? 0.28 + Math.max(0, Math.sin(t * 2 + index * 0.6)) * 0.22 : 0.08;
      ref.position.y = 2.2 + Math.sin(t * 1.3 + index) * 0.1;
    });
  });

  return (
    <group>
      <group position={[16, 0, -28]}>
        <mesh position={[0, 0.22, 0]}><boxGeometry args={[34, 0.18, 18]} /><meshStandardMaterial color={night ? '#dce5ed' : '#f7fbff'} roughness={0.22} metalness={0.12} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[32, 0.06, 16]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={night ? 0.92 : 0.08} /></mesh>
        <mesh position={[0, 1.15, -8]}><boxGeometry args={[18, 1.8, 4]} /><meshStandardMaterial color="#101826" roughness={0.48} metalness={0.24} /></mesh>
        <mesh position={[0, 2.1, -7.9]}><boxGeometry args={[17.6, 0.08, 0.08]} /><meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={night ? 0.8 : 0.08} /></mesh>
        <Text position={[0, 3.9, -7.8]} fontSize={0.72} color="#ffffff" anchorX="center">PLAZA PREMIUM</Text>
        {[-10, -3, 4, 11].map((x, i) => (
          <group key={`plaza-tower-${i}`} position={[x, 0.12, 5.6]}>
            <mesh position={[0, 1.35, 0]}><boxGeometry args={[3.1, 2.7, 3.1]} /><meshStandardMaterial color={i % 2 === 0 ? '#12263f' : '#1d354d'} roughness={0.34} metalness={0.18} /></mesh>
            <mesh position={[0, 2.92, 0]}><coneGeometry args={[1.2, 1.6, 4]} /><meshStandardMaterial color={i % 2 === 0 ? '#7ce7ff' : '#ffd166'} emissive={i % 2 === 0 ? '#7ce7ff' : '#ffd166'} emissiveIntensity={night ? 0.8 : 0.08} /></mesh>
            <pointLight ref={(el) => { pulseRefs.current[i] = el; }} position={[0, 2.3, 0]} color={i % 2 === 0 ? '#7ce7ff' : '#ffd166'} intensity={night ? 0.22 : 0.08} distance={8} />
          </group>
        ))}
      </group>

      <group position={[-18, 0, -42]}>
        <mesh position={[0, 0.16, 0]} rotation={[0, -0.18, 0]}><boxGeometry args={[24, 0.32, 3.2]} /><meshStandardMaterial color="#eef4f9" roughness={0.2} metalness={0.16} /></mesh>
        <mesh position={[0, 2.1, 0]} rotation={[0, -0.18, 0]}><boxGeometry args={[23.7, 0.06, 0.12]} /><meshStandardMaterial color="#8fd9ff" emissive="#8fd9ff" emissiveIntensity={night ? 0.9 : 0.06} /></mesh>
        {[-9, -3, 3, 9].map((x, i) => (
          <mesh key={`skywalk-post-${i}`} position={[x, 1.1, 0]} rotation={[0, -0.18, 0]}><boxGeometry args={[0.18, 2.2, 0.18]} /><meshStandardMaterial color="#d6dfe8" metalness={0.7} roughness={0.14} /></mesh>
        ))}
        <Text position={[0, 2.9, 0]} fontSize={0.42} color="#eaf8ff" anchorX="center">SKYWALK</Text>
      </group>

      <group position={[42, 0, -18]}>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[18, 0.32, 12]} /><meshStandardMaterial color={night ? '#dfe8f0' : '#f7fbff'} roughness={0.2} metalness={0.18} /></mesh>
        <mesh position={[0, 1.1, -2.6]}><boxGeometry args={[16, 2.2, 4.2]} /><meshStandardMaterial color="#0f1723" roughness={0.36} metalness={0.16} /></mesh>
        <mesh position={[0, 2.35, -2.5]}><boxGeometry args={[15.2, 0.06, 0.06]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={night ? 1.1 : 0.08} /></mesh>
        <Text position={[0, 3.8, -2.4]} fontSize={0.5} color="#ffffff" anchorX="center">VIP TERMINAL</Text>
        {[-5.5, 0, 5.5].map((x, i) => (
          <mesh key={`vip-pillar-${i}`} position={[x, 1.1, 4.2]}><cylinderGeometry args={[0.12, 0.18, 2.4, 8]} /><meshStandardMaterial color="#94a6b7" metalness={0.68} roughness={0.14} /></mesh>
        ))}
      </group>

      <group position={[-54, 0, 170]}>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[16, 18, 2.2, 24]} /><meshStandardMaterial color={night ? '#233746' : '#e8eff5'} roughness={0.7} metalness={0.08} /></mesh>
        <mesh position={[0, 2.45, 0]} rotation={[0, 0.15, 0]}><boxGeometry args={[12, 3.1, 12]} /><meshStandardMaterial color="#132538" roughness={0.34} metalness={0.18} /></mesh>
        <mesh position={[0, 4.15, 0]} rotation={[0, 0.15, 0]}><coneGeometry args={[5.6, 2.1, 5]} /><meshStandardMaterial color="#8ef0a7" emissive="#8ef0a7" emissiveIntensity={night ? 0.65 : 0.06} /></mesh>
        <Text position={[0, 6.1, 0]} fontSize={0.48} color="#ffffff" anchorX="center">ÎLE CULTURE</Text>
      </group>

      <group position={[74, 0, -44]}>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[22, 0.32, 6]} /><meshStandardMaterial color="#f7fbff" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 0.95, 0]}><boxGeometry args={[16, 1.5, 3.2]} /><meshStandardMaterial color="#0d1320" roughness={0.42} metalness={0.18} /></mesh>
        <Text position={[0, 2.4, 0]} fontSize={0.45} color="#ffe0f3" anchorX="center">PAVILLON ART</Text>
      </group>

      {skylineBuildings.map((b, i) => (
        <group key={`skyline-${i}`} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]}><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={night ? '#283340' : '#b8c8d8'} roughness={0.22} metalness={0.34} /></mesh>
        </group>
      ))}
    </group>
  );
}

function HubGameplayLayer({ tod, isTouchDevice, controlsRef, cameraRef, active }) {
  const playerRef = useRef();
  const carRef = useRef();
  const boatRef = useRef();
  const [interactionPrompt, setInteractionPrompt] = useState(null);
  const promptSignatureRef = useRef('');
  const inputRef = useRef({ up: false, down: false, left: false, right: false, jump: false, interact: false, sprint: false });
  const mouseRef = useRef({ dragging: false, dx: 0, dy: 0 });
  const modeRef = useRef('walk');
  const activeVehicleRef = useRef(null);
  const interiorRef = useRef('none');
  const playerPosRef = useRef(new THREE.Vector3(14, 0.15, -18));
  const playerVelRef = useRef(new THREE.Vector3());
  const playerYawRef = useRef(0);
  const playerJumpVelRef = useRef(0);
  const cameraOffsetRef = useRef(new THREE.Vector3(0, 4.2, 8.5));
  const vehicleStateRef = useRef({
    car: { pos: new THREE.Vector3(24, 0.18, -22), vel: new THREE.Vector3(), yaw: Math.PI * 0.82 },
    boat: { pos: new THREE.Vector3(6, 0.05, -12), vel: new THREE.Vector3(), yaw: Math.PI * 0.2 },
    yacht: { pos: new THREE.Vector3(-16, 0.18, 10.2), vel: new THREE.Vector3(), yaw: 0.16 },
    carrier: { pos: new THREE.Vector3(55, 2.4, 52), vel: new THREE.Vector3(), yaw: 0 },
    train: { pos: new THREE.Vector3(45, -1.35, -36.25), vel: new THREE.Vector3(), yaw: 0 },
  });
  const interiorSpawnMap = useMemo(() => ({
    marina: new THREE.Vector3(204, 0.18, 200),
    station: new THREE.Vector3(228, 0.18, 200),
    mall: new THREE.Vector3(252, 0.18, 200),
  }), []);
  const playBounds = useMemo(() => ({ minX: -132, maxX: 132, minZ: -186, maxZ: 186 }), []);
  const boardingProfiles = useMemo(() => ({
    car: {
      label: 'Voiture',
      badge: 'AUTO',
      seat: [0.15, 0.82, 0.18],
      door: [1.55, 0.18, 0.35],
      exit: [2.35, 0.18, 0.95],
    },
    boat: {
      label: 'Bateau',
      badge: 'DECK',
      seat: [0.0, 0.62, 0.65],
      door: [1.2, 0.18, 1.9],
      exit: [1.95, 0.18, 2.65],
    },
    yacht: {
      label: 'Mega yacht',
      badge: 'YACHT',
      seat: [0.0, 2.7, 5.2],
      door: [2.4, 1.9, 7.9],
      exit: [3.8, 1.5, 9.3],
    },
    carrier: {
      label: 'Porte-avions',
      badge: 'CARRIER',
      seat: [0.0, 4.2, -10.8],
      door: [6.1, 2.8, -8.8],
      exit: [8.8, 2.0, -4.6],
    },
    train: {
      label: 'Train',
      badge: 'TRAIN',
      seat: [0.0, 0.45, 0.2],
      door: [1.5, 0.15, 2.1],
      exit: [2.4, 0.12, -2.5],
    },
    marina: {
      label: 'Marina Land',
      badge: 'DOOR',
      seat: [0.0, 0.1, 0.0],
      door: [0.0, 0.1, -4.5],
      exit: [-7.8, 0.18, -2.4],
    },
    station: {
      label: 'Gare',
      badge: 'DOOR',
      seat: [0.0, 0.1, 0.0],
      door: [0.0, 0.1, -3.9],
      exit: [-7.8, 0.18, -2.2],
    },
    mall: {
      label: 'Mall',
      badge: 'DOOR',
      seat: [0.0, 0.1, 0.0],
      door: [0.0, 0.1, -4.6],
      exit: [-8.0, 0.18, -2.4],
    },
  }), []);

  const clearManualVehicleFlags = () => {
    delete window.__coastalTrainManual;
    delete window.__coastalTrainManualState;
    delete window.__superyachtManual;
    delete window.__superyachtManualState;
    delete window.__carrierManual;
    delete window.__carrierManualState;
  };

  const setVehicleMode = (nextMode, payload = null) => {
    modeRef.current = nextMode;
    if (nextMode === 'walk') {
      activeVehicleRef.current = null;
      interiorRef.current = 'none';
      clearManualVehicleFlags();
      if (window) window.__hubGameplayMode = 'walk';
      return;
    }
    if (nextMode === 'interior') {
      activeVehicleRef.current = null;
      clearManualVehicleFlags();
      interiorRef.current = payload?.interior || 'marina';
      if (window) window.__hubGameplayMode = 'interior';
      return;
    }
    activeVehicleRef.current = nextMode;
    interiorRef.current = 'none';
    if (payload?.state) {
      const manualState = payload.state;
      if (nextMode === 'train') {
        window.__coastalTrainManual = true;
        window.__coastalTrainManualState = manualState;
      } else if (nextMode === 'yacht') {
        window.__superyachtManual = true;
        window.__superyachtManualState = manualState;
      } else if (nextMode === 'carrier') {
        window.__carrierManual = true;
        window.__carrierManualState = manualState;
      }
    }
    if (window) window.__hubGameplayMode = nextMode;
  };

  const resolveWorldPosition = (value, fallback) => {
    if (value instanceof THREE.Vector3) return value.clone();
    if (value && typeof value.x === 'number' && typeof value.z === 'number') {
      return new THREE.Vector3(value.x, typeof value.y === 'number' ? value.y : fallback.y, value.z);
    }
    return fallback.clone();
  };

  const rotateOffset = (base, yaw, offset) => {
    const [right = 0, up = 0, forward = 0] = offset;
    const forwardVec = new THREE.Vector3(Math.sin(yaw || 0), 0, Math.cos(yaw || 0));
    const rightVec = new THREE.Vector3(forwardVec.z, 0, -forwardVec.x);
    return base.clone()
      .addScaledVector(rightVec, right)
      .addScaledVector(forwardVec, forward)
      .add(new THREE.Vector3(0, up, 0));
  };

  const getTargetPose = (target) => {
    if (!target) return null;
    const basePos = target.position instanceof THREE.Vector3 ? target.position.clone() : target.position;
    const fallbackYaw = target.key === 'train' ? 0 : target.key === 'carrier' ? 0.05 : target.key === 'yacht' ? 0.16 : 0;
    const state = vehicleStateRef.current[target.key] || null;
    const yaw = state?.yaw ?? fallbackYaw;
    const profile = boardingProfiles[target.key] || boardingProfiles.car;
    return { basePos, yaw, profile, state };
  };

  const getBoardingPose = (target, poseKind = 'seat') => {
    const pose = getTargetPose(target);
    if (!pose) return null;
    const offset = pose.profile[poseKind] || pose.profile.seat;
    return rotateOffset(pose.basePos, pose.yaw, offset);
  };

  const interactionTargets = useMemo(() => ([
    { key: 'car', mode: 'car', label: 'Voiture', radius: 4.2, position: () => vehicleStateRef.current.car.pos.clone().add(new THREE.Vector3(0, 0, 0)) },
    { key: 'boat', mode: 'boat', label: 'Bateau', radius: 4.6, position: () => vehicleStateRef.current.boat.pos.clone().add(new THREE.Vector3(0, 0, 0)) },
    { key: 'yacht', mode: 'yacht', label: 'Mega yacht', radius: 10, position: () => resolveWorldPosition(window.__superyachtPos, vehicleStateRef.current.yacht.pos) },
    { key: 'carrier', mode: 'carrier', label: 'Porte-avions', radius: 14, position: () => resolveWorldPosition(window.__carrierPos, vehicleStateRef.current.carrier.pos) },
    { key: 'train', mode: 'train', label: 'Train', radius: 8, position: () => resolveWorldPosition(window.__coastalTrainPos, vehicleStateRef.current.train.pos) },
    { key: 'marina', mode: 'interior', interior: 'marina', label: 'Marina Land', radius: 8, position: () => new THREE.Vector3(38, 0.2, -12) },
    { key: 'station', mode: 'interior', interior: 'station', label: 'Gare', radius: 8, position: () => new THREE.Vector3(45, 0.2, -40) },
    { key: 'mall', mode: 'interior', interior: 'mall', label: 'Mall', radius: 8, position: () => new THREE.Vector3(-18, 0.2, -72) },
  ]), []);

  const updatePrompt = (nextPrompt) => {
    const signature = nextPrompt ? `${nextPrompt.title}|${nextPrompt.action}|${nextPrompt.detail}` : 'none';
    if (promptSignatureRef.current === signature) return;
    promptSignatureRef.current = signature;
    setInteractionPrompt(nextPrompt);
    window.__hubInteractionPrompt = nextPrompt;
  };

  useEffect(() => {
    if (!active) return undefined;
    if (controlsRef.current) controlsRef.current.enabled = false;
    const onKeyDown = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') inputRef.current.up = true;
      if (key === 's' || key === 'arrowdown') inputRef.current.down = true;
      if (key === 'a' || key === 'arrowleft') inputRef.current.left = true;
      if (key === 'd' || key === 'arrowright') inputRef.current.right = true;
      if (key === ' ' || key === 'spacebar') inputRef.current.jump = true;
      if (key === 'shift') inputRef.current.sprint = true;
      if (key === 'e') inputRef.current.interact = true;
    };
    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') inputRef.current.up = false;
      if (key === 's' || key === 'arrowdown') inputRef.current.down = false;
      if (key === 'a' || key === 'arrowleft') inputRef.current.left = false;
      if (key === 'd' || key === 'arrowright') inputRef.current.right = false;
      if (key === ' ' || key === 'spacebar') inputRef.current.jump = false;
      if (key === 'shift') inputRef.current.sprint = false;
      if (key === 'e') inputRef.current.interact = false;
    };
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      mouseRef.current.dragging = true;
    };
    const onPointerUp = () => {
      mouseRef.current.dragging = false;
      mouseRef.current.dx = 0;
      mouseRef.current.dy = 0;
    };
    const onPointerMove = (event) => {
      if (!mouseRef.current.dragging) return;
      mouseRef.current.dx += event.movementX || 0;
      mouseRef.current.dy += event.movementY || 0;
    };
    const onBlur = () => {
      inputRef.current = { up: false, down: false, left: false, right: false, jump: false, interact: false, sprint: false };
      mouseRef.current.dragging = false;
      mouseRef.current.dx = 0;
      mouseRef.current.dy = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('blur', onBlur);
    return () => {
      if (controlsRef.current) controlsRef.current.enabled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]);

  const readGamepad = () => {
    const pads = navigator.getGamepads?.() || [];
    const pad = pads.find((entry) => entry && entry.connected);
    if (!pad) return null;
    return {
      lx: pad.axes?.[0] || 0,
      ly: pad.axes?.[1] || 0,
      rx: pad.axes?.[2] || 0,
      ry: pad.axes?.[3] || 0,
      a: !!pad.buttons?.[0]?.pressed,
      b: !!pad.buttons?.[1]?.pressed,
      x: !!pad.buttons?.[2]?.pressed,
      y: !!pad.buttons?.[3]?.pressed,
      lb: !!pad.buttons?.[4]?.pressed,
      rb: !!pad.buttons?.[5]?.pressed,
      start: !!pad.buttons?.[9]?.pressed,
    };
  };

  useEffect(() => {
    if (!active) return undefined;
    window.__hubGameplayMode = 'walk';
    window.__hubPlayerPos = playerPosRef.current;
    window.__hubEnterPlayerMode = () => setVehicleMode('walk');
    window.__hubExitVehicle = () => setVehicleMode('walk');
    window.__hubEnterInterior = (interior = 'marina') => setVehicleMode('interior', { interior });
    return () => {
      clearManualVehicleFlags();
      delete window.__hubGameplayMode;
      delete window.__hubPlayerPos;
      delete window.__hubEnterPlayerMode;
      delete window.__hubExitVehicle;
      delete window.__hubEnterInterior;
    };
  }, [active]);

  useFrame((_, delta) => {
    if (!active || !controlsRef.current || !cameraRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    ctrl.enabled = false;
    ctrl.autoRotate = false;

    const gp = readGamepad();
    const moveX = (gp ? gp.lx : 0) + (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
    const moveY = (gp ? gp.ly : 0) + (inputRef.current.down ? 1 : 0) - (inputRef.current.up ? 1 : 0);
    const jumpPressed = inputRef.current.jump || !!gp?.a;
    const interactPressed = inputRef.current.interact || !!gp?.x || !!gp?.y;
    const sprintHeld = inputRef.current.sprint || !!gp?.rb;
    const resolvedTargets = interactionTargets.map((target) => ({ ...target, position: target.position() }));
    const nearestTarget = resolvedTargets.reduce((best, target) => {
      const distance = playerPosRef.current.distanceTo(target.position);
      if (!best || distance < best.distance) return { ...target, distance };
      return best;
    }, null);

    const currentTargetPose = nearestTarget ? getTargetPose(nearestTarget) : null;
    const currentProfile = currentTargetPose?.profile || null;
    const boardingSeat = nearestTarget ? getBoardingPose(nearestTarget, 'seat') : null;
    const boardingDoor = nearestTarget ? getBoardingPose(nearestTarget, 'door') : null;
    const boardingExit = nearestTarget ? getBoardingPose(nearestTarget, 'exit') : null;
    const isInsideInterior = modeRef.current === 'interior';

    if (nearestTarget && nearestTarget.distance < Math.max(14, nearestTarget.radius * 1.35)) {
      const action = isInsideInterior && nearestTarget.mode === 'interior' && interiorRef.current === nearestTarget.interior
        ? 'Sortir'
        : modeRef.current === nearestTarget.mode
          ? 'Sortir'
          : nearestTarget.mode === 'interior'
            ? 'Entrer'
            : 'Embarquer';
      updatePrompt({
        title: currentProfile?.label || nearestTarget.label,
        badge: currentProfile?.badge || nearestTarget.label.toUpperCase(),
        action,
        detail: nearestTarget.mode === 'interior'
          ? `${nearestTarget.interior === 'marina' ? 'Lobby + lounge' : nearestTarget.interior === 'station' ? 'Hall + quai' : 'Atrium + commerces'}`
          : nearestTarget.mode === 'train'
            ? 'porte, sièges, sortie quai'
            : nearestTarget.mode === 'carrier'
              ? 'pont, ascenseurs, passerelles'
              : nearestTarget.mode === 'yacht'
                ? 'pont supérieur, cabine, sortie arrière'
                : nearestTarget.mode === 'boat'
                  ? 'pont, cabine, sortie tribord'
                  : 'habitacle, sièges, sortie latérale',
        distance: nearestTarget.distance,
      });
    } else {
      updatePrompt(null);
    }

    if (interactPressed && nearestTarget && nearestTarget.distance < nearestTarget.radius) {
      if (modeRef.current === 'walk' || modeRef.current === 'interior') {
        if (nearestTarget.mode === 'interior') {
          const spawn = interiorSpawnMap[nearestTarget.interior] || interiorSpawnMap.marina;
          setVehicleMode('interior', { interior: nearestTarget.interior });
          playerPosRef.current.copy(spawn);
          playerYawRef.current = nearestTarget.interior === 'station' ? Math.PI * 0.5 : 0;
        } else {
          const currentState = vehicleStateRef.current[nearestTarget.key] || vehicleStateRef.current.car;
          setVehicleMode(nearestTarget.mode, { state: currentState });
          const seatPose = boardingSeat || currentState.pos.clone();
          playerPosRef.current.copy(seatPose);
          playerYawRef.current = currentTargetPose?.yaw ?? 0;
        }
      } else {
        const currentVehicle = vehicleStateRef.current[modeRef.current] || vehicleStateRef.current.car;
        const exitPose = boardingExit || currentVehicle.pos.clone();
        setVehicleMode('walk');
        playerPosRef.current.copy(exitPose);
      }
      inputRef.current.interact = false;
    } else if (interactPressed && modeRef.current === 'interior') {
      const currentInterior = interiorRef.current || 'marina';
      const spawn = interiorSpawnMap[currentInterior] || interiorSpawnMap.marina;
      setVehicleMode('walk');
      playerPosRef.current.set(spawn.x - 8, 0.18, spawn.z - 2.5);
      inputRef.current.interact = false;
    }

    if (modeRef.current === 'walk' || modeRef.current === 'interior' || !activeVehicleRef.current) {
      const walkSpeed = modeRef.current === 'interior' ? (sprintHeld ? 4.8 : 3.2) : (sprintHeld ? 7.2 : 4.8);
      const yawBias = gp ? -gp.rx * 0.05 : 0;
      if (Math.abs(mouseRef.current.dx) > 0.1) {
        playerYawRef.current -= mouseRef.current.dx * 0.0022;
      }
      playerYawRef.current += yawBias;
      const moveLength = Math.hypot(moveX, moveY);
      const nx = moveLength > 0.05 ? moveX / moveLength : 0;
      const ny = moveLength > 0.05 ? moveY / moveLength : 0;
      const forward = new THREE.Vector3(Math.sin(playerYawRef.current), 0, Math.cos(playerYawRef.current));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const desired = new THREE.Vector3();
      desired.addScaledVector(forward, -ny * walkSpeed);
      desired.addScaledVector(right, nx * walkSpeed);
      playerVelRef.current.x += (desired.x - playerVelRef.current.x) * Math.min(1, delta * 8.8);
      playerVelRef.current.z += (desired.z - playerVelRef.current.z) * Math.min(1, delta * 8.8);
      if (jumpPressed && playerPosRef.current.y <= 0.18 + 0.01 && modeRef.current !== 'interior') playerJumpVelRef.current = 5.2;
      playerJumpVelRef.current -= (modeRef.current === 'interior' ? 11.5 : 14.5) * delta;
      playerPosRef.current.addScaledVector(playerVelRef.current, delta);
      const bounds = modeRef.current === 'interior'
        ? { minX: (interiorSpawnMap[interiorRef.current || 'marina'].x - 8), maxX: (interiorSpawnMap[interiorRef.current || 'marina'].x + 8), minZ: (interiorSpawnMap[interiorRef.current || 'marina'].z - 6), maxZ: (interiorSpawnMap[interiorRef.current || 'marina'].z + 6) }
        : playBounds;
      playerPosRef.current.x = THREE.MathUtils.clamp(playerPosRef.current.x, bounds.minX, bounds.maxX);
      playerPosRef.current.z = THREE.MathUtils.clamp(playerPosRef.current.z, bounds.minZ, bounds.maxZ);
      playerPosRef.current.y = Math.max(modeRef.current === 'interior' ? 0.12 : 0.18, playerPosRef.current.y + playerJumpVelRef.current * delta);
      if (playerPosRef.current.y <= 0.18) playerJumpVelRef.current = Math.max(0, playerJumpVelRef.current);
      if (playerRef.current) {
        playerRef.current.position.copy(playerPosRef.current);
        playerRef.current.rotation.y = playerYawRef.current;
      }
      const desiredCam = new THREE.Vector3(
        playerPosRef.current.x - Math.sin(playerYawRef.current) * 7.5,
        playerPosRef.current.y + 4.6,
        playerPosRef.current.z - Math.cos(playerYawRef.current) * 7.5,
      );
      cam.position.lerp(desiredCam, 0.08);
      ctrl.target.lerp(new THREE.Vector3(playerPosRef.current.x, playerPosRef.current.y + 1.4, playerPosRef.current.z), 0.12);
    } else {
      const activeVehicle = vehicleStateRef.current[modeRef.current === 'boat' ? 'boat' : modeRef.current];
      const turnInput = (gp ? gp.lx : 0) + (inputRef.current.right ? 1 : 0) - (inputRef.current.left ? 1 : 0);
      const accelInput = (gp ? -gp.ly : 0) + (inputRef.current.up ? 1 : 0) - (inputRef.current.down ? 1 : 0);
      const boost = sprintHeld ? 1.15 : 1;
      const maxSpeed = modeRef.current === 'boat' ? 0.46 * boost : modeRef.current === 'train' ? 0.38 * boost : modeRef.current === 'carrier' ? 0.52 * boost : 0.58 * boost;
      const turnSpeed = modeRef.current === 'boat' ? 0.038 : modeRef.current === 'train' ? 0.02 : modeRef.current === 'carrier' ? 0.03 : 0.05;
      activeVehicle.yaw += turnInput * turnSpeed * (1 + Math.abs(accelInput) * 0.5);
      const forward = new THREE.Vector3(Math.sin(activeVehicle.yaw), 0, Math.cos(activeVehicle.yaw));
      const targetSpeed = accelInput * maxSpeed;
      activeVehicle.vel.x += (forward.x * targetSpeed - activeVehicle.vel.x) * Math.min(1, delta * 5.5);
      activeVehicle.vel.z += (forward.z * targetSpeed - activeVehicle.vel.z) * Math.min(1, delta * 5.5);
      activeVehicle.pos.addScaledVector(activeVehicle.vel, delta * 8.5);
      const vehicleBounds = modeRef.current === 'train'
        ? { minX: -40, maxX: 90, minZ: -38.5, maxZ: -34.2 }
        : modeRef.current === 'carrier'
          ? { minX: -170, maxX: 160, minZ: 92, maxZ: 266 }
          : modeRef.current === 'yacht'
            ? { minX: -72, maxX: 44, minZ: -18, maxZ: 56 }
            : { minX: playBounds.minX + 6, maxX: playBounds.maxX - 6, minZ: playBounds.minZ + 6, maxZ: playBounds.maxZ - 6 };
      activeVehicle.pos.x = THREE.MathUtils.clamp(activeVehicle.pos.x, vehicleBounds.minX, vehicleBounds.maxX);
      activeVehicle.pos.z = THREE.MathUtils.clamp(activeVehicle.pos.z, vehicleBounds.minZ, vehicleBounds.maxZ);
      activeVehicle.vel.multiplyScalar(modeRef.current === 'boat' ? 0.992 : modeRef.current === 'train' ? 0.993 : 0.985);
      if (modeRef.current === 'boat') {
        activeVehicle.pos.y = 0.08 + Math.sin(performance.now() * 0.0015 + activeVehicle.pos.x * 0.02) * 0.04;
      } else if (modeRef.current === 'train') {
        activeVehicle.pos.y = -1.35;
      } else if (modeRef.current === 'carrier') {
        activeVehicle.pos.y = 2.4;
      } else if (modeRef.current === 'yacht') {
        activeVehicle.pos.y = 0.18;
      } else {
        activeVehicle.pos.y = 0.18;
      }
      const vehicleMesh = modeRef.current === 'boat' ? boatRef.current : modeRef.current === 'car' ? carRef.current : null;
      if (vehicleMesh) {
        vehicleMesh.position.copy(activeVehicle.pos);
        vehicleMesh.rotation.y = activeVehicle.yaw;
        vehicleMesh.rotation.z = modeRef.current === 'boat' ? Math.sin(performance.now() * 0.002 + activeVehicle.pos.x * 0.03) * 0.02 : 0;
      }
      if (playerRef.current) {
        playerRef.current.position.set(activeVehicle.pos.x + Math.sin(activeVehicle.yaw + Math.PI * 0.5) * 1.25, activeVehicle.pos.y + 0.1, activeVehicle.pos.z + Math.cos(activeVehicle.yaw + Math.PI * 0.5) * 1.25);
        playerRef.current.rotation.y = activeVehicle.yaw;
        playerRef.current.visible = false;
      }
      const camOffset = modeRef.current === 'boat'
        ? new THREE.Vector3(-Math.sin(activeVehicle.yaw) * 10, 5.2, -Math.cos(activeVehicle.yaw) * 10)
        : modeRef.current === 'train'
          ? new THREE.Vector3(-Math.sin(activeVehicle.yaw) * 12, 6.4, -Math.cos(activeVehicle.yaw) * 12)
          : modeRef.current === 'carrier'
            ? new THREE.Vector3(-Math.sin(activeVehicle.yaw) * 24, 14.5, -Math.cos(activeVehicle.yaw) * 24)
            : modeRef.current === 'yacht'
              ? new THREE.Vector3(-Math.sin(activeVehicle.yaw) * 13, 6.8, -Math.cos(activeVehicle.yaw) * 13)
              : new THREE.Vector3(-Math.sin(activeVehicle.yaw) * 8.2, 4.3, -Math.cos(activeVehicle.yaw) * 8.2);
      const desiredCam = activeVehicle.pos.clone().add(camOffset);
      cam.position.lerp(desiredCam, 0.08);
      ctrl.target.lerp(activeVehicle.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0.12);
      if (!interactPressed && !jumpPressed) {
        inputRef.current.interact = false;
      }
    }

    if (playerRef.current) playerRef.current.visible = modeRef.current === 'walk' || modeRef.current === 'interior';
    if (Math.abs(mouseRef.current.dx) > 0.1) mouseRef.current.dx *= 0.8;
    if (Math.abs(mouseRef.current.dy) > 0.1) mouseRef.current.dy *= 0.8;

    window.__hubPlayerPos = { x: playerPosRef.current.x, y: playerPosRef.current.y, z: playerPosRef.current.z };
    window.__hubGameplayMode = modeRef.current;
  });

  return (
    <>
      {createPortal(
        interactionPrompt ? (
          <div className="pointer-events-none fixed left-1/2 top-5 z-20 -translate-x-1/2 rounded-2xl border border-cyan-200/30 bg-slate-950/70 px-4 py-3 text-white shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 18px 48px rgba(8, 145, 178, 0.24)' }}>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-cyan-200/40 bg-cyan-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100">{interactionPrompt.badge}</span>
              <div>
                <div className="text-xs font-semibold text-white">{interactionPrompt.title}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/75">{interactionPrompt.action} - {interactionPrompt.detail}</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-200/80">{interactionPrompt.distance.toFixed(1)} m - E / X pour agir</div>
          </div>
        ) : null,
        document.body,
      )}
      <group>
      <group ref={playerRef} position={[playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z]} visible>
          <HubPlayerAvatar />
      </group>

      <group ref={carRef} position={[24, 0.18, -22]} visible>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[1.9, 0.52, 3.6]} />
          <meshStandardMaterial color="#ff4b5c" roughness={0.2} metalness={0.5} envMapIntensity={1.1} />
        </mesh>
        <mesh position={[0, 0.88, -0.14]}>
          <boxGeometry args={[1.5, 0.58, 1.7]} />
          <meshStandardMaterial color="#08111c" roughness={0.08} metalness={0.16} transparent opacity={0.82} />
        </mesh>
        <mesh position={[0, 0.62, 1.14]}>
          <boxGeometry args={[1.18, 0.08, 0.08]} />
          <meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={0.38} />
        </mesh>
        <mesh position={[-0.88, 0.12, 1.1]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color="#10161d" /></mesh>
        <mesh position={[0.88, 0.12, 1.1]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color="#10161d" /></mesh>
        <mesh position={[-0.88, 0.12, -1.1]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color="#10161d" /></mesh>
        <mesh position={[0.88, 0.12, -1.1]}><cylinderGeometry args={[0.18, 0.18, 0.12, 10]} /><meshStandardMaterial color="#10161d" /></mesh>
      </group>

      <group ref={boatRef} position={[6, 0.05, -12]} visible>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.6, 0.3, 4.4]} />
          <meshStandardMaterial color="#1a5fa8" roughness={0.2} metalness={0.44} envMapIntensity={1.05} />
        </mesh>
        <mesh position={[0, 0.46, -0.1]}>
          <boxGeometry args={[1.22, 0.42, 1.4]} />
          <meshStandardMaterial color="#f4f7fa" roughness={0.12} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.88, -0.42]}>
          <cylinderGeometry args={[0.06, 0.08, 1.5, 8]} />
          <meshStandardMaterial color="#dfe8f0" metalness={0.7} roughness={0.12} />
        </mesh>
        <mesh position={[0, 0.62, 1.4]}>
          <boxGeometry args={[0.78, 0.08, 0.6]} />
          <meshStandardMaterial color="#f6fbff" emissive="#7ce7ff" emissiveIntensity={0.25} />
        </mesh>
        <Text position={[0, 1.0, 1.42]} fontSize={0.16} color="#e8f8ff" anchorX="center">Pont</Text>
        <mesh position={[0.55, 0.38, 0.15]}>
          <boxGeometry args={[0.08, 0.18, 0.42]} />
          <meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={0.38} />
        </mesh>
      </group>

      <group position={[interiorSpawnMap.marina.x, 0, interiorSpawnMap.marina.z]}>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[16, 0.12, 14]} /><meshStandardMaterial color="#f5f8fb" roughness={0.24} metalness={0.14} /></mesh>
        <mesh position={[0, 3.4, 0]}><boxGeometry args={[16, 0.12, 14]} /><meshStandardMaterial color="#dce5ed" roughness={0.28} metalness={0.12} transparent opacity={0.92} /></mesh>
        <mesh position={[0, 1.7, -6.9]}><boxGeometry args={[16, 3.4, 0.12]} /><meshStandardMaterial color="#e9eff5" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.7, 6.9]}><boxGeometry args={[16, 3.4, 0.12]} /><meshStandardMaterial color="#e9eff5" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[-7.9, 1.7, 0]}><boxGeometry args={[0.12, 3.4, 14]} /><meshStandardMaterial color="#e9eff5" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[7.9, 1.7, 0]}><boxGeometry args={[0.12, 3.4, 14]} /><meshStandardMaterial color="#e9eff5" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.0, 0]}><boxGeometry args={[4.8, 1.1, 1.2]} /><meshStandardMaterial color="#17324f" emissive="#7ce7ff" emissiveIntensity={0.4} /></mesh>
        <Text position={[0, 2.45, 0]} fontSize={0.56} color="#17324f" anchorX="center" fontWeight="bold">MARINA LAND LOBBY</Text>
        <mesh position={[0, 0.82, -4.8]}><boxGeometry args={[2.8, 1.6, 0.08]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={0.5} transparent opacity={0.7} /></mesh>
        <Text position={[0, 0.9, -4.68]} fontSize={0.26} color="#ffffff" anchorX="center" fontWeight="bold">E SORTIR</Text>
      </group>

      <group position={[interiorSpawnMap.station.x, 0, interiorSpawnMap.station.z]}>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[18, 0.12, 12]} /><meshStandardMaterial color="#f1f4f8" roughness={0.22} metalness={0.12} /></mesh>
        <mesh position={[0, 3.0, 0]}><boxGeometry args={[18, 0.12, 12]} /><meshStandardMaterial color="#d5dce4" roughness={0.26} metalness={0.12} transparent opacity={0.92} /></mesh>
        <mesh position={[0, 1.5, -5.9]}><boxGeometry args={[18, 3, 0.12]} /><meshStandardMaterial color="#e3e8ee" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.5, 5.9]}><boxGeometry args={[18, 3, 0.12]} /><meshStandardMaterial color="#e3e8ee" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[-8.9, 1.5, 0]}><boxGeometry args={[0.12, 3, 12]} /><meshStandardMaterial color="#e3e8ee" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[8.9, 1.5, 0]}><boxGeometry args={[0.12, 3, 12]} /><meshStandardMaterial color="#e3e8ee" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.05, 0]}><boxGeometry args={[5.4, 1.05, 1]} /><meshStandardMaterial color="#0f2746" emissive="#00CCFF" emissiveIntensity={0.45} /></mesh>
        <Text position={[0, 2.2, 0]} fontSize={0.52} color="#0f2746" anchorX="center" fontWeight="bold">GARE INTÉRIEURE</Text>
        <mesh position={[0, 0.82, -4.1]}><boxGeometry args={[3.4, 1.4, 0.08]} /><meshStandardMaterial color="#00CCFF" emissive="#00CCFF" emissiveIntensity={0.6} transparent opacity={0.72} /></mesh>
        <Text position={[0, 0.9, -3.98]} fontSize={0.26} color="#ffffff" anchorX="center" fontWeight="bold">E SORTIR</Text>
      </group>

      <group position={[interiorSpawnMap.mall.x, 0, interiorSpawnMap.mall.z]}>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[20, 0.12, 14]} /><meshStandardMaterial color="#f4f6fb" roughness={0.22} metalness={0.12} /></mesh>
        <mesh position={[0, 3.2, 0]}><boxGeometry args={[20, 0.12, 14]} /><meshStandardMaterial color="#dbe2eb" roughness={0.26} metalness={0.12} transparent opacity={0.92} /></mesh>
        <mesh position={[0, 1.6, -6.9]}><boxGeometry args={[20, 3.2, 0.12]} /><meshStandardMaterial color="#e9edf2" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.6, 6.9]}><boxGeometry args={[20, 3.2, 0.12]} /><meshStandardMaterial color="#e9edf2" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[-9.9, 1.6, 0]}><boxGeometry args={[0.12, 3.2, 14]} /><meshStandardMaterial color="#e9edf2" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[9.9, 1.6, 0]}><boxGeometry args={[0.12, 3.2, 14]} /><meshStandardMaterial color="#e9edf2" roughness={0.2} metalness={0.12} /></mesh>
        <mesh position={[0, 1.0, 0]}><boxGeometry args={[5.8, 1.0, 1.2]} /><meshStandardMaterial color="#17324f" emissive="#ff7eb6" emissiveIntensity={0.45} /></mesh>
        <Text position={[0, 2.35, 0]} fontSize={0.56} color="#17324f" anchorX="center" fontWeight="bold">MALL SKY ATRIUM</Text>
        <mesh position={[0, 0.82, -4.8]}><boxGeometry args={[3.1, 1.4, 0.08]} /><meshStandardMaterial color="#ff7eb6" emissive="#ff7eb6" emissiveIntensity={0.6} transparent opacity={0.72} /></mesh>
        <Text position={[0, 0.9, -4.68]} fontSize={0.26} color="#ffffff" anchorX="center" fontWeight="bold">E SORTIR</Text>
      </group>
      </group>
    </>
  );
}

function HubPlayerAvatar({}) {
  return (
    <group>
      <mesh position={[0, 0.98, 0]}>
        <capsuleGeometry args={[0.16, 0.46, 6, 12]} />
        <meshStandardMaterial color="#f5fbff" roughness={0.52} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <capsuleGeometry args={[0.15, 0.38, 6, 10]} />
        <meshStandardMaterial color="#1a5fa8" roughness={0.3} metalness={0.22} emissive="#0b1320" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 1.58, 0.03]}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#e9b38d" roughness={0.72} metalness={0.03} />
      </mesh>
      <mesh position={[0, 1.71, 0.17]}>
        <sphereGeometry args={[0.042, 8, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.06, 1.71, 0.17]}>
        <sphereGeometry args={[0.042, 8, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[-0.12, 0.6, 0]} rotation={[0, 0, 0.24]}>
        <capsuleGeometry args={[0.036, 0.36, 6, 10]} />
        <meshStandardMaterial color="#f2c8a0" roughness={0.56} />
      </mesh>
      <mesh position={[0.12, 0.6, 0]} rotation={[0, 0, -0.24]}>
        <capsuleGeometry args={[0.036, 0.36, 6, 10]} />
        <meshStandardMaterial color="#f2c8a0" roughness={0.56} />
      </mesh>
      <mesh position={[-0.1, 0.03, 0.02]}>
        <capsuleGeometry args={[0.05, 0.4, 6, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.62} metalness={0.06} />
      </mesh>
      <mesh position={[0.1, 0.03, 0.02]}>
        <capsuleGeometry args={[0.05, 0.4, 6, 12]} />
        <meshStandardMaterial color="#111827" roughness={0.62} metalness={0.06} />
      </mesh>
      <mesh position={[-0.1, -0.22, 0.03]}>
        <boxGeometry args={[0.14, 0.08, 0.22]} />
        <meshStandardMaterial color="#202938" roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh position={[0.1, -0.22, 0.03]}>
        <boxGeometry args={[0.14, 0.08, 0.22]} />
        <meshStandardMaterial color="#202938" roughness={0.4} metalness={0.08} />
      </mesh>
    </group>
  );
}

function HubEventScenery({ tod, scenario = 'premium', season = 'summer' }) {
  const night = tod < 0.18 || tod > 0.82;
  const portLightRefs = useRef([]);
  const runwayLightRefs = useRef([]);
  const fireworkRefs = useRef([]);

  const palette = useMemo(() => ({
    summer: { main: '#7ce7ff', glow: '#fff1bf', accent: '#ff7eb6', ground: '#00c8ff' },
    spring: { main: '#8ef0a7', glow: '#ffe0f3', accent: '#ff9ecb', ground: '#9ee7c5' },
    winter: { main: '#cfe8ff', glow: '#fffaf0', accent: '#8fd9ff', ground: '#d7e9f7' },
    national: { main: '#ff4b5c', glow: '#ffd166', accent: '#2f80ed', ground: '#ffffff' },
  }), []);
  const tone = palette[season] || palette.summer;
  const premiumMode = scenario === 'premium';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    portLightRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.position.y = 5.1 + Math.sin(t * 1.8 + index) * 0.18;
      ref.intensity = night ? 0.24 + Math.max(0, Math.sin(t * 2.2 + index)) * 0.26 : 0.12;
    });
    runwayLightRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = t * 0.28 + index * 0.12;
      ref.position.y = 4.4 + Math.sin(t * 0.9 + index) * 0.05;
    });
    fireworkRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const burst = 0.55 + Math.max(0, Math.sin(t * 1.35 + index * 1.7));
      ref.scale.setScalar(burst);
      ref.position.y = 18 + index * 2.2 + Math.sin(t * 1.1 + index) * 0.9;
      ref.rotation.y = t * 0.35 + index * 0.8;
    });
  });

  const showFestival = premiumMode || scenario === 'festival' || scenario === 'concert' || scenario === 'parade';
  const showMarket = premiumMode || scenario === 'market';
  const showFashion = premiumMode || scenario === 'fashion';
  const showSports = premiumMode || scenario === 'sports';
  const showFireworks = premiumMode || scenario === 'fireworks' || season === 'national';

  return (
    <group>
      {showFestival && (
        <group position={[34, 0.15, 24]}>
          {[-10, -4, 2, 8, 14].map((x, i) => (
            <group key={`festival-pole-${i}`} position={[x, 0, 0]}>
              <mesh position={[0, 2.8, 0]}><cylinderGeometry args={[0.09, 0.11, 5.6, 8]} /><meshStandardMaterial color="#5f7287" metalness={0.7} roughness={0.16} /></mesh>
              <pointLight ref={(el) => { portLightRefs.current[i] = el; }} position={[0, 5.2, 0]} color={tone.glow} intensity={night ? 0.22 : 0.08} distance={9.5} />
              <mesh position={[0, 5.2, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color={tone.glow} emissive={tone.glow} emissiveIntensity={night ? 2.2 : 0.25} /></mesh>
            </group>
          ))}
          <mesh position={[1.5, 1.55, 0]}><boxGeometry args={[16, 0.35, 7]} /><meshStandardMaterial color="#101826" roughness={0.6} metalness={0.18} /></mesh>
          <mesh position={[1.5, 2.3, 0]}><boxGeometry args={[12, 0.25, 4.6]} /><meshStandardMaterial color="#17263a" roughness={0.45} metalness={0.16} /></mesh>
          <mesh position={[1.5, 3.8, -0.4]}><boxGeometry args={[5.2, 2.4, 0.28]} /><meshStandardMaterial color="#0d1624" roughness={0.5} metalness={0.18} /></mesh>
          <mesh position={[1.5, 3.78, -0.28]}><boxGeometry args={[4.8, 2.0, 0.08]} /><meshStandardMaterial color={tone.main} emissive={tone.main} emissiveIntensity={night ? 0.8 : 0.08} /></mesh>
          <Text position={[1.5, 5.7, 0]} fontSize={0.82} color={tone.glow} anchorX="center">PORT LIGHT FEST</Text>
          <group position={[1.5, 0.34, 2.6]}>
            {[[-5.4, 0], [-2.4, 0], [0.2, 0], [2.8, 0], [5.3, 0]].map(([x, z], idx) => (
              <group key={`festival-crowd-${idx}`} position={[x, 0, z]}>
                <mesh position={[0, 0.45, 0]}><capsuleGeometry args={[0.12, 0.46, 4, 8]} /><meshStandardMaterial color={idx % 2 === 0 ? '#2a3441' : '#4d2f3e'} roughness={0.78} /></mesh>
                <mesh position={[0, 1.0, 0]}><sphereGeometry args={[0.15, 10, 10]} /><meshStandardMaterial color={idx % 2 === 0 ? '#d8a37e' : '#b97b61'} roughness={0.9} /></mesh>
              </group>
            ))}
          </group>
        </group>
      )}

      {showMarket && (
        <group position={[-16, 0.08, 146]}>
          {[-10, -4, 2, 8].map((x, i) => (
            <group key={`market-stall-${i}`} position={[x, 0, 0]}>
              <mesh position={[0, 1.1, 0]}><boxGeometry args={[2.8, 1.4, 2.1]} /><meshStandardMaterial color={i % 2 === 0 ? '#f7f2df' : '#f6e1c1'} roughness={0.82} metalness={0.08} /></mesh>
              <mesh position={[0, 2.1, 0]}><coneGeometry args={[1.8, 1.0, 4]} /><meshStandardMaterial color={i % 2 === 0 ? tone.accent : tone.main} emissive={i % 2 === 0 ? tone.accent : tone.main} emissiveIntensity={night ? 0.8 : 0.08} /></mesh>
              <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.6, 0.24, 1.8]} /><meshStandardMaterial color="#2f3948" roughness={0.58} metalness={0.14} /></mesh>
              <Text position={[0, 2.72, 0]} fontSize={0.34} color="#ffffff" anchorX="center">{i % 2 === 0 ? 'MARCHÉ' : 'ART'}</Text>
              <pointLight position={[0, 2.2, 0.9]} color={tone.glow} intensity={night ? 0.18 : 0.06} distance={5.5} />
            </group>
          ))}
          <Text position={[0.4, 4.5, 0]} fontSize={0.72} color={tone.glow} anchorX="center">MARCHÉ NOCTURNE</Text>
          {season === 'spring' && (
            <group position={[0, 0.1, 4.8]}>
              {[-5, -2, 1, 4].map((x, i) => (
                <mesh key={`market-flower-${i}`} position={[x, 0.2, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color={i % 2 === 0 ? '#ff9ecb' : '#8ef0a7'} emissive={i % 2 === 0 ? '#ff9ecb' : '#8ef0a7'} emissiveIntensity={0.35} /></mesh>
              ))}
            </group>
          )}
        </group>
      )}

      {showFashion && (
        <group position={[4, 0.12, -36]}>
          <mesh position={[0, 0.2, 0]}><boxGeometry args={[26, 0.22, 3.4]} /><meshStandardMaterial color="#0b1320" roughness={0.38} metalness={0.22} /></mesh>
          <mesh position={[0, 0.33, 0]}><boxGeometry args={[25.6, 0.04, 0.28]} /><meshStandardMaterial color={tone.main} emissive={tone.main} emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          <mesh position={[0, 0.33, 1.46]}><boxGeometry args={[25.6, 0.04, 0.28]} /><meshStandardMaterial color={tone.glow} emissive={tone.glow} emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          {[-11.5, -7.6, -3.8, 0, 3.8, 7.6, 11.5].map((x, i) => (
            <group key={`runway-seat-${i}`} position={[x, 0, 4.4]}>
              <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.0, 0.84, 1.8]} /><meshStandardMaterial color={i % 2 === 0 ? '#162030' : '#1f3142'} roughness={0.72} metalness={0.1} /></mesh>
              <mesh position={[0, 1.18, 0]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color={tone.glow} emissive={tone.glow} emissiveIntensity={night ? 1.2 : 0.12} /></mesh>
            </group>
          ))}
          {[-9, 9].map((x, i) => (
            <group key={`runway-light-${i}`} position={[x, 0, -2.4]}>
              <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.06, 0.08, 4.8, 8]} /><meshStandardMaterial color="#d8dfea" metalness={0.72} roughness={0.12} /></mesh>
              <spotLight ref={(el) => { runwayLightRefs.current[i] = el; }} position={[0, 4.4, 0]} angle={0.38} penumbra={0.5} intensity={night ? 0.9 : 0.22} color={tone.main} distance={18} />
            </group>
          ))}
          <Text position={[0, 3.9, 0]} fontSize={0.58} color={tone.glow} anchorX="center">DÉFILÉ PREMIUM</Text>
        </group>
      )}

      {showSports && (
        <group position={[-30, 0.1, -56]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><ringGeometry args={[8, 13, 32]} /><meshStandardMaterial color="#19354a" roughness={0.65} metalness={0.08} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}><ringGeometry args={[10.1, 12.9, 32]} /><meshStandardMaterial color={tone.main} emissive={tone.main} emissiveIntensity={night ? 0.55 : 0.08} /></mesh>
          <Text position={[0, 0.7, 0]} fontSize={0.5} color={tone.glow} anchorX="center">PARC SPORTIF</Text>
          {[-5, 0, 5].map((x, i) => (
            <mesh key={`sport-beam-${i}`} position={[x, 4.1, 7.2]}><boxGeometry args={[0.14, 7.2, 0.14]} /><meshStandardMaterial color="#dfe8f0" metalness={0.62} roughness={0.12} /></mesh>
          ))}
        </group>
      )}

      {showFireworks && (
        <group position={[16, 0, -6]}>
          {[
            { x: -2, z: 0, c: tone.main },
            { x: 2, z: -2, c: tone.glow },
            { x: 6, z: 1, c: tone.accent },
            { x: 10, z: -1, c: tone.ground },
          ].map((firework, index) => (
            <group key={`firework-${index}`} ref={(el) => { fireworkRefs.current[index] = el; }} position={[firework.x, 18 + index * 2.2, firework.z]}>
              {Array.from({ length: 8 }).map((_, ray) => {
                const angle = (ray / 8) * Math.PI * 2;
                return <mesh key={`firework-ray-${ray}`} position={[Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6]}><boxGeometry args={[0.08, 2.7, 0.08]} /><meshStandardMaterial color={firework.c} emissive={firework.c} emissiveIntensity={night ? 2.2 : 0.28} transparent opacity={0.92} /></mesh>;
              })}
              <mesh><sphereGeometry args={[0.22, 10, 10]} /><meshStandardMaterial color={firework.c} emissive={firework.c} emissiveIntensity={night ? 3.2 : 0.38} /></mesh>
            </group>
          ))}
          <Text position={[2, 24.5, 0]} fontSize={0.72} color={tone.glow} anchorX="center">FEUX D'ARTIFICE</Text>
        </group>
      )}

      {(season === 'winter' || premiumMode) && (
        <group position={[22, 0, 26]}>
          <mesh position={[0, 0.6, 0]}><coneGeometry args={[1.0, 2.4, 8]} /><meshStandardMaterial color="#17314a" emissive="#17314a" emissiveIntensity={0.12} /></mesh>
          <mesh position={[0, 1.85, 0]}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#fffaf0" emissive="#fffaf0" emissiveIntensity={1.6} /></mesh>
          <Text position={[0, 3.1, 0]} fontSize={0.38} color="#fffaf0" anchorX="center">FIN D'ANNÉE</Text>
        </group>
      )}

      {(season === 'spring' || premiumMode) && (
        <group position={[-8, 0, -10]}>
          {[-3.5, -1.2, 1.2, 3.5].map((x, i) => (
            <mesh key={`spring-bloom-${i}`} position={[x, 0.7, 0]}><sphereGeometry args={[0.26, 8, 8]} /><meshStandardMaterial color={i % 2 === 0 ? '#ff9ecb' : '#8ef0a7'} emissive={i % 2 === 0 ? '#ff9ecb' : '#8ef0a7'} emissiveIntensity={0.28} /></mesh>
          ))}
        </group>
      )}

      {(season === 'national' || premiumMode) && (
        <group position={[0, 0, -20]}>
          {[-6, -2, 2, 6].map((x, i) => (
            <mesh key={`flag-${i}`} position={[x, 1.4, 0]}><boxGeometry args={[0.08, 2.8, 1.2]} /><meshStandardMaterial color={i % 2 === 0 ? tone.main : tone.main === '#ff4b5c' ? tone.accent : '#ff4b5c'} emissive={tone.main} emissiveIntensity={0.22} /></mesh>
          ))}
        </group>
      )}
    </group>
  );
}
  const gulls = useMemo(() => [...Array(18)].map(() => ({
    cx: (Math.random() - 0.5) * 80, cy: 5 + Math.random() * 15, cz: (Math.random() - 0.5) * 60,
    sp: 0.2 + Math.random() * 0.6, r: 10 + Math.random() * 25, ws: 5 + Math.random() * 5,
    glide: Math.random() > 0.6, // Some birds glide instead of flapping
    dive: Math.random() > 0.85, // Some birds dive for fish
    divePhase: Math.random() * Math.PI * 2
  })), []);

  useFrame(({ clock }) => {
    if (!ref.current || !isDay) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((g, i) => {
      const b = gulls[i];
      
      // Circular flight path with variation
      let baseX = b.cx + Math.sin(t * b.sp) * b.r;
      let baseZ = b.cz + Math.cos(t * b.sp) * b.r * 0.7;
      let baseY = b.cy + Math.sin(t * 2 + i) * 1.2;
      
      // Diving behavior
      if (b.dive) {
        const diveT = (t * 0.3 + b.divePhase) % (Math.PI * 2);
        if (diveT < Math.PI * 0.5) {
          baseY -= Math.sin(diveT * 2) * 8; // Dive down
        }
      }
      
      g.position.x = baseX;
      g.position.z = baseZ;
      g.position.y = baseY;
      
      // Face direction of movement
      g.rotation.y = Math.atan2(Math.cos(t * b.sp) * b.r, -Math.sin(t * b.sp) * b.r * 0.7);
      
      // Banking on turns
      g.rotation.z = Math.cos(t * b.sp) * 0.15;
      
      // Wing flap - gliding birds flap less
      const flapIntensity = b.glide ? 0.15 : 0.5;
      const flapSpeed = b.glide ? b.ws * 0.3 : b.ws;
      if (g.children[1]) g.children[1].rotation.z = Math.sin(t * flapSpeed) * flapIntensity;
      if (g.children[2]) g.children[2].rotation.z = -Math.sin(t * flapSpeed) * flapIntensity;
      
      // Tail feathers move slightly
      if (g.children[3]) g.children[3].rotation.x = Math.sin(t * 3 + i) * 0.1;
    });
  });

  if (!isDay) return null;
  return (
    <group ref={ref}>
      {gulls.map((gull, i) => (
        <group key={i} position={[gull.cx, gull.cy, gull.cz]}>
          {/* Body - more streamlined */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
            <meshStandardMaterial color="#f8f8f5" />
          </mesh>
          {/* Wing L - larger, more detailed */}
          <mesh position={[0.18, 0.02, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.35, 0.012, 0.14]} />
            <meshStandardMaterial color="#e8e8e0" />
          </mesh>
          {/* Wing R */}
          <mesh position={[-0.18, 0.02, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.35, 0.012, 0.14]} />
            <meshStandardMaterial color="#e8e8e0" />
          </mesh>
          {/* Tail feathers */}
          <mesh position={[0, 0, 0.15]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.1, 0.008, 0.1]} />
            <meshStandardMaterial color="#e0e0d8" />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.02, -0.18]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#f8f8f5" />
          </mesh>
          {/* Beak */}
          <mesh position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.015, 0.06, 4]} />
            <meshStandardMaterial color="#FFB347" />
          </mesh>
          {/* Eye dots */}
          <mesh position={[0.025, 0.03, -0.17]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-0.025, 0.03, -0.17]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── JET SKIS RACING (simplifié - 2 jet-skis) ────────────────
function JetSkis({ tod }) {
  const ref = useRef();
  const night = tod < 0.18 || tod > 0.82;
  
  // 4 jet skis + vedettes — plus gros, trajectoires longues
  const jetskis = useMemo(() => [
    { id: 1, color: '#FF0040', accent: '#FF69B4', radius: 28, speed: 0.22, offset: 0, startX: 30, startZ: 28, scale: 1.6 },
    { id: 2, color: '#00FFFF', accent: '#00CED1', radius: 32, speed: 0.18, offset: Math.PI, startX: -10, startZ: 22, scale: 1.4 },
    { id: 3, color: '#FFD700', accent: '#FFA500', radius: 24, speed: 0.25, offset: Math.PI / 2, startX: 50, startZ: 36, scale: 1.8 },
    { id: 4, color: '#1abc9c', accent: '#16a085', radius: 30, speed: 0.2, offset: Math.PI * 1.5, startX: 70, startZ: 18, scale: 1.5 },
  ], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    
    ref.current.children.forEach((jetskiGroup, i) => {
      if (i >= jetskis.length) return;
      const js = jetskis[i];
      
      // Racing oval path - contenu dans la voie d'eau devant le ferry
      const angle = t * js.speed + js.offset;
      const candidate = new THREE.Vector3(
        js.startX + Math.sin(angle) * js.radius,
        0,
        js.startZ + Math.cos(angle) * js.radius * 0.45
      );
      const adjusted = offsetSeaVehiclePosition(candidate, i === 0 ? 1 : -1);
      adjusted.x = THREE.MathUtils.clamp(adjusted.x, SEA_LANE_BOUNDS.minX + 10, SEA_LANE_BOUNDS.maxX - 10);
      adjusted.z = THREE.MathUtils.clamp(adjusted.z, SEA_LANE_BOUNDS.minZ + 10, SEA_LANE_BOUNDS.maxZ - 8);
      const x = adjusted.x;
      const z = adjusted.z;
      
      // Bouncing on waves
      const waveHeight = Math.sin(x * 0.15 + t * 0.8) * 0.25 + Math.sin(z * 0.2 + t * 0.6) * 0.15;
      
      // Évitement gros navires — virage latéral (pas de recul)
      let fx = x, fz = z;
      const avoidShipLateral = (shipPos, minDist) => {
        if (!shipPos) return;
        const dx = fx - shipPos.x, dz = fz - shipPos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist && d > 0.1) {
          const nextA2 = angle + 0.1;
          const dirX = Math.sin(nextA2) - Math.sin(angle);
          const dirZ = Math.cos(nextA2) - Math.cos(angle);
          const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
          const perpX = -dirZ / len, perpZ = dirX / len;
          const side = (perpX * dx + perpZ * dz) > 0 ? 1 : -1;
          const strength = (1 - d / minDist) * 10;
          fx += perpX * side * strength;
          fz += perpZ * side * strength;
        }
      };
      avoidShipLateral(window.__carrierPos, 35);
      avoidShipLateral(window.__cargoPos, 30);

      jetskiGroup.position.x = fx;
      jetskiGroup.position.z = fz;
      jetskiGroup.position.y = -2.2 + waveHeight;
      jetskiGroup.scale.setScalar(js.scale || 1);
      
      // Face direction of movement
      const nextAngle = angle + 0.1;
      const nextCandidate = offsetSeaVehiclePosition(new THREE.Vector3(
        js.startX + Math.sin(nextAngle) * js.radius,
        0,
        js.startZ + Math.cos(nextAngle) * js.radius * 0.45
      ), i === 0 ? 1 : -1);
      const nextX = THREE.MathUtils.clamp(nextCandidate.x, SEA_LANE_BOUNDS.minX + 10, SEA_LANE_BOUNDS.maxX - 10);
      const nextZ = THREE.MathUtils.clamp(nextCandidate.z, SEA_LANE_BOUNDS.minZ + 10, SEA_LANE_BOUNDS.maxZ - 8);
      jetskiGroup.rotation.y = Math.atan2(nextX - x, nextZ - z);
      
      // Tilt based on turn
      jetskiGroup.rotation.z = Math.cos(angle) * 0.2;
      jetskiGroup.rotation.x = Math.sin(t * 3) * 0.06;
    });
  });

  return (
    <group ref={ref}>
      {/* Jet Skis - Version simplifiée */}
      {jetskis.map((js) => (
        <group key={js.id} position={[js.startX, -1.2, js.startZ]}>
          {/* Hull - sleek shape */}
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.25, 1.4]} />
            <meshStandardMaterial color={js.color} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Front nose - pointed */}
          <mesh position={[0, 0.05, -0.8]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.25, 0.5, 4]} />
            <meshStandardMaterial color={js.color} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Seat */}
          <mesh position={[0, 0.2, 0.1]}>
            <boxGeometry args={[0.35, 0.12, 0.7]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          {/* Handlebar */}
          <mesh position={[0, 0.35, -0.3]}>
            <boxGeometry args={[0.4, 0.04, 0.08]} />
            <meshStandardMaterial color="#333" metalness={0.9} />
          </mesh>
          {/* Rider */}
          <group position={[0, 0.5, 0.15]}>
            {/* Body */}
            <mesh position={[0, 0.15, 0]}>
              <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
              <meshStandardMaterial color={js.accent} />
            </mesh>
            {/* Head with helmet */}
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color={js.color} metalness={0.5} />
            </mesh>
          </group>
          {/* LED strip */}
          <mesh position={[0, 0.14, 0.7]}>
            <boxGeometry args={[0.45, 0.03, 0.03]} />
            <meshStandardMaterial color={js.color} emissive={js.color} emissiveIntensity={night ? 3 : 0.5} />
          </mesh>
          {/* Engine water spray - simplified */}
          <mesh position={[0, -0.05, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.12, 0.3, 6]} />
            <meshStandardMaterial color="white" transparent opacity={0.3} />
          </mesh>
          {/* Simple wake - une seule traînée */}
          <mesh position={[0, -0.3, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.8, 2.5]} />
            <meshStandardMaterial color="white" transparent opacity={0.1} side={THREE.DoubleSide} />
          </mesh>
          {/* Night lights */}
        </group>
      ))}
    </group>
  );
}

// ─── Coastal City v3 — Premium skyline with seawall protection ──────
function CoastalCity({ tod, isMobile = false, compactScene = false }) {
  const night = tod < 0.18 || tod > 0.82;
  const we = night ? 1.5 : 0.3; // Plus lumineux même de jour
  const ref = useRef();

  const buildings = useMemo(() => [], []);
  
  // Neon signs data - Désactivé
  const neonSigns = useMemo(() => [], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Animate neon sign glow
    ref.current.children.forEach((c, i) => {
      if (c.userData.neon) {
        c.material.emissiveIntensity = night ? (2.5 + Math.sin(t * 3 + i) * 1) : 0.8;
      }
    });
  });

  return (
    <group ref={ref}>
      {/* ═══ SEAWALL / DIGUE - SUPPRIMÉ pour libérer la navigation ═══ */}

      {/* Ground / shore - plage surélevée */}
      <mesh position={[-47, -1.5, -42]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 18]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.9} />
      </mesh>
      {night && [[-68, -37], [-58, -42], [-48, -46], [-38, -42], [-28, -37]].map(([x, z], i) => (
        <group key={`beach-flood-${i}`} position={[x, -1.38, z]}>
          <mesh position={[0, 0.22, 0]} rotation={[-0.6, 0, 0]}><boxGeometry args={[0.4, 0.18, 0.28]} /><meshStandardMaterial color="#f4f7fa" emissive="#fff2c1" emissiveIntensity={2.6} /></mesh>
          <pointLight position={[0, 0.6, 0.4]} color={i % 2 === 0 ? '#fff2c1' : '#ffd870'} intensity={0.68} distance={12} />
        </group>
      ))}

      {/* Nouvelle grande place surélevée + centre-ville importé depuis Train Station */}
      <FerryTrainCityPlaza night={night} isMobile={isMobile} compactScene={compactScene} position={[-48, -1.18, -62]} />

      {/* Buildings - Qualité premium */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, -2 + b.h / 2, b.z]}>
          {/* Corps du bâtiment */}
          <mesh>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial 
              color={b.c} 
              roughness={b.glass ? 0.15 : 0.55} 
              metalness={b.glass ? 0.8 : 0.2}
              envMapIntensity={b.glass ? 1.5 : 0.5}
            />
          </mesh>
          
          {/* Fenêtres - grille premium */}
          {[...Array(Math.floor(b.h / 1.0))].map((_, row) =>
            [...Array(Math.floor(b.w / 0.5))].map((_, col) => (
              <mesh key={`${row}-${col}`} position={[-b.w / 2 + 0.35 + col * 0.5, -b.h / 2 + 0.7 + row * 1.0, b.d / 2 + 0.01]}>
                <planeGeometry args={[0.3, 0.55]} />
                <meshStandardMaterial 
                  color={b.glass ? "#a8d8ff" : "#FFE8D0"} 
                  emissive={b.glass ? "#00AAFF" : "#FFD700"} 
                  emissiveIntensity={we * (Math.random() > 0.2 ? 1.2 : 0.3)} 
                  transparent 
                  opacity={b.glass ? 0.7 : 0.8}
                  metalness={b.glass ? 0.6 : 0.1}
                />
              </mesh>
            ))
          )}
          
          {/* Toit détaillé */}
          <mesh position={[0, b.h / 2 + 0.15, 0]}>
            <boxGeometry args={[b.w + 0.1, 0.3, b.d + 0.1]} />
            <meshStandardMaterial color="#404040" roughness={0.6} />
          </mesh>
          
          {/* Flèche/antenne pour les grands buildings */}
          {b.spire && (
            <group position={[0, b.h / 2 + 0.3, 0]}>
              <mesh position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.05, 0.15, 3, 8]} />
                <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0, 3.2, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={night ? 3 : 0.5} />
              </mesh>
            </group>
          )}
          
          {/* Équipements de toit pour grands bâtiments */}
          {b.h > 12 && !b.spire && (
            <group position={[0, b.h / 2 + 0.4, 0]}>
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[b.w * 0.4, 0.8, b.d * 0.4]} />
                <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
              </mesh>
            </group>
          )}
          {night && [-b.w * 0.3, b.w * 0.3].map((lx, li) => (
            <group key={`building-base-light-${li}`} position={[lx, -b.h / 2 + 0.22, b.d / 2 + 0.32]}>
              <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.28, 0.12, 0.18]} /><meshStandardMaterial color="#f7fafc" emissive="#fff2c1" emissiveIntensity={2.4} /></mesh>
              <pointLight position={[0, 0.3, 0.08]} color="#fff2c1" intensity={0.5} distance={7.2} />
            </group>
          ))}
        </group>
      ))}
      
      {/* Neon signs - Plus lumineux */}
      {neonSigns.map((sign, i) => (
        <group key={`neon-${i}`} position={[sign.x, sign.y, sign.z]}>
          <mesh userData={{ neon: true }}>
            <boxGeometry args={[sign.size[0], sign.size[1], 0.08]} />
            <meshStandardMaterial 
              color={sign.color} 
              emissive={sign.color} 
              emissiveIntensity={night ? 3.5 : 0.8}
            />
          </mesh>
        </group>
      ))}

      {/* ═══ AIRE DE JET SKI (ancien phare) ═══ */}
      <group position={[-70, -2, -28]}>
        {/* Plateforme béton de l'aire */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[16, 0.5, 12]} />
          <meshStandardMaterial color={night ? '#2a3040' : '#d8dce4'} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Marquages sol jet ski */}
        {[-4, 0, 4].map((x, i) => (
          <mesh key={`jmark-${i}`} position={[x, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 8]} />
            <meshStandardMaterial color={night ? '#1a3050' : '#a0c8e8'} roughness={0.3} metalness={0.1} />
          </mesh>
        ))}
        {/* Barrières de sécurité autour */}
        {[[-8, 0, 0, 16], [8, 0, 0, 16], [0, 0, -6, 12], [0, 0, 6, 12]].map(([bx, by, bz, blen], i) => (
          <group key={`jbar-${i}`} position={[bx, 0.55, bz]}>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[i < 2 ? 0.12 : blen, 0.8, i < 2 ? blen : 0.12]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#cc3333' : '#ffffff'} roughness={0.5} />
            </mesh>
          </group>
        ))}
        {/* Abris / cabane location */}
        <group position={[-5, 0.55, -4]}>
          <mesh position={[0, 1.2, 0]}><boxGeometry args={[3, 2.4, 2.5]} /><meshStandardMaterial color={night ? '#1a2030' : '#f0f4f8'} roughness={0.3} metalness={0.2} /></mesh>
          <mesh position={[0, 2.5, 0]}><boxGeometry args={[3.3, 0.12, 2.8]} /><meshStandardMaterial color="#1a5fa8" roughness={0.3} metalness={0.4} /></mesh>
          <mesh position={[0, 1.2, 1.26]}><boxGeometry args={[2, 1.8, 0.05]} /><meshStandardMaterial color="#7ec8e3" transparent opacity={0.5} metalness={0.4} /></mesh>
        </group>
        {/* Chaises hautes de surveillant (2) */}
        {[4, -2].map((x, i) => (
          <group key={`lifeg-${i}`} position={[x, 0.55, -4.5]}>
            <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.06, 0.08, 4.4, 6]} /><meshStandardMaterial color="#c0a060" roughness={0.7} /></mesh>
            <mesh position={[0, 4.5, 0]}><boxGeometry args={[1.2, 1, 0.8]} /><meshStandardMaterial color={night ? '#1a2030' : '#ffffff'} roughness={0.3} /></mesh>
            <mesh position={[0, 5.1, 0]}><boxGeometry args={[1.4, 0.08, 1.2]} /><meshStandardMaterial color="#cc3333" roughness={0.4} /></mesh>
            {/* Surveillant assis */}
            <mesh position={[0, 5.3, 0]}><capsuleGeometry args={[0.08, 0.2, 4, 8]} /><meshStandardMaterial color="#FFD700" /></mesh>
            <mesh position={[0, 5.65, 0]}><sphereGeometry args={[0.08, 6, 6]} /><meshStandardMaterial color="#FDBCB4" /></mesh>
          </group>
        ))}
        {/* 3 jet skis garés sur l'aire */}
        {[-4, 0, 4].map((x, i) => (
          <group key={`jski-${i}`} position={[x, 0.7, 1]} rotation={[0, 0.3 * (i - 1), 0]} scale={[1.3, 1.3, 1.3]}>
            <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.5, 0.22, 1.4]} /><meshStandardMaterial color={['#FF0040', '#00BFFF', '#FFD700'][i]} metalness={0.5} roughness={0.25} /></mesh>
            <mesh position={[0, 0.28, -0.2]}><boxGeometry args={[0.4, 0.18, 0.6]} /><meshStandardMaterial color="#1a1a2a" roughness={0.3} /></mesh>
            <mesh position={[0, 0.34, 0.4]}><boxGeometry args={[0.12, 0.28, 0.08]} /><meshStandardMaterial color="#333" metalness={0.7} /></mesh>
          </group>
        ))}
        {/* Panneau "JET SKI" */}
        <Text position={[-5, 3.2, -4]} rotation={[0, 0, 0]} fontSize={0.5} color={night ? '#00FFFF' : '#1a5fa8'} anchorX="center" fontWeight="bold">JET SKI</Text>
      </group>
      
      {/* ═══ PLAGE SUD ANIMÉE ═══ */}
      <BeachLife night={night} />
      
      {/* Palm trees on beach - plus détaillés */}
      {[[-70, -32], [-66, -26], [-60, -31]].map(([x, z], i) => (
        <group key={`palm-${i}`} position={[x, -1.3, z]}>
          {/* Tronc courbé */}
          <mesh position={[0, 1.8, 0]} rotation={[0.1 * (i % 2 === 0 ? 1 : -1), 0, 0.08 * (i % 3 - 1)]}>
            <cylinderGeometry args={[0.1, 0.15, 4, 8]} />
            <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
          </mesh>
          {/* Feuilles de palmier */}
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <mesh key={j} position={[Math.sin(j * 1.05) * 0.6, 3.8, Math.cos(j * 1.05) * 0.6]} rotation={[0.7, j * 1.05, 0.1]}>
              <boxGeometry args={[0.18, 0.03, 1.5]} />
              <meshStandardMaterial color="#2E8B2E" roughness={0.8} />
            </mesh>
          ))}
          {/* Noix de coco */}
          <mesh position={[0.15, 3.5, 0.1]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#8B4513" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* City lights at night - Plus de lumières */}
    </group>
  );
}

// ─── Coastal Train Station v2 — Enhanced with passengers ───
function CoastalStation({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const trainRef = useRef();
  const passengersRef = useRef();

  useFrame(({ clock }) => {
    if (!trainRef.current) return;
    const t = clock.getElapsedTime();
    const manualTrain = window.__coastalTrainManual && window.__coastalTrainManualState;
    let x = -70 + (t * 4) % 100;
    let rotationY = 0;

    if (manualTrain) {
      const state = manualTrain;
      const worldPos = state.pos || { x: 45 + x, y: -1.35, z: -36.25 };
      x = worldPos.x - 45;
      rotationY = typeof state.yaw === 'number' ? state.yaw : 0;
      trainRef.current.position.x = x;
      trainRef.current.rotation.y = rotationY;
      window.__coastalTrainPos = { x: worldPos.x, y: typeof worldPos.y === 'number' ? worldPos.y : -1.35, z: typeof worldPos.z === 'number' ? worldPos.z : -36.25 };
    } else {
      trainRef.current.position.x = x;
      trainRef.current.rotation.y = 0;
      window.__coastalTrainPos = { x: 45 + x, y: -1.35, z: -36.25 };
    }
    if (passengersRef.current) {
      passengersRef.current.children.forEach((p, i) => {
        if (p.userData.waiting) {
          p.position.y = p.userData.baseY + Math.sin(t * 2 + i) * 0.02;
        }
      });
    }
  });

  return (
    <group position={[45, -1.8, -40]}>
      {/* Modern concrete platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 15]} /><meshStandardMaterial color={night ? '#1a2030' : '#d8dce4'} roughness={0.4} metalness={0.2} /></mesh>

      {/* Modern station building — sleek white/glass */}
      <group position={[0, 0, -3]}>
        {/* Main glass building */}
        <mesh position={[0, 2.5, 0]}><boxGeometry args={[12, 5, 4]} />
          <meshPhysicalMaterial color={night ? '#0d1a30' : '#d0dce8'} metalness={0.8} roughness={0.08} transparent opacity={0.65} /></mesh>
        {/* Roof — flat modern white */}
        <mesh position={[0, 5.2, 0]}><boxGeometry args={[13, 0.3, 5]} />
          <meshStandardMaterial color={night ? '#2a3040' : '#f0f2f6'} roughness={0.2} metalness={0.4} /></mesh>
        {/* Roof edge light strip */}
        <mesh position={[0, 5.05, 2.51]}><boxGeometry args={[13, 0.1, 0.05]} />
          <meshStandardMaterial color={night ? '#4080cc' : '#80a0c0'} emissive={night ? '#4080cc' : '#000'} emissiveIntensity={night ? 3 : 0} /></mesh>
        {/* Modern glass windows — front */}
        {[-4, -2, 0, 2, 4].map((x, i) => (
          <mesh key={i} position={[x, 2.5, 2.01]}><planeGeometry args={[1.4, 3.5]} />
            <meshPhysicalMaterial color={night ? '#0a2050' : '#a0c8e8'} metalness={0.9} roughness={0.05} transparent opacity={0.5} emissive={night ? '#2060a0' : '#000'} emissiveIntensity={night ? 1.2 : 0} /></mesh>
        ))}
        {/* Modern entrance — glass */}
        <mesh position={[0, 1.5, 2.01]}><planeGeometry args={[2.5, 3]} />
          <meshPhysicalMaterial color={night ? '#0a1a30' : '#b0d0e8'} transparent opacity={0.35} metalness={0.8} roughness={0.05} /></mesh>
        {/* Station digital sign */}
        <mesh position={[0, 4.2, 2.01]}><boxGeometry args={[5, 0.7, 0.05]} />
          <meshStandardMaterial color={night ? '#00CCFF' : '#2060a0'} emissive="#00CCFF" emissiveIntensity={night ? 2 : 0.3} /></mesh>
      </group>

      {/* Modern platform — smooth concrete */}
      <mesh position={[0, 0.15, 1.5]}><boxGeometry args={[30, 0.3, 3]} /><meshStandardMaterial color={night ? '#252d3a' : '#c0c8d0'} roughness={0.4} metalness={0.3} /></mesh>
      {/* Platform edge — LED strip */}
      <mesh position={[0, 0.31, 2.9]}><boxGeometry args={[30, 0.04, 0.2]} />
        <meshStandardMaterial color="#00CCFF" emissive="#00CCFF" emissiveIntensity={night ? 2.5 : 0.5} /></mesh>

      {/* Rails */}
      {[3.5, 4, 5.5, 6].map((z, i) => (
        <mesh key={i} position={[0, 0.05, z]}><boxGeometry args={[35, 0.06, 0.05]} /><meshStandardMaterial color="#888" metalness={0.95} /></mesh>
      ))}
      {/* Sleepers */}
      {[...Array(45)].map((_, i) => (
        <group key={i}>
          <mesh position={[-18 + i * 0.85, -0.02, 3.75]}><boxGeometry args={[0.35, 0.04, 1]} /><meshStandardMaterial color="#5C3A1E" /></mesh>
          <mesh position={[-18 + i * 0.85, -0.02, 5.75]}><boxGeometry args={[0.35, 0.04, 1]} /><meshStandardMaterial color="#5C3A1E" /></mesh>
        </group>
      ))}

      {/* Modern train */}
      <group ref={trainRef} position={[-15, 0.45, 3.75]}>
        <group>
          <mesh position={[0, 0.4, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.8, 0.7, 2.5]} /><meshStandardMaterial color={night ? '#1a2040' : '#e0e4ea'} metalness={0.7} roughness={0.15} /></mesh>
          <mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.7, 0.4, 1.5]} /><meshStandardMaterial color={night ? '#1a2040' : '#d0d8e0'} metalness={0.6} /></mesh>
          <mesh position={[0, 0.5, -1.3]}><sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={night ? 4 : 1} /></mesh>
          {[-0.8, -0.3, 0.3, 0.8].map((z, i) => (
            <group key={i}>
              <mesh position={[0.45, 0.12, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.05, 12]} /><meshStandardMaterial color="#333" metalness={0.9} /></mesh>
              <mesh position={[-0.45, 0.12, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.05, 12]} /><meshStandardMaterial color="#333" metalness={0.9} /></mesh>
            </group>
          ))}
        </group>
        {[2.2, 4.2, 6.2].map((x, wi) => (
          <group key={wi} position={[x, 0, 0]}>
            <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[0.65, 0.55, 1.8]} /><meshStandardMaterial color={night ? '#1a2040' : '#e0e4ea'} metalness={0.5} roughness={0.3} /></mesh>
            {[-0.5, 0, 0.5].map((z, j) => (
              <mesh key={j} position={[0.33, 0.4, z]}><planeGeometry args={[0.3, 0.25]} />
                <meshStandardMaterial color="#b0d8ff" emissive="#3080cc" emissiveIntensity={night ? 1.5 : 0.2} transparent opacity={0.6} /></mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Modern shelter — glass canopy */}
      <mesh position={[0, 3, 1.5]}><boxGeometry args={[18, 0.15, 4]} />
        <meshPhysicalMaterial color="#d0e0f0" transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
      {[-8, -4, 0, 4, 8].map((x, i) => (
        <mesh key={`shelter-col-${i}`} position={[x, 1.5, 1.5]}><cylinderGeometry args={[0.06, 0.08, 3, 8]} />
          <meshStandardMaterial color={night ? '#506070' : '#c0c8d0'} metalness={0.8} roughness={0.15} /></mesh>
      ))}

      {/* Waiting passengers */}
      <group ref={passengersRef}>
        {[...Array(12)].map((_, i) => {
          const xP = -5 + i * 0.9;
          const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
          return (
            <group key={i} position={[xP, 0.9, 1.5]} userData={{ waiting: true, baseY: 0.9 }}>
              <mesh position={[0, 0.3, 0]}><capsuleGeometry args={[0.08, 0.25, 4, 8]} /><meshStandardMaterial color={colors[i % colors.length]} /></mesh>
              <mesh position={[0, 0.65, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#FDBCB4" /></mesh>
            </group>
          );
        })}
      </group>

      {/* Modern LED lighting at night */}
      {night && (
        <>
        </>
      )}
    </group>
  );
}

function DronePatrol({ tod }) {
  const droneRef = useRef();
  const night = tod < 0.18 || tod > 0.82;
  const waypoints = useMemo(() => ([
    new THREE.Vector3(-18, 30, -72),
    new THREE.Vector3(54, 28, -20),
    new THREE.Vector3(0, 32, -186),
    new THREE.Vector3(124, 29, -110),
  ]), []);

  useFrame(({ clock }) => {
    if (!droneRef.current) return;
    const t = clock.getElapsedTime();
    const seg = Math.floor((t / 10) % waypoints.length);
    const next = (seg + 1) % waypoints.length;
    const p = (t % 10) / 10;
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const a = waypoints[seg];
    const b = waypoints[next];
    const x = THREE.MathUtils.lerp(a.x, b.x, eased);
    const y = THREE.MathUtils.lerp(a.y, b.y, eased) + Math.sin(t * 2.4) * 0.18;
    const z = THREE.MathUtils.lerp(a.z, b.z, eased);
    droneRef.current.position.set(x, y, z);
    droneRef.current.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    droneRef.current.rotation.z = Math.sin(t * 2.6) * 0.06;
    window.__dronePos = { x, y, z };
  });

  return (
    <group ref={droneRef}>
      <mesh><boxGeometry args={[0.34, 0.12, 0.34]} /><meshStandardMaterial color="#dde6ee" metalness={0.72} roughness={0.12} /></mesh>
      {[[0.42, 0.42], [0.42, -0.42], [-0.42, 0.42], [-0.42, -0.42]].map(([x, z], i) => (
        <group key={`drone-arm-${i}`} position={[x * 0.5, 0, z * 0.5]}>
          <mesh rotation={[0, Math.atan2(x, z), 0]}><boxGeometry args={[0.52, 0.03, 0.06]} /><meshStandardMaterial color="#aeb8c2" metalness={0.8} roughness={0.1} /></mesh>
          <mesh position={[x * 0.5, 0.04, z * 0.5]}><cylinderGeometry args={[0.09, 0.09, 0.02, 10]} /><meshStandardMaterial color="#2e3440" metalness={0.74} roughness={0.12} /></mesh>
          <mesh position={[x * 0.5, 0.09, z * 0.5]}><cylinderGeometry args={[0.16, 0.16, 0.01, 12]} /><meshStandardMaterial color="#101317" emissive={night ? '#7ce7ff' : '#202630'} emissiveIntensity={night ? 1.0 : 0.08} /></mesh>
        </group>
      ))}
      {night && <>
        <mesh position={[0.14, 0.02, 0.14]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2.8} /></mesh>
        <mesh position={[-0.14, 0.02, -0.14]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2.8} /></mesh>
      </>}
    </group>
  );
}

// ─── Sailboats — YACHTS DE LUXE ULTRA-RÉALISTES CINÉMATOGRAPHIQUES ─
function SailBoats({ tod }) {
  const ref = useRef();
  const night = tod < 0.18 || tod > 0.82;
  
  // Yachts de luxe + vedettes — trajectoires longues en eau libre
  const boats = useMemo(() => [
    { r: 22, sp: 0.05, offset: 0.8, hullColor: '#f8f6f0', hullAccent: '#1a2744', deckColor: '#d4a373', sailMain: '#fefdfb', sailAccent: '#c9302c', type: 'racing', name: 'Oyster 885', startX: 30, startZ: 24 },
    { r: 26, sp: 0.04, offset: 2.5, hullColor: '#2c3e50', hullAccent: '#1a5fa8', deckColor: '#8b7355', sailMain: '#f5f5f5', sailAccent: '#2980b9', type: 'cruiser', name: 'Beneteau 62', startX: -20, startZ: 18 },
    { r: 18, sp: 0.06, offset: 4.2, hullColor: '#1a1a2e', hullAccent: '#f39c12', deckColor: '#a0826d', sailMain: '#ecf0f1', sailAccent: '#27ae60', type: 'performance', name: 'J/121', startX: 45, startZ: 32 },
    { r: 24, sp: 0.035, offset: 1.2, hullColor: '#ecf0f1', hullAccent: '#34495e', deckColor: '#c4a77d', sailMain: '#ffffff', sailAccent: '#8e44ad', type: 'superyacht', name: 'Swan 78', startX: -40, startZ: 28 },
    { r: 20, sp: 0.055, offset: 3.0, hullColor: '#f0e8d8', hullAccent: '#c0392b', deckColor: '#b8956a', sailMain: '#fafafa', sailAccent: '#e74c3c', type: 'racing', name: 'Vedette XR', startX: 10, startZ: 38 },
    { r: 28, sp: 0.032, offset: 5.0, hullColor: '#dce6f0', hullAccent: '#2c3e50', deckColor: '#a08868', sailMain: '#f8f8f8', sailAccent: '#1abc9c', type: 'cruiser', name: 'Lagoon 52', startX: 65, startZ: 20 },
  ], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((g, i) => {
      const b = boats[i];
      const angle = t * b.sp + b.offset;
      const candidate = new THREE.Vector3(
        b.startX + Math.sin(angle) * b.r,
        0,
        b.startZ + Math.cos(angle) * b.r * 0.6
      );
      const adjusted = offsetSeaVehiclePosition(candidate, i % 2 === 0 ? 1 : -1);
      adjusted.x = THREE.MathUtils.clamp(adjusted.x, SEA_LANE_BOUNDS.minX + 10, SEA_LANE_BOUNDS.maxX - 12);
      adjusted.z = THREE.MathUtils.clamp(adjusted.z, SEA_LANE_BOUNDS.minZ + 12, SEA_LANE_BOUNDS.maxZ - 10);
      g.position.x = adjusted.x;
      g.position.z = adjusted.z;

      // Évitement gros navires — virage latéral
      const avoidBigLateral = (shipPos, minD) => {
        if (!shipPos) return;
        const dx = g.position.x - shipPos.x, dz = g.position.z - shipPos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minD && d > 0.1) {
          const nextA = angle + 0.05;
          const dirX = Math.sin(nextA) - Math.sin(angle);
          const dirZ = Math.cos(nextA) - Math.cos(angle);
          const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
          const perpX = -dirZ / len, perpZ = dirX / len;
          const side = (perpX * dx + perpZ * dz) > 0 ? 1 : -1;
          const strength = (1 - d / minD) * 8;
          g.position.x += perpX * side * strength;
          g.position.z += perpZ * side * strength;
        }
      };
      avoidBigLateral(window.__carrierPos, 40);
      avoidBigLateral(window.__cargoPos, 30);
      avoidBigLateral(window.__superyachtPos, 32);
      avoidBigLateral(window.__ferryPos, 28);

      // Rocking réaliste avec houle
      g.rotation.z = Math.sin(t * 0.5 + i) * 0.035 + Math.sin(t * 1.2 + i * 0.5) * 0.015;
      g.rotation.x = Math.cos(t * 0.4 + i) * 0.02 + Math.sin(t * 0.9) * 0.008;
      g.position.y = -2.2 + Math.sin(t * 0.6 + i) * 0.12 + Math.sin(t * 1.4) * 0.04;
      // Face movement direction
      const nextA = angle + 0.05;
      const nextAdjusted = offsetSeaVehiclePosition(new THREE.Vector3(
        b.startX + Math.sin(nextA) * b.r,
        0,
        b.startZ + Math.cos(nextA) * b.r * 0.6
      ), i % 2 === 0 ? 1 : -1);
      const nx = THREE.MathUtils.clamp(nextAdjusted.x, SEA_LANE_BOUNDS.minX + 10, SEA_LANE_BOUNDS.maxX - 12);
      const nz = THREE.MathUtils.clamp(nextAdjusted.z, SEA_LANE_BOUNDS.minZ + 12, SEA_LANE_BOUNDS.maxZ - 10);
      g.rotation.y = Math.atan2(nx - g.position.x, nz - g.position.z) + Math.PI;
    });
  });

  return (
    <group ref={ref}>
      {boats.map((b, i) => (
        <group key={i} position={[b.startX, -1.5, b.startZ]}>
          {/* ═══ COQUE PRINCIPALE — Design hydrodynamique moderne ═══ */}
          <group>
            {/* Corps principal de la coque - profil élancé */}
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[1.1, 0.45, 3.8]} />
              <meshStandardMaterial 
                color={b.hullColor} 
                metalness={0.25} 
                roughness={0.15}
                envMapIntensity={1.5}
              />
            </mesh>
            
            {/* Proue effilée - design moderne */}
            <mesh position={[0, 0.2, -2.1]} rotation={[0.12, 0, 0]}>
              <coneGeometry args={[0.55, 1.4, 4]} />
              <meshStandardMaterial 
                color={b.hullColor} 
                metalness={0.25} 
                roughness={0.15}
              />
            </mesh>
            
            {/* Ligne de flottaison - waterline stripe premium */}
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[1.12, 0.08, 3.85]} />
              <meshStandardMaterial 
                color={b.hullAccent} 
                metalness={0.4}
                roughness={0.2}
              />
            </mesh>
            
            {/* Quille profonde - deep keel pour performance */}
            <mesh position={[0, -0.35, 0.2]}>
              <boxGeometry args={[0.12, 0.5, 2.2]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
            </mesh>
            
            {/* Bulbe de quille - pour stabilité */}
            <mesh position={[0, -0.55, 0.2]}>
              <sphereGeometry args={[0.18, 12, 8]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
            </mesh>
            
            {/* Safran/Gouvernail */}
            <mesh position={[0, -0.2, 1.7]}>
              <boxGeometry args={[0.04, 0.35, 0.4]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
            </mesh>
          </group>
          
          {/* ═══ PONT EN TECK — Premium deck avec détails ═══ */}
          <group position={[0, 0.4, 0]}>
            {/* Pont principal - texture teck */}
            <mesh>
              <boxGeometry args={[1.0, 0.08, 3.6]} />
              <meshStandardMaterial 
                color={b.deckColor} 
                roughness={0.65}
                metalness={0.05}
              />
            </mesh>
            
            {/* Lignes de calfatage du teck (planches) */}
            {[...Array(18)].map((_, li) => (
              <mesh key={li} position={[0, 0.045, -1.6 + li * 0.2]}>
                <boxGeometry args={[0.98, 0.005, 0.02]} />
                <meshStandardMaterial color="#1a1a1a" opacity={0.3} transparent />
              </mesh>
            ))}
            
            {/* Rails de sécurité - Inox poli */}
            {[-0.48, 0.48].map((x, xi) => (
              <group key={xi}>
                {/* Rail supérieur */}
                <mesh position={[x, 0.25, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 3.2, 8]} rotation={[Math.PI/2, 0, 0]} />
                  <meshStandardMaterial color="#e8e8e8" metalness={0.95} roughness={0.05} />
                </mesh>
                {/* Chandeliers */}
                {[-1.2, -0.4, 0.4, 1.2].map((z, zi) => (
                  <mesh key={zi} position={[x, 0.12, z]}>
                    <cylinderGeometry args={[0.008, 0.008, 0.25, 6]} />
                    <meshStandardMaterial color="#d0d0d0" metalness={0.9} roughness={0.1} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
          
          {/* ═══ MÂTURE CARBONE — Carbon fiber mast ═══ */}
          <group position={[0, 0.45, -0.3]}>
            {/* Mât principal - carbone */}
            <mesh position={[0, 2.4, 0]}>
              <cylinderGeometry args={[0.035, 0.055, 5.2, 12]} />
              <meshStandardMaterial 
                color="#2a2a2a" 
                metalness={0.6} 
                roughness={0.25}
              />
            </mesh>
            
            {/* Barres de flèche - spreaders */}
            <mesh position={[0, 3.2, 0]} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[0.012, 0.012, 1.4, 6]} />
              <meshStandardMaterial color="#404040" metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0, 4.2, 0]} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[0.01, 0.01, 1.0, 6]} />
              <meshStandardMaterial color="#404040" metalness={0.7} roughness={0.2} />
            </mesh>
            
            {/* Bôme - boom */}
            <mesh position={[0, 0.8, 0.9]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.02, 2.2, 8]} rotation={[Math.PI/2, 0, 0]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.3} />
            </mesh>
            
            {/* Gréement - haubanage */}
            {[[-0.6, 3.8], [0.6, 3.8], [-0.5, 4.5], [0.5, 4.5]].map(([x, y], si) => (
              <mesh key={si} position={[x/2, y/2 + 0.5, 0]} rotation={[0, 0, Math.atan2(x, y)]}>
                <cylinderGeometry args={[0.004, 0.004, Math.sqrt(x*x + y*y), 4]} />
                <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
              </mesh>
            ))}
          </group>
          
          {/* ═══ VOILES — Membrane haute performance ═══ */}
          <group position={[0, 0.45, -0.3]}>
            {/* Grand-voile principale - mainsail */}
            <mesh position={[0.015, 2.8, 0.5]} rotation={[0, -0.08, 0]}>
              <boxGeometry args={[0.02, 3.2, 2.0]} />
              <meshStandardMaterial 
                color={b.sailMain}
                transparent 
                opacity={0.94}
                side={THREE.DoubleSide}
                roughness={0.4}
              />
            </mesh>
            
            {/* Lattes de la voile - battens */}
            {[0.8, 1.6, 2.4, 3.2].map((y, bi) => (
              <mesh key={bi} position={[0.018, y + 1.2, 0.5]}>
                <boxGeometry args={[0.015, 0.02, 1.8 - bi * 0.3]} />
                <meshStandardMaterial color="#e0e0e0" />
              </mesh>
            ))}
            
            {/* Numéro de voile / Logo */}
            <mesh position={[0.025, 2.5, 0.3]}>
              <boxGeometry args={[0.008, 0.6, 0.4]} />
              <meshStandardMaterial color={b.sailAccent} />
            </mesh>
            <mesh position={[0.025, 3.2, 0.3]}>
              <boxGeometry args={[0.008, 0.15, 0.8]} />
              <meshStandardMaterial color={b.sailAccent} />
            </mesh>
            
            {/* Génois/Foc - headsail */}
            <mesh position={[0, 2.2, -1.4]} rotation={[0.1, 0.05, 0]}>
              <boxGeometry args={[0.015, 2.6, 1.3]} />
              <meshStandardMaterial 
                color={b.sailMain}
                transparent 
                opacity={0.9}
                side={THREE.DoubleSide}
                roughness={0.4}
              />
            </mesh>
          </group>
          
          {/* ═══ COCKPIT & ROUF — Superstructure luxe ═══ */}
          <group position={[0, 0.45, 0.9]}>
            {/* Rouf principal - cabin top */}
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.85, 0.35, 1.3]} />
              <meshStandardMaterial 
                color={b.hullColor}
                metalness={0.2}
                roughness={0.2}
              />
            </mesh>
            
            {/* Vitrage panoramique - hublots larges */}
            <mesh position={[0, 0.25, -0.66]}>
              <boxGeometry args={[0.7, 0.22, 0.02]} />
              <meshStandardMaterial 
                color="#6eb5ff"
                metalness={0.6}
                roughness={0.1}
                transparent
                opacity={0.85}
                emissive="#4a90c9"
                emissiveIntensity={night ? 0.6 : 0.05}
              />
            </mesh>
            
            {/* Hublots latéraux */}
            {[-0.43, 0.43].map((x, hi) => (
              <mesh key={hi} position={[x, 0.2, 0]}>
                <boxGeometry args={[0.02, 0.18, 0.5]} />
                <meshStandardMaterial 
                  color="#7ec8e3"
                  transparent
                  opacity={0.8}
                  emissive="#5eb5d5"
                  emissiveIntensity={night ? 0.5 : 0.02}
                />
              </mesh>
            ))}
            {night && (
              <>
                {[0.48, -0.48].map((x, sideIndex) => (
                  <mesh key={`sail-rail-light-${sideIndex}`} position={[x, 0.28, 0.02]}>
                    <boxGeometry args={[0.02, 0.04, 2.9]} />
                    <meshStandardMaterial color="#dff7ff" emissive="#7ce7ff" emissiveIntensity={1.2} />
                  </mesh>
                ))}
                {[-0.7, 0, 0.7].map((z, pi) => (
                  <mesh key={`sail-porthole-${pi}`} position={[0, 0.18, z]}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={1.6} />
                  </mesh>
                ))}
              </>
            )}
            
            {/* Barre à roue - helm wheel */}
            <mesh position={[0, 0.08, 0.8]} rotation={[0.3, 0, 0]}>
              <torusGeometry args={[0.12, 0.015, 8, 24]} />
              <meshStandardMaterial color="#4a3728" metalness={0.3} roughness={0.5} />
            </mesh>
            
            {/* Instruments de navigation */}
            <mesh position={[0, 0.38, 0.3]}>
              <boxGeometry args={[0.15, 0.08, 0.08]} />
              <meshStandardMaterial 
                color="#1a1a1a"
                emissive={night ? "#00ff88" : "#003322"}
                emissiveIntensity={night ? 0.8 : 0.1}
              />
            </mesh>
          </group>
          
          {/* ═══ ÉCLAIRAGE NAVIGATION — Premium nav lights ═══ */}
          <mesh position={[0.55, 0.5, -1.5]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial 
              color="#00ff00" 
              emissive="#00ff00" 
              emissiveIntensity={night ? 4 : 0.5} 
            />
          </mesh>
          <mesh position={[-0.55, 0.5, -1.5]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial 
              color="#ff0000" 
              emissive="#ff0000" 
              emissiveIntensity={night ? 4 : 0.5} 
            />
          </mesh>
          <mesh position={[0, 5.2, -0.3]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial 
              color="#ffffff" 
              emissive="#ffffff" 
              emissiveIntensity={night ? 3 : 0.3} 
            />
          </mesh>
          
          {night && (
            <>
            </>
          )}
          
          {/* ═══ SILLAGE RÉALISTE — Hydrodynamic wake ═══ */}
          <group position={[0, -0.25, 2]}>
            {/* Sillage principal - V-shape */}
            <mesh position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.8, 3]} />
              <meshStandardMaterial color="#e8f4fc" transparent opacity={0.12} />
            </mesh>
            {/* Vagues en V */}
            <mesh position={[0.5, 0.02, 1.5]} rotation={[-Math.PI / 2, 0, 0.25]}>
              <planeGeometry args={[0.5, 2.5]} />
              <meshStandardMaterial color="#d4eaf7" transparent opacity={0.08} />
            </mesh>
            <mesh position={[-0.5, 0.02, 1.5]} rotation={[-Math.PI / 2, 0, -0.25]}>
              <planeGeometry args={[0.5, 2.5]} />
              <meshStandardMaterial color="#d4eaf7" transparent opacity={0.08} />
            </mesh>
            {/* Écume - foam */}
            {[...Array(5)].map((_, fi) => (
              <mesh key={fi} position={[(Math.random()-0.5)*0.6, 0.03, 0.3 + fi * 0.5]} rotation={[-Math.PI/2, 0, 0]}>
                <circleGeometry args={[0.08 + Math.random() * 0.1, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.15} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

// ─── Navigation Buoys — BOUÉES IALA ULTRA-RÉALISTES ────
function NavigationBuoys({ tod }) {
  const ref = useRef();
  const night = tod < 0.18 || tod > 0.82;
  
  // Bouées conformes aux normes IALA (International Association of Lighthouse Authorities)
  const buoys = useMemo(() => [
    { x: 12, z: -8, type: 'lateral_port', color: '#c0392b', topColor: '#c0392b', light: '#ff4444', shape: 'can' },
    { x: -14, z: -12, type: 'lateral_starboard', color: '#27ae60', topColor: '#27ae60', light: '#00ff44', shape: 'conical' },
    { x: 8, z: 15, type: 'special', color: '#f1c40f', topColor: '#f1c40f', light: '#ffff44', shape: 'spherical' },
    { x: -22, z: 5, type: 'cardinal_north', color: '#2c3e50', topColor: '#f1c40f', light: '#ffffff', shape: 'pillar' },
    { x: 25, z: -18, type: 'isolated_danger', color: '#2c3e50', topColor: '#c0392b', light: '#ff4444', shape: 'pillar' },
    { x: -8, z: 22, type: 'lateral_starboard', color: '#27ae60', topColor: '#27ae60', light: '#00ff44', shape: 'conical' },
    { x: 30, z: 8, type: 'lateral_port', color: '#c0392b', topColor: '#c0392b', light: '#ff4444', shape: 'can' },
    { x: -35, z: -5, type: 'safe_water', color: '#ecf0f1', topColor: '#c0392b', light: '#ffffff', shape: 'spherical' },
    { x: 18, z: -28, type: 'special', color: '#f1c40f', topColor: '#f1c40f', light: '#ffff00', shape: 'can' },
  ], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((g, i) => {
      // Mouvement réaliste de houle
      g.position.y = -1.2 + Math.sin(t * 0.6 + i * 0.9) * 0.2;
      g.rotation.z = Math.sin(t * 0.45 + i) * 0.1 + Math.sin(t * 1.2) * 0.03;
      g.rotation.x = Math.cos(t * 0.35 + i * 0.7) * 0.06;
    });
  });

  return (
    <group ref={ref}>
      {buoys.map((b, i) => (
        <group key={i} position={[b.x, -1.2, b.z]}>
          {/* Chaîne de mouillage */}
          <mesh position={[0, -0.7, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.4, 6]} />
            <meshStandardMaterial color="#5d6d7e" metalness={0.85} roughness={0.3} />
          </mesh>
          
          {/* Corps principal - selon la forme */}
          {b.shape === 'can' && (
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.28, 0.32, 0.8, 16]} />
              <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.35} />
            </mesh>
          )}
          {b.shape === 'conical' && (
            <mesh position={[0, 0.2, 0]}>
              <coneGeometry args={[0.32, 0.9, 16]} />
              <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.35} />
            </mesh>
          )}
          {b.shape === 'spherical' && (
            <mesh position={[0, 0.25, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial color={b.color} roughness={0.4} metalness={0.3} />
            </mesh>
          )}
          {b.shape === 'pillar' && (
            <group>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.22, 0.26, 1.0, 12]} />
                <meshStandardMaterial color={b.color} roughness={0.5} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0.85, 0]}>
                <cylinderGeometry args={[0.18, 0.22, 0.15, 12]} />
                <meshStandardMaterial color={b.topColor} roughness={0.4} />
              </mesh>
            </group>
          )}
          
          {/* Bandes réfléchissantes SOLAS */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.33, 0.33, 0.06, 16]} />
            <meshStandardMaterial 
              color="#ecf0f1" 
              metalness={0.95} 
              roughness={0.02}
              envMapIntensity={2}
            />
          </mesh>
          
          {/* Sommet avec feu */}
          <group position={[0, b.shape === 'pillar' ? 0.95 : 0.6, 0]}>
            {/* Support du feu */}
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.06, 0.1, 0.15, 8]} />
              <meshStandardMaterial color="#34495e" metalness={0.7} />
            </mesh>
            
            {/* Lanterne */}
            <mesh position={[0, 0.22, 0]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial 
                color={b.light}
                emissive={b.light}
                emissiveIntensity={night ? 6 : 2}
                transparent
                opacity={0.95}
              />
            </mesh>
            
            {/* Panneaux solaires (réalisme moderne) */}
            <mesh position={[0.12, 0.1, 0]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.08, 0.01, 0.12]} />
              <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.2} />
            </mesh>
          </group>
          
          {/* Marque de tête pour cardinal */}
          {b.type === 'cardinal_north' && (
            <group position={[0, 1.1, 0]}>
              <mesh position={[0, 0.08, 0]}>
                <coneGeometry args={[0.06, 0.12, 4]} />
                <meshStandardMaterial color="#2c3e50" />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <coneGeometry args={[0.06, 0.12, 4]} />
                <meshStandardMaterial color="#2c3e50" />
              </mesh>
            </group>
          )}
          
          {/* Bandes horizontales (certaines bouées) */}
          {b.type === 'isolated_danger' && (
            <>
              <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.29, 0.29, 0.15, 12]} />
                <meshStandardMaterial color="#c0392b" />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 0.15, 12]} />
                <meshStandardMaterial color="#c0392b" />
              </mesh>
            </>
          )}
          
          
        </group>
      ))}
    </group>
  );
}

// ─── Distant Cargo Ship — PORTE-CONTENEURS ULTRA-RÉALISTE ──────────
function DistantFreighter({
  tod,
  start = [-132, -1.82, -82],
  waypoints = [[-32, -1.72, 16], [22, -1.72, 34]],
  hullColor = '#2c3e50',
  underwaterColor = '#c0392b',
  stripeColor = '#ecf0f1',
  accentColor = '#3498db',
  funnelColor = '#e74c3c',
  containerShift = 0,
  speed = 0.9,
  sway = 6,
  sideBias = 1,
  obstacles = FREIGHTER_ROUTE_OBSTACLES,
  bounds = SEA_LANE_BOUNDS,
}) {
  const ref = useRef();
  const wakeRef = useRef();
  const positionRef = useRef(new THREE.Vector3(...start));
  const velocityRef = useRef(new THREE.Vector3());
  const waypointIndexRef = useRef(0);
  const night = tod < 0.18 || tod > 0.82;

  const startVector = useMemo(() => new THREE.Vector3(...start), [start]);
  const waypointVectors = useMemo(
    () => waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    [waypoints]
  );
  const obstacleVectors = useMemo(
    () => obstacles.map((obstacle) => ({ ...obstacle, vector: new THREE.Vector3(obstacle.x, start[1], obstacle.z) })),
    [obstacles, start]
  );

  useEffect(() => {
    positionRef.current.set(...start);
    velocityRef.current.set(0, 0, 0);
    waypointIndexRef.current = 0;
  }, [start]);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;

    const t = clock.getElapsedTime();
    const current = positionRef.current;
    const activeWaypoint = waypointVectors[waypointIndexRef.current];

    if (!activeWaypoint) {
      current.set(...start);
      velocityRef.current.set(0, 0, 0);
      waypointIndexRef.current = 0;
      return;
    }

    const navigationTarget = activeWaypoint.clone();
    navigationTarget.x += Math.sin(t * 0.18 + containerShift * 0.7) * sway;
    navigationTarget.z += Math.cos(t * 0.15 + containerShift * 0.45) * sway * 0.55;

    const desired = navigationTarget.sub(current);
    const distanceToWaypoint = desired.length();

    if (distanceToWaypoint < 9) {
      if (waypointIndexRef.current < waypointVectors.length - 1) {
        waypointIndexRef.current += 1;
      } else {
        current.copy(startVector);
        velocityRef.current.set(0, 0, 0);
        waypointIndexRef.current = 0;
      }
    } else {
      steerSeaVehicle(current, velocityRef.current, navigationTarget, delta, {
        obstacles: obstacleVectors.map(({ x, z, radius, push }) => ({ x, z, radius, push })),
        speed,
        sideBias,
        arrivalRadius: 9,
        bounds,
      });
    }

    const moveDirection = velocityRef.current.clone();
    moveDirection.y = 0;

    ref.current.position.set(
      current.x,
      startVector.y + Math.sin(t * 0.34 + containerShift) * 0.14,
      current.z
    );

    // Exposer position pour l'évitement mutuel
    window.__cargoPos = { x: current.x, y: startVector.y, z: current.z };

    // Évitement du porte-avions — virage latéral DOUX, jamais de recul
    const cpPos = window.__carrierPos;
    if (cpPos) {
      const dx = current.x - cpPos.x;
      const dz = current.z - cpPos.z;
      const carrierDist = Math.sqrt(dx * dx + dz * dz);
      const minDist = 50;
      if (carrierDist < minDist && carrierDist > 0.1) {
        const vel = velocityRef.current;
        const velLen = vel.length();
        if (velLen > 0.01) {
          const fwdX = vel.x / velLen, fwdZ = vel.z / velLen;
          const perpX = -fwdZ, perpZ = fwdX;
          const side = (perpX * dx + perpZ * dz) > 0 ? 1 : -1;
          const strength = Math.min(0.6, (1 - carrierDist / minDist) * 0.8);
          current.x += perpX * side * strength;
          current.z += perpZ * side * strength;
        }
      }
    }

    if (moveDirection.lengthSq() > 0.0004) {
      moveDirection.normalize();
      const targetYaw = Math.atan2(moveDirection.z, -moveDirection.x);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, targetYaw, 0.06);
    }

    ref.current.rotation.x = Math.sin(t * 0.22 + containerShift * 0.5) * 0.01;
    ref.current.rotation.z = Math.sin(t * 0.42 + containerShift * 0.3) * 0.012;

    if (wakeRef.current) {
      const wakeSpeed = Math.min(1.2, velocityRef.current.length());
      wakeRef.current.children.forEach((child, index) => {
        if (!child.material) return;
        child.material.opacity = 0.07 + wakeSpeed * 0.09 + Math.sin(t * 2.1 + index * 0.6) * 0.018;
        child.scale.x = 1 + wakeSpeed * 0.12;
        child.scale.y = 1 + wakeSpeed * 0.08;
      });
    }
  });

  const containerColors = useMemo(() => {
    const palette = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6'];
    return palette.slice(containerShift).concat(palette.slice(0, containerShift));
  }, [containerShift]);

  return (
    <group ref={ref} position={start}>
      {/* ═══ COQUE PRINCIPALE — Profil de cargo moderne ═══ */}
      <group>
        {/* Corps principal - acier naval */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[22, 2.2, 5]} />
          <meshStandardMaterial 
            color={hullColor}
            roughness={0.5} 
            metalness={0.5}
            envMapIntensity={0.8}
          />
        </mesh>
        
        {/* Proue bulbeuse moderne */}
        <mesh position={[-11.5, 0.3, 0]} rotation={[0, 0, Math.PI/2]}>
          <coneGeometry args={[2.5, 3, 8]} />
          <meshStandardMaterial color={hullColor} roughness={0.5} metalness={0.5} />
        </mesh>
        
        {/* Bulbe d'étrave (underwater bulb) */}
        <mesh position={[-12.5, -0.8, 0]} rotation={[0, 0, Math.PI/2]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshStandardMaterial color={underwaterColor} roughness={0.6} />
        </mesh>
        
        {/* Ligne de flottaison - Plimsoll line */}
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[22.5, 0.15, 5.2]} />
          <meshStandardMaterial color={stripeColor} metalness={0.3} />
        </mesh>
        
        {/* Coque sous-marine - rouge antifouling */}
        <mesh position={[0, -1.0, 0]}>
          <boxGeometry args={[21, 1.2, 4.8]} />
          <meshStandardMaterial color={underwaterColor} roughness={0.65} />
        </mesh>
        
        {/* Bordure de pont */}
        <mesh position={[0, 1.75, 0]}>
          <boxGeometry args={[22.2, 0.08, 5.1]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={night ? 0.25 : 0.02} metalness={0.6} />
        </mesh>
      </group>
      
      {/* ═══ CONTENEURS — Empilés de façon réaliste ═══ */}
      <group position={[0, 1.8, 0]}>
        {/* Rangées de conteneurs - pattern réaliste */}
        {[-8, -5, -2, 1, 4].map((cx, ci) => (
          <group key={ci} position={[cx, 0, 0]}>
            {/* Stack 1 - au sol */}
            <mesh position={[0, 0.5, -1.2]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[ci % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[(ci + 3) % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.5, 1.2]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[(ci + 5) % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            
            {/* Stack 2 */}
            <mesh position={[0, 1.55, -1.2]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[(ci + 2) % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[(ci + 7) % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.55, 1.2]}>
              <boxGeometry args={[2.8, 1.0, 1.1]} />
              <meshStandardMaterial color={containerColors[(ci + 1) % 8]} roughness={0.55} metalness={0.3} />
            </mesh>
            
            {/* Stack 3 - partiel pour réalisme */}
            {ci < 3 && (
              <>
                <mesh position={[0, 2.6, 0]}>
                  <boxGeometry args={[2.8, 1.0, 1.1]} />
                  <meshStandardMaterial color={containerColors[(ci + 4) % 8]} roughness={0.55} metalness={0.3} />
                </mesh>
                <mesh position={[0, 2.6, -1.2]}>
                  <boxGeometry args={[2.8, 1.0, 1.1]} />
                  <meshStandardMaterial color={containerColors[(ci + 6) % 8]} roughness={0.55} metalness={0.3} />
                </mesh>
              </>
            )}
            
            {/* Détails containers - côtes latérales */}
            {[0.5, 1.55, 2.6].map((y, yi) => (
              ci < 3 || yi < 2 ? (
                <mesh key={yi} position={[1.35, y, 0]}>
                  <boxGeometry args={[0.05, 0.9, 3.5]} />
                  <meshStandardMaterial color="#1a1a1a" />
                </mesh>
              ) : null
            ))}
          </group>
        ))}
      </group>
      
      {/* ═══ SUPERSTRUCTURE / CHÂTEAU ═══ */}
      <group position={[8.5, 1.8, 0]}>
        {/* Base du château */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[4.5, 3, 4.5]} />
          <meshStandardMaterial color="#ecf0f1" roughness={0.35} metalness={0.3} />
        </mesh>
        
        {/* Passerelle / Bridge - niveau supérieur */}
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[4, 1.2, 4.2]} />
          <meshStandardMaterial color="#bdc3c7" roughness={0.3} metalness={0.4} />
        </mesh>
        
        {/* Vitrage passerelle panoramique */}
        <mesh position={[-2.02, 3.5, 0]}>
          <boxGeometry args={[0.05, 0.9, 3.8]} />
          <meshStandardMaterial 
            color={accentColor}
            transparent 
            opacity={0.75}
            emissive={accentColor}
            emissiveIntensity={night ? 0.8 : 0.05}
            metalness={0.5}
          />
        </mesh>
        
        {/* Fenêtres du château */}
        {[-1, 0, 1].map((row, ri) => (
          [-1.5, -0.5, 0.5, 1.5].map((col, ci) => (
            <mesh key={`${ri}-${ci}`} position={[-2.26, 1.2 + ri * 0.9, col]}>
              <boxGeometry args={[0.02, 0.6, 0.55]} />
              <meshStandardMaterial 
                color="#f7dc6f"
                emissive="#f4d03f"
                emissiveIntensity={night ? 1.2 : 0.1}
                transparent
                opacity={0.85}
              />
            </mesh>
          ))
        ))}
        
        {/* Radar / Mât de signalisation */}
        <mesh position={[0, 4.8, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 2, 8]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.8} />
        </mesh>
        
        {/* Antenne radar rotative */}
        <mesh position={[0, 5.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <boxGeometry args={[0.08, 1.8, 0.3]} />
          <meshStandardMaterial color="#2c3e50" metalness={0.7} />
        </mesh>
        
        {/* Cheminée / Funnel - avec marquage compagnie */}
        <mesh position={[1.5, 4.2, 0]}>
          <cylinderGeometry args={[0.6, 0.75, 2.5, 12]} />
          <meshStandardMaterial color="#2c3e50" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Bande de couleur compagnie */}
        <mesh position={[1.5, 4.5, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.5, 12]} />
          <meshStandardMaterial color={funnelColor} />
        </mesh>
        <mesh position={[1.5, 3.8, 0]}>
          <cylinderGeometry args={[0.78, 0.78, 0.3, 12]} />
          <meshStandardMaterial color={accentColor} />
        </mesh>
        
        {/* Fumée réaliste */}
        {[0.3, 1.0, 2.0, 3.2].map((h, i) => (
          <mesh key={i} position={[1.5 + i * 0.4, 5.8 + h, i * 0.2]}>
            <sphereGeometry args={[0.35 + i * 0.2, 8, 8]} />
            <meshStandardMaterial 
              color="#95a5a6" 
              transparent 
              opacity={0.2 - i * 0.04} 
            />
          </mesh>
        ))}
      </group>
      
      {/* ═══ GRUES DE PONT — Deck cranes ═══ */}
      {[-3, 6.5].map((gx, gi) => (
        <group key={gi} position={[gx, 5, 2.3]}>
          {/* Pylône */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.3, 3.5, 0.3]} />
            <meshStandardMaterial color={funnelColor} roughness={0.5} />
          </mesh>
          {/* Bras de grue */}
          <mesh position={[0.8, 1.5, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[2.5, 0.2, 0.2]} />
            <meshStandardMaterial color={funnelColor} roughness={0.5} />
          </mesh>
        </group>
      ))}
      
      {/* ═══ FEUX DE NAVIGATION ═══ */}
      <mesh position={[-11.5, 2.5, 2.4]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={night ? 5 : 1} />
      </mesh>
      <mesh position={[-11.5, 2.5, -2.4]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={night ? 5 : 1} />
      </mesh>
      <mesh position={[11, 5.5, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 4 : 0.8} />
      </mesh>
      
      {night && (
        <>
        </>
      )}
      
      {/* ═══ SILLAGE MASSIF ═══ */}
      <group ref={wakeRef} position={[12, -1.5, 0]}>
        <mesh rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 15]} />
          <meshStandardMaterial color="#f1fbff" transparent opacity={0.14} />
        </mesh>
        <mesh position={[2, 0.05, 0]} rotation={[-Math.PI/2, 0, 0.15]}>
          <planeGeometry args={[3, 12]} />
          <meshStandardMaterial color="#d8effa" transparent opacity={0.08} />
        </mesh>
        <mesh position={[-2, 0.05, 0]} rotation={[-Math.PI/2, 0, -0.15]}>
          <planeGeometry args={[3, 12]} />
          <meshStandardMaterial color="#d8effa" transparent opacity={0.08} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Ocean Wildlife — GRANDS DAUPHINS RÉALISTES QUALITÉ CINÉMA ─────────
function OceanWildlife({ tod }) {
  const ref = useRef();
  const isDay = tod > 0.18 && tod < 0.82;

  // Groupe de grands dauphins (Tursiops truncatus)
  const dolphins = useMemo(() => [
    { x: 10, z: -5, sp: 1.1, offset: 0, size: 1.0 },
    { x: 12, z: -3, sp: 1.1, offset: 0.35, size: 0.85 }, // Jeune
    { x: 14, z: -6, sp: 1.1, offset: 0.7, size: 0.95 },
    { x: -8, z: 18, sp: 0.85, offset: 1.5, size: 1.0 },
    { x: -6, z: 20, sp: 0.85, offset: 1.9, size: 0.9 },
  ], []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((g, i) => {
      const d = dolphins[i];
      // Arc de saut naturel avec anticipation et retombée
      const jumpCycle = (t * d.sp + d.offset) % (Math.PI * 2);
      const jumpHeight = Math.max(0, Math.sin(jumpCycle) * 3.0);
      const jumpAngle = -Math.sin(jumpCycle) * 0.7; // Rotation naturelle
      
      // Déplacement en groupe
      g.position.x = d.x + Math.sin(t * 0.28 + d.offset) * 6;
      g.position.z = d.z + Math.cos(t * 0.22 + d.offset) * 5;
      g.position.y = -1.6 + jumpHeight;
      g.rotation.x = jumpAngle;
      g.rotation.y = Math.atan2(
        Math.cos(t * 0.28 + d.offset) * 6, 
        Math.sin(t * 0.28 + d.offset) * 5
      );
      
      // Visible uniquement pendant le saut
      g.visible = jumpHeight > 0.08;
    });
  });

  if (!isDay) return null;
  return (
    <group ref={ref}>
      {dolphins.map((d, i) => (
        <group key={i} position={[d.x, -1.6, d.z]} scale={[d.size, d.size, d.size]}>
          {/* ═══ CORPS PRINCIPAL — Forme hydrodynamique réaliste ═══ */}
          <group>
            {/* Corps fusiforme - base */}
            <mesh>
              <capsuleGeometry args={[0.16, 0.9, 8, 16]} />
              <meshStandardMaterial 
                color="#4a6878" 
                roughness={0.35}
                metalness={0.15}
              />
            </mesh>
            
            {/* Museau profilé (rostrum) */}
            <mesh position={[0, 0.02, -0.6]} rotation={[0.15, 0, 0]}>
              <coneGeometry args={[0.09, 0.38, 8]} />
              <meshStandardMaterial color="#4a6878" roughness={0.35} />
            </mesh>
            
            {/* Melon (front bombé caractéristique) */}
            <mesh position={[0, 0.06, -0.35]}>
              <sphereGeometry args={[0.14, 12, 8]} />
              <meshStandardMaterial color="#4a6878" roughness={0.35} />
            </mesh>
            
            {/* Ventre clair - countershading */}
            <mesh position={[0, -0.1, 0]}>
              <capsuleGeometry args={[0.12, 0.75, 6, 12]} />
              <meshStandardMaterial 
                color="#d8e8ec" 
                roughness={0.3}
              />
            </mesh>
            
            {/* Ligne latérale plus claire */}
            <mesh position={[0.12, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.6, 4, 8]} />
              <meshStandardMaterial color="#7a9aa8" roughness={0.35} />
            </mesh>
            <mesh position={[-0.12, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.6, 4, 8]} />
              <meshStandardMaterial color="#7a9aa8" roughness={0.35} />
            </mesh>
          </group>
          
          {/* ═══ NAGEOIRE DORSALE — Signature du dauphin ═══ */}
          <mesh position={[0, 0.25, 0.05]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.06, 0.35, 4]} />
            <meshStandardMaterial color="#3a5868" roughness={0.4} />
          </mesh>
          {/* Courbure arrière de la dorsale */}
          <mesh position={[0, 0.22, 0.12]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[0.02, 0.12, 0.08]} />
            <meshStandardMaterial color="#3a5868" roughness={0.4} />
          </mesh>
          
          {/* ═══ NAGEOIRES PECTORALES — Ailettes latérales ═══ */}
          {[1, -1].map((side, si) => (
            <group key={si} position={[side * 0.16, -0.05, -0.15]} rotation={[0.1, 0, side * 0.7]}>
              <mesh>
                <boxGeometry args={[0.28, 0.025, 0.12]} />
                <meshStandardMaterial color="#3a5868" roughness={0.4} />
              </mesh>
              {/* Extrémité effilée */}
              <mesh position={[side * 0.12, 0, 0.02]}>
                <boxGeometry args={[0.08, 0.02, 0.08]} />
                <meshStandardMaterial color="#3a5868" roughness={0.4} />
              </mesh>
            </group>
          ))}
          
          {/* ═══ NAGEOIRE CAUDALE — Queue puissante ═══ */}
          <group position={[0, 0, 0.55]} rotation={[0.4, 0, 0]}>
            {/* Pédoncule caudal */}
            <mesh position={[0, 0, -0.08]}>
              <cylinderGeometry args={[0.08, 0.06, 0.25, 8]} rotation={[Math.PI/2, 0, 0]} />
              <meshStandardMaterial color="#4a6878" roughness={0.35} />
            </mesh>
            {/* Lobes de la queue - forme en croissant */}
            <mesh position={[0.12, 0, 0.08]} rotation={[0, 0.2, 0]}>
              <boxGeometry args={[0.2, 0.025, 0.15]} />
              <meshStandardMaterial color="#3a5868" roughness={0.4} />
            </mesh>
            <mesh position={[-0.12, 0, 0.08]} rotation={[0, -0.2, 0]}>
              <boxGeometry args={[0.2, 0.025, 0.15]} />
              <meshStandardMaterial color="#3a5868" roughness={0.4} />
            </mesh>
            {/* Encoche centrale */}
            <mesh position={[0, 0.01, 0.12]}>
              <boxGeometry args={[0.04, 0.03, 0.05]} />
              <meshStandardMaterial color="#3a5868" roughness={0.4} />
            </mesh>
          </group>
          
          {/* ═══ DÉTAILS ANATOMIQUES ═══ */}
          {/* Œil */}
          <mesh position={[0.1, 0.03, -0.35]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[-0.1, 0.03, -0.35]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          
          {/* Évent (blowhole) */}
          <mesh position={[0, 0.15, -0.2]}>
            <cylinderGeometry args={[0.025, 0.02, 0.02, 6]} />
            <meshStandardMaterial color="#2a3a48" />
          </mesh>
          
          {/* Sourire caractéristique - bouche */}
          <mesh position={[0, -0.02, -0.5]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.08, 0.008, 0.02]} />
            <meshStandardMaterial color="#2a3a48" />
          </mesh>
          
          {/* ═══ EFFET D'EAU — Splash au saut ═══ */}
          <mesh position={[0, -0.25, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[0.15, 0.4, 12]} />
            <meshStandardMaterial 
              color="#ffffff" 
              transparent 
              opacity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Plage Sud Animée — chars à voiles, personnages, parasols ───
function BeachLife({ night }) {
  const charsRef = useRef();
  const walkersRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Chars à voiles roulants
    if (charsRef.current) {
      charsRef.current.children.forEach((ch, i) => {
        const sp = 3 + i * 0.8;
        const range = 50;
        ch.position.x = -60 + ((t * sp + i * 18) % range);
        ch.rotation.y = 0.05;
      });
    }
    // Piétons marchant sur la plage
    if (walkersRef.current) {
      walkersRef.current.children.forEach((w, i) => {
        const sp = 1.2 + i * 0.3;
        w.position.x = -55 + ((t * sp + i * 12) % 45);
        w.position.y = -1.6 + Math.sin(t * 3 + i) * 0.03;
      });
    }
  });

  return (
    <group position={[0, 0, -36]}>
      {/* ═══ CHARS À VOILES roulants (4) ═══ */}
      <group ref={charsRef}>
        {[0, 1, 2, 3].map((i) => (
          <group key={`char-${i}`} position={[-40 + i * 12, -1.5, -2 + i * 1.5]} scale={[0.9, 0.9, 0.9]}>
            {/* Châssis */}
            <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.3, 0.08, 1.6]} /><meshStandardMaterial color="#e0e0e0" metalness={0.6} roughness={0.2} /></mesh>
            {/* Essieu + roues */}
            <mesh position={[0, 0.1, -0.6]}><boxGeometry args={[1.2, 0.06, 0.06]} /><meshStandardMaterial color="#888" metalness={0.7} /></mesh>
            {[-0.55, 0.55].map((wx, wi) => (
              <mesh key={`cw-${wi}`} position={[wx, 0.1, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 8]} /><meshStandardMaterial color="#1a1a1a" roughness={0.9} />
              </mesh>
            ))}
            <mesh position={[0, 0.1, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.06, 8]} /><meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </mesh>
            {/* Mât */}
            <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.02, 0.025, 1.5, 6]} /><meshStandardMaterial color="#c0c0c0" metalness={0.8} /></mesh>
            {/* Voile */}
            <mesh position={[0.3, 0.9, 0]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.6, 1.2, 0.02]} />
              <meshStandardMaterial color={['#FF4444', '#00AAFF', '#FFD700', '#44FF44'][i]} side={2} />
            </mesh>
            {/* Pilote assis */}
            <mesh position={[0, 0.25, 0.2]}><capsuleGeometry args={[0.05, 0.12, 4, 8]} /><meshStandardMaterial color={['#2c3e50', '#e74c3c', '#1abc9c', '#f39c12'][i]} /></mesh>
            <mesh position={[0, 0.45, 0.2]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#FDBCB4" /></mesh>
          </group>
        ))}
      </group>

      {/* ═══ PERSONNAGES PREMIUM sur la plage (8) ═══ */}
      <group ref={walkersRef}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <group key={`bw-${i}`} position={[-40 + i * 6, -1.6, 1 + (i % 3) * 2]}>
            <mesh position={[0, 0.35, 0]}><capsuleGeometry args={[0.07, 0.22, 4, 8]} /><meshStandardMaterial color={['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ff69b4'][i]} /></mesh>
            <mesh position={[0, 0.65, 0]}><sphereGeometry args={[0.07, 6, 6]} /><meshStandardMaterial color={['#FDBCB4', '#DEB887', '#C68642', '#F5DEB3', '#D2B48C', '#FDBCB4', '#CD853F', '#DEB887'][i]} /></mesh>
          </group>
        ))}
      </group>

      {/* ═══ 3 CHAISES HAUTES LIFEGUARD avec parasol + maître-nageur ═══ */}
      {[[-48, 5], [-20, 3], [6, 6]].map(([lx, lz], i) => (
        <group key={`tower-${i}`} position={[lx, -1.6, lz]}>
          {/* 4 pieds */}
          {[[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].map(([fx, fz], fi) => (
            <mesh key={`leg-${fi}`} position={[fx, 1.5, fz]}><cylinderGeometry args={[0.04, 0.05, 3, 6]} /><meshStandardMaterial color="#c0a060" roughness={0.7} /></mesh>
          ))}
          {/* Plateforme */}
          <mesh position={[0, 3, 0]}><boxGeometry args={[1.2, 0.1, 0.9]} /><meshStandardMaterial color="#c0a060" roughness={0.6} /></mesh>
          {/* Dossier */}
          <mesh position={[0, 3.4, -0.4]}><boxGeometry args={[1.1, 0.8, 0.06]} /><meshStandardMaterial color="#c0a060" roughness={0.6} /></mesh>
          {/* Parasol coloré */}
          <mesh position={[0, 4.2, 0]}><cylinderGeometry args={[0.03, 0.03, 1.2, 6]} /><meshStandardMaterial color="#c0c0c0" metalness={0.6} /></mesh>
          <mesh position={[0, 4.8, 0]} rotation={[0.05, i * 1.2, 0]}>
            <coneGeometry args={[1, 0.35, 8]} /><meshStandardMaterial color={['#FF4444', '#FFD700', '#00AAFF'][i]} side={2} />
          </mesh>
          {/* Maître-nageur assis */}
          <mesh position={[0, 3.35, 0]}><capsuleGeometry args={[0.08, 0.2, 4, 8]} /><meshStandardMaterial color={['#FF0000', '#FF6600', '#FF0000'][i]} /></mesh>
          <mesh position={[0, 3.65, 0]}><sphereGeometry args={[0.08, 6, 6]} /><meshStandardMaterial color="#FDBCB4" /></mesh>
          {/* Bouée de sauvetage accrochée */}
          <mesh position={[0.6, 2.4, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.15, 0.04, 8, 12]} /><meshStandardMaterial color="#FF4444" />
          </mesh>
          {/* Échelle */}
          {[0, 0.5, 1, 1.5, 2, 2.5].map((ey, ei) => (
            <mesh key={`rung-${ei}`} position={[0, ey + 0.2, 0.45]}><boxGeometry args={[0.5, 0.04, 0.04]} /><meshStandardMaterial color="#c0a060" roughness={0.6} /></mesh>
          ))}
        </group>
      ))}

      {/* ═══ 14 BOUÉES ZONE BAIGNADE reliées par cordes orange ═══ */}
      {(() => {
        const buoys = [];
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 1.4 - 0.3;
          const rx = 22, rz = 8;
          buoys.push({ x: -30 + Math.cos(angle) * rx, z: 9 + Math.sin(angle) * rz });
        }
        return (
          <group position={[0, -1.8, 0]}>
            {buoys.map((b, i) => (
              <group key={`buoy-${i}`} position={[b.x, 0.2, b.z]}>
                {/* Bouée sphérique */}
                <mesh><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color={i % 2 === 0 ? '#FF4444' : '#FFD700'} /></mesh>
                <mesh><torusGeometry args={[0.22, 0.06, 6, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
              </group>
            ))}
            {/* Cordes orange entre les bouées */}
            {buoys.map((b, i) => {
              if (i === buoys.length - 1) return null;
              const next = buoys[i + 1];
              const mx = (b.x + next.x) / 2, mz = (b.z + next.z) / 2;
              const dx = next.x - b.x, dz = next.z - b.z;
              const len = Math.sqrt(dx * dx + dz * dz);
              const angle = Math.atan2(dx, dz);
              return (
                <mesh key={`rope-${i}`} position={[mx, 0.1, mz]} rotation={[0, angle, 0]}>
                  <boxGeometry args={[0.03, 0.03, len]} />
                  <meshStandardMaterial color="#FF8C00" />
                </mesh>
              );
            })}
          </group>
        );
      })()}

      {/* ═══ 7 PERSONNAGES PREMIUM détaillés (jour uniquement) ═══ */}
      {!night && [
        { x: -46, z: 2, top: '#FF6B6B', bottom: '#2c3e50', skin: '#FDBCB4', acc: '#FFD700' },
        { x: -38, z: 4, top: '#4ECDC4', bottom: '#34495e', skin: '#DEB887', acc: '#FF6B6B' },
        { x: -30, z: 1, top: '#FFE66D', bottom: '#1a1a2e', skin: '#C68642', acc: '#4ECDC4' },
        { x: -22, z: 5, top: '#A8E6CF', bottom: '#2c3e50', skin: '#F5DEB3', acc: '#9b59b6' },
        { x: -14, z: 3, top: '#FF8B94', bottom: '#34495e', skin: '#D2B48C', acc: '#3498db' },
        { x: -6, z: 2, top: '#9b59b6', bottom: '#1a1a2e', skin: '#CD853F', acc: '#2ecc71' },
        { x: 4, z: 4, top: '#1abc9c', bottom: '#2c3e50', skin: '#FDBCB4', acc: '#e74c3c' },
      ].map((p, i) => (
        <group key={`pp-${i}`} position={[p.x, -1.55, p.z]}>
          {/* Jambes */}
          <mesh position={[-0.04, 0.18, 0]}><boxGeometry args={[0.06, 0.36, 0.06]} /><meshStandardMaterial color={p.bottom} /></mesh>
          <mesh position={[0.04, 0.18, 0]}><boxGeometry args={[0.06, 0.36, 0.06]} /><meshStandardMaterial color={p.bottom} /></mesh>
          {/* Torse */}
          <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.16, 0.28, 0.1]} /><meshStandardMaterial color={p.top} /></mesh>
          {/* Bras */}
          <mesh position={[-0.12, 0.48, 0]}><boxGeometry args={[0.05, 0.24, 0.05]} /><meshStandardMaterial color={p.skin} /></mesh>
          <mesh position={[0.12, 0.48, 0]}><boxGeometry args={[0.05, 0.24, 0.05]} /><meshStandardMaterial color={p.skin} /></mesh>
          {/* Tête */}
          <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color={p.skin} /></mesh>
          {/* Chapeau/lunettes */}
          <mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.1, 0.1, 0.04, 8]} /><meshStandardMaterial color={p.acc} /></mesh>
        </group>
      ))}

      {/* ═══ PARASOLS DE PLAGE (5) ═══ */}
      {[-45, -32, -18, -5, 8].map((x, i) => (
        <group key={`parasol-${i}`} position={[x, -1.5, 4 + (i % 2) * 2]}>
          <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.03, 0.04, 2.4, 6]} /><meshStandardMaterial color="#c0a060" roughness={0.7} /></mesh>
          <mesh position={[0, 2.4, 0]} rotation={[0.05, i * 0.5, 0]}>
            <coneGeometry args={[1.2, 0.4, 8]} /><meshStandardMaterial color={['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94'][i]} side={2} />
          </mesh>
        </group>
      ))}

      {/* ═══ TRANSATS + SERVIETTES (6) ═══ */}
      {[-42, -28, -14, 0, 10, -50].map((x, i) => (
        <group key={`transat-${i}`} position={[x, -1.65, 3 + (i % 2)]}>
          <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.7, 0.06, 1.4]} /><meshStandardMaterial color={['#1a5fa8', '#cc3333', '#2ecc71', '#f39c12', '#9b59b6', '#e74c3c'][i]} roughness={0.8} /></mesh>
          {[[-0.25, 0], [0.25, 0]].map(([lx, lz], li) => (
            <mesh key={`tl-${li}`} position={[lx, 0.02, lz]}><boxGeometry args={[0.04, 0.14, 0.04]} /><meshStandardMaterial color="#c0a060" roughness={0.7} /></mesh>
          ))}
        </group>
      ))}

      {/* ═══ CHÂTEAU DE SABLE ═══ */}
      <group position={[-25, -1.65, 2]}>
        <mesh position={[0, 0.2, 0]}><coneGeometry args={[0.5, 0.5, 6]} /><meshStandardMaterial color="#e8d4a0" roughness={0.95} /></mesh>
        <mesh position={[0.4, 0.15, 0.3]}><coneGeometry args={[0.3, 0.35, 6]} /><meshStandardMaterial color="#e0cc90" roughness={0.95} /></mesh>
        <mesh position={[-0.3, 0.12, -0.3]}><coneGeometry args={[0.25, 0.28, 6]} /><meshStandardMaterial color="#d8c488" roughness={0.95} /></mesh>
      </group>

      {/* ═══ BALLON DE PLAGE ═══ */}
      <group position={[-10, -1.35, 3]}>
        <mesh><sphereGeometry args={[0.25, 12, 12]} /><meshStandardMaterial color="#FF6B6B" /></mesh>
        <mesh rotation={[0, Math.PI / 4, 0]}><sphereGeometry args={[0.252, 12, 12]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.5} /></mesh>
      </group>

      {/* ═══ PLANCHE DE SURF ═══ */}
      <group position={[-48, -1.55, 5]} rotation={[0.8, 0.3, 0]}>
        <mesh><boxGeometry args={[0.5, 0.06, 2]} /><meshStandardMaterial color="#FFD700" roughness={0.6} /></mesh>
        <mesh position={[0, 0.01, -0.8]}><boxGeometry args={[0.12, 0.08, 0.3]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      </group>
    </group>
  );
}

// ─── Modern Floating Lounge — côté droit ──────────────
function SmallIsland({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const concreteColor = night ? '#c8ccd4' : '#f4f6fa';
  const sandColor = night ? '#a08860' : '#f0e0c0';
  const poolColor = night ? '#0a4060' : '#40b0d8';
  const glassBarrier = night ? '#2040608a' : '#b0d0e8';

  return (
    <group position={[55, -3, -20]}>
      {/* ═══ BANDE BÉTON BLANC — contour du resort ═══ */}
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[60, 0.8, 30]} /><meshStandardMaterial color={concreteColor} roughness={0.12} metalness={0.1} /></mesh>
      <mesh position={[0, 0.92, 0]}><boxGeometry args={[60.2, 0.04, 30.2]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.2 : 0.03} /></mesh>

      {/* ═══ SABLE DE PLAGE — zones recentrées pour éviter la longue bande beige sur la mer ═══ */}
      <mesh position={[0, 0.94, -4.2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[8.8, 20]} /><meshStandardMaterial color={sandColor} roughness={0.95} /></mesh>
      {[
        [-16.5, 0.94, -2.6, 5.2],
        [16.8, 0.94, -2.1, 4.8],
      ].map(([x, y, z, radius], i) => (
        <mesh key={`small-island-sand-patch-${i}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius, 18]} />
          <meshStandardMaterial color={sandColor} roughness={0.95} />
        </mesh>
      ))}

      {/* ═══ BARRIÈRES VITRÉES — côté terre et mer ═══ */}
      {/* Côté mer (devant) */}
      <mesh position={[0, 1.6, 15]}><boxGeometry args={[58, 1.2, 0.08]} /><meshPhysicalMaterial color={glassBarrier} transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
      {/* Côté terre (arrière) */}
      <mesh position={[0, 1.6, -15]}><boxGeometry args={[58, 1.2, 0.08]} /><meshPhysicalMaterial color={glassBarrier} transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
      {/* Côtés latéraux */}
      <mesh position={[30, 1.6, 0]}><boxGeometry args={[0.08, 1.2, 28]} /><meshPhysicalMaterial color={glassBarrier} transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
      <mesh position={[-30, 1.6, 0]}><boxGeometry args={[0.08, 1.2, 28]} /><meshPhysicalMaterial color={glassBarrier} transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
      {/* Entrées/Sorties (4 ouvertures) */}
      {[-15, 15].map((x, i) => (
        <group key={`gate-${i}`}>
          <mesh position={[x, 1.2, 15.1]}><boxGeometry args={[4, 0.3, 0.2]} /><meshStandardMaterial color={concreteColor} roughness={0.2} /></mesh>
          <mesh position={[x, 1.2, -15.1]}><boxGeometry args={[4, 0.3, 0.2]} /><meshStandardMaterial color={concreteColor} roughness={0.2} /></mesh>
        </group>
      ))}
      {night && [[-24, 14.8], [-12, 14.8], [0, 14.8], [12, 14.8], [24, 14.8], [-24, -14.8], [-12, -14.8], [0, -14.8], [12, -14.8], [24, -14.8]].map(([x, z], i) => (
        <group key={`edge-bollard-${i}`} position={[x, 1.02, z]}>
          <mesh position={[0, 0.24, 0]}><cylinderGeometry args={[0.05, 0.07, 0.48, 8]} /><meshStandardMaterial color="#d0d8df" metalness={0.88} roughness={0.08} /></mesh>
          <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.11, 8, 8]} /><meshStandardMaterial color="#9be8ff" emissive="#9be8ff" emissiveIntensity={1.7} /></mesh>
          <pointLight position={[0, 0.6, 0]} color={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} intensity={0.35} distance={4.2} />
        </group>
      ))}

      {/* ═══ PISCINE RECTANGULAIRE ═══ */}
      <group position={[-14, 0.9, -2]}>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[16, 8]} /><meshPhysicalMaterial color={poolColor} transparent opacity={0.75} roughness={0.01} metalness={0.2} /></mesh>
        {/* Bords piscine */}
        <mesh position={[0, 0.12, -4.1]}><boxGeometry args={[16.4, 0.24, 0.4]} /><meshStandardMaterial color={concreteColor} roughness={0.15} /></mesh>
        <mesh position={[0, 0.12, 4.1]}><boxGeometry args={[16.4, 0.24, 0.4]} /><meshStandardMaterial color={concreteColor} roughness={0.15} /></mesh>
        <mesh position={[-8.2, 0.12, 0]}><boxGeometry args={[0.4, 0.24, 8.4]} /><meshStandardMaterial color={concreteColor} roughness={0.15} /></mesh>
        <mesh position={[8.2, 0.12, 0]}><boxGeometry args={[0.4, 0.24, 8.4]} /><meshStandardMaterial color={concreteColor} roughness={0.15} /></mesh>
        {/* Échelle */}
        <mesh position={[7.8, 0.4, 0]}><boxGeometry args={[0.04, 0.8, 0.6]} /><meshStandardMaterial color="#c0c0c0" metalness={0.8} /></mesh>
      </group>

      {/* ═══ JARDIN ═══ */}
      <group position={[-14, 0.9, 8]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 6]} /><meshStandardMaterial color={night ? '#1a3a20' : '#4a8a50'} roughness={0.95} /></mesh>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.6, 2.4, 24]} /><meshStandardMaterial color={night ? '#2c3a30' : '#d9dccf'} roughness={0.84} /></mesh>
        {[-4, -1, 2, 5].map((x, i) => (
          <group key={`gp-${i}`} position={[x, 0, (i % 2) * 1.5 - 0.8]}>
            <mesh position={[0, 0.34, 0]}><sphereGeometry args={[0.82 + i * 0.08, 10, 10]} /><meshStandardMaterial color={['#2d7a2d', '#3a8a3a', '#228b22', '#2e8b2e'][i]} roughness={0.85} /></mesh>
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.42 + i * 0.03, 10, 10]} /><meshStandardMaterial color={['#317f31', '#419341', '#2c8f2c', '#329232'][i]} roughness={0.9} /></mesh>
          </group>
        ))}
        {[[-5.2, -2], [5.4, 2.1]].map(([x, z], i) => (
          <group key={`premium-palm-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 0.66, 0]} rotation={[0.08, 0, i === 0 ? -0.1 : 0.12]}><cylinderGeometry args={[0.18, 0.24, 1.32, 8]} /><meshStandardMaterial color="#9e6a37" roughness={0.84} /></mesh>
            {Array.from({ length: 6 }).map((_, leaf) => (
              <mesh key={`premium-palm-leaf-${leaf}`} position={[0, 1.34, 0]} rotation={[0.18 + (leaf % 2) * 0.08, (leaf * Math.PI) / 3, leaf % 2 === 0 ? 0.22 : -0.22]}>
                <coneGeometry args={[0.3, 1.6, 5]} />
                <meshStandardMaterial color={leaf % 2 === 0 ? '#2f8e46' : '#3ca454'} roughness={0.84} />
              </mesh>
            ))}
            {night && <pointLight position={[0, 0.42, 0]} color="#7ce7ff" intensity={0.18} distance={2.2} />}
          </group>
        ))}
      </group>

      {/* ═══ BUVETTE ═══ */}
      <group position={[14, 0.9, -6]}>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[6, 2.4, 4]} /><meshStandardMaterial color={night ? '#1a2030' : '#f0f4f8'} roughness={0.3} metalness={0.2} /></mesh>
        <mesh position={[0, 2.5, 0]}><boxGeometry args={[6.4, 0.12, 4.4]} /><meshStandardMaterial color="#1a5fa8" roughness={0.3} metalness={0.4} /></mesh>
        <mesh position={[0, 1.2, 2.05]}><boxGeometry args={[4.5, 1.8, 0.05]} /><meshPhysicalMaterial color={glassBarrier} transparent opacity={0.4} metalness={0.7} /></mesh>
        <Text position={[0, 2.8, 2.1]} fontSize={0.4} color={night ? '#00FFFF' : '#1a5fa8'} anchorX="center" fontWeight="bold">BAR PLAGE</Text>
        {night && <pointLight position={[0, 2.8, 1.8]} color="#7ce7ff" intensity={0.7} distance={8} />}
      </group>

      {/* ═══ PARASOLS BLANCS (8) ═══ */}
      {[[-6, 6], [0, 6], [6, 6], [12, 6], [18, 6], [24, 6], [-6, -8], [6, -8]].map(([x, z], i) => (
        <group key={`wp-${i}`} position={[x, 0.9, z]}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.03, 0.04, 3.2, 6]} /><meshStandardMaterial color="#c0c0c0" metalness={0.6} /></mesh>
          <mesh position={[0, 3.2, 0]} rotation={[0.04, i * 0.7, 0]}><coneGeometry args={[1.5, 0.4, 8]} /><meshStandardMaterial color="#ffffff" side={2} /></mesh>
        </group>
      ))}

      {/* ═══ TRANSATS (10) ═══ */}
      {[[-4, 5], [2, 5], [8, 5], [14, 5], [20, 5], [-4, -7], [2, -7], [8, -7], [14, -7], [20, -7]].map(([x, z], i) => (
        <group key={`trs-${i}`} position={[x, 0.95, z]}>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.8, 0.06, 1.6]} /><meshStandardMaterial color={['#1a5fa8', '#ffffff', '#cc3333', '#2ecc71', '#f39c12', '#ffffff', '#1a5fa8', '#cc3333', '#2ecc71', '#f39c12'][i]} roughness={0.7} /></mesh>
          {[-0.3, 0.3].map((lx, li) => <mesh key={`tl-${li}`} position={[lx, 0.04, 0]}><boxGeometry args={[0.04, 0.12, 0.04]} /><meshStandardMaterial color="#c0a060" /></mesh>)}
        </group>
      ))}

      {/* ═══ MOBILIER EXTÉRIEUR ULTRA-PREMIUM ═══ */}
      <group position={[-4, 0.94, -1.5]}>
        <mesh position={[0, 0.08, 0]}><boxGeometry args={[6.8, 0.12, 4.2]} /><meshStandardMaterial color={night ? '#d9e1e7' : '#f4f7fa'} roughness={0.18} metalness={0.08} /></mesh>
        {[-3, 3].map((x, i) => (
          <group key={`pergola-post-${i}`} position={[x, 1.6, -1.8]}>
            <mesh><boxGeometry args={[0.12, 3.2, 0.12]} /><meshStandardMaterial color="#f1f4f8" metalness={0.24} roughness={0.12} /></mesh>
          </group>
        ))}
        {[-3, 3].map((x, i) => (
          <group key={`pergola-post-back-${i}`} position={[x, 1.6, 1.8]}>
            <mesh><boxGeometry args={[0.12, 3.2, 0.12]} /><meshStandardMaterial color="#f1f4f8" metalness={0.24} roughness={0.12} /></mesh>
          </group>
        ))}
        <mesh position={[0, 3.22, 0]}><boxGeometry args={[6.4, 0.12, 4]} /><meshStandardMaterial color="#edf3f8" metalness={0.18} roughness={0.1} /></mesh>
        {[-2.4, -1.2, 0, 1.2, 2.4].map((x, i) => (
          <mesh key={`pergola-slat-${i}`} position={[x, 3.34, 0]}><boxGeometry args={[0.12, 0.06, 3.86]} /><meshStandardMaterial color={night ? '#d2dbe3' : '#ffffff'} metalness={0.22} roughness={0.12} /></mesh>
        ))}
        {[-1.6, 1.6].map((x, i) => (
          <group key={`daybed-${i}`} position={[x, 0.22, 0.4]}>
            <mesh position={[0, 0.18, 0]}><boxGeometry args={[1.5, 0.22, 2.1]} /><meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.06} /></mesh>
            <mesh position={[0, 0.52, -0.78]}><boxGeometry args={[1.5, 0.3, 0.16]} /><meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.06} /></mesh>
            <mesh position={[0, 0.36, 0.48]}><boxGeometry args={[1.2, 0.08, 0.72]} /><meshStandardMaterial color={i === 0 ? '#7ce7ff' : '#ffd870'} emissive={i === 0 ? '#7ce7ff' : '#ffd870'} emissiveIntensity={night ? 0.8 : 0.08} /></mesh>
          </group>
        ))}
      </group>
      <group position={[14, 0.96, 9.5]}>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[2.2, 2.4, 0.14, 24]} /><meshStandardMaterial color={night ? '#f0f4f8' : '#ffffff'} roughness={0.18} metalness={0.08} /></mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * 1.46;
          const z = Math.sin(angle) * 1.46;
          return (
            <group key={`circular-seat-${i}`} position={[x, 0.2, z]} rotation={[0, -angle + Math.PI / 2, 0]}>
              <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.76, 0.22, 0.56]} /><meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.06} /></mesh>
              <mesh position={[0, 0.44, -0.16]}><boxGeometry args={[0.76, 0.26, 0.14]} /><meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.06} /></mesh>
            </group>
          );
        })}
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.52, 0.52, 0.1, 18]} /><meshPhysicalMaterial color="#dff4ff" transmission={0.72} roughness={0.03} transparent opacity={0.35} /></mesh>
      </group>
      {[[10, -10], [24, -10]].map(([x, z], i) => (
        <group key={`design-brazier-${i}`} position={[x, 0.96, z]}>
          <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.34, 0.42, 0.18, 16]} /><meshStandardMaterial color={night ? '#3d444c' : '#cfd5dc'} metalness={0.42} roughness={0.22} /></mesh>
          <mesh position={[0, 0.34, 0]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#ffb35c" emissive="#ff7f2a" emissiveIntensity={night ? 1.8 : 0.16} transparent opacity={0.82} /></mesh>
          {night && <pointLight position={[0, 0.42, 0]} color="#ffb35c" intensity={0.24} distance={3.2} />}
        </group>
      ))}

      {/* ═══ JET SKIS POSÉS (4 gros) ═══ */}
      {[[18, 0], [22, -2], [24, 2], [20, 4]].map(([x, z], i) => (
        <group key={`jskr-${i}`} position={[x, 1, z]} rotation={[0, 0.4 * (i - 1.5), 0]} scale={[1.4, 1.4, 1.4]}>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.5, 0.22, 1.4]} /><meshStandardMaterial color={['#FF0040', '#00BFFF', '#FFD700', '#1abc9c'][i]} metalness={0.5} roughness={0.25} /></mesh>
          <mesh position={[0, 0.28, -0.2]}><boxGeometry args={[0.4, 0.18, 0.6]} /><meshStandardMaterial color="#1a1a2a" roughness={0.3} /></mesh>
          <mesh position={[0, 0.34, 0.4]}><boxGeometry args={[0.12, 0.28, 0.08]} /><meshStandardMaterial color="#333" metalness={0.7} /></mesh>
        </group>
      ))}

      {/* ═══ PERSONNAGES PREMIUM (6, jour uniquement) ═══ */}
      {!night && [[-2, 3], [4, -4], [10, 2], [16, -3], [22, 8], [-8, -2]].map(([x, z], i) => (
        <group key={`rp-${i}`} position={[x, 0.95, z]}>
          <mesh position={[0, 0.3, 0]}><capsuleGeometry args={[0.07, 0.2, 4, 8]} /><meshStandardMaterial color={['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#9b59b6'][i]} /></mesh>
          <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.07, 6, 6]} /><meshStandardMaterial color={['#FDBCB4', '#DEB887', '#C68642', '#F5DEB3', '#D2B48C', '#CD853F'][i]} /></mesh>
        </group>
      ))}

      {/* ═══ TOPIAIRES / MASSIFS — remplacement des arbres à tronc fin ═══ */}
      {[[-24, 8], [-24, -8], [26, 10], [26, -10]].map(([x, z], i) => (
        <group key={`rt-${i}`} position={[x, 0.9, z]}>
          <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.58, 0.66, 0.36, 12]} /><meshStandardMaterial color={night ? '#29422a' : '#4f8f54'} roughness={0.92} /></mesh>
          <mesh position={[0, 0.68, 0]}><sphereGeometry args={[0.88, 10, 10]} /><meshStandardMaterial color={night ? '#1a3020' : '#2d7a2d'} roughness={0.85} /></mesh>
          <mesh position={[0, 1.16, 0]}><sphereGeometry args={[0.62, 10, 10]} /><meshStandardMaterial color={night ? '#214125' : '#38883c'} roughness={0.85} /></mesh>
        </group>
      ))}
      {[[-28, 2], [28, 2]].map(([x, z], i) => (
        <group key={`sculpt-planter-${i}`} position={[x, 0.94, z]}>
          <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.76, 0.88, 0.34, 16]} /><meshStandardMaterial color={night ? '#394048' : '#dfe4e9'} roughness={0.38} metalness={0.08} /></mesh>
          <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.92, 12, 12]} /><meshStandardMaterial color={night ? '#24482a' : '#3f9647'} roughness={0.86} /></mesh>
          <mesh position={[0, 1.36, 0]}><sphereGeometry args={[0.48, 10, 10]} /><meshStandardMaterial color={night ? '#1f3e24' : '#2f7f39'} roughness={0.86} /></mesh>
        </group>
      ))}

      {/* ═══ LUMINAIRES ÎLE — bornes et lampadaires premium ═══ */}
      {[[-22, 4], [-10, 0], [2, 0], [14, 2], [24, -2], [-18, -6], [8, -8]].map(([x, z], i) => (
        <group key={`island-bollard-${i}`} position={[x, 0.92, z]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.07, 0.09, 0.6, 8]} /><meshStandardMaterial color="#d0d8df" metalness={0.86} roughness={0.08} /></mesh>
          <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#fff1c2" emissive="#fff1c2" emissiveIntensity={night ? 1.9 : 0.12} /></mesh>
          {night && <pointLight position={[0, 0.74, 0]} color={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} intensity={0.32} distance={4.8} />}
        </group>
      ))}
      {[[-6, 12], [10, 12], [22, 8]].map(([x, z], i) => (
        <group key={`island-lamp-${i}`} position={[x, 0.92, z]}>
          <mesh position={[0, 1.65, 0]}><cylinderGeometry args={[0.06, 0.08, 3.3, 8]} /><meshStandardMaterial color="#bcc6cf" metalness={0.82} roughness={0.1} /></mesh>
          <mesh position={[0, 3.34, 0]}><boxGeometry args={[0.58, 0.16, 0.18]} /><meshStandardMaterial color="#f8fbff" emissive="#fff1c2" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          {night && <pointLight position={[0, 3.26, 0]} color="#fff1c2" intensity={0.42} distance={6.2} />}
        </group>
      ))}
      {night && [[-20, -2], [-8, 6], [8, 6], [20, -2]].map(([x, z], i) => (
        <group key={`garden-uplight-${i}`} position={[x, 0.92, z]}>
          <mesh><boxGeometry args={[0.22, 0.08, 0.22]} /><meshStandardMaterial color="#f2f6fa" emissive="#a6e7ff" emissiveIntensity={2.2} /></mesh>
          <pointLight position={[0, 0.45, 0]} color={i % 2 === 0 ? '#a6e7ff' : '#fff1c2'} intensity={0.54} distance={7.4} />
        </group>
      ))}
      {night && [[-26, 14], [-12, 18], [8, 18], [24, 12]].map(([x, z], i) => (
        <group key={`beach-wash-${i}`} position={[x, 0.92, z]}>
          <mesh position={[0, 0.16, 0]} rotation={[-0.45, 0, 0]}><boxGeometry args={[0.34, 0.12, 0.22]} /><meshStandardMaterial color="#fff6da" emissive="#fff6da" emissiveIntensity={2.6} /></mesh>
          <pointLight position={[0, 0.52, 0.2]} color="#fff2c1" intensity={0.62} distance={9.2} />
        </group>
      ))}
      {[[ -6, 8 ], [ 6, 8 ], [ -6, -8 ], [ 6, -8 ], [ 0, 0 ]].map(([x, z], i) => (
        <group key={`landscape-light-${i}`} position={[x, 0.94, z]}>
          <mesh><boxGeometry args={[0.28, 0.06, 0.28]} /><meshStandardMaterial color="#dfe7ef" metalness={0.82} roughness={0.08} /></mesh>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.18, 0.03, 0.18]} /><meshStandardMaterial color="#9be8ff" emissive="#9be8ff" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          {night && <pointLight position={[0, 0.2, 0]} color={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} intensity={0.24} distance={3.4} />}
        </group>
      ))}

      {/* ═══ ÉCLAIRAGE SOL NOCTURNE ═══ */}
      {[[-26, 0], [-16, -12], [-16, 12], [0, -12], [0, 12], [16, -12], [16, 12], [26, 0]].map(([x, z], i) => (
        <mesh key={`rl-${i}`} position={[x, 0.94, z]}><boxGeometry args={[0.8, 0.04, 0.8]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 2.5 : 0.1} /></mesh>
      ))}
      {night && [[-20, 8.8], [-10, 9.2], [0, 8.8], [10, 9.1], [20, 8.8]].map(([x, z], i) => (
        <mesh key={`beach-strip-${i}`} position={[x, 0.94, z]}><boxGeometry args={[6, 0.04, 0.14]} /><meshStandardMaterial color="#ffd18a" emissive="#ffd18a" emissiveIntensity={0.9} /></mesh>
      ))}
    </group>
  );
}

// ─── Fishing Boat — petit bateau de pêche ───────────────────
function FishingBoat({ tod }) {
  const ref = useRef();
  const wakeRef = useRef();
  const positionRef = useRef(new THREE.Vector3(30, -2.2, 30));
  const velocityRef = useRef(new THREE.Vector3());
  const waypointIndexRef = useRef(0);
  const night = tod < 0.18 || tod > 0.82;
  const route = useMemo(() => ([
    new THREE.Vector3(30, -2.2, 30),
    new THREE.Vector3(10, -2.2, 36),
    new THREE.Vector3(-12, -2.2, 40),
    new THREE.Vector3(-36, -2.2, 38),
    new THREE.Vector3(-56, -2.2, 32),
    new THREE.Vector3(-36, -2.2, 26),
    new THREE.Vector3(-12, -2.2, 22),
    new THREE.Vector3(10, -2.2, 26),
  ]), []);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const current = positionRef.current;
    const activeTarget = route[waypointIndexRef.current];

    if (activeTarget) {
      const reached = steerSeaVehicle(current, velocityRef.current, activeTarget, delta, {
        speed: 0.28,
        sideBias: -1,
        arrivalRadius: 6,
        bounds: { minX: -70, maxX: 40, minZ: 18, maxZ: 50 },
      });
      if (reached) waypointIndexRef.current = (waypointIndexRef.current + 1) % route.length;
    }

    ref.current.position.x = current.x;
    ref.current.position.z = current.z;
    ref.current.position.y = -0.3 + Math.sin(t * 0.5) * 0.12;
    ref.current.rotation.z = Math.sin(t * 0.4) * 0.05;
    if (velocityRef.current.lengthSq() > 0.0001) {
      ref.current.rotation.y = Math.atan2(velocityRef.current.x, velocityRef.current.z);
    }
    if (wakeRef.current) {
      const wakeSpeed = Math.min(1, velocityRef.current.length() * 1.8);
      wakeRef.current.children.forEach((child, index) => {
        if (!child.material) return;
        child.material.opacity = 0.05 + wakeSpeed * 0.08 + Math.sin(t * 2 + index) * 0.012;
      });
    }
  });

  return (
    <group ref={ref} position={[-5, -1.5, 30]}>
      {/* Hull */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.4, 0.5, 3.5]} />
        <meshStandardMaterial color="#CC4400" roughness={0.65} />
      </mesh>
      {/* Hull bottom */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[1.1, 0.4, 3.3]} />
        <meshStandardMaterial color="#882200" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.38, 0]}><boxGeometry args={[1.46, 0.05, 3.52]} /><meshStandardMaterial color="#f4f7fa" metalness={0.18} roughness={0.08} /></mesh>
      {[-0.66, 0.66].map((x, i) => <mesh key={`fishing-rail-${i}`} position={[x, 0.52, 0.08]}><boxGeometry args={[0.04, 0.16, 2.9]} /><meshStandardMaterial color="#d8e0e7" metalness={0.86} roughness={0.1} /></mesh>)}
      {/* Cabin */}
      <mesh position={[-0.3, 0.65, -0.4]}>
        <boxGeometry args={[1.1, 0.85, 1.4]} />
        <meshStandardMaterial color="#FFFFF0" roughness={0.5} />
      </mesh>
      {/* Cabin roof */}
      <mesh position={[-0.3, 1.1, -0.4]}>
        <boxGeometry args={[1.15, 0.08, 1.45]} />
        <meshStandardMaterial color="#CC4400" roughness={0.6} />
      </mesh>
      {/* Mast / antenna */}
      <mesh position={[-0.3, 2.0, -0.4]}>
        <cylinderGeometry args={[0.02, 0.03, 2, 5]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      {/* Fishing rod */}
      <mesh position={[0.2, 0.5, 1.5]} rotation={[-0.4, 0, 0.2]}>
        <cylinderGeometry args={[0.012, 0.02, 2.8, 4]} />
        <meshStandardMaterial color="#5C3A1E" roughness={0.7} />
      </mesh>
      {/* Fishing line */}
      <mesh position={[0.6, -0.1, 2.2]} rotation={[0.6, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 1.5, 3]} />
        <meshStandardMaterial color="#DDD" transparent opacity={0.5} />
      </mesh>
      {/* Windows */}
      {[0.56, -0.56].map((wx, wi) => (
        <mesh key={wi} position={[wx, 0.7, -0.4]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshStandardMaterial color="#87CEEB" emissive="#FFD700" emissiveIntensity={night ? 1 : 0.05} transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, -1.08]}><boxGeometry args={[0.72, 0.24, 0.04]} /><meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={night ? 0.8 : 0.06} transparent opacity={0.82} /></mesh>
      <mesh position={[0, 0.22, 1.76]}><boxGeometry args={[0.22, 0.4, 0.22]} /><meshStandardMaterial color="#444b55" metalness={0.68} roughness={0.2} /></mesh>
      {night && <>
        <mesh position={[0.62, 0.56, -1.5]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2.6} /></mesh>
        <mesh position={[-0.62, 0.56, -1.5]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2.6} /></mesh>
        <mesh position={[0, 2.2, -0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} /></mesh>
      </>}
      <group ref={wakeRef} position={[0, -0.16, 2.2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.95, 4.2]} />
          <meshStandardMaterial color="#f4fbff" transparent opacity={0.08} />
        </mesh>
        <mesh position={[0.28, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, 0.18]}>
          <planeGeometry args={[0.42, 2.8]} />
          <meshStandardMaterial color="#e8f4fc" transparent opacity={0.06} />
        </mesh>
        <mesh position={[-0.28, 0.03, 0.9]} rotation={[-Math.PI / 2, 0, -0.18]}>
          <planeGeometry args={[0.42, 2.8]} />
          <meshStandardMaterial color="#e8f4fc" transparent opacity={0.06} />
        </mesh>
      </group>
    </group>
  );
}

// ─── COASTAL SHOPPING MALL — Centre commercial premium animé ────────────
function ShoppingMall({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const dusk = (tod > 0.74 && tod < 0.82) || (tod > 0.18 && tod < 0.26);
  const neonRef = useRef();
  const elevatorRef = useRef();
  const fountainRef = useRef();
  const peopleRef = useRef();
  const escalatorRef = useRef();

  const topBarRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Barre RGB du haut — transition fluide de couleurs
    if (topBarRef.current) {
      const whitePulse = 0.92 + Math.sin(t * 0.7) * 0.05;
      const icePulse = 0.96 + Math.sin(t * 0.9 + 0.6) * 0.04;
      topBarRef.current.material.color.setRGB(0.96 * whitePulse, 0.98 * whitePulse, 1.0 * icePulse);
      topBarRef.current.material.emissive.setRGB(0.88, 0.95, 1.0);
      topBarRef.current.material.emissiveIntensity = night ? 2.6 + Math.sin(t * 1.2) * 0.35 : 0.7;
    }
    // Neon signs pulsing
    if (neonRef.current) {
      neonRef.current.children.forEach((child, i) => {
        if (child.material?.emissiveIntensity !== undefined) {
          child.material.emissiveIntensity = night ? (3 + Math.sin(t * 2 + i * 0.8) * 1.5) : (dusk ? 1.5 : 0.3);
        }
      });
    }
    // Elevator going up and down
    if (elevatorRef.current) {
      elevatorRef.current.position.y = 2 + Math.sin(t * 0.3) * 6;
    }
    // Fountain water animation
    if (fountainRef.current) {
      fountainRef.current.children.forEach((drop, i) => {
        const phase = t * 3 + i * 0.4;
        const h = Math.max(0, Math.sin(phase) * 2);
        drop.position.y = 1 + h;
        drop.scale.setScalar(0.8 + Math.sin(phase) * 0.3);
        if (drop.material) drop.material.opacity = 0.5 + Math.sin(phase) * 0.3;
      });
    }
    // Walking people
    if (peopleRef.current) {
      peopleRef.current.children.forEach((person, i) => {
        const speed = 0.5 + i * 0.15;
        person.position.x = -12 + ((t * speed + i * 3) % 24);
        person.position.y = 0.6 + Math.sin(t * 4 + i) * 0.05;
      });
    }
    // Escalator steps
    if (escalatorRef.current) {
      escalatorRef.current.children.forEach((step, i) => {
        step.position.y = (i * 0.3 + t * 0.4) % 4;
      });
    }
  });

  return (
    <group position={[-18, 0.5, -72]}>
      {/* === MAIN BUILDING — 5 floors glass tower === */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[24, 20, 14]} />
        <meshPhysicalMaterial
          color={night ? '#f2f7ff' : dusk ? '#f7fbff' : '#ffffff'}
          emissive={night ? '#dbeaff' : '#f4f8ff'}
          emissiveIntensity={night ? 0.28 : 0.08}
          metalness={0.72}
          roughness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.04}
          transmission={0.05}
          transparent
          opacity={0.82}
        />
      </mesh>
      {/* Floor slabs */}
      {[0, 4, 8, 12, 16].map((y, i) => (
        <mesh key={i} position={[0, y + 0.5, 0]}>
          <boxGeometry args={[24.2, 0.18, 14.2]} />
          <meshStandardMaterial color={night ? '#eef4ff' : '#ffffff'} emissive={night ? '#d6e9ff' : '#f4f8ff'} emissiveIntensity={night ? 0.18 : 0.04} metalness={0.55} roughness={0.18} />
        </mesh>
      ))}
      {/* Véhicules réalistes garés à chaque étage */}
      {[0, 4, 8, 12, 16].map((floorY, fi) => {
        const carColors = ['#2c3e50', '#c0392b', '#2980b9', '#f39c12', '#1abc9c', '#8e44ad', '#e74c3c', '#ecf0f1'];
        return [-7, -3, 1, 5, 9].map((cx, ci) => (
          <group key={`car-f${fi}-c${ci}`} position={[cx, floorY + 1.1, fi % 2 === 0 ? 3.8 : -3.8]}>
            {/* Châssis bas */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2.2, 0.45, 1.1]} />
              <meshStandardMaterial color={carColors[(fi + ci) % carColors.length]} metalness={0.55} roughness={0.25} />
            </mesh>
            {/* Carrosserie haute */}
            <mesh position={[0.15, 0.42, 0]}>
              <boxGeometry args={[1.5, 0.5, 1.0]} />
              <meshStandardMaterial color={carColors[(fi + ci) % carColors.length]} metalness={0.55} roughness={0.25} />
            </mesh>
            {/* Toit */}
            <mesh position={[0.15, 0.7, 0]}>
              <boxGeometry args={[1.3, 0.08, 0.92]} />
              <meshStandardMaterial color={carColors[(fi + ci) % carColors.length]} metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Pare-brise avant */}
            <mesh position={[-0.45, 0.48, 0]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.5, 0.38, 0.88]} />
              <meshStandardMaterial color="#7ec8e3" transparent opacity={0.65} metalness={0.5} />
            </mesh>
            {/* Lunette arrière */}
            <mesh position={[0.75, 0.48, 0]} rotation={[0, 0, -0.25]}>
              <boxGeometry args={[0.42, 0.34, 0.84]} />
              <meshStandardMaterial color="#7ec8e3" transparent opacity={0.6} metalness={0.5} />
            </mesh>
            {/* Vitres latérales */}
            {[-0.52, 0.52].map((vz, vi) => (
              <mesh key={`vl-${vi}`} position={[0.15, 0.46, vz]}>
                <boxGeometry args={[1.2, 0.3, 0.04]} />
                <meshStandardMaterial color="#7ec8e3" transparent opacity={0.55} metalness={0.5} />
              </mesh>
            ))}
            {/* Phares avant */}
            {[-0.35, 0.35].map((lz, li) => (
              <mesh key={`ph-${li}`} position={[-1.11, 0.08, lz]}>
                <boxGeometry args={[0.06, 0.14, 0.22]} />
                <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={night ? 1.5 : 0.1} />
              </mesh>
            ))}
            {/* Feux arrière */}
            {[-0.35, 0.35].map((lz, li) => (
              <mesh key={`fa-${li}`} position={[1.11, 0.08, lz]}>
                <boxGeometry args={[0.06, 0.12, 0.18]} />
                <meshStandardMaterial color="#cc0000" emissive="#cc0000" emissiveIntensity={night ? 1.2 : 0.1} />
              </mesh>
            ))}
            {/* 4 pneus avec jantes */}
            {[[-0.72, -0.42], [-0.72, 0.42], [0.72, -0.42], [0.72, 0.42]].map(([wx, wz], wi) => (
              <group key={`pneu-${wi}`} position={[wx, -0.18, wz]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.18, 0.18, 0.14, 12]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
                </mesh>
                <mesh>
                  <cylinderGeometry args={[0.1, 0.1, 0.15, 8]} />
                  <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.15} />
                </mesh>
              </group>
            ))}
            {/* Pare-chocs */}
            <mesh position={[-1.12, -0.08, 0]}>
              <boxGeometry args={[0.06, 0.18, 1.0]} />
              <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[1.12, -0.08, 0]}>
              <boxGeometry args={[0.06, 0.18, 1.0]} />
              <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ));
      })}
      {/* Glass curtain wall — front (5 floors x 8 windows) */}
      {Array.from({ length: 5 }).map((_, floor) =>
        Array.from({ length: 8 }).map((_, w) => {
          const lit = night && Math.random() > 0.3;
          return (
            <mesh key={`f${floor}-w${w}`} position={[-10 + w * 2.8, floor * 4 + 2.5, 7.02]}>
              <planeGeometry args={[2.2, 3.2]} />
              <meshPhysicalMaterial
                color={night ? '#102744' : dusk ? '#d8e9f8' : '#ebf7ff'}
                metalness={0.92} roughness={0.04} transparent opacity={0.46}
                emissive={lit ? '#f8fbff' : night ? '#9ecbff' : '#d9f2ff'}
                emissiveIntensity={lit ? 1.35 : night ? 0.35 : 0.06}
              />
            </mesh>
          );
        })
      )}
      {/* Glass curtain wall — sides */}
      {Array.from({ length: 5 }).map((_, floor) =>
        Array.from({ length: 4 }).map((_, w) => (
          <mesh key={`side${floor}-${w}`} position={[12.02, floor * 4 + 2.5, -5 + w * 3.3]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.8, 3.2]} />
            <meshPhysicalMaterial
              color={night ? '#112845' : '#e7f4ff'} metalness={0.92} roughness={0.04}
              emissive={night ? '#8dbfff' : '#d9f2ff'}
              emissiveIntensity={night ? 0.28 : 0.04}
              transparent opacity={0.44}
            />
          </mesh>
        ))
      )}

      {/* === ENTRANCE CANOPY === */}
      <mesh position={[0, 2.5, 8.5]}>
        <boxGeometry args={[8, 0.2, 4]} />
        <meshPhysicalMaterial color="#f8fbff" emissive="#eef7ff" emissiveIntensity={night ? 0.24 : 0.06} metalness={0.8} roughness={0.06} transparent opacity={0.5} />
      </mesh>
      {/* Glass revolving door */}
      <mesh position={[0, 1.5, 8.5]}>
        <cylinderGeometry args={[1, 1, 3, 8]} />
        <meshPhysicalMaterial color="#e6f4ff" emissive="#bfe8ff" emissiveIntensity={night ? 0.35 : 0.08} transparent opacity={0.38} metalness={0.86} roughness={0.04} />
      </mesh>
      {/* Side entrance pillars */}
      {[-3.5, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 8.3]}>
          <cylinderGeometry args={[0.15, 0.2, 3, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#f3f8ff" emissiveIntensity={night ? 0.16 : 0.03} metalness={0.78} roughness={0.1} />
        </mesh>
      ))}

      {/* === GLASS ELEVATOR === */}
      <mesh position={[12.5, 10, 0]}>
        <boxGeometry args={[2.5, 20, 3.5]} />
        <meshPhysicalMaterial color="#eef7ff" emissive="#d4ebff" emissiveIntensity={night ? 0.25 : 0.05} transparent opacity={0.28} metalness={0.82} roughness={0.04} />
      </mesh>
      <mesh ref={elevatorRef} position={[12.5, 4, 0]}>
        <boxGeometry args={[1.8, 2.5, 2.8]} />
        <meshStandardMaterial color={night ? '#f4f8ff' : '#ffffff'} emissive={night ? '#dcecff' : '#f8fbff'} emissiveIntensity={night ? 0.14 : 0.04} metalness={0.7} roughness={0.15} />
      </mesh>
      {/* Elevator rails */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[12.5 + s * 0.95, 10, 0]}>
          <boxGeometry args={[0.06, 20, 0.06]} />
          <meshStandardMaterial color="#888888" metalness={0.8} />
        </mesh>
      ))}

      {/* === ESCALATORS (visible inside) === */}
      <group ref={escalatorRef} position={[-5, 0.5, 2]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[0, i * 0.3, -i * 0.3]}>
            <boxGeometry args={[1.5, 0.1, 0.35]} />
            <meshStandardMaterial color="#666666" metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* === ROOFTOP === */}
      <mesh position={[0, 20.12, 0]}>
        <boxGeometry args={[24.4, 0.32, 14.4]} />
        <meshStandardMaterial color="#fcfeff" emissive="#eef6ff" emissiveIntensity={night ? 0.22 : 0.05} metalness={0.58} roughness={0.14} />
      </mesh>
      {[-11.7, 11.7].map((x, i) => (
        <mesh key={`roof-side-parapet-${i}`} position={[x, 20.8, 0]}>
          <boxGeometry args={[0.32, 1.35, 14.1]} />
          <meshStandardMaterial color="#ffffff" emissive="#f1f7ff" emissiveIntensity={night ? 0.16 : 0.03} metalness={0.62} roughness={0.16} />
        </mesh>
      ))}
      {[-6.9, 6.9].map((z, i) => (
        <mesh key={`roof-front-parapet-${i}`} position={[0, 20.8, z]}>
          <boxGeometry args={[23.6, 1.35, 0.32]} />
          <meshStandardMaterial color="#ffffff" emissive="#f1f7ff" emissiveIntensity={night ? 0.16 : 0.03} metalness={0.62} roughness={0.16} />
        </mesh>
      ))}
      {[-11.15, 11.15].map((x, i) => (
        <mesh key={`roof-side-glass-${i}`} position={[x, 21.4, 0]}>
          <boxGeometry args={[0.06, 1.05, 12.7]} />
          <meshPhysicalMaterial color="#def2ff" emissive="#b9e6ff" emissiveIntensity={night ? 0.55 : 0.1} transparent opacity={0.38} metalness={0.86} roughness={0.04} />
        </mesh>
      ))}
      {[-6.4, 6.4].map((z, i) => (
        <mesh key={`roof-front-glass-${i}`} position={[0, 21.4, z]}>
          <boxGeometry args={[22.4, 1.05, 0.06]} />
          <meshPhysicalMaterial color="#def2ff" emissive="#b9e6ff" emissiveIntensity={night ? 0.55 : 0.1} transparent opacity={0.38} metalness={0.86} roughness={0.04} />
        </mesh>
      ))}
      <mesh position={[0, 20.42, 0]}>
        <boxGeometry args={[21.2, 0.2, 8.8]} />
        <meshStandardMaterial color="#edf5ef" roughness={0.9} />
      </mesh>
      {[
        [0, 20.56, -3.55, 20.2, 0.55, 1.55],
        [0, 20.56, 3.55, 20.2, 0.55, 1.55],
        [-8.65, 20.56, 0, 2.1, 0.55, 7.9],
        [8.65, 20.56, 0, 2.1, 0.55, 7.9],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={`roof-planter-${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={i < 2 ? '#6f9f59' : '#628f4f'} roughness={0.95} />
        </mesh>
      ))}
      {[[-7.2, -3.55], [-2.4, -3.55], [2.4, -3.55], [7.2, -3.55], [-7.2, 3.55], [-2.4, 3.55], [2.4, 3.55], [7.2, 3.55]].map(([x, z], i) => (
        <group key={`roof-shrub-${i}`} position={[x, 20.88, z]}>
          <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.34, 10, 10]} /><meshStandardMaterial color={i % 2 === 0 ? '#88b96b' : '#79ab5d'} roughness={0.94} /></mesh>
          <mesh position={[0.18, 0.16, 0.14]}><sphereGeometry args={[0.22, 10, 10]} /><meshStandardMaterial color="#95c676" roughness={0.94} /></mesh>
        </group>
      ))}
      {/* Passerelles vitrées latérales */}
      {[-6.2, 6.2].map((x, i) => (
        <group key={`roof-glass-walkway-${i}`} position={[x, 20.58, 0]}>
          <mesh>
            <boxGeometry args={[1.8, 0.08, 7.9]} />
            <meshPhysicalMaterial color="#e7f6ff" emissive="#c7ebff" emissiveIntensity={night ? 0.9 : 0.12} transparent opacity={0.42} metalness={0.88} roughness={0.04} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[1.84, 0.02, 8.02]} />
            <meshStandardMaterial color="#bfe9ff" emissive="#bfe9ff" emissiveIntensity={night ? 1.3 : 0.14} />
          </mesh>
        </group>
      ))}
      {/* Bassin miroir central */}
      <group position={[0, 20.52, 0]}>
        <mesh>
          <boxGeometry args={[7.2, 0.28, 4.6]} />
          <meshStandardMaterial color="#f8fbff" emissive="#eef7ff" emissiveIntensity={night ? 0.18 : 0.04} metalness={0.56} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[6.3, 0.12, 3.7]} />
          <meshPhysicalMaterial color="#92d7ff" emissive="#7fd3ff" emissiveIntensity={night ? 1.25 : 0.18} transparent opacity={0.62} metalness={0.92} roughness={0.03} />
        </mesh>
      </group>
      {/* Lounge blanc monumental */}
      <group position={[0, 20.78, -0.2]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[4.2, 0.18, 2.1]} />
          <meshStandardMaterial color="#ffffff" emissive="#f5fbff" emissiveIntensity={night ? 0.24 : 0.05} metalness={0.42} roughness={0.12} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[3.6, 0.42, 1.4]} />
          <meshStandardMaterial color="#ffffff" emissive="#f2f8ff" emissiveIntensity={night ? 0.2 : 0.04} metalness={0.34} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.82, -0.56]}>
          <boxGeometry args={[2.5, 0.34, 0.42]} />
          <meshStandardMaterial color="#ffffff" emissive="#eef6ff" emissiveIntensity={night ? 0.18 : 0.04} metalness={0.3} roughness={0.24} />
        </mesh>
        {[-1.35, 1.35].map((x, i) => (
          <mesh key={`lounge-arm-${i}`} position={[x, 0.56, 0]}>
            <boxGeometry args={[0.26, 0.55, 1.28]} />
            <meshStandardMaterial color="#fbfdff" emissive="#eef6ff" emissiveIntensity={night ? 0.16 : 0.03} metalness={0.28} roughness={0.22} />
          </mesh>
        ))}
      </group>
      {/* Pergola / verrière VIP */}
      <group position={[0, 21.35, 0]}>
        {[-2.2, -0.75, 0.75, 2.2].map((x, i) => (
          <mesh key={`pergola-post-${i}`} position={[x, 0.75, 0]}>
            <boxGeometry args={[0.12, 1.5, 0.12]} />
            <meshStandardMaterial color="#ffffff" emissive="#e8f4ff" emissiveIntensity={night ? 0.9 : 0.08} metalness={0.8} roughness={0.12} />
          </mesh>
        ))}
        <mesh position={[0, 1.56, 0]}>
          <boxGeometry args={[4.9, 0.1, 2.9]} />
          <meshPhysicalMaterial color="#e8f7ff" emissive="#cfeeff" emissiveIntensity={night ? 0.68 : 0.08} transparent opacity={0.34} metalness={0.9} roughness={0.04} />
        </mesh>
        {[-1.8, -0.9, 0, 0.9, 1.8].map((x, i) => (
          <mesh key={`pergola-rib-${i}`} position={[x, 1.62, 0]}>
            <boxGeometry args={[0.08, 0.06, 3.0]} />
            <meshStandardMaterial color="#ffffff" emissive="#dff1ff" emissiveIntensity={night ? 0.82 : 0.07} metalness={0.76} roughness={0.14} />
          </mesh>
        ))}
      </group>
      {/* Coins VIP avec daybeds et tables */}
      {[[-5.4, 20.82, -1.2], [5.4, 20.82, 1.2]].map(([x, y, z], i) => (
        <group key={`vip-corner-${i}`} position={[x, y, z]}>
          <mesh position={[0, 0.1, 0]}><boxGeometry args={[2.2, 0.16, 1.1]} /><meshStandardMaterial color="#ffffff" emissive="#eef7ff" emissiveIntensity={night ? 0.18 : 0.04} metalness={0.36} roughness={0.2} /></mesh>
          <mesh position={[0, 0.36, -0.2]}><boxGeometry args={[1.8, 0.26, 0.42]} /><meshStandardMaterial color="#ffffff" emissive="#edf5ff" emissiveIntensity={night ? 0.16 : 0.03} metalness={0.3} roughness={0.24} /></mesh>
          <mesh position={[0, 0.34, 0.42]}><cylinderGeometry args={[0.22, 0.24, 0.3, 12]} /><meshStandardMaterial color="#f8fbff" emissive="#dff1ff" emissiveIntensity={night ? 0.7 : 0.06} metalness={0.74} roughness={0.12} /></mesh>
          <mesh position={[0, 0.54, 0.42]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color="#b4e7ff" emissive="#9adfff" emissiveIntensity={night ? 1.4 : 0.12} /></mesh>
        </group>
      ))}
      {[[-9.4, 21.05, -4.7], [9.4, 21.05, -4.7], [-9.4, 21.05, 4.7], [9.4, 21.05, 4.7], [0, 21.05, -4.7], [0, 21.05, 4.7]].map(([x, y, z], i) => (
        <mesh key={`roof-lantern-${i}`} position={[x, y, z]}>
          <cylinderGeometry args={[0.16, 0.16, 0.22, 12]} />
          <meshStandardMaterial color="#eefbff" emissive={i % 2 === 0 ? '#dff2ff' : '#a8e4ff'} emissiveIntensity={night ? 2.2 : 0.18} />
        </mesh>
      ))}

      {/* === BARRE RGB EN HAUT DE FACADE === */}
      <mesh ref={topBarRef} position={[0, 18, 7.1]}>
        <boxGeometry args={[10, 1.2, 0.12]} />
        <meshStandardMaterial color="#f2f5ff" emissive="#f2f5ff" emissiveIntensity={0.4} />
      </mesh>

      {/* === NEON SIGNS — multiple === */}
      <group ref={neonRef}>
        <mesh position={[-9, 14, 7.1]}>
          <boxGeometry args={[4, 0.7, 0.1]} />
          <meshStandardMaterial color="#f7fbff" emissive="#d7eeff" emissiveIntensity={night ? 2.4 : 0.22} />
        </mesh>
        <mesh position={[9, 14, 7.1]}>
          <boxGeometry args={[4, 0.7, 0.1]} />
          <meshStandardMaterial color="#eef6ff" emissive="#cde7ff" emissiveIntensity={night ? 2.2 : 0.18} />
        </mesh>
        <mesh position={[-9, 6, 7.1]}>
          <boxGeometry args={[3.5, 0.6, 0.08]} />
          <meshStandardMaterial color="#fefefe" emissive="#e1f1ff" emissiveIntensity={night ? 2.1 : 0.16} />
        </mesh>
        <mesh position={[9, 6, 7.1]}>
          <boxGeometry args={[3.5, 0.6, 0.08]} />
          <meshStandardMaterial color="#f7fbff" emissive="#dff0ff" emissiveIntensity={night ? 2.1 : 0.16} />
        </mesh>
        {/* Vertical LED strip accents */}
        {[-12, 12].map((x, i) => (
          <mesh key={`led${i}`} position={[x, 10, 7.01]}>
            <boxGeometry args={[0.15, 18, 0.05]} />
            <meshStandardMaterial
              color="#f5fbff"
              emissive="#d7ecff"
              emissiveIntensity={night ? 2.25 : 0.14}
            />
          </mesh>
        ))}
      </group>

      {/* === LUXURY ANNEX — plus grande, plus haute, à gauche et plus loin === */}
      <group position={[-31.5, 0.4, -1.2]}>
        <mesh position={[0, 12.5, 0]}>
          <boxGeometry args={[18, 25, 12]} />
          <meshPhysicalMaterial color={night ? '#f3f8ff' : '#ffffff'} emissive={night ? '#deecff' : '#f6fbff'} emissiveIntensity={night ? 0.24 : 0.06} metalness={0.74} roughness={0.05} clearcoat={1} clearcoatRoughness={0.04} transmission={0.06} transparent opacity={0.78} />
        </mesh>
        {[0, 4.2, 8.4, 12.6, 16.8, 21].map((y, i) => (
          <mesh key={`annex-slab-${i}`} position={[0, y + 0.45, 0]}>
            <boxGeometry args={[18.3, 0.18, 12.3]} />
            <meshStandardMaterial color="#ffffff" emissive="#eff6ff" emissiveIntensity={night ? 0.14 : 0.03} metalness={0.58} roughness={0.16} />
          </mesh>
        ))}
        {Array.from({ length: 6 }).map((_, floor) =>
          Array.from({ length: 6 }).map((_, w) => (
            <mesh key={`annex-front-${floor}-${w}`} position={[-6.8 + w * 2.72, floor * 4.2 + 2.6, 6.02]}>
              <planeGeometry args={[2.15, 3.3]} />
              <meshPhysicalMaterial color={night ? '#112b48' : '#ebf7ff'} metalness={0.92} roughness={0.04} transparent opacity={0.42} emissive={night ? '#bfe0ff' : '#def2ff'} emissiveIntensity={night ? 0.42 : 0.06} />
            </mesh>
          ))
        )}
        {Array.from({ length: 6 }).map((_, floor) =>
          Array.from({ length: 4 }).map((_, w) => (
            <mesh key={`annex-side-${floor}-${w}`} position={[9.02, floor * 4.2 + 2.6, -4.3 + w * 2.9]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[2.4, 3.3]} />
              <meshPhysicalMaterial color={night ? '#112b48' : '#ebf7ff'} metalness={0.92} roughness={0.04} transparent opacity={0.4} emissive={night ? '#bfe0ff' : '#def2ff'} emissiveIntensity={night ? 0.34 : 0.05} />
            </mesh>
          ))
        )}
        {[-9.1, 9.1].map((x, i) => (
          <mesh key={`annex-edge-${i}`} position={[x, 12.5, 6.01]}>
            <boxGeometry args={[0.16, 23.4, 0.06]} />
            <meshStandardMaterial color="#f8fbff" emissive="#dceeff" emissiveIntensity={night ? 2.1 : 0.12} />
          </mesh>
        ))}
        <mesh position={[0, 22.7, 6.08]}>
          <boxGeometry args={[8.6, 0.9, 0.12]} />
          <meshStandardMaterial color="#f8fbff" emissive="#dceeff" emissiveIntensity={night ? 2.3 : 0.18} />
        </mesh>
        <mesh position={[0, 3.1, 7.5]}>
          <boxGeometry args={[7.8, 0.22, 3.5]} />
          <meshPhysicalMaterial color="#f8fbff" emissive="#e6f3ff" emissiveIntensity={night ? 0.2 : 0.05} metalness={0.82} roughness={0.05} transparent opacity={0.48} />
        </mesh>
        <mesh position={[0, 1.8, 7.35]}>
          <boxGeometry args={[4.2, 3.1, 0.2]} />
          <meshPhysicalMaterial color="#e5f3ff" emissive="#cde8ff" emissiveIntensity={night ? 0.36 : 0.08} transparent opacity={0.42} metalness={0.86} roughness={0.04} />
        </mesh>
        <mesh position={[0, 25.16, 0]}>
          <boxGeometry args={[18.4, 0.26, 12.4]} />
          <meshStandardMaterial color="#fcfeff" emissive="#edf5ff" emissiveIntensity={night ? 0.18 : 0.04} metalness={0.55} roughness={0.15} />
        </mesh>
        <mesh position={[0, 25.46, 0]}>
          <boxGeometry args={[15.8, 0.3, 8.6]} />
          <meshStandardMaterial color="#eef5ea" roughness={0.94} />
        </mesh>
        {[-5.4, -1.8, 1.8, 5.4].map((x, i) => (
          <group key={`annex-garden-${i}`} position={[x, 25.62, 0]}>
            <mesh><boxGeometry args={[2.6, 0.42, 7.8]} /><meshStandardMaterial color={i % 2 === 0 ? '#6d9e56' : '#7cac61'} roughness={0.95} /></mesh>
            {[-2.5, 0, 2.5].map((z, zi) => (
              <group key={`annex-tree-${i}-${zi}`} position={[0, 0.4, z]}>
                <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.06, 0.08, 0.42, 8]} /><meshStandardMaterial color="#7b5b3c" roughness={0.88} /></mesh>
                <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.3, 10, 10]} /><meshStandardMaterial color={zi % 2 === 0 ? '#88b96b' : '#78aa5d'} roughness={0.92} /></mesh>
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* Galerie vitrée de liaison premium */}
      <group position={[-18.5, 8.4, -0.2]}>
        <mesh>
          <boxGeometry args={[7.8, 2.2, 3.6]} />
          <meshPhysicalMaterial color="#ecf7ff" emissive="#cde9ff" emissiveIntensity={night ? 0.28 : 0.06} transparent opacity={0.32} metalness={0.9} roughness={0.04} />
        </mesh>
        {[-3.8, -1.3, 1.3, 3.8].map((x, i) => (
          <mesh key={`gallery-rib-${i}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.1, 2.4, 3.8]} />
            <meshStandardMaterial color="#ffffff" emissive="#e4f1ff" emissiveIntensity={night ? 0.9 : 0.08} metalness={0.74} roughness={0.12} />
          </mesh>
        ))}
      </group>

      {/* === PARKING LOT — more cars === */}
      {[
        [-9, 0.3, 11], [-5, 0.3, 11], [-1, 0.3, 11], [3, 0.3, 11], [7, 0.3, 11],
        [-9, 0.3, 14], [-5, 0.3, 14], [-1, 0.3, 14], [3, 0.3, 14], [7, 0.3, 14],
      ].map(([cx, cy, cz], i) => {
        const colors = ['#cc0000', '#0066cc', '#333333', '#ffffff', '#FFD700', '#1a1a1a', '#0088aa', '#880044', '#446600', '#aa4400'];
        return (
          <group key={i} position={[cx, cy, cz]}>
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[1.4, 0.4, 2.8]} />
              <meshStandardMaterial color={colors[i]} metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.55, -0.2]}>
              <boxGeometry args={[1.2, 0.3, 1.4]} />
              <meshStandardMaterial color={colors[i]} metalness={0.7} roughness={0.2} />
            </mesh>
            {night && (
              <>
                <mesh position={[0, 0.3, -1.42]}>
                  <boxGeometry args={[1, 0.06, 0.02]} />
                  <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
                </mesh>
                <mesh position={[0, 0.3, 1.42]}>
                  <boxGeometry args={[0.8, 0.06, 0.02]} />
                  <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* === FOUNTAIN in plaza === */}
      <mesh position={[0, 0.2, 15]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.5, 2.8, 0.4, 24]} />
        <meshStandardMaterial color="#90a0b0" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 15]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.1, 24]} />
        <meshStandardMaterial color="#3388cc" transparent opacity={0.6} />
      </mesh>
      <group ref={fountainRef} position={[0, 0.5, 15]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 0.6, 1, Math.sin(i * Math.PI / 4) * 0.6]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshStandardMaterial color="#88ccff" transparent opacity={0.6} emissive="#3388cc" emissiveIntensity={night ? 1 : 0} />
          </mesh>
        ))}
      </group>

      {/* === WALKING PEOPLE === */}
      <group ref={peopleRef} position={[0, 0, 10]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <group key={i} position={[-10 + i * 3, 0.6, Math.random() * 4]}>
            <mesh position={[0, 0.3, 0]}>
              <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
              <meshStandardMaterial color={['#2a2a3a', '#3a1a2a', '#1a2a3a', '#2a3a1a', '#3a2a1a', '#1a3a2a', '#2a1a3a', '#3a3a1a'][i]} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshStandardMaterial color="#FDBCB4" />
            </mesh>
          </group>
        ))}
      </group>

      {/* === PLAZA === */}
      <mesh position={[0, -0.1, 12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 12]} />
        <meshStandardMaterial color={night ? '#2a2a30' : '#c0c0c0'} roughness={0.85} />
      </mesh>
      {/* Benches */}
      {[-8, -3, 3, 8].map((x, i) => (
        <group key={i} position={[x, 0, 12.5]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.5, 0.08, 0.5]} />
            <meshStandardMaterial color="#1a5276" roughness={0.5} />
          </mesh>
          {[-0.6, 0.6].map((lx, li) => (
            <mesh key={li} position={[lx, 0.15, 0]}>
              <boxGeometry args={[0.06, 0.3, 0.4]} />
              <meshStandardMaterial color="#444444" metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Street lamps — premium double-head design */}
      {[-11, -5, 0, 5, 11].map((x, i) => (
        <group key={i} position={[x, 0, 17]}>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 5, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} />
          </mesh>
          {/* Double lamp heads */}
          {[-0.4, 0.4].map((lx, li) => (
            <group key={li}>
              <mesh position={[lx, 5, 0]}>
                <cylinderGeometry args={[0.03, 0.01, 0.3, 6]} />
                <meshStandardMaterial color="#555555" metalness={0.7} />
              </mesh>
              <mesh position={[lx, 5.2, 0]}>
                <sphereGeometry args={[0.15, 8, 8]} />
                <meshStandardMaterial color="#ffffdd" emissive="#FFD700" emissiveIntensity={night ? 4 : dusk ? 2 : 0} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* Trees in plaza */}
      {[-6, 6, -2, 10].map((x, i) => (
        <group key={i} position={[x, 0, 15.5]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 3, 6]} />
            <meshStandardMaterial color="#4a3020" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <sphereGeometry args={[1.2, 8, 8]} />
            <meshStandardMaterial color={night ? '#1a3a1a' : '#2a6a2a'} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* === SECONDARY BUILDING (adjacent boutique wing) === */}
      <mesh position={[-16, 4.5, 0]}>
        <boxGeometry args={[6, 9, 10]} />
        <meshStandardMaterial color={night ? '#1a1a30' : '#b0b8c8'} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Boutique windows */}
      {Array.from({ length: 3 }).map((_, w) => (
        <mesh key={w} position={[-13.02, w * 3 + 2, 0]}>
          <planeGeometry args={[5, 2.5]} />
          <meshPhysicalMaterial
            color={night ? '#1a2a4a' : '#a0c8e8'}
            transparent opacity={0.5} metalness={0.9} roughness={0.05}
            emissive={night ? '#FFD700' : '#000000'} emissiveIntensity={night ? 0.3 : 0}
          />
        </mesh>
      ))}

      {/* === STRONG NIGHT LIGHTING === */}
      {night && (
        <>
        </>
      )}
    </group>
  );
}

// ─── MOTOCROSS TRACK — Circuit animé avec riders ────────────
function MarinaBuildingSeaLevel({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const fishRef = useRef();
  const signRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Poissons dans les aquariums
    if (fishRef.current) {
      fishRef.current.children.forEach((fish, i) => {
        const sp = 0.8 + i * 0.15;
        const rx = 2.5 + (i % 3) * 0.8;
        fish.position.x = Math.sin(t * sp + i * 1.2) * rx;
        fish.position.z = Math.cos(t * sp * 0.7 + i * 0.9) * rx;
        fish.position.y = 0.4 + Math.sin(t * sp * 1.3 + i) * 0.3;
        fish.rotation.y = Math.atan2(Math.cos(t * sp + i * 1.2), -Math.sin(t * sp * 0.7 + i * 0.9));
      });
    }
    // Enseigne lumineuse pulsante
    if (signRef.current && signRef.current.material) {
      signRef.current.material.emissiveIntensity = night ? 3 + Math.sin(t * 1.5) * 1 : 0.4;
    }
  });

  return (
    <group position={[38, -3, -12]}>
      {/* ═══ FONDATION — Plateforme béton au niveau de la mer ═══ */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[34, 1.2, 26]} />
        <meshStandardMaterial color={night ? '#d0d4dc' : '#f2f4f8'} roughness={0.15} metalness={0.1} />
      </mesh>
      {/* Bord lumineux plateforme */}
      <mesh position={[0, 1.42, 0]}>
        <boxGeometry args={[34.2, 0.04, 26.2]} />
        <meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.8 : 0.1} />
      </mesh>

      {/* ═══ BÂTIMENT PRINCIPAL — 3 étages vitrés ═══ */}
      {[0, 5.2, 10.4].map((floorY, fi) => (
        <group key={`marina-floor-${fi}`} position={[0, floorY + 1.8, 0]}>
          {/* Dalle béton */}
          <mesh><boxGeometry args={[26, 0.22, 20]} /><meshStandardMaterial color={night ? '#c4c8d0' : '#eaf0f6'} roughness={0.2} metalness={0.15} /></mesh>
          {/* Façade vitrée — 4 faces */}
          <mesh position={[0, 2.4, 10.04]}><boxGeometry args={[25.5, 4.6, 0.08]} /><meshPhysicalMaterial color={night ? '#081828' : '#90c0e0'} metalness={0.88} roughness={0.03} transparent opacity={0.42} /></mesh>
          <mesh position={[0, 2.4, -10.04]}><boxGeometry args={[25.5, 4.6, 0.08]} /><meshPhysicalMaterial color={night ? '#081828' : '#90c0e0'} metalness={0.88} roughness={0.03} transparent opacity={0.42} /></mesh>
          <mesh position={[13.04, 2.4, 0]}><boxGeometry args={[0.08, 4.6, 19.8]} /><meshPhysicalMaterial color={night ? '#081828' : '#90c0e0'} metalness={0.88} roughness={0.03} transparent opacity={0.42} /></mesh>
          <mesh position={[-13.04, 2.4, 0]}><boxGeometry args={[0.08, 4.6, 19.8]} /><meshPhysicalMaterial color={night ? '#081828' : '#90c0e0'} metalness={0.88} roughness={0.03} transparent opacity={0.42} /></mesh>
          {/* Montants béton */}
          {[-12.5, -6, 0, 6, 12.5].map((x, ci) => (
            <mesh key={`mc-${ci}`} position={[x, 2.4, 0]}><boxGeometry args={[0.32, 4.8, 0.32]} /><meshStandardMaterial color={night ? '#b4b8c0' : '#dce2e8'} roughness={0.3} metalness={0.2} /></mesh>
          ))}
          {/* Aquarium intégré à chaque étage */}
          <mesh position={[0, 1.8, 0]}><boxGeometry args={[8, 2.8, 6]} /><meshPhysicalMaterial color="#0a4a6a" transmission={0.7} transparent opacity={0.32} roughness={0.02} ior={1.4} /></mesh>
          <mesh position={[0, 1.8, 0]}><boxGeometry args={[7.6, 2.5, 5.6]} /><meshPhysicalMaterial color="#1a8ab8" transparent opacity={0.28} roughness={0.01} /></mesh>
          {/* Poissons animés (premier étage seulement) */}
          {fi === 0 && (
            <group ref={fishRef} position={[0, 1.8, 0]}>
              {[0,1,2,3,4,5,6,7].map((fi2) => (
                <mesh key={`fish-${fi2}`}><coneGeometry args={[0.08, 0.3, 4]} /><meshStandardMaterial color={['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff8fab','#a0ced9','#e8a87c','#c38fff'][fi2]} /></mesh>
              ))}
            </group>
          )}
          {/* Coraux */}
          {[-2.5, -1, 0.5, 2, 3.2].map((cx, pi) => (
            <mesh key={`cr-${pi}`} position={[cx, 0.5, (pi % 2 === 0 ? 1.5 : -1.5)]}><coneGeometry args={[0.15 + pi * 0.03, 0.5 + pi * 0.08, 5]} /><meshStandardMaterial color={['#2ecc71','#1abc9c','#27ae60','#16a085','#2ecc71'][pi]} roughness={0.8} /></mesh>
          ))}
          {/* Balcons vitrés */}
          {[-1, 1].map((side, bi) => (
            <group key={`bal-${bi}`} position={[side * 14.2, 1.8, 0]}>
              <mesh><boxGeometry args={[2.4, 0.12, 18]} /><meshStandardMaterial color={night ? '#c4c8d0' : '#eaf0f6'} roughness={0.2} metalness={0.15} /></mesh>
              <mesh position={[side * 1, 0.55, 0]}><boxGeometry args={[0.06, 1.1, 18]} /><meshPhysicalMaterial color="#b0d0e8" transparent opacity={0.3} metalness={0.8} roughness={0.05} /></mesh>
              {[-8, -4, 0, 4, 8].map((pz, pri) => (
                <mesh key={`bpost-${pri}`} position={[side * 1, 0.55, pz]}><cylinderGeometry args={[0.03, 0.03, 1.1, 6]} /><meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.1} /></mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* ═══ TOUR CENTRALE — structure distinctive ═══ */}
      <group position={[0, 17.4, 0]}>
        <mesh position={[0, 3, 0]}><cylinderGeometry args={[2.2, 2.8, 6, 12]} /><meshPhysicalMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.85 : 0.28} metalness={0.6} roughness={0.12} transparent opacity={0.78} /></mesh>
        <mesh position={[0, 6.2, 0]}><cylinderGeometry args={[1.6, 2.2, 1.2, 12]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.9 : 0.34} metalness={0.5} roughness={0.16} /></mesh>
        {/* Antenne */}
        <mesh position={[0, 7.8, 0]}><cylinderGeometry args={[0.06, 0.06, 2.8, 6]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.7 : 0.2} metalness={0.8} roughness={0.15} /></mesh>
        <mesh position={[0, 9.4, 0]}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={night ? 4 : 0.5} /></mesh>
      </group>

      {/* ═══ ENSEIGNE LUMINEUSE BLEUE "MARINA" ═══ */}
      <mesh ref={signRef} position={[0, 17, 10.1]}>
        <boxGeometry args={[10, 1.4, 0.12]} />
        <meshStandardMaterial color="#1a5fa8" emissive="#1a8aff" emissiveIntensity={night ? 3.5 : 0.4} />
      </mesh>
      <Text position={[0, 17, 10.2]} rotation={[0, 0, 0]} fontSize={0.9} color="#ffffff" anchorX="center" fontWeight="bold">MARINA</Text>

      {/* ═══ BOLLARDS D'AMARRAGE (8) ═══ */}
      {[-14, -10, -6, -2, 2, 6, 10, 14].map((x, i) => (
        <group key={`bollard-${i}`} position={[x, 1.4, 13.2]}>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.18, 0.22, 0.5, 8]} /><meshStandardMaterial color={night ? '#606870' : '#808890'} metalness={0.7} roughness={0.2} /></mesh>
          <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.25, 0.18, 0.12, 8]} /><meshStandardMaterial color={night ? '#707880' : '#a0a8b0'} metalness={0.7} roughness={0.2} /></mesh>
          {/* LED de bollard */}
          <mesh position={[0, 0.64, 0]}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 2.5 : 0.15} /></mesh>
        </group>
      ))}

      {/* ═══ TOIT VÉGÉTAL ═══ */}
      <group position={[0, 17.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[22, 16]} /><meshStandardMaterial color={night ? '#1a3a20' : '#4a8a50'} roughness={0.95} /></mesh>
        {[[-6, 4], [-2, -4], [3, 3], [7, -3], [-8, -2], [5, 5]].map(([px, pz], pi) => (
          <group key={`rp-${pi}`} position={[px, 0.1, pz]}>
            <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.6 + pi * 0.04, 8, 8]} /><meshStandardMaterial color={['#2d7a2d','#3a8a3a','#228b22','#2e8b2e','#1e7a1e','#2d8a2d'][pi]} roughness={0.85} /></mesh>
            <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.06, 0.08, 0.3, 6]} /><meshStandardMaterial color="#654321" roughness={0.9} /></mesh>
          </group>
        ))}
      </group>

      {/* ═══ ÉCLAIRAGE NOCTURNE — spots encastrés + lampadaires ═══ */}
      {[[-15, -11], [-15, 0], [-15, 11], [15, -11], [15, 0], [15, 11], [-8, 13], [0, 13], [8, 13], [-8, -13], [0, -13], [8, -13]].map(([lx, lz], li) => (
        <mesh key={`glight-${li}`} position={[lx, 1.44, lz]}><boxGeometry args={[0.8, 0.04, 0.8]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 2.5 : 0.12} /></mesh>
      ))}
      {night && [[-15, -11], [-15, 0], [-15, 11], [15, -11], [15, 0], [15, 11], [-8, 13], [0, 13], [8, 13], [-8, -13], [0, -13], [8, -13]].map(([lx, lz], li) => (
        <pointLight key={`glight-spill-${li}`} position={[lx, 1.9, lz]} color={li % 2 === 0 ? '#a6e7ff' : '#fff2c1'} intensity={0.42} distance={7.8} />
      ))}
      {/* Lampadaires périmètre */}
      {[[-16, -12], [-16, 12], [16, -12], [16, 12]].map(([lx, lz], i) => (
        <group key={`mlamp-${i}`} position={[lx, 1.4, lz]}>
          <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.04, 0.06, 5, 6]} /><meshStandardMaterial color="#c0c8d0" metalness={0.7} roughness={0.15} /></mesh>
          <mesh position={[0.3, 5.1, 0]}><boxGeometry args={[0.6, 0.08, 0.15]} /><meshStandardMaterial color="#f0f0e8" emissive="#ffe8a0" emissiveIntensity={night ? 3.5 : 0.3} /></mesh>
        </group>
      ))}

      {/* Waterfront premium — promenade, terrasses et pontons */}
      <mesh position={[0, 1.46, 18.6]}><boxGeometry args={[28, 0.18, 4.6]} /><meshStandardMaterial color={night ? '#d9e2ea' : '#f8fbff'} roughness={0.22} metalness={0.18} /></mesh>
      <mesh position={[0, 1.56, 18.6]}><boxGeometry args={[27.4, 0.05, 4.1]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 1.3 : 0.08} /></mesh>
      {[-9, 0, 9].map((x, i) => (
        <group key={`marina-terrace-${i}`} position={[x, 1.5, 20.2]}>
          <mesh position={[0, 0.86, 0]}><cylinderGeometry args={[0.82, 0.88, 0.12, 14]} /><meshStandardMaterial color="#f5f8fb" roughness={0.16} /></mesh>
          <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.08, 0.1, 0.8, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.82} roughness={0.08} /></mesh>
          {[-1.1, 1.1].map((cx, ci) => (
            <mesh key={`marina-chair-${ci}`} position={[cx, 0.48, 0.1]}><boxGeometry args={[0.5, 0.85, 0.5]} /><meshStandardMaterial color={i % 2 === 0 ? '#d7f4ff' : '#ffebc0'} roughness={0.28} /></mesh>
          ))}
        </group>
      ))}
      {[-11.5, 11.5].map((x, i) => (
        <group key={`marina-pontoon-${i}`} position={[x, 0.9, 25.6]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[3.2, 0.22, 9]} /><meshStandardMaterial color={night ? '#dce5ed' : '#f5f8fb'} roughness={0.22} metalness={0.18} /></mesh>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[2.9, 0.04, 8.7]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 1.1 : 0.08} /></mesh>
          {night && [-3.2, 0, 3.2].map((z, zi) => (
            <pointLight key={`marina-pontoon-light-${zi}`} position={[0, 0.55, z]} color={zi % 2 === 0 ? '#7ce7ff' : '#ffd870'} intensity={0.18} distance={2.8} />
          ))}
        </group>
      ))}
      {night && [[-12, 18.6], [0, 18.6], [12, 18.6], [-12, 23.8], [0, 23.8], [12, 23.8]].map(([x, z], i) => (
        <pointLight key={`promenade-wash-${i}`} position={[x, 2.0, z]} color={i % 2 === 0 ? '#fff2c1' : '#a6e7ff'} intensity={0.46} distance={8.8} />
      ))}

      {/* Club nautique premium */}
      <group position={[-20, 1.5, 18.8]}>
        <mesh position={[0, 2.4, 0]}><boxGeometry args={[10, 4.8, 6.4]} /><meshPhysicalMaterial color={night ? '#1d2c3b' : '#f7fbff'} transparent opacity={0.72} metalness={0.42} roughness={0.08} /></mesh>
        <mesh position={[0, 5.05, 0]}><boxGeometry args={[10.8, 0.24, 7]} /><meshStandardMaterial color={night ? '#273645' : '#ffffff'} roughness={0.16} metalness={0.22} /></mesh>
        <mesh position={[0, 3.2, 3.24]}><boxGeometry args={[6.8, 0.9, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#7ce7ff" emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
        <Text position={[0, 3.24, 3.38]} fontSize={0.42} color="#ffffff" anchorX="center" fontWeight="bold">YACHT CLUB</Text>
      </group>

      {/* Restaurant flottant */}
      <group position={[19, 0.86, 31]}>
        <mesh><boxGeometry args={[11, 0.42, 7]} /><meshStandardMaterial color={night ? '#dce5ed' : '#f7fbff'} roughness={0.22} metalness={0.18} /></mesh>
        <mesh position={[0, 1.8, 0]}><boxGeometry args={[9.2, 3.2, 5.6]} /><meshPhysicalMaterial color={night ? '#233545' : '#fff7ef'} transparent opacity={0.7} metalness={0.36} roughness={0.08} /></mesh>
        <mesh position={[0, 3.6, 0]}><boxGeometry args={[9.8, 0.2, 6.2]} /><meshStandardMaterial color={night ? '#304050' : '#ffffff'} roughness={0.16} metalness={0.24} /></mesh>
        <mesh position={[0, 2.5, 2.86]}><boxGeometry args={[6.5, 0.85, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#ffd870" emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
        <Text position={[0, 2.54, 3.02]} fontSize={0.4} color="#ffffff" anchorX="center" fontWeight="bold">SEA DINING</Text>
        {night && <pointLight position={[0, 2.8, 0]} color="#ffd870" intensity={0.28} distance={6} />}
      </group>

      {/* Passerelles premium vers les pontons */}
      {[-11.5, 11.5].map((x, i) => (
        <group key={`premium-gangway-${i}`} position={[x, 1.48, 23.2]} rotation={[0, 0, 0]}>
          <mesh><boxGeometry args={[2.2, 0.12, 4]} /><meshStandardMaterial color={night ? '#e0e8ef' : '#fbfdff'} roughness={0.18} metalness={0.18} /></mesh>
          <mesh position={[0, 0.1, 0]}><boxGeometry args={[1.9, 0.04, 3.7]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
        </group>
      ))}

      {/* Signalétique maritime de luxe */}
      {[-14, 0, 14].map((x, i) => (
        <group key={`maritime-sign-${i}`} position={[x, 1.5, 16.5]}>
          <mesh position={[0, 1.8, 0]}><boxGeometry args={[0.14, 3.6, 0.14]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
          <mesh position={[0, 4.1, 0]}><boxGeometry args={[3.8, 0.82, 0.12]} /><meshStandardMaterial color="#17324f" emissive={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          <Text position={[0, 4.14, 0.14]} fontSize={0.28} color="#ffffff" anchorX="center" fontWeight="bold">{['DOCK A', 'YACHT CLUB', 'SEA DINING'][i]}</Text>
        </group>
      ))}

    </group>
  );
}

// ─── LUXURY YACHT HARBOR — Premium with marina & pier ────────────
function LuxuryYachts({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const yachtsRef = useRef();
  // Chaque yacht alterne : amarré marina (60s) → navigue vers port île (40s) → amarré port île (50s) → retour (40s)
  const cycle = 190;
  const homePos = [-36, 18]; // marina
  const portIle = [-16, 136]; // port azure
  const portEst = [88, -44]; // port est

  useFrame(({ clock }) => {
    if (!yachtsRef.current) return;
    const t = clock.getElapsedTime();
    yachtsRef.current.children.forEach((yacht, i) => {
      if (!yacht.isGroup) return;
      const offset = i * 48;
      const ct = ((t + offset) % cycle);
      const dest = i % 2 === 0 ? portIle : portEst;
      let px, pz;

      if (ct < 60) {
        // Amarré marina
        px = homePos[0] + i * 8;
        pz = homePos[1];
      } else if (ct < 100) {
        // Navigation vers le port
        const p = (ct - 60) / 40;
        const ep = p * p * (3 - 2 * p);
        px = homePos[0] + i * 8 + (dest[0] - (homePos[0] + i * 8)) * ep;
        pz = homePos[1] + (dest[1] - homePos[1]) * ep;
      } else if (ct < 150) {
        // Amarré au port destination
        px = dest[0] + i * 3;
        pz = dest[1];
      } else {
        // Retour marina
        const p = (ct - 150) / 40;
        const ep = p * p * (3 - 2 * p);
        px = dest[0] + i * 3 + (homePos[0] + i * 8 - (dest[0] + i * 3)) * ep;
        pz = dest[1] + (homePos[1] - dest[1]) * ep;
      }

      const candidate = new THREE.Vector3(px, 0, pz);
      const yachtObstacles = window.__superyachtPos
        ? [...SEA_VEHICLE_OBSTACLES, { x: window.__superyachtPos.x, z: window.__superyachtPos.z, radius: 22, push: 4.8 }]
        : SEA_VEHICLE_OBSTACLES;
      const adjusted = offsetSeaVehiclePosition(candidate, i % 2 === 0 ? 1 : -1, yachtObstacles);

      yacht.position.x = adjusted.x;
      yacht.position.z = adjusted.z;
      yacht.rotation.z = Math.sin(t * 0.5 + i * 0.8) * 0.03;
      yacht.position.y = -2.2 + Math.sin(t * 0.6 + i * 1.2) * 0.15;

      // Rotation vers la direction
      if (ct >= 60 && ct < 100) {
        yacht.rotation.y = Math.atan2(dest[0] - (homePos[0] + i * 8), dest[1] - homePos[1]);
      } else if (ct >= 150) {
        yacht.rotation.y = Math.atan2((homePos[0] + i * 8) - dest[0], homePos[1] - dest[1]);
      }
    });
  });

  const yachtConfigs = [
    { offset: 0, rot: 0.3, length: 6, color: '#f0f0f5', accent: '#1a2a4a' },
    { offset: 8, rot: 0.45, length: 5.5, color: '#e8e8f0', accent: '#0a1a3a' },
    { offset: 16, rot: 0.2, length: 5, color: '#f5f0e8', accent: '#2a1a0a' },
    { offset: -8, rot: 0.5, length: 4.5, color: '#f0f5f0', accent: '#1a2a1a' },
  ];

  return (
    <group position={[0, 0, 0]}>
      {/* Marina pier / dock */}
      <group position={[-36, 0, 18]}>
        <mesh position={[4, -0.3, -12]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[3, 0.5, 20]} />
          <meshStandardMaterial color={night ? '#3a4050' : '#8a9aaa'} roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh position={[5.3, 0.3, -12]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.1, 0.8, 20]} />
          <meshStandardMaterial color={night ? '#4a5060' : '#a0a8b0'} metalness={0.6} roughness={0.3} />
        </mesh>
        {night && [-20, -12, -4, 4].map((z, i) => (
          <group key={`marina-dock-light-${i}`} position={[5.5, 0.12, z - 12]}>
            <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.04, 0.05, 0.68, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
            <mesh position={[0, 0.76, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={1.8} /></mesh>
            <pointLight position={[0, 0.78, 0]} color={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} intensity={0.26} distance={3.8} />
          </group>
        ))}
      </group>

      {/* Yachts navigants */}
      <group ref={yachtsRef}>
        {yachtConfigs.map((cfg, i) => (
          <group key={i} position={[-36 + cfg.offset, -3.5, 18]} rotation={[0, cfg.rot, 0]}>
            <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.8, 0.8, cfg.length]} /><meshStandardMaterial color={cfg.color} metalness={0.5} roughness={0.2} /></mesh>
            <mesh position={[0, 0.1, 0]}><boxGeometry args={[2, 0.4, cfg.length + 0.2]} /><meshStandardMaterial color={cfg.accent} metalness={0.6} roughness={0.3} /></mesh>
            <mesh position={[0, 0.72, 0]}><boxGeometry args={[1.92, 0.06, cfg.length - 0.2]} /><meshStandardMaterial color="#ffffff" metalness={0.72} roughness={0.08} /></mesh>
            <mesh position={[0, 1.2, -cfg.length * 0.3]}><boxGeometry args={[1.2, 0.8, cfg.length * 0.4]} /><meshStandardMaterial color={cfg.color} metalness={0.4} roughness={0.25} /></mesh>
            <mesh position={[0, 1.2, -cfg.length * 0.3]}><boxGeometry args={[1, 0.6, cfg.length * 0.35]} /><meshPhysicalMaterial color={night ? '#0a2050' : '#a0c8e8'} transparent opacity={0.5} metalness={0.7} /></mesh>
            {[-0.72, 0.72].map((x, railIndex) => (
              <mesh key={`yacht-rail-${railIndex}`} position={[x, 0.92, 0]}><boxGeometry args={[0.04, 0.18, cfg.length - 0.5]} /><meshStandardMaterial color="#e7eef5" metalness={0.86} roughness={0.08} /></mesh>
            ))}
            {night && <>
              <mesh position={[0, 1.65, cfg.length * 0.18]}><boxGeometry args={[1.1, 0.05, 0.12]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.3} /></mesh>
              <mesh position={[0.78, 0.62, -cfg.length * 0.48]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={1.8} /></mesh>
              <mesh position={[-0.78, 0.62, -cfg.length * 0.48]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={1.8} /></mesh>
              {[-0.8, 0, 0.8].map((z, pi) => (
                <mesh key={`marina-porthole-${pi}`} position={[0, 0.64, z]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={1.4} /></mesh>
              ))}
              <mesh position={[0, 0.44, 0]}><boxGeometry args={[1.86, 0.04, cfg.length - 0.4]} /><meshStandardMaterial color={cfg.accent} emissive="#7ce7ff" emissiveIntensity={0.7} /></mesh>
              <pointLight position={[0, 1.2, 0]} color="#7ce7ff" intensity={0.22} distance={3.2} />
            </>}
          </group>
        ))}
      </group>
    </group>
  );
}

function HarborPremiumGuests({ configs }) {
  return null;
}

function FerryPontoonGuests({ night }) {
  const configs = useMemo(() => ([
    { pathStart: [0.2, -6.2], pathEnd: [0.2, -1.8], baseY: 0.16, speed: 0.2, phase: 0.1, top: '#00d4aa', bottom: '#243447', skin: '#DEB887', scale: 0.62 },
    { pathStart: [0.45, 0.6], pathEnd: [0.45, 5.4], baseY: 0.16, speed: 0.18, phase: 1.4, top: '#ffd166', bottom: '#1d2632', skin: '#FDBCB4', scale: 0.6 },
    { pathStart: [0.18, 6.2], pathEnd: [0.18, 1.2], baseY: 0.16, speed: 0.16, phase: 2.7, top: '#53a7ff', bottom: '#1f2a35', skin: '#F5DEB3', scale: 0.6 },
  ]), []);

  return (
    <group position={[4.25, -0.05, 0.35]}>
      <HarborPremiumGuests configs={configs} />
      {night && [-6, -2, 2, 6].map((z, i) => (
        <pointLight key={`pontoon-guest-glow-${i}`} position={[0.55, 0.7, z]} color={i % 2 === 0 ? '#6de0ff' : '#ffd166'} intensity={0.4} distance={2.8} />
      ))}
    </group>
  );
}

function HarborHelicopter({ position = [0, 0, 0], accent = '#4dd6ff', scale = 1 }) {
  const rotorRef = useRef();
  const tailRotorRef = useRef();

  useFrame(({ clock }) => {
    if (rotorRef.current) rotorRef.current.rotation.y = clock.getElapsedTime() * 12;
    if (tailRotorRef.current) tailRotorRef.current.rotation.z = clock.getElapsedTime() * 16;
  });

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.14, 0.82, 6, 10]} />
        <meshStandardMaterial color="#e7eef4" metalness={0.55} roughness={0.14} />
      </mesh>
      <mesh position={[0, 0.28, 0.46]} scale={[0.95, 0.8, 1.2]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#16314f" emissive="#2f75b6" emissiveIntensity={0.35} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.25, -0.82]}>
        <boxGeometry args={[0.08, 0.08, 0.82]} />
        <meshStandardMaterial color="#dce5ed" metalness={0.6} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.92, 0.03, 0.12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      <group position={[0, 0.06, -0.1]}>
        {[-0.18, 0.18].map((x, i) => (
          <group key={`skid-${i}`} position={[x, 0, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.03, 0.04, 0.92]} />
              <meshStandardMaterial color="#2b3642" metalness={0.68} roughness={0.16} />
            </mesh>
            <mesh position={[0, 0.08, 0.24]} rotation={[0.5, 0, 0]}>
              <boxGeometry args={[0.03, 0.17, 0.03]} />
              <meshStandardMaterial color="#2b3642" metalness={0.68} roughness={0.16} />
            </mesh>
            <mesh position={[0, 0.08, -0.22]} rotation={[-0.5, 0, 0]}>
              <boxGeometry args={[0.03, 0.17, 0.03]} />
              <meshStandardMaterial color="#2b3642" metalness={0.68} roughness={0.16} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={rotorRef} position={[0, 0.46, 0]}>
        <mesh>
          <boxGeometry args={[1.05, 0.02, 0.05]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.15} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.05, 0.02, 0.05]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.15} />
        </mesh>
      </group>
      <group ref={tailRotorRef} position={[0, 0.27, -1.18]}>
        <mesh>
          <boxGeometry args={[0.32, 0.02, 0.04]} />
          <meshStandardMaterial color="#11161e" metalness={0.7} roughness={0.14} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.32, 0.02, 0.04]} />
          <meshStandardMaterial color="#11161e" metalness={0.7} roughness={0.14} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Hélicoptère volant — décolle du superyacht, vole vers destinations ───
function FlyingHeliFromYacht() {
  const heliRef = useRef();
  const rotorRef = useRef();
  const tailRef = useRef();
  // Superyacht helipad world pos approx
  const homePos = useMemo(() => new THREE.Vector3(-16, 5.8, 14), []);
  const destinations = useMemo(() => [
    new THREE.Vector3(-18, 21.5, -72),  // Toit du bâtiment CAPTURE
    new THREE.Vector3(-36, 1.5, -50),   // Plage
    new THREE.Vector3(-40, 14, -178),   // Centre-ville
  ], []);
  const flightAlt = 30;
  // Cycle: idle(15s) → takeoff(5s) → cruise(18s) → land(5s) → idle(12s) → takeoff(5s) → returnCruise(18s) → land(5s) = 83s
  const cycleDuration = 83;

  useFrame(({ clock }) => {
    if (!heliRef.current) return;
    const t = clock.getElapsedTime();
    const cycleT = t % cycleDuration;
    const destIndex = Math.floor(t / cycleDuration) % destinations.length;
    const dest = destinations[destIndex];
    let px, py, pz, yaw;
    const lerpV = (a, b, f) => a + (b - a) * f;

    if (cycleT < 15) {
      // Idle sur yacht
      px = homePos.x; py = homePos.y + Math.sin(t * 2) * 0.02; pz = homePos.z;
      yaw = 0;
    } else if (cycleT < 20) {
      // Décollage vertical
      const p = (cycleT - 15) / 5;
      const ep = 1 - Math.pow(1 - p, 2);
      px = homePos.x; py = lerpV(homePos.y, flightAlt, ep); pz = homePos.z;
      yaw = Math.atan2(dest.x - homePos.x, dest.z - homePos.z);
    } else if (cycleT < 38) {
      // Vol vers destination
      const p = (cycleT - 20) / 18;
      const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      px = lerpV(homePos.x, dest.x, ep);
      pz = lerpV(homePos.z, dest.z, ep);
      py = flightAlt + Math.sin(p * Math.PI) * 4;
      yaw = Math.atan2(dest.x - homePos.x, dest.z - homePos.z);
    } else if (cycleT < 43) {
      // Atterrissage
      const p = (cycleT - 38) / 5;
      const ep = 1 - Math.pow(1 - p, 2);
      px = dest.x; py = lerpV(flightAlt, dest.y, ep); pz = dest.z;
      yaw = Math.atan2(dest.x - homePos.x, dest.z - homePos.z);
    } else if (cycleT < 55) {
      // Idle à destination
      px = dest.x; py = dest.y + Math.sin(t * 2) * 0.02; pz = dest.z;
      yaw = Math.atan2(homePos.x - dest.x, homePos.z - dest.z);
    } else if (cycleT < 60) {
      // Décollage retour
      const p = (cycleT - 55) / 5;
      const ep = 1 - Math.pow(1 - p, 2);
      px = dest.x; py = lerpV(dest.y, flightAlt, ep); pz = dest.z;
      yaw = Math.atan2(homePos.x - dest.x, homePos.z - dest.z);
    } else if (cycleT < 78) {
      // Vol retour
      const p = (cycleT - 60) / 18;
      const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      px = lerpV(dest.x, homePos.x, ep);
      pz = lerpV(dest.z, homePos.z, ep);
      py = flightAlt + Math.sin(p * Math.PI) * 4;
      yaw = Math.atan2(homePos.x - dest.x, homePos.z - dest.z);
    } else {
      // Atterrissage retour
      const p = (cycleT - 78) / 5;
      const ep = 1 - Math.pow(1 - p, 2);
      px = homePos.x; py = lerpV(flightAlt, homePos.y, ep); pz = homePos.z;
      yaw = 0;
    }
    heliRef.current.position.set(px, py, pz);
    heliRef.current.rotation.y = yaw;
    window.__heliPos = { x: px, y: py, z: pz, flying: cycleT >= 15 && cycleT < 83 };
    // Rotors
    if (rotorRef.current) rotorRef.current.rotation.y = t * 18;
    if (tailRef.current) tailRef.current.rotation.z = t * 22;
  });

  return (
    <group ref={heliRef}>
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.18, 1.1, 6, 10]} />
        <meshStandardMaterial color="#e7eef4" metalness={0.55} roughness={0.14} />
      </mesh>
      <mesh position={[0, 0.3, 0.58]} scale={[0.95, 0.8, 1.2]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#16314f" emissive="#2f75b6" emissiveIntensity={0.35} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.28, -1.05]}>
        <boxGeometry args={[0.1, 0.1, 1.05]} />
        <meshStandardMaterial color="#dce5ed" metalness={0.6} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.14]} />
        <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={0.8} />
      </mesh>
      <group position={[0, 0.06, -0.1]}>
        {[-0.22, 0.22].map((x, i) => (
          <group key={`fs-${i}`} position={[x, 0, 0]}>
            <mesh><boxGeometry args={[0.04, 0.05, 1.15]} /><meshStandardMaterial color="#2b3642" metalness={0.68} roughness={0.16} /></mesh>
            <mesh position={[0, 0.1, 0.3]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.04, 0.2, 0.04]} /><meshStandardMaterial color="#2b3642" metalness={0.68} /></mesh>
            <mesh position={[0, 0.1, -0.28]} rotation={[-0.5, 0, 0]}><boxGeometry args={[0.04, 0.2, 0.04]} /><meshStandardMaterial color="#2b3642" metalness={0.68} /></mesh>
          </group>
        ))}
      </group>
      <group ref={rotorRef} position={[0, 0.56, 0]}>
        <mesh><boxGeometry args={[1.4, 0.02, 0.06]} /><meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.15} /></mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[1.4, 0.02, 0.06]} /><meshStandardMaterial color="#1a1a1a" metalness={0.7} /></mesh>
      </group>
      <group ref={tailRef} position={[0, 0.3, -1.52]}>
        <mesh><boxGeometry args={[0.4, 0.02, 0.05]} /><meshStandardMaterial color="#11161e" metalness={0.7} /></mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.4, 0.02, 0.05]} /><meshStandardMaterial color="#11161e" metalness={0.7} /></mesh>
      </group>
    </group>
  );
}

function DockedMegaCruiseYacht({ tod }) {
  const ref = useRef();
  const hatchRef = useRef();
  const night = tod < 0.18 || tod > 0.82;
  const guestConfigs = useMemo(() => ([
    { pathStart: [-1.8, 2.25], pathEnd: [1.8, 2.25], baseY: 1.76, speed: 0.26, phase: 0.2, top: '#00d4aa', bottom: '#23384a', skin: '#DEB887', scale: 0.7 },
    { pathStart: [1.4, -0.4], pathEnd: [-1.4, -0.4], baseY: 1.76, speed: 0.22, phase: 1.4, top: '#ff6f91', bottom: '#1f2732', skin: '#FDBCB4', scale: 0.68 },
    { pathStart: [-1.2, -2.2], pathEnd: [1.2, -2.2], baseY: 1.76, speed: 0.2, phase: 2.2, top: '#ffd166', bottom: '#303744', skin: '#C68642', scale: 0.7 },
    { pathStart: [0.8, 4.1], pathEnd: [-0.8, 4.1], baseY: 1.76, speed: 0.18, phase: 3.1, top: '#53a7ff', bottom: '#1b2230', skin: '#F5DEB3', scale: 0.66 },
    { pathStart: [-1.4, 5.9], pathEnd: [1.4, 5.9], baseY: 1.76, speed: 0.16, phase: 4.3, top: '#9b7dff', bottom: '#253241', skin: '#D2B48C', scale: 0.66 },
    { pathStart: [1.3, -4.1], pathEnd: [-1.3, -4.1], baseY: 1.76, speed: 0.17, phase: 5.1, top: '#8ad66d', bottom: '#202935', skin: '#CD853F', scale: 0.67 },
  ]), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const manualYacht = window.__superyachtManual && window.__superyachtManualState;
    if (manualYacht) {
      const state = manualYacht;
      const pos = state.pos || { x: -16, y: 0.18, z: 10.2 };
      ref.current.position.set(0, 0.18, 4.2);
      if (ref.current.parent) {
        ref.current.parent.position.set(pos.x, typeof pos.y === 'number' ? pos.y : 0.18, pos.z);
        ref.current.parent.rotation.y = typeof state.yaw === 'number' ? state.yaw : ref.current.parent.rotation.y;
      }
      ref.current.rotation.z = Math.sin(t * 0.15) * 0.004;
      window.__superyachtPos = { x: pos.x, y: typeof pos.y === 'number' ? pos.y + 1.2 : 1.38, z: pos.z };
    } else {
      ref.current.position.y = 0.18 + Math.sin(t * 0.45) * 0.04;
      ref.current.rotation.z = Math.sin(t * 0.35) * 0.01;
      window.__superyachtPos = { x: -16, y: ref.current.position.y + 1.2, z: 10.2 };
    }
    if (hatchRef.current) {
      const cycle = t % 24;
      let openness = 1;
      if (cycle < 10) openness = 1;
      else if (cycle < 12) openness = 1 - (cycle - 10) / 2;
      else if (cycle < 22) openness = 0;
      else openness = (cycle - 22) / 2;
      const eased = openness * openness * (3 - 2 * openness);
      hatchRef.current.rotation.x = -1.42 * eased;
    }
  });

  return (
    <group position={[-16, 0, 6]} scale={[1.18, 1.18, 1.18]}>
      <group ref={ref} position={[0, 0.18, 4.2]} rotation={[0, 0.1, 0]}>
        {/* === COQUE PRINCIPALE — vedette/paquebot très haute au-dessus des vagues === */}
        {/* Corps principal de la coque (beaucoup plus haut et plus imposant) */}
        <RoundedBox args={[4.28, 3.34, 17.2]} radius={0.22} smoothness={8} position={[0, 0.72, 0.35]}>
          <meshPhysicalMaterial color="#f8fafc" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
        </RoundedBox>
        {/* Flancs lissés, rentrés dans la coque pour éviter l'effet passerelle */}
        <mesh position={[-1.96, 0.08, 0.3]} rotation={[0, 0, 0.16]}>
          <boxGeometry args={[0.62, 2.08, 16.9]} />
          <meshPhysicalMaterial color="#f8fafc" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[1.96, 0.08, 0.3]} rotation={[0, 0, -0.16]}>
          <boxGeometry args={[0.62, 2.08, 16.9]} />
          <meshPhysicalMaterial color="#f8fafc" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* Ligne de coque bleue simple */}
        <mesh position={[-2.12, -0.18, 0.34]}>
          <boxGeometry args={[0.08, 0.16, 16.8]} />
          <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.42 : 0.06} metalness={0.45} roughness={0.16} />
        </mesh>
        <mesh position={[2.12, -0.18, 0.34]}>
          <boxGeometry args={[0.08, 0.16, 16.8]} />
          <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.42 : 0.06} metalness={0.45} roughness={0.16} />
        </mesh>
        {/* Arrière très relevé au-dessus des vagues */}
        <group position={[0, 1.02, 6.3]}>
          <RoundedBox args={[4.08, 3.04, 5.2]} radius={0.2} smoothness={8} position={[0, 0.22, 0]}>
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <RoundedBox args={[3.18, 1.54, 3.72]} radius={0.16} smoothness={8} position={[0, 1.04, 0.18]}>
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <mesh position={[0, -1.08, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[3.78, 0.44, 4.8]} />
            <meshPhysicalMaterial color="#eef4fa" roughness={0.08} metalness={0.08} clearcoat={1} clearcoatRoughness={0.06} />
          </mesh>
        </group>
        {/* Proue intégrée du superyacht avec vraie passerelle frontale */}
        <group position={[0, 0.86, -9.52]}>
          {/* Coque avant refaite pour laisser une vraie ouverture centrale */}
          {[[-1.66, -0.02, -0.26, 0.62, 1.96, 2.74, 0.14], [1.66, -0.02, -0.26, 0.62, 1.96, 2.74, -0.14]].map(([x, y, z, w, h, d, rz], i) => (
            <mesh key={`bow-side-shell-${i}`} position={[x, y, z]} rotation={[0, 0, rz]}>
              <boxGeometry args={[w, h, d]} />
              <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
            </mesh>
          ))}
          <mesh position={[0, 0.94, -0.34]}>
            <boxGeometry args={[3.98, 0.68, 2.86]} />
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </mesh>
          <mesh position={[0, -1.12, -0.22]}>
            <boxGeometry args={[4.04, 0.22, 2.42]} />
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </mesh>
          <RoundedBox args={[3.18, 1.34, 1.96]} radius={0.16} smoothness={8} position={[0, 0.52, -1.76]} rotation={[-0.08, 0, 0]}>
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <RoundedBox args={[2.36, 0.92, 1.18]} radius={0.12} smoothness={8} position={[0, 0.82, -2.28]} rotation={[-0.18, 0, 0]}>
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <RoundedBox args={[1.58, 0.42, 0.64]} radius={0.08} smoothness={8} position={[0, 1.08, -2.56]} rotation={[-0.28, 0, 0]}>
            <meshPhysicalMaterial color="#fbfdff" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0.04} />
          </RoundedBox>
          <mesh position={[-1.92, -0.18, -0.52]} rotation={[0, 0.08, 0]}>
            <boxGeometry args={[0.08, 0.16, 2.38]} />
            <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.42 : 0.06} metalness={0.45} roughness={0.16} />
          </mesh>
          <mesh position={[1.92, -0.18, -0.52]} rotation={[0, -0.08, 0]}>
            <boxGeometry args={[0.08, 0.16, 2.38]} />
            <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.42 : 0.06} metalness={0.45} roughness={0.16} />
          </mesh>

          {/* Ouverture derrière la façade avant */}
          <mesh position={[0, -0.02, -1.82]}><boxGeometry args={[3.76, 2.08, 0.26]} /><meshStandardMaterial color="#141b23" roughness={0.94} /></mesh>
          <mesh position={[0, -1.02, 1.6]}><boxGeometry args={[3.72, 0.08, 6.2]} /><meshStandardMaterial color="#252d36" roughness={0.88} /></mesh>
          <mesh position={[0, 1.04, 1.6]}><boxGeometry args={[3.72, 0.08, 6.2]} /><meshStandardMaterial color="#f6f8fb" metalness={0.18} roughness={0.12} /></mesh>
          {[-1.82, 1.82].map((x, i) => (
            <mesh key={`suite-side-wall-${i}`} position={[x, 0.02, 1.6]}><boxGeometry args={[0.08, 1.98, 6.2]} /><meshStandardMaterial color="#f6f8fb" metalness={0.16} roughness={0.12} /></mesh>
          ))}
          <mesh position={[0, 0.02, 4.66]}><boxGeometry args={[3.72, 1.98, 0.08]} /><meshStandardMaterial color="#eef2f6" metalness={0.14} roughness={0.16} /></mesh>
          <mesh position={[0, 0.02, 4.56]}><boxGeometry args={[2.18, 1.08, 0.06]} /><meshStandardMaterial color="#111820" emissive={night ? '#1f9bff' : '#02152a'} emissiveIntensity={night ? 1.6 : 0.08} /></mesh>
          <group position={[1.02, -0.98, 3.54]}>
            {Array.from({ length: 5 }).map((_, step) => (
              <mesh key={`suite-step-${step}`} position={[0, step * 0.14, -step * 0.28]}>
                <boxGeometry args={[0.86, 0.1, 0.28]} />
                <meshStandardMaterial color="#e7edf3" metalness={0.22} roughness={0.16} />
              </mesh>
            ))}
          </group>
          <group position={[-1.02, -0.92, 3.32]}>
            <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.48, 0.52, 0.42, 20]} /><meshStandardMaterial color="#e8edf4" metalness={0.16} roughness={0.18} /></mesh>
            <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.4, 0.42, 0.16, 20]} /><meshStandardMaterial color="#3bc7ff" emissive="#3bc7ff" emissiveIntensity={night ? 1.8 : 0.22} transparent opacity={0.8} /></mesh>
          </group>
          <group position={[-0.68, -0.98, 1.18]}>
            <mesh position={[0, 0.28, 0]}><boxGeometry args={[1.22, 0.38, 0.66]} /><meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.08} /></mesh>
            <mesh position={[0, 0.58, -0.2]}><boxGeometry args={[1.22, 0.28, 0.14]} /><meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.08} /></mesh>
          </group>
          {[[0.7, 1.26], [1.08, 1.66]].map(([x, z], i) => (
            <mesh key={`suite-chair-${i}`} position={[x, -0.98, z]} rotation={[0, i === 0 ? -0.3 : -0.5, 0]}>
              <boxGeometry args={[0.34, 0.34, 0.34]} />
              <meshStandardMaterial color="#ffffff" roughness={0.24} metalness={0.08} />
            </mesh>
          ))}
          <mesh position={[0.26, -0.98, 1.26]}><cylinderGeometry args={[0.28, 0.28, 0.08, 18]} /><meshPhysicalMaterial color="#dff4ff" transmission={0.78} roughness={0.03} transparent opacity={0.4} /></mesh>
          {[-1.48, 1.48].map((x, i) => (
            <group key={`suite-wall-light-${i}`} position={[x, 0.36, 1.88]}>
              <mesh><boxGeometry args={[0.08, 0.42, 0.22]} /><meshStandardMaterial color="#f8fbff" emissive="#fff3c6" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
              {night && <pointLight position={[0, 0, 0]} color="#fff3c6" intensity={0.16} distance={2.2} />}
            </group>
          ))}
          {night && <>
            <mesh position={[0, 0.98, 1.6]}><boxGeometry args={[3.44, 0.04, 5.96]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.05} /></mesh>
            <mesh position={[0, -1.0, 1.6]}><boxGeometry args={[3.44, 0.03, 5.96]} /><meshStandardMaterial color="#ff5fd2" emissive="#ff5fd2" emissiveIntensity={0.9} /></mesh>
            <mesh position={[0, 0.02, 4.52]}><boxGeometry args={[3.16, 0.05, 0.03]} /><meshStandardMaterial color="#00c8ff" emissive="#00c8ff" emissiveIntensity={0.72} /></mesh>
          </>}

          {/* Cadre de façade avant exactement à la forme du plat blanc */}
          <group position={[0, -0.02, -1.52]}>
            <mesh><boxGeometry args={[3.96, 2.12, 0.08]} /><meshStandardMaterial color="#eef3f8" metalness={0.28} roughness={0.08} /></mesh>
          </group>

          {/* La passerelle est exactement le plat blanc retiré puis réutilisé */}
          <group ref={hatchRef} position={[0, -1.06, -1.48]}>
            <RoundedBox args={[3.82, 2.04, 0.12]} radius={0.12} smoothness={6} position={[0, 1.02, 0]}>
              <meshPhysicalMaterial color="#fbfdff" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.05} />
            </RoundedBox>
            <mesh position={[0, 2.02, 0.04]}><boxGeometry args={[3.74, 0.05, 0.04]} /><meshStandardMaterial color="#ffffff" metalness={0.42} roughness={0.08} /></mesh>
            {[ -1.18, 0, 1.18 ].map((x, i) => (
              <mesh key={`bow-ramp-hinge-${i}`} position={[x, 0.02, 0.06]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.06, 0.06, 0.18, 10]} />
                <meshStandardMaterial color="#d6dee6" metalness={0.8} roughness={0.08} />
              </mesh>
            ))}
          </group>
        </group>
        <RoundedBox args={[4.4, 1.08, 9.4]} radius={0.28} smoothness={4} position={[0, 2.02, -1.1]}>
          <meshPhysicalMaterial color="#fbfdff" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.08} />
        </RoundedBox>
        <RoundedBox args={[3.5, 0.88, 6.4]} radius={0.24} smoothness={4} position={[0, 2.84, -2.2]}>
          <meshPhysicalMaterial color="#fbfdff" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.08} />
        </RoundedBox>
        <RoundedBox args={[2.5, 0.72, 4.1]} radius={0.22} smoothness={4} position={[0, 3.52, -2.95]}>
          <meshPhysicalMaterial color="#fbfdff" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.08} />
        </RoundedBox>

        <mesh position={[0, 2.24, -1.1]}>
          <boxGeometry args={[4.2, 0.34, 8.9]} />
          <meshPhysicalMaterial color="#16314f" transmission={0.82} transparent opacity={0.96} roughness={0.02} ior={1.5} />
        </mesh>
        <mesh position={[0, 3.02, -2.05]}>
          <boxGeometry args={[3.15, 0.26, 5.8]} />
          <meshPhysicalMaterial color="#16314f" transmission={0.82} transparent opacity={0.96} roughness={0.02} ior={1.5} />
        </mesh>

        {[-2.18, 2.18].map((x, i) => (
          <mesh key={`yacht-arch-${i}`} position={[x, 2.72, 1.25]} rotation={[0, i === 0 ? 0.24 : -0.24, Math.PI / 2]}>
            <torusGeometry args={[1.15, 0.05, 8, 24, Math.PI * 0.72]} />
            <meshStandardMaterial color="#dbe7f1" metalness={0.6} roughness={0.12} />
          </mesh>
        ))}

        <mesh position={[0, 2.7, 4.25]}>
          <boxGeometry args={[2.8, 0.08, 4.2]} />
          <meshStandardMaterial color="#c28e5d" roughness={0.72} metalness={0.08} />
        </mesh>
        <mesh position={[0, 2.74, 4.2]}>
          <boxGeometry args={[1.95, 0.09, 3.15]} />
          <meshStandardMaterial color="#18c4ff" emissive="#18c4ff" emissiveIntensity={night ? 1.1 : 0.28} transparent opacity={0.78} />
        </mesh>

        <mesh position={[0, 3.78, 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshStandardMaterial color="#eef3f8" emissive="#ffffff" emissiveIntensity={night ? 0.35 : 0.05} />
        </mesh>
        <Text position={[0, 3.8, 2.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.56} color="#1a5fa8" anchorX="center">H</Text>
        {night && <>
          {[-1.6, 1.6].map((x, i) => (
            <mesh key={`yacht-deck-led-${i}`} position={[x, 2.76, 4.2]}><boxGeometry args={[0.12, 0.08, 3.6]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.5} /></mesh>
          ))}
          {[-1.5, 1.5].map((x, i) => (
            <mesh key={`yacht-bow-nav-${i}`} position={[x, 1.18, -11.5]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color={i === 0 ? '#ff4040' : '#52ff8d'} emissive={i === 0 ? '#ff4040' : '#52ff8d'} emissiveIntensity={2.1} /></mesh>
          ))}
          <mesh position={[0, 4.8, -6.8]}><boxGeometry args={[6.1, 0.08, 0.16]} /><meshStandardMaterial color="#d9e7f2" emissive="#7ce7ff" emissiveIntensity={1.2} /></mesh>
          <pointLight position={[0, 3.3, -2]} color="#a6e7ff" intensity={0.45} distance={8} />
        </>}

        <group position={[0, 3.86, -7.4]}>
          <mesh>
            <boxGeometry args={[5.8, 0.11, 1.15]} />
            <meshStandardMaterial color="#fcfdff" metalness={0.55} roughness={0.08} />
          </mesh>
          <mesh position={[0, 0.32, -0.1]}>
            <boxGeometry args={[4.9, 0.08, 0.54]} />
            <meshStandardMaterial color="#ffffff" metalness={0.42} roughness={0.1} />
          </mesh>
          {/* Deux piliers d'attache — du pont jusqu'à l'aileron */}
          {[-1.8, 1.8].map((x, i) => (
            <mesh key={`yacht-strut-${i}`} position={[x, -0.88, 0]}>
              <boxGeometry args={[0.14, 1.86, 0.14]} />
              <meshStandardMaterial color="#ffffff" metalness={0.46} roughness={0.06} />
            </mesh>
          ))}
        </group>

        {[2.12, -2.12].map((x, sideIndex) => (
          [-7.1, -6, -4.9, -3.8, -2.7, -1.6, -0.5, 0.6, 1.7, 2.8, 3.9, 5].map((z, i) => (
            <mesh key={`yacht-window-${sideIndex}-${i}`} position={[x, 1.98, z]}>
              <boxGeometry args={[0.06, 0.3, 0.6]} />
              <meshStandardMaterial color="#9ce7ff" emissive="#e0f7ff" emissiveIntensity={night ? 1.4 : 0.18} transparent opacity={0.92} />
            </mesh>
          ))
        ))}
        {/* Hélicoptère retiré — remplacé par FlyingHeliFromYacht */}
        <HarborPremiumGuests configs={guestConfigs} />
      </group>
    </group>
  );
}

function DockedDefenseCarrier({ tod }) {
  const groupRef = useRef();
  const ref = useRef();
  const elevRef1 = useRef();
  const elevRef2 = useRef();
  const night = tod < 0.18 || tod > 0.82;
  const guests = useMemo(() => ([
    { pathStart: [-3.4, -7], pathEnd: [3.4, -7], baseY: 1.96, speed: 0.16, phase: 0.4, top: '#7ec8ff', bottom: '#243447', skin: '#DEB887', scale: 0.66 },
    { pathStart: [2.8, 4.8], pathEnd: [-2.8, 4.8], baseY: 1.96, speed: 0.14, phase: 1.7, top: '#ffd166', bottom: '#1d2632', skin: '#FDBCB4', scale: 0.66 },
    { pathStart: [-2.2, -1.2], pathEnd: [2.2, -1.2], baseY: 1.96, speed: 0.13, phase: 2.8, top: '#00d4aa', bottom: '#27384a', skin: '#F5DEB3', scale: 0.66 },
    { pathStart: [3.1, 9.2], pathEnd: [-3.1, 9.2], baseY: 1.96, speed: 0.12, phase: 3.5, top: '#ff6f91', bottom: '#1b2430', skin: '#C68642', scale: 0.64 },
  ]), []);

  // Route de patrouille longue distance — HAUTE MER uniquement (loin du Nouveau Monde)
  const carrierWaypoints = useMemo(() => [
    [55, 120],       // Départ haute mer
    [95, 145],       // Est
    [145, 178],      // Est lointain
    [138, 222],      // Sud-est
    [92, 252],       // Sud
    [26, 266],       // Sud-ouest
    [-44, 252],      // Ouest
    [-108, 222],     // Ouest lointain
    [-154, 176],     // Nord-ouest
    [-166, 128],     // Ouest haut
    [-118, 104],     // Retour nord-ouest
    [-52, 96],       // Retour côte mer
    [12, 102],       // Remontée est
    [52, 114],       // Quai mer
  ], []);
  const carrierWpRef = useRef(0);
  const carrierPosRef = useRef(new THREE.Vector3(55, 0, 52));
  const carrierVelRef = useRef(new THREE.Vector3());
  const carrierSpeed = 0.24;
  const carrierSize = 24;
  const carrierYawRef = useRef(0);
  const carrierNoIntrusionZones = useMemo(() => ([
    { x: 55, z: -20, radius: 98, push: 1.9 },   // Sol Nouveau Monde
    { x: 40, z: 40, radius: 76, push: 1.6 },    // Front urbain / routes
    { x: -16, z: 160, radius: 82, push: 1.5 },  // Île tropicale
  ]), []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const manualCarrier = window.__carrierManual && window.__carrierManualState;
    if (groupRef.current) {
      if (manualCarrier) {
        const state = manualCarrier;
        const pos = state.pos || { x: 55, y: 2.4, z: 52 };
        carrierPosRef.current.set(pos.x, typeof pos.y === 'number' ? pos.y : 2.4, pos.z);
        carrierVelRef.current.set(0, 0, 0);
        carrierYawRef.current = typeof state.yaw === 'number' ? state.yaw : carrierYawRef.current;
        groupRef.current.position.set(carrierPosRef.current.x, carrierPosRef.current.y, carrierPosRef.current.z);
        groupRef.current.rotation.y = carrierYawRef.current;
        window.__carrierPos = { x: carrierPosRef.current.x, y: carrierPosRef.current.y, z: carrierPosRef.current.z };
      } else {
      const wp = carrierWaypoints[carrierWpRef.current];
      const target = new THREE.Vector3(wp[0], 0, wp[1]);
      const pos = carrierPosRef.current;
      const toTarget = new THREE.Vector3().subVectors(target, pos);
      const dist = toTarget.length();

      if (dist < 8) {
        carrierWpRef.current = (carrierWpRef.current + 1) % carrierWaypoints.length;
      }

      // Direction désirée
      const desired = toTarget.normalize().multiplyScalar(carrierSpeed);

      // Évitement du cargo — virage latéral doux
      const cargoPos = window.__cargoPos;
      if (cargoPos) {
        const dx = cargoPos.x - pos.x, dz = cargoPos.z - pos.z;
        const cargoDist = Math.sqrt(dx * dx + dz * dz);
        if (cargoDist < carrierSize * 3 && cargoDist > 0.1) {
          const perpX = -desired.z, perpZ = desired.x;
          const side = (perpX * dx + perpZ * dz) > 0 ? -1 : 1;
          const str = Math.min(0.4, (1 - cargoDist / (carrierSize * 3)) * 0.5);
          desired.x += perpX * side * str;
          desired.z += perpZ * side * str;
          desired.normalize().multiplyScalar(carrierSpeed);
        }
      }

      // Zéro intrusion: déviation anticipée des zones terrestres
      carrierNoIntrusionZones.forEach(({ x, z, radius, push }) => {
        const dx = pos.x - x;
        const dz = pos.z - z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const safeDist = radius + carrierSize * 0.6;
        if (d < safeDist && d > 0.1) {
          desired.x += (dx / d) * push;
          desired.z += (dz / d) * push;
          desired.normalize().multiplyScalar(carrierSpeed);
        }
      });

      // Steering fluide (pas de changement brusque)
      const vel = carrierVelRef.current;
      vel.lerp(desired, 0.02);
      pos.add(vel.clone().multiplyScalar(delta * 60));

      // GARDE-FOU : rester en mer (pas de traversée des sols/îles)
      if (pos.z < 92) { pos.z = 92; }
      if (pos.x < -170) { pos.x = -170; }
      if (pos.x > 160) { pos.x = 160; }

      // Hard clamp final (zéro intrusion strict)
      carrierNoIntrusionZones.forEach(({ x, z, radius }) => {
        const dx = pos.x - x;
        const dz = pos.z - z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const minDist = radius + 10;
        if (d < minDist) {
          const nx = d > 0.001 ? dx / d : 1;
          const nz = d > 0.001 ? dz / d : 0;
          pos.x = x + nx * minDist;
          pos.z = z + nz * minDist;
        }
      });

      groupRef.current.position.x = pos.x;
      groupRef.current.position.z = pos.z;

      // Rotation douce vers la direction du mouvement
      if (vel.lengthSq() > 0.0001) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        carrierYawRef.current += (targetYaw - carrierYawRef.current) * 0.03;
        groupRef.current.rotation.y = carrierYawRef.current;
      }
      window.__carrierPos = { x: pos.x, y: 2.4, z: pos.z };
      }
    }
    if (!ref.current) return;
    ref.current.position.y = -1.35 + Math.sin(t * 0.35) * 0.05;
    ref.current.rotation.z = Math.sin(t * 0.28) * 0.015;
    if (elevRef1.current) elevRef1.current.position.y = 1.88 + Math.sin(t * 0.25) * 0.9;
    if (elevRef2.current) elevRef2.current.position.y = 1.88 + Math.sin(t * 0.25 + Math.PI) * 0.9;
  });

  return (
    <group ref={groupRef} position={[55, 0, 52]} scale={[0.98, 0.98, 0.98]}>
      <group ref={ref} position={[0, -1.05, 0]}>
        {/* Coque principale aplatie */}
        <mesh position={[0, 0.76, -0.8]}>
          <boxGeometry args={[6.4, 1.56, 20.6]} />
          <meshStandardMaterial color="#313942" roughness={0.8} metalness={0.58} />
        </mesh>
        <mesh position={[0, 0.18, -0.8]}>
          <boxGeometry args={[5.8, 0.82, 21.2]} />
          <meshStandardMaterial color="#252d35" roughness={0.84} metalness={0.46} />
        </mesh>
        <mesh position={[0, 1.18, -12.45]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3.1, 5.4, 8]} />
          <meshStandardMaterial color="#313942" roughness={0.78} metalness={0.56} />
        </mesh>
        {/* Arrière de coque plus carré, type superyacht */}
        <mesh position={[0, 0.92, 7.8]}>
          <boxGeometry args={[6.1, 1.9, 8.4]} />
          <meshStandardMaterial color="#313942" roughness={0.78} metalness={0.56} />
        </mesh>
        <mesh position={[0, 0.9, 12.15]}>
          <boxGeometry args={[6.2, 1.72, 0.36]} />
          <meshStandardMaterial color="#313942" roughness={0.76} metalness={0.54} />
        </mesh>
        <mesh position={[0, 0.12, 11.9]}>
          <boxGeometry args={[5.6, 0.78, 0.34]} />
          <meshStandardMaterial color="#252d35" roughness={0.82} metalness={0.42} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[4.95, 0.1, 27.8]} />
          <meshStandardMaterial color="#6b1414" emissive="#6b1414" emissiveIntensity={night ? 0.42 : 0.05} />
        </mesh>

        <mesh position={[0.55, 2.55, 0]}>
          <boxGeometry args={[9.7, 0.24, 29.2]} />
          <meshStandardMaterial color="#1a1d24" roughness={0.78} metalness={0.28} />
        </mesh>
        <mesh position={[-3.2, 2.64, 1.2]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[2.3, 0.1, 10.4]} />
          <meshStandardMaterial color="#1a1d24" roughness={0.78} metalness={0.28} />
        </mesh>
        <mesh position={[0.8, 2.66, 0]}>
          <boxGeometry args={[9.8, 0.06, 29.4]} />
          <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.55 : 0.08} />
        </mesh>

        {/* ═══ ASCENSEURS DE PONT ANIMÉS ═══ */}
        {/* Ascenseur tribord avant — monte/descend les avions */}
        <group ref={elevRef1} position={[-4.85, 1.88, -1.2]}>
          <mesh><boxGeometry args={[1.4, 0.2, 2.6]} /><meshStandardMaterial color="#525c66" metalness={0.6} roughness={0.25} /></mesh>
          <mesh position={[0, 0.02, 0]}><boxGeometry args={[1.2, 0.06, 2.3]} /><meshStandardMaterial color="#3a444e" metalness={0.5} roughness={0.3} /></mesh>
          {/* Marquages jaunes de sécurité */}
          {[-0.9, 0.9].map((z, i) => (
            <mesh key={`em1-${i}`} position={[0, 0.12, z]}><boxGeometry args={[1.3, 0.04, 0.08]} /><meshStandardMaterial color="#f0c020" emissive="#f0c020" emissiveIntensity={night ? 1.2 : 0.15} /></mesh>
          ))}
          {/* Garde-corps */}
          {[-0.65, 0.65].map((x, i) => (
            <group key={`er1-${i}`} position={[x, 0, 0]}>
              <mesh position={[0, 0.28, -1.1]}><boxGeometry args={[0.04, 0.36, 0.04]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[0, 0.28, 1.1]}><boxGeometry args={[0.04, 0.36, 0.04]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[0, 0.44, 0]}><boxGeometry args={[0.03, 0.03, 2.4]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
            </group>
          ))}
        </group>
        {/* Ascenseur bâbord arrière — en opposition de phase */}
        <group ref={elevRef2} position={[4.85, 1.88, 5.1]}>
          <mesh><boxGeometry args={[1.4, 0.2, 2.6]} /><meshStandardMaterial color="#525c66" metalness={0.6} roughness={0.25} /></mesh>
          <mesh position={[0, 0.02, 0]}><boxGeometry args={[1.2, 0.06, 2.3]} /><meshStandardMaterial color="#3a444e" metalness={0.5} roughness={0.3} /></mesh>
          {[-0.9, 0.9].map((z, i) => (
            <mesh key={`em2-${i}`} position={[0, 0.12, z]}><boxGeometry args={[1.3, 0.04, 0.08]} /><meshStandardMaterial color="#f0c020" emissive="#f0c020" emissiveIntensity={night ? 1.2 : 0.15} /></mesh>
          ))}
          {[-0.65, 0.65].map((x, i) => (
            <group key={`er2-${i}`} position={[x, 0, 0]}>
              <mesh position={[0, 0.28, -1.1]}><boxGeometry args={[0.04, 0.36, 0.04]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[0, 0.28, 1.1]}><boxGeometry args={[0.04, 0.36, 0.04]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
              <mesh position={[0, 0.44, 0]}><boxGeometry args={[0.03, 0.03, 2.4]} /><meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} /></mesh>
            </group>
          ))}
        </group>
        {/* Puits d'ascenseur — ouvertures dans le pont */}
        {[[-4.85, -1.2], [4.85, 5.1]].map(([x, z], i) => (
          <mesh key={`elev-shaft-${i}`} position={[x, 0.98, z]}>
            <boxGeometry args={[1.5, 1.6, 2.7]} />
            <meshStandardMaterial color="#0a0e14" roughness={0.9} metalness={0.1} />
          </mesh>
        ))}

        {[-2.85, 2.85].map((x, i) => (
          <mesh key={`carrier-hangar-${i}`} position={[x, 1.18, -6.8]}>
            <boxGeometry args={[1.15, 1.28, 4.6]} />
            <meshStandardMaterial color="#11161c" emissive="#1d2d3d" emissiveIntensity={night ? 0.28 : 0.04} />
          </mesh>
        ))}

        <mesh position={[2.95, 4.25, -5.2]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.95, 1.25, 4.2, 4]} />
          <meshStandardMaterial color="#d9dfe6" roughness={0.26} metalness={0.34} />
        </mesh>
        <mesh position={[3.25, 6.45, -5.4]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.65, 0.95, 2.5, 4]} />
          <meshStandardMaterial color="#dce2e8" roughness={0.24} metalness={0.34} />
        </mesh>
        <mesh position={[3.35, 7.95, -5.6]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 2.4, 8]} />
          <meshStandardMaterial color="#5a6876" metalness={0.8} roughness={0.16} />
        </mesh>
        <mesh position={[3.4, 9.45, -5.7]}>
          <sphereGeometry args={[0.42, 12, 12]} />
          <meshStandardMaterial color="#dfe8f0" metalness={0.55} roughness={0.12} />
        </mesh>

        {/* ═══ RADÔMES — Dômes radar blancs sur la tour ═══ */}
        {/* Radôme principal — grand dôme blanc au sommet */}
        <mesh position={[3.2, 10.2, -5.5]}>
          <sphereGeometry args={[0.72, 16, 16]} />
          <meshPhysicalMaterial color="#f4f8fc" roughness={0.06} metalness={0.08} clearcoat={1} clearcoatRoughness={0.03} />
        </mesh>
        {/* Support radôme principal */}
        <mesh position={[3.2, 9.6, -5.5]}>
          <cylinderGeometry args={[0.18, 0.22, 0.5, 8]} />
          <meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} />
        </mesh>
        {/* Radôme secondaire — plus petit, décalé */}
        <mesh position={[2.4, 8.4, -5.8]}>
          <sphereGeometry args={[0.46, 14, 14]} />
          <meshPhysicalMaterial color="#f0f5fa" roughness={0.06} metalness={0.08} clearcoat={1} clearcoatRoughness={0.03} />
        </mesh>
        <mesh position={[2.4, 8.0, -5.8]}>
          <cylinderGeometry args={[0.12, 0.16, 0.36, 8]} />
          <meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} />
        </mesh>
        {/* Radôme latéral — petit, sur le côté de la tour */}
        <mesh position={[4.1, 6.8, -4.8]}>
          <sphereGeometry args={[0.34, 12, 12]} />
          <meshPhysicalMaterial color="#eef3f8" roughness={0.06} metalness={0.08} clearcoat={1} clearcoatRoughness={0.03} />
        </mesh>
        <mesh position={[4.1, 6.5, -4.8]}>
          <cylinderGeometry args={[0.1, 0.14, 0.28, 8]} />
          <meshStandardMaterial color="#8a949e" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Zone pont uniforme — même bleu que le reste du pont */}
        <mesh position={[0.15, 2.78, 2.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 4.2]} />
          <meshStandardMaterial color="#1a5fa8" emissive="#1a5fa8" emissiveIntensity={night ? 0.55 : 0.08} />
        </mesh>
        {/* Hélicoptère retiré du pont */}

        {[-2.6, 0, 2.6].map((x, xi) => (
          <group key={`launch-cell-${xi}`} position={[x, 3.02, -9.1]}>
            <mesh>
              <boxGeometry args={[1.2, 0.34, 1.7]} />
              <meshStandardMaterial color="#56606c" metalness={0.52} roughness={0.24} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.92, 0.08, 1.4]} />
              <meshStandardMaterial color="#10161d" emissive="#6de0ff" emissiveIntensity={night ? 0.62 : 0.08} />
            </mesh>
          </group>
        ))}
        {[-3.2, 3.2].map((x, xi) => (
          <group key={`aa-turret-${xi}`} position={[x, 3.24, 10.5]}>
            <mesh>
              <cylinderGeometry args={[0.42, 0.5, 0.36, 10]} />
              <meshStandardMaterial color="#697481" metalness={0.66} roughness={0.18} />
            </mesh>
            <mesh position={[0.12, 0.18, 0.42]} rotation={[0.15, 0.08, 0]}>
              <boxGeometry args={[0.12, 0.12, 1.2]} />
              <meshStandardMaterial color="#27313b" metalness={0.72} roughness={0.14} />
            </mesh>
            <mesh position={[-0.12, 0.18, 0.42]} rotation={[0.15, -0.08, 0]}>
              <boxGeometry args={[0.12, 0.12, 1.2]} />
              <meshStandardMaterial color="#27313b" metalness={0.72} roughness={0.14} />
            </mesh>
          </group>
        ))}
        <HarborPremiumGuests configs={guests} />
      </group>
    </group>
  );
}


function UltraRealVessel({ kind = 'yacht', night = false, accent = '#7ce7ff' }) {
  if (kind === 'mega') {
    return (
      <group>
        <mesh position={[0, 0.9, 0]}><boxGeometry args={[7.2, 1.8, 28]} /><meshStandardMaterial color="#f8fbff" roughness={0.2} metalness={0.14} /></mesh>
        <mesh position={[0, 0.1, 0]}><boxGeometry args={[6.8, 0.7, 28.4]} /><meshStandardMaterial color="#bf4338" roughness={0.42} metalness={0.16} /></mesh>
        <mesh position={[0, 2.1, -2]}><boxGeometry args={[5.8, 0.9, 16]} /><meshStandardMaterial color="#f8fbff" roughness={0.16} metalness={0.1} /></mesh>
        <mesh position={[0, 3.0, -4]}><boxGeometry args={[4.8, 0.8, 10]} /><meshStandardMaterial color="#f8fbff" roughness={0.16} metalness={0.1} /></mesh>
        <mesh position={[0, 3.8, -6.4]}><boxGeometry args={[3.6, 0.6, 5.6]} /><meshPhysicalMaterial color="#b8d8f4" transparent opacity={0.62} metalness={0.42} roughness={0.05} /></mesh>
        <mesh position={[0, 1.52, 0]}><boxGeometry args={[7.32, 0.06, 28.2]} /><meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={night ? 0.38 : 0.02} /></mesh>
        {Array.from({ length: 10 }).map((_, i) => (
          <React.Fragment key={`mega-window-row-${i}`}>
            <mesh position={[3.32, 1.56 + (i % 3) * 0.42, -10.5 + i * 2.3]}><boxGeometry args={[0.04, 0.14, 1.2]} /><meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={night ? 1.2 : 0.06} /></mesh>
            <mesh position={[-3.32, 1.56 + (i % 3) * 0.42, -10.5 + i * 2.3]}><boxGeometry args={[0.04, 0.14, 1.2]} /><meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={night ? 1.2 : 0.06} /></mesh>
          </React.Fragment>
        ))}
        {[-2.4, 0, 2.4].map((x, i) => <mesh key={`mega-funnel-${i}`} position={[x, 3.8, 5.6]}><boxGeometry args={[0.7, 1.2, 0.9]} /><meshStandardMaterial color={i === 1 ? '#f39c12' : '#3d4550'} roughness={0.38} /></mesh>)}
        {[-2.7, -1.3, 0.1, 1.5, 2.9].map((x, i) => <mesh key={`lifeboat-${i}`} position={[x, 1.9, 8.5]}><boxGeometry args={[0.8, 0.36, 1.5]} /><meshStandardMaterial color="#ffb347" roughness={0.32} /></mesh>)}
      </group>
    );
  }

  if (kind === 'cargo') {
    const containerColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    return (
      <group>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[4.4, 1.5, 18]} /><meshStandardMaterial color="#31485b" roughness={0.7} metalness={0.4} /></mesh>
        <mesh position={[0, -0.04, 0]}><boxGeometry args={[4.0, 0.7, 18.3]} /><meshStandardMaterial color="#b53c32" roughness={0.6} metalness={0.3} /></mesh>
        <mesh position={[0, 0.98, 0]}><boxGeometry args={[4.46, 0.05, 18.2]} /><meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={night ? 0.52 : 0.04} /></mesh>
        {[-1.15, 1.15].map((x, xi) => [-5.5, -2.2, 1.1, 4.4].map((z, zi) => (
          <mesh key={`cargo-box-${xi}-${zi}`} position={[x, 1.75 + xi * 0.48, z]}><boxGeometry args={[1.1, 0.46, 2.2]} /><meshStandardMaterial color={containerColors[(xi * 4 + zi + 6) % containerColors.length]} roughness={0.42} metalness={0.22} /></mesh>
        )))}
        <mesh position={[0, 2.35, 6.8]}><boxGeometry args={[2.6, 1.4, 2.4]} /><meshStandardMaterial color="#31485b" roughness={0.52} metalness={0.24} /></mesh>
        <mesh position={[0, 3.2, 6.8]}><boxGeometry args={[2.1, 0.56, 1.9]} /><meshPhysicalMaterial color="#bfdcf4" transparent opacity={0.58} roughness={0.05} /></mesh>
        {night && [-6.2, -2, 2.2, 6].map((z, i) => <mesh key={`cargo-night-${i}`} position={[0, 3.0, z]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={1.8} /></mesh>)}
      </group>
    );
  }

  if (kind === 'catamaran') {
    return (
      <group>
        {[-0.85, 0.85].map((x, i) => <mesh key={`cat-hull-${i}`} position={[x, 0.2, 0]}><boxGeometry args={[0.72, 0.42, 4.6]} /><meshStandardMaterial color="#f8fbff" roughness={0.18} metalness={0.08} /></mesh>)}
        <mesh position={[0, 0.54, 0.1]}><boxGeometry args={[2.1, 0.26, 2.8]} /><meshStandardMaterial color="#f8fbff" roughness={0.18} metalness={0.08} /></mesh>
        <mesh position={[0, 0.92, -0.2]}><boxGeometry args={[1.7, 0.58, 1.6]} /><meshPhysicalMaterial color="#b8d8f4" transparent opacity={0.62} metalness={0.42} roughness={0.05} /></mesh>
        <mesh position={[0, 2.7, -0.2]}><cylinderGeometry args={[0.05, 0.07, 4.8, 10]} /><meshStandardMaterial color="#2f343d" metalness={0.62} roughness={0.2} /></mesh>
        <mesh position={[0.02, 2.3, 0.4]}><boxGeometry args={[0.02, 2.5, 1.5]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.9} /></mesh>
        <mesh position={[0.02, 1.9, -1.3]}><boxGeometry args={[0.02, 2.0, 1.0]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.86} /></mesh>
        {night && <mesh position={[0, 0.92, 1.5]}><boxGeometry args={[1.9, 0.04, 0.04]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.0} /></mesh>}
      </group>
    );
  }

  if (kind === 'sail') {
    return (
      <group>
        <mesh position={[0, 0.16, 0]}><boxGeometry args={[1.2, 0.42, 4.2]} /><meshStandardMaterial color="#f8fbff" roughness={0.18} metalness={0.08} /></mesh>
        <mesh position={[0, 0.02, 0]}><boxGeometry args={[1.24, 0.08, 4.24]} /><meshStandardMaterial color="#1a5fa8" roughness={0.36} metalness={0.26} /></mesh>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.06, 0.06, 3.7]} /><meshStandardMaterial color="#b8956a" roughness={0.72} /></mesh>
        <mesh position={[0, 2.7, -0.1]}><cylinderGeometry args={[0.04, 0.05, 5.0, 10]} /><meshStandardMaterial color="#2f343d" metalness={0.64} roughness={0.2} /></mesh>
        <mesh position={[0.02, 2.2, 0.5]} rotation={[0, -0.08, 0]}><boxGeometry args={[0.02, 3.0, 1.8]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.92} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0.01, 1.8, -1.4]} rotation={[0.06, 0.04, 0]}><boxGeometry args={[0.02, 2.3, 1.1]} /><meshStandardMaterial color="#fafafa" transparent opacity={0.88} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 0.62, 0.8]}><boxGeometry args={[0.82, 0.32, 1.22]} /><meshPhysicalMaterial color="#6eb5ff" transparent opacity={0.72} roughness={0.08} /></mesh>
        {night && <>
          <mesh position={[0.56, 0.5, -1.62]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2.8} /></mesh>
          <mesh position={[-0.56, 0.5, -1.62]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2.8} /></mesh>
          <mesh position={[0, 2.98, -0.2]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} /></mesh>
        </>}
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.34, 0]}><boxGeometry args={[1.8, 0.68, 5.2]} /><meshStandardMaterial color="#f8fbff" roughness={0.18} metalness={0.08} /></mesh>
      <mesh position={[0, 0.12, 0]}><boxGeometry args={[1.88, 0.14, 5.28]} /><meshStandardMaterial color="#1a2744" roughness={0.34} metalness={0.26} /></mesh>
      <mesh position={[0, 1.0, -0.4]}><boxGeometry args={[1.22, 0.76, 2.3]} /><meshPhysicalMaterial color="#b8d8f4" transparent opacity={0.62} metalness={0.42} roughness={0.05} /></mesh>
      <mesh position={[0, 1.78, 0.9]}><boxGeometry args={[2.2, 0.06, 0.12]} /><meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={night ? 0.7 : 0.06} /></mesh>
      <mesh position={[0, 2.05, 1.8]}><boxGeometry args={[1.2, 0.08, 0.9]} /><meshStandardMaterial color="#ffffff" metalness={0.22} roughness={0.08} /></mesh>
      {night && <>
        <mesh position={[0.82, 0.62, -2.06]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={2.2} /></mesh>
        <mesh position={[-0.82, 0.62, -2.06]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={2.2} /></mesh>
        <mesh position={[0, 0.72, 2.18]}><boxGeometry args={[1.6, 0.04, 0.04]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.0} /></mesh>
      </>}
    </group>
  );
}

function CoastalHarborsAndFleet({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const movingRefs = useRef([]);
  const fleetConfigs = useMemo(() => ([
    { key: 'north_cruise', kind: 'mega', cx: 0, cz: -176, rx: 56, rz: 18, speed: 0.045, offset: 0.2, scale: 1.05, bob: 0.18 },
    { key: 'east_cargo', kind: 'cargo', cx: 108, cz: -126, rx: 10, rz: 18, speed: 0.04, offset: 1.1, scale: 0.7, bob: 0.12 },
    { key: 'west_cargo', kind: 'cargo', cx: -116, cz: -128, rx: 12, rz: 18, speed: -0.038, offset: 2.2, scale: 0.72, bob: 0.12 },
    { key: 'west_yacht', kind: 'yacht', cx: -142, cz: -132, rx: 18, rz: 8, speed: 0.048, offset: 0.9, scale: 0.92, bob: 0.1 },
    { key: 'east_yacht', kind: 'yacht', cx: 88, cz: -138, rx: 16, rz: 7, speed: -0.046, offset: 2.9, scale: 0.9, bob: 0.1 },
    { key: 'south_yacht', kind: 'yacht', cx: -26, cz: -34, rx: 16, rz: 6, speed: 0.05, offset: 1.6, scale: 0.96, bob: 0.09 },
    { key: 'south_catamaran', kind: 'catamaran', cx: 28, cz: -30, rx: 14, rz: 6, speed: -0.048, offset: 2.6, scale: 0.92, bob: 0.09 },
  ]), []);

  const harborAvoidance = useMemo(() => ([
    { x: 0, z: -186, radius: 34, push: 3.8 },
    { x: 98, z: -110, radius: 24, push: 3.4 },
    { x: -98, z: -110, radius: 24, push: 3.4 },
    { x: 0, z: -20, radius: 22, push: 3.1 },
    { x: -24, z: -40, radius: 24, push: 3.6 },
  ]), []);

  const harborConfigs = useMemo(() => ([
    { key: 'north', position: [0, -3.2, -186], rotationY: 0, quay: [52, 1.1, 8], fingers: [-16, -4, 8, 20], moorings: [
      { kind: 'mega', position: [0, 0.95, 15], rotationY: Math.PI, scale: 0.92 },
      { kind: 'cargo', position: [-18, 0.7, -16], rotationY: Math.PI * 0.96, scale: 0.56 },
    ] },
    { key: 'east', position: [98, -3.2, -110], rotationY: -Math.PI / 2, quay: [28, 1.0, 7], fingers: [-8, 0, 8], moorings: [
      { kind: 'cargo', position: [0, 0.72, 12], rotationY: Math.PI / 2, scale: 0.54 },
      { kind: 'yacht', position: [9, 0.6, -14], rotationY: Math.PI / 2 + 0.08, scale: 0.82 },
    ] },
    { key: 'west', position: [-98, -3.2, -110], rotationY: Math.PI / 2, quay: [28, 1.0, 7], fingers: [-8, 0, 8], moorings: [
      { kind: 'cargo', position: [0, 0.72, 12], rotationY: -Math.PI / 2, scale: 0.54 },
      { kind: 'yacht', position: [-9, 0.62, -14], rotationY: -Math.PI / 2 - 0.08, scale: 0.84 },
    ] },
    { key: 'south', position: [0, -3.2, -20], rotationY: 0, quay: [24, 0.9, 6], fingers: [-6, 6], moorings: [
      { kind: 'catamaran', position: [-10, 0.58, 13], rotationY: Math.PI - 0.08, scale: 0.86 },
      { kind: 'yacht', position: [10, 0.62, 14], rotationY: Math.PI + 0.12, scale: 0.88 },
    ] },
  ]), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    movingRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const cfg = fleetConfigs[i];
      const angle = t * cfg.speed + cfg.offset;
      const candidate = new THREE.Vector3(
        cfg.cx + Math.sin(angle) * cfg.rx,
        0,
        cfg.cz + Math.cos(angle) * cfg.rz,
      );
      const adjusted = offsetSeaVehiclePosition(candidate, i % 2 === 0 ? 1 : -1, [...SEA_VEHICLE_OBSTACLES, ...harborAvoidance]);
      ref.position.x = adjusted.x;
      ref.position.z = adjusted.z;
      ref.position.y = -2.15 + Math.sin(t * 0.5 + i) * cfg.bob;
      const nextA = angle + 0.04 * Math.sign(cfg.speed || 1);
      const nextCandidate = new THREE.Vector3(
        cfg.cx + Math.sin(nextA) * cfg.rx,
        0,
        cfg.cz + Math.cos(nextA) * cfg.rz,
      );
      const nextAdjusted = offsetSeaVehiclePosition(nextCandidate, i % 2 === 0 ? 1 : -1, [...SEA_VEHICLE_OBSTACLES, ...harborAvoidance]);
      ref.rotation.y = Math.atan2(nextAdjusted.x - adjusted.x, nextAdjusted.z - adjusted.z) + Math.PI;
      ref.rotation.z = Math.sin(t * 0.45 + i) * 0.03;
      ref.rotation.x = Math.cos(t * 0.35 + i) * 0.018;
      window[`__${cfg.key}Pos`] = { x: adjusted.x, y: ref.position.y + 1.2, z: adjusted.z };
    });
  });

  return (
    <group>
      {harborConfigs.map((harbor) => (
        <group key={harbor.key} position={harbor.position} rotation={[0, harbor.rotationY, 0]}>
          <mesh position={[0, 0.56, 0]}><boxGeometry args={harbor.quay} /><meshStandardMaterial color={night ? '#d7dfe8' : '#f7fbff'} roughness={0.26} metalness={0.18} /></mesh>
          <mesh position={[0, 1.1, 0]}><boxGeometry args={[harbor.quay[0] + 0.2, 0.04, harbor.quay[2] + 0.2]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
          {harbor.fingers.map((x, i) => (
            <group key={`finger-${i}`} position={[x, 0.15, 7.8]}>
              <mesh><boxGeometry args={[2.2, 0.18, 8]} /><meshStandardMaterial color={night ? '#e5edf4' : '#ffffff'} roughness={0.24} metalness={0.12} /></mesh>
              {[-2.6, 0, 2.6].map((z, zi) => <mesh key={`bollard-${zi}`} position={[0.78, 0.18, z]}><cylinderGeometry args={[0.08, 0.1, 0.28, 8]} /><meshStandardMaterial color="#253746" metalness={0.8} roughness={0.1} /></mesh>)}
              {night && [-2.6, 2.6].map((z, zi) => <mesh key={`finger-light-${zi}`} position={[0, 0.35, z]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#fff1c2" emissive="#fff1c2" emissiveIntensity={1.7} /></mesh>)}
            </group>
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <group key={`harbor-light-${i}`} position={[-harbor.quay[0] / 2 + 4 + i * (harbor.quay[0] / 5.4), 0, -2.2]}>
              <mesh position={[0, 2.6, 0]}><cylinderGeometry args={[0.08, 0.1, 5.2, 8]} /><meshStandardMaterial color="#c7d0d9" metalness={0.82} roughness={0.08} /></mesh>
              <mesh position={[0, 5.35, 0]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#fff2c1" emissive="#fff2c1" emissiveIntensity={night ? 2.2 : 0.14} /></mesh>
              {night && <pointLight position={[0, 5.4, 0]} color="#fff2c1" intensity={0.28} distance={6.8} />}
            </group>
          ))}
          {harbor.moorings.map((ship, i) => (
            <group key={`moored-${i}`} position={ship.position} rotation={[0, ship.rotationY, 0]} scale={[ship.scale, ship.scale, ship.scale]}>
              <UltraRealVessel kind={ship.kind} night={night} />
            </group>
          ))}
        </group>
      ))}

      {fleetConfigs.map((cfg, i) => (
        <group key={`moving-fleet-${i}`} ref={(el) => { movingRefs.current[i] = el; }} scale={[cfg.scale, cfg.scale, cfg.scale]}>
          <UltraRealVessel kind={cfg.kind} night={night} accent={i % 2 === 0 ? '#7ce7ff' : '#ffd870'} />
        </group>
      ))}
    </group>
  );
}

// ─── SEA WALLS — Digues et barrières anti-vagues ────────────
function SeaWalls({ tod }) {
  return null;
}

// ─── CARGO MARCHANDISE — Navigation autonome fluide (comme le porte-avions) ───
function CargoShipAutonomous({ tod }) {
  const groupRef = useRef();
  const night = tod < 0.18 || tod > 0.82;

  const waypoints = useMemo(() => [
    [122, 44],
    [136, -8],
    [128, -72],
    [102, -116],
    [68, -146],
    [22, -166],
    [-38, -170],
    [-96, -156],
    [-138, -126],
    [-154, -74],
    [-150, -14],
    [-124, 50],
    [-76, 98],
    [-14, 124],
    [46, 114],
    [90, 86],
    [116, 56],
  ], []);
  const seaObstacles = useMemo(() => ([
    { x: 55, z: -20, radius: 96, push: 5.6 },   // Nouveau Monde (anti-intrusion renforcé)
    { x: -16, z: 160, radius: 86, push: 5.4 },  // Île tropicale
    { x: 36, z: 22, radius: 34, push: 2.3 },    // Front plage / quai
    { x: 20, z: -74, radius: 44, push: 2.9 },   // Bande côtière sud-est
  ]), []);
  const wpRef = useRef(0);
  const posRef = useRef(new THREE.Vector3(108, 0, 30));
  const velRef = useRef(new THREE.Vector3());
  const yawRef = useRef(0);
  const cargoSpeed = 0.32;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const wp = waypoints[wpRef.current];
    const target = new THREE.Vector3(wp[0], 0, wp[1]);
    const pos = posRef.current;
    const toTarget = new THREE.Vector3().subVectors(target, pos);
    const dist = toTarget.length();

    if (dist < 8) {
      wpRef.current = (wpRef.current + 1) % waypoints.length;
    }

    const desired = toTarget.normalize().multiplyScalar(cargoSpeed);

    // Évitement porte-avions
    const cpPos = window.__carrierPos;
    if (cpPos) {
      const dx = cpPos.x - pos.x, dz = cpPos.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 60 && d > 0.1) {
        const perpX = -desired.z, perpZ = desired.x;
        const side = (perpX * dx + perpZ * dz) > 0 ? -1 : 1;
        const str = Math.min(0.4, (1 - d / 60) * 0.5);
        desired.x += perpX * side * str;
        desired.z += perpZ * side * str;
        desired.normalize().multiplyScalar(cargoSpeed);
      }
    }

    // Évitement îles / sols émergés — empêche toute coupe dans le relief
    seaObstacles.forEach(({ x, z, radius, push }) => {
      const dx = pos.x - x;
      const dz = pos.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < radius && d > 0.1) {
        const str = Math.min(push, (1 - d / radius) * push);
        desired.x += (dx / d) * str;
        desired.z += (dz / d) * str;
      }
    });
    if (desired.lengthSq() > 0.0001) {
      desired.normalize().multiplyScalar(cargoSpeed);
    }

    // Steering fluide
    velRef.current.lerp(desired, 0.015);
    pos.add(velRef.current.clone().multiplyScalar(delta * 60));

    // Garde-fou : z > -50
    if (pos.z < -50) pos.z = -50;

    // Hard clamp : ne jamais laisser le cargo pénétrer les îles / sols du Nouveau Monde
    seaObstacles.forEach(({ x, z, radius }) => {
      const dx = pos.x - x;
      const dz = pos.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < radius + 12) {
        const safeDist = radius + 12;
        const nx = d > 0.001 ? dx / d : 1;
        const nz = d > 0.001 ? dz / d : 0;
        pos.x = x + nx * safeDist;
        pos.z = z + nz * safeDist;
      }
    });

    groupRef.current.position.x = pos.x;
    groupRef.current.position.z = pos.z;
    groupRef.current.position.y = -2.45 + Math.sin(t * 0.34) * 0.14;

    // Rotation douce
    if (velRef.current.lengthSq() > 0.0001) {
      const targetYaw = Math.atan2(velRef.current.x, velRef.current.z);
      yawRef.current += (targetYaw - yawRef.current) * 0.025;
      groupRef.current.rotation.y = yawRef.current;
    }
    groupRef.current.rotation.x = Math.sin(t * 0.22) * 0.01;
    groupRef.current.rotation.z = Math.sin(t * 0.42) * 0.012;

    window.__cargoPos = { x: pos.x, y: -2.45, z: pos.z };
  });

  const containerColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6'];

  return (
    <group ref={groupRef} position={[108, -3.75, 30]}>
      {/* Coque */}
      <mesh position={[0, 0.6, 0]}><boxGeometry args={[4, 1.8, 16]} /><meshStandardMaterial color="#31485b" roughness={0.7} metalness={0.4} /></mesh>
      <mesh position={[0, 0, 0]}><boxGeometry args={[3.6, 0.8, 16.4]} /><meshStandardMaterial color="#b53c32" roughness={0.6} metalness={0.3} /></mesh>
      {/* Ligne blanche */}
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[4.05, 0.12, 16.2]} /><meshStandardMaterial color="#f1f5f7" roughness={0.3} /></mesh>
      <mesh position={[0, 1.06, 0]}><boxGeometry args={[4.08, 0.05, 16.25]} /><meshStandardMaterial color="#ffffff" emissive="#7ce7ff" emissiveIntensity={night ? 0.7 : 0.04} metalness={0.72} roughness={0.08} /></mesh>
      {/* Conteneurs (2 rangées × 4) */}
      {[-1.2, 1.2].map((x, xi) => (
        [-4, -1, 2, 5].map((z, zi) => (
          <mesh key={`cont-${xi}-${zi}`} position={[x * 0.7, 1.8 + xi * 0.6, z]}>
            <boxGeometry args={[1.2, 0.55, 2.4]} />
            <meshStandardMaterial color={containerColors[(xi * 4 + zi) % 8]} roughness={0.5} metalness={0.3} />
          </mesh>
        ))
      ))}
      {/* Pont / passerelle arrière */}
      <mesh position={[0, 2.4, 6.5]}><boxGeometry args={[2.4, 1.6, 2]} /><meshStandardMaterial color="#31485b" roughness={0.6} metalness={0.3} /></mesh>
      <mesh position={[0, 3.4, 6.5]}><boxGeometry args={[2, 0.6, 1.6]} /><meshPhysicalMaterial color={night ? '#0a1a30' : '#a0b8d0'} transparent opacity={0.5} metalness={0.6} /></mesh>
      {[1.95, -1.95].map((x, railIndex) => (
        <mesh key={`cargo-rail-${railIndex}`} position={[x, 1.42, 0]}><boxGeometry args={[0.05, 0.18, 14.8]} /><meshStandardMaterial color="#e7eef5" metalness={0.84} roughness={0.08} /></mesh>
      ))}
      {night && [-5.5, -2.2, 1.1, 4.4].map((z, lightIndex) => (
        <mesh key={`cargo-deck-light-${lightIndex}`} position={[0, 3.15, z]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={1.9} /></mesh>
      ))}
      {night && [-5.5, -1.8, 1.8, 5.2].map((z, portIndex) => (
        <mesh key={`cargo-port-${portIndex}`} position={[1.96, 1.22, z]}><boxGeometry args={[0.04, 0.12, 0.36]} /><meshStandardMaterial color="#ffe6a8" emissive="#ffe6a8" emissiveIntensity={1.3} /></mesh>
      ))}
      {/* Cheminée */}
      <mesh position={[0, 3.6, 5.5]}><cylinderGeometry args={[0.3, 0.4, 1.4, 8]} /><meshStandardMaterial color="#f39c12" roughness={0.4} metalness={0.3} /></mesh>
      {/* Mât */}
      <mesh position={[0, 3.5, -4]}><cylinderGeometry args={[0.04, 0.05, 3, 6]} /><meshStandardMaterial color="#808488" metalness={0.7} /></mesh>
    </group>
  );
}

// ─── PORTS DE CHARGEMENT — Île (A) + Côté Est continent (B) ────────────
function CargoPorts({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const conc = night ? '#c0c4cc' : '#f0f2f6';
  const metal = night ? '#3a4050' : '#808890';

  return (
    <group>
      {/* ═══ PORT A — Près de l'île tropicale ═══ */}
      <group position={[-16, -3.2, 136]}>
        {/* Quai principal */}
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[30, 1, 8]} /><meshStandardMaterial color={conc} roughness={0.15} metalness={0.1} /></mesh>
        <mesh position={[0, 1.12, 0]}><boxGeometry args={[30.2, 0.04, 8.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {/* Bollards (6) */}
        {[-12, -6, 0, 6, 12].map((x, i) => (
          <group key={`pa-bol-${i}`} position={[x, 1.1, -4]}>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.18, 0.22, 0.4, 8]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.2} /></mesh>
            <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.22, 0.18, 0.1, 8]} /><meshStandardMaterial color={metal} metalness={0.6} /></mesh>
          </group>
        ))}
        {/* Grue de chargement */}
        <group position={[8, 1.1, 0]}>
          <mesh position={[0, 4, 0]}><boxGeometry args={[0.4, 8, 0.4]} /><meshStandardMaterial color="#f0c020" roughness={0.4} metalness={0.4} /></mesh>
          <mesh position={[2, 8.2, 0]}><boxGeometry args={[6, 0.3, 0.4]} /><meshStandardMaterial color="#f0c020" roughness={0.4} metalness={0.4} /></mesh>
          <mesh position={[4, 7, 0]}><boxGeometry args={[0.06, 2.4, 0.06]} /><meshStandardMaterial color="#333" metalness={0.7} /></mesh>
        </group>
        {/* Conteneurs empilés */}
        {[[-8, 0], [-5, 0], [-2, 0], [-8, 0.7], [-5, 0.7]].map(([cx, cy], ci) => (
          <mesh key={`pa-cont-${ci}`} position={[cx, 1.4 + cy, 2]}><boxGeometry args={[2.4, 0.65, 1.2]} /><meshStandardMaterial color={['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'][ci]} roughness={0.5} metalness={0.3} /></mesh>
        ))}
        {/* Enseigne */}
        <Text position={[0, 3, 4.1]} fontSize={0.6} color={night ? '#00FFFF' : '#1a5fa8'} anchorX="center" fontWeight="bold">PORT AZURE</Text>
      </group>

      {/* ═══ PORT B — Côté Est du continent ═══ */}
      <group position={[88, -3.2, -48]}>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[8, 1, 26]} /><meshStandardMaterial color={conc} roughness={0.15} metalness={0.1} /></mesh>
        <mesh position={[0, 1.12, 0]}><boxGeometry args={[8.2, 0.04, 26.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {[-10, -4, 2, 8].map((z, i) => (
          <group key={`pb-bol-${i}`} position={[4, 1.1, z]}>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.18, 0.22, 0.4, 8]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.2} /></mesh>
          </group>
        ))}
        {/* Grue */}
        <group position={[-2, 1.1, -6]}>
          <mesh position={[0, 4, 0]}><boxGeometry args={[0.4, 8, 0.4]} /><meshStandardMaterial color="#f0c020" roughness={0.4} metalness={0.4} /></mesh>
          <mesh position={[0, 8.2, 3]}><boxGeometry args={[0.4, 0.3, 8]} /><meshStandardMaterial color="#f0c020" roughness={0.4} metalness={0.4} /></mesh>
        </group>
        {/* Conteneurs */}
        {[[-2, -2], [-2, 1], [-2, 4], [-2, 7]].map(([cx, cz], ci) => (
          <mesh key={`pb-cont-${ci}`} position={[cx, 1.4, cz]}><boxGeometry args={[1.2, 0.65, 2.4]} /><meshStandardMaterial color={['#e67e22', '#1abc9c', '#e74c3c', '#3498db'][ci]} roughness={0.5} metalness={0.3} /></mesh>
        ))}
        <Text position={[4.1, 3, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.5} color={night ? '#00FFFF' : '#1a5fa8'} anchorX="center" fontWeight="bold">PORT EST</Text>
      </group>
    </group>
  );
}

// ─── ÎLE TROPICALE — Grande île en pleine mer au sud ────────────
function TropicalIsland({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  const sandC = night ? '#a08860' : '#f0e0c0';
  const rockC = night ? '#4a4a50' : '#8a8a90';
  const grassC = night ? '#1a3a20' : '#4a8a50';
  const waterC = night ? '#0a3050' : '#40b8d8';
  const concreteC = night ? '#c0c4cc' : '#f0f2f6';

  return (
    <group position={[-16, -3.2, 160]}>
      {/* ═══ SOL DE BASE — plateforme rocheuse surélevée ═══ */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[42, 48, 4, 24]} />
        <meshStandardMaterial color={rockC} roughness={0.85} metalness={0.1} />
      </mesh>

      {/* ═══ TERRAIN PRINCIPAL — sable et herbe ═══ */}
      <mesh position={[0, 3.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[40, 24]} />
        <meshStandardMaterial color={sandC} roughness={0.95} />
      </mesh>
      {/* Zones herbeuses (vallées) */}
      {[[-12, -8, 16, 12], [10, 6, 14, 10], [-6, 14, 12, 8], [16, -4, 10, 8]].map(([x, z, w, h], i) => (
        <mesh key={`grass-${i}`} position={[x, 3.54, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={grassC} roughness={0.95} />
        </mesh>
      ))}

      {/* ═══ COLLINES / VALLÉES — relief ═══ */}
      <mesh position={[-18, 5, -10]}><sphereGeometry args={[8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={grassC} roughness={0.9} /></mesh>
      <mesh position={[14, 4.5, -14]}><sphereGeometry args={[6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={grassC} roughness={0.9} /></mesh>
      <mesh position={[0, 4.2, 16]}><sphereGeometry args={[5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={sandC} roughness={0.95} /></mesh>

      {/* ═══ GROTTES — entrées creusées dans les collines ═══ */}
      {[[-22, 4, -8, 0.4], [16, 3.8, -12, -0.6]].map(([gx, gy, gz, rot], i) => (
        <group key={`grotte-${i}`} position={[gx, gy, gz]} rotation={[0, rot, 0]}>
          <mesh position={[0, 0, 0]}><boxGeometry args={[3, 2.5, 2]} /><meshStandardMaterial color="#1a1a1a" roughness={0.95} /></mesh>
          <mesh position={[0, 1.2, -0.5]}><sphereGeometry args={[1.5, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={rockC} roughness={0.9} /></mesh>
        </group>
      ))}

      {/* ═══ LAC INTÉRIEUR — enclave où la mer entre ═══ */}
      <group position={[8, 3.5, 8]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[8, 18]} /><meshPhysicalMaterial color={waterC} transparent opacity={0.75} roughness={0.01} metalness={0.3} /></mesh>
        {/* Bords rocheux du lac */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><ringGeometry args={[7.5, 9, 18]} /><meshStandardMaterial color={rockC} roughness={0.85} /></mesh>
        {/* Canal vers la mer */}
        <mesh position={[0, -0.02, 12]}><boxGeometry args={[3, 0.15, 16]} /><meshPhysicalMaterial color={waterC} transparent opacity={0.7} roughness={0.01} /></mesh>
      </group>

      {/* ═══ CHEMINS BÉTON BLANC ═══ */}
      {/* Chemin principal tour de l'île */}
      <mesh position={[0, 3.56, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[28, 30, 24]} /><meshStandardMaterial color={concreteC} roughness={0.15} /></mesh>
      {/* Chemin vers le lac */}
      <mesh position={[4, 3.56, 4]}><boxGeometry args={[2, 0.08, 12]} /><meshStandardMaterial color={concreteC} roughness={0.15} /></mesh>
      {/* Chemin vers le sommet */}
      <mesh position={[-10, 3.56, -4]}><boxGeometry args={[2, 0.08, 14]} /><meshStandardMaterial color={concreteC} roughness={0.15} /></mesh>

      {/* ═══ PROTECTION BORDS — béton + rochers + sable ═══ */}
      {/* Mur de béton périmètre */}
      {Array.from({ length: 20 }).map((_, i) => {
        const a = (i / 20) * Math.PI * 2;
        const r = 42;
        return (
          <mesh key={`seawall-${i}`} position={[Math.cos(a) * r, 2.5, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <boxGeometry args={[14, 2.5, 1]} />
            <meshStandardMaterial color={concreteC} roughness={0.2} metalness={0.1} />
          </mesh>
        );
      })}
      {/* Gros rochers éparpillés */}
      {[[-38, 0], [-28, 22], [0, 36], [30, 18], [36, -8], [20, -32], [-10, -36], [-34, -14]].map(([rx, rz], i) => (
        <mesh key={`rock-${i}`} position={[rx, 2 + Math.random(), rz]}>
          <dodecahedronGeometry args={[2 + i * 0.3, 0]} />
          <meshStandardMaterial color={rockC} roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
      {/* Plages de sable sur les bords */}
      {[[-30, 20, 18], [20, 28, 14], [0, -34, 16], [-26, -20, 12]].map(([bx, bz, bw], i) => (
        <mesh key={`beach-${i}`} position={[bx, 3.52, bz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[bw, 6]} />
          <meshStandardMaterial color={sandC} roughness={0.96} />
        </mesh>
      ))}

      {/* ═══ PALMIERS ET ARBRES (16) ═══ */}
      {[
        [-14, -4], [-8, -12], [0, -18], [10, -16], [18, -8], [22, 0],
        [-20, 4], [-24, -6], [-16, 14], [-4, 20], [6, -22], [14, 12],
        [-10, 22], [20, 16], [-28, 8], [26, -4],
      ].map(([tx, tz], i) => (
        <group key={`palm-${i}`} position={[tx, 3.5, tz]}>
          <mesh position={[0, 2.5, 0]} rotation={[0.08 * (i % 3 - 1), 0, 0.06 * (i % 4 - 2)]}>
            <cylinderGeometry args={[0.12, 0.18, 5, 8]} />
            <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
          </mesh>
          <mesh position={[0, 5.5, 0]}>
            <sphereGeometry args={[1.8 + (i % 3) * 0.3, 8, 8]} />
            <meshStandardMaterial color={i % 3 === 0 ? (night ? '#1a3020' : '#2d7a2d') : (night ? '#1a3a20' : '#3a8a3a')} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* ═══ VÉGÉTATION BASSE (buissons) ═══ */}
      {[[-6, -6], [8, -10], [-14, 10], [12, 18], [-20, -2], [16, -18], [-8, 16], [0, -24]].map(([vx, vz], i) => (
        <mesh key={`bush-${i}`} position={[vx, 3.8, vz]}>
          <sphereGeometry args={[0.8 + i * 0.06, 6, 6]} />
          <meshStandardMaterial color={night ? '#1a3020' : '#3a7a3a'} roughness={0.9} />
        </mesh>
      ))}

      {/* ═══ FAUNE — oiseaux et tortues ═══ */}
      {[[-30, 18], [24, -26], [-18, -30], [28, 14]].map(([fx, fz], i) => (
        <group key={`fauna-${i}`} position={[fx, 3.6, fz]}>
          <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.15, 6, 6]} /><meshStandardMaterial color={i % 2 === 0 ? '#fff' : '#5a7a4a'} /></mesh>
          {i % 2 === 0 && <mesh position={[0.12, 0.12, 0]}><coneGeometry args={[0.03, 0.1, 4]} /><meshStandardMaterial color="#f0a030" /></mesh>}
        </group>
      ))}
    </group>
  );
}

// ─── BACK SCENERY — Décor arrière 360° pour l'exploration ────────────
function BackScenery({ tod }) {
  const night = tod < 0.18 || tod > 0.82;
  
  // PREMIUM SKYLINE — 30+ buildings with varied architecture
  const premiumBuildings = useMemo(() => ([
    { x: -118, z: -176, w: 14, d: 14, h: 44, style: 'glass-tower', crown: true },
    { x: -104, z: -150, w: 18, d: 16, h: 58, style: 'supertall', spire: true },
    { x: -88, z: -172, w: 12, d: 12, h: 36, style: 'modern-slim' },
    { x: -74, z: -146, w: 20, d: 18, h: 62, style: 'glass-tower', crown: true },
    { x: -58, z: -168, w: 16, d: 14, h: 40, style: 'residential' },
    { x: -42, z: -154, w: 14, d: 14, h: 34, style: 'art-deco', setbacks: true },
    { x: -24, z: -170, w: 18, d: 16, h: 46, style: 'office' },
    { x: -6, z: -150, w: 12, d: 12, h: 32, style: 'concrete', antenna: true },
    { x: 10, z: -170, w: 22, d: 18, h: 68, style: 'supertall', spire: true },
    { x: 28, z: -158, w: 16, d: 14, h: 52, style: 'glass-tower', crown: true },
    { x: 46, z: -172, w: 18, d: 16, h: 44, style: 'modern-slim' },
    { x: 64, z: -154, w: 20, d: 18, h: 60, style: 'office', setbacks: true },
    { x: 82, z: -168, w: 14, d: 14, h: 38, style: 'residential' },
    { x: 100, z: -150, w: 18, d: 16, h: 50, style: 'glass-tower', crown: true },
    { x: 116, z: -172, w: 16, d: 16, h: 42, style: 'art-deco', antenna: true },
  ]), []);

  // Style configs — realistic muted tones
  const styles = {
    'glass-tower':    { day: '#b8c8d8', night: '#1e2e3e', glass: true, metalness: 0.7, roughness: 0.1, frame: '#4a5a6a' },
    'concrete':       { day: '#c0c4c8', night: '#3a3e44', glass: false, metalness: 0.15, roughness: 0.8, frame: '#555' },
    'art-deco':       { day: '#d4c8a8', night: '#4a4238', glass: false, metalness: 0.35, roughness: 0.5, frame: '#6a5a4a' },
    'modern-slim':    { day: '#a0b0c0', night: '#2a3540', glass: true, metalness: 0.6, roughness: 0.15, frame: '#506070' },
    'office':         { day: '#b8bcc2', night: '#383c42', glass: false, metalness: 0.25, roughness: 0.6, frame: '#555' },
    'residential':    { day: '#ddd4c4', night: '#454038', glass: false, metalness: 0.1, roughness: 0.85, frame: '#7a6a5a' },
    'supertall':      { day: '#9aaab8', night: '#1a2530', glass: true, metalness: 0.8, roughness: 0.06, frame: '#3a4a5a' },
  };

  return (
    <group>
      {/* Quay moved after the carrier — port entrance left fully open */}
      <mesh position={[34, -0.52, 24]} rotation={[0, -0.1, 0]}>
        <boxGeometry args={[30, 1.1, 2.1]} />
        <meshStandardMaterial color={night ? '#d7dfe8' : '#f7fbff'} roughness={0.28} metalness={0.22} />
      </mesh>
      <mesh position={[34, 0.18, 24.82]} rotation={[0, -0.1, 0]}>
        <boxGeometry args={[29, 0.08, 0.18]} />
        <meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 0.95 : 0.15} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => {
        const x = 22 + i * 4.1;
        return (
          <group key={`quay-post-${i}`} position={[x, -0.05, 24.72]}>
            <mesh position={[0, 0.36, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.72, 8]} />
              <meshStandardMaterial color="#243646" metalness={0.68} roughness={0.16} />
            </mesh>
            <mesh position={[0, 0.78, 0]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#fff3c6" emissive="#fff3c6" emissiveIntensity={night ? 1.6 : 0.12} />
            </mesh>
          </group>
        );
      })}

      {/* Vie portuaire — éclairage de quai, palettes, chariot et dockers */}
      {[[24, 22], [34, 24], [44, 26]].map(([x, z], i) => (
        <group key={`quay-light-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 2.8, 0]}><cylinderGeometry args={[0.09, 0.11, 5.6, 8]} /><meshStandardMaterial color="#7b858f" metalness={0.7} roughness={0.16} /></mesh>
          <mesh position={[0, 5.75, 0]}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#fff2c1" emissive="#fff2c1" emissiveIntensity={night ? 2.2 : 0.18} /></mesh>
          {night && <pointLight position={[0, 5.8, 0]} color="#fff2c1" intensity={0.32} distance={7} />}
        </group>
      ))}
      {[[27, 24, 2], [39, 22.8, 3]].map(([x, z, count], i) => (
        <group key={`pallet-stack-${i}`} position={[x, 0, z]}>
          {Array.from({ length: count }).map((_, layer) => (
            <mesh key={`pallet-${layer}`} position={[0, 0.16 + layer * 0.24, 0]}>
              <boxGeometry args={[1.6, 0.18, 1.1]} />
              <meshStandardMaterial color={layer % 2 === 0 ? '#c28e5d' : '#b87f4d'} roughness={0.82} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[35.5, 0, 21.5]} rotation={[0, -0.28, 0]}>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.8, 0.84, 1.2]} /><meshStandardMaterial color="#f0b400" metalness={0.24} roughness={0.4} /></mesh>
        <mesh position={[-0.35, 1.05, 0]}><boxGeometry args={[0.9, 0.54, 0.9]} /><meshStandardMaterial color="#36414d" roughness={0.32} /></mesh>
        <mesh position={[0.88, 0.88, 0]}><boxGeometry args={[0.12, 1.4, 0.12]} /><meshStandardMaterial color="#cfd8df" metalness={0.86} roughness={0.1} /></mesh>
        <mesh position={[1.28, 1.34, 0]}><boxGeometry args={[0.92, 0.08, 0.08]} /><meshStandardMaterial color="#cfd8df" metalness={0.86} roughness={0.1} /></mesh>
      </group>
      {[[29, 23.4, '#384452'], [41, 24.2, '#6b1828']].map(([x, z, top], i) => (
        <group key={`dock-worker-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.82, 0]}><capsuleGeometry args={[0.11, 0.56, 6, 10]} /><meshStandardMaterial color={top} roughness={0.72} /></mesh>
          <mesh position={[0, 0.42, 0]}><capsuleGeometry args={[0.06, 0.42, 4, 8]} /><meshStandardMaterial color="#25323d" roughness={0.72} /></mesh>
          {[-0.08, 0.08].map((lx, li) => <group key={`dock-worker-leg-${li}`} position={[lx, 0.3, 0]}><mesh position={[0, -0.16, 0]}><capsuleGeometry args={[0.04, 0.3, 4, 8]} /><meshStandardMaterial color="#25323d" roughness={0.72} /></mesh></group>)}
          {[-0.14, 0.14].map((ax, ai) => <group key={`dock-worker-arm-${ai}`} position={[ax, 1.02, 0]}><mesh position={[0, -0.18, 0]}><capsuleGeometry args={[0.032, 0.22, 4, 8]} /><meshStandardMaterial color={top} roughness={0.72} /></mesh><mesh position={[0, -0.33, 0.02]}><sphereGeometry args={[0.032, 8, 8]} /><meshStandardMaterial color={i === 0 ? '#b87f56' : '#8a5b40'} roughness={0.48} /></mesh></group>)}
          <mesh position={[0, 1.38, 0]} scale={[1, 1.08, 0.96]}><sphereGeometry args={[0.13, 10, 10]} /><meshStandardMaterial color={i === 0 ? '#b87f56' : '#8a5b40'} roughness={0.86} /></mesh>
          <mesh position={[0, 1.46, -0.01]}><sphereGeometry args={[0.135, 10, 10, 0, Math.PI * 2, 0, Math.PI / 1.75]} /><meshStandardMaterial color={i === 0 ? '#2f241d' : '#1b1b1d'} roughness={0.72} /></mesh>
          <mesh position={[-0.04, 1.39, 0.11]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
          <mesh position={[0.04, 1.39, 0.11]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
          <mesh position={[-0.042, 1.39, 0.122]}><sphereGeometry args={[0.005, 8, 8]} /><meshStandardMaterial color="#15181d" /></mesh>
          <mesh position={[0.042, 1.39, 0.122]}><sphereGeometry args={[0.005, 8, 8]} /><meshStandardMaterial color="#15181d" /></mesh>
          <mesh position={[0, 1.33, 0.122]} rotation={[0.14, 0, 0]}><capsuleGeometry args={[0.015, 0.02, 4, 8]} /><meshStandardMaterial color="#c05b5b" roughness={0.42} /></mesh>
        </group>
      ))}
      {[[31.5, 22.4], [32.2, 21.7], [32.9, 21]].map(([x, z], i) => (
        <group key={`quay-cone-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.16, 0]}><coneGeometry args={[0.1, 0.32, 8]} /><meshStandardMaterial color="#ff7f1f" roughness={0.42} /></mesh>
          <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.12, 0.12, 0.04, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.24} /></mesh>
        </group>
      ))}

      {/* === WHITE BRIDGE with clear boat passage === */}
      {/* Left bridge pillar */}
      <mesh position={[-8.5, 1.5, -40]}>
        <boxGeometry args={[2, 6, 2.5]} />
        <meshStandardMaterial color={night ? '#c8ccd5' : '#f0f2f6'} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Right bridge pillar */}
      <mesh position={[8.5, 1.5, -40]}>
        <boxGeometry args={[2, 6, 2.5]} />
        <meshStandardMaterial color={night ? '#c8ccd5' : '#f0f2f6'} roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Bridge deck — white horizontal span */}
      <mesh position={[0, 5, -40]}>
        <boxGeometry args={[20, 0.8, 3]} />
        <meshStandardMaterial color={night ? '#d8dce5' : '#ffffff'} roughness={0.25} metalness={0.35} />
      </mesh>
      {/* Bridge railings — white */}
      <mesh position={[0, 5.6, -38.7]}>
        <boxGeometry args={[20, 0.5, 0.1]} />
        <meshStandardMaterial color={night ? '#e0e4ea' : '#ffffff'} roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, 5.6, -41.3]}>
        <boxGeometry args={[20, 0.5, 0.1]} />
        <meshStandardMaterial color={night ? '#e0e4ea' : '#ffffff'} roughness={0.3} metalness={0.3} />
      </mesh>
      {night && Array.from({ length: 6 }).map((_, i) => {
        const x = -7.5 + i * 3;
        return (
          <group key={`bridge-light-${i}`} position={[x, 5.48, -40]}>
            <mesh><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color="#fff1bf" emissive="#fff1bf" emissiveIntensity={1.8} /></mesh>
            <pointLight position={[0, 0, 0]} color="#fff1bf" intensity={0.25} distance={3.2} />
          </group>
        );
      })}
      {/* Bridge arch — clear opening for boats (gap = 15 units wide, ~4 units tall) */}
      <mesh position={[-8.5, 3, -40]}>
        <boxGeometry args={[0.5, 1, 2.8]} />
        <meshStandardMaterial color={night ? '#d0d4dc' : '#f5f5f5'} roughness={0.3} metalness={0.35} />
      </mesh>
      <mesh position={[8.5, 3, -40]}>
        <boxGeometry args={[0.5, 1, 2.8]} />
        <meshStandardMaterial color={night ? '#d0d4dc' : '#f5f5f5'} roughness={0.3} metalness={0.35} />
      </mesh>
      {/* Bridge navigation lights — green (starboard) and red (port) */}
      <mesh position={[-7.5, 4.5, -38.5]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={night ? 3 : 0.8} />
      </mesh>
      <mesh position={[7.5, 4.5, -38.5]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={night ? 3 : 0.8} />
      </mesh>
      {/* Bridge night illumination */}
      {night && (
        <>
        </>
      )}

      {/* Belvédères waterfront autour du pont */}
      {[[-22, -46.5], [22, -46.5]].map(([x, z], i) => (
        <group key={`bridge-belvedere-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[9, 0.36, 6]} /><meshStandardMaterial color={night ? '#dce5ed' : '#f7fbff'} roughness={0.24} metalness={0.16} /></mesh>
          <mesh position={[0, 1.22, -2.7]}><boxGeometry args={[8.4, 0.08, 0.08]} /><meshStandardMaterial color="#a6e7ff" emissive="#a6e7ff" emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
          {[[-3.6, 0], [0, 0], [3.6, 0]].map(([tx, tz], ti) => (
            <group key={`belvedere-table-${ti}`} position={[tx, 0.2, tz]}>
              <mesh position={[0, 0.74, 0]}><cylinderGeometry args={[0.56, 0.62, 0.12, 12]} /><meshStandardMaterial color="#f4f7fa" roughness={0.16} /></mesh>
              <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.06, 0.08, 0.72, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.82} roughness={0.08} /></mesh>
            </group>
          ))}
          {night && <pointLight position={[0, 1.3, 0]} color="#7ce7ff" intensity={0.18} distance={5} />}
        </group>
      ))}

      <mesh position={[0, -1.22, -44.2]}>
        <boxGeometry args={[140, 0.48, 2.2]} />
        <meshStandardMaterial color={night ? '#edf5fb' : '#ffffff'} roughness={0.26} metalness={0.18} />
      </mesh>
      {night && Array.from({ length: 10 }).map((_, i) => {
        const x = -60 + i * 12;
        return (
          <group key={`shore-light-${i}`} position={[x, -0.96, -45.2]}>
            <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.04, 0.05, 0.56, 8]} /><meshStandardMaterial color="#d0d8df" metalness={0.88} roughness={0.08} /></mesh>
            <mesh position={[0, 0.68, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#fff1bf" emissive="#fff1bf" emissiveIntensity={1.6} /></mesh>
          </group>
        );
      })}
      
      {/* ========== PREMIUM CITY SKYLINE ========== */}
      {premiumBuildings.map((b, i) => {
        const s = styles[b.style] || styles['concrete'];
        const bodyColor = night ? s.night : s.day;
        const numFloors = Math.floor(b.h / 3);
        const cols = Math.max(2, Math.floor(b.w / 1.6));
        const colsD = Math.max(2, Math.floor(b.d / 1.6));
        const winW = 0.55;
        const winH = 1.1;
        const spacing = b.w / (cols + 1);
        const spacingD = b.d / (colsD + 1);
        
        return (
          <group key={`bldg${i}`} position={[b.x, 0, b.z]}>
            
            {/* ── MAIN BODY ── */}
            <mesh position={[0, b.h / 2, 0]}>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={bodyColor} metalness={s.metalness} roughness={s.roughness} />
            </mesh>
            
            {/* ── BASE / PLINTH ── */}
            <mesh position={[0, 1.8, 0]}>
              <boxGeometry args={[b.w + 0.25, 3.6, b.d + 0.25]} />
              <meshStandardMaterial color={night ? '#3a3e44' : '#8a8e92'} metalness={0.2} roughness={0.75} />
            </mesh>
            
            {/* ── CORNICE ── */}
            <mesh position={[0, b.h + 0.08, 0]}>
              <boxGeometry args={[b.w + 0.2, 0.16, b.d + 0.2]} />
              <meshStandardMaterial color={night ? '#4a4e55' : '#a0a4a8'} metalness={0.3} roughness={0.5} />
            </mesh>
            
            {/* ── VERTICAL PILASTERS — max 4 per side ── */}
            {Array.from({ length: Math.min(cols + 1, 4) }).map((_, pi) => {
              const px = pi * (b.w / Math.min(cols, 3)) - b.w / 2;
              return (
                <React.Fragment key={`pil${pi}`}>
                  <mesh position={[px, b.h / 2, b.d / 2 + 0.05]}>
                    <boxGeometry args={[0.12, b.h - 3.6, 0.1]} />
                    <meshStandardMaterial color={night ? '#2a2e35' : '#707478'} metalness={0.3} roughness={0.6} />
                  </mesh>
                </React.Fragment>
              );
            })}
            {Array.from({ length: Math.min(colsD + 1, 4) }).map((_, pi) => {
              const pz = pi * (b.d / Math.min(colsD, 3)) - b.d / 2;
              return (
                <mesh key={`pilS${pi}`} position={[b.w / 2 + 0.05, b.h / 2, pz]}>
                  <boxGeometry args={[0.1, b.h - 3.6, 0.12]} />
                  <meshStandardMaterial color={night ? '#2a2e35' : '#707478'} metalness={0.3} roughness={0.6} />
                </mesh>
              );
            })}
            
            {/* ── FLOORS + WINDOWS — single mesh per window, no frames ── */}
            {Array.from({ length: numFloors }).map((_, fi) => {
              const floorY = fi * 3 + 1.5;
              const bandY = fi * 3 + 3;
              const litRatio = night ? 0.85 : 0;
              return (
                <group key={`fl${fi}`}>
                  {/* Floor slab — front only */}
                  <mesh position={[0, floorY, b.d / 2 + 0.07]}>
                    <boxGeometry args={[b.w + 0.1, 0.08, 0.03]} />
                    <meshStandardMaterial color={night ? '#2a2e35' : '#808488'} metalness={0.3} roughness={0.6} />
                  </mesh>

                  {/* FRONT windows (+Z) — single mesh per window */}
                  {Array.from({ length: cols }).map((_, ci) => {
                    const seed = (i * 1000 + fi * 100 + ci * 7 + 3) % 100;
                    const isLit = seed < litRatio * 100;
                    const warm = seed % 3 !== 0;
                    const wColor = isLit ? (warm ? '#FFF5E0' : '#D8ECFF') : (night ? '#101820' : '#7aaac8');
                    const eColor = isLit ? (warm ? '#FFD050' : '#70B0E8') : '#000';
                    const wx = (ci + 1) * spacing - b.w / 2;
                    return (
                      <mesh key={`wf${ci}`} position={[wx, bandY, b.d / 2 + 0.08]}>
                        <boxGeometry args={[winW, winH, 0.04]} />
                        <meshStandardMaterial color={wColor} emissive={eColor} emissiveIntensity={isLit ? 5 : 0} metalness={s.glass ? 0.6 : 0.2} roughness={0.15} />
                      </mesh>
                    );
                  })}
                  {/* RIGHT windows (+X) */}
                  {Array.from({ length: colsD }).map((_, ci) => {
                    const seed = (i * 1000 + fi * 100 + ci * 13 + 11) % 100;
                    const isLit = seed < litRatio * 100;
                    const warm = seed % 3 !== 0;
                    const wColor = isLit ? (warm ? '#FFF5E0' : '#D8ECFF') : (night ? '#101820' : '#7aaac8');
                    const eColor = isLit ? (warm ? '#FFD050' : '#70B0E8') : '#000';
                    const wz = (ci + 1) * spacingD - b.d / 2;
                    return (
                      <mesh key={`wr${ci}`} position={[b.w / 2 + 0.08, bandY, wz]}>
                        <boxGeometry args={[0.04, winH, winW]} />
                        <meshStandardMaterial color={wColor} emissive={eColor} emissiveIntensity={isLit ? 5 : 0} metalness={s.glass ? 0.6 : 0.2} roughness={0.15} />
                      </mesh>
                    );
                  })}
                  {/* LEFT windows (-X) */}
                  {Array.from({ length: colsD }).map((_, ci) => {
                    const seed = (i * 1000 + fi * 100 + ci * 17 + 13) % 100;
                    const isLit = seed < litRatio * 100;
                    const warm = seed % 3 !== 0;
                    const wColor = isLit ? (warm ? '#FFF5E0' : '#D8ECFF') : (night ? '#101820' : '#7aaac8');
                    const eColor = isLit ? (warm ? '#FFD050' : '#70B0E8') : '#000';
                    const wz = (ci + 1) * spacingD - b.d / 2;
                    return (
                      <mesh key={`wl${ci}`} position={[-b.w / 2 - 0.08, bandY, wz]}>
                        <boxGeometry args={[0.04, winH, winW]} />
                        <meshStandardMaterial color={wColor} emissive={eColor} emissiveIntensity={isLit ? 5 : 0} metalness={s.glass ? 0.6 : 0.2} roughness={0.15} />
                      </mesh>
                    );
                  })}
                  
                  {/* BALCONIES — non-glass buildings only, every 4th floor */}
                  {fi > 1 && fi % 4 === 0 && !s.glass && cols >= 2 && (
                    <group position={[0, floorY + 0.1, b.d / 2 + 0.4]}>
                      <mesh><boxGeometry args={[b.w * 0.6, 0.05, 0.5]} />
                        <meshStandardMaterial color={night ? '#c0c4c8' : '#e0e2e6'} metalness={0.25} roughness={0.55} /></mesh>
                      <mesh position={[0, 0.16, 0.23]}>
                        <boxGeometry args={[b.w * 0.6, 0.28, 0.03]} />
                        <meshStandardMaterial color={night ? '#505558' : '#888c90'} metalness={0.5} roughness={0.3} /></mesh>
                    </group>
                  )}
                </group>
              );
            })}
            
            {/* ── SETBACKS for art-deco ── */}
            {b.setbacks && (
              <>
                <mesh position={[0, b.h * 0.7, 0]}><boxGeometry args={[b.w * 0.8, b.h * 0.25, b.d * 0.8]} /><meshStandardMaterial color={bodyColor} metalness={s.metalness} roughness={s.roughness} /></mesh>
                <mesh position={[0, b.h * 0.88, 0]}><boxGeometry args={[b.w * 0.6, b.h * 0.12, b.d * 0.6]} /><meshStandardMaterial color={bodyColor} metalness={s.metalness} roughness={s.roughness} /></mesh>
              </>
            )}
            
            {/* ── SPIRE ── */}
            {b.spire && (
              <group position={[0, b.h, 0]}>
                <mesh position={[0, 5, 0]}><coneGeometry args={[0.25, 10, 4]} /><meshStandardMaterial color={night ? '#405060' : '#a0b0c0'} metalness={0.95} roughness={0.05} /></mesh>
              </group>
            )}
            
            {/* ── CROWN with illumination ── */}
            {b.crown && (
              <group position={[0, b.h, 0]}>
                <mesh position={[0, 2, 0]}><boxGeometry args={[b.w * 0.85, 4, b.d * 0.85]} /><meshStandardMaterial color={night ? '#2a3848' : '#708590'} metalness={0.8} roughness={0.15} /></mesh>
                {/* Crown edge lights */}
                {night && Array.from({ length: 4 }).map((_, ci) => {
                  const cx = (ci < 2 ? -1 : 1) * b.w * 0.4;
                  const cz = (ci % 2 === 0 ? -1 : 1) * b.d * 0.4;
                })}
                {/* Decorative crown pillars */}
                {[[-1,-1],[-1,1],[1,-1],[1,1]].map(([px,pz],pi) => (
                  <mesh key={pi} position={[px*b.w*0.35, 4.5, pz*b.d*0.35]}><cylinderGeometry args={[0.15, 0.15, 2, 6]} /><meshStandardMaterial color={night ? '#4a5a6a' : '#8898a8'} metalness={0.85} /></mesh>
                ))}
              </group>
            )}
            
            {/* ── ANTENNA with blinking light ── */}
            {b.antenna && (
              <group position={[0, b.h, 0]}>
                <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.08, 0.12, 8, 6]} /><meshStandardMaterial color="#555" metalness={0.85} /></mesh>
                {night && <mesh position={[0, 8.5, 0]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={5} /></mesh>}
              </group>
            )}
            
            {/* ── ROOFTOP DETAILS — helipad, AC units, water tank ── */}
            <group position={[0, b.h + 0.1, 0]}>
              {/* Rooftop surface */}
              <mesh rotation={[-Math.PI/2, 0, 0]}><planeGeometry args={[b.w * 0.95, b.d * 0.95]} /><meshStandardMaterial color={night ? '#252830' : '#606060'} roughness={0.9} /></mesh>
              {/* AC units cluster */}
              {b.h > 25 && Array.from({ length: 3 }).map((_, ai) => (
                <mesh key={`ac${ai}`} position={[-b.w*0.3 + ai*1.2, 0.4, -b.d*0.25]}>
                  <boxGeometry args={[0.8, 0.8, 0.8]} />
                  <meshStandardMaterial color={night ? '#354050' : '#8090a0'} metalness={0.6} roughness={0.4} />
                </mesh>
              ))}
              {/* Helipad (tall buildings only) */}
              {b.h > 40 && (
                <>
                  <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}><circleGeometry args={[b.w*0.3, 16]} /><meshStandardMaterial color={night ? '#1a2a1a' : '#4a6a4a'} roughness={0.8} /></mesh>
                </>
              )}
            </group>
            
            {/* ── GROUND FLOOR — Lobby with warm glow ── */}
            <mesh position={[0, 1.5, b.d / 2 + 0.15]}>
              <boxGeometry args={[b.w * 0.45, 2, 0.06]} />
              <meshStandardMaterial 
                color={night ? '#FFE8C0' : '#c0d0dc'} 
                emissive={night ? '#FFD080' : '#000'} 
                emissiveIntensity={night ? 3 : 0} 
                metalness={0.4} roughness={0.25} 
              />
            </mesh>
            
            {/* ── CORPORATE LOGO LIGHT at top ── */}
            {b.logo && night && (
              <mesh position={[0, b.h - 2, b.d / 2 + 0.1]}>
                <boxGeometry args={[b.w * 0.4, 1.5, 0.08]} />
                <meshStandardMaterial color={b.logo} emissive={b.logo} emissiveIntensity={5} />
              </mesh>
            )}
            
            {/* ── EDGE LIGHTING — LED strips on building edges at night ── */}
            {night && s.glass && (
              <>
                {/* Vertical edge strips */}
                {[
                  [b.w/2, b.h/2, b.d/2], [-b.w/2, b.h/2, b.d/2],
                  [b.w/2, b.h/2, -b.d/2], [-b.w/2, b.h/2, -b.d/2]
                ].map(([ex,ey,ez], ei) => (
                  <mesh key={`edge${ei}`} position={[ex, ey, ez]}>
                    <boxGeometry args={[0.08, b.h, 0.08]} />
                    <meshStandardMaterial color="#80C0FF" emissive="#4080C0" emissiveIntensity={2} />
                  </mesh>
                ))}
              </>
            )}
            
            {/* ── AVIATION WARNING LIGHT ── */}
            {night && !b.spire && !b.antenna && (
              <mesh position={[0, b.h + 0.5, 0]}><sphereGeometry args={[0.15, 6, 6]} /><meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={5} /></mesh>
            )}
            
            {/* ── AMBIENT GLOW — City light spill at night ── */}
            {night && (
              <>
              </>
            )}
          </group>
        );
      })}

      {/* === COASTAL PROMENADE — behind the seawall === */}
      <mesh position={[0, -0.3, -22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[90, 8]} />
        <meshStandardMaterial color={night ? '#2a2a30' : '#b8b0a0'} roughness={0.9} />
      </mesh>

      {/* Palmiers de promenade supprimés */}

      {/* Collines/cônes verts supprimés */}

      {/* === OPEN STADIUM (right-back side) — Gris, Bleu, Blanc === */}
      <group position={[55, 0, -30]}>
        {/* Stadium base / foundation */}
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[14, 15, 2, 32]} />
          <meshStandardMaterial color={night ? '#2a3040' : '#8090a0'} roughness={0.7} metalness={0.3} />
        </mesh>
        {/* Playing field — green pitch (circle scaled to ellipse) */}
        <mesh position={[0, 2.05, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.7, 1]}>
          <circleGeometry args={[10, 32]} />
          <meshStandardMaterial color={night ? '#1a4a1a' : '#2d8a2d'} roughness={0.9} />
        </mesh>
        {/* Field lines — outer ring */}
        <mesh position={[0, 2.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.7, 1]}>
          <ringGeometry args={[9.5, 10, 32]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Center circle */}
        <mesh position={[0, 2.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.7, 1]}>
          <ringGeometry args={[2.8, 3, 32]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Stadium tiers — open bowl shape (3 levels) */}
        {[
          { innerR: 11, outerR: 14, h: 4, y: 4, color: '#e8e8ec' },
          { innerR: 13, outerR: 16, h: 5, y: 7.5, color: '#4a6fa5' },
          { innerR: 15, outerR: 18, h: 4, y: 11, color: '#c8ccd4' },
        ].map((tier, ti) => (
          <group key={`tier${ti}`}>
            {/* Tier structure — open arc (270 degrees, open at front for "open stadium" feel) */}
            {Array.from({ length: 18 }).map((_, si) => {
              const angle = (si / 20) * Math.PI * 2 + Math.PI * 0.15;
              const midR = (tier.innerR + tier.outerR) / 2;
              const sectionW = (tier.outerR - tier.innerR);
              return (
                <mesh key={`s${si}`} position={[Math.cos(angle) * midR, tier.y, Math.sin(angle) * midR]}
                  rotation={[0.3 * (ti === 0 ? 1 : ti === 1 ? 0.8 : 0.6), -angle + Math.PI / 2, 0]}>
                  <boxGeometry args={[sectionW, tier.h, 2.8]} />
                  <meshStandardMaterial
                    color={night ? (ti === 1 ? '#1a3a60' : '#404852') : tier.color}
                    roughness={0.6} metalness={0.2}
                  />
                </mesh>
              );
            })}
          </group>
        ))}

        {/* Stadium structural columns — white pillars */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <mesh key={`col${i}`} position={[Math.cos(angle) * 17, 7, Math.sin(angle) * 17]}>
              <cylinderGeometry args={[0.3, 0.4, 14, 8]} />
              <meshStandardMaterial color={night ? '#606878' : '#e0e4ea'} roughness={0.3} metalness={0.5} />
            </mesh>
          );
        })}

        {/* Roof canopy — partial cover (open stadium) — white/light grey */}
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2 + Math.PI * 0.2;
          return (
            <mesh key={`roof${i}`} position={[Math.cos(angle) * 16, 14.5, Math.sin(angle) * 16]}
              rotation={[0.15, -angle + Math.PI / 2, 0]}>
              <boxGeometry args={[4, 0.3, 5]} />
              <meshStandardMaterial color={night ? '#3a4050' : '#f0f2f6'} roughness={0.3} metalness={0.4} />
            </mesh>
          );
        })}

        {/* Floodlight towers — 4 corners */}
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([fx, fz], fi) => (
          <group key={`flood${fi}`} position={[fx * 16, 0, fz * 12]}>
            <mesh position={[0, 10, 0]}>
              <cylinderGeometry args={[0.2, 0.35, 20, 6]} />
              <meshStandardMaterial color={night ? '#404858' : '#8898a8'} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Light panel */}
            <mesh position={[fx * -0.5, 20, fz * -0.5]} rotation={[0.3 * fz, 0, 0.3 * fx]}>
              <boxGeometry args={[1.5, 0.3, 1.5]} />
              <meshStandardMaterial color="#e0e0e0" />
            </mesh>
          </group>
        ))}

        {/* Stadium entrance arches — blue & white */}
        {[0, Math.PI].map((angle, ai) => (
          <group key={`arch${ai}`} position={[Math.cos(angle) * 15, 0, Math.sin(angle) * 15]}
            rotation={[0, -angle, 0]}>
            <mesh position={[0, 3.5, 0]}>
              <boxGeometry args={[4, 7, 1]} />
              <meshStandardMaterial color={night ? '#1a3050' : '#4a6fa5'} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[0, 7.2, 0]}>
              <boxGeometry args={[5, 0.6, 1.2]} />
              <meshStandardMaterial color={night ? '#d0d4dc' : '#ffffff'} roughness={0.3} metalness={0.4} />
            </mesh>
          </group>
        ))}

        {/* Night stadium glow */}
        {night && (
          <>
          </>
        )}
      </group>

      {/* === LIGHTHOUSE RETIRÉ === */}

      {/* === BEACH AREA (right side) === */}
      <mesh position={[50, -1, 15]} rotation={[-Math.PI / 2, 0, -0.1]}>
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial color={night ? '#5a4a30' : '#e8d8a0'} roughness={0.95} />
      </mesh>
      {/* Beach umbrellas */}
      {[[4, -1], [7, 2]].map(([dx, dz], i) => (
        <group key={`umb${i}`} position={[48 + dx, -0.3, 15 + dz]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 3, 6]} />
            <meshStandardMaterial color="#8a7050" />
          </mesh>
          <mesh position={[0, 2.8, 0]} rotation={[0.1, i * 0.5, 0]}>
            <coneGeometry args={[1.2, 0.6, 8, 1, true]} />
            <meshStandardMaterial
              color={['#33cc33', '#cccc33'][i]}
              side={2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}


function Clouds({ tod }) {
  const ref = useRef();
  const cl = useMemo(() => [...Array(15)].map(() => ({
    x: (Math.random() - 0.5) * 140, y: 15 + Math.random() * 12, z: -25 + (Math.random() - 0.5) * 50,
    sx: 2.2 + Math.random() * 2.4, sy: 0.8 + Math.random() * 0.5, sz: 1.6 + Math.random() * 1.8, sp: 0.08 + Math.random() * 0.2
  })), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((c, i) => {
      c.position.x = cl[i].x + clock.getElapsedTime() * cl[i].sp;
      if (c.position.x > 80) c.position.x = -80;
    });
  });
  return (
    <group ref={ref}>
      {cl.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={[c.sx * 0.34, c.sy * 1.05, c.sz * 0.42]}>
          <mesh><sphereGeometry args={[1.5, 10, 10]} /><meshStandardMaterial color="#ffffff" transparent opacity={tod > 0.3 && tod < 0.7 ? 0.72 : 0.16} /></mesh>
          <mesh position={[1.1, -0.12, 0.2]}><sphereGeometry args={[1.1, 10, 10]} /><meshStandardMaterial color="#ffffff" transparent opacity={tod > 0.3 && tod < 0.7 ? 0.68 : 0.14} /></mesh>
          <mesh position={[-1.05, -0.18, 0.12]}><sphereGeometry args={[1.0, 10, 10]} /><meshStandardMaterial color="#fbffff" transparent opacity={tod > 0.3 && tod < 0.7 ? 0.64 : 0.13} /></mesh>
          <mesh position={[0.18, 0.18, 0.62]}><sphereGeometry args={[0.86, 10, 10]} /><meshStandardMaterial color="#f8fdff" transparent opacity={tod > 0.3 && tod < 0.7 ? 0.58 : 0.11} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Sun/Moon ──────────────────────────────────────────────
function Celestial({ tod }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const a = tod * Math.PI * 2 - Math.PI / 2;
    ref.current.position.set(Math.cos(a) * 55, Math.sin(a) * 45 + 10, -35);
  });
  const isDay = tod > 0.3 && tod < 0.7;
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[isDay ? 3.5 : 2, 16, 16]} />
        <meshStandardMaterial color={isDay ? '#FFD700' : '#f0e6d0'} emissive={isDay ? '#FFD700' : '#f0e6d0'} emissiveIntensity={isDay ? 3 : 1} /></mesh>
    </group>
  );
}

// ─── Pontoons — REMOVED per user request (brown poles blocking view) ──
function Pontoons() {
  return null;
}

// ─── PREMIUM MARINE LIFE — Fish schools, Orcas, Seals ──────────────
function MarineLife({ tod, qualityBoost = false }) {
  const groupRef = useRef();
  const night = tod < 0.18 || tod > 0.82;
  const fishSchools = useMemo(() => ([
    { baseX: -15, baseZ: 10, y: -3.5, count: qualityBoost ? 28 : 18, color: '#FFD700', size: 0.15 },
    { baseX: 20, baseZ: -5, y: -4, count: qualityBoost ? 32 : 22, color: '#00CED1', size: 0.12 },
    { baseX: -30, baseZ: -15, y: -3.8, count: qualityBoost ? 24 : 15, color: '#FF6347', size: 0.18 },
    { baseX: 40, baseZ: 15, y: -4.2, count: qualityBoost ? 30 : 20, color: '#7FFFD4', size: 0.14 },
    { baseX: 5, baseZ: 25, y: -3.3, count: qualityBoost ? 34 : 25, color: '#FF69B4', size: 0.1 },
    ...(qualityBoost ? [
      { baseX: -58, baseZ: -42, y: -4.4, count: 26, color: '#7ec8ff', size: 0.13 },
      { baseX: 62, baseZ: -58, y: -4.1, count: 22, color: '#ffd166', size: 0.15 },
    ] : []),
  ]), [qualityBoost]);
  const orcas = useMemo(() => ([
    { baseX: -35, baseZ: 20, speed: 0.12 },
    { baseX: 30, baseZ: -25, speed: 0.1 },
    { baseX: -10, baseZ: 35, speed: 0.15 },
    ...(qualityBoost ? [{ baseX: 54, baseZ: -72, speed: 0.08 }] : []),
  ]), [qualityBoost]);
  const seals = useMemo(() => ([
    { baseX: -45, z: 5, color: '#5a4a3a' },
    { baseX: 50, z: -10, color: '#6a5a4a' },
    { baseX: -20, z: 30, color: '#4a3a2a' },
    { baseX: 35, z: 20, color: '#7a6a5a' },
    ...(qualityBoost ? [{ baseX: 70, z: -58, color: '#8b7a68' }, { baseX: -72, z: -48, color: '#6e5f52' }] : []),
  ]), [qualityBoost]);
  const jellyfish = useMemo(() => ([
    { x: 10, z: 5, y: -4.5, color: '#FF69B4', size: 0.3 },
    { x: -25, z: -20, y: -5, color: '#87CEEB', size: 0.25 },
    { x: 15, z: -30, y: -4.2, color: '#DDA0DD', size: 0.35 },
    ...(qualityBoost ? [{ x: 42, z: -68, y: -4.8, color: '#8be9ff', size: 0.28 }, { x: -52, z: -78, y: -5.1, color: '#ffb3ff', size: 0.32 }] : []),
  ]), [qualityBoost]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      if (child.userData.type === 'fishSchool') {
        child.position.x = child.userData.baseX + Math.sin(t * 0.3 + i * 2) * 15;
        child.position.z = child.userData.baseZ + Math.cos(t * 0.25 + i * 1.5) * 10;
        child.rotation.y = Math.atan2(
          Math.cos(t * 0.3 + i * 2) * 15 * 0.3,
          -Math.sin(t * 0.25 + i * 1.5) * 10 * 0.25
        );
      }
      if (child.userData.type === 'orca') {
        const speed = child.userData.speed || 0.15;
        child.position.x = child.userData.baseX + Math.sin(t * speed + i * 3) * 25;
        child.position.z = child.userData.baseZ + Math.cos(t * speed * 0.8 + i * 2) * 20;
        child.position.y = -4.9 + Math.sin(t * 0.8 + i) * 0.45;
        child.rotation.y = Math.atan2(
          Math.cos(t * speed + i * 3) * 25 * speed,
          -Math.sin(t * speed * 0.8 + i * 2) * 20 * speed * 0.8
        );
        child.rotation.z = Math.sin(t * 1.2 + i) * 0.08;
      }
      if (child.userData.type === 'seal') {
        child.position.y = -3.3 + Math.sin(t * 0.6 + i * 4) * 0.3;
        child.position.x = child.userData.baseX + Math.sin(t * 0.2 + i) * 5;
        child.rotation.z = Math.sin(t * 0.9 + i) * 0.06;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* === FISH SCHOOLS — Colorful groups swimming in formation === */}
      {fishSchools.map((school, si) => (
        <group key={`school${si}`} position={[school.baseX, school.y, school.baseZ]}
          userData={{ type: 'fishSchool', baseX: school.baseX, baseZ: school.baseZ }}>
          {Array.from({ length: school.count }).map((_, fi) => {
            const angle = (fi / school.count) * Math.PI * 2;
            const radius = 1 + Math.random() * 2;
            const fx = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5;
            const fy = (Math.random() - 0.5) * 0.8;
            const fz = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5;
            return (
              <group key={fi} position={[fx, fy, fz]}>
                {/* Fish body */}
                <mesh>
                  <sphereGeometry args={[school.size, 6, 4]} />
                  <meshStandardMaterial 
                    color={school.color} 
                    metalness={0.6} 
                    roughness={0.2}
                    emissive={school.color}
                    emissiveIntensity={night ? 0.3 : 0.1}
                  />
                </mesh>
                {/* Fish tail */}
                <mesh position={[-school.size * 1.5, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <coneGeometry args={[school.size * 0.6, school.size * 1.2, 3]} />
                  <meshStandardMaterial color={school.color} metalness={0.4} roughness={0.3} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* === ORCAS — Majestic killer whales === */}
      {orcas.map((orca, oi) => (
        <group key={`orca${oi}`} position={[orca.baseX, -3.5, orca.baseZ]}
          userData={{ type: 'orca', baseX: orca.baseX, baseZ: orca.baseZ, speed: orca.speed }}>
          {/* Body — sleek black */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.45, 2.3, 8, 12]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.2} />
          </mesh>
          {/* White belly patch */}
          <mesh position={[0, -0.22, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.22, 1.65, 6, 8]} />
            <meshStandardMaterial color="#f0f0f0" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* White eye patch */}
          <mesh position={[0.3, 0.12, 0.95]} scale={[1.2, 0.7, 0.5]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.3, 0.12, 0.95]} scale={[1.2, 0.7, 0.5]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Dorsal fin */}
          <mesh position={[0, 0.45, -0.15]} rotation={[0.15, 0, 0]}>
            <coneGeometry args={[0.18, 0.85, 4]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Tail flukes */}
          <mesh position={[0, 0.02, -1.75]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.7, 1]}>
            <coneGeometry args={[0.6, 0.26, 4]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Pectoral fins */}
          <mesh position={[0.46, -0.1, 0.25]} rotation={[0.1, 0, -0.9]}>
            <coneGeometry args={[0.18, 0.55, 3]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.2} />
          </mesh>
          <mesh position={[-0.46, -0.1, 0.25]} rotation={[0.1, 0, 0.9]}>
            <coneGeometry args={[0.18, 0.55, 3]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* === SEALS — Playful harbor seals === */}
      {seals.map((seal, si) => (
        <group key={`seal${si}`} position={[seal.baseX, -2.5, seal.z]}
          userData={{ type: 'seal', baseX: seal.baseX }}>
          {/* Body */}
          <mesh rotation={[Math.PI / 2 - 0.22, 0, 0]}>
            <capsuleGeometry args={[0.18, 0.9, 6, 8]} />
            <meshStandardMaterial color={seal.color} metalness={0.3} roughness={0.6} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.04, 0.56]} scale={[1, 0.9, 1.1]}>
            <sphereGeometry args={[0.18, 8, 6]} />
            <meshStandardMaterial color={seal.color} metalness={0.3} roughness={0.5} />
          </mesh>
          {/* Nose */}
          <mesh position={[0, 0.12, 0.9]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          {/* Eyes */}
          <mesh position={[0.1, 0.22, 0.82]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" emissive="#222" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[-0.1, 0.22, 0.82]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#1a1a1a" emissive="#222" emissiveIntensity={0.5} />
          </mesh>
          {/* Flippers */}
          <mesh position={[0.25, -0.1, 0.3]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.1, 0.4, 3]} />
            <meshStandardMaterial color={seal.color} roughness={0.5} />
          </mesh>
          <mesh position={[-0.25, -0.1, 0.3]} rotation={[0, 0, 0.4]}>
            <coneGeometry args={[0.1, 0.4, 3]} />
            <meshStandardMaterial color={seal.color} roughness={0.5} />
          </mesh>
          {/* Tail */}
          <mesh position={[0, 0, -0.7]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.18, 0.5, 4]} />
            <meshStandardMaterial color={seal.color} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* === JELLYFISH — Translucent, glowing === */}
      {jellyfish.map((jf, ji) => (
        <group key={`jelly${ji}`} position={[jf.x, jf.y, jf.z]}>
          <mesh>
            <sphereGeometry args={[jf.size, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial 
              color={jf.color} 
              transparent 
              opacity={0.5} 
              emissive={jf.color} 
              emissiveIntensity={night ? 1.5 : 0.3} 
            />
          </mesh>
          {/* Tentacles */}
          {Array.from({ length: 5 }).map((_, ti) => (
            <mesh key={ti} position={[Math.cos(ti * 1.2) * jf.size * 0.5, -jf.size * 1.5, Math.sin(ti * 1.2) * jf.size * 0.5]}>
              <cylinderGeometry args={[0.01, 0.02, jf.size * 2, 4]} />
              <meshStandardMaterial color={jf.color} transparent opacity={0.4} emissive={jf.color} emissiveIntensity={night ? 1 : 0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Lighting ──────────────────────────────────────────────
function Lighting({ tod }) {
  const ref = useRef();
  // Extended day mode: day from 0.2 to 0.8 (60%), night 0.0-0.2 and 0.8-1.0 (40%)
  const isDay = tod > 0.2 && tod < 0.8;
  const isSs = (tod > 0.15 && tod < 0.25) || (tod > 0.75 && tod < 0.85);
  useFrame(() => {
    if (!ref.current) return;
    const a = tod * Math.PI * 2 - Math.PI / 2;
    ref.current.position.set(Math.cos(a) * 25, Math.sin(a) * 18 + 8, 5);
  });
  return <>
    {/* Lumière ambiante - plus douce et plus physique */}
    <ambientLight intensity={isDay ? 0.42 : isSs ? 0.24 : 0.08} color={isDay ? '#f8f4ee' : '#a9c7de'} />
    {/* Key light soleil/lune */}
    <directionalLight 
      ref={ref} 
      intensity={isDay ? 2.15 : isSs ? 1.2 : 0.28} 
      color={isDay ? '#fff4db' : isSs ? '#ff8f5f' : '#b8d6f2'} 
      castShadow
    />
    {/* Fill lumineux ciel / sol */}
    <hemisphereLight 
      skyColor={isDay ? '#fce9d0' : '#17304d'} 
      groundColor={isDay ? '#8ebdd9' : '#091320'} 
      intensity={isDay ? 0.72 : 0.18} 
    />
    {/* Rim / bounce light pour détacher les volumes */}
    <directionalLight 
      position={[-15, 14, 15]} 
      intensity={isDay ? 0.55 : 0.12} 
      color={isDay ? '#e9f6ff' : '#6f90b6'}
    />
    <directionalLight 
      position={[16, 8, -18]} 
      intensity={isDay ? 0.18 : 0.28} 
      color={isDay ? '#ffd4a8' : '#6fd0ff'}
    />
  </>;
}

function FerryQualityPolish({ tod, qualityTier }) {
  const isDay = tod > 0.2 && tod < 0.8;
  const tierCount = qualityTier === 'desktop' ? 12 : qualityTier === 'tablet' ? 8 : 5;
  const harborLightNodes = useMemo(() => (
    Array.from({ length: tierCount }, (_, i) => {
      const angle = (i / tierCount) * Math.PI * 2;
      const radius = qualityTier === 'desktop' ? 78 : qualityTier === 'tablet' ? 72 : 66;
      return {
        id: i,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * (qualityTier === 'mobile' ? 48 : 56) - 34,
        y: 0.8 + (i % 3) * 0.3,
      };
    })
  ), [tierCount, qualityTier]);

  const reflectionStrips = qualityTier === 'desktop' ? 4 : qualityTier === 'tablet' ? 2 : 1;

  return (
    <group>
      {harborLightNodes.map((node) => (
        <group key={`ferry-polish-light-${node.id}`} position={[node.x, node.y, node.z]}>
          <pointLight intensity={isDay ? 0.45 : 0.95} distance={qualityTier === 'desktop' ? 34 : 24} color={isDay ? '#8fd9ff' : '#78d6ff'} />
          <mesh>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshStandardMaterial color="#e7f7ff" emissive="#9adfff" emissiveIntensity={isDay ? 0.6 : 1.4} />
          </mesh>
        </group>
      ))}

      {Array.from({ length: reflectionStrips }).map((_, i) => (
        <mesh key={`ferry-reflection-strip-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-42 + i * 24, -2.17, -52 + i * 4]}>
          <planeGeometry args={[16, 3.6]} />
          <meshPhysicalMaterial
            color={isDay ? '#d7f3ff' : '#6db5de'}
            transparent
            opacity={qualityTier === 'desktop' ? (isDay ? 0.18 : 0.26) : (isDay ? 0.12 : 0.2)}
            roughness={0.05}
            transmission={0.42}
          />
        </mesh>
      ))}

      {qualityTier !== 'mobile' && (
        <mesh rotation={[-Math.PI / 2.6, 0, 0]} position={[8, 11, -48]}>
          <ringGeometry args={[16, qualityTier === 'desktop' ? 24 : 20, 48]} />
          <meshStandardMaterial color="#9ddfff" emissive="#9ddfff" emissiveIntensity={isDay ? 0.16 : 0.5} transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
// ─── Stable Ferry Camera Controller ────────────────────

// ─── Camera Buttons with pure DOM (bypass React AND Three.js event systems) ─
function FerryCameraButtons() {
  useEffect(() => {
    return undefined;
  }, []);
  return null;
}

// ─── Click-to-Fly — Double-clic pour voler vers un point (50 unités) ───
function ClickToFly({ controlsRef, cameraRef, autoRotateRef, stopIntroRotation }) {
  const { raycaster, pointer, scene, gl } = useThree();
  const flyRef = useRef({ active: false, start: null, end: null, targetPos: null, progress: 0, duration: 2.0 });

  useEffect(() => {
    const canvas = gl.domElement;
    const onDblClick = (e) => {
      if (!cameraRef.current || !controlsRef.current) return;
      stopIntroRotation?.();
      // Désactiver l'autoRotate pour garder la position
      autoRotateRef.current = false;
      controlsRef.current.autoRotate = false;
      raycaster.setFromCamera(pointer, cameraRef.current);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length === 0) return;
      const hit = hits[0].point;
      const cam = cameraRef.current;
      const dir = new THREE.Vector3(hit.x - cam.position.x, 0, hit.z - cam.position.z).normalize();
      const dist = Math.min(50, cam.position.distanceTo(hit) * 0.7);
      const endPos = new THREE.Vector3(cam.position.x + dir.x * dist, cam.position.y, cam.position.z + dir.z * dist);
      const ctrl = controlsRef.current;
      const tDir = new THREE.Vector3(hit.x - ctrl.target.x, 0, hit.z - ctrl.target.z).normalize();
      const tEnd = new THREE.Vector3(ctrl.target.x + tDir.x * dist, ctrl.target.y, ctrl.target.z + tDir.z * dist);
      flyRef.current = {
        active: true,
        startPos: cam.position.clone(),
        endPos,
        startTarget: ctrl.target.clone(),
        endTarget: tEnd,
        progress: 0,
        duration: 1.8,
      };
    };
    canvas.addEventListener('dblclick', onDblClick);
    return () => canvas.removeEventListener('dblclick', onDblClick);
  }, [gl, raycaster, pointer, scene, cameraRef, controlsRef, autoRotateRef, stopIntroRotation]);

  useFrame((_, delta) => {
    const f = flyRef.current;
    if (!f.active || !cameraRef.current || !controlsRef.current) return;
    // Garder autoRotate OFF pendant le vol
    controlsRef.current.autoRotate = false;
    f.progress += delta / f.duration;
    if (f.progress >= 1) {
      f.active = false;
      f.progress = 1;
      // Fixer la position finale dans OrbitControls
      controlsRef.current.target.copy(f.endTarget);
      controlsRef.current.update();
    }
    const e = 1 - Math.pow(1 - f.progress, 3);
    cameraRef.current.position.lerpVectors(f.startPos, f.endPos, e);
    controlsRef.current.target.lerpVectors(f.startTarget, f.endTarget, e);
    controlsRef.current.update();
  });

  return null;
}

function FerryCameraController({ controlsRef, cameraRef, autoRotateRef, initialView, defaultView, seaView, birdView, trainCityView, streetView, panoramaView, hubPlazaView, skywalkView, marketView, cultureView, vipView, stopIntroRotation }) {
  const { camera, invalidate } = useThree();
  const ferryAnimRef = useRef(null);

  useEffect(() => {
    cameraRef.current = camera;

    const smoothPreset = (preset, enableAutoRotate = false, cancelIntro = true) => {
      if (!controlsRef.current || !cameraRef.current) return;
      if (cancelIntro) stopIntroRotation?.();
      if (ferryAnimRef.current) cancelAnimationFrame(ferryAnimRef.current);
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      const sP = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const eP = { x: preset.position[0], y: preset.position[1], z: preset.position[2] };
      const sT = { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z };
      const eT = { x: preset.target[0], y: preset.target[1], z: preset.target[2] };
      const dist = Math.sqrt((eP.x - sP.x) ** 2 + (eP.y - sP.y) ** 2 + (eP.z - sP.z) ** 2);
      const speed = dist > 40 ? 0.012 : dist > 15 ? 0.018 : 0.028;
      let p = 0;
      const anim = () => {
        p = Math.min(p + speed, 1);
        const e = 1 - Math.pow(1 - p, 3);
        cam.position.set(sP.x + (eP.x - sP.x) * e, sP.y + (eP.y - sP.y) * e, sP.z + (eP.z - sP.z) * e);
        if (preset.fov) {
          cam.fov = cam.fov + (preset.fov - cam.fov) * e;
          cam.updateProjectionMatrix();
        }
        ctrl.target.set(sT.x + (eT.x - sT.x) * e, sT.y + (eT.y - sT.y) * e, sT.z + (eT.z - sT.z) * e);
        autoRotateRef.current = enableAutoRotate;
        ctrl.autoRotate = enableAutoRotate;
        ctrl.update();
        invalidate();
        if (p < 1) ferryAnimRef.current = requestAnimationFrame(anim);
      };
      ferryAnimRef.current = requestAnimationFrame(anim);
    };

    const applyInstant = (preset, enableAutoRotate = false, cancelIntro = true) => {
      if (!controlsRef.current || !cameraRef.current) return;
      if (cancelIntro) stopIntroRotation?.();
      cameraRef.current.position.set(...preset.position);
      if (preset.fov) {
        cameraRef.current.fov = preset.fov;
        cameraRef.current.updateProjectionMatrix();
      }
      controlsRef.current.target.set(...preset.target);
      autoRotateRef.current = enableAutoRotate;
      controlsRef.current.autoRotate = enableAutoRotate;
      controlsRef.current.update();
      invalidate();
    };

    window.resetFerryCamera = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(defaultView, false);
    };
    window.setFerrySeaView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(seaView, false);
    };
    window.setFerryBirdView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(birdView, false);
    };
    window.setFerryTrainCityView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(trainCityView, false);
    };
    window.setFerryStreetView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(streetView, false);
    };
    window.setFerryPanoramaView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(panoramaView, false);
    };
    window.setFerryHubPlazaView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(hubPlazaView, false);
    };
    window.setFerrySkywalkView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(skywalkView, false);
    };
    window.setFerryMarketView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(marketView, false);
    };
    window.setFerryCultureView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(cultureView, false);
    };
    window.setFerryVipView = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      smoothPreset(vipView, false);
    };
    window.setFerryCarrierFollowHigh = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode('high');
    };
    window.setFerryCarrierFollowClose = () => {
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode('close');
    };
    window.stopFerryAutoCameraSequence = () => {
      stopIntroRotation?.();
      if (window.__setFerryCarrierFollowMode) window.__setFerryCarrierFollowMode(null);
      autoRotateRef.current = false;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
        controlsRef.current.update();
      }
      invalidate();
    };

    const rafId = window.requestAnimationFrame(() => applyInstant(initialView ?? defaultView, false, false));

    return () => {
      window.cancelAnimationFrame(rafId);
      if (ferryAnimRef.current) cancelAnimationFrame(ferryAnimRef.current);
      delete window.resetFerryCamera;
      delete window.setFerrySeaView;
      delete window.setFerryBirdView;
      delete window.setFerryTrainCityView;
      delete window.setFerryStreetView;
      delete window.setFerryPanoramaView;
      delete window.setFerryHubPlazaView;
      delete window.setFerrySkywalkView;
      delete window.setFerryMarketView;
      delete window.setFerryCultureView;
      delete window.setFerryVipView;
      delete window.setFerryCarrierFollowHigh;
      delete window.setFerryCarrierFollowClose;
      delete window.stopFerryAutoCameraSequence;
    };
  }, [camera, controlsRef, cameraRef, autoRotateRef, initialView, defaultView, seaView, birdView, trainCityView, streetView, panoramaView, hubPlazaView, skywalkView, marketView, cultureView, vipView, stopIntroRotation, invalidate]);
  return null;
}

// ─── Full Scene with Mobile Optimization ────────────────────
function Scene({ isMobile, isTablet, isLowPower, shouldReduceParticles, shouldDisableHeavyEffects, preferFastDesktop, sceneHoldPaused, isTouchDevice, threeDSettings, hubScenario, hubSeason, playMode }) {
  const todRef = useRef(0.5);
  const controlsRef = useRef();
  const cameraRef = useRef();
  const autoRotateRef = useRef(false);
  
  // Séquence caméra automatique au démarrage ; elle reste active par défaut
  // pour la découverte du hub, et ne s’arrête qu’à l’interaction utilisateur.
  const [introRotationActive, setIntroRotationActive] = useState(true);
  const introPhaseRef = useRef('orbitAroundFerry');
  const introProgressRef = useRef(0);
  const introPhaseStartRef = useRef(null);

  const initialView = useMemo(() => ({ position: [isMobile ? 7.5 : 7.5, isMobile ? 14.5 : 16.5, isMobile ? 44 : 52], target: [7.5, 2.2, -1.5], fov: isMobile ? 78 : 74 }), [isMobile]);
  const defaultView = useMemo(() => ({ position: [isMobile ? 20 : 19, isMobile ? 9.2 : 7.6, isMobile ? 20 : 18], target: [7.5, 1.5, -1.5], fov: isMobile ? 74 : 68 }), [isMobile]);
  const seaView = useMemo(() => ({ position: [isMobile ? -0.5 : -1.8, isMobile ? 8.7 : 7.2, isMobile ? 28 : 26], target: [-16, 1.8, 6], fov: isMobile ? 82 : 76 }), [isMobile]);
  const birdView = useMemo(() => ({ position: [isMobile ? 78 : 76, isMobile ? 13.2 : 11.2, isMobile ? 57 : 52], target: [52, 2.2, 31], fov: isMobile ? 94 : 86 }), [isMobile]);
  const trainCityView = useMemo(() => ({ position: [isMobile ? -112 : -124, isMobile ? 31 : 38, isMobile ? -28 : -16], target: [isMobile ? -18 : -18, isMobile ? 7.6 : 8.8, isMobile ? -168 : -170], fov: isMobile ? 80 : 74 }), [isMobile]);
  const streetView = useMemo(() => ({ position: [isMobile ? 9.5 : 8.4, isMobile ? 2.8 : 2.2, isMobile ? 14 : 12.5], target: [7.8, 1.2, -0.6], fov: isMobile ? 70 : 64 }), [isMobile]);
  const panoramaView = useMemo(() => ({ position: [isMobile ? 24 : 22, isMobile ? 21 : 18.5, isMobile ? 56 : 51], target: [20, 2, 18], fov: isMobile ? 106 : 98 }), [isMobile]);
  const hubPlazaView = useMemo(() => ({ position: [18, 8.2, -4], target: [16, 1.2, -28], fov: isMobile ? 72 : 64 }), [isMobile]);
  const skywalkView = useMemo(() => ({ position: [-34, 10, -30], target: [-18, 1.5, -42], fov: isMobile ? 70 : 62 }), [isMobile]);
  const marketView = useMemo(() => ({ position: [-26, 9, 158], target: [-16, 1.5, 146], fov: isMobile ? 68 : 60 }), [isMobile]);
  const cultureView = useMemo(() => ({ position: [-34, 11, 178], target: [-54, 3, 170], fov: isMobile ? 70 : 62 }), [isMobile]);
  const vipView = useMemo(() => ({ position: [44, 8.5, -2], target: [42, 1.2, -18], fov: isMobile ? 68 : 60 }), [isMobile]);

  const compactScene = isMobile ? true : (isTablet && (isLowPower || shouldDisableHeavyEffects));
  const seaQualityBoost = !isMobile && !isTablet && !isLowPower && !shouldDisableHeavyEffects;
  const qualityTier = !isMobile && !isTablet ? 'desktop' : isTablet ? 'tablet' : 'mobile';
  const stopIntroRotation = React.useCallback(() => {
    introPhaseRef.current = 'complete';
    introProgressRef.current = 0;
    setIntroRotationActive(false);
  }, []);

  useEffect(() => {
    if (playMode) stopIntroRotation();
  }, [playMode, stopIntroRotation]);
  const carrierFollowModeRef = useRef(null);

  const setCarrierFollowMode = React.useCallback((mode) => {
    carrierFollowModeRef.current = mode || null;
    if (mode) {
      stopIntroRotation();
      if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
      }
      if (window) window.__ferryCarrierFollowMode = mode;
      return;
    }
    if (window) delete window.__ferryCarrierFollowMode;
  }, [stopIntroRotation]);

  useEffect(() => {
    window.__setFerryCarrierFollowMode = setCarrierFollowMode;
    return () => {
      delete window.__setFerryCarrierFollowMode;
      delete window.__ferryCarrierFollowMode;
    };
  }, [setCarrierFollowMode]);

  // Centres d'orbite pour chaque élément
  const jetSkiAreaCenter = useMemo(() => [-70, 2, -28], []);
  const ferryCenter = useMemo(() => [7.5, 2.2, -1.5], []);
  const captureCenter = useMemo(() => [-18, 10, -72], []);
  const carrierCenter = useMemo(() => [55, 2.4, 52], []);
  const getCarrierPos = () => window.__carrierPos || { x: 55, y: 2.4, z: 52 };
  const yachtCenter = useMemo(() => [-16, 2.2, 10], []);
  const cityCenter = useMemo(() => (isMobile ? [-18, 8.8, -162] : [-18, 9.6, -166]), [isMobile]);

  useEffect(() => {
    introPhaseRef.current = 'approach';
    introProgressRef.current = 0;
    introPhaseStartRef.current = initialView;
    setIntroRotationActive(true);
    autoRotateRef.current = false;
  }, [initialView]);

  // ═══ SYSTÈME MULTI-SCÈNES — 200+ plans variés, boucle cinématique longue et renouvelée ═══
  const scenePoolRef = useRef([]);
  const sceneIndexRef = useRef(0);
  const scenePhaseRef = useRef('approach'); // 'approach' → 'zoom' → 'orbit'

  const buildScenePool = React.useCallback(() => {
    const cp = getCarrierPos();
    const hp = window.__heliPos || { x: -16, y: 20, z: 14 };
    const dp = window.__dronePos || { x: -18, y: 24, z: -72 };
    const tp = window.__coastalTrainPos || { x: 0, y: -1.35, z: -36.25 };
    const ncp = window.__north_cruisePos || { x: 0, y: -1, z: -176 };
    const ecp = window.__east_cargoPos || { x: 84, y: -1, z: -102 };
    const wcp = window.__west_cargoPos || { x: -96, y: -1, z: -104 };
    const syp = window.__south_yachtPos || { x: -8, y: -1, z: -18 };
    const scp = window.__south_catamaranPos || { x: 22, y: -1, z: -10 };
    const scenes = [
      // ── AIRE JET SKI (4 plans) ──
      { name: 'jetski_close', center: [-70, 2, -28], radius: 16, height: 5, fov: 64, dur: 8, angle: 0.6 },
      { name: 'jetski_high', center: [-70, 2, -28], radius: 28, height: 16, fov: 72, dur: 9, angle: 0.5 },
      { name: 'jetski_side', center: [-70, 2, -28], radius: 12, height: 3, fov: 58, dur: 7, angle: 0.7 },
      { name: 'jetski_back', center: [-70, 2, -28], radius: 22, height: 10, fov: 66, dur: 8, angle: -0.6 },
      // ── SUPERYACHT (5 plans) ──
      { name: 'yacht_close', center: [-16, 2, 10], radius: 18, height: 6, fov: 62, dur: 8, angle: 0.65 },
      { name: 'yacht_high', center: [-16, 2, 10], radius: 34, height: 18, fov: 74, dur: 9, angle: 0.5 },
      { name: 'yacht_water', center: [-16, 1, 10], radius: 12, height: 2.5, fov: 58, dur: 7, angle: 0.55 },
      { name: 'yacht_rear', center: [-16, 3, 16], radius: 16, height: 5, fov: 60, dur: 8, angle: -0.5 },
      { name: 'yacht_top', center: [-16, 4, 10], radius: 8, height: 8, fov: 54, dur: 7, angle: 0.6 },
      // ── BÂTIMENT CAPTURE (5 plans) ──
      { name: 'capture_high', center: [-18, 14, -72], radius: 42, height: 28, fov: 68, dur: 10, angle: 0.6 },
      { name: 'capture_top', center: [-18, 18, -72], radius: 36, height: 24, fov: 64, dur: 9, angle: 0.55 },
      { name: 'capture_far', center: [-18, 10, -72], radius: 52, height: 32, fov: 72, dur: 10, angle: 0.5 },
      { name: 'capture_rooftop', center: [-18, 20, -72], radius: 28, height: 22, fov: 60, dur: 8, angle: -0.55 },
      { name: 'capture_parking', center: [-18, 3, -72], radius: 32, height: 6, fov: 66, dur: 9, angle: 0.65 },
      // ── FERRY (5 plans) ──
      { name: 'ferry_close', center: [6, 2, -1.5], radius: 20, height: 6, fov: 60, dur: 8, angle: 0.6 },
      { name: 'ferry_deck', center: [7.5, 3, -1.5], radius: 14, height: 4, fov: 56, dur: 7, angle: 0.55 },
      { name: 'ferry_aerial', center: [7.5, 2, -1.5], radius: 38, height: 22, fov: 76, dur: 9, angle: 0.5 },
      { name: 'ferry_bow', center: [7.5, 2, -10], radius: 16, height: 4, fov: 58, dur: 7, angle: -0.5 },
      { name: 'ferry_stern', center: [7.5, 3, 6], radius: 18, height: 5, fov: 60, dur: 8, angle: 0.55 },
      // ── CENTRE-VILLE (6 plans) ──
      { name: 'city_panorama', center: [-18, 10, -166], radius: 46, height: 24, fov: 74, dur: 10, angle: 0.6 },
      { name: 'city_street', center: [-18, 4, -166], radius: 28, height: 8, fov: 62, dur: 8, angle: 0.55 },
      { name: 'city_skyline', center: [-18, 14, -166], radius: 62, height: 36, fov: 80, dur: 11, angle: 0.5 },
      { name: 'city_close', center: [-18, 6, -160], radius: 22, height: 10, fov: 60, dur: 8, angle: 0.6 },
      { name: 'city_south', center: [-18, 8, -140], radius: 34, height: 14, fov: 68, dur: 9, angle: -0.55 },
      { name: 'city_north', center: [-18, 12, -190], radius: 40, height: 20, fov: 72, dur: 10, angle: 0.5 },
      // ── GARE ──
      { name: 'station_front', center: [-24, 4, -140], radius: 20, height: 6, fov: 60, dur: 8, angle: 0.6 },
      { name: 'station_platform', center: [-24, 3, -148], radius: 16, height: 4, fov: 56, dur: 7, angle: 0.55 },
      { name: 'station_trains', center: [-24, 5, -146], radius: 26, height: 8, fov: 64, dur: 9, angle: -0.5 },
      // ── PORTE-AVIONS (5 plans, live) ──
      { name: 'carrier_close', center: [cp.x, cp.y, cp.z], radius: 22, height: 8, fov: 64, dur: 8, angle: 0.6, live: 'carrier' },
      { name: 'carrier_high', center: [cp.x, cp.y, cp.z], radius: 40, height: 22, fov: 76, dur: 9, angle: 0.5, live: 'carrier' },
      { name: 'carrier_sea', center: [cp.x, 1.5, cp.z], radius: 16, height: 3, fov: 58, dur: 7, angle: 0.55, live: 'carrier' },
      { name: 'carrier_bow', center: [cp.x, cp.y, cp.z], radius: 30, height: 12, fov: 68, dur: 8, angle: -0.6, live: 'carrier' },
      { name: 'carrier_tower', center: [cp.x, 6, cp.z], radius: 14, height: 10, fov: 56, dur: 7, angle: 0.5, live: 'carrier' },
      // ── HÉLICOPTÈRE (2 plans) ──
      { name: 'heli_follow', center: [hp.x, hp.y, hp.z], radius: 18, height: null, fov: 66, dur: 8, angle: 0.6, live: 'heli' },
      { name: 'heli_far', center: [hp.x, hp.y, hp.z], radius: 32, height: null, fov: 74, dur: 9, angle: 0.5, live: 'heli' },
      { name: 'drone_follow', center: [dp.x, dp.y, dp.z], radius: 8, height: null, fov: 58, dur: 8, angle: 0.52, live: 'drone' },
      { name: 'drone_high', center: [dp.x, dp.y, dp.z], radius: 18, height: null, fov: 68, dur: 9, angle: -0.48, live: 'drone' },
      { name: 'train_follow_close', center: [tp.x, tp.y, tp.z], radius: 8, height: 2.4, fov: 52, dur: 8, angle: 0.42, live: 'train' },
      { name: 'train_follow_high', center: [tp.x, tp.y, tp.z], radius: 18, height: 8, fov: 66, dur: 9, angle: -0.52, live: 'train' },
      // ── PLAGE (4 plans) ──
      { name: 'beach_walk', center: [-50, 1, -36], radius: 18, height: 3, fov: 60, dur: 8, angle: 0.55 },
      { name: 'beach_aerial', center: [-40, 1, -32], radius: 44, height: 26, fov: 78, dur: 9, angle: 0.5 },
      { name: 'beach_parasols', center: [-55, 1, -34], radius: 14, height: 3, fov: 58, dur: 7, angle: 0.6 },
      { name: 'beach_chars', center: [-45, 1, -38], radius: 20, height: 4, fov: 62, dur: 8, angle: -0.55 },
      // ── PALMIERS & CÔTE ──
      { name: 'palms_close', center: [-66, 1, -30], radius: 10, height: 4, fov: 56, dur: 7, angle: 0.6 },
      { name: 'coastline', center: [-40, 2, -50], radius: 36, height: 12, fov: 70, dur: 9, angle: 0.5 },
      // ── MARINA / QUAI ──
      { name: 'marina_yachts', center: [-36, 2, 18], radius: 20, height: 5, fov: 62, dur: 8, angle: 0.55 },
      { name: 'quay_posts', center: [34, 1, 24], radius: 18, height: 4, fov: 58, dur: 7, angle: 0.6 },
      { name: 'luxury_yachts_close', center: [-36, 2, 18], radius: 12, height: 3.5, fov: 56, dur: 7, angle: 0.6 },
      { name: 'luxury_yachts_high', center: [-36, 2, 18], radius: 30, height: 16, fov: 72, dur: 9, angle: 0.5 },
      // ── MER OUVERTE ──
      { name: 'open_sea_east', center: [80, 1, 40], radius: 24, height: 4, fov: 64, dur: 8, angle: 0.55 },
      { name: 'open_sea_west', center: [-30, 1, 30], radius: 28, height: 5, fov: 66, dur: 8, angle: -0.5 },
      { name: 'open_sea_far', center: [40, 1, 80], radius: 36, height: 8, fov: 72, dur: 9, angle: 0.5 },
      // ── PANORAMAS MONUMENTAUX ──
      { name: 'grand_panorama', center: [20, 4, 20], radius: 88, height: 52, fov: 90, dur: 14, angle: 1.0 },
      { name: 'sea_horizon', center: [60, 2, 60], radius: 72, height: 38, fov: 86, dur: 12, angle: 0.8 },
      { name: 'overview_all', center: [0, 6, -40], radius: 110, height: 64, fov: 96, dur: 15, angle: 0.7 },
      { name: 'world_view', center: [-10, 8, -80], radius: 140, height: 78, fov: 100, dur: 16, angle: 0.6 },
      { name: 'port_overview', center: [20, 4, 0], radius: 68, height: 40, fov: 84, dur: 12, angle: 0.75 },
      { name: 'continent_view', center: [-24, 10, -120], radius: 96, height: 56, fov: 92, dur: 14, angle: 0.65 },
      // ── VUES RASANTES / CINÉMATIQUES ──
      { name: 'wave_surf', center: [20, 0.5, 20], radius: 10, height: 1.5, fov: 52, dur: 7, angle: 0.7 },
      { name: 'dock_level', center: [30, 1, -10], radius: 12, height: 2, fov: 54, dur: 7, angle: 0.6 },
      { name: 'bridge_view', center: [-24, 6, -155], radius: 18, height: 8, fov: 58, dur: 8, angle: 0.55 },
      { name: 'train_track', center: [-24, 3, -145], radius: 14, height: 3.5, fov: 54, dur: 7, angle: 0.6 },
      { name: 'fountain_plaza', center: [-24, 4, -148], radius: 12, height: 5, fov: 56, dur: 7, angle: -0.55 },
      // ── NUIT / AMBIANCE ──
      { name: 'neon_city', center: [-18, 8, -170], radius: 30, height: 12, fov: 66, dur: 9, angle: 0.6 },
      { name: 'night_port', center: [10, 3, 5], radius: 26, height: 8, fov: 64, dur: 8, angle: -0.55 },
      // ── BÂTIMENT MARINA ──
      { name: 'marina_bldg_front', center: [38, 6, -12], radius: 30, height: 12, fov: 66, dur: 9, angle: 0.6 },
      { name: 'marina_bldg_high', center: [38, 14, -12], radius: 42, height: 26, fov: 74, dur: 10, angle: 0.55 },
      { name: 'marina_bldg_roof', center: [38, 17, -12], radius: 24, height: 22, fov: 62, dur: 8, angle: -0.5 },
      { name: 'marina_bldg_bollards', center: [38, 2, 1], radius: 18, height: 4, fov: 58, dur: 7, angle: 0.55 },
      // ── BATEAU DE PÊCHE ──
      { name: 'fishing_close', center: [20, 1, 30], radius: 14, height: 4, fov: 58, dur: 7, angle: 0.55 },
      { name: 'fishing_follow', center: [0, 1, 34], radius: 18, height: 5, fov: 62, dur: 8, angle: 0.6 },
      // ── CARGO EN MER PROFONDE ──
      { name: 'cargo_far', center: [-50, 2, 200], radius: 30, height: 10, fov: 68, dur: 9, angle: 0.5 },
      { name: 'cargo_horizon', center: [-100, 2, 240], radius: 50, height: 20, fov: 78, dur: 11, angle: 0.45 },
      // ── ZONE BOUÉES / BAIGNADE ──
      { name: 'buoys_zone', center: [-30, 1, -27], radius: 22, height: 5, fov: 62, dur: 8, angle: 0.55 },
      { name: 'buoys_aerial', center: [-30, 1, -27], radius: 36, height: 18, fov: 74, dur: 9, angle: 0.5 },
      // ── LIFEGUARD TOWERS ──
      { name: 'lifeguard_close', center: [-48, 2, -31], radius: 10, height: 5, fov: 56, dur: 7, angle: 0.6 },
      { name: 'lifeguard_view', center: [-20, 3, -33], radius: 16, height: 6, fov: 60, dur: 8, angle: -0.55 },
      // ── CHARS À VOILES ──
      { name: 'chars_voiles', center: [-40, 1, -38], radius: 18, height: 3.5, fov: 58, dur: 8, angle: 0.6 },
      { name: 'chars_aerial', center: [-30, 1, -38], radius: 32, height: 14, fov: 70, dur: 9, angle: 0.5 },
      // ── SMALL ISLAND / LOUNGE ──
      { name: 'island_lounge', center: [55, 1, -20], radius: 14, height: 4, fov: 58, dur: 7, angle: 0.55 },
      { name: 'island_high', center: [55, 1, -20], radius: 26, height: 12, fov: 68, dur: 8, angle: 0.5 },
      // ── BEACH RESORT ──
      { name: 'resort_pool', center: [41, 2, -22], radius: 16, height: 5, fov: 60, dur: 8, angle: 0.55 },
      { name: 'resort_aerial', center: [55, 2, -20], radius: 42, height: 24, fov: 78, dur: 10, angle: 0.6 },
      { name: 'resort_bar', center: [69, 3, -26], radius: 12, height: 4, fov: 56, dur: 7, angle: 0.55 },
      { name: 'resort_jetski', center: [73, 2, -20], radius: 14, height: 4, fov: 58, dur: 7, angle: -0.5 },
      { name: 'resort_garden', center: [41, 2, -12], radius: 16, height: 5, fov: 60, dur: 8, angle: 0.55 },
      // ── HÉLICOPTÈRE SUR TOIT CAPTURE ──
      { name: 'heli_on_capture', center: [-18, 22, -72], radius: 16, height: 24, fov: 58, dur: 8, angle: 0.55 },
      // ── VUE PORT COMPLET ──
      { name: 'full_port', center: [10, 4, 10], radius: 56, height: 30, fov: 82, dur: 12, angle: 0.7 },
      { name: 'all_boats', center: [0, 3, 20], radius: 44, height: 18, fov: 76, dur: 10, angle: 0.6 },
      // ── CIRCUIT FERROVIAIRE TOUR DE VILLE ──
      { name: 'rail_north', center: [0, 4, -176], radius: 28, height: 8, fov: 64, dur: 9, angle: 0.55 },
      { name: 'rail_east', center: [76, 4, -100], radius: 24, height: 6, fov: 62, dur: 8, angle: 0.5 },
      { name: 'rail_south', center: [0, 4, -22], radius: 28, height: 8, fov: 64, dur: 9, angle: -0.55 },
      { name: 'rail_west', center: [-76, 4, -100], radius: 24, height: 6, fov: 62, dur: 8, angle: 0.5 },
      { name: 'gare_nord', center: [0, 6, -178], radius: 20, height: 8, fov: 60, dur: 8, angle: 0.6 },
      { name: 'gare_sud', center: [0, 6, -22], radius: 20, height: 8, fov: 60, dur: 8, angle: -0.55 },
      { name: 'circuit_aerial', center: [0, 10, -100], radius: 96, height: 52, fov: 88, dur: 14, angle: 0.8 },

      // ── PORTS & QUAIS ──
      { name: 'port_nord', center: [0, 3, -186], radius: 22, height: 6, fov: 62, dur: 8, angle: 0.55 },
      { name: 'port_nord_high', center: [0, 3, -186], radius: 36, height: 18, fov: 74, dur: 9, angle: 0.5 },
      { name: 'port_sud', center: [0, 3, -14], radius: 22, height: 6, fov: 62, dur: 8, angle: -0.55 },
      { name: 'port_sud_boats', center: [0, 2, -10], radius: 16, height: 4, fov: 58, dur: 7, angle: 0.6 },
      { name: 'port_est', center: [90, 3, -100], radius: 20, height: 6, fov: 62, dur: 8, angle: 0.55 },
      { name: 'port_ouest', center: [-90, 3, -100], radius: 20, height: 6, fov: 62, dur: 8, angle: -0.55 },
      // ── LACS ──
      { name: 'lac_central', center: [0, 2, -80], radius: 18, height: 5, fov: 60, dur: 8, angle: 0.55 },
      { name: 'lac_central_aerial', center: [0, 2, -80], radius: 30, height: 16, fov: 72, dur: 9, angle: 0.5 },
      { name: 'lac_nord', center: [-40, 2, -155], radius: 14, height: 5, fov: 58, dur: 7, angle: 0.6 },
      // ── FLEUVE ──
      { name: 'fleuve_pont_ouest', center: [-40, 2, -115], radius: 16, height: 4, fov: 58, dur: 7, angle: 0.55 },
      { name: 'fleuve_pont_centre', center: [0, 2, -115], radius: 16, height: 4, fov: 58, dur: 7, angle: -0.5 },
      { name: 'fleuve_pont_est', center: [40, 2, -115], radius: 16, height: 4, fov: 58, dur: 7, angle: 0.55 },
      { name: 'fleuve_aerial', center: [0, 4, -115], radius: 68, height: 28, fov: 80, dur: 11, angle: 0.65 },
      // ── PASSERELLES AÉRIENNES ──
      { name: 'passerelle_ouest', center: [-30, 8, -100], radius: 18, height: 10, fov: 60, dur: 8, angle: 0.55 },
      { name: 'passerelle_est', center: [30, 8, -100], radius: 18, height: 10, fov: 60, dur: 8, angle: -0.55 },
      { name: 'passerelle_sous', center: [-30, 4, -100], radius: 12, height: 5, fov: 56, dur: 7, angle: 0.5 },
      // ── TUNNEL ──
      { name: 'tunnel_nord', center: [0, 1, -180], radius: 14, height: 3, fov: 56, dur: 7, angle: 0.55 },
      { name: 'tunnel_entree', center: [-8, 2, -180], radius: 10, height: 3, fov: 54, dur: 7, angle: 0.6 },
      // ── TOURS COLORÉES ──
      { name: 'tower_blue', center: [-68, 16, -150], radius: 20, height: 20, fov: 62, dur: 8, angle: 0.55 },
      { name: 'tower_red', center: [68, 14, -150], radius: 20, height: 18, fov: 62, dur: 8, angle: -0.5 },
      { name: 'tower_purple', center: [-65, 18, -70], radius: 22, height: 22, fov: 64, dur: 9, angle: 0.5 },
      { name: 'tower_green', center: [65, 15, -70], radius: 20, height: 18, fov: 62, dur: 8, angle: -0.55 },
      { name: 'towers_skyline', center: [0, 14, -100], radius: 80, height: 42, fov: 86, dur: 13, angle: 0.7 },
      // ── GRANDS ARBRES ──
      { name: 'trees_park_nord', center: [-40, 4, -150], radius: 18, height: 6, fov: 62, dur: 8, angle: 0.55 },
      { name: 'trees_park_sud', center: [0, 4, -60], radius: 22, height: 8, fov: 66, dur: 9, angle: 0.5 },
      { name: 'trees_canopy', center: [30, 6, -130], radius: 14, height: 8, fov: 58, dur: 7, angle: 0.6 },
      // ── FAUNE PLAGES ──
      { name: 'birds_north_beach', center: [-20, 1, -186], radius: 12, height: 3, fov: 56, dur: 7, angle: 0.55 },
      { name: 'turtles_south', center: [0, 1, -14], radius: 14, height: 3, fov: 58, dur: 7, angle: -0.5 },
      // ── MEGA CITY VUE D'ENSEMBLE ──
      { name: 'megacity_total', center: [0, 10, -100], radius: 120, height: 68, fov: 98, dur: 16, angle: 0.65 },
      { name: 'megacity_night', center: [0, 12, -100], radius: 100, height: 54, fov: 92, dur: 14, angle: 0.7 },
      { name: 'megacity_close', center: [0, 6, -80], radius: 60, height: 28, fov: 82, dur: 12, angle: 0.6 },
      // ── STADE ──
      { name: 'stade_aerial', center: [112, 10, -120], radius: 36, height: 24, fov: 76, dur: 10, angle: 0.6 },
      { name: 'stade_close', center: [112, 4, -120], radius: 22, height: 8, fov: 64, dur: 8, angle: 0.55 },
      { name: 'stade_inside', center: [112, 4, -120], radius: 14, height: 6, fov: 58, dur: 8, angle: -0.5 },
      // ── CENTRE COMMERCIAL ──
      { name: 'mall_front', center: [-112, 6, -120], radius: 26, height: 10, fov: 66, dur: 9, angle: 0.55 },
      { name: 'mall_aerial', center: [-112, 10, -120], radius: 40, height: 22, fov: 76, dur: 10, angle: 0.5 },
      { name: 'mall_atrium', center: [-112, 8, -120], radius: 16, height: 12, fov: 58, dur: 8, angle: -0.55 },
      // ── GRAND HALL SUD / COMPLEXE ÉVÉNEMENTIEL ──
      { name: 'south_hall_overview', center: [96, 8, -44], radius: 34, height: 20, fov: 72, dur: 10, angle: 0.6 },
      { name: 'south_hall_glass', center: [96, 10, -44], radius: 24, height: 16, fov: 64, dur: 9, angle: -0.55 },
      { name: 'south_hall_dj', center: [84, 5, -45], radius: 18, height: 8, fov: 60, dur: 8, angle: 0.6 },
      { name: 'south_hall_performance', center: [108, 6, -45], radius: 18, height: 9, fov: 60, dur: 8, angle: -0.55 },
      { name: 'south_hall_vip', center: [78, 4, -32], radius: 16, height: 6, fov: 58, dur: 8, angle: 0.55 },
      { name: 'south_hall_backstage', center: [96, 5, -57], radius: 18, height: 8, fov: 62, dur: 8, angle: -0.5 },
      { name: 'south_hall_crowd', center: [96, 4, -34], radius: 22, height: 7, fov: 64, dur: 9, angle: 0.5 },
      { name: 'south_hall_front_open', center: [96, 5, -28], radius: 20, height: 8, fov: 60, dur: 8, angle: -0.52 },
      { name: 'south_hall_roof_glass', center: [96, 14, -44], radius: 20, height: 18, fov: 62, dur: 8, angle: 0.48 },
      { name: 'south_hall_security', center: [96, 4, -26], radius: 16, height: 5, fov: 56, dur: 7, angle: 0.55 },
      { name: 'south_hall_agents', center: [92, 3, -24], radius: 14, height: 4, fov: 54, dur: 7, angle: -0.45 },
      // ── ROUTES STADE/MALL ──
      { name: 'route_est', center: [97, 3, -120], radius: 22, height: 5, fov: 62, dur: 8, angle: 0.55 },
      { name: 'route_ouest', center: [-97, 3, -120], radius: 22, height: 5, fov: 62, dur: 8, angle: -0.55 },
      // ── PÉRIPHÉRIQUE PREMIUM / ÉCHANGEURS / BASSINS ──
      { name: 'interchange_est_premium', center: [166, 5, -100], radius: 22, height: 10, fov: 66, dur: 9, angle: 0.55 },
      { name: 'interchange_ouest_premium', center: [-166, 5, -100], radius: 22, height: 10, fov: 66, dur: 9, angle: -0.55 },
      { name: 'bassins_sud_est', center: [88, 3, -14], radius: 18, height: 6, fov: 60, dur: 8, angle: 0.55 },
      { name: 'bassins_nord_est', center: [104, 3, -182], radius: 18, height: 6, fov: 60, dur: 8, angle: -0.5 },
      { name: 'ring_road_night', center: [0, 5, -100], radius: 120, height: 24, fov: 88, dur: 12, angle: 0.72 },
      { name: 'ring_road_low_east', center: [132, 3, -100], radius: 24, height: 5, fov: 60, dur: 8, angle: 0.5 },
      { name: 'ring_road_low_west', center: [-132, 3, -100], radius: 24, height: 5, fov: 60, dur: 8, angle: -0.5 },
      { name: 'outer_station_est_live', center: [136, 6, -100], radius: 18, height: 8, fov: 58, dur: 8, angle: 0.55 },
      { name: 'outer_station_west_live', center: [-136, 6, -100], radius: 18, height: 8, fov: 58, dur: 8, angle: -0.55 },
      { name: 'gare_nord_passengers', center: [0, 5, -202], radius: 18, height: 7, fov: 58, dur: 8, angle: 0.5 },
      { name: 'gare_sud_passengers', center: [0, 5, 2], radius: 18, height: 7, fov: 58, dur: 8, angle: -0.5 },
      { name: 'rail_signals_east', center: [136, 5, -66], radius: 16, height: 7, fov: 56, dur: 7, angle: 0.55 },
      { name: 'rail_signals_west', center: [-136, 5, -134], radius: 16, height: 7, fov: 56, dur: 7, angle: -0.55 },
      // ── WATERFRONT PREMIUM / MARINA DESTINATION ──
      { name: 'waterfront_promenade', center: [38, 4, -12], radius: 20, height: 7, fov: 60, dur: 8, angle: 0.55 },
      { name: 'yacht_club_front', center: [18, 5, 7], radius: 14, height: 7, fov: 56, dur: 8, angle: -0.52 },
      { name: 'floating_restaurant', center: [57, 4, 19], radius: 14, height: 6, fov: 56, dur: 8, angle: 0.5 },
      { name: 'bridge_belvedere', center: [0, 6, -146], radius: 26, height: 9, fov: 64, dur: 9, angle: 0.48 },
      { name: 'waterfront_night_strip', center: [0, 4, -144], radius: 56, height: 8, fov: 76, dur: 10, angle: -0.44 },
      // ── ÎLE TROPICALE ──
      { name: 'ile_aerial', center: [-16, 8, 160], radius: 56, height: 34, fov: 82, dur: 12, angle: 0.65 },
      { name: 'ile_lac', center: [-8, 5, 168], radius: 16, height: 6, fov: 60, dur: 8, angle: 0.55 },
      { name: 'ile_grotte', center: [-38, 4, 152], radius: 10, height: 5, fov: 56, dur: 7, angle: 0.6 },
      { name: 'ile_colline', center: [-34, 8, 150], radius: 18, height: 10, fov: 64, dur: 9, angle: -0.5 },
      { name: 'ile_plage', center: [-46, 4, 180], radius: 14, height: 4, fov: 58, dur: 8, angle: 0.55 },
      { name: 'ile_chemin', center: [-16, 5, 160], radius: 32, height: 8, fov: 68, dur: 9, angle: 0.5 },
      { name: 'ile_palmiers', center: [-6, 6, 156], radius: 12, height: 7, fov: 58, dur: 7, angle: 0.6 },
      // ── PORTS DE CHARGEMENT ──
      { name: 'port_ile_close', center: [-16, 3, 136], radius: 20, height: 6, fov: 62, dur: 8, angle: 0.55 },
      { name: 'port_ile_grue', center: [-8, 6, 136], radius: 12, height: 8, fov: 58, dur: 7, angle: 0.6 },
      { name: 'port_est_close', center: [88, 3, -48], radius: 18, height: 6, fov: 62, dur: 8, angle: -0.55 },
      { name: 'port_est_aerial', center: [88, 8, -48], radius: 32, height: 18, fov: 74, dur: 9, angle: 0.5 },

      // ── NOUVELLES VUES PANORAMIQUES HAUTES ──
      { name: 'ultra_sky_capture', center: [-18, 18, -72], radius: 160, height: 108, fov: 108, dur: 18, angle: 0.82 },
      { name: 'ultra_sky_world', center: [0, 12, -96], radius: 190, height: 122, fov: 112, dur: 20, angle: 0.74 },
      { name: 'ultra_sky_maritime', center: [0, 6, -80], radius: 172, height: 96, fov: 106, dur: 18, angle: -0.76 },
      { name: 'very_high_panorama_north', center: [0, 8, -186], radius: 118, height: 82, fov: 98, dur: 16, angle: 0.68 },
      { name: 'very_high_panorama_east', center: [90, 6, -100], radius: 86, height: 62, fov: 94, dur: 15, angle: 0.72 },
      { name: 'very_high_panorama_west', center: [-90, 6, -100], radius: 86, height: 62, fov: 94, dur: 15, angle: -0.72 },

      // ── SUIVIS MER / NAVIRES (live) ──
      { name: 'north_cruise_follow_close', center: [ncp.x, ncp.y, ncp.z], radius: 18, height: 4.5, fov: 58, dur: 10, angle: 0.42, live: 'north_cruise' },
      { name: 'north_cruise_follow_high', center: [ncp.x, ncp.y, ncp.z], radius: 34, height: 16, fov: 72, dur: 11, angle: 0.5, live: 'north_cruise' },
      { name: 'east_cargo_follow', center: [ecp.x, ecp.y, ecp.z], radius: 14, height: 4.2, fov: 56, dur: 9, angle: -0.38, live: 'east_cargo' },
      { name: 'west_cargo_follow', center: [wcp.x, wcp.y, wcp.z], radius: 14, height: 4.2, fov: 56, dur: 9, angle: 0.38, live: 'west_cargo' },
      { name: 'south_yacht_follow', center: [syp.x, syp.y, syp.z], radius: 12, height: 3.2, fov: 54, dur: 8, angle: 0.4, live: 'south_yacht' },
      { name: 'south_catamaran_follow', center: [scp.x, scp.y, scp.z], radius: 13, height: 3.5, fov: 56, dur: 8, angle: -0.42, live: 'south_catamaran' },

      // ── VUES TYPE VÉHICULE / RAS DU SOL OU DE L'EAU ──
      { name: 'harbor_runner_north', center: [0, 2, -186], radius: 10, height: 2.2, fov: 52, dur: 8, angle: 0.55 },
      { name: 'harbor_runner_east', center: [90, 2, -100], radius: 10, height: 2.2, fov: 52, dur: 8, angle: -0.55 },
      { name: 'harbor_runner_west', center: [-90, 2, -100], radius: 10, height: 2.2, fov: 52, dur: 8, angle: 0.55 },
      { name: 'south_dock_runner', center: [0, 2, -14], radius: 10, height: 2.2, fov: 52, dur: 8, angle: -0.55 },
      { name: 'waterline_north', center: [0, 0.4, -176], radius: 12, height: 1.1, fov: 50, dur: 8, angle: 0.46 },
      { name: 'waterline_marina', center: [-36, 0.4, 18], radius: 10, height: 1.2, fov: 50, dur: 8, angle: -0.44 },
      { name: 'waterline_resort', center: [55, 0.4, -20], radius: 12, height: 1.2, fov: 50, dur: 8, angle: 0.48 },

      // ── ROTATIONS RENOUVELÉES / ANGLES FRAIS ──
      { name: 'capture_ultra_orbit', center: [-18, 12, -72], radius: 74, height: 40, fov: 84, dur: 15, angle: -0.88 },
      { name: 'ferry_ultra_orbit', center: [7.5, 2, -1.5], radius: 44, height: 24, fov: 80, dur: 13, angle: -0.8 },
      { name: 'marina_full_orbit', center: [18, 4, 10], radius: 58, height: 22, fov: 82, dur: 14, angle: 0.84 },
      { name: 'resort_full_orbit', center: [55, 3, -20], radius: 54, height: 26, fov: 82, dur: 14, angle: -0.82 },
      { name: 'north_port_orbit_long', center: [0, 4, -186], radius: 48, height: 18, fov: 78, dur: 13, angle: 0.78 },
      { name: 'south_port_orbit_long', center: [0, 3, -14], radius: 42, height: 16, fov: 76, dur: 12, angle: -0.76 },
      { name: 'east_port_orbit_long', center: [90, 3, -100], radius: 34, height: 14, fov: 74, dur: 12, angle: 0.72 },
      { name: 'west_port_orbit_long', center: [-90, 3, -100], radius: 34, height: 14, fov: 74, dur: 12, angle: -0.72 },

      // ── AIR / HÉLICO / SKY-CHASE ──
      { name: 'heli_chase_high', center: [hp.x, hp.y, hp.z], radius: 46, height: null, fov: 82, dur: 11, angle: 0.58, live: 'heli' },
      { name: 'heli_world_panorama', center: [hp.x, hp.y, hp.z], radius: 72, height: null, fov: 90, dur: 12, angle: -0.52, live: 'heli' },
      { name: 'drone_city_chase', center: [dp.x, dp.y, dp.z], radius: 26, height: null, fov: 76, dur: 10, angle: 0.44, live: 'drone' },
      { name: 'train_track_side', center: [tp.x, tp.y, tp.z], radius: 12, height: 3.4, fov: 56, dur: 8, angle: 0.58, live: 'train' },

      // ── PANORAMAS MARITIMES GÉANTS ──
      { name: 'all_coasts_panorama', center: [0, 4, -96], radius: 150, height: 74, fov: 100, dur: 18, angle: 0.78 },
      { name: 'all_ports_panorama', center: [0, 5, -96], radius: 126, height: 62, fov: 94, dur: 16, angle: -0.74 },
      { name: 'fleet_total_panorama', center: [0, 4, -80], radius: 136, height: 58, fov: 96, dur: 16, angle: 0.7 },

      // ── CINÉMATIQUE PREMIUM ULTRA-LENTE / TRAVELLINGS SANS ROTATION ──
      { name: 'premium_sky_glide_capture', center: [-18, 16, -72], radius: 90, height: 46, fov: 82, dur: 18, angle: 0.06, mode: 'travel', travelFrom: [-92, 46, 54], travelTo: [84, 38, -26], targetFrom: [0, 0, 0], targetTo: [12, 0, -8] },
      { name: 'premium_waterfront_glide', center: [18, 4, 10], radius: 44, height: 12, fov: 64, dur: 16, angle: 0.04, mode: 'travel', travelFrom: [-26, 8, 18], travelTo: [24, 6, -12], targetFrom: [0, 0, 0], targetTo: [10, 0, -6] },
      { name: 'premium_superyacht_glide', center: [8, 3, 24], radius: 20, height: 6, fov: 56, dur: 15, angle: 0.04, mode: 'travel', travelFrom: [-16, 4, 10], travelTo: [16, 3, 4], targetFrom: [0, 0, -2], targetTo: [4, 0, -8] },
      { name: 'premium_north_cruise_travel', center: [ncp.x, ncp.y, ncp.z], radius: 22, height: 8, fov: 58, dur: 14, angle: 0.02, live: 'north_cruise', mode: 'travel', travelFrom: [-26, 10, 18], travelTo: [22, 8, 14], targetFrom: [0, 0, 0], targetTo: [10, 0, -6] },
      { name: 'premium_train_travel', center: [tp.x, tp.y, tp.z], radius: 14, height: 4, fov: 54, dur: 13, angle: 0.02, live: 'train', mode: 'travel', travelFrom: [-18, 3.5, 8], travelTo: [16, 2.8, 6], targetFrom: [0, 0, 0], targetTo: [8, 0, 0] },
      { name: 'premium_heli_travel', center: [hp.x, hp.y, hp.z], radius: 28, height: null, fov: 62, dur: 14, angle: 0.02, live: 'heli', mode: 'travel', travelFrom: [-28, 8, 20], travelTo: [22, 6, 18], targetFrom: [0, -2, 0], targetTo: [8, -1, -6] },
      { name: 'premium_drone_travel', center: [dp.x, dp.y, dp.z], radius: 18, height: null, fov: 60, dur: 12, angle: 0.02, live: 'drone', mode: 'travel', travelFrom: [-16, 5, 10], travelTo: [14, 4, -8], targetFrom: [0, -1, 0], targetTo: [6, -1, -4] },

      // ── PLANS ICONIQUES SIGNATURE / MOMENTS WOW ──
      { name: 'signature_world_crown', center: [0, 18, -100], radius: 210, height: 132, fov: 116, dur: 22, angle: 0.12, mode: 'travel', travelFrom: [-160, 118, 96], travelTo: [150, 110, -88], targetFrom: [0, 0, 0], targetTo: [18, 0, -12] },
      { name: 'signature_superyacht_reveal', center: [8, 3, 24], radius: 26, height: 9, fov: 54, dur: 18, angle: 0.02, mode: 'travel', travelFrom: [-22, 8, 16], travelTo: [12, 5, -2], targetFrom: [0, 0, 0], targetTo: [2, -1, -8] },
      { name: 'signature_north_harbor_majesty', center: [0, 4, -186], radius: 60, height: 24, fov: 72, dur: 18, angle: 0.08, mode: 'travel', travelFrom: [-48, 18, 30], travelTo: [42, 16, 18], targetFrom: [0, 0, 0], targetTo: [12, 0, -6] },
      { name: 'signature_cargo_monument', center: [ecp.x, ecp.y, ecp.z], radius: 18, height: 7, fov: 56, dur: 16, angle: 0.02, live: 'east_cargo', mode: 'travel', travelFrom: [-24, 9, 14], travelTo: [20, 7, 8], targetFrom: [0, 0, 0], targetTo: [8, 0, -4] },
      { name: 'signature_train_bridge', center: [tp.x, tp.y, tp.z], radius: 18, height: 5, fov: 54, dur: 15, angle: 0.02, live: 'train', mode: 'travel', travelFrom: [-22, 5, 10], travelTo: [18, 4, 8], targetFrom: [0, 0, 0], targetTo: [10, 0, 0] },
      { name: 'signature_heli_city_embrace', center: [hp.x, hp.y, hp.z], radius: 38, height: null, fov: 68, dur: 17, angle: 0.02, live: 'heli', mode: 'travel', travelFrom: [-42, 12, 28], travelTo: [34, 10, 20], targetFrom: [0, -4, 0], targetTo: [10, -2, -10] },
      { name: 'signature_drone_resort_glide', center: [dp.x, dp.y, dp.z], radius: 24, height: null, fov: 64, dur: 15, angle: 0.02, live: 'drone', mode: 'travel', travelFrom: [-20, 6, 14], travelTo: [18, 5, -10], targetFrom: [0, -2, 0], targetTo: [8, -1, -6] },
      { name: 'signature_waterfront_gold', center: [18, 4, 10], radius: 40, height: 10, fov: 60, dur: 16, angle: 0.02, mode: 'travel', travelFrom: [-32, 8, 20], travelTo: [28, 6, -14], targetFrom: [0, 0, 0], targetTo: [12, 0, -8] },
    ];
    const buckets = { panorama: [], premium: [], live: [], low: [], classic: [] };
    scenes.forEach((scene) => {
      if (scene.mode === 'travel') buckets.premium.push(scene);
      else if (scene.live) buckets.live.push(scene);
      else if (scene.radius >= 80 || (scene.height ?? 0) >= 40 || scene.fov >= 90) buckets.panorama.push(scene);
      else if ((scene.height ?? 0) <= 3.5 || scene.radius <= 12) buckets.low.push(scene);
      else buckets.classic.push(scene);
    });

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    Object.values(buckets).forEach(shuffle);

    const pattern = ['panorama', 'premium', 'live', 'classic', 'low', 'classic', 'premium', 'live', 'classic'];
    const ordered = [];
    while (Object.values(buckets).some((arr) => arr.length > 0)) {
      let pushed = false;
      pattern.forEach((cat) => {
        if (buckets[cat].length > 0) {
          ordered.push(buckets[cat].shift());
          pushed = true;
        }
      });
      if (!pushed) break;
    }

    if (isMobile) {
      return ordered.filter((scene) => !scene.mode).slice(0, 56);
    }
    if (isTablet || isLowPower || threeDSettings?.dpr <= 1) {
      return ordered.slice(0, 110);
    }
    return ordered;
  }, [getCarrierPos, isMobile, isTablet, isLowPower, threeDSettings]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    todRef.current = ((t / DAY) + 0.45) % 1;

    // Fonctions utilitaires caméra
    const applyPresetLerp = (from, to, progress) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      const e = 1 - Math.pow(1 - progress, 3);
      cam.position.set(
        THREE.MathUtils.lerp(from.position[0], to.position[0], e),
        THREE.MathUtils.lerp(from.position[1], to.position[1], e),
        THREE.MathUtils.lerp(from.position[2], to.position[2], e)
      );
      ctrl.target.set(
        THREE.MathUtils.lerp(from.target[0], to.target[0], e),
        THREE.MathUtils.lerp(from.target[1], to.target[1], e),
        THREE.MathUtils.lerp(from.target[2], to.target[2], e)
      );
      cam.fov = THREE.MathUtils.lerp(from.fov ?? cam.fov, to.fov ?? cam.fov, e);
      cam.updateProjectionMatrix();
      ctrl.update();
    };

    const saveCurrentAsStart = () => ({
      position: [cameraRef.current.position.x, cameraRef.current.position.y, cameraRef.current.position.z],
      target: [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z],
      fov: cameraRef.current.fov,
      _carrierSnap: null, _seaSnapCenter: null,
    });

    if (carrierFollowModeRef.current && controlsRef.current && cameraRef.current) {
      const cp = getCarrierPos();
      const cfg = carrierFollowModeRef.current === 'close'
        ? { pos: [cp.x + 0, cp.y + 8, cp.z + 18], target: [cp.x, cp.y + 2.2, cp.z], fov: 62 }
        : { pos: [cp.x + 0, cp.y + 26, cp.z + 42], target: [cp.x, cp.y + 2.2, cp.z], fov: 76 };

      cameraRef.current.position.x += (cfg.pos[0] - cameraRef.current.position.x) * 0.08;
      cameraRef.current.position.y += (cfg.pos[1] - cameraRef.current.position.y) * 0.08;
      cameraRef.current.position.z += (cfg.pos[2] - cameraRef.current.position.z) * 0.08;

      controlsRef.current.target.x += (cfg.target[0] - controlsRef.current.target.x) * 0.08;
      controlsRef.current.target.y += (cfg.target[1] - controlsRef.current.target.y) * 0.08;
      controlsRef.current.target.z += (cfg.target[2] - controlsRef.current.target.z) * 0.08;

      const targetFov = cfg.fov;
      cameraRef.current.fov += (targetFov - cameraRef.current.fov) * 0.08;
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.autoRotate = false;
      controlsRef.current.update();
      return;
    }

    if (sceneHoldPaused) {
      if (controlsRef.current) { controlsRef.current.autoRotate = false; controlsRef.current.update(); }
    } else if (introRotationActive && controlsRef.current && cameraRef.current) {
      autoRotateRef.current = false;
      controlsRef.current.autoRotate = false;
      introProgressRef.current += delta;

      // Initialiser le pool si vide
      if (scenePoolRef.current.length === 0) {
        scenePoolRef.current = buildScenePool();
        sceneIndexRef.current = 0;
        scenePhaseRef.current = 'approach';
        introProgressRef.current = 0;
        introPhaseStartRef.current = saveCurrentAsStart();
      }

      const scene = scenePoolRef.current[sceneIndexRef.current];
      if (!scene) {
        // Pool épuisé → re-mélanger
        scenePoolRef.current = buildScenePool();
        sceneIndexRef.current = 0;
        scenePhaseRef.current = 'approach';
        introProgressRef.current = 0;
        introPhaseStartRef.current = saveCurrentAsStart();
        return;
      }

      // Résoudre les centres live
      let center = [...scene.center];
      if (scene.live === 'carrier') {
        const cp = getCarrierPos();
        center = [cp.x, cp.y, cp.z];
      } else if (scene.live === 'heli') {
        const hp = window.__heliPos || { x: -16, y: 20, z: 14 };
        center = [hp.x, hp.y, hp.z];
      } else if (scene.live === 'drone') {
        const p = window.__dronePos || { x: -18, y: 24, z: -72 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'train') {
        const p = window.__coastalTrainPos || { x: 0, y: -1.35, z: -36.25 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'north_cruise') {
        const p = window.__north_cruisePos || { x: 0, y: -1, z: -176 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'east_cargo') {
        const p = window.__east_cargoPos || { x: 84, y: -1, z: -102 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'west_cargo') {
        const p = window.__west_cargoPos || { x: -96, y: -1, z: -104 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'south_yacht') {
        const p = window.__south_yachtPos || { x: -8, y: -1, z: -18 };
        center = [p.x, p.y, p.z];
      } else if (scene.live === 'south_catamaran') {
        const p = window.__south_catamaranPos || { x: 22, y: -1, z: -10 };
        center = [p.x, p.y, p.z];
      }

      if (scenePhaseRef.current === 'approach') {
        // Phase 1 — APPROCHE LONGUE (5s) — arrive de loin doucement
        const dur = 5;
        const progress = Math.min(introProgressRef.current / dur, 1);
        const e = progress * progress * (3 - 2 * progress); // smoothstep
        if (!introPhaseStartRef.current._destAngle) {
          introPhaseStartRef.current._destAngle = Math.random() * Math.PI * 2;
        }
        const a = introPhaseStartRef.current._destAngle;
        // Point d'approche = 1.6× le rayon final (arrive de loin)
        const farR = scene.radius * 1.6;
        const farH = scene.height * 1.3;
        const dest = {
          position: [center[0] + Math.sin(a) * farR, farH, center[2] + Math.cos(a) * farR],
          target: center,
          fov: scene.fov + 8,
        };
        applyPresetLerp(introPhaseStartRef.current, dest, e);
        if (progress >= 1) {
          scenePhaseRef.current = 'zoom';
          introProgressRef.current = 0;
          introPhaseStartRef.current = { ...saveCurrentAsStart(), _destAngle: a, _orbitStartAngle: a };
        }

      } else if (scenePhaseRef.current === 'zoom') {
        // Phase 2 — ZOOM LENT (5s) — rapprochement doux vers le rayon final
        const dur = 5;
        const progress = Math.min(introProgressRef.current / dur, 1);
        const e = progress * progress * (3 - 2 * progress);
        const a = introPhaseStartRef.current._destAngle || 0;
        const dest = {
          position: [center[0] + Math.sin(a) * scene.radius, scene.height, center[2] + Math.cos(a) * scene.radius],
          target: center,
          fov: scene.fov,
        };
        applyPresetLerp(introPhaseStartRef.current, dest, e);
        if (progress >= 1) {
          scenePhaseRef.current = 'orbit';
          introPhaseStartRef.current._orbitStartAngle = a;
          introProgressRef.current = 0;
        }

      } else if (scenePhaseRef.current === 'orbit') {
        // Phase 3 — ORBITE DOUCE — rotation lente depuis l'angle d'arrivée
        const orbitStart = introPhaseStartRef.current._orbitStartAngle || 0;
        const progress = Math.min(introProgressRef.current / scene.dur, 1);
        // Easing doux en entrée et sortie
        const smoothP = progress * progress * (3 - 2 * progress);
        if (scene.mode === 'travel') {
          const from = scene.travelFrom || [0, scene.height || 6, scene.radius];
          const to = scene.travelTo || from;
          const targetFrom = scene.targetFrom || [0, 0, 0];
          const targetTo = scene.targetTo || [0, 0, 0];
          cameraRef.current.position.x = center[0] + THREE.MathUtils.lerp(from[0], to[0], smoothP);
          cameraRef.current.position.y = center[1] + THREE.MathUtils.lerp(from[1], to[1], smoothP);
          cameraRef.current.position.z = center[2] + THREE.MathUtils.lerp(from[2], to[2], smoothP);
          controlsRef.current.target.set(
            center[0] + THREE.MathUtils.lerp(targetFrom[0], targetTo[0], smoothP),
            center[1] + THREE.MathUtils.lerp(targetFrom[1], targetTo[1], smoothP),
            center[2] + THREE.MathUtils.lerp(targetFrom[2], targetTo[2], smoothP),
          );
        } else {
          const angle = orbitStart + smoothP * Math.PI * scene.angle;
          const h = scene.live === 'heli' || scene.live === 'drone' ? center[1] + 6 : scene.height;
          cameraRef.current.position.x = center[0] + Math.sin(angle) * scene.radius;
          cameraRef.current.position.z = center[2] + Math.cos(angle) * scene.radius;
          cameraRef.current.position.y = h + Math.sin(angle - orbitStart) * (h * 0.04);
          controlsRef.current.target.set(center[0], center[1], center[2]);
        }
        cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, scene.fov, 0.03);
        cameraRef.current.updateProjectionMatrix();
        controlsRef.current.update();
        if (progress >= 1) {
          sceneIndexRef.current++;
          scenePhaseRef.current = 'approach';
          introProgressRef.current = 0;
          introPhaseStartRef.current = { ...saveCurrentAsStart(), _destAngle: null, _orbitStartAngle: null };
        }
      }
    } else if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotateRef.current;
    }

    if (cameraRef.current && controlsRef.current) {
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      const isOverNewWorld = ctrl.target.z < 12 && ctrl.target.z > -230 && Math.abs(ctrl.target.x) < 210;
      const minTargetY = isOverNewWorld ? 0.85 : -1.2;
      const minCamY = isOverNewWorld ? 1.75 : 0.35;
      if (ctrl.target.y < minTargetY) ctrl.target.y = minTargetY;
      if (cam.position.y < minCamY) cam.position.y = minCamY;
      ctrl.update();
    }
    
  });
  const tod = todRef.current;
  const night = tod < 0.18 || tod > 0.82;

  return <>
    <FerryCameraController controlsRef={controlsRef} cameraRef={cameraRef} autoRotateRef={autoRotateRef} initialView={initialView} defaultView={defaultView} seaView={seaView} birdView={birdView} trainCityView={trainCityView} streetView={streetView} panoramaView={panoramaView} hubPlazaView={hubPlazaView} skywalkView={skywalkView} marketView={marketView} cultureView={cultureView} vipView={vipView} stopIntroRotation={stopIntroRotation} />
    <ClickToFly controlsRef={controlsRef} cameraRef={cameraRef} autoRotateRef={autoRotateRef} stopIntroRotation={stopIntroRotation} />
    <HubGameplayLayer tod={tod} isTouchDevice={isTouchDevice} controlsRef={controlsRef} cameraRef={cameraRef} active={playMode} />
    <Sky tod={tod} />
    <Lighting tod={tod} />
    <FerryQualityPolish tod={tod} qualityTier={qualityTier} />
    <Celestial tod={tod} />
    <Ocean tod={tod} qualityBoost={seaQualityBoost} />
    {!isMobile && <Foam qualityBoost={seaQualityBoost} />}
    <FerryTrainCityPlaza night={night} isMobile={isMobile} compactScene={compactScene} position={[-24, -1.18, -62]} />
    <Ferry tod={tod} />
    <JetSkis tod={tod} />
    <Seagulls tod={tod} />
    <Pontoons />
    <MarineLife tod={tod} qualityBoost={seaQualityBoost} />
    <Clouds tod={tod} />
    {/* New ocean life elements */}
    <SailBoats tod={tod} />
    <CargoShipAutonomous tod={tod} />
    <CargoPorts tod={tod} />
    <CoastalHarborsAndFleet tod={tod} />
    <SmallIsland tod={tod} />
    <FishingBoat tod={tod} />
    <ShoppingMall tod={tod} />
    {!compactScene && <MarinaBuildingSeaLevel tod={tod} />}
    <LuxuryYachts tod={tod} />
    <DockedMegaCruiseYacht tod={tod} />
    <DronePatrol tod={tod} />
    <FlyingHeliFromYacht />
    <DockedDefenseCarrier tod={tod} />
    <SeaWalls tod={tod} />
    <HubWorldExpansion tod={tod} />
    <HubEventScenery tod={tod} scenario={hubScenario} season={hubSeason} />
    <BackScenery tod={tod} />
    <TropicalIsland tod={tod} />
    {night && <Stars radius={3200} depth={1500} count={qualityTier === 'desktop' ? 3000 : qualityTier === 'tablet' ? 1900 : 1200} factor={4.6} fade speed={1} />}
    <color attach="background" args={[night ? '#07111f' : '#8cc7ee']} />
    <fog attach="fog" args={[night ? '#07111f' : '#8cc7ee', qualityTier === 'mobile' ? 780 : qualityTier === 'tablet' ? 1080 : 1240, qualityTier === 'mobile' ? 2500 : qualityTier === 'tablet' ? 3300 : 3900]} />
    
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={2.8}
      maxDistance={isMobile ? 124 : isTablet ? 166 : 186}
      minPolarAngle={0.03}
      maxPolarAngle={Math.PI - 0.12}
      autoRotate={autoRotateRef.current}
      autoRotateSpeed={0.22}
      target={defaultView.target}
      enableDamping={true}
      dampingFactor={0.06}
      rotateSpeed={isTouchDevice ? 2.8 : 1.6}
      zoomSpeed={isTouchDevice ? 2.2 : 1.8}
      panSpeed={isTouchDevice ? 2.4 : 1.4}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      screenSpacePanning={true}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  </>;
}

// ─── Export with Performance Optimization ───────────────────
const FerryBackground = memo(() => {
  const { isMobile, isTablet, isLowPower, threeDSettings, isTouchDevice, shouldReduceParticles, shouldDisableHeavyEffects, preferFastDesktop } = useMobileOptimization();
  const soundEffects = useSoundEffects();
  const { playShipHorn, playSeagull, startOceanAmbient } = soundEffects;
  const [sceneHoldPaused, setSceneHoldPaused] = useState(false);
  const [instantReady, setInstantReady] = useState(false);
  const [showPremiumSuggestions, setShowPremiumSuggestions] = useState(false);
  const [premiumIndex, setPremiumIndex] = useState(0);
  const [carrierFollowMode, setCarrierFollowMode] = useState('high');
  const [hubScenario, setHubScenario] = useState('premium');
  const [hubSeason, setHubSeason] = useState('summer');
  const [playMode, setPlayMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastTapRef = useRef(0);

  const premiumSuggestions = useMemo(() => [
    { label: 'Ferry principal', blurb: 'Vue d’ensemble du hub et du quai', action: 'setFerryBirdView' },
    { label: 'Mer & horizon', blurb: 'Découverte de la côte et du large', action: 'setFerrySeaView' },
    { label: 'Train City', blurb: 'Suivi du centre-ville et de la gare', action: 'setFerryTrainCityView' },
    { label: 'Ruelle / rue', blurb: 'Vue proche et immersive du port', action: 'setFerryStreetView' },
    { label: 'Panorama', blurb: 'Grand angle premium et émerveillement', action: 'setFerryPanoramaView' },
  ], []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowPremiumSuggestions(true), 50000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showPremiumSuggestions) return undefined;
    const interval = window.setInterval(() => {
      setPremiumIndex((prev) => (prev + 1) % premiumSuggestions.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [showPremiumSuggestions, premiumSuggestions.length]);

  useEffect(() => {
    if (!showPremiumSuggestions) return;
    const action = premiumSuggestions[premiumIndex]?.action;
    if (action && window[action]) {
      window[action]();
    }
  }, [premiumIndex, premiumSuggestions, showPremiumSuggestions]);

  const canvasShadows = !isMobile && !isLowPower && !shouldDisableHeavyEffects;
  const detectedDpr = threeDSettings?.dpr || 1.35;
  const baseDpr = isMobile
    ? Math.min(detectedDpr, 1.1)
    : isTablet
      ? Math.min(Math.max(detectedDpr, 1.15), 1.3)
      : Math.min(Math.max(detectedDpr, 1.55), 1.85);
  const initialDpr = Math.max(0.72, baseDpr * 0.82);

  // Play seagull sounds periodically
  useEffect(() => {
    if (isMobile || isLowPower) return undefined;
    const seagullInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        playSeagull?.();
      }
    }, 28000);
    return () => clearInterval(seagullInterval);
  }, [playSeagull, isMobile, isLowPower]);

  useEffect(() => {
    const timer = setTimeout(() => setInstantReady(true), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const applyCarrierFollow = (mode) => {
    setCarrierFollowMode(mode);
    if (mode === 'high' && window.setFerryCarrierFollowHigh) {
      window.setFerryCarrierFollowHigh();
    } else if (mode === 'close' && window.setFerryCarrierFollowClose) {
      window.setFerryCarrierFollowClose();
    } else if (window.stopFerryAutoCameraSequence) {
      window.stopFerryAutoCameraSequence();
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const scenarioOptions = [
    { id: 'premium', label: 'Premium' },
    { id: 'festival', label: 'Lumières' },
    { id: 'concert', label: 'Concert' },
    { id: 'market', label: 'Marché' },
    { id: 'fashion', label: 'Défilé' },
    { id: 'sports', label: 'Sport' },
    { id: 'fireworks', label: 'Feux' },
    { id: 'parade', label: 'Parade' },
  ];

  const seasonOptions = [
    { id: 'summer', label: 'Été' },
    { id: 'spring', label: 'Printemps' },
    { id: 'winter', label: 'Noël' },
    { id: 'national', label: 'National' },
  ];

  const poiOptions = [
    { id: 'hub', label: 'Hub central', action: 'setFerryHubPlazaView' },
    { id: 'skywalk', label: 'Skywalk', action: 'setFerrySkywalkView' },
    { id: 'market', label: 'Marché', action: 'setFerryMarketView' },
    { id: 'culture', label: 'Culture', action: 'setFerryCultureView' },
    { id: 'vip', label: 'VIP', action: 'setFerryVipView' },
    { id: 'carrier', label: 'Carrier', action: 'setFerryCarrierFollowHigh' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ pointerEvents: 'none' }}>
        <div
          style={{ pointerEvents: 'auto', width: '100%', height: '100%', touchAction: 'none' }}

          onPointerDown={(event) => {
            setSceneHoldPaused(true);
            if (window.stopFerryAutoCameraSequence) window.stopFerryAutoCameraSequence();

            const now = Date.now();
            const isDoubleTap = event.pointerType === 'touch' && (now - lastTapRef.current) < 320;
            lastTapRef.current = now;

            if (isDoubleTap) {
              const nextIndex = (premiumIndex + 1) % premiumSuggestions.length;
              setPremiumIndex(nextIndex);
              const nextAction = premiumSuggestions[nextIndex]?.action;
              if (nextAction && window[nextAction]) {
                window[nextAction]();
              }
            }
          }}
          onPointerUp={() => setSceneHoldPaused(false)}
          onPointerCancel={() => setSceneHoldPaused(false)}
          onPointerLeave={() => setSceneHoldPaused(false)}
        >
          <Canvas 
            shadows={canvasShadows}
            camera={{ position: [isMobile ? 20 : 19, isMobile ? 9.2 : 7.6, isMobile ? 20 : 18], fov: isMobile ? 74 : 68, near: 0.1, far: 5200 }}
            dpr={instantReady ? baseDpr : initialDpr}
            gl={{ 
              antialias: !isMobile && !isLowPower,
              alpha: false, 
              powerPreference: isMobile || isLowPower ? 'default' : 'high-performance',
              precision: 'highp',
              stencil: true,
              depth: true,
              preserveDrawingBuffer: false,
            }}
            frameloop="always"
            performance={{ min: instantReady ? (isMobile ? 0.8 : 0.9) : 0.72, debounce: instantReady ? 140 : 80 }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.16;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.physicallyCorrectLights = true;
              gl.shadowMap.enabled = canvasShadows;
              if (canvasShadows) {
                gl.shadowMap.type = THREE.PCFSoftShadowMap;
              }
            }}
          >
            <Scene isMobile={isMobile} isTablet={isTablet} isLowPower={isLowPower} shouldReduceParticles={shouldReduceParticles} shouldDisableHeavyEffects={shouldDisableHeavyEffects} preferFastDesktop={preferFastDesktop} sceneHoldPaused={sceneHoldPaused} isTouchDevice={isTouchDevice} threeDSettings={threeDSettings} hubScenario={hubScenario} hubSeason={hubSeason} playMode={playMode} />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_42%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.05)_0%,rgba(2,6,23,0.12)_72%,rgba(2,6,23,0.35)_100%)]" />
          <div className="absolute inset-0 opacity-[0.12] mix-blend-soft-light" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)', backgroundSize: '4px 4px' }} />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.26)]" />
        </div>

        <div className="pointer-events-auto absolute left-4 top-4 z-10 max-w-[19rem] rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-3 shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 18px 44px rgba(8, 145, 178, 0.18)' }}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Scénarisation du hub</div>
          <div className="mb-2 flex flex-wrap gap-2">
            {scenarioOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setHubScenario(option.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  hubScenario === option.id
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Décor saisonnier</div>
          <div className="flex flex-wrap gap-2">
            {seasonOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setHubSeason(option.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  hubSeason === option.id
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto absolute left-4 top-[17.75rem] z-10 max-w-[19rem] rounded-2xl border border-white/15 bg-slate-950/58 p-3 shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 18px 44px rgba(15, 23, 42, 0.28)' }}>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Points d'intérêt</div>
          <div className="grid grid-cols-2 gap-2">
            {poiOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  const action = window[option.action];
                  if (action) action();
                }}
                className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-left text-[10px] font-medium text-slate-100 transition hover:border-cyan-200/50 hover:bg-cyan-500/10"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] leading-4 text-slate-300/80">Clique pour déplacer la caméra sur une zone du hub ou sur le porte-avions.</div>
        </div>

        <div className="pointer-events-auto absolute bottom-4 right-4 z-10 max-w-[20rem] rounded-2xl border border-cyan-300/25 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 18px 44px rgba(8, 145, 178, 0.22)' }}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Gameplay</span>
            <span className="text-[10px] text-slate-300">{playMode ? 'Actif' : 'Observation'}</span>
          </div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPlayMode((value) => !value)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
                playMode
                  ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
              }`}
            >
              {playMode ? 'Passer en caméra libre' : 'Passer en mode joueur'}
            </button>
            <button
              type="button"
              onClick={() => { void toggleFullscreen(); }}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
                isFullscreen
                  ? 'border-emerald-300 bg-emerald-400/20 text-emerald-50'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
              }`}
            >
              {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-200/90">
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">WASD / stick : déplacer</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">E / X : entrer-sortir</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">Space / A : saut</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">Drag souris : orientation</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-200/90">
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">Shift / RB : sprint</div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">Plein écran: visible</div>
          </div>
        </div>
        
        {/* Audio Controls for Ferry */}
        <div style={{ pointerEvents: 'auto' }}>
          <HubAudioControls 
            hubType="ferry" 
            soundEffects={soundEffects}
            position="bottom-right"
          />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 z-10 rounded-2xl border border-cyan-300/25 bg-slate-950/60 px-3 py-2 shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 18px 44px rgba(8, 145, 178, 0.22)' }}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Suivi porte-avions</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyCarrierFollow('high')}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
              carrierFollowMode === 'high'
                ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
            }`}
          >
            Haut
          </button>
          <button
            type="button"
            onClick={() => applyCarrierFollow('close')}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
              carrierFollowMode === 'close'
                ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50'
                : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
            }`}
          >
            Proche
          </button>
          <button
            type="button"
            onClick={() => {
              setCarrierFollowMode('');
              if (window.stopFerryAutoCameraSequence) window.stopFerryAutoCameraSequence();
            }}
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-200 transition hover:border-cyan-200/50 hover:bg-cyan-500/10"
          >
            Normal
          </button>
        </div>
      </div>

      {showPremiumSuggestions && (
        <div className="pointer-events-auto absolute right-4 top-4 z-10 max-w-xs rounded-2xl border border-white/20 bg-slate-950/55 p-3 shadow-2xl backdrop-blur-md" style={{ boxShadow: '0 20px 55px rgba(15, 23, 42, 0.5)' }}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Premium</span>
            <span className="text-[10px] text-slate-300">{premiumSuggestions[premiumIndex]?.label}</span>
          </div>
          <div className="text-sm font-medium text-white">{premiumSuggestions[premiumIndex]?.blurb}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {premiumSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => {
                  setPremiumIndex(index);
                  if (suggestion.action && window[suggestion.action]) {
                    window[suggestion.action]();
                  }
                }}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                  premiumIndex === index
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-200/50 hover:bg-cyan-500/10'
                }`}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Camera buttons are created in pure DOM via FerryCameraButtons */}
      <FerryCameraButtons />
    </>
  );
});

FerryBackground.displayName = 'FerryBackground';

export default FerryBackground;
