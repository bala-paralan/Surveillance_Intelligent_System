import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import type { AuthenticatedUser } from '../pages/LoginPage';

// Display-name fixture chosen so the historical test assertions that query
// for /M\. Rivera/i continue to pass without behavioural changes.
const RIVERA_USER: AuthenticatedUser = {
  id:          'u_test',
  email:       'm.rivera@sentry.gov',
  role:        'OPERATOR',
  displayName: 'M. Rivera',
};

const renderTopBar = (overrides?: Partial<Parameters<typeof TopBar>[0]>) => {
  const onTheme = vi.fn();
  const onLogout = vi.fn();
  render(
    <TopBar
      crumbs={['Operations', 'Dashboard']}
      theme="light"
      onTheme={onTheme}
      onLogout={onLogout}
      user={RIVERA_USER}
      {...overrides}
    />,
  );
  return { onTheme, onLogout };
};

describe('TopBar user menu', () => {
  it('hides the menu by default', () => {
    renderTopBar();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the menu when the user chip is clicked', async () => {
    const user = userEvent.setup();
    renderTopBar();

    const chip = screen.getByRole('button', { name: /M\. Rivera/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    await user.click(chip);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('menuitem', { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it('closes the menu when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /M\. Rivera/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: /M\. Rivera/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Click on the breadcrumb area, which lives in the TopBar but outside the menu wrapper.
    await user.click(screen.getByText('Dashboard'));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onLogout and closes the menu when Sign out is clicked', async () => {
    const user = userEvent.setup();
    const { onLogout } = renderTopBar();

    await user.click(screen.getByRole('button', { name: /M\. Rivera/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('invokes onTheme when the theme toggle is clicked, independently of the menu', async () => {
    const user = userEvent.setup();
    const { onTheme } = renderTopBar();

    await user.click(screen.getByTitle('Toggle theme'));

    expect(onTheme).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
