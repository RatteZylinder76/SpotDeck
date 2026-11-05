const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
function checkedCanvas(ctx){
  let depth=0,ops=0,alpha=1;
  Object.defineProperty(ctx,"globalAlpha",{configurable:true,get:()=>alpha,set:value=>{assert(Number.isFinite(value)&&value>=0&&value<=1,"Canvas opacity must be finite and within range");alpha=value}});
  for(const method of ['translate','rotate','scale','moveTo','lineTo','quadraticCurveTo','fillRect','arc','ellipse']){const original=ctx[method];ctx[method]=function(...values){assert(values.every(Number.isFinite),method+' received a nonfinite coordinate');if(method==='arc')assert(values[2]>=0);if(method==='ellipse')assert(values[2]>=0&&values[3]>=0);ops++;return original.apply(this,values)}}
  const save=ctx.save,restore=ctx.restore;ctx.save=function(){depth++;save.call(this)};ctx.restore=function(){depth--;assert(depth>=0,'Canvas restore underflow');restore.call(this)};
  return {get depth(){return depth},get ops(){return ops}};
}
(async()=>{
  const h=harness({preferences:{season:'winter',tempoLookup:false,surprises:false}});
  assert.equal(h.run('festiveFeatures.length'),20);
  assert.equal(h.run('new Set(festiveFeatures.map(f=>f.id)).size'),20);
  assert.equal(h.run('festiveFeatures.filter(f=>f.type==="ambient").length'),6);
  assert.equal(h.nodes.get('festiveFeatureList').children.length,20);
  assert.equal(h.nodes.get('winterPreviewChoice').children.length,26);
  const ambient=checkedCanvas(h.nodes.get('festiveAmbient').getContext()),story=checkedCanvas(h.nodes.get('festiveStory').getContext());
  const ids=h.run('festiveFeatures.filter(f=>f.duration).map(f=>f.id)');
  for(const id of ids){
    h.context.id=id;h.run('clearHalloween();festiveWorld.clearResidue()');
    assert(h.run('beginWinter(id)'));assert(h.run('Number.isFinite(effects.active.end)'));
    assert(!h.run('beginWinter("hat")'),'Stories cannot overlap');
    const before=story.ops;
    for(const fraction of [.05,.3,.55,.8,.95]){h.context.fraction=fraction;h.run('var festiveTestDuration=festiveById.get(id).duration;effects.active.start=performance.now()-festiveTestDuration*fraction;effects.active.end=effects.active.start+festiveTestDuration;tickWinterScene(performance.now());festiveWorld.tick(performance.now())')}
    assert(story.ops>before,id+' draws a distinct scene');assert.equal(story.depth,0);assert.equal(ambient.depth,0);
    if(id==='gifts')assert.equal(h.run('festiveWorld.props.filter(p=>p.type==="gift").length'),3);
    if(id==='tree')assert(h.run('festiveWorld.props.some(p=>p.type==="tree")'));
    if(id==='chimney')assert(h.run('effects.active.cues.has("present")'));
    if(id==='elf')assert.equal(h.run('festiveWorld.brokenLight'),-1);
    if(id==='angel')assert(h.run('festiveWorld.props.some(p=>p.type==="angel")'));
    if(id==='unwrap')assert(h.run('festiveWorld.props.some(p=>p.type==="tree")'));
    h.step(15000);assert.equal(h.run('effects.active'),null);assert.equal(h.run('festiveWorld.story'),null);assert.equal(h.frames.size,1);
  }
  assert(ambient.ops>0);assert(h.timers.size<12);
  console.log('PASS all 20 catalog entries, controls, 14 story renderers, finite canvas geometry, balanced drawing state, semantic cues, expiry and single RAF.');

  h.run('clearHalloween();festiveWorld.clearResidue();festiveWorld.addProp("gift",.1,-20,performance.now(),{size:25})');
  h.step(10000);assert(h.run('festiveWorld.props[0].landed'),'Gifts settle on the existing floor');
  h.run('festiveWorld.interact(festiveWorld.props[0].x*festiveWorld.width,festiveWorld.props[0].y,8)');
  assert(h.run('festiveWorld.props[0].vx')>0,'Landed gifts can be nudged');
  const beforeX=h.run('festiveWorld.props[0].x');h.step(200);assert(h.run('festiveWorld.props[0].x')>beforeX);
  h.run('const anchor=festiveWorld.ballAnchor(0),ball=festiveWorld.baubles[0];festiveWorld.interact(anchor.x+Math.sin(ball.a)*anchor.length,10+Math.cos(ball.a)*anchor.length,9)');
  assert(h.run('festiveWorld.baubles[0].v')>0,'Baubles receive pointer impulse');
  h.run('for(let i=0;i<40;i++)festiveWorld.interact(10+i%5*15,10+i%4*15,0,performance.now()+i)');assert(h.run('festiveWorld.wipes.length')<=16);assert(h.run('festiveWorld.wipes.length')>0);
  h.run('for(let i=0;i<40;i++)festiveWorld.addProp("gift",.1,200,performance.now())');assert.equal(h.run('festiveWorld.props.length'),8,'Leftover scenery is bounded');
  h.step(105000);assert.equal(h.run('festiveWorld.props.length'),0,'Residue expires');assert.equal(h.run('festiveWorld.wipes.length'),0);
  console.log('PASS gift landing/pushing, bauble pendulum, wipeable frost and bounded/expiring scenery.');

  h.run('festiveWorld.bag=[]');const rotation=Array.from({length:20},()=>h.run('festiveWorld.choose()'));
  assert.equal(new Set(rotation).size,20,'Every enabled major scene receives a turn before repeats');
  h.nodes.get('festiveFeatureList').children[2].children[1].checked=false;
  h.event(h.nodes.get('festiveFeatureList').children[2].children[1],'change');
  assert.equal(h.run('festiveEnabled("star")'),false);assert(JSON.parse(h.store.get('spotdeck.facePreferences')).festiveDisabled.includes('star'));
  assert(!h.run('beginWinter("star")'));assert(h.run('festiveWorld.preview("star")'),'Explicit preview can inspect disabled ideas');
  const checkbox=h.nodes.get('festiveFeatureList').children[2].children[1];h.event(checkbox,'change');assert.equal(h.run('effects.active'),null,'Switching off cancels a running preview');
  h.run('facePreferences.ambient=false;festiveWorld.configure()');assert(!h.run('festiveWorld.ambientOn("aurora",performance.now())'));
  assert(h.run('festiveWorld.preview("aurora")'));assert(h.run('festiveWorld.ambientOn("aurora",performance.now())'));h.step(13000);assert(!h.run('festiveWorld.ambientOn("aurora",performance.now())'));
  h.run('effects.nextAt=performance.now()+20000;beginWinter("shake")');assert(h.run('effects.nextAt<=performance.now()+20000'),'Head shake cannot indefinitely postpone other stories');
  console.log('PASS fair rotation, individual preference persistence, explicit previews, instant cancellation and independent ambient/master control.');

  for(const profile of ['quality','tv']){
    const bounded=harness({width:3840,height:2160,dpr:2,preferences:{season:'winter',performance:profile,surprises:false,tempoLookup:false}});
    for(const id of ['festiveAmbient','festiveStory'])assert(bounded.nodes.get(id).width*bounded.nodes.get(id).height<=1210000,'High-density canvas backing is bounded');
    bounded.run('beginWinter("train");winterSnow.floor.fill(20)');const mass=bounded.run('winterSnow.totalMass()');bounded.step(60000);
    assert(bounded.run('winterSnow.totalMass()')>=mass,'Plowing does not discard accumulated snow');assert.equal(bounded.frames.size,1);
    bounded.document.visibilityState='hidden';bounded.event(bounded.document,'visibilitychange');const count=bounded.nodes.get('festiveAmbient').getContext().calls;bounded.step(20000);assert.equal(bounded.nodes.get('festiveAmbient').getContext().calls,count);assert.equal(bounded.frames.size,0);
    bounded.document.visibilityState='visible';bounded.event(bounded.document,'visibilitychange');bounded.step(40);assert.equal(bounded.frames.size,1);
  }
  const dock=harness({preferences:{season:"winter",surprises:false,tempoLookup:false}});
  dock.document.querySelector=selector=>selector===".controls"?{getBoundingClientRect:()=>({top:650})}:null;dock.run("festiveWorld.resize(1024,768)");assert.equal(dock.run("festiveWorld.groundY()"),642,"Visible dock reserves a lane for ground actors");dock.run('app.dataset.controlsHidden="true"');assert.equal(dock.run("festiveWorld.groundY()"),762,"Party returns actors to the lower edge after dock hiding");
  const quiet=harness({reduced:true,preferences:{season:'winter',tempoLookup:false,surprises:false}});
  quiet.run('beginWinter("gifts")');quiet.step(7000);assert(quiet.run('festiveWorld.props.every(prop=>prop.landed)'),'Reduced-motion gifts are displayed at rest');
  const angle=quiet.run('festiveWorld.baubles[0].a');quiet.run('festiveWorld.interact(60,65,100)');quiet.step(1000);assert.equal(quiet.run('festiveWorld.baubles[0].a'),angle);
  quiet.nodes.get('seasonSetting').value='off';quiet.event(quiet.nodes.get('seasonSetting'),'change');assert.equal(quiet.nodes.get('festiveStory').hidden,true);assert.equal(quiet.run('festiveWorld.props.length'),0);
  assert.match(html,/#festiveAmbient,#festiveStory\{[^}]*pointer-events:none/);
  assert(html.includes('<path id="faceMouthPath" d="M 8 8 C 18 42 82 42 92 8 C 82 42 18 42 8 8 Z"></path>'));
  console.log('PASS high-density/TV budgets, snow-preserving plowing, hidden-tab pause, reduced-motion variants, off cleanup and original mouth.');
})().catch(error=>{console.error(error);process.exitCode=1});
