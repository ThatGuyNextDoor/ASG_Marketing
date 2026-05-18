import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function autoMatchFile(fileName, posts, alreadyMatched) {
  const lower = fileName.toLowerCase()

  // Match by date in filename (YYYY-MM-DD)
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/)
  if (dateMatch) {
    const date = dateMatch[1]
    const post = posts.find(p => p.scheduled_date === date && !alreadyMatched.has(p.id))
    if (post) return post.id
  }

  // Match by platform in filename
  const platformMap = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', google: 'Google Business' }
  for (const [key, platform] of Object.entries(platformMap)) {
    if (lower.includes(key)) {
      const post = posts.find(p => p.platform === platform && !alreadyMatched.has(p.id))
      if (post) return post.id
    }
  }

  return null
}

function postLabel(post) {
  const date = post.scheduled_date
    ? format(new Date(post.scheduled_date + 'T00:00:00'), 'EEE d MMM')
    : 'No date'
  return `${date} — ${post.platform} — ${post.pillar}`
}

export default function BulkImageUpload() {
  const navigate = useNavigate()
  const dropRef = useRef(null)
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [files, setFiles] = useState([])          // [{file, preview, name}]
  const [posts, setPosts] = useState([])           // pending/draft posts
  const [matches, setMatches] = useState({})       // {fileIndex: postId}
  const [dragging, setDragging] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [done, setDone] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    return () => files.forEach(f => URL.revokeObjectURL(f.preview))
  }, [])

  async function fetchPosts() {
    setLoadingPosts(true)
    const { data } = await supabase
      .from('posts')
      .select('id, platform, pillar, service, scheduled_date, status, selected_image_url')
      .in('status', ['pending_approval', 'draft'])
      .order('scheduled_date', { ascending: true })
    setPosts(data || [])
    setLoadingPosts(false)
    return data || []
  }

  function addFiles(newFiles) {
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    const entries = valid.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }))
    setFiles(prev => [...prev, ...entries])
  }

  function removeFile(index) {
    URL.revokeObjectURL(files[index].preview)
    setFiles(prev => prev.filter((_, i) => i !== index))
    setMatches(prev => {
      const next = { ...prev }
      delete next[index]
      // Re-index keys above removed index
      const reindexed = {}
      Object.entries(next).forEach(([k, v]) => {
        const ki = Number(k)
        reindexed[ki > index ? ki - 1 : ki] = v
      })
      return reindexed
    })
  }

  async function goToStep2() {
    const postList = await fetchPosts()

    // Auto-match
    const alreadyMatched = new Set()
    const autoMatches = {}
    files.forEach((f, i) => {
      const postId = autoMatchFile(f.name, postList, alreadyMatched)
      if (postId) {
        autoMatches[i] = postId
        alreadyMatched.add(postId)
      }
    })
    setMatches(autoMatches)
    setStep(2)
  }

  function setMatch(fileIndex, postId) {
    setMatches(prev => ({ ...prev, [fileIndex]: postId || undefined }))
  }

  const matchedCount = Object.values(matches).filter(Boolean).length
  const matchedPostIds = new Set(Object.values(matches).filter(Boolean))

  const unmatchedPosts = posts.filter(p =>
    !matchedPostIds.has(p.id) && !p.selected_image_url
  )

  async function handleConfirm() {
    setUploading(true)
    const entries = Object.entries(matches).filter(([, postId]) => postId)
    setUploadProgress({ done: 0, total: entries.length })

    let approved = 0
    for (const [fileIndex, postId] of entries) {
      const { file } = files[Number(fileIndex)]
      try {
        const ext = file.name.split('.').pop()
        const fileName = `posts/${postId}/${Date.now()}.${ext}`
        const { data, error } = await supabase.storage
          .from('post-images')
          .upload(fileName, file, { contentType: file.type, upsert: true })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(data.path)
        const url = urlData.publicUrl

        await supabase
          .from('posts')
          .update({ selected_image_url: url, status: 'approved' })
          .eq('id', postId)

        approved++
      } catch (err) {
        console.error(`Failed for file ${fileIndex}:`, err)
      }
      setUploadProgress(prev => ({ ...prev, done: prev.done + 1 }))
    }

    setDoneCount(approved)
    setDone(true)
    setUploading(false)
  }

  // Done screen
  if (done) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-24">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-serif font-bold text-navy-dark mb-2">{doneCount} posts approved</h1>
        <p className="text-gray-500 font-sans mb-8">Images uploaded and posts are ready in the calendar.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => navigate('/calendar')}>View Calendar</Button>
          <Button variant="outline" onClick={() => navigate('/approvals')}>Go to Approvals</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-navy-dark">Bulk Image Upload</h1>
        <p className="text-sm text-gray-500 font-sans mt-1">
          Upload your generated images and match them to scheduled posts.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-sans transition-colors ${
              step >= s ? 'bg-navy text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s}
            </div>
            <span className={`text-sm font-sans ${step >= s ? 'text-navy-dark font-semibold' : 'text-gray-400'}`}>
              {s === 1 ? 'Select images' : s === 2 ? 'Match to posts' : 'Confirm'}
            </span>
            {s < 3 && <span className="text-gray-300 mx-1">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1 — File selection */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div
              ref={dropRef}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragging ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40 hover:bg-gray-50'
              }`}
            >
              <p className="text-base font-semibold text-gray-600 font-sans mb-1">
                Drag & drop your images here
              </p>
              <p className="text-sm text-gray-400 font-sans mb-3">or click to browse — multi-select enabled</p>
              <p className="text-xs text-gray-300 font-sans">JPG, PNG, WEBP accepted</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-bold text-navy-dark">{files.length} image{files.length !== 1 ? 's' : ''} selected</h2>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-navy hover:underline font-sans"
                >
                  Add more
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={f.preview}
                      alt={f.name}
                      className="w-full aspect-square object-cover rounded-xl border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-xl transition-all" />
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(i) }}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                    <p className="text-xs text-gray-400 font-sans mt-1 truncate">{f.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={goToStep2}
              disabled={files.length === 0}
            >
              Next: match to posts →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Matching */}
      {step === 2 && (
        <div className="space-y-5">
          {loadingPosts ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" text="Loading posts…" />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-[80px_1fr_1fr] gap-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide font-sans">Image</span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide font-sans">Filename</span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide font-sans">Match to post</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {files.map((f, i) => (
                    <div key={i} className="p-4 grid grid-cols-[80px_1fr_1fr] gap-4 items-center">
                      <img
                        src={f.preview}
                        alt={f.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      />
                      <p className="text-sm text-gray-700 font-sans truncate">{f.name}</p>
                      <select
                        value={matches[i] || ''}
                        onChange={e => setMatch(i, e.target.value)}
                        className={`px-3 py-2 rounded-lg border text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy ${
                          matches[i] ? 'border-green-300 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <option value="">— select post —</option>
                        {posts.map(post => (
                          <option
                            key={post.id}
                            value={post.id}
                            disabled={matchedPostIds.has(post.id) && matches[i] !== post.id}
                          >
                            {postLabel(post)}
                            {post.selected_image_url ? ' ✓ has image' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {matchedCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-sans">
                  {matchedCount} of {files.length} images matched. Auto-matched where filename contained a date or platform name.
                </div>
              )}

              {unmatchedPosts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 font-sans mb-2">
                    Posts still needing images ({unmatchedPosts.length}):
                  </p>
                  <div className="space-y-1">
                    {unmatchedPosts.slice(0, 8).map(p => (
                      <p key={p.id} className="text-xs text-amber-700 font-sans">{postLabel(p)}</p>
                    ))}
                    {unmatchedPosts.length > 8 && (
                      <p className="text-xs text-amber-500 font-sans">…and {unmatchedPosts.length - 8} more</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setStep(3)}
                  disabled={matchedCount === 0}
                >
                  Next: confirm {matchedCount} uploads →
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-4">Ready to upload</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-navy/5 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-navy-dark">{matchedCount}</p>
                <p className="text-sm text-gray-500 font-sans">images to upload</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-700">{matchedCount}</p>
                <p className="text-sm text-gray-500 font-sans">posts to approve</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {Object.entries(matches).filter(([, postId]) => postId).map(([fileIndex, postId]) => {
                const post = posts.find(p => p.id === postId)
                const file = files[Number(fileIndex)]
                if (!post || !file) return null
                return (
                  <div key={fileIndex} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <img src={file.preview} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-sans truncate">{file.name}</p>
                      <p className="text-sm font-semibold text-navy-dark font-sans">{postLabel(post)}</p>
                    </div>
                    <span className="text-xs text-green-600 font-sans flex-shrink-0">→ approved</span>
                  </div>
                )
              })}
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 font-sans mb-1">
                  <span>Uploading…</span>
                  <span>{uploadProgress.done} / {uploadProgress.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} disabled={uploading}>← Back</Button>
              <Button
                variant="primary"
                size="lg"
                loading={uploading}
                onClick={handleConfirm}
              >
                Confirm — upload {matchedCount} images and approve {matchedCount} posts
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
