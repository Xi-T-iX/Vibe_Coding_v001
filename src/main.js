import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

const app = document.querySelector('#app');

// Scene and renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9eef7');

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(18, 18, 24);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 10, 0);

// Lighting and helpers
const hemiLight = new THREE.HemisphereLight(0xbde3ff, 0x243b4a, 0.9);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
dirLight.position.set(25, 35, 15);
dirLight.castShadow = false;
scene.add(dirLight);

const grid = new THREE.GridHelper(160, 80, 0x94a3b8, 0xcbd5e1);
scene.add(grid);

const axes = new THREE.AxesHelper(5);
axes.visible = false;
scene.add(axes);

const stats = new Stats();
stats.showPanel(0);
stats.dom.classList.add('stats');
app.appendChild(stats.dom);

// Graph mapper UI
const graphPanel = document.createElement('div');
graphPanel.className = 'graph-panel';
graphPanel.innerHTML = `
  <div class="graph-header">
    <span>Graph Mapper</span>
    <span class="graph-meta">0 : 1</span>
  </div>
  <canvas class="graph-canvas" width="260" height="260"></canvas>
  <div class="graph-help">Drag points to remap the tower profile (0-1 input & output).</div>
`;
app.appendChild(graphPanel);

const graphCanvas = graphPanel.querySelector('canvas');
const graphCtx = graphCanvas.getContext('2d');
const graphState = {
  points: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.05 },
    { x: 0.75, y: 0.65 },
    { x: 1, y: 1 },
  ],
  dragging: -1,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const catmull = (p0, p1, p2, p3, t) => {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
};

const graphEvaluate = (t) => {
  const pts = graphState.points.slice().sort((a, b) => a.x - b.x);
  const clampedT = clamp01(t);
  if (pts.length < 2) return clampedT;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (clampedT >= a.x && clampedT <= b.x) {
      const localT = (clampedT - a.x) / Math.max(1e-6, b.x - a.x);
      const p0 = pts[Math.max(0, i - 1)];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const y = catmull(p0.y, a.y, b.y, p3.y, localT);
      return clamp01(y);
    }
  }
  return clamp01(pts[pts.length - 1].y);
};

const drawGraph = () => {
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  graphCtx.clearRect(0, 0, w, h);
  // grid
  graphCtx.strokeStyle = '#e2e8f0';
  graphCtx.lineWidth = 1;
  const step = w / 10;
  for (let i = 0; i <= 10; i += 1) {
    const x = i * step;
    graphCtx.beginPath();
    graphCtx.moveTo(x, 0);
    graphCtx.lineTo(x, h);
    graphCtx.stroke();
    const y = i * step;
    graphCtx.beginPath();
    graphCtx.moveTo(0, y);
    graphCtx.lineTo(w, y);
    graphCtx.stroke();
  }
  // curve
  const pts = graphState.points.slice().sort((a, b) => a.x - b.x);
  if (pts.length >= 2) {
    graphCtx.strokeStyle = '#111827';
    graphCtx.lineWidth = 2;
    graphCtx.beginPath();
    const samples = 80;
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const y = graphEvaluate(t);
      const px = t * w;
      const py = h - y * h;
      if (i === 0) graphCtx.moveTo(px, py);
      else graphCtx.lineTo(px, py);
    }
    graphCtx.stroke();
  }
  // points
  pts.forEach((p, idx) => {
    const px = p.x * w;
    const py = h - p.y * h;
    graphCtx.fillStyle = idx === graphState.dragging ? '#0ea5e9' : '#111827';
    graphCtx.beginPath();
    graphCtx.arc(px, py, 6, 0, Math.PI * 2);
    graphCtx.fill();
    graphCtx.strokeStyle = '#f8fafc';
    graphCtx.lineWidth = 2;
    graphCtx.beginPath();
    graphCtx.arc(px, py, 6, 0, Math.PI * 2);
    graphCtx.stroke();
  });
};

const getCanvasPos = (evt) => {
  const rect = graphCanvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) / rect.width;
  const y = (evt.clientY - rect.top) / rect.height;
  return { x: clamp01(x), y: clamp01(1 - y) };
};

