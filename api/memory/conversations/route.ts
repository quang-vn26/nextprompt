/**
 * Conversations API Routes
 * CRUD operations for conversation memory
 */

import {
    saveConversation,
    getRecentConversations,
    deleteConversation,
    getConversation,
} from '../../lib/memory-db';

export const config = {
    runtime: 'edge',
};

// GET /api/memory/conversations - List conversations
export async function GET(request: Request): Promise<Response> {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const limit = parseInt(url.searchParams.get('limit') || '20');

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'userId is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const conversations = await getRecentConversations(userId, limit);

        return new Response(
            JSON.stringify({ conversations }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Get conversations error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// POST /api/memory/conversations - Save new conversation
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json();
        const { userId, title, messages, entities = [] } = body;

        if (!userId || !title || !messages) {
            return new Response(
                JSON.stringify({ error: 'userId, title, and messages are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const id = await saveConversation(userId, title, messages, entities);

        return new Response(
            JSON.stringify({ success: true, id }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Save conversation error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// DELETE /api/memory/conversations/:id - Delete conversation
export async function DELETE(request: Request): Promise<Response> {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        // Extract conversation ID from path
        const pathParts = url.pathname.split('/');
        const conversationId = pathParts[pathParts.length - 1];

        if (!userId || !conversationId || conversationId === 'conversations') {
            return new Response(
                JSON.stringify({ error: 'userId and conversationId are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const deleted = await deleteConversation(userId, conversationId);

        if (!deleted) {
            return new Response(
                JSON.stringify({ error: 'Conversation not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Delete conversation error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
