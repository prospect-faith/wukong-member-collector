# 悟空租车会员升级数据收集页

一个无外部依赖的 Node.js 小应用，包含：

- 微信端可分享的移动端填写页：手机号、校友卡号
- 本地 JSONL 数据存储：`data/submissions.jsonl`
- 管理页预览数据
- 下载 Excel 可打开的 `.xls` 文件，字段为：序号、校友id、手机号、时间
- 备用 CSV 下载

## 本地运行

```bash
cd wukong-member-collector
ADMIN_TOKEN=your-secret-token PORT=3000 npm start
```

用户填写页：

```text
http://localhost:3000/
```

后台下载页：

```text
http://localhost:3000/admin.html?token=your-secret-token
```

## 部署和微信分享

把这个应用部署到有公网 HTTPS 域名的服务器后，将首页链接发到微信即可收集数据。

生产环境建议：

- 必须设置 `ADMIN_TOKEN`，不要使用默认值 `change-me`
- 如果部署平台提供持久化磁盘，把 `DATA_DIR` 设置为该磁盘目录
- 使用 HTTPS 域名，微信内打开体验更稳定
- 定期备份 `data/submissions.jsonl`

## 环境变量

| 名称 | 说明 | 示例 |
| --- | --- | --- |
| `PORT` | 服务监听端口，云平台通常会自动注入 | `3000` |
| `ADMIN_TOKEN` | 后台访问密码 | `a-long-random-secret` |
| `DATA_DIR` | 数据保存目录，生产环境建议指向持久化磁盘 | `/var/data` |

## 数据字段

下载的表格列顺序：

| 序号 | 校友id | 手机号 | 时间 |
| --- | --- | --- | --- |
| 1 | 00073890 | 17600660368 | 2026-06-12 14:30:00 |
