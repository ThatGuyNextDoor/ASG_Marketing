import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { generatePostBrief } from '../lib/claudeAgent'
import { supabase } from '../lib/supabase'
import { usePosts } from '../hooks/usePosts'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const CHATGPT_URL = 'https://chatgpt.com'

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-sans">{label}</label>
    {children}
  </div>
)

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent bg-white"
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

const PLATFORMS = ['LinkedIn', 'Instagram', 'Facebook', 'Google Business']
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
const TONES = ['auto', 'professional', 'challenger', 'cheeky']
const AD_OBJECTIVES = ['Awareness', 'Traffic', 'Lead generation']
const AUDIENCES = ['Facility managers', 'Strata managers', 'Business owners', 'Property directors']
const CTAS = ['Get a free quote', 'Learn more', 'Contact us', 'Book a consultation']

async function uploadImageFile(file) {
  const ext = file.name.split('.').pop()
  const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, { contentType: file.type, upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(data.path)
  return urlData.publicUrl
}

export default function Generate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { createPost } = usePosts()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    platform: 'LinkedIn',
    pillar: 'Technology & Systems',
    service: 'Commercial',
    postType: 'organic',
    tone: 'auto',
    scheduledDate: searchParams.get('date') || '',
    extraDirection: '',
    adObjective: 'Awareness',
    targetAudience: 'Facility managers',
    cta: 'Get a free quote',
  })

  const [brief, setBrief] = useState(null)
  const [copy, setCopy] = useState('')
  const [uploadedImage, setUploadedImage] = useState(null)   // { preview, file, url }
  const [uploadingImage, setUploadingImage] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedText, setCopiedText] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [step, setStep] = useState('form')

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleCopyText = () => {
    navigator.clipboard.writeText(copy)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(brief?.imagePrompt || '')
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setBrief(null)
    setUploadedImage(null)
    setProgress('Starting...')

    try {
      const result = await generatePostBrief({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        postType: form.postType,
        tone: form.tone,
        extraDirection: form.extraDirection,
        scheduledDate: form.scheduledDate,
        onProgress: setProgress
      })
      setBrief(result)
      setCopy(result.copy)
      setStep('review')
    } catch (e) {
      setError('Generation failed: ' + e.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleRegenerateCopy = async () => {
    setLoading(true)
    setError('')
    setProgress('Regenerating...')
    try {
      const result = await generatePostBrief({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        postType: form.postType,
        tone: form.tone,
        extraDirection: form.extraDirection,
        scheduledDate: form.scheduledDate,
        onProgress: setProgress
      })
      setBrief(result)
      setCopy(result.copy)
    } catch (e) {
      setError('Regeneration failed: ' + e.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleFileSelect = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const preview = URL.createObjectURL(file)
    setUploadedImage({ preview, file, url: null })
    setUploadingImage(true)
    try {
      const url = await uploadImageFile(file)
      setUploadedImage({ preview, file, url })
    } catch (e) {
      setError('Image upload failed: ' + e.message)
      setUploadedImage(null)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleSave = async (status) => {
    setSaving(true)
    setError('')
    try {
      const adVariant = brief?.adHeadline ? JSON.stringify({
        headline: brief.adHeadline,
        primary: brief.adPrimary,
        description: brief.adDescription
      }) : null

      const finalStatus = uploadedImage?.url ? status : 'draft'

      await createPost({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        post_type: form.postType,
        scheduled_date: form.scheduledDate || null,
        copy,
        visual_brief: brief?.visualBrief || '',
        image_mode: brief?.imageMode || '',
        image_prompt: brief?.imagePrompt || '',
        headline_text: brief?.headlineText || '',
        subheadline_text: brief?.subheadlineText || '',
        proof_points: brief?.proofPoints || '',
        cta_text: brief?.ctaText || '',
        canva_notes: brief?.canvaNotes || '',
        selected_image_url: uploadedImage?.url || null,
        ad_variant: adVariant,
        status: finalStatus,
      })
      navigate('/posts')
    } catch (e) {
      setError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'review' && brief) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep('form')} className="text-navy hover:text-navy-light text-sm font-sans flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-2xl font-serif font-bold text-navy-dark">Review & Save</h1>
          <div className="flex gap-2 ml-auto">
            <span className="text-xs bg-navy/10 text-navy px-2 py-1 rounded-lg font-sans">{form.platform}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-sans">{form.pillar}</span>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

        {/* Copy */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif font-bold text-navy-dark">Post Copy</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopyText}
                className={`text-xs px-3 py-1.5 rounded-lg border font-sans transition-all ${
                  copiedText
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:text-navy hover:border-navy/30'
                }`}
              >
                {copiedText ? 'Copied!' : 'Copy text'}
              </button>
              <Button variant="outline" size="sm" loading={loading} onClick={handleRegenerateCopy}>
                Regenerate
              </Button>
            </div>
          </div>
          {loading ? (
            <LoadingSpinner text="Rewriting with Claude…" className="py-8" />
          ) : (
            <textarea
              value={copy}
              onChange={e => setCopy(e.target.value)}
              rows={8}
              className="w-full text-sm leading-relaxed text-gray-800 font-sans border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-navy resize-none"
            />
          )}
        </div>

        {/* Image content details */}
        {(brief.headlineText || brief.proofPoints || brief.ctaText) && (
          <div className="bg-navy/5 rounded-2xl border border-navy/10 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-serif font-bold text-navy-dark">Image Content</h2>
              {brief.imageMode && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold font-sans ${
                  brief.imageMode === 'BRAND_GRAPHIC' ? 'bg-gold/20 text-gold' :
                  brief.imageMode === 'SCENE' ? 'bg-teal/20 text-teal' :
                  'bg-navy/20 text-navy'
                }`}>{brief.imageMode}</span>
              )}
            </div>

            {brief.headlineText && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 font-sans">Headline on image</p>
                <p className="text-xl font-bold text-navy-dark">{brief.headlineText}</p>
                {brief.subheadlineText && <p className="text-sm text-gray-600 mt-1">{brief.subheadlineText}</p>}
              </div>
            )}

            {brief.proofPoints && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 font-sans">Proof points</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{brief.proofPoints}</p>
              </div>
            )}

            {brief.ctaText && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 font-sans">CTA text</p>
                <p className="text-sm font-semibold text-navy">{brief.ctaText}</p>
              </div>
            )}
          </div>
        )}

        {/* Visual brief */}
        {brief.visualBrief && (
          <div className="bg-teal/5 rounded-2xl border border-teal/20 p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-2">Visual Brief</h2>
            <p className="text-sm text-gray-700 italic">{brief.visualBrief}</p>
          </div>
        )}

        {/* Image prompt — Step 1 */}
        {brief.imagePrompt && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider font-sans mb-0.5">STEP 1</p>
                <h2 className="font-serif font-bold text-navy-dark">Generate your image in ChatGPT</h2>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleCopyPrompt}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-sans transition-all ${
                    copiedPrompt
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {copiedPrompt ? '✓ Copied' : 'Copy prompt'}
                </button>
                <a
                  href={CHATGPT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#D29329] text-[#D29329] hover:bg-amber-50 font-sans transition-all"
                >
                  Open ChatGPT ↗
                </a>
              </div>
            </div>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {brief.imagePrompt}
            </div>
            <p className="text-xs text-gray-400 font-sans mt-2">
              1. Copy prompt above → 2. Open ChatGPT ASG_Marketing project → 3. Paste and generate → 4. Download image → 5. Upload below
            </p>
          </div>
        )}

        {/* Upload finished image — Step 2 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider font-sans mb-0.5">STEP 2</p>
          <h2 className="font-serif font-bold text-navy-dark mb-1">Upload the finished image here</h2>
          <p className="text-xs text-gray-400 font-sans mb-4">Generated in ChatGPT? Download it and upload below.</p>

          {uploadedImage ? (
            <div className="space-y-3">
              <div className="relative w-48">
                <img
                  src={uploadedImage.preview}
                  alt="Uploaded"
                  className="w-48 h-48 object-cover rounded-xl border border-gray-200"
                />
                {uploadingImage && (
                  <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                    <LoadingSpinner size="sm" text="Uploading…" />
                  </div>
                )}
                {uploadedImage.url && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs rounded-full px-2 py-0.5 font-sans">
                    Uploaded ✓
                  </div>
                )}
              </div>
              <button
                onClick={() => { setUploadedImage(null); fileInputRef.current?.click() }}
                className="text-xs text-gray-400 hover:text-navy font-sans underline"
              >
                Replace image
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40 hover:bg-gray-50'
              }`}
            >
              <p className="text-sm font-semibold text-gray-600 font-sans mb-1">Drag & drop or click to upload</p>
              <p className="text-xs text-gray-400 font-sans">JPG, PNG, WEBP accepted</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => handleFileSelect(e.target.files[0])}
          />

          {!uploadedImage && (
            <p className="text-xs text-gray-400 font-sans mt-3">
              No image? Post saves as draft — you can add an image later.
            </p>
          )}
        </div>

        {/* Canva notes */}
        {brief.canvaNotes && (
          <div className="bg-gold/5 rounded-2xl border border-gold/20 p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-2">Canva Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{brief.canvaNotes}</p>
          </div>
        )}

        {/* Ad copy */}
        {brief.adHeadline && (
          <div className="bg-purple-50 rounded-2xl border border-purple-100 p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-3">Ad Copy</h2>
            <div className="space-y-2 text-sm font-sans">
              <div><span className="font-semibold">Headline:</span> {brief.adHeadline}</div>
              <div><span className="font-semibold">Primary:</span> {brief.adPrimary}</div>
              <div><span className="font-semibold">Description:</span> {brief.adDescription}</div>
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-serif font-bold text-navy-dark mb-3">Schedule</h2>
          <input
            type="date"
            value={form.scheduledDate}
            onChange={e => set('scheduledDate', e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            variant="primary"
            size="lg"
            loading={saving || uploadingImage}
            onClick={() => handleSave('approved')}
          >
            {uploadedImage?.url ? 'Save & approve' : 'Approve (no image)'}
          </Button>
          <Button variant="outline" size="lg" loading={saving} onClick={() => handleSave('draft')}>
            Save as draft
          </Button>
          {!uploadedImage && (
            <p className="text-xs text-gray-400 font-sans">No image uploaded — will save as draft regardless</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-serif font-bold text-navy-dark mb-6">Generate Content</h1>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <Field label="Platform">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => set('platform', p)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all font-sans ${
                  form.platform === p ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-navy/40'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Content Pillar">
          <Select value={form.pillar} onChange={v => set('pillar', v)} options={PILLARS} />
        </Field>

        <Field label="Service Focus">
          <Select value={form.service} onChange={v => set('service', v)} options={SERVICES} />
        </Field>

        <Field label="Post Type">
          <div className="flex gap-3">
            {['organic', 'paid'].map(t => (
              <button
                key={t}
                onClick={() => set('postType', t)}
                className={`py-2 px-6 rounded-xl text-sm font-semibold border-2 capitalize transition-all font-sans ${
                  form.postType === t ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-navy/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tone">
          <div className="grid grid-cols-4 gap-2">
            {TONES.map(t => (
              <button
                key={t}
                onClick={() => set('tone', t)}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border-2 capitalize transition-all font-sans ${
                  form.tone === t ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-navy/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        {form.postType === 'paid' && (
          <>
            <Field label="Ad Objective">
              <Select value={form.adObjective} onChange={v => set('adObjective', v)} options={AD_OBJECTIVES} />
            </Field>
            <Field label="Target Audience">
              <Select value={form.targetAudience} onChange={v => set('targetAudience', v)} options={AUDIENCES} />
            </Field>
            <Field label="CTA">
              <Select value={form.cta} onChange={v => set('cta', v)} options={CTAS} />
            </Field>
          </>
        )}

        <Field label="Schedule Date (optional)">
          <input
            type="date"
            value={form.scheduledDate}
            onChange={e => set('scheduledDate', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
          />
        </Field>

        <Field label="Extra Direction (optional)">
          <textarea
            value={form.extraDirection}
            onChange={e => set('extraDirection', e.target.value)}
            rows={3}
            placeholder="e.g. mention drone capability, use founder voice, reference Melbourne CBD…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent resize-none"
          />
        </Field>

        {loading && progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 font-sans">
            {progress}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          onClick={handleGenerate}
        >
          {loading ? (progress || 'Generating with Claude…') : 'Generate content'}
        </Button>
      </div>
    </div>
  )
}
