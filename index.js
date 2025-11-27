import express from 'express';
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const CERTIFICATE_TEMPLATE_PATH = process.env.CERTIFICATE_TEMPLATE_PATH || path.join(__dirname, 'templates/template.ejs');
const CERTIFICATE_ASSETS_PATH = process.env.CERTIFICATE_ASSETS_PATH || path.join(__dirname, 'assets');

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:3000'];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'development') {
        res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function formatDate(date) {
    if (!date) {
        date = new Date();
    }

    if (typeof date === 'string') {
        date = new Date(date);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

async function readFileAsBase64(filePath) {
    try {
        const fileBuffer = await fs.readFile(filePath);
        const base64String = fileBuffer.toString('base64');
        return base64String;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
}

async function generateQRCodeBase64(data) {
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(data, {
            color: {
                dark: '#ffffff',
                light: '#0000'
            },
            errorCorrectionLevel: 'H',
            margin: 1
        });

        const base64String = qrCodeDataUrl.split(',')[1];
        return base64String;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
}

app.post('/generate-certificate', async (req, res) => {
    let browser = null;

    try {
        const {
            fullName,
            articleTitle,
            certificateId,
            qrCodeUrl,
            date
        } = req.body;

        if (!fullName || !articleTitle || !certificateId) {
            return res.status(400).json({
                error: 'Missing required parameters: fullName, articleTitle, and certificateId are required'
            });
        }

        const templatePath = CERTIFICATE_TEMPLATE_PATH;
        const bgImagePath = path.join(CERTIFICATE_ASSETS_PATH, 'bg.svg');
        const logoImagePath = path.join(CERTIFICATE_ASSETS_PATH, 'logo.svg');

        const template = await fs.readFile(templatePath, 'utf-8');

        const bgBase64 = await readFileAsBase64(bgImagePath);
        const logoBase64 = await readFileAsBase64(logoImagePath);

        const cleanCertificateId = certificateId.toString().replace('#', '');
        const formattedDate = formatDate(date || new Date());

        const verificationUrl = qrCodeUrl || `https://example.com/verify/${cleanCertificateId}`;
        const qrCodeBase64 = await generateQRCodeBase64(verificationUrl);

        const html = ejs.render(template, {
            id: cleanCertificateId,
            certificateId: cleanCertificateId,
            fullName: fullName || '',
            articleTitle: articleTitle || '',
            date: formattedDate,
            qr_code: qrCodeBase64,
            bgBase64: bgBase64,
            logoBase64: logoBase64
        });

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote'
            ]
        });

        const page = await browser.newPage();

        // Ensure viewport matches the target pixel dimensions so layout is stable
        await page.setViewport({
            width: 1828,
            height: 1073,
            deviceScaleFactor: 2
        });

        // Set HTML content and wait for network to be idle
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for fonts to be fully loaded (important for precise layout)
        try {
            await page.evaluate(() => document.fonts.ready);
        } catch (err) {
            // ignore if document.fonts is not supported
        }

        // Wait for images to be loaded to avoid layout shifts
        await page.evaluate(async () => {
            const imgs = Array.from(document.images || []);
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => { img.onload = img.onerror = resolve; });
            }));
        });

        const pdfBuffer = await page.pdf({
            width: '1828px',  // 1920px o'rniga
            height: '1073px', // 1327px o'rniga
            printBackground: true,
            // When explicit width/height are provided, avoid rotating the page
            landscape: false,
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            }
        });

        await browser.close();
        browser = null;

        const safeFullName = fullName
        .toString()
        .replace(/[^a-zA-Z0-9_\-]/g, '_');
        const filename = `${safeFullName}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating certificate:', error);

        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }

        res.status(500).json({
            error: 'Failed to generate certificate',
            message: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Certificate generation server is running' });
});

app.listen(PORT, () => {
    console.log(`Certificate generation server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Generate certificate: POST http://localhost:${PORT}/generate-certificate`);
});

