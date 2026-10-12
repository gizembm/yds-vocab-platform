const KEY='flashcards_v1', DAY=864e5, INTERVAL=[0,0,1,3,7,14]; // Leitner kutuları 1..5 (gün)
const $=id=>document.getElementById(id);
let S=JSON.parse(localStorage.getItem(KEY)||'null')||{decks:{},pts:0,streak:0,last:'',today:0,cur:null};
let scope=null, forceAll=false, queue=[], flipped=false, studyIndex=0;
let playScope=null, playMode='', matchPick=[], matchCards=[], matchTimer=null, matchSeen=new Map(), quizList=[], quizStep=0, quizTimer=null, quizLocked=false;
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
const dstr=t=>new Date(t).toISOString().slice(0,10);
const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
const allCards=()=>Object.values(S.decks).flat();
const cardsOf=name=>name?S.decks[name]||[]:allCards();
const cardCat=card=>Object.keys(S.decks).find(k=>S.decks[k].includes(card))||'';

// ---------- İçe aktarma ----------
function addRows(rows){
  let n=0,duplicate=0,invalid=0;
  const repeated=new Map();
  rows.forEach(r=>{
    const [cat,en,tr,ex,exTr,mn]=r.map(x=>(x||'').trim());
    if(!en||!tr){invalid++;return;}
    const d=cat||'Genel'; S.decks[d]=S.decks[d]||[];
    if(S.decks[d].some(c=>c.en.toLowerCase()===en.toLowerCase())){
      duplicate++;
      const key=JSON.stringify([d,en.toLowerCase()]);
      const entry=repeated.get(key)||{en,category:d,count:0};
      entry.count++;repeated.set(key,entry);return;
    }
    S.decks[d].push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),en,tr,ex:ex||'',exTr:exTr||'',mn:mn||'',box:1,due:0});n++;
  });
  save();renderDecks();
  showImportResult(n,duplicate,invalid,[...repeated.values()]);
}
function showImportResult(added,duplicate,invalid,repeated){
  $('importTitle').textContent=added?'Kelimeler eklendi':'Yeni kelime eklenmedi';
  $('importSummary').textContent=added?'Kelime listen güncellendi. İyi çalışmalar!':'Yüklenen satırların sonucunu aşağıda görebilirsin.';
  $('importAdded').textContent=added;$('importDuplicate').textContent=duplicate;$('importInvalid').textContent=invalid;
  $('importInvalidNote').hidden=!invalid;
  $('importRepeated').hidden=!duplicate;
  const uniqueWords=new Set(repeated.map(entry=>entry.en.toLowerCase())).size;
  $('importRepeatedTitle').textContent='Tekrarlı İngilizce kelimeler ('+uniqueWords+')';
  const list=$('importRepeatedList');list.innerHTML='';
  repeated.forEach(entry=>{
    const item=document.createElement('li');
    const word=document.createElement('b');word.textContent=entry.en;word.lang='en';
    const category=document.createElement('span');category.className='mut';category.textContent=entry.category;
    const count=document.createElement('span');count.className='repeat-count';count.textContent=entry.count+' satır';
    item.append(word,category,count);list.append(item);
  });
  const dialog=$('importResult');if(!dialog.open)dialog.showModal();
}
function parseFile(file){
  const rd=new FileReader();
  rd.onload=()=>{
    const text=String(rd.result).replace(/^\uFEFF/,'');
    if(text.startsWith('PK\u0003\u0004'))return alert('Bu dosya CSV değil, sıkıştırılmış bir dosya (Excel olabilir). Excel’den CSV UTF-8 biçiminde kaydet.');
    let rows;
    if(file.name.toLowerCase().endsWith('.xml')){
      const doc=new DOMParser().parseFromString(text,'application/xml');
      if(doc.querySelector('parsererror'))return alert('XML okunamadı.');
      rows=[...doc.documentElement.children].map(el=>[...el.children].map(c=>c.textContent));
    }else{
      const parsed=Papa.parse(text,{skipEmptyLines:'greedy'});
      if(parsed.errors.some(e=>e.type==='Quotes'))return alert('CSV tırnakları hatalı. Dosyayı CSV UTF-8 biçiminde yeniden kaydet.');
      rows=parsed.data.map(row=>{
        if(row.length!==1)return row;
        // Some exports quote an entire CSV record as one cell.
        const nested=Papa.parse(row[0],{delimiter:',',skipEmptyLines:'greedy'});
        return !nested.errors.length&&nested.data.length===1&&nested.data[0].length===6?nested.data[0]:row;
      });
    }
    if(rows.length&&/kategori|categor/i.test(rows[0][0]||''))rows.shift(); // başlık satırı
    addRows(rows);
  };
  rd.readAsText(file,'UTF-8');
}
$('file').onchange=e=>{if(e.target.files[0])parseFile(e.target.files[0]);e.target.value='';};
$('addDeck').onclick=()=>{const n=$('newDeck').value.trim();if(!n)return;S.decks[n]=S.decks[n]||[];$('newDeck').value='';save();renderDecks();};

// ---------- Kategori listesi ----------
function renderStats(){
  const t=dstr(Date.now()); if(S.last!==t&&S.today){S.today=0;}
  $('streak').textContent=S.streak;$('pts').textContent=S.pts;$('today').textContent=S.today;
}
function renderDecks(){
  renderStats();
  const box=$('decks');box.innerHTML='';
  const names=Object.keys(S.decks);
  if(!names.length){box.innerHTML='<p class="hint">Henüz kategori yok. Bir dosya yükle veya kategori ekle.</p>';return;}
  const mk=(name,cards,all)=>{
    const due=cards.filter(c=>c.due<=Date.now()).length;
    const el=document.createElement('div');el.className='deck';
    el.innerHTML='<div><b></b><small>'+cards.length+' kart · '+due+' tekrar bekliyor</small></div><div></div>';
    el.querySelector('b').textContent=name;
    const go=document.createElement('button');go.textContent='Çalış';go.onclick=()=>startStudy(all?null:name);
    el.lastChild.append(go);
    const match=document.createElement('button');match.className='play';match.textContent='Eşleştir';match.onclick=()=>startMatch(all?null:name);
    el.lastChild.append(match);
    const quiz=document.createElement('button');quiz.className='play';quiz.textContent='Soru-Cevap';quiz.onclick=()=>startQuiz(all?null:name);
    el.lastChild.append(quiz);
    if(!all){const del=document.createElement('button');del.className='del';del.textContent='Sil';
      del.onclick=()=>{if(confirm('"'+name+'" kategorisi silinsin mi?')){delete S.decks[name];save();renderDecks();}};el.lastChild.append(del);}
    box.append(el);
  };
  if(names.length>1)mk('Tüm kategoriler',names.flatMap(n=>S.decks[n]),true);
  names.forEach(n=>mk(n,S.decks[n]));
}

// ---------- Çalışma ----------
const pool=()=>cardsOf(scope);
function buildQueue(){
  const now=Date.now();
  queue=pool().filter(c=>forceAll||c.due<=now).sort((a,b)=>a.box-b.box||a.due-b.due);
  const i=queue.findIndex(c=>c.id===S.cur); // kaldığın karttan devam
  studyIndex=i>=0?i:0;
}
function startStudy(name){
  scope=name;forceAll=false;$('home').hidden=true;$('study').hidden=false;showCard();
}
function showCard(){
  buildQueue();
  const c=queue[studyIndex];
  $('empty').hidden=!!c;$('game').hidden=!c;
  $('info').textContent=(scope||'Tüm kategoriler')+' · '+queue.length+' kart sırada';
  $('cardPosition').textContent=c?(studyIndex+1)+' / '+queue.length:'';
  $('prevCard').disabled=!c||studyIndex===0;
  $('nextCard').disabled=!c||studyIndex===queue.length-1;
  if(!c){S.cur=null;save();return;}
  S.cur=c.id;save();
  flipped=false;$('card').classList.remove('flip');$('rate').hidden=true;
  $('cat').textContent=Object.keys(S.decks).find(k=>S.decks[k].includes(c))||'';
  $('en').textContent=c.en;$('tr').textContent=c.tr;$('ex').textContent=c.ex;$('exTr').textContent=c.exTr;
  $('mn').textContent=c.mn?'💡 '+c.mn:'';
}
$('card').onclick=()=>{flipped=!flipped;$('card').classList.toggle('flip',flipped);if(flipped)$('rate').hidden=false;};
function moveCard(step){
  const next=studyIndex+step;
  if(next<0||next>=queue.length)return;
  S.cur=queue[next].id;showCard();
}
$('prevCard').onclick=()=>moveCard(-1);
$('nextCard').onclick=()=>moveCard(1);
$('rate').onclick=e=>{
  const q=e.target.dataset.q;if(!q)return;
  const c=queue[studyIndex];if(!c)return;
  if(q==='know'){c.box=Math.min(5,c.box+1);S.pts+=10;c.due=Date.now()+INTERVAL[c.box]*DAY;}
  else if(q==='hard'){S.pts+=3;c.due=Date.now()+Math.max(1,INTERVAL[c.box])*DAY/ (c.box>1?2:1);}
  else{c.box=1;c.due=Date.now()+60*1000;} // 1 dk sonra tekrar
  const t=dstr(Date.now());
  if(S.last!==t){S.streak=S.last===dstr(Date.now()-DAY)?S.streak+1:1;S.last=t;S.today=0;}
  S.today++;renderStats();
  const next=queue[(studyIndex+1)%queue.length];S.cur=next&&next.id!==c.id?next.id:null;
  save();showCard();
};
$('all').onclick=()=>{forceAll=true;showCard();};
$('back').onclick=()=>{$('study').hidden=true;$('home').hidden=false;renderDecks();};

