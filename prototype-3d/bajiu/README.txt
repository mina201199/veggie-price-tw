八酒 3D 短腿圓肚 Q 版 v4

index.html：直接開啟即可旋轉，支援滾輪及雙指縮放，完全使用本機 Three.js。
bajiu.glb：3D 模型，包含雙臂刺青及牛仔布材質，可匯入 Blender、Three.js 或其他支援 glTF 的工具。
bajiu.blend：Blender 可編輯原檔，包含模型、攝影機與燈光。
preview.png、front.png、side.png、back.png：實際模型渲染圖。
reference.png：使用者提供的造型參考。
build_bajiu.py、textures.py：可重建模型與材質的原始腳本。

這是依照三視圖製作的程式建模造型原型，並非逐細節重建。
目前為靜態分件模型，尚未綁骨架、製作動畫或整理成可變形的人體拓樸。
刺青是重新繪製的龍／鯉魚風格圖案，並非完全複製參考圖。
已驗證 GLB 可重新匯入 Blender，三張材質嵌入成功；Edge 預覽載入及視角控制正常。


已替換菜市漫遊與人物圖鑑的 taike（八酒）入口。character.js 包裝 FigureKit.create；glb-data.js 內嵌相同 GLB，支援本機 HTML。
新版為靜態造型，原八酒走路動作尚未移植；移動時不會擺動四肢。
原有版本備份與驗證紀錄留在本機，不纳入此次提交。
