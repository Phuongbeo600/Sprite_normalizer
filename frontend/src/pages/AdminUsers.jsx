// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng quản trị, người dùng, thùng rác, làm mới, khiên bảo vệ, ổ khóa
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  RefreshCw,
  FolderOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// PixelArtIcons: Biểu tượng khiên hộ vệ hoàng gia pixel art
import { PixelShield } from '../components/common/PixelArtIcons';
// AtelierModalDialog: Hộp thoại nổi nội bộ chuẩn Dark Fantasy Atelier thay thế confirm/alert
import AtelierModalDialog from '../components/common/AtelierModalDialog';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ admin-atelier.css
import '../styles/admin-atelier.css';

/**
 * Màn hình Quản trị Tài khoản Người dùng (Admin Users Management) — Dark Fantasy Atelier Edition.
 * Dành riêng cho tài khoản Quản trị viên (Admin):
 * - Xem danh sách toàn bộ tài khoản trong CSDL MySQL.
 * - Xem số lượng dự án thuộc quyền sở hữu của từng tài khoản.
 * - Xóa tài khoản người dùng thường và dọn dẹp sạch sẽ toàn bộ dự án của họ.
 * - Chặn không cho xóa tài khoản Admin tối cao.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentUser Tài khoản Admin hiện tại đang đăng nhập.
 * @returns {React.ReactElement} Giao diện trang quản trị tài khoản.
 */
