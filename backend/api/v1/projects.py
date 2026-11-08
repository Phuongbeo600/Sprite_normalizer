# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu dữ liệu
from typing import Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo sub-router, xử lý Form và Dependency Injection
from fastapi import APIRouter, Depends, Form, HTTPException
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Database)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# ProjectService: Dịch vụ nghiệp vụ quản lý dự án
from backend.services.project_service import ProjectService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

projects_router = APIRouter(prefix="/projects", tags=["Quản lý Dự án"])
project_service = ProjectService()


@projects_router.get("")
def list_projects(db: Session = Depends(get_db)):
    """Đọc danh sách dự án từ MySQL và trả về dự án mới nhất trước."""
    projects = project_service.get_all_projects(db)
    return {"status": "success", "data": projects}


@projects_router.post("")
def create_project(name: str = Form(...), db: Session = Depends(get_db)):
    """Tạo một dự án mới trong MySQL."""
    try:
        new_project = project_service.create_project(db, name)
        return {
            "status": "success",
            "message": "Tạo dự án thành công!",
            "data": new_project
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu dự án: {str(e)}")


@projects_router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết một dự án theo ID."""
    project = project_service.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    return {"status": "success", "data": project}


@projects_router.put("/{project_id}")
def update_project(project_id: int, name: str = Form(...), db: Session = Depends(get_db)):
    """Cập nhật tên dự án."""
    try:
        success = project_service.update_project(db, project_id, name)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án để cập nhật.")
        return {"status": "success", "message": "Cập nhật dự án thành công!"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật dự án: {str(e)}")


@projects_router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Xóa một dự án theo ID."""
    try:
        success = project_service.delete_project(db, project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án để xóa.")
        return {"status": "success", "message": "Đã xóa dự án thành công!"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa dự án: {str(e)}")
