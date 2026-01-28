/**
 * Chat API Route
 * Handles chat requests via Vercel serverless function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAIProvider } from '../lib/ai-provider';
import { initializeSettings } from '../lib/mongodb';
import { ChatRequest, ChatMessage } from '../lib/types';

// Initialize settings on cold start
let initialized = false;

async function ensureInitialized() {
    if (!initialized) {
        try {
            await initializeSettings();
            initialized = true;
        } catch (error) {
            console.warn('⚠️ Could not initialize MongoDB settings:', error);
        }
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await ensureInitialized();

        // Parse request body
        const body = req.body as ChatRequest;
        const { messages, model = 'fast', stream = false, temperature, maxTokens } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Get AI provider
        const sessionId = req.headers['x-session-id'] as string || 'anonymous';
        const aiProvider = getAIProvider(sessionId);

        if (!aiProvider.isReady()) {
            return res.status(503).json({ error: 'AI provider not available. Check API keys.' });
        }

        // Handle streaming response
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const streamGenerator = aiProvider.streamChat({
                messages: messages as ChatMessage[],
                model,
                temperature,
                maxTokens,
            });

            for await (const chunk of streamGenerator) {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);

                if (chunk.done) {
                    res.write('data: [DONE]\n\n');
                    break;
                }
            }

            res.end();
            return;
        }

        // Handle non-streaming response
        const response = await aiProvider.chatCompletion({
            messages: messages as ChatMessage[],
            model,
            temperature,
            maxTokens,
        });

        return res.status(200).json(response);

    } catch (error: any) {
        console.error('❌ Chat API error:', error);

        // Handle specific error types
        if (error.message?.includes('rate limit')) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}
