import requests
import sys

# 商城配置
MALL_BASE_URL = 'https://666.dianzhushoukeji.com'
MALL_USERNAME = '18800180305'
MALL_PASSWORD = '123456'

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
    # 固定参数
    order_id = 'gopx20260328214352204850'
    express_no = '987654321'
    express_id = 379  # 顺丰速运

    print(f'📦 手动回传物流信息')
    print(f'订单号: {order_id}')
    print(f'物流公司: 顺丰速运')
    print(f'物流单号: {express_no}\n')

    # 登录商城
    print('🔐 登录商城...')
    token = mall_login()
    print('✅ 登录成功\n')

    # 回传物流信息
    print('📤 回传物流信息...')
    result = update_mall_logistics(token, order_id, express_id, express_no)

    if result.get('code') == 0:
        print('✅ 物流信息回传成功!')
    else:
        print(f"❌ 回传失败: {result.get('message')}")

