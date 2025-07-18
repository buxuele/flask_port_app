import json
import os
import subprocess
import sys
import requests
import sqlite3
from flask import Flask, render_template, jsonify, request, abort, send_from_directory
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime

# cmd /c "c:\Users\Administrator\Work\flask_port_app\port_venv\Scripts\activate.bat"


app = Flask(__name__)
PROJECTS_FILE = 'projects.json'
DATABASE_FILE = 'projects.db'
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- SQLite 数据库操作 ---

def init_database():
    """初始化SQLite数据库"""
    print("正在初始化SQLite数据库...")
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    # 创建projects表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            url TEXT NOT NULL,
            path TEXT DEFAULT '',
            image TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("SQLite数据库初始化完成")

def migrate_json_to_sqlite():
    """将JSON数据迁移到SQLite数据库"""
    if not os.path.exists(PROJECTS_FILE):
        print("没有找到JSON文件，跳过数据迁移")
        return
        
    print("正在从JSON迁移数据到SQLite...")
    
    # 读取JSON数据
    json_projects = get_projects_data_from_json()
    if not json_projects:
        print("JSON文件为空，跳过数据迁移")
        return
    
    # 写入SQLite数据库
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    for project in json_projects:
        cursor.execute('''
            INSERT OR REPLACE INTO projects (id, name, description, url, path, image)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            project.get('id'),
            project.get('name', ''),
            project.get('description', ''),
            project.get('url', ''),
            project.get('path', ''),
            project.get('image', '')
        ))
    
    conn.commit()
    conn.close()
    
    # 备份JSON文件
    backup_file = f"{PROJECTS_FILE}.backup"
    os.rename(PROJECTS_FILE, backup_file)
    print(f"数据迁移完成，JSON文件已备份为: {backup_file}")

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row  # 使结果可以像字典一样访问
    return conn

def get_projects_data_sqlite():
    """从SQLite数据库获取项目数据"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects ORDER BY id')
    rows = cursor.fetchall()
    conn.close()
    
    # 转换为字典列表
    projects = []
    for row in rows:
        projects.append({
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'url': row['url'],
            'path': row['path'],
            'image': row['image'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        })
    
    return projects

def add_project_sqlite(name, description, url, path):
    """向SQLite数据库添加项目"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO projects (name, description, url, path)
        VALUES (?, ?, ?, ?)
    ''', (name, description, url, path))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"SQLite: 添加项目成功，ID: {project_id}")
    return project_id

def update_project_sqlite(project_id, name, description, url, path):
    """更新SQLite数据库中的项目"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE projects 
        SET name = ?, description = ?, url = ?, path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (name, description, url, path, project_id))
    
    conn.commit()
    affected_rows = cursor.rowcount
    conn.close()
    
    print(f"SQLite: 更新项目 {project_id}，影响行数: {affected_rows}")
    return affected_rows > 0

def delete_project_sqlite(project_id):
    """从SQLite数据库删除项目"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    
    conn.commit()
    affected_rows = cursor.rowcount
    conn.close()
    
    print(f"SQLite: 删除项目 {project_id}，影响行数: {affected_rows}")
    return affected_rows > 0

