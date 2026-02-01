/**
 * Chat API Route
 * Handles chat requests via Vercel serverless function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getAIProvider } from '../lib/ai-provider';
import { initializeSettings } from '../lib/mongodb';
import { ChatRequest, ChatMessage } from '../lib/types';

// Schema Validation
const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
});

const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    model: z.enum(['fast', 'deep']).optional(),
    stream: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
});

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

        // Validate request body
        const parseResult = ChatRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: parseResult.error.issues
            });
        }

        const body = parseResult.data as ChatRequest;
        const { messages, model = 'fast', stream = false, temperature, maxTokens } = body;

        // Get AI provider
        const aiProvider = getAIProvider();

        if (!aiProvider.isReady()) {
            return res.status(503).json({ error: 'AI provider not available. Check API keys.' });
        }

        const sessionId = (req.headers['x-session-id'] as string) || 'anonymous';

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
            }, sessionId);

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
        }, sessionId);

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
