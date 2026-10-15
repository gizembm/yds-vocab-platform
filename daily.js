// Daily scheduling is independent of the free-study Leitner boxes.
const REVIEW_DAYS=[1,3,7,14,30];
const programDate=(time=Date.now())=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'
}).format(time);
const dateNumber=date=>Date.parse(date+'T00:00:00Z')/DAY;
const plusDays=(date,days)=>new Date((dateNumber(date)+days)*DAY).toISOString().slice(0,10);
const cycleOf=date=>Math.floor((dateNumber(date)-dateNumber(S.program.start))/7);
const dailyCards=()=>{
  const ids=new Set(S.program.session.ids);
  return allCards().filter(c=>ids.has(c.id));
};

function ensureDaily(){
  const p=S.program;if(!p)return null;
  const date=programDate(), cycle=cycleOf(date), live=new Set(allCards().map(c=>c.id));
  Object.keys(p.cards).forEach(id=>{if(!live.has(id))delete p.cards[id];});
  if(!p.session||p.session.date!==date){
    const fresh=(dateNumber(date)-dateNumber(p.start))%7!==6
      ?allCards().filter(c=>!p.cards[c.id]).slice(0,20):[];
    fresh.forEach(c=>{p.cards[c.id]={cycle,assigned:date,learned:false,stage:0,due:null};});
    const ids=allCards().filter(c=>{
      const state=p.cards[c.id];
      return state&&(state.cycle===cycle||!state.learned||state.due<=date);
    }).map(c=>c.id);
    p.session={date,ids,newIds:fresh.map(c=>c.id),pending:[...ids],done:[],current:ids[0]||null,
      quiz:{pending:null,done:[]},match:{pending:null,done:[]}};
  }
  const s=p.session;
  for(const key of ['ids','newIds','pending','done'])s[key]=s[key].filter(id=>live.has(id));
  for(const game of [s.quiz,s.match]){
    if(game.pending)game.pending=game.pending.filter(id=>live.has(id));
    game.done=game.done.filter(id=>live.has(id));
  }
  save();return s;
}

function beginDaily(){
  if(!allCards().length)return;
  if(!S.program)S.program={version:1,start:programDate(),cards:{},session:null};
  ensureDaily();renderDaily();startDailyStudy();
}
function dailyQueue(){
  const s=ensureDaily(), byId=new Map(allCards().map(c=>[c.id,c]));
  return s.pending.map(id=>byId.get(id)).filter(Boolean);
}
function startDailyStudy(){
  if(!S.program)return;
  ensureDaily();clearTimeout(quizTimer);quizTimer=null;clearTimeout(matchTimer);matchTimer=null;
  studyDaily=true;playDaily=false;scope=null;
  $('home').hidden=true;$('play').hidden=true;$('study').hidden=false;showCard();
}
function recordDailyActivity(points){
  const date=programDate();
  if(S.last!==date){S.streak=S.last===plusDays(date,-1)?S.streak+1:1;S.last=date;S.today=0;}
  S.today++;S.pts+=points;renderStats();
}
function rateDaily(q){
  if(!['know','hard','miss'].includes(q))return;
  if(refreshDailyDay())return;
  const s=ensureDaily(), id=s.current, state=S.program.cards[id];
  if(!state||!s.pending.includes(id))return;
  s.pending=s.pending.filter(x=>x!==id);
  if(q==='know'){
    const scheduled=state.learned&&state.cycle<cycleOf(s.date)&&state.due<=s.date;
    if(scheduled)state.stage=Math.min(REVIEW_DAYS.length-1,state.stage+1);
    if(!state.learned)state.stage=0;
    state.learned=true;state.due=plusDays(s.date,REVIEW_DAYS[state.stage]);
    s.done.push(id);recordDailyActivity(10);
  }else{
    state.learned=false;state.stage=0;state.due=null;
    s.pending.splice(Math.min(2,s.pending.length),0,id);
    recordDailyActivity(q==='hard'?3:0);
  }
  s.current=s.pending[0]||null;save();showCard();renderDaily();
}
function dailyMistake(id){
  const s=S.program.session,state=S.program.cards[id];
  state.learned=false;state.stage=0;state.due=null;
  s.done=s.done.filter(x=>x!==id);
  if(!s.pending.includes(id))s.pending.push(id);
  if(!s.current)s.current=id;
}

