import os
from fastapi import FastAPI
app = FastAPI()
if not os.environ.get("DATABASE_URL"): raise RuntimeError("DATABASE_URL required!")