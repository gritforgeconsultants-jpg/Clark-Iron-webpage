const root = document.getElementById('connection-study');

import * as THREE from './lib/three.bundle.min.js';

const stage = document.getElementById('kinetic-stage');
const canvas = document.getElementById('kinetic-scene');

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (err) {
    stage.classList.add('no-webgl');
    throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.95;

const camera = new THREE.PerspectiveCamera(30, 1, 5, 2000);
camera.position.set(0.58, 0.3, 0.76).multiplyScalar(300);

// Keep Edge's native drag/selection behavior from taking over a model gesture.
canvas.draggable = false;
canvas.addEventListener('dragstart', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') event.preventDefault();
}, { capture: true });
const controls = new THREE.OrbitControls(camera, canvas);
controls.cursorStyle = 'grab';
controls.enableRotate = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
// Rotate with one finger on the canvas; the surrounding page remains scrollable.
controls.touches.ONE = THREE.TOUCH.ROTATE;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.53;
let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.5;
controls.addEventListener('start', () => { controls.autoRotate = false; stage.classList.add('dragging'); });
controls.addEventListener('end', () => stage.classList.remove('dragging'));

/* ---------- lights ---------- */
const key = new THREE.DirectionalLight(0xfff0dd, 2.3);
key.position.set(95, 150, 110);
key.target.position.set(35, -10, 0);
key.castShadow = true;
const shadowSize = window.innerWidth < 700 ? 1024 : 2048;
key.shadow.mapSize.set(shadowSize, shadowSize);
Object.assign(key.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 20, far: 480 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.12;
key.shadow.radius = 5;
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0x9cc2ff, 1.5);
rim.position.set(-110, 60, -120);
scene.add(rim);

/* ---------- procedural surface textures ---------- */
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(11);
const SIZE = 512;

function surfaceCanvas(base, blotches, streakAlpha) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const x = c.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 70; i++) {
        const px = rng() * SIZE, py = rng() * SIZE, r = 30 + rng() * 130;
        const col = blotches[Math.floor(rng() * blotches.length)];
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, col);
        g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
        x.fillStyle = g;
        for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) {
            x.setTransform(1, 0, 0, 1, ox, oy);
            x.fillRect(px - r, py - r, 2 * r, 2 * r);
        }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 2200; i++) {
        const y = rng() * SIZE, x0 = rng() * SIZE, len = 20 + rng() * 220;
        x.strokeStyle = (rng() < 0.5 ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + (streakAlpha * (0.4 + rng())) + ')';
        x.lineWidth = 0.5 + rng();
        x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y);
        x.moveTo(x0 - SIZE, y); x.lineTo(x0 - SIZE + len, y); x.stroke();
    }
    for (let i = 0; i < 16000; i++) {
        x.fillStyle = (rng() < 0.5 ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + (streakAlpha * 1.4) + ')';
        x.fillRect(rng() * SIZE, rng() * SIZE, 1, 1);
    }
    return c;
}

const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(canvasEl, inchesPerTile, srgb, rotation = 0) {
    const t = new THREE.CanvasTexture(canvasEl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / inchesPerTile, 1 / inchesPerTile);
    t.rotation = rotation;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const colorCanvas = surfaceCanvas('#ffffff',
    ['rgba(70,90,130,0.09)', 'rgba(125,95,70,0.07)', 'rgba(0,0,0,0.09)'], 0.012);
const roughCanvas = surfaceCanvas('#c8c8c8', ['rgba(0,0,0,0.13)', 'rgba(255,255,255,0.14)'], 0.022);

function steelMaterial(color, roughness, rotation = 0, tile = 22) {
    const r = tex(roughCanvas, tile, false, rotation);
    return new THREE.MeshStandardMaterial({
        color, metalness: 0.86, roughness,
        map: tex(colorCanvas, tile * 1.7, true, rotation),
        roughnessMap: r, bumpMap: r, bumpScale: 0.35
    });
}

const beamMat = steelMaterial(0x65707d, 0.56);
const columnMat = steelMaterial(0x65707d, 0.56, Math.PI / 2);
const plateMat = steelMaterial(0x9299a2, 0.5, 0, 9);
const weldMat = new THREE.MeshStandardMaterial({ color: 0x7d7a78, metalness: 0.88, roughness: 0.5 });
const boltMat = new THREE.MeshStandardMaterial({ color: 0xa9afb7, metalness: 1, roughness: 0.34 });

const threadCanvas = document.createElement('canvas');
threadCanvas.width = 4; threadCanvas.height = 32;
{
    const x = threadCanvas.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#000'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 4, 32);
}
const threadTex = new THREE.CanvasTexture(threadCanvas);
threadTex.wrapS = threadTex.wrapT = THREE.RepeatWrapping;
const THREAD = 1.5;
threadTex.repeat.set(1, THREAD * 9);
const threadMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.42, bumpMap: threadTex, bumpScale: 2.2 });

