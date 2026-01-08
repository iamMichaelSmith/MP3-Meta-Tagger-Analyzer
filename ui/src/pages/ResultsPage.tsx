import React, { useEffect, useState } from 'react';
import { Search, Music, Save, Copy, Check } from 'lucide-react';
import { api, type Track } from '../api/client';
import { cn } from '../lib/utils';

const ResultsPage = () => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [editingTrack, setEditingTrack] = useState<Track | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [showCopied, setShowCopied] = useState(false);

    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        try {
            const data = await api.getTracks();
            setTracks(data);
            if (data.length > 0 && !selectedId) {
                selectTrack(data[0]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const selectTrack = (track: Track) => {
        setSelectedId(track.id);
        setEditingTrack(JSON.parse(JSON.stringify(track))); // deep copy
        setHasChanges(false);
    };

    const selectedTrack = tracks.find(t => t.id === selectedId);

    const handleSave = async () => {
        if (!editingTrack) return;
        try {
            const updated = await api.updateEdits(editingTrack.id, editingTrack.edits || {});
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingTrack(updated);
            setHasChanges(false);
        } catch (e) {
            console.error(e);
        }
    };

    const copyForDisco = () => {
        if (!editingTrack) return;

        // Format: "BPM: 120 - Key: Am - Genres: Trap, Dark - Moods: Aggressive"
        const edits = editingTrack.edits || {};
        const bpm = edits.bpm || editingTrack.final_bpm || editingTrack.analysis?.bpm || 0;
        const key = edits.key || editingTrack.final_key || editingTrack.analysis?.key_key || '';
        const genres = (edits.genres?.length ? edits.genres : editingTrack.suggested_genres) || [];
        const moods = (edits.moods?.length ? edits.moods : editingTrack.suggested_moods) || [];

        const text = `BPM: ${Math.round(bpm)} | Key: ${key} | Genres: ${genres.join(', ')} | Moods: ${moods.join(', ')}`;
        navigator.clipboard.writeText(text);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const filteredTracks = tracks.filter(t => t.filename.toLowerCase().includes(filter.toLowerCase()));

    // Render helpers
    const renderTagInput = (field: 'genres' | 'moods', label: string) => {
        if (!editingTrack) return null;
        const currentTags = editingTrack.edits?.[field] || [];
        // If edits are empty, falling back to suggestions is tricky in edit mode.
        // We start with suggestions pre-filled if edits are empty? 
        // Simplified: We show what's in edits. If empty, user can add. 
        // But initially edits are empty. We should populate from suggestions if requested.

        return (
            <div className="mb-4">
                <label className="block text-sm font-medium text-stone-400 mb-2 uppercase tracking-wider">{label}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {currentTags.map((tag: string, i: number) => (
                        <span key={i} className="bg-brown-light text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
                            {tag}
                            <button onClick={() => {
                                const newTags = currentTags.filter((_: string, idx: number) => idx !== i);
                                setEditingTrack({
                                    ...editingTrack,
                                    edits: { ...editingTrack.edits, [field]: newTags }
                                });
                                setHasChanges(true);
                            }} className="hover:text-red-300"><span className="sr-only">Remove</span>×</button>
                        </span>
                    ))}
                    <input
                        type="text"
                        className="bg-transparent border border-stone-700 rounded px-2 py-1 text-sm focus:border-gold outline-none min-w-[100px]"
                        placeholder="Add + Enter"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val && !currentTags.includes(val)) {
                                    setEditingTrack({
                                        ...editingTrack,
                                        edits: { ...editingTrack.edits, [field]: [...currentTags, val] }
                                    });
                                    setHasChanges(true);
                                    e.currentTarget.value = '';
                                }
                            }
                        }}
                    />
                </div>
                {/* Suppliers */}
                <div className="text-xs text-stone-500">
                    Suggestions: {editingTrack[`suggested_${field}`]?.map(t => (
                        <button key={t} onClick={() => {
                            if (!currentTags.includes(t)) {
                                setEditingTrack({
                                    ...editingTrack,
                                    edits: { ...editingTrack.edits, [field]: [...currentTags, t] }
                                });
                                setHasChanges(true);
                            }
                        }} className="mr-2 hover:text-gold cursor-pointer border border-stone-800 rounded px-1 mb-1 inline-block">+ {t}</button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full gap-6">
            {/* List Panel */}
            <div className="w-1/3 flex flex-col bg-black/20 rounded-xl border border-stone-800/50 backdrop-blur-sm">
                <div className="p-4 border-b border-stone-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-stone-500" size={18} />
                        <input
                            type="text"
                            placeholder="Filter tracks..."
                            className="w-full bg-background border border-stone-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-gold outline-none"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredTracks.map(track => (
                        <div
                            key={track.id}
                            onClick={() => selectTrack(track)}
                            className={cn(
                                "p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-colors",
                                selectedId === track.id ? "bg-green/20 border border-green/30" : "hover:bg-white/5 border border-transparent"
                            )}
                        >
                            <div className="w-8 h-8 rounded bg-stone-800 flex items-center justify-center text-stone-500">
                                <Music size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className={cn("text-sm font-medium truncate", selectedId === track.id ? "text-gold" : "text-white")}>
                                    {track.filename}
                                </p>
                                <p className="text-xs text-stone-500">
                                    {Math.round(track.final_bpm || 0)} BPM • {track.final_key || '-'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Panel */}
            <div className="flex-1 bg-gradient-to-br from-stone-900/50 to-black/50 rounded-xl border border-stone-800/50 p-6 overflow-y-auto">
                {editingTrack ? (
                    <div className="space-y-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-white break-all">{editingTrack.filename}</h2>
                                <span className="text-xs font-mono text-stone-500">{editingTrack.id}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={copyForDisco}
                                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {showCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    {showCopied ? 'Copied' : 'Copy Data'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                        hasChanges ? "bg-gold text-black hover:bg-gold-hover" : "bg-stone-800 text-stone-500 cursor-not-allowed"
                                    )}
                                >
                                    <Save size={16} />
                                    Save Changes
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-stone-400">BPM</label>
                                <input
                                    type="number"
                                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 focus:border-gold outline-none"
                                    value={editingTrack.edits?.bpm || editingTrack.final_bpm || ''}
                                    onChange={(e) => {
                                        setEditingTrack({
                                            ...editingTrack,
                                            edits: { ...editingTrack.edits, bpm: parseFloat(e.target.value) }
                                        });
                                        setHasChanges(true);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-stone-400">Key</label>
                                <input
                                    type="text"
                                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 focus:border-gold outline-none"
                                    value={editingTrack.edits?.key || editingTrack.final_key || ''}
                                    onChange={(e) => {
                                        setEditingTrack({
                                            ...editingTrack,
                                            edits: { ...editingTrack.edits, key: e.target.value }
                                        });
                                        setHasChanges(true);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Analysis Visualizations */}
                        {editingTrack.analysis?.model_tags && (
                            <div className="space-y-4 pt-4 border-t border-stone-800">
                                <h3 className="text-sm font-medium text-stone-400 uppercase tracking-wider">AI Analysis Data</h3>

                                {/* Audio Features Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-900/40 p-3 rounded-lg border border-stone-800/50">
                                    {[
                                        ['Energy', Math.round((editingTrack.analysis.energy || 0)) + '/10'],
                                        ['Danceability', Math.round((editingTrack.analysis.danceability || 0) * 100) + '%'],
                                    ].map(([label, value]) => (
                                        <div key={label as string} className="flex flex-col">
                                            <span className="text-[10px] text-stone-500 uppercase">{label}</span>
                                            <span className="text-sm font-medium text-stone-300">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Instruments */}
                                {editingTrack.analysis?.model_tags?.instruments && (
                                    <div className="space-y-2">
                                        <div className="text-xs text-stone-500 uppercase">Detected Instruments</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(editingTrack.analysis.model_tags.instruments)
                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                .map(([inst, conf]) => (
                                                    <span key={inst} className="px-2 py-1 bg-blue-900/20 border border-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1.5" title={`${Math.round((conf as number) * 100)}%`}>
                                                        {inst}
                                                        <div className="w-1 h-3 bg-blue-500/20 rounded-full overflow-hidden">
                                                            <div className="bg-blue-400 w-full" style={{ height: `${(conf as number) * 100}%` }} />
                                                        </div>
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI Moods */}
                                {editingTrack.analysis?.model_tags?.ai_moods && (
                                    <div className="space-y-2">
                                        <div className="text-xs text-stone-500 uppercase">AI Moods</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(editingTrack.analysis.model_tags.ai_moods)
                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                .map(([mood, conf]) => (
                                                    <span key={mood} className="px-2 py-1 bg-purple-900/20 border border-purple-500/20 text-purple-300 rounded text-xs flex items-center gap-1.5">
                                                        {mood}
                                                        <div className="w-1 h-3 bg-purple-500/20 rounded-full overflow-hidden">
                                                            <div className="bg-purple-400 w-full" style={{ height: `${(conf as number) * 100}%` }} />
                                                        </div>
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-6">
                            {renderTagInput('genres', 'Genres')}
                            {renderTagInput('moods', 'Moods')}


                            <div>
                                <label className="block text-sm font-medium text-stone-400 mb-2 uppercase tracking-wider">Notes / Description</label>
                                <textarea
                                    className="w-full h-24 bg-stone-950 border border-stone-800 rounded-lg p-3 text-sm focus:border-gold outline-none resize-none"
                                    placeholder="Add keywords or description..."
                                    value={editingTrack.edits?.notes || ''}
                                    onChange={(e) => {
                                        setEditingTrack({
                                            ...editingTrack,
                                            edits: { ...editingTrack.edits, notes: e.target.value }
                                        });
                                        setHasChanges(true);
                                    }}
                                />
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-stone-500">
                        <Music size={48} className="mb-4 opacity-50" />
                        <p>Select a track to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsPage;
