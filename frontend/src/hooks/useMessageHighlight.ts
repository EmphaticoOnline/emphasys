import React from 'react';

// Compartido entre LeadsDesktopView y LeadsMobileView: al tocar/hacer click
// en la cita de un mensaje respondido, hace scroll suave hasta el mensaje
// original (localizado dentro de containerRef vía [data-message-id]) y lo
// resalta ~2s. Si el mensaje citado no está cargado en el DOM (p. ej. no se
// ha paginado hacia atrás lo suficiente), querySelector devuelve null y no
// se hace nada — no rompe nada, simplemente no hay scroll.
export function useMessageHighlight(containerRef: React.RefObject<HTMLElement | null>) {
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const scrollToMessage = React.useCallback((messageId: string) => {
    const container = containerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHighlightedMessageId(messageId);
    timeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      timeoutRef.current = null;
    }, 2000);
  }, [containerRef]);

  return { highlightedMessageId, scrollToMessage };
}
