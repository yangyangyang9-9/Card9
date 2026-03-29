# Card9 匹配服务器

基于匹配逻辑文档实现的Node.js匹配服务器。

## 状态机

```
IDLE -> MATCHING -> MATCHED -> READY_P1/READY_P2 -> READY_BOTH -> ONCHAIN_PENDING -> ONCHAIN_STARTED
```

## 核心功能

1. **钱包连接管理** - WebSocket实时连接
2. **匹配队列** - 2个钱包自动配对
3. **双Ready签名** - 双方确认后才允许链上启动
4. **超时清理** - 60秒未Ready自动清理匹配

## API接口

### HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 服务器健康检查 |
| GET | /api/queue/status | 队列状态 |
| POST | /api/queue/join | 加入匹配队列 |
| POST | /api/queue/leave | 离开匹配队列 |
| GET | /api/match/:id | 获取匹配信息 |
| GET | /api/match/wallet/:wallet | 根据钱包获取匹配 |
| POST | /api/match/:id/ready | 标记Ready状态 |
| POST | /api/match/:id/cancel | 取消匹配 |

### WebSocket消息

**客户端发送:**
```json
{ "type": "register", "wallet": "0x..." }
{ "type": "join_queue" }
{ "type": "leave_queue" }
{ "type": "ready", "matchId": "..." }
```

**服务端推送:**
```json
{ "type": "match_created", "matchId": "...", "opponent": "0x..." }
{ "type": "ready_status", "youReady": true, "opponentReady": false }
{ "type": "both_ready", "startOnChainParams": {...} }
{ "type": "match_expired", "reason": "match_timeout" }
```

## 启动

```bash
cd match-server
npm install
npm start
```

服务器默认运行在端口3001。
