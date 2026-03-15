import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GrafanaLaunchCard } from '../GrafanaLaunchCard';
import type { SystemHealthService } from '@/types/models';

const healthyService: SystemHealthService = {
  key: 'grafana',
  name: 'Grafana',
  status: 'healthy',
  message: 'Grafana 11.4.0 is running.',
};

const downService: SystemHealthService = {
  key: 'grafana',
  name: 'Grafana',
  status: 'down',
  message: 'Connection refused.',
};

describe('GrafanaLaunchCard', () => {
  it('renders the service name and message', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="/grafana" />);
    expect(screen.getByText('Grafana')).toBeInTheDocument();
    expect(screen.getByText('Grafana 11.4.0 is running.')).toBeInTheDocument();
  });

  it('shows healthy badge when status is healthy', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="/grafana" />);
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('shows down badge when status is down', () => {
    render(<GrafanaLaunchCard service={downService} grafanaUrl="/grafana" />);
    expect(screen.getByText('down')).toBeInTheDocument();
  });

  it('renders the Open Dashboard link pointing to grafanaUrl', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="https://parthenon.acumenus.net/grafana" />);
    const link = screen.getByRole('link', { name: /open dashboard/i });
    expect(link).toHaveAttribute('href', 'https://parthenon.acumenus.net/grafana');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
