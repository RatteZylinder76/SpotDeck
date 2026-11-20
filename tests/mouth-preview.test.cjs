const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
  const preview=fs.readFileSync(path.join(__dirname,'../mouth-preview.html'),'utf8'),index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const moduleSource=index.match(/\/\/ BEGIN ARTICULATION MODULE\n([\s\S]*?)\/\/ END ARTICULATION MODULE/)[1].trim();
  assert(preview.includes(moduleSource),'The comparison uses the same engine and rig as production');
  const nodes=new Map();let time=0,id=0;const frames=new Map();
  function node(){const classes=new Set();return {textContent:'',value:'',hidden:false,dataset:{},children:[],events:{},style:{setProperty(k,v){this[k]=v}},classList:{toggle(k,on){on?classes.add(k):classes.delete(k)},contains:k=>classes.has(k)},setAttribute(k,v){this[k]=v},append(n){this.children.push(n)},replaceChildren(){this.children=[]},addEventListener(k,fn){this.events[k]=fn}}}
  for(const match of preview.matchAll(/\bid="([^"]+)"/g))nodes.set(match[1],node());
  for(const [key,value]of Object.entries({example:'german',language:'auto',speed:'1',position:'0',customText:'ich bin hier, ich bin frei'}))nodes.get(key).value=value;
  const jumps=['b','i','ai'].map(jump=>Object.assign(node(),{dataset:{jump}})),document=Object.assign(node(),{getElementById:id=>nodes.get(id),querySelectorAll:()=>jumps,createElement:node,visibilityState:'visible'});
  const context=vm.createContext({document,console,Math,Map,Set,Object,Number,String,Array,performance:{now:()=>time},requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)});
  vm.runInContext(preview.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const run=code=>vm.runInContext(code,context),click=id=>nodes.get(id).events.click();
  function step(ms){for(const until=time+ms;time<until;){time=Math.min(until,time+1000/60);const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time))}}
  assert.equal(run('words.length'),6);assert.equal(frames.size,0,'Comparison waits for an explicit play action');
  assert(nodes.get('newMouth').d.includes('M '));assert.equal(nodes.get('phrase').children.length,6);
  click('play');assert.equal(frames.size,1);step(1300);assert(run('position')>1100);assert.equal(nodes.get('newWord').textContent,'hier');
  assert.equal(frames.size,1,'Two compared faces share one preview clock');click('play');assert.equal(frames.size,0);
  const paused=run('position');step(1000);assert.equal(run('position'),paused,'Pausing freezes the inspected mouth shape');
  jumps[0].events.click();assert.equal(nodes.get('newWord').textContent,'bin');assert.match(nodes.get('newPhase').textContent,/geschlossen/);
  assert.equal(run('rig.render(engine.sample(plan,position),{},{playing:true}).aperture'),0);
  jumps[1].events.click();assert.equal(nodes.get('newWord').textContent,'hier');assert.match(nodes.get('newPhase').textContent,/Vokal halten/);
  nodes.get('position').value='4500';nodes.get('position').events.input();assert.equal(run('position'),4500);assert.equal(frames.size,0);
  nodes.get('example').value='english';nodes.get('example').events.change();assert.equal(run('words.length'),4);assert.equal(nodes.get('customBox').hidden,true);
  nodes.get('example').value='custom';nodes.get('example').events.change();assert.equal(nodes.get('customBox').hidden,false);
  nodes.get('customText').value='<b>Frei & ich</b>';click('applyText');assert(nodes.get('phrase').children.every(n=>typeof n.textContent==='string'));
  assert(!preview.includes('innerHTML'),'Custom text never enters an HTML sink');
  click('play');document.visibilityState='hidden';document.events.visibilitychange();assert.equal(frames.size,0);assert.equal(run('playing'),false);
  nodes.get('example').value='german';nodes.get('example').events.change();click('play');step(7000);assert.equal(frames.size,0);assert.equal(run('playing'),false);assert.equal(run('position'),run('end'));
  assert(!/\bfetch\s*\(|getUserMedia\s*\(|getDisplayMedia\s*\(|speechSynthesis|SPOTIFY_CLIENT/.test(preview),'The comparison needs no connection, capture or generated voice');
  console.log('PASS production-identical comparison, explicit single-clock playback, pause/scrub/jump/end, presets, custom text safety and hidden-tab stop.');
})().catch(error=>{console.error(error);process.exitCode=1});
