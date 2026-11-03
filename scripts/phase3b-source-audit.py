"""Cache primary source pages and scientific products with download hashes."""
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import requests, json, hashlib, sys
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
RAW=ROOT/'data/phase-3b/raw';RAW.mkdir(parents=True,exist_ok=True)
def fetch(name,url):
 p=RAW/name;receipt=RAW/(name+'.source.json')
 if not p.exists():
  print('FETCH',name,url,flush=True)
  temp=p.with_suffix(p.suffix+'.part')
  with requests.get(url,timeout=(30,120),stream=True) as res:
   res.raise_for_status()
   with temp.open('wb') as f:
    for block in res.iter_content(1024*1024):f.write(block)
  temp.replace(p)
 if not receipt.exists():
  receipt.write_text(json.dumps(dict(url=url,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size,retrievedOrCacheVerifiedAtUtc=datetime.now(timezone.utc).isoformat()),indent=2)+'\n')
 print('READY',name,p.stat().st_size,flush=True)
 return p

pages={
 'sbmt-terms.html':'https://sbmt.jhuapl.edu/Terms-and-Conditions.php',
 'io-usgs.html':'https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km',
 'ganymede-usgs.html':'https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1.4km',
 'callisto-usgs.html':'https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_ssi_global_mosaic_1km',
 'iapetus-map.html':'https://science.nasa.gov/resource/color-map-of-iapetus/',
 'rhea-map.html':'https://science.nasa.gov/resource/color-map-of-rhea-2014/',
 'triton-map.html':'https://science.nasa.gov/resource/map-of-triton/',
 'lpi-saturn.html':'https://www.lpi.usra.edu/icy_moons/saturn/saturn_tour/'
}
if 'shapes' in sys.argv:
 pages={}
 for stem in ['phobos_g_148m_spc_obj_0000n00000_v004','deimos_g_083m_spc_obj_0000n00000_v002']:
  for suffix in ['.obj.zip','.lbl','.csv.zip']:
   pages[stem+suffix]='https://sbmt.jhuapl.edu/shared-files/files/'+stem+suffix
if __name__=='__main__':
 results=[]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for work in as_completed([pool.submit(fetch,n,u) for n,u in pages.items()]):
   try:results.append(work.result())
   except Exception as e:print('FAILED',repr(e),flush=True)
 for p in results:
  if p.suffix!='.html':continue
  soup=BeautifulSoup(p.read_text(encoding='utf8'),'html.parser')
  links=[dict(text=a.get_text(' ',strip=True)[:180],url=urljoin(pages[p.name],a['href'])) for a in soup.find_all('a',href=True) if any(k in a['href'].lower() for k in ['.tif','.jpg','.png','license','terms'])]
  (RAW/(p.stem+'-downloads.json')).write_text(json.dumps(links,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  print(p.name, 'DOWNLOADS', json.dumps(links,ensure_ascii=False)[:3000],flush=True)
