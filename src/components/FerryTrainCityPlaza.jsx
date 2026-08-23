import React, { useRef, useMemo, useEffect, useState } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TrainStationReplicaWorld } from './TrainStation';

const blendHex = (from, to, amount = 0.5) => {
  const base = new THREE.Color(from);
  base.lerp(new THREE.Color(to), amount);
  return `#${base.getHexString()}`;
};

const pickSeeded = (items, seed) => items[Math.abs(seed) % items.length];

export function FerryTrainCityPlaza({
  night,
  position = [-96, -1.18, -62],
  rotation = [0, -0.12, 0],
  scale = [1, 1, 1],
  isMobile = false,
  compactScene = false,
}) {
  const territoryCenterZ = -118;
  const frontBeachZ = territoryCenterZ + 99;
  const backBeachZ = territoryCenterZ - 99;
  const northMovedDetailZ = backBeachZ - 16;
  const frontStoneZ = territoryCenterZ + 109;
  const topColor = night ? '#f5f8ff' : '#ffffff';
  const sideColor = night ? '#d9e2f1' : '#eef3fa';
  const edgeGlow = night ? '#7fd9ff' : '#c8d6ea';
  const railColor = night ? '#eef5ff' : '#ffffff';
  const domeColor = night ? '#6fd8ff' : '#bfefff';
  const sandColor = night ? '#f0e4cf' : '#fbf1df';
  const gravelColor = night ? '#a8b1bb' : '#c2c9d0';
  const stoneColor = night ? '#9099a4' : '#b6bec8';
  const concreteColor = night ? '#bfc8d3' : '#dfe5ec';

  const defaultTerritoryGroundColor = '#0a2f66';
  const territoryGroundPalette = useMemo(() => ([
    '#0a2f66', // bleu sombre (défaut)
    '#ffffff', // blanc
    '#f6d629', // jaune
    '#22c55e', // vert
    '#ff7a18', // orange
    '#ef4444', // rouge
    '#7c3aed', // violet
    '#06b6d4', // cyan
    '#ec4899', // rose
    '#8b5e3c', // brun
    '#38bdf8', // bleu clair
    '#9ca3af', // argent
  ]), []);

  const shuffledTerritoryGroundPalette = useMemo(() => {
    const arr = [...territoryGroundPalette];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [territoryGroundPalette]);

  const [territoryGroundStep, setTerritoryGroundStep] = useState(-1);

  useEffect(() => {
    if (!shuffledTerritoryGroundPalette.length) return undefined;

    let rotationInterval;
    const firstShiftTimeout = setTimeout(() => {
      setTerritoryGroundStep(0);
      rotationInterval = setInterval(() => {
        setTerritoryGroundStep((prev) => ((prev + 1) % shuffledTerritoryGroundPalette.length));
      }, 12000);
    }, 20000);

    return () => {
      clearTimeout(firstShiftTimeout);
      if (rotationInterval) clearInterval(rotationInterval);
    };
  }, [shuffledTerritoryGroundPalette]);

  const territoryGroundColor = territoryGroundStep < 0
    ? defaultTerritoryGroundColor
    : shuffledTerritoryGroundPalette[territoryGroundStep];
  const territoryGroundSoft = blendHex(territoryGroundColor, '#f3f8ff', night ? 0.14 : 0.28);
  const territoryGroundDeep = blendHex(territoryGroundColor, '#0a1222', night ? 0.42 : 0.24);
  const territoryBeachTone = blendHex(territoryGroundColor, '#fff2d1', night ? 0.22 : 0.46);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Enveloppe territoriale moins ronde et énormément plus reculée */}
      <group>
        <mesh position={[0, 138, -1647]}>
          <boxGeometry args={[2960, 34, 2680]} />
          <meshPhysicalMaterial
            color={domeColor}
            transparent
            opacity={night ? 0.13 : 0.08}
            roughness={0.04}
            metalness={0.04}
            transmission={0.76}
            clearcoat={1}
            clearcoatRoughness={0.05}
            side={1}
          />
        </mesh>
        <mesh position={[-1480, 24, -1647]}>
          <boxGeometry args={[30, 268, 2680]} />
          <meshPhysicalMaterial color={domeColor} transparent opacity={night ? 0.1 : 0.06} roughness={0.05} metalness={0.04} transmission={0.72} clearcoat={1} clearcoatRoughness={0.05} side={1} />
        </mesh>
        <mesh position={[1480, 24, -1647]}>
          <boxGeometry args={[30, 268, 2680]} />
          <meshPhysicalMaterial color={domeColor} transparent opacity={night ? 0.1 : 0.06} roughness={0.05} metalness={0.04} transmission={0.72} clearcoat={1} clearcoatRoughness={0.05} side={1} />
        </mesh>
        <mesh position={[0, 24, -2977]}>
          <boxGeometry args={[2960, 268, 30]} />
          <meshPhysicalMaterial color={domeColor} transparent opacity={night ? 0.1 : 0.06} roughness={0.05} metalness={0.04} transmission={0.72} clearcoat={1} clearcoatRoughness={0.05} side={1} />
        </mesh>
      </group>
      <mesh position={[0, -0.9, -1697]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2780, 2480]} />
        <meshStandardMaterial color={railColor} emissive={edgeGlow} emissiveIntensity={night ? 0.28 : 0.02} transparent opacity={night ? 0.18 : 0.08} side={2} />
      </mesh>

      {/* Ligne blanche = frontière du territoire. Rien n'est posé dessus. */}
      <mesh position={[0, -0.95, 0]}>
        <boxGeometry args={[330, 0.28, 2.8]} />
        <meshStandardMaterial color={railColor} emissive={edgeGlow} emissiveIntensity={night ? 0.42 : 0.03} roughness={0.16} metalness={0.08} />
      </mesh>

      {/* Grand nouveau sol Ferry — très bas sous la ville */}
      <RoundedBox args={[322, 1.82, 236]} radius={0.8} smoothness={6} position={[0, -2.4, territoryCenterZ]}>
        <meshPhysicalMaterial color={territoryGroundColor} roughness={0.22} metalness={0.06} clearcoat={0.42} clearcoatRoughness={0.22} />
      </RoundedBox>
      {/* Fine couche supprimée — le Ground du TrainStation gère les surfaces */}

      {/* Plage arrière uniquement — plage front supprimée (bande beige gênante) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, backBeachZ]}>
        <planeGeometry args={[292, 24]} />
        <meshStandardMaterial color={territoryBeachTone} roughness={0.96} metalness={0.02} />
      </mesh>

      {/* Bande pierre front supprimée */}

      {/* Cailloux / graviers — côté arrière uniquement */}
      {[
        [-128, 0.34, backBeachZ + 2], [-84, 0.32, backBeachZ - 4], [-18, 0.34, backBeachZ + 4], [34, 0.32, backBeachZ - 4], [94, 0.34, backBeachZ + 2], [136, 0.32, backBeachZ - 6],
      ].map(([x, y, z], index) => (
        <group key={`ferry-train-gravel-${index}`} position={[x, y, z]}>
          <mesh rotation={[0.18 * index, 0.12 * index, 0.1]}>
            <dodecahedronGeometry args={[index % 3 === 0 ? 2.2 : 1.35, 0]} />
            <meshStandardMaterial color={gravelColor} roughness={0.96} metalness={0.01} />
          </mesh>
          <mesh position={[2.8, -0.02, index % 2 === 0 ? -1.4 : 1.3]} rotation={[0.2, 0.34, 0.16]}>
            <dodecahedronGeometry args={[0.92, 0]} />
            <meshStandardMaterial color={stoneColor} roughness={0.98} metalness={0.01} />
          </mesh>
          <mesh position={[-2.4, -0.02, index % 2 === 0 ? 1.2 : -1.2]} rotation={[0.12, 0.18, 0.28]}>
            <dodecahedronGeometry args={[0.64, 0]} />
            <meshStandardMaterial color={gravelColor} roughness={0.98} metalness={0.01} />
          </mesh>
        </group>
      ))}

      {/* Bordure arrière basse */}
      <mesh position={[0, -0.18, territoryCenterZ - 118]}>
        <boxGeometry args={[326, 0.88, 8]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.06} metalness={0.14} clearcoat={1} clearcoatRoughness={0.03} />
      </mesh>
      <mesh position={[0, 0.16, territoryCenterZ + 117]}>
        <boxGeometry args={[326, 1.36, 6]} />
        <meshPhysicalMaterial color={concreteColor} roughness={0.42} metalness={0.06} clearcoat={0.14} clearcoatRoughness={0.46} />
      </mesh>

      {/* Murailles de pierre et béton à gauche et à droite du sol */}
      {[-161, 161].map((x, wallIndex) => (
        <group key={`ferry-train-side-wall-${wallIndex}`} position={[x, 0, territoryCenterZ]}>
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[10, 0.96, 236]} />
            <meshPhysicalMaterial color={concreteColor} roughness={0.46} metalness={0.06} clearcoat={0.18} clearcoatRoughness={0.52} />
          </mesh>
          {[-98, -58, -18, 22, 62, 102].map((z, stoneIndex) => (
            <mesh key={`wall-stone-${stoneIndex}`} position={[wallIndex === 0 ? 0.35 : -0.35, 0.38, z]} rotation={[0.08 * stoneIndex, 0.12 * stoneIndex, 0]}>
              <boxGeometry args={[8.6, 0.82 + (stoneIndex % 2) * 0.16, 26]} />
              <meshStandardMaterial color={stoneIndex % 2 === 0 ? stoneColor : gravelColor} roughness={0.98} metalness={0.01} />
            </mesh>
          ))}
          <mesh position={[0, 0.64, 0]}>
            <boxGeometry args={[9.2, 0.24, 236]} />
            <meshPhysicalMaterial color="#f4f7fb" roughness={0.14} metalness={0.12} clearcoat={0.28} clearcoatRoughness={0.18} />
          </mesh>
        </group>
      ))}

      {/* Pilotis / masse de soutien pour agrandir la surface de la bulle */}
      {[-136, -76, -18, 40, 98, 146].map((x, index) => (
        <group key={`ferry-train-support-${index}`} position={[x, -1.42, index % 2 === 0 ? territoryCenterZ - 57 : territoryCenterZ + 61]}>
          <mesh position={[0, 0.56, 0]}>
            <boxGeometry args={[7.4, 1.44, 7.4]} />
            <meshStandardMaterial color={sideColor} roughness={0.5} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[8.4, 0.45, 8.4]} />
            <meshStandardMaterial color={topColor} roughness={0.22} metalness={0.08} />
          </mesh>
        </group>
      ))}

      {/* Sol de base continent — couleur identique au sol TrainStation pour masquer les gaps */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, territoryCenterZ]}>
        <planeGeometry args={[308, 222]} />
        <meshPhysicalMaterial color={territoryGroundSoft} roughness={0.42} metalness={0.03} clearcoat={0.16} clearcoatRoughness={0.56} />
      </mesh>

      {/* Paysage périphérique — espaces verts et sols variés au-delà de la ville */}
      {[
        [-108, -0.78, territoryCenterZ - 68, 76, 44, night ? '#26412b' : '#7ea96c'],
        [108, -0.78, territoryCenterZ - 56, 72, 42, night ? '#223a29' : '#739d63'],
        [-116, -0.78, territoryCenterZ + 62, 74, 40, night ? '#28452d' : '#86b173'],
        [114, -0.78, territoryCenterZ + 70, 78, 46, night ? '#24402a' : '#7aa868'],
        [0, -0.79, territoryCenterZ - 96, 180, 26, night ? '#46503f' : '#b8af92'],
        [0, -0.79, territoryCenterZ + 96, 176, 24, night ? '#3f493b' : '#c2b79a'],
      ].map(([x, y, z, w, h, color], index) => (
        <mesh key={`outer-landscape-strip-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={blendHex(color, territoryGroundDeep, 0.62)} roughness={0.96} metalness={0.01} />
        </mesh>
      ))}
      {[
        [-126, -0.77, territoryCenterZ - 12, 18, night ? '#305337' : '#6f9a5d'],
        [-92, -0.77, territoryCenterZ + 14, 16, night ? '#2f5035' : '#88b879'],
        [88, -0.77, territoryCenterZ + 18, 16, night ? '#2a4a31' : '#7fab69'],
        [126, -0.77, territoryCenterZ - 18, 18, night ? '#305237' : '#75a562'],
      ].map(([x, y, z, r, color], index) => (
        <mesh key={`outer-landscape-round-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]}>
          <circleGeometry args={[r, 24]} />
          <meshStandardMaterial color={blendHex(color, territoryGroundDeep, 0.58)} roughness={0.98} metalness={0.01} />
        </mesh>
      ))}
      {[-136, -96, 96, 136].map((x, index) => (
        <group key={`outer-tree-cluster-${index}`} position={[x, -0.05, index % 2 === 0 ? territoryCenterZ - 86 : territoryCenterZ + 84]}>
          {[-8, -3, 2, 7].map((tx, treeIndex) => (
            <group key={`outer-tree-${treeIndex}`} position={[tx, 0, treeIndex % 2 === 0 ? -2 : 2]}>
              <mesh position={[0, 1.2, 0]}><sphereGeometry args={[2.4 + treeIndex * 0.18, 10, 10]} /><meshStandardMaterial color={night ? '#18311f' : ['#5d8b4f', '#6b9757', '#79a866', '#6f9d5e'][treeIndex]} roughness={0.88} /></mesh>
              <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.16, 0.22, 1.1, 6]} /><meshStandardMaterial color="#6b4a2b" roughness={0.95} /></mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Réplique COMPLÈTE — remontée davantage pour dégager du sol blanc */}
      <group position={[0, 1.1, territoryCenterZ + 18]} scale={[0.92, 0.92, 0.92]}>
        <TrainStationReplicaWorld
          isNight={night}
          isMobile={isMobile}
          compactScene={false}
          onTrainHorn={null}
          includeLocalLights={false}
          replicaSouthAvenue
        />
      </group>

      {/* ═══ CIRCUIT FERROVIAIRE TOUR DE VILLE + 4 GARES ═══ */}
      {!isMobile && <CityCircuitRailway night={night} centerZ={territoryCenterZ + 18} />}

      {/* ═══ MEGA CITY EXPANSION ═══ */}
      <MegaCityExpansion night={night} centerZ={territoryCenterZ + 18} />
    </group>
  );
}

function getRectLoopPose(dist, halfW, halfH, inset = 0) {
  const left = -halfW + inset;
  const right = halfW - inset;
  const top = -halfH + inset;
  const bottom = halfH - inset;
  const radius = Math.max(0, Math.min(Math.abs(inset), (right - left) / 2 - 0.01, (bottom - top) / 2 - 0.01));
  const normalize = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  if (radius < 0.01) {
    const spanX = right - left;
    const spanZ = bottom - top;
    const perimeter = spanX * 2 + spanZ * 2;
    const d = ((dist % perimeter) + perimeter) % perimeter;

    if (d < spanX) return { x: left + d, z: top, rot: 0, perimeter };
    if (d < spanX + spanZ) return { x: right, z: top + (d - spanX), rot: Math.PI / 2, perimeter };
    if (d < spanX * 2 + spanZ) return { x: right - (d - spanX - spanZ), z: bottom, rot: Math.PI, perimeter };
    return { x: left, z: bottom - (d - spanX * 2 - spanZ), rot: -Math.PI / 2, perimeter };
  }

  const straightX = Math.max(0, right - left - radius * 2);
  const straightZ = Math.max(0, bottom - top - radius * 2);
  const arc = Math.PI * radius * 0.5;
  const perimeter = straightX * 2 + straightZ * 2 + arc * 4;
  let d = ((dist % perimeter) + perimeter) % perimeter;

  if (d < straightX) return { x: left + radius + d, z: top, rot: 0, perimeter };
  d -= straightX;

  if (d < arc) {
    const theta = -Math.PI / 2 + d / radius;
    return {
      x: right - radius + Math.cos(theta) * radius,
      z: top + radius + Math.sin(theta) * radius,
      rot: normalize(theta + Math.PI / 2),
      perimeter,
    };
  }
  d -= arc;

  if (d < straightZ) return { x: right, z: top + radius + d, rot: Math.PI / 2, perimeter };
  d -= straightZ;

  if (d < arc) {
    const theta = d / radius;
    return {
      x: right - radius + Math.cos(theta) * radius,
      z: bottom - radius + Math.sin(theta) * radius,
      rot: normalize(theta + Math.PI / 2),
      perimeter,
    };
  }
  d -= arc;

  if (d < straightX) return { x: right - radius - d, z: bottom, rot: Math.PI, perimeter };
  d -= straightX;

  if (d < arc) {
    const theta = Math.PI / 2 + d / radius;
    return {
      x: left + radius + Math.cos(theta) * radius,
      z: bottom - radius + Math.sin(theta) * radius,
      rot: normalize(theta + Math.PI / 2),
      perimeter,
    };
  }
  d -= arc;

  if (d < straightZ) return { x: left, z: bottom - radius - d, rot: -Math.PI / 2, perimeter };
  d -= straightZ;

  const theta = Math.PI + d / radius;
  return {
    x: left + radius + Math.cos(theta) * radius,
    z: top + radius + Math.sin(theta) * radius,
    rot: normalize(theta + Math.PI / 2),
    perimeter,
  };
}

function AnimatedPedestrian({
  position = [0, 0, 0],
  heading = 0,
  scale = 1,
  bodyColor = '#1f2a38',
  skinColor = '#f1c39f',
  hairColor = null,
  topColor = null,
  bottomColor = null,
  accentColor = null,
  shoeColor = '#111111',
  build = 'regular',
  headwear = 'none',
  backpack = false,
  phone = false,
  carry = 'none',
  moveMode = 'shuffle',
  variant = 'casual',
  gesture = 'none',
  moveRadius = 0.28,
  route = [1, 0],
  pace = 1,
  phase = 0,
  dataTestId,
}) {
  const rootRef = useRef();
  const torsoRef = useRef();
  const headRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const basePosRef = useRef({ x: position[0], y: position[1], z: position[2] });
  const bodyScale = build === 'child'
    ? { x: 0.84, y: 0.84, z: 0.84 }
    : build === 'broad'
      ? { x: 1.18, y: 1.02, z: 1.12 }
      : build === 'slim'
        ? { x: 0.9, y: 1.02, z: 0.9 }
        : { x: 1, y: 1, z: 1 };
  const styleSeed = useMemo(
    () => Math.abs(Math.round(position[0] * 11 + position[2] * 7 + phase * 23 + scale * 19 + (dataTestId?.length || 0))),
    [position, phase, scale, dataTestId],
  );
  const wardrobe = useMemo(() => {
    const resolvedTop = topColor || bodyColor;
    const resolvedBottom = bottomColor || blendHex(bodyColor, build === 'child' ? '#2a3c52' : '#111823', build === 'broad' ? 0.34 : 0.42);
    const resolvedHair = headwear === 'helmet'
      ? null
      : hairColor || pickSeeded(['#141414', '#39261f', '#6a4028', '#8a5b36', '#d3b068', '#6f1126', '#5d5d68'], styleSeed + 3);
    return {
      top: resolvedTop,
      bottom: resolvedBottom,
      sleeve: blendHex(resolvedTop, '#eff3f8', 0.1),
      collar: blendHex(resolvedTop, accentColor || '#f3f5f8', accentColor ? 0.32 : 0.14),
      hair: resolvedHair,
      hand: blendHex(skinColor, '#f6dcc8', 0.08),
      hairStyle: headwear === 'helmet' ? 'none' : pickSeeded(['short', 'bob', 'bun', 'waves', 'fade'], styleSeed + 5),
      expression: gesture === 'wave' || variant === 'chatting' ? 'smile' : gesture === 'phone' ? 'focused' : pickSeeded(['smile', 'neutral', 'grin'], styleSeed + 9),
      hasBeard: build !== 'child' && headwear === 'none' && (styleSeed % 5 === 0),
    };
  }, [topColor, bodyColor, bottomColor, build, headwear, hairColor, styleSeed, accentColor, skinColor, gesture, variant]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * pace + phase;
    const root = rootRef.current;
    if (!root) return;

    const swingBase = Math.sin(t * 4.4);
    const stride = moveMode === 'guard' ? 0.18 : moveMode === 'queue' ? 0.32 : variant === 'fast' ? 0.9 : 0.72;
    const armSwing = moveMode === 'guard' ? 0.16 : moveMode === 'queue' ? 0.32 : variant === 'fast' ? 0.78 : 0.65;
    let leftArmX = swingBase * armSwing;
    let rightArmX = -swingBase * armSwing;
    let leftArmZ = 0;
    let rightArmZ = 0;
    let headYaw = Math.sin(t * 0.45 + phase) * 0.08;
    let headPitch = 0;
    let torsoLeanX = moveMode === 'guard' ? 0 : Math.sin(t * 0.42 + phase) * 0.04;
    let torsoLeanZ = variant === 'relaxed' ? Math.sin(t * 0.5 + phase) * 0.05 : 0;

    if (gesture === 'phone') {
      rightArmX = -1.45 + Math.sin(t * 2.6) * 0.05;
      rightArmZ = -0.36;
      headYaw = 0.22;
      headPitch = -0.08;
    } else if (gesture === 'wave') {
      leftArmX = -1.2 + Math.sin(t * 6.4) * 0.35;
      leftArmZ = 0.5;
    } else if (gesture === 'talk') {
      rightArmX = -0.5 + Math.sin(t * 5.2) * 0.28;
      rightArmZ = -0.18;
      headYaw = Math.sin(t * 1.1 + phase) * 0.24;
    } else if (gesture === 'clap') {
      leftArmX = -0.95 + Math.sin(t * 6.2) * 0.22;
      rightArmX = -0.95 - Math.sin(t * 6.2) * 0.22;
      leftArmZ = 0.28;
      rightArmZ = -0.28;
    } else if (gesture === 'point') {
      rightArmX = -0.9;
      rightArmZ = -0.48;
      headYaw = -0.18;
    }

    if (variant === 'security') {
      torsoLeanX *= 0.25;
      torsoLeanZ *= 0.2;
      headYaw *= 0.35;
    } else if (variant === 'chatting') {
      torsoLeanZ = Math.sin(t * 0.8 + phase) * 0.08;
      headYaw *= 1.9;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = leftArmX;
      leftArmRef.current.rotation.z = leftArmZ;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = rightArmX;
      rightArmRef.current.rotation.z = rightArmZ;
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = -swingBase * stride;
    if (rightLegRef.current) rightLegRef.current.rotation.x = swingBase * stride;
    if (torsoRef.current) {
      torsoRef.current.position.y = 1.08 + Math.abs(Math.sin(t * 4.4)) * (moveMode === 'guard' ? 0.03 : 0.08);
      torsoRef.current.rotation.x = torsoLeanX;
      torsoRef.current.rotation.z = torsoLeanZ;
    }
    if (headRef.current) {
      headRef.current.rotation.y = headYaw;
      headRef.current.rotation.x = headPitch;
    }

    const base = basePosRef.current;
    root.position.y = base.y;
    if (moveMode === 'patrol-x') {
      root.position.x = base.x + Math.sin(t * 0.7) * moveRadius;
      root.position.z = base.z;
      root.rotation.y = Math.cos(t * 0.7) >= 0 ? 0 : Math.PI;
    } else if (moveMode === 'patrol-z') {
      root.position.x = base.x;
      root.position.z = base.z + Math.sin(t * 0.7) * moveRadius;
      root.rotation.y = Math.cos(t * 0.7) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (moveMode === 'queue') {
      root.position.x = base.x + Math.sin(t * 0.45) * moveRadius * 0.12;
      root.position.z = base.z + Math.sin(t * 0.9) * moveRadius * 0.62;
      root.rotation.y = heading + Math.sin(t * 0.5) * 0.08;
    } else if (moveMode === 'guard') {
      root.position.x = base.x + Math.sin(t * 0.45) * 0.04;
      root.position.z = base.z;
      root.rotation.y = heading + Math.sin(t * 0.35) * 0.05;
    } else if (moveMode === 'flow') {
      const [rx, rz] = route;
      const mag = Math.hypot(rx, rz) || 1;
      const nx = rx / mag;
      const nz = rz / mag;
      const travel = Math.sin(t * 0.45) * moveRadius;
      const forward = Math.cos(t * 0.45) >= 0;
      root.position.x = base.x + nx * travel;
      root.position.z = base.z + nz * travel;
      root.rotation.y = heading + (forward ? 0 : Math.PI);
    } else {
      root.position.x = base.x + Math.sin(t * 0.52 + phase) * moveRadius * 1.28;
      root.position.z = base.z + Math.cos(t * 0.45 + phase) * moveRadius * 0.96;
      root.rotation.y = heading + Math.sin(t * 0.55 + phase) * 0.45;
    }
  });

  return (
    <group ref={rootRef} position={position} rotation={[0, heading, 0]} scale={[scale, scale, scale]}>
      <group ref={torsoRef} position={[0, 1.08, 0]} scale={[bodyScale.x, bodyScale.y, bodyScale.z]}>
        <mesh position={[0, 0.08, 0]}><capsuleGeometry args={[0.22, 0.72, 7, 12]} /><meshStandardMaterial color={wardrobe.top} roughness={0.6} /></mesh>
        <mesh position={[0, -0.36, 0]}><capsuleGeometry args={[0.2, 0.18, 6, 10]} /><meshStandardMaterial color={wardrobe.bottom} roughness={0.62} /></mesh>
        <mesh position={[0, 0.44, 0.01]}><boxGeometry args={[0.54, 0.08, 0.18]} /><meshStandardMaterial color={wardrobe.collar} roughness={0.42} metalness={0.06} /></mesh>
        <mesh position={[0, 0.46, 0.03]}><boxGeometry args={[0.12, 0.18, 0.1]} /><meshStandardMaterial color={skinColor} roughness={0.46} /></mesh>
        {accentColor && <mesh position={[0, 0.06, 0.21]}><boxGeometry args={[0.2, 0.32, 0.05]} /><meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.24} /></mesh>}
        {backpack && <mesh position={[0, 0.02, -0.22]}><boxGeometry args={[0.24, 0.34, 0.12]} /><meshStandardMaterial color="#2b313b" roughness={0.82} /></mesh>}
      </group>
      <group ref={headRef} position={[0, 1.74, 0]} scale={[build === 'child' ? 0.9 : build === 'broad' ? 1.06 : 1, build === 'child' ? 0.9 : build === 'broad' ? 1.06 : 1, build === 'child' ? 0.9 : build === 'broad' ? 1.06 : 1]}>
        <mesh scale={[1, 1.08, 0.96]}><sphereGeometry args={[0.19, 14, 14]} /><meshStandardMaterial color={skinColor} roughness={0.34} /></mesh>
        {[-0.17, 0.17].map((x, index) => (
          <mesh key={`ped-ear-${index}`} position={[x, 0.01, -0.01]}><sphereGeometry args={[0.038, 8, 8]} /><meshStandardMaterial color={skinColor} roughness={0.38} /></mesh>
        ))}
        <mesh position={[0, -0.01, 0.16]} scale={[0.65, 0.95, 1]}><sphereGeometry args={[0.03, 8, 8]} /><meshStandardMaterial color={blendHex(skinColor, '#d19b79', 0.28)} roughness={0.38} /></mesh>
        {[-0.06, 0.06].map((x, index) => (
          <React.Fragment key={`ped-eye-${index}`}>
            <mesh position={[x, 0.03, 0.155]}><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#fbfdff" roughness={0.22} /></mesh>
            <mesh position={[x + (index === 0 ? -0.006 : 0.006), 0.026, 0.178]}><sphereGeometry args={[0.012, 8, 8]} /><meshStandardMaterial color="#171c24" roughness={0.16} /></mesh>
            <mesh position={[x, 0.085, 0.144]} rotation={[0.08, 0, index === 0 ? 0.12 : -0.12]}><boxGeometry args={[0.075, 0.012, 0.02]} /><meshStandardMaterial color={blendHex(wardrobe.hair || '#2b2b2b', '#1b1b1b', 0.22)} roughness={0.58} /></mesh>
          </React.Fragment>
        ))}
        <mesh position={[0, wardrobe.expression === 'grin' ? -0.065 : -0.055, 0.165]} rotation={[wardrobe.expression === 'smile' ? 0.18 : 0.04, 0, 0]}>
          <capsuleGeometry args={[0.014, wardrobe.expression === 'focused' ? 0.018 : 0.034, 4, 8]} />
          <meshStandardMaterial color={wardrobe.expression === 'grin' ? '#b84f5b' : '#cc6972'} roughness={0.42} />
        </mesh>
        {wardrobe.hasBeard && <mesh position={[0, -0.045, 0.11]} scale={[1, 0.74, 0.9]}><sphereGeometry args={[0.12, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color={blendHex(wardrobe.hair || '#32251d', '#111111', 0.14)} roughness={0.72} /></mesh>}
        {wardrobe.hairStyle !== 'none' && wardrobe.hair && <mesh position={[0, 0.08, -0.005]} scale={[1.02, wardrobe.hairStyle === 'fade' ? 0.58 : 0.9, wardrobe.hairStyle === 'short' ? 0.98 : 1.04]}><sphereGeometry args={[0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / (wardrobe.hairStyle === 'fade' ? 1.95 : 1.62)]} /><meshStandardMaterial color={wardrobe.hair} roughness={0.74} /></mesh>}
        {wardrobe.hairStyle === 'bob' && wardrobe.hair && [-0.12, 0.12].map((x, index) => (
          <mesh key={`ped-bob-${index}`} position={[x, 0.015, 0.03]}><sphereGeometry args={[0.062, 8, 8]} /><meshStandardMaterial color={wardrobe.hair} roughness={0.76} /></mesh>
        ))}
        {wardrobe.hairStyle === 'waves' && wardrobe.hair && [-0.1, 0, 0.1].map((x, index) => (
          <mesh key={`ped-wave-${index}`} position={[x, 0.02, -0.08 + index * 0.02]}><sphereGeometry args={[0.054, 8, 8]} /><meshStandardMaterial color={wardrobe.hair} roughness={0.78} /></mesh>
        ))}
        {wardrobe.hairStyle === 'bun' && wardrobe.hair && <mesh position={[0, 0.12, -0.12]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color={wardrobe.hair} roughness={0.76} /></mesh>}
        {headwear === 'cap' && <>
          <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.2, 10, 10, 0, Math.PI]} /><meshStandardMaterial color="#20344f" roughness={0.7} /></mesh>
          <mesh position={[0, -0.03, 0.16]}><boxGeometry args={[0.2, 0.04, 0.16]} /><meshStandardMaterial color="#20344f" roughness={0.7} /></mesh>
        </>}
        {headwear === 'hood' && <mesh position={[0, 0.02, -0.02]}><torusGeometry args={[0.18, 0.06, 8, 14]} /><meshStandardMaterial color={wardrobe.top} roughness={0.8} /></mesh>}
        {headwear === 'helmet' && <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.22, 10, 10, 0, Math.PI]} /><meshStandardMaterial color="#e8edf4" metalness={0.3} roughness={0.35} /></mesh>}
      </group>
      <group ref={leftArmRef} position={[-0.28, 1.43, 0.02]}>
        <mesh position={[0, -0.3, 0]}><capsuleGeometry args={[0.078, 0.52, 5, 10]} /><meshStandardMaterial color={wardrobe.sleeve} roughness={0.68} /></mesh>
        <mesh position={[0, -0.68, 0.02]}><sphereGeometry args={[0.058, 8, 8]} /><meshStandardMaterial color={wardrobe.hand} roughness={0.4} /></mesh>
      </group>
      <group ref={rightArmRef} position={[0.28, 1.43, 0.02]}>
        <mesh position={[0, -0.3, 0]}><capsuleGeometry args={[0.078, 0.52, 5, 10]} /><meshStandardMaterial color={wardrobe.sleeve} roughness={0.68} /></mesh>
        <mesh position={[0, -0.68, 0.02]}><sphereGeometry args={[0.058, 8, 8]} /><meshStandardMaterial color={wardrobe.hand} roughness={0.4} /></mesh>
        {phone && <mesh position={[0.03, -0.74, 0.11]}><boxGeometry args={[0.08, 0.14, 0.02]} /><meshStandardMaterial color="#0f1318" emissive="#7ce7ff" emissiveIntensity={0.4} /></mesh>}
        {carry === 'bag' && <mesh position={[0.1, -0.74, -0.12]}><boxGeometry args={[0.16, 0.18, 0.12]} /><meshStandardMaterial color="#5a3c34" roughness={0.82} /></mesh>}
      </group>
      <group ref={leftLegRef} position={[-0.12, 0.6, 0]}>
        <mesh position={[0, -0.34, 0]}><capsuleGeometry args={[0.096, 0.78, 5, 10]} /><meshStandardMaterial color={wardrobe.bottom} roughness={0.72} /></mesh>
        <mesh position={[0, -0.12, 0.06]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color={blendHex(wardrobe.bottom, '#ffffff', 0.08)} roughness={0.68} /></mesh>
        <mesh position={[0, -0.9, 0.03]}><boxGeometry args={[0.22, 0.11, 0.36]} /><meshStandardMaterial color={shoeColor} roughness={0.88} /></mesh>
      </group>
      <group ref={rightLegRef} position={[0.12, 0.6, 0]}>
        <mesh position={[0, -0.34, 0]}><capsuleGeometry args={[0.096, 0.78, 5, 10]} /><meshStandardMaterial color={wardrobe.bottom} roughness={0.72} /></mesh>
        <mesh position={[0, -0.12, 0.06]}><boxGeometry args={[0.08, 0.22, 0.08]} /><meshStandardMaterial color={blendHex(wardrobe.bottom, '#ffffff', 0.08)} roughness={0.68} /></mesh>
        <mesh position={[0, -0.9, 0.03]}><boxGeometry args={[0.22, 0.11, 0.36]} /><meshStandardMaterial color={shoeColor} roughness={0.88} /></mesh>
      </group>
      {carry === 'suitcase' && <group position={[0.34, 0.34, -0.02]}>
        <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.22, 0.38, 0.16]} /><meshStandardMaterial color="#2b313b" roughness={0.82} /></mesh>
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[0.04, 0.24, 0.04]} /><meshStandardMaterial color="#cfd7df" metalness={0.82} roughness={0.08} /></mesh>
      </group>}
      {carry === 'case' && <group position={[0.36, 0.52, -0.02]}>
        <mesh><boxGeometry args={[0.28, 0.16, 0.2]} /><meshStandardMaterial color="#1a1d24" roughness={0.82} /></mesh>
      </group>}
    </group>
  );
}

