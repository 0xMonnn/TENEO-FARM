## RUNNING

- Clone Repository

```bash
git clone https://github.com/0xMonnn/TENEO-FARM.git
cd teneo-farm
```

- Install Dependency

```bash
npm install
```

- Run the script its only for 1 account - run multy below for multiple accounts

```bash
node main.js
```

## run for multy accounts:

- Manual put token in `tokens.txt` 1 line 1 token
  ```bash
  nano tokens.txt
  ```
- proxy (optional) in `proxies.txt`
  ```bash
  nano proxies.txt
  ```

### Auto get tokens if you dont want put it manually:

- fill `accounts.txt` format : `test@gmail.com|password123` 1 line 1 account
  ```bash
  nano accounts.txt
  ```
- run to get tokens

  ```bash
  node getToken
  ```

- Start multy accounts
  ```bash
  node multy
  ```

## ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

This project is licensed under the [MIT License](LICENSE).
