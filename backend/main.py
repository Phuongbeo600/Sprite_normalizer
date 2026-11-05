from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import api_router

app = FastAPI(
    title="Sprite Normalizer API",
    description="Backend FastAPI hỗ trợ chuẩn hóa Sprite cho Bài Tập Lớn Trí Tuệ Nhân Tạo (UET)",
    version="1.0.0"
)

# Cấu hình CORS để frontend React kết nối thuận tiện
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router từ api/
app.include_router(api_router)

@app.get("/")
async def root():
    return {
        "message": "Sprite Normalizer API is running",
        "docs": "/docs",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
