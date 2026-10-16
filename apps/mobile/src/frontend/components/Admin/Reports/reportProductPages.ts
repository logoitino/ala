/** Product oversight preserves the Next portal's published features, profile, sign-in and people
 * details while pointing edits to existing Expo desks. Unknown flags are not silently shown as On. */
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';
import type { AdminReportData } from '@/lib/adminReports';
import type { AdminReportPage, ReportSection, ReportKpi } from './reportPages';
import { utcStamp } from '@tapuai/shared-types/admin';

const showFlag = (value: boolean | null | undefined, on = 'On', off = 'Off') => value == null ? '—' : value ? on : off;
function flag(d: AdminReportData, path: string): boolean | null {
  if (!d.runtime.configured || d.runtime.error) return null;
  const value = path.split('.').reduce<unknown>((bag, key) => bag && typeof bag === 'object' ? (bag as Record<string, unknown>)[key] : null, d.runtime.published);
  return typeof value === 'boolean' ? value : null;
}
function flagGroups(d: AdminReportData, onlyProfile = false): ReportSection[] {
  return APP_RUNTIME_FLAG_GROUPS.filter(group => !onlyProfile || group.id === 'profile').map(group => ({ id: `flags-${group.id}`, title: group.label, sentences: [group.hint],
    tables: [{ title: `${group.label} flags`, table: { columns: ['Published control', 'Status', 'Meaning'], rows: group.flags.map(row => [row.label, showFlag(flag(d, row.path)), row.hint]) }, source: `app_runtime_config.published.${group.id}`, initiallyOpen: true }] }));
}
/** @purpose Complete Product and sub-desk readouts from nullable oversight snapshots. */
export function reportProductSections(page: AdminReportPage, d: AdminReportData): ReportSection[] {
  if (page === 'product') return [{ id: 'menus', title: 'Menus on', hint: d.runtime.publishedAt ? `Published ${utcStamp(d.runtime.publishedAt) ?? 'time unavailable'}` : 'Published switches', sentences: d.runtime.dirty ? ['Draft changes are not published yet. These meters show the published switches.'] : !d.runtime.configured ? ['The published switches were not read, so on and off are not shown.'] : [], charts: APP_RUNTIME_FLAG_GROUPS.map(group => {
    const values = group.flags.map(row => flag(d, row.path)); const measured = values.every(value => value != null);
    return { id: group.id, title: group.label, kind: 'split' as const, caption: group.hint, source: `app_runtime_config.published.${group.id}`, keys: [group.id], error: d.runtime.error,
      format: 'count' as const, accent: 'jade' as const, totalLabel: 'Controls', parts: [{ key: 'on', label: 'On', value: measured ? values.filter(Boolean).length : null, color: 'jade' as const }, { key: 'off', label: 'Off', value: measured ? values.filter(value => value === false).length : null, color: 'muted' as const }] };
  }) }, { id: 'manage', title: 'Manage the product', links: [{ label: 'App setup', href: '/admin/features' }, { label: 'Control map', href: '/admin/product/coverage' }] }];
  if (page === 'features') return [{ id: 'published', title: 'Published features', sentences: ["Live menus fans currently see. A draft waiting on Publish does not change this list.", d.runtime.dirty ? 'A draft is waiting on Publish to app.' : 'Edit the existing Features or Look desk, then publish when ready.'], links: [{ label: 'Open Features desk', href: '/admin/features' }, { label: 'Open Look desk', href: '/admin/look' }] }, ...flagGroups(d)];
  if (page === 'profile') {
    const p = d.profile; const known = p.configured;
    const row = (label: string, value: number | null | boolean, hint: string): ReportKpi => ({ label, value: !known || value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : showFlag(value), missing: !known || value == null, hint });
    return [{ id: 'profile-summary', title: 'Profile overview', hint: p.publishedAt ? `Published ${utcStamp(p.publishedAt) ?? 'time unavailable'}` : 'Published profile settings', kpis: [row('Claimed athletes', p.claimedAthletes, 'Linked athlete roster rows'), row('Athlete profiles', p.athleteProfiles, 'Role, roles or active role includes athlete')] },
      { id: 'hierarchy', title: 'Profile presentation', sentences: ["Your profile and public athlete profiles share the same presentation. Owner-only tools stay on your claimed row. Published settings and their meanings appear below; make changes in Look, then Publish."], links: [{ label: 'Open Look desk', href: '/admin/look' }] }, ...flagGroups(d, true)];
  }
  if (page === 'sign-in') {
    const a = d.softWall; const valid = a.configured;
    return [{ id: 'soft-wall', title: 'Account gates', kpis: [['Donate Soft Wall', a.maloLive], ['Crew Soft Wall', a.crewLive], ['Gear goal Soft Wall', a.wishlistLive]].map(([label, value]) => ({ label: label as string, value: showFlag(valid ? value as boolean | null : null, 'Armed', 'Paused'), missing: !valid || value == null })) },
      { id: 'resume', title: 'Zero lost context', sentences: ['After sign-in, the account sheet replays the saved action: open Donate, join Crew or donate to a gear goal. Sign-in does not discard the action the guest chose.'], links: [{ label: 'Open Features desk', href: '/admin/features' }, { label: 'Open Coverage desk', href: '/admin/product/coverage' }] },
      ...a.softWallGates.map(gate => ({ id: gate.id, title: gate.label, sentences: [gate.hint], tables: [{ title: `${gate.label} configuration`, source: gate.telemetry, initiallyOpen: true, table: { columns: ['Field', 'Value'], rows: [['Fan surface', gate.fanSurface], ['Expo desk', gate.adminDesk], ['Flag', gate.flagPath ?? 'Code gate'], ['Telemetry', gate.telemetry]] } }] })),
      { id: 'providers', title: 'Providers', tables: [{ title: 'Sign-in providers', source: 'Configured provider directory', initiallyOpen: true, table: { columns: ['Provider', 'ID', 'Redirect'], rows: a.authProviders.map(provider => [provider.label, provider.id, provider.redirect]) } }], sentences: [`Last Publish to app: ${a.publishedAt ?? 'Never / unknown'}. Provider availability must also be configured on the hosted project.`] },
    ];
  }
  if (page === 'people') {
    const roster = d.people; const valid = roster.configured && !roster.error;
    const fans = roster.people.filter(person => person.role === 'fan' && !person.is_admin);
    const a = d.softWall; const known = a.configured;
    return [{ id: 'people-summary', title: 'Profiles and fans', kpis: [{ label: 'Profiles loaded', value: valid ? `${roster.people.length}` : '—', missing: !valid, hint: 'Newest signups first' }, { label: 'Fan profiles (all)', value: known && a.fanProfiles != null ? `${a.fanProfiles}` : '—', missing: !known || a.fanProfiles == null }, { label: 'Fans · 7 days', value: known && a.fansLast7d != null ? `${a.fansLast7d}` : '—', missing: !known || a.fansLast7d == null }] },
      { id: 'fans', title: 'Recent Soft-Wall fans', links: [{ label: 'Open People desk', href: '/admin/people' }],
        sentences: ['Guests receive a profile row when they sign in. Verification and admin access are managed on the existing People desk.', `Showing ${valid ? roster.people.length : '—'} newest · ${valid ? fans.length : '—'} look like Soft-Wall fans in this page.`, ...(valid && !roster.people.length ? ['No profiles yet. Soft-Wall Apple / Google / Magic Link creates the first fan row after sign-in.'] : [])],
        tables: [{ title: 'Recent Soft-Wall fans', source: 'profiles: newest signups', initiallyOpen: true, table: { columns: ['Name', 'Handle', 'Role', 'Verification', 'Claimed roster', 'Admin', 'Created (UTC)'], rows: valid ? roster.people.map(person => [person.full_name, person.username ? `@${person.username}` : '—', person.role, person.is_verified || person.verification_status === 'verified' ? '⚡ Varsity' : person.verification_status === 'pending' ? 'Varsity pending' : 'Unverified', person.player_id ? 'Claimed roster' : '—', person.is_admin ? 'Admin' : 'No', person.created_at ? utcStamp(person.created_at) ?? 'Not in this read' : 'Not in this read']) : [] } }] },
    ];
  }
  return [];
}
