# Project Specification: Headless Browser Manager (Self-hosted)

## 1. Project Overview

Hệ thống Browser Manager đóng vai trò như một môi trường thực thi và quản lý tập trung cho các kịch bản kiểm thử tự động hóa (Automation Test) chạy với cường độ song song (parallel) cao.

**Mục tiêu cốt lõi:**

* Chạy trình duyệt ngầm (headless) nhưng thực chất là chạy trong môi trường ảo hóa hiển thị (Xvfb) để tránh lỗi render và chống phát hiện bot.
* Cung cấp tính năng **Live View & Remote Debugging** thông qua giao diện Web (React.js) cho phép người dùng xem trực tiếp màn hình trình duyệt đang chạy và có thể tương tác chuột/phím.
* Quản lý **Profile Pooling**: Duy trì toàn vẹn dữ liệu trình duyệt (Cookies, LocalStorage, Cache) bằng cách ánh xạ thư mục vật lý `user-data-dir`, có cơ chế khóa (lock) để tránh đụng độ (concurrency conflict) giữa các thread.

## 2. Tech Stack

* **Môi trường triển khai:** Docker (chạy trên Windows 11 host).
* **Backend:** Node.js (TypeScript) + Express/NestJS.
* **Frontend:** React.js (Vite hoặc Next.js).
* **Database:** SQLite.
* **Automation Engine:** Playwright.
* **System Dependencies (Linux/Ubuntu):** `Xvfb`, `x11vnc`, `websockify`, `novnc`.

## 3. Directory Structure (Monorepo)

```text
browser-manager/
├── backend/                # API Controller, Process Manager, Playwright Launcher
│   ├── src/
│   ├── package.json
│   └── database.sqlite
├── frontend/               # Dashboard UI, Live View (noVNC Component)
│   ├── src/
│   ├── package.json
├── profiles_data/          # Mount volume chứa các thư mục profile vật lý
├── docker-compose.yml      # Định nghĩa các services
└── Dockerfile.backend      # Image tùy chỉnh cho Backend (cài sẵn Xvfb, VNC)

```

## 4. Database Schema (SQLite)

Quản lý trạng thái vòng đời của các Profile thông qua bảng `Profiles`.

| Column Name | Type | Description |
| --- | --- | --- |
| `id` | INTEGER (PK) | Auto increment. |
| `profile_name` | TEXT | Tên định danh (vd: `Profile_01`). |
| `folder_path` | TEXT | Đường dẫn vật lý tuyệt đối (vd: `/app/profiles_data/profile_01`). |
| `status` | TEXT | Trạng thái hiện tại: `IDLE`, `IN_USE`, `CORRUPT`. |
| `slot_id` | INTEGER | ID của slot cấp phát (dùng để tính Port), NULL nếu IDLE. |
| `ws_port` | INTEGER | Cổng WebSocket đang sử dụng để stream Live View. |
| `cdp_port` | INTEGER | Cổng Chrome DevTools Protocol cho test script connect. |
| `last_active` | DATETIME | Thời gian cập nhật cuối cùng (phục vụ cronjob dọn dẹp). |

## 5. System Architecture & Workflow

### 5.1. Port Allocation Strategy

Hệ thống cấp phát cổng động dựa trên biến `slot_id` (từ 1 đến N).

* **Display ID (Xvfb):** `:${99 + slot_id}` (VD: `:100`)
* **VNC Port:** `5900 + slot_id` (VD: `5901`)
* **WebSocket Port (noVNC):** `6000 + slot_id` (VD: `6001`)
* **CDP Port (Playwright Remote):** `9222 + slot_id` (VD: `9223`)

### 5.2. Core Initialization Flow (Backend)

Khi nhận request cấp phát browser:

1. **Query DB:** Tìm 1 row có `status = 'IDLE'`. Update thành `IN_USE`, gán `slot_id`.
2. **Khởi tạo Xvfb:** `Xvfb :100 -screen 0 1920x1080x24`
3. **Khởi tạo VNC:** `x11vnc -display :100 -nopw -listen localhost -xkb -forever -shared -rfbport 5901`
4. **Khởi tạo Websockify:** `websockify 6001 localhost:5901`
5. **Khởi chạy Playwright:**
* Gọi `chromium.launchPersistentContext(folder_path, options)`.
* **Bắt buộc:** Tham số `headless: false`.
* **Bắt buộc:** Biến môi trường `env: { DISPLAY: ':100' }`.
* **Bắt buộc:** Argument `--remote-debugging-port=9223`.


6. Lưu mảng PIDs (Tiến trình của Xvfb, VNC, Websockify, Browser) vào bộ nhớ (RAM) để dọn dẹp sau này.
7. Trả về JSON chứa thông tin kết nối (CDP Endpoint & WebSocket URL) cho Client.

### 5.3. Process Management & Cleanup

* **Sổ đăng ký tiến trình (Registry):** Map `slot_id` với danh sách PIDs.
* **Giải phóng (Release):** Khi client gọi API trả browser, Backend phải dùng `kill -9` để hủy toàn bộ chùm tiến trình liên quan đến `slot_id` đó và update DB `status = 'IDLE'`.
* **Zombie Killer (Cronjob):** Quét định kỳ (5 phút/lần). Nếu profile có `status = 'IN_USE'` vượt quá thời gian timeout quy định, force kill processes và reset status.

## 6. Frontend Requirements

* **Dashboard:** Hiển thị danh sách Profiles kèm trạng thái thực.
* **Live View Component:** Khi click vào một Profile đang `IN_USE`, sử dụng thư viện `@novnc/novnc` kết nối tới `ws://<server_ip>:<ws_port>` để render màn hình Browser lên Canvas. Tự động scale viewport phù hợp.

## 7. Docker Configuration Rules

* **Backend Image:** Kế thừa từ `[mcr.microsoft.com/playwright:v1.40.0-jammy](https://mcr.microsoft.com/playwright:v1.40.0-jammy)`. Cài thêm các package hệ thống: `xvfb`, `x11vnc`, `novnc`, `websockify`, `sqlite3`.
* **Volumes:** Map thư mục `./profiles_data` từ Windows Host vào `/app/profiles_data` trong container. Map file `./backend/database.sqlite`.
* **Ports:** Expose cổng API (vd: `3000`) và expose toàn bộ dải cổng cho WebSocket Live View (vd: `6000-6050`) và CDP (vd: `9222-9272`).

## 8. REST API Definitions

1. `GET /api/profiles`: Lấy danh sách toàn bộ profile và trạng thái.
2. `POST /api/browser/allocate`: Yêu cầu cấp phát 1 browser.
* *Response:* `{ ws_url, cdp_endpoint, profile_id, slot_id }`


3. `POST /api/browser/release`: Trả lại browser. Cần truyền `profile_id` hoặc `slot_id`. Dọn dẹp tiến trình.