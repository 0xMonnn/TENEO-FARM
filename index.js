const axios = require('axios');
const chalk = require('chalk');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline');
const keypress = require('keypress');

let sockets = [];
let pingIntervals = [];
let countdownIntervals = [];
let potentialPoints = [];
let countdowns = [];
let pointsTotals = [];
let pointsToday = [];
let lastUpdateds = [];
let messages = [];
let userIds = [];
let browserIds = [];
let proxies = [];
let accessTokens = [];
let accounts = [];
let useProxy = false;
let enableAutoRetry = false;
let currentAccountIndex = 0;
let useBearerTokens = false;

function loadAccounts() {
  if (!fs.existsSync('account.txt')) {
    console.error('File account.txt tidak ditemukan. Harap tambahkan file data akun.');
    process.exit(1);
  }

  try {
    const data = fs.readFileSync('account.txt', 'utf8');
    accounts = data.split('\n').map(line => {
      const [email, password] = line.split(',');
      if (email && password) {
        return { email: email.trim(), password: password.trim() };
      }
      return null;
    }).filter(account => account !== null);

    // Debugging: Tampilkan array accounts untuk memverifikasi isinya
    console.log('Akun yang dimuat:', accounts);

  } catch (err) {
    console.error('Gagal memuat akun:', err);
  }
}

function loadBearerTokens() {
  if (!fs.existsSync('bearer.txt')) {
    console.error('bearer.txt file not found. Please add bearer tokens file.');
    process.exit(1);
  }

  try {
    const data = fs.readFileSync('bearer.txt', 'utf8');
    accessTokens = data.split('\n').map(token => token.trim()).filter(token => token);
    if (accessTokens.length === 0) {
      console.error('No valid bearer tokens found in bearer.txt.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to load bearer tokens:', err);
  }
}

function loadProxies() {
  if (!fs.existsSync('proxy.txt')) {
    console.error('proxy.txt file not found. Please add proxy data file.');
    process.exit(1);
  }

  try {
    const data = fs.readFileSync('proxy.txt', 'utf8');
    proxies = data.split('\n').map(line => line.trim()).filter(line => line);
  } catch (err) {
    console.error('Failed to load proxies:', err);
  }
}

function normalizeProxyUrl(proxy) {
  if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
    proxy = 'http://' + proxy;
  }
  return proxy;
}

function promptUseBearerTokens() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Use bearer tokens instead of email/password login? (y/n): ', (answer) => {
      useBearerTokens = answer.toLowerCase() === 'y';
      rl.close();
      resolve();
    });
  });
}

function promptUseProxy() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Use proxy? (y/n): ', (answer) => {
      useProxy = answer.toLowerCase() === 'y';
      rl.close();
      resolve();
    });
  });
}

function promptEnableAutoRetry() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Enable auto-retry on account error? (y/n): ', (answer) => {
      enableAutoRetry = answer.toLowerCase() === 'y';
      rl.close();
      resolve();
    });
  });
}

async function initialize() {
  displayHeader();
  await promptUseBearerTokens();
  if (useBearerTokens) {
    loadBearerTokens();
  } else {
    loadAccounts();
  }
  loadProxies();
  await promptUseProxy();
  await promptEnableAutoRetry();

  const length = useBearerTokens ? accessTokens.length : accounts.length;
  if (length === 0) {
    console.error('Tidak ada akun atau bearer token yang tersedia.');
    process.exit(1);
  }

  if (useProxy && proxies.length < length) {
    console.error('Jumlah proxy tidak mencukupi, silakan tambahkan lebih banyak proxy.');
    process.exit(1);
  }

  for (let i = 0; i < length; i++) {
    potentialPoints[i] = 0;
    countdowns[i] = "Calculating...";
    pointsTotals[i] = 0;
    pointsToday[i] = 0;
    lastUpdateds[i] = null;
    messages[i] = '';
    userIds[i] = null;
    browserIds[i] = null;
    if (!useBearerTokens) {
      accessTokens[i] = null;
      getUserId(i);
    } else {
      connectWebSocket(i);
    }
  }

  displayAccountData(currentAccountIndex);
  handleUserInput();
}