const markCanvas = document.createElement('canvas');
markCanvas.width = markCanvas.height = 256;
{
    const x = markCanvas.getContext('2d');
    x.fillStyle = x.strokeStyle = 'rgba(18,22,28,0.62)';
    x.font = '700 58px Arial, Helvetica, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('A325', 128, 132);
    x.lineWidth = 9; x.lineCap = 'round';
    for (const deg of [-90, 30, 150]) {
        const a = deg * Math.PI / 180;
        x.beginPath();
        x.moveTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
        x.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
        x.stroke();
    }
}
const markTex = new THREE.CanvasTexture(markCanvas);
markTex.colorSpace = THREE.SRGBColorSpace;
markTex.anisotropy = maxAniso;
const markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false });

/* ---------- geometry helpers (units: inches) ---------- */
function roundedPoly(pts, radii) {
    const shape = new THREE.Shape();
    const n = pts.length;
    const toward = (p, q, r) => {
        const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
        const k = Math.min(r, len / 2) / len;
        return [p[0] + dx * k, p[1] + dy * k];
    };
    for (let i = 0; i < n; i++) {
        const p = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
        const r = Array.isArray(radii) ? radii[i] : radii;
        const a = toward(p, prev, r), b = toward(p, next, r);
        if (i === 0) shape.moveTo(a[0], a[1]); else shape.lineTo(a[0], a[1]);
        if (r > 0) shape.quadraticCurveTo(p[0], p[1], b[0], b[1]);
    }
    shape.closePath();
    return shape;
}

function rectShape(x0, x1, y0, y1, r = 0.06) {
    return roundedPoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r);
}

function punch(shape, holes, radius) {
    for (const [hx, hy] of holes) {
        const h = new THREE.Path();
        h.absarc(hx, hy, radius, 0, Math.PI * 2, true);
        shape.holes.push(h);
    }
    return shape;
}

// Extrudes along +Z to exact thickness t, with a chamfer of size b on the cap edges.
function extrude(shape, t, b = 0.05, curveSegments = 18) {
    if (b <= 0) return new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments });
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b,
        bevelOffset: -b, bevelSegments: 2, curveSegments
    });
    g.translate(0, 0, b);
    return g;
}
const upright = g => g.rotateX(-Math.PI / 2);   // extrusion axis -> +Y, shape y -> -Z

function iSectionShape(d, bf, tf, tw, rk, rt = 0.07) {
    const D = d / 2, B = bf / 2, W = tw / 2;
    return roundedPoly([
        [-D, -B], [-D + tf, -B], [-D + tf, -W], [D - tf, -W], [D - tf, -B], [D, -B],
        [D, B], [D - tf, B], [D - tf, W], [-D + tf, W], [-D + tf, B], [-D, B]
    ], [rt, rt, rk, rk, rt, rt, rt, rt, rk, rk, rt, rt]);
}

function hexPoints(R) {
    return Array.from({ length: 6 }, (_, k) => [R * Math.cos(k * Math.PI / 3), R * Math.sin(k * Math.PI / 3)]);
}

function mesh(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
}

