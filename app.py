import os
import time
import logging
from flask import Flask, jsonify, render_template, current_app, request
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
cache_type = os.getenv('CACHE_TYPE', 'SimpleCache')
cache_config = {
    'CACHE_TYPE': cache_type,
    'CACHE_DEFAULT_TIMEOUT': int(os.getenv('CACHE_DEFAULT_TIMEOUT', 300))
}

if cache_type == 'RedisCache':
    redis_url = os.getenv('CACHE_REDIS_URL')
    if redis_url:
        cache_config['CACHE_REDIS_URL'] = redis_url
    else:
        redis_host = os.getenv('CACHE_REDIS_HOST', '127.0.0.1')
        redis_port = int(os.getenv('CACHE_REDIS_PORT', 6379))
        redis_db = int(os.getenv('CACHE_REDIS_DB', 0))
        redis_password = os.getenv('CACHE_REDIS_PASSWORD')
        if redis_password:
            cache_config['CACHE_REDIS_PASSWORD'] = redis_password
        cache_config['CACHE_REDIS_HOST'] = redis_host
        cache_config['CACHE_REDIS_PORT'] = redis_port
        cache_config['CACHE_REDIS_DB'] = redis_db
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
        cur.execute("""
            SELECT EXTRACT(DOW FROM date) AS dow, 
                   COUNT(*) AS cnt,
                   COUNT(*) FILTER (WHERE arrest = TRUE) AS arrest_cnt
            FROM crimes 
            GROUP BY EXTRACT(DOW FROM date) 
            ORDER BY dow
        """)
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
@cache.cached(query_string=True)
def district_crimes():
    conn = get_db_conn()
    try:
        primary_type = (request.args.get('primary_type') or 'ALL').strip().upper()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        params = []
        where_sql = "WHERE district IS NOT NULL"
        if primary_type != 'ALL':
            where_sql += " AND primary_type = %s"
            params.append(primary_type)
        cur.execute(f"SELECT district, COUNT(*) AS cnt FROM crimes {where_sql} GROUP BY district ORDER BY cnt DESC", params)
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
@cache.cached(query_string=True)
def top_locations():
    conn = get_db_conn()
    try:
        primary_type = (request.args.get('primary_type') or 'ALL').strip().upper()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        params = []
        filter_sql = "WHERE location_description IS NOT NULL"
        if primary_type != 'ALL':
            filter_sql += " AND primary_type = %s"
            params.append(primary_type)
        cur.execute(f"""
            WITH base AS (
                SELECT UPPER(location_description) AS loc
                FROM crimes
                {filter_sql}
            ),
            normalized AS (
                SELECT
                    CASE
                        WHEN LEFT(loc, 7) = 'RESIDEN' OR POSITION('DRIVEWAY - RESIDENTIAL' IN loc) > 0 THEN 'RESIDENCE'
                        WHEN POSITION('APARTMENT' IN loc) > 0 THEN 'APARTMENT'
                        WHEN POSITION('PARKING' IN loc) > 0 THEN 'PARKING'
                        WHEN LEFT(loc, 6) = 'SCHOOL' THEN 'SCHOOL'
                        WHEN POSITION('STORE' IN loc) > 0 OR POSITION('RETAIL' IN loc) > 0 OR LEFT(loc, 10) = 'COMMERCIAL' OR POSITION('BANK' IN loc) > 0 OR LEFT(loc, 17) = 'CURRENCY EXCHANGE' THEN 'COMMERCIAL/RETAIL'
                        WHEN POSITION('RESTAURANT' IN loc) > 0 OR POSITION('BAR' IN loc) > 0 OR POSITION('TAVERN' IN loc) > 0 THEN 'RESTAURANT/BAR'
                        WHEN LEFT(loc, 3) = 'CTA' OR POSITION('RAILROAD' IN loc) > 0 OR LEFT(loc, 7) = 'AIRPORT' THEN 'TRANSIT'
                        WHEN LEFT(loc, 5) = 'OTHER' THEN 'OTHER'
                        WHEN POSITION('VEHICLE' IN loc) > 0 THEN 'VEHICLE'
                        WHEN POSITION('HOSPITAL' IN loc) > 0 OR POSITION('NURSING' IN loc) > 0 OR POSITION('MEDICAL' IN loc) > 0 THEN 'MEDICAL'
                        WHEN POSITION('GAS STATION' IN loc) > 0 THEN 'GAS STATION'
                        WHEN LEFT(loc, 3) = 'CHA' THEN 'CHA PROPERTY'
                        ELSE loc
                    END AS location_description
                FROM base
            )
            SELECT location_description, COUNT(*) AS cnt
            FROM normalized
            GROUP BY location_description
            ORDER BY cnt DESC
            LIMIT 10
        """, tuple(params))
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
@cache.cached(query_string=True)
def theft_by_district():
    conn = get_db_conn()
    try:
        primary_type = (request.args.get('primary_type') or 'THEFT').strip().upper()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                district,
                COUNT(*) AS theft_cnt,
                ROUND(AVG(latitude)::numeric, 6) AS latitude,
                ROUND(AVG(longitude)::numeric, 6) AS longitude
            FROM crimes
            WHERE primary_type = %s
              AND district IS NOT NULL
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            GROUP BY district
            ORDER BY theft_cnt DESC
        """, (primary_type,))
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        if cur: cur.close()
        release_db_conn(conn)

@app.route('/api/crime_types')
@cache.cached()
def crime_types():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT primary_type, COUNT(*) AS cnt
            FROM crimes
            WHERE primary_type IS NOT NULL
            GROUP BY primary_type
            ORDER BY cnt DESC
            LIMIT 25
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

@app.route('/api/crime_structure_change')
@cache.cached()
def crime_structure_change():
    conn = get_db_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT primary_type,
                SUM(CASE WHEN EXTRACT(YEAR FROM date) BETWEEN 2001 AND 2005 THEN 1 ELSE 0 END) AS count_first_5,
                SUM(CASE WHEN EXTRACT(YEAR FROM date) BETWEEN 2019 AND 2023 THEN 1 ELSE 0 END) AS count_last_5
            FROM crimes
            WHERE EXTRACT(YEAR FROM date) BETWEEN 2001 AND 2005 
               OR EXTRACT(YEAR FROM date) BETWEEN 2019 AND 2023
            GROUP BY primary_type
            ORDER BY (SUM(CASE WHEN EXTRACT(YEAR FROM date) BETWEEN 2001 AND 2005 THEN 1 ELSE 0 END) + 
                      SUM(CASE WHEN EXTRACT(YEAR FROM date) BETWEEN 2019 AND 2023 THEN 1 ELSE 0 END)) DESC
            LIMIT 15;
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
