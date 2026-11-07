// Keeps one comment per PR with the landing-page (site/) preview link.
// Template-only, like site.yml: PLAYBOOK.md deletes it from new apps.
const MARKER = '<!-- able-site-preview -->';

function render({ previewUrl, deployUrl, sha, closed }) {
  if (closed) {
    return [MARKER, '### 🌱 Site preview', '', 'PR closed: preview deployments deleted.'].join('\n');
  }
  const lines = [MARKER, '### 🌱 Site preview', '', `**${previewUrl}**`, ''];
  if (deployUrl && deployUrl !== previewUrl) {
    lines.push(`This commit only: ${deployUrl}`);
  }
  lines.push(`Deployed from ${sha.slice(0, 7)}. Production: https://able.lightbody.net`);
  return lines.join('\n');
}

async function upsertSiteComment(github, context, data) {
  const issue = { owner: context.repo.owner, repo: context.repo.repo, issue_number: context.issue.number };
  const comments = await github.paginate(github.rest.issues.listComments, issue);
  const existing = comments.find((c) => c.body.startsWith(MARKER));
  if (data.closed && !existing) return;
  const body = render(data);
  if (existing) {
    await github.rest.issues.updateComment({ owner: issue.owner, repo: issue.repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ ...issue, body });
  }
}

module.exports = { upsertSiteComment };
