const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const restPoints=[[8,8],[92,8],[13,25],[31.5,33.5],[50,33.5],[68.5,33.5],[87,25],[87,25],[68.5,33.5],[50,33.5],[31.5,33.5],[13,25]];
const points=pose=>pose.points.length===12?pose.points:restPoints;
const displacement=(a,b)=>Math.max(...points(a).map((p,i)=>Math.hypot(p[0]-points(b)[i][0],p[1]-points(b)[i][1])));
const width=pose=>pose.points[1][0]-pose.points[0][0];
const cubic=(a,b,c,d,t)=>{const u=1-t;return [0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]);};
function validate(pose){
  assert.equal(pose.points.length,12,'Rest and speech use the same interpolatable geometry');
  assert(!/NaN|Infinity/.test(pose.path));assert(Number.isFinite(pose.strokeWidth)&&pose.strokeWidth>0&&pose.strokeWidth<=9);
  assert(pose.points.every(p=>p.length===2&&p.every(Number.isFinite)));
  assert(pose.bounds.left>=-1e-6&&pose.bounds.top>=-1e-6&&pose.bounds.right<=100+1e-6&&pose.bounds.bottom<=50+1e-6,'Stroke stays within the mouth viewport');
  const p=pose.points;
  for(let i=0;i<=16;i++){
    const t=i/16;
    for(const [top,bottom]of [[cubic(p[0],p[2],p[3],p[4],t),cubic(p[0],p[11],p[10],p[9],t)],[cubic(p[4],p[5],p[6],p[1],t),cubic(p[9],p[8],p[7],p[1],t)]]){
      assert(Math.abs(top[0]-bottom[0])<1e-5,'Upper/lower contours remain aligned');assert(top[1]<=bottom[1]+1e-5,'Upper and lower lip cannot invert');
    }
  }
}
function velocityDifference(a,b,c,h){
  const pa=points(a),pb=points(b),pc=points(c);
  return Math.max(...pb.map((p,i)=>Math.hypot((p[0]-pa[i][0])/h-(pc[i][0]-p[0])/h,(p[1]-pa[i][1])/h-(pc[i][1]-p[1])/h)));
}
function accelerationDifference(a,b,c,d,e,h){
  const pa=points(a),pb=points(b),pc=points(c),pd=points(d),pe=points(e);
  return Math.max(...pc.map((p,i)=>{const left=p.map((v,k)=>(v-2*pb[i][k]+pa[i][k])/(h*h)),right=p.map((v,k)=>(pe[i][k]-2*pd[i][k]+v)/(h*h));return Math.hypot(left[0]-right[0],left[1]-right[1])}));
}
(async()=>{
  const h=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  const explicit=(phone,start,end)=>({word:phone,start,end,timing:'word',explicitEnd:true,phones:[{phone,start,end}]});
  const fixtures=[
    {name:'estimated phrase and tiny gaps',row:{time:0,end:6400,text:'ich bin hier, ich bin frei'}},
    {name:'authoritative A/B/I/F transitions',tokens:[explicit('A',100,500),explicit('B',500,600),explicit('I',600,1000),explicit('F',1000,1100),explicit('A',1100,1500)]},
    {name:'fifty millisecond silence',tokens:[explicit('A',100,500),explicit('I',550,1000)]},
    {name:'long silence and re-entry',tokens:[explicit('A',100,500),explicit('I',900,1500)]},
    {name:'re-entry during smile recovery',tokens:[explicit('UH',100,500),explicit('I',2100,2600)]},
    {name:'long rest and re-entry',tokens:[explicit('UH',100,500),explicit('B',4500,4600),explicit('I',4600,5000)]},
    {name:'initial and final bilabial',tokens:[explicit('B',100,210),explicit('A',210,700),explicit('M',700,820)]},
  ];
  const metrics=[];
  for(const fixture of fixtures){
    h.context.fixture=fixture;
    h.run('var continuityPlan=articulationEngine.compile(fixture.tokens||articulationEngine.buildWords(fixture.row,fixture.row.end,"de"),"de");var continuityMotion=mouthTrajectory.compile(continuityPlan)');
    const plan=h.run('continuityPlan'),motion=h.run('continuityMotion');
    assert(Array.isArray(motion.boundaries),'Compiled trajectory exposes its phase joins for continuity checks');
    const sample=(at,expression={})=>{h.context.sampleTime=at;h.context.sampleExpression=expression;return h.run('mouthTrajectory.sample(continuityMotion,sampleTime,sampleExpression,{playing:true})')};
    const boundaries=[...new Set([...motion.boundaries,...Array.from(plan.segments,s=>s.start),...Array.from(plan.segments,s=>s.end)])];
    for(const boundary of boundaries){
      const coarse=displacement(sample(boundary-.01),sample(boundary+.01));
      const before=sample(boundary-.0001),after=sample(boundary+.0001),fine=displacement(before,after);
      assert(fine<.005,fixture.name+' contains a position jump at '+boundary+': '+fine);
      assert(fine<=coarse*.08+1e-6,fixture.name+' does not converge toward a continuous position at '+boundary);
      assert(Math.abs(before.strokeWidth-after.strokeWidth)<.001,fixture.name+' contains an abrupt stroke-width switch');
      const delta=.001,left=sample(boundary-delta),center=sample(boundary),right=sample(boundary+delta);
      assert(velocityDifference(left,center,right,delta)<.003,fixture.name+' contains a velocity corner at '+boundary);
      const accelerationStep=.01;
      assert(accelerationDifference(sample(boundary-2*accelerationStep),sample(boundary-accelerationStep),center,sample(boundary+accelerationStep),sample(boundary+2*accelerationStep),accelerationStep)<.01,fixture.name+' contains an acceleration corner at '+boundary);
      validate(before);validate(center);validate(after);
    }
    for(let at=-200;at<plan.end+450;at+=17)validate(sample(at,{open:.8,smile:9}));
    for(const segment of Array.from(plan.segments).filter(s=>['B','P','M'].includes(s.phone))){
      const middle=(segment.start+segment.end)/2,pose=sample(middle,{open:1,smile:20}),p=pose.points;
      assert(pose.aperture<1e-6,'A visible closed-lip consonant survives its surrounding smooth movement');
      for(const [a,b]of [[p[0],p[0]],[p[2],p[11]],[p[3],p[10]],[p[4],p[9]],[p[5],p[8]],[p[6],p[7]]])assert(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6,'A closed consonant uses genuinely coincident lip curves');
    }
    const at=plan.start+(plan.end-plan.start)*.53,first=sample(at),later=sample(at+300);sample(plan.start);assert.equal(sample(at).path,first.path,'Sampling/seeking is independent of previous calls');assert(Number.isFinite(later.aperture));
    if(fixture.row){
      for(const fps of [30,60]){
        let maximum=0,legacyMaximum=0,old=sample(0);h.context.sampleTime=0;let oldLegacy=h.run('mouthRig.render(articulationEngine.sample(continuityPlan,sampleTime),{},{playing:true})');
        for(let at=1000/fps;at<6400;at+=1000/fps){const pose=sample(at);h.context.sampleTime=at;const legacy=h.run('mouthRig.render(articulationEngine.sample(continuityPlan,sampleTime),{},{playing:true})');maximum=Math.max(maximum,displacement(old,pose));legacyMaximum=Math.max(legacyMaximum,displacement(oldLegacy,legacy));old=pose;oldLegacy=legacy;}
        assert(maximum<legacyMaximum*.65,'The actual '+fps+' Hz frame movement must improve substantially, not just pass a mathematical boundary test');metrics.push({fps,before:+legacyMaximum.toFixed(3),after:+maximum.toFixed(3)});
      }
    }
  }
  h.run('var holdPlan=articulationEngine.compile([{word:"Ooh",start:100,end:8100,timing:"word",explicitEnd:true}],"en");var holdMotion=mouthTrajectory.compile(holdPlan)');
  const held=at=>h.run(`mouthTrajectory.sample(holdMotion,${at},{},{playing:true})`);
  assert(held(2500).aperture>8,'Held vowels remain visibly open');assert(displacement(held(2500),held(5500))<.01,'A sustained vowel does not chatter or decay unnecessarily');
  h.run('var goodPlan=articulationEngine.compile(articulationEngine.buildWords({time:0,end:4000,text:"I am feeling good",words:[{word:"I",start:0,end:500},{word:"am",start:500,end:1000},{word:"feeling",start:1000,end:2000},{word:"good",start:2000,end:4000}]},4000,"en"),"en");var goodMotion=mouthTrajectory.compile(goodPlan)');
  const good=at=>h.run(`mouthTrajectory.sample(goodMotion,${at},{},{playing:true})`),goodCues=Array.from(h.run('goodMotion.cues')),lastGood=goodCues.at(-1),heldGood=goodCues.at(-2);
  assert.equal(heldGood.source.phone,'UH');assert(heldGood.duration>1500,'Fixture contains an actually long adjacent vowel');assert.equal(lastGood.source.phone,'D');
  assert(lastGood.strength>0&&lastGood.strength<.4,'A brief D still borrows its directly adjacent held vowel, regardless of the vowel midpoint');
  assert(width(lastGood.geometry)<width(heldGood.geometry)*1.5,'Ending good does not double the mouth width on a short D');
  assert(width(good(4160))<48,'After 160 ms the phrase ending has not jumped to the 84-unit grin');
  assert(width(good(5000))<=50,'A short post-phrase rest keeps a small relaxed smile');
  assert.equal(good(5000).aperture,0,'Relaxed recovery is a genuinely closed smile');
  assert(width(good(5500))>width(good(5200))&&width(good(5500))<70,'The full smile begins returning gradually only after the relaxed hold');
  assert.equal(width(good(7000)),84,'Long silence eventually restores the exact familiar broad smile');
  assert(displacement(good(7000),h.run('mouthTrajectory.restGeometry'))<1e-6,'Long-term rest preserves the original character geometry');
  h.context.quickRest=[explicit('UH',0,1000),explicit('I',1800,2300)];h.run('var quickRestMotion=mouthTrajectory.compile(articulationEngine.compile(quickRest))');
  for(let at=1000;at<1800;at+=13){const pose=h.run(`mouthTrajectory.sample(quickRestMotion,${at},{},{playing:true})`);assert.equal(pose.aperture,0,'Authoritative phrase gap stays closed');assert(width(pose)<80,'A short gap never invokes the broad idle grin');}
  h.run('var gapPlan=articulationEngine.compile([{word:"A",start:100,end:500,timing:"word",phones:[{phone:"A",start:100,end:500}]},{word:"I",start:550,end:1000,timing:"word",phones:[{phone:"I",start:550,end:1000}]}])');
  assert.equal(h.run('articulationEngine.sample(gapPlan,525).open'),0,'Visual preparation does not change authoritative gap semantics');
  for(const duration of [.01,1,10,33]){
    h.context.tiny=[explicit('A',0,100),explicit('B',100,100+duration),explicit('F',100+duration,200+duration)];
    h.run('var tinyMotion=mouthTrajectory.compile(articulationEngine.compile(tiny))');
    for(const at of [0,99,100,100+duration/2,100+duration,180,300])validate(h.run(`mouthTrajectory.sample(tinyMotion,${at},{open:1},{playing:true})`));
  }
  for(const performance of ['quality','tv']){
    const frame=harness({preferences:{season:'off',surprises:false,tempoLookup:false,performance}});
    frame.run('playback={is_playing:true,progress_ms:0,item:{id:"continuous-mouth",duration_ms:5000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:2000,text:"bin hier",language:"de",words:[{word:"bin",start:100,end:700},{word:"hier",start:700,end:1900}]}])');
    frame.step(1000,1000/60);assert(frame.run('!!vibeMouthTrajectory'),'The real frame loop uses its compiled trajectory');
    assert(frame.run('!!lastRenderedMouth'),'The real rendered mouth is exposed for diagnostics');validate(frame.run('lastRenderedMouth'));
    const count=frame.run('vibeArticulationCompiles');frame.step(300,1000/60);assert.equal(frame.run('vibeArticulationCompiles'),count,'Frames reuse the trajectory instead of compiling every time');
    assert.equal(frame.frames.size,1,'Smoother mouth adds no animation loop');
  }
  const line=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  line.run('playback={is_playing:true,progress_ms:0,item:{id:"line-boundary",duration_ms:3000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:1000,text:"A",words:[{word:"A",start:200,end:900,phones:[{phone:"A",start:200,end:900}]}]},{time:1000,end:2000,text:"I",words:[{word:"I",start:1000,end:1900,phones:[{phone:"I",start:1000,end:1900}]}]}]);updateVibeVocalReaction(999.99);updateVibeMotion(999.99);var beforeRowMouth=lastRenderedMouth;updateVibeVocalReaction(1000.01);updateVibeMotion(1000.01)');
  assert(displacement(line.run('beforeRowMouth'),line.run('lastRenderedMouth'))<.005,'Recompiling adjacent lyric rows preserves the ongoing geometric motion');
  for(const gap of [400,1600,4000]){
    const rebuild=harness({preferences:{season:'off',surprises:false,tempoLookup:false}}),boundary=1000+gap;
    rebuild.context.rows=[{time:0,end:boundary,text:'good',words:[{word:'good',start:0,end:1000,phones:[{phone:'G',start:0,end:65},{phone:'UH',start:65,end:935},{phone:'D',start:935,end:1000}]}]},{time:boundary,end:boundary+1500,text:'I',words:[{word:'I',start:boundary+300,end:boundary+1400,phones:[{phone:'I',start:boundary+300,end:boundary+1400}]}]}];
    rebuild.run('playback={is_playing:true,progress_ms:0,item:{id:"silence-recompile",duration_ms:10000}};lastPollAt=performance.now();renderSyncedLyrics(rows);ensureArticulationPlan(0);var oldRowMotion=vibeMouthTrajectory;ensureArticulationPlan(1);var newRowMotion=vibeMouthTrajectory');
    for(const at of [boundary-.01,boundary,boundary+.01,boundary+100]){
      const before=rebuild.run(`mouthTrajectory.sample(oldRowMotion,${at},{},{playing:true})`),after=rebuild.run(`mouthTrajectory.sample(newRowMotion,${at},{},{playing:true})`);
      assert(displacement(before,after)<1e-6,'Row recompilation preserves relaxation and preparation during '+gap+' ms of real silence');
      assert(Math.abs(before.strokeWidth-after.strokeWidth)<1e-6,'A row replacement does not reset the recovering stroke width');
    }
  }
  const resume=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  resume.run('playback={is_playing:true,progress_ms:500,item:{id:"resume-mouth",duration_ms:5000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:3000,text:"A",words:[{word:"A",start:0,end:3000,phones:[{phone:"A",start:0,end:3000}]}]}]);updateVibeVocalReaction(500);updateVibeMotion(500);playback.is_playing=false;playback.progress_ms=500');
  resume.step(220,1000/60);const paused=resume.run('lastMouthFrame');validate(paused);assert.equal(paused.aperture,0);
  resume.run('playback.is_playing=true;lastPollAt=performance.now();updateVibeVocalReaction(500);updateVibeMotion(500)');
  assert(displacement(paused,resume.run('lastMouthFrame'))<.005,'Resume starts at the actual paused geometry instead of jumping directly to a held vowel');
  resume.step(70,1000/60);const intermediate=resume.run('lastMouthFrame');assert(intermediate.aperture>0&&intermediate.aperture<21.64,'Resume visibly progresses through intermediate geometry');
  resume.step(100,1000/60);assert(resume.run('lastMouthFrame.aperture')>15,'Resume reaches the existing held-vowel trajectory without freezing');
  resume.run('playback.is_playing=false;playback.progress_ms=670');resume.step(220,1000/60);
  resume.run('playback.is_playing=true;lastPollAt=performance.now();updateVibeVocalReaction(670);updateVibeMotion(670)');resume.step(30,1000/60);
  resume.run('renderSyncedLyrics([{time:0,end:3000,text:"B",words:[{word:"B",start:0,end:3000,phones:[{phone:"B",start:0,end:3000}]}]}]);updateVibeVocalReaction(700);updateVibeMotion(700)');
  assert.equal(resume.run('lastMouthFrame.aperture'),0,'New source cues clear a pending resume blend rather than retaining the old open vowel');
  console.log('PASS continuous rendered mouth geometry/stroke, velocity/acceleration joins, lips seals, delayed smile recovery, held-vowel consonants, gaps, deterministic sampling, row recompilation, tiny cues and shared 30/60 Hz rendering. '+JSON.stringify(metrics));
})().catch(error=>{console.error(error);process.exitCode=1});
