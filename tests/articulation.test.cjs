const assert=require('node:assert/strict');
const {harness,html}=require('./spotdeck.test.cjs');
const near=(a,b,epsilon=1e-7)=>assert(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);
const ids=value=>Array.from(value.phones,p=>p.id);
const finitePose=pose=>{for(const key of ['open','round','wide','seal','tension'])assert(Number.isFinite(pose[key])&&pose[key]>=0&&pose[key]<=1,key+' is normalized');for(const key of ['upper','lower','corners'])assert(Number.isFinite(pose[key])&&Math.abs(pose[key])<=1,key+' is finite');};

(async()=>{
  const h=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  h.run('var testArticulation=new ArticulationEngine();var testRig=new MouthRig()');
  const pronounce=(word,language='de')=>h.run(`testArticulation.pronounce(${JSON.stringify(word)},${JSON.stringify(language)})`);
  assert.deepEqual(ids(pronounce('frei')),['F','R','A','I'],'The German diphthong follows pronunciation rather than written E-I');
  assert.deepEqual(ids(pronounce('bin')),['B','IH','N']);
  assert.deepEqual(ids(pronounce('ich')),['IH','CH_DE']);
  assert.deepEqual(ids(pronounce('good','en')),['G','UH','D'],'A spelling with oo does not replace the actual short vowel with an invented U-long');
  for(const word of ['hier','wir','für','nur'])assert.equal(pronounce(word).syllables,1,word+' has one nucleus and a short vocalic-r release');
  const hier=pronounce('hier');assert(hier.phones.at(-1).weight<hier.phones[1].weight,'The vowel carries more duration than the r release');
  assert.deepEqual(ids(pronounce('die','de')),['D','I']);assert.deepEqual(ids(pronounce('die','en')),['D','A','I']);
  assert.equal(h.run('testArticulation.detectLanguage("in die Nacht")'),'de');assert.equal(h.run('testArticulation.detectLanguage("die tonight")'),'en');
  assert.equal(ids(pronounce('Wasser'))[0],'V');assert.equal(h.run('testArticulation.shape("V").viseme'),'fv');
  assert(ids(pronounce('schön')).includes('OE'));assert(ids(pronounce('für')).includes('UE'));
  for(const [word,expected]of [['make',['M','E','I','K']],['mile',['M','A','I','L']],['home',['H','O','U','M']]])assert.deepEqual(ids(pronounce(word,'en')),expected,'Regular English long vowels survive silent e');
  const unknown=pronounce('中文','auto');assert.equal(unknown.source,'fallback');assert(unknown.phones.length<=2);
  for(let i=0;i<900;i++)pronounce('boundedword'+i,'en');assert(h.run('testArticulation.cache.size')<=512,'Pronunciation memory stays bounded');

  h.run('var lineWords=testArticulation.buildWords({time:0,text:"ich bin hier, ich bin frei"},6000,"de")');
  const estimated=Array.from(h.run('lineWords'));assert.equal(estimated.length,6);assert(estimated.every(w=>w.timing==='estimated'&&w.confidence<1));
  for(let i=0;i<estimated.length;i++){const word=estimated[i];assert(word.start>=0&&word.end>word.start&&word.end<=6000);if(i)assert(word.start>=estimated[i-1].end);}
  assert.equal(h.run('testArticulation.buildWords({time:0,text:"[Instrumental]"},3000).length'),0);
  assert.equal(h.run('testArticulation.buildWords({time:0,text:""},3000).length'),0);
  h.run('var sparseBefore=testArticulation.buildWords({time:0,text:"These lights are blue"},13999,"en");var sparseAfter=testArticulation.buildWords({time:0,text:"These lights are blue"},14001,"en")');
  assert(Math.abs(h.run('sparseAfter.at(-1).end-sparseBefore.at(-1).end'))<3,'Estimated phrase duration changes continuously around the old fourteen-second cliff');
  h.run('var sparseWords=testArticulation.buildWords({time:1000,text:"These lights are blue"},9000,"en");var sparsePlan=testArticulation.compile(sparseWords,"en")');
  assert(h.run('sparsePlan.end')<7000,'A few estimated words do not fill an entire eight-second gap with vowel singing');
  assert.equal(h.run('testArticulation.sample(sparsePlan,8500).active'),false,'The unused tail of an uncertain line span remains a real pause');
  assert(h.run('sparseWords.every(word=>word.timing==="estimated"&&word.confidence<.5)'),'A guessed phrase cutoff never claims precise timing');
  h.run('var suppliedLine=testArticulation.buildWords({time:1000,end:9000,text:"These lights are blue"},12000,"en")');
  near(h.run('suppliedLine.at(-1).end'),9000);
  h.run('var isolatedHold=testArticulation.buildWords({time:1000,text:"Ooh"},9000,"en");var isolatedPlan=testArticulation.compile(isolatedHold,"en")');
  near(h.run('isolatedHold[0].end'),9000);assert.equal(h.run('testArticulation.sample(isolatedPlan,8000).long'),true,'An isolated sustained vowel is not cut by the multiword phrase prior');
  h.run('var stressWords=testArticulation.buildWords({time:0,text:"we are in the blue light"},6500,"en")');
  for(let i=0;i<4;i++)assert(h.run(`stressWords[${i}].end-stressWords[${i}].start`)<=420+1e-7,'Unstressed function words are not stretched like the phrase nucleus');
  assert(h.run('stressWords.at(-1).end-stressWords.at(-1).start')>h.run('stressWords[0].end-stressWords[0].start'),'Phrase-final content retains more of the singing span');
  h.run('var germanStress=testArticulation.buildWords({time:0,text:"ich bin in der Nacht"},6000,"de")');
  for(let i=0;i<4;i++)assert(h.run(`germanStress[${i}].end-germanStress[${i}].start`)<=420+1e-7,'The weak-word prior also applies in German');
  h.run('var punctuationWords=testArticulation.buildWords({time:0,text:"blue, light"},4000,"en");var punctuationPlan=testArticulation.compile(punctuationWords,"en")');
  assert(h.run('punctuationWords[1].start-punctuationWords[0].end')>45,'An inferred punctuation pause remains distinct from a tiny connected separator');
  assert.equal(h.run('testArticulation.sample(punctuationPlan,(punctuationWords[0].end+punctuationWords[1].start)/2).active'),false);
  const endedLrc=h.run('parseLrc("[00:01.00]Invented morning colors\\n[00:03.00]\\n[00:07.00]Invented evening colors")');
  assert.equal(endedLrc.length,2,'A blank pause marker need not render an empty lyric row');assert.equal(endedLrc[0].end,3000,'The blank LRC timestamp preserves the previous phrase end');
  h.context.endedLrc=endedLrc;h.run('var endedPlan=testArticulation.compile(testArticulation.buildWords(endedLrc[0],endedLrc[1].time,"en"),"en")');
  assert.equal(h.run('testArticulation.sample(endedPlan,5000).active'),false,'A provider pause marker cannot turn into singing through an instrumental gap');
  h.run('var preciseWords=testArticulation.buildWords({time:0,end:3000,text:"bin hier",words:[{word:"bin",start:1000,end:1400},{word:"hier",start:1900,end:2800}]},3000,"de");var precisePlan=testArticulation.compile(preciseWords,"de")');
  assert.equal(h.run('preciseWords[0].start'),1000);assert.equal(h.run('preciseWords[0].end'),1400);assert.equal(h.run('preciseWords[1].start'),1900);
  assert.equal(h.run('testArticulation.sample(precisePlan,1600).open'),0,'Real silent word gaps are not filled with invented singing');
  assert.equal(h.run('precisePlan.phonemeTiming'),'inferred','Exact word timestamps do not imply exact phoneme times');
  assert(h.run('precisePlan.confidence')<1);

  h.run('var phonemeWords=[{word:"bin",start:0,end:900,index:0,timing:"word",explicitEnd:true,confidence:.95,phones:[{phone:"B",start:0,end:100},{phone:"IH",start:100,end:800},{phone:"N",start:800,end:900}]}];var phonePlan=testArticulation.compile(phonemeWords,"de")');
  assert.equal(h.run('phonePlan.phonemeTiming'),'provided');assert.equal(h.run('phonePlan.timing'),'phoneme');
  h.run('var readableConsonants=testArticulation.compile([{word:"bin",start:0,end:1000,index:0,timing:"word",explicitEnd:true}],"de")');
  for(const segment of Array.from(h.run('readableConsonants.segments')).filter(segment=>!segment.vowel))assert(segment.end-segment.start>=80&&segment.end-segment.start<=100,'Inferred consonant contacts have readable 80–100 ms targets when there is time');
  h.run('var shortSupplied=testArticulation.compile([{word:"bin",start:0,end:1000,index:0,timing:"word",phones:[{phone:"B",start:0,end:35},{phone:"IH",start:35,end:965},{phone:"N",start:965,end:1000}]}],"de")');
  near(h.run('shortSupplied.segments[0].end'),35);near(h.run('shortSupplied.segments.at(-1).start'),965);
  for(const time of [0,33,66,99]){
    const speech=h.run(`testArticulation.sample(phonePlan,${time})`);assert.equal(speech.phone,'B');assert.equal(speech.seal,1);assert.equal(speech.active,true);
    h.context.sealSpeech=speech;const mouth=h.run('testRig.render(sealSpeech,{open:1,smile:20},{playing:true})');assert.equal(mouth.aperture,0,'Surprise and laughter cannot undo a closed consonant');
  }
  for(const time of [200,350,550])assert.equal(h.run(`testArticulation.sample(phonePlan,${time}).phone`),'IH','A sustained vowel remains the carrier');
  h.run('var releasingSeal=testArticulation.sample(phonePlan,120)');assert(h.run('testRig.render(releasingSeal,{open:1},{playing:true}).aperture')>0,'The following vowel opens continuously instead of inheriting the previous B classification');
  for(const phone of ['I','F']){
    h.context.readablePhone=phone;h.run('var readableSpeech={...testArticulation.shape(readablePhone),active:true,phone:readablePhone};var readableMouth=testRig.render(readableSpeech,{},{playing:true})');
    if(phone==='F'){
      assert(h.run('readableMouth.contact')>.9,'F reaches a visible lip-contact gesture');
      assert(h.run('readableMouth.aperture')<=h.run('readableMouth.strokeWidth'),'F brings the central lower lip into contact instead of keeping a generic open oval');
      assert.equal(h.run('testRig.details(readableMouth).teeth.opacity'),0,'The contact introduces no teeth');
    }else assert(h.run('readableMouth.aperture-readableMouth.strokeWidth')>4,'A narrow '+phone+' retains visible negative space at its actual stroke width');
  }
  h.run('var familyRigPoses={};var neutralFamilyRig=new MouthRig({singingSmile:0});var neutralRigPoses={};for(var familyPhone of ["M","B","P","F","V","T","D","N","K","G","NG","H","S","Z","SH","ZH","CH_DE","R","L","TH","A","I","IH","E","AE","AX","O","OH","U","UH"]){var familySpeech={...testArticulation.shape(familyPhone),active:true,phone:familyPhone,timing:"word"};familyRigPoses[familyPhone]=testRig.render(familySpeech,{},{playing:true});neutralRigPoses[familyPhone]=neutralFamilyRig.render(familySpeech,{},{playing:true})}');
  const familyPoses=h.run('familyRigPoses'),neutralPoses=h.run('neutralRigPoses');
  const familyWidth=pose=>pose.points[1][0]-pose.points[0][0];
  const familyDistance=(a,b)=>a.points.reduce((sum,point,i)=>sum+Math.hypot(point[0]-b.points[i][0],point[1]-b.points[i][1]),0)/a.points.length;
  for(const pair of [['M','B'],['B','P'],['F','V'],['T','D'],['D','N'],['K','G'],['G','NG'],['S','Z'],['SH','ZH'],['SH','CH_DE']])near(familyDistance(familyPoses[pair[0]],familyPoses[pair[1]]),0);
  for(const pair of [['T','K'],['K','H'],['S','SH'],['L','R'],['I','IH'],['E','AE'],['O','OH'],['U','UH']])assert(familyDistance(familyPoses[pair[0]],familyPoses[pair[1]])>1.2,'Visible '+pair.join('/')+' families differ in actual lip geometry');
  assert(familyWidth(familyPoses.SH)<familyWidth(familyPoses.S)*.8,'SH/CH purses the lips while S/Z remains spread');
  assert(familyPoses.H.aperture>familyPoses.K.aperture*1.2,'The breath family has a more released jaw than a velar contact');
  assert(familyPoses.AE.aperture>familyPoses.E.aperture*1.4,'AE has its own lower-jaw opening instead of reusing E');
  assert(familyWidth(familyPoses.OH)>familyWidth(familyPoses.O)*1.25&&familyWidth(familyPoses.UH)>familyWidth(familyPoses.U)*1.4,'Lax rounded vowels keep visibly distinct widths');
  assert(familyPoses.A.singingSmileLift>5&&familyPoses.I.singingSmileLift>2.4&&familyPoses.E.singingSmileLift>4,'The default singing smile is materially stronger across open and spread vowels');
  for(const [phone,oldLift]of [['A',2.697245743390633],['I',1.6566702046224822],['E',2.255842535792821]])assert(familyPoses[phone].singingSmileLift>oldLift*1.8,'The '+phone+' corner lift improves on the previous saturated smile');
  assert(familyPoses.F.singingSmileLift>.7186260008879396*1.5,'F/V retains a stronger smile while making room for the rounded lip contact');
  assert(familyPoses.I.singingSmileLift>=2.8&&familyPoses.I.singingSmileLift<=3.2,'Spread I remains happy without lifting its corners into a wedge');
  for(const phone of ['I','AX','S','F','V']){const p=familyPoses[phone].points,height=p[9][1]-p[4][1],sideReach=p[0][1]-p[2][1];assert(sideReach>=height*.08,'The '+phone+' corner keeps a substantial shared rounding tangent');}
  for(const [phone,pose]of Object.entries(familyPoses)){
    near(neutralPoses[phone].singingSmileLift,0);near(pose.aperture,neutralPoses[phone].aperture);
    assert.equal(pose.teeth,0,'No phonetic family draws teeth');if(!['L','TH'].includes(phone))assert.equal(pose.tongue,0,'Tongue detail is absent on '+phone);
    if(['M','B','P'].includes(phone)){assert.equal(pose.aperture,0);continue}
    const y=(points,t)=>points[0][1]*(1-t)**3+3*points[1][1]*(1-t)**2*t+3*points[2][1]*(1-t)*t*t+points[3][1]*t**3,p=pose.points;
    let previous=Infinity;
    for(let step=0;step<=100;step++){
      const t=step/100,upper=y([p[0],p[2],p[3],p[4]],t),lower=y([p[0],p[11],p[10],p[9]],t);
      assert(upper<=previous+1e-7,'The smiling '+phone+' upper lip remains one convex arc without side humps');assert(lower>=upper-1e-7,'The '+phone+' contour never turns inside out');previous=upper;
    }
    near(p[2][0]-p[0][0],p[0][0]-p[11][0]);near(p[2][1]-p[0][1],p[0][1]-p[11][1]);
    near(p[1][0]-p[6][0],p[7][0]-p[1][0]);near(p[1][1]-p[6][1],p[7][1]-p[1][1]);
  }
  assert(familyPoses.O.singingSmileLift<familyPoses.A.singingSmileLift*.6&&familyPoses.U.singingSmileLift<familyPoses.A.singingSmileLift*.5,'Rounded vowels preserve their pucker within the happier smile');
  h.run('var longPlan=testArticulation.compile([{word:"Ooh",start:0,end:8000,index:0,timing:"word",explicitEnd:true,confidence:.95}],"en")');
  const held1=h.run('testArticulation.sample(longPlan,2000)'),held2=h.run('testArticulation.sample(longPlan,5000)');assert.equal(held1.long,true);near(held1.open,held2.open);near(held1.round,held2.round);
  h.run('var joinedPlan=testArticulation.compile([{word:"ah",start:0,end:400,index:0,timing:"word"},{word:"ooh",start:400,end:800,index:1,timing:"word"}],"en")');
  for(const time of [375,399,400,425])assert(h.run(`testArticulation.sample(joinedPlan,${time}).open`)>.1,'Adjacent vowels remain connected at the word boundary');
  h.run('var gapPlan=testArticulation.compile([{word:"ah",start:0,end:400,index:0,timing:"word"},{word:"ooh",start:430,end:800,index:1,timing:"word"}],"en")');
  assert.equal(h.run('testArticulation.sample(gapPlan,415).active'),false,'Even a short authoritative gap stays silent');
  h.run('var estimatedGap=testArticulation.compile([{word:"ah",start:0,end:400,index:0,timing:"estimated"},{word:"ooh",start:418,end:800,index:1,timing:"estimated"}],"en")');
  assert.equal(h.run('testArticulation.sample(estimatedGap,410).active'),true,'Tiny inferred separators do not mechanically close connected singing');
  h.run('var suppliedGap=testArticulation.compile([{word:"ah",start:0,end:800,index:0,timing:"word",phones:[{phone:"A",start:0,end:400},{phone:"U",start:430,end:800}]}],"en")');
  assert.equal(h.run('testArticulation.sample(suppliedGap,415).active'),false,'Explicit phone gaps are not smoothed away');
  h.run('var silencePlan=testArticulation.compile([{word:"pause",start:0,end:100,index:0,timing:"word",phones:[{phone:"REST",start:0,end:100}]}])');
  assert.equal(h.run('testArticulation.sample(silencePlan,50).active'),false);
  h.run('var mixedPlan=testArticulation.compile([...phonemeWords,{word:"hier",start:1100,end:2100,index:1,timing:"word",confidence:.95}],"de")');assert.equal(h.run('mixedPlan.phonemeTiming'),'mixed');assert.notEqual(h.run('mixedPlan.timing'),'phoneme');
  assert.equal(h.run('testArticulation.isPhone("not-a-phone")'),false);assert.equal(h.run('testArticulation.isPhone("ç")'),true);
  const phoneDocument={version:'1.0',metadata:{title:'Testaufnahme',artist:'SpotDeck',language:'de'},lines:[{text:'bin',start_ms:0,end_ms:1000,words:[{text:'bin',start_ms:0,end_ms:900,phones:[{phone:'B',start_ms:0,end_ms:100},{phone:'IH',start_ms:100,end_ms:800},{phone:'N',start_ms:800,end_ms:900}]}]}]};
  const parseDocument=doc=>{h.context.phoneDocument=JSON.stringify(doc);return h.run('parseLyricsfile(phoneDocument)')};
  const parsed=parseDocument(phoneDocument);assert.equal(parsed[0].language,'de');assert.equal(parsed[0].words[0].phones[0].phone,'B');assert.equal(parsed[0].words[0].phones[1].start,100);
  const cloneDocument=()=>JSON.parse(JSON.stringify(phoneDocument));
  const english=cloneDocument();english.lines[0].words[0].language='en';assert.equal(parseDocument(english)[0].words[0].language,'en');
  for(const mutate of [
    word=>{word.phones[0].phone='unknown-label'},word=>{word.phones[0].start_ms=-1},
    word=>{word.phones[0].end_ms=901},word=>{word.phones[1].start_ms=50},
    word=>{word.phones[0].start_ms=1.5},word=>{word.phones[0].end_ms=0},
    word=>{delete word.end_ms},word=>{word.phones=Array.from({length:513},()=>({phone:'A',start_ms:0,end_ms:1}))},
  ]){const invalid=cloneDocument();mutate(invalid.lines[0].words[0]);assert.throws(()=>parseDocument(invalid),'Invalid or unbounded phoneme cues are rejected');}

  for(const word of ['bin','hier','frei','Ooh','中文'])for(const duration of [0,.01,1,10,33,100,5000]){
    h.context.tinyToken={word,start:100,end:100+duration,index:0,timing:'word',confidence:.95};h.run('var tinyPlan=testArticulation.compile([tinyToken],"de")');
    for(const segment of Array.from(h.run('tinyPlan.segments')))assert(segment.start>=100-1e-7&&segment.end<=100+duration+1e-7&&segment.end>segment.start);
    for(const at of [99,100,100+duration/2,100+duration,101+duration]){const pose=h.run(`testArticulation.sample(tinyPlan,${at})`);finitePose(pose);h.context.checkPose=pose;const rendered=h.run('testRig.render(checkPose,{open:1,smile:20},{playing:true})');assert(!/NaN|Infinity/.test(rendered.path));assert(rendered.bounds.left>=0&&rendered.bounds.right<=100&&rendered.bounds.top>=0&&rendered.bounds.bottom<=50);}
  }
  h.run('var replayPose=testArticulation.sample(phonePlan,450)');assert.equal(h.run('testRig.render(replayPose,{}, {playing:true,now:1000,positionMs:450}).path'),h.run('testRig.render(replayPose,{}, {playing:true,now:9000,positionMs:450}).path'),'Replay does not depend on wall-clock mouth wobble');
  assert.equal(h.run('testRig.render({}, {}, {playing:false}).path'),'M 8 8 C 18 42 82 42 92 8 C 82 42 18 42 8 8 Z');

  // Exercise the real integration, including same-index lyric replacement and offsets.
  h.run('playback={is_playing:true,progress_ms:0,item:{id:"mouth-test",duration_ms:5000}};lastPollAt=performance.now();vibeNextExpression=Infinity;renderSyncedLyrics([{time:0,end:2000,text:"bin",language:"de",words:[{word:"bin",start:0,end:2000,phones:[{phone:"B",start:0,end:100},{phone:"IH",start:100,end:1900},{phone:"N",start:1900,end:2000}]}]}]);updateVibeVocalReaction(50)');
  assert.equal(h.run('vibeSpeech.phone'),'B');assert.equal(h.run('vibeSpeech.seal'),1);assert(h.nodes.get('vibeFace').classList.contains('singing'),'Closed-lip consonants are still part of active singing');
  h.run('updateVibeVocalReaction(600)');assert.equal(h.run('vibeSpeech.phone'),'IH');
  h.run('renderSyncedLyrics([{time:0,end:2000,text:"A",words:[{word:"A",start:0,end:2000,phones:[{phone:"A",start:0,end:2000}]}]}]);updateVibeVocalReaction(600)');assert.equal(h.run('vibeSpeech.phone'),'A','New lyrics at the same row index invalidate the compiled plan');
  h.run('playback.is_playing=false;updateVibeVocalReaction(600)');assert.equal(h.run('vibeSpeech.open'),0);assert.equal(h.run('vibeSpeech.active'),false);
  h.run('playback.is_playing=true;updateVibeVocalReaction(600)');assert.equal(h.run('vibeSpeech.phone'),'A');
  h.run('renderPlainLyrics("Static text");updateVibeVocalReaction(600)');assert.equal(h.run('vibeSpeech.open'),0);assert.equal(h.run('vibeSpeech.active'),false);
  assert.equal(h.run('vibeArticulationPlan?.segments?.length||0'),0,'Plain lyrics discard timed articulation');
  h.run('renderSyncedLyrics([{time:0,end:2000,text:"bin",words:[{word:"bin",start:0,end:2000,phones:[{phone:"B",start:0,end:100},{phone:"IH",start:100,end:1900},{phone:"N",start:1900,end:2000}]}]}]);facePreferences.lyricsOffset=300;updateVibeVocalReaction(50)');assert.equal(h.run('vibeSpeech.phone'),'B','Local-file offset does not shift Spotify');
  h.run('ownPlayback.active=true;updateVibeVocalReaction(50)');assert.equal(h.run('vibeSpeech.active'),false);h.run('updateVibeVocalReaction(350)');assert.equal(h.run('vibeSpeech.phone'),'B','Owned audio applies its lyric offset exactly once');h.run('ownPlayback.active=false');

  const big=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
  big.context.previousWords=Array.from({length:5000},(_,i)=>({word:'bin',start:i*.5,end:i*.5+.4}));
  big.run('playback={is_playing:true,progress_ms:6500,item:{id:"huge-context",duration_ms:20000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:5000,text:"previous",words:previousWords},{time:6000,end:7000,text:"A",words:[{word:"A",start:6000,end:7000,phones:[{phone:"A",start:6000,end:7000}]}]}]);updateVibeVocalReaction(6500)');
  assert.equal(big.run('vibeSpeech.phone'),'A','A huge previous row cannot exhaust the budget before the current row');assert(big.run('vibeArticulationPlan.segments.length')<100,'Only bounded neighbor context is compiled');
  const compiles=big.run('vibeArticulationCompiles');for(let i=0;i<30;i++)big.run(`updateVibeVocalReaction(${6500+i})`);assert.equal(big.run('vibeArticulationCompiles'),compiles,'Repeated animation frames sample the cached plan rather than recompiling pronunciation');

  for(const profile of ['quality','tv']){
    const frame=harness({preferences:{season:'off',surprises:false,performance:profile,tempoLookup:false}});let seals=0;
    frame.run('playback={is_playing:true,progress_ms:0,item:{id:"frame-mouth",duration_ms:5000}};lastPollAt=performance.now();renderSyncedLyrics([{time:0,end:2000,text:"bin",words:[{word:"bin",start:0,end:2000,phones:[{phone:"B",start:0,end:110},{phone:"IH",start:110,end:1900},{phone:"N",start:1900,end:2000}]}]}])');
    const mouth=frame.nodes.get('faceMouthPath'),set=mouth.setAttribute;mouth.setAttribute=function(name,value){if(name==='d'&&frame.run('vibeSpeech.phone')==='B'){seals++;assert.equal(frame.run('mouthRig.render(vibeSpeech,{open:1},{playing:true}).aperture'),0)}return set.call(this,name,value)};
    frame.step(250,1000/60);assert(seals>0,'A normal short closure is represented at '+profile+' cadence');assert.equal(frame.frames.size,1);
    assert(Number(mouth.style['stroke-width'])<9,'The articulated stroke overrides the resting CSS width');
  }
  assert(html.includes('<path id="faceMouthPath" d="M 8 8 C 18 42 82 42 92 8 C 82 42 18 42 8 8 Z"></path>'));
  console.log('PASS German/English phonetics, sustained vowels, coarticulation, authoritative gaps, timing quality, hard seals, tiny durations, deterministic rig, lifecycle and 30/60 Hz integration.');
})().catch(error=>{console.error(error);process.exitCode=1});
