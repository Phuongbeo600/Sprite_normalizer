// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không dùng thư viện bên ngoài để đảm bảo độ sắc nét pixel thuần túy qua SVG vector)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// pixel-identity.css: Định nghĩa hiệu ứng phát sáng, khử nhòe pixel và hiệu ứng lơ lửng
import './pixel-identity.css';

/**
 * Biểu tượng Rương Báu Ma Thuật Pixel Art (PixelChest).
 * Thích hợp dùng làm Empty State cho Kho tài nguyên (Presets, Sprites).
 * 
 * @param {Object} props Thuộc tính của biểu tượng.
 * @param {number} [props.size=48] Kích thước hiển thị (px).
 * @param {string} [props.className=''] Tên lớp CSS bổ sung.
 * @returns {React.ReactElement} Phần tử SVG Pixel Art sắc nét.
 */
export function PixelChest({ size = 48, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixel-art-icon ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* Thân ngoài & Viền đen bảo vệ */}
      <rect x="2" y="3" width="12" height="11" fill="#0c071a" />
      
      {/* Nắp rương - Vòm trên */}
      <rect x="3" y="2" width="10" height="2" fill="#0c071a" />
      <rect x="3" y="3" width="10" height="4" fill="#3b2063" />
      <rect x="4" y="3" width="8" height="1" fill="#6d28d9" />
      
      {/* Đai viền kim loại vàng hoàng gia trên nắp */}
      <rect x="4" y="3" width="2" height="4" fill="#eab308" />
      <rect x="10" y="3" width="2" height="4" fill="#eab308" />
      
      {/* Thân dưới của rương */}
      <rect x="3" y="7" width="10" height="6" fill="#24133b" />
      <rect x="3" y="7" width="10" height="1" fill="#170c26" />
      
      {/* Đai kim loại vàng thân dưới */}
      <rect x="4" y="8" width="2" height="5" fill="#ca8a04" />
      <rect x="10" y="8" width="2" height="5" fill="#ca8a04" />
      
      {/* Ổ khóa ma thuật phát sáng giữa rương */}
      <rect x="7" y="6" width="2" height="3" fill="#facc15" />
      <rect x="7" y="7" width="2" height="1" fill="#713f12" />
      <rect x="7" y="9" width="2" height="1" fill="#ca8a04" />
      
      {/* Chân đế rương */}
      <rect x="2" y="13" width="2" height="1" fill="#0c071a" />
      <rect x="12" y="13" width="2" height="1" fill="#0c071a" />
    </svg>
  );
}

/**
 * Biểu tượng Tinh Thể Thạch Anh Ma Thuật Pixel Art (PixelCrystal).
 * Thích hợp dùng làm điểm nhấn Logo Sidebar, hoặc Empty State bóc tách phân tích ảnh.
 * 
 * @param {Object} props Thuộc tính của biểu tượng.
 * @param {number} [props.size=48] Kích thước hiển thị (px).
 * @param {string} [props.className=''] Tên lớp CSS bổ sung.
 * @returns {React.ReactElement} Phần tử SVG Pixel Art sắc nét.
 */
export function PixelCrystal({ size = 48, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixel-art-icon ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* Hạt bụi sáng lơ lửng quanh tinh thể */}
      <rect x="2" y="4" width="1" height="1" fill="#f5d0fe" />
      <rect x="13" y="5" width="1" height="1" fill="#c084fc" />
      <rect x="3" y="12" width="1" height="1" fill="#e9d5ff" />
      <rect x="12" y="11" width="1" height="1" fill="#ffffff" />

      {/* Đỉnh chóp pha lê */}
      <rect x="7" y="1" width="2" height="1" fill="#f5d0fe" />
      <rect x="6" y="2" width="4" height="2" fill="#e9d5ff" />

      {/* Thân trên - Mảng đón sáng bên trái */}
      <rect x="5" y="4" width="3" height="3" fill="#d8b4fe" />
      <rect x="4" y="6" width="4" height="2" fill="#c084fc" />
      <rect x="4" y="7" width="2" height="1" fill="#f3e8ff" />

      {/* Thân trên - Mảng bóng tối bên phải */}
      <rect x="8" y="4" width="3" height="3" fill="#9333ea" />
      <rect x="8" y="6" width="4" height="2" fill="#7e22ce" />

      {/* Mép giữa rộng nhất của viên pha lê */}
      <rect x="3" y="7" width="10" height="2" fill="#a855f7" />
      <rect x="4" y="8" width="4" height="1" fill="#e9d5ff" />
      <rect x="8" y="8" width="4" height="1" fill="#6b21a8" />

      {/* Thân dưới thuôn nhọn */}
      <rect x="4" y="9" width="4" height="2" fill="#a855f7" />
      <rect x="8" y="9" width="4" height="2" fill="#581c87" />
      <rect x="5" y="11" width="3" height="2" fill="#7e22ce" />
      <rect x="8" y="11" width="3" height="2" fill="#3b0764" />
      
      {/* Đáy nhọn tinh thể */}
      <rect x="6" y="13" width="4" height="1" fill="#581c87" />
      <rect x="7" y="14" width="2" height="1" fill="#2e1065" />
    </svg>
  );
}

