import {EphemerisProvider,type Manifest,type ObjectMeta} from '../science/ephemeris';
import {findEclipses} from './events';
/** Off-main-thread eclipse scan. Uses the unchanged phase-1 Hermite evaluator bound to copies of the Sun, Earth
 * (SSB) and Moon (geocentric, 3A) buffers; the main thread's ephemerides are never modified. */
type Job={planets:{manifest:Manifest;sun:ObjectMeta;earth:ObjectMeta;sunBuffer:Float64Array;earthBuffer:Float64Array};moon:{meta:ObjectMeta;buffer:Float64Array;startTdb:number;endTdb:number};start:number;end:number};
self.onmessage=(e:MessageEvent<Job>)=>{
 try{
  const j=e.data,t0=performance.now();
  const planets={manifest:{...j.planets.manifest,objects:[j.planets.sun,j.planets.earth]},buffers:new Map([[j.planets.sun.id,j.planets.sunBuffer],[j.planets.earth.id,j.planets.earthBuffer]]),state:EphemerisProvider.prototype.state};
  const moon={manifest:{...j.planets.manifest,startTdb:j.moon.startTdb,endTdb:j.moon.endTdb,objects:[j.moon.meta]},buffers:new Map([[j.moon.meta.id,j.moon.buffer]]),state:EphemerisProvider.prototype.state};
  const g={sun:(t:number)=>{const s=planets.state('10',t).positionKm,x=planets.state('399',t).positionKm;return [s[0]-x[0],s[1]-x[1],s[2]-x[2]] as const;},moon:(t:number)=>moon.state('301',t).positionKm};
  const eclipses=findEclipses(g,j.start,j.end);(self as any).postMessage({eclipses,ms:performance.now()-t0});
 }catch(err){(self as any).postMessage({error:String(err)});}
};