// Fillet weld bead: starts at corner p, legs along u and v, runs along u x v.
function weld(p, u, v, len, leg) {
    const rows = Math.round(len * 18), cols = 7;
    const positions = [], index = [];
    for (let i = 0; i <= rows; i++) {
        const z = (i / rows) * len;
        const taper = Math.min(1, z / 0.25, (len - z) / 0.25);
        for (let j = 0; j <= cols; j++) {
            const t = j / cols, a = t * Math.PI / 2;
            const ripple = 1 + 0.055 * Math.sin((z + 0.1 * Math.sin(t * Math.PI)) * 21) + 0.02 * Math.sin(z * 53 + t * 3);
            const s = leg * ripple * Math.sqrt(taper);
            positions.push(s * (0.45 * (1 - t) + 0.55 * Math.cos(a)), s * (0.45 * t + 0.55 * Math.sin(a)), z);
        }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
        index.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const U = new THREE.Vector3(...u), V = new THREE.Vector3(...v);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(U, V, new THREE.Vector3().crossVectors(U, V)));
    g.translate(...p);
    return mesh(g, weldMat);
}

/* ---------- section + connection dimensions ---------- */
const COL = { d: 14.0, bf: 14.5, tf: 0.71, tw: 0.44, k: 0.6, h: 56 };
const BM = { d: 21.0, bf: 8.24, tf: 0.615, tw: 0.40, k: 0.5, len: 40 };
const FACE = COL.d / 2;                 // column flange face
const BX0 = FACE + 0.5;                 // beam end, 1/2" setback
const PL = { t: 0.75, w: 7.5, len: 15.5 };
const TAB = { t: 0.375, w: 4.5, h: 15 };
const HOLE = 0.9375 / 2;
const GAUGE = 2.5;
const FLANGE_BOLT_X = [10.5, 13.5, 16.5, 19.5];
const WEB_BOLT_X = BX0 + 2;
const WEB_BOLT_Y = [6, 3, 0, -3, -6];
const GROUND = -COL.h / 2;

const assembly = new THREE.Group();
scene.add(assembly);
const parts = [];
const callouts = [];
const calloutLayer = document.getElementById('kinetic-callouts');
const svgNS = 'http://www.w3.org/2000/svg';
const mobileLeaders = document.createElementNS(svgNS, 'svg');
mobileLeaders.classList.add('mobile-leaders');
mobileLeaders.setAttribute('aria-hidden', 'true');
calloutLayer.appendChild(mobileLeaders);

function addPart(name, spec, objects, moves, opts = {}) {
    const g = new THREE.Group();
    objects.forEach(o => g.add(o));
    if (opts.position) g.position.copy(opts.position);
    if (opts.quaternion) g.quaternion.copy(opts.quaternion);
    g.userData.part = { name, spec };
    assembly.add(g);
    parts.push({ g, base: g.position.clone(), q0: g.quaternion.clone(), moves, spin: opts.spin || 0 });
    return g;
}

function callout(group, at, side, html) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...at);
    group.add(anchor);
    const el = document.createElement('div');
    el.className = 'callout ' + side;
    el.innerHTML = '<span class="dot"></span><span class="lead"></span><span class="txt">' + html + '</span>';
    calloutLayer.appendChild(el);
    const leader = document.createElementNS(svgNS, 'line');
    mobileLeaders.appendChild(leader);
    callouts.push({ anchor, el, side, leader });
}

/* ---------- column ---------- */
{
    const g = upright(extrude(iSectionShape(COL.d, COL.bf, COL.tf, COL.tw, COL.k), COL.h, 0.06, 8));
    g.translate(0, GROUND, 0);
    const col = addPart('W14×90 column', 'ASTM A992 wide flange', [mesh(g, columnMat)], []);
    callout(col, [-FACE, 21, COL.bf / 2], 'l', '<b>W14×90</b> column');
}

