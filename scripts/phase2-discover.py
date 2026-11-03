from pathlib import Path
import requests,re,json
from bs4 import BeautifulSoup
root=Path('data/phase-2/discovery');root.mkdir(parents=True,exist_ok=True)
urls={
 'sun-index':'https://sdo.gsfc.nasa.gov/assets/img/browse/2025/09/07/',
 'mercury':'https://science.nasa.gov/resource/enhanced-color-mercury-map/',
 'mars':'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m',
 'jupiter':'https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/',
 'nasa-mars':'https://science.nasa.gov/3d-resources/mars/',
 'saturn':'https://science.nasa.gov/3d-resources/saturn/'
}
for key,url in urls.items():
 try:
  r=requests.get(url,timeout=35);print(key,r.status_code,flush=True);(root/f'{key}.html').write_text(r.text,encoding='utf-8')
  soup=BeautifulSoup(r.text,'html.parser')
  links=[a.get('href') for a in soup.select('[href]') if re.search(r'\.(jpg|png|tif|zip|json|xml)(\?|$)',a.get('href',''),re.I)]
  print(json.dumps(links[:25]),flush=True)
 except Exception as e:print(key,type(e).__name__,str(e)[:100],flush=True)
