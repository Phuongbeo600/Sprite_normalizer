# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý bộ đệm luồng byte cho hình ảnh tải lên và trả về
import io
# os: Đọc biến môi trường hệ thống như GEMINI_API_KEY
import os
# Path: Định vị đường dẫn tuyệt đối tới file cấu hình .env ở thư mục gốc
from pathlib import Path
# base64: Mã hóa hình ảnh kết quả phân tích sang base64 để hiển thị tức thời trên trình duyệt
import base64
# asdict: Chuyển đổi dataclass CharacterMetrics sang dictionary JSON
from dataclasses import asdict
# typing: Khai báo kiểu dữ liệu
from typing import Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Gửi HTTP request thử nghiệm kết nối tới Google Generative AI
import requests
# fastapi: Framework xây dựng REST API hiệu năng cao
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
# Response: Trả về dữ liệu ảnh trực tiếp dưới dạng binary stream
from fastapi.responses import Response
# BaseModel: Định nghĩa schema kiểm tra tính hợp lệ dữ liệu gửi lên
from pydantic import BaseModel
# PIL (Pillow): Thư viện xử lý hình ảnh sprite
from PIL import Image
# sqlalchemy: Thao tác thực thi câu truy vấn cơ sở dữ liệu MySQL
from sqlalchemy import text

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Algorithms & Database)
# ========================================================
# SpriteNormalizer: Thuật toán cắt viền và căn lề điểm neo Sprite
from backend.core.normalizer import SpriteNormalizer
# CharacterAnalyzer & CharacterMetrics: Bộ phân tích hình học & giải phẫu học cơ thể Sprite
from backend.core.character_analyzer import CharacterAnalyzer, CharacterMetrics
# PromptAdvisor: Bộ máy Toán học Nghịch đảo và sinh Prompt AI Pixel Art
from backend.core.prompt_advisor import PromptAdvisor
# get_db: Dependency cấp phiên kết nối MySQL
from backend.db import get_db

api_router = APIRouter(prefix="/api", tags=["Sprite Operations"])


# ========================================================
# ROUTE QUẢN LÝ DỰ ÁN (PROJECTS - MYSQL)
# ========================================================
@api_router.get("/projects")
def list_projects(db=Depends(get_db)):
    """
    Đọc danh sách dự án từ MySQL và trả về dự án mới nhất trước.
    """
    rows = db.execute(
        text("SELECT id, name, created_at FROM projects ORDER BY id DESC")
    ).mappings()

    return {"status": "success", "data": [dict(row) for row in rows]}


@api_router.post("/projects")
def create_project(name: str = Form(...), db=Depends(get_db)):
    """
    Lưu tên dự án mới vào MySQL và trả về ID được cấp.
    """
    name = name.strip()

    if not name or len(name) > 255:
        raise HTTPException(
            status_code=422,
            detail="Tên dự án phải có từ 1 đến 255 ký tự.",
        )

    result = db.execute(
        text("INSERT INTO projects (name) VALUES (:name)"),
        {"name": name},
    )
    project_id = result.lastrowid
    db.commit()

    return {"status": "success", "data": {"id": project_id, "name": name}}


