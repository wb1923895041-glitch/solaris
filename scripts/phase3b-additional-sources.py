import runpy,json
from concurrent.futures import ThreadPoolExecutor,as_completed
from bs4 import BeautifulSoup
from urllib.parse import urljoin
d=runpy.run_path('scripts/phase3b-source-audit.py');fetch=d['fetch'];raw=d['RAW']
pages={
 'ganymede-verified.html':'https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km',
 'callisto-verified.html':'https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km',
 'triton-usgs.html':'https://astrogeology.usgs.gov/search/map/triton_voyager_2_global_color_mosaic_600m',
 'titan-visible.html':'https://science.nasa.gov/resource/cassinis-views-of-titan/',
}
products={
 'triton-global.jpg':'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/2/238_PIA18668-2.jpg',
}
# Voyager maps are observations, with explicit unmapped northern terrain.
for n in range(1,6):products[f'uranus-moon-{n}.tif']=f'https://space.jpl.nasa.gov/tmaps/pix/ura{n}vuu2.tif'
with ThreadPoolExecutor(max_workers=4) as pool:
 for f in as_completed([pool.submit(fetch,n,u) for n,u in pages.items()]):
  try:
   p=f.result();soup=BeautifulSoup(p.read_text(),'html.parser');links=[urljoin(pages[p.name],a['href']) for a in soup.select('a[href]')];links=[u for u in links if any(k in u.lower() for k in ['.jpg','.tif','.lbl','.xml'])];(raw/(p.stem+'-downloads.json')).write_text(json.dumps(links,indent=2)+'\n');print(p.name,links,flush=True)
   if p.name.startswith(('ganymede','callisto')):
    tif=next(u for u in links if u.endswith('.tif'));products[p.name.split('-')[0]+'-global.tif']=tif
  except Exception as e:print('PAGE FAILED',repr(e),flush=True)
 for f in as_completed([pool.submit(fetch,n,u) for n,u in products.items()]):
  try:f.result()
  except Exception as e:print('PRODUCT FAILED',repr(e),flush=True)
