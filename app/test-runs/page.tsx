'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function TestRunsPage() {
  const [testRuns, setTestRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [build, setBuild] = useState('6.6.6')
  const [environment, setEnvironment] = useState('Android')
  const [suiteType, setSuiteType] = useState('ALL') // ALL, Smoke, Sanity

  useEffect(() => {
    fetchTestRuns()
  }, [])

  async function fetchTestRuns() {
    setLoading(true)
    const { data, error } = await supabase
      .from('test_runs')
      .select('*, projects(key, name)')
      .order('created_at', { ascending: false })

    if (data) setTestRuns(data)
    setLoading(false)
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault()

    // 1. Ambil Project ID GNG
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('key', 'GNG')
      .single()

    if (!project) return alert('Project GNG tidak ditemukan!')

    // 2. Buat Test Run Baru
    const { data: run, error: runError } = await supabase
      .from('test_runs')
      .insert({
        project_id: project.id,
        name: name || `Test Run ${new Date().toLocaleDateString()}`,
        build: build,
        environment: environment,
      })
      .select()
      .single()

    if (runError || !run) return alert('Gagal membuat Test Run!')

    // 3. Ambil Test Cases sesuai Suite yang dipilih
    let query = supabase.from('test_cases').select('id').eq('project_id', project.id)
    if (suiteType !== 'ALL') {
      query = query.eq('test_type', suiteType)
    }

    const { data: cases } = await query

    if (cases && cases.length > 0) {
      // 4. Generate initial Results (Status: NOT RUN)
      const initialResults = cases.map((c) => ({
        run_id: run.id,
        test_case_id: c.id,
        status: 'NOT RUN',
      }))

      await supabase.from('test_results').insert(initialResults)
    }

    setShowModal(false)
    setName('')
    fetchTestRuns()
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Test Runs</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer' }}
        >
          + Create Test Run
        </button>
      </div>

      {loading ? (
        <p>Loading test runs...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {testRuns.length === 0 && <p>Belum ada Test Run. Klik tombol di atas untuk membuat!</p>}
          {testRuns.map((run) => (
            <div key={run.id} style={{ background: '#1e293b', padding: 16, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>{run.name}</h3>
                <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 12 }}>Build: {run.build}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 12 }}>Env: {run.environment}</span>
              </div>
              <Link
                href={`/test-runs/${run.id}`}
                style={{ background: '#059669', color: '#fff', textDecoration: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 14 }}
              >
                Execute Checklist ➔
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleCreateRun} style={{ background: '#0f172a', padding: 24, borderRadius: 8, width: 400, color: '#fff' }}>
            <h3>Create New Test Run</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Run Name</label>
              <input
                type="text"
                placeholder="e.g. Sanity Check Release 6.6.6"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Build Version</label>
              <input
                type="text"
                value={build}
                onChange={(e) => setBuild(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Platform / Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
              >
                <option value="Android">Android</option>
                <option value="iOS">iOS</option>
                <option value="Cross-Platform">Cross-Platform</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Select Test Suite Scope</label>
              <select
                value={suiteType}
                onChange={(e) => setSuiteType(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
              >
                <option value="ALL">All Test Cases (256 cases)</option>
                <option value="Smoke">Smoke Test Only (209 cases)</option>
                <option value="Sanity">Sanity Test Only (47 cases)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 12px', background: 'transparent', color: '#ccc', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Create Run</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}