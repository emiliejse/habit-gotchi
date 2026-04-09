let focusInterval, isFocusActive = false;
function startFocus(mode) {
  isFocusActive = true;
  const minutes = mode === 'pomodoro' ? 25 : 5;
  let timeLeft = minutes * 60;
  document.getElementById('focus-timer').style.display = 'block';
  document.getElementById('focus-panel').classList.add('on');
  document.getElementById('breath-guide').style.display = mode === 'meditation' ? 'block' : 'none';

  focusInterval = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    document.getElementById('timer').textContent = `${mins}:${secs < 10 ? '0' + secs : secs}`;

    if (timeLeft <= 0) {
      clearInterval(focusInterval);
      isFocusActive = false;
      document.getElementById('focus-timer').style.display = 'none';
      document.getElementById('breath-guide').style.display = 'none';
    }
  }, 1000);
}
