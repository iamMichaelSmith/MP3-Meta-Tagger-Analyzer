# Local Proof Pack

Concise evidence file for employer review.

## Verified locally on 2026-03-18
- `python .\tests\smoke.py` ✅
- `npm run build` in `ui` had already been validated in this workspace during the readiness pass
- Architecture/docs present
- Backend + frontend source layout is intact and reviewable

## What is directly observable in the repo
### Backend surface
- FastAPI entry: `backend/app/main.py`
- API endpoints: `backend/app/api/endpoints.py`
- Analysis service: `backend/app/services/analysis.py`
- Storage/export service: `backend/app/services/storage.py`
- Schemas: `backend/app/models/schemas.py`

### Frontend surface
- Upload flow: `ui/src/pages/UploadPage.tsx`
- Results review: `ui/src/pages/ResultsPage.tsx`
- Export flow: `ui/src/pages/ExportPage.tsx`
- API client: `ui/src/api/client.ts`

## Strongest hiring signal
This repo is not just an ML demo. It shows end-to-end ownership of a useful studio workflow:
- file ingestion
- model-backed analysis
- editable review UI
- export-ready metadata output
- local/Docker/AWS deployment paths

## Best review path for a hiring manager
1. Read `README.md` sections: Hiring manager snapshot, Local verification status, Usage workflow.
2. Open `docs/PROJECT_OUTCOMES.md` for business framing.
3. Open `docs/ARCHITECTURE.md` and compare it to the real source folders above.
4. Review the three main UI pages in `ui/src/pages/` to see the operator flow.

## Honest current limitation
The main missing proof artifact is a reproducible sample analysis run with a tiny test audio file and captured output JSON/CSV. That would be the next best upgrade if more time is spent here.

## Suggested interview framing
"I built a local-first metadata tagging tool for sync prep that combines Python audio analysis services with a React review/export interface, then documented the deployment and operator workflow so it can be evaluated as a product, not just a code experiment."
