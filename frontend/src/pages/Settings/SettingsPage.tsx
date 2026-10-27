import React from 'react';
import { Palette, Cpu, HardDrive, CheckCircle2 } from 'lucide-react';
import { useBrand } from '../../hooks/useBrand';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Badge } from '../../components/Badge/Badge';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const brand = useBrand();
  useDocumentTitle('Settings');

  return (
    <div className="settings-container">
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>
          Workspace Settings
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Manage global application branding, AI configuration and defaults
        </p>
      </div>

      {/* Centralized Branding Section */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <Palette size={20} style={{ color: 'var(--brand-primary)' }} />
            Centralized Branding Configuration
          </h3>
          <p className="settings-card-subtitle">
            This application uses a centralized brand configuration. The product name, logos,
            and colors are defined in one place with complete Unicode/Sinhala support.
          </p>
        </div>

        <div className="brand-demo-preview">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Product Name</span>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                {brand.name}
              </h4>
            </div>
            <Badge variant="green" hasDot>
              Unicode Ready (e.g. පේළිCap)
            </Badge>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            <strong>Tagline:</strong> {brand.tagline}
            <br />
            <strong>Description:</strong> {brand.description}
          </p>

          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Brand Color Palette:</span>
            <div className="brand-color-swatches">
              <div className="color-swatch-item">
                <div className="color-swatch-circle" style={{ backgroundColor: brand.colors.primary }} />
                <span>Primary</span>
              </div>
              <div className="color-swatch-item">
                <div className="color-swatch-circle" style={{ backgroundColor: brand.colors.accent }} />
                <span>Accent</span>
              </div>
              <div className="color-swatch-item">
                <div className="color-swatch-circle" style={{ backgroundColor: brand.colors.dark }} />
                <span>Dark</span>
              </div>
              <div className="color-swatch-item">
                <div className="color-swatch-circle" style={{ backgroundColor: brand.colors.background }} />
                <span>Bg</span>
              </div>
              <div className="color-swatch-item">
                <div className="color-swatch-circle" style={{ backgroundColor: brand.colors.lightPurple }} />
                <span>Purple</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Intelligence Configuration */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <Cpu size={20} style={{ color: 'var(--brand-primary)' }} />
            AI Speech & Transcription Engine
          </h3>
          <p className="settings-card-subtitle">
            Powered by Google Gemini multimodal audio recognition with Sinhala Unicode support.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-muted)' }}>AI Provider</span>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--status-success-text)' }} /> Google Gemini / Google AI API
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Model Tier</span>
            <span>gemini-1.5-flash (Low-latency audio transcription)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sinhala Unicode Support</span>
            <span style={{ color: 'var(--status-success-text)', fontWeight: 600 }}>Enabled (Zero-Width Joiner compliant)</span>
          </div>
        </div>
      </div>

      {/* Storage & Export Engine */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <HardDrive size={20} style={{ color: 'var(--brand-primary)' }} />
            Video Rendering & Storage Pipeline
          </h3>
          <p className="settings-card-subtitle">
            Laravel filesystem abstraction with local storage for development and S3 architecture for production.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Active Disk</span>
            <span>Local Filesystem (Development)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>Video Renderer</span>
            <span>FFmpeg / FFprobe Video Processing Service</span>
          </div>
        </div>
      </div>
    </div>
  );
};
