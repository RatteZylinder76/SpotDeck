const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
(async()=>{
  const h=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  const outline=h.nodes.get('faceMouthPath'),clip=h.nodes.get('faceMouthClip'),tongue=h.nodes.get('faceMouthTongue');
  assert(clip&&tongue,'The real player contains its clipped tongue layer');
  assert(!h.nodes.has('faceMouthTeeth'),'The character has no visible teeth');
  assert.equal(outline.style.fill,'rgba(5,10,18,.82)','The real renderer overrides opaque white cavity fills');
  assert.equal(clip.style.fill,'#000','Global path styles cannot disable the clipping area');
  assert.equal(clip.style.stroke,'none');
  assert.equal(tongue.style.stroke,'none','Global nine-unit path strokes cannot turn the tongue into a white blob');
  assert.equal(tongue.style.fill,'#efb3bd');
  assert.equal(Number(tongue.style.opacity),0);
  assert(!/#faceMouthPath\s*\{\s*fill:rgba\(255,255,255/.test(html),'The old production-only white-fill override is removed');
  assert(html.includes('clip-path="url(#faceMouthOpening)"'));
  for(const phone of ['L','TH','DH','R','A','I','O','U','M','B','P','F','V']){
    h.context.phone=phone;
    h.run('var posed=mouthTrajectory.geometry(mouthRig.render({...articulationEngine.shape(phone),phone,active:true,timing:"phoneme"},{},{playing:true}));mouthSvg.render(posed)');
    assert.equal(outline.d,h.run('posed.path'));
    assert.equal(clip.d,outline.d,'Tongue is clipped to the currently rendered outline');
    assert(!/NaN|Infinity/.test(tongue.d));
    const opacity=Number(tongue.style.opacity);
    assert(opacity>=0&&opacity<=.85);
    if(['L','TH','DH'].includes(phone))assert(opacity>.2,phone+' shows a small tongue hint');
    else assert.equal(opacity,0,phone+' does not display an unrelated tongue');
  }
  h.run('var alphaPose=mouthTrajectory.geometry(mouthRig.render({...articulationEngine.shape("L"),phone:"L",active:true,timing:"phoneme"},{},{playing:true}))');
  const opacityAt=value=>{h.context.opacityProbe=value;h.run('mouthSvg.render({...alphaPose,tongue:opacityProbe})');return Number(tongue.style.opacity)};
  const eps=.0001,below=opacityAt(.85-eps),center=opacityAt(.85),above=opacityAt(.85+eps);
  assert(Math.abs((center-below)/eps-(above-center)/eps)<.001,'The subtle opacity limit adds no abrupt speed change near the tongue peak');
  h.run('mouthSvg.render(mouthTrajectory.geometry(mouthRig.render({}, {}, {playing:false})))');
  assert.equal(Number(tongue.style.opacity),0,'The original resting smile has no tongue');
  assert.equal(outline.d,h.run('mouthRig.render({}, {}, {playing:false}).path'));
  const parsed=h.run('parseLrc("[00:00.00]A\\n[00:03.00]\\n[00:07.00]B\\n[00:09.00]")');
  assert.equal(parsed.length,2,'Source rests create no blank lyrics rows');
  assert.equal(parsed[0].end,3000);assert.equal(parsed[1].end,9000);
  h.context.lines=parsed;
  h.run('playback={is_playing:true,progress_ms:0,item:{id:"render-mouth",duration_ms:12000}};lastPollAt=performance.now();renderSyncedLyrics(lines);updateVibeVocalReaction(5000);updateVibeMotion(5000)');
  assert.equal(h.run('vibeSpeech.active'),false,'A source-provided instrumental pause remains silent');
  assert.equal(Number(tongue.style.opacity),0,'An instrumental pause cannot leave a tongue on screen');
  for(const profile of ['quality','tv']){
    const frame=harness({preferences:{season:'off',surprises:false,tempoLookup:false,performance:profile}});
    frame.run('playback={is_playing:true,progress_ms:0,item:{id:"tongue-frame",duration_ms:3000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:2000,text:"L A",words:[{word:"L",start:100,end:700,phones:[{phone:"L",start:100,end:700}]},{word:"A",start:700,end:1900,phones:[{phone:"A",start:700,end:1900}]}]}])');
    frame.step(450,1000/60);
    assert(Number(frame.nodes.get('faceMouthTongue').style.opacity)>.2,'The tongue is actually rendered in '+profile);
    assert.equal(frame.nodes.get('faceMouthClip').d,frame.nodes.get('faceMouthPath').d);
    frame.step(700,1000/60);assert.equal(Number(frame.nodes.get('faceMouthTongue').style.opacity),0);
    assert.equal(frame.frames.size,1,'Tongue rendering shares the existing animation loop');
  }
  console.log('PASS production cavity paint, clipped subtle tongue without teeth, rest/speech transitions, LRC pauses and shared 30/60 Hz rendering.');
})().catch(error=>{console.error(error);process.exitCode=1});
