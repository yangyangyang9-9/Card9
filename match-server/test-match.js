const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001';
const WALLET_1 = '0x1111111111111111111111111111111111111111';
const WALLET_2 = '0x2222222222222222222222222222222222222222';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function test() {
  console.log('1. 连接WebSocket...');
  const ws1 = new WebSocket(WS_URL);
  const ws2 = new WebSocket(WS_URL);

  await new Promise(r => ws1.on('open', r));
  await new Promise(r => ws2.on('open', r));
  console.log('   WebSocket连接成功');

  await sleep(100);

  console.log('2. 注册钱包...');
  ws1.send(JSON.stringify({ type: 'register', wallet: WALLET_1 }));
  ws2.send(JSON.stringify({ type: 'register', wallet: WALLET_2 }));
  await sleep(200);

  console.log('3. 钱包1加入队列...');
  ws1.send(JSON.stringify({ type: 'join_queue' }));
  await sleep(200);

  console.log('4. 钱包2加入队列...');
  ws2.send(JSON.stringify({ type: 'join_queue' }));
  await sleep(500);

  console.log('5. 检查结果...');
  const http = require('http');
  const status = await new Promise((resolve, reject) => {
    http.get('http://localhost:3001/api/queue/status', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  console.log('   队列状态:', status);

  ws1.close();
  ws2.close();
  await sleep(100);
  console.log('\n测试完成');
  process.exit(0);
}

test().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
