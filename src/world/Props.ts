// Static roadside prop geometry (trees, huts, shops, poles…). Used through InstancedMesh.

import * as THREE from 'three';
import { box, buildColored, cached, cone, cyl, ico, type Part } from '../utils/geometry';

export type PropKind =
  | 'banana' | 'roundTree' | 'palm' | 'bamboo' | 'hut' | 'teaStall' | 'shop' | 'pole'
  | 'haystack' | 'paddy' | 'pond' | 'building' | 'pavement' | 'shrub' | 'billboardFrame' | 'crate';

export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  return cached(`prop:${kind}`, () => {
    switch (kind) {
      case 'banana': {
        const parts: Part[] = [{ geo: cyl(0.14, 0.2, 2.8, 6), color: 0x7f8f3a, p: [0, 1.4, 0] }];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          parts.push({
            geo: box(0.55, 0.04, 2.0),
            color: i % 2 ? 0x5fa632 : 0x4c8f2a,
            p: [Math.sin(a) * 0.8, 3.0, Math.cos(a) * 0.8],
            r: [0.5, a, 0],
          });
        }
        return buildColored(parts);
      }
      case 'roundTree':
        return buildColored([
          { geo: cyl(0.25, 0.38, 3.2, 6), color: 0x5b4027, p: [0, 1.6, 0] },
          { geo: ico(2.6), color: 0x3f6f2a, p: [0, 4.8, 0] },
          { geo: ico(1.8), color: 0x4f8132, p: [1.3, 4.1, 0.6] },
          { geo: ico(1.6), color: 0x36602a, p: [-1.2, 4.3, -0.5] },
        ]);
      case 'palm': {
        const parts: Part[] = [{ geo: cyl(0.15, 0.24, 8, 6), color: 0x7a6248, p: [0, 4, 0], r: [0.06, 0, 0.04] }];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          parts.push({ geo: box(0.45, 0.05, 3.2), color: i % 2 ? 0x4c8f2a : 0x5d9c35, p: [Math.sin(a) * 1.4 + 0.3, 7.6, Math.cos(a) * 1.4], r: [0.55, a, 0] });
        }
        parts.push({ geo: ico(0.25), color: 0x6b5a2a, p: [0.3, 7.8, 0.2] });
        return buildColored(parts);
      }
      case 'bamboo': {
        const parts: Part[] = [];
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4;
          const h = 7 + (i % 4) * 1.5;
          parts.push({ geo: cyl(0.07, 0.09, h, 5), color: i % 2 ? 0x9bb04a : 0x86a03c, p: [Math.cos(a) * 0.6, h / 2, Math.sin(a) * 0.6], r: [Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15] });
        }
        parts.push({ geo: cone(2.4, 4.5, 7), color: 0x6e9a35, p: [0, 8.5, 0] });
        return buildColored(parts);
      }
      case 'hut':
        return buildColored([
          { geo: box(4, 2.3, 3), color: 0xa9825a, p: [0, 1.15, 0] },
          { geo: box(0.9, 1.7, 0.06), color: 0x3b2a1a, p: [0.6, 0.85, -1.52] },
          { geo: box(4.6, 0.08, 2.0), color: 0x8c99a3, p: [0, 2.85, -0.75], r: [0.55, 0, 0] },
          { geo: box(4.6, 0.08, 2.0), color: 0x7f8a92, p: [0, 2.85, 0.75], r: [-0.55, 0, 0] },
        ]);
      case 'teaStall':
        return buildColored([
          { geo: box(3, 2.2, 2.4), color: 0x8a6a45, p: [0, 1.1, 0] },
          { geo: box(2.6, 1.0, 0.05), color: 0x2b1e14, p: [0, 1.5, -1.21] },
          { geo: box(3.4, 0.06, 1.6), color: 0x2a9d8f, p: [0, 2.35, -1.7], r: [-0.25, 0, 0] },
          { geo: box(2.2, 0.12, 0.5), color: 0x6b4a2a, p: [0, 0.5, -2.4] },
          { geo: box(0.08, 0.5, 0.08), color: 0x6b4a2a, p: [-1, 0.25, -2.4] },
          { geo: box(0.08, 0.5, 0.08), color: 0x6b4a2a, p: [1, 0.25, -2.4] },
          { geo: cyl(0.18, 0.22, 0.3, 7), color: 0x9a9a9a, p: [0.6, 1.25, -1.0] },
          { geo: box(1.6, 0.4, 0.06), color: 0xffd166, p: [0, 2.0, -1.23] },
        ]);
      case 'shop':
        return buildColored([
          { geo: box(4, 3, 4), color: 0xffffff, p: [0, 1.5, 0] },
          { geo: box(3.2, 1.9, 0.05), color: 0x3a2a1e, p: [0, 1.05, -2.01] },
          { geo: box(4.4, 0.06, 1.6), color: 0xd9d2c5, p: [0, 2.6, -2.6], r: [-0.3, 0, 0] },
          { geo: box(3.6, 0.5, 0.06), color: 0xe63946, p: [0, 2.85, -2.03] },
          { geo: box(4.2, 0.12, 4.2), color: 0x9a9a9a, p: [0, 3.05, 0] },
        ]);
      case 'pole':
        return buildColored([
          { geo: cyl(0.1, 0.15, 8.5, 5), color: 0xa9a59c, p: [0, 4.25, 0] },
          { geo: box(1.8, 0.12, 0.12), color: 0x7a756c, p: [0, 7.8, 0] },
          { geo: box(0.12, 0.2, 0.12), color: 0xe8e8e8, p: [-0.8, 7.95, 0] },
          { geo: box(0.12, 0.2, 0.12), color: 0xe8e8e8, p: [0.8, 7.95, 0] },
        ]);
      case 'haystack':
        return buildColored([
          { geo: cyl(1.3, 1.5, 1.6, 8), color: 0xd6b354, p: [0, 0.8, 0] },
          { geo: cone(1.45, 2.0, 8), color: 0xc9a443, p: [0, 2.6, 0] },
          { geo: cyl(0.06, 0.06, 1.2, 4), color: 0x5b4027, p: [0, 3.9, 0] },
        ]);
      case 'paddy':
        return buildColored([
          { geo: box(1, 0.35, 1), color: 0xffffff, p: [0, 0.12, 0] },
        ]);
      case 'pond':
        return buildColored([{ geo: cyl(1, 1, 0.1, 14), color: 0x4f7f8f, p: [0, 0.06, 0] }]);
      case 'building':
        return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      case 'pavement':
        return buildColored([{ geo: box(1, 0.3, 1), color: 0xffffff, p: [0, 0.1, 0] }]);
      case 'shrub':
        return buildColored([{ geo: ico(0.8), color: 0x4f8132, p: [0, 0.5, 0], s: [1.3, 0.8, 1.1] }]);
      case 'billboardFrame':
        return buildColored([
          { geo: box(0.2, 6, 0.2), color: 0x555555, p: [-2.6, 3, 0.1] },
          { geo: box(0.2, 6, 0.2), color: 0x555555, p: [2.6, 3, 0.1] },
          { geo: box(6.4, 3.4, 0.15), color: 0x333333, p: [0, 4.6, 0.12] },
        ]);
      case 'crate':
        return buildColored([
          { geo: box(0.7, 0.45, 0.5), color: 0x8a6238, p: [0, 0.225, 0] },
          { geo: box(0.64, 0.08, 0.44), color: 0xffffff, p: [0, 0.47, 0] },
        ]);
    }
  });
}
