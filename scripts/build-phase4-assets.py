"""Phase 4 surfaces (Pluto, Charon, Ceres) and the Pluto–Charon system record.

Same conventions as 3B: USGS GeoTIFF SimpleCylindrical affine inverse into an east-longitude −180…+180
equirectangular grid (prime meridian centred, +90 at top); missing coverage gets a flat blue-grey
classification colour, never invented terrain. Attitude: IAU frames from the frozen pck00011, sampled
and validated like 3B. Charon orbit statistics come from the Horizons cache only.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re, sys
import numpy as np, requests, spiceypy as spice
from PIL import Image
from scipy.ndimage import map_coordinates
from scipy.spatial.transform import Rotation, Slerp
Image.MAX_IMAGE_PIXELS=600_000_000
R=Path(__file__).resolve().parent.parent;RAW=R/'data/phase-4/raw/assets';RAW.mkdir(parents=True,exist_ok=True);BASE=R/'public/assets/smallbodies';(BASE/'orientation').mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,o):Path(p).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
MOSAIC='https://planetarymaps.usgs.gov/mosaic/'
SPECS={
 '999':dict(name='Pluto',zh='冥王星',frame='IAU_PLUTO',candidates=['Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif'],page='https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m',
  provider='NASA / JHUAPL / SwRI / USGS',title='New Horizons LORRI/MVIC global mosaic 300 m (July 2017)',epoch='New Horizons flyby, July 2015',north_unimaged=None,south_unimaged=-38,
  notes='2015 年飞掠仅高分辨率成像相遇半球；南纬约 38° 以南处于极夜未成像，标为未测。',color='保留 LORRI/MVIC 全色灰度；未叠加增强色。',kind='new-horizons-mosaic'),
 '901':dict(name='Charon',zh='卡戎',frame='IAU_CHARON',candidates=['Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif'],page='https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m',
  provider='NASA / JHUAPL / SwRI / USGS',title='New Horizons LORRI/MVIC global mosaic 300 m (July 2017)',epoch='New Horizons flyby, July 2015',north_unimaged=None,south_unimaged=-30,
  notes='相遇半球分辨率最高；南纬约 30° 以南处于极夜未成像，标为未测。',color='保留 LORRI/MVIC 全色灰度；未叠加增强色。',kind='new-horizons-mosaic'),
 '2000001':dict(name='Ceres',zh='谷神星',frame='IAU_CERES',candidates=['Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif'],page='https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m',
  provider='NASA / JPL-Caltech / UCLA / MPS / DLR / IDA / USGS',title='Dawn Framing Camera global mosaic 400 m (DLR, October 2015)',epoch='Dawn approach / survey orbit, 2015',north_unimaged=None,south_unimaged=None,
  notes='Dawn 接近与巡测阶段 400 m 全球拼图；拼图含原始入射光阴影，分辨率低于后期 HAMO/LAMO 产品。',color='保留 Framing Camera 全色灰度。',kind='dawn-mosaic'),
}
def head(url):
    for attempt in range(5):
        try:
            r=requests.head(url,timeout=90,allow_redirects=True)
            if r.status_code==200:return True,int(r.headers.get('content-length',0))
            if r.status_code==404:return False,0
        except requests.RequestException as e:print('probe retry',e,flush=True)
    return False,0
def download(id,spec):
    for name in spec['candidates']:
        url=MOSAIC+name;ok,size=head(url);print(id,'probe',name,ok,size,flush=True)
        if not ok:continue
        path=RAW/name;meta=path.with_suffix('.source.json')
        if not path.exists() or path.stat().st_size!=size:
            tmp=path.with_suffix('.part')
            while True:
                have=tmp.stat().st_size if tmp.exists() else 0
                if have>=size:break
                try:
                    with requests.get(url,stream=True,timeout=120,headers={'Range':f'bytes={have}-'}) as r:
                        r.raise_for_status();assert r.status_code==206 or have==0,'server ignored Range'
                        with open(tmp,'ab' if r.status_code==206 else 'wb') as f:
                            for chunk in r.iter_content(1<<20):f.write(chunk)
                except (requests.RequestException,AssertionError) as e:print('resume after',e,flush=True)
                print(id,'downloaded',tmp.stat().st_size,'/',size,flush=True)
            tmp.replace(path)
            write(meta,dict(url=url,bytes=path.stat().st_size,sha256=sha(path),retrievedAtUtc=datetime.now(timezone.utc).isoformat(),productPage=spec['page']))
        return path,json.loads(meta.read_text(encoding='utf-8'))
    raise SystemExit(f'No verified USGS product for {id}; refusing to substitute a non-scientific map.')
spice.furnsh(str(R/'data/phase-1/raw/naif0012.tls'));spice.furnsh(str(R/'data/phase-2/raw/pck00011.tpc'))
m4=json.loads((R/'data/phase-4/manifest.json').read_text(encoding='utf-8'));start,end=m4['startTdb'],m4['endTdb']
prev=json.loads((BASE/'manifest.json').read_text(encoding='utf-8')) if (BASE/'manifest.json').exists() else dict(bodies=[]);registry=dict(version='phase4-v1',bodies=[b for b in prev['bodies'] if b['naifId'] not in (sys.argv[1:] or SPECS)]);orient=dict(sourceUrl='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',pckSha256=sha(R/'data/phase-2/raw/pck00011.tpc'),toolkit=spice.tkvrsn('TOOLKIT'),model='IAU generic PCK: visual attitude approximation, not navigation-grade surface registration',startTdb=start,endTdb=end,format='little-endian Float32 XYZW, body-fixed IAU XYZ to ICRF/J2000-aligned axes',objects=[])
validation=[]
ORDER=sys.argv[1:] or ['2000001','901','999']
prevOrient=json.loads((BASE/'orientation/manifest.json').read_text(encoding='utf-8')) if (BASE/'orientation/manifest.json').exists() else dict(objects=[])
orient['objects']=[o for o in prevOrient['objects'] if o['bodyId'] not in ORDER]
for id in ORDER:
    spec=SPECS[id];path,src=download(id,spec);dest=BASE/id;dest.mkdir(exist_ok=True)
    im=Image.open(path);tag=im.tag_v2;assert 33550 in tag and 33922 in tag,'GeoTIFF georeferencing required'
    scale=tag[33550];tie=tag[33922];keys=tag[34735];params=tag[34736];geo={keys[i]:params[keys[i+3]] for i in range(4,len(keys),4) if keys[i+1]==34736}
    radius=geo[2057];central=geo.get(3088,0.0);w=4096 if im.width>=4096 else im.width;h=w//2
    lon=-180+(np.arange(w)+.5)*360/w;lat=90-(np.arange(h)+.5)*180/h;delta=(lon-central+180)%360-180
    sx=(radius*np.deg2rad(delta)-tie[3])/scale[0]-.5;sy=(tie[4]-radius*np.deg2rad(lat))/scale[1]-.5
    # Downsample the huge source first with box filtering on the source grid, then sample the georeferenced grid.
    factor=max(1,int(im.width//(w*2)));small=im.reduce(factor) if factor>1 else im;a=np.asarray(small).astype(np.float32)
    if a.ndim==3:a=a[:,:,:3].mean(axis=2)
    sxs=(sx+.5)/factor-.5;sys_=np.clip((sy+.5)/factor-.5,0,a.shape[0]-1);yy,xx=np.meshgrid(sys_,sxs,indexing='ij')
    g=map_coordinates(a,[yy,xx],order=1,mode='grid-wrap');valid=g>0
    if spec['south_unimaged'] is not None:valid[lat<spec['south_unimaged'],:]=False
    rgb=np.repeat(np.clip(g,0,255).astype(np.uint8)[:,:,None],3,axis=2);rgb[~valid]=[40,53,67]
    derived=Image.fromarray(rgb);mask=dest/'coverage.png';Image.fromarray(valid.astype('uint8')*255).save(mask)
    lods=[]
    for size in sorted({1024,2048,w}):
        f=dest/f'albedo-{size}.jpg';derived.resize((size,size//2),Image.Resampling.LANCZOS).save(f,quality=95,subsampling=0);lods.append(dict(width=size,height=size//2,url=f'/assets/smallbodies/{id}/{f.name}',sha256=sha(f)))
    axes=spice.bodvrd(id,'RADII',3)[1].tolist();meanR=float(np.cbrt(np.prod(axes)))
    sb=next(o for o in m4['objects'] if o['id']==id);phys=sb.get('physical') or {}
    if phys.get('diameter'):meanR=float(phys['diameter']['value'])/2
    missing=float(np.sum((~valid)*np.cos(np.deg2rad(lat))[:,None])/np.sum(np.cos(np.deg2rad(lat))[:,None]*np.ones_like(valid)))
    asset=dict(naifId=id,displayNameZh=spec['zh'],displayNameEn=spec['name'],parentPlanetId='999' if id=='901' else '10',version=f'4-{id}-mosaic-v1',kind=spec['kind'],shapeType='pck-ellipsoid',meanRadiusKm=meanR,meshFrame='sphere-y-up',
        geometry=dict(axesKm=axes,source=f'NAIF pck00011.tpc BODY{id}_RADII; mean radius {"SBDB diameter/2" if phys.get("diameter") else "cube root of PCK axes"}'),
        geometrySource=dict(provider='NASA/NAIF',title='IAU generic PCK triaxial radii',uri='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'),
        albedo=dict(title=spec['title'],provider=spec['provider'],uri=spec['page'],downloadUrl=src['url'],rawPath=path.relative_to(R).as_posix(),rawSha256=src['sha256'],observationEpoch=spec['epoch'],rights='NASA/USGS public product; retain mission and USGS Astrogeology credit (NASA media guidelines).',colorProcessing=spec['color'],projection='Equirectangular: +90 latitude at top; −180…+180 east longitude; prime meridian centred',processingCategory='OBSERVED_MONOCHROME',nativeDimensions=list(im.size)),
        lods=lods,coverage=dict(file=f'/assets/smallbodies/{id}/coverage.png',sha256=sha(mask),missingSurfaceFraction=missing,display='蓝灰色平整区域 = 未测 / 极夜未成像；非地形'),
        georeferencing=dict(method='GeoTIFF SimpleCylindrical affine inverse at output pixel centres',centralLongitudeEast=central,radiusMeters=radius,pixelScale=list(scale),tiePoint=list(tie),sourceReduceFactor=factor),
        material=dict(roughness=1,metalness=0,tint='#ffffff'),orientationModel='IAU_GENERIC_APPROX',surfaceRegistration='GRID_CONVENTION_DOCUMENTED_NOT_NAVIGATION',reconstructionNotes=spec['notes']+' 蓝灰色区域为未测，未加入虚构地貌。',
        visualEnhancements=['未测区蓝灰色分类标识','固定观察曝光；可选补光默认关闭'],limitations=['通用 IAU PCK 姿态；USGS 控制网与当前参考经线存在配准误差，非导航级','拼图含原始入射光阴影及接缝；没有从灰度臆造凹凸','单色源影像，未合成未观测颜色'],verifiedAt=datetime.now(timezone.utc).isoformat())
    write(dest/'config.json',asset);registry['bodies'].append(asset);write(BASE/'manifest.json',registry)
    # Attitude cache, validated off-grid against CSPICE like 3B.
    rng=np.random.default_rng(44000+int(id)%1000)
    for step in [3600,1800,900]:
        times=start+np.arange(int(np.ceil((end-start)/step))+1)*step;q=Rotation.from_matrix(np.array([spice.pxform(spec['frame'],'J2000',float(t)) for t in times])).as_quat().astype('<f4')
        tests=rng.uniform(start,end,128);actual=np.array([spice.pxform(spec['frame'],'J2000',float(t)) for t in tests]);est=Slerp(times,Rotation.from_quat(q.astype(float)))(tests)
        err=float(np.degrees((est.inv()*Rotation.from_matrix(actual)).magnitude()).max())
        if err<.005:break
    assert err<.005,(id,err);f=BASE/'orientation'/f'{id}.f32';f.write_bytes(q.tobytes())
    orient['objects'].append(dict(bodyId=id,frame=spec['frame'],quality='IAU_GENERIC_APPROX',file=f'/assets/smallbodies/orientation/{id}.f32',stepSeconds=step,count=len(q),sha256=sha(f),maxInterpolationAngleDegrees=err));write(BASE/'orientation/manifest.json',orient)
    validation.append(dict(id=id,name=spec['name'],source=src['url'],nativeSize=list(im.size),lods=[l['width'] for l in lods],missingSurfaceFraction=missing,attitudeStepSeconds=step,attitudeMaxErrorDeg=err,axesKm=axes,meanRadiusKm=meanR))
    print(id,spec['name'],'LODs',[l['width'] for l in lods],'missing',round(missing,3),'attitude',step,err,flush=True)
write(BASE/'manifest.json',registry);write(BASE/'orientation/manifest.json',orient)
# Pluto–Charon record: Charon orbit statistics from the Horizons cache; radii/GM from archived JPL tables.
c=next(o for o in m4['objects'] if o['id']=='901');g=np.fromfile(R/('public'+c['file']),dtype='<f8').reshape(-1,7);pos=g[:,1:4];vel=g[:,4:7]
hbar=np.cross(pos,vel).mean(axis=0);n=hbar/np.linalg.norm(hbar);e1=np.cross(n,[0,0,1]);e1/=np.linalg.norm(e1);e2=np.cross(n,e1)
ang=np.unwrap(np.arctan2(pos@e2,pos@e1));rate=np.polyfit((g[:,0]-g[0,0])/86400,ang,1)[0];period=float(2*np.pi/abs(rate))
sats=(R/'data/phase-3a/raw').glob('*phys*');page=next((p for p in sats if p.suffix in ('.html','.json')),None)
def gm_radius(text,name):
    row=re.search(name+r'.{0,400}',text,re.S);return row[0] if row else ''
pluto_sb=json.loads((R/'data/phase-4/raw/sbdb-134340.json').read_text(encoding='utf-8'))
pp={x['name']:x for x in pluto_sb.get('phys_par',[])}
record=dict(charon=dict(id='901',parentPlanetId='999',zh='卡戎',name='Charon',characteristicRadiusKm=float(np.linalg.norm(pos,axis=1).mean()),sampledMeanPeriodDays=period,periodMethod='Least-squares unwrapped longitude in the mean angular-momentum plane over the Horizons cache',
  physical=dict(radiusKm=None,radiusUncertaintyKm=None,source='https://ssd.jpl.nasa.gov/sats/phys_par/'),solution=c['solution'],stepSeconds=c['stepSeconds'],orientation=dict(frame='IAU_CHARON',modelAvailable=True,status='IAU_GENERIC_APPROX')),
  pluto=dict(radiusKm=None,gmKm3PerSec2=float(pp['GM']['value']) if 'GM' in pp else None,source='JPL SBDB 134340 phys-par'),charonGm=dict(gmKm3PerSec2=None,source='https://ssd.jpl.nasa.gov/sats/phys_par/'))
write(R/'data/phase-4/pluto-system.partial.json',record);write(R/'docs/phase-4/asset-validation.json',dict(results=validation))
print('charon period days',period,'mean distance km',record['charon']['characteristicRadiusKm'],'pluto GM',record['pluto']['gmKm3PerSec2'])
