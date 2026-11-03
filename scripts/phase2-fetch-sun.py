from pathlib import Path
import requests,json,hashlib
from datetime import datetime,timezone
from PIL import Image
root=Path(__file__).resolve().parent.parent
raw=root/'data/phase-2/raw';raw.mkdir(parents=True,exist_ok=True)
url='https://sdo.gsfc.nasa.gov/assets/img/browse/2025/09/07/20250907_000000_4096_HMIIF.jpg'
p=raw/'sun-HMIIF-20250907.jpg'
if not p.exists():
 r=requests.get(url,timeout=120);r.raise_for_status();p.write_bytes(r.content)
image=Image.open(p);print('Sun raw',image.size,flush=True)
record=dict(sourceUrl=url,provider='NASA/SDO HMI',title='HMI flattened continuum intensity 2025-09-07 00:00 UTC',observationEpoch='2025-09-07T00:00:00Z',acquisitionDate=datetime.now(timezone.utc).isoformat(),processing='reconstruction',rights='NASA media usage guidelines; credit NASA/SDO and HMI science team; no endorsement',credit='Courtesy NASA/SDO and the AIA, EVE, and HMI science teams',licenseUrl='https://www.nasa.gov/nasa-brand-center/images-and-media/',referenceUrl='https://sdo.gsfc.nasa.gov/data/channels.php',projection='orthographic full disk source; derived equirectangular',longitudeConvention='east-positive',primeMeridianOrOrientationNotes='Visual reprojection; JPEG browse disk lacks full WCS. Texture prime-meridian registration unverified; backside mirrored reconstruction.',sha256=hashlib.sha256(p.read_bytes()).hexdigest(),rawPath=p.relative_to(root).as_posix())
(root/'data/phase-2/sun-source.json').write_text(json.dumps(record,indent=2)+'\n')
