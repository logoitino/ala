/**
 * Money owns disbursement requests and status changes. Ledger totals, streams and gift history belong
 * to the Revenue report so the editing desk does not fetch or repeat a second financial dashboard.
 * @sideEffects Existing disbursement reads, queue insertion and confirmed status updates.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { useRoster } from '@/hooks/useRoster';
import {
  centsFromDollarsInput,
  fetchAdminDisbursements,
  queueDisbursement,
  setDisbursementStatus,
} from '@/lib/adminCatalog';
import { formatTipDollars } from '@/lib/reels';
import type { Disbursement } from '@/types/database';

const QUICK = [
  { id: '25', label: '$25', cents: 2500 },
  { id: '50', label: '$50', cents: 5000 },
  { id: '100', label: '$100', cents: 10000 },
  { id: '250', label: '$250', cents: 25000 },
];

/**
 * @purpose Queue and review disbursements; Revenue is the destination for financial reporting.
 * @sideEffects `disbursements` SELECT / INSERT / UPDATE.
 */
export function MoneyTool() {
  const router = useRouter();
  const { players } = useRoster();
  const [payouts, setPayouts] = useState<Disbursement[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [amount, setAmount] = useState('50.00');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPayout, setBusyPayout] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayouts(await fetchAdminDisbursements());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load disbursements.');
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

  /** Paid / failed is the money record of what left Stripe, so confirm first and show a failed write. */
  const confirmPayoutStatus = (row: Disbursement, status: 'paid' | 'failed') => {
    const who = `${formatTipDollars(row.amount_cents)} for ${nameFor(row.player_id)}`;
    Alert.alert(
      status === 'paid' ? 'Mark this payout paid?' : 'Mark this payout failed?',
      status === 'paid'
        ? `Only after Stripe shows ${who} was sent. This records money out.`
        : `${who} will be marked failed and leave the queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'paid' ? 'Mark paid' : 'Mark failed',
          style: status === 'paid' ? 'default' : 'destructive',
          onPress: () => {
            setBusyPayout(row.id);
            setMessage(null);
            void setDisbursementStatus(row.id, status)
              .then(() => refresh())
              .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : 'Could not update this payout.'))
              .finally(() => setBusyPayout(null));
          },
        },
      ],
    );
  };

  return (
    <AdminPage
      title="Payouts"
      lede="Queue and review disbursements. Check Stripe before marking a payout paid."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AdminBtn label="View revenue report" onPress={() => router.push('/admin/revenue' as Href)} />
        <AdminBtn label="Edit gift amounts + exclusive prices" onPress={() => router.push('/admin/catalog' as Href)} />
      </View>

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
      <AdminPanel title="Disbursements">
        {loading ? <AdminNotice text="Reading disbursements…" /> : error ? null : payouts.length === 0 ? (
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
                  <AdminBtn
                    label={busyPayout === row.id ? '…' : 'Mark paid'}
                    kind="primary"
                    disabled={busyPayout === row.id}
                    onPress={() => confirmPayoutStatus(row, 'paid')}
                  />
                  <AdminBtn
                    label={busyPayout === row.id ? '…' : 'Failed'}
                    kind="danger"
                    disabled={busyPayout === row.id}
                    onPress={() => confirmPayoutStatus(row, 'failed')}
                  />
                </>
              ) : null}
            </AdminRow>
          ))
        )}
      </AdminPanel>
    </AdminPage>
  );
}
