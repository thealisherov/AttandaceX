# Face ID & Geo-Attendance Web App — Texnik Spesifikatsiya

**Versiya:** 1.2
**Sana:** 2026-yil iyul
**Stack:** Next.js (frontend + backend/API Routes) + Supabase (Database, Auth, Storage, Edge Functions) + Telegram Bot API + Yandex Maps (to'liq stack uchun 9-bo'limga qarang)
**Foydalanuvchilar hajmi:** 50–60 xodim
**Rollar:** Super Admin, Admin, User (Xodim)

---

## 1. Umumiy tuzilma

Tizim ikkita asosiy interfeysdan iborat:

| Interfeys | Foydalanuvchi | Qurilma |
|---|---|---|
| **Employee App** | Oddiy xodim (User) | Mobil brauzer / PWA |
| **Admin Dashboard** | Super Admin va Admin (Rahbar/HR) | Desktop brauzer |

> **Muhim farq:** **Face ID orqali yo'qlama (Check-in/Check-out) faqat User rolidagi xodimlar uchun mo'ljallangan.** Super Admin va Admin akkauntlari yo'qlama tizimida ishtirok etmaydi — ular Face ID skanerlash yoki GPS-check-in jarayonidan umuman o'tmaydi, faqat **Admin Dashboard** orqali boshqaruv funksiyalarini bajaradi (xodimlar, jadval, jarima, filiallarni nazorat qilish).

---

## 2. Ro'yxatdan o'tish — Telegram Bot orqali

Xodimlar tizimga login/parol bilan emas, **Telegram bot orqali** ro'yxatdan o'tadi.

### 2.1 Oqim (Flow)

Telegram bot **menyu tugmalari (Reply Keyboard)** orqali boshqariladi — xodim erkin matn yozishi shart emas:

1. Xodim Telegram botga `/start` yuboradi.
2. Bot xush kelibsiz xabarini va **2 ta menyu tugmasini** ko'rsatadi:
   - 📱 **"Kontaktni ulashish"** (Share Contact)
   - 🔑 **"Kod olish"** (Get Code)
