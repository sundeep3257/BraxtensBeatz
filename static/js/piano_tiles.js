// Piano Tiles Game Logic

let gameState = {
    chart: null,
    audio: null,
    isPlaying: false,
    startTime: 0,
    notes: [],
    activeTiles: [],
    score: 0,
    notesHit: 0,
    notesMissed: 0,
    perfectHits: 0,
    animationFrame: null,
    hitWindow: 150, // milliseconds - window for hitting a note
    perfectWindow: 50, // milliseconds - window for perfect hit
    scrollSpeed: 4, // pixels per frame (adjusted for 60fps) - increased for faster movement
    tileHeight: 80,
    hitZoneTop: 500,
    hitZoneBottom: 600,
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

// Initialize game
async function initGame(songId) {
    try {
        // Decode and normalize song ID
        const decodedSongId = decodeURIComponent(songId);
        
        // Load chart data - try multiple formats
        let response = await fetch(`/api/chart/${decodedSongId}`);
        if (!response.ok) {
            // Try with underscores if original failed
            const altSongId = decodedSongId.replace(/\s+/g, '_').toLowerCase();
            response = await fetch(`/api/chart/${altSongId}`);
            if (!response.ok) {
                throw new Error('Chart not found');
            }
        }
        
        gameState.chart = await response.json();
        songTitleEl.textContent = gameState.chart.title;
        
        // Load audio - use chart title which should match the filename
        const audioFilename = gameState.chart.title + '.mp3';
        console.log('Loading audio file:', audioFilename);
        gameAudio.src = `/static/music/${encodeURIComponent(audioFilename)}`;
        
        gameAudio.onerror = () => {
            console.error('Failed to load audio:', audioFilename);
            // Try alternative: song_id with spaces
            const altFilename = gameState.chart.song_id.replace(/_/g, ' ') + '.mp3';
            console.log('Trying alternative:', altFilename);
            gameAudio.src = `/static/music/${encodeURIComponent(altFilename)}`;
        };
        
        gameAudio.onloadeddata = () => {
            console.log('Audio loaded successfully');
        };
        
        gameAudio.onloadeddata = () => {
            console.log('Audio loaded successfully:', gameAudio.src);
        };
        
        // Prepare notes
        prepareNotes();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Failed to load game. Chart may not exist for this song.');
        window.location.href = '/';
    }
}

function prepareNotes() {
    // Sort notes by time and create tile objects
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
    
    console.log(`Prepared ${gameState.notes.length} notes for game`);
    console.log(`First note at ${gameState.notes[0]?.time}ms, last note at ${gameState.notes[gameState.notes.length - 1]?.time}ms`);
}

function getHitAlignmentMs(pixelsPerMs) {
    // Align tile middle with hit zone middle
    return (gameState.tileHeight - gameState.hitZoneHeight) / (2 * pixelsPerMs);
}

function setupEventListeners() {
    // Start game
    startGameBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', () => {
        resetGame();
        startGame();
    });
    homeBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyPress);
    
    // Touch/click controls on lanes
    for (let i = 0; i < 4; i++) {
        const hitArea = document.querySelector(`.lane-hit-area[data-lane="${i}"]`);
        hitArea.addEventListener('click', () => handleLaneHit(i));
        hitArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleLaneHit(i);
        });
    }
    
    // Audio ended
    gameAudio.addEventListener('ended', endGame);
}

