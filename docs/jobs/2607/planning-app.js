import { inBucket } from './bucket-membership.js?v=20261027-2607-og4';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createBucketExplorer } from './bucket-explorer.js?v=handle01-inches-easm02-20261027-2607-og4-buckets01';
import { createOverview } from './bucket-overview.js?v=20261027-2607-og4-buckets01';
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
  // Revised STEP: preserve browser assignments for surviving stable IDs,
  // seed only added bodies and drop bodies excluded from the refreshed model.
  if (plan.sourceSha256 !== report.sourceSha256) {
    const previous = plan;
    plan = structuredClone(report.initialPlan);
    const valid = new Set(report.bodies.map(body => body.id));
    const added = new Set(report.refresh?.added || []);
    const bucketIds = new Set(plan.buckets.map(bucket => bucket.id));
    for (const bucket of previous.buckets || []) {
      if (!bucketIds.has(bucket.id) && Object.entries(previous.assignments || {}).some(([id, bid]) => bid === bucket.id && valid.has(id))) {
        plan.buckets.push(bucket); bucketIds.add(bucket.id);
      } else if (bucketIds.has(bucket.id)) {
        const target = plan.buckets.find(b => b.id === bucket.id);
        target.name = bucket.name;
        if (bucket.stage) target.stage = bucket.stage;
      }
    }
    for (const [id, bid] of Object.entries(previous.assignments || {})) {
      if (valid.has(id) && !added.has(id) && bucketIds.has(bid)) plan.assignments[id] = bid;
    }
    plan.hiddenBuckets = (previous.hiddenBuckets || []).filter(id => bucketIds.has(id));
    plan.viewNudges = previous.viewNudges || {};
    savePlan();
  }
  // R03: consolidate landing components into MOD 3 / MOD 4 and number MOD 1–6.
  if (!plan.appliedMigrations?.includes('2607-six-modules-r03')) {
    const seed = report.initialPlan;
    const oldIds = new Set(['2607-B003','2607-B006','2607-B007','2607-B008','2607-B023','2607-B024']);
    for (const [bodyId, bucketId] of Object.entries(seed.assignments)) {
      if (['2607-B003','2607-B006'].includes(bucketId) && oldIds.has(plan.assignments[bodyId])) plan.assignments[bodyId] = bucketId;
    }
    const moduleIds = ['2607-B001','2607-B002','2607-B003','2607-B006','2607-B004','2607-B005'];
    const removed = new Set(['2607-B007','2607-B008','2607-B023','2607-B024']);
    for (const id of moduleIds) {
      const target = seed.buckets.find(b => b.id === id);
      const current = plan.buckets.find(b => b.id === id);
      if (current) Object.assign(current, structuredClone(target));
      else plan.buckets.push(structuredClone(target));
    }
    plan.buckets = plan.buckets.filter(b => !removed.has(b.id) || Object.values(plan.assignments).includes(b.id));
    plan.buckets.sort((a,b) => (moduleIds.includes(a.id) ? moduleIds.indexOf(a.id) : 100) - (moduleIds.includes(b.id) ? moduleIds.indexOf(b.id) : 100));
    plan.hiddenBuckets = (plan.hiddenBuckets || []).filter(id => !removed.has(id));
    plan.midlandingModuleSeams = seed.midlandingModuleSeams;
    plan.appliedMigrations = [...(plan.appliedMigrations || []), '2607-six-modules-r03'];
    savePlan();
  }
  // R04: distribute shop-welded post sleeves without changing other assignments.
  if (!plan.appliedMigrations?.includes('2607-sleeves-r04')) {
    const groups = {'2607-B001':[312,313], '2607-B002':[314,315,317,339],
      '2607-B003':[316,318,319,320], '2607-B006':[321,322,323,324],
      '2607-B004':[325,328], '2607-B005':[326,327]};
    for (const [bucketId, indices] of Object.entries(groups)) {
      for (const i of indices) plan.assignments[`body-${String(i).padStart(4,'0')}`] = bucketId;
    }
    plan.buckets = plan.buckets.filter(b => b.id !== '2607-B018');
    plan.hiddenBuckets = (plan.hiddenBuckets || []).filter(id => id !== '2607-B018');
    plan.appliedMigrations = [...(plan.appliedMigrations || []), '2607-sleeves-r04'];
    savePlan();
  }
  // Separate the 20 stair guardrail panels; opening-guard glass stays untouched.
  if (!plan.appliedMigrations?.includes('2607-stair-glass-20-v1')) {
    const id = '2607-STAIR-GLASS';
    if (!plan.buckets.some(b => b.id === id)) plan.buckets.splice(1,0,structuredClone(report.initialPlan.buckets.find(b => b.id === id)));
    for (let i=870;i<890;i++) plan.assignments[`body-${String(i).padStart(4,'0')}`] = id;
    plan.hiddenBuckets = [...new Set([...(plan.hiddenBuckets || []),id])];
    plan.appliedMigrations = [...(plan.appliedMigrations || []),'2607-stair-glass-20-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-opening-guard-v1')) {
    const id = '2607-OPENING-GUARD';
    if (!plan.buckets.some(b => b.id === id)) plan.buckets.splice(2,0,structuredClone(report.initialPlan.buckets.find(b => b.id === id)));
    for (const body of report.bodies) {
      if (body.assemblyPath.some(path => path.includes('OPENING GUARD ASM'))) plan.assignments[body.id] = id;
    }
    plan.appliedMigrations = [...(plan.appliedMigrations || []),'2607-opening-guard-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-opening-glass-v1')) {
    const id = '2607-OPENING-GLASS';
    if (!plan.buckets.some(b => b.id === id)) plan.buckets.splice(3,0,structuredClone(report.initialPlan.buckets.find(b => b.id === id)));
    const glassIds = ["body-0998", "body-0999", "body-1000", "body-1001", "body-1002", "body-1003", "body-1004", "body-1005", "body-1006", "body-1007", "body-1008", "body-1009", "body-1010", "body-1011", "body-1012", "body-1013", "body-1014", "body-1015", "body-1016", "body-1017", "body-1018", "body-1019", "body-1020", "body-1021", "body-1022", "body-1023", "body-1024", "body-1025", "body-1026", "body-1027", "body-1028", "body-1029", "body-1030"];
    for (const bodyId of glassIds) plan.assignments[bodyId] = id;
    if ((plan.hiddenBuckets || []).includes('2607-OPENING-GUARD')) plan.hiddenBuckets = [...new Set([...plan.hiddenBuckets,id])];
    plan.appliedMigrations = [...(plan.appliedMigrations || []),'2607-opening-glass-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-carpet-v1')) {
    const id = '2607-CARPET';
    if (!plan.buckets.some(b => b.id === id)) plan.buckets.splice(4,0,structuredClone(report.initialPlan.buckets.find(b => b.id === id)));
    const carpetIds = ["body-0387", "body-0388", "body-0389", "body-0404", "body-0405", "body-0406", "body-0421", "body-0422", "body-0423", "body-0438", "body-0439", "body-0440", "body-0455", "body-0456", "body-0457", "body-0497", "body-0498", "body-0499", "body-0514", "body-0515", "body-0516", "body-0531", "body-0532", "body-0533", "body-0548", "body-0549", "body-0550", "body-0565", "body-0566", "body-0567", "body-0582", "body-0583", "body-0584", "body-0638", "body-0639", "body-0640", "body-0665", "body-0666", "body-0667", "body-0682", "body-0683", "body-0684", "body-0699", "body-0700", "body-0701", "body-0716", "body-0717", "body-0718", "body-0751", "body-0752", "body-0753", "body-0768", "body-0769", "body-0770", "body-0785", "body-0786", "body-0787", "body-0802", "body-0803", "body-0804", "body-0819", "body-0820", "body-0821", "body-0836", "body-0837", "body-0838"];
    const wasHidden = (plan.hiddenBuckets || []).includes('2607-NEW-STEP2');
    for (const bodyId of carpetIds) plan.assignments[bodyId] = id;
    if (wasHidden) plan.hiddenBuckets = [...new Set([...(plan.hiddenBuckets || []),id])];
    plan.appliedMigrations = [...(plan.appliedMigrations || []),'2607-carpet-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-stair-trim-v1')) {
    const id='2607-STAIR-TRIM';
    if (!plan.buckets.some(b=>b.id===id)) plan.buckets.splice(5,0,structuredClone(report.initialPlan.buckets.find(b=>b.id===id)));
    const ids=["body-0377", "body-0378", "body-0379", "body-0380", "body-0381", "body-0382", "body-0383", "body-0384", "body-0385", "body-0386", "body-0390", "body-0391", "body-0392", "body-0393", "body-0394", "body-0395", "body-0396", "body-0397", "body-0398", "body-0399", "body-0400", "body-0401", "body-0402", "body-0403", "body-0407", "body-0408", "body-0409", "body-0410", "body-0411", "body-0412", "body-0413", "body-0414", "body-0415", "body-0416", "body-0417", "body-0418", "body-0419", "body-0420", "body-0424", "body-0425", "body-0426", "body-0427", "body-0428", "body-0429", "body-0430", "body-0431", "body-0432", "body-0433", "body-0434", "body-0435", "body-0436", "body-0437", "body-0441", "body-0442", "body-0443", "body-0444", "body-0445", "body-0446", "body-0447", "body-0448", "body-0449", "body-0450", "body-0451", "body-0452", "body-0453", "body-0454", "body-0458", "body-0459", "body-0460", "body-0461", "body-0463", "body-0464", "body-0465", "body-0466", "body-0467", "body-0468", "body-0469", "body-0470", "body-0471", "body-0472", "body-0473", "body-0474", "body-0475", "body-0476", "body-0477", "body-0478", "body-0479", "body-0480", "body-0481", "body-0482", "body-0487", "body-0488", "body-0489", "body-0490", "body-0491", "body-0492", "body-0493", "body-0494", "body-0495", "body-0496", "body-0500", "body-0501", "body-0502", "body-0503", "body-0504", "body-0505", "body-0506", "body-0507", "body-0508", "body-0509", "body-0510", "body-0511", "body-0512", "body-0513", "body-0517", "body-0518", "body-0519", "body-0520", "body-0521", "body-0522", "body-0523", "body-0524", "body-0525", "body-0526", "body-0527", "body-0528", "body-0529", "body-0530", "body-0534", "body-0535", "body-0536", "body-0537", "body-0538", "body-0539", "body-0540", "body-0541", "body-0542", "body-0543", "body-0544", "body-0545", "body-0546", "body-0547", "body-0551", "body-0552", "body-0553", "body-0554", "body-0555", "body-0556", "body-0557", "body-0558", "body-0559", "body-0560", "body-0561", "body-0562", "body-0563", "body-0564", "body-0568", "body-0569", "body-0570", "body-0571", "body-0572", "body-0573", "body-0574", "body-0575", "body-0576", "body-0577", "body-0578", "body-0579", "body-0580", "body-0581", "body-0585", "body-0586", "body-0587", "body-0588", "body-0589", "body-0590", "body-0591", "body-0592", "body-0593", "body-0594", "body-0595", "body-0596", "body-0597", "body-0598", "body-0599", "body-0600", "body-0601", "body-0602", "body-0603", "body-0604", "body-0605", "body-0606", "body-0607", "body-0608", "body-0609", "body-0610", "body-0611", "body-0612", "body-0616", "body-0617", "body-0618", "body-0619", "body-0620", "body-0621", "body-0622", "body-0623", "body-0624", "body-0625", "body-0626", "body-0627", "body-0628", "body-0629", "body-0630", "body-0631", "body-0632", "body-0633", "body-0634", "body-0635", "body-0636", "body-0637", "body-0641", "body-0642", "body-0643", "body-0644", "body-0645", "body-0646", "body-0647", "body-0648", "body-0649", "body-0650", "body-0651", "body-0652", "body-0655", "body-0656", "body-0657", "body-0658", "body-0659", "body-0660", "body-0661", "body-0662", "body-0663", "body-0664", "body-0668", "body-0669", "body-0670", "body-0671", "body-0672", "body-0673", "body-0674", "body-0675", "body-0676", "body-0677", "body-0678", "body-0679", "body-0680", "body-0681", "body-0685", "body-0686", "body-0687", "body-0688", "body-0689", "body-0690", "body-0691", "body-0692", "body-0693", "body-0694", "body-0695", "body-0696", "body-0697", "body-0698", "body-0702", "body-0703", "body-0704", "body-0705", "body-0706", "body-0707", "body-0708", "body-0709", "body-0710", "body-0711", "body-0712", "body-0713", "body-0714", "body-0715", "body-0719", "body-0720", "body-0721", "body-0722", "body-0723", "body-0724", "body-0725", "body-0726", "body-0727", "body-0728", "body-0729", "body-0730", "body-0731", "body-0732", "body-0733", "body-0734", "body-0735", "body-0736", "body-0737", "body-0738", "body-0741", "body-0742", "body-0743", "body-0744", "body-0745", "body-0746", "body-0747", "body-0748", "body-0749", "body-0750", "body-0754", "body-0755", "body-0756", "body-0757", "body-0758", "body-0759", "body-0760", "body-0761", "body-0762", "body-0763", "body-0764", "body-0765", "body-0766", "body-0767", "body-0771", "body-0772", "body-0773", "body-0774", "body-0775", "body-0776", "body-0777", "body-0778", "body-0779", "body-0780", "body-0781", "body-0782", "body-0783", "body-0784", "body-0788", "body-0789", "body-0790", "body-0791", "body-0792", "body-0793", "body-0794", "body-0795", "body-0796", "body-0797", "body-0798", "body-0799", "body-0800", "body-0801", "body-0805", "body-0806", "body-0807", "body-0808", "body-0809", "body-0810", "body-0811", "body-0812", "body-0813", "body-0814", "body-0815", "body-0816", "body-0817", "body-0818", "body-0822", "body-0823", "body-0824", "body-0825", "body-0826", "body-0827", "body-0828", "body-0829", "body-0830", "body-0831", "body-0832", "body-0833", "body-0834", "body-0835", "body-0839", "body-0840", "body-0841", "body-0842", "body-0843", "body-0844", "body-0845", "body-0846", "body-0847", "body-0848", "body-0849", "body-0850", "body-0851", "body-0852", "body-0853", "body-0854", "body-0855", "body-0856", "body-0857", "body-0858", "body-0859", "body-0860", "body-0861", "body-0862", "body-0863", "body-0864", "body-0865", "body-0866", "body-0867", "body-0869"];
    for (const bodyId of ids) plan.assignments[bodyId]=id;
    if ((plan.hiddenBuckets||[]).includes('2607-NEW-STEP2')) plan.hiddenBuckets=[...new Set([...plan.hiddenBuckets,id])];
    plan.appliedMigrations=[...(plan.appliedMigrations||[]),'2607-stair-trim-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-handrail-assembly-v1')) {
    const id='2607-HANDRAILS';
    if (!plan.buckets.some(b=>b.id===id)) plan.buckets.splice(6,0,structuredClone(report.initialPlan.buckets.find(b=>b.id===id)));
    const ids=["body-0890", "body-0891", "body-0892", "body-0893", "body-0894", "body-0895", "body-0896", "body-0897", "body-0898", "body-0899", "body-0900", "body-0901", "body-0902", "body-0903", "body-0904", "body-0905", "body-0906", "body-0907", "body-0908", "body-0909", "body-0910", "body-0911", "body-0912", "body-0913", "body-0914", "body-0915", "body-0916", "body-0917", "body-0918", "body-0919", "body-0920", "body-0921", "body-0922", "body-0923", "body-0924", "body-0925", "body-0926", "body-0927", "body-0928", "body-0929", "body-0930", "body-0931", "body-0932", "body-0933", "body-0934", "body-0935", "body-0936", "body-0937", "body-0938", "body-0939", "body-0940", "body-0941", "body-0942", "body-0943", "body-0944", "body-0945", "body-0946", "body-0947", "body-0948", "body-0949", "body-0950", "body-0951", "body-0952", "body-0953", "body-0954", "body-0955", "body-0956", "body-0957", "body-0958", "body-0959", "body-0960", "body-0961", "body-0962", "body-0963", "body-0964", "body-0965", "body-0329", "body-0330", "body-0331", "body-0332", "body-0333", "body-0334", "body-0335", "body-0336", "body-0337", "body-0338"];
    for (const bodyId of ids) plan.assignments[bodyId]=id;
    plan.buckets=plan.buckets.filter(b=>b.id!=='2607-B019');
    plan.hiddenBuckets=(plan.hiddenBuckets||[]).filter(b=>b!=='2607-B019');
    if (plan.hiddenBuckets.includes('2607-NEW-STEP2')) plan.hiddenBuckets=[...new Set([...plan.hiddenBuckets,id])];
    plan.appliedMigrations=[...(plan.appliedMigrations||[]),'2607-handrail-assembly-v1'];
    savePlan();
  }
  if (!plan.appliedMigrations?.includes('2607-og-four-sides-v1')) {
    const groups={"North": ["body-0967", "body-0972", "body-0977", "body-0978", "body-0979", "body-0984", "body-0985", "body-0990", "body-0991", "body-0992", "body-0993", "body-0994", "body-0997", "body-1031", "body-1032", "body-1033", "body-1034", "body-1035", "body-1036", "body-1037", "body-1038", "body-1039", "body-1040", "body-1041", "body-1042", "body-1043", "body-1044", "body-1045", "body-1046", "body-1047", "body-1048", "body-1049", "body-1050", "body-1051", "body-1052", "body-1053", "body-1054", "body-1055", "body-1056", "body-1057", "body-1058", "body-1059", "body-1060", "body-1061", "body-1062", "body-1063", "body-1064", "body-1065", "body-1066", "body-1067", "body-1068", "body-1069", "body-1070", "body-1071", "body-1072", "body-1073", "body-1074", "body-1075", "body-1076", "body-1077", "body-1078", "body-1079", "body-1080", "body-1081", "body-1082", "body-1083", "body-1084", "body-1085", "body-1086", "body-1087", "body-1088", "body-1089", "body-1090", "body-1091", "body-1092", "body-1093", "body-1094", "body-1095", "body-1096", "body-1097", "body-1098", "body-1099", "body-1100", "body-1101", "body-1102", "body-1103", "body-1104", "body-1105", "body-1106", "body-1107", "body-1108", "body-1109", "body-1110", "body-1111", "body-1112", "body-1113", "body-1114", "body-1115", "body-1116", "body-1117", "body-1118", "body-1119", "body-1120", "body-1121", "body-1122", "body-1123", "body-1124", "body-1125", "body-1126", "body-1127", "body-1128", "body-1129", "body-1130", "body-1131", "body-1132", "body-1133", "body-1134", "body-1135", "body-1136", "body-1137", "body-1138", "body-1139", "body-1140", "body-1141", "body-1142", "body-1143", "body-1144", "body-1145", "body-1146", "body-1147", "body-1148", "body-1149", "body-1150", "body-1151", "body-1152", "body-1153", "body-1154", "body-1155", "body-1156", "body-1157", "body-1158", "body-1159", "body-1160", "body-1161", "body-1162", "body-1163", "body-1164", "body-1165", "body-1166", "body-1167", "body-1168", "body-1169", "body-1170", "body-1171", "body-1172", "body-1173", "body-1174", "body-1175", "body-1176", "body-1177", "body-1178", "body-1179", "body-1180", "body-1181", "body-1182", "body-1183", "body-1184", "body-1185", "body-1186", "body-1187", "body-1188", "body-1189", "body-1190", "body-1191", "body-1192", "body-1193", "body-1194", "body-1195", "body-1196", "body-1197", "body-1198", "body-1199", "body-1200", "body-1201", "body-1202", "body-1203", "body-1204", "body-1205", "body-1206", "body-1207", "body-1208", "body-1209", "body-1210", "body-1211", "body-1212", "body-1213", "body-1214", "body-1215", "body-1216", "body-1217", "body-1218", "body-1219", "body-1220", "body-1221", "body-1222", "body-1223", "body-1224", "body-1225", "body-1226", "body-1227", "body-1228", "body-1229", "body-1230", "body-1231", "body-1232", "body-1233", "body-1234", "body-1235", "body-1236", "body-1237", "body-1238", "body-1239", "body-1240", "body-1241", "body-1242", "body-1243", "body-1244", "body-1245", "body-1246", "body-1247", "body-1248", "body-1249", "body-1250", "body-1251", "body-1252", "body-1253", "body-1254", "body-1255", "body-1256", "body-1257", "body-1258", "body-1259", "body-1260", "body-1261", "body-1262", "body-1263", "body-1264", "body-1265", "body-1266", "body-1267", "body-1268", "body-1269", "body-1270", "body-1271", "body-1272", "body-1273", "body-1274", "body-1786", "body-1787", "body-1788", "body-1789", "body-1790", "body-1791", "body-1792", "body-1793", "body-1794", "body-1795", "body-1796", "body-1797", "body-1798", "body-1799", "body-1800", "body-1801", "body-1802", "body-1803", "body-1804", "body-1805", "body-1806", "body-1807", "body-1808", "body-1809", "body-1810", "body-1811", "body-1812", "body-1813", "body-1814", "body-1815", "body-1816", "body-1817", "body-1818", "body-1819", "body-1820", "body-1821", "body-1822", "body-1823", "body-1824", "body-1825", "body-1826", "body-1827", "body-1828", "body-1829", "body-1830", "body-1831", "body-1832", "body-1833", "body-1834", "body-1835", "body-1836", "body-1837", "body-1838", "body-1839", "body-1840", "body-1841", "body-1842", "body-1843", "body-1844", "body-1845", "body-1846", "body-1847", "body-1848", "body-1849", "body-1850", "body-1851", "body-1852", "body-1853", "body-1854", "body-1855", "body-1856", "body-1857", "body-1858", "body-1859", "body-1860", "body-1861", "body-1862", "body-1863", "body-1864", "body-1865", "body-1866", "body-1867", "body-1868", "body-1869", "body-1870", "body-1871", "body-1872", "body-1873", "body-1874", "body-1937", "body-1938", "body-1941", "body-1942", "body-1945", "body-1946"], "South": ["body-0969", "body-0970", "body-0974", "body-0975", "body-0980", "body-0987", "body-0988", "body-0989", "body-1397", "body-1398", "body-1399", "body-1400", "body-1401", "body-1402", "body-1403", "body-1404", "body-1405", "body-1406", "body-1407", "body-1408", "body-1409", "body-1410", "body-1411", "body-1412", "body-1413", "body-1414", "body-1415", "body-1416", "body-1417", "body-1418", "body-1419", "body-1420", "body-1421", "body-1422", "body-1423", "body-1424", "body-1425", "body-1426", "body-1427", "body-1428", "body-1429", "body-1430", "body-1431", "body-1432", "body-1433", "body-1434", "body-1435", "body-1436", "body-1437", "body-1438", "body-1439", "body-1440", "body-1441", "body-1442", "body-1443", "body-1444", "body-1445", "body-1446", "body-1447", "body-1448", "body-1449", "body-1450", "body-1451", "body-1452", "body-1453", "body-1454", "body-1455", "body-1456", "body-1457", "body-1458", "body-1459", "body-1460", "body-1461", "body-1462", "body-1463", "body-1464", "body-1465", "body-1466", "body-1467", "body-1468", "body-1469", "body-1470", "body-1471", "body-1472", "body-1473", "body-1474", "body-1475", "body-1476", "body-1477", "body-1478", "body-1479", "body-1480", "body-1481", "body-1482", "body-1483", "body-1484", "body-1485", "body-1486", "body-1487", "body-1488", "body-1489", "body-1490", "body-1491", "body-1492", "body-1493", "body-1494", "body-1495", "body-1496", "body-1497", "body-1498", "body-1499", "body-1500", "body-1501", "body-1502", "body-1503", "body-1504", "body-1505", "body-1506", "body-1507", "body-1508", "body-1509", "body-1510", "body-1511", "body-1512", "body-1513", "body-1514", "body-1515", "body-1516", "body-1517", "body-1518", "body-1519", "body-1520", "body-1521", "body-1522", "body-1523", "body-1524", "body-1525", "body-1526", "body-1527", "body-1528", "body-1529", "body-1530", "body-1531", "body-1532", "body-1533", "body-1534", "body-1535", "body-1536", "body-1537", "body-1538", "body-1539", "body-1540", "body-1541", "body-1542", "body-1543", "body-1544", "body-1545", "body-1546", "body-1547", "body-1548", "body-1549", "body-1550", "body-1551", "body-1552", "body-1553", "body-1554", "body-1555", "body-1556", "body-1557", "body-1558", "body-1559", "body-1560", "body-1561", "body-1562", "body-1563", "body-1564", "body-1565", "body-1566", "body-1567", "body-1568", "body-1569", "body-1570", "body-1571", "body-1572", "body-1573", "body-1574", "body-1575", "body-1576", "body-1577", "body-1578", "body-1579", "body-1580", "body-1581", "body-1582", "body-1583", "body-1584", "body-1585", "body-1586", "body-1587", "body-1588", "body-1589", "body-1590", "body-1591", "body-1592", "body-1593", "body-1594", "body-1595", "body-1596", "body-1597", "body-1598", "body-1599", "body-1600", "body-1601", "body-1602", "body-1603", "body-1604", "body-1605", "body-1606", "body-1607", "body-1608", "body-1609", "body-1610", "body-1611", "body-1612", "body-1613", "body-1614", "body-1615", "body-1616", "body-1617", "body-1618", "body-1619", "body-1620", "body-1621", "body-1622", "body-1623", "body-1624", "body-1625", "body-1626", "body-1627", "body-1628", "body-1629", "body-1630", "body-1631", "body-1632", "body-1633", "body-1634", "body-1635", "body-1636", "body-1637", "body-1638", "body-1639", "body-1640", "body-1641", "body-1642", "body-1643", "body-1644", "body-1645", "body-1646", "body-1647", "body-1648", "body-1649", "body-1650", "body-1651", "body-1652", "body-1780", "body-1781", "body-1921", "body-1922", "body-1923", "body-1924"], "East": ["body-0971", "body-0976", "body-0983", "body-0986", "body-1653", "body-1654", "body-1655", "body-1656", "body-1657", "body-1658", "body-1659", "body-1660", "body-1661", "body-1662", "body-1663", "body-1664", "body-1665", "body-1666", "body-1667", "body-1668", "body-1669", "body-1670", "body-1671", "body-1672", "body-1673", "body-1674", "body-1675", "body-1676", "body-1677", "body-1678", "body-1679", "body-1680", "body-1681", "body-1682", "body-1683", "body-1684", "body-1685", "body-1686", "body-1687", "body-1688", "body-1689", "body-1690", "body-1691", "body-1692", "body-1693", "body-1694", "body-1695", "body-1696", "body-1697", "body-1698", "body-1699", "body-1700", "body-1701", "body-1702", "body-1703", "body-1704", "body-1705", "body-1706", "body-1707", "body-1708", "body-1709", "body-1710", "body-1711", "body-1712", "body-1713", "body-1714", "body-1715", "body-1716", "body-1717", "body-1718", "body-1719", "body-1720", "body-1721", "body-1722", "body-1723", "body-1724", "body-1725", "body-1726", "body-1727", "body-1728", "body-1729", "body-1730", "body-1731", "body-1732", "body-1733", "body-1734", "body-1735", "body-1736", "body-1737", "body-1738", "body-1739", "body-1740", "body-1741", "body-1742", "body-1743", "body-1744", "body-1745", "body-1746", "body-1747", "body-1748", "body-1749", "body-1750", "body-1751", "body-1752", "body-1753", "body-1754", "body-1755", "body-1756", "body-1757", "body-1758", "body-1759", "body-1760", "body-1761", "body-1762", "body-1763", "body-1764", "body-1765", "body-1766", "body-1767", "body-1768", "body-1769", "body-1770", "body-1771", "body-1772", "body-1773", "body-1774", "body-1775", "body-1776", "body-1777", "body-1778", "body-1779", "body-1784", "body-1785", "body-1939", "body-1940"], "West": ["body-0968", "body-0973", "body-0981", "body-0982", "body-0995", "body-0996", "body-1275", "body-1276", "body-1277", "body-1278", "body-1279", "body-1280", "body-1281", "body-1282", "body-1283", "body-1284", "body-1285", "body-1286", "body-1287", "body-1288", "body-1289", "body-1290", "body-1291", "body-1292", "body-1293", "body-1294", "body-1295", "body-1296", "body-1297", "body-1298", "body-1299", "body-1300", "body-1301", "body-1302", "body-1303", "body-1304", "body-1305", "body-1306", "body-1307", "body-1308", "body-1309", "body-1310", "body-1311", "body-1312", "body-1313", "body-1314", "body-1315", "body-1316", "body-1317", "body-1318", "body-1319", "body-1320", "body-1321", "body-1322", "body-1323", "body-1324", "body-1325", "body-1326", "body-1327", "body-1328", "body-1329", "body-1330", "body-1331", "body-1332", "body-1333", "body-1334", "body-1335", "body-1336", "body-1337", "body-1338", "body-1339", "body-1340", "body-1341", "body-1342", "body-1343", "body-1344", "body-1345", "body-1346", "body-1347", "body-1348", "body-1349", "body-1350", "body-1351", "body-1352", "body-1353", "body-1354", "body-1355", "body-1356", "body-1357", "body-1358", "body-1359", "body-1360", "body-1361", "body-1362", "body-1363", "body-1364", "body-1365", "body-1366", "body-1367", "body-1368", "body-1369", "body-1370", "body-1371", "body-1372", "body-1373", "body-1374", "body-1375", "body-1376", "body-1377", "body-1378", "body-1379", "body-1380", "body-1381", "body-1382", "body-1383", "body-1384", "body-1385", "body-1386", "body-1387", "body-1388", "body-1389", "body-1390", "body-1391", "body-1392", "body-1393", "body-1394", "body-1395", "body-1396", "body-1782", "body-1783", "body-1875", "body-1876", "body-1877", "body-1878", "body-1879", "body-1880", "body-1881", "body-1882", "body-1883", "body-1884", "body-1885", "body-1886", "body-1887", "body-1888", "body-1889", "body-1890", "body-1891", "body-1892", "body-1893", "body-1894", "body-1895", "body-1896", "body-1897", "body-1898", "body-1899", "body-1900", "body-1901", "body-1902", "body-1903", "body-1904", "body-1905", "body-1906", "body-1907", "body-1908", "body-1909", "body-1910", "body-1911", "body-1912", "body-1913", "body-1914", "body-1915", "body-1916", "body-1917", "body-1918", "body-1919", "body-1920", "body-1925", "body-1926", "body-1927", "body-1928", "body-1929", "body-1930", "body-1931", "body-1932", "body-1933", "body-1934", "body-1935", "body-1936", "body-1943", "body-1944"]};
    const oldIndex=plan.buckets.findIndex(b=>b.id==='2607-OPENING-GUARD');
    const hidden=(plan.hiddenBuckets||[]).includes('2607-OPENING-GUARD');
    const ids=Object.keys(groups).map(side=>'2607-OG-'+side.toUpperCase());
    plan.buckets=plan.buckets.filter(b=>b.id!=='2607-OPENING-GUARD'&&!ids.includes(b.id));
    plan.buckets.splice(oldIndex<0?2:oldIndex,0,...ids.map(id=>structuredClone(report.initialPlan.buckets.find(b=>b.id===id))));
    for (const [side,bodies] of Object.entries(groups)) for (const id of bodies) plan.assignments[id]='2607-OG-'+side.toUpperCase();
    plan.hiddenBuckets=(plan.hiddenBuckets||[]).filter(id=>id!=='2607-OPENING-GUARD');
    if (hidden) plan.hiddenBuckets=[...new Set([...plan.hiddenBuckets,...ids])];
    plan.appliedMigrations=[...(plan.appliedMigrations||[]),'2607-og-four-sides-v1'];
    savePlan();
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
      fetch('./assets/stair-step.gltf.gz?v=20261027-2607-og4').then(async r => { if (!r.ok) throw new Error('Model download failed'); return new GLTFLoader().parseAsync(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text(), ''); }),
      fetch('./assets/step-manifest.json?v=20261027-2607-og4', {cache:'no-store'}).then(r => r.json())
    ]);
    report = loadedReport;
    const seed = await fetch("./assets/proposed-plan.json?v=20261027-2607-og4", {cache:"no-store"}).then(r => r.json());
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
