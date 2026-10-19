(() => {
"use strict";
const $=s=>document.querySelector(s);
const cfg=window.MEDICORE_SUPABASE_CONFIG;
const db=window.medicoreSupabase||(window.supabase?.createClient&&cfg?window.supabase.createClient(cfg.url,cfg.publishableKey):null);
const STORE="medicore_reports_demo_v2";
let patients=[],diseases=[],plans=[],records=[],links=[],plansChart,bmiChart,mode="demo";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=t=>$("#reportMessage").textContent=t;
const bmiOf=p=>{const direct=Number(p.bmi??p.imc);if(Number.isFinite(direct)&&direct>0)return direct;const h=Number(p.height_m),w=Number(p.weight_kg);return h>0&&w>0?w/(h*h):null;};
const bmiGroup=v=>v<18.5?"Bajo peso":v<25?"Normal":v<30?"Sobrepeso":"Obesidad";
const bmiAdvice=v=>!Number.isFinite(v)||v<=0?"No hay IMC registrado. Completa los datos y solicita una valoración profesional.":v<18.5?"El IMC está en rango bajo. Conviene revisar hábitos de alimentación con un profesional.":v<25?"El IMC está en rango saludable. Mantén hábitos equilibrados y seguimiento preventivo.":v<30?"El IMC está en rango de sobrepeso. Se recomienda valoración profesional individual.":"El IMC está en rango de obesidad. Se recomienda una valoración clínica individualizada.";
const demoData=()=>({patients:[
{id:"d1",full_name:"María González",age:34,height_m:1.62,weight_kg:58,created_at:"2026-10-17"},
{id:"d2",full_name:"Carlos Hernández",age:45,height_m:1.75,weight_kg:86,created_at:"2026-10-16"},
{id:"d3",full_name:"Sofía Martínez",age:27,height_m:1.60,weight_kg:49,created_at:"2026-10-15"},
{id:"d4",full_name:"Diego Ramírez",age:52,height_m:1.70,weight_kg:94,created_at:"2026-10-14"},
{id:"d5",full_name:"Valentina Cruz",age:39,height_m:1.65,weight_kg:63,created_at:"2026-10-13"},
{id:"d6",full_name:"Jorge Torres",age:61,height_m:1.68,weight_kg:78,created_at:"2026-10-12"}],
records:[{id:"r1"},{id:"r2"},{id:"r3"},{id:"r4"}],
plans:[{id:"n1",patient_id:"d1",status:"authorized"},{id:"n2",patient_id:"d2",status:"pending"},{id:"n3",patient_id:"d3",status:"authorized"},{id:"n4",patient_id:"d4",status:"denied"},{id:"n5",patient_id:"d5",status:"pending"}],
diseases:[
{id:"e1",name:"Hipertensión arterial",category:"Cardiovascular",description:"Condición relacionada con elevación persistente de la presión arterial.",recommendations:"Registrar presión arterial y acudir a seguimiento profesional. Evitar cambios de medicación sin indicación."},
{id:"e2",name:"Diabetes tipo 2",category:"Metabólica",description:"Alteración del control de glucosa que requiere seguimiento individual.",recommendations:"Seguir el plan del profesional tratante y mantener controles indicados."},
{id:"e3",name:"Dislipidemia",category:"Metabólica",description:"Alteración de lípidos en sangre.",recommendations:"Revisar resultados de laboratorio y acordar hábitos con el profesional de salud."}
],links:[{patient_id:"d2",disease_id:"e1"},{patient_id:"d3",disease_id:"e2"},{patient_id:"d4",disease_id:"e1"}]});
function readDemo(){try{const v=JSON.parse(localStorage.getItem(STORE));if(v&&Array.isArray(v.patients)&&Array.isArray(v.diseases))return v;}catch(e){}const d=demoData();localStorage.setItem(STORE,JSON.stringify(d));return d;}
function saveDemo(){localStorage.setItem(STORE,JSON.stringify({patients,records,plans,diseases,links}));}
function setCount(id,v){$(id).textContent=v;}
function drawChart(canvas,kind,labels,data,label){const old=canvas==="plansChart"?plansChart:bmiChart;if(old)old.destroy();const c=new Chart($("#"+canvas),{type:kind,data:{labels,datasets:[{label,data,backgroundColor:kind==="doughnut"?["#F36B21","#1F9D78","#D95D5D"]:["#F36B21","#1F9D78","#6B8AFD","#D95D5D"],borderWidth:1,borderRadius:kind==="bar"?6:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:kind==="doughnut"?"bottom":"top"}},scales:kind==="bar"?{y:{beginAtZero:true,ticks:{precision:0}}}:{}}});if(canvas==="plansChart")plansChart=c;else bmiChart=c;}
async function getRows(table){const {data,error}=await db.from(table).select("*");if(error)throw error;return data||[];}
function normalize(){patients=patients.map(p=>({...p,full_name:p.full_name||p.name||p.patient_name||"Paciente"}));}
function render(){
 normalize();const vals=patients.map(bmiOf).filter(v=>Number.isFinite(v)&&v>0);
 setCount("#totalPatients",patients.length);setCount("#totalRecords",records.length);setCount("#averageBmi",vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):"—");setCount("#totalPlans",plans.length);
 const s={pending:0,authorized:0,denied:0};plans.forEach(p=>{const v=String(p.status||"pending").toLowerCase();if(["authorized","approved","autorizado","autorizada"].includes(v))s.authorized++;else if(["denied","rejected","denegado","denegada"].includes(v))s.denied++;else s.pending++;});
 drawChart("plansChart","doughnut",["Pendientes","Autorizados","Denegados"],[s.pending,s.authorized,s.denied],"Planes");
 const ranges={"Bajo peso":0,"Normal":0,"Sobrepeso":0,"Obesidad":0};vals.forEach(v=>ranges[bmiGroup(v)]++);drawChart("bmiChart","bar",Object.keys(ranges),Object.values(ranges),"Pacientes");
 const recent=[...patients].sort((a,b)=>new Date(b.created_at||b.createdAt||0)-new Date(a.created_at||a.createdAt||0)).slice(0,5);
 $("#recentPatients").innerHTML=recent.length?recent.map(p=>{const v=bmiOf(p);return '<div class="report-patient"><span><strong>'+esc(p.full_name)+'</strong><br><small class="report-small">'+esc(p.created_at?new Date(p.created_at).toLocaleDateString("es-MX"):"Registro de demostración")+'</small></span><span class="report-small">'+(v?"IMC "+esc(v.toFixed(1)):"Sin IMC")+'</span></div>';}).join(""):'<p class="report-muted">No hay pacientes registrados.</p>';
 $("#patientSelect").innerHTML='<option value="">Selecciona un paciente</option>'+patients.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name)+'</option>').join("");
 $("#diseaseList").innerHTML=diseases.length?diseases.map(d=>'<div class="recommendation"><strong>'+esc(d.name)+' · '+esc(d.category||"General")+'</strong><p>'+esc(d.description||"")+'</p><p>'+esc(d.recommendations||"")+'</p><button type="button" class="report-action secondary no-print" data-delete-disease="'+esc(d.id)+'">Eliminar</button></div>').join(""):'<p class="report-muted">Todavía no hay enfermedades registradas.</p>';
}
async function load(){
 if(!window.Chart){msg("No se pudo cargar Chart.js. Comprueba tu conexión y recarga la página.");return;}
 let session=null;
 if(db){try{const r=await db.auth.getSession();session=r.data?.session||null;}catch(e){}}
 if(db&&!session){const d=readDemo();patients=d.patients;records=d.records;plans=d.plans;diseases=d.diseases;links=d.links;mode="demo";msg("VISTA PÚBLICA DE DEMOSTRACIÓN: datos ficticios guardados en este navegador. Inicia sesión en el panel para consultar los datos de tu cuenta.");render();return;}
 if(session)$("#accountLabel").textContent=session.user.email||"Cuenta";
 try{
  if(db){
   const [p,r,n,d,l]=await Promise.all([getRows("patients"),getRows("medical_records"),getRows("nutrition_plans"),getRows("diseases"),getRows("patient_diseases")]);
   patients=p;records=r;plans=n;diseases=d;links=l;mode="remote";
   msg("Reporte actualizado con datos de Supabase.");
  }else throw new Error("Cliente de Supabase no configurado");
 }catch(e){
  const d=readDemo();patients=d.patients;records=d.records;plans=d.plans;diseases=d.diseases;links=d.links;mode="demo";
  msg("MODO DEMOSTRACIÓN: los datos de esta pantalla son ficticios y se guardan en este navegador. Para conectar datos de Supabase, instala el esquema de supabase/reports-schema.sql. "+(e.message||""));
 }
 render();
}
$("#patientSelect").addEventListener("change",async()=>{
 const p=patients.find(x=>String(x.id)===$("#patientSelect").value);if(!p){$("#recommendations").innerHTML='<p class="report-muted">Selecciona un paciente para consultar recomendaciones.</p>';return;}
 const v=bmiOf(p);let html='<div class="recommendation"><strong>Orientación por IMC</strong><p>'+esc(bmiAdvice(v))+'</p><small class="report-small">'+(v?"IMC: "+esc(v.toFixed(1))+" · "+esc(bmiGroup(v)):"Sin IMC registrado")+'</small></div>';
 const ids=links.filter(x=>String(x.patient_id)===String(p.id)).map(x=>String(x.disease_id));const matches=diseases.filter(d=>ids.includes(String(d.id)));
 html+=matches.length?matches.map(d=>'<div class="recommendation"><strong>'+esc(d.name)+' · '+esc(d.category||"General")+'</strong><p>'+esc(d.recommendations||"Solicita una valoración profesional individual.")+'</p></div>').join(""):'<p class="report-muted">No hay enfermedades vinculadas a este paciente.</p>';
 $("#recommendations").innerHTML=html;
});
$("#diseaseForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);const row={id:"d-"+Date.now(),name:String(f.get("name")).trim(),category:String(f.get("category")).trim(),description:String(f.get("description")).trim(),recommendations:String(f.get("recommendations")).trim()};
 try{if(mode==="remote"){const {error}=await db.from("diseases").insert({name:row.name,category:row.category,description:row.description,recommendations:row.recommendations});if(error)throw error;}else{diseases.push(row);saveDemo();}
 e.currentTarget.reset();await load();msg(mode==="demo"?"Enfermedad guardada en este navegador (modo demostración).":"Enfermedad guardada en Supabase.");
 }catch(err){msg("No se pudo guardar la enfermedad: "+err.message);}
});
$("#diseaseList").addEventListener("click",async e=>{const b=e.target.closest("[data-delete-disease]");if(!b)return;const id=b.dataset.deleteDisease;if(!confirm("¿Eliminar esta enfermedad del catálogo?"))return;try{if(mode==="remote"){const {error}=await db.from("diseases").delete().eq("id",id);if(error)throw error;}else{diseases=diseases.filter(d=>String(d.id)!==String(id));links=links.filter(l=>String(l.disease_id)!==String(id));saveDemo();}await load();msg("Enfermedad eliminada.");}catch(err){msg("No se pudo eliminar: "+err.message);}});
$("#refreshReport").addEventListener("click",load);
$("#exportPdf").addEventListener("click",()=>{if(!window.html2pdf){window.print();return;}html2pdf().set({margin:8,filename:"MediCore-reporte-clinico.pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"letter",orientation:"landscape"}}).from($(".report-page")).save();});
$("#signOutButton").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.href="./panel.html";});
if(db)db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session)setTimeout(load,0);});
load();
})();