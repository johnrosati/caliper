import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { broadFaceView } from './body-tiles.js?v=20261013-light1';
import { closestPointsBetweenSegments, straightEdgePoints } from './measurement-geometry.js?v=20260925-tilefocus1';

export function createFocusedBodyViewer() {
  const stage = document.getElementById('overview-focus-stage');
  const fitButton = document.getElementById('overview-focus-fit');
  const measureButton = document.getElementById('overview-focus-measure');
  const panel = document.getElementById('overview-focus-measure-panel');
  const title = document.getElementById('overview-focus-measure-title');
  const readout = document.getElementById('overview-focus-measure-readout');
  const help = document.getElementById('overview-focus-measure-help');
  const copyButton = document.getElementById('overview-focus-measure-copy');
  const closeButton = document.getElementById('overview-focus-measure-close');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f8fa');
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa6b4c3, 1.8));
  const light = new THREE.DirectionalLight(0xffffff, 1.6);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.minDistance = 1;
  controls.maxDistance = 100000;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c6d0, metalness: 0.08, roughness: 0.8, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x536c7e, transparent: true, opacity: 0.72 });
  const measureEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x859dad, transparent: true, opacity: 0.95 });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const chainCache = new WeakMap();
  const selected = [];
  let mesh;
  let edges;
  let view;
  let active = false;
  let measuring = false;
  let connector;
  let pointerStart;
  let lastPick;

  function updatePanel() {
    panel.hidden = !measuring;
    measureButton.setAttribute('aria-pressed', String(measuring));
    stage.classList.toggle('measuring', measuring);
    if (edges) edges.material = measuring ? measureEdgeMaterial : edgeMaterial;
    copyButton.disabled = selected.length === 0;
  }

  function clearMeasurement() {
    for (const edge of selected) {
      edge.highlight.removeFromParent();
      edge.highlight.geometry.dispose();
      edge.highlight.material.dispose();
    }
    selected.length = 0;
    connector?.removeFromParent();
    connector?.geometry.dispose();
    connector?.material.dispose();
    connector = null;
    title.textContent = 'Edge length';
    readout.value = '';
    help.textContent = 'Click one edge for length, then a second for distance.';
    updatePanel();
  }

  function fit() {
    if (!view) return;
    const rect = stage.getBoundingClientRect();
    const aspect = Math.max(0.5, rect.width / Math.max(1, rect.height));
    const [width, height, depth] = view.spans;
    const halfHeight = Math.max(height / 2, width / (2 * aspect), 1) * 1.25;
    const distance = halfHeight / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + depth;
    camera.up.copy(view.up);
    camera.position.copy(view.center).addScaledVector(view.facing, distance);
    camera.near = Math.max(0.01, distance / 10000);
    camera.far = Math.max(distance * 20, 1000);
    camera.updateProjectionMatrix();
    controls.target.copy(view.center);
    controls.update();
    light.position.copy(camera.position).addScaledVector(view.up, distance * 0.3);
  }

  function selectEdge(hit) {
    if (!Number.isInteger(hit.index)) return;
    const points = straightEdgePoints(edges, hit.index, chainCache);
    if (points.length < 2) return;
    const key = [points[0], points.at(-1)]
      .map(point => point.toArray().map(value => value.toFixed(3)).join(','))
      .sort().join('|');
    if (selected.some(edge => edge.key === key)) return;
    if (selected.length === 2) clearMeasurement();
    let length = 0;
    for (let i = 1; i < points.length; i++) length += points[i - 1].distanceTo(points[i]);
    if (length < 0.01) return;
    const highlight = new Line2(
      new LineGeometry().setFromPoints(points),
      new LineMaterial({ color: selected.length ? 0xff994a : 0xf05b65, linewidth: 5, depthTest: false })
    );
    highlight.renderOrder = 10;
    mesh.add(highlight);
    selected.push({ key, points, highlight });
    if (selected.length === 1) {
      title.textContent = 'Edge length';
      readout.value = `${(length / 25.4).toFixed(3)} in · ${length.toFixed(1)} mm`;
      help.textContent = 'First edge selected. Click a second edge for distance.';
    } else {
      let closest;
      for (let i = 1; i < selected[0].points.length; i++) {
        for (let j = 1; j < selected[1].points.length; j++) {
          const candidate = closestPointsBetweenSegments(
            selected[0].points[i - 1], selected[0].points[i],
            selected[1].points[j - 1], selected[1].points[j]
          );
          const distance = candidate.first.distanceTo(candidate.second);
          if (!closest || distance < closest.distance) closest = { ...candidate, distance };
        }
      }
      if (closest.distance > 0.01) {
        connector = new Line2(
          new LineGeometry().setFromPoints([closest.first, closest.second]),
          new LineMaterial({ color: 0xffd790, linewidth: 3, depthTest: false })
        );
        connector.renderOrder = 11;
        mesh.add(connector);
      }
      title.textContent = 'Edge distance';
      readout.value = `${(closest.distance / 25.4).toFixed(3)} in · ${closest.distance.toFixed(1)} mm`;
      help.textContent = 'Shortest distance between the selected edges. Click another edge to start again.';
    }
    updatePanel();
  }

  function edgeHitKey(hit) {
    const positions = edges.geometry.getAttribute('position');
    const ends = [hit.index, hit.index + 1].map(index => [0, 1, 2]
      .map(axis => Math.round(positions.getComponent(index, axis) * 20)).join(','));
    return ends.sort().join('|');
  }

  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button === 0) pointerStart = [event.clientX, event.clientY];
  });
  renderer.domElement.addEventListener('pointerup', event => {
    const start = pointerStart;
    pointerStart = null;
    if (!active || !measuring || !start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const worldPerPixel = 2 * camera.position.distanceTo(controls.target)
      * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / rect.height;
    raycaster.params.Line.threshold = worldPerPixel * 4;
    const faceHit = raycaster.intersectObject(mesh, false)[0];
    const hits = raycaster.intersectObject(edges, false)
      .filter(hit => !faceHit || hit.distance <= faceHit.distance + raycaster.params.Line.threshold)
      .sort((a, b) => (a.distanceToRay ?? 0) - (b.distanceToRay ?? 0) || a.distance - b.distance);
    const seen = new Set();
    const candidates = hits.filter(hit => {
      const key = edgeHitKey(hit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
    const repeated = lastPick && performance.now() - lastPick.time < 2500
      && Math.hypot(event.clientX - lastPick.x, event.clientY - lastPick.y) < 7;
    const index = repeated ? (lastPick.index + 1) % Math.max(candidates.length, 1) : 0;
    const hit = candidates[index];
    lastPick = hit ? { x: event.clientX, y: event.clientY, time: performance.now(), index } : null;
    if (hit) selectEdge(hit);
    else {
      clearMeasurement();
      help.textContent = 'Click closer to a visible edge.';
    }
  });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
  fitButton.addEventListener('click', fit);
  measureButton.addEventListener('click', () => {
    measuring = !measuring;
    clearMeasurement();
  });
  closeButton.addEventListener('click', () => {
    measuring = false;
    clearMeasurement();
  });
  readout.addEventListener('click', () => readout.select());
  copyButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(readout.value); }
    catch { readout.focus(); readout.select(); document.execCommand('copy'); }
  });
  let panelDrag;
  panel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button, input')) return;
    const panelRect = panel.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    panelDrag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: panelRect.left - stageRect.left, top: panelRect.top - stageRect.top };
    panel.style.left = `${panelDrag.left}px`;
    panel.style.top = `${panelDrag.top}px`;
    panel.style.right = 'auto';
    panel.classList.add('dragging');
    panel.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  panel.addEventListener('pointermove', event => {
    if (!panelDrag || event.pointerId !== panelDrag.id) return;
    panel.style.left = `${THREE.MathUtils.clamp(panelDrag.left + event.clientX - panelDrag.x, 0, Math.max(0, stage.clientWidth - panel.offsetWidth))}px`;
    panel.style.top = `${THREE.MathUtils.clamp(panelDrag.top + event.clientY - panelDrag.y, 0, Math.max(0, stage.clientHeight - panel.offsetHeight))}px`;
  });
  const stopPanelDrag = event => {
    if (!panelDrag || event.pointerId !== panelDrag.id) return;
    panelDrag = null;
    panel.classList.remove('dragging');
  };
  panel.addEventListener('pointerup', stopPanelDrag);
  panel.addEventListener('pointercancel', stopPanelDrag);

  return {
    open({ geometry, edgesGeometry, background }) {
      if (mesh) scene.remove(mesh);
      clearMeasurement();
      measuring = false;
      updatePanel();
      panel.style.left = '';
      panel.style.top = '';
      panel.style.right = '';
      scene.background.set(background || '#f5f8fa');
      mesh = new THREE.Mesh(geometry, bodyMaterial);
      edges = new THREE.LineSegments(edgesGeometry || new THREE.EdgesGeometry(geometry, 38), edgeMaterial);
      mesh.add(edges);
      scene.add(mesh);
      view = broadFaceView(geometry);
      active = true;
      requestAnimationFrame(fit);
    },
    close() {
      active = false;
      measuring = false;
      clearMeasurement();
      if (mesh) scene.remove(mesh);
      mesh = null;
      edges = null;
      view = null;
      pointerStart = null;
      lastPick = null;
    },
    draw() {
      if (!active) return;
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (renderer.domElement.width !== Math.floor(width * renderer.getPixelRatio()) ||
          renderer.domElement.height !== Math.floor(height * renderer.getPixelRatio())) renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      controls.update();
      renderer.render(scene, camera);
    }
  };
}
