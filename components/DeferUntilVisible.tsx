import React from 'react';

interface DeferUntilVisibleProps {
  /** Rendered once the placeholder comes within `rootMargin` of the viewport. */
  children: React.ReactNode;
  /** Shown until then. Must reserve the same height, or the page jumps when it swaps. */
  placeholder: React.ReactNode;
  /** How early to start. 600px ≈ one and a half phone screens of warning. */
  rootMargin?: string;
  className?: string;
}

/**
 * DON'T LOAD IT UNTIL IT IS NEARLY ON SCREEN.
 *
 * Written for the map on a beach page (05/08/2026). That map sits about 2.000 px down a
 * 4.500 px page — a reader has to scroll past the conditions, the photo and the beach's
 * story to reach it — yet it mounted the moment the page did. Measured on a real phone:
 * six OpenStreetMap tile requests plus the map chunk, every single visit, whether or not
 * anyone ever scrolled that far. `React.lazy` alone does not help here: the chunk is
 * separate, but <Suspense> asks for it immediately.
 *
 * Deliberately NOT applied to anything above the fold. Deferring something the reader is
 * already looking at just makes it appear late.
 *
 * Falls back to rendering children immediately where IntersectionObserver is missing (and
 * during SSR/prerender), because "no observer" must never mean "no map".
 */
export const DeferUntilVisible: React.FC<DeferUntilVisibleProps> = ({
  children,
  placeholder,
  rootMargin = '600px',
  className,
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = React.useState(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined',
  );

  React.useEffect(() => {
    if (shown) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShown(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {shown ? children : placeholder}
    </div>
  );
};
