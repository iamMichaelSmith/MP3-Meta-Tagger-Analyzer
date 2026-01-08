# MP3 Meta Tagger Analyzer

An intelligent, local-first web application designed to streamline metadata tagging for sync licensing catalogs. Built to solve the tedious problem of manually categorizing music tracks, this tool leverages cutting-edge AI models to automatically extract comprehensive musical characteristics from MP3 files.

## Why This Project Exists

Managing a sync licensing catalog requires detailed, accurate metadata for every track. Manually tagging hundreds or thousands of songs with BPM, key, genre, mood, and instrumentation is time-consuming and inconsistent. **MP3 Meta Tagger Analyzer** automates this entire workflow, using advanced machine learning models to analyze audio and generate professional-grade metadata ready for music licensing platforms like DISCO.AC.

This project has been instrumental in:
- **Saving hours of manual tagging work** per session
- **Ensuring consistent, AI-driven categorization** across entire catalogs
- **Identifying nuanced genres and moods** that human ears might miss
- **Preparing batch exports** for immediate upload to sync licensing platforms

## Key Features

- 🎵 **Advanced AI Analysis**
  - **CLAP (Contrastive Language-Audio Pretraining)**: Zero-shot classification for genres, moods, and vibes using natural language prompts
  - **PANNS (Pre-trained Audio Neural Networks)**: Accurate instrument detection across 527+ sound classes
  - **Librosa**: Precise BPM, key detection, and acoustic feature extraction

- 🔒 **100% Local Processing**: All analysis happens on your machine - your music stays private
  
- 📊 **Batch Workflow**: Upload multiple tracks, review AI-generated tags, edit as needed, and export to CSV
  
- 🎨 **Modern UI**: Clean, responsive interface built with React, TypeScript, and Tailwind CSS
  
- 🐳 **Docker Support**: Run locally or deploy to AWS Lambda for serverless operation
  
- 💰 **Cost-Effective Deployment**: ~$1-2/month on AWS Lambda for occasional use

## Technical Stack

### Backend (Python/FastAPI)
- **FastAPI**: Modern, high-performance API framework
- **PyTorch**: Deep learning framework for ML models
- **Transformers (Hugging Face)**: Access to pre-trained CLAP models
- **PANNS-Inference**: Pre-trained audio neural networks
- **Librosa**: Audio analysis and feature extraction
- **SoundFile**: Audio file I/O
- **NumPy/Pandas**: Data processing

### Frontend (React/TypeScript)
- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **React Router**: Client-side routing
- **Axios**: HTTP client for API calls
- **Lucide React**: Beautiful icon library

### Infrastructure
- **Docker**: Containerization for portability
- **Docker Compose**: Multi-service orchestration
- **Nginx**: Production web server for frontend
- **AWS SAM**: Serverless deployment framework
- **AWS Lambda**: Serverless compute (optional)
- **S3 + CloudFront**: Static hosting and CDN (optional)

## Prerequisites

### Local Development (without Docker)
- Python 3.11+
- Node.js 20+ & npm
- FFMPEG (must be in system PATH for audio processing)
- 4GB+ available RAM (for ML models)

### Docker Development
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose (included with Docker Desktop)
- 8GB+ available RAM recommended

### AWS Deployment (optional)
- AWS Account with credentials configured
- AWS CLI installed and configured
- SAM CLI: `pip install aws-sam-cli`
- Docker (for building Lambda images)

## Installation & Setup

