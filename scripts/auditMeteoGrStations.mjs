import fs from 'node:fs';
// Κριτής meteo.gr (ημερήσιες συνόψεις από meteosearch.meteo.gr, κατεβασμένες με λογαριασμό — όριο 30/μέρα)
// έναντι best_match στις συντεταγμένες του σταθμού. Είσοδος: docs/team/data/meteo-gr/<σταθμός>-<YYYY-MM>.txt
// Τρέξιμο: OPEN_METEO_API_KEY=... node scripts/auditMeteoGrStations.mjs
const DIR = process.argv[2] || 'docs/team/data/meteo-gr';
const ST = { ierapetra:[35.00,25.70,'ακτή'], lentas:[34.9331,24.9372,'ακτή'], paleochora:[35.20,23.70,'ακτή'], plakias:[35.20,24.40,'ακτή'], sfakia:[35.20,24.10,'ΒΟΥΝΟ 770μ'], malia:[35.293,25.478,'βόρεια, ξενοδοχείο'], sisi:[35.30,25.50,'βόρεια, μελτέμι'], 'plaka-elounda':[35.292,25.726,'Ελούντα, ξενοδοχείο 47μ'], elafonisi:[35.20,23.50,'δυτική, 67μ'], falasarna:[35.50,23.60,'δυτική'] };
const obs={};
// Δύο μορφές Davis (στήλες RH ή heat/cool degree-days), ίδια ουρά: AVG SPEED · HIGH · TIME · DOM DIR.
for(const f of fs.readdirSync(DIR).filter(x=>x.endsWith('.txt'))){const st=f.replace(/-\d{4}-\d{2}\.txt$/,'');const mo=f.match(/(\d{4}-\d{2})/)[1];
  for(const l of fs.readFileSync(DIR+'/'+f,'utf8').split(/\r?\n/)){const t=l.trim().split(/\s+/);
    if(t.length<10||!/^\d{1,2}$/.test(t[0])||!/^[NESW]{1,3}$/.test(t[t.length-1]))continue;
    const avg=+t[t.length-4],gust=+t[t.length-3];if(!isFinite(avg)||!isFinite(gust))continue;
    (obs[st]=obs[st]||{})[mo+'-'+t[0].padStart(2,'0')]={avg,gust,dir:t[t.length-1]};}}
