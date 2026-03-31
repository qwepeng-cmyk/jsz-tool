import requests
import json

# 登录信息
BASE_URL = "https://666.dianzhushoukeji.com"
LOGIN_URL = f"{BASE_URL}/merchant-backend-pc/shop/login"
USERNAME = "18800180305"
PASSWORD = "123456"

def login(session):
    login_data = {"admin": {"password": PASSWORD, "mobile": USERNAME}}
    response = session.post(LOGIN_URL, json=login_data)
    data = response.json()
    if data.get("code") == 0:
        return data["result"]["token"]
    return None

def main():
    session = requests.Session()
    token = login(session)
    if not token: return

    orders_url = f"{BASE_URL}/merchant-backend-pc/merchant/load-order-list"
    headers = {"authorization": token}
    
    # Try filtering by status
    print("Trying status: undeliver")
    data = {"page": 1, "status": "undeliver"}
    response = session.post(orders_url, json=data, headers=headers)
    res_json = response.json()
    
    if res_json.get("code") == 0:
        items = res_json["result"]["items"]["data"]
        statuses = set(o.get('status', {}).get('id') for o in items)
        print(f"Results for 'undeliver': {len(items)} items. Unique statuses: {statuses}")
        
    print("\nTrying status_id: undeliver")
    data = {"page": 1, "status_id": "undeliver"}
    response = session.post(orders_url, json=data, headers=headers)
    res_json = response.json()
    
    if res_json.get("code") == 0:
        items = res_json["result"]["items"]["data"]
        statuses = set(o.get('status', {}).get('id') for o in items)
        print(f"Results for 'status_id: undeliver': {len(items)} items. Unique statuses: {statuses}")

if __name__ == "__main__":
    main()
