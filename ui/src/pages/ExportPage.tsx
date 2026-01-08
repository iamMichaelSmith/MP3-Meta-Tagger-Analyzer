import React, { useEffect, useState } from 'react';
import { Download, CheckSquare, Square, FileOutput } from 'lucide-react';
import { api, type Track } from '../api/client';
import { cn } from '../lib/utils';

const ExportPage = () => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        try {
            const data = await api.getTracks();
            setTracks(data);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === tracks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(tracks.map(t => t.id)));
        }
    };

    const handleExport = () => {
        if (selectedIds.size === 0) return;
        api.exportCsv(Array.from(selectedIds));
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Export Metadata</h2>
                    <p className="text-stone-400 mt-1">Select tracks to export as CSV for DISCO.AC</p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={selectedIds.size === 0}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition-all shadow-xl",
                        selectedIds.size > 0
                            ? "bg-gold text-black hover:bg-gold-hover hover:scale-105"
                            : "bg-stone-800 text-stone-500 cursor-not-allowed"
                    )}
                >
                    <FileOutput size={24} />
                    Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                <div className="flex items-center p-4 border-b border-stone-800 bg-black/20 text-stone-400 font-medium text-sm">
                    <div className="w-12 flex justify-center">
                        <button onClick={toggleAll} className="hover:text-gold">
                            {tracks.length > 0 && selectedIds.size === tracks.length ? <CheckSquare size={20} className="text-gold" /> : <Square size={20} />}
                        </button>
                    </div>
                    <div className="flex-1 px-4">Filename</div>
                    <div className="w-24 text-center">BPM</div>
                    <div className="w-24 text-center">Key</div>
                    <div className="w-1/3 px-4">Tags (Genre/Mood)</div>
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-stone-800/50">
                    {tracks.map(track => {
                        const isSelected = selectedIds.has(track.id);
                        const tags = [
                            ...(track.edits?.genres || track.suggested_genres || []),
                            ...(track.edits?.moods || track.suggested_moods || [])
                        ].slice(0, 5).join(', ');

                        return (
                            <div
                                key={track.id}
                                className={cn(
                                    "flex items-center p-4 transition-colors hover:bg-white/5",
                                    isSelected && "bg-green/10"
                                )}
                                onClick={() => toggleSelect(track.id)}
                            >
                                <div className="w-12 flex justify-center">
                                    {isSelected ? <CheckSquare size={20} className="text-gold" /> : <Square size={20} className="text-stone-600" />}
                                </div>
                                <div className="flex-1 px-4 min-w-0 font-medium text-white truncate">{track.filename}</div>
                                <div className="w-24 text-center text-stone-400">{Math.round(track.final_bpm || 0)}</div>
                                <div className="w-24 text-center text-stone-400">{track.final_key || '-'}</div>
                                <div className="w-1/3 px-4 text-stone-500 text-sm truncate">{tags}</div>
                            </div>
                        );
                    })}
                    {tracks.length === 0 && (
                        <div className="p-8 text-center text-stone-500">No tracks to export. Upload some files first.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExportPage;
