# Pre-Push Checklist - JARVIS Phase 2

Use this checklist before pushing to GitHub to ensure no personal data is leaked.

## 🔒 Security Checks

### Files to Verify Are NOT Present

Run these commands and verify output:

```bash
# Should return nothing (file not found)
ls .env
# ❌ If found: Run prepare-for-github.sh again

# Should return nothing
find . -name "*.db" -not -path "./node_modules/*"
# ❌ If found: Run prepare-for-github.sh again

# Should return nothing  
ls test-*.ts 2>/dev/null
# ❌ If found: Delete these files manually

# Should return nothing
ls data/*.db data/*.json 2>/dev/null
# ❌ If found: Delete these files manually
```

### Files That SHOULD Be Present

```bash
# Should exist
ls .env.example
# ✅ Template for users

# Should exist
ls src/heartbeat.STUB.ts src/jarvis-brain.STUB.ts
# ✅ Will be renamed by script

# Should exist
ls README-GITHUB.md
# ✅ Will become README.md
```

## 📝 Content Checks

### README.md URLs

Open README.md and search for `#` - should find:

- [ ] YouTube Video 1 URL - Replace with actual URL
- [ ] YouTube Video 2 URL - Replace with actual URL
- [ ] Channel URL - Replace with your channel
- [ ] Substack URL - Replace with your newsletter

### Code Stubs

Check these files have disclaimer headers:

```bash
grep "EDUCATIONAL STUB" src/heartbeat.ts
# ✅ Should find "THIS IS A TEMPLATE"

grep "EDUCATIONAL STUB" src/jarvis-brain.ts  
# ✅ Should find "THIS IS A TEMPLATE"
```

## 🧪 Compilation Test

Verify stub files compile without errors:

```bash
# Should compile (may show TODOs but no errors)
bun run src/heartbeat.ts

# Should compile (may show TODOs but no errors)
bun run src/jarvis-brain.ts
```

## 🔍 Git Status Check

Before final push:

```bash
git status
```

**Should NOT see:**
- ❌ `.env`
- ❌ `*.db` files
- ❌ `test-*.ts` files
- ❌ `data/*.db` files

**Should see (staged for commit):**
- ✅ `.env.example`
- ✅ `README.md` (renamed from README-GITHUB.md)
- ✅ `src/heartbeat.ts` (the stub version)
- ✅ `src/jarvis-brain.ts` (the stub version)
- ✅ All documentation files
- ✅ LICENSE

## 📦 What's Being Released

### ✅ Complete Implementations

- [x] Vector search (src/embeddings.ts)
- [x] Memory search (src/memory-search.ts)
- [x] Gmail integration (integrations/gmail.ts)
- [x] Calendar integration (integrations/calendar.ts)
- [x] OAuth token script (scripts/google-oauth-token.ts)
- [x] Indexing script (scripts/index-vault.ts)
- [x] Search script (scripts/search.ts)

### ⚠️ Stubs/Templates

- [x] Heartbeat scheduler (structure only)
- [x] Agent orchestration (structure only)
- [x] Agent definitions (example template)

### 📚 Documentation

- [x] README with disclaimer
- [x] All PHASE-2*.md files
- [x] OAuth setup guide
- [x] Architecture docs
- [x] LICENSE file

## 🎯 Final Verification Commands

Copy and paste this entire block to verify everything:

```bash
echo "=== Security Check ==="
echo "Checking for .env file..."
[ ! -f .env ] && echo "✅ No .env file" || echo "❌ .env file found!"

echo "Checking for .db files..."
[ -z "$(find . -name '*.db' -not -path './node_modules/*')" ] && echo "✅ No .db files" || echo "❌ .db files found!"

echo "Checking for test files..."
[ -z "$(ls test-*.ts 2>/dev/null)" ] && echo "✅ No test files" || echo "❌ Test files found!"

echo ""
echo "=== Content Check ==="
echo "Checking stub headers..."
grep -q "EDUCATIONAL STUB" src/heartbeat.ts && echo "✅ heartbeat.ts is stub" || echo "❌ heartbeat.ts is NOT stub!"
grep -q "EDUCATIONAL STUB" src/jarvis-brain.ts && echo "✅ jarvis-brain.ts is stub" || echo "❌ jarvis-brain.ts is NOT stub!"

echo ""
echo "=== File Existence ==="
[ -f .env.example ] && echo "✅ .env.example exists" || echo "❌ .env.example missing!"
[ -f README.md ] && echo "✅ README.md exists" || echo "❌ README.md missing!"
[ -f LICENSE ] && echo "✅ LICENSE exists" || echo "❌ LICENSE missing!"

echo ""
echo "=== Git Status ==="
echo "Files staged:"
git diff --name-only --cached

echo ""
echo "=== All Checks Complete ==="
echo "If all ✅, you're ready to push!"
```

## 🚀 Ready to Push?

If all checks pass:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Verify what's staged
git status

# Commit
git commit -m "Initial commit: JARVIS Phase 2 foundation

Educational release with:
- Phase 2A: Bun + TypeScript setup
- Phase 2B: Vector search (complete)
- Phase 2C: Gmail/Calendar APIs (complete)
- Phase 2D: Agent framework (stubs)

See README.md for details and disclaimer."

# Push to GitHub
git remote add origin https://github.com/YOUR-USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main
```

## ❌ If Checks Fail

1. **Run prepare script again:**
   ```bash
   ./prepare-for-github.sh
   ```

2. **Manual cleanup if needed:**
   ```bash
   rm .env
   rm *.db
   rm test-*.ts
   rm data/*.db data/*.json
   ```

3. **Re-run verification commands above**

## ✅ After Push

- [ ] Verify repo looks correct on GitHub
- [ ] Create release v2.0.0
- [ ] Update Video 2 description with repo link
- [ ] Tweet/share the release
- [ ] Pin repository on profile

---

**All green checkmarks?** You're ready to ship! 🚀
