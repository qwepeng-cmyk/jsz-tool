import json
import sys
import os
import sqlite3

# 定位数据库路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'server', 'database.sqlite')

def extract_street(address):
    """从详细地址中提取街道信息"""
    import re
    patterns = [
        r'(.+?街道)',  # XX街道
        r'(.+?地区)',  # XX地区
        r'(.+?乡)',    # XX乡
        r'(.+?镇)',    # XX镇
    ]
    for pattern in patterns:
        match = re.search(pattern, address)
        if match:
            return match.group(1)
    return ""

def find_item_code(title):
    """根据商品标题查找仓库商品代码（优先查数据库，次选内置静态表）"""
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute('SELECT keyword, item_code FROM product_mappings')
            for row in cur.fetchall():
                if row[0] in title:
                    conn.close()
                    return row[1]
            conn.close()
        except Exception:
            pass
    return None

def get_order_data_from_db(order_id):
    """从本地 SQLite 数据库读取订单数据并格式化为 ERP 报文"""
    if not os.path.exists(db_path):
        print(f"致命错误: 数据库文件不存在 {db_path}")
        return None

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        # 尝试匹配 order_id 或 platform_code
        cur.execute('SELECT order_data FROM orders WHERE order_id = ? OR platform_code = ?', (order_id, order_id))
        row = cur.fetchone()
        conn.close()
        
        if not row or not row[0]:
            print(f"错误: 在数据库中找不到订单号 {order_id}")
            return None

        order = json.loads(row[0])
        
        # 解析 SKU 详情
        goods_names_str = order.get('商品名称', '').strip('"')
        goods_nums_str = order.get('商品数量', '').strip('"')
        
        names = goods_names_str.split('" "') if goods_names_str else []
        nums = goods_nums_str.split('" "') if goods_nums_str else []

        details = []
        for name, num in zip(names, nums):
            item_code = find_item_code(name)
            if not item_code:
                print(f"警告: 商品 '{name}' 未在映射列表中找到，将尝试使用原名称直接上传...")
                # 如果没有映射，可以尝试跳过或让 ERP 报错
                continue
            details.append({
                "item_code": item_code,
                "qty": str(num),
                "platform_item_name": name
            })

        if not details:
            print(f"错误: 订单 {order_id} 中没有找到任何匹配的可同步商品")
            return None

        # 准备 ERP 报文
        street = extract_street(order.get('详细地址', ''))
        deal_datetime = order.get('创建时间', '')
        if len(deal_datetime) == 16:  # 补全秒数
            deal_datetime += ":00"

        return {
            "shop_code": "301535",
            "order_type_code": "Sales",
            "deal_datetime": deal_datetime,
            "platform_code": order.get('订单ID'),
            "warehouse_code": "301535",
            "vip_code": str(order.get('联系电话', '')),
            "buyer_memo": order.get('买家备注', '') or "",
            "receiver_name": order.get('收货人', ''),
            "receiver_mobile": str(order.get('联系电话', '')),
            "receiver_province": order.get('省份', ''),
            "receiver_city": order.get('城市', ''),
            "receiver_district": order.get('区县', ''),
            "receiver_area": street,
            "receiver_address": order.get('详细地址', ''),
            "receiver_zip": str(order.get('邮编', '')) or "",
            "express_code": "顺丰标准快递",
            "details": details
        }
    except Exception as e:
        print(f"数据解析过程中发生异常: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 upload_order.py <订单ID>")
        sys.exit(1)

    # 预先删除旧的中间文件，防止旧数据残留产生误导
    temp_json = os.path.join(BASE_DIR, "order_to_upload.json")
    if os.path.exists(temp_json):
        os.remove(temp_json)

    order_id = sys.argv[1]
    print(f"\n🔍 正在从数据库提取并转换订单: {order_id}")
    
    order_data = get_order_data_from_db(order_id)

    if order_data:
        # 保存为 JSON 供 upload_order.js 读取
        with open(temp_json, "w", encoding="utf-8") as f:
            json.dump(order_data, f, ensure_ascii=False, indent=2)
        print(f"✅ ERP 报文生成成功: {temp_json}")
        sys.exit(0)
    else:
        print(f"❌ 订单 {order_id} 处理失败。")
        sys.exit(1)
