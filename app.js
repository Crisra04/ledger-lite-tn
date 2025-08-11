// Ledger Lite — Terra Nostra edition con manejo de Deudas
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>document.querySelectorAll(sel);
const storeKey = 'ledgerlite_tn_v1';

let db = load();

function load(){
  try{
    const raw = localStorage.getItem(storeKey);
    return raw ? JSON.parse(raw) : {tx:[], cats:[], tags:[], debts:[]};
  }catch(e){ return {tx:[], cats:[], tags:[], debts:[]}; }
}
function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function refreshMeta(){
  // datalists
  $("#catlist").innerHTML = db.cats.map(c=>`<option value="${c}"></option>`).join('');
  $("#taglist").innerHTML = db.tags.map(t=>`<option value="${t}"></option>`).join('');
  // filters
  const filterTag = $("#filterTag");
  filterTag.innerHTML = `<option value="">Todos los tags</option>` + db.tags.map(t=>`<option>${t}</option>`).join('');
  // debts selects
  const debtSel = $("#debtId");
  const filterDebt = $("#filterDebt");
  const opts = [`<option value="">— Ninguna —</option>`, ...db.debts.map(d=>`<option value="${d.id}">${d.name}</option>`)];
  debtSel.innerHTML = opts.join('');
  filterDebt.innerHTML = `<option value="">Todas las deudas</option>` + db.debts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
}
refreshMeta();

// Add debt
$("#debtForm").addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = $("#debtName").value.trim();
  if(!name) return;
  const debt = {
    id: uid(), name,
    currency: $("#debtCurrency").value,
    fx: parseFloat($("#debtFx").value || 6.96),
    createdAt: new Date().toISOString()
  };
  db.debts.push(debt);
  save();
  $("#debtForm").reset();
  refreshMeta();
  renderDebts();
});

// Handle transaction form
$("#txForm").addEventListener('submit', (e)=>{
  e.preventDefault();
  const tx = {
    id: uid(),
    amount: parseFloat($("#amount").value || 0),
    type: $("#type").value,      // ingreso|gasto|inversion|financiacion
    group: $("#group").value,    // ventas|costos|opex|financieros|activos|patrimonio
    category: $("#category").value.trim(),
    tag: $("#tag").value.trim(),
    currency: $("#currency").value,
    fx: parseFloat($("#fx").value || 6.96),
    date: $("#date").value || new Date().toISOString().slice(0,10),
    notes: $("#notes").value.trim(),
    debtId: $("#debtId").value || "",
    isInterest: $("#isInterest").checked || false
  };
  if(!tx.amount || !tx.category) return;
  if(tx.category && !db.cats.includes(tx.category)) db.cats.push(tx.category);
  if(tx.tag && !db.tags.includes(tx.tag)) db.tags.push(tx.tag);
  db.tx.push(tx);
  save();
  refreshMeta();
  renderTable();
  renderDebts();
  $("#txForm").reset();
});

$("#clearForm").addEventListener('click', ()=> $("#txForm").reset());

function toBOB(t){
  return t.currency==='USD' ? t.amount * (t.fx||6.96) : t.amount;
}

// Table render & filters
function renderTable(){
  const q = ($("#search").value || '').toLowerCase();
  const fTag = $("#filterTag").value;
  const fGroup = $("#filterGroup").value;
  const fDebt = $("#filterDebt").value;
  const rows = db.tx
    .slice()
    .sort((a,b)=> a.date<b.date?1:-1)
    .filter(t => (!fTag || t.tag===fTag) && (!fGroup || t.group===fGroup) &&
      (!fDebt || t.debtId===fDebt) &&
      (q==='' || [t.category,t.tag,t.notes].join(' ').toLowerCase().includes(q)));
  const html = [`<table><thead><tr>
    <th>Fecha</th><th>Tipo</th><th>Grupo</th><th>Categoría</th><th>Tag</th><th>Deuda</th><th>Interés</th><th>Moneda</th><th>Monto</th><th>BOB</th><th>Notas</th><th></th>
  </tr></thead><tbody>`,
    ...rows.map(t=>{
      const bob = toBOB(t);
      const debtName = (t.debtId && db.debts.find(d=>d.id===t.debtId)?.name) || '';
      return `<tr>
        <td>${t.date}</td>
        <td>${t.type}</td>
        <td>${t.group}</td>
        <td>${t.category}</td>
        <td>${t.tag||''}</td>
        <td>${debtName}</td>
        <td>${t.debtId ? (t.isInterest?'Sí':'No') : ''}</td>
        <td>${t.currency}</td>
        <td>${t.amount.toFixed(2)}</td>
        <td>${bob.toFixed(2)}</td>
        <td>${t.notes||''}</td>
        <td><button class="btn ghost" data-del="${t.id}">✕</button></td>
      </tr>`;
    }),
    `</tbody></table>`];
  $("#txTable").innerHTML = html.join('');
  $("#txTable").querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click', ()=>{
      db.tx = db.tx.filter(x=>x.id!==b.dataset.del);
      save(); renderTable(); renderDebts();
    })
  });
}
renderTable();

