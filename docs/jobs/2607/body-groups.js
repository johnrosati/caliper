import * as THREE from 'three';

const signatures = new WeakMap();
function signature(geometry) {
  if (signatures.has(geometry)) return signatures.get(geometry);
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index?.count ?? p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const edges = [];
  let area = 0;
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(p, index ? index.getX(i) : i);
    b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2);
    edges.push(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
  }
  // Intrinsic lengths are unaffected by the installed position or rotation.
  // Keep names and tessellation counts too; uncertain matches stay separate.
  edges.sort((a, b) => a - b);
  const result = { edges, area };
  signatures.set(geometry, result);
  return result;
}
function sameShape(a, b) {
  if (a.edges.length !== b.edges.length) return false;
  if (Math.abs(a.area - b.area) > Math.max(0.1, a.area * 0.0001)) return false;
  return a.edges.every((length, i) => Math.abs(length - b.edges[i]) < 0.04);
}
export function groupUniqueBodies(bodies, objectById) {
  const groups = [];
  for (const body of bodies) {
    const mesh = objectById.get(body.id);
    if (!mesh) continue;
    const shape = signature(mesh.geometry);
    const nameKey = body.name.toLowerCase().replace(/\s+/g, ' ').trim();
    let group = groups.find(item => item.nameKey === nameKey && sameShape(item.shape, shape));
    if (!group) {
      group = { id: body.id, name: body.name, nameKey, shape, ids: [], body };
      groups.push(group);
    }
    group.ids.push(body.id);
  }
  return groups;
}
