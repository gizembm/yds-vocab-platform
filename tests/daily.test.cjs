const assert=require('node:assert/strict');
const {test}=require('node:test');
const {loadApplication}=require('./helpers/load-app.cjs');
const vm=require('node:vm');

function setup(count=150,initial){
  class Element{
    constructor(){this.children=[];this.dataset={};this.classes=new Set();this.hidden=false;}
    set innerHTML(value){this.children=[];this.html=value;}
    set className(value){this.classes=new Set(value.split(' '));}
    get classList(){return {add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:()=>{}};}
    append(...items){this.children.push(...items);}
    setAttribute(key,value){this[key]=value;}
    showModal(){this.open=true;}
    querySelectorAll(){return this.children.flatMap(c=>c.children).filter(c=>c.dataset.id);}
  }
  let now=Date.parse('2026-10-14T09:00:00Z'),saved=initial;
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const elements=new Map(),timers=new Map();let timer=0;
  const context=vm.createContext({Date:FakeDate,Intl,Math,
    document:{getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element()},
    localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem:(key,value)=>{saved=JSON.parse(value);}},
    setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)
  });
  const run=code=>vm.runInContext(code,context);
  loadApplication(context, () => {
    run("renderDecks=()=>renderDaily();");
    if(!initial){context.seed=Array.from({length:count},(_,i)=>({id:String(i),en:'word'+i,tr:'meaning'+i,box:1,due:0}));run('S.decks={Test:seed};');}
  });
  return {run,elements,saved:()=>saved,
    value:code=>JSON.parse(JSON.stringify(run(code))),
    day(n){now=Date.parse('2026-10-14T09:00:00Z')+n*864e5;run('refreshDailyDay()');},
    time(value){now=Date.parse(value);run('refreshDailyDay()');},
    flush(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());},
    begin:()=>run('beginDaily()'),
    learn(){run("startDailyStudy();while(S.program.session.pending.length)rateDaily('know');");}
  };
}
const session=g=>g.value('S.program.session');

function withSentences(g){g.run("allCards().forEach(c=>c.ex='We use '+c.en+' in this sentence.');");}
function sentenceAnswer(g,ok=true){
  const answer=g.run('playDaily?dailyCards().find(c=>c.id===S.program.session.sentence.pending[0]).en:quizList[0].card.en');
  const button=g.elements.get('quizChoices').children.find(b=>(b.textContent===answer)===ok);
  button.onclick();return button;
}

test('sentence prompts hide whole words and phrases without hiding substrings',()=>{
  const g=setup(0);
  assert.equal(g.run("sentencePrompt({en:'art',ex:'Art is part of art.'})"),'_____ is part of _____.');
  assert.equal(g.run("sentencePrompt({en:'take off',ex:'Please TAKE   OFF your shoes.'})"),'Please _____ your shoes.');
  assert.equal(g.run("sentencePrompt({en:'C++',ex:'We use C++ here.'})"),'We use _____ here.');
  assert.equal(g.run("sentencePrompt({en:'art',ex:'This is a party.'})"),null);
  assert.equal(g.run("sentencePrompt({en:'word',ex:''})"),null);
});

test('free sentence game has exactly four unique English options and stays in category',()=>{
  const g=setup(7);withSentences(g);
  g.run("S.decks.Other=S.decks.Test.splice(2);S.decks.Other.push({...S.decks.Other[0],id:'duplicate',en:S.decks.Test[0].en.toUpperCase()});startSentence('Test');");
  const options=g.elements.get('quizChoices').children.map(b=>b.textContent);
  assert.equal(options.length,4);assert.equal(new Set(options.map(s=>s.toLowerCase())).size,4);
  assert.ok(g.run('quizList.every(x=>S.decks.Test.includes(x.card))'));
  assert.ok(g.elements.get('quizWord').textContent.includes('_____'));
  const points=g.run('S.pts'),button=sentenceAnswer(g);button.onclick();
  assert.equal(g.run('S.pts'),points+5);
  assert.ok(g.elements.get('quizChoices').children.every(b=>b.disabled));
  g.run('showHome()');g.flush();assert.equal(g.run('quizTimer'),null);
});

