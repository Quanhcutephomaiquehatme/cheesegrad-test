(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const cfg=window.CHEESE_CONFIG||{};
  const configured=/^https:\/\/.+\.supabase\.co$/i.test(String(cfg.supabaseUrl||'').trim()) &&
    !String(cfg.supabaseAnonKey||'').includes('PASTE_') && String(cfg.supabaseAnonKey||'').length>20 && window.supabase;
  const db=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  const BUCKET='site-media';
  let items=[];
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const status=msg=>{const el=$('#heroUploadStatus');if(el)el.innerHTML=msg;};
  const fmt=bytes=>bytes>1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.round(bytes/1024)} KB`;

  async function optimize(file){
    if(!file?.type?.startsWith('image/'))throw new Error('File không phải ảnh.');
    if(file.size>50*1024*1024)throw new Error('Ảnh lớn hơn 50 MB.');
    let bitmap;
    try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_){
      bitmap=await new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Không đọc được ảnh.'))};img.src=u;});
    }
    const w=bitmap.width||bitmap.naturalWidth,h=bitmap.height||bitmap.naturalHeight,max=2600,scale=Math.min(1,max/Math.max(w,h));
    const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
    const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,cw,ch);
    if(bitmap.close)bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
    if(!blob)throw new Error('Không tối ưu được ảnh.');
    const base=(file.name||'hero').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-')||'hero';
    return new File([blob],`${base}.webp`,{type:'image/webp',lastModified:Date.now()});
  }
  async function requireAuth(){
    if(!db)throw new Error('Supabase chưa được cấu hình trong config.js.');
    const {data:{session}}=await db.auth.getSession();
    if(!session)throw new Error('Hãy đăng nhập Admin trước.');
    return session;
  }
  async function load(){
    if(!$('#heroAdminGrid'))return;
    if(!db){items=(window.CHEESE_HERO_LOCAL_IMAGES||[]).map((image_url,i)=>({id:`local-${i}`,image_url,alt_text:'Ảnh tốt nghiệp Cheese.Graduation',sort_order:(i+1)*10,active:true,local:true}));render();status('Supabase chưa cấu hình. Đang hiển thị danh sách ảnh mặc định trong bộ web; cần nối Supabase để thêm/xóa ảnh từ Admin.');return;}
    const {data,error}=await db.from('site_hero_images').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if(error){
      items=[];render();
      status(`Không tải được bảng ảnh: <b>${esc(error.message)}</b>. Nếu đây là lần đầu dùng, chạy file <b>SUPABASE-PATCH-HERO-IMAGES.sql</b>.`);
      return;
    }
    items=data||[];render();status('Ảnh lớn sẽ tự tối ưu trước khi upload. Bạn có thể chọn nhiều ảnh cùng lúc.');
  }
  function render(){
    const box=$('#heroAdminGrid'),empty=$('#heroAdminEmpty'),count=$('#heroImageCount');if(!box)return;
    if(count)count.textContent=`${items.length} ảnh`;
    empty.hidden=!!items.length;
    box.innerHTML=items.map((x,i)=>`<article class="hero-admin-card" data-id="${esc(x.id)}">
      <div class="hero-admin-image" style="background-image:url('${esc(x.image_url)}')">${x.active===false?'<span class="hero-hidden-badge">Đang ẩn</span>':''}</div>
      <div class="hero-admin-body">
        <label><span>Mô tả</span><input data-field="alt_text" type="text" value="${esc(x.alt_text||'Ảnh tốt nghiệp Cheese.Graduation')}"></label>
        <label><span>Thứ tự</span><input data-field="sort_order" type="number" min="0" step="10" value="${Number(x.sort_order??(i+1)*10)}"></label>
        <label class="hero-admin-check"><input data-field="active" type="checkbox" ${x.active!==false?'checked':''}><span>Hiển thị trên trang chính</span></label>
        <div class="hero-order-actions"><button type="button" data-move="-1" ${i===0?'disabled':''}>← Trước</button><button type="button" data-move="1" ${i===items.length-1?'disabled':''}>Sau →</button></div>
        <div class="hero-admin-actions"><button type="button" data-save>Lưu</button><button type="button" data-toggle>${x.active!==false?'Ẩn':'Hiện'}</button><button type="button" class="danger" data-delete>Xóa</button></div>
        <div class="hero-admin-source" title="${esc(x.image_url)}">${esc(x.image_url)}</div>
      </div>
    </article>`).join('');
    $$('[data-save]',box).forEach(b=>b.onclick=()=>saveCard(b.closest('.hero-admin-card')));
    $$('[data-toggle]',box).forEach(b=>b.onclick=()=>toggleCard(b.closest('.hero-admin-card')));
    $$('[data-delete]',box).forEach(b=>b.onclick=()=>deleteCard(b.closest('.hero-admin-card')));
    $$('[data-move]',box).forEach(b=>b.onclick=()=>moveCard(b.closest('.hero-admin-card'),Number(b.dataset.move)));
  }
  async function saveCard(card){
    await requireAuth();const id=card.dataset.id;if(id.startsWith('local-'))throw new Error('Hãy chạy SQL patch để quản lý ảnh mặc định.');
    const alt=card.querySelector('[data-field="alt_text"]').value.trim(),sort=Number(card.querySelector('[data-field="sort_order"]').value||100),active=card.querySelector('[data-field="active"]').checked;
    const {error}=await db.from('site_hero_images').update({alt_text:alt,sort_order:sort,active,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await load();
  }
  async function toggleCard(card){
    await requireAuth();const id=card.dataset.id,item=items.find(x=>String(x.id)===String(id));if(!item)return;
    const {error}=await db.from('site_hero_images').update({active:item.active===false,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await load();
  }
  async function moveCard(card,delta){
    await requireAuth();const id=card.dataset.id,index=items.findIndex(x=>String(x.id)===String(id)),target=index+delta;if(index<0||target<0||target>=items.length)return;
    const a=items[index],b=items[target],aOrder=Number(a.sort_order??(index+1)*10),bOrder=Number(b.sort_order??(target+1)*10);
    const [ra,rb]=await Promise.all([db.from('site_hero_images').update({sort_order:bOrder}).eq('id',a.id),db.from('site_hero_images').update({sort_order:aOrder}).eq('id',b.id)]);
    if(ra.error)throw ra.error;if(rb.error)throw rb.error;await load();
  }
  async function deleteCard(card){
    await requireAuth();const id=card.dataset.id,item=items.find(x=>String(x.id)===String(id));if(!item||!confirm('Xóa ảnh này khỏi slideshow đầu trang?'))return;
    const {error}=await db.from('site_hero_images').delete().eq('id',id);if(error)throw error;
    if(item.storage_path){const {error:storageError}=await db.storage.from(BUCKET).remove([item.storage_path]);if(storageError)console.warn(storageError.message);}
    await load();
  }
  async function addUrl(){
    await requireAuth();const url=$('#heroImageUrl').value.trim();if(!url)throw new Error('Hãy chọn ảnh hoặc nhập URL ảnh.');
    const alt=$('#heroImageAlt').value.trim()||'Ảnh tốt nghiệp Cheese.Graduation';
    const max=items.reduce((m,x)=>Math.max(m,Number(x.sort_order||0)),0);
    const {error}=await db.from('site_hero_images').insert({image_url:url,alt_text:alt,sort_order:max+10,active:true});if(error)throw error;
    $('#heroImageUrl').value='';$('#heroImageAlt').value='';await load();
  }
  async function uploadFiles(files){
    await requireAuth();if(!files?.length)return;
    let order=items.reduce((m,x)=>Math.max(m,Number(x.sort_order||0)),0);
    for(let i=0;i<files.length;i++){
      const original=files[i];status(`Đang tối ưu ảnh ${i+1}/${files.length}: <b>${esc(original.name)}</b>…`);
      const file=await optimize(original);status(`Đang upload ảnh ${i+1}/${files.length}: <b>${esc(original.name)}</b> (${fmt(original.size)} → ${fmt(file.size)})…`);
      const path=`hero/${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}.webp`;
      const {error:upErr}=await db.storage.from(BUCKET).upload(path,file,{contentType:'image/webp',upsert:false});if(upErr)throw upErr;
      const publicUrl=db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;order+=10;
      const {error:rowErr}=await db.from('site_hero_images').insert({image_url:publicUrl,storage_path:path,alt_text:'Ảnh tốt nghiệp Cheese.Graduation',sort_order:order,active:true});
      if(rowErr){await db.storage.from(BUCKET).remove([path]);throw rowErr;}
    }
    $('#heroImageFile').value='';await load();status(`Đã upload <b>${files.length}</b> ảnh. Trang chính sẽ đọc danh sách mới từ Supabase.`);
  }
  async function handleAdd(){
    const btn=$('#heroAddButton'),files=$('#heroImageFile')?.files;btn.disabled=true;const old=btn.textContent;btn.textContent='Đang xử lý…';
    try{if(files?.length)await uploadFiles([...files]);else await addUrl();}
    catch(err){alert('Không thêm được ảnh đầu trang: '+err.message+'\n\nNếu chưa tạo bảng/bucket, hãy chạy SUPABASE-PATCH-HERO-IMAGES.sql.');}
    finally{btn.disabled=false;btn.textContent=old;}
  }
  $('#heroAddButton')?.addEventListener('click',handleAdd);
  $('#heroReloadButton')?.addEventListener('click',load);
  document.querySelector('[data-view="hero"]')?.addEventListener('click',load);
  $('#mobileView')?.addEventListener('change',e=>{if(e.target.value==='hero')load();});
  document.addEventListener('DOMContentLoaded',load,{once:true});
  setTimeout(load,350);
})();
