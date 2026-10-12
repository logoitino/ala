/**
 * Admin portal chart kit (ADM-01a). Inline SVG and HTML only, no chart library. Every component
 * is Server-Component safe and takes data through props. Built by DESIGN; owned by PORTAL after
 * Phase A. Pages import from here (`@/components/charts`). Prop changes go to PORTAL via ADMIN.
 */
export type { ChartColor, ChartFormat, ChartPoint } from './shared';
export { chartColor } from './shared';
export { ChartFrame, type ChartFrameProps, type ChartTable } from './ChartFrame';
export { StatTile, type StatTileProps, type StatTone } from './StatTile';
export { Sparkline } from './Sparkline';
export { TrendChart, type TrendChartProps, type TrendVariant } from './TrendChart';
export { HBarList, type HBarListProps } from './HBarList';
export { SplitBar, type SplitBarProps, type SplitPart } from './SplitBar';
export { SplitRing, type SplitRingProps } from './SplitRing';
export { StackedBars, type StackedBarsProps, type StackRow, type StackSeries } from './StackedBars';
export { CompareBars, type CompareBarsProps, type CompareSide } from './CompareBars';
export { HeatStrip, type HeatRow, type HeatStripProps } from './HeatStrip';
export { Meter, type MeterProps } from './Meter';
