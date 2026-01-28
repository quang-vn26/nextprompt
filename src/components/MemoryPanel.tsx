/**
 * MemoryPanel Component
 * UI for managing conversation memory, preferences, and settings
 */

import React from 'react';
import {
    makeStyles,
    tokens,
    Button,
    Switch,
    Text,
    Divider,
    Spinner,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    Badge,
} from '@fluentui/react-components';
import {
    History24Regular,
    Delete24Regular,
    Settings24Regular,
    BrainCircuit24Regular,
    ChevronLeft24Regular,
    MoreVertical24Regular,
} from '@fluentui/react-icons';
import { useMemory } from '../contexts/MemoryContext';

const useStyles = makeStyles({
    panel: {
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100vh',
        width: '360px',
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        '@media (max-width: 768px)': {
            width: '100%',
        },
    },
    panelOpen: {
        transform: 'translateX(0)',
    },
    header: {
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
    },
    section: {
        marginBottom: '24px',
    },
    sectionTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        color: tokens.colorNeutralForeground2,
    },
    settingRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
    },
    conversationCard: {
        marginBottom: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ':hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
    },
    cardContent: {
        padding: '16px',
    },
    cardTitle: {
        fontWeight: 600,
        marginBottom: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cardMeta: {
        fontSize: '12px',
        color: tokens.colorNeutralForeground3,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
        color: tokens.colorNeutralForeground3,
    },
    toggleButton: {
        position: 'fixed',
        right: '20px',
        top: '20px',
        zIndex: 999,
        backgroundColor: 'rgba(100, 80, 200, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '50%',
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: 'none',
        ':hover': {
            backgroundColor: 'rgba(100, 80, 200, 1)',
            transform: 'scale(1.05)',
        },
    },
    badge: {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
    },
});

interface MemoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ isOpen, onClose }) => {
    const styles = useStyles();
    const {
        conversations,
        preferences,
        isLoading,
        deleteConversation,
        updatePreferences,
    } = useMemory();

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this conversation from memory?')) {
            await deleteConversation(id);
        }
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return d.toLocaleDateString();
    };

    return (
        <>
            <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <BrainCircuit24Regular />
                        <Text weight="semibold" size={500}>Memory</Text>
                    </div>
                    <Button
                        appearance="subtle"
                        icon={<ChevronLeft24Regular />}
                        onClick={onClose}
                    />
                </div>

                <div className={styles.content}>
                    {/* Settings Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <Settings24Regular />
                            <Text weight="semibold">Settings</Text>
                        </div>

                        <div className={styles.settingRow}>
                            <Text>Enable Memory</Text>
                            <Switch
                                checked={preferences.memoryEnabled}
                                onChange={(_, data) =>
                                    updatePreferences({ memoryEnabled: data.checked })
                                }
                            />
                        </div>

                        <Divider />
                    </div>

                    {/* Conversations Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <History24Regular />
                            <Text weight="semibold">Past Conversations</Text>
                            <Badge appearance="filled" color="informative">
                                {conversations.length}
                            </Badge>
                        </div>

                        {isLoading ? (
                            <div className={styles.emptyState}>
                                <Spinner size="medium" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className={styles.emptyState}>
                                <Text>No conversations saved yet</Text>
                                <Text size={200} block style={{ marginTop: '8px' }}>
                                    Your chat history will appear here
                                </Text>
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <div key={conv._id} className={styles.conversationCard}>
                                    <div className={styles.cardContent}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className={styles.cardTitle}>
                                                    {conv.title}
                                                </div>
                                                <div className={styles.cardMeta}>
                                                    <span>{formatDate(conv.createdAt)}</span>
                                                    <span>•</span>
                                                    <span>{conv.messages.length} messages</span>
                                                </div>
                                            </div>
                                            <Menu>
                                                <MenuTrigger>
                                                    <Button
                                                        appearance="subtle"
                                                        icon={<MoreVertical24Regular />}
                                                        size="small"
                                                    />
                                                </MenuTrigger>
                                                <MenuPopover>
                                                    <MenuList>
                                                        <MenuItem
                                                            icon={<Delete24Regular />}
                                                            onClick={(e) => handleDeleteConversation(conv._id, e)}
                                                        >
                                                            Delete
                                                        </MenuItem>
                                                    </MenuList>
                                                </MenuPopover>
                                            </Menu>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// Toggle button component
export const MemoryToggleButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const styles = useStyles();
    const { conversations, preferences } = useMemory();

    return (
        <button className={styles.toggleButton} onClick={onClick}>
            <BrainCircuit24Regular style={{ color: 'white' }} />
            {preferences.memoryEnabled && conversations.length > 0 && (
                <Badge
                    className={styles.badge}
                    appearance="filled"
                    color="success"
                    size="small"
                >
                    {conversations.length}
                </Badge>
            )}
        </button>
    );
};

export default MemoryPanel;
