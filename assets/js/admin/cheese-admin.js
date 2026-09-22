(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.CHEESE_CONFIG||{};
const configured=/^https:\/\/.+\.supabase\.co$/i.test(String(cfg.supabaseUrl||'').trim())&&!String(cfg.supabaseAnonKey||'').includes('PASTE_')&&String(cfg.supabaseAnonKey||'').length>20&&window.supabase;
const db=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const DEFAULT_PHOTOGRAPHERS=[
 {id:'p1',slug:'quang-anh',name:'Quang Anh',team:'Founder',active:true,price_amount:2300000,price_label:null,style:'Trong trẻo · Outdoor',bio:'',tags:['Trong trẻo','Outdoor'],cover_url:'assets/photographers/quang-anh.jpg',gallery_urls:[],sort_order:10,rating:null,shoots_count:0},
 {id:'p2',slug:'chi',name:'Chi',team:'Ekip 1',active:true,price_amount:2800000,price_label:null,style:'Editorial · Đèn',bio:'',tags:['Editorial','Đèn'],cover_url:'assets/photographers/chi.jpg',gallery_urls:[],sort_order:20,rating:null,shoots_count:0},
 {id:'p3',slug:'minh',name:'Minh',team:'Ekip 1',active:true,price_amount:2500000,price_label:null,style:'Film · Vintage',bio:'',tags:['Film','Vintage'],cover_url:'assets/photographers/minh.jpg',gallery_urls:[],sort_order:30,rating:null,shoots_count:0},
 {id:'p4',slug:'ngoc-hoang',name:'Ngọc Hoàng',team:'Ekip 2',active:true,price_amount:3100000,price_label:null,style:'Cinematic · Flash',bio:'',tags:['Cinematic','Flash'],cover_url:'assets/photographers/ngoc-hoang.jpg',gallery_urls:[],sort_order:40,rating:null,shoots_count:0},
 {id:'p5',slug:'minh-anh',name:'Minh Anh',team:'Ekip 2',active:true,price_amount:0,price_label:'Liên hệ',style:'Chân dung',bio:'',tags:['Chân dung'],cover_url:'assets/photographers/minh-anh.jpg',gallery_urls:[],sort_order:50,rating:null,shoots_count:0},
 {id:'p6',slug:'quang-vinh',name:'Quang Vinh',team:'Ekip 3',active:true,price_amount:0,price_label:'Liên hệ',style:'Ảnh nhóm',bio:'',tags:['Ảnh nhóm'],cover_url:'assets/photographers/quang-vinh.jpg',gallery_urls:[],sort_order:60,rating:null,shoots_count:0}
];
const DEFAULT_SERVICES=[
 {name:'Bong bóng / khói màu',value:'Cần xác nhận'},
 {name:'Đèn flash & đèn liên tục',value:'Cần xác nhận'},
 {name:'Trang phục & phụ kiện',value:'Cần xác nhận'},
 {name:'Trợ lý đi cùng',value:'Cần xác nhận'},
 {name:'Bàn giao file ảnh gốc',value:'Cần xác nhận'}
];
DEFAULT_PHOTOGRAPHERS.forEach(p=>{
 p.location_text='Hà Nội';
 p.drive_url='https://drive.google.com/drive/folders/1G-XZlKOZDOYzBti6ezr2jWXFBdeBcpMk?usp=sharing';
 const b=Number(p.price_amount||0);
 p.yearbook_prices={'1':b,'2':b?b+300000:0,'3':b?b+600000:0,'4':b?b+900000:0,'5':b?b+1200000:0};
 p.graduation_prices={ceremony:1700000,pregrad:2000000,'pregrad-plus':2500000};
 p.graduation_extra_per_person=300000;
 p.services=DEFAULT_SERVICES.map(x=>({...x}));
});
let demoMode=false, photographers=[], bookings=[], blocks=[], manualEvents=[], takecareStaff=[], takecareShifts=[], activeBooking=null, currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDay=null;
const DEFAULT_PRICING=JSON.parse(JSON.stringify(window.CHEESE_BOOKING_PRICES||{}));
let pricingSettings=JSON.parse(JSON.stringify(DEFAULT_PRICING));
let realtimeChannel=null, unreadNotifications=[], notificationsStarted=false;

const STATUS={new:'Mới',contacted:'Đã liên hệ',deposit_pending:'Chờ cọc',confirmed:'Đã chốt',completed:'Hoàn thành',cancelled:'Hủy',rejected:'Từ chối'};
const DEPOSIT={unpaid:'Chưa cọc',partial:'Cọc một phần',paid:'Đã cọc đủ',refunded:'Hoàn cọc'};
const TAKECARE_RATE_DEFAULT={full_day:400000,half_morning:250000,half_afternoon:250000};
const TAKECARE_SHIFT_LABEL={full_day:'Cả ngày',half_morning:'Nửa ngày sáng',half_afternoon:'Nửa ngày chiều'};
const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n||0))+'đ';
const dateVN=s=>s?new Date(s+'T00:00:00').toLocaleDateString('vi-VN'):'—';
const dateTimeVN=s=>s?new Date(s).toLocaleString('vi-VN'):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const active=b=>!['cancelled','rejected'].includes(b.status);

function photographerNames(){return photographers.filter(p=>p.active!==false).sort((a,b)=>(a.sort_order||100)-(b.sort_order||100)).map(p=>p.name)}
function syncPhotographerOptions(){
  const names=photographerNames();
  [['calendarPhotographer','all','Tất cả photographer'],['filterPhotographer','all','Tất cả photographer']].forEach(([id,val,label])=>{
    const sel=$('#'+id);if(!sel)return;const old=sel.value;sel.innerHTML=`<option value="${val}">${label}</option>`+names.map(n=>`<option>${esc(n)}</option>`).join('');if([...sel.options].some(o=>o.value===old))sel.value=old;
  });
  const manual=$('#manualEventPhotographer');if(manual){const old=manual.value;manual.innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join('');if([...manual.options].some(o=>o.value===old))manual.value=old;}
}

const setupWarning=$('#setupWarning'), loginError=$('#loginError');
if(!configured) setupWarning.hidden=false;

$('#demoLogin').addEventListener('click',()=>{demoMode=true; enterAdmin('Demo local');});
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); loginError.textContent='';
  if(!db){loginError.textContent='Supabase chưa được cấu hình. Hãy dùng chế độ demo hoặc điền config.js.';return;}
  const email=$('#loginEmail').value.trim(), password=$('#loginPassword').value;
  const {data,error}=await db.auth.signInWithPassword({email,password});
  if(error){loginError.textContent=error.message;return;}
  const {data:isAdmin,error:adminErr}=await db.rpc('is_admin');
  if(adminErr||!isAdmin){await db.auth.signOut();loginError.textContent='Tài khoản này chưa được cấp quyền admin.';return;}
  enterAdmin(data.user.email);
});
$('#logoutButton').addEventListener('click',async()=>{if(db&&!demoMode)await db.auth.signOut();location.reload();});

async function bootstrap(){
  if(!db)return;
  const {data:{session}}=await db.auth.getSession();
  if(!session)return;
  const {data:isAdmin}=await db.rpc('is_admin');
  if(isAdmin) enterAdmin(session.user.email);
}
bootstrap();

async function enterAdmin(email){
  $('#loginScreen').style.display='none'; $('#adminEmail').textContent=email;
  $('#syncStatus').textContent=demoMode?'Dữ liệu demo cục bộ':'Đồng bộ Supabase';
  await loadAll();
  if (!demoMode) startRealtimeNotifications();
}

