import requests
import pandas as pd
from datetime import datetime
import sqlite3
import os
import json
import argparse
import sys

# 登录信息
BASE_URL = "https://666.dianzhushoukeji.com"
LOGIN_URL = f"{BASE_URL}/merchant-backend-pc/shop/login"
USERNAME = "18800180305"
PASSWORD = "123456"

def login(session):
    """登录商城后台"""
    login_data = {
        "admin": {
            "password": PASSWORD,
            "mobile": USERNAME
        }
    }
    response = session.post(LOGIN_URL, json=login_data)
    data = response.json()

    if data.get("code") == 0:
        token = data["result"]["token"]
        print(f"登录成功! 用户: {data['result']['username']}")
        return token
    else:
        raise Exception(f"登录失败: {data.get('message')}")

    return response

def get_orders(session, token, page=1):
    """获取订单列表"""
    orders_url = f"{BASE_URL}/merchant-backend-pc/merchant/load-order-list"
    headers = {"authorization": token}
    data = {"page": page}
    response = session.post(orders_url, json=data, headers=headers)
    return response.json()

def get_order_detail(session, token, order_id):
    """获取订单详情"""
    detail_url = f"{BASE_URL}/merchant-backend-pc/merchant/load-order-detail"
    headers = {"authorization": token}
    params = {"order_id": order_id}
    response = session.get(detail_url, headers=headers, params=params)
    return response.json()


def parse_order_detail(detail, original_order_obj=None):
    """解析订单详情为统一的字典格式"""
    # 解析商品信息
    goods_list = []
    goods_ids = []
    goods_nums = []
    for item in detail.get("order_goods", []):
        goods_list.append(item['goods']['title'])
        goods_ids.append(str(item['goods']['id']))
        goods_nums.append(str(item['num']))

    # 使用引号分隔
    goods_names_str = '" "'.join(goods_list)
    goods_ids_str = '" "'.join(goods_ids)
    goods_nums_str = '" "'.join(goods_nums)

    # 首尾加引号
    if goods_names_str:
        goods_names_str = f'"{goods_names_str}"'
        goods_ids_str = f'"{goods_ids_str}"'
        goods_nums_str = f'"{goods_nums_str}"'

    # 获取物流信息
    shipping_info = detail.get("shipping_info", {}) or {}
    
    # 兼容历史逻辑中的 shipping_name (可能在列表页获取)
    shipping_name = ""
    if original_order_obj:
        shipping_name = original_order_obj.get("shipping_name", "")
    if not shipping_name:
        shipping_name = detail.get("shipping_name", "")

    return {
        # 基本信息
        "订单ID": detail.get("order_id"),
        "日期订单号": detail.get("daily_order_no"),
        "订单编号": detail.get("order_no"),
        "创建时间": detail.get("create_time"),

        # 金额相关
        "订单总额": detail.get("total_amount"),
        "实付金额": detail.get("paid_amount"),
        "优惠券金额": detail.get("coupon_amount"),
        "退款金额": detail.get("refund_amount"),
        "运费": detail.get("shipping_amount"),
        "打包费": detail.get("packing_amount"),
        "商品金额": detail.get("goods_money"),

        # 订单状态
        "订单状态": detail.get("status", {}).get("label"),
        "支付状态": detail.get("pay_method", {}).get("label"),
        "支付时间": detail.get("paid_at"),

        # 商品信息
        "商品总数量": detail.get("total_num"),
        "商品名称": goods_names_str,
        "商品ID": goods_ids_str,
        "商品数量": goods_nums_str,

        # 收货地址
        "收货人": detail.get("address", {}).get("user_name"),
        "联系电话": detail.get("address", {}).get("user_telephone"),
        "省份": detail.get("address", {}).get("province_name"),
        "城市": detail.get("address", {}).get("city_name"),
        "区县": detail.get("address", {}).get("country_name"),
        "详细地址": detail.get("address", {}).get("detail_info"),
        "邮编": detail.get("address", {}).get("postal_code"),

        # 配送信息
        "配送方式": shipping_name,
        "发货时间": detail.get("shipping_time"),
        "收货时间": detail.get("receive_time"),
        "核销时间": detail.get("consume_time"),

        # 物流信息
        "物流公司": shipping_info.get("express_name", ""),
        "物流单号": shipping_info.get("express_no", ""),
        "商家留言": shipping_info.get("notice", ""),

        # 其他信息
        "买家备注": detail.get("remark", ""),
        "交易单号": detail.get("trade_no"),
        "商家名称": detail.get("merchant", {}).get("title"),
        "商家电话": detail.get("merchant", {}).get("mobile"),
        "是否有售后": "是" if detail.get("has_after_sales") else "否"
    }

