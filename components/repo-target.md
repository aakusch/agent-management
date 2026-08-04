---
id: repo-target
name: Repository target
description: Decide which repository and base branch the change belongs to.
kind: router
icon: split
color: cyan
version: 0.1.0
tags: bhg, routing, needs-review
---

Determine where this change lands.

Match the request against the repositories under the local repos directory. Confirm the chosen
repository exists, read its remote, and identify the base branch (usually `develop`).

Return: repository path, remote, base branch, and the evidence that made the match (a path, a
package name, a symbol from the request).

If two repositories both plausibly match, or the base branch is not obvious, route to a human
decision rather than picking.
