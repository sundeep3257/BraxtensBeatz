// Game and song selection state
let selectedGame = null;
let selectedSong = null;

// DOM Elements
const gameButtons = document.querySelectorAll('.game-btn');
const songButtons = document.querySelectorAll('.song-btn');
const songSelection = document.getElementById('songSelection');
const startSection = document.getElementById('startSection');
const selectedGameDisplay = document.getElementById('selectedGame');
const selectedSongDisplay = document.getElementById('selectedSong');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// Game selection handler
gameButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all game buttons
        gameButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Store selected game
        selectedGame = button.dataset.game;
        
        // Show song selection
        songSelection.classList.remove('hidden');
        
        // Update display
        updateSelectedInfo();
        
        // Check if we can show start button
        checkStartButton();
    });
});

// Song selection handler
songButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all song buttons
        songButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Store selected song
        selectedSong = button.dataset.song;
        const songName = button.dataset.songName;
        
        // Update display
        updateSelectedInfo();
        
        // Check if we can show start button
        checkStartButton();
    });
});

// Update selected info display
function updateSelectedInfo() {
    if (selectedGame) {
        const gameName = selectedGame === 'piano-tiles' ? 'PIANO TILES' : 'GUITAR HERO';
        selectedGameDisplay.textContent = gameName;
    }
    
    if (selectedSong) {
        const songBtn = document.querySelector(`.song-btn[data-song="${selectedSong}"]`);
        if (songBtn) {
            selectedSongDisplay.textContent = songBtn.dataset.songName;
        }
    }
}

// Check if start button should be shown
function checkStartButton() {
    if (selectedGame && selectedSong) {
        startSection.classList.remove('hidden');
    } else {
        startSection.classList.add('hidden');
    }
}

// Start game handler
startBtn.addEventListener('click', () => {
    if (selectedGame && selectedSong) {
        if (selectedGame === 'piano-tiles') {
            // Extract song ID from filename (remove .mp3 extension)
            // Convert to chart format: lowercase with underscores
            let songId = selectedSong.replace('.mp3', '');
            songId = songId.toLowerCase().replace(/\s+/g, '_');
            window.location.href = `/game/piano-tiles?song=${encodeURIComponent(songId)}`;
        } else {
            // Guitar Hero
            let songId = selectedSong.replace('.mp3', '');
            songId = songId.toLowerCase().replace(/\s+/g, '_');
            window.location.href = `/game/guitar-hero?song=${encodeURIComponent(songId)}`;
        }
    }
});

// Reset handler
resetBtn.addEventListener('click', () => {
    // Reset state
    selectedGame = null;
    selectedSong = null;
    
    // Remove active classes
    gameButtons.forEach(btn => btn.classList.remove('active'));
    songButtons.forEach(btn => btn.classList.remove('active'));
    
    // Hide sections
    songSelection.classList.add('hidden');
    startSection.classList.add('hidden');
    
    // Reset display
    selectedGameDisplay.textContent = '-';
    selectedSongDisplay.textContent = '-';
});

// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Escape key to reset
    if (e.key === 'Escape') {
        resetBtn.click();
    }
    
    // Enter key to start (if start button is visible)
    if (e.key === 'Enter' && !startSection.classList.contains('hidden')) {
        startBtn.click();
    }
});
