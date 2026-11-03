import fs from 'node:fs';
const v=JSON.parse(fs.readFileSync('data/phase-1/validation.json','utf8'));
const golden=[0,1,2,4].map(i=>({utc:v.utc[i]+'Z',states:v.objects.map(o=>{
 const row=o.rows.reduce((a,b)=>Math.abs(b[0]-v.requestedTdb[i])<Math.abs(a[0]-v.requestedTdb[i])?b:a);
 return {id:o.id,position:row.slice(1,4),velocity:row.slice(4,7)};
})}));
const source=fs.readFileSync('scripts/browser-phase1-template.js','utf8').replace('GOLDEN_PLACEHOLDER',JSON.stringify(golden));
fs.writeFileSync('scripts/browser-phase1-qa.js',source);
fs.writeFileSync('scripts/browser-phase1-edge-qa.js',source.replaceAll('chrome-','edge-'));
console.log('Prepared Chrome/Edge browser QA from archived, held-out Horizons queries.');
