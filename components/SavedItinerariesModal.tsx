import React, { useState, useEffect } from 'react';
import { SavedItinerary, LanguageCode } from '../types';
import ItineraryDisplay from './ItineraryDisplay';
import { ConfirmationModal } from './ConfirmationModal';

interface SavedItinerariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedItineraries: SavedItinerary[];
  onDelete: (id: string) => void;
  onUpdate: (itinerary: SavedItinerary) => void;
  t: any;
  language: LanguageCode;
}

const SavedItineraryItem: React.FC<{
  itinerary: SavedItinerary;
  onDelete: (id: string) => void;
  onUpdate: (itinerary: SavedItinerary) => void;
  t: any;
  language: LanguageCode;
}> = ({ itinerary, onDelete, onUpdate, t, language }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(itinerary.name);
  const [editedContent, setEditedContent] = useState(itinerary.content);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(t.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    if (!isEditing) {
      setEditedName(itinerary.name);
      setEditedContent(itinerary.content);
    }
  }, [itinerary, isEditing]);

  const handleShare = async () => {
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({
          text: t.savedItineraries.sharingText(itinerary.name),
          url: shareUrl,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing itinerary:', error);
        }
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (!isOpen) {
        setIsOpen(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedName(itinerary.name);
    setEditedContent(itinerary.content);
  };

  const handleSave = () => {
    onUpdate({
        ...itinerary,
        name: editedName.trim() || itinerary.name,
        content: editedContent.trim(),
    });
    setIsEditing(false);
  };
  
  const handleDeleteClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete(itinerary.id);
    setIsConfirmOpen(false);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      <h3 className="m-0 text-left">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-expanded={isOpen}
          aria-controls={`saved-itinerary-${itinerary.id}`}
        >
          <div className="flex-1 text-left">
            <p className="font-bold text-slate-800">{itinerary.name}</p>
            <p className="text-xs text-slate-500">{t.savedItineraries.savedOn(dateFmt.format(new Date(itinerary.createdAt)))}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </h3>
      <div
        id={`saved-itinerary-${itinerary.id}`}
        className={`transition-all duration-500 ease-in-out grid ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 border-t border-slate-200">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor={`edit-name-${itinerary.id}`} className="block text-sm font-bold text-slate-700 mb-1">{t.savedItineraries.editNameLabel}</label>
                  <input
                    id={`edit-name-${itinerary.id}`}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor={`edit-content-${itinerary.id}`} className="block text-sm font-bold text-slate-700 mb-1">{t.savedItineraries.editContentLabel}</label>
                  <textarea
                    id={`edit-content-${itinerary.id}`}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={15}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm leading-relaxed"
                  />
                </div>
              </div>
            ) : (
                <ItineraryDisplay content={itinerary.content} />
            )}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                {isEditing ? (
                    <>
                        <button
                            onClick={handleCancel}
                            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
                        >
                            {t.savedItineraries.cancelButton}
                        </button>
                        <button
                            onClick={handleSave}
                            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414L10 12.586l-1.293-1.293z" />
                            </svg>
                            {t.savedItineraries.saveChangesButton}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleEdit}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                            {t.savedItineraries.editButton}
                        </button>
                        {navigator.share && (
                            <button
                                onClick={handleShare}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                </svg>
                                {t.savedItineraries.shareButton}
                            </button>
                        )}
                        <button
                            onClick={handleDeleteClick}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {t.savedItineraries.deleteButton}
                        </button>
                    </>
                )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t.confirmation.deleteItineraryTitle}
        message={t.confirmation.deleteItineraryMessage}
        confirmButtonText={t.confirmation.confirmButton}
        cancelButtonText={t.confirmation.cancelButton}
        t={t}
      />
    </div>
  );
};


const SavedItinerariesModal: React.FC<SavedItinerariesModalProps> = ({ isOpen, onClose, savedItineraries, onDelete, onUpdate, t, language }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[90] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-itineraries-title"
    >
      <div
        className="bg-slate-50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
          <h2 id="saved-itineraries-title" className="text-xl font-bold text-slate-800">{t.savedItineraries.title}</h2>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full"
            aria-label={t.closeModalLabel}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="overflow-y-auto p-4 sm:p-6">
          {savedItineraries.length > 0 ? (
            <div className="space-y-3">
              {savedItineraries.map(itinerary => (
                <SavedItineraryItem
                  key={itinerary.id}
                  itinerary={itinerary}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  t={t}
                  language={language}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
               <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
               </svg>
              <h3 className="mt-2 text-lg font-semibold text-slate-800">{t.savedItineraries.noSavedPlans}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.savedItineraries.noSavedPlansDesc}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedItinerariesModal;