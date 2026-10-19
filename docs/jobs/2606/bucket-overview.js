import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBodyTileRenderer } from './body-tiles.js?v=20261013-light1';
import { createFocusedBodyViewer } from './focused-body-viewer.js?v=20261013-light1';

const eyeOpenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
const eyeClosedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M4.2 8.2C2.7 10 2 12 2 12s3.6 6 10 6c1.8 0 3.4-.5 4.7-1.1M9.4 6.3c.8-.2 1.7-.3 2.6-.3 6.4 0 10 6 10 6s-.7 1.2-2 2.5"/></svg>';
const workStages = [
  { id: 'design', short: 'D', name: 'Design', color: '#7e91c4', background: '#f2f5fc' },
  { id: 'waterjet', short: 'W', name: 'Waterjet', color: '#789fae', background: '#eff7fa' },
  { id: 'fabrication', short: 'F', name: 'Fabrication', color: '#b49a73', background: '#faf5ed' },
  { id: 'finishing', short: 'FF', name: 'Finishing', color: '#a28eb6', background: '#f6f2fa' },
  { id: 'complete', short: 'C', name: 'Complete', color: '#7da38c', background: '#eff7f2' }
];

// One WebGL canvas draws every visible card. The bucket meshes share the loaded
// model's geometry, so adding cards does not load the STEP preview again.
export function createOverview({ objectById, report, getPlan, radialTargets, openBucket, moveBucket, renameBucket, setBucketStage }) {
  const canvas = document.getElementById('overview-canvas');
  const grid = document.getElementById('overview-grid');
  const slider = document.getElementById('overview-distance');
  const output = document.getElementById('overview-distance-value');
  const details = document.getElementById('overview-details');
  const detailsBackdrop = document.getElementById('overview-details-backdrop');
  const detailsStage = document.getElementById('overview-details-stage');
  const detailsFit = document.getElementById('overview-details-fit');
  const selectedBodyLabel = document.getElementById('overview-selected-body');
  const bodyIsolate = document.getElementById('overview-body-isolate');
  const bodyExplode = document.getElementById('overview-body-explode');
  const detailsExplodeControl = document.getElementById('overview-details-explode-control');
  const detailsExplodeSlider = document.getElementById('overview-details-explode-distance');
  const detailsExplodeValue = document.getElementById('overview-details-explode-value');
  const bodyHide = document.getElementById('overview-body-hide');
  const bodyShowAll = document.getElementById('overview-body-show-all');
  const detailsId = document.getElementById('overview-details-id');
  const detailsName = document.getElementById('overview-details-name');
  const detailsCount = document.getElementById('overview-details-count');
  const detailsList = document.getElementById('overview-details-list');
  const detailsTiles = document.getElementById('overview-details-tiles');
  const detailsTileButton = document.getElementById('overview-details-tile');
  const tileFocus = document.getElementById('overview-tile-focus');
  const tileBack = document.getElementById('overview-tile-back');
  const tileFocusName = document.getElementById('overview-focus-name');
  const tileFocusIdLabel = document.getElementById('overview-focus-id');
  const detailsClose = document.getElementById('overview-details-close');
  const detailsOpen = document.getElementById('overview-details-open');
  const detailsRename = document.getElementById('overview-details-rename');
  const renameForm = document.getElementById('overview-rename-form');
  const renameInput = document.getElementById('overview-rename-input');
  const renameCancel = document.getElementById('overview-rename-cancel');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c6d0, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x536c7e, transparent: true, opacity: 0.62 });
  const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c664, metalness: 0.1, roughness: 0.7, side: THREE.DoubleSide });
  const detailsRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  detailsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  detailsRenderer.outputColorSpace = THREE.SRGBColorSpace;
  detailsRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  detailsRenderer.toneMappingExposure = 1.05;
  detailsStage.prepend(detailsRenderer.domElement);
  const detailsScene = new THREE.Scene();
  detailsScene.background = new THREE.Color('#f5f8fa');
  detailsScene.add(new THREE.HemisphereLight(0xffffff, 0xa6b4c3, 1.8));
  const detailsLight = new THREE.DirectionalLight(0xffffff, 1.6);
  detailsLight.position.set(4000, 9000, 6000);
  detailsScene.add(detailsLight);
  const detailsCamera = new THREE.PerspectiveCamera(42, 1, 1, 100000);
  const detailsControls = new OrbitControls(detailsCamera, detailsRenderer.domElement);
  detailsControls.enableDamping = true;
  detailsControls.dampingFactor = 0.07;
  detailsControls.minDistance = 10;
  detailsControls.maxDistance = 100000;
  detailsControls.screenSpacePanning = true;
  detailsControls.zoomToCursor = true;
  const detailsMeshes = new Map();
  const detailsHiddenIds = new Set();
  let detailsExplodeDistance = 0;
  let detailsExplodeEnabled = false;
  const detailsRaycaster = new THREE.Raycaster();
  const detailsPointer = new THREE.Vector2();
  let detailsPointerStart = null;
  let selectedBodyId = null;
  let isolatedBodyId = null;
  const clones = new Map();
  const cards = new Map();
  const nudgeMatrix = new THREE.Matrix3();
  let active = false;
  let distance = 0;
  let refitTimer;
  let frameId = null;
  let detailsBucketId = null;
  let draggingBucketId = null;
  let tileMode = false;
  let tileGeneration = 0;
  let tileRenderer;
  let focusedViewer;
  let tileFocusBodyId = null;
  const tileCache = new Map();

  function renderTiles(bucketId) {
    const generation = ++tileGeneration;
    const bodies = report.bodies.filter(body => getPlan().assignments[body.id] === bucketId);
    detailsTiles.replaceChildren();
    const pending = [];
    for (const body of bodies) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'overview-tile';
      tile.dataset.bodyId = body.id;
      tile.setAttribute('aria-label', `Open full view of ${body.name}`);
      const preview = document.createElement('span');
      preview.className = 'overview-tile-preview';
      preview.textContent = 'Preparing view…';
      const copy = document.createElement('span');
      copy.className = 'overview-tile-copy';
      const name = document.createElement('strong'); name.textContent = body.name;
      const id = document.createElement('small'); id.textContent = body.id;
      const extents = document.createElement('em');
      copy.append(name, id, extents);
      tile.append(preview, copy);
      tile.addEventListener('click', () => showFocusedBody(body));
      detailsTiles.append(tile);
      const cached = tileCache.get(body.id);
      if (cached) showTile(cached, preview, extents, body);
      else pending.push({ body, preview, extents });
    }
    function nextBatch() {
      if (generation !== tileGeneration || !tileMode || detailsBucketId !== bucketId) return;
      if (!tileRenderer) tileRenderer = createBodyTileRenderer();
      for (let i = 0; i < 4 && pending.length; i++) {
        const { body, preview, extents } = pending.shift();
        const source = cloneFor(body.id);
        if (!source) { preview.textContent = 'Preview unavailable'; continue; }
        const result = tileRenderer.render(source.geometry, source.children[0]?.geometry);
        tileCache.set(body.id, result);
        showTile(result, preview, extents, body);
      }
      if (pending.length) requestAnimationFrame(nextBatch);
    }
    if (pending.length) requestAnimationFrame(nextBatch);
  }

  function showTile(result, preview, extents, body) {
    const image = document.createElement('img');
    image.src = result.url;
    image.alt = `Face-on view of ${body.name}`;
    preview.replaceChildren(image);
    const sizes = [...result.spans].sort((a, b) => b - a).map(mm => (mm / 25.4).toFixed(1));
    extents.textContent = `Extents: ${sizes.join(' × ')} in`;
  }

  function showFocusedBody(body) {
    const source = cloneFor(body.id);
    if (!source) return;
    tileFocusBodyId = body.id;
    tileFocusName.textContent = body.name;
    tileFocusIdLabel.textContent = body.id;
    selectedBodyId = body.id;
    updateDetailsSelection();
    details.classList.add('tile-focus');
    detailsTileButton.hidden = true;
    detailsCount.hidden = true;
    detailsTiles.hidden = true;
    detailsOpen.hidden = true;
    tileFocus.hidden = false;
    if (!focusedViewer) focusedViewer = createFocusedBodyViewer();
    const bucket = getPlan().buckets.find(item => item.id === detailsBucketId);
    focusedViewer.open({ geometry: source.geometry, edgesGeometry: source.children[0]?.geometry,
      background: workStages.find(stage => stage.id === bucket?.stage)?.background });
    tileBack.focus();
  }

  function backToTiles() {
    const bodyId = tileFocusBodyId;
    tileFocusBodyId = null;
    focusedViewer?.close();
    details.classList.remove('tile-focus');
    detailsTileButton.hidden = false;
    detailsCount.hidden = false;
    detailsTiles.hidden = false;
    detailsOpen.hidden = false;
    tileFocus.hidden = true;
    if (bodyId) detailsTiles.querySelector(`[data-body-id="${bodyId}"]`)?.focus();
  }

  function setTileMode(enabled) {
    if (tileFocusBodyId) backToTiles();
    tileMode = enabled;
    details.classList.toggle('tile-mode', enabled);
    detailsTileButton.textContent = enabled ? 'ORBIT' : 'TILE';
    detailsTileButton.setAttribute('aria-pressed', String(enabled));
    detailsStage.hidden = enabled;
    document.querySelector('.overview-body-tools').hidden = enabled;
    detailsExplodeControl.hidden = enabled || !detailsExplodeEnabled;
    detailsList.hidden = enabled;
    detailsTiles.hidden = !enabled;
    if (enabled && detailsBucketId) renderTiles(detailsBucketId);
    else {
      tileGeneration++;
      if (!details.hidden) requestAnimationFrame(fitDetails);
    }
  }

  function fitDetails() {
    const visible = [...detailsMeshes.values()].filter(mesh => mesh.visible);
    if (!visible.length) return;
    detailsScene.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty();
    for (const mesh of visible) box.expandByObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(50, box.getSize(new THREE.Vector3()).length() / 2);
    const viewDistance = radius / Math.sin(THREE.MathUtils.degToRad(detailsCamera.fov / 2)) * 1.2;
    const direction = detailsCamera.position.clone().sub(detailsControls.target);
    if (direction.lengthSq() < 1) direction.set(0.75, 0.55, 1);
    direction.normalize();
    detailsCamera.position.copy(center).addScaledVector(direction, viewDistance);
    detailsControls.target.copy(center);
    detailsCamera.near = Math.max(0.1, viewDistance / 1000);
    detailsCamera.far = viewDistance * 20;
    detailsCamera.updateProjectionMatrix();
    detailsControls.update();
  }

  function updateDetailsSelection() {
    const selected = report.bodies.find(body => body.id === selectedBodyId);
    selectedBodyLabel.textContent = selected ? selected.name : 'Select a body below to inspect it';
    bodyIsolate.disabled = !selected || detailsHiddenIds.has(selectedBodyId);
    bodyExplode.disabled = detailsMeshes.size < 2;
    bodyExplode.setAttribute('aria-pressed', String(detailsExplodeEnabled));
    bodyHide.disabled = !selected;
    const selectedHidden = Boolean(selected && detailsHiddenIds.has(selectedBodyId));
    bodyHide.innerHTML = selectedHidden ? eyeClosedIcon : eyeOpenIcon;
    bodyHide.setAttribute('aria-label', selectedHidden ? 'Show selected body' : 'Hide selected body');
    bodyHide.title = selectedHidden ? 'Show selected body' : 'Hide selected body';
    bodyShowAll.hidden = !isolatedBodyId && !detailsHiddenIds.size;
    for (const [id, mesh] of detailsMeshes) {
      mesh.visible = !detailsHiddenIds.has(id) && (!isolatedBodyId || id === isolatedBodyId);
      mesh.material = id === selectedBodyId ? selectedMaterial : bodyMaterial;
    }
    for (const item of detailsList.children) {
      item.classList.toggle('selected', item.dataset.bodyId === selectedBodyId);
      item.classList.toggle('hidden-body', detailsHiddenIds.has(item.dataset.bodyId));
      item.querySelector('button')?.setAttribute('aria-pressed', String(item.dataset.bodyId === selectedBodyId));
    }
  }

  function syncDetailsMeshes(card) {
    if (!card) return;
    const liveIds = new Set(card.meshes.map(mesh => mesh.userData.bodyId));
    for (const [id, mesh] of detailsMeshes) {
      if (liveIds.has(id)) continue;
      detailsScene.remove(mesh);
      mesh.children[0]?.geometry.dispose();
      detailsMeshes.delete(id);
    }
    for (const source of card.meshes) {
      const id = source.userData.bodyId;
      let mesh = detailsMeshes.get(id);
      if (!mesh) {
        mesh = new THREE.Mesh(source.geometry, bodyMaterial);
        mesh.userData.bodyId = id;
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(source.geometry, 38), edgeMaterial));
        detailsMeshes.set(id, mesh);
        detailsScene.add(mesh);
      }
      mesh.position.copy(source.userData.home);
      const target = card.targets.get(id);
      if (target) mesh.position.lerp(target, detailsExplodeDistance);
      mesh.quaternion.copy(source.quaternion);
      mesh.scale.copy(source.scale);
    }
    if (selectedBodyId && !liveIds.has(selectedBodyId)) selectedBodyId = null;
    if (isolatedBodyId && !liveIds.has(isolatedBodyId)) isolatedBodyId = null;
    updateDetailsSelection();
  }

  function setDetailsExplodeDistance(value, enabled = true) {
    detailsExplodeDistance = value;
    detailsExplodeEnabled = enabled;
    detailsExplodeSlider.value = String(value);
    detailsExplodeValue.textContent = `${value.toFixed(1)}×`;
    detailsExplodeControl.hidden = tileMode || !enabled;
    syncDetailsMeshes(cards.get(detailsBucketId));
    fitDetails();
  }

  function clearDragMarkers() {
    for (const card of cards.values()) card.article.classList.remove('dragging', 'drop-before', 'drop-after');
  }

  function closeDetails(restoreFocus = false) {
    const previous = cards.get(detailsBucketId);
    setTileMode(false);
    detailsTiles.replaceChildren();
    detailsBucketId = null;
    selectedBodyId = null;
    isolatedBodyId = null;
    detailsHiddenIds.clear();
    detailsExplodeDistance = 0;
    detailsExplodeEnabled = false;
    detailsExplodeControl.hidden = true;
    renameForm.hidden = true;
    detailsRename.hidden = false;
    details.hidden = true;
    detailsBackdrop.hidden = true;
    for (const card of cards.values()) card.article.classList.remove('details-active');
    if (restoreFocus) previous?.top.focus();
  }

  function showDetails(bucketId) {
    const bucket = getPlan().buckets.find(item => item.id === bucketId);
    if (!bucket) return;
    if (detailsBucketId !== bucketId && tileMode) setTileMode(false);
    detailsScene.background.set(workStages.find(stage => stage.id === bucket.stage)?.background || '#f5f8fa');
    const changingBucket = detailsBucketId !== bucketId;
    if (changingBucket) {
      renameForm.hidden = true;
      detailsRename.hidden = false;
      selectedBodyId = null;
      isolatedBodyId = null;
      detailsHiddenIds.clear();
      detailsExplodeDistance = 0;
      detailsExplodeEnabled = false;
      detailsExplodeControl.hidden = true;
    }
    detailsBucketId = bucketId;
    const card = cards.get(bucketId);
    const bodies = report.bodies.filter(body => getPlan().assignments[body.id] === bucketId);
    detailsId.textContent = bucket.id;
    detailsName.textContent = bucket.name;
    detailsCount.textContent = `${bodies.length} ${bodies.length === 1 ? 'body' : 'bodies'}`;
    detailsList.replaceChildren();
    for (const body of bodies) {
      const item = document.createElement('li');
      item.dataset.bodyId = body.id;
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'overview-body-row';
      select.setAttribute('aria-label', `Select ${body.name}`);
      select.addEventListener('click', () => {
        selectedBodyId = body.id;
        updateDetailsSelection();
      });
      const name = document.createElement('strong'); name.textContent = body.name;
      const id = document.createElement('small'); id.textContent = body.id;
      const path = document.createElement('span'); path.textContent = body.assemblyPath.join(' / ');
      select.append(name, id, path);
      item.append(select);
      detailsList.append(item);
    }
    if (changingBucket && card) {
      detailsCamera.position.copy(card.camera.position);
      detailsControls.target.copy(card.controls.target);
      detailsControls.update();
    }
    syncDetailsMeshes(card);
    for (const card of cards.values()) card.article.classList.toggle('details-active', card.article.dataset.bucketId === bucketId);
    details.hidden = false;
    detailsBackdrop.hidden = false;
    if (changingBucket) {
      detailsList.scrollTop = 0;
      fitDetails();
      detailsClose.focus();
    }
  }

  detailsClose.addEventListener('click', () => closeDetails(true));
  detailsBackdrop.addEventListener('click', () => closeDetails(true));
  detailsFit.addEventListener('click', fitDetails);
  detailsTileButton.addEventListener('click', () => setTileMode(!tileMode));
  tileBack.addEventListener('click', backToTiles);
  bodyIsolate.addEventListener('click', () => {
    if (!selectedBodyId || detailsHiddenIds.has(selectedBodyId)) return;
    isolatedBodyId = isolatedBodyId === selectedBodyId ? null : selectedBodyId;
    updateDetailsSelection();
    fitDetails();
  });
  bodyExplode.addEventListener('click', () => {
    setDetailsExplodeDistance(detailsExplodeEnabled ? 0 : 1, !detailsExplodeEnabled);
  });
  detailsExplodeSlider.addEventListener('input', event => setDetailsExplodeDistance(Number(event.currentTarget.value)));
  bodyHide.addEventListener('click', () => {
    if (!selectedBodyId) return;
    if (detailsHiddenIds.has(selectedBodyId)) detailsHiddenIds.delete(selectedBodyId);
    else {
      detailsHiddenIds.add(selectedBodyId);
      if (isolatedBodyId === selectedBodyId) isolatedBodyId = null;
    }
    syncDetailsMeshes(cards.get(detailsBucketId));
    fitDetails();
  });
  bodyShowAll.addEventListener('click', () => {
    isolatedBodyId = null;
    detailsHiddenIds.clear();
    setDetailsExplodeDistance(0, false);
    syncDetailsMeshes(cards.get(detailsBucketId));
    fitDetails();
  });
  detailsRenderer.domElement.addEventListener('pointerdown', event => {
    if (event.button === 0) detailsPointerStart = [event.clientX, event.clientY];
  });
  detailsRenderer.domElement.addEventListener('pointerup', event => {
    const start = detailsPointerStart;
    detailsPointerStart = null;
    if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const rect = detailsRenderer.domElement.getBoundingClientRect();
    detailsPointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    detailsRaycaster.setFromCamera(detailsPointer, detailsCamera);
    detailsScene.updateMatrixWorld(true);
    const hit = detailsRaycaster.intersectObjects([...detailsMeshes.values()].filter(mesh => mesh.visible), false)[0];
    selectedBodyId = hit?.object.userData.bodyId || null;
    updateDetailsSelection();
    if (selectedBodyId) detailsList.querySelector(`li[data-body-id="${selectedBodyId}"]`)?.scrollIntoView({ block: 'nearest' });
  });
  detailsRenderer.domElement.addEventListener('pointercancel', () => { detailsPointerStart = null; });
  detailsOpen.addEventListener('click', () => { if (detailsBucketId) openBucket(detailsBucketId); });
  detailsRename.addEventListener('click', () => {
    const bucket = getPlan().buckets.find(item => item.id === detailsBucketId);
    if (!bucket) return;
    renameInput.value = bucket.name;
    renameInput.setCustomValidity('');
    renameForm.hidden = false;
    detailsRename.hidden = true;
    renameInput.focus();
    renameInput.select();
  });
  renameCancel.addEventListener('click', () => {
    renameForm.hidden = true;
    detailsRename.hidden = false;
    detailsRename.focus();
  });
  renameForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!detailsBucketId) return;
    const error = renameBucket(detailsBucketId, renameInput.value);
    renameInput.setCustomValidity(error || '');
    if (error) renameInput.reportValidity();
    else { renameForm.hidden = true; detailsRename.hidden = false; detailsRename.focus(); }
  });
  renameInput.addEventListener('input', () => renameInput.setCustomValidity(''));
  renameInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); renameCancel.click(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !details.hidden) closeDetails(true);
  });

  function cloneFor(bodyId) {
    if (clones.has(bodyId)) return clones.get(bodyId);
    const source = objectById.get(bodyId);
    if (!source) return null;
    const clone = new THREE.Mesh(source.geometry, bodyMaterial);
    const installed = source.userData.installedWorldMatrix || source.matrixWorld;
    installed.decompose(clone.position, clone.quaternion, clone.scale);
    clone.userData.home = clone.position.clone();
    clone.userData.bodyId = bodyId;
    clone.userData.source = source;
    clone.add(new THREE.LineSegments(new THREE.EdgesGeometry(source.geometry, 38), edgeMaterial));
    clones.set(bodyId, clone);
    return clone;
  }

  function newCard(bucket) {
    const article = document.createElement('article');
    article.className = 'overview-card';
    article.dataset.bucketId = bucket.id;
    const header = document.createElement('div');
    header.className = 'overview-card-header';
    const grip = document.createElement('span');
    grip.className = 'overview-card-grip';
    grip.textContent = '⠿';
    grip.draggable = true;
    grip.tabIndex = 0;
    grip.setAttribute('role', 'button');
    grip.setAttribute('aria-label', `Reorder ${bucket.name}`);
    grip.title = 'Drag to change shop priority · Use arrow keys to move one position';
    const priority = document.createElement('span');
    priority.className = 'overview-card-priority';
    grip.append(priority);
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'overview-card-top';
    top.setAttribute('aria-label', `View bodies in ${bucket.name}`);
    const title = document.createElement('div');
    title.className = 'overview-card-title';
    const id = document.createElement('strong'); id.className = 'overview-card-id'; id.textContent = bucket.id;
    const name = document.createElement('span'); name.className = 'overview-card-name';
    title.append(id, name);
    const count = document.createElement('span'); count.className = 'overview-card-count';
    const chevron = document.createElement('span'); chevron.className = 'overview-card-chevron'; chevron.textContent = '›'; chevron.setAttribute('aria-hidden', 'true');
    top.append(title, count, chevron);
    const stage = document.createElement('div');
    stage.className = 'overview-stage';
    stage.setAttribute('aria-label', `Orbit view of ${bucket.name}`);
    const empty = document.createElement('span'); empty.textContent = 'No bodies assigned';
    const hint = document.createElement('span'); hint.className = 'overview-stage-hint';
    hint.textContent = 'Drag to orbit · Scroll to zoom';
    const stageLabel = document.createElement('span'); stageLabel.className = 'overview-stage-label';
    stage.append(empty, hint, stageLabel);
    const actions = document.createElement('div'); actions.className = 'overview-card-actions';
    const stageButtons = new Map();
    const stages = document.createElement('div'); stages.className = 'overview-stage-buttons'; stages.setAttribute('role', 'group'); stages.setAttribute('aria-label', `Work stage for ${bucket.name}`);
    for (const workStage of workStages) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'overview-stage-button';
      button.textContent = workStage.short;
      button.title = workStage.name;
      button.style.setProperty('--button-color', workStage.color);
      button.setAttribute('aria-label', `${workStage.name} stage for ${bucket.name}`);
      button.addEventListener('click', () => {
        const current = getPlan().buckets.find(item => item.id === bucket.id);
        if (current) setBucketStage(bucket.id, current.stage === workStage.id ? null : workStage.id);
      });
      stages.append(button);
      stageButtons.set(workStage.id, button);
    }
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open in planning';
    actions.append(stages, open);
    header.append(grip, top);
    article.append(header, stage, actions);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f8fa');
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa6b4c3, 1.8));
    const light = new THREE.DirectionalLight(0xffffff, 1.6);
    light.position.set(4000, 9000, 6000);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 100000);
    const controls = new OrbitControls(camera, stage);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 10;
    controls.maxDistance = 100000;
    controls.screenSpacePanning = true;
    const card = { article, top, grip, priority, stage, stageLabel, stageButtons, stages, name, count, empty, scene, camera, controls, meshes: [], targets: new Map(), membership: '' };
    grip.addEventListener('dragstart', event => {
      draggingBucketId = bucket.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', bucket.id);
      article.classList.add('dragging');
    });
    grip.addEventListener('dragend', () => { draggingBucketId = null; clearDragMarkers(); });
    grip.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
      const ids = getPlan().buckets.map(item => item.id);
      const index = ids.indexOf(bucket.id);
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const neighbor = ids[index + direction];
      if (!neighbor) return;
      event.preventDefault();
      moveBucket(bucket.id, neighbor, direction < 0);
      grip.focus();
    });
    article.addEventListener('dragover', event => {
      if (!draggingBucketId || draggingBucketId === bucket.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = article.getBoundingClientRect();
      const before = Math.abs(event.clientY - (rect.top + rect.height / 2)) > rect.height / 3
        ? event.clientY < rect.top + rect.height / 2
        : event.clientX < rect.left + rect.width / 2;
      clearDragMarkers();
      cards.get(draggingBucketId)?.article.classList.add('dragging');
      article.classList.add(before ? 'drop-before' : 'drop-after');
    });
    article.addEventListener('drop', event => {
      if (!draggingBucketId || draggingBucketId === bucket.id) return;
      event.preventDefault();
      const before = article.classList.contains('drop-before');
      moveBucket(draggingBucketId, bucket.id, before);
      draggingBucketId = null;
      clearDragMarkers();
    });
    top.addEventListener('click', () => showDetails(bucket.id));
    open.addEventListener('click', () => openBucket(bucket.id));
    return card;
  }

  function positionCard(card) {
    const nudges = getPlan().viewNudges?.[card.article.dataset.bucketId] || {};
    for (const mesh of card.meshes) {
      const target = card.targets.get(mesh.userData.bodyId);
      mesh.position.copy(mesh.userData.home);
      if (target) mesh.position.lerp(target, distance);
      const offset = nudges[mesh.userData.bodyId];
      if (offset && distance) {
        const source = mesh.userData.source;
        source.parent.updateWorldMatrix(true, false);
        nudgeMatrix.setFromMatrix4(source.parent.matrixWorld);
        mesh.position.addScaledVector(new THREE.Vector3().fromArray(offset).applyMatrix3(nudgeMatrix), distance);
      }
    }
    card.scene.updateMatrixWorld(true);
  }

  function fitCard(card) {
    if (!card.meshes.length) return;
    card.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty();
    for (const mesh of card.meshes) box.expandByObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(50, box.getSize(new THREE.Vector3()).length() / 2);
    const viewDistance = radius / Math.sin(THREE.MathUtils.degToRad(card.camera.fov / 2)) * 1.2;
    const direction = card.camera.position.clone().sub(card.controls.target);
    if (direction.lengthSq() < 1) direction.set(0.75, 0.55, 1);
    direction.normalize();
    card.camera.position.copy(center).addScaledVector(direction, viewDistance);
    card.controls.target.copy(center);
    card.camera.near = Math.max(0.1, viewDistance / 1000);
    card.camera.far = viewDistance * 20;
    card.camera.updateProjectionMatrix();
    card.controls.update();
  }

  function refresh() {
    const plan = getPlan();
    const buckets = plan.buckets || [];
    const validIds = new Set(buckets.map(bucket => bucket.id));
    for (const [id, card] of cards) {
      if (validIds.has(id)) continue;
      if (detailsBucketId === id) closeDetails();
      card.controls.dispose();
      card.article.remove();
      for (const mesh of card.meshes) card.scene.remove(mesh);
      cards.delete(id);
    }
    for (const [index, bucket] of buckets.entries()) {
      let card = cards.get(bucket.id);
      if (!card) { card = newCard(bucket); cards.set(bucket.id, card); }
      grid.append(card.article);
      card.name.textContent = bucket.name;
      card.priority.textContent = String(index + 1);
      card.grip.setAttribute('aria-label', `Reorder ${bucket.name}, priority ${index + 1}`);
      card.top.setAttribute('aria-label', `View bodies in ${bucket.name}`);
      card.stage.setAttribute('aria-label', `Orbit view of ${bucket.name}`);
      card.stages.setAttribute('aria-label', `Work stage for ${bucket.name}`);
      const workStage = workStages.find(stage => stage.id === bucket.stage);
      card.stageLabel.textContent = workStage?.name || 'Stage not set';
      card.stage.style.setProperty('--stage-background', workStage?.background || '#f5f8fa');
      card.stage.style.setProperty('--stage-accent', workStage?.color || '#829587');
      card.scene.background.set(workStage?.background || '#f5f8fa');
      for (const [stageId, button] of card.stageButtons) {
        button.setAttribute('aria-pressed', String(stageId === workStage?.id));
        button.setAttribute('aria-label', `${workStages.find(stage => stage.id === stageId).name} stage for ${bucket.name}`);
      }
      if (detailsBucketId === bucket.id) detailsScene.background.set(workStage?.background || '#f5f8fa');
      const ids = report.bodies.filter(body => plan.assignments[body.id] === bucket.id).map(body => body.id);
      card.count.textContent = `${ids.length} bod${ids.length === 1 ? 'y' : 'ies'}`;
      card.stage.classList.toggle('empty', ids.length === 0);
      card.empty.hidden = ids.length > 0;
      const membership = ids.join('|');
      if (membership !== card.membership) {
        for (const mesh of card.meshes) card.scene.remove(mesh);
        card.meshes = ids.map(cloneFor).filter(Boolean);
        for (const mesh of card.meshes) {
          mesh.position.copy(mesh.userData.home);
          card.scene.add(mesh);
        }
        card.scene.updateMatrixWorld(true);
        card.targets.clear();
        radialTargets(card.meshes).forEach((target, index) => card.targets.set(card.meshes[index].userData.bodyId, target));
        card.membership = membership;
        positionCard(card);
        fitCard(card);
      } else positionCard(card);
    }
    document.getElementById('overview-count').textContent = `${buckets.length} bucket${buckets.length === 1 ? '' : 's'}`;
    const summary = document.getElementById('overview-status-summary');
    const summaryStages = [...workStages, { id: null, name: 'Stage not set', color: '#829587' }];
    summary.replaceChildren(...summaryStages.map(stage => {
      const count = buckets.filter(bucket => stage.id
        ? bucket.stage === stage.id
        : !workStages.some(known => known.id === bucket.stage)).length;
      const item = document.createElement('div');
      item.className = 'overview-status-count';
      item.style.setProperty('--status-color', stage.color);
      const value = document.createElement('strong'); value.textContent = String(count);
      const label = document.createElement('span'); label.textContent = stage.name;
      item.append(value, label);
      return item;
    }));
    if (detailsBucketId) showDetails(detailsBucketId);
    let emptyState = grid.querySelector('.overview-empty');
    if (!buckets.length && !emptyState) {
      emptyState = document.createElement('div'); emptyState.className = 'overview-empty';
      emptyState.textContent = 'Create a work order bucket in Planning to see it here.';
      grid.append(emptyState);
    } else if (buckets.length) emptyState?.remove();
  }

  function resize() {
    if (!active) return;
    const height = Math.max(1, window.innerHeight - document.querySelector('header').getBoundingClientRect().height);
    renderer.setSize(window.innerWidth, height, false);
  }

  function draw() {
    if (!active) return;
    frameId = requestAnimationFrame(draw);
    const canvasRect = canvas.getBoundingClientRect();
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const card of cards.values()) {
      if (!card.meshes.length) continue;
      const rect = card.stage.getBoundingClientRect();
      const left = Math.max(0, rect.left - canvasRect.left);
      const right = Math.min(canvasRect.width, rect.right - canvasRect.left);
      const bottom = Math.max(0, canvasRect.bottom - rect.bottom);
      const top = Math.min(canvasRect.height, canvasRect.bottom - rect.top);
      if (right <= left || top <= bottom) continue;
      card.camera.aspect = rect.width / rect.height;
      card.camera.updateProjectionMatrix();
      card.controls.update();
      renderer.setViewport(rect.left - canvasRect.left, canvasRect.bottom - rect.bottom, rect.width, rect.height);
      renderer.setScissor(left, bottom, right - left, top - bottom);
      renderer.render(card.scene, card.camera);
    }
    renderer.setScissorTest(false);
    if (!details.hidden && tileFocusBodyId) focusedViewer?.draw();
    if (!details.hidden && !tileMode) {
      const rect = detailsStage.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (detailsRenderer.domElement.width !== Math.floor(width * detailsRenderer.getPixelRatio()) ||
          detailsRenderer.domElement.height !== Math.floor(height * detailsRenderer.getPixelRatio())) {
        detailsRenderer.setSize(width, height, false);
      }
      detailsCamera.aspect = width / height;
      detailsCamera.updateProjectionMatrix();
      detailsControls.update();
      detailsRenderer.render(detailsScene, detailsCamera);
    }
  }

  slider.addEventListener('input', () => {
    distance = Number(slider.value);
    output.textContent = `${distance.toFixed(1)}×`;
    for (const card of cards.values()) positionCard(card);
    if (detailsBucketId) syncDetailsMeshes(cards.get(detailsBucketId));
    clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      for (const card of cards.values()) fitCard(card);
      if (detailsBucketId) fitDetails();
    }, 180);
  });
  window.addEventListener('resize', resize);
  return {
    show() {
      refresh();
      if (active) { resize(); return; }
      active = true;
      resize();
      draw();
    },
    hide() {
      active = false;
      closeDetails();
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      clearTimeout(refitTimer);
    },
    refresh
  };
}
