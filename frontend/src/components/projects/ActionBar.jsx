import React from 'react';
import { Plus, Upload } from 'lucide-react';

/**
 * ACTION BAR (Bản Tinh Giản)
 * Gồm 2 nút: "+ Tạo dự án" và "↑ Nhập dự án"
 */
export default function ActionBar({ onCreateProject, onImportProject }) {
  return (
    <div className="minimal-action-bar">
      <button 
        className="btn-create-purple" 
        onClick={onCreateProject}
      >
        <Plus size={15} strokeWidth={2.5} />
        <span>Tạo dự án</span>
      </button>

      <button 
        className="btn-import-dark" 
        onClick={onImportProject}
      >
        <Upload size={14} />
        <span>Nhập dự án</span>
      </button>
    </div>
  );
}
