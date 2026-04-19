from fastapi import FastAPI, Depends, Query
import redis.asyncio as redis
from contextlib import asynccontextmanager
from datetime import datetime
from pydantic import BaseModel
from enum import Enum

# 全局 Redis 客户端
redis_client = None

class Direction(str, Enum):
    left = "left"
    right = "right"

# 生命周期（替代 on_event）
@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    redis_client = redis.Redis(
        host="127.0.0.1",   # 本地运行用这个
        port=6379,
        decode_responses=True
    )

    # 测试连接
    await redis_client.ping()
    print("✅ Redis connected")

    yield  # 🚀 应用开始运行

    # 关闭连接
    await redis_client.close()
    print("🔌 Redis connection closed")


app = FastAPI(lifespan=lifespan)


# ✅ 推荐：依赖注入方式获取 Redis
async def get_redis():
    return redis_client


# 测试接口
@app.get("/string")
async def root():
    return {"message": "FastAPI + Redis is running"}

# 写入 Redis string类型
@app.get("/set_string")
async def set_value(key: str, value: str, r=Depends(get_redis)):
    await r.set(key, value)
    return {"msg": "插入成功"}


@app.get("/set_hash")
async def set_value(key: str, field: str,value: str, r=Depends(get_redis)):
    await r.hset(key, field,value)
    return {"msg": "插入成功"}


@app.get("/set_list")
async def set_value(
    key: str,
    direction: Direction = Query(..., description="选择插入方向：left=左侧插入，right=右侧插入"),
    value: str = Query(..., description="要插入的值"),
    r=Depends(get_redis)
):
    if direction == Direction.left:
        await r.lpush(key, value)
        return {"msg": "从左边插入成功"}
    else:
        await r.rpush(key, value)
        return {"msg": "从右边插入成功"}

@app.get("/set_set")
async def set_value(key: str, value: str, r=Depends(get_redis)):
    await r.sadd(key, value)
    return {"msg": "插入成功"}

# 读取 Redis
@app.get("/get")
async def get_value(key: str, field: str = None, r=Depends(get_redis)):
    key_type = await r.type(key)

    # string
    if key_type == "string":
        value = await r.get(key)
        return {"type": "string", "value": value}

    # hash
    if key_type == "hash":
        if field:
            value = await r.hget(key, field)
            return {"type": "hash", "value": value}
        else:
            value = await r.hgetall(key)
            return {"type": "hash", "value": value}

    # list
    if key_type == "list":
        value = await r.lrange(key, 0, -1)
        return {"type": "list", "value": value}

        # set
    if key_type == "set":
        value = await r.smembers(key)
        return {"type": "set", "value": list(value)}

    return {"error": "Key not found or unsupported type"}

@app.delete("/delete")
async def delete_value(key: str, field: str = None, r=Depends(get_redis)):
    key_type = await r.type(key)

    # string
    if key_type == "string":
        await r.delete(key)
        return {"msg": "删除成功"}

    # hash
    if key_type == "hash":
        if field:
            await r.hdel(key, field)
            return {"msg": "删除成功"}
        else:
            await r.delete(key)
            return {"msg": "删除成功"}

    if key_type == "list":
        await r.delete(key)
        return {"msg": "删除成功"}

    if key_type == "set":
        if field:
            await r.srem(key, field)
            return {"msg": "删除成功"}
        else:
            await r.delete(key)
            return {"msg": "删除成功"}
    return {"error": "Key not found or unsupported type"}