function demoSeed(){
  const saved=JSON.parse(localStorage.getItem('cheese_demo_bookings_v1')||'[]');
  if(saved.length)return saved;
  const d=new Date(), iso=x=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+x).toISOString().slice(0,10);
  return [
    {id:'d1',booking_code:'CG-DEMO-01',created_at:new Date().toISOString(),customer_name:'Nguyễn Minh Anh',phone:'0988 123 456',contact_link:'',school:'THPT Demo',class_name:'12A1',group_size:'Trên 30 người',photographer:'Quang Anh',package_name:'Gói Full Day',shoot_date:iso(2),time_slot:'Cả ngày',note:'Muốn concept sân trường',status:'new',deposit_amount:0,deposit_status:'unpaid',internal_note:''},
    {id:'d2',booking_code:'CG-DEMO-02',created_at:new Date(Date.now()-86400000).toISOString(),customer_name:'Trần Thu Hà',phone:'0912 345 678',school:'THPT Demo 2',class_name:'12D3',group_size:'16–30 người',photographer:'Chi',package_name:'Gói tiêu chuẩn',shoot_date:iso(4),time_slot:'Sáng',note:'',status:'confirmed',deposit_amount:1000000,deposit_status:'paid',internal_note:'Đã xác nhận concept'},
    {id:'d3',booking_code:'CG-DEMO-03',created_at:new Date(Date.now()-172800000).toISOString(),customer_name:'Lê Hoàng',phone:'0966 111 222',school:'THPT Demo 3',class_name:'12C2',group_size:'Trên 30 người',photographer:'Minh',package_name:'Gói tiêu chuẩn',shoot_date:iso(4),time_slot:'Chiều',note:'',status:'deposit_pending',deposit_amount:500000,deposit_status:'partial',internal_note:'Chờ chuyển phần cọc còn lại'}
  ];
}
async function loadAll(){
  try{
    if(demoMode){
      photographers=JSON.parse(localStorage.getItem('cheese_demo_photographers_v2')||'null')||DEFAULT_PHOTOGRAPHERS.map(p=>({...p}));
      bookings=demoSeed();
      blocks=JSON.parse(localStorage.getItem('cheese_demo_blocks_v1')||'[]');
      manualEvents=JSON.parse(localStorage.getItem('cheese_demo_calendar_events_v1')||'[]');
      takecareStaff=JSON.parse(localStorage.getItem('cheese_demo_takecare_staff_v1')||'[]');
      takecareShifts=JSON.parse(localStorage.getItem('cheese_demo_takecare_shifts_v1')||'[]');
      pricingSettings=JSON.parse(localStorage.getItem('cheese_demo_pricing_v1')||'null')||JSON.parse(JSON.stringify(DEFAULT_PRICING));pricingSettings.takecareFullDayRate=Number(pricingSettings.takecareFullDayRate||400000);pricingSettings.takecareHalfDayRate=Number(pricingSettings.takecareHalfDayRate||250000);
    }else{
      const [pq,bq,blq,meq,prq,tcq,tcsq]=await Promise.all([
        db.from('photographers').select('*').order('sort_order').order('created_at'),
        db.from('bookings').select('*').order('created_at',{ascending:false}),
        db.from('photographer_blocks').select('*').order('block_date'),
        db.from('calendar_events').select('*').order('event_date'),
        db.from('site_pricing').select('*').eq('id','main').maybeSingle(),
        db.from('takecare_staff').select('*').order('active',{ascending:false}).order('name'),
        db.from('takecare_shifts').select('*').order('work_date',{ascending:false})
      ]);
      if(pq.error)throw pq.error;if(bq.error)throw bq.error;if(blq.error)throw blq.error;if(meq.error)throw meq.error;
      photographers=pq.data||[];bookings=bq.data||[];blocks=blq.data||[];manualEvents=meq.data||[];
      if(tcq.error){console.warn('Take Care staff:',tcq.error.message);takecareStaff=[]}else takecareStaff=tcq.data||[];
      if(tcsq.error){console.warn('Take Care shifts:',tcsq.error.message);takecareShifts=[]}else takecareShifts=tcsq.data||[];
      if(prq.error){
        console.warn('Pricing table:',prq.error.message);
        pricingSettings=JSON.parse(JSON.stringify(DEFAULT_PRICING));
      }else if(prq.data){
        pricingSettings={...JSON.parse(JSON.stringify(DEFAULT_PRICING)),referencePriceFrom:Number(prq.data.reference_price_from||1500000),teamBasePrices:prq.data.team_prices||[],provinceGroups:prq.data.province_groups||[],provinceDetails:prq.data.province_details||{},takecareFullDayRate:Number(prq.data.takecare_full_day_rate||400000),takecareHalfDayRate:Number(prq.data.takecare_half_day_rate||250000)};
      }else {pricingSettings=JSON.parse(JSON.stringify(DEFAULT_PRICING));pricingSettings.takecareFullDayRate=400000;pricingSettings.takecareHalfDayRate=250000;}
    }
    syncPhotographerOptions();
    renderAll();
  }catch(err){alert('Không tải được dữ liệu: '+err.message);}
}
function renderAll(){renderStats();renderRecent();renderBookings();renderCalendar();renderPhotographers();renderPricingSettings();renderTakecare();if(selectedDay)renderDayPanel(selectedDay);}
function renderStats(){
  const now=new Date(), m=now.getMonth(), y=now.getFullYear();
  $('#statNew').textContent=bookings.filter(b=>b.status==='new').length;
  $('#statMonth').textContent=bookings.filter(b=>{const d=new Date(b.shoot_date+'T00:00:00');return d.getMonth()===m&&d.getFullYear()===y&&active(b)}).length;
  $('#statDeposit').textContent=bookings.filter(b=>['unpaid','partial'].includes(b.deposit_status)&&active(b)).length;
  $('#statMoney').textContent=money(bookings.filter(b=>['partial','paid'].includes(b.deposit_status)).reduce((s,b)=>s+Number(b.deposit_amount||0),0));
}
function rowHtml(b,compact=false){
  if(compact)return `<tr data-id="${b.id}"><td class="code">${esc(b.booking_code)}</td><td class="customer"><b>${esc(b.customer_name)}</b><small>${esc(b.phone)}</small></td><td>${dateVN(b.shoot_date)} · ${esc(b.time_slot)}</td><td>${esc(b.photographer)}</td><td><span class="pill s-${b.status}">${STATUS[b.status]||b.status}</span></td><td><span class="pill d-${b.deposit_status}">${DEPOSIT[b.deposit_status]||b.deposit_status}</span></td></tr>`;
  return `<tr data-id="${b.id}"><td class="code">${esc(b.booking_code)}</td><td class="customer"><b>${esc(b.customer_name)}</b><small>${esc(b.school||'')} ${esc(b.class_name||'')}</small></td><td>${esc(b.phone)}</td><td>${dateVN(b.shoot_date)}<br><small>${esc(b.time_slot)}</small></td><td>${esc(b.photographer)}</td><td>${esc(b.package_name)}</td><td><span class="pill s-${b.status}">${STATUS[b.status]||b.status}</span></td><td><b class="money">${money(b.deposit_amount)}</b><br><span class="pill d-${b.deposit_status}">${DEPOSIT[b.deposit_status]||b.deposit_status}</span></td></tr>`;
}
function bindRows(root){$$('tr[data-id]',root).forEach(tr=>tr.addEventListener('click',()=>openDrawer(tr.dataset.id)));}
function renderRecent(){const body=$('#recentRows');body.innerHTML=bookings.slice(0,8).map(b=>rowHtml(b,true)).join('')||'<tr><td colspan="6" class="empty">Chưa có booking.</td></tr>';bindRows(body);}
function renderBookings(){
  const q=$('#searchInput').value.trim().toLowerCase(), p=$('#filterPhotographer').value, s=$('#filterStatus').value;
  const filtered=bookings.filter(b=>{
    const hay=[b.booking_code,b.customer_name,b.phone,b.customer_email,b.school,b.class_name].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(p==='all'||b.photographer===p)&&(s==='all'||b.status===s);
  });
  const body=$('#bookingRows');body.innerHTML=filtered.map(b=>rowHtml(b)).join('');
  $('#bookingEmpty').hidden=!!filtered.length;bindRows(body);
}
['searchInput','filterPhotographer','filterStatus'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',renderBookings));

function switchView(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const map={overview:['Tổng quan','Theo dõi booking và tình trạng lịch của ekip.'],calendar:['Lịch chụp','Xem lịch theo photographer, ngày kín và trạng thái cọc.'],bookings:['Đơn đặt lịch','Quản lý toàn bộ yêu cầu khách gửi từ website.'],photographers:['Photographer','Sửa giá, thông tin, ảnh và trạng thái hiển thị của từng thợ.'],hero:['Ảnh đầu trang','Thêm, xóa, ẩn/hiện và sắp xếp ảnh chạy ở đầu trang chính.'],pricing:['Bảng giá & phụ phí','Sửa giá tham khảo, hạng ekip và toàn bộ phụ phí di chuyển.'],takecare:['Take Care','Quản lý nhân sự, ngày làm và chi phí Take Care theo từng ca.']};
  $('#viewTitle').textContent=map[name][0];$('#viewSubtitle').textContent=map[name][1];$('#mobileView').value=name;
}
$$('.nav button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#mobileView').addEventListener('change',e=>switchView(e.target.value));

function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function renderCalendar(){
  const grid=$('#calendarGrid'), phot=$('#calendarPhotographer').value;
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
  $('#monthTitle').textContent=`Tháng ${m+1} · ${y}`;
  const start=new Date(y,m,1), mondayIndex=(start.getDay()+6)%7, first=new Date(y,m,1-mondayIndex);
  const dows=['T2','T3','T4','T5','T6','T7','CN'];
  let html=dows.map(d=>`<div class="dow">${d}</div>`).join('');
  const today=ymd(new Date());
  for(let i=0;i<42;i++){
    const d=new Date(first);d.setDate(first.getDate()+i);const ds=ymd(d),other=d.getMonth()!==m;
    const dayBookings=bookings.filter(b=>b.shoot_date===ds&&active(b)&&(phot==='all'||b.photographer===phot));
    const dayBlocks=blocks.filter(x=>x.block_date===ds&&(phot==='all'||x.photographer===phot));
    const dayManual=manualEvents.filter(x=>x.event_date===ds&&(phot==='all'||x.photographer===phot));
    let full=false;
    if(phot!=='all'){
      const slots=new Set(dayBookings.map(b=>b.time_slot));
      const manualSlots=new Set(dayManual.filter(x=>x.blocks_booking).map(x=>x.time_slot));
      full=
        slots.has('Cả ngày') ||
        manualSlots.has('Cả ngày') ||
        ((slots.has('Sáng')||manualSlots.has('Sáng'))&&(slots.has('Chiều')||manualSlots.has('Chiều'))) ||
        dayBlocks.some(x=>x.time_slot==='Cả ngày');
    }
    const state=dayBlocks.length?'blocked':full?'full':'';
    const combined=[
      ...dayBookings.map(b=>({
        kind:'booking', id:b.id,
        html:`<div class="event ${b.deposit_status==='paid'?'paid':(['unpaid','partial'].includes(b.deposit_status)?'pending':'')}">${esc(b.photographer)} · ${esc(b.time_slot)} · ${esc(b.customer_name)}</div>`
      })),
      ...dayManual.map(x=>({
        kind:'manual', id:x.id,
        html:`<div class="event manual ${esc(x.event_type)} ${x.blocks_booking?'':'no-block'}">${esc(x.photographer)} · ${esc(x.time_slot)} · ${esc(x.title)}</div>`
      }))
    ];
    const events=combined.slice(0,3).map(x=>x.html).join('');
    const more=combined.length>3?`<div class="event">+${combined.length-3} lịch khác</div>`:'';
    html+=`<div class="day ${other?'other ':''}${ds===today?'today ':''}${state}" data-date="${ds}"><span class="num">${d.getDate()}</span><span class="day-state">${dayBlocks.length?'Khóa':full?'Kín':''}</span>${events}${more}</div>`;
  }
  grid.innerHTML=html;
  $$('.day[data-date]',grid).forEach(el=>el.addEventListener('click',()=>{selectedDay=el.dataset.date;renderDayPanel(selectedDay);}));
}
$('#calendarPhotographer').addEventListener('change',()=>{renderCalendar();if(selectedDay)renderDayPanel(selectedDay)});
$('#prevMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);renderCalendar()});
$('#nextMonth').addEventListener('click',()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);renderCalendar()});
$('#todayButton').addEventListener('click',()=>{currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar()});

