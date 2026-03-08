#!/bin/bash

# Builder's Circle - Appwrite Infrastructure Deployment Script
# This script deploys the complete Appwrite backend infrastructure

set -e  # Exit on error

echo "=========================================="
echo "Builder's Circle - Infrastructure Deploy"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Appwrite CLI is installed
if ! command -v appwrite &> /dev/null; then
    echo -e "${RED}Error: Appwrite CLI is not installed${NC}"
    echo "Install it with: npm install -g appwrite-cli"
    exit 1
fi

echo -e "${GREEN}✓ Appwrite CLI found${NC}"

# Check if logged in
if ! appwrite account get &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Appwrite${NC}"
    echo "Login with: appwrite login"
    exit 1
fi

echo -e "${GREEN}✓ Logged in to Appwrite${NC}"
echo ""

# Deployment options
echo "Select deployment option:"
echo "1) Full deployment (database + collections + functions)"
echo "2) Database and collections only"
echo "3) Functions only"
echo "4) Individual collection"
echo "5) Individual function"
read -p "Enter option (1-5): " option

case $option in
    1)
        echo ""
        echo "=========================================="
        echo "Full Deployment"
        echo "=========================================="
        echo ""
        
        echo "Step 1: Deploying database..."
        appwrite deploy database || echo -e "${YELLOW}Warning: Database may already exist${NC}"
        
        echo ""
        echo "Step 2: Deploying collections..."
        appwrite deploy collection || echo -e "${YELLOW}Warning: Some collections may already exist${NC}"
        
        echo ""
        echo "Step 3: Deploying functions..."
        appwrite deploy function || echo -e "${YELLOW}Warning: Some functions may already exist${NC}"
        
        echo ""
        echo -e "${GREEN}✓ Full deployment complete!${NC}"
        ;;
        
    2)
        echo ""
        echo "=========================================="
        echo "Database & Collections Deployment"
        echo "=========================================="
        echo ""
        
        echo "Deploying database..."
        appwrite deploy database || echo -e "${YELLOW}Warning: Database may already exist${NC}"
        
        echo ""
        echo "Deploying collections..."
        appwrite deploy collection || echo -e "${YELLOW}Warning: Some collections may already exist${NC}"
        
        echo ""
        echo -e "${GREEN}✓ Database and collections deployed!${NC}"
        ;;
        
    3)
        echo ""
        echo "=========================================="
        echo "Functions Deployment"
        echo "=========================================="
        echo ""
        
        echo "Deploying functions..."
        appwrite deploy function
        
        echo ""
        echo -e "${GREEN}✓ Functions deployed!${NC}"
        ;;
        
    4)
        echo ""
        echo "Available collections:"
        echo "  - ownership_ledger"
        echo "  - multipliers"
        echo "  - build_cycles"
        echo "  - cycle_participation"
        echo "  - activity_events"
        echo "  - notifications"
        echo "  - audit_logs"
        read -p "Enter collection ID: " collection_id
        
        echo ""
        echo "Deploying collection: $collection_id"
        appwrite deploy collection --collectionId "$collection_id"
        
        echo ""
        echo -e "${GREEN}✓ Collection deployed!${NC}"
        ;;
        
    5)
        echo ""
        echo "Available functions:"
        echo "  - computeOwnership"
        echo "  - stallEvaluator"
        echo "  - adjustMultiplier"
        read -p "Enter function ID: " function_id
        
        echo ""
        echo "Deploying function: $function_id"
        appwrite deploy function --functionId "$function_id"
        
        echo ""
        echo -e "${GREEN}✓ Function deployed!${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "1. Update function environment variables in Appwrite Console:"
echo "   - APPWRITE_ENDPOINT"
echo "   - APPWRITE_PROJECT_ID"
echo "   - APPWRITE_API_KEY"
echo ""
echo "2. Create an API key with these permissions:"
echo "   - databases.read"
echo "   - databases.write"
echo "   - documents.read"
echo "   - documents.write"
echo ""
echo "3. Verify deployment:"
echo "   node scripts/verify-setup.js"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
