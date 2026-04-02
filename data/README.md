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
