import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { usePerformance } from '../hooks/usePerformance'
import { usePosts } from '../hooks/usePosts'
import { generatePerformanceReport, generateLearningRules } from '../lib/anthropic'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const REPORT_CACHE_KEY = 'asg_perf_report'

export default function Performance() {
  const [tab, setTab] = useState('entry')
  const { performance, fetchPerformance, savePerformance } = usePerformance()
  const { posts, fetchPosts } = usePosts()
  const [livePosts, setLivePosts] = useState([])
  const [rules, setRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entryForm, setEntryForm] = useState({ post_id: '', platform: '', reach: '', likes: '', comments: '', shares: '', clicks: '' })
  const [entrySaving, setEntrySaving] = useState(false)
  const [entrySuccess, setEntrySuccess] = useState(false)

  useEffect(() => {
    fetchPosts({ status: 'live' }).then(data => setLivePosts(data))
    fetchRules()
  }, [])

  const fetchRules = async () => {
    const { data } = await supabase.from('content_rules').select('*').order('created_at', { ascending: false })
    setRules(data || [])
  }

  const handleEntrySave = async () => {
    setEntrySaving(true)
    try {
      const post = livePosts.find(p => p.id === entryForm.post_id)
      await savePerformance({
        post_id: entryForm.post_id,
        platform: post?.platform || entryForm.platform,
        reach: parseInt(entryForm.reach) || 0,
        likes: parseInt(entryForm.likes) || 0,
        comments: parseInt(entryForm.comments) || 0,
        shares: parseInt(entryForm.shares) || 0,
        clicks: parseInt(entryForm.clicks) || 0,
        recorded_at: new Date().toISOString(),
      })
      setEntrySuccess(true)
      setEntryForm({ post_id: '', platform: '', reach: '', likes: '', comments: '', shares: '', clicks: '' })
      setTimeout(() => setEntrySuccess(false), 3000)
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setEntrySaving(false)
    }
  }

  const handleGenerateReport = async () => {
    setReportLoading(true)
    try {
      const perfData = await fetchPerformance({ dateFrom, dateTo })
      const postsData = posts.filter(p => {
        if (!p.scheduled_date) return false
        return p.scheduled_date >= dateFrom && p.scheduled_date <= dateTo
      })
      const text = await generatePerformanceReport(perfData, postsData)
      setReportText(text)
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify({ text, date: format(new Date(), 'yyyy-MM-dd') }))
    } catch (e) {
      alert('Report generation failed: ' + e.message)
    } finally {
      setReportLoading(false)
    }
  }

  const handleGenerateRules = async () => {
    setRulesLoading(true)
    try {
      const perfData = await fetchPerformance({ dateFrom: format(subDays(new Date(), 60), 'yyyy-MM-dd') })
      const suggestions = await generateLearningRules(perfData, posts)

      await Promise.all(suggestions.map(s =>
        supabase.from('content_rules').insert([{ suggestion: s, approved: false }])
      ))
      fetchRules()
    } catch (e) {
      alert('Failed: ' + e.message)
    } finally {
      setRulesLoading(false)
    }
  }

  const handleApproveRule = async (id) => {
    const verifyAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('content_rules').update({ approved: true, verify_at: verifyAt }).eq('id', id)
    fetchRules()
  }

  const handleDismissRule = async (id) => {
    await supabase.from('content_rules').delete().eq('id', id)
    fetchRules()
  }

  const handleVerifyRule = async (id, worked) => {
    await supabase.from('content_rules').update({
      verified: true,
      result: worked ? 'Confirmed working — pattern holds' : 'Not confirmed — insufficient evidence',
    }).eq('id', id)
    fetchRules()
  }

  const numInput = (key) => ({
    type: 'number',
    min: 0,
    value: entryForm[key],
    onChange: e => setEntryForm(p => ({ ...p, [key]: e.target.value })),
    className: 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy',
  })

  const engagement = entryForm.reach > 0
    ? (((parseInt(entryForm.likes || 0) + parseInt(entryForm.comments || 0) + parseInt(entryForm.shares || 0)) / parseInt(entryForm.reach)) * 100).toFixed(2)
    : null

  const tabs = ['entry', 'reports', 'rules']

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-navy-dark mb-6">Performance</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold font-sans capitalize transition-all ${
              tab === t ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'entry' ? 'Data Entry' : t === 'reports' ? 'Reports' : 'Learning Rules'}
          </button>
        ))}
      </div>

      {/* Data entry */}
      {tab === 'entry' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-serif font-bold text-navy-dark">Log Post Performance</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">Select Post</label>
            <select value={entryForm.post_id} onChange={e => setEntryForm(p => ({ ...p, post_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy bg-white">
              <option value="">Select a live post…</option>
              {livePosts.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.platform}] {p.scheduled_date} — {p.copy?.substring(0, 60)}…
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[['reach', 'Reach'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['clicks', 'Clicks']].map(([k, l]) => (
              <div key={k}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">{l}</label>
                <input {...numInput(k)} />
              </div>
            ))}
          </div>

          {engagement && (
            <div className="bg-teal/10 border border-teal/20 rounded-xl p-3 text-sm font-sans">
              Engagement rate: <strong className="text-teal">{engagement}%</strong>
            </div>
          )}

          {entrySuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-sans">
              Performance data saved successfully!
            </div>
          )}

          <Button variant="primary" loading={entrySaving} onClick={handleEntrySave} disabled={!entryForm.post_id}>
            Save performance data
          </Button>
        </div>
      )}

      {/* Reports */}
      {tab === 'reports' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-4">Generate AI Report</h2>
            <div className="flex flex-wrap gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-sans">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-sans">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" loading={reportLoading} onClick={handleGenerateReport}>
                {reportLoading ? 'Analysing…' : 'Generate AI report'}
              </Button>
              {reportText && (
                <Button variant="outline" onClick={() => window.print()}>
                  Print / PDF
                </Button>
              )}
            </div>
          </div>

          {reportLoading && <LoadingSpinner size="lg" text="Analysing your performance data…" className="py-12" />}

          {reportText && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <pre className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap font-sans">{reportText}</pre>
            </div>
          )}
        </div>
      )}

      {/* Learning rules */}
      {tab === 'rules' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-navy-dark">Content Learning Rules</h2>
            <Button variant="primary" loading={rulesLoading} onClick={handleGenerateRules}>
              {rulesLoading ? 'Analysing…' : 'Check for new suggestions'}
            </Button>
          </div>

          {/* Pending */}
          {rules.filter(r => !r.approved).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 font-sans">Pending Suggestions</h3>
              <div className="space-y-3">
                {rules.filter(r => !r.approved).map(rule => (
                  <div key={rule.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
                    <p className="text-sm text-gray-800 flex-1 font-sans">{rule.suggestion}</p>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="primary" size="sm" onClick={() => handleApproveRule(rule.id)}>Approve</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDismissRule(rule.id)}>Dismiss</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active */}
          {rules.filter(r => r.approved && !r.verified).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 font-sans">Active Rules (testing)</h3>
              <div className="space-y-3">
                {rules.filter(r => r.approved && !r.verified).map(rule => (
                  <div key={rule.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 font-sans">{rule.suggestion}</p>
                      {rule.verify_at && (
                        <p className="text-xs text-gray-400 mt-1 font-sans">
                          Verify by {format(new Date(rule.verify_at), 'd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="secondary" size="sm" onClick={() => handleVerifyRule(rule.id, true)}>Confirmed</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleVerifyRule(rule.id, false)}>Not confirmed</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified */}
          {rules.filter(r => r.verified).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 font-sans">Verified Rules</h3>
              <div className="space-y-3">
                {rules.filter(r => r.verified).map(rule => (
                  <div key={rule.id} className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-gray-800 font-sans">{rule.suggestion}</p>
                    <p className="text-xs text-green-600 mt-1 font-sans">{rule.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rules.length === 0 && !rulesLoading && (
            <div className="text-center py-16 text-gray-400 font-sans">
              <p>No rules yet. Click "Check for new suggestions" to let AI analyse your content patterns.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
