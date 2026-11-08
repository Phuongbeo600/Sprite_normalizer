# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Đường dẫn tệp)
# ========================================================
# os: Đọc và gán biến môi trường hệ thống
import os
# Path: Quản lý đường dẫn tuyệt đối tới file .env
from pathlib import Path
# typing: Định nghĩa kiểu từ điển, tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (AI Providers)
# ========================================================
# AiProviderFactory: Khởi tạo Provider đa hình theo tên
from backend.providers.factory import AiProviderFactory

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SettingsService:
    """
    Dịch vụ cấu hình hệ thống (Settings Service).
    - Đọc/ghi cấu hình file .env an toàn.
    - Che dấu API Key (Masking) bảo vệ thông tin mật.
    - Kiểm tra kết nối API Key qua tính Đa hình (Polymorphism) của AiProviderFactory.
    """

    ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"

    @staticmethod
    def mask_api_key(key: Optional[str]) -> str:
        """
        Che dấu chuỗi khóa API bảo vệ hiển thị trên giao diện (ví dụ: AIza...89AB).

        @param {Optional[str]} key Chuỗi khóa API gốc.
        @returns {str} Chuỗi đã che dấu hoặc chuỗi rỗng.
        """
        if not key or len(key.strip()) < 8:
            return ""
        k = key.strip()
        return f"{k[:4]}...{k[-4:]}"

    @classmethod
    def get_settings(cls) -> Dict[str, Any]:
        """
        Lấy thông tin cấu hình hiện tại của hệ thống.

        @returns {Dict[str, Any]} Cấu hình nhà cung cấp và các khóa API đã che dấu.
        """
        return {
            "status": "success",
            "provider": os.getenv("AI_PROVIDER", "gemini"),
            "gemini_masked_key": cls.mask_api_key(os.getenv("GEMINI_API_KEY", "")),
            "openai_masked_key": cls.mask_api_key(os.getenv("OPENAI_API_KEY", "")),
            "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        }

    @classmethod
    def save_settings(
        cls,
        provider: str,
        gemini_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        openai_base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cập nhật cấu hình vào biến môi trường RAM và lưu bền vững vào file .env.

        @param {str} provider Nhà cung cấp được kích hoạt ('gemini' hoặc 'openai').
        @param {Optional[str]} gemini_api_key Khóa Gemini mới (nếu có).
        @param {Optional[str]} openai_api_key Khóa OpenAI mới (nếu có).
        @param {Optional[str]} openai_base_url Đường dẫn base URL proxy.
        @returns {Dict[str, Any]} Trạng thái kết quả lưu cấu hình.
        """
        clean_provider = provider.lower().strip()
        os.environ["AI_PROVIDER"] = clean_provider

        if gemini_api_key and gemini_api_key.strip():
            os.environ["GEMINI_API_KEY"] = gemini_api_key.strip()

        if openai_api_key and openai_api_key.strip():
            os.environ["OPENAI_API_KEY"] = openai_api_key.strip()

        if openai_base_url and openai_base_url.strip():
            os.environ["OPENAI_BASE_URL"] = openai_base_url.strip()

        # Đọc và ghi đè bền vững vào file .env
        env_lines = []
        if cls.ENV_PATH.exists():
            with open(cls.ENV_PATH, "r", encoding="utf-8") as f:
                env_lines = f.readlines()

        keys_to_update = {
            "AI_PROVIDER": clean_provider,
            "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
            "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
            "OPENAI_BASE_URL": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        }

        updated_keys = set()
        new_lines = []
        for line in env_lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                new_lines.append(line)
                continue
            if "=" in line:
                k, _ = line.split("=", 1)
                k_clean = k.strip()
                if k_clean in keys_to_update:
                    new_lines.append(f"{k_clean}={keys_to_update[k_clean]}\n")
                    updated_keys.add(k_clean)
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)

        for k, v in keys_to_update.items():
            if k not in updated_keys:
                new_lines.append(f"{k}={v}\n")

        with open(cls.ENV_PATH, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        return {
            "status": "success",
            "message": f"Đã lưu và kích hoạt cấu hình {clean_provider.upper()} thành công!",
            "provider": clean_provider,
            "gemini_masked_key": cls.mask_api_key(os.getenv("GEMINI_API_KEY")),
            "openai_masked_key": cls.mask_api_key(os.getenv("OPENAI_API_KEY")),
            "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        }

    @classmethod
    def test_api_key(
        cls,
        provider: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Kiểm tra nhanh API Key thông qua đối tượng Provider Đa hình tương ứng.
        Hoàn toàn không có if/else cho từng loại API!
        """
        clean_provider = provider.lower().strip()
        effective_key = (api_key or "").strip()
        if not effective_key:
            if clean_provider == "openai":
                effective_key = os.getenv("OPENAI_API_KEY", "").strip()
            else:
                effective_key = os.getenv("GEMINI_API_KEY", "").strip()

        if not effective_key:
            return {
                "status": "error",
                "message": f"Chưa có {clean_provider.upper()} API Key để kiểm tra."
            }

        effective_base_url = base_url or os.getenv("OPENAI_BASE_URL")
        # Gọi qua Đa hình Factory
        ai_provider = AiProviderFactory.get_provider(clean_provider)
        success, message = ai_provider.test_connection(effective_key, effective_base_url)

        return {
            "status": "success" if success else "error",
            "message": message
        }
