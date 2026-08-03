---
id: integration-review
name: Integration review
description: Verify contracts and behavior across packages, services, or related repositories.
kind: judge
icon: split
color: blue
version: 1.0.0
tags: integration, monorepo, contracts
inputs: patches, contract_map, check_reports
outputs: verdict, integration_findings
---

Review the combined change across package, service, or repository boundaries.

Check public types, API compatibility, generated clients, configuration, versioning, deployment order, and integration tests. Confirm each consumer is compatible with the producer change.

Return `pass` or `revise` and identify the owning surface for every finding.
