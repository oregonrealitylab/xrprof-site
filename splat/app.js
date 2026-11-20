/* Splat Annotator for xrprof.org
   Drop in a Gaussian splat, look around it, and pin colour-tagged notes to points in it.
   Everything runs in the visitor's browser: the splat is never uploaded.

   Parts, in order: setup, camera, loading, notes, orbs, picking, pointer input,
   panel (editor + list), export, frame loop.
   Rendering: three.js + Spark (sparkjs.dev). Both are vendored in ./vendor. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* EDIT: the colour tags. Change, add or remove lines here. */
const COLORS = [
  ["#ff5d5d", "Red"], ["#ffb224", "Amber"], ["#b6e84a", "Lime"], ["#3ddbd9", "Aqua"],
  ["#5aa2ff", "Blue"], ["#c58bff", "Violet"], ["#f2f5ee", "White"],
];
const SPLAT_EXT = /\.(ply|spz|splat|ksplat|sog|rad|zip)$/i;
const APP_ID = "xrprof-splat-annotator";
const STORE = "splatnotes:v1:";
const NOTES_ENTRY = "notes.json";          // name of the notes file inside a bundle
const PLY_TAG = "comment xrprof-notes ";   // prefix of the lines that carry notes inside a .ply

const stage = $("#stage"), canvas = $("#view"), tagsEl = $("#tags");
stage.classList.add("empty");

/* ------------------------------------------------------------------ setup */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  if (!renderer.capabilities.isWebGL2) throw new Error("WebGL2 missing");
} catch (e) {
  $(".dropbox h2").textContent = "3D is not available";
  $(".dropbox p:not(.chan)").textContent = "This browser or device cannot show WebGL2 graphics, which the viewer needs.";
  $("#choose").hidden = true;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x0c0f0d, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 1000);
camera.position.set(0, 0.5, 3);
const spark = new SparkRenderer({ renderer });
scene.add(spark);
const world = new THREE.Group();            // the splat and its orbs live here; "Flip" turns this group over
scene.add(world);

const S = {
  mesh: null, source: null,                 // source = { blob, name } of the splat as it was opened
  key: null, published: false,
  R: 1, center: new THREE.Vector3(),        // rough size and middle of the splat (world space)
  notes: [], flip: true, cam: null,
  tool: "nav", draft: null, labels: false, filter: null,
  lastColor: COLORS[0][0], count: 0,
};

/* ----------------------------------------------------------------- camera */
const controls = new OrbitControls(camera, canvas);   // pointer listeners for tools are added first, below
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.zoomToCursor = true;
controls.screenSpacePanning = true;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.rotateSpeed = 0.7;

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _sph = new THREE.Spherical();
let fly = null;

function flyTo(pos, target, ms = 650) {
  if (still || ms <= 0) { camera.position.copy(pos); controls.target.copy(target); fly = null; return; }
  fly = { t0: performance.now(), ms, p0: camera.position.clone(), p1: pos.clone(), q0: controls.target.clone(), q1: target.clone() };
}
function fit(animate = true) {
  const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
  const pos = S.center.clone().addScaledVector(dir, S.R * 2.3);
  flyTo(pos, S.center.clone(), animate ? 650 : 0);
}
function setScale() {                         // camera limits follow the size of the splat
  camera.near = S.R / 400; camera.far = S.R * 400; camera.updateProjectionMatrix();
  controls.minDistance = S.R / 1500; controls.maxDistance = S.R * 40;
}
function orbitBy(dTheta, dPhi) {
  _v.copy(camera.position).sub(controls.target); _sph.setFromVector3(_v);
  _sph.theta += dTheta; _sph.phi = THREE.MathUtils.clamp(_sph.phi + dPhi, 0.03, Math.PI - 0.03);
  _v.setFromSpherical(_sph); camera.position.copy(controls.target).add(_v);
}
function zoomBy(f) {
  _v.copy(camera.position).sub(controls.target);
  const len = THREE.MathUtils.clamp(_v.length() * f, controls.minDistance, controls.maxDistance);
  _v.setLength(len); camera.position.copy(controls.target).add(_v);
}
function slide(right, up, forward) {          // move camera and pivot together
  camera.getWorldDirection(_v); _v.y = 0;
  if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
  _v.normalize();
  _v2.crossVectors(_v, camera.up).normalize();
  const d = new THREE.Vector3().addScaledVector(_v2, right).addScaledVector(_v, forward); d.y += up;
  camera.position.add(d); controls.target.add(d);
}
const poseLocal = () => ({                    // camera pose in the splat's own coordinates, so it survives Flip
  position: world.worldToLocal(camera.position.clone()).toArray().map(r5),
  target: world.worldToLocal(controls.target.clone()).toArray().map(r5),
});
function goPose(p, ms) {
  if (!p) return false;
  flyTo(world.localToWorld(new THREE.Vector3().fromArray(p.position)), world.localToWorld(new THREE.Vector3().fromArray(p.target)), ms);
  return true;
}
const r5 = (n) => Math.round(n * 1e5) / 1e5;

/* ---------------------------------------------------------------- loading */
const busy = $("#busy"), busyText = $("#busytext"), busyBar = $("#busybar");
function setBusy(text, frac) {
  if (!text) { busy.hidden = true; return; }
  busy.hidden = false; busyText.textContent = text;
  busyBar.parentElement.classList.toggle("spin", frac == null);
  busyBar.style.width = frac == null ? "" : Math.round(frac * 100) + "%";
}
let toastTimer;
function toast(msg, ms = 3800) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
const baseName = (n) => n.replace(/\.[^.]+$/, "").replace(/\.annotated$/i, "");

