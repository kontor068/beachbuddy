import { readFileSync, readdirSync } from 'node:fs';
const STEPS=[0.05,0.08,0.12], MAX=6, roundTo=(v,s)=>Math.round(v/s)*s;
const buildClusters=(b)=>{for(const step of STEPS){const g=new Map();for(const x of b){const k=`${roundTo(x.coordinates.lat,step).toFixed(3)}_${roundTo(x.coordinates.lon,step).toFixed(3)}`;g.set(k,[...(g.get(k)||[]),x]);}if(g.size<=MAX||step===STEPS[2])return[...g.values()].map(cb=>({lat:cb.reduce((s,x)=>s+x.coordinates.lat,0)/cb.length,lon:cb.reduce((s,x)=>s+x.coordinates.lon,0)/cb.length}));}return[];};
const spread=(ds)=>{let m=0;for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++){let d=Math.abs(ds[i]-ds[j])%360;if(d>180)d=360-d;m=Math.max(m,d);}return m;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const files=readdirSync('public/data/beaches/app').filter(f=>f.endsWith('.json'));
// speed buckets -> collected spreads
const buckets={'12-20':[], '20-29':[], '29-39':[], '39+':[]};
let n=0;
for (const f of files) {
  const app=JSON.parse(readFileSync('public/data/beaches/app/'+f,'utf8'));
  const beaches=app.island?.beaches||app.beaches||[]; if(beaches.length===0)continue;
  const cls=buildClusters(beaches); if(cls.length<2)continue;
  const lats=cls.map(c=>c.lat.toFixed(4)).join(','), lons=cls.map(c=>c.lon.toFixed(4)).join(',');
  let data; for(let a=0;a<3;a++){try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=wind_direction_10m,wind_speed_10m&wind_speed_unit=kmh&forecast_days=3&timezone=Europe%2FAthens`);if(r.status===429||r.status>=500){await sleep(2000);continue;}data=await r.json();break;}catch{await sleep(1500);}}
  if(!data)continue; const locs=Array.isArray(data)?data:[data]; const times=locs[0].hourly.time;
  for(let i=0;i<times.length;i+=2){
    const degs=locs.map(l=>l.hourly.wind_direction_10m[i]), spds=locs.map(l=>l.hourly.wind_speed_10m[i]);
    const ms=Math.max(...spds); if(ms<12)continue;
    const sp=spread(degs);
    const b = ms<20?'12-20':ms<29?'20-29':ms<39?'29-39':'39+';
    buckets[b].push(sp);
  }
  n++; if(n%20===0)process.stderr.write(`..${n}\n`); await sleep(200);
}
console.log('\n=== NATIONAL: mean intra-island spread by max wind speed (all windy slots, all islands) ===');
for(const [k,arr] of Object.entries(buckets)){
  if(!arr.length){console.log(`  ${k} km/h: no data`);continue;}
  const mean=Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
  const over45=Math.round(100*arr.filter(s=>s>45).length/arr.length);
  console.log(`  ${k.padEnd(6)} km/h: mean spread ${String(mean).padStart(3)}° | ${String(over45).padStart(3)}% of slots >45° | n=${arr.length}`);
}
