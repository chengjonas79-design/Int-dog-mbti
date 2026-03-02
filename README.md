# 萌宠联萌 · 毛孩子MBTI性格测试

20 题 · 2 分钟，测测你家毛孩子的 MBTI 性格类型，生成专属分享海报。

## 项目结构

```
├── index.html          # 首页（猫/狗选择入口）
├── dashboard.html      # 数据看板（密码保护）
├── dog/                # 狗狗MBTI测试
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── touxiang.png.jpg
│   └── wecom_qr.png
├── cat/                # 猫咪MBTI测试
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── touxiang.png.jpg
│   └── wecom_qr.png
└── docs/               # 内容参考文档
    └── cat-mbti-content.md
```

## 技术栈

- 纯 HTML / CSS / JS（无构建步骤）
- 腾讯云开发 CloudBase（匿名登录 + 云数据库埋点）
- html2canvas（海报生成，懒加载）
- 部署：腾讯 CloudBase 静态托管

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/
```

## 线上地址

- 首页：https://www.mclmpet.com/
- 狗狗测试：https://www.mclmpet.com/dog/
- 猫咪测试：https://www.mclmpet.com/cat/
