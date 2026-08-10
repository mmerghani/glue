# Glue Stop And Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `glue stop` command and make `glue status` show the active model for the local server on port `8000`.

**Architecture:** Keep the launcher thin and shell-native. Detect the running server by looking up the process listening on port `8000`, parse the model from that process command line, and use the same port lookup to stop the server cleanly.

**Tech Stack:** Bash launcher, shell test scripts, `lsof`, `ps`, `kill`

---

### Task 1: Add failing launcher test

**Files:**
- Create: `tests/launcher-status-stop.test.sh`
- Test: `launchers/glue`

- [ ] Write a shell test that stubs `lsof`, `ps`, and `kill`, then asserts:
  - `glue help` mentions `stop`
  - `glue status` prints the active model when a server is running
  - `glue stop` stops the server and prints a success message

### Task 2: Implement launcher helpers

**Files:**
- Modify: `launchers/glue`

- [ ] Add small helpers for:
  - reading the PIDs on port `8000`
  - reading the command line for the active PID
  - parsing the model from `--model ...` or `serve ...`

### Task 3: Implement user-facing commands

**Files:**
- Modify: `launchers/glue`

- [ ] Add `glue stop`
- [ ] Update `glue status` to print the active model when it can be detected
- [ ] Update `glue help` and usage examples

### Task 4: Verify and publish

**Files:**
- Modify: `launchers/glue`
- Test: `tests/launcher-status-stop.test.sh`

- [ ] Run the focused launcher test
- [ ] Push the clean repo
- [ ] Fast-forward `/Users/morgan/glue`
