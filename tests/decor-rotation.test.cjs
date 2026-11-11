const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
(async()=>{
  for(const magicMode of [false,true])for(let mask=0;mask<8;mask++){
    const disabled=['candles','lights','baubles'].filter((_,i)=>mask&(1<<i));
    const h=harness({preferences:{season:'winter',magicMode,tempoLookup:false,surprises:false,festiveDisabled:disabled}});
    let first=null;
    for(const now of [0,45000,91000,300000,900000,3600000]){
      const shown=Array.from(h.run("['candles','lights','baubles'].filter(id=>festiveWorld.ambientOn(id,"+now+"))"));
      assert(!(shown.includes('candles')&&(shown.includes('lights')||shown.includes('baubles'))));
      assert(shown.every(id=>!disabled.includes(id)));
      if(first)assert.deepEqual(shown,first,'The selected arrangement never changes with elapsed time');else first=shown;
      assert.equal(shown.includes('candles'),magicMode&&!disabled.includes('candles'));
    }
  }
  const h=harness({preferences:{season:'winter',tempoLookup:false,surprises:false}});
  assert.equal(h.run('facePreferences.magicMode'),false);assert.equal(h.nodes.get('magicModeSetting').checked,false);
  assert(!h.run('beginWinter("wand")'),'Magic is opt-in');
  h.nodes.get('magicModeSetting').checked=true;h.event(h.nodes.get('magicModeSetting'),'change');
  assert(h.run('facePreferences.magicMode&&festiveWorld.ambientOn("candles",0)'));
  assert(!h.run('festiveWorld.ambientOn("lights",0)'));
  assert(h.run('beginWinter("wand")'));h.nodes.get('magicModeSetting').checked=false;h.event(h.nodes.get('magicModeSetting'),'change');
  assert.equal(h.run('effects.active'),null,'Turning magic off cancels an active magic scene');
  assert(h.run('festiveWorld.ambientOn("lights",0)'));
  const stored=JSON.parse(h.store.get('spotdeck.facePreferences'));assert.equal(stored.magicMode,false);
  const restored=harness({preferences:{...stored,magicMode:true,festiveDisabled:['wand','candles']}});
  assert.equal(restored.nodes.get('magicModeSetting').checked,true,'The mode survives a reload');
  assert(!restored.run('festiveEnabled("wand")||festiveEnabled("candles")'),'Mode changes preserve individual off switches');
  h.run('festiveWorld.preview("candles")');assert(h.run('festiveWorld.ambientOn("candles",1000)&&!festiveWorld.ambientOn("lights",1000)'));
  h.run('festiveWorld.preview("lights")');assert(!h.run('festiveWorld.ambientOn("candles",1000)'));
  h.run('facePreferences.ambient=false;festiveWorld.configure();festiveWorld.preview("candles")');
  assert(h.run('festiveWorld.ambientOn("candles",1000)'));assert(!h.run('festiveWorld.ambientOn("candles",13000)'));
  console.log('PASS fixed decoration modes, all switch combinations, opt-in magic, persistence, cancellation and previews.');

  const elf=harness({preferences:{season:'winter',magicMode:true,tempoLookup:false,surprises:false}});
  elf.step(95000);assert.equal(elf.run('festiveWorld.choose()'),'elf','The elf receives the next free slot once due');
  elf.run('beginWinter("elf")');assert(!elf.run('festiveWorld.ambientOn("candles",performance.now())'),'Repair gets an uninterrupted light arrangement');
  elf.step(15000);assert(elf.run('festiveWorld.ambientOn("candles",performance.now())'),'The selected mode returns after repair');
  elf.step(240000);assert.equal(elf.run('festiveWorld.choose()'),'elf','The elf cannot get lost behind a full scene bag');
  elf.run('facePreferences.festiveDisabled=["elf"];festiveWorld.configure();festiveWorld.elfNextAt=0');assert.notEqual(elf.run('festiveWorld.choose()'),'elf');
  for(const [level,min,max]of [['few',180000,240000],['normal',90000,150000],['many',60000,90000]]){
    elf.run('facePreferences.effects="'+level+'"');const gap=elf.run('sceneGap()');assert(gap>=min&&gap<=max);
  }
  assert.equal(elf.frames.size,1);
  console.log('PASS recurring elf slots, protected repair, mode restoration, opt-out, longer gaps and shared RAF.');

  for(const [width,height]of [[844,390],[390,844],[1920,1080]]){
    const snow=harness({width,height,preferences:{season:'winter',tempoLookup:false,surprises:false}});
    snow.run('winterSnow.clear();winterSnow.flakes=[];for(var round=0;round<1000;round++)for(var cell=0;cell<128;cell++)winterSnow.deposit((cell+.5)/128*winterSnow.width,100)');
    const active=snow.run('winterSnow.floor.reduce((a,b)=>a+b,0)'),capacity=snow.run('winterSnow.floorCapacity()*128');
    assert(active<=capacity+.001,'Accumulated floor snow has a real mass cap');
    assert(snow.run('winterSnow.floorBase()-winterSnow.floorY(64)')<=Math.min(16,height*.028),'The visible layer remains thin');
    assert(snow.run('winterSnow.meltedMass')>0);
    snow.run('winterSnow.floor[64]+=10000');const before=snow.run('winterSnow.totalMass()');
    snow.run('for(var i=0;i<200;i++)winterSnow.step(.05,i*50)');
    assert(Math.abs(snow.run('winterSnow.totalMass()')-before)<.001,'Transferred and melted snow stays accounted for');
    snow.run('facePreferences.surprises=true;effects.active=null;winterSnow.shovelNext=0;winterSnow.stepShoveler(.02,100000)');assert(snow.run('!!winterSnow.shoveler'),'The child still responds to the thinner pile');
    snow.run('winterSnow.clear()');assert.equal(snow.run('winterSnow.totalMass()'),0);
  }
  console.log('PASS bounded snow during long accumulation, thin piles, gradual melting, accounting and shovelling.');
})().catch(error=>{console.error(error);process.exitCode=1});
