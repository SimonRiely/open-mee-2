const SECRET_PIN = '1277';
let currentPin = '';
const dots = document.querySelectorAll('.dot');
const lockScreen = document.getElementById('lockScreen');
const letterScreen = document.getElementById('letterScreen');
const cassetteSection = document.getElementById('cassetteSection');
const lettersSection = document.getElementById('lettersSection');
const playlistPrompt = document.getElementById('playlistPrompt');
const trackButtons = [...document.querySelectorAll('.cassette-track')];
const cassetteHero = document.querySelector('.cassette-hero');
const cassetteArt = document.querySelector('.cassette-art');
const cassetteStatus = document.getElementById('cassetteStatus');
const cassetteVideoPlayer = document.getElementById('cassetteVideoPlayer');
const cassetteVideo = document.getElementById('cassetteVideo');
const cassetteVideoLoading = document.getElementById('cassetteVideoLoading');
const cassetteVideoLoadingText = document.getElementById('cassetteVideoLoadingText');
const videoPauseToggle = document.getElementById('videoPauseToggle');
const videoCloseToggle = document.getElementById('videoCloseToggle');
const appContainer = document.querySelector('.app-container');
const emptyFlowersPopup = document.getElementById('emptyFlowersPopup');
const closeFlowerPopup = document.getElementById('closeFlowerPopup');
const isLowPerformanceDevice = (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
  || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4);
let inputLocked = false;
let attemptsExhausted = false;
let wrongAttempts = 0;
const MAX_WRONG_ATTEMPTS = 3;
let activeTrackButton = null;
let activeClipEndTime = null;
let clipFinished = false;
let playbackTimeout = null;
const listenedTracks = new Set();
document.documentElement.classList.toggle('low-performance', isLowPerformanceDevice);
const showCassetteFallback = () => cassetteHero.classList.add('art-unavailable');
cassetteArt.addEventListener('error', showCassetteFallback);
if (cassetteArt.complete && !cassetteArt.naturalWidth) showCassetteFallback();
const unlockFlowers = document.createElement('div');
unlockFlowers.className = 'unlock-flowers';
unlockFlowers.setAttribute('aria-hidden', 'true');
appContainer.appendChild(unlockFlowers);

const topFlowerCluster = document.createElement('div');
topFlowerCluster.className = 'top-flower-cluster';
topFlowerCluster.innerHTML = `
  <svg class="vine-art" viewBox="0 0 380 140" preserveAspectRatio="none" aria-hidden="true">
    <path class="vine-branch" d="M 8 88 C 58 48, 89 50, 127 87" />
    <path class="vine-branch" d="M 246 87 C 290 44, 326 48, 372 83" />
    <path class="vine-main" id="mainVinePath" d="M -8 82 C 82 132, 116 55, 195 91 S 316 60, 388 91" />
  </svg>
`;

const flowerPositions = [
  [4, -2], [10, 3], [17, -4], [24, 2], [31, -2], [38, 4],
  [45, -3], [52, 2], [59, -2], [66, 4], [73, -4], [80, 2],
  [87, -2], [93, 3], [97, -3]
];
const flowerTypes = ['iris', 'rose', 'hydrangea'];

flowerPositions.forEach(([left, top], index) => {
  const flower = document.createElement('div');
  flower.className = `top-flower top-flower-${flowerTypes[index % flowerTypes.length]}`;
  flower.style.left = `${left}%`;
  flower.dataset.vineX = left;
  flower.dataset.vineOffset = top;
  flower.innerHTML = `
    <span class="stem"></span>
    <span class="vine-join"></span>
    <span class="leaf leaf-left"></span>
    <span class="leaf leaf-right"></span>
    <span class="top-blossom blossom-${flowerTypes[index % flowerTypes.length]}">
      <span class="bloom"></span>
      <span class="petal"></span>
      <span class="petal"></span>
      <span class="petal"></span>
      <span class="petal"></span>
      <span class="petal"></span>
    </span>
  `;
  flower.style.setProperty('--sway-delay', `${index * 0.18}s`);
  topFlowerCluster.appendChild(flower);
});

lockScreen.insertBefore(topFlowerCluster, lockScreen.firstChild);

