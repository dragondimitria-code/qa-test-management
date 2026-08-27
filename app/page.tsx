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

  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun null |>(null);
  const [runResults, setRunResults] = useState<TestResult[]>([]);

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
    } catch (e) {
      console.log("Test runs table not created yet", e);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function createTestRun() {
    if (!supabase) return;
    const runName = `Run v1.${runs.length + 1} - ${new Date().toLocaleDateString()}`;
    const { data: newRun, error } = await supabase.from("test_runs").insert({ name: runName, environment: "Staging" }).select().single();
    
    if (error) {
      alert("Gagal membuat Test Run.");
      return;
    }

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

        {tab === "Dashboard" &&