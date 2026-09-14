import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminMetrics,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import { useRoster } from '@/hooks/useRoster';
import {
  centsFromDollarsInput,
  fetchAdminDisbursements,
  fetchAdminTips,
  queueDisbursement,
  setDisbursementStatus,
} from '@/lib/adminCatalog';
import {
  EMPTY_COMPANY_REVENUE,
  fetchCompanyRevenueLogs,
  fetchCompanyRevenueSummary,
  revenueSourceTitle,
  type CompanyRevenueSummary,
} from '@/lib/finance';
import { formatTipDollars } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';
import type { Disbursement, TipLedgerEntry } from '@/types/database';

const QUICK = [
  { id: '25', label: '$25', cents: 2500 },
  { id: '50', label: '$50', cents: 5000 },
  { id: '100', label: '$100', cents: 10000 },
  { id: '250', label: '$250', cents: 25000 },
];

/**
 * @purpose Financial control plane: gross volume, company net, athlete/operator payouts, stream splits, Mālo ledger, and disbursements.
 * @sideEffects `get_company_revenue_summary`; `company_revenue_logs` SELECT; `tips` SELECT; `disbursements` INSERT / UPDATE.
 */
export function MoneyTool() {
  const router = useRouter();
  const { players } = useRoster();
  const [summary, setSummary] = useState<CompanyRevenueSummary>(EMPTY_COMPANY_REVENUE);
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<Disbursement[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [amount, setAmount] = useState('50.00');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, nextLogs, nextTips, nextPayouts] = await Promise.all([
        fetchCompanyRevenueSummary(),
        fetchCompanyRevenueLogs(),
        fetchAdminTips(),
        fetchAdminDisbursements(),
      ]);
      setSummary({
        ...nextSummary,
        recent: nextLogs.length > 0 ? nextLogs : nextSummary.recent,
      });
      setTips(nextTips);
      setPayouts(nextPayouts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load money.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const athleteOptions = useMemo(
    () => players.map((row) => ({ id: row.id, title: row.name, meta: row.school_name })),
    [players],
  );
  const selected = players.find((row) => row.id === playerId);
  const nameFor = (id: string | null) => players.find((row) => row.id === id)?.name || 'Athlete';
  const maloTotal = tips.reduce((sum, row) => sum + row.amount_cents, 0);

  const metrics = [
    {
      id: 'gross',
      label: 'Gross Platform Volume',
      value: formatTipDollars(summary.gross_volume_cents),
      hint: 'All Mālo, boosters, Vault, and Drip that hit Stripe.',
    },
    {
      id: 'net',
      label: 'Company Net Revenue',
      value: formatTipDollars(summary.company_net_cents),
      hint: 'Platform cut kept by Tapua\'i.',
    },
    {
      id: 'payouts',
      label: 'Athlete & Operator Payouts',
      value: formatTipDollars(summary.payouts_cents),
      hint:
        summary.stripe_paid_cents > 0
          ? `Allocated share. Stripe marked paid: ${formatTipDollars(summary.stripe_paid_cents)}.`
          : 'Allocated athlete / operator share. Mark disbursements paid to record Stripe out.',
    },
  ];

  const queue = async () => {
    setMessage(null);
    try {
      await queueDisbursement(playerId, centsFromDollarsInput(amount));
      setMessage(`Queued ${amount.startsWith('$') ? amount : `$${amount}`} for ${selected?.name ?? 'athlete'}.`);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not queue this payout.');
    }
  };

  return (
    <AdminPage
      title="Money"
      lede="Gross in, company cut, athlete and operator share out. Preset Mālo and exclusive prices live on Catalogs."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminMetrics items={metrics} />
      <AdminBtn label="Edit Mālo + exclusive prices" onPress={() => router.push('/admin/catalog' as Href)} />

      <AdminPanel title="Revenue streams">
        <View style={styles.table} accessibilityRole="summary">
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colStream]}>Source</Text>
            <Text style={[styles.th, styles.colAmt]}>Gross</Text>
            <Text style={[styles.th, styles.colAmt]}>Company</Text>
            <Text style={[styles.th, styles.colAmt]}>Payout</Text>
          </View>
          {summary.streams.map((row) => (
            <View key={row.source} style={styles.trow}>
              <View style={styles.colStream}>
                <Text style={styles.streamTitle}>{row.label}</Text>
                <Text style={styles.streamSplit}>{row.split}</Text>
              </View>
              <Text style={[styles.td, styles.colAmt]}>{formatTipDollars(row.gross_cents)}</Text>
              <Text style={[styles.td, styles.colAmt, styles.tdJade]}>{formatTipDollars(row.platform_cents)}</Text>
              <Text style={[styles.td, styles.colAmt]}>{formatTipDollars(row.payout_cents)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.caveat}>
          Admin model. Fan Mālo copy still says 100% to custodial until counsel updates MALO_DISCLAIMER.
        </Text>
      </AdminPanel>

      <AdminPanel title={`Recent transactions · ${summary.recent.length}`}>
        {summary.recent.length === 0 ? (
          <AdminEmpty text="No company revenue logs yet. Paid Mālo, boosters, Vault, and Drip land here." />
        ) : (
          summary.recent.map((row) => (
            <AdminRow
              key={row.id}
              title={row.label || revenueSourceTitle(String(row.source))}
              meta={`${revenueSourceTitle(String(row.source))} · ${formatTipDollars(row.gross_cents)} gross · ${formatTipDollars(row.platform_cents)} company · ${formatTipDollars(row.payout_cents)} payout · ${row.created_at.slice(0, 16).replace('T', ' ')}`}
            />
          ))
        )}
      </AdminPanel>

      <AdminPanel title="Queue disbursement">
        <AdminSuggest
          label="Athlete"
          value={selected?.name ?? playerQuery}
          onChangeText={(value) => {
            setPlayerQuery(value);
            setPlayerId('');
          }}
          options={athleteOptions}
          placeholder="Search roster"
          onPick={(option) => {
            setPlayerId(option.id);
            setPlayerQuery(option.title);
          }}
        />
        <AdminField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="50.00" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK.map((item) => (
            <AdminBtn
              key={item.id}
              label={item.label}
              kind={centsFromDollarsInput(amount) === item.cents ? 'primary' : 'ghost'}
              onPress={() => setAmount((item.cents / 100).toFixed(2))}
            />
          ))}
        </View>
        <AdminBtn label="Queue payout" kind="primary" onPress={() => void queue()} />
        <AdminNotice text={message} />
      </AdminPanel>
      <AdminPanel title={`Disbursements · ${payouts.length}`}>
        {payouts.length === 0 ? (
          <AdminEmpty text="No disbursements yet." />
        ) : (
          payouts.map((row) => (
            <AdminRow
              key={row.id}
              title={nameFor(row.player_id)}
              meta={`${formatTipDollars(row.amount_cents)} · ${row.status} · ${row.created_at?.slice(0, 10) ?? ''}`}
            >
              {row.status === 'queued' ? (
                <>
                  <AdminBtn label="Mark paid" kind="primary" onPress={() => void setDisbursementStatus(row.id, 'paid').then(refresh)} />
                  <AdminBtn label="Failed" kind="danger" onPress={() => void setDisbursementStatus(row.id, 'failed').then(refresh)} />
                </>
              ) : null}
            </AdminRow>
          ))
        )}
      </AdminPanel>
      <AdminPanel title={`Recent Mālo · ${formatTipDollars(maloTotal)}`}>
        {tips.length === 0 ? (
          <AdminEmpty text="No Mālo yet." />
        ) : (
          tips.map((row) => (
            <AdminRow
              key={row.id}
              title={nameFor(row.player_id)}
              meta={`${formatTipDollars(row.amount_cents)} · ${row.created_at.slice(0, 16).replace('T', ' ')}`}
            />
          ))
        )}
      </AdminPanel>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  table: {
    gap: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: FOCAL.backgroundBase,
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  th: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  td: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tdJade: {
    color: FOCAL.jadeInk,
  },
  colStream: {
    flex: 1.6,
    minWidth: 140,
  },
  colAmt: {
    flex: 0.7,
    minWidth: 72,
    textAlign: 'right',
  },
  streamTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  streamSplit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  caveat: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 8,
  },
});
