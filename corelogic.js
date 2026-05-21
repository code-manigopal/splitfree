import { initializeApp }   from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                           from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const FB = {
  apiKey:"AIzaSyBHtdnCt4xtSuezt3p5vrTqMPEZRRIX2UQ",
  authDomain:"trip-expense-tracker-4bb2f.firebaseapp.com",
  projectId:"trip-expense-tracker-4bb2f",
  storageBucket:"trip-expense-tracker-4bb2f.firebasestorage.app",
  messagingSenderId:"585256105192",
  appId:"1:585256105192:web:ed2d38a97fe81d064c055d"
};

const CURRENCIES = [
  {code:"CAD",symbol:"$",name:"Canadian Dollar"},
  {code:"USD",symbol:"$",name:"US Dollar"},
  {code:"EUR",symbol:"€",name:"Euro"},
  {code:"GBP",symbol:"£",name:"British Pound"},
  {code:"INR",symbol:"₹",name:"Indian Rupee"},
  {code:"AUD",symbol:"$",name:"Australian Dollar"},
  {code:"NZD",symbol:"$",name:"New Zealand Dollar"},
  {code:"SGD",symbol:"$",name:"Singapore Dollar"},
  {code:"JPY",symbol:"¥",name:"Japanese Yen"},
  {code:"CNY",symbol:"¥",name:"Chinese Yuan"},
  {code:"CHF",symbol:"Fr",name:"Swiss Franc"},
  {code:"SEK",symbol:"kr",name:"Swedish Krona"},
  {code:"NOK",symbol:"kr",name:"Norwegian Krone"},
  {code:"DKK",symbol:"kr",name:"Danish Krone"},
  {code:"MXN",symbol:"$",name:"Mexican Peso"},
  {code:"BRL",symbol:"R$",name:"Brazilian Real"},
  {code:"ZAR",symbol:"R",name:"South African Rand"},
  {code:"AED",symbol:"د.إ",name:"UAE Dirham"},
  {code:"SAR",symbol:"﷼",name:"Saudi Riyal"},
  {code:"THB",symbol:"฿",name:"Thai Baht"},
  {code:"MYR",symbol:"RM",name:"Malaysian Ringgit"},
  {code:"IDR",symbol:"Rp",name:"Indonesian Rupiah"},
  {code:"PHP",symbol:"₱",name:"Philippine Peso"},
  {code:"KRW",symbol:"₩",name:"South Korean Won"},
  {code:"HKD",symbol:"$",name:"Hong Kong Dollar"},
  {code:"TWD",symbol:"NT$",name:"Taiwan Dollar"},
  {code:"TRY",symbol:"₺",name:"Turkish Lira"},
  {code:"PLN",symbol:"zł",name:"Polish Zloty"},
  {code:"CZK",symbol:"Kč",name:"Czech Koruna"},
  {code:"HUF",symbol:"Ft",name:"Hungarian Forint"},
];

const DEF_ACTS = [
  {name:"Shared (All)",icon:"🏕️"},{name:"Food & Drinks",icon:"🍽️"},
  {name:"Accommodation",icon:"🏠"},{name:"Transportation",icon:"🚗"},
  {name:"Activities",icon:"🎯"},{name:"Other",icon:"💰"}
];
const ICON = name => DEF_ACTS.find(a=>a.name===name)?.icon||"💰";

const fbApp=initializeApp(FB);
const auth=getAuth(fbApp);
const db=getFirestore(fbApp);
const provider=new GoogleAuthProvider();

let user=null,myTrips=[],unsubTrip=null;
let trip=null,members=[],expenses=[],activities=[],settlements=[];
let tab="dashboard",actFil="All",modal=null,showArchived=false;

const genId=()=>Math.random().toString(36).slice(2,10);
const tRef=id=>doc(db,"trips",id);
const subCol=(tid,col)=>collection(db,"trips",tid,col);
const subDoc=(tid,col,id)=>doc(db,"trips",tid,col,id);
const isAdmin=()=>trip?.createdBy===user?.email;
const getMe=()=>members.find(m=>m.email===user?.email);
const isPending=()=>!isAdmin()&&getMe()?.status==="pending";
const myName=()=>isAdmin()?(user.displayName||user.email):getMe()?.name||"";
const approvedNames=()=>{
  const n=members.filter(m=>m.status==="approved").map(m=>m.name);
  const adminName=trip?.adminName||"";
  if(adminName&&!n.includes(adminName))n.unshift(adminName);
  return n;
};
const shareUrl=id=>`${location.origin}${location.pathname}?trip=${id}`;
const tripIdFromUrl=()=>new URLSearchParams(location.search).get("trip");
const getCurrency=()=>CURRENCIES.find(c=>c.code===(trip?.currency||"CAD"))||CURRENCIES[0];
const fmt=amt=>`${getCurrency().symbol}${parseFloat(amt||0).toFixed(2)}`;
const fmtLabel=()=>getCurrency().code;

let _tid;
function toast(msg,type="success"){
  const t=document.getElementById("toast");
  clearTimeout(_tid);t.textContent=msg;t.className="show "+type;
  _tid=setTimeout(()=>t.className="",2800);
}

function showScreen(id){
  ["screen-loading","screen-signin","screen-pending","screen-home","screen-trip"]
    .forEach(s=>document.getElementById(s).classList.toggle("active",s===id));
}

function rAuthBar(){
  const bar=document.getElementById("auth-bar");
  if(!bar)return;
  bar.style.cssText="display:flex;align-items:center;gap:8px;flex-shrink:0;";
  if(user){
    bar.innerHTML=`<div class="user-chip"><img class="u-avatar" src="${user.photoURL||''}" onerror="this.style.display='none'"/><span>${(user.displayName||user.email).split(" ")[0]}</span></div><button class="btn btn-ghost btn-sm" id="b-signout">Sign out</button>`;
    document.getElementById("b-signout")?.addEventListener("click",()=>signOut(auth));
  } else {
    bar.innerHTML=`<button class="btn btn-primary btn-sm" id="b-in">Sign in</button>`;
    document.getElementById("b-in")?.addEventListener("click",doSignIn);
  }
}
function doSignIn(){signInWithPopup(auth,provider).catch(e=>{console.error(e);toast("Sign-in error: "+e.code,"error");});}

