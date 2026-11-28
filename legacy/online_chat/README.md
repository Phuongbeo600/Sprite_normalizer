# Lưu Trữ Mã Nguồn Chat API Online Cũ (`legacy/online_chat/`)

Thư mục này lưu giữ mã nguồn **Chatbot AI Online cũ** (`/api/chat/stream`, hỗ trợ Gemini / OpenAI / proxy qua API Key) sau khi hệ thống chuyển sang sử dụng **Chatbot RAG Offline** (`Qwen3.5-4B` + `BGE-M3` tại `/api/offline-chat/*`) làm trợ lý chính thức.

---

## 1. Cấu trúc & Vị trí gốc ban đầu

| Vị trí trong `legacy/online_chat/` | Vị trí gốc ban đầu | Vai trò |
|---|---|---|
| `backend/api/v1/chat.py` | `backend/api/v1/chat.py` | Router FastAPI `/api/chat/stream` phát SSE & kiểm soát tải |
| `backend/services/chat_service.py` | `backend/services/chat_service.py` | Điều phối phân giải API Key 3 cấp và gọi Provider |
| `backend/schemas/chat.py` | `backend/schemas/chat.py` | Pydantic DTO `ChatMessageItem`, `ChatStreamRequest` |
| `frontend/src/features/chat/ChatWidget.jsx` | `frontend/src/features/chat/ChatWidget.jsx` | Cửa sổ nổi Chat UI cũ |
| `frontend/src/features/chat/useStreamingChat.js` | `frontend/src/features/chat/useStreamingChat.js` | Custom hook quản lý hội thoại & `AbortController` |
| `frontend/src/features/chat/chat.css` | `frontend/src/features/chat/chat.css` | Style cho `ChatWidget` |
| `frontend/src/shared/api/chatApi.js` | `frontend/src/shared/api/chatApi.js` | Client SSE `streamChatApi` gửi `POST /api/chat/stream` |
| `tests/test_chat_stream.py` | `tests/test_chat_stream.py` | Unit test backend cho router, schema & provider streaming |
| `tests/test_scoped_chat_config.py` | Tách từ `tests/test_scoped_ai_config.py` | Unit test cấu hình `CHAT_*` env cho `ChatService` |
| `tests/frontend/test_chat_auth.mjs` | `tests/frontend/test_chat_auth.mjs` | Test gửi JWT header của `chatApi.js` |
| `tests/frontend/test_chat_session.mjs` | Tách từ `tests/frontend/test_feature_sessions.mjs` | Test state & `AbortController` của `useStreamingChat.js` |

---

## 2. Các thành phần dùng chung vẫn giữ ở hệ thống chính

Các module dùng chung dưới đây **không bị sao chép** sang `legacy/`, hiện vẫn nằm tại mã nguồn đang vận hành:
- **Backend:**
  - `backend/services/ai_credentials_service.py` (`AiCredentialsService` với `scope="chat"`)
  - `backend/providers/factory.py` (`AiProviderFactory`), `backend/providers/gemini_provider.py`, `backend/providers/openai_provider.py` (`stream_chat`)
  - `backend/core/dependencies.py` (`get_current_user_optional`, `check_project_access`)
  - `backend/core/load_control.py` (`check_rate_limit`, `ai_chat_concurrency`, `RATE_LIMIT_AI_CHAT`)
  - `backend/db.py` (`get_db`)
- **Frontend:**
  - `frontend/src/shared/api/authHeaders.js` (`getAuthHeaders`)

---

## 3. Hướng dẫn tích hợp lại trong tương lai

1. Sao chép các tệp trong `backend/` và `frontend/` về đúng đường dẫn gốc tương ứng trong `Sprite_normalizer/`.
2. Đăng ký lại `chat_router` trong `backend/api/router.py`:
   ```python
   from backend.api.v1.chat import chat_router
   api_router.include_router(chat_router)
   ```
3. Mount `<ChatWidget currentProject={currentProject} isAiEnabled={isAiEnabled} />` trong `frontend/src/app/App.jsx` (hoặc cấu hình bật/tắt song song với `<OfflineChatWidget />`).
4. Khôi phục các tệp trong `tests/` nếu muốn chạy kiểm thử tự động trở lại cùng bộ test chính.
