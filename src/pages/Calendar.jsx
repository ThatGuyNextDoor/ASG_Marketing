import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { usePosts } from '../hooks/usePosts'
import { PlatformBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import PostDetailModal from '../components/posts/PostDetailModal'

const platformColors = {
  LinkedIn: 'bg-navy text-white',
  Instagram: 'bg-gold text-white',
  Facebook: 'bg-teal text-white',
  'Google Business': 'bg-emerald-600 text-white',
}

export default function Calendar() {
  const { posts, fetchPosts } = usePosts()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)

  useEffect(() => { fetchPosts() }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad days to start on Monday
  const startDow = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const paddedDays = [...Array(startDow).fill(null), ...days]

  const getPostsForDay = (day) =>
    posts.filter(p => p.scheduled_date && isSameDay(parseISO(p.scheduled_date), day))

  const dayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy-dark">Content Calendar</h1>
          <p className="text-sm text-gray-500 font-sans mt-1">{format(currentMonth, 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>← Prev</Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>Next →</Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/generate')}>+ Schedule post</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(platformColors).map(([platform, cls]) => (
          <span key={platform} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
            {platform}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 font-sans">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/50" />

            const dayPsts = getPostsForDay(day)
            const isCurrentDay = isToday(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[100px] border-b border-r border-gray-100 p-2 cursor-pointer transition-colors hover:bg-navy/5 ${
                  !isCurrentMonth ? 'bg-gray-50/50' : ''
                } ${isCurrentDay ? 'ring-2 ring-inset ring-gold' : ''}`}
              >
                <p className={`text-xs font-semibold mb-1.5 ${
                  isCurrentDay ? 'text-gold' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </p>
                <div className="space-y-0.5">
                  {dayPsts.slice(0, 3).map(post => (
                    <div
                      key={post.id}
                      className={`${platformColors[post.platform] || 'bg-gray-200 text-gray-700'} text-xs px-1.5 py-0.5 rounded-md truncate font-sans`}
                      onClick={(e) => { e.stopPropagation(); setSelectedPost(post) }}
                    >
                      {post.platform?.substring(0, 2)}
                    </div>
                  ))}
                  {dayPsts.length > 3 && (
                    <p className="text-xs text-gray-400 font-sans">+{dayPsts.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail modal */}
      <Modal
        isOpen={!!selectedDay && !selectedPost}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, 'EEEE, d MMMM yyyy') : ''}
        size="md"
      >
        <div className="space-y-3">
          {dayPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-sans text-sm">
              No posts scheduled for this day
              <div className="mt-4">
                <Button variant="primary" size="sm" onClick={() => navigate('/generate')}>
                  Create post for this day
                </Button>
              </div>
            </div>
          ) : (
            dayPosts.map(post => (
              <div
                key={post.id}
                onClick={() => { setSelectedDay(null); setSelectedPost(post) }}
                className="border border-gray-100 rounded-xl p-4 cursor-pointer hover:border-navy/30 hover:shadow-sm transition-all"
              >
                <div className="flex gap-2 items-center mb-2">
                  <PlatformBadge platform={post.platform} />
                  <span className="text-xs text-gray-500">{post.pillar}</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{post.copy?.substring(0, 120)}…</p>
              </div>
            ))
          )}
        </div>
      </Modal>

      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onUpdated={() => { setSelectedPost(null); fetchPosts() }}
      />
    </div>
  )
}
