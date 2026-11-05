const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
(async()=>{
  for(let mask=0;mask<8;mask++){
    const disabled=['candles','lights','baubles'].filter((_,i)=>mask&(1<<i));
    const h=harness({preferences:{season:'winter',tempoLookup:false,festiveDisabled:disabled}});
    for(let now=0;now<180000;now+=500){
      const shown=h.run(`['candles','lights','baubles'].filter(id=>festiveWorld.ambientOn(id,${now}))`);
      assert(!(shown.includes('candles')&&(shown.includes('lights')||shown.includes('baubles'))),'Hanging groups never overlap');
      assert(shown.every(id=>!disabled.includes(id)),'Individual off switches remain respected');
      assert(shown.length||mask===7,'No empty alternating slot when an enabled decoration exists');
    }
  }
  const h=harness({preferences:{season:'winter',tempoLookup:false}});
  assert(h.run('festiveWorld.ambientOn("lights",1000)&&festiveWorld.ambientOn("baubles",1000)'));
  assert(h.run('festiveWorld.ambientOn("candles",46000)'));
  assert(h.run('festiveWorld.ambientOn("lights",91000)'),'Both groups return in rotation');
  h.run('festiveWorld.preview("candles")');
  assert(h.run('festiveWorld.ambientOn("candles",1000)&&!festiveWorld.ambientOn("lights",1000)&&!festiveWorld.ambientOn("baubles",1000)'));
  h.run('festiveWorld.preview("lights")');
  assert(!h.run('festiveWorld.ambientOn("candles",1000)'));
  h.run('festiveWorld.preview("baubles")');assert(!h.run('festiveWorld.ambientOn("candles",1000)'));
  h.run('festiveWorld.previewFeature=null;beginWinter("elf")');
  assert(!h.run('festiveWorld.ambientOn("candles",46000)'),'The elf light-repair scene also excludes candles');
  h.run('clearHalloween();facePreferences.ambient=false;festiveWorld.configure();festiveWorld.preview("candles")');
  assert(h.run('festiveWorld.ambientOn("candles",1000)'));assert(!h.run('festiveWorld.ambientOn("lights",1000)'));
  assert(!h.run('festiveWorld.ambientOn("candles",13000)'),'Explicit preview expires with ambient off');
  const quiet=harness({reduced:true,preferences:{season:'winter',tempoLookup:false}});
  assert(!quiet.run('festiveWorld.ambientOn("candles",46000)'),'Reduced motion keeps a stable arrangement');
  quiet.run('festiveWorld.preview("candles")');assert(quiet.run('festiveWorld.ambientOn("candles",1000)'),'Explicit candle preview is still available');
  assert.equal(h.frames.size,1);assert.equal(quiet.frames.size,1);
  console.log('PASS exclusive hanging groups, all switch combinations, recurring slots, previews, elf scene, reduced motion and shared RAF.');
})().catch(error=>{console.error(error);process.exitCode=1});
