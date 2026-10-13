import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBodyTileRenderer } from './body-tiles.js?v=20261013-light1';
import { groupUniqueBodies } from './body-groups.js?v=20261013-bucket2';
import { createPartDrawingViewer } from './part-drawing-viewer.js?v=20261013-drawing6';

const gripIcon = '<svg viewBox="0 0 16 20" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="10" r="1.3"/><circle cx="11" cy="10" r="1.3"/><circle cx="5" cy="16" r="1.3"/><circle cx="11" cy="16" r="1.3"/></g></svg>';
const cleanName = name => name.replace(/^26-\d+_/, '').replace(/JR_?/g, ' ').replace(/_/g, ' ').trim();

export function createBucketExplorer({ objectById, report, getPlan, radialTargets, moveBucket, readOnly = false }) {
  const root = document.getElementById('bucket-view');
  const list = document.getElementById('bucket-nav-list');
  const stage = document.getElementById('bucket-stage');
  const carousel = document.getElementById('bucket-wheel');
  const slider = document.getElementById('bucket-distance');
  const explode = document.getElementById('bucket-explode');
  const clones = new Map(), previews = new Map();
  const personalOrderKey = `caliper-bucket-view-order-${report.sourceSha256}`;
  let personalOrder = [];
  if (readOnly) { try { personalOrder = JSON.parse(localStorage.getItem(personalOrderKey) || '[]'); } catch {} }
  let active = false, frame = null, bucketId = null, groups = [], focusIndex = 0;
  let membership = '', meshes = [], targets = [], distance = 0, draggedId = null;
  let generation = 0, tileRenderer, refitTimer;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa6b4c3, 1.8));
  const light = new THREE.DirectionalLight(0xffffff, 1.8);
  light.position.set(4000, 9000, 6000); scene.add(light);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-5000, 2000, -4000); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
  camera.position.set(0.75, 0.55, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.zoomToCursor = true; controls.screenSpacePanning = true;
  controls.minDistance = 5;
  const normalMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c6d0, roughness: 0.62, metalness: 0.15, side: THREE.DoubleSide });
  const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c664, roughness: 0.65, metalness: 0.08, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x536c7e, transparent: true, opacity: 0.6 });
  const selectedEdges = new THREE.LineBasicMaterial({ color: 0x98691c });
  const raycaster = new THREE.Raycaster();
  let drawingMode = false;
  const drawingViewer = createPartDrawingViewer({ center: root.querySelector('.bucket-center'), sourceSha256: report.sourceSha256, onReady: () => { renderWheel(); updateFocus(); } });

  function bucketsInOrder() {
    const buckets = [...getPlan().buckets];
    if (readOnly && personalOrder.length) buckets.sort((a, b) => {
      const ai = personalOrder.indexOf(a.id), bi = personalOrder.indexOf(b.id);
      return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
    });
    return buckets;
  }
  function move(fromId, targetId, before) {
    if (!readOnly) moveBucket(fromId, targetId, before);
    else {
      const order = bucketsInOrder().map(b => b.id);
      const from = order.indexOf(fromId);
      if (from < 0 || fromId === targetId) return;
      order.splice(from, 1);
      order.splice(order.indexOf(targetId) + (before ? 0 : 1), 0, fromId);
      personalOrder = order;
      localStorage.setItem(personalOrderKey, JSON.stringify(order));
    }
    refresh();
  }
  function renderNav() {
    list.replaceChildren();
    for (const [i, bucket] of bucketsInOrder().entries()) {
      const row = document.createElement('div'); row.className = 'bucket-nav-row'; row.dataset.bucketId = bucket.id;
      row.classList.toggle('active', bucketId === bucket.id);
      const grip = document.createElement('button');
      grip.type = 'button'; grip.className = 'bucket-nav-grip'; grip.innerHTML = gripIcon; grip.draggable = false;
      grip.setAttribute('aria-label', `Reorder ${bucket.name}`); grip.title = 'Drag to reorder · Arrow keys to move';
      const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'bucket-nav-pick';
      pick.setAttribute('aria-label', `View bucket ${bucket.name}`); pick.setAttribute('aria-pressed', String(bucketId === bucket.id));
      const number = document.createElement('span'); number.className = 'bucket-nav-number'; number.textContent = String(i + 1).padStart(2, '0');
      const copy = document.createElement('span'); const name = document.createElement('strong'); name.textContent = bucket.name;
      const id = document.createElement('small'); id.textContent = bucket.id; copy.append(name, id);
      pick.append(number, copy); pick.addEventListener('click', () => selectBucket(bucket.id));
      let pointerDrag;
      grip.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        pointerDrag = { y: e.clientY, target: null, before: false, moved: false };
        grip.setPointerCapture(e.pointerId);
      });
      grip.addEventListener('pointermove', e => {
        if (!pointerDrag || Math.abs(e.clientY - pointerDrag.y) < 5) return;
        pointerDrag.moved = true;
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bucket-nav-row');
        clearMarkers(); row.classList.add('dragging');
        if (!target || target === row) { pointerDrag.target = null; return; }
        pointerDrag.target = target.dataset.bucketId;
        pointerDrag.before = e.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
        target.classList.add(pointerDrag.before ? 'drop-before' : 'drop-after');
      });
      grip.addEventListener('pointerup', e => {
        const drag = pointerDrag; pointerDrag = null;
        if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
        clearMarkers();
        if (drag?.moved && drag.target) move(bucket.id, drag.target, drag.before);
      });
      grip.addEventListener('pointercancel', () => { pointerDrag = null; clearMarkers(); });
      grip.addEventListener('dragstart', e => { draggedId = bucket.id; e.dataTransfer.setData('text/plain', bucket.id); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      grip.addEventListener('dragend', () => { draggedId = null; clearMarkers(); });
      grip.addEventListener('keydown', e => {
        if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); const order = bucketsInOrder(); const direction = e.key === 'ArrowUp' ? -1 : 1;
        const neighbor = order[i + direction]; if (!neighbor) return;
        move(bucket.id, neighbor.id, direction < 0);
        list.querySelector(`[data-bucket-id="${bucket.id}"] .bucket-nav-grip`)?.focus();
      });
      row.addEventListener('dragover', e => {
        if (!draggedId || draggedId === bucket.id) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clearMarkers();
        row.classList.add(e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2 ? 'drop-before' : 'drop-after');
      });
      row.addEventListener('drop', e => { if (!draggedId) return; e.preventDefault(); move(draggedId, bucket.id, row.classList.contains('drop-before')); draggedId = null; clearMarkers(); });
      row.append(grip, pick); list.append(row);
    }
  }
  function clearMarkers() { for (const row of list.children) row.classList.remove('drop-before', 'drop-after', 'dragging'); }
  function cloneFor(id) {
    if (clones.has(id)) return clones.get(id);
    const source = objectById.get(id); if (!source) return null;
    const mesh = new THREE.Mesh(source.geometry, normalMaterial);
    (source.userData.installedWorldMatrix || source.matrixWorld).decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.userData.home = mesh.position.clone(); mesh.userData.bodyId = id;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 38), edgeMaterial));
    clones.set(id, mesh); return mesh;
  }
  function fit() {
    if (!active || !meshes.length) return;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty(); meshes.forEach(mesh => box.expandByObject(mesh));
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(30, box.getSize(new THREE.Vector3()).length() / 2);
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    const length = radius / Math.sin(halfFov) * 1.16;
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center).addScaledVector(direction, length); controls.target.copy(center);
    camera.near = Math.max(0.1, length / 1000); camera.far = length * 30; camera.updateProjectionMatrix(); controls.update();
  }
  function positionMeshes() {
    const nudges = getPlan().viewNudges?.[bucketId] || {};
    meshes.forEach((mesh, i) => {
      mesh.position.copy(mesh.userData.home).lerp(targets[i] || mesh.userData.home, distance);
      const values = nudges[mesh.userData.bodyId];
      if (values) {
        const source = objectById.get(mesh.userData.bodyId);
        const matrix = source.parent?.matrixWorld;
        const offset = new THREE.Vector3().fromArray(values);
        if (matrix) offset.applyMatrix3(new THREE.Matrix3().setFromMatrix4(matrix));
        mesh.position.addScaledVector(offset, distance);
      }
    });
    scene.updateMatrixWorld(true);
  }
  function setDistance(value) {
    distance = value; slider.value = String(value);
    document.getElementById('bucket-distance-value').textContent = `${value.toFixed(1)}×`;
    explode.setAttribute('aria-pressed', String(value > 0));
    positionMeshes(); clearTimeout(refitTimer); refitTimer = setTimeout(fit, 140);
  }
  function selectBucket(id) {
    if (bucketId !== id) { drawingMode = false; drawingViewer.hide(); bucketId = id; membership = ''; focusIndex = 0; distance = 0; camera.position.set(0.75, 0.55, 1); controls.target.set(0, 0, 0); }
    refresh();
  }
  function refresh() {
    const buckets = bucketsInOrder();
    if (!buckets.some(b => b.id === bucketId)) { bucketId = buckets[0]?.id || null; membership = ''; focusIndex = 0; }
    const bucket = buckets.find(b => b.id === bucketId);
    renderNav();
    document.getElementById('bucket-nav-count').textContent = String(buckets.length).padStart(2, '0');
    document.getElementById('bucket-view-name').textContent = bucket?.name || 'No buckets yet';
    document.getElementById('bucket-view-id').textContent = bucket?.id || 'Create a bucket in Planning';
    const bodies = report.bodies.filter(b => getPlan().assignments[b.id] === bucketId);
    const key = bucketId + '|' + bodies.map(b => b.id).join('|');
    if (key !== membership) {
      membership = key; generation++;
      meshes.forEach(mesh => scene.remove(mesh));
      meshes = bodies.map(b => cloneFor(b.id)).filter(Boolean);
      meshes.forEach(mesh => { mesh.position.copy(mesh.userData.home); scene.add(mesh); });
      scene.updateMatrixWorld(true); targets = radialTargets(meshes);
      const previousId = groups[focusIndex]?.id;
      groups = groupUniqueBodies(bodies, objectById);
      focusIndex = Math.max(0, groups.findIndex(group => group.id === previousId));
      renderWheel(); positionMeshes(); if (active) { resize(); fit(); }
    }
    document.getElementById('bucket-view-count').textContent = `${bodies.length} bodies · ${groups.length} unique`;
    document.getElementById('bucket-unique-count').textContent = String(groups.length).padStart(2, '0');
    explode.disabled = meshes.length < 2; slider.disabled = meshes.length < 2;
    setDistance(distance); updateFocus();
  }
  function renderWheel() {
    carousel.replaceChildren();
    const pending = [];
    groups.forEach((group, index) => {
      const card = document.createElement('div'); card.className = 'bucket-wheel-item'; card.dataset.groupId = group.id;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bucket-wheel-focus'; button.title = group.name;
      button.setAttribute('aria-label', `Focus ${cleanName(group.name)}, quantity ${group.ids.length}`);
      const preview = document.createElement('span'); preview.className = 'bucket-wheel-preview';
      const copy = document.createElement('span'); copy.className = 'bucket-wheel-copy';
      const qty = document.createElement('small'); qty.textContent = `QTY ${String(group.ids.length).padStart(2, '0')}`;
      const name = document.createElement('strong'); name.textContent = cleanName(group.name);
      copy.append(qty, name); button.append(preview, copy); card.append(button); carousel.append(card);
      button.addEventListener('click', () => focusGroup(index));
      if (drawingViewer.available(group, bucketId)) {
        const pencil = document.createElement('button'); pencil.type = 'button'; pencil.className = 'bucket-drawing-toggle';
        pencil.setAttribute('aria-label', `Drawing for ${cleanName(group.name)}`); pencil.setAttribute('aria-pressed', 'false'); pencil.title = 'Toggle part drawing';
        pencil.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m12.5 3.5 4 4M3 17l1-5L13 3a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-9 9-5 1Z"/><path d="m4 12 4 4"/></svg>';
        pencil.addEventListener('click', () => {
          const close = drawingMode && focusIndex === index;
          drawingMode = !close; focusGroup(index);
          if (close) { drawingViewer.hide(); resize(); }
        });
        card.append(pencil);
      }
      const url = previews.get(group.id);
      if (url) showPreview(preview, url, group.name); else pending.push({group, preview});
    });
    const token = generation;
    function nextBatch() {
      if (token !== generation || !active) return;
      if (!tileRenderer) tileRenderer = createBodyTileRenderer({background:'#f5f8fa', bodyColor:0xb3c1cc, edgeColor:0x536c7e});
      for (let i = 0; i < 3 && pending.length; i++) {
        const {group, preview} = pending.shift(); const mesh = cloneFor(group.id);
        const result = tileRenderer.render(mesh.geometry, mesh.children[0].geometry);
        previews.set(group.id, result.url); showPreview(preview, result.url, group.name);
      }
      if (pending.length) requestAnimationFrame(nextBatch);
    }
    requestAnimationFrame(nextBatch);
  }
  function showPreview(element, url, name) { const image = document.createElement('img'); image.src = url; image.draggable = false; image.alt = `Face view of ${name}`; element.replaceChildren(image); }
  function focusGroup(index) {
    if (!groups.length) return;
    focusIndex = (index + groups.length) % groups.length; updateFocus();
  }
  function updateFocus() {
    const group = groups[focusIndex]; const ids = new Set(group?.ids || []);
    meshes.forEach(mesh => { const selected = ids.has(mesh.userData.bodyId); mesh.material = selected ? selectedMaterial : normalMaterial; mesh.children[0].material = selected ? selectedEdges : edgeMaterial; });
    for (const [index, button] of [...carousel.children].entries()) {
      let delta = index - focusIndex;
      if (groups.length > 5) { if (delta > groups.length / 2) delta -= groups.length; if (delta < -groups.length / 2) delta += groups.length; }
      button.hidden = Math.abs(delta) > 2;
      button.style.setProperty('--slot', delta); button.style.setProperty('--offset', `${delta * delta * 17}px`);
      button.classList.toggle('focused', delta === 0);
      const focus = button.querySelector('.bucket-wheel-focus');
      focus.setAttribute('aria-pressed', String(delta === 0)); focus.tabIndex = delta === 0 ? 0 : -1;
      button.querySelector('.bucket-drawing-toggle')?.setAttribute('aria-pressed', String(drawingMode && delta === 0));
    }
    document.getElementById('bucket-focused-name').textContent = group ? cleanName(group.name) : 'This bucket has no bodies';
    document.getElementById('bucket-focused-name').title = group?.name || '';
    document.getElementById('bucket-focused-qty').textContent = group ? `${group.ids.length} ${group.ids.length === 1 ? 'instance' : 'instances'} highlighted` : '';
    document.getElementById('bucket-wheel-position').textContent = groups.length ? `${String(focusIndex + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}` : '00 / 00';
    document.getElementById('bucket-wheel-empty').hidden = groups.length > 0;
    document.getElementById('bucket-previous-body').disabled = groups.length < 2;
    document.getElementById('bucket-next-body').disabled = groups.length < 2;
    if (drawingMode) { if (!drawingViewer.show(group, bucketId)) drawingMode = false; }
    else drawingViewer.hide();
  }
  function resize() {
    if (!active) return;
    const rect = stage.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
  }
  function draw() { if (!active) return; frame = requestAnimationFrame(draw); if (!drawingMode) { controls.update(); renderer.render(scene, camera); } }
  new ResizeObserver(() => { resize(); if (active) fit(); }).observe(stage);
  slider.addEventListener('input', () => setDistance(Number(slider.value)));
  explode.addEventListener('click', () => setDistance(distance > 0 ? 0 : 1));
  document.getElementById('bucket-previous-body').addEventListener('click', () => focusGroup(focusIndex - 1));
  document.getElementById('bucket-next-body').addEventListener('click', () => focusGroup(focusIndex + 1));
  const bodyMenu = document.getElementById('bucket-body-menu'); let lastWheel = 0, dragStart = null;
  bodyMenu.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) < 3 || performance.now() - lastWheel < 150) return; lastWheel = performance.now(); focusGroup(focusIndex + Math.sign(e.deltaY)); }, {passive:false});
  bodyMenu.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); focusGroup(focusIndex + (['ArrowUp','ArrowLeft'].includes(e.key) ? -1 : 1)); } });
  carousel.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('.bucket-drawing-toggle')) { dragStart = null; return; } e.preventDefault(); carousel.setPointerCapture(e.pointerId); dragStart = {y:e.clientY, index:focusIndex, moved:false, pick:[...carousel.children].findIndex(button => button.contains(e.target))}; });
  carousel.addEventListener('pointerup', () => { if (dragStart && !dragStart.moved && dragStart.pick >= 0) focusGroup(dragStart.pick); });
  carousel.addEventListener('pointercancel', () => { dragStart = null; });
  carousel.addEventListener('pointermove', e => { if (!dragStart || !e.buttons) return; const steps = Math.round((dragStart.y - e.clientY) / 70); if (steps) { dragStart.moved = true; focusGroup(dragStart.index + steps); } });
  carousel.addEventListener('click', e => { if (dragStart?.moved) { e.preventDefault(); e.stopPropagation(); } dragStart = null; }, true);
  const pointer = new THREE.Vector2(); let start;
  renderer.domElement.addEventListener('pointerdown', e => { start = [e.clientX,e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (e.button !== 0 || !start || Math.hypot(e.clientX-start[0], e.clientY-start[1]) > 5) return;
    start = null; const rect = stage.getBoundingClientRect(); pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera); const hit = raycaster.intersectObjects(meshes,false)[0];
    if (hit) { const index = groups.findIndex(g => g.ids.includes(hit.object.userData.bodyId)); if (index >= 0) focusGroup(index); }
  });
  return {
    show() { active = true; drawingViewer.load(); refresh(); generation++; renderWheel(); updateFocus(); resize(); fit(); if (frame === null) draw(); },
    hide() { active = false; generation++; if (frame !== null) cancelAnimationFrame(frame); frame = null; clearTimeout(refitTimer); },
    refresh() { if (active) refresh(); }
  };
}
