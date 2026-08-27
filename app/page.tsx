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
  { id: "demo1", case_key: "SMK-001", title: "Game launches successfully", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is installed.", expected_result: "Game launches without crash.", steps: [{ action: "Launch the game" }], tags: ["smoke"], updated_at: "" },
  { id: "demo2", case_key: "SMK-002", title: "Main lobby loads", test_type: "Smoke", module: "Core", priority: "Critical", precondition: "Game is launched.", expected_result: "Main lobby loads.", steps: [{ action: "Wait for lobby" }], tags: ["smoke"], updated_at: "" },
  { id: "demo3", case_key: "SAN-001", title: "Alliance Festival offer is displayed", test_type: "Sanity", module: "Alliance Festival", priority: "High", precondition: "Event active.", expected_result: "Offer localization correct.", steps: [{ action: "Open Shop" }], tags: ["sanity"], updated_at: "" }
];

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  // Test Run States
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);

  async function loadCases() {
    setLoading(true);
    if (!supabase) { setCases(demoCases); setLoading(false); return; }
    const { data } = await supabase.from("test_cases").select("*").order("case_key");
    setCases(data?.length ? (data as Case[]) : demoCases);
    
    // Load Test Runs
    const { data: runsData } = await supabase.from("test_runs").select("*").order("created_at", { ascending: false });
    if (runsData) setRuns(runsData as TestRun[]);
    setLoading(false);
  }

  useEffect(() => { loadCases(); }, []);

  async function createTestRun(name: string) {
    if (!supabase) return;
    const { data: newRun } = await supabase.from("test_runs").insert({ name, environment: "Staging" }).select().single();
    if (newRun) {
      const initialResults = cases.map(c => ({
        run_id: newRun.id,
        case_id: c.id,
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
    const { data } = await supabase.from("test_results").select("*").eq("run_id", run.id);
    if (data) setRunResults(data as TestResult[]);
  }

  async function updateResultStatus(id: string, status: "PASS" | "FAIL" | "BLOCKED") {
    setRunResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (supabase) {
      await supabase.from("test_results").update({ status }).eq("id", id);
    }
  }

  const filtered = useMemo(() => cases.filter(c =>
    (type === "All" || c.test_type === type) &&
    `${c.case_key} ${c.title} ${c.module}`.toLowerCase().includes(search.toLowerCase())
  ), [cases, type, search]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">QA Test Management</div>
        <div className="nav">
          {["Dashboard", "Test Cases", "Test Runs", "Reports"].map(x => (
            <button key={x} className={tab === x ? "active" : ""} onClick={() => { setTab(x); setActiveRun(null); }}>{x}</button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <h1>{tab}</h1>
        </div>

        {tab === "Dashboard" && (
          <div className="grid">
            <div className="card"><h3>Total Cases</h3><div className="metric">{cases.length}</div></div>
            <div className="card"><h3>Total Runs</h3><div className="metric">{runs.length}</div></div>
          </div>
        )}

        {tab === "Test Cases" && (
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Module</th></tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}><td><b>{c.case_key}</b></td><td>{c.title}</td><td><span className="badge">{c.test_type}</span></td><td>{c.module}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Test Runs" && !activeRun && (
          <div className="card">
            <button className="btn" style={{ marginBottom: 16 }} onClick={() => createTestRun(`Run v1.${runs.length + 1} - ${new Date().toLocaleDateString()}`)}>
              + Start New Test Run
            </button>
            <table className="table">
              <thead><tr><th>Run Name</th><th>Environment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td>{r.environment}</td>
                    <td>{r.status}</td>
                    <td><button className="btn secondary" onClick={() => openRunDetails(r)}>Execute / View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Test Runs" && activeRun && (
          <div className="card">
            <button className="btn secondary" style={{ marginBottom: 16 }} onClick={() => setActiveRun(null)}>← Back to Runs</button>
            <h2>{activeRun.name}</h2>
            <table className="table">
              <thead><tr><th>Case ID</th><th>Title</th><th>Result Status</th></tr></thead>
              <tbody>
                {runResults.map(res => (
                  <tr key={res.id}>
                    <td><b>{res.case_key}</b></td>
                    <td>{res.title}</td>
                    <td>
                      <button className={`btn ${res.status === 'PASS' ? '' : 'secondary'}`} style={{ marginRight: 4, background: res.status === 'PASS' ? '#22c55e' : '' }} onClick={() => updateResultStatus(res.id, 'PASS')}>PASS</button>
                      <button className={`btn ${res.status === 'FAIL' ? '' : 'secondary'}`} style={{ marginRight: 4, background: res.status === 'FAIL' ? '#ef4444' : '' }} onClick={() => updateResultStatus(res.id, 'FAIL')}>FAIL</button>
                      <button className={`btn ${res.status === 'BLOCKED' ? '' : 'secondary'}`} style={{ background: res.status === 'BLOCKED' ? '#eab308' : '' }} onClick={() => updateResultStatus(res.id, 'BLOCKED')}>BLOCKED</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Reports" && (
          <div className="card">
            <h2>Execution Summary</h2>
            <p className="muted">Total Test Runs Executed: <b>{runs.length}</b></p>
          </div>
        )}
      </main>
    </div>
  );
}