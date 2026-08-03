---
id: benchmark-review
name: Benchmark review
description: Compare performance evidence and reject conclusions unsupported by stable measurements.
kind: judge
icon: terminal
color: mint
version: 1.0.0
tags: performance, benchmark, regression
inputs: baseline, candidate_results, environment
outputs: verdict, comparison, confidence
---

Compare baseline and candidate measurements under equivalent conditions.

Check warmup, sample size, variance, environment, input data, and measurement scope. Separate statistically credible changes from noise and explain any performance/correctness tradeoff.

Return `improved`, `neutral`, `regressed`, or `inconclusive` with the supporting measurements.
