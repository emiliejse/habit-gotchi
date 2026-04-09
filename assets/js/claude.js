async function callClaudeAPI(text) {
  if (!config.apiKey) {
    console.error("Clé API manquante");
    return { humeur: 3, message: "Continue comme ça !", accessoire: '' };
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        prompt: text,
        max_tokens: 100
      })
    });
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Erreur API:", e);
    return { humeur: 3, message: "Continue comme ça !", accessoire: '' };
  }
}
