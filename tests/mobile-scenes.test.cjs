const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
(async()=>{
  const sizes=[[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[932,430],[1920,1080]];
  for(const [width,height]of sizes){
    const h=harness({width,height,preferences:{season:'winter',tempoLookup:false,surprises:false}}),portrait=height>width;
    const safe={left:portrait?8:44,top:portrait?47:8,right:width-(portrait?8:44),bottom:height-(portrait?34:21)};
    const cover=portrait?{left:width/2-70,top:90,width:140,height:140}:{left:60,top:68,width:Math.min(175,height*.43),height:Math.min(175,height*.43)};
    const meta=portrait?{left:16,top:242,width:width-32,height:92}:{left:cover.left+cover.width+16,top:100,width:width*.28,height:Math.min(160,height*.42)};
    const face=portrait?{left:width*.2,top:height*.55,width:width*.6,height:width*.6}:{left:width*.67,top:height*.24,width:Math.min(width*.27,height*.57),height:Math.min(width*.27,height*.57)};
    h.window.getComputedStyle=()=>({});
    h.nodes.get('sceneSafeArea').getBoundingClientRect=()=>({left:safe.left,top:safe.top,width:safe.right-safe.left,height:safe.bottom-safe.top});
    h.nodes.get('vibeFace').getBoundingClientRect=()=>face;
    h.document.querySelector=selector=>selector==='.art-wrap'?{getBoundingClientRect:()=>cover}:selector==='.meta'?{getBoundingClientRect:()=>meta}:selector==='.controls'?{getBoundingClientRect:()=>({top:height-(portrait?94:70)})}:null;
    h.run('refreshSceneGeometry()');
    for(const controlsHidden of [false,true]){
      h.run(`app.dataset.controlsHidden=${JSON.stringify(String(controlsHidden))}`);
      assert(h.run('festiveWorld.groundY()')<=safe.bottom,'Ground avoids home indicator');
      for(const radius of [18,40,80,150]){
        const point=h.run(`festiveWorld.safePoint(${width*.24},${height*.4},${radius})`),r=radius*point.scale;
        assert(point.scale>0&&point.scale<=1);
        assert(point.x-r>=safe.left-1e-6&&point.x+r<=safe.right+1e-6,'Actor fits horizontally');
        assert(point.y-r>=safe.top-1e-6&&point.y+r<=h.run('festiveWorld.groundY()')+1e-6,'Actor fits vertically');
        for(const box of [cover,meta])assert(point.x+r<=box.left||point.x-r>=box.left+box.width||point.y+r<=box.top||point.y-r>=box.top+box.height,'Actor stays clear of cover and song text');
        const lane=h.run(`festiveWorld.skyLane(${height*.2},${radius})`),rr=radius*lane.scale;
        assert(lane.scale>0);assert(lane.y-rr>=safe.top-1e-6&&lane.y+rr<=h.run('festiveWorld.groundY()')+1e-6,'Flight fits available height');
        for(const box of [cover,meta])assert(lane.y+rr<=box.top||lane.y-rr>=box.top+box.height,'Flight corridor avoids content');
      }
      const ids=Array.from(h.run('winterKinds.slice()'));
      for(const id of ids){
        h.run(`clearHalloween();beginWinter(${JSON.stringify(id)},performance.now(),true)`);
        for(const fraction of [.1,.4,.7,.9])h.run(`if(effects.active){var scene=effects.active;tickWinterScene(scene.start+(scene.end-scene.start)*${fraction});festiveWorld.drawStory(festiveWorld.ctx,scene,scene.start+(scene.end-scene.start)*${fraction})}`);
      }
      h.run('clearHalloween()');
      for(const id of Array.from(h.run('festiveFeatures.filter(f=>f.type==="ambient").map(f=>f.id)')))h.run(`festiveWorld.preview(${JSON.stringify(id)});festiveWorld.drawAmbient(performance.now()+1000)`);
      assert.equal(h.frames.size,1,'Responsive scenes retain one animation loop');
    }
    h.run('winterSnow.flakes=[];winterSnow.clear();winterSnow.deposit(100,1000)');
    const mass=h.run('winterSnow.totalMass()');h.window.innerHeight=height-35;h.event(h.window,'resize');h.step(34);
    assert(Math.abs(h.run('winterSnow.totalMass()')-mass)<1e-6,'Changing browser height preserves collected snow');
    assert(h.run('sceneViewport.bottom')<=height-35-8,'Visible viewport shrink refreshes the scene bounds');
  }
  const h=harness({width:844,height:390,preferences:{season:'winter',tempoLookup:false}});
  h.window.getComputedStyle=()=>({});h.nodes.get('sceneSafeArea').getBoundingClientRect=()=>({left:44,top:8,width:756,height:361});
  h.window.visualViewport={offsetLeft:0,offsetTop:0,width:844,height:330};h.run('refreshSceneGeometry()');assert.equal(h.run('sceneViewport.bottom'),322,'Browser chrome uses visual viewport, not stale layout height');
  const prop={style:{setProperty(k,v){this[k]=v}},classList:{contains:()=>false},getBoundingClientRect:()=>({left:760,top:-30,width:160,height:90})};
  h.nodes.get('winterLayer').children=[prop];h.run('refreshSceneGeometry()');
  assert(Number.parseFloat(prop.style['--decor-fit-x'])<0&&Number.parseFloat(prop.style['--decor-fit-y'])>0,'Accessory moves inside the safe screen without moving the face');
  h.run('openSettingsPanel();app.scrollTop=80;app.scrollLeft=15;closeSettingsPanel()');
  assert.equal(h.run('app.scrollTop'),0);assert.equal(h.run('app.scrollLeft'),0,'Closing a scrolled overlay restores the stage origin');
  assert.match(html,/overflow:hidden;overflow:clip/,'The main stage cannot become an invisible focus-scroll container');
  assert(html.includes('window.visualViewport?.addEventListener("resize",invalidateSceneGeometry)'));
  assert(html.includes('<path id="faceMouthPath" d="M 8 8 C 18 42 82 42 92 8 C 82 42 18 42 8 8 Z"></path>'));
  console.log('PASS every winter/magic scene at eight sizes, portrait/landscape safe areas, cover/text clearance, dock/party lanes, viewport changes, accessory fitting and original face.');
})().catch(error=>{console.error(error);process.exitCode=1});
