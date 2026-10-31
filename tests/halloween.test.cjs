const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const yaml=`version: '1.0'
metadata:
  title: Testaufnahme
  artist: SpotDeck
lines:
  - text: "water, hello"
    start_ms: 500
    end_ms: 2400
    words:
      - text: "water "
        start_ms: 1000
        end_ms: 1400
      - text: hello
        start_ms: 1900
        end_ms: 2300
  - text: "water, hello"
    start_ms: 4000
    end_ms: 6000
`;
function parse(h,text){h.context.input=text;return h.run('parseLyricsfile(input)')}
function setupOwned(h){
  const audio=h.nodes.get('ownedAudio');audio.currentTime=0;audio.duration=20;audio.volume=.5;audio.paused=true;
  audio.play=async()=>{audio.paused=false;h.event(audio,'play')};audio.pause=()=>{if(!audio.paused){audio.paused=true;h.event(audio,'pause')}};
  h.run('ownPlayback.file={name:"test.wav"};ownedRights.checked=true');return audio;
}
(async()=>{
  const h=harness();
  assert.equal(h.run('facePreferences.halloween'),false);assert.equal(h.run('facePreferences.party'),false);
  assert.equal(h.run('beatEngine.bpm'),null);assert(h.nodes.get('beatDiagnostic').textContent.includes('keine Spotify'));
  h.run('facePreferences.halloween=true;facePreferences.surprises=false;applyPartyPreferences()');
  assert.equal(h.nodes.get('app').dataset.halloween,'true');
  for(const kind of ['ghost','bat','pumpkin','vampire','magic','skeleton','coverGhost','spider','shadow','flyingPumpkin']){
    assert(h.run(`beginHalloween('${kind}')`));assert(!h.run("beginHalloween('ghost')"),'No overlapping major scenes');
    h.step(1450);assert(h.run('effects.active.stage>=1'));
    h.step(9000);assert.equal(h.run('effects.active'),null);assert.equal(h.nodes.get('halloweenLayer').innerHTML,'');
    assert(!h.nodes.get('coverGhost').classList.contains('visible'));
  }
  h.run("beginHalloween('ghost');queueEffect({kind:'halloween',name:'bat'})");
  h.run('facePreferences.halloween=false;applyPartyPreferences()');
  assert.equal(h.run('effects.active'),null);assert.equal(h.run('effects.queue.length'),0);
  assert.equal(h.nodes.get('vibeFace').dataset.halloweenScene,undefined);
  assert.equal(h.frames.size,1);assert(h.timers.size<8,'No growing scene timer collection');
  console.log('PASS all ten scenes, stage progression, single-scene limit, expiry, mode-off cleanup and bounded timers/RAF.');

  h.run('effects.queue=[];effects.last.clear()');
  for(let i=0;i<30;i++)h.run(`queueEffect({kind:'emotion',name:'grin',key:'test${i}',priority:${i},ttl:500})`);
  assert.equal(h.run('effects.queue.length'),8);assert.equal(h.run('effects.queue[0].priority'),29);
  h.step(700);assert.equal(h.run('effects.queue.length'),0,'Expired events cannot fire late');
  h.run('vibeExpressionEnd=0;vibeTapReactionUntil=0;startVibeExpression("startled",3000,5);startVibeExpression("grin",3000,1)');
  assert.equal(h.run('vibeExpression'),'startled','Low priority emotion does not replace a high priority reaction');
  console.log('PASS bounded priority queue, expiry, cooldown and emotion priority.');

  for(const raw of [70,140,280]){
    h.run(`beatEngine.reset('owned');beatEngine.setTempo(${raw},'manual')`);
    assert.equal(h.run('beatEngine.bpm'),raw);assert.equal(h.run('beatEngine.danceBpm()'),140);
    h.run('beatEngine.factor=.5');assert.equal(h.run('beatEngine.danceBpm()'),70);
    h.run('beatEngine.factor=2');assert.equal(h.run('beatEngine.danceBpm()'),280);
  }
  h.run("beatEngine.reset('owned');beatEngine.setTempo(120);beatEngine.anchor(1000,true,0,true)");
  assert.equal(h.run('beatEngine.positionAt(1000)'),2000);
  h.run('beatEngine.anchor(2050,true,1000)');assert.equal(h.run('beatEngine.positionAt(1000)'),2000,'Small polling jitter is not an immediate jump');
  h.run('beatEngine.anchor(2400,false,1400)');assert.equal(h.run('beatEngine.positionAt(9000)'),2400,'Pause freezes phase');
  h.run('beatEngine.anchor(2400,true,9000)');assert.equal(h.run('beatEngine.positionAt(9500)'),2900);
  h.run('beatEngine.anchor(12000,true,10000,true)');assert.equal(h.run('beatEngine.positionAt(10000)'),12000,'Seek reconstructs phase');
  h.run('beatEngine.offset=125');assert(Math.abs(h.run('beatEngine.state(10000).phase')-.75)<.001);
  h.run("beatEngine.reset('owned');[0,500,1000,1500].forEach(t=>beatEngine.tap(t))");
  assert.equal(h.run('beatEngine.source'),'tap');assert.equal(h.run('beatEngine.bpm'),120);
  for(const bpm of [70,140,280]){
    h.run(`beatEngine.reset('owned');for(let i=0;i<20;i++)beatEngine.onset(i*60000/${bpm},1)`);
    assert.equal(h.run('beatEngine.source'),'onset');assert(Math.abs(h.run('beatEngine.bpm')-140)<.01);assert(h.run('beatEngine.confidence')>.35);
  }
  console.log('PASS raw vs dance BPM, 70/140/280 half/double tempo, jitter correction, pause/resume, seek, phase offset, tap and synthetic onset estimates.');

  const rows=parse(h,yaml);assert.equal(rows[0].words[0].start,1000);assert.equal(rows[0].timing,'word');
  assert.throws(()=>parse(h,yaml.replace('start_ms: 1000','start_ms: -1')));
  assert.throws(()=>parse(h,yaml.replace('end_ms: 1400','end_ms: 300')));
  assert.throws(()=>parse(h,yaml.replace('  artist: SpotDeck','  artist: SpotDeck\n  artist: duplicate')));
  assert.throws(()=>parse(h,yaml.replace('title: Testaufnahme','title: &x Testaufnahme')));
  assert.throws(()=>parse(h,yaml.replace('title: Testaufnahme','title: !!js/function anything')));
  assert.throws(()=>parse(h,yaml.replace("version: '1.0'","version: '9.0'")));
  assert.throws(()=>parse(h,yaml.replace('  artist: SpotDeck','  artist: SpotDeck\n  offset_ms: 120')));
  h.context.record={hasWordSync:true,lyricsfile:'invalid: [',syncedLyrics:'[00:02.00]fallback'};
  assert.equal(h.run('parseLyricsRecord(record)[0].time'),2000);
  h.context.record={hasWordSync:true,lyricsfile:yaml,syncedLyrics:'[00:00.00]wrong'};
  assert.equal(h.run('parseLyricsRecord(record)[0].words[0].start'),1000);
  h.context.rows=rows;h.run('syncedLyrics=rows');
  assert.equal(h.run('buildVibeSpeechPlan(0)[0].timing'),'word');assert.equal(h.run('buildVibeSpeechPlan(0)[1].start'),1900);
  h.run('syncedLyrics=[{time:0,text:"Hello, hello oooh!"},{time:4000,text:"next"}]');
  const plan=h.run('buildVibeSpeechPlan(0)');assert.equal(plan.length,3);assert.equal(plan[0].timing,'estimated');
  assert(plan[1].start>plan[0].end);assert(plan[2].end<=4000);assert(plan[2].end-plan[2].start>plan[0].end-plan[0].start);
  console.log('PASS actual YAML parser, validation, invalid-word fallback, word timestamps, punctuation pauses, repetitions and stretched syllables.');

  const own=harness(),audio=setupOwned(own);await own.run('startOwnedAudio()');
  assert(own.run('ownPlayback.active'));assert.equal(own.nodes.get('app').dataset.audioSource,'owned');
  own.context.rows=rows;own.run('ownPlayback.lyrics=rows;renderSyncedLyrics(rows);facePreferences.lyricsOffset=200;vibeSpeechTrack="owned-audio"');
  own.run('updateVibeVocalReaction(1199)');assert.equal(own.run('effects.queue.length'),0,'Word cue cannot fire before its actual start plus offset');
  own.run('updateVibeVocalReaction(1200)');assert(own.run('effects.queue.length')>0);
  own.run('updateVibeVocalReaction(1700)');assert.equal(own.run('vibeSpeech.open'),0,'Real word gaps close the singing mouth');
  await own.run('seekPlayback(7000)');assert.equal(audio.currentTime,7);assert.equal(own.run('effects.queue.length'),0);
  await own.run('playPause()');assert(audio.paused);await own.run('playPause()');assert(!audio.paused);
  await own.run('setVolume(30)');assert.equal(audio.volume,.3);
  own.nodes.get('ownedRights').checked=false;own.event(own.nodes.get('ownedRights'),'change');assert(!own.run('ownPlayback.active'));assert(audio.paused);
  console.log('PASS permitted local source, rights gate, exact cue/offset, word gaps, seeking, pause/resume, volume and rights revocation.');

  const denied=harness({session:true,fetcher:async(url,opts,res)=>url.endsWith('/me/player/pause')?res(null,403):res(null,204)});await denied.flush();const deniedAudio=setupOwned(denied);
  await denied.run('startOwnedAudio()');assert(!denied.run('ownPlayback.active'));assert(deniedAudio.paused);
  assert.equal(denied.requests.filter(r=>r.url.includes('/audio-features')).length,0);
  const spotify=harness({session:true});await spotify.flush();
  spotify.run('renderPlayback({is_playing:true,progress_ms:2000,device:{id:"external"},item:{id:"a",type:"track",name:"Song",duration_ms:20000,album:{images:[]},artists:[]}})');
  spotify.step(2000);assert.equal(spotify.run('beatEngine.bpm'),null);assert.equal(spotify.run('vibeSpeech.open'),0);
  assert(!spotify.requests.some(r=>r.url.includes('/audio-features')),'No deprecated Spotify audio analysis requests');
  console.log('PASS no protected stream analysis, failed Spotify pause blocks test audio, and no false fixed-BPM detection.');

  const party=harness({preferences:{party:true,halloween:true,surprises:false}});
  party.step(8500);assert.equal(party.nodes.get('app').dataset.controlsHidden,'true');
  party.event(party.document,'pointermove');assert.equal(party.nodes.get('app').dataset.controlsHidden,'false');
  party.step(8500);party.event(party.document,'keydown',{key:'Enter'});assert.equal(party.nodes.get('app').dataset.controlsHidden,'false');
  party.run('openSettingsPanel()');party.step(9000);assert.equal(party.nodes.get('app').dataset.controlsHidden,'false','Open dialogs prevent hiding');
  party.event(party.nodes.get('partyExit'),'click');assert.equal(party.run('facePreferences.party'),false);
  assert.equal(JSON.parse(party.store.get('spotdeck.facePreferences')).halloween,true);
  party.run('beginHalloween("spider")');party.document.visibilityState='hidden';party.event(party.document,'visibilitychange');assert.equal(party.run('effects.active'),null);assert.equal(party.frames.size,0);
  party.document.visibilityState='visible';party.event(party.document,'visibilitychange');assert.equal(party.frames.size,1);
  console.log('PASS party idle hiding, pointer/keyboard wake, dialog guard, exit, saved preferences and hidden-tab scene cleanup.');

  const edge=harness({preferences:{halloween:'yes',party:'yes',effects:'bad',manualBpm:-100,tempoFactor:99}});
  assert.equal(edge.run('facePreferences.halloween'),false);assert.equal(edge.run('facePreferences.effects'),'normal');assert.equal(edge.run('facePreferences.manualBpm'),0);
  for(const [level,min,max]of [['few',75000,90000],['normal',45000,75000],['many',30000,45000]]){
    edge.run(`facePreferences.effects='${level}'`);const gap=edge.run('sceneGap()');assert(gap>=min&&gap<=max);
  }
  edge.run('facePreferences.halloween=true;ownPlayback.active=true;effects.queue=[];queueWordReaction(matchVibeTheme("night"),{word:"night",timing:"word"},1000)');
  assert.equal(edge.run('effects.queue[0].kind'),'emotion','Ambiguous words do not launch a large scene');
  assert.equal(edge.run('matchVibeTheme("geliebt").key'),'love');assert.equal(edge.run('matchVibeTheme("loved").key'),'love');
  edge.context.rows=rows;edge.run('renderSyncedLyrics(rows)');assert.equal(edge.run('syncedLyrics[1].refrain'),true);
  edge.run('beatEngine.setTempo(140,"manual");facePreferences.manualBpm=140');edge.event(edge.nodes.get('autoTempo'),'click');assert.equal(edge.run('beatEngine.bpm'),null);
  const late=harness();let finishRead;
  late.context.lyricFile={size:yaml.length,name:'test.yaml',text:()=>new Promise(resolve=>{finishRead=resolve})};
  const importing=late.run('importOwnedLyrics(lyricFile)');late.run('ownPlayback.epoch++');finishRead(yaml);await importing;
  assert.equal(late.run('ownPlayback.lyrics.length'),0,'A late lyric import cannot overwrite a changed source');
  console.log('PASS preference validation, frequency bounds, ambiguous-word restraint, word variants, repeated-line detection, auto-tempo reset and stale import cancellation.');
  // Measure actual DOM updates against the common frame clock on a 60 Hz display.
  for(const [profile,motion,min,max]of [['auto','normal',55,61],['quality','normal',55,61],['tv','normal',28,31],['quality','reduced',14,16]]){
    const smooth=harness({preferences:{performance:profile,motion,halloween:true,surprises:false,tempoLookup:false}});
    smooth.run('playback={is_playing:true,progress_ms:0,item:{id:"smooth",duration_ms:30000}};syncedLyrics=[{time:0,text:"Synthetic vowel movement"},{time:5000,text:"next"}];setDebug(true);beginHalloween("bat")');
    let mouthWrites=0,effectWrites=0,maxMouthGap=0,maxEffectGap=0,lastMouthAt=0,lastEffectAt=0;
    const mouth=smooth.nodes.get('faceMouthPath'),setAttribute=mouth.setAttribute;
    mouth.setAttribute=function(key,value){if(key==='d'){const now=smooth.run('performance.now()');maxMouthGap=Math.max(maxMouthGap,now-lastMouthAt);lastMouthAt=now;mouthWrites++}setAttribute.call(this,key,value)};
    const layer=smooth.nodes.get('halloweenLayer'),setProperty=layer.style.setProperty;
    layer.style.setProperty=function(key,value){if(key==='--spook-progress'){const now=smooth.run('performance.now()');maxEffectGap=Math.max(maxEffectGap,now-lastEffectAt);lastEffectAt=now;effectWrites++}setProperty.call(this,key,value)};
    smooth.step(1000,1000/60);
    const frames=smooth.run('runtime.sections["body-mouth"].count');
    assert(frames>=min&&frames<=max,profile+' '+motion+' frame cadence: '+frames);
    assert.equal(mouthWrites,frames,'Mouth morphs on every body frame');
    assert.equal(effectWrites,frames,'Halloween transforms update on every body frame');
    assert.equal(smooth.run('runtime.sections.vocal.count'),frames,'Fresh vocal target on each frame');
    assert.equal(smooth.run('runtime.sections.effects.count'),frames,'Scene lifecycle shares the frame');
    assert(maxMouthGap<=(motion==='reduced'?84:profile==='tv'?51:35));
    assert(maxEffectGap<=(motion==='reduced'?84:profile==='tv'?51:35));
    assert.equal(smooth.nodes.get('vibeFace').style['--spook-progress'],undefined,'Scene properties stay within the effect subtree');
    assert.equal(smooth.frames.size,1,'No additional animation loop');
    smooth.document.visibilityState='hidden';smooth.event(smooth.document,'visibilitychange');assert.equal(smooth.frames.size,0);
  }
  console.log('PASS 60 Hz auto/quality, 30 Hz TV and reduced-motion cadence; mouth, vocal cues and Halloween share every body frame, with hidden-tab cleanup.');
  const optimized=harness({preferences:{party:true,halloween:true,performance:'tv',motion:'normal'}});
  let gridWrites=0;
  const appStyle=optimized.nodes.get('app').style;
  const write=appStyle.setProperty;
  appStyle.setProperty=function(key,value){if(key==='--party-expansion')gridWrites++;write.call(this,key,value)};
  optimized.step(9000);
  assert.equal(gridWrites,1,'Party grid switches once, not once per animation step');
  const settledWrites=gridWrites;optimized.step(2000);assert.equal(gridWrites,settledWrites);
  optimized.event(optimized.document,'pointermove');optimized.step(800);
  assert.equal(gridWrites,2,'Wake performs one reverse layout switch');
  optimized.run('triggerVibeEasteregg()');
  assert.equal((optimized.nodes.get('faceEasteregg').innerHTML.match(/class="egg-confetti"/g)||[]).length,6);
  optimized.run('setDebug(true);runtime.slowWindows=1;facePreferences.performance="auto";runtime.windowAt=1;runtime.lastFrame=0;runtime.frames=100;runtime.frameTotal=6000;observeFrame(6001,1)');
  assert.equal(optimized.run('effectivePerformance()'),'tv','Auto mode responds to measured slow frames');
  optimized.run('facePreferences.performance="quality";applyPerformance()');
  assert.equal(optimized.run('effectivePerformance()'),'quality','Explicit quality overrides automatic fallback');
  assert.equal(optimized.frames.size,1);
  console.log('PASS single layout change per Party transition, settled grid, TV particle bound and measured automatic quality fallback.');
})().catch(error=>{console.error(error);process.exitCode=1});