$("#search").addEventListener('input', renderTable);
$("#filterTag").addEventListener('change', renderTable);
$("#filterGroup").addEventListener('change', renderTable);
$("#filterDebt").addEventListener('change', renderTable);

// Export/Import
$("#exportJson").addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(db,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ledgerlite-tn.json'; a.click();
});

$("#exportCsv").addEventListener('click', ()=>{
  const head = ['id','date','type','group','category','tag','debtId','isInterest','currency','fx','amount','amount_bob','notes'];
  const rows = db.tx.map(t=>{
    const bob = toBOB(t);
    return [t.id,t.date,t.type,t.group,t.category,t.tag||'',t.debtId||'',t.isInterest,t.currency,t.fx||'',t.amount,bob,t.notes||'']
      .map(x=>`"${String(x).replaceAll('"','""')}"`).join(',');
  });
  const csv = [head.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ledgerlite-tn.csv'; a.click();
});

$("#importJson").addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(data && (data.tx||data.debts)) db = Object.assign({tx:[],cats:[],tags:[],debts:[]}, data);
      save(); refreshMeta(); renderTable(); renderDebts();
      alert('Importado.');
    }catch(err){ alert('Archivo inválido'); }
  };
  reader.readAsText(file);
});

// Helpers
function monthFilter(tx, ym){ return tx.filter(t => (t.date||'').slice(0,7) === ym); }
function sumBOB(list, pred){ return list.filter(pred).reduce((s,t)=> s + toBOB(t), 0); }
function fmt(n){ return new Intl.NumberFormat('es-BO',{style:'currency',currency:'BOB'}).format(n); }

// Debt computations
function debtSaldo(debtId){
  const inflow = sumBOB(db.tx, t=> t.debtId===debtId && t.type==='ingreso'); // préstamos recibidos
  const capOut = sumBOB(db.tx, t=> t.debtId===debtId && t.type!=='ingreso' && !t.isInterest); // pagos capital
  const interestPaid = sumBOB(db.tx, t=> t.debtId===debtId && t.isInterest && t.type!=='ingreso');
  return {saldo: inflow - capOut, interestPaid};
}
function renderDebts(){
  const rows = db.debts.map(d=>{
    const k = debtSaldo(d.id);
    return `<tr>
      <td>${d.name}</td>
      <td>${d.currency}</td>
      <td>${(d.currency==='USD' ? d.fx.toFixed(4) : '-')}</td>
      <td>${fmt(k.saldo)}</td>
      <td>${fmt(k.interestPaid)}</td>
      <td><button class="btn ghost" data-del-debt="${d.id}">Eliminar</button></td>
    </tr>`;
  });
  $("#debtTable").innerHTML = `<table><thead><tr>
    <th>Nombre</th><th>Moneda</th><th>TC</th><th>Saldo (BOB)</th><th>Interés pagado (BOB)</th><th></th>
  </tr></thead><tbody>${rows.join('')||'<tr><td colspan="6">Sin deudas</td></tr>'}</tbody></table>`;
  $("#debtTable").querySelectorAll('[data-del-debt]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.delDebt;
      if(!confirm('¿Eliminar deuda? Los movimientos quedan, pero sin vínculo.')) return;
      db.debts = db.debts.remove?db.debts.remove(id):db.debts.filter(x=>x.id!==id);
      db.tx = db.tx.map(t=> t.debtId===id ? {...t, debtId:""} : t );
      save(); refreshMeta(); renderDebts(); renderTable();
    });
  });
}
renderDebts();

