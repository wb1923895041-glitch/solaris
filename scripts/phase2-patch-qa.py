from pathlib import Path
p=Path(__file__).parent/'phase2-stability.mjs';s=p.read_text();s=s.replace("v=[1.75*o.radius,0,0]","v=[2.1*o.radius,0,0]")
s=s.replace("const states=JSON.stringify", "const picked=await page.evaluate(()=>window.solarisQA.snapshot().scene.lastPick);if(picked?.bodyId!=='699'||picked.hitObject!=='measured-ABC-rings'||!picked.child)throw Error('No actual ring child hit '+JSON.stringify(picked));\nconst states=JSON.stringify")
s=s.replace('ringChildPicking:true,visualSwitchPreservesPhysics:true','ringChildPicking:picked,visualSwitchPreservesPhysics:true');p.write_text(s)