graphCanvas.addEventListener('pointerdown', (evt) => {
  const { x, y } = getCanvasPos(evt);
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  const hitIdx = graphState.points.findIndex((p) => {
    const dx = p.x * w - x * w;
    const dy = p.y * h - y * h;
    return Math.hypot(dx, dy) < 10;
  });
  if (hitIdx >= 0) {
    graphState.dragging = hitIdx;
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
    .filter(Boolean)
    .sort((a, b) => a.x - b.x)
    .map((p, i, arr) => {
      if (i === 0) return { x: 0, y: p.y };
      if (i === arr.length - 1) return { x: 1, y: p.y };
      return p;
    });
  drawGraph();
  buildTower();
});

graphCanvas.addEventListener('pointerup', (evt) => {
  graphState.dragging = -1;
  graphCanvas.releasePointerCapture(evt.pointerId);
});

graphCanvas.addEventListener('pointerleave', () => {
  graphState.dragging = -1;
});
// Tower parameters and state
const params = {
  floors: 36,
  floorHeight: 1.25,
  slabThickness: 0.35,
  baseRadiusMin: 8,
  baseRadiusMax: 15,
  topRadiusMin: 6,
  topRadiusMax: 12,
  slabShape: 'cylinder', // cylinder | square | triangle | hexagon
  rectAspect: 1,
  columnSpacing: 8,
  columnRadius: 0.35,
  columnRows: 0,
  columnCols: 0,
  profileCurve: 'linear', // linear | easeIn | easeOut | easeInOut | bell | arch
  scaleCurve: 'easeOut', // linear | easeIn | easeOut | easeInOut
  scalePower: 1.1,
  twistMinDeg: -12,
  twistMaxDeg: 110,
  twistCurve: 'easeInOut', // linear | easeIn | easeOut | easeInOut
  twistPower: 1.15,
  slabSegments: 32,
  colorBottom: '#0ea5e9',
  colorTop: '#f97316',
  wireframe: false,
  showGrid: true,
  showAxes: false,
};

let towerGroup;
let columnGroup;
let gridGroup;

const curve = {
  linear: (t, power = 1) => t,
  easeIn: (t, power = 2) => Math.pow(t, power),
  easeOut: (t, power = 2) => 1 - Math.pow(1 - t, power),
  easeInOut: (t, power = 2) => {
    const clamped = Math.min(Math.max(t, 0), 1);
    return clamped < 0.5
      ? 0.5 * Math.pow(clamped * 2, power)
      : 1 - 0.5 * Math.pow((1 - clamped) * 2, power);
  },
  bell: (t) => {
    const clamped = Math.min(Math.max(t, 0), 1);
    return Math.sin(Math.PI * clamped);
  },
  arch: (t) => {
    const clamped = Math.min(Math.max(t, 0), 1);
    return 1 - Math.pow(2 * clamped - 1, 2);
  },
};

const clampPower = (value) => Math.max(0.2, value);
const graphMap = (type, t, power = 1) => {
  const fn = curve[type] || curve.linear;
  return fn(t, power);
};

const disposeTower = (group) => {
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose();
      }
    }
  });
};

