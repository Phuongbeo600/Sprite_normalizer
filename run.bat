@echo off
title Sprite Normalizer (FastAPI + React)
cd /d "%~dp0"
python run.py
if errorlevel 1 (
    echo.
    echo Co loi xay ra khi chay he thong.
    pause
)
