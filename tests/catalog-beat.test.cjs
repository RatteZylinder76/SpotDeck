// Recording metadata and clocks are synthetic; tests never access a private account.
const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const trackId='0123456789abcdefghijkl',secondId='abcdefghijkl0123456789';
const mbid='564ccd5c-c4d3-4752-9abf-c33bb085d6a5',reccoId='c982a754-3d7b-4d03-bfd1-f6e867da0557';
const track=(id=trackId,name='Example',duration=200)=>({id,type:'track',name,artists:[{name:'Singer'}],album:{name:'Album'},duration_ms:duration*1000,external_ids:{isrc:'USAAA2000001'}});
const record=(overrides={})=>({id:'recording',title:'Example',artists:[{name:'Singer'}],duration:200,bpm:120,...overrides});
const catalog=(overrides={})=>({status:'found',record:record(),match:{safe:true,score:1},source:'AcousticBrainz',phaseKnown:true,beatMap:Array.from({length:81},(_,i)=>i*500),...overrides});
const mbRecord={id:mbid,title:'Example',length:200000,isrcs:['USAAA2000001'],'artist-credit':[{artist:{name:'Singer'}}],releases:[{title:'Album'}]};
const abRecord={rhythm:{bpm:120,beats_position:Array.from({length:400},(_,i)=>i*.5)},metadata:{audio_properties:{length:200},tags:{title:['Example'],artist:['Singer'],isrc:['USAAA2000001']}}};
const reccoRecord={id:reccoId,trackTitle:'Example',durationMs:200000,artists:[{name:'Singer'}],href:`https://open.spotify.com/track/${trackId}`,isrc:'USAAA2000001'};
const featureRecord={id:reccoId,href:reccoRecord.href,isrc:reccoRecord.isrc,tempo:123.4};
const close=(actual,expected,label,tolerance=1e-8)=>assert(Math.abs(actual-expected)<tolerance,`${label}: ${actual} vs ${expected}`);
async function settle(h,code){let done=false,value,error;Promise.resolve(h.run(code)).then(v=>{value=v;done=true},e=>{error=e;done=true});for(let i=0;i<100&&!done;i++){await h.flush();h.step(100)}if(!done)throw Error('Async catalog test did not settle');if(error)throw error;return value}
function prepareLookup(h,data){h.context.data=data;h.run('renderPlayback(data);facePreferences.tempoLookup=true;lookupState.tempo.pending=null')}