# ========================================================
# ROUTE CHUẨN HÓA KÍCH THƯỚC SPRITE (NORMALIZATION)
# ========================================================
@api_router.post("/normalize")
async def normalize_sprite(
    file: UploadFile = File(...),
    target_width: int = Form(64),
    target_height: int = Form(64),
    anchor: str = Form("bottom_center")
):
    """
    Nhận 1 ảnh sprite, thực hiện chuẩn hóa biên và căn lề qua thuật toán core (MVC).
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        normalizer = SpriteNormalizer(
            target_width=target_width,
            target_height=target_height,
            anchor=anchor
        )
        normalized = normalizer.normalize_frame(image)

        out_buffer = io.BytesIO()
        normalized.save(out_buffer, format="PNG")
        out_buffer.seek(0)

        return Response(content=out_buffer.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý sprite: {str(e)}")


# ========================================================
# ROUTE PHÂN TÍCH GIẢI PHẪU HỌC SPRITE (CHARACTER ANALYZER)
# ========================================================
@api_router.post("/analyze")
async def analyze_character(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    auto_remove_bg: bool = Form(True),
    use_ai: bool = Form(False)
):
    """
    Phân tích tỷ lệ giải phẫu học của Sprite:
    - Tự động nhận diện đầu, thân, cổ, hông, mặt đất tiếp xúc.
    - Hỗ trợ kết hợp AI Gemini Vision (nếu bật use_ai và có API Key trong form hoặc biến môi trường).
    - Vẽ trực quan các hộp bounding box giải phẫu và trả về ảnh Base64.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Chỉ sử dụng API Key khi người dùng bật cờ use_ai
        effective_key = (api_key or os.getenv("GEMINI_API_KEY")) if use_ai else None

        metrics, message = CharacterAnalyzer.analyze_with_ai(
            image_or_path=image,
            api_key=effective_key,
            auto_remove_solid_bg=auto_remove_bg
        )

        if not metrics:
            raise HTTPException(status_code=400, detail=message)

        # Vẽ ảnh trực quan có hộp bao (Bounding Box) giải phẫu
        annotated_img = CharacterAnalyzer.draw_annotated_image(image, metrics, scale=2)
        out_buffer = io.BytesIO()
        annotated_img.save(out_buffer, format="PNG")
        annotated_b64 = base64.b64encode(out_buffer.getvalue()).decode("utf-8")

        return {
            "status": "success",
            "message": message,
            "metrics": asdict(metrics),
            "annotated_image": f"data:image/png;base64,{annotated_b64}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích giải phẫu: {str(e)}")


# ========================================================
# ROUTE CỐ VẤN PROMPT AI & TOÁN HỌC NGHỊCH ĐẢO (PROMPT ADVISOR)
# ========================================================
class PromptAdviceRequest(BaseModel):
    metrics: Dict[str, Any]
    character_concept: str = "Chiến binh Pixel Art dũng mãnh"
    head_rule: str = "Bằng nhân vật gốc (Tỷ lệ chuẩn)"
    body_width_rule: str = "Bằng nhân vật gốc"
    body_height_rule: str = "Bằng nhân vật gốc"
    api_key: Optional[str] = None


