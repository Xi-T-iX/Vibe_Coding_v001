import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

const app = document.querySelector('#app');

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9eef7');

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  600
);
camera.position.set(20, 24, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 12, 0);

// Lights and helpers
scene.add(new THREE.HemisphereLight(0xbde3ff, 0x243b4a, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(30, 40, 20);
scene.add(dir);

const worldGrid = new THREE.GridHelper(200, 100, 0x94a3b8, 0xcbd5e1);
scene.add(worldGrid);
const axes = new THREE.AxesHelper(5);
axes.visible = false;
scene.add(axes);

const stats = new Stats();
stats.showPanel(0);
stats.dom.classList.add('stats');
app.appendChild(stats.dom);

// Graph Mapper UI (0-1 input/output)
const graphPanel = document.createElement('div');
graphPanel.className = 'graph-panel';
graphPanel.innerHTML = `
  <div class="graph-header">
    <span>Graph Mapper</span>
    <span class="graph-meta">0 : 1</span>
  </div>
  <canvas class="graph-canvas" width="260" height="260"></canvas>
  <div class="graph-help">Drag points to remap the tower profile (0-1 input/output). Click to add points.</div>
`;
app.appendChild(graphPanel);

const graphCanvas = graphPanel.querySelector('canvas');
const gctx = graphCanvas.getContext('2d');
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const graphState = {
  points: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.05 },
    { x: 0.75, y: 0.65 },
    { x: 1, y: 1 },
  ],
  dragging: -1,
};

const catmull = (p0, p1, p2, p3, t) => {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
};

const graphEvaluate = (t) => {
  const pts = graphState.points.slice().sort((a, b) => a.x - b.x);
  if (pts.length < 2) return clamp01(t);
  const clampedT = clamp01(t);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (clampedT >= a.x && clampedT <= b.x) {
      const lt = (clampedT - a.x) / Math.max(1e-6, b.x - a.x);
      const p0 = pts[Math.max(0, i - 1)];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const y = catmull(p0.y, a.y, b.y, p3.y, lt);
      return clamp01(y);
    }
  }
  return clamp01(pts[pts.length - 1].y);
};

const drawGraph = () => {
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  gctx.clearRect(0, 0, w, h);
  // grid
  gctx.strokeStyle = '#e2e8f0';
  gctx.lineWidth = 1;
  const step = w / 10;
  for (let i = 0; i <= 10; i += 1) {
    const x = i * step;
    gctx.beginPath();
    gctx.moveTo(x, 0);
    gctx.lineTo(x, h);
    gctx.stroke();
    const y = i * step;
    gctx.beginPath();
    gctx.moveTo(0, y);
    gctx.lineTo(w, y);
    gctx.stroke();
  }
  // curve
  gctx.strokeStyle = '#111827';
  gctx.lineWidth = 2;
  gctx.beginPath();
  const samples = 80;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const y = graphEvaluate(t);
    const px = t * w;
    const py = h - y * h;
    if (i === 0) gctx.moveTo(px, py);
    else gctx.lineTo(px, py);
  }
  gctx.stroke();
  // points
  const pts = graphState.points.slice().sort((a, b) => a.x - b.x);
  pts.forEach((p, idx) => {
    const px = p.x * w;
    const py = h - p.y * h;
    gctx.fillStyle = idx === graphState.dragging ? '#0ea5e9' : '#111827';
    gctx.beginPath();
    gctx.arc(px, py, 6, 0, Math.PI * 2);
    gctx.fill();
    gctx.strokeStyle = '#f8fafc';
    gctx.lineWidth = 2;
    gctx.beginPath();
    gctx.arc(px, py, 6, 0, Math.PI * 2);
    gctx.stroke();
  });
};

const getCanvasPos = (evt) => {
  const rect = graphCanvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) / rect.width;
  const y = 1 - (evt.clientY - rect.top) / rect.height;
  return { x: clamp01(x), y: clamp01(y) };
};

