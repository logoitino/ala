/**
 * Plain breakdowns for the Operations page. The page passes report rows and the live menu flags.
 * Ranking stays here so the tabs only display it.
 */
import { APP_RUNTIME_FLAG_GROUPS } from '@tapuai/shared-types';

export type OperationsTabId = 'where' | 'buttons' | 'errors' | 'menus';

export type OperationsBar = {
  label: string;
  value: number;
};

export type OperationsDetail = {
  label: string;
  value: string;
};

export type OperationsLens = {
  id: OperationsTabId;
  label: string;
  summary: string;
  bars: OperationsBar[];
  details: OperationsDetail[];
};

export type OperationsInput = {
  tabs: OperationsBar[];
  buttons: OperationsBar[];
  appErrors: OperationsBar[];
  portalErrors: string[];
  usage: Record<string, number>;
  reliability: Record<string, number>;
  published: Record<string, unknown>;
};

function ranked(rows: OperationsBar[]): OperationsBar[] {
  return [...rows].filter((row) => row.label.trim()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function topSentence(kind: string, rows: OperationsBar[], empty: string): string {
  const top = ranked(rows)[0];
  if (!top || top.value <= 0) return empty;
  return `${top.label} is ${kind}.`;
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function flagOn(published: Record<string, unknown>, path: string): boolean {
  const [root, key] = path.split('.');
  if (!root || !key) return true;
  const group = published[root];
  if (!isPlain(group)) return true;
  const value = group[key];
  return typeof value === 'boolean' ? value : true;
}

function detailsFromCounts(section: Record<string, number>): OperationsDetail[] {
  return Object.entries(section)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value: value.toLocaleString() }));
}

/**
 * @purpose Four operations lenses: where people are, which buttons they use, errors, and which menus are on.
 * @param input Report rows, portal read failures, and the published menu flags.
 * @returns Where, Buttons, Errors, and Menus, each with a one-line summary, bars, and the smaller rows.
 */
export function buildOperations(input: OperationsInput): OperationsLens[] {
  const tabs = ranked(input.tabs);
  const buttons = ranked(input.buttons);
  const appErrors = ranked(input.appErrors);
  const menuRows = APP_RUNTIME_FLAG_GROUPS.flatMap((group) =>
    group.flags.map((flag) => ({
      group: group.label,
      label: flag.label,
      hint: flag.hint,
      on: flagOn(input.published, flag.path),
    })),
  );
  const menusOn = menuRows.filter((row) => row.on).length;

  return [
    {
      id: 'where',
      label: 'Where',
      summary: topSentence('where people spend the most time', tabs, 'No tab time in this window.'),
      bars: tabs,
      details: detailsFromCounts(input.usage),
    },
    {
      id: 'buttons',
      label: 'Buttons',
      summary: topSentence('the button people use the most', buttons, 'No button taps in this window.'),
      bars: buttons,
      details: buttons.map((row) => ({ label: row.label, value: row.value.toLocaleString() })),
    },
    {
      id: 'errors',
      label: 'Errors',
      summary: input.portalErrors.length
        ? 'The portal could not load a read. App errors are listed under that.'
        : topSentence('the most reported app error', appErrors, 'No app errors in this window.'),
      bars: appErrors,
      details: [
        ...input.portalErrors.map((message) => ({ label: 'Portal', value: message })),
        ...appErrors.map((row) => ({ label: row.label, value: row.value.toLocaleString() })),
        ...detailsFromCounts(input.reliability),
      ],
    },
    {
      id: 'menus',
      label: 'Menus',
      summary: `${menusOn} of ${menuRows.length} menus are on. Changes are made in Expo admin, then this list updates.`,
      bars: APP_RUNTIME_FLAG_GROUPS.map((group) => ({
        label: group.label,
        value: group.flags.filter((flag) => flagOn(input.published, flag.path)).length,
      })),
      details: menuRows.map((row) => ({
        label: `${row.group} · ${row.label}`,
        value: row.on ? 'On' : 'Off',
      })),
    },
  ];
}
