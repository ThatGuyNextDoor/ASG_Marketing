import { useEffect, useState, useMemo } from 'react'
import { usePosts } from '../hooks/usePosts'
import PostCard from '../components/posts/PostCard'
import PostDetailModal from '../components/posts/PostDetailModal'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Google Business']
const STATUSES = ['draft', 'approved', 'live', 'pending_approval', 'rejected']
const PILLARS = [
  'Technology & Systems',
  'Trust & Credibility',
  'Education & Expertise',
  'Behind the Brand',
  'Cleaning & Facilities'
]
const SERVICES = [
  'Commercial', 'Industrial', 'Strata', 'Medical',
  'Data Centre', 'Window & Solar', 'Short Stay', 'General brand'
]
const RATINGS = ['5', '4', '3', '2', '1']

export default function AllPosts() {
  const { posts, loading, fetchPosts, createPost, bulkUpdatePosts, deletePost } = usePosts()
  const [selectedPost, setSelectedPost] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [filters, setFilters] = useState({
    platform: '', status: '', pillar: '', post_type: '', service: '', rating: ''
  })
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    const serverFilters = {}
    if (filters.platform) serverFilters.platform = filters.platform
    if (filters.status) serverFilters.status = filters.status
    if (filters.pillar) serverFilters.pillar = filters.pillar
    if (filters.post_type) serverFilters.post_type = filters.post_type
    fetchPosts(serverFilters)
  }, [filters.platform, filters.status, filters.pillar, filters.post_type])

  const setFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }))

  const filteredPosts = useMemo(() => {
    let result = posts

    if (activeTab === 'top') {
      result = result.filter(p => p.rating >= 4)
    }

    if (filters.service) {
      result = result.filter(p => p.service === filters.service)
    }

    if (filters.rating) {
      result = result.filter(p => p.rating >= Number(filters.rating))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.copy?.toLowerCase().includes(q) ||
        p.pillar?.toLowerCase().includes(q) ||
        p.service?.toLowerCase().includes(q) ||
        p.platform?.toLowerCase().includes(q)
      )
    }

    return result
  }, [posts, activeTab, filters.service, filters.rating, search])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filteredPosts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredPosts.map(p => p.id)))
    }
  }

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selected)
      if (action === 'delete') {
        if (!confirm(`Delete ${ids.length} posts? This cannot be undone.`)) return
        await Promise.all(ids.map(id => deletePost(id)))
      } else {
        await bulkUpdatePosts(ids, { status: action })
      }
      setSelected(new Set())
    } catch (e) {
      alert('Action failed: ' + e.message)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleReusePost = async (post) => {
    const { id, created_at, updated_at, scheduled_date, status, rating, ...rest } = post
    try {
      await createPost({ ...rest, status: 'draft', scheduled_date: null, rating: null })
      fetchPosts()
    } catch (e) {
      alert('Clone failed: ' + e.message)
    }
  }

  const exportCSV = () => {
    const toExport = selected.size > 0
      ? filteredPosts.filter(p => selected.has(p.id))
      : filteredPosts

    const headers = ['Platform', 'Pillar', 'Service', 'Status', 'Rating', 'Date', 'Copy']
    const rows = toExport.map(p => [
      p.platform,
      p.pillar,
      p.service,
      p.status,
      p.rating || '',
      p.scheduled_date || '',
      `"${(p.copy || '').replace(/"/g, '""')}"`
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asg-posts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setFilters({ platform: '', status: '', pillar: '', post_type: '', service: '', rating: '' })
    setSearch('')
  }

  const hasFilters = Object.values(filters).some(Boolean) || search

  if (loading && posts.length === 0) return <PageLoader text="Loading posts…" />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-serif font-bold text-navy-dark">Content Library</h1>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500 font-sans">{filteredPosts.length} posts</span>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all', label: 'All posts' },
          { key: 'top', label: '⭐ Top performers' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold font-sans transition-all ${
              activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search post copy, pillar, service…"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent bg-white"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <select value={filters.platform} onChange={e => setFilter('platform', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All platforms</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} className="capitalize">{s}</option>)}
        </select>
        <select value={filters.pillar} onChange={e => setFilter('pillar', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All pillars</option>
          {PILLARS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filters.service} onChange={e => setFilter('service', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All services</option>
          {SERVICES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.rating} onChange={e => setFilter('rating', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">Any rating</option>
          {RATINGS.map(r => <option key={r} value={r}>{r}★+</option>)}
        </select>
        <select value={filters.post_type} onChange={e => setFilter('post_type', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All types</option>
          <option value="organic">Organic</option>
          <option value="paid">Paid</option>
        </select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-navy/5 border border-navy/20 rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-center">
          <span className="text-sm font-semibold text-navy font-sans">{selected.size} selected</span>
          <Button variant="outline" size="sm" loading={bulkLoading} onClick={() => handleBulkAction('approved')}>Mark approved</Button>
          <Button variant="secondary" size="sm" loading={bulkLoading} onClick={() => handleBulkAction('live')}>Mark live</Button>
          <Button variant="outline-danger" size="sm" loading={bulkLoading} onClick={() => handleBulkAction('delete')}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={exportCSV}>Export selection</Button>
          <button className="text-sm text-gray-500 hover:text-gray-700 ml-auto font-sans" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Select all */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <input type="checkbox"
          checked={selected.size === filteredPosts.length && filteredPosts.length > 0}
          onChange={selectAll}
          className="rounded border-gray-300 text-navy focus:ring-navy"
        />
        <span className="text-sm text-gray-500 font-sans">Select all ({filteredPosts.length})</span>
      </div>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-sans">
          <p className="text-lg mb-2">{activeTab === 'top' ? 'No top performers yet' : 'No posts found'}</p>
          <p className="text-sm">
            {activeTab === 'top'
              ? 'Rate posts 4 or 5 stars on the Performance page to see them here.'
              : 'Adjust your filters or generate some content'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map(post => (
            <div key={post.id} className="relative group">
              <PostCard
                post={post}
                onClick={() => setSelectedPost(post)}
                selected={selected.has(post.id)}
                onSelect={() => toggleSelect(post.id)}
                showCheckbox
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleReusePost(post) }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-navy bg-white border border-gray-200 rounded-lg px-2 py-1 transition-all font-sans"
              >
                Reuse
              </button>
            </div>
          ))}
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onUpdated={() => { setSelectedPost(null); fetchPosts(filters) }}
      />
    </div>
  )
}
