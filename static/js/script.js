/**
 * 文件: static/js/script.js
 * 描述: 重写后的前端脚本，使用事件委托来处理所有卡片交互。
 */

// --- 辅助函数 ---

/**
 * 截断过长的文件路径用于显示。
 * @param {string} path - 完整路径.
 * @param {number} maxLength - 最大长度.
 * @returns {string} - 截断后的路径.
 */
function truncatePath(path, maxLength = 40) {
    if (!path || path.length <= maxLength) return path;
    const separator = path.includes('/') ? '/' : '\\';
    const parts = path.split(separator);
    if (parts.length <= 2) return path;
    const head = parts[0];
    const tail = parts[parts.length - 1];
    return `${head}${separator}...${separator}${tail}`;
}

/**
 * 复制文本到剪贴板，并向用户提供反馈。
 * @param {string} text - 要复制的文本.
 * @param {HTMLElement} btn - 被点击的按钮元素.
 */
function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-check-lg text-success"></i> 已复制`;
        setTimeout(() => {
            btn.innerHTML = originalContent;
        }, 2000);
    }).catch(err => {
        console.error('复制失败: ', err);
        alert('复制失败！');
    });
}

/**
 * 在不刷新页面的情况下，更新DOM中的卡片信息（用于编辑后）。
 * @param {object} project - 更新后的项目对象.
 */
function updateCardInDOM(project) {
    const card = document.getElementById(`project-card-${project.id}`);
    if (!card) return;

    card.querySelector('.card-title').textContent = project.name;
    card.querySelector('.icon-placeholder').textContent = project.name.length > 0 ? project.name[0].toUpperCase() : '?';
    card.querySelector('.card-text').textContent = project.description;
    
    const pathElement = card.querySelector('.path-text');
    if (pathElement) {
        pathElement.textContent = truncatePath(project.path);
        pathElement.setAttribute('title', project.path);
        // 同时更新复制按钮旁边span的title
        pathElement.parentElement.querySelector('span').setAttribute('title', project.path);
    }

    const urlElement = card.querySelector('.info-line span[title="' + projectsData.find(p => p.id === project.id).url + '"]');
    if (urlElement) {
        urlElement.textContent = project.url;
        urlElement.setAttribute('title', project.url);
    }
    
    card.querySelector('a.btn-dark').href = project.url;

    // 更新全局数据
    const index = projectsData.findIndex(p => p.id == project.id);
    if (index !== -1) {
        projectsData[index] = project;
    }
}


// --- 主逻辑入口 ---

document.addEventListener('DOMContentLoaded', function() {

    // 初始化时截断所有路径显示
    document.querySelectorAll('.path-text').forEach(el => {
        const fullPath = el.getAttribute('title');
        el.textContent = truncatePath(fullPath);
    });

    // --- 事件委托核心 ---
    // 将所有点击事件都绑定在父容器上，提高性能和稳定性。
    const projectsContainer = document.querySelector('.row.g-3');
    if (projectsContainer) {
        projectsContainer.addEventListener('click', function(event) {
            const target = event.target;
            const card = target.closest('.project-card');
            if (!card) return;

            const projectId = parseInt(card.id.split('-').pop(), 10);
            const project = projectsData.find(p => p.id === projectId);
            if (!project) return;

            // 1. 处理删除按钮
            if (target.closest('.delete-btn')) {
                event.preventDefault();
                if (confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销。`)) {
                    fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
                        .then(response => {
                            if (response.ok) {
                                location.reload(); // 删除后重载页面，确保数据绝对同步
                            } else {
                                alert('删除失败，请查看控制台获取更多信息。');
                                return response.json().then(err => console.error(err));
                            }
                        })
                        .catch(err => console.error('删除请求失败:', err));
                }
            }

            // 2. 处理编辑按钮
            else if (target.closest('.edit-btn')) {
                event.preventDefault();
                const modalElement = document.getElementById('editProjectModal');
                modalElement.querySelector('#editProjectId').value = project.id;
                modalElement.querySelector('#editProjectName').value = project.name;
                modalElement.querySelector('#editProjectUrl').value = project.url;
                modalElement.querySelector('#editProjectDesc').value = project.description;
                modalElement.querySelector('#editProjectPath').value = project.path;
                new bootstrap.Modal(modalElement).show();
            }

            // 3. 处理复制按钮
            else if (target.closest('.copy-btn')) {
                event.preventDefault();
                // 寻找同级的<span>元素来获取要复制的完整内容
                const textElement = target.closest('.info-line').querySelector('span');
                const textToCopy = textElement ? textElement.getAttribute('title') : '';
                if (textToCopy) {
                    copyToClipboard(textToCopy, target.closest('.copy-btn'));
                }
            }

            // 4. 处理打开目录按钮
            else if (target.closest('.open-folder-btn')) {
                event.preventDefault();
                fetch(`/api/open-folder/${projectId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (!data.success) {
                            alert(`打开目录失败: ${data.message}`);
                        }
                    })
                    .catch(err => console.error('打开目录请求失败:', err));
            }
        });
    }

    // --- 表单提交逻辑 ---

    // 添加项目表单
    const addProjectForm = document.getElementById('addProjectForm');
    if (addProjectForm) {
        addProjectForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());
            fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => {
                if (res.ok) {
                    location.reload();
                } else {
                    alert('添加失败!');
                }
            });
        });
    }

    // 编辑项目表单
    const editProjectForm = document.getElementById('editProjectForm');
    if (editProjectForm) {
        editProjectForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());
            const projectId = data.id;

            fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('更新失败!');
            })
            .then(updatedProject => {
                updateCardInDOM(updatedProject);
                const modalInstance = bootstrap.Modal.getInstance(document.getElementById('editProjectModal'));
                if (modalInstance) {
                    modalInstance.hide();
                }
            })
            .catch(error => alert(error.message));
        });
    }
});
