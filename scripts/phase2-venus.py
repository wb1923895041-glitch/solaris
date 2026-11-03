exec((__import__('pathlib').Path(__file__).parent/'phase2-assets-lib.py').read_text())
from scipy.ndimage import map_coordinates,label
p=RAW/'venus-cloud.jpg';a=np.asarray(Image.open(p).convert('RGB')).astype(float);a=a[:,:1090]
mask=a.mean(2)>25;labels,n=label(mask);which=np.argmax(np.bincount(labels.ravel())[1:])+1;y,x=np.where(labels==which);cx=(x.min()+x.max())/2;cy=(y.min()+y.max())/2;rad=min(x.max()-x.min(),y.max()-y.min())/2
lon=np.linspace(-np.pi,np.pi,4096,endpoint=False)[None,:];lat=np.linspace(np.pi/2,-np.pi/2,2048)[:,None]
# Only reprojects a measured disk; mirrored unknown hemisphere explicitly flagged.
xx=cx+.94*rad*np.cos(lat)*np.sin(lon);yy=np.broadcast_to(cy-.94*rad*np.sin(lat),xx.shape)
mapped=np.stack([map_coordinates(a[:,:,k],[yy,xx],order=1,mode='nearest') for k in range(3)],-1)
# Suppress baked disk illumination with an azimuthal median radial profile, retaining observed fine cloud contrast.
rr=np.sqrt(((np.indices(a.shape[:2])[1]-cx)/rad)**2+((np.indices(a.shape[:2])[0]-cy)/rad)**2)
profile=np.array([np.median(a.mean(2)[(rr>=i/200)&(rr<(i+1)/200)]) for i in range(190)])
rho=np.sqrt(((xx-cx)/rad)**2+((yy-cy)/rad)**2);shade=np.interp(rho,np.arange(190)/200+.0025,profile)
cloud=mapped/np.maximum(shade[:,:,None],30);cloud=np.clip(1+(cloud-1)*.7,.8,1.12)*np.array([218,211,190])
ls=lods('venus',Image.fromarray(np.uint8(np.clip(cloud,0,255))),'cloudtops')
rp=RAW/'venus-radar.jpg';radar=lods('venus',Image.open(rp).convert('RGB'),'radar')
s=source('NASA / JPL-Caltech / Mariner 10','PIA23791 cloud structure reconstruction','https://science.nasa.gov/photojournal/venus-from-mariner-10/','1974-02-07 / 08','NASA/JPL-Caltech; processing Kevin M. Gill','Inverse orthographic of LEFT unenhanced disk; radial median illumination removal; reduced-contrast cream display reconstruction; unknown hemisphere mirrored. Source orange+UV false color, not calibrated visible RGB.',p)
rs=source('NASA / JPL Magellan via NASA 3D Resources','Venus radar representative global texture','https://science.nasa.gov/3d-resources/venus/','Magellan era; exact mosaic epoch not documented on download page','NASA/JPL-Caltech','Unmodified radar appearance resampled; not optical color or a DEM',rp)
commit('venus',dict(bodyId='299',name='Venus',version='2.0.0-venus',kind='opaque-acid-cloudtops',roughness=1,albedo=s,lods=ls,radarLods=radar,radarSource=rs,atmosphere=dict(radius=1.012,tint='#e8dbb3',strength=.38),axisVerified=True,hasVerifiedOrientation=False,visualEnhancements=['RECONSTRUCTED: low-contrast cream cloudtops from orange/UV structure','VISUAL_ENHANCEMENT: analytic cloudtop limb scattering; radar mode explicitly labeled'],limitations=['Static 1974 snapshot, not current clouds or simulated superrotation','RECONSTRUCTED unseen hemisphere; sub-view geometry and prime meridian not certified','4K derivative; source disk is about 900 pixels across, no 4K observation detail claimed','Radar source is a representative NASA texture, not calibrated backscatter or height']))
print('Venus cloudtops and radar separated; no random weather',cx,cy,rad)