// Finance calculations
function recalc(){
  const ym = $("#period").value || new Date().toISOString().slice(0,7);
  $("#period").value = ym;
  const mtx = monthFilter(db.tx, ym);

  // EERR (mensual)
  const ventas = sumBOB(mtx, t=> t.group==='ventas' && t.type==='ingreso');
  const costos = sumBOB(mtx, t=> t.group==='costos');
  const opex   = sumBOB(mtx, t=> t.group==='opex');
  const interesesGasto = sumBOB(mtx, t=> t.group==='financieros' && t.isInterest && t.type!=='ingreso');
  const interesesIngreso = sumBOB(mtx, t=> t.group==='financieros' && t.isInterest && t.type==='ingreso');
  const finOtrosIn = sumBOB(mtx, t=> t.group==='financieros' && !t.isInterest && t.type==='ingreso' && !t.debtId);
  const finOtrosOut = sumBOB(mtx, t=> t.group==='financieros' && !t.isInterest && t.type!=='ingreso' && !t.debtId);
  const resultadoOp = ventas - costos - opex;
  const resultadoFin = (interesesIngreso - interesesGasto) + (finOtrosIn - finOtrosOut);
  const utilidadNeta = resultadoOp + resultadoFin;

  $("#plBox").innerHTML = `
    Ventas: <b>${fmt(ventas)}</b><br>
    Costos de ventas: <b>${fmt(costos)}</b><br>
    OPEX: <b>${fmt(opex)}</b><br>
    Resultado operativo: <b>${fmt(resultadoOp)}</b><br>
    Resultado financiero: <b>${fmt(resultadoFin)}</b><br>
    <hr>
    <div>Utilidad neta: <b>${fmt(utilidadNeta)}</b></div>
  `;

  // Flujo de caja (mensual, directo)
  const opIn  = sumBOB(mtx, t=> (t.group==='ventas' && t.type==='ingreso'));
  const opOut = sumBOB(mtx, t=> (t.group==='costos' || t.group==='opex' || (t.group==='financieros' && t.isInterest && t.type!=='ingreso')));
  const cfOp = opIn - opOut;
  const inv  = sumBOB(mtx, t=> t.group==='activos'); // egresos en inversión
  const finIn = sumBOB(mtx, t=> (t.group==='patrimonio' && t.type==='ingreso') || (t.debtId && t.type==='ingreso')); // aportes + préstamos
  const finOut = sumBOB(mtx, t=> (t.group==='patrimonio' && t.type!=='ingreso') || (t.debtId && t.type!=='ingreso' && !t.isInterest)); // retiros + capital deuda
  const cfFin = finIn - finOut;
  const neto  = cfOp - inv + cfFin;

  $("#cfBox").innerHTML = `
    Operación: <b>${fmt(cfOp)}</b><br>
    Inversión: <b>${fmt(-inv)}</b><br>
    Financiación (incl. deudas): <b>${fmt(cfFin)}</b><br>
    <hr>
    <div>Variación neta de caja: <b>${fmt(neto)}</b></div>
  `;

  // Balance simple (acumulado)
  const all = db.tx;
  const caja = sumBOB(all, t=> t.type==='ingreso' && (t.group==='ventas' || t.group==='financieros' || t.group==='patrimonio'))
             - sumBOB(all, t=> (t.group==='costos'||t.group==='opex'|| (t.group==='financieros' && t.type!=='ingreso') || t.group==='activos' || (t.group==='patrimonio' && t.type!=='ingreso')));
  const activosFijos = sumBOB(all, t=> t.group==='activos');
  const deudaTotal = db.debts.reduce((s,d)=> s + debtSaldo(d.id).saldo, 0);
  const patrimonio = sumBOB(all, t=> t.group==='patrimonio' && t.type==='ingreso') - sumBOB(all, t=> t.group==='patrimonio' && t.type!=='ingreso');
  $("#bsBox").innerHTML = `
    Activo corriente (Caja calc.): <b>${fmt(caja)}</b><br>
    Activo no corriente (Activos fijos a costo): <b>${fmt(activosFijos)}</b><br>
    Pasivo (Deuda capital pendiente): <b>${fmt(deudaTotal)}</b><br>
    Patrimonio aportes netos: <b>${fmt(patrimonio)}</b><br>
    <hr>
    <div>Activo ≈ Pasivo + Patrimonio (modelo simplificado)</div>
  `;
}
$("#recalc").addEventListener('click', recalc);
recalc();

// PWA install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  $("#installBtn").style.display = 'inline-flex';
});
$("#installBtn").addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  $("#installBtn").style.display = 'none';
});

// Service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js');
  });
}