async function loadMyTrips(){
  // Always reset before loading — prevents duplication
  myTrips=[];
  const seen=new Set();
  const q1=query(collection(db,"trips"),where("createdBy","==",user.email));
  const s1=await getDocs(q1);
  s1.forEach(d=>{if(!seen.has(d.id)){seen.add(d.id);myTrips.push({id:d.id,...d.data()});}});
  const q2=query(collection(db,"trips"),where("memberEmails","array-contains",user.email));
  const s2=await getDocs(q2);
  s2.forEach(d=>{if(!seen.has(d.id)){seen.add(d.id);myTrips.push({id:d.id,...d.data()});}});
}

let _homeRendering=false;
async function renderHome(){
  if(_homeRendering)return;
  _homeRendering=true;
  try{ await _renderHome(); } finally{ _homeRendering=false; }
}

async function _renderHome(){
  rAuthBar();showScreen("screen-home");
  document.getElementById("home-greeting").textContent=`Welcome, ${(user.displayName||user.email).split(" ")[0]}`;
  // Clear grid immediately before async fetch — prevents stale renders showing
  document.getElementById("trips-grid").innerHTML=`<div class="loading">Loading your trips…</div>`;
  document.getElementById("archived-grid").innerHTML="";
  await loadMyTrips();
  const active=myTrips.filter(t=>!t.archived);
  const archived=myTrips.filter(t=>t.archived);
  const grid=document.getElementById("trips-grid");
  const btn=document.getElementById("b-toggle-archived");
  if(btn){
    btn.textContent=showArchived?"Hide Archived":`Show Archived (${archived.length})`;
    // Use onclick to avoid stacking addEventListener on each renderHome call
    btn.onclick=()=>{showArchived=!showArchived;renderHome();};
  }
  // Use onclick (not addEventListener) on persistent HTML buttons
  // to prevent stacking multiple listeners on repeated renderHome calls
  const createBtn=document.getElementById("b-create-trip");
  if(createBtn) createBtn.onclick=()=>showCreateModal();

  if(!active.length){
    grid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">✈️</div><p>No trips yet.<br>Create your first trip!</p></div>`;
  } else {
    grid.innerHTML=active.map(t=>tripCard(t)).join("");
    bindTripCards(grid);
  }

  const archSec=document.getElementById("archived-section");
  const archGrid=document.getElementById("archived-grid");
  if(showArchived&&archived.length){
    archSec.style.display="block";
    archGrid.innerHTML=archived.map(t=>tripCard(t)).join("");
    bindTripCards(archGrid);
  } else {
    archSec.style.display="none";
  }
}

}

function tripCard(t){
  const adm=t.createdBy===user.email;
  const me=(t.members||[]).find(m=>m.email===user.email);
  const role=adm?"admin":me?.status==="approved"?"member":"pending";
  const curr=CURRENCIES.find(c=>c.code===(t.currency||"CAD"))||CURRENCIES[0];
  return`<div class="trip-card${t.archived?" archived":""}" data-trip="${t.id}">
    <span class="trip-role role-${role}">${role}${t.archived?` <span class="archived-badge">archived</span>`:""}</span>
    <div class="trip-card-name">${t.name}</div>
    <div class="trip-card-dates">${[t.startDate,t.endDate].filter(Boolean).join(" → ")||"No dates set"} · ${curr.code}</div>
    <div class="trip-card-stats">
      <div class="trip-stat">Created <span>${t.createdAt?.slice(0,10)||"—"}</span></div>
      ${t.description?`<div class="trip-stat" style="color:var(--text3);font-style:italic;font-size:11px">${t.description}</div>`:""}
    </div>
    ${adm?`<div style="display:flex;gap:6px;margin-top:12px">
      ${t.archived
        ?`<button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-unarchive="${t.id}" onclick="event.stopPropagation()">↩ Unarchive</button>`
        :`<button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-archive="${t.id}" onclick="event.stopPropagation()">📦 Archive</button>`}
      <button class="btn btn-danger btn-sm" style="flex:1;justify-content:center" data-delete-trip="${t.id}" onclick="event.stopPropagation()">🗑 Delete</button>
    </div>`:""}
  </div>`;
}

