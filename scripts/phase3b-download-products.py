from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import runpy,json
d=runpy.run_path('scripts/phase3b-source-audit.py');fetch=d['fetch'];raw=d['RAW']
pages={
 'ganymede-product.html':'https://astrogeology.usgs.gov/search/map/Ganymede/Voyager-Galileo/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m',
 'callisto-product.html':'https://astrogeology.usgs.gov/search/map/Callisto/Voyager-Galileo/Callisto_Voyager_GalileoSSI_global_mosaic_1km',
 'iapetus-product.html':'https://science.nasa.gov/photojournal/color-maps-of-iapetus-2014/',
 'mimas-product.html':'https://science.nasa.gov/photojournal/color-maps-of-mimas-2014/',
 'enceladus-product.html':'https://science.nasa.gov/photojournal/color-maps-of-enceladus-2014/',
 'rhea-product.html':'https://science.nasa.gov/photojournal/color-maps-of-rhea-2014/'
}
products={
 'io-color-1km.tif':'https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif',
 'europa-mosaic-500m.tif':'https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif',
 'mimas-color.jpg':'https://www.lpi.usra.edu/icy_moons/images/msmap-cyl-KH.jpg',
 'mimas-annotated.jpg':'https://www.lpi.usra.edu/icy_moons/images/msmap-cyl-KH-anno.jpg'
}
with ThreadPoolExecutor(max_workers=4) as pool:
 for f in as_completed([pool.submit(fetch,n,u) for n,u in pages.items()]):
  try:
   p=f.result();soup=BeautifulSoup(p.read_text(),'html.parser');links=[urljoin(pages[p.name],a['href']) for a in soup.select('a[href]')]
   links=[u for u in links if any(k in u.lower() for k in ['.jpg','.tif'])]
   (raw/(p.stem+'-downloads.json')).write_text(json.dumps(links,indent=2)+'\n');print(p.name,links,flush=True)
   if p.name.startswith(('ganymede','callisto')):
    tif=next((u for u in links if u.endswith('.tif')),None)
    if tif:products[p.name.split('-')[0]+'-global.tif']=tif
   else:
    # The unannotated global map, not a decorative thumbnail or poster.
    body=p.name.split('-')[0];pia={'mimas':'18437','enceladus':'18435','rhea':'18438','iapetus':'18436'}[body]
    url=next((u.split('?')[0] for u in links if '/PIA'+pia+'.jpg' in u),None)
    if url:products[body+'-global.jpg']=url
  except Exception as e:print('PAGE FAILED',repr(e),flush=True)
 for f in as_completed([pool.submit(fetch,n,u) for n,u in products.items()]):
  try:f.result()
  except Exception as e:print('PRODUCT FAILED',repr(e),flush=True)
