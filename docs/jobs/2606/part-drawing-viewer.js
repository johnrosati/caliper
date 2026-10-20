const assetRoot = new URL('./assets/drawings/', import.meta.url);
export function createPartDrawingViewer({ center, sourceSha256, onReady }) {
  const panel = document.createElement('section');
  panel.className = 'part-drawing-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Part drawing preview');
  panel.innerHTML = `<div class="part-drawing-toolbar">
    <div class="part-drawing-label"><small>MODEL REVIEW · INCHES</small><strong></strong></div>
    <div class="part-drawing-exports"><a download>PDF</a><a download>DXF</a></div>
    <div class="part-drawing-zoom"><button type="button" aria-label="Zoom drawing out">−</button><button type="button" aria-label="Fit drawing">Fit</button><button type="button" aria-label="Zoom drawing in">+</button><button type="button" aria-label="Expand drawing">⤢</button></div>
  </div><div class="part-drawing-paper"><div class="part-drawing-sheet"></div></div>`;
  center.querySelector('.bucket-center-head').after(panel);
  const paper = panel.querySelector('.part-drawing-paper'), sheet = panel.querySelector('.part-drawing-sheet');
  const [pdf, dxf] = panel.querySelectorAll('a');
  let manifest = null, loading = null, current = null, zoom = 1;
  function entry(group, bucketId) {
    if (!manifest || !group) return null;
    return Object.values(manifest.drawings).find(d => (!bucketId || !d.bucketId || d.bucketId === bucketId) && d.instanceIds.length === group.ids.length && d.instanceIds.every(id => group.ids.includes(id))) || null;
  }
  function layout() {
    if (panel.hidden || !paper.clientWidth || !paper.clientHeight) return;
    const fit = Math.min((paper.clientWidth - 30) / 2448, (paper.clientHeight - 30) / 1584);
    for (const image of sheet.querySelectorAll('img')) {
      image.style.width = `${2448 * fit * zoom}px`; image.style.height = `${1584 * fit * zoom}px`;
    }
    sheet.style.minWidth = `${Math.max(paper.clientWidth, 2448 * fit * zoom + 30)}px`;
    sheet.style.minHeight = `${paper.clientHeight}px`;
  }
  async function load() {
    if (loading) return loading;
    loading = fetch(new URL('index.json', assetRoot), { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error('Drawing preview unavailable'); return r.json();
    }).then(data => { if (data.sourceSha256 === sourceSha256) manifest = data; onReady?.(); })
      .catch(error => console.warn(error.message));
    return loading;
  }
  function renderSheets(drawing) {
    sheet.replaceChildren();
    const pages = [{ svg: drawing.svg, dxf: drawing.dxf }, ...(drawing.profilePages || [])];
    for (const [index, page] of pages.entries()) {
      const frame = document.createElement('figure');
      frame.style.cssText = 'margin:0;display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0';
      if (pages.length > 1) {
        const caption = document.createElement('figcaption');
        caption.style.cssText = 'font-size:12px;padding:8px;color:#617e94';
        caption.append(`Sheet ${index + 1} of ${pages.length} · `);
        const link = document.createElement('a'); link.textContent = 'DXF';
        link.href = new URL(page.dxf, assetRoot).href; link.download = page.dxf;
        caption.append(link); frame.append(caption);
      }
      const image = document.createElement('img'); image.draggable = false;
      image.src = new URL(page.svg, assetRoot).href;
      image.alt = drawing.referenceOnly ? `${drawing.name}: reference geometry; ${drawing.limitation}` : `${drawing.name}: sheet ${index + 1} of ${pages.length}`;
      frame.append(image); sheet.append(frame);
    }
    sheet.style.display = 'flex'; sheet.style.flexDirection = 'column'; sheet.style.alignItems = 'center';
    sheet.style.justifyContent = 'flex-start'; sheet.style.gap = '24px';
    paper.scrollTop = 0; paper.scrollLeft = 0;
  }
  function show(group, bucketId) {
    const drawing = entry(group, bucketId);
    if (!drawing) { hide(); return false; }
    panel.hidden = false; center.classList.add('drawing-mode');
    if (current !== drawing.mark) {
      current = drawing.mark; zoom = 1;
      panel.querySelector('.part-drawing-label strong').textContent = drawing.mark;
      panel.querySelector('.part-drawing-label small').textContent = drawing.referenceOnly ? 'REFERENCE ONLY · DETAILING REQUIRED' : 'MODEL REVIEW · INCHES';
      panel.querySelector('.part-drawing-label').title = drawing.limitation || 'Model-derived review drawing; native thread specifications and release data require confirmation';
      for (const [link, format] of [[pdf, 'pdf'], [dxf, 'dxf']]) {
        link.href = new URL(drawing[format], assetRoot).href; link.download = drawing[format];
        link.title = format === 'dxf' ? 'Download first-sheet DXF in inches' : 'Download complete part PDF';
      }
      renderSheets(drawing);
    }
    requestAnimationFrame(layout); return true;
  }
  function hide() { panel.hidden = true; panel.classList.remove('drawing-expanded'); center.classList.remove('drawing-mode'); expand.setAttribute('aria-label', 'Expand drawing'); }
  const [less, fit, more, expand] = panel.querySelectorAll('.part-drawing-zoom button');
  less.addEventListener('click', () => { zoom = Math.max(1, zoom - .5); layout(); });
  fit.addEventListener('click', () => { zoom = 1; layout(); paper.scrollTop = 0; paper.scrollLeft = 0; });
  more.addEventListener('click', () => { zoom = Math.min(5, zoom + .5); layout(); });
  expand.addEventListener('click', () => { const large = panel.classList.toggle('drawing-expanded'); expand.setAttribute('aria-label', large ? 'Collapse drawing' : 'Expand drawing'); zoom = 1; layout(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('drawing-expanded')) { panel.classList.remove('drawing-expanded'); expand.setAttribute('aria-label','Expand drawing'); zoom = 1; layout(); } });
  new ResizeObserver(layout).observe(paper);
  return { load, show, hide, available: (group, bucketId) => Boolean(entry(group, bucketId)), info: (group, bucketId) => entry(group, bucketId), get visible() { return !panel.hidden; } };
}