function bindTripCards(grid){
  grid.querySelectorAll(".trip-card[data-trip]").forEach(c=>c.addEventListener("click",()=>openTrip(c.dataset.trip)));
  grid.querySelectorAll("[data-archive]").forEach(b=>b.addEventListener("click",async()=>{
    await updateDoc(tRef(b.dataset.archive),{archived:true});
    toast("Trip archived","info");renderHome();
  }));
  grid.querySelectorAll("[data-unarchive]").forEach(b=>b.addEventListener("click",async()=>{
    await updateDoc(tRef(b.dataset.unarchive),{archived:false});
    toast("Trip unarchived","success");renderHome();
  }));
  grid.querySelectorAll("[data-delete-trip]").forEach(b=>b.addEventListener("click",async()=>{
    const tid=b.dataset.deleteTrip;
    const tname=myTrips.find(t=>t.id===tid)?.name||"this trip";
    if(!confirm(`Delete "${tname}"? This cannot be undone.`))return;
    toast("Deleting…","info");
    for(const col of ["members","expenses","activities","settlements"]){
      const snap=await getDocs(collection(db,"trips",tid,col));
      const batch=writeBatch(db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();
    }
    await deleteDoc(tRef(tid));
    toast("Trip deleted","info");renderHome();
  }));
}

function goHome(){
  trip=null;members=[];expenses=[];activities=[];settlements=[];
  history.pushState({},"",location.pathname);
  renderHome();
}

function showCreateModal(){
  const today=new Date().toISOString().split("T")[0];
  const wrap=document.getElementById("home-modal");
  wrap.innerHTML=`<div class="overlay" id="ov-c">
    <div class="modal" style="max-width:480px">
      <div class="modal-hd">Create New Trip <button class="x-btn" id="bx">✕</button></div>
      <div class="form-grid">
        <div class="fg full"><label>Trip Name *</label><input id="ct-name" placeholder="e.g. Tobermory 2026"/></div>
        <div class="fg"><label>Start Date</label><input id="ct-s" type="date" value="${today}"/></div>
        <div class="fg"><label>End Date</label><input id="ct-e" type="date"/></div>
        <div class="fg full"><label>Currency *</label>
          <select id="ct-curr">
            ${CURRENCIES.map(c=>`<option value="${c.code}"${c.code==="CAD"?" selected":""}>${c.code} — ${c.name} (${c.symbol})</option>`).join("")}
          </select>
        </div>
        <div class="fg full"><label>Description (optional)</label><input id="ct-d" placeholder="e.g. Bruce Peninsula camping trip"/></div>
        <div class="fg full"><button class="btn btn-primary" id="b-do-c" style="width:100%;padding:10px;justify-content:center">Create Trip &amp; Get Link</button></div>
      </div>
    </div>
  </div>`;
  document.getElementById("bx")?.addEventListener("click",()=>wrap.innerHTML="");
  document.getElementById("ov-c")?.addEventListener("click",e=>{if(e.target.id==="ov-c")wrap.innerHTML="";});
  document.getElementById("b-do-c")?.addEventListener("click",async()=>{
    const name=document.getElementById("ct-name").value.trim();
    if(!name){toast("Enter a trip name","error");return;}
    const id=genId();
    const currency=document.getElementById("ct-curr").value;
    await setDoc(tRef(id),{
      id,name,currency,
      startDate:document.getElementById("ct-s").value,
      endDate:document.getElementById("ct-e").value,
      description:document.getElementById("ct-d").value.trim(),
      createdBy:user.email,adminName:user.displayName||user.email,
      adminPhoto:user.photoURL||"",
      createdAt:new Date().toISOString(),memberEmails:[],archived:false
    });
    const batch=writeBatch(db);
    DEF_ACTS.forEach(a=>{const aRef=doc(subCol(id,"activities"));batch.set(aRef,{name:a.name,icon:a.icon,createdAt:new Date().toISOString()});});
    await batch.commit();
    wrap.innerHTML="";toast("Trip created!","success");openTrip(id);
  });
}

async function openTrip(tripId){
  const snap=await getDoc(tRef(tripId));
  if(!snap.exists()){toast("Trip not found","error");return;}
  trip={id:tripId,...snap.data()};
  await loadSubCollections(tripId);
  if(!isAdmin()){
    const exists=members.find(m=>m.email===user.email);
    if(!exists){
      const nm={id:genId(),name:user.displayName||user.email,email:user.email,photo:user.photoURL||"",status:"pending",joined:new Date().toISOString()};
      await setDoc(doc(subCol(tripId,"members"),nm.id),nm);
      const te=[...(trip.memberEmails||[])];
      if(!te.includes(user.email))te.push(user.email);
      await updateDoc(tRef(tripId),{memberEmails:te});
      members.push(nm);trip.memberEmails=te;
    }
  }
  if(isPending()){
    showScreen("screen-pending");rAuthBar();
    const msg=document.getElementById("pending-msg");
    if(msg)msg.innerHTML=`You have joined <strong>${trip.name}</strong>. The trip organiser will approve you shortly.`;
    document.getElementById("b-out-pending")?.addEventListener("click",()=>signOut(auth));
    startListener(tripId);return;
  }
  tab="dashboard";actFil="All";modal=null;
  renderTrip();startListener(tripId);
}

async function loadSubCollections(tripId){
  const [mS,eS,aS,sS]=await Promise.all([
    getDocs(subCol(tripId,"members")),getDocs(subCol(tripId,"expenses")),
    getDocs(subCol(tripId,"activities")),getDocs(subCol(tripId,"settlements"))
  ]);
  members=mS.docs.map(d=>({id:d.id,...d.data()}));
  expenses=eS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  activities=aS.docs.map(d=>({id:d.id,...d.data()}));
  settlements=sS.docs.map(d=>({id:d.id,...d.data()}));
  if(!activities.length)activities=DEF_ACTS.map(a=>({id:genId(),...a}));
}

function startListener(tripId){
  stopListener();
  const us=[];
  // Guard: if trip is null (user navigated away), skip render
  us.push(onSnapshot(subCol(tripId,"members"),snap=>{
    if(!trip||trip.id!==tripId)return;
    members=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!isPending())renderTrip();else{showScreen("screen-pending");rAuthBar();}
  }));
  us.push(onSnapshot(subCol(tripId,"expenses"),snap=>{
    if(!trip||trip.id!==tripId)return;
    expenses=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    if(!isPending())renderTrip();
  }));
  us.push(onSnapshot(subCol(tripId,"activities"),snap=>{
    if(!trip||trip.id!==tripId)return;
    if(snap.docs.length)activities=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!isPending())renderTrip();
  }));
  us.push(onSnapshot(subCol(tripId,"settlements"),snap=>{
    if(!trip||trip.id!==tripId)return;
    settlements=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!isPending())renderTrip();
  }));
  unsubTrip=()=>us.forEach(u=>u());
}
function stopListener(){if(unsubTrip){unsubTrip();unsubTrip=null;}}

function renderTrip(){
  rAuthBar();showScreen("screen-trip");
  document.getElementById("trip-name-hd").textContent=trip.name;
  document.getElementById("trip-dates-hd").textContent=[trip.startDate,trip.endDate].filter(Boolean).join(" → ")||"No dates set";
  document.getElementById("kpi-strip").innerHTML=rKPI();
  const etWrap=document.getElementById("edit-trip-btn-wrap");
  if(etWrap&&isAdmin())etWrap.innerHTML=`<button class="btn btn-ghost btn-sm" id="b-edit-trip-hdr" style="margin-left:6px">✏️ Edit Trip</button>`;
  document.getElementById("tab-bar").innerHTML=rTabs();
  document.getElementById("tab-content").innerHTML=
    tab==="dashboard"?rDash():tab==="expenses"?rExp():
    tab==="settlements"?rSettle():tab==="members"?rMembers():
    tab==="finalytics"?rFinalytics():"";
  document.getElementById("modal-area").innerHTML=
    modal==="expense"?rExpModal():
    (modal&&modal.startsWith("edit-expense:"))?rEditExpModal():
    modal==="activity"?rActModal():modal==="reset"?rResetModal():
    modal==="edit-trip"?rEditTripModal():"";
  bindTrip();
  if(tab==="finalytics")setTimeout(renderCharts,50);
  // Use onclick on static topbar buttons to avoid stacking listeners
  document.getElementById("b-back").onclick=()=>{stopListener();goHome();};
  document.getElementById("b-share").onclick=copyLink;
  document.getElementById("b-edit-trip-hdr")?.addEventListener("click",()=>{modal="edit-trip";renderTrip();});
}

function copyLink(){const u=shareUrl(trip.id);navigator.clipboard?.writeText(u).then(()=>toast("Link copied!","success")).catch(()=>toast(u,"info"));}

