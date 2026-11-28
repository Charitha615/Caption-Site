import React, { useEffect, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';
import { campaignUrl, marketingLinkService, toTag, type MarketingLink, type MarketingLinkInput } from '../../services/adminSignupService';
import { toAppError } from '../../services/errors';
import { Button } from '../../components/Button/Button';
import { Modal } from '../../components/Modal/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { SITE_URL } from '../../seo/site';
import { formatDate, formatTimeAgo } from '../../utils/formatters';

const SOURCES = ['facebook', 'tiktok', 'youtube', 'instagram', 'whatsapp', 'google'];
const MEDIUMS = ['post', 'ad', 'story', 'reel', 'video', 'bio', 'group', 'creator'];
const PAGES = [
  { path: '/', label: 'Home (English)' },
  { path: '/si', label: 'Home (සිංහල)' },
  { path: '/register', label: 'Sign-up page' },
];

const EMPTY: MarketingLinkInput = { name: '', source: 'facebook', medium: 'post', campaign: '', path: '/', notes: '' };

/** The live site the admin is on (e.g. sinsub.cc); the configured site URL when running locally. */
const siteOrigin = () =>
  typeof window !== 'undefined' && !/^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname) ? window.location.origin : SITE_URL;

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Admin: make a tagged link for each post, ad or creator, write down what it was for, and see its sign-ups. */
export const CampaignLinks: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const addToast = useToastStore((s) => s.addToast);
  const [links, setLinks] = useState<MarketingLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MarketingLink | 'new' | null>(null);
  const [form, setForm] = useState<MarketingLinkInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<MarketingLink | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    marketingLinkService.list()
      .then((list) => active && (setLinks(list), setError(null)))
      .catch((err) => active && setError(toAppError(err, 'Could not load campaign links.').message));
    return () => { active = false; };
  }, [reload]);

  const origin = siteOrigin();
  const preview = campaignUrl(origin, form);
  const set = (patch: Partial<MarketingLinkInput>) => setForm((f) => ({ ...f, ...patch }));

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ type: 'success', message: 'Link copied.', duration: 1800 });
    } catch {
      /* clipboard blocked: the link is still on screen */
    }
  };

  const openNew = () => {
    setForm(EMPTY);
    setFormError(null);
    setEditing('new');
  };

  const openEdit = (link: MarketingLink) => {
    setForm({ name: link.name, source: link.source, medium: link.medium ?? '', campaign: link.campaign ?? '', path: link.path, notes: link.notes ?? '' });
    setFormError(null);
    setEditing(link);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const input = { ...form, medium: form.medium || null, campaign: form.campaign || null, notes: form.notes || null };
      const saved = editing === 'new' ? await marketingLinkService.create(input) : await marketingLinkService.update((editing as MarketingLink).uuid, input);
      if (editing === 'new') void copy(campaignUrl(origin, saved));
      addToast({ type: 'success', message: editing === 'new' ? 'Campaign link saved and copied.' : 'Campaign link updated.' });
      setEditing(null);
      setReload((n) => n + 1);
      onChanged?.();
    } catch (err) {
      const e = toAppError(err);
      setFormError(Object.values(e.fieldErrors)[0]?.[0] ?? e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await marketingLinkService.remove(deleting.uuid);
      setDeleting(null);
      setReload((n) => n + 1);
      onChanged?.();
    } catch {
      /* toast shown by the API client */
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-campaigns" aria-labelledby="campaigns-title">
      <div className="admin-campaigns-head">
        <div>
          <h3 id="campaigns-title" className="admin-user-h">Campaign links</h3>
          <p className="admin-review-role">Make one link per post, ad or creator, and write down what it was for. Sign-ups through it are counted here.</p>
        </div>
        <Button size="sm" startIcon={<Plus size={15} aria-hidden="true" />} onClick={openNew}>New link</Button>
      </div>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {links?.length === 0 && <p className="admin-empty">No campaign links yet. Make one for your next post.</p>}

      <ul className="admin-review-list">
        {links?.map((link) => {
          const url = campaignUrl(origin, link);
          return (
            <li key={link.uuid} className="admin-review admin-campaign">
              <div className="admin-campaign-top">
                <div className="admin-user-main">
                  <p className="admin-review-name">{link.name}</p>
                  <p className="admin-review-role">
                    {[link.source, link.medium, link.campaign].filter(Boolean).join(' · ')}
                    {link.created_at && <> · made {formatDate(link.created_at)}</>}
                  </p>
                </div>
                <div className="admin-campaign-stats">
                  <span><strong>{link.signups}</strong> sign-ups</span>
                  <span><strong>{link.paid}</strong> went Pro <span className="admin-muted">({percent(link.paid, link.signups)})</span></span>
                  {link.last_signup_at && <span className="admin-muted">last {formatTimeAgo(link.last_signup_at)}</span>}
                </div>
              </div>
              {link.notes && <p className="admin-campaign-notes">{link.notes}</p>}
              <div className="admin-campaign-url">
                <code>{url}</code>
                <Button size="sm" variant="outline" startIcon={<Copy size={14} aria-hidden="true" />} onClick={() => void copy(url)} aria-label={`Copy link for ${link.name}`}>Copy</Button>
                <Button size="sm" variant="ghost" startIcon={<Pencil size={14} aria-hidden="true" />} onClick={() => openEdit(link)} aria-label={`Edit ${link.name}`}>Edit</Button>
                <Button size="sm" variant="ghost" startIcon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setDeleting(link)} aria-label={`Delete ${link.name}`}>Delete</Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New campaign link' : 'Edit campaign link'} size="md" dismissible={!saving}>
        <form className="admin-campaign-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="input-label">
            Name
            <input className="input-field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. FB post: text captions demo" maxLength={120} required />
          </label>
          <div className="admin-campaign-grid">
            <label className="input-label">
              Source (platform)
              <input className="input-field" list="campaign-sources" value={form.source} onChange={(e) => set({ source: e.target.value })} required maxLength={100} />
            </label>
            <label className="input-label">
              Medium (type)
              <input className="input-field" list="campaign-mediums" value={form.medium ?? ''} onChange={(e) => set({ medium: e.target.value })} maxLength={100} />
            </label>
            <label className="input-label">
              Campaign
              <input className="input-field" value={form.campaign ?? ''} onChange={(e) => set({ campaign: e.target.value })} placeholder="e.g. text-captions" maxLength={100} />
            </label>
            <label className="input-label">
              Opens
              <select className="input-field" value={form.path} onChange={(e) => set({ path: e.target.value })}>
                {PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <datalist id="campaign-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
          <datalist id="campaign-mediums">{MEDIUMS.map((m) => <option key={m} value={m} />)}</datalist>
          <label className="input-label">
            Notes about this marketing
            <textarea
              className="input-field"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="e.g. Boosted LKR 1,000 for 3 days · posted 28 Nov · 15-second demo video"
              maxLength={2000}
            />
          </label>
          <div className="admin-campaign-preview">
            <span className="admin-review-role">Link to share</span>
            <code>{toTag(form.source) ? preview : 'Add a source to see the link'}</code>
          </div>
          {formError && <div className="form-alert" role="alert">{formError}</div>}
          <div className="admin-review-actions">
            <Button type="submit" isLoading={saving} disabled={!form.name.trim() || !toTag(form.source)}>{editing === 'new' ? 'Save and copy link' : 'Save'}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
          </div>
          {editing !== 'new' && editing && (toTag(form.source) !== editing.source || toTag(form.medium) !== (editing.medium ?? '') || toTag(form.campaign) !== (editing.campaign ?? '')) && (
            <p className="admin-review-role">Changing the tags changes the link. Posts that already use the old link will no longer be counted here.</p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this campaign link?"
        message={`“${deleting?.name}” will be removed from this list. People who signed up through it keep their source in the report.`}
        confirmLabel="Delete link"
        tone="danger"
        isLoading={saving}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
};
