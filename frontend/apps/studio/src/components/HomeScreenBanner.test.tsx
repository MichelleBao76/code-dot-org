import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import HomeScreenBanner from './HomeScreenBanner';

describe('HomeScreenBanner', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({matches: false}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the Home Screen steps on iPhone', () => {
    render(<HomeScreenBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Add to Home Screen');
    expect(screen.getByRole('status')).toHaveTextContent('Open as Web App');
  });

  it('does not show on desktop', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
    render(<HomeScreenBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not show in display-mode standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({matches: true}));
    render(<HomeScreenBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not show in iOS standalone mode', () => {
    vi.stubGlobal('navigator', {userAgent: 'iPhone', standalone: true});
    render(<HomeScreenBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('can be dismissed', () => {
    render(<HomeScreenBanner />);
    fireEvent.click(
      screen.getByRole('button', {name: 'Dismiss Home Screen instructions'}),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
