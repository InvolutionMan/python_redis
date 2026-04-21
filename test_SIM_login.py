from contextlib import asynccontextmanager
from typing import Optional
import random
import re
import uuid
import json
from fastapi import Depends
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


redis_client: Optional[redis.Redis] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    redis_client=redis.from_url("redis://localhost:6379",
                                decode_responses=True)
    await redis_client.ping()
    print("✅ Redis 连接成功")
    yield
    if redis_client:
        await redis_client.close()
        print("🔌 Redis 连接已关闭")
app = FastAPI(lifespan=lifespan)

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="未登录")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="token 格式错误")

    token = authorization.replace("Bearer ", "").strip()
    token_key = f"login:token:{token}"
    user_json = await redis_client.get(token_key)

    if not user_json:
        raise HTTPException(status_code=401, detail="token 无效或已过期")
    await redis_client.expire(token_key,1800)
    user=json.loads(user_json)
    return user

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) # 允许跨域,允许你的前端页面可以访问你的 FastAPI 后端接口。

class SendCodeRequest(BaseModel):
    phone: str

@app.post("/send_code")
async def send_code(request: SendCodeRequest):
    phone = request.phone.strip()
    code=str(random.randint(1000,9999))
    key=f"login:code:{phone}"
    await redis_client.set(key,code,ex=1800)
    print(f"前端传来的手机号为：{phone}")
    print(f"生成的验证码为：{code}")
    return {"message": "验证码已发送",
            "code":code}


class LoginRequest(BaseModel):
    phone: str
    code: str
@app.post("/login")

async def login(request:LoginRequest):
    phone=request.phone.strip()
    code=request.code.strip()
    key=f"login:code:{phone}"
    saved_code=await redis_client.get(key)
    if not saved_code:
        raise HTTPException(status_code=400,detail="验证码已过期")
    if saved_code!=code:
        raise HTTPException(status_code=400,detail="验证码错误")
    await redis_client.delete(key)

    token = str(uuid.uuid4())
    user = {
        "phone": phone,
        "nickname": f"用户{phone[-4:]}"
    }

    token_key = f"login:token:{token}"
    await redis_client.set(token_key, json.dumps(user), ex=1800)

    return {
        "message": "登录成功",
        "token": token,
        "user": user
    }

@app.get("/me") #利用 token 进行登录
async def get_me(current_user: dict = Depends(get_current_user)):#从请求头中获取 token
    return {
        "message": "获取用户成功",
        "user": current_user
    }
