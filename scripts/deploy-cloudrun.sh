#!/usr/bin/env bash
# Deploy creativity-test to Google Cloud Run.
#
# Pins the project explicitly (lesson learned from the concept-bridge
# operator-error incident).

set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-concept-bridge-494005}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="creativity-test"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [[ "${ACTIVE_PROJECT}" != "${PROJECT_ID}" ]]; then
  echo "  ⚠ gcloud active project is '${ACTIVE_PROJECT}' but deploying to '${PROJECT_ID}'."
  echo "    Continuing in 3s — Ctrl-C to abort..."
  sleep 3
fi

echo "==> Building Docker image (project=${PROJECT_ID})..."
gcloud builds submit --project="${PROJECT_ID}" --tag "${IMAGE}:latest" .

echo "==> Deploying to Cloud Run (${REGION}, project=${PROJECT_ID})..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --update-env-vars "NODE_ENV=production"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" --region "${REGION}" --format "value(status.url)")
echo ""
echo "==> Deployed: ${SERVICE_URL}"
echo ""
echo "==> One-time secret mounts (only on first deploy):"
echo "  gcloud run services update ${SERVICE_NAME} --project ${PROJECT_ID} --region ${REGION} \\"
echo "    --update-secrets DATABASE_URL=database-url:latest,GROQ_API_KEY=groq-api-key:latest"
