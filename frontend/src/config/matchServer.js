class MatchServer {
  constructor() {
    this.ws = null
    this.listeners = {}
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  connect(wallet) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      
      try {
        this.ws = new WebSocket(wsUrl)
      } catch (err) {
        reject(new Error('WebSocket连接失败'))
        return
      }

      this.ws.onopen = () => {
        console.log('WebSocket已连接')
        this.reconnectAttempts = 0
        if (wallet) {
          this.send({ type: 'register', wallet })
        }
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (this.listeners[data.type]) {
            this.listeners[data.type].forEach(callback => callback(data))
          }
          if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => callback(data))
          }
        } catch (err) {
          console.error('消息解析失败:', err)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket已关闭')
        this.tryReconnect(wallet)
      }

      this.ws.onerror = (err) => {
        console.error('WebSocket错误:', err)
        reject(err)
      }
    })
  }

  tryReconnect(wallet) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      setTimeout(() => this.connect(wallet), 3000)
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.error('WebSocket未连接')
    }
  }

  on(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(callback)
  }

  off(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback)
    }
  }

  joinQueue(wallet) {
    this.send({ type: 'join_queue', wallet })
  }

  leaveQueue(wallet) {
    this.send({ type: 'leave_queue', wallet })
  }

  markReady(matchId, wallet) {
    this.send({ type: 'ready', matchId, wallet })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const matchServer = new MatchServer()
