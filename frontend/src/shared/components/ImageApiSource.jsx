// 1. THƯ VIỆN NỀN TẢNG (Giao diện React)
// React: Hiển thị nhãn nguồn cấu hình mà không nhận khóa bí mật.
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Dùng cùng một kiểu nhãn cho màn tạo ảnh và cài đặt dự án.
import './image-api-source.css';

/** Hiển thị nguồn key đã lưu; nội dung đang gõ chưa làm thay đổi cấu hình có hiệu lực. */
export default function ImageApiSource({ config }) {
  const source = config?.config_source;
  const label = !config ? 'Đang đọc cấu hình…'
    : source === 'system' ? 'Mặc định hệ thống'
    : source === 'project' ? 'Key riêng của dự án'
    : source === 'error' ? 'Chưa đọc được cấu hình'
    : 'Chưa có API key';
  const detail = source === 'system'
    ? 'Dự án chưa lưu key riêng. Tạo ảnh đang dùng cấu hình mặc định của hệ thống.'
    : source === 'project'
    ? 'Tạo ảnh đang dùng key riêng đã lưu trong cài đặt dự án.'
    : 'Trạng thái được xác định từ cấu hình đã lưu trên máy chủ.';
  return <span className={`image-api-source ${source || 'loading'}`} title={detail} role="status">
    <span className="image-api-source-dot" aria-hidden="true" />
    {label}
  </span>;
}
