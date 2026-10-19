(() => {
"use strict";
const $=s=>document.querySelector(s);
const cfg=window.MEDICORE_SUPABASE_CONFIG;
const db=window.medicoreSupabase||(window.supabase?.createClient&&cfg?window.supabase.createClient(cfg.url,cfg.publishableKey):null);
let patients=[],diseases=[],plansChart,bmiChart;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=(t)=>$("#reportMessage").textContent=t;
function bmiGroup(v){if(v<18.5)return "Bajo peso";if(v<25)return "Normal";if(v<30)return "Sobrepeso";return "Obesidad";}
function bmiAdvice(v){if(!Number.isFinite(v)||v<=0)return "No hay IMC válido registrado. Completa los datos necesarios para calcularlo.";if(v<18.5)return "El IMC está en rango bajo. Se recomienda valoración profesional y revisar hábitos de alimentación.";if(v<25)return "El IMC está en rango saludable. Mantén hábitos equilibrados y seguimiento preventivo.";if(v<30)return "El IMC está en rango de sobrepeso. Se recomienda valoración profesional y seguimiento individual.";return "El IMC está en rango de obesidad. Se recomienda una valoración clínica individualizada."; }
function setCount(id,value){$(id).textContent=value;}
function chart(canvas,kind,labels,data,label){const old=canvas==="plansChart"?plansChart:bmiChart;if(old)old.destroy();const c=new Chart($("#"+canvas),{type:kind,data:{labels,datasets:[{label,data,backgroundColor:kind==="doughnut"?["#F36B21","#1F9D78","#D95D5D"]:["#F36B21","#1F9D78","#6B8AFD","#D95D5D"],borderWidth:1,borderRadius:kind==="bar"?6:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:kind==="doughnut"?"bottom":"top"}} ,scales:kind==="bar"?{y:{beginAtZero:true,ticks:{precision:0}}}:{}}});if(canvas==="plansChart")plansChart=c;else bmiChart=c;}
async function queryTable(table,columns="*"){const {data,error}=await db.from(table).select(columns);if(error)throw new Error(table+": "+error.message);return data||[];}
async function load(){
 if(!db){msg("No se pudo iniciar Supabase. Revisa la configuración del proyecto.");return;}
 const {data:{session}}=await db.auth.getSession();if(!session?.user){msg("Inicia sesión desde el panel de MediCore para consultar los reportes.");return;}
 $("#accountLabel").textContent=session.user.email||"Cuenta";
 try{
 const [p,r,n,d,links]=await Promise.all([queryTable("patients"),queryTable("medical_records"),queryTable("nutrition_plans"),queryTable("diseases"),queryTable("patient_diseases")]);
 patients=p;diseases=d;
 const bmiValues=p.map(x=>Number(x.bmi??x.imc)).filter(x=>Number.isFinite(x)&&x>0);
 setCount("#totalPatients",p.length);setCount("#totalRecords",r.length);setCount("#averageBmi",bmiValues.length?(bmiValues.reduce((a,b)=>a+b,0)/bmiValues.length).toFixed(1):"—");setCount("#totalPlans",n.length);
 const statuses={pending:0,authorized:0,denied:0};n.forEach(x=>{const s=String(x.status||"pending").toLowerCase();if(["authorized","approved","autorizado","autorizada"].includes(s))statuses.authorized++;else if(["denied","rejected","denegado","denegada"].includes(s))statuses.denied++;else statuses.pending++;});
 chart("plansChart","doughnut",["Pendientes","Autorizados","Denegados"],[statuses.pending,statuses.authorized,statuses.denied],"Planes");
 const ranges={"Bajo peso":0,"Normal":0,"Sobrepeso":0,"Obesidad":0};bmiValues.forEach(v=>ranges[bmiGroup(v)]++);chart("bmiChart","bar",Object.keys(ranges),Object.values(ranges),"Pacientes");
 const recent=[...p].sort((a,b)=>new Date(b.created_at||b.createdAt||0)-new Date(a.created_at||a.createdAt||0)).slice(0,5);
 $("#recentPatients").innerHTML=recent.length?recent.map(x=>'<div class="report-patient"><span><strong>'+esc(x.full_name||x.name||x.patient_name||"Paciente")+'</strong><br><small class="report-small">'+esc(x.created_at?new Date(x.created_at).toLocaleDateString("es-MX"):"Registro existente")+'</small></span><span class="report-small">'+(Number(x.bmi??x.imc)>0?"IMC "+esc(Number(x.bmi??x.imc).toFixed(1)):"Sin IMC")+'</span></div>').join(""):'<p class="report-muted">No hay pacientes registrados.</p>';
 $("#patientSelect").innerHTML='<option value="">Selecciona un paciente</option>'+p.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name||x.name||x.patient_name||"Paciente")+'</option>').join("");
 $("#diseaseList").innerHTML=d.length?d.map(x=>'<div class="recommendation"><strong>'+esc(x.name)+' · '+esc(x.category||"General")+'</strong><p>'+esc(x.description||"")+'</p><p>'+esc(x.recommendations||"")+'</p></div>').join(""):'<p class="report-muted">Todavía no hay enfermedades registradas.</p>';
 window.medicorePatientDiseaseLinks=links;
 msg("Reporte actualizado con datos de Supabase.");
 }catch(e){console.error(e);msg("El módulo de reportes necesita las tablas clínicas de MediCore (patients, medical_records, nutrition_plans, diseases y patient_diseases). "+e.message+" No se modificaron tus datos existentes.");}
}
$("#patientSelect").addEventListener("change",async()=>{
 const id=$("#patientSelect").value;const p=patients.find(x=>String(x.id)===id);if(!p){$("#recommendations").innerHTML='<p class="report-muted">Selecciona un paciente para consultar recomendaciones.</p>';return;}
 const value=Number(p.bmi??p.imc);let html='<div class="recommendation"><strong>Recomendación por IMC</strong><p>'+esc(bmiAdvice(value))+'</p><small class="report-small">'+(value>0?"IMC registrado: "+esc(value.toFixed(1))+" · "+esc(bmiGroup(value)):"Sin IMC registrado")+'</small></div>';
 try{const {data,error}=await db.from("patient_diseases").select("disease_id").eq("patient_id",p.id);if(error)throw error;const ids=(data||[]).map(x=>x.disease_id);const matches=diseases.filter(d=>ids.includes(d.id));html+=matches.length?matches.map(d=>'<div class="recommendation"><strong>'+esc(d.name)+' · '+esc(d.category||"General")+'</strong><p>'+esc(d.recommendations||"Consulta al profesional responsable para el plan individual.")+'</p></div>').join(""):'<p class="report-muted">No hay enfermedades vinculadas a este paciente.</p>';}catch(e){html+='<p class="report-muted">No se pudieron cargar las recomendaciones por enfermedad.</p>';}
 $("#recommendations").innerHTML=html;
});
$("#diseaseForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await db.from("diseases").insert({name:f.get("name").trim(),category:f.get("category").trim(),description:f.get("description").trim(),recommendations:f.get("recommendations").trim()});if(error)throw error;e.currentTarget.reset();await load();msg("Enfermedad guardada correctamente.");}catch(err){msg("No se pudo guardar la enfermedad: "+err.message);}});
$("#refreshReport").addEventListener("click",load);
$("#exportPdf").addEventListener("click",()=>{if(!window.html2pdf){window.print();return;}const node=$(".report-page");html2pdf().set({margin:8,filename:"MediCore-reporte-clinico.pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"letter",orientation:"landscape"}}).from(node).save();});
$("#signOutButton").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.href="./panel.html";});
if(db)db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session)setTimeout(load,0);});
load();
})();