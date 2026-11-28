import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import { accountService } from '../../services/accountService';
import { toAppError } from '../../services/errors';
import { useToastStore } from '../../stores/toastStore';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { RetryState } from '../../components/RetryState/RetryState';
import { formatDateTime, formatTimeAgo } from '../../utils/formatters';
import type { SignedInDevice } from '../../types/auth';

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

const METHOD_LABEL: Record<NonNullable<SignedInDevice['sign_in_method']>, string> = {
  password: 'Email and password',
  google: 'Google',
  register: 'New account',
};

/**
 * Every device the user is signed in on: browser and system, IP address, how and when they
 * signed in, and when it was last used. Other devices can be signed out one by one or all at once.
 */
export const SignedInDevices: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const fetchDevices = useCallback(
    () => accountService.getSessions().then((list) => { setDevices(list); setError(null); }).catch((err) => setError(toAppError(err).message)),
    [],
  );
  const load = useCallback(() => {
    setError(null);
    return fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const signOut = async (device: SignedInDevice) => {
    setBusyId(device.id);
    try {
      await accountService.signOutDevice(device.id);
      setDevices((list) => list?.filter((d) => d.id !== device.id) ?? null);
      addToast({ type: 'success', message: `${device.browser} on ${device.os} was signed out.`, duration: 3000 });
    } catch {
      // The API client shows the error; refresh in case the device was already gone.
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async () => {
    setSigningOutAll(true);
    try {
      const count = await accountService.signOutOtherDevices();
      setDevices((list) => list?.filter((d) => d.current) ?? null);
      addToast({ type: 'success', message: count === 1 ? '1 other device was signed out.' : `${count} other devices were signed out.`, duration: 3000 });
    } catch {
      /* toast shown by the API client */
    } finally {
      setSigningOutAll(false);
      setConfirmAll(false);
    }
  };

  if (error) return <RetryState title="Could not load your devices" message={error} onRetry={load} />;
  if (!devices) return <LoadingState label="Loading devices…" />;

  const others = devices.filter((d) => !d.current).length;

  return (
    <>
      <ul className="settings-devices">
        {devices.map((device) => {
          const Icon = DEVICE_ICON[device.device];
          const name = device.known ? `${device.browser} on ${device.os}` : 'Unknown device';
          return (
            <li key={device.id} className="settings-device">
              <span className="settings-device-icon" aria-hidden="true"><Icon size={20} /></span>
              <div className="settings-device-info">
                <p className="settings-device-name">
                  {name}
                  {device.current && <span className="settings-device-current">This device</span>}
                </p>
                <p className="settings-device-meta">
                  {device.current ? 'Active now' : `Last active ${formatTimeAgo(device.last_active_at).toLowerCase()}`}
                  {device.ip_address && <> · IP {device.ip_address}</>}
                </p>
                <p className="settings-device-meta">
                  Signed in <time dateTime={device.signed_in_at}>{formatDateTime(device.signed_in_at)}</time>
                  {device.sign_in_method && <> · {METHOD_LABEL[device.sign_in_method]}</>}
                </p>
              </div>
              {!device.current && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => signOut(device)}
                  isLoading={busyId === device.id}
                  startIcon={<LogOut size={14} aria-hidden="true" />}
                  aria-label={`Sign out ${name}`}
                >
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {others > 0 && (
        <div className="settings-devices-footer">
          <p>Don't recognise a device? Sign it out, then change your password in Profile.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAll(true)}>
            Sign out all other devices
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAll}
        title="Sign out all other devices?"
        message={`You'll stay signed in here. The other ${others === 1 ? 'device' : `${others} devices`} will need to sign in again.`}
        confirmLabel="Sign out others"
        tone="danger"
        isLoading={signingOutAll}
        onConfirm={signOutOthers}
        onCancel={() => setConfirmAll(false)}
      />
    </>
  );
};
