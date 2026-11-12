---
description: Create a git worktree in .trees/<name> and run the given instructions inside it
argument-hint: <instructions to run in the new worktree>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git rev-parse:*), Bash(ls:*)
---

Instructions to run in the new worktree:

$ARGUMENTS

## Steps

1. If the instructions above are empty, stop and ask the user what to do in the worktree.
2. Pick a short kebab-case name (2-4 words, lowercase, ASCII only) that describes the instructions. Example: "agrega un botón de silencio" becomes `mute-button`.
3. Check `git worktree list` and `ls .trees` for a clash. If the name exists, append a suffix (`-2`, `-3`, ...).
4. Create the worktree on a new branch with the same name, based on the current branch:

   ```bash
   git worktree add .trees/<name> -b <name>
   ```

5. Do all the work inside `.trees/<name>`. Use absolute paths under that folder for every read, edit, and command. Never edit files in the main checkout.
6. Follow the project rules in `CLAUDE.md` (language, keep-in-sync items, vanilla constraints).
7. Do not commit, merge, or remove the worktree unless the instructions ask for it.
8. When done, report the worktree path, the branch name, and a short summary of the changes. Tell the user how to merge it later (`git merge <name>`) and clean up (`git worktree remove .trees/<name>`).