function renderDayPanel(ds){
  const panel=$('#dayPanel'), phot=$('#calendarPhotographer').value;
  panel.hidden=false;$('#dayTitle').textContent=dateVN(ds);
  let list=bookings.filter(b=>b.shoot_date===ds&&active(b)&&(phot==='all'||b.photographer===phot));
  let manual=manualEvents.filter(x=>x.event_date===ds&&(phot==='all'||x.photographer===phot));
  $('#daySummary').textContent=phot==='all'?`${list.length} booking · ${manual.length} lịch tự thêm`:`${phot} · ${list.length} booking · ${manual.length} lịch tự thêm`;
  const bookingHtml=list.map(b=>`<div class="day-booking" data-id="${b.id}"><div><b>${esc(b.time_slot)} · ${esc(b.customer_name)}</b><p>${esc(b.photographer)} · ${esc(b.phone)} · ${STATUS[b.status]}</p></div><strong>${DEPOSIT[b.deposit_status]}<br>${money(b.deposit_amount)}</strong></div>`).join('');
  const manualHtml=manual.map(x=>`<div class="day-booking manual-entry"><div><b>${esc(x.time_slot)} · ${esc(x.title)}</b><p>${esc(x.photographer)} · ${x.event_type==='personal'?'Lịch cá nhân':x.event_type==='existing_booking'?'Lịch đã có':'Lịch khác'}${x.blocks_booking?' · Chặn booking':''}</p></div><div class="day-event-actions"><button class="day-event-edit" type="button" data-manual-id="${x.id}">Sửa</button></div></div>`).join('');
  $('#dayBookings').innerHTML=(bookingHtml+manualHtml)||'<div class="empty">Ngày này chưa có lịch.</div>';
  $$('.day-booking[data-id]').forEach(x=>x.addEventListener('click',()=>openDrawer(x.dataset.id)));
  $$('[data-manual-id]').forEach(x=>x.addEventListener('click',()=>openManualEvent(x.dataset.manualId)));
  const btn=$('#toggleBlockDay');
  if(phot==='all'){btn.disabled=true;btn.textContent='Chọn photographer để khóa lịch';return}
  btn.disabled=false;
  const blocked=blocks.some(x=>x.photographer===phot&&x.block_date===ds&&x.time_slot==='Cả ngày');
  btn.textContent=blocked?'Mở lại ngày':'Khóa cả ngày';
  btn.dataset.blocked=blocked?'1':'0';btn.dataset.date=ds;btn.dataset.photographer=phot;
}
$('#toggleBlockDay').addEventListener('click',async()=>{
  const b=$('#toggleBlockDay'), phot=b.dataset.photographer, date=b.dataset.date, isBlocked=b.dataset.blocked==='1'; if(!phot||!date)return;
  try{
    if(demoMode){
      if(isBlocked) blocks=blocks.filter(x=>!(x.photographer===phot&&x.block_date===date&&x.time_slot==='Cả ngày'));
      else blocks.push({id:'block-'+Date.now(),photographer:phot,block_date:date,time_slot:'Cả ngày',note:'Khóa từ admin'});
      localStorage.setItem('cheese_demo_blocks_v1',JSON.stringify(blocks));
    }else if(isBlocked){
      const {error}=await db.from('photographer_blocks').delete().eq('photographer',phot).eq('block_date',date).eq('time_slot','Cả ngày');if(error)throw error;
    }else{
      const {error}=await db.from('photographer_blocks').insert({photographer:phot,block_date:date,time_slot:'Cả ngày',note:'Khóa từ admin'});if(error)throw error;
    }
    await loadAll();
  }catch(err){alert(err.message)}
});