3. Xodim **"Kontaktni ulashish"** tugmasini bosadi → Telegram orqali telefon raqami avtomatik yuboriladi va bazaga saqlanadi.
4. Kontaktini ulashgach, xodim **"Kod olish"** tugmasini bosadi:
   - Bot xodimning **Telegram username**ini avtomatik oladi (agar mavjud bo'lsa)
   - Bot **bir martalik OTP kod** generatsiya qilib, chatga yuboradi (masalan: `48291`, 5 daqiqa amal qiladi)
5. Xodim web app'ni ochib, OTP kodni kiritadi.
6. Tizim OTP'ni tasdiqlagach, yangi akkaunt yaratadi:
   - **Ism, Familiya** — Telegramdagi profil ma'lumotlaridan olinadi
   - **Username** — Telegramdagi username
   - **Telefon raqami** — contact orqali olingan
   - **Telegram Chat ID** — bildirishnomalar yuborish uchun saqlanadi
7. Xodim keyin ilk marta Face ID (yuzni skanerlash) jarayonidan o'tadi (enrollment).
8. Admin keyinchalik shu xodimga **Branch(lar)** va **Ish jadvali (schedule)** biriktiradi.

> **Kodni qayta olish:** Agar OTP muddati tugasa yoki web app'da kiritishga ulgurmasa, xodim botdagi **"Kod olish"** tugmasini qayta bosishi kifoya — yangi 5 daqiqalik kod generatsiya qilinadi va eskisi avtomatik bekor qilinadi.

> **Eslatma:** Admin va Super Admin akkauntlari Telegram orqali ro'yxatdan o'tmaydi. Super Admin akkaunti tizim ishga tushirilganda **kod orqali to'g'ridan-to'g'ri database'ga** (Supabase) yoziladi — bu unikal, "root" darajadagi akkaunt. Oddiy Admin akkauntlarini esa **Super Admin Dashboard orqali** yaratadi va ularga qaysi Branch(lar)ga tegishli ekanligini belgilaydi.

### 2.2 Texnik implementatsiya — Parolsiz autentifikatsiya (Supabase Auth orqali)

Yuqoridagi oqim quyidagi texnik mexanizm bilan amalga oshiriladi — **xodim uchun hech qanday parol yaratilmaydi**, faqat Telegram orqali OTP bilan tizimga kiradi:

**Asosiy tamoyillar:**
- **Identifikator sifatida faqat `telegram_id`** ishlatiladi (Telegramning o'zgarmas `message.from.id` qiymati) — email yoki telefon hech qachon asosiy identifikator bo'lmaydi
- Supabase Auth (`auth.users`) faqat email/telefon/OAuth orqali user yaratishni qo'llab-quvvatlagani uchun, har bir xodimga **ichki texnik email** (`tg_<telegram_id>@auth.internal`) avtomatik biriktiriladi. Bu email foydalanuvchiga hech qachon ko'rsatilmaydi va login sifatida ishlatilmaydi — faqat Supabase ichidagi texnik identifikator
- Login **`generateLink({ type: 'magiclink' })` + `verifyOtp({ type: 'magiclink', token_hash })`** zanjiri orqali amalga oshiriladi — foydalanuvchiga faqat tayyor `access_token`/`refresh_token` qaytariladi, parol umuman qatnashmaydi
- OTP tekshiruvi **to'liq serverda** (`service_role` kaliti bilan) bo'ladi — `telegram_auth_sessions` jadvaliga client (`anon` key) RLS orqali umuman kira olmaydi

**Arxitektura oqimi:**

```
Xodim → Telegram Bot → Next.js Backend (/api/telegram-webhook) → Supabase
  │            │                    │                              │
  │─ /start ──▶│                    │                              │
  │◀─ tugmalar │                    │                              │
  │─ contact ─▶│──POST webhook────▶│──user yaratish/topish──────▶│
  │            │                    │──OTP saqlash (telegram_auth_sessions)─▶│
  │◀─ "Kod: 48291" ──────────────────────────────────────────────│
  │
  │─ OTP kiritish (web app) ────────▶ /api/telegram/verify-otp ──▶ OTP tekshirish
  │                                                                  ──▶ magiclink generatsiya
  │                                                                  ──▶ verifyOtp → access/refresh token
  │◀────────────────────── access_token + refresh_token ──────────│
  │─ supabase.auth.setSession() ─────────────────────────────────▶│  (session o'rnatiladi)
```

**Xavfsizlik xulosasi:**

| Nima | Holati |
|---|---|
| Parol generatsiya | ❌ Umuman yo'q |
| Client → `telegram_auth_sessions` to'g'ridan-to'g'ri o'qish | ❌ RLS bilan butunlay yopiq |
| Ichki texnik `email` clientga chiqishi | ❌ Hech qachon |
| OTP muddati | ✅ 5-10 daqiqa (sozlanuvchan) |
| Telegram contact egasi tekshiruvi | ✅ `contact.user_id === message.from.id` tekshiriladi (boshqa birovning kontaktini yubormasligi uchun) |
| Identifikator | ✅ `telegram_id` (o'zgarmas, doimiy) |
| OTP bir martalik | ✅ Verify bo'lgach sessiya darhol bazadan o'chiriladi |

---

## 3. Employee App (Xodim paneli)

### 3.1 Asosiy ekran
- Katta soat (server vaqti bo'yicha)
- **"CHECK IN"** va **"CHECK OUT"** tugmalari
- Bugungi jadval ko'rsatiladi (masalan: "Bugun siz 08:00–18:00 orasida ishlaysiz")

### 3.2 Check-in / Check-out jarayoni
1. **Server vaqti** olinadi (telefon vaqtiga ishonilmaydi)
2. **Geolokatsiya tekshiruvi** — xodim o'sha kun uchun biriktirilgan **Branch**ning koordinatalaridan belgilangan radiusda ekanligi tekshiriladi
3. Radius ichida bo'lsa → kamera ochiladi, **Face ID verifikatsiya** + **Liveness detection** ishga tushadi
4. Muvaffaqiyatli bo'lsa → check-in/check-out vaqti bazaga yoziladi, ekranda tasdiq (✓) chiqadi
5. Muvaffaqiyatsiz bo'lsa (yuz mos kelmasa yoki geolokatsiya noto'g'ri) → rad etiladi, Adminga xavfsizlik ogohlantirishi yuboriladi

### 3.3 "Kelmadi" (Absent) statusi — qoida

Agar xodim o'sha kungi ish jadvalida belgilangan **kelish vaqtidan boshlab, kun oxirigacha** (yoki Admin sozlagan chegara vaqtigacha) Check-in qilmasa, tizim shu xodim uchun o'sha kunga avtomatik **"Kelmadi" (Absent)** statusini yozadi:

- Bu status kunlik `attendance` yozuvida avtomatik shakllantiriladi (fon jarayoni — cron/scheduled job orqali kun oxirida yoki belgilangan vaqtda tekshiriladi)
- "Kelmadi" statusi uchun ham jarima qo'llanilishi mumkin — bu Admin sozlagan **Jarima siyosati**ning eng yuqori bosqichi sifatida belgilanadi (pastda 4.6-bo'limga qarang)
- Agar o'sha kun uchun Admin oldindan **"Dam olish kuni"** deb belgilagan bo'lsa, "Kelmadi" statusi yozilmaydi (4.5-bo'limga qarang)

### 3.4 "Mening profilim" bo'limi (xodimning o'ziga ko'rinadigan)
- Shaxsiy ma'lumotlar, biriktirilgan Branch
- Joriy oy uchun ish jadvali
- **Jarimalar tarixi** — har bir jarima sanasi, sababi, summasi bilan
- **Kechikishlar tarixi**
- Umumiy statistikasi: necha kun keldi, necha marta kechikdi, joriy oy jarima summasi

---

## 4. Admin Dashboard (Desktop)

> **Ko'lam bo'yicha eslatma:** Quyidagi bo'limlar **Super Admin** uchun barcha filiallar bo'yicha to'liq ko'rinishda ishlaydi. Oddiy **Admin** uchun esa xuddi shu funksiyalar, lekin faqat o'ziga biriktirilgan Branch(lar) doirasida ishlaydi (masalan, boshqa filial xodimlarini ko'ra olmaydi, ularning jadvali/jarimasiga tegina olmaydi).

### 4.1 Bosh sahifa (Dashboard)
- Bugungi real-time statistika: jami xodim, kelganlar, kechikkanlar, kelmaganlar soni
- "Hozir ishda" bo'lgan xodimlar ro'yxati (rasmlari bilan)
- Xavfsizlik ogohlantirishlari (yuz mos kelmagan urinishlar, GPS radiusdan tashqarida bo'lgan urinishlar)

### 4.2 Xodimlar boshqaruvi (Employees)
- Barcha xodimlar ro'yxati, filial bo'yicha filtrlash
- Har bir xodimning **Details** sahifasi:
  - Shaxsiy ma'lumotlar, Telegram ma'lumotlari
  - Biriktirilgan Branch
  - Ish jadvali (schedule)
  - **Jarimalar tarixi** (sana, sabab, summa, status — to'langan/bekor qilingan)
  - Kechikish/davomat statistikasi
  - Face ID ma'lumotlarini qayta yangilash imkoniyati

### 4.3 Branches (Filiallar)
- Yangi filial qo'shish: nomi, manzili, xaritadan koordinatalari, ruxsat etilgan radius (metrda)
- **Xodim bir nechta filialga biriktirilishi mumkin** — qaysi kunlari qaysi filialda ishlashi to'g'ridan-to'g'ri uning **ish jadvalida (Schedule)** belgilanadi (4.4-bo'limga qarang). Masalan, bitta o'qituvchi toq kunlari 1-filialda, juft kunlari 2-filialda ishlashi mumkin.
- Filial bo'yicha alohida statistikani ko'rish

### 4.4 Ish jadvali (Schedule) — Admin tomonidan shakllantiriladi

Har bir xodim uchun **individual haftalik jadval** tuziladi. Har bir hafta kuni uchun alohida vaqt oralig'i **va alohida Branch** belgilanadi (yoki "dam olish kuni" deb belgilanadi).

**Misol 1 — John Doe (bitta filialda ishlaydi):**

| Kun | Filial | Kelish vaqti | Ketish vaqti |
|---|---|---|---|
| Dushanba | Filial 1 | 08:00 | 18:00 |
| Seshanba | Filial 1 | 14:00 | 18:00 |
| Chorshanba | Filial 1 | 08:00 | 18:00 |
| Payshanba | Filial 1 | 14:00 | 18:00 |
| Juma | Filial 1 | 08:00 | 18:00 |
| Shanba | Filial 1 | 14:00 | 18:00 |
| Yakshanba | — | Dam olish | — |

**Misol 2 — Matematika o'qituvchisi (bir necha filialda ishlaydi):**

| Kun | Filial | Kelish vaqti | Ketish vaqti |
|---|---|---|---|
| Dushanba | Filial 1 | 09:00 | 14:00 |
| Seshanba | Filial 2 | 10:00 | 15:00 |
| Chorshanba | Filial 1 | 09:00 | 14:00 |
| Payshanba | Filial 2 | 10:00 | 15:00 |
| Juma | Filial 1 | 09:00 | 14:00 |
| Shanba | — | Dam olish | — |
| Yakshanba | — | Dam olish | — |

- Bu jadval **haftalik shablon** sifatida saqlanadi va avtomatik takrorlanadi
- Har bir kun uchun jadvalda belgilangan **Branch** shu kungi Check-in/Check-out uchun GPS-radius tekshiruvida ishlatiladi — ya'ni tizim xodimning "asosiy filiali"ga emas, **o'sha kun uchun jadvalda ko'rsatilgan filialga** nisbatan joylashuvni tekshiradi
- Kechikish shu kunning belgilangan kelish vaqtiga nisbatan hisoblanadi (masalan seshanba kuni 10:05 da kelsa — 5 daqiqa kechikish)

### 4.5 Kunlik istisnolar (Day-off / Overrides)

Admin istalgan xodimga **istalgan kun uchun** alohida o'zgartirish kiritishi mumkin:

- **Dam olish kuni berish** — masalan, odatda ish kuni bo'lgan kunni "bugun dam olasiz" deb belgilash → o'sha kun uchun check-in talab qilinmaydi va "kelmadi" statusi yozilmaydi
- Bu o'zgartirish faqat belgilangan sanaga tegishli, umumiy haftalik jadvalga ta'sir qilmaydi

### 4.6 Jarima siyosati (Fine Policy) — Vaqt oralig'iga asoslangan bosqichlar

Admin (yoki Super Admin) sozlamalar bo'limida bosqichma-bosqich jarima jadvalini belgilaydi. **Bosqichlar soni, vaqt oralig'i chegaralari va summalar to'liq sozlanuvchan** — Admin xohlagancha bosqich qo'shishi, o'chirishi yoki summalarni o'zgartirishi mumkin.

**Misol (namuna sifatida, real summalar Admin tomonidan sozlanadi):**

| Kechikish vaqti | Jarima summasi |
|---|---|
| 1–10 daqiqa | 50 000 so'm |
| 10–30 daqiqa | Admin belgilagan summa |
| 30–50 daqiqa | Admin belgilagan summa |
| 50+ daqiqa / kelmagan | Admin belgilagan eng yuqori summa |

- Bu bosqichlar **filial darajasida** ham farqlanishi mumkin (Super Admin uchun har bir filial o'z jarima jadvaliga ega bo'lishi mumkin, oddiy Admin esa faqat o'z filiali uchun sozlaydi)
- Jarima check-in vaqtida **avtomatik hisoblanadi va yoziladi**
- "Kelmadi" (Absent) statusi uchun ham eng yuqori bosqich jarima sifatida qo'llaniladi (3.3-bo'limga qarang)

### 4.7 Jarimani bekor qilish (Admin vakolati)

- Admin istalgan xodimning istalgan jarimasini **bekor qilishi (olib tashlashi)** mumkin
- Masalan: xodim sababli kechikkan bo'lsa, Adminga murojaat qiladi, Admin dashboardda o'sha jarima yozuvini topib "Bekor qilish" tugmasini bosadi
- Bekor qilingan jarima tarixda saqlanadi, lekin holati **"Bekor qilindi"** deb belgilanadi (umumiy hisobotdan chiqarib tashlanmaydi, shaffoflik uchun)
- Har bir bekor qilish uchun izoh (comment) kiritish imkoniyati bo'lishi tavsiya etiladi

### 4.8 Adminlarni boshqarish (faqat Super Admin)

- Super Admin yangi **Admin** akkaunt yaratadi va unga bitta yoki bir nechta **Branch** biriktiradi
- Super Admin istalgan Adminning biriktirilgan filiallarini keyinchalik o'zgartirishi yoki akkauntni bloklashi/o'chirishi mumkin
- Oddiy Admin boshqa Admin akkauntlarini yarata olmaydi va ko'ra olmaydi

### 4.9 Oylik maosh (Payroll) — Tizim doirasidan tashqarida

> ⚠️ **Muhim chegara:** Ushbu tizim **oylik maoshni hisoblamaydi va to'lamaydi**. Oylik maosh hisob-kitobi **boshqa, alohida CRM tizimida** amalga oshiriladi. Ushbu Face ID & Geo-Attendance tizimining vazifasi faqat:
> - Davomatni qayd qilish (kelgan/kechikkan/kelmagan)
> - Kechikish/kelmaslik uchun **jarima summalarini hisoblash va saqlash**
>
> Jarima ma'lumotlari (xodim, sana, summa) keyinchalik **Excel/CSV export** yoki (agar kelajakda kerak bo'lsa) **API orqali tashqi CRM tizimiga** uzatilishi mumkin — bu integratsiya keyingi bosqichda alohida ko'rib chiqiladi.

---

## 5. Telegram bot orqali bildirishnomalar

Xodimning shaxsiy Telegram chatiga quyidagi holatlarda avtomatik xabar yuboriladi:

| Holat | Xabar namunasi |
|---|---|
| Muvaffaqiyatli Check-in | "✅ Siz 08:02 da ishga keldingiz. Yaxshi kun tilaymiz!" |
| Muvaffaqiyatli Check-out | "👋 Siz 18:05 da ishdan ketdingiz." |
| Kechikish + jarima | "⚠️ Siz bugun 15 daqiqa kechikdingiz. Jarima: 50 000 so'm" |
| Jarima bekor qilindi | "ℹ️ Sizning [sana] kungi jarimangiz Admin tomonidan bekor qilindi." |
| Dam olish kuni berildi | "🎉 Sizga [sana] kuni dam olish kuni berildi." |
| Xavfsizlik ogohlantirishi (Adminga) | "🚨 [Xodim ismi] akkauntidan begona shaxs Check-in qilishga urindi." |

---

## 6. Ma'lumotlar bazasi tuzilmasi (Supabase — asosiy jadvallar)

- `employees` — id, ism, familiya, telegram_username, telegram_chat_id, telefon, face_embedding, rol (`super_admin` / `admin` / `user`) — **eslatma:** xodimda yagona `branch_id` maydoni yo'q, chunki xodim bir necha filialda ishlashi mumkin; filial biriktiruvi `schedules` jadvali orqali kun-kun asosida amalga oshiriladi
- `admin_branches` — id, admin_id, branch_id — bitta Adminning bir nechta filialga biriktirilishini ta'minlovchi bog'lovchi jadval (Super Admin uchun bu jadval kerak emas, chunki barcha filiallarga kirish huquqi mavjud)
- `branches` — id, nomi, manzil, latitude, longitude, radius_metr
- `schedules` — id, employee_id, **branch_id**, hafta_kuni (0–6), kelish_vaqti, ketish_vaqti, is_dayoff — har bir hafta kuni uchun alohida filial belgilanadi (misol uchun bir xodim Dushanba/Chorshanba/Juma kunlari 1-filialga, qolgan kunlari 2-filialga bog'lanishi mumkin)
- `schedule_overrides` — id, employee_id, sana, branch_id (agar shu kun uchun filial ham o'zgargan bo'lsa), turi (dam_olish/boshqa), izoh
- `attendance` — id, employee_id, branch_id, sana, check_in_vaqti, check_out_vaqti, status (keldi/kechikdi/kelmadi), latitude, longitude, face_match_score
- `fines` — id, employee_id, attendance_id, summa, sabab, status (aktiv/bekor_qilingan), bekor_qilgan_admin_id, izoh
- `fine_rules` — id, branch_id (ixtiyoriy — filial darajasida farqlanishi uchun), min_daqiqa, max_daqiqa, summa
- `security_alerts` — id, employee_id, turi (yuz_mos_kelmadi/gps_buzildi), rasm_url, vaqt
- `telegram_auth_sessions` — id, otp_code, chat_id, telegram_id, user_id, status, user_metadata, created_at — **faqat `service_role` kira oladi**, RLS bilan client'dan butunlay yopiq (2.2-bo'limga qarang)

> **Eslatma (Auth):** `employees` jadvali Supabase'ning `auth.users` bilan bog'lanadi. Har bir xodim uchun `auth.users`da ichki texnik email (`tg_<telegram_id>@auth.internal`) va `user_metadata` ichida `telegram_id`, ism-familiya, telefon saqlanadi — parol maydoni umuman ishlatilmaydi.

---

## 7. Rollar va ruxsatlar (RLS)

Tizimda **3 ta rol** mavjud: **Super Admin**, **Admin**, **User**.

- **Super Admin** — barcha filiallar bo'yicha to'liq huquqqa ega, tizimda faqat bitta (yoki bir nechta, lekin cheklangan) shunday akkaunt bo'ladi. **Kod orqali to'g'ridan-to'g'ri database'ga yoziladi**, Telegram orqali ro'yxatdan o'tmaydi va bot orqali kirmaydi. Adminlarni yaratadi, ularni tayinlaydi va istalgan vaqtda o'zgartirishi/o'chirishi mumkin.
- **Admin** — faqat o'ziga biriktirilgan Branch(lar) doirasida amal qiladi. Boshqa filiallarning xodimlari, jadvali yoki jarimalariga tegina olmaydi.
- **User** — oddiy xodim, faqat o'z ma'lumotlariga kirish huquqiga ega.

| Amal | Super Admin | Admin (o'z branchida) | User |
|---|---|---|---|
| Face ID orqali Check-in/Check-out qilish | ❌ (mo'ljallanmagan) | ❌ (mo'ljallanmagan) | ✅ |
| O'z jarima/davomat tarixini ko'rish | — | — | ✅ (faqat o'ziniki) |
| Barcha filiallar ma'lumotini ko'rish | ✅ | ❌ | ❌ |
| O'z branchidagi xodimlar ma'lumotini ko'rish | ✅ | ✅ | ❌ |
| Jadval belgilash/o'zgartirish | ✅ (barcha) | ✅ (faqat o'z branchi) | ❌ |
| Jarima qoidalarini sozlash | ✅ | ✅ (faqat o'z branchi) | ❌ |
| Jarimani bekor qilish | ✅ | ✅ (faqat o'z branchi) | ❌ |
| Branch qo'shish/tahrirlash | ✅ | ❌ | ❌ |
| Dam olish kuni berish | ✅ | ✅ (faqat o'z branchi) | ❌ |
| Admin akkaunt yaratish/tayinlash | ✅ | ❌ | ❌ |

Supabase Row Level Security orqali har bir jadvalda shu qoidalar policy sifatida amalga oshiriladi — Admin uchun RLS policy `branch_id` ustuniga qarab cheklanadi, Super Admin uchun cheklovsiz (`is_super_admin = true` bo'lganda barcha qatorlarga ruxsat).

---

## 8. Hal qilingan qarorlar (v1.0 → v1.1 o'zgarishlari)

Quyidagi savollar loyiha egasi bilan aniqlashtirildi va spesifikatsiyaga kiritildi:

| Savol | Qaror |
|---|---|
| 30+ daqiqa kechikish/kelmaslik uchun jarima? | Bosqichma-bosqich, to'liq sozlanuvchan (masalan 1-10, 10-30, 30-50, 50+ daqiqa oralig'ida alohida summalar). Aniq summalarni Admin/Super Admin dashboard orqali o'zi belgilaydi. |
| Xodim bir nechta filialda ishlashi mumkinmi? | **Ha.** Filial biriktiruvi xodimga emas, uning **haftalik jadvaliga (kun-kun asosida)** bog'lanadi — masalan bir o'qituvchi toq kunlari 1-filialda, juft kunlari 2-filialda ishlashi mumkin. |
| Oylik maosh (payroll) hisob-kitobi tizimga kiradimi? | **Yo'q.** Bu tizim faqat davomat va jarimalarni hisoblaydi. Oylik maosh boshqa, alohida CRM tizimida hisoblanadi. |
| Telegram OTP qayta so'rash qanday ishlaydi? | Bot menyusida **doimiy tugmalar** bo'ladi: "Kontaktni ulashish" va "Kod olish". Xodim istalgan vaqt "Kod olish" tugmasini bosib, yangi OTP so'rashi mumkin. |
| Autentifikatsiya qanday texnik amalga oshiriladi? | **Supabase Auth + magiclink mexanizmi** orqali, to'liq parolsiz. Har bir xodimga ichki texnik email (`tg_<telegram_id>@auth.internal`) biriktiriladi, login `generateLink` + `verifyOtp` zanjiri bilan amalga oshadi. To'liq tavsif 2.2-bo'limda. |

---

## 9. To'liq Texnik Stack (Professional, Open-Source / Bepul manbalar)

Quyidagi stack **agentic coding** (Claude Code, Google Antigravity) yordamida qurish uchun optimallashtirilgan — barcha komponentlar bepul tier'ga ega yoki to'liq open-source.

### 9.1 Frontend

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **Next.js 15 (App Router)** | Asosiy frontend freymvork | Ham Employee App, ham Admin Dashboard shu asosda quriladi |
| **TypeScript** | Til | Xatolarni erta aniqlash, agentic coding uchun aniqroq kod generatsiyasi |
| **Tailwind CSS** | Styling | Utility-first, tez UI qurish |
| **shadcn/ui** | UI komponentlar kutubxonasi | Tayyor, ochiq kodli, to'liq moslashuvchan komponentlar (button, table, dialog, form va h.k.) |
| **TanStack Query (React Query)** | Server-state boshqaruvi | Ma'lumotlarni fetch qilish, keshlash, real-time yangilanishlarni boshqarish |
| **TanStack Table** | Admin Dashboard jadvallari | Xodimlar, jarimalar, davomat jadvallarini qurish uchun |
| **React Hook Form + Zod** | Formalar va validatsiya | Jadval, filial, jarima qo'shish formalarini boshqarish |
| **Zustand** | Client-state boshqaruvi (ixtiyoriy) | Kichik, oddiy global state uchun (masalan joriy filial filtri) |
| **next-pwa** yoki **Serwist** | PWA qo'llab-quvvatlash | Employee App'ni telefon ekraniga "o'rnatish" imkoniyati uchun |

### 9.2 Backend

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **Next.js API Routes / Route Handlers** | Backend logika | Alohida backend server shart emas — Next.js ichida to'liq backend logikasi (Face matching chaqiruvi, jarima hisoblash, Telegram bot webhook'lari, `/api/telegram-webhook` va `/api/telegram/verify-otp` route'lari) |
| **Supabase Auth** | Autentifikatsiya | Parolsiz, faqat Telegram OTP orqali — `generateLink({type:'magiclink'})` + `verifyOtp()` zanjiri bilan (to'liq mexanizm 2.2-bo'limda tasvirlangan) |
| **Supabase** | Database + Storage | PostgreSQL asosida, bepul tier 50-60 xodim uchun to'liq yetarli |
| **Supabase Edge Functions** (Deno) | Serverless funksiyalar | Cron job'lar (masalan, kunlik "Kelmadi" statusini belgilash), Telegram webhook qayta ishlash |
| **Supabase Row Level Security (RLS)** | Ruxsatlar tizimi | Super Admin / Admin / User rollari uchun database darajasidagi xavfsizlik |
| **Supabase Realtime** | Real-time yangilanishlar | Admin Dashboard'da "Hozir ishda" ro'yxatini jonli yangilash uchun |

### 9.3 Ma'lumotlar bazasi

| Texnologiya | Vazifasi |
|---|---|
| **Supabase (PostgreSQL)** | Asosiy ma'lumotlar bazasi — xodimlar, jadval, davomat, jarima, filiallar |
| **Supabase Storage** | Face embedding uchun emas (bu raqamlar DB'da saqlanadi), balki xavfsizlik ogohlantirishi rasmlari (begona shaxs suratlari) uchun |

### 9.4 Face Recognition / Face ID

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **face-api.js** | Brauzer tomonidagi (client-side) yuzni aniqlash, embedding yaratish, liveness'ga yordamchi | To'liq bepul, TensorFlow.js asosida, server kerak emas |
| **MediaPipe Face Mesh (Google)** | Liveness detection (ko'z qisish, bosh burish harakatlarini aniqlash) | Bepul, Google tomonidan qo'llab-quvvatlanadi, brauzerda ishlaydi |
| **DeepFace** yoki **InsightFace** (Python) | Backend tomonida qat'iy tekshiruv (ikkinchi qatlam) | Agar backend'da qo'shimcha aniqlik kerak bo'lsa — Supabase Edge Function orqali emas, alohida kichik Python microservice (masalan Railway/Render bepul tier'da) sifatida ishga tushiriladi |

> **Tavsiya:** MVP bosqichida faqat **face-api.js + MediaPipe** (to'liq client-side, qo'shimcha server xarajatisiz) yetarli. Agar keyinchalik aniqlikni oshirish kerak bo'lsa, DeepFace/InsightFace bilan ikkinchi tekshiruv qatlami qo'shiladi.

### 9.5 Xarita va Geolokatsiya

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **Yandex Maps API** | Filial manzilini xaritada belgilash, koordinata olish | O'zbekiston hududida Google Maps'ga nisbatan ko'proq aniqlik va bepul limitlar; **Yandex Maps JavaScript API** bepul tier mavjud |
| **Browser Geolocation API** | Xodim joylashuvini olish | Brauzer o'zining native API'si, qo'shimcha kutubxona kerak emas |
| **Haversine formula** (oddiy JS funksiya) | Ikki koordinata orasidagi masofani (metrda) hisoblash | Radius tekshiruvi uchun — kutubxona shart emas, 10 qatorlik oddiy matematik funksiya |

### 9.6 Telegram Bot va Autentifikatsiya

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **Telegram Bot API** (rasmiy) | Bot funksionalligi — menyu tugmalari, OTP yuborish, bildirishnomalar | To'liq bepul, rasmiy Telegram API |
| **grammY** yoki **node-telegram-bot-api** | Node.js uchun Telegram bot kutubxonasi | grammY — zamonaviyroq, TypeScript-friendly, tavsiya etiladi |
| **Webhook** (`/api/telegram-webhook`) | Bot xabarlarini qabul qilish (Next.js Route Handler orqali) | Polling o'rniga webhook — serverless muhitda tavsiya etiladigan usul; `curl .../setWebhook?url=...` orqali bir marta ro'yxatdan o'tkaziladi |
| **Supabase Auth Admin API** (`supabaseAdmin.auth.admin.createUser`, `generateLink`, `verifyOtp`) | Parolsiz foydalanuvchi yaratish va sessiya tokeni berish | 2.2-bo'limda tasvirlangan to'liq mexanizm — ichki texnik email + magiclink orqali |
| **`telegram_auth_sessions` jadvali (RLS bilan yopiq)** | OTP kodlarni vaqtinchalik saqlash | Faqat `service_role` kira oladi, client tomonidan o'qib bo'lmaydi |

### 9.7 Hosting / Deploy

| Texnologiya | Vazifasi | Izoh |
|---|---|---|
| **Vercel** | Next.js ilovasini hosting qilish | Next.js yaratuvchisi tomonidan taqdim etiladi, bepul (Hobby) tier kichik loyihalar uchun yetarli |
| **Supabase Cloud** | Database, Auth, Storage, Edge Functions hosting | Bepul tier: 500MB database, 50k monthly active users — 50-60 xodim uchun ortig'i bilan yetarli |

### 9.8 Qo'shimcha vositalar

| Texnologiya | Vazifasi |
|---|---|
| **date-fns** yoki **Day.js** | Sana/vaqt bilan ishlash (timezone hisoblash, UTC+5) |
| **ExcelJS** | Jarima/davomat hisobotlarini Excel formatida export qilish |
| **jsPDF** yoki **@react-pdf/renderer** | PDF hisobot generatsiyasi (agar kerak bo'lsa) |
| **Recharts** | Admin Dashboard'dagi statistik grafiklar (davomat foizi, jarima statistikasi) |
| **Sonner** | Toast/bildirishnoma UI komponenti (frontend ichida) |

### 9.9 Xulosa — Nima uchun bu stack?

- **100% Next.js + Supabase** — ikkita asosiy texnologiya bilan butun tizim quriladi, bu **agentic coding** (Claude Code, Antigravity) uchun juda mos, chunki AI agent kam sonli, keng qo'llaniladigan texnologiyalar bilan sifatliroq va barqarorroq kod yozadi
- **Barcha komponentlar bepul yoki open-source** — 50-60 xodimlik loyiha uchun oylik xarajat deyarli 0 so'm (faqat domen narxi va, agar kerak bo'lsa, Vercel/Supabase'ning kichik pullik qo'shimchalari)
- **Kelajakda kengaytirish oson** — agar xodimlar soni 500-1000 taga yetsa, Supabase va Vercel pullik tier'lariga oson o'tish mumkin, arxitektura o'zgarmaydi