const disposeColumns = () => {
  if (columnGroup) {
    columnGroup.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    scene.remove(columnGroup);
  }
  if (gridGroup) {
    gridGroup.traverse((obj) => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
    scene.remove(gridGroup);
  }
};

const buildTower = () => {
  if (towerGroup) {
    disposeTower(towerGroup);
    scene.remove(towerGroup);
  }

  towerGroup = new THREE.Group();
  const floorPlans = [];
  const floors = Math.max(1, Math.floor(params.floors));
  const powerScale = clampPower(params.scalePower);
  const powerTwist = clampPower(params.twistPower);
  const slabHeight = Math.max(0.05, Math.min(params.slabThickness, params.floorHeight));
  const baseColor = new THREE.Color(params.colorBottom);
  const topColor = new THREE.Color(params.colorTop);

  const shapeSegments = {
    cylinder: params.slabSegments,
    square: 4,
    triangle: 3,
    hexagon: 6,
  };
  const radialSegments = shapeSegments[params.slabShape] ?? params.slabSegments;
  const totalHeight = floors * params.floorHeight;
  const minPlanRadius = Math.min(...floorPlans.map((p) => p.halfX));
  const minPlanRadiusZ = Math.min(...floorPlans.map((p) => p.halfZ));

  for (let i = 0; i < floors; i += 1) {
    const t = floors === 1 ? 0 : i / (floors - 1);
    const tScale =
      params.profileCurve === 'graph'
        ? graphEvaluate(t)
        : graphMap(params.profileCurve, t, powerScale);
    const tTwist = curve[params.twistCurve]?.(t, powerTwist) ?? t;

    // Plan dimensions vary per floor but remain constant through the slab thickness
    const baseRadiusRange = THREE.MathUtils.lerp(
      Math.min(params.baseRadiusMin, params.baseRadiusMax),
      Math.max(params.baseRadiusMin, params.baseRadiusMax),
      tScale
    );
    const topRadiusRange = THREE.MathUtils.lerp(
      Math.min(params.topRadiusMin, params.topRadiusMax),
      Math.max(params.topRadiusMin, params.topRadiusMax),
      tScale
    );
    const planRadius = THREE.MathUtils.lerp(baseRadiusRange, topRadiusRange, tScale);
    const twistRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.lerp(params.twistMinDeg, params.twistMaxDeg, tTwist)
    );

    let geometry;
    if (params.slabShape === 'square') {
      geometry = new THREE.BoxGeometry(planRadius * 2, slabHeight, planRadius * 2 * params.rectAspect);
    } else {
      geometry = new THREE.CylinderGeometry(
        planRadius,
        planRadius,
        slabHeight,
        radialSegments,
        1,
        false
      );
    }

    const color = baseColor.clone().lerp(topColor, t);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.05,
      wireframe: params.wireframe,
    });

    const slab = new THREE.Mesh(geometry, material);
    const baseY = i * params.floorHeight;
    slab.position.y = baseY + slabHeight * 0.5;
    slab.rotation.y = twistRad;
    slab.castShadow = false;
    slab.receiveShadow = false;
    towerGroup.add(slab);

    floorPlans.push({
      halfX: planRadius,
      halfZ: params.slabShape === 'square' ? planRadius * params.rectAspect : planRadius,
    });
  }

  scene.add(towerGroup);

  // Structural grid and columns (metre units)
  disposeColumns();

  const spacingX =
    params.columnCols >= 2
      ? (2 * halfX) / Math.max(1, params.columnCols - 1)
      : Math.max(2, params.columnSpacing);
  const spacingZ =
    params.columnRows >= 2
      ? (2 * halfZ) / Math.max(1, params.columnRows - 1)
      : Math.max(2, params.columnSpacing);
  const halfX = minPlanRadius;
  const halfZ = minPlanRadiusZ;
  const points = new Map();
  const addPoint = (x, z) => {
    const key = `${x.toFixed(3)},${z.toFixed(3)}`;
    if (!points.has(key) && isInside(x, z)) {
      points.set(key, [x, z]);
    }
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

  const isInside = (x, z) => {
    if (params.slabShape === 'square') {
      return Math.abs(x) <= halfX + 1e-6 && Math.abs(z) <= halfZ + 1e-6;
    }
    if (params.slabShape === 'cylinder') {
      return Math.hypot(x, z) <= minPlanRadius + 1e-6;
    }
    if (params.slabShape === 'triangle') {
      return insideRegularPolygon(x, z, minPlanRadius, 3);
    }
    if (params.slabShape === 'hexagon') {
      return insideRegularPolygon(x, z, minPlanRadius, 6);
    }
    return false;
  };

  const columnMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.5,
    metalness: 0.05,
  });
  const colGeom = new THREE.CylinderGeometry(
    params.columnRadius,
    params.columnRadius,
    totalHeight,
    8,
    1,
    false
  );

  // Perimeter first, then infill inward
  if (params.slabShape === 'square') {
    // Perimeter on rectangle edges
    const countX = params.columnCols >= 2 ? params.columnCols : Math.max(2, Math.ceil((2 * halfX) / spacingX) + 1);
    const countZ = params.columnRows >= 2 ? params.columnRows : Math.max(2, Math.ceil((2 * halfZ) / spacingZ) + 1);
    const stepX = (2 * halfX) / (countX - 1);
    const stepZ = (2 * halfZ) / (countZ - 1);
    for (let i = 0; i < countX; i += 1) {
      const x = -halfX + i * stepX;
      addPoint(x, -halfZ);
      addPoint(x, halfZ);
    }
    for (let j = 0; j < countZ; j += 1) {
      const z = -halfZ + j * stepZ;
      addPoint(-halfX, z);
      addPoint(halfX, z);
    }
  } else if (params.slabShape === 'cylinder') {
    const radius = minPlanRadius;
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
      vertices.push([minPlanRadius * Math.cos(a), minPlanRadius * Math.sin(a)]);
    }
    for (let i = 0; i < sides; i += 1) {
      const [x1, z1] = vertices[i];
      const [x2, z2] = vertices[(i + 1) % sides];
      const edgeLen = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(1, Math.ceil(edgeLen / spacing));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        addPoint(THREE.MathUtils.lerp(x1, x2, t), THREE.MathUtils.lerp(z1, z2, t));
      }
    }
  }

  // Infill grid inward
  for (let x = -halfX; x <= halfX + 1e-3; x += spacingX) {
    for (let z = -halfZ; z <= halfZ + 1e-3; z += spacingZ) {
      addPoint(x, z);
    }
  }

  columnGroup = new THREE.Group();
  const instanceCount = points.size;
  if (instanceCount > 0) {
    const instanced = new THREE.InstancedMesh(colGeom, columnMat, instanceCount);
    let idx = 0;
    const matrix = new THREE.Matrix4();
    points.forEach(([x, z]) => {
      matrix.makeTranslation(x, totalHeight * 0.5, z);
      instanced.setMatrixAt(idx, matrix);
      idx += 1;
    });
    instanced.instanceMatrix.needsUpdate = true;
    columnGroup.add(instanced);
  }

  scene.add(columnGroup);

  // Modular structural grid drawn on each slab top surface
  gridGroup = new THREE.Group();
  const gridColor = 0x94a3b8;
  const sampleStep = Math.max(0.5, Math.min(spacingX, spacingZ) * 0.5);

  const buildGridLines = (y, halfXLocal, halfZLocal) => {
    const vertices = [];
    // X-directed lines
    for (let x = -halfXLocal; x <= halfXLocal + 1e-3; x += spacingX) {
      let inSeg = false;
      let start = 0;
      for (let z = -halfZLocal; z <= halfZLocal + sampleStep; z += sampleStep) {
        const inside =
          params.slabShape === 'square'
            ? Math.abs(x) <= halfXLocal + 1e-6 && Math.abs(z) <= halfZLocal + 1e-6
            : isInside(x, z);
        if (inside && !inSeg) {
          start = z;
          inSeg = true;
        }
        if ((!inside || z >= halfZLocal) && inSeg) {
          const end = inside ? z : z - sampleStep;
          vertices.push(x, y, start, x, y, end);
          inSeg = false;
        }
      }
    }
    // Z-directed lines
    for (let z = -halfZLocal; z <= halfZLocal + 1e-3; z += spacingZ) {
      let inSeg = false;
      let start = 0;
      for (let x = -halfXLocal; x <= halfXLocal + sampleStep; x += sampleStep) {
        const inside =
          params.slabShape === 'square'
            ? Math.abs(x) <= halfXLocal + 1e-6 && Math.abs(z) <= halfZLocal + 1e-6
            : isInside(x, z);
        if (inside && !inSeg) {
          start = x;
          inSeg = true;
        }
        if ((!inside || x >= halfXLocal) && inSeg) {
          const end = inside ? x : x - sampleStep;
          vertices.push(start, y, z, end, y, z);
          inSeg = false;
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const mat = new THREE.LineBasicMaterial({ color: gridColor });
    const lines = new THREE.LineSegments(geom, mat);
    gridGroup.add(lines);
  };

  for (let i = 0; i < floors; i += 1) {
    const y = i * params.floorHeight + slabHeight + 0.02;
    const plan = floorPlans[i] || { halfX, halfZ };
    buildGridLines(y, plan.halfX, plan.halfZ);
  }

  scene.add(gridGroup);
};

// GUI bindings
const gui = new GUI({ title: 'Tower Controls' });
gui
  .add(params, 'floors', 1, 200, 1)
  .name('Floors')
  .onChange(buildTower);
gui
  .add(params, 'floorHeight', 0.2, 4, 0.05)
  .name('Floor height')
  .onChange((value) => {
    // Prevent slab thickness from exceeding floor spacing
    if (params.slabThickness > value) {
      params.slabThickness = value;
      slabControl.updateDisplay();
    }
    buildTower();
  });

const slabControl = gui
  .add(params, 'slabThickness', 0.05, 2, 0.01)
  .name('Slab thickness')
  .onChange((value) => {
    params.slabThickness = Math.min(value, params.floorHeight);
    slabControl.updateDisplay();
    buildTower();
  });

const scaleFolder = gui.addFolder('Scaling');
scaleFolder
  .add(params, 'baseRadiusMin', 6, 50, 0.1)
  .name('Base radius min (m)')
  .onChange(buildTower);
scaleFolder
  .add(params, 'baseRadiusMax', 6, 50, 0.1)
  .name('Base radius max (m)')
  .onChange(buildTower);
scaleFolder
  .add(params, 'topRadiusMin', 4, 50, 0.1)
  .name('Top radius min (m)')
  .onChange(buildTower);
scaleFolder
  .add(params, 'topRadiusMax', 4, 50, 0.1)
  .name('Top radius max (m)')
  .onChange(buildTower);
scaleFolder
  .add(params, 'slabShape', ['cylinder', 'square', 'triangle', 'hexagon'])
  .name('Slab shape')
  .onChange(buildTower);
scaleFolder
  .add(params, 'rectAspect', 0.5, 2, 0.05)
  .name('Rect aspect (X:Z)')
  .onChange(buildTower);
scaleFolder
  .add(params, 'profileCurve', ['graph', 'linear', 'easeIn', 'easeOut', 'easeInOut', 'bell', 'arch'])
  .name('Profile curve')
  .onChange(buildTower);
scaleFolder
  .add(params, 'scalePower', 0.2, 3, 0.05)
  .name('Scale intensity')
  .onChange(buildTower);

const twistFolder = gui.addFolder('Twisting');
twistFolder
  .add(params, 'twistMinDeg', -360, 360, 1)
  .name('Twist min (deg)')
  .onChange(buildTower);
twistFolder
  .add(params, 'twistMaxDeg', -360, 360, 1)
  .name('Twist max (deg)')
  .onChange(buildTower);
twistFolder
  .add(params, 'twistCurve', ['linear', 'easeIn', 'easeOut', 'easeInOut'])
  .name('Twist curve')
  .onChange(buildTower);
twistFolder
  .add(params, 'twistPower', 0.2, 3, 0.05)
  .name('Twist intensity')
  .onChange(buildTower);

const styleFolder = gui.addFolder('Style');
styleFolder
  .addColor(params, 'colorBottom')
  .name('Base color')
  .onChange(buildTower);
styleFolder
  .addColor(params, 'colorTop')
  .name('Top color')
  .onChange(buildTower);
styleFolder
  .add(params, 'wireframe')
  .name('Wireframe')
  .onChange(buildTower);

const helperFolder = gui.addFolder('Helpers');
helperFolder
  .add(params, 'showGrid')
  .name('Grid')
  .onChange((value) => {
    grid.visible = value;
  });
helperFolder
  .add(params, 'showAxes')
  .name('Axes')
  .onChange((value) => {
    axes.visible = value;
  });

const structureFolder = gui.addFolder('Structure');
structureFolder
  .add(params, 'columnSpacing', 2, 20, 0.5)
  .name('Column spacing (m)')
  .onChange(buildTower);
structureFolder
  .add(params, 'columnRadius', 0.15, 1.2, 0.05)
  .name('Column radius (m)')
  .onChange(buildTower);
structureFolder
  .add(params, 'columnCols', 0, 50, 1)
  .name('Grid columns (0=auto)')
  .onChange(buildTower);
structureFolder
  .add(params, 'columnRows', 0, 50, 1)
  .name('Grid rows (0=auto)')
  .onChange(buildTower);

buildTower();

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener('resize', onResize);

const render = () => {
  stats.begin();
  controls.update();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(render);
};

render();
