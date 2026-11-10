// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon trực quan cho từng phân hệ tra cứu hồ sơ nhân vật
import { Palette, Compass, Activity, RefreshCw } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Thanh chuyển đổi 3 phân hệ tra cứu Hồ sơ DNA của nhân vật tham chiếu:
 * - 1. Phong cách mỹ thuật & Bảng vật liệu (Global & Materials)
 * - 2. Không gian 3 hướng nhìn (Down / Side / Up)
 * - 3. Hoạt họa chuyển động (Idle / Walk)
 * 
 * Đã loại bỏ các tab trùng lặp (Tab 4 và Tab 5) để giao diện tinh gọn, không gây rối mắt.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.activeTab Phân hệ đang được kích hoạt ('global' | 'directions' | 'animations').
 * @param {Function} props.onSelectTab Hàm gọi lại khi người dùng chọn tab mới.
 * @param {Object} props.tabStatuses Trạng thái dữ liệu của từng tab ({ global: boolean, ... }).
 * @param {string|null} props.analyzingTab Tên tab đang được gửi yêu cầu phân tích lên máy chủ.
 * @param {Function} props.onAnalyzeTab Hàm kích hoạt phân tích riêng tab hiện tại.
 * @param {boolean} props.disabled Vô hiệu hóa nút bấm khi chưa chọn ảnh sprite mẫu.
 * @returns {React.ReactElement} Giao diện thanh điều hướng 3 phân hệ DNA.
 */
export default function CharacterProfileTabs({
  activeTab,
  onSelectTab,
  tabStatuses,
  analyzingTab,
  onAnalyzeTab,
  disabled
}) {
  // Danh sách 3 phân hệ tra cứu DNA tinh gọn (không bị trùng lặp)
  const tabConfigs = [
    { key: 'global', label: '1. Phong cách & Vật liệu', icon: Palette },
    { key: 'directions', label: '2. 3 Hướng nhìn', icon: Compass },
    { key: 'animations', label: '3. Chuyển động (Animation)', icon: Activity },
  ];

  const isCurrentTabAnalyzing = analyzingTab === activeTab;

  return (
    <div>
      {/* 1. Thanh danh sách 3 Tab phân hệ DNA */}
      <nav className="profile-tabs-header" aria-label="Phân hệ tra cứu DNA nhân vật">
        {tabConfigs.map((tab) => {
          const Icon = tab.icon;
          const isDone = tabStatuses[tab.key];
          const isLoading = analyzingTab === tab.key;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              className={`profile-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.key)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              <span
                className={`profile-tab-badge ${isLoading ? 'loading' : isDone ? 'done' : ''}`}
                title={isLoading ? 'Đang phân tích...' : isDone ? 'Đã có dữ liệu' : 'Chưa phân tích'}
              />
            </button>
          );
        })}
      </nav>

      {/* 2. Thanh tác vụ tinh gọn: Nút quét lại riêng phân hệ này nếu cần */}
      <div className="profile-actions-bar" style={{ justifyContent: 'flex-end', paddingTop: '8px' }}>
        <button
          type="button"
          disabled={disabled || Boolean(analyzingTab)}
          onClick={() => onAnalyzeTab(activeTab)}
          style={{
            fontSize: '0.75rem',
            padding: '5px 10px',
            background: 'var(--accent-secondary-btn)',
            color: 'var(--text-highlight)',
            border: '1px solid var(--accent-purple-glow)',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={13} className={isCurrentTabAnalyzing ? 'spin' : ''} />
          {isCurrentTabAnalyzing ? 'Đang quét lại…' : 'Quét lại riêng phân hệ này'}
        </button>
      </div>
    </div>
  );
}
