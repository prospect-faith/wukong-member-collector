const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";
const rowsBody = document.querySelector("#rows");
const totalCount = document.querySelector("#totalCount");
const latestTime = document.querySelector("#latestTime");
const downloadXls = document.querySelector("#downloadXls");
const downloadCsv = document.querySelector("#downloadCsv");

downloadXls.href = `/admin/download.xls?token=${encodeURIComponent(token)}`;
downloadCsv.href = `/admin/download.csv?token=${encodeURIComponent(token)}`;

function renderRows(rows) {
  if (!rows.length) {
    rowsBody.innerHTML = '<tr><td colspan="4">暂无提交数据</td></tr>';
    return;
  }

  rowsBody.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${row.id}</td>
        <td>${row.alumniId}</td>
        <td>${row.phone}</td>
        <td>${row.createdAt}</td>
      </tr>`
    )
    .join("");
}

async function loadRows() {
  try {
    const response = await fetch(`/api/admin/submissions?token=${encodeURIComponent(token)}`);
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "无法读取数据");
    }

    totalCount.textContent = result.rows.length;
    latestTime.textContent = result.rows.at(-1)?.createdAt || "暂无";
    renderRows(result.rows);
  } catch (error) {
    rowsBody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
  }
}

loadRows();
