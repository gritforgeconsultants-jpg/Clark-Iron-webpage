# Interactive connection study

The homepage integrates the user-supplied `Clark-Iron-Kinetic-Review.zip` as a
native section between the GC trust strip and services. Existing marketing,
contact, and SEO content is retained. No backend or build step is required.

## Run

From `/workspace/Clark-Iron-webpage`, run:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Serve over HTTP rather than opening `index.html` directly: the scene uses ES
modules. Deploy the repository root, including `css/kinetic.css`,
`js/kinetic/load.js`, `js/kinetic/scene.js`, and `js/kinetic/lib/`.

The model bundle loads as the section approaches view. The loader measures the
sticky header so the scene and controls fit below it. Rendering stops when the
view is offscreen, the tab is hidden, or the scene is idle. Mobile rendering caps
pixel density and uses smaller shadow maps. No CDN, API key, or additional
runtime dependency is needed.

Left- or right-button mouse dragging and one- or two-finger touch rotate the view.
Native browser dragging and selection on the canvas are suppressed so Edge
keeps the gesture in the orbit controls. Scroll the page
by swiping outside the model canvas. Mobile labels remain visible in both
assembled and exploded views, with leader lines to the parts and collision
avoidance along the screen edges. The native range control supports keyboard input.
Pause disables animated transitions; manual controls remain available. Reduced
motion starts paused and suppresses automatic scroll animation. Replay respects
that preference. If JavaScript or WebGL is unavailable, a static description
remains visible and the company's services and contact links are still usable.

The export downloads a 3840 × 2160 PNG of the model canvas; text annotations and
website content are not part of that image. Export depends on GPU/browser limits.
The geometry is illustrative, not an engineered connection or erection sequence.

## Sources

The scene and procedural model originate in the supplied review archive, whose
SOURCE.txt references the existing website at commit
`f94c7692eb8847bf2f595620db06191ee6c113a3`.
The supplied Three.js bundle (revision 187, with OrbitControls and
RoomEnvironment) is retained locally. Its MIT license is in
`js/kinetic/lib/LICENSE-three.txt`. Unused GSAP/ScrollTrigger bundles and duplicate
website images from the archive are not needed by this integration.

## Validation

Use Chromium to check desktop and mobile framing, scroll assembly, orbit, slider
and keyboard controls, pause, reset, replay, and PNG export. Check reduced motion
and simulate WebGL unavailability. Existing favicon URLs reference absent files;
those pre-existing 404 responses are unrelated to the connection study.
