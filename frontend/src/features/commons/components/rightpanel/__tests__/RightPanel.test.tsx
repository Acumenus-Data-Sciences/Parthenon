import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RightPanel } from '../RightPanel';
import type { Channel } from '../../../types';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockChannel: Channel = {
  id: 1,
  name: 'general',
  slug: 'general',
  description: 'Main research discussion',
  type: 'topic',
  visibility: 'public',
  members_count: 5,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived_at: null,
  study_id: null,
};

describe('RightPanel', () => {
  it('shows channel name and description in the unified header', () => {
    render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={mockChannel}
      />,
      { wrapper }
    );
    expect(screen.getByText('# general')).toBeInTheDocument();
    expect(screen.getByText('Main research discussion')).toBeInTheDocument();
  });

  it('shows skeleton when channel is undefined', () => {
    const { container } = render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={undefined}
      />,
      { wrapper }
    );
    // Skeleton element should exist, no channel name text
    expect(screen.queryByText(/# /)).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('calls onTabChange when a tab icon is clicked', async () => {
    const onTabChange = vi.fn();
    render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={onTabChange}
        members={[]}
        channel={mockChannel}
      />,
      { wrapper }
    );
    // Click the Pinned tab (title="Pinned")
    await userEvent.click(screen.getByTitle('Pinned'));
    expect(onTabChange).toHaveBeenCalledWith('pinned');
  });

  it('does not render a separate tab bar row below the header', () => {
    const { container } = render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={mockChannel}
      />,
      { wrapper }
    );
    // Only one border-b row at the top — the unified header.
    // Use a filter to match the exact "border-b" utility (bottom border),
    // not substrings like "border-border-default".
    const allEls = container.querySelectorAll('*');
    const borderRows = Array.from(allEls).filter((el) => {
      const cls = typeof el.className === 'string' ? el.className : '';
      return cls.split(/\s+/).some((c) => c === 'border-b');
    });
    expect(borderRows.length).toBe(1);
  });
});
