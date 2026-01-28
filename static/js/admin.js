// Admin Song Addition Page JavaScript

// State
let currentAudio = null;
let currentSongFile = null;
let notes = [];
let noteHistory = [];
let isPlaying = false;
let playStartTime = 0;
let playStartOffset = 0;
let timelineScale = 1; // pixels per second
let beatIntervalMs = 0; // milliseconds per beat
let pixelsPerBeat = 50; // pixels per beat for visualization
let autoScrollInterval = null;

// DOM Elements
const existingSongSelect = document.getElementById('existingSongSelect');
const songUpload = document.getElementById('songUpload');
const audioPlayer = document.getElementById('audioPlayer');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const currentTimeDisplay = document.getElementById('currentTime');
const totalTimeDisplay = document.getElementById('totalTime');
const chartConfigSection = document.getElementById('chartConfigSection');
const noteEditorSection = document.getElementById('noteEditorSection');
const saveSection = document.getElementById('saveSection');
const playPauseBtn = document.getElementById('playPauseBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const clearNotesBtn = document.getElementById('clearNotesBtn');
const undoBtn = document.getElementById('undoBtn');
const saveChartBtn = document.getElementById('saveChartBtn');
const saveStatus = document.getElementById('saveStatus');
const lanesGrid = document.getElementById('lanesGrid');
const timeline = document.getElementById('timeline');
const songIdInput = document.getElementById('songId');
const chartTitleInput = document.getElementById('chartTitle');
const chartBpmInput = document.getElementById('chartBpm');
const chartOffsetInput = document.getElementById('chartOffset');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Song selection
    existingSongSelect.addEventListener('change', handleSongSelect);
    songUpload.addEventListener('change', handleSongUpload);
    
    // Audio player events
    audioPlayer.addEventListener('loadedmetadata', handleAudioLoaded);
    audioPlayer.addEventListener('timeupdate', updateTimeDisplay);
    audioPlayer.addEventListener('ended', handleAudioEnded);
    
    // Editor controls
    playPauseBtn.addEventListener('click', togglePlayPause);
    addNoteBtn.addEventListener('click', addNoteAtCurrentTime);
    clearNotesBtn.addEventListener('click', clearAllNotes);
    undoBtn.addEventListener('click', undoLastNote);
    saveChartBtn.addEventListener('click', saveChart);
    
    // Lane click handlers - click lane to add note at clicked position, click note to delete
    for (let i = 0; i < 4; i++) {
        const laneContent = document.getElementById(`lane${i}`);
        
        laneContent.addEventListener('click', (e) => {
            // If clicked on a note, delete it
            if (e.target.classList.contains('note')) {
                deleteNote(e.target);
                return;
            }
            
            // Use offsetY directly - it gives position relative to lane-content element
            // Notes are positioned with 'top' CSS property relative to lane-content's content area
            // Lane-content has 10px padding, so offsetY of 10 is at the start of content area
            // The 'top' value for notes is exactly: offsetY - 10 (to account for padding)
            const topPosition = e.offsetY - 10;
            
            // If clicking in padding area, don't add note
            if (topPosition < 0) return;
            
            // Convert top position directly to beat position (this matches how notes are rendered)
            const beatPosition = topPosition / pixelsPerBeat;
            const offsetMs = parseInt(chartOffsetInput.value) || 500;
            const timeMs = Math.round(beatPosition * beatIntervalMs + offsetMs);
            
            // Ensure time is valid
            if (timeMs < 0) return;
            
            // Add note at calculated time
            addNoteToLaneAtTime(i, timeMs);
        });
    }
    
    // BPM change handler to update beat grid
    chartBpmInput.addEventListener('input', () => {
        updateBeatInterval();
        renderNotes();
    });
    
    // Offset change handler to update note positions
    chartOffsetInput.addEventListener('input', () => {
        renderNotes();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

function handleSongSelect(e) {
    const filename = e.target.value;
    if (filename) {
        loadSong(`/static/music/${filename}`);
        const songName = e.target.options[e.target.selectedIndex].text;
        songIdInput.value = filename.replace('.mp3', '').toLowerCase().replace(/\s+/g, '_');
        chartTitleInput.value = songName;
    }
}

function handleSongUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
        currentSongFile = file;
        const url = URL.createObjectURL(file);
        loadSong(url);
        const songName = file.name.replace('.mp3', '').replace('.MP3', '');
        songIdInput.value = songName.toLowerCase().replace(/\s+/g, '_');
        chartTitleInput.value = songName;
    }
}

function loadSong(url) {
    audioPlayer.src = url;
    audioPlayer.load();
    audioPlayerContainer.style.display = 'block';
    chartConfigSection.style.display = 'block';
    noteEditorSection.style.display = 'block';
    saveSection.style.display = 'block';
    notes = [];
    noteHistory = [];
    updateBeatInterval();
    renderNotes();
}

function updateBeatInterval() {
    const bpm = parseInt(chartBpmInput.value) || 120;
    beatIntervalMs = 60000 / bpm; // milliseconds per beat
}

function handleAudioLoaded() {
    updateTimeDisplay();
    updateTimeline();
}

function updateTimeDisplay() {
    const current = audioPlayer.currentTime;
    const total = audioPlayer.duration || 0;
    
    currentTimeDisplay.textContent = formatTime(current);
    totalTimeDisplay.textContent = formatTime(total);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function handleAudioEnded() {
    isPlaying = false;
    playPauseBtn.textContent = '▶ PLAY';
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
    // Remove playback indicators
    for (let i = 0; i < 4; i++) {
        const indicator = document.getElementById(`playback-indicator-${i}`);
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

function togglePlayPause() {
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playPauseBtn.textContent = '▶ PLAY';
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
        // Hide playback indicators when paused
        for (let i = 0; i < 4; i++) {
            const indicator = document.getElementById(`playback-indicator-${i}`);
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    } else {
        audioPlayer.play();
        isPlaying = true;
        playPauseBtn.textContent = '⏸ PAUSE';
        playStartTime = Date.now();
        playStartOffset = audioPlayer.currentTime * 1000;
        // Show playback indicators
        for (let i = 0; i < 4; i++) {
            const indicator = document.getElementById(`playback-indicator-${i}`);
            if (indicator) {
                indicator.style.display = 'block';
            }
        }
        startAutoScroll();
    }
}

function startAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }
    
    // Update playback indicator and scroll position
    autoScrollInterval = setInterval(() => {
        if (isPlaying && audioPlayer.duration) {
            updatePlaybackIndicator();
            
            const currentTimeMs = audioPlayer.currentTime * 1000;
            const offsetMs = parseInt(chartOffsetInput.value) || 500;
            const adjustedTime = currentTimeMs - offsetMs;
            const beatPosition = adjustedTime / beatIntervalMs;
            const scrollPosition = beatPosition * pixelsPerBeat - 200; // Offset to keep current position visible
            
            // Scroll the container (single scrollbar)
            const lanesContainer = document.querySelector('.lanes-container');
            if (lanesContainer) {
                lanesContainer.scrollTop = Math.max(0, scrollPosition);
            }
        }
    }, 50); // Update every 50ms for smooth scrolling
}

function updatePlaybackIndicator() {
    if (!audioPlayer.duration || beatIntervalMs === 0) return;
    
    const currentTimeMs = audioPlayer.currentTime * 1000;
    const offsetMs = parseInt(chartOffsetInput.value) || 500;
    const adjustedTime = currentTimeMs - offsetMs;
    const beatPosition = adjustedTime / beatIntervalMs;
    const indicatorPosition = beatPosition * pixelsPerBeat;
    
    // Update or create playback indicator across all lanes
    for (let i = 0; i < 4; i++) {
        let indicator = document.getElementById(`playback-indicator-${i}`);
        
        if (!indicator) {
            // Create indicator if it doesn't exist
            const laneContent = document.getElementById(`lane${i}`);
            if (laneContent) {
                indicator = document.createElement('div');
                indicator.id = `playback-indicator-${i}`;
                indicator.className = 'playback-indicator';
                laneContent.appendChild(indicator);
            } else {
                continue;
            }
        }
        
        indicator.style.top = `${indicatorPosition}px`;
    }
}

function addNoteToLaneAtTime(lane, timeMs) {
    if (!audioPlayer.src) {
        alert('Please select or upload a song first!');
        return;
    }
    
    if (beatIntervalMs === 0) {
        updateBeatInterval();
    }
    
    // Snap to nearest beat
    const offsetMs = parseInt(chartOffsetInput.value) || 500;
    const adjustedTime = timeMs - offsetMs;
    const beatNumber = Math.round(adjustedTime / beatIntervalMs);
    const snappedTimeMs = Math.round(beatNumber * beatIntervalMs + offsetMs);
    
    // Ensure time is not negative
    if (snappedTimeMs < 0) return;
    
    // Check if note already exists at this time and lane
    const existingNote = notes.find(n => 
        n.lane === lane && 
        Math.abs(n.time_ms - snappedTimeMs) < beatIntervalMs / 2
    );
    
    if (existingNote) {
        // Delete existing note if clicking on same beat
        noteHistory.push([...notes]);
        notes = notes.filter(n => !(n.time_ms === existingNote.time_ms && n.lane === existingNote.lane));
    } else {
        // Save to history for undo
        noteHistory.push([...notes]);
        
        // Add note snapped to beat
        const note = {
            time_ms: snappedTimeMs,
            lane: lane
        };
        
        notes.push(note);
        notes.sort((a, b) => a.time_ms - b.time_ms);
    }
    
    renderNotes();
}

function addNoteToLane(lane) {
    // Legacy function - adds note at current playback time
    const currentTimeMs = audioPlayer.currentTime * 1000;
    addNoteToLaneAtTime(lane, currentTimeMs);
}

function addNoteAtCurrentTime() {
    // Legacy function - now just prompts for lane
    if (!audioPlayer.src) {
        alert('Please select or upload a song first!');
        return;
    }
    
    const laneInput = prompt('Enter lane number (0-3):');
    if (laneInput === null) return;
    
    const lane = parseInt(laneInput);
    if (isNaN(lane) || lane < 0 || lane > 3) {
        alert('Invalid lane! Please enter 0, 1, 2, or 3.');
        return;
    }
    
    addNoteToLane(lane);
}

function clearAllNotes() {
    if (confirm('Are you sure you want to clear all notes?')) {
        noteHistory.push([...notes]);
        notes = [];
        renderNotes();
    }
}

function undoLastNote() {
    if (noteHistory.length > 0) {
        notes = noteHistory.pop();
        renderNotes();
    }
}

function deleteNote(noteElement) {
    const timeMs = parseInt(noteElement.dataset.timeMs);
    const lane = parseInt(noteElement.dataset.lane);
    
    noteHistory.push([...notes]);
    notes = notes.filter(n => !(n.time_ms === timeMs && n.lane === lane));
    renderNotes();
}

function renderNotes() {
    if (!audioPlayer.duration || beatIntervalMs === 0) {
        updateBeatInterval();
        if (beatIntervalMs === 0) return;
    }
    
    const totalDurationMs = audioPlayer.duration * 1000;
    const offsetMs = parseInt(chartOffsetInput.value) || 500;
    const totalBeats = Math.ceil((totalDurationMs - offsetMs) / beatIntervalMs) + 10; // Add some padding
    const laneHeight = totalBeats * pixelsPerBeat;
    
    // Set the lanes-grid height to match content
    const lanesGrid = document.getElementById('lanesGrid');
    if (lanesGrid) {
        lanesGrid.style.minHeight = `${laneHeight}px`;
    }
    
    // Clear and render all lanes with beat grid
    for (let i = 0; i < 4; i++) {
        const laneContent = document.getElementById(`lane${i}`);
        const existingIndicator = document.getElementById(`playback-indicator-${i}`);
        
        // Clear lane content but preserve playback indicator
        const beatLines = laneContent.querySelectorAll('.beat-line');
        const existingNotes = laneContent.querySelectorAll('.note');
        beatLines.forEach(line => line.remove());
        existingNotes.forEach(note => note.remove());
        
        laneContent.style.height = `${laneHeight}px`;
        
        // Draw beat grid lines
        for (let beat = 0; beat <= totalBeats; beat++) {
            const beatLine = document.createElement('div');
            beatLine.className = 'beat-line';
            beatLine.style.top = `${beat * pixelsPerBeat}px`;
            beatLine.style.height = '1px';
            laneContent.appendChild(beatLine);
        }
        
        // Re-add playback indicator if it existed
        if (existingIndicator && isPlaying) {
            laneContent.appendChild(existingIndicator);
        }
    }
    
    // Render notes (positioned based on beats)
    notes.forEach(note => {
        const laneContent = document.getElementById(`lane${note.lane}`);
        const adjustedTime = note.time_ms - offsetMs;
        const beatPosition = adjustedTime / beatIntervalMs;
        const topPosition = beatPosition * pixelsPerBeat;
        
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        noteElement.dataset.timeMs = note.time_ms;
        noteElement.dataset.lane = note.lane;
        noteElement.style.top = `${topPosition}px`;
        noteElement.textContent = formatTime(note.time_ms / 1000);
        laneContent.appendChild(noteElement);
    });
    
    // Update playback indicator position if playing
    if (isPlaying) {
        updatePlaybackIndicator();
    }
    
    // Update timeline
    updateTimeline();
}

function updateTimeline() {
    if (!audioPlayer.duration || beatIntervalMs === 0) return;
    
    timeline.innerHTML = '';
    const totalDuration = audioPlayer.duration;
    const totalDurationMs = totalDuration * 1000;
    const offsetMs = parseInt(chartOffsetInput.value) || 500;
    const totalBeats = Math.ceil(totalDurationMs / beatIntervalMs);
    
    // Mark every 4 beats (one measure if 4/4 time)
    for (let beat = 0; beat <= totalBeats; beat += 4) {
        const timeMs = beat * beatIntervalMs + offsetMs;
        const time = timeMs / 1000;
        if (time <= totalDuration) {
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${(time / totalDuration) * 100}%`;
            marker.setAttribute('data-time', formatTime(time));
            timeline.appendChild(marker);
        }
    }
    
    // Add beat markers (lighter lines)
    for (let beat = 0; beat <= totalBeats; beat++) {
        const timeMs = beat * beatIntervalMs + offsetMs;
        const time = timeMs / 1000;
        if (time <= totalDuration && beat % 4 !== 0) {
            const marker = document.createElement('div');
            marker.className = 'timeline-marker beat-marker';
            marker.style.left = `${(time / totalDuration) * 100}%`;
            timeline.appendChild(marker);
        }
    }
    
    // Add current time indicator
    const updateCurrentTimeIndicator = () => {
        const existingIndicator = document.getElementById('currentTimeIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (audioPlayer.duration) {
            const currentTime = audioPlayer.currentTime;
            const indicator = document.createElement('div');
            indicator.id = 'currentTimeIndicator';
            indicator.className = 'timeline-marker';
            indicator.style.left = `${(currentTime / audioPlayer.duration) * 100}%`;
            indicator.style.background = '#ff00ff';
            indicator.style.width = '3px';
            timeline.appendChild(indicator);
        }
    };
    
    updateCurrentTimeIndicator();
    setInterval(updateCurrentTimeIndicator, 100);
}

function handleKeyboard(e) {
    // Spacebar to play/pause
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        togglePlayPause();
    }
    
    // Number keys 1-4 to add note to lane
    if (e.key >= '1' && e.key <= '4') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            const lane = parseInt(e.key) - 1;
            addNoteToLane(lane);
        }
    }
}

async function saveChart() {
    // Validate inputs
    if (!songIdInput.value.trim()) {
        saveStatus.textContent = 'Error: Song ID is required!';
        saveStatus.className = 'save-status error';
        return;
    }
    
    if (!chartTitleInput.value.trim()) {
        saveStatus.textContent = 'Error: Title is required!';
        saveStatus.className = 'save-status error';
        return;
    }
    
    if (notes.length === 0) {
        saveStatus.textContent = 'Error: No notes added!';
        saveStatus.className = 'save-status error';
        return;
    }
    
    // Build chart data
    const chartData = {
        song_id: songIdInput.value.trim(),
        title: chartTitleInput.value.trim(),
        bpm: parseInt(chartBpmInput.value) || 120,
        offset_ms: parseInt(chartOffsetInput.value) || 500,
        lanes: 4,
        notes: notes.map(note => ({
            time_ms: note.time_ms,
            lane: note.lane
        }))
    };
    
    // Save chart
    try {
        const response = await fetch('/admin/song-addition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chartData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            saveStatus.textContent = '✓ Chart saved successfully!';
            saveStatus.className = 'save-status success';
        } else {
            saveStatus.textContent = `Error: ${result.message || 'Failed to save chart'}`;
            saveStatus.className = 'save-status error';
        }
    } catch (error) {
        saveStatus.textContent = `Error: ${error.message}`;
        saveStatus.className = 'save-status error';
    }
}