async function openFiles(files) {
  files = Array.from(files || []);
  if (!files.length) return;
  if (S.draft && S.draft.dirty) { warnDraft(); return; }
  try {
    let doc = null, splat = null;
    for (const f of files) {
      if (/\.json$/i.test(f.name)) doc = JSON.parse(await f.text());
      else if (/\.zip$/i.test(f.name)) {
        const b = await readBundle(f);            // ours? (a .zip can also be a .sog-style splat)
        if (b) { splat = b.splat; doc = doc || b.doc; } else splat = splat || { blob: f, name: f.name };
      } else if (SPLAT_EXT.test(f.name)) splat = splat || { blob: f, name: f.name };
    }
    if (splat) await loadSplat(splat.blob, splat.name, { doc });
    else if (doc) {
      if (!S.mesh) { toast("Open the splat first, then drop its notes file."); return; }
      applyDoc(doc); persist(); toast(`Loaded ${S.notes.length} note${S.notes.length === 1 ? "" : "s"} from the file.`);
    } else toast("That file type is not a splat. Try .ply, .spz, .splat, .ksplat or .sog.");
  } catch (e) {
    console.error(e); setBusy(null);
    toast("Could not open that file: " + (e && e.message ? e.message : "unknown error"), 6000);
  }
}

async function loadSplat(blob, name, { doc = null, key = null, published = false } = {}) {
  setBusy("Reading file");
  const embedded = /\.ply$/i.test(name) ? await readPlyNotes(blob).catch(() => null) : null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  setBusy("Building splats");
  await new Promise((r) => setTimeout(r, 30));           // let the message paint
  const mesh = new SplatMesh({ fileBytes: bytes, fileName: name });
  await mesh.initialized;
  const count = (mesh.splats && mesh.splats.getNumSplats && mesh.splats.getNumSplats()) || (mesh.packedSplats && mesh.packedSplats.numSplats) || 0;
  if (!count) { mesh.dispose(); throw new Error("no splats found in the file"); }

  closeDraft();
  if (S.mesh) { world.remove(S.mesh); S.mesh.dispose(); }
  S.mesh = mesh; S.count = count; world.add(mesh);
  S.source = { blob, name };
  S.key = key || STORE + name + ":" + blob.size;
  S.published = published;
  S.notes = []; S.cam = null; S.flip = true; S.filter = null;

  let from = "";
  const stored = published ? null : readStore(S.key);
  if (doc) { applyDoc(doc, true); from = "the notes file"; }
  else if (stored) { applyDoc(stored, true); from = "this browser"; }
  else if (embedded) { applyDoc(embedded, true); from = "inside the splat file"; }

  world.rotation.set(S.flip ? Math.PI : 0, 0, 0); world.updateMatrixWorld(true);
  measure(); setScale();
  if (!goPose(S.cam, 0)) fit(false);
  controls.update();

  stage.classList.remove("empty");
  $("#file").textContent = `${name} · ${count.toLocaleString()} splats`;
  $("#export").disabled = false;
  setTool("nav"); refresh(); setBusy(null);
  if (doc || embedded) persist();
  if (S.notes.length) toast(`Restored ${S.notes.length} note${S.notes.length === 1 ? "" : "s"} from ${from}.`);
}

/* Size and middle of the splat, ignoring stray far-away splats (2nd to 98th percentile). */
function measure() {
  const n = S.count, step = Math.max(1, Math.ceil(n / 120000));
  const xs = [], ys = [], zs = [];
  world.updateMatrixWorld(true);
  S.mesh.forEachSplat((i, c) => {
    if (i % step) return;
    _v.copy(c).applyMatrix4(world.matrixWorld); xs.push(_v.x); ys.push(_v.y); zs.push(_v.z);
  });
  const band = (a) => { const s = Float32Array.from(a).sort(); return [s[Math.floor(s.length * 0.02)] || 0, s[Math.floor(s.length * 0.98)] || 0]; };
  if (!xs.length) { S.center.set(0, 0, 0); S.R = 1; return; }
  const [x0, x1] = band(xs), [y0, y1] = band(ys), [z0, z1] = band(zs);
  S.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  S.R = Math.max(1e-4, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
}

/* A splat and notes published on a website: ?splat=<url>&notes=<url> */
async function loadFromUrl() {
  const q = new URLSearchParams(location.search), u = q.get("splat"), nu = q.get("notes");
  if (!u) return;
  try {
    setBusy("Downloading splat", 0);
    const res = await fetch(u);
    if (!res.ok) throw new Error("download failed (" + res.status + ")");
    const total = +res.headers.get("content-length") || 0, parts = []; let got = 0;
    const rd = res.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; setBusy("Downloading splat", total ? got / total : null); }
    let doc = null;
    if (nu) { const r = await fetch(nu); if (r.ok) doc = await r.json(); }
    const name = decodeURIComponent(new URL(u, location.href).pathname.split("/").pop() || "splat.ply");
    await loadSplat(new Blob(parts), name, { doc, key: STORE + "url:" + u, published: !!nu });
  } catch (e) { console.error(e); setBusy(null); toast("Could not load the linked splat: " + e.message, 7000); }
}