function calcSettlements(){
  const names=approvedNames();const bal={};names.forEach(n=>bal[n]=0);
  expenses.forEach(e=>{const pp=e.participants||names,sh=e.amount/pp.length;bal[e.paidBy]=(bal[e.paidBy]||0)+e.amount;pp.forEach(p=>bal[p]=(bal[p]||0)-sh);});
  const cr=[],dr=[];
  Object.entries(bal).forEach(([n,b])=>{if(b>.01)cr.push({n,b});else if(b<-.01)dr.push({n,b:-b});});
  cr.sort((a,b)=>b.b-a.b);dr.sort((a,b)=>b.b-a.b);
  const txns=[];let i=0,j=0;
  while(i<cr.length&&j<dr.length){const c=cr[i],d=dr[j],a=Math.min(c.b,d.b);txns.push({from:d.n,to:c.n,amount:+a.toFixed(2)});c.b-=a;d.b-=a;if(c.b<.01)i++;if(d.b<.01)j++;}
  return txns;
}
function netBal(name){let b=0;expenses.forEach(e=>{const pp=e.participants||approvedNames();if(e.paidBy===name)b+=e.amount;if(pp.includes(name))b-=e.amount/pp.length;});return +b.toFixed(2);}
function isDone(from,to){return settlements.some(s=>s.from===from&&s.to===to&&s.done);}
function getSettlementId(from,to){return settlements.find(s=>s.from===from&&s.to===to&&s.done)?.id||null;}

function rKPI(){
  const total=expenses.reduce((s,e)=>s+e.amount,0);
  const mn=myName();
  const myPaid=expenses.filter(e=>e.paidBy===mn).reduce((s,e)=>s+e.amount,0);
  const myBal=netBal(mn);
  const txns=calcSettlements();
  const pend=txns.filter(t=>!isDone(t.from,t.to)).length;
  const approved=members.filter(m=>m.status==="approved").length+(isAdmin()?1:0);
  const curr=fmtLabel();
  return`<div class="kpi-grid">
    <div class="kpi teal"><div class="kl">Total Spent</div><div class="kv">${fmt(total)}</div><div class="ks">${expenses.length} expenses · ${curr}</div></div>
    <div class="kpi gray"><div class="kl">You Paid</div><div class="kv">${fmt(myPaid)}</div><div class="ks">your contributions</div></div>
    <div class="kpi ${myBal>=0?'green':'red'}"><div class="kl">Your Balance</div><div class="kv">${myBal>=0?'+':''}${fmt(myBal)}</div><div class="ks">${myBal>0?'to receive':myBal<0?'you owe':'all even'}</div></div>
    <div class="kpi ${pend>0?'amber':'green'}"><div class="kl">Pending</div><div class="kv">${pend}</div><div class="ks">transfers left</div></div>
    <div class="kpi gray"><div class="kl">Members</div><div class="kv">${approved}</div><div class="ks">${members.filter(m=>m.status==="pending").length} pending</div></div>
  </div>`;
}

function rTabs(){
  return[["dashboard","📊 Dashboard"],["expenses","💸 Expenses"],["settlements","🔄 Settle Up"],["members","👥 Members"],["finalytics","📈 Finalytics"]]
    .map(([id,l])=>`<button class="tab${tab===id?" active":""}" data-tab="${id}">${l}</button>`).join("");
}

function rDash(){
  const byAct={};activities.forEach(a=>byAct[a.name]=0);
  expenses.forEach(e=>{byAct[e.activity]=(byAct[e.activity]||0)+e.amount;});
  const maxA=Math.max(...Object.values(byAct),1);
  const aRows=Object.entries(byAct).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<div class="bal-row"><span class="bal-name">${ICON(n)} ${n}</span><div class="bar-wrap"><div class="bar-fill" style="width:${(v/maxA*100).toFixed(1)}%;background:var(--teal)"></div></div><span class="bal-num" style="color:var(--teal-dark)">${fmt(v)}</span></div>`).join("")||`<div class="empty"><div class="empty-icon">📊</div><p>No data yet</p></div>`;
  const names=approvedNames();const maxB=Math.max(...names.map(n=>Math.abs(netBal(n))),1);
  const mRows=names.map(n=>{const b=netBal(n);return`<div class="bal-row"><span class="bal-name">${n}</span><div class="bar-wrap"><div class="bar-fill" style="width:${(Math.abs(b)/maxB*100).toFixed(1)}%;background:${b>=0?"#16a34a":"var(--red)"}"></div></div><span class="bal-num" style="color:${b>=0?"#15803d":"var(--red)"}">${b>=0?"+":""}${fmt(b)}</span></div>`;}).join("")||`<div class="empty" style="padding:12px 0"><p>No approved members yet</p></div>`;
  const recent=[...expenses].reverse().slice(0,5);
  return`<div class="two-col"><div class="sc"><div class="sc-title">Spending by Activity</div>${aRows}</div><div class="sc"><div class="sc-title">Member Balances</div>${mRows}</div></div><div class="sc"><div class="sec-hd"><div class="sec-title">Recent Expenses</div><button class="btn btn-primary btn-sm" id="b-addexp">+ Add Expense</button></div>${recent.length?recent.map(rRow).join(""):`<div class="empty"><div class="empty-icon">💸</div><p>No expenses yet</p></div>`}</div>`;
}

function rExp(){
  const fil=actFil==="All"?expenses:expenses.filter(e=>e.activity===actFil);
  return`<div class="sec-hd"><div class="sec-title">All Expenses</div><button class="btn btn-primary btn-sm" id="b-addexp">+ Add Expense</button></div><div class="pills"><div class="pill${actFil==="All"?" active":""}" data-af="All">All</div>${activities.map(a=>`<div class="pill${actFil===a.name?" active":""}" data-af="${a.name}">${a.icon||"💰"} ${a.name}</div>`).join("")}${isAdmin()?`<div class="pill" style="border-style:dashed" id="b-addact">+ Activity</div>`:""}</div><div class="sc">${fil.length?[...fil].reverse().map(rRow).join(""):`<div class="empty"><div class="empty-icon">💸</div><p>No expenses here yet</p></div>`}</div>`;
}

