// Deletes Cloudflare Pages preview deployments for a given branch. Scoped
// to env=preview so production deployments are never even listed, let
// alone touched.
async function deleteCloudflarePreviewDeployments({ accountId, apiToken, projectName, branch }) {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const toDelete = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${baseUrl}?env=preview&page=${page}&per_page=25`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to list deployments (page ${page}): ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    const deployments = body.result ?? [];
    for (const d of deployments) {
      if (d.deployment_trigger?.metadata?.branch === branch) {
        toDelete.push(d.id);
      }
    }
    const perPage = body.result_info?.per_page ?? 25;
    const totalPages = Math.ceil((body.result_info?.total_count ?? 0) / perPage);
    if (page >= totalPages || deployments.length === 0) break;
    page += 1;
  }

  let deleted = 0;
  for (const id of toDelete) {
    // force=true: allows deleting aliased non-production deployments,
    // which includes the most recent deployment for a closed PR's branch.
    const res = await fetch(`${baseUrl}/${id}?force=true`, { method: "DELETE", headers });
    if (res.ok) {
      deleted += 1;
    } else {
      console.log(`Failed to delete deployment ${id}: ${res.status} ${await res.text()}`);
    }
  }
  console.log(`Deleted ${deleted}/${toDelete.length} preview deployment(s) for branch "${branch}"`);
}

module.exports = { deleteCloudflarePreviewDeployments };
