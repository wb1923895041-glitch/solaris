import * as THREE from 'three';
/** Opt-in diagnostic queries; no scientific state is consumed or changed. */
export class RenderProfiler{
 enabled=false;readonly cpuMs:number[]=[];readonly gpuMs:number[]=[];
 additionalDrawCalls=0;
 private pending:WebGLQuery[]=[];private active:WebGLQuery|null=null;private frame=0;private started=0;
 private gl:WebGL2RenderingContext;private ext:any;
 constructor(private renderer:THREE.WebGLRenderer){this.gl=renderer.getContext() as WebGL2RenderingContext;this.ext=this.gl.getExtension('EXT_disjoint_timer_query_webgl2');}
 begin(){if(!this.enabled)return;this.started=performance.now();const gl=this.gl;
  while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=this.pending.shift()!;if(!gl.getParameter(this.ext.GPU_DISJOINT_EXT)){this.gpuMs.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);if(this.gpuMs.length>600)this.gpuMs.shift();}gl.deleteQuery(q);}
  if(this.ext&&this.frame++%4===0&&this.pending.length<12){this.active=gl.createQuery();gl.beginQuery(this.ext.TIME_ELAPSED_EXT,this.active);}
 }
 end(){if(!this.enabled)return;this.cpuMs.push(performance.now()-this.started);if(this.cpuMs.length>600)this.cpuMs.shift();if(this.active){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=null;}}
 snapshot(){const gl=this.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');const describe=(a:number[])=>{const b=[...a].sort((x,y)=>x-y);return {samples:b.length,p50Ms:b[Math.floor(b.length*.5)]??null,p95Ms:b[Math.floor(b.length*.95)]??null};};return {gpuTimerAvailable:!!this.ext,gpuRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gpuVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,cpuRender:describe(this.cpuMs),gpuRender:describe(this.gpuMs),gpuMemoryObjectCounts:{...this.renderer.info.memory},drawCalls:this.renderer.info.render.calls+this.additionalDrawCalls,triangles:this.renderer.info.render.triangles};}
 reset(){for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];this.cpuMs.length=0;this.gpuMs.length=0;this.enabled=true;}
}