/* ---------- continuity plates ---------- */
{
    const inner = FACE - COL.tf, clip = 1;
    for (const level of [1, -1]) for (const side of [1, -1]) {
        const y = z => -side * z;   // upright() maps shape y to -Z
        const shape = roundedPoly([
            [-inner + clip, y(COL.tw / 2)], [inner - clip, y(COL.tw / 2)], [inner, y(COL.tw / 2 + clip)],
            [inner, y(COL.bf / 2)], [-inner, y(COL.bf / 2)], [-inner, y(COL.tw / 2 + clip)]
        ], 0.04);
        const m = mesh(upright(extrude(shape, 0.75, 0.04)), plateMat);
        m.position.y = level * (BM.d / 2 + PL.t / 2) - 0.375;
        const p = addPart('Continuity plate', 'PL ¾″, fitted between column flanges', [m],
            [[0.66, 1.0, 0, 0, side * 12]]);
        if (level === 1 && side === 1) callout(p, [-3, m.position.y + 0.75, COL.bf / 2], 'l', '<b>PL ¾″</b> continuity plate');
    }
}

/* ---------- beam ---------- */
{
    const flangeHoles = FLANGE_BOLT_X.flatMap(x => [[x - BX0, GAUGE], [x - BX0, -GAUGE]]);
    const flange = () => upright(extrude(punch(rectShape(0, BM.len, -BM.bf / 2, BM.bf / 2, 0.07), flangeHoles, HOLE), BM.tf, 0.05));
    const top = mesh(flange(), beamMat);
    top.position.set(BX0, BM.d / 2 - BM.tf, 0);
    const bottom = mesh(flange(), beamMat);
    bottom.position.set(BX0, -BM.d / 2, 0);

    const hw = BM.d / 2 - BM.tf + 0.02;
    const webGeo = extrude(punch(rectShape(0, BM.len, -hw, hw, 0), WEB_BOLT_Y.map(y => [WEB_BOLT_X - BX0, y]), HOLE), BM.tw, 0);
    webGeo.translate(0, 0, -BM.tw / 2);
    const web = mesh(webGeo, beamMat);
    web.position.x = BX0;

    const pieces = [top, bottom, web];
    for (const sy of [1, -1]) for (const sz of [1, -1]) {
        // k-region fillet between web and flange; rotateY(90deg) maps shape x -> -Z, extrusion -> +X
        const s = new THREE.Shape();
        s.moveTo(0, 0); s.lineTo(-sz * BM.k, 0);
        s.quadraticCurveTo(0, 0, 0, -sy * BM.k);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: BM.len, bevelEnabled: false, curveSegments: 8 });
        g.rotateY(Math.PI / 2);
        const f = mesh(g, beamMat);
        f.position.set(BX0, sy * (BM.d / 2 - BM.tf), sz * BM.tw / 2);
        pieces.push(f);
    }
    const beam = addPart('W21×62 beam', 'ASTM A992 wide flange', pieces, [[0.36, 0.76, 30, 0, 0]]);
    callout(beam, [BX0 + BM.len - 8, BM.d / 2, BM.bf / 2], 'r', '<b>W21×62</b> beam');
}

/* ---------- flange plates ---------- */
for (const s of [1, -1]) {
    const holes = FLANGE_BOLT_X.flatMap(x => [[x, GAUGE], [x, -GAUGE]]);
    const m = mesh(upright(extrude(punch(rectShape(FACE, FACE + PL.len, -PL.w / 2, PL.w / 2), holes, HOLE), PL.t, 0.06)), plateMat);
    const y0 = s === 1 ? BM.d / 2 : -BM.d / 2 - PL.t;
    m.position.y = y0;
    const beads = [
        weld([FACE, y0 + PL.t, -PL.w / 2], [1, 0, 0], [0, 1, 0], PL.w, 0.34),
        weld([FACE, y0, -PL.w / 2], [0, -1, 0], [1, 0, 0], PL.w, 0.34)
    ];
    const plate = addPart(s === 1 ? 'Top flange plate' : 'Bottom flange plate', 'PL ¾″ × 7½″, shop-welded to column',
        [m, ...beads], [[0.62, 0.96, 7, s * 9, 0]]);
    if (s === 1) callout(plate, [FACE + PL.len, y0 + PL.t, PL.w / 2], 'r', '<b>PL ¾″ × 7½″</b> flange plate');
}

