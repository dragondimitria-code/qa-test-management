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
  status: "UNTESTED" | "PASS" | "FAIL" | "BLOCKED" | "N/A";
};

const demoCases: Case[] = [
  { id: "demo1", case_key: "SMK-001", title: "Game launches successfully", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is installed.", expected_result: "Game launches without crash.", steps: [{ action: "Launch the game" }, { action: "Verify initial screen" }], tags: ["smoke", "core"], updated_at: "" },
  { id: "demo2", case_key: "SMK-002", title: "Main lobby loads", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is launched.", expected_result: "Main lobby loads.", steps: [{ action: "Wait for lobby" }], tags: ["smoke", "core"], updated_at: "" },
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

  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);
  const [allResultsMap, setAllResultsMap] = useState<Record<string, TestResult[]>>({});

  async function loadData() {
    setLoading(true);
    if (!supabase) {
      setCases(demoCases);
      setLoading(false);
      return;
    }

    const { data: caseData, error } = await supabase.from("test_cases").select("*").order("case_key");
    if (error || !caseData?.length) setCases(demoCases);
    else setCases(caseData as Case[]);

    try {
      const { data: runData } = await supabase.from("test_runs").select("*").order("created_at", { ascending: false });
      if (runData) setRuns(runData as TestRun[]);

      const { data: resultsData } = await supabase.from("test_results").select("*");
      if (resultsData) {
        const map: Record<string, TestResult[]> = {};
        resultsData.forEach((res: any) => {
          if (!map[res.run_id]) map[res.run_id] = [];
          map[res.run_id].push(res as TestResult);
        });
        setAllResultsMap(map);
      }
    } catch (e) {
      console.log("Data fetch error", e);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // FUNGSI MEMBUAT RUN BARU DENGAN PROJECT_ID AMAN
  async function createTestRun() {
    if (!supabase) return;
    const runName = `Run v1.${runs.length + 1} - ${new Date().toLocaleDateString()}`;
    
    // Ambil project_id dari Supabase
    const { data: projData } = await supabase.from("projects").select("id").limit(1).single();
    
    const insertPayload: any = { name: runName, environment: "Android", status: "In Progress" };
    if (projData?.id) insertPayload.project_id = projData.id;

    const { data: newRun, error } = await supabase
      .from("test_runs")
      .insert(insertPayload)
      .select()
      .single();
    
    if (error) {
      console.error("Create run error:", error);
      alert("Gagal membuat Test Run: " + error.message);
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

  async function openRunDetails(run: TestRun) {
    setActiveRun(run);
    if (!supabase) return;
    const { data, error } = await supabase.from("test_results").select("*").eq("run_id", run.id);
    if (error) console.error("Error fetching results:", error);
    if (data) setRunResults(data as TestResult[]);
  }

  // FUNGSI UPDATE STATUS REALTIME
  async function toggleResultStatus(id: string, currentStatus: string, clickedStatus: "PASS" | "FAIL" | "BLOCKED" | "N/A") {
    const newStatus = currentStatus === clickedStatus ? "UNTESTED" : clickedStatus;

    setRunResults(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));

    if (supabase) {
      const { error } = await supabase.from("test_results").update({ status: newStatus }).eq("id", id);
      if (error) {
        alert("Gagal menyimpan ke Supabase: " + error.message);
        setRunResults(prev => prev.map(r => r.id === id ? { ...r, status: currentStatus as any } : r));
      }
    }
  }

  // KALKULATOR SUMMARY PERSENTASE LENGKAP (PASS, FAIL, BLOCKED, N/A, UNTESTED)
  function renderRunStatusSummary(runId: string) {
    const results = activeRun?.id === runId ? runResults : (allResultsMap[runId] || []);
    if (!results.length) return <span className="badge">In Progress</span>;

    const total = results.length;
    const passCount = results.filter(r => r.status === "PASS").length;
    const failCount = results.filter(r => r.status === "FAIL").length;
    const blockedCount = results.filter(r => r.status === "BLOCKED").length;
    const naCount = results.filter(r => r.status === "N/A").length;
    const untestedCount = results.filter(r => r.status === "UNTESTED").length;

    const passRate = Math.round((passCount / total) * 100);
    const failRate = Math.round((failCount / total) * 100);
    const blockedRate = Math.round((blockedCount / total) * 100);
    const naRate = Math.round((naCount / total) * 100);

    if (untestedCount === total) {
      return <span className="badge">Untested (0%)</span>;
    }

    return (
      <div style={{ fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {passCount > 0 && <span style={{ color: "#22c55e", fontWeight: "bold" }}>{passRate}% Pass</span>}
        {failCount > 0 && <span style={{ color: "#ef4444", fontWeight: "bold" }}>• {failRate}% Fail</span>}
        {blockedCount > 0 && <span style={{ color: "#eab308", fontWeight: "bold" }}>• {blockedRate}% Blocked</span>}
        {naCount > 0 && <span style={{ color: "#94a3b8", fontWeight: "bold" }}>• {naRate}% N/A</span>}
        {untestedCount > 0 && <span style={{ color: "#64748b" }}>({untestedCount} Untested)</span>}
      </div>
    );
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
            <button key={x} className={tab === x ? "active" : ""} onClick={() => { setTab(x); setActiveRun(null); loadData(); }}>{x}</button>
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

        {tab === "Dashboard" && <Dashboard cases={cases} counts={counts} runsCount={runs.length} />}

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

        {tab === "Test Runs" && !activeRun && (
          <div className="card">
            <h3>Active Test Runs</h3>
            <table className="table" style={{ marginTop: 16 }}>
              <thead><tr><th>Run Name</th><th>Environment</th><th>Progress / Status</th><th>Action</th></tr></thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td>{r.environment || "Android"}</td>
                    <td>{renderRunStatusSummary(r.id)}</td>
                    <td><button className="btn secondary" onClick={() => openRunDetails(r)}>Execute / View</button></td>
                  </tr>
                ))}
                {runs.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>No active test runs. Click "+ Start New Test Run" to begin!</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Test Runs" && activeRun && (
          <div className="card">
            <button className="btn secondary" style={{ marginBottom: 16 }} onClick={() => { setActiveRun(null); loadData(); }}>← Back to All Runs</button>
            <h2>{activeRun.name}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>Click a button to change status. Click again to UN-SELECT (undo).</p>

            <table className="table">
              <thead><tr><th>Case ID</th><th>Title</th><th>Execution Status</th></tr></thead>
              <tbody>
                {runResults.map((res, index) => {
                  const matchedCase = cases.find(c => (c as any).id === (res as any).case_id || c.case_key === res.case_key) || cases[index];
                  const caseKey = res.case_key || matchedCase?.case_key || `TC-00${index + 1}`;
                  const caseTitle = res.title || matchedCase?.title || "Test Case Execution";

                  return (
                    <tr key={res.id}>
                      <td><b>{caseKey}</b></td>
                      <td>{caseTitle}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button 
                            className="btn" 
                            style={{ 
                              background: res.status === 'PASS' ? '#22c55e' : '#334155', 
                              opacity: res.status === 'PASS' || res.status === 'UNTESTED' ? 1 : 0.4,
                              padding: '4px 10px' 
                            }} 
                            onClick={() => toggleResultStatus(res.id, res.status, 'PASS')}
                          >
                            PASS
                          </button>

                          <button 
                            className="btn" 
                            style={{ 
                              background: res.status === 'FAIL' ? '#ef4444' : '#334155', 
                              opacity: res.status === 'FAIL' || res.status === 'UNTESTED' ? 1 : 0.4,
                              padding: '4px 10px' 
                            }} 
                            onClick={() => toggleResultStatus(res.id, res.status, 'FAIL')}
                          >
                            FAIL
                          </button>

                          <button 
                            className="btn" 
                            style={{ 
                              background: res.status === 'BLOCKED' ? '#eab308' : '#334155', 
                              opacity: res.status === 'BLOCKED' || res.status === 'UNTESTED' ? 1 : 0.4,
                              padding: '4px 10px' 
                            }} 
                            onClick={() => toggleResultStatus(res.id, res.status, 'BLOCKED')}
                          >
                            BLOCKED
                          </button>

                          <button 
                            className="btn" 
                            style={{ 
                              background: res.status === 'N/A' ? '#64748b' : '#334155', 
                              opacity: res.status === 'N/A' || res.status === 'UNTESTED' ? 1 : 0.4,
                              padding: '4px 10px' 
                            }} 
                            onClick={() => toggleResultStatus(res.id, res.status, 'N/A')}
                          >
                            N/A
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Defects" && <Placeholder text="V1 reserves bug_id on test results. Connects directly with Jira or external trackers." title="Defects"/>}

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
              <Field full label="Precondition"><textarea className="textarea" rows={3} value={newCase.precondition} onChange={e => setNewCase({ ...newCase, precondition: e.target.value })} /></Field>
              <Field full label="Steps (one per line)"><textarea className="textarea" rows={5} placeholder={"Open the event\nOpen Shop\nVerify offer"} value={newCase.steps} onChange={e => setNewCase({ ...newCase, steps: e.target.value })} /></Field>
              <Field full label="Expected Result"><textarea className="textarea" rows={4} value={newCase.expected_result} onChange={e => setNewCase({ ...newCase, expected_result: e.target.value })} /></Field>
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