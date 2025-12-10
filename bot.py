import time
import requests
import random
import json
import threading
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()
user_token = os.getenv('USER_TOKEN')
app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.getenv('FLASK_SECRET', 'default-secret-key')
CORS(app)


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response


@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return '', 200


class Database:
    def __init__(self, db_name='user_database.db'):
        self.db_name = db_name
        self.lock = threading.Lock()
        self.init_db()

    def init_db(self):
        with sqlite3.connect(self.db_name) as db:
            db.execute('''
                CREATE TABLE IF NOT EXISTS message_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    channel_name TEXT,
                    server_name TEXT,
                    mode TEXT NOT NULL DEFAULT 'time',
                    value INTEGER,
                    text TEXT NOT NULL,
                    is_active INTEGER DEFAULT 0,
                    message_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_executed TIMESTAMP NULL,
                    random_delay INTEGER DEFAULT 0,
                    next_execution_time FLOAT DEFAULT 0
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            db.commit()

    def add_source(self, server_id, channel_id, value, text, random_delay=False, server_name=None, channel_name=None):
        with self.lock:
            with sqlite3.connect(self.db_name) as db:
                cursor = db.cursor()
                current_time = time.time()
                next_exec_time = current_time + value
                cursor.execute('''
                    INSERT INTO message_sources 
                    (server_id, channel_id, server_name, channel_name, mode, value, text, is_active, message_count, random_delay, next_execution_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (server_id, channel_id, server_name, channel_name, 'time', value, text, 0, 0,
                      1 if random_delay else 0, next_exec_time))
                db.commit()
                return cursor.lastrowid

    def get_all_sources(self):
        with sqlite3.connect(self.db_name) as db:
            cursor = db.execute('SELECT * FROM message_sources ORDER BY created_at DESC')
            return cursor.fetchall()

    def get_active_sources(self):
        with sqlite3.connect(self.db_name) as db:
            cursor = db.execute('SELECT * FROM message_sources WHERE is_active = 1')
            return cursor.fetchall()

    def update_source(self, source_id, **kwargs):
        with self.lock:
            set_clause = ', '.join([f"{key} = ?" for key in kwargs.keys()])
            values = list(kwargs.values())
            values.append(source_id)
            with sqlite3.connect(self.db_name) as db:
                db.execute(f'UPDATE message_sources SET {set_clause} WHERE id = ?', values)
                db.commit()

    def delete_source(self, source_id):
        with self.lock:
            with sqlite3.connect(self.db_name) as db:
                db.execute('DELETE FROM message_sources WHERE id = ?', (source_id,))
                db.commit()

    def get_source(self, source_id):
        with sqlite3.connect(self.db_name) as db:
            cursor = db.execute('SELECT * FROM message_sources WHERE id = ?', (source_id,))
            return cursor.fetchone()

    def save_config(self, name, data):
        with self.lock:
            with sqlite3.connect(self.db_name) as db:
                cursor = db.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO configs (name, data) 
                    VALUES (?, ?)
                ''', (name, json.dumps(data)))
                db.commit()
                return cursor.lastrowid

    def get_config(self, name):
        with sqlite3.connect(self.db_name) as db:
            cursor = db.execute('SELECT data FROM configs WHERE name = ?', (name,))
            result = cursor.fetchone()
            return json.loads(result[0]) if result else None

    def get_all_configs(self):
        with sqlite3.connect(self.db_name) as db:
            cursor = db.execute('SELECT * FROM configs ORDER BY created_at DESC')
            return cursor.fetchall()

    def delete_config(self, config_id):
        with self.lock:
            with sqlite3.connect(self.db_name) as db:
                db.execute('DELETE FROM configs WHERE id = ?', (config_id,))
                db.commit()


class DiscordSelfBot:
    def __init__(self, token):
        self.token = token
        self.headers = {
            'Authorization': token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.user_info = None
        self.guilds = []
        self.is_connected = False
        self.user_id = None
        self.guild_cache = {}
        self.channel_cache = {}

    def connect(self):
        try:
            response = requests.get('https://discord.com/api/v9/users/@me', headers=self.headers, timeout=10)
            if response.status_code == 200:
                self.user_info = response.json()
                self.user_id = self.user_info['id']
                self.is_connected = True

                guilds_response = requests.get('https://discord.com/api/v9/users/@me/guilds', headers=self.headers,
                                               timeout=10)
                if guilds_response.status_code == 200:
                    self.guilds = guilds_response.json()
                    for guild in self.guilds:
                        self.guild_cache[guild['id']] = guild['name']

                print(f'✅ Connected: {self.user_info["username"]}')
                return True
            else:
                print(f'❌ Failed to connect: {response.status_code}')
                return False
        except Exception as e:
            print(f'❌ Failed to connect: {e}')
            return False

    def get_guild_name(self, guild_id):
        if guild_id in self.guild_cache:
            return self.guild_cache[guild_id]

        try:
            response = requests.get(f'https://discord.com/api/v9/guilds/{guild_id}', headers=self.headers, timeout=5)
            if response.status_code == 200:
                guild_data = response.json()
                self.guild_cache[guild_id] = guild_data.get('name', f'Server {guild_id}')
                return self.guild_cache[guild_id]
        except:
            pass
        return f'Server {guild_id}'

    def get_channels(self, guild_id):
        try:
            response = requests.get(f'https://discord.com/api/v9/guilds/{guild_id}/channels', headers=self.headers,
                                    timeout=10)
            if response.status_code == 200:
                channels = response.json()
                for channel in channels:
                    if channel['type'] == 0:
                        self.channel_cache[channel['id']] = channel.get('name', f'channel-{channel["id"]}')
                return channels
            return []
        except Exception as e:
            print(f'❌ Failed to get channels: {e}')
            return []

    def get_channel_info(self, channel_id):
        if channel_id in self.channel_cache:
            return {'name': self.channel_cache[channel_id]}

        try:
            response = requests.get(f'https://discord.com/api/v9/channels/{channel_id}', headers=self.headers,
                                    timeout=5)
            if response.status_code == 200:
                channel_data = response.json()
                channel_name = channel_data.get('name', f'channel-{channel_id}')
                self.channel_cache[channel_id] = channel_name
                return {'name': channel_name, 'guild_id': channel_data.get('guild_id')}
        except:
            pass
        return {'name': f'channel-{channel_id}'}

    def send_message(self, channel_id, message):
        try:
            channel_info = self.get_channel_info(channel_id)

            response = requests.post(
                f'https://discord.com/api/v9/channels/{channel_id}/messages',
                headers=self.headers,
                json={'content': message},
                timeout=10)

            if response.status_code == 200:
                channel_name = channel_info.get('name', f'ID: {channel_id}')
                print(f'✅ Message sent to #{channel_name}')
                return True
            elif response.status_code == 429:
                retry_after = response.json().get('retry_after', 1)
                print(f'⚠️ Rate limited, retrying after {retry_after}s')
                time.sleep(retry_after)
                return self.send_message(channel_id, message)
            else:
                print(f'❌ Error sending message: {response.status_code} - {response.text}')
                return False
        except Exception as e:
            print(f'❌ Error sending message: {e}')
            return False


class TaskManager:
    def __init__(self, discord_bot: DiscordSelfBot, database: Database):
        self.discord_bot = discord_bot
        self.db = database
        self.task_lock = threading.Lock()
        self.scheduler_running = True
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()

    def _scheduler_loop(self):
        while self.scheduler_running:
            try:
                self._process_time_tasks()
                time.sleep(0.1)
            except Exception as e:
                print(f'❌ Error in scheduler: {e}')
                time.sleep(1)

    def _process_time_tasks(self):
        with self.task_lock:
            try:
                time_sources = self.db.get_active_sources()
                if not time_sources:
                    return
                current_time = time.time()
                for source in time_sources:
                    source_id = source[0]
                    channel_id = source[2]
                    value = source[6]
                    text = source[7]
                    is_active = source[8]
                    random_delay_enabled = source[12] if len(source) > 12 else 0
                    next_execution_time = source[13] if len(source) > 13 else 0

                    if not is_active:
                        continue

                    if next_execution_time == 0:
                        next_execution_time = current_time + value
                        if random_delay_enabled:
                            next_execution_time += random.randint(1, 180)
                        self.db.update_source(source_id, next_execution_time=next_execution_time)
                        continue

                    if current_time >= next_execution_time:
                        success = self.discord_bot.send_message(channel_id, text)
                        if success:
                            next_base_time = current_time + value
                            extra_delay = 0
                            if random_delay_enabled:
                                extra_delay = random.randint(1, 180)
                                print(f'🎲 Added random delay: {extra_delay}s for task {source_id}')
                            new_next_time = next_base_time + extra_delay
                            self.db.update_source(source_id,
                                                  last_executed=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                  next_execution_time=new_next_time,
                                                  message_count=source[9] + 1 if len(source) > 9 else 1)
                            print(
                                f'⏰ Next execution for task {source_id}: {datetime.fromtimestamp(new_next_time).strftime("%H:%M:%S")}')
                        else:
                            new_next_time = current_time + 30
                            self.db.update_source(source_id, next_execution_time=new_next_time)
            except Exception as e:
                print(f'❌ Error processing tasks: {e}')

    def stop_all_tasks(self):
        with self.task_lock:
            sources = self.db.get_all_sources()
            for source in sources:
                if source[8]:
                    self.db.update_source(source[0], is_active=0, next_execution_time=0)

    def stop_task(self, source_id: int):
        with self.task_lock:
            self.db.update_source(source_id, is_active=0, next_execution_time=0)

    def start_task(self, source_id: int):
        with self.task_lock:
            source = self.db.get_source(source_id)
            if source:
                current_time = time.time()
                value = source[6]
                random_delay_enabled = source[12] if len(source) > 12 else 0
                next_time = current_time + value
                if random_delay_enabled:
                    next_time += random.randint(1, 180)
                self.db.update_source(source_id, is_active=1, next_execution_time=next_time,
                                      last_executed=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))


db = Database()
discord_bot = DiscordSelfBot(user_token)
if not discord_bot.connect():
    print('⚠️ Cannot connect to Discord API. Check token.')
task_manager = TaskManager(discord_bot, db)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/status')
def api_status():
    return jsonify({
        'status': 'connected' if discord_bot.is_connected else 'disconnected',
        'user': discord_bot.user_info,
        'user_id': discord_bot.user_id
    })


@app.route('/api/servers')
def get_servers():
    return jsonify([{'id': g['id'], 'name': g['name']} for g in discord_bot.guilds])


@app.route('/api/channels/<server_id>')
def get_channels(server_id):
    channels = discord_bot.get_channels(server_id)
    return jsonify([{'id': c['id'], 'name': c['name']} for c in channels if c['type'] == 0])


@app.route('/api/channel_info/<channel_id>')
def get_channel_info(channel_id):
    try:
        info = discord_bot.get_channel_info(channel_id)
        if 'guild_id' in info:
            info['guild_name'] = discord_bot.get_guild_name(info['guild_id'])
        return jsonify(info)
    except Exception as e:
        return jsonify({'name': f'channel-{channel_id}', 'error': str(e)})


@app.route('/api/sources')
def get_sources():
    try:
        sources = db.get_all_sources()
        result = []
        for s in sources:
            channel_info = discord_bot.get_channel_info(s[2])
            guild_name = None
            if len(s) > 3 and s[1] != 'current':
                guild_name = discord_bot.get_guild_name(s[1])
            source_data = {
                'id': s[0],
                'server_id': s[1],
                'channel_id': s[2],
                'server_name': guild_name or s[3] if len(s) > 3 else None,
                'channel_name': channel_info.get('name') or s[4] if len(s) > 4 else None,
                'mode': s[5] if len(s) > 5 else 'time',
                'value': s[6] if len(s) > 6 else 60,
                'text': s[7] if len(s) > 7 else '',
                'is_active': bool(s[8]) if len(s) > 8 else False,
                'message_count': s[9] if len(s) > 9 else 0,
                'created_at': s[10] if len(s) > 10 else None,
                'last_executed': s[11] if len(s) > 11 else None,
                'random_delay': bool(s[12]) if len(s) > 12 else False,
                'next_execution_time': s[13] if len(s) > 13 else 0
            }
            result.append(source_data)
        return jsonify(result)
    except Exception as e:
        print(f'❌ Cannot get sources: {e}')
        return jsonify([])


@app.route('/api/add_source', methods=['POST'])
def add_source():
    try:
        data = request.json
        channel_info = discord_bot.get_channel_info(data['channel_id'])
        guild_id = channel_info.get('guild_id', 'current')
        guild_name = discord_bot.get_guild_name(guild_id) if guild_id != 'current' else 'Current Server'
        source_id = db.add_source(guild_id,
                                  data['channel_id'],
                                  data['value'],
                                  data['text'],
                                  data.get('random_delay', False),
                                  guild_name,
                                  channel_info.get('name', f'channel-{data["channel_id"]}'))
        return jsonify({'success': True, 'id': source_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/update_source/<int:source_id>', methods=['POST'])
def update_source(source_id):
    try:
        data = request.json
        db.update_source(source_id, **data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/start_source/<int:source_id>', methods=['POST'])
def start_source(source_id):
    try:
        task_manager.start_task(source_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/stop_source/<int:source_id>', methods=['POST'])
def stop_source(source_id):
    try:
        task_manager.stop_task(source_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/delete_source/<int:source_id>', methods=['POST'])
def delete_source(source_id):
    try:
        task_manager.stop_task(source_id)
        db.delete_source(source_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/start_all', methods=['POST'])
def start_all():
    try:
        for source in db.get_all_sources():
            if not source[8]:
                task_manager.start_task(source[0])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/stop_all', methods=['POST'])
def stop_all():
    try:
        task_manager.stop_all_tasks()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/send_message', methods=['POST'])
def send_message():
    try:
        data = request.json
        channel_id = data.get('channel_id')
        message = data.get('message')
        if not channel_id or not message:
            return jsonify({'success': False, 'error': 'Missing channel_id or message'})
        success = discord_bot.send_message(channel_id, message)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/configs', methods=['GET'])
def get_all_configs():
    try:
        configs = db.get_all_configs()
        result = []
        for c in configs:
            result.append({
                'id': c[0],
                'name': c[1],
                'data': json.loads(c[2]),
                'created_at': c[3]
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/configs', methods=['POST'])
def save_config():
    try:
        data = request.json
        name = data.get('name')
        if not name:
            return jsonify({'success': False, 'error': 'Missing name'})

        sources = db.get_all_sources()
        tasks_data = []
        for source in sources:
            task = {
                'id': source[0],
                'server_id': source[1],
                'channel_id': source[2],
                'value': source[6],
                'text': source[7],
                'is_active': bool(source[8]),
                'random_delay': bool(source[12]) if len(source) > 12 else False
            }
            tasks_data.append(task)

        config_data = {
            'tasks': tasks_data,
            'timestamp': datetime.now().isoformat()
        }

        config_id = db.save_config(name, config_data)
        return jsonify({'success': True, 'id': config_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/configs/load/<name>', methods=['POST'])
def load_config(name):
    try:
        config = db.get_config(name)
        if not config:
            return jsonify({'success': False, 'error': 'Config not found'})

        db.delete_source(-1)
        for task in config.get('tasks', []):
            db.add_source(
                task.get('server_id', 'current'),
                task['channel_id'],
                task['value'],
                task['text'],
                task.get('random_delay', False),
                task.get('server_name'),
                task.get('channel_name')
            )
            if task.get('is_active'):
                task_manager.start_task(task['id'])

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/configs/<int:config_id>', methods=['DELETE'])
def delete_config(config_id):
    try:
        db.delete_config(config_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/test_connection')
def test_connection():
    return jsonify({
        'discord_connected': discord_bot.is_connected,
        'user': discord_bot.user_info,
        'user_id': discord_bot.user_id})


if __name__ == '__main__':
    print(f'🚀 Starting...')
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

# GitHub: @islavikdev