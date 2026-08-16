const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// अपलोड फोल्डर
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// आपके नए रेट (B&W = ₹5, Color = ₹10)
const RATES = {
    bw_single: 5,   // ब्लैक & व्हाइट ₹5 प्रति पेज
    color: 10       // कलर ₹10 प्रति पेज
};

let orders = [];
let tokenCounter = 101;

// बिलिंग API
app.post('/api/upload-and-calculate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'फाइल अपलोड नहीं हुई' });
        }

        const printType = req.body.printType || 'bw_single';
        const copies = parseInt(req.body.copies) || 1;
        let totalPages = 1;

        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const dataBuffer = fs.readFileSync(req.file.path);
                const pdfData = await pdfParse(dataBuffer);
                if (pdfData && pdfData.numpages) {
                    totalPages = pdfData.numpages;
                }
            } catch (pdfErr) {
                totalPages = 1;
            }
        }

        let ratePerPage = RATES[printType] || 5;
        let totalAmount = totalPages * ratePerPage * copies;

        res.json({
            success: true,
            fileId: req.file.filename,
            originalName: req.file.originalname,
            totalPages,
            ratePerPage,
            copies,
            totalAmount,
            printType
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'फाइल प्रोसेस करने में समस्या आई' });
    }
});

// ऑर्डर कन्फर्म API
app.post('/api/confirm-order', (req, res) => {
    const { fileId, originalName, totalPages, printType, copies, totalAmount, customerName, customerPhone } = req.body;

    const newOrder = {
        tokenNo: tokenCounter++,
        fileId,
        originalName,
        totalPages: totalPages || 1,
        printType: printType || 'bw_single',
        copies: copies || 1,
        totalAmount: totalAmount || 0,
        customerName: customerName || 'ग्राहक',
        customerPhone: customerPhone || 'N/A',
        createdAt: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    };

    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

// डैशबोर्ड ऑर्डर्स API
app.get('/api/admin/orders', (req, res) => {
    res.json(orders);
});

// डाउनलोड API
app.get('/api/download/:fileId', (req, res) => {
    const filePath = path.join(uploadDir, req.params.fileId);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('फाइल नहीं मिली');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(SIDDIQUI SAHAJ Server Running on port ${PORT});
});
