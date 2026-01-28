/**
 * Preferences API Routes
 * User preferences management
 */

import { getOrCreateUser, updateUserPreferences } from '../../lib/memory-db';

export const config = {
    runtime: 'edge',
};

// GET /api/memory/preferences - Get user preferences
export async function GET(request: Request): Promise<Response> {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'userId is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const user = await getOrCreateUser(userId);

        return new Response(
            JSON.stringify({ preferences: user.preferences }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Get preferences error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// PUT /api/memory/preferences - Update preferences
export async function PUT(request: Request): Promise<Response> {
    try {
        const body = await request.json();
        const { userId, preferences } = body;

        if (!userId || !preferences) {
            return new Response(
                JSON.stringify({ error: 'userId and preferences are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        await updateUserPreferences(userId, preferences);

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Update preferences error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
