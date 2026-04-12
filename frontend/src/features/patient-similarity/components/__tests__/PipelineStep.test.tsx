import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PipelineStep } from '../PipelineStep';

describe('PipelineStep', () => {
  it('renders future state with step number and Run button', () => {
    render(
      <PipelineStep
        stepNumber={3}
        name="Propensity Score Matching"
        description="Create balanced comparison groups"
        status="future"
        onToggle={vi.fn()}
        onRun={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Propensity Score Matching')).toBeInTheDocument();
    expect(screen.getByText('Run ▸')).toBeInTheDocument();
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('renders loading state with spinner', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="loading"
        onToggle={vi.fn()}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('Profile Comparison')).toBeInTheDocument();
    expect(screen.queryByText('Run ▸')).not.toBeInTheDocument();
  });

  it('renders completed collapsed state with summary', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={false}
        summary="Overall divergence 42% · 6 dimensions analyzed"
        executionTimeMs={800}
        onToggle={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText(/Overall divergence 42%/)).toBeInTheDocument();
    expect(screen.getByText('0.8s')).toBeInTheDocument();
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('renders completed expanded state with children', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={true}
        summary="Overall divergence 42%"
        onToggle={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('calls onToggle when header clicked on completed step', () => {
    const onToggle = vi.fn();
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={false}
        summary="42%"
        onToggle={onToggle}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    fireEvent.click(screen.getByText('Profile Comparison'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('calls onRun when Run button clicked on future step', () => {
    const onRun = vi.fn();
    render(
      <PipelineStep
        stepNumber={3}
        name="PSM"
        description="desc"
        status="future"
        onToggle={vi.fn()}
        onRun={onRun}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    fireEvent.click(screen.getByText('Run ▸'));
    expect(onRun).toHaveBeenCalledOnce();
  });
});
