import * as THREE from 'three';

// The room's broad shadows cannot resolve millimetre-high lettering. Sample
// visibility around the actual crest geometry in its own coordinate system,
// then retain a CPU copy so the contact shading survives WebGL context loss.
export function crestContactTexture(renderer, crest) {
  const field = crest.getObjectByName('worked-metal-field');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-2.30, 2.30, .555, -.555, .1, 12);
  camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0);
  const receiverMaterial = new THREE.ShadowMaterial({ color: '#000000', opacity: .14, depthWrite: false });
  const receiver = new THREE.Mesh(field.geometry, receiverMaterial); receiver.receiveShadow = true; scene.add(receiver);
  const invisible = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const object of crest.children) {
    if (!object.isMesh || object === field || object.name === 'solid-oval-plaque') continue;
    const caster = object.clone(); caster.material = invisible;
    caster.castShadow = true; caster.receiveShadow = false; scene.add(caster);
  }
  const light = new THREE.DirectionalLight('#ffffff', 1); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 });
  light.shadow.bias = -.000015; light.shadow.normalBias = .0004; light.shadow.radius = 2;
  scene.add(light, light.target);
  const width = 1024, height = 256;
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
  const state = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, toneMapping: renderer.toneMapping,
    colourSpace: renderer.outputColorSpace, shadowType: renderer.shadowMap.type,
    shadows: renderer.shadowMap.enabled, autoShadows: renderer.shadowMap.autoUpdate };
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target); renderer.setClearColor('#ffffff', 1); renderer.clear();
    renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const radius = i % 2 ? 3.4 : 4.3, z = i % 2 ? 5.3 : 3.8;
      light.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
    }
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    renderer.setRenderTarget(state.target); renderer.setClearColor(state.clear, state.alpha);
    renderer.autoClear = state.autoClear; renderer.toneMapping = state.toneMapping;
    renderer.outputColorSpace = state.colourSpace; renderer.shadowMap.type = state.shadowType;
    renderer.shadowMap.enabled = state.shadows; renderer.shadowMap.autoUpdate = state.autoShadows;
    renderer.shadowMap.needsUpdate = true;
    target.dispose(); light.shadow.dispose(); receiverMaterial.dispose(); invisible.dispose();
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}
