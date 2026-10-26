import * as THREE from 'three';

// Closest points on two finite line segments, including parallel and crossing cases.
export function closestPointsBetweenSegments(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  const epsilon = 1e-12;
  let s;
  let t;

  if (a <= epsilon && e <= epsilon) {
    return { first: p1.clone(), second: p2.clone() };
  }
  if (a <= epsilon) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= epsilon) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const denominator = a * e - b * b;
      s = denominator > epsilon ? THREE.MathUtils.clamp((b * f - c * e) / denominator, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }

  return {
    first: p1.clone().addScaledVector(d1, s),
    second: p2.clone().addScaledVector(d2, t)
  };
}

export function straightEdgePoints(line, vertexIndex, cache) {
  let data = cache.get(line);
  if (!data) {
    const positions = line.geometry.getAttribute('position');
    const segments = [];
    const connected = new Map();
    const key = point => `${Math.round(point.x * 20)},${Math.round(point.y * 20)},${Math.round(point.z * 20)}`;
    for (let index = 0; index + 1 < positions.count; index += 2) {
      const ends = [new THREE.Vector3().fromBufferAttribute(positions, index),
        new THREE.Vector3().fromBufferAttribute(positions, index + 1)];
      const number = segments.length;
      segments.push(ends);
      for (const end of ends) {
        const endpoint = key(end);
        if (!connected.has(endpoint)) connected.set(endpoint, []);
        connected.get(endpoint).push(number);
      }
    }
    data = { segments, connected, key };
    cache.set(line, data);
  }
  const number = Math.floor(vertexIndex / 2);
  const segment = data.segments[number];
  if (!segment) return [];
  const visited = new Set([number]);
  const extend = (endpoint, previous) => {
    const points = [];
    let current = endpoint;
    let prior = previous;
    for (let steps = 0; steps < data.segments.length; steps++) {
      const forward = current.clone().sub(prior).normalize();
      let best = null;
      let bestAlignment = Math.cos(THREE.MathUtils.degToRad(3));
      for (const candidate of data.connected.get(data.key(current)) || []) {
        if (visited.has(candidate)) continue;
        const [a, b] = data.segments[candidate];
        const next = a.distanceToSquared(current) < b.distanceToSquared(current) ? b : a;
        const alignment = next.clone().sub(current).normalize().dot(forward);
        if (alignment > bestAlignment) { best = { candidate, next }; bestAlignment = alignment; }
      }
      if (!best) break;
      visited.add(best.candidate);
      points.push(best.next);
      prior = current;
      current = best.next;
    }
    return points;
  };
  return [...extend(segment[0], segment[1]).reverse(), ...segment,
    ...extend(segment[1], segment[0])];
}
