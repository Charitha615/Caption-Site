import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const upload = vi.hoisted(() => ({ language: '', start: vi.fn() }));
vi.mock('../services/uploadService', async (orig) => {
  const actual = await orig<typeof import('../services/uploadService')>();
  return {
    ...actual,
    ChunkedUpload: class {
      constructor(_uuid: string, _file: File, language: string) {
        upload.language = language;
      }
      start = upload.start;
      abortLocally() {}
    },
  };
});

import { CreateProjectPage } from '../pages/CreateProject/CreateProjectPage';
import { useProjectStore } from '../stores/projectStore';
import { useAiKeyStore } from '../stores/aiKeyStore';
import { scriptFromInput } from '../features/editor/utils/importCaptions';

describe('Create a project', () => {
  beforeEach(() => {
    upload.start.mockReset().mockReturnValue(new Promise(() => {}));
    useAiKeyStore.setState({ aiKey: { configured: true, hint: 'abcd', status: 'valid', checked_at: null, required: true, can_caption: true, help_url: '' } });
  });

  it('detects the language automatically and sends the user’s script', async () => {
    const createProject = vi.fn().mockResolvedValue({ uuid: 'p1', name: 'Clip' });
    useProjectStore.setState({ createProject } as never);
    const { container } = render(<MemoryRouter><CreateProjectPage /></MemoryRouter>);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText(/spoken language is detected automatically/i)).toBeInTheDocument();

    const file = new File([new Uint8Array(2048)], 'clip.mp4', { type: 'video/mp4' });
    await userEvent.upload(container.querySelector('#video-file-input') as HTMLInputElement, file);
    await userEvent.type(screen.getByLabelText(/your script or captions/i), 'මේ තමයි Toyota Aqua.');
    await userEvent.click(screen.getByRole('button', { name: /upload & generate captions/i }));

    expect(createProject).toHaveBeenCalledWith({ name: 'clip', script: 'මේ තමයි Toyota Aqua.', language: 'auto' });
    expect(upload.language).toBe('auto');
  });

  it('turns an uploaded SRT into plain script lines', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nආයුබෝවන්\n\n2\n00:00:03,000 --> 00:00:04,000\nToyota Aqua\n';
    expect(scriptFromInput(srt)).toBe('ආයුබෝවන්\nToyota Aqua');
    expect(scriptFromInput('just text')).toBe('just text');
  });
});
