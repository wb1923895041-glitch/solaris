from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests,re,json
from bs4 import BeautifulSoup
root=Path('data/phase-2/discovery')
urls={
'venus':'https://science.nasa.gov/photojournal/venus-from-mariner-10/',
'venus-radar':'https://science.nasa.gov/3d-resources/venus/',
'earth-blue':'https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/',
'earth-clouds':'https://visibleearth.nasa.gov/images/57747/blue-marble-clouds',
'earth-night':'https://science.nasa.gov/earth/earth-observatory/earth-at-night-flat-maps-144897/',
'mars-height':'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m',
'rings':'https://pds-rings.seti.org/voyager/uvs/profiles.html',
'ice':'https://ras.ac.uk/media/1488',
'saturn-maps':'https://www.nature.com/articles/s41597-025-04392-3',
'saturn-observed':'https://science.nasa.gov/photojournal/saturn-approaching-northern-summer/'
}
def get(kv):
 k,u=kv
 try:
  r=requests.get(u,timeout=45);(root/f'{k}.html').write_text(r.text,encoding='utf-8');s=BeautifulSoup(r.text,'html.parser')
  links=[a.get('href') for a in s.select('[href]') if re.search(r'\.(jpg|png|tif|TAB|LBL|zip)(\?|$)|doi.org|figshare|zenodo',a.get('href',''),re.I)]
  imgs=[i.get('src') for i in s.select('img[src]') if re.search(r'PIA|true|colour|cloud|night|2048',i.get('src',''),re.I)]
  return k,r.status_code,links[:24],imgs[:8]
 except Exception as e:return k,str(e)
with ThreadPoolExecutor(max_workers=6) as ex:
 for x in ex.map(get,urls.items()):print(json.dumps(x),flush=True)
