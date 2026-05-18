// src/lib/claudeAgent.js

import Anthropic from '@anthropic-ai/sdk'
import BRAND_SYSTEM_PROMPT from './brandContext'
import { supabase } from './supabase'

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
})

async function loadDynamicContext() {
  const [assetsRes, rulesRes, strategyRes, topPostsRes] = await Promise.all([
    supabase.from('brand_assets').select('name, description, file_type, tags'),
    supabase.from('content_rules').select('suggestion').eq('approved', true),
    supabase.from('strategy').select('*').eq('active', true).limit(1).maybeSingle(),
    supabase.from('posts')
      .select('copy, platform, pillar, rating')
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .limit(10)
  ])

  return {
    assets: assetsRes.data || [],
    rules: rulesRes.data || [],
    strategy: strategyRes.data,
    topPosts: topPostsRes.data || []
  }
}

export async function generatePostBrief({
  platform,
  pillar,
  service,
  postType = 'organic',
  tone = 'auto',
  extraDirection = '',
  scheduledDate,
  onProgress
}) {
  onProgress?.('Loading strategy context...')
  const { assets, rules, strategy, topPosts } = await loadDynamicContext()

  const dynamicContext = `
CURRENT STRATEGY:
${strategy ? `
Week focus: ${JSON.stringify(strategy.pillar_priorities)}
Service priorities: ${JSON.stringify(strategy.service_priorities)}
AI direction: ${strategy.ai_direction}
` : 'No strategy loaded — use default brand guidelines.'}

ACTIVE LEARNING RULES (apply these):
${rules.length > 0
    ? rules.map(r => `- ${r.suggestion}`).join('\n')
    : '- No rules yet. Follow brand guidelines.'}

TOP PERFORMING CONTENT (reference these styles):
${topPosts.length > 0
    ? topPosts.map(p => `[${p.platform} - ${p.pillar} - Rating: ${p.rating}★]\n"${p.copy.substring(0, 150)}..."`).join('\n\n')
    : '- No performance data yet. Use brand guidelines.'}

BRAND ASSETS AVAILABLE:
${assets.map(a => `- ${a.name} (${a.file_type}): ${a.description}`).join('\n') || '- No assets uploaded yet.'}
`

  onProgress?.('Generating content brief...')

  const userPrompt = `
Generate a complete content brief for the following post:

Platform: ${platform}
Content Pillar: ${pillar}
Service Focus: ${service}
Post Type: ${postType}
Tone preference: ${tone}
Scheduled date: ${scheduledDate || 'this week'}
${extraDirection ? `Extra direction: ${extraDirection}` : ''}

${dynamicContext}

Output EXACTLY this structure with these exact labels:

COPY:
[Full post copy — platform appropriate length, voice, hashtags]

VISUAL_BRIEF:
[2-3 sentences describing the finished image for the human reviewer]

IMAGE_MODE: [BRAND_GRAPHIC / SCENE / PORTRAIT]

IMAGE_PROMPT:
[Detailed prompt for the OpenAI Visual Agent — be specific about:
person description, expression, pose, uniform, background, lighting,
headline text to include on the image, proof points to show,
layout direction, brand colours. This goes directly to an image
generation model so be precise and complete.]

HEADLINE_TEXT:
[The main headline that appears ON the image — max 6 words, punchy]

SUBHEADLINE_TEXT:
[Supporting text on image — max 10 words]

PROOF_POINTS:
[3-5 bullet points to show as checklist on image — if BRAND_GRAPHIC mode]

CTA_TEXT:
[Call to action text on image — specific, not generic]

CANVA_NOTES:
[Instructions for the human doing final logo placement and polish]

AD_HEADLINE:
[If paid post: Meta ad headline, max 40 chars]

AD_PRIMARY:
[If paid post: Meta primary text, max 125 chars]

AD_DESCRIPTION:
[If paid post: Meta description, max 30 chars]
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: BRAND_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const output = response.content[0].text
  return parseAgentOutput(output)
}

function parseAgentOutput(text) {
  const extract = (label, multiline = false) => {
    if (multiline) {
      const match = text.match(new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`))
      return match?.[1]?.trim() || ''
    }
    const match = text.match(new RegExp(`${label}: (.+)`))
    return match?.[1]?.trim() || ''
  }

  return {
    copy: extract('COPY', true),
    visualBrief: extract('VISUAL_BRIEF', true),
    imageMode: extract('IMAGE_MODE'),
    imagePrompt: extract('IMAGE_PROMPT', true),
    headlineText: extract('HEADLINE_TEXT'),
    subheadlineText: extract('SUBHEADLINE_TEXT'),
    proofPoints: extract('PROOF_POINTS', true),
    ctaText: extract('CTA_TEXT'),
    canvaNotes: extract('CANVA_NOTES', true),
    adHeadline: extract('AD_HEADLINE'),
    adPrimary: extract('AD_PRIMARY'),
    adDescription: extract('AD_DESCRIPTION'),
    rawOutput: text
  }
}

