// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon trực quan cho từng phân hệ phân tích hồ sơ nhân vật
import { User, Compass, Activity, ShieldCheck, Calculator, Sparkles, RefreshCw } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Thanh chuyển đổi phân hệ (Tabs) và bảng tác vụ phân tích hồ sơ nhân vật.
 * Hỗ trợ chuyển đổi mượt mà giữa 4 phân hệ AI Reference Analysis và 1 phân hệ Toán học nghịch đảo.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.activeTab Phân hệ đang được kích hoạt ('global' | 'directions' | 'animations' | 'constraints' | 'inverse_math').
 * @param {Function} props.onSelectTab Hàm gọi lại khi người dùng chọn tab mới.
 * @param {Object} props.tabStatuses Trạng thái dữ liệu của từng tab ({ global: boolean, ... }).
 * @param {string|null} props.analyzingTab Tên tab đang được gửi yêu cầu phân tích lên máy chủ.
 * @param {Function} props.onAnalyzeTab Hàm kích hoạt phân tích riêng tab hiện tại.
 * @param {Function} props.onAnalyzeAll Hàm kích hoạt phân tích tuần tự toàn bộ hồ sơ.
 * @param {boolean} props.disabled Vô hiệu hóa nút bấm khi chưa chọn ảnh sprite mẫu.
 * @returns {React.ReactElement} Giao diện thanh điều hướng và nút tác vụ.
 */
export default function CharacterProfileTabs({
  activeTab,
  onSelectTab,
  tabStatuses,
  analyzingTab,
  onAnalyzeTab,
  onAnalyzeAll,
  disabled
}) {
  // Danh sách cấu hình 5 tab làm việc chính
  const tabConfigs = [
    { key: 'global', label: '1. Phong cách & Vật liệu', icon: User },
    { key: 'directions', label: '2. 3 Hướng nhìn', icon: Compass },
    { key: 'animations', label: '3. Chuyển động', icon: Activity },
    { key: 'constraints', label: '4. Ràng buộc & Prompt', icon: ShieldCheck },
    { key: 'inverse_math', label: '5. Toán học nghịch đảo', icon: Calculator },
  ];

  const isCurrentTabAnalyzing = analyzingTab === activeTab;
  const isAllAnalyzing = analyzingTab === 'all';

  return (
    <div>
      {/* 1. Thanh danh sách các Tab */}
      <nav className="profile-tabs-header" aria-label="Phân hệ phân tích nhân vật">
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
              {tab.key !== 'inverse_math' && (
                <span
                  className={`profile-tab-badge ${isLoading ? 'loading' : isDone ? 'done' : ''}`}
                  title={isLoading ? 'Đang phân tích...' : isDone ? 'Đã có dữ liệu' : 'Chưa phân tích'}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* 2. Thanh công cụ tác vụ: Quét riêng tab hoặc Quét toàn bộ hồ sơ */}
      {activeTab !== 'inverse_math' && (
        <div className="profile-actions-bar">
          <div className="profile-actions-group">
            {/* Nút quét riêng Tab hiện tại (Tiết kiệm token tối đa) */}
            <button
              type="button"
              disabled={disabled || Boolean(analyzingTab)}
              onClick={() => onAnalyzeTab(activeTab)}
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                background: 'var(--accent-secondary-btn)',
                color: 'var(--text-highlight)',
                border: '1px solid var(--accent-purple-glow)'
              }}
            >
              <RefreshCw size={14} className={isCurrentTabAnalyzing ? 'spin' : ''} />
              {isCurrentTabAnalyzing ? 'Đang quét Tab này…' : 'Quét lại riêng Tab này (Tiết kiệm token)'}
            </button>
          </div>

          <div className="profile-actions-group">
            {/* Nút quét toàn bộ 4 Tab tuần tự */}
            <button
              type="button"
              disabled={disabled || Boolean(analyzingTab)}
              onClick={onAnalyzeAll}
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                background: 'var(--accent-active-tab)',
                color: 'var(--text-white)',
                fontWeight: 600,
                boxShadow: '0 0 10px var(--accent-purple-glow)'
              }}
            >
              <Sparkles size={14} className={isAllAnalyzing ? 'spin' : ''} />
              {isAllAnalyzing ? 'Đang quét toàn bộ 4 Tab…' : 'Quét toàn bộ hồ sơ AI'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
