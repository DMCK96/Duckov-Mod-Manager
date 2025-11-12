import React from 'react';
import './BackgroundTaskBar.css';

export interface BackgroundTask {
  taskId: string;
  taskName: string;
  message: string;
  progress: number; // 0-100
  isComplete: boolean;
}

interface BackgroundTaskBarProps {
  tasks: BackgroundTask[];
}

const BackgroundTaskBar: React.FC<BackgroundTaskBarProps> = ({ tasks }) => {
  // Only show active (incomplete) tasks
  const activeTasks = tasks.filter(task => !task.isComplete);

  if (activeTasks.length === 0) {
    return null;
  }

  return (
    <div className="background-task-bar">
      {activeTasks.map((task) => (
        <div key={task.taskId} className="background-task">
          <div className="task-info">
            <span className="task-name">{task.taskName}</span>
            <span className="task-message">{task.message}</span>
          </div>
          <div className="task-progress-container">
            <div 
              className="task-progress-bar" 
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <span className="task-percentage">{task.progress}%</span>
        </div>
      ))}
    </div>
  );
};

export default BackgroundTaskBar;