function openDrawer(id){
  activeBooking=bookings.find(b=>String(b.id)===String(id));if(!activeBooking)return;
  $('#drawerCode').textContent=activeBooking.booking_code;$('#drawerCreated').textContent='Tạo '+dateTimeVN(activeBooking.created_at);
  const d=[['Khách',activeBooking.customer_name],['Số điện thoại',activeBooking.phone],['Email',activeBooking.customer_email||'—'],['Trường / lớp',[activeBooking.school,activeBooking.class_name].filter(Boolean).join(' · ')||'—'],['Liên hệ',activeBooking.contact_link||'—'],['Ngày chụp',dateVN(activeBooking.shoot_date)+' · '+activeBooking.time_slot],['Photographer',activeBooking.photographer],['Số lượng',activeBooking.group_size],['Gói',activeBooking.package_name],['Ghi chú khách',activeBooking.note||'—']];
  $('#detailGrid').innerHTML=d.map(([k,v])=>`<div class="detail"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
  $('#editStatus').value=activeBooking.status;$('#editDepositStatus').value=activeBooking.deposit_status;$('#editDepositAmount').value=activeBooking.deposit_amount||0;$('#editInternalNote').value=activeBooking.internal_note||'';
  $('#drawerBackdrop').classList.add('open');$('#bookingDrawer').classList.add('open');
}
function closeDrawer(){$('#drawerBackdrop').classList.remove('open');$('#bookingDrawer').classList.remove('open');activeBooking=null}
$('#drawerClose').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);
$('#editForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!activeBooking)return;
  const before={status:activeBooking.status,deposit_status:activeBooking.deposit_status,deposit_amount:Number(activeBooking.deposit_amount||0)};
  const patch={status:$('#editStatus').value,deposit_status:$('#editDepositStatus').value,deposit_amount:Number($('#editDepositAmount').value||0),internal_note:$('#editInternalNote').value.trim()||null};
  const customerFacingChanged =
    before.status!==patch.status ||
    before.deposit_status!==patch.deposit_status ||
    before.deposit_amount!==patch.deposit_amount;

  try{
    const bookingId=activeBooking.id;
    if(demoMode){
      bookings=bookings.map(b=>b.id===bookingId?{...b,...patch}:b);
      const local=JSON.parse(localStorage.getItem('cheese_demo_bookings_v1')||'[]');
      if(local.some(b=>b.id===bookingId)) localStorage.setItem('cheese_demo_bookings_v1',JSON.stringify(local.map(b=>b.id===bookingId?{...b,...patch}:b)));
    }else{
      const {error}=await db.from('bookings').update(patch).eq('id',bookingId);if(error)throw error;
      if(customerFacingChanged){
        const {error:notifyError}=await db.functions.invoke('status-notify',{body:{booking_id:bookingId}});
        if(notifyError) console.warn('Status notification error:',notifyError.message);
      }
    }
    closeDrawer();await loadAll();
  }catch(err){alert('Không lưu được: '+err.message)}
});

$('#resendBookingNotify')?.addEventListener('click',async()=>{
  if(!activeBooking)return;
  if(demoMode){alert('Chế độ demo không gửi Email/Zalo/Telegram thật.');return}
  const btn=$('#resendBookingNotify'), original=btn.textContent;
  btn.disabled=true;btn.textContent='Đang gửi...';
  try{
    const {error}=await db.functions.invoke('status-notify',{body:{booking_id:activeBooking.id,force:true}});
    if(error)throw error;
    alert('Đã yêu cầu gửi lại email/Zalo xác nhận cho khách.');
  }catch(err){alert('Không gửi được: '+err.message)}
  finally{btn.disabled=false;btn.textContent=original}
});


const manualModal=$('#manualEventModal');
const manualForm=$('#manualEventForm');
const manualId=$('#manualEventId');
const manualType=$('#manualEventType');
const manualTitleInput=$('#manualEventTitleInput');
const manualPhotographer=$('#manualEventPhotographer');
const manualDate=$('#manualEventDate');
const manualTime=$('#manualEventTime');
const manualSource=$('#manualEventSource');
const manualNote=$('#manualEventNote');
const manualBlocks=$('#manualEventBlocks');
const manualDelete=$('#deleteManualEvent');

function syncManualWebStatus(){
  const box=$('.manual-web-status'), text=$('#manualWebStatusText');
  if(!box||!text)return;
  const busy=manualBlocks.checked;
  box.classList.toggle('is-free',!busy);
  text.textContent=busy
    ? 'Hết lịch · khách sẽ không chọn được khung giờ này'
    : 'Còn lịch · sự kiện chỉ lưu nội bộ, khách vẫn tra thấy còn';
}
manualBlocks?.addEventListener('change',syncManualWebStatus);

function openManualEvent(id=null,prefillDate=null){
  const item=id?manualEvents.find(x=>String(x.id)===String(id)):null;
  manualForm.reset();
  manualId.value=item?.id||'';
  manualType.value=item?.event_type||'existing_booking';
  manualTitleInput.value=item?.title||'';
  manualPhotographer.value=item?.photographer||($('#calendarPhotographer').value!=='all'?$('#calendarPhotographer').value:photographerNames()[0]||'');
  manualDate.value=item?.event_date||prefillDate||selectedDay||ymd(new Date());
  manualTime.value=item?.time_slot||'Cả ngày';
  manualSource.value=item?.source||'';
  manualNote.value=item?.note||'';
  manualBlocks.checked=item?!!item.blocks_booking:true;
  syncManualWebStatus();
  manualDelete.hidden=!item;
  $('#manualEventTitle').textContent=item?'Sửa lịch':'Thêm lịch vào hệ thống';
  manualModal.classList.add('open');
  manualModal.setAttribute('aria-hidden','false');
  setTimeout(()=>manualTitleInput.focus(),100);
}

function closeManualEvent(){
  manualModal.classList.remove('open');
  manualModal.setAttribute('aria-hidden','true');
}

$('#addCalendarEvent')?.addEventListener('click',()=>openManualEvent(null,selectedDay));
$$('[data-manual-close]').forEach(x=>x.addEventListener('click',closeManualEvent));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&manualModal?.classList.contains('open'))closeManualEvent()});

manualForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!manualForm.reportValidity())return;
  const payload={
    event_type:manualType.value,
    title:manualTitleInput.value.trim(),
    photographer:manualPhotographer.value,
    event_date:manualDate.value,
    time_slot:manualTime.value,
    source:manualSource.value.trim()||null,
    note:manualNote.value.trim()||null,
    blocks_booking:manualBlocks.checked
  };
  try{
    if(demoMode){
      if(manualId.value){
        manualEvents=manualEvents.map(x=>String(x.id)===String(manualId.value)?{...x,...payload}:x);
      }else{
        manualEvents.push({id:'manual-'+Date.now(),created_at:new Date().toISOString(),...payload});
      }
      localStorage.setItem('cheese_demo_calendar_events_v1',JSON.stringify(manualEvents));
    }else if(manualId.value){
      const {error}=await db.from('calendar_events').update(payload).eq('id',manualId.value);
      if(error)throw error;
    }else{
      const {error}=await db.from('calendar_events').insert(payload);
      if(error)throw error;
    }
    closeManualEvent();
    selectedDay=payload.event_date;
    currentMonth=new Date(payload.event_date+'T00:00:00');
    currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth(),1);
    await loadAll();
    switchView('calendar');
    renderDayPanel(selectedDay);
  }catch(err){alert('Không lưu được lịch: '+err.message)}
});

manualDelete?.addEventListener('click',async()=>{
  if(!manualId.value)return;
  if(!confirm('Xóa lịch này khỏi hệ thống?'))return;
  try{
    if(demoMode){
      manualEvents=manualEvents.filter(x=>String(x.id)!==String(manualId.value));
      localStorage.setItem('cheese_demo_calendar_events_v1',JSON.stringify(manualEvents));
    }else{
      const {error}=await db.from('calendar_events').delete().eq('id',manualId.value);
      if(error)throw error;
    }
    closeManualEvent();await loadAll();
    if(selectedDay)renderDayPanel(selectedDay);
  }catch(err){alert('Không xóa được lịch: '+err.message)}
});



// ============================================================
// Photographer CMS
// ============================================================
// TAKE CARE CMS — nhân sự + lịch làm + chi phí
function tcMonthValue(){
  const el=$('#takecareMonthFilter');
  if(el?.value)return el.value;
  const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function tcRate(type){
  if(type==='full_day')return Number(pricingSettings.takecareFullDayRate||TAKECARE_RATE_DEFAULT.full_day);
  if(type==='half_morning'||type==='half_afternoon')return Number(pricingSettings.takecareHalfDayRate||TAKECARE_RATE_DEFAULT.half_morning);
  return 0;
}
function tcStaffById(id){return takecareStaff.find(x=>String(x.id)===String(id))}
function tcFilteredShifts(){
  const month=tcMonthValue(),staff=$('#takecareStaffFilter')?.value||'all';
  return takecareShifts.filter(s=>String(s.work_date||'').slice(0,7)===month&&(staff==='all'||String(s.takecare_id)===String(staff))).sort((a,b)=>String(a.work_date).localeCompare(String(b.work_date)));
}
function syncTakecareSelects(){
  const activeStaff=takecareStaff.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));
  const shiftSel=$('#takecareShiftStaff');
  if(shiftSel){const old=shiftSel.value;shiftSel.innerHTML=activeStaff.length?activeStaff.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''):'<option value="">Chưa có Take Care</option>';if([...shiftSel.options].some(o=>o.value===old))shiftSel.value=old;}
  const filter=$('#takecareStaffFilter');
  if(filter){const old=filter.value;filter.innerHTML='<option value="all">Tất cả Take Care</option>'+takecareStaff.map(x=>`<option value="${x.id}">${esc(x.name)}${x.active===false?' · đã ẩn':''}</option>`).join('');if([...filter.options].some(o=>o.value===old))filter.value=old;}
}
function renderTakecare(){
  if(!$('#view-takecare'))return;
  const month=$('#takecareMonthFilter');
  if(month&&!month.value){const d=new Date();month.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  const date=$('#takecareShiftDate');if(date&&!date.value)date.value=ymd(new Date());
  const fullRate=$('#takecareFullDayRate'),halfRate=$('#takecareHalfDayRate');
  if(fullRate)fullRate.value=Number(pricingSettings.takecareFullDayRate||400000);
  if(halfRate)halfRate.value=Number(pricingSettings.takecareHalfDayRate||250000);
  syncTakecareSelects();renderTakecareStaff();renderTakecareSchedule();syncTakecareCostPreview();syncTakecareRateLabels();
}
function renderTakecareStaff(){
  const box=$('#takecareStaffList'),empty=$('#takecareStaffEmpty');if(!box)return;
  const month=tcMonthValue();
  box.innerHTML=takecareStaff.map(person=>{
    const shifts=takecareShifts.filter(s=>String(s.takecare_id)===String(person.id)&&String(s.work_date||'').slice(0,7)===month);
    const total=shifts.reduce((sum,s)=>sum+Number(s.cost_amount||tcRate(s.shift_type)),0);
    return `<div class="takecare-staff-card" data-tc-staff="${person.id}">
      <label><span>Tên</span><input data-tc-field="name" value="${esc(person.name||'')}"></label>
      <label><span>Số điện thoại</span><input data-tc-field="phone" value="${esc(person.phone||'')}"></label>
      <label><span>Ghi chú</span><input data-tc-field="note" value="${esc(person.note||'')}"></label>
      <div class="takecare-staff-actions">
        <button class="tc-save" type="button" data-tc-save="${person.id}">Lưu</button>
        <button class="tc-active ${person.active===false?'inactive':''}" type="button" data-tc-toggle="${person.id}">${person.active===false?'Hiện lại':'Đang hoạt động'}</button>
        <button class="tc-delete" type="button" data-tc-delete="${person.id}">Xóa</button>
      </div>
      <div class="takecare-staff-sub"><span>${shifts.length} ca trong tháng</span><span>${money(total)}</span>${person.active===false?'<span>Đã ẩn</span>':''}</div>
    </div>`;
  }).join('');
  empty.hidden=!!takecareStaff.length;
  $$('[data-tc-save]',box).forEach(btn=>btn.addEventListener('click',()=>saveTakecareStaff(btn.dataset.tcSave)));
  $$('[data-tc-toggle]',box).forEach(btn=>btn.addEventListener('click',()=>toggleTakecareStaff(btn.dataset.tcToggle)));
  $$('[data-tc-delete]',box).forEach(btn=>btn.addEventListener('click',()=>deleteTakecareStaff(btn.dataset.tcDelete)));
}
async function saveTakecareStaff(id){
  const row=$(`[data-tc-staff="${id}"]`);if(!row)return;
  const payload={name:row.querySelector('[data-tc-field="name"]').value.trim(),phone:row.querySelector('[data-tc-field="phone"]').value.trim()||null,note:row.querySelector('[data-tc-field="note"]').value.trim()||null};
  if(!payload.name){alert('Tên Take Care không được để trống.');return}
  try{
    if(demoMode){const p=tcStaffById(id);Object.assign(p,payload);localStorage.setItem('cheese_demo_takecare_staff_v1',JSON.stringify(takecareStaff));renderTakecare();return}
    const {error}=await db.from('takecare_staff').update(payload).eq('id',id);if(error)throw error;await loadAll();switchView('takecare');
  }catch(err){alert('Không lưu được Take Care: '+err.message)}
}
async function toggleTakecareStaff(id){
  const person=tcStaffById(id);if(!person)return;const active=person.active===false;
  try{
    if(demoMode){person.active=active;localStorage.setItem('cheese_demo_takecare_staff_v1',JSON.stringify(takecareStaff));renderTakecare();return}
    const {error}=await db.from('takecare_staff').update({active}).eq('id',id);if(error)throw error;await loadAll();switchView('takecare');
  }catch(err){alert('Không đổi được trạng thái: '+err.message)}
}
async function deleteTakecareStaff(id){
  const person=tcStaffById(id);if(!person)return;
  const hasHistory=takecareShifts.some(s=>String(s.takecare_id)===String(id));
  if(hasHistory){
    alert(`${person.name} đã có lịch làm. Để giữ lịch sử chi phí, hệ thống sẽ ẩn nhân sự này thay vì xóa.`);
    if(person.active!==false)await toggleTakecareStaff(id);return;
  }
  if(!confirm(`Xóa Take Care ${person.name}?`))return;
  try{
    if(demoMode){takecareStaff=takecareStaff.filter(x=>String(x.id)!==String(id));localStorage.setItem('cheese_demo_takecare_staff_v1',JSON.stringify(takecareStaff));renderTakecare();return}
    const {error}=await db.from('takecare_staff').delete().eq('id',id);if(error)throw error;await loadAll();switchView('takecare');
  }catch(err){alert('Không xóa được Take Care: '+err.message)}
}
$('#takecareStaffForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={name:$('#takecareStaffName').value.trim(),phone:$('#takecareStaffPhone').value.trim()||null,note:$('#takecareStaffNote').value.trim()||null,active:true};
  if(!payload.name)return;
  try{
    if(demoMode){takecareStaff.push({id:'tc-'+Date.now(),...payload,created_at:new Date().toISOString()});localStorage.setItem('cheese_demo_takecare_staff_v1',JSON.stringify(takecareStaff));e.currentTarget.reset();renderTakecare();return}
    const {error}=await db.from('takecare_staff').insert(payload);if(error)throw error;e.currentTarget.reset();await loadAll();switchView('takecare');
  }catch(err){alert('Không thêm được Take Care: '+err.message+'\n\nNếu đây là lần đầu dùng mục Take Care, hãy chạy lại supabase-setup.sql.')}
});
function syncTakecareRateLabels(){
  const full=tcRate('full_day'),half=tcRate('half_morning');
  const fullLabel=$('#tcFullRateLabel'),halfLabel=$('#tcHalfRateLabel');
  if(fullLabel)fullLabel.textContent=`× ${money(full)}`;
  if(halfLabel)halfLabel.textContent=`× ${money(half)}`;
  const select=$('#takecareShiftType');
  if(select){
    const labels={
      full_day:`Cả ngày · ${money(full)}`,
      half_morning:`Nửa ngày sáng · ${money(half)}`,
      half_afternoon:`Nửa ngày chiều · ${money(half)}`
    };
    [...select.options].forEach(o=>{if(labels[o.value])o.textContent=labels[o.value]});
  }
}
function syncTakecareRateDraft(){
  const full=Number($('#takecareFullDayRate')?.value||400000),half=Number($('#takecareHalfDayRate')?.value||250000);
  pricingSettings.takecareFullDayRate=full>0?full:400000;
  pricingSettings.takecareHalfDayRate=half>0?half:250000;
  syncTakecareRateLabels();syncTakecareCostPreview();
}
$('#takecareFullDayRate')?.addEventListener('input',syncTakecareRateDraft);
$('#takecareHalfDayRate')?.addEventListener('input',syncTakecareRateDraft);
$('#saveTakecareRates')?.addEventListener('click',async()=>{
  syncTakecareRateDraft();
  const btn=$('#saveTakecareRates'),old=btn.textContent;btn.disabled=true;btn.textContent='Đang lưu...';
  try{
    const full=Number(pricingSettings.takecareFullDayRate||400000),half=Number(pricingSettings.takecareHalfDayRate||250000);
    if(demoMode){
      localStorage.setItem('cheese_demo_pricing_v1',JSON.stringify(pricingSettings));
    }else{
      const {error}=await db.from('site_pricing').upsert({
        id:'main',
        takecare_full_day_rate:full,
        takecare_half_day_rate:half,
        updated_at:new Date().toISOString()
      },{onConflict:'id'});
      if(error)throw error;
    }
    alert(`Đã lưu giá công Take Care:\nCả ngày: ${money(full)}\nNửa ngày: ${money(half)}\n\nLịch cũ giữ nguyên chi phí đã lưu.`);
  }catch(err){
    const msg=String(err.message||'');
    if(/site_pricing|schema cache|Could not find the table/i.test(msg)){
      alert('Supabase chưa có bảng site_pricing. Hãy chạy file SUPABASE-PATCH-PRICING-TAKECARE.sql một lần trong Supabase → SQL Editor, sau đó tải lại Admin.');
    }else alert('Không lưu được giá công Take Care: '+msg);
  }finally{btn.disabled=false;btn.textContent=old}
});
function syncTakecareCostPreview(){const type=$('#takecareShiftType')?.value||'full_day',node=$('#takecareShiftCost');if(node)node.textContent=money(tcRate(type))}
$('#takecareShiftType')?.addEventListener('change',syncTakecareCostPreview);
$('#takecareShiftForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const staffId=$('#takecareShiftStaff').value,date=$('#takecareShiftDate').value,type=$('#takecareShiftType').value,note=$('#takecareShiftNote').value.trim()||null;
  if(!staffId||!date){alert('Hãy chọn Take Care và ngày làm.');return}
  const existing=takecareShifts.find(s=>String(s.takecare_id)===String(staffId)&&s.work_date===date);
  if(existing){alert(`${tcStaffById(staffId)?.name||'Take Care'} đã có ca ${TAKECARE_SHIFT_LABEL[existing.shift_type]||existing.shift_type} ngày ${dateVN(date)}. Mỗi người chỉ có 1 loại ca/ngày.`);return}
  const payload={takecare_id:staffId,work_date:date,shift_type:type,cost_amount:tcRate(type),note};
  try{
    if(demoMode){takecareShifts.push({id:'tcs-'+Date.now(),...payload,created_at:new Date().toISOString()});localStorage.setItem('cheese_demo_takecare_shifts_v1',JSON.stringify(takecareShifts));$('#takecareShiftNote').value='';renderTakecare();return}
    const {error}=await db.from('takecare_shifts').insert(payload);if(error)throw error;$('#takecareShiftNote').value='';await loadAll();switchView('takecare');
  }catch(err){alert('Không thêm được lịch Take Care: '+err.message)}
});
function renderTakecareSchedule(){
  const filtered=tcFilteredShifts(),month=tcMonthValue();
  const allMonth=takecareShifts.filter(s=>String(s.work_date||'').slice(0,7)===month);
  $('#tcStatActive').textContent=takecareStaff.filter(x=>x.active!==false).length;
  $('#tcStatShifts').textContent=allMonth.length;
  $('#tcStatFull').textContent=allMonth.filter(s=>s.shift_type==='full_day').length;
  $('#tcStatHalf').textContent=allMonth.filter(s=>s.shift_type!=='full_day').length;
  $('#tcStatCost').textContent=money(allMonth.reduce((sum,s)=>sum+Number(s.cost_amount||tcRate(s.shift_type)),0));
  const body=$('#takecareShiftRows'),empty=$('#takecareShiftEmpty');
  body.innerHTML=filtered.map(s=>{
    const person=tcStaffById(s.takecare_id);
    return `<tr><td><b>${dateVN(s.work_date)}</b></td><td>${esc(person?.name||'Take Care đã ẩn')}</td><td><span class="tc-shift-pill">${TAKECARE_SHIFT_LABEL[s.shift_type]||esc(s.shift_type)}</span></td><td class="tc-cost">${money(s.cost_amount||tcRate(s.shift_type))}</td><td>${esc(s.note||'—')}</td><td><button class="tc-remove-shift" type="button" data-tc-shift-delete="${s.id}">Xóa</button></td></tr>`;
  }).join('');
  empty.hidden=!!filtered.length;
  $$('[data-tc-shift-delete]',body).forEach(btn=>btn.addEventListener('click',()=>deleteTakecareShift(btn.dataset.tcShiftDelete)));
  renderTakecarePersonSummary(allMonth);
}
function renderTakecarePersonSummary(shifts){
  const box=$('#takecarePersonSummary');if(!box)return;
  const ids=[...new Set(shifts.map(s=>String(s.takecare_id)))];
  box.innerHTML=ids.map(id=>{
    const person=tcStaffById(id),list=shifts.filter(s=>String(s.takecare_id)===id).sort((a,b)=>String(a.work_date).localeCompare(String(b.work_date))),total=list.reduce((sum,s)=>sum+Number(s.cost_amount||tcRate(s.shift_type)),0);
    const dates=list.map(s=>`<span>${dateVN(s.work_date)} · ${TAKECARE_SHIFT_LABEL[s.shift_type]||s.shift_type}</span>`).join('');
    return `<article class="takecare-person-card"><header><div><b>${esc(person?.name||'Take Care đã ẩn')}</b><p>${list.length} ca trong tháng</p></div><strong>${money(total)}</strong></header><div class="takecare-date-tags">${dates}</div></article>`;
  }).join('')||'<div class="empty">Chưa có Take Care làm trong tháng này.</div>';
}
async function deleteTakecareShift(id){
  const shift=takecareShifts.find(s=>String(s.id)===String(id));if(!shift)return;
  if(!confirm(`Xóa lịch ${dateVN(shift.work_date)} của ${tcStaffById(shift.takecare_id)?.name||'Take Care'}?`))return;
  try{
    if(demoMode){takecareShifts=takecareShifts.filter(s=>String(s.id)!==String(id));localStorage.setItem('cheese_demo_takecare_shifts_v1',JSON.stringify(takecareShifts));renderTakecare();return}
    const {error}=await db.from('takecare_shifts').delete().eq('id',id);if(error)throw error;await loadAll();switchView('takecare');
  }catch(err){alert('Không xóa được lịch Take Care: '+err.message)}
}
$('#takecareMonthFilter')?.addEventListener('change',()=>{renderTakecareStaff();renderTakecareSchedule()});
$('#takecareStaffFilter')?.addEventListener('change',renderTakecareSchedule);

// ============================================================
// PRICING CMS — đồng bộ bang-gia.html + lien-he.html
let pricingTeamRows=[];
let pricingProvinceRows=[];

function pricingClone(v){return JSON.parse(JSON.stringify(v||{}))}
function pricingRowsFromSettings(){
  pricingTeamRows=pricingClone(pricingSettings.teamBasePrices||[]);
  const details=pricingSettings.provinceDetails||{};
  pricingProvinceRows=[];
  (pricingSettings.provinceGroups||[]).forEach(group=>{
    (group.items||[]).forEach(([name,fee])=>pricingProvinceRows.push({group:group.label||'',name:name||'',fee:fee||'',note:details[name]||'Tính theo 1 thợ.'}));
  });
}
function renderPricingSettings(){
  const root=$('#teamPriceEditor');if(!root)return;
  pricingRowsFromSettings();
  const reference=$('#pricingReferencePrice');if(reference)reference.value=Number(pricingSettings.referencePriceFrom||1500000);
  renderTeamPriceEditor();renderProvincePriceEditor();
  const label=$('#pricingSyncLabel');if(label)label.textContent=demoMode?'Bảng giá demo lưu trên trình duyệt.':'Bảng giá đang đồng bộ với Supabase.';
}
function renderTeamPriceEditor(){
  const box=$('#teamPriceEditor');if(!box)return;
  box.innerHTML=pricingTeamRows.map((r,i)=>`<div class="pricing-team-row" data-team-row="${i}">
    <label><span>Tên hạng</span><input data-team-field="label" value="${esc(r.label||'')}"></label>
    <label><span>Giá từ</span><input data-team-field="priceFrom" type="number" min="0" step="50000" value="${Number(r.priceFrom||0)}"></label>
    <label><span>Mô tả</span><textarea data-team-field="description">${esc(r.description||'')}</textarea></label>
    <label><span>Ekip liên kết</span><input data-team-field="teams" value="${esc((r.teams||[]).join(', '))}" placeholder="Founder, Ekip 1"></label>
    <button class="pricing-row-remove" type="button" data-team-remove="${i}" aria-label="Xóa">×</button>
  </div>`).join('')||'<div class="empty">Chưa có hạng ekip.</div>';
  $$('[data-team-field]',box).forEach(el=>el.addEventListener('input',()=>{const row=Number(el.closest('[data-team-row]').dataset.teamRow),field=el.dataset.teamField;if(field==='priceFrom')pricingTeamRows[row][field]=Number(el.value||0);else if(field==='teams')pricingTeamRows[row][field]=el.value.split(',').map(x=>x.trim()).filter(Boolean);else pricingTeamRows[row][field]=el.value;}));
  $$('[data-team-remove]',box).forEach(btn=>btn.addEventListener('click',()=>{pricingTeamRows.splice(Number(btn.dataset.teamRemove),1);renderTeamPriceEditor()}));
}
function renderProvincePriceEditor(){
  const box=$('#provincePriceEditor');if(!box)return;
  box.innerHTML=pricingProvinceRows.map((r,i)=>`<div class="pricing-province-row" data-province-row="${i}">
    <label><span>Nhóm vùng</span><input data-province-field="group" value="${esc(r.group||'')}"></label>
    <label><span>Tỉnh / khu vực</span><input data-province-field="name" value="${esc(r.name||'')}"></label>
    <label><span>Phụ phí / 1 thợ</span><input data-province-field="fee" value="${esc(r.fee||'')}" placeholder="500.000đ"></label>
    <label><span>Ghi chú</span><textarea data-province-field="note">${esc(r.note||'')}</textarea></label>
    <button class="pricing-row-remove" type="button" data-province-remove="${i}" aria-label="Xóa">×</button>
  </div>`).join('')||'<div class="empty">Chưa có khu vực.</div>';
  $$('[data-province-field]',box).forEach(el=>el.addEventListener('input',()=>{const row=Number(el.closest('[data-province-row]').dataset.provinceRow);pricingProvinceRows[row][el.dataset.provinceField]=el.value;}));
  $$('[data-province-remove]',box).forEach(btn=>btn.addEventListener('click',()=>{pricingProvinceRows.splice(Number(btn.dataset.provinceRemove),1);renderProvincePriceEditor()}));
}
$('#addTeamPrice')?.addEventListener('click',()=>{pricingTeamRows.push({id:'custom-'+Date.now(),label:'Hạng mới',priceFrom:1500000,description:'',teams:[]});renderTeamPriceEditor()});
$('#addProvincePrice')?.addEventListener('click',()=>{pricingProvinceRows.push({group:'Miền Bắc',name:'Khu vực mới',fee:'Liên hệ',note:'Tính theo 1 thợ.'});renderProvincePriceEditor();const rows=$$('.pricing-province-row');rows[rows.length-1]?.querySelector('input')?.focus()});

function collectPricingPayload(){
  const groups=[];const groupMap=new Map();const details={};
  pricingProvinceRows.forEach(row=>{
    const group=String(row.group||'Khu vực khác').trim()||'Khu vực khác';
    const name=String(row.name||'').trim();if(!name)return;
    const fee=String(row.fee||'Liên hệ').trim()||'Liên hệ';
    if(!groupMap.has(group)){const g={label:group,items:[]};groupMap.set(group,g);groups.push(g)}
    groupMap.get(group).items.push([name,fee]);details[name]=String(row.note||'').trim()||'Tính theo 1 thợ.';
  });
  const teams=pricingTeamRows.map((r,i)=>({id:String(r.id||`team-${i+1}`),label:String(r.label||'').trim()||`Hạng ${i+1}`,priceFrom:Number(r.priceFrom||0),description:String(r.description||'').trim(),teams:Array.isArray(r.teams)?r.teams:[]}));
  return {referencePriceFrom:Number($('#pricingReferencePrice')?.value||1500000),teamBasePrices:teams,provinceGroups:groups,provinceDetails:details};
}
$('#savePricingSettings')?.addEventListener('click',async()=>{
  const btn=$('#savePricingSettings'),old=btn.textContent;btn.disabled=true;btn.textContent='Đang lưu...';
  try{
    const payload=collectPricingPayload();
    if(demoMode){localStorage.setItem('cheese_demo_pricing_v1',JSON.stringify(payload));pricingSettings=payload;}
    else{
      const row={id:'main',reference_price_from:payload.referencePriceFrom,team_prices:payload.teamBasePrices,province_groups:payload.provinceGroups,province_details:payload.provinceDetails,takecare_full_day_rate:Number(pricingSettings.takecareFullDayRate||400000),takecare_half_day_rate:Number(pricingSettings.takecareHalfDayRate||250000),updated_at:new Date().toISOString()};
      const {error}=await db.from('site_pricing').upsert(row,{onConflict:'id'});if(error)throw error;
      pricingSettings=payload;
    }
    renderPricingSettings();
    alert('Đã lưu bảng giá và phụ phí. Trang Bảng giá + trang Đặt lịch sẽ dùng dữ liệu mới.');
  }catch(err){const msg=String(err.message||'');if(/site_pricing|schema cache|Could not find the table/i.test(msg))alert('Supabase chưa có bảng site_pricing. Hãy chạy file SUPABASE-PATCH-PRICING-TAKECARE.sql một lần trong Supabase → SQL Editor, sau đó tải lại Admin.');else alert('Không lưu được bảng giá: '+msg);}
  finally{btn.disabled=false;btn.textContent=old}
});

// ============================================================
let editorGallery=[];
let editorPhotos=['','','','',''];
let editorPhotoFiles=[null,null,null,null,null];
let editorServices=[];
const photographerModal=$('#photographerEditorModal');
const photographerForm=$('#photographerEditorForm');
const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const photographerPriceText=p=>String(p.price_label||'').trim()||(Number(p.price_amount||0)>0?money(p.price_amount):'Liên hệ');

function renderPhotographers(){
  const grid=$('#photographerAdminGrid');if(!grid)return;
  const rows=[...photographers].sort((a,b)=>(a.sort_order||100)-(b.sort_order||100));
  grid.innerHTML=rows.map(p=>`<article class="photographer-admin-card">
    <div class="photographer-admin-cover" style="${p.cover_url?`background-image:url('${esc(p.cover_url)}')`:''}"><span class="photographer-admin-status ${p.active===false?'off':''}">${p.active===false?'Đang ẩn':'Đang hiện'}</span></div>
    <div class="photographer-admin-body"><h3>${esc(p.name)}</h3><div class="photographer-admin-meta">${esc(p.team||'Chưa chia ekip')} · ${esc(p.style||'Chưa có phong cách')}</div><div class="photographer-admin-profilemeta"><span>${esc(p.location_text||'Hà Nội')}</span><span>${Math.min(5,(p.cover_url?1:0)+(p.gallery_urls||[]).length)} ảnh hồ sơ</span><span>${p.drive_url?'Có Drive':'Chưa có Drive'}</span></div><div class="photographer-admin-thumbs">${[p.cover_url,...(p.gallery_urls||[])].slice(0,5).concat(Array(5).fill('')).slice(0,5).map(u=>u?`<img src="${esc(u)}" alt="">`:'<span></span>').join('')}</div><div class="photographer-admin-tags">${(p.tags||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="photographer-admin-price"><small>Giá từ</small><strong>${esc(photographerPriceText(p))}</strong></div><button class="photographer-edit-btn" type="button" data-photographer-id="${p.id}">Sửa nội dung khách thấy</button></div>
  </article>`).join('');
  $('#photographerAdminEmpty').hidden=!!rows.length;
  $$('[data-photographer-id]',grid).forEach(btn=>btn.addEventListener('click',()=>openPhotographerEditor(btn.dataset.photographerId)));
}
function normalizeEditorPhotos(){
  const values=editorPhotos.filter((u,i)=>String(u||'').trim() || editorPhotoFiles[i]);
  const files=editorPhotoFiles.filter((f,i)=>String(editorPhotos[i]||'').trim() || f);
  editorPhotos=[...values,'','','','',''].slice(0,5);
  editorPhotoFiles=[...files,null,null,null,null,null].slice(0,5);
}

const PHOTO_MAX_SOURCE_BYTES=50*1024*1024;
const PHOTO_DIRECT_BYTES=4.5*1024*1024;
const PHOTO_MAX_DIMENSION=2800;
const PHOTO_OUTPUT_QUALITY=.86;
const PHOTO_UPLOAD_HARD_LIMIT=12*1024*1024;

function formatFileSize(bytes){
  const n=Number(bytes||0);
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

async function decodePhotographerImage(file){
  if('createImageBitmap' in window){
    try{return await createImageBitmap(file,{imageOrientation:'from-image'})}
    catch(_){}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Không đọc được file ảnh này. Hãy thử JPG, PNG hoặc WEBP.'))};
    img.src=url;
  });
}

async function canvasToBlob(canvas,type,quality){
  return await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

async function optimizePhotographerImage(file){
  if(!file || !String(file.type||'').startsWith('image/'))throw new Error('File đã chọn không phải ảnh.');
  if(file.size>PHOTO_MAX_SOURCE_BYTES)throw new Error(`Ảnh ${file.name} quá lớn (${formatFileSize(file.size)}). Hãy chọn ảnh nhỏ hơn 50 MB.`);

  const image=await decodePhotographerImage(file);
  const width=Number(image.width||image.naturalWidth||0);
  const height=Number(image.height||image.naturalHeight||0);
  if(!width||!height){
    if(typeof image.close==='function')image.close();
    throw new Error('Không xác định được kích thước ảnh.');
  }

  const longest=Math.max(width,height);
  const needsResize=longest>PHOTO_MAX_DIMENSION;
  const needsCompress=file.size>PHOTO_DIRECT_BYTES;

  if(!needsResize && !needsCompress){
    if(typeof image.close==='function')image.close();
    return {file,optimized:false,originalSize:file.size,width,height};
  }

  let scale=Math.min(1,PHOTO_MAX_DIMENSION/longest);
  let targetW=Math.max(1,Math.round(width*scale));
  let targetH=Math.max(1,Math.round(height*scale));
  let blob=null;
  let quality=PHOTO_OUTPUT_QUALITY;

  for(let attempt=0;attempt<4;attempt++){
    const canvas=document.createElement('canvas');
    canvas.width=targetW;canvas.height=targetH;
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx){
      if(typeof image.close==='function')image.close();
      throw new Error('Trình duyệt không thể xử lý ảnh này.');
    }
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,0,0,targetW,targetH);
    blob=await canvasToBlob(canvas,'image/webp',quality);
    canvas.width=1;canvas.height=1;
    if(blob && blob.size<=PHOTO_DIRECT_BYTES)break;
    targetW=Math.max(1200,Math.round(targetW*.84));
    targetH=Math.max(1200,Math.round(targetH*.84));
    quality=Math.max(.72,quality-.05);
  }

  if(typeof image.close==='function')image.close();
  if(!blob)throw new Error('Không thể tối ưu ảnh. Hãy thử đổi ảnh sang JPG hoặc WEBP.');

  const base=(file.name||'photo').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'photo';
  const optimized=new File([blob],`${base}.webp`,{type:'image/webp',lastModified:Date.now()});
  if(optimized.size>PHOTO_UPLOAD_HARD_LIMIT){
    throw new Error(`Ảnh sau tối ưu vẫn còn ${formatFileSize(optimized.size)}. Hãy dùng ảnh có kích thước nhỏ hơn.`);
  }
  return {file:optimized,optimized:true,originalSize:file.size,width:targetW,height:targetH};
}

function renderEditorGallery(){
  const box=$('#photographerPhotoSlots');if(!box)return;
  editorPhotos=[...editorPhotos,'','','','',''].slice(0,5);
  editorPhotoFiles=[...editorPhotoFiles,null,null,null,null,null].slice(0,5);
  box.innerHTML=editorPhotos.map((url,i)=>{
    const file=editorPhotoFiles[i];
    const preview=file?URL.createObjectURL(file):String(url||'').trim();
    return `<div class="photographer-photo-slot ${i===0?'is-main':''}" data-photo-slot="${i}">
      <div class="photographer-photo-slot-head"><b>Ảnh ${i+1}</b><span>${i===0?'Ảnh chính':'Ảnh vuốt'}</span></div>
      <div class="photographer-photo-preview ${preview?'has-image':''}" data-photo-preview="${i}" style="${preview?`background-image:url('${esc(preview)}')`:''}">${preview?'':'Chưa có ảnh'}</div>
      <input class="photographer-photo-url" data-photo-url="${i}" value="${esc(url||'')}" placeholder="Dán URL ảnh">
      <div class="photographer-photo-actions">
        <label class="photographer-photo-pick">${preview?'Thay ảnh':'Chọn ảnh'}<input data-photo-file="${i}" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
        <button class="photographer-photo-remove" data-photo-remove="${i}" type="button" title="Xóa ảnh">×</button>
      </div>
      <div class="photographer-photo-order"><button data-photo-left="${i}" type="button" ${i===0?'disabled':''}>←</button><button data-photo-right="${i}" type="button" ${i===4?'disabled':''}>→</button></div>
    </div>`;
  }).join('');
  const count=editorPhotos.reduce((n,u,i)=>n+(String(u||'').trim()||editorPhotoFiles[i]?1:0),0);
  const counter=$('#photographerPhotoCounter');if(counter)counter.innerHTML=`Đang có <b>${count} / 5</b> ảnh. Ảnh 1 là ảnh chính. Sau khi chọn ảnh từ máy, bấm <b>Lưu thay đổi</b> để upload.`;
  $$('[data-photo-url]',box).forEach(el=>el.addEventListener('input',()=>{const i=Number(el.dataset.photoUrl);editorPhotos[i]=el.value.trim();editorPhotoFiles[i]=null;const prev=box.querySelector(`[data-photo-preview="${i}"]`);if(prev){prev.style.backgroundImage=editorPhotos[i]?`url("${editorPhotos[i].replace(/"/g,'%22')}")`:'';prev.textContent=editorPhotos[i]?'':'Chưa có ảnh';prev.classList.toggle('has-image',!!editorPhotos[i])}}));
  $$('[data-photo-file]',box).forEach(el=>el.addEventListener('change',async()=>{
    const i=Number(el.dataset.photoFile),source=el.files?.[0];if(!source)return;
    const pick=el.closest('.photographer-photo-pick');
    const counter=$('#photographerPhotoCounter');
    if(pick){pick.classList.add('is-processing');pick.childNodes[0].nodeValue='Đang tối ưu...'}
    el.disabled=true;
    try{
      const result=await optimizePhotographerImage(source);
      editorPhotoFiles[i]=result.file;
      const prev=box.querySelector(`[data-photo-preview="${i}"]`);
      const u=URL.createObjectURL(result.file);
      prev.style.backgroundImage=`url("${u}")`;prev.textContent='';prev.classList.add('has-image');
      if(pick)pick.childNodes[0].nodeValue='Thay ảnh';
      const count=editorPhotos.reduce((n,u,j)=>n+(String(u||'').trim()||editorPhotoFiles[j]?1:0),0);
      if(counter){
        const sizeText=result.optimized
          ? `Đã tự tối ưu <b>${formatFileSize(result.originalSize)} → ${formatFileSize(result.file.size)}</b>.`
          : `Dung lượng ảnh <b>${formatFileSize(result.file.size)}</b>.`;
        counter.innerHTML=`Đang có <b>${count} / 5</b> ảnh. ${sizeText} Bấm <b>Lưu thay đổi</b> để upload.`;
      }
    }catch(err){
      editorPhotoFiles[i]=null;el.value='';
      if(pick)pick.childNodes[0].nodeValue=editorPhotos[i]?'Thay ảnh':'Chọn ảnh';
      alert('Không dùng được ảnh này: '+err.message);
    }finally{
      el.disabled=false;if(pick)pick.classList.remove('is-processing');
    }
  }));
  $$('[data-photo-remove]',box).forEach(el=>el.addEventListener('click',()=>{const i=Number(el.dataset.photoRemove);editorPhotos[i]='';editorPhotoFiles[i]=null;normalizeEditorPhotos();renderEditorGallery()}));
  $$('[data-photo-left]',box).forEach(el=>el.addEventListener('click',()=>{const i=Number(el.dataset.photoLeft);if(i<1)return;[editorPhotos[i-1],editorPhotos[i]]=[editorPhotos[i],editorPhotos[i-1]];[editorPhotoFiles[i-1],editorPhotoFiles[i]]=[editorPhotoFiles[i],editorPhotoFiles[i-1]];renderEditorGallery()}));
  $$('[data-photo-right]',box).forEach(el=>el.addEventListener('click',()=>{const i=Number(el.dataset.photoRight);if(i>3)return;[editorPhotos[i+1],editorPhotos[i]]=[editorPhotos[i],editorPhotos[i+1]];[editorPhotoFiles[i+1],editorPhotoFiles[i]]=[editorPhotoFiles[i],editorPhotoFiles[i+1]];renderEditorGallery()}));
}

function normalizedServices(value){
  if(!Array.isArray(value)||!value.length)return DEFAULT_SERVICES.map(x=>({...x}));
  return value.map(x=>typeof x==='string'?{name:x,value:'Cần xác nhận'}:{name:String(x?.name||''),value:String(x?.value||'Cần xác nhận')}).filter(x=>x.name);
}
function renderEditorServices(){
  const box=$('#photographerServicesEditor');if(!box)return;
  box.innerHTML=editorServices.map((item,i)=>`<div class="photographer-service-row" data-service-row="${i}">
    <label><span>Tên dịch vụ</span><input data-service-name="${i}" value="${esc(item.name)}" placeholder="VD: Trợ lý đi cùng"></label>
    <label><span>Nhãn / giá</span><input data-service-value="${i}" value="${esc(item.value||'')}" placeholder="VD: Miễn phí / +300.000đ"></label>
    <button class="photographer-service-remove" type="button" data-service-remove="${i}" aria-label="Xóa dịch vụ">×</button>
  </div>`).join('')||'<div class="empty">Chưa có dịch vụ đi kèm.</div>';
  $$('[data-service-name]',box).forEach(el=>el.addEventListener('input',()=>{editorServices[Number(el.dataset.serviceName)].name=el.value}));
  $$('[data-service-value]',box).forEach(el=>el.addEventListener('input',()=>{editorServices[Number(el.dataset.serviceValue)].value=el.value}));
  $$('[data-service-remove]',box).forEach(el=>el.addEventListener('click',()=>{editorServices.splice(Number(el.dataset.serviceRemove),1);renderEditorServices()}));
}
$('#addPhotographerService')?.addEventListener('click',()=>{editorServices.push({name:'',value:'Cần xác nhận'});renderEditorServices();const rows=$$('.photographer-service-row');rows[rows.length-1]?.querySelector('input')?.focus()});

function openPhotographerEditor(id=null){
  const item=id?photographers.find(p=>String(p.id)===String(id)):null;
  photographerForm.reset();
  $('#photographerEditorId').value=item?.id||'';
  $('#photographerName').value=item?.name||'';
  $('#photographerSlug').value=item?.slug||'';
  $('#photographerSlug').readOnly=!!item;
  $('#photographerTeam').value=item?.team||'';
  $('#photographerLocation').value=item?.location_text||'Hà Nội';
  $('#photographerPrice').value=Number(item?.price_amount||0)||'';
  $('#photographerPriceLabel').value=item?.price_label||'';
  const yb=item?.yearbook_prices||{};
  const fallbackBase=Number(item?.price_amount||0);
  for(let n=1;n<=5;n++)$('#yearbookPrice'+n).value=Number(yb[String(n)]??(fallbackBase?fallbackBase+(n-1)*300000:0))||'';
  const gp=item?.graduation_prices||{};
  $('#graduationPriceCeremony').value=Number(gp.ceremony??1700000)||'';
  $('#graduationPricePregrad').value=Number(gp.pregrad??2000000)||'';
  $('#graduationPricePregradPlus').value=Number(gp['pregrad-plus']??2500000)||'';
  $('#graduationExtraPerPerson').value=Number(item?.graduation_extra_per_person??300000)||0;
  editorServices=normalizedServices(item?.services);renderEditorServices();
  $('#photographerStyle').value=item?.style||'';
  $('#photographerTags').value=(item?.tags||[]).join(', ');
  $('#photographerBio').value=item?.bio||'';
  $('#photographerDriveUrl').value=item?.drive_url||'';
  $('#photographerRating').value=item?.rating??'';
  $('#photographerShoots').value=Number(item?.shoots_count||0);
  $('#photographerSort').value=Number(item?.sort_order||100);
  $('#photographerActive').checked=item?item.active!==false:true;
  editorPhotos=[item?.cover_url||'',...(item?.gallery_urls||[]).slice(0,4)];
  editorPhotos=[...editorPhotos,'','','','',''].slice(0,5);
  editorPhotoFiles=[null,null,null,null,null];
  editorGallery=editorPhotos.slice(1).filter(Boolean);
  renderEditorGallery();
  $('#photographerEditorTitle').textContent=item?`Sửa ${item.name}`:'Thêm photographer';
  $('#deletePhotographer').hidden=!item;
  photographerModal.classList.add('open');photographerModal.setAttribute('aria-hidden','false');
}
function closePhotographerEditor(){photographerModal.classList.remove('open');photographerModal.setAttribute('aria-hidden','true')}
$('#addPhotographer')?.addEventListener('click',()=>openPhotographerEditor());
$$('[data-photographer-close]').forEach(x=>x.addEventListener('click',closePhotographerEditor));
$('#photographerName')?.addEventListener('input',()=>{if(!$('#photographerEditorId').value)$('#photographerSlug').value=slugify($('#photographerName').value)});

async function uploadPhotographerImage(file,slug,kind='gallery'){
  let uploadFile=file;
  if(file.size>PHOTO_UPLOAD_HARD_LIMIT || file.size>PHOTO_DIRECT_BYTES){
    uploadFile=(await optimizePhotographerImage(file)).file;
  }
  if(uploadFile.size>PHOTO_UPLOAD_HARD_LIMIT){
    throw new Error(`Ảnh còn quá lớn (${formatFileSize(uploadFile.size)}). Giới hạn an toàn hiện tại là ${formatFileSize(PHOTO_UPLOAD_HARD_LIMIT)}.`);
  }
  const ext=(uploadFile.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')||'webp';
  const path=`${slug}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const {error}=await db.storage.from('photographers').upload(path,uploadFile,{contentType:uploadFile.type||undefined,upsert:false});
  if(error){
    const msg=String(error.message||'');
    if(/maximum allowed size|too large|entity too large/i.test(msg)){
      throw new Error(`Ảnh vượt giới hạn Supabase. Ảnh đang upload: ${formatFileSize(uploadFile.size)}. Hãy kiểm tra Storage → photographers → Edit bucket → File size limit.`);
    }
    throw error;
  }
  return db.storage.from('photographers').getPublicUrl(path).data.publicUrl;
}

photographerForm?.addEventListener('submit',async e=>{
  e.preventDefault();if(!photographerForm.reportValidity())return;
  const id=$('#photographerEditorId').value;
  const slug=slugify($('#photographerSlug').value||$('#photographerName').value);
  const payload={
    slug,name:$('#photographerName').value.trim(),team:$('#photographerTeam').value.trim()||null,
    location_text:$('#photographerLocation').value.trim()||'Hà Nội',
    drive_url:$('#photographerDriveUrl').value.trim()||null,
    price_amount:Number($('#yearbookPrice1').value||$('#photographerPrice').value||0),price_label:$('#photographerPriceLabel').value.trim()||null,
    yearbook_prices:{'1':Number($('#yearbookPrice1').value||0),'2':Number($('#yearbookPrice2').value||0),'3':Number($('#yearbookPrice3').value||0),'4':Number($('#yearbookPrice4').value||0),'5':Number($('#yearbookPrice5').value||0)},
    graduation_prices:{ceremony:Number($('#graduationPriceCeremony').value||0),pregrad:Number($('#graduationPricePregrad').value||0),'pregrad-plus':Number($('#graduationPricePregradPlus').value||0)},
    graduation_extra_per_person:Number($('#graduationExtraPerPerson').value||0),
    services:editorServices.map(x=>({name:String(x.name||'').trim(),value:String(x.value||'').trim()||'Cần xác nhận'})).filter(x=>x.name),
    style:$('#photographerStyle').value.trim()||null,bio:$('#photographerBio').value.trim()||null,
    tags:$('#photographerTags').value.split(',').map(x=>x.trim()).filter(Boolean),
    rating:$('#photographerRating').value===''?null:Number($('#photographerRating').value),shoots_count:Number($('#photographerShoots').value||0),sort_order:Number($('#photographerSort').value||100),
    active:$('#photographerActive').checked,cover_url:null,gallery_urls:[]
  };
  const save=$('#savePhotographer'),old=save.textContent;save.disabled=true;save.textContent='Đang lưu...';
  try{
    const resolved=[];
    for(let i=0;i<5;i++){
      if(editorPhotoFiles[i]){
        resolved[i]=demoMode?URL.createObjectURL(editorPhotoFiles[i]):await uploadPhotographerImage(editorPhotoFiles[i],slug,i===0?'cover':`gallery-${i+1}`);
      }else resolved[i]=String(editorPhotos[i]||'').trim();
    }
    const compact=resolved.filter(Boolean).slice(0,5);
    payload.cover_url=compact[0]||null;
    payload.gallery_urls=compact.slice(1,5);
    if(demoMode){
      if(id)photographers=photographers.map(p=>String(p.id)===String(id)?{...p,...payload}:p);else photographers.push({id:'demo-'+Date.now(),created_at:new Date().toISOString(),...payload});
      localStorage.setItem('cheese_demo_photographers_v2',JSON.stringify(photographers));
    }else{
      let result=id?await db.from('photographers').update(payload).eq('id',id):await db.from('photographers').insert(payload);if(result.error)throw result.error;
    }
    closePhotographerEditor();await loadAll();switchView('photographers');
  }catch(err){alert('Không lưu được photographer: '+err.message)}finally{save.disabled=false;save.textContent=old}
});

$('#deletePhotographer')?.addEventListener('click',async()=>{
  const id=$('#photographerEditorId').value;if(!id)return;
  const p=photographers.find(x=>String(x.id)===String(id));if(!confirm(`Xóa ${p?.name||'photographer'}? Nếu thợ đã có booking, Supabase sẽ không cho xóa để bảo toàn lịch sử.`))return;
  try{
    if(demoMode){photographers=photographers.filter(x=>String(x.id)!==String(id));localStorage.setItem('cheese_demo_photographers_v2',JSON.stringify(photographers))}
    else{const {error}=await db.from('photographers').delete().eq('id',id);if(error)throw error}
    closePhotographerEditor();await loadAll();
  }catch(err){alert('Không thể xóa thợ này vì có thể đang liên kết với booking/lịch. Hãy bỏ chọn “Hiển thị photographer trên website” để ẩn thợ thay vì xóa.\n\n'+err.message)}
});
function notificationLabel(b){
  return `${b.customer_name || 'Khách mới'} · ${b.photographer || 'Photographer'} · ${dateVN(b.shoot_date)} ${b.time_slot || ''}`;
}

function renderNotificationCenter(){
  const badge=$('#notificationBadge'), list=$('#notifyList');
  if(!badge||!list)return;
  badge.hidden=unreadNotifications.length===0;
  badge.textContent=unreadNotifications.length>99?'99+':String(unreadNotifications.length);
  if(!unreadNotifications.length){
    list.innerHTML='<div class="notify-empty">Chưa có thông báo mới.</div>';
    return;
  }
  list.innerHTML=unreadNotifications.map((b,i)=>`
    <div class="notify-item new" data-notify-id="${esc(b.id)}">
      <b>${esc(b.booking_code || 'Booking mới')}</b>
      <p>${esc(notificationLabel(b))}</p>
      <small>${esc(b.phone || '')}</small>
    </div>`).join('');
  $$('.notify-item[data-notify-id]',list).forEach(el=>el.addEventListener('click',()=>{
    $('#notifyPopover').classList.remove('open');
    switchView('bookings');
    openDrawer(el.dataset.notifyId);
  }));
}

function playBookingChime(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx(), now=ctx.currentTime;
    [659.25,783.99,987.77].forEach((freq,i)=>{
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='sine';osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.0001,now+i*.11);
      gain.gain.exponentialRampToValueAtTime(.08,now+i*.11+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,now+i*.11+.22);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(now+i*.11);osc.stop(now+i*.11+.24);
    });
    setTimeout(()=>ctx.close?.(),900);
  }catch(e){}
}

function showRealtimeToast(b){
  const stack=$('#realtimeToastStack');if(!stack)return;
  const toast=document.createElement('div');
  toast.className='realtime-toast';
  toast.innerHTML=`<b>🔔 BOOKING MỚI · ${esc(b.booking_code || '')}</b>
    <p>${esc(b.customer_name || '')} · ${esc(b.phone || '')}<br>${esc(b.photographer || '')} · ${dateVN(b.shoot_date)} · ${esc(b.time_slot || '')}</p>
    <button type="button">Mở booking</button>`;
  stack.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add('show'));
  toast.querySelector('button').addEventListener('click',()=>{
    switchView('bookings');openDrawer(b.id);toast.remove();
  });
  setTimeout(()=>{toast.classList.remove('show');setTimeout(()=>toast.remove(),300)},10000);
}

function browserNotify(b){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  try{
    const n=new Notification(`Booking mới · ${b.booking_code || 'Cheese.Graduation'}`,{
      body:`${notificationLabel(b)}\n${b.phone || ''}`,
      tag:`cheese-booking-${b.id || b.booking_code}`,
      renotify:true
    });
    n.onclick=()=>{window.focus();switchView('bookings');openDrawer(b.id);n.close()};
  }catch(e){}
}

async function handleRealtimeBooking(b){
  if(!b||!b.id)return;
  if(!bookings.some(x=>x.id===b.id))bookings.unshift(b);
  unreadNotifications.unshift(b);
  unreadNotifications=unreadNotifications.slice(0,50);
  renderAll();renderNotificationCenter();
  playBookingChime();showRealtimeToast(b);browserNotify(b);
}

function startRealtimeNotifications(){
  if(!db||notificationsStarted)return;
  notificationsStarted=true;
  realtimeChannel=db.channel('cheese-admin-bookings')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'bookings'},payload=>{
      handleRealtimeBooking(payload.new);
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED')$('#syncStatus').textContent='Realtime đang hoạt động';
      if(status==='CHANNEL_ERROR')$('#syncStatus').textContent='Realtime lỗi kết nối';
    });
}

$('#adminBell')?.addEventListener('click',()=>$('#notifyPopover').classList.toggle('open'));
$('#clearNotifications')?.addEventListener('click',()=>{
  unreadNotifications=[];renderNotificationCenter();$('#notifyPopover').classList.remove('open');
});
document.addEventListener('click',e=>{
  const pop=$('#notifyPopover'),bell=$('#adminBell');
  if(pop?.classList.contains('open')&&!pop.contains(e.target)&&!bell?.contains(e.target))pop.classList.remove('open');
});
$('#enableNotifications')?.addEventListener('click',async()=>{
  if(!('Notification'in window)){alert('Trình duyệt này không hỗ trợ thông báo hệ thống.');return}
  const permission=await Notification.requestPermission();
  $('#enableNotifications').textContent=permission==='granted'?'Thông báo đã bật':'Bật thông báo';
});
renderNotificationCenter();

})();
