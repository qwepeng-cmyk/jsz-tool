import requests
import json
import sys
import hashlib
import time

# 仓库ERP配置
ERP_API_URL = 'http://v2.api.guanyierp.com/rest/erp_open'
APP_KEY = '195913'
SECRET = '8cebd6dcf53d4bcd9efd79baf37e39b0'
SESSION_KEY = '42dabd2137db4bcab2a02d7765ae84b6'

# 商城配置
MALL_BASE_URL = 'https://666.dianzhushoukeji.com'
MALL_USERNAME = '18800180305'
MALL_PASSWORD = '123456'

# 物流公司映射
EXPRESS_MAPPING = {
    'SF': 379, '顺丰': 379, '顺丰速运': 379, '顺丰标准快递': 379, '顺丰特快': 379,
    'ZTO': 601, '中通': 601, '中通快递': 601,
    'YD': 528, '韵达': 528, '韵达快递': 528,
    'YTO': 527, '圆通': 527, '圆通速递': 527,
    'STO': 380, '申通': 380, '申通快递': 380,
    'JD': 233, '京东': 233, '京东物流': 233,
    'JTSD': 256, '极兔': 256, '极兔速递': 256,
    'HTKY': 29, '百世': 29, '百世快递': 29,
    'HHTT': 652, '天天': 652, '天天快递': 652,
    'DBL': 81, '德邦': 81, '德邦快递': 81,
    'EMS': 115, '邮政': 115, '中国邮政': 115, 'EMS快递': 115
}

def call_erp_api(method, params):
    """调用仓库ERP API"""
    timestamp = str(int(time.time()))
    sign_str = f"{SECRET}method{method}sessionkey{SESSION_KEY}timestamp{timestamp}{SECRET}"

    for key in sorted(params.keys()):
        sign_str += f"{key}{params[key]}"

    sign = hashlib.md5(sign_str.encode()).hexdigest().upper()

    data = {
        'method': method,
        'appkey': APP_KEY,
        'sessionkey': SESSION_KEY,
        'timestamp': timestamp,
        'sign': sign,
        **params
    }

    response = requests.post(ERP_API_URL, json=data)
    return response.json()

def get_delivery_from_warehouse(platform_code):
    """从仓库查询发货单"""
    result = call_erp_api('gy.erp.trade.deliverys.get', {
        'platform_code': platform_code,
        'page_no': '1',
        'page_size': '1'
    })

    if result.get('success') and result.get('deliverys'):
        delivery = result['deliverys'][0]
        return {
            'express_name': delivery.get('express_name'),
            'express_no': delivery.get('express_no')
        }
    return None

def mall_login():
    """商城登录"""
    response = requests.post(
        f'{MALL_BASE_URL}/merchant-backend-pc/shop/login',
        json={'admin': {'password': MALL_PASSWORD, 'mobile': MALL_USERNAME}}
    )
    data = response.json()
    if data.get('code') == 0:
        return data['result']['token']
    raise Exception(f"商城登录失败: {data.get('message')}")

def map_express_to_mall_id(express_name):
    """映射物流公司到商城ID"""
    if not express_name:
        return None
        
    # 1. 精确匹配
    if express_name in EXPRESS_MAPPING:
        return EXPRESS_MAPPING[express_name]
        
    # 2. 模糊匹配 (关键字包含)
    for key, val in EXPRESS_MAPPING.items():
        if key in express_name or express_name in key:
            return val
            
    return None

def update_mall_logistics(token, order_id, express_id, express_no):
    """回传物流信息到商城"""
    response = requests.post(
        f'{MALL_BASE_URL}/merchant-backend-pc/merchant/do-order-shipping',
        json={
            'order_id': order_id,
            'expect_code': 'self_old_express',
            'extra': {
                'express_name': express_id,
                'express_no': express_no,
                'reply': ''
            }
        },
        headers={'authorization': token}
    )
    return response.json()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('用法: python3 sync_logistics.py <商城订单号> [物流公司] [物流单号]')
        sys.exit(1)

    order_id = sys.argv[1]
    arg_express_name = sys.argv[2] if len(sys.argv) > 2 else None
    arg_express_no = sys.argv[3] if len(sys.argv) > 3 else None

    print(f'📦 开始同步订单物流: {order_id}\n')

    # 1. 确定物流信息
    delivery = None
    if arg_express_name and arg_express_no:
        print('💡 使用预设物流信息，跳过仓库查询')
        delivery = {
            'express_name': arg_express_name,
            'express_no': arg_express_no
        }
    else:
        print('🔍 查询仓库发货单...')
        delivery = get_delivery_from_warehouse(order_id)

    if not delivery or not delivery['express_no']:
        print('❌ 未找到发货单或单号为空')
        sys.exit(1)

    print(f"✅ 物流公司: {delivery['express_name']}")
    print(f"✅ 物流单号: {delivery['express_no']}\n")

    # 2. 映射物流公司
    express_id = map_express_to_mall_id(delivery['express_name'])
    if not express_id:
        print(f"❌ 无法映射物流公司: {delivery['express_name']}")
        sys.exit(1)

    print(f'✅ 商城物流ID: {express_id}\n')

    # 3. 登录商城
    print('🔐 登录商城...')
    try:
        token = mall_login()
        print('✅ 登录成功\n')
    except Exception as e:
        print(f'❌ {str(e)}')
        sys.exit(1)

    # 4. 回传物流信息
    print('📤 回传物流信息...')
    result = update_mall_logistics(token, order_id, express_id, delivery['express_no'])

    if result.get('code') == 0:
        print('✅ 物流信息回传成功!')
    else:
        print(f"❌ 回传失败: {result.get('message')}")
