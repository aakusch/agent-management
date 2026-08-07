---
id: pr-staging
name: PR staging
description: Commit, push the branch, and open a PR to the base branch.
kind: tool
icon: file-check
color: blue
version: 0.1.0
tags: bhg, delivery, git
---

Stage the change for review. Do not merge.

1. Commit on the working branch with a message stating the change and citing the meeting (title and date).
2. Push the working branch to its remote.
3. Open a pull request against the base branch identified earlier. The description carries: the request
   in one sentence, the quotes it came from, what changed by file, the exact verification commands and
   their results, and anything deliberately left out.

Reserved for user: merging, releasing, publishing, and any push to a public repository. Stop after
the PR exists and report its URL.