function PerimeterLoopTraffic({ night, centerZ, halfW, halfH }) {
  const vehicleRefs = useRef([]);
  const vehicleProgressRef = useRef([]);
  const signalRedRefs = useRef([]);
  const signalGreenRefs = useRef([]);
  const laneOffset = 2.4;
  const vehicles = useMemo(() => {
    const profiles = [
      { kind: '4x4', width: 2.9, height: 0.98, depth: 1.12, cabinWidth: 1.55, wheelRadius: 0.18, track: 0.4, colors: ['#20252b', '#dadfe5', '#37526f', '#6e3c22'] },
      { kind: 'limousine', width: 3.9, height: 0.64, depth: 0.94, cabinWidth: 2.45, wheelRadius: 0.16, track: 0.34, colors: ['#0d0f12', '#f2f0e6', '#6f1224'] },
      { kind: 'tuning', width: 2.35, height: 0.56, depth: 0.9, cabinWidth: 1.2, wheelRadius: 0.16, track: 0.34, spoiler: true, colors: ['#00a8ff', '#ff4d4d', '#f5f5f5', '#121212'] },
      { kind: 'truck', width: 3.6, height: 1.2, depth: 1.05, cabinWidth: 1.1, wheelRadius: 0.22, track: 0.42, cargoLength: 1.9, colors: ['#ffffff', '#1e5aa8', '#d16b2f'] },
      { kind: 'heavy', width: 3.4, height: 1.38, depth: 1.18, cabinWidth: 1.2, wheelRadius: 0.24, track: 0.46, beacon: true, colors: ['#f0b400', '#e36f10', '#5a5f68'] },
      { kind: 'service', width: 2.8, height: 1.0, depth: 0.98, cabinWidth: 1.46, wheelRadius: 0.18, track: 0.38, cargoLength: 1.3, beacon: true, colors: ['#ffdd33', '#f47c20', '#d9dee4'] },
      { kind: 'vip-van', width: 3.05, height: 1.02, depth: 0.98, cabinWidth: 1.74, wheelRadius: 0.19, track: 0.38, vip: true, colors: ['#0f1216', '#f0ebe1', '#4d0f21'] },
      { kind: 'tow', width: 3.25, height: 1.18, depth: 1.04, cabinWidth: 1.18, wheelRadius: 0.22, track: 0.42, beacon: true, tow: true, colors: ['#ffb400', '#f47c20', '#d9dee4'] },
      { kind: 'van', width: 2.7, height: 1.02, depth: 0.96, cabinWidth: 1.48, wheelRadius: 0.18, track: 0.36, colors: ['#f7f7f7', '#c83a2d', '#4c7296'] },
      { kind: 'sedan', width: 2.15, height: 0.62, depth: 0.86, cabinWidth: 1.16, wheelRadius: 0.15, track: 0.33, colors: ['#b01616', '#1c3f87', '#ececec', '#2f343b'] },
      { kind: 'motorbike', width: 1.4, height: 0.7, depth: 0.34, cabinWidth: 0, wheelRadius: 0.21, track: 0.0, colors: ['#111111', '#b41717', '#e4a500', '#2b6ba3'] },
    ];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      direction: i < 14 ? 1 : -1,
      offset: i * 18,
      speed: 6.4 + (i % 5) * 0.75,
      ...profiles[i % profiles.length],
      color: profiles[i % profiles.length].colors[i % profiles[i % profiles.length].colors.length],
    }));
  }, []);

  if (vehicleProgressRef.current.length === 0) {
    vehicleProgressRef.current = vehicles.map((vehicle) => vehicle.offset);
  }

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const horizontalGreen = (t % 24) < 12;

    signalRedRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const controlledByHorizontal = index < 2;
      const redOn = controlledByHorizontal ? !horizontalGreen : horizontalGreen;
      ref.material.emissiveIntensity = redOn ? (night ? 2.8 : 0.35) : 0.08;
    });
    signalGreenRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const controlledByHorizontal = index < 2;
      const greenOn = controlledByHorizontal ? horizontalGreen : !horizontalGreen;
      ref.material.emissiveIntensity = greenOn ? (night ? 2.2 : 0.24) : 0.06;
    });

    vehicles.forEach((vehicle, index) => {
      const ref = vehicleRefs.current[index];
      if (!ref) return;

      const currentDist = vehicleProgressRef.current[index] ?? vehicle.offset;
      const laneInset = vehicle.direction === 1 ? laneOffset : -laneOffset;
      const previewPose = getRectLoopPose(currentDist, halfW, halfH, laneInset);
      const laneHalfW = halfW - laneInset;
      const laneHalfH = halfH - laneInset;
      const isHorizontalSegment = Math.abs(Math.cos(previewPose.rot)) > 0.5;
      const nearCrossing = isHorizontalSegment
        ? Math.abs(previewPose.x) < 9 && Math.abs(Math.abs(previewPose.z) - laneHalfH) < 1.6
        : Math.abs(previewPose.z) < 9 && Math.abs(Math.abs(previewPose.x) - laneHalfW) < 1.6;
      const hasGreen = isHorizontalSegment ? horizontalGreen : !horizontalGreen;
      const speedFactor = nearCrossing && !hasGreen ? 0.04 : nearCrossing ? 0.32 : 1;
      vehicleProgressRef.current[index] = currentDist + vehicle.direction * vehicle.speed * speedFactor * delta * 10;

      const pose = getRectLoopPose(vehicleProgressRef.current[index], halfW, halfH, laneInset);

      ref.position.x = pose.x;
      ref.position.z = pose.z + centerZ;
      ref.position.y = 0.42;
      ref.rotation.y = vehicle.direction === 1 ? pose.rot : pose.rot + Math.PI;
    });
  });

  return (
    <group>
      {[
        { x: 0, z: -halfH + centerZ, rot: 0 },
        { x: 0, z: halfH + centerZ, rot: Math.PI },
        { x: halfW, z: centerZ, rot: Math.PI / 2 },
        { x: -halfW, z: centerZ, rot: -Math.PI / 2 },
      ].map((signal, index) => (
        <group key={`perimeter-signal-${index}`} position={[signal.x, 0, signal.z]} rotation={[0, signal.rot, 0]}>
          <mesh position={[0, 2.8, 0]}><boxGeometry args={[0.24, 5.6, 0.24]} /><meshStandardMaterial color="#bac4ce" metalness={0.9} roughness={0.08} /></mesh>
          <mesh position={[0, 5.1, 0.5]}><boxGeometry args={[0.9, 1.8, 0.32]} /><meshStandardMaterial color="#141b23" roughness={0.5} /></mesh>
          <mesh ref={(el) => { signalRedRefs.current[index] = el; }} position={[0, 5.55, 0.68]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#ff4040" emissive="#ff4040" emissiveIntensity={night ? 2.2 : 0.22} /></mesh>
          <mesh position={[0, 5.1, 0.68]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#ffd86b" emissive="#ffd86b" emissiveIntensity={night ? 0.5 : 0.05} /></mesh>
          <mesh ref={(el) => { signalGreenRefs.current[index] = el; }} position={[0, 4.65, 0.68]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#52ff8d" emissive="#52ff8d" emissiveIntensity={night ? 1.8 : 0.16} /></mesh>
          <mesh position={[0, 0.31, -2.1]}><boxGeometry args={[6.8, 0.04, 0.24]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}

      {vehicles.map((vehicle, index) => (
        <group
          key={`perimeter-car-${vehicle.id}`}
          ref={(el) => { vehicleRefs.current[index] = el; }}

        >
          {vehicle.kind === 'motorbike' ? (
            <>
              {[ -0.38, 0.38 ].map((wheelX, wi) => (
                <mesh key={`bike-wheel-${wi}`} position={[wheelX, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[vehicle.wheelRadius, vehicle.wheelRadius, 0.08, 12]} />
                  <meshStandardMaterial color="#111111" roughness={0.95} />
                </mesh>
              ))}
              <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 14]}><boxGeometry args={[1.02, 0.08, 0.08]} /><meshPhysicalMaterial color={vehicle.color} metalness={0.74} roughness={0.12} clearcoat={0.54} clearcoatRoughness={0.16} /></mesh>
              <mesh position={[0.08, 0.52, 0]}><boxGeometry args={[0.42, 0.14, 0.22]} /><meshPhysicalMaterial color={vehicle.color} metalness={0.74} roughness={0.12} clearcoat={0.54} clearcoatRoughness={0.16} /></mesh>
              <mesh position={[-0.05, 0.78, 0]}><boxGeometry args={[0.12, 0.36, 0.12]} /><meshStandardMaterial color="#1d2330" roughness={0.75} /></mesh>
              <mesh position={[0.42, 0.7, 0]} rotation={[0, 0, Math.PI / 6]}><boxGeometry args={[0.34, 0.05, 0.05]} /><meshStandardMaterial color="#cfd8df" metalness={0.86} roughness={0.12} /></mesh>
              <mesh position={[0.58, 0.46, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.4 : 0.22} /></mesh>
            </>
          ) : (
            <>
              <mesh position={[0, vehicle.height * 0.42, 0]}>
                <boxGeometry args={[vehicle.width, vehicle.height * 0.74, vehicle.depth]} />
                <meshPhysicalMaterial color={vehicle.color} metalness={0.68} roughness={0.14} clearcoat={0.62} clearcoatRoughness={0.16} />
              </mesh>
              <mesh position={[-vehicle.width * 0.12, vehicle.height * 0.8, 0]}>
                <boxGeometry args={[vehicle.width * (vehicle.kind === 'truck' || vehicle.kind === 'heavy' ? 0.48 : 0.58), vehicle.height * 0.5, vehicle.depth * 0.88]} />
                <meshPhysicalMaterial color={vehicle.color} metalness={0.64} roughness={0.16} clearcoat={0.54} clearcoatRoughness={0.18} />
              </mesh>
              <mesh position={[vehicle.width * 0.08, vehicle.height * 0.86, 0]}>
                <boxGeometry args={[Math.max(vehicle.cabinWidth, vehicle.width * 0.38), vehicle.height * 0.54, vehicle.depth * 0.84]} />
                <meshPhysicalMaterial color={night ? '#8ec5ff' : '#cae5f4'} transparent opacity={0.62} roughness={0.02} metalness={0.26} transmission={0.24} clearcoat={1} clearcoatRoughness={0.04} />
              </mesh>
              {(vehicle.kind === 'truck' || vehicle.kind === 'heavy' || vehicle.kind === 'service') && (
                <mesh position={[-vehicle.width * 0.2, vehicle.height * 0.92, 0]}>
                  <boxGeometry args={[vehicle.cargoLength, vehicle.height * 0.68, vehicle.depth * 0.96]} />
                  <meshStandardMaterial color={vehicle.kind === 'heavy' ? '#4e545d' : vehicle.kind === 'service' ? '#eef3f6' : '#dfe6eb'} metalness={0.36} roughness={0.32} />
                </mesh>
              )}
              {(vehicle.kind === 'truck' || vehicle.kind === 'heavy') && (
                <group position={[-vehicle.width * 0.96, vehicle.height * 0.36, 0]}>
                  <mesh><boxGeometry args={[vehicle.width * 0.72, vehicle.height * 0.26, vehicle.depth * 0.92]} /><meshPhysicalMaterial color="#4a5058" metalness={0.48} roughness={0.28} clearcoat={0.18} clearcoatRoughness={0.34} /></mesh>
                  <mesh position={[0, 0.32, 0]}><boxGeometry args={[vehicle.width * 0.64, vehicle.height * 0.34, vehicle.depth * 0.9]} /><meshPhysicalMaterial color={vehicle.kind === 'heavy' ? '#646b73' : '#dfe6eb'} metalness={0.4} roughness={0.24} clearcoat={0.18} clearcoatRoughness={0.3} /></mesh>
                </group>
              )}
              <mesh position={[vehicle.width / 2 - 0.08, vehicle.height * 0.3, 0]}><boxGeometry args={[0.14, 0.18, vehicle.depth * 0.68]} /><meshStandardMaterial color="#1f2428" metalness={0.62} roughness={0.24} /></mesh>
              <mesh position={[vehicle.width / 2 - 0.03, vehicle.height * 0.18, 0]}><boxGeometry args={[0.06, 0.14, vehicle.depth * 0.62]} /><meshStandardMaterial color="#b8c3cc" metalness={0.9} roughness={0.1} /></mesh>
              {[-1, 1].map((side, mirrorIndex) => (
                <mesh key={`mirror-${mirrorIndex}`} position={[vehicle.width * 0.22, vehicle.height * 0.86, side * (vehicle.depth * 0.54)]}><boxGeometry args={[0.08, 0.05, 0.12]} /><meshStandardMaterial color="#101317" metalness={0.82} roughness={0.12} /></mesh>
              ))}
              {[-0.18, 0.18].map((doorOffset, doorIndex) => (
                <mesh key={`door-line-${doorIndex}`} position={[vehicle.width * doorOffset, vehicle.height * 0.46, vehicle.depth / 2 + 0.01]}><boxGeometry args={[0.04, vehicle.height * 0.48, 0.02]} /><meshStandardMaterial color="#dfe5eb" metalness={0.88} roughness={0.08} /></mesh>
              ))}
              <mesh position={[-vehicle.width / 2 + 0.12, vehicle.wheelRadius * 0.9, -vehicle.depth * 0.22]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 0.26, 8]} /><meshStandardMaterial color="#8c949c" metalness={0.9} roughness={0.1} /></mesh>
              {[-1, 1].map((side, lightIndex) => (
                <React.Fragment key={`vehicle-lights-${lightIndex}`}>
                  <mesh position={[vehicle.width / 2 - 0.02, vehicle.height * 0.3, side * vehicle.track]}><boxGeometry args={[0.08, 0.1, 0.08]} /><meshStandardMaterial color="#ffe9a6" emissive="#ffe9a6" emissiveIntensity={night ? 3.2 : 0.22} /></mesh>
                  <mesh position={[-vehicle.width / 2 + 0.02, vehicle.height * 0.26, side * vehicle.track * 0.92]}><boxGeometry args={[0.08, 0.08, 0.08]} /><meshStandardMaterial color="#ff3a28" emissive="#ff3a28" emissiveIntensity={night ? 2.4 : 0.24} /></mesh>
                </React.Fragment>
              ))}
              {(vehicle.kind === 'service' || vehicle.kind === 'tow') && (
                <group position={[-vehicle.width / 2 + 0.12, vehicle.height * 0.42, 0]}>
                  {[-0.18, 0, 0.18].map((stripe, stripeIndex) => (
                    <mesh key={`chevron-${stripeIndex}`} position={[0, stripe, 0]} rotation={[0, 0, Math.PI / 4]}>
                      <boxGeometry args={[0.28, 0.05, vehicle.depth * 0.72]} />
                      <meshStandardMaterial color={stripeIndex % 2 === 0 ? '#101317' : '#ffb400'} metalness={0.82} roughness={0.12} />
                    </mesh>
                  ))}
                </group>
              )}
              {vehicle.spoiler && <mesh position={[-vehicle.width * 0.36, vehicle.height * 1.02, 0]}><boxGeometry args={[0.18, 0.16, vehicle.depth * 0.78]} /><meshStandardMaterial color="#101317" metalness={0.8} roughness={0.12} /></mesh>}
              {vehicle.kind === '4x4' && <mesh position={[-0.1, vehicle.height * 1.18, 0]}><boxGeometry args={[vehicle.width * 0.42, 0.08, vehicle.depth * 0.86]} /><meshStandardMaterial color="#1a1a1a" metalness={0.74} roughness={0.12} /></mesh>}
              {vehicle.kind === 'limousine' && <mesh position={[0, vehicle.height * 0.66, -vehicle.depth / 2 - 0.02]}><boxGeometry args={[vehicle.width * 0.82, 0.04, 0.02]} /><meshStandardMaterial color="#d7dee6" metalness={0.95} roughness={0.08} /></mesh>}
              {vehicle.vip && <mesh position={[0, vehicle.height * 1.08, vehicle.depth / 2 + 0.02]}><boxGeometry args={[vehicle.width * 0.76, 0.04, 0.02]} /><meshStandardMaterial color="#f2f4f7" metalness={0.96} roughness={0.08} /></mesh>}
              {vehicle.tow && (
                <group position={[-vehicle.width * 0.68, vehicle.height * 0.88, 0]}>
                  <mesh rotation={[0, 0, -0.4]}><boxGeometry args={[1.18, 0.1, 0.14]} /><meshStandardMaterial color="#cfd6dd" metalness={0.9} roughness={0.08} /></mesh>
                  <mesh position={[-0.48, -0.4, 0]}><boxGeometry args={[0.12, 0.62, 0.12]} /><meshStandardMaterial color="#cfd6dd" metalness={0.9} roughness={0.08} /></mesh>
                </group>
              )}
              {vehicle.beacon && <mesh position={[0.1, vehicle.height * 1.38, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffb400" emissive="#ffb400" emissiveIntensity={night ? 2.4 : 0.3} /></mesh>}
              {[[-vehicle.width * 0.3, -vehicle.track], [-vehicle.width * 0.3, vehicle.track], [vehicle.width * 0.3, -vehicle.track], [vehicle.width * 0.3, vehicle.track]].map(([wx, wz], wi) => (
                <group key={`wheel-${wi}`} position={[wx, vehicle.wheelRadius * 0.82, wz]} rotation={[Math.PI / 2, 0, 0]}>
                  <mesh><cylinderGeometry args={[vehicle.wheelRadius, vehicle.wheelRadius, 0.14, 14]} /><meshStandardMaterial color="#111111" roughness={0.95} /></mesh>
                  <mesh position={[0, 0, 0.01]}><cylinderGeometry args={[vehicle.wheelRadius * 0.48, vehicle.wheelRadius * 0.48, 0.16, 10]} /><meshStandardMaterial color="#bac4ce" metalness={0.88} roughness={0.12} /></mesh>
                </group>
              ))}
            </>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Grand circuit ferroviaire et routier autour de toute la ville ───
function CityCircuitRailway({ night, centerZ }) {
  const trainRef1 = useRef();
  const trainRef2 = useRef();
  const trainRef3 = useRef();
  const trainRef4 = useRef();
  const outerTrainProgressRef = useRef([]);
  const hubTrainWestRef = useRef();
  const hubTrainEastRef = useRef();
  const signGlowRefs = useRef([]);
  const basinReflectionRefs = useRef([]);
  const steamRefs = useRef([]);

  const railHalfW = 136;
  const railHalfH = 102;
  const roadHalfW = 148;
  const roadHalfH = 110;
  const railY = 0.34;
  const railColor = '#a8aeb8';
  const ballastColor = '#70767e';
  const roadColor = night ? '#1a1e24' : '#505458';
  const shoulderColor = night ? '#262b32' : '#f4f7fb';
  const medianColor = '#d4a020';
  const stationColor = night ? '#0d1a30' : '#d6e2ee';
  const platformColor = night ? '#2a3040' : '#eef2f6';
  const glassColor = night ? '#0d3156' : '#b9ddf4';
  const bridgeGlow = night ? '#7fe4ff' : '#bfefff';
  const neonRoadColor = night ? '#34d8ff' : '#92def2';
  const neonRailColor = night ? '#4ef7ff' : '#b8f6ff';
  const bermGreen = night ? '#244128' : '#7ba86b';
  const bermEarth = night ? '#433a31' : '#9b8766';
  const basinWater = night ? '#0f4360' : '#5dbddd';
  const signFrame = night ? '#1d2938' : '#eff4f8';
  const perimeter = getRectLoopPose(0, railHalfW, railHalfH, 1.4).perimeter;
  if (outerTrainProgressRef.current.length === 0) outerTrainProgressRef.current = [0, perimeter * 0.25, perimeter * 0.5, perimeter * 0.75];
  const rapidCycle = 32;
  const smooth = (value) => value * value * (3 - 2 * value);
  const pseudoRandom = (seed) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const outerStations = useMemo(() => ([
    { key: 'north', name: 'GARE NORD', x: 0, z: -railHalfH, rot: 0, platformDepth: 6.5 },
    { key: 'east', name: 'GARE EST', x: railHalfW, z: 0, rot: Math.PI / 2, platformDepth: 6.5 },
    { key: 'south', name: 'GARE SUD', x: 0, z: railHalfH, rot: Math.PI, platformDepth: 6.5 },
    { key: 'west', name: 'GARE OUEST', x: -railHalfW, z: 0, rot: -Math.PI / 2, platformDepth: 6.5 },
  ]), [railHalfH, railHalfW]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    [trainRef1, trainRef2, trainRef3, trainRef4].forEach((ref, index) => {
      if (!ref.current) return;
      const speed = 12.2 + (index % 2) * 1.4;
      const direction = index % 2 === 0 ? 1 : -1;
      const laneInset = direction === 1 ? 1.4 : -1.4;
      const currentDist = outerTrainProgressRef.current[index];
      const previewPose = getRectLoopPose(currentDist, railHalfW, railHalfH, laneInset);
      const nearestStation = outerStations.reduce((best, station) => {
        const dist = Math.hypot(previewPose.x - station.x, previewPose.z - station.z);
        return Math.min(best, dist);
      }, Infinity);
      const stationFactor = nearestStation < 10 ? 0.24 + (nearestStation / 10) * 0.56 : 1;
      outerTrainProgressRef.current[index] = currentDist + direction * speed * stationFactor * delta * 10;
      const pose = getRectLoopPose(outerTrainProgressRef.current[index], railHalfW, railHalfH, laneInset);

      ref.current.position.x = pose.x;
      ref.current.position.z = pose.z + centerZ;
      ref.current.position.y = railY + 0.42;
      ref.current.rotation.y = direction === 1 ? pose.rot : pose.rot + Math.PI;
    });

    const rapidTrackA = pseudoRandom(Math.floor(t / rapidCycle) + 3) > 0.5 ? -6.4 : -3.2;
    const rapidTrackB = pseudoRandom(Math.floor((t + rapidCycle * 0.5) / rapidCycle) + 11) > 0.5 ? 3.2 : 6.4;

    const placeRapidTrain = (ref, phaseOffset, outboundTrack, inboundTrack, reverse = false) => {
      if (!ref.current) return;
      const localTime = t + phaseOffset;
      const cyclePhase = localTime % rapidCycle;
      let x = reverse ? 82 : -82;
      let z = outboundTrack;
      let rot = reverse ? Math.PI : 0;

      if (cyclePhase < 4) {
        x = reverse ? 82 : -82;
        z = outboundTrack;
        rot = reverse ? Math.PI : 0;
      } else if (cyclePhase < 16) {
        const p = smooth((cyclePhase - 4) / 12);
        x = reverse ? 82 - 164 * p : -82 + 164 * p;
        z = outboundTrack;
        rot = reverse ? Math.PI : 0;
      } else if (cyclePhase < 20) {
        x = reverse ? -82 : 82;
        z = inboundTrack;
        rot = reverse ? 0 : Math.PI;
      } else {
        const p = smooth((cyclePhase - 20) / 12);
        x = reverse ? -82 + 164 * p : 82 - 164 * p;
        z = inboundTrack;
        rot = reverse ? 0 : Math.PI;
      }

      ref.current.position.x = x;
      ref.current.position.z = centerZ + z;
      ref.current.position.y = railY + 0.4;
      ref.current.rotation.y = rot;
    };

    placeRapidTrain(hubTrainWestRef, 0, rapidTrackA, rapidTrackB, false);
    placeRapidTrain(hubTrainEastRef, rapidCycle * 0.5, rapidTrackB, rapidTrackA, true);

    signGlowRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 2.2 : 0.24) + Math.sin(t * 2.1 + index * 0.7) * (night ? 0.75 : 0.04);
    });

    basinReflectionRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.opacity = (night ? 0.28 : 0.2) + Math.sin(t * 1.7 + index * 0.9) * 0.05;
      ref.position.y = 0.24 + Math.sin(t * 1.3 + index * 0.8) * 0.015;
    });

    steamRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const phase = (t * 0.22 + index * 0.18) % 1;
      const scale = 0.8 + phase * 1.6;
      ref.position.y = 0.6 + phase * 5.6;
      ref.scale.set(scale, scale * 0.82, scale);
      ref.material.opacity = (night ? 0.2 : 0.12) * (1 - phase);
    });
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ═══ AUTOROUTE URBAINE — grand tour complet du Nouveau Monde ═══ */}
      <mesh position={[0, 0.18, -roadHalfH + centerZ]}><boxGeometry args={[roadHalfW * 2 + 20, 0.24, 12]} /><meshPhysicalMaterial color={roadColor} roughness={0.76} metalness={0.04} clearcoat={0.08} clearcoatRoughness={0.9} /></mesh>
      <mesh position={[0, 0.18, roadHalfH + centerZ]}><boxGeometry args={[roadHalfW * 2 + 20, 0.24, 12]} /><meshPhysicalMaterial color={roadColor} roughness={0.76} metalness={0.04} clearcoat={0.08} clearcoatRoughness={0.9} /></mesh>
      <mesh position={[roadHalfW, 0.18, centerZ]}><boxGeometry args={[12, 0.24, roadHalfH * 2 + 20]} /><meshPhysicalMaterial color={roadColor} roughness={0.76} metalness={0.04} clearcoat={0.08} clearcoatRoughness={0.9} /></mesh>
      <mesh position={[-roadHalfW, 0.18, centerZ]}><boxGeometry args={[12, 0.24, roadHalfH * 2 + 20]} /><meshPhysicalMaterial color={roadColor} roughness={0.76} metalness={0.04} clearcoat={0.08} clearcoatRoughness={0.9} /></mesh>

      {[
        [0, -roadHalfH + 5 + centerZ, roadHalfW * 2 + 14, 2.2],
        [0, roadHalfH - 5 + centerZ, roadHalfW * 2 + 14, 2.2],
      ].map(([x, z, len, width], i) => (
        <mesh key={`median-horizontal-${i}`} position={[x, 0.3, z]}>
          <boxGeometry args={[len, 0.05, width]} />
          <meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.5 : 0} />
        </mesh>
      ))}
      {[
        [roadHalfW - 5, centerZ, 2.2, roadHalfH * 2 + 14],
        [-roadHalfW + 5, centerZ, 2.2, roadHalfH * 2 + 14],
      ].map(([x, z, width, len], i) => (
        <mesh key={`median-vertical-${i}`} position={[x, 0.3, z]}>
          <boxGeometry args={[width, 0.05, len]} />
          <meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.5 : 0} />
        </mesh>
      ))}

      {[[-roadHalfW - 7, 0, roadHalfH * 2 + 20], [roadHalfW + 7, 0, roadHalfH * 2 + 20]].map(([x, z, len], i) => (
        <mesh key={`shoulder-v-${i}`} position={[x, 0.26, z + centerZ]}><boxGeometry args={[2.5, 0.2, len]} /><meshPhysicalMaterial color={shoulderColor} roughness={0.38} metalness={0.06} clearcoat={0.18} clearcoatRoughness={0.58} /></mesh>
      ))}
      {[[0, -roadHalfH - 7, roadHalfW * 2 + 20], [0, roadHalfH + 7, roadHalfW * 2 + 20]].map(([x, z, len], i) => (
        <mesh key={`shoulder-h-${i}`} position={[x, 0.26, z + centerZ]}><boxGeometry args={[len, 0.2, 2.5]} /><meshPhysicalMaterial color={shoulderColor} roughness={0.38} metalness={0.06} clearcoat={0.18} clearcoatRoughness={0.58} /></mesh>
      ))}

      {/* Micro-détails routiers : grilles, plots et marquages au sol */}
      {[
        [-roadHalfW - 6.2, centerZ - 74, Math.PI / 2],
        [-roadHalfW - 6.2, centerZ + 74, Math.PI / 2],
        [roadHalfW + 6.2, centerZ - 74, Math.PI / 2],
        [roadHalfW + 6.2, centerZ + 74, Math.PI / 2],
        [-84, centerZ - roadHalfH - 6.2, 0],
        [84, centerZ - roadHalfH - 6.2, 0],
        [-84, centerZ + roadHalfH + 6.2, 0],
        [84, centerZ + roadHalfH + 6.2, 0],
      ].map(([x, z, rot], index) => (
        <group key={`service-grate-${index}`} position={[x, 0.29, z]} rotation={[0, rot, 0]}>
          <mesh><boxGeometry args={[1.8, 0.04, 0.58]} /><meshStandardMaterial color={night ? '#5b6671' : '#808890'} metalness={0.72} roughness={0.2} /></mesh>
          {[-0.48, -0.16, 0.16, 0.48].map((bar, barIndex) => (
            <mesh key={`service-grate-bar-${barIndex}`} position={[bar, 0.03, 0]}>
              <boxGeometry args={[0.06, 0.02, 0.5]} />
              <meshStandardMaterial color="#1c2228" metalness={0.82} roughness={0.18} />
            </mesh>
          ))}
        </group>
      ))}
      {[
        [-14, centerZ - 24], [14, centerZ - 24], [-14, centerZ + 24], [14, centerZ + 24],
        [-24, centerZ - 14], [-24, centerZ + 14], [24, centerZ - 14], [24, centerZ + 14],
      ].map(([x, z], index) => (
        <group key={`connector-bollard-${index}`} position={[x, 0.22, z]}>
          <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.05, 0.06, 0.68, 8]} /><meshStandardMaterial color="#d7dfe7" metalness={0.9} roughness={0.08} /></mesh>
          <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color={index % 2 === 0 ? '#7ce7ff' : '#ffd870'} emissive={index % 2 === 0 ? '#7ce7ff' : '#ffd870'} emissiveIntensity={night ? 1.4 : 0.14} /></mesh>
        </group>
      ))}
      {[
        { x: 0, z: centerZ - roadHalfH + 1.5, rot: 0, text: 'LOOP' },
        { x: 0, z: centerZ + roadHalfH - 1.5, rot: Math.PI, text: 'CAPTURE' },
        { x: roadHalfW - 1.5, z: centerZ, rot: -Math.PI / 2, text: 'EXIT' },
        { x: -roadHalfW + 1.5, z: centerZ, rot: Math.PI / 2, text: 'CITY' },
      ].map((marking, index) => (
        <Text
          key={`road-text-${index}`}
          position={[marking.x, 0.34, marking.z]}
          rotation={[-Math.PI / 2, 0, marking.rot]}
          fontSize={2.1}
          color="#f5f7fb"
          anchorX="center"
          anchorY="middle"
        >
          {marking.text}
        </Text>
      ))}
      {[
        { x: 0, z: centerZ - 28, rot: 0, label: 'LOOP CENTRAL', accent: '#7ce7ff' },
        { x: 0, z: centerZ + 28, rot: Math.PI, label: 'CAPTURE SOUTH', accent: '#ffd870' },
        { x: 92, z: centerZ + 18, rot: -Math.PI / 2, label: 'EAST HUB', accent: '#9df07c' },
        { x: -92, z: centerZ - 18, rot: Math.PI / 2, label: 'WEST HUB', accent: '#ff9f7c' },
      ].map((hubStop, stopIndex) => (
        <group key={`loop-shelter-${stopIndex}`} position={[hubStop.x, 0, hubStop.z]} rotation={[0, hubStop.rot, 0]}>
          <mesh position={[0, 0.08, 0]}><boxGeometry args={[5.6, 0.16, 2.4]} /><meshStandardMaterial color={night ? '#2a3038' : '#dfe6ec'} roughness={0.28} metalness={0.12} /></mesh>
          {[-2.2, 2.2].map((px, pi) => (
            <mesh key={`loop-shelter-pillar-${pi}`} position={[px, 1.9, 0.92]}><boxGeometry args={[0.14, 3.8, 0.14]} /><meshStandardMaterial color="#cbd4dd" metalness={0.82} roughness={0.1} /></mesh>
          ))}
          <mesh position={[0, 3.78, 0.58]}><boxGeometry args={[5.8, 0.12, 2.6]} /><meshStandardMaterial color={night ? '#1b2430' : '#f8fbfd'} roughness={0.12} metalness={0.34} /></mesh>
          <mesh position={[0, 2.15, 1.06]}><boxGeometry args={[5.2, 2.9, 0.08]} /><meshPhysicalMaterial color="#c8e6f8" transmission={0.62} roughness={0.03} thickness={0.08} transparent opacity={0.55} /></mesh>
          {[-1.8, 1.8].map((px, pi) => (
            <mesh key={`loop-shelter-side-${pi}`} position={[px, 1.9, 0.15]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[1.9, 2.6, 0.06]} /><meshPhysicalMaterial color="#c8e6f8" transmission={0.55} roughness={0.03} thickness={0.08} transparent opacity={0.46} /></mesh>
          ))}
          <mesh position={[0, 0.76, -0.2]}><boxGeometry args={[2.6, 0.16, 0.6]} /><meshStandardMaterial color="#d8e0e8" metalness={0.42} roughness={0.18} /></mesh>
          <mesh position={[0, 1.12, -0.45]}><boxGeometry args={[2.6, 0.72, 0.12]} /><meshStandardMaterial color="#d8e0e8" metalness={0.42} roughness={0.18} /></mesh>
          <mesh position={[2.45, 1.9, 0.72]}><boxGeometry args={[0.24, 3.5, 0.24]} /><meshStandardMaterial color="#cbd4dd" metalness={0.82} roughness={0.1} /></mesh>
          <mesh position={[2.45, 2.95, 0.88]}><boxGeometry args={[1.4, 1.35, 0.12]} /><meshStandardMaterial color="#17324f" emissive={hubStop.accent} emissiveIntensity={night ? 1.7 : 0.16} /></mesh>
          <Text position={[2.45, 2.98, 1.02]} fontSize={0.2} color="#ffffff" anchorX="center">{hubStop.label}</Text>
        </group>
      ))}
      <group position={[8, 0, centerZ - 30]}>
        {[-0.9, 0.9].map((x, i) => (
          <group key={`vip-loop-post-${i}`} position={[x, 0, -0.9]}>
            <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.05, 0.06, 0.9, 8]} /><meshStandardMaterial color="#d7dee6" metalness={0.88} roughness={0.08} /></mesh>
            <mesh position={[0, 0.88, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={night ? 1.4 : 0.14} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[2.2, 0.08, 1.2]} /><meshStandardMaterial color="#1a1f26" roughness={0.82} /></mesh>
        <mesh position={[-0.3, 0.46, 0.15]}><boxGeometry args={[0.3, 0.46, 0.22]} /><meshStandardMaterial color="#0f1216" roughness={0.42} /></mesh>
        <mesh position={[0.25, 0.56, 0.18]}><boxGeometry args={[0.24, 0.6, 0.18]} /><meshStandardMaterial color="#7a1426" roughness={0.42} /></mesh>
        <Text position={[0, 1.22, 0.92]} fontSize={0.18} color="#ffe08a" anchorX="center">VIP PICKUP</Text>
      </group>
      <group position={[98, 0, centerZ + 24]}>
        {[[-0.8, -0.55], [0, -0.55], [0.8, -0.55]].map(([x, z], i) => (
          <group key={`tech-cone-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 0.18, 0]}><coneGeometry args={[0.12, 0.36, 8]} /><meshStandardMaterial color="#ff7f1f" roughness={0.4} /></mesh>
            <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.15, 0.15, 0.04, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.24} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.14, 0.1]}><boxGeometry args={[1.6, 0.1, 1]} /><meshStandardMaterial color="#3f4752" roughness={0.6} /></mesh>
        <mesh position={[0.3, 0.28, 0.06]}><boxGeometry args={[0.4, 0.18, 0.24]} /><meshStandardMaterial color="#ffb400" metalness={0.24} roughness={0.32} /></mesh>
        <Text position={[0, 1.18, 0.92]} fontSize={0.17} color="#7ce7ff" anchorX="center">TECH BAY</Text>
      </group>
      {[[-roadHalfW, -roadHalfH], [roadHalfW, -roadHalfH], [roadHalfW, roadHalfH], [-roadHalfW, roadHalfH]].map(([x, z], index) => (
        <group key={`road-corner-${index}`} position={[x, 0.18, z + centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[6.1, 24]} /><meshStandardMaterial color={roadColor} roughness={0.92} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}><ringGeometry args={[4.6, 4.78, 24]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}

      {/* Rubans néon route — lisibles surtout la nuit sur tout le tour */}
      {[
        [0, 0.27, -roadHalfH + centerZ - 5.8, roadHalfW * 2 + 22, 0.12],
        [0, 0.27, -roadHalfH + centerZ + 5.8, roadHalfW * 2 + 22, 0.12],
        [0, 0.27, roadHalfH + centerZ - 5.8, roadHalfW * 2 + 22, 0.12],
        [0, 0.27, roadHalfH + centerZ + 5.8, roadHalfW * 2 + 22, 0.12],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`road-neon-h-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.04, d]} />
          <meshStandardMaterial color={neonRoadColor} emissive={neonRoadColor} emissiveIntensity={night ? 1.9 : 0.08} transparent opacity={night ? 0.9 : 0.45} />
        </mesh>
      ))}
      {[
        [roadHalfW + 5.8, 0.27, centerZ, 0.12, roadHalfH * 2 + 22],
        [roadHalfW - 5.8, 0.27, centerZ, 0.12, roadHalfH * 2 + 22],
        [-roadHalfW + 5.8, 0.27, centerZ, 0.12, roadHalfH * 2 + 22],
        [-roadHalfW - 5.8, 0.27, centerZ, 0.12, roadHalfH * 2 + 22],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`road-neon-v-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.04, d]} />
          <meshStandardMaterial color={neonRoadColor} emissive={neonRoadColor} emissiveIntensity={night ? 1.9 : 0.08} transparent opacity={night ? 0.9 : 0.45} />
        </mesh>
      ))}

      {Array.from({ length: 18 }).map((_, i) => {
        const x = -roadHalfW + 10 + i * 17;
        return (
          <React.Fragment key={`road-marks-top-${i}`}>
            <mesh position={[x, 0.34, -roadHalfH + centerZ - 2.4]}><boxGeometry args={[7, 0.05, 0.32]} /><meshStandardMaterial color="#ffffff" /></mesh>
            <mesh position={[x, 0.34, roadHalfH + centerZ + 2.4]}><boxGeometry args={[7, 0.05, 0.32]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </React.Fragment>
        );
      })}
      {Array.from({ length: 12 }).map((_, i) => {
        const z = -roadHalfH + 10 + i * 18;
        return (
          <React.Fragment key={`road-marks-side-${i}`}>
            <mesh position={[roadHalfW - 2.4, 0.34, z + centerZ]}><boxGeometry args={[0.32, 0.05, 7]} /><meshStandardMaterial color="#ffffff" /></mesh>
            <mesh position={[-roadHalfW + 2.4, 0.34, z + centerZ]}><boxGeometry args={[0.32, 0.05, 7]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </React.Fragment>
        );
      })}

      {/* Lecture plus nette des voies sur toute la boucle */}
      {[
        [0, 0.34, -roadHalfH + centerZ - 5.1, roadHalfW * 2 + 18, 0.22],
        [0, 0.34, -roadHalfH + centerZ + 5.1, roadHalfW * 2 + 18, 0.22],
        [0, 0.34, roadHalfH + centerZ - 5.1, roadHalfW * 2 + 18, 0.22],
        [0, 0.34, roadHalfH + centerZ + 5.1, roadHalfW * 2 + 18, 0.22],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`road-edge-band-h-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.18 : 0} />
        </mesh>
      ))}
      {[
        [roadHalfW - 5.1, 0.34, centerZ, 0.22, roadHalfH * 2 + 18],
        [roadHalfW + 5.1, 0.34, centerZ, 0.22, roadHalfH * 2 + 18],
        [-roadHalfW - 5.1, 0.34, centerZ, 0.22, roadHalfH * 2 + 18],
        [-roadHalfW + 5.1, 0.34, centerZ, 0.22, roadHalfH * 2 + 18],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`road-edge-band-v-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 0.18 : 0} />
        </mesh>
      ))}
      {[[-roadHalfW, -roadHalfH], [roadHalfW, -roadHalfH], [roadHalfW, roadHalfH], [-roadHalfW, roadHalfH]].map(([x, z], index) => (
        <group key={`road-corner-lanes-${index}`} position={[x, 0.18, z + centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}><ringGeometry args={[4.4, 4.64, 24]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]}><ringGeometry args={[1.1, 1.34, 24]} /><meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.45 : 0} /></mesh>
        </group>
      ))}

      {/* Balisage routier premium nocturne continu */}
      {night && Array.from({ length: 14 }).map((_, i) => {
        const x = -roadHalfW + 12 + i * 22;
        return (
          <React.Fragment key={`premium-road-bollard-h-${i}`}>
            <group position={[x, 0.22, -roadHalfH - 4 + centerZ]}>
              <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.04, 0.05, 0.68, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
              <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.6} /></mesh>
            </group>
            <group position={[x, 0.22, roadHalfH + 4 + centerZ]}>
              <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.04, 0.05, 0.68, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
              <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={1.6} /></mesh>
            </group>
          </React.Fragment>
        );
      })}
      {night && Array.from({ length: 10 }).map((_, i) => {
        const z = -roadHalfH + 14 + i * 22;
        return (
          <React.Fragment key={`premium-road-bollard-v-${i}`}>
            <group position={[roadHalfW + 4, 0.22, z + centerZ]}>
              <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.04, 0.05, 0.68, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
              <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={1.6} /></mesh>
            </group>
            <group position={[-roadHalfW - 4, 0.22, z + centerZ]}>
              <mesh position={[0, 0.34, 0]}><cylinderGeometry args={[0.04, 0.05, 0.68, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
              <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={1.6} /></mesh>
            </group>
          </React.Fragment>
        );
      })}

      {/* Connexions centre-ville ↔ périphérie */}
      <mesh position={[0, 0.18, centerZ]}><boxGeometry args={[18, 0.22, roadHalfH * 2 - 26]} /><meshStandardMaterial color={roadColor} roughness={0.9} /></mesh>
      <mesh position={[0, 0.18, centerZ]}><boxGeometry args={[roadHalfW * 2 - 34, 0.22, 18]} /><meshStandardMaterial color={roadColor} roughness={0.9} /></mesh>
      <mesh position={[0, 0.3, centerZ]}><boxGeometry args={[2.1, 0.05, roadHalfH * 2 - 30]} /><meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.35 : 0} /></mesh>
      <mesh position={[0, 0.3, centerZ]}><boxGeometry args={[roadHalfW * 2 - 38, 0.05, 2.1]} /><meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.35 : 0} /></mesh>

      {/* Talus paysagers et bermes autour de la boucle */}
      {[
        [0, -0.2, -roadHalfH - 18 + centerZ, roadHalfW * 2 + 44, 1.3, 14],
        [0, -0.2, roadHalfH + 18 + centerZ, roadHalfW * 2 + 44, 1.3, 14],
        [roadHalfW + 18, -0.2, centerZ, 14, 1.3, roadHalfH * 2 + 44],
        [-roadHalfW - 18, -0.2, centerZ, 14, 1.3, roadHalfH * 2 + 44],
      ].map(([x, y, z, w, h, d], index) => (
        <group key={`berm-${index}`} position={[x, y, z]}>
          <mesh position={[0, -0.15, 0]}><boxGeometry args={[w, h, d]} /><meshPhysicalMaterial color={bermEarth} roughness={0.88} metalness={0.01} clearcoat={0.06} clearcoatRoughness={0.94} /></mesh>
          <mesh position={[0, 0.45, 0]}><boxGeometry args={[w * 0.94, h * 0.6, d * 0.9]} /><meshPhysicalMaterial color={bermGreen} roughness={0.96} metalness={0.01} clearcoat={0.04} clearcoatRoughness={0.96} /></mesh>
        </group>
      ))}

      {/* Bassins et canaux décoratifs autour de la ville */}
      {[
        [-104, centerZ - 78, 30, 12, 'LAGOON WEST'],
        [104, centerZ - 82, 28, 12, 'LAGOON EAST'],
        [-88, centerZ + 82, 24, 10, 'BASSIN SOUTH'],
        [88, centerZ + 86, 24, 10, 'CANAL SOUTH'],
      ].map(([x, z, w, d, name], index) => (
        <group key={`basin-${index}`} position={[x, 0, z]}>
          <mesh position={[0, 0.08, 0]}><boxGeometry args={[w + 3, 0.22, d + 3]} /><meshStandardMaterial color={night ? '#4f565d' : '#c8d0d8'} roughness={0.65} /></mesh>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[w, 0.1, d]} /><meshPhysicalMaterial color={basinWater} transparent opacity={0.78} roughness={0.02} metalness={0.28} /></mesh>
          <mesh ref={(el) => { basinReflectionRefs.current[index] = el; }} position={[0, 0.24, 0]}><boxGeometry args={[w * 0.92, 0.03, d * 0.9]} /><meshStandardMaterial color="#d8f6ff" emissive="#8fe7ff" emissiveIntensity={night ? 1.8 : 0.18} transparent opacity={night ? 0.28 : 0.2} /></mesh>
          <mesh position={[0, 1.9, d * 0.5 + 1.4]}><boxGeometry args={[10, 0.8, 0.12]} /><meshStandardMaterial color="#1a5fa8" emissive="#1a8aff" emissiveIntensity={night ? 1.8 : 0.18} /></mesh>
          <Text position={[0, 1.92, d * 0.5 + 1.56]} fontSize={0.46} color="#ffffff" anchorX="center" fontWeight="bold">{name}</Text>
        </group>
      ))}

      {/* Échangeurs routiers monumentaux Est/Ouest */}
      {[[-1, -roadHalfW - 18], [1, roadHalfW + 18]].map(([dir, x], index) => (
        <group key={`interchange-${index}`} position={[x, 0, centerZ]}>
          <mesh position={[0, 4.8, 0]}><boxGeometry args={[5.4, 0.34, 56]} /><meshPhysicalMaterial color={roadColor} roughness={0.72} metalness={0.05} clearcoat={0.08} clearcoatRoughness={0.88} /></mesh>
          <mesh position={[0, 5.02, 0]}><boxGeometry args={[1.2, 0.05, 52]} /><meshStandardMaterial color={medianColor} emissive={medianColor} emissiveIntensity={night ? 0.55 : 0} /></mesh>
          {[-18, 18].map((z, rampIndex) => (
            <mesh key={`ramp-${rampIndex}`} position={[-dir * 11, 2.6, z]} rotation={[0, 0, dir * (rampIndex === 0 ? 0.24 : -0.24)]}>
              <boxGeometry args={[24, 0.3, 5]} />
              <meshPhysicalMaterial color={roadColor} roughness={0.74} metalness={0.05} clearcoat={0.08} clearcoatRoughness={0.86} />
            </mesh>
          ))}
          {[-20, -8, 8, 20].map((z, pillarIndex) => (
            <mesh key={`pillar-${pillarIndex}`} position={[0, 2.2, z]}><boxGeometry args={[0.9, 4.4, 0.9]} /><meshPhysicalMaterial color={night ? '#636a74' : '#c8d0d8'} roughness={0.46} metalness={0.06} clearcoat={0.14} clearcoatRoughness={0.58} /></mesh>
          ))}
        </group>
      ))}

      {/* Signalétique lumineuse premium */}
      {[
        { key: 'north-sign', text: 'CAPTURE LOOP NORD', x: 0, z: -roadHalfH + centerZ, rot: 0 },
        { key: 'south-sign', text: 'MEGA CITY SOUTH', x: 0, z: roadHalfH + centerZ, rot: Math.PI },
        { key: 'east-sign', text: 'EAST INTERCHANGE', x: roadHalfW, z: centerZ, rot: Math.PI / 2 },
        { key: 'west-sign', text: 'WEST GATE', x: -roadHalfW, z: centerZ, rot: -Math.PI / 2 },
      ].map((sign, index) => (
        <group key={sign.key} position={[sign.x, 0, sign.z]} rotation={[0, sign.rot, 0]}>
          <mesh position={[-6, 4.4, 0]}><boxGeometry args={[0.5, 8, 0.5]} /><meshStandardMaterial color="#818891" metalness={0.6} /></mesh>
          <mesh position={[6, 4.4, 0]}><boxGeometry args={[0.5, 8, 0.5]} /><meshStandardMaterial color="#818891" metalness={0.6} /></mesh>
          <mesh position={[0, 7.6, 0]}><boxGeometry args={[16, 1.8, 0.25]} /><meshStandardMaterial color={signFrame} metalness={0.28} roughness={0.2} /></mesh>
          <mesh ref={(el) => { signGlowRefs.current[index] = el; }} position={[0, 7.6, 0.16]}><boxGeometry args={[15.2, 1.1, 0.08]} /><meshStandardMaterial color="#15304b" emissive="#1a8aff" emissiveIntensity={night ? 2.4 : 0.22} /></mesh>
          <Text position={[0, 7.62, 0.24]} fontSize={0.58} color="#ffffff" anchorX="center" fontWeight="bold">{sign.text}</Text>
        </group>
      ))}

      {/* ═══ AUTOROUTE FERROVIAIRE — boucle très large après les immeubles ═══ */}
      <mesh position={[0, railY, -railHalfH + centerZ]}><boxGeometry args={[railHalfW * 2 + 16, 0.14, 8.6]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
      <mesh position={[0, railY, railHalfH + centerZ]}><boxGeometry args={[railHalfW * 2 + 16, 0.14, 8.6]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
      <mesh position={[railHalfW, railY, centerZ]}><boxGeometry args={[8.6, 0.14, railHalfH * 2 + 16]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
      <mesh position={[-railHalfW, railY, centerZ]}><boxGeometry args={[8.6, 0.14, railHalfH * 2 + 16]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>

      {[-1.8, -1.0, 1.0, 1.8].map((offset, index) => (
        <React.Fragment key={`outer-rail-set-${index}`}>
          <mesh position={[0, railY + 0.08, -railHalfH + centerZ + offset]}><boxGeometry args={[railHalfW * 2 + 16, 0.07, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
          <mesh position={[0, railY + 0.08, railHalfH + centerZ + offset]}><boxGeometry args={[railHalfW * 2 + 16, 0.07, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
          <mesh position={[railHalfW + offset, railY + 0.08, centerZ]}><boxGeometry args={[0.12, 0.07, railHalfH * 2 + 16]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
          <mesh position={[-railHalfW + offset, railY + 0.08, centerZ]}><boxGeometry args={[0.12, 0.07, railHalfH * 2 + 16]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
        </React.Fragment>
      ))}

      {Array.from({ length: 16 }).map((_, i) => {
        const x = -railHalfW + 10 + i * 18;
        return (
          <React.Fragment key={`loop-rail-ties-h-${i}`}>
            <mesh position={[x, railY + 0.02, -railHalfH + centerZ]}><boxGeometry args={[0.42, 0.03, 7.4]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
            <mesh position={[x, railY + 0.02, railHalfH + centerZ]}><boxGeometry args={[0.42, 0.03, 7.4]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
          </React.Fragment>
        );
      })}
      {Array.from({ length: 12 }).map((_, i) => {
        const z = -railHalfH + 12 + i * 18;
        return (
          <React.Fragment key={`loop-rail-ties-v-${i}`}>
            <mesh position={[railHalfW, railY + 0.02, z + centerZ]}><boxGeometry args={[7.4, 0.03, 0.42]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
            <mesh position={[-railHalfW, railY + 0.02, z + centerZ]}><boxGeometry args={[7.4, 0.03, 0.42]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
          </React.Fragment>
        );
      })}

      {[[-railHalfW, -railHalfH], [railHalfW, -railHalfH], [railHalfW, railHalfH], [-railHalfW, railHalfH]].map(([x, z], index) => (
        <group key={`rail-corner-${index}`} position={[x, railY, z + centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.6, 20]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><ringGeometry args={[1.6, 1.76, 20]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.16} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><ringGeometry args={[3.4, 3.56, 20]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.16} /></mesh>
        </group>
      ))}

      {[
        [0, -railHalfH, railHalfW * 2 + 10, 'x', railHalfH + 4],
        [0, railHalfH, railHalfW * 2 + 10, 'x', -railHalfH - 4],
        [railHalfW, 0, railHalfH * 2 + 10, 'z', railHalfW + 4],
        [-railHalfW, 0, railHalfH * 2 + 10, 'z', -railHalfW - 4],
      ].map(([anchorA, anchorB, len, axis, barrierAxis], sideIndex) => {
        const count = Math.floor(len / 10);
        return Array.from({ length: count }).map((_, index) => {
          const offset = -len * 0.5 + index * 10 + 5;
          const x = axis === 'x' ? offset : barrierAxis;
          const z = axis === 'x' ? anchorB : offset;
          return (
            <mesh key={`rail-guard-${sideIndex}-${index}`} position={[x, railY + 0.42, z + centerZ]} rotation={[0, axis === 'z' ? Math.PI / 2 : 0, 0]}>
              <boxGeometry args={[6.4, 0.45, 0.18]} />
              <meshStandardMaterial color={index % 2 === 0 ? '#cc3333' : '#f5f5f5'} roughness={0.65} />
            </mesh>
          );
        });
      })}

      {/* Rubans néon ferroviaires sur tout le tour */}
      {[
        [0, railY + 0.18, -railHalfH + centerZ - 3.6, railHalfW * 2 + 16, 0.1],
        [0, railY + 0.18, -railHalfH + centerZ + 3.6, railHalfW * 2 + 16, 0.1],
        [0, railY + 0.18, railHalfH + centerZ - 3.6, railHalfW * 2 + 16, 0.1],
        [0, railY + 0.18, railHalfH + centerZ + 3.6, railHalfW * 2 + 16, 0.1],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`rail-neon-h-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.04, d]} />
          <meshStandardMaterial color={neonRailColor} emissive={neonRailColor} emissiveIntensity={night ? 2.2 : 0.06} transparent opacity={night ? 0.95 : 0.3} />
        </mesh>
      ))}
      {[
        [railHalfW + 3.6, railY + 0.18, centerZ, 0.1, railHalfH * 2 + 16],
        [railHalfW - 3.6, railY + 0.18, centerZ, 0.1, railHalfH * 2 + 16],
        [-railHalfW + 3.6, railY + 0.18, centerZ, 0.1, railHalfH * 2 + 16],
        [-railHalfW - 3.6, railY + 0.18, centerZ, 0.1, railHalfH * 2 + 16],
      ].map(([x, y, z, w, d], index) => (
        <mesh key={`rail-neon-v-${index}`} position={[x, y, z]}>
          <boxGeometry args={[w, 0.04, d]} />
          <meshStandardMaterial color={neonRailColor} emissive={neonRailColor} emissiveIntensity={night ? 2.2 : 0.06} transparent opacity={night ? 0.95 : 0.3} />
        </mesh>
      ))}

      {/* Caténaires / structures aériennes */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = -railHalfW + 16 + i * 34;
        return (
          <React.Fragment key={`catenary-horizontal-${i}`}>
            <group position={[x, 0, -railHalfH + centerZ]}>
              <mesh position={[-3.4, 5.4, 0]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[3.4, 5.4, 0]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 10.6, 0]}><boxGeometry args={[7.2, 0.12, 0.16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
            </group>
            <group position={[x, 0, railHalfH + centerZ]}>
              <mesh position={[-3.4, 5.4, 0]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[3.4, 5.4, 0]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 10.6, 0]}><boxGeometry args={[7.2, 0.12, 0.16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
            </group>
          </React.Fragment>
        );
      })}
      {Array.from({ length: 6 }).map((_, i) => {
        const z = -railHalfH + 20 + i * 32;
        return (
          <React.Fragment key={`catenary-vertical-${i}`}>
            <group position={[railHalfW, 0, z + centerZ]}>
              <mesh position={[0, 5.4, -3.4]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 5.4, 3.4]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 10.6, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[7.2, 0.12, 0.16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
            </group>
            <group position={[-railHalfW, 0, z + centerZ]}>
              <mesh position={[0, 5.4, -3.4]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 5.4, 3.4]}><boxGeometry args={[0.22, 10.8, 0.22]} /><meshStandardMaterial color="#bbc4cd" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 10.6, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[7.2, 0.12, 0.16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
            </group>
          </React.Fragment>
        );
      })}
      <mesh position={[0, 10.3, -railHalfH + centerZ]}><boxGeometry args={[railHalfW * 2 + 16, 0.02, 0.05]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
      <mesh position={[0, 10.3, railHalfH + centerZ]}><boxGeometry args={[railHalfW * 2 + 16, 0.02, 0.05]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
      <mesh position={[railHalfW, 10.3, centerZ]}><boxGeometry args={[0.05, 0.02, railHalfH * 2 + 16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
      <mesh position={[-railHalfW, 10.3, centerZ]}><boxGeometry args={[0.05, 0.02, railHalfH * 2 + 16]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
      {[
        { x: 110, z: centerZ - 17.6, rot: -0.42 },
        { x: 110, z: centerZ + 17.6, rot: 0.42 },
        { x: -110, z: centerZ - 17.6, rot: -Math.PI + 0.42 },
        { x: -110, z: centerZ + 17.6, rot: Math.PI - 0.42 },
      ].map((connector, index) => (
        <mesh key={`connector-wire-${index}`} position={[connector.x, 10.3, connector.z]} rotation={[0, connector.rot, 0]}><boxGeometry args={[58, 0.02, 0.05]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
      ))}

      {/* Signaux ferroviaires */}
      {[
        [-44, -railHalfH + centerZ + 5, 0], [44, -railHalfH + centerZ + 5, 0],
        [-44, railHalfH + centerZ - 5, Math.PI], [44, railHalfH + centerZ - 5, Math.PI],
        [railHalfW - 5, centerZ - 34, Math.PI / 2], [railHalfW - 5, centerZ + 34, Math.PI / 2],
        [-railHalfW + 5, centerZ - 34, -Math.PI / 2], [-railHalfW + 5, centerZ + 34, -Math.PI / 2],
      ].map(([x, z, rot], i) => (
        <group key={`rail-signal-${i}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
          <mesh position={[0, 2.6, 0]}><boxGeometry args={[0.24, 5.2, 0.24]} /><meshStandardMaterial color="#b7c1ca" metalness={0.92} roughness={0.08} /></mesh>
          <mesh position={[0, 5.1, 0.42]}><boxGeometry args={[0.9, 1.6, 0.28]} /><meshStandardMaterial color="#131922" roughness={0.5} /></mesh>
          <mesh position={[0, 5.45, 0.58]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#ff4040" emissive="#ff4040" emissiveIntensity={night ? 2.2 : 0.18} /></mesh>
          <mesh position={[0, 4.78, 0.58]}><sphereGeometry args={[0.16, 10, 10]} /><meshStandardMaterial color="#58ff8a" emissive="#58ff8a" emissiveIntensity={night ? 1.6 : 0.12} /></mesh>
        </group>
      ))}

      {/* Aiguillages visuels / zones de bifurcation */}
      {[
        [0, centerZ - 3.2, 0.32], [0, centerZ + 3.2, -0.32],
        [-26, centerZ - railHalfH, 0.22], [26, centerZ - railHalfH, -0.22],
        [-26, centerZ + railHalfH, -0.22], [26, centerZ + railHalfH, 0.22],
      ].map(([x, z, rot], i) => (
        <group key={`visual-switch-${i}`} position={[x, railY + 0.09, z]}>
          <mesh position={[0, -0.02, 0.32]}><boxGeometry args={[8.4, 0.05, 2.3]} /><meshStandardMaterial color={ballastColor} roughness={0.92} /></mesh>
          {[-3.2, -1.6, 0, 1.6, 3.2].map((tieOffset, tieIndex) => (
            <mesh key={`switch-tie-${tieIndex}`} position={[tieOffset, -0.01, 0.32]}>
              <boxGeometry args={[0.34, 0.03, 2.1]} />
              <meshStandardMaterial color={ballastColor} roughness={0.9} />
            </mesh>
          ))}
          <mesh rotation={[0, rot, 0]}><boxGeometry args={[7.2, 0.06, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.95} roughness={0.12} /></mesh>
          <mesh rotation={[0, -rot, 0]} position={[0, 0, 0.8]}><boxGeometry args={[7.2, 0.06, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.95} roughness={0.12} /></mesh>
          <mesh rotation={[0, rot * 0.42, 0]} position={[1.2, 0.02, 0.38]}><boxGeometry args={[2.8, 0.05, 0.1]} /><meshStandardMaterial color="#d9e2ea" metalness={0.96} roughness={0.08} /></mesh>
          <group position={[0, 0.18, -1.2]}>
            <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.06, 0.08, 0.84, 8]} /><meshStandardMaterial color="#bac4ce" metalness={0.9} roughness={0.08} /></mesh>
            <mesh position={[0, 0.88, 0.12]}><boxGeometry args={[0.46, 0.26, 0.18]} /><meshStandardMaterial color="#141b23" roughness={0.45} /></mesh>
            <mesh position={[-0.1, 0.9, 0.24]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#ffd76a" emissive="#ffd76a" emissiveIntensity={night ? 1.4 : 0.18} /></mesh>
            <mesh position={[0.1, 0.9, 0.24]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#58ff8a" emissive="#58ff8a" emissiveIntensity={night ? 1.2 : 0.12} /></mesh>
          </group>
        </group>
      ))}

      {/* ═══ 4 gares périphériques + gare centrale ═══ */}
      {outerStations.map((station) => (
        <group
          key={station.key}
          position={[station.x, 0, station.z + centerZ]}
          rotation={[0, station.rot, 0]}

        >
          <mesh position={[0, railY + 0.16, 4.5]}><boxGeometry args={[28, 0.32, station.platformDepth]} /><meshStandardMaterial color={platformColor} roughness={0.42} metalness={0.16} /></mesh>
          <mesh position={[0, railY + 0.14, -4.2]}><boxGeometry args={[28, 0.24, 4.8]} /><meshStandardMaterial color={platformColor} roughness={0.42} metalness={0.16} /></mesh>
          <mesh position={[0, railY + 0.32, 2.5]}><boxGeometry args={[28, 0.05, 0.22]} /><meshStandardMaterial color={bridgeGlow} emissive={bridgeGlow} emissiveIntensity={night ? 1.8 : 0.18} /></mesh>
          <mesh position={[0, railY + 0.28, -2.2]}><boxGeometry args={[28, 0.05, 0.18]} /><meshStandardMaterial color={bridgeGlow} emissive={bridgeGlow} emissiveIntensity={night ? 1.5 : 0.12} /></mesh>
          <mesh position={[0, 2.8, 9]}><boxGeometry args={[18, 5.4, 4.8]} /><meshPhysicalMaterial color={stationColor} transparent opacity={0.66} metalness={0.64} roughness={0.1} /></mesh>
          <mesh position={[0, 5.7, 9]}><boxGeometry args={[19.5, 0.3, 5.4]} /><meshStandardMaterial color={night ? '#273142' : '#f4f7fb'} roughness={0.18} metalness={0.34} /></mesh>
          {[-6, -3, 0, 3, 6].map((x, windowIndex) => (
            <mesh key={`station-window-${station.key}-${windowIndex}`} position={[x, 2.8, 6.56]}>
              <planeGeometry args={[1.7, 3.8]} />
              <meshPhysicalMaterial color={glassColor} transparent opacity={0.5} roughness={0.05} metalness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 4.7, 6.62]}><boxGeometry args={[10, 0.9, 0.12]} /><meshStandardMaterial color="#134f86" emissive="#1a8aff" emissiveIntensity={night ? 2.2 : 0.25} /></mesh>
          <Text position={[0, 4.72, 6.78]} fontSize={0.72} color="#ffffff" anchorX="center" fontWeight="bold">{station.name}</Text>
          <mesh position={[0, 4.05, 4.5]}><boxGeometry args={[24, 0.14, 6.8]} /><meshStandardMaterial color={night ? '#2a3040' : '#e8ecf0'} roughness={0.24} metalness={0.28} /></mesh>
          <mesh position={[0, 4.05, -4.2]}><boxGeometry args={[22, 0.12, 4.4]} /><meshStandardMaterial color={night ? '#2a3040' : '#e8ecf0'} roughness={0.24} metalness={0.28} /></mesh>
          {[-10, -5, 0, 5, 10].map((pillarX, pillarIndex) => (
            <mesh key={`station-pillar-${station.key}-${pillarIndex}`} position={[pillarX, 2.16, 4.5]}><cylinderGeometry args={[0.12, 0.14, 3.7, 8]} /><meshStandardMaterial color="#8b939b" metalness={0.55} /></mesh>
          ))}
          <mesh position={[8.8, 3.8, -6.3]}><boxGeometry args={[3.8, 1.1, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#7ce7ff" emissiveIntensity={night ? 1.5 : 0.12} /></mesh>
          <Text position={[8.8, 3.82, -6.16]} fontSize={0.28} color="#ffffff" anchorX="center" fontWeight="bold">SORTIE LOOP</Text>
          {[-7, 0, 7].map((benchX, benchIndex) => (
            <group key={`station-bench-${station.key}-${benchIndex}`} position={[benchX, 0, 2.1]}>
              <mesh position={[0, 0.7, 0]}><boxGeometry args={[2.2, 0.16, 0.6]} /><meshStandardMaterial color="#d8e0e8" metalness={0.45} roughness={0.18} /></mesh>
              <mesh position={[0, 1.05, -0.24]}><boxGeometry args={[2.2, 0.7, 0.12]} /><meshStandardMaterial color="#d8e0e8" metalness={0.45} roughness={0.18} /></mesh>
            </group>
          ))}
          <mesh position={[-8.8, 3.8, 6.5]}><boxGeometry args={[3.6, 1.2, 0.12]} /><meshStandardMaterial color="#0f1a2a" emissive="#1a8aff" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          <Text position={[-8.8, 3.82, 6.64]} fontSize={0.34} color="#ffffff" anchorX="center" fontWeight="bold">PROCHAIN TRAIN</Text>
          {[-9.2, -4.4, 1.2, 6.2, 10].map((px, passengerIndex) => (
            <AnimatedPedestrian
              key={`station-passenger-${station.key}-${passengerIndex}`}
              position={[px, railY + 0.18, 3.2]}
              scale={0.62}
              bodyColor={['#ffffff', '#2f405a', '#6b3d3d', '#145f53', '#67458e'][passengerIndex]}
              skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b', '#e7bc97'][passengerIndex]}
              variant={passengerIndex % 2 === 0 ? 'chatting' : 'casual'}
              gesture={['none', 'talk', 'phone', 'none', 'talk'][passengerIndex]}
              moveMode="queue"
              moveRadius={0.18}
              pace={0.8 + passengerIndex * 0.03}
              phase={passengerIndex * 0.7}
              dataTestId={`station-passenger-${station.key}-${passengerIndex}`}
            />
          ))}
          <mesh position={[8.8, 5.2, 6.56]}><boxGeometry args={[1.6, 1.6, 0.12]} /><meshStandardMaterial color="#16273c" emissive="#1a8aff" emissiveIntensity={night ? 1.6 : 0.08} /></mesh>
          <Text position={[8.8, 5.22, 6.68]} fontSize={0.38} color="#ffffff" anchorX="center" fontWeight="bold">12:45</Text>
        </group>
      ))}

      <group position={[0, 0, centerZ]}>
        <mesh position={[0, railY + 0.12, 0]}><boxGeometry args={[44, 0.32, 24]} /><meshStandardMaterial color={platformColor} roughness={0.38} metalness={0.18} /></mesh>
        <mesh position={[0, railY + 0.12, -10.8]}><boxGeometry args={[44, 0.24, 4.8]} /><meshStandardMaterial color={platformColor} roughness={0.38} metalness={0.18} /></mesh>
        <mesh position={[0, railY + 0.12, 10.8]}><boxGeometry args={[44, 0.24, 4.8]} /><meshStandardMaterial color={platformColor} roughness={0.38} metalness={0.18} /></mesh>
        {[-6.4, -3.2, 3.2, 6.4].map((z, index) => (
          <mesh key={`central-led-track-${index}`} position={[0, railY + 0.28, z]}><boxGeometry args={[42, 0.05, 0.18]} /><meshStandardMaterial color={bridgeGlow} emissive={bridgeGlow} emissiveIntensity={night ? 1.9 : 0.2} /></mesh>
        ))}
        <mesh position={[0, 3.4, 0]}><boxGeometry args={[22, 6.4, 15]} /><meshPhysicalMaterial color={stationColor} transparent opacity={0.72} roughness={0.08} metalness={0.65} /></mesh>
        <mesh position={[0, 6.9, 0]}><boxGeometry args={[24, 0.36, 18]} /><meshStandardMaterial color={night ? '#223040' : '#f6f9fc'} roughness={0.16} metalness={0.32} /></mesh>
        <mesh position={[0, 5.6, 5.08]}><boxGeometry args={[12, 1, 0.12]} /><meshStandardMaterial color="#1a5fa8" emissive="#1a8aff" emissiveIntensity={night ? 2.4 : 0.3} /></mesh>
        <Text position={[0, 5.62, 5.24]} fontSize={0.92} color="#ffffff" anchorX="center" fontWeight="bold">GARE CENTRALE</Text>
        <mesh position={[0, 5.4, -5.08]}><boxGeometry args={[14, 0.9, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#7ce7ff" emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
        <Text position={[0, 5.42, -4.92]} fontSize={0.4} color="#ffffff" anchorX="center" fontWeight="bold">NORD • SUD • LOOP</Text>
        {[-7.5, -3.5, 0, 3.5, 7.5].map((x, index) => (
          <mesh key={`central-window-${index}`} position={[x, 3.5, 5.1]}>
            <planeGeometry args={[2.1, 4.2]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={0.55} roughness={0.04} metalness={0.6} />
          </mesh>
        ))}
        {[-14, -7, 0, 7, 14].map((x, index) => (
          <mesh key={`central-pillar-${index}`} position={[x, 2.1, 0]}><cylinderGeometry args={[0.14, 0.16, 3.7, 8]} /><meshStandardMaterial color="#8b939b" metalness={0.55} /></mesh>
        ))}
      </group>

      {/* Rails rapides centraux — 4 voies avec changement aléatoire de voie après terminus Est/Ouest */}
      {[-4.8, 4.8].map((z, index) => (
        <mesh key={`rapid-ballast-${index}`} position={[0, railY, centerZ + z]}><boxGeometry args={[170, 0.14, 4.6]} /><meshStandardMaterial color={ballastColor} roughness={0.9} /></mesh>
      ))}
      {[-6.4, -3.2, 3.2, 6.4].flatMap((trackZ, trackIndex) => (
        [-0.3, 0.3].map((offset, railIndex) => (
          <mesh key={`hub-rail-${trackIndex}-${railIndex}`} position={[0, railY + 0.08, centerZ + trackZ + offset]}><boxGeometry args={[170, 0.07, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
        ))
      ))}
      {[-6.4, -3.2, 3.2, 6.4].map((trackZ, index) => (
        <mesh key={`hub-neon-${index}`} position={[0, railY + 0.18, centerZ + trackZ]}><boxGeometry args={[170, 0.04, 0.14]} /><meshStandardMaterial color={neonRailColor} emissive={neonRailColor} emissiveIntensity={night ? 2.6 : 0.08} transparent opacity={night ? 0.98 : 0.35} /></mesh>
      ))}
      {[
        { x: 110, z: centerZ - 17.6, rot: -0.42 },
        { x: 110, z: centerZ + 17.6, rot: 0.42 },
        { x: -110, z: centerZ - 17.6, rot: -Math.PI + 0.42 },
        { x: -110, z: centerZ + 17.6, rot: Math.PI - 0.42 },
      ].map((connector, index) => (
        <group key={`rapid-connector-${index}`} position={[connector.x, railY, connector.z]} rotation={[0, connector.rot, 0]}>
          <mesh><boxGeometry args={[58, 0.14, 3.8]} /><meshStandardMaterial color={ballastColor} roughness={0.9} /></mesh>
          {[-0.82, 0.82].map((offset, railIndex) => (
            <mesh key={`rapid-connector-rail-${railIndex}`} position={[0, 0.08, offset]}><boxGeometry args={[58, 0.07, 0.12]} /><meshStandardMaterial color={railColor} metalness={0.9} roughness={0.14} /></mesh>
          ))}
          {Array.from({ length: 6 }).map((_, tieIndex) => (
            <mesh key={`rapid-connector-tie-${tieIndex}`} position={[-24 + tieIndex * 9.6, 0.02, 0]}>
              <boxGeometry args={[0.34, 0.03, 3.2]} />
              <meshStandardMaterial color={ballastColor} roughness={0.92} />
            </mesh>
          ))}
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[58, 0.04, 0.1]} /><meshStandardMaterial color={neonRailColor} emissive={neonRailColor} emissiveIntensity={night ? 1.8 : 0.06} transparent opacity={night ? 0.8 : 0.25} /></mesh>
        </group>
      ))}
      {[
        { x: 110, z: centerZ - 17.6, rot: -0.42, label: 'LOOP NORD' },
        { x: 110, z: centerZ + 17.6, rot: 0.42, label: 'LOOP SUD' },
        { x: -110, z: centerZ - 17.6, rot: -Math.PI + 0.42, label: 'CENTRALE' },
        { x: -110, z: centerZ + 17.6, rot: Math.PI - 0.42, label: 'CENTRALE' },
      ].map((connector, index) => (
        <group key={`connector-sign-${index}`} position={[connector.x, 0, connector.z]} rotation={[0, connector.rot, 0]}>
          <mesh position={[0, 3.1, 0]}><boxGeometry args={[0.14, 6.2, 0.14]} /><meshStandardMaterial color="#cfd7df" metalness={0.9} roughness={0.08} /></mesh>
          <mesh position={[2.2, 5.1, 0]}><boxGeometry args={[4.4, 0.82, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#1a8aff" emissiveIntensity={night ? 1.6 : 0.12} /></mesh>
          <Text position={[2.2, 5.14, 0.16]} fontSize={0.28} color="#ffffff" anchorX="center" fontWeight="bold">{connector.label}</Text>
        </group>
      ))}

      {/* Trains grande boucle */}
      {[trainRef1, trainRef2, trainRef3, trainRef4].map((ref, index) => (
        <group key={`outer-loop-train-${index}`} ref={ref}>
          <mesh position={[0, 0.34, 0]}><boxGeometry args={[4.4, 0.72, 1.12]} /><meshStandardMaterial color={['#16366b', '#7a1f1f', '#145f53', '#67458e'][index]} metalness={0.58} roughness={0.28} /></mesh>
          <mesh position={[0, 0.72, 0]}><boxGeometry args={[4.2, 0.08, 1.02]} /><meshStandardMaterial color="#d8dde8" metalness={0.8} roughness={0.16} /></mesh>
          <mesh position={[2.1, 0.52, 0]}><boxGeometry args={[0.18, 0.38, 0.84]} /><meshStandardMaterial color="#7ec8e3" transparent opacity={0.82} emissive="#7ec8e3" emissiveIntensity={night ? 0.9 : 0.22} /></mesh>
          {[-4.6, -8.8, -13, -17.2].map((wagonX, wagonIndex) => (
            <group key={`outer-wagon-${index}-${wagonIndex}`} position={[wagonX, 0.3, 0]}>
              <mesh><boxGeometry args={[3.8, 0.66, 1.02]} /><meshStandardMaterial color={['#35517e', '#6b3d3d', '#2a655d', '#5a4680'][index]} metalness={0.5} roughness={0.34} /></mesh>
              {[-1.2, -0.2, 0.8].map((windowX, windowIndex) => (
                <React.Fragment key={`outer-window-${windowIndex}`}>
                  <mesh position={[windowX, 0.1, 0.53]}><planeGeometry args={[0.48, 0.34]} /><meshStandardMaterial color="#86d5f7" transparent opacity={0.75} emissive="#86d5f7" emissiveIntensity={night ? 0.6 : 0.16} /></mesh>
                  <mesh position={[windowX, 0.1, -0.53]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.48, 0.34]} /><meshStandardMaterial color="#86d5f7" transparent opacity={0.75} emissive="#86d5f7" emissiveIntensity={night ? 0.6 : 0.16} /></mesh>
                </React.Fragment>
              ))}
            </group>
          ))}
          <mesh position={[2.22, 0.18, 0.28]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.2} /></mesh>
          <mesh position={[2.22, 0.18, -0.28]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.2} /></mesh>
        </group>
      ))}

      {/* Trains navettes synchronisés à la gare centrale */}
      {[{ ref: hubTrainWestRef, color: '#0f5c91', accent: centerZ - 3.2, id: 'west' }, { ref: hubTrainEastRef, color: '#7c3f12', accent: centerZ + 3.2, id: 'east' }].map((train) => (
        <group key={`hub-train-${train.id}`} ref={train.ref}>
          <mesh position={[0, 0.32, 0]}><boxGeometry args={[3.8, 0.66, 0.94]} /><meshStandardMaterial color={train.color} metalness={0.52} roughness={0.28} /></mesh>
          <mesh position={[0, 0.68, 0]}><boxGeometry args={[3.65, 0.08, 0.86]} /><meshStandardMaterial color="#e2e8f0" metalness={0.78} roughness={0.16} /></mesh>
          <mesh position={[1.82, 0.5, 0]}><boxGeometry args={[0.16, 0.34, 0.74]} /><meshStandardMaterial color="#8bd7ff" transparent opacity={0.82} emissive="#8bd7ff" emissiveIntensity={night ? 0.9 : 0.2} /></mesh>
          {[-3.8, -7.2].map((wagonX, wagonIndex) => (
            <group key={`hub-wagon-${train.id}-${wagonIndex}`} position={[wagonX, 0.28, 0]}>
              <mesh><boxGeometry args={[3.2, 0.62, 0.88]} /><meshStandardMaterial color={train.color} metalness={0.46} roughness={0.32} /></mesh>
            </group>
          ))}
          <mesh position={[1.95, 0.18, 0.22]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2 : 0.18} /></mesh>
          <mesh position={[1.95, 0.18, -0.22]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2 : 0.18} /></mesh>
        </group>
      ))}

      {/* Fumées / vapeur douce pour une ville plus vivante */}
      {[
        [-118, centerZ - 12],
        [118, centerZ + 10],
        [0, centerZ - 8],
        [-54, centerZ + 76],
        [54, centerZ + 74],
        [0, centerZ - 92],
      ].map(([x, z], index) => (
        <group key={`steam-stack-${index}`} position={[x, 0, z]}>
          {[0, 1, 2].map((puff) => (
            <mesh key={`steam-puff-${index}-${puff}`} ref={(el) => { steamRefs.current[index * 3 + puff] = el; }} position={[puff * 0.6 - 0.6, 0.8 + puff * 0.6, 0]}>
              <sphereGeometry args={[0.8 + puff * 0.12, 8, 8]} />
              <meshStandardMaterial color={night ? '#cfd8df' : '#d9dfdf'} transparent opacity={night ? 0.18 : 0.12} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Lampadaires périphériques */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x = -roadHalfW + 18 + i * 30;
        return (
          <React.Fragment key={`lights-horizontal-${i}`}>
            <group position={[x, 0, -roadHalfH - 10 + centerZ]}>
              <mesh position={[0, 3.2, 0]}><cylinderGeometry args={[0.12, 0.16, 6.2, 8]} /><meshStandardMaterial color="#727a84" metalness={0.6} /></mesh>
              <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.3} /></mesh>
            </group>
            <group position={[x, 0, roadHalfH + 10 + centerZ]}>
              <mesh position={[0, 3.2, 0]}><cylinderGeometry args={[0.12, 0.16, 6.2, 8]} /><meshStandardMaterial color="#727a84" metalness={0.6} /></mesh>
              <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.3} /></mesh>
            </group>
          </React.Fragment>
        );
      })}
      {Array.from({ length: 7 }).map((_, i) => {
        const z = -roadHalfH + 18 + i * 30;
        return (
          <React.Fragment key={`lights-vertical-${i}`}>
            <group position={[roadHalfW + 10, 0, z + centerZ]}>
              <mesh position={[0, 3.2, 0]}><cylinderGeometry args={[0.12, 0.16, 6.2, 8]} /><meshStandardMaterial color="#727a84" metalness={0.6} /></mesh>
              <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.3} /></mesh>
            </group>
            <group position={[-roadHalfW - 10, 0, z + centerZ]}>
              <mesh position={[0, 3.2, 0]}><cylinderGeometry args={[0.12, 0.16, 6.2, 8]} /><meshStandardMaterial color="#727a84" metalness={0.6} /></mesh>
              <mesh position={[0, 6.5, 0]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={night ? 2.2 : 0.3} /></mesh>
            </group>
          </React.Fragment>
        );
      })}

      <PerimeterLoopTraffic night={night} centerZ={centerZ} halfW={roadHalfW} halfH={roadHalfH} />
    </group>
  );
}

export default FerryTrainCityPlaza;

// ─── Véhicules en trafic sur les routes stade/mall ───
function TrafficVehicles({ night, centerZ, W }) {
  const carsRef = useRef();
  useFrame(({ clock }) => {
    if (!carsRef.current) return;
    const t = clock.getElapsedTime();
    carsRef.current.children.forEach((car, i) => {
      const dir = i < 4 ? 1 : -1;
      const speed = 4 + i * 0.6;
      const range = 34;
      const baseX = dir === 1 ? W + 2 : -W - 2;
      car.position.x = baseX + dir * ((t * speed + i * 8) % range);
      car.rotation.y = dir === 1 ? 0 : Math.PI;
    });
  });
  const colors = ['#cc0000', '#0066cc', '#333333', '#ffffff', '#FFD700', '#1a1a1a', '#0088aa', '#2ecc71'];
  return (
    <group ref={carsRef}>
      {colors.map((c, i) => (
        <group key={`tcar-${i}`} position={[0, 0.35, -20 + (i % 2 === 0 ? -1 : 1) + centerZ]}>
          <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.8, 0.4, 0.9]} /><meshStandardMaterial color={c} metalness={0.5} roughness={0.3} /></mesh>
          <mesh position={[0.1, 0.42, 0]}><boxGeometry args={[1.1, 0.3, 0.8]} /><meshStandardMaterial color={c} metalness={0.5} roughness={0.3} /></mesh>
          <mesh position={[0.1, 0.48, 0.1]}><boxGeometry args={[0.8, 0.2, 0.6]} /><meshStandardMaterial color="#7ec8e3" transparent opacity={0.6} /></mesh>
          {[[-0.65, -0.35], [-0.65, 0.35], [0.65, -0.35], [0.65, 0.35]].map(([wx, wz], wi) => (
            <mesh key={`tw-${wi}`} position={[wx, 0, wz]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.08, 8]} /><meshStandardMaterial color="#1a1a1a" roughness={0.95} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── MEGA CITY EXPANSION — Ports, Nature, Ponts, Faune ───
function MegaCityExpansion({ night, centerZ }) {
  const W = 82, H = 78;
  const portColor = night ? '#3a4050' : '#d0d4dc';
  const woodColor = '#8B6914';
  const waterColor = night ? '#0a3050' : '#3a9ac8';
  const bridgeColor = night ? '#c8ccd4' : '#f0f2f6';
  const districtGlass = night ? '#8edcff' : '#d8f5ff';
  const poiGlow = night ? '#7ce7ff' : '#8ecbff';
  const flashRefs = useRef([]);
  const beaconRefs = useRef([]);
  const hallScreenRefs = useRef([]);
  const droneRefs = useRef([]);
  const laserRefs = useRef([]);
  const poiRefs = useRef([]);
  const eventBannerRefs = useRef([]);
  const districtShowRefs = useRef([]);
  const skylineCrownRefs = useRef([]);
  const helipadBeaconRefs = useRef([]);
  const sculptureGlowRefs = useRef([]);
  const chauffeurLightRefs = useRef([]);
  const [signatureMode, setSignatureMode] = useState('dawn');
  const [signatureAutoCycle, setSignatureAutoCycle] = useState(true);

  const signatureThemes = useMemo(() => ({
    dawn: {
      primary: '#7ce7ff',
      secondary: '#9cf9c1',
      tertiary: '#ffd7a8',
      foliage: '#63dd86',
      core: '#e9fbff',
    },
    sunset: {
      primary: '#ffb066',
      secondary: '#ffd870',
      tertiary: '#ff7fd6',
      foliage: '#8adb6f',
      core: '#fff2dc',
    },
    neon: {
      primary: '#41d8ff',
      secondary: '#ff56d6',
      tertiary: '#6bffb0',
      foliage: '#39f17e',
      core: '#dcfbff',
    },
  }), []);

  useEffect(() => {
    if (!signatureAutoCycle) return undefined;
    const order = ['dawn', 'sunset', 'neon'];
    const autoInterval = setInterval(() => {
      setSignatureMode((prev) => {
        const idx = order.indexOf(prev);
        return order[(idx + 1) % order.length];
      });
    }, 12000);

    return () => clearInterval(autoInterval);
  }, [signatureAutoCycle]);

  const signatureTheme = signatureThemes[signatureMode] || signatureThemes.dawn;

  const hallDroneAnchors = useMemo(() => ([
    { x: -28, z: 14, y: 23.5 },
    { x: -18, z: -15, y: 25.5 },
    { x: 0, z: 23, y: 28.2 },
    { x: 18, z: -16, y: 24.6 },
    { x: 28, z: 10, y: 26.1 },
    { x: 0, z: -24, y: 29.1 },
  ]), []);

  const ultraPremiumInstallationsPhase2 = useMemo(() => (
    Array.from({ length: 40 }, (_, index) => {
      const isArchitecture = index < 20;
      const localIndex = isArchitecture ? index : index - 20;
      const angle = (localIndex / 20) * Math.PI * 2 + (isArchitecture ? 0.1 : 0.24);
      const radius = isArchitecture ? 46 + (localIndex % 5) * 6 : 112 + (localIndex % 5) * 7;
      const zSpread = isArchitecture ? 32 + (localIndex % 4) * 4 : 66 + (localIndex % 4) * 6;

      return {
        id: index,
        category: isArchitecture ? 'architecture' : 'landscape',
        x: Math.cos(angle) * radius + (isArchitecture ? (localIndex % 2 === 0 ? 6 : -6) : 0),
        z: Math.sin(angle) * zSpread + centerZ + (isArchitecture ? 10 : 6),
        h: isArchitecture ? 2.8 + (localIndex % 4) * 0.7 : 1.6 + (localIndex % 3) * 0.45,
      };
    })
  ), [centerZ]);

  const ultraPremiumInstallations = useMemo(() => (
    Array.from({ length: 40 }, (_, index) => {
      const angle = (index / 40) * Math.PI * 2;
      const radius = 96 + (index % 5) * 8;
      const zStretch = 62 + (index % 4) * 5;
      const palette = ['#7ce7ff', '#ffd870', '#ff7fd6', '#9cf9c1', '#8fd4ff'];
      return {
        id: index,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * zStretch + centerZ + 6,
        motif: index % 8,
        tone: palette[index % palette.length],
      };
    })
  ), [centerZ]);

  const perimeterTowers = useMemo(() => ([
    { x: -68, z: -50, h: 32, w: 6, d: 6, color: '#f0f2f6' },
    { x: 68, z: -50, h: 28, w: 6, d: 6, color: '#f4f6fa' },
    { x: -65, z: 30, h: 36, w: 7, d: 6, color: '#eef2f6' },
    { x: 65, z: 30, h: 30, w: 6, d: 7, color: '#f0f4f8' },
    { x: -58, z: -40, h: 40, w: 7, d: 7, color: '#f2f4f8' },
    { x: -55, z: 50, h: 26, w: 6, d: 6, color: '#eef0f4' },
    { x: 58, z: -40, h: 34, w: 7, d: 6, color: '#d35400' },
    { x: 55, z: 50, h: 24, w: 6, d: 5, color: '#2980b9' },
    { x: -84, z: -62, h: 24, w: 5.2, d: 5.6, color: '#edf2f8' },
    { x: 84, z: -62, h: 24, w: 5.2, d: 5.6, color: '#edf2f8' },
    { x: -88, z: -22, h: 30, w: 5.8, d: 5.8, color: '#f4f7fb' },
    { x: 88, z: -22, h: 28, w: 5.8, d: 5.8, color: '#eff3f8' },
    { x: -86, z: 12, h: 22, w: 5, d: 5.2, color: '#f7f9fc' },
    { x: 86, z: 14, h: 22, w: 5, d: 5.2, color: '#f6f8fb' },
    { x: -78, z: 52, h: 20, w: 4.8, d: 5, color: '#f0f4fa' },
    { x: 78, z: 52, h: 20, w: 4.8, d: 5, color: '#eef3f8' },
    { x: -48, z: -78, h: 18, w: 4.6, d: 4.8, color: '#e7edf4' },
    { x: 48, z: -78, h: 18, w: 4.6, d: 4.8, color: '#e7edf4' },
    { x: -20, z: -84, h: 16, w: 4.2, d: 4.4, color: '#d35400' },
    { x: 20, z: -84, h: 16, w: 4.2, d: 4.4, color: '#2980b9' },
    { x: -12, z: 74, h: 18, w: 4.4, d: 4.4, color: '#f1f5fa' },
    { x: 12, z: 74, h: 18, w: 4.4, d: 4.4, color: '#f1f5fa' },
  ]), []);

  const perimeterBosquets = useMemo(() => (
    perimeterTowers.flatMap((tower, index) => {
      const r = Math.max(tower.w, tower.d) * 0.64 + 1.55;
      const offsets = [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
        [r * 0.74, r * 0.74],
        [-r * 0.74, r * 0.74],
      ];

      return offsets.map(([ox, oz], localIndex) => ({
        id: `${index}-${localIndex}`,
        x: tower.x + ox,
        z: tower.z + oz + centerZ,
        size: 0.88 + ((index + localIndex) % 3) * 0.2,
      }));
    })
  ), [perimeterTowers, centerZ]);

  const districtBosquetZones = useMemo(() => ([
    { cx: W + 30, cz: -20 + centerZ, rx: 20, rz: 15, count: 12 },
    { cx: -W - 30, cz: -20 + centerZ, rx: 20, rz: 15, count: 12 },
    { cx: 96, cz: 22 + centerZ, rx: 32, rz: 13, count: 14 },
    { cx: 0, cz: 54 + centerZ, rx: 36, rz: 13, count: 14 },
    { cx: 132, cz: -34 + centerZ, rx: 21, rz: 14, count: 10 },
    { cx: -132, cz: -34 + centerZ, rx: 21, rz: 14, count: 10 },
    { cx: 0, cz: -94 + centerZ, rx: 36, rz: 11, count: 12 },
  ]), [W, centerZ]);

  const districtBosquets = useMemo(() => (
    districtBosquetZones.flatMap((zone, zoneIndex) => (
      Array.from({ length: zone.count }, (_, i) => {
        const theta = (i / zone.count) * Math.PI * 2;
        return {
          id: `${zoneIndex}-${i}`,
          x: zone.cx + Math.cos(theta) * zone.rx,
          z: zone.cz + Math.sin(theta) * zone.rz,
          size: 0.9 + ((zoneIndex + i) % 4) * 0.18,
        };
      })
    ))
  ), [districtBosquetZones]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    flashRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const pulse = Math.max(0, Math.sin(t * 7 + index * 1.8));
      ref.material.emissiveIntensity = night ? 0.2 + pulse * 3.6 : 0.04 + pulse * 0.45;
      ref.material.opacity = night ? 0.12 + pulse * 0.22 : 0.04 + pulse * 0.08;
    });

    beaconRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = t * 2.4 + index;
      ref.material.emissiveIntensity = night ? 1.2 + Math.sin(t * 4 + index) * 0.6 : 0.08;
    });

    hallScreenRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 1.5 : 0.16) + Math.sin(t * 2.2 + index * 0.8) * (night ? 0.7 : 0.05);
    });

    droneRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const anchor = hallDroneAnchors[index] || hallDroneAnchors[0];
      const speed = 0.28 + index * 0.02;
      const angle = t * speed + index * 0.8;
      ref.position.x = 96 + anchor.x + Math.sin(angle) * 3.4;
      ref.position.z = centerZ + 56 + anchor.z + Math.cos(angle * 1.1) * 2.6;
      ref.position.y = anchor.y + Math.sin(angle * 1.8) * 0.9;
      ref.rotation.y = -angle + Math.PI * 0.1;
    });

    laserRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = Math.sin(t * 0.45 + index * 0.9) * 0.9 + index * 0.45;
      ref.rotation.z = Math.cos(t * 0.35 + index * 0.6) * 0.18;
      ref.material.opacity = night ? 0.08 + Math.abs(Math.sin(t * 1.8 + index)) * 0.12 : 0.02;
      ref.material.emissiveIntensity = night ? 1.4 + Math.abs(Math.sin(t * 2.2 + index)) * 1.4 : 0.08;
    });

    poiRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 1.8 : 0.2) + Math.sin(t * 2.1 + index * 0.7) * (night ? 0.6 : 0.05);
    });

    eventBannerRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 2.1 : 0.2) + Math.sin(t * 3 + index * 0.5) * (night ? 0.8 : 0.06);
    });

    districtShowRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = Math.sin(t * 0.42 + index * 0.7) * 0.8;
      ref.material.opacity = night ? 0.07 + Math.abs(Math.sin(t * 2 + index)) * 0.1 : 0.015;
      ref.material.emissiveIntensity = night ? 1.1 + Math.abs(Math.sin(t * 2.3 + index)) * 1.1 : 0.06;
    });

    skylineCrownRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 2 : 0.16) + Math.abs(Math.sin(t * 1.8 + index * 0.6)) * (night ? 1.4 : 0.08);
    });

    helipadBeaconRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = t * 2.8 + index;
      ref.material.emissiveIntensity = (night ? 1.8 : 0.14) + Math.abs(Math.sin(t * 2.6 + index)) * (night ? 1.4 : 0.06);
      ref.material.opacity = night ? 0.08 + Math.abs(Math.sin(t * 1.9 + index)) * 0.12 : 0.02;
    });

    sculptureGlowRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.rotation.y = t * 0.45 + index * 0.7;
      ref.material.emissiveIntensity = (night ? 1.5 : 0.12) + Math.abs(Math.sin(t * 2.1 + index)) * (night ? 1.2 : 0.05);
    });

    chauffeurLightRefs.current.forEach((ref, index) => {
      if (!ref) return;
      ref.material.emissiveIntensity = (night ? 1.3 : 0.08) + Math.abs(Math.sin(t * 3 + index * 0.8)) * (night ? 1.1 : 0.05);
    });

  });

  return (
    <group>
      {/* ═══════════════════════════════════════════ */}
      {/* ═══ PHASE 1 — 4 PORTS & QUAIS ═══ */}
      {/* ═══════════════════════════════════════════ */}

      {/* PORT NORD */}
      <group position={[0, 0, -H - 8 + centerZ]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[28, 0.5, 6]} /><meshStandardMaterial color={portColor} roughness={0.5} metalness={0.2} /></mesh>
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[28.2, 0.04, 6.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {[-12, -6, 0, 6, 12].map((x, i) => (
          <group key={`pn-b${i}`} position={[x, 0.55, -3]}>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.15, 0.2, 0.4, 8]} /><meshStandardMaterial color="#707880" metalness={0.7} roughness={0.2} /></mesh>
            <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.2, 0.15, 0.1, 8]} /><meshStandardMaterial color="#909aa0" metalness={0.6} /></mesh>
          </group>
        ))}
        {[-8, 0, 8].map((x, i) => (
          <group key={`pn-boat${i}`} position={[x, 0.1, -4]} rotation={[0, 0.3 * (i - 1), 0]}>
            <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.2, 0.35, 3]} /><meshStandardMaterial color={['#f0f0f5', '#2c3e50', '#ecf0f1'][i]} metalness={0.4} roughness={0.25} /></mesh>
            <mesh position={[0, 0.05, 0]}><boxGeometry args={[1.4, 0.2, 3.2]} /><meshStandardMaterial color={['#1a2a4a', '#c0392b', '#34495e'][i]} metalness={0.5} /></mesh>
          </group>
        ))}
      </group>

      {/* PORT SUD */}
      <group position={[0, 0, H + 8 + centerZ]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[28, 0.5, 6]} /><meshStandardMaterial color={portColor} roughness={0.5} metalness={0.2} /></mesh>
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[28.2, 0.04, 6.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {[-12, -6, 0, 6, 12].map((x, i) => (
          <group key={`ps-b${i}`} position={[x, 0.55, 3]}>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.15, 0.2, 0.4, 8]} /><meshStandardMaterial color="#707880" metalness={0.7} roughness={0.2} /></mesh>
          </group>
        ))}
        {[-8, 0, 8].map((x, i) => (
          <group key={`ps-boat${i}`} position={[x, 0.1, 4]} rotation={[0, 0.2 * (i - 1), 0]}>
            <mesh position={[0, 0.2, 0]}><boxGeometry args={[1, 0.3, 2.6]} /><meshStandardMaterial color={['#e8e8f0', '#1a1a2e', '#f5f0e8'][i]} metalness={0.4} roughness={0.25} /></mesh>
          </group>
        ))}
      </group>

      {/* PORT EST */}
      <group position={[W + 8, 0, centerZ]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[6, 0.5, 24]} /><meshStandardMaterial color={portColor} roughness={0.5} metalness={0.2} /></mesh>
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[6.2, 0.04, 24.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {[-10, -4, 2, 8].map((z, i) => (
          <group key={`pe-boat${i}`} position={[4, 0.1, z]} rotation={[0, Math.PI / 2 + 0.2 * (i - 1), 0]}>
            <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.1, 0.3, 2.8]} /><meshStandardMaterial color={['#f8f6f0', '#2c3e50', '#ecf0f1', '#1a1a2e'][i]} metalness={0.4} /></mesh>
          </group>
        ))}
      </group>

      {/* PORT OUEST */}
      <group position={[-W - 8, 0, centerZ]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[6, 0.5, 24]} /><meshStandardMaterial color={portColor} roughness={0.5} metalness={0.2} /></mesh>
        <mesh position={[0, 0.56, 0]}><boxGeometry args={[6.2, 0.04, 24.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
        {[-10, -4, 2, 8].map((z, i) => (
          <group key={`po-boat${i}`} position={[-4, 0.1, z]} rotation={[0, -Math.PI / 2 + 0.15 * (i - 1), 0]}>
            <mesh position={[0, 0.2, 0]}><boxGeometry args={[1, 0.3, 2.5]} /><meshStandardMaterial color={['#ecf0f1', '#f5f0e8', '#2c3e50', '#f0f0f5'][i]} metalness={0.4} /></mesh>
          </group>
        ))}
      </group>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ PHASE 2 — NATURE & EAU ═══ */}
      {/* ═══════════════════════════════════════════ */}

      {/* GRANDS ARBRES RONDS (24 arbres répartis) */}
      {[
        [-60, -40], [-45, -60], [-30, -20], [-15, -50], [15, -30], [30, -55],
        [50, -45], [65, -25], [-55, 20], [-35, 35], [40, 30], [60, 15],
        [-70, -10], [70, -5], [-50, -70], [50, -65], [-20, 40], [20, 45],
        [-65, -55], [65, -50], [-40, 10], [45, 8], [-10, -65], [10, -60],
      ].map(([x, z], i) => (
        <group key={`bigtree-${i}`} position={[x, 0, z + centerZ]}>
          <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.2, 0.3, 5, 8]} /><meshStandardMaterial color="#654321" roughness={0.9} /></mesh>
          <mesh position={[0, 5.5, 0]}><sphereGeometry args={[2.2 + (i % 3) * 0.4, 10, 10]} /><meshStandardMaterial color={night ? '#1a3020' : ['#2d7a2d', '#3a8a3a', '#228b22'][i % 3]} roughness={0.85} /></mesh>
        </group>
      ))}

      {/* VÉGÉTATION — haies et buissons le long des routes */}
      {[
        [-50, -35, 12], [-30, -35, 8], [-10, -35, 10], [10, -35, 8], [30, -35, 12],
        [-50, 55, 10], [-25, 55, 8], [0, 55, 12], [25, 55, 8], [50, 55, 10],
      ].map(([x, z, len], i) => (
        <mesh key={`hedge-${i}`} position={[x, 0.6, z + centerZ]}>
          <boxGeometry args={[len, 1.2, 1]} /><meshStandardMaterial color={night ? '#1a3a1e' : '#3a7a3a'} roughness={0.9} />
        </mesh>
      ))}

      {/* LAC CENTRAL — grand lac ovale */}
      <group position={[0, 0.05, 20 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[12, 24]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.7} roughness={0.02} metalness={0.3} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><ringGeometry args={[11.5, 12.5, 24]} /><meshStandardMaterial color={night ? '#4a5a6a' : '#b0b8c0'} roughness={0.5} /></mesh>
      </group>

      {/* LAC NORD — petit lac */}
      <group position={[-40, 0.05, -55 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[7, 18]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.7} roughness={0.02} metalness={0.3} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><ringGeometry args={[6.5, 7.5, 18]} /><meshStandardMaterial color={night ? '#4a5a6a' : '#b0b8c0'} roughness={0.5} /></mesh>
      </group>

      {/* FLEUVE — traverse la ville d'est en ouest */}
      <mesh position={[0, 0.04, -15 + centerZ]}><boxGeometry args={[W * 2 + 20, 0.08, 4]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.65} roughness={0.02} metalness={0.3} /></mesh>
      <mesh position={[0, 0.03, -15 + centerZ]}><boxGeometry args={[W * 2 + 22, 0.06, 5]} /><meshStandardMaterial color={night ? '#3a4a5a' : '#a0b0c0'} roughness={0.4} /></mesh>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ PHASE 3 — PONTS & PASSERELLES ═══ */}
      {/* ═══════════════════════════════════════════ */}

      {/* PONTS SUR LE FLEUVE (3 ponts blancs) */}
      {[-40, 0, 40].map((x, i) => (
        <group key={`bridge-${i}`} position={[x, 0, -15 + centerZ]}>
          {/* Tablier */}
          <mesh position={[0, 0.8, 0]}><boxGeometry args={[8, 0.3, 6]} /><meshStandardMaterial color={bridgeColor} roughness={0.2} metalness={0.15} /></mesh>
          {/* Garde-corps */}
          {[-3.8, 3.8].map((bx, bi) => (
            <mesh key={`bg-${bi}`} position={[bx, 1.3, 0]}><boxGeometry args={[0.08, 0.8, 6]} /><meshPhysicalMaterial color="#b0d0e8" transparent opacity={0.35} metalness={0.7} roughness={0.05} /></mesh>
          ))}
          {/* Piliers */}
          {[-2.5, 2.5].map((px, pi) => (
            <mesh key={`bp-${pi}`} position={[px, 0.3, 0]}><cylinderGeometry args={[0.2, 0.25, 0.8, 8]} /><meshStandardMaterial color={bridgeColor} roughness={0.3} metalness={0.2} /></mesh>
          ))}
        </group>
      ))}

      {/* PONT SUR LE LAC CENTRAL */}
      <group position={[0, 0, 20 + centerZ]}>
        <mesh position={[0, 0.7, 0]}><boxGeometry args={[26, 0.25, 3]} /><meshStandardMaterial color={bridgeColor} roughness={0.2} metalness={0.15} /></mesh>
        {[-12, -6, 0, 6, 12].map((x, i) => (
          <mesh key={`lbp-${i}`} position={[x, 0.3, 0]}><cylinderGeometry args={[0.15, 0.2, 0.6, 8]} /><meshStandardMaterial color={bridgeColor} roughness={0.3} /></mesh>
        ))}
      </group>

      {/* PASSERELLES AÉRIENNES (2 — nord-sud) */}
      {[-30, 30].map((x, i) => (
        <group key={`aerial-${i}`} position={[x, 0, centerZ]}>
          <mesh position={[0, 8, 0]}><boxGeometry args={[3, 0.2, 50]} /><meshStandardMaterial color={bridgeColor} roughness={0.2} metalness={0.15} /></mesh>
          <mesh position={[-1.4, 8.5, 0]}><boxGeometry args={[0.06, 0.8, 50]} /><meshPhysicalMaterial color="#b0d0e8" transparent opacity={0.3} metalness={0.7} /></mesh>
          <mesh position={[1.4, 8.5, 0]}><boxGeometry args={[0.06, 0.8, 50]} /><meshPhysicalMaterial color="#b0d0e8" transparent opacity={0.3} metalness={0.7} /></mesh>
          {[-22, -14, -6, 2, 10, 18].map((z, pi) => (
            <mesh key={`ap-${pi}`} position={[0, 4, z]}><cylinderGeometry args={[0.15, 0.2, 8, 8]} /><meshStandardMaterial color={bridgeColor} roughness={0.3} /></mesh>
          ))}
        </group>
      ))}

      {/* TUNNEL BÉTON BLANC (traverse sous les rails nord) */}
      <group position={[0, -0.5, -H - 2 + centerZ]}>
        <mesh position={[0, 0, 0]}><boxGeometry args={[16, 3, 4]} /><meshStandardMaterial color={bridgeColor} roughness={0.2} /></mesh>
        <mesh position={[0, 0, 0]}><boxGeometry args={[15, 2.4, 3.4]} /><meshStandardMaterial color={night ? '#1a2030' : '#3a3a4a'} roughness={0.5} /></mesh>
        {/* Entrées éclairées */}
        {[-8.1, 8.1].map((x, i) => (
          <mesh key={`tent-${i}`} position={[x, 0.2, 0]}><boxGeometry args={[0.3, 2.6, 3.6]} /><meshStandardMaterial color={bridgeColor} roughness={0.2} /></mesh>
        ))}
        <mesh position={[0, 1.3, 2.1]}><boxGeometry args={[14, 0.2, 0.2]} /><meshStandardMaterial color="#a0d8ff" emissive="#a0d8ff" emissiveIntensity={night ? 2 : 0.15} /></mesh>
      </group>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ FAUNE PROCHE DES PLAGES ═══ */}
      {/* ═══════════════════════════════════════════ */}

      {/* Oiseaux posés près des plages (12) */}
      {[
        [-50, -H - 4], [-38, -H - 6], [-22, -H - 3], [-8, -H - 5], [8, -H - 4], [22, -H - 6],
        [-45, H + 4], [-28, H + 5], [-10, H + 3], [10, H + 6], [28, H + 4], [42, H + 5],
      ].map(([x, z], i) => (
        <group key={`bird-${i}`} position={[x, 0.3, z + centerZ]}>
          <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.12, 6, 6]} /><meshStandardMaterial color={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#808080' : '#4a3a2a'} /></mesh>
          <mesh position={[0.1, 0.12, 0]}><coneGeometry args={[0.03, 0.1, 4]} /><meshStandardMaterial color="#f0a030" /></mesh>
        </group>
      ))}

      {/* Tortues de mer près des plages (4) */}
      {[[-30, -H - 8], [20, -H - 7], [-25, H + 9], [15, H + 8]].map(([x, z], i) => (
        <group key={`turtle-${i}`} position={[x, 0.08, z + centerZ]}>
          <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.3, 8, 6]} /><meshStandardMaterial color="#5a7a4a" roughness={0.9} /></mesh>
          <mesh position={[0, 0.05, 0.25]}><sphereGeometry args={[0.1, 6, 6]} /><meshStandardMaterial color="#7a9a6a" roughness={0.8} /></mesh>
        </group>
      ))}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ STADE — Zone EST ═══ */}
      {/* ═══════════════════════════════════════════ */}
      <group position={[W + 30, 0, -20 + centerZ]}>
        {/* Structure ovale du stade */}
        <mesh position={[0, 4, 0]}><cylinderGeometry args={[18, 20, 8, 24]} /><meshStandardMaterial color={night ? '#2a3040' : '#e0e4e8'} roughness={0.4} metalness={0.3} /></mesh>
        {/* Intérieur — pelouse */}
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[15, 24]} /><meshStandardMaterial color={night ? '#1a3a20' : '#3a8a40'} roughness={0.95} /></mesh>
        {/* Piste athlétisme */}
        <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[13, 15, 24]} /><meshStandardMaterial color={night ? '#6a3020' : '#c05030'} roughness={0.7} /></mesh>
        {/* Gradins intérieurs */}
        {[0, 1, 2, 3].map(tier => (
          <mesh key={`grad-${tier}`} position={[0, tier * 1.5 + 1, 0]}><cylinderGeometry args={[16 + tier * 0.8, 16 + tier * 0.8, 1.2, 24]} /><meshStandardMaterial color={night ? '#3a3a42' : '#c8ccd0'} roughness={0.5} /></mesh>
        ))}
        {/* Toit partiel */}
        <mesh position={[0, 8.5, 0]}><torusGeometry args={[19, 2, 4, 24]} /><meshStandardMaterial color={night ? '#2a3040' : '#d8dce4'} roughness={0.3} metalness={0.3} /></mesh>
        {/* Projecteurs (4) */}
        {[[-16, 16], [16, 16], [16, -16], [-16, -16]].map(([fx, fz], i) => (
          <group key={`proj-${i}`} position={[fx, 0, fz]}>
            <mesh position={[0, 10, 0]}><cylinderGeometry args={[0.2, 0.3, 20, 6]} /><meshStandardMaterial color="#b0b4b8" metalness={0.7} /></mesh>
            <mesh position={[0, 20.5, 0]}><boxGeometry args={[2, 0.6, 1]} /><meshStandardMaterial color="#f0f0e8" emissive="#FFD700" emissiveIntensity={night ? 4 : 1} /></mesh>
          </group>
        ))}
        <mesh position={[0, 10.2, 18.8]}><boxGeometry args={[18, 1.3, 0.18]} /><meshStandardMaterial color="#13243a" metalness={0.28} roughness={0.16} /></mesh>
        <mesh ref={(el) => { eventBannerRefs.current[1] = el; }} position={[0, 10.2, 18.98]}><boxGeometry args={[17.2, 0.82, 0.08]} /><meshStandardMaterial color="#17324f" emissive="#ffd870" emissiveIntensity={night ? 2.2 : 0.18} /></mesh>
        <Text position={[0, 10.22, 19.1]} fontSize={0.48} color="#ffffff" anchorX="center" fontWeight="bold">ARENA LIVE TONIGHT</Text>
        {[[-10, 18, '#41d8ff'], [10, 18, '#ffd870']].map(([x, z, color], index) => (
          <mesh key={`stadium-show-beam-${index}`} ref={(el) => { districtShowRefs.current[index] = el; }} position={[x, 18.2, z + centerZ]} rotation={[Math.PI / 2.8, index === 0 ? -0.4 : 0.4, 0]}>
            <coneGeometry args={[2, 34, 16, 1, true]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={night ? 1.8 : 0.08} transparent opacity={night ? 0.08 : 0.02} side={2} />
          </mesh>
        ))}
        {/* Parking stade */}
        <mesh position={[24, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[12, 20]} /><meshStandardMaterial color={night ? '#2a2e34' : '#808488'} roughness={0.8} /></mesh>
      </group>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ CENTRE COMMERCIAL — Zone OUEST ═══ */}
      {/* ═══════════════════════════════════════════ */}
      <group position={[-W - 30, 0, -20 + centerZ]}>
        {/* Bâtiment principal vitré — 2 ailes + atrium */}
        <mesh position={[0, 5, 0]}><boxGeometry args={[28, 10, 18]} /><meshPhysicalMaterial color={night ? '#0d1530' : '#c0d0e0'} metalness={0.82} roughness={0.04} clearcoat={1} clearcoatRoughness={0.04} transparent opacity={0.58} transmission={0.08} /></mesh>
        {/* Dalles étages */}
        {[0, 3.5, 7].map(y => <mesh key={`cd-${y}`} position={[0, y + 0.5, 0]}><boxGeometry args={[28.2, 0.15, 18.2]} /><meshStandardMaterial color={night ? '#2a3050' : '#e8ecf0'} metalness={0.4} /></mesh>)}
        {/* Atrium central vitré */}
        <mesh position={[0, 8, 0]}><cylinderGeometry args={[4, 5, 6, 12]} /><meshPhysicalMaterial color={night ? '#0a2050' : '#a0c8e8'} transparent opacity={0.4} metalness={0.8} roughness={0.04} /></mesh>
        <mesh position={[0, 11.2, 0]}><sphereGeometry args={[4.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color={night ? '#0a2050' : '#b0d8f0'} transparent opacity={0.35} metalness={0.7} /></mesh>
        {/* Enseigne */}
        <mesh position={[0, 10.5, 9.1]}><boxGeometry args={[14, 1.2, 0.1]} /><meshStandardMaterial color="#1a5fa8" emissive="#1a8aff" emissiveIntensity={night ? 3 : 0.4} /></mesh>
        <Text position={[0, 10.5, 9.2]} fontSize={0.7} color="#ffffff" anchorX="center" fontWeight="bold">MEGA MALL</Text>
        <mesh ref={(el) => { hallScreenRefs.current[2] = el; }} position={[0, 6.2, 9.08]}><boxGeometry args={[12, 4.2, 0.08]} /><meshStandardMaterial color="#17324f" emissive="#ff7fd6" emissiveIntensity={night ? 1.8 : 0.16} /></mesh>
        <Text position={[0, 6.22, 9.16]} fontSize={0.46} color="#ffffff" anchorX="center" fontWeight="bold">CITY LIFESTYLE DISTRICT</Text>
        {[-9, -3, 3, 9].map((x, i) => (
          <mesh key={`mall-storefront-${i}`} position={[x, 2.2, 9.12]}><planeGeometry args={[4.6, 3.6]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.52} metalness={0.62} roughness={0.03} transmission={0.24} clearcoat={1} clearcoatRoughness={0.04} /></mesh>
        ))}
        {[-4.5, 4.5].map((x, i) => (
          <mesh key={`mall-door-${i}`} position={[x, 1.6, 9.16]}><boxGeometry args={[2.4, 3.2, 0.12]} /><meshStandardMaterial color={i === 0 ? '#dff6ff' : '#4b535c'} emissive={i === 0 ? '#7ce7ff' : '#000000'} emissiveIntensity={night && i === 0 ? 0.9 : 0} metalness={0.7} roughness={0.08} transparent opacity={i === 0 ? 0.52 : 1} /></mesh>
        ))}
        {[[-8, 10, '#ff7fd6'], [8, 10, '#7ce7ff']].map(([x, z, color], index) => (
          <mesh key={`mall-show-beam-${index}`} ref={(el) => { districtShowRefs.current[index + 2] = el; }} position={[x, 13.2, z + centerZ]} rotation={[Math.PI / 2.9, index === 0 ? -0.35 : 0.35, 0]}>
            <coneGeometry args={[1.7, 26, 16, 1, true]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={night ? 1.5 : 0.08} transparent opacity={night ? 0.07 : 0.02} side={2} />
          </mesh>
        ))}
        {/* Entrée */}
        <mesh position={[0, 2, 9.1]}><boxGeometry args={[6, 4, 0.05]} /><meshPhysicalMaterial color={night ? '#0a1a30' : '#b0d0e8'} transparent opacity={0.35} metalness={0.8} /></mesh>
        {/* Parking centre commercial */}
        <mesh position={[-18, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[10, 18]} /><meshPhysicalMaterial color={night ? '#2a2e34' : '#808488'} roughness={0.68} metalness={0.04} clearcoat={0.08} clearcoatRoughness={0.92} /></mesh>
        {/* Voitures parking (8) */}
        {[[-20, -6], [-20, -3], [-20, 0], [-20, 3], [-16, -6], [-16, -3], [-16, 0], [-16, 3]].map(([cx, cz], ci) => (
          <mesh key={`mcar-${ci}`} position={[cx, 0.4, cz]}><boxGeometry args={[1.6, 0.5, 0.9]} /><meshStandardMaterial color={['#cc0000', '#0066cc', '#333', '#fff', '#FFD700', '#1a1a1a', '#0088aa', '#880044'][ci]} metalness={0.5} roughness={0.3} /></mesh>
        ))}
      </group>

      {/* ═══ QUARTIERS AJOUTÉS — résidentiel et logistique ═══ */}
      <group position={[132, 0, -34 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><planeGeometry args={[44, 30]} /><meshStandardMaterial color={night ? '#314336' : '#88ad79'} roughness={0.95} /></mesh>
        {[-14, 0, 14].map((x, row) => (
          [-8, 8].map((z, houseIndex) => (
            <group key={`east-house-${row}-${houseIndex}`} position={[x, 0, z]}>
              <mesh position={[0, 2.2, 0]}><boxGeometry args={[7.2, 4.4, 6.2]} /><meshStandardMaterial color={night ? '#273140' : ['#f0f3f7', '#e8edf2', '#f7f1e8'][houseIndex % 3]} roughness={0.45} metalness={0.14} /></mesh>
              <mesh position={[0, 5.4, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[5.6, 2.8, 4]} /><meshStandardMaterial color={night ? '#5a3c34' : '#9d6b5b'} roughness={0.72} /></mesh>
              <mesh position={[0, 2.5, 3.18]}><planeGeometry args={[4.8, 2.4]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.45} metalness={0.5} roughness={0.04} /></mesh>
              <mesh position={[0, 0.95, 3.2]}><boxGeometry args={[1.6, 1.9, 0.12]} /><meshStandardMaterial color={houseIndex % 2 === 0 ? '#dff6ff' : '#4b535c'} emissive={houseIndex % 2 === 0 ? '#7ce7ff' : '#000000'} emissiveIntensity={night && houseIndex % 2 === 0 ? 0.8 : 0} metalness={0.68} roughness={0.08} transparent opacity={houseIndex % 2 === 0 ? 0.5 : 1} /></mesh>
              <mesh position={[0, 3.35, 3.05]}><boxGeometry args={[3.4, 0.18, 1.2]} /><meshStandardMaterial color={night ? '#eef5fb' : '#ffffff'} roughness={0.18} metalness={0.14} /></mesh>
              <mesh position={[0, 3.7, 3.5]}><boxGeometry args={[3.2, 0.72, 0.08]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.5} metalness={0.5} roughness={0.04} /></mesh>
              <mesh position={[0, 3.62, 2.82]}><boxGeometry args={[1.8, 0.18, 0.6]} /><meshStandardMaterial color={night ? '#31503b' : '#7da36c'} roughness={0.9} /></mesh>
              <mesh position={[-1.8, 2.45, 3.18]}><planeGeometry args={[1.1, 1.3]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.38} metalness={0.46} roughness={0.04} /></mesh>
              <mesh position={[1.8, 2.45, 3.18]}><planeGeometry args={[1.1, 1.3]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.38} metalness={0.46} roughness={0.04} /></mesh>
              <mesh position={[0, 0.06, -4.8]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.5, 3.6]} /><meshStandardMaterial color={night ? '#43484e' : '#c2b9a6'} roughness={0.94} /></mesh>
            </group>
          ))
        ))}
      </group>

      <group position={[-132, 0, -34 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><planeGeometry args={[44, 30]} /><meshStandardMaterial color={night ? '#304235' : '#86aa77'} roughness={0.95} /></mesh>
        {[-14, 0, 14].map((x, row) => (
          [-8, 8].map((z, houseIndex) => (
            <group key={`west-house-${row}-${houseIndex}`} position={[x, 0, z]}>
              <mesh position={[0, 2.1, 0]}><boxGeometry args={[6.8, 4.2, 5.8]} /><meshStandardMaterial color={night ? '#25303d' : ['#eaeef4', '#f5efe5', '#edf4f1'][row % 3]} roughness={0.45} metalness={0.14} /></mesh>
              <mesh position={[0, 5.15, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[5.2, 2.6, 4]} /><meshStandardMaterial color={night ? '#594137' : '#91614f'} roughness={0.72} /></mesh>
              <mesh position={[0, 2.4, 2.98]}><planeGeometry args={[4.2, 2.2]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.42} metalness={0.5} roughness={0.04} /></mesh>
              <mesh position={[0, 0.92, 3.02]}><boxGeometry args={[1.55, 1.84, 0.12]} /><meshStandardMaterial color={houseIndex % 2 === 0 ? '#dff6ff' : '#4b535c'} emissive={houseIndex % 2 === 0 ? '#7ce7ff' : '#000000'} emissiveIntensity={night && houseIndex % 2 === 0 ? 0.8 : 0} metalness={0.68} roughness={0.08} transparent opacity={houseIndex % 2 === 0 ? 0.5 : 1} /></mesh>
              <mesh position={[0, 3.15, 2.88]}><boxGeometry args={[3.1, 0.18, 1.1]} /><meshStandardMaterial color={night ? '#eef5fb' : '#ffffff'} roughness={0.18} metalness={0.14} /></mesh>
              <mesh position={[0, 3.48, 3.28]}><boxGeometry args={[2.9, 0.68, 0.08]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.5} metalness={0.5} roughness={0.04} /></mesh>
              <mesh position={[0, 3.4, 2.66]}><boxGeometry args={[1.6, 0.18, 0.56]} /><meshStandardMaterial color={night ? '#31503b' : '#7da36c'} roughness={0.9} /></mesh>
              <mesh position={[-1.55, 2.3, 2.98]}><planeGeometry args={[0.95, 1.2]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.36} metalness={0.46} roughness={0.04} /></mesh>
              <mesh position={[1.55, 2.3, 2.98]}><planeGeometry args={[0.95, 1.2]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.36} metalness={0.46} roughness={0.04} /></mesh>
              <mesh position={[0, 0.06, -4.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.2, 3.4]} /><meshStandardMaterial color={night ? '#43484e' : '#c5bea8'} roughness={0.94} /></mesh>
            </group>
          ))
        ))}
      </group>

      <group position={[0, 0, -94 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}><planeGeometry args={[74, 24]} /><meshStandardMaterial color={night ? '#4a4d50' : '#aeb4ba'} roughness={0.9} /></mesh>
        {[-20, 0, 20].map((x, i) => (
          <group key={`warehouse-${i}`} position={[x, 0, 0]}>
            <mesh position={[0, 5, 0]}><boxGeometry args={[16, 10, 10]} /><meshStandardMaterial color={night ? '#283241' : '#d6dde5'} roughness={0.42} metalness={0.22} /></mesh>
            <mesh position={[0, 10.4, 0]}><boxGeometry args={[16.4, 0.24, 10.4]} /><meshStandardMaterial color={night ? '#415061' : '#eef3f8'} metalness={0.3} roughness={0.18} /></mesh>
            <mesh position={[0, 2.8, 5.08]}><planeGeometry args={[7.6, 4.4]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.34} metalness={0.44} roughness={0.04} /></mesh>
            <mesh position={[0, 2.1, 5.12]}><boxGeometry args={[6.2, 3.8, 0.14]} /><meshStandardMaterial color="#4b535c" metalness={0.8} roughness={0.12} /></mesh>
            {[-4.4, 4.4].map((wx, wi) => (
              <mesh key={`warehouse-side-window-${wi}`} position={[wx, 3.4, 5.1]}><planeGeometry args={[1.8, 2]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.36} metalness={0.42} roughness={0.04} /></mesh>
            ))}
          </group>
        ))}
        {[-26, -18, -10, 10, 18, 26].map((x, i) => (
          <mesh key={`container-${i}`} position={[x, 0.9, i % 2 === 0 ? -8 : 8]}><boxGeometry args={[5.2, 1.8, 2.2]} /><meshStandardMaterial color={['#c05030', '#2980b9', '#16a085', '#8e44ad', '#f39c12', '#7f8c8d'][i]} roughness={0.5} metalness={0.22} /></mesh>
        ))}
      </group>

      {/* Repères premium / points d’intérêt */}
      {[
        { x: 96, z: 32 + centerZ, label: 'HALL LIVE', color: '#41d8ff' },
        { x: 0, z: -2 + centerZ, label: 'GARE CENTRALE', color: '#7ce7ff' },
        { x: 112, z: -20 + centerZ, label: 'STADE', color: '#ffd870' },
        { x: -112, z: -20 + centerZ, label: 'MEGA MALL', color: '#ff7fd6' },
        { x: 0, z: 60 + centerZ, label: 'AURORA PALACE', color: '#ffd870' },
        { x: 0, z: 42 + centerZ, label: 'GRAND BOULEVARD', color: '#ff7fd6' },
      ].map((poi, index) => (
        <group key={`poi-${index}`} position={[poi.x, 0, poi.z]}>
          <mesh position={[0, 3, 0]}><boxGeometry args={[0.3, 6, 0.3]} /><meshStandardMaterial color="#d5dde5" metalness={0.92} roughness={0.08} /></mesh>
          <mesh ref={(el) => { poiRefs.current[index] = el; }} position={[0, 6.7, 0]}><boxGeometry args={[7.4, 1.1, 0.12]} /><meshStandardMaterial color="#15304b" emissive={poi.color} emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
          <Text position={[0, 6.72, 0.18]} fontSize={0.42} color="#ffffff" anchorX="center" fontWeight="bold">{poi.label}</Text>
        </group>
      ))}

      {/* District événementiel continu autour du hall sud */}
      <group position={[96, 0, 22 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[64, 24]} /><meshStandardMaterial color={night ? '#4a4f56' : '#d7d3ca'} roughness={0.92} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}><ringGeometry args={[4.2, 7.6, 32]} /><meshStandardMaterial color={night ? '#243444' : '#b9c6d2'} roughness={0.4} /></mesh>
        <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[4.2, 4.6, 0.44, 24]} /><meshStandardMaterial color={night ? '#dbe4eb' : '#f4f7fa'} roughness={0.28} /></mesh>
        <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[3.4, 3.6, 0.14, 24]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.76} roughness={0.02} metalness={0.32} /></mesh>
        <mesh position={[0, 1.9, 0]}><cylinderGeometry args={[0.18, 0.22, 3.2, 10]} /><meshStandardMaterial color="#d8e0e8" metalness={0.9} roughness={0.08} /></mesh>
        <mesh position={[0, 3.65, 0]}><sphereGeometry args={[0.42, 10, 10]} /><meshStandardMaterial color="#7ce7ff" emissive="#7ce7ff" emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
      </group>

      {[[-22, 'CAPTURE HOTEL'], [22, 'SKY SUITES']].map(([x, label], index) => (
        <group key={`live-hotel-${index}`} position={[96 + x, 0, 26 + centerZ]}>
          <mesh position={[0, 11, 0]}><boxGeometry args={[12, 22, 12]} /><meshPhysicalMaterial color={night ? '#16283a' : '#dfe9f0'} transparent opacity={0.76} metalness={0.64} roughness={0.05} clearcoat={1} clearcoatRoughness={0.05} transmission={0.06} /></mesh>
          <mesh position={[0, 22.4, 0]}><boxGeometry args={[13, 0.32, 13]} /><meshStandardMaterial color={night ? '#223244' : '#f3f6f9'} roughness={0.18} metalness={0.28} /></mesh>
          <mesh position={[0, 20.2, 6.08]}><boxGeometry args={[8.8, 1, 0.12]} /><meshStandardMaterial color="#17324f" emissive={index === 0 ? '#41d8ff' : '#ffd870'} emissiveIntensity={night ? 2.1 : 0.16} /></mesh>
          <Text position={[0, 20.24, 6.24]} fontSize={0.46} color="#ffffff" anchorX="center" fontWeight="bold">{label}</Text>
          <mesh position={[0, 1.8, 6.1]}><boxGeometry args={[4.4, 3.2, 0.14]} /><meshStandardMaterial color="#dff6ff" emissive="#7ce7ff" emissiveIntensity={night ? 0.9 : 0.06} transparent opacity={0.52} metalness={0.7} roughness={0.08} /></mesh>
          {[4.2, 8.2, 12.2, 16.2].map((y, bi) => (
            <group key={`hotel-balcony-${bi}`} position={[0, y, 6.08]}>
              <mesh position={[0, 0, -0.6]}><boxGeometry args={[8.4, 0.16, 1.2]} /><meshStandardMaterial color={night ? '#eef5fb' : '#ffffff'} roughness={0.16} metalness={0.14} /></mesh>
              <mesh position={[0, 0.42, 0]}><boxGeometry args={[8.1, 0.76, 0.08]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.52} metalness={0.5} roughness={0.04} /></mesh>
              <mesh position={[0, 0.14, -0.74]}><boxGeometry args={[2.6, 0.18, 0.56]} /><meshStandardMaterial color={night ? '#31503b' : '#7da36c'} roughness={0.9} /></mesh>
            </group>
          ))}
          {[-3.6, -1.2, 1.2, 3.6].map((wx, wi) => (
            <mesh key={`hotel-window-${wi}`} position={[wx, 11, 6.12]}><planeGeometry args={[1.4, 16]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.44} metalness={0.52} roughness={0.04} /></mesh>
          ))}
        </group>
      ))}

      {[[-24, 'NEON LOUNGE'], [24, 'DINING DECK']].map(([x, label], index) => (
        <group key={`district-restaurant-${index}`} position={[96 + x, 0, 8 + centerZ]}>
          <mesh position={[0, 1.6, 0]}><boxGeometry args={[18, 3.2, 10]} /><meshPhysicalMaterial color={night ? '#1d2c3b' : '#f5f2eb'} transparent opacity={0.76} metalness={0.38} roughness={0.05} clearcoat={0.72} clearcoatRoughness={0.08} transmission={0.04} /></mesh>
          <mesh position={[0, 3.4, 0]}><boxGeometry args={[18.6, 0.24, 10.6]} /><meshStandardMaterial color={night ? '#2b3746' : '#ffffff'} roughness={0.18} metalness={0.24} /></mesh>
          <mesh position={[0, 2.9, 5.08]}><boxGeometry args={[9.5, 0.9, 0.12]} /><meshStandardMaterial color="#17324f" emissive={index === 0 ? '#ff56d6' : '#7ce7ff'} emissiveIntensity={night ? 1.9 : 0.14} /></mesh>
          <Text position={[0, 2.92, 5.22]} fontSize={0.42} color="#ffffff" anchorX="center" fontWeight="bold">{label}</Text>
          {[-6, -2, 2, 6].map((wx, wi) => (
            <mesh key={`restaurant-window-${wi}`} position={[wx, 1.8, 5.08]}><planeGeometry args={[2.2, 2.2]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.48} metalness={0.46} roughness={0.04} /></mesh>
          ))}
          <mesh position={[0, 1.5, 5.14]}><boxGeometry args={[3.2, 2.8, 0.14]} /><meshStandardMaterial color={index === 0 ? '#dff6ff' : '#4b535c'} emissive={index === 0 ? '#7ce7ff' : '#000000'} emissiveIntensity={night && index === 0 ? 0.8 : 0} metalness={0.7} roughness={0.08} transparent opacity={index === 0 ? 0.48 : 1} /></mesh>
          {[-5, 0, 5].map((tx, ti) => (
            <group key={`terrace-table-${ti}`} position={[tx, 0, -1.5]}>
              <mesh position={[0, 0.86, 0]}><cylinderGeometry args={[0.86, 0.92, 0.12, 14]} /><meshStandardMaterial color="#f4f7fa" roughness={0.18} /></mesh>
              <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.08, 0.1, 0.8, 8]} /><meshStandardMaterial color="#cfd7df" metalness={0.82} roughness={0.08} /></mesh>
              {[-1.2, 1.2].map((cx, ci) => (
                <mesh key={`chair-${ci}`} position={[cx, 0.5, 0.1]}><boxGeometry args={[0.55, 0.9, 0.55]} /><meshStandardMaterial color={index === 0 ? '#ffb0e6' : '#d7f4ff'} roughness={0.3} /></mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* ═══ PACK VILLE PREMIUM — Grand Palace Boulevard ═══ */}
      <group position={[0, 0, 54 + centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}><planeGeometry args={[74, 30]} /><meshStandardMaterial color={night ? '#4a4741' : '#ddd4c7'} roughness={0.94} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 10.5]}><planeGeometry args={[46, 8]} /><meshStandardMaterial color={night ? '#333840' : '#c4ccd4'} roughness={0.8} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 10.5]}><planeGeometry args={[44, 0.24]} /><meshStandardMaterial color="#d4a020" emissive="#d4a020" emissiveIntensity={night ? 0.9 : 0.04} /></mesh>
        {[-16, -6, 6, 16].map((x, index) => (
          <group key={`chauffeur-bollard-${index}`} position={[x, 0, 13.8]}>
            <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.18, 0.22, 1.3, 10]} /><meshStandardMaterial color="#d9e1e8" metalness={0.92} roughness={0.08} /></mesh>
            <mesh ref={(el) => { chauffeurLightRefs.current[index] = el; }} position={[0, 1.35, 0]}><sphereGeometry args={[0.18, 10, 10]} /><meshStandardMaterial color={index % 2 === 0 ? '#ffd870' : '#7ce7ff'} emissive={index % 2 === 0 ? '#ffd870' : '#7ce7ff'} emissiveIntensity={night ? 1.6 : 0.1} /></mesh>
          </group>
        ))}

        <group>
          <mesh position={[0, 3.4, 0]}><boxGeometry args={[28, 6.8, 22]} /><meshPhysicalMaterial color={night ? '#163048' : '#eef4f8'} transparent opacity={0.8} metalness={0.6} roughness={0.05} clearcoat={1} clearcoatRoughness={0.05} transmission={0.08} /></mesh>
          <mesh position={[0, 17.5, 0]}><boxGeometry args={[18, 28, 14]} /><meshPhysicalMaterial color={night ? '#17314b' : '#dfeaf1'} transparent opacity={0.76} metalness={0.68} roughness={0.05} clearcoat={1} clearcoatRoughness={0.04} transmission={0.08} /></mesh>
          <mesh position={[0, 31.7, 0]}><boxGeometry args={[19.5, 0.34, 15.5]} /><meshStandardMaterial color={night ? '#f0f5fa' : '#ffffff'} roughness={0.16} metalness={0.22} /></mesh>
          <mesh ref={(el) => { skylineCrownRefs.current[0] = el; }} position={[0, 28.6, 7.08]}><boxGeometry args={[10.8, 1.1, 0.12]} /><meshStandardMaterial color="#17324f" emissive="#ffd870" emissiveIntensity={night ? 2.4 : 0.16} /></mesh>
          <Text position={[0, 28.62, 7.2]} fontSize={0.5} color="#ffffff" anchorX="center" fontWeight="bold">AURORA PALACE</Text>
          {[-5.2, -1.7, 1.7, 5.2].map((x, index) => (
            <mesh key={`grand-palace-window-${index}`} position={[x, 17.6, 7.12]}><planeGeometry args={[1.5, 22]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.44} metalness={0.54} roughness={0.04} /></mesh>
          ))}
          {[-5.2, -1.7, 1.7, 5.2].map((x, index) => (
            <mesh key={`grand-palace-back-window-${index}`} position={[x, 17.6, -7.12]}><planeGeometry args={[1.5, 22]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.36} metalness={0.5} roughness={0.04} /></mesh>
          ))}
          {[6.2, 12.4, 18.6, 24.8].map((y, index) => (
            <group key={`grand-palace-balcony-${index}`} position={[0, y, 7.1]}>
              <mesh position={[0, 0, -0.72]}><boxGeometry args={[10.4, 0.16, 1.44]} /><meshStandardMaterial color={night ? '#eef5fb' : '#ffffff'} roughness={0.14} metalness={0.12} /></mesh>
              <mesh position={[0, 0.42, 0]}><boxGeometry args={[10.1, 0.78, 0.08]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.54} metalness={0.52} roughness={0.04} /></mesh>
            </group>
          ))}
          <mesh position={[0, 2.2, 11.1]}><boxGeometry args={[6.8, 3.6, 0.14]} /><meshStandardMaterial color="#dff6ff" emissive="#7ce7ff" emissiveIntensity={night ? 0.9 : 0.06} transparent opacity={0.54} metalness={0.72} roughness={0.08} /></mesh>
          <mesh position={[0, 1.4, 11.28]}><cylinderGeometry args={[1.9, 1.9, 2.4, 18]} /><meshStandardMaterial color={night ? '#f4f7fa' : '#ffffff'} roughness={0.16} metalness={0.1} /></mesh>
          <mesh position={[0, 31.95, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[5.2, 32]} /><meshStandardMaterial color={night ? '#cad5df' : '#f4f7fa'} roughness={0.18} metalness={0.18} /></mesh>
          <mesh position={[0, 32.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.6, 4.8, 32]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
          <Text position={[0, 32.08, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color={night ? '#17324f' : '#31516b'} anchorX="center" fontWeight="bold">H</Text>
          {[0, 1].map((index) => (
            <mesh key={`helipad-beam-${index}`} ref={(el) => { helipadBeaconRefs.current[index] = el; }} position={[0, 34.8, 0]} rotation={[Math.PI / 2.9, index === 0 ? 0 : Math.PI / 2, 0]}>
              <coneGeometry args={[1.9, 22, 18, 1, true]} />
              <meshStandardMaterial color={index === 0 ? '#7ce7ff' : '#ffd870'} emissive={index === 0 ? '#7ce7ff' : '#ffd870'} emissiveIntensity={night ? 2.2 : 0.12} transparent opacity={night ? 0.1 : 0.02} side={2} />
            </mesh>
          ))}
          <group position={[0, 31.95, -2.2]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[7.2, 3.2]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.78} roughness={0.02} metalness={0.3} /></mesh>
            {[-2.4, 0, 2.4].map((x, index) => (
              <group key={`pool-light-${index}`} position={[x, 0, 3.35]}>
                <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.14, 0.18, 0.16, 12]} /><meshStandardMaterial color="#dfe7ee" metalness={0.68} roughness={0.14} /></mesh>
                <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color={index === 1 ? '#ffd870' : '#7ce7ff'} emissive={index === 1 ? '#ffd870' : '#7ce7ff'} emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
              </group>
            ))}
          </group>
        </group>

        {[-24, 24].map((x, index) => (
          <group key={`couture-house-${index}`} position={[x, 0, -1]}>
            <mesh position={[0, 3.2, 0]}><boxGeometry args={[15, 6.4, 12]} /><meshPhysicalMaterial color={night ? '#1f3143' : '#f4efe8'} transparent opacity={0.72} metalness={0.38} roughness={0.08} /></mesh>
            <mesh position={[0, 6.7, 0]}><boxGeometry args={[15.6, 0.24, 12.6]} /><meshStandardMaterial color={night ? '#f0f5fa' : '#ffffff'} roughness={0.16} metalness={0.18} /></mesh>
            <mesh ref={(el) => { skylineCrownRefs.current[index + 1] = el; }} position={[0, 5.1, 6.08]}><boxGeometry args={[9.4, 0.92, 0.12]} /><meshStandardMaterial color="#17324f" emissive={index === 0 ? '#ff7fd6' : '#7ce7ff'} emissiveIntensity={night ? 2 : 0.14} /></mesh>
            <Text position={[0, 5.12, 6.24]} fontSize={0.42} color="#ffffff" anchorX="center" fontWeight="bold">{index === 0 ? 'COUTURE ROW' : 'SKY LOUNGE'}</Text>
            {[-4.8, -1.6, 1.6, 4.8].map((wx, wi) => (
              <mesh key={`couture-window-${wi}`} position={[wx, 2.8, 6.12]}><planeGeometry args={[2, 3.1]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.48} metalness={0.46} roughness={0.04} /></mesh>
            ))}
            <mesh position={[0, 1.7, 6.16]}><boxGeometry args={[3.2, 3.4, 0.14]} /><meshStandardMaterial color={index === 0 ? '#4b535c' : '#dff6ff'} emissive={index === 0 ? '#000000' : '#7ce7ff'} emissiveIntensity={night && index === 1 ? 0.8 : 0} metalness={0.74} roughness={0.08} transparent opacity={index === 1 ? 0.48 : 1} /></mesh>
            {[-4.4, 0, 4.4].map((tx, ti) => (
              <group key={`couture-planter-${ti}`} position={[tx, 0, -4.2]}>
                <mesh position={[0, 0.45, 0]}><boxGeometry args={[2.6, 0.9, 1.2]} /><meshStandardMaterial color={night ? '#e7edf3' : '#ffffff'} roughness={0.2} metalness={0.12} /></mesh>
                <mesh position={[0, 1.32, 0]}><sphereGeometry args={[0.88, 10, 10]} /><meshStandardMaterial color={night ? '#284b30' : '#75a562'} roughness={0.88} /></mesh>
              </group>
            ))}
          </group>
        ))}

        <group position={[0, 0, -8]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}><planeGeometry args={[24, 12]} /><meshStandardMaterial color={night ? '#dfe6ec' : '#f7f8fa'} roughness={0.26} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}><ringGeometry args={[2.6, 5.2, 32]} /><meshStandardMaterial color={night ? '#203548' : '#c9d4dd'} roughness={0.24} /></mesh>
          <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[2.6, 2.9, 0.36, 24]} /><meshPhysicalMaterial color={waterColor} transparent opacity={0.74} roughness={0.02} metalness={0.3} /></mesh>
          <mesh ref={(el) => { sculptureGlowRefs.current[0] = el; }} position={[0, 2.8, 0]} rotation={[0, 0.3, 0]}><torusKnotGeometry args={[1.1, 0.22, 84, 12]} /><meshStandardMaterial color="#f4f7fa" emissive="#ffd870" emissiveIntensity={night ? 1.7 : 0.12} metalness={0.82} roughness={0.14} /></mesh>
          <mesh ref={(el) => { sculptureGlowRefs.current[1] = el; }} position={[0, 3.9, 0]} rotation={[0.4, 0, 0]}><torusGeometry args={[0.8, 0.12, 10, 24]} /><meshStandardMaterial color="#dff6ff" emissive="#7ce7ff" emissiveIntensity={night ? 1.4 : 0.1} metalness={0.72} roughness={0.1} /></mesh>
          {[-7.5, -2.5, 2.5, 7.5].map((x, index) => (
            <group key={`plaza-bench-${index}`} position={[x, 0, 4.1]}>
              <mesh position={[0, 0.45, 0]}><boxGeometry args={[2.4, 0.14, 0.5]} /><meshStandardMaterial color="#d7c1a2" roughness={0.38} /></mesh>
              <mesh position={[0, 0.88, -0.18]}><boxGeometry args={[2.4, 0.86, 0.12]} /><meshStandardMaterial color="#d7c1a2" roughness={0.38} /></mesh>
            </group>
          ))}
        </group>

        <group position={[0, 0, 11.5]}>
          {[-10, 10].map((x, index) => (
            <group key={`valet-limo-${index}`} position={[x, 0, 0]} rotation={[0, index === 0 ? 0.16 : -0.18, 0]}>
              <mesh position={[0, 0.7, 0]}><boxGeometry args={[6.4, 1.1, 2.1]} /><meshStandardMaterial color={index === 0 ? '#11151d' : '#e8edf2'} metalness={0.5} roughness={0.18} /></mesh>
              <mesh position={[0, 1.2, 0]}><boxGeometry args={[3.2, 0.7, 1.7]} /><meshStandardMaterial color={index === 0 ? '#0d1f35' : '#f7f9fb'} metalness={0.46} roughness={0.16} /></mesh>
              {[-2.4, 2.4].map((wheelX, wheelIndex) => (
                <group key={`valet-wheel-${wheelIndex}`} position={[wheelX, 0.26, wheelIndex === 0 ? -0.95 : 0.95]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.42, 0.42, 0.32, 12]} /><meshStandardMaterial color="#101010" roughness={0.7} /></mesh>
                </group>
              ))}
              <mesh position={[2.98, 0.72, 0]}><boxGeometry args={[0.16, 0.24, 1.2]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
              <mesh position={[-2.98, 0.72, 0]}><boxGeometry args={[0.16, 0.24, 1.2]} /><meshStandardMaterial color="#ff5f5f" emissive="#ff5f5f" emissiveIntensity={night ? 0.9 : 0.04} /></mesh>
            </group>
          ))}
          <AnimatedPedestrian position={[-12.6, 0.52, -1.1]} scale={1.02} bodyColor="#0b1020" skinColor="#c78d67" build="broad" headwear="helmet" gesture="point" moveMode="guard" moveRadius={0.08} pace={0.7} phase={0.2} dataTestId="grand-palace-valet-security-left" />
          <AnimatedPedestrian position={[12.6, 0.52, -1.1]} scale={1.02} bodyColor="#0b1020" skinColor="#c78d67" build="broad" headwear="helmet" gesture="point" moveMode="guard" moveRadius={0.08} pace={0.7} phase={0.8} dataTestId="grand-palace-valet-security-right" />
          <AnimatedPedestrian position={[-4.4, 0.52, 1.8]} scale={0.98} bodyColor="#ffffff" skinColor="#f1c39f" build="slim" carry="bag" phone gesture="phone" moveMode="queue" moveRadius={0.3} pace={0.8} phase={0.4} dataTestId="grand-palace-arrival-guest-a" />
          <AnimatedPedestrian position={[4.2, 0.52, 1.4]} scale={1.02} bodyColor="#1f365a" skinColor="#d69972" build="regular" carry="bag" gesture="wave" moveMode="queue" moveRadius={0.3} pace={0.76} phase={1} dataTestId="grand-palace-arrival-guest-b" />
        </group>

        {[0, 1, 2, 3, 4, 5].map((index) => (
          <AnimatedPedestrian
            key={`grand-palace-boulevard-walker-${index}`}
            position={[-26 + index * 10.4, 0.52, index % 2 === 0 ? -2.2 : 2.2]}
            scale={index % 3 === 0 ? 0.92 : 0.98}
            bodyColor={['#ffffff', '#2a3c5c', '#7d1e52', '#145f53', '#101010', '#d9e4ef'][index]}
            skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b', '#e7bc97', '#d69972'][index]}
            accentColor={index % 2 === 0 ? '#7ce7ff' : '#ffd870'}
            variant={index % 2 === 0 ? 'chatting' : 'casual'}
            gesture={['talk', 'phone', 'wave', 'none', 'talk', 'phone'][index]}
            moveMode="flow"
            route={[1, 0]}
            moveRadius={4.2 + (index % 2) * 1.1}
            pace={0.74 + index * 0.04}
            phase={index * 0.6}
            dataTestId={`grand-palace-boulevard-walker-${index}`}
          />
        ))}
      </group>

      {/* Promenades inter-zones et flux piétons */}
      <mesh position={[46, 0.11, 12 + centerZ]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[14, 64]} /><meshStandardMaterial color={night ? '#394146' : '#dad6ca'} roughness={0.92} /></mesh>
      <mesh position={[78, 0.11, 34 + centerZ]} rotation={[-Math.PI / 2, 0.22, 0]}><planeGeometry args={[18, 44]} /><meshStandardMaterial color={night ? '#3a4248' : '#d8d4c8'} roughness={0.92} /></mesh>
      <mesh position={[-78, 0.11, 16 + centerZ]} rotation={[-Math.PI / 2, -0.18, 0]}><planeGeometry args={[18, 48]} /><meshStandardMaterial color={night ? '#3a4248' : '#d8d4c8'} roughness={0.92} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <AnimatedPedestrian
          key={`promenade-central-${i}`}
          position={[46 + (i % 2 === 0 ? -2.2 : 2.2), 0.52, centerZ + 10 + i * 8]}
          scale={0.9}
          bodyColor={['#ffffff', '#2a3c5c', '#6b3d3d', '#145f53', '#67458e', '#101010'][i]}
          skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b', '#e7bc97', '#d69972'][i]}
          variant={i % 2 === 0 ? 'casual' : 'chatting'}
          gesture={['none', 'talk', 'phone', 'none', 'wave', 'talk'][i]}
          moveMode="flow"
          route={[0, 1]}
          moveRadius={7 + (i % 3) * 2}
          pace={0.7 + i * 0.04}
          phase={i * 0.8}
          dataTestId={`promenade-central-${i}`}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <AnimatedPedestrian
          key={`promenade-east-${i}`}
          position={[82 + i * 2.6, 0.52, centerZ + 20 + i * 5]}
          scale={0.88}
          bodyColor={['#edf2f7', '#1f365a', '#7a4d1d', '#3d1f63'][i]}
          skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b'][i]}
          variant={i % 2 === 0 ? 'relaxed' : 'fast'}
          gesture={['talk', 'none', 'point', 'phone'][i]}
          moveMode="flow"
          route={[0.45, 1]}
          moveRadius={6 + i}
          pace={0.78 + i * 0.05}
          phase={i * 0.7}
          dataTestId={`promenade-east-${i}`}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <AnimatedPedestrian
          key={`promenade-west-${i}`}
          position={[-80 - i * 2.8, 0.52, centerZ + 4 + i * 6]}
          scale={0.88}
          bodyColor={['#ffffff', '#2f405a', '#7d1e52', '#101010'][i]}
          skinColor={['#e7bc97', '#d99972', '#f5d0b3', '#b77d5b'][i]}
          variant={i % 2 === 0 ? 'chatting' : 'casual'}
          gesture={['phone', 'talk', 'none', 'wave'][i]}
          moveMode="flow"
          route={[-0.55, 1]}
          moveRadius={6 + i}
          pace={0.76 + i * 0.04}
          phase={i * 0.9}
          dataTestId={`promenade-west-${i}`}
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <AnimatedPedestrian
          key={`district-plaza-walker-${i}`}
          position={[86 + i * 4, 0.52, centerZ + 20 + (i % 2 === 0 ? -2 : 2)]}
          scale={0.92}
          bodyColor={['#ffffff', '#2a3c5c', '#7d1e52', '#145f53', '#101010', '#67458e'][i]}
          skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b', '#e7bc97', '#d69972'][i]}
          variant={i % 3 === 0 ? 'chatting' : i % 3 === 1 ? 'relaxed' : 'casual'}
          gesture={['talk', 'none', 'phone', 'wave', 'talk', 'none'][i]}
          moveMode="shuffle"
          moveRadius={0.22}
          pace={0.78 + i * 0.04}
          phase={i * 0.65}
          dataTestId={`district-plaza-walker-${i}`}
        />
      ))}
      {[
        [-86, centerZ - 50, 'child', 'cap', true, false, '#f2f4f8', '#f1c39f'],
        [-72, centerZ - 30, 'slim', 'hood', false, true, '#7d1e52', '#e7bc97'],
        [-58, centerZ + 18, 'broad', 'none', true, false, '#2a3c5c', '#d99972'],
        [-28, centerZ - 64, 'regular', 'cap', false, true, '#145f53', '#f5d0b3'],
        [-12, centerZ - 26, 'child', 'none', false, false, '#ffffff', '#b77d5b'],
        [12, centerZ - 12, 'slim', 'helmet', false, false, '#d9e4ef', '#f1c39f'],
        [26, centerZ + 24, 'regular', 'hood', true, true, '#7a4d1d', '#d69972'],
        [42, centerZ - 58, 'broad', 'none', false, false, '#101010', '#e7bc97'],
        [62, centerZ - 32, 'child', 'cap', true, false, '#3d1f63', '#f5d0b3'],
        [78, centerZ + 6, 'slim', 'hood', false, true, '#edf2f7', '#b77d5b'],
        [104, centerZ - 42, 'regular', 'cap', true, false, '#1f365a', '#e7bc97'],
        [124, centerZ - 14, 'broad', 'none', true, false, '#6b3d3d', '#d99972'],
        [-118, centerZ + 8, 'regular', 'cap', true, false, '#f3f5f8', '#f1c39f'],
        [-96, centerZ + 36, 'child', 'hood', false, false, '#2f405a', '#d69972'],
        [-44, centerZ + 44, 'slim', 'none', false, true, '#7a1d52', '#f5d0b3'],
        [0, centerZ + 40, 'broad', 'helmet', false, false, '#20344f', '#b77d5b'],
        [54, centerZ + 46, 'child', 'cap', true, false, '#ffffff', '#f1c39f'],
        [108, centerZ + 34, 'slim', 'hood', false, true, '#145f53', '#e7bc97'],
      ].map(([x, z, build, headwear, backpack, phone, bodyColor, skinColor], i) => (
        <AnimatedPedestrian
          key={`new-world-mixed-ped-${i}`}
          position={[x, 0.52, z]}
          scale={build === 'child' ? 0.74 : build === 'broad' ? 1.08 : build === 'slim' ? 0.92 : 0.98}
          bodyColor={bodyColor}
          skinColor={skinColor}
          accentColor={i % 3 === 0 ? '#7ce7ff' : i % 3 === 1 ? '#ffd870' : '#ff7fd6'}
          shoeColor="#111111"
          build={build}
          headwear={headwear}
          backpack={Boolean(backpack)}
          phone={Boolean(phone)}
          variant={build === 'child' ? 'casual' : build === 'broad' ? 'relaxed' : 'chatting'}
          gesture={phone ? 'phone' : i % 4 === 0 ? 'talk' : i % 4 === 1 ? 'wave' : 'none'}
          moveMode={i % 3 === 0 ? 'flow' : 'shuffle'}
          route={i % 2 === 0 ? [1, 0.4] : [-0.8, 1]}
          moveRadius={build === 'child' ? 3.2 : 4.4}
          pace={build === 'child' ? 1.05 : build === 'broad' ? 0.7 : 0.86 + i * 0.015}
          phase={i * 0.58}
          dataTestId={`new-world-mixed-ped-${i}`}
        />
      ))}
      {/* Groupes thématiques — familles, voyageurs, staff, VIP, sécurité, artistes */}
      {[
        { x: -36, z: centerZ + 14, scale: 1.02, build: 'slim', body: '#f3f5f8', skin: '#f1c39f', headwear: 'none', backpack: true, phone: false, gesture: 'talk', label: 'family-parent-a' },
        { x: -33.4, z: centerZ + 15.8, scale: 0.78, build: 'child', body: '#2a3c5c', skin: '#d99972', headwear: 'cap', backpack: true, phone: false, gesture: 'wave', label: 'family-child-a' },
        { x: -39.8, z: centerZ + 16.4, scale: 0.82, build: 'child', body: '#ff7fd6', skin: '#f5d0b3', headwear: 'hood', backpack: false, phone: false, gesture: 'none', label: 'family-child-b' },
        { x: -42.5, z: centerZ + 13.6, scale: 0.96, build: 'broad', body: '#145f53', skin: '#b77d5b', headwear: 'none', backpack: false, phone: true, gesture: 'phone', label: 'family-parent-b' },

        { x: 8, z: centerZ - 2, scale: 0.96, build: 'slim', body: '#20344f', skin: '#e7bc97', headwear: 'cap', backpack: true, phone: true, gesture: 'phone', label: 'traveler-a' },
        { x: 12.4, z: centerZ - 4.6, scale: 1.02, build: 'regular', body: '#ffffff', skin: '#f1c39f', headwear: 'none', backpack: true, phone: false, gesture: 'talk', label: 'traveler-b' },
        { x: 16.8, z: centerZ - 7.2, scale: 1.08, build: 'broad', body: '#7a4d1d', skin: '#d69972', headwear: 'hood', backpack: false, phone: false, gesture: 'none', label: 'traveler-c' },

        { x: 74, z: centerZ + 20, scale: 0.96, build: 'regular', body: '#22324d', skin: '#f1c39f', headwear: 'helmet', backpack: false, phone: false, gesture: 'point', label: 'staff-a' },
        { x: 78, z: centerZ + 22.4, scale: 0.98, build: 'broad', body: '#2b313b', skin: '#d99972', headwear: 'helmet', backpack: true, phone: false, gesture: 'talk', label: 'staff-b' },
        { x: 82, z: centerZ + 24.8, scale: 0.94, build: 'slim', body: '#edf2f7', skin: '#f5d0b3', headwear: 'cap', backpack: false, phone: true, gesture: 'phone', label: 'staff-c' },

        { x: 96, z: centerZ + 27.5, scale: 0.96, build: 'slim', body: '#f3f5f8', skin: '#e7bc97', headwear: 'cap', backpack: false, phone: true, gesture: 'phone', label: 'vip-a' },
        { x: 100, z: centerZ + 26.2, scale: 1.04, build: 'regular', body: '#1f365a', skin: '#d69972', headwear: 'none', backpack: false, phone: false, gesture: 'wave', label: 'vip-b' },
        { x: 103.8, z: centerZ + 28.4, scale: 0.9, build: 'child', body: '#ffffff', skin: '#f1c39f', headwear: 'cap', backpack: true, phone: false, gesture: 'none', label: 'vip-child' },

        { x: 88, z: centerZ + 31, scale: 1.04, build: 'broad', body: '#0b1020', skin: '#c78d67', headwear: 'helmet', backpack: false, phone: false, gesture: 'point', label: 'security-a' },
        { x: 108, z: centerZ + 31, scale: 1.04, build: 'broad', body: '#0b1020', skin: '#c78d67', headwear: 'helmet', backpack: false, phone: false, gesture: 'point', label: 'security-b' },

        { x: 114, z: centerZ + 8, scale: 0.96, build: 'slim', body: '#7a1d52', skin: '#f5d0b3', headwear: 'none', backpack: false, phone: true, gesture: 'talk', label: 'artist-a' },
        { x: 118, z: centerZ + 10.2, scale: 1.02, build: 'regular', body: '#151515', skin: '#d99972', headwear: 'hood', backpack: false, phone: false, gesture: 'wave', label: 'artist-b' },
      ].map((person, i) => (
        <AnimatedPedestrian
          key={`thematic-group-${person.label}`}
          position={[person.x, 0.52, person.z]}
          scale={person.scale}
          bodyColor={person.body}
          skinColor={person.skin}
          accentColor={i % 2 === 0 ? '#7ce7ff' : '#ffd870'}
          build={person.build}
          headwear={person.headwear}
          backpack={person.backpack}
          phone={person.phone}
          variant={person.build === 'broad' ? 'relaxed' : person.build === 'child' ? 'casual' : 'chatting'}
          gesture={person.gesture}
          moveMode={person.label.includes('security') ? 'guard' : person.label.includes('traveler') ? 'flow' : 'shuffle'}
          route={person.label.includes('traveler') ? [1, 0.35] : [0.4, 1]}
          moveRadius={person.build === 'child' ? 2.2 : person.label.includes('security') ? 0.1 : 2.8}
          pace={person.build === 'child' ? 0.95 : person.label.includes('security') ? 0.7 : 0.84 + i * 0.015}
          phase={i * 0.5}
          dataTestId={`thematic-group-${person.label}`}
        />
      ))}
      {/* Micro-scènes humaines lisibles */}
      <group>
        <AnimatedPedestrian position={[-8, 0.52, centerZ + 18]} scale={1} bodyColor="#f3f5f8" skinColor="#f1c39f" build="slim" backpack headwear="none" gesture="talk" moveMode="flow" route={[1, 0.15]} moveRadius={2.4} pace={0.82} phase={0.1} dataTestId="family-crossing-parent-1" />
        <AnimatedPedestrian position={[-5.2, 0.52, centerZ + 19.1]} scale={0.78} bodyColor="#2a3c5c" skinColor="#d99972" build="child" headwear="cap" backpack gesture="wave" moveMode="flow" route={[1, 0.15]} moveRadius={2.1} pace={0.92} phase={0.6} dataTestId="family-crossing-child" />
        <AnimatedPedestrian position={[-11.1, 0.52, centerZ + 16.8]} scale={0.98} bodyColor="#145f53" skinColor="#b77d5b" build="regular" phone carry="bag" gesture="phone" moveMode="flow" route={[1, 0.15]} moveRadius={2.3} pace={0.8} phase={1.1} dataTestId="family-crossing-parent-2" />
      </group>

      <group>
        <AnimatedPedestrian position={[96, 0.52, centerZ + 30.5]} scale={0.98} bodyColor="#f3f5f8" skinColor="#e7bc97" build="slim" headwear="cap" phone gesture="phone" moveMode="flow" route={[0, 1]} moveRadius={2.2} pace={0.8} phase={0.2} dataTestId="vip-escort-vip" />
        <AnimatedPedestrian position={[92.8, 0.52, centerZ + 29.8]} scale={1.04} bodyColor="#0b1020" skinColor="#c78d67" build="broad" headwear="helmet" gesture="point" moveMode="guard" moveRadius={0.1} pace={0.7} phase={0.5} dataTestId="vip-escort-security-left" />
        <AnimatedPedestrian position={[99.2, 0.52, centerZ + 31.2]} scale={1.04} bodyColor="#0b1020" skinColor="#c78d67" build="broad" headwear="helmet" gesture="point" moveMode="guard" moveRadius={0.1} pace={0.7} phase={1.1} dataTestId="vip-escort-security-right" />
      </group>

      <group>
        <AnimatedPedestrian position={[73, 0.52, centerZ + 23]} scale={0.98} bodyColor="#22324d" skinColor="#f1c39f" build="regular" headwear="helmet" gesture="talk" moveMode="flow" route={[1, 0.35]} moveRadius={2.4} pace={0.78} phase={0.4} dataTestId="technician-case-a" />
        <AnimatedPedestrian position={[76.4, 0.52, centerZ + 24.6]} scale={1.02} bodyColor="#2b313b" skinColor="#d99972" build="broad" headwear="helmet" backpack gesture="point" moveMode="flow" route={[1, 0.35]} moveRadius={2.6} pace={0.74} phase={0.9} dataTestId="technician-case-b" />
      </group>

      <group>
        <AnimatedPedestrian position={[6, 0.52, centerZ - 8]} scale={0.98} bodyColor="#20344f" skinColor="#e7bc97" build="slim" headwear="cap" backpack phone gesture="phone" moveMode="flow" route={[1, -0.2]} moveRadius={2.8} pace={0.82} phase={0.3} dataTestId="traveler-luggage-a" />
        <AnimatedPedestrian position={[11, 0.52, centerZ - 10.6]} scale={1.04} bodyColor="#ffffff" skinColor="#f1c39f" build="regular" backpack gesture="talk" moveMode="flow" route={[1, -0.2]} moveRadius={3} pace={0.8} phase={0.8} dataTestId="traveler-luggage-b" />
        <AnimatedPedestrian position={[15.6, 0.52, centerZ - 13]} scale={1.08} bodyColor="#7a4d1d" skinColor="#d69972" build="broad" headwear="hood" gesture="none" moveMode="flow" route={[1, -0.2]} moveRadius={3.2} pace={0.74} phase={1.3} dataTestId="traveler-luggage-c" />
      </group>

      {/* Scènes quotidiennes par zone */}
      <group>
        <AnimatedPedestrian position={[90, 0.52, centerZ + 20.5]} scale={0.74} bodyColor="#2a3c5c" skinColor="#f1c39f" build="child" headwear="cap" gesture="wave" moveMode="shuffle" moveRadius={1.4} pace={1.02} phase={0.2} dataTestId="fountain-kid-a" />
        <AnimatedPedestrian position={[101, 0.52, centerZ + 19.6]} scale={0.76} bodyColor="#ff7fd6" skinColor="#d99972" build="child" headwear="hood" gesture="none" moveMode="shuffle" moveRadius={1.3} pace={1.05} phase={0.7} dataTestId="fountain-kid-b" />
        <AnimatedPedestrian position={[95.4, 0.52, centerZ + 24.2]} scale={0.98} bodyColor="#f3f5f8" skinColor="#e7bc97" build="slim" backpack gesture="talk" moveMode="shuffle" moveRadius={1.2} pace={0.8} phase={1.1} dataTestId="fountain-parent" />
      </group>

      <group>
        <AnimatedPedestrian position={[-116, 0.52, centerZ - 6]} scale={0.96} bodyColor="#ffffff" skinColor="#f1c39f" build="slim" carry="bag" gesture="talk" moveMode="flow" route={[1, 0.2]} moveRadius={2.1} pace={0.82} phase={0.3} dataTestId="mall-exit-shopper-a" />
        <AnimatedPedestrian position={[-111.5, 0.52, centerZ - 8]} scale={1} bodyColor="#7a1d52" skinColor="#d99972" build="regular" carry="bag" phone gesture="phone" moveMode="flow" route={[1, 0.2]} moveRadius={2.3} pace={0.78} phase={0.8} dataTestId="mall-exit-shopper-b" />
        <AnimatedPedestrian position={[-106.8, 0.52, centerZ - 10]} scale={0.78} bodyColor="#2f405a" skinColor="#f5d0b3" build="child" headwear="cap" backpack gesture="wave" moveMode="flow" route={[1, 0.2]} moveRadius={2} pace={0.96} phase={1.2} dataTestId="mall-exit-child" />
      </group>

      <group>
        <AnimatedPedestrian position={[84, 0.52, centerZ + 24]} scale={0.98} bodyColor="#1f365a" skinColor="#f1c39f" build="slim" phone gesture="phone" moveMode="queue" moveRadius={0.7} pace={0.76} phase={0.4} dataTestId="hall-taxi-wait-a" />
        <AnimatedPedestrian position={[87.4, 0.52, centerZ + 25.6]} scale={1.02} bodyColor="#7a4d1d" skinColor="#d69972" build="regular" gesture="talk" moveMode="queue" moveRadius={0.7} pace={0.72} phase={1.0} dataTestId="hall-taxi-wait-b" />
      </group>

      <group>
        <AnimatedPedestrian position={[92, 0.52, centerZ + 29.2]} scale={1.02} bodyColor="#0b1020" skinColor="#c78d67" build="broad" headwear="helmet" gesture="point" moveMode="guard" moveRadius={0.08} pace={0.7} phase={0.3} dataTestId="vip-check-security" />
        <AnimatedPedestrian position={[95.6, 0.52, centerZ + 28.6]} scale={0.98} bodyColor="#f3f5f8" skinColor="#e7bc97" build="slim" headwear="cap" phone carry="bag" gesture="phone" moveMode="queue" moveRadius={0.45} pace={0.8} phase={0.9} dataTestId="vip-check-guest" />
      </group>

      <group>
        <AnimatedPedestrian position={[-6, 0.52, centerZ - 6]} scale={0.96} bodyColor="#20344f" skinColor="#f1c39f" build="slim" gesture="none" moveMode="queue" moveRadius={0.55} pace={0.74} phase={0.5} dataTestId="station-wait-a" />
        <AnimatedPedestrian position={[-1.8, 0.52, centerZ - 7.4]} scale={1.04} bodyColor="#ffffff" skinColor="#d99972" build="regular" backpack phone gesture="phone" moveMode="queue" moveRadius={0.55} pace={0.78} phase={1.0} dataTestId="station-wait-b" />
        <AnimatedPedestrian position={[2.4, 0.52, centerZ - 8.8]} scale={1.08} bodyColor="#7a4d1d" skinColor="#f5d0b3" build="broad" gesture="talk" moveMode="queue" moveRadius={0.55} pace={0.7} phase={1.5} dataTestId="station-wait-c" />
      </group>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ GRAND HALL VITRÉ SUD — emplacement capture ═══ */}
      {/* ═══════════════════════════════════════════ */}
      <group position={[96, 0, 56 + centerZ]} rotation={[0, -0.06, 0]}>
        {/* Socle / dalle */}
        <mesh position={[0, 0.22, 0]}><boxGeometry args={[56, 0.44, 34]} /><meshStandardMaterial color={night ? '#d7dde2' : '#f7f8fa'} roughness={0.26} metalness={0.08} /></mesh>
        <mesh position={[0, 0.36, 0]}><boxGeometry args={[52, 0.08, 30]} /><meshStandardMaterial color="#c6b170" emissive="#c6b170" emissiveIntensity={night ? 0.4 : 0.05} /></mesh>

        {/* Structure fer brillante */}
        {[-24, -12, 0, 12, 24].map((x, i) => (
          <group key={`hall-frame-${i}`} position={[x, 0, 0]}>
            <mesh position={[0, 10.5, -2]}><cylinderGeometry args={[0.28, 0.36, 21, 10]} /><meshStandardMaterial color="#c6d1db" metalness={0.95} roughness={0.1} /></mesh>
            <mesh position={[0, 21.1, -2]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[15, 0.28, 10, 24, Math.PI]} /><meshStandardMaterial color="#d7e0e8" metalness={0.98} roughness={0.08} /></mesh>
          </group>
        ))}
        {[-24, 24].map((x, i) => (
          <mesh key={`hall-side-rail-${i}`} position={[x, 21.2, -1]}><boxGeometry args={[0.45, 0.32, 30]} /><meshStandardMaterial color="#c8d2dc" metalness={0.96} roughness={0.08} /></mesh>
        ))}
        <mesh position={[0, 21.2, -16]}><boxGeometry args={[48, 0.32, 0.45]} /><meshStandardMaterial color="#c8d2dc" metalness={0.96} roughness={0.08} /></mesh>
        <mesh position={[0, 21.2, 12]}><boxGeometry args={[48, 0.32, 0.45]} /><meshStandardMaterial color="#c8d2dc" metalness={0.96} roughness={0.08} /></mesh>

        {/* Toit et enveloppe verre — grande ouverture devant */}
        <mesh position={[0, 20.4, -2]}><boxGeometry args={[48, 0.24, 28]} /><meshPhysicalMaterial color={night ? '#89cfff' : '#d8f5ff'} transparent opacity={0.18} transmission={0.88} metalness={0.22} roughness={0.02} clearcoat={1} /></mesh>
        <mesh position={[0, 10.5, -15.8]}><boxGeometry args={[47.5, 20, 0.16]} /><meshPhysicalMaterial color={night ? '#75c6ff' : '#cdefff'} transparent opacity={0.22} transmission={0.9} metalness={0.16} roughness={0.02} /></mesh>
        <mesh position={[-24.1, 10.5, -2]}><boxGeometry args={[0.16, 20, 28]} /><meshPhysicalMaterial color={night ? '#75c6ff' : '#cdefff'} transparent opacity={0.22} transmission={0.9} metalness={0.16} roughness={0.02} /></mesh>
        <mesh position={[24.1, 10.5, -2]}><boxGeometry args={[0.16, 20, 28]} /><meshPhysicalMaterial color={night ? '#75c6ff' : '#cdefff'} transparent opacity={0.22} transmission={0.9} metalness={0.16} roughness={0.02} /></mesh>
        <mesh position={[0, 9.5, -2]}><boxGeometry args={[0.18, 18, 26]} /><meshPhysicalMaterial color={night ? '#7fd0ff' : '#d6f4ff'} transparent opacity={0.24} transmission={0.9} metalness={0.14} roughness={0.02} /></mesh>

        {/* Partie gauche — zone DJ / podium */}
        <group position={[-12, 0, -1]}>
          <mesh position={[0, 1.6, -8]}><boxGeometry args={[17, 3.2, 9.5]} /><meshPhysicalMaterial color={night ? '#9edcff' : '#e9fbff'} transparent opacity={0.28} transmission={0.9} metalness={0.2} roughness={0.02} /></mesh>
          <mesh position={[0, 3.28, -8]}><boxGeometry args={[17.4, 0.18, 9.9]} /><meshStandardMaterial color="#a7f0ff" emissive="#86e9ff" emissiveIntensity={night ? 2.1 : 0.18} /></mesh>
          <mesh position={[0, 1.4, 5.4]}><cylinderGeometry args={[8.2, 9, 2.8, 28]} /><meshStandardMaterial color={night ? '#edf2f7' : '#ffffff'} roughness={0.18} metalness={0.12} /></mesh>
          <mesh position={[0, 3.12, 4.8]}><boxGeometry args={[13, 1.2, 2.8]} /><meshStandardMaterial color="#ffffff" roughness={0.12} metalness={0.1} /></mesh>
          <mesh ref={(el) => { hallScreenRefs.current[0] = el; }} position={[0, 4.05, 1.2]}><boxGeometry args={[17, 7.2, 0.24]} /><meshStandardMaterial color="#0d1f35" emissive="#1a8aff" emissiveIntensity={night ? 2.4 : 0.18} /></mesh>
          {[-7.2, 7.2].map((sx, i) => (
            <group key={`dj-speaker-${i}`} position={[sx, 2.6, -0.4]}>
              <mesh><boxGeometry args={[2.8, 5.2, 2.4]} /><meshStandardMaterial color="#10141b" metalness={0.35} roughness={0.5} /></mesh>
              <mesh position={[0, 0.8, 1.25]}><circleGeometry args={[0.72, 16]} /><meshStandardMaterial color="#1b2533" emissive="#1b2533" /></mesh>
              <mesh position={[0, -0.8, 1.25]}><circleGeometry args={[0.92, 16]} /><meshStandardMaterial color="#202f44" emissive="#3cbfff" emissiveIntensity={night ? 0.7 : 0.04} /></mesh>
            </group>
          ))}
        </group>

        {/* Partie droite — scène voix / micros / écran suspendu */}
        <group position={[12, 0, -1]}>
          <mesh position={[0, 1.7, -7.5]}><boxGeometry args={[17, 3.4, 10.5]} /><meshPhysicalMaterial color={night ? '#a6e8ff' : '#effcff'} transparent opacity={0.28} transmission={0.92} metalness={0.18} roughness={0.02} /></mesh>
          <mesh position={[0, 3.45, -7.5]}><boxGeometry args={[17.4, 0.18, 10.9]} /><meshStandardMaterial color="#a7f0ff" emissive="#86e9ff" emissiveIntensity={night ? 2.1 : 0.18} /></mesh>
          <mesh position={[0, 3.55, -7.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[16, 9.4]} /><meshPhysicalMaterial color={night ? '#8fe8ff' : '#f4fdff'} transparent opacity={0.18} transmission={0.92} metalness={0.16} roughness={0.02} /></mesh>
          {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
            <group key={`mic-stand-${i}`} position={[x, 0, 4.6]}>
              <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.06, 0.08, 3.6, 8]} /><meshStandardMaterial color="#c8d2dc" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 3.6, 0.15]} rotation={[0.45, 0, 0]}><cylinderGeometry args={[0.04, 0.05, 0.8, 8]} /><meshStandardMaterial color="#d9e1e8" metalness={0.9} roughness={0.1} /></mesh>
              <mesh position={[0, 3.95, 0.42]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#1b1d22" metalness={0.45} roughness={0.55} /></mesh>
            </group>
          ))}
          <mesh ref={(el) => { hallScreenRefs.current[1] = el; }} position={[0, 14.6, -0.5]}><boxGeometry args={[14.5, 5.8, 0.35]} /><meshStandardMaterial color="#0b1220" emissive="#173b72" emissiveIntensity={night ? 1.6 : 0.12} /></mesh>
          {[-4.5, 4.5].map((x, i) => (
            <mesh key={`screen-hanger-${i}`} position={[x, 17.4, -0.5]}><boxGeometry args={[0.12, 5.6, 0.12]} /><meshStandardMaterial color="#cfd7df" metalness={0.95} roughness={0.08} /></mesh>
          ))}
        </group>

        {/* Ambiance premium — éclairages gauche / DJ */}
        <group position={[-12, 0, -1]}>
          <mesh position={[0, 18.2, 4]}><boxGeometry args={[16, 0.4, 1.4]} /><meshStandardMaterial color="#cad4dd" metalness={0.95} roughness={0.08} /></mesh>
          {[-6, -2, 2, 6].map((x, i) => (
            <group key={`dj-light-${i}`} position={[x, 17.2, 4.2]}>
              <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.45, 0.55, 0.9, 10]} /><meshStandardMaterial color="#dce5ec" metalness={0.94} roughness={0.08} /></mesh>
              <mesh position={[0, -5.5, 1.4]} rotation={[Math.PI / 2.8, 0, 0]}><coneGeometry args={[1.8, 12, 16, 1, true]} /><meshStandardMaterial color={i % 2 === 0 ? '#41d8ff' : '#ff56d6'} emissive={i % 2 === 0 ? '#41d8ff' : '#ff56d6'} emissiveIntensity={night ? 1.8 : 0.12} transparent opacity={night ? 0.16 : 0.06} side={2} /></mesh>
            </group>
          ))}
          <mesh position={[0, 5.8, -1.2]}><boxGeometry args={[18.5, 0.18, 0.14]} /><meshStandardMaterial color="#3cd9ff" emissive="#3cd9ff" emissiveIntensity={night ? 2.2 : 0.12} /></mesh>
        </group>

        {/* Ambiance premium — éclairages droite / performance */}
        <group position={[12, 0, -1]}>
          <mesh position={[0, 18.2, 3.8]}><boxGeometry args={[16, 0.4, 1.4]} /><meshStandardMaterial color="#cad4dd" metalness={0.95} roughness={0.08} /></mesh>
          {[-6, -2, 2, 6].map((x, i) => (
            <group key={`perf-light-${i}`} position={[x, 17.2, 4]}>
              <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.45, 0.55, 0.9, 10]} /><meshStandardMaterial color="#dce5ec" metalness={0.94} roughness={0.08} /></mesh>
              <mesh position={[0, -5.4, 1.2]} rotation={[Math.PI / 2.8, 0, 0]}><coneGeometry args={[1.7, 12, 16, 1, true]} /><meshStandardMaterial color={i % 2 === 0 ? '#7ecbff' : '#ffd870'} emissive={i % 2 === 0 ? '#7ecbff' : '#ffd870'} emissiveIntensity={night ? 1.7 : 0.12} transparent opacity={night ? 0.15 : 0.06} side={2} /></mesh>
            </group>
          ))}
          <mesh position={[0, 6.1, -1.8]}><boxGeometry args={[16.8, 0.18, 0.14]} /><meshStandardMaterial color="#ffd870" emissive="#ffd870" emissiveIntensity={night ? 2 : 0.12} /></mesh>
        </group>

        {/* Foule séparée — partie DJ */}
        <group>
          {[
            [-18, 0.52, 6.2], [-15.2, 0.52, 7.5], [-12.4, 0.52, 6.6], [-9.5, 0.52, 7.9], [-6.7, 0.52, 6.9],
            [-19.1, 0.52, 9.6], [-16.3, 0.52, 10.5], [-13.5, 0.52, 9.4], [-10.6, 0.52, 10.8], [-7.8, 0.52, 9.8],
            [-17.2, 0.52, 12.6], [-14.2, 0.52, 13.6], [-11.3, 0.52, 12.4], [-8.3, 0.52, 13.5], [-5.6, 0.52, 12.8],
          ].map(([x, y, z], i) => (
            <AnimatedPedestrian
              key={`dj-person-${i}`}
              position={[x, y, z]}
              scale={1}
              bodyColor={['#0d1f35', '#1f4f7c', '#7a1d52', '#e8edf4', '#151515'][i % 5]}
              skinColor={['#f3c7a8', '#dca582', '#f6d2b6', '#b87c5a'][i % 4]}
              accentColor={i % 2 === 0 ? '#41d8ff' : '#ff56d6'}
              variant={i % 3 === 0 ? 'relaxed' : i % 3 === 1 ? 'chatting' : 'casual'}
              gesture={['wave', 'clap', 'talk', 'none', 'talk'][i % 5]}
              moveMode="shuffle"
              moveRadius={0.26}
              pace={0.95 + i * 0.02}
              phase={i * 0.5}
              dataTestId={`dj-person-${i}`}
            />
          ))}
        </group>

        {/* Foule séparée — partie performance */}
        <group>
          {[
            [5.8, 0.52, 6.4], [8.8, 0.52, 7.5], [11.8, 0.52, 6.7], [14.8, 0.52, 7.9], [17.8, 0.52, 6.8],
            [4.8, 0.52, 9.8], [7.8, 0.52, 10.7], [10.8, 0.52, 9.6], [13.8, 0.52, 10.9], [16.8, 0.52, 9.9],
            [6.2, 0.52, 12.8], [9.2, 0.52, 13.8], [12.2, 0.52, 12.6], [15.2, 0.52, 13.7], [18.2, 0.52, 12.9],
          ].map(([x, y, z], i) => (
            <AnimatedPedestrian
              key={`perf-person-${i}`}
              position={[x, y, z]}
              scale={1}
              bodyColor={['#ffffff', '#2f405a', '#7a4d1d', '#1c2430', '#3d1f63'][i % 5]}
              skinColor={['#f3c7a8', '#dca582', '#f6d2b6', '#b87c5a'][i % 4]}
              accentColor={i % 2 === 0 ? '#7ecbff' : '#ffd870'}
              variant={i % 2 === 0 ? 'chatting' : 'casual'}
              gesture={['talk', 'point', 'none', 'clap', 'talk'][i % 5]}
              moveMode="shuffle"
              moveRadius={0.24}
              pace={0.92 + i * 0.025}
              phase={i * 0.46}
              dataTestId={`perf-person-${i}`}
            />
          ))}
        </group>

        {/* Backstage vitré derrière les deux scènes */}
        {[
          [-12, 'DJ BACKSTAGE'],
          [12, 'LIVE BACKSTAGE'],
        ].map(([x, label], i) => (
          <group key={`backstage-${i}`} position={[x, 0, -13.2]}>
            <mesh position={[0, 2.1, 0]}><boxGeometry args={[16, 4.2, 4.4]} /><meshPhysicalMaterial color={night ? '#8fd8ff' : '#effcff'} transparent opacity={0.2} transmission={0.92} metalness={0.18} roughness={0.02} /></mesh>
            <mesh position={[0, 4.35, 0]}><boxGeometry args={[16.2, 0.14, 4.6]} /><meshStandardMaterial color="#a7f0ff" emissive="#86e9ff" emissiveIntensity={night ? 1.8 : 0.12} /></mesh>
            {[-5, 0, 5].map((rackX, ri) => (
              <group key={`rack-${ri}`} position={[rackX, 0, 0]}>
                <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.4, 2.4, 1.4]} /><meshStandardMaterial color="#1b1f28" metalness={0.35} roughness={0.5} /></mesh>
                <mesh position={[0, 1.9, 0.72]}><boxGeometry args={[1.1, 0.08, 0.08]} /><meshStandardMaterial color="#4effff" emissive="#4effff" emissiveIntensity={night ? 1.6 : 0.08} /></mesh>
              </group>
            ))}
            <mesh position={[0, 3.1, 2.32]}><boxGeometry args={[8.2, 0.8, 0.12]} /><meshStandardMaterial color="#134f86" emissive="#1a8aff" emissiveIntensity={night ? 1.8 : 0.14} /></mesh>
            <Text position={[0, 3.12, 2.48]} fontSize={0.46} color="#ffffff" anchorX="center" fontWeight="bold">{label}</Text>
          </group>
        ))}

        {/* Entrée VIP et contrôle */}
        <group position={[-18, 0, 18.5]}>
          <mesh position={[0, 3.2, 0]}><boxGeometry args={[10, 0.28, 6]} /><meshStandardMaterial color="#e9eef5" metalness={0.18} roughness={0.18} /></mesh>
          <mesh position={[0, 5.1, 2.95]}><boxGeometry args={[8.4, 1.1, 0.12]} /><meshStandardMaterial color="#13243a" emissive="#1a8aff" emissiveIntensity={night ? 2.1 : 0.16} /></mesh>
          <Text position={[0, 5.12, 3.08]} fontSize={0.62} color="#ffffff" anchorX="center" fontWeight="bold">VIP ENTRY</Text>
          {[-4.2, 4.2].map((x, i) => (
            <mesh key={`vip-post-${i}`} position={[x, 1.6, 0]}><boxGeometry args={[0.28, 3.2, 0.28]} /><meshStandardMaterial color="#d4dce4" metalness={0.92} roughness={0.08} /></mesh>
          ))}
        </group>

        {/* Vigiles */}
        {[
          [-21.8, 0.52, 17.6], [-14.2, 0.52, 17.6],
          [-4.4, 0.52, 15.8], [4.4, 0.52, 15.8],
        ].map(([x, y, z], i) => (
          <AnimatedPedestrian
            key={`guard-${i}`}
            position={[x, y, z]}
            scale={1.02}
            bodyColor="#0b1020"
            skinColor="#c78d67"
            accentColor="#ffd870"
            variant="security"
            moveMode="guard"
            moveRadius={0.06}
            pace={0.75}
            phase={i * 0.9}
            dataTestId={`south-hall-guard-${i}`}
          />
        ))}

        {/* Caméras de sécurité */}
        {[
          [-22.6, 18.5, 10.5, -0.6], [22.6, 18.5, 10.5, 0.6],
          [-22.6, 18.5, -10.5, -0.2], [22.6, 18.5, -10.5, 3.34],
          [-18, 6.2, 21.4, 0], [18, 6.2, 21.4, Math.PI],
        ].map(([x, y, z, rot], i) => (
          <group key={`security-camera-${i}`} position={[x, y, z]} rotation={[0, rot, 0]}>
            <mesh position={[0, 0, 0]}><boxGeometry args={[0.7, 0.22, 0.22]} /><meshStandardMaterial color="#d8e0e8" metalness={0.95} roughness={0.08} /></mesh>
            <mesh position={[0.45, -0.12, 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.85, 0.18, 0.18]} /><meshStandardMaterial color="#cdd6de" metalness={0.95} roughness={0.08} /></mesh>
            <mesh position={[0.92, -0.18, 0]}><sphereGeometry args={[0.18, 10, 10]} /><meshStandardMaterial color="#0f1620" emissive="#5fd3ff" emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
          </group>
        ))}

        {/* Portiques lumineux / contrôle d’entrée */}
        {[-10, 10].map((laneX, i) => (
          <group key={`entry-gate-${i}`} position={[laneX, 0, 16.9]}>
            <mesh position={[-2.1, 2.2, 0]}><boxGeometry args={[0.28, 4.4, 0.28]} /><meshStandardMaterial color="#d4dce4" metalness={0.95} roughness={0.08} /></mesh>
            <mesh position={[2.1, 2.2, 0]}><boxGeometry args={[0.28, 4.4, 0.28]} /><meshStandardMaterial color="#d4dce4" metalness={0.95} roughness={0.08} /></mesh>
            <mesh position={[0, 4.4, 0]}><boxGeometry args={[4.6, 0.24, 0.28]} /><meshStandardMaterial color="#d4dce4" metalness={0.95} roughness={0.08} /></mesh>
            <mesh position={[0, 4.4, 0.18]}><boxGeometry args={[4, 0.08, 0.08]} /><meshStandardMaterial color={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissive={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissiveIntensity={night ? 1.9 : 0.12} /></mesh>
          </group>
        ))}

        {/* Détails badges VIP */}
        {[
          [-18.6, 0.52, 16.2], [-16.6, 0.52, 16.9],
        ].map(([x, y, z], i) => (
          <AnimatedPedestrian
            key={`vip-guest-${i}`}
            position={[x, y, z]}
            scale={0.98}
            bodyColor={i === 0 ? '#f3f5f8' : '#1f365a'}
            skinColor={i === 0 ? '#e7bc97' : '#d69972'}
            accentColor="#ffd870"
            variant="relaxed"
            gesture={i === 0 ? 'phone' : 'wave'}
            moveMode="queue"
            moveRadius={0.14}
            pace={0.82}
            phase={i * 0.8}
            dataTestId={`south-hall-vip-guest-${i}`}
          />
        ))}

        {/* Marquage de circulation premium */}
        {[-10, 10].map((x, i) => (
          <group key={`flow-marking-${i}`} position={[x, 0, 22.8]}>
            {[0, -2.4, -4.8].map((z, zi) => (
              <mesh key={`flow-line-${zi}`} position={[0, 0.31, z]}><boxGeometry args={[1.2, 0.04, 0.16]} /><meshStandardMaterial color={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissive={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissiveIntensity={night ? 1.2 : 0.08} /></mesh>
            ))}
            <mesh position={[0, 0.31, -7]} rotation={[0, i === 0 ? Math.PI : 0, 0]}><coneGeometry args={[0.48, 1.1, 3]} /><meshStandardMaterial color={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissive={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissiveIntensity={night ? 1.4 : 0.1} /></mesh>
          </group>
        ))}

        {/* Flashes photo et gyrophares doux */}
        {[
          [-24, 3.8, 22], [-14, 3.6, 24], [14, 3.6, 24], [24, 3.8, 22],
        ].map(([x, y, z], i) => (
          <mesh key={`photo-flash-${i}`} ref={(el) => { flashRefs.current[i] = el; }} position={[x, y, z]}><sphereGeometry args={[0.35, 10, 10]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={night ? 2.2 : 0.2} transparent opacity={night ? 0.12 : 0.04} /></mesh>
        ))}
        {[
          [-20, 2.6, 20.2], [20, 2.6, 20.2],
        ].map(([x, y, z], i) => (
          <group key={`beacon-${i}`} position={[x, y, z]}>
            <mesh position={[0, -1.4, 0]}><cylinderGeometry args={[0.08, 0.1, 2.8, 8]} /><meshStandardMaterial color="#d3dce4" metalness={0.92} roughness={0.08} /></mesh>
            <mesh ref={(el) => { beaconRefs.current[i] = el; }} position={[0, 0.25, 0]}><boxGeometry args={[1.8, 0.08, 0.22]} /><meshStandardMaterial color={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissive={i === 0 ? '#ff5ecf' : '#4ad9ff'} emissiveIntensity={night ? 1.5 : 0.08} /></mesh>
          </group>
        ))}

        {/* Agents mobiles autour des accès */}
        {[0, 1, 2, 3].map((i) => (
          <AnimatedPedestrian
            key={`mobile-agent-${i}`}
            position={[i < 2 ? -8 : 8, 0.52, i % 2 === 0 ? 19 : 23]}
            scale={0.92}
            bodyColor={i % 2 === 0 ? '#101520' : '#22324d'}
            skinColor="#c89169"
            accentColor="#9ef0ff"
            variant="security"
            gesture={i % 2 === 0 ? 'point' : 'talk'}
            moveMode={i % 2 === 0 ? 'patrol-x' : 'patrol-z'}
            moveRadius={i % 2 === 0 ? 5.8 : 3.8}
            pace={0.68 + i * 0.05}
            phase={i * 0.9}
            dataTestId={`south-hall-mobile-agent-${i}`}
          />
        ))}

        {/* Barrières et files d’attente */}
        {[-10, 10].map((laneX, laneIndex) => (
          <group key={`queue-lane-${laneIndex}`} position={[laneX, 0, 20.2]}>
            {[-6, -2, 2, 6].map((z, i) => (
              <React.Fragment key={`queue-post-${laneIndex}-${i}`}>
                <mesh position={[-2.6, 1, z]}><cylinderGeometry args={[0.08, 0.1, 2, 8]} /><meshStandardMaterial color="#d3d9df" metalness={0.9} roughness={0.08} /></mesh>
                <mesh position={[2.6, 1, z]}><cylinderGeometry args={[0.08, 0.1, 2, 8]} /><meshStandardMaterial color="#d3d9df" metalness={0.9} roughness={0.08} /></mesh>
                <mesh position={[0, 1.55, z]}><boxGeometry args={[5.2, 0.08, 0.08]} /><meshStandardMaterial color={laneIndex === 0 ? '#ff5ecf' : '#4ad9ff'} emissive={laneIndex === 0 ? '#ff5ecf' : '#4ad9ff'} emissiveIntensity={night ? 1.3 : 0.08} /></mesh>
              </React.Fragment>
            ))}
          </group>
        ))}

        {/* Flux de personnages organisé vers les deux entrées */}
        {[
          [-12.6, 0.52, 26.4], [-12.2, 0.52, 23.6], [-11.8, 0.52, 20.8], [-11.4, 0.52, 18.1],
          [11.8, 0.52, 26.4], [12.2, 0.52, 23.7], [12.6, 0.52, 20.9], [13, 0.52, 18.2],
        ].map(([x, y, z], i) => (
          <AnimatedPedestrian
            key={`queue-person-${i}`}
            position={[x, y, z]}
            scale={0.94}
            bodyColor={i < 4 ? ['#ffffff', '#2a3c5c', '#7d1e52', '#101010'][i % 4] : ['#d9e4ef', '#3b2c63', '#7a4d1d', '#0b1020'][i % 4]}
            skinColor={['#f1c39f', '#d99972', '#f5d0b3', '#b77d5b'][i % 4]}
            variant={i % 2 === 0 ? 'casual' : 'chatting'}
            gesture={['none', 'phone', 'talk', 'none', 'talk', 'phone', 'none', 'talk'][i]}
            moveMode="queue"
            moveRadius={0.18}
            pace={0.84 + i * 0.02}
            phase={i * 0.6}
            dataTestId={`south-hall-queue-person-${i}`}
          />
        ))}

        {/* Garde-corps et ouverture frontale */}
        {[-21, -14, -7, 7, 14, 21].map((x, i) => (
          <group key={`front-guard-${i}`} position={[x, 0, 12.2]}>
            <mesh position={[0, 1.35, 0]}><cylinderGeometry args={[0.08, 0.1, 2.7, 8]} /><meshStandardMaterial color="#d0d8e0" metalness={0.9} roughness={0.08} /></mesh>
            <mesh position={[0, 2.45, 0]}><boxGeometry args={[2.2, 0.08, 0.08]} /><meshStandardMaterial color="#cfefff" emissive="#87deff" emissiveIntensity={night ? 1.1 : 0.08} /></mesh>
          </group>
        ))}
      </group>

      {/* Spectacle monumental — drones, lasers et guidage événementiel */}
      {Array.from({ length: 6 }).map((_, index) => (
        <group key={`hall-drone-${index}`} ref={(el) => { droneRefs.current[index] = el; }}>
          <mesh><sphereGeometry args={[0.34, 10, 10]} /><meshStandardMaterial color="#e6edf4" metalness={0.95} roughness={0.08} /></mesh>
          <mesh position={[0, -0.22, 0]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#1a8aff" emissive="#1a8aff" emissiveIntensity={night ? 1.8 : 0.15} /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[1.2, 0.04, 0.1]} /><meshStandardMaterial color="#b8c6d4" metalness={0.9} roughness={0.08} /></mesh>
          <mesh><boxGeometry args={[1.2, 0.04, 0.1]} /><meshStandardMaterial color="#b8c6d4" metalness={0.9} roughness={0.08} /></mesh>
        </group>
      ))}
      {[
        [84, 17.8, 53 + centerZ, '#41d8ff'],
        [108, 17.8, 53 + centerZ, '#ff56d6'],
        [84, 17.8, 39 + centerZ, '#ffd870'],
        [108, 17.8, 39 + centerZ, '#7ce7ff'],
      ].map(([x, y, z, color], index) => (
        <mesh key={`hall-laser-${index}`} ref={(el) => { laserRefs.current[index] = el; }} position={[x, y, z]} rotation={[Math.PI / 2.7, index * 0.4, 0]}>
          <coneGeometry args={[1.8, 42, 18, 1, true]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={night ? 2.2 : 0.08} transparent opacity={night ? 0.12 : 0.02} side={2} />
        </mesh>
      ))}
      <group position={[96, 0, 29 + centerZ]}>
        <mesh position={[0, 7.8, 0]}><boxGeometry args={[18, 1.4, 0.14]} /><meshStandardMaterial color="#13243a" metalness={0.3} roughness={0.16} /></mesh>
        <mesh ref={(el) => { eventBannerRefs.current[0] = el; }} position={[0, 7.8, 0.12]}><boxGeometry args={[17.2, 0.9, 0.08]} /><meshStandardMaterial color="#17324f" emissive="#1a8aff" emissiveIntensity={night ? 2.2 : 0.16} /></mesh>
        <Text position={[0, 7.82, 0.22]} fontSize={0.52} color="#ffffff" anchorX="center" fontWeight="bold">CAPTURE LIVE DISTRICT</Text>
      </group>
      {[-24, 0, 24].map((x, index) => (
        <mesh key={`hall-guidance-strip-${index}`} position={[96 + x, 0.32, 20 + centerZ]}><boxGeometry args={[10, 0.04, 0.18]} /><meshStandardMaterial color={index === 1 ? '#ffd870' : '#41d8ff'} emissive={index === 1 ? '#ffd870' : '#41d8ff'} emissiveIntensity={night ? 1.4 : 0.08} /></mesh>
      ))}
      {[-10, 10].map((x, index) => (
        <mesh key={`hall-guidance-vertical-${index}`} position={[96 + x, 0.32, 24 + centerZ]}><boxGeometry args={[0.18, 0.04, 10]} /><meshStandardMaterial color={index === 0 ? '#ff56d6' : '#7ce7ff'} emissive={index === 0 ? '#ff56d6' : '#7ce7ff'} emissiveIntensity={night ? 1.3 : 0.08} /></mesh>
      ))}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ ROUTES COMPLÈTES — Stade ↔ Centre-ville ↔ Mall ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {/* Route EST vers le stade */}
      <mesh position={[W + 15, 0.15, -20 + centerZ]}><boxGeometry args={[30, 0.2, 6]} /><meshStandardMaterial color={night ? '#1a1e24' : '#505458'} roughness={0.9} /></mesh>
      <mesh position={[W + 15, 0.28, -20 + centerZ]}><boxGeometry args={[28, 0.04, 0.15]} /><meshStandardMaterial color="#d4a020" emissive="#d4a020" emissiveIntensity={night ? 0.8 : 0} /></mesh>
      {/* Trottoirs route EST */}
      <mesh position={[W + 15, 0.19, -16.95 + centerZ]}><boxGeometry args={[30, 0.08, 1.05]} /><meshStandardMaterial color={night ? '#20242a' : '#7a7f84'} roughness={0.88} /></mesh>
      <mesh position={[W + 15, 0.19, -23.05 + centerZ]}><boxGeometry args={[30, 0.08, 1.05]} /><meshStandardMaterial color={night ? '#20242a' : '#7a7f84'} roughness={0.88} /></mesh>
      {/* Barrières route EST */}
      {[W + 6, W + 14, W + 22].map((x, i) => (
        <mesh key={`bre-${i}`} position={[x, 0.4, -16 + centerZ]}><boxGeometry args={[0.1, 0.5, 2]} /><meshStandardMaterial color={i % 2 === 0 ? '#cc3333' : '#eee'} roughness={0.6} /></mesh>
      ))}

      {/* Route OUEST vers le mall */}
      <mesh position={[-W - 15, 0.15, -20 + centerZ]}><boxGeometry args={[30, 0.2, 6]} /><meshStandardMaterial color={night ? '#1a1e24' : '#505458'} roughness={0.9} /></mesh>
      <mesh position={[-W - 15, 0.28, -20 + centerZ]}><boxGeometry args={[28, 0.04, 0.15]} /><meshStandardMaterial color="#d4a020" emissive="#d4a020" emissiveIntensity={night ? 0.8 : 0} /></mesh>
      <mesh position={[-W - 15, 0.19, -16.95 + centerZ]}><boxGeometry args={[30, 0.08, 1.05]} /><meshStandardMaterial color={night ? '#20242a' : '#7a7f84'} roughness={0.88} /></mesh>
      <mesh position={[-W - 15, 0.19, -23.05 + centerZ]}><boxGeometry args={[30, 0.08, 1.05]} /><meshStandardMaterial color={night ? '#20242a' : '#7a7f84'} roughness={0.88} /></mesh>
      {[-W - 6, -W - 14, -W - 22].map((x, i) => (
        <mesh key={`brw-${i}`} position={[x, 0.4, -16 + centerZ]}><boxGeometry args={[0.1, 0.5, 2]} /><meshStandardMaterial color={i % 2 === 0 ? '#cc3333' : '#eee'} roughness={0.6} /></mesh>
      ))}

      {/* ═══ VÉHICULES EN TRAFIC sur les routes ═══ */}
      <TrafficVehicles night={night} centerZ={centerZ} W={W} />

      {/* Console Signature CAPTURE — mode manuel + auto */}
      <group position={[0, 5.4, centerZ - 2]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[20, 2.8, 0.38]} />
          <meshPhysicalMaterial color={night ? '#11263b' : '#e8f3fb'} transparent opacity={0.84} metalness={0.44} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.22]}>
          <boxGeometry args={[18.6, 2.15, 0.08]} />
          <meshStandardMaterial color="#163550" emissive={signatureTheme.primary} emissiveIntensity={night ? 0.75 : 0.08} />
        </mesh>
        <Text position={[0, 0.95, 0.28]} fontSize={0.34} color="#ffffff" anchorX="center" fontWeight="bold">SIGNATURE CAPTURE</Text>
        <Text position={[0, 0.55, 0.28]} fontSize={0.24} color="#dff6ff" anchorX="center" fontWeight="bold">MODE {signatureMode.toUpperCase()} {signatureAutoCycle ? '• AUTO' : '• MANUEL'}</Text>
        {[
          { key: 'dawn', label: 'AUBE', x: -6.3, color: '#7ce7ff' },
          { key: 'sunset', label: 'SUNSET', x: -1.9, color: '#ffb066' },
          { key: 'neon', label: 'NEON', x: 2.5, color: '#ff56d6' },
          { key: 'auto', label: 'AUTO', x: 6.9, color: '#6bffb0' },
        ].map((button) => {
          const active = button.key === 'auto' ? signatureAutoCycle : !signatureAutoCycle && signatureMode === button.key;
          return (
            <group key={`signature-btn-${button.key}`} position={[button.x, -0.45, 0.34]}>
              <mesh
                onClick={() => {
                  if (button.key === 'auto') {
                    setSignatureAutoCycle(true);
                  } else {
                    setSignatureAutoCycle(false);
                    setSignatureMode(button.key);
                  }
                }}
              >
                <boxGeometry args={[3.4, 0.8, 0.18]} />
                <meshStandardMaterial color={active ? '#f6fbff' : '#31516b'} emissive={button.color} emissiveIntensity={active ? (night ? 1.3 : 0.18) : (night ? 0.6 : 0.06)} />
              </mesh>
              <Text position={[0, 0, 0.12]} fontSize={0.22} color={active ? '#102a42' : '#e9f8ff'} anchorX="center" fontWeight="bold">{button.label}</Text>
            </group>
          );
        })}
      </group>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ PACK 40 IDÉES ULTRA PREMIUM — NOUVEAU MONDE ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {ultraPremiumInstallations.map((idea) => (
        <group key={`ultra-premium-idea-${idea.id}`} position={[idea.x, 0, idea.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <circleGeometry args={[2.2, 20]} />
            <meshStandardMaterial color={night ? '#24303f' : '#f2f5f9'} roughness={0.22} metalness={0.2} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
            <ringGeometry args={[1.35, 1.95, 24]} />
            <meshStandardMaterial color={idea.tone} emissive={idea.tone} emissiveIntensity={night ? 1.1 : 0.1} />
          </mesh>
          {idea.motif % 2 === 0 ? (
            <mesh position={[0, 1.15, 0]} rotation={[0, idea.motif * 0.2, 0]}>
              <torusKnotGeometry args={[0.5, 0.14, 64, 10]} />
              <meshStandardMaterial color="#eef7ff" emissive={idea.tone} emissiveIntensity={night ? 1.4 : 0.08} metalness={0.86} roughness={0.12} />
            </mesh>
          ) : (
            <mesh position={[0, 1.05, 0]} rotation={[0, idea.motif * 0.35, 0]}>
              <octahedronGeometry args={[0.72, 0]} />
              <meshPhysicalMaterial color="#e4f7ff" emissive={idea.tone} emissiveIntensity={night ? 1.2 : 0.08} metalness={0.32} roughness={0.06} transmission={0.55} transparent opacity={0.88} />
            </mesh>
          )}
          <mesh position={[0, 2.8, 0]} rotation={[Math.PI / 2.8, idea.motif * 0.35, 0]}>
            <coneGeometry args={[0.9, 5.4, 12, 1, true]} />
            <meshStandardMaterial color={idea.tone} emissive={idea.tone} emissiveIntensity={night ? 1.8 : 0.1} transparent opacity={night ? 0.1 : 0.02} side={2} />
          </mesh>
          {[-0.95, 0.95].map((x, idx) => (
            <group key={`idea-bosquet-${idea.id}-${idx}`} position={[x, 0, idx === 0 ? -0.74 : 0.74]}>
              <mesh position={[0, 0.16, 0]}>
                <sphereGeometry args={[0.35, 10, 10]} />
                <meshStandardMaterial color={night ? '#2ecb67' : '#45d972'} emissive={night ? '#2ecb67' : '#1f8f4d'} emissiveIntensity={night ? 0.42 : 0.04} roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ PACK 40 IDÉES ULTRA PREMIUM #2 (ARCHI+PAYSAGE) ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {ultraPremiumInstallationsPhase2.map((idea) => (
        <group key={`ultra-premium-idea-phase2-${idea.id}`} position={[idea.x, 0, idea.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
            <circleGeometry args={[idea.category === 'architecture' ? 2.5 : 2.2, 20]} />
            <meshStandardMaterial color={night ? '#263245' : '#f3f6fb'} roughness={0.24} metalness={0.18} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
            <ringGeometry args={[1.2, idea.category === 'architecture' ? 2.15 : 1.92, 24]} />
            <meshStandardMaterial color={signatureTheme.primary} emissive={signatureTheme.primary} emissiveIntensity={night ? 1.2 : 0.1} />
          </mesh>

          {idea.category === 'architecture' ? (
            <>
              <mesh position={[0, idea.h, 0]}>
                <boxGeometry args={[1.4, idea.h * 1.6, 1.4]} />
                <meshPhysicalMaterial color={signatureTheme.core} transparent opacity={0.86} metalness={0.42} roughness={0.1} transmission={0.34} />
              </mesh>
              <mesh position={[0, idea.h * 2.05, 0]}>
                <boxGeometry args={[1.9, 0.16, 1.9]} />
                <meshStandardMaterial color={signatureTheme.secondary} emissive={signatureTheme.secondary} emissiveIntensity={night ? 1.1 : 0.08} />
              </mesh>
              {[-1.55, 1.55].map((x, idx) => (
                <mesh key={`phase2-arch-wing-${idea.id}-${idx}`} position={[x, idea.h * 1.2, 0]} rotation={[0, 0, idx === 0 ? 0.2 : -0.2]}>
                  <boxGeometry args={[1.15, 0.18, 2.4]} />
                  <meshStandardMaterial color={signatureTheme.tertiary} emissive={signatureTheme.tertiary} emissiveIntensity={night ? 0.95 : 0.06} />
                </mesh>
              ))}
            </>
          ) : (
            <>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[1.02, 1.2, 0.48, 20]} />
                <meshPhysicalMaterial color={signatureTheme.primary} transparent opacity={0.68} metalness={0.26} roughness={0.03} />
              </mesh>
              <mesh position={[0, 0.75, 0]}>
                <sphereGeometry args={[0.66, 12, 12]} />
                <meshStandardMaterial color={signatureTheme.foliage} emissive={signatureTheme.foliage} emissiveIntensity={night ? 0.82 : 0.08} roughness={0.9} />
              </mesh>
              <mesh position={[0, 1.8, 0]} rotation={[0.4, idea.id * 0.22, 0]}>
                <torusGeometry args={[0.55, 0.1, 10, 24]} />
                <meshStandardMaterial color={signatureTheme.tertiary} emissive={signatureTheme.tertiary} emissiveIntensity={night ? 1.05 : 0.08} metalness={0.66} roughness={0.12} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ IMMEUBLES PÉRIPHÉRIQUES + BOSQUETS RONDS ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {perimeterTowers.map((b, i) => (
        <group key={`tower-${i}`} position={[b.x, 0, b.z + centerZ]}>
          <mesh position={[0, b.h / 2, 0]}><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={night ? '#152535' : b.color} roughness={0.5} metalness={0.3} /></mesh>
          <mesh position={[0, b.h + 0.1, 0]}><boxGeometry args={[b.w * 0.9, 0.15, b.d * 0.9]} /><meshStandardMaterial color="#7d8b98" metalness={0.4} /></mesh>
          <mesh position={[0, 1.8, b.d / 2 + 0.08]}><boxGeometry args={[b.w * 0.36, 3.2, 0.14]} /><meshStandardMaterial color={i % 2 === 0 ? '#dff6ff' : '#4b535c'} emissive={i % 2 === 0 ? '#7ce7ff' : '#000000'} emissiveIntensity={night && i % 2 === 0 ? 0.9 : 0} metalness={0.72} roughness={0.08} transparent opacity={i % 2 === 0 ? 0.5 : 1} /></mesh>
          {Array.from({ length: 3 }).map((_, bi) => {
            const by = 5 + bi * (b.h * 0.18);
            return (
              <group key={`tower-balcony-${bi}`} position={[0, by, b.d / 2 + 0.04]}>
                <mesh position={[0, 0, -0.45]}><boxGeometry args={[b.w * 0.72, 0.14, 0.9]} /><meshStandardMaterial color={night ? '#eef5fb' : '#ffffff'} roughness={0.16} metalness={0.12} /></mesh>
                <mesh position={[0, 0.36, 0]}><boxGeometry args={[b.w * 0.68, 0.62, 0.06]} /><meshPhysicalMaterial color={districtGlass} transparent opacity={0.5} metalness={0.48} roughness={0.04} /></mesh>
                <mesh position={[0, 0.1, -0.58]}><boxGeometry args={[b.w * 0.28, 0.16, 0.36]} /><meshStandardMaterial color={night ? '#31503b' : '#7da36c'} roughness={0.9} /></mesh>
              </group>
            );
          })}
          {/* Fenêtres */}
          <mesh position={[0, b.h * 0.55, b.d / 2 + 0.05]}><boxGeometry args={[b.w * 0.75, b.h * 0.4, 0.05]} /><meshStandardMaterial color={night ? '#dff6ff' : '#74b8de'} emissive={night ? '#dff6ff' : '#000'} emissiveIntensity={night ? 1.2 : 0} transparent opacity={0.6} /></mesh>
          <mesh position={[0, b.h * 0.55, -b.d / 2 - 0.05]}><boxGeometry args={[b.w * 0.75, b.h * 0.4, 0.05]} /><meshStandardMaterial color={night ? '#dff6ff' : '#74b8de'} emissive={night ? '#dff6ff' : '#000'} emissiveIntensity={night ? 1.2 : 0} transparent opacity={0.6} /></mesh>
          {[-b.w / 2 - 0.05, b.w / 2 + 0.05].map((sx, si) => (
            <mesh key={`tower-side-window-${si}`} position={[sx, b.h * 0.52, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[b.d * 0.62, b.h * 0.34, 0.05]} /><meshStandardMaterial color={night ? '#dff6ff' : '#74b8de'} emissive={night ? '#dff6ff' : '#000'} emissiveIntensity={night ? 1 : 0} transparent opacity={0.52} /></mesh>
          ))}
        </group>
      ))}

      {/* Bosquets ronds verts lumineux autour de tous les immeubles périphériques */}
      {perimeterBosquets.map((bosquet) => (
        <group key={`perimeter-bosquet-${bosquet.id}`} position={[bosquet.x, 0, bosquet.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
            <ringGeometry args={[bosquet.size * 0.5, bosquet.size * 0.86, 16]} />
            <meshStandardMaterial color={night ? '#1a5f37' : '#7fbc6e'} roughness={0.92} />
          </mesh>
          <mesh position={[0, bosquet.size * 0.42, 0]}>
            <sphereGeometry args={[bosquet.size * 0.5, 12, 12]} />
            <meshStandardMaterial color={night ? '#39dd77' : '#58e384'} emissive={night ? '#39dd77' : '#2d9b58'} emissiveIntensity={night ? 0.52 : 0.05} roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* Bosquets ronds premium autour des immeubles majeurs des districts */}
      {districtBosquets.map((bosquet) => (
        <group key={`district-bosquet-${bosquet.id}`} position={[bosquet.x, 0, bosquet.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
            <circleGeometry args={[bosquet.size * 0.72, 14]} />
            <meshStandardMaterial color={night ? '#204f35' : '#84bf74'} roughness={0.96} />
          </mesh>
          <mesh position={[0, bosquet.size * 0.45, 0]}>
            <sphereGeometry args={[bosquet.size * 0.46, 10, 10]} />
            <meshStandardMaterial color={night ? '#4ee683' : '#62de8f'} emissive={night ? '#4ee683' : '#2e9c5d'} emissiveIntensity={night ? 0.48 : 0.05} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}