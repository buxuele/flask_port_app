import json
import os
import subprocess
import sys
import requests
from flask import Flask, render_template, jsonify, request, abort

app = Flask(__name__)
PROJECTS_FILE = 'projects.json'

# --- 数据处理 ---

def get_projects_data():
    """安全地读取和解析 projects.json 文件。"""
    if not os.path.exists(PROJECTS_FILE):
        return []
    try:
        with open(PROJECTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 确保返回的是一个列表，并按id排序
            if isinstance(data, list):
                data.sort(key=lambda p: p.get('id', 0))
                return data
            return []
    except (json.JSONDecodeError, IOError):
        # 如果文件为空、损坏或无法读取，返回空列表
        return []

def save_projects_data(projects):
    """将项目列表写回 projects.json 文件。"""
    with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)

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

    projects = get_projects_data()
    new_project = {
        'id': max([p.get('id', 0) for p in projects] + [0]) + 1,
        'name': data['name'],
        'description': data.get('description', ''),
        'url': data['url'],
        'path': data.get('path', '')
    }
    projects.append(new_project)
    save_projects_data(projects)
    return jsonify(new_project), 201

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """更新一个已有的项目。"""
    projects = get_projects_data()
    project = next((p for p in projects if p.get('id') == project_id), None)
    if not project:
        abort(404, description="未找到项目")

    data = request.get_json()
    if not data:
        abort(400, description="缺少更新数据")

    # 更新字段
    project['name'] = data.get('name', project['name'])
    project['description'] = data.get('description', project['description'])
    project['url'] = data.get('url', project['url'])
    project['path'] = data.get('path', project['path'])

    save_projects_data(projects)
    return jsonify(project)

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """删除一个项目。"""
    projects = get_projects_data()
    if not any(p for p in projects if p.get('id') == project_id):
        abort(404, description="未找到项目")

    projects_after_delete = [p for p in projects if p.get('id') != project_id]
    save_projects_data(projects_after_delete)
    return jsonify({"success": True, "message": "项目已删除"})

@app.route('/api/open-folder/<int:project_id>')
def open_folder(project_id):
    """在本地文件浏览器中打开项目文件夹。"""
    projects = get_projects_data()
    project = next((p for p in projects if p.get('id') == project_id), None)
    if not project or not project.get('path') or not os.path.isdir(project.get('path')):
        return jsonify({"success": False, "message": "路径无效或不存在"}), 404

    path = project['path']
    try:
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin": # macOS
            subprocess.run(["open", path])
        else: # Linux
            subprocess.run(["xdg-open", path])
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    # 在生产环境中，debug模式应为False
    app.run(debug=True, host='0.0.0.0', port=9926)