function rRow(e){
  const pp=e.participants||approvedNames(),sh=(e.amount/pp.length).toFixed(2);
  const canEdit=isAdmin()||e.paidBy===myName();
  return`<div class="exp-row"><div class="exp-icon">${ICON(e.activity)}</div><div class="exp-body"><div class="exp-name">${e.description}<span class="exp-tag">${e.activity}</span></div><div class="exp-meta">Paid by ${e.paidBy} · ${e.date} · ${pp.length} people</div><div class="exp-meta">👥 ${pp.join(", ")}</div>${e.notes?`<div class="exp-meta" style="color:var(--text3);font-style:italic">${e.notes}</div>`:""}</div><div class="exp-right"><div class="exp-amt">${fmt(e.amount)}</div><div class="exp-per">${getCurrency().symbol}${sh}/person · ${fmtLabel()}</div>${canEdit?`<div style="display:flex;gap:4px;margin-top:5px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-edit="${e.id}">✏️ Edit</button><button class="btn btn-danger btn-sm" data-del="${e.id}">✕</button></div>`:""}</div></div>`;
}

// ── FIX 1: Undo settlement — show ↩ Undo on completed rows ──
function rSettle(){
  const txns=calcSettlements();
  if(!txns.length)return`<div class="sc"><div class="empty"><div class="empty-icon">🎉</div><p>All settled!</p></div></div>`;
  const pend=txns.filter(t=>!isDone(t.from,t.to));
  const done=txns.filter(t=>isDone(t.from,t.to));
  return`<div class="sc">
    <div class="sc-title">Pending Transfers <span class="sc-sub">${pend.length} remaining</span></div>
    ${pend.map(t=>`<div class="settle-row"><span class="settle-from">${t.from}</span><span class="settle-arrow"> → </span><span class="settle-to">${t.to}</span><span class="settle-amt">${fmt(t.amount)}</span><button class="btn btn-green btn-sm" data-settle-from="${t.from}" data-settle-to="${t.to}">✓ Mark Done</button></div>`).join("")}
    ${done.length?`<div class="divider"></div>
    <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Completed</div>
    ${done.map(t=>{const sid=getSettlementId(t.from,t.to);return`<div class="settle-row"><span class="settle-from">${t.from}</span><span class="settle-arrow"> → </span><span class="settle-to">${t.to}</span><span class="settle-amt">${fmt(t.amount)}</span><span class="badge-done">✓ Done</span>${sid?`<button class="btn btn-ghost btn-sm" data-undo-settle="${sid}">↩ Undo</button>`:""}</div>`;}).join("")}`:""}
  </div>
  <div class="sc"><div class="sc-title">Breakdown by Activity</div>${activities.map(act=>{const ex=expenses.filter(e=>e.activity===act.name);if(!ex.length)return"";return`<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">${act.icon||"💰"} ${act.name} — ${fmt(ex.reduce((s,e)=>s+e.amount,0))}</div>${ex.map(e=>`<div style="font-size:12px;color:var(--text2);margin-left:14px;margin-bottom:2px;font-family:'DM Mono',monospace">• ${e.description}: ${fmt(e.amount)} (${e.paidBy})</div>`).join("")}</div>`;}).join("")}</div>`;
}

function rMembers(){
  const approved=members.filter(m=>m.status==="approved");
  const pending=members.filter(m=>m.status==="pending");
  const url=shareUrl(trip.id);
  return`<div class="sc"><div class="share-box"><p>🔗 Share this link to invite people to <strong>${trip.name}</strong></p><div class="share-link"><input type="text" value="${url}" readonly/><button class="btn btn-primary btn-sm" id="b-copy">Copy</button></div></div><div class="sc-title">Trip Members <span class="sc-sub">${approved.length+(isAdmin()?1:0)} approved</span></div>${isAdmin()?`<div class="member-row"><div class="m-left"><div class="m-avatar">${trip.adminPhoto?`<img src="${trip.adminPhoto}" style="width:100%;height:100%;object-fit:cover">`:""}</div><div><div class="m-name">${trip.adminName}<span class="badge badge-admin">Admin</span></div><div class="m-email">${trip.createdBy}</div></div></div></div>`:""}${approved.map(m=>{const b=netBal(m.name);const paid=expenses.filter(e=>e.paidBy===m.name).reduce((s,e)=>s+e.amount,0);return`<div class="member-row"><div class="m-left"><div class="m-avatar">${m.photo?`<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.textContent='👤'">`:""}</div><div><div class="m-name">${m.name}<span class="badge badge-member">Member</span></div><div class="m-email">${m.email} · paid ${fmt(paid)}</div></div></div><div style="display:flex;align-items:center;gap:8px"><div style="text-align:right"><div style="font-size:14px;font-weight:600;font-family:'DM Mono',monospace;color:${b>=0?"#15803d":"var(--red)"}">${b>=0?"+":""}${fmt(b)}</div><div style="font-size:11px;color:var(--text3)">${b>0?"to receive":b<0?"owes":"even"}</div></div>${isAdmin()?`<button class="btn btn-danger btn-sm" data-kick="${m.id}">Remove</button>`:""}</div></div>`;}).join("")}${!approved.length&&!isAdmin()?`<div class="empty" style="padding:14px 0"><p>No approved members yet</p></div>`:""}</div>${isAdmin()&&pending.length?`<div class="sc" style="border-color:var(--amber-border)"><div class="sc-title" style="color:var(--amber)">Pending Approval <span class="sc-sub">${pending.length} waiting</span></div><div class="info-note" style="background:var(--amber-dim);border-color:var(--amber-border);color:var(--amber)">These people joined via your link and are waiting for approval.</div>${pending.map(m=>`<div class="member-row"><div class="m-left"><div class="m-avatar">${m.photo?`<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.textContent='👤'">`:""}</div><div><div class="m-name">${m.name}<span class="badge badge-pending">Pending</span></div><div class="m-email">${m.email}</div></div></div><div style="display:flex;gap:6px"><button class="btn btn-green btn-sm" data-approve="${m.id}">✓ Approve</button><button class="btn btn-danger btn-sm" data-kick="${m.id}">✕ Reject</button></div></div>`).join("")}</div>`:""}${isAdmin()?`<div class="danger-zone"><div class="dz-title">⚠ Danger Zone</div><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:10px"><div><div style="font-size:13px;font-weight:600;color:var(--text)">Edit trip details</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Change name, dates, description</div></div><button class="btn btn-ghost btn-sm" id="b-edit-trip">✏️ Edit</button></div><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px"><div><div style="font-size:13px;font-weight:600;color:var(--text)">Delete this trip</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Permanently deletes all data.</div></div><button class="btn btn-danger btn-sm" id="b-reset">🗑 Delete Trip</button></div></div>`:""}`;
}

