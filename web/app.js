const els = {
  accountsList: document.getElementById("accountsList"),
  accountsEmpty: document.getElementById("accountsEmpty"),
  checkboxWrap: document.getElementById("checkboxWrap"),
  postsList: document.getElementById("postsList"),
  postsEmpty: document.getElementById("postsEmpty"),
  logsList: document.getElementById("logsList"),
  addAccountBtn: document.getElementById("addAccountBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  postForm: document.getElementById("postForm"),
  fileInput: document.getElementById("fileInput"),
  captionInput: document.getElementById("captionInput"),
  timeInput: document.getElementById("timeInput"),
  previewMedia: document.getElementById("previewMedia"),
  previewCaption: document.getElementById("previewCaption"),
  toast: document.getElementById("toast"),
};

let state = { profiles: [], posts: [], targets: [], logs: [] };
let selectedImage = null;

function showToast(message, kind = "info") {
  els.toast.textContent = message;
  els.toast.className = `toast ${kind}`;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 3500);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString();
}

function defaultDateTimeLocal() {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  d.setSeconds(0, 0);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function escapeHtml(text) {
  return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function targetProfileName(id) {
  return state.profiles.find(p => p.id === id)?.name || id;
}

function renderAccounts() {
  els.accountsList.innerHTML = "";
  els.checkboxWrap.innerHTML = "";

  if (!state.profiles.length) {
    els.accountsEmpty.classList.remove("hidden");
  } else {
    els.accountsEmpty.classList.add("hidden");
  }

  state.profiles.forEach(profile => {
    const pending = !!profile.pending;
    const card = document.createElement("div");
    card.className = "account-card";
    card.innerHTML = `
      <div>
        <div class="account-name">${escapeHtml(profile.name || profile.id)}</div>
        <div class="account-id">${escapeHtml(profile.id)}</div>
        <div class="account-id">
          <span class="pill ${pending ? "pending" : "done"}">${pending ? "login pending" : "ready"}</span>
          ${pending ? '<span> Finish Instagram login in the opened browser window.</span>' : ""}
        </div>
      </div>
      <div class="account-actions">
        <button class="button ghost" data-action="rename" data-id="${profile.id}" ${pending ? "disabled" : ""}>Rename</button>
        <button class="button ghost danger" data-action="remove" data-id="${profile.id}">Remove</button>
      </div>
    `;
    els.accountsList.appendChild(card);

    if (pending) return;

    const row = document.createElement("label");
    row.className = "checkbox-row";
    row.innerHTML = `
      <input type="checkbox" name="profileBox" value="${profile.id}" />
      <span>${escapeHtml(profile.name || profile.id)}</span>
    `;
    els.checkboxWrap.appendChild(row);
  });

  if (!els.checkboxWrap.children.length) {
    els.checkboxWrap.innerHTML = `<div class="empty-mini">No ready accounts yet.</div>`;
  }
}

function renderPosts() {
  els.postsList.innerHTML = "";
  if (!state.posts.length) {
    els.postsEmpty.classList.remove("hidden");
    return;
  }
  els.postsEmpty.classList.add("hidden");

  state.posts.forEach(post => {
    const targets = state.targets.filter(t => t.postId === post.id);
    const statuses = targets.map(t => {
      const retryBtn = t.status === "failed"
        ? `<button class="button ghost" data-action="retry" data-id="${t.id}">Retry</button>`
        : "";
      const error = t.error ? `<div class="target-error">${escapeHtml(t.error)}</div>` : "";
      return `
        <div class="target-row">
          <div>
            <strong>${escapeHtml(targetProfileName(t.profileId))}</strong>
            <span class="pill ${t.status}">${escapeHtml(t.status)}</span>
            ${error}
          </div>
          <div>${retryBtn}</div>
        </div>
      `;
    }).join("");

    const card = document.createElement("article");
    card.className = "post-card";
    card.innerHTML = `
      <div class="post-media-wrap">
        <img class="post-media" src="${post.imageUrl}" alt="scheduled media" />
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="pill ${post.status}">${escapeHtml(post.status)}</span>
          <span>${fmtTime(post.scheduledAt)}</span>
        </div>
        <pre class="caption">${escapeHtml(post.caption || "")}</pre>
        <div class="post-actions">
          <button class="button" data-action="post-now" data-id="${post.id}">Post now</button>
          <button class="button ghost danger" data-action="delete-post" data-id="${post.id}">Delete</button>
        </div>
        <div class="targets-box">${statuses || "<div class='empty-mini'>No targets</div>"}</div>
      </div>
    `;
    els.postsList.appendChild(card);
  });
}

function renderLogs() {
  els.logsList.innerHTML = "";
  const logs = state.logs || [];
  if (!logs.length) {
    els.logsList.innerHTML = `<div class="empty-mini">No logs yet.</div>`;
    return;
  }

  logs.slice(0, 80).forEach(log => {
    const row = document.createElement("div");
    row.className = `log-row ${log.level}`;
    row.innerHTML = `
      <div class="log-meta">
        <span class="pill ${log.level === "error" ? "failed" : "done"}">${escapeHtml(log.level)}</span>
        <span>${fmtTime(log.ts)}</span>
      </div>
      <div class="log-message">${escapeHtml(log.message)}</div>
    `;
    els.logsList.appendChild(row);
  });
}

function renderPreview() {
  els.previewCaption.textContent = els.captionInput.value || "Nothing yet.";
  if (selectedImage?.url) {
    els.previewMedia.innerHTML = `<img class="preview-img" src="${selectedImage.url}" alt="preview" />`;
  } else {
    els.previewMedia.textContent = "Image preview";
  }
}

async function refreshState() {
  const res = await fetch("/api/state");
  state = await res.json();
  renderAccounts();
  renderPosts();
  renderLogs();
}

async function addAccount() {
  els.addAccountBtn.disabled = true;
  try {
    const res = await fetch("/api/profile/start", { method: "POST" });
    const payload = await res.json();
    if (!res.ok) {
      showToast(payload.error || "Could not open Instagram login window.", "error");
      return;
    }
    await refreshState();
  } finally {
    els.addAccountBtn.disabled = false;
  }
}

async function renameAccount(id) {
  const current = state.profiles.find(p => p.id === id);
  const name = prompt("Account name", current?.name || "");
  if (!name) return;
  await fetch("/api/profile/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name })
  });
  await refreshState();
}

async function removeAccount(id) {
  if (!confirm("Remove this account from the app?")) return;
  await fetch(`/api/profile/${id}`, { method: "DELETE" });
  await refreshState();
}

async function retryTarget(id) {
  await fetch(`/api/target/${id}/retry`, { method: "POST" });
  showToast("Retry queued.", "success");
  await refreshState();
}

async function postNow(postId) {
  showToast("Posting now. Instagram may open and take over for a moment.", "info");
  await fetch(`/api/post/${postId}/post-now`, { method: "POST" });
  setTimeout(refreshState, 1000);
}

async function deletePost(postId) {
  if (!confirm("Delete this scheduled post?")) return;
  await fetch(`/api/post/${postId}/delete`, { method: "POST" });
  await refreshState();
}

async function schedulePost(event) {
  event.preventDefault();

  if (!els.fileInput.files[0]) {
    showToast("Choose an image first.", "error");
    return;
  }

  const selectedProfiles = [...document.querySelectorAll('input[name="profileBox"]:checked')].map(el => el.value);
  if (!selectedProfiles.length) {
    showToast("Choose at least one account.", "error");
    return;
  }

  const fd = new FormData();
  fd.append("file", els.fileInput.files[0]);

  const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
  const upload = await uploadRes.json();

  const when = new Date(els.timeInput.value).getTime();
  if (!Number.isFinite(when)) {
    showToast("Pick a valid time.", "error");
    return;
  }

  const res = await fetch("/api/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caption: els.captionInput.value,
      imagePath: upload.path,
      imageUrl: upload.url,
      scheduledAt: when,
      profileIds: selectedProfiles
    })
  });

  const payload = await res.json();
  if (!res.ok) {
    showToast(payload.error || "Could not schedule post.", "error");
    return;
  }

  showToast("Post scheduled.", "success");
  els.postForm.reset();
  els.timeInput.value = defaultDateTimeLocal();
  selectedImage = null;
  renderPreview();
  await refreshState();
}

els.addAccountBtn.addEventListener("click", addAccount);
els.refreshBtn.addEventListener("click", refreshState);
els.postForm.addEventListener("submit", schedulePost);
els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (!file) {
    selectedImage = null;
  } else {
    selectedImage = { url: URL.createObjectURL(file) };
  }
  renderPreview();
});
els.captionInput.addEventListener("input", renderPreview);

document.body.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "rename") return renameAccount(id);
  if (action === "remove") return removeAccount(id);
  if (action === "retry") return retryTarget(id);
  if (action === "post-now") return postNow(id);
  if (action === "delete-post") return deletePost(id);
});

els.timeInput.value = defaultDateTimeLocal();
renderPreview();
refreshState();
setInterval(refreshState, 10000);
