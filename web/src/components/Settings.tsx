import React, { useState, useEffect } from 'react';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workshopPath: string, duckovGamePath: string) => void;
  currentWorkshopPath: string;
  currentDuckovGamePath: string;
}

function Settings({ isOpen, onClose, onSave, currentWorkshopPath, currentDuckovGamePath }: SettingsProps) {
  const [workshopPath, setWorkshopPath] = useState(currentWorkshopPath);
  const [duckovGamePath, setDuckovGamePath] = useState(currentDuckovGamePath);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setWorkshopPath(currentWorkshopPath);
    setDuckovGamePath(currentDuckovGamePath);
    setHasChanges(false);
  }, [currentWorkshopPath, currentDuckovGamePath, isOpen]);

  const handleWorkshopPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkshopPath(e.target.value);
    setHasChanges(e.target.value !== currentWorkshopPath || duckovGamePath !== currentDuckovGamePath);
  };

  const handleDuckovGamePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuckovGamePath(e.target.value);
    setHasChanges(workshopPath !== currentWorkshopPath || e.target.value !== currentDuckovGamePath);
  };

  const handleBrowseWorkshop = async () => {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select Workshop Data Folder',
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setWorkshopPath(result.filePaths[0]);
          setHasChanges(result.filePaths[0] !== currentWorkshopPath || duckovGamePath !== currentDuckovGamePath);
        }
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      alert('Failed to open directory selection dialog');
    }
  };

  const handleBrowseDuckovGame = async () => {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select Duckov Game Folder (Escape from Duckov)',
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setDuckovGamePath(result.filePaths[0]);
          setHasChanges(workshopPath !== currentWorkshopPath || result.filePaths[0] !== currentDuckovGamePath);
        }
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      alert('Failed to open directory selection dialog');
    }
  };

  const handleSave = () => {
    if (workshopPath.trim()) {
      onSave(workshopPath.trim(), duckovGamePath.trim());
      setHasChanges(false);
    } else {
      alert('Please select a valid workshop data folder');
    }
  };

  const handleCancel = () => {
    setWorkshopPath(currentWorkshopPath);
    setDuckovGamePath(currentDuckovGamePath);
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-btn" onClick={handleCancel}>×</button>
        </div>

        <div className="settings-content">
          <div className="setting-section">
            <h3>Workshop Data Folder</h3>
            <p className="setting-description">
              Select the folder where your Steam Workshop mods are stored.
              <br />
              Typically located at: <code>C:\Program Files (x86)\Steam\steamapps\workshop\content\2618920</code>
            </p>
            
            <div className="path-input-group">
              <input
                type="text"
                value={workshopPath}
                onChange={handleWorkshopPathChange}
                placeholder="Select workshop folder..."
                className="path-input"
              />
              <button onClick={handleBrowseWorkshop} className="btn btn-secondary">
                📁 Browse
              </button>
            </div>

            {!currentWorkshopPath && (
              <div className="warning-message">
                ⚠️ Workshop path is not configured. Please select a folder to enable mod scanning.
              </div>
            )}
          </div>

          <div className="setting-section">
            <h3>Duckov Game Folder</h3>
            <p className="setting-description">
              Select the "Escape from Duckov" game installation folder.
              <br />
              Typically located at: <code>C:\Program Files (x86)\Steam\steamapps\common\Escape from Duckov</code>
              <br />
              <small>This is needed to create symlinks to <code>Duckov_Data\Mods</code> folder.</small>
            </p>
            
            <div className="path-input-group">
              <input
                type="text"
                value={duckovGamePath}
                onChange={handleDuckovGamePathChange}
                placeholder="Select Duckov game folder..."
                className="path-input"
              />
              <button onClick={handleBrowseDuckovGame} className="btn btn-secondary">
                📁 Browse
              </button>
            </div>

            {!currentDuckovGamePath && (
              <div className="info-message">
                ℹ️ Duckov game path is optional but required for symlink management.
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={!hasChanges || !workshopPath.trim()}
          >
            💾 Save Settings
          </button>
          <button onClick={handleCancel} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
