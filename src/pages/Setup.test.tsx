import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Setup } from './Setup';
import { buildChurch } from '../lib/topology';
import type { Church } from '../types';

const api = vi.hoisted(() => ({
  getSetupState: vi.fn(),
  getAuthStatus: vi.fn(),
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  setPins: vi.fn(),
  loginAdmin: vi.fn(),
  uploadLogo: vi.fn(),
  clearLogo: vi.fn(),
  getSecrets: vi.fn(),
  saveSecrets: vi.fn(),
  setIntegrationEnabled: vi.fn(),
  completeSetup: vi.fn(),
}));

vi.mock('../api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api')>(),
  ...api,
}));

const EMPTY: Church = { name: 'Production Dashboard', sites: [] };

const CONFIGURED: Church = {
  name: 'Grace Community',
  sites: [{
    id: 'main',
    name: 'Main Campus',
    status: 'active',
    auditoriums: [{ id: 'aud', name: 'Auditorium', tiles: [] }],
  }],
};

function freshInstall() {
  // vi.fn()s from vi.hoisted() survive restoreMocks, so calls would otherwise
  // accumulate across tests in this file.
  vi.clearAllMocks();
  api.getSetupState.mockResolvedValue({ needed: true, completedAt: null, adminPinSet: false, hasCampus: false });
  api.getAuthStatus.mockResolvedValue({
    authenticated: false, admin: false, setupNeeded: true, user: null, permissions: [], station: null,
  });
  api.getConfig.mockResolvedValue(EMPTY);
  api.setPins.mockResolvedValue(undefined);
  api.loginAdmin.mockResolvedValue(true);
  api.saveConfig.mockImplementation(async (c: Church) => c);
  api.getSecrets.mockResolvedValue({ secrets: [] });
  api.setIntegrationEnabled.mockResolvedValue({ enabled: {} });
  api.completeSetup.mockResolvedValue({ needed: false, completedAt: 1, adminPinSet: true, hasCampus: true });
}

const renderSetup = () => render(<MemoryRouter initialEntries={['/setup']}><Setup /></MemoryRouter>);

describe('first-run setup', () => {
  beforeEach(freshInstall);

  it('walks a fresh install from welcome to a usable church', async () => {
    const user = userEvent.setup();
    renderSetup();

    await user.click(await screen.findByRole('button', { name: /Begin/ }));

    // 1 · Admin PIN
    await user.type(screen.getByLabelText('Admin PIN'), 'church123');
    await user.type(screen.getByLabelText('Confirm PIN'), 'church123');
    await user.click(screen.getByRole('button', { name: /Create PIN/ }));
    await waitFor(() => expect(api.setPins).toHaveBeenCalledWith({ admin: 'church123' }));
    expect(api.loginAdmin).toHaveBeenCalledWith('church123');

    // 2 · Name
    await user.type(await screen.findByLabelText('Church name'), 'Grace Community');
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    // 3 · Campus and rooms — prefilled with something sensible
    expect(await screen.findByLabelText('Campus name')).toHaveValue('Main Campus');
    await user.click(screen.getByRole('button', { name: /Save and continue/ }));

    await waitFor(() => expect(api.saveConfig).toHaveBeenCalled());
    const saved = api.saveConfig.mock.calls[0][0] as Church;
    expect(saved.name).toBe('Grace Community');
    expect(saved.sites).toHaveLength(1);
    expect(saved.sites[0].auditoriums.map((a) => a.name)).toEqual(['Auditorium']);

    // 4 · Integrations are optional from the first selection screen.
    const skip = await screen.findByRole('button', { name: /Skip for now/ });
    await waitFor(() => expect(skip).toBeEnabled());
    await user.click(skip);

    // Done
    await user.click(await screen.findByRole('button', { name: /Go to the dashboard/ }));
    await waitFor(() => expect(api.completeSetup).toHaveBeenCalled());
  });

  it('will not save a campus with no rooms', async () => {
    const user = userEvent.setup();
    renderSetup();
    await user.click(await screen.findByRole('button', { name: /Begin/ }));
    await user.type(screen.getByLabelText('Admin PIN'), 'church123');
    await user.type(screen.getByLabelText('Confirm PIN'), 'church123');
    await user.click(screen.getByRole('button', { name: /Create PIN/ }));
    await user.type(await screen.findByLabelText('Church name'), 'Grace Community');
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    await user.clear(await screen.findByLabelText('Campus name'));
    expect(screen.getByRole('button', { name: /Save and continue/ })).toBeDisabled();
    expect(api.saveConfig).not.toHaveBeenCalled();
  });

  it('resumes where it stopped rather than starting over', async () => {
    // Closed the tab after saving the campus: the PIN and the church exist, so
    // reopening must not ask for them again.
    api.getSetupState.mockResolvedValue({ needed: true, completedAt: null, adminPinSet: true, hasCampus: true });
    api.getAuthStatus.mockResolvedValue({
      authenticated: true, admin: true, setupNeeded: false, user: null, permissions: ['*'], station: null,
    });
    api.getConfig.mockResolvedValue(CONFIGURED);

    renderSetup();

    expect(await screen.findByText('Choose your integrations')).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
  });

  it('asks for the PIN again when the browser is not signed in', async () => {
    api.getSetupState.mockResolvedValue({ needed: true, completedAt: null, adminPinSet: true, hasCampus: false });

    renderSetup();

    expect(await screen.findByText('Enter your admin PIN')).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm PIN')).not.toBeInTheDocument();
  });

  it('refuses a mistyped PIN confirmation without calling the server', async () => {
    const user = userEvent.setup();
    renderSetup();
    await user.click(await screen.findByRole('button', { name: /Begin/ }));
    await user.type(screen.getByLabelText('Admin PIN'), 'church123');
    await user.type(screen.getByLabelText('Confirm PIN'), 'church124');
    await user.click(screen.getByRole('button', { name: /Create PIN/ }));

    expect(await screen.findByText('Those PINs do not match.')).toBeInTheDocument();
    expect(api.setPins).not.toHaveBeenCalled();
  });
});

describe('buildChurch', () => {
  it('gives every new room a Room Status tile', () => {
    // A room with no tiles is an empty card on Home — the first thing the
    // church sees after setup should open onto something.
    const built = buildChurch(EMPTY, 'Grace Community', 'Main Campus', ['Auditorium', 'Kids Room']);
    const [aud, kids] = built.sites[0].auditoriums;
    expect(aud.id).toBe('auditorium');
    expect(aud.tiles).toEqual([
      { id: 'auditorium-status', type: 'route', label: 'Room Status', to: '/room/auditorium' },
    ]);
    expect(kids.tiles[0]).toMatchObject({ to: '/room/kids-room' });
  });

  it('keeps existing ids so a resumed wizard orphans nothing', () => {
    // Stations, schedules and booth bookmarks point at room ids. Renaming a
    // room in the wizard must not silently mint a new one.
    const renamed = buildChurch(CONFIGURED, 'Grace Community', 'north', ['Main Auditorium']);
    expect(renamed.sites[0].id).toBe('main');
    expect(renamed.sites[0].name).toBe('north');
    expect(renamed.sites[0].auditoriums[0].id).toBe('aud');
    expect(renamed.sites[0].auditoriums[0].name).toBe('Main Auditorium');
  });

  it('never collides ids when rooms share a name', () => {
    const built = buildChurch(EMPTY, 'Grace', 'Main', ['Chapel', 'Chapel']);
    const [a, b] = built.sites[0].auditoriums;
    expect(a.id).not.toBe(b.id);
    expect(b.tiles[0].id).not.toBe(a.tiles[0].id);
  });
});
