import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

export const client = axios.create({
    baseURL: API_URL,
});

export interface Track {
    id: string;
    filename: string;
    status: 'queued' | 'analyzing' | 'complete' | 'failed' | 'error';
    duration: number;
    upload_date: string;
    final_bpm: number;
    final_key: string;
    suggested_genres: string[];
    suggested_moods: string[];

    analysis?: any;
    edits?: any;
}

export const api = {
    uploadFile: async (file: File, onProgress?: (percent: number) => void) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await client.post<Track>('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total && onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
        return response.data;
    },

    getTracks: async () => {
        const response = await client.get<{ tracks: Track[] }>('/tracks');
        return response.data.tracks;
    },

    getTrack: async (id: string) => {
        const response = await client.get<Track>(`/tracks/${id}`);
        return response.data;
    },

    updateEdits: async (id: string, edits: any) => {
        const response = await client.put<Track>(`/tracks/${id}/edits`, edits);
        return response.data;
    },

    // Placeholder for export
    exportCsv: (trackIds: string[]) => {
        // Direct link usually better for download
        window.location.href = `${API_URL}/export/csv?track_ids=${trackIds.join(',')}`;
    }
};
