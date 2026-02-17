# Version Control Guide

This project uses Git for version control. This guide will help you keep track of changes and prevent breaking things.

## Quick Start

### Making a Commit (Save a Version)

When you make changes that work correctly:

```bash
git add .
git commit -m "Description of what you changed"
```

**Good commit messages:**
- "Add TOTP field with counter functionality"
- "Fix dropdown positioning near bottom of popup"
- "Remove username field from account details"

### Checking Status

See what files have changed:
```bash
git status
```

### Viewing History

See all your commits:
```bash
git log
```

### Going Back to a Previous Version

If something breaks, you can revert:

**See what changed:**
```bash
git diff
```

**Revert to last commit (discard current changes):**
```bash
git checkout -- .
```

**Revert to a specific commit:**
```bash
git log  # Find the commit hash (e.g., cbd3d78)
git checkout cbd3d78 .
```

**Create a new commit that undoes changes:**
```bash
git revert <commit-hash>
```

## Best Practices

### 1. Commit Frequently
- Commit after completing a feature
- Commit after fixing a bug
- Commit before making experimental changes

### 2. Commit When Things Work
- Only commit code that is working
- Test your changes before committing
- If something breaks, fix it before committing

### 3. Use Meaningful Commit Messages
- Be specific about what changed
- Include why if it's not obvious
- Examples:
  - ✅ "Fix TOTP field bottom border visibility"
  - ✅ "Add smart dropdown positioning above button when near bottom"
  - ❌ "fix stuff"
  - ❌ "update"

### 4. Create Tags for Milestones

When you reach a stable version:
```bash
git tag -a v1.0.0 -m "First stable release"
git tag  # List all tags
```

### 5. Update CHANGELOG.md

When you make significant changes, update `CHANGELOG.md`:
- Add new features under "### Added"
- Add bug fixes under "### Fixed"
- Add changes under "### Changed"

## Workflow Example

```bash
# 1. Make your changes
# ... edit files ...

# 2. Check what changed
git status

# 3. Test your changes in the browser

# 4. If everything works, commit
git add .
git commit -m "Fix dropdown not appearing issue"

# 5. Update CHANGELOG.md if needed
# ... edit CHANGELOG.md ...

# 6. Commit the changelog update
git add CHANGELOG.md
git commit -m "Update changelog"
```

## If Something Breaks

### Option 1: Undo Last Change
```bash
git checkout -- popup.js  # Revert just one file
```

### Option 2: Go Back to Last Working Commit
```bash
git log  # Find the last good commit
git checkout <commit-hash> .
```

### Option 3: Create a Branch for Experiments
```bash
git checkout -b experimental-feature
# Make changes
# If it works:
git checkout main
git merge experimental-feature
# If it doesn't work:
git checkout main  # Just go back
```

## Remote Backup (Optional but Recommended)

Save your work online:

1. Create a repository on GitHub/GitLab
2. Add remote:
   ```bash
   git remote add origin <your-repo-url>
   ```
3. Push:
   ```bash
   git push -u origin main
   ```

## Useful Commands Cheat Sheet

```bash
git status              # What changed?
git log                 # History
git diff                # See changes
git add .               # Stage all changes
git commit -m "msg"     # Save version
git checkout -- <file>  # Undo file changes
git log --oneline       # Compact history
```

