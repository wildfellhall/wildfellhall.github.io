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
      vec4 woodSampleAt(sampler2D woodMap, vec3 position) {
        vec3 weights = pow(abs(normalize(vWoodNormal)), vec3(4.0));
        weights /= max(dot(weights, vec3(1.0)), 0.0001);
        vec3 p = position / woodScale + vec3(0.5);
        // Most timber is planar and needs only one projection. Explicit
        // derivatives keep mip selection stable where curved surfaces blend.
        vec3 dx = dFdx(p), dy = dFdy(p);
        vec4 sampleColor = vec4(0.0);
        if (weights.x > 0.00001) sampleColor += textureGrad(woodMap, p.zy, dx.zy, dy.zy) * weights.x;
        if (weights.y > 0.00001) sampleColor += textureGrad(woodMap, p.xz, dx.xz, dy.xz) * weights.y;
        if (weights.z > 0.00001) sampleColor += textureGrad(woodMap, p.xy, dx.xy, dy.xy) * weights.z;
        return sampleColor;
      }
      vec4 woodSample(sampler2D woodMap) {
        return woodSampleAt(woodMap, vWoodPosition);
      }
    `).replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'woodSample(map)'))
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'woodSample(roughnessMap)'))
      .replace('#include <bumpmap_pars_fragment>', `
        #include <bumpmap_pars_fragment>
        vec2 woodGradient() {
          // Centred samples avoid the paired-pixel stair steps of taking
          // screen derivatives directly from a high-frequency height value.
          vec3 dx = dFdx(vWoodPosition) * 0.5, dy = dFdy(vWoodPosition) * 0.5;
          float hx = woodSampleAt(bumpMap, vWoodPosition + dx).x - woodSampleAt(bumpMap, vWoodPosition - dx).x;
          float hy = woodSampleAt(bumpMap, vWoodPosition + dy).x - woodSampleAt(bumpMap, vWoodPosition - dy).x;
          return vec2(hx, hy) * bumpScale;
        }
        vec3 woodReliefNormal(vec3 surfacePosition, vec3 surfaceNormal, float facing) {
          // Keep physical pixel lengths: normalizing these derivatives makes
          // a shallow groove flatten as the camera zooms closer to the wood.
          vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
          vec3 r1 = cross(dy, surfaceNormal), r2 = cross(surfaceNormal, dx);
          float determinant = dot(dx, r1) * facing;
          vec2 heightGradient = woodGradient();
          vec3 gradient = sign(determinant) * (heightGradient.x * r1 + heightGradient.y * r2);
          return normalize(max(abs(determinant), 0.00000001) * surfaceNormal - gradient);
        }
      `).replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(
        'perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection )',
        'woodReliefNormal( - vViewPosition, normal, faceDirection )',
      ));
  };
  material.customProgramCacheKey = () => `continuous-painted-wood-relief-${scale}`;
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
