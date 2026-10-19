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

### Drawing revision 02: feature locations

Every hole/mortise now has an on-view X location from END A and a transverse dimension from the marked EDGE C. Shared columns and regular row spacing remain consolidated, and slot/mortise long-axis orientation is stated. The mount plate hole row is 1/2 inch from its main straight edge, 1-1/2 inches from END A to the first center, and 2 inches between centers. The short projecting tab is not the hole-layout datum. All 35 pilot features were checked against source positions. Revision-specific files preserve the prior sheets and avoid stale cached drawings.

### Drawing revision 03: stair run and full-body span

Stair run is now measured between successive installed riser planes through the interrupted/notched tread profile. The five current stair-profile bodies have eight typical 11-inch bays and one distinct 10-3/4-inch end bay. Their actual repeated rise is 6.7143 inches; decimal precision avoids cumulative fraction rounding. Body 70 now uses horizontal/vertical stair references in its drawing.

Aligned P-Q dimensions measure the maximum direct span over the entire 3D body, including thickness; Face A shows projected endpoints. Body 58 has an exact span of 114.9329 inches (114-15/16 rounded to 1/64). Width and height remain separate. The geometry audit also checks curved extremities and rigid rotation invariance, and front outlines include actual source end projections. Earlier hole/mortise location checks still pass.

### Drawing revision 04: all work orders

The pencil toggle now applies throughout all 12 buckets: 106 unique drawing types covering 226 assigned body instances. Each drawing has PDF/DXF downloads. The full review set has 118 pages, including an installed-position assembly and part schedule for every bucket.

All 636 holes, slots and mortises have checked size, longitudinal and transverse location constraints. TOP RUN uses actual riser-plane pitches and separates the end bay. Curved shoe walls retain model radii and source sections; tube drilling identifies the actual wall penetration. Countersinks include entrance/exit sizes and modeled included angles. Dense landing-plate drilling layouts use larger face views. These are model-derived review drawings; material, finish and fabrication tolerances are not invented.

Drawings are checked against the STEP source hash, bucket identity and exact grouped instance membership. Revisions and reassignment require regenerated assets. A saved batch workflow derives new job/bucket names, quantities and geometry rather than copying this job's dimensions.

### Drawing revision 05: clear leaders and measured corner cuts

Callouts follow the side of the face they describe: upper mortises above and lower-edge notches below. Caption bands are reserved and crossed feature/profile leaders are rejected. Modeled corner chamfers receive a counted size/angle callout; unequal cuts retain both X and Y setbacks. The top connection mount fin is measured at 0.6645-inch X setback by 0.6600-inch Y setback, 44.8 degrees to length, at two matching corners. No nominal 45-degree replacement was made. PDF, SVG and DXF share these annotations.

### Drawing revision 06: shorter radius leaders

Radius callouts choose the closest clear equivalent visible arc rather than the first STEP edge. A lower notch corner is preferred for a below-view caption when it shares the same radius as the upper corner. Matching radii use a single TYP callout; distinct sizes remain separate. Source arc identity, points and exact radius are verified for flat, dense and formed views.

## Drawing review R07

All 12 buckets / 106 unique parts / 118 pages now use nearest-clear matching hole, slot and mortise leaders and fractional display to 1/32 inch. Exact decimal bores and pitches remain where required. END A / EDGE C location dimensions, source geometry and membership are retained. Selective CAD annotation gaps preserve outlines, dimension lines and arrowheads; ordinary extension crossings remain continuous. These are review drawings, with release material/tolerances still separate. Prior R06 exports remain available for rollback.

## Drawing review R08: native hole manufacturing specifications

SolidWorks Hole Wizard specifications now join the matching STEP part/configuration.
26 sheets contain 183 matched visible features, including 73 tapped hole locations
on 13 sheets: 1/4-20 UNC, 5/16-18 UNC and 3/8-16 UNC. Tap drill sizes, through-wall
scope, countersink angles and counterbore depths remain explicit. Counts and
locations retain the STEP geometry. No missing thread class is invented.

All 12 buckets / 106 drawing types / 118 pages retain their prior geometry,
quantities, END A / EDGE C datums and 1/32-inch fractional display. SVG, PDF and
DXF downloads use R08 filenames. Previous R07 assets remain available for rollback.
Native report files and work-computer paths remain outside the public package.

## Drawing review R09: source projection corner preservation

The edge-view convex hull used an area epsilon before consolidating near-duplicate
STEP projections. Coordinate roundoff could remove a real corner, producing a
false diagonal closure (Connection TOP body 195) and clipped plate ends.
Consolidate coordinate noise at 1e-8 inch first, then test actual turn signs.
Original source coordinates, bevels and curved boundaries are retained.

Regenerated all 106 unique part sheets / 118 pages across 12 buckets. Eight plate
front views are corrected; seven formed-body audit hulls retain their corners and
curved extents (formed views already use actual edges). Five whole-body span
measurements are corrected by the same shared hull fix. The new projection gate
checks every source point against the front support outline, ordered top/bottom
wire closure, formed/isometric edge endpoints and whole-body spans; shuffled
near-duplicate corners and real bevels are regression fixtures. Native Hole Wizard
metadata, 73 tap locations, all planning assignments and quantities are retained.
PDF, SVG and DXF exports use R09; previous R08 exports remain available.

## Drawing review R10: attached form-depth and thickness annotations

A form-depth leader previously pointed to the midpoint of the projected bounding
rectangle. On curved profiles that point can be empty space. Eight formed sheets
now use two-ended depth dimensions with extension lines tied to exact source
extrema. Fifteen plate thickness leaders move onto the actual source side edge,
including sloped/beveled ends. Radius leaders respect the depth-caption clearance
band; short depth dimensions use a horizontal caption when vertical text cannot fit.

Every part has an annotation audit with source edge IDs, source points, projection
coordinates and rendered SVG checks. Geometry, native tapping callouts and all
planning assignments/quantities remain intact. All 106 part types pass the shared
projection/closure, location, source-reference and annotation-clearance gates.
All 118 review-set pages were rendered and inspected.

23 revised part sheets use R10; 83 unchanged reviewed sheets retain R09. All 12
bucket review PDFs and the complete review set are R10 and include those sheet
revisions. Earlier files remain available for rollback.


## Job 2606 · HPC

The job selector links the existing 2605 viewer with `docs/jobs/2606/`. The 2606 public viewer contains the 20-work-order snapshot exported October 19, 2026, in John's current order. QRAIL is vendor supplied and has no drawings. The 19 drawing buckets contain 130 detailed model-review sheets, 13 explicitly limited reference sheets and 19 bucket covers. Native 2606 thread specifications remain unconfirmed. Public viewing preserves the shared assignments.
