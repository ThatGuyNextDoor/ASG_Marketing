import { useState } from 'react'
import { format } from 'date-fns'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import StarRating from '../ui/StarRating'
import { PlatformBadge, StatusBadge, TypeBadge } from '../ui/Badge'
import { supabase } from '../../lib/supabase'
import { usePosts } from '../../hooks/usePosts'

export default function PostDetailModal({ post, isOpen, onClose, onUpdated }) {
  const { updatePost } = usePosts()
  const [selectedImage, setSelectedImage] = useState(post?.selected_image_url || post?.generated_images?.[0] || null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!post) return null

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(post.copy || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSelectImage = async (url) => {
    setSelectedImage(url)
    try {
      await updatePost(post.id, { selected_image_url: url })
      onUpdated?.()
    } catch (e) {
      console.error(e)
    }
  }

  const handleUploadImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `final/${post.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path)
      await updatePost(post.id, { selected_image_url: urlData.publicUrl })
      setSelectedImage(urlData.publicUrl)
      onUpdated?.()
    } catch (e) {
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleMarkLive = async () => {
    setSaving(true)
    try {
      await updatePost(post.id, { status: 'live' })
      onUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    setSaving(true)
    try {
      await updatePost(post.id, { status: 'approved' })
      onUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  const handleRate = async (rating) => {
    await updatePost(post.id, { rating })
    onUpdated?.()
  }

  const handleDownload = async () => {
    const zip = new JSZip()
    zip.file('copy.txt', post.copy || '')
    zip.file('visual_brief.txt', post.visual_brief || '')

    if (post.ad_variant) {
      zip.file('ad_copy.txt', post.ad_variant)
    }

    if (selectedImage) {
      try {
        const response = await fetch(selectedImage)
        const blob = await response.blob()
        zip.file('image.jpg', blob)
      } catch (e) {
        console.error('Could not fetch image', e)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `ASG-post-${post.platform}-${post.scheduled_date || 'draft'}.zip`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post Details" size="xl">
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex flex-wrap gap-2 items-center">
          <PlatformBadge platform={post.platform} />
          <StatusBadge status={post.status} />
          {post.post_type && <TypeBadge type={post.post_type} />}
          {post.scheduled_date && (
            <span className="text-sm text-gray-500">
              {format(new Date(post.scheduled_date), 'EEEE, d MMMM yyyy')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          {post.pillar && <div><span className="font-semibold text-gray-800">Pillar:</span> {post.pillar}</div>}
          {post.service && <div><span className="font-semibold text-gray-800">Service:</span> {post.service}</div>}
        </div>

        {/* Copy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif font-bold text-navy-dark">Post Copy</h3>
            <Button variant="ghost" size="sm" onClick={handleCopyToClipboard}>
              {copied ? '✓ Copied' : 'Copy to clipboard'}
            </Button>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap select-text border border-gray-100">
            {post.copy}
          </div>
        </div>

        {/* Ad variant */}
        {post.ad_variant && (
          <div>
            <h3 className="font-serif font-bold text-navy-dark mb-2">Ad Copy</h3>
            <div className="bg-purple-50 rounded-xl p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap border border-purple-100">
              {post.ad_variant}
            </div>
          </div>
        )}

        {/* Visual brief */}
        {post.visual_brief && (
          <div>
            <h3 className="font-serif font-bold text-navy-dark mb-2">Visual Brief</h3>
            <div className="bg-teal/5 rounded-xl p-4 text-sm leading-relaxed text-gray-700 italic border border-teal/20">
              {post.visual_brief}
            </div>
          </div>
        )}

        {/* Images */}
        {post.generated_images && post.generated_images.length > 0 && (
          <div>
            <h3 className="font-serif font-bold text-navy-dark mb-3">Generated Images — click to select</h3>
            <div className="grid grid-cols-3 gap-3">
              {post.generated_images.map((url, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectImage(url)}
                  className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === url ? 'border-gold shadow-lg ring-2 ring-gold/50' : 'border-gray-200 hover:border-navy/40'
                  }`}
                >
                  <img src={url} alt={`Variation ${i + 1}`} className="w-full aspect-square object-cover" />
                  {selectedImage === url && (
                    <div className="absolute top-2 right-2 bg-gold text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected image */}
        {selectedImage && (
          <div>
            <h3 className="font-serif font-bold text-navy-dark mb-2">Selected Image</h3>
            <img src={selectedImage} alt="Selected" className="w-full max-w-md rounded-xl border border-gray-200" />
          </div>
        )}

        {/* Upload */}
        <div>
          <h3 className="font-serif font-bold text-navy-dark mb-2">Upload Final Image (after Canva)</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <Button variant="outline" size="sm" loading={uploading} as="span">
              {uploading ? 'Uploading...' : 'Choose file'}
            </Button>
            <span className="text-sm text-gray-500">PNG, JPG, PDF up to 20MB</span>
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleUploadImage} />
          </label>
        </div>

        {/* Rating */}
        {post.status === 'live' && (
          <div>
            <h3 className="font-serif font-bold text-navy-dark mb-2">Performance Rating</h3>
            <StarRating rating={post.rating} onRate={handleRate} />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={handleDownload}>
            Download package
          </Button>

          {post.status === 'draft' && (
            <Button variant="primary" loading={saving} onClick={handleApprove}>
              Approve & schedule
            </Button>
          )}

          {post.status === 'approved' && (
            <Button variant="gold" loading={saving} onClick={handleMarkLive}>
              Mark as live
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
