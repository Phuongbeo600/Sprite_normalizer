// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useEffect, useState, useMemo } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng tìm kiếm, lưới, danh sách, dấu cộng, tia sáng, vương miện, thùng rác
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  Crown,
  FolderOpen,
  X,
  Layers,
  Gamepad2,
  CheckCircle2
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// ProjectRow: Component hiển thị thẻ dự án ở cả chế độ Lưới (Grid) và Danh sách (List)
import ProjectRow from '../components/projects/ProjectRow';
// PixelArtIcons: Biểu tượng hiệp sĩ đứng trên mỏm đất rêu phong pixel art
import { PixelKnightGround } from '../components/common/PixelArtIcons';
// AtelierModalDialog: Hộp thoại nổi nội bộ chuẩn Dark Fantasy Atelier thay thế prompt/confirm
import AtelierModalDialog from '../components/common/AtelierModalDialog';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier chuyên biệt cho Dashboard
import '../styles/dashboard-atelier.css';

/**
 * Màn hình Trung tâm Dự án Atelier (Dark Fantasy Atelier Dashboard).
 * Tái định hình toàn diện giao diện theo tỉ lệ:
 * - 70% Professional Creative Tool (Tìm kiếm, Thẻ lưới, Chuyển chế độ xem, Phím tắt)
 * - 30% Dark Fantasy Pixel Art (Không khí Lâu đài Gothic, Kính hun khói, Điểm nhấn Thạch anh)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Function} props.onOpenProject Hàm mở dự án được chọn vào bàn làm việc.
 * @param {Object|null} [props.currentUser] Thông tin tài khoản người dùng hiện đang đăng nhập.
 * @returns {React.ReactElement} Giao diện Dashboard phong cách Dark Fantasy Atelier.
 */
