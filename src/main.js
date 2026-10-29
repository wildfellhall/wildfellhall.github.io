import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createDesk, createEnvironment, createFloor, DESK } from './desk.js';
import { createCarpet } from './ornaments.js';
import { createDeskInteraction } from './desk-interaction.js';
import { createControlFrame } from './control-frame.js';
import { createBook } from './book.js';
import { createGazette, connectArchive } from './gazette.js';
import { applyWoodCoordinates } from './wood-finish.js';
import { parseBookText } from './book-text.js';

const room = document.querySelector('#room'), canvas = document.querySelector('#desk');
const status = document.querySelector('#render-status');
const bookText = fetch(`${import.meta.env.BASE_URL}book.txt`, { cache: 'no-cache' }).then(response => {
  if (!response.ok) throw new Error(`Book text: HTTP ${response.status}`);
  return response.text();
}).catch(error => { console.warn('The book text could not be loaded; keeping its decorated pages:', error); return ''; });
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
function setDetail(value) {
  close = value;
  viewButton.setAttribute('aria-pressed', String(close));
  viewButton.setAttribute('aria-label', close ? 'Return to the whole desk' : 'Look closer at the desk');
  room.classList.toggle('is-close', close);
  status.textContent = close ? 'A closer view of the carved drawers, porcelain knobs, and cabriole legs.' : 'An elevated view of the antique writing desk.';
  engine?.invalidate();
}
viewButton.addEventListener('click', () => setDetail(!close));

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
  // Keep the tabletop prominent while revealing the frieze and carved knees.
  // The detail view lowers the eye to the drawer fronts instead of zooming
  // further into an empty patch of the writing surface.
  const baseTarget = new THREE.Vector3(0, -2.3, 0);
  const overviewDirection = new THREE.Vector3(0, 22, 17).normalize();
  const detailDirection = new THREE.Vector3(0, 15, 23).normalize();
  let environment = createEnvironment(renderer, scene);
  const hemisphere = new THREE.HemisphereLight('#e9edf1', '#8d7561', .42);
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#fff0d6', 3.0);
  sunlight.position.set(-11, 9, 8);
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
    light.position.set(-11 + Math.cos(a) * 1.6, 9 + Math.sin(a) * 1.8, 8 + Math.cos(a) * 1.2);
    windowLights.push(light); scene.add(light);
  }
  const fill = new THREE.DirectionalLight('#dfe7ee', .32);
  fill.position.set(9, 3, 7); scene.add(fill);
  const rim = new THREE.DirectionalLight('#fff3e3', .45);
  rim.position.set(-2, 6, -8); scene.add(rim);
  const [desk, carpet, book, gazette] = await Promise.all([createDesk(renderer), createCarpet(renderer), bookText.then(text => createBook(DESK.surfaceY, text, renderer.capabilities.maxTextureSize)), createGazette(DESK.surfaceY, renderer.capabilities.maxTextureSize).catch(error => { console.warn('Gazette unavailable:', error); return null; })]);
  const controlFrame = await createControlFrame(document.querySelector('.desk-controls')).catch(error => {
    console.warn('Using the still metal frame:', error);
    return null;
  });
  // A room-size carpet keeps the elevated composition on the blush textile.
  carpet.scale.set(1.85, 1, 1.85); carpet.position.z = -3;
  const furniture = new THREE.Group(); furniture.add(createFloor(), carpet, desk.group);
  // Continue the desktop's actual grain field beneath the close reading view.
  const readingGround = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), desk.surfaceMaterial);
  readingGround.rotation.x = -Math.PI / 2; readingGround.position.y = DESK.surfaceY;
  applyWoodCoordinates(readingGround);
  readingGround.receiveShadow = true; readingGround.visible = false;
  scene.add(furniture, book.group, readingGround);
  if (gazette) scene.add(gazette.group);
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
  let graphicsAvailable = true;
  let currentLight = 0, currentDetail = 0, wasReading = false;
  const pointer = new THREE.Vector2(), currentPointer = new THREE.Vector2();
  const interaction = createDeskInteraction({ canvas, room, camera, desk, book, gazette, status, invalidate, resetView: () => {
    setDetail(false); pointer.set(0, 0); currentPointer.set(0, 0);
  } });
  const afternoon = new THREE.Color('#fff0d6'), dusk = new THREE.Color('#ffcb94');
  const sky = new THREE.Color('#e9edf1'), duskSky = new THREE.Color('#b9c0d0');
  function resize() {
    width = room.clientWidth; height = room.clientHeight;
    renderer.setSize(width, height, false); composer.setSize(width, height);
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }
  function invalidate() { if (!frame && !document.hidden && graphicsAvailable) frame = requestAnimationFrame(render); }
  function render(now) {
    frame = 0;
    const delta = Math.min((now - (lastTime || now - 16)) / 1000, .05); lastTime = now;
    const factor = motionQuery.matches ? 1 : 1 - Math.exp(-delta * 6);
    const desiredLight = evening ? 1 : 0, desiredDetail = close ? 1 : 0;
    currentLight = THREE.MathUtils.lerp(currentLight, desiredLight, factor);
    currentDetail = THREE.MathUtils.lerp(currentDetail, desiredDetail, factor);
    currentPointer.lerp(pointer, factor);
    for (const light of windowLights) {
      light.color.copy(afternoon).lerp(dusk, currentLight);
      light.intensity = (3.05 - currentLight * .95) / windowLights.length;
    }
    hemisphere.color.copy(sky).lerp(duskSky, currentLight);
    hemisphere.intensity = .42 - currentLight * .10;
    renderer.toneMappingExposure = .94 - currentLight * .06;
    // Place the publications from this frame's settled state, including when
    // reduced motion completes an opening in a single frame.
    const drawers = interaction.animateDrawers(delta, motionQuery.matches);
    const pages = book.animate(delta, motionQuery.matches);
    const newspaper = gazette?.animate(delta, motionQuery.matches);
    // A narrow carpet surround on desktop; portrait crops the sides instead
    // of shrinking the writing surface into the middle of a large floor.
    const aspect = width / height, viewHeight = Math.min(12.2, Math.max(11.6, 17.6 / aspect));
    camera.left = -viewHeight * aspect / 2; camera.right = -camera.left;
    camera.top = viewHeight / 2; camera.bottom = -camera.top;
    if (!interaction.reading) { book.place(viewHeight * aspect, aspect <= .75); gazette?.place(viewHeight * aspect, aspect <= .75); }
    book.group.visible = interaction.readingPublication !== 'gazette';
    if (gazette) { gazette.group.visible = interaction.readingPublication !== 'book'; gazette.twine.visible = !interaction.reading; }
    furniture.visible = !interaction.reading; readingGround.visible = interaction.reading;
    if (wasReading !== interaction.reading) { renderer.shadowMap.needsUpdate = true; wasReading = interaction.reading; }
    const target = baseTarget.clone();
    target.x += currentPointer.x * .07;
    target.y -= currentDetail * .15;
    target.z += currentPointer.y * .05 + currentDetail * 1.2;
    const direction = overviewDirection.clone().lerp(detailDirection, currentDetail).normalize();
    interaction.applyCamera(target, direction, currentDetail);
    camera.position.copy(target).addScaledVector(direction, 28);
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (drawers.changed || pages.changed || newspaper?.changed) renderer.shadowMap.needsUpdate = true;
    composer.render();
    controlFrame?.render(currentLight);
    interaction.projectButtons();
    const unsettled = Math.abs(currentLight - desiredLight) > .0005 || Math.abs(currentDetail - desiredDetail) > .0005 || currentPointer.distanceToSquared(pointer) > .00001;
    if (unsettled || drawers.unsettled || pages.unsettled || newspaper?.unsettled) invalidate();
  }
  room.addEventListener('pointermove', event => {
    if (interaction.reading || interaction.dragging || motionQuery.matches || !finePointer.matches || event.pointerType === 'touch') return;
    pointer.set((event.clientX / width - .5) * 2, (event.clientY / height - .5) * 2); invalidate();
  }, { passive: true });
  room.addEventListener('pointerleave', () => { pointer.set(0, 0); invalidate(); });
  canvas.addEventListener('pointerdown', () => {
    if (pointer.lengthSq() || currentPointer.lengthSq()) { pointer.set(0, 0); invalidate(); }
  });
  motionQuery.addEventListener('change', () => { pointer.set(0, 0); invalidate(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { lastTime = 0; invalidate(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); graphicsAvailable = false; cancelAnimationFrame(frame); frame = 0;
    interaction.setEnabled(false);
    room.classList.remove('is-ready'); document.querySelector('.desk-controls').hidden = true;
    status.textContent = 'Showing the still desk while the graphics connection recovers.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    graphicsAvailable = true; lastTime = 0;
    // Environment render targets lose their pixels with the context. Rebuild
    // the room reflections so the gilt and leather recover with the geometry.
    environment.dispose(); environment = createEnvironment(renderer, scene);
    renderer.shadowMap.needsUpdate = true; room.classList.add('is-ready');
    interaction.setEnabled(true); document.querySelector('.desk-controls').hidden = false; invalidate();
    status.textContent = 'The writing room is ready.';
  });
  new ResizeObserver(resize).observe(room); resize();
  render(performance.now());
  room.classList.add('is-ready'); document.querySelector('.desk-controls').hidden = false;
  interaction.setEnabled(true);
  status.textContent = 'The writing room is ready.';
  return { invalidate };
}
init().then(result => { engine = result; }).catch(error => {
  console.error('The 3D desk could not be loaded:', error);
  room.classList.add('is-fallback');
  connectArchive({ status, fallback: true });
  status.textContent = 'Showing a still version of the writing desk.';
  lightButton.disabled = viewButton.disabled = true;
  document.querySelector('.desk-controls').hidden = true;
  document.querySelector('#drawer-controls').hidden = true;
  document.querySelector('#book-controls').hidden = true;
  bookText.then(text => {
    const transcript = document.querySelector('#book-transcript'); transcript.replaceChildren();
    transcript.setAttribute('aria-label', 'Book text');
    for (const block of parseBookText(text)) if (block.type === 'paragraph') {
      const p = document.createElement('p'); p.textContent = block.text; transcript.append(p);
    }
    transcript.hidden = !transcript.childElementCount;
  });
});
