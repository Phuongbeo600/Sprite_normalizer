// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Hiệu ứng & vòng đời ảnh)
// ========================================================
import React, { useEffect, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)
// ========================================================

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Header xác thực JWT)
// ========================================================
// getAuthHeaders: Đính kèm JWT Bearer Token khi tải ảnh sprite thuộc dự án có chủ sở hữu
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Không sử dụng)
// ========================================================

/**
 * Hiển thị ảnh từ endpoint được bảo vệ bằng JWT (tránh lỗi 401 khi thẻ img tải trực tiếp).
 *
 * @param {Object} props Thuộc tính truyền vào thẻ img.
 * @param {string} props.src Đường dẫn API lấy ảnh.
 * @param {string} props.alt Văn bản thay thế khi ảnh chưa hiển thị.
 * @param {Object} [props.style] Kiểu CSS inline nếu có.
 * @param {string} [props.className] Tên lớp CSS nếu có.
 * @param {Function} [props.onError] Callback khi tải ảnh thất bại.
 * @returns {React.ReactElement|null} Thẻ img với Blob URL an toàn.
 */
export default function ProtectedAssetImage({ src, alt, style, className, onError }) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    if (!src) {
      setObjectUrl('');
      return undefined;
    }

    let cancelled = false;
    let activeBlobUrl = '';

    fetch(src, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        activeBlobUrl = URL.createObjectURL(blob);
        setObjectUrl(activeBlobUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setObjectUrl('');
          if (onError) onError(err);
        }
      });

    return () => {
      cancelled = true;
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [src]);

  if (!objectUrl) return null;

  return <img src={objectUrl} alt={alt} style={style} className={className} />;
}
