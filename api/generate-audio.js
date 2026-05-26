export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, message: 'Use POST.' });
  }

  const configuredAdminKey = process.env.AUDIO_ADMIN_KEY;
  const providedAdminKey = request.headers['x-admin-key'];

  if (configuredAdminKey && providedAdminKey !== configuredAdminKey) {
    return response.status(401).json({ ok: false, message: 'Wrong admin code.' });
  }

  const token = process.env.GITHUB_WORKFLOW_TOKEN;
  if (!token) {
    return response.status(500).json({
      ok: false,
      message: 'Missing GITHUB_WORKFLOW_TOKEN environment variable in Vercel.'
    });
  }

  const owner = 'tomisu76';
  const repo = 'OSCE-play';
  const workflowId = 'generate-audio.yml';

  const githubResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    }
  );

  if (!githubResponse.ok) {
    const errorText = await githubResponse.text();
    return response.status(githubResponse.status).json({
      ok: false,
      message: 'GitHub workflow dispatch failed.',
      details: errorText
    });
  }

  return response.status(200).json({
    ok: true,
    message: 'Kokoro audio generation started. Wait for GitHub Actions to finish, then Vercel will redeploy.'
  });
}
