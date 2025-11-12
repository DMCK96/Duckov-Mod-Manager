import React, { useState, useEffect } from 'react';
import './SymlinkManager.css';

interface SymlinkInfo {
  modId: string;
  modTitle?: string;
  sourcePath: string;
  targetPath: string;
  exists: boolean;
}

interface ModInfo {
  id: string;
  title: string;
  description: string;
}

interface SymlinkManagerProps {
  mods: ModInfo[];
}

function SymlinkManager({ mods }: SymlinkManagerProps) {
  const [activeSymlinks, setActiveSymlinks] = useState<SymlinkInfo[]>([]);
  const [availableModIds, setAvailableModIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathsValid, setPathsValid] = useState<boolean>(false);
  const [pathErrors, setPathErrors] = useState<string[]>([]);

  useEffect(() => {
    validatePaths();
    loadSymlinks();
  }, []);

  const validatePaths = async () => {
    try {
      if (window.electronAPI?.validateSymlinkPaths) {
        const validation = await window.electronAPI.validateSymlinkPaths();
        setPathsValid(validation.valid);
        setPathErrors(validation.errors || []);
      }
    } catch (err) {
      console.error('Failed to validate paths:', err);
      setPathsValid(false);
      setPathErrors(['Failed to validate paths']);
    }
  };

  const loadSymlinks = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.electronAPI?.listActiveSymlinks && window.electronAPI?.getAvailableMods) {
        const [symlinks, availableMods] = await Promise.all([
          window.electronAPI.listActiveSymlinks(),
          window.electronAPI.getAvailableMods()
        ]);

        // Enrich symlinks with mod titles
        const enrichedSymlinks = symlinks.map((symlink: SymlinkInfo) => {
          const mod = mods.find(m => m.id === symlink.modId);
          return {
            ...symlink,
            modTitle: mod?.title || `Mod ${symlink.modId}`
          };
        });

        setActiveSymlinks(enrichedSymlinks);
        setAvailableModIds(availableMods);
      }
    } catch (err) {
      console.error('Failed to load symlinks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load symlinks');
    } finally {
      setLoading(false);
    }
  };

  const createSymlink = async (modId: string) => {
    try {
      if (window.electronAPI?.createSymlink) {
        const result = await window.electronAPI.createSymlink(modId);
        if (result.success) {
          await loadSymlinks();
        } else {
          alert(`Failed to create symlink: ${result.error}`);
        }
      }
    } catch (err) {
      console.error('Failed to create symlink:', err);
      alert(`Failed to create symlink: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const removeSymlink = async (modId: string) => {
    if (!confirm(`Are you sure you want to remove the symlink for mod ${modId}?`)) {
      return;
    }

    try {
      if (window.electronAPI?.removeSymlink) {
        const result = await window.electronAPI.removeSymlink(modId);
        if (result.success) {
          await loadSymlinks();
        } else {
          alert(`Failed to remove symlink: ${result.error}`);
        }
      }
    } catch (err) {
      console.error('Failed to remove symlink:', err);
      alert(`Failed to remove symlink: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getModInfo = (modId: string): ModInfo | undefined => {
    return mods.find(m => m.id === modId);
  };

  if (!pathsValid) {
    return (
      <div className="symlink-manager">
        <div className="error-banner">
          <h3>⚠️ Configuration Required</h3>
          <p>Please configure both Workshop Path and Duckov Game Path in Settings before using symlink management.</p>
          {pathErrors.length > 0 && (
            <ul>
              {pathErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="symlink-manager">
      <div className="symlink-header">
        <h2>🔗 Symlink Manager</h2>
        <p>Manage mod symlinks between Workshop and Game folders</p>
        <button 
          onClick={loadSymlinks} 
          disabled={loading}
          className="btn btn-primary refresh-btn"
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>❌ Error: {error}</p>
        </div>
      )}

      <div className="symlink-tables">
        {/* Available Mods Table */}
        <div className="symlink-table-container">
          <h3>📦 Available Mods ({availableModIds.length})</h3>
          <p className="table-description">Mods in workshop folder without symlinks</p>
          
          {availableModIds.length === 0 ? (
            <div className="empty-state">
              <p>No available mods found or all mods are already symlinked</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="symlink-table">
                <thead>
                  <tr>
                    <th>Mod ID</th>
                    <th>Title</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableModIds.map(modId => {
                    const mod = getModInfo(modId);
                    return (
                      <tr key={modId}>
                        <td className="mod-id">{modId}</td>
                        <td className="mod-title">
                          {mod ? mod.title : <span className="unknown">Unknown Mod</span>}
                        </td>
                        <td className="action-cell">
                          <button
                            onClick={() => createSymlink(modId)}
                            className="btn btn-small btn-success"
                            title="Create symlink"
                          >
                            ➕ Link
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Symlinks Table */}
        <div className="symlink-table-container">
          <h3>✅ Active Symlinks ({activeSymlinks.length})</h3>
          <p className="table-description">Mods currently symlinked to game folder</p>
          
          {activeSymlinks.length === 0 ? (
            <div className="empty-state">
              <p>No active symlinks. Create symlinks from available mods.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="symlink-table">
                <thead>
                  <tr>
                    <th>Mod ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSymlinks.map(symlink => (
                    <tr key={symlink.modId} className={!symlink.exists ? 'broken' : ''}>
                      <td className="mod-id">{symlink.modId}</td>
                      <td className="mod-title">{symlink.modTitle}</td>
                      <td className="status-cell">
                        {symlink.exists ? (
                          <span className="status-badge status-ok">✓ OK</span>
                        ) : (
                          <span className="status-badge status-broken" title="Source folder not found">
                            ⚠️ Broken
                          </span>
                        )}
                      </td>
                      <td className="action-cell">
                        <button
                          onClick={() => removeSymlink(symlink.modId)}
                          className="btn btn-small btn-danger"
                          title="Remove symlink"
                        >
                          ❌ Unlink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="symlink-info">
        <h4>ℹ️ About Symlinks</h4>
        <p>
          Symlinks (symbolic links) allow the game to access mods directly from your workshop folder 
          without copying files. This saves disk space and keeps your mods in sync with Steam Workshop updates.
        </p>
        <p>
          <strong>Note:</strong> On Windows, this uses directory junctions which don't require administrator privileges.
        </p>
      </div>
    </div>
  );
}

export default SymlinkManager;
