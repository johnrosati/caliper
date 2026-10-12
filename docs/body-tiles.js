import * as THREE from 'three';

// Large faces contribute most of the surface area, so their normals define a
// useful top direction even when a plate is curved or tilted in the assembly.
export function broadFaceView(geometry) {
  const position = geometry.getAttribute('position');
  const indices = geometry.index;
  const triangleCount = Math.floor((indices?.count || position.count) / 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tensor = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < triangleCount; i++) {
    const vertex = j => indices ? indices.getX(i * 3 + j) : i * 3 + j;
    a.fromBufferAttribute(position, vertex(0));
    b.fromBufferAttribute(position, vertex(1));
    c.fromBufferAttribute(position, vertex(2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac);
    const area2 = normal.length();
    if (area2 < 1e-8) continue;
    normal.divideScalar(area2);
    const weight = area2 / 2;
    tensor[0] += weight * normal.x * normal.x;
    tensor[1] += weight * normal.x * normal.y;
    tensor[2] += weight * normal.x * normal.z;
    tensor[3] += weight * normal.y * normal.y;
    tensor[4] += weight * normal.y * normal.z;
    tensor[5] += weight * normal.z * normal.z;
  }
  const facing = new THREE.Vector3(1, 0.6, 0.8).normalize();
  for (let i = 0; i < 24; i++) {
    const next = new THREE.Vector3(
      tensor[0] * facing.x + tensor[1] * facing.y + tensor[2] * facing.z,
      tensor[1] * facing.x + tensor[3] * facing.y + tensor[4] * facing.z,
      tensor[2] * facing.x + tensor[4] * facing.y + tensor[5] * facing.z
    );
    if (next.lengthSq() < 1e-12) break;
    facing.copy(next.normalize());
  }
  const reference = Math.abs(facing.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = reference.addScaledVector(facing, -reference.dot(facing)).normalize();
  const v = new THREE.Vector3().crossVectors(facing, u).normalize();
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const point = new THREE.Vector3();
  let xx = 0; let xy = 0; let yy = 0;
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).sub(center);
    const x = point.dot(u);
    const y = point.dot(v);
    xx += x * x;
    xy += x * y;
    yy += y * y;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const up = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).normalize();
  const right = new THREE.Vector3().crossVectors(up, facing).normalize();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).sub(center);
    const values = [point.dot(right), point.dot(up), point.dot(facing)];
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[axis]);
      max[axis] = Math.max(max[axis], values[axis]);
    }
  }
  center.addScaledVector(right, (min[0] + max[0]) / 2)
    .addScaledVector(up, (min[1] + max[1]) / 2)
    .addScaledVector(facing, (min[2] + max[2]) / 2);
  return { center, facing, up, spans: max.map((value, index) => value - min[index]) };
}

export function createBodyTileRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(240, 170, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2923');
  scene.add(new THREE.HemisphereLight(0xeaf5ed, 0x536d60, 1.8));
  const light = new THREE.DirectionalLight(0xffffff, 1.7);
  scene.add(light);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100000);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xa8c2b4, metalness: 0.08, roughness: 0.8, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4d7562, transparent: true, opacity: 0.7 });

  return {
    render(geometry, edgesGeometry) {
      const view = broadFaceView(geometry);
      const mesh = new THREE.Mesh(geometry, bodyMaterial);
      if (edgesGeometry) mesh.add(new THREE.LineSegments(edgesGeometry, edgeMaterial));
      scene.add(mesh);
      const [width, height, depth] = view.spans;
      const halfHeight = Math.max(height / 2, width / (2 * (240 / 170)), 1) * 1.16;
      camera.left = -halfHeight * (240 / 170);
      camera.right = -camera.left;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      const distance = Math.max(1000, Math.hypot(width, height, depth) * 2);
      camera.position.copy(view.center).addScaledVector(view.facing, distance);
      camera.up.copy(view.up);
      camera.lookAt(view.center);
      camera.far = distance * 3;
      camera.updateProjectionMatrix();
      light.position.copy(camera.position).addScaledVector(view.up, distance * 0.3);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(mesh);
      return { url, spans: view.spans };
    },
    dispose() { renderer.dispose(); }
  };
}
