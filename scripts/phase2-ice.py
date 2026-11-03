exec((__import__('pathlib').Path(__file__).parent/'phase2-assets-lib.py').read_text())
from scipy.ndimage import map_coordinates
import sys
name=sys.argv[1];assert name in ['uranus','neptune'];id='799' if name=='uranus' else '899'
p=RAW/'ice-true.jpg';a=np.asarray(Image.open(p).convert('RGB')).astype(float)
# Only the published scientifically recalibrated LOWER disks, never the enhanced Voyager panels above.
cx,cy,rad=(1115,1200,290) if name=='uranus' else (1898,1195,278)
y,x=np.indices(a.shape[:2]);rho=np.sqrt((x-cx)**2+(y-cy)**2)/rad
inside=(rho<.55);mean=a[inside].mean(0)
lon=np.linspace(-np.pi,np.pi,4096,endpoint=False)[None,:];lat=np.linspace(np.pi/2,-np.pi/2,2048)[:,None]
xx=cx+.9*rad*np.cos(lat)*np.sin(lon);yy=np.broadcast_to(cy-.9*rad*np.sin(lat),xx.shape)
sample=np.stack([map_coordinates(a[:,:,k],[yy,xx],order=1) for k in range(3)],-1)
profile=np.array([np.median(a[(rho>=i/150)&(rho<(i+1)/150)],axis=0) for i in range(140)])
rt=np.sqrt(((xx-cx)/rad)**2+((yy-cy)/rad)**2);shade=np.stack([np.interp(rt,np.arange(140)/150+1/300,profile[:,k]) for k in range(3)],-1)
# Remove published-disk illumination and retain only restrained observed residuals; no random cloud field or invented dark spot.
strength=.35 if name=='uranus' else .7
mapped=mean*(1+(sample/np.maximum(shade,25)-1)*strength);ls=lods(name,Image.fromarray(np.uint8(np.clip(mapped,0,255))))
s=source('Voyager 2 / Irwin et al. / University of Oxford','2024 true-color recalibration of Voyager 2 '+name,'https://ras.ac.uk/media/1488','Voyager 2: 1986 Uranus / 1989 Neptune; reprocessed 2024','Patrick Irwin / University of Oxford / NASA; Irwin et al. MNRAS 527, 11521 (2024)','Lower scientifically reprocessed disk only; orthographic inverse, radial color/limb removal, mirrored unknown hemisphere; observed residual contrast reduced. Native disk ~'+str(rad*2)+'px, not 4K measured detail.',p)
s['rights']='CC BY 4.0 per Royal Astronomical Society media item; source credit retained'
s['sourceDisk']=[cx,cy,rad];s['researchUrl']='https://academic.oup.com/mnras/article/527/4/11521/7511973'
commit(name,dict(bodyId=id,name=name.title(),version='2.0.0-'+name,kind=name+'-methane-haze-reconstruction',photometry='gas',minnaert=.94 if name=='uranus' else .9,albedo=s,lods=ls,atmosphere=dict(radius=1.003 if name=='uranus' else 1.004,tint='#92c3cc' if name=='uranus' else '#7bb5ca',strength=.22),axisVerified=True,hasVerifiedOrientation=False,visualEnhancements=['VISUAL_ENHANCEMENT: approximate Minnaert limb photometry; analytic methane-haze edge','RECONSTRUCTED: apparent disk structures mapped with unknown absolute longitude; not a cartographic observation'],limitations=['Native published disk is about '+str(rad*2)+'px; 4K derivatives add no observed resolution','Disk sub-observer registration is unavailable; cloud feature latitude/longitude NOT certified','RECONSTRUCTED mirrored unknown hemisphere; historical weather only, no permanent invented dark spot','No new winds, current weather, rings or satellites; near-natural color intentionally pale cyan','Uranus IAU north-pole axis and retrograde rotation distinct from 98-degree angular-momentum obliquity' if name=='uranus' else 'Neptune color follows 2024 spectral recalibration, not legacy saturated blue']))
print(name,'real recalibrated color',mean.tolist(),'native disk',rad*2)
