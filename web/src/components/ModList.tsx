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
  selectedMods: string[];
  onToggleSelect: (modId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isWorkshopConfigured: boolean;
}

const ModList: React.FC<ModListProps> = ({ 
  mods, 
  loading, 
  onSync,
  selectedMods,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  isWorkshopConfigured
}) => {
  const [syncInput, setSyncInput] = React.useState('');
  const [showSyncSection, setShowSyncSection] = React.useState(false);

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
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const renderStars = (rating: number) => {
    const stars = Math.round(rating);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  const formatSubscriptions = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading mods...</p>
      </div>
    );
  }

  const allSelected = mods.length > 0 && selectedMods.length === mods.length;
  const someSelected = selectedMods.length > 0 && selectedMods.length < mods.length;

  return (
    <div>
      {selectedMods.length > 0 && (
        <div className="selection-info">
          <span>{selectedMods.length} mod{selectedMods.length > 1 ? 's' : ''} selected</span>
          <div>
            <button onClick={onSelectAll} className="btn btn-sm">Select All</button>
            <button onClick={onClearSelection} className="btn btn-sm">Clear Selection</button>
          </div>
        </div>
      )}

      {showSyncSection && (
        <div className="sync-section">
          <h3>🔄 Sync Mods from Steam Workshop</h3>
          <div>
            <input
              type="text"
              value={syncInput}
              onChange={(e) => setSyncInput(e.target.value)}
              placeholder="Enter Steam Workshop file IDs (comma-separated)"
            />
            <button 
              onClick={handleSync}
              disabled={!syncInput.trim() || !isWorkshopConfigured}
              className="btn"
              title={!isWorkshopConfigured ? "Configure workshop path in settings first" : ""}
            >
              Sync Mods
            </button>
            <button 
              onClick={() => setShowSyncSection(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showSyncSection && mods.length === 0 && (
        <div className="empty-state">
          <h3>📦 No mods found</h3>
          <p>
            {isWorkshopConfigured 
              ? 'Try syncing some mods from Steam Workshop or adjusting your filters.'
              : 'Please configure workshop path in settings first.'}
          </p>
          <button 
            onClick={() => setShowSyncSection(true)}
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            disabled={!isWorkshopConfigured}
            title={!isWorkshopConfigured ? "Configure workshop path in settings first" : ""}
          >
            Sync Mods
          </button>
        </div>
      )}

      {mods.length > 0 && (
        <>
          <div className="bulk-selection">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => el && (el.indeterminate = someSelected)}
                onChange={() => allSelected ? onClearSelection() : onSelectAll()}
              />
              <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
            </label>
          </div>
          
          <div className="mod-grid">
            {mods.map((mod) => (
              <div 
                key={mod.id} 
                className={`mod-card ${selectedMods.includes(mod.id) ? 'selected' : ''}`}
                onClick={() => onToggleSelect(mod.id)}
              >
                <div className="mod-select-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedMods.includes(mod.id)}
                    onChange={() => onToggleSelect(mod.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
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
                    <div className="language-badge">
                      {mod.language.toUpperCase()}
                    </div>
                  )}
                  
                  <div className="mod-description">{mod.description}</div>
                  
                  <div className="mod-meta">
                    <span title={`${mod.subscriptions.toLocaleString()} subscribers`}>
                      👥 {formatSubscriptions(mod.subscriptions)}
                    </span>
                    <div className="mod-rating" title={`${mod.rating.toFixed(1)} out of 5 stars`}>
                      {renderStars(mod.rating)} ({mod.rating.toFixed(1)})
                    </div>
                  </div>
                  
                  {mod.tags.length > 0 && (
                    <div className="mod-tags">
                      {mod.tags.slice(0, 5).map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                      {mod.tags.length > 5 && (
                        <span className="tag" title={mod.tags.slice(5).join(', ')}>
                          +{mod.tags.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: 'auto', paddingTop: '0.5rem' }}>
                    🕒 Updated {formatDate(mod.timeUpdated)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ModList;
