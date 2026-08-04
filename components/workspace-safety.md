---
id: workspace-safety
name: Workspace safety
description: Preserve uncommitted work and open a clean working branch.
kind: tool
icon: shield
color: coral
version: 0.1.0
tags: bhg, safety, git, needs-review
---

Make the repository safe to work in before anything is changed.

1. `git status` and `git stash list`. If the tree is dirty, preserve that work first — commit it to a
   scratch branch or stash it with a labelled message — and report exactly what you preserved and how
   to recover it. Never discard, never work on top of someone else's uncommitted edits.
2. Fetch, then create the working branch from the current base branch.
3. Report: preserved work (if any), base commit, working branch name.

Stop and ask if the repository is mid-rebase, mid-merge, or has a detached HEAD.
