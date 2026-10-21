import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createDesk, createEnvironment, createFloor } from './desk.js';
import { createCarpet } from './ornaments.js';

const room = document.querySelector('#room'), canvas = document.querySelector('#desk');
const status = document.querySelector('#render-status');
const lightButton = document.querySelector('#light-toggle'), viewButton = document.querySelector('#view-toggle');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)'), finePointer = window.matchMedia('(pointer: fine)');
let evening = false, close = false, engine;
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
  status.textContent = close ? 'A closer overhead view of the writing surface.' : 'An overhead view of the writing desk.';
  engine?.invalidate();
});

async function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9afa0');
  scene.fog = new THREE.FogExp2('#b9afa0', .009);
  const camera = new THREE.OrthographicCamera(-8.2, 8.2, 5.7, -5.7, .1, 80);
  // The writing surface is the composition. Looking along -Y with -Z up
  // keeps every desktop edge square to the screen, including during motion.
  camera.up.set(0, 0, -1);
  const baseTarget = new THREE.Vector3(0, .203, 0);
  createEnvironment(renderer, scene);
  const hemisphere = new THREE.HemisphereLight('#e9edf1', '#8d7561', .72);
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#fff0d6', 3.0);
  sunlight.position.set(-8, 12, 10);
  sunlight.target.position.set(0, -2, 0);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: .5, far: 40 });
  sunlight.shadow.bias = -.00008;
  sunlight.shadow.normalBias = .018;
  sunlight.shadow.radius = 7;
  sunlight.shadow.blurSamples = 12;
  scene.add(sunlight, sunlight.target);
  // Sample a broad window opening: each light contributes a fraction of the
  // illumination, with independently filtered shadows for a soft penumbra.
  const windowLights = [sunlight];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const light = sunlight.clone();
    light.target = sunlight.target;
    light.position.set(-8 + Math.cos(a) * 2.1, 12 + Math.sin(a) * 2.5, 10 + Math.cos(a) * 1.6);
    windowLights.push(light); scene.add(light);
  }
  const fill = new THREE.DirectionalLight('#dfe7ee', .55);
  fill.position.set(9, 3, 7); scene.add(fill);
  const rim = new THREE.DirectionalLight('#fff3e3', .75);
  rim.position.set(-2, 6, -8); scene.add(rim);
  const [desk, carpet] = await Promise.all([createDesk(renderer), createCarpet(renderer)]);
  scene.add(createFloor(), carpet, desk.group);
  renderer.shadowMap.needsUpdate = true;

  // Small-scale occlusion makes the carved undercuts read without painting black outlines.
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 512, 512);
  ao.updateGtaoMaterial({ radius: .48, thickness: 1, distanceExponent: 1.6, scale: 1.20, samples: 16 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, samples: 16 });
  ao.blendIntensity = .80;
  composer.addPass(ao); composer.addPass(new OutputPass());

  let width = 0, height = 0, frame = 0, lastTime = 0;
  let currentLight = 0, currentZoom = 1;
  const pointer = new THREE.Vector2(), currentPointer = new THREE.Vector2();
  const afternoon = new THREE.Color('#fff0d6'), dusk = new THREE.Color('#ffcb94');
  const sky = new THREE.Color('#e9edf1'), duskSky = new THREE.Color('#b9c0d0');
  function resize() {
    width = room.clientWidth; height = room.clientHeight;
    renderer.setSize(width, height, false); composer.setSize(width, height);
    // A narrow carpet surround on desktop; portrait crops the sides instead
    // of shrinking the writing surface into the middle of a large floor.
    const aspect = width / height, viewHeight = Math.min(11.4, 16.4 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = -camera.left;
    camera.top = viewHeight / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function invalidate() { if (!frame && !document.hidden) frame = requestAnimationFrame(render); }
  function render(now) {
    frame = 0;
    const delta = Math.min((now - (lastTime || now - 16)) / 1000, .05); lastTime = now;
    const factor = motionQuery.matches ? 1 : 1 - Math.exp(-delta * 6);
    const desiredLight = evening ? 1 : 0, desiredZoom = close ? 1.30 : 1;
    currentLight = THREE.MathUtils.lerp(currentLight, desiredLight, factor);
    currentZoom = THREE.MathUtils.lerp(currentZoom, desiredZoom, factor);
    currentPointer.lerp(pointer, factor);
    for (const light of windowLights) {
      light.color.copy(afternoon).lerp(dusk, currentLight);
      light.intensity = (2.65 - currentLight * .95) / windowLights.length;
    }
    hemisphere.color.copy(sky).lerp(duskSky, currentLight);
    hemisphere.intensity = .72 - currentLight * .18;
    renderer.toneMappingExposure = .98 - currentLight * .08;
    const target = baseTarget.clone();
    target.x += currentPointer.x * .07;
    target.z += currentPointer.y * .05 - (currentZoom - 1) * 1.2;
    camera.position.copy(target).add(new THREE.Vector3(0, 24, 0));
    camera.lookAt(target); camera.zoom = currentZoom; camera.updateProjectionMatrix();
    composer.render();
    const unsettled = Math.abs(currentLight - desiredLight) > .0005 || Math.abs(currentZoom - desiredZoom) > .0005 || currentPointer.distanceToSquared(pointer) > .00001;
    if (unsettled) invalidate();
  }
  room.addEventListener('pointermove', event => {
    if (motionQuery.matches || !finePointer.matches || event.pointerType === 'touch') return;
    pointer.set((event.clientX / width - .5) * 2, (event.clientY / height - .5) * 2); invalidate();
  }, { passive: true });
  room.addEventListener('pointerleave', () => { pointer.set(0, 0); invalidate(); });
  motionQuery.addEventListener('change', () => { pointer.set(0, 0); invalidate(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { lastTime = 0; invalidate(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); cancelAnimationFrame(frame); frame = 0;
    room.classList.remove('is-ready'); document.querySelector('.desk-controls').hidden = true;
    status.textContent = 'Showing the still desk while the graphics connection recovers.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer.shadowMap.needsUpdate = true; room.classList.add('is-ready');
    document.querySelector('.desk-controls').hidden = false; invalidate();
  });
  new ResizeObserver(resize).observe(room); resize();
  render(performance.now());
  room.classList.add('is-ready'); document.querySelector('.desk-controls').hidden = false;
  status.textContent = 'The writing room is ready.';
  return { invalidate };
}
init().then(result => { engine = result; }).catch(error => {
  console.error('The 3D desk could not be loaded:', error);
  room.classList.add('is-fallback');
  status.textContent = 'Showing a still version of the writing desk.';
  lightButton.disabled = viewButton.disabled = true;
  document.querySelector('.desk-controls').hidden = true;
});
