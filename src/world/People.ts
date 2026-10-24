// Low-poly people. Each person is one merged, vertex-coloured mesh (one draw call).
// Extortionists are generic: plain shirts, neutral-grey armband and cap. No party colours or symbols.

import * as THREE from 'three';
import { box, buildColored, cached, cyl, sph, vertexColorMaterial, type Part } from '../utils/geometry';
import { pick, type Rng } from '../utils/rng';

export type PersonKind = 'worker' | 'farmer' | 'official' | 'trader' | 'rider';

const SKINS = [0x8d5a3b, 0x9c6644, 0x7b4a2e, 0xa87150];
const SHIRTS = [0xf2f0ea, 0x9ec3e6, 0xc9c9c9, 0xd9c7a3, 0xe8d8b0, 0x8a9bb0];
const LUNGIS = [0x3b5d8f, 0x6b4f8a, 0x2f6f5e, 0x7a3b3b];
const NEUTRAL = 0xb3ada2;

interface Look {
  skin: number;
  shirt: number;
  lower: number;
  lungi: boolean;
  cap?: number;
  armband?: boolean;
  gamchha?: boolean;
  /** leave the right arm off (it's added as an animated child) */
  noRightArm?: boolean;
  seated?: boolean;
}

export function personParts(look: Look, offset: [number, number, number] = [0, 0, 0]): Part[] {
  const [ox, oy, oz] = offset;
  const parts: Part[] = [];
  const y0 = look.seated ? -0.35 : 0;
  if (look.seated) {
    parts.push({ geo: box(0.42, 0.18, 0.55), color: look.lower, p: [ox, oy + 0.55, oz - 0.15] });
    parts.push({ geo: box(0.16, 0.5, 0.16), color: look.lower, p: [ox - 0.12, oy + 0.3, oz - 0.4] });
    parts.push({ geo: box(0.16, 0.5, 0.16), color: look.lower, p: [ox + 0.12, oy + 0.3, oz - 0.4] });
  } else if (look.lungi) {
    parts.push({ geo: cyl(0.22, 0.27, 0.85, 7), color: look.lower, p: [ox, oy + 0.43, oz] });
  } else {
    parts.push({ geo: box(0.17, 0.85, 0.2), color: look.lower, p: [ox - 0.12, oy + 0.43, oz] });
    parts.push({ geo: box(0.17, 0.85, 0.2), color: look.lower, p: [ox + 0.12, oy + 0.43, oz] });
  }
  const ty = oy + y0;
  parts.push({ geo: box(0.5, 0.62, 0.28), color: look.shirt, p: [ox, ty + 1.16, oz] });
  parts.push({ geo: box(0.13, 0.58, 0.14), color: look.shirt, p: [ox - 0.33, ty + 1.15, oz] });
  parts.push({ geo: box(0.12, 0.12, 0.12), color: look.skin, p: [ox - 0.33, ty + 0.82, oz] });
  if (!look.noRightArm) {
    parts.push({ geo: box(0.13, 0.58, 0.14), color: look.shirt, p: [ox + 0.33, ty + 1.15, oz] });
    parts.push({ geo: box(0.12, 0.12, 0.12), color: look.skin, p: [ox + 0.33, ty + 0.82, oz] });
  }
  parts.push({ geo: box(0.14, 0.1, 0.14), color: look.skin, p: [ox, ty + 1.51, oz] });
  parts.push({ geo: sph(0.14, 7, 5), color: look.skin, p: [ox, ty + 1.66, oz] });
  if (look.cap !== undefined) {
    parts.push({ geo: cyl(0.15, 0.15, 0.08, 8), color: look.cap, p: [ox, ty + 1.79, oz] });
    parts.push({ geo: box(0.2, 0.02, 0.14), color: look.cap, p: [ox, ty + 1.76, oz - 0.17] });
  } else {
    parts.push({ geo: sph(0.145, 7, 4), color: 0x1d1a17, p: [ox, ty + 1.7, oz + 0.01], s: [1, 0.7, 1] });
  }
  if (look.armband) {
    parts.push({ geo: box(0.15, 0.09, 0.16), color: NEUTRAL, p: [ox - 0.33, ty + 1.3, oz] });
  }
  if (look.gamchha) {
    parts.push({ geo: box(0.54, 0.08, 0.3), color: 0xc0392b, p: [ox, ty + 1.45, oz] });
  }
  return parts;
}

function lookFor(kind: PersonKind, r: Rng): Look {
  switch (kind) {
    case 'worker':
      return { skin: pick(r, SKINS), shirt: pick(r, SHIRTS), lower: pick(r, [0x3a3a40, 0x5a4a3a, 0x2d3b55]), lungi: r() < 0.3, cap: NEUTRAL, armband: true };
    case 'rider':
      return { skin: pick(r, SKINS), shirt: pick(r, SHIRTS), lower: 0x3a3a40, lungi: false, cap: NEUTRAL, armband: true, seated: true };
    case 'farmer':
      return { skin: pick(r, SKINS), shirt: pick(r, [0xf2f0ea, 0xd9c7a3, 0x9ec3e6]), lower: pick(r, LUNGIS), lungi: true, gamchha: true };
    case 'official':
      return { skin: pick(r, SKINS), shirt: 0xb7a27a, lower: 0x6e5f44, lungi: false, cap: 0x2e3a2a };
    case 'trader':
      return { skin: pick(r, SKINS), shirt: pick(r, SHIRTS), lower: pick(r, LUNGIS), lungi: r() < 0.6, cap: r() < 0.3 ? 0xf2f0ea : undefined };
  }
}

export function personGeometry(kind: PersonKind, variant: number, noRightArm = false): THREE.BufferGeometry {
  return cached(`person:${kind}:${variant}:${noRightArm}`, () => {
    let seed = variant * 9301 + 49297;
    const rng: Rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return buildColored(personParts({ ...lookFor(kind, rng), noRightArm }));
  });
}

export function makePerson(kind: PersonKind, variant: number): THREE.Mesh {
  return new THREE.Mesh(personGeometry(kind, variant), vertexColorMaterial());
}

/**
 * A person whose right arm is a separate pivot (for waving a stick or receipt book).
 * Returns the body mesh; the arm pivot is `mesh.userData.arm`.
 */
export function makeWaver(kind: PersonKind, variant: number, holding: 'stick' | 'receipt'): THREE.Mesh {
  const body = new THREE.Mesh(personGeometry(kind, variant, true), vertexColorMaterial());
  const armGeo = cached(`arm:${holding}`, () => {
    const parts: Part[] = [
      { geo: box(0.13, 0.58, 0.14), color: 0xd9c7a3, p: [0, -0.29, 0] },
      { geo: box(0.12, 0.12, 0.12), color: SKINS[0], p: [0, -0.62, 0] },
    ];
    if (holding === 'stick') parts.push({ geo: cyl(0.025, 0.03, 1.1, 5), color: 0x6b4a2a, p: [0, -0.62, -0.3], r: [Math.PI / 2.4, 0, 0] });
    else parts.push({ geo: box(0.2, 0.26, 0.04), color: 0xfafafa, p: [0, -0.7, -0.06] });
    return buildColored(parts);
  });
  const arm = new THREE.Mesh(armGeo, vertexColorMaterial());
  arm.position.set(0.33, 1.43, 0);
  body.add(arm);
  body.userData.arm = arm;
  return body;
}
