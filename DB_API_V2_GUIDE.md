# 📘 虚拟工作空间数据库网关 (DB-Bridge V2) 使用指南

本 API 提供了一个基于 HTTPS 的“虚拟工作空间”数据库访问层。它允许远程服务像操作独立的 MySQL 实例一样进行开发，而无需关心后端的多租户隔离逻辑。

---

## 1. 基础信息

*   **API 根地址**: `https://db-api.301098.xyz/query`
*   **通信协议**: HTTPS (TLS 1.3)
*   **请求方法**: `POST`
*   **数据格式**: `application/json`

---

## 2. 身份认证 (必读)

为了极致安全性，本 API 采用“双重门禁”机制：

### 1) 第一层：边缘网关认证 (Cloudflare Access)
所有请求必须携带 Cloudflare Service Token。如果缺失，请求将在到达服务器前被拦截并返回 `302` 或 `403`。
*   **Header**: `CF-Access-Client-Id`
*   **Header**: `CF-Access-Client-Secret`

### 2) 第二层：业务逻辑认证 (API Key)
在请求的 JSON 体中必须包含分配给您的租户 Key。
*   **Payload 字段**: `"apiKey"`

---

## 3. 虚拟工作空间特性 (Virtual Workspace)

本网关实现了 **SQL 透明虚拟化**，您拥有一个隔离的“命名空间”。

*   **自动前缀**：您执行 `CREATE DATABASE mydb`，后端实际存储为 `tenantprefix_mydb`。
*   **库级隔离**：您只能看到并操作属于您前缀下的数据库。
*   **透明体验**：`SHOW DATABASES` 会自动过滤并抹除前缀，让您感觉是在操作一个全新的数据库实例。

---

## 4. 接口规范

### 请求示例
```json
{
  "apiKey": "您的业务API_KEY",
  "sql": "CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, name VARCHAR(100))",
  "params": []
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `apiKey` | String | 是 | 租户唯一的业务密钥。 |
| `sql` | String | 是 | 标准 SQL 语句（支持 DDL, DML, DQL）。库名无需加前缀。 |
| `params` | Array | 否 | 用于参数化查询的参数数组，防止 SQL 注入。 |

### 响应示例
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Admin" }
  ]
}
```

---

## 5. 安全准则
1.  **参数化查询**：严禁在 `sql` 字符串中直接拼接变量，请务必使用 `?` 占位符配合 `params` 数组。
2.  **权限限制**：您无法访问 `mysql`、`information_schema` 等系统表，也无法执行 `GRANT` 等管理类操作。

---

## 6. 管理员手册：如何管理租户 (Tenant Management)

### A. 添加新租户 (Add Tenant)
1.  **数据库侧**：
    为新租户确定一个前缀（例如 `projectb_`），在 MariaDB 中创建受限用户：
    ```sql
    GRANT ALL PRIVILEGES ON `projectb\_%`.* TO 'foreclosure'@'%';
    -- 注：所有租户共用同一个受限 DB 用户 'foreclosure'，隔离通过前缀实现
    ```
2.  **网关侧**：
    编辑 `/root/apps/db-bridge/src/index.ts`，在 `TENANTS` 常量中添加映射：
    ```typescript
    const TENANTS = {
      "new-secret-api-key": { prefix: "projectb_", defaultDb: "projectb_data" }
    };
    ```
3.  **重启服务**：`sudo systemctl restart db-bridge`。

### B. 删除租户 (Remove Tenant)
1.  从代码中的 `TENANTS` 列表移除对应的 API Key。
2.  手动清理该租户的所有物理库：`DROP DATABASE projectb_db1; ...`

### C. 未来的管理建议
目前的租户映射硬编码在代码中。如果租户数量超过 10 个，建议将 `TENANTS` 映射存储在 MariaDB 的 `management.tenants` 表中，网关通过缓存读取。
