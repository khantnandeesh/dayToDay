import { useState, useEffect, useRef } from 'react';
import { X, Check, Save, StickyNote, ChevronUp, ChevronDown } from 'lucide-react';

const StickyNotes = () => {
    const [notes, setNotes] = useState(() => {
        const saved = localStorage.getItem('daytoday_notes');
        return saved ? JSON.parse(saved) : [];
    });
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('daytoday_notes', JSON.stringify(notes));
    }, [notes]);

    const addNote = () => {
        const newNote = {
            id: Date.now(),
            text: '',
            color: 'bg-yellow-100', // Classic yellow
            date: new Date().toLocaleDateString()
        };
        setNotes([newNote, ...notes]);
    };

    const updateNote = (id, text) => {
        setNotes(notes.map(note => note.id === id ? { ...note, text } : note));
    };

    const deleteNote = (id) => {
        setNotes(notes.filter(note => note.id !== id));
    };

    return (
        <div className={`fixed bottom-0 right-8 w-80 transition-transform duration-300 z-40 ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'}`}>
            {/* Header / Toggle */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white border border-slate-200 border-b-0 p-3 rounded-t-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] cursor-pointer flex items-center justify-between hover:bg-slate-50 transition group"
            >
                <div className="font-semibold flex items-center gap-2 text-slate-700">
                    <StickyNote className="w-5 h-5 text-blue-600" />
                    <span>Quick Notes</span>
                    {notes.length > 0 && (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                            {notes.length}
                        </span>
                    )}
                </div>
                <div className="text-slate-400 group-hover:text-slate-600 transition">
                    {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </div>
            </div>

            {/* Notes Area */}
            <div className="bg-slate-100 border-x border-slate-200 h-96 overflow-y-auto p-4 space-y-3 custom-scrollbar shadow-2xl">

                {/* Add New Button */}
                <button
                    onClick={addNote}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-slate-400 hover:text-slate-600 font-medium transition flex items-center justify-center gap-2"
                >
                    + New Note
                </button>

                {notes.length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-8 italic">
                        No active notes.
                    </div>
                )}

                {notes.map(note => (
                    <div key={note.id} className={`${note.color} p-3 rounded-lg shadow-sm border border-yellow-200 group relative transition hover:shadow-md animate-fadeIn`}>
                        <textarea
                            value={note.text}
                            onChange={(e) => updateNote(note.id, e.target.value)}
                            placeholder="Type something..."
                            className="bg-transparent w-full h-24 resize-none outline-none text-slate-700 placeholder-slate-400/70 text-sm leading-relaxed"
                        />
                        <div className="flex justify-between items-center mt-2 border-t border-black/5 pt-2">
                            <span className="text-[10px] text-slate-400 font-mono">{note.date}</span>
                            <button
                                onClick={() => deleteNote(note.id)}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StickyNotes;
