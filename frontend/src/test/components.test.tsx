import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog/ConfirmDialog';
import { Progress } from '../components/Progress/Progress';
import { Dropdown } from '../components/Dropdown/Dropdown';
import { validateVideoFile } from '../utils/video';

describe('ConfirmDialog', () => {
  const Harness = ({ onConfirm }: { onConfirm: () => void }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Delete</button>
        <ConfirmDialog isOpen={open} title="Delete project?" message="Gone for good." tone="danger" confirmLabel="Delete project" onConfirm={onConfirm} onCancel={() => setOpen(false)} />
      </>
    );
  };

  it('is a labelled modal dialog that focuses Cancel and closes on Escape, restoring focus', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Delete project?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps Tab focus inside the dialog and confirms', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('Progress', () => {
  it('exposes value and text to assistive technology', () => {
    render(<Progress label="Uploading clip.mp4" value={42.4} detail="42% · 3 MB/s" />);
    const bar = screen.getByRole('progressbar', { name: 'Uploading clip.mp4' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuetext', '42% · 3 MB/s');
  });
});

describe('Dropdown', () => {
  it('opens from the keyboard and runs the chosen item', async () => {
    const onClick = vi.fn();
    render(<Dropdown label="Project actions" trigger={<span>⋮</span>} items={[{ key: 'a', label: 'Open editor', onClick }, { key: 'b', label: 'Delete project' }]} />);

    const trigger = screen.getByRole('button', { name: 'Project actions' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('menuitem', { name: 'Open editor' })).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});

describe('validateVideoFile', () => {
  const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

  it('accepts supported videos within the plan limit', () => {
    expect(validateVideoFile(file('vlog.MP4', 10), 500)).toBeNull();
  });

  it('rejects other formats, empty files and oversized files', () => {
    expect(validateVideoFile(file('notes.pdf', 10), 500)).toMatch(/Unsupported format/);
    expect(validateVideoFile(file('empty.mp4', 0), 500)).toMatch(/empty/);
    expect(validateVideoFile(file('big.mp4', 2 * 1024 * 1024), 1)).toMatch(/up to 1 MB/);
  });
});
