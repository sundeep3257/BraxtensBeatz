// Guitar Hero Game Logic

let gameState = {
    chart: null,
    audio: null,
    isPlaying: false,
    startTime: 0,
    notes: [],
    activeNotes: [],
    score: 0,
    notesHit: 0,
    notesMissed: 0,
    perfectHits: 0,
    animationFrame: null,
    hitWindow: 150,
    perfectWindow: 50,
    scrollSpeed: 4,
    noteSize: 60,
    hitZoneTop: 420,
    hitZoneBottom: 520,
    hitZoneHeight: 100
};

// DOM Elements
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const startGameBtn = document.getElementById('startGameBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const homeBtn = document.getElementById('homeBtn');
const gameAudio = document.getElementById('gameAudio');
const songTitleEl = document.getElementById('songTitle');
const scoreEl = document.getElementById('score');
const accuracyEl = document.getElementById('accuracy');
const finalScoreEl = document.getElementById('finalScore');
const finalAccuracyEl = document.getElementById('finalAccuracy');
const notesHitEl = document.getElementById('notesHit');
const perfectCountEl = document.getElementById('perfectCount');
const lanesContainer = document.getElementById('lanesContainer');

const keyMap = {
    a: 0,
    s: 1,
    d: 2,
    f: 3,
    1: 0,
    2: 1,
    3: 2,
    4: 3
};

async function initGame(songId) {
    try {
        syncDimensions();
        const decodedSongId = decodeURIComponent(songId);

        let response = await fetch(`/api/chart/${decodedSongId}`);
        if (!response.ok) {
            const altSongId = decodedSongId.replace(/\s+/g, '_').toLowerCase();
            response = await fetch(`/api/chart/${altSongId}`);
            if (!response.ok) {
                throw new Error('Chart not found');
            }
        }

        gameState.chart = await response.json();
        songTitleEl.textContent = gameState.chart.title;

        const audioFilename = gameState.chart.title + '.mp3';
        gameAudio.src = `/static/music/${encodeURIComponent(audioFilename)}`;

        gameAudio.onerror = () => {
            const altFilename = gameState.chart.song_id.replace(/_/g, ' ') + '.mp3';
            gameAudio.src = `/static/music/${encodeURIComponent(altFilename)}`;
        };

        prepareNotes();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Failed to load game. Chart may not exist for this song.');
        window.location.href = '/';
    }
}

function syncDimensions() {
    const rootStyles = getComputedStyle(document.documentElement);
    const noteSize = parseFloat(rootStyles.getPropertyValue('--gh-note-size'));
    const hitTop = parseFloat(rootStyles.getPropertyValue('--gh-hit-top'));
    const hitHeight = parseFloat(rootStyles.getPropertyValue('--gh-hit-height'));

    if (!Number.isNaN(noteSize)) {
        gameState.noteSize = noteSize;
    }
    if (!Number.isNaN(hitTop)) {
        gameState.hitZoneTop = hitTop;
    }
    if (!Number.isNaN(hitHeight)) {
        gameState.hitZoneHeight = hitHeight;
    }
    gameState.hitZoneBottom = gameState.hitZoneTop + gameState.hitZoneHeight;
}

function prepareNotes() {
    if (!gameState.chart || !gameState.chart.notes) {
        console.error('No notes found in chart');
        return;
    }

    gameState.notes = gameState.chart.notes
        .map(note => ({
            time: note.time_ms,
            lane: note.lane,
            hit: false,
            missed: false,
            element: null
        }))
        .sort((a, b) => a.time - b.time);
}

function getHitAlignmentMs(pixelsPerMs) {
    return (gameState.noteSize - gameState.hitZoneHeight) / (2 * pixelsPerMs);
}

function setupEventListeners() {
    startGameBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', () => {
        resetGame();
        startGame();
    });
    homeBtn.addEventListener('click', () => {
        window.location.href = '/';
    });

    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', syncDimensions);

    for (let i = 0; i < 4; i++) {
        const hitArea = document.querySelector(`.lane-hit-area[data-lane="${i}"]`);
        hitArea.addEventListener('click', () => handleLaneHit(i));
        hitArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleLaneHit(i);
        });
    }

    gameAudio.addEventListener('ended', endGame);
}

