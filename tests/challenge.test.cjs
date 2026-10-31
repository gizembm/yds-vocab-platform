const assert=require('node:assert/strict');
const {test}=require('node:test');
const {loadApplication}=require('./helpers/load-app.cjs');
const vm=require('node:vm');

// Same minimal DOM as daily.test.cjs.
function setup(count=150,initial){
  class Element{
    constructor(){this.children=[];this.dataset={};this.classes=new Set();this.hidden=false;}
    set innerHTML(value){this.children=[];this.html=value;}
    set className(value){this.classes=new Set(value.split(' '));}
    get classList(){return {add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:()=>{}};}
    append(...items){this.children.push(...items);}
    setAttribute(key,value){this[key]=value;}
    querySelectorAll(){return [];}
  }
  let now=Date.parse('2026-10-14T09:00:00Z'),saved=initial;
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const elements=new Map();
  const context=vm.createContext({Date:FakeDate,Intl,Math,
    document:{getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element()},
    localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem:(key,value)=>{saved=JSON.parse(value);}},
    setTimeout:()=>0,clearTimeout:()=>{}
  });
  const run=code=>vm.runInContext(code,context);
  loadApplication(context, () => {
    run("renderDecks=()=>renderDaily();");
    if(!initial){context.seed=Array.from({length:count},(_,i)=>({id:String(i),en:'word'+i,tr:'meaning'+i,box:1,due:0}));run('S.decks={Test:seed};');}
  });
  return {run,elements,saved:()=>saved,
    value:code=>JSON.parse(JSON.stringify(run(code))),
    day(n){now=Date.parse('2026-10-14T09:00:00Z')+n*864e5;run('refreshDailyDay()');},
    begin:()=>run('beginDaily()'),
    learn(){run("startDailyStudy();while(program().session.pending.length)rateDaily('know');");}
  };
}
const session=g=>g.value('S.program.session');
const manualChallenge="S.decks.YDS=S.decks.Test.splice(0,15);S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),cards:{},session:null}};";

test('a challenge program opens 10 new words a day from its own deck only',()=>{
  const g=setup(30);g.run(manualChallenge+"Vocab.session.daily.deck='YDS';");
  const s=g.value('ensureDaily()');
  assert.equal(s.newIds.length,10);
  assert.ok(s.ids.every(id=>Number(id)<15));
  assert.deepEqual(g.value('limits(program())'),{newPerDay:10,maxReviews:30,maxDayCards:40});
});

test('the main program skips decks that have a challenge',()=>{
  const g=setup(30);g.run(manualChallenge);g.begin();
  assert.equal(session(g).newIds.length,15);
  assert.ok(session(g).ids.every(id=>Number(id)>=15));
});

test('the 7th challenge day opens no new words',()=>{
  const g=setup(0);
  g.run("S.decks.YDS=Array.from({length:100},(_,i)=>({id:'y'+i,en:'w'+i,tr:'m'+i,box:1,due:0}));S.challenges={YDS:{version:1,deck:'YDS',start:programDate(),dayIndex:6,cards:{},session:null}};Vocab.session.daily.deck='YDS';");
  assert.equal(g.value('ensureDaily()').newIds.length,0);
});

test('returning home shows the main program again',()=>{
  const g=setup(30);g.run(manualChallenge);g.begin();
  g.run("openChallenge('YDS');showHome();");
  assert.equal(g.run('Vocab.session.daily.deck'),null);
  const chips=g.elements.get('programSummary').children.map(c=>c.textContent);
  assert.ok(chips.includes('15 yeni'));
});

test('saves without challenges still run the main program',()=>{
  const g=setup(30);g.run('delete S.challenges');g.begin();
  assert.equal(session(g).newIds.length,20);
});

test('a day change while in a challenge returns home and advances it',()=>{
  const g=setup(30);g.run(manualChallenge+"openChallenge('YDS');");
  assert.equal(g.run('studyDaily'),true);
  g.day(1);
  assert.equal(g.run('studyDaily'),false);
  assert.equal(g.run('S.challenges.YDS.session.date'),'2026-10-15');
});

