# Chicago Theft Visualizer（芝加哥盗窃警情可视化分析平台）

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-CDN-38B2AC.svg)](https://tailwindcss.com/)
[![D3.js](https://img.shields.io/badge/D3.js-7.x-orange.svg)](https://d3js.org/)

## 项目简介

这是一个基于 Flask + PostgreSQL + D3.js 的城市警情可视化分析平台，围绕芝加哥犯罪数据提供多维度分析能力，重点支持盗窃（THEFT）专题研判。

项目通过年度趋势、周/小时分布、类型排行、地点排行、家暴占比、逮捕率以及警区地图联动等模块，帮助使用者从时间、空间与类别三个维度快速发现异常模式并形成数据结论。

## 功能概览

- **KPI 概览**：展示平均逮捕率、历年案件总数和高频犯罪类型。
- **时间维度分析**：支持年度趋势、周分布、24 小时分布和月度趋势。
- **类型维度分析**：展示犯罪类型 Top10，并支持类型-月份热力交叉分析。
- **空间维度分析**：支持警区案件排行与盗窃专题分区地图联动。
- **家暴专题**：展示 domestic 与 non-domestic 占比和逐年变化。
- **场景研判**：展示高频案发地点 Top10。
- **缓存优化**：所有核心 API 均接入 Flask-Caching，降低数据库压力。

## 技术栈

- **后端**：Python、Flask、Psycopg2、Flask-Caching、python-dotenv
- **数据库**：PostgreSQL
- **前端**：原生 JavaScript（ES Module）、D3.js、Tailwind CSS（CDN）
- **地理数据**：GeoJSON（`static/data/police_districts.geojson`）

## 系统架构

```text
Browser (D3.js + Tailwind)
        │
        ├─ /api/* (Flask JSON API + Cache)
        │
PostgreSQL (crimes 表)
```

- 前端通过 `static/js/api.js` 统一拉取后端数据接口。
- `static/js/main.js` 负责页面交互、模块切换与图表调度。
- `static/js/charts.js` 封装图表渲染（折线图、面积图、环图、热力图、分区地图等）。
- `app.py` 提供 API、数据库连接池和全局异常处理。

## 项目结构

```text
.
├── app.py
├── requirements.txt
├── .env.example
├── README.md
├── CONTRIBUTING.md
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── main.css
    ├── data/
    │   └── police_districts.geojson
    └── js/
        ├── api.js
        ├── charts.js
        └── main.js
```

## 环境准备

- Python 3.8 及以上
- PostgreSQL 13 及以上
- 建议使用虚拟环境隔离依赖

## 快速开始

### 1) 获取代码

```bash
git clone https://github.com/Horizon00001/Chicago-Theft-Visualizer.git
cd Chicago-Theft-Visualizer
```

### 2) 创建虚拟环境

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

### 3) 安装依赖（清华源）

```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```

### 4) 配置环境变量

复制 `.env.example` 为 `.env`，并按本地数据库修改：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
copy .env.example .env
```

示例配置：

```env
DB_NAME=chicago_crime
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
FLASK_DEBUG=True
CACHE_TYPE=SimpleCache
CACHE_DEFAULT_TIMEOUT=300
```

### 5) 初始化数据库

本项目依赖 `crimes` 表。请确保至少包含以下字段：

- `date`（timestamp）
- `primary_type`（text）
- `district`（text 或 int）
- `arrest`（boolean）
- `domestic`（boolean）
- `location_description`（text）
- `latitude`（numeric/double precision）
- `longitude`（numeric/double precision）

可参考以下最小建表示例：

```sql
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
```

推荐索引：

```sql
CREATE INDEX IF NOT EXISTS idx_crimes_date ON crimes(date);
CREATE INDEX IF NOT EXISTS idx_crimes_primary_type ON crimes(primary_type);
CREATE INDEX IF NOT EXISTS idx_crimes_district ON crimes(district);
```

### 6) 启动服务

```bash
python app.py
```

默认访问地址：`http://127.0.0.1:5000`

## API 一览

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/yearly_trend` | GET | 年度案件趋势与同比（YoY） |
| `/api/weekly_distribution` | GET | 一周 7 天案件分布 |
| `/api/hourly_distribution` | GET | 24 小时案件分布 |
| `/api/top_crime_types` | GET | 犯罪类型 Top10 |
| `/api/district_crimes` | GET | 警区案件数排行 |
| `/api/arrest_rate` | GET | 各年份逮捕率 |
| `/api/domestic_ratio` | GET | 家暴/非家暴占比 |
| `/api/domestic_trend` | GET | 家暴趋势（按年） |
| `/api/top_locations` | GET | 高发地点 Top10 |
| `/api/monthly_trend` | GET | 12 个月案件分布 |
| `/api/theft_by_district` | GET | 盗窃专题警区统计与中心点 |
| `/api/crime_type_by_month` | GET | 犯罪类型-月份交叉数据 |

## 关键设计说明

- **连接池**：后端使用 `SimpleConnectionPool(1, 20)` 管理数据库连接。
- **缓存**：主要 API 使用 `@cache.cached()`，默认 300 秒。
- **地图联动**：盗窃专题通过 GeoJSON 分区与警区排行共享 `district` 键实现悬停/点击联动。
- **异常处理**：全局异常处理器返回标准 JSON 错误结构。

## 常见问题

### 1. 页面空白或图表不显示

- 先检查后端是否正常启动。
- 打开浏览器控制台查看接口报错。
- 确认数据库连接参数和 `crimes` 表字段完整。

### 2. 地图不显示

- 检查 `static/data/police_districts.geojson` 文件是否存在。
- 确认接口 `/api/theft_by_district` 返回了可用的 `district` 数据。

### 3. 接口很慢

- 确认 `date`、`primary_type`、`district` 已建立索引。
- 可提高 `CACHE_DEFAULT_TIMEOUT` 或更换缓存后端。

## 开发建议

- 新增分析模块时，建议保持三层结构：`app.py API` → `api.js 数据请求` → `main.js/charts.js 渲染`。
- 修改图表类型时，请同步更新后端聚合逻辑与前端图表调用方式。
- 提交前建议自测核心接口与首页主要图表。

## 免责声明

本项目仅用于学习、课程实践与数据分析演示，不用于实际执法决策。
