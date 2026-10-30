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
  assert.equal(b.nodes.get('tempoSummary').dataset.state,'found');const count=b.requests.length;
  await runAsync(b,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');assert.equal(b.requests.length,count);
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
  b.context.shared.id='second-release';b.run('tempoRequest(shared)');const sharedCount=b.requests.length;
  await runAsync(b,'findTempoMetadata(trackIdentity(shared),false,lookupState.tempo.controller)');assert.equal(b.requests.length,sharedCount,'Same ISRC and recording signature share the cache across track IDs');
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
