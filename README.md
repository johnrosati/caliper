# 2605 Stair Viewer

Public, view-only Three.js stair viewer: 12 work order buckets, body inspection, orbit, explode, tiles and edge measurements.

## Publish on GitHub Pages

Create a public repository and push this folder. In Settings > Pages, choose Deploy from a branch, main, /docs, and Save. The site URL is shown there after deployment. No build or server is required.

## Content updates

The published bucket snapshot is docs/assets/shared-plan.json. Replace it with a fresh planning export and commit to update the site. Model and manifest are in docs/assets. All paths are relative so project URLs work.

## Walkthrough

The captioned walkthrough is available at walkthrough.mp4 beneath the site URL.

Source model geometry and bucket plan in this repository are publicly downloadable.

## Bucket workspace

The third tab adds a light three-column workspace: reorderable bucket names, one orbit viewer with an explode slider, and a circular body carousel. Scroll, drag, or use arrow keys to focus a body type. Matching instances highlight together in amber. Clicking an assembled body also focuses its matching menu entry. The slider returns to installed positions at zero.

Body grouping requires matching source names, triangle counts, surface area, and intrinsic triangle-edge lengths within tessellation tolerance. Different sizes remain separate; uncertain matches remain separate. This is preview geometry grouping, not a fabrication BOM or an authoritative CAD part-number comparison.

Bucket order follows the saved plan in the editable application. In the public view-only application, reordering the Bucket menu is saved only as a browser viewing preference and leaves the shared plan unchanged.
