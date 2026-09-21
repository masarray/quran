import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/deploy-pages.yml', 'utf8');

const verifyStart = workflow.indexOf('\n  verify:');
const deployStart = workflow.indexOf('\n  deploy:');

assert.ok(verifyStart >= 0, 'release workflow must define a verify job');
assert.ok(deployStart > verifyStart, 'deploy job must come after verify job');

const verify = workflow.slice(verifyStart, deployStart);
const deploy = workflow.slice(deployStart);

for (const command of [
  'npm audit --omit=dev --audit-level=high',
  'npm run lint:unused',
  'npm run test:runtime-recovery',
  'npm run test:smart-fonts',
  'npm run test:network-reliability',
  'npm run test:quran-integrity',
  'npm run test:footnotes',
  'npm run audit:quran-integrity',
  'npm run audit:media-sources',
  'npm run audit:footnotes',
  'npm run build',
  'npm run test:pwa-reliability',
  'npm run test:release-pipeline',
  'npx playwright test scripts/pwa-lifecycle.spec.js'
]) {
  assert.ok(verify.includes(command), `production verify job is missing: ${command}`);
}

assert.ok(
  verify.includes('actions/upload-pages-artifact@v5'),
  'the verified build must be the artifact uploaded for Pages'
);
assert.ok(
  verify.includes("if: github.ref == 'refs/heads/main'"),
  'Pages artifact upload must be restricted to main'
);
assert.equal(
  verify.includes('actions/deploy-pages@'),
  false,
  'verification must never deploy before all gates complete'
);

assert.ok(deploy.includes('needs: verify'), 'deploy job must depend on verify');
assert.ok(
  deploy.includes("if: github.ref == 'refs/heads/main'"),
  'manual or PR runs from non-main refs must never deploy'
);
assert.ok(
  deploy.includes('actions/deploy-pages@v5'),
  'deploy job must publish the already-tested Pages artifact'
);
assert.equal(
  deploy.includes('npm run build'),
  false,
  'deploy job must not rebuild a different artifact after verification'
);
assert.ok(
  workflow.includes('group: deploy-pages-${{ github.ref }}'),
  'PR verification must not share a cancellation group with production main deploys'
);

console.log('Production release pipeline assertions passed.');
