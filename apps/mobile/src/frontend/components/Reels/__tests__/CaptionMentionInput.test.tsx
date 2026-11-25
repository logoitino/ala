/**
 * UPLOAD-STUDIO-01 @ tagging in the Highlight caption: suggestions appear only inside an @ word, a picked tag leaves
 * the caption text (so no name is public before confirmation), athletes set who is in the clip, accounts become at
 * most three removable mention chips, and a slow older search never shows under a newer word.
 */
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { activeMention, CaptionMentionInput, removeMention } from '@/components/Reels/CaptionMentionInput';
import type { AccountTagHit } from '@/lib/accountTags';
import type { Player } from '@/types/database';

const mockSearch = jest.fn();
jest.mock('@/lib/accountTags', () => ({ searchTaggableAccounts: (query: string) => mockSearch(query) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: jest.requireActual('react-native').Pressable }));

const players = [
  { id: 'p1', name: 'Ana Fifita', jersey_number: 7, school_name: 'Westlake' },
  { id: 'p2', name: 'Sione Vea', jersey_number: 12, school_name: 'Kahuku' },
] as Player[];

function Harness({ initialMentions = [] as AccountTagHit[], onAthlete = jest.fn() }) {
  const [caption, setCaption] = useState('');
  const [mentions, setMentions] = useState<AccountTagHit[]>(initialMentions);
  const [playerId, setPlayerId] = useState('');
  return (
    <CaptionMentionInput value={caption} onChange={setCaption} maxLength={120} placeholder="Say something" editable
      players={players} playerId={playerId} onPickAthlete={(id) => { setPlayerId(id); onAthlete(id); }}
      mentions={mentions} onMentions={setMentions} />
  );
}

const type = (text: string) => fireEvent.changeText(screen.getByLabelText('Highlight caption'), text);

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
  mockSearch.mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); });

describe('mention helpers', () => {
  it('finds only the @ word that ends at the caret', () => {
    expect(activeMention('Great play @si', 14)).toEqual({ start: 11, query: 'si' });
    expect(activeMention('@', 1)).toEqual({ start: 0, query: '' });
    expect(activeMention('email a@b', 9)).toBeNull();
    expect(activeMention('Great play @si done', 19)).toBeNull();
  });

  it('removes the word without leaving a double space', () => {
    expect(removeMention('Great @si play', 6, 9)).toEqual({ text: 'Great play', caret: 6 });
    expect(removeMention('@si', 0, 3)).toEqual({ text: '', caret: 0 });
  });
});

describe('CaptionMentionInput', () => {
  it('shows no suggestions until an @ word starts, then lists roster athletes', async () => {
    await render(<Harness />);
    await type('Big win');
    expect(screen.queryByLabelText(/^Tag athlete/)).toBeNull();
    await type('Big win @');
    expect(screen.getByLabelText('Tag athlete Ana Fifita')).toBeTruthy();
    expect(screen.getByLabelText('Tag athlete Sione Vea')).toBeTruthy();
  });

  it('tags an athlete as who is in the clip and keeps the name out of the caption', async () => {
    const onAthlete = jest.fn();
    await render(<Harness onAthlete={onAthlete} />);
    await type('Big win @an');
    await fireEvent.press(screen.getByLabelText('Tag athlete Ana Fifita'));
    expect(onAthlete).toHaveBeenCalledWith('p1');
    expect(screen.getByLabelText('Highlight caption').props.value).toBe('Big win ');
    expect(screen.queryByLabelText(/^Tag athlete/)).toBeNull();
  });

  it('mentions an account as a removable chip that waits for confirmation', async () => {
    mockSearch.mockResolvedValue([{ id: 'acct-1', label: 'Lani' }]);
    await render(<Harness />);
    await type('Shout out @la');
    await act(async () => { jest.advanceTimersByTime(260); });
    expect(mockSearch).toHaveBeenCalledWith('la');
    await fireEvent.press(screen.getByLabelText('Mention Lani'));
    expect(screen.getByLabelText('Highlight caption').props.value).toBe('Shout out ');
    expect(screen.getByText('@Lani')).toBeTruthy();
    expect(screen.getByText(/Mentions show after each person confirms/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remove mention Lani'));
    expect(screen.queryByText('@Lani')).toBeNull();
  });

  it('stops searching accounts once three are mentioned and says so', async () => {
    const three = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
    await render(<Harness initialMentions={three} />);
    await type('Team @zz');
    await act(async () => { jest.advanceTimersByTime(260); });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(screen.getByText('You can mention up to 3 accounts.')).toBeTruthy();
  });

  it('never shows an older search reply under a newer @ word', async () => {
    let resolveOld!: (rows: AccountTagHit[]) => void;
    mockSearch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    mockSearch.mockResolvedValueOnce([{ id: 'new', label: 'Keala' }]);
    await render(<Harness />);
    await type('Go @ka');
    await act(async () => { jest.advanceTimersByTime(260); });
    await type('Go @ke');
    await act(async () => { jest.advanceTimersByTime(260); });
    await act(async () => { resolveOld([{ id: 'old', label: 'Kawika' }]); });
    expect(screen.queryByLabelText('Mention Kawika')).toBeNull();
    expect(screen.getByLabelText('Mention Keala')).toBeTruthy();
  });
});
