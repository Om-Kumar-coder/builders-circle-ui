'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Send, AtSign, Trash2, Loader2, Pencil, Check, X } from 'lucide-react';

const MAX_LENGTH = 1000;

interface Message {
  id: string;
  message: string;
  mentions: string[];
  readBy: string[];
  editedAt?: string | null;
  createdAt: string;
  author: {
    id: string;
    name?: string;
    email: string;
    profile?: { avatar?: string };
  };
}

interface Participant {
  id: string;
  name?: string;
  email: string;
}

interface CycleDiscussionProps {
  cycleId: string;
  participants: Participant[];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderMessageText(text: string): React.ReactNode {
  const parts = text.split(/(@\w[\w\s]*?\b)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-indigo-400 font-medium">{part}</span>
      : part
  );
}

function Avatar({ name, email }: { name?: string; email: string }) {
  const letter = name?.[0] ?? email[0];
  return (
    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
      {letter.toUpperCase()}
    </div>
  );
}

export default function CycleDiscussion({ cycleId, participants }: CycleDiscussionProps) {
  const { user } = useAuth();
  const isFounder = user?.role === 'founder';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCycleMessages(cycleId);
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  // SSE connection
  useEffect(() => {
    fetchMessages();

    const url = apiClient.getCycleMessagesStreamUrl(cycleId);
    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('new_message', (e: MessageEvent) => {
      const msg: Message = JSON.parse(e.data);
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read if window is focused
      if (document.hasFocus()) {
        apiClient.markMessageRead(msg.id).catch(() => {});
      }
    });

    es.addEventListener('edit_message', (e: MessageEvent) => {
      const updated: Message = JSON.parse(e.data);
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    });

    es.addEventListener('delete_message', (e: MessageEvent) => {
      const { id } = JSON.parse(e.data);
      setMessages(prev => prev.filter(m => m.id !== id));
    });

    es.onerror = () => {
      // SSE will auto-reconnect; no action needed
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [cycleId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [editingId]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending || newMessage.length > MAX_LENGTH) return;
    try {
      setSending(true);
      await apiClient.sendMessage(cycleId, newMessage.trim(), mentions);
      setNewMessage('');
      setMentions([]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      setDeletingId(messageId);
      await apiClient.deleteMessage(messageId);
      // SSE will handle removal; optimistic fallback:
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim() || editText.length > MAX_LENGTH) return;
    try {
      setSavingEdit(true);
      await apiClient.editMessage(editingId, editText.trim());
      // SSE will update; optimistic fallback:
      setMessages(prev => prev.map(m =>
        m.id === editingId ? { ...m, message: editText.trim(), editedAt: new Date().toISOString() } : m
      ));
      cancelEdit();
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape')) {
      e.preventDefault();
      if (e.key === 'Escape') setShowMentionDropdown(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const handleMention = (participant: Participant) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBefore = newMessage.substring(0, cursorPos);
    const textAfter = newMessage.substring(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex === -1) return;
    const displayName = participant.name ?? participant.email;
    const newText = textBefore.substring(0, atIndex) + `@${displayName} ` + textAfter;
    setNewMessage(newText);
    if (!mentions.includes(participant.id)) setMentions(prev => [...prev, participant.id]);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setTimeout(() => {
      textarea.focus();
      const pos = atIndex + displayName.length + 2;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    const cursorPos = e.target.selectionStart;
    const textBefore = value.substring(0, cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex !== -1 && !textBefore.substring(atIndex + 1).includes(' ')) {
      setMentionQuery(textBefore.substring(atIndex + 1));
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const filteredParticipants = participants.filter(p =>
    p.id !== user?.id &&
    (p.name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(mentionQuery.toLowerCase()))
  );

  // Group messages by date
  const groupedMessages: { label: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const label = formatDateLabel(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.label === label) last.messages.push(msg);
    else groupedMessages.push({ label, messages: [msg] });
  }

  const charsLeft = MAX_LENGTH - newMessage.length;
  const isOverLimit = charsLeft < 0;

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-4 p-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-gray-800 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-800 rounded w-1/4" />
                <div className="h-3 bg-gray-800 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <span className="text-4xl mb-3 opacity-40">💬</span>
            <p className="text-gray-400 text-sm">No messages yet</p>
            <p className="text-gray-500 text-xs mt-1">Start the conversation</p>
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500 shrink-0">{group.label}</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              {group.messages.map(message => (
                <div key={message.id} className="group flex gap-3 py-1.5 px-1 rounded-lg hover:bg-gray-900/50">
                  <Avatar name={message.author.name} email={message.author.email} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {message.author.name ?? message.author.email}
                      </span>
                      <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                      {message.editedAt && (
                        <span className="text-xs text-gray-600 italic">(edited)</span>
                      )}
                    </div>

                    {editingId === message.id ? (
                      <div className="mt-1">
                        <textarea
                          ref={editInputRef}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="w-full px-2 py-1.5 bg-gray-800 border border-indigo-500 rounded text-gray-100 
                            text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          rows={2}
                          disabled={savingEdit}
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={saveEdit}
                            disabled={savingEdit || !editText.trim() || editText.length > MAX_LENGTH}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 
                              disabled:bg-gray-700 text-white text-xs rounded transition-colors"
                          >
                            {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 
                              text-gray-300 text-xs rounded transition-colors"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                          <span className={`text-xs ml-auto ${editText.length > MAX_LENGTH ? 'text-red-400' : 'text-gray-500'}`}>
                            {MAX_LENGTH - editText.length}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 break-words leading-relaxed mt-0.5">
                        {renderMessageText(message.message)}
                      </p>
                    )}
                  </div>

                  {/* Founder actions */}
                  {isFounder && editingId !== message.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 mt-0.5 shrink-0">
                      <button
                        onClick={() => startEdit(message)}
                        className="p-1 rounded hover:bg-indigo-500/20 text-gray-500 hover:text-indigo-400 transition-all"
                        aria-label="Edit message"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(message.id)}
                        disabled={deletingId === message.id}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                        aria-label="Delete message"
                      >
                        {deletingId === message.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-800 mt-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message... Use @ to mention"
            className={`w-full px-3 py-2 bg-gray-900 border rounded-lg text-gray-100 
              placeholder-gray-500 resize-none focus:outline-none focus:ring-2 text-sm
              ${isOverLimit ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-indigo-500'}`}
            rows={2}
            disabled={sending}
          />

          {showMentionDropdown && filteredParticipants.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 
              rounded-lg shadow-xl max-h-36 overflow-y-auto z-10">
              {filteredParticipants.map(p => (
                <button
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); handleMention(p); }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Avatar name={p.name} email={p.email} />
                  <div>
                    <p className="text-sm text-gray-200">{p.name ?? p.email}</p>
                    {p.name && <p className="text-xs text-gray-500">{p.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            {mentions.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-indigo-400">
                <AtSign className="w-3 h-3" />
                {mentions.length} mention{mentions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isOverLimit ? 'text-red-400' : charsLeft < 100 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {charsLeft}
            </span>
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending || isOverLimit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 
                disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg 
                transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
