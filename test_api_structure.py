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
    if not token:
        print("Login failed")
        return

    orders_url = f"{BASE_URL}/merchant-backend-pc/merchant/load-order-list"
    headers = {"authorization": token}
    # Try common status filters: 10, 20, 30...
    # Or just see what one page returns
    data = {"page": 1}
    response = session.post(orders_url, json=data, headers=headers)
    res_json = response.json()
    
    if res_json.get("code") == 0:
        items = res_json["result"]["items"]["data"]
        if items:
            print("Item structure:")
            print(json.dumps(items[0], indent=2, ensure_ascii=False))
            
            # Print unique statuses found in the first page
            statuses = set(str(o.get('status')) for o in items)
            print(f"\nStatuses found on page 1: {statuses}")
    else:
        print("Failed to fetch orders:", res_json)

if __name__ == "__main__":
    main()