/* ------------------------------------------------------------------ notes */
function cleanDoc(d) {
  if (!d || !Array.isArray(d.notes)) throw new Error("this is not a notes file");
  const ok = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
  const pose = (p) => (p && ok(p.position) && ok(p.target) ? { position: p.position.map(r5), target: p.target.map(r5) } : null);
  const notes = [];
  for (const n of d.notes.slice(0, 2000)) {
    if (!n || !ok(n.position)) continue;
    notes.push({
      id: "n" + Math.random().toString(36).slice(2, 10),
      title: String(n.title || "").slice(0, 80), text: String(n.text || "").slice(0, 5000),
      color: /^#[0-9a-f]{6}$/i.test(n.color) ? n.color.toLowerCase() : COLORS[0][0],
      position: n.position.map(r5), view: pose(n.view),
    });
  }
  return { notes, flip: d.flip !== false, cam: pose(d.camera) };
}
function applyDoc(d, quiet) {
  const c = cleanDoc(d);
  S.notes = c.notes;
  if (quiet) { S.flip = c.flip; S.cam = c.cam; }       // on first load also take orientation and camera
  if (!quiet) refresh();
}
function makeDoc() {
  return {
    app: APP_ID, version: 1, exported: new Date().toISOString(),
    splat: S.source ? { name: S.source.name, bytes: S.source.blob.size, splats: S.count } : null,
    coordinates: "Note positions and camera views use the splat file's own coordinates.",
    flip: S.flip, camera: S.cam || poseLocal(),
    notes: S.notes.map(({ title, color, text, position, view }) => ({ title, color, text, position, view })),
  };
}
function readStore(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (_) { return null; } }
let storeOk = true;
function persist() {
  if (!S.mesh) return;
  S.cam = poseLocal();
  if (S.published) return;
  try { localStorage.setItem(S.key, JSON.stringify(makeDoc())); storeOk = true; } catch (_) { storeOk = false; }
  showSaved();
}
function showSaved() {
  const el = $("#saved");
  el.textContent = !S.mesh ? "" : S.published ? "Export to keep changes" : storeOk ? "Saved in this browser" : "Could not save here: use Export";
  el.classList.toggle("hot", S.published || !storeOk);
}

/* ------------------------------------------------------------------- orbs */
/* Each note is a little pixel orb (a sprite that always faces the camera and is drawn on
   top of the splat) plus a number badge and title in HTML that follows it. */
const texCache = new Map();
function orbTexture(color, kind = "orb") {
  const k = kind + color; if (texCache.has(k)) return texCache.get(k);
  const N = kind === "ring" ? 24 : 16, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"), mid = (N - 1) / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - mid, y - mid); let f = null;
    if (kind === "ring") { if (d > 9.6 && d <= 11.2) f = (Math.round(Math.atan2(y - mid, x - mid) / (Math.PI / 6)) & 1) ? "#f2f5ee" : "#000"; }
    else if (d <= 5.9) f = color; else if (d <= 7.1) f = "#f2f5ee"; else if (d <= 8.1) f = "#000";
    if (f) { g.fillStyle = f; g.fillRect(x, y, 1, 1); }
  }
  if (kind === "orb") { g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(5, 4, 2, 1); g.fillRect(4, 5, 1, 2); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(9, 11, 2, 1); g.fillRect(11, 9, 1, 2); }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t); return t;
}
function makeSprite(tex, order) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
  s.renderOrder = order; return s;
}
const orbs = new Map();                       // id -> { sprite, el, nEl, tEl, item, screen }
const ring = makeSprite(orbTexture("", "ring"), 1001); ring.visible = false; world.add(ring);
const ghost = makeSprite(orbTexture(COLORS[0][0]), 1002); ghost.material.opacity = 0.6; ghost.visible = false; world.add(ghost);

function items() {                            // what should be on screen: saved notes, with the one being edited overlaid
  const out = S.notes.map((n, i) => ({ id: n.id, n: i + 1, title: n.title, color: n.color, position: n.position, draft: false }));
  const d = S.draft;
  if (d) {
    const it = { id: d.id, title: d.title, color: d.color, position: d.position, draft: true, sel: true };
    const i = out.findIndex((o) => o.id === d.id);
    if (i >= 0) out[i] = { ...it, n: i + 1, draft: d.dirty }; else out.push({ ...it, n: out.length + 1 });
  }
  return out;
}
function syncOrbs() {
  const list = items(), seen = new Set();
  for (const it of list) {
    seen.add(it.id);
    let o = orbs.get(it.id);
    if (!o) {
      const el = document.createElement("div"); el.className = "tag";
      const nEl = document.createElement("span"); nEl.className = "n";
      const tEl = document.createElement("span"); tEl.className = "t";
      el.append(nEl, tEl); tagsEl.append(el);
      o = { sprite: makeSprite(orbTexture(it.color), 1000), el, nEl, tEl, screen: { x: 0, y: 0, r: 0, on: false } };
      world.add(o.sprite); orbs.set(it.id, o);
    }
    o.item = it;
    o.sprite.material.map = orbTexture(it.color);
    o.sprite.position.fromArray(it.position);
    const off = !!S.filter && S.filter !== it.color && !it.sel;
    o.sprite.material.opacity = off ? 0.3 : 1;
    o.nEl.textContent = it.n; o.tEl.textContent = it.title;
    o.el.style.setProperty("--c", it.color);
    o.el.classList.toggle("sel", !!it.sel); o.el.classList.toggle("draft", !!it.draft); o.el.classList.toggle("off", off);
  }
  for (const [id, o] of orbs) if (!seen.has(id)) { world.remove(o.sprite); o.sprite.material.dispose(); o.el.remove(); orbs.delete(id); }
  ring.visible = !!S.draft;
  if (S.draft) ring.position.fromArray(S.draft.position);
}
let hoverId = null;
function placeOrbs(time) {                    // every frame: size the sprites and move the HTML badges
  const W = stage.clientWidth, H = stage.clientHeight, k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / H;
  const size = (pos, mul = 1) => {
    _v.copy(pos).applyMatrix4(world.matrixWorld);
    const dist = _v.distanceTo(camera.position), wpp = Math.max(dist * k, 1e-9);
    const rpx = THREE.MathUtils.clamp((S.R * 0.014) / wpp, 10, 22) * mul;
    return { rpx, w: 2 * rpx * wpp };
  };
  for (const [id, o] of orbs) {
    const { rpx, w } = size(o.sprite.position); o.sprite.scale.set(w, w, 1);
    _v2.copy(_v).applyMatrix4(camera.matrixWorldInverse); const front = _v2.z < 0;
    _v.project(camera);
    const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
    const on = front && x > -40 && x < W + 40 && y > -40 && y < H + 40;
    o.screen = { x, y, r: rpx, on };
    o.el.style.display = on ? "" : "none";
    if (on) o.el.style.transform = `translate(${Math.round(x + rpx * 0.8)}px,${Math.round(y - rpx - 16)}px)`;
    o.el.classList.toggle("hover", id === hoverId);
  }
  if (ring.visible) { const { w } = size(ring.position, 1.75 + 0.12 * Math.sin(time / 180)); ring.scale.set(w, w, 1); }
  if (ghost.visible) { const { w } = size(ghost.position); ghost.scale.set(w, w, 1); }
}
function orbAt(x, y, slack = 6) {
  let best = null, bd = Infinity;
  for (const [id, o] of orbs) {
    if (!o.screen.on) continue;
    const d = Math.hypot(o.screen.x - x, o.screen.y - y);
    if (d <= o.screen.r + slack && d < bd) { bd = d; best = id; }
  }
  return best;
}