/* ---------- shear tab ---------- */
{
    const z0 = BM.tw / 2;
    const shape = punch(rectShape(FACE, FACE + TAB.w, -TAB.h / 2, TAB.h / 2), WEB_BOLT_Y.map(y => [WEB_BOLT_X, y]), HOLE);
    const g = extrude(shape, TAB.t, 0.04);
    g.translate(0, 0, z0);
    const beads = [
        weld([FACE, TAB.h / 2, z0 + TAB.t], [1, 0, 0], [0, 0, 1], TAB.h, 0.3),
        weld([FACE, TAB.h / 2, z0], [0, 0, -1], [1, 0, 0], TAB.h, 0.3)
    ];
    const tab = addPart('Shear tab', 'PL ⅜″ × 4½″ × 15″', [mesh(g, plateMat), ...beads], [[0.62, 0.96, 7, 0, 4]]);
    callout(tab, [FACE + TAB.w, -5, z0 + TAB.t], 'r', '<b>PL ⅜″</b> shear tab');
    callout(tab, [FACE + 0.15, 5.5, z0 + TAB.t + 0.15], 'l', '<b>5/16″</b> fillet weld');
}

/* ---------- bolts ---------- */
const HEAD_H = 0.547, NUT_H = 0.86, WASHER_T = 0.136, HEX_R = 1.4375 / Math.sqrt(3), SHANK_R = 0.4375;
const headGeo = upright(extrude(roundedPoly(hexPoints(HEX_R), 0.05), HEAD_H, 0.06, 4));
const nutGeo = upright(extrude(punch(roundedPoly(hexPoints(HEX_R), 0.05), [[0, 0]], SHANK_R), NUT_H, 0.06, 20));
const washerShape = new THREE.Shape();
washerShape.absarc(0, 0, 0.875, 0, Math.PI * 2, false);
const washerGeo = upright(extrude(punch(washerShape, [[0, 0]], 0.47), WASHER_T, 0.025, 28));
const markGeo = new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2);
const shankGeos = {};
function shankGeo(len) {
    if (!shankGeos[len]) {
        const plain = len - THREAD;
        shankGeos[len] = {
            plain: new THREE.CylinderGeometry(SHANK_R, SHANK_R, plain, 28, 1, true).translate(0, -plain / 2, 0),
            thread: new THREE.CylinderGeometry(SHANK_R - 0.02, SHANK_R - 0.05, THREAD, 28).translate(0, -plain - THREAD / 2, 0)
        };
    }
    return shankGeos[len];
}

const UP = new THREE.Vector3(0, 1, 0);
// pos = point where the head bears; axis = direction the head faces.
function addBolt(pos, axis, grip, len, t0, headTravel, nutTravel, headFollow, nutFollow, label) {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, axis);
    const sg = shankGeo(len);
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.y = HEAD_H + 0.004;
    mark.rotation.y = pos.x * 1.7 + pos.y;
    const head = addPart('⅞″ A325 bolt', 'Heavy hex structural bolt',
        [mesh(headGeo, boltMat), mesh(sg.plain, boltMat), mesh(sg.thread, threadMat), mark],
        [[t0, t0 + 0.30, ...axis.clone().multiplyScalar(headTravel).toArray()], headFollow],
        { position: pos, quaternion: q, spin: 3 });
    head.children[0].rotation.y = pos.x * 0.9 + pos.z;

    const washer = mesh(washerGeo, boltMat);
    washer.position.y = -grip - WASHER_T;
    const nut = mesh(nutGeo, boltMat);
    nut.position.y = -grip - WASHER_T - NUT_H;
    nut.rotation.y = pos.x * 1.3 + pos.y * 0.7;
    addPart('Heavy hex nut + washer', 'A563 nut, F436 hardened washer', [washer, nut],
        [[t0, t0 + 0.26, ...axis.clone().multiplyScalar(-nutTravel).toArray()], nutFollow],
        { position: pos, quaternion: q, spin: -2 });
    if (label) callout(head, [0, HEAD_H, 0], 'r', label);
}

