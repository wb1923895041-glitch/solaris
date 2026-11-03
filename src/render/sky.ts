import * as THREE from 'three';
import {axes} from '../science/coordinates';
/** Celestial map rendered before the planetary world, so it can never occlude a planet. */
export class CelestialSky{
 readonly scene=new THREE.Scene();status='loading';
 constructor(){
  const uniforms={uMap:{value:new THREE.Texture()}};
  const material=new THREE.ShaderMaterial({uniforms,side:THREE.BackSide,depthTest:false,depthWrite:false,vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   #include <common>
   varying vec3 vDirection;uniform sampler2D uMap;
   void main(){vec3 n=normalize(vDirection);vec2 uv=vec2(.5-atan(n.y,n.x)/(2.*PI),.5+asin(n.z)/PI);vec3 sky=texture2D(uMap,uv).rgb;gl_FragColor=vec4(sky*.18+vec3(.0008,.0015,.0025),1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(100,64,32),material);const a=axes([1,0,0]),b=axes([0,1,0]),c=axes([0,0,1]);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...a),new THREE.Vector3(...b),new THREE.Vector3(...c)));mesh.frustumCulled=false;this.scene.add(mesh);
  new THREE.TextureLoader().load('/assets/sky/nasa-stars-4k.jpg',t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;uniforms.uMap.value=t;this.status='ready';},undefined,()=>{this.status='error';});
 }
}
