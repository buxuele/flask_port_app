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
  const separator = path.includes("/") ? "/" : "\\";
  const parts = path.split(separator);
  if (parts.length <= 2) return path;
  const head = parts[0];
  const tail = parts[parts.length - 1];
  return `${head}${separator}...${separator}${tail}`;
}

/**
 * 检测项目在线状态
 * @param {number} projectId - 项目ID
 * @param {string} url - 项目URL
 */
function checkProjectStatus(projectId, url) {
  console.log(`正在检测项目 ${projectId} 的状态: ${url}`);
  const statusElement = document.getElementById(`status-${projectId}`);

  // 使用fetch检测URL是否可访问
  fetch(url, {
    method: "HEAD",
    mode: "no-cors",
    timeout: 5000,
  })
    .then(() => {
      console.log(`项目 ${projectId} 在线`);
      statusElement.className = "status-indicator status-online";
    })
    .catch(() => {
      console.log(`项目 ${projectId} 离线或有问题`);
      statusElement.className = "status-indicator status-offline";
    });
}

/**
 * 复制文本到剪贴板，并向用户提供反馈。
 * @param {string} text - 要复制的文本.
 * @param {HTMLElement} btn - 被点击的按钮元素.
 */
function copyToClipboard(text, btn) {
  console.log(`正在复制文本: ${text}`);
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log("复制成功");
      const originalContent = btn.innerHTML;
      btn.innerHTML = `已复制`;
      btn.classList.add("btn-success");
      btn.classList.remove("btn-outline-secondary");
      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.classList.remove("btn-success");
        btn.classList.add("btn-outline-secondary");
      }, 2000);
    })
    .catch((err) => {
      console.error("复制失败: ", err);
      alert("复制失败！");
    });
}

/**
 * 在不刷新页面的情况下，更新DOM中的卡片信息（用于编辑后）。
 * @param {object} project - 更新后的项目对象.
 */
function updateCardInDOM(project) {
  const card = document.getElementById(`project-card-${project.id}`);
  if (!card) return;

  card.querySelector(".card-title").textContent = project.name;
  card.querySelector(".icon-placeholder").textContent =
    project.name.length > 0 ? project.name[0].toUpperCase() : "?";
  card.querySelector(".card-text").textContent = project.description;

  const pathElement = card.querySelector(".path-text");
  if (pathElement) {
    pathElement.textContent = truncatePath(project.path);
    pathElement.setAttribute("title", project.path);
    // 同时更新复制按钮旁边span的title
    pathElement.parentElement
      .querySelector("span")
      .setAttribute("title", project.path);
  }

  const urlElement = card.querySelector(
    '.info-line span[title="' +
      projectsData.find((p) => p.id === project.id).url +
      '"]'
  );
  if (urlElement) {
    urlElement.textContent = project.url;
    urlElement.setAttribute("title", project.url);
  }

  card.querySelector("a.btn-dark").href = project.url;

  // 更新全局数据
  const index = projectsData.findIndex((p) => p.id == project.id);
  if (index !== -1) {
    projectsData[index] = project;
  }
}

// --- 主逻辑入口 ---