test('starting a challenge moves the deck out of today\'s main session and keeps progress',()=>{
  const g=setup(30);g.begin();g.learn();
  g.run('showHome();S.decks.YDS=S.decks.Test.splice(0,15);');
  const before=g.value("S.program.cards['0']");
  assert.equal(g.run("startChallenge('YDS')"),true);
  assert.deepEqual(g.value("S.challenges.YDS.cards['0']"),before);
  assert.equal(g.run("S.program.cards['0']"),undefined);
  assert.ok(session(g).ids.every(id=>Number(id)>=15));
  assert.equal(g.value('program().session').newIds.length,0,'learned words are not new again');
});

test('words opened in the main program but not learned yet are new in the challenge',()=>{
  const g=setup(30);g.begin();
  g.run("S.decks.YDS=S.decks.Test.splice(0,15);startChallenge('YDS');");
  const s=g.value('program().session');
  assert.equal(s.newIds.length,10);
  assert.equal(s.ids.length,10);
});

test('leaving a challenge returns progress to the main program',()=>{
  const g=setup(20);g.run("S.decks.YDS=S.decks.Test.splice(0,10);startChallenge('YDS');");g.learn();
  g.run("leaveChallenge('YDS')");
  assert.equal(g.run('S.challenges.YDS'),undefined);
  assert.equal(g.run('Vocab.session.daily.deck'),null);
  assert.equal(g.run("S.program.cards['0'].learned"),true);
});

test('empty decks and running challenges cannot be started',()=>{
  const g=setup(5);g.run('S.decks.Empty=[]');
  assert.equal(g.run("startChallenge('Empty')"),false);
  assert.equal(g.run("startChallenge('Test')"),true);
  assert.equal(g.run("startChallenge('Test')"),false);
});

test('words added to a challenge deck later become new words',()=>{
  const g=setup(10);g.run("startChallenge('Test')");g.learn();
  g.run("S.decks.Test.push({id:'late',en:'late',tr:'geç',box:1,due:0})");g.day(1);g.run("openChallenge('Test')");
  assert.ok(g.value('program().session').newIds.includes('late'));
});

test('a challenge is complete when every word reached the last step',()=>{
  const g=setup(3);g.run("startChallenge('Test')");
  assert.equal(g.run("isComplete('Test')"),false);
  g.run('Object.values(S.challenges.Test.cards).forEach(s=>{s.learned=true;s.stage=REVIEW_DAYS.length-1;})');
  assert.equal(g.run("isComplete('Test')"),true);
});

test('a free study mistake demotes the word inside its challenge',()=>{
  const g=setup(3);g.run("startChallenge('Test');Object.values(S.challenges.Test.cards).forEach(s=>{s.learned=true;s.stage=2;});showHome();");
  g.run("registerMistake('0')");
  assert.equal(g.run("S.challenges.Test.cards['0'].stage"),1);
});

test('a reload during a challenge reopens the same challenge',()=>{
  const g=setup(3);g.run("startChallenge('Test')");
  assert.deepEqual(g.value('S.lastView'),{type:'dailyStudy',program:'Test'});
  const restored=setup(0,g.saved());
  assert.equal(restored.run('Vocab.session.daily.deck'),'Test');
  assert.equal(restored.run('studyDaily'),true);
});

test('deleting a category deletes its challenge',()=>{
  const g=setup(3);g.run("startChallenge('Test');Vocab.decks.removeDeck('Test')");
  assert.equal(g.run('S.challenges.Test'),undefined);
  assert.equal(g.run('Vocab.session.daily.deck'),null);
});

test('mastery counts words from every program',()=>{
  const g=setup(20);g.run("S.decks.YDS=S.decks.Test.splice(0,10);startChallenge('YDS');");g.learn();
  assert.equal(g.value('Vocab.progress.counts()').learning,10);
});
