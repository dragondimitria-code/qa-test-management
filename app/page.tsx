"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Case = {
  id: string;
  case_key: string;
  title: string;
  test_type: string;
  module: string;
  priority: string;
  precondition: string;
  expected_result: string;
  steps: { action: string }[];
  tags: string[];
  updated_at: string;
};

type TestRun = {
  id: string;
  name: string;
  environment: string;
  status: string;
  created_at: string;
};

type TestResult = {
  id: string;
  run_id: string;
  case_key: string;
  title: string;
  status: "UNTESTED" | "PASS" | "FAIL" | "BLOCKED";
};

const demoCases: Case[] = [
  { id: "demo1", case_key: "SMK-001", title: "Game launches successfully", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is installed.", expected_result: "Game launches without crash.", steps: [{ action: "Launch the game" }, { action: "Verify initial screen" }], tags: ["smoke", "core"], updated_at: "" },
  { id: "demo2", case_key: "SMK-002", title: "Main lobby loads", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is launched.", expected_result: "Main lobby loads.", steps: [{ action: "Wait for lobby" }, { action: "Verify core UI" }], tags: ["smoke", "core"], updated_at: "" },
  { id: "demo3", case_key: "SAN-001", title: "Alliance Festival offer is displayed", test_type: "Sanity", module: "Alliance Festival", priority: "High", precondition: "Alliance Festival active.", expected_result: "Offer displays properly.", steps: [{ action: "Open Shop" }], tags: ["sanity", "live-ops"], updated_at: "" }
];

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [newCase, setNewCase] = useState({
    case_key: "", title: "", test_type: "Sanity", module: "General", priority: "Medium", precondition: "", expected_result: "", steps: "", tags: ""
  });

  // State khusus Test Runs
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);

  async function loadData() {
    setLoading(true);
    if (!supabase) {
      setCases(demoCases);
      setLoading(false);
      return;
    }
    // Load Test Cases
    const { data: caseData, error } = await supabase.from("test_cases").select("*").order("case_key");
    if (error || !caseData?.length) setCases(demoCases);
    else setCases(caseData as Case[]);

    // Load Test Runs (Safe fetch)
    try {
      const { data: runData } = await supabase.from("test_runs").select("*").order("created_at", { ascending: false });
      if (runData) setRuns(runData as TestRun[]);
    } catch (e) {
      console.log("Test runs table not created yet", e);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Fungsi membuat Test Run baru
  async function createTestRun() {
    if (!supabase) return;
    const runName = `Run v1.${runs.length + 1} - ${new Date().toLocaleDateString()}`;
    const { data: newRun, error } = await supabase.from("test_runs").insert({ name: runName, environment: "Staging" }).select().single();
    
    if (error) {
      alert("Gagal membuat Test Run. Pastikan SQL script di Supabase sudah dijalankan.");
      return;
    }

    if (newRun) {
      const initialResults = cases.map(c => ({
        run_id: newRun.id,
        case_key: c.case_key,
        title: c.title,
        status: "UNTESTED"
      }));
      await supabase.from("test_results").insert(initialResults);
      setRuns(prev => [newRun as TestRun, ...prev]);
      openRunDetails(newRun as TestRun);
    }
  }

  // Buka detail eksekusi test run
  async function openRunDetails(run: TestRun) {
    setActiveRun(run);
    if (!supabase) return;
    const { data } = await supabase.from("test_results").select("*").eq("run_id", run.id);
    if (data) setRunResults(data as TestResult[]);
  }

  // Update status PASS/FAIL/BLOCKED
  async function updateResultStatus(id: string, status: "PASS" | "FAIL" | "BLOCKED") {
    setRunResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (supabase) {
      await supabase.from("test_results").update({ status }).eq("id", id);
    }
  }

  const filtered = useMemo(() => cases.filter(c =>
    (type === "All" || c.test_type === type) &&
    `${c.case_key} ${c.title} ${c.module} ${c.tags?.join(" ")}`.toLowerCase().includes(search.toLowerCase())
  ), [cases, type, search]);

  const counts = {
    total: cases.length,
    smoke: cases.filter(c => c.test_type === "Smoke").length,
    sanity: cases.filter(c => c.test_type === "Sanity").length
  };

  async function saveCase() {
    const project = supabase ? await supabase.from("projects").select("id").eq("key", "GNG").single() : null;
    const steps = newCase.steps.split("\n").map(x => x.trim()).filter(Boolean).map(action => ({ action }));

    if (supabase && project?.data) {
      const { data, error } = await supabase.from("test_cases").insert({
        project_id: project.data.id, case_key: newCase.case_key, title: newCase.title,
        test_type: newCase.test_type, module: newCase.module, priority: newCase.priority,
        precondition: newCase.precondition, expected_result: newCase.expected_result,
        steps, tags: newCase.tags.split(",").map(x => x.trim()).filter(Boolean)
      }).select().single();

      if (error) { alert(error.message); return; }
      setCases(prev => [...prev, data as Case].sort((a, b) => a.case_key.localeCompare(b.case_key)));
    } else {
      setCases(prev => [...prev, { id: crypto.randomUUID(), ...newCase, steps, tags: newCase.tags.split(",").map(x => x.trim()).filter(Boolean), updated_at: "" } as Case]);
    }
    setShowNew(false);
    setNewCase({ case_key: "", title: "", test_type: "Sanity", module: "General", priority: "Medium", precondition: "", expected_result: "", steps: "", tags: "" });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">QA Test Management</div>
        <div className="nav">
          {["Dashboard", "Test Cases", "Test Runs", "Defects", "Reports"].map(x => (
            <button key={x} className={tab === x ? "active" : ""} onClick={() => { setTab(x); setActiveRun(null); }}>{x}</button>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, fontSize: 12, color: "#94a3b8" }}>
          V1 • Smoke + Sanity
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>{tab}</h1>
            <div className="muted">Gods & Glory • GNG</div>
          </div>
          {tab === "Test Cases" && <button className="btn" onClick={() => setShowNew(true)}>+ New Test Case</button>}
          {tab === "Test Runs" && !activeRun && <button className="btn" onClick={createTestRun}>+ Start New Test Run</button>}
        </div>

        {/* TAB 1: DASHBOARD */}
        {tab === "Dashboard" && <Dashboard counts={counts} cases={cases} runsCount={runs.length} />}

        {/* TAB 2: TEST CASES */}
        {tab === "Test Cases" && (
          <>
            <div className="toolbar">
              <input className="input" placeholder="Search ID, title, module..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="select" style={{ width: 150 }} value={type} onChange={e => setType(e.target.value)}>
                <option>All</option><option>Smoke</option><option>Sanity</option><option>Regression</option><option>LQA</option>
              </select>
            </div>
            <div className="tablewrap">
              {loading ? <div className="empty">Loading...</div> : (
                <table className="table">
                  <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Module</th><th>Priority</th><th>Tags</th></tr></thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id}>
                        <td><b>{c.case_key}</b></td>
                        <td>{c.title}<div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{c.expected_result}</div></td>
                        <td><span className="badge">{c.test_type}</span></td>
                        <td>{c.module}</td>
                        <td>{c.priority}</td>
                        <td>{c.tags?.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* TAB 3: TEST RUNS LIST */}
        {tab === "Test Runs" && !activeRun && (
          <div className="card">
            <h3>Active Test Runs</h3>
            <table className="table" style={{ marginTop: 16 }}>
              <thead><tr><th>Run Name</th><th>Environment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td>{r.environment}</td>
                    <td><span className="badge">{r.status}</span></td>
                    <td><button className="btn secondary" onClick={() => openRunDetails(r)}>Execute / View</button></td>
                  </tr>
                ))}
                {runs.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>No active test runs. Click "+ Start New Test Run" to begin!</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: TEST RUN EXECUTION DETAIL */}
        {tab === "Test Runs" && activeRun && (
          <div className="card">
            <button className="btn secondary" style={{ marginBottom: 16 }} onClick={() => setActiveRun(null)}>← Back to All Runs</button>
            <h2>{activeRun.name}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>Click status buttons to execute test cases for this run.</p>

            <table className="table">
              <thead><tr><th>Case ID</th><th>Title</th><th>Execution Status</th></tr></thead>
              <tbody>
                {runResults.map(res => (
                  <tr key={res.id}>
                    <td><b>{res.case_key}</b></td>
                    <td>{res.title}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn" style={{ background: res.status === 'PASS' ? '#22c55e' : '#334155', padding: '4px 12px' }} onClick={() => updateResultStatus(res.id, 'PASS')}>PASS</button>
                        <button className="btn" style={{ background: res.status === 'FAIL' ? '#ef4444' : '#334155', padding: '4px 12px' }} onClick={() => updateResultStatus(res.id, 'FAIL')}>FAIL</button>
                        <button className="btn" style={{ background: res.status === 'BLOCKED' ? '#eab308' : '#334155', padding: '4px 12px' }} onClick={() => updateResultStatus(res.id, 'BLOCKED')}>BLOCKED</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: DEFECTS */}
        {tab === "Defects" && <Placeholder title="Defects" text="V1 reserves bug_id on test results. Connects directly with Jira or external trackers." />}

        {/* TAB 5: REPORTS */}
        {tab === "Reports" && (
          <div className="card">
            <h2>Execution Reports</h2>
            <div className="grid" style={{ marginTop: 16 }}>
              <Metric title="Total Runs Executed" value={runs.length} />
              <Metric title="Repository Coverage" value={`${cases.length} Cases`} />
            </div>
          </div>
        )}
      </main>

      {/* MODAL NEW CASE */}
      {showNew && (
        <div className="modalbg">
          <div className="modal">
            <h2>New Test Case</h2>
            <div className="formgrid">
              <Field label="Case ID"><input className="input" placeholder="SAN-002" value={newCase.case_key} onChange={e => setNewCase({ ...newCase, case_key: e.target.value })} /></Field>
              <Field label="Title"><input className="input" placeholder="Verify ..." value={newCase.title} onChange={e => setNewCase({ ...newCase, title: e.target.value })} /></Field>
              <Field label="Type"><select className="select" value={newCase.test_type} onChange={e => setNewCase({ ...newCase, test_type: e.target.value })}><option>Smoke</option><option>Sanity</option><option>Regression</option><option>LQA</option></select></Field>
              <Field label="Priority"><select className="select" value={newCase.priority} onChange={e => setNewCase({ ...newCase, priority: e.target.value })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></Field>
              <Field label="Module"><input className="input" value={newCase.module} onChange={e => setNewCase({ ...newCase, module: e.target.value })} /></Field>
              <Field label="Tags"><input className="input" placeholder="live-ops, offer" value={newCase.tags} onChange={e => setNewCase({ ...newCase, tags: e.target.value })} /></Field>
              <Field label="Precondition" full><textarea className="textarea" rows={3} value={newCase.precondition} onChange={e => setNewCase({ ...newCase, precondition: e.target.value })} /></Field>
              <Field label="Steps (one per line)" full><textarea className="textarea" rows={5} placeholder={"Open the event\nOpen Shop\nVerify offer"} value={newCase.steps} onChange={e => setNewCase({ ...newCase, steps: e.target.value })} /></Field>
              <Field label="Expected Result" full><textarea className="textarea" rows={4} value={newCase.expected_result} onChange={e => setNewCase({ ...newCase, expected_result: e.target.value })} /></Field>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn" onClick={saveCase} disabled={!newCase.case_key || !newCase.title}>Save Test Case</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={"field " + (full ? "full" : "")}><label>{label}</label>{children}</div>;
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return <div className="card"><h2>{title}</h2><p className="muted">{text}</p></div>;
}

function Dashboard({ counts, cases, runsCount }: { counts: { total: number; smoke: number; sanity: number }; cases: Case[]; runsCount: number }) {
  return (
    <>
      <div className="grid">
        <Metric title="Total Test Cases" value={counts.total} />
        <Metric title="Smoke Suite" value={counts.smoke} />
        <Metric title="Sanity Suite" value={counts.sanity} />
        <Metric title="Total Test Runs" value={runsCount} />
      </div>
      <div className="section grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
        <div className="card">
          <h3>Recommended Smoke Suite</h3>
          <p className="muted">Critical paths: launch, login, lobby, shop, active event access.</p>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{counts.smoke} cases</div>
        </div>
        <div className="card">
          <h3>Current Sanity Scope</h3>
          <p className="muted">Feature-specific validation after changes or Live Ops deployment.</p>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{counts.sanity} cases</div>
        </div>
      </div>
      <div className="section card" style={{ marginTop: 20 }}>
        <h3>Recent Test Cases</h3>
        <table className="table">
          <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Module</th></tr></thead>
          <tbody>
            {cases.slice(0, 8).map((c) => (
              <tr key={c.id}><td>{c.case_key}</td><td>{c.title}</td><td>{c.test_type}</td><td>{c.module}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="card">
      <div className="muted">{title}</div>
      <div className="metric">{value}</div>
    </div>
  );
}