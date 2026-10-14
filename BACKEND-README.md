# iPhone 記帳：安裝、啟動與備份

2026-10-14：本文件的 Django 帳號與瀏覽器待買清單，與固定私人 Sites 的 ChatGPT 帳號分開。Sites 已部署筆記、照片及待買清單同步，首頁也讀取同一帳號的歷史；這不表示以下 Docker／PostgreSQL 記帳後端已部署，也不會自動移轉 Django 資料。

GPS 角色地圖入口：首頁「GPS 角色地圖」或 `/app/app.html?view=world`。預設中壢，可切換大園預覽。手機 GPS 必須 HTTPS 與瀏覽器定位權限，下面的家用 HTTP 測試網址只能手動試走；電腦 localhost 支援模擬定位。街道地圖涵蓋台灣各縣市，排除宜蘭、花蓮、台東與南投；此版全台提供立體角色與真實街道底圖，尚無全台立體建築／店內場景。詳細限制見 `prototype-3d/README.md`。GPS 地圖已有固定私人 HTTPS 網站：https://taoyuan-gps-walk.ruru0109lee.chatgpt.site/?view=world，登入同一個 ChatGPT 帳號即可測試，不依賴本機電腦。記帳後端尚未公開部署，與固定 GPS 網站分開。

登入後首頁新增「看行情與待買清單」：使用目前帳號的採買歷史查看常買商品，現場價格與重量可帶回帳本，確認店家後才儲存。儲存成功會從同名待買項目移除；取消或失敗不移除。帳本與照片仍保存在伺服器；待買清單按帳號分開保存在目前瀏覽器，尚不跨裝置同步。行情保留實際交易日期，過期時不判斷目前零售價格。

這個入口讓 iPhone Safari 登入後記錄採買支出、筆記及照片。資料保存在後端電腦，不是只存在手機瀏覽器。不同帳號的資料分開；這一版需要連線才能讀寫，沒有離線記帳。

## 第一次安裝（Windows）

1. 安裝 Python 3.10 或更新版本，安裝時勾選加入 PATH。
2. 在本專案資料夾開啟終端機，執行 `python setup_backend.py`。第一次需要網路下載套件，會建立專案自己的 `.venv`。
3. 雙擊 `Start-Backend.cmd`，視窗會顯示電腦與手機可用的網址。這個捷徑明確使用 `--lan`，允許同一個區域網路的裝置連線。
4. 如只在電腦測試，執行 `.venv\Scripts\python.exe start_backend.py`，預設只有本機可連。

後端使用 Waitress；啟動會先套用資料庫更新。保持啟動視窗開著，按 Ctrl+C 停止。程式不會自動修改 Windows 防火牆。

## iPhone Safari

1. 電腦與 iPhone 連上同一個家用 Wi-Fi。
2. 在 Safari 輸入啟動視窗的 `http://192.168.…:8878/app/` 網址，註冊帳號並登入。
3. Safari 分享按鈕 →「加入主畫面」。日後可從主畫面開啟；仍需電腦後端啟動與網路連線。

本機 HTTP 是家用區網測試入口。離開家用 Wi-Fi 後無法連線；要在外面使用，需另行架設可公開連線的 HTTPS 伺服器。現在提供部署設定，尚未部署，也沒有購買任何服務。HTTP 的帳號與記帳內容沒有傳輸加密，請只在信任的私人網路測試；正式使用請使用 HTTPS。

## 連線問題

- 手機不能用 `localhost` 或 `127.0.0.1`；那是手機自己。使用電腦的 Wi-Fi IPv4 網址。
- 確认電腦沒有睡眠、啟動視窗仍開著，且不是訪客 Wi-Fi；訪客網路可能阻擋裝置互連。
- 先在電腦開啟顯示的區網網址。如果電腦能開、手機不能開，檢查 Windows 防火牆是否允許此 Python 程式在「私人網路」連入，並檢查路由器是否啟用裝置隔離。只針對需要的私人網路及此程式調整，不必關閉防火牆。
- Wi-Fi IP 可能改變。重新啟動後端後使用新網址；主畫面捷徑也要更新。
- 若出現 Host 驗證錯誤，可在終端機設定 `$env:DJANGO_ALLOWED_HOSTS='192.168.1.8,home.local'` 後啟動。填入實際電腦 IP 或名稱，不含協定、路徑或埠，不使用 `*`。
- 改埠：`.venv\Scripts\python.exe start_backend.py --lan --port 8879`。

## 私人資料與備份

預設資料目錄為 `private/backend/`，其中 `db.sqlite3` 保存帳號、支出筆記和照片，`secret.key` 是持續使用的本機密鑰。不要上傳 Git，也不要公開分享資料庫或備份。換電腦前先備份；把備份複製到另一個安全儲存裝置。

啟動器可用 `--data-dir` 指定其他私人目錄；也支援 `BACKEND_DATA_DIR` 環境變數。所有管理指令都透過啟動器執行，確保使用同一份資料與密鑰。

完整本機備份（檔名必须尚不存在）：

```powershell
.venv\Scripts\python.exe start_backend.py --manage backup_data --output private/backup-2026-10-08.zip
```

備份包含完整 SQLite 資料庫及現有照片目錄，保留所有帳號和照片；不包含 `secret.key`。如要原樣搬移本機環境，請另行安全複製 `secret.key`。恢復時若使用新密鑰，舊的登入 session 會失效，重新登入即可。

還原會取代全部帳號、筆記和照片。先停止後端、先備份目前資料，再只還原自己信任的完整備份：

```powershell
.venv\Scripts\python.exe start_backend.py --manage restore_data private/backup-2026-10-08.zip --confirm
.venv\Scripts\python.exe start_backend.py --check
```

