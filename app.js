const KEY='flashcards_v1', DAY=864e5, INTERVAL=[0,0,1,3,7,14]; // Leitner kutuları 1..5 (gün)
const $=id=>document.getElementById(id);
let S=JSON.parse(localStorage.getItem(KEY)||'null')||{decks:{},pts:0,streak:0,last:'',today:0,cur:null};
let scope=null, forceAll=false, queue=[], flipped=false;
let playScope=null, playMode='', matchPick=[], matchDone=0, quizList=[], quizIndex=0, quizLocked=false;
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));
const dstr=t=>new Date(t).toISOString().slice(0,10);
const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
const allCards=()=>Object.values(S.decks).flat();
const cardsOf=name=>name?S.decks[name]||[]:allCards();
const cardCat=card=>Object.keys(S.decks).find(k=>S.decks[k].includes(card))||'';

// ---------- İçe aktarma ----------
function addRows(rows){
  let n=0;
  rows.forEach(r=>{
    const [cat,en,tr,ex,exTr,mn]=r.map(x=>(x||'').trim());
    if(!en||!tr)return;
    const d=cat||'Genel'; S.decks[d]=S.decks[d]||[];
    if(S.decks[d].some(c=>c.en.toLowerCase()===en.toLowerCase()))return;
    S.decks[d].push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),en,tr,ex:ex||'',exTr:exTr||'',mn:mn||'',box:1,due:0});n++;
  });
  save();renderDecks();alert(n+' yeni kart eklendi.');
}
function parseFile(file){
  const rd=new FileReader();
  rd.onload=()=>{
    const text=String(rd.result).replace(/^\uFEFF/,'');
    let rows;
    if(file.name.toLowerCase().endsWith('.xml')){
      const doc=new DOMParser().parseFromString(text,'application/xml');
      if(doc.querySelector('parsererror'))return alert('XML okunamadı.');
      rows=[...doc.documentElement.children].map(el=>[...el.children].map(c=>c.textContent));
    }else{
      rows=Papa.parse(text,{skipEmptyLines:true}).data;
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
  if(i>0)queue.unshift(queue.splice(i,1)[0]);
}
function startStudy(name){
  scope=name;forceAll=false;$('home').hidden=true;$('study').hidden=false;showCard();
}
function showCard(){
  buildQueue();
  const c=queue[0];
  $('empty').hidden=!!c;$('game').hidden=!c;
  $('info').textContent=(scope||'Tüm kategoriler')+' · '+queue.length+' kart sırada';
  if(!c){S.cur=null;save();return;}
  S.cur=c.id;save();
  flipped=false;$('card').classList.remove('flip');$('rate').hidden=true;
  $('cat').textContent=Object.keys(S.decks).find(k=>S.decks[k].includes(c))||'';
  $('en').textContent=c.en;$('tr').textContent=c.tr;$('ex').textContent=c.ex;$('exTr').textContent=c.exTr;
  $('mn').textContent=c.mn?'💡 '+c.mn:'';
}
$('card').onclick=()=>{flipped=!flipped;$('card').classList.toggle('flip',flipped);if(flipped)$('rate').hidden=false;};
$('rate').onclick=e=>{
  const q=e.target.dataset.q;if(!q)return;
  const c=queue[0];
  if(q==='know'){c.box=Math.min(5,c.box+1);S.pts+=10;c.due=Date.now()+INTERVAL[c.box]*DAY;}
  else if(q==='hard'){S.pts+=3;c.due=Date.now()+Math.max(1,INTERVAL[c.box])*DAY/ (c.box>1?2:1);}
  else{c.box=1;c.due=Date.now()+60*1000;} // 1 dk sonra tekrar
  const t=dstr(Date.now());
  if(S.last!==t){S.streak=S.last===dstr(Date.now()-DAY)?S.streak+1:1;S.last=t;S.today=0;}
  S.today++;renderStats();
  const i=queue.length>1?1:0; S.cur=queue[i]&&queue[i].id!==c.id?queue[i].id:null;
  save();showCard();
};
$('all').onclick=()=>{forceAll=true;showCard();};
$('back').onclick=()=>{$('study').hidden=true;$('home').hidden=false;renderDecks();};

// ---------- Oyunlar ----------
function showHome(){
  $('study').hidden=true;$('play').hidden=true;$('home').hidden=false;renderDecks();
}
function showPlay(mode,name){
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
  const cards=shuffle(cardsOf(playScope)).slice(0,6);
  const board=$('matchBoard');board.innerHTML='';matchPick=[];matchDone=0;
  if(cards.length<2){board.innerHTML='<p class="hint">Eşleştirme için en az 2 kelime gerekir.</p>';return;}
  const tiles=shuffle(cards.flatMap(c=>[
    {id:c.id,type:'en',text:c.en},
    {id:c.id,type:'tr',text:c.tr}
  ]));
  tiles.forEach(t=>{
    const b=document.createElement('button');
    b.className='match-card';b.textContent=t.text;b.dataset.id=t.id;b.dataset.type=t.type;
    b.onclick=()=>pickMatch(b);
    board.append(b);
  });
}
function pickMatch(btn){
  if(btn.classList.contains('done')||matchPick.includes(btn)||matchPick.length===2)return;
  btn.classList.add('active');matchPick.push(btn);
  if(matchPick.length<2)return;
  const [a,b]=matchPick, ok=a.dataset.id===b.dataset.id&&a.dataset.type!==b.dataset.type;
  if(ok){
    a.classList.remove('active');b.classList.remove('active');a.classList.add('done');b.classList.add('done');
    matchDone++;S.pts+=4;save();renderStats();matchPick=[];
    if(matchDone*2===$('matchBoard').children.length)$('playHint').textContent='Harika, bütün eşleşmeler tamamlandı.';
  }else{
    a.classList.add('bad');b.classList.add('bad');
    setTimeout(()=>{a.classList.remove('active','bad');b.classList.remove('active','bad');matchPick=[];},600);
  }
}
function startQuiz(name){
  showPlay('quiz',name);
  $('playTitle').textContent='Soru-Cevap';
  $('playHint').textContent='Kelimenin doğru Türkçe karşılığını seç.';
  quizList=shuffle(cardsOf(name));quizIndex=0;showQuiz();
}
function showQuiz(){
  const c=quizList[quizIndex], choices=$('quizChoices');
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
  if(ok){S.pts+=5;$('quizFeedback').textContent='Doğru! '+c.en+' = '+c.tr;$('quizFeedback').classList.add('good');}
  else{$('quizFeedback').textContent='Doğru cevap: '+c.tr;$('quizFeedback').classList.add('bad');}
  [...$('quizChoices').children].forEach(x=>{if(x.textContent===c.tr)x.classList.add('good');});
  save();renderStats();
  setTimeout(()=>{quizIndex=(quizIndex+1)%quizList.length;showQuiz();},1000);
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
