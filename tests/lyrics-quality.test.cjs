const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const item=(extra={})=>({id:'quality-song',type:'track',name:'Example',artists:[{name:'Singer'}],album:{name:'Album'},duration_ms:200000,external_ids:{isrc:'USAAA2000001'},...extra});
const texts=['Through the city lights we sing together','Every little moment brings us home again'];
function record(id=1,kind='line',lines=texts){
  const rows=lines.map((text,i)=>({text,start_ms:1000+i*7000,...(kind==='line'?{}:{end_ms:6000+i*7000,words:text.split(' ').map((text,j)=>({text,start_ms:1000+i*7000+j*400,...(kind==='word'?{end_ms:1250+i*7000+j*400}:{})}))})}));
  return {id,trackName:'Example',artistName:'Singer',albumName:'Album',duration:200,plainLyrics:lines.join('\n'),syncedLyrics:lines.map((line,i)=>`[00:${String(1+i*7).padStart(2,'0')}.00]${line}`).join('\n'),hasWordSync:kind!=='line',...(kind==='line'?{}:{lyricsfile:JSON.stringify({version:'1.0',metadata:{title:'Example',artist:'Singer',duration_ms:200000},lines:rows})})};
}
const meta={isrc:'USAAA2000001',title:'Example',artist:'Singer',duration:200,sync:'word'};
const prefs={tempoLookup:false,season:'off',surprises:false};
function display(h,primary=record()){
  h.context.item=item();h.context.primary=primary;
  h.run('playback={item,is_playing:true,progress_ms:0};lyricsTrackId=item.id;applyLyricResult(trackIdentity(item),{status:"found",record:primary,source:"LRCLIB",candidates:[]})');
}
async function settle(h,promise){let done=false,error,value;Promise.resolve(promise).then(v=>{done=true;value=v},e=>{done=true;error=e});for(let i=0;i<100&&!done;i++){await h.flush();h.step(400)}if(!done)throw Error('Unfinished lyrics-quality test');if(error)throw error;return value}
async function until(h,predicate){for(let i=0;i<50&&!predicate();i++){await h.flush();h.step(400)}assert(predicate(),'Expected asynchronous quality lookup step');}
(async()=>{
  const q=harness({preferences:prefs});q.context.line=record();q.context.starts=record(2,'start');q.context.full={...record(3,'word'),hasWordSync:false};
  assert.equal(q.run('lyricTimingQuality(line).kind'),'line');
  assert.equal(q.run('lyricTimingQuality(starts).kind'),'word-start');
  assert.equal(q.run('lyricTimingQuality(full).kind'),'word','Actual parsed word ends win even when the provider flag is false');
  assert(q.run('lyricTimingQuality(full).score>lyricTimingQuality(starts).score'));
  q.context.bad={...record(4,'word'),lyricsfile:record(4,'word').lyricsfile.replace('Through','Unrelated')};
  assert.equal(q.run('lyricTimingQuality(bad).kind'),'line','A word list inconsistent with row text cannot advertise word timing');
  q.context.bad={...record(4,'word'),lyricsfile:record(4,'word').lyricsfile.replace('"title":"Example"','"title":"Example (Live)"')};
  assert.equal(q.run('lyricTimingQuality(bad).kind'),'line','Mismatched embedded recording metadata falls back to line data');
  for(const yaml of ['x'.repeat(1000001),'version: "1.0"\nmetadata: &anchor {}\nlines: *anchor']){
    q.context.bad={...record(),lyricsfile:yaml};assert.equal(q.run('lyricTimingQuality(bad).kind'),yaml.length>1000000?'plain':'line','Oversized records are rejected; bounded malformed YAML retains the line fallback');
  }
  q.context.local={lyricsfile:record(3,'word').lyricsfile};assert.equal(q.run('lyricTimingQuality(local).kind'),'word','Standalone/local parser calls retain validated words');
  q.context.item=item();
  assert.equal(q.run('preferTimedLyrics(trackIdentity(item),[line,full]).record.id'),3,'Already found safe candidates prefer actual word-end quality');
  assert.equal(q.run('chooseLyricDefault(trackIdentity(item),{status:"ambiguous",candidates:[{record:line},{record:full}]}).record.id'),3);
  console.log('PASS actual parsed quality tiers, bounded YAML, embedded identity and text consistency, local fallback and best-known candidate ranking.');

  let releaseYaml;
  const fast=harness({preferences:prefs,fetcher:async(url,opts,res)=>{
    if(url.endsWith('.json')&&url.includes('/s/'))return res(meta);
    if(url.endsWith('.yaml'))return new Promise(resolve=>{releaseYaml=()=>resolve(res(record(9,'word').lyricsfile))});
    return res(null,404);
  }});
  display(fast,record(2,'start'));
  assert.equal(fast.run('runtime.lyricsTiming.granularity'),'word-start','Existing words appear synchronously before the upgrade completes');
  const task=fast.run('lookupState.lyricsUpgrade.promise');
  await until(fast,()=>!!releaseYaml);assert.equal(fast.run('lookupState.lyricsResult.record.id'),2);
  releaseYaml();await settle(fast,task);
  assert.equal(fast.run('lookupState.lyricsResult.record.id'),'red:USAAA2000001');
  assert.equal(fast.run('runtime.lyricsTiming.granularity'),'word');
  assert(fast.nodes.get('lyricsNotice').textContent.includes('Wortstarts und -enden'));
  assert.equal(fast.run('lookupState.lyricsCandidates.length'),2,'The original remains available for manual selection');
  const requests=fast.requests.length;fast.run('applyLyricResult(trackIdentity(item),lookupState.lyricsResult)');fast.step(60000);await fast.flush();assert.equal(fast.requests.length,requests,'Neither animation frames nor reapplying a complete result repeat the lookup');
  assert(fast.requests.every(r=>r.options.credentials==='omit'&&!r.options.headers.Authorization));
  assert(fast.requests.filter(r=>r.url.includes('lrc.red')).every(r=>r.options.headers['X-Client-ID']?.includes('SpotDeck')));
  await settle(fast,fast.run('publicMetadata("https://lrclib.net/api/get?id=1",new AbortController().signal)'));
  assert(fast.requests.at(-1).options.headers['X-User-Agent'].includes('SpotDeck'));
  console.log('PASS immediate word-start display, nonblocking word-end upgrade, preserved alternative, honest label, bounded requests and public client headers.');

  q.context.a=record();q.context.near=record(8,'word',['Through the city lights we sing tonight','Every little moment brings us home again']);
  q.context.unrelated=record(8,'word',['Nothing in this completely different phrase agrees','Nor can another unrelated recording be accepted']);
  assert(q.run('lyricTextCompatible(a,near)'),'Small ordered lyric differences remain eligible (the real Bella Napoli sources agree on about 90% of tokens)');
  assert(!q.run('lyricTextCompatible(a,unrelated)'));
  q.context.reordered=record(8,'word',texts.slice().reverse());assert(!q.run('lyricTextCompatible(a,reordered)'));
  for(const [label,body] of [['unrelated',record(8,'word',['Nothing in this completely different phrase agrees','Nor can another unrelated recording be accepted'])],['line-only',record(8)]]){
    const h=harness({preferences:prefs,fetcher:async(url,opts,res)=>url.endsWith('.yaml')?res(body.lyricsfile||JSON.stringify({version:'1.0',metadata:{title:'Example',artist:'Singer',duration_ms:200000},lines:[{text:texts[0],start_ms:1000}]})):url.includes('/s/')?res(meta):res({hits:[]})});
    display(h);await settle(h,h.run('lookupState.lyricsUpgrade.promise'));assert.equal(h.run('lookupState.lyricsResult.record.id'),1,label+' cannot replace the primary');
  }
  console.log('PASS ordered lyric-body guard tolerates small differences and rejects unrelated, reordered and lower-quality replacements.');

  for(const status of [429,503]){
    const h=harness({preferences:prefs,fetcher:async(url,opts,res)=>res(null,status)});display(h);
    await settle(h,h.run('lookupState.lyricsUpgrade.promise'));
    assert.equal(h.run('syncedLyrics.length'),2);assert.equal(h.run('lyricsLoadState'),'loaded');
    const count=h.requests.length;h.run('applyLyricResult(trackIdentity(item),lookupState.lyricsResult)');h.step(60000);await h.flush();assert.equal(h.requests.length,count,'Failure keeps text and a bounded per-track check marker');
    assert(h.run('metadataQuota("lyrics").blocked<=performance.now()'),'The secondary cannot block LRCLIB');
    assert(h.run('lyricCache.get(trackIdentity(item).key).result.record.id')===1);
  }
  console.log('PASS secondary rate limits/network failure retain existing singing data, cache and independent provider backoff.');

  let finishOld;const stale=harness({preferences:prefs,fetcher:async(url,opts,res)=>url.endsWith('.yaml')?new Promise(resolve=>{finishOld=()=>resolve(res(record(9,'word').lyricsfile))}):res(meta)});
  display(stale);const oldTask=stale.run('lookupState.lyricsUpgrade.promise');await until(stale,()=>!!finishOld);
  stale.run('resetLyricLookup();playback={...playback,item:{...item,id:"next",name:"Next"}};renderLyricsState("Next song")');finishOld();await settle(stale,oldTask);
  assert.equal(stale.run('lookupState.lyricsResult'),null);assert.equal(stale.run('lookupState.lyricsUpgrade'),null);assert(!stale.run('lyricCache.get("track:quality-song")'));
  let finishSignature;const changed=harness({preferences:prefs,fetcher:async(url,opts,res)=>url.endsWith('.yaml')?new Promise(resolve=>{finishSignature=()=>resolve(res(record(9,'word').lyricsfile))}):res(meta)});
  display(changed);const changedTask=changed.run('lookupState.lyricsUpgrade.promise');await until(changed,()=>!!finishSignature);changed.run('playback.item={...item,name:"Example (Live)"}');finishSignature();await settle(changed,changedTask);assert.equal(changed.run('lookupState.lyricsResult.record.id'),1);assert.equal(changed.run('lookupState.lyricsUpgrade'),null,'A stale signature cannot leave a permanently occupied upgrade slot');
  console.log('PASS late old-track and same-ID/new-signature results cannot replace or cache the current lyric state.');

  const manual=harness({preferences:prefs});manual.context.item=item();manual.context.first=record(1);manual.context.second=record(2,'start');
  let finishSearch;manual.context.waitSearch=()=>new Promise(resolve=>{finishSearch=resolve});
  manual.run('playback={item,is_playing:true,progress_ms:0};searchLyrics=waitSearch;lyricCache.put(trackIdentity(item).key,{signature:trackIdentity(item).signature,timingPolicy:5,result:{status:"found",record:first,source:"LRCLIB",candidates:[{record:first},{record:second}]}},700000)');
  const waiting=manual.run('loadLyrics(true)');manual.nodes.get('lyricsChoices').value='1';manual.event(manual.nodes.get('lyricsChoices'),'change');
  assert.equal(manual.run('lookupState.lyricsResult.record.id'),2);assert.equal(manual.run('lyricsAbort.signal.aborted'),true);assert.equal(manual.run('lookupState.lyricsUpgrade'),null);
  finishSearch({status:'found',record:record(7,'word'),source:'LRCLIB'});await settle(manual,waiting);
  assert.equal(manual.run('lookupState.lyricsResult.record.id'),2,'A late initial query cannot override a manual choice');
  assert.equal(manual.run('lyricCache.get(trackIdentity(item).key).result.selected'),true);
  const storage=Object.fromEntries(manual.store);const restored=harness({preferences:prefs,storage});restored.context.item=item();restored.run('playback={item,is_playing:true,progress_ms:0}');await settle(restored,restored.run('loadLyrics()'));
  assert.equal(restored.run('lookupState.lyricsResult.record.id'),2);assert.equal(restored.requests.length,0,'Manual selection survives old-cache migration and reload without an automatic upgrade');
  console.log('PASS manual selection cancels both queries, survives cache/reload and is never automatically replaced.');

  for(const order of ['upgrade-first','refresh-first']){
    let finishRefresh,finishUpgrade;
    const racing=harness({preferences:prefs});racing.context.item=item();racing.context.line=record();racing.context.word={...record(9,'word'),lyricSource:'lrc.red'};
    racing.context.holdRefresh=()=>new Promise(resolve=>{finishRefresh=resolve});racing.context.holdUpgrade=()=>new Promise(resolve=>{finishUpgrade=resolve});
    racing.run('playback={item,is_playing:true,progress_ms:0};searchLyrics=holdRefresh;searchRedLyrics=holdUpgrade;lyricCache.put(trackIdentity(item).key,{signature:trackIdentity(item).signature,timingPolicy:6,result:{status:"found",record:line,source:"LRCLIB"}},700000)');
    const refresh=racing.run('loadLyrics(true)'),upgrade=racing.run('lookupState.lyricsUpgrade.promise');
    if(order==='upgrade-first'){
      finishUpgrade({status:'found',record:racing.context.word,source:'lrc.red'});await settle(racing,upgrade);
      assert.equal(racing.run('runtime.lyricsTiming.granularity'),'word');
      finishRefresh({status:'found',record:record(7),source:'LRCLIB'});await settle(racing,refresh);
    }else{
      finishRefresh({status:'found',record:record(7),source:'LRCLIB'});await settle(racing,refresh);
      finishUpgrade({status:'found',record:racing.context.word,source:'lrc.red'});await settle(racing,upgrade);
    }
    assert.equal(racing.run('runtime.lyricsTiming.granularity'),'word','Refresh and background-upgrade completion order must not lower timing quality');
    assert.equal(racing.run('lookupState.lyricsResult.source'),'lrc.red');assert.equal(racing.run('lyricCache.get(trackIdentity(item).key).result.source'),'lrc.red','The cache retains the upgrade as well');
  }
  console.log('PASS cached-line refresh racing with a word-end upgrade keeps the best UI/cache result in both completion orders.');

  const migration=harness({preferences:prefs,fetcher:async(url,opts,res)=>url.endsWith('.yaml')?res(record(9,'word').lyricsfile):res(meta)});migration.context.item=item();migration.context.old=record();
  migration.run('playback={item,is_playing:true,progress_ms:0};lyricCache.put(trackIdentity(item).key,{signature:trackIdentity(item).signature,timingPolicy:5,result:{status:"found",record:old,source:"LRCLIB"}},700000)');
  await settle(migration,migration.run('loadLyrics()'));const upgrading=migration.run('lookupState.lyricsUpgrade?.promise');if(upgrading)await settle(migration,upgrading);
  assert.equal(migration.run('runtime.lyricsTiming.granularity'),'word');assert.equal(migration.run('lyricCache.get(trackIdentity(item).key).timingPolicy'),6);assert(!migration.requests.some(r=>r.url.includes('lrclib')),'An existing timed primary is reused immediately during cache migration');
  console.log('PASS old automatic line cache upgrades without discarding/re-fetching usable primary lyrics.');
})().catch(error=>{console.error(error);process.exitCode=1});
