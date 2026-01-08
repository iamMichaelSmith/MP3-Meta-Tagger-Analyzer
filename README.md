# MP3 Meta Tagger Analyzer

Local-first web application for analyzing MP3 files and tagging them for DISCO.AC.

## Features
- **Local Processing**: All analysis happens on your machine.
- **AI Analysis**: Extracts BPM, Key, Genres, Moods using CLAP, PANNS, and Librosa.
- **Batch Editing**: Review and edit metadata before export.
- **DISCO Export**: Export ready-to-use CSV files.

## Setup

### Prerequisites
- Python 3.9+
- Node.js & npm
- FFMPEG (Add to System PATH)

### Installation
1.  **Backend Setup**:
    ```bash
    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    ```
    *Note: If you have issues with `essentia` or `musicnn`, the app will run in fallback mode with mock analysis.*

2.  **Frontend Setup**:
    ```bash
    cd ui
    npm install
    ```

3.  **Run Application**:
    Double click `start.bat` in the root directory.
    - Frontend: http://localhost:5173
    - Backend: http://localhost:8000

## Docker Deployment

### Local Development with Docker

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
   - Frontend: http://localhost
   - Backend: http://localhost:8000

2. **Stop containers**:
   ```bash
   docker-compose down
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

### AWS Lambda Deployment

Perfect for occasional use (2-3 times per week) with ~$1-2/month cost.

#### Prerequisites
- AWS Account
- AWS CLI configured
- Docker installed
- SAM CLI installed (`pip install aws-sam-cli`)

#### Deploy Backend to Lambda

1. **Build Docker image**:
   ```bash
   cd backend
   docker build -t mp3-tagger-backend .
   ```

2. **Push to ECR** (Elastic Container Registry):
   ```bash
   # Create ECR repository
   aws ecr create-repository --repository-name mp3-tagger-backend
   
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
   
   # Tag and push
   docker tag mp3-tagger-backend:latest <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mp3-tagger-backend:latest
   docker push <YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/mp3-tagger-backend:latest
   ```

3. **Deploy with SAM**:
   ```bash
   sam deploy --guided
   ```

#### Deploy Frontend to S3 + CloudFront

1. **Build frontend**:
   ```bash
   cd ui
   npm run build
   ```

2. **Deploy to S3**:
   ```bash
   aws s3 sync dist/ s3://mp3-tagger-frontend-<YOUR_ACCOUNT_ID>/ --delete
   ```

3. **Update API endpoint**: Edit `ui/src/api/client.ts` with your Lambda API Gateway URL.

#### Cost Estimate (for 2-3 uses per week)
- Lambda: ~$0.30-$1.00/month
- S3 + CloudFront: ~$0.70/month
- **Total: ~$1-2/month**

## Configuration
Edit `backend/mapping_rules.yaml` to customize how model tags map to your specific genres/styles.
