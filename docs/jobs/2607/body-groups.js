import * as THREE from 'three';

const signatures = new WeakMap();
function signature(geometry) {
  if (signatures.has(geometry)) return signatures.get(geometry);
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index?.count ?? p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const edges = [], triangles = [];
  let area = 0;
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(p, index ? index.getX(i) : i);
    b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2);
    const sides = [a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)].sort((x, y) => x - y);
    edges.push(...sides);
    triangles.push(sides);
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
  }
  // Intrinsic lengths are unaffected by the installed position or rotation.
  // Tessellation edge lengths and surface area are invariant under rigid placement.
  edges.sort((a, b) => a - b);
  triangles.sort((a, b) => Math.round(a[0] * 10) - Math.round(b[0] * 10) || Math.round(a[1] * 10) - Math.round(b[1] * 10) || Math.round(a[2] * 10) - Math.round(b[2] * 10));
  const result = { edges, triangles, area };
  signatures.set(geometry, result);
  return result;
}
function sameShape(a, b) {
  if (a.edges.length !== b.edges.length) return false;
  if (Math.abs(a.area - b.area) > Math.max(0.1, a.area * 0.0001)) return false;
  return a.edges.every((length, i) => Math.abs(length - b.edges[i]) < 0.04) &&
    a.triangles.every((triangle, i) => triangle.every((length, j) => Math.abs(length - b.triangles[i][j]) < 0.04));
}
export function groupUniqueBodies(bodies, objectById, { groupGenericNames = false } = {}) {
  const groups = [];
  for (const body of bodies) {
    const mesh = objectById.get(body.id);
    if (!mesh) continue;
    const shape = signature(mesh.geometry);
    const nameKey = groupGenericNames && /\bbody\s+\d+$/i.test(body.name)
      ? `generic:${(body.assemblyPath || []).join('/').toLowerCase()}:${body.material || ''}:${JSON.stringify(Object.entries(body.customProperties || {}).sort(([a],[b]) => a.localeCompare(b)))}`
      : body.name.toLowerCase().replace(/\s+/g, ' ').trim();
    let group = groups.find(item => item.nameKey === nameKey && sameShape(item.shape, shape));
    if (!group) {
      group = { id: body.id, name: body.name, nameKey, shape, ids: [], body };
      groups.push(group);
    }
    group.ids.push(body.id);
  }
  return groups;
}
