import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import AskAbbyChannel from '../AskAbbyChannel';
import { useAbbyStore } from '@/stores/abbyStore';
import * as abbyService from '../../../services/abbyService';
import type { AbbyConversationMessage, AbbyConversationSummary } from '../../../types/abby';

vi.mock('../../../services/abbyService');
vi.mock('@/stores/abbyStore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/stores/abbyStore')>();
  return mod; // use real store so state persists across renders in tests
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  useAbbyStore.setState({ conversationId: null, messages: [], conversationList: [] });
  vi.clearAllMocks();
  localStorage.clear();
  // jsdom does not implement scrollTo — mock it to avoid unhandled exceptions
  window.HTMLElement.prototype.scrollTo = () => {};
  // Default mock so TanStack Query never receives undefined from the history hook
  vi.mocked(abbyService.listAbbyConversations).mockResolvedValue([]);
});

describe('AskAbbyChannel', () => {
  it('shows welcome card when no conversationId is in store', async () => {
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });
    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
    expect(abbyService.fetchAbbyConversation).not.toHaveBeenCalled();
  });

  it('loads conversation from API when store has a conversationId', async () => {
    vi.mocked(abbyService.fetchAbbyConversation).mockResolvedValue({
      id: 7,
      title: null,
      page_context: 'commons_ask_abby',
      messages: [
        { id: 1, role: 'user', content: 'Hello Abby', created_at: new Date().toISOString(), metadata: {} } satisfies AbbyConversationMessage,
        { id: 2, role: 'assistant', content: 'Hello researcher', created_at: new Date().toISOString(), metadata: {} } satisfies AbbyConversationMessage,
      ],
    });

    useAbbyStore.setState({ conversationId: 7 });
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText('Hello Abby')).toBeInTheDocument()
    );
    expect(abbyService.fetchAbbyConversation).toHaveBeenCalledWith(7);
  });

  it('restores conversation when persisted conversationId hydrates after initial render', async () => {
    vi.mocked(abbyService.fetchAbbyConversation).mockResolvedValue({
      id: 11,
      title: 'OMOP basics',
      page_context: 'commons_ask_abby',
      messages: [
        { id: 1, role: 'user', content: 'What is OMOP CDM?', created_at: new Date().toISOString(), metadata: {} } satisfies AbbyConversationMessage,
        { id: 2, role: 'assistant', content: 'OMOP CDM is a common data model.', created_at: new Date().toISOString(), metadata: {} } satisfies AbbyConversationMessage,
      ],
    });

    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );

    act(() => {
      useAbbyStore.setState({ conversationId: 11 });
    });

    await waitFor(() =>
      expect(screen.getByText('What is OMOP CDM?')).toBeInTheDocument()
    );
    expect(abbyService.fetchAbbyConversation).toHaveBeenCalledWith(11);
  });

  it('clears store and shows welcome when conversation fetch returns 404', async () => {
    vi.mocked(abbyService.fetchAbbyConversation).mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    );

    useAbbyStore.setState({ conversationId: 999 });
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('shows history panel when history button is clicked', async () => {
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue([
      { id: 1, title: 'T2DM study', page_context: 'commons_ask_abby', created_at: '2026-03-15T00:00:00Z', updated_at: '2026-03-15T00:00:00Z', messages_count: 3 } satisfies AbbyConversationSummary,
    ]);

    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await userEvent.click(screen.getByTitle('Conversation history'));
    await waitFor(() =>
      expect(screen.getByText('T2DM study')).toBeInTheDocument()
    );
  });

  it('New chat button clears conversationId and shows welcome card', async () => {
    useAbbyStore.setState({ conversationId: 5 });
    vi.mocked(abbyService.fetchAbbyConversation).mockResolvedValue({
      id: 5,
      title: null,
      page_context: 'commons_ask_abby',
      messages: [],
    });

    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    // Open history to access "New chat" button
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue([]);
    await userEvent.click(screen.getByTitle('Conversation history'));
    await userEvent.click(screen.getByText('New chat'));

    expect(useAbbyStore.getState().conversationId).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
  });
});
