// Shared by preview.yml and frontend.yml so both workflows can
// collaboratively fill in one PR comment instead of each posting its own,
// regardless of which one finishes first.
const MARKER_PREFIX = '<!-- preview-env-data:';

function render(data) {
  const row = (label, value) => `| ${label} | ${value || '⏳ pending'} |`;
  // able:begin postgres
  const neonCell = data.neonBranch
    ? data.neonProjectId
      ? `[\`${data.neonBranch}\`](https://console.neon.tech/app/projects/${data.neonProjectId}/branches)`
      : `\`${data.neonBranch}\``
    : null;
  // able:end

  return [
    `${MARKER_PREFIX}${JSON.stringify(data)} -->`,
    '### 🚀 Preview environment',
    '',
    '| Service | URL |',
    '|---|---|',
    row('Frontend', data.frontendUrl),
    row('Backend', data.backendUrl), // able:only backend
    row('Neon branch', neonCell), // able:only postgres
    // able:begin observability
    // Only once Grafana is configured: an unconfigured app has no telemetry.
    ...(data.grafanaStackUrl && data.deployEnvironment
      ? [
          `| Telemetry | [Grafana](${data.grafanaStackUrl}/a/grafana-app-observability-app/services) ` +
            `· filter \`deployment.environment.name=${data.deployEnvironment}\` |`,
        ]
      : []),
    // able:end
  ].join('\n');
}

async function upsertPreviewComment(github, context, newData) {
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  // Collect every comment this system has ever posted, oldest first -- in
  // steady state there's exactly one, but overlapping runs can leave
  // stragglers. Merge them all into one and delete the rest so the PR
  // self-heals back to a single comment regardless of how it got here.
  const matches = comments
    .filter((c) => c.body.startsWith(MARKER_PREFIX))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let data = {};
  for (const c of matches) {
    const match = c.body.match(/^<!-- preview-env-data:(.*) -->/);
    if (!match) continue;
    try {
      data = { ...data, ...JSON.parse(match[1]) };
    } catch {
      // ignore a malformed marker rather than fail the whole run
    }
  }

  data = { ...data, ...newData };
  const body = render(data);

  const primary = matches[0];
  if (primary) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: primary.id,
      body,
    });
    for (const dup of matches.slice(1)) {
      await github.rest.issues.deleteComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: dup.id,
      });
    }
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    });
  }
}

module.exports = { upsertPreviewComment };
