import React from 'react';

interface StatisticsProps {
  stats: {
    totalMods: number;
    translatedMods: number;
    languageBreakdown: Record<string, number>;
    recentUpdates: number;
  };
}

const Statistics: React.FC<StatisticsProps> = ({ stats }) => {
  const translationPercentage = stats.totalMods > 0 
    ? Math.round((stats.translatedMods / stats.totalMods) * 100)
    : 0;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{stats.totalMods}</div>
        <div className="stat-label">Total Mods</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-value">{stats.translatedMods}</div>
        <div className="stat-label">Translated</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-value">{translationPercentage}%</div>
        <div className="stat-label">Translation Rate</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-value">{stats.recentUpdates}</div>
        <div className="stat-label">Recent Updates</div>
      </div>
    </div>
  );
};

export default Statistics;
