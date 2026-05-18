import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const PILLARS = [
  'Technology & Systems',
  'Trust & Credibility',
  'Education & Expertise',
  'Behind the Brand',
  'Cleaning & Facilities'
]

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Google Business']

const DEFAULT_STRATEGY = {
  pillar_priorities: {
    'Technology & Systems': 35,
    'Trust & Credibility': 25,
    'Education & Expertise': 20,
    'Cleaning & Facilities': 10,
    'Behind the Brand': 10
  },
  service_priorities: {
    Commercial: 40,
    Industrial: 20,
    Strata: 15,
    'Data Centre': 10,
    'Window & Solar': 10,
    Medical: 5
  },
  posting_schedule: {
    LinkedIn: 4,
    Instagram: 5,
    Facebook: 3,
    'Google Business': 1
  },
  ai_direction: 'Focus on technology differentiators and commercial property expertise. Use founder voice. Reference specific systems. Challenge the industry standard. Rotate between professional and cheeky tones based on platform.',
  active: true
}

export default function Strategy() {
  const [strategy, setStrategy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState([])
  const [saved, setSaved] = useState(false)
  const [directionInput, setDirectionInput] = useState('')

  useEffect(() => {
    fetchStrategy()
    fetchRules()
  }, [])

  async function fetchStrategy() {
    setLoading(true)
    const { data } = await supabase
      .from('strategy')
      .select('*')
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (data) {
      setStrategy(data)
      setDirectionInput(data.ai_direction || '')
    } else {
      setStrategy({ ...DEFAULT_STRATEGY, id: null })
      setDirectionInput(DEFAULT_STRATEGY.ai_direction)
    }
    setLoading(false)
  }

  async function fetchRules() {
    const { data } = await supabase
      .from('content_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setRules(data || [])
  }

  const setPillarWeight = (pillar, value) => {
    setStrategy(prev => ({
      ...prev,
      pillar_priorities: { ...prev.pillar_priorities, [pillar]: Number(value) }
    }))
  }

  const setSchedule = (platform, value) => {
    setStrategy(prev => ({
      ...prev,
      posting_schedule: { ...prev.posting_schedule, [platform]: Number(value) }
    }))
  }

  const totalPosts = strategy
    ? Object.values(strategy.posting_schedule || {}).reduce((s, n) => s + n, 0)
    : 0

  const totalWeight = strategy
    ? Object.values(strategy.pillar_priorities || {}).reduce((s, n) => s + n, 0)
    : 0

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        ...strategy,
        ai_direction: directionInput,
        updated_at: new Date().toISOString()
      }

      if (strategy.id) {
        await supabase.from('strategy').update(payload).eq('id', strategy.id)
      } else {
        const weekStart = getMonday(new Date()).toISOString().split('T')[0]
        const { data } = await supabase
          .from('strategy')
          .insert({ ...payload, week_start: weekStart, month: formatMonth(new Date()) })
          .select()
          .single()
        setStrategy(data)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(ruleId, currentApproved) {
    await supabase.from('content_rules').update({ approved: !currentApproved }).eq('id', ruleId)
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, approved: !currentApproved } : r))
  }

  async function deleteRule(ruleId) {
    await supabase.from('content_rules').delete().eq('id', ruleId)
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Loading strategy…" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy-dark">Content Strategy</h1>
          <p className="text-sm text-gray-500 font-sans mt-1">
            Every generation reads this. Change it to change what Claude produces.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {saved && <span className="text-sm text-green-600 font-sans">Saved ✓</span>}
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save strategy
          </Button>
        </div>
      </div>

      {/* Posting schedule */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-navy-dark mb-4">
          Weekly posting schedule
          <span className="ml-3 text-sm font-sans font-normal text-gray-400">{totalPosts} posts per week</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PLATFORMS.map(platform => (
            <div key={platform}>
              <label className="block text-xs font-semibold text-gray-500 mb-2 font-sans uppercase tracking-wide">
                {platform}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={strategy?.posting_schedule?.[platform] ?? 0}
                  onChange={e => setSchedule(platform, e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm font-sans text-center focus:outline-none focus:ring-2 focus:ring-navy"
                />
                <span className="text-xs text-gray-400 font-sans">posts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pillar priorities */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-navy-dark mb-1">
          Pillar priorities
        </h2>
        <p className="text-xs text-gray-400 font-sans mb-4">
          Weight controls how often each pillar is selected during batch generation. Total: {totalWeight}%
        </p>
        <div className="space-y-4">
          {PILLARS.map(pillar => {
            const weight = strategy?.pillar_priorities?.[pillar] ?? 0
            const percent = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0
            return (
              <div key={pillar}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700 font-sans">{pillar}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-sans">{percent}% of posts</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weight}
                      onChange={e => setPillarWeight(pillar, e.target.value)}
                      className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm font-sans text-center focus:outline-none focus:ring-2 focus:ring-navy"
                    />
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy rounded-full transition-all"
                    style={{ width: `${Math.min(100, (weight / 50) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI direction */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-navy-dark mb-2">AI direction</h2>
        <p className="text-xs text-gray-400 font-sans mb-3">
          Claude reads this before every generation. Use it to shift focus, tone, or emphasis week by week.
        </p>
        <textarea
          value={directionInput}
          onChange={e => setDirectionInput(e.target.value)}
          rows={4}
          placeholder="e.g. This week focus heavily on strata and government. Lean into cheeky tone on Instagram. Push drone capability and dashboard proof points."
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent resize-none"
        />
      </div>

      {/* Learning rules */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-serif font-bold text-navy-dark mb-1">Active learning rules</h2>
        <p className="text-xs text-gray-400 font-sans mb-4">
          Generated from performance data. Claude applies these to every post when approved.
        </p>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-400 font-sans text-center py-6">
            No rules yet. Rate posts on the Performance page to generate them.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  rule.approved
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <button
                  onClick={() => toggleRule(rule.id, rule.approved)}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    rule.approved
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {rule.approved && <span className="text-xs">✓</span>}
                </button>
                <p className="flex-1 text-sm text-gray-700 font-sans">{rule.suggestion}</p>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xs flex-shrink-0 mt-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function formatMonth(date) {
  return date.toLocaleString('en-AU', { month: 'long', year: 'numeric' })
}
