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
  case_id?: string;
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

  const [showRunModal, setShowRunModal] = useState(false);
  const [runNameInput, setRunNameInput] = useState("");
  const [selectedCaseKeys, setSelectedCaseKeys] = useState<string[]>([]);

  async function loadData() {
    setLoading(true);
    if (!supabase) {
      setCases(demoCases);
      setLoading(false);
      return;
    }

    const { data: caseData, error } = await supabase.from("test_cases").select("*").order("case_key");
    const activeCases = (error || !caseData?.length) ? demoCases : (caseData as Case[]);
    setCases(activeCases);

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

  function openCreateRunModal() {
    const targetCases = cases.length > 0 ? cases : demoCases;
    setRunNameInput(`Run v1.${runs.length + 1} - ${new Date().toLocaleDateString()}`);
    setSelectedCaseKeys(targetCases.map(c => c.case_key));
    setShowRunModal(true);
  }

  // BIKIN TEST RUN BARU HANYA DENGAN CASES YANG DICHENTANG
  async function submitCreateTestRun() {
    if (!selectedCaseKeys.length) {
      alert("Pilih minimal 1 test case!");
      return;
    }

    const targetCases = (cases.length > 0 ? cases : demoCases).filter(c => selectedCaseKeys.includes(c.case_key));

    if (!supabase) {
      const mockRun: TestRun = { id: `mock-${Date.now()}`, name: runNameInput, environment: "Android", status: "In Progress", created_at: new Date().toISOString() };
      const initialResults = targetCases.map((c, i) => ({
        id: `mock-res-${i}`,
        run_id: mockRun.id,
        case_id: c.id,
        case_key: c.case_key,
        title: c.title,
        status: "UNTESTED" as const
      }));
      setRuns(prev => [mockRun, ...prev]);
      setRunResults(initialResults);
      setAllResultsMap(prev => ({ ...prev, [mockRun.id]: initialResults }));
      setActiveRun(mockRun);
      setShowRunModal(false);
      return;
    }

    const { data: projData } = await supabase.from("projects").select("id").limit(1).single();
    const insertPayload: any = { name: runNameInput, environment: "Android", status: "In Progress" };
    if (projData?.id) insertPayload.project_id = projData.id;

    const { data: newRun, error } = await supabase.from("test_runs").insert(insertPayload).select().single();
    if (error) {
      alert("Gagal membuat Test Run: " + error.message);
      return;
    }

    if (newRun) {
      const initialResults = targetCases.map(c => ({
        run_id: newRun.id,
        case_id: c.id,
        case_key: c.case_key,
        title: c.title,
        status: "UNTESTED"
      }));

      const { data: insertedResults, error: resErr } = await supabase.from("test_results").insert(initialResults).select();
      if (resErr) {
        console.error("Insert initial results error:", resErr);
        alert("Gagal menyimpan daftar cases ke Supabase: " + resErr.message);
      }

      setRuns(prev => [newRun as TestRun, ...prev]);

      const finalResults = (insertedResults && insertedResults.length > 0) 
        ? (insertedResults as TestResult[]) 
        : initialResults.map((r, i) => ({ ...r, id: `temp-${i}` })) as TestResult[];

      setRunResults(finalResults);
      setAllResultsMap(prev => ({ ...prev, [newRun.id]: finalResults }));
      setActiveRun(newRun as TestRun);
      setShowRunModal(false);
    }
  }

  async function deleteTestRun(runId: string, runName: string) {
    if (!confirm(`Apakah kamu yakin ingin menghapus "${runName}"?`)) return;

    setRuns(prev => prev.filter(r => r.id !== runId));
    if (activeRun?.id === runId) setActiveRun(null);

    if (supabase) {
      const { error } = await supabase.from("test_runs").delete().eq("id", runId);
      if (error) alert("Gagal menghapus dari Supabase: " + error.message);
      else loadData();
    }
  }

  // BUKA RUN DETAILS (HANYA AMBIL DATA DARI SUPABASE MILIK RUN INI)
  async function openRunDetails(run: TestRun) {
    setActiveRun(run);
    if (!supabase) return;

    const { data, error } = await supabase.from("test_results").select("*").eq("run_id", run.id);
    if (error) {
      console.error("Fetch run details error:", error);
    }

    if (data && data.length > 0) {
      setRunResults(data as TestResult[]);
    } else {
      // Jika data memang kosong/terjadi kegagalan fetch, jangan replace dengan semua repo cases!
      setRunResults([]);
    }
  }

  // UPDATE STATUS AMAN & REALTIME
  async function toggleResultStatus(resItem: TestResult, clickedStatus: "PASS" | "FAIL" | "BLOCKED" | "N/A") {
    const currentStatus = resItem.status;
    const newStatus = currentStatus === clickedStatus ? "UNTESTED" : clickedStatus;

    // 1. Update lokal state instan
    const updatedList = runResults.map(r => r.id === resItem.id || r.case_key === resItem.case_key ? { ...r, status: newStatus as any } : r);
    setRunResults(updatedList);
    if (activeRun) {
      setAllResultsMap(prev => ({ ...prev, [activeRun.id]: updatedList }));
    }

    // 2. Simpan permanen ke Supabase
    if (supabase) {
      if (resItem.id.startsWith("temp-")) {
        const { data: upsertData } = await supabase.from("test_results").insert({
          run_id: resItem.run_id,
          case_id: resItem.case_id,
          case_key: resItem.case_key,
          title: resItem.title,
          status: newStatus
        }).select().single();

        if (upsertData) {
          const syncedList = updatedList.map(r => r.case_key === resItem.case_key ? (upsertData as TestResult) : r);
          setRunResults(syncedList);
          if (activeRun) setAllResultsMap(prev => ({ ...prev, [activeRun.id]: syncedList }));
        }
      } else {
        const { error } = await supabase.from("test_results").update({ status: newStatus }).eq("id", resItem.id);
        if (error) {
          alert("Gagal menyimpan status ke Supabase: " + error.message);
          const reverted = runResults.map(r => r.id === resItem.id ? { ...r, status: currentStatus as any } : r);
          setRunResults(reverted);
          if (activeRun) setAllResultsMap(prev => ({ ...prev, [activeRun.id]: reverted }));
        }
      }
    }
  }

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

    if (untestedCount === total) return <span className="badge">Untested (0%)</span>;

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
          {tab === "Test Runs" && !activeRun && <button className="btn" onClick={openCreateRunModal}>+ Start New Test Run</button>}
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

        {/* TAB 3: TEST RUNS LIST */}
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
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn secondary" onClick={() => openRunDetails(r)}>Execute / View</button>
                        <button className="btn" style={{ background: "#ef4444", padding: "4px 10px" }} onClick={() => deleteTestRun(r.id, r.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>No active test runs. Click "+ Start New Test Run" to begin!</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: EXECUTION DETAIL */}
        {tab === "Test Runs" && activeRun && (
          <div className="card">
            <button className="btn secondary" style={{ marginBottom: 16 }} onClick={() => { setActiveRun(null); loadData(); }}>← Back to All Runs</button>
            <h2>{activeRun.name}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>Click a button to change status. Click again to UN-SELECT (undo).</p>

            <table className="table">
              <thead><tr><th>Case ID</th><th>Title</th><th>Execution Status</th></tr></thead>
              <tbody>
                {runResults.map((res, index) => {
                  const matchedCase = cases.find(c => c.id === res.case_id || c.case_key === res.case_key);
                  const caseKey = res.case_key || matchedCase?.case_key || `TC-00${index + 1}`;
                  const caseTitle = res.title || matchedCase?.title || "Test Case Execution";

                  return (
                    <tr key={res.id || index}>
                      <td><b>{caseKey}</b></td>
                      <td>{caseTitle}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn" style={{ background: res.status === 'PASS' ? '#22c55e' : '#334155', opacity: res.status === 'PASS' || res.status === 'UNTESTED' ? 1 : 0.4, padding: '4px 10px' }} onClick={() => toggleResultStatus(res, 'PASS')}>PASS</button>
                          <button className="btn" style={{ background: res.status === 'FAIL' ? '#ef4444' : '#334155', opacity: res.status === 'FAIL' || res.status === 'UNTESTED' ? 1 : 0.4, padding: '4px 10px' }} onClick={() => toggleResultStatus(res, 'FAIL')}>FAIL</button>
                          <button className="btn" style={{ background: res.status === 'BLOCKED' ? '#eab308' : '#334155', opacity: res.status === 'BLOCKED' || res.status === 'UNTESTED' ? 1 : 0.4, padding: '4px 10px' }} onClick={() => toggleResultStatus(res, 'BLOCKED')}>BLOCKED</button>
                          <button className="btn" style={{ background: res.status === 'N/A' ? '#64748b' : '#334155', opacity: res.status === 'N/A' || res.status === 'UNTESTED' ? 1 : 0.4, padding: '4px 10px' }} onClick={() => toggleResultStatus(res, 'N/A')}>N/A</button>
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

      {/* MODAL 1: CREATE TEST RUN & SELECT TEST CASES */}
      {showRunModal && (
        <div className="modalbg">
          <div className="modal" style={{ maxWidth: 600 }}>
            <h2>Create New Test Run</h2>
            <div className="field full" style={{ marginTop: 16 }}>
              <label>Run Name</label>
              <input className="input" value={runNameInput} onChange={e => setRunNameInput(e.target.value)} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
              <label style={{ fontWeight: "bold" }}>Select Test Cases to Include ({selectedCaseKeys.length}):</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setSelectedCaseKeys((cases.length > 0 ? cases : demoCases).map(c => c.case_key))}>Select All</button>
                <button className="btn secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setSelectedCaseKeys([])}>Deselect All</button>
              </div>
            </div>

            <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #334155", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {(cases.length > 0 ? cases : demoCases).map(c => (
                <label key={c.case_key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedCaseKeys.includes(c.case_key)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCaseKeys(prev => [...prev, c.case_key]);
                      else setSelectedCaseKeys(prev => prev.filter(k => k !== c.case_key));
                    }}
                  />
                  <span><b>[{c.case_key}]</b> {c.title} <span className="badge" style={{ marginLeft: 6 }}>{c.test_type}</span></span>
                </label>
              ))}
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn secondary" onClick={() => setShowRunModal(false)}>Cancel</button>
              <button className="btn" onClick={submitCreateTestRun}>Create & Execute</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW TEST CASE */}
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