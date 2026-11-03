"""Convert SBMT observed SPC meshes, preserving native kilometres and IAU axes."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,zipfile,io,sys
import numpy as np
ROOT=Path(__file__).resolve().parent.parent;raw=ROOT/'data/phase-3b/raw';base=ROOT/'public/assets/moons'
id=sys.argv[1] if len(sys.argv)>1 else '401'
stem={'401':'phobos_g_148m_spc_obj_0000n00000_v004','402':'deimos_g_083m_spc_obj_0000n00000_v002'}[id]
catalog=json.loads((ROOT/'data/phase-3a/manifest.json').read_text(encoding='utf8'));body=next(b for b in catalog['objects'] if b['id']==id)
dest=base/id;dest.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
archive=raw/(stem+'.obj.zip')
with zipfile.ZipFile(archive) as z:text=z.read(stem+'.obj').decode('utf8')
v=[];f=[]
for line in text.splitlines():
 if line.startswith('v '):v.append([float(x) for x in line.split()[1:4]])
 elif line.startswith('f '):
  ids=[int(x.split('/')[0])-1 for x in line.split()[1:]];assert len(ids)==3;f.append(ids)
vertices=np.asarray(v,dtype='<f4');faces=np.asarray(f,dtype='<u4');tri=vertices[faces].astype(float)
assert vertices.shape==(98306,3) and faces.shape==(196608,3)
area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5
volume=np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6
edges=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True)
assert np.isfinite(vertices).all() and area.min()>0 and volume>0 and (counts==2).all()
vertex=dest/'vertices-km.f32';index=dest/'indices.u32';vertex.write_bytes(vertices.tobytes());index.write_bytes(faces.tobytes())
csv=raw/(stem+'.csv.zip')
with zipfile.ZipFile(csv) as z:table=np.loadtxt(io.BytesIO(z.read(stem+'.csv')),delimiter=',',skiprows=2)
assert np.max(np.abs(table[:,:3]-tri.mean(axis=1)))<1e-5,'Facet-order registration mismatch'
albedo=table[:,-1];valid=np.isfinite(albedo)&(albedo>=0)&(albedo<=1)
geometry=dict(file='/assets/moons/'+id+'/'+vertex.name,sha256=sha(vertex),indexFile='/assets/moons/'+id+'/'+index.name,indexSha256=sha(index),vertexCount=len(vertices),indexCount=faces.size,units='native body-fixed XYZ km; no axis swap, recentering or radius fitting',rawPath=archive.relative_to(ROOT).as_posix(),rawSha256=sha(archive),labelPath=(raw/(stem+'.lbl')).relative_to(ROOT).as_posix(),labelSha256=sha(raw/(stem+'.lbl')),boundsKm=[vertices.min(axis=0).tolist(),vertices.max(axis=0).tolist()])
if valid.any():
 # Source Albedo is per triangular facet. Area-weighted interpolation to the
 # shared vertices preserves its registration and avoids artificial facets.
 a=np.where(valid,albedo,np.median(albedo[valid]));sums=np.zeros(len(vertices));weights=np.zeros(len(vertices))
 for j in range(3):np.add.at(sums,faces[:,j],a*area);np.add.at(weights,faces[:,j],area)
 colors=np.repeat((sums/weights)[:,None],3,axis=1).astype('<f4');file=dest/'observed-albedo.f32';file.write_bytes(colors.tobytes());geometry.update(colorFile='/assets/moons/'+id+'/'+file.name,colorSha256=sha(file))
notes='SPC 实测形状与逐面反照率；反照率按三角面面积插值到顶点。' if valid.any() else 'SPC 实测形状；源 CSV 的 Albedo 全部缺测，表面采用均匀灰色观察重建，不声称拥有实测全球颜色贴图。'
report=dict(id=id,vertices=len(vertices),triangles=len(faces),closedManifold=True,outwardVolumeKm3=float(volume),volumeEquivalentRadiusKm=float((volume*3/(4*np.pi))**(1/3)),sourceAlbedoSamples=int(valid.sum()),missingAlbedoSamples=int((~valid).sum()),albedoRange=[float(albedo[valid].min()),float(albedo[valid].max())] if valid.any() else None,facetRegistrationMaxKm=float(np.max(np.abs(table[:,:3]-tri.mean(axis=1)))),boundsKm=geometry['boundsKm'])
asset=dict(naifId=id,displayNameZh=body['zh'],displayNameEn=body['name'],parentPlanetId='499',version='3b-'+id+'-spc-v1',kind='spc-observed-albedo' if valid.any() else 'spc-unmapped-surface',shapeType='irregular-mesh',meanRadiusKm=body['physical']['radiusKm'],geometrySource=dict(title=stem,provider='JHUAPL SBMT / Ernst et al. 2023',uri='https://sbmt.jhuapl.edu/shared-files/',publication='https://doi.org/10.1186/s40623-023-01814-7',rights='Publicly downloadable research data. SBMT requests acknowledgement; no separate data redistribution license stated on the download page. Retain author/model and SBMT citation.'),albedo=dict(title='SPC 逐三角面反照率' if valid.any() else '无全球实测反照率：均匀灰色重建',provider='JHUAPL SBMT / Ernst et al. 2023',uri='https://sbmt.jhuapl.edu/shared-files/',observationEpoch='Multi-mission SPC; '+('PCK11 migrated 2026-01-31 product' if id=='401' else '2025-03-10 product'),rights='Acknowledge SBMT and Ernst et al. 2023. Research download; standalone redistribution license not stated.',colorProcessing='实测反照率作为线性 RGB 的中性灰亮度；不添加虚构彩色地貌。' if valid.any() else '均匀灰色为可见性重建；不添加随机噪声、伪造陨石坑或光学地貌。',projection='Native body-fixed mesh; X-Y longitude / +Z north; no spherical texture projection',processingCategory='OBSERVED_SHAPE_AND_ALBEDO' if valid.any() else 'OBSERVED_SHAPE_RECONSTRUCTED_UNIFORM_COLOR',rawPath=csv.relative_to(ROOT).as_posix(),rawSha256=sha(csv)),lods=[],geometry=geometry,material=dict(roughness=1,metalness=0,tint='#ffffff' if valid.any() else '#777674'),meshFrame='native-body-fixed-xyz',orientationModel='IAU_GENERIC_APPROX',surfaceRegistration='PCK11_NATIVE_SHAPE_FRAME' if id=='401' else 'NATIVE_IAU_SHAPE_GENERIC_PCK_APPROX',reconstructionNotes=notes,visualEnhancements=['固定观察曝光；不模拟真实相机辐射定标','可选观察补光，默认关闭'],limitations=['网格分辨率 '+('148 m' if id=='401' else '83 m')+'；不得据此声称更细地形','通用 IAU PCK 姿态，非导航级表面配准','独立数据再分发许可未明确，公开分发前需核对权利']+([] if valid.any() else ['缺少可靠全球颜色，材质颜色是明确标注的均匀重建']),verifiedAt=datetime.now(timezone.utc).isoformat())
(dest/'config.json').write_text(json.dumps(asset,ensure_ascii=False,indent=2)+'\n',encoding='utf8');m=json.loads((base/'manifest.json').read_text(encoding='utf8'));m['bodies']=[b for b in m['bodies'] if b['naifId']!=id]+[asset];(base/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8');(ROOT/f'docs/phase-3b/{id}-mesh-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
