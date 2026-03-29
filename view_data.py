import os
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv
from tabulate import tabulate

# 加载环境变量
load_dotenv()

def fetch_top_crimes(limit=1000):
    """从数据库中获取前 N 条犯罪记录并打印"""
    conn = None
    try:
        # 连接数据库
        conn = psycopg2.connect(
            dbname=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT', 5432)
        )
        
        # 使用 DictCursor 让结果以字典形式返回，方便处理
        cur = conn.cursor(cursor_factory=extras.RealDictCursor)
        
        # 执行查询
        print(f"正在查询前 {limit} 条记录...")
        query = "SELECT id, case_number, date, primary_type, district, arrest FROM crimes ORDER BY date DESC LIMIT %s"
        cur.execute(query, (limit,))
        
        rows = cur.fetchall()
        
        if not rows:
            print("数据库中没有记录。")
            return

        # 使用 tabulate 格式化输出表格
        # 只取一部分列显示，避免屏幕放不下
        headers = ["ID", "案件编号", "日期", "类型", "警区", "是否逮捕"]
        table_data = [[r['id'], r['case_number'], r['date'], r['primary_type'], r['district'], r['arrest']] for r in rows]
        
        print(tabulate(table_data, headers=headers, tablefmt="grid"))
        print(f"\n查询完成，共展示 {len(rows)} 条记录。")

    except Exception as e:
        print(f"查询失败: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # 如果没有安装 tabulate，脚本会报错，提示用户安装
    try:
        import tabulate
    except ImportError:
        print("提示: 请先运行 'pip install tabulate' 以获得更好的表格显示效果。")
        # 如果没安装，就用普通打印
        def tabulate(data, headers, **kwargs):
            return str(headers) + "\n" + "\n".join([str(row) for row in data])
            
    fetch_top_crimes(1000)
