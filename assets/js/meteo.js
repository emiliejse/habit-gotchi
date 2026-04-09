async function fetchMétéo() {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.60&longitude=1.44&current_weather=true&timezone=Europe%2FBerlin');
    const data = await response.json();
    config.météo = data;
    console.log("Météo récupérée:", data);
  } catch (e) {
    console.error("Erreur météo:", e);
  }
}
fetchMétéo();