def update_db(parsed_orders, db_path):
    """同步解析后的订单到数据库"""
    if not os.path.exists(db_path):
        return
    print("正在同步更新本地数据库...")
    try:
        conn = sqlite3.sqlite3.connect(db_path)
        # 兼容旧版本 python 可能没有 sqlite3.sqlite3
    except AttributeError:
        conn = sqlite3.connect(db_path)
        
    try:
        cursor = conn.cursor()
        saved_count = 0
        updated_count = 0
        
        for o in parsed_orders:
            order_id = o.get("订单ID")
            status_mall = o.get("订单状态", "")
            shipping_name = o.get("物流公司", "")
            express_no = o.get("物流单号", "")
            
            # 逻辑：如果商城后台状态已经是 [待收货] 或 [已完成]，说明回传已成功完成
            status_logistics = 1 if status_mall in ["待收货", "已完成", "已签收", "已收货"] else 0
            order_data_str = json.dumps(o, ensure_ascii=False)
            
            try:
                # 尝试插入新订单
                cursor.execute('''
                    INSERT INTO orders (order_id, platform_code, shipping_name, express_no, order_data, status_warehouse, status_logistics, created_at) 
                    VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now', 'localtime'))
                ''', (order_id, order_id, shipping_name, express_no, order_data_str, status_logistics))
                saved_count += 1
            except sqlite3.IntegrityError:
                # 已存在的订单 → 更新 order_data，并根据商城状态更新 status_logistics (如果原本是 0)
                if status_logistics == 1:
                    cursor.execute('''
                        UPDATE orders SET order_data = ?, shipping_name = ?, express_no = ?, status_logistics = 1
                        WHERE order_id = ?
                    ''', (order_data_str, shipping_name, express_no, order_id))
                else:
                    cursor.execute('''
                        UPDATE orders SET order_data = ?, shipping_name = ?, express_no = ?
                        WHERE order_id = ?
                    ''', (order_data_str, shipping_name, express_no, order_id))
                updated_count += 1
        
        conn.commit()
        conn.close()
        print(f"数据库同步完成: 新增 {saved_count} 笔，更新 {updated_count} 笔。")
    except Exception as e:
        print(f"同步数据库失败: {e}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-only", action="store_true", help="仅执行核验模式")
    parser.add_argument("--scrape-only", action="store_true", help="仅执行抓取模式")
    args = parser.parse_args()

    session = requests.Session()
    print("正在登录商城后台...")
    token = login(session)
    db_path = os.path.join(os.path.dirname(__file__), 'server', 'database.sqlite')
    
    TERMINAL_STATUSES = ["已完成", "已退款", "已取消", "退款结束", "已核销"]

    # --- 第一阶段：常规抓取 (Discovery) ---
    if not args.audit_only:
        print("📁 [阶段 1/2] 正在发现新订单与同步基础状态...")
        all_orders = []
        page = 1
        existing_ids = set()
        if os.path.exists(db_path):
            try:
                _conn = sqlite3.connect(db_path)
                _cursor = _conn.cursor()
                _cursor.execute('SELECT order_id FROM orders')
                existing_ids = {str(row[0]) for row in _cursor.fetchall()}
                _conn.close()
            except: pass

        while True:
            print(f"   正在获取第 {page} 页列表...")
            result = get_orders(session, token, page)
            if result.get("code") != 0: break
            orders = result["result"]["items"]["data"]
            if not orders: break
            all_orders.extend(orders)
            if page >= result["result"]["items"]["last_page"]: break
            # 增量停止逻辑：如果连续 2 页都是已知订单且没有状态变化，则停止
            if existing_ids and page > 2:
                all_known = all(str(o.get("order_id")) in existing_ids for o in orders)
                if all_known: break
            page += 1

        # 更新变动订单
        db_order_statuses = {}
        if os.path.exists(db_path):
            try:
                _conn = sqlite3.connect(db_path)
                _cursor = _conn.cursor()
                _cursor.execute("SELECT order_id, json_extract(order_data, '$.订单状态') FROM orders")
                db_order_statuses = {str(row[0]): row[1] for row in _cursor.fetchall()}
                _conn.close()
            except: pass

        final_parsed = []
        for idx, order in enumerate(all_orders, 1):
            oid_str = str(order.get("order_id"))
            list_status = order.get("status", {}).get("label")
            if oid_str in existing_ids and list_status == db_order_statuses.get(oid_str):
                continue
            try:
                detail_res = get_order_detail(session, token, order.get("order_id"))
                if detail_res.get("code") == 0:
                    final_parsed.append(parse_order_detail(detail_res.get("result", {}), order))
                if len(final_parsed) >= 20:
                    update_db(final_parsed, db_path)
                    final_parsed = []
            except: pass
        if final_parsed: update_db(final_parsed, db_path)
        print("✅ 基础数据同步完成。")

    # --- 第二阶段：精准核验 (Audit) ---
    if not args.scrape_only:
        print("🚀 [阶段 2/2] 正在对剩余滞留订单进行状态核验...")
        if not os.path.exists(db_path): return
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT order_id, json_extract(order_data, '$.订单状态') as status FROM orders")
        rows = cursor.fetchall()
        conn.close()
        
        ids_to_audit = [rid for rid, rstatus in rows if rstatus not in TERMINAL_STATUSES]
        if not ids_to_audit:
            print("✅ 所有存量订单均已处于终态，无需补漏。")
        else:
            print(f"   发现 {len(ids_to_audit)} 笔中间态订单，开始补漏核验...")
            audit_parsed = []
            for i, oid in enumerate(ids_to_audit, 1):
                try:
                    print(f"   [{i}/{len(ids_to_audit)}] 核验详情: {oid} ...")
                    detail_result = get_order_detail(session, token, oid)
                    if detail_result.get("code") == 0:
                        audit_parsed.append(parse_order_detail(detail_result.get("result", {})))
                        if len(audit_parsed) >= 10:
                            update_db(audit_parsed, db_path)
                            audit_parsed = []
                except: pass
            if audit_parsed: update_db(audit_parsed, db_path)
        print("✨ 订单状态核验与对账完成！")

if __name__ == "__main__":
    main()
