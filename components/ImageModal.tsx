import React, { useEffect } from 'react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
  t: any;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose, t }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (imageUrl) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.imageModalLabel || 'Image viewer'}
    >
      <div className="relative p-4 w-full max-w-4xl max-h-full">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors z-10"
          aria-label={t.closeModalLabel || 'Close'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={imageUrl}
          alt={t.beachImageAlt || 'Beach image'}
          className="w-full h-auto object-contain max-h-[90vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image itself
        />
      </div>
    </div>
  );
};

export default ImageModal;
