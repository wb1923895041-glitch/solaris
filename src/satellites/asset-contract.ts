import type {MoonAsset} from './moon-visual';
import type {SatelliteEphemeris} from './ephemeris';
export function validateMoonAssets(registry:{bodies:MoonAsset[]},satellites:SatelliteEphemeris){
 if(!Array.isArray(registry.bodies)||!registry.bodies.length||new Set(registry.bodies.map(a=>a.naifId)).size!==registry.bodies.length)throw Error('卫星资产清单不完整或有重复 ID');
 for(const a of registry.bodies){const meta=satellites.meta(a.naifId);if(a.parentPlanetId!==meta.parentPlanetId||a.meanRadiusKm!==meta.physical.radiusKm)throw Error('资产试图改写父体或真实半径');
  if(!['sphere-y-up','native-body-fixed-xyz'].includes(a.meshFrame)||a.orientationModel!=='IAU_GENERIC_APPROX'||!a.reconstructionNotes||!a.albedo.rights||!a.albedo.uri.startsWith('https://'))throw Error('资产参考轴、来源或重建说明缺失');
  if(a.shapeType==='irregular-mesh'&&(!a.geometry?.indexFile||a.meshFrame!=='native-body-fixed-xyz'))throw Error('不规则体必须使用本体固定坐标的实测网格');
  for(const lod of a.lods){if(!lod.url.startsWith('/assets/moons/'+a.naifId+'/')||!/^[a-f0-9]{64}$/.test(lod.sha256)||!Number.isInteger(lod.width)||lod.width<1||lod.height!==Math.floor(lod.width/2))throw Error('纹理 LOD 契约错误');}
 }
}
/** Registry and attitude manifests shared by the 3B bench and the 3C local systems. */
export async function loadMoonResources(satellites:SatelliteEphemeris){const [a,b]=await Promise.all([fetch('/assets/moons/manifest.json'),fetch('/assets/moons/orientation/manifest.json')]);if(!a.ok||!b.ok)throw Error('卫星资产清单未就绪');const registry=await a.json(),orientation=await b.json();validateMoonAssets(registry,satellites);return {registry,orientation};}
