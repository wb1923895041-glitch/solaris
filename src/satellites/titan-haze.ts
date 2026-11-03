import * as THREE from 'three';

/** Observation-informed display reconstruction, not a retrieved aerosol field. */
export function titanHaze(referenceRadiusKm:number){
 const geometry=new THREE.SphereGeometry(1+500/referenceRadiusKm,128,96);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{sunDirection:{value:new THREE.Vector3(1,0,0)}},vertexShader:`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 worldPoint; varying vec3 worldNormal;
  void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPoint=p.xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;
  #include <logdepthbuf_vertex>
  }
 `,fragmentShader:`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection;varying vec3 worldPoint;varying vec3 worldNormal;
  void main(){
   #include <logdepthbuf_fragment>
   vec3 n=normalize(worldNormal),v=normalize(cameraPosition-worldPoint);float mu=max(dot(n,v),0.0);float limb=pow(1.0-mu,4.5);float lit=smoothstep(-0.08,0.30,dot(n,sunDirection));
   float forward=pow(max(dot(-v,sunDirection),0.0),6.0);vec3 colour=mix(vec3(0.09,0.17,0.31),vec3(0.36,0.28,0.15),forward*.5);gl_FragColor=vec4(colour*(0.4+lit*.8),limb*lit*.38);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }
 `});
 const shell=new THREE.Mesh(geometry,material);shell.name='titan-visible-haze-reconstruction';return shell;
}
