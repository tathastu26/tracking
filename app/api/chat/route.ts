import { NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  text: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const incomingMessages = (body?.messages || []) as ChatMessage[]

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Missing OPENROUTER_API_KEY on server',
          reply:
            'OpenRouter key is not configured on the server. Set OPENROUTER_API_KEY to enable live AI replies.',
        },
        { status: 500 }
      )
    }

    const messages = incomingMessages.map((message) => ({
      role: message.role,
      content: message.text,
    }))

    const openRouterResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
      }),
      cache: 'no-store',
    })

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text()
      return NextResponse.json(
        {
          error: 'OpenRouter request failed',
          details: errorText,
          reply:
            'The AI provider returned an error while processing your request. Please try again shortly.',
        },
        { status: 500 }
      )
    }

    const data = await openRouterResponse.json()
    const reply = data?.choices?.[0]?.message?.content || 'No response generated.'

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json(
      {
        error: 'Unexpected server error',
        reply: 'Something went wrong while contacting the AI service.',
      },
      { status: 500 }
    )
  }
}
