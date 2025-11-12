import React, { useState, useEffect } from 'react'
import ModList from './components/ModList'
import SearchBar from './components/SearchBar'
import Statistics from './components/Statistics'
import Settings from './components/Settings'
import SymlinkManager from './components/SymlinkManager'
import BackgroundTaskBar, { BackgroundTask } from './components/BackgroundTaskBar'
import { modsAPI } from './services/api'
import './App.css'

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

export type SortOption = 'updated' | 'rating' | 'subscriptions' | 'title';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'mods' | 'symlinks';

function App() {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [filteredMods, setFilteredMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [collectionUrl, setCollectionUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [workshopPath, setWorkshopPath] = useState('');
  const [duckovGamePath, setDuckovGamePath] = useState('');
  const [isWorkshopConfigured, setIsWorkshopConfigured] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('mods');
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

  useEffect(() => {
    initializeApp();

    // Set up background task listeners
    if (window.electronAPI?.onBackgroundTaskProgress) {
      const cleanupProgress = window.electronAPI.onBackgroundTaskProgress((progress) => {
        setBackgroundTasks((prevTasks) => {
          // Update existing task or add new one
          const existingIndex = prevTasks.findIndex(t => t.taskId === progress.taskId);
          if (existingIndex >= 0) {
            const newTasks = [...prevTasks];
            newTasks[existingIndex] = progress;
            return newTasks;
          } else {
            return [...prevTasks, progress];
          }
        });

        // If task is complete, refresh mods and stats
        if (progress.isComplete && progress.taskId === 'initial-scan') {
          fetchMods();
          fetchStats();
        }
      });

      const cleanupComplete = window.electronAPI.onBackgroundTaskComplete((taskId) => {
        // Remove completed task after a delay
        setTimeout(() => {
          setBackgroundTasks((prevTasks) => prevTasks.filter(t => t.taskId !== taskId));
        }, 3000);
      });

      // Cleanup listeners on unmount
      return () => {
        cleanupProgress();
        cleanupComplete();
      };
    }
  }, []);

  const initializeApp = async () => {
    // Check if workshop is configured
    try {
      if (window.electronAPI?.isWorkshopConfigured) {
        const configured = await window.electronAPI.isWorkshopConfigured();
        setIsWorkshopConfigured(configured);
        
        if (configured) {
          const path = await window.electronAPI.getWorkshopPath();
          setWorkshopPath(path);
          
          // Also load duckov game path if available
          if (window.electronAPI?.getDuckovGamePath) {
            const gamePath = await window.electronAPI.getDuckovGamePath();
            setDuckovGamePath(gamePath);
          }
          
          // Fetch mods if configured
          await fetchMods();
          await fetchStats();
        } else {
          // Show settings on first startup
          setShowSettings(true);
        }
      } else {
        // Fallback for non-Electron environment
        await fetchMods();
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // Continue with app initialization even if settings check fails
      await fetchMods();
      await fetchStats();
    }
  };

  useEffect(() => {
    applyFiltersAndSort();
  }, [mods, searchTerm, sortBy, sortDirection, selectedLanguages, selectedTags, minRating]);

  const applyFiltersAndSort = () => {
    let filtered = [...mods];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(mod =>
        mod.title.toLowerCase().includes(term) ||
        mod.description.toLowerCase().includes(term) ||
        mod.creator.toLowerCase().includes(term)
      );
    }

    // Apply language filter
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(mod =>
        selectedLanguages.includes(mod.language || 'en')
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(mod =>
        selectedTags.some(tag => mod.tags.includes(tag))
      );
    }

    // Apply rating filter
    if (minRating > 0) {
      filtered = filtered.filter(mod => mod.rating >= minRating);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'updated':
          comparison = new Date(a.timeUpdated).getTime() - new Date(b.timeUpdated).getTime();
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'subscriptions':
          comparison = a.subscriptions - b.subscriptions;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredMods(filtered);
  };

  const fetchMods = async (search?: string) => {
    setLoading(true);
    try {
      // Use IPC API instead of HTTP fetch
      let modsData;
      if (search) {
        modsData = await modsAPI.searchMods(search, 1000);
      } else {
        modsData = await modsAPI.getAllMods(1000, 0);
      }

      setMods(modsData);
    } catch (error) {
      console.error('Failed to fetch mods:', error);
      alert(`Failed to fetch mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Use IPC API instead of HTTP fetch
      const statsData = await modsAPI.getStatistics();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Non-critical error, don't show alert
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

  const toggleLanguage = (language: string) => {
    setSelectedLanguages(prev =>
      prev.includes(language)
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedLanguages([]);
    setSelectedTags([]);
    setMinRating(0);
    setSearchTerm('');
  };

  const getUniqueLanguages = () => {
    const languages = new Set(mods.map(mod => mod.language || 'en'));
    return Array.from(languages).sort();
  };

  const getUniqueTags = () => {
    const tags = new Set(mods.flatMap(mod => mod.tags));
    return Array.from(tags).sort();
  };

  const syncMods = async (fileIds: string[]) => {
    if (!isWorkshopConfigured) {
      alert('Please configure workshop path in settings first.');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    try {
      // Use IPC API instead of HTTP fetch
      const result = await modsAPI.syncMods(fileIds);

      await fetchMods();
      await fetchStats();
      alert(`Successfully synced ${result.synced} mods`);
    } catch (error) {
      console.error('Failed to sync mods:', error);
      alert(`Failed to sync mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (newWorkshopPath: string, newDuckovGamePath: string) => {
    try {
      if (window.electronAPI?.setWorkshopPath) {
        await window.electronAPI.setWorkshopPath(newWorkshopPath);
        setWorkshopPath(newWorkshopPath);
        setIsWorkshopConfigured(true);
        
        if (window.electronAPI?.setDuckovGamePath) {
          await window.electronAPI.setDuckovGamePath(newDuckovGamePath);
          setDuckovGamePath(newDuckovGamePath);
        }
        
        setShowSettings(false);
        
        // Refresh mods after setting workshop path
        await fetchMods();
        await fetchStats();
        
        alert('Settings updated successfully!');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const scanWorkshopFolder = async () => {
    if (!isWorkshopConfigured) {
      alert('Please configure workshop path in settings first.');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    try {
      // Use IPC API instead of HTTP fetch
      const result = await modsAPI.scanWorkshopFolder();

      await fetchMods();
      await fetchStats();

      const message = `Scan complete: ${result.scanned} mods found, ${result.synced} synced successfully`;
      if (result.errors > 0) {
        alert(`${message}\n\nWarning: ${result.errors} errors occurred during scan.`);
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Failed to scan workshop folder:', error);
      alert(`Failed to scan workshop folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectMod = (modId: string) => {
    setSelectedMods(prev =>
      prev.includes(modId)
        ? prev.filter(id => id !== modId)
        : [...prev, modId]
    );
  };

  const selectAllMods = () => {
    setSelectedMods(filteredMods.map(mod => mod.id));
  };

  const clearSelection = () => {
    setSelectedMods([]);
  };

  const exportSelectedMods = async () => {
    if (selectedMods.length === 0) {
      alert('Please select at least one mod to export');
      return;
    }

    setLoading(true);
    try {
      // Use IPC API instead of HTTP fetch
      // The API will handle showing the save dialog and creating the zip
      const result = await modsAPI.exportMods(selectedMods);

      if (result.success) {
        let message = `Successfully exported ${result.exportedCount} mod${result.exportedCount > 1 ? 's' : ''} to:\n${result.filePath}`;

        if (result.missingMods.length > 0) {
          message += `\n\nWarning: ${result.missingMods.length} mod${result.missingMods.length > 1 ? 's' : ''} could not be found locally:\n${result.missingMods.join(', ')}`;
        }

        alert(message);
        clearSelection();
      }
    } catch (error) {
      console.error('Failed to export mods:', error);

      // Check if user canceled the export
      if (error instanceof Error && error.message.includes('canceled')) {
        console.log('Export canceled by user');
      } else {
        alert(`Failed to export mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportFromCollection = async () => {
    if (!collectionUrl.trim()) {
      alert('Please enter a Steam Workshop collection URL');
      return;
    }

    setLoading(true);
    try {
      // Get mod IDs from the collection using Steam's public web API
      const result = await modsAPI.getCollectionMods(collectionUrl);
      
      if (!result.modIds || result.modIds.length === 0) {
        alert('No mods found in collection');
        setShowExportDialog(false);
        return;
      }

      console.log(`Found ${result.count} mods in collection, exporting...`);
      
      // Export the mods
      const exportResult = await modsAPI.exportMods(result.modIds);
      
      if (exportResult.success) {
        const message = `Successfully exported ${exportResult.exportedCount} mods from collection!\n\n` +
                       `File: ${exportResult.filePath}` +
                       (exportResult.missingMods.length > 0 
                         ? `\n\nMissing mods (not downloaded locally): ${exportResult.missingMods.length}`
                         : '');
        alert(message);
      }
      
      setShowExportDialog(false);
      setCollectionUrl('');
    } catch (error) {
      console.error('Failed to export collection:', error);
      alert(`Failed to export collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div>
          <h1>🦆 Duckov Mod Manager</h1>
          <p>Manage your Escape from Duckov mods with automatic translation</p>
        </div>
        <div className="header-actions">
          <div className="view-tabs">
            <button 
              onClick={() => setViewMode('mods')}
              className={`tab-btn ${viewMode === 'mods' ? 'active' : ''}`}
            >
              📋 Mod List
            </button>
            <button 
              onClick={() => setViewMode('symlinks')}
              className={`tab-btn ${viewMode === 'symlinks' ? 'active' : ''}`}
            >
              🔗 Symlink Manager
            </button>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="btn btn-secondary settings-btn"
            title="Open Settings"
          >
            <span className="btn-icon">⚙️</span>
            <span className="btn-text">Settings</span>
          </button>
        </div>
      </header>

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        currentWorkshopPath={workshopPath}
        currentDuckovGamePath={duckovGamePath}
      />      <main className="app-main">
        <div className="top-controls">
          <SearchBar onSearch={handleSearch} searchTerm={searchTerm} />
          <div className="actions">
            <button 
              onClick={scanWorkshopFolder}
              disabled={loading || !isWorkshopConfigured}
              className="btn btn-primary"
              title={isWorkshopConfigured ? "Scan local workshop folder and sync with Steam Workshop" : "Configure workshop path in settings first"}
            >
              <span className="btn-icon">📁</span>
              <span className="btn-text">Scan Workshop</span>
            </button>
            <button 
              onClick={() => fetchMods()}
              disabled={loading}
              className="btn btn-secondary"
            >
              <span className="btn-icon">🔄</span>
              <span className="btn-text">Refresh</span>
            </button>
            <button 
              onClick={exportSelectedMods}
              disabled={loading || selectedMods.length === 0}
              className="btn btn-success"
              title="Export selected mods as ZIP"
            >
              <span className="btn-icon">📦</span>
              <span className="btn-text">Export Selected ({selectedMods.length})</span>
            </button>
            <button 
              onClick={() => setShowExportDialog(!showExportDialog)}
              disabled={loading}
              className="btn btn-info"
              title="Export mods from a Steam Workshop collection"
            >
              <span className="btn-icon">🌐</span>
              <span className="btn-text">Export Collection</span>
            </button>
          </div>
        </div>

        {showExportDialog && (
          <div className="export-dialog">
            <h3>Export from Steam Workshop Collection</h3>
            <p>Enter the URL of a Steam Workshop collection to export all mods from it.</p>
            <div className="export-input-group">
              <input
                type="text"
                value={collectionUrl}
                onChange={(e) => setCollectionUrl(e.target.value)}
                placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=XXXXXXXXX"
                className="export-input"
              />
              <button 
                onClick={exportFromCollection}
                disabled={loading || !collectionUrl.trim()}
                className="btn btn-primary"
              >
                Export Collection
              </button>
              <button 
                onClick={() => {
                  setShowExportDialog(false);
                  setCollectionUrl('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stats && <Statistics stats={stats} />}

        <div className="filter-sort-controls">
          <button 
            className="btn btn-filter"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="btn-icon">🔍</span>
            Filters
            {(selectedLanguages.length > 0 || selectedTags.length > 0 || minRating > 0) && (
              <span className="filter-badge">
                {selectedLanguages.length + selectedTags.length + (minRating > 0 ? 1 : 0)}
              </span>
            )}
          </button>

          <div className="sort-controls">
            <span className="sort-label">Sort by:</span>
            <button
              className={`btn-sort ${sortBy === 'updated' ? 'active' : ''}`}
              onClick={() => toggleSort('updated')}
            >
              Updated {sortBy === 'updated' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`btn-sort ${sortBy === 'rating' ? 'active' : ''}`}
              onClick={() => toggleSort('rating')}
            >
              Rating {sortBy === 'rating' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`btn-sort ${sortBy === 'subscriptions' ? 'active' : ''}`}
              onClick={() => toggleSort('subscriptions')}
            >
              Subscribers {sortBy === 'subscriptions' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`btn-sort ${sortBy === 'title' ? 'active' : ''}`}
              onClick={() => toggleSort('title')}
            >
              Title {sortBy === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <div className="results-count">
            {filteredMods.length} of {mods.length} mods
          </div>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-section">
              <h3>Language</h3>
              <div className="filter-options">
                {getUniqueLanguages().map(lang => (
                  <label key={lang} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(lang)}
                      onChange={() => toggleLanguage(lang)}
                    />
                    <span>{lang.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h3>Minimum Rating</h3>
              <div className="rating-filter">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={minRating}
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                />
                <span>{minRating > 0 ? `${minRating}+ ★` : 'Any'}</span>
              </div>
            </div>

            <div className="filter-section">
              <h3>Tags</h3>
              <div className="filter-options tag-filter">
                {getUniqueTags().slice(0, 20).map(tag => (
                  <label key={tag} className="filter-checkbox tag-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-actions">
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear All Filters
              </button>
            </div>
          </div>
        )}
        
        {viewMode === 'mods' ? (
          <ModList 
            mods={filteredMods} 
            loading={loading} 
            onSync={syncMods}
            selectedMods={selectedMods}
            onToggleSelect={toggleSelectMod}
            onSelectAll={selectAllMods}
            onClearSelection={clearSelection}
            isWorkshopConfigured={isWorkshopConfigured}
          />
        ) : (
          <SymlinkManager mods={filteredMods} />
        )}
      </main>

      <BackgroundTaskBar tasks={backgroundTasks} />

      <footer className="app-footer">
        <p>Duckov Mod Manager - Built with Steam Workshop API & DeepL Translation</p>
      </footer>
    </div>
  )
}

export default App
