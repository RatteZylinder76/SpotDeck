const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');
function checked(ctx){
  let depth=0,ops=0;
  for(const method of ['translate','rotate','scale','moveTo','lineTo','quadraticCurveTo','fillRect','strokeRect','arc','ellipse']){
    const old=ctx[method];ctx[method]=function(...args){assert(args.every(Number.isFinite),method+' finite coordinates');if(method==='arc')assert(args[2]>=0);if(method==='ellipse')assert(args[2]>=0&&args[3]>=0);ops++;return old.apply(this,args)};
  }
  ctx.save=()=>depth++;ctx.restore=()=>{assert(--depth>=0,'Balanced canvas state')};
  return {get depth(){return depth},get ops(){return ops}};
}
(async()=>{
  for(const [width,height]of [[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[932,430],[1920,1080]])for(const reduced of [false,true]){
    const h=harness({width,height,reduced,preferences:{season:'vice',tempoLookup:false,surprises:false,homeLyrics:true}}),portrait=height>width;
    const bounds={left:portrait?8:44,top:portrait?47:8,right:width-(portrait?8:44),bottom:height-(portrait?34:21)};
    const cover=portrait?{left:width/2-70,top:90,width:140,height:140}:{left:60,top:68,width:Math.min(175,height*.43),height:Math.min(175,height*.43)};
    const meta=portrait?{left:16,top:242,width:width-32,height:92}:{left:cover.left+cover.width+16,top:100,width:width*.28,height:Math.min(160,height*.42)};
    h.window.getComputedStyle=()=>({});h.nodes.get('sceneSafeArea').getBoundingClientRect=()=>({left:bounds.left,top:bounds.top,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top});
    h.document.querySelector=q=>q==='.art-wrap'?{getBoundingClientRect:()=>cover}:q==='.meta'?{getBoundingClientRect:()=>meta}:q==='.controls'?{getBoundingClientRect:()=>({top:height-(portrait?94:70)})}:null;
    const face={left:width*.62,top:height*.28,width:Math.min(180,width*.35),height:Math.min(180,width*.35)};
    h.nodes.get('vibeFace').getBoundingClientRect=()=>face;
    h.run('refreshSceneGeometry()');assert.equal(h.run('winterSnow.face.left'),face.left,'Vice measures the real smiley even with snow disabled');
    face.left-=15;h.run('refreshSceneGeometry()');assert.equal(h.run('winterSnow.face.left'),face.left,'Geometry refresh replaces stale face bounds');
    const a=checked(h.nodes.get('viceAmbient').getContext()),b=checked(h.nodes.get('viceStory').getContext());
    for(const hidden of [false,true]){
      h.run(`app.dataset.controlsHidden=${JSON.stringify(String(hidden))};viceWorld.measureCover()`);
      for(const radius of [20,80,145]){
        const p=h.run(`viceWorld.safePoint(${width*.25},${height*.35},${radius})`),r=radius*p.scale;
        assert(p.x-r>=bounds.left&&p.x+r<=bounds.right);assert(p.y-r>=bounds.top&&p.y+r<=h.run('viceWorld.groundY()'));
        for(const box of [cover,meta])assert(p.x+r<=box.left||p.x-r>=box.left+box.width||p.y+r<=box.top||p.y-r>=box.top+box.height,'Props avoid artwork and metadata');
      }
      const size=Math.min(115,width*.18,height*.28),lane=h.run(`viceWorld.skyLane(viceWorld.groundY()-6-${size}*.08,${size}*.6)`),carTop=lane.y-size*.45*lane.scale-4*lane.scale,carBottom=lane.y+size*.12*lane.scale;
      assert(carTop>=bounds.top&&carBottom<=h.run('viceWorld.groundY()'),'Full car, police bar and wheels fit the actual lane');
      assert(lane.y-(size*.5+4)*lane.scale>=bounds.top,'Race countdown fits at the lane scale');
      for(const box of [cover,meta])assert(carBottom<=box.top||carTop>=box.top+box.height,'Full car roof clears content, not just its baseline');
      for(const id of Array.from(h.run('viceFeatures.filter(f=>f.duration).map(f=>f.id)'))){
        h.run(`clearHalloween();beginVice(${JSON.stringify(id)},performance.now(),true)`);
        for(const fraction of [.05,.3,.55,.8,.95])h.run(`var scene=effects.active;var time=scene.start+(scene.end-scene.start)*${fraction};viceWorld.drawStory(viceWorld.ctx,scene,time);viceWorld.facePose(scene,time)`);
        assert.equal(b.depth,0);h.run('clearHalloween()');
      }
      for(const mood of ['sunset','night','dawn'])h.run(`facePreferences.viceMood=${JSON.stringify(mood)};viceWorld.configure();viceWorld.drawAmbient(performance.now()+2000)`);
      assert.equal(a.depth,0);assert(a.ops>0&&b.ops>0);assert.equal(h.frames.size,1);
      for(const lyrics of [false,true])for(const expanded of [false,true]){
        h.run(`facePreferences.homeLyrics=${lyrics}`);
        const diameter=Math.min(width*(expanded?.92:.58),height*(expanded?.88:.6));
        Object.assign(face,{left:(width-diameter)/2,top:height*.15,width:diameter,height:diameter});h.run('refreshSceneGeometry()');
        const palms=Array.from(h.run('viceWorld.palmLayout()'));
        assert(palms.length<=2,'Palms frame the screen instead of filling the face area');
        for(const palm of palms){
          const box=palm.bounds;
          assert(palm.size<=260&&palm.size<=height*.36);
          assert(box.right<=face.left-24||box.left>=face.left+face.width+24||box.bottom<=face.top-24||box.top>=face.top+face.height+24,'Full wind-swept palm stays outside the large face, with or without lyrics');
          for(const content of [cover,meta])assert(box.right<=content.left||box.left>=content.left+content.width||box.bottom<=content.top||box.top>=content.top+content.height,'Edge palms also clear cover and text');
        }
      }
    }
    h.run('viceWorld.captionBounds={left:100,top:100,right:250,bottom:150}');
    assert(h.run('viceWorld.sceneObstacles().includes(viceWorld.captionBounds)'),'Home lyrics are a protected foreground region');
    h.step(120000,1000);assert.equal(h.frames.size,1);assert.equal(h.run('viceWorld.props.length'),0,'Vice creates no accumulating residue');
    h.nodes.get('seasonSetting').value='off';h.event(h.nodes.get('seasonSetting'),'change');assert.equal(h.nodes.get('viceStory').hidden,true);
  }
  const h=harness({width:998,height:900,preferences:{season:'vice',surprises:false,tempoLookup:false}}),ctx=h.nodes.get('viceAmbient').getContext(),fills=[];
  let clips=0;ctx.clip=()=>clips++;ctx.fillRect=function(x,y,w,height){fills.push({x,y,w,height,color:this.fillStyle})};
  h.run('viceWorld.drawAmbient(performance.now())');assert.equal(clips,0,'Ambient canvas reaches the edge instead of clipping to the safe-area inset');
  assert(fills.filter(r=>r.x===0&&r.y===0&&r.w===998&&r.height===900).length>=2,'Both background gradient and final tint fill all four screen edges');
  for(const color of ['#26354d','#151c32'])assert(fills.some(r=>r.color===color&&r.x===0&&r.w===998&&Math.abs(r.y+r.height-900)<1e-6),'Water and road reach the bottom and side edges');
  const panel={getBoundingClientRect:()=>({left:0,top:0,width:400,height:400}),animate:()=>({cancel(){}})};h.document.querySelector=q=>q==='.face-panel'?panel:null;
  h.run('setPartyExpansion(1);setPartyExpansion(0)');assert(h.run('!!partyPresentation.faceBounds'),'Rapid reversal keeps its temporary clearance');
  h.step(700);assert.equal(h.run('partyPresentation.faceBounds'),null,'Rapid reversal releases temporary clearance at the end');
  console.log('PASS all Vice scenes and moods at eight sizes, both motion modes, artwork/text exclusion, canvas state, theme cleanup and bounded resources.');
})().catch(error=>{console.error(error);process.exitCode=1});
