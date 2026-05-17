import { supabase } from './supabase'

const generateImage = async (prompt) => {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium'
    })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(JSON.stringify(data))
  return data.data[0].b64_json
}

async function uploadImageToSupabase(b64, fileName) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })
  const file = new File([blob], fileName, { type: 'image/png' })

  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(`generated/${fileName}`, file, { upsert: true })

  if (error) throw error

  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function generateImages(imagePrompt, count = 3) {
  const variations = [
    imagePrompt,
    `${imagePrompt} Wide angle perspective, golden hour lighting`,
    `${imagePrompt} Close detail shot, cool teal tones, professional corporate feel`,
  ]

  const promises = variations.slice(0, count).map(async (prompt, i) => {
    const b64 = await generateImage(prompt)
    const fileName = `gptimage-${Date.now()}-${i}.png`
    return uploadImageToSupabase(b64, fileName)
  })

  return Promise.all(promises)
}
