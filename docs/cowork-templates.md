# Cowork task templates — SurveillanceOS

## How to use these in Cowork (Claude Desktop → Tasks tab)

---

## Template 1 — Feature request
Paste this into Cowork whenever you have a new feature:

```
I'm the product owner of SurveillanceOS (IINVSYS internal project).
New requirement:

[PASTE YOUR REQUIREMENT HERE IN PLAIN ENGLISH]

Please:
1. Convert this into a structured task document (save as docs/tasks/TASK-XXX.md)
2. Identify which agents should work on it (frontend / backend / analytics / devops)
3. List any dependencies or risks
4. Estimate complexity (S / M / L)
5. Add it to docs/ROADMAP.md under the current sprint
```

---

## Template 2 — Daily standup (schedule with /schedule)
```
Read docs/changelog/ and the git log from the last 24 hours.
Produce a standup summary with:
- What was completed yesterday
- What is in progress today
- Any open bugs (check GitHub issues with label 'bug')
- Blockers or risks
Save as docs/standups/YYYY-MM-DD.md
```

---

## Template 3 — Sprint close / release notes
```
Sprint is closing. Please:
1. Read all docs/changelog/ entries from this sprint
2. Read all merged PRs from the sprint branch
3. Produce release notes (save as docs/releases/vX.X.X.md) with:
   - New features (user-facing language)
   - Bug fixes
   - Breaking changes
   - Upgrade steps if any
4. Update docs/CHANGELOG.md with a summary entry
```

---

## Template 4 — Pre-deployment checklist
```
Prepare a deployment checklist for the upcoming release by:
1. Reading the QA agent's latest test report
2. Checking all open GitHub issues — list any critical/major bugs still open
3. Reviewing docs/releases/ for the release notes
4. Producing a GO / NO-GO recommendation with reasons
Save as docs/deployments/YYYY-MM-DD-checklist.md
```

---

## Template 5 — Bug triage
```
Review all open GitHub issues with label 'bug'.
For each:
- Confirm the severity is correctly assigned
- Check if a fix PR exists
- Identify if any critical bugs are unassigned
Produce a triage report and save as docs/bugs/triage-YYYY-MM-DD.md
```