test('missing examples and fewer than four words give useful sentence-game messages',()=>{
  const g=setup(3);g.run("startSentence('Test')");
  assert.equal(g.elements.get('quizChoices').children.length,0);
  assert.match(g.elements.get('quizFeedback').textContent,/örnek cümle/);
  withSentences(g);g.run("startSentence('Test')");
  assert.equal(g.elements.get('quizChoices').children.length,0);
  assert.match(g.elements.get('quizFeedback').textContent,/4 farklı/);
});

test('daily sentence game migrates old saves, excludes missing examples, and resumes progress',()=>{
  const g=setup(25);withSentences(g);g.run("S.decks.Test[0].ex='';");g.begin();
  g.run("startDailyGame('sentence')");assert.equal(g.run('playDaily'),false);
  g.learn();g.run("delete S.program.session.sentence;save();");
  const restored=setup(0,g.saved());restored.run("startDailyGame('sentence')");
  assert.equal(session(restored).sentence.pending.length,19);
  assert.ok(!session(restored).sentence.pending.includes('0'));
  assert.ok(session(restored).sentence.pending.every(id=>Number(id)<20));
  sentenceAnswer(restored);restored.flush();
  const again=setup(0,restored.saved());again.run("startDailyGame('sentence')");
  assert.equal(session(again).sentence.done.length,1);
  while(session(again).sentence.pending.length){sentenceAnswer(again);again.flush();}
  assert.equal(session(again).sentence.done.length,19);
  assert.match(again.elements.get('playHint').textContent,/Tur tamamlandı/);
  assert.equal(session(again).pending.length,0);
});

test('daily sentence mistakes repeat after two questions and return to card study',()=>{
  const g=setup(6);withSentences(g);g.begin();g.learn();g.run("startDailyGame('sentence')");
  const id=session(g).sentence.pending[0];sentenceAnswer(g,false);g.flush();
  assert.equal(session(g).sentence.pending[2],id);assert.ok(session(g).pending.includes(id));
  sentenceAnswer(g);g.flush();sentenceAnswer(g);g.flush();
  assert.equal(session(g).sentence.pending[0],id);sentenceAnswer(g);g.flush();
  assert.ok(session(g).pending.includes(id));
  assert.equal(g.run('S.program.cards['+JSON.stringify(id)+'].learned'),false);
  g.run('restartDailyGame()');assert.equal(session(g).sentence.done.length,0);
  assert.equal(session(g).sentence.pending.length,6);
  sentenceAnswer(g);g.day(1);const before=session(g);g.flush();
  assert.deepEqual(session(g),before);assert.equal(g.run('playDaily'),false);
});

