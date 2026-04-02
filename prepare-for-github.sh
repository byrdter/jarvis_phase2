#!/bin/bash

# ============================================================================
# JARVIS Phase 2 - GitHub Release Preparation Script
# ============================================================================
#
# This script prepares the agent-sdk repository for public GitHub release
# by removing personal data and replacing implementations with stubs.
#
# WHAT THIS SCRIPT DOES:
# 1. Removes personal databases and data files
# 2. Replaces full implementations with educational stubs
# 3. Removes test files with personal data
# 4. Creates example/template files
# 5. Verifies .gitignore is protecting sensitive files
#
# USAGE:
#   chmod +x prepare-for-github.sh
#   ./prepare-for-github.sh
#

set -e  # Exit on error

echo "=================================================="
echo "JARVIS Phase 2 - GitHub Release Preparation"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Step 1: Backup current state (safety first!)
# ============================================================================

echo "${YELLOW}Step 1: Creating backup...${NC}"

BACKUP_DIR="../agent-sdk-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . "$BACKUP_DIR"

echo "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"
echo ""

# ============================================================================
# Step 2: Remove personal data files
# ============================================================================

echo "${YELLOW}Step 2: Removing personal data files...${NC}"

# Remove databases
rm -f *.db *.db-shm *.db-wal
rm -f data/*.db data/*.json
echo "${GREEN}✓ Removed database files${NC}"

# Remove .env (keep .env.example)
if [ -f .env ]; then
    rm .env
    echo "${GREEN}✓ Removed .env file${NC}"
fi

# Remove test files with personal data
rm -f test-*.ts
echo "${GREEN}✓ Removed test files${NC}"

# Remove temporary files
rm -f .tmp-* *.tmp
echo "${GREEN}✓ Removed temporary files${NC}"

echo ""

# ============================================================================
# Step 3: Replace implementations with stubs
# ============================================================================

echo "${YELLOW}Step 3: Replacing implementations with stubs...${NC}"

# Replace heartbeat.ts with stub
if [ -f src/heartbeat.STUB.ts ]; then
    mv src/heartbeat.ts src/heartbeat.FULL.ts 2>/dev/null || true
    mv src/heartbeat.STUB.ts src/heartbeat.ts
    echo "${GREEN}✓ Replaced src/heartbeat.ts with stub${NC}"
fi

# Replace jarvis-brain.ts with stub
if [ -f src/jarvis-brain.STUB.ts ]; then
    mv src/jarvis-brain.ts src/jarvis-brain.FULL.ts 2>/dev/null || true
    mv src/jarvis-brain.STUB.ts src/jarvis-brain.ts
    echo "${GREEN}✓ Replaced src/jarvis-brain.ts with stub${NC}"
fi

echo ""

# ============================================================================
# Step 4: Replace agent definitions with examples
# ============================================================================

echo "${YELLOW}Step 4: Replacing agent definitions with examples...${NC}"

# Backup original agent definitions
if [ -d .claude/agents ]; then
    mkdir -p .claude/agents-backup
    mv .claude/agents/*.md .claude/agents-backup/ 2>/dev/null || true
    echo "${GREEN}✓ Backed up original agent definitions to .claude/agents-backup/${NC}"
fi

# The example-agent.md is already created
echo "${GREEN}✓ Example agent template ready${NC}"

echo ""

# ============================================================================
# Step 5: Use README-GITHUB.md as main README
# ============================================================================

echo "${YELLOW}Step 5: Updating README...${NC}"

if [ -f README-GITHUB.md ]; then
    mv README.md README-ORIGINAL.md
    mv README-GITHUB.md README.md
    echo "${GREEN}✓ Replaced README.md with GitHub version${NC}"
fi

echo ""

# ============================================================================
# Step 6: Create data directory structure
# ============================================================================

echo "${YELLOW}Step 6: Creating data directory structure...${NC}"

mkdir -p data
cat > data/README.md << 'EOF'
# Data Directory

This directory stores:
- SQLite databases for vector embeddings
- Execution logs from heartbeat
- Cost tracking data

All `.db` files are in `.gitignore` to protect personal data.

## Files Created

When you run the system, you'll see:
- `embeddings.db` - Vector search database
- `heartbeat.db` - Task execution logs
- `costs.db` - API cost tracking

These files are created automatically and should NOT be committed to git.
EOF

echo "${GREEN}✓ Created data/README.md${NC}"

echo ""

# ============================================================================
# Step 7: Verify .gitignore
# ============================================================================

echo "${YELLOW}Step 7: Verifying .gitignore...${NC}"

# Test if .env would be ignored
git check-ignore .env > /dev/null 2>&1 && echo "${GREEN}✓ .env is ignored${NC}" || echo "${RED}✗ WARNING: .env is NOT ignored${NC}"

# Test if .db files would be ignored
touch test.db
git check-ignore test.db > /dev/null 2>&1 && echo "${GREEN}✓ .db files are ignored${NC}" || echo "${RED}✗ WARNING: .db files are NOT ignored${NC}"
rm test.db

echo ""

# ============================================================================
# Step 8: Create LICENSE file
# ============================================================================

echo "${YELLOW}Step 8: Creating LICENSE...${NC}"

cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 Byrddynasty (JARVIS Project)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

ATTRIBUTION REQUIREMENT:
If you build upon this work, please credit the JARVIS project and link to
the original YouTube series at [Byrddynasty YouTube Channel].
EOF

echo "${GREEN}✓ Created LICENSE file${NC}"

echo ""

# ============================================================================
# Step 9: Summary of changes
# ============================================================================

echo ""
echo "=================================================="
echo "${GREEN}✓ Preparation Complete!${NC}"
echo "=================================================="
echo ""
echo "Changes made:"
echo "  • Backup created: $BACKUP_DIR"
echo "  • Personal data removed (*.db, .env, test files)"
echo "  • Implementations replaced with stubs"
echo "  • Agent definitions replaced with examples"
echo "  • README updated for GitHub"
echo "  • LICENSE file created"
echo ""
echo "${YELLOW}Next steps:${NC}"
echo "  1. Review the changes"
echo "  2. Test that stub implementations work"
echo "  3. Update any URLs in README.md"
echo "  4. Initialize git repo: git init"
echo "  5. Add files: git add ."
echo "  6. Commit: git commit -m 'Initial commit: JARVIS Phase 2 foundation'"
echo "  7. Create GitHub repo and push"
echo ""
echo "${YELLOW}To restore original files:${NC}"
echo "  cp -r $BACKUP_DIR/* ."
echo ""
echo "=================================================="