function startGame() {
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');

    gameState.score = 0;
    gameState.notesHit = 0;
    gameState.notesMissed = 0;
    gameState.perfectHits = 0;
    gameState.activeNotes = [];
    gameState.isPlaying = true;

    gameState.notes.forEach(note => {
        note.hit = false;
        note.missed = false;
        if (note.element) {
            note.element.remove();
            note.element = null;
        }
    });

    for (let i = 0; i < 4; i++) {
        const laneContent = document.getElementById(`laneContent${i}`);
        laneContent.innerHTML = '';
    }

    gameAudio.currentTime = 0;

    gameAudio.play().then(() => {
        gameLoop();
    }).catch(error => {
        console.error('Error playing audio:', error);
        alert('Failed to play audio. Please try again.');
    });

    updateUI();
}

function resetGame() {
    gameState.isPlaying = false;
    if (gameState.animationFrame) {
        cancelAnimationFrame(gameState.animationFrame);
    }
    gameAudio.pause();
    gameAudio.currentTime = 0;

    gameState.activeNotes.forEach(note => {
        if (note.element) {
            note.element.remove();
        }
    });
    gameState.activeNotes = [];
}

function gameLoop() {
    if (!gameState.isPlaying) {
        return;
    }

    const rawAudioTime = gameAudio.currentTime * 1000;
    const audioTime = rawAudioTime - (gameState.chart.offset_ms || 500);

    spawnNotes(audioTime);
    updateNotes();
    checkMissedNotes(audioTime);
    updateUI();

    gameState.animationFrame = requestAnimationFrame(gameLoop);
}

function spawnNotes(audioTime) {
    if (!gameState.chart || !gameState.chart.notes || !gameState.notes) {
        return;
    }

    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);
    const distanceToTravel = gameState.hitZoneTop + gameState.noteSize;
    const timeToTravel = distanceToTravel / pixelsPerMs;

    gameState.notes.forEach(note => {
        if (note.element || note.hit || note.missed) return;

        const effectiveNoteTime = note.time + alignmentMs;
        const spawnTime = effectiveNoteTime - timeToTravel;

        if (audioTime >= spawnTime - 1000 && audioTime < effectiveNoteTime + 2000) {
            if (!note.element) {
                createNote(note, audioTime);
            }
        }
    });
}

function createNote(note, audioTime) {
    const laneContent = document.getElementById(`laneContent${note.lane}`);
    if (!laneContent) {
        return;
    }

    const noteEl = document.createElement('div');
    noteEl.className = 'note';
    noteEl.dataset.noteTime = note.time;
    noteEl.dataset.lane = note.lane;

    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);
    const timeUntilHit = (note.time + alignmentMs) - audioTime;
    const initialY = gameState.hitZoneTop - (timeUntilHit * pixelsPerMs);

    noteEl.style.top = `${initialY}px`;
    noteEl.style.height = `${gameState.noteSize}px`;
    noteEl.style.width = `${gameState.noteSize}px`;

    laneContent.appendChild(noteEl);
    note.element = noteEl;
    gameState.activeNotes.push({ note, element: noteEl });
}

function updateNotes() {
    if (!gameAudio.duration) return;

    const rawAudioTime = gameAudio.currentTime * 1000;
    const audioTime = rawAudioTime - (gameState.chart.offset_ms || 500);
    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);

    gameState.activeNotes.forEach(({ note, element }) => {
        if (!element || !element.parentElement) return;

        const timeUntilHit = (note.time + alignmentMs) - audioTime;
        const targetY = gameState.hitZoneTop - (timeUntilHit * pixelsPerMs);

        if (targetY > -200 && targetY < 800) {
            element.style.top = `${targetY}px`;
        }

        if (targetY > gameState.hitZoneBottom + 200) {
            if (!note.hit && !note.missed) {
                note.missed = true;
                gameState.notesMissed++;
            }
            element.remove();
            note.element = null;
        }
    });

    gameState.activeNotes = gameState.activeNotes.filter(({ element }) =>
        element && element.parentElement
    );
}

