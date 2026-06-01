const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const getPageScrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? 'auto' : 'smooth';

export const scrollToPageTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: getPageScrollBehavior(),
  });
};

export const scrollElementIntoView = (element: HTMLElement | null) => {
  element?.scrollIntoView({
    behavior: getPageScrollBehavior(),
    block: 'start',
    inline: 'nearest',
  });
};
