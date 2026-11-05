import React from 'react';
import { Folder, ArrowRight, Clock, Box } from 'lucide-react';

export default function ProjectCard({ project, onOpen }) {
  return (
    <div className="project-card">
      <div>
        <div className="project-card-header">
          <div className="project-icon-box">
            <Folder size={22} />
          </div>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '4px',
            background: project.status === 'ready' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
            color: project.status === 'ready' ? '#10b981' : '#eab308',
            fontWeight: 600
          }}>
            {project.status === 'ready' ? 'Sẵn sàng' : 'Đang xử lý'}
          </span>
        </div>
        <h3 className="project-title">{project.name}</h3>
        <div className="project-meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Box size={14} /> {project.resolution}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> {project.last_updated}
          </span>
        </div>
      </div>
      <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onOpen(project)}>
        <span>Mở Workspace</span>
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
