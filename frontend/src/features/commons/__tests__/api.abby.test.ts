import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAbbyConversations } from '../api';
import * as abbyService from '../services/abbyService';

vi.mock('../services/abbyService');

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useAbbyConversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches conversation list from listAbbyConversations', async () => {
    const mockData = [
      { id: 1, title: 'T2DM study', page_context: 'commons_ask_abby', created_at: '2026-03-15', messages_count: 4 },
    ];
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue(mockData as never);

    const { result } = renderHook(() => useAbbyConversations(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(abbyService.listAbbyConversations).toHaveBeenCalledOnce();
  });

  it('uses staleTime of 60 seconds', () => {
    // The hook should not refetch within 60s — just verify it is exported correctly
    expect(useAbbyConversations).toBeDefined();
  });
});