graphCanvas.addEventListener('pointerdown', (evt) => {
  const { x, y } = getCanvasPos(evt);
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  const hit = graphState.points.findIndex((p) => Math.hypot(p.x * w - x * w, p.y * h - y * h) < 12);
  if (hit >= 0) {
    graphState.dragging = hit;
  } else {
    graphState.points.push({ x, y });
    graphState.dragging = graphState.points.length - 1;
  }
  graphCanvas.setPointerCapture(evt.pointerId);
  drawGraph();
});

graphCanvas.addEventListener('pointermove', (evt) => {
  if (graphState.dragging < 0) return;
  const { x, y } = getCanvasPos(evt);
  graphState.points[graphState.dragging] = { x, y };
  graphState.points = graphState.points
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((p, i, arr) => {
      if (i === 0) return { x: 0, y: p.y };
      if (i === arr.length - 1) return { x: 1, y: p.y };
      return p;
    });
  drawGraph();
  buildTower();
});

['pointerup', 'pointerleave'].forEach((ev) =>
  graphCanvas.addEventListener(ev, (evt) => {
    graphState.dragging = -1;
    graphCanvas.releasePointerCapture?.(evt.pointerId);
  })
);

// Parameters
const params = {
  floors: 36,
  floorHeight: 1.25,
  slabThickness: 0.35,
  slabShape: 'cylinder', // cylinder | square | triangle | hexagon
  rectAspect: 1,
  baseRadiusMin: 8,
  baseRadiusMax: 15,
  topRadiusMin: 6,
  topRadiusMax: 12,
  slabSegments: 32,
  profileCurve: 'graph', // graph uses mapper
  scalePower: 1.1,
  twistMinDeg: -12,
  twistMaxDeg: 110,
  twistCurve: 'easeInOut',
  twistPower: 1.15,
  colorBottom: '#0ea5e9',
  colorTop: '#f97316',
  wireframe: false,
  showGrid: true,
  showAxes: false,
  columnSpacing: 8,
  columnRadius: 0.35,
  columnRows: 0,
  columnCols: 0,
};

let towerGroup;
let columnGroup;
let gridGroup;

const curve = {
  linear: (t, power = 1) => t,
  easeIn: (t, power = 2) => Math.pow(t, power),
  easeOut: (t, power = 2) => 1 - Math.pow(1 - t, power),
  easeInOut: (t, power = 2) => {
    const c = clamp01(t);
    return c < 0.5 ? 0.5 * Math.pow(c * 2, power) : 1 - 0.5 * Math.pow((1 - c) * 2, power);
  },
  bell: (t) => Math.sin(Math.PI * clamp01(t)),
  arch: (t) => 1 - Math.pow(2 * clamp01(t) - 1, 2),
};

const disposeGroup = (group) => {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.isMesh || obj.isLine) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material?.dispose();
    }
  });
  scene.remove(group);
};

