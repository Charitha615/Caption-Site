import React, { useEffect, useState } from 'react';
import { Languages, Palette, Film, Info } from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeStore } from '../../stores/themeStore';
import { useToastStore } from '../../stores/toastStore';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { RetryState } from '../../components/RetryState/RetryState';
import { toAppError } from '../../services/errors';
import type { UserSettings } from '../../types/auth';
import './SettingsPage.css';

const Section: React.FC<{ icon: React.ReactNode; title: string; description: string; children: React.ReactNode }> = ({ icon, title, description, children }) => {
  const id = `settings-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section className="settings-card" aria-labelledby={id}>
      <div className="settings-card-header">
        <h3 className="settings-card-title" id={id}>
          <span aria-hidden="true" style={{ color: 'var(--brand-primary)', display: 'inline-flex' }}>{icon}</span>
          {title}
        </h3>
        <p className="settings-card-subtitle">{description}</p>
      </div>
      {children}
    </section>
  );
};

function Choice<T extends string>({ name, label, value, options, onChange, disabled }: {
  name: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="settings-choice" disabled={disabled}>
      <legend className="form-label">{label}</legend>
      <div className="settings-choice-options">
        {options.map((o) => (
          <label key={o.value} className={`settings-option ${value === o.value ? 'settings-option-selected' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="settings-option-label">{o.label}</span>
              {o.hint && <span className="settings-option-hint">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const SettingsPage: React.FC = () => {
  useDocumentTitle('Settings');
  const brand = useBrand();
  const { settings, load, save } = useSettingsStore();
  const { theme, setTheme } = useThemeStore();
  const addToast = useToastStore((s) => s.addToast);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<keyof UserSettings | null>(null);

  const reload = () => {
    setError(null);
    return load().catch((err) => setError(toAppError(err).message));
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSaving(key);
    try {
      await save({ [key]: value } as Partial<UserSettings>);
      addToast({ type: 'success', message: 'Preference saved.', duration: 2000 });
    } catch {
      /* toast shown by the API client */
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="settings-container">
      <div>
        <h2 className="page-heading">Settings</h2>
        <p className="page-subheading">Defaults for new projects and exports, and how {brand.name} looks.</p>
      </div>

      <Section icon={<Palette size={20} />} title="Appearance" description="Saved on this device.">
        <Choice
          name="theme"
          label="Theme"
          value={theme}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          onChange={setTheme}
        />
      </Section>

      {error ? (
        <RetryState title="Could not load your preferences" message={error} onRetry={reload} />
      ) : !settings ? (
        <LoadingState label="Loading preferences…" />
      ) : (
        <>
          <Section icon={<Languages size={20} />} title="Captioning" description="Used as the starting choice when you create a project.">
            <Choice
              name="default_language"
              label="Default spoken language"
              value={settings.default_language}
              disabled={saving === 'default_language'}
              options={[
                { value: 'si', label: 'සිංහල (Sinhala)' },
                { value: 'en', label: 'English' },
                { value: 'auto', label: 'Auto / mixed', hint: 'Sinhala and English in one video' },
              ]}
              onChange={(v) => update('default_language', v)}
            />
          </Section>

          <Section icon={<Film size={20} />} title="Video export" description="Default options in the MP4 export dialog. You can still change them per export.">
            <Choice
              name="default_export_resolution"
              label="Resolution"
              value={settings.default_export_resolution}
              disabled={saving === 'default_export_resolution'}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p', hint: 'Recommended' },
                { value: '1440', label: '2K', hint: 'Needs a 1440p+ source' },
                { value: '2160', label: '4K', hint: 'Needs a 4K source' },
                { value: 'source', label: 'Same as source' },
              ]}
              onChange={(v) => update('default_export_resolution', v)}
            />
            <Choice
              name="default_export_quality"
              label="Quality"
              value={settings.default_export_quality}
              disabled={saving === 'default_export_quality'}
              options={[
                { value: 'high', label: 'High', hint: 'Larger files' },
                { value: 'standard', label: 'Standard' },
                { value: 'small', label: 'Small', hint: 'Faster, smaller' },
              ]}
              onChange={(v) => update('default_export_quality', v)}
            />
          </Section>
        </>
      )}

      <Section icon={<Info size={20} />} title="About" description={`${brand.name} · version ${brand.version}`}>
        <p className="settings-about">
          Need help? Email <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>. Press <kbd>?</kbd> anywhere to see keyboard shortcuts.
        </p>
      </Section>
    </div>
  );
};
