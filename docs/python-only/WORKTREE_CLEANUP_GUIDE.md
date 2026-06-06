# Worktree Cleanup Guide

Status: Package F.

## Paths

- Main project: `/Users/irin/Documents/RIN_loading`
- Old migration worktree: `/Users/irin/Documents/RIN_loading_python`

The active project is `/Users/irin/Documents/RIN_loading`.

## Safety Checks Before Removal

Run from the main project:

```sh
cd /Users/irin/Documents/RIN_loading
git worktree list
git -C /Users/irin/Documents/RIN_loading_python status --short --branch
git -C /Users/irin/Documents/RIN_loading_python log -1 --oneline
```

Remove the old worktree only if:

- status is clean;
- there is no unpushed work;
- the branch is historical/merged;
- no unique local files need preservation;
- current `main` contains the Python-only code.

## Removal Commands

```sh
cd /Users/irin/Documents/RIN_loading
git worktree remove /Users/irin/Documents/RIN_loading_python
git worktree prune
git worktree list
```

## Package F Result

The old migration worktree was clean and was removed. The active repository
remains `/Users/irin/Documents/RIN_loading`.
