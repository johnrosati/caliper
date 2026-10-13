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

## BTM RUN drawing pilot

In Bucket, select BTM RUN and toggle the pencil on a unique-body card. The middle pane shows a STEP-derived review drawing with top/front/bottom, a material section and a small isometric view. The same pencil returns to orbit. PDF and DXF links download the displayed sheet; plus/minus, Fit and Expand make it easier to inspect. Other buckets retain their existing viewers.

The 12 drawing types cover the 34 BTM RUN body instances in the published plan. SVG and vector PDF use ANSI D sheets. DXF is an inch-based multi-view drawing with annotation and outline layers, not a cutting layout. Straight dimensions are rounded to 1/64 inch; modeled bore and mortise sizes remain decimal, and repeated pitches retain decimal precision when fraction rounding would accumulate. Material, finish and tolerances remain release inputs.

Drawings are tied to the STEP source SHA. A mismatched model hides these drawing toggles rather than displaying stale dimensions. New model versions need regenerated and checked drawing assets.
