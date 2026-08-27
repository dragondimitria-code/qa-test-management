 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Case = {
  id:string; case_key:string; title:string; test_type:string; module:string;
  priority:string; precondition:string; expected_result:string; steps:{action:string}[];
  tags:string[]; updated_at:string;
};

const demoCases: Case[] = [
  {id:"demo1",case_key:"SMK-001",title:"Game launches successfully",test_type:"Smoke",module:"Core",priority:"Critical",precondition:"Game is installed.",expected_result:"Game launches without crash.",steps:[{action:"Launch the game"},{action:"Verify initial screen"}],tags:["smoke","core"],updated_at:""},
  {id:"demo2",case_key:"SMK-002",title:"Main lobby loads",test_type:"Smoke",module:"Core",priority:"Critical",precondition:"Game is launched.",expected_result:"Main lobby loads.",steps:[{action:"Wait for lobby"},{action:"Verify core UI"}],tags:["smoke","core"],updated_at:""},
  {id:"demo3",case_key:"SAN-001",title:"Alliance Festival offer is displayed",test_type:"Sanity",module:"Alliance Festival",priority:"High",precondition:"Alliance Festival is active.",expected_result:"Offer, price, contents and localization are correct.",steps:[{action:"Open Alliance Festival"},{action:"Open Shop"},{action:"Verify offer"}],tags:["sanity","live-ops","offer"],updated_at:""}
];

