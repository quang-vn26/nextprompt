/**
 * MongoDB Connection Module
 * Handles connection pooling for serverless environment (Vercel)
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { SettingsDocument, UsageLogDocument } from './types';

// Connection URI from environment
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'nextprompt';

if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI not found in environment variables');
}

// Global connection cache for serverless
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Get MongoDB connection with caching for serverless environment
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
    // Return cached connection if exists
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    // Create new connection
    const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });

    await client.connect();
    const db = client.db(DB_NAME);

    // Cache for reuse
    cachedClient = client;
    cachedDb = db;

    console.log('✅ Connected to MongoDB:', DB_NAME);

    return { client, db };
}

/**
 * Get Settings collection
 */
export async function getSettingsCollection(): Promise<Collection<SettingsDocument>> {
    const { db } = await connectToDatabase();
    return db.collection<SettingsDocument>('settings');
}

/**
 * Get Usage Logs collection
 */
export async function getUsageLogsCollection(): Promise<Collection<UsageLogDocument>> {
    const { db } = await connectToDatabase();
    return db.collection<UsageLogDocument>('usage_logs');
}

/**
 * Initialize default settings if not exists
 */
export async function initializeSettings(): Promise<void> {
    const settings = await getSettingsCollection();

    // Initialize default settings if not exists (Atomic)
    await settings.updateOne(
        { key: 'ai_config' },
        {
            $setOnInsert: {
                key: 'ai_config',
                value: {
                    defaultModel: 'fast',
                    temperature: 0.7,
                    maxTokens: 2048,
                    enableFallback: true,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        },
        { upsert: true }
    );
}

/**
 * Get AI configuration from database
 */
export async function getAIConfig(): Promise<Record<string, unknown> | null> {
    const settings = await getSettingsCollection();
    const config = await settings.findOne({ key: 'ai_config' });
    return config?.value || null;
}

/**
 * Update AI configuration
 */
export async function updateAIConfig(config: Partial<Record<string, unknown>>): Promise<void> {
    const settings = await getSettingsCollection();
    await settings.updateOne(
        { key: 'ai_config' },
        {
            $set: {
                value: config,
                updatedAt: new Date(),
            },
            $setOnInsert: {
                createdAt: new Date(),
            }
        },
        { upsert: true }
    );
}

/**
 * Log token usage
 */
export async function logUsage(
    sessionId: string,
    model: string,
    promptTokens: number,
    completionTokens: number
): Promise<void> {
    const usageLogs = await getUsageLogsCollection();
    await usageLogs.insertOne({
        sessionId,
        model: model, // Updated types allow string
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        timestamp: new Date(),
    });
}

/**
 * Close database connection (for cleanup)
 */
export async function closeConnection(): Promise<void> {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
        console.log('🔌 MongoDB connection closed');
    }
}
