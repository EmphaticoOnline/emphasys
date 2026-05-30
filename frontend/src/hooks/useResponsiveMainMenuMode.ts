import * as React from 'react';

type UseResponsiveMainMenuModeOptions = {
  availableRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  enterCompactPx?: number;
  exitCompactPx?: number;
};

export function useResponsiveMainMenuMode({
  availableRef,
  contentRef,
  enterCompactPx = 24,
  exitCompactPx = 48,
}: UseResponsiveMainMenuModeOptions) {
  const [useCompactNavigation, setUseCompactNavigation] = React.useState(false);
  const useCompactNavigationRef = React.useRef(useCompactNavigation);

  React.useEffect(() => {
    useCompactNavigationRef.current = useCompactNavigation;
  }, [useCompactNavigation]);

  React.useLayoutEffect(() => {
    const availableElement = availableRef.current;
    const contentElement = contentRef.current;

    if (!availableElement || !contentElement) {
      return;
    }

    const updateMode = () => {
      const availableWidth = availableElement.getBoundingClientRect().width;
      const contentWidth = contentElement.getBoundingClientRect().width;

      if (!availableWidth || !contentWidth) {
        return;
      }

      const currentCompact = useCompactNavigationRef.current;
      const enterCompactLimit = availableWidth - enterCompactPx;
      const exitCompactLimit = availableWidth - exitCompactPx;

      const nextCompactNavigation = currentCompact
        ? contentWidth > exitCompactLimit
        : contentWidth > enterCompactLimit;

      setUseCompactNavigation((current) => (current === nextCompactNavigation ? current : nextCompactNavigation));
    };

    updateMode();

    const observer = new ResizeObserver(() => {
      updateMode();
    });

    observer.observe(availableElement);
    observer.observe(contentElement);

    return () => {
      observer.disconnect();
    };
  }, [availableRef, contentRef, enterCompactPx, exitCompactPx]);

  return useCompactNavigation;
}