import * as THREE from 'three';
import type {Body} from '../science/catalog';
// Deterministic, spherical 3D value noise avoids UV seams. Illustrative material only.
function hash(x:number,y:number,z:number){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x:number,y:number,z:number){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let a=x-ix,b=y-iy,c=z-iz;a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c);const lerp=(x:number,y:number,t:number)=>x+(y-x)*t;return lerp(lerp(lerp(hash(ix,iy,iz),hash(ix+1,iy,iz),a),lerp(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),a),b),lerp(lerp(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),a),lerp(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),a),b),c);}
export function proceduralTexture(body:Body){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d')!,image=ctx.createImageData(1024,512),base=new THREE.Color(body.color);base.convertLinearToSRGB();
 const rgb=[base.r*255,base.g*255,base.b*255],gas=['299','599','699','799','899'].includes(body.id),seed=Number(body.id)*.17;
 for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
  const u=x/1024*Math.PI*2,v=y/512*Math.PI,sx=Math.sin(v)*Math.cos(u),sy=Math.cos(v),sz=Math.sin(v)*Math.sin(u);
  const n=noise(sx*7+seed,sy*7,sz*7),detail=noise(sx*60+seed,sy*60,sz*60);
  let k=.63+.45*n+.14*detail;
  if(gas)k=.8+.13*Math.sin(v*(body.id==='599'?34:19)+(n-.5)*1.6)+.06*Math.sin(v*77+2*n)+.04*detail;
  if(body.id==='299')k=.83+.2*n+.025*Math.sin(v*9+n);
  if(body.id==='799')k=.94+.035*Math.sin(v*15+n)+.02*detail;
  if(body.id==='10')k=.6+.32*noise(sx*42,sy*42,sz*42)+.17*noise(sx*110,sy*110,sz*110);
  const i=(y*1024+x)*4;rgb.forEach((c,j)=>image.data[i+j]=Math.min(255,Math.max(0,c*k)));image.data[i+3]=255;
  if(body.id==='499'&&Math.abs(sy)>.985){image.data[i]=190;image.data[i+1]=178;image.data[i+2]=162;}
  if(body.id==='599'){
   const d=Math.atan2(Math.sin(u-1),Math.cos(u-1));const spot=Math.exp(-((d/.24)**2+((v-1.82)/.075)**2));
   image.data[i]=image.data[i]*(1-spot)+175*spot;image.data[i+1]=image.data[i+1]*(1-spot)+99*spot;image.data[i+2]=image.data[i+2]*(1-spot)+66*spot;
  }
 }
 ctx.putImageData(image,0,0);
 if(!gas&&body.id!=='10'){
  let seed=Number(body.id);const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<170;i++){const x=random()*1024,y=30+random()*452,r=1+random()*9;ctx.strokeStyle='#271d1638';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(x,y,r,r*.65,0,0,Math.PI*2);ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;
 return{texture,thumbnail:canvas.toDataURL()};
}
export function glowTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!,g=x.createRadialGradient(128,128,0,128,128,128);
 g.addColorStop(0,'rgba(255,207,125,.85)');g.addColorStop(.13,'rgba(255,151,45,.4)');g.addColorStop(.38,'rgba(201,96,30,.07)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c);
}