function connectFlowersToVine() {
  const vine = document.getElementById('mainVinePath');
  const clusterBounds = topFlowerCluster.getBoundingClientRect();
  const pathLength = vine.getTotalLength();
  const viewBoxWidth = 380;

  topFlowerCluster.querySelectorAll('.top-flower').forEach((flower) => {
    const targetX = viewBoxWidth * Number(flower.dataset.vineX) / 100;
    let low = 0;
    let high = pathLength;

    for (let i = 0; i < 16; i++) {
      const middle = (low + high) / 2;
      if (vine.getPointAtLength(middle).x < targetX) {
        low = middle;
      } else {
        high = middle;
      }
    }

    const vinePoint = vine.getPointAtLength((low + high) / 2);
    const flowerTop = vinePoint.y - 31 + Number(flower.dataset.vineOffset);
    const stemLength = Math.max(4, vinePoint.y - flowerTop - 19);
    flower.style.top = `${flowerTop}px`;
    flower.style.setProperty('--stem-length', `${stemLength}px`);
    flower.style.setProperty('--join-y', `${vinePoint.y - flowerTop - 2}px`);
  });
}

connectFlowersToVine();
window.addEventListener('resize', connectFlowersToVine);

const cassetteObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    cassetteSection.classList.add('in-view');
    cassetteObserver.unobserve(cassetteSection);
  }
}, { root: letterScreen, threshold: 0.35 });
cassetteObserver.observe(cassetteSection);

const lettersObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    lettersSection.classList.add('in-view');
    lettersObserver.unobserve(lettersSection);
  }
}, { root: letterScreen, threshold: 0.25 });

