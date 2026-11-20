const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const restPoints=[[8,8],[92,8],[13,25],[31.5,33.5],[50,33.5],[68.5,33.5],[87,25],[87,25],[68.5,33.5],[50,33.5],[31.5,33.5],[13,25]];
const points=pose=>pose.points.length===12?pose.points:restPoints;
const displacement=(a,b)=>Math.max(...points(a).map((p,i)=>Math.hypot(p[0]-points(b)[i][0],p[1]-points(b)[i][1])));
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
(async()=>{
  const h=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  const explicit=(phone,start,end)=>({word:phone,start,end,timing:'word',explicitEnd:true,phones:[{phone,start,end}]});
  const fixtures=[
    {name:'estimated phrase and tiny gaps',row:{time:0,end:6400,text:'ich bin hier, ich bin frei'}},
    {name:'authoritative A/B/I/F transitions',tokens:[explicit('A',100,500),explicit('B',500,600),explicit('I',600,1000),explicit('F',1000,1100),explicit('A',1100,1500)]},
    {name:'fifty millisecond silence',tokens:[explicit('A',100,500),explicit('I',550,1000)]},
    {name:'long silence and re-entry',tokens:[explicit('A',100,500),explicit('I',900,1500)]},
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
  console.log('PASS continuous rendered mouth geometry/stroke and velocity joins, lips seals, gaps, held vowels, deterministic sampling, tiny cues and shared 30/60 Hz rendering. '+JSON.stringify(metrics));
})().catch(error=>{console.error(error);process.exitCode=1});
