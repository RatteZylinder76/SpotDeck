const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');

function watched(preferences={}){
  const h=harness({preferences:{season:'vice',tempoLookup:false,...preferences}});
  h.run('var automaticStarts=[];var originalAutomaticBegin=beginVice;beginVice=function(...args){const ok=originalAutomaticBegin(...args);if(ok)automaticStarts.push({name:args[0],at:performance.now(),preview:!!args[2],type:viceById.get(args[0]).type||"story",action:!!viceById.get(args[0]).action,end:effects.active.end});return ok}');
  return h;
}
function starts(h){return Array.from(h.run('automaticStarts'))}
function remaining(h){return h.run('effects.nextAt-performance.now()')}

(async()=>{
  const idle=watched();
  assert.equal(remaining(idle),12000,'Vice promises a visible first scene after twelve seconds');
  assert.match(idle.nodes.get('viceAutoStatus').textContent,/12 Sekunden/);
  assert.equal(idle.nodes.get('enableViceAuto').hidden,true);
  idle.step(11900,100);assert.equal(starts(idle).length,0);
  idle.step(100,100);assert.equal(starts(idle).length,1,'RAF starts a scene without any preview or click');
  assert.equal(starts(idle)[0].preview,false);assert.equal(starts(idle)[0].type,'story','The first automatic scene is a noticeable story');
  idle.step(1100,100);assert.match(idle.nodes.get('viceAutoStatus').textContent,/Szene läuft/);
  for(let n=2;n<=3;n++){
    const previous=starts(idle).at(-1);
    idle.step(previous.end-idle.run('performance.now()')+65200,100);
    assert.equal(starts(idle).length,n,'Scenes continue automatically after their configured pause');
  }
  assert.equal(starts(idle)[2].type,'story','Every other automatic choice gives a major scene preference');
  assert(starts(idle).every(s=>!s.preview));assert.equal(idle.frames.size,1);

  const lyrics=watched();lyrics.step(11000,100);
  lyrics.run('playback={is_playing:true,progress_ms:11000,item:{id:"busy-lyrics",duration_ms:180000}};lastPollAt=performance.now();vibeSpeechTrack="busy-lyrics";vibeSceneLastPosition=11000;showVibeScene(vibeThemes.find(t=>t.key==="love"),11000,"love")');
  for(let i=0;i<7;i++){
    lyrics.run('queueEffect({kind:"theme",name:"busy-"+performance.now(),key:"busy-"+performance.now(),theme:vibeThemes.find(t=>t.key==="sun"),position:getCurrentPositionMs(),priority:4,ttl:1100,cooldown:0})');
    lyrics.step(700,100);
  }
  assert.equal(starts(lyrics).length,0,'The existing lyric scene is allowed to finish');
  assert.equal(lyrics.run('effects.nextAt'),12000,'A blocked scene remains due rather than consuming another full pause');
  assert.equal(lyrics.run('effects.queue.some(e=>e.kind==="vice")'),false,'Scheduled scenes do not depend on expiring lyric queue entries');
  for(let i=0;i<8&&!starts(lyrics).length;i++){
    lyrics.run('queueEffect({kind:"theme",name:"busy-"+performance.now(),key:"busy-"+performance.now(),theme:vibeThemes.find(t=>t.key==="rain"),position:getCurrentPositionMs(),priority:4,ttl:1100,cooldown:0})');
    lyrics.step(700,100);
  }
  assert.equal(starts(lyrics).length,1,'Due Vice scene gets the next free slot despite a busy lyric queue');
  assert(starts(lyrics)[0].at>=17500&&starts(lyrics)[0].at<=20100,'Delivery is bounded by the current scene/short maximum wait');

  const stuck=watched();stuck.run('vibeSpeechTrack=null;vibeSceneLastPosition=0;faceScene.classList.add("visible");vibeSceneUntil=Infinity');
  stuck.step(19900,100);assert.equal(starts(stuck).length,0,'The maximum wait still allows a short lyric-scene handoff');
  stuck.step(200,100);assert.equal(starts(stuck).length,1);assert(starts(stuck)[0].at<=20100,'A stuck lyric overlay cannot starve the due scene forever');

  const seek=watched();seek.step(11000,100);
  seek.run('ownPlayback.active=true;ownedAudio.duration=180;ownedAudio.currentTime=10;playback={is_playing:true,progress_ms:10000,item:{id:"owned-audio",duration_ms:180000}};lastPollAt=performance.now()');
  await seek.run('seekPlayback(50000)');
  assert.equal(seek.run('effects.nextAt'),12000,'Seeking/resetting lyric reactions does not lose the scheduled scene');
  seek.run('resetVibeLyrics()');seek.step(1100,100);assert.equal(starts(seek).length,1);

  const controls=watched();controls.step(3000,100);
  for(const id of ['partySetting','showModeSetting','ambientSetting']){
    const node=controls.nodes.get(id);node.checked=!node.checked;controls.event(node,'change');
    assert.equal(controls.run('effects.nextAt'),12000,id+' does not postpone the first scene');
  }
  controls.step(9100,100);assert.equal(starts(controls).length,1,'Normal preference edits cannot indefinitely restart the countdown');

  const hidden=watched();hidden.step(5000,100);
  hidden.document.visibilityState='hidden';hidden.event(hidden.document,'visibilitychange');hidden.step(60000,1000);
  assert.equal(starts(hidden).length,0);hidden.document.visibilityState='visible';hidden.event(hidden.document,'visibilitychange');
  assert.equal(remaining(hidden),7000,'Returning preserves the remaining visible countdown');
  hidden.event(hidden.document,'visibilitychange');assert.equal(remaining(hidden),7000,'A repeated visible event cannot reset the delay');
  hidden.step(6900,100);assert.equal(starts(hidden).length,0);hidden.step(100,100);assert.equal(starts(hidden).length,1);

  for(const id of ['settings','library','lyrics']){
    const dialog=watched();dialog.nodes.get(id).classList.add('open');dialog.step(20000,100);
    assert.equal(starts(dialog).length,0,id+' defers automatic scenery while open');
    assert.equal(dialog.run('effects.nextAt'),12000);dialog.nodes.get(id).classList.remove('open');dialog.step(100,100);
    assert.equal(starts(dialog).length,1,'Closing '+id+' releases the already due scene');
  }

  const disabled=watched({surprises:false});disabled.step(30000,1000);
  assert.equal(starts(disabled).length,0);assert.match(disabled.nodes.get('viceAutoStatus').textContent,/ausgeschaltet/);assert.equal(disabled.nodes.get('enableViceAuto').hidden,false);
  disabled.event(disabled.nodes.get('enableViceAuto'),'click');assert.equal(disabled.run('facePreferences.surprises'),true);assert.equal(remaining(disabled),12000);assert.equal(disabled.nodes.get('enableViceAuto').hidden,true);
  disabled.step(12100,100);assert.equal(starts(disabled).length,1);
  disabled.nodes.get('surpriseSetting').checked=false;disabled.event(disabled.nodes.get('surpriseSetting'),'change');disabled.step(180000,1000);
  assert.equal(starts(disabled).length,1,'Switching automatic surprises off prevents every subsequent automatic scene');
  disabled.run('clearHalloween();viceWorld.preview("cruise")');assert.equal(starts(disabled).at(-1).preview,true,'An explicit preview remains available with automation off');

  const catalog=Array.from(idle.run('viceFeatures.filter(f=>f.duration).map(f=>({id:f.id,label:f.label,action:!!f.action,type:f.type}))'));
  const allOff=watched({viceDisabled:catalog.map(f=>f.id)});allOff.step(30000,1000);
  assert.equal(starts(allOff).length,0);assert.match(allOff.nodes.get('viceAutoStatus').textContent,/Alle Vice-Szenen sind ausgeschaltet/);
  allOff.run('showVibeScene(vibeThemes.find(t=>t.key==="love"),0,"love")');allOff.step(100,100);
  assert.equal(allOff.nodes.get('faceScene').classList.contains('visible'),true,'With every Vice scene disabled, its scheduler must not erase independent lyric reactions');
  allOff.run('faceScene.classList.remove("visible")');
  const allowed=catalog.find(f=>!f.action&&f.type!=='face'),row=allOff.nodes.get('viceFeatureList').children.find(r=>r.children[0].textContent===allowed.label),checkbox=row.children[1];
  checkbox.checked=true;allOff.event(checkbox,'change');allOff.step(100,100);
  assert.equal(starts(allOff).length,1);assert.equal(starts(allOff)[0].name,allowed.id,'Only the individually re-enabled scene may run');
  allOff.step(100000,1000);assert.equal(starts(allOff).length,1,'An individually enabled scene still respects its repeat cooldown');
  allOff.run('showVibeScene(vibeThemes.find(t=>t.key==="love"),0,"love")');allOff.step(100,100);
  assert.equal(allOff.nodes.get('faceScene').classList.contains('visible'),true,'Waiting for the only allowed scene to leave cooldown must not erase lyric reactions');

  const masters=watched({viceAction:false,viceAccessories:false,effects:'many'});masters.step(900000,1000);
  assert(starts(masters).length>=8,'Respecting category switches still leaves normal automatic scenery');
  assert(starts(masters).every(s=>!s.action&&s.type!=='face'),'Action and accessory masters exclude their scenes from every automatic choice');
  assert.equal(masters.frames.size,1,'Automatic scenes continue sharing one animation clock');
  console.log('PASS Vice automatic first/recurrent stories, lyric queue fairness, seek/reset durability, settings/visibility countdowns, dialogs, master/individual switches, status and explicit previews.');
})().catch(error=>{console.error(error);process.exitCode=1});
