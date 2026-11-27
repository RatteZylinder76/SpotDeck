const assert=require("node:assert/strict");
const {harness,html}=require("./spotdeck.test.cjs");

const formats=[
  {width:390,height:844,dpr:3,cover:[115,130,275,290],meta:[42,326,348,400],face:[88,432,302,646]},
  {width:844,height:390,dpr:3,cover:[60,97,225,262],meta:[245,127,467,216],face:[517,72,791,293]},
  {width:1600,height:900,dpr:1,cover:[100,264,392,556],meta:[420,320,814,505],face:[900,199,1450,660]},
  {width:3840,height:2160,dpr:2,cover:[224,626,994,1396],meta:[1050,818,1934,1300],face:[2160,498,3570,1510]}
];
function box([left,top,right,bottom]){
  return {getBoundingClientRect:()=>({left,top,right,bottom,width:right-left,height:bottom-top})};
}
for(const {width,height,dpr,cover,meta,face} of formats){
  const h=harness({width,height,dpr,preferences:{season:"winter",performance:"quality",ambient:true,surprises:false,tempoLookup:false}});
  const obstacles={".art-wrap":box(cover),".meta":box(meta),".vibe-face":box(face)};
  h.document.querySelector=selector=>obstacles[selector]||null;
  h.run('festiveWorld.measureCover();festiveWorld.drawAmbient(100)');
  const canvas=h.nodes.get("christmasVillage");
  const layout=h.run("festiveWorld.villageLayout");
  assert.equal(canvas.hidden,false);
  assert(canvas.width*canvas.height<=8400000,"Static 4K canvas stays within its pixel budget");
  assert(layout.houses.length>=2,"Portrait, short landscape, desktop and 4K each retain a recognizable market");
  for(const house of layout.houses){
    const left=house.x-house.w/2,right=house.x+house.w/2,top=house.y-house.h;
    assert(left>=layout.bounds.left&&right<=layout.bounds.right&&top>=layout.bounds.top);
    for(const [x1,y1,x2,y2] of [cover,meta,face])assert(right<=x1||left>=x2||house.y<=y1||top>=y2,"Detailed house geometry stays clear of the cover, title and face");
  }
  const draws=canvas.getContext().calls;
  h.run('festiveWorld.drawAmbient(500);festiveWorld.drawAmbient(900)');
  assert.equal(canvas.getContext().calls,draws,"Moving lights and smoke do not repaint the static landscape");
  h.run('facePreferences.ambient=false;festiveWorld.drawAmbient(1200)');
  assert.equal(canvas.hidden,true);
  assert.equal(canvas.width,1,"Disabled ambient scenery releases the large backing buffer");
  assert.equal(h.frames.size,1);
}

const player=harness({preferences:{party:true,season:"off",tempoLookup:false}});
const progress=player.nodes.get("partyProgress"),fill=player.nodes.get("partyProgressFill");
assert.match(html,/data-show-mode="false"\]\[data-controls-hidden="true"\]:not\(\.disconnected\) \.party-progress/);
assert.match(html,/id="artists"[\s\S]*?id="partyProgress" role="progressbar"[^>]*hidden><span id="partyProgressFill"><\/span><\/div>/);
player.run('renderPlayback({item:{type:"track",id:"party-meter",duration_ms:120000},progress_ms:30000,is_playing:true,device:{id:"speaker"}})');
assert.equal(progress.hidden,false);
assert.equal(fill.style["--party-progress"],"0.25000");
player.step(12000);
assert.equal(player.nodes.get("app").dataset.controlsHidden,"true");
assert(Number(progress.getAttribute("aria-valuenow"))>=34,"Party progress follows the live playback clock");
player.run('renderPlayback({item:{type:"track",id:"party-meter",duration_ms:120000},progress_ms:90000,is_playing:false,device:{id:"speaker"}},{forceClock:true})');
assert.equal(progress.getAttribute("aria-valuenow"),"75");
player.step(1000);
assert.equal(progress.getAttribute("aria-valuenow"),"75","Paused playback freezes the display");
player.run("showPartyControls();renderPlayback(null)");
assert.equal(player.nodes.get("app").dataset.controlsHidden,"false");
assert.equal(progress.hidden,true,"A track with no duration has no progress bar");
console.log("PASS responsive Christmas layout, protected player areas, static render budget, and Party playback progress.");
