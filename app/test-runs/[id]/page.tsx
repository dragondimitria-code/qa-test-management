'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function TestExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const runId = resolvedParams.id

  const [run, setRun] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExecutionData()
  }, [runId])

  async function fetchExecutionData() {
    setLoading(true)
    const { data: runData } = await supabase.from('test_runs').select('*').eq('id', runId).single()
    setRun(runData)

    const { data: resData } = await supabase
      .from('test_results')
      .select('*, test_cases(*)')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })

    if (resData) setResults(resData)
    setLoading(false)
  }

  async function updateStatus(resultId: string, status: string, bugId: string = '') {
    const { error } = await supabase
      .from('test_results')
      .update({
        status,
        bug_id: bugId,
        executed_at: new Date().toISOString(),
      })
      .eq('id', resultId)

    if (!error) {
      setResults((prev) =>
        prev.map((r) => (r.id === resultId ? { ...r, status, bug_id: bugId } : r))
      )
    }
  }

  // Metric Stats
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const blocked = results.filter((r) => r.status === 'BLOCKED').length

  // Counter terpisah untuk penomoran otomatis
  let smokeCount = 0
  let sanityCount = 0

  return (
    <div style={{ padding: 24, color: '#f8fafc' }}>
      <Link href="/test-runs" style={{ color: '#60a5fa', fontSize: 14 }}>← Back to Test Runs</Link>
      
      {run && (
        <div style={{ margin: '16px 0 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{run.name}</h1>
            <p style={{ color: '#94a3b8' }}>Build: {run.build} | Env: {run.environment}</p>
          </div>
          <Link
            href={`/test-runs/${runId}/report`}
            style={{ background: '#0284c7', color: '#fff', textDecoration: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 14, fontWeight: 'bold' }}
          >
            View Summary Report 📊
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <span style={{ padding: '6px 12px', background: '#1e293b', borderRadius: 4 }}>Total: {total}</span>
        <span style={{ padding: '6px 12px', background: '#065f46', color: '#34d399', borderRadius: 4 }}>PASS: {passed}</span>
        <span style={{ padding: '6px 12px', background: '#991b1b', color: '#fca5a5', borderRadius: 4 }}>FAIL: {failed}</span>
        <span style={{ padding: '6px 12px', background: '#9a3412', color: '#fdba74', borderRadius: 4 }}>BLOCKED: {blocked}</span>
      </div>

      {loading ? (
        <p>Loading execution items...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((item) => {
            const tc = item.test_cases

            // Penomoran otomatis berurutan
            let displayIndex = tc.case_key
            if (tc.test_type === 'Smoke') {
              smokeCount++
              displayIndex = `GNG-SMK-${String(smokeCount).padStart(3, '0')}`
            } else if (tc.test_type === 'Sanity') {
              sanityCount++
              displayIndex = `GNG-SAN-${String(sanityCount).padStart(3, '0')}`
            }

            return (
              <div
                key={item.id}
                style={{
                  background: '#1e293b',
                  padding: 16,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderLeft: `4px solid ${
                    item.status === 'PASS' ? '#10b981' : item.status === 'FAIL' ? '#ef4444' : item.status === 'BLOCKED' ? '#f97316' : '#64748b'
                  }`
                }}
              >
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 'bold' }}>
                    {displayIndex} • <span style={{ color: '#94a3b8' }}>{tc.module}</span>
                  </div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{tc.title}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item.status === 'FAIL' && (
                    <input
                      type="text"
                      placeholder="Bug ID (e.g. BUG-101)"
                      defaultValue={item.bug_id}
                      onBlur={(e) => updateStatus(item.id, 'FAIL', e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#fff', fontSize: 12 }}
                    />
                  )}

                  <button
                    onClick={() => updateStatus(item.id, 'PASS')}
                    style={{
                      background: item.status === 'PASS' ? '#10b981' : '#334155',
                      color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer'
                    }}
                  >
                    PASS
                  </button>

                  <button
                    onClick={() => updateStatus(item.id, 'FAIL')}
                    style={{
                      background: item.status === 'FAIL' ? '#ef4444' : '#334155',
                      color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer'
                    }}
                  >
                    FAIL
                  </button>

                  <button
                    onClick={() => updateStatus(item.id, 'BLOCKED')}
                    style={{
                      background: item.status === 'BLOCKED' ? '#f97316' : '#334155',
                      color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer'
                    }}
                  >
                    BLOCKED
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}