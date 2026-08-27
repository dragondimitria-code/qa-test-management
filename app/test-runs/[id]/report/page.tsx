'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'

export default function TestReportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const runId = resolvedParams.id

  const [run, setRun] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
  }, [runId])

  async function fetchReportData() {
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

  // Calculation Metrics
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const blocked = results.filter((r) => r.status === 'BLOCKED').length
  const notRun = results.filter((r) => r.status === 'NOT RUN').length

  const executed = passed + failed + blocked
  const passRate = executed > 0 ? ((passed / total) * 100).toFixed(1) : '0.0'
  const failedItems = results.filter((r) => r.status === 'FAIL')

  // Export to CSV Function
  function exportToCSV() {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Case ID,Module,Title,Status,Bug ID\n'

    let smokeCount = 0
    let sanityCount = 0

    results.forEach((item) => {
      const tc = item.test_cases
      let displayIndex = tc.case_key
      if (tc.test_type === 'Smoke') {
        smokeCount++
        displayIndex = `GNG-SMK-${String(smokeCount).padStart(3, '0')}`
      } else if (tc.test_type === 'Sanity') {
        sanityCount++
        displayIndex = `GNG-SAN-${String(sanityCount).padStart(3, '0')}`
      }

      const row = `"${displayIndex}","${tc.module}","${tc.title.replace(/"/g, '""')}","${item.status}","${item.bug_id || '-'}"`
      csvContent += row + '\n'
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Test_Report_${run?.name || 'Run'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ padding: 24, color: '#f8fafc', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href={`/test-runs/${runId}`} style={{ color: '#60a5fa', fontSize: 14 }}>
          ← Back to Execution Checklist
        </Link>
        <button
          onClick={exportToCSV}
          style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
        >
          📥 Export CSV Report
        </button>
      </div>

      {run && (
        <div style={{ margin: '20px 0' }}>
          <h1 style={{ marginBottom: 4, color: '#f8fafc' }}>{run.name} • Execution Summary</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Build: {run.build} | Environment: {run.environment}</p>
        </div>
      )}

      {loading ? (
        <p>Loading report data...</p>
      ) : (
        <>
          {/* Progress & Pass Rate Visual */}
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 'bold' }}>Pass Rate: {passRate}%</span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>Executed: {executed} / {total} cases</span>
            </div>

            {/* Multi-Color Progress Bar */}
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: '#334155' }}>
              <div style={{ width: `${(passed / total) * 100}%`, background: '#10b981' }} title={`Passed: ${passed}`} />
              <div style={{ width: `${(failed / total) * 100}%`, background: '#ef4444' }} title={`Failed: ${failed}`} />
              <div style={{ width: `${(blocked / total) * 100}%`, background: '#f97316' }} title={`Blocked: ${blocked}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#34d399', fontSize: 20, fontWeight: 'bold' }}>{passed}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>PASS</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#fca5a5', fontSize: 20, fontWeight: 'bold' }}>{failed}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>FAIL</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#fdba74', fontSize: 20, fontWeight: 'bold' }}>{blocked}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>BLOCKED</div>
              </div>
              <div style={{ background: '#0f172a', padding: 12, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: 20, fontWeight: 'bold' }}>{notRun}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>NOT RUN</div>
              </div>
            </div>
          </div>

          {/* Failed Items Triage Section */}
          <div style={{ background: '#1e293b', padding: 20, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0, color: '#ef4444' }}>
              🚨 Failed Test Cases & Open Bugs ({failedItems.length})
            </h3>

            {failedItems.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Tidak ada test case yang FAIL. Excellent job!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {failedItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#0f172a',
                      padding: 12,
                      borderRadius: 6,
                      borderLeft: '4px solid #ef4444',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 'bold' }}>
                        {item.test_cases?.module}
                      </div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>{item.test_cases?.title}</div>
                    </div>

                    <div style={{ background: '#991b1b', color: '#fef2f2', padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>
                      {item.bug_id ? `Bug: ${item.bug_id}` : 'No Bug ID Added'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}