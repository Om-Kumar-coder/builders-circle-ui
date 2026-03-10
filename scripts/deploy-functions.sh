#!/bin/bash

# Builder's Circle - Function Deployment Script
# This script packages and prepares Appwrite functions for deployment

set -e

echo "=========================================="
echo "Builder's Circle - Function Deployment"
echo "=========================================="
echo ""

# Create deployment directory
DEPLOY_DIR="./deployments"
mkdir -p $DEPLOY_DIR

# Function 1: computeOwnership
echo "📦 Packaging computeOwnership..."
cd functions/computeOwnership
zip -r ../../$DEPLOY_DIR/computeOwnership.zip . -x "*.git*" -x "node_modules/*" -x "*.md"
cd ../..
echo "✅ computeOwnership.zip created"

# Function 2: stallEvaluator
echo ""
echo "📦 Packaging stallEvaluator..."
cd functions/stallEvaluator
zip -r ../../$DEPLOY_DIR/stallEvaluator.zip . -x "*.git*" -x "node_modules/*" -x "*.md"
cd ../..
echo "✅ stallEvaluator.zip created"

# Function 3: adjustMultiplier
echo ""
echo "📦 Packaging adjustMultiplier..."
cd functions/adjustMultiplier
zip -r ../../$DEPLOY_DIR/adjustMultiplier.zip . -x "*.git*" -x "node_modules/*" -x "*.md"
cd ../..
echo "✅ adjustMultiplier.zip created"

echo ""
echo "=========================================="
echo "✅ All functions packaged successfully!"
echo "=========================================="
echo ""
echo "Deployment packages created in: $DEPLOY_DIR/"
echo ""
echo "Next Steps:"
echo "1. Go to Appwrite Console → Functions"
echo "2. Create each function with the following settings:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Function: computeOwnership"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Runtime: Node.js 22"
echo "Entrypoint: src/main.js"
echo "Execute Access: Any"
echo "Timeout: 15 seconds"
echo "Schedule: (none)"
echo ""
echo "Environment Variables:"
echo "  APPWRITE_FUNCTION_API_ENDPOINT=https://your-domain.com/v1"
echo "  APPWRITE_FUNCTION_PROJECT_ID=YOUR_PROJECT_ID"
echo "  APPWRITE_API_KEY=YOUR_API_KEY"
echo "  DATABASE_ID=69b008400000b872c17a"
echo "  LEDGER_COLLECTION_ID=ownership_ledger"
echo "  MULTIPLIER_COLLECTION_ID=multipliers"
echo ""
echo "Upload: $DEPLOY_DIR/computeOwnership.zip"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Function: stallEvaluator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Runtime: Node.js 22"
echo "Entrypoint: src/main.js"
echo "Execute Access: Server"
echo "Timeout: 300 seconds"
echo "Schedule: 0 2 * * * (Daily at 2 AM UTC)"
echo ""
echo "Environment Variables:"
echo "  APPWRITE_ENDPOINT=https://your-domain.com/v1"
echo "  APPWRITE_PROJECT_ID=YOUR_PROJECT_ID"
echo "  APPWRITE_API_KEY=YOUR_API_KEY"
echo "  APPWRITE_DATABASE_ID=69b008400000b872c17a"
echo "  PARTICIPATION_COLLECTION_ID=cycle_participation"
echo "  CYCLES_COLLECTION_ID=build_cycles"
echo ""
echo "Upload: $DEPLOY_DIR/stallEvaluator.zip"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Function: adjustMultiplier"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Runtime: Node.js 22"
echo "Entrypoint: src/main.js"
echo "Execute Access: Server"
echo "Timeout: 300 seconds"
echo "Schedule: 0 3 * * * (Daily at 3 AM UTC)"
echo ""
echo "Environment Variables:"
echo "  APPWRITE_ENDPOINT=https://your-domain.com/v1"
echo "  APPWRITE_PROJECT_ID=YOUR_PROJECT_ID"
echo "  APPWRITE_API_KEY=YOUR_API_KEY"
echo "  APPWRITE_DATABASE_ID=69b008400000b872c17a"
echo "  PARTICIPATION_COLLECTION_ID=cycle_participation"
echo "  MULTIPLIERS_COLLECTION_ID=multipliers"
echo "  LEDGER_COLLECTION_ID=ownership_ledger"
echo "  CYCLES_COLLECTION_ID=build_cycles"
echo ""
echo "Upload: $DEPLOY_DIR/adjustMultiplier.zip"
echo ""
