# 服务器部署指南

本指南将帮助你把芝加哥盗窃可视化平台部署到纯命令行的 Linux 服务器上。

## 目录

1. [服务器环境准备](#1-服务器环境准备)
2. [安装 PostgreSQL 数据库](#2-安装-postgresql-数据库)
3. [配置 PostgreSQL](#3-配置-postgresql)
4. [创建数据库和用户](#4-创建数据库和用户)
5. [导入犯罪数据](#5-导入犯罪数据)
6. [安装 Python 和依赖](#6-安装-python-和依赖)
7. [部署应用代码](#7-部署应用代码)
8. [配置环境变量](#8-配置环境变量)
9. [测试应用](#9-测试应用)
10. [使用 Gunicorn 运行（生产环境）](#10-使用-gunicorn-运行生产环境)
11. [配置 Nginx 反向代理](#11-配置-nginx-反向代理)
12. [配置系统服务（开机自启）](#12-配置系统服务开机自启)

***

## 1. 服务器环境准备

### 1.1 更新系统包

```bash
# Debian/Ubuntu
sudo apt update
sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 1.2 安装基础工具

```bash
# Debian/Ubuntu
sudo apt install -y curl wget git unzip vim

# CentOS/RHEL
sudo yum install -y curl wget git unzip vim
```

***

## 2. 安装 PostgreSQL 数据库

### 2.1 Debian/Ubuntu 系统

```bash
# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 启动并设置开机启动
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.2 CentOS/RHEL 系统

```bash
# 安装 PostgreSQL
sudo yum install -y postgresql-server postgresql-contrib

# 初始化数据库
sudo postgresql-setup initdb

# 启动并设置开机启动
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.3 验证 PostgreSQL 安装

```bash
# 检查状态
sudo systemctl status postgresql

# 检查版本
psql --version
```

***

## 3. 配置 PostgreSQL

### 3.1 允许远程连接（可选，如果你需要远程访问数据库）

```bash
# 编辑 PostgreSQL 配置
sudo vim /etc/postgresql/*/main/postgresql.conf
# 或 CentOS: sudo vim /var/lib/pgsql/data/postgresql.conf

# 找到 #listen_addresses = 'localhost'，修改为：
listen_addresses = '*'

# 保存退出
```

### 3.2 配置 pg\_hba.conf 允许远程连接

```bash
sudo vim /etc/postgresql/*/main/pg_hba.conf
# 或 CentOS: sudo vim /var/lib/pgsql/data/pg_hba.conf

# 在文件末尾添加：
host    all     all     0.0.0.0/0     md5
host    all     all     ::/0          md5

# 保存退出
```

### 3.3 重启 PostgreSQL

```bash
sudo systemctl restart postgresql
```

***

## 4. 创建数据库和用户

### 4.1 切换到 postgres 用户

```bash
sudo -u postgres psql
```

### 4.2 创建数据库用户（以 chicago\_user 为例）

```sql
-- 创建用户
CREATE USER chicago_user WITH PASSWORD 'Zj123456789';

-- 创建数据库
CREATE DATABASE chicago_crime OWNER chicago_user;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE chicago_crime TO chicago_user;

-- 退出
\q
```

### 4.3 测试连接

```bash
psql -h localhost -U chicago_user -d chicago_crime
# 输入密码后应该能连接成功
# 退出用 \q
```

***

## 5. 导入犯罪数据

### 5.1 创建 crimes 表

```bash
# 连接到数据库
psql -h localhost -U chicago_user -d chicago_crime

# 创建表
CREATE TABLE IF NOT EXISTS crimes (
  id BIGSERIAL PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  primary_type TEXT,
  district TEXT,
  arrest BOOLEAN,
  domestic BOOLEAN,
  location_description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

# 创建索引（重要！提升查询性能）
CREATE INDEX IF NOT EXISTS idx_crimes_date ON crimes(date);
CREATE INDEX IF NOT EXISTS idx_crimes_primary_type ON crimes(primary_type);
CREATE INDEX IF NOT EXISTS idx_crimes_district ON crimes(district);
CREATE INDEX IF NOT EXISTS idx_crimes_domestic ON crimes(domestic);

# 退出
\q
```

### 5.2 导入 CSV 数据（假设你有一个 crimes.csv 文件）

```bash
# 使用 psql 导入
psql -h localhost -U chicago_user -d chicago_crime -c "\COPY crimes(date, primary_type, district, arrest, domestic, location_description, latitude, longitude) FROM '/path/to/your/crimes.csv' WITH (FORMAT csv, HEADER true, NULL '')"

# 如果 CSV 有 ID 列
psql -h localhost -U chicago_user -d chicago_crime -c "\COPY crimes(id, date, primary_type, district, arrest, domestic, location_description, latitude, longitude) FROM '/path/to/your/crimes.csv' WITH (FORMAT csv, HEADER true, NULL '')"
```

### 5.3 验证数据导入

```bash
psql -h localhost -U chicago_user -d chicago_crime -c "SELECT COUNT(*) FROM crimes;"
psql -h localhost -U chicago_user -d chicago_crime -c "SELECT primary_type, COUNT(*) FROM crimes GROUP BY primary_type LIMIT 10;"
```

***

## 6. 安装 Python 和依赖

### 6.1 检查 Python 版本

```bash
python3 --version
# 确保是 3.8 或更高版本
```

### 6.2 安装 Python 和 pip

```bash
# Debian/Ubuntu
sudo apt install -y python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install -y python3 python3-pip
```

### 6.3 创建应用目录

```bash
# 创建目录
sudo mkdir -p /var/www/chicago_visualizer
sudo chown $USER:$USER /var/www/chicago_visualizer

# 进入目录
cd /var/www/chicago_visualizer
```

### 6.4 创建虚拟环境并安装依赖

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖（使用清华源）
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 安装 gunicorn（用于生产环境）
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple gunicorn
```

***

## 7. 部署应用代码

### 7.1 上传代码到服务器

**方式一：使用 Git（推荐）**

```bash
cd /var/www/chicago_visualizer

# 如果你已经有了 Git 仓库
git clone https://github.com/Horizon00001/Chicago-Theft-Visualizer.git .

# 或者你的私有仓库
git clone your_repository_url .
```

**方式二：使用 SCP 从本地上传**

在本地 Windows 终端执行：

```bash
# 打包项目（本地）
cd f:\数据库应用实践
tar -czvf chicago_visualizer.tar.gz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' .

# 上传到服务器（本地）
scp chicago_visualizer.tar.gz user@your_server_ip:/var/www/chicago_visualizer/

# 在服务器解压
cd /var/www/chicago_visualizer
tar -xzvf chicago_visualizer.tar.gz
rm chicago_visualizer.tar.gz
```

**方式三：使用 rsync**

```bash
# 本地执行
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='venv' f:/数据库应用实践/ user@your_server_ip:/var/www/chicago_visualizer/
```

### 7.2 设置目录权限

```bash
cd /var/www/chicago_visualizer

# 确保静态文件和模板目录权限正确
chmod -R 755 static/
chmod -R 755 templates/

# 虚拟环境权限
chmod -R 755 venv/
```

***

## 8. 配置环境变量

### 8.1 创建 .env 文件

```bash
cd /var/www/chicago_visualizer
cp .env.example .env
vim .env
```

### 8.2 修改 .env 内容

```env
# 数据库配置（根据你实际的数据库信息修改）
DB_NAME=chicago_crime
DB_USER=chicago_user
DB_PASSWORD=YourStrongPassword123
DB_HOST=localhost
DB_PORT=5432

# Flask 配置
FLASK_DEBUG=False

# 缓存配置
CACHE_TYPE=SimpleCache
CACHE_DEFAULT_TIMEOUT=300
```

### 8.3 如果使用远程数据库

如果你的 PostgreSQL 在另一台服务器上：

```env
DB_HOST=你的数据库服务器IP
DB_PORT=5432
```

记得在数据库服务器的 pg\_hba.conf 中添加允许连接的规则。

***

## 9. 测试应用

### 9.1 激活虚拟环境

```bash
cd /var/www/chicago_visualizer
source venv/bin/activate
```

### 9.2 测试运行

```bash
# 设置环境变量（或者使用 .env 文件）
export FLASK_APP=app.py
export FLASK_DEBUG=False

# 运行应用
python app.py
```

### 9.3 验证服务

在浏览器中访问：`http://your_server_ip:5000`

你应该能看到应用首页。如果数据库连接成功，会显示图表数据。

### 9.4 测试 API 接口

```bash
# 测试年度趋势接口
curl http://localhost:5000/api/yearly_trend

# 测试盗窃专题接口
curl http://localhost:5000/api/theft_by_district
```

如果返回 JSON 数据，说明一切正常。

按 `Ctrl+C` 停止测试。

***

## 10. 使用 Gunicorn 运行（生产环境）

### 10.1 安装 Gunicorn

```bash
cd /var/www/chicago_visualizer
source venv/bin/activate
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple gunicorn
```

### 10.2 测试 Gunicorn

```bash
# 启动 Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# 参数说明：
# -w 4: 4个工作进程
# -b 0.0.0.0:5000: 绑定到所有网卡的 5000 端口
# app:app: app.py 中的 app 对象

# 停止：Ctrl+C
```

### 10.3 创建 Gunicorn 配置文件（可选）

```bash
vim /var/www/chicago_visualizer/gunicorn_config.py
```

```python
# gunicorn_config.py
import multiprocessing

bind = "0.0.0.0:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
timeout = 120
accesslog = "/var/log/chicago_visualizer/access.log"
errorlog = "/var/log/chicago_visualizer/error.log"
loglevel = "info"
```

### 10.4 创建日志目录

```bash
sudo mkdir -p /var/log/chicago_visualizer
sudo chown $USER:$USER /var/log/chicago_visualizer
```

### 10.5 使用配置文件启动

```bash
gunicorn -c gunicorn_config.py app:app
```

***

## 11. 配置 Nginx 反向代理

### 11.1 安装 Nginx

```bash
# Debian/Ubuntu
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

### 11.2 启动 Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 11.3 配置 Nginx

```bash
sudo vim /etc/nginx/sites-available/chicago_visualizer
```

```nginx
server {
    listen 80;
    server_name your_domain.com;  # 或者你的服务器 IP

    # 访问日志
    access_log /var/log/chicago_visualizer/nginx_access.log;
    error_log /var/log/chicago_visualizer/nginx_error.log;

    # Gunicorn 代理
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 静态文件（可选，因为 Flask 会自动处理）
    location /static/ {
        alias /var/www/chicago_visualizer/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 11.4 启用站点配置

```bash
# Debian/Ubuntu
sudo ln -s /etc/nginx/sites-available/chicago_visualizer /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # 删除默认配置

# CentOS/RHEL（配置文件在 /etc/nginx/conf.d/）
sudo cp /etc/nginx/sites-available/chicago_visualizer /etc/nginx/conf.d/
```

### 11.5 测试并重启 Nginx

```bash
# 测试配置
sudo nginx -t

# 重启
sudo systemctl restart nginx
```

### 11.6 配置防火墙（如果启用）

```bash
# 开放 80 端口
sudo ufw allow 80
sudo ufw allow 443  # 如果使用 HTTPS

# 或者 CentOS
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 11.7 访问应用

现在可以直接访问：`http://your_server_ip` 或 `http://your_domain.com`

不需要再输入端口号 5000。

***

## 12. 配置系统服务（开机自启）

### 12.1 创建 systemd 服务文件

```bash
sudo vim /etc/systemd/system/chicago_visualizer.service
```

```ini
[Unit]
Description=Chicago Crime Visualizer
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/chicago_visualizer
Environment="PATH=/var/www/chicago_visualizer/venv/bin"
EnvironmentFile=/var/www/chicago_visualizer/.env
ExecStart=/var/www/chicago_visualizer/venv/bin/gunicorn -c gunicorn_config.py app:app
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 12.2 设置目录权限

```bash
# 创建 www-data 用户（如果不存在）
sudo useradd -r -s /bin/false www-data

# 修改目录所有者
sudo chown -R www-data:www-data /var/www/chicago_visualizer
sudo chown -R www-data:www-data /var/log/chicago_visualizer
```

### 12.3 启动服务

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start chicago_visualizer

# 设置开机启动
sudo systemctl enable chicago_visualizer

# 检查服务状态
sudo systemctl status chicago_visualizer
```

### 12.4 管理服务命令

```bash
# 启动
sudo systemctl start chicago_visualizer

# 停止
sudo systemctl stop chicago_visualizer

# 重启
sudo systemctl restart chicago_visualizer

# 查看状态
sudo systemctl status chicago_visualizer

# 查看日志
sudo journalctl -u chicago_visualizer -f
```

***

## 常见问题排查

### 1. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 检查端口是否监听
sudo netstat -tlnp | grep 5432

# 测试连接
psql -h localhost -U chicago_user -d chicago_crime
```

### 2. 防火墙阻止访问

```bash
# 检查防火墙状态
sudo ufw status

# 开放端口
sudo ufw allow 5000  # Flask 直接访问
sudo ufw allow 80    # Nginx 访问
```

### 3. 权限问题

```bash
# 检查目录权限
ls -la /var/www/chicago_visualizer

# 修复权限
sudo chown -R www-data:www-data /var/www/chicago_visualizer
sudo chmod -R 755 /var/www/chicago_visualizer
```

### 4. 查看应用日志

```bash
# Gunicorn 错误日志
cat /var/log/chicago_visualizer/error.log

# Nginx 错误日志
cat /var/log/chicago_visualizer/nginx_error.log

# systemd 日志
sudo journalctl -u chicago_visualizer -n 50
```

### 5. 重新部署更新

```bash
cd /var/www/chicago_visualizer

# 停止服务
sudo systemctl stop chicago_visualizer

# 拉取最新代码
git pull

# 或上传新代码后解压

# 重启服务
sudo systemctl restart chicago_visualizer
```

***

## HTTPS 配置（可选但强烈推荐）

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your_domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 修改 Nginx 配置

Certbot 会自动修改 Nginx 配置添加 HTTPS 支持。

***

## 性能优化建议

### 1. 数据库优化

```sql
-- 定期分析表
ANALYZE crimes;

-- 定期清理
VACUUM ANALYZE crimes;

-- 如果数据量大，可以考虑分区表
```

### 2. 调整 Gunicorn 工作进程数

```python
# gunicorn_config.py
workers = multiprocessing.cpu_count() * 2 + 1
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
```

### 3. 使用 Redis 缓存（可选）

```bash
# 安装 Redis
sudo apt install -y redis-server

# 修改 .env
CACHE_TYPE=RedisCache
CACHE_REDIS_HOST=localhost
CACHE_REDIS_PORT=6379
```

***

## 安全建议

1. **修改数据库密码**：使用强密码，不要使用示例中的密码
2. **配置防火墙**：只开放必要的端口（80, 443）
3. **使用 HTTPS**：生产环境务必使用 HTTPS
4. **定期更新**：保持系统和依赖更新到最新版本
5. **监控日志**：定期检查日志文件，及时发现异常

***

## 总结

部署完成后的架构：

```
用户浏览器
    ↓
Nginx (端口 80/443)
    ↓
Gunicorn (端口 5000，本地)
    ↓
Flask 应用
    ↓
PostgreSQL (端口 5432)
```

通过这个配置，你可以：

- 用域名或 IP 直接访问（不需要端口号）
- 自动处理静态文件
- 支持高并发
- 服务开机自启
- 方便的管理和监控