function generateBrowserId(index) {
  return `browserId-${index}-${Math.random().toString(36).substring(2, 15)}`;
}

function displayHeader() {
  console.clear();
  console.log(chalk.cyan.bold(` █████╗ ███████╗██╗   ██╗███╗   ██╗ ██████╗`));
  console.log(chalk.cyan.bold(`██╔══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝`));
  console.log(chalk.cyan.bold(`███████║███████╗ ╚████╔╝ ██╔██╗ ██║██║     `));
  console.log(chalk.cyan.bold(`██╔══██║╚════██║  ╚██╔╝  ██║╚██╗██║██║     `));
  console.log(chalk.cyan.bold(`██║  ██║███████║   ██║   ██║ ╚████║╚██████╗`));
  console.log(chalk.cyan.bold(`╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝`));
  console.log(chalk.cyan.bold(`               JOIN AIRDROP         `));
  console.log(chalk.cyan.bold(`      https://t.me/AirdropSyncReborn `));
  console.log("");  // Tambahkan baris kosong untuk pemisah
}

function displayAccountData(index) {
  console.clear();
  displayHeader();

  const width = process.stdout.columns;
  const separatorLine = '_'.repeat(width);
  const accountHeader = `Account ${index + 1}`;
  const padding = Math.max(0, Math.floor((width - accountHeader.length) / 2));

  console.log(chalk.cyan(separatorLine));
  console.log(chalk.cyan(' '.repeat(padding) + chalk.bold(accountHeader)));
  console.log(chalk.cyan(separatorLine));

  if (!useBearerTokens) {
    console.log(chalk.whiteBright(`Email: ${accounts[index].email}`));
    console.log(`User ID: ${userIds[index]}`);
    console.log(`Browser ID: ${browserIds[index]}`);
  }
  console.log(chalk.green(`Total Points: ${pointsTotals[index]}`));
  console.log(chalk.green(`Points Today: ${pointsToday[index]}`));
  console.log(chalk.whiteBright(`Message: ${messages[index]}`));

  const proxy = proxies[index % proxies.length];
  if (useProxy && proxy) {
    console.log(chalk.hex('#FFA500')(`Proxy: ${proxy}`));
  } else {
    console.log(chalk.hex('#FFA500')(`Proxy: Not using proxy`));
  }

  console.log(chalk.cyan(separatorLine));
  console.log("\nStatus:");

  if (messages[index].startsWith("Error:")) {
    console.log(chalk.red(`Account ${index + 1}: ${messages[index]}`));
  } else {
    console.log(`Account ${index + 1}: Potential Points: ${potentialPoints[index]}, Countdown: ${countdowns[index]}`);
  }
}

function handleUserInput() {
  keypress(process.stdin);

  process.stdin.on('keypress', (ch, key) => {
    const length = useBearerTokens ? accessTokens.length : accounts.length;

    if (key && key.name === 'a') {
      currentAccountIndex = (currentAccountIndex - 1 + length) % length;
      console.log(`Beralih ke akun: ${currentAccountIndex + 1}`);
      displayAccountData(currentAccountIndex);
    } else if (key && key.name === 'd') {
      currentAccountIndex = (currentAccountIndex + 1) % length;
      console.log(`Beralih ke akun: ${currentAccountIndex + 1}`);
      displayAccountData(currentAccountIndex);
    } else if (key && key.name === 'c') {
      console.log('Exiting program...');
      process.exit();
    }
    if (key && key.ctrl && key.name === 'c') {
      process.stdin.pause();
    }
  });

  process.stdin.setRawMode(true);
  process.stdin.resume();
}