/**
 * Biểu tượng Thanh Kiếm Cổ Hiệp Sĩ Pixel Art (PixelSword).
 * Thích hợp dùng làm hoa văn trang trí, vạch phân cách hoặc huy hiệu.
 * 
 * @param {Object} props Thuộc tính của biểu tượng.
 * @param {number} [props.size=32] Kích thước hiển thị (px).
 * @param {string} [props.className=''] Tên lớp CSS bổ sung.
 * @returns {React.ReactElement} Phần tử SVG Pixel Art sắc nét.
 */
export function PixelSword({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixel-art-icon ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* Chuôi kiếm & Núm cán kiếm bằng vàng */}
      <rect x="2" y="13" width="2" height="2" fill="#ca8a04" />
      <rect x="3" y="11" width="2" height="2" fill="#78350f" />
      <rect x="4" y="10" width="2" height="2" fill="#92400e" />

      {/* Thanh chắn kiếm (Crossguard) */}
      <rect x="3" y="8" width="2" height="2" fill="#eab308" />
      <rect x="5" y="10" width="2" height="2" fill="#ca8a04" />
      <rect x="4" y="9" width="3" height="1" fill="#facc15" />

      {/* Lưỡi kiếm bạc & Lõi ngọc phát sáng xanh thạch anh */}
      <rect x="5" y="7" width="2" height="2" fill="#94a3b8" />
      <rect x="6" y="6" width="2" height="2" fill="#38bdf8" />
      <rect x="7" y="5" width="2" height="2" fill="#e2e8f0" />
      <rect x="8" y="4" width="2" height="2" fill="#38bdf8" />
      <rect x="9" y="3" width="2" height="2" fill="#e2e8f0" />
      <rect x="10" y="2" width="2" height="2" fill="#f8fafc" />
      
      {/* Mũi kiếm sắc nhọn */}
      <rect x="12" y="1" width="2" height="2" fill="#ffffff" />
      <rect x="13" y="0" width="1" height="1" fill="#f8fafc" />
    </svg>
  );
}

/**
 * Biểu tượng Khiên Hộ Vệ Hoàng Gia Pixel Art (PixelShield).
 * Thích hợp dùng cho trang Quản trị Admin, phân quyền người dùng.
 * 
 * @param {Object} props Thuộc tính của biểu tượng.
 * @param {number} [props.size=32] Kích thước hiển thị (px).
 * @param {string} [props.className=''] Tên lớp CSS bổ sung.
 * @returns {React.ReactElement} Phần tử SVG Pixel Art sắc nét.
 */