// ---------- Oyunlar ----------
function showHome(){
  clearTimeout(quizTimer);quizTimer=null;
  clearTimeout(matchTimer);matchTimer=null;matchPick=[];
  $('study').hidden=true;$('play').hidden=true;$('home').hidden=false;renderDecks();
}
function showPlay(mode,name){
  clearTimeout(quizTimer);quizTimer=null;
  clearTimeout(matchTimer);matchTimer=null;matchPick=[];
  playMode=mode;playScope=name;$('home').hidden=true;$('study').hidden=true;$('play').hidden=false;
  $('playInfo').textContent=(name||'Tüm kategoriler')+' · '+cardsOf(name).length+' kart';
  $('matchBoard').hidden=mode!=='match';$('quizBox').hidden=mode!=='quiz';
}
function startMatch(name){
  showPlay('match',name);
  $('playTitle').textContent='Eşleştirme';
  $('playHint').textContent='İngilizce kelimeyi Türkçe karşılığıyla eşleştir.';
  buildMatch();
}
function buildMatch(){
  clearTimeout(matchTimer);matchTimer=null;
  const board=$('matchBoard');board.innerHTML='';matchPick=[];matchCards=[];matchSeen=new Map();
  const pool=cardsOf(playScope);
  if(pool.length<2){board.innerHTML='<p class="hint">Eşleştirme için en az 2 kelime gerekir.</p>';return;}
  while(matchCards.length<Math.min(6,pool.length)){
    const card=chooseMatchCard(pool.filter(c=>!matchCards.includes(c)));
    matchCards.push(card);
  }
  ['en','tr'].forEach(type=>{
    const column=document.createElement('div');column.className='match-column';
    const heading=document.createElement('h3');heading.textContent=type==='en'?'İngilizce':'Türkçe';column.append(heading);
    const cards=type==='en'?matchCards:shuffle(matchCards);
    cards.forEach(card=>{
      const b=document.createElement('button');b.type='button';b.dataset.type=type;
      b.lang=type;b.onclick=()=>pickMatch(b);setMatchTile(b,card);column.append(b);
    });
    board.append(column);
  });
}
function chooseMatchCard(cards){
  // Weighted sampling favors difficult words; exposure counts keep the rest in rotation.
  const weights=cards.map(c=>(1+3*Math.min(8,c.matchDifficulty||0))/(1+(matchSeen.get(c.id)||0)));
  let ticket=Math.random()*weights.reduce((sum,w)=>sum+w,0);
  const card=cards.find((c,i)=>(ticket-=weights[i])<0)||cards[cards.length-1];
  matchSeen.set(card.id,(matchSeen.get(card.id)||0)+1);
  return card;
}
function setMatchTile(btn,card){
  btn.className='match-card';btn.textContent=card[btn.dataset.type];btn.dataset.id=card.id;
  btn.setAttribute('aria-pressed','false');
}
function pickMatch(btn){
  if(matchTimer!==null||matchPick.includes(btn))return;
  if(matchPick.length&&matchPick[0].dataset.type===btn.dataset.type){
    matchPick[0].classList.remove('active');matchPick[0].setAttribute('aria-pressed','false');matchPick=[];
  }
  btn.classList.add('active');btn.setAttribute('aria-pressed','true');matchPick.push(btn);
  if(matchPick.length<2)return;
  const [a,b]=matchPick, card=matchCards.find(c=>c.id===a.dataset.id);
  const ok=a.dataset.id===b.dataset.id||
    (a.dataset.type==='en'?b.textContent===card.tr:a.textContent===matchCards.find(c=>c.id===b.dataset.id).tr);
  if(ok){
    a.classList.remove('active');b.classList.remove('active');a.classList.add('done');b.classList.add('done');
    card.matchDifficulty=Math.max(0,(card.matchDifficulty||0)-1);
    S.pts+=4;save();renderStats();
    matchTimer=setTimeout(()=>{
      // Equivalent translations may belong to different cards; replace their actual partners.
      const oldIds=new Set([a.dataset.id,b.dataset.id]);
      oldIds.forEach(id=>{
        const tiles=[...$('matchBoard').querySelectorAll('.match-card')].filter(tile=>tile.dataset.id===id);
        const candidates=cardsOf(playScope).filter(c=>!matchCards.includes(c));
        const next=candidates.length?chooseMatchCard(candidates):matchCards.find(c=>c.id===id);
        matchCards[matchCards.findIndex(c=>c.id===id)]=next;
        tiles.forEach(tile=>setMatchTile(tile,next));
      });
      matchPick=[];matchTimer=null;
    },450);
  }else{
    [a,b].forEach(tile=>{
      const wrong=matchCards.find(c=>c.id===tile.dataset.id);
      wrong.matchDifficulty=Math.min(8,(wrong.matchDifficulty||0)+2);
    });
    save();
    a.classList.add('bad');b.classList.add('bad');
    matchTimer=setTimeout(()=>{
      [a,b].forEach(tile=>{tile.classList.remove('active','bad');tile.setAttribute('aria-pressed','false');});
      matchPick=[];matchTimer=null;
    },600);
  }
}
function startQuiz(name){
  showPlay('quiz',name);
  $('playTitle').textContent='Soru-Cevap';
  $('playHint').textContent='Kelimenin doğru Türkçe karşılığını seç.';
  const cards=shuffle(cardsOf(name)).sort((a,b)=>quizPriority(b)-quizPriority(a));
  quizList=cards.map((card,i)=>({card,due:i}));quizStep=0;showQuiz();
}
function quizPriority(card){
  const difficulty=Math.max(card.quizDifficulty||0,card.matchDifficulty||0);
  const unknown=!(card.quizCorrect>0)&&!(card.box>1);
  return difficulty*10+(unknown?5:0)+Math.max(0,5-(card.box||1));
}
function showQuiz(){
  const c=quizList[0]?.card, choices=$('quizChoices');
  choices.innerHTML='';$('quizFeedback').textContent='';$('quizFeedback').className='feedback';quizLocked=false;
  if(!c){$('quizWord').textContent='';$('quizExample').textContent='';$('quizCat').textContent='';choices.innerHTML='<p class="hint">Soru-cevap için kelime eklemen yeterli.</p>';return;}
  $('quizCat').textContent=cardCat(c);$('quizWord').textContent=c.en;$('quizExample').textContent=c.ex||'';
  const wrong=shuffle(cardsOf(playScope).filter(x=>x.id!==c.id&&x.tr!==c.tr)).slice(0,3).map(x=>x.tr);
  const opts=shuffle([c.tr,...wrong]);
  opts.forEach(opt=>{
    const b=document.createElement('button');b.textContent=opt;
    b.onclick=()=>answerQuiz(b,opt===c.tr,c);
    choices.append(b);
  });
  if(opts.length<2)$('quizFeedback').textContent='Daha güçlü seçenekler için aynı kategoriye birkaç kelime daha ekle.';
}
function answerQuiz(btn,ok,c){
  if(quizLocked)return;quizLocked=true;
  btn.classList.add(ok?'good':'bad');
  if(ok){
    c.quizCorrect=(c.quizCorrect||0)+1;c.quizDifficulty=Math.max(0,(c.quizDifficulty||0)-1);
    S.pts+=5;$('quizFeedback').textContent='Doğru! '+c.en+' = '+c.tr;$('quizFeedback').classList.add('good');
  }else{
    c.quizDifficulty=Math.min(8,(c.quizDifficulty||0)+2);
    $('quizFeedback').textContent='Doğru cevap: '+c.tr;$('quizFeedback').classList.add('bad');
  }
  [...$('quizChoices').children].forEach(x=>{if(x.textContent===c.tr)x.classList.add('good');});
  save();renderStats();
  quizTimer=setTimeout(()=>{
    const current=quizList.shift();quizStep=Math.max(quizStep,current.due);
    // Repeat mistakes after two intervening questions, expanding the gap as recall improves.
    const gap=!ok?3:c.quizDifficulty>0?6:c.quizCorrect===1?Math.max(8,quizList.length*2):Math.max(16,quizList.length*3);
    current.due=quizStep+gap;quizList.push(current);quizStep++;
    quizList.sort((a,b)=>a.due-b.due||quizPriority(b.card)-quizPriority(a.card));
    quizTimer=null;showQuiz();
  },1000);
}
$('playBack').onclick=showHome;
$('gameAgain').onclick=()=>playMode==='match'?buildMatch():startQuiz(playScope);

// ---------- Telaffuz ----------
function speak(t){
  if(!t||!('speechSynthesis' in window))return alert('Tarayıcın sesli okumayı desteklemiyor.');
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=.9;speechSynthesis.speak(u);
}
$('spkW').onclick=e=>{e.stopPropagation();speak($('en').textContent);};
$('spkS').onclick=e=>{e.stopPropagation();speak($('ex').textContent);};

renderDecks();
if(S.cur){const n=Object.keys(S.decks).find(k=>S.decks[k].some(c=>c.id===S.cur));if(n)startStudy(n);} // son kaldığın karttan devam
