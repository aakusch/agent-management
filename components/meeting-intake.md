---
id: meeting-intake
name: Meeting intake
description: Resolve which meeting is meant and load its transcript and notes.
kind: tool
icon: terminal
color: blue
version: 0.1.0
tags: bhg, meetings, grounding
---

Resolve the meeting the objective refers to, then load it.

1. Run the workspace catch-up path (`./catch-up` in the BHG workspace) to obtain access to Granola.
2. Identify the meeting from the objective: a named person, a date, a topic, or "the meeting we had"
   meaning the most recent one that person attended.
3. Load the transcript and the synchronized Obsidian note for that meeting.

Return: meeting title, date, attendees, transcript path, Obsidian note path.

If more than one meeting plausibly matches, do not guess. Return the candidates with dates and
attendees and stop for a human decision.
