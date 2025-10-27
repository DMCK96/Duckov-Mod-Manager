import React, { useState, useEffect } from 'react'
import ModList from './components/ModList'
import SearchBar from './components/SearchBar'
import Statistics from './components/Statistics'
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

function App() {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchMods();
    fetchStats();
  }, []);

  const fetchMods = async (search?: string) => {
    setLoading(true);
    try {
      const url = search 
        ? `/api/mods/search?q=${encodeURIComponent(search)}`
        : '/api/mods';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setMods(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch mods:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/mods/stats/overview');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      fetchMods(term);
    } else {
      fetchMods();
    }
  };

  const syncMods = async (fileIds: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/mods/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMods();
        await fetchStats();
        alert(`Successfully synced ${data.synced} mods`);
      }
    } catch (error) {
      console.error('Failed to sync mods:', error);
      alert('Failed to sync mods');
    } finally {
      setLoading(false);
    }
  };

  const scanWorkshopFolder = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mods/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMods();
        await fetchStats();
        alert(`Scan complete: ${data.data.scanned} mods found, ${data.data.synced} synced successfully`);
      } else {
        alert('Failed to scan workshop folder');
      }
    } catch (error) {
      console.error('Failed to scan workshop folder:', error);
      alert('Failed to scan workshop folder. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🦆 Duckov Mod Manager</h1>
        <p>Manage your Escape from Duckov mods with automatic translation</p>
      </header>

      <main className="app-main">
        <div className="controls">
          <SearchBar onSearch={handleSearch} />
          <div className="actions">
            <button 
              onClick={scanWorkshopFolder}
              disabled={loading}
              className="btn btn-primary"
              title="Scan local workshop folder and sync with Steam Workshop"
            >
              Scan Workshop Folder
            </button>
            <button 
              onClick={() => fetchMods()}
              disabled={loading}
              className="btn btn-secondary"
            >
              Refresh
            </button>
          </div>
        </div>

        {stats && <Statistics stats={stats} />}
        
        <ModList 
          mods={mods} 
          loading={loading} 
          onSync={syncMods}
        />
      </main>

      <footer className="app-footer">
        <p>Duckov Mod Manager - Built with Steam Workshop API & DeepL Translation</p>
      </footer>
    </div>
  )
}

export default App