export default function AdminUsers({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [deletingId, setDeletingId] = useState(null);

  // Trạng thái mở hộp thoại nổi xác nhận xóa tài khoản (thay thế window.confirm)
  const [userToDelete, setUserToDelete] = useState(null);
  // Trạng thái mở hộp thoại nổi cảnh báo không thể xóa (thay thế window.alert)
  const [warningMessage, setWarningMessage] = useState(null);

  useEffect(() => {
    fetchUsersList();
  }, []);

  /**
   * Gọi API GET /api/users để lấy danh sách toàn bộ người dùng từ CSDL MySQL.
   */
  const fetchUsersList = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/users?admin_role=admin');
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Không thể tải danh sách tài khoản.');
      }

      const resJson = await response.json();
      setUsers(resJson.data || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mở hộp thoại nổi xác nhận xóa một tài khoản người dùng thường khỏi MySQL.
   * 
   * @param {Object} user Tài khoản cần xóa.
   */
  const handleRequestDeleteUser = (user) => {
    if (user.role === 'admin' || user.id === 1) {
      setWarningMessage('Không thể xóa tài khoản Quản trị viên (Admin) tối cao!');
      return;
    }

    if (user.id === 2 || user.username === 'origin@gmail.com') {
      setWarningMessage('Không thể xóa tài khoản mẫu kiểm thử (origin@gmail.com)!');
      return;
    }

    setUserToDelete(user);
  };

  /**
   * Xử lý xác nhận xóa vĩnh viễn tài khoản người dùng sau khi bấm trên hộp thoại nổi.
   */
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const user = userToDelete;
    setUserToDelete(null);

    setDeletingId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}?admin_role=admin`, {
        method: 'DELETE'
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.detail || 'Không thể xóa tài khoản này.');
      }

      setFeedback({
        type: 'success',
        message: `Đã xóa tài khoản "${user.username}" và dọn dẹp sạch sẽ toàn bộ dự án liên quan thành công!`
      });

      // Cập nhật lại danh sách trực tiếp
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi xóa tài khoản.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="atelier-admin-root">
      {/* 1. Header Trang Quản Trị */}
      <div className="atelier-admin-header">
        <div className="atelier-admin-header-title">
          <h1 className="atelier-admin-title-heading">
            <PixelShield size={26} className="pixel-art-icon pixel-art-glow" />
            <span>Quản Trị Người Dùng Hệ Thống (Master Realm Control)</span>
          </h1>
          <p className="atelier-admin-title-subtext">
            Giám sát toàn bộ tài khoản trong MySQL, theo dõi quyền hạn và số lượng dự án thuộc sở hữu.
          </p>
        </div>

        <button
          type="button"
          className="atelier-assets-btn-refresh"
          onClick={fetchUsersList}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* 2. Thẻ Thống Kê Tổng Quan */}
      <div className="atelier-admin-stats-grid">
        <div className="atelier-admin-stat-card">
          <div className="atelier-admin-stat-label">Tổng số tài khoản</div>
          <div className="atelier-admin-stat-value">{users.length}</div>
        </div>

        <div className="atelier-admin-stat-card">
          <div className="atelier-admin-stat-label">Quản trị viên (Admin)</div>
          <div className="atelier-admin-stat-value amethyst">
            {users.filter((u) => u.role === 'admin').length}
          </div>
        </div>

        <div className="atelier-admin-stat-card">
          <div className="atelier-admin-stat-label">Người dùng thông thường</div>
          <div className="atelier-admin-stat-value cyan">
            {users.filter((u) => u.role !== 'admin').length}
          </div>
        </div>
      </div>

      {/* 3. Thông Báo Trạng Thái */}
      {feedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: '0.825rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 4. Bảng Danh Sách Tài Khoản Người Dùng Trong MySQL */}
      <div className="atelier-admin-table-card">
        <div className="atelier-admin-table-header">
          <Users size={18} color="#c084fc" />
          <h3>Danh Sách Tài Khoản Trong Cơ Sở Dữ Liệu MySQL ({users.length})</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="atelier-admin-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Tên đăng nhập</th>
                <th>Vai trò / Quyền hạn</th>
                <th>Dự án sở hữu</th>
                <th>Ngày tạo tài khoản</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === 'admin' || u.id === 1;
                const isOriginTest = u.id === 2 || u.username === 'origin@gmail.com';
                const isUndeletable = isAdmin || isOriginTest;
                const isDeleting = deletingId === u.id;

                return (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'monospace', color: '#6e658a' }}>
                      #{u.id}
                    </td>

                    <td style={{ fontWeight: 600, color: '#ffffff' }}>
                      {u.username}
                      {u.username === currentUser?.username && (
                        <span style={{ fontSize: '0.72rem', color: '#c084fc', marginLeft: '8px', fontWeight: 500 }}>
                          (Bạn đang đăng nhập)
                        </span>
                      )}
                    </td>

                    <td>
                      {isAdmin ? (
                        <span className="atelier-admin-badge admin">
                          <ShieldCheck size={12} />
                          <span>Admin Tối Cao</span>
                        </span>
                      ) : isOriginTest ? (
                        <span className="atelier-admin-badge tester">
                          <Sparkles size={12} />
                          <span>Mẫu Kiểm Thử</span>
                        </span>
                      ) : (
                        <span className="atelier-admin-badge user">
                          <span>Người Dùng</span>
                        </span>
                      )}
                    </td>

                    <td style={{ color: '#f5f3ff' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <FolderOpen size={14} color="#94a3b8" />
                        <strong>{u.project_count || 0}</strong> dự án
                      </span>
                    </td>

                    <td style={{ fontSize: '0.775rem', color: 'var(--atl-text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} />
                        {u.created_at || 'Mặc định ban đầu'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {isUndeletable ? (
                        <span style={{
                          fontSize: '0.725rem',
                          color: isOriginTest ? '#34d399' : '#6e658a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <Lock size={12} />
                          <span>{isOriginTest ? 'Kiểm thử (Không xóa)' : 'Bảo vệ'}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleRequestDeleteUser(u)}
                          className="atelier-admin-btn-delete"
                          title={`Xóa tài khoản ${u.username}`}
                        >
                          <Trash2 size={13} className={isDeleting ? 'spin' : ''} />
                          <span>{isDeleting ? 'Đang xóa...' : 'Xóa tài khoản'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hộp thoại nổi xác nhận xóa tài khoản người dùng */}
      <AtelierModalDialog
        isOpen={Boolean(userToDelete)}
        type="confirm"
        isDestructive={true}
        title="Xác Nhận Xóa Tài Khoản"
        message={`Bạn có chắc chắn muốn xóa tài khoản "${userToDelete?.username}" (ID: ${userToDelete?.id}) không? CẢNH BÁO: Toàn bộ ${userToDelete?.project_count || 0} dự án, ảnh sprite, khung frame hoạt họa thuộc tài khoản này sẽ bị xóa sạch khỏi MySQL!`}
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy bỏ"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Hộp thoại nổi cảnh báo bảo vệ tài khoản */}
      <AtelierModalDialog
        isOpen={Boolean(warningMessage)}
        type="alert"
        isDestructive={true}
        title="Bảo Vệ Tài Khoản"
        message={warningMessage || ''}
        confirmText="Đã hiểu"
        onConfirm={() => setWarningMessage(null)}
        onCancel={() => setWarningMessage(null)}
      />
    </div>
  );
}
