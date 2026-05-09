
import React from 'react';

interface GoToTopButtonProps {
  isVisible: boolean;
  onClick: () => void;
}

const GoToTopButton: React.FC<GoToTopButtonProps> = ({ isVisible, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-5 left-5 z-50 p-3 bg-cyan-500 text-white rounded-full shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-300 ease-in-out transform ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
      }`}
      aria-label="Go to top"
      title="Go to top"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};

export default GoToTopButton;