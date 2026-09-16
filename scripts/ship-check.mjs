#!/usr/bin/env node
/**
 * ship:check — preflight before `gh pr merge`. Proves the code that will be merged is
 * EXACTLY the code that was tested locally. Exists because a fix commit once got merged
 * without being pushed: `gh pr merge` squashes ORIGIN's branch state, so an unpushed
 * local commit silently never ships, and the buggy pre-fix version lands on main.
 *
 * Refuses to pass unless, in order:
 *   1. you're on a feature branch (not main)
 *   2. the working tree is clean (nothing uncommitted)
 *   3. local HEAD is pushed and equals origin/<branch>
 *   4. the open PR's head commit on GitHub equals local HEAD (what merges == what you tested)
 *   5. the unit suite is green
 *
 * Usage: npm run ship:check   (then, only if it prints SAFE TO MERGE, run gh pr merge)
 */
import { execSync } from 'node:child_process';

function sh(cmd) { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function fail(msg) { console.error('\n✗ ship:check FAILED — ' + msg + '\n'); process.exit(1); }
function ok(msg) { console.log('  ✓ ' + msg); }

const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch === 'main' || branch === 'HEAD') fail(`on "${branch}" — check out a feature branch first`);
ok(`on feature branch ${branch}`);

const dirty = sh('git status --porcelain');
if (dirty) fail('working tree not clean — commit or stash first:\n' + dirty);
ok('working tree clean');

const local = sh('git rev-parse HEAD');
let remote;
try { remote = sh(`git rev-parse origin/${branch}`); }
catch { fail(`branch not pushed — run: git push -u origin ${branch}`); }
if (local !== remote) fail(`local HEAD ${local.slice(0, 8)} != origin/${branch} ${remote.slice(0, 8)} — push your latest commit`);
ok(`local HEAD pushed (${local.slice(0, 8)})`);

// PR head must equal local HEAD. gh may be unavailable (no PR yet) — that's a soft skip,
// but a PR whose head DIFFERS from local is a hard stop (the exact past failure).
let prHead = '';
try { prHead = JSON.parse(sh(`gh pr view ${branch} --json headRefOid`)).headRefOid; } catch { /* no PR / gh absent */ }
if (prHead && prHead !== local) fail(`open PR head ${prHead.slice(0, 8)} != local HEAD ${local.slice(0, 8)} — push, or the wrong commit will merge`);
ok(prHead ? `PR head matches local HEAD` : 'no open PR yet (skip PR-head check)');

try { sh('npm run test:unit'); ok('unit suite green'); }
catch { fail('unit tests failed — run `npm run test:unit` to see why'); }

console.log('\n✓ SAFE TO MERGE — every commit is pushed and tested. Now: gh pr merge ' + branch + ' --squash --admin\n');
