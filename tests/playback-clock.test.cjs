const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const preferences={season:'off',surprises:false,tempoLookup:false};
const track=(id='clock-song')=>({id,type:'track',name:'Clock song',artists:[{name:'Artist'}],duration_ms:120000});
const state=(position,options={})=>({is_playing:true,progress_ms:position,device:{id:'remote-a',name:'Remote A'},item:track(),...options});
const put=(h,data,force=false)=>{h.context.nextClockState=data;h.context.forceClock=force;h.run('renderPlayback(nextClockState,{forceClock})')};
const position=h=>h.run('getCurrentPositionMs()');
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-6,message+': '+actual+' != '+expected);
function player(){const h=harness({preferences});h.run('api=async()=>({ok:true,status:204})');return h;}
function pendingPoll(h,snapshot){
  h.context.oldClockSnapshot=snapshot;
  h.run('var releaseClockPoll;api=async path=>path.startsWith("/me/player?")?await new Promise(resolve=>releaseClockPoll=()=>resolve({ok:true,status:200,json:async()=>oldClockSnapshot})):({ok:true,status:204});var pendingClockPoll=poll()');
}
(async()=>{
  const paused=player();put(paused,state(10000));paused.step(1000);
  close(position(paused),11000,'Playing advances on the monotonic clock');
  await paused.run('playPause()');
  close(position(paused),11000,'Remote pause freezes the extrapolated position instead of returning to the last poll');
  assert.equal(paused.run('playback.is_playing'),false);
  paused.run('poll=async()=>{}');paused.step(2000);
  close(position(paused),11000,'Paused time does not advance');
  await paused.run('playPause()');paused.step(500);
  close(position(paused),11500,'Resume excludes the paused wall-clock interval');

  const seek=player();put(seek,state(10000));pendingPoll(seek,state(10000));await seek.flush();
  await seek.run('seekPlayback(50000)');close(position(seek),50000,'A confirmed seek applies immediately');
  seek.run('releaseClockPoll()');await seek.run('pendingClockPoll');
  close(position(seek),50000,'An old in-flight response cannot overwrite a confirmed seek');
  await seek.run('seekPlayback(50120)');close(position(seek),50120,'Even a small explicit seek bypasses drift smoothing');
  assert.equal(seek.run('playbackClockCorrection'),0);

  const pauseRace=player();put(pauseRace,state(10000));pendingPoll(pauseRace,state(10000));await pauseRace.flush();pauseRace.step(800);
  await pauseRace.run('playPause()');pauseRace.run('releaseClockPoll()');await pauseRace.run('pendingClockPoll');
  close(position(pauseRace),10800,'A pre-pause response cannot rewind the frozen position');
  assert.equal(pauseRace.run('playback.is_playing'),false,'A stale playing response cannot resume the UI');

  const during=player();put(during,state(10000));
  during.run('var finishClockSeek,releaseDuringPoll;api=async path=>path.startsWith("/me/player/seek")?await new Promise(resolve=>finishClockSeek=()=>resolve({ok:true,status:204})):path.startsWith("/me/player?")?await new Promise(resolve=>releaseDuringPoll=()=>resolve({ok:true,status:200,json:async()=>({...playback,progress_ms:10000})})):({ok:true,status:204});var duringSeek=seekPlayback(40000)');
  await during.flush();during.run('var duringPoll=poll()');await during.flush();
  during.run('finishClockSeek()');await during.run('duringSeek');during.run('releaseDuringPoll()');await during.run('duringPoll');
  close(position(during),40000,'A response started during the command is rejected after its acknowledgment');

  const latest=player();put(latest,state(10000));
  latest.run('var finishSeekA,finishSeekB;api=async path=>await new Promise(resolve=>{if(path.includes("position_ms=50000"))finishSeekA=()=>resolve({ok:true,status:204});else finishSeekB=()=>resolve({ok:true,status:204})});var seekA=seekPlayback(50000);var seekB=seekPlayback(20000)');
  await latest.flush();latest.run('finishSeekB()');await latest.run('seekB');latest.run('finishSeekA()');await latest.run('seekA');
  close(position(latest),20000,'The latest seek owns the position when commands finish out of order');

  const jitter=player();put(jitter,state(10000));jitter.step(1000);put(jitter,state(11120));
  close(position(jitter),11000,'A small same-device correction does not jump at response arrival');
  jitter.step(500);close(position(jitter),11540,'Small correction slews at a bounded rate');
  jitter.step(1000);close(position(jitter),12620,'A small correction converges to the observed timeline');
  put(jitter,state(12500));let previous=position(jitter);
  for(let i=0;i<15;i++){jitter.step(100);const current=position(jitter);assert(current>previous,'A negative small correction never runs the singing clock backward');previous=current;}
  put(jitter,state(60000));close(position(jitter),60000,'A large external discontinuity anchors immediately');
  put(jitter,state(60080,{item:track('another-song')}));close(position(jitter),60080,'A track change never inherits the previous correction');
  jitter.step(500);put(jitter,state(60700,{item:track('another-song')}));assert.notEqual(jitter.run('playbackClockCorrection'),0);
  put(jitter,state(60750,{item:track('another-song'),device:{id:'remote-b',name:'Remote B'}}));
  close(position(jitter),60750,'A device change anchors immediately even when its position difference is small');
  assert.equal(jitter.run('playbackClockCorrection'),0,'Output-device changes clear pending correction');
  put(jitter,state(60780,{item:track('another-song'),device:{id:'remote-b'},is_playing:false}));jitter.step(1000);
  close(position(jitter),60780,'A provider-reported pause is an exact frozen anchor');
  put(jitter,null);close(position(jitter),0,'Disconnect clears the old playback clock');

  const latency=player();latency.step(750);latency.run('runtime.queryMs=750');put(latency,{...state(10000),timestamp:Date.now()-60000});
  close(position(latency),10000,'Request RTT/state-change timestamps are not treated as measured audio output latency');
  latency.run('ownPlayback.active=true;ownedAudio.currentTime=12.345');
  close(position(latency),12345,'An owned audio element remains the authoritative clock');

  const sdk=player();
  sdk.run('playbackMode="local";localDeviceId="sdk-device";localPlayer={seek:async()=>{renderLocalState({position:50017,duration:120000,paused:false,track_window:{current_track:{id:"clock-song",type:"track",name:"Clock song",artists:[{name:"Artist"}]}}})}};renderLocalState({position:10000,duration:120000,paused:false,track_window:{current_track:{id:"clock-song",type:"track",name:"Clock song",artists:[{name:"Artist"}]}}})');
  await sdk.run('seekPlayback(50000)');
  close(position(sdk),50017,'A fresh SDK seek event wins over an optimistic command result');
  assert.equal(sdk.run('playbackMode'),'local');
  sdk.run('localPlayer.seek=async()=>{renderLocalState({position:50100,duration:120000,paused:false,track_window:{current_track:{id:"clock-song",type:"track",name:"Clock song",artists:[{name:"Artist"}]}}})}');
  await sdk.run('seekPlayback(50100)');
  close(position(sdk),50100,'An explicit small SDK seek event is not misclassified as periodic jitter');
  sdk.run('renderLocalState({position:50140,duration:120000,paused:false,track_window:{current_track:{id:"clock-song",type:"track",name:"Clock song",artists:[{name:"Artist"}]}}},"fallback")');
  close(position(sdk),50100,'A periodic SDK fallback can still smooth small non-event correction');
  pendingPoll(sdk,state(1000,{device:{id:'different-device'}}));await sdk.flush();
  sdk.run('renderLocalState({position:51000,duration:120000,paused:false,track_window:{current_track:{id:"clock-song",type:"track",name:"Clock song",artists:[{name:"Artist"}]}}})');
  sdk.run('releaseClockPoll()');await sdk.run('pendingClockPoll');
  close(position(sdk),51000,'An API response cannot overwrite a newer SDK event');
  assert.equal(sdk.run('playbackMode'),'local','A stale API response cannot transfer the UI away from the SDK device');

  console.log('PASS monotonic playback clock, bounded correction, remote pause/resume, seek epochs and stale-response rejection, track/device anchors, owned audio and SDK priority.');
})().catch(error=>{console.error(error);process.exitCode=1});