function startGame() {
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    
    // Reset game state
    gameState.score = 0;
    gameState.notesHit = 0;
    gameState.notesMissed = 0;
    gameState.perfectHits = 0;
    gameState.activeTiles = [];
    gameState.isPlaying = true;
    
    // Reset all notes
    gameState.notes.forEach(note => {
        note.hit = false;
        note.missed = false;
        if (note.element) {
            note.element.remove();
            note.element = null;
        }
    });
    
    // Clear lanes
    for (let i = 0; i < 4; i++) {
        const laneContent = document.getElementById(`laneContent${i}`);
        laneContent.innerHTML = '';
    }
    
    // Start audio
    gameAudio.currentTime = 0;
    
    // Wait for audio to be ready
    gameAudio.addEventListener('canplay', () => {
        console.log('Audio can play');
    }, { once: true });
    
    gameAudio.play().then(() => {
        console.log('Audio started playing');
        console.log('Audio duration:', gameAudio.duration, 'seconds');
        console.log('Chart offset:', gameState.chart.offset_ms, 'ms');
        console.log('Total notes:', gameState.notes.length);
        console.log('First note at:', gameState.notes[0]?.time, 'ms');
        
        // Start game loop immediately
        console.log('Starting game loop');
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
    
    // Remove all tiles
    gameState.activeTiles.forEach(tile => {
        if (tile.element) {
            tile.element.remove();
        }
    });
    gameState.activeTiles = [];
}

function gameLoop() {
    if (!gameState.isPlaying) {
        console.log('Game loop stopped - isPlaying is false');
        return;
    }
    
    // Calculate audio time in milliseconds (raw audio time)
    const rawAudioTime = gameAudio.currentTime * 1000;
    // Calculate adjusted time (subtract offset to align with chart times)
    const audioTime = rawAudioTime - (gameState.chart.offset_ms || 500);
    
    // Log first few frames for debugging
    if (gameState.activeTiles.length === 0 && audioTime < 2000) {
        console.log(`Game loop: rawAudioTime=${rawAudioTime.toFixed(0)}ms, audioTime=${audioTime.toFixed(0)}ms, activeTiles=${gameState.activeTiles.length}`);
    }
    
    // Spawn new tiles
    spawnTiles(audioTime, rawAudioTime);
    
    // Update existing tiles
    updateTiles();
    
    // Check for missed notes
    checkMissedNotes(audioTime);
    
    // Update UI
    updateUI();
    
    // Continue loop
    gameState.animationFrame = requestAnimationFrame(gameLoop);
}

function spawnTiles(audioTime, rawAudioTime) {
    if (!gameState.chart || !gameState.chart.notes || !gameState.notes) {
        return;
    }
    
    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);
    const distanceToTravel = gameState.hitZoneTop + gameState.tileHeight; // 580px
    const timeToTravel = distanceToTravel / pixelsPerMs; // milliseconds needed to travel
    
    let spawnedCount = 0;
    
    gameState.notes.forEach(note => {
        if (note.element || note.hit || note.missed) return;
        
        // Calculate when to spawn: timeToTravel ms before the note should be hit
        const effectiveNoteTime = note.time + alignmentMs;
        const spawnTime = effectiveNoteTime - timeToTravel;
        
        // Spawn if we're at or past the spawn time (with generous buffer)
        // Allow spawning even if audioTime is negative (before offset)
        // Make the condition more permissive to ensure tiles spawn
        if (audioTime >= spawnTime - 1000 && audioTime < effectiveNoteTime + 2000) {
            // Double-check tile doesn't already exist
            if (!note.element) {
                createTile(note, audioTime);
                spawnedCount++;
            }
        }
    });
    
    // Debug: log when tiles are spawned (only first few times to avoid spam)
    if (spawnedCount > 0 && gameState.activeTiles.length < 10) {
        console.log(`Spawned ${spawnedCount} tiles at audioTime ${audioTime.toFixed(0)}ms, total active: ${gameState.activeTiles.length}`);
    }
}

function createTile(note, audioTime) {
    const laneContent = document.getElementById(`laneContent${note.lane}`);
    if (!laneContent) {
        console.error(`Lane content ${note.lane} not found`);
        return;
    }
    
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.noteTime = note.time;
    tile.dataset.lane = note.lane;
    
    // Calculate position: how many milliseconds until the note should be hit
    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);
    const timeUntilHit = (note.time + alignmentMs) - audioTime; // milliseconds until hit
    // Position: tile starts above and moves down to hit zone as timeUntilHit decreases
    const initialY = gameState.hitZoneTop - (timeUntilHit * pixelsPerMs);
    
    // Ensure tile is positioned correctly
    tile.style.position = 'absolute';
    tile.style.top = `${initialY}px`;
    tile.style.left = '0';
    tile.style.right = '0';
    tile.style.width = '100%';
    tile.style.height = `${gameState.tileHeight}px`;
    
    laneContent.appendChild(tile);
    note.element = tile;
    gameState.activeTiles.push({ note, element: tile });
    
    // Only log first few tiles to avoid console spam
    if (gameState.activeTiles.length <= 5) {
        console.log(`✓ Tile created: lane ${note.lane}, noteTime ${note.time}ms, audioTime ${audioTime.toFixed(0)}ms, Y ${initialY.toFixed(0)}px`);
    }
}