const buildTower = () => {
  disposeGroup(towerGroup);
  disposeGroup(columnGroup);
  disposeGroup(gridGroup);

  towerGroup = new THREE.Group();
  const floors = Math.max(1, Math.floor(params.floors));
  const slabHeight = Math.max(0.05, Math.min(params.slabThickness, params.floorHeight));
  const powerScale = Math.max(0.2, params.scalePower);
  const powerTwist = Math.max(0.2, params.twistPower);
  const baseColor = new THREE.Color(params.colorBottom);
  const topColor = new THREE.Color(params.colorTop);

  const shapeSegments = {
    cylinder: params.slabSegments,
    square: 4,
    triangle: 3,
    hexagon: 6,
  };
  const radialSegments = shapeSegments[params.slabShape] ?? params.slabSegments;

  const floorPlans = [];

  for (let i = 0; i < floors; i += 1) {
    const t = floors === 1 ? 0 : i / (floors - 1);
    const tScale =
      params.profileCurve === 'graph'
        ? graphEvaluate(t)
        : curve[params.profileCurve]?.(t, powerScale) ?? t;
    const tTwist = curve[params.twistCurve]?.(t, powerTwist) ?? t;

    const baseRadius = THREE.MathUtils.lerp(
      Math.min(params.baseRadiusMin, params.baseRadiusMax),
      Math.max(params.baseRadiusMin, params.baseRadiusMax),
      tScale
    );
    const topRadius = THREE.MathUtils.lerp(
      Math.min(params.topRadiusMin, params.topRadiusMax),
      Math.max(params.topRadiusMin, params.topRadiusMax),
      tScale
    );
    const planRadius = THREE.MathUtils.lerp(baseRadius, topRadius, tScale);
    const twistRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.lerp(params.twistMinDeg, params.twistMaxDeg, tTwist)
    );

    let geom;
    if (params.slabShape === 'square') {
      geom = new THREE.BoxGeometry(planRadius * 2, slabHeight, planRadius * 2 * params.rectAspect);
    } else {
      geom = new THREE.CylinderGeometry(
        planRadius,
        planRadius,
        slabHeight,
        radialSegments,
        1,
        false
      );
    }

    const mat = new THREE.MeshStandardMaterial({
      color: baseColor.clone().lerp(topColor, t),
      roughness: 0.4,
      metalness: 0.05,
      wireframe: params.wireframe,
    });

    const slab = new THREE.Mesh(geom, mat);
    slab.position.y = i * params.floorHeight + slabHeight * 0.5;
    slab.rotation.y = twistRad;
    towerGroup.add(slab);

    floorPlans.push({
      halfX: planRadius,
      halfZ: params.slabShape === 'square' ? planRadius * params.rectAspect : planRadius,
    });
  }

  scene.add(towerGroup);

  // Structural grid and columns
  const minHalfX = Math.min(...floorPlans.map((p) => p.halfX));
  const minHalfZ = Math.min(...floorPlans.map((p) => p.halfZ));
  const spacingX =
    params.columnCols >= 2
      ? (2 * minHalfX) / Math.max(1, params.columnCols - 1)
      : Math.max(2, params.columnSpacing);
  const spacingZ =
    params.columnRows >= 2
      ? (2 * minHalfZ) / Math.max(1, params.columnRows - 1)
      : Math.max(2, params.columnSpacing);

  const totalHeight = floors * params.floorHeight;
  const points = new Map();
  const addPoint = (x, z) => {
    const key = `${x.toFixed(3)},${z.toFixed(3)}`;
    points.set(key, [x, z]);
  };

  const angleNorm = (angle, step) => {
    const mod = (angle + step) % step;
    return mod < 0 ? mod + step : mod;
  };
  const insideRegularPolygon = (x, z, radius, sides) => {
    const ang = Math.atan2(z, x);
    const sector = (2 * Math.PI) / sides;
    const local = angleNorm(ang, sector);
    const dist = Math.hypot(x, z);
    const maxR = radius * Math.cos(Math.PI / sides) / Math.cos(local - Math.PI / sides);
    return dist <= maxR + 1e-6;
  };
  const isInside = (x, z, halfX, halfZ) => {
    if (params.slabShape === 'square') return Math.abs(x) <= halfX + 1e-6 && Math.abs(z) <= halfZ + 1e-6;
    if (params.slabShape === 'cylinder') return Math.hypot(x, z) <= minHalfX + 1e-6;
    if (params.slabShape === 'triangle') return insideRegularPolygon(x, z, minHalfX, 3);
    if (params.slabShape === 'hexagon') return insideRegularPolygon(x, z, minHalfX, 6);
    return false;
  };

  // Perimeter seeding
  if (params.slabShape === 'square') {
    const countX =
      params.columnCols >= 2 ? params.columnCols : Math.max(2, Math.ceil((2 * minHalfX) / spacingX) + 1);
    const countZ =
      params.columnRows >= 2 ? params.columnRows : Math.max(2, Math.ceil((2 * minHalfZ) / spacingZ) + 1);
    const stepX = (2 * minHalfX) / (countX - 1);
    const stepZ = (2 * minHalfZ) / (countZ - 1);
    for (let i = 0; i < countX; i += 1) {
      const x = -minHalfX + i * stepX;
      addPoint(x, -minHalfZ);
      addPoint(x, minHalfZ);
    }
    for (let j = 0; j < countZ; j += 1) {
      const z = -minHalfZ + j * stepZ;
      addPoint(-minHalfX, z);
      addPoint(minHalfX, z);
    }
  } else if (params.slabShape === 'cylinder') {
    const radius = minHalfX;
    const avgSpacing = 0.5 * (spacingX + spacingZ);
    const segments = Math.max(8, Math.ceil((2 * Math.PI * radius) / avgSpacing));
    const step = (2 * Math.PI) / segments;
    for (let a = 0; a < 2 * Math.PI; a += step) {
      addPoint(radius * Math.cos(a), radius * Math.sin(a));
    }
  } else {
    const sides = params.slabShape === 'triangle' ? 3 : 6;
    const vertices = [];
    for (let i = 0; i < sides; i += 1) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / sides;
      vertices.push([minHalfX * Math.cos(a), minHalfX * Math.sin(a)]);
    }
    const edgeStep = Math.min(spacingX, spacingZ);
    for (let i = 0; i < sides; i += 1) {
      const [x1, z1] = vertices[i];
      const [x2, z2] = vertices[(i + 1) % sides];
      const edgeLen = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(1, Math.ceil(edgeLen / edgeStep));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        addPoint(THREE.MathUtils.lerp(x1, x2, t), THREE.MathUtils.lerp(z1, z2, t));
      }
    }
  }

  // Infill
  for (let x = -minHalfX; x <= minHalfX + 1e-3; x += spacingX) {
    for (let z = -minHalfZ; z <= minHalfZ + 1e-3; z += spacingZ) {
      if (isInside(x, z, minHalfX, minHalfZ)) addPoint(x, z);
    }
  }

  // Columns
  columnGroup = new THREE.Group();
  const columnMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.5,
    metalness: 0.05,
  });
  const colGeom = new THREE.CylinderGeometry(params.columnRadius, params.columnRadius, totalHeight, 8, 1, false);
  const inst = new THREE.InstancedMesh(colGeom, columnMat, points.size);
  let idx = 0;
  const mtx = new THREE.Matrix4();
  points.forEach(([x, z]) => {
    mtx.makeTranslation(x, totalHeight * 0.5, z);
    inst.setMatrixAt(idx, mtx);
    idx += 1;
  });
  inst.instanceMatrix.needsUpdate = true;
  columnGroup.add(inst);
  scene.add(columnGroup);

  // Grid per floor following plan
  gridGroup = new THREE.Group();
  const gridColor = 0x94a3b8;
  const sampleStep = Math.max(0.5, Math.min(spacingX, spacingZ) * 0.5);

  const buildGridLines = (y, halfXLocal, halfZLocal) => {
    const verts = [];
    for (let x = -halfXLocal; x <= halfXLocal + 1e-3; x += spacingX) {
      let inSeg = false;
      let start = 0;
      for (let z = -halfZLocal; z <= halfZLocal + sampleStep; z += sampleStep) {
        const inside = params.slabShape === 'square'
          ? Math.abs(x) <= halfXLocal + 1e-6 && Math.abs(z) <= halfZLocal + 1e-6
          : isInside(x, z, halfXLocal, halfZLocal);
        if (inside && !inSeg) {
          start = z;
          inSeg = true;
        }
        if ((!inside || z >= halfZLocal) && inSeg) {
          const end = inside ? z : z - sampleStep;
          verts.push(x, y, start, x, y, end);
          inSeg = false;
        }
      }
    }
    for (let z = -halfZLocal; z <= halfZLocal + 1e-3; z += spacingZ) {
      let inSeg = false;
      let start = 0;
      for (let x = -halfXLocal; x <= halfXLocal + sampleStep; x += sampleStep) {
        const inside = params.slabShape === 'square'
          ? Math.abs(x) <= halfXLocal + 1e-6 && Math.abs(z) <= halfZLocal + 1e-6
          : isInside(x, z, halfXLocal, halfZLocal);
        if (inside && !inSeg) {
          start = x;
          inSeg = true;
        }
        if ((!inside || x >= halfXLocal) && inSeg) {
          const end = inside ? x : x - sampleStep;
          verts.push(start, y, z, end, y, z);
          inSeg = false;
        }
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({ color: gridColor });
    gridGroup.add(new THREE.LineSegments(geom, mat));
  };

  for (let i = 0; i < floors; i += 1) {
    const y = i * params.floorHeight + slabHeight + 0.02;
    const plan = floorPlans[i];
    buildGridLines(y, plan.halfX, plan.halfZ);
  }

  scene.add(gridGroup);
};

// GUI
const gui = new GUI({ title: 'Tower Controls' });
gui.add(params, 'floors', 1, 200, 1).name('Floors').onChange(buildTower);
gui
  .add(params, 'floorHeight', 0.2, 4, 0.05)
  .name('Floor height (m)')
  .onChange((v) => {
    if (params.slabThickness > v) params.slabThickness = v;
    slabControl.updateDisplay();
    buildTower();
  });

const slabControl = gui
  .add(params, 'slabThickness', 0.05, 2, 0.01)
  .name('Slab thickness (m)')
  .onChange((v) => {
    params.slabThickness = Math.min(v, params.floorHeight);
    slabControl.updateDisplay();
    buildTower();
  });

const scaleFolder = gui.addFolder('Scaling');
scaleFolder.add(params, 'slabShape', ['cylinder', 'square', 'triangle', 'hexagon']).name('Slab shape').onChange(buildTower);
scaleFolder.add(params, 'rectAspect', 0.5, 2, 0.05).name('Rect aspect (X:Z)').onChange(buildTower);
scaleFolder.add(params, 'baseRadiusMin', 6, 50, 0.1).name('Base radius min (m)').onChange(buildTower);
scaleFolder.add(params, 'baseRadiusMax', 6, 50, 0.1).name('Base radius max (m)').onChange(buildTower);
scaleFolder.add(params, 'topRadiusMin', 4, 50, 0.1).name('Top radius min (m)').onChange(buildTower);
scaleFolder.add(params, 'topRadiusMax', 4, 50, 0.1).name('Top radius max (m)').onChange(buildTower);
scaleFolder
  .add(params, 'profileCurve', ['graph', 'linear', 'easeIn', 'easeOut', 'easeInOut', 'bell', 'arch'])
  .name('Profile curve')
  .onChange(buildTower);
scaleFolder.add(params, 'scalePower', 0.2, 3, 0.05).name('Scale intensity').onChange(buildTower);

const twistFolder = gui.addFolder('Twisting');
twistFolder.add(params, 'twistMinDeg', -360, 360, 1).name('Twist min (deg)').onChange(buildTower);
twistFolder.add(params, 'twistMaxDeg', -360, 360, 1).name('Twist max (deg)').onChange(buildTower);
twistFolder.add(params, 'twistCurve', ['linear', 'easeIn', 'easeOut', 'easeInOut']).name('Twist curve').onChange(buildTower);
twistFolder.add(params, 'twistPower', 0.2, 3, 0.05).name('Twist intensity').onChange(buildTower);

const styleFolder = gui.addFolder('Style');
styleFolder.addColor(params, 'colorBottom').name('Base color').onChange(buildTower);
styleFolder.addColor(params, 'colorTop').name('Top color').onChange(buildTower);
styleFolder.add(params, 'wireframe').name('Wireframe').onChange(buildTower);

const helperFolder = gui.addFolder('Helpers');
helperFolder.add(params, 'showGrid').name('World grid').onChange((v) => (worldGrid.visible = v));
helperFolder.add(params, 'showAxes').name('Axes').onChange((v) => (axes.visible = v));

const structureFolder = gui.addFolder('Structure');
structureFolder.add(params, 'columnSpacing', 2, 20, 0.5).name('Column spacing (m)').onChange(buildTower);
structureFolder.add(params, 'columnRadius', 0.15, 1.2, 0.05).name('Column radius (m)').onChange(buildTower);
structureFolder.add(params, 'columnCols', 0, 50, 1).name('Grid columns (0=auto)').onChange(buildTower);
structureFolder.add(params, 'columnRows', 0, 50, 1).name('Grid rows (0=auto)').onChange(buildTower);

drawGraph();
buildTower();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const render = () => {
  stats.begin();
  controls.update();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(render);
};
render();
