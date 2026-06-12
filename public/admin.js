const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";
const rowsBody = document.querySelector("#rows");
const totalCount = document.querySelector("#totalCount");
const latestTime = document.querySelector("#latestTime");
const downloadXls = document.querySelector("#downloadXls");
const downloadCsv = document.querySelector("#downloadCsv");

if (token) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

downloadXls.href = "#";
downloadCsv.href = "#";

function appendCell(rowElement, value, colSpan) {
  const cell = document.createElement("td");
  cell.textContent = String(value);
  if (colSpan) {
    cell.colSpan = colSpan;
  }
  rowElement.appendChild(cell);
}

function renderMessage(text) {
  rowsBody.textContent = "";
  const rowElement = document.createElement("tr");
  appendCell(rowElement, text, 4);
  rowsBody.appendChild(rowElement);
}

function renderRows(rows) {
  if (!rows.length) {
    renderMessage("暂无提交数据");
    return;
  }

  rowsBody.textContent = "";

  rows.forEach((row) => {
    const rowElement = document.createElement("tr");
    appendCell(rowElement, row.id);
    appendCell(rowElement, row.alumniId);
    appendCell(rowElement, row.phone);
    appendCell(rowElement, row.createdAt);
    rowsBody.appendChild(rowElement);
  });
}

async function loadRows() {
  try {
    const response = await fetch("/api/admin/submissions", {
      headers: { "x-admin-token": token }
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "无法读取数据");
    }

    totalCount.textContent = result.rows.length;
    latestTime.textContent = result.rows.at(-1)?.createdAt || "暂无";
    renderRows(result.rows);
  } catch (error) {
    renderMessage(error.message);
  }
}

function getFilename(response, fallback) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

async function downloadFile(path, fallbackName) {
  const response = await fetch(path, {
    headers: { "x-admin-token": token }
  });

  if (!response.ok) {
    throw new Error("下载失败，请检查后台 token");
  }

  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = getFilename(response, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

downloadXls.addEventListener("click", async (event) => {
  event.preventDefault();
  await downloadFile("/admin/download.xls", "wukong-member-submissions.xls");
});

downloadCsv.addEventListener("click", async (event) => {
  event.preventDefault();
  await downloadFile("/admin/download.csv", "wukong-member-submissions.csv");
});

loadRows();