export function PixelShield({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`pixel-art-icon ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* Vành trên của khiên */}
      <rect x="2" y="2" width="12" height="2" fill="#ca8a04" />
      <rect x="3" y="2" width="10" height="1" fill="#facc15" />

      {/* Thân khiên tím thạch anh */}
      <rect x="2" y="4" width="12" height="5" fill="#4c1d95" />
      <rect x="3" y="4" width="10" height="1" fill="#6d28d9" />

      {/* Biểu tượng chữ thập hoàng gia bạc giữa khiên */}
      <rect x="7" y="4" width="2" height="7" fill="#f8fafc" />
      <rect x="5" y="6" width="6" height="2" fill="#f8fafc" />
      <rect x="7" y="6" width="2" height="2" fill="#38bdf8" />

      {/* Phần thuôn nhọn của khiên */}
      <rect x="3" y="9" width="10" height="2" fill="#3b0764" />
      <rect x="4" y="11" width="8" height="2" fill="#2e1065" />
      <rect x="5" y="13" width="6" height="1" fill="#1e1b4b" />
      <rect x="6" y="14" width="4" height="1" fill="#ca8a04" />
      <rect x="7" y="15" width="2" height="1" fill="#ca8a04" />
    </svg>
  );
}

/**
 * Biểu tượng Hiệp Sĩ Đứng Trên Mỏm Đất Rêu Phong Pixel Art (PixelKnightGround).
 * Thích hợp dùng làm tâm điểm cho trạng thái trống (Empty State) của Dashboard:
 * Hiệp sĩ bóng đêm cắm kiếm đứng canh bên ngọn đèn lồng và đất đá rêu phong.
 * 
 * @param {Object} props Thuộc tính của biểu tượng.
 * @param {number} [props.size=96] Kích thước hiển thị (px).
 * @param {string} [props.className=''] Tên lớp CSS bổ sung.
 * @returns {React.ReactElement} Phần tử SVG Pixel Art sắc nét.
 */
export function PixelKnightGround({ size = 96, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`pixel-art-icon ${className}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden="true"
    >
      {/* 1. MẶT ĐẤT ĐÁ & RÊU PHONG (GROUND / CLIFF) */}
      <rect x="2" y="26" width="28" height="6" fill="#130924" />
      <rect x="1" y="27" width="30" height="5" fill="#0d0517" />
      <rect x="3" y="25" width="26" height="2" fill="#1f113a" />
      
      {/* Lớp cỏ và rêu xanh rìa trên của đất */}
      <rect x="2" y="24" width="28" height="2" fill="#047857" />
      <rect x="3" y="24" width="7" height="1" fill="#10b981" />
      <rect x="11" y="24" width="8" height="1" fill="#34d399" />
      <rect x="20" y="24" width="9" height="1" fill="#10b981" />
      {/* Khóm cỏ pixel nhô lên */}
      <rect x="4" y="23" width="2" height="1" fill="#34d399" />
      <rect x="23" y="23" width="2" height="1" fill="#34d399" />
      <rect x="27" y="23" width="1" height="1" fill="#10b981" />

      {/* 2. CỘT ĐÈN LỒNG BÊN PHẢI (LANTERN POST) */}
      <rect x="25" y="16" width="2" height="9" fill="#5c2c16" />
      <rect x="24" y="15" width="4" height="1" fill="#33180a" />
      {/* Khung đèn & Ánh sáng vàng ấm */}
      <rect x="24" y="11" width="4" height="4" fill="#0f172a" />
      <rect x="25" y="12" width="2" height="2" fill="#facc15" />
      <rect x="25" y="12" width="1" height="1" fill="#fef08a" />
      <rect x="23" y="10" width="6" height="1" fill="#334155" />
      <rect x="25" y="9" width="2" height="1" fill="#475569" />

      {/* 3. HIỆP SĨ BÓNG ĐÊM (THE DARK KNIGHT) */}
      {/* Áo choàng nhung tím thạch anh xõa sau lưng */}
      <rect x="7" y="10" width="5" height="14" fill="#3b0764" />
      <rect x="8" y="9" width="5" height="14" fill="#581c87" />
      <rect x="7" y="14" width="3" height="9" fill="#7e22ce" />
      <rect x="6" y="19" width="2" height="4" fill="#9333ea" />

      {/* Mũ sắt & Khe giáp mắt phát sáng ánh ngọc cyan */}
      <rect x="11" y="5" width="6" height="5" fill="#334155" />
      <rect x="12" y="4" width="4" height="2" fill="#475569" />
      <rect x="12" y="5" width="4" height="1" fill="#64748b" />
      <rect x="15" y="7" width="2" height="1" fill="#38bdf8" />
      <rect x="12" y="8" width="5" height="2" fill="#1e293b" />

      {/* Giáp vai & Áo giáp ngực bằng thép tôi */}
      <rect x="10" y="10" width="8" height="6" fill="#475569" />
      <rect x="11" y="10" width="6" height="1" fill="#94a3b8" />
      <rect x="13" y="11" width="2" height="4" fill="#cbd5e1" />
      <rect x="10" y="11" width="2" height="3" fill="#64748b" />

      {/* Găng tay sắt tựa trên chuôi kiếm */}
      <rect x="16" y="12" width="3" height="3" fill="#ca8a04" />
      <rect x="17" y="13" width="1" height="1" fill="#facc15" />

      {/* Thanh cự kiếm cắm thẳng xuống mỏm đất */}
      <rect x="15" y="11" width="5" height="1" fill="#eab308" />
      <rect x="17" y="10" width="1" height="2" fill="#ca8a04" />
      {/* Lưỡi kiếm bạc cắm vào đất đá */}
      <rect x="17" y="14" width="1" height="11" fill="#e2e8f0" />
      <rect x="18" y="14" width="1" height="10" fill="#94a3b8" />

      {/* Đai lưng & Váy giáp */}
      <rect x="11" y="16" width="6" height="2" fill="#1e293b" />
      <rect x="13" y="16" width="2" height="1" fill="#eab308" />
      
      {/* Giáp chân & Ủng sắt đứng vững trên đá */}
      <rect x="11" y="18" width="3" height="6" fill="#334155" />
      <rect x="14" y="18" width="3" height="6" fill="#1e293b" />
      <rect x="10" y="23" width="4" height="2" fill="#0f172a" />
      <rect x="14" y="23" width="4" height="2" fill="#0f172a" />
    </svg>
  );
}
