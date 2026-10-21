import * as THREE from 'three';
import { createDesk, createEnvironment, createWindowShadow, createContactShadow } from './desk.js';
import { createCarpet } from './ornaments.js';

const room = document.querySelector('#room');
const canvas = document.querySelector('#desk');
const status = document.querySelector('#render-status');
const lightButton = document.querySelector('#light-toggle');
const viewButton = document.querySelector('#view-toggle');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');
let evening = false;
let close = false;
let engine;

lightButton.addEventListener('click', () => {
  evening = !evening;
  lightButton.setAttribute('aria-pressed', String(evening));
  lightButton.setAttribute('aria-label', evening ? 'Change to afternoon light' : 'Change to evening light');
  room.classList.toggle('is-evening', evening);
  status.textContent = evening ? 'Warm evening light.' : 'Soft afternoon light.';
  engine?.invalidate();
});
viewButton.addEventListener('click', () => {
  close = !close;
  viewButton.setAttribute('aria-pressed', String(close));
  viewButton.setAttribute('aria-label', close ? 'Return to the whole desk' : 'Look closer at the desk');
  room.classList.toggle('is-close', close);
  status.textContent = close ? 'A closer view of the painted wood grain.' : 'The whole writing desk.';
  engine?.invalidate();
});

async function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4c7cd');
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 70);
  camera.position.set(0, 16, 9.2);
  const target = new THREE.Vector3(0, -.15, .1);
  camera.lookAt(target);
  createEnvironment(renderer, scene);
  const hemisphere = new THREE.HemisphereLight('#fff8ea', '#7c7964', 2.1);
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#fff4db', 3.0);
  sunlight.position.set(-7, 11, -5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: .5, far: 35 });
  sunlight.shadow.bias = -.0003;
  sunlight.shadow.normalBias = .025;
  sunlight.shadow.radius = 4;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight('#dce3eb', .65);
  fill.position.set(5, 6, 6);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#dcb9c3', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.52;
  floor.receiveShadow = true;
  scene.add(floor, createContactShadow());
  const [desk, carpet] = await Promise.all([createDesk(renderer), createCarpet(renderer)]);
  scene.add(desk.group, carpet);
  const windowShadow = createWindowShadow();
  desk.group.add(windowShadow);
  renderer.shadowMap.needsUpdate = true;

  let width = 0, height = 0, frame = 0, lastTime = 0;
  let currentLight = 0, currentZoom = 1;
  const pointer = new THREE.Vector2();
  const currentPointer = new THREE.Vector2();
  const afternoon = new THREE.Color('#fff4db');
  const dusk = new THREE.Color('#ffd29a');
  const sky = new THREE.Color('#fff8ea');
  const duskSky = new THREE.Color('#d6c5ad');
  const coolFill = new THREE.Color('#dce3eb');
  const duskFill = new THREE.Color('#afbaca');

  function resize() {
    width = room.clientWidth; height = room.clientHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    // A portrait viewport is a close view across the same desk, not a tiny table.
    const viewHeight = aspect < 1 ? 10.6 : Math.max(10.15, 17.8 / aspect);
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function invalidate() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(now) {
    frame = 0;
    const delta = Math.min((now - (lastTime || now - 16)) / 1000, .05);
    lastTime = now;
    const factor = motionQuery.matches ? 1 : 1 - Math.exp(-delta * 5);
    const desiredLight = evening ? 1 : 0;
    const desiredZoom = close ? 1.40 : 1;
    currentLight = THREE.MathUtils.lerp(currentLight, desiredLight, factor);
    currentZoom = THREE.MathUtils.lerp(currentZoom, desiredZoom, factor);
    currentPointer.lerp(pointer, factor);
    sunlight.color.copy(afternoon).lerp(dusk, currentLight);
    sunlight.intensity = 3 - currentLight * 1.25;
    hemisphere.color.copy(sky).lerp(duskSky, currentLight);
    hemisphere.intensity = 2.1 - currentLight * .65;
    fill.color.copy(coolFill).lerp(duskFill, currentLight);
    renderer.toneMappingExposure = 1.22 - currentLight * .14;
    windowShadow.material.opacity = .9 - currentLight * .45;
    camera.zoom = currentZoom;
    camera.position.set(currentPointer.x * .22, 16 + currentPointer.y * .12, 9.2);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const unsettled = Math.abs(currentLight - desiredLight) > .0005 || Math.abs(currentZoom - desiredZoom) > .0005 || currentPointer.distanceToSquared(pointer) > .00001;
    if (unsettled) invalidate();
  }

  room.addEventListener('pointermove', event => {
    if (motionQuery.matches || !finePointer.matches || event.pointerType === 'touch') return;
    pointer.set((event.clientX / width - .5) * 2, (event.clientY / height - .5) * 2);
    invalidate();
  }, { passive: true });
  room.addEventListener('pointerleave', () => { pointer.set(0, 0); invalidate(); });
  motionQuery.addEventListener('change', () => { pointer.set(0, 0); invalidate(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { lastTime = 0; invalidate(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frame); frame = 0;
    room.classList.remove('is-ready');
    status.textContent = 'Showing the still desk while the graphics connection recovers.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer.shadowMap.needsUpdate = true;
    room.classList.add('is-ready');
    invalidate();
  });
  new ResizeObserver(resize).observe(room);
  resize();
  room.classList.add('is-ready');
  document.querySelector('.desk-controls').hidden = false;
  status.textContent = 'The writing room is ready.';
  return { invalidate };
}

init().then(result => { engine = result; }).catch(error => {
  console.error('The 3D desk could not be loaded:', error);
  room.classList.add('is-fallback');
  status.textContent = 'Showing a still version of the writing desk.';
  lightButton.disabled = true;
  viewButton.disabled = true;
  document.querySelector('.desk-controls').hidden = true;
});
