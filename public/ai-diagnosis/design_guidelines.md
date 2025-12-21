# QRコード/バーコードスキャナーアプリ - Design Guidelines

## Design Approach
**Hybrid Approach**: Inspired by modern Japanese utility apps (LINE, PayPay) that blend functionality with delightful aesthetics. Focus on soft gradients, rounded corners, and playful yet professional interface elements.

## Core Design Principles
- Bright, gradient-rich UI with soft pastel accents
- Generous whitespace and breathing room
- Rounded, friendly component shapes
- Clear visual hierarchy for quick scanning tasks
- Subtle depth through layering, not heavy shadows

## Typography
**Fonts**: Noto Sans Japanese (via Google Fonts CDN)
- Hero Text: 32px, font-bold (スキャン準備完了)
- Section Headers: 24px, font-semibold
- Body Text: 16px, font-normal
- Captions/Meta: 14px, font-medium
- Buttons: 16px, font-semibold

## Layout System
**Spacing**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-6, p-8
- Section gaps: gap-4, gap-6
- Screen margins: px-4 (mobile), px-6 (desktop)
- Card spacing: space-y-6

## Component Library

### Primary Screens

**1. Scanner Interface (Main Screen)**
- Full-screen camera viewfinder area (占 70% of viewport)
- Rounded scanning frame overlay (16px border-radius) centered in viewfinder
- Floating action button (fab) positioned bottom-center with backdrop-blur background
- Top bar: Back icon (left), "QRスキャナー" title (center), flashlight toggle (right)
- Bottom sheet: Recently scanned items preview (3 cards, horizontal scroll)

**2. Scan History View**
- Header: "履歴" with search icon and filter button
- Card grid (grid-cols-1 md:grid-cols-2)
- Each history card: scan type icon, content preview, timestamp, quick action buttons
- Empty state: Friendly illustration placeholder with "まだスキャンがありません"

**3. Scan Result Screen**
- Large result card (max-w-2xl centered)
- QR/Barcode visual representation at top
- Content type badge (URL, テキスト, 連絡先, etc.)
- Full content display area
- Action buttons row: コピー, 共有, ブラウザで開く (contextual based on type)
- "新しくスキャン" button bottom

**4. Settings Screen**
- Section groups with subtle dividers
- Toggle switches for: 自動コピー, バイブレーション, サウンド
- List items: スキャン履歴を管理, アプリについて, プライバシーポリシー
- Each item with chevron-right icon

### UI Components

**Buttons**
- Primary: Fully rounded (rounded-full), medium padding (px-8 py-3)
- Secondary: Outlined with gradient border effect
- Icon buttons: Circular (rounded-full), backdrop-blur when over images
- Floating Action Button: Large (w-16 h-16), shadow-lg, gradient fill

**Cards**
- History cards: rounded-2xl, p-6, subtle gradient background
- Result card: rounded-3xl, p-8, layered shadow effect
- Scan preview: rounded-xl, p-4, compact

**Navigation**
- Bottom tab bar: 4 items (スキャン, 履歴, 作成, 設定)
- Icons with labels, active state with gradient underline
- Safe area padding for iOS devices

**Modals/Sheets**
- Bottom sheets: rounded-t-3xl, slide-up animation
- Full modals: rounded-2xl on desktop, full-screen on mobile
- Backdrop: blur effect with semi-transparency

**Form Elements**
- Input fields: rounded-xl, p-4, soft inner shadow
- Dropdowns: Rounded with smooth expand animation
- Checkboxes/Toggles: Gradient fill when active

## Images
No hero images needed - this is a functional camera app. However:
- **Empty State Illustrations**: Friendly, minimalist illustrations for empty history (simple line art style, pastel-colored)
- **Onboarding Screens** (if implemented): 3 screens with illustration + text explaining camera permissions, how to scan, history features
- **Icon Assets**: Use Heroicons via CDN for all interface icons

## Screen-Specific Details

**Scanner Interface**:
- Scanning frame: Dashed gradient border with subtle pulse animation when active
- Corner markers: Small gradient accent pieces at frame corners
- Guide text: "QRコードまたはバーコードをフレーム内に" below frame, small text with backdrop-blur pill

**History Cards**:
- Left: Icon badge (different gradient per type - QR, barcode, text)
- Center: Two-line content preview, timestamp below
- Right: Kebab menu for delete/share

**Result Display**:
- Visual QR representation: If QR, show actual QR code. If barcode, show barcode lines
- Content area: Selectable text in rounded container
- Action buttons: Grid layout, 2-3 per row with icons + labels

## Animations
Minimal, purposeful only:
- Scanner frame: Gentle pulse on active scan
- Button press: Scale down to 0.95
- Card entry: Subtle slide-up with fade
- Bottom sheet: Smooth slide from bottom (300ms ease-out)

## Accessibility
- Minimum touch targets: 44px
- High contrast text against gradient backgrounds
- Focus states: Gradient outline ring
- Japanese screen reader support
- Camera permission clear messaging: "カメラへのアクセスが必要です"

This creates a delightful, gradient-rich Japanese scanner app that feels modern and approachable while maintaining excellent functionality.