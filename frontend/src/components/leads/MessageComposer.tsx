import React from 'react';
import { TextField } from '@mui/material';
import { computeListContinuation } from '../../utils/messageListContinuation';

export interface MessageComposerProps {
  conversationId: string;
  initialDraft: string;
  clearSignal: number;
  disabled?: boolean;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDraftPersist: (conversationId: string, value: string) => void;
  onSend: (value: string) => void;
  valueRef?: React.MutableRefObject<string>;
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  maxRows: number;
  sx?: object;
}

/** Editor aislado: escribir aquí no actualiza el árbol del CRM. */
export function MessageComposer({
  conversationId,
  initialDraft,
  clearSignal,
  disabled,
  placeholder,
  inputRef,
  onDraftPersist,
  onSend,
  valueRef,
  onPaste,
  maxRows,
  sx,
}: MessageComposerProps) {
  const [value, setValue] = React.useState(initialDraft);
  const valueStateRef = React.useRef(value);
  const conversationRef = React.useRef(conversationId);
  const clearSignalRef = React.useRef(clearSignal);

  const persist = React.useCallback(() => {
    onDraftPersist(conversationRef.current, valueStateRef.current);
  }, [onDraftPersist]);

  React.useEffect(() => {
    if (conversationRef.current !== conversationId) {
      persist();
      conversationRef.current = conversationId;
      valueStateRef.current = initialDraft;
      setValue(initialDraft);
    }
  }, [conversationId, initialDraft, persist]);

  React.useEffect(() => {
    if (clearSignalRef.current === clearSignal) return;
    clearSignalRef.current = clearSignal;
    valueStateRef.current = '';
    setValue('');
  }, [clearSignal]);

  React.useEffect(() => () => persist(), [persist]);

  const updateValue = (next: string) => {
    valueStateRef.current = next;
    setValue(next);
  };

  React.useEffect(() => {
    if (valueRef) valueRef.current = value;
  }, [value, valueRef]);

  return (
    <TextField
      fullWidth
      size="small"
      multiline
      minRows={1}
      maxRows={maxRows}
      placeholder={placeholder}
      value={value}
      onChange={(event) => updateValue(event.target.value)}
      onPaste={onPaste}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if (!disabled) onSend(valueStateRef.current);
          return;
        }
        if (event.key === 'Enter' && event.shiftKey) {
          const element = inputRef.current;
          if (!element) return;
          const result = computeListContinuation(
            valueStateRef.current,
            element.selectionStart ?? valueStateRef.current.length,
            element.selectionEnd ?? valueStateRef.current.length,
          );
          if (!result) return;
          event.preventDefault();
          updateValue(result.text);
          requestAnimationFrame(() => {
            element.selectionStart = result.cursorPos;
            element.selectionEnd = result.cursorPos;
          });
        }
      }}
      inputRef={inputRef}
      sx={sx}
    />
  );
}
