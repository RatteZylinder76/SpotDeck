const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const track=(name='Example',duration=200)=>({id:'song-test',type:'track',name,artists:[{name:'Singer'}],album:{name:'Album'},duration_ms:duration*1000});
const lyric=(id,title='Example',duration=200,text='Invented test words')=>({id,trackName:title,artistName:'Singer',albumName:'Album',duration,plainLyrics:text,syncedLyrics:null,instrumental:false});
async function runAsync(h,code){let done=false,value,error;h.run(code).then(result=>{done=true;value=result},failure=>{done=true;error=failure});for(let i=0;i<80&&!done;i++){await h.flush();h.step(400)}if(!done)throw Error('Unfinished async test');if(error)throw error;return value}
function identity(h,item){h.context.item=item;return h.run('trackIdentity(item)')}
(async()=>{
  const h=harness({preferences:{party:true,motion:'normal',tempoLookup:false}});
  h.step(8200);assert(h.nodes.get('partyExit').inert);assert(h.nodes.get('connect').inert);
  h.step(700);assert.equal(h.run('partyPresentation.value'),1);
  h.event(h.document,'pointermove');h.step(300);assert(h.run('partyPresentation.value')>0&&h.run('partyPresentation.value')<1);
  h.step(400);assert.equal(h.run('partyPresentation.value'),0);assert(!h.nodes.get('partyExit').inert);assert.equal(h.frames.size,1);
  h.step(8500);const wake=h.event(h.document,'keydown',{key:'Enter'});assert(wake.defaultPrevented);assert.equal(h.run('facePreferences.party'),true);
  const repeat=h.event(h.document,'keydown',{key:'Enter',repeat:true});assert(repeat.defaultPrevented);
  h.event(h.document,'keyup',{key:'Enter'});h.run('openSettingsPanel()');h.event(h.document,'keydown',{key:'Escape'});
  assert.equal(h.run('facePreferences.party'),true);assert(!h.nodes.get('settings').classList.contains('open'));
  h.event(h.document,'keydown',{key:'Escape'});assert.equal(h.run('facePreferences.party'),false);
  const reduced=harness({reduced:true,preferences:{party:true}});reduced.step(8100);assert.equal(reduced.run('partyPresentation.value'),1);
  console.log('PASS all Party controls inert/hidden, smooth resize scalar, reversal, one RAF, reduced motion, held-key wake and dialog-aware Escape.');

  h.context.wanted=identity(h,track('Example (Halloween Club Remix)',242));
  h.context.original=lyric(1,'Example',200);h.context.correct=lyric(2,'Example (Halloween Club Remix)',242);
  assert.equal(h.run('versionInfo("Example (Halloween Club Remix)").base'),'example');
  assert.equal(h.run('compareRecording(wanted,original,"tempo").safe'),false);
  assert.equal(h.run('compareRecording(wanted,correct,"tempo").safe'),true);
  assert.equal(h.run('chooseRecording(wanted,[original,correct]).record.id'),2);
  assert.equal(h.run('chooseRecording(wanted,[original]).status'),'alternative');
  h.context.wrongArtist={...lyric(3),artistName:'Someone Else'};assert.equal(h.run('chooseRecording(wanted,[wrongArtist]).status'),'missing');
  h.context.live=lyric(4,'Example (Live)',242);assert.equal(h.run('compareRecording(wanted,live,"tempo").safe'),false);
  h.context.wanted=identity(h,track());h.context.other=lyric(5,'Example',200,'Different invented test text');
  assert.equal(h.run('chooseRecording(wanted,[original,other]).status'),'ambiguous');
  assert.equal(h.run('versionInfo("Example - 2011 Remaster").descriptor'),'2011');
  console.log('PASS title/artist/duration scoring, exact Remix selection, labelled Original fallback, Live exclusion, remaster descriptors and ambiguous lyric choice.');

  let searches=0;
  const l=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>{
    if(url.includes('/api/get?'))return res(null,404);
    if(url.includes('/api/search?')){searches++;const name=new URL(url).searchParams.get('track_name');return res(name==='example'?[lyric(1)]:[])}
    return res(null,204);
  }});
  l.context.item=track('Example (Halloween Club Remix)',242);
  const result=await runAsync(l,'searchLyrics(trackIdentity(item),new AbortController().signal)');
  assert.equal(result.status,'alternative');assert.equal(result.record.id,1);assert(searches>=2);
  l.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track('Example (Halloween Club Remix)',242)};
  l.run('renderPlayback(data)');await runAsync(l,'loadLyrics()');const before=l.requests.length;
  l.run('lyricsLoadState="idle"');await runAsync(l,'loadLyrics()');assert.equal(l.requests.length,before,'Successful search cache avoids all requests');
  assert(l.nodes.get('lyricsNotice').textContent.includes('Andere Version'));assert(l.nodes.get('lyricsBody').innerHTML.includes('Invented test words'));
  await runAsync(l,'loadLyrics(true)');assert(l.requests.length>before,'Refresh bypasses cache');
  console.log('PASS exact→flexible→base-title search, alternative label, successful lyric cache and manual refresh.');

  const mbid='564ccd5c-c4d3-4752-9abf-c33bb085d6a5';
  const b=harness({fetcher:async(url,opts,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[{id:mbid,title:'Example',length:200000,'artist-credit':[{artist:{name:'Singer'}}],releases:[{title:'Album'}]}]});
    if(url.includes('acousticbrainz.org'))return res({[mbid]:{'0':{rhythm:{bpm:128},metadata:{audio_properties:{length:200},tags:{title:['Example'],artist:['Singer']}}}}});
    return res(null,204);
  }});
  b.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};b.run('renderPlayback(data)');
  await runAsync(b,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.equal(b.run('lookupState.tempo.status'),'found');assert.equal(b.run('lookupState.tempo.result.record.bpm'),128);
  assert.equal(b.run('beatEngine.bpm'),null,'Spotify metadata BPM never controls the beat engine');
  const tempoRequestCount=()=>b.requests.filter(request=>/musicbrainz\.org|acousticbrainz\.org/.test(request.url)).length;
  assert.equal(b.nodes.get('tempoSummary').dataset.state,'found');const count=tempoRequestCount();
  await runAsync(b,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');assert.equal(tempoRequestCount(),count);
  assert(b.requests.every(request=>!request.url.includes('api_key')&&!request.options.headers?.Authorization));
  console.log('PASS free MusicBrainz→AcousticBrainz lookup, verified duration, BPM provenance, cache and no Spotify synchronization or secret transmission.');

  const missing=harness({fetcher:async(url,opts,res)=>res({recordings:[]})});missing.context.item=track();missing.run('tempoRequest(item)');
  await runAsync(missing,'findTempoMetadata(trackIdentity(item),false,lookupState.tempo.controller)');assert.equal(missing.run('lookupState.tempo.status'),'missing');
  const missingCount=missing.requests.length;await runAsync(missing,'findTempoMetadata(trackIdentity(item),false,lookupState.tempo.controller)');assert.equal(missing.requests.length,missingCount);
  const limited=harness({fetcher:async(url,opts,res)=>Object.assign(res(null,429),{headers:{get:name=>name==='Retry-After'?'60':null}})});
  limited.context.item=track();limited.run('tempoRequest(item)');await runAsync(limited,'findTempoMetadata(trackIdentity(item),false,lookupState.tempo.controller)');
  assert.equal(limited.run('lookupState.tempo.status'),'limited');const limitedCount=limited.requests.length;
  await runAsync(limited,'findTempoMetadata(trackIdentity(item),true,lookupState.tempo.controller)');assert.equal(limited.requests.length,limitedCount,'Manual refresh respects rate limit');
  console.log('PASS missing-result cache and 429 Retry-After across manual refresh.');

  const reloaded=harness();reloaded.store.set('spotdeck.lookupBackoff.v1',limited.store.get('spotdeck.lookupBackoff.v1'));
  reloaded.context.item=track();reloaded.run('tempoRequest(item)');await runAsync(reloaded,'findTempoMetadata(trackIdentity(item),true,lookupState.tempo.controller)');
  assert.equal(reloaded.requests.length,0,'Reloading cannot bypass provider backoff');
  b.context.shared={...track(),external_ids:{isrc:'USAAA2000001'}};
  b.run('storeTempoResult(trackIdentity(shared),lookupState.tempo.result)');
  b.context.shared.id='second-release';b.run('tempoRequest(shared)');const sharedCount=tempoRequestCount();
  await runAsync(b,'findTempoMetadata(trackIdentity(shared),false,lookupState.tempo.controller)');assert.equal(tempoRequestCount(),sharedCount,'Same ISRC and recording signature share the cache across track IDs');
  assert.equal(b.run('lookupState.tempo.status'),'found');
  console.log('PASS provider backoff survives reload and a confirmed recording cache is reused by ISRC.');

  const stale=harness({preferences:{tempoLookup:false}});let finish;
  stale.context.pending=()=>new Promise(resolve=>{finish=resolve});stale.run('searchLyrics=pending');
  stale.context.first={is_playing:true,device:{id:'x'},item:track()};stale.run('renderPlayback(first)');
  const pending=stale.run('loadLyrics()');stale.context.second={is_playing:true,device:{id:'x'},item:{...track('Next Song'),id:'next'}};stale.run('renderPlayback(second)');
  finish({status:'found',record:lyric(1),match:{alternative:false}});await pending;
  assert(!stale.nodes.get('lyricsBody').innerHTML.includes('Invented test words'),'Late old lyrics never overwrite the new track');
  const cache=h.run('new LookupCache("test-cache",2,2000)');cache.put('a',{value:1},10000);cache.put('b',{value:2},10000);cache.put('c',{value:3},10000);assert.equal(cache.entries.size,2);assert.equal(cache.get('a'),null);
  cache.entries.get('b').expires=Date.now()-1;assert.equal(cache.get('b'),null);
  console.log('PASS stale lyric cancellation, track-change clearing, bounded cache and expiry.');

  const timedRecord={...lyric(22),syncedLyrics:'[00:02.00]First synthetic line\n[00:05.00]Second synthetic line\n[00:10.00]Third synthetic line'};
  const timed=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>{
    if(url.includes('/api/get?'))return res(lyric(21));
    if(url.includes('/api/search?'))return res([lyric(21),timedRecord]);
    return res(null,204);
  }});
  timed.context.item=track();
  const foundTimed=await runAsync(timed,'searchLyrics(trackIdentity(item),new AbortController().signal)');
  assert.equal(foundTimed.record.id,22,'An exact plain-text result cannot hide a matching synchronized record');
  timed.context.result=foundTimed;
  timed.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};timed.run('renderPlayback(data);lyrics.classList.add("open")');
  const cueNodes=Array.from({length:3},(_,i)=>{const node=timed.document.createElement('p');node.dataset.lyricIndex=String(i);node.offsetTop=i*100;return node});
  const body=timed.nodes.get('lyricsBody');body.querySelectorAll=()=>cueNodes;body.clientHeight=200;
  const scrolls=[];body.scrollTo=options=>scrolls.push(options);
  timed.run('applyLyricResult(trackIdentity(playback.item),result);lyricsTrackId=item.id');
  assert.equal(timed.run('ownPlayback.active'),false);
  assert.equal(timed.run('syncedLyrics.length'),3);
  assert(timed.nodes.get('lyricsNotice').textContent.includes('synchronisiert'));
  timed.run('playback.progress_ms=1800;lastPollAt=performance.now()');timed.step(400);
  assert.equal(timed.run('currentLyricIndex'),0);assert(cueNodes[0].classList.contains('active'));
  timed.run('renderPlayback({...playback,progress_ms:4900,is_playing:false})');timed.step(1000);
  assert.equal(timed.run('currentLyricIndex'),0,'Pause freezes highlighted position');
  timed.run('renderPlayback({...playback,progress_ms:4900,is_playing:true})');timed.step(400);
  assert.equal(timed.run('currentLyricIndex'),1);assert(cueNodes[1].classList.contains('active'));assert(!cueNodes[0].classList.contains('active'));
  timed.run('facePreferences.lyricsOffset=1800;updateLyricsPosition(10000,true)');
  assert.equal(timed.run('currentLyricIndex'),2,'A saved local-audio offset cannot misalign Spotify lyrics');
  timed.run('updateLyricsPosition(2100,true)');assert.equal(timed.run('currentLyricIndex'),0,'Backward position/seek follows earlier cue');
  timed.run('playbackMode="local";localDeviceId="external";localPlayer={seek:async ms=>{runtime.testSeek=ms}}');
  timed.event(cueNodes[2],'click');await timed.flush();
  assert.equal(timed.run('runtime.testSeek'),10000,'Clicking a timed line seeks the SDK without the local-audio offset');
  assert.equal(timed.run('currentLyricIndex'),2);
  timed.run('updateLyricsPosition(2100,true)');
  assert(scrolls.length>0,'Active lines scroll into view');
  timed.run('updateVibeVocalReaction(5100)');assert(timed.run('vibeSpeech.open')>0,'Spotify timestamps also drive the singing mouth');
  timed.run('playback.is_playing=false;updateVibeVocalReaction(5100)');assert.equal(timed.run('vibeSpeech.open'),0,'Singing stops on pause');
  timed.run('playback.is_playing=true');
  timed.run('lyrics.classList.remove("open");updateLyricsPosition(10000,true)');assert.equal(timed.run('currentLyricIndex'),0);
  timed.run('lyrics.classList.add("open");updateLyricsPosition(10000,true)');assert.equal(timed.run('currentLyricIndex'),2);
  const oldRequestCount=timed.requests.length;timed.run('lyricCache.put(trackIdentity(item).key,{signature:trackIdentity(item).signature,result},700000)');
  await runAsync(timed,'loadLyrics()');assert.equal(timed.requests.length,oldRequestCount,'Timed results survive cache round-trip');
  assert.equal(timed.run('syncedLyrics.length'),3);
  for(const wrong of [
    {...timedRecord,duration:210},
    {...timedRecord,duration:null},
    {...timedRecord,trackName:'Example (Live)'},
    {...timedRecord,syncedLyrics:'[99:00.00]Invalid out-of-range cue'},
  ]){
    timed.context.wrong=wrong;timed.run('applyLyricResult(trackIdentity(item),{status:"found",record:wrong})');
    assert.equal(timed.run('syncedLyrics.length'),0,'Unverified versions, durations and invalid cues remain plain');
  }
  timed.run('applyLyricResult(trackIdentity(item),{...result,status:"alternative"})');assert.equal(timed.run('syncedLyrics.length'),0);
  timed.run('applyLyricResult(trackIdentity(item),{status:"found",record:{...result.record,syncedLyrics:null}})');assert.equal(timed.run('syncedLyrics.length'),0);
  timed.run('applyLyricResult(trackIdentity(item),result);renderPlayback({...playback,item:{...item,id:"changed",name:"Next"}})');
  assert.equal(timed.run('syncedLyrics.length'),0,'Track changes immediately clear old timing');
  console.log('PASS timed-first LRCLIB lookup, playback/pause/resume/backward positions, source labels, cache, version/duration guards, static fallback and track cleanup.');

  const fallback=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>url.includes('/api/get?')?res(lyric(30)):res(null,503)});
  fallback.context.item=track();
  const partial=await runAsync(fallback,'searchLyrics(trackIdentity(item),new AbortController().signal)');
  assert.equal(partial.status,'found');assert.equal(partial.record.id,30);assert.equal(partial.timingSearchIncomplete,true);
  console.log('PASS an unavailable timestamp search preserves an already found plain-text fallback.');

  const singer=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>url.includes('/api/get?')?res(timedRecord):res(null,204)});
  singer.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};singer.run('renderPlayback(data)');
  singer.step(200);
  for(let i=0;i<20&&singer.run('lyricsLoadState')!=='loaded';i++){await singer.flush();singer.step(100)}
  assert.equal(singer.nodes.get('lyrics').classList.contains('open'),false);
  assert.equal(singer.run('syncedLyrics.length'),3,'Singing lyrics load with the text view closed');
  singer.run('playback.progress_ms=2250;lastPollAt=performance.now();facePreferences.lyricsOffset=1800;updateVibeVocalReaction(2250)');
  assert(singer.run('vibeSpeech.open')>0,'Local-file offset cannot shift Spotify singing');
  const mouthBefore=singer.nodes.get('faceMouthPath').d;singer.step(150);
  assert.notEqual(singer.nodes.get('faceMouthPath').d,mouthBefore,'The same RAF morphs the mouth during Spotify singing');
  assert.equal(singer.frames.size,1);
  singer.run('playback.is_playing=false;updateVibeVocalReaction(2250)');assert.equal(singer.run('vibeSpeech.open'),0);
  singer.run('playback.is_playing=true;syncedLyrics=[{time:0,text:"Ooh",words:[{word:"Ooh",start:1000,end:1400}]}];resetVibeLyrics();updateVibeVocalReaction(1200)');
  assert(singer.run('vibeSpeech.open')>0,'Actual word timestamps drive mouth opening');
  singer.run('updateVibeVocalReaction(1600)');assert.equal(singer.run('vibeSpeech.open'),0,'Word-timed pauses close the singing mouth');
  singer.run('renderPlainLyrics("Synthetic static text");updateVibeVocalReaction(1200)');assert.equal(singer.run('vibeSpeech.open'),0,'Untimed fallback does not invent lyric timing');
  let lyricAttempts=0;
  const retrySinger=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>{
    if(url.includes('/api/get?'))return ++lyricAttempts===1?res(null,503):res(timedRecord);
    return res(null,204);
  }});
  retrySinger.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};retrySinger.run('renderPlayback(data)');retrySinger.step(200);
  for(let i=0;i<20&&retrySinger.run('lyricsLoadState')!=='retry';i++){await retrySinger.flush();retrySinger.step(50)}
  assert.equal(retrySinger.run('lyricsLoadState'),'retry');assert.equal(lyricAttempts,1);
  retrySinger.step(10000);await retrySinger.flush();assert.equal(lyricAttempts,1,'No background retry storm during backoff');
  retrySinger.step(Math.max(0,retrySinger.run('lyricsRetryAt-performance.now()'))+100);
  for(let i=0;i<20&&retrySinger.run('lyricsLoadState')!=='loaded';i++){await retrySinger.flush();retrySinger.step(100)}
  assert.equal(retrySinger.run('syncedLyrics.length'),3,'A background load retries after a temporary failure without opening Lyrics');
  assert.equal(lyricAttempts,2);assert.equal(retrySinger.frames.size,1);
  console.log('PASS background lyric loading, closed-view singing, line/word mouth timing, pause/gaps, saved local offsets and one RAF.');

  let overload=false,attempts=0;
  const recovery=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>{
    if(url.includes('/api/get?')){attempts++;return overload?Object.assign(res(null,503),{headers:{get:name=>name==='Retry-After'?'1':null}}):res(timedRecord)}
    return res(null,204);
  }});
  recovery.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};recovery.run('renderPlayback(data);setDebug(true)');
  await runAsync(recovery,'loadLyrics()');assert.equal(recovery.run('syncedLyrics.length'),3);
  const retainedMarkup=recovery.nodes.get('lyricsBody').innerHTML;
  overload=true;await runAsync(recovery,'loadLyrics(true)');
  assert.equal(recovery.nodes.get('lyricsBody').innerHTML,retainedMarkup,'A refresh failure preserves the matching text and timestamps');
  assert.match(recovery.nodes.get('lyricsNotice').textContent,/LRCLIB.*überlastet.*503/);
  assert.equal(recovery.run('playback.is_playing'),true);
  assert.equal(recovery.run('lyricsRetryCount'),1);
  assert(recovery.run('lyricsRetryAt-performance.now()')>=10000,'503 Retry-After: 1 does not cause a one-second retry storm');
  const firstDelay=recovery.run('lyricsRetryAt-performance.now()');
  const requestsBeforeWait=attempts;recovery.step(5000);await recovery.flush();assert.equal(attempts,requestsBeforeWait);
  recovery.step(Math.max(0,recovery.run('lyricsRetryAt-performance.now()'))+100);
  for(let i=0;i<20&&recovery.run('lyricsRetryCount')<2;i++){await recovery.flush();recovery.step(50)}
  assert.equal(recovery.run('lyricsRetryCount'),2);
  assert(recovery.run('lyricsRetryAt-performance.now()')>firstDelay,'Repeated failures increase the wait even when cached lyrics remain usable');
  assert.equal(recovery.run('syncedLyrics.length'),3);
  assert(recovery.run('runtime.events.some(event=>event.kind==="lyrics-error"&&event.status===503)'));
  overload=false;recovery.step(Math.max(0,recovery.run('lyricsRetryAt-performance.now()'))+100);
  for(let i=0;i<20&&recovery.run('lyricsLoadState')!=='loaded';i++){await recovery.flush();recovery.step(50)}
  assert.equal(recovery.run('lyricsLoadState'),'loaded','Automatic retry revalidates rather than stopping at retained cache');
  assert.equal(recovery.run('lyricsRetryCount'),0);
  assert.match(recovery.nodes.get('lyricsNotice').textContent,/synchronisiert/);assert.equal(recovery.frames.size,1);

  const limitedLyrics=harness({preferences:{tempoLookup:false},fetcher:async(url,opts,res)=>Object.assign(res(null,429),{headers:{get:name=>name==='Retry-After'?'120':null}})});
  limitedLyrics.context.data={is_playing:true,progress_ms:0,device:{id:'external'},item:track()};limitedLyrics.run('renderPlayback(data)');
  await runAsync(limitedLyrics,'loadLyrics()');assert.match(limitedLyrics.nodes.get('lyricsNotice').textContent,/429/);
  assert(limitedLyrics.run('lyricsRetryAt-performance.now()')>=120000,'Provider Retry-After is never shortened');
  console.log('PASS explicit overload/rate-limit messages, retained synchronized cache, exponential jittered waits, provider minimum and eventual recovery.');
  // Structural layout contract; real pixel geometry still requires browser/device QA.
  const {html}=require('./spotdeck.test.cjs');
  const lyricsHead=html.slice(html.indexOf('<div class="lyrics-head">'),html.indexOf('<div class="lyrics-body"'));
  assert(lyricsHead.indexOf('id="lyricsNotice"')<lyricsHead.indexOf('class="lyrics-tools"'),'Compact source lives in the title header');
  assert(lyricsHead.indexOf('id="lyricsMenu"')<lyricsHead.indexOf('id="localTextFile"'),'Local file action is inside the menu');
  const tools=lyricsHead.slice(lyricsHead.indexOf('class="lyrics-tools"'));
  assert(!tools.includes('id="localTextFile"'));
  assert.match(html,/\.lyrics-tools \.setting-field\[hidden\]\{display:none\}/);
  assert.match(html,/@media\(max-height:600px\)/);
  assert.match(html,/font-size:clamp\(20px,min\(3\.2vw,5vh\),54px\)/);
  assert(l.nodes.get('lyricsChoices').hidden,'Unique result has no version selector');
  console.log('PASS compact source/header, local-file menu, hidden unique selector and low-height layout rules (structural checks only).');
})().catch(error=>{console.error(error);process.exitCode=1});
