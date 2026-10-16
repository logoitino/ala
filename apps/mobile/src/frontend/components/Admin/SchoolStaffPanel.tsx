/**
 * School branding and staff confirmers on the Schools desk (DATA-01 F4). These used to be SQL Editor
 * steps: set a crest and colours, add an athletic director or coach who confirms athletes in person,
 * and revoke a confirmer's link. A new confirmer's link is shown once (it is stored hashed) so the admin
 * can send it to the staff member's school email; the list never shows tokens.
 * @sideEffects Admin RPCs through `lib/adminControls`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { AdminBtn, AdminEmpty, AdminField, AdminFieldRow, AdminNotice, AdminPanel, AdminPills, AdminRow } from '@/components/Admin/AdminChrome';
import { useAdminAction } from '@/hooks/useAdminAction';
import { addSchoolConfirmer, fetchSchoolBranding, fetchSchoolConfirmers, revokeSchoolConfirmer, setSchoolBranding, type SchoolConfirmer } from '@/lib/adminControls';

const COLOR = /^#[0-9A-Fa-f]{6}$/;

/** @purpose Branding and confirmers for the school being edited. */
export function SchoolStaffPanel({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [confirmers, setConfirmers] = useState<SchoolConfirmer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Prefilled with the school's current branding: the RPC writes all three, so blanks would erase them.
  const [logoUrl, setLogoUrl] = useState('');
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'athletic_director' | 'coach'>('athletic_director');
  const [sport, setSport] = useState('');
  const [link, setLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setConfirmers(await fetchSchoolConfirmers(schoolId)); setLoadError(null); }
    catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'Could not read confirmers.'); }
  }, [schoolId]);
  useEffect(() => { setLink(null); void load(); }, [load]);
  useEffect(() => {
    let live = true;
    fetchSchoolBranding(schoolId)
      .then((current) => { if (!live) return; setLogoUrl(current.logoUrl); setPrimary(current.colorPrimary); setSecondary(current.colorSecondary); setBrandingLoaded(true); setBrandingError(null); })
      .catch((caught) => { if (live) setBrandingError(caught instanceof Error ? caught.message : 'Could not read the current branding.'); });
    return () => { live = false; };
  }, [schoolId]);

  const { busy, message, setMessage, run } = useAdminAction(load);

  const saveBranding = () => run('branding', async () => {
    if (logoUrl.trim() && !/^https:\/\//.test(logoUrl.trim())) throw new Error('The crest link must start with https://.');
    for (const value of [primary, secondary]) if (value.trim() && !COLOR.test(value.trim())) throw new Error('Colours look like #1D3F8F.');
    await setSchoolBranding({ schoolId, logoUrl: logoUrl.trim() || null, colorPrimary: primary.trim() || null, colorSecondary: secondary.trim() || null });
    return `Branding saved for ${schoolName}.`;
  });
  const addConfirmer = () => run('add', async () => {
    if (staffName.trim().length < 2) throw new Error('Enter the staff member\'s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter their school email.');
    if (role === 'coach' && !sport.trim()) throw new Error('A coach confirms one sport; enter it.');
    const created = await addSchoolConfirmer({ schoolId, name: staffName.trim(), email: email.trim(), role, sport: role === 'coach' ? sport.trim() : null });
    setLink(created.link);
    setStaffName(''); setEmail(''); setSport('');
    return 'Confirmer added. Send the link below to their school email now; it cannot be shown again.';
  });

  return (
    <>
      <AdminPanel title={`Branding · ${schoolName}`}>
        <AdminFieldRow>
          <AdminField label="Crest link (https)" value={logoUrl} onChangeText={setLogoUrl} placeholder="https://…/crest.png" />
          <AdminField label="Primary colour" value={primary} onChangeText={setPrimary} placeholder="#1D3F8F" />
          <AdminField label="Secondary colour" value={secondary} onChangeText={setSecondary} placeholder="#FFFFFF" />
        </AdminFieldRow>
        <Text style={{ fontSize: 12 }}>Leave the crest empty to use the monogram shield. A school mark needs the school's permission before a commercial build shows it.</Text>
        {brandingError ? <AdminNotice tone="danger" text={`${brandingError} Saving is off until the current branding is read.`} /> : null}
        <AdminBtn kind="primary" label={busy === 'branding' ? 'Saving…' : 'Save branding'} disabled={busy != null || !brandingLoaded} onPress={() => { void saveBranding(); }} />
      </AdminPanel>
      <AdminPanel title={`Staff who confirm athletes · ${schoolName}`}>
        {loadError ? <AdminNotice tone="danger" text={loadError} /> : null}
        {!loadError && confirmers.length === 0 ? <AdminEmpty text="No confirmers yet." /> : null}
        {confirmers.map((row) => (
          <AdminRow key={row.id} title={`${row.fullName} · ${row.staffRole === 'coach' ? `Coach${row.sport ? ` (${row.sport})` : ''}` : 'Athletic director'}`}
            meta={`${row.email} · ${row.active ? `active until ${row.expiresAt.slice(0, 10)}` : 'revoked'}${row.lastUsedAt ? ` · last used ${row.lastUsedAt.slice(0, 10)}` : ''}`}>
            {row.active ? <AdminBtn kind="danger" label={busy === row.id ? 'Revoking…' : 'Revoke link'} disabled={busy != null} onPress={() => { void run(row.id, async () => { await revokeSchoolConfirmer(row.id); return `${row.fullName}'s link is revoked.`; }); }} /> : null}
          </AdminRow>
        ))}
        <AdminPills label="Role" items={[{ id: 'athletic_director', label: 'Athletic director' }, { id: 'coach', label: 'Coach' }]} value={role} onChange={setRole} />
        <AdminFieldRow>
          <AdminField label="Name" value={staffName} onChangeText={setStaffName} autoCapitalize="words" />
          <AdminField label="School email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          {role === 'coach' ? <AdminField label="Sport" value={sport} onChangeText={setSport} autoCapitalize="words" /> : null}
        </AdminFieldRow>
        <AdminBtn label={busy === 'add' ? 'Adding…' : 'Add confirmer'} disabled={busy != null} onPress={() => { void addConfirmer(); }} />
        {link ? <View style={{ gap: 8 }}>
          <Text selectable style={{ fontSize: 13, fontWeight: '700' }}>{link}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <AdminBtn label="Copy link" onPress={() => { void Clipboard.setStringAsync(link).then(() => setMessage({ text: 'Link copied. Paste it into an email to their school address.', tone: 'ok' })); }} />
            <AdminBtn label="Hide link" onPress={() => setLink(null)} />
          </View>
        </View> : null}
      </AdminPanel>
      <AdminNotice text={message?.text ?? null} tone={message?.tone} />
    </>
  );
}
