import React, { useState } from 'react';
import ActionBar from '../components/projects/ActionBar';
import ProjectRow from '../components/projects/ProjectRow';
import { INITIAL_PROJECTS } from '../constants/initialProjects';

/**
 * PROJECTS PAGE (Bản Tinh Giản)
 */
export default function Projects({ onOpenProject }) {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);

  const handleCreateProject = () => {
    const name = prompt('Nhập tên dự án mới:', 'Dự án Sprite mới');
    if (!name) return;

    const newProj = {
      id: `proj_${Date.now()}`,
      name: name,
      statusText: 'Vừa tạo',
    };
    setProjects([newProj, ...projects]);
  };

  const handleImportProject = () => {
    alert('Tính năng: Chọn thư mục sprite để nhập dự án.');
  };

  return (
    <div className="minimal-projects-page">
      {/* 1. Tiêu Đề Chính */}
      <h1 className="minimal-main-title">
        Dự án của tôi <span className="title-sparkle" aria-hidden="true">✨</span>
      </h1>

      {/* 2. Thanh Nút Thao Tác (Tạo dự án / Nhập dự án) */}
      <ActionBar
        onCreateProject={handleCreateProject}
        onImportProject={handleImportProject}
      />

      {/* 3. Danh Sách Dự Án */}
      <div className="minimal-projects-list">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            onOpen={onOpenProject}
          />
        ))}
      </div>

      {/* 4. Dòng ghi chú động lực ở đáy trang */}
      <div className="minimal-page-footer-note">
        “Không biết có làm được không, nhưng vẫn muốn cố gắng.”
      </div>
    </div>
  );
}
