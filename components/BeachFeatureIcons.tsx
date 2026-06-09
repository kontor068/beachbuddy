import React from 'react';

type BeachFeatureIconProps = {
  className?: string;
  size?: number;
};

export const SandDotsIcon: React.FC<BeachFeatureIconProps> = ({ className, size = 20 }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 18h16" />
    <circle cx="7" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const SandPebblesIcon: React.FC<BeachFeatureIconProps> = ({ className, size = 20 }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 18h16" />
    <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M8 15.5c0-1.1.9-2 2-2h.5c1.1 0 2 .9 2 2s-.9 2-2 2H10c-1.1 0-2-.9-2-2Z" />
    <path d="M14.5 16c0-1 .8-1.8 1.8-1.8h.4c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8h-.4c-1 0-1.8-.8-1.8-1.8Z" />
  </svg>
);

export const SunbedIcon: React.FC<BeachFeatureIconProps> = ({ className, size = 20 }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 17h16" />
    <path d="M6 17l2 4" />
    <path d="M18 17l-2 4" />
    <path d="M5 13h7l5 4" />
    <path d="M5 13l2-6" />
    <path d="M9 7h5" />
  </svg>
);
