# GitHub Pages Setup Guide

Hướng dẫn deploy project lên GitHub Pages.

## Bước 1: Tạo Repository trên GitHub

1. Đăng nhập vào GitHub
2. Tạo repository mới (ví dụ: `sololevelin`)
3. **KHÔNG** tích vào "Initialize this repository with a README"

## Bước 2: Push code lên GitHub

```bash
cd SololevelinGit
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sololevelin.git
git push -u origin main
```

## Bước 3: Enable GitHub Pages

1. Vào repository trên GitHub
2. Click vào **Settings**
3. Scroll xuống phần **Pages**
4. Trong **Source**, chọn **Deploy from a branch**
5. Chọn branch **main** và folder **/ (root)**
6. Click **Save**

## Bước 4: Truy cập website

Sau vài phút, website sẽ có sẵn tại:
```
https://YOUR_USERNAME.github.io/sololevelin/
```

## Lưu ý

- **Firebase Configuration**: Đảm bảo Firebase config trong `Main.html` và `index.html` đã được cấu hình đúng
- **CORS**: Firebase sẽ tự động xử lý CORS cho GitHub Pages domain
- **HTTPS**: GitHub Pages tự động cung cấp HTTPS

## Cấu trúc file sau khi deploy

```
https://YOUR_USERNAME.github.io/sololevelin/
├── index.html              # Landing page
├── Main.html               # Dashboard
├── styles.css
└── Module/
    └── MyModule/
        └── *.js
```

## Troubleshooting

- **404 Error**: Đảm bảo file `index.html` nằm ở root của repository
- **Module not found**: Kiểm tra đường dẫn import trong HTML files (phải là relative path)
- **Firebase errors**: Kiểm tra Firebase config và đảm bảo domain GitHub Pages đã được thêm vào Firebase authorized domains


