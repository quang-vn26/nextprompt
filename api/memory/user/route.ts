/**
 * Memory API Routes
 * Handles all memory-related API endpoints
 */

import { getOrCreateUser, updateUserPreferences } from '../../lib/memory-db';

export const config = {
    runtime: 'edge',
};

// POST /api/memory/user - Create or sync user
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json();
        const { anonymousId } = body;

        if (!anonymousId) {
            return new Response(
                JSON.stringify({ error: 'anonymousId is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const user = await getOrCreateUser(anonymousId);

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    anonymousId: user.anonymousId,
                    preferences: user.preferences,
                    createdAt: user.createdAt,
                },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Memory user API error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
