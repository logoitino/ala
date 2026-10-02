/**
 * Expo /admin → Sports desk: edit a sport's positions, scoring actions, stat fields and sideline callouts,
 * with a live preview of what the scorer and profile will show. Saves through `lib/sports.ts`.
 * @sideEffects Writes sport configs to Supabase.
 */

import { useCallback, useMemo, useState } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import {
  GENERIC_SPORT_CONFIG,
  SPORT_CONFIG_SEEDS,
  SPORT_MEASURABLE_KEYS,
  SPORT_STAT_SOURCES,
  sportClockLabel,
  type SportCallout,
  type SportConfig,
  type SportScoreAction,
  type SportStatSource,
} from '@/data/sports';
import {
  deleteSportConfig,
  fetchSportUsage,
  fetchStoredSportConfigs,
  saveSportConfig,
  seedSportConfigs,
  type SportUsage,
} from '@/lib/sports';
import { FOCAL } from '@/theme/motion';

type Draft = SportConfig & { clockMinutes: string };

function toDraft(config: SportConfig): Draft {
  return {
    ...config,
    scoring: config.scoring.map((row) => ({ ...row })),
    callouts: config.callouts.map((row) => ({ ...row })),
    statFields: config.statFields.map((row) => ({ ...row })),
    measurables: config.measurables.map((row) => ({ ...row })),
    positions: config.positions.map((row) => ({ ...row })),
    periods: [...config.periods],
    clockMinutes: String(Math.max(0, Math.round(config.clockSeconds / 60)) || ''),
  };
}

function blankDraft(sortOrder: number): Draft {
  return toDraft({
    ...GENERIC_SPORT_CONFIG,
    id: '',
    sport: '',
    scoring: GENERIC_SPORT_CONFIG.scoring.map((row) => ({ ...row })),
    callouts: GENERIC_SPORT_CONFIG.callouts.map((row) => ({ ...row })),
    statFields: GENERIC_SPORT_CONFIG.statFields.map((row) => ({ ...row })),
    measurables: GENERIC_SPORT_CONFIG.measurables.map((row) => ({ ...row })),
    positions: [],
    sortOrder,
  });
}

