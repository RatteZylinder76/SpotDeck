const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
(async()=>{
  const h=harness({preferences:{tempoLookup:false,surprises:false}});
  assert.equal(h.run('activeSeason()'),'winter');
  assert.equal(h.nodes.get('app').dataset.season,'winter');
  assert.equal(h.nodes.get('winterSnow').hidden,false);
  const migrated=harness({storage:{'spotdeck.facePreferences':JSON.stringify({halloween:true,transparency:'reduced',party:true})}});
  assert.equal(migrated.run('activeSeason()'),'winter','Old Halloween preference migrates to the new winter default');
  assert.equal(migrated.run('facePreferences.transparency'),'reduced');
  assert.equal(migrated.run('facePreferences.party'),true);
  const oldChoice=harness({preferences:{season:'halloween'}});
  assert.equal(oldChoice.run('facePreferences.halloween'),true,'Explicit season choice remains available');
  assert.equal(oldChoice.nodes.get('winterSnow').hidden,true);
  for(const name of ['sleigh','hat','scarf','freeze','snowman','shake']){
    assert(h.run('beginWinter("'+name+'")'));
    assert(!h.run('beginWinter("hat")'),'Only one large scene at a time');
    h.step(1000);assert.equal(h.nodes.get('vibeFace').dataset.winterScene,name);
    if(name==='sleigh'){const first=h.nodes.get('vibeFace').style['--gaze-x'];h.step(1200);assert.notEqual(h.nodes.get('vibeFace').style['--gaze-x'],first,'Eyes follow sleigh progress')}
    if(name==='freeze')assert.notEqual(h.run('winterMotion(performance.now()).x'),0,'Cold scene adds shivering');
    h.step(10000);assert.equal(h.run('effects.active'),null);assert.equal(h.nodes.get('winterLayer').innerHTML,'');
  }
  assert.equal(h.frames.size,1);
  assert(html.includes('<path id="faceMouthPath" d="M 8 8 C 18 42 82 42 92 8 C 82 42 18 42 8 8 Z"></path>'),"Original mouth contour is retained");
  assert(!html.includes("#a4cda8"),"The preview placeholder body is never introduced in SpotDeck");
  console.log('PASS season migration, preserved preferences, six scene lifecycles, following gaze, shivering and one animation loop.');

  h.run('winterSnow.clear();winterSnow.resize(800,600);winterSnow.face={left:200,top:100,width:200,height:200};winterSnow.geometryDirty=false;vibeMotion.x=0;vibeMotion.y=0;winterSnow.flakes=[];winterSnow.head.fill(30)');
  const headMass=h.run('winterSnow.totalMass()');
  h.run('winterSnow.releaseHead()');
  assert.equal(h.run('winterSnow.head.reduce((a,b)=>a+b,0)'),0);
  assert.equal(h.run('winterSnow.chunks.length'),16,'Snow leaves the cap as visible falling portions');
  assert(Math.abs(h.run('winterSnow.totalMass()')-headMass)<1e-6,'Shaking transfers mass rather than deleting it');
  h.run('for(let i=0;i<200;i++)winterSnow.step(.05,performance.now()+i*50)');
  assert.equal(h.run('winterSnow.chunks.length'),0);
  assert(Math.abs(h.run('winterSnow.floor.reduce((a,b)=>a+b,0)')-headMass)<1e-6,'All released head snow reaches the floor');
  const beforePush=h.run('winterSnow.totalMass()');
  h.run('winterSnow.floor[65]+=1000');const pushedMass=h.run('winterSnow.totalMass()');
  h.run('winterSnow.push(410,590,30)');
  assert(h.run('winterSnow.chunks.length')>0,'Pointer physically lifts snow');
  assert(h.run('winterSnow.floor[65]')<1000);
  assert(Math.abs(h.run('winterSnow.totalMass()')-pushedMass)<1e-6,'Pointer displacement conserves mass');
  h.run('winterSnow.resize(390,844)');assert(Math.abs(h.run('winterSnow.totalMass()')-pushedMass)<1e-6,'Resize keeps the stored piles');
  assert(beforePush>0);
  h.run('winterSnow.clear();winterSnow.resize(800,600);winterSnow.face={left:200,top:100,width:200,height:200};winterSnow.geometryDirty=false;winterSnow.flakes=[{x:300,y:128,r:2,v:50,phase:0}]');
  h.run('winterSnow.step(.05,1000)');
  assert(h.run('winterSnow.head.reduce((a,b)=>a+b,0)')>0,'Falling flakes accumulate on the head');
  h.run('winterSnow.flakes=[];winterSnow.head.fill(100);facePreferences.surprises=true;winterSnow.capAt=-60000;effects.active=null;winterSnow.step(.02,performance.now())');
  assert.equal(h.run('effects.active.name'),'shake','Heavy snow cap triggers an autonomous shake');
  h.step(600);assert.equal(h.run('winterSnow.head.reduce((a,b)=>a+b,0)'),0);
  console.log('PASS head collision, automatic shake, falling cap snow, floor landing, pointer transfer and resize mass conservation.');

  for(const [performance,width,height,dpr,maxFlakes]of [['quality',1920,1080,2,110],['tv',3840,2160,2,44],['quality',390,844,3,68]]){
    const bounded=harness({width,height,dpr,preferences:{performance,season:'winter',surprises:false,tempoLookup:false}});
    assert(bounded.run('winterSnow.flakes.length')<=maxFlakes);
    assert(bounded.nodes.get('winterSnow').width*bounded.nodes.get('winterSnow').height<2110000,'Canvas backing pixels are capped even on 4K/retina screens');
    bounded.run('winterSnow.flakes=[];for(let i=0;i<200;i++)winterSnow.addChunk(50,100,1,2,10)');
    assert.equal(bounded.run('winterSnow.chunks.length'),64);
    assert.equal(bounded.run('winterSnow.totalMass()'),2000,'Particle bound merges excess portions without losing snow');
    bounded.step(60000);
    assert.equal(bounded.run('winterSnow.floor.length'),128);
    assert(bounded.run('winterSnow.chunks.length')<=64);assert.equal(bounded.frames.size,1);
    assert(bounded.nodes.get('winterSnow').getContext().calls>0,'Canvas drawing is exercised');
    bounded.document.visibilityState='hidden';bounded.event(bounded.document,'visibilitychange');
    const mass=bounded.run('winterSnow.totalMass()');bounded.step(10000);assert.equal(bounded.run('winterSnow.totalMass()'),mass);assert.equal(bounded.frames.size,0);
    bounded.document.visibilityState='visible';bounded.event(bounded.document,'visibilitychange');bounded.step(40);assert.equal(bounded.frames.size,1);
  }
  const quality=harness({preferences:{season:'winter',tempoLookup:false}});
  assert.equal(quality.run('winterSnow.flakes.length'),110);
  quality.run('runtime.autoTV=true;applyPerformance()');assert.equal(quality.run('winterSnow.flakes.length'),44,'Measured TV fallback also lowers the snow budget');
  console.log('PASS TV/mobile/retina bounds, merged chunks, minute-long simulation, hidden-tab pause and automatic performance fallback.');

  const quiet=harness({reduced:true,preferences:{season:'winter',tempoLookup:false}});
  quiet.step(5000);assert.equal(quiet.run('winterSnow.totalMass()'),0,'Reduced motion does not simulate falling flakes');
  quiet.run('beginWinter("freeze")');quiet.step(800);assert.equal(quiet.run('winterMotion(performance.now()).x'),0,'No shivering under reduced motion');
  quiet.nodes.get('seasonSetting').value='off';quiet.event(quiet.nodes.get('seasonSetting'),'change');
  assert.equal(quiet.run('activeSeason()'),'off');assert.equal(quiet.run('effects.active'),null);assert.equal(quiet.nodes.get('winterSnow').hidden,true);
  quiet.nodes.get('seasonSetting').value='winter';quiet.event(quiet.nodes.get('seasonSetting'),'change');
  quiet.run('winterSnow.floor[1]=100');quiet.event(quiet.nodes.get('clearSnow'),'click');assert.equal(quiet.run('winterSnow.totalMass()'),0);
  assert.equal(JSON.parse(quiet.store.get('spotdeck.facePreferences')).season,'winter');
  assert.equal(quiet.run('matchVibeTheme("christmas").key'),'christmas');
  assert.match(html,/id="winterSnow" aria-hidden="true"/);
  assert.match(html,/#winterSnow\{[^}]*pointer-events:none/);
  console.log('PASS reduced motion, explicit season switches, clearing, persistence, Christmas words and nonblocking decorative canvas.');
})().catch(error=>{console.error(error);process.exitCode=1});