@api_router.post("/prompt-advice")
async def get_prompt_advice(request: PromptAdviceRequest):
    """
    Sinh Prompt tối ưu cho Midjourney / DALL-E / Leonardo AI dựa trên toán học nghịch đảo từ nhân vật mẫu:
    - Tính toán tỷ lệ đầu và không gian chiếm dụng trên khung hình AI 1024x1024.
    - Đồng bộ mật độ hạt pixel theo hệ 8-bit, 16-bit hay 32-bit.
    """
    try:
        # Tái tạo đối tượng CharacterMetrics từ dictionary
        metrics_data = request.metrics
        metrics = CharacterMetrics(
            canvas_width=metrics_data.get("canvas_width", 64),
            canvas_height=metrics_data.get("canvas_height", 64),
            visible_x_min=metrics_data.get("visible_x_min", 0),
            visible_y_min=metrics_data.get("visible_y_min", 0),
            visible_x_max=metrics_data.get("visible_x_max", 64),
            visible_y_max=metrics_data.get("visible_y_max", 64),
            visible_width=metrics_data.get("visible_width", 64),
            visible_height=metrics_data.get("visible_height", 64),
            neck_y=metrics_data.get("neck_y", 20),
            head_x_min=metrics_data.get("head_x_min", 10),
            head_y_min=metrics_data.get("head_y_min", 0),
            head_x_max=metrics_data.get("head_x_max", 50),
            head_y_max=metrics_data.get("head_y_max", 20),
            head_width=metrics_data.get("head_width", 40),
            head_height=metrics_data.get("head_height", 20),
            body_x_min=metrics_data.get("body_x_min", 10),
            body_y_min=metrics_data.get("body_y_min", 21),
            body_x_max=metrics_data.get("body_x_max", 50),
            body_y_max=metrics_data.get("body_y_max", 64),
            body_width=metrics_data.get("body_width", 40),
            body_height=metrics_data.get("body_height", 44),
            torso_height=metrics_data.get("torso_height", 20),
            torso_width=metrics_data.get("torso_width", 40),
            head_ratio=metrics_data.get("head_ratio", 0.31),
            heads_tall=metrics_data.get("heads_tall", 3.2),
            head_to_body_width_ratio=metrics_data.get("head_to_body_width_ratio", 1.0),
            body_aspect_ratio=metrics_data.get("body_aspect_ratio", 0.9),
            style_category=metrics_data.get("style_category", "Semi-Chibi"),
            summary_text=metrics_data.get("summary_text", ""),
            crotch_y=metrics_data.get("crotch_y"),
            ground_y=metrics_data.get("ground_y"),
            detection_source=metrics_data.get("detection_source", "Heuristic"),
            ai_feedback=metrics_data.get("ai_feedback")
        )

        effective_key = request.api_key or os.getenv("GEMINI_API_KEY")

        advice = PromptAdvisor.generate_prompt(
            metrics=metrics,
            head_rule=request.head_rule,
            body_width_rule=request.body_width_rule,
            body_height_rule=request.body_height_rule,
            character_concept=request.character_concept,
            api_key=effective_key
        )

        return {
            "status": "success",
            "data": advice
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi sinh Prompt Cố vấn: {str(e)}")


# ========================================================
# HÀM BẢO MẬT & QUẢN LÝ CẤU HÌNH API KEY (.ENV)
# ========================================================
def mask_api_key(key: str) -> str:
    """
    Rút gọn và che giấu (masking/hashcode) API Key để tránh lộ lọt trên màn hình.
    Ví dụ: 'AIzaSy1234567890abcdef' -> 'AIzaSy••••••••••••cdef'
    """
    if not key:
        return ""
    key = key.strip()
    if len(key) <= 8:
        return "••••••••"
    return f"{key[:6]}{'•' * max(6, len(key) - 10)}{key[-4:]}"


def save_api_key_to_env(new_key: str):
    """
    Lưu khóa API an toàn vào file .env ở thư mục gốc và cập nhật ngay vào biến môi trường hệ thống.
    """
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    lines = []
    found = False

    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith("GEMINI_API_KEY="):
            new_lines.append(f'GEMINI_API_KEY="{new_key}"\n')
            found = True
        else:
            new_lines.append(line)

    if not found:
        if new_lines and not new_lines[-1].endswith("\n"):
            new_lines[-1] += "\n"
        new_lines.append(f'GEMINI_API_KEY="{new_key}"\n')

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    # Cập nhật trực tiếp vào bộ nhớ RAM hệ thống
    os.environ["GEMINI_API_KEY"] = new_key


# ========================================================
# ROUTE CÀI ĐẶT CẤU HÌNH API (SETTINGS)
# ========================================================
class SaveApiKeyRequest(BaseModel):
    api_key: str


class TestApiKeyRequest(BaseModel):
    api_key: Optional[str] = None


@api_router.get("/settings")
async def get_settings():
    """
    Đọc trạng thái cấu hình API Key hiện tại.
    Chỉ trả về chuỗi đã được che giấu (masking) để bảo vệ bản quyền và bảo mật.
    """
    key = os.getenv("GEMINI_API_KEY", "")
    return {
        "status": "success",
        "has_key": bool(key.strip()),
        "masked_key": mask_api_key(key)
    }


@api_router.post("/settings")
async def save_settings(request: SaveApiKeyRequest):
    """
    Lưu Google Gemini API Key mới vào file .env và cập nhật biến môi trường tức thì.
    """
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Khóa API không được để trống.")

    save_api_key_to_env(key)
    return {
        "status": "success",
        "message": "Đã lưu và cập nhật Google Gemini API Key thành công!",
        "masked_key": mask_api_key(key)
    }


@api_router.post("/settings/test-key")
async def test_api_key(request: TestApiKeyRequest):
    """
    Gửi request kiểm tra kết nối nhanh tới Google Gemini API xem key có hợp lệ không.
    """
    key = (request.api_key or os.getenv("GEMINI_API_KEY", "")).strip()
    if not key:
        raise HTTPException(status_code=400, detail="Chưa có API Key để kiểm tra.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": "ping"}]}],
        "generationConfig": {"maxOutputTokens": 5}
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            return {
                "status": "success",
                "message": "Kết nối thành công! Khóa Google Gemini API hoạt động hoàn hảo."
            }
        else:
            return {
                "status": "error",
                "message": f"Google Gemini báo lỗi ({resp.status_code}): {resp.text[:120]}"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi kết nối mạng tới Google API: {str(e)}"
        }