def update_project_image_sqlite(project_id, image_url):
    """更新SQLite数据库中项目的图片"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE projects 
        SET image = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (image_url, project_id))
    
    conn.commit()
    affected_rows = cursor.rowcount
    conn.close()
    
    print(f"SQLite: 更新项目 {project_id} 图片，影响行数: {affected_rows}")
    return affected_rows > 0

def get_project_by_id_sqlite(project_id):
    """从SQLite数据库获取单个项目"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'url': row['url'],
            'path': row['path'],
            'image': row['image'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
    return None

# --- 数据处理（兼容JSON和SQLite）---

def get_projects_data_from_json():
    """从JSON文件获取项目数据（用于迁移）"""
    if not os.path.exists(PROJECTS_FILE):
        return []
    with open(PROJECTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, list):
            data.sort(key=lambda p: p.get('id', 0))
            return data
        return []

def get_projects_data():
    """获取项目数据（优先使用SQLite）"""
    if os.path.exists(DATABASE_FILE):
        print("使用SQLite数据库获取项目数据")
        return get_projects_data_sqlite()
    else:
        print("使用JSON文件获取项目数据")
        return get_projects_data_from_json()

def save_projects_data(projects):
    """保存项目数据（兼容性函数，实际不再使用）"""
    print("警告: save_projects_data 函数已废弃，请使用SQLite操作函数")
    pass

# --- 核心路由 ---

@app.route('/')
def index():
    """
    主页路由。
    【关键修复】：直接将 Python 列表传递给模板，而不是JSON字符串。
    Jinja的 `tojson` 过滤器会处理好剩下的事情。
    """
    projects = get_projects_data()
    return render_template('index.html', projects=projects)

# --- API 路由 ---

@app.route('/api/projects', methods=['POST'])
def add_project():
    """添加一个新项目。"""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('url'):
        abort(400, description="缺少项目名称或URL")

    print(f"正在添加新项目: {data.get('name')}")
    
    # 使用SQLite添加项目
    project_id = add_project_sqlite(
        data['name'],
        data.get('description', ''),
        data['url'],
        data.get('path', '')
    )
    
    # 获取新创建的项目
    new_project = get_project_by_id_sqlite(project_id)
    return jsonify(new_project), 201

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """更新一个已有的项目。"""
    data = request.get_json()
    if not data:
        abort(400, description="缺少更新数据")

    print(f"正在更新项目 {project_id}")
    
    # 使用SQLite更新项目
    success = update_project_sqlite(
        project_id,
        data.get('name', ''),
        data.get('description', ''),
        data.get('url', ''),
        data.get('path', '')
    )
    
    if not success:
        abort(404, description="未找到项目")
    
    # 获取更新后的项目
    updated_project = get_project_by_id_sqlite(project_id)
    return jsonify(updated_project)

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """删除一个项目。"""
    print(f"正在删除项目 {project_id}")
    
    # 使用SQLite删除项目
    success = delete_project_sqlite(project_id)
    if not success:
        abort(404, description="未找到项目")
    
    return jsonify({"success": True, "message": "项目已删除"})

@app.route('/api/open-folder/<int:project_id>')
def open_folder(project_id):
    """在本地文件浏览器中打开项目文件夹。"""
    projects = get_projects_data()
    project = next((p for p in projects if p.get('id') == project_id), None)
    if not project or not project.get('path') or not os.path.isdir(project.get('path')):
        return jsonify({"success": False, "message": "路径无效或不存在"}), 404

    path = project['path']
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "darwin": # macOS
        subprocess.run(["open", path])
    else: # Linux
        subprocess.run(["xdg-open", path])
    return jsonify({"success": True})

@app.route('/api/upload-image/<int:project_id>', methods=['POST'])
def upload_image(project_id):
    """为项目上传图片"""
    print(f"正在为项目 {project_id} 上传图片")
    
    if 'image' not in request.files:
        print("没有找到图片文件")
        return jsonify({"success": False, "message": "没有选择文件"}), 400
    
    file = request.files['image']
    if file.filename == '':
        print("文件名为空")
        return jsonify({"success": False, "message": "没有选择文件"}), 400
    
    if file and allowed_file(file.filename):
        # 生成唯一文件名
        filename = secure_filename(file.filename)
        unique_filename = f"{project_id}_{uuid.uuid4().hex[:8]}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        print(f"保存图片到: {filepath}")
        file.save(filepath)
        
        # 获取项目信息
        project = get_project_by_id_sqlite(project_id)
        if not project:
            print(f"项目 {project_id} 不存在")
            return jsonify({"success": False, "message": "项目不存在"}), 404
            
        # 删除旧图片
        if project.get('image'):
            old_path = project['image'].replace('/static/', 'static/')
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"删除旧图片: {old_path}")
        
        # 使用SQLite更新项目图片
        image_url = f"/static/uploads/{unique_filename}"
        success = update_project_image_sqlite(project_id, image_url)
        
        if success:
            print(f"项目 {project_id} 图片已更新")
            return jsonify({"success": True, "image_url": image_url})
        else:
            return jsonify({"success": False, "message": "更新图片失败"}), 500
    
    print("文件格式不支持")
    return jsonify({"success": False, "message": "文件格式不支持"}), 400

if __name__ == '__main__':
    # 初始化SQLite数据库
    init_database()
    
    # 如果存在JSON文件，进行数据迁移
    if os.path.exists(PROJECTS_FILE):
        migrate_json_to_sqlite()
    
    print("数据库准备完成，启动Flask应用...")
    
    # 临时调试，端口是 9936
    # 开机运行，端口是 9926
    app.run(debug=True, host='0.0.0.0', port=9936)