export default function Home(){
  const [tab,setTab]=useState("Dashboard");
  const [cases,setCases]=useState<Case[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [type,setType]=useState("All");
  const [showNew,setShowNew]=useState(false);
  const [newCase,setNewCase]=useState({case_key:"",title:"",test_type:"Sanity",module:"General",priority:"Medium",precondition:"",expected_result:"",steps:"",tags:""});

  async function loadCases(){
    setLoading(true);
    if(!supabase){ setCases(demoCases); setLoading(false); return; }
    const {data,error}=await supabase.from("test_cases").select("*").order("case_key");
    if(error || !data?.length) setCases(data?.length ? data : demoCases);
    else setCases(data as Case[]);
    setLoading(false);
  }
  useEffect(()=>{loadCases()},[]);

  const filtered=useMemo(()=>cases.filter(c=>
    (type==="All"||c.test_type===type) &&
    `${c.case_key} ${c.title} ${c.module} ${c.tags?.join(" ")}`.toLowerCase().includes(search.toLowerCase())
  ),[cases,type,search]);

  const counts={
    total:cases.length,
    smoke:cases.filter(c=>c.test_type==="Smoke").length,
    sanity:cases.filter(c=>c.test_type==="Sanity").length
  };

  async function saveCase(){
    const project = supabase ? await supabase.from("projects").select("id").eq("key","GNG").single() : null;
    const steps=newCase.steps.split("\n").map(x=>x.trim()).filter(Boolean).map(action=>({action}));
    if(supabase && project?.data){
      const {data,error}=await supabase.from("test_cases").insert({
        project_id:project.data.id, case_key:newCase.case_key, title:newCase.title,
        test_type:newCase.test_type,module:newCase.module,priority:newCase.priority,
        precondition:newCase.precondition,expected_result:newCase.expected_result,
        steps,tags:newCase.tags.split(",").map(x=>x.trim()).filter(Boolean)
      }).select().single();
      if(error){alert(error.message);return}
      setCases(prev=>[...prev,data as Case].sort((a,b)=>a.case_key.localeCompare(b.case_key)));
    }else{
      setCases(prev=>[...prev,{id:crypto.randomUUID(),...newCase,steps,tags:newCase.tags.split(",").map(x=>x.trim()).filter(Boolean),updated_at:""} as Case]);
    }
    setShowNew(false);
    setNewCase({case_key:"",title:"",test_type:"Sanity",module:"General",priority:"Medium",precondition:"",expected_result:"",steps:"",tags:""});
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">QA Test Management</div>
      <div className="nav">
        {["Dashboard","Test Cases","Test Runs","Defects","Reports"].map(x=>
          <button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>
        )}
      </div>
      <div style={{position:"absolute",bottom:20,left:16,right:16,fontSize:12,color:"#94a3b8"}}>V1 • Smoke + Sanity</div>
    </aside>
    <main className="main">
      <div className="top">
        <div><h1>{tab}</h1><div className="muted">Gods & Glory • GNG</div></div>
        {tab==="Test Cases" && <button className="btn" onClick={()=>setShowNew(true)}>+ New Test Case</button>}
      </div>

      {tab==="Dashboard" && <Dashboard counts={counts} cases={cases}/>}
      {tab==="Test Cases" && <>
        <div className="toolbar">
          <input className="input" placeholder="Search ID, title, module..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="select" style={{width:150}} value={type} onChange={e=>setType(e.target.value)}>
            <option>All</option><option>Smoke</option><option>Sanity</option><option>Regression</option><option>LQA</option>
          </select>
        </div>
        <div className="tablewrap">
          {loading?<div className="empty">Loading...</div>:<table className="table"><thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Module</th><th>Priority</th><th>Tags</th></tr></thead><tbody>
            {filtered.map(c=><tr key={c.id}><td><b>{c.case_key}</b></td><td>{c.title}<div className="muted" style={{fontSize:12,marginTop:5}}>{c.expected_result}</div></td><td><span className="badge">{c.test_type}</span></td><td>{c.module}</td><td>{c.priority}</td><td>{c.tags?.join(", ")}</td></tr>)}
          </tbody></table>}
        </div>
      </>}
      {tab==="Test Runs" && <Placeholder title="Test Runs" text="V1 database schema is ready for Smoke/Sanity execution. The next module will create runs, assign cases and record PASS / FAIL / BLOCKED / NOT RUN."/>}
      {tab==="Defects" && <Placeholder title="Defects" text="V1 reserves bug_id on test results. This can later connect to Jira or another tracker without changing the test-case database."/>}
      {tab==="Reports" && <Placeholder title="Reports" text="The database already separates test runs from test cases, so execution history and pass-rate reports can be added without redesigning the schema."/>}
    </main>

    {showNew && <div className="modalbg"><div className="modal">
      <h2>New Test Case</h2>
      <div className="formgrid">
        <Field label="Case ID"><input className="input" placeholder="SAN-002" value={newCase.case_key} onChange={e=>setNewCase({...newCase,case_key:e.target.value})}/></Field>
        <Field label="Title"><input className="input" placeholder="Verify ..." value={newCase.title} onChange={e=>setNewCase({...newCase,title:e.target.value})}/></Field>
        <Field label="Type"><select className="select" value={newCase.test_type} onChange={e=>setNewCase({...newCase,test_type:e.target.value})}><option>Smoke</option><option>Sanity</option><option>Regression</option><option>LQA</option></select></Field>
        <Field label="Priority"><select className="select" value={newCase.priority} onChange={e=>setNewCase({...newCase,priority:e.target.value})}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></Field>
        <Field label="Module"><input className="input" value={newCase.module} onChange={e=>setNewCase({...newCase,module:e.target.value})}/></Field>
        <Field label="Tags"><input className="input" placeholder="live-ops, offer" value={newCase.tags} onChange={e=>setNewCase({...newCase,tags:e.target.value})}/></Field>
        <Field label="Precondition" full><textarea className="textarea" rows={3} value={newCase.precondition} onChange={e=>setNewCase({...newCase,precondition:e.target.value})}/></Field>
        <Field label="Steps (one per line)" full><textarea className="textarea" rows={5} placeholder={"Open the event\nOpen Shop\nVerify offer"} value={newCase.steps} onChange={e=>setNewCase({...newCase,steps:e.target.value})}/></Field>
        <Field label="Expected Result" full><textarea className="textarea" rows={4} value={newCase.expected_result} onChange={e=>setNewCase({...newCase,expected_result:e.target.value})}/></Field>
      </div>
      <div className="actions"><button className="btn secondary" onClick={()=>setShowNew(false)}>Cancel</button><button className="btn" onClick={saveCase} disabled={!newCase.case_key||!newCase.title}>Save Test Case</button></div>
    </div></div>}
  </div>
}

function Field({label,children,full=false}:{label:string,children:React.ReactNode,full?:boolean}){return <div className={"field "+(full?"full":"")}><label>{label}</label>{children}</div>}
function Placeholder({title,text}:{title:string,text:string}){return <div className="card"><h2>{title}</h2><p className="muted">{text}</p></div>}
function Dashboard({counts,cases}:{counts:{total:number,smoke:number,sanity:number},cases:Case[]}){
 return <><div className="grid">
   <Metric title="Total Test Cases" value={counts.total}/>
   <Metric title="Smoke" value={counts.smoke}/>
   <Metric title="Sanity" value={counts.sanity}/>
   <Metric title="Project" value="GNG"/>
 </div>
 <div className="section grid" style={{gridTemplateColumns:"1fr 1fr"}}>
   <div className="card"><h3>Recommended Smoke Suite</h3><p className="muted">Critical paths: launch, login, lobby, shop, active event access.</p><div style={{fontSize:24,fontWeight:800}}>{counts.smoke} cases</div></div>
   <div className="card"><h3>Current Sanity Scope</h3><p className="muted">Feature-specific validation after changes or Live Ops deployment.</p><div style={{fontSize:24,fontWeight:800}}>{counts.sanity} cases</div></div>
 </div>
 <div className="section card"><h3>Recent Test Cases</h3><table className="table"><thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Module</th></tr></thead><tbody>{cases.slice(0,8).map(c=><tr key={c.id}><td>{c.case_key}</td><td>{c.title}</td><td>{c.test_type}</td><td>{c.module}</td></tr>)}</tbody></table></div>
 </>}
function Metric({title,value}:{title:string,value:number|string}){return <div className="card"><div className="muted">{title}</div><div className="metric">{value}</div></div>}