import {useEffect, useState, useSyncExternalStore} from 'react';

import I18n from '@/oceans/i18n';
import {getSaveStatus, saveProgress, subscribeToSaves} from '@/oceans/progress';
export default function ConnectivityStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [reconnected, setReconnected] = useState(false);
  const saveStatus = useSyncExternalStore(subscribeToSaves, getSaveStatus);
  useEffect(() => {
    const offline = () => {
      setOnline(false);
      setReconnected(false);
      saveProgress();
    };
    const reconnect = () => {
      setOnline(true);
      setReconnected(true);
      saveProgress();
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', reconnect);
    };
  }, []);
  const message = !online
    ? 'offlineNotice'
    : reconnected
      ? 'reconnectedNotice'
      : null;
  const saveMessage =
    saveStatus === 'unavailable'
      ? 'progressUnavailable'
      : saveStatus === 'restored'
        ? 'progressRestored'
        : saveStatus === 'saved'
          ? 'progressSaved'
          : null;
  if (!message && !saveMessage) return null;
  return (
    <aside
      className="ocean-connectivity"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message && (
        <p lang={I18n.getMessageLocale(message)}>{I18n.t(message)}</p>
      )}
      {saveMessage && (
        <p lang={I18n.getMessageLocale(saveMessage)}>{I18n.t(saveMessage)}</p>
      )}
    </aside>
  );
}
