import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isWithinInterval, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { usePosts } from '../hooks/usePosts'
import { generateDashboardInsight } from '../lib/anthropic'
import { generateWeekBatch } from '../lib/claudeAgent'
import { StatCard } from '../components/ui/Card'
import { PlatformBadge, StatusBadge } from '../components/ui/Badge'
import PostDetailModal from '../components/posts/PostDetailModal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Button from '../components/ui/Button'

const INSIGHT_CACHE_KEY = 'asg_dashboard_insight'
const INSIGHT_TTL = 7 * 24 * 60 * 60 * 1000

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

const DEFAULT_SCHEDULE = { LinkedIn: 4, Instagram: 5, Facebook: 3, 'Google Business': 1 }

export default function Dashboard() {
  const navigate = useNavigate()
  const { posts, fetchPosts, loading } = usePosts()
  const [selectedPost, setSelectedPost] = useState(null)
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')
  const [batchCompleted, setBatchCompleted] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [weekStart] = useState(() => getMonday(new Date()).toISOString().split('T')[0])

  useEffect(() => {
    fetchPosts()
    loadInsight()
  }, [])

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const weekEnd = addDays(now, 7)

  const thisMonthPosts = posts.filter(p => {
    if (!p.scheduled_date) return false
    const d = new Date(p.scheduled_date)
    return d >= monthStart && d <= monthEnd
  })

  const approvedPosts = posts.filter(p => p.status === 'approved')
  const liveThisWeek = posts.filter(p => {
    if (p.status !== 'live' || !p.scheduled_date) return false
    const d = new Date(p.scheduled_date)
    return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(weekEnd) })
  })

  const dueThisWeek = posts.filter(p => {
    if (p.status === 'live' || !p.scheduled_date) return false
    const d = new Date(p.scheduled_date)
    return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(weekEnd) })
  })

  const ratedPosts = posts.filter(p => p.rating)
  const avgRating = ratedPosts.length
    ? (ratedPosts.reduce((s, p) => s + p.rating, 0) / ratedPosts.length).toFixed(1)
    : '—'

  const pillarRatings = {}
  ratedPosts.forEach(p => {
    if (!pillarRatings[p.pillar]) pillarRatings[p.pillar] = { total: 0, count: 0 }
    pillarRatings[p.pillar].total += p.rating
    pillarRatings[p.pillar].count++
  })
  const topPillar = Object.entries(pillarRatings)
    .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0]?.[0] || '—'

  async function loadInsight() {
    const cached = localStorage.getItem(INSIGHT_CACHE_KEY)
    if (cached) {
      const { text, ts } = JSON.parse(cached)
      if (Date.now() - ts < INSIGHT_TTL) {
        setInsight(text)
        return
      }
    }
    refreshInsight()
  }

  async function refreshInsight() {
    setInsightLoading(true)
    try {
      const recentPosts = posts.filter(p => {
        if (!p.scheduled_date) return false
        const d = new Date(p.scheduled_date)
        return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      })
      if (recentPosts.length === 0) {
        setInsight("Start generating and rating posts to unlock AI insights about your content performance.")
        return
      }
      const text = await generateDashboardInsight(recentPosts)
      setInsight(text)
      localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify({ text, ts: Date.now() }))
    } catch (e) {
      setInsight("Could not load insight — check your API connection.")
    } finally {
      setInsightLoading(false)
    }
  }

  const totalBatchPosts = Object.values(DEFAULT_SCHEDULE).reduce((s, n) => s + n, 0)

  async function handleBatchGenerate() {
    setBatchRunning(true)
    setBatchCompleted(0)
    setBatchTotal(totalBatchPosts)
    setBatchProgress('Starting batch generation...')
    try {
      await generateWeekBatch({
        weekStart,
        postingSchedule: DEFAULT_SCHEDULE,
        onProgress: setBatchProgress,
        onPostComplete: (post, completed, total) => {
          setBatchCompleted(completed)
          setBatchTotal(total)
        }
      })
      navigate('/approvals')
    } catch (err) {
      setBatchProgress('Batch failed: ' + err.message)
      setBatchRunning(false)
    }
  }

  if (loading && posts.length === 0) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Loading dashboard…" /></div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-navy-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 font-sans mt-1">{format(now, 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Posts this month" value={thisMonthPosts.length} color="navy" />
        <StatCard label="Approved & ready" value={approvedPosts.length} color="teal" />
        <StatCard label="Live this week" value={liveThisWeek.length} color="green" />
        <StatCard label="Avg rating" value={avgRating} sub="from rated posts" color="gold" />
        <StatCard label="Top pillar" value={topPillar.split('&')[0]?.trim() || '—'} sub="by star rating" color="navy" />
      </div>

      {/* AI Insight */}
      <div className="bg-navy-dark rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-gold text-xs font-semibold uppercase tracking-wider mb-2 font-sans">AI Content Insight</p>
            {insightLoading ? (
              <div className="flex items-center gap-3 text-white/60">
                <LoadingSpinner size="sm" />
                <span className="text-sm font-sans">Analysing your content performance…</span>
              </div>
            ) : (
              <p className="text-white/90 text-sm leading-relaxed font-sans">{insight}</p>
            )}
          </div>
          <button
            onClick={refreshInsight}
            className="text-white/40 hover:text-gold transition-colors text-xs font-sans flex-shrink-0 mt-1"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Batch generation card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-serif font-bold text-navy-dark mb-1">Generate this week</h2>
            <p className="text-sm text-gray-500 font-sans">
              Week of {format(new Date(weekStart), 'd MMMM')} —{' '}
              {Object.entries(DEFAULT_SCHEDULE).map(([p, n]) => `${n} ${p}`).join(', ')} — {totalBatchPosts} posts total
            </p>
            {batchRunning && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <LoadingSpinner size="sm" />
                  <p className="text-sm text-navy font-sans">{batchProgress}</p>
                </div>
                {batchTotal > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 font-sans mb-1">
                      <span>Progress</span>
                      <span>{batchCompleted} / {batchTotal}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy rounded-full transition-all duration-500"
                        style={{ width: `${batchTotal > 0 ? (batchCompleted / batchTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {!batchRunning && (
            <div className="flex-shrink-0">
              {!batchOpen ? (
                <Button variant="outline" onClick={() => setBatchOpen(true)}>
                  Generate week →
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleBatchGenerate}>
                    Confirm — generate {totalBatchPosts} posts
                  </Button>
                  <Button variant="ghost" onClick={() => setBatchOpen(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {batchOpen && !batchRunning && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(DEFAULT_SCHEDULE).map(([platform, count]) => (
                <div key={platform} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-navy-dark">{count}</p>
                  <p className="text-xs text-gray-500 font-sans">{platform}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 font-sans mt-3">
              Posts will be saved as pending approval and sent to the Approvals queue. Takes 5–10 minutes.
            </p>
          </div>
        )}
      </div>

      {/* Due this week */}
      <div>
        <h2 className="text-lg font-serif font-bold text-navy-dark mb-4">Due this week</h2>
        {dueThisWeek.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 font-sans text-sm">
            Nothing scheduled in the next 7 days
          </div>
        ) : (
          <div className="space-y-3">
            {dueThisWeek.map(post => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-navy/20 transition-all cursor-pointer p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <PlatformBadge platform={post.platform} />
                      <StatusBadge status={post.status} />
                      <span className="text-xs text-gray-400">
                        {post.scheduled_date && format(new Date(post.scheduled_date), 'EEE d MMM')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{post.pillar}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {post.copy?.substring(0, 100)}…
                    </p>
                  </div>
                  {post.selected_image_url && (
                    <img src={post.selected_image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onUpdated={() => { setSelectedPost(null); fetchPosts() }}
      />
    </div>
  )
}
