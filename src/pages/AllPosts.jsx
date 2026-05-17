import { useEffect, useState } from 'react'
import { usePosts } from '../hooks/usePosts'
import PostCard from '../components/posts/PostCard'
import PostDetailModal from '../components/posts/PostDetailModal'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Google Business']
const STATUSES = ['draft', 'approved', 'live']
const PILLARS = ['Technology & Systems', 'Trust & Credibility', 'Education & Expertise', 'Behind the Brand']

export default function AllPosts() {
  const { posts, loading, fetchPosts, bulkUpdatePosts, deletePost } = usePosts()
  const [selectedPost, setSelectedPost] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [filters, setFilters] = useState({ platform: '', status: '', pillar: '', post_type: '' })
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { fetchPosts(filters) }, [filters])

  const setFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }))

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(posts.map(p => p.id)))
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

  if (loading && posts.length === 0) return <PageLoader text="Loading posts…" />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy-dark">All Posts</h1>
        <span className="text-sm text-gray-500 font-sans">{posts.length} posts</span>
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
        <select value={filters.post_type} onChange={e => setFilter('post_type', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All types</option>
          <option value="organic">Organic</option>
          <option value="paid">Paid</option>
        </select>
        {Object.values(filters).some(Boolean) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ platform: '', status: '', pillar: '', post_type: '' })}>
            Clear filters
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
          <button className="text-sm text-gray-500 hover:text-gray-700 ml-auto" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Select all row */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <input type="checkbox"
          checked={selected.size === posts.length && posts.length > 0}
          onChange={selectAll}
          className="rounded border-gray-300 text-navy focus:ring-navy"
        />
        <span className="text-sm text-gray-500 font-sans">Select all</span>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-sans">
          <p className="text-lg mb-2">No posts found</p>
          <p className="text-sm">Adjust your filters or generate some content</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => setSelectedPost(post)}
              selected={selected.has(post.id)}
              onSelect={() => toggleSelect(post.id)}
              showCheckbox
            />
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
