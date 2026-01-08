"""
Lambda handler for MP3 Tagger-Analyzer
Adapts the FastAPI application to work with AWS Lambda using Mangum
"""

from mangum import Mangum
from app.main import app

# Create Lambda handler
# Mangum translates API Gateway events to ASGI (FastAPI) format
handler = Mangum(app, lifespan="off")
