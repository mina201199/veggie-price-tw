# 政府行情快照更新

此 Sites 僅公開 dist/index.html 與 dist/prices-data.json；原始碼倉庫保存公開政府歷史資料及計算工具。不得加入私人筆記、照片、帳號、GPS、憑證或本機 private 目錄。

每次更新先以 Sites 的來源 helper 開啟此站最新來源，在該 checkout 執行：

```sh
python update_prices.py
python -m unittest discover -s tools
python -m unittest test_update_prices test_fetch_failures
```

程式抓最近 10 天農業部資料，重算往年同期與零售參考，再以原子替換發布候選 JSON。批發抓取、重算或驗證失敗時不要發布，保留線上原快照；零售來源暫時失敗沿用上一份月行情。必須保留交易日、產生時間與過期規則。

成功後只透過 Sites 官方 source helper 保存／推送／打包，部署此站的新版本並確認 succeeded。公開網址的 prices-data.json 應與 candidate 的 latest、generatedAt、品項數相符。維持本網站 public，私人採買 App 的 audience 不變。不修改 GitHub Pages 設定。

Windows 封裝若遇 Bash 路徑問題，使用官方 package-site.sh 並將參數轉為 Git Bash 的 /c/... 路徑；不重寫 packaging validation。不得把 deploy URL 存在當作本次更新已成功。