function updateTiles() {
    if (!gameAudio.duration) return; // Audio not ready yet
    
    const rawAudioTime = gameAudio.currentTime * 1000;
    const audioTime = rawAudioTime - (gameState.chart.offset_ms || 500);
    const pixelsPerMs = (gameState.scrollSpeed * 60) / 1000;
    const alignmentMs = getHitAlignmentMs(pixelsPerMs);
    
    gameState.activeTiles.forEach(({ note, element }) => {
        if (!element || !element.parentElement) return;
        
        // Calculate position based on time
        const timeUntilHit = (note.time + alignmentMs) - audioTime;
        const targetY = gameState.hitZoneTop - (timeUntilHit * pixelsPerMs);
        
        // Only update position if tile is still in reasonable range
        // Don't remove tiles that are just slightly past the hit zone
        if (targetY > -200 && targetY < 800) {
            element.style.top = `${targetY}px`;
        }
        
        // Only remove tiles that have clearly passed the bottom (well past hit zone)
        // Give them time to be visible and hittable
        if (targetY > gameState.hitZoneBottom + 200) {
            if (!note.hit && !note.missed) {
                note.missed = true;
                gameState.notesMissed++;
            }
            element.remove();
            note.element = null;
        }
    });
    
    // Clean up removed tiles
    gameState.activeTiles = gameState.activeTiles.filter(({ element }) => 
        element && element.parentElement
    );
}

function checkMissedNotes(audioTime) {
    // Only check for missed notes that are well past the hit zone
    // Give players a chance to hit notes even if slightly late
    const missThreshold = audioTime - (gameState.hitWindow * 3); // More lenient
    
    gameState.notes.forEach(note => {
        if (note.hit || note.missed) return;
        
        // Only mark as missed if note time has passed significantly
        // and we have a tile element that's past the hit zone
        if (note.time < missThreshold && note.element) {
            // Check if tile is visually past the hit zone
            const elementRect = note.element.getBoundingClientRect();
            const hitZone = document.querySelector('.hit-zone');
            if (hitZone) {
                const hitZoneRect = hitZone.getBoundingClientRect();
                // Only mark as missed if tile is well past the hit zone
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
    
    const key = e.key;
    if (key >= '1' && key <= '4') {
        const lane = parseInt(key) - 1;
        handleLaneHit(lane);
    }
}

function handleLaneHit(lane) {
    if (!gameState.isPlaying) return;
    
    // Visual feedback
    const hitArea = document.querySelector(`.lane-hit-area[data-lane="${lane}"]`);
    if (hitArea) {
        hitArea.classList.add('active');
        setTimeout(() => hitArea.classList.remove('active'), 100);
    }
    
    // Award points only if most of the tile is within the hit zone
    const hitZone = document.querySelector('.hit-zone');
    if (!hitZone) return;
    
    const hitZoneRect = hitZone.getBoundingClientRect();
    
    // Find the tile in this lane with the largest overlap with the hit zone
    let bestNote = null;
    let bestOverlapRatio = 0;
    
    gameState.notes.forEach(note => {
        if (note.lane !== lane || note.hit || note.missed || !note.element) return;
        
        const tileRect = note.element.getBoundingClientRect();
        const overlapTop = Math.max(tileRect.top, hitZoneRect.top);
        const overlapBottom = Math.min(tileRect.bottom, hitZoneRect.bottom);
        const overlapHeight = Math.max(0, overlapBottom - overlapTop);
        const overlapRatio = overlapHeight / tileRect.height;
        
        if (overlapRatio > bestOverlapRatio) {
            bestOverlapRatio = overlapRatio;
            bestNote = note;
        }
    });
    
    // Require majority of tile within hit zone
    if (bestNote && bestOverlapRatio >= 0.5) {
        bestNote.hit = true;
        gameState.notesHit++;
        
        // Perfect if tile center is very close to hit zone center
        const tileRect = bestNote.element.getBoundingClientRect();
        const tileCenter = (tileRect.top + tileRect.bottom) / 2;
        const hitZoneCenter = (hitZoneRect.top + hitZoneRect.bottom) / 2;
        const centerDistance = Math.abs(tileCenter - hitZoneCenter);
        const isPerfect = centerDistance <= (gameState.tileHeight * 0.1);
        
        if (isPerfect) {
            gameState.perfectHits++;
            gameState.score += 100;
            bestNote.element.classList.add('perfect');
        } else {
            gameState.score += 50;
            bestNote.element.classList.add('hit');
        }
        
        // Remove tile
        setTimeout(() => {
            if (bestNote.element) {
                bestNote.element.remove();
                bestNote.element = null;
            }
        }, 300);
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
    
    // Calculate final stats
    const totalNotes = gameState.notes.length;
    const finalAccuracy = totalNotes > 0 
        ? Math.round((gameState.notesHit / totalNotes) * 100) 
        : 100;
    
    // Update end screen
    finalScoreEl.textContent = gameState.score;
    finalAccuracyEl.textContent = `${finalAccuracy}%`;
    notesHitEl.textContent = `${gameState.notesHit} / ${totalNotes}`;
    perfectCountEl.textContent = gameState.perfectHits;
    
    // Show end screen
    endScreen.classList.remove('hidden');
}
