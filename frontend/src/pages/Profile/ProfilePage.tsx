import React, { useState } from 'react';
import { Shield, Key } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Badge } from '../../components/Badge/Badge';
import { formatDate } from '../../utils/formatters';
import './ProfilePage.css';

export const ProfilePage: React.FC = () => {
  useDocumentTitle('Profile');
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      addToast({
        type: 'warning',
        title: 'Validation',
        message: 'New password must be at least 8 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast({
        type: 'error',
        title: 'Mismatch',
        message: 'New passwords do not match.',
      });
      return;
    }

    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast({
        type: 'success',
        title: 'Password Updated',
        message: 'Your account password was successfully updated.',
      });
    }, 600);
  };

  return (
    <div className="profile-container">
      {/* Profile Header */}
      <div className="profile-header-card">
        <div className="profile-avatar-large">
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="profile-details">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="profile-name">{user?.name || 'Account User'}</h2>
            <Badge variant="purple" size="sm">
              <Shield size={12} /> {user?.role ? user.role.toUpperCase() : 'USER'}
            </Badge>
          </div>
          <span className="profile-email">{user?.email || 'user@example.com'}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>
            Member since {user?.created_at ? formatDate(user.created_at) : 'October 2026'}
          </span>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>
          Security & Password
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px' }}>
          Update your account password to ensure ongoing workspace security.
        </p>

        <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUpdating}
              startIcon={<Key size={16} />}
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
