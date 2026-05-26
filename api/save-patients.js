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
    return response.status(500).json({ ok: false, message: 'Missing GITHUB_WORKFLOW_TOKEN environment variable in Vercel.' });
  }

  let body;
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  } catch {
    return response.status(400).json({ ok: false, message: 'Invalid JSON body.' });
  }

  const patients = body?.patients;
  const regenerateAudio = Boolean(body?.regenerateAudio);

  if (!Array.isArray(patients) || patients.length === 0) {
    return response.status(400).json({ ok: false, message: 'patients must be a non-empty array.' });
  }

  for (const patient of patients) {
    if (!patient.id || !patient.name || !Array.isArray(patient.lines)) {
      return response.status(400).json({ ok: false, message: 'Each patient needs id, name, and lines.' });
    }
  }

  const owner = 'tomisu76';
  const repo = 'OSCE-play';
  const path = 'data/patients.json';
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };

  const currentFileResponse = await fetch(`${apiBase}/contents/${path}?ref=main`, { headers });
  if (!currentFileResponse.ok) {
    const details = await currentFileResponse.text();
    return response.status(currentFileResponse.status).json({ ok: false, message: 'Could not read current patients file.', details });
  }
  const currentFile = await currentFileResponse.json();

  const content = JSON.stringify(patients, null, 2) + '\n';
  const encodedContent = Buffer.from(content, 'utf8').toString('base64');

  const saveResponse = await fetch(`${apiBase}/contents/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: regenerateAudio ? 'Update patient text and regenerate audio' : 'Update patient text',
      content: encodedContent,
      sha: currentFile.sha,
      branch: 'main'
    })
  });

  if (!saveResponse.ok) {
    const details = await saveResponse.text();
    return response.status(saveResponse.status).json({ ok: false, message: 'Could not save patients file.', details });
  }

  let workflowStarted = false;
  if (regenerateAudio) {
    const workflowResponse = await fetch(`${apiBase}/actions/workflows/generate-audio.yml/dispatches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: 'main' })
    });

    if (!workflowResponse.ok) {
      const details = await workflowResponse.text();
      return response.status(workflowResponse.status).json({ ok: false, message: 'Patients saved, but audio workflow could not start.', details });
    }
    workflowStarted = true;
  }

  return response.status(200).json({
    ok: true,
    workflowStarted,
    message: workflowStarted
      ? 'Saved. New Kokoro audio generation started. Old files will be overwritten after GitHub Actions finishes.'
      : 'Saved. Audio was not regenerated.'
  });
}
