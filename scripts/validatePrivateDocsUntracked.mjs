// Stop the private docs from entering the PUBLIC git repository. Again.
//
// WHY THIS EXISTS — it already happened. On 28/07/2026 the whole of `docs/team/` was
// committed (`ecdb798e`) and removed the same day (`4bf76cb0`). Both commits were pushed
// to github.com/kontor068/beachbuddy, which is public. Deleting a file does not remove it
// from history: `git show ecdb798e:docs/team/15-security.md` still prints it today. That
// snapshot — commercial positioning, legal history, monetization thresholds, and a written
// list of our own security weaknesses — is permanently disclosed.
//
// The `.gitignore` rule was added AFTER the leak, so it was a fix for the next time, not
// that time. But a `.gitignore` entry only stops accidents; `git add -f`, a stale index
// entry, or a rule edited by someone who does not know why it is there all walk straight
// past it. This check fails loudly instead, and it fails at BUILD time — the one step
// nobody skips before deploying.
//
// It is deliberately about TRACKING, not about ignoring: a file can match an ignore rule
// and still be tracked (that is exactly how 851 QA images sat in the public repo while
// everyone assumed they were private). `git ls-files` answers the question that matters —
// "is this in the repository right now?" — rather than "is there a rule about it?".
import { execFileSync } from 'node:child_process';

// Paths that must never be tracked, and one line each on what leaks if they are.
const MUST_STAY_PRIVATE = [
  ['docs/team/', 'the 18 role docs — positioning, legal history, our own weak points'],
  ['docs/competitor-strategy.md', 'the negotiating position against a named competitor'],
  ['reports/snapshots/_raw-queries.json', 'raw search queries'],
  ['.secrets/', 'credentials'],
  ['.env', 'credentials'],
  ['.env.local', 'credentials'],
];

const tracked = (pathspec) => {
  try {
    const out = execFileSync('git', ['ls-files', '--', pathspec], { encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    // No git (a tarball build, a CI checkout without .git). Nothing can be committed from
    // here, so there is nothing to protect against — do not fail the build over it.
    return null;
  }
};

const probe = tracked('package.json');
if (probe === null || probe.length === 0) {
  console.log('[private-docs] ✓ skipped — not a git checkout, nothing can be committed.');
  process.exit(0);
}

const leaks = [];
for (const [pathspec, what] of MUST_STAY_PRIVATE) {
  const files = tracked(pathspec);
  if (files && files.length > 0) leaks.push({ pathspec, what, files });
}

if (leaks.length > 0) {
  console.error('\n[private-docs] ✗ BUILD STOPPED — private files are tracked in a PUBLIC repo.\n');
  for (const leak of leaks) {
    console.error(`  ${leak.pathspec} — ${leak.what}`);
    for (const file of leak.files.slice(0, 10)) console.error(`      ${file}`);
    if (leak.files.length > 10) console.error(`      … and ${leak.files.length - 10} more`);
  }
  console.error('\n  Untrack them, keeping the files on disk:');
  for (const leak of leaks) console.error(`      git rm -r --cached "${leak.pathspec}"`);
  console.error('\n  Do this BEFORE pushing. Once a commit is pushed, deleting the file');
  console.error('  later does not undo it — that is what happened on 28/07/2026.\n');
  process.exit(1);
}

console.log(`[private-docs] ✓ ${MUST_STAY_PRIVATE.length} private paths checked, none tracked.`);
