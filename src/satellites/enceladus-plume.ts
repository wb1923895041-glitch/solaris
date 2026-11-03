import * as THREE from 'three';

/** Teaching-only schematic of the south-polar jets: static, off by default, not an observation of any epoch. */
export function enceladusPlume(polarRadiusRatio:number){
 // Four parallel tiger-stripe fractures (~35 km apart, ~130 km long) in the south-polar tangent plane, body-fixed +Z north.
 let seed=602;const random=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
 const radiusKm=252.1,count=12000,positions=new Float32Array(count*3),alphas=new Float32Array(count),along=new THREE.Vector3(Math.SQRT1_2,Math.SQRT1_2,0),across=new THREE.Vector3(-Math.SQRT1_2,Math.SQRT1_2,0);
 for(let i=0;i<count;i++){
  const stripe=Math.floor(random()*4),base=along.clone().multiplyScalar((random()-.5)*130/radiusKm).addScaledVector(across,(stripe-1.5)*35/radiusKm);base.z=-polarRadiusRatio;
  const height=-Math.log(1-random()*.985)*.32,spread=.26*(random()-.5),tilt=.26*(random()-.5);
  const p=base.clone().addScaledVector(across,spread*height).addScaledVector(along,tilt*height);p.z-=height;positions.set([p.x,p.y,p.z],i*3);alphas[i]=Math.exp(-height*2.2);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('alpha',new THREE.BufferAttribute(alphas,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{sunDirection:{value:new THREE.Vector3(1,0,0)},uPointScale:{value:1}},vertexShader:`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float alpha;varying float vAlpha;uniform float uPointScale;
  void main(){vAlpha=alpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(36.0*uPointScale/-p.z,2.0,12.0);gl_Position=projectionMatrix*p;
  #include <logdepthbuf_vertex>
  }
 `,fragmentShader:`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying float vAlpha;
  void main(){
   #include <logdepthbuf_fragment>
   vec2 c=gl_PointCoord-.5;float d=1.0-smoothstep(0.0,.5,length(c));gl_FragColor=vec4(vec3(.72,.82,.9)*vAlpha*d*.022,1.0);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }
 `});
 const plume=new THREE.Points(geometry,material);plume.name='enceladus-plume-teaching-schematic';plume.visible=false;return plume;
}
