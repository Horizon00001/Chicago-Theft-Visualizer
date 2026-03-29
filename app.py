import os
import time
import logging
from flask import Flask, jsonify, render_template, current_app
import psycopg2
from psycopg2 import pool
import psycopg2.extras
from dotenv import load_dotenv
from flask_caching import Cache

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 配置缓存
cache_config = {
    'CACHE_TYPE': os.getenv('CACHE_TYPE', 'SimpleCache'),
    'CACHE_DEFAULT_TIMEOUT': int(os.getenv('CACHE_DEFAULT_TIMEOUT', 300))
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# 数据库连接池配置
try:
    db_pool = pool.SimpleConnectionPool(
        1, 20,  # 最小和最大连接数
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', 5432)
    )
    logger.info("数据库连接池初始化成功")
except Exception as e:
    logger.error(f"数据库连接池初始化失败: {e}")
    db_pool = None

def get_db_conn():
    if db_pool:
        return db_pool.getconn()
    return None

def release_db_conn(conn):
    if db_pool and conn:
        db_pool.putconn(conn)

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"未捕获的异常: {e}", exc_info=True)
    return jsonify({"error": "服务器内部错误", "message": str(e)}), 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/yearly_trend')
@cache.cached()
def yearly_trend():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                EXTRACT(YEAR FROM date) AS year, 
                COUNT(*) AS cnt 
            FROM crimes 
            GROUP BY EXTRACT(YEAR FROM date) 
            ORDER BY year
        """)
        rows = cur.fetchall()
        
        # 计算同比增长 (YoY)
        for i in range(len(rows)):
            if i > 0:
                prev_cnt = rows[i-1]['cnt']
                curr_cnt = rows[i]['cnt']
                yoy = round(((curr_cnt - prev_cnt) / prev_cnt) * 100, 2)
                rows[i]['yoy'] = yoy
            else:
                rows[i]['yoy'] = 0
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/weekly_distribution')
@cache.cached()
def weekly_distribution():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT EXTRACT(DOW FROM date) AS dow, COUNT(*) AS cnt FROM crimes GROUP BY EXTRACT(DOW FROM date) ORDER BY dow")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/hourly_distribution')
@cache.cached()
def hourly_distribution():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT EXTRACT(HOUR FROM date) AS hour, COUNT(*) AS cnt FROM crimes GROUP BY EXTRACT(HOUR FROM date) ORDER BY hour")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/top_crime_types')
@cache.cached()
def top_crime_types():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT primary_type, COUNT(*) AS cnt FROM crimes GROUP BY primary_type ORDER BY cnt DESC LIMIT 10")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/district_crimes')
@cache.cached()
def district_crimes():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT district, COUNT(*) AS cnt FROM crimes WHERE district IS NOT NULL GROUP BY district ORDER BY cnt DESC")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/arrest_rate')
@cache.cached()
def arrest_rate():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT EXTRACT(YEAR FROM date) AS year,
                   COUNT(*) FILTER (WHERE arrest = TRUE) AS arrests,
                   COUNT(*) AS total,
                   ROUND(COUNT(*) FILTER (WHERE arrest = TRUE) * 100.0 / COUNT(*), 2) AS arrest_rate
            FROM crimes
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year
        """)
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/domestic_ratio')
@cache.cached()
def domestic_ratio():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT domestic, COUNT(*) AS cnt FROM crimes GROUP BY domestic")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/domestic_trend')
@cache.cached()
def domestic_trend():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                EXTRACT(YEAR FROM date) AS year,
                COUNT(*) FILTER (WHERE domestic = TRUE) AS domestic_cnt,
                COUNT(*) FILTER (WHERE domestic = FALSE) AS non_domestic_cnt,
                ROUND(COUNT(*) FILTER (WHERE domestic = TRUE) * 100.0 / NULLIF(COUNT(*), 0), 2) AS domestic_rate
            FROM crimes
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year
        """)
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/top_locations')
@cache.cached()
def top_locations():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT location_description, COUNT(*) AS cnt
            FROM crimes
            WHERE location_description IS NOT NULL
            GROUP BY location_description
            ORDER BY cnt DESC
            LIMIT 10
        """)
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/monthly_trend')
@cache.cached()
def monthly_trend():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT EXTRACT(MONTH FROM date) AS month, COUNT(*) AS cnt FROM crimes GROUP BY EXTRACT(MONTH FROM date) ORDER BY month")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/theft_by_district')
@cache.cached()
def theft_by_district():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                district,
                COUNT(*) AS theft_cnt,
                ROUND(AVG(latitude)::numeric, 6) AS latitude,
                ROUND(AVG(longitude)::numeric, 6) AS longitude
            FROM crimes
            WHERE primary_type = 'THEFT'
              AND district IS NOT NULL
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            GROUP BY district
            ORDER BY theft_cnt DESC
        """)
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/crime_type_by_month')
@cache.cached()
def crime_type_by_month():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                primary_type,
                EXTRACT(MONTH FROM date) AS month,
                COUNT(*) AS cnt
            FROM crimes
            WHERE primary_type IS NOT NULL
            GROUP BY primary_type, EXTRACT(MONTH FROM date)
            ORDER BY primary_type, month
        """)
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/weekly')
def weekly_page():
    return render_template('weekly.html')

@app.route('/hourly')
def hourly_page():
    return render_template('hourly.html')

@app.route('/district')
def district_page():
    return render_template('district.html')

@app.route('/arrest_rate_page')
def arrest_rate_page():
    return render_template('arrest_rate.html')

@app.route('/domestic')
def domestic_page():
    return render_template('domestic.html')

@app.route('/locations')
def locations_page():
    return render_template('locations.html')

@app.route('/monthly')
def monthly_page():
    return render_template('monthly.html')

@app.route('/theft_district')
def theft_district_page():
    return render_template('theft_district.html')

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode)
