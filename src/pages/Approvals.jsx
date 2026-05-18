import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { PlatformBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const CHATGPT_URL = 'https://chatgpt.com'

async function uploadImageFile(file, postId) {
  const ext = file.name.split('.').pop()
  const fileName = `posts/${postId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, { contentType: file.type, upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(data.path)
  return urlData.publicUrl
}

export default function Approvals() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [summary, setSummary] = useState({ approved: 0, rejected: 0 })
  const [editingCopy, setEditingCopy] = useState(false)
  const [editedCopy, setEditedCopy] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageDragging, setImageDragging] = useState(false)

  useEffect(() => {
    fetchPending()
  }, [])

  async function fetchPending() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'pending_approval')
      .order('scheduled_date', { ascending: true })
    setPosts(data || [])
    setLoading(false)
  }

  const current = posts[currentIndex]

  useEffect(() => {
    if (current) {
      setEditedCopy(current.copy || '')
      setEditingCopy(false)
      setPromptOpen(false)
      setPromptCopied(false)
    }
  }, [currentIndex, current?.id])

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(current?.image_prompt || '')
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/') || !current) return
    setImageUploading(true)
    try {
      const url = await uploadImageFile(file, current.id)
      await supabase.from('posts').update({ selected_image_url: url }).eq('id', current.id)
      setPosts(prev => prev.map(p => p.id === current.id ? { ...p, selected_image_url: url } : p))
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setImageUploading(false)
    }
  }

  const advance = useCallback(() => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      setDone(true)
    }
  }, [currentIndex, posts.length])

  const handleApprove = useCallback(async () => {
    if (!current || actionLoading) return
    setActionLoading(true)
    try {
      const updates = { status: 'approved' }
      if (editedCopy !== current.copy) updates.copy = editedCopy
      await supabase.from('posts').update(updates).eq('id', current.id)
      setPosts(prev => prev.map(p => p.id === current.id ? { ...p, ...updates } : p))
      setSummary(s => ({ ...s, approved: s.approved + 1 }))
      advance()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }, [current, actionLoading, editedCopy, advance])

  const handleReject = useCallback(async () => {
    if (!current || actionLoading) return
    setActionLoading(true)
    try {
      await supabase.from('posts').update({ status: 'rejected' }).eq('id', current.id)
      setPosts(prev => prev.map(p => p.id === current.id ? { ...p, status: 'rejected' } : p))
      setSummary(s => ({ ...s, rejected: s.rejected + 1 }))
      advance()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }, [current, actionLoading, advance])

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      if (e.key === 'a' || e.key === 'A') handleApprove()
      if (e.key === 'r' || e.key === 'R') handleReject()
      if (e.key === 'ArrowRight') advance()
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleApprove, handleReject, advance])

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner size="lg" text="Loading pending posts…" /></div>
  }

  if (posts.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-serif font-bold text-navy-dark mb-2">Queue is clear</h1>
        <p className="text-gray-500 font-sans mb-6">No posts waiting for approval. Generate a week of content to fill the queue.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          <Button variant="outline" onClick={() => navigate('/calendar')}>View Calendar</Button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-serif font-bold text-navy-dark mb-2">Approvals complete</h1>
        <div className="flex gap-6 justify-center mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{summary.approved}</p>
            <p className="text-sm text-gray-500 font-sans">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-500">{summary.rejected}</p>
            <p className="text-sm text-gray-500 font-sans">Rejected</p>
          </div>
        </div>
        <p className="text-gray-500 font-sans mb-6">Approved posts are scheduled and ready.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => navigate('/calendar')}>View Calendar</Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left panel — post list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-serif font-bold text-navy-dark text-sm">Pending Approval</h2>
          <p className="text-xs text-gray-400 font-sans mt-0.5">{posts.length} posts</p>
        </div>
        <div className="divide-y divide-gray-100">
          {posts.map((post, i) => (
            <button
              key={post.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-full text-left p-3 transition-colors ${
                i === currentIndex
                  ? 'bg-navy text-white'
                  : post.status === 'approved'
                  ? 'bg-green-50 opacity-60'
                  : post.status === 'rejected'
                  ? 'bg-red-50 opacity-60'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded font-sans ${
                  i === currentIndex ? 'bg-white/20 text-white' : 'bg-navy/10 text-navy'
                }`}>
                  {post.platform}
                </span>
                {(() => {
                  const t = post.image_prompt?.match(/TEMPLATE (\w+)/)?.[1]
                  return t ? (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold font-sans ${
                      i === currentIndex ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'
                    }`}>{t}</span>
                  ) : null
                })()}
                {post.status === 'approved' && <span className="text-xs text-green-600">✓</span>}
                {post.status === 'rejected' && <span className="text-xs text-red-500">✗</span>}
              </div>
              <p className={`text-xs font-sans leading-snug line-clamp-2 ${
                i === currentIndex ? 'text-white/80' : 'text-gray-600'
              }`}>
                {post.pillar}
              </p>
              {post.scheduled_date && (
                <p className={`text-xs mt-1 font-sans ${i === currentIndex ? 'text-white/60' : 'text-gray-400'}`}>
                  {format(new Date(post.scheduled_date), 'EEE d MMM')}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — post detail */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {current && (
          <div className="p-6 max-w-3xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlatformBadge platform={current.platform} />
                <span className="text-sm text-gray-500 font-sans">{current.pillar}</span>
                {current.service && <span className="text-sm text-gray-400 font-sans">· {current.service}</span>}
                {current.scheduled_date && (
                  <span className="text-sm text-gray-400 font-sans">
                    · {format(new Date(current.scheduled_date), 'EEE d MMM yyyy')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-sans">
                <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} className="hover:text-navy px-1">← prev</button>
                <span>{currentIndex + 1} / {posts.length}</span>
                <button onClick={advance} className="hover:text-navy px-1">next →</button>
              </div>
            </div>

            {/* Copy */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-navy-dark">Post Copy</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(editedCopy)}
                    className="text-xs text-gray-400 hover:text-navy font-sans"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setEditingCopy(v => !v)}
                    className="text-xs text-navy hover:underline font-sans"
                  >
                    {editingCopy ? 'Done editing' : 'Edit'}
                  </button>
                </div>
              </div>
              {editingCopy ? (
                <textarea
                  value={editedCopy}
                  onChange={e => setEditedCopy(e.target.value)}
                  rows={8}
                  className="w-full text-sm text-gray-800 leading-relaxed font-sans border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-navy resize-none"
                />
              ) : (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">{editedCopy}</p>
              )}
            </div>

            {/* Image brief */}
            {(current.headline_text || current.visual_brief || current.proof_points) && (
              <div className="bg-navy/5 rounded-2xl border border-navy/10 p-5 space-y-3">
                <h3 className="font-serif font-bold text-navy-dark">Visual Brief</h3>

                {current.image_mode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-navy-dark font-sans uppercase tracking-wide">Mode:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold font-sans ${
                      current.image_mode === 'BRAND_GRAPHIC' ? 'bg-gold/20 text-gold' :
                      current.image_mode === 'SCENE' ? 'bg-teal/20 text-teal' :
                      'bg-navy/20 text-navy'
                    }`}>{current.image_mode}</span>
                  </div>
                )}

                {current.headline_text && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 font-sans uppercase tracking-wide mb-1">Headline on image</p>
                    <p className="text-base font-bold text-navy-dark">{current.headline_text}</p>
                    {current.subheadline_text && <p className="text-sm text-gray-600 mt-0.5">{current.subheadline_text}</p>}
                  </div>
                )}

                {current.proof_points && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 font-sans uppercase tracking-wide mb-1">Proof points</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{current.proof_points}</p>
                  </div>
                )}

                {current.cta_text && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 font-sans uppercase tracking-wide mb-1">CTA on image</p>
                    <p className="text-sm font-semibold text-navy">{current.cta_text}</p>
                  </div>
                )}

                {current.visual_brief && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 font-sans uppercase tracking-wide mb-1">Brief</p>
                    <p className="text-sm text-gray-700 italic font-sans">{current.visual_brief}</p>
                  </div>
                )}
              </div>
            )}

            {/* Canva notes */}
            {current.canva_notes && (
              <div className="bg-gold/5 rounded-2xl border border-gold/20 p-5">
                <h3 className="font-serif font-bold text-navy-dark mb-2">Canva Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{current.canva_notes}</p>
              </div>
            )}

            {/* Image section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-serif font-bold text-navy-dark">Image</h3>

              {current.selected_image_url ? (
                <div className="space-y-3">
                  <img
                    src={current.selected_image_url}
                    alt="Post image"
                    className="w-full max-w-sm rounded-xl border border-gray-200 object-cover"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-navy font-sans underline"
                  >
                    Replace image
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 font-sans">No image yet.</p>

                  {/* Upload area */}
                  <div
                    onDragOver={e => { e.preventDefault(); setImageDragging(true) }}
                    onDragLeave={() => setImageDragging(false)}
                    onDrop={e => {
                      e.preventDefault()
                      setImageDragging(false)
                      handleImageFile(e.dataTransfer.files[0])
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      imageDragging ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40 hover:bg-gray-50'
                    }`}
                  >
                    {imageUploading ? (
                      <LoadingSpinner size="sm" text="Uploading…" />
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-600 font-sans">Upload image</p>
                        <p className="text-xs text-gray-400 font-sans mt-0.5">Drag & drop or click to browse</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Image prompt */}
              {current.image_prompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif font-bold text-navy-dark">Image Prompt</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-sans">Copy → paste into ChatGPT ASG_Marketing project</span>
                      <button
                        onClick={handleCopyPrompt}
                        className={`text-xs px-3 py-1 rounded border font-sans transition-all flex items-center gap-1 ${
                          promptCopied
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {promptCopied ? '✓ Copied' : 'Copy prompt'}
                      </button>
                      <a
                        href={CHATGPT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1 rounded border border-[#D29329] text-[#D29329] hover:bg-amber-50 font-sans transition-all"
                      >
                        Open ChatGPT ↗
                      </a>
                    </div>
                  </div>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {current.image_prompt}
                  </div>
                  <p className="text-xs text-gray-400 font-sans mt-2">
                    1. Copy prompt above → 2. Open ChatGPT ASG_Marketing project → 3. Paste and generate → 4. Download image → 5. Upload below
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => handleImageFile(e.target.files[0])}
              />
            </div>

            {/* Ad variant */}
            {current.ad_variant && (() => {
              try {
                const ad = typeof current.ad_variant === 'string'
                  ? JSON.parse(current.ad_variant)
                  : current.ad_variant
                return (
                  <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5">
                    <h3 className="font-serif font-bold text-navy-dark mb-3">Ad Copy</h3>
                    <div className="space-y-2 text-sm font-sans">
                      {ad.headline && <div><span className="font-semibold">Headline:</span> {ad.headline}</div>}
                      {ad.primary && <div><span className="font-semibold">Primary:</span> {ad.primary}</div>}
                      {ad.description && <div><span className="font-semibold">Description:</span> {ad.description}</div>}
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  size="lg"
                  loading={actionLoading}
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700 border-green-600"
                >
                  Approve [A]
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  loading={actionLoading}
                  onClick={handleReject}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Reject [R]
                </Button>
                <div className="ml-auto text-xs text-gray-400 font-sans">
                  Keyboard: A = approve · R = reject · ← → navigate
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
