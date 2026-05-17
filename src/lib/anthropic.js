import Anthropic from '@anthropic-ai/sdk'
import { GENERATE_SYSTEM_PROMPT, AD_SYSTEM_PROMPT, BRAND_SYSTEM_PROMPT } from './brandContext'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

export function parseGeneratedContent(text) {
  const copyMatch = text.match(/COPY:\n([\s\S]*?)(?=\nVISUAL_BRIEF:|$)/)
  const briefMatch = text.match(/VISUAL_BRIEF:\n([\s\S]*?)(?=\nIMAGE_PROMPT:|$)/)
  const promptMatch = text.match(/IMAGE_PROMPT:\n([\s\S]*?)(?=\nHEADLINE:|$)/)
  const headlineMatch = text.match(/HEADLINE:\n([\s\S]*?)(?=\nPRIMARY_TEXT:|$)/)
  const primaryMatch = text.match(/PRIMARY_TEXT:\n([\s\S]*?)(?=\nDESCRIPTION:|$)/)
  const descMatch = text.match(/DESCRIPTION:\n([\s\S]*?)$/)

  return {
    copy: copyMatch ? copyMatch[1].trim() : '',
    visual_brief: briefMatch ? briefMatch[1].trim() : '',
    image_prompt: promptMatch ? promptMatch[1].trim() : '',
    headline: headlineMatch ? headlineMatch[1].trim() : '',
    primary_text: primaryMatch ? primaryMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
  }
}

export async function generatePostContent({ platform, pillar, service, postType, adObjective, targetAudience, cta, extraDirection }) {
  const systemPrompt = postType === 'paid' ? AD_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT

  const userMessage = `Generate a ${postType === 'paid' ? 'paid ad' : 'social media post'} for All Spot Group with these parameters:

Platform: ${platform}
Content Pillar: ${pillar}
Service Focus: ${service}
Post Type: ${postType}${adObjective ? `\nAd Objective: ${adObjective}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${cta ? `\nCTA: ${cta}` : ''}${extraDirection ? `\n\nAdditional Direction: ${extraDirection}` : ''}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  return parseGeneratedContent(response.content[0].text)
}

export async function generateDashboardInsight(posts) {
  const postSummary = posts.map(p => ({
    platform: p.platform,
    pillar: p.pillar,
    service: p.service,
    rating: p.rating,
    status: p.status,
  }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: BRAND_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Based on this post performance data from the last 30 days, write a 2-3 sentence insight for the All Spot Group team. Be specific about what's working and what to focus on. Data: ${JSON.stringify(postSummary)}`,
    }],
  })

  return response.content[0].text
}

export async function generatePerformanceReport(performanceData, posts) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: BRAND_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyse this social media performance data for All Spot Group and generate a comprehensive report.

Performance data: ${JSON.stringify(performanceData)}
Posts data: ${JSON.stringify(posts)}

Provide:
1. Overall performance summary (2-3 sentences)
2. Best performing platform and why
3. Best performing content pillar and why
4. Best performing service focus
5. Top 3 posts of the period (reference by platform and date)
6. Three specific, actionable recommendations for next month

Be analytical, specific, and reference actual numbers. Format with clear headings.`,
    }],
  })

  return response.content[0].text
}

export async function generateLearningRules(performanceData, posts) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: BRAND_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyse this 60-day performance data for All Spot Group social media. Identify 3-5 specific, testable content rules or patterns that could improve performance.

Performance data: ${JSON.stringify(performanceData)}
Posts data: ${JSON.stringify(posts)}

For each rule, respond with one clear sentence per line, like:
- "Posts with drone/technology references on LinkedIn average 40% higher engagement"
- "Tuesday and Thursday posts outperform Monday posts by 25%"

Return ONLY the rule sentences, one per line, starting with a dash.`,
    }],
  })

  const text = response.content[0].text
  const lines = text.split('\n').filter(l => l.trim().startsWith('-'))
  return lines.map(l => l.replace(/^-\s*"?/, '').replace(/"?\s*$/, '').trim())
}
