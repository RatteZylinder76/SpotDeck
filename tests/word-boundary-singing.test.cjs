// Synthetic timing fixtures only; no recording, account, network or song transcript.
const assert=require('node:assert/strict');
const {harness}=require('./spotdeck.test.cjs');

const h=harness({preferences:{season:'off',surprises:false,tempoLookup:false}});
const sourceWords=[
  {text:'we',start_ms:100,end_ms:300},
  {text:'good',start_ms:350,end_ms:1750},
  {text:'home',start_ms:2650,end_ms:2850},
];
function parse(words){
  h.context.boundaryDocument=JSON.stringify({version:'1.0',metadata:{title:'Synthetic boundary example',artist:'SpotDeck',language:'en'},lines:[{text:'we good home',start_ms:100,end_ms:2850,words}]});
  return h.run('parseLyricsfile(boundaryDocument)');
}
const exact=parse(sourceWords);
const starts=parse(sourceWords.map(({end_ms,...word})=>word));
const mixed=parse(sourceWords.map((word,index)=>index===1?{text:word.text,start_ms:word.start_ms}:word));
assert(starts[0].words.every(word=>word.end===null),'The parser preserves missing source ends rather than inventing precise data');
h.context.boundaryExact=exact;h.context.boundaryStarts=starts;h.context.boundaryMixed=mixed;
h.run('var boundaryEngine=new ArticulationEngine();var boundaryRig=new MouthRig();var boundaryTrajectory=new MouthTrajectory(boundaryRig);var exactTokens=boundaryEngine.buildWords(boundaryExact[0],4000,"en");var startTokens=boundaryEngine.buildWords(boundaryStarts[0],4000,"en");var exactPlan=boundaryEngine.compile(exactTokens,"en");var startPlan=boundaryEngine.compile(startTokens,"en");var exactAnimation=boundaryTrajectory.compile(exactPlan);var startAnimation=boundaryTrajectory.compile(startPlan)');
assert.deepEqual(JSON.parse(h.run('JSON.stringify(exactTokens.map(word=>[word.start,word.end,word.explicitEnd]))')),[[100,300,true],[350,1750,true],[2650,2850,true]]);
assert.deepEqual(JSON.parse(h.run('JSON.stringify(startTokens.map(word=>[word.start,word.end,word.explicitEnd]))')),[[100,350,false],[350,2650,false],[2650,2850,false]]);
assert.equal(h.run('exactPlan.timing'),'word');assert.equal(h.run('exactPlan.phonemeTiming'),'inferred');
assert(h.run('exactPlan.confidence')<1,'Word boundaries do not establish measured phoneme timing');
assert(h.run('exactPlan.segments.every(segment=>segment.wordEndTiming==="provided"&&segment.phonemeTiming==="inferred")'));
assert(h.run('startPlan.segments.every(segment=>segment.wordEndTiming==="inferred")'));
assert(h.run('exactPlan.segments.every(segment=>{const word=exactTokens[segment.wordIndex];return segment.start>=word.start&&segment.end<=word.end})'),'No inferred phone may escape an explicit word boundary');

// A held word extends its vowel; it must not draw out every consonant as well.
assert(h.run('exactPlan.segments.filter(segment=>segment.wordIndex===1&&!segment.vowel).every(segment=>segment.end-segment.start<=95+1e-7)'));
assert(h.run('exactPlan.segments.some(segment=>segment.wordIndex===1&&segment.vowel&&segment.end-segment.start>1200)'));
assert.equal(h.run('exactPlan.segments.filter(segment=>segment.wordIndex===1).at(-1).end'),1750);
for(const at of [310,325,340,1780,2000,2300,2620]){
  assert.equal(h.run(`boundaryEngine.sample(exactPlan,${at}).active`),false,`Authoritative silence at ${at} ms is not bridged`);
  const pose=h.run(`boundaryTrajectory.sample(exactAnimation,${at},{},{playing:true})`);
  assert.equal(pose.aperture,0,'Recovery can smile, but a true pause never keeps an open singing mouth');
}
assert.equal(h.run('boundaryEngine.sample(startPlan,2000).active'),true,'Start-only data cannot reveal the omitted 900 ms pause');

// The UI must report SOURCE metadata, not the ends the planner had to infer.
for(const [rows,expected]of [
  [exact,'Wortanfänge und -enden vorhanden; Lautzeiten geschätzt.'],
  [starts,'Wortanfänge vorhanden; fehlende Wortenden und Lautzeiten geschätzt.'],
  [mixed,'Wortanfänge vorhanden; fehlende Wortenden und Lautzeiten geschätzt.'],
  [[...exact,{time:4000,end:4400,text:'alone'}],'Teilweise Wortzeitmarken vorhanden; fehlende Wort- und Lautzeiten geschätzt.'],
]){
  h.context.boundaryRows=rows;h.run('syncedLyrics=boundaryRows');
  assert.equal(h.run('lyricsTimingLabel()'),expected);
}
assert(starts[0].words.every(word=>word.end===null),'Compilation does not mutate source provenance');

// A proven provider typo used Cyrillic е inside otherwise Latin words.
// Correct pronunciation only; preserve the displayed spelling and other scripts.
h.run('var confusableTokens=boundaryEngine.buildWords({time:0,end:2000,text:"gеfunden",words:[{word:"gеfunden",start:0,end:2000}]},2000,"de");var confusablePlan=boundaryEngine.compile(confusableTokens,"de")');
assert.equal(h.run('confusableTokens[0].word'),'gеfunden');
assert.equal(h.run('boundaryEngine.normalize("tеst")'),'test');
assert.equal(h.run('JSON.stringify(boundaryEngine.pronounce("gеfunden","de").phones)'),h.run('JSON.stringify(boundaryEngine.pronounce("gefunden","de").phones)'));
assert(h.run('confusablePlan.segments.some(segment=>segment.vowel&&segment.end-segment.start>500)'));
assert(h.run('confusablePlan.segments.filter(segment=>!segment.vowel).every(segment=>segment.end-segment.start<=95+1e-7)'));
for(const text of ['тест','не','中文','tеѕt','aе']){
  h.context.unhandledScript=text;
  assert.equal(h.run('boundaryEngine.pronounce(unhandledScript,"de").source'),'fallback',`${text} remains an unsupported-script fallback`);
}
console.log('PASS exact source word ends, inferred start-only ends, held vowels, true pauses, truthful timing labels and bounded pronunciation lookalike repair.');
