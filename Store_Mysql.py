from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pymysql
import redis

app=FastAPI()
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '1234',
    'database': 'test',
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}
redis_config = {
    'host': 'localhost',
    'port': 6379,
    'db': 0,
    'decode_responses': True
}

def get_redis():
    return redis.Redis(**redis_config)

def get_conn():
    return pymysql.connect(**db_config)

class LocalStoragePayload(BaseModel):
    ny: str

@app.post("/save_local")
def save_local(data: LocalStoragePayload):
    conn = get_conn()
    try:
        with conn.cursor() as cursor:
            check_sql="SELECT id FROM `user` WHERE ny = %s LIMIT 1"
            cursor.execute(check_sql, (data.ny,))
            existing=cursor.fetchone()
            if existing:
                sql="UPDATE `user` SET `time` = NOW() WHERE ny = %s"
                cursor.execute(sql, (data.ny,))
                msg="更新时间成功"
            else:
                sql="INSERT INTO `user` (ny, `time`) VALUES (%s, NOW())"
                cursor.execute(sql, (data.ny,))
                msg="写入成功"
        conn.commit()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, ny, `time` FROM `user` WHERE ny = %s LIMIT 1", (data.ny,))
            row = cursor.fetchone()
        r = get_redis()
        if row:
            score = int(row["time"].timestamp()) if row["time"] else 0
            redis_member = f'{row["id"]}:{row["ny"]}'
            r.zadd("user_ny_by_time", {redis_member: score})
        return {"msg": msg, "data": row}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"写入失败: {str(e)}")
    finally:
        conn.close()


# --- New endpoint: sync_ny_to_redis ---
@app.post("/sync_ny_to_redis")
def sync_ny_to_redis():
    conn = get_conn()
    r = get_redis()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, ny, `time` FROM `user` ORDER BY `time` ASC LIMIT 10")
            rows = cursor.fetchall()

        if not rows:
            return {"msg": "没有可同步的数据", "count": 0}

        r.delete("user_ny_by_time")
        mapping = {}
        for row in rows:
            score = int(row["time"].timestamp()) if row["time"] else 0
            redis_member = f'{row["id"]}:{row["ny"]}'
            mapping[redis_member] = score

        r.zadd("user_ny_by_time", mapping)

        return {
            "msg": "同步到 Redis 成功",
            "count": len(mapping),
            "redis_key": "user_ny_by_time",
            "data": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")
    finally:
        conn.close()


# --- New endpoint: get_redis_ny ---
@app.get("/redis_ny")
def get_redis_ny():
    try:
        r = get_redis()
        result = r.zrange("user_ny_by_time", 0, 9, withscores=True)

        if result:
            data = []
            for member, score in result:
                parts = member.split(":", 1)
                if len(parts) == 2:
                    id_value, ny = parts
                else:
                    id_value, ny = None, member
                data.append({"id": int(id_value) if id_value else None, "ny": ny, "score": int(score)})
            return {"msg": "优先从 Redis 读取成功", "source": "redis", "data": data}

        conn = get_conn()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, ny, `time` FROM `user` ORDER BY `time` ASC LIMIT 10")
                rows = cursor.fetchall()

            if not rows:
                return {"msg": "Redis 和 MySQL 都没有数据", "source": "mysql", "data": []}

            mapping = {}
            data = []
            for row in rows:
                score = int(row["time"].timestamp()) if row["time"] else 0
                redis_member = f'{row["id"]}:{row["ny"]}'
                mapping[redis_member] = score
                data.append({"id": row["id"], "ny": row["ny"], "score": score})

            r.zadd("user_ny_by_time", mapping)
            return {"msg": "Redis 无数据，已从 MySQL 读取并回写 Redis", "source": "mysql", "data": data}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取 Redis 失败: {str(e)}")
