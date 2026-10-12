/**
 * Short pages for the Highlight composer: media → details → review, with optional settings
 * and searchable athlete/game pages. The Media step offers Video | Photos (photo stories,
 * PHOTO_STORIES_DESIGN.md) when the database supports them; photo pieces live in PhotoStoryPicker.
 * Draft and upload ownership stay in UploadVideoModal. A short step sits in a compact menu with
 * Next directly under the choices, centered on the sheet. Longer steps scroll inside that menu and
 * keep Next on the menu, not on the screen edge. Photo stories are public only: no Vault control.
 * The sheet does not play the chosen video. A video view inside this page sheet covers the phone
 * when the athlete list opens and closes.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuBackdrop, MenuStepIndicator } from '@/components/UI/MenuChrome';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { AccountTagField } from '@/components/Reels/AccountTagField';
import { MediaKindSwitch, PhotoDescriptionFields, PhotoStoryStrip, type DraftStoryPhoto } from '@/components/Reels/PhotoStoryPicker';
import { CardShine } from '@/components/Effects/CardShine';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { HIGHLIGHT_PUBLISH_LABEL, PHOTO_STORY_MAX_PHOTOS, REEL_CATEGORY_SERVE, SERVE_LIKE_ME_BOOST_LABEL, type HighlightMediaType, type ReelCategory } from '@/data/highlights';
import { HIGHLIGHT_MAX_SECONDS } from '@/data/media';
import { VAULT_BADGE_LABEL } from '@/data/exclusive';
import { COMPLIANCE_UPLOAD } from '@/data/legal';
import { rightsChecksFor, shareConfirmationLabel, type RightsAckId } from '@/data/contentRights';
import { displayValue } from '@/data/players';
import { gameMatchupLabel, playerTagLabel } from '@/lib/reels';
import type { AccountTagHit } from '@/lib/accountTags';
import type { Game, Player } from '@/types/database';

export type UploadStep = 'clip' | 'details' | 'review' | 'options';
type Props = {
  step: UploadStep; onStep: (step: UploadStep) => void;
  asset: { uri: string; fileName?: string | null; durationMs?: number | null } | null;
  pickSource: 'library' | 'camera' | null; onPick: (source: 'library' | 'camera') => void; simulator: boolean;
  games: Game[]; players: Player[]; gameId: string; playerId: string; ownPlayerId: string | null;
  gameLabel: string; playerLabel: string; onGame: (id: string) => void; onPlayer: (id: string) => void;
  openSelect: 'game' | 'player' | null; onSelect: (select: 'game' | 'player' | null) => void;
  caption: string; onCaption: (caption: string) => void; category: ReelCategory; onCategory: (category: ReelCategory) => void;
  categoryPills: { id: ReelCategory; label: string }[]; accountTags: AccountTagHit[]; onAccountTags: (tags: AccountTagHit[]) => void;
  isExclusive: boolean; onExclusive: (enabled: boolean) => void; exclusiveDollars: number;
  rights: Partial<Record<RightsAckId, boolean>>; onRights: (rights: Partial<Record<RightsAckId, boolean>>) => void;
  uploading: boolean; canSubmit: boolean; detailsReady: boolean; uploadError: string | null; loadError: string | null;
  onClose: () => void; onSubmit: () => void; progress: number; barWidth: Animated.AnimatedInterpolation<string>;
  pulse: Animated.Value; statusLabel: string; showSuccess: boolean; successAnim: Animated.Value;
  mediaKind: HighlightMediaType; onMediaKind: (kind: HighlightMediaType) => void; photosAvailable: boolean;
  photos: DraftStoryPhoto[]; onPickPhotos: () => void; onMovePhoto: (from: number, to: number) => void;
  onRemovePhoto: (index: number) => void; onPhotoDescription: (index: number, text: string) => void;
};

/** @purpose Render one focused upload page with persistent navigation and one rights confirmation. */
export function UploadVideoComposer(p: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useEffect(() => { setQuery(''); }, [p.openSelect]);
  const go = (step: UploadStep) => { if (p.uploading) return; Keyboard.dismiss(); p.onSelect(null); p.onStep(step); };
  const back = () => {
    Keyboard.dismiss();
    if (p.openSelect) p.onSelect(null);
    else go(p.step === 'review' ? 'details' : p.step === 'options' ? 'review' : 'clip');
  };
  const number = p.step === 'clip' ? 1 : p.step === 'details' ? 2 : 3;
  const isPhotos = p.mediaKind === 'photo_story';
  const mediaReady = isPhotos ? p.photos.length > 0 : Boolean(p.asset);
  const photoCountLabel = `${p.photos.length} ${p.photos.length === 1 ? 'photo' : 'photos'}`;
  const title = p.openSelect === 'player' ? 'Choose athlete' : p.openSelect === 'game' ? 'Choose game'
    : p.step === 'clip' ? isPhotos ? 'Choose your photos' : 'Choose your clip' : p.step === 'details' ? 'Add the details'
      : p.step === 'options' ? 'More options' : 'Ready to share?';
  const categoryLabel = p.categoryPills.find((pill) => pill.id === p.category)?.label ?? p.category;
  const photoCard = isPhotos && p.photos[0] ? (
    <View style={styles.clipCard}>
      <Image source={{ uri: p.photos[0].uri }} style={styles.thumb} resizeMode="cover" accessible={false} />
      <View style={styles.flex}>
        <Text style={styles.label}>Your photo story ⚡</Text>
        <Text style={styles.hint}>{photoCountLabel}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change photos" disabled={p.uploading} onPress={() => go('clip')} style={styles.smallButton}>
        <Text style={styles.link}>Change</Text>
      </Pressable>
    </View>
  ) : null;
  const clipCard = isPhotos ? photoCard : p.asset ? (
    <View style={styles.clipCard}>
      <View style={[styles.thumb, styles.thumbMark]}><Ionicons name="play" size={18} color={colors.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.label}>Your Highlight ⚡</Text>
        <Text style={styles.hint} numberOfLines={2}>{p.asset.fileName || 'Selected video'}{p.asset.durationMs ? ` · ${Math.round(p.asset.durationMs / 1000)}s` : ''}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change video" disabled={p.uploading} onPress={() => go('clip')} style={styles.smallButton}>
        <Text style={styles.link}>Change</Text>
      </Pressable>
    </View>
  ) : null;
  const selectRow = (label: string, value: string, select: 'player' | 'game') => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value }} disabled={p.uploading}
        onPress={() => { Keyboard.dismiss(); p.onSelect(select); }} style={styles.select}>
        <Text style={[styles.selectText, !p.playerId && select === 'player' && styles.hint]}>{value}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
  const actionBar = (
    <View style={styles.footer}>
      {p.uploading ? p.showSuccess ? (
        <Animated.View style={{ opacity: p.successAnim, alignItems: 'center' }}><Text style={styles.link}>{isPhotos ? 'Photo story published ⚡' : 'Seki play uploaded ⚡'}</Text></Animated.View>
      ) : (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p.progress * 100) }} accessibilityLiveRegion="polite" style={styles.field}>
          <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: p.barWidth, opacity: p.pulse }]}><CardShine loopMs={1700} width={12} /></Animated.View></View>
          <View style={styles.sourceRow}><ActivityIndicator color={colors.primary} /><Text style={styles.hint}>{p.statusLabel} {Math.round(p.progress * 100)}%</Text></View>
        </View>
      ) : null}
      {!p.uploading && !p.openSelect && p.step !== 'options' ? <Text style={styles.footerHint}>
        {p.step === 'clip' ? isPhotos ? mediaReady ? 'Your photos are ready.' : `Choose up to ${PHOTO_STORY_MAX_PHOTOS} photos to continue.` : mediaReady ? 'Your clip is ready.' : 'Choose or record a video to continue.' : p.step === 'details' ? isPhotos ? 'Add a caption and choose an athlete.' : 'Add a caption. Tagging an athlete can wait.' : 'Confirm to publish.'}
      </Text> : null}
      <AnimatedButton accessibilityLabel={p.openSelect || p.step === 'options' ? 'Done' : p.step === 'review' ? HIGHLIGHT_PUBLISH_LABEL : 'Next'}
        disabled={p.uploading || (!p.openSelect && (p.step === 'clip' ? !mediaReady : p.step === 'details' ? !p.detailsReady : p.step === 'review' ? !p.canSubmit : false))}
        onPress={() => { if (p.openSelect) { p.onSelect(null); Keyboard.dismiss(); } else if (p.step === 'review') p.onSubmit(); else go(p.step === 'clip' ? 'details' : 'review'); }}
        contentStyle={[styles.submit, (p.uploading || (!p.openSelect && (p.step === 'clip' ? !mediaReady : p.step === 'details' ? !p.detailsReady : p.step === 'review' ? !p.canSubmit : false))) && styles.disabled]}>
        <Text style={styles.submitText}>{p.uploading ? 'Publishing…' : p.openSelect || p.step === 'options' ? 'Done' : p.step === 'review' ? HIGHLIGHT_PUBLISH_LABEL : 'Next'}</Text>
      </AnimatedButton>
    </View>
  );
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.sheet, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <MenuBackdrop accent="violet" />
        <View style={styles.menu}>
        <View style={styles.header}>
          {p.step !== 'clip' || p.openSelect ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={p.uploading} onPress={back} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : <View style={styles.iconButton} />}
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>{p.openSelect ? 'Highlight details' : p.step === 'options' ? 'Optional settings' : `Step ${number} of 3`}</Text>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close upload" disabled={p.uploading}
            onPress={() => { if (p.openSelect) p.onSelect(null); else p.onClose(); }} style={styles.iconButton}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        {!p.openSelect && p.step !== 'options' ? <MenuStepIndicator labels={['Media', 'Details', 'Review']} current={number} /> : null}
        <ScrollView key={p.openSelect || p.step} style={styles.scroll} contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator>
          {p.openSelect ? (
            <>
              <TextInput accessibilityLabel={p.openSelect === 'player' ? 'Search athletes' : 'Search games'} value={query} onChangeText={setQuery}
                placeholder={p.openSelect === 'player' ? 'Name, school or jersey number' : 'Team or venue'} placeholderTextColor={colors.textMuted} style={styles.input} />
              {p.openSelect === 'player' ? (() => {
                const needle = query.trim().toLowerCase();
                const rows = p.players.filter((player) => `${player.name} ${player.school_name} ${player.jersey_number}`.toLowerCase().includes(needle));
                const own = p.players.find((player) => player.id === p.ownPlayerId) ?? null;
                const showLater = !isPhotos && needle === '';
                const showOwn = Boolean(own && rows.some((player) => player.id === own.id));
                return <>
                  {showLater ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Tag later" accessibilityState={{ selected: !p.playerId }}
                      onPress={() => { p.onPlayer(''); p.onSelect(null); Keyboard.dismiss(); }} style={[styles.option, !p.playerId && styles.selected]}>
                      <Text style={styles.label}>Tag later</Text><Text style={styles.hint}>Donate stays off until an athlete is tagged.</Text>
                    </Pressable>
                  ) : null}
                  {showOwn && own ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="This is me" accessibilityState={{ selected: own.id === p.playerId }}
                      onPress={() => { p.onPlayer(own.id); p.onSelect(null); Keyboard.dismiss(); }} style={[styles.option, own.id === p.playerId && styles.selected]}>
                      <Text style={styles.label}>This is me</Text><Text style={styles.hint}>Your athlete profile</Text>
                    </Pressable>
                  ) : null}
                  {rows.map((player) => (
                    <Pressable key={player.id} accessibilityRole="button" accessibilityLabel={`Choose ${player.name}`} accessibilityState={{ selected: player.id === p.playerId }}
                      onPress={() => { p.onPlayer(player.id); p.onSelect(null); Keyboard.dismiss(); }} style={[styles.option, player.id === p.playerId && styles.selected]}>
                      <Text style={styles.label}>{playerTagLabel(player)}</Text><Text style={styles.hint}>{displayValue(player.position)} · {displayValue(player.school_name)}</Text>
                    </Pressable>
                  ))}
                  {rows.length === 0 ? <Text style={styles.hint}>{p.players.length ? 'No matching athletes.' : 'No athletes available. Close and try again when the roster is ready.'}</Text> : null}
                </>;
              })() : (
                <>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: !p.gameId }} onPress={() => { p.onGame(''); p.onSelect(null); Keyboard.dismiss(); }} style={styles.option}>
                    <Text style={styles.label}>No specific game</Text><Text style={styles.hint}>Share without a matchup</Text>
                  </Pressable>
                  {p.games.filter((game) => `${game.home_team} ${game.away_team} ${game.venue}`.toLowerCase().includes(query.toLowerCase())).map((game) => (
                    <Pressable key={game.id} accessibilityRole="button" accessibilityState={{ selected: game.id === p.gameId }}
                      onPress={() => { p.onGame(game.id); p.onSelect(null); Keyboard.dismiss(); }} style={[styles.option, game.id === p.gameId && styles.selected]}>
                      <Text style={styles.label}>{gameMatchupLabel(game.home_team, game.away_team)}</Text><Text style={styles.hint}>{displayValue(game.venue)} · {displayValue(game.status)}</Text>
                    </Pressable>
                  ))}
                  {p.games.length > 0 && !p.games.some((game) => `${game.home_team} ${game.away_team} ${game.venue}`.toLowerCase().includes(query.toLowerCase())) ? <Text style={styles.hint}>No matching games.</Text> : null}
                  {p.loadError ? <Text accessibilityRole="alert" style={styles.error}>{p.loadError}</Text> : null}
                </>
              )}
            </>
          ) : p.step === 'clip' ? (
            <>
              {p.photosAvailable ? <MediaKindSwitch value={p.mediaKind} onChange={p.onMediaKind} disabled={p.uploading} /> : null}
              {isPhotos ? (
                <>
                  <View style={styles.hero}><View style={styles.heroBadge}><Ionicons name="images" size={30} color={colors.primary} /></View><Text style={styles.heroTitle}>Tell their story in photos.</Text><Text style={styles.heroHint}>Pick up to {PHOTO_STORY_MAX_PHOTOS} photos, then put them in order.</Text></View>
                  {p.photos.length ? (
                    <PhotoStoryStrip photos={p.photos} onMove={p.onMovePhoto} onRemove={p.onRemovePhoto} onAdd={p.onPickPhotos} disabled={p.uploading} />
                  ) : (
                    <AnimatedButton accessibilityLabel="Choose photos from library" disabled={p.uploading} onPress={p.onPickPhotos} contentStyle={styles.source}>
                      <Ionicons name="images-outline" size={26} color={colors.primary} />
                      <Text style={styles.label}>Library</Text><Text style={styles.hint}>Choose photos</Text>
                    </AnimatedButton>
                  )}
                  <Text style={styles.heroHint}>Next, add a caption and choose the athlete.</Text>
                </>
              ) : (<>
              <View style={styles.hero}><View style={styles.heroBadge}><Ionicons name="play" size={30} color={colors.primary} /><View style={styles.spark}><Ionicons name="flash" size={13} color={colors.gold} /></View></View><Text style={styles.heroTitle}>Make their moment shine.</Text><Text style={styles.heroHint}>Start with a video up to {HIGHLIGHT_MAX_SECONDS} seconds.</Text></View>
              <View style={styles.sourceRow}>{(['library', 'camera'] as const).map((source) => (
                <AnimatedButton key={source} accessibilityLabel={source === 'library' ? 'Choose a video from library' : 'Record a video'}
                  disabled={p.uploading} onPress={() => p.onPick(source)} style={styles.flex} contentStyle={[styles.source, p.pickSource === source && styles.selected]}>
                  <Ionicons name={source === 'library' ? 'images-outline' : 'videocam-outline'} size={26} color={source === 'library' ? colors.primary : colors.gold} />
                  <Text style={styles.label}>{source === 'library' ? 'Library' : 'Record'}</Text><Text style={styles.hint}>{source === 'library' ? 'Choose a video' : p.simulator ? 'Phone only' : 'Capture a moment'}</Text>
                </AnimatedButton>
              ))}</View>
              {clipCard}
              <Text style={styles.heroHint}>Next, add a caption. You can tag the athlete now or later.</Text>
              </>)}
            </>
          ) : p.step === 'details' ? (
            <>
              {clipCard}
              <View style={styles.field}><Text style={styles.label}>Caption</Text>
                <TextInput accessibilityLabel="Highlight caption" value={p.caption} onChangeText={p.onCaption} editable={!p.uploading}
                  placeholder={isPhotos ? 'What is the story behind these photos?' : 'What made this moment special?'} placeholderTextColor={colors.textMuted} style={[styles.input, styles.caption]} multiline maxLength={120} />
                <Text style={styles.counter}>{p.caption.length}/120</Text>
              </View>
              {!isPhotos && p.ownPlayerId && p.players.some((player) => player.id === p.ownPlayerId) ? (
                <Pressable accessibilityRole="button" accessibilityLabel="This is me" accessibilityState={{ selected: p.playerId === p.ownPlayerId }}
                  disabled={p.uploading} onPress={() => p.onPlayer(p.ownPlayerId ?? '')} style={[styles.option, p.playerId === p.ownPlayerId && styles.selected]}>
                  <Text style={styles.label}>This is me</Text><Text style={styles.hint}>Your athlete profile</Text>
                </Pressable>
              ) : null}
              {selectRow(isPhotos ? 'Who’s in these photos?' : 'Who’s in this clip?', p.playerLabel, 'player')}
              <View style={styles.field}><Text style={styles.label}>Category</Text><View style={styles.categoryRow}>
                {p.categoryPills.map((pill) => <Pressable key={pill.id} accessibilityRole="button" accessibilityLabel={pill.label} accessibilityState={{ selected: pill.id === p.category }}
                  disabled={p.uploading} onPress={() => p.onCategory(pill.id)} style={[styles.category, pill.id === p.category && styles.categoryActive]}>
                  <Text style={[styles.categoryText, pill.id === p.category && styles.categoryTextActive]}>{pill.label}</Text>
                </Pressable>)}
              </View>{p.category === REEL_CATEGORY_SERVE ? <Text style={styles.link}>{SERVE_LIKE_ME_BOOST_LABEL}</Text> : null}</View>
              {isPhotos ? <PhotoDescriptionFields photos={p.photos} onDescription={p.onPhotoDescription} disabled={p.uploading} /> : null}
            </>
          ) : p.step === 'options' ? (
            <>
              <Text style={styles.hint}>{isPhotos ? 'Add only what your story needs. Photo stories are always public.' : 'Add only what your clip needs.'}</Text>
              {selectRow('Tag a Game (optional)', p.gameLabel, 'game')}
              <AccountTagField value={p.accountTags} onChange={p.onAccountTags} disabled={p.uploading} />
              {/* v1 photo stories are public only (design decision 1): Vault photos wait for the private bucket. */}
              {isPhotos ? null : <Pressable accessibilityRole="switch" accessibilityLabel={VAULT_BADGE_LABEL} accessibilityState={{ checked: p.isExclusive, disabled: p.uploading || !p.playerId }} disabled={p.uploading || !p.playerId} onPress={() => p.onExclusive(!p.isExclusive)} style={[styles.option, p.isExclusive && styles.selected]}>
                <View style={styles.sourceRow}><Text style={[styles.label, styles.flex]}>{VAULT_BADGE_LABEL}</Text><Text style={styles.link}>{p.isExclusive ? 'On' : 'Off'}</Text></View>
                <Text style={styles.hint}>{p.playerId ? `Off by default (free public feed). On: only fans with one-time Exclusive access ($${p.exclusiveDollars.toFixed(2)}) can watch.` : 'Tag an athlete before one-time Exclusive.'}</Text>
              </Pressable>}
            </>
          ) : (
            <>
              {isPhotos ? (
                <View style={styles.sourceRow}><Text style={[styles.hint, styles.flex]} numberOfLines={1}>Photo story · {photoCountLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel="Change photos" disabled={p.uploading} onPress={() => go('clip')} style={styles.smallButton}><Text style={styles.link}>Change</Text></Pressable></View>
              ) : (
                <View style={styles.sourceRow}><Text style={[styles.hint, styles.flex]} numberOfLines={1}>{p.asset?.fileName || 'Selected video'}{p.asset?.durationMs ? ` · ${Math.round(p.asset.durationMs / 1000)}s` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel="Change video" disabled={p.uploading} onPress={() => go('clip')} style={styles.smallButton}><Text style={styles.link}>Change</Text></Pressable></View>
              )}
              <View style={styles.summary}><Text style={styles.label} numberOfLines={2}>{p.caption}</Text><Text style={styles.hint}>{p.playerLabel} · {categoryLabel}</Text>
                <Text style={styles.hint}>{p.gameId ? p.gameLabel : 'No game linked'} · {p.accountTags.length ? `${p.accountTags.length} account mentions pending confirmation` : 'No account mentions'}</Text>
                <Text style={styles.link}>{isPhotos ? 'Public photo story' : p.isExclusive ? 'One-time Exclusive only' : 'Public Highlight'}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="More options" disabled={p.uploading} onPress={() => go('options')} style={styles.select}>
                <View style={styles.flex}><Text style={styles.label}>More options</Text><Text style={styles.hint}>{isPhotos ? 'Game, account mentions' : 'Game, account mentions, one-time Exclusive access'}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
              <View style={styles.field}><Text style={styles.label}>Before you publish</Text><Text style={styles.hint}>{COMPLIANCE_UPLOAD}</Text>
                {(() => {
                  const checks = rightsChecksFor(p.category, p.mediaKind);
                  const label = shareConfirmationLabel(p.category, p.mediaKind);
                  const checked = checks.every((row) => p.rights[row.id] === true);
                  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled: p.uploading }} disabled={p.uploading}
                    onPress={() => p.onRights(Object.fromEntries(checks.map((row) => [row.id, !checked])))} style={styles.rightsRow}>
                    <View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}</View>
                    <Text style={styles.rightsText}>{label}</Text>
                  </Pressable>;
                })()}
              </View>
              {p.uploadError ? <Text accessibilityRole="alert" style={styles.error}>{p.uploadError}</Text> : null}
            </>
          )}
        </ScrollView>
        {actionBar}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, width: '100%', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: 20 },
  menu: { width: '100%', maxWidth: 420, maxHeight: '100%', alignSelf: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12 },
  headerCopy: { flex: 1, alignItems: 'center', gap: 3 },
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { gap: 14, paddingBottom: 16 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  heroBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  spark: { position: 'absolute', right: -5, top: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  heroHint: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  source: { backgroundColor: colors.surface, borderRadius: MENU_METRICS.controlRadius, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', gap: 6, minHeight: 112 },
  selected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  clipCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius },
  thumb: { width: 52, height: 68, borderRadius: 8, backgroundColor: colors.photoPlaceholder },
  thumbMark: { alignItems: 'center', justifyContent: 'center' },
  smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  label: { fontSize: 14, fontWeight: '800', color: colors.text },
  hint: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  link: { fontSize: 12, lineHeight: 18, fontWeight: '800', color: colors.primary },
  field: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, paddingHorizontal: 12, backgroundColor: colors.surface, color: colors.text, fontSize: 15 },
  caption: { height: 86, paddingTop: 12, textAlignVertical: 'top' },
  counter: { fontSize: 11, textAlign: 'right', color: colors.textMuted, marginTop: -4 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface },
  selectText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  option: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface, gap: 5 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  categoryActive: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  categoryText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.textMuted },
  categoryTextActive: { color: colors.primary },
  summary: { gap: 6, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface },
  rightsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rightsText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  footer: { gap: 8, paddingTop: 8 },
  footerHint: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: colors.textMuted },
  submit: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.primary },
  submitText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: colors.glow },
});
