import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAiKeyStore } from '../../stores/aiKeyStore';
import './AiKeyCard.css';

/**
 * Shown wherever captions get generated, when the user has no usable Google AI key.
 * Renders nothing once a key is saved (or the server provides one).
 */
export const AiKeyNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { aiKey, load } = useAiKeyStore();

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  if (!aiKey) return null;
  const invalid = aiKey.configured && aiKey.status === 'invalid';
  if (aiKey.can_caption && !invalid) return null;

  return (
    <div className={`aikey-callout ${invalid ? 'aikey-callout-error' : ''}`} role="status">
      <KeyRound size={18} aria-hidden="true" />
      <p>
        {invalid
          ? 'Google rejected your AI API key. Replace it to keep generating captions.'
          : compact
            ? 'Add your Google AI API key to generate captions.'
            : 'Captions are generated with your own Google AI (Gemini) key. Add it once in Account & usage — it takes a minute and is free to create.'}
      </p>
      <Link to="/profile#ai-key" className="btn btn-primary btn-sm">
        {invalid ? 'Fix key' : 'Add API key'}
      </Link>
    </div>
  );
};
