# 🔬 FWF Open Science Monitor

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

🌍 Ngôn ngữ:  
🇬🇧 [English](README.md) | 🇫🇷 [Français](README.fr.md) | 🇩🇪 [Deutsch](README.de.md) | 🇻🇳 Tiếng Việt

Một bảng điều khiển full-stack theo dõi tuân thủ open science trên hàng nghìn dự án nghiên cứu được tài trợ bởi [FWF](https://www.fwf.ac.at/en/).

---

## 🏛️ Nguồn gốc và Tác giả
Repository này được tạo và duy trì bởi **Quoc-Tan Tran**, Nhà nghiên cứu Open Science tại **Khoa Xã hội học, Đại học Bielefeld**, với sự hỗ trợ kỹ thuật từ **Claude AI**.

Nó được thiết kế để phục vụ như một cơ sở hạ tầng nghiên cứu có thể tái tạo, cho thấy cách các pipeline tự động và công nghệ web hiện đại có thể cải thiện tính minh bạch trong tài trợ nghiên cứu và các output khoa học.

---

## ⚡ Tầm nhìn
Monitor này lấp đầy khoảng trống giữa dữ liệu tài trợ thô và những insight có thể hành động. Nó trực quan hóa tỷ lệ truy cập mở, xu hướng output và bảng xếp hạng tổ chức để hỗ trợ chuyển dịch toàn cầu hướng tới khoa học mở và có thể tái tạo.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard  │  Projects  │  Institutions  │  Explore  │  Export      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 1,500    │  │ 12,000   │  │ 80       │  │ 67.5%    │            │
│  │ Projects │  │ Outputs  │  │ Instits  │  │ OA Rate  │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  OA Rate Over Time          Projects by Year                         │
│  ┌──────────────────────┐   ┌──────────────────────┐                 │
│  │  ▁▂▃▄▅▆▇█           │   │  ▂▃▄▅▄▆▇█▇▆          │                 │
│  └──────────────────────┘   └──────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────┘
```

## ✨ Tính năng Chính

- **📊 Bảng điều khiển Sáu Trục** — Các chỉ số chính (tỷ lệ OA, hiệu quả tài trợ) với trực quan hóa tương tác Recharts.
- **🔍 Trình khám phá Chi tiết** — 10 chế độ phân tích độc đáo bao gồm tìm kiếm nhà nghiên cứu, phân tích xuất bản và scatter plots tài trợ.
- **⚡ ETL Hiệu suất Cao** — Pipeline Python 3.12 đồng bộ hàng ngày, làm sạch và tính toán các chỉ số từ API FWF Open Research.
- **🚀 Sẵn sàng Sản xuất** — Cache LRU trong bộ nhớ (TTL 5 phút), an toàn kiểu đầy đủ với Prisma, và chế độ tối nhận biết hệ thống.
- **📦 Thiết lập Một Lệnh** — Môi trường hoàn toàn containerized cho phát triển và thử nghiệm cục bộ tức thì.

---

## 🚀 Khởi động Nhanh (Localhost)

### Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài đặt và đang chạy
- [Node.js](https://nodejs.org/) v20+
- [Python 3](https://www.python.org/) (chỉ cần cho pipeline ETL)
- [Git](https://git-scm.com/)

### 1. Sao chép và Cấu hình

```bash
git clone https://github.com/qtan-tran/fwf-open-science-monitor.git
cd fwf-open-science-monitor
```

Sao chép file môi trường mẫu:

- **macOS / Linux:** `cp .env.example .env`
- **Windows (PowerShell):** `Copy-Item .env.example .env`

Chỉnh sửa `.env` và thêm khóa API FWF của bạn (lấy từ https://openapi.fwf.ac.at/fwfkey):

```
FWF_API_KEY=khóa_của_bạn_ở_đây
```

> **Lưu ý:** Khóa API chỉ cần để chạy pipeline ETL. Bạn có thể duyệt bảng điều khiển mà không có nó (nó sẽ hiển thị biểu đồ trống cho đến khi dữ liệu được tải).

### 2. Khởi động Cơ sở Dữ liệu

```bash
docker compose up db -d
```

Chờ vài giây để PostgreSQL sẵn sàng.

### 3. Cài đặt Phụ thuộc và Thiết lập Schema

```bash
cd apps/web
npm install
npx prisma generate
npx prisma db push
cd ../..
```

### 4. Khởi động App

```bash
cd apps/web
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

> **💡 Mẹo:** Cơ sở dữ liệu khởi động trống. Để xem dữ liệu thực, chạy pipeline ETL (xem [Hướng dẫn ETL](#-hướng-dẫn-etl) bên dưới) để đồng bộ dữ liệu trực tiếp từ API FWF, hoặc tải một `seed/seed.sql` đã xây dựng sẵn nếu có (xem [Tải Dữ liệu Seed](#tải-dữ-liệu-seed) bên dưới).

---

## Tải Dữ liệu Seed

Một file `seed/seed.sql` không được bao gồm trong repository — nó được tạo bằng cách chạy pipeline ETL ít nhất một lần. Sau khi ETL chạy, bạn có thể xuất một snapshot để tải nhanh hơn trong tương lai:

```bash
# Xuất snapshot seed (macOS/Linux):
docker compose exec db pg_dump -U postgres fwf_monitor > seed/seed.sql

# Xuất snapshot seed (Windows PowerShell):
docker exec (docker compose ps -q db) pg_dump -U postgres fwf_monitor | Out-File -Encoding utf8 seed/seed.sql
```

Một khi bạn có `seed/seed.sql`, tải nó với:

**macOS / Linux (script tiện lợi — xử lý cả hai đường dẫn tự động):**
```bash
./seed/load_seed.sh
```

**macOS / Linux (thủ công, với psql cài đặt cục bộ):**
```bash
psql "$DATABASE_URL" -f seed/seed.sql
```

**macOS / Linux (qua Docker, không cần psql cục bộ):**
```bash
docker compose exec -T db psql -U postgres -d fwf_monitor < seed/seed.sql
```

**Windows (PowerShell, qua Docker):**
```powershell
Get-Content seed/seed.sql | docker exec -i (docker compose ps -q db) psql -U postgres -d fwf_monitor
```

**Hoặc sử dụng bất kỳ GUI cơ sở dữ liệu nào** (pgAdmin, DBeaver, DataGrip): kết nối tới `localhost:5432`, người dùng `postgres`, mật khẩu `postgres`, cơ sở dữ liệu `fwf_monitor`, và chạy nội dung của `seed/seed.sql`.

---

## 🛠 Ngăn xếp Công nghệ

| Lớp | Công nghệ | Tại sao? |
|------|-----------|------|
| **Frontend** | **Next.js 16 (App Router)** | Hiệu suất hàng đầu và SEO cho bảng điều khiển. |
| **Styling** | **Tailwind CSS 4** | Thiết kế utility-first cho UI sạch và hiện đại. |
| **Backend** | **PostgreSQL + Prisma** | Dữ liệu quan hệ mạnh mẽ với ORM an toàn kiểu. |
| **Pipeline** | **Python 3.12 + Pytest** | Xử lý dữ liệu nhanh với 240+ unit tests cho độ tin cậy. |
| **CI / CD** | **GitHub Actions** | Linting tự động, kiểm tra kiểu và lập lịch ETL hàng ngày. |

---

## 📂 Kiến trúc Dự án

```text
fwf-open-science-monitor/
├── apps/web/           # Frontend Next.js 16
│   ├── prisma/         #   Schema cơ sở dữ liệu (schema.prisma)
│   ├── src/app/        #   App Router: trang + routes API
│   └── components/     #   Các component UI và biểu đồ có thể tái sử dụng
├── etl/                # Pipeline dữ liệu Python
│   ├── src/            #   Orchestrator, Cleaner & tính toán metrics
│   └── tests/          #   Suite pytest toàn diện
├── .github/workflows/  # Pipelines CI + lập lịch ETL hàng ngày
└── docker-compose.yml  # Orchestration cục bộ
```

---

## 🔄 Hướng dẫn ETL

Pipeline ETL lấy dữ liệu từ API FWF Open Research, làm sạch và điền vào cơ sở dữ liệu PostgreSQL.

### Yêu cầu

1. **Lấy Khóa API:** Lấy khóa miễn phí tại https://openapi.fwf.ac.at/fwfkey
2. **Cấu hình:** Mở `.env` của bạn và đặt `FWF_API_KEY=khóa_của_bạn_ở_đây`
3. **Cơ sở dữ liệu đang chạy và schema đã áp dụng** (xem các bước Khởi động Nhanh 2–3 ở trên)

### Tùy chọn A: Chạy qua Docker (không cần thiết lập Python)

```bash
docker compose run --rm etl
```

### Tùy chọn B: Chạy tự nhiên (lặp lại nhanh hơn, không cần build Docker)

**macOS / Linux:**
```bash
cd etl
pip install -r requirements.txt
python -m src.pipeline
```

**Windows (PowerShell):**
```powershell
cd etl
pip install -r requirements.txt   # sử dụng --user nếu cài đặt toàn cục bị chặn
python -m src.pipeline
```

> **Mẹo:** Sau khi ETL hoàn thành, xuất snapshot `seed/seed.sql` để tải nhanh hơn trong tương lai (xem [Tải Dữ liệu Seed](#tải-dữ-liệu-seed) ở trên).

---

## 🤝 Đóng góp

Đóng góp được chào đón! Nếu bạn muốn cải thiện biểu đồ, thêm chế độ "Explore" mới, hoặc sửa lỗi:

1. **Fork** repository  
2. **Tạo** nhánh tính năng của bạn:
   ```bash
   git checkout -b feature/TinhNangTuyetVoi
   ```
3. **Commit** thay đổi của bạn bằng [Conventional Commits](https://www.conventionalcommits.org/)  
4. **Push** tới nhánh và mở Pull Request  

---

## 📜 Giấy phép và Ghi nhận Dữ liệu

- **Code:** Phát hành dưới **Giấy phép MIT**  
- **Nguồn Dữ liệu:** https://openapi.fwf.ac.at — Dữ liệu được cung cấp bởi Quỹ Khoa học Áo (FWF) dưới CC0  
- **Mã định danh:** Dữ liệu tổ chức được hỗ trợ bởi https://ror.org và https://orcid.org  

---

**Xây dựng với ❤️ cho Open Science.**  
*Nếu bạn thấy dự án này hữu ích, hãy nghĩ đến việc cho nó một ⭐ để giúp người khác tìm thấy nó!*