document.addEventListener("DOMContentLoaded", function () {
  // 初始化时截断所有路径显示
  document.querySelectorAll(".path-text").forEach((el) => {
    const fullPath = el.getAttribute("title");
    el.textContent = truncatePath(fullPath);
  });

  // 页面加载后自动检测所有项目状态
  console.log("开始检测所有项目状态...");
  projectsData.forEach((project) => {
    console.log(`检测项目: ${project.name} - ${project.url}`);
    checkProjectStatus(project.id, project.url);
  });

  // --- 快捷键支持 ---
  document.addEventListener("keydown", function (event) {
    // Ctrl+R 刷新页面
    if (event.ctrlKey && event.key === "r") {
      console.log("快捷键: Ctrl+R 刷新页面");
      location.reload();
    }

    // ESC 关闭模态框
    if (event.key === "Escape") {
      console.log("快捷键: ESC 关闭模态框");
      const openModals = document.querySelectorAll(".modal.show");
      openModals.forEach((modal) => {
        const modalInstance = bootstrap.Modal.getInstance(modal);
        if (modalInstance) {
          modalInstance.hide();
        }
      });
    }
  });

  // --- 快捷键提示功能 ---
  // 按住Ctrl键2秒显示快捷键提示
  let ctrlKeyTimer = null;
  let ctrlPressed = false;

  document.addEventListener("keydown", function (event) {
    if (event.key === "Control" && !ctrlPressed) {
      ctrlPressed = true;
      ctrlKeyTimer = setTimeout(() => {
        document.getElementById("shortcutHint").style.display = "block";
        console.log("显示快捷键提示");
      }, 1000);
    }
  });

  document.addEventListener("keyup", function (event) {
    if (event.key === "Control") {
      ctrlPressed = false;
      if (ctrlKeyTimer) {
        clearTimeout(ctrlKeyTimer);
      }
      setTimeout(() => {
        document.getElementById("shortcutHint").style.display = "none";
      }, 3000);
    }
  });

  // --- 批量操作功能 ---
  let batchMode = false;

  // 批量选择按钮
  document
    .getElementById("batchModeBtn")
    .addEventListener("click", function () {
      batchMode = true;
      console.log("进入批量选择模式");

      // 显示所有复选框
      document.querySelectorAll(".batch-checkbox").forEach((checkbox) => {
        checkbox.classList.remove("d-none");
      });

      // 显示批量操作按钮，隐藏批量选择按钮
      document.getElementById("batchActions").classList.remove("d-none");
      document.getElementById("batchModeBtn").classList.add("d-none");
    });

  // 取消批量选择
  document
    .getElementById("cancelBatchBtn")
    .addEventListener("click", function () {
      batchMode = false;
      console.log("退出批量选择模式");

      // 隐藏所有复选框
      document.querySelectorAll(".batch-checkbox").forEach((checkbox) => {
        checkbox.classList.add("d-none");
      });

      // 清除所有选中状态
      document.querySelectorAll(".project-checkbox").forEach((checkbox) => {
        checkbox.checked = false;
      });

      // 隐藏批量操作按钮，显示批量选择按钮
      document.getElementById("batchActions").classList.add("d-none");
      document.getElementById("batchModeBtn").classList.remove("d-none");
    });

  // 批量删除
  document
    .getElementById("batchDeleteBtn")
    .addEventListener("click", function () {
      const selectedProjects = [];
      document
        .querySelectorAll(".project-checkbox:checked")
        .forEach((checkbox) => {
          selectedProjects.push(parseInt(checkbox.dataset.projectId));
        });

      if (selectedProjects.length === 0) {
        alert("请先选择要删除的项目");
        return;
      }

      console.log("批量删除项目:", selectedProjects);

      if (
        confirm(
          `确定要删除选中的 ${selectedProjects.length} 个项目吗？此操作不可撤销。`
        )
      ) {
        // 依次删除选中的项目
        Promise.all(
          selectedProjects.map((projectId) =>
            fetch(`/api/projects/${projectId}`, { method: "DELETE" })
          )
        )
          .then((responses) => {
            const allSuccess = responses.every((response) => response.ok);
            if (allSuccess) {
              console.log("批量删除成功");
              location.reload();
            } else {
              alert("部分项目删除失败，请查看控制台");
            }
          })
          .catch((error) => {
            console.error("批量删除失败:", error);
            alert("批量删除失败: " + error.message);
          });
      }
    });

  // --- 右键菜单功能 ---
  let contextMenu = null;

  // 创建右键菜单
  function createContextMenu() {
    const menu = document.createElement("div");
    menu.className =
      "context-menu position-absolute bg-white border rounded shadow-lg p-2";
    menu.style.zIndex = "9999";
    menu.style.display = "none";
    menu.innerHTML = `
      <div class="context-menu-item px-3 py-2 text-hover-primary cursor-pointer" data-action="edit">
        <i class="bi bi-pencil-fill me-2"></i>编辑项目
      </div>
      <hr class="my-1">
      <div class="context-menu-item px-3 py-2 text-danger cursor-pointer" data-action="delete">
        <i class="bi bi-trash-fill me-2"></i>删除项目
      </div>
    `;
    document.body.appendChild(menu);
    return menu;
  }

  contextMenu = createContextMenu();
  let currentContextProject = null;

  // 右键菜单事件处理
  document.addEventListener("contextmenu", function (event) {
    const card = event.target.closest(".project-card");
    if (card) {
      event.preventDefault();
      const projectId = parseInt(card.id.split("-").pop(), 10);
      currentContextProject = projectsData.find((p) => p.id === projectId);

      console.log("显示右键菜单，项目:", currentContextProject.name);

      // 显示菜单
      contextMenu.style.display = "block";
      contextMenu.style.left = event.pageX + "px";
      contextMenu.style.top = event.pageY + "px";
    }
  });

  // 点击其他地方隐藏右键菜单
  document.addEventListener("click", function () {
    if (contextMenu) {
      contextMenu.style.display = "none";
    }
  });

  // 右键菜单项点击处理
  contextMenu.addEventListener("click", function (event) {
    const action = event.target.closest(".context-menu-item")?.dataset.action;
    if (!action || !currentContextProject) return;

    console.log("右键菜单操作:", action, "项目:", currentContextProject.name);

    switch (action) {
      case "edit":
        const modalElement = document.getElementById("editProjectModal");
        modalElement.querySelector("#editProjectId").value =
          currentContextProject.id;
        modalElement.querySelector("#editProjectName").value =
          currentContextProject.name;
        modalElement.querySelector("#editProjectUrl").value =
          currentContextProject.url;
        modalElement.querySelector("#editProjectDesc").value =
          currentContextProject.description;
        modalElement.querySelector("#editProjectPath").value =
          currentContextProject.path;
        modalElement.querySelector("#editProjectImage").value = "";
        new bootstrap.Modal(modalElement).show();
        break;

      case "delete":
        if (
          confirm(
            `确定要删除项目 "${currentContextProject.name}" 吗？此操作不可撤销。`
          )
        ) {
          fetch(`/api/projects/${currentContextProject.id}`, {
            method: "DELETE",
          }).then((response) => {
            if (response.ok) {
              location.reload();
            } else {
              alert("删除失败");
            }
          });
        }
        break;
    }

    contextMenu.style.display = "none";
  });

  // --- 事件委托核心 ---
  // 将所有点击事件都绑定在父容器上，提高性能和稳定性。
  const projectsContainer = document.querySelector(".row.g-5");
  if (projectsContainer) {
    projectsContainer.addEventListener("click", function (event) {
      const target = event.target;
      const card = target.closest(".project-card");
      if (!card) return;

      const projectId = parseInt(card.id.split("-").pop(), 10);
      const project = projectsData.find((p) => p.id === projectId);
      if (!project) return;

      // 1. 处理删除按钮
      if (target.closest(".delete-btn")) {
        event.preventDefault();
        if (confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销。`)) {
          fetch(`/api/projects/${projectId}`, { method: "DELETE" })
            .then((response) => {
              if (response.ok) {
                location.reload(); // 删除后重载页面，确保数据绝对同步
              } else {
                alert("删除失败，请查看控制台获取更多信息。");
                return response.json().then((err) => console.error(err));
              }
            })
            .catch((err) => console.error("删除请求失败:", err));
        }
      }

      // 2. 处理编辑按钮
      else if (target.closest(".edit-btn")) {
        event.preventDefault();
        const modalElement = document.getElementById("editProjectModal");
        modalElement.querySelector("#editProjectId").value = project.id;
        modalElement.querySelector("#editProjectName").value = project.name;
        modalElement.querySelector("#editProjectUrl").value = project.url;
        modalElement.querySelector("#editProjectDesc").value =
          project.description;
        modalElement.querySelector("#editProjectPath").value = project.path;
        // 清空图片选择
        modalElement.querySelector("#editProjectImage").value = "";
        new bootstrap.Modal(modalElement).show();
      }

      // 3. 处理复制按钮
      else if (target.closest(".copy-btn")) {
        event.preventDefault();
        // 寻找同级的<span>元素来获取要复制的完整内容
        const textElement = target.closest(".info-line").querySelector("span");
        const textToCopy = textElement ? textElement.getAttribute("title") : "";
        if (textToCopy) {
          copyToClipboard(textToCopy, target.closest(".copy-btn"));
        }
      }

      // 4. 处理打开目录按钮
      else if (target.closest(".open-folder-btn")) {
        event.preventDefault();
        fetch(`/api/open-folder/${projectId}`)
          .then((response) => response.json())
          .then((data) => {
            if (!data.success) {
              alert(`打开目录失败: ${data.message}`);
            }
          })
          .catch((err) => console.error("打开目录请求失败:", err));
      }
    });
  }

  // --- 表单提交逻辑 ---

  // 添加项目表单
  const addProjectForm = document.getElementById("addProjectForm");
  if (addProjectForm) {
    addProjectForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      const imageFile = formData.get("image");

      console.log("正在添加新项目...");

      // 先创建项目
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          url: data.url,
          description: data.description,
          path: data.path,
        }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("添加项目失败!");
        })
        .then((newProject) => {
          console.log("项目创建成功，ID:", newProject.id);

          // 如果有图片文件，则上传图片
          if (imageFile && imageFile.size > 0) {
            console.log("正在上传项目图片...");
            const imageFormData = new FormData();
            imageFormData.append("image", imageFile);

            return fetch(`/api/upload-image/${newProject.id}`, {
              method: "POST",
              body: imageFormData,
            })
              .then((res) => res.json())
              .then((imageResult) => {
                if (imageResult.success) {
                  console.log("图片上传成功");
                } else {
                  console.log("图片上传失败:", imageResult.message);
                  alert("图片上传失败: " + imageResult.message);
                }
                return newProject;
              })
              .catch((error) => {
                console.error("图片上传请求失败:", error);
                alert("图片上传失败，请检查网络连接");
                return newProject;
              });
          }
          return newProject;
        })
        .then(() => {
          console.log("项目添加完成，刷新页面");
          location.reload();
        })
        .catch((error) => {
          console.error("添加项目失败:", error);
          alert("添加失败: " + error.message);
        });
    });
  }

  // 编辑项目表单
  const editProjectForm = document.getElementById("editProjectForm");
  if (editProjectForm) {
    editProjectForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      const projectId = data.id;
      const imageFile = formData.get("image");

      console.log(`正在更新项目 ${projectId}`);

      // 先更新项目基本信息
      fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          url: data.url,
          description: data.description,
          path: data.path,
        }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("更新失败!");
        })
        .then((updatedProject) => {
          console.log("项目基本信息更新成功");

          // 如果有图片文件，则上传图片
          if (imageFile && imageFile.size > 0) {
            console.log("正在上传图片...");
            const imageFormData = new FormData();
            imageFormData.append("image", imageFile);

            return fetch(`/api/upload-image/${projectId}`, {
              method: "POST",
              body: imageFormData,
            })
              .then((res) => res.json())
              .then((imageResult) => {
                if (imageResult.success) {
                  console.log("图片上传成功");
                  updatedProject.image = imageResult.image_url;
                } else {
                  console.log("图片上传失败:", imageResult.message);
                  alert("图片上传失败: " + imageResult.message);
                }
                return updatedProject;
              })
              .catch((error) => {
                console.error("图片上传请求失败:", error);
                alert("图片上传失败，请检查网络连接");
                return updatedProject;
              });
          }
          return updatedProject;
        })
        .then((finalProject) => {
          updateCardInDOM(finalProject);
          const modalInstance = bootstrap.Modal.getInstance(
            document.getElementById("editProjectModal")
          );
          if (modalInstance) {
            modalInstance.hide();
          }
          // 刷新页面以显示新图片
          location.reload();
        })
        .catch((error) => {
          console.error("更新失败:", error);
          alert(error.message);
        });
    });
  }
});