document.querySelectorAll('.letter-card').forEach((button) => {
  const dialog = document.getElementById(button.dataset.letterDialog);
  const closeButton = dialog.querySelector('.letter-dialog-close');

  button.addEventListener('click', () => dialog.showModal());
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

function updateDots() {
  dots.forEach((dot, index) => {
    dot.classList.toggle('filled', index < currentPin.length);
  });
}

function markTrackListened(button) {
  const trackName = button.dataset.track;
  if (listenedTracks.has(trackName)) return;

  listenedTracks.add(trackName);
  button.querySelector('.track-indicator').textContent = '✓';

  if (listenedTracks.size === trackButtons.length) {
    playlistPrompt.textContent = 'You listened to them all! Close the song to open your letters 💌';
    return;
  }

  playlistPrompt.textContent = `You've listened to ${listenedTracks.size} of ${trackButtons.length} songs — keep going ✨`;
}

function clearPlaybackTimeout() {
  window.clearTimeout(playbackTimeout);
  playbackTimeout = null;
}

function startPlaybackTimeout(button) {
  clearPlaybackTimeout();
  playbackTimeout = window.setTimeout(() => {
    if (activeTrackButton !== button) return;

    cassetteVideoLoading.hidden = true;
    cassetteVideoPlayer.setAttribute('aria-busy', 'false');
    videoPauseToggle.textContent = cassetteVideo.paused ? 'Play' : 'Pause';
    videoPauseToggle.setAttribute(
      'aria-label',
      `${cassetteVideo.paused ? 'Play' : 'Pause'} ${button.dataset.track}`
    );
    cassetteStatus.textContent = cassetteVideo.paused
      ? `Still loading ${button.dataset.track}. Check your connection, then tap Play to retry.`
      : `Still loading ${button.dataset.track}. Tap Pause, then Play to retry.`;
  }, 10000);
}

function revealLetters() {
  lettersSection.hidden = false;
  lettersObserver.observe(lettersSection);
  requestAnimationFrame(() => {
    letterScreen.scrollTo({
      top: letterScreen.scrollTop
        + lettersSection.getBoundingClientRect().top
        - letterScreen.getBoundingClientRect().top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  });
}

function closeSelectedSong() {
  const button = activeTrackButton
    || cassetteVideoPlayer.closest('.cassette-track-entry')?.querySelector('.cassette-track');
  if (!button) return;

  clearPlaybackTimeout();
  cassetteVideo.pause();
  cassetteVideo.onloadedmetadata = null;
  cassetteVideo.onerror = null;
  cassetteVideo.removeAttribute('src');
  cassetteVideo.load();
  cassetteVideoPlayer.hidden = true;
  cassetteVideoPlayer.setAttribute('aria-busy', 'false');
  cassetteVideoLoading.hidden = true;
  videoPauseToggle.disabled = true;
  videoPauseToggle.textContent = 'Play';
  videoPauseToggle.setAttribute('aria-label', 'Play selected song');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-expanded', 'false');
  button.nextElementSibling.hidden = true;
  activeTrackButton = null;
  activeClipEndTime = null;
  clipFinished = false;
  cassetteHero.classList.remove('is-playing');
  cassetteSection.classList.remove('has-player');
  cassetteStatus.textContent = 'Choose a song to start the tape';

  if (listenedTracks.size === trackButtons.length) {
    revealLetters();
  }
}

function pressKey(number) {
  if (!inputLocked && !attemptsExhausted && currentPin.length < 4) {
    currentPin += number;
    updateDots();

    if (currentPin.length === 4) {
      setTimeout(checkPin, 200);
    }
  }
}

function deleteKey() {
  if (!inputLocked && !attemptsExhausted && currentPin.length > 0) {
    currentPin = currentPin.slice(0, -1);
    updateDots();
  }
}

function createUnlockFlowers() {
  unlockFlowers.innerHTML = '';
  unlockFlowers.style.opacity = '1';

  const columns = isLowPerformanceDevice ? 8 : 10;
  const flowerCount = isLowPerformanceDevice ? 72 : 120;
  const rows = Math.ceil(flowerCount / columns);
  const flowerTypes = ['iris', 'rose', 'hydrangea'];
  const flowers = document.createDocumentFragment();

  for (let i = 0; i < flowerCount; i++) {
    const flower = document.createElement('span');
    flower.className = `burst-flower burst-${flowerTypes[i % flowerTypes.length]}`;

    const column = i % columns;
    const row = Math.floor(i / columns);
    const destinationX = ((column + 0.5) / columns) * appContainer.clientWidth
      + (Math.random() - 0.5) * 24;
    const destinationY = ((row + 0.5) / rows) * appContainer.clientHeight
      + (Math.random() - 0.5) * 32;
    const x = destinationX - appContainer.clientWidth / 2;
    const y = destinationY - appContainer.clientHeight / 2;
    const rot = (Math.random() * 300 - 150) + 'deg';
    const scale = (1.05 + Math.random() * 0.45).toFixed(2);

    flower.style.setProperty('--x', `${x}px`);
    flower.style.setProperty('--y', `${y}px`);
    flower.style.setProperty('--rot', rot);
    flower.style.setProperty('--scale', scale);
    flower.style.setProperty('--burst-delay', `${(Math.random() * 0.06).toFixed(2)}s`);
    flower.innerHTML = `
      <span class="burst-petal"></span>
      <span class="burst-petal"></span>
      <span class="burst-petal"></span>
      <span class="burst-petal"></span>
      <span class="burst-petal"></span>
      <span class="burst-center"></span>
    `;

    flowers.appendChild(flower);
  }

  unlockFlowers.appendChild(flowers);
}

function triggerWrongAnimation() {
  inputLocked = true;
  wrongAttempts++;
  lockScreen.classList.remove('wrong');
  void lockScreen.offsetWidth;
  lockScreen.classList.add('shake', 'wrong');

  const flowers = [...topFlowerCluster.querySelectorAll('.top-flower:not(.bloom-detached)')];
  const safeFlowers = flowers.filter((flower) => {
    const bounds = flower.querySelector('.top-blossom').getBoundingClientRect();
    const screenBounds = lockScreen.getBoundingClientRect();
    const blossomCenter = bounds.left + bounds.width / 2;
    return blossomCenter >= screenBounds.left + 18 && blossomCenter <= screenBounds.right - 18;
  });
  const flowerPool = safeFlowers.length > 0 ? safeFlowers : flowers;
  const flowersToDrop = Math.min(flowerPool.length, 3 + Math.floor(Math.random() * 3));
  const screenBounds = lockScreen.getBoundingClientRect();
  const fallingBlossoms = [];

  for (let index = 0; index < flowersToDrop; index++) {
    const flowerIndex = Math.floor(Math.random() * flowerPool.length);
    const [sourceFlower] = flowerPool.splice(flowerIndex, 1);
    const sourceBlossom = sourceFlower.querySelector('.top-blossom');
    const flowerBounds = sourceBlossom.getBoundingClientRect();
    const fallingBlossom = sourceBlossom.cloneNode(true);
    fallingBlossom.classList.add('falling-blossom');
    fallingBlossom.style.left = `${flowerBounds.left + flowerBounds.width / 2 - screenBounds.left}px`;
    fallingBlossom.style.top = `${flowerBounds.top - screenBounds.top}px`;
    fallingBlossom.style.setProperty('--drop-x', `${(Math.random() * 120 - 60).toFixed(0)}px`);
    fallingBlossom.style.animationDelay = `${index * 0.08}s`;
    sourceFlower.classList.add('bloom-detached');
    lockScreen.appendChild(fallingBlossom);
    fallingBlossoms.push(fallingBlossom);
  }

  requestAnimationFrame(() => {
    fallingBlossoms.forEach((flower) => flower.classList.add('fall'));
  });

  setTimeout(() => {
    lockScreen.classList.remove('shake', 'wrong');
    fallingBlossoms.forEach((flower) => flower.remove());
    currentPin = '';
    updateDots();

    if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
      attemptsExhausted = true;
      document.getElementById('heartLock').classList.add('broken');
      setTimeout(() => {
        emptyFlowersPopup.hidden = false;
        closeFlowerPopup.focus();
      }, 850);
    } else {
      inputLocked = false;
    }
  }, 1400 + (fallingBlossoms.length - 1) * 80);
}

function unlockLetter() {
  inputLocked = true;
  createUnlockFlowers();

  letterScreen.scrollTop = 0;
  letterScreen.style.setProperty('--art-position-x', `${42 + Math.random() * 16}%`);
  letterScreen.style.setProperty('--art-position-y', `${42 + Math.random() * 16}%`);
  letterScreen.style.display = 'flex';
  void letterScreen.offsetWidth;
  lockScreen.classList.add('unlocking');
  letterScreen.classList.add('revealing');

  setTimeout(() => {
    unlockFlowers.classList.add('fading');
  }, 2200);

  setTimeout(() => {
    lockScreen.style.display = 'none';
    unlockFlowers.replaceChildren();
    unlockFlowers.style.opacity = '';
    unlockFlowers.classList.remove('fading');
  }, 3600);
}

function restartLockScreen() {
  emptyFlowersPopup.hidden = true;
  topFlowerCluster.querySelectorAll('.bloom-detached').forEach((flower) => {
    flower.classList.remove('bloom-detached');
  });
  document.getElementById('heartLock').classList.remove('broken');
  lockScreen.classList.remove('wrong', 'shake', 'unlocking');
  lockScreen.style.display = '';
  letterScreen.classList.remove('revealing');
  letterScreen.style.display = 'none';
  unlockFlowers.replaceChildren();
  unlockFlowers.classList.remove('fading');
  unlockFlowers.style.opacity = '';
  wrongAttempts = 0;
  attemptsExhausted = false;
  inputLocked = false;
  currentPin = '';
  updateDots();
}

function checkPin() {
  if (currentPin === SECRET_PIN) {
    unlockLetter();
  } else {
    triggerWrongAnimation();
  }
}

document.querySelectorAll('.key').forEach((button) => {
  const keyValue = button.dataset.key;
  if (keyValue) {
    button.addEventListener('click', () => pressKey(keyValue));
  }
});

document.querySelector('.key.delete')?.addEventListener('click', deleteKey);

closeFlowerPopup.addEventListener('click', () => {
  restartLockScreen();
});

emptyFlowersPopup.addEventListener('click', (event) => {
  if (event.target === emptyFlowersPopup) {
    restartLockScreen();
  }
});

document.getElementById('surpriseBtn').addEventListener('click', () => {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: isLowPerformanceDevice ? 90 : 180,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#f47b3f', '#ffae55', '#ffd18f', '#fff2d8']
    });
  }

  letterScreen.scrollTo({
    top: letterScreen.scrollTop + cassetteSection.getBoundingClientRect().top - letterScreen.getBoundingClientRect().top,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
});

document.querySelectorAll('.cassette-track').forEach((button) => {
  button.addEventListener('click', () => {
    if (button === activeTrackButton && !cassetteVideo.error) {
      return;
    }

    const previousButton = activeTrackButton;
    activeTrackButton = null;
    activeClipEndTime = null;
    clipFinished = false;
    clearPlaybackTimeout();
    if (previousButton) {
      previousButton.setAttribute('aria-pressed', 'false');
      previousButton.setAttribute('aria-expanded', 'false');
      previousButton.nextElementSibling.hidden = true;
    }
    cassetteHero.classList.remove('is-playing');
    cassetteVideo.pause();
    cassetteVideo.onloadedmetadata = null;
    cassetteVideo.onerror = null;
    cassetteVideo.removeAttribute('src');
    cassetteVideo.load();
    cassetteVideoPlayer.hidden = true;
    cassetteVideoPlayer.setAttribute('aria-busy', 'false');
    cassetteVideoLoading.hidden = true;
    videoPauseToggle.disabled = true;
    videoPauseToggle.textContent = 'Play';
    videoPauseToggle.setAttribute('aria-label', 'Play selected song');
    cassetteSection.classList.remove('has-player');

    if (!button.dataset.videoSrc) {
      cassetteStatus.textContent = `Audio for ${button.dataset.track} is not linked yet`;
      return;
    }

    const panel = button.nextElementSibling;
    const videoSlot = panel.querySelector('.track-video-slot');
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    activeTrackButton = button;
    button.setAttribute('aria-pressed', 'true');
    videoSlot.appendChild(cassetteVideoPlayer);
    cassetteStatus.textContent = `Loading ${button.dataset.track} lyric video...`;
    cassetteVideoPlayer.hidden = false;
    cassetteVideoLoadingText.textContent = `Loading ${button.dataset.track}...`;
    cassetteVideoLoading.hidden = false;
    cassetteVideoPlayer.setAttribute('aria-busy', 'true');
    videoPauseToggle.disabled = false;
    cassetteSection.classList.add('has-player');
    cassetteVideo.volume = 1;
    cassetteVideo.onloadedmetadata = () => {
      if (activeTrackButton !== button) return;

      activeClipEndTime = Math.min(Number(button.dataset.clipDuration), cassetteVideo.duration);
    };
    cassetteVideo.onerror = () => {
      if (activeTrackButton === button) {
        clearPlaybackTimeout();
        cassetteHero.classList.remove('is-playing');
        cassetteVideoLoading.hidden = true;
        cassetteVideoPlayer.setAttribute('aria-busy', 'false');
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-expanded', 'false');
        activeTrackButton = null;
        activeClipEndTime = null;
        clipFinished = false;
        videoPauseToggle.disabled = true;
        const isLocalFile = window.location.protocol === 'file:';
        cassetteStatus.textContent = isLocalFile
          ? `Your browser blocked local video playback. Open this page through a web server and leave ${button.dataset.videoSrc} beside index.html.`
          : `Couldn't play ${button.dataset.track}. Check that the video file is accessible and encoded as MP4 (H.264/AAC).`;
      }
    };
    cassetteVideo.src = button.dataset.videoSrc;
    cassetteVideo.load();
    startPlaybackTimeout(button);
    cassetteVideo.play().catch(() => {
      if (activeTrackButton === button && !cassetteVideo.error) {
        clearPlaybackTimeout();
        cassetteVideoLoading.hidden = true;
        cassetteVideoPlayer.setAttribute('aria-busy', 'false');
        videoPauseToggle.textContent = 'Play';
        cassetteStatus.textContent = `Tap Play to start ${button.dataset.track}.`;
      }
    });

    requestAnimationFrame(() => {
      const sectionBounds = cassetteSection.getBoundingClientRect();
      const playerBounds = cassetteVideoPlayer.getBoundingClientRect();
      const scrollAmount = playerBounds.bottom - (sectionBounds.bottom - 12);

      if (scrollAmount > 0) {
        cassetteSection.scrollTo({
          top: cassetteSection.scrollTop + scrollAmount,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      }
    });
  });
});

videoCloseToggle.addEventListener('click', closeSelectedSong);

videoPauseToggle.addEventListener('click', () => {
  if (!activeTrackButton) return;

  if (cassetteVideo.paused) {
    if (cassetteVideo.ended || clipFinished) {
      const trackButton = activeTrackButton;
      const startTime = Number(trackButton.dataset.start);
      activeClipEndTime = null;
      clipFinished = false;
      cassetteStatus.textContent = `Starting ${trackButton.dataset.track}...`;
      cassetteVideo.addEventListener('seeked', () => {
        if (activeTrackButton !== trackButton) return;

        activeClipEndTime = Math.min(
          startTime + Number(trackButton.dataset.clipDuration),
          cassetteVideo.duration
        );
      }, { once: true });
      if (cassetteVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        cassetteVideoLoadingText.textContent = `Getting ${trackButton.dataset.track} ready...`;
        cassetteVideoLoading.hidden = false;
        cassetteVideoPlayer.setAttribute('aria-busy', 'true');
      }
      startPlaybackTimeout(trackButton);
      cassetteVideo.currentTime = startTime;
      cassetteVideo.play().catch(() => {
        clearPlaybackTimeout();
        cassetteVideoLoading.hidden = true;
        cassetteVideoPlayer.setAttribute('aria-busy', 'false');
        cassetteStatus.textContent = `Couldn't restart ${trackButton.dataset.track}. Tap Play to retry.`;
      });
      return;
    }
    cassetteStatus.textContent = `Starting ${activeTrackButton.dataset.track}...`;
    if (cassetteVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      cassetteVideoLoadingText.textContent = `Getting ${activeTrackButton.dataset.track} ready...`;
      cassetteVideoLoading.hidden = false;
      cassetteVideoPlayer.setAttribute('aria-busy', 'true');
    }
    startPlaybackTimeout(activeTrackButton);
    cassetteVideo.play().catch(() => {
      clearPlaybackTimeout();
      cassetteVideoLoading.hidden = true;
      cassetteVideoPlayer.setAttribute('aria-busy', 'false');
      cassetteStatus.textContent = `Couldn't start ${activeTrackButton.dataset.track}. Tap Play to retry.`;
    });
  } else {
    clearPlaybackTimeout();
    cassetteVideo.pause();
  }
});

cassetteVideo.addEventListener('play', () => {
  if (activeTrackButton) {
    videoPauseToggle.textContent = 'Pause';
    videoPauseToggle.setAttribute('aria-label', `Pause ${activeTrackButton.dataset.track}`);
  }
});

cassetteVideo.addEventListener('waiting', () => {
  if (!activeTrackButton || cassetteVideo.paused) return;
  cassetteVideoLoadingText.textContent = 'Buffering your song...';
  cassetteVideoLoading.hidden = false;
  cassetteVideoPlayer.setAttribute('aria-busy', 'true');
  startPlaybackTimeout(activeTrackButton);
});

cassetteVideo.addEventListener('canplay', () => {
  if (!activeTrackButton || cassetteVideo.paused) return;

  clearPlaybackTimeout();
  cassetteVideoLoading.hidden = true;
  cassetteVideoPlayer.setAttribute('aria-busy', 'false');
});

cassetteVideo.addEventListener('playing', () => {
  clearPlaybackTimeout();
  if (!activeTrackButton) return;

  cassetteHero.classList.add('is-playing');
  videoPauseToggle.textContent = 'Pause';
  videoPauseToggle.setAttribute('aria-label', `Pause ${activeTrackButton.dataset.track}`);
  cassetteStatus.textContent = `Now playing: ${activeTrackButton.dataset.track}`;
  cassetteVideoLoading.hidden = true;
  cassetteVideoPlayer.setAttribute('aria-busy', 'false');
});

cassetteVideo.addEventListener('pause', () => {
  clearPlaybackTimeout();
  cassetteHero.classList.remove('is-playing');
  videoPauseToggle.textContent = 'Play';
  videoPauseToggle.setAttribute('aria-label', `Play ${activeTrackButton ? activeTrackButton.dataset.track : 'selected song'}`);
  if (activeTrackButton && !cassetteVideo.error && !cassetteVideo.ended && !clipFinished) {
    cassetteVideoLoading.hidden = true;
    cassetteVideoPlayer.setAttribute('aria-busy', 'false');
    cassetteStatus.textContent = `Paused: ${activeTrackButton.dataset.track}`;
  }
});

cassetteVideo.addEventListener('timeupdate', () => {
  if (!activeTrackButton || activeClipEndTime === null || cassetteVideo.currentTime < activeClipEndTime) return;

  clipFinished = true;
  clearPlaybackTimeout();
  markTrackListened(activeTrackButton);
  cassetteVideo.pause();
  cassetteStatus.textContent = `Finished: ${activeTrackButton.dataset.track} clip`;
});

cassetteVideo.addEventListener('ended', () => {
  cassetteHero.classList.remove('is-playing');
  if (activeTrackButton) {
    clipFinished = true;
    clearPlaybackTimeout();
    markTrackListened(activeTrackButton);
    videoPauseToggle.textContent = 'Play';
    videoPauseToggle.setAttribute('aria-label', `Play ${activeTrackButton.dataset.track}`);
    cassetteStatus.textContent = `Finished: ${activeTrackButton.dataset.track} clip`;
  }
});

updateDots();