function rFinalytics(){
  const total=expenses.reduce((s,e)=>s+e.amount,0);
  const names=approvedNames();
  const days=trip.startDate&&trip.endDate?Math.ceil((new Date(trip.endDate)-new Date(trip.startDate))/(1000*60*60*24))+1:null;
  const avgPer=names.length?total/names.length:0;
  const topSpender=names.reduce((a,n)=>{const p=expenses.filter(e=>e.paidBy===n).reduce((s,e)=>s+e.amount,0);return p>a.amt?{name:n,amt:p}:a;},{name:"—",amt:0});
  const curr=getCurrency();
  return`<div class="three-col">
    <div class="stat-card"><div class="sv">${fmt(total)}</div><div class="sl">Total Spent · ${curr.code}</div></div>
    <div class="stat-card"><div class="sv">${fmt(avgPer)}</div><div class="sl">Avg per person</div></div>
    <div class="stat-card"><div class="sv">${days||"—"}</div><div class="sl">Trip days</div></div>
    <div class="stat-card"><div class="sv">${names.length}</div><div class="sl">Members</div></div>
    <div class="stat-card"><div class="sv">${expenses.length}</div><div class="sl">Total expenses</div></div>
    <div class="stat-card"><div class="sv" style="font-size:14px">${topSpender.name}</div><div class="sl">Top contributor</div></div>
  </div>
  <div class="two-col">
    <div class="sc"><div class="sc-title">Spending by Activity</div><div class="chart-wrap"><canvas id="chart-pie"></canvas></div></div>
    <div class="sc"><div class="sc-title">Contribution per Member</div><div class="chart-wrap"><canvas id="chart-bar"></canvas></div></div>
  </div>
  <div class="sc">
    <div class="sec-hd"><div class="sec-title">Export</div></div>
    <div class="export-row">
      <button class="btn btn-indigo" id="b-export-pdf">📄 Export PDF</button>
      <button class="btn btn-ghost" id="b-export-csv">📊 Export CSV</button>
    </div>
    <div style="font-size:12px;color:var(--text3)">PDF includes full expense list, member balances and settlement summary. CSV includes all expenses as a spreadsheet.</div>
  </div>`;
}

let _pieChart=null,_barChart=null;
function renderCharts(){
  const byAct={};activities.forEach(a=>byAct[a.name]=0);
  expenses.forEach(e=>{byAct[e.activity]=(byAct[e.activity]||0)+e.amount;});
  const actLabels=Object.keys(byAct).filter(k=>byAct[k]>0);
  const actData=actLabels.map(k=>+byAct[k].toFixed(2));
  const colors=["#00b386","#C27A00","#4F46E5","#D93025","#0891b2","#7c3aed","#059669","#ea580c"];
  const pieCtx=document.getElementById("chart-pie");
  if(pieCtx){
    if(_pieChart){_pieChart.destroy();_pieChart=null;}
    _pieChart=new Chart(pieCtx,{type:"doughnut",data:{labels:actLabels,datasets:[{data:actData,backgroundColor:colors.slice(0,actLabels.length),borderColor:"#fff",borderWidth:3,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{position:"bottom",labels:{font:{size:11},padding:10,boxWidth:10}},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.parsed)}`}}}}});
  }
  const names=approvedNames();
  const barData=names.map(n=>+expenses.filter(e=>e.paidBy===n).reduce((s,e)=>s+e.amount,0).toFixed(2));
  const barCtx=document.getElementById("chart-bar");
  if(barCtx){
    if(_barChart){_barChart.destroy();_barChart=null;}
    _barChart=new Chart(barCtx,{type:"bar",data:{labels:names,datasets:[{label:"Paid",data:barData,backgroundColor:colors.slice(0,names.length),borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${fmt(ctx.parsed.y)}`}}},scales:{x:{ticks:{font:{size:11}}},y:{ticks:{callback:v=>fmt(v),font:{size:10}},grid:{color:"rgba(0,0,0,0.05)"}}}}});
  }
  document.getElementById("b-export-pdf")?.addEventListener("click",exportPDF);
  document.getElementById("b-export-csv")?.addEventListener("click",exportCSV);
}

function exportPDF(){
  try{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF();
    const curr=getCurrency();
    let y=20;
    doc.setFontSize(18);doc.setTextColor(0,179,134);
    doc.text("FinSplit — Trip Report",20,y);y+=10;
    doc.setFontSize(12);doc.setTextColor(90,100,120);
    doc.text(`${trip.name} · ${[trip.startDate,trip.endDate].filter(Boolean).join(" → ")||"No dates"}`,20,y);y+=6;
    doc.text(`Currency: ${curr.code} (${curr.symbol}) · Generated: ${new Date().toLocaleDateString()}`,20,y);y+=12;
    doc.setDrawColor(220,220,220);doc.line(20,y,190,y);y+=8;
    doc.setFontSize(13);doc.setTextColor(26,34,53);doc.text("Expenses",20,y);y+=8;
    doc.setFontSize(10);doc.setTextColor(90,100,120);
    expenses.forEach(e=>{
      if(y>270){doc.addPage();y=20;}
      doc.text(`${e.date} — ${e.description} (${e.activity})`,22,y);
      doc.text(`${curr.symbol}${e.amount.toFixed(2)} paid by ${e.paidBy}`,22,y+5);y+=12;
    });
    y+=4;doc.setDrawColor(220,220,220);doc.line(20,y,190,y);y+=8;
    doc.setFontSize(13);doc.setTextColor(26,34,53);doc.text("Settlement Summary",20,y);y+=8;
    doc.setFontSize(10);doc.setTextColor(90,100,120);
    const txns=calcSettlements();
    if(!txns.length){doc.text("All settled — no transfers needed!",22,y);}
    else txns.forEach(t=>{if(y>270){doc.addPage();y=20;}doc.text(`${t.from} → ${t.to}: ${curr.symbol}${t.amount.toFixed(2)}${isDone(t.from,t.to)?" ✓ Done":""}`,22,y);y+=7;});
    y+=8;doc.setFontSize(13);doc.setTextColor(26,34,53);doc.text("Member Balances",20,y);y+=8;
    doc.setFontSize(10);doc.setTextColor(90,100,120);
    approvedNames().forEach(n=>{if(y>270){doc.addPage();y=20;}const b=netBal(n);doc.text(`${n}: ${b>=0?"+":""}${curr.symbol}${Math.abs(b).toFixed(2)} (${b>0?"to receive":b<0?"owes":"settled"})`,22,y);y+=7;});
    doc.save(`finsplit-${trip.name.replace(/\s+/g,"-")}.pdf`);
    toast("PDF downloaded!","success");
  }catch(e){console.error(e);toast("PDF generation failed","error");}
}

