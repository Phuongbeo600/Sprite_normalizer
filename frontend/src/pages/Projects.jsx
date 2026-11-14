// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// React dựng giao diện, useState giữ danh sách và useEffect tải dữ liệu từ API.
import React, { useEffect, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có thư viện bên ngoài phụ thuộc)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// ActionBar: Thanh nút tạo dự án mới
import ActionBar from '../components/projects/ActionBar';
// ProjectRow: Dòng hiển thị từng dự án kèm nút mở và nút xóa dự án
import ProjectRow from '../components/projects/ProjectRow';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng Dark UI từ theme.css thông qua index.css

/**
 * Hiển thị danh sách dự án do máy chủ cung cấp theo quyền tài khoản.
 * Hỗ trợ tạo mới và xóa dự án trực tiếp khỏi cơ sở dữ liệu MySQL.
 * 
 * @param {Object} props Thuộc tính của màn hình dự án.
 * @param {Function} props.onOpenProject Hàm nhận dự án được chọn để mở.
 * @param {Object|null} [props.currentUser] Thông tin tài khoản người dùng đang đăng nhập.
 * @returns {React.ReactElement} Giao diện danh sách và các nút thao tác.
 */
export default function Projects({ onOpenProject, currentUser }) {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    /** @returns {Promise<void>} Cập nhật danh sách sau khi tải từ máy chủ. */
    async function loadProjects() {
      try {
        const queryParams = new URLSearchParams();
        if (currentUser?.id) queryParams.append('user_id', currentUser.id);
        if (currentUser?.role) queryParams.append('role', currentUser.role);

        const url = `/api/projects${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Không tải được danh sách dự án.');
        }

        const { data } = await response.json();
        if (controller.signal.aborted) return;

        setProjects(data || []);
      } catch {
        if (!controller.signal.aborted) {
          alert('Không tải được danh sách dự án. Hãy kiểm tra máy chủ rồi tải lại trang.');
        }
      }
    }

    loadProjects();
    return () => controller.abort();
  }, [currentUser?.id, currentUser?.role]);

  /**
   * Thêm dự án vào danh sách sau khi máy chủ MySQL lưu thành công.
   */
  const handleCreateProject = async () => {
    const name = prompt('Nhập tên dự án mới:', 'Dự án Sprite mới')?.trim();
    if (!name) return;

    if (Array.from(name).length > 255) {
      alert('Tên dự án chỉ được dài tối đa 255 ký tự.');
      return;
    }

    const body = new FormData();
    body.append('name', name);
    if (currentUser?.id) {
      body.append('user_id', currentUser.id);
    }

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

  /**
   * Xóa một dự án khỏi cơ sở dữ liệu MySQL và cập nhật lại giao diện.
   * 
   * @param {Object} project Dự án cần xóa.
   */
  const handleDeleteProject = async (project) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa dự án "${project.name}" không?\n\n` +
      `⚠️ CẢNH BÁO: Toàn bộ dữ liệu sprite, hồ sơ phân tích prompt và đội hình nhân vật thuộc dự án này sẽ bị xóa vĩnh viễn khỏi CSDL MySQL!`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể xóa dự án trên máy chủ.');
      }

      // Xóa dự án khỏi danh sách hiển thị
      setProjects((currentProjects) =>
        currentProjects.filter((p) => p.id !== project.id)
      );
    } catch (err) {
      alert(`Lỗi khi xóa dự án: ${err.message || 'Không thể kết nối máy chủ.'}`);
    }
  };

  return (
    <div className="minimal-projects-page">
      {/* 1. Tiêu Đề Chính */}
      <h1 className="minimal-main-title">
        Dự án của tôi <span className="title-sparkle" aria-hidden="true">✨</span>
      </h1>

      {/* 2. Thanh Nút Thao Tác (Chỉ giữ lại nút Tạo dự án) */}
      <ActionBar onCreateProject={handleCreateProject} />

      {/* 3. Danh Sách Dự Án */}
      <div className="minimal-projects-list">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            onOpen={onOpenProject}
            onDelete={handleDeleteProject}
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