export default function Projects({ onOpenProject, currentUser }) {
  // Danh sách dự án từ máy chủ MySQL
  const [projects, setProjects] = useState([]);
  // Từ khóa tìm kiếm dự án trực tiếp
  const [searchQuery, setSearchQuery] = useState('');
  // Chế độ hiển thị: 'grid' (Lưới thẻ trực quan) hoặc 'list' (Bảng danh sách kỹ thuật)
  const [viewMode, setViewMode] = useState('grid');
  // Trạng thái đang tải dữ liệu
  const [loading, setLoading] = useState(true);

  // Trạng thái mở hộp thoại nổi khởi tạo dự án mới (thay thế window.prompt)
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Trạng thái mở hộp thoại nổi xác nhận xóa dự án (thay thế window.confirm)
  const [projectToDelete, setProjectToDelete] = useState(null);
  // Trạng thái hiển thị thông báo lỗi hệ thống
  const [dialogError, setDialogError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    /**
     * Tải danh sách dự án thuộc quyền sở hữu của người dùng từ cơ sở dữ liệu MySQL.
     */
    async function loadProjects() {
      setLoading(true);
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
          console.error('Không tải được danh sách dự án từ máy chủ.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProjects();
    return () => controller.abort();
  }, [currentUser?.id, currentUser?.role]);

  /**
   * Mở hộp thoại nổi khởi tạo dự án mới.
   */
  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
  };

  /**
   * Xử lý xác nhận tạo dự án mới từ hộp thoại nổi.
   * 
   * @param {string} projectName Tên dự án người dùng nhập vào.
   */
  const handleConfirmCreate = async (projectName) => {
    const name = (projectName || '').trim();
    if (!name) return;

    if (Array.from(name).length > 255) {
      setDialogError('Tên dự án chỉ được dài tối đa 255 ký tự.');
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
        throw new Error('Không tạo được dự án trên máy chủ.');
      }

      const { data } = await response.json();
      setProjects((currentProjects) => [
        data,
        ...currentProjects.filter((project) => project.id !== data.id),
      ]);
      setShowCreateModal(false);
    } catch {
      setDialogError('Không xác nhận được dự án đã lưu. Hãy thử lại.');
    }
  };

  /**
   * Mở hộp thoại nổi xác nhận xóa một bản ghi dự án.
   * 
   * @param {Object} project Bản ghi dự án cần xóa.
   */
  const handleOpenDeleteConfirm = (project) => {
    setProjectToDelete(project);
  };

  /**
   * Xử lý xác nhận xóa vĩnh viễn dự án khỏi MySQL.
   */
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể xóa dự án trên máy chủ.');
      }

      setProjects((currentProjects) =>
        currentProjects.filter((p) => p.id !== projectToDelete.id)
      );
      setProjectToDelete(null);
    } catch (err) {
      setDialogError(`Lỗi khi xóa dự án: ${err.message || 'Không thể kết nối máy chủ.'}`);
    }
  };

  /**
   * Lọc danh sách dự án thời gian thực theo từ khóa tìm kiếm của người dùng.
   */
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => p.name?.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  // Tên hiển thị người dùng trang trọng
  const userGreeting = currentUser?.first_name || currentUser?.username || 'Bậc Thầy Nghệ Thuật';

  return (
    <div className="atelier-dashboard-root">
      {/* ================================================================ */}
      {/* 1. BANNER TOÀN CẢNH ATELIER (ATMOSPHERIC HERO SECTION)           */}
      {/* ================================================================ */}
      <section className="atelier-hero-banner" aria-label="Giới thiệu xưởng sáng tạo">
        <div className="atelier-hero-content">
          <div className="atelier-hero-badge">
            <Sparkles size={13} />
            <span>Xưởng Sáng Tạo Sprite &amp; Pixel Art AI</span>
          </div>

          <h1 className="atelier-hero-title">
            Chào mừng trở lại, <span>{userGreeting}</span>
          </h1>

          <p className="atelier-hero-desc">
            Không gian kiến tạo nhân vật, tự động chuẩn hóa hoạt họa đa frame và xuất bản trực tiếp chuẩn Godot Engine 4.3.
          </p>
        </div>

        {/* Thống kê nhanh ở góc phải Hero */}
        <div className="atelier-hero-stats">
          <div className="atelier-stat-pill">
            <span className="atelier-stat-val">{projects.length}</span>
            <span className="atelier-stat-label">Bản vẽ</span>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. THANH ĐIỀU KHIỂN & BỘ LỌC STUDIO (STUDIO COMMAND BAR)         */}
      {/* ================================================================ */}
      <div className="atelier-command-bar">
        {/* Ô Tìm Kiếm Dự Án Nhanh */}
        <div className="atelier-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm bản vẽ dự án theo tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="atelier-search-clear"
              onClick={() => setSearchQuery('')}
              title="Xóa từ khóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Các Tùy Chọn Điều Khiển & Bộ Chuyển Chế Độ Xem */}
        <div className="atelier-command-actions">
          {/* Bộ chuyển đổi chế độ xem Lưới (Grid) / Danh sách (List) */}
          <div className="atelier-view-toggle" role="group" aria-label="Chế độ hiển thị">
            <button
              type="button"
              className={`atelier-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Xem dạng thẻ lưới trực quan (Grid Gallery)"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`atelier-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Xem dạng bảng danh sách kỹ thuật (List Table)"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 3. KHU VỰC HIỂN THỊ CÁC BẢN VẼ DỰ ÁN                             */}
      {/* ================================================================ */}
      {filteredProjects.length > 0 ? (
        viewMode === 'grid' ? (
          /* CHẾ ĐỘ 1: THẺ LƯỚI TRỰC QUAN (GRID VIEW) */
          <div className="atelier-grid-view">
            {/* Thẻ Khởi Tạo Nhanh Luôn Nằm Ở Đầu Lưới */}
            <div
              className="atelier-quick-create-card"
              onClick={handleOpenCreateModal}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpenCreateModal();
              }}
              title="Bấm vào đây để tạo nhanh bản vẽ mới"
            >
              <div className="atelier-quick-icon-circle">
                <Plus size={24} strokeWidth={2.5} />
              </div>
              <h3 className="atelier-quick-create-title">Khởi tạo bản vẽ mới</h3>
              <p className="atelier-quick-create-sub">
                Tạo dự án mới với chuẩn cắt pixel &amp; xuất Godot 4
              </p>
            </div>

            {/* Danh sách các Thẻ Dự Án Trong CSDL */}
            {filteredProjects.map((project, idx) => (
              <ProjectRow
                key={project.id}
                project={project}
                index={idx}
                viewMode="grid"
                onOpen={onOpenProject}
                onDelete={handleOpenDeleteConfirm}
              />
            ))}
          </div>
        ) : (
          /* CHẾ ĐỘ 2: BẢNG DANH SÁCH KỸ THUẬT (LIST VIEW) */
          <div className="atelier-list-view">
            {filteredProjects.map((project, idx) => (
              <ProjectRow
                key={project.id}
                project={project}
                index={idx}
                viewMode="list"
                onOpen={onOpenProject}
                onDelete={handleOpenDeleteConfirm}
              />
            ))}
          </div>
        )
      ) : searchQuery ? (
        /* Trạng thái khi không tìm thấy kết quả tìm kiếm */
        <div className="atelier-empty-stage">
          <Search size={36} />
          <h3 className="atelier-empty-title">Không tìm thấy bản vẽ</h3>
          <p className="atelier-empty-desc">
            Không có dự án nào khớp với từ khóa "{searchQuery}". Hãy thử tìm với tên khác.
          </p>
        </div>
      ) : (
        /* Trạng thái rỗng ban đầu khi CSDL chưa có dự án nào (Hiệp sĩ đứng trên mỏm đất) */
        <div className="atelier-empty-stage">
          <div className="pixel-empty-icon-wrap" style={{ marginBottom: '14px' }}>
            <div className="pixel-empty-circle-aura" style={{ width: '130px', height: '130px' }} />
            <PixelKnightGround size={110} className="pixel-art-glow pixel-art-float" />
          </div>
          <h3 className="atelier-empty-title">Hiệp sĩ đang đợi lệnh khởi tạo bản vẽ đầu tiên</h3>
          <p className="atelier-empty-desc">
            Xưởng sáng tạo đang trống. Hãy bắt đầu hành trình bằng cách bấm nút "Khởi tạo dự án" để tạo bản vẽ sprite đầu tiên.
          </p>
          <button
            type="button"
            className="atelier-cta-create-btn"
            onClick={handleOpenCreateModal}
            style={{ marginTop: '12px' }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Tạo dự án đầu tiên</span>
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* 4. CHÂN TRANG & THÔNG ĐIỆP ĐỘNG LỰC ATELIER                      */}
      {/* ================================================================ */}
      <footer className="atelier-dashboard-footer" style={{ justifyContent: 'center' }}>
        <div className="atelier-footer-quote">
          “Không biết có làm được không, nhưng vẫn muốn cố gắng.”
        </div>
      </footer>

      {/* ================================================================ */}
      {/* 5. CÁC HỘP THOẠI NỔI NỘI BỘ (DARK FANTASY ATELIER DIALOGS)       */}
      {/* ================================================================ */}
      {/* Hộp thoại Prompt: Khởi tạo bản vẽ dự án mới */}
      <AtelierModalDialog
        isOpen={showCreateModal}
        type="prompt"
        title="Khởi Tạo Bản Vẽ Dự Án Mới"
        message="Nhập tên bản vẽ sprite mới để chuẩn bị không gian làm việc và đồng bộ vào MySQL:"
        defaultValue="Dự án Pixel RPG"
        placeholder="VD: Dự án Pixel RPG, Hiệp sĩ bóng đêm..."
        confirmText="Khởi tạo bản vẽ"
        cancelText="Hủy bỏ"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowCreateModal(false)}
      />

      {/* Hộp thoại Confirm: Xác nhận xóa vĩnh viễn dự án */}
      <AtelierModalDialog
        isOpen={Boolean(projectToDelete)}
        type="confirm"
        isDestructive={true}
        title="Xác Nhận Xóa Bản Vẽ Dự Án"
        message={`Bạn có chắc chắn muốn xóa vĩnh viễn dự án "${projectToDelete?.name}" không? Toàn bộ dữ liệu sprite, hồ sơ nhân vật và thiết lập frame sẽ bị loại bỏ khỏi CSDL MySQL.`}
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy bỏ"
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* Hộp thoại Alert: Cảnh báo lỗi */}
      <AtelierModalDialog
        isOpen={Boolean(dialogError)}
        type="alert"
        isDestructive={true}
        title="Thông Báo Hệ Thống"
        message={dialogError || ''}
        confirmText="Đã hiểu"
        onConfirm={() => setDialogError(null)}
        onCancel={() => setDialogError(null)}
      />
    </div>
  );
}
