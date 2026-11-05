const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
(async()=>{
  const h=harness({preferences:{season:'winter',tempoLookup:false,surprises:false}});
  assert.deepEqual(Array.from(h.run('festiveFeatures.filter(f=>f.group==="magic").map(f=>f.id)')),['wand','levitate','spellbook','broom','candles']);
  h.run('beginWinter("levitate")');h.step(4000);
  assert.equal(h.run('festiveWorld.props.length'),3);
  assert(h.run('festiveWorld.props.every(p=>p.enchanted&&!p.landed&&p.y<festiveWorld.floorAt(p.x*festiveWorld.width)-35)'),'The spell lifts the parcels above the floor');
  const x=h.run('festiveWorld.props[0].x');h.step(600);assert.notEqual(h.run('festiveWorld.props[0].x'),x,'Levitating gifts drift along an orbit');
  h.step(12000);assert.equal(h.run('effects.active'),null);
  assert(h.run('festiveWorld.props.every(p=>!p.enchanted&&p.landed)'),'The spell releases parcels into gravity and they settle');
  h.run('festiveWorld.clearResidue();beginWinter("levitate")');h.step(3500);h.run('clearHalloween()');
  assert(h.run('festiveWorld.props.every(p=>!p.enchanted&&!p.landed)'),'Interrupting a spell releases its hovering props');h.step(6000);assert(h.run('festiveWorld.props.every(p=>p.landed)'));
  h.run('festiveWorld.clearResidue();beginWinter("broom")');h.step(2000);const gaze=h.nodes.get('vibeFace').style['--gaze-x'];h.step(3500);assert.notEqual(h.nodes.get('vibeFace').style['--gaze-x'],gaze,'The original eyes follow the broom');
  assert.equal(h.frames.size,1);assert(h.timers.size<12);
  console.log('PASS five wizard features, actual levitation/orbit, normal and interrupted gravity release, broom gaze and single RAF.');

  const quiet=harness({reduced:true,preferences:{season:'winter',tempoLookup:false,surprises:false}});
  quiet.run('beginWinter("levitate")');quiet.step(4000);
  assert.equal(quiet.run('festiveWorld.props.length'),3);assert(quiet.run('festiveWorld.props.every(p=>p.landed&&!p.enchanted)'),'Reduced motion keeps magic gifts at rest');
  quiet.run('clearHalloween();festiveWorld.preview("candles")');assert(quiet.run('festiveWorld.ambientOn("candles",performance.now())'));quiet.step(1000);assert(quiet.nodes.get('festiveAmbient').getContext().calls>0);
  const saved=harness({preferences:{season:'winter',festiveDisabled:['wand','candles','not-a-feature'],tempoLookup:false}});
  assert.equal(saved.run('festiveEnabled("wand")'),false);assert.equal(saved.run('festiveEnabled("candles")'),false);assert(!saved.run('facePreferences.festiveDisabled.includes("not-a-feature")'));
  assert(!saved.run('beginWinter("wand")'));assert(saved.run('festiveWorld.preview("wand")'),'Explicit preview remains available for disabled magic');
  saved.nodes.get('seasonSetting').value='off';saved.event(saved.nodes.get('seasonSetting'),'change');assert.equal(saved.run('effects.active'),null);assert.equal(saved.nodes.get('festiveAmbient').hidden,true);
  console.log('PASS reduced-motion magic, floating-candle layer, saved/validated switches, manual preview and season-off cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1});
