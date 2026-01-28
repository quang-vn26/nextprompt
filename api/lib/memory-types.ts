/**
 * Memory System Types
 * Types for the Hybrid Memory System
 */

import { ObjectId } from 'mongodb';

// User document stored in MongoDB
export interface UserDocument {
    _id?: ObjectId;
    anonymousId: string;
    email?: string;
    createdAt: Date;
    lastActiveAt: Date;
    preferences: UserPreferences;
}

export interface UserPreferences {
    displayName?: string;
    language: 'vi' | 'en';
    theme: 'dark' | 'light';
    memoryEnabled: boolean;
}

// Conversation document
export interface ConversationDocument {
    _id?: ObjectId;
    userId: string;
    title: string;
    summary?: string;
    messages: ConversationMessage[];
    entities: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// Entity document
export interface EntityDocument {
    _id?: ObjectId;
    userId: string;
    name: string;
    type: 'project' | 'person' | 'concept' | 'preference';
    context: string;
    mentions: number;
    lastMentioned: Date;
    createdAt: Date;
}

// Default preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
    language: 'vi',
    theme: 'dark',
    memoryEnabled: true,
};
