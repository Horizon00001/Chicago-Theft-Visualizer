# Chicago Theft Visualizer (芝加哥盗窃警情可视化分析平台)

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0+-38B2AC.svg)](https://tailwindcss.com/)
[![D3.js](https://img.shields.io/badge/D3.js-7.0+-orange.svg)](https://d3js.org/)

## 📖 项目简介 | Introduction
本项目是一个面向城市治安数据的可视化分析平台，专门针对芝加哥（Chicago）的盗窃案件信息进行整理、展示与交互分析。通过地图联动、区域排行和动态数据图表，帮助用户直观识别警情分布特征，提升数据分析效率。

This is a visualization analysis platform for urban crime data, focusing on theft cases in Chicago. It features interactive maps, district rankings, and dynamic data charts to help users identify crime patterns and spatial distribution.

## ✨ 核心功能 | Key Features
- **📊 关键指标监控 (KPIs)**: 实时展示平均逮捕率、历年犯罪总数及高频犯罪类型。
- **📈 趋势分析**: 通过 D3.js 渲染的年度趋势图和周度分布图，识别警情随时间变化的规律。
- **🗺️ 地图联动**: 基于 GeoJSON 的分区填色地图，支持悬停高亮与警区排行实时联动。
- **🏆 警区排行**: 自动统计并展示各警区的案件数量排行。
- **📱 响应式设计**: 采用 Tailwind CSS 构建，适配不同尺寸的屏幕。

## 🛠️ 技术栈 | Tech Stack
- **Backend**: Python, Flask, Psycopg2
- **Database**: PostgreSQL
- **Frontend**: D3.js, Tailwind CSS, JavaScript (ES6+)
- **Data**: GeoJSON (Police Districts), CSV (Chicago Crime Dataset)

## 🚀 快速开始 | Quick Start

### 1. 克隆项目 | Clone the Repository
```bash
git clone https://github.com/Horizon00001/Chicago-Theft-Visualizer.git
cd Chicago-Theft-Visualizer
```

### 2. 环境配置 | Environment Setup
创建虚拟环境并安装依赖：
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 数据库初始化 | Database Setup
1. 安装 PostgreSQL 并创建一个数据库（如 `chicago_crime`）。
2. 使用提供的 `schema.sql` 初始化表结构：
   ```bash
   psql -U your_username -d chicago_crime -f schema.sql
   ```
3. (可选) 导入 `sample_data.csv` 进行测试：
   ```bash
   psql -U your_username -d chicago_crime -c "\copy crimes FROM 'sample_data.csv' WITH (FORMAT csv, HEADER true);"
   ```

### 4. 环境变量 | Configuration
复制 `.env.example` 为 `.env` 并填入你的数据库连接信息：
```bash
cp .env.example .env
```

### 4. 运行项目 | Run the Application
```bash
python app.py
```
访问 `http://localhost:5000` 即可查看平台。

## 📁 目录结构 | Directory Structure
```text
.
├── static/
│   ├── css/          # 样式文件 (Tailwind & Custom)
│   ├── data/         # 空间数据 (GeoJSON, Shapefile)
│   └── js/           # 前端逻辑 (D3.js charts, API calls)
├── templates/        # Flask HTML 模板
├── app.py            # Flask 后端服务
├── .env.example      # 环境变量模板
└── requirements.txt  # Python 依赖
```

## 👤 作者 | Author
- **朱虹霖 (SoftEng Student)**
- GitHub: [@Horizon00001](https://github.com/Horizon00001)

---
*本项目仅用于学习与数据分析实践。*
