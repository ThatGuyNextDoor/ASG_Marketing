import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { generatePostContent } from '../lib/anthropic'
import { generateImages } from '../lib/openai'
import { usePosts } from '../hooks/usePosts'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

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
const PILLARS = ['Technology & Systems', 'Trust & Credibility', 'Education & Expertise', 'Behind the Brand']
const SERVICES = ['Commercial', 'Industrial', 'Strata', 'Medical', 'Data Centre', 'Window & Solar', 'Short Stay', 'General brand']
const AD_OBJECTIVES = ['Awareness', 'Traffic', 'Lead generation']
const AUDIENCES = ['Facility managers', 'Strata managers', 'Business owners', 'Property directors']
const CTAS = ['Get a free quote', 'Learn more', 'Contact us', 'Book a consultation']

export default function Generate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { createPost } = usePosts()

  const [form, setForm] = useState({
    platform: 'LinkedIn',
    pillar: 'Technology & Systems',
    service: 'Commercial',
    postType: 'organic',
    scheduledDate: searchParams.get('date') || '',
    extraDirection: '',
    adObjective: 'Awareness',
    targetAudience: 'Facility managers',
    cta: 'Get a free quote',
  })

  const [result, setResult] = useState(null)
  const [images, setImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'review'

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleGenerate = async () => {
    setGeneratingCopy(true)
    setError('')
    setResult(null)
    setImages([])
    setSelectedImage(null)
    try {
      const content = await generatePostContent({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        postType: form.postType,
        adObjective: form.postType === 'paid' ? form.adObjective : null,
        targetAudience: form.postType === 'paid' ? form.targetAudience : null,
        cta: form.postType === 'paid' ? form.cta : null,
        extraDirection: form.extraDirection,
      })
      setResult(content)
      setStep('review')

      if (content.image_prompt) {
        setGeneratingImages(true)
        try {
          const imgs = await generateImages(content.image_prompt)
          setImages(imgs)
          setSelectedImage(imgs[0])
        } catch (e) {
          setError('Images failed to generate — copy was saved. ' + e.message)
        } finally {
          setGeneratingImages(false)
        }
      }
    } catch (e) {
      setError('Generation failed: ' + e.message)
    } finally {
      setGeneratingCopy(false)
    }
  }

  const handleRegenerateCopy = async () => {
    setGeneratingCopy(true)
    setError('')
    try {
      const content = await generatePostContent({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        postType: form.postType,
        adObjective: form.postType === 'paid' ? form.adObjective : null,
        targetAudience: form.postType === 'paid' ? form.targetAudience : null,
        cta: form.postType === 'paid' ? form.cta : null,
        extraDirection: form.extraDirection,
      })
      setResult(content)
    } catch (e) {
      setError('Regeneration failed: ' + e.message)
    } finally {
      setGeneratingCopy(false)
    }
  }

  const handleRegenerateImages = async () => {
    if (!result?.image_prompt) return
    setGeneratingImages(true)
    try {
      const imgs = await generateImages(result.image_prompt)
      setImages(imgs)
      setSelectedImage(imgs[0])
    } catch (e) {
      setError('Image regeneration failed: ' + e.message)
    } finally {
      setGeneratingImages(false)
    }
  }

  const handleSave = async (status) => {
    setSaving(true)
    try {
      const adVariant = result.headline ? [
        `HEADLINE: ${result.headline}`,
        `PRIMARY TEXT: ${result.primary_text}`,
        `DESCRIPTION: ${result.description}`,
      ].join('\n') : null

      await createPost({
        platform: form.platform,
        pillar: form.pillar,
        service: form.service,
        post_type: form.postType,
        scheduled_date: form.scheduledDate || null,
        copy: result.copy,
        visual_brief: result.visual_brief,
        generated_images: images,
        selected_image_url: selectedImage,
        ad_variant: adVariant,
        status,
      })
      navigate('/posts')
    } catch (e) {
      setError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'review' && result) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep('form')} className="text-navy hover:text-navy-light text-sm font-sans flex items-center gap-1">
            ← Back to form
          </button>
          <h1 className="text-2xl font-serif font-bold text-navy-dark">Review & Save</h1>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

        {/* Copy */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif font-bold text-navy-dark">Post Copy</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.copy)}>
                Copy text
              </Button>
              <Button variant="outline" size="sm" loading={generatingCopy} onClick={handleRegenerateCopy}>
                Regenerate
              </Button>
            </div>
          </div>
          {generatingCopy ? (
            <LoadingSpinner text="Rewriting with Claude…" className="py-8" />
          ) : (
            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{result.copy}</p>
          )}
        </div>

        {/* Ad copy */}
        {result.headline && (
          <div className="bg-purple-50 rounded-2xl border border-purple-100 p-6">
            <h2 className="font-serif font-bold text-navy-dark mb-3">Ad Copy</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Headline:</span> {result.headline}</div>
              <div><span className="font-semibold">Primary text:</span> {result.primary_text}</div>
              <div><span className="font-semibold">Description:</span> {result.description}</div>
            </div>
          </div>
        )}

        {/* Visual brief */}
        <div className="bg-teal/5 rounded-2xl border border-teal/20 p-6">
          <h2 className="font-serif font-bold text-navy-dark mb-2">Visual Brief</h2>
          <p className="text-sm text-gray-700 italic">{result.visual_brief}</p>
        </div>

        {/* Images */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-bold text-navy-dark">Generated Images</h2>
            <Button variant="outline" size="sm" loading={generatingImages} onClick={handleRegenerateImages}>
              Regenerate images
            </Button>
          </div>
          {generatingImages ? (
            <div className="py-12">
              <LoadingSpinner size="lg" text="Generating 3 variations with DALL-E 3… this takes about 30 seconds" />
            </div>
          ) : images.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {images.map((url, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedImage(url)}
                  className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === url ? 'border-gold shadow-lg ring-2 ring-gold/50' : 'border-gray-200 hover:border-navy/40'
                  }`}
                >
                  <img src={url} alt={`Variation ${i + 1}`} className="w-full aspect-square object-cover" />
                  {selectedImage === url && (
                    <div className="bg-gold text-white text-center text-xs py-1 font-semibold">Selected</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No images generated yet</p>
          )}
        </div>

        {/* Schedule date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-serif font-bold text-navy-dark mb-3">Schedule</h2>
          <input
            type="date"
            value={form.scheduledDate}
            onChange={e => set('scheduledDate', e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>

        {/* Save actions */}
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" loading={saving} onClick={() => handleSave('approved')}>
            Approve & schedule
          </Button>
          <Button variant="outline" size="lg" loading={saving} onClick={() => handleSave('draft')}>
            Save as draft
          </Button>
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

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={generatingCopy}
          onClick={handleGenerate}
        >
          {generatingCopy ? 'Writing with Claude…' : 'Generate content'}
        </Button>
      </div>
    </div>
  )
}
