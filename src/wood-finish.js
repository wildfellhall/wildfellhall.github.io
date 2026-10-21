import * as THREE from 'three';

// Blend three spatial projections through rounded corners. The grain belongs
// to the timber, not to separate UV islands on each bevel, leaf or wall.
export function continuousWood(material, scale = 6.4) {
  material.userData.continuousWood = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.woodScale = { value: scale };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      attribute vec3 woodPosition;
      attribute vec3 woodNormal;
      varying vec3 vWoodPosition;
      varying vec3 vWoodNormal;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vWoodPosition = woodPosition;
      vWoodNormal = woodNormal;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float woodScale;
      varying vec3 vWoodPosition;
      varying vec3 vWoodNormal;
      vec4 woodSample(sampler2D woodMap) {
        vec3 weights = pow(abs(normalize(vWoodNormal)), vec3(4.0));
        weights /= max(dot(weights, vec3(1.0)), 0.0001);
        vec3 p = vWoodPosition / woodScale + vec3(0.5);
        return texture2D(woodMap, p.zy) * weights.x
             + texture2D(woodMap, p.xz) * weights.y
             + texture2D(woodMap, p.xy) * weights.z;
      }
    `).replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'woodSample(map)'))
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'woodSample(roughnessMap)'))
      .replace('#include <bumpmap_pars_fragment>', `
        #include <bumpmap_pars_fragment>
        vec2 woodGradient() {
          float height = woodSample(bumpMap).x * bumpScale;
          return vec2(dFdx(height), dFdy(height));
        }
      `).replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('dHdxy_fwd()', 'woodGradient()'));
  };
  material.customProgramCacheKey = () => `continuous-painted-wood-${scale}`;
  return material;
}

export function applyWoodCoordinates(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(material => material.userData.continuousWood)) return;
    // Bake the part's placement into a common grain field. A drawer's parent
    // can then slide without the wood texture drifting through its surface.
    object.updateMatrix();
    const geometry = object.geometry;
    const positions = geometry.attributes.position.clone();
    if (!materials.some(material => material.userData.localWood)) positions.applyMatrix4(object.matrix);
    geometry.setAttribute('woodPosition', positions);
    geometry.setAttribute('woodNormal', geometry.attributes.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(object.matrix)));
  });
}
