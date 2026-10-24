// Helpers to build low-poly, vertex-coloured merged geometry: one mesh = one draw call.
// To swap in GLB models later, replace the factory functions that call buildColored().

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V3 = [number, number, number];

export interface Part {
  geo: THREE.BufferGeometry;
  /** Flat colour for the part. Omit to keep the geometry's own vertex colours. */
  color?: THREE.ColorRepresentation;
  p?: V3;
  r?: V3;
  s?: V3;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();

export function buildColored(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((part) => {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    }
    tmpE.set(...(part.r ?? [0, 0, 0]));
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpP.set(...(part.p ?? [0, 0, 0])), tmpQ, tmpS.set(...(part.s ?? [1, 1, 1])));
    g.applyMatrix4(tmpM);
    if (part.color !== undefined || !g.getAttribute('color')) {
      tmpC.set(part.color ?? 0xffffff);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = tmpC.r;
        arr[i * 3 + 1] = tmpC.g;
        arr[i * 3 + 2] = tmpC.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('mergeGeometries failed');
  for (const g of geos) g.dispose();
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sph = (r: number, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
export const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

const geoCache = new Map<string, THREE.BufferGeometry>();
/** Build a geometry once and share it between every mesh that uses it. */
export function cached(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = build();
    geoCache.set(key, g);
  }
  return g;
}

let vcMat: THREE.MeshLambertMaterial | null = null;
export function vertexColorMaterial(): THREE.MeshLambertMaterial {
  return (vcMat ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

let blobMat: THREE.MeshBasicMaterial | null = null;
/** Cheap fake shadow under vehicles. */
export function blobShadow(w: number, l: number): THREE.Mesh {
  blobMat ??= new THREE.MeshBasicMaterial({
    map: radialTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const g = cached('blob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const m = new THREE.Mesh(g, blobMat);
  m.scale.set(w, 1, l);
  m.position.y = 0.03;
  m.renderOrder = -1;
  return m;
}

function radialTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
