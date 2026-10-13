const assetRoot = new URL('./assets/drawings/', import.meta.url);

export function createPartDrawingViewer({ center, sourceSha256, onReady }) {
  const panel = document.createElement('section');
  panel.className = 'part-drawing-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Part drawing preview');
  panel.innerHTML = `<div class="part-drawing-toolbar">
    <div class="part-drawing-label"><small>MODEL REVIEW · INCHES</small><strong></strong></div>
    <div class="part-drawing-exports"><a download>PDF</a><a download>DXF</a></div>
    <div class="part-drawing-zoom"><button type="button" aria-label="Zoom drawing out">−</button><button type="button" aria-label="Fit drawing">Fit</button><button type="button" aria-label="Zoom drawing in">+</button><button type="button" aria-label="Expand drawing">⤢</button></div>
  </div><div class="part-drawing-paper"><div class="part-drawing-sheet"><img alt="" draggable="false"></div></div>`;
  center.querySelector('.bucket-center-head').after(panel);
  const paper = panel.querySelector('.part-drawing-paper');
  const sheet = panel.querySelector('.part-drawing-sheet');
  const image = panel.querySelector('img');
  const [pdf, dxf] = panel.querySelectorAll('a');
  let manifest = null, loading = null, current = null, zoom = 1;
  function entry(group) {
    if (!manifest || !group) return null;
    return Object.values(manifest.drawings).find(d => d.instanceIds.some(id => group.ids.includes(id))) || null;
  }
  function layout() {
    if (panel.hidden || !paper.clientWidth || !paper.clientHeight) return;
    const fit = Math.min((paper.clientWidth - 30) / 2448, (paper.clientHeight - 30) / 1584);
    image.style.width = `${2448 * fit * zoom}px`;
    image.style.height = `${1584 * fit * zoom}px`;
    sheet.style.minWidth = `${Math.max(paper.clientWidth, 2448 * fit * zoom + 30)}px`;
    sheet.style.minHeight = `${Math.max(paper.clientHeight, 1584 * fit * zoom + 30)}px`;
  }
  async function load() {
    if (loading) return loading;
    loading = fetch(new URL('index.json', assetRoot), { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error('Drawing preview unavailable');
      return r.json();
    }).then(data => {
      if (data.sourceSha256 === sourceSha256) manifest = data;
      onReady?.();
    }).catch(error => { console.warn(error.message); });
    return loading;
  }
  function show(group) {
    const drawing = entry(group);
    if (!drawing) { hide(); return false; }
    panel.hidden = false; center.classList.add('drawing-mode');
    if (current !== drawing.mark) {
      current = drawing.mark; zoom = 1;
      image.src = new URL(drawing.svg, assetRoot).href;
      image.alt = `${drawing.name}: top, front, bottom, section and isometric drawing with dimensions`;
      panel.querySelector('.part-drawing-label strong').textContent = drawing.mark;
      for (const [link, format] of [[pdf, 'pdf'], [dxf, 'dxf']]) {
        link.href = new URL(drawing[format], assetRoot).href;
        link.download = drawing[format];
        link.title = format === 'dxf' ? 'Download multi-view DXF drawing in inches' : 'Download vector PDF drawing';
      }
      paper.scrollTop = 0; paper.scrollLeft = 0;
    }
    requestAnimationFrame(layout); return true;
  }
  function hide() { panel.hidden = true; panel.classList.remove('drawing-expanded'); center.classList.remove('drawing-mode'); expand.setAttribute('aria-label', 'Expand drawing'); }
  const [less, fit, more, expand] = panel.querySelectorAll('button');
  less.addEventListener('click', () => { zoom = Math.max(1, zoom - .5); layout(); });
  fit.addEventListener('click', () => { zoom = 1; layout(); paper.scrollTop = 0; paper.scrollLeft = 0; });
  more.addEventListener('click', () => { zoom = Math.min(5, zoom + .5); layout(); });
  expand.addEventListener('click', () => { const large = panel.classList.toggle('drawing-expanded'); expand.setAttribute('aria-label', large ? 'Collapse drawing' : 'Expand drawing'); zoom = 1; layout(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('drawing-expanded')) { panel.classList.remove('drawing-expanded'); expand.setAttribute('aria-label','Expand drawing'); zoom = 1; layout(); } });
  new ResizeObserver(layout).observe(paper);
  return { load, show, hide, available: group => Boolean(entry(group)), get visible() { return !panel.hidden; } };
}
