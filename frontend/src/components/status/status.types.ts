import type * as React from 'react';

export type StatusTone = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'blocked';
export type StatusSize = 'compact' | 'small';

export type StatusIconComponent = React.ElementType<{ fontSize?: 'inherit' | 'small' | 'medium' | 'large'; sx?: object }>;

export interface StatusIndicatorProps {
  icon: StatusIconComponent;
  label: string;
  ariaLabel?: string;
  tone?: StatusTone;
  shortText?: React.ReactNode;
  tooltip?: React.ReactNode;
  detail?: React.ReactNode;
  size?: StatusSize;
  unknown?: boolean;
  stopRowEvents?: boolean;
  testId?: string;
}

export interface StatusActionProps {
  icon: StatusIconComponent;
  label: string;
  ariaLabel?: string;
  tone?: StatusTone;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  menuId?: string;
  menuOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: React.ReactNode;
  showMenuAffordance?: boolean;
  size?: StatusSize;
  stopRowEvents?: boolean;
  testId?: string;
}

export interface StatusIndicatorItem {
  id: string;
  order?: number;
  indicator: React.ReactNode;
  detailLabel?: string;
  detailContent?: React.ReactNode;
}

export interface StatusIndicatorGroupProps {
  items: StatusIndicatorItem[];
  maxVisible?: number;
  spacing?: number;
  ariaLabel: string;
  overflowLabel?: (hiddenCount: number) => string;
  overflowTitle?: React.ReactNode;
  stopRowEvents?: boolean;
}
