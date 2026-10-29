import {useState} from 'react';

import Alert from '@code-dot-org/component-library/alert';

export default function HomeScreenBanner() {
  const [dismissed, setDismissed] = useState(false);
  const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    (navigator as Navigator & {standalone?: boolean}).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;

  if (!isIPhone || isStandalone || dismissed) {
    return null;
  }

  return (
    <Alert
      type="info"
      isImmediateImportance={false}
      closeLabel="Dismiss Home Screen instructions"
      onClose={() => setDismissed(true)}
      showIcon={false}
      style={{color: '#172b4d', flexShrink: 0, alignItems: 'flex-start'}}
      text={
        <span style={{display: 'block'}}>
          <strong style={{display: 'block', marginBottom: 10}}>
            Play without the browser bars
          </strong>
          <span
            role="list"
            aria-label="Add this game to your iPhone Home Screen"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(0, 1fr) auto minmax(0, 1.6fr) auto minmax(0, 1fr)',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: 520,
              gap: 8,
            }}
          >
            <span
              role="listitem"
              style={{display: 'grid', justifyItems: 'center', gap: 6}}
            >
              <svg
                aria-hidden="true"
                width="56"
                height="48"
                viewBox="0 0 56 48"
                fill="none"
                stroke="#007aff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 22H10v22h36V22h-7M28 32V4M19 13l9-9 9 9" />
              </svg>
              <span>
                <strong>1.</strong> Tap Share
              </span>
            </span>
            <span aria-hidden="true" style={{fontSize: 24}}>
              →
            </span>
            <span
              role="listitem"
              style={{display: 'grid', justifyItems: 'center', gap: 6}}
            >
              <svg
                aria-hidden="true"
                width="96"
                height="48"
                viewBox="0 0 120 48"
              >
                <rect
                  x="1"
                  y="3"
                  width="118"
                  height="42"
                  rx="9"
                  fill="white"
                  stroke="#c5ced8"
                />
                <rect
                  x="13"
                  y="14"
                  width="20"
                  height="20"
                  rx="4"
                  fill="none"
                  stroke="#172b4d"
                  strokeWidth="2"
                />
                <path d="M18 24h10m-5-5v10" stroke="#172b4d" strokeWidth="2" />
                <path
                  d="M45 20h60M45 28h40"
                  stroke="#a3afbf"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                <strong>2.</strong> Add to Home Screen
              </span>
            </span>
            <span aria-hidden="true" style={{fontSize: 24}}>
              →
            </span>
            <span
              role="listitem"
              style={{display: 'grid', justifyItems: 'center', gap: 6}}
            >
              <svg
                aria-hidden="true"
                width="70"
                height="48"
                viewBox="0 0 70 48"
              >
                <rect
                  x="1"
                  y="5"
                  width="68"
                  height="38"
                  rx="19"
                  fill="#007aff"
                />
                <text
                  x="35"
                  y="30"
                  textAnchor="middle"
                  fill="white"
                  fontSize="17"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  Add
                </text>
              </svg>
              <span>
                <strong>3.</strong> Tap Add
              </span>
            </span>
            <span
              aria-hidden="true"
              style={{gridColumn: '1 / -1', fontSize: 24}}
            >
              ↓
            </span>
            <span
              role="listitem"
              style={{
                display: 'grid',
                gridColumn: '1 / -1',
                justifyItems: 'center',
                gap: 6,
              }}
            >
              <svg
                aria-hidden="true"
                width="48"
                height="48"
                viewBox="0 0 48 48"
              >
                <rect
                  x="2"
                  y="2"
                  width="44"
                  height="44"
                  rx="10"
                  fill="#007aff"
                />
                <path d="M19 13l16 11-16 11z" fill="white" />
              </svg>
              <span>
                <strong>4.</strong> Play from the app!
              </span>
            </span>
          </span>
          <span style={{display: 'block', marginTop: 12}}>
            In Safari, follow these steps. Keep “Open as Web App” on if shown.
            Then open the new Home Screen icon to play.
          </span>
        </span>
      }
    />
  );
}
