from pathlib import Path
r=Path(__file__).resolve().parent.parent
p=r/'index.html';s=p.read_text(encoding='utf-8');s=s.replace('PHASE 01','PHASE 02').replace('太阳与八大行星</small>','太阳与八大行星</small>')
s=s.replace('显示增强 / 日冕','显示增强 / 日冕').replace('测绘地形起伏','测绘地形法线')
s=s.replace('<label><input type="checkbox" data-visual-option="night">','<label><input type="checkbox" data-visual-option="cloudMotion">云漂移示意（非天气）</label><label><input type="checkbox" data-visual-option="night">')
s=s.replace('<button data-observe="backlight">背光边缘</button>','<button data-observe="backlight">背光边缘</button><button data-observe="pole">极区视角</button><button data-observe="feature">大红斑方位</button><button data-observe="ring-front">环系全貌</button><button data-observe="ring-edge">环侧面</button><button data-observe="ring-detail">环与阴影细节</button>')
p.write_text(s,encoding='utf-8')
# Assets are mandatory in phase 2. Never silently substitute phase-1 random-noise bodies.
p=r/'src/render/scene.ts';s=p.read_text();s=s.replace("import {proceduralTexture,glowTexture} from './textures';","import {glowTexture} from './textures';")
start=s.index('   else{const {texture,thumbnail}=proceduralTexture(body);');end=s.index('\n',start)
s=s[:start]+"   else{throw new Error('缺少已登记视觉资产 '+body.id);}"+s[end:]
start=s.index("  const earth=this.meshes.get('399')!;");end=s.index('  this.glow=',start);s=s[:start]+s[end:]
s=s.replace('const visible=mesh.visible&&','const visible=!this.focused&&mesh.visible&&')
p.write_text(s)
print('UI keeps frozen product direction; advanced controls remain collapsed; no noise fallback')
