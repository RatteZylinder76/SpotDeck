const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
const preferences={tempoLookup:false,season:'off',surprises:false};
const doc=lines=>JSON.stringify({version:'1.0',metadata:{title:'Example',artist:'Singer',duration_ms:200000},lines});
const h=harness({preferences});
const parse=text=>{h.context.input=text;return h.run('parseLyricsfile(input)')};
async function settle(test,promise){let done=false,value,error;Promise.resolve(promise).then(v=>{done=true;value=v},e=>{done=true;error=e});for(let i=0;i<80&&!done;i++){await test.flush();test.step(400)}if(!done)throw Error('Unfinished input-security test');if(error)throw error;return value}
function streamResponse(chunks,{length=null,error=null}={}){
  const state={reads:0,cancelled:0,released:0,bodyCancelled:0,textCalls:0,jsonCalls:0};let index=0;
  return {state,response:{ok:true,status:200,headers:{get:key=>key.toLowerCase()==='content-length'?length:null},body:{cancel:async()=>{state.bodyCancelled++},getReader:()=>({read:async()=>{state.reads++;if(error)throw error;return index<chunks.length?{done:false,value:chunks[index++]}:{done:true}},cancel:async()=>{state.cancelled++},releaseLock:()=>{state.released++}})},text:async()=>{state.textCalls++;throw Error('Streaming response must not call text()')},json:async()=>{state.jsonCalls++;throw Error('Must not parse an unbounded JSON body')}}};
}
(async()=>{
  for(const yaml of [
    'version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines: [&a {text: Harmless, start_ms: 0},*a]',
    'version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines:\n - &a {text: Harmless, start_ms: 0}\n - *a',
    'version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines: [{text: &a Harmless, start_ms: 0},{text: *a, start_ms: 1}]',
  ])assert.throws(()=>parse(yaml),/Anker|Aliase/,'Flow and block anchors must be rejected by real parser state');
  const literal='stars * shine & glow [*not-an-alias]';
  assert.equal(parse(doc([{text:literal,start_ms:0}]))[0].text,literal,'Quoted lyric symbols are data, not YAML anchors');
  assert.equal(parse('version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines:\n - text: |\n     stars * shine & glow\n   start_ms: 0')[0].text.trim(),'stars * shine & glow','Block scalar symbols also remain valid');
  const amplified='version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines: [&a {text: '+JSON.stringify('H'.repeat(1000))+', start_ms: 0},'+Array(499).fill('*a').join(',')+']';
  assert(amplified.length<3000);assert.throws(()=>parse(amplified),/Anker|Aliase/,'Small YAML cannot expand into hundreds of thousands of rendered lyric characters');
  h.context.proto='version: "1.0"\nmetadata: {title: Example, artist: Singer}\n__proto__: {spotdeckPolluted: true}\nlines: []';h.run('parseLyricsfile(proto)');assert.equal(h.run('({}).spotdeckPolluted'),undefined);
  assert.throws(()=>parse(doc([{text:'H',start_ms:0}]).replace('"lines":','"extra":'+'['.repeat(80)+'0'+']'.repeat(80)+',"lines":')),/komplex/);
  assert.throws(()=>parse('version: "1.0"\nmetadata: {title: Example, artist: Singer}\nlines: []\nextra: !!js/function anything'));
  console.log('PASS actual flow/block anchor rejection, harmless lyric symbols, amplification prevention, nesting, strict JSON schema and prototype isolation.');

  assert.throws(()=>parse(doc(Array.from({length:11},(_,i)=>({text:'H'.repeat(10000),start_ms:i})))),/groß/);
  assert.throws(()=>parse(doc([{text:'H',start_ms:0,words:Array.from({length:101},()=>({text:'H'.repeat(1000),start_ms:0}))}])),/groß/);
  assert.throws(()=>parse(doc([]).replace('"title":"Example"','"title":'+JSON.stringify('H'.repeat(1001)))),/Metadaten/);
  h.context.lrc='[00:01.00]'.repeat(101)+'H'.repeat(1000);assert.equal(h.run('parseLrc(lrc).length'),0,'Multi-timestamp LRC amplification is bounded before rendering');
  h.context.tooLarge={trackName:'Example',artistName:'Singer',duration:200,plainLyrics:'H'.repeat(100001)};
  assert.equal(h.run('usableLyrics(tooLarge)'),false);assert.equal(h.run('validLyricResult({status:"found",record:tooLarge})'),false,'Oversized cached records cannot be reused');
  assert.equal(h.run('lyricText(tooLarge)'),"");
  h.run('renderPlainLyrics(tooLarge.plainLyrics)');assert(h.nodes.get('lyricsBody').innerHTML.length<200,'Direct local text imports also have a final render boundary');
  h.context.malicious='"><img src=x onerror=alert(1)><script>alert(1)</script>';h.run('renderPlainLyrics(malicious)');assert(!h.nodes.get('lyricsBody').innerHTML.includes('<img'));assert(h.nodes.get('lyricsBody').innerHTML.includes('&lt;script&gt;'));
  console.log('PASS aggregated line/word/LRC limits, metadata fields, invalid cache records, local text bounds and escaped markup.');

  const encoded=new TextEncoder().encode('{"text":"❄️ hello"}');
  const good=streamResponse([encoded.slice(0,11),encoded.slice(11,13),encoded.slice(13)]);h.context.response=good.response;
  assert.equal(await settle(h,h.run('boundedMetadataText(response,100)')),'{"text":"❄️ hello"}','Decoder preserves UTF-8 across arbitrary byte boundaries');
  assert.equal(good.state.released,1);assert.equal(good.state.textCalls,0);
  const over=streamResponse([new Uint8Array(4),new Uint8Array(5)]);h.context.response=over.response;
  await assert.rejects(settle(h,h.run('boundedMetadataText(response,8)')),error=>error.code==='payload-too-large');assert.equal(over.state.reads,2);assert.equal(over.state.cancelled,1);assert.equal(over.state.released,1);
  const declared=streamResponse([],{length:'3000001'});const tooBig=harness({preferences,fetcher:async()=>declared.response});
  await assert.rejects(settle(tooBig,tooBig.run('publicMetadata("https://lrclib.net/api/get?id=1",new AbortController().signal)')),error=>error.code==='payload-too-large');
  assert.equal(declared.state.reads,0);assert.equal(declared.state.bodyCancelled,1);assert.equal(declared.state.jsonCalls,0);
  const unknown=streamResponse([new Uint8Array(3000001)]);const chunked=harness({preferences,fetcher:async()=>unknown.response});
  await assert.rejects(settle(chunked,chunked.run('publicMetadata("https://lrc.red/search.json?q=Example",new AbortController().signal,"lyricsRed")')),error=>error.code==='payload-too-large');
  assert.equal(unknown.state.cancelled,1);assert.equal(unknown.state.jsonCalls,0,'Unknown-length oversized JSON is cancelled before parsing');
  const broken=streamResponse([],{error:Error('Harmless stream failure')});h.context.response=broken.response;await assert.rejects(settle(h,h.run('boundedMetadataText(response,100)')),/Harmless stream/);assert.equal(broken.state.cancelled,1);assert.equal(broken.state.released,1);
  console.log('PASS byte-counted streaming, split UTF-8, Content-Length precheck, unknown-length cancellation before JSON parsing and reader cleanup.');

  h.context.response={headers:{get:()=>null},text:async()=>'❄️❄️'};await assert.rejects(settle(h,h.run('boundedMetadataText(response,8)')),error=>error.code==='payload-too-large','Legacy text fallback also counts UTF-8 bytes, not only JS characters');
  const normal=harness({preferences,fetcher:async(url,opts,res)=>res({plainLyrics:'Safe test lyric'})});
  assert.equal((await settle(normal,normal.run('publicMetadata("https://lrclib.net/api/get?id=1",new AbortController().signal)'))).plainLyrics,'Safe test lyric');
  assert.equal(normal.requests[0].options.credentials,'omit');assert(!normal.requests[0].options.headers.Authorization);
  console.log('PASS bounded legacy text fallback, ordinary JSON compatibility and omitted provider credentials.');
})().catch(error=>{console.error(error);process.exitCode=1});
