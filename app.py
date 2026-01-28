from flask import Flask, render_template, jsonify, request
import os
import json

app = Flask(__name__)

# Get available songs from static/music directory
def get_available_songs():
    music_dir = os.path.join('static', 'music')
    songs = []
    if os.path.exists(music_dir):
        for file in os.listdir(music_dir):
            if file.endswith('.mp3'):
                # Remove file extension for display
                song_name = file.replace('.mp3', '')
                songs.append({
                    'name': song_name,
                    'filename': file
                })
    return songs

@app.route('/')
def index():
    songs = get_available_songs()
    return render_template('index.html', songs=songs)

@app.route('/api/songs')
def get_songs():
    songs = get_available_songs()
    return jsonify(songs)

@app.route('/admin/song-addition', methods=['GET', 'POST'])
def admin_song_addition():
    if request.method == 'POST':
        # Handle saving the note chart
        data = request.get_json()
        
        # Create charts directory if it doesn't exist
        charts_dir = os.path.join('static', 'charts')
        if not os.path.exists(charts_dir):
            os.makedirs(charts_dir)
        
        # Save the chart as JSON
        chart_filename = f"{data.get('song_id', 'chart')}.json"
        chart_path = os.path.join(charts_dir, chart_filename)
        
        with open(chart_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        return jsonify({'success': True, 'message': 'Chart saved successfully!'})
    
    # GET request - render the admin page
    songs = get_available_songs()
    return render_template('admin_song_addition.html', songs=songs)

@app.route('/game/piano-tiles')
def piano_tiles():
    song = request.args.get('song')
    return render_template('piano_tiles.html', song=song)

@app.route('/game/guitar-hero')
def guitar_hero():
    song = request.args.get('song')
    return render_template('guitar_hero.html', song=song)

@app.route('/api/chart/<song_id>')
def get_chart(song_id):
    charts_dir = os.path.join('static', 'charts')
    
    # Try multiple formats: original, lowercase, and with underscores
    possible_names = [
        song_id,  # Original format
        song_id.lower(),  # Lowercase
        song_id.lower().replace(' ', '_'),  # Lowercase with underscores
        song_id.replace(' ', '_'),  # Original case with underscores
    ]
    
    for name in possible_names:
        chart_path = os.path.join(charts_dir, f'{name}.json')
        if os.path.exists(chart_path):
            with open(chart_path, 'r') as f:
                chart_data = json.load(f)
            return jsonify(chart_data)
    
    return jsonify({'error': 'Chart not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)
