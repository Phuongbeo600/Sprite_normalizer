import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Projects from './pages/Projects';
import Workspace from './pages/Workspace';
import Settings from './pages/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [currentProject, setCurrentProject] = useState(null);

  const handleOpenProject = (project) => {
    setCurrentProject(project);
    setActiveTab('workspace');
  };

  const handleOpenNewProject = () => {
    setCurrentProject({
      id: `proj_${Date.now()}`,
      name: 'Dự án Sprite mới',
      resolution: '64x64',
      status: 'created'
    });
    setActiveTab('workspace');
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
      <div className="main-content">
        <Header activeTab={activeTab} onOpenNewProject={handleOpenNewProject} />
        {activeTab === 'projects' && <Projects onOpenProject={handleOpenProject} />}
        {activeTab === 'workspace' && <Workspace currentProject={currentProject} />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </div>
  );
}