export async function generateWeekBatch({
  weekStart,
  postingSchedule,
  onProgress,
  onPostComplete
}) {
  const { strategy } = await loadDynamicContext()

  const schedule = postingSchedule || {
    LinkedIn: 4,
    Instagram: 5,
    Facebook: 3,
    'Google Business': 1
  }

  const plan = buildWeekPlan(weekStart, schedule, strategy)
  const total = plan.length

  onProgress?.(`Starting generation of ${total} posts...`)

  const generated = []

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i]
    onProgress?.(`Generating post ${i + 1} of ${total}: ${item.platform} — ${item.pillar}`)

    try {
      const brief = await generatePostBrief({
        platform: item.platform,
        pillar: item.pillar,
        service: item.service,
        scheduledDate: item.date,
        onProgress: (msg) => onProgress?.(`Post ${i + 1}/${total}: ${msg}`)
      })

      const adVariant = brief.adHeadline ? JSON.stringify({
        headline: brief.adHeadline,
        primary: brief.adPrimary,
        description: brief.adDescription
      }) : null

      const { data: post } = await supabase
        .from('posts')
        .insert({
          platform: item.platform,
          pillar: item.pillar,
          service: item.service,
          scheduled_date: item.date,
          copy: brief.copy,
          visual_brief: brief.visualBrief,
          image_mode: brief.imageMode,
          image_prompt: brief.imagePrompt,
          headline_text: brief.headlineText,
          subheadline_text: brief.subheadlineText,
          proof_points: brief.proofPoints,
          cta_text: brief.ctaText,
          canva_notes: brief.canvaNotes,
          status: 'pending_approval',
          post_type: 'organic',
          ad_variant: adVariant
        })
        .select()
        .single()

      generated.push({ ...post, brief })
      onPostComplete?.(post, i + 1, total)

      await new Promise(r => setTimeout(r, 1000))

    } catch (err) {
      console.error(`Failed to generate post ${i + 1}:`, err)
      onProgress?.(`Post ${i + 1} failed — continuing...`)
    }
  }

  return generated
}

function buildWeekPlan(weekStart, schedule, strategy) {
  const start = new Date(weekStart)
  const plan = []

  const weekNum = Math.floor(start.getDate() / 7) % 4
  const pillarRotations = [
    [
      { pillar: 'Technology & Systems', weight: 35 },
      { pillar: 'Trust & Credibility', weight: 25 },
      { pillar: 'Education & Expertise', weight: 20 },
      { pillar: 'Cleaning & Facilities', weight: 10 },
      { pillar: 'Behind the Brand', weight: 10 }
    ],
    [
      { pillar: 'Trust & Credibility', weight: 35 },
      { pillar: 'Technology & Systems', weight: 25 },
      { pillar: 'Cleaning & Facilities', weight: 20 },
      { pillar: 'Education & Expertise', weight: 10 },
      { pillar: 'Behind the Brand', weight: 10 }
    ],
    [
      { pillar: 'Education & Expertise', weight: 35 },
      { pillar: 'Technology & Systems', weight: 25 },
      { pillar: 'Trust & Credibility', weight: 20 },
      { pillar: 'Behind the Brand', weight: 10 },
      { pillar: 'Cleaning & Facilities', weight: 10 }
    ],
    [
      { pillar: 'Behind the Brand', weight: 35 },
      { pillar: 'Technology & Systems', weight: 25 },
      { pillar: 'Cleaning & Facilities', weight: 20 },
      { pillar: 'Trust & Credibility', weight: 10 },
      { pillar: 'Education & Expertise', weight: 10 }
    ]
  ]

  const pillars = strategy?.pillar_priorities
    ? Object.entries(strategy.pillar_priorities).map(([pillar, weight]) => ({ pillar, weight }))
    : pillarRotations[weekNum]

  const services = ['Commercial', 'Industrial', 'Strata', 'Data Centre',
    'Window & Solar', 'Medical', 'Short Stay']

  const platformDays = {
    LinkedIn: [0, 1, 2, 3],
    Instagram: [0, 1, 2, 3, 4],
    Facebook: [0, 2, 4],
    'Google Business': [2]
  }

  Object.entries(schedule).forEach(([platform, count]) => {
    const days = platformDays[platform] || [0, 1, 2, 3, 4]

    for (let i = 0; i < count; i++) {
      const dayOffset = days[i % days.length]
      const date = new Date(start)
      date.setDate(start.getDate() + dayOffset)

      const pillar = selectByWeight(pillars)
      const service = services[Math.floor(Math.random() * services.length)]

      plan.push({
        platform,
        pillar,
        service,
        date: date.toISOString().split('T')[0]
      })
    }
  })

  return plan.sort((a, b) => new Date(a.date) - new Date(b.date))
}

function selectByWeight(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * total
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item.pillar
  }
  return items[0].pillar
}
