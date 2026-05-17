import { useEffect, useState } from 'react'
import { format, isToday, parseISO, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { supabase } from '../lib/supabase'
import { usePosts } from '../hooks/usePosts'
import { PlatformBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'

function VAPostCard({ post, onMarkLive }) {
  const [copying, setCopying] = useState(false)
  const [marking, setMarking] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(post.copy || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    const zip = new JSZip()
    zip.file('copy.txt', post.copy || '')
    if (post.visual_brief) zip.file('visual_brief.txt', post.visual_brief)
    if (post.ad_variant) zip.file('ad_copy.txt', post.ad_variant)

    if (post.selected_image_url) {
      try {
        const resp = await fetch(post.selected_image_url)
        const blob = await resp.blob()
        zip.file('image.jpg', blob)
      } catch (e) {
        console.error('Image fetch failed', e)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `ASG-${post.platform}-${post.scheduled_date || 'post'}.zip`)
  }

  const handleMarkPosted = async () => {
    setMarking(true)
    try {
      await onMarkLive(post.id)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-navy-dark px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={post.platform} />
          {post.scheduled_date && (
            <span className="text-white/70 text-sm font-sans">
              {format(parseISO(post.scheduled_date), 'EEE d MMM yyyy')}
            </span>
          )}
        </div>
        {isToday(parseISO(post.scheduled_date || new Date().toISOString())) && (
          <span className="bg-gold text-white text-xs font-bold px-3 py-1 rounded-full font-sans">TODAY</span>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Copy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans">Post Copy</p>
            <button
              onClick={handleCopy}
              className="text-xs text-navy hover:text-navy-light font-semibold font-sans transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy text'}
            </button>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap select-text border border-gray-100">
            {post.copy}
          </div>
        </div>

        {/* Image */}
        {post.selected_image_url && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-sans">Approved Image</p>
            <img
              src={post.selected_image_url}
              alt="Post image"
              className="w-full rounded-xl border border-gray-100 max-h-80 object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            Download package (.zip)
          </Button>
          <Button variant="gold" className="flex-1" loading={marking} onClick={handleMarkPosted}>
            Mark as posted ✓
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function VABoard() {
  const { posts, fetchPosts, updatePost } = usePosts()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts({ status: 'approved' }).then(() => setLoading(false))
  }, [])

  const handleMarkLive = async (id) => {
    await updatePost(id, { status: 'live' })
    fetchPosts({ status: 'approved' })
  }

  const now = new Date()
  const weekEnd = addDays(now, 7)

  const todayPosts = posts.filter(p => {
    if (!p.scheduled_date) return false
    return isToday(parseISO(p.scheduled_date))
  })

  const thisWeekPosts = posts.filter(p => {
    if (!p.scheduled_date) return false
    const d = parseISO(p.scheduled_date)
    return !isToday(d) && isWithinInterval(d, { start: startOfDay(now), end: endOfDay(weekEnd) })
  })

  const upcomingPosts = posts.filter(p => {
    if (!p.scheduled_date) return false
    const d = parseISO(p.scheduled_date)
    return d > weekEnd
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-sans">Loading your posts…</p>
        </div>
      </div>
    )
  }

  const Section = ({ title, posts: sectionPosts }) => {
    if (sectionPosts.length === 0) return null
    return (
      <section className="mb-10">
        <h2 className="text-lg font-serif font-bold text-navy-dark mb-4 flex items-center gap-2">
          {title}
          <span className="text-sm font-sans font-normal text-gray-400">({sectionPosts.length})</span>
        </h2>
        <div className="space-y-5">
          {sectionPosts.map(post => (
            <VAPostCard key={post.id} post={post} onMarkLive={handleMarkLive} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div>
      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">✅</p>
          <p className="font-serif font-bold text-xl text-gray-600 mb-2">All clear</p>
          <p className="font-sans text-sm">No posts ready to go yet. Check back soon.</p>
        </div>
      ) : (
        <>
          <Section title="Post today" posts={todayPosts} />
          <Section title="Due this week" posts={thisWeekPosts} />
          <Section title="Coming up" posts={upcomingPosts} />
        </>
      )}
    </div>
  )
}