function renderDailyActions(target){
  const box=$(target),s=S.program.session;box.innerHTML='';
  if(!s.ids.length){box.textContent='Açılan kelime yok. Yeni kelime yükleyebilir veya sonraki çalışma gününü bekleyebilirsin.';return;}
  if(s.pending.length){box.textContent=s.pending.length+' kelime için kart çalışması gerekiyor.';return;}
  for(const [mode,label] of [['quiz','Test'],['match','Eşleştirme']]){
    const button=document.createElement('button');
    button.textContent=label+(s[mode].pending?.length===0?' ✓':'');
    button.onclick=()=>startDailyGame(mode);
    button.disabled=mode==='match'?s.ids.length<2:new Set(dailyCards().map(c=>c.tr)).size<2;
    box.append(button);
  }
  const note=document.createElement('p');note.className='hint';
  note.textContent='Test için iki farklı anlam, eşleştirme için en az iki kelime gerekir.';box.append(note);
}
function renderDaily(){
  const s=ensureDaily();
  $('programStart').hidden=!!s;$('programStart').disabled=!allCards().length;
  $('programStudy').hidden=!s;
  if(!s){$('programSummary').textContent='6 gün 20 yeni kelime, 7. gün genel tekrar. Başladığın gün döngünün ilk günüdür.';$('programActions').innerHTML='';return;}
  const day=(dateNumber(s.date)-dateNumber(S.program.start))%7+1;
  $('programSummary').textContent=(cycleOf(s.date)+1)+'. döngü · '+day+'. gün'+(day===7?' · Genel tekrar':'')+
    ' · '+s.newIds.length+' yeni · '+s.ids.length+' toplam · '+s.done.length+' tamamlanan · '+s.pending.length+' kalan';
  $('programStudy').textContent=s.pending.length?'Günlük çalışmaya devam et':'Günlük kartlar tamamlandı';
  renderDailyActions('programActions');
}

