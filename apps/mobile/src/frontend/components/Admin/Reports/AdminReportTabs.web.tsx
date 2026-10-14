/** Web report tabs follow the keyboard tab pattern: one tab stop, arrow/Home/End selection and
 * an explicitly controlled panel. Native uses its own accessibility-selected Pressables. */
import { useRef } from 'react';
import type { AdminReportTabsProps } from './AdminReportTabs';
import { REPORT_FONT, REPORT_INK as c } from './reportStyles';
/** @purpose Roving keyboard selection for the Health report's four lenses. */
export function AdminReportTabs({ tabs, selected, onSelect, scope = 'health' }: AdminReportTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="tablist" aria-label={scope === 'coverage' ? 'Control map surfaces' : scope === 'health' ? 'Health report views' : 'Analytics boards'} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, minWidth: 0, maxWidth: '100%' }}>
    {tabs.map((tab, at) => <button key={tab.id} ref={node => { buttons.current[at] = node; }} id={`${scope}-tab-${tab.id}`} role="tab" type="button"
      aria-selected={selected === tab.id} aria-controls={`${scope}-panel`} tabIndex={selected === tab.id ? 0 : -1} onClick={() => onSelect(tab.id)}
      onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (at + 1) % tabs.length : event.key === 'ArrowLeft' ? (at + tabs.length - 1) % tabs.length : null;
        if (next == null) return; event.preventDefault(); onSelect(tabs[next].id); buttons.current[next]?.focus();
      }} style={{ minHeight: 44, minWidth: 44, padding: '10px 12px', fontFamily: REPORT_FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer', background: 'transparent', border: 0, borderBottom: `2px solid ${selected === tab.id ? c.jade : 'transparent'}`, color: selected === tab.id ? c.jade : c.soft }}>{tab.label}</button>)}
  </div>;
}
