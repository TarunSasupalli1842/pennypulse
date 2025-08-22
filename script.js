/* ========= Shared Utilities & Constants ========= */
const CATS = [
  "Food","Rent","Travel","Shopping","Entertainment","Health","Bills","Education","Investments","Others"
];

const DEFAULT_BUDGET_PCT = {
  Food: 0.15, Rent: 0.30, Travel: 0.08, Shopping: 0.08, Entertainment: 0.06,
  Health: 0.07, Bills: 0.10, Education: 0.06, Investments: 0.10, Others: 0.04
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => "₹" + (Number(n||0)).toLocaleString("en-IN");

function getSalary(){ return Number(localStorage.getItem("salary")||0); }
function setSalary(v){ localStorage.setItem("salary", String(v)); }
function getExpenses(){ return JSON.parse(localStorage.getItem("expenses")||"[]"); }
function setExpenses(arr){ localStorage.setItem("expenses", JSON.stringify(arr)); }
function getBudgets(){ return JSON.parse(localStorage.getItem("budgets")||"{}"); }
function setBudgets(obj){ localStorage.setItem("budgets", JSON.stringify(obj)); }

function startOfDay(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x = startOfDay(d); const day = x.getDay(); const diff = (day + 6) % 7; x.setDate(x.getDate()-diff); return x; } // Monday
function startOfMonth(d){ const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function inRange(d, from, to){ const t=d.getTime(); return t>=from.getTime() && t<=to.getTime(); }
function monthLabel(d){ return d.toLocaleString('en-US',{month:'short', year:'2-digit'}); }

/* ========= Theme Toggle ========= */
(function initTheme(){
  const btn = $("themeToggle");
  if(!btn) return;
  const root = document.documentElement;
  if(localStorage.getItem("theme")==="dark") root.classList.add("dark");
  btn.onclick = () => {
    root.classList.toggle("dark");
    localStorage.setItem("theme", root.classList.contains("dark")?"dark":"light");
  };
})();

/* ========= HOME PAGE ========= */
(function homePage(){
  const input = $("salaryInput"), saveBtn = $("saveSalaryBtn"), clearBtn = $("clearDataBtn");
  const salarySavedMsg = $("salarySavedMsg"), splitList = $("salarySplit"), salaryChartEl = $("salaryChart");
  if(!input || !saveBtn) return;

  const saved = getSalary(); if(saved>0) input.value = saved;

  function renderSalarySplit(){
    const sal = Number(input.value||0);
    if(sal<=0){ splitList.innerHTML=""; if(window.salaryChart) window.salaryChart.destroy(); return; }
    const essentials = sal*0.50, lifestyle = sal*0.30, savings = sal*0.20;
    splitList.innerHTML = `
      <li>Essentials (50%): <b>${fmt(essentials)}</b></li>
      <li>Lifestyle (30%): <b>${fmt(lifestyle)}</b></li>
      <li>Savings (20%): <b>${fmt(savings)}</b></li>
    `;
    if(window.salaryChart) window.salaryChart.destroy();
    const ctx = salaryChartEl.getContext("2d");
    window.salaryChart = new Chart(ctx, {
      type:"pie",
      data:{ labels:["Essentials","Lifestyle","Savings"], datasets:[{ data:[essentials,lifestyle,savings], backgroundColor:["#4CAF50","#FF9800","#2196F3"] }]},
      options:{ plugins:{ legend:{ position:'bottom' } } }
    });
  }

  saveBtn.onclick = ()=>{
    const val = Number(input.value||0);
    if(val<=0) return alert("Enter a valid salary.");
    setSalary(val); salarySavedMsg.textContent = "✅ Salary saved";
    renderSalarySplit(); renderQuickSummary(); computeDefaultBudgets();
  };

  clearBtn && (clearBtn.onclick = ()=>{
    if(!confirm("Clear all app data (salary, expenses, budgets)?")) return;
    localStorage.removeItem("salary"); localStorage.removeItem("expenses"); localStorage.removeItem("budgets");
    location.reload();
  });

  function renderQuickSummary(){
    const sal = getSalary(); const exps = getExpenses();
    const now=new Date(), sMonth = startOfMonth(now), eMonth = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const monthSpent = exps.filter(e=> inRange(new Date(e.date), sMonth, eMonth )).reduce((s,e)=>s+Number(e.amount),0);
    $("sumSalary").textContent = fmt(sal);
    $("sumExpenses").textContent = fmt(monthSpent);
    $("sumSavings").textContent = fmt(Math.max(0, sal - monthSpent));
    const pct = sal>0 ? Math.min(100, (monthSpent/sal)*100) : 0;
    $("spendProgress").value = pct;
    $("spendProgressText").textContent = `${pct.toFixed(1)}% of salary spent`;
  }

  renderSalarySplit(); renderQuickSummary();
})();

/* ========= EXPENSES PAGE ========= */
(function expensesPage(){
  const amount = $("expAmount"), category = $("expCategory"), date = $("expDate"), note = $("expNote");
  const addBtn = $("addExpenseBtn"), tableBody = $("expTable"), alertsDiv = $("alerts");
  const catChartEl = $("catChart"), budgetsGrid = $("budgetsGrid"), saveBudgetsBtn = $("saveBudgetsBtn");
  const exportBtn = $("exportCsvBtn"), importBtn = $("importCsvBtn"), fileInput = $("importCsvInput");

  if(!amount || !category || !addBtn) return;

  // init categories
  CATS.forEach(c=>{
    const opt = document.createElement("option");
    opt.value=c; opt.textContent=c; category.appendChild(opt);
  });
  if(!date.value) date.valueAsDate = new Date();

  // budgets UI
  function computeDefaultBudgets(){
    const sal = getSalary(); const defaults = {};
    CATS.forEach(c => defaults[c] = Math.round((DEFAULT_BUDGET_PCT[c]||0.05) * sal));
    return defaults;
  }
  window.computeDefaultBudgets = computeDefaultBudgets;

  function renderBudgets(){
    const saved = getBudgets(); const base = Object.keys(saved).length ? saved : computeDefaultBudgets();
    budgetsGrid.innerHTML = "";
    CATS.forEach(c=>{
      const wrap = document.createElement("div");
      wrap.innerHTML = `<label>${c} (₹/month)</label><input type="number" min="0" id="b_${c}" value="${base[c]||0}">`;
      budgetsGrid.appendChild(wrap);
    });
  }
  renderBudgets();

  if(saveBudgetsBtn){
    saveBudgetsBtn.onclick = () => {
      const obj = {}; CATS.forEach(c => obj[c] = Number(($(`b_${c}`)||{}).value||0));
      setBudgets(obj); alert("Budgets saved."); renderAlerts();
    };
  }

  addBtn.onclick = () => {
    const a = Number(amount.value||0);
    if(a<=0) return alert("Enter a valid amount.");
    const exp = { amount:a, category: category.value || "Others", date: (date.value ? new Date(date.value) : new Date()).toISOString(), note: (note.value||"").trim() };
    const arr = getExpenses(); arr.push(exp); setExpenses(arr);
    amount.value=""; note.value=""; if(!date.value) date.valueAsDate = new Date();
    renderSummary(); renderTable(); renderChart(); renderAlerts();
  };

  function renderSummary(){
    const arr = getExpenses(); const now=new Date();
    const sDay = startOfDay(now), eDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(),23,59,59,999);
    const sWeek = startOfWeek(now), eWeek = new Date(sWeek.getFullYear(), sWeek.getMonth(), sWeek.getDate()+6,23,59,59,999);
    const sMonth = startOfMonth(now), eMonth = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const sumRange=(from,to)=> arr.filter(x=>inRange(new Date(x.date),from,to)).reduce((s,x)=>s+Number(x.amount),0);
    $("sumDay").textContent = fmt(sumRange(sDay,eDay));
    $("sumWeek").textContent = fmt(sumRange(sWeek,eWeek));
    $("sumMonth").textContent = fmt(sumRange(sMonth,eMonth));
  }

  function renderTable(){
    const arr = getExpenses().slice().reverse();
    tableBody.innerHTML = arr.map((x,i)=>`
      <tr>
        <td>${new Date(x.date).toLocaleDateString()}</td>
        <td><span class="badge">${x.category}</span></td>
        <td>${x.note?x.note:"—"}</td>
        <td><b>${fmt(x.amount)}</b></td>
        <td><button class="ghost" data-del="${arr.length-1-i}">Delete</button></td>
      </tr>
    `).join("");
    tableBody.querySelectorAll("button[data-del]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-del"));
        const arr = getExpenses(); arr.splice(idx,1); setExpenses(arr);
        renderSummary(); renderTable(); renderChart(); renderAlerts();
      };
    });
  }

  function renderChart(){
    const arr = getExpenses();
    const now = new Date(); const sMonth = startOfMonth(now), eMonth = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const month = arr.filter(x=> inRange(new Date(x.date), sMonth, eMonth));
    const byCat = {}; CATS.forEach(c=>byCat[c]=0);
    month.forEach(x=> byCat[x.category] = (byCat[x.category]||0)+Number(x.amount));
    const labels = Object.keys(byCat).filter(k=>byCat[k]>0);
    const data = labels.map(k=>byCat[k]);
    if(window.catChart) window.catChart.destroy();
    if(labels.length){
      const ctx = catChartEl.getContext("2d");
      window.catChart = new Chart(ctx,{ type:"doughnut", data:{ labels, datasets:[{ data, backgroundColor:["#FF5722","#4CAF50","#2196F3","#9C27B0","#FFC107","#009688","#E91E63"] }]}, options:{ plugins:{ legend:{ position:'bottom' } } }});
    } else { if(window.catChart) window.catChart.destroy(); catChartEl.getContext("2d").clearRect(0,0,catChartEl.width,catChartEl.height); }
  }

  function renderAlerts(){
    alertsDiv.innerHTML = "";
    const sal = getSalary();
    const budgets = Object.keys(getBudgets()).length ? getBudgets() : computeDefaultBudgets();
    const now = new Date(); const sMonth = startOfMonth(now), eMonth = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    const arr = getExpenses().filter(x=> inRange(new Date(x.date), sMonth, eMonth));
    const total = arr.reduce((s,x)=>s+Number(x.amount),0);
    if(sal>0 && total/sal >= 0.8) alertsDiv.innerHTML += `<p class="warn">⚠️ You’ve spent over 80% of your salary this month.</p>`;
    const byCat = {}; arr.forEach(x=> byCat[x.category]=(byCat[x.category]||0)+Number(x.amount));
    Object.keys(byCat).forEach(cat=>{
      const cap = Number(budgets[cat]||0);
      if(cap>0 && byCat[cat] > cap) alertsDiv.innerHTML += `<p class="warn">⚠️ ${cat}: ${fmt(byCat[cat])} exceeded your budget of ${fmt(cap)}.</p>`;
    });
  }

  /* ===== CSV Export (same format) ===== */
  function expensesToCsv(expArr){
    const rows=[["date","category","amount","note"]];
    expArr.forEach(e=>{
      const d = (new Date(e.date)).toISOString().split("T")[0];
      const note = (e.note||"").replace(/"/g,'""');
      rows.push([d,e.category,String(e.amount),`"${note}"`]);
    });
    return rows.map(r=>r.join(",")).join("\n");
  }
  function exportExpensesCSV(){
    const arr = getExpenses();
    if(!arr.length){ alert("No expenses to export."); return; }
    const csv = expensesToCsv(arr);
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    const now=new Date(), stamp = now.toISOString().split("T")[0];
    a.href=url; a.download=`expenses-${stamp}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  /* ===== CSV Import with PapaParse + dedupe =====
     Rules:
       - Accept header row with date,category,amount,note (case-insensitive)
       - Date as YYYY-MM-DD or parseable ISO
       - Skip invalid rows (invalid date or amount<=0)
       - Deduplicate with simple key: date|category|amount|note (case-insensitive, trimmed)
  */
  function importCsvWithPapa(file){
    if(!file){ alert("Select a CSV file first."); return; }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: function(results){
        const rows = results.data;
        if(!rows || !rows.length){ alert("No rows found in CSV."); return; }
        const parsed = [];
        for(const r of rows){
          const dateRaw = (r.date || r.Date || "").toString().trim();
          const cat = (r.category || r.Category || "Others").toString().trim();
          const amtRaw = (r.amount || r.Amount || "").toString().trim();
          const note = (r.note || r.Note || "").toString().trim();
          // normalize date
          let dateObj = null;
          if(/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) dateObj = new Date(dateRaw + "T00:00:00");
          else { const nd = new Date(dateRaw); if(!isNaN(nd)) dateObj = nd; }
          const amt = parseFloat(amtRaw);
          if(!dateObj || isNaN(amt) || amt <= 0) continue;
          parsed.push({ date: dateObj.toISOString(), category: cat || "Others", amount: amt, note });
        }
        if(!parsed.length){ alert("No valid rows found in CSV."); return; }
        // dedupe: build set of existing keys
        const existing = getExpenses();
        const key = e => `${(new Date(e.date)).toISOString().split("T")[0]}|${(e.category||"").toLowerCase().trim()}|${Number(e.amount)}|${(e.note||"").toLowerCase().trim()}`;
        const existSet = new Set(existing.map(key));
        const toAdd = parsed.filter(p => !existSet.has(key(p)));
        if(!toAdd.length){ alert("No new rows to import (duplicates skipped)."); return; }
        const merged = existing.concat(toAdd);
        setExpenses(merged);
        renderSummary(); renderTable(); renderChart(); renderAlerts();
        alert(`Imported ${toAdd.length} new rows (duplicates skipped).`);
      },
      error: function(err){ alert("CSV parse error: " + (err.message || err)); }
    });
  }

  // wire CSV buttons
  exportBtn && exportBtn.addEventListener("click", exportExpensesCSV);
  importBtn && importBtn.addEventListener("click", ()=> {
    const f = fileInput && fileInput.files && fileInput.files[0];
    importCsvWithPapa(f);
  });

  // init
  function init(){ renderSummary(); renderTable(); renderChart(); renderAlerts(); renderBudgets(); }
  init();
})();

/* ========= INVESTMENTS PAGE ========= */
(function investmentsPage(){
  const invSalary = $("invSalary"), invExpenses = $("invExpenses"), invPotential = $("invPotential");
  const riskSelect = $("riskSelect"), genBtn = $("genPlanBtn"), plan = $("invPlan"), invChartEl = $("invChart");
  if(!invSalary || !genBtn) return;

  function currentMonthSpend(){
    const arr = getExpenses(); const now = new Date(), sMonth = startOfMonth(now), eMonth = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59,999);
    return arr.filter(x=> inRange(new Date(x.date), sMonth, eMonth)).reduce((s,x)=>s+Number(x.amount),0);
  }

  function renderHeader(){
    const sal = getSalary(); const spent = currentMonthSpend(); const potential = Math.max(0, sal - spent);
    invSalary.textContent = fmt(sal); invExpenses.textContent = fmt(spent); invPotential.textContent = fmt(potential);
  }

  function genPlan(){
    const sal = getSalary(); const spent = currentMonthSpend(); const investable = Math.max(0, sal - spent);
    const risk = riskSelect.value;
    let buckets;
    if(risk==="low") buckets = { "Bank FD/RD":0.35, "PPF / Govt Bonds":0.35, "Gold ETF":0.20, "Emergency Fund":0.10 };
    else if(risk==="moderate") buckets = { "Index Funds (SIP)":0.45, "Debt Funds":0.25, "Gold ETF":0.15, "Emergency Fund":0.15 };
    else buckets = { "Stocks/Equity":0.55, "Aggressive Mutual Funds":0.30, "Gold / Alt":0.10, "Cash Buffer":0.05 };

    const rows = Object.entries(buckets).map(([k,p])=> `<li>${k}: <b>${fmt(Math.round(investable*p))}</b></li>`).join("");
    plan.innerHTML = `<h3 class="mb8">Suggested Allocation</h3><ul class="bullets">${rows}</ul>`;

    if(window.invChart) window.invChart.destroy();
    const ctx = invChartEl.getContext("2d");
    window.invChart = new Chart(ctx,{
      type:"pie",
      data:{ labels:Object.keys(buckets), datasets:[{ data:Object.values(buckets).map(p=>Math.round(investable*p)) }]},
      options:{ plugins:{ legend:{ position:'bottom' } } }
    });
  }

  genBtn.onclick = genPlan;
  renderHeader(); genPlan();
})();

/* ========= REPORTS PAGE ========= */
(function reportsPage(){
  const monthBar = $("monthBar"), catLine = $("catLine");
  if(!monthBar || !catLine) return;
  const arr = getExpenses(); const now = new Date(); const months=[];
  for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i,1); const start=startOfMonth(d); const end=new Date(d.getFullYear(), d.getMonth()+1, 0,23,59,59,999); const spent=arr.filter(x=>inRange(new Date(x.date),start,end)).reduce((s,x)=>s+Number(x.amount),0); months.push({label:monthLabel(d),spent}); }
  const salary = getSalary(); const salarySeries = months.map(()=>salary); const savingsSeries = months.map(m=>Math.max(0,salary-m.spent));
  new Chart(monthBar.getContext("2d"),{ type:"bar", data:{ labels:months.map(m=>m.label), datasets:[ { label:"Salary", data:salarySeries, backgroundColor:"#16a34a" }, { label:"Expenses", data:months.map(m=>m.spent), backgroundColor:"#ef4444" }, { label:"Savings (Est.)", data:savingsSeries, backgroundColor:"#2563eb" } ]}, options:{ responsive:true, plugins:{ legend:{ position:'bottom' }}, scales:{ y:{ beginAtZero:true } } } });

  const catMap = {}; CATS.forEach(c=>catMap[c]=Array(6).fill(0));
  arr.forEach(x=>{ const dx=new Date(x.date); for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i,1); const start=startOfMonth(d); const end=new Date(d.getFullYear(), d.getMonth()+1, 0,23,59,59,999); if(inRange(dx,start,end)){ catMap[x.category][5-i]+=Number(x.amount); break; } } });
  const top = Object.entries(catMap).map(([k,vals])=>({k,total:vals.reduce((s,v)=>s+v,0),vals})).sort((a,b)=>b.total-a.total).slice(0,3);
  if(top.length) new Chart(catLine.getContext("2d"),{ type:"line", data:{ labels: months.map(m=>m.label), datasets: top.map(t=>({ label:t.k, data:t.vals, tension:.3 })) }, options:{ plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } } } });
})();
