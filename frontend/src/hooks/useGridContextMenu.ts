import * as React from 'react';

export type GridContextMenuPosition = {
  top: number;
  left: number;
};

type UseGridContextMenuOptions<TRow> = {
  enabled?: boolean;
  getRowId?: (row: TRow) => string | number;
  onOpen?: (row: TRow) => void;
  onClose?: () => void;
};

type UseGridContextMenuResult<TRow> = {
  contextMenuRow: TRow | null;
  anchorPosition: GridContextMenuPosition | null;
  closeContextMenu: () => void;
  openContextMenuForRow: (event: React.MouseEvent<HTMLElement>, row: TRow) => void;
  rowSlotProps:
    | {
        onContextMenuCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
      }
    | undefined;
};

export function useGridContextMenu<TRow>(
  rows: readonly TRow[],
  options: UseGridContextMenuOptions<TRow> = {}
): UseGridContextMenuResult<TRow> {
  const { enabled = true, getRowId = (row: TRow) => (row as { id: string | number }).id, onOpen, onClose } = options;
  const [contextMenuRow, setContextMenuRow] = React.useState<TRow | null>(null);
  const [anchorPosition, setAnchorPosition] = React.useState<GridContextMenuPosition | null>(null);

  const rowMap = React.useMemo(() => {
    const nextMap = new Map<string, TRow>();
    rows.forEach((row) => {
      nextMap.set(String(getRowId(row)), row);
    });
    return nextMap;
  }, [getRowId, rows]);

  const closeContextMenu = React.useCallback(() => {
    setContextMenuRow(null);
    setAnchorPosition(null);
    onClose?.();
  }, [onClose]);

  const openContextMenuForRow = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, row: TRow) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuRow(row);
      setAnchorPosition({
        top: event.clientY - 6,
        left: event.clientX + 2,
      });
      onOpen?.(row);
    },
    [onOpen]
  );

  const handleRowContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;

      const rowId = event.currentTarget.getAttribute('data-id');
      if (!rowId) return;

      const row = rowMap.get(rowId);
      if (!row) return;

      openContextMenuForRow(event, row);
    },
    [enabled, openContextMenuForRow, rowMap]
  );

  return {
    contextMenuRow,
    anchorPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps: enabled
      ? {
          onContextMenuCapture: handleRowContextMenu,
        }
      : undefined,
  };
}