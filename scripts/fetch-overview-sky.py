"""Cache the exact NASA SVS source used by repair B, with integrity checking."""
from pathlib import Path
from urllib.request import urlopen, Request
import hashlib

root = Path(__file__).resolve().parent.parent
cache = root / 'data/overview-repair'
cache.mkdir(parents=True, exist_ok=True)
page = 'https://svs.gsfc.nasa.gov/4851/'
url = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr'
expected = '69b841cd048c2ef35543eb1c5819b322530e78aa4b0cab97ec1de3ef56a4ddcd'
target = cache / 'starmap_2020_4k.exr'
if not target.exists():
    with urlopen(Request(page, headers={'User-Agent': 'SOLARIS-source-audit/1.0'}), timeout=60) as response:
        html = response.read()
    assert b'starmap_2020_4k.exr' in html, 'Source no longer advertised by NASA page'
    (cache / 'source-page.html').write_bytes(html)
    with urlopen(Request(url, headers={'User-Agent': 'SOLARIS-source-audit/1.0'}), timeout=60) as response:
        content = response.read()
    assert hashlib.sha256(content).hexdigest() == expected, 'NASA source changed; review before replacing'
    target.write_bytes(content)
assert hashlib.sha256(target.read_bytes()).hexdigest() == expected, 'Cached source integrity failed'
print('NASA SVS source verified:', target.name, target.stat().st_size, 'bytes')
