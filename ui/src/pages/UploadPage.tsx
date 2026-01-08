import React, { useState, useCallback } from 'react';
import { Upload, X, FileAudio, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../api/client';

interface FileItem {
    id: string; // temp id
    file: File;
    status: 'pending' | 'uploading' | 'analyzing' | 'complete' | 'error';
    progress: number;
    errorMessage?: string;
    trackId?: string; // Backend track ID for polling
    trackData?: any; // Full track data after analysis
}

const UploadPage = () => {
    const [queue, setQueue] = useState<FileItem[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    const startUpload = async (fileItem: FileItem) => {
        setQueue(prev => prev.map(item =>
            item.id === fileItem.id ? { ...item, status: 'uploading' } : item
        ));

        try {
            const uploadedTrack = await api.uploadFile(fileItem.file, (progress) => {
                setQueue(prev => prev.map(item =>
                    item.id === fileItem.id ? { ...item, progress } : item
                ));
            });

            // Start polling for analysis status
            setQueue(prev => prev.map(item =>
                item.id === fileItem.id ? { ...item, status: 'analyzing', progress: 100, trackId: uploadedTrack.id } : item
            ));

            // Poll every 2 seconds until analysis is complete
            pollTrackStatus(fileItem.id, uploadedTrack.id);

        } catch (error: any) {
            console.error("Upload error:", error);
            const msg = error.response?.data?.detail || error.message || "Upload Failed";

            setQueue(prev => prev.map(item =>
                item.id === fileItem.id ? { ...item, status: 'error', progress: 0, errorMessage: msg } : item
            ));
        }
    };

    const pollTrackStatus = async (fileItemId: string, trackId: string) => {
        try {
            const track = await api.getTrack(trackId);

            if (track.status === 'complete') {
                setQueue(prev => prev.map(item =>
                    item.id === fileItemId ? { ...item, status: 'complete', progress: 100, trackData: track } : item
                ));
            } else if (track.status === 'failed') {
                setQueue(prev => prev.map(item =>
                    item.id === fileItemId ? { ...item, status: 'error', errorMessage: 'Analysis failed' } : item
                ));
            } else {
                // Still analyzing, poll again in 2 seconds
                setTimeout(() => pollTrackStatus(fileItemId, trackId), 2000);
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const incomingFiles = Array.from(e.dataTransfer.files)
                .filter(f => f.name.toLowerCase().endsWith('.mp3'));

            // Filter duplicates
            const uniqueFiles = incomingFiles.filter(f =>
                !queue.some(q => q.file.name === f.name && q.file.size === f.size)
            );

            if (uniqueFiles.length === 0) return;

            const newFiles = uniqueFiles.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                file: f,
                status: 'pending' as const,
                progress: 0
            }));

            setQueue(prev => [...prev, ...newFiles]);
            newFiles.forEach(file => startUpload(file));
        }
    }, [queue]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const removeFile = (id: string) => {
        setQueue(prev => prev.filter(f => f.id !== id));
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white tracking-tight">Upload Tracks</h2>
                <span className="text-stone-400 text-sm">Supported format: MP3</span>
            </div>

            {/* Drop Zone */}
            <div className="relative">
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer relative",
                        isDragOver
                            ? "border-gold bg-gold/5 scale-[1.01]"
                            : "border-stone-700 bg-black/20 hover:border-stone-500 hover:bg-black/30"
                    )}
                >
                    <input
                        type="file"
                        multiple
                        accept=".mp3"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => {
                            if (e.target.files?.length) {
                                const incomingFiles = Array.from(e.target.files)
                                    .filter(f => f.name.toLowerCase().endsWith('.mp3'));

                                // Filter duplicates
                                const uniqueFiles = incomingFiles.filter(f =>
                                    !queue.some(q => q.file.name === f.name && q.file.size === f.size)
                                );

                                if (uniqueFiles.length > 0) {
                                    const newFiles = uniqueFiles.map(f => ({
                                        id: Math.random().toString(36).substr(2, 9),
                                        file: f,
                                        status: 'pending' as const,
                                        progress: 0
                                    }));
                                    setQueue(prev => [...prev, ...newFiles]);
                                    newFiles.forEach(file => startUpload(file));
                                }
                                // Reset input to allow re-uploading the same file
                                e.target.value = '';
                            }
                        }}
                    />
                    <div className="p-4 bg-background rounded-full mb-4 shadow-xl border border-stone-800">
                        <Upload size={32} className={cn("transition-colors", isDragOver ? "text-gold" : "text-stone-500")} />
                    </div>
                    <p className="text-lg font-medium text-stone-300">
                        Drag and drop MP3 files here
                    </p>
                    <p className="text-stone-500 mt-2 text-sm">
                        or click to select files
                    </p>
                </div>
            </div>

            {/* Queue List */}
            {queue.length > 0 && (
                <div className="bg-background border border-stone-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-4 border-b border-stone-800 bg-stone-900/50 flex justify-between items-center">
                        <h3 className="font-semibold text-stone-300">Upload Queue ({queue.length})</h3>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQueue([]);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="text-xs text-gold hover:text-gold-hover font-medium px-2 py-1 cursor-pointer z-50 relative"
                        >
                            Clear All
                        </button>
                    </div>
                    <div className="divide-y divide-stone-800/50 max-h-[400px] overflow-y-auto">
                        {queue.map((item) => (
                            <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                <FileAudio className="text-stone-600" size={24} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
                                        <div className="flex items-center gap-2">
                                            {item.status === 'uploading' && <Loader2 size={12} className="animate-spin text-gold" />}
                                            <span className={cn("text-xs uppercase font-bold tracking-wider",
                                                item.status === 'complete' ? "text-green-500" :
                                                    item.status === 'error' ? "text-red-500" :
                                                        item.status === 'analyzing' ? "text-blue-400" :
                                                            "text-stone-500"
                                            )}>
                                                {item.status === 'error' && item.errorMessage ? `Error: ${item.errorMessage}` : item.status}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Progress bar - thicker for better visibility */}
                                    <div className="h-3 w-full bg-stone-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-300",
                                                item.status === 'error' ? "bg-red-500" : "bg-gold",
                                                item.status === 'analyzing' ? "animate-pulse" : ""
                                            )}
                                            style={{ width: item.status === 'analyzing' ? '100%' : `${item.progress}%` }}
                                        />
                                    </div>

                                    {/* Results - Modern Card Design */}
                                    {item.status === 'complete' && item.trackData && (
                                        <div className="mt-4 pt-4 border-t border-stone-800/50 space-y-4">
                                            {/* Key Metrics Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-lg p-3">
                                                    <div className="text-xs text-gold/70 font-medium mb-1">BPM</div>
                                                    <div className="text-2xl font-bold text-gold">{Math.round(item.trackData.final_bpm)}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-green/10 to-green/5 border border-green/20 rounded-lg p-3">
                                                    <div className="text-xs text-green-light/70 font-medium mb-1">Key</div>
                                                    <div className="text-2xl font-bold text-white">{item.trackData.final_key}</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-blue/10 to-blue/5 border border-blue/20 rounded-lg p-3">
                                                    <div className="text-xs text-blue-300/70 font-medium mb-1">Energy</div>
                                                    <div className="text-2xl font-bold text-white">{Math.round((item.trackData.analysis?.energy || 0))} / 10</div>
                                                </div>
                                                <div className="bg-gradient-to-br from-purple/10 to-purple/5 border border-purple/20 rounded-lg p-3">
                                                    <div className="text-xs text-purple-300/70 font-medium mb-1">Danceability</div>
                                                    <div className="text-2xl font-bold text-white">{Math.round((item.trackData.analysis?.model_tags?.danceability || 0) * 100)}%</div>
                                                </div>
                                            </div>

                                            {/* Deep Analysis Details (Valence, Tension, Brightness, etc.) */}
                                            {/* Deep Analysis Details Removed as per user request */}

                                            {/* AI Detected Instruments */}
                                            {item.trackData.analysis?.model_tags?.instruments && Object.keys(item.trackData.analysis.model_tags.instruments).length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Detected Instruments</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(item.trackData.analysis.model_tags.instruments)
                                                            .sort(([, a], [, b]) => (b as number) - (a as number)) // Sort by confidence
                                                            .map(([inst, conf]) => (
                                                                <span key={inst} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1.5" title={`Confidence: ${Math.round((conf as number) * 100)}%`}>
                                                                    {inst}
                                                                    <div className="w-1 h-3 bg-blue-500/20 rounded-full overflow-hidden">
                                                                        <div className="bg-blue-400 w-full" style={{ height: `${(conf as number) * 100}%` }} />
                                                                    </div>
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Detected Moods (New) */}
                                            {item.trackData.analysis?.model_tags?.ai_moods && Object.keys(item.trackData.analysis.model_tags.ai_moods).length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider">AI Detected Moods</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(item.trackData.analysis.model_tags.ai_moods)
                                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                                            .map(([mood, conf]) => (
                                                                <span key={mood} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-xs flex items-center gap-1.5" title={`Confidence: ${Math.round((conf as number) * 100)}%`}>
                                                                    {mood}
                                                                    <div className="w-1 h-3 bg-purple-500/20 rounded-full overflow-hidden">
                                                                        <div className="bg-purple-400 w-full" style={{ height: `${(conf as number) * 100}%` }} />
                                                                    </div>
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Genres - Editable */}
                                            {item.trackData.suggested_genres && item.trackData.suggested_genres.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Genres</div>
                                                        <button
                                                            type="button"
                                                            className="text-xs text-gold hover:text-gold-hover"
                                                            onClick={() => {
                                                                const newGenre = prompt('Add genre:');
                                                                if (newGenre) {
                                                                    // TODO: Add to track genres
                                                                    console.log('Add genre:', newGenre);
                                                                }
                                                            }}
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.trackData.suggested_genres.map((genre: string, idx: number) => (
                                                            <span
                                                                key={idx}
                                                                className="group px-3 py-1.5 bg-gradient-to-r from-green/30 to-green/20 border border-green/30 text-gold rounded-full text-xs font-medium hover:from-green/40 hover:to-green/30 transition-all cursor-default flex items-center gap-2"
                                                            >
                                                                {genre}
                                                                <button
                                                                    type="button"
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                                                    onClick={() => {
                                                                        // TODO: Remove genre
                                                                        console.log('Remove genre:', genre);
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Moods - Editable */}
                                            {item.trackData.suggested_moods && item.trackData.suggested_moods.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Moods & Vibes</div>
                                                        <button
                                                            type="button"
                                                            className="text-xs text-gold hover:text-gold-hover"
                                                            onClick={() => {
                                                                const newMood = prompt('Add mood:');
                                                                if (newMood) {
                                                                    // TODO: Add to track moods
                                                                    console.log('Add mood:', newMood);
                                                                }
                                                            }}
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.trackData.suggested_moods.map((mood: string, idx: number) => (
                                                            <span
                                                                key={idx}
                                                                className="group px-3 py-1.5 bg-gradient-to-r from-brown-dark/60 to-brown-dark/40 border border-brown-light/20 text-stone-200 rounded-full text-xs font-medium hover:from-brown-dark/70 hover:to-brown-dark/50 transition-all cursor-default flex items-center gap-2"
                                                            >
                                                                {mood}
                                                                <button
                                                                    type="button"
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                                                    onClick={() => {
                                                                        // TODO: Remove mood
                                                                        console.log('Remove mood:', mood);
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}


                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => removeFile(item.id)}
                                    className="text-stone-600 hover:text-red-400 transition-colors p-1"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadPage;
