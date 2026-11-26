import os
from dotenv import load_dotenv

load_dotenv()

SERVICE_KEY = os.getenv("SERVICE_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# 2026-11-26 Google 공식 models/pricing에서 stable Flash-Lite + 무료 티어 확인.
# https://ai.google.dev/gemini-api/docs/models
# https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip() or "gemini-3.5-flash-lite"