### Option 1: Local Development (No Docker)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iamMichaelSmith/MP3-Meta-Tagger-Analyzer.git
   cd MP3-Meta-Tagger-Analyzer
   ```

2. **Backend setup**:
   ```bash
   cd backend
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```
   
   **Note**: First run will download ML models (~3-5GB total):
   - LAION CLAP model
   - PANNS pre-trained weights
   - This happens automatically on first analysis

3. **Frontend setup**:
   ```bash
   cd ui
   npm install
   ```

4. **Run the application**:
   - **Windows**: Double-click `start.bat` in the root directory
   - **Manual start**:
     ```bash
     # Terminal 1 - Backend
     cd backend
     venv\Scripts\activate
     uvicorn app.main:app --reload --port 8000
     
     # Terminal 2 - Frontend
     cd ui
     npm run dev
     ```
   
   Access the application:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:8000

### Option 2: Docker Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iamMichaelSmith/MP3-Meta-Tagger-Analyzer.git
   cd MP3-Meta-Tagger-Analyzer
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
   
   **Note**: First build takes 10-15 minutes as it downloads Python dependencies and ML models.

3. **Access the application**:
   - **Frontend**: http://localhost
   - **Backend API**: http://localhost:8000

4. **View logs**:
   ```bash
   docker-compose logs -f
   ```

5. **Stop services**:
   ```bash
   docker-compose down
   ```

## AWS Lambda Deployment

Perfect for **occasional use (2-3 times per week)** with approximately **$1-2/month** total cost.

### Prerequisites
- AWS Account with credentials configured (`aws configure`)
- Docker installed
- SAM CLI: `pip install aws-sam-cli`

### Deployment Steps

1. **Create ECR repository and push backend image**:
   ```bash
   # Create repository
   aws ecr create-repository --repository-name mp3-tagger-backend
   
   # Build Docker image
   cd backend
   docker build -t mp3-tagger-backend .
   
   # Login to ECR (replace YOUR_ACCOUNT_ID and region)
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   
   # Tag and push
   docker tag mp3-tagger-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mp3-tagger-backend:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mp3-tagger-backend:latest
   ```

2. **Deploy with SAM**:
   ```bash
   cd ..
   sam deploy --guided
   ```

3. **Deploy frontend to S3**:
   ```bash
   cd ui
   npm run build
   aws s3 sync dist/ s3://mp3-tagger-frontend-YOUR_ACCOUNT_ID/ --delete
   ```

4. **Update API endpoint**: Edit `ui/src/api/client.ts` with your API Gateway URL from SAM output.

### Lambda Configuration
- **Memory**: 4096 MB (4GB) - Required for ML models
- **Timeout**: 300 seconds (5 minutes)
- **Ephemeral Storage**: 2048 MB
- **Container Size**: ~4-5GB

### Cost Breakdown (2-3 sessions/week, ~10 files per session)
- **Lambda Compute**: $0.30-$1.00/month
- **S3 Storage**: $0.50/month
- **API Gateway**: $0.10/month
- **CloudFront**: $0.20/month
- **Total**: ~$1-2/month 🎉

## Configuration

### Customizing Genre/Mood Mapping

Edit `backend/mapping_rules.yaml` to define how CLAP model outputs map to your specific catalog categories:

```yaml
genres:
  - Electronic
  - Hip-Hop
  - Rock
  - Ambient
  
moods:
  - Energetic
  - Melancholic
  - Uplifting
```

## Usage Workflow

1. **Upload**: Drag and drop MP3 files or click to browse
2. **Analyze**: AI models automatically extract metadata
3. **Review**: Check generated BPM, key, genres, moods, instruments
4. **Edit**: Adjust any tags as needed
5. **Export**: Download CSV file formatted for DISCO.AC or other platforms

## Project Structure

```
MP3-Meta-Tagger-Analyzer/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── models/      # Pydantic schemas
│   │   └── services/    # Analysis & storage logic
│   ├── Dockerfile       # Backend container config
│   ├── lambda_handler.py # AWS Lambda entry point
│   └── requirements.txt # Python dependencies
├── ui/                  # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Upload, Results, Export pages
│   │   └── api/         # API client
│   ├── Dockerfile       # Frontend container config
│   └── package.json     # Node dependencies
├── docker-compose.yml   # Local dev orchestration
├── template.yaml        # AWS SAM deployment config
└── start.bat           # Windows quick-start script
```

## Pushing to GitHub

```bash
git remote add origin https://github.com/iamMichaelSmith/MP3-Meta-Tagger-Analyzer.git
git branch -M main
git push -u origin main
```

## License

MIT License - feel free to use for personal or commercial projects.

## Acknowledgments

- **LAION** for the CLAP model
- **Kong et al.** for PANNS
- **Librosa** contributors for audio analysis tools
- Built with ❤️ to solve real-world sync licensing workflow challenges
