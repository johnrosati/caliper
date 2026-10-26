import { inBucket } from './bucket-membership.js?v=20261026-2607-ml02';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createBucketExplorer } from './bucket-explorer.js?v=20261026-2607-ml02-buckets01';
import { createOverview } from './bucket-overview.js?v=20261026-2607-ml02-buckets01';
import { closestPointsBetweenSegments } from './measurement-geometry.js?v=20260925-edgegap1';

const eyeOpenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
const eyeClosedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M4.2 8.2C2.7 10 2 12 2 12s3.6 6 10 6c1.8 0 3.4-.5 4.7-1.1M9.4 6.3c.8-.2 1.7-.3 2.6-.3 6.4 0 10 6 10 6s-.7 1.2-2 2.5"/></svg>';

const planningSidebar = document.getElementById('planning-sidebar');
const partsToggle = document.getElementById('toggle-parts');
const partsCollapsedKey = 'caliper-planning-parts-collapsed-v1';
function setPartsCollapsed(collapsed) {
  planningSidebar.classList.toggle('parts-collapsed', collapsed);
  partsToggle.setAttribute('aria-expanded', String(!collapsed));
  localStorage.setItem(partsCollapsedKey, String(collapsed));
}
setPartsCollapsed(true);
partsToggle.addEventListener('click', () => setPartsCollapsed(!planningSidebar.classList.contains('parts-collapsed')));
const planningView = document.getElementById('planning-view');
const sidebarWidthHandle = document.getElementById('sidebar-width-resize');
const sidebarWidthKey = 'caliper-planning-sidebar-width-v1';
let sidebarWidth = Number(localStorage.getItem(sidebarWidthKey)) || 380;
function setSidebarWidth(width) {
  const maxWidth = Math.max(300, planningView.clientWidth - 330);
  sidebarWidth = Math.max(300, Math.min(maxWidth, width));
  planningView.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  sidebarWidthHandle.setAttribute('aria-valuenow', String(Math.round(sidebarWidth)));
  sidebarWidthHandle.setAttribute('aria-valuemin', '300');
  sidebarWidthHandle.setAttribute('aria-valuemax', String(Math.round(maxWidth)));
}
setSidebarWidth(sidebarWidth);
let sidebarWidthDrag = null;
sidebarWidthHandle.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  sidebarWidthDrag = { x: event.clientX, width: planningSidebar.getBoundingClientRect().width };
  sidebarWidthHandle.setPointerCapture(event.pointerId);
  sidebarWidthHandle.classList.add('dragging');
  event.preventDefault();
});
sidebarWidthHandle.addEventListener('pointermove', event => {
  if (sidebarWidthDrag) setSidebarWidth(sidebarWidthDrag.width + sidebarWidthDrag.x - event.clientX);
});
function finishSidebarWidthDrag() {
  if (!sidebarWidthDrag) return;
  sidebarWidthDrag = null;
  sidebarWidthHandle.classList.remove('dragging');
  localStorage.setItem(sidebarWidthKey, String(sidebarWidth));
}
sidebarWidthHandle.addEventListener('pointerup', finishSidebarWidthDrag);
sidebarWidthHandle.addEventListener('pointercancel', finishSidebarWidthDrag);
sidebarWidthHandle.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  setSidebarWidth(sidebarWidth + (event.key === 'ArrowLeft' ? 30 : -30));
  localStorage.setItem(sidebarWidthKey, String(sidebarWidth));
});
window.addEventListener('resize', () => setSidebarWidth(sidebarWidth));
const bucketListElement = document.getElementById('bucket-list');
const partListElement = document.getElementById('part-list');
const listSplitKey = 'caliper-planning-list-split-v1';
let listSplit = Math.max(0.2, Math.min(0.8, Number(localStorage.getItem(listSplitKey)) || 0.48));
function setListSplit(value) {
  listSplit = Math.max(0.2, Math.min(0.8, value));
  planningSidebar.style.setProperty('--bucket-track', `${listSplit}fr`);
  planningSidebar.style.setProperty('--part-track', `${1 - listSplit}fr`);
  planningSidebar.style.setProperty('--bucket-mobile-height', `${Math.round(400 * listSplit)}px`);
  planningSidebar.style.setProperty('--part-mobile-height', `${Math.round(400 * (1 - listSplit))}px`);
  for (const handle of planningSidebar.querySelectorAll('.list-resize-handle')) handle.setAttribute('aria-valuenow', String(Math.round(listSplit * 100)));
}
setListSplit(listSplit);
for (const handle of planningSidebar.querySelectorAll('.list-resize-handle')) {
  let start = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const bucketHeight = bucketListElement.getBoundingClientRect().height;
    const total = bucketHeight + partListElement.getBoundingClientRect().height;
    start = { y: event.clientY, bucketHeight, total };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!start) return;
    const delta = event.clientY - start.y;
    const direction = handle.id === 'bucket-list-resize' ? 1 : -1;
    setListSplit((start.bucketHeight + direction * delta) / start.total);
  });
  const finish = () => {
    if (!start) return;
    start = null;
    handle.classList.remove('dragging');
    localStorage.setItem(listSplitKey, String(listSplit));
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const direction = handle.id === 'bucket-list-resize' ? 1 : -1;
    setListSplit(listSplit + (event.key === 'ArrowDown' ? 0.04 : -0.04) * direction);
    localStorage.setItem(listSplitKey, String(listSplit));
  });
}

const container = document.getElementById('canvas');
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(42, 1, 10, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 100;
controls.maxDistance = 50000;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;

const nudgeControl = new TransformControls(camera, renderer.domElement);
nudgeControl.setMode('translate');
nudgeControl.setSpace('world');
nudgeControl.setSize(0.85);
scene.add(nudgeControl.getHelper());
const nudgeProxy = new THREE.Object3D();
scene.add(nudgeProxy);
let nudgeMesh = null;
let nudgeBodyId = null;
let nudgeDragging = false;
let suppressSelectionClick = false;
const nudgeStartWorld = new THREE.Vector3();
const nudgeStartPosition = new THREE.Vector3();
const nudgeStartOffset = new THREE.Vector3();

const orientationHost = document.getElementById('orientation-cube');
const orientationScene = new THREE.Scene();
const orientationCamera = new THREE.OrthographicCamera(-1.55, 1.55, 1.55, -1.55, 0.1, 10);
const orientationRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
orientationRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
orientationRenderer.setSize(108, 108, false);
orientationHost.appendChild(orientationRenderer.domElement);
const viewDirections = {
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1)
};
const cubeFaces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
function orientationFace(name) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = ['top', 'front', 'right'].includes(name) ? '#f4f8fb' : '#dfe9f1';
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = '#9fb5c6';
  context.lineWidth = 11;
  context.strokeRect(7, 7, 242, 242);
  context.fillStyle = '#5f7b92';
  context.font = 'bold 39px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name.toUpperCase(), 128, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}
const orientationGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const orientationMesh = new THREE.Mesh(orientationGeometry, cubeFaces.map(orientationFace));
orientationMesh.add(new THREE.LineSegments(
  new THREE.EdgesGeometry(orientationGeometry),
  new THREE.LineBasicMaterial({ color: 0x829eB3 })
));
orientationScene.add(orientationMesh);
function snapOrientation(name) {
  if (!model) return;
  const distance = camera.position.distanceTo(controls.target);
  camera.position.copy(controls.target).addScaledVector(viewDirections[name], distance);
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
}
document.querySelectorAll('.orientation-views button').forEach(button => {
  button.addEventListener('click', () => snapOrientation(button.dataset.view));
});
const orientationRaycaster = new THREE.Raycaster();
const orientationPointer = new THREE.Vector2();
const cubeCanvas = orientationRenderer.domElement;
let cubePointerId = null;
let cubeStartX = 0;
let cubeStartY = 0;
let cubeLastX = 0;
let cubeLastY = 0;
let cubeDragged = false;
cubeCanvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !model) return;
  cubePointerId = event.pointerId;
  cubeStartX = cubeLastX = event.clientX;
  cubeStartY = cubeLastY = event.clientY;
  cubeDragged = false;
  cubeCanvas.setPointerCapture(event.pointerId);
  cubeCanvas.classList.add('dragging');
});
cubeCanvas.addEventListener('pointermove', event => {
  if (event.pointerId !== cubePointerId) return;
  if (Math.hypot(event.clientX - cubeStartX, event.clientY - cubeStartY) > 3) cubeDragged = true;
  if (cubeDragged) {
    const scale = 2 * Math.PI * controls.rotateSpeed / renderer.domElement.clientHeight;
    controls.rotateLeft((event.clientX - cubeLastX) * scale);
    controls.rotateUp((event.clientY - cubeLastY) * scale);
  }
  cubeLastX = event.clientX;
  cubeLastY = event.clientY;
});
function endCubeDrag(event) {
  if (event.pointerId !== cubePointerId) return;
  cubePointerId = null;
  cubeCanvas.classList.remove('dragging');
  if (cubeCanvas.hasPointerCapture(event.pointerId)) cubeCanvas.releasePointerCapture(event.pointerId);
}
cubeCanvas.addEventListener('pointerup', endCubeDrag);
cubeCanvas.addEventListener('pointercancel', endCubeDrag);
cubeCanvas.addEventListener('click', event => {
  if (cubeDragged) { cubeDragged = false; return; }
  const rect = cubeCanvas.getBoundingClientRect();
  orientationPointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
    -(event.clientY - rect.top) / rect.height * 2 + 1);
  orientationRaycaster.setFromCamera(orientationPointer, orientationCamera);
  const hit = orientationRaycaster.intersectObject(orientationMesh, false)[0];
  if (hit) snapOrientation(cubeFaces[hit.face.materialIndex]);
});
let activeOrientation = null;
function updateOrientationWidget() {
  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() < 0.01) direction.set(1, 0.7, 1);
  direction.normalize();
  orientationCamera.position.copy(direction).multiplyScalar(3.8);
  orientationCamera.quaternion.copy(camera.quaternion);
  orientationRenderer.render(orientationScene, orientationCamera);
  const closest = cubeFaces.find(name => direction.dot(viewDirections[name]) > 0.995) || null;
  if (closest !== activeOrientation) {
    activeOrientation = closest;
    document.querySelectorAll('.orientation-views button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === closest);
    });
  }
}

