// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa quản trị, người dùng, thùng rác, làm mới, khiên bảo vệ
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
// (Không có component con phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css thông qua index.css

/**
 * Màn hình Quản trị Tài khoản Người dùng (Admin Users Management).
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
   * Xử lý xóa một tài khoản người dùng thường khỏi MySQL.
   * 
   * @param {Object} user Tài khoản cần xóa.
   */
  const handleDeleteUser = async (user) => {
    if (user.role === 'admin' || user.id === 1) {
      alert('Không thể xóa tài khoản Quản trị viên (Admin) tối cao!');
      return;
    }

    if (user.id === 2 || user.username === 'origin@gmail.com') {
      alert('Không thể xóa tài khoản mẫu kiểm thử (origin@gmail.com)!');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài khoản "${user.username}" (ID: ${user.id}) không?\n\n` +
      `⚠️ CẢNH BÁO QUẢN TRỊ: Toàn bộ ${user.project_count || 0} dự án, ảnh sprite, khung frame hoạt họa thuộc tài khoản này sẽ bị xóa sạch khỏi cơ sở dữ liệu MySQL!`
    );
    if (!confirmed) return;

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
    <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', color: 'var(--text-white)' }}>
      {/* 1. Header Trang Quản Trị */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.45rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldAlert size={26} color="#a855f7" />
            Quản Lý Tài Khoản Người Dùng (Admin Panel)
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Xem toàn bộ người dùng trong CSDL MySQL, theo dõi số lượng dự án và dọn dẹp tài khoản vi phạm.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary-studio"
          onClick={fetchUsersList}
          disabled={loading}
          style={{ minHeight: '36px', fontSize: '0.825rem', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* 2. Thẻ Thống Kê Tổng Quan */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="studio-metric-card" style={{ padding: '16px 20px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tổng số tài khoản
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-white)', marginTop: '4px' }}>
            {users.length}
          </div>
        </div>

        <div className="studio-metric-card" style={{ padding: '16px 20px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Quản trị viên (Admin)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#c084fc', marginTop: '4px' }}>
            {users.filter((u) => u.role === 'admin').length}
          </div>
        </div>

        <div className="studio-metric-card" style={{ padding: '16px 20px', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Người dùng thông thường
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            {users.filter((u) => u.role !== 'admin').length}
          </div>
        </div>
      </div>

      {/* 3. Thông Báo Trạng Thái */}
      {feedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.825rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 4. Bảng Danh Sách Tài Khoản Người Dùng Trong MySQL */}
      <div className="studio-metric-card" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-panel)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Users size={18} color="var(--accent-purple)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
            Danh Sách Tài Khoản Trong Cơ Sở Dữ Liệu MySQL ({users.length})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid var(--border-panel)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '12px 16px', width: '60px' }}>ID</th>
                <th style={{ padding: '12px 16px' }}>Tên đăng nhập</th>
                <th style={{ padding: '12px 16px' }}>Vai trò / Quyền hạn</th>
                <th style={{ padding: '12px 16px' }}>Dự án sở hữu</th>
                <th style={{ padding: '12px 16px' }}>Ngày tạo tài khoản</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === 'admin' || u.id === 1;
                const isOriginTest = u.id === 2 || u.username === 'origin@gmail.com';
                const isUndeletable = isAdmin || isOriginTest;
                const isDeleting = deletingId === u.id;

                return (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                      #{u.id}
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>
                      {u.username}
                      {u.username === currentUser?.username && (
                        <span style={{ fontSize: '0.7rem', color: '#c084fc', marginLeft: '6px' }}>
                          (Bạn đang đăng nhập)
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      {isAdmin ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          color: '#c084fc',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          <ShieldCheck size={12} />
                          Admin Tối Cao
                        </span>
                      ) : isOriginTest ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#34d399',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          <Sparkles size={12} />
                          Mẫu Kiểm Thử
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: '#38bdf8',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          Người Dùng
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-white)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <FolderOpen size={14} color="#94a3b8" />
                        <strong>{u.project_count || 0}</strong> dự án
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '0.775rem', color: 'var(--text-dim)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} />
                        {u.created_at || 'Mặc định ban đầu'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {isUndeletable ? (
                        <span style={{
                          fontSize: '0.725rem',
                          color: isOriginTest ? '#34d399' : 'var(--text-dim)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Lock size={12} />
                          {isOriginTest ? 'Kiểm thử (Không xóa)' : 'Không thể xóa'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteUser(u)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: isDeleting ? 'wait' : 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                            e.currentTarget.style.color = '#f87171';
                          }}
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
    </div>
  );
}
