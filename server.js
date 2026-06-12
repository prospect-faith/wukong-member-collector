import { createServer } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const dataDir = process.env.DATA_DIR || join(__dirname, "data");
const dataFile = join(dataDir, "submissions.jsonl");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

await fs.mkdir(dataDir, { recursive: true });

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

function formatChinaTime(value) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));

  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

async function loadSubmissions() {
  try {
    const content = await fs.readFile(dataFile, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function validateSubmission(payload) {
  const phone = String(payload.phone || "").replace(/\s/g, "");
  const alumniId = String(payload.alumniId || "").trim();

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { error: "请输入有效的 11 位手机号码" };
  }

  if (!/^[0-9A-Za-z_-]{4,32}$/.test(alumniId)) {
    return { error: "请输入 4-32 位校友卡号，可包含数字、字母、下划线或短横线" };
  }

  return { value: { phone, alumniId } };
}

function requireAdmin(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token") || req.headers["x-admin-token"];

  if (token !== ADMIN_TOKEN) {
    send(res, 401, { ok: false, message: "未授权，请在地址后追加正确的 token" });
    return false;
  }

  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildExcelHtml(rows) {
  const body = rows
    .map((row) => {
      return `<tr>
        <td>${row.id}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(row.alumniId)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(row.phone)}</td>
        <td>${formatChinaTime(row.createdAt)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #b7b7b7; padding: 4px 8px; }
    th { background: #d9d9d9; font-weight: 700; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>校友id</th>
        <th>手机号</th>
        <th>时间</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

function buildCsv(rows) {
  const header = ["序号", "校友id", "手机号", "时间"];
  const lines = rows.map((row) =>
    [
      row.id,
      `="${String(row.alumniId).replaceAll('"', '""')}"`,
      `="${String(row.phone).replaceAll('"', '""')}"`,
      formatChinaTime(row.createdAt)
    ].join(",")
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const requested = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, requested);

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, { ok: false, message: "Forbidden" });
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=300"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    send(res, 404, { ok: false, message: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/submissions") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const validation = validateSubmission(payload);

      if (validation.error) {
        send(res, 400, { ok: false, message: validation.error });
        return;
      }

      const existingRows = await loadSubmissions();
      const row = {
        id: existingRows.length ? Math.max(...existingRows.map((item) => item.id || 0)) + 1 : 1,
        alumniId: validation.value.alumniId,
        phone: validation.value.phone,
        createdAt: new Date().toISOString(),
        userAgent: req.headers["user-agent"] || "",
        ip: getClientIp(req)
      };

      await fs.appendFile(dataFile, `${JSON.stringify(row)}\n`, "utf8");
      send(res, 201, { ok: true, id: row.id, time: formatChinaTime(row.createdAt) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/submissions") {
      if (!requireAdmin(req, res)) return;

      const rows = await loadSubmissions();
      send(res, 200, {
        ok: true,
        rows: rows.map((row) => ({
          id: row.id,
          alumniId: row.alumniId,
          phone: row.phone,
          createdAt: formatChinaTime(row.createdAt)
        }))
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/download.xls") {
      if (!requireAdmin(req, res)) return;

      const rows = await loadSubmissions();
      res.writeHead(200, {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="wukong-member-submissions-${Date.now()}.xls"`,
        "Cache-Control": "no-store"
      });
      res.end(buildExcelHtml(rows));
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/download.csv") {
      if (!requireAdmin(req, res)) return;

      const rows = await loadSubmissions();
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wukong-member-submissions-${Date.now()}.csv"`,
        "Cache-Control": "no-store"
      });
      res.end(buildCsv(rows));
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    send(res, 500, { ok: false, message: "服务器错误，请稍后再试" });
  }
});

server.listen(PORT, () => {
  console.log(`Wukong member collector is running at http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin.html?token=${ADMIN_TOKEN}`);
});