test('six cumulative 20-word days and seventh-day review follow the starting date',()=>{
  const g=setup();g.begin();
  for(let day=0;day<7;day++){
    g.day(day);assert.equal(session(g).ids.length,Math.min(day+1,6)*20);
    assert.equal(session(g).newIds.length,day===6?0:20);
    assert.equal(new Set(session(g).ids).size,session(g).ids.length);
  }
});
test('missed days do not allocate words or shift the cycle',()=>{
  const g=setup();g.begin();g.day(2);
  assert.equal(session(g).ids.length,40);g.day(6);
  assert.equal(session(g).ids.length,40);assert.equal(session(g).newIds.length,0);
});
test('reload preserves daily quota, ordering and current card',()=>{
  const g=setup();g.begin();g.run("rateDaily('miss');moveCard(1);");
  const before=session(g),restored=setup(0,g.saved());
  assert.deepEqual(session(restored),before);restored.run('startDailyStudy()');
  assert.equal(restored.run('queue[studyIndex].id'),before.current);
});
test('a failed card returns after two other cards, until explicitly learned',()=>{
  const g=setup(4);g.begin();g.run("rateDaily('miss')");
  assert.deepEqual(session(g).pending,['1','2','0','3']);
  g.run("rateDaily('know');rateDaily('know');");assert.equal(session(g).current,'0');
  g.run("rateDaily('hard')");assert.deepEqual(session(g).pending,['3','0']);
  g.learn();assert.equal(session(g).pending.length,0);
});
test('same-cycle learned cards return next day without advancing review stage',()=>{
  const g=setup(30);g.begin();g.learn();g.day(1);
  assert.equal(session(g).pending.length,30);g.learn();
  assert.equal(g.run("S.program.cards['0'].stage"),0);
});
test('old unknown words carry forward and learned words advance through spaced intervals',()=>{
  const g=setup(2);g.begin();g.run("rateDaily('know')");g.day(7);
  assert.deepEqual(session(g).pending,['0','1']);g.learn();
  assert.equal(g.run("S.program.cards['0'].stage"),1);
  assert.equal(g.run("S.program.cards['0'].due"),'2026-10-24');
  g.day(8);assert.deepEqual(session(g).ids,['1']);g.learn();
  g.day(10);assert.ok(session(g).ids.includes('0'));g.learn();
  assert.equal(g.run("S.program.cards['0'].stage"),2);
  g.day(17);g.learn();assert.equal(g.run("S.program.cards['0'].stage"),3);
  g.day(31);g.learn();assert.equal(g.run("S.program.cards['0'].stage"),4);
  g.day(61);g.learn();assert.equal(g.run("S.program.cards['0'].stage"),4);
});
test('a forgotten scheduled word resets to the one-day interval',()=>{
  const g=setup(1);g.begin();g.learn();g.day(7);g.run("startDailyStudy();rateDaily('hard')");
  assert.equal(g.run("S.program.cards['0'].learned"),false);g.learn();
  assert.equal(g.run("S.program.cards['0'].stage"),0);
  assert.equal(g.run("S.program.cards['0'].due"),'2026-10-22');
});
test('Istanbul midnight rolls over active study and allocates only one next-day batch',()=>{
  const g=setup();g.time('2026-10-14T20:59:59Z');g.begin();
  assert.equal(session(g).date,'2026-10-14');g.time('2026-10-14T21:00:00Z');
  assert.equal(session(g).date,'2026-10-15');assert.equal(g.run('studyDaily'),false);
  g.run('renderDaily();ensureDaily();');assert.equal(session(g).ids.length,40);
});
test('imports wait until next day and deleted cards are removed from all progress',()=>{
  const g=setup(2);g.begin();g.run("addRows([['Other','fresh','yeni']])");
  assert.equal(session(g).ids.length,2);g.day(1);assert.equal(session(g).ids.length,3);
  g.learn();g.run("startDailyGame('quiz');delete S.decks.Test;renderDaily();");
  assert.equal(session(g).ids.length,1);assert.equal(Object.keys(g.value('S.program.cards')).length,1);
  assert.equal(session(g).quiz.pending.length,1);
});
test('empty program cannot start; exhausted lists remain valid',()=>{
  const empty=setup(0);empty.begin();assert.equal(empty.run('S.program'),undefined);
  const g=setup(1);g.begin();g.learn();g.day(1);assert.equal(session(g).newIds.length,0);
  assert.equal(g.elements.get('programStart').hidden,true);
});
test('migration preserves old scores, boxes and history without assigning known status',()=>{
  const g=setup(2);g.run('S.pts=123;S.decks.Test[0].box=5;S.decks.Test[0].quizCorrect=9;');g.begin();
  assert.equal(g.run('S.pts'),123);assert.equal(g.run('S.decks.Test[0].box'),5);
  assert.equal(g.run('S.decks.Test[0].quizCorrect'),9);assert.equal(g.run("S.program.cards['0'].learned"),false);
});
function quizAnswer(g,ok=true){
  const en=g.elements.get('quizWord').textContent;
  const tr=g.run('allCards()').find(c=>c.en===en).tr;
  const button=g.elements.get('quizChoices').children.find(b=>(b.textContent===tr)===ok);
  button.onclick();g.flush();return en;
}
test('daily quiz is gated, uses only daily words, and completes with persisted progress',()=>{
  const g=setup(50);g.begin();g.run("startDailyGame('quiz')");assert.equal(g.run('playDaily'),false);
  g.learn();g.run("startDailyGame('quiz')");
  for(let i=0;i<5;i++)quizAnswer(g);
  const restored=setup(0,g.saved());restored.run("startDailyGame('quiz')");
  assert.equal(session(restored).quiz.pending.length,15);
  for(let i=0;i<15;i++){
    assert.ok(Number(restored.elements.get('quizWord').textContent.slice(4))<20);
    assert.ok(restored.elements.get('quizChoices').children.every(b=>Number(b.textContent.slice(7))<20));quizAnswer(restored);
  }
  assert.equal(session(restored).quiz.pending.length,0);assert.equal(session(restored).quiz.done.length,20);
});
test('quiz mistakes persist in card work even after a later correct answer',()=>{
  const g=setup(4);g.begin();g.learn();g.run("startDailyGame('quiz')");
  const wrong=quizAnswer(g,false),id=g.run('allCards()').find(c=>c.en===wrong).id;
  assert.ok(session(g).pending.includes(id));
  assert.notEqual(quizAnswer(g),wrong);assert.notEqual(quizAnswer(g),wrong);
  assert.equal(g.elements.get('quizWord').textContent,wrong);quizAnswer(g);
  assert.ok(session(g).pending.includes(id));assert.equal(g.run(`S.program.cards['${id}'].learned`),false);
  const restored=setup(0,g.saved());restored.learn();assert.equal(session(restored).pending.length,0);
});
function matchPair(g,wrong=false){
  const tiles=g.elements.get('matchBoard').querySelectorAll(),en=tiles.find(b=>b.dataset.type==='en');
  const tr=tiles.find(b=>b.dataset.type==='tr'&&((b.dataset.id===en.dataset.id)!==wrong));
  en.onclick();tr.onclick();g.flush();return en.dataset.id;
}
test('daily matching finishes all words, including final single word, without pulling future cards',()=>{
  const g=setup(25);g.begin();g.learn();g.run("startDailyGame('match')");
  for(let i=0;i<20;i++){
    assert.ok(g.elements.get('matchBoard').querySelectorAll().every(b=>Number(b.dataset.id)<20));matchPair(g);
  }
  assert.equal(session(g).match.pending.length,0);assert.equal(session(g).match.done.length,20);
  assert.equal(g.elements.get('matchBoard').children.length,0);
});
test('matching errors return both cards to study and keep them in the game',()=>{
  const g=setup(3);g.begin();g.learn();g.run("startDailyGame('match')");matchPair(g,true);
  assert.equal(session(g).pending.length,2);assert.equal(session(g).match.pending.length,3);
  for(let i=0;i<3;i++)matchPair(g);
  assert.equal(session(g).match.pending.length,0);assert.equal(session(g).pending.length,2);
});
test('small game pools are safely gated and equivalent meanings remain matchable',()=>{
  const g=setup(2);g.run("S.decks.Test.forEach(c=>c.tr='same')");g.begin();g.learn();
  g.run("startDailyGame('quiz')");assert.equal(g.run('playDaily'),false);
  g.run("startDailyGame('match')");matchPair(g,true);matchPair(g);
  assert.equal(session(g).match.pending.length,0);
  const one=setup(1);one.begin();one.learn();one.run("startDailyGame('match')");assert.equal(one.run('playDaily'),false);
});
test('midnight cancels pending game feedback and starts a clean daily session',()=>{
  const g=setup(30);g.begin();g.learn();g.run("startDailyGame('quiz')");
  g.elements.get('quizChoices').children[0].onclick();g.day(1);const before=session(g);g.flush();
  assert.deepEqual(session(g),before);assert.equal(g.run('quizTimer'),null);assert.equal(g.run('playDaily'),false);
});
test('free study and games do not change program learning or quota',()=>{
  const g=setup(4);g.begin();const before=session(g);
  g.run("showHome();startStudy('Test');$('rate').onclick({target:{dataset:{q:'know'}}});startQuiz('Test');");
  quizAnswer(g);assert.deepEqual(session(g),before);
  assert.ok(g.value('Object.values(S.program.cards).every(c=>!c.learned)'));
});
test('matching progress resumes after reload and restarts cancel pending feedback',()=>{
  const g=setup(7);g.begin();g.learn();g.run("startDailyGame('match')");matchPair(g);
  const restored=setup(0,g.saved());restored.run("startDailyGame('match')");
  assert.equal(session(restored).match.pending.length,6);
  const tiles=restored.elements.get('matchBoard').querySelectorAll(),en=tiles[0];
  en.onclick();tiles.find(b=>b.dataset.type==='tr'&&b.dataset.id===en.dataset.id).onclick();
  restored.run('restartDailyGame()');restored.flush();
  assert.equal(session(restored).match.pending.length,7);
  assert.equal(session(restored).match.done.length,0);
});
