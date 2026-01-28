/**
 * Memory Database Operations
 * MongoDB operations for the Hybrid Memory System
 */

import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from './mongodb';
import {
    UserDocument,
    ConversationDocument,
    EntityDocument,
    UserPreferences,
    DEFAULT_PREFERENCES,
} from './memory-types';

// ============================================
// Collection Getters
// ============================================

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
    const { db } = await connectToDatabase();
    return db.collection<UserDocument>('users');
}

export async function getConversationsCollection(): Promise<Collection<ConversationDocument>> {
    const { db } = await connectToDatabase();
    return db.collection<ConversationDocument>('conversations');
}

export async function getEntitiesCollection(): Promise<Collection<EntityDocument>> {
    const { db } = await connectToDatabase();
    return db.collection<EntityDocument>('entities');
}

// ============================================
// User Operations
// ============================================

/**
 * Create or get user by anonymousId
 */
export async function getOrCreateUser(anonymousId: string): Promise<UserDocument> {
    const users = await getUsersCollection();

    // Try to find existing user
    const existingUser = await users.findOne({ anonymousId });
    if (existingUser) {
        // Update last active time
        await users.updateOne(
            { anonymousId },
            { $set: { lastActiveAt: new Date() } }
        );
        return existingUser;
    }

    // Create new user
    const newUser: UserDocument = {
        anonymousId,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        preferences: DEFAULT_PREFERENCES,
    };

    await users.insertOne(newUser);
    console.log('✅ Created new user:', anonymousId.substring(0, 8) + '...');

    return newUser;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
    anonymousId: string,
    preferences: Partial<UserPreferences>
): Promise<void> {
    const users = await getUsersCollection();
    await users.updateOne(
        { anonymousId },
        {
            $set: {
                ...Object.fromEntries(
                    Object.entries(preferences).map(([k, v]) => [`preferences.${k}`, v])
                ),
                lastActiveAt: new Date(),
            },
        }
    );
}

/**
 * Link email to anonymous user (for sync across devices)
 */
export async function linkEmailToUser(anonymousId: string, email: string): Promise<boolean> {
    const users = await getUsersCollection();

    // Check if email already used
    const existingEmail = await users.findOne({ email });
    if (existingEmail && existingEmail.anonymousId !== anonymousId) {
        return false; // Email already linked to another account
    }

    await users.updateOne(
        { anonymousId },
        { $set: { email, lastActiveAt: new Date() } }
    );
    return true;
}

// ============================================
// Conversation Operations
// ============================================

/**
 * Save a conversation
 */
export async function saveConversation(
    userId: string,
    title: string,
    messages: ConversationDocument['messages'],
    entities: string[] = []
): Promise<string> {
    const conversations = await getConversationsCollection();

    const conversation: ConversationDocument = {
        userId,
        title,
        messages,
        entities,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const result = await conversations.insertOne(conversation);
    return result.insertedId.toString();
}

/**
 * Get recent conversations for a user
 */
export async function getRecentConversations(
    userId: string,
    limit: number = 10
): Promise<ConversationDocument[]> {
    const conversations = await getConversationsCollection();

    return conversations
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
}

/**
 * Delete a conversation
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    const conversations = await getConversationsCollection();

    const result = await conversations.deleteOne({
        _id: new ObjectId(conversationId),
        userId, // Ensure user owns the conversation
    });

    return result.deletedCount > 0;
}

/**
 * Get conversation by ID (with ownership check)
 */
export async function getConversation(
    userId: string,
    conversationId: string
): Promise<ConversationDocument | null> {
    const conversations = await getConversationsCollection();

    return conversations.findOne({
        _id: new ObjectId(conversationId),
        userId,
    });
}

// ============================================
// Initialize Indexes
// ============================================

export async function initializeMemoryIndexes(): Promise<void> {
    const users = await getUsersCollection();
    const conversations = await getConversationsCollection();
    const entities = await getEntitiesCollection();

    // Create indexes
    await users.createIndex({ anonymousId: 1 }, { unique: true });
    await users.createIndex({ email: 1 }, { sparse: true });
    await conversations.createIndex({ userId: 1, createdAt: -1 });
    await entities.createIndex({ userId: 1, mentions: -1 });

    console.log('✅ Memory system indexes initialized');
}
