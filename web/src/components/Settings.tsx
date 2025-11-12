import React, { useState, useEffect } from 'react';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workshopPath: string) => void;
  currentWorkshopPath: string;
}

function Settings({ isOpen, onClose, onSave, currentWorkshopPath }: SettingsProps) {
  const [workshopPath, setWorkshopPath] = useState(currentWorkshopPath);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setWorkshopPath(currentWorkshopPath);
    setHasChanges(false);
  }, [currentWorkshopPath, isOpen]);

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkshopPath(e.target.value);
    setHasChanges(e.target.value !== currentWorkshopPath);
  };

  const handleBrowse = async () => {
    try {
      if (window.electronAPI?.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select Workshop Data Folder',
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          setWorkshopPath(result.filePaths[0]);
          setHasChanges(result.filePaths[0] !== currentWorkshopPath);
        }
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      alert('Failed to open directory selection dialog');
    }
  };

  const handleSave = () => {
    if (workshopPath.trim()) {
      onSave(workshopPath.trim());
      setHasChanges(false);
    } else {
      alert('Please select a valid workshop data folder');
    }
  };

  const handleCancel = () => {
    setWorkshopPath(currentWorkshopPath);
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
              Typically located at: <code>C:\Program Files (x86)\Steam\steamapps\workshop\content\2390090</code>
            </p>
            
            <div className="path-input-group">
              <input
                type="text"
                value={workshopPath}
                onChange={handlePathChange}
                placeholder="Select workshop folder..."
                className="path-input"
              />
              <button onClick={handleBrowse} className="btn btn-secondary">
                📁 Browse
              </button>
            </div>

            {!currentWorkshopPath && (
              <div className="warning-message">
                ⚠️ Workshop path is not configured. Please select a folder to enable mod scanning.
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