手機介面的匯出／匯入是目前帳號的筆記交換功能，與此完整系統備份不同。登入密碼不會出現在手機匯出檔。

建立管理者：`.venv\Scripts\python.exe start_backend.py --manage createsuperuser`。忘記密碼時可用 `--manage changepassword 帳號名稱`，不要直接改資料庫。

行情頁優先使用私人資料目錄內的 `prices-data.json`；尚未更新時使用專案附帶的公開快照。可執行 `.venv\Scripts\python.exe start_backend.py --manage update_prices` 抓取並更新公開行情；加上 `--skip-fetch` 只重算现有來源，`--date YYYY-MM-DD` 指定分析日期。更新採暫存及原子發布，失敗保留上一份快照。更新後須確認快照日期；記帳金額是你實際輸入的金額，不會隨行情快照變動。

## 正式 HTTPS 部署設定（尚未部署）

`compose.backend.yml` 提供 PostgreSQL、Waitress 後端及 Caddy HTTPS。只公開 Caddy 的 80/443；資料庫及後端不直接公開。需要具備 Docker Compose 的伺服器、實際網域指向該伺服器，及允許 80/443 連入的網路。這些設定不會自行申請網域或付費主機。

1. 複製 `deploy/backend.env.example` 為 `deploy/backend.env`，填入實際 `BACKEND_DOMAIN`（僅網域名稱）。
2. 使用 `python -c "import secrets; print(secrets.token_urlsafe(64))"` 產生兩個不同的隨機值，分別作 `DJANGO_SECRET_KEY` 和 `POSTGRES_PASSWORD`。密碼只使用 URL-safe 字元；範例值不可正式使用。`backend.env` 不可提交 Git。
3. 先檢查設定，再由你選擇的伺服器執行：

```powershell
docker compose --env-file deploy/backend.env -f compose.backend.yml config --quiet
docker compose --env-file deploy/backend.env -f compose.backend.yml up -d --build
```

第一次啟動等待 PostgreSQL 健康後才執行 migrations；後端健康後 Caddy 才啟動。之後開啟 `https://你的網域/app/`。Caddy 自動取得及續期 HTTPS 憑證；DNS、外網埠及憑證驗證都要正確。

正式設定已關閉 debug、啟用 Secure cookie、CSRF 信任來源及明確 Host 驗證。Caddy 與 app 使用專用網路，Caddy 固定為 `172.30.88.10`；Waitress 只信任這個 IP 提供的客戶端位址及 HTTPS 協定。登入限流因此按真實客戶端 IP 計算，不把所有使用者當作 Caddy 一人；其他來源傳入的轉送標頭會被移除。資料庫使用另一個内部網路。如 `172.30.88.0/24` 與主機網路衝突，請在 `backend.env` 一起調整 `PROXY_SUBNET`、`CADDY_INTERNAL_IP`、`APP_INTERNAL_IP`，Caddy/app IP 必須屬於新子網且不同。`.dockerignore` 用允許清單排除本機私人筆記、密鑰、資料庫與憑證。容器以非 root 帳號執行。

容器內也可更新行情：`docker compose --env-file deploy/backend.env -f compose.backend.yml exec -T app python backend/manage.py update_prices`。更新來源與快照保存在 `BACKEND_DATA_DIR/prices-sources/`、`BACKEND_DATA_DIR/prices-data.json`，不必修改唯讀程式。容器包裝只有明確列出的公開行情來源及更新工具。

資料放在 Docker 持久 volume；重新建立容器不會刪除資料。不要執行 `down -v`，它會刪除 volume。正式服務更新前先做 PostgreSQL 備份，不能直接拿 SQLite 完整備份當作 PostgreSQL 匯入檔。

## PostgreSQL 備份與還原

照片保存於資料庫，因此 PostgreSQL 備份包含帳號、支出、筆記及照片。備份含私人資料。以下在專案資料夾執行；用容器檔案加 `docker cp`，避免 PowerShell 輸出重新編碼破壞二進位檔：

```powershell
docker compose --env-file deploy/backend.env -f compose.backend.yml exec -T db pg_dump -U ledger -d ledger -Fc -f /tmp/ledger.dump
docker compose --env-file deploy/backend.env -f compose.backend.yml cp db:/tmp/ledger.dump private/ledger.dump
```

還原前先備份現在的資料，並停止 app/Caddy。還原取代全部資料：

```powershell
docker compose --env-file deploy/backend.env -f compose.backend.yml stop caddy app
docker compose --env-file deploy/backend.env -f compose.backend.yml cp private/ledger.dump db:/tmp/ledger-restore.dump
docker compose --env-file deploy/backend.env -f compose.backend.yml exec -T db pg_restore -U ledger -d ledger --clean --if-exists --single-transaction /tmp/ledger-restore.dump
docker compose --env-file deploy/backend.env -f compose.backend.yml up -d
```

另行安全保存正式 `backend.env`，需要時才還原憑證與密鑰。此版本的實際記帳照片在資料庫；`ledger_media` volume 預留私人檔案目錄，若日後使用它，也應另行備份。

部署依據：[Django 5.2 部署檢查清單](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/)、[Caddy 自動 HTTPS](https://caddyserver.com/docs/automatic-https)。

手機帳號匯入介面目前限制 20 MiB，後端與代理的單次請求限制為 32 MiB（預留 JSON 編碼空間）。累積資料超過此限制時，請使用上面的完整伺服器備份，不要依賴一次手機匯入還原全部資料。

代理設定依據：[Waitress trusted proxy 官方參數](https://docs.pylonsproject.org/projects/waitress/en/stable/arguments.html)。
