import json,sys,datetime
from pathlib import Path
r=Path(__file__).resolve().parent.parent;id=sys.argv[1];num=sys.argv[2];name=sys.argv[3]
lines=(r/f'output/playwright/phase-2/{id}-qa.txt').read_text(encoding='utf-8-sig').splitlines();result=json.loads(next(x for x in lines if x.startswith('{"bodyId"')))
assert result['physicsUnchanged'] and not result['errors'] and result['matchedCamera']==result['baselineCamera'];assert result['visual']['status']=='ready'
b=next(x for x in json.loads((r/'data/phase-2/visual-manifest.json').read_text())['bodies'] if x['bodyId']==id)
result.update(gate='accepted-with-declared-limitations',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),visualInspection='Standard / detail / terminator / backlight browser PNGs reviewed by agent; see screenshots',limitations=b['limitations'],independentAcceptanceOrder=int(num))
(r/f'docs/phase-2/A{num}-{name}-acceptance.json').write_text(json.dumps(result,indent=2)+'\n')
print(id,'independent gate recorded')