/* ---------------------------------------------------------------- picking */
/* Shoot a ray from the pointer into the splat. A lone see-through "floater" in front of a
   surface should not catch the orb, so take the first hit that has another close behind it. */
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pickCost = 0;
function pick(x, y) {
  if (!S.mesh) return null;
  const t0 = performance.now();
  let hits = [];
  for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {   // if the ray slips between splats, try a hair to the side
    ndc.set(((x + dx) / stage.clientWidth) * 2 - 1, -((y + dy) / stage.clientHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    hits = raycaster.intersectObject(S.mesh, false);
    if (hits.length) break;
  }
  pickCost = performance.now() - t0;
  if (!hits.length) return null;
  let h = hits[0];
  for (let i = 0; i < hits.length - 1 && i < 400; i++) {
    const win = Math.max(S.R * 0.012, hits[i].distance * 0.015);
    if (hits[i + 1].distance - hits[i].distance <= win) { h = hits[i]; break; }
  }
  return world.worldToLocal(h.point.clone()).toArray().map(r5);
}
const xy = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

/* ---------------------------------------------------------- pointer input */
const ptrs = new Map(); let down = null, dragging = false, wantDrag = null, wantGhost = null, ghostOn = true, slowPicks = 0;
// "capture" so these run before the camera controls' own listeners on the same canvas
canvas.addEventListener("pointerdown", (e) => {
  ptrs.set(e.pointerId, 1);
  if (ptrs.size > 1 || (e.pointerType === "mouse" && e.button !== 0) || e.shiftKey || e.ctrlKey || e.metaKey) { down = null; return; }
  const [x, y] = xy(e), hit = orbAt(x, y, e.pointerType === "touch" ? 12 : 6);
  down = { x, y, hit, id: e.pointerId };
  fly = null;
  if (hit && S.draft && hit === S.draft.id) {                 // grab the selected orb to move it
    dragging = true; controls.enabled = false; stage.classList.add("dragging");
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
}, true);
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = xy(e);
  if (dragging) { wantDrag = [x, y]; return; }
  if (e.pointerType !== "mouse" || ptrs.size) { hoverId = null; return; }
  hoverId = orbAt(x, y);
  stage.classList.toggle("over-orb", !!hoverId);
  stage.classList.toggle("over-sel", !!hoverId && !!S.draft && hoverId === S.draft.id);
  wantGhost = !hoverId && ghostOn && (S.tool === "add" || (S.tool === "move" && S.draft)) ? [x, y] : null;
  if (!wantGhost) ghost.visible = false;
}, true);
function endPointer(e) {
  ptrs.delete(e.pointerId);
  if (dragging) {
    dragging = false; wantDrag = null; controls.enabled = true; stage.classList.remove("dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    down = null; return;
  }
  if (!down || down.id !== e.pointerId || e.type === "pointercancel") { down = null; return; }
  const [x, y] = xy(e), far = Math.hypot(x - down.x, y - down.y) > (e.pointerType === "touch" ? 10 : 5);
  const d = down; down = null;
  if (far) return;                                           // that was a camera drag, not a click
  click(x, y, d.hit);
}
canvas.addEventListener("pointerup", endPointer, true);
canvas.addEventListener("pointercancel", endPointer, true);
canvas.addEventListener("pointerleave", () => { hoverId = null; wantGhost = null; ghost.visible = false; stage.classList.remove("over-orb", "over-sel"); });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("dblclick", (e) => {                  // double-click: orbit around that point
  if (S.tool !== "nav") return;
  const [x, y] = xy(e); if (orbAt(x, y)) return;
  const p = pick(x, y); if (!p) return;
  const t = world.localToWorld(new THREE.Vector3().fromArray(p));
  flyTo(camera.position.clone().add(t.clone().sub(controls.target)).lerp(t, 0.35), t, 500);
});

function click(x, y, hit) {
  if (hit) { if (!S.draft || hit !== S.draft.id) select(hit, false); return; }
  if (S.tool === "nav") return;
  if (S.tool === "add" && S.draft && S.draft.dirty && !S.draft.isNew) { warnDraft(); return; }
  const p = pick(x, y);
  if (!p) { toast("Nothing under that point. Click on the splat itself."); return; }
  if (S.tool === "move" && S.draft) { moveDraft(p); return; }
  if (S.tool === "add") {
    if (S.draft && S.draft.isNew) { moveDraft(p); return; }     // still placing: click again to reposition
    newDraft(p);
  }
}

/* ------------------------------------------------------------------ panel */
const ed = $("#editor"), fTitle = $("#f-title"), fText = $("#f-text"), fColors = $("#f-colors");
COLORS.forEach(([c, name], i) => {
  const l = document.createElement("label"); l.style.setProperty("--c", c); l.title = name;
  const r = document.createElement("input"); r.type = "radio"; r.name = "color"; r.value = c; r.setAttribute("aria-label", name);
  l.append(r); fColors.append(l);
  r.addEventListener("change", () => { if (S.draft) { S.draft.color = c; S.lastColor = c; touch(); } });
});
function fillFilters() {
  const f = $("#filters"); f.textContent = "";
  const used = COLORS.filter(([c]) => S.notes.some((n) => n.color === c));
  f.hidden = used.length < 2; if (f.hidden) { S.filter = null; return; }
  const mk = (c, label) => {
    const b = document.createElement("button"); b.type = "button";
    if (c) { b.style.setProperty("--c", c); b.title = "Show only " + label; b.setAttribute("aria-label", "Show only " + label); } else { b.className = "any"; b.textContent = "All"; }
    b.setAttribute("aria-pressed", String(S.filter === c));
    b.addEventListener("click", () => { S.filter = c; refresh(); });
    f.append(b);
  };
  mk(null, "All"); used.forEach(([c, n]) => mk(c, n));
}
function fillList() {
  const ol = $("#list"); ol.textContent = "";
  S.notes.forEach((n, i) => {
    if (S.filter && n.color !== S.filter) return;
    const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
    const num = document.createElement("span"); num.className = "n"; num.textContent = i + 1; num.style.setProperty("--c", n.color);
    const t = document.createElement("span"); t.className = "t"; t.textContent = n.title || "Untitled note";
    const x = document.createElement("span"); x.className = "x"; x.textContent = n.text.split("\n")[0];
    b.append(num, t, x); li.append(b); ol.append(li);
    li.classList.toggle("sel", !!S.draft && S.draft.id === n.id);
    b.addEventListener("click", () => select(n.id, true));
  });
  $("#count").textContent = S.notes.length ? `(${S.notes.length})` : "";
  $("#empty").hidden = S.notes.length > 0;
  $("#empty").textContent = S.mesh ? "No notes yet. Choose Add, then click a point on the splat." : "Open a splat to start pinning notes to it.";
}
function fillEditor() {
  const d = S.draft; ed.hidden = !d;
  $('[data-tool="move"]').disabled = !d;
  if (!d) return;
  const i = S.notes.findIndex((n) => n.id === d.id);
  $("#edhead").textContent = d.isNew ? "New note" : "Note " + (i + 1);
  if (fTitle.value !== d.title) fTitle.value = d.title;
  if (fText.value !== d.text) fText.value = d.text;
  $$("input", fColors).forEach((r) => (r.checked = r.value === d.color));
  const st = $("#edstate"); st.textContent = d.isNew ? "Not saved yet" : d.dirty ? "Unsaved changes" : "Saved"; st.classList.toggle("hot", d.isNew || d.dirty);
  $("#f-move").setAttribute("aria-pressed", String(S.tool === "move"));
  $("#f-del").hidden = d.isNew; $("#f-cancel").textContent = d.isNew ? "Discard" : d.dirty ? "Cancel" : "Close";
  if (!d.dirty) $("#edwarn").hidden = true;
}
function hint() {
  const d = S.draft, h =
    S.tool === "add" ? (d && d.isNew ? "Click another point to reposition, then Save note." : "Click a point on the splat to place a note.") :
    S.tool === "move" && d ? "Click a new point for this note, or drag its orb." :
    !S.notes.length && !d ? "Drag to look around. Choose Add to pin a note." : "";
  $("#hint").textContent = h;
}
function refresh() { fillFilters(); syncOrbs(); fillList(); fillEditor(); hint(); showSaved(); }
function touch() { if (S.draft) { S.draft.dirty = true; syncOrbs(); fillEditor(); hint(); } }
function warnDraft() {
  const w = $("#edwarn"); w.hidden = false; ed.classList.remove("shake"); void ed.offsetWidth; ed.classList.add("shake");
  ed.scrollIntoView({ block: "nearest" });
}
let delTimer;
function resetDelete() { clearTimeout(delTimer); const b = $("#f-del"); b.classList.remove("sure"); b.textContent = "Delete"; }

function setTool(t) {
  if (t === "move" && !S.draft) t = "nav";
  S.tool = t;
  $$("#tools [data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  stage.classList.toggle("t-add", t === "add"); stage.classList.toggle("t-move", t === "move");
  ghost.visible = false; fillEditor(); hint();
}
function newDraft(position) {
  S.draft = { id: "n" + Math.random().toString(36).slice(2, 10), isNew: true, dirty: true, title: "", text: "", color: S.lastColor, position };
  resetDelete(); refresh();
  if (matchMedia("(min-width:761px)").matches) fTitle.focus();
}
function moveDraft(position) { S.draft.position = position; touch(); }
function select(id, travel) {
  if (S.draft && S.draft.id === id) { if (travel) goNote(id); return true; }
  if (S.draft && S.draft.dirty) { warnDraft(); return false; }
  const n = S.notes.find((o) => o.id === id); if (!n) return false;
  S.draft = { id: n.id, isNew: false, dirty: false, title: n.title, text: n.text, color: n.color, position: n.position.slice() };
  if (S.tool === "move") S.tool = "nav";
  resetDelete(); setTool(S.tool); refresh();
  if (travel) goNote(id);
  return true;
}
function goNote(id) {
  const n = S.notes.find((o) => o.id === id); if (!n) return;
  if (goPose(n.view)) return;
  const t = world.localToWorld(new THREE.Vector3().fromArray(n.position));
  const off = camera.position.clone().sub(controls.target); off.setLength(Math.min(off.length(), S.R * 0.9));
  flyTo(t.clone().add(off), t);
}
function closeDraft() { S.draft = null; if (S.tool === "move") S.tool = "nav"; }
function saveDraft() {
  const d = S.draft; if (!d) return;
  const note = { id: d.id, title: fTitle.value.trim().slice(0, 80), text: fText.value.trim(), color: d.color, position: d.position.slice(), view: poseLocal() };
  const i = S.notes.findIndex((n) => n.id === d.id);
  if (i >= 0) S.notes[i] = note; else S.notes.push(note);
  S.draft = { ...note, position: note.position.slice(), isNew: false, dirty: false };
  if (S.tool === "move") S.tool = "nav";
  setTool(S.tool); persist(); refresh(); toast("Note saved.", 1600);
}
function cancelDraft() { if (!S.draft) return; closeDraft(); setTool(S.tool); refresh(); }
function deleteDraft() {
  const b = $("#f-del"), d = S.draft; if (!d) return;
  if (!b.classList.contains("sure")) { b.classList.add("sure"); b.textContent = "Sure?"; clearTimeout(delTimer); delTimer = setTimeout(resetDelete, 6000); return; }
  S.notes = S.notes.filter((n) => n.id !== d.id); closeDraft(); setTool(S.tool); persist(); refresh(); toast("Note deleted.", 1600);
}
function nudge(sign) {                        // slide the orb along the line of sight
  const d = S.draft; if (!d) return;
  const w = world.localToWorld(new THREE.Vector3().fromArray(d.position));
  const dir = w.clone().sub(camera.position).normalize();
  w.addScaledVector(dir, sign * S.R * 0.01);
  moveDraft(world.worldToLocal(w).toArray().map(r5));
}

fTitle.addEventListener("input", () => { if (S.draft) { S.draft.title = fTitle.value; touch(); } });
fText.addEventListener("input", () => { if (S.draft) { S.draft.text = fText.value; touch(); } });
ed.addEventListener("submit", (e) => { e.preventDefault(); saveDraft(); });
$("#f-cancel").addEventListener("click", cancelDraft);
$("#f-del").addEventListener("click", deleteDraft);
$("#f-move").addEventListener("click", () => setTool(S.tool === "move" ? "nav" : "move"));
$("#f-near").addEventListener("click", () => nudge(-1));
$("#f-far").addEventListener("click", () => nudge(1));

/* Toolbar, camera pad, keyboard */
const ICONS = {
  look: ["X..........", "XX.........", "XXX........", "XXXX.......", "XXXXX......", "XXXXXX.....", "XXXXXXX....", "XXXX.......", "X..XX......", "....XX.....", ".....X....."],
  add: ["...XXXXX...", "..X.....X..", ".X...X...X.", "X....X....X", "X....X....X", "X.XXXXXXX.X", "X....X....X", "X....X....X", ".X...X...X.", "..X.....X..", "...XXXXX..."],
  move: [".....X.....", "....XXX....", "...X.X.X...", ".....X.....", "..X..X..X..", "XXXXXXXXXXX", "..X..X..X..", ".....X.....", "...X.X.X...", "....XXX....", ".....X....."],
  frame: ["XXX.....XXX", "X.........X", "X.........X", "...........", "....XXX....", "....XXX....", "....XXX....", "...........", "X.........X", "X.........X", "XXX.....XXX"],
  flip: ["..X........", ".XXX....X..", "X.X.X...X..", "..X.....X..", "..X.....X..", "..X.....X..", "..X.....X..", "..X.....X..", "..X...X.X.X", "..X....XXX.", "........X.."],
  label: ["...........", "XXXXXXXX...", "X.......X..", "X.XXXXX..X.", "X.........X", "X.XXXXX..X.", "X.......X..", "XXXXXXXX...", "...........", "...........", "..........."],
};
$$("[data-ico]").forEach((i) => {
  const rows = ICONS[i.dataset.ico]; let d = "";
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === "X") d += `M${x} ${y}h1v1h-1z`; });
  i.outerHTML = `<svg viewBox="0 0 11 11" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;
});
function act(a) {
  if (!S.mesh) return;
  if (a === "frame") fit();
  if (a === "flip") {
    S.flip = !S.flip; world.rotation.set(S.flip ? Math.PI : 0, 0, 0); world.updateMatrixWorld(true);
    measure(); setScale(); fit(false); persist();
  }
  if (a === "labels") { S.labels = !S.labels; tagsEl.classList.toggle("all", S.labels); $('[data-act="labels"]').setAttribute("aria-pressed", String(S.labels)); }
}
$$("#tools [data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
$$("#tools [data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));

const held = new Set();
$$("#pad [data-hold]").forEach((b) => {
  const on = (e) => { e.preventDefault(); held.add(b.dataset.hold); b.classList.add("held"); fly = null; try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { held.delete(b.dataset.hold); b.classList.remove("held"); };
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
  b.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); held.add(b.dataset.hold); } });
  b.addEventListener("keyup", off); b.addEventListener("blur", off);
});
const keys = new Set();
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !!document.querySelector("dialog[open]");
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
    if (S.tool !== "nav" && !(S.draft && S.draft.isNew)) setTool("nav"); else if (S.draft) cancelDraft(); else setTool("nav");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return;
  }
  if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || !S.mesh) return;
  const k = e.key.toLowerCase();
  if ("wasdqe".includes(k) && k.length === 1 || k.startsWith("arrow") || k === "shift") { keys.add(k); fly = null; if (k.startsWith("arrow")) e.preventDefault(); return; }
  if (k === "1") setTool("nav"); else if (k === "2") setTool("add"); else if (k === "3") setTool("move");
  else if (k === "f") act("frame"); else if (k === "u") act("flip"); else if (k === "l") act("labels");
  else if (k === "?") $("#dlg-help").showModal();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => { keys.clear(); held.clear(); });
function drive(dt) {
  if (!S.mesh || (!keys.size && !held.size)) return;
  const sp = S.R * (keys.has("shift") ? 2.2 : 0.75) * dt, rot = 1.3 * dt, has = (a, b) => keys.has(a) || held.has(b);
  let r = 0, u = 0, f = 0;
  if (keys.has("d")) r += sp; if (keys.has("a")) r -= sp;
  if (keys.has("w")) f += sp; if (keys.has("s")) f -= sp;
  if (has("e", "up")) u += sp; if (has("q", "down")) u -= sp;
  if (r || u || f) slide(r, u, f);
  if (has("arrowleft", "rotl")) orbitBy(-rot, 0); if (has("arrowright", "rotr")) orbitBy(rot, 0);
  if (keys.has("arrowup")) orbitBy(0, -rot); if (keys.has("arrowdown")) orbitBy(0, rot);
  if (held.has("in")) zoomBy(Math.pow(0.35, dt)); if (held.has("out")) zoomBy(Math.pow(1 / 0.35, dt));
}

/* Opening files: button, file picker, drag and drop anywhere on the page */
$("#open").addEventListener("click", () => $("#pick").click());
$("#choose").addEventListener("click", () => $("#pick").click());
$("#pick").addEventListener("change", (e) => { openFiles(e.target.files); e.target.value = ""; });
$("#help").addEventListener("click", () => $("#dlg-help").showModal());
let dragDepth = 0;
addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; stage.classList.add("dragover"); });
addEventListener("dragover", (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; stage.classList.remove("dragover"); } });
addEventListener("drop", (e) => { e.preventDefault(); dragDepth = 0; stage.classList.remove("dragover"); if (e.dataTransfer) openFiles(e.dataTransfer.files); });

/* ----------------------------------------------------------------- export */
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const latin1 = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
const b64 = (s) => { const u = new TextEncoder().encode(s); let b = ""; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/* Notes inside a .ply: the PLY format allows free "comment" lines in its text header, which
   other software skips. The notes go there, so the file stays a normal splat. */
async function plyHeader(blob) {
  for (const size of [1 << 16, 1 << 20, 1 << 24]) {
    const u = new Uint8Array(await blob.slice(0, size).arrayBuffer());
    let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    const m = /(^|\n)end_header\r?\n/.exec(s);
    if (m) return { text: s.slice(0, m.index + m[1].length), tail: m[0].slice(m[1].length), dataStart: m.index + m[0].length };
    if (u.length < size) break;
  }
  throw new Error("this .ply has no readable header");
}
async function readPlyNotes(blob) {
  const h = await plyHeader(blob);
  const parts = h.text.split(/\r?\n/).filter((l) => l.startsWith(PLY_TAG)).map((l) => l.slice(PLY_TAG.length).split(" ")).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  return parts.length ? JSON.parse(unb64(parts.map((p) => p[1]).join(""))) : null;
}
async function annotatedPly() {
  const h = await plyHeader(S.source.blob), nl = /\r\n/.test(h.text) ? "\r\n" : "\n";
  const keep = h.text.split(/\r?\n/).filter((l) => l && !l.startsWith(PLY_TAG));
  const data = b64(JSON.stringify(makeDoc())), chunks = data.match(/.{1,160}/g) || [];
  const lines = chunks.map((c, i) => `${PLY_TAG}${i + 1}/${chunks.length} ${c}`);
  return new Blob([latin1(keep.concat(lines).join(nl) + nl + h.tail), S.source.blob.slice(h.dataStart)], { type: "application/octet-stream" });
}

/* Bundle: an ordinary .zip (stored, not compressed) with the splat and notes.json in it. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
async function crc32(blob, onProgress) {
  let c = 0xffffffff, done = 0; const rd = blob.stream().getReader();
  for (;;) { const { done: end, value } = await rd.read(); if (end) break; for (let i = 0; i < value.length; i++) c = CRC[(c ^ value[i]) & 255] ^ (c >>> 8); done += value.length; if (onProgress) onProgress(done / blob.size); }
  return (c ^ 0xffffffff) >>> 0;
}
async function makeZip(entries, onProgress) {
  const parts = [], central = []; let offset = 0;
  for (const e of entries) {
    if (e.blob.size > 0xfffffff0) throw new Error("the splat is too large to bundle (over 4 GB)");
    const name = new TextEncoder().encode(e.name), crc = await crc32(e.blob, e.blob.size > 1e7 ? onProgress : null);
    const head = (sig, extra) => {
      const b = new DataView(new ArrayBuffer(extra ? 46 : 30)); let p = 0;
      const u16 = (v) => { b.setUint16(p, v, true); p += 2; }, u32 = (v) => { b.setUint32(p, v, true); p += 4; };
      u32(sig); if (extra) u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(0x21); u32(crc); u32(e.blob.size); u32(e.blob.size); u16(name.length); u16(0);
      if (extra) { u16(0); u16(0); u16(0); u32(0); u32(offset); }
      return new Uint8Array(b.buffer);
    };
    central.push(head(0x02014b50, true), name);
    parts.push(head(0x04034b50, false), name, e.blob);
    offset += 30 + name.length + e.blob.size;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
async function readBundle(file) {              // returns { splat:{blob,name}, doc } if the zip is one of ours, else null
  const tailLen = Math.min(file.size, 66000), tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let p = -1; for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { p = i; break; }
  if (p < 0) return null;
  const n = tail.getUint16(p + 10, true), cdSize = tail.getUint32(p + 12, true), cdOff = tail.getUint32(p + 16, true);
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), items = []; let q = 0;
  for (let i = 0; i < n && q + 46 <= cd.byteLength; i++) {
    if (cd.getUint32(q, true) !== 0x02014b50) break;
    const method = cd.getUint16(q + 10, true), csize = cd.getUint32(q + 20, true), nl = cd.getUint16(q + 28, true), xl = cd.getUint16(q + 30, true), cl = cd.getUint16(q + 32, true), lho = cd.getUint32(q + 42, true);
    items.push({ name: new TextDecoder().decode(new Uint8Array(cd.buffer, q + 46, nl)), method, csize, lho });
    q += 46 + nl + xl + cl;
  }
  const get = async (it) => {
    const lh = new DataView(await file.slice(it.lho, it.lho + 30).arrayBuffer()), start = it.lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = file.slice(start, start + it.csize);
    if (it.method === 0) return raw;
    if (it.method === 8) return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    throw new Error("unsupported compression in the bundle");
  };
  const notes = items.find((i) => i.name === NOTES_ENTRY), splat = items.find((i) => i.name !== NOTES_ENTRY && SPLAT_EXT.test(i.name) && !i.name.includes("/"));
  if (!notes || !splat) return null;
  return { doc: JSON.parse(await (await get(notes)).text()), splat: { blob: await get(splat), name: splat.name } };
}

const dlgEx = $("#dlg-export"), exMsg = $("#exmsg");
$("#export").addEventListener("click", () => {
  const isPly = !!S.source && /\.ply$/i.test(S.source.name), b = $('[data-export="ply"]');
  b.disabled = !isPly; b.title = isPly ? "" : "Only for splats opened as .ply. Use the bundle instead.";
  exMsg.textContent = S.draft && S.draft.dirty ? "The note you are still editing is left out until you save it." : `${S.notes.length} note${S.notes.length === 1 ? "" : "s"} will be exported.`;
  dlgEx.showModal();
});
$$("[data-export]").forEach((b) => b.addEventListener("click", async () => {
  if (!S.source) return;
  const base = baseName(S.source.name), kind = b.dataset.export;
  try {
    S.cam = poseLocal();
    const json = new Blob([JSON.stringify(makeDoc(), null, 1)], { type: "application/json" });
    if (kind === "json") download(json, base + ".notes.json");
    if (kind === "ply") { exMsg.textContent = "Writing the file"; download(await annotatedPly(), base + ".annotated.ply"); }
    if (kind === "zip") {
      const zip = await makeZip([{ name: S.source.name.replace(/^.*[\\/]/, ""), blob: S.source.blob }, { name: NOTES_ENTRY, blob: json }], (f) => (exMsg.textContent = `Packing ${Math.round(f * 100)}%`));
      download(zip, base + ".annotated.zip");
    }
    exMsg.textContent = "Done. Check your downloads.";
  } catch (e) { console.error(e); exMsg.textContent = "Export failed: " + e.message; }
}));

/* ------------------------------------------------------------- frame loop */
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}).observe(stage);

let last = performance.now();
renderer.setAnimationLoop((time) => {
  const dt = Math.min(0.1, (time - last) / 1000); last = time;
  drive(dt);
  if (fly) {
    let t = Math.min(1, (time - fly.t0) / fly.ms); const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.q0, fly.q1, k);
    if (t >= 1) fly = null;
  }
  controls.update();
  camera.updateMatrixWorld();
  if (wantDrag && S.draft) { const p = pick(wantDrag[0], wantDrag[1]); wantDrag = null; if (p) moveDraft(p); }
  if (wantGhost) {
    const p = pick(wantGhost[0], wantGhost[1]); wantGhost = null;
    ghost.visible = !!p; if (p) { ghost.position.fromArray(p); ghost.material.map = orbTexture(S.draft ? S.draft.color : S.lastColor); }
    slowPicks = pickCost > 45 ? slowPicks + 1 : 0;              // huge splat: stop previewing under the pointer
    if (slowPicks > 4) { ghostOn = false; ghost.visible = false; }
  }
  placeOrbs(time);
  renderer.render(scene, camera);
});

refresh();
loadFromUrl();
window.__splat = { S, pick, orbs, camera, controls };   // handy in the browser console
