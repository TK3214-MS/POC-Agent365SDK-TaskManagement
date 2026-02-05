#!/bin/bash
# Dev Tunnel Setup Script for External Agent
# This script creates and hosts a dev tunnel to expose localhost:3978 via https

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PORT=3978
TUNNEL_NAME="agent365-external-agent"

echo -e "${GREEN}🚀 Dev Tunnel Setup for External Agent${NC}"
echo "=========================================="
echo ""

# Check if devtunnel CLI is installed
if ! command -v devtunnel &> /dev/null; then
    echo -e "${RED}❌ Error: devtunnel CLI is not installed${NC}"
    echo ""
    echo "Please install devtunnel CLI first:"
    echo "  macOS: brew install --cask devtunnel"
    echo "  Windows: winget install Microsoft.devtunnel"
    echo "  Linux: https://learn.microsoft.com/azure/developer/dev-tunnels/get-started"
    echo ""
    exit 1
fi

echo -e "${YELLOW}ℹ️  Checking for existing tunnel...${NC}"

# Check if tunnel already exists
if devtunnel list | grep -q "$TUNNEL_NAME"; then
    echo -e "${YELLOW}⚠️  Tunnel '$TUNNEL_NAME' already exists. Using existing tunnel.${NC}"
    TUNNEL_ID=$(devtunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    echo -e "${YELLOW}📝 Creating new tunnel: $TUNNEL_NAME${NC}"
    TUNNEL_ID=$(devtunnel create "$TUNNEL_NAME" --allow-anonymous)
    echo -e "${GREEN}✅ Tunnel created with ID: $TUNNEL_ID${NC}"
fi

echo ""
echo -e "${YELLOW}🔧 Configuring tunnel port: $PORT${NC}"
devtunnel port create "$TUNNEL_ID" -p "$PORT" --protocol https

echo ""
echo -e "${GREEN}✅ Dev Tunnel setup complete!${NC}"
echo ""
echo "=========================================="
echo -e "${GREEN}📋 Next Steps:${NC}"
echo "=========================================="
echo ""
echo "1. Start your local server (in another terminal):"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo "2. Host the tunnel:"
echo -e "   ${YELLOW}devtunnel host $TUNNEL_ID${NC}"
echo ""
echo "3. The tunnel URL will be displayed. Use it in Copilot Studio:"
echo -e "   ${YELLOW}https://<your-tunnel-id>.devtunnels.ms/api/messages${NC}"
echo ""
echo "=========================================="
echo ""

# Optionally host the tunnel immediately
read -p "Do you want to host the tunnel now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}🌍 Hosting tunnel...${NC}"
    echo -e "${YELLOW}Note: Make sure your local server is running on port $PORT${NC}"
    echo ""
    devtunnel host "$TUNNEL_ID"
fi
