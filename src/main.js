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
  scaleCurve: 'easeOut', // linear | easeIn | easeOut | easeInOut
  scalePower: 1.1,
  twistMinDeg: -12,
  twistMaxDeg: 110,
  twistCurve: 'easeInOut', // linear | easeIn | easeOut | easeInOut
  twistPower: 1.15,
  slabSegments: 48,
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
};

const clampPower = (value) => Math.max(0.2, value);

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
  const minPlanRadius = Math.min(
    params.baseRadiusMin,
    params.baseRadiusMax,
    params.topRadiusMin,
    params.topRadiusMax
  );
  const minPlanRadiusZ =
    params.slabShape === 'square'
      ? minPlanRadius * params.rectAspect
      : minPlanRadius;

  for (let i = 0; i < floors; i += 1) {
    const t = floors === 1 ? 0 : i / (floors - 1);
    const tScale = curve[params.scaleCurve]?.(t, powerScale) ?? t;
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
  }

  scene.add(towerGroup);

  // Structural grid and columns (metre units)
  disposeColumns();

  const spacing = Math.max(2, params.columnSpacing);
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
    for (let x = -halfX; x <= halfX + 1e-3; x += spacing) {
      addPoint(x, -halfZ);
      addPoint(x, halfZ);
    }
    for (let z = -halfZ; z <= halfZ + 1e-3; z += spacing) {
      addPoint(-halfX, z);
      addPoint(halfX, z);
    }
  } else if (params.slabShape === 'cylinder') {
    const radius = minPlanRadius;
    const segments = Math.max(8, Math.ceil((2 * Math.PI * radius) / spacing));
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
  for (let x = -halfX; x <= halfX + 1e-3; x += spacing) {
    for (let z = -halfZ; z <= halfZ + 1e-3; z += spacing) {
      addPoint(x, z);
    }
  }

  columnGroup = new THREE.Group();
  points.forEach(([x, z]) => {
    const col = new THREE.Mesh(colGeom, columnMat);
    col.position.set(x, totalHeight * 0.5, z);
    columnGroup.add(col);
  });

  scene.add(columnGroup);

  // Modular structural grid drawn on each slab top surface
  gridGroup = new THREE.Group();
  const gridColor = 0x94a3b8;
  const sampleStep = Math.max(0.25, spacing / 4);

  const buildGridLines = (y) => {
    const vertices = [];
    // X-directed lines
    for (let x = -halfX; x <= halfX + 1e-3; x += spacing) {
      let inSeg = false;
      let start = 0;
      for (let z = -halfZ; z <= halfZ + sampleStep; z += sampleStep) {
        const inside = isInside(x, z);
        if (inside && !inSeg) {
          start = z;
          inSeg = true;
        }
        if ((!inside || z >= halfZ) && inSeg) {
          const end = inside ? z : z - sampleStep;
          vertices.push(x, y, start, x, y, end);
          inSeg = false;
        }
      }
    }
    // Z-directed lines
    for (let z = -halfZ; z <= halfZ + 1e-3; z += spacing) {
      let inSeg = false;
      let start = 0;
      for (let x = -halfX; x <= halfX + sampleStep; x += sampleStep) {
        const inside = isInside(x, z);
        if (inside && !inSeg) {
          start = x;
          inSeg = true;
        }
        if ((!inside || x >= halfX) && inSeg) {
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
    buildGridLines(y);
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
  .add(params, 'scaleCurve', ['linear', 'easeIn', 'easeOut', 'easeInOut'])
  .name('Scale curve')
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