for (const s of [1, -1]) {
    let i = 0;
    for (const x of FLANGE_BOLT_X) for (const z of [GAUGE, -GAUGE]) {
        addBolt(new THREE.Vector3(x, s * (BM.d / 2 + PL.t), z), new THREE.Vector3(0, s, 0),
            PL.t + BM.tf, 2.75, i * 0.014, 14, 3, [0.62, 0.96, 7, s * 4, 0], [0.62, 0.96, 7, s * 5, 0],
            s === 1 && i === 6 ? '<b>⅞″ A325</b> bolts' : null);
        i++;
    }
}
WEB_BOLT_Y.forEach((y, j) => {
    addBolt(new THREE.Vector3(WEB_BOLT_X, y, BM.tw / 2 + TAB.t), new THREE.Vector3(0, 0, 1),
        TAB.t + BM.tw, 2.25, 0.05 + j * 0.016, 12, 8, [0.62, 0.96, 7, 0, 0], [0.62, 0.96, 7, 0, 0], null);
});

/* ---------- ground shadow catcher ---------- */
const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.42 }));
ground.position.y = GROUND;
ground.receiveShadow = true;
scene.add(ground);

/* ---------- explode state ---------- */
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const spinQ = new THREE.Quaternion();
let amount = 1, goal = 1, animating = false;

function applyExplode(e) {
    for (const p of parts) {
        p.g.position.copy(p.base);
        let firstK = 0;
        p.moves.forEach((m, i) => {
            const k = ease(clamp01((e - m[0]) / (m[1] - m[0])));
            if (i === 0) firstK = k;
            p.g.position.x += m[2] * k; p.g.position.y += m[3] * k; p.g.position.z += m[4] * k;
        });
        if (p.spin) {
            spinQ.setFromAxisAngle(UP, firstK * p.spin * Math.PI * 2);
            p.g.quaternion.copy(p.q0).multiply(spinQ);
        }
    }
}

const toggle = document.getElementById('kinetic-toggle');
const scrub = document.getElementById('kinetic-scrub');
function setGoal(g) {
    needsRender = true;
    goal = g; animating = true;
    if (reduceMotion || paused) { amount = g; animating = false; scrub.value = Math.round(g * 1000); }
    toggle.textContent = g === 1 ? 'Assemble' : 'Explode';
}
toggle.addEventListener('click', () => setGoal(goal === 1 ? 0 : 1));
scrub.addEventListener('input', () => {
    needsRender = true;
    animating = false;
    amount = scrub.value / 1000;
    goal = amount > 0.5 ? 1 : 0;
    toggle.textContent = goal === 1 ? 'Assemble' : 'Explode';
});

/* ---------- pointer: click to toggle, hover to identify ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tip = document.getElementById('kinetic-tip');
let down = null, hoverDirty = false, hoverXY = null, hovered = null;
const highlightCache = new Map();
function highlightOf(mat) {
    if (!highlightCache.has(mat)) {
        const h = mat.clone();
        h.emissive = new THREE.Color(0xf59e0b);
        h.emissiveIntensity = 0.28;
        highlightCache.set(mat, h);
    }
    return highlightCache.get(mat);
}
function setHovered(group) {
    if (group === hovered) return;
    needsRender = true;
    const swap = (g, on) => g.traverse(o => {
        if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
        if (on) { o.userData.base = o.material; o.material = highlightOf(o.material); }
        else if (o.userData.base) { o.material = o.userData.base; o.userData.base = null; }
    });
    if (hovered) swap(hovered, false);
    hovered = group;
    if (hovered) {
        swap(hovered, true);
        const info = hovered.userData.part;
        tip.innerHTML = '<b>' + info.name + '</b><span>' + info.spec + '</span>';
    }
    tip.style.opacity = hovered ? 1 : 0;
}
function partAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(assembly.children, true)) {
        let o = hit.object;
        while (o && !o.userData.part) o = o.parent;
        if (o) return o;
    }
    return null;
}
canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; setHovered(null); });
canvas.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && partAt(e.clientX, e.clientY)) {
        setGoal(goal === 1 ? 0 : 1);
    }
    down = null;
});
canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    hoverXY = { x: e.clientX, y: e.clientY };
    hoverDirty = true;
});
canvas.addEventListener('pointerleave', () => { hoverXY = null; setHovered(null); });

/* ---------- sizing + framing ---------- */
let needsRender = true;
controls.addEventListener('change', () => { needsRender = true; });
function resize() {
    needsRender = true;
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const c of callouts) c.width = c.el.offsetWidth;
}
new ResizeObserver(resize).observe(stage);
resize();

