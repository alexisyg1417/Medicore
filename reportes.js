(() => {
"use strict";
const $ = s => document.querySelector(s);
const cfg = window.MEDICORE_SUPABASE_CONFIG;
const db = window.medicoreSupabase || (window.supabase?.createClient && cfg?.url && cfg?.publishableKey ? window.supabase.createClient(cfg.url,cfg.publishableKey) : null);
let patients=[], diseases=[], plans=[], records=[], links=[], plansChart=null, bmiChart=null, loading=false;
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg = (t, bad=false) => { $("#reportMessage").textContent=t; $("#reportMessage").style.background=bad?"#fff0f0":"#fff6ed"; };
const bmiOf = p => { const n=Number(p.bmi); if(Number.isFinite(n)&&n>0)return n;const h=Number(p.height_m),w=Number(p.weight_kg);return h>0&&w>0?w/(h*h):null; };
const bmiGroup = v => v<18.5?"Bajo peso":v<25?"Normal":v<30?"Sobrepeso":"Obesidad";
const bmiAdvice = v => !v?"No hay IMC registrado. Completa los datos y solicita una valoración profesional.":v<18.5?"El IMC está en rango bajo; conviene revisar hábitos con un profesional.":v<25?"El IMC está en rango habitual saludable; mantén hábitos equilibrados y seguimiento preventivo.":v<30?"El IMC está en rango de sobrepeso; se recomienda valoración profesional individual.":"El IMC está en rango de obesidad; se recomienda valoración clínica individualizada.";
async function rows(table){const {data,error}=await db.from(table).select("*");if(error)throw error;return data||[];}
function chart(id,type,labels,data,label){
 if(!window.Chart)return;
 const old=id==="plansChart"?plansChart:bmiChart;if(old)old.destroy();
 const instance=new Chart($("#"+id),{type,data:{labels,datasets:[{label,data,backgroundColor:type==="doughnut"?["#F36B21","#1F9D78","#D95D5D"]:["#F36B21","#1F9D78","#6B8AFD","#D95D5D"],borderWidth:1,borderRadius:type==="bar"?6:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:type==="doughnut"?"bottom":"top"}},scales:type==="bar"?{y:{beginAtZero:true,ticks:{precision:0}}}:{}}});
 if(id==="plansChart")plansChart=instance;else bmiChart=instance;
}
function optionsForPatients(){const opts='<option value="">Selecciona un paciente</option>'+patients.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name)+'</option>').join("");$("#patientSelect").innerHTML=opts;$("#recordPatient").innerHTML=opts;$("#planPatient").innerHTML=opts;}
function render(){
 const values=patients.map(bmiOf).filter(v=>v&&Number.isFinite(v));
 $("#totalPatients").textContent=patients.length;$("#totalRecords").textContent=records.length;$("#averageBmi").textContent=values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1):"—";$("#totalPlans").textContent=plans.length;
 const status={pending:0,authorized:0,denied:0};plans.forEach(p=>{const s=String(p.status||"pending").toLowerCase();if(["authorized","approved","autorizado","autorizada"].includes(s))status.authorized++;else if(["denied","rejected","denegado","denegada"].includes(s))status.denied++;else status.pending++;});
 chart("plansChart","doughnut",["Pendientes","Autorizados","Denegados"],[status.pending,status.authorized,status.denied],"Planes");
 const ranges={"Bajo peso":0,"Normal":0,"Sobrepeso":0,"Obesidad":0};values.forEach(v=>ranges[bmiGroup(v)]++);chart("bmiChart","bar",Object.keys(ranges),Object.values(ranges),"Pacientes");
 const recent=[...patients].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,10);
 $("#recentPatients").innerHTML=recent.length?recent.map(p=>{const v=bmiOf(p);return '<div class="report-patient"><span><strong>'+esc(p.full_name)+'</strong><br><small class="report-small">'+esc(p.created_at?new Date(p.created_at).toLocaleDateString("es-MX"):"")+' · '+(v?"IMC "+esc(v.toFixed(1)):"Sin IMC")+'</small></span><span class="report-small">'+esc(p.sex||"")+'</span></div>';}).join(""):'<p class="report-muted">No hay pacientes registrados. Usa el formulario para agregar uno.</p>';
 optionsForPatients();
 $("#diseaseSelect").innerHTML='<option value="">Vincular enfermedad existente</option>'+diseases.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join("");
 $("#diseaseList").innerHTML=diseases.length?diseases.map(d=>'<div class="recommendation"><strong>'+esc(d.name)+' · '+esc(d.category||"General")+'</strong><p>'+esc(d.description||"")+'</p><p>'+esc(d.recommendations||"")+'</p><button type="button" class="report-action secondary no-print" data-delete-disease="'+esc(d.id)+'">Eliminar</button></div>').join(""):'<p class="report-muted">Todavía no hay enfermedades registradas.</p>';
 $("#recordList").innerHTML=records.slice(0,8).map(r=>{const p=patients.find(x=>String(x.id)===String(r.patient_id));return '<div class="recommendation"><strong>'+esc(p?.full_name||"Paciente")+'</strong><p>'+esc(r.summary||"Sin resumen")+'</p><small class="report-small">'+esc(r.created_at?new Date(r.created_at).toLocaleString("es-MX"):"")+'</small></div>';}).join("")||'<p class="report-muted">Todavía no hay expedientes.</p>';
 $("#planList").innerHTML=plans.slice(0,8).map(p=>{const person=patients.find(x=>String(x.id)===String(p.patient_id));return '<div class="recommendation"><strong>'+esc(p.title||"Plan nutricional")+'</strong><p>'+esc(person?.full_name||"Paciente")+' · '+esc(p.status||"pending")+'</p></div>';}).join("")||'<p class="report-muted">Todavía no hay planes nutricionales.</p>';
 renderRecommendations();
}
function renderRecommendations(){
 const p=patients.find(x=>String(x.id)===$("#patientSelect").value);
 if(!p){$("#recommendations").innerHTML='<p class="report-muted">Selecciona un paciente para consultar recomendaciones.</p>';return;}
 const v=bmiOf(p), ids=links.filter(x=>String(x.patient_id)===String(p.id)).map(x=>String(x.disease_id)), matches=diseases.filter(d=>ids.includes(String(d.id)));
 const notes=records.filter(r=>String(r.patient_id)===String(p.id));
 let out='<div class="recommendation"><strong>Orientación por IMC</strong><p>'+esc(bmiAdvice(v))+'</p><small class="report-small">'+(v?"IMC: "+esc(v.toFixed(1))+" · "+esc(bmiGroup(v)):"Sin IMC registrado")+'</small></div>';
 out+=matches.length?matches.map(d=>'<div class="recommendation"><strong>'+esc(d.name)+' · '+esc(d.category||"General")+'</strong><p>'+esc(d.recommendations||"Solicita valoración profesional individual.")+'</p></div>').join(""):'<p class="report-muted">No hay enfermedades vinculadas a este paciente.</p>';
 out+=notes.length?'<h3>Notas de expediente</h3>'+notes.map(r=>'<div class="recommendation"><p>'+esc(r.summary)+'</p><small class="report-small">'+esc(r.created_at?new Date(r.created_at).toLocaleDateString("es-MX"):"")+'</small></div>').join(""):"";
 $("#recommendations").innerHTML=out;
}
async function load(){
 if(loading)return;loading=true;
 try{
  if(!db){msg("Supabase no está configurado. Revisa supabase-config.js.",true);return;}
  const {data,error:authError}=await db.auth.getSession();if(authError)throw authError;
  if(!data.session?.user){location.replace("./panel.html?next=reportes");return;}
  $("#accountLabel").textContent=data.session.user.email||"Cuenta";
  const result=await Promise.all([rows("patients"),rows("medical_records"),rows("nutrition_plans"),rows("diseases"),rows("patient_diseases")]);
  [patients,records,plans,diseases,links]=result;
  msg("Reporte actualizado con datos reales de tu cuenta en Supabase.");
  render();
  if(!window.Chart)msg("Los datos se cargaron, pero no se pudo cargar Chart.js. Revisa tu conexión para ver las gráficas.",true);
 }catch(e){msg("No se pudieron cargar los datos. Verifica que el esquema esté aplicado en Supabase y revisa permisos RLS. Detalle: "+(e.message||"error desconocido"),true);}
 finally{loading=false;}
}
$("#patientSelect").addEventListener("change",renderRecommendations);
$("#patientForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("full_name")||"").trim();if(!name){msg("Escribe el nombre ficticio del paciente.",true);return;}
 const row={full_name:name,sex:String(f.get("sex")||"unspecified")};
 if(f.get("birth_date"))row.birth_date=String(f.get("birth_date"));
 if(f.get("height_m"))row.height_m=Number(f.get("height_m"));
 if(f.get("weight_kg"))row.weight_kg=Number(f.get("weight_kg"));
 try{const {error}=await db.from("patients").insert(row);if(error)throw error;e.currentTarget.reset();await load();msg("Paciente guardado correctamente en Supabase.");}
 catch(err){msg("No se pudo registrar al paciente: "+err.message,true);}
});
$("#recordForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await db.from("medical_records").insert({patient_id:String(f.get("patient_id")),summary:String(f.get("summary")||"").trim()});if(error)throw error;e.currentTarget.reset();await load();msg("Expediente guardado correctamente.");}catch(err){msg("No se pudo guardar el expediente: "+err.message,true);}
});
$("#planForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await db.from("nutrition_plans").insert({patient_id:String(f.get("patient_id")),title:String(f.get("title")||"").trim(),status:String(f.get("status")||"pending")});if(error)throw error;e.currentTarget.reset();await load();msg("Plan nutricional guardado correctamente.");}catch(err){msg("No se pudo guardar el plan: "+err.message,true);}
});
$("#diseaseForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await db.from("diseases").insert({name:String(f.get("name")||"").trim(),category:String(f.get("category")||"General").trim(),description:String(f.get("description")||"").trim(),recommendations:String(f.get("recommendations")||"").trim()});if(error)throw error;e.currentTarget.reset();await load();msg("Enfermedad guardada correctamente.");}catch(err){msg("No se pudo guardar la enfermedad: "+err.message,true);}
});
$("#linkDiseaseForm").addEventListener("submit",async e=>{
 e.preventDefault();const patientId=$("#patientSelect").value, diseaseId=$("#diseaseSelect").value;if(!patientId||!diseaseId){msg("Selecciona paciente y enfermedad.",true);return;}
 try{const {error}=await db.from("patient_diseases").insert({patient_id:patientId,disease_id:diseaseId});if(error){if(error.code==="23505")throw new Error("Esta enfermedad ya está vinculada al paciente.");throw error;}await load();$("#patientSelect").value=patientId;renderRecommendations();msg("Enfermedad vinculada al paciente.");}
 catch(err){msg("No se pudo vincular la enfermedad: "+err.message,true);}
});
$("#diseaseList").addEventListener("click",async e=>{
 const b=e.target.closest("[data-delete-disease]");if(!b)return;const id=b.dataset.deleteDisease;if(!confirm("¿Eliminar esta enfermedad del catálogo?"))return;
 try{const {error}=await db.from("diseases").delete().eq("id",id);if(error)throw error;await load();msg("Enfermedad eliminada.");}catch(err){msg("No se pudo eliminar: "+err.message,true);}
});
$("#refreshReport").addEventListener("click",load);
$("#exportPdf").addEventListener("click",()=>{if(!window.html2pdf){window.print();return;}window.html2pdf().set({margin:8,filename:"MediCore-reporte.pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"letter",orientation:"landscape"}}).from($(".report-page")).save();});
$("#signOutButton").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.href="./panel.html";});
load();
})();