const names=Object.keys(ST);
const key=process.env.OPEN_METEO_API_KEY;
const base=key?'https://customer-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast';
const url=`${base}?latitude=${names.map(n=>ST[n][0]).join(',')}&longitude=${names.map(n=>ST[n][1]).join(',')}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens&start_date=2026-06-07&end_date=2026-08-31&models=best_match${key?'&apikey='+encodeURIComponent(key):''}`;
const res=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!res.ok){console.error('HTTP',res.status,await res.text());process.exit(1);}
const data=await res.json();const arr=Array.isArray(data)?data:[data];
const bft=k=>k<1?0:k<6?1:k<12?2:k<20?3:k<29?4:k<39?5:k<50?6:k<62?7:8;
const DECOMP=v=>2.392+1.0005*v;
const out={};
names.forEach((n,i)=>{const h=arr[i].hourly;const days={};
  h.time.forEach((t,k)=>{const d=t.slice(0,10);const w=h.wind_speed_10m[k],g=h.wind_gusts_10m[k],dd=h.wind_direction_10m[k];if(w==null)return;(days[d]=days[d]||{w:[],g:[],dir:[]});days[d].w.push(w);days[d].g.push(g);days[d].dir.push([dd,w]);});
  // Κυρίαρχη κατεύθυνση μοντέλου = 16-άρι σημείο με το μεγαλύτερο άθροισμα ταχύτητας (όπως το Davis: ο τομέας που «κουβάλησε» τον πιο πολύ αέρα).
  const PTS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const domDir=pairs=>{const s=new Array(16).fill(0);for(const [d,w] of pairs){if(d==null)continue;s[Math.round(d/22.5)%16]+=w;}return PTS[s.indexOf(Math.max(...s))];};
  const ptGap=(a,b)=>{const i=PTS.indexOf(a),j=PTS.indexOf(b);if(i<0||j<0)return null;const g=Math.abs(i-j);return Math.min(g,16-g);};
  const rows=[];for(const d in days){const o=obs[n]?.[d];if(!o||days[d].w.length<20)continue;const mm=days[d].w.reduce((a,b)=>a+b,0)/days[d].w.length;const mg=Math.max(...days[d].g);const mDir=domDir(days[d].dir);rows.push({d,oAvg:o.avg,oGust:o.gust,dir:o.dir,mAvg:mm,mGust:mg,mDir,dirGap:ptGap(o.dir,mDir),shown:DECOMP(mm)});}
  const dirStat=rs=>{const v=rs.filter(r=>r.dirGap!=null&&r.oAvg>=6);if(!v.length)return null;const N=v.length;const p=k=>Math.round(100*v.filter(r=>r.dirGap<=k).length/N);const opp=Math.round(100*v.filter(r=>r.dirGap>=6).length/N);console.log(`  κατεύθυνση (${N} μέρες ≥6 χλμ/ώ): ίδιο σημείο ${p(0)}% · ±22° ${p(1)}% · ±45° ${p(2)}% · ΑΝΑΠΟΔΑ (≥135°) ${opp}%`);return {N,exactPct:p(0),within22Pct:p(1),within45Pct:p(2),oppositePct:opp};};
  const stat=(rs,label)=>{if(!rs.length)return;const N=rs.length;const mean=f=>rs.reduce((a,r)=>a+f(r),0)/N;
    const under=rs.filter(r=>bft(r.shown)<bft(r.oAvg)).length,over=rs.filter(r=>bft(r.shown)>bft(r.oAvg)).length;
    const under2=rs.filter(r=>bft(r.shown)<=bft(r.oAvg)-2).length;
    console.log(`  ${label.padEnd(14)} ${String(N).padStart(3)} μέρες | μέσος: σταθμός ${mean(r=>r.oAvg).toFixed(1)} / μοντέλο ${mean(r=>r.mAvg).toFixed(1)} / δείχνουμε ${mean(r=>r.shown).toFixed(1)} → ${(mean(r=>r.shown)-mean(r=>r.oAvg)).toFixed(1)} | ριπή: σταθμός ${mean(r=>r.oGust).toFixed(1)} / μοντέλο ${mean(r=>r.mGust).toFixed(1)} → ${(mean(r=>r.mGust)-mean(r=>r.oGust)).toFixed(1)} | Μπφ: χαμηλά ${Math.round(100*under/N)}% (≥2 σκαλιά ${Math.round(100*under2/N)}%) ψηλά ${Math.round(100*over/N)}%`);
    return {N,oAvg:mean(r=>r.oAvg),mAvg:mean(r=>r.mAvg),shown:mean(r=>r.shown),oGust:mean(r=>r.oGust),mGust:mean(r=>r.mGust),underPct:100*under/N,under2Pct:100*under2/N,overPct:100*over/N};};
  console.log(`${n} (${ST[n][2]}) — πλέγμα ${arr[i].latitude},${arr[i].longitude} υψ. ${arr[i].elevation}μ`);
  out[n]={all:stat(rows,'όλες'),north:stat(rows.filter(r=>/^N/.test(r.dir)),'Β/ΒΑ/ΒΔ μέρες'),other:stat(rows.filter(r=>!/^N/.test(r.dir)),'άλλες'),direction:dirStat(rows),rows};
});
fs.writeFileSync('reports/weather/lee-coast-stations-2026-summer.json',JSON.stringify({question:'Κρύβει το best_match τον αέρα σε υπήνεμες νότιες ακτές της Κρήτης; Κριτής: 5 σταθμοί meteo.gr (ημερήσιες συνόψεις), Ιουν-Αυγ 2026',stations:ST,results:out},null,1));
