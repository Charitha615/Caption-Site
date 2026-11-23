import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratingStage } from '../features/projects/GeneratingStage';

describe('GeneratingStage', () => {
  it('shows the current step, its title and progress', () => {
    render(<GeneratingStage status="transcribing" percent={62} phaseLabel="Transcribing speech" />);
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listening to the speech' })).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Caption generation progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    expect(bar).toHaveAttribute('aria-valuetext', 'Transcribing speech · 62%');
  });

  it('treats unknown statuses as queued and renders one of the loaders', () => {
    const { container } = render(<GeneratingStage status={undefined} />);
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(container.querySelector('.tetris-loader, .liquid-loader, .code-loader')).not.toBeNull();
  });

  it('updates the step when the status moves on', () => {
    const { rerender } = render(<GeneratingStage status="processing" percent={10} />);
    expect(screen.getByRole('heading', { name: 'Analysing the video' })).toBeInTheDocument();
    rerender(<GeneratingStage status="generating_captions" percent={90} />);
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Building your captions' })).toBeInTheDocument();
  });
});