function nextId(prefix: string, taken: string[]): string {
  let index = taken.length + 1;
  while (taken.includes(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

/**
 * @purpose Sports builder desk: define every sport's score buttons, period chips, clock, sideline callouts, and which Stats 📊 rows fans see. One playbook per sport, live for the operator console and the athlete Stats tab.
 * @returns Playbook list with usage counts plus the editor for the selected sport.
 * @sideEffects `get_sport_configs` on focus; `upsert_sport_config` / `delete_sport_config` on save, pause, and delete; counts read `athlete_career_stats` + `games`.
 */
export function SportsTool() {
  const router = useRouter();
  const [rows, setRows] = useState<SportConfig[]>([]);
  const [stored, setStored] = useState<string[]>([]);
  const [usage, setUsage] = useState<Record<string, SportUsage>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saved, counts] = await Promise.all([fetchStoredSportConfigs(), fetchSportUsage()]);
      // Nothing saved yet? Show the starter playbooks so the desk is never blank, but mark them uninstalled.
      setRows(saved && saved.length > 0 ? saved : SPORT_CONFIG_SEEDS);
      setStored((saved ?? []).map((row) => row.sport.trim().toLowerCase()));
      setUsage(counts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load sports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const unseeded = useMemo(
    () => SPORT_CONFIG_SEEDS.filter((seed) => !stored.includes(seed.sport.trim().toLowerCase())),
    [stored],
  );

  const patch = (next: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...next } : current));

  const save = async (config: Draft, note: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const minutes = Number(config.clockMinutes);
      await saveSportConfig({
        ...config,
        clockSeconds: config.usesClock && Number.isFinite(minutes) ? Math.max(0, Math.round(minutes * 60)) : 0,
      });
      setMessage(note);
      setDraft(null);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this sport.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (config: SportConfig) => {
    setBusy(true);
    setMessage(null);
    try {
      await deleteSportConfig(config.id);
      setMessage(`${config.sport} playbook deleted. Its games fall back to the generic console.`);
      setDraft(null);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not delete this sport.');
    } finally {
      setBusy(false);
    }
  };

  const installSeeds = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const count = await seedSportConfigs();
      setMessage(`${count} playbooks installed. Edit any of them below.`);
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not install the starter playbooks.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Sports"
      lede="One playbook per sport. Score buttons, period chips, the clock, sideline callouts, and the Stats 📊 rows fans see are all defined here — the operator console and athlete profiles read it live."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminNotice text={message} />

      <AdminPanel title="Playbooks">
        <AdminBtn label="+ New sport" kind="primary" disabled={busy} onPress={() => setDraft(blankDraft(rows.length))} />
        {unseeded.length > 0 ? (
          <AdminBtn
            label={`Install ${unseeded.length} starter playbook${unseeded.length === 1 ? '' : 's'} (${unseeded
              .slice(0, 3)
              .map((row) => row.sport)
              .join(', ')}${unseeded.length > 3 ? '…' : ''})`}
            disabled={busy}
            onPress={() => void installSeeds()}
          />
        ) : null}
        {rows.length === 0 && !loading ? (
          <AdminEmpty text="No playbooks yet. Install the starters or build one from scratch." />
        ) : null}
        {rows.map((row) => {
          const counts = usage[row.sport.trim().toLowerCase()];
          return (
            <AdminRow
              key={row.id}
              title={`${row.emoji} ${row.sport}${row.isActive ? '' : ' · paused'}${
                stored.includes(row.sport.trim().toLowerCase()) ? '' : ' · starter'
              }`}
              meta={`${row.scoring.length} score button${row.scoring.length === 1 ? '' : 's'} · ${row.periods.length} ${row.periodLabel.toLowerCase()}s · ${
                row.usesClock ? `clock ${sportClockLabel(row)}` : 'no clock'
              } · ${row.positions.length} positions · ${counts?.athletes ?? 0} athletes · ${counts?.games ?? 0} games`}
            >
              <AdminBtn label="Edit" disabled={busy} onPress={() => setDraft(toDraft(row))} />
              <AdminBtn
                label={row.isActive ? 'Pause' : 'Activate'}
                disabled={busy}
                onPress={() =>
                  void save(
                    { ...toDraft(row), isActive: !row.isActive },
                    row.isActive ? `${row.sport} paused. It stays off new game and athlete pickers.` : `${row.sport} is live.`,
                  )
                }
              />
            </AdminRow>
          );
        })}
      </AdminPanel>

      {draft ? (
        <SportEditor
          draft={draft}
          busy={busy}
          onPatch={patch}
          onCancel={() => setDraft(null)}
          onSave={() => void save(draft, `${draft.sport || 'Sport'} playbook saved.`)}
          onDelete={draft.id ? () => void remove(draft) : undefined}
        />
      ) : null}

      <AdminBtn label="Open the operator console" onPress={() => router.push('/operator' as Href)} />
    </AdminPage>
  );
}

/**
 * @purpose Editor for one playbook: identity, periods + clock, score buttons, callouts, Stats rows, combine tiles, and a live preview of the console.
 */
function SportEditor({
  draft,
  busy,
  onPatch,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: Draft;
  busy: boolean;
  onPatch: (next: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const setScoring = (scoring: SportScoreAction[]) => onPatch({ scoring });
  const setCallouts = (callouts: SportCallout[]) => onPatch({ callouts });

  return (
    <AdminPanel title={draft.id ? `Edit ${draft.sport || 'sport'}` : 'New sport'}>
      <AdminField label="Sport name" value={draft.sport} onChangeText={(sport) => onPatch({ sport })} placeholder="Water Polo" autoCapitalize="words" />
      <AdminField label="Emoji" value={draft.emoji} onChangeText={(emoji) => onPatch({ emoji })} placeholder="🤽" />
      <AdminField
        label="What a segment is called"
        value={draft.periodLabel}
        onChangeText={(periodLabel) => onPatch({ periodLabel })}
        placeholder="Quarter / Half / Set / Inning"
        autoCapitalize="words"
      />

      <Text style={styles.section}>Periods on the console</Text>
      {draft.periods.map((period, index) => (
        <View key={`period-${index}`} style={styles.line}>
          <View style={styles.lineField}>
            <AdminField
              label={`${draft.periodLabel} ${index + 1}`}
              value={period}
              onChangeText={(value) =>
                onPatch({ periods: draft.periods.map((row, i) => (i === index ? value : row)) })
              }
              placeholder="Q1"
            />
          </View>
          <AdminBtn
            label="Remove"
            disabled={busy || draft.periods.length <= 1}
            onPress={() => onPatch({ periods: draft.periods.filter((_, i) => i !== index) })}
          />
        </View>
      ))}
      <AdminBtn label="+ Add period" disabled={busy} onPress={() => onPatch({ periods: [...draft.periods, ''] })} />

      <AdminPills
        label="Clock"
        items={[
          { id: 'timed', label: 'Running clock' },
          { id: 'untimed', label: 'No clock (sets / innings)' },
        ]}
        value={draft.usesClock ? 'timed' : 'untimed'}
        onChange={(id) => onPatch({ usesClock: id === 'timed' })}
      />
      {draft.usesClock ? (
        <AdminField
          label="Minutes per period"
          value={draft.clockMinutes}
          onChangeText={(clockMinutes) => onPatch({ clockMinutes })}
          placeholder="12"
          keyboardType="number-pad"
        />
      ) : null}

      <Text style={styles.section}>Score buttons</Text>
      {draft.scoring.map((action, index) => (
        <View key={action.id} style={styles.stack}>
          <View style={styles.line}>
            <View style={styles.lineField}>
              <AdminField
                label="Button label"
                value={action.label}
                onChangeText={(label) =>
                  setScoring(draft.scoring.map((row, i) => (i === index ? { ...row, label } : row)))
                }
                placeholder="Touchdown +6"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.linePoints}>
              <AdminField
                label="Points"
                value={String(action.points)}
                onChangeText={(value) =>
                  setScoring(
                    draft.scoring.map((row, i) =>
                      i === index ? { ...row, points: Math.max(0, Number(value.replace(/[^0-9]/g, '')) || 0) } : row,
                    ),
                  )
                }
                keyboardType="number-pad"
                placeholder="6"
              />
            </View>
          </View>
          <View style={styles.line}>
            <View style={styles.lineField}>
              <AdminField
                label="Play type written to the feed"
                value={action.eventType}
                onChangeText={(eventType) =>
                  setScoring(draft.scoring.map((row, i) => (i === index ? { ...row, eventType } : row)))
                }
                placeholder="Touchdown"
                autoCapitalize="words"
              />
            </View>
            <AdminBtn
              label="Remove"
              disabled={busy}
              onPress={() => setScoring(draft.scoring.filter((_, i) => i !== index))}
            />
          </View>
        </View>
      ))}
      <AdminBtn
        label="+ Add score button"
        disabled={busy}
        onPress={() =>
          setScoring([
            ...draft.scoring,
            {
              id: nextId('score', draft.scoring.map((row) => row.id)),
              label: '',
              points: 1,
              eventType: '',
            },
          ])
        }
      />

      <Text style={styles.section}>Sideline callouts fans see</Text>
      {draft.callouts.map((callout, index) => (
        <View key={callout.id} style={styles.line}>
          <View style={styles.lineEmoji}>
            <AdminField
              label="Emoji"
              value={callout.emoji}
              onChangeText={(emoji) =>
                setCallouts(draft.callouts.map((row, i) => (i === index ? { ...row, emoji } : row)))
              }
              placeholder="⚡"
            />
          </View>
          <View style={styles.lineField}>
            <AdminField
              label="Callout"
              value={callout.label}
              onChangeText={(label) =>
                setCallouts(
                  draft.callouts.map((row, i) => (i === index ? { ...row, label, eventType: row.eventType || label } : row)),
                )
              }
              placeholder="Big Play"
              autoCapitalize="words"
            />
          </View>
          <AdminBtn
            label="Remove"
            disabled={busy}
            onPress={() => setCallouts(draft.callouts.filter((_, i) => i !== index))}
          />
        </View>
      ))}
      <AdminBtn
        label="+ Add callout"
        disabled={busy}
        onPress={() =>
          setCallouts([
            ...draft.callouts,
            { id: nextId('callout', draft.callouts.map((row) => row.id)), label: '', emoji: '⚡', eventType: '' },
          ])
        }
      />

      <Text style={styles.section}>Stats 📊 rows on the athlete profile</Text>
      {draft.statFields.map((field, index) => (
        <View key={`${field.source}-${index}`} style={styles.line}>
          <View style={styles.lineField}>
            <AdminField
              label={SPORT_STAT_SOURCES.find((row) => row.id === field.source)?.label ?? field.source}
              value={field.label}
              onChangeText={(label) =>
                onPatch({ statFields: draft.statFields.map((row, i) => (i === index ? { ...row, label } : row)) })
              }
              placeholder="Points"
              autoCapitalize="words"
            />
          </View>
          <AdminBtn
            label={field.show ? 'Showing' : 'Hidden'}
            kind={field.show ? 'primary' : 'ghost'}
            disabled={busy}
            onPress={() =>
              onPatch({
                statFields: draft.statFields.map((row, i) => (i === index ? { ...row, show: !row.show } : row)),
              })
            }
          />
        </View>
      ))}

      <Text style={styles.section}>Combine tiles</Text>
      {draft.measurables.map((row, index) => (
        <View key={row.key} style={styles.line}>
          <View style={styles.lineField}>
            <AdminField
              label={SPORT_MEASURABLE_KEYS.find((item) => item.id === row.key)?.label ?? row.key}
              value={row.label}
              onChangeText={(label) =>
                onPatch({ measurables: draft.measurables.map((item, i) => (i === index ? { ...item, label } : item)) })
              }
              placeholder="Vertical Jump"
              autoCapitalize="words"
            />
          </View>
          <AdminBtn
            label={row.show ? 'Showing' : 'Hidden'}
            kind={row.show ? 'primary' : 'ghost'}
            disabled={busy}
            onPress={() =>
              onPatch({
                measurables: draft.measurables.map((item, i) => (i === index ? { ...item, show: !item.show } : item)),
              })
            }
          />
        </View>
      ))}

      <Text style={styles.section}>Roster positions</Text>
      {draft.positions.map((position, index) => (
        <View key={`position-${index}`} style={styles.line}>
          <View style={styles.lineEmoji}>
            <AdminField
              label="Pill"
              value={position.short}
              onChangeText={(short) =>
                onPatch({ positions: draft.positions.map((row, i) => (i === index ? { ...row, short } : row)) })
              }
              placeholder="QB"
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.lineField}>
            <AdminField
              label="Full name"
              value={position.full}
              onChangeText={(full) =>
                onPatch({ positions: draft.positions.map((row, i) => (i === index ? { ...row, full } : row)) })
              }
              placeholder="Quarterback"
              autoCapitalize="words"
            />
          </View>
          <AdminBtn
            label="Remove"
            disabled={busy}
            onPress={() => onPatch({ positions: draft.positions.filter((_, i) => i !== index) })}
          />
        </View>
      ))}
      <AdminBtn
        label="+ Add position"
        disabled={busy}
        onPress={() => onPatch({ positions: [...draft.positions, { short: '', full: '' }] })}
      />

      <SportPreview draft={draft} />

      <AdminBtn label={draft.id ? 'Save playbook' : 'Create sport'} kind="primary" disabled={busy} onPress={onSave} />
      <AdminBtn label="Cancel" disabled={busy} onPress={onCancel} />
      {onDelete ? <AdminBtn label="Delete sport" kind="danger" disabled={busy} onPress={onDelete} /> : null}
    </AdminPanel>
  );
}

/** @purpose Show the operator console and Stats table exactly as this draft will render them. */
function SportPreview({ draft }: { draft: Draft }) {
  const statRows = draft.statFields.filter((row) => row.show);
  const combine = draft.measurables.filter((row) => row.show);
  const scoring = draft.scoring.filter((row) => row.label.trim());
  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>
        Operator preview · {draft.emoji} {draft.sport || 'New sport'}
      </Text>
      <View style={styles.chips}>
        {draft.periods.filter(Boolean).map((period, index) => (
          <Text key={`p-${index}`} style={styles.chip}>
            {period}
          </Text>
        ))}
        {draft.usesClock ? (
          <Text style={styles.chip}>{sportClockLabel({ ...draft, clockSeconds: (Number(draft.clockMinutes) || 0) * 60 })} clock</Text>
        ) : (
          <Text style={styles.chip}>No clock</Text>
        )}
      </View>
      <View style={styles.chips}>
        {scoring.length === 0 ? (
          <Text style={styles.previewMuted}>Add at least one score button.</Text>
        ) : (
          scoring.map((action) => (
            <Text key={action.id} style={styles.scoreChip}>
              {action.label} {action.points > 0 ? `(+${action.points})` : ''}
            </Text>
          ))
        )}
      </View>
      <View style={styles.chips}>
        {draft.callouts
          .filter((row) => row.label.trim())
          .map((callout) => (
            <Text key={callout.id} style={styles.chip}>
              {callout.emoji} {callout.label}
            </Text>
          ))}
      </View>
      <Text style={styles.previewTitle}>Stats 📊 preview</Text>
      <Text style={styles.previewMuted}>
        Combine: {combine.length > 0 ? combine.map((row) => row.label).join(' · ') : 'hidden'}
      </Text>
      <Text style={styles.previewMuted}>
        Career: {statRows.length > 0 ? statRows.map((row) => row.label).join(' · ') : 'hidden'}
      </Text>
      <Text style={styles.previewMuted}>
        Roster pills:{' '}
        {draft.positions.length > 0
          ? draft.positions.map((row) => row.short || row.full).join(' · ')
          : 'free text only'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  stack: {
    gap: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  lineField: {
    flex: 1,
  },
  linePoints: {
    width: 92,
  },
  lineEmoji: {
    width: 78,
  },
  preview: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  previewMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreChip: {
    borderRadius: 999,
    backgroundColor: FOCAL.neonJade,
    color: FOCAL.ink,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
