// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React dựng giao diện, useState giữ danh sách và useEffect tải dữ liệu.
import React, { useEffect, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Thanh nút tạo và nhập dự án.
import ActionBar from '../components/projects/ActionBar';
// Dòng hiển thị một dự án và cho phép mở dự án đó.
import ProjectRow from '../components/projects/ProjectRow';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================

/**
 * Hiển thị danh sách dự án do máy chủ cung cấp.
 * @param {object} props Thuộc tính của màn hình dự án.
 * @param {Function} props.onOpenProject Hàm nhận dự án được chọn để mở.
 * @returns {React.ReactElement} Giao diện danh sách và các nút thao tác.
 */
export default function Projects({ onOpenProject }) {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    /** @returns {Promise<void>} Cập nhật danh sách sau khi tải từ máy chủ. */
    async function loadProjects() {
      try {
        const response = await fetch('/api/projects', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Không tải được danh sách dự án.');
        }

        const { data } = await response.json();
        if (controller.signal.aborted) return;

        // Giữ các dự án vừa tạo nếu yêu cầu tải danh sách vẫn đang chạy.
        const loadedIds = new Set(data.map((project) => project.id));
        setProjects((currentProjects) => [
          ...currentProjects.filter((project) => !loadedIds.has(project.id)),
          ...data,
        ]);
      } catch {
        if (!controller.signal.aborted) {
          alert('Không tải được danh sách dự án. Hãy kiểm tra máy chủ rồi tải lại trang.');
        }
      }
    }

    loadProjects();
    return () => controller.abort();
  }, []);

  /** @returns {Promise<void>} Thêm dự án vào danh sách sau khi máy chủ lưu thành công. */
  const handleCreateProject = async () => {
    const name = prompt('Nhập tên dự án mới:', 'Dự án Sprite mới')?.trim();
    if (!name) return;

    if (Array.from(name).length > 255) {
      alert('Tên dự án chỉ được dài tối đa 255 ký tự.');
      return;
    }

    const body = new FormData();
    body.append('name', name);

    try {
      const response = await fetch('/api/projects', { method: 'POST', body });
      if (!response.ok) {
        throw new Error('Không tạo được dự án.');
      }

      const { data } = await response.json();
      setProjects((currentProjects) => [
        data,
        ...currentProjects.filter((project) => project.id !== data.id),
      ]);
    } catch {
      alert('Không xác nhận được dự án đã lưu. Hãy tải lại danh sách trước khi thử lại.');
    }
  };

  /** @returns {void} Hiện thông báo về thao tác nhập thư mục dự án. */
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