const focus = new THREE.Vector3(), offset = new THREE.Vector3(), projected = new THREE.Vector3();
function frameCamera(e) {
    const k = smooth(0.1, 0.9, e);
    const lerp = THREE.MathUtils.lerp;
    focus.set(lerp(20, 35, k), lerp(-3, -2, k), 0);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(lerp(33, 37, k) / tanV, lerp(31, 50, k) / (tanV * camera.aspect)) + 12;
    offset.copy(camera.position).sub(controls.target).setLength(distance);
    controls.target.copy(focus);
    camera.position.copy(focus).add(offset);
}

function placeCallouts(e) {
    const mobile = window.matchMedia('(max-width: 1000px)').matches;
    const alpha = mobile ? 1 : smooth(0.62, 0.95, e);
    const w = stage.clientWidth, h = stage.clientHeight;
    const columns = { l: [], r: [] };
    for (const c of callouts) {
        c.anchor.getWorldPosition(projected).project(camera);
        c.x = (projected.x * 0.5 + 0.5) * w;
        c.y = (-projected.y * 0.5 + 0.5) * h;
        const visible = projected.z > -1 && projected.z < 1 && alpha > 0.01;
        c.el.style.opacity = visible ? alpha : 0;
        c.leader.style.opacity = mobile && visible ? 1 : 0;
        if (!visible) continue;
        if (mobile) {
            columns[c.side].push(c);
        } else {
            let left = c.side === 'l';
            if (left && c.x - c.width < 6) left = false;
            else if (!left && c.x + c.width > w - 6) left = true;
            c.el.classList.toggle('l', left);
            c.el.style.transform = `translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) translate(${left ? '-100%' : '0'},-50%)`;
        }
    }
    // Pack labels down each screen edge, retaining a leader to the actual part.
    for (const [side, labels] of Object.entries(columns)) {
        labels.sort((a, b) => a.y - b.y);
        for (const c of labels) c.height = c.el.offsetHeight;
        const totalHeight = labels.reduce((sum, c) => sum + c.height, 0);
        const gap = Math.min(5, Math.max(0, (h - 12 - totalHeight) / Math.max(1, labels.length - 1)));
        let bottom = 6;
        for (const c of labels) {
            c.top = Math.max(bottom, Math.min(h - c.height - 6, c.y - c.height / 2));
            bottom = c.top + c.height + gap;
        }
        let top = h - 6;
        for (const c of [...labels].reverse()) {
            c.top = Math.min(c.top, top - c.height);
            top = c.top - gap;
        }
        for (const c of labels) {
            const width = c.el.offsetWidth;
            const x = side === 'l' ? 6 : w - width - 6;
            c.el.style.transform = `translate(${x}px,${c.top}px)`;
            c.leader.setAttribute('x1', c.x);
            c.leader.setAttribute('y1', c.y);
            c.leader.setAttribute('x2', side === 'l' ? x + width : x);
            c.leader.setAttribute('y2', c.top + c.height / 2);
        }
    }
}

