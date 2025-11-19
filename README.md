# Certificate PDF Generation Server

Server-side PDF certificate generation service using Node.js, Express, and Puppeteer.

## File Structure

Barcha kerakli fayllar server papkasida bo'lishi kerak:

```
server/
├── index.js              # Main server file
├── package.json          # Dependencies
├── templates/
│   └── template.ejs     # EJS template (bu faylni server/templates/ papkasiga ko'chiring)
└── assets/
    ├── bg.png           # Background image (bu faylni server/assets/ papkasiga ko'chiring)
    └── logo.svg         # Logo image (bu faylni server/assets/ papkasiga ko'chiring)
```

## Installation

```bash
cd server
npm install
```

## Configuration

### Environment Variables (ixtiyoriy)

Agar fayllar boshqa joyda bo'lsa, environment variable'lar orqali path'larni belgilash mumkin:

```bash
PORT=3001
CERTIFICATE_TEMPLATE_PATH=/absolute/path/to/templates/template.ejs
CERTIFICATE_ASSETS_PATH=/absolute/path/to/assets
```

**Default:** Agar environment variable'lar belgilanmasa, server quyidagi path'larni ishlatadi:
- Template: `server/templates/template.ejs`
- Assets: `server/assets/`

## Fayllarni ko'chirish

Server'ni ishlatishdan oldin, quyidagi fayllarni ko'chiring:

1. **Template fayl:**
   ```bash
   cp /path/to/sertificate/template.ejs server/templates/
   ```

2. **Asset fayllar:**
   ```bash
   cp /path/to/public/sertificate/assets/bg.png server/assets/
   cp /path/to/public/sertificate/assets/logo.svg server/assets/
   ```

## Running the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on port 3001 (or the port specified in the PORT environment variable).

## API Endpoint

### POST `/generate-certificate`

Generates a PDF certificate from the provided data.

**Request Body:**
```json
{
    "fullName": "John Doe",
    "articleTitle": "Research Article Title",
    "certificateId": "12345",
    "qrCodeUrl": "https://example.com/verify/12345",
    "date": "2025-01-15"
}
```

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="John_Doe_sertifikat.pdf"`
- Body: PDF file buffer

## Client-Side Usage

Frontend'dan faqat API so'rov yuboriladi:

```javascript
import { generateCertificatePdfFromServer } from '@/utils/certificateServer.js';

await generateCertificatePdfFromServer({
    fullName: 'John Doe',
    articleTitle: 'Research Article Title',
    certificateId: '12345',
    qrCodeUrl: 'https://example.com/verify/12345',
    serverUrl: 'http://localhost:3001'
});
```

## Requirements

- Node.js 18+ (ES Modules support)
- Puppeteer (requires Chromium)
- Template va asset fayllar server papkasida bo'lishi kerak

## Server Requirements

For production deployment, ensure:
- Chromium/Chrome is installed on the server
- Sufficient memory for Puppeteer
- Network access for font loading (Google Fonts)

## Error Handling

The server returns appropriate HTTP status codes:
- `400`: Missing required parameters
- `500`: Server error during PDF generation

Error responses include JSON with error details:
```json
{
    "error": "Error message",
    "message": "Detailed error message"
}
```
