import React from 'react';
import { Palette, Info, MonitorSmartphone, BellRing } from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useThemeStore } from '../../stores/themeStore';
import { SignedInDevices } from './SignedInDevices';
import { ContactPreferences } from './ContactPreferences';
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
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="settings-container">
      <div>
        <h2 className="page-heading">Settings</h2>
        <p className="page-subheading">How {brand.name} looks, how we contact you, and where you&apos;re signed in.</p>
      </div>

      <Section icon={<Palette size={20} />} title="Appearance" description="Saved on this device.">
        <Choice
          name="theme"
          label="Theme"
          value={theme}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          onChange={setTheme}
        />
      </Section>

      <Section icon={<BellRing size={20} />} title="Notifications" description="How we may reach you with news and offers. Notices about your videos and payments always appear under 🔔.">
        <ContactPreferences />
      </Section>

      <Section icon={<MonitorSmartphone size={20} />} title="Signed-in devices" description="Where your account is signed in, with when each device was last used.">
        <SignedInDevices />
      </Section>

      <Section icon={<Info size={20} />} title="About" description={`${brand.name} · version ${brand.version}`}>
        <p className="settings-about">
          Need help? Email <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>. Press <kbd>?</kbd> anywhere to see keyboard shortcuts.
        </p>
      </Section>
    </div>
  );
};
