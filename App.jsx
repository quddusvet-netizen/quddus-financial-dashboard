import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, Upload, Plus, Trash2, Save, Calculator, Wallet2, TrendingUp } from "lucide-react";

// --- Types ---
// Converted from TS to JS for Vite React template

const currency = (n) =>
  n.toLocaleString("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });

const pk = (k) => `qfs:${k}`;

const defaultAlloc = {
  debtRepayment: 60000,
  savings: 48000,
  emergency: 12000,
  fixedCosts: 72000,
  variableCosts: 24000,
  skills: 12000,
  charity: 12000,
};

const startDebts = { debtCC: 300000, debtBrother: 400000, debtStudent: 1200000 };

function nextMonth(iso) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [startMonth, setStartMonth] = useState("2025-08");
  const [balances, setBalances] = useState({
    debtCC: startDebts.debtCC,
    debtBrother: startDebts.debtBrother,
    debtStudent: startDebts.debtStudent,
    savingsBal: 0,
    investBal: 0,
    emergencyBal: 0,
  });
  const [incomeTargets, setIncomeTargets] = useState({ stipend: 143000, side: 100000 });

  // Load/save localStorage
  useEffect(() => {
    const saved = localStorage.getItem(pk("state"));
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setRows(s.rows || []);
        setBalances(s.balances || balances);
        setIncomeTargets(s.incomeTargets || incomeTargets);
        setStartMonth(s.startMonth || startMonth);
      } catch {}
    }
    // eslint-disable-next-line
  }, []);

  const persist = () => {
    localStorage.setItem(
      pk("state"),
      JSON.stringify({ rows, balances, incomeTargets, startMonth })
    );
    alert("Saved locally!");
  };

  const addMonth = () => {
    const month = rows.length ? nextMonth(rows[rows.length - 1].month) : startMonth;
    const totalIncome = incomeTargets.stipend + incomeTargets.side;
    const alloc = { ...defaultAlloc };

    // Scale default allocations to total income if needed (keeps same ratios)
    const allocSum =
      alloc.debtRepayment +
      alloc.savings +
      alloc.emergency +
      alloc.fixedCosts +
      alloc.variableCosts +
      alloc.skills +
      alloc.charity;
    if (allocSum !== totalIncome) {
      const ratio = totalIncome / allocSum;
      Object.keys(alloc).forEach(
        (k) => (alloc[k] = Math.round(alloc[k] * ratio))
      );
    }

    const row = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      month,
      stipend: incomeTargets.stipend,
      sideIncome: incomeTargets.side,
      ...alloc,
      ...balances,
    };
    setRows((r) => [...r, row]);
  };

  const recalcFrom = (index) => {
    const r = [...rows];
    let b = { ...balances };
    if (index > 0 && index <= r.length) {
      const prev = r[index - 1];
      b = {
        debtCC: prev.debtCC,
        debtBrother: prev.debtBrother,
        debtStudent: prev.debtStudent,
        savingsBal: prev.savingsBal,
        investBal: prev.investBal,
        emergencyBal: prev.emergencyBal,
      };
    }
    for (let i = index; i < r.length; i++) {
      const row = r[i];
      let repay = row.debtRepayment;
      const payCC = Math.min(repay, b.debtCC);
      b.debtCC -= payCC;
      repay -= payCC;
      const payBro = Math.min(repay, b.debtBrother);
      b.debtBrother -= payBro;
      repay -= payBro;
      const payStu = Math.min(repay, b.debtStudent);
      b.debtStudent -= payStu;
      repay -= payStu;

      b.investBal += row.savings;
      b.emergencyBal += row.emergency;

      r[i] = { ...row, ...b };
    }
    setRows(r);
  };

  useEffect(() => {
    if (rows.length) recalcFrom(0);
    // eslint-disable-next-line
  }, [rows.length]);

  const totals = useMemo(() => {
    const sum = (k) => rows.reduce((a, x) => a + (x[k] || 0), 0);
    const income = sum("stipend") + sum("sideIncome");
    const outflow =
      sum("debtRepayment") +
      sum("savings") +
      sum("emergency") +
      sum("fixedCosts") +
      sum("variableCosts") +
      sum("skills") +
      sum("charity");
    const last = rows[rows.length - 1];
    const netWorth = last ? last.investBal + last.emergencyBal - (last.debtCC + last.debtBrother + last.debtStudent) : -(startDebts.debtCC + startDebts.debtBrother + startDebts.debtStudent);
    return { income, outflow, netWorth };
  }, [rows]);

  const exportJSON = () => {
    const blob = new Blob([
      JSON.stringify({ rows, balances, incomeTargets, startMonth }, null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qfs_dashboard_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result));
        setRows(s.rows || []);
        setBalances(s.balances || balances);
        setIncomeTargets(s.incomeTargets || incomeTargets);
        setStartMonth(s.startMonth || startMonth);
      } catch (e) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const resetAll = () => {
    if (!confirm("Reset all data?")) return;
    setRows([]);
    setBalances({ ...startDebts, savingsBal: 0, investBal: 0, emergencyBal: 0 });
    localStorage.removeItem(pk("state"));
  };

  const chartData = rows.map((r) => ({
    month: r.month,
    netWorth: r.investBal + r.emergencyBal - (r.debtCC + r.debtBrother + r.debtStudent),
  }));

  return (
    <div className="min-h-screen" style={{background:"#fafafa"}}>
      <div className="max-w-6xl" style={{margin:"0 auto", padding:"24px"}}>
        <header style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <h1 style={{fontSize:"28px", fontWeight:800, display:"flex", alignItems:"center", gap:"8px"}}><Wallet2 size={28}/> Quddus Financial Dashboard</h1>
          <div style={{display:"flex", gap:"8px"}}>
            <button onClick={persist} style={btn() }><Save size={16}/>Save</button>
            <button onClick={exportJSON} style={btn()}><Download size={16}/>Export</button>
            <label style={{...btn(), cursor:"pointer", display:"flex", alignItems:"center", gap:"6px"}}>
              <Upload size={16}/> Import
              <input type="file" style={{display:"none"}} accept="application/json" onChange={(e)=> e.target.files && importJSON(e.target.files[0])}/>
            </label>
            <button onClick={resetAll} style={{...btn(), color:"#b00020"}}><Trash2 size={16}/>Reset</button>
          </div>
        </header>

        {/* Setup cards */}
        <section style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"16px", marginTop:"16px"}}>
          <div style={card()}>
            <h2 style={h2()}>Income Targets</h2>
            <div style={{display:"grid", gap:"8px"}}>
              <label style={row()}>
                <span>Stipend (₨)</span>
                <input type="number" style={input()} value={incomeTargets.stipend} onChange={(e)=> setIncomeTargets({...incomeTargets, stipend: Number(e.target.value)})}/>
              </label>
              <label style={row()}>
                <span>Side income (₨)</span>
                <input type="number" style={input()} value={incomeTargets.side} onChange={(e)=> setIncomeTargets({...incomeTargets, side: Number(e.target.value)})}/>
              </label>
              <div style={{fontSize:"12px", color:"#666"}}>Total monthly: <b>{currency(incomeTargets.stipend + incomeTargets.side)}</b></div>
            </div>
          </div>

          <div style={card()}>
            <h2 style={h2()}>Starting Balances</h2>
            <div style={{display:"grid", gap:"6px", fontSize:"14px"}}>
              <div style={row()}><span>Credit card</span><b>{currency(balances.debtCC)}</b></div>
              <div style={row()}><span>Brother loan</span><b>{currency(balances.debtBrother)}</b></div>
              <div style={row()}><span>Student loan</span><b>{currency(balances.debtStudent)}</b></div>
              <div style={row()}><span>Investments</span><b>{currency(balances.investBal)}</b></div>
              <div style={row()}><span>Emergency fund</span><b>{currency(balances.emergencyBal)}</b></div>
            </div>
          </div>

          <div style={card()}>
            <h2 style={{...h2(), display:"flex", alignItems:"center", gap:"6px"}}><Calculator size={16}/>Quick Actions</h2>
            <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
              <button onClick={addMonth} style={{...btn(), background:"#111", color:"#fff"}}><Plus size={16}/>Add Month</button>
              <button onClick={()=> recalcFrom(0)} style={btn()}>Recalculate</button>
              <div style={{fontSize:"12px", color:"#666"}}>Start Month: 
                <input type="month" style={{marginLeft:"8px", ...input(), width:"150px"}} value={startMonth} onChange={(e)=> setStartMonth(e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"16px", marginTop:"16px"}}>
          <div style={card()}>
            <div style={{fontSize:"12px", color:"#666"}}>Total Income</div>
            <div style={{fontSize:"24px", fontWeight:800}}>{currency(totals.income)}</div>
          </div>
          <div style={card()}>
            <div style={{fontSize:"12px", color:"#666"}}>Total Allocations</div>
            <div style={{fontSize:"24px", fontWeight:800}}>{currency(totals.outflow)}</div>
          </div>
          <div style={card()}>
            <div style={{fontSize:"12px", color:"#666"}}>Current Net Worth</div>
            <div style={{fontSize:"24px", fontWeight:800", display:"flex", alignItems:"center", gap:"6px"}}><TrendingUp size={22}/>{currency(totals.netWorth)}</div>
          </div>
        </section>

        {/* Table */}
        <section style={{...card(), marginTop:"16px", overflow:"auto"}}>
          <table style={{width:"100%", fontSize:"14px"}}>
            <thead>
              <tr style={{textAlign:"left", borderBottom:"1px solid #eee"}}>
                {["Month","Stipend","Side","Debt","Save","Emerg","Fixed","Var","Skills","Charity","CC","Brother","Student","Invest Bal","Emerg Bal"]
                  .map((h) => (<th key={h} style={{padding:"8px 12px", whiteSpace:"nowrap"}}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{borderBottom:"1px solid #f0f0f0"}}>
                  <td style={{padding:"8px 12px"}}>
                    <input type="month" value={r.month} onChange={(e)=>{
                      const copy = [...rows];
                      copy[i] = { ...copy[i], month: e.target.value };
                      setRows(copy);
                    }} style={{...input(), width:"150px"}}/>
                  </td>
                  {[
                    ["stipend","number"], ["sideIncome","number"], ["debtRepayment","number"], ["savings","number"], ["emergency","number"], ["fixedCosts","number"], ["variableCosts","number"], ["skills","number"], ["charity","number"],
                  ].map(([k, type]) => (
                    <td key={k} style={{padding:"8px 12px"}}>
                      <input type={type} value={r[k]} onChange={(e)=>{
                        const copy = [...rows];
                        copy[i][k] = Number(e.target.value);
                        setRows(copy);
                        recalcFrom(i);
                      }} style={{...input(), width:"120px"}}/>
                    </td>
                  ))}
                  <td style={{padding:"8px 12px"}}>{currency(r.debtCC)}</td>
                  <td style={{padding:"8px 12px"}}>{currency(r.debtBrother)}</td>
                  <td style={{padding:"8px 12px"}}>{currency(r.debtStudent)}</td>
                  <td style={{padding:"8px 12px"}}>{currency(r.investBal)}</td>
                  <td style={{padding:"8px 12px"}}>{currency(r.emergencyBal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Chart */}
        <section style={{...card(), marginTop:"16px"}}>
          <h2 style={h2()}>Net Worth Over Time</h2>
          <div style={{height:"280px"}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v)=> currency(Number(v))} />
                <Line type="monotone" dataKey="netWorth" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <footer style={{fontSize:"12px", color:"#777", textAlign:"center", padding:"16px"}}>
          Built for Quddus • Data is saved in your browser (localStorage). Use Export/Import for backups.
        </footer>
      </div>
    </div>
  );
}

function card(){ return { background:"#fff", borderRadius:"14px", padding:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }; }
function h2(){ return { fontWeight:700, marginBottom:"8px" }; }
function btn(){ return { padding:"8px 12px", borderRadius:"14px", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", display:"inline-flex", alignItems:"center", gap:"6px" }; }
function row(){ return { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }; }
function input(){ return { border:"1px solid #ddd", borderRadius:"12px", padding:"6px 10px" }; }