async function connectWebSocket(index) {
  if (sockets[index]) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?accessToken=${encodeURIComponent(accessTokens[index])}&version=${encodeURIComponent(version)}`;

  const proxy = proxies[index % proxies.length];
  const agent = useProxy && proxy ? new HttpsProxyAgent(normalizeProxyUrl(proxy)) : null;

  sockets[index] = new WebSocket(wsUrl, { agent });

  sockets[index].onopen = async () => {
    lastUpdateds[index] = new Date().toISOString();
    console.log(`Account ${index + 1} connected`, lastUpdateds[index]);
    startPinging(index);
    startCountdownAndPoints(index);
  };

  sockets[index].onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      lastUpdateds[index] = new Date().toISOString();
      pointsTotals[index] = data.pointsTotal;
      pointsToday[index] = data.pointsToday;
      messages[index] = data.message;

      if (index === currentAccountIndex) {
        displayAccountData(index);
      }
    }

    if (data.message === "Pulse from server") {
      console.log(`Received heartbeat from server - Account ${index + 1}. Starting ping...`);
      setTimeout(() => {
        startPinging(index);
      }, 10000);
    }
  };

  sockets[index].onclose = () => {
    console.log(`Account ${index + 1} disconnected`);
    reconnectWebSocket(index);
  };

  sockets[index].onerror = (error) => {
    console.error(`WebSocket error - Account ${index + 1}:`, error);
  };
}

async function getUserId(index) {
  const loginUrl = "https://auth.teneo.pro/api/login";

  const proxy = proxies[index % proxies.length];
  const agent = useProxy && proxy ? new HttpsProxyAgent(normalizeProxyUrl(proxy)) : null;

  try {
    const response = await axios.post(loginUrl, {
      email: accounts[index].email,
      password: accounts[index].password
    }, {
      httpsAgent: agent,
      headers: {
        'Authorization': `Bearer ${accessTokens[index]}`,
        'Content-Type': 'application/json',
        'authority': 'auth.teneo.pro',
        'x-api-key': 'OwAG3kib1ivOJG4Y0OCZ8lJETa6ypvsDtGmdhcjB',
        'accept': 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9,id;q=0.8',
        'origin': 'https://dashboard.teneo.pro',
        'referer': 'https://dashboard.teneo.pro/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    });

    const { user, access_token } = response.data;
    userIds[index] = user.id;
    accessTokens[index] = access_token;
    browserIds[index] = generateBrowserId(index);
    messages[index] = "Connection successful";

    if (index === currentAccountIndex) {
      displayAccountData(index);
    }

    console.log(`Account ${index + 1} user data:`, user);
    startCountdownAndPoints(index);
    await connectWebSocket(index);
  } catch (error) {
    const errorMessage = error.response ? error.response.data.message : error.message;
    messages[index] = `Error: ${errorMessage}`;

    if (index === currentAccountIndex) {
      displayAccountData(index);
    }

    console.error(`Account ${index + 1} error:`, errorMessage);

    if (enableAutoRetry) {
      console.log(`Retrying account ${index + 1} in 3 minutes...`);
      setTimeout(() => getUserId(index), 180000);
    }
  }
}

function startPinging(index) {
  if (pingIntervals[index]) {
    clearInterval(pingIntervals[index]);
  }

  pingIntervals[index] = setInterval(() => {
    if (sockets[index] && sockets[index].readyState === WebSocket.OPEN) {
      sockets[index].send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);
}

function startCountdownAndPoints(index) {
  if (countdownIntervals[index]) {
    clearInterval(countdownIntervals[index]);
  }

  countdownIntervals[index] = setInterval(() => {
    const now = new Date();
    const nextUpdate = new Date(lastUpdateds[index]);
    nextUpdate.setMinutes(nextUpdate.getMinutes() + 30);

    if (now >= nextUpdate) {
      potentialPoints[index] += 1;
      lastUpdateds[index] = now.toISOString();
    }

    const timeLeft = nextUpdate - now;
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    countdowns[index] = `${minutes}m${seconds}s`;

    if (index === currentAccountIndex) {
      displayAccountData(index);
    }
  }, 1000);
}

function reconnectWebSocket(index) {
  if (pingIntervals[index]) {
    clearInterval(pingIntervals[index]);
  }
  if (countdownIntervals[index]) {
    clearInterval(countdownIntervals[index]);
  }

  setTimeout(() => {
    console.log(`Attempting to reconnect account ${index + 1}...`);
    connectWebSocket(index);
  }, 5000);
}

// Start the program
initialize();