(async()=>{
  const h=harness({preferences:{tempoLookup:false}});
  h.context.gridSeconds=Array.from({length:81},(_,i)=>i*.5);
  assert.deepEqual(Array.from(h.run('normalizeBeatMap(gridSeconds,50)')),Array.from({length:81},(_,i)=>i*500),'Provider seconds become the engine millisecond clock');
  for(const bad of [null,[],[0,1,2,3,4,5,6],Array.from({length:12001},(_,i)=>i*.1),[...Array.from({length:80},(_,i)=>i*.5),NaN],[...Array.from({length:80},(_,i)=>i*.5),Infinity],[-1,...Array.from({length:80},(_,i)=>i*.5)],[0,.01,...Array.from({length:79},(_,i)=>1+i*.5)],[...Array.from({length:80},(_,i)=>i*.5),39]]){
    h.context.badGrid=bad;assert.equal(h.run('normalizeBeatMap(badGrid,200)'),null,`Reject malformed/unsafe map ${String(bad).slice(0,40)}`);
  }
  h.context.tooShort=Array.from({length:30},(_,i)=>i*.5);assert.equal(h.run('normalizeBeatMap(tooShort,200)'),null,'An insufficient analysis fragment is rejected');
  assert.equal(h.run('normalizeBeatMap(gridSeconds,20)'),null,'Timestamps beyond recording duration are rejected');
  for(const duration of [0,-1,NaN,Infinity,21601]){h.context.badDuration=duration;assert.equal(h.run('normalizeBeatMap(gridSeconds,badDuration)'),null,'Invalid or unbounded duration is rejected')}
  console.log('PASS catalog grid units, ordering, non-finite data, bounds, count and coverage.');

  h.context.gridResult=catalog();h.run('var gridEngine=new BeatEngine();gridEngine.setCatalog(gridResult);gridEngine.anchor(10250,false,1000,true)');
  assert.equal(h.run('gridEngine.kind'),'catalog');assert.equal(h.run('gridEngine.source'),'catalog-grid');
  h.context.invalidTempo=catalog({record:record({bpm:NaN})});assert.equal(h.run('gridEngine.setCatalog(invalidTempo)'),false,'Corrupt cached tempo is never applied');assert.equal(h.run('gridEngine.bpm'),120,'Rejected data leaves the confirmed result intact');
  for(const beatMap of [{},'0,500,1000',Array.from({length:81},(_,i)=>String(i*500))]){h.context.invalidMap=catalog({beatMap});assert.equal(h.run('gridEngine.setCatalog(invalidMap)'),false,'Corrupt cache map objects and coerced numeric strings are rejected')}
  close(h.run('gridEngine.state(1000).phase'),.5,'Catalog follows song position rather than browser uptime');
  assert.equal(h.run('gridEngine.state(1000).phaseKnown'),true,'Covered timestamps establish phase');
  h.run('gridEngine.anchor(10250,true,1000,true)');
  close(h.run('gridEngine.state(1250).phase'),0,'Playing clock advances from the anchor');
  h.run('gridEngine.anchor(10625,false,1250,true)');
  close(h.run('gridEngine.state(6250).phase'),.25,'Pause freezes beat position');
  h.run('gridEngine.anchor(20250,false,6250,true)');
  close(h.run('gridEngine.state(6250).phase'),.5,'Seek immediately uses the new point in the recording');
  h.run('gridEngine.factor=2');close(h.run('gridEngine.state(6250).phase'),0,'Double time applies to stored beats');
  h.run('gridEngine.factor=.5');close(h.run('gridEngine.state(6250).phase'),.25,'Half time applies to stored beats');
  h.run('gridEngine.factor=1;gridEngine.offset=125');close(h.run('gridEngine.state(6250).phase'),.25,'User timing correction remains available');
  h.run('gridEngine.offset=0;gridEngine.anchor(45000,false,7000,true)');assert.equal(h.run('gridEngine.state(7000).phaseKnown'),false,'Extrapolation is not labelled as known phase');
  h.context.tempoOnly=catalog({source:'ReccoBeats',phaseKnown:false,beatMap:null});h.run('gridEngine.setCatalog(tempoOnly);gridEngine.anchor(10250,false,8000,true)');
  assert.equal(h.run('gridEngine.source'),'catalog-tempo');assert.equal(h.run('gridEngine.state(8000).phaseKnown'),false,'A BPM result does not claim beat timestamps');
  close(h.run('gridEngine.state(8000).phase'),.5,'Tempo-only estimate still follows song position');

  const variable=Array.from({length:41},(_,i)=>i*500).concat(Array.from({length:34},(_,i)=>20600+i*600));
  h.context.variable=catalog({beatMap:variable});h.run('gridEngine.setCatalog(variable);gridEngine.anchor(20300,false,1000,true)');
  close(h.run('gridEngine.state(1000).phase'),.5,'Variable-tempo grid interpolates between neighbouring timestamps');
  close(h.run('gridEngine.state(1000).period'),600,'Grid uses local tempo instead of global BPM');
  console.log('PASS catalog pause/seek/play clocks, known versus estimated phase, local tempo and timing controls.');

  const archived=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[mbRecord]});
    if(url.includes('acousticbrainz.org'))return res({[mbid]:{'0':abRecord}});
    if(url.includes('api.reccobeats.com/v1/track?'))return res({content:[reccoRecord]});
    if(url.includes(`/v1/track/${reccoId}/audio-features`))return res(featureRecord);
    return res(null,204);
  }});
  prepareLookup(archived,{is_playing:true,progress_ms:10250,device:{id:'external-headphones'},item:track()});
  await settle(archived,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.equal(archived.run('lookupState.tempo.status'),'found');
  assert.equal(archived.run('lookupState.tempo.result.source'),'AcousticBrainz');
  assert.equal(archived.run('beatEngine.kind'),'catalog');assert.equal(archived.run('beatEngine.source'),'catalog-grid');
  assert.equal(archived.run('beatEngine.beatMap.length'),400);
  assert(archived.requests.filter(r=>r.url.includes('acousticbrainz.org')).every(r=>!new URL(r.url).searchParams.has('features')),'Full low-level data is requested so beat timestamps are available');
  close(archived.run('beatEngine.bpm'),120,'Timestamp archive is preferred over a simultaneous tempo-only result');
  const before=archived.requests.length;await settle(archived,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');assert.equal(archived.requests.length,before,'A confirmed map is cached without another network request');
  assert(archived.store.has('spotdeck.tempoCache.v2'));assert(!archived.store.has('spotdeck.tempoCache.v1'),'Old BPM-only cache is not reused as timestamp data');
  assert(archived.requests.every(r=>!r.options.headers?.Authorization&&!r.url.includes('api_key')),'Public providers never receive Spotify bearer credentials');
  archived.run('beatEngine.setTempo(88,"manual");applyCatalogTempo()');assert.equal(archived.run('beatEngine.bpm'),88,'Automatic lookup cannot overwrite manual correction');
  archived.event(archived.nodes.get('autoTempo'),'click');assert.equal(archived.run('beatEngine.source'),'catalog-grid');assert.equal(archived.run('beatEngine.beatMap.length'),400,'Returning from manual to Auto restores the cached timestamps');
  archived.run('beatEngine.setTempo(92,"tap");applyCatalogTempo()');assert.equal(archived.run('beatEngine.bpm'),92,'Automatic lookup cannot overwrite tap correction');
  archived.event(archived.nodes.get('autoTempo'),'click');assert.equal(archived.run('beatEngine.source'),'catalog-grid','Returning from Tap to Auto restores the same confirmed catalog result');
  archived.run('ownPlayback.active=true;beatEngine.reset("owned");beatEngine.setTempo(97,"onset");applyCatalogTempo()');assert.equal(archived.run('beatEngine.bpm'),97,'Owned audio remains authoritative');
  archived.run('ownPlayback.active=false;liveBeat.active=true;beatEngine.reset("live");beatEngine.setTempo(105,"live");applyCatalogTempo()');assert.equal(archived.run('beatEngine.bpm'),105,'A selected live source remains authoritative');
  archived.run('stopLiveBeat()');assert.equal(archived.run('beatEngine.source'),'catalog-grid','Stopping capture restores the current confirmed catalog result');
  archived.context.nextData={is_playing:true,progress_ms:0,device:{id:'external-headphones'},item:{...track(secondId,'Next song'),external_ids:{isrc:'USAAA2000002'}}};archived.run('renderPlayback(nextData)');
  assert.equal(archived.run('beatEngine.beatMap'),null,'A track switch immediately clears the old beat map');assert.equal(archived.run('beatEngine.bpm'),null,'A new song never briefly dances to the old tempo');
  console.log('PASS full archived beat map, automatic application, recording cache and no credential transmission.');

  const fallback=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[mbRecord]});
    if(url.includes('acousticbrainz.org'))return Object.assign(res(null,429),{headers:{get:name=>name==='Retry-After'?'60':null}});
    if(url.includes('api.reccobeats.com/v1/track?'))return res({content:[reccoRecord]});
    if(url.includes(`/v1/track/${reccoId}/audio-features`))return res(featureRecord);
    return res(null,204);
  }});
  prepareLookup(fallback,{is_playing:true,progress_ms:10000,device:{id:'external-headphones'},item:track()});
  await settle(fallback,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.equal(fallback.run('lookupState.tempo.status'),'found','An archive provider cooldown does not block a separate provider');
  assert.equal(fallback.run('lookupState.tempo.result.source'),'ReccoBeats');close(fallback.run('beatEngine.bpm'),123.4,'Fallback tempo applied');
  assert.equal(fallback.run('beatEngine.state().phaseKnown'),false,'A tempo fallback stays visibly approximate');
  const reccoQuery=fallback.requests.find(r=>r.url.includes('api.reccobeats.com/v1/track?'));assert.equal(new URL(reccoQuery.url).searchParams.get('ids'),trackId,'Fallback searches the exact Spotify ID');
  assert.equal(fallback.run('beatEngine.source'),'catalog-tempo');

  const mismatched=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[]});
    if(url.includes('api.reccobeats.com/v1/track?'))return res({content:[{...reccoRecord,href:`https://open.spotify.com/track/${secondId}`,isrc:'USAAA2000002'}]});
    if(url.includes('audio-features'))return res(featureRecord);
    return res(null,204);
  }});
  prepareLookup(mismatched,{is_playing:true,progress_ms:0,device:{id:'external'},item:track()});
  await settle(mismatched,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.notEqual(mismatched.run('lookupState.tempo.status'),'found','A provider result for another Spotify ID and ISRC is rejected');assert.equal(mismatched.run('beatEngine.bpm'),null);
  assert(!mismatched.requests.some(r=>r.url.includes(`/v1/track/${reccoId}/audio-features`)),'Wrong identity is rejected before fetching feature details');
  for(const wrong of [{trackTitle:'Example (Live)'},{durationMs:230000}]){
    const variant=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
      if(url.includes('musicbrainz.org'))return res({recordings:[]});
      if(url.includes('api.reccobeats.com/v1/track?'))return res({content:[{...reccoRecord,...wrong}]});
      if(url.includes('audio-features'))return res(featureRecord);
      return res(null,204);
    }});
    prepareLookup(variant,{is_playing:true,progress_ms:0,device:{id:'external'},item:track()});
    await settle(variant,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
    assert.notEqual(variant.run('lookupState.tempo.status'),'found','An exact provider ID cannot override incompatible version or duration');assert.equal(variant.run('beatEngine.bpm'),null);
  }
  const reverse=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[mbRecord]});
    if(url.includes('acousticbrainz.org'))return res({[mbid]:{'0':abRecord}});
    if(url.includes('reccobeats'))return Object.assign(res(null,429),{headers:{get:name=>name==='Retry-After'?'60':null}});
    return res(null,204);
  }});
  prepareLookup(reverse,{is_playing:true,progress_ms:0,device:{id:'external'},item:track()});
  await settle(reverse,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.equal(reverse.run('lookupState.tempo.status'),'found');assert.equal(reverse.run('beatEngine.source'),'catalog-grid','A tempo-provider cooldown does not block the archive');
  const limitedRequests=reverse.requests.filter(r=>r.url.includes('reccobeats')).length;
  await settle(reverse,'findTempoMetadata(trackIdentity(playback.item),true,lookupState.tempo.controller)');
  assert.equal(reverse.requests.filter(r=>r.url.includes('reccobeats')).length,limitedRequests,'Manual refresh cannot bypass the individual provider cooldown');

  const wrongFeatures=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[]});
    if(url.includes('api.reccobeats.com/v1/track?'))return res({content:[reccoRecord]});
    if(url.includes('audio-features'))return res({...featureRecord,id:mbid});
    return res(null,204);
  }});
  prepareLookup(wrongFeatures,{is_playing:true,progress_ms:0,device:{id:'external'},item:track()});
  await settle(wrongFeatures,'findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  assert.notEqual(wrongFeatures.run('lookupState.tempo.status'),'found');assert.equal(wrongFeatures.run('beatEngine.bpm'),null,'Feature data must belong to the selected recording UUID');
  console.log('PASS independent archive cooldown, exact-ID tempo fallback and wrong-recording rejection.');

  let releaseArchive;
  const stale=harness({preferences:{tempoLookup:false},fetcher:async(url,options,res)=>{
    if(url.includes('musicbrainz.org'))return res({recordings:[mbRecord]});
    if(url.includes('acousticbrainz.org'))return new Promise(resolve=>{releaseArchive=()=>resolve(res({[mbid]:{'0':abRecord}}))});
    return res(null,204);
  }});
  prepareLookup(stale,{is_playing:true,progress_ms:0,device:{id:'external'},item:track()});
  const pending=stale.run('findTempoMetadata(trackIdentity(playback.item),false,lookupState.tempo.controller)');
  for(let i=0;i<30&&!releaseArchive;i++){await stale.flush();stale.step(100)}assert(releaseArchive,'Old archive request reached the provider');
  stale.context.nextData={is_playing:true,progress_ms:0,device:{id:'external'},item:{...track(secondId,'Next song'),external_ids:{isrc:'USAAA2000002'}}};stale.run('renderPlayback(nextData)');releaseArchive();await pending;
  assert.equal(stale.run('beatEngine.beatMap'),null);assert.equal(stale.run('beatEngine.bpm'),null,'A late old recording response cannot reach the new track');
  console.log('PASS manual/live/owned priority, capture restoration, immediate track clearing and late-response cancellation.');

  assert.equal(track().id.length,22);assert.equal(secondId.length,22);
})().catch(error=>{console.error(error);process.exitCode=1});