function startDailyGame(mode){
  if(refreshDailyDay())return;
  const s=ensureDaily();
  if(s.pending.length||!s.ids.length)return;
  if(mode==='match'&&s.ids.length<2||mode==='quiz'&&new Set(dailyCards().map(c=>c.tr)).size<2)return;
  showPlay(mode,null);playDaily=true;studyDaily=false;
  const game=s[mode];if(game.pending===null)game.pending=shuffle([...s.ids]);
  save();$('gameAgain').textContent='Turu yeniden başlat';
  $('playTitle').textContent=mode==='quiz'?'Günlük test':'Günlük eşleştirme';
  if(mode==='quiz')dailyShowQuiz();else dailyBuildMatch();
}
function dailyGameStatus(){
  const s=S.program.session,game=s[playMode];
  $('playInfo').textContent='Günlük çalışma · '+game.done.length+' / '+s.ids.length+' tamamlandı';
  $('playHint').textContent=game.pending.length
    ?'Bugün çalıştığın kelimeler. Yanlışlar kart çalışmasına da geri döner.'
    :'Tur tamamlandı!'+(s.pending.length?' Yanlış yaptığın kelimeleri kartlarda yeniden çalış.':' Diğer oyuna ana ekrandan geçebilirsin.');
}
function restartDailyGame(){
  if(refreshDailyDay())return;
  clearTimeout(quizTimer);quizTimer=null;clearTimeout(matchTimer);matchTimer=null;
  const s=S.program.session;
  s[playMode]={pending:shuffle([...s.ids]),done:[]};save();
  if(playMode==='quiz')dailyShowQuiz();else dailyBuildMatch();
}
function dailyShowQuiz(){
  dailyGameStatus();const s=S.program.session,game=s.quiz;
  const c=dailyCards().find(c=>c.id===game.pending[0]),choices=$('quizChoices');
  choices.innerHTML='';quizLocked=false;$('quizFeedback').textContent='';$('quizFeedback').className='feedback';
  $('quizWord').textContent=c?c.en:'';$('quizExample').textContent=c?c.ex||'':'';$('quizCat').textContent=c?cardCat(c):'';
  if(!c)return;
  const wrong=shuffle([...new Set(dailyCards().map(x=>x.tr))].filter(tr=>tr!==c.tr)).slice(0,3);
  shuffle([c.tr,...wrong]).forEach(opt=>{
    const button=document.createElement('button');button.textContent=opt;
    button.onclick=()=>dailyAnswerQuiz(button,opt===c.tr,c);choices.append(button);
  });
}
function dailyAnswerQuiz(button,ok,c){
  if(refreshDailyDay()||quizLocked)return;quizLocked=true;
  const game=S.program.session.quiz,id=game.pending.shift();
  if(ok){game.done.push(id);c.quizCorrect=(c.quizCorrect||0)+1;c.quizDifficulty=Math.max(0,(c.quizDifficulty||0)-1);S.pts+=5;}
  else{game.pending.splice(Math.min(2,game.pending.length),0,id);dailyMistake(id);c.quizDifficulty=Math.min(8,(c.quizDifficulty||0)+2);}
  button.classList.add(ok?'good':'bad');
  $('quizFeedback').textContent=ok?'Doğru!':'Doğru cevap: '+c.tr;
  [...$('quizChoices').children].forEach(b=>{if(b.textContent===c.tr)b.classList.add('good');});
  save();renderStats();quizTimer=setTimeout(()=>{quizTimer=null;if(!refreshDailyDay())dailyShowQuiz();},1000);
}
function dailyBuildMatch(){
  clearTimeout(matchTimer);matchTimer=null;matchPick=[];dailyGameStatus();
  const board=$('matchBoard');board.innerHTML='';
  const game=S.program.session.match,cards=dailyCards();
  matchCards=game.pending.slice(0,6).map(id=>cards.find(c=>c.id===id)).filter(Boolean);
  if(!matchCards.length)return;
  // A final single word remains playable inside a deck that started with >=2 cards.
  ['en','tr'].forEach(type=>{
    const column=document.createElement('div');column.className='match-column';
    const heading=document.createElement('h3');heading.textContent=type==='en'?'İngilizce':'Türkçe';column.append(heading);
    (type==='en'?matchCards:shuffle(matchCards)).forEach(c=>{
      const button=document.createElement('button');button.type='button';button.dataset.type=type;button.lang=type;
      setMatchTile(button,c);button.onclick=()=>dailyPickMatch(button);column.append(button);
    });board.append(column);
  });
}
function dailyPickMatch(button){
  if(refreshDailyDay()||matchTimer!==null||matchPick.includes(button))return;
  if(matchPick.length&&matchPick[0].dataset.type===button.dataset.type){matchPick[0].classList.remove('active');matchPick[0].setAttribute('aria-pressed','false');matchPick=[];}
  button.classList.add('active');button.setAttribute('aria-pressed','true');matchPick.push(button);
  if(matchPick.length<2)return;
  const en=matchPick.find(b=>b.dataset.type==='en'),tr=matchPick.find(b=>b.dataset.type==='tr');
  const card=matchCards.find(c=>c.id===en.dataset.id),ok=card.tr===tr.textContent;
  const game=S.program.session.match;
  if(ok){
    // Equivalent translations can be swapped, but only the answered English word is credited.
    game.pending=game.pending.filter(id=>id!==card.id);game.done.push(card.id);
    card.matchDifficulty=Math.max(0,(card.matchDifficulty||0)-1);S.pts+=4;
  }else{
    new Set(matchPick.map(b=>b.dataset.id)).forEach(id=>{
      dailyMistake(id);const c=matchCards.find(c=>c.id===id);c.matchDifficulty=Math.min(8,(c.matchDifficulty||0)+2);
    });
    const ids=matchPick.map(b=>b.dataset.id);
    game.pending=[...game.pending.filter(id=>!ids.includes(id)),...ids];
  }
  matchPick.forEach(b=>b.classList.add(ok?'done':'bad'));save();renderStats();
  matchTimer=setTimeout(()=>{matchTimer=null;if(!refreshDailyDay())dailyBuildMatch();},ok?450:600);
}

let visibleProgramDate=programDate();
function refreshDailyDay(){
  const date=programDate();if(date===visibleProgramDate)return false;
  visibleProgramDate=date;
  if(!S.program)return false;
  ensureDaily();
  if(studyDaily||playDaily){studyDaily=false;playDaily=false;showHome();}
  else renderDaily();
  return true;
}
$('programStart').onclick=beginDaily;
$('programStudy').onclick=startDailyStudy;
$('dailyReturn').onclick=showHome;
renderDaily();
if(typeof window!=='undefined'){
  window.addEventListener('focus',refreshDailyDay);
  document.addEventListener('visibilitychange',refreshDailyDay);
  setInterval(refreshDailyDay,1000);
}
