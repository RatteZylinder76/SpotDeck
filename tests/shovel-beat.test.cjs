const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
(async()=>{
  const h=harness({preferences:{season:'winter',tempoLookup:false}});
  for(const bpm of [72,80,97,120,142,172]){
    const result=h.run(`(()=>{
      const tracker=new LivePulseTracker(),bins=new Uint8Array(1024),wave=new Uint8Array(2048);
      const period=60000/${bpm};
      for(let t=0;t<20000;t+=20){
        const age=((t-237)%period+period)%period,amplitude=age<65?Math.exp(-age/25):0;
        bins.fill(0);for(let i=2;i<9;i++)bins[i]=Math.round(amplitude*240);for(let i=9;i<70;i++)bins[i]=Math.round(amplitude*85);
        for(let i=0;i<wave.length;i++)wave[i]=128+Math.round(amplitude*75*Math.sin(i*.07));
        tracker.sample(bins,wave,48000,2048,t);
      }
      const phaseError=Math.abs(((tracker.origin-237+period/2)%period+period)%period-period/2);
      return {bpm:tracker.bpm,confidence:tracker.confidence,phaseError,count:tracker.peaks.length};
    })()`);
    assert(result.bpm&&Math.abs(result.bpm-bpm)<1.1,`${bpm} BPM detected: ${JSON.stringify(result)}`);
    assert(result.phaseError<45,`Beat grid follows actual pulse onset at ${bpm} BPM`);
    assert(result.confidence>.75);
  }
  h.run('var pulseTest=new LivePulseTracker();for(var i=0;i<24;i++)if(i!==11)pulseTest.onset(237+i*500+(i%3-1)*9,1)');
  assert(Math.abs(h.run('pulseTest.bpm')-120)<1,'Jitter and a missing beat do not lose the tempo');
  h.run('pulseTest.expire(20000)');assert.equal(h.run('pulseTest.bpm'),null,'Silence invalidates the old grid');
  h.run('var longPulse=new LivePulseTracker();for(var i=0;i<90;i++)longPulse.onset(86400237+i*500+(i%4===0?8:0))');
  assert(Math.abs(h.run('longPulse.bpm')-120)<1);assert(h.run('Math.abs(longPulse.lastPeak-longPulse.origin)')<1500,'Long uptime keeps a nearby phase origin');
  h.run('var silenceTest=new LivePulseTracker();var sb=new Uint8Array(1024),sw=new Uint8Array(2048);sw.fill(128);for(var i=0;i<500;i++)silenceTest.sample(sb,sw,48000,2048,i*20)');
  assert.equal(h.run('silenceTest.bpm'),null);
  h.run('var noiseTest=new LivePulseTracker();var seed=17,stamp=0;for(var i=0;i<80;i++){seed=(seed*16807)%2147483647;stamp+=230+seed%550;noiseTest.onset(stamp)}');
  assert.equal(h.run('noiseTest.bpm'),null,'Irregular transients do not earn a stable grid');
  h.run('beatEngine.reset("live");beatEngine.setTempo(120,"live",.95);beatEngine.phaseOrigin=237;beatEngine.offset=40');
  assert(Math.abs(h.run('beatEngine.state(5277).phase'))<1e-8,'Live phase includes origin and user delay');
  console.log('PASS measured spectral pulses, BPM range, phase, missing beats, silence and irregular noise.');

  h.run('winterSnow.clear();winterSnow.resize(800,600);winterSnow.flakes=[];winterSnow.floor.fill(240);festiveWorld.resize(800,600);effects.active=null;winterSnow.stepShoveler(.02,1000)');
  assert(h.run('!!winterSnow.shoveler'),'A child arrives when the pile is high');
  const mass=h.run('winterSnow.totalMass()'),initial=h.run('winterSnow.floor.slice(10,118).reduce((a,b)=>a+b,0)');
  h.run('for(var i=0;i<2300;i++)winterSnow.step(.05,1000+i*50)');
  assert(Math.abs(h.run('winterSnow.totalMass()')-mass)<1e-6,'Shovelling conserves carried, thrown and deposited snow');
  assert(h.run('winterSnow.floor.slice(10,118).reduce((a,b)=>a+b,0)')<initial,'Working area gets gradually cleared into a side bank');
  assert(h.run('winterSnow.chunks.length')<=64);assert.equal(h.frames.size,1);
  h.run('winterSnow.clear();winterSnow.floor.fill(1);winterSnow.stepShoveler(.1,200000)');assert.equal(h.run('winterSnow.shoveler'),null,'Low snow does not summon the child');
  h.run('winterSnow.floor.fill(240);festiveWorld.cover={left:0,right:800,top:50,bottom:600};winterSnow.stepShoveler(.1,200001)');assert.equal(h.run('winterSnow.shoveler'),null,'No route is drawn through the album cover');
  h.run('festiveWorld.cover=null;winterSnow.stepShoveler(.1,200002);winterSnow.shoveler.load=100;winterSnow.floor[50]-=100;facePreferences.surprises=false;winterSnow.stepShoveler(.1,200003)');
  assert.equal(h.run('winterSnow.shoveler'),null);assert(Math.abs(h.run('winterSnow.totalMass()')-mass)<1e-6,'Disabling returns carried snow');
  console.log('PASS automatic shovelling, side banks, conservation, low-snow threshold, cover clearance and clean cancellation.');

  // No personal device is used: all media objects and permissions below are fakes.
  const a=harness({preferences:{tempoLookup:false}});
  a.run(`var mediaCalls=0,stopped=0,closed=0,outputGain=1,lateResolve=null;
    var fakeTrack=()=>({stop(){stopped++},addEventListener(){}});
    var tracks=[fakeTrack(),fakeTrack()];var fakeStream={getTracks:()=>tracks,getAudioTracks:()=>[tracks[0]]};
    navigator.mediaDevices={getUserMedia:async()=>{mediaCalls++;return fakeStream},getDisplayMedia:async()=>{mediaCalls++;return fakeStream}};
    window.AudioContext=class{constructor(){this.state='running';this.sampleRate=48000;this.destination={}}resume(){return Promise.resolve()}close(){closed++;this.state='closed';return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){}}}createGain(){const gain={value:1};Object.defineProperty(gain,'value',{set(v){outputGain=v},get(){return outputGain}});return {gain,connect(){},disconnect(){}}}createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,getByteFrequencyData(b){b.fill(0)},getByteTimeDomainData(b){b.fill(128)},connect(){}}}};
  `);
  assert.equal(a.run('mediaCalls'),0,'Opening SpotDeck never asks for media');
  a.nodes.get('liveBeatSource').value='microphone';await a.run('startLiveBeat()');
  assert.equal(a.run('liveBeat.active'),true);assert.equal(a.run('outputGain'),0,'Captured sound cannot feed back through speakers');
  a.run('liveBeat.tracker.onset(1000);liveBeat.tracker.bpm=120;liveBeat.tracker.confidence=.95;stopLiveBeat()');
  assert.equal(a.run('stopped'),2);assert.equal(a.run('closed'),1);assert.equal(a.run('beatEngine.bpm'),null);
  a.run('navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{lateResolve=resolve})');
  const pending=a.run('startLiveBeat()');a.run('stopLiveBeat();lateResolve(fakeStream)');await pending;
  assert.equal(a.run('liveBeat.active'),false);assert.equal(a.run('stopped'),4,'Late permission grant is immediately released after cancel');
  a.run('navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[fakeTrack()],getAudioTracks:()=>[]})');await a.run('startLiveBeat()');
  assert(a.nodes.get('liveBeatStatus').textContent.includes('Kein Ton'));assert.equal(a.run('liveBeat.active'),false);
  a.run('navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(Error("denied"),{name:"NotAllowedError"})}');await a.run('startLiveBeat()');
  assert(a.nodes.get('liveBeatStatus').textContent.includes('Nicht freigegeben'));assert.equal(a.nodes.get('liveBeatStart').disabled,false);
  a.run('navigator.mediaDevices.getUserMedia=async()=>fakeStream');await a.run('startLiveBeat()');
  a.run('beatEngine.setTempo(120,"live",.95);liveBeat.tracker.bpm=120;liveBeat.tracker.confidence=.95;playback={item:{id:"next-track"},is_playing:true};analyseLiveBeat(1000)');
  assert.equal(a.run('beatEngine.bpm'),null,'Song changes reacquire instead of retaining the preceding tempo');
  a.run('beatEngine.setTempo(120,"manual");renderTempoStatus()');assert(a.nodes.get('liveBeatStatus').textContent.includes('Selbst festgelegtes'),'A manual override is not labelled as measured');
  a.document.visibilityState='hidden';a.event(a.document,'visibilitychange');assert.equal(a.run('beatEngine.bpm'),null);assert.equal(a.run('liveBeat.active'),true,'Hidden analysis pauses while the explicit grant remains stoppable');
  a.event(a.window,'pagehide');assert.equal(a.run('liveBeat.active'),false,'Leaving the page releases capture');
  assert(!html.includes('new MediaRecorder'),'No recording subsystem');
  console.log('PASS opt-in capture, muted analysis, track cleanup, stale grants, no-audio share, denied permission and page exit.');
})().catch(error=>{console.error(error);process.exitCode=1});