let scrollMode = true;
const narrative = document.getElementById('kinetic-narrative');
const motionButton = document.getElementById('kinetic-motion');
let paused = reduceMotion;
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    reduceMotion = event.matches;
    paused = reduceMotion;
    motionButton.textContent = paused ? 'Enable motion' : 'Pause motion';
    motionButton.setAttribute('aria-pressed', String(paused));
});
motionButton.textContent = paused ? 'Enable motion' : 'Pause motion';
motionButton.setAttribute('aria-pressed', String(paused));
motionButton.onclick = () => { paused = !paused; motionButton.textContent = paused ? 'Enable motion' : 'Pause motion'; controls.autoRotate = false; motionButton.setAttribute('aria-pressed', String(paused)); };
function stopScroll() { scrollMode = false; }
scrub.addEventListener('input', stopScroll);
toggle.addEventListener('click', stopScroll);
controls.addEventListener('start', stopScroll);
document.getElementById('kinetic-replay').onclick = () => { needsRender = true; scrollMode = true; paused = reduceMotion; amount = 1; goal = 1; animating = false; scrub.value = 1000; motionButton.textContent=paused?'Enable motion':'Pause motion'; motionButton.setAttribute('aria-pressed', String(paused)); narrative.scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth'}); };
document.getElementById('kinetic-view').onclick = () => { scrollMode=false; camera.position.set(0.58,0.3,0.76).multiplyScalar(300); controls.target.set(20,-3,0); };
document.getElementById('kinetic-export').onclick = () => {
 const button=document.getElementById('kinetic-export');
 button.disabled=true; button.textContent='Rendering…';
 requestAnimationFrame(() => {
  const ratio=renderer.getPixelRatio();
  const aspect=camera.aspect;
  try {
   renderer.setPixelRatio(1); renderer.setSize(3840,2160,false);
   camera.aspect=3840/2160; camera.updateProjectionMatrix();
   frameCamera(amount); renderer.render(scene,camera);
   const a=document.createElement('a'); a.download='Clark-Iron-connection-3840x2160.png';
   a.href=canvas.toDataURL('image/png'); a.click();
   button.textContent='Export 4K still';
  } catch(e) { button.textContent='Export unavailable'; }
  finally {
   renderer.setPixelRatio(ratio); camera.aspect=aspect;
   resize(); frameCamera(amount); renderer.render(scene,camera);
   button.disabled=false;
  }
 });
};
/* ---------- loop ---------- */
let visible = true, last = performance.now();
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(stage);
canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); visible = false; root.classList.add('unavailable');
    root.querySelectorAll('.hud button, .hud input').forEach(el => el.disabled = true);
    root.querySelector('.fallback').textContent = 'The 3D view is unavailable. Reload to try again. This illustration shows a beam connected to a column with flange plates, a shear tab, and structural bolts.';
});
const DURATION = 3.4;

function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;

    const previousAmount = amount;
    if (scrollMode && !paused) {
        const r=narrative.getBoundingClientRect();
        const headerHeight = document.querySelector('.site-header').getBoundingClientRect().height;
        const p=clamp01((headerHeight-r.top) / Math.max(1,narrative.offsetHeight-(innerHeight-headerHeight)));
        const desired=1-smooth(.05,.9,p);
        amount = Math.abs(desired-amount) < 0.0001 ? desired : amount + (desired-amount)*Math.min(1,dt*6);
        scrub.value=Math.round(amount*1000); goal=amount>.5?1:0;
        toggle.textContent=goal===1?'Assemble':'Explode';
        const phase=p<.32?0:p<.67?1:2;
        root.querySelectorAll('.chapter').forEach((el,i)=>el.classList.toggle('active',i===phase));
        document.getElementById('kinetic-phase').textContent=['01 / COMPONENTS','02 / CONNECTION','03 / COMPLETE'][phase];
        document.getElementById('kinetic-progress').style.width=(p*100)+'%';
    }
    if (animating && !paused) {
        const step = dt / DURATION;
        amount = goal > amount ? Math.min(goal, amount + step) : Math.max(goal, amount - step);
        scrub.value = Math.round(amount * 1000);
        if (amount === goal) animating = false;
    }
    applyExplode(amount);
    frameCamera(amount);
    const cameraChanged = controls.update();
    needsRender ||= cameraChanged || Math.abs(previousAmount - amount) > 0.00001;

    if (hoverDirty) {
        hoverDirty = false;
        if (hoverXY) {
            setHovered(partAt(hoverXY.x, hoverXY.y));
            const r = stage.getBoundingClientRect();
            tip.style.transform = 'translate(' + (hoverXY.x - r.left + 14) + 'px,' + (hoverXY.y - r.top + 14) + 'px)';
        }
    }
    if (needsRender) {
        renderer.render(scene, camera);
        placeCallouts(amount);
        needsRender = false;
    }
}
requestAnimationFrame(tick);


root.classList.add('ready');
root.querySelectorAll('.hud button, .hud input').forEach(el => el.disabled = false);
scrub.value = Math.round(amount * 1000);
toggle.textContent = goal === 1 ? 'Assemble' : 'Explode';
