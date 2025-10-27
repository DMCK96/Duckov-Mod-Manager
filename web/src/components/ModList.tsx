import React from 'react';

interface ModInfo {
  id: string;
  title: string;
  description: string;
  creator: string;
  previewUrl: string;
  subscriptions: number;
  rating: number;
  tags: string[];
  timeCreated: string;
  timeUpdated: string;
  language?: string;
}

interface ModListProps {
  mods: ModInfo[];
  loading: boolean;
  onSync: (fileIds: string[]) => void;
}

const ModList: React.FC<ModListProps> = ({ mods, loading, onSync }) => {
  const [syncInput, setSyncInput] = React.useState('');

  const handleSync = () => {
    const fileIds = syncInput
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (fileIds.length > 0) {
      onSync(fileIds);
      setSyncInput('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderStars = (rating: number) => {
    const stars = Math.round(rating);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading mods...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sync-section" style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3>Sync Mods from Steam Workshop</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            value={syncInput}
            onChange={(e) => setSyncInput(e.target.value)}
            placeholder="Enter Steam Workshop file IDs (comma-separated)"
            style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <button 
            onClick={handleSync}
            disabled={!syncInput.trim()}
            className="btn btn-primary"
          >
            Sync Mods
          </button>
        </div>
      </div>

      {mods.length === 0 ? (
        <div className="empty-state">
          <h3>No mods found</h3>
          <p>Try syncing some mods from Steam Workshop or adjusting your search.</p>
        </div>
      ) : (
        <div className="mod-grid">
          {mods.map((mod) => (
            <div key={mod.id} className="mod-card">
              {mod.previewUrl && (
                <img 
                  src={mod.previewUrl} 
                  alt={mod.title}
                  className="mod-preview"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              
              <div className="mod-content">
                <div className="mod-title">{mod.title}</div>
                <div className="mod-creator">by {mod.creator}</div>
                
                {mod.language && mod.language !== 'en' && (
                  <div className="language-badge">{mod.language}</div>
                )}
                
                <div className="mod-description">{mod.description}</div>
                
                <div className="mod-meta">
                  <span>{mod.subscriptions.toLocaleString()} subscribers</span>
                  <div className="mod-rating">
                    {renderStars(mod.rating)} ({mod.rating.toFixed(1)})
                  </div>
                </div>
                
                {mod.tags.length > 0 && (
                  <div className="mod-tags">
                    {mod.tags.slice(0, 5).map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                
                <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '1rem' }}>
                  Updated: {formatDate(mod.timeUpdated)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModList;
