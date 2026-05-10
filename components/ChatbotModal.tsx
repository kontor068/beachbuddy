import React, { useState } from 'react';
import { Translation } from '../types';

interface ChatbotModalProps {
    isOpen: boolean; onClose: () => void; t: Translation; messages: any[];
    onSend: (message: string) => void; isLoading: boolean;
    onNewChat: () => void; suggestions: string[];
}

export const ChatbotModal: React.FC<ChatbotModalProps> = ({ isOpen, onClose, t, messages, onSend, isLoading }) => {
    const [input, setInput] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[90]">
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg h-[95vh] sm:h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <header className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="font-bold dark:text-white">{t.chatTitle}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400">✕</button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white mr-auto max-w-[80%]">
                            {t.chatInitial}
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`p-3 rounded-xl ${m.sender === 'user' ? 'bg-cyan-600 text-white ml-auto' : 'bg-slate-100 dark:bg-slate-800 dark:text-white mr-auto'} max-w-[80%]`}>
                            {m.text}
                        </div>
                    ))}
                    {isLoading && <div className="text-slate-400 italic text-sm animate-pulse">Το Beach Buddy σκέφτεται...</div>}
                </div>
                <form className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t dark:border-slate-800 flex gap-2" onSubmit={(e) => { e.preventDefault(); if(input.trim()) { onSend(input); setInput(''); } }}>
                    <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-full px-4 py-3 outline-none text-sm" placeholder={t.chatPlaceholder} />
                    <button type="submit" className="bg-cyan-600 text-white px-5 py-3 rounded-full font-semibold text-sm active:scale-95 transition-transform">Send</button>
                </form>
            </div>
        </div>
    );
};
