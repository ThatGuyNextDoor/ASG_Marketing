import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'

const FILE_TYPES = ['logo', 'photo', 'vector', 'template', 'icon']

export default function BrandAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', file_type: 'logo', tags: '' })

  const fetchAssets = async () => {
    setLoading(true)
    const { data } = await supabase.from('brand_assets').select('*').order('created_at', { ascending: false })
    setAssets(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAssets() }, [])

  const onDrop = useCallback((files) => {
    if (files[0]) {
      setPendingFile(files[0])
      setForm(prev => ({ ...prev, name: files[0].name.replace(/\.[^.]+$/, '') }))
      setUploadModal(true)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [], 'image/svg+xml': [] },
  })

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true)
    try {
      const ext = pendingFile.name.split('.').pop()
      const path = `${Date.now()}-${form.name}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('brand-assets').upload(path, pendingFile)
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)

      const { error: dbErr } = await supabase.from('brand_assets').insert([{
        name: form.name,
        description: form.description,
        file_type: form.file_type,
        tags,
        file_url: urlData.publicUrl,
      }])
      if (dbErr) throw dbErr

      setUploadModal(false)
      setPendingFile(null)
      setForm({ name: '', description: '', file_type: 'logo', tags: '' })
      fetchAssets()
    } catch (e) {
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return
    await supabase.from('brand_assets').delete().eq('id', asset.id)
    setAssets(prev => prev.filter(a => a.id !== asset.id))
  }

  const filtered = assets.filter(a => {
    const matchType = !filterType || a.file_type === filterType
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchType && matchSearch
  })

  const isImage = (url) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url)

  if (loading) return <PageLoader text="Loading assets…" />

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-navy-dark mb-6">Brand Assets</h1>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-3xl mb-2">🖼</p>
        <p className="font-semibold text-gray-700 font-sans">{isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}</p>
        <p className="text-sm text-gray-400 mt-1 font-sans">SVG, PNG, JPG, PDF up to 20MB</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All types</option>
          {FILE_TYPES.map(t => <option key={t} className="capitalize">{t}</option>)}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-sans">No assets found</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
              <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                {isImage(asset.file_url) ? (
                  <img src={asset.file_url} alt={asset.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-4xl">📄</div>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-xs text-gray-800 truncate font-sans">{asset.name}</p>
                {asset.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 font-sans">{asset.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="bg-navy/10 text-navy text-xs px-1.5 py-0.5 rounded capitalize">{asset.file_type}</span>
                  {asset.tags?.slice(0, 2).map(t => (
                    <span key={t} className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <div className="flex gap-1 mt-3">
                  <a href={asset.file_url} download target="_blank" rel="noreferrer"
                    className="flex-1 text-center bg-navy/10 text-navy text-xs py-1.5 rounded-lg hover:bg-navy/20 transition-colors font-sans font-semibold">
                    Download
                  </a>
                  <button onClick={() => handleDelete(asset)}
                    className="px-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Modal isOpen={uploadModal} onClose={() => { setUploadModal(false); setPendingFile(null) }} title="Upload Asset" size="md">
        <div className="space-y-4">
          {pendingFile && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 font-sans">
              File: <strong>{pendingFile.name}</strong> ({(pendingFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy resize-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">File Type</label>
            <select value={form.file_type} onChange={e => setForm(p => ({ ...p, file_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy bg-white capitalize">
              {FILE_TYPES.map(t => <option key={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">Tags (comma separated)</label>
            <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="primary logo, navy, horizontal"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <Button variant="primary" className="w-full" loading={uploading} onClick={handleUpload}>
            Upload asset
          </Button>
        </div>
      </Modal>
    </div>
  )
}