scene.add(new THREE.HemisphereLight(0xffffff, 0xa6b4c3, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(4000, 9000, 6000);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.7);
fill.position.set(-8000, 3000, -4000);
scene.add(fill);

let model;
let bounds;
let measuring = false;
const measuredEdges = [];
let measurementConnector = null;
let lastEdgePick = null;
const edgeChains = new WeakMap();
const mat = new THREE.MeshStandardMaterial({ color: 0xb9c6d0, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
const hardwareMat = new THREE.MeshStandardMaterial({ color: 0x96aabb, metalness: 0.15, roughness: 0.8, side: THREE.DoubleSide });
const selectedMat = new THREE.MeshStandardMaterial({ color: 0xf5c664, metalness: 0.12, roughness: 0.65, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x536c7e, transparent: true, opacity: 0.55 });
const measureEdgeMat = new THREE.LineBasicMaterial({ color: 0x859dad, transparent: true, opacity: 0.85 });
const hardwarePattern = /screw|nut|bolt|washer|anchor|hilti|threaded rod/i;
const objectById = new Map();
const selectedIds = new Set();
let report;
let plan;
let overview;
let bucketExplorer;
let isolatedBucketId = null;
let isolatedBodyId = null;
let expandedBucketId = null;
let explosionScope = null;
let explodeDistance = 1;
const explodedGroups = [];
const bucketSpread = new Map();
let draggingBucketId = null;
let renamingBucketId = null;
let showNewBodies = false;

function renameBucket(bucketId, proposedName) {
  const name = proposedName.trim();
  if (!name) return 'Enter a bucket name.';
  if (plan.buckets.some(bucket => bucket.id !== bucketId && bucket.name.toLowerCase() === name.toLowerCase())) {
    return 'Another bucket already has this name.';
  }
  const bucket = plan.buckets.find(item => item.id === bucketId);
  if (!bucket) return 'Bucket no longer exists.';
  bucket.name = name;
  renamingBucketId = null;
  savePlan();
  renderBuckets();
  overview?.refresh();
  return null;
}

function setMode(mode) {
  if (mode === 'overview' && !overview || mode === 'bucket' && !bucketExplorer) return;
  document.getElementById('planning-view').hidden = mode !== 'planning';
  document.getElementById('overview').hidden = mode !== 'overview';
  document.getElementById('bucket-view').hidden = mode !== 'bucket';
  document.body.classList.toggle('bucket-mode', mode === 'bucket');
  for (const name of ['planning', 'overview', 'bucket']) {
    const button = document.getElementById(`mode-${name}`);
    button.classList.toggle('active', name === mode);
    button.setAttribute('aria-pressed', String(name === mode));
  }
  overview?.hide(); bucketExplorer?.hide();
  if (mode === 'planning') resize();
  if (mode === 'overview') overview.show();
  if (mode === 'bucket') bucketExplorer.show();
}
for (const mode of ['planning', 'overview', 'bucket']) {
  document.getElementById(`mode-${mode}`).addEventListener('click', () => setMode(mode));
}
function moveBucket(fromId, targetId, before) {
  const from = plan.buckets.findIndex(bucket => bucket.id === fromId);
  if (from < 0 || fromId === targetId) return;
  const [moved] = plan.buckets.splice(from, 1);
  const target = plan.buckets.findIndex(bucket => bucket.id === targetId);
  if (target < 0) { plan.buckets.splice(from, 0, moved); return; }
  plan.buckets.splice(target + (before ? 0 : 1), 0, moved);
  savePlan(); renderBuckets(); overview?.refresh(); bucketExplorer?.refresh();
}

function updateViewControls() {
  const button = document.getElementById('explode');
  button.textContent = 'Explode';
  button.disabled = Boolean(isolatedBodyId);
  button.setAttribute('aria-pressed', String(Boolean(explosionScope)));
  document.getElementById('explode-distance-control').hidden = !explosionScope;
  document.getElementById('show-all').hidden = false;
  syncNudgeGizmo();
}

function restorePositions() {
  explosionScope = null;
  bucketSpread.clear();
  for (const group of explodedGroups) group.position.copy(group.userData.home);
  for (const mesh of objectById.values()) mesh.position.copy(mesh.userData.home);
}

function radialTargets(nodes) {
  if (!nodes.length) return [];
  model.updateMatrixWorld(true);
  const boxes = nodes.map(node => new THREE.Box3().setFromObject(node));
  const box = new THREE.Box3().makeEmpty();
  for (const partBox of boxes) box.union(partBox);
  const center = box.getCenter(new THREE.Vector3());
  const span = box.getSize(new THREE.Vector3()).length();
  const travel = Math.max(280, Math.min(1200, span * 0.16));
  const nearCenter = Math.max(1, span * 0.01);
  const partCenters = boxes.map(partBox => partBox.getCenter(new THREE.Vector3()));
  const partSizes = boxes.map(partBox => partBox.getSize(new THREE.Vector3()));
  const nearestCloseMatch = nodes.map((_, index) => {
    let nearest = -1;
    let nearestDistance = Infinity;
    for (let other = 0; other < nodes.length; other++) {
      if (other === index) continue;
      const similarSize = [0, 1, 2].every(axis => {
        const a = Math.max(partSizes[index].getComponent(axis), 1);
        const b = Math.max(partSizes[other].getComponent(axis), 1);
        return Math.max(a, b) / Math.min(a, b) <= 1.4;
      });
      if (!similarSize) continue;
      const distance = partCenters[index].distanceTo(partCenters[other]);
      // Long, narrow plates can sit several hundred millimetres apart while still
      // belonging to the same repeated pair (for example, adjacent subtreads).
      const closeEnough = distance < Math.min(partSizes[index].length(), partSizes[other].length()) * 0.25;
      if (closeEnough && distance < nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    }
    return nearest;
  });
  const fallback = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
  ];
  return nodes.map((node, index) => {
    if (nodes.length === 1) return node.userData.home.clone();
    const partCenter = partCenters[index];
    const neighbor = nearestCloseMatch[index];
    const paired = neighbor >= 0 && nearestCloseMatch[neighbor] === index;
    const direction = partCenter.clone().sub(paired ? partCenters[neighbor] : center);
    if (direction.length() < nearCenter) direction.copy(fallback[index % fallback.length]);
    direction.normalize();
    const dimensions = [partSizes[index].x, partSizes[index].y, partSizes[index].z];
    const thinAxis = dimensions.indexOf(Math.min(...dimensions));
    const otherDimensions = dimensions.filter((_, axis) => axis !== thinAxis);
    if (dimensions[thinAxis] < Math.min(...otherDimensions) * 0.2) {
      const normal = new THREE.Vector3();
      const offset = partCenter.getComponent(thinAxis) - center.getComponent(thinAxis);
      const sign = Math.abs(offset) > nearCenter ? Math.sign(offset) :
        Math.sign(direction.getComponent(thinAxis)) || (index % 2 ? -1 : 1);
      normal.setComponent(thinAxis, sign);
      direction.addScaledVector(normal, 0.75);
    }
    direction.normalize().multiplyScalar(travel);
    const parent = node.parent;
    const localCenter = parent.worldToLocal(partCenter.clone());
    const localEnd = parent.worldToLocal(partCenter.clone().add(direction));
    return node.userData.home.clone().add(localEnd.sub(localCenter));
  });
}

function setIsolation(bucketId) {
  restorePositions();
  isolatedBucketId = bucketId;
  isolatedBodyId = null;
  selectedIds.clear();
  renderBuckets();
  updateViewControls();
  fit();
}

function setBodyIsolation(bodyId) {
  restorePositions();
  isolatedBodyId = isolatedBodyId === bodyId ? null : bodyId;
  renderBuckets();
  focusPartRow(bodyId);
  fit();
}

function savePlan() {
  if (report) localStorage.setItem(`caliper-buckets-${report.sourceSha256}`, JSON.stringify(plan));
}

function nudgeOffset(bucketId, bodyId) {
  const values = plan?.viewNudges?.[bucketId]?.[bodyId];
  return values ? new THREE.Vector3().fromArray(values) : new THREE.Vector3();
}

function nudgeScope() {
  return explosionScope === 'bucket' ? isolatedBucketId : explosionScope === 'all' ? '__all__' : null;
}

function syncNudgeGizmo() {
  const eligible = nudgeScope() && explodeDistance > 0 && !measuring;
  const bodyId = eligible && selectedIds.size === 1 ? selectedIds.values().next().value : null;
  const mesh = bodyId ? objectById.get(bodyId) : null;
  if (!mesh?.visible) {
    nudgeControl.detach();
    nudgeMesh = null;
    nudgeBodyId = null;
    document.getElementById('nudge-help').hidden = true;
    return;
  }
  if (mesh !== nudgeMesh) {
    nudgeMesh = mesh;
    nudgeBodyId = bodyId;
    nudgeProxy.position.copy(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
    nudgeControl.attach(nudgeProxy);
  }
  document.getElementById('nudge-help').hidden = false;
}

nudgeControl.addEventListener('mouseDown', () => {
  if (!nudgeMesh) return;
  nudgeDragging = true;
  suppressSelectionClick = true;
  controls.enabled = false;
  nudgeStartWorld.copy(nudgeProxy.position);
  nudgeStartPosition.copy(nudgeMesh.position);
  nudgeStartOffset.copy(nudgeOffset(nudgeScope(), nudgeBodyId));
});
nudgeControl.addEventListener('objectChange', () => {
  if (!nudgeDragging || !nudgeMesh || explodeDistance === 0) return;
  const parent = nudgeMesh.parent;
  const localStart = parent.worldToLocal(nudgeStartWorld.clone());
  const localEnd = parent.worldToLocal(nudgeProxy.position.clone());
  const delta = localEnd.sub(localStart);
  nudgeMesh.position.copy(nudgeStartPosition).add(delta);
  const offset = nudgeStartOffset.clone().addScaledVector(delta, 1 / explodeDistance);
  plan.viewNudges ??= {};
  const scope = nudgeScope();
  plan.viewNudges[scope] ??= {};
  plan.viewNudges[scope][nudgeBodyId] = offset.toArray();
});
nudgeControl.addEventListener('mouseUp', () => {
  if (!nudgeDragging) return;
  nudgeDragging = false;
  controls.enabled = true;
  savePlan();
});
document.getElementById('reset-nudge').addEventListener('click', () => {
  const scope = nudgeScope();
  if (!nudgeBodyId || !scope) return;
  delete plan.viewNudges?.[scope]?.[nudgeBodyId];
  savePlan();
});

function updateSelection() {
  for (const part of report?.bodies ?? []) {
    const mesh = objectById.get(part.id);
    if (mesh) mesh.material = selectedIds.has(part.id) ? selectedMat : hardwarePattern.test(part.name) ? hardwareMat : mat;
  }
  const count = selectedIds.size;
  document.getElementById('selection-count').textContent = count ? `${count} part${count === 1 ? '' : 's'} selected` : 'No parts selected';
  document.querySelectorAll('.part-row').forEach(row => {
    row.classList.toggle('selected', selectedIds.has(row.dataset.id));
    row.querySelector('input').checked = selectedIds.has(row.dataset.id);
  });
  document.querySelectorAll('.bucket-details li[data-body-id]').forEach(row => {
    row.classList.toggle('selected', selectedIds.has(row.dataset.bodyId));
  });
  syncNudgeGizmo();
}

function focusPartRow(bodyId) {
  const list = document.getElementById('part-list');
  let row = [...list.querySelectorAll('.part-row')].find(entry => entry.dataset.id === bodyId);
  if (!row && document.getElementById('part-search').value) {
    document.getElementById('part-search').value = '';
    renderParts();
    row = [...list.querySelectorAll('.part-row')].find(entry => entry.dataset.id === bodyId);
  }
  if (!row) return;
  row.focus({ preventScroll: true });
  row.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function edgeOverlay(mesh) {
  let edges = mesh.getObjectByName('edge-overlay');
  if (!edges) {
    edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 38), edgeMat);
    edges.name = 'edge-overlay';
    mesh.add(edges);
  }
  return edges;
}

function syncEdgeVisibility() {
  for (const mesh of objectById.values()) {
    const show = mesh.visible;
    const edges = show ? edgeOverlay(mesh) : mesh.getObjectByName('edge-overlay');
    if (edges) {
      edges.visible = show;
      edges.material = measuring ? measureEdgeMat : edgeMat;
    }
  }
}

function updateMeasurePanel() {
  const hasMeasurement = measuredEdges.length > 0;
  document.getElementById('measure-panel').hidden = !measuring && !hasMeasurement;
  document.getElementById('measure').setAttribute('aria-pressed', String(measuring));
  document.getElementById('measure-copy').disabled = !hasMeasurement;
  document.querySelector('.viewport').classList.toggle('measuring', measuring);
  syncNudgeGizmo();
}

function clearMeasurement() {
  for (const edge of measuredEdges) {
    edge.highlight.removeFromParent();
    edge.highlight.geometry.dispose();
    edge.highlight.material.dispose();
  }
  measuredEdges.length = 0;
  measurementConnector?.removeFromParent();
  measurementConnector?.geometry.dispose();
  measurementConnector?.material.dispose();
  measurementConnector = null;
  document.getElementById('measure-title').textContent = 'Edge length';
  document.getElementById('measure-value').value = '';
  document.getElementById('measure-part').textContent = 'Click one edge for length, then a second for distance.';
  updateMeasurePanel();
}

function straightEdgePoints(line, vertexIndex) {
  let data = edgeChains.get(line);
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
    edgeChains.set(line, data);
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
  const before = extend(segment[0], segment[1]).reverse();
  const after = extend(segment[1], segment[0]);
  return [...before, ...segment, ...after];
}

function selectMeasuredEdge(hit) {
  if (!Number.isInteger(hit.index)) return;
  const points = straightEdgePoints(hit.object, hit.index);
  if (points.length < 2) return;
  const key = `${hit.object.uuid}:${[points[0], points.at(-1)]
    .map(point => point.toArray().map(value => value.toFixed(3)).join(','))
    .sort().join('|')}`;
  if (measuredEdges.some(edge => edge.key === key)) return;
  if (measuredEdges.length === 2) clearMeasurement();
  let lengthMm = 0;
  for (let index = 1; index < points.length; index++) {
    lengthMm += points[index - 1].clone().applyMatrix4(hit.object.matrixWorld)
      .distanceTo(points[index].clone().applyMatrix4(hit.object.matrixWorld));
  }
  if (lengthMm < 0.01) return;
  const material = new LineMaterial({ color: measuredEdges.length ? 0xff994a : 0xf05b65, linewidth: 5, depthTest: false });
  const highlight = new Line2(new LineGeometry().setFromPoints(points), material);
  highlight.name = 'measured-edge';
  highlight.renderOrder = 10;
  hit.object.parent.add(highlight);
  const id = hit.object.parent.userData.bodyId;
  const part = report.bodies.find(body => body.id === id);
  measuredEdges.push({ key, line: hit.object, points, highlight, label: part ? `${part.name} · ${id}` : id });
  const value = document.getElementById('measure-value');
  const description = document.getElementById('measure-part');
  if (measuredEdges.length === 1) {
    document.getElementById('measure-title').textContent = 'Edge length';
    value.value = `${(lengthMm / 25.4).toFixed(3)} in · ${lengthMm.toFixed(1)} mm`;
    description.textContent = `${measuredEdges[0].label} · Select a second edge for distance.`;
  } else {
    const first = measuredEdges[0];
    const second = measuredEdges[1];
    let closest = null;
    for (let i = 1; i < first.points.length; i++) {
      const a = first.points[i - 1].clone().applyMatrix4(first.line.matrixWorld);
      const b = first.points[i].clone().applyMatrix4(first.line.matrixWorld);
      for (let j = 1; j < second.points.length; j++) {
        const c = second.points[j - 1].clone().applyMatrix4(second.line.matrixWorld);
        const d = second.points[j].clone().applyMatrix4(second.line.matrixWorld);
        const candidate = closestPointsBetweenSegments(a, b, c, d);
        const distance = candidate.first.distanceTo(candidate.second);
        if (!closest || distance < closest.distance) closest = { ...candidate, distance };
      }
    }
    if (closest.distance > 0.01) {
      measurementConnector = new Line2(
        new LineGeometry().setFromPoints([closest.first, closest.second]),
        new LineMaterial({ color: 0xffd790, linewidth: 3, depthTest: false })
      );
      measurementConnector.name = 'measured-distance';
      measurementConnector.renderOrder = 11;
      scene.add(measurementConnector);
    }
    document.getElementById('measure-title').textContent = 'Edge distance';
    value.value = `${(closest.distance / 25.4).toFixed(3)} in · ${closest.distance.toFixed(1)} mm`;
    description.textContent = `${first.label} ↔ ${second.label}`;
  }
  updateMeasurePanel();
}

function renderParts() {
  if (!report) return;
  const list = document.getElementById('part-list');
  const listScroll = list.scrollTop;
  list.replaceChildren();
  const search = document.getElementById('part-search').value.trim().toLowerCase();
  const hideHardware = document.getElementById('hide-hardware').checked;
  const newBodyIds = new Set(report.refresh?.added || []);
  let shown = 0;
  for (const part of report.bodies) {
    const hardware = hardwarePattern.test(part.name);
    const mesh = objectById.get(part.id);
    const belongsToIsolatedBucket = !isolatedBucketId || inBucket(plan, part.id, isolatedBucketId);
    const hiddenBucket = !isolatedBucketId && !isolatedBodyId && plan.hiddenBuckets?.some(bucketId => inBucket(plan, part.id, bucketId));
    if (mesh) mesh.visible = belongsToIsolatedBucket && (!isolatedBodyId || part.id === isolatedBodyId)
      && !hiddenBucket && (isolatedBodyId || isolatedBucketId || !(hideHardware && hardware));
    if (!belongsToIsolatedBucket || (!isolatedBucketId && hideHardware && hardware)) continue;
    if (showNewBodies && !newBodyIds.has(part.id)) continue;
    if (search && !`${part.name} ${part.assemblyPath.join(' ')}`.toLowerCase().includes(search)) continue;
    shown++;
    const item = document.createElement('div');
    item.className = 'part-item';
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'part-row';
    row.dataset.id = part.id;
    row.title = `${part.name}\n${part.assemblyPath.join(' / ')}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.tabIndex = -1;
    check.checked = selectedIds.has(part.id);
    const label = document.createElement('span');
    label.textContent = part.name.replace(/^26-\d+_/, '');
    const badge = document.createElement('small');
    badge.textContent = plan.assignments[part.id] || (newBodyIds.has(part.id) ? 'NEW' : '');
    badge.classList.toggle('new-body-badge', newBodyIds.has(part.id) && !plan.assignments[part.id]);
    row.append(check, label, badge);
    row.addEventListener('click', () => {
      if (selectedIds.has(part.id)) selectedIds.delete(part.id); else selectedIds.add(part.id);
      updateSelection();
    });
    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'part-eye';
    eye.classList.toggle('active', isolatedBodyId === part.id);
    eye.setAttribute('aria-pressed', String(isolatedBodyId === part.id));
    eye.setAttribute('aria-label', `${isolatedBodyId === part.id ? 'Show previous view' : 'Isolate'} ${part.name}`);
    eye.title = isolatedBodyId === part.id ? 'Show previous view' : `Isolate ${part.name}`;
    eye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
    eye.addEventListener('click', () => setBodyIsolation(part.id));
    item.append(row, eye);
    list.append(item);
  }
  list.scrollTop = listScroll;
  document.getElementById('part-count').textContent = isolatedBucketId ? `${shown} in bucket` : `${shown} shown / ${report.bodies.length}`;
  updateSelection();
  syncEdgeVisibility();
}

function renderBuckets() {
  if (!plan) return;
  const list = document.getElementById('bucket-list');
  const select = document.getElementById('bucket-select');
  const selectedBucket = select.value;
  const listScroll = list.scrollTop;
  list.replaceChildren();
  select.replaceChildren(new Option('Choose a bucket', ''));
  document.getElementById('bucket-count').textContent = String(plan.buckets.length);
  if (!plan.buckets.length) {
    const empty = document.createElement('div'); empty.className = 'bucket-empty';
    empty.textContent = 'No buckets yet. Add one to start a work order plan.';
    list.append(empty);
  }
  for (const bucket of plan.buckets) {
    const members = report.bodies.filter(part => inBucket(plan, part.id, bucket.id));
    const count = members.length;
    const item = document.createElement('div'); item.className = 'bucket-item';
    item.dataset.bucketId = bucket.id;
    const row = document.createElement('div'); row.className = 'bucket-row';
    row.classList.toggle('isolated', isolatedBucketId === bucket.id);
    row.classList.toggle('expanded', expandedBucketId === bucket.id);
    const bucketHidden = plan.hiddenBuckets?.includes(bucket.id) || false;
    row.classList.toggle('hidden-bucket', bucketHidden && !isolatedBucketId);
    row.draggable = true;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-expanded', String(expandedBucketId === bucket.id));
    row.setAttribute('aria-label', `${expandedBucketId === bucket.id ? 'Collapse' : 'Show'} pieces in ${bucket.name}`);
    row.title = bucket.reason ? `${bucket.name} · ${bucket.kind} · ${bucket.reason}` : 'Click to show pieces · Drag to reorder';
    const grip = document.createElement('span'); grip.className = 'bucket-grip'; grip.textContent = '⠿';
    grip.setAttribute('aria-hidden', 'true');
    const chevron = document.createElement('span'); chevron.className = 'bucket-chevron';
    chevron.textContent = expandedBucketId === bucket.id ? '▾' : '▸';
    chevron.setAttribute('aria-hidden', 'true');
    const id = document.createElement('strong'); id.textContent = bucket.id;
    const label = document.createElement('span'); label.className = 'bucket-name'; label.textContent = bucket.name; label.title = bucket.name;
    const tally = document.createElement('small'); tally.textContent = bucket.linkedBodyIds ? `${count} shared` : String(count);
    const rename = document.createElement('button');
    rename.type = 'button'; rename.className = 'rename-bucket'; rename.textContent = '✎';
    rename.title = `Rename ${bucket.name}`;
    rename.setAttribute('aria-label', `Rename bucket ${bucket.name}`);
    rename.addEventListener('click', () => {
      renamingBucketId = renamingBucketId === bucket.id ? null : bucket.id;
      renderBuckets();
      list.querySelector('.bucket-rename-input')?.focus();
    });
    const isolate = document.createElement('button');
    isolate.type = 'button'; isolate.className = 'isolate-bucket';
    isolate.textContent = isolatedBucketId === bucket.id ? 'Show all' : 'Isolate';
    isolate.disabled = count === 0 && isolatedBucketId !== bucket.id;
    isolate.addEventListener('click', () => setIsolation(isolatedBucketId === bucket.id ? null : bucket.id));
    const hide = document.createElement('button');
    hide.type = 'button'; hide.className = 'hide-bucket visibility-eye';
    hide.innerHTML = bucketHidden ? eyeClosedIcon : eyeOpenIcon;
    hide.title = `${bucketHidden ? 'Show' : 'Hide'} ${bucket.name} in the full model`;
    hide.setAttribute('aria-label', hide.title);
    hide.disabled = Boolean(isolatedBucketId || isolatedBodyId) || (count === 0 && !bucketHidden);
    hide.addEventListener('click', () => {
      if (isolatedBucketId || isolatedBodyId) return;
      plan.hiddenBuckets ??= [];
      if (bucketHidden) plan.hiddenBuckets = plan.hiddenBuckets.filter(id => id !== bucket.id);
      else plan.hiddenBuckets.push(bucket.id);
      selectedIds.clear();
      savePlan(); renderBuckets();
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'delete-bucket'; remove.textContent = '×';
    remove.title = `Delete ${bucket.name}`;
    remove.setAttribute('aria-label', `Delete bucket ${bucket.name}`);
    remove.addEventListener('click', () => {
      const message = `Delete bucket “${bucket.name}”?${count ? ` This will clear its ${count} part/body assignment${count === 1 ? '' : 's'}.` : ''}`;
      if (!window.confirm(message)) return;
      const wasIsolated = isolatedBucketId === bucket.id;
      const wasBodyIsolated = isolatedBodyId && plan.assignments[isolatedBodyId] === bucket.id;
      if (wasIsolated) { restorePositions(); isolatedBucketId = null; }
      if (wasBodyIsolated) isolatedBodyId = null;
      if (expandedBucketId === bucket.id) expandedBucketId = null;
      plan.buckets = plan.buckets.filter(entry => entry.id !== bucket.id);
      for (const [bodyId, assignedBucket] of Object.entries(plan.assignments)) {
        if (assignedBucket === bucket.id) delete plan.assignments[bodyId];
      }
      if (plan.viewNudges) delete plan.viewNudges[bucket.id];
      if (plan.hiddenBuckets) plan.hiddenBuckets = plan.hiddenBuckets.filter(id => id !== bucket.id);
      savePlan(); renderBuckets();
      if (wasIsolated || wasBodyIsolated) fit();
    });
    row.append(grip, chevron, id, label, tally, rename, isolate, hide, remove);
    const toggleExpanded = () => {
      expandedBucketId = expandedBucketId === bucket.id ? null : bucket.id;
      renderBuckets();
    };
    row.addEventListener('click', event => {
      if (!event.target.closest('button')) toggleExpanded();
    });
    row.addEventListener('keydown', event => {
      if (event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); toggleExpanded();
    });
    item.append(row);
    if (renamingBucketId === bucket.id) {
      const editor = document.createElement('form'); editor.className = 'bucket-rename-editor';
      const input = document.createElement('input'); input.className = 'bucket-rename-input';
      input.type = 'text'; input.value = bucket.name; input.maxLength = 100;
      input.setAttribute('aria-label', `New name for ${bucket.name}`);
      const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Save';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => { renamingBucketId = null; renderBuckets(); });
      editor.addEventListener('submit', event => {
        event.preventDefault();
        const error = renameBucket(bucket.id, input.value);
        input.setCustomValidity(error || '');
        if (error) input.reportValidity();
      });
      input.addEventListener('input', () => input.setCustomValidity(''));
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); renamingBucketId = null; renderBuckets(); }
      });
      editor.append(input, save, cancel);
      item.append(editor);
    }
    if (expandedBucketId === bucket.id) {
      const details = document.createElement('div'); details.className = 'bucket-details';
      const heading = document.createElement('div'); heading.className = 'bucket-details-heading';
      heading.textContent = `Parts and bodies (${count})`;
      const names = document.createElement('ul');
      for (const part of members) {
        const entry = document.createElement('li');
        entry.dataset.bodyId = part.id;
        entry.title = part.assemblyPath.join(' / ');
        const choice = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = true;
        checkbox.setAttribute('aria-label', `Keep ${part.name} in ${bucket.name}`);
        const name = document.createElement('span'); name.textContent = part.name;
        const bodyId = document.createElement('small'); bodyId.textContent = part.id;
        choice.append(checkbox, name, bodyId);
        entry.append(choice);
        checkbox.addEventListener('change', () => {
          if (bucket.linkedBodyIds) {
            bucket.linkedBodyIds = checkbox.checked ? [...new Set([...bucket.linkedBodyIds, part.id])] : bucket.linkedBodyIds.filter(id => id !== part.id);
          } else if (checkbox.checked) plan.assignments[part.id] = bucket.id;
          else {
            delete plan.assignments[part.id];
            delete plan.viewNudges?.[bucket.id]?.[part.id];
            selectedIds.delete(part.id);
            if (isolatedBodyId === part.id) isolatedBodyId = null;
          }
          entry.classList.toggle('pending-removal', !checkbox.checked);
          const remaining = report.bodies.filter(body => inBucket(plan, body.id, bucket.id)).length;
          tally.textContent = String(remaining);
          heading.textContent = `Parts and bodies (${remaining})`;
          isolate.disabled = remaining === 0 && isolatedBucketId !== bucket.id;
          hide.disabled = Boolean(isolatedBucketId || isolatedBodyId) || (remaining === 0 && !bucketHidden);
          savePlan(); renderParts(); updateViewControls();
        });
        names.append(entry);
      }
      details.append(heading, names);
      item.append(details);
    }
    row.addEventListener('dragstart', event => {
      if (event.target.closest('button, input')) { event.preventDefault(); return; }
      draggingBucketId = bucket.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', bucket.id);
      item.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      draggingBucketId = null;
      list.querySelectorAll('.bucket-item').forEach(entry => entry.classList.remove('dragging', 'drop-before', 'drop-after'));
    });
    item.addEventListener('dragover', event => {
      if (!draggingBucketId || draggingBucketId === bucket.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const before = event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
      list.querySelectorAll('.bucket-item').forEach(entry => entry.classList.remove('drop-before', 'drop-after'));
      item.classList.add(before ? 'drop-before' : 'drop-after');
    });
    item.addEventListener('drop', event => {
      if (!draggingBucketId || draggingBucketId === bucket.id) return;
      event.preventDefault();
      const before = item.classList.contains('drop-before');
      const from = plan.buckets.findIndex(entry => entry.id === draggingBucketId);
      if (from < 0) return;
      const [moved] = plan.buckets.splice(from, 1);
      const target = plan.buckets.findIndex(entry => entry.id === bucket.id);
      plan.buckets.splice(target + (before ? 0 : 1), 0, moved);
      draggingBucketId = null;
      savePlan(); renderBuckets();
    });
    list.append(item);
    select.add(new Option(`${bucket.id} · ${bucket.name}`, bucket.id));
  }
  if (plan.buckets.some(bucket => bucket.id === selectedBucket)) select.value = selectedBucket;
  list.scrollTop = listScroll;
  renderParts();
  updateViewControls();
}

function installPlanningUi() {
  const currentKey = `caliper-buckets-${report.sourceSha256}`;
  let saved = localStorage.getItem(currentKey);
  if (!saved && report.previousSourceSha256) {
    const previous = localStorage.getItem(`caliper-buckets-${report.previousSourceSha256}`);
    if (previous) {
      saved = previous;
      localStorage.setItem(currentKey, previous);
    }
  }
  plan = JSON.parse(saved || JSON.stringify(report.initialPlan || {buckets:[],assignments:{}}));
  // R02: doubled transverse plates define three midlanding rib modules.
  if (!plan.appliedMigrations?.includes('2607-midlanding-ribs-r02')) {
    const ids = ['2607-B023', '2607-B006', '2607-B024'];
    const seed = report.initialPlan;
    const targets = ids.map(id => seed.buckets.find(b => b.id === id));
    if (targets.every(Boolean)) {
      const oldIndex = plan.buckets.findIndex(b => b.id === '2607-B006');
      plan.buckets = plan.buckets.filter(b => !ids.includes(b.id));
      plan.buckets.splice(oldIndex < 0 ? 5 : oldIndex, 0, ...targets.map(b => structuredClone(b)));
      for (const [bodyId, bucketId] of Object.entries(seed.assignments)) {
        if (ids.includes(bucketId) && plan.assignments[bodyId] === '2607-B006') plan.assignments[bodyId] = bucketId;
      }
      plan.midlandingModuleSeams = seed.midlandingModuleSeams;
      plan.appliedMigrations = [...(plan.appliedMigrations || []), '2607-midlanding-ribs-r02'];
      savePlan();
    }
  }
  const newBodiesButton = document.getElementById('show-new-bodies');
  const newCount = report.refresh?.added?.length || 0;
  if (newCount) {
    newBodiesButton.hidden = false;
    newBodiesButton.textContent = `${newCount} new ${newCount === 1 ? 'body' : 'bodies'}`;
    newBodiesButton.addEventListener('click', () => {
      showNewBodies = !showNewBodies;
      newBodiesButton.classList.toggle('active', showNewBodies);
      newBodiesButton.setAttribute('aria-pressed', String(showNewBodies));
      if (isolatedBucketId) setIsolation(null);
      else renderParts();
      document.getElementById('part-list').scrollTop = 0;
    });
  }
  document.getElementById('part-search').addEventListener('input', renderParts);
  document.getElementById('hide-hardware').addEventListener('change', renderParts);
  document.getElementById('clear-selection').addEventListener('click', () => { selectedIds.clear(); updateSelection(); });
  document.getElementById('hide-all').addEventListener('click', () => {
    plan.hiddenBuckets = plan.buckets.map(bucket => bucket.id);
    savePlan();
    setIsolation(null);
  });
  document.getElementById('show-all').addEventListener('click', () => {
    plan.hiddenBuckets = [];
    savePlan();
    setIsolation(null);
  });
  document.getElementById('add-bucket').addEventListener('click', () => {
    const field = document.getElementById('bucket-name');
    const name = field.value.trim();
    if (!name) { field.focus(); return; }
    let number = 1;
    while (plan.buckets.some(bucket => bucket.id === `2607-B${String(number).padStart(2, '0')}`)) number++;
    plan.buckets.push({ id: `2607-B${String(number).padStart(2, '0')}`, name });
    field.value = '';
    savePlan(); renderBuckets();
  });
  document.getElementById('assign-bucket').addEventListener('click', () => {
    const bucket = document.getElementById('bucket-select').value;
    if (!bucket || !selectedIds.size) return;
    const target = plan.buckets.find(item => item.id === bucket);
    if (target?.linkedBodyIds) {
      target.linkedBodyIds = [...new Set([...target.linkedBodyIds, ...selectedIds])];
      savePlan(); renderBuckets();
      return;
    }
    for (const id of selectedIds) {
      const previous = plan.assignments[id];
      if (previous && previous !== bucket) delete plan.viewNudges?.[previous]?.[id];
      plan.assignments[id] = bucket;
    }
    if (isolatedBucketId) restorePositions();
    savePlan(); renderBuckets();
  });
  document.getElementById('export-plan').addEventListener('click', () => {
    const output = { job: report.job, source: report.sourceName, sourceSha256: report.sourceSha256, ...plan };
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '2607-bucket-plan.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderBuckets();
}

function fit() {
  if (!bounds) return;
  const viewBounds = new THREE.Box3().makeEmpty();
  for (const mesh of objectById.values()) if (mesh.visible) viewBounds.expandByObject(mesh);
  if (viewBounds.isEmpty()) viewBounds.copy(bounds);
  const center = viewBounds.getCenter(new THREE.Vector3());
  const size = viewBounds.getSize(new THREE.Vector3());
  const radius = size.length() / 2;
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const limitingHalfFov = Math.min(verticalHalfFov, Math.atan(Math.tan(verticalHalfFov) * camera.aspect));
  const distance = radius / Math.sin(limitingHalfFov) * 1.18;
  camera.position.copy(center).addScaledVector(new THREE.Vector3(.65, .44, .78).normalize(), distance);
  controls.target.copy(center);
  camera.near = Math.max(1, distance / 1000);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function resize() {
  const { width, height } = container.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(container);

async function load() {
  try {
    const [gltf, loadedReport] = await Promise.all([
      fetch('./assets/stair-step.gltf.gz?v=20261026-2607-ml02').then(async r => { if (!r.ok) throw new Error('Model download failed'); return new GLTFLoader().parseAsync(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text(), ''); }),
      fetch('./assets/step-manifest.json?v=20261026-2607-ml02', {cache:'no-store'}).then(r => r.json())
    ]);
    report = loadedReport;
    const seed = await fetch("./assets/proposed-plan.json?v=20261026-2607-ml02", {cache:"no-store"}).then(r => r.json());
    if (seed.sourceSha256 !== report.sourceSha256) throw new Error("Proposal/model source mismatch");
    report.initialPlan = seed;
    model = gltf.scene;
    model.traverse(node => {
      if (!node.isMesh) return;
      const match = node.name.match(/^body[-_]\d+/);
      if (match) {
        const id = match[0].replace('_', '-');
        node.userData.bodyId = id;
        node.userData.home = node.position.clone();
        objectById.set(id, node);
      }
      node.material = mat;
    });
    scene.add(model);
    model.updateMatrixWorld(true);
    for (const mesh of objectById.values()) mesh.userData.installedWorldMatrix = mesh.matrixWorld.clone();
    bounds = new THREE.Box3().setFromObject(model);
    let stairAssembly;
    model.traverse(node => { if (node.name.includes('HPC_stair_installedJR')) stairAssembly = node; });
    if (stairAssembly) {
      stairAssembly.children.forEach(group => {
        if (!group.children.length) return;
        group.userData.home = group.position.clone();
        explodedGroups.push(group);
      });
    }
    const min = bounds.min.y;
    const center = bounds.getCenter(new THREE.Vector3());
    const grid = new THREE.GridHelper(13000, 26, 0xc3d3df, 0xdce5ed);
    grid.position.set(center.x, min - 70, center.z);
    grid.material.transparent = true;
    grid.material.opacity = .22;
    scene.add(grid);
    document.getElementById('triangles').textContent = `${report.triangles.toLocaleString()} triangles`;
    document.getElementById('source').textContent = report.sourceName.replace(/JR\.STEP$/i, '');
    installPlanningUi();
    fit();
    overview = createOverview({
      objectById, report, getPlan: () => plan, radialTargets,
      openBucket: bucketId => { setMode('planning'); setIsolation(bucketId); },
      renameBucket,
      setBucketStage: (bucketId, stage) => {
        const bucket = plan.buckets.find(item => item.id === bucketId);
        if (!bucket) return;
        if (stage) bucket.stage = stage;
        else delete bucket.stage;
        savePlan();
        overview.refresh();
      },
      moveBucket
    });
    bucketExplorer = createBucketExplorer({ objectById, report, getPlan: () => plan, radialTargets, moveBucket });
    document.getElementById('mode-bucket').disabled = false;
    document.getElementById('mode-overview').disabled = false;
    document.getElementById('loading').classList.add('hidden');
  } catch (error) {
    document.getElementById('loading').textContent = `Unable to load model: ${error.message}`;
    console.error(error);
  }
}

document.getElementById('fit').addEventListener('click', fit);
function closeMeasureTool() {
  measuring = false;
  lastEdgePick = null;
  clearMeasurement();
  syncEdgeVisibility();
}
document.getElementById('measure').addEventListener('click', () => {
  if (measuring) {
    closeMeasureTool();
    return;
  }
  measuring = true;
  lastEdgePick = null;
  syncEdgeVisibility();
  updateMeasurePanel();
});
const measurePanel = document.getElementById('measure-panel');
let measurePanelDrag = null;
measurePanel.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('button, input, label')) return;
  const panelBounds = measurePanel.getBoundingClientRect();
  const viewBounds = document.querySelector('.viewport').getBoundingClientRect();
  measurePanelDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: panelBounds.left - viewBounds.left,
    top: panelBounds.top - viewBounds.top
  };
  measurePanel.style.left = `${measurePanelDrag.left}px`;
  measurePanel.style.top = `${measurePanelDrag.top}px`;
  measurePanel.style.right = 'auto';
  measurePanel.classList.add('dragging');
  measurePanel.setPointerCapture(event.pointerId);
  event.preventDefault();
});
measurePanel.addEventListener('pointermove', event => {
  if (!measurePanelDrag || event.pointerId !== measurePanelDrag.pointerId) return;
  const viewBounds = document.querySelector('.viewport').getBoundingClientRect();
  const maxLeft = Math.max(0, viewBounds.width - measurePanel.offsetWidth);
  const maxTop = Math.max(0, viewBounds.height - measurePanel.offsetHeight);
  measurePanel.style.left = `${THREE.MathUtils.clamp(measurePanelDrag.left + event.clientX - measurePanelDrag.startX, 0, maxLeft)}px`;
  measurePanel.style.top = `${THREE.MathUtils.clamp(measurePanelDrag.top + event.clientY - measurePanelDrag.startY, 0, maxTop)}px`;
});
function stopMeasurePanelDrag(event) {
  if (!measurePanelDrag || event.pointerId !== measurePanelDrag.pointerId) return;
  measurePanelDrag = null;
  measurePanel.classList.remove('dragging');
}
measurePanel.addEventListener('pointerup', stopMeasurePanelDrag);
measurePanel.addEventListener('pointercancel', stopMeasurePanelDrag);
measurePanel.addEventListener('lostpointercapture', stopMeasurePanelDrag);
document.getElementById('measure-clear').addEventListener('click', closeMeasureTool);
document.getElementById('measure-value').addEventListener('click', event => event.currentTarget.select());
document.getElementById('measure-copy').addEventListener('click', async event => {
  const button = event.currentTarget;
  const input = document.getElementById('measure-value');
  let copied = false;
  try {
    await navigator.clipboard.writeText(input.value);
    copied = true;
  } catch {
    input.focus();
    input.select();
    copied = document.execCommand('copy');
  }
  if (!copied) return;
  button.classList.add('copied');
  button.title = 'Copied';
  setTimeout(() => {
    button.classList.remove('copied');
    button.title = 'Copy length';
  }, 1500);
});
let refitTimer;
function refitAfterExplosion() {
  clearTimeout(refitTimer);
  if (isolatedBucketId) refitTimer = setTimeout(fit, 450);
}
document.getElementById('explode-distance').addEventListener('input', event => {
  explodeDistance = Number(event.currentTarget.value);
  document.getElementById('explode-distance-value').textContent = `${explodeDistance.toFixed(1)}×`;
  updateViewControls();
  refitAfterExplosion();
});
document.getElementById('explode').addEventListener('click', () => {
  if (explosionScope) {
    explosionScope = null;
  } else {
    restorePositions();
    if (explodeDistance === 0) {
      explodeDistance = 1;
      document.getElementById('explode-distance').value = '1';
      document.getElementById('explode-distance-value').textContent = '1.0×';
    }
    if (isolatedBucketId) {
      bucketSpread.clear();
      const meshes = report.bodies
        .filter(part => inBucket(plan, part.id, isolatedBucketId))
        .map(part => objectById.get(part.id))
        .filter(Boolean);
      radialTargets(meshes).forEach((target, index) => bucketSpread.set(meshes[index].userData.bodyId, target));
      explosionScope = 'bucket';
    } else {
      radialTargets(explodedGroups).forEach((target, index) => { explodedGroups[index].userData.spread = target; });
      explosionScope = 'all';
    }
  }
  updateViewControls();
  refitAfterExplosion();
});
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart;
let orbitDrag = null;
const orbitUp = new THREE.Vector3(0, 1, 0);
const orbitYaw = new THREE.Quaternion();
const orbitPitch = new THREE.Quaternion();
const orbitRight = new THREE.Vector3();
function rotateAroundGrabbedPoint(quaternion) {
  camera.position.sub(orbitDrag.pivot).applyQuaternion(quaternion).add(orbitDrag.pivot);
  controls.target.sub(orbitDrag.pivot).applyQuaternion(quaternion).add(orbitDrag.pivot);
  camera.lookAt(controls.target);
}
renderer.domElement.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !model || measuring || nudgeDragging || (nudgeMesh && nudgeControl.axis)) return;
  const box = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - box.left) / box.width) * 2 - 1,
    -((event.clientY - box.top) / box.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...objectById.values()].filter(mesh => mesh.visible), false)[0];
  if (!hit) return;
  orbitDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
    x: event.clientX, y: event.clientY, pivot: hit.point.clone() };
  renderer.domElement.setPointerCapture(event.pointerId);
  controls.enabled = false;
}, true);
renderer.domElement.addEventListener('pointermove', event => {
  if (!orbitDrag || event.pointerId !== orbitDrag.id || nudgeDragging) return;
  if (Math.hypot(event.clientX - orbitDrag.startX, event.clientY - orbitDrag.startY) <= 5) return;
  const dx = event.clientX - orbitDrag.x;
  const dy = event.clientY - orbitDrag.y;
  orbitDrag.x = event.clientX;
  orbitDrag.y = event.clientY;
  const scale = 2 * Math.PI * controls.rotateSpeed / renderer.domElement.clientHeight;
  orbitYaw.setFromAxisAngle(orbitUp, -dx * scale);
  rotateAroundGrabbedPoint(orbitYaw);
  orbitRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  orbitPitch.setFromAxisAngle(orbitRight, -dy * scale);
  rotateAroundGrabbedPoint(orbitPitch);
}, true);
function endOrbitDrag(event) {
  if (!orbitDrag || event.pointerId !== orbitDrag.id) return;
  orbitDrag = null;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  if (!nudgeDragging) controls.enabled = true;
}
renderer.domElement.addEventListener('pointerup', endOrbitDrag, true);
renderer.domElement.addEventListener('pointercancel', endOrbitDrag, true);
function edgeHitKey(hit) {
  const positions = hit.object.geometry.getAttribute('position');
  const ends = [hit.index, hit.index + 1].map(index => [0, 1, 2]
    .map(axis => Math.round(positions.getComponent(index, axis) * 20)).join(','));
  return `${hit.object.parent.userData.bodyId}:${ends.sort().join('|')}`;
}
renderer.domElement.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
renderer.domElement.addEventListener('pointerup', event => {
  if (suppressSelectionClick) {
    suppressSelectionClick = false;
    return;
  }
  if (!model || !pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
  const box = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (measuring) {
    model.updateMatrixWorld(true);
    const worldPerPixel = 2 * camera.position.distanceTo(controls.target)
      * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / box.height;
    raycaster.params.Line.threshold = worldPerPixel * 4;
    const visibleEdges = [...objectById.values()]
      .filter(mesh => mesh.visible)
      .map(mesh => mesh.getObjectByName('edge-overlay'))
      .filter(edges => edges?.visible);
    const faceHit = raycaster.intersectObjects([...objectById.values()].filter(mesh => mesh.visible), false)[0];
    const lineHits = raycaster.intersectObjects(visibleEdges, false)
      .filter(hit => !faceHit || hit.distance <= faceHit.distance + raycaster.params.Line.threshold)
      .sort((a, b) => (a.distanceToRay ?? 0) - (b.distanceToRay ?? 0) || a.distance - b.distance);
    const seen = new Set();
    const candidates = lineHits.filter(hit => {
      const key = edgeHitKey(hit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
    const repeated = lastEdgePick && performance.now() - lastEdgePick.time < 2500
      && Math.hypot(event.clientX - lastEdgePick.x, event.clientY - lastEdgePick.y) < 7;
    const pickIndex = repeated ? (lastEdgePick.index + 1) % Math.max(candidates.length, 1) : 0;
    const lineHit = candidates[pickIndex];
    lastEdgePick = lineHit ? { x: event.clientX, y: event.clientY, time: performance.now(), index: pickIndex } : null;
    if (lineHit) selectMeasuredEdge(lineHit);
    else {
      clearMeasurement();
      document.getElementById('measure-part').textContent = 'Click closer to a visible edge.';
    }
    return;
  }
  if (measuredEdges.length) clearMeasurement();
  const hit = raycaster.intersectObjects([...objectById.values()].filter(mesh => mesh.visible), false)[0];
  if (!hit) return;
  const id = hit.object.userData.bodyId;
  const selecting = !selectedIds.has(id);
  if (selecting) selectedIds.add(id); else selectedIds.delete(id);
  if (selecting && isolatedBucketId && expandedBucketId !== isolatedBucketId) {
    expandedBucketId = isolatedBucketId;
    renderBuckets();
  } else {
    updateSelection();
  }
  if (selecting && isolatedBucketId) {
    const row = [...document.querySelectorAll('.bucket-details li[data-body-id]')]
      .find(entry => entry.dataset.bodyId === id);
    row?.scrollIntoView({ block: 'nearest' });
  }
  if (selecting) focusPartRow(id);
});
const animationTarget = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  if (document.getElementById('planning-view').hidden) return;
  for (const group of explodedGroups) {
    if (explosionScope === 'all') animationTarget.lerpVectors(group.userData.home, group.userData.spread, explodeDistance);
    else animationTarget.copy(group.userData.home);
    if (explosionScope && explodeDistance === 0) group.position.copy(group.userData.home);
    else group.position.lerp(animationTarget, 0.13);
  }
  for (const [id, mesh] of objectById) {
    if (nudgeDragging && mesh === nudgeMesh) continue;
    const spread = explosionScope === 'bucket' ? bucketSpread.get(id) : null;
    if (spread) {
      animationTarget.lerpVectors(mesh.userData.home, spread, explodeDistance);
    } else animationTarget.copy(mesh.userData.home);
    const values = plan?.viewNudges?.[nudgeScope()]?.[id];
    if (values) animationTarget.addScaledVector(new THREE.Vector3().fromArray(values), explodeDistance);
    if (explosionScope && explodeDistance === 0) mesh.position.copy(mesh.userData.home);
    else mesh.position.lerp(animationTarget, 0.13);
  }
  if (nudgeMesh && !nudgeDragging) {
    nudgeProxy.position.copy(new THREE.Box3().setFromObject(nudgeMesh).getCenter(new THREE.Vector3()));
  }
  controls.update();
  renderer.render(scene, camera);
  updateOrientationWidget();
}
resize();
animate();
load();
