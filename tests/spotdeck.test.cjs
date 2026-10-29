// Dependency-free integration checks; no real account, token or network calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
function harness({reduced=false,pointer=true,session=false,drm=true,fetcher}={}){
  let now=0,nextId=0;
  const timers=new Map(),frames=new Map(),nodes=new Map(),store=new Map(),requests=[],players=[];
  function node(id=''){
    const classes=new Set(),handlers={};
    return {id,value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,dataset:{},children:[],handlers,
      style:{setProperty(k,v){this[k]=v}},classList:{add(...v){v.forEach(x=>classes.add(x))},remove(...v){v.forEach(x=>classes.delete(x))},contains:x=>classes.has(x),toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x)}},
      addEventListener(name,fn){(handlers[name] ||= []).push(fn)},
      setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},
      append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},remove(){},
      querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),scrollTo(){},closest:()=>null,
    };
  }
  for(const match of html.matchAll(/\bid="([^"]+)"/g))nodes.set(match[1],node(match[1]));
  const document=node('document');Object.assign(document,{visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:()=>node(),head:node(),documentElement:node(),body:node()});
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
  if(session)store.set('spotdeck.session',JSON.stringify({access_token:'TEST_ONLY',refresh_token:'TEST_REFRESH',auth_version:2,expires_at:Date.now()+3600000,scopes:['streaming','user-read-email','user-read-private']}));
  class MockPlayer{
    constructor(options){this.options=options;this.events={};this.calls=[];players.push(this)}
    addListener(name,fn){this.events[name]=fn;return true}
    async connect(){this.events.ready({device_id:'local-test'});return true}
    disconnect(){this.calls.push('disconnect')}
    activateElement(){this.calls.push('activate');return Promise.resolve()}
    async togglePlay(){this.calls.push('toggle')}
    async nextTrack(){this.calls.push('next')}
    async previousTrack(){this.calls.push('previous')}
    async seek(ms){this.calls.push(['seek',ms])}
    async setVolume(value){this.calls.push(['volume',value])}
  }
  const window=node('window');Object.assign(window,{isSecureContext:true,PointerEvent:pointer?function(){}:undefined,Spotify:{Player:MockPlayer}});
  const context=vm.createContext({window,document,localStorage,sessionStorage:localStorage,location:{origin:'http://127.0.0.1:8765',pathname:'/index.html',search:'',href:''},history:{replaceState(){}},
    navigator:drm?{requestMediaKeySystemAccess(){}}:{},
    matchMedia:()=>({matches:reduced,addEventListener(){},addListener(){}}),performance:{now:()=>now},console,URL,URLSearchParams,AbortController,Image:class{},Uint8Array,Date,Math,
    setTimeout:(fn,delay=0)=>{timers.set(++nextId,{fn,at:now+delay});return nextId},clearTimeout:id=>timers.delete(id),
    setInterval:(fn,delay)=>{timers.set(++nextId,{fn,at:now+delay,delay});return nextId},clearInterval:id=>timers.delete(id),
    requestAnimationFrame:fn=>{frames.set(++nextId,fn);return nextId},cancelAnimationFrame:id=>frames.delete(id),
    fetch:async(url,options={})=>{
      requests.push({url,options});
      if(fetcher) return fetcher(url,options,response);
      if(url.includes('/devices'))return response({devices:[{id:'external-test',name:'Wohnzimmer',is_active:true}]});
      if(url.includes('lrclib'))return response({syncedLyrics:'[00:00.00]Water hello\n[00:05.00]Hello world'});
      if(url.includes('audio-features'))return response({tempo:110,energy:.6});
      if(url.includes('/contains'))return response([false]);
      return response(null,204);
    }
  });
  vm.runInContext(script,context,{filename:'index.html'});
  function run(code){return vm.runInContext(code,context)}
  function event(target,type,props={}){for(const fn of (target.handlers[type]||[])) fn({target,preventDefault(){},stopPropagation(){},button:0,isPrimary:true,pointerId:1,clientX:30,clientY:30,...props})}
  function step(ms){
    const end=now+ms;
    while(now<end){
      now=Math.min(end,now+34);
      for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);if(t.delay)timers.set(id,{...t,at:now+t.delay});t.fn()}
      const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));
    }
  }
  return {context,run,nodes,document,window,store,requests,players,frames,timers,event,step,response,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

(async()=>{
  const h=harness({reduced:true});
  assert.equal(h.run('motionLevel()'),0);
  assert.equal(h.frames.size,1,'One idle animation loop');
  h.run('startProgressAnimation();startVibeFace();startProgressAnimation()');
  assert.equal(h.frames.size,1,'Repeated polls/starts cannot duplicate animation loops');
  h.step(1500);
  h.run('startVibeExpression("shy",2000)');h.step(600);
  assert.equal(h.nodes.get('vibeFace').dataset.expression,'shy','Reduced motion still allows expressions');
  h.run('facePreferences.motion="normal";applyFacePreferences()');
  assert.equal(h.run('motionLevel()'),1,'Explicit normal overrides OS reduced motion');
  h.step(1200);assert.notEqual(h.nodes.get('vibeFace').style['--motion-x'],'0.00px','Idle head moves');
  const face=h.nodes.get('vibeFace');
  h.run('vibeTapReactionUntil=0;vibeNextExpression=Infinity');
  h.event(face,'pointerdown');h.event(face,'pointerup');h.step(750);
  assert(['shy','cheeky','grin','surprise','bashful'].includes(face.dataset.expression));
  h.step(3400);
  for(let i=0;i<5;i++){h.event(face,'pointerdown',{isPrimary:undefined});h.event(face,'pointerup',{isPrimary:undefined});h.step(400)}
  assert(face.classList.contains('easteregg'),'Five desktop clicks within relaxed window');
  assert.equal(h.frames.size,1,'Easteregg shares existing loop');
  h.step(8000);assert(!face.classList.contains('easteregg'));
  h.document.visibilityState='hidden';h.event(h.document,'visibilitychange');assert.equal(h.frames.size,0);
  h.document.visibilityState='visible';h.event(h.document,'visibilitychange');assert.equal(h.frames.size,1);
  assert.equal(h.run('facePreferences.sound'),false);
  console.log('PASS desktop reduced motion, explicit override, idle, variable reactions, five clicks, cleanup, hidden tab and single RAF.');

  const t=harness({pointer:false});const tf=t.nodes.get('vibeFace');
  for(let i=0;i<5;i++){
    t.event(tf,'touchstart',{touches:[{clientX:0,clientY:0}]});
    t.event(tf,'touchend',{touches:[],changedTouches:[{clientX:0,clientY:0}]});
    t.event(tf,'click');t.step(180);
  }
  assert(tf.classList.contains('easteregg'),'Legacy touch with ghost clicks counted once');
  console.log('PASS legacy touch fallback and ghost-click suppression.');

  const s=harness({session:true});await s.flush();
  s.run('playbackMode="local";playbackModeSelect.value="local"');
  assert.equal(await s.run('prepareLocalPlayback()'),'local-test');
  assert.equal(s.players.length,1);
  await s.run('startLocalPlayback()');
  const transfer=s.requests.find(r=>r.options.method==='PUT' && r.url.endsWith('/me/player'));
  assert(transfer);assert.deepEqual(JSON.parse(transfer.options.body),{device_ids:['local-test'],play:true});
  assert.equal(s.players[0].calls[0],'activate','Audio activation occurs in click path before transfer');
  s.players[0].events.player_state_changed({position:1200,duration:30000,paused:false,shuffle:false,track_window:{current_track:{id:'song',name:'Song',uri:'spotify:track:song',album:{name:'Album',images:[]},artists:[{name:'Artist'}]}}});
  await s.flush();
  assert.equal(s.nodes.get('title').textContent,'Song');
  await s.run('playPause();skip("next");skip("previous");seekPlayback(5000);setVolume(25)');
  await s.flush();
  assert(s.players[0].calls.includes('toggle'));assert(s.players[0].calls.includes('next'));assert(s.players[0].calls.includes('previous'));
  assert(s.players[0].calls.some(c=>Array.isArray(c)&&c[0]==='seek'&&c[1]===5000));
  assert(s.players[0].calls.some(c=>Array.isArray(c)&&c[0]==='volume'&&c[1]===.25));
  await s.run('playUris(["spotify:track:song"])');
  assert(s.requests.some(r=>r.url.includes('/me/player/play?device_id=local-test')));
  s.players[0].events.account_error({message:'premium'});
  assert.equal(s.run('playbackMode'),'controller');assert(s.nodes.get('playerStatus').textContent.includes('Premium'));
  console.log('PASS local SDK initialization, activation, transfer, metadata, play/pause, skip, seek, volume, library and account-error fallback.');

  const tv=harness({session:true,drm:false});await tv.flush();
  await tv.run('prepareLocalPlayback()');assert.equal(tv.players.length,0);assert(tv.nodes.get('playerStatus').textContent.includes('HDMI'));
  const old=harness();old.store.set('spotdeck.session',JSON.stringify({access_token:'OLD_TEST',auth_version:2}));
  await old.run('prepareLocalPlayback()');assert.equal(old.players.length,0);assert.equal(old.nodes.get('sdkAuthBtn').hidden,false);
  console.log('PASS unsupported TV/DRM fallback and old-controller-session scope upgrade without forced logout.');
})().catch(error=>{console.error(error);process.exitCode=1});
