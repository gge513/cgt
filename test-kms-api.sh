#!/bin/bash

echo "Testing KMS API Endpoints (Phase 2 Fixes)"
echo "==========================================="
echo ""

# Set API key for auth
AUTH_TOKEN="test-bearer-token"
API_BASE="http://localhost:3000/api/kms"

echo "1. Testing Summary Endpoint (N+1 fix + Zod validation)"
echo "   GET /api/kms/summary"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_BASE/summary" | jq . | head -40
echo ""

echo "2. Testing Actions Endpoint (SafeFileContext + atomic writes + Zod)"
echo "   GET /api/kms/actions"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_BASE/actions" | jq . | head -20
echo ""

echo "3. Testing Actions POST (atomic write test)"
echo "   POST /api/kms/actions"
curl -s -X POST "$API_BASE/actions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"decisionId":"test-id-123","action":"escalate"}' | jq .
echo ""

echo "Test complete!"