function checkMissedNotes(audioTime) {
    const missThreshold = audioTime - (gameState.hitWindow * 3);

    gameState.notes.forEach(note => {
        if (note.hit || note.missed) return;

        if (note.time < missThreshold && note.element) {
            const elementRect = note.element.getBoundingClientRect();
            const hitZone = document.querySelector('.hit-zone');
            if (hitZone) {
                const hitZoneRect = hitZone.getBoundingClientRect();
                if (elementRect.top > hitZoneRect.bottom + 100) {
                    note.missed = true;
                    gameState.notesMissed++;
                    note.element.classList.add('missed');
                    setTimeout(() => {
                        if (note.element) {
                            note.element.remove();
                            note.element = null;
                        }
                    }, 500);
                }
            }
        }
    });
}

function handleKeyPress(e) {
    if (!gameState.isPlaying) return;

    const lane = keyMap[e.key.toLowerCase()];
    if (lane === 0 || lane === 1 || lane === 2 || lane === 3) {
        handleLaneHit(lane);
    }
}

function handleLaneHit(lane) {
    if (!gameState.isPlaying) return;

    const hitArea = document.querySelector(`.lane-hit-area[data-lane="${lane}"]`);
    const fretButton = document.querySelector(`.fret-button[data-lane="${lane}"]`);
    if (hitArea) {
        hitArea.classList.add('active');
        setTimeout(() => hitArea.classList.remove('active'), 100);
    }
    if (fretButton) {
        fretButton.classList.add('active');
        setTimeout(() => fretButton.classList.remove('active'), 120);
    }

    const hitZone = document.querySelector('.hit-zone');
    if (!hitZone) return;

    const hitZoneRect = hitZone.getBoundingClientRect();

    let bestNote = null;
    let bestOverlapRatio = 0;

    gameState.notes.forEach(note => {
        if (note.lane !== lane || note.hit || note.missed || !note.element) return;

        const noteRect = note.element.getBoundingClientRect();
        const overlapTop = Math.max(noteRect.top, hitZoneRect.top);
        const overlapBottom = Math.min(noteRect.bottom, hitZoneRect.bottom);
        const overlapHeight = Math.max(0, overlapBottom - overlapTop);
        const overlapRatio = overlapHeight / noteRect.height;

        if (overlapRatio > bestOverlapRatio) {
            bestOverlapRatio = overlapRatio;
            bestNote = note;
        }
    });

    if (bestNote && bestOverlapRatio >= 0.5) {
        bestNote.hit = true;
        gameState.notesHit++;

        const noteRect = bestNote.element.getBoundingClientRect();
        const noteCenter = (noteRect.top + noteRect.bottom) / 2;
        const hitZoneCenter = (hitZoneRect.top + hitZoneRect.bottom) / 2;
        const centerDistance = Math.abs(noteCenter - hitZoneCenter);
        const isPerfect = centerDistance <= (gameState.noteSize * 0.1);

        if (isPerfect) {
            gameState.perfectHits++;
            gameState.score += 100;
            bestNote.element.classList.add('perfect');
        } else {
            gameState.score += 50;
            bestNote.element.classList.add('hit');
        }

        setTimeout(() => {
            if (bestNote.element) {
                bestNote.element.remove();
                bestNote.element = null;
            }
        }, 250);
    }
}

function updateUI() {
    scoreEl.textContent = gameState.score;

    const totalNotes = gameState.notesHit + gameState.notesMissed;
    const accuracy = totalNotes > 0
        ? Math.round((gameState.notesHit / totalNotes) * 100)
        : 100;
    accuracyEl.textContent = `${accuracy}%`;
}

function endGame() {
    gameState.isPlaying = false;
    if (gameState.animationFrame) {
        cancelAnimationFrame(gameState.animationFrame);
    }

    const totalNotes = gameState.notes.length;
    const finalAccuracy = totalNotes > 0
        ? Math.round((gameState.notesHit / totalNotes) * 100)
        : 100;

    finalScoreEl.textContent = gameState.score;
    finalAccuracyEl.textContent = `${finalAccuracy}%`;
    notesHitEl.textContent = `${gameState.notesHit} / ${totalNotes}`;
    perfectCountEl.textContent = gameState.perfectHits;

    endScreen.classList.remove('hidden');
}
