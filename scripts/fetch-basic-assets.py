"""Restore the single phase-1 source texture, pinned to the approved NASA bytes."""
from pathlib import Path
import hashlib
import json
import struct
import requests

root=Path(__file__).resolve().parent.parent
record=json.loads((root/'data/phase-1/visual-assets.json').read_text(encoding='utf-8'))['earth']
path=root/'public/assets/earth-blue-marble.png'
if not path.exists():
    response=requests.get(record['url'],timeout=120)
    response.raise_for_status()
    data=response.content
else:
    data=path.read_bytes()
assert hashlib.sha256(data).hexdigest()==record['sha256'],'NASA file bytes changed; review provenance before accepting new bytes.'
assert data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(2048,1024)
path.parent.mkdir(parents=True,exist_ok=True)
path.write_bytes(data)
print('Approved NASA Earth source verified, unchanged and not derived from reference images.')
