from pathlib import Path
import subprocess,json,sys
root=Path(__file__).resolve().parent.parent;docs=root/'docs/phase-3a';python=sys.executable
commands=[('regression-science',['node','--experimental-transform-types','scripts/verify-phase1.mjs']),('regression-contracts',['node','scripts/check-contracts.mjs']),('runtime-validation',['node','--experimental-transform-types','scripts/verify-satellites.mjs']),('independent-validation',[python,'scripts/validate-satellites.py']),('regression-freeze',[python,'scripts/phase2-freeze.py','--check']),('render-asset-freeze',['git','diff','--exit-code','3da16f2','--','src/render','public/assets','data/phase-2'])]
results=[]
for name,args in commands:
    result=subprocess.run(args,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    (docs/(name+'.log')).write_bytes(result.stdout)
    results.append(dict(name=name,command=args,exitCode=result.returncode))
    print(name,'exit',result.returncode,flush=True)
(docs/'command-exit-codes.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
if any(r['exitCode'] for r in results):raise SystemExit(1)
