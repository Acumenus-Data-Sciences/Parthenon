import { describe, it, expect, beforeEach } from 'vitest';
import { useAbbyStore } from '../abbyStore';

// Reset store between tests
beforeEach(() => {
  useAbbyStore.setState({
    conversationId: null,
    messages: [],
    conversationList: [],
    panelOpen: false,
    pageContext: 'general',
    isStreaming: false,
    streamingContent: '',
  });
  localStorage.clear();
});

describe('abbyStore', () => {
  it('conversationId is number | null (not string)', () => {
    useAbbyStore.getState().setConversationId(42);
    const id = useAbbyStore.getState().conversationId;
    expect(typeof id).toBe('number');
    expect(id).toBe(42);
  });

  it('setConversationId(null) clears the id', () => {
    useAbbyStore.getState().setConversationId(42);
    useAbbyStore.getState().setConversationId(null);
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('clearMessages resets messages and conversationId', () => {
    useAbbyStore.getState().setConversationId(10);
    useAbbyStore.getState().clearMessages();
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('conversationId is persisted to localStorage under parthenon-abby', () => {
    useAbbyStore.getState().setConversationId(99);
    const stored = JSON.parse(localStorage.getItem('parthenon-abby') ?? '{}');
    expect(stored.state?.conversationId).toBe(99);
  });

  it('messages are NOT persisted to localStorage', () => {
    useAbbyStore.getState().addMessage({
      id: 'test',
      role: 'user',
      content: 'hello',
      timestamp: new Date(),
    });
    const stored = JSON.parse(localStorage.getItem('parthenon-abby') ?? '{}');
    expect(stored.state?.messages).toBeUndefined();
  });
});