function exportCSV(){
  const curr=getCurrency();
  const rows=[["Date","Description","Activity","Amount","Currency","Paid By","Participants","Notes"]];
  expenses.forEach(e=>rows.push([e.date,e.description,e.activity,e.amount,curr.code,e.paidBy,(e.participants||approvedNames()).join("; "),e.notes||""]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`finsplit-${trip.name.replace(/\s+/g,"-")}.csv`;a.click();
  toast("CSV downloaded!","success");
}

function rExpModal(){
  const today=new Date().toISOString().split("T")[0];
  const names=approvedNames();
  return`<div class="overlay" id="ov"><div class="modal"><div class="modal-hd">Add Expense <button class="x-btn" id="b-close">✕</button></div><div class="form-grid"><div class="fg full"><label>Description *</label><input id="e-desc" placeholder="e.g. Dinner at the harbour"/></div><div class="fg"><label>Amount (${fmtLabel()}) *</label><input id="e-amt" type="number" placeholder="0.00" step="0.01" min="0"/></div><div class="fg"><label>Date</label><input id="e-date" type="date" value="${today}"/></div><div class="fg"><label>Paid By *</label><select id="e-paid">${names.map(n=>`<option value="${n}"${n===myName()?" selected":""}>${n}</option>`).join("")}</select></div><div class="fg"><label>Activity</label><select id="e-act">${activities.map(a=>`<option>${a.name}</option>`).join("")}</select></div><div class="fg full"><label>Who's splitting this?</label><div class="check-group" id="e-pp">${names.map(n=>`<div class="check-chip on" data-m="${n}">${n}</div>`).join("")}</div></div><div class="fg full"><label>Notes (optional)</label><textarea id="e-notes" placeholder="Any notes…"></textarea></div><div class="fg full"><button class="btn btn-primary" id="b-saveexp" style="width:100%;padding:10px;justify-content:center">Save Expense</button></div></div></div></div>`;
}

function rEditExpModal(){
  const eid=modal.split(":").slice(1).join(":");
  const e=expenses.find(x=>x.id===eid);
  if(!e)return"";
  const names=approvedNames();
  const selPP=e.participants||names;
  return`<div class="overlay" id="ov"><div class="modal"><div class="modal-hd">Edit Expense <button class="x-btn" id="b-close">✕</button></div><div class="form-grid"><div class="fg full"><label>Description *</label><input id="ee-desc" value="${e.description}"/></div><div class="fg"><label>Amount (${fmtLabel()}) *</label><input id="ee-amt" type="number" value="${e.amount}" step="0.01" min="0"/></div><div class="fg"><label>Date</label><input id="ee-date" type="date" value="${e.date}"/></div><div class="fg"><label>Paid By *</label><select id="ee-paid">${names.map(n=>`<option value="${n}"${n===e.paidBy?" selected":""}>${n}</option>`).join("")}</select></div><div class="fg"><label>Activity</label><select id="ee-act">${activities.map(a=>`<option${a.name===e.activity?" selected":""}>${a.name}</option>`).join("")}</select></div><div class="fg full"><label>Who's splitting this?</label><div class="check-group" id="ee-pp">${names.map(n=>`<div class="check-chip${selPP.includes(n)?" on":""}" data-m="${n}">${n}</div>`).join("")}</div></div><div class="fg full"><label>Notes</label><textarea id="ee-notes">${e.notes||""}</textarea></div><div class="fg full"><button class="btn btn-primary" id="b-savedit" data-eid="${e.id}" style="width:100%;padding:10px;justify-content:center">Save Changes</button></div></div></div></div>`;
}

function rActModal(){return`<div class="overlay" id="ov"><div class="modal" style="max-width:360px"><div class="modal-hd">New Activity <button class="x-btn" id="b-close">✕</button></div><div class="form-grid"><div class="fg"><label>Activity Name</label><input id="a-name" placeholder="e.g. Boat Tour"/></div><div class="fg"><label>Icon (emoji)</label><input id="a-icon" placeholder="e.g. 🚤" maxlength="2"/></div></div><button class="btn btn-primary" id="b-saveact" style="width:100%;margin-top:14px;padding:10px;justify-content:center">Create</button></div></div>`;}

function rResetModal(){return`<div class="overlay" id="ov"><div class="modal" style="max-width:380px"><div class="modal-hd">Delete Trip <button class="x-btn" id="b-close">✕</button></div><div class="warn-note">⚠ Permanently deletes the trip and ALL its data. Cannot be undone.</div><div class="fg" style="margin-bottom:14px"><label>Type DELETE to confirm</label><input id="reset-confirm" placeholder="DELETE" style="border-color:var(--red-border)"/></div><button class="btn btn-danger" id="b-do-reset" style="width:100%;padding:10px;justify-content:center">🗑 Delete Everything</button></div></div>`;}

function rEditTripModal(){
  return`<div class="overlay" id="ov"><div class="modal" style="max-width:480px"><div class="modal-hd">Edit Trip Details <button class="x-btn" id="b-close">✕</button></div><div class="form-grid"><div class="fg full"><label>Trip Name *</label><input id="et-name" value="${trip.name}"/></div><div class="fg"><label>Start Date</label><input id="et-s" type="date" value="${trip.startDate||""}"/></div><div class="fg"><label>End Date</label><input id="et-e" type="date" value="${trip.endDate||""}"/></div><div class="fg full"><label>Currency</label><select id="et-curr">${CURRENCIES.map(c=>`<option value="${c.code}"${c.code===(trip.currency||"CAD")?" selected":""}>${c.code} — ${c.name} (${c.symbol})</option>`).join("")}</select></div><div class="fg full"><label>Description</label><input id="et-d" value="${trip.description||""}"/></div><div class="fg full"><button class="btn btn-primary" id="b-save-edit-trip" style="width:100%;padding:10px;justify-content:center">Save Changes</button></div></div></div></div>`;
}

function bindTrip(){
  document.querySelectorAll(".tab[data-tab]").forEach(t=>t.addEventListener("click",()=>{tab=t.dataset.tab;renderTrip();}));
  document.querySelectorAll("[data-af]").forEach(p=>p.addEventListener("click",()=>{actFil=p.dataset.af;renderTrip();}));
  document.getElementById("b-addexp")?.addEventListener("click",()=>{modal="expense";renderTrip();});
  document.getElementById("b-addact")?.addEventListener("click",()=>{modal="activity";renderTrip();});
  document.getElementById("b-reset")?.addEventListener("click",()=>{modal="reset";renderTrip();});
  document.getElementById("b-edit-trip")?.addEventListener("click",()=>{modal="edit-trip";renderTrip();});
  document.getElementById("b-close")?.addEventListener("click",()=>{modal=null;renderTrip();});
  document.getElementById("ov")?.addEventListener("click",e=>{if(e.target.id==="ov"){modal=null;renderTrip();}});
  document.getElementById("b-copy")?.addEventListener("click",copyLink);
  document.querySelectorAll(".check-chip[data-m]").forEach(c=>c.addEventListener("click",()=>c.classList.toggle("on")));

  // ── FIX 3: modal closes after save — renderTrip() called after await ──
  document.getElementById("b-saveexp")?.addEventListener("click",async()=>{
    const desc=document.getElementById("e-desc").value.trim();
    const amt=parseFloat(document.getElementById("e-amt").value);
    const date=document.getElementById("e-date").value;
    const paid=document.getElementById("e-paid").value;
    const act=document.getElementById("e-act").value;
    const notes=document.getElementById("e-notes").value.trim();
    const pp=[...document.querySelectorAll("#e-pp .check-chip.on")].map(c=>c.dataset.m);
    if(!desc||isNaN(amt)||amt<=0){toast("Enter description and amount","error");return;}
    if(!pp.length){toast("Select at least one participant","error");return;}
    const id=genId();
    await setDoc(subDoc(trip.id,"expenses",id),{id,description:desc,amount:amt,date,paidBy:paid,activity:act,notes,participants:pp,createdAt:new Date().toISOString()});
    modal=null;
    renderTrip(); // explicitly re-render to close modal
    toast("Expense saved","success");
  });

  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{modal="edit-expense:"+b.dataset.edit;renderTrip();}));

  document.getElementById("b-savedit")?.addEventListener("click",async()=>{
    const eid=document.getElementById("b-savedit").dataset.eid;
    const desc=document.getElementById("ee-desc").value.trim();
    const amt=parseFloat(document.getElementById("ee-amt").value);
    const date=document.getElementById("ee-date").value;
    const paid=document.getElementById("ee-paid").value;
    const act=document.getElementById("ee-act").value;
    const notes=document.getElementById("ee-notes").value.trim();
    const pp=[...document.querySelectorAll("#ee-pp .check-chip.on")].map(c=>c.dataset.m);
    if(!desc||isNaN(amt)||amt<=0){toast("Enter description and amount","error");return;}
    if(!pp.length){toast("Select at least one participant","error");return;}
    await updateDoc(subDoc(trip.id,"expenses",eid),{description:desc,amount:amt,date,paidBy:paid,activity:act,notes,participants:pp,updatedAt:new Date().toISOString()});
    modal=null;
    renderTrip(); // explicitly re-render to close modal
    toast("Expense updated","success");
  });

  document.getElementById("b-saveact")?.addEventListener("click",async()=>{
    const name=document.getElementById("a-name").value.trim();
    const icon=document.getElementById("a-icon").value.trim()||"💰";
    if(!name){toast("Enter activity name","error");return;}
    if(!activities.find(a=>a.name===name)){const id=genId();await setDoc(subDoc(trip.id,"activities",id),{id,name,icon,createdAt:new Date().toISOString()});}
    modal=null;
    renderTrip();
    toast("Activity created","success");
  });

  document.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",async()=>{
    await deleteDoc(subDoc(trip.id,"expenses",b.dataset.del));
    toast("Removed","info");
  }));

  // Mark settlement done
  document.querySelectorAll("[data-settle-from]").forEach(b=>b.addEventListener("click",async()=>{
    const from=b.dataset.settleFrom,to=b.dataset.settleTo;
    const id=genId();
    await setDoc(subDoc(trip.id,"settlements",id),{id,from,to,done:true,doneAt:new Date().toISOString(),markedBy:myName()});
    toast("Marked as done","success");
  }));

  // ── FIX 1: Undo settlement — delete the settlement doc ──
  document.querySelectorAll("[data-undo-settle]").forEach(b=>b.addEventListener("click",async()=>{
    await deleteDoc(subDoc(trip.id,"settlements",b.dataset.undoSettle));
    toast("Settlement undone","info");
  }));

  document.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",async()=>{
    await updateDoc(subDoc(trip.id,"members",b.dataset.approve),{status:"approved"});
    toast("Member approved","success");
  }));
  document.querySelectorAll("[data-kick]").forEach(b=>b.addEventListener("click",async()=>{
    const m=members.find(x=>x.id===b.dataset.kick);
    await deleteDoc(subDoc(trip.id,"members",b.dataset.kick));
    if(m){const ne=(trip.memberEmails||[]).filter(e=>e!==m.email);await updateDoc(tRef(trip.id),{memberEmails:ne});trip.memberEmails=ne;}
    toast("Member removed","info");
  }));

  document.getElementById("b-save-edit-trip")?.addEventListener("click",async()=>{
    const name=document.getElementById("et-name").value.trim();
    if(!name){toast("Enter a trip name","error");return;}
    const updates={name,startDate:document.getElementById("et-s").value,endDate:document.getElementById("et-e").value,currency:document.getElementById("et-curr").value,description:document.getElementById("et-d").value.trim()};
    await updateDoc(tRef(trip.id),updates);
    Object.assign(trip,updates);
    modal=null;
    renderTrip();
    toast("Trip updated","success");
  });

  document.getElementById("b-do-reset")?.addEventListener("click",async()=>{
    const val=document.getElementById("reset-confirm")?.value.trim();
    if(val!=="DELETE"){toast("Type DELETE in capitals","error");return;}
    toast("Deleting…","info");
    for(const col of ["members","expenses","activities","settlements"]){
      const snap=await getDocs(subCol(trip.id,col));
      const batch=writeBatch(db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit();
    }
    await deleteDoc(tRef(trip.id));
    stopListener();toast("Trip deleted","info");goHome();
  });
}

window._goHome=()=>{stopListener();goHome();};

onAuthStateChanged(auth,async u=>{
  user=u;rAuthBar();
  if(!u){showScreen("screen-signin");document.getElementById("b-gsi")?.addEventListener("click",doSignIn);return;}
  const tripId=tripIdFromUrl();
  if(tripId)await openTrip(tripId);
  else await renderHome();
});
