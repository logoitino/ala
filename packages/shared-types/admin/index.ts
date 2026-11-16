/** ADM-02: platform-neutral report contracts and chart specifications, without an application client. */
export * from './reports';
export type { WeekTone, WeekChange, DashboardInput, HomeKpiId, HomeKpi } from './dashboard';
export { isMeasured, readKey, formatMs, formatCompactCount, formatCompactUsd, weekChange, weekSentence, activeDays, tapsPerOpen, sharePercent, UNMEASURED, homeKpis, teamTrends } from './dashboard';
export * from './analytics';
export * from './departments';
export * from './operations';
export * from './chartScale';
export * from './measureColors';
export * from './eventLabels';
export * from './revenueModel';
export * from './expoDeskDirectory';
