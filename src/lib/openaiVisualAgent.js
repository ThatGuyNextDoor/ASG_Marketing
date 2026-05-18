// src/lib/openaiVisualAgent.js

import { supabase } from './supabase'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

export async function generateVisualFromBrief(brief, onProgress) {
  onProgress?.('Sending brief to visual agent...')

  const visualPrompt = `
Generate a complete branded social media graphic for All Spot Group.

IMAGE MODE: ${brief.imageMode}

HEADLINE ON IMAGE: "${brief.headlineText}"
SUBHEADLINE: "${brief.subheadlineText}"
CTA: "${brief.ctaText}"

${brief.proofPoints ? `PROOF POINTS TO SHOW AS CHECKLIST:\n${brief.proofPoints}` : ''}

FULL IMAGE DIRECTION:
${brief.imagePrompt}

BRAND REQUIREMENTS:
- Logo: White All Spot Group logo, top left corner
- Primary background: Navy #03597B
- Accent colour: Gold #D29329
- Secondary: Teal #5DB4C2
- Website bottom right: allspotgroup.com.au
- Style: Professional social media ad — bold, clean, impactful

Produce a complete ready-to-post social media graphic.
`

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: visualPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high'
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(JSON.stringify(data))

  const base64 = data.data[0].b64_json
  return `data:image/png;base64,${base64}`
}

export async function generateThreeVariations(brief, onProgress) {
  const variations = []

  const modeVariations = [
    { ...brief },
    { ...brief, imagePrompt: brief.imagePrompt + ' — alternative angle, different composition' },
    { ...brief, imagePrompt: brief.imagePrompt + ' — wider shot, emphasise environment' }
  ]

  for (let i = 0; i < 3; i++) {
    onProgress?.(`Generating image ${i + 1} of 3...`)
    try {
      const imageData = await generateVisualFromBrief(modeVariations[i], () => {})
      variations.push(imageData)
    } catch (err) {
      console.error(`Variation ${i + 1} failed:`, err)
    }
  }

  return variations
}

export async function uploadImageToSupabase(base64Data, postId, index) {
  const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const binary = atob(base64String)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })

  const folder = postId || `temp_${Date.now()}`
  const fileName = `${folder}/image_${index}_${Date.now()}.png`

  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, blob, { contentType: 'image/png', upsert: true })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('post-images')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

export async function uploadAllVariations(base64Images, postId) {
  const uploads = base64Images.map((img, i) => {
    if (img.startsWith('http')) return Promise.resolve(img)
    return uploadImageToSupabase(img, postId, i)
  })
  return Promise.all(uploads)
}
