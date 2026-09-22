(()=>{
 const section=document.getElementById('photographers');
 const rail=section.querySelector('.cheese-photographer-grid');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const isDirectory=new URLSearchParams(location.search).get('trang')==='tho';
 const move=direction=>{const card=[...rail.children].find(c=>!c.classList.contains('hidden'));if(!card)return;rail.scrollBy({left:direction*(card.getBoundingClientRect().width+20),behavior:reduced?'auto':'smooth'});};
 rail.addEventListener('keydown',event=>{if(event.target!==rail)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
 section.classList.remove('grid-view');
 // Native touch swipe, plus mouse dragging without accidental profile navigation.
 let dragging=false, moved=false, startX=0, startScroll=0, pointerId=null;
 rail.addEventListener('pointerdown',event=>{
   if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button'))return;
   dragging=true;moved=false;startX=event.clientX;startScroll=rail.scrollLeft;pointerId=event.pointerId;
 });
 rail.addEventListener('pointermove',event=>{
   if(!dragging||event.pointerId!==pointerId)return;
   const delta=event.clientX-startX;
   if(!moved&&Math.abs(delta)>7){moved=true;rail.classList.add('is-dragging');rail.setPointerCapture(event.pointerId);}
   if(moved){event.preventDefault();rail.scrollLeft=startScroll-delta;}
 });
 const release=()=>{dragging=false;rail.classList.remove('is-dragging');};
 window.addEventListener('pointerup',release);
 rail.addEventListener('pointercancel',()=>{release();moved=false;});
 rail.addEventListener('lostpointercapture',release);
 rail.addEventListener('dragstart',event=>event.preventDefault());
 rail.addEventListener('click',event=>{if(moved){event.preventDefault();event.stopImmediatePropagation();moved=false;}},true);
 if(isDirectory)document.title='Tất cả thợ ảnh | Cheese.Graduation';
 document.querySelectorAll('.nav-wrap nav a,.mobile-drawer a,.nav-cta,.hero-main-btn').forEach(link=>{if(link.getAttribute('href')==='#photographers'||link.getAttribute('href')===location.pathname+'#photographers'){link.href=location.pathname+'?trang=tho';if(link.closest('nav'))link.textContent='Chọn thợ';}});
 if(isDirectory){document.querySelectorAll('.nav-wrap a,.mobile-drawer a').forEach(link=>{const href=link.getAttribute('href');if(href&&href.startsWith('#'))link.href=location.pathname+href;});}
 const slug=new URLSearchParams(location.search).get('tho');
 const cards=[...rail.querySelectorAll('.profile-link')];
 const i=cards.findIndex(link=>new URL(link.href).searchParams.get('tho')===slug);
 if(i>=0){const neighbours=document.createElement('nav');neighbours.className='profile-neighbours';neighbours.setAttribute('aria-label','Chuyển hồ sơ thợ');const before=cards[(i-1+cards.length)%cards.length],after=cards[(i+1)%cards.length];for(const [link,prefix] of [[before,'← '],[after,'Tiếp theo: ']]){const a=document.createElement('a');a.href=link.href;a.textContent=prefix+link.closest('article').querySelector('h3').textContent;neighbours.append(a);}document.querySelector('.profile-shell')?.append(neighbours);}
